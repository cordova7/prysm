import { memo, useMemo, useEffect } from 'react'
import TokenCard from '@/components/TokenCard'
import { preloadTokenLogos } from '@/hooks/useTokenLogo'

function TokenListComponent({ tokens }) {
  // Memoize token count to prevent unnecessary re-renders
  const tokenCount = useMemo(() => tokens.length, [tokens.length])

  // Memoize token array to optimize map operations
  const tokenList = useMemo(() => tokens, [tokens])

  // Preload logos for the first 20 tokens (highest icID - what user sees first)
  useEffect(() => {
    if (tokens && tokens.length > 0) {
      const firstTokenIds = tokens.slice(0, 20).map(t => t.tokenLedgerId || t.id);
      preloadTokenLogos(firstTokenIds);
    }
  }, [tokens]);


  return (
    <div className="space-y-4">
      {tokenList.map((token) => (
        <TokenCard key={token.id || token.tokenLedgerId} token={token} />
      ))}
    </div>
  )
}

// Export with memo to prevent unnecessary re-renders
export default memo(TokenListComponent)
