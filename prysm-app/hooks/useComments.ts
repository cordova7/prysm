/**
 * Comments hook
 * Handles fetching and submitting comments with verified holdings
 */
import { useState, useCallback, useEffect } from 'react';
import { useWallet } from '@/contexts/WalletContext';

interface Comment {
  id: string;
  token_ledger_id: string;
  author_principal: string;
  content: string;
  pry_balance_at_post: string;
  stake_amount_at_post: string;
  fees_earned_at_post: string;
  created_at: string;
}

interface UseCommentsOptions {
  tokenId: string;
  enabled?: boolean;
  limit?: number;
}

interface UseCommentsReturn {
  comments: Comment[];
  isLoading: boolean;
  isSubmitting: boolean;
  error: Error | null;
  submitComment: (content: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const COMMENTS_CACHE_TTL = 2 * 60 * 1000;
const COMMENTS_CACHE_PREFIX = 'token_comments_';

const readCommentsCache = (cacheKey: string): Comment[] | null => {
  if (typeof window === 'undefined') return null;
  try {
    const cached = sessionStorage.getItem(`${COMMENTS_CACHE_PREFIX}${cacheKey}`);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    if (!parsed || !parsed.data || !parsed.timestamp) return null;
    const age = Date.now() - parsed.timestamp;
    if (age > COMMENTS_CACHE_TTL) {
      sessionStorage.removeItem(`${COMMENTS_CACHE_PREFIX}${cacheKey}`);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
};

const writeCommentsCache = (cacheKey: string, data: Comment[]) => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      `${COMMENTS_CACHE_PREFIX}${cacheKey}`,
      JSON.stringify({ data, timestamp: Date.now() })
    );
  } catch {
    // Ignore storage failures
  }
};

/**
 * Hook for comments management
 */
export function useComments({
  tokenId,
  enabled = true,
  limit = 50,
}: UseCommentsOptions): UseCommentsReturn {
  const { isConnected, principal } = useWallet();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Fetch comments for token
   */
  const fetchComments = useCallback(async (options?: { force?: boolean }) => {
    if (!enabled) {
      setComments([]);
      return;
    }

    try {
      const cacheKey = `${tokenId}-${limit}`;
      if (!options?.force) {
        const cached = readCommentsCache(cacheKey);
        if (cached) {
          setComments(cached);
          setIsLoading(false);
          return;
        }
      }

      setIsLoading(true);
      setError(null);

      const cacheBust = options?.force ? `&t=${Date.now()}` : '';
      const response = await fetch(`/api/comments/${tokenId}?limit=${limit}${cacheBust}`, {
        cache: options?.force ? 'no-store' : 'default',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch comments');
      }

      const data = await response.json();

      if (data.success) {
        const nextComments = data.comments || [];
        setComments(nextComments);
        writeCommentsCache(cacheKey, nextComments);
      } else {
        throw new Error(data.error || 'Failed to fetch comments');
      }
    } catch (err) {
      console.error('Failed to fetch comments:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch comments'));
      setComments([]);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, tokenId, limit]);

  /**
   * Submit new comment
   */
  const submitComment = useCallback(
    async (content: string) => {
      if (!isConnected || !principal) {
        throw new Error('Wallet not connected');
      }

      if (!content || content.trim().length === 0) {
        throw new Error('Comment cannot be empty');
      }

      if (content.length > 1000) {
        throw new Error('Comment too long (max 1000 characters)');
      }

      try {
        setIsSubmitting(true);
        setError(null);

        const response = await fetch('/api/comments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tokenId,
            content: content.trim(),
            authorPrincipal: principal.toString(),
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to submit comment');
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to submit comment');
        }

        // Refresh comments
        await fetchComments({ force: true });
      } catch (err) {
        console.error('Failed to submit comment:', err);
        const errorMsg = err instanceof Error ? err.message : 'Failed to submit comment';
        setError(new Error(errorMsg));
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [isConnected, principal, tokenId, fetchComments]
  );

  /**
   * Refresh comments
   */
  const refresh = useCallback(async () => {
    await fetchComments({ force: true });
  }, [fetchComments]);

  // Fetch comments on mount and when dependencies change
  useEffect(() => {
    if (enabled) {
      fetchComments();
    }
  }, [enabled, fetchComments]);

  return {
    comments,
    isLoading,
    isSubmitting,
    error,
    submitComment,
    refresh,
  };
}

export async function prefetchComments(tokenId: string, limit = 50): Promise<void> {
  if (!tokenId) return;
  const cacheKey = `${tokenId}-${limit}`;
  const cached = readCommentsCache(cacheKey);
  if (cached) return;

  try {
    const response = await fetch(`/api/comments/${tokenId}?limit=${limit}`);
    if (!response.ok) return;
    const data = await response.json();
    if (data?.success) {
      writeCommentsCache(cacheKey, data.comments || []);
    }
  } catch {
    // Best-effort prefetch
  }
}
