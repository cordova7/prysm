import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { CommentSection } from './comments';
import { ConnectButton } from './wallet';
import TransactionListModal from './TransactionListModal';
import ControllerPopup from './ControllerPopup';
import { useControllerRelationships } from '@/hooks/useControllerRelationships';
import { useTokenTransactions } from '@/hooks/useTokenTransactions';
import { useStaking } from '@/hooks/useStaking';
import { useWallet } from '@/contexts/WalletContext';
import { useTokenLogo } from '@/hooks/useTokenLogo';
import { SwapPanel } from './swap';
import { useTokenPool } from '@/hooks/useTokenPool';
import { useTokenTotalSupply } from '@/hooks/useTokenTotalSupply';
import { usePoolActions } from '@/hooks/usePoolActions';
import { TokenHoldersTable } from './TokenHoldersTable';
import { PrincipalTransactionsTooltip } from './PrincipalTransactionsTooltip';

const DynamicTokenChart = dynamic(() => import('./TokenChart'), {
  ssr: false,
  loading: () => (
    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded h-full flex items-center justify-center min-h-[300px]">
      <div className="text-[var(--color-text)] font-mono text-xs animate-pulse">LOADING_CHART...</div>
    </div>
  ),
});

// Token logo component for activity transactions
function ActivityTokenLogo({ tokenId, symbol, size = 18 }) {
  const { logo } = useTokenLogo(tokenId);

  return (
    <div
      className="rounded-full bg-[var(--color-surface-tile-3)] border border-[var(--color-border)] overflow-hidden flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      {logo ? (
        <img src={logo} alt={symbol} className="w-full h-full object-cover" />
      ) : (
        <span className="text-[8px] font-mono text-[var(--color-text-muted)]">{symbol?.charAt(0) || '?'}</span>
      )}
    </div>
  );
}

// Format token amount concisely
function formatTokenAmount(amount) {
  if (!amount || amount === 0) return '0';
  const absAmount = Math.abs(amount);
  if (absAmount >= 1e9) return (amount / 1e9).toFixed(2) + 'B';
  if (absAmount >= 1e6) return (amount / 1e6).toFixed(2) + 'M';
  if (absAmount >= 1e3) return (amount / 1e3).toFixed(2) + 'K';
  if (absAmount >= 1) return amount.toFixed(2);
  if (absAmount >= 0.0001) return amount.toFixed(4);
  return amount.toFixed(6);
}

