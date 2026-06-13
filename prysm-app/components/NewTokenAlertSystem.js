'use client';

import TokenList from '@/components/TokenList'
import { TokenListSkeleton } from '@/components/SkeletonLoader'
import { useTokens } from '@/hooks/useTokens'
import { useRealTimeTokenUpdates } from '@/hooks/useWebSocket'
import { useEffect, useState, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function NewTokenAlertSystem() {
  const { data: tokens = [], isLoading, error } = useTokens()
  const [newTokens, setNewTokens] = useState([])
  const [isInitialized, setIsInitialized] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [isHydrated, setIsHydrated] = useState(false)
  const tokensPerPage = 20

  useRealTimeTokenUpdates()

  // Mark component as hydrated on first client render
  useEffect(() => {
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    // Only load new tokens on initial load, not on every update
    if (tokens.length > 0 && !isInitialized) {
      const loadNewTokens = async () => {
        try {
          const newTokensResponse = await fetch('/api/new-tokens/supabase')
          if (newTokensResponse.ok) {
            const newTokensData = await newTokensResponse.json()
            setNewTokens(newTokensData.data || [])
          }
        } catch (err) {
          console.error('Error loading new tokens:', err)
        } finally {
          setIsInitialized(true)
        }
      }
      loadNewTokens()
    }
  }, [tokens, isInitialized])

  // Filter out invalid/empty tokens
  // Remove tokens that have no name, no symbol, or no tokenLedgerId
  const validTokens = tokens.filter(token => {
    // Check if token exists
    if (!token) return false;

    // Must have tokenLedgerId
    if (!token.tokenLedgerId) return false;

    // Must have either name or symbol
    if (!token.name && !token.symbol) return false;

    // Must not be just placeholder text
    const name = (token.name || '').toLowerCase();
    const symbol = (token.symbol || '').toLowerCase();
    if (name === 'token name' || name === 'unnamed' || name === 'unknown' ||
        symbol === 'token' || symbol === 'unnamed' || symbol === 'unknown') {
      return false;
    }

    return true;
  })

  // Calculate pagination
  const totalPages = Math.ceil(validTokens.length / tokensPerPage)
  const startIndex = (currentPage - 1) * tokensPerPage
  const endIndex = startIndex + tokensPerPage
  const currentTokens = validTokens.slice(startIndex, endIndex)

  // Reset to page 1 when tokens change
  useEffect(() => {
    setCurrentPage(1)
  }, [validTokens.length])

  // Error boundary with retry
  if (error) {
    return (
      <ErrorFallback error={error} />
    )
  }

  // During server rendering and first hydration, always render the skeleton
  // This prevents hydration mismatch
  if (!isHydrated || isLoading) {
    return (
      <div className="min-h-screen bg-[#161614]">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <TokenListSkeleton />
        </div>
      </div>
    )
  }

  // After hydration and data is loaded, show the actual content
  return (
    <div className="min-h-screen bg-[#161614]">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <TokenList tokens={currentTokens} />

        {/* Simple pagination - Jobs style: minimal, clean */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center mt-12 space-x-4">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="snipe-button snipe-button-ghost disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>

            <span className="text-gray-400 text-sm">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="snipe-button snipe-button-ghost disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ErrorFallback({ error }) {
  return (
    <div className="min-h-screen bg-[#161614] flex items-center justify-center p-4">
      <motion.div
        className="max-w-md text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h3 className="text-2xl font-light text-[#f6fdff] mb-4">Connection Issue</h3>
        <p className="text-gray-400 mb-6">{error.message || 'Unable to load tokens. Please try again.'}</p>
        <button
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.location.reload();
            }
          }}
          className="snipe-button snipe-button-primary"
        >
          Retry
        </button>
      </motion.div>
    </div>
  )
}
