import { useState, useMemo, useCallback, useRef, useEffect, memo } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import ControllerPopup from './ControllerPopup'
import Portal from './Portal'
import { useControllerRelationships } from '@/hooks/useControllerRelationships'
import { useTokenTransactions } from '@/hooks/useTokenTransactions'
import { useInfiniteTransactions } from '@/hooks/useInfiniteTransactions'
import TransactionListModal from './TransactionListModal'
import { useTokenLogo } from '@/hooks/useTokenLogo'
import { StakingPanel } from './staking'
import { BidModal } from './promotions'
import { CommentSection } from './comments'
import { TokenCardTabs } from './TokenCardTabs'
import { useTokenTotalSupply } from '@/hooks/useTokenTotalSupply'


const DynamicTokenChart = dynamic(() => import('./TokenChart'), {
  ssr: false,
  loading: () => <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4 h-64 flex items-center justify-center"><div className="text-[var(--color-text-secondary)]">Loading chart...</div></div>
})


const AlphaInfo = ({ token }) => {
  const { hasRelationships: checkHasRelationships } = useControllerRelationships(
    token.tokenLedgerId,
    token.controllers || []
  );

  // Fetch real transaction data from ICPSwap (show ALL transactions!)
  const { activity, isLoading: activityLoading } = useTokenTransactions(token.tokenLedgerId, {
    limit: 50, // Match modal batch size for consistency
    refreshInterval: 60000, // Refresh every minute
  });

  // State for transaction modal
  const [showTxModal, setShowTxModal] = useState(false);

  // Format controller for display (full ID, not truncated for clarity)
  const formatController = (ctrl) => {
    return ctrl;
  };

  // Render all controllers - popup shows relationships or lack thereof
  const renderControllers = (controllers) => {
    if (!controllers || controllers.length === 0) {
      return <span className="text-[var(--color-text-muted)] text-xs">No controllers</span>;
    }

    return (
      <div className="space-y-1.5">
        {controllers.slice(0, 3).map((ctrl, idx) => {
          const hasRels = checkHasRelationships(ctrl);

          return (
            <ControllerPopup
              key={idx}
              controller={ctrl}
              token={token}
              hasRelationships={hasRels}
            >
              <div className={`group relative flex items-start gap-2 cursor-pointer hover:bg-[var(--color-bg-tertiary)]/50 rounded p-1.5 transition-all ${
                hasRels ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-muted)]'
              }`}>
                <p className={`text-xs font-mono transition-colors break-all pr-5 flex-1 min-w-0 ${
                  hasRels ? 'text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-muted)]' : 'text-[var(--color-text-muted)]'
                }`}>
                  {formatController(ctrl)}
                </p>
                {hasRels && (
                  <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-3 h-3 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                )}
              </div>
            </ControllerPopup>
          );
        })}
        {controllers.length > 3 && (
          <p className="text-xs text-[var(--color-text-muted)]">
            +{controllers.length - 3} more
          </p>
        )}
      </div>
    );
  };

  // Render transaction activity (Keep it simple!)
  const renderActivity = () => {
    if (activityLoading) {
      return (
        <div className="space-y-1">
          <div className="h-3 bg-[var(--color-bg-card)] rounded animate-pulse" />
          <div className="h-3 bg-[var(--color-bg-card)] rounded w-3/4 animate-pulse" />
        </div>
      );
    }

    if (!activity) {
      return (
        <div className="space-y-1">
          <p className="text-xs text-[var(--color-text-muted)]">No data available</p>
        </div>
      );
    }

    const txCount = activity.transactionCount || 0;
    const volume = activity.formattedVolume || '$0.00';
    const hasRealActivity = activity.hasActivity && txCount > 0;

    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-xs text-[var(--color-text-secondary)]">
            Vol: {hasRealActivity ? volume : '$0.00'}
          </p>
        </div>
        {!hasRealActivity && (
          <p className="text-[10px] text-[var(--color-text-muted)]">No transactions on ICPSwap</p>
        )}
      </div>
    );
  };

  // Format price function (local to AlphaInfo)
  const formatPrice = (value) => {
    if (value === 0) return '0.00';
    if (value < 0.000001) return value.toFixed(12);
    if (value < 0.01) return value.toFixed(6);
    if (value < 1) return value.toFixed(4);
    if (value < 100) return value.toFixed(2);
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <>
      {/* Chart */}
      <div className="mt-3 mb-3">
        <DynamicTokenChart tokenId={token.tokenLedgerId} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Controllers */}
        <div className="bg-[var(--color-bg-secondary)] rounded-lg p-2 border border-[var(--color-border)]">
          <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-2 font-medium">Controllers</p>
          {token.controllers && token.controllers.length > 0 ? (
            renderControllers(token.controllers)
          ) : (
            <p className="text-xs text-[var(--color-text-muted)]">None</p>
          )}
        </div>

        {/* Activity - Now showing real ICPSwap transactions */}
        <div
          className="bg-[var(--color-bg-secondary)] rounded-lg p-2 border border-[var(--color-border)] hover:border-[var(--color-border-hover)] transition-colors cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setShowTxModal(true);
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium">
              Activity
            </p>
            {activity && activity.hasActivity && activity.transactionCount > 0 && (
              <svg className="w-3 h-3 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </div>
          {renderActivity()}
          {activity && activity.hasActivity && activity.transactionCount > 0 && (
            <p className="text-[10px] text-[var(--color-text-secondary)] mt-1 group-hover:text-[var(--color-text-muted)]">Click to view all transactions →</p>
          )}
        </div>
      </div>

      {/* Staking Section */}
      <div className="mt-4">
        <StakingPanel token={token} />
      </div>

      {/* Comments Section */}
      <div className="mt-4">
        <CommentSection token={token} />
      </div>

      {/* Transaction List Modal */}
      <TransactionListModal
        isOpen={showTxModal}
        onClose={() => setShowTxModal(false)}
        token={token}
      />
    </>
  )
}

