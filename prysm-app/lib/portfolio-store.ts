const STORAGE_PREFIX = 'prysm_portfolio_tokens:';

function getStorageKey(principalText?: string | null) {
  const key = principalText && principalText.length > 0 ? principalText : 'anonymous';
  return `${STORAGE_PREFIX}${key}`;
}

export function loadImportedTokens(principalText?: string | null): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getStorageKey(principalText));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value) => typeof value === 'string');
  } catch {
    return [];
  }
}

export function saveImportedTokens(tokens: string[], principalText?: string | null) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getStorageKey(principalText), JSON.stringify(tokens));
  } catch {
    // Ignore storage failures
  }
}

export function addImportedToken(tokenId: string, principalText?: string | null) {
  if (!tokenId) return;
  const existing = loadImportedTokens(principalText);
  if (existing.includes(tokenId)) return;
  saveImportedTokens([tokenId, ...existing], principalText);
}

export function addImportedTokens(tokenIds: string[], principalText?: string | null) {
  if (!tokenIds?.length) return;
  const existing = loadImportedTokens(principalText);
  const next = [...new Set([...tokenIds, ...existing].filter(Boolean))];
  saveImportedTokens(next, principalText);
}

export function removeImportedToken(tokenId: string, principalText?: string | null) {
  if (!tokenId) return;
  const existing = loadImportedTokens(principalText);
  saveImportedTokens(existing.filter((value) => value !== tokenId), principalText);
}