// Activity transaction row with token logos and exchange visualization
function ActivityTransactionRow({ tx, formatTimestamp }) {
  const token0Change = tx.token0ChangeAmount || tx.amountToken0 || 0;
  const token1Change = tx.token1ChangeAmount || tx.amountToken1 || 0;

  // Determine which token was sold and which was bought
  const isSell0 = token0Change > token1Change;

  const soldToken = isSell0 ? {
    id: tx.token0Id,
    symbol: tx.token0Symbol,
    amount: Math.abs(token0Change)
  } : {
    id: tx.token1Id,
    symbol: tx.token1Symbol,
    amount: Math.abs(token1Change)
  };

  const boughtToken = isSell0 ? {
    id: tx.token1Id,
    symbol: tx.token1Symbol,
    amount: Math.abs(token1Change)
  } : {
    id: tx.token0Id,
    symbol: tx.token0Symbol,
    amount: Math.abs(token0Change)
  };

  const isSwap = tx.action === 'Swap';
  const isLiquidity = tx.action?.includes('Liquidity');

  const formatUSD = (amount) => {
    if (!amount || amount === 0) return '$0';
    if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
    return `$${amount.toFixed(2)}`;
  };

  return (
    <div className="rounded-lg border border-[#2a2a27] bg-[#1a1a17] p-2.5">
      {/* Header: Action type, time, and address */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`text-[8px] font-medium uppercase px-1.5 py-0.5 rounded ${
              isSwap
                ? 'bg-blue-500/20 text-blue-400'
                : isLiquidity
                ? 'bg-purple-500/20 text-purple-400'
                : 'bg-gray-500/20 text-gray-400'
            }`}
          >
            {tx.action || 'Swap'}
          </span>
          <span className="text-[9px] text-gray-500">{formatTimestamp(tx.timestamp)}</span>
        </div>
        {tx.from && (
          <PrincipalTransactionsTooltip principalId={tx.from}>
            <span className="text-[9px] text-gray-500 hover:text-[#f6fdff] transition-colors cursor-pointer">
              {`${tx.from.slice(0, 5)}...${tx.from.slice(-3)}`}
            </span>
          </PrincipalTransactionsTooltip>
        )}
      </div>

      {/* Token exchange visualization */}
      <div className="flex items-center gap-2">
        {/* Sold token */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <ActivityTokenLogo tokenId={soldToken.id} symbol={soldToken.symbol} size={20} />
          <div className="min-w-0">
            <div className="text-[10px] text-red-400 font-mono truncate">
              -{formatTokenAmount(soldToken.amount)}
            </div>
            <div className="text-[8px] text-gray-500 truncate">{soldToken.symbol}</div>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex-shrink-0">
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </div>

        {/* Bought token */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
          <div className="min-w-0 text-right">
            <div className="text-[10px] text-green-400 font-mono truncate">
              +{formatTokenAmount(boughtToken.amount)}
            </div>
            <div className="text-[8px] text-gray-500 truncate">{boughtToken.symbol}</div>
          </div>
          <ActivityTokenLogo tokenId={boughtToken.id} symbol={boughtToken.symbol} size={20} />
        </div>

        {/* USD value */}
        <div className="flex-shrink-0 ml-2">
          <span className="text-[10px] text-[#f6fdff] font-mono tabular-nums">
            {formatUSD(Number(tx.amountUSD || 0))}
          </span>
        </div>
      </div>
    </div>
  );
}

export function TokenCardTabs({ token, tradeMode, onTradeModeChange, layout = 'stacked' }) {
  const { isConnected } = useWallet();
  const [showTxModal, setShowTxModal] = useState(false);
  const [stakeAmount, setStakeAmount] = useState('');
  const [showControllers, setShowControllers] = useState(true);
  const [showStake, setShowStake] = useState(false);
  const tokenId = token?.tokenLedgerId || token?.ledger_id;
  const { logo } = useTokenLogo(tokenId);
  const poolContainerId = `pool-list-${tokenId || 'unknown'}`;
  const poolAnchorId = `pool-anchor-${tokenId || 'unknown'}`;
  const poolText = (token?.poolId || token?.pool_id || token?.pool || '').toString();
  const { totalSupply: fetchedSupply, loading: supplyLoading } = useTokenTotalSupply(tokenId);
  const activeTradeMode = tradeMode === 'sell' ? 'sell' : 'buy';

  // Fetch data
  const { hasRelationships: checkHasRelationships } = useControllerRelationships(
    token.tokenLedgerId,
    token.controllers || []
  );

  const { activity, isLoading: activityLoading } = useTokenTransactions(token.tokenLedgerId, {
    limit: 50,
    refreshInterval: 60000,
  });

  const {
    userStake,
    userStats,
    isLoadingStake,
    stake,
    unstake,
    claimRewards,
    isStaking,
    isUnstaking,
    isClaiming,
  } = useStaking({
    tokenId: token.tokenLedgerId,
    enabled: isConnected,
  });

  // Format numbers
  const fmt = (num) => {
    if (!num || num === 0) return '0';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  const fmtPrice = (price) => {
    if (!price) return '0.000000';
    if (price < 0.000001) return price.toFixed(12);
    if (price < 0.001) return price.toFixed(8);
    if (price < 1) return price.toFixed(6);
    return price.toFixed(4);
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '--';
    try {
      const date = new Date(Number(timestamp) * 1000);
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--';
    }
  };


  if (layout === 'terminal') {
    const handlePoolClick = () => {
      if (typeof document === 'undefined' || !poolContainerId) return;
      const target = document.getElementById(poolAnchorId) || document.getElementById(poolContainerId);
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      target.classList.add('ring-1', 'ring-[#f6fdff]/40');
      setTimeout(() => {
        target.classList.remove('ring-1', 'ring-[#f6fdff]/40');
      }, 1200);
    };

    return (
      <div className="mt-3 sm:mt-4 space-y-3 sm:space-y-4">
        <div className="grid grid-cols-12 gap-3 sm:gap-4">
          <div className="col-span-12 lg:col-span-9">
            <div className="bg-[#232320]/50 rounded-xl p-3 sm:p-4 border border-[#2a2a27]">
              <DynamicTokenChart tokenId={token.ledger_id || token.tokenLedgerId} />
            </div>
          </div>
          <div className="col-span-12 lg:col-span-3">
            <div className="h-full bg-[#1c1c19] border border-[#2a2a27] rounded-lg p-3 sm:p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-[#232320] border border-[#2a2a27] overflow-hidden flex items-center justify-center">
                    {logo ? (
                      <img src={logo} alt={token?.symbol || 'Token'} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-mono text-[#f6fdff]">{token?.symbol?.charAt(0) || 'T'}</span>
                    )}
                  </div>
                  <h3 className="text-xs font-mono text-[#f6fdff] uppercase">Swap</h3>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => onTradeModeChange?.('buy')}
                    className={`px-2 py-0.5 text-[9px] font-mono rounded border ${
                      activeTradeMode === 'buy'
                        ? 'bg-green-500/20 text-green-400 border-green-500/50'
                        : 'bg-[#232320] text-gray-400 border-[#2a2a27]'
                    }`}
                  >
                    BUY
                  </button>
                  <button
                    onClick={() => onTradeModeChange?.('sell')}
                    className={`px-2 py-0.5 text-[9px] font-mono rounded border ${
                      activeTradeMode === 'sell'
                        ? 'bg-red-500/20 text-red-400 border-red-500/50'
                        : 'bg-[#232320] text-gray-400 border-[#2a2a27]'
                    }`}
                  >
                    SELL
                  </button>
                </div>
              </div>

              {poolText && (
                <button
                  type="button"
                  onClick={handlePoolClick}
                  className="mb-3 w-full text-left text-[10px] font-mono text-gray-300 hover:text-[#f6fdff] transition-colors break-all"
                  title="Jump to Liquidity Pools"
                >
                  Pool: {poolText}
                </button>
              )}

              {!isConnected ? (
                <div className="text-center py-2">
                  <p className="text-[10px] font-mono text-gray-500">
                    CONNECT WALLET TO SWAP
                  </p>
                  <div className="mt-2 inline-flex">
                    <ConnectButton size="sm" />
                  </div>
                </div>
              ) : (
                <SwapPanel
                  token={token}
                  mode={activeTradeMode}
                  showHeader={false}
                  variant="inline"
                />
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
          <MetricCell label="Price" value={`$${fmtPrice(token.price)}`} color="text-[#f6fdff]" compact />
          <MetricCell
            label="24H"
            value={`${token.priceChange24h >= 0 ? '+' : ''}${token.priceChange24h?.toFixed(2) || 0}%`}
            color={token.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}
            compact
          />
          <MetricCell label="Volume" value={activity?.formattedVolume || '$0'} color="text-[#f6fdff]" compact />
          <MetricCell label="Liquidity" value={`$${fmt(token.liquidity || 0)}`} color="text-[#f6fdff]" compact />
          <MetricCell
            label="Supply"
            value={
              supplyLoading
                ? '—'
                : fetchedSupply ?? token.totalSupply ?? token.total_supply
                  ? fmt(Number(fetchedSupply ?? token.totalSupply ?? token.total_supply))
                  : '--'
            }
            color="text-[#f6fdff]"
            compact
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
            <TokenHoldersTable tokenId={token.tokenLedgerId} tokenSymbol={token.symbol} />
          </div>
          <div className="bg-[#1c1c19] border border-[#2a2a27] rounded-lg p-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-mono uppercase tracking-wider text-[#f6fdff]">Activity</p>
              <span className="text-[9px] text-gray-500">{activity?.transactions?.length || 0} recent swaps</span>
            </div>
            {activityLoading ? (
              <div className="space-y-3">
                <div className="h-16 bg-[#232320] rounded-lg animate-pulse" />
                <div className="h-16 bg-[#232320] rounded-lg animate-pulse" />
                <div className="h-16 bg-[#232320] rounded-lg animate-pulse" />
              </div>
            ) : activity?.transactions?.length ? (
              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1 custom-scrollbar">
                {activity.transactions.slice(0, 8).map((tx, idx) => (
                  <ActivityTransactionRow
                    key={`${tx.timestamp}-${idx}`}
                    tx={tx}
                    formatTimestamp={formatTimestamp}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-[#232320] flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
                <p className="text-[10px] text-gray-500">No recent transactions</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#1c1c19] border border-[#2a2a27] rounded-lg overflow-hidden">
          <div
            onClick={() => setShowStake(!showStake)}
            className="px-4 py-2.5 border-b border-[#2a2a27] bg-[#161614] cursor-pointer hover:bg-[#1a1a17] transition-colors flex items-center justify-between"
          >
            <h3 className="text-xs font-mono text-[#f6fdff] uppercase flex items-center gap-1">
              Stake
              <img src="/favicon-32x32.png" alt="PRY" className="h-3 w-3" />
            </h3>
            <span className="text-[#f6fdff] text-[10px] font-mono">
              {showStake ? '▼' : '▶'}
            </span>
          </div>

          {showStake && (
            <div className="p-4">
              {isConnected ? (
                <>
                  {userStake && (
                    <div className="mb-2 p-2 bg-[#161614] rounded border border-[#2a2a27]">
                      <div className="flex justify-between text-[9px] font-mono">
                        <span className="text-gray-500">YOUR_STAKE</span>
                        <span className="text-[#f6fdff]">{fmt(Number(userStake.amount) / 1e8)} PRY</span>
                      </div>
                      {userStats && (
                        <div className="flex justify-between text-[9px] font-mono mt-1">
                          <span className="text-gray-500">REWARDS</span>
                          <span className="text-green-400">{fmt(Number(userStats.totalRewards) / 1e8)} PRY</span>
                        </div>
                      )}
                    </div>
                  )}

                  <input
                    type="number"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    placeholder="Amount PRY"
                    className="w-full bg-[#161614] border border-[#2a2a27] text-[#f6fdff] text-xs font-mono px-2 py-1.5 rounded focus:outline-none focus:border-[#f6fdff] mb-2"
                  />

                  <div className="grid grid-cols-2 gap-1">
                    <button
                      onClick={() => stakeAmount && stake(BigInt(parseFloat(stakeAmount) * 1e8))}
                      disabled={!stakeAmount || isStaking}
                      className="px-2 py-1.5 bg-[#f6fdff] hover:bg-[#e7eef0] disabled:bg-[#2a2a27] disabled:text-gray-600 border border-transparent text-[#161614] text-[10px] font-mono rounded transition-all"
                    >
                      {isStaking ? 'STAKING...' : 'STAKE'}
                    </button>
                    <button
                      onClick={() => stakeAmount && unstake(BigInt(parseFloat(stakeAmount) * 1e8))}
                      disabled={!stakeAmount || isUnstaking}
                      className="px-2 py-1.5 bg-[#232320] hover:bg-[#2a2a27] disabled:bg-[#2a2a27] disabled:text-gray-600 border border-[#2a2a27] text-[#f6fdff] text-[10px] font-mono rounded transition-all"
                    >
                      {isUnstaking ? 'UNSTAKING...' : 'UNSTAKE'}
                    </button>
                  </div>

                  {userStats && Number(userStats.totalRewards) > 0 && (
                    <button
                      onClick={() => claimRewards()}
                      disabled={isClaiming}
                      className="w-full mt-1 px-2 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-[#232320] disabled:text-gray-600 border border-green-500/50 text-[#f6fdff] text-[10px] font-mono rounded transition-all"
                    >
                      {isClaiming ? 'CLAIMING...' : 'CLAIM_REWARDS'}
                    </button>
                  )}
                </>
              ) : (
                <div className="text-center py-2">
                  <p className="text-[10px] font-mono text-gray-500">
                    CONNECT WALLET TO STAKE
                  </p>
                  <div className="mt-2 inline-flex">
                    <ConnectButton size="sm" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="bg-[#1c1c19] border border-[#2a2a27] rounded-lg overflow-hidden">
            <div
              onClick={() => setShowControllers(!showControllers)}
              className="px-4 py-2.5 border-b border-[#2a2a27] bg-[#161614] cursor-pointer hover:bg-[#1a1a17] transition-colors flex items-center justify-between"
            >
              <h3 className="text-xs font-mono text-[#f6fdff] uppercase">Controllers Relationship</h3>
              <span className="text-[#f6fdff] text-[10px] font-mono">
                {showControllers ? '▼' : '▶'}
              </span>
            </div>
            {showControllers && (
              <div className="p-3">
                <ControllersSection
                  controllers={token.controllers}
                  checkHasRelationships={checkHasRelationships}
                  token={token}
                />
              </div>
            )}
          </div>

          <div
            id={poolAnchorId}
            className="bg-[#1c1c19] border border-[#2a2a27] rounded-lg overflow-hidden"
          >
            <div className="px-4 py-2.5 border-b border-[#2a2a27] bg-[#161614] flex items-center justify-between">
              <h3 className="text-xs font-mono text-[#f6fdff] uppercase">Liquidity Pools</h3>
              <span className="text-[#f6fdff] text-[10px] font-mono">▼</span>
            </div>
            <div id={poolContainerId} className="p-3 overflow-y-auto" style={{ maxHeight: '220px' }}>
              <LiquidityPools tokenId={token.tokenLedgerId || token.ledger_id} />
            </div>
          </div>
        </div>

        <CommentSection token={token} />
      </div>
    );
  }

  return (
    <div className="mt-3 sm:mt-4">
      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-3 sm:mb-5">
        <MetricCell label="Price" value={`$${fmtPrice(token.price)}`} color="text-[#f6fdff]" compact />
        <MetricCell
          label="24H"
          value={`${token.priceChange24h >= 0 ? '+' : ''}${token.priceChange24h?.toFixed(2) || 0}%`}
          color={token.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}
          compact
        />
        <MetricCell label="Volume" value={activity?.formattedVolume || '$0'} color="text-[#f6fdff]" compact />
        <MetricCell label="Liquidity" value={`$${fmt(token.liquidity || 0)}`} color="text-[#f6fdff]" compact />
      </div>

      {/* MAIN LAYOUT */}
      <div className="grid grid-cols-12 gap-3 sm:gap-5">
        <div className="col-span-12 lg:col-span-10">
          <div className="bg-[#232320]/50 rounded-xl p-3 sm:p-4 border border-[#2a2a27]">
            <DynamicTokenChart
              tokenId={token.ledger_id || token.tokenLedgerId}
              timeRange="all"
              showRangeSelector={false}
            />
          </div>
        </div>
      </div>

      <div className="mt-3 sm:mt-5 flex flex-col gap-3">
        <CommentSection token={token} />

        {/* Activity bar */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (activity?.hasActivity && activity.transactionCount > 0) {
              setShowTxModal(true);
            }
          }}
          className="bg-[#1c1c19] border border-[#2a2a27] rounded-lg px-3 sm:px-4 py-2.5 cursor-pointer hover:border-[#3a3a34] transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-[#f6fdff]">Activity</span>
              {activity?.hasActivity && activity.transactionCount > 0 && (
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
              )}
            </div>
            <span className="text-[10px] font-mono text-gray-400">
              {activity?.transactionCount || 0} TX • View details →
            </span>
          </div>
        </div>

        {/* Token Holders Table */}
        <div className="mt-3">
          <TokenHoldersTable tokenId={token.tokenLedgerId} tokenSymbol={token.symbol} />
        </div>

        {/* Trade Terminal */}
        <div className="bg-[#1c1c19] border border-[#2a2a27] rounded-lg p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-mono text-[#f6fdff] uppercase">Swap</h3>
            <div className="flex gap-1">
              <button
                onClick={() => onTradeModeChange?.('buy')}
                className={`px-2 py-0.5 text-[9px] font-mono rounded border ${
                  activeTradeMode === 'buy'
                    ? 'bg-green-500/20 text-green-400 border-green-500/50'
                    : 'bg-[#232320] text-gray-400 border-[#2a2a27]'
                }`}
              >
                BUY
              </button>
              <button
                onClick={() => onTradeModeChange?.('sell')}
                className={`px-2 py-0.5 text-[9px] font-mono rounded border ${
                  activeTradeMode === 'sell'
                    ? 'bg-red-500/20 text-red-400 border-red-500/50'
                    : 'bg-[#232320] text-gray-400 border-[#2a2a27]'
                }`}
              >
                SELL
              </button>
            </div>
          </div>

          <SwapPanel
            token={token}
            mode={activeTradeMode}
            showHeader={false}
            variant="inline"
          />
        </div>

        {/* Staking Section */}
        <div className="bg-[#1c1c19] border border-[#2a2a27] rounded-lg overflow-hidden">
          <div
            onClick={() => setShowStake(!showStake)}
            className="px-4 py-2.5 border-b border-[#2a2a27] bg-[#161614] cursor-pointer hover:bg-[#1a1a17] transition-colors flex items-center justify-between"
          >
            <h3 className="text-xs font-mono text-[#f6fdff] uppercase flex items-center gap-1">
              Stake
              <img src="/favicon-32x32.png" alt="PRY" className="h-3 w-3" />
            </h3>
            <span className="text-[#f6fdff] text-[10px] font-mono">
              {showStake ? '▼' : '▶'}
            </span>
          </div>

          {showStake && (
            <div className="p-4">
              {isConnected ? (
                <>
                  {userStake && (
                    <div className="mb-2 p-2 bg-[#161614] rounded border border-[#2a2a27]">
                      <div className="flex justify-between text-[9px] font-mono">
                        <span className="text-gray-500">YOUR_STAKE</span>
                        <span className="text-[#f6fdff]">{fmt(Number(userStake.amount) / 1e8)} PRY</span>
                      </div>
                      {userStats && (
                        <div className="flex justify-between text-[9px] font-mono mt-1">
                          <span className="text-gray-500">REWARDS</span>
                          <span className="text-green-400">{fmt(Number(userStats.totalRewards) / 1e8)} PRY</span>
                        </div>
                      )}
                    </div>
                  )}

                  <input
                    type="number"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    placeholder="Amount PRY"
                    className="w-full bg-[#161614] border border-[#2a2a27] text-[#f6fdff] text-xs font-mono px-2 py-1.5 rounded focus:outline-none focus:border-[#f6fdff] mb-2"
                  />

                  <div className="grid grid-cols-2 gap-1">
                    <button
                      onClick={() => stakeAmount && stake(BigInt(parseFloat(stakeAmount) * 1e8))}
                      disabled={!stakeAmount || isStaking}
                      className="px-2 py-1.5 bg-[#f6fdff] hover:bg-[#e7eef0] disabled:bg-[#2a2a27] disabled:text-gray-600 border border-transparent text-[#161614] text-[10px] font-mono rounded transition-all"
                    >
                      {isStaking ? 'STAKING...' : 'STAKE'}
                    </button>
                    <button
                      onClick={() => stakeAmount && unstake(BigInt(parseFloat(stakeAmount) * 1e8))}
                      disabled={!stakeAmount || isUnstaking}
                      className="px-2 py-1.5 bg-[#232320] hover:bg-[#2a2a27] disabled:bg-[#2a2a27] disabled:text-gray-600 border border-[#2a2a27] text-[#f6fdff] text-[10px] font-mono rounded transition-all"
                    >
                      {isUnstaking ? 'UNSTAKING...' : 'UNSTAKE'}
                    </button>
                  </div>

                  {userStats && Number(userStats.totalRewards) > 0 && (
                    <button
                      onClick={() => claimRewards()}
                      disabled={isClaiming}
                      className="w-full mt-1 px-2 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-[#232320] disabled:text-gray-600 border border-green-500/50 text-[#f6fdff] text-[10px] font-mono rounded transition-all"
                    >
                      {isClaiming ? 'CLAIMING...' : 'CLAIM_REWARDS'}
                    </button>
                  )}
                </>
              ) : (
                <div className="text-center py-2">
                  <p className="text-[10px] font-mono text-gray-500">
                    CONNECT WALLET TO STAKE
                  </p>
                  <div className="mt-2 inline-flex">
                    <ConnectButton size="sm" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="bg-[#1c1c19] border border-[#2a2a27] rounded-lg overflow-hidden">
            <div
              onClick={() => setShowControllers(!showControllers)}
              className="px-4 py-2.5 border-b border-[#2a2a27] bg-[#161614] cursor-pointer hover:bg-[#1a1a17] transition-colors flex items-center justify-between"
            >
              <h3 className="text-xs font-mono text-[#f6fdff] uppercase">Controllers Relationship</h3>
              <span className="text-[#f6fdff] text-[10px] font-mono">
                {showControllers ? '▼' : '▶'}
              </span>
            </div>
            {showControllers && (
              <div className="p-3">
                <ControllersSection
                  controllers={token.controllers}
                  checkHasRelationships={checkHasRelationships}
                  token={token}
                />
              </div>
            )}
          </div>

          <div className="bg-[#1c1c19] border border-[#2a2a27] rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[#2a2a27] bg-[#161614] flex items-center justify-between">
              <h3 className="text-xs font-mono text-[#f6fdff] uppercase">Liquidity Pools</h3>
              <span className="text-[#f6fdff] text-[10px] font-mono">▼</span>
            </div>
            <div className="p-3 overflow-y-auto" style={{ maxHeight: '220px' }}>
              <LiquidityPools tokenId={token.tokenLedgerId || token.ledger_id} />
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Modal */}
      <TransactionListModal
        isOpen={showTxModal}
        onClose={() => setShowTxModal(false)}
        token={token}
      />
    </div>
  );
}

// Dense metric cell for top bar
function MetricCell({ label, value, color = 'text-[#f6fdff]', compact = false }) {
  return (
    <div className={`bg-[#1c1c19] border border-[#2a2a27] rounded-lg px-3 py-2 ${compact ? '' : 'text-center'}`}>
      <p className="text-[8px] font-mono text-gray-500 uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-[12px] font-mono font-bold ${color} truncate`}>{value}</p>
    </div>
  );
}

// Controllers section
function ControllersSection({ controllers, checkHasRelationships, token }) {
  if (!controllers || controllers.length === 0) {
    return <p className="text-[10px] font-mono text-gray-600">NO_CONTROLLERS</p>;
  }

  return (
    <div className="space-y-1">
      {controllers.slice(0, 3).map((ctrl, idx) => {
        const hasRels = checkHasRelationships(ctrl);
        return (
          <ControllerPopup key={idx} controller={ctrl} token={token} hasRelationships={hasRels}>
            <div
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded cursor-pointer hover:bg-[#232320] transition-all ${
                hasRels ? 'text-[#f6fdff]' : 'text-gray-500'
              }`}
            >
              {hasRels && <span className="text-[8px]">🔗</span>}
              <p className="text-[9px] font-mono break-all">
                {ctrl}
              </p>
            </div>
          </ControllerPopup>
        );
      })}
      {controllers.length > 3 && (
        <p className="text-[9px] text-gray-600 font-mono">+{controllers.length - 3}_MORE</p>
      )}
    </div>
  );
}

// Info row
function InfoRow({ label, value, mono = false }) {
  return (
    <div className="flex items-center justify-between text-[10px]">
      <span className="text-gray-500 font-mono">{label}:</span>
      <span className={`text-gray-300 ${mono ? 'font-mono' : ''} truncate max-w-[65%]`}>
        {value}
      </span>
    </div>
  );
}

// Liquidity Pools Component
function LiquidityPools({ tokenId }) {
  const [pools, setPools] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copiedPoolId, setCopiedPoolId] = useState(null);

  useEffect(() => {
    if (!tokenId) return;

    let mounted = true;
    setLoading(true);
    const cacheKey = `token_pools_${tokenId}`;
    const cacheTtlMs = 5 * 60 * 1000;

    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.timestamp && Date.now() - parsed.timestamp < cacheTtlMs) {
            setPools(parsed.pools || []);
            setLoading(false);
            return () => {
              mounted = false;
            };
          }
        }
      } catch (error) {
        // Ignore cache failures
      }
    }

    fetch(`/api/pool-balances/${tokenId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        if (data.success) {
          setPools(data.pools || []);
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.setItem(
                cacheKey,
                JSON.stringify({ pools: data.pools || [], timestamp: Date.now() })
              );
            } catch (error) {
              // Ignore cache failures
            }
          }
        } else {
          setPools([]);
        }
      })
      .catch((error) => {
        if (!mounted) return;
        console.error('Pool balances fetch error:', error);
        setPools([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [tokenId]);

  const formatNumber = (num) => {
    if (
      num === undefined ||
      num === null ||
      num === '' ||
      (typeof num === 'object' && !Array.isArray(num))
    ) {
      return '0';
    }

    if (Array.isArray(num)) {
      return '0';
    }

    let value;
    if (typeof num === 'string') {
      value = parseFloat(num);
    } else if (typeof num === 'number') {
      value = num;
    } else if (typeof num === 'bigint') {
      value = Number(num);
    } else {
      value = Number(num);
    }

    if (isNaN(value) || !isFinite(value) || value === 0) {
      return '0';
    }

    if (value >= 1e9) return (value / 1e9).toFixed(2) + 'B';
    if (value >= 1e6) return (value / 1e6).toFixed(2) + 'M';
    if (value >= 1e3) return (value / 1e3).toFixed(2) + 'K';
    return value.toFixed(2);
  };

  const copyToClipboard = async (value) => {
    if (!value) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedPoolId(value);
      setTimeout(() => {
        setCopiedPoolId((current) => (current === value ? null : current));
      }, 1200);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-[#161614] rounded border border-[#2a2a27] p-2 animate-pulse">
            <div className="h-3 bg-[#232320] rounded w-2/3 mb-2" />
            <div className="h-2 bg-[#232320] rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (!pools || pools.length === 0) {
    return (
      <p className="text-[10px] font-mono text-gray-500 text-center py-4">
        NO_POOLS_AVAILABLE
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {pools.map((pool, idx) => {
        if (pool.error) {
          return (
            <div key={pool.poolId || idx} className="bg-[#161614] rounded border border-red-500/20 p-2">
              <p className="text-[9px] font-mono text-red-400">
                ERROR: {pool.poolId ? pool.poolId.slice(0, 8) + '...' : 'Unknown'}
              </p>
            </div>
          );
        }

        const token0Balance = (() => {
          const val = pool.token0?.balance?.formattedBalance;
          const parsed = typeof val === 'string' ? parseFloat(val) : Number(val);
          return isNaN(parsed) ? 0 : parsed;
        })();

        const token1Balance = (() => {
          const val = pool.token1?.balance?.formattedBalance;
          const parsed = typeof val === 'string' ? parseFloat(val) : Number(val);
          return isNaN(parsed) ? 0 : parsed;
        })();

        const tvl = (() => {
          const val = pool.tvlUSD;
          const parsed = typeof val === 'string' ? parseFloat(val) : Number(val);
          return isNaN(parsed) ? 0 : parsed;
        })();

        return (
          <div
            key={pool.poolId}
            className="bg-[#161614] rounded border border-[#2a2a27] p-2 hover:border-[#3a3a34] transition-colors"
          >
            {/* Pool Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <PoolTokenPair token0={pool.token0} token1={pool.token1} />
                <p className="text-[10px] font-mono text-[#f6fdff]">
                  {pool.token0?.symbol || 'TOKEN'}/{pool.token1?.symbol || 'TOKEN'}
                </p>
              </div>
              {tvl > 0 && (
                <p className="text-[9px] font-mono text-gray-500">
                  ${formatNumber(tvl)}
                </p>
              )}
            </div>

            {/* Pool ID */}
            {pool.poolId && (
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={() => copyToClipboard(pool.poolId)}
                  className="group bg-[#232320] hover:bg-[#2a2a27] text-gray-300 hover:text-[#f6fdff] text-xs font-mono px-2 py-0.5 rounded transition-all flex items-center gap-1 truncate max-w-[220px]"
                  title="Copy pool ID"
                >
                  {copiedPoolId === pool.poolId ? 'COPIED' : pool.poolId}
                </button>
              </div>
            )}

            {/* Token Balances */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[8px] text-gray-500 font-mono uppercase mb-0.5">
                  {pool.token0?.symbol || 'TOKEN'}
                </p>
                <div className="flex items-baseline gap-1">
                  <p className="text-[10px] text-gray-300 font-mono">{formatNumber(token0Balance)}</p>
                  {pool.token0?.supplyPercentage > 0 && (
                    <p className="text-[8px] text-[#f6fdff] font-mono">
                      ({pool.token0.supplyPercentage.toFixed(1)}%)
                    </p>
                  )}
                </div>
              </div>
              <div>
                <p className="text-[8px] text-gray-500 font-mono uppercase mb-0.5">
                  {pool.token1?.symbol || 'TOKEN'}
                </p>
                <div className="flex items-baseline gap-1">
                  <p className="text-[10px] text-gray-300 font-mono">{formatNumber(token1Balance)}</p>
                  {pool.token1?.supplyPercentage > 0 && (
                    <p className="text-[8px] text-[#f6fdff] font-mono">
                      ({pool.token1.supplyPercentage.toFixed(1)}%)
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Pool Actions Panel
function PoolActionsPanel({ token }) {
  const tokenId = token.tokenLedgerId || token.ledger_id;
  const { poolId: fetchedPoolId, isLoading: isPoolLoading } = useTokenPool(tokenId);
  const {
    addLimitOrder,
    removeLimitOrder,
    mintPosition,
    increaseLiquidity,
    decreaseLiquidity,
    claimPosition,
    isWorking,
    error,
    clearError,
  } = usePoolActions();

  const [poolId, setPoolId] = useState(token.pool_id || '');
  const [status, setStatus] = useState('');

  const [limitPositionId, setLimitPositionId] = useState('');
  const [tickLimit, setTickLimit] = useState('');

  const [mintFee, setMintFee] = useState('');
  const [mintTickLower, setMintTickLower] = useState('');
  const [mintTickUpper, setMintTickUpper] = useState('');
  const [mintToken0, setMintToken0] = useState('');
  const [mintToken1, setMintToken1] = useState('');
  const [mintAmount0, setMintAmount0] = useState('');
  const [mintAmount1, setMintAmount1] = useState('');

  const [increasePositionId, setIncreasePositionId] = useState('');
  const [increaseAmount0, setIncreaseAmount0] = useState('');
  const [increaseAmount1, setIncreaseAmount1] = useState('');

  const [decreasePositionId, setDecreasePositionId] = useState('');
  const [decreaseLiquidityValue, setDecreaseLiquidityValue] = useState('');

  const [claimPositionId, setClaimPositionId] = useState('');

  useEffect(() => {
    if (!poolId && fetchedPoolId) {
      setPoolId(fetchedPoolId);
    }
  }, [fetchedPoolId, poolId]);

  const parseNat = (value) => {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    return BigInt(trimmed);
  };

  const parseIntValue = (value) => {
    const trimmed = value.trim();
    if (!/^-?\d+$/.test(trimmed)) return null;
    return BigInt(trimmed);
  };

  const ensurePoolId = () => {
    const trimmed = poolId.trim();
    if (!trimmed) throw new Error('Pool ID is required');
    return trimmed;
  };

  const handleLimitOrder = async () => {
    clearError();
    setStatus('');
    const position = parseNat(limitPositionId);
    const tick = parseIntValue(tickLimit);
    if (position === null || tick === null) {
      setStatus('Enter a valid position ID and tick limit.');
      return;
    }
    const ok = await addLimitOrder({
      poolId: ensurePoolId(),
      positionId: position,
      tickLimit: tick,
    });
    setStatus(ok ? 'Limit order created.' : 'Limit order rejected.');
  };

  const handleRemoveLimitOrder = async () => {
    clearError();
    setStatus('');
    const position = parseNat(limitPositionId);
    if (position === null) {
      setStatus('Enter a valid position ID.');
      return;
    }
    const ok = await removeLimitOrder({
      poolId: ensurePoolId(),
      positionId: position,
    });
    setStatus(ok ? 'Limit order removed.' : 'Remove request failed.');
  };

  const handleMintPosition = async () => {
    clearError();
    setStatus('');
    const fee = parseNat(mintFee);
    const tickLower = parseIntValue(mintTickLower);
    const tickUpper = parseIntValue(mintTickUpper);
    const amount0 = parseNat(mintAmount0);
    const amount1 = parseNat(mintAmount1);
    if (
      fee === null ||
      tickLower === null ||
      tickUpper === null ||
      amount0 === null ||
      amount1 === null ||
      !mintToken0.trim() ||
      !mintToken1.trim()
    ) {
      setStatus('Fill all mint fields with valid values.');
      return;
    }
    const positionId = await mintPosition({
      poolId: ensurePoolId(),
      fee,
      tickLower,
      tickUpper,
      token0: mintToken0.trim(),
      token1: mintToken1.trim(),
      amount0Desired: amount0,
      amount1Desired: amount1,
    });
    setStatus(`Position minted. ID: ${positionId.toString()}`);
  };

  const handleIncreaseLiquidity = async () => {
    clearError();
    setStatus('');
    const position = parseNat(increasePositionId);
    const amount0 = parseNat(increaseAmount0);
    const amount1 = parseNat(increaseAmount1);
    if (position === null || amount0 === null || amount1 === null) {
      setStatus('Enter a valid position ID and amounts.');
      return;
    }
    const result = await increaseLiquidity({
      poolId: ensurePoolId(),
      positionId: position,
      amount0Desired: amount0,
      amount1Desired: amount1,
    });
    setStatus(`Liquidity increased. Receipt: ${result.toString()}`);
  };

  const handleDecreaseLiquidity = async () => {
    clearError();
    setStatus('');
    const position = parseNat(decreasePositionId);
    const liquidity = parseNat(decreaseLiquidityValue);
    if (position === null || liquidity === null) {
      setStatus('Enter a valid position ID and liquidity value.');
      return;
    }
    const result = await decreaseLiquidity({
      poolId: ensurePoolId(),
      positionId: position,
      liquidity,
    });
    setStatus(
      `Liquidity decreased. Received ${result.amount0.toString()} / ${result.amount1.toString()}`
    );
  };

  const handleClaim = async () => {
    clearError();
    setStatus('');
    const position = parseNat(claimPositionId);
    if (position === null) {
      setStatus('Enter a valid position ID.');
      return;
    }
    const result = await claimPosition({
      poolId: ensurePoolId(),
      positionId: position,
    });
    setStatus(`Claimed ${result.amount0.toString()} / ${result.amount1.toString()}`);
  };

  return (
    <div className="space-y-2">
      <div className="bg-[#161614] border border-[#2a2a27] rounded p-2">
        <FormField
          label="POOL ID"
          value={poolId}
          onChange={setPoolId}
          placeholder={isPoolLoading ? 'Loading pool...' : 'Pool canister ID'}
        />
        {fetchedPoolId && !poolId && (
          <p className="text-[9px] text-gray-500 font-mono mt-1">
            Auto-detected pool: {fetchedPoolId}
          </p>
        )}
      </div>

      {status && (
        <div className="bg-[#161614] border border-[#2a2a27] rounded p-2 text-[10px] text-gray-300 font-mono">
          {status}
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded p-2 text-[10px] text-red-400 font-mono">
          {error.message}
        </div>
      )}

      <ActionSection title="LIMIT ORDERS">
        <FormField
          label="POSITION ID"
          value={limitPositionId}
          onChange={setLimitPositionId}
          placeholder="e.g. 123"
        />
        <FormField
          label="TICK LIMIT"
          value={tickLimit}
          onChange={setTickLimit}
          placeholder="e.g. 120"
        />
        <div className="grid grid-cols-2 gap-2">
          <ActionButton onClick={handleLimitOrder} disabled={isWorking}>
            {isWorking ? 'WORKING...' : 'ADD'}
          </ActionButton>
          <ActionButton onClick={handleRemoveLimitOrder} disabled={isWorking} variant="ghost">
            {isWorking ? 'WORKING...' : 'REMOVE'}
          </ActionButton>
        </div>
      </ActionSection>

      <ActionSection title="LIQUIDITY">
        <div className="grid grid-cols-2 gap-2">
          <FormField label="FEE" value={mintFee} onChange={setMintFee} placeholder="Pool fee" />
          <FormField label="TICK LOWER" value={mintTickLower} onChange={setMintTickLower} placeholder="-120" />
          <FormField label="TICK UPPER" value={mintTickUpper} onChange={setMintTickUpper} placeholder="120" />
          <FormField label="TOKEN0" value={mintToken0} onChange={setMintToken0} placeholder="token0 principal" />
          <FormField label="TOKEN1" value={mintToken1} onChange={setMintToken1} placeholder="token1 principal" />
          <FormField label="AMOUNT0" value={mintAmount0} onChange={setMintAmount0} placeholder="raw units" />
          <FormField label="AMOUNT1" value={mintAmount1} onChange={setMintAmount1} placeholder="raw units" />
        </div>
        <ActionButton onClick={handleMintPosition} disabled={isWorking}>
          {isWorking ? 'WORKING...' : 'MINT POSITION'}
        </ActionButton>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <FormField
            label="POSITION ID"
            value={increasePositionId}
            onChange={setIncreasePositionId}
            placeholder="position id"
          />
          <FormField label="ADD AMOUNT0" value={increaseAmount0} onChange={setIncreaseAmount0} placeholder="raw units" />
          <FormField label="ADD AMOUNT1" value={increaseAmount1} onChange={setIncreaseAmount1} placeholder="raw units" />
        </div>
        <ActionButton onClick={handleIncreaseLiquidity} disabled={isWorking} variant="ghost">
          {isWorking ? 'WORKING...' : 'INCREASE'}
        </ActionButton>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <FormField
            label="POSITION ID"
            value={decreasePositionId}
            onChange={setDecreasePositionId}
            placeholder="position id"
          />
          <FormField
            label="LIQUIDITY"
            value={decreaseLiquidityValue}
            onChange={setDecreaseLiquidityValue}
            placeholder="raw units"
          />
        </div>
        <ActionButton onClick={handleDecreaseLiquidity} disabled={isWorking} variant="ghost">
          {isWorking ? 'WORKING...' : 'DECREASE'}
        </ActionButton>
      </ActionSection>

      <ActionSection title="CLAIM">
        <FormField
          label="POSITION ID"
          value={claimPositionId}
          onChange={setClaimPositionId}
          placeholder="position id"
        />
        <ActionButton onClick={handleClaim} disabled={isWorking}>
          {isWorking ? 'WORKING...' : 'CLAIM FEES'}
        </ActionButton>
      </ActionSection>
    </div>
  );
}

function ActionSection({ title, children }) {
  return (
    <div className="bg-[#161614] border border-[#2a2a27] rounded p-2 space-y-2">
      <p className="text-[9px] font-mono text-gray-400 tracking-wider">{title}</p>
      {children}
    </div>
  );
}

function FormField({ label, value, onChange, placeholder }) {
  return (
    <label className="block text-[9px] font-mono text-gray-500">
      {label}
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full bg-[#1c1c19] border border-[#2a2a27] text-[10px] font-mono text-[#f6fdff] px-2 py-1 rounded focus:outline-none focus:border-[#f6fdff]"
      />
    </label>
  );
}

function ActionButton({ children, onClick, disabled, variant = 'solid' }) {
  const base =
    'w-full px-2 py-1.5 text-[10px] font-mono rounded transition-all border';
  const styles =
    variant === 'solid'
      ? 'bg-[#f6fdff] text-[#161614] border-transparent hover:bg-[#e7eef0]'
      : 'bg-[#232320] text-[#f6fdff] border-[#2a2a27] hover:border-[#3a3a34]';
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${styles} disabled:opacity-50`}>
      {children}
    </button>
  );
}

// Pool Token Avatar
function PoolTokenAvatar({ ledgerId, symbol, className }) {
  const { logo } = useTokenLogo(ledgerId);
  const fallback = symbol?.charAt(0) || 'T';

  return (
    <div className={`w-4 h-4 rounded-full border border-[#2a2a27] bg-[#232320] overflow-hidden flex items-center justify-center text-[8px] text-[#f6fdff] font-mono ${className}`}>
      {logo ? (
        <img src={logo} alt={symbol || 'Token'} className="w-full h-full object-cover" />
      ) : (
        <span className="leading-none">{fallback}</span>
      )}
    </div>
  );
}

// Pool Token Pair
function PoolTokenPair({ token0, token1 }) {
  return (
    <div className="flex items-center -space-x-1.5">
      <PoolTokenAvatar ledgerId={token0?.ledgerId} symbol={token0?.symbol} className="relative z-10" />
      <PoolTokenAvatar ledgerId={token1?.ledgerId} symbol={token1?.symbol} className="relative z-0" />
    </div>
  );
}