function TokenCardComponent({ token, defaultExpanded = false, allowCollapse = true, layout = 'stacked' }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded || !allowCollapse)
  const [tradeMode, setTradeMode] = useState('buy')
  const [showBidModal, setShowBidModal] = useState(false)
  const [copiedId, setCopiedId] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const router = useRouter()
  const hoverTimeoutRef = useRef(null)
  const cardRef = useRef(null)

  // Fetch token logo
  const { logo, isLoading: logoLoading } = useTokenLogo(token.tokenLedgerId)
  const [logoError, setLogoError] = useState(false)

  // Fetch token total supply
  const { totalSupply } = useTokenTotalSupply(token.tokenLedgerId)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!token?.tokenLedgerId || !Array.isArray(token?.chartCache)) return
    const cacheKey = `chart_${token.tokenLedgerId}_24h`
    if (sessionStorage.getItem(cacheKey)) return

    const payload = {
      success: true,
      data: token.chartCache,
      token: token.tokenLedgerId,
      timeRange: '24h',
      cached: true,
      timestamp: new Date().toISOString(),
    }

    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(payload))
    } catch {
      // Ignore storage failures
    }
  }, [token?.tokenLedgerId, token?.chartCache])

  // Steve Jobs Magic: Pre-cache chart on hover anticipation
  const handleHover = useCallback(() => {
    // Clear existing timer
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }

    // Pre-cache full chart data after 100ms hover (anticipation)
    hoverTimeoutRef.current = setTimeout(() => {
      // Prefetch the ACTUAL chart data user will need (24h timeframe)
      fetch(`/api/chart/${token.tokenLedgerId}?timeRange=24h`)
        .then(response => response.json())
        .then(data => {
          if (data.success && typeof window !== 'undefined') {
            // Store in sessionStorage for instant access when card expands
            try {
              sessionStorage.setItem(
                `chart_${token.tokenLedgerId}_24h`,
                JSON.stringify(data)
              )
            } catch {
              // Ignore quota/private-mode failures
            }
          }
        })
        .catch(() => {
          // Silently fail - this is just optimization
        })
    }, 100)
  }, [token.tokenLedgerId])

  // Handle mouse enter to track hover state
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true)
    handleHover()
  }, [handleHover])

  // Handle mouse leave to clean up hover state
  const handleMouseLeave = useCallback(() => {
    setIsHovered(false)

    // Clear pending hover timeout to prevent stale callbacks
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
  }, [])

  // Copy canister ID to clipboard
  const copyCanisterId = useCallback(async (e) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(token.tokenLedgerId)
      setCopiedId(token.tokenLedgerId)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [token.tokenLedgerId])

  // Memoize expensive computations
  const priceChange = useMemo(() => token?.priceChange24h ?? 0, [token?.priceChange24h])
  const isNew = useMemo(() => token?.isNew || false, [token?.isNew])
  const price = useMemo(() => token?.price ?? 0, [token?.price])

  // Memoize formatPrice function
  const formatPrice = useCallback((value) => {
    if (value === 0) return '0.00';
    if (value < 0.000001) return value.toFixed(12);
    if (value < 0.01) return value.toFixed(6);
    if (value < 1) return value.toFixed(4);
    if (value < 100) return value.toFixed(2);
    // Use 'en-US' locale for consistent formatting between server and client
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, []);

  // Memoize formatSupply function
  const formatSupply = useCallback((value) => {
    if (!value || value === 0) return '0';
    if (value >= 1e12) return (value / 1e12).toFixed(2) + 'T';
    if (value >= 1e9) return (value / 1e9).toFixed(2) + 'B';
    if (value >= 1e6) return (value / 1e6).toFixed(2) + 'M';
    if (value >= 1e3) return (value / 1e3).toFixed(2) + 'K';
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }, []);

  // Memoize handlers
  const handleBuyClick = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setTradeMode('buy')
    if (allowCollapse) {
      setIsExpanded(true)
    }
  }, [allowCollapse])

  const handlePromoteClick = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setShowBidModal(true)
  }, [])

  const toggleExpanded = useCallback(() => {
    if (!allowCollapse) return
    setIsExpanded(prev => !prev)
  }, [allowCollapse])

  const handleCardClick = useCallback((e) => {
    if (!allowCollapse) return
    if (e.target.closest('button')) return
    setIsExpanded(prev => !prev)
  }, [allowCollapse])

  return (
    <>
      <div
        ref={cardRef}
        className={`snipe-card rounded-xl ${allowCollapse ? 'p-3 sm:p-5' : 'p-4 sm:p-6'} cursor-pointer transition-all duration-300 overflow-hidden ${
          isHovered ? 'border-[var(--color-border-hover)]' : 'hover:border-[var(--color-border)]'
        }`}
        onClick={handleCardClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        data-testid="token-card"
        data-token-id={token.tokenLedgerId}
        data-token-card="true"
        data-token-ledger-id={token.tokenLedgerId}
        style={{
          position: 'relative',
        }}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          {/* Token Identity - Left Side */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Avatar with Elegant Hover Zoom - Steve Jobs Edition */}
            <div className="relative overflow-visible">
              {logo && !logoError ? (
                <img
                  src={logo}
                  alt={token.symbol || 'Token'}
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover transition-[transform,filter] duration-300 ease-out hover:scale-[1.65] hover:shadow-[0_20px_60px_rgba(0,0,0,0.45)] cursor-pointer"
                  onError={() => setLogoError(true)}
                  onClick={(e) => {
                    e.stopPropagation();
                    copyCanisterId(e);
                  }}
                />
              ) : (
                <div
                  className="w-10 h-10 sm:w-12 sm:h-12 bg-[var(--color-bg-tertiary)] rounded-lg flex items-center justify-center text-[var(--color-text)] font-light text-lg sm:text-xl shadow-lg hover:scale-[1.05] transition-transform cursor-pointer border border-[var(--color-border)]"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyCanisterId(e);
                  }}
                >
                  {token.symbol?.charAt(0) || 'T'}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1 flex-wrap">
                <h3 className="text-lg sm:text-xl font-light text-[var(--color-text)] tracking-tight truncate">
                  {token.symbol || 'TOKEN'}
                </h3>
                <button
                  onClick={copyCanisterId}
                  className="group bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-card)] text-secondary hover:text-[var(--color-text)] text-[10px] sm:text-xs font-mono px-1.5 py-0.5 rounded transition-all flex items-center gap-1 shrink-0 border border-[var(--color-border)]"
                >
                  <span className="max-w-[80px] sm:max-w-none truncate">{token.tokenLedgerId}</span>
                  <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {copiedId === token.tokenLedgerId && (
                    <span className="text-green-400">✓</span>
                  )}
                </button>
              </div>
              <p className="text-xs sm:text-sm text-secondary font-light truncate">
                {token.name || 'Token Name'}
              </p>
            </div>
          </div>

          {/* Price Center - Stacks below on mobile */}
          <div className="flex-1 flex justify-center sm:justify-center w-full sm:w-auto">
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-thin text-[var(--color-text)] mb-0.5 sm:mb-1">
                ${formatPrice(price)}
              </div>
              <div className={`text-xs sm:text-sm font-light ${
                priceChange >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {priceChange >= 0 ? '↑' : '↓'} {Math.abs(priceChange).toFixed(2)}%
              </div>
            </div>
          </div>

          {/* Action Buttons - Right Side */}
          <div className="flex gap-2 w-full sm:w-auto justify-center sm:justify-end">
            <button
              onClick={handlePromoteClick}
              className="snipe-button snipe-button-primary text-sm sm:text-base px-4 sm:px-6 py-1.5 sm:py-2"
            >
              Promote
            </button>
          </div>
        </div>

        {/* Mini Chart Preview */}
        <div className="mt-3">
        </div>

        {/* Expand/Collapse Indicator */}
        {allowCollapse && (
          <div className="flex justify-center mt-2">
            <svg
              className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        )}

        {/* Expanded Content */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[2000px] mt-3' : 'max-h-0'}`}>
          <TokenCardTabs
            token={token}
            tradeMode={tradeMode}
            onTradeModeChange={setTradeMode}
            layout={layout}
          />
        </div>
      </div>

      <Portal>
        <BidModal
          isOpen={showBidModal}
          onClose={() => setShowBidModal(false)}
          token={token}
          onSuccess={() => {
            console.log('Bid submitted successfully!');
          }}
        />
      </Portal>
    </>
  )
}


// Export with memo to prevent unnecessary re-renders
export default memo(TokenCardComponent, (prevProps, nextProps) => {
  // Custom comparison: only re-render if token data actually changed
  return (
    prevProps.token.tokenLedgerId === nextProps.token.tokenLedgerId &&
    prevProps.token.price === nextProps.token.price &&
    prevProps.token.priceChange24h === nextProps.token.priceChange24h &&
    prevProps.token.isNew === nextProps.token.isNew &&
    prevProps.defaultExpanded === nextProps.defaultExpanded &&
    prevProps.allowCollapse === nextProps.allowCollapse &&
    prevProps.layout === nextProps.layout
  )
})
