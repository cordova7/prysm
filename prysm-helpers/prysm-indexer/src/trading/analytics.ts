import { Principal } from '@dfinity/principal';
import { ICPSwapClient } from '../icpswap/client.js';
import { IndexerDatabase } from '../supabase/client.js';
import { IndexerConfig } from '../config/index.js';
import { Semaphore } from '../utils/semaphore.js';
import { logger } from '../utils/logger.js';
import type { HolderTradingAnalytics } from '../supabase/types.js';

/**
 * Analytics aggregation by time window
 */
interface WindowAnalytics {
  icp_in: bigint;
  icp_out: bigint;
  token_in: bigint;
  token_out: bigint;
}

/**
 * Individual trade record for PnL calculation
 */
interface Trade {
  timestamp: number;
  isBuy: boolean;
  icpAmount: bigint;
  tokenAmount: bigint;
  pricePerToken: number; // ICP per token (as a number for easier math)
}

/**
 * Compute trading analytics for holders
 */
export async function computeTradingAnalytics(
  tokenCanisterId: string,
  holders: Set<string>,
  icpswap: ICPSwapClient,
  db: IndexerDatabase,
  config: IndexerConfig
): Promise<void> {
  logger.info(`Computing trading analytics for ${holders.size} holders`);

  // 1. Get current token price from database (for unrealized PnL calculation)
  const tokenData = await db.getToken(tokenCanisterId);
  const currentPrice = tokenData?.price || 0;

  logger.info(`Token ${tokenCanisterId} price: ${currentPrice} ICP`);

  if (currentPrice === 0) {
    logger.warn(`No price data for token ${tokenCanisterId}, unrealized PnL will be 0`);
  }

  // 2. Get current holder balances (for unrealized PnL calculation)
  const holderBalances = await db.getTopHolders(tokenCanisterId, 1000);
  const balanceMap = new Map<string, bigint>();
  for (const holder of holderBalances) {
    balanceMap.set(holder.owner_principal, BigInt(holder.balance_raw));
  }

  // 3. Get pools for this token
  const dbPools = await db.getPoolsForToken(tokenCanisterId);
  const pools = dbPools.map((pool) => ({
    canisterId: pool.pool_canister_id,
    token0Id: pool.token0_canister_id,
    token1Id: pool.token1_canister_id,
    fee: pool.pool_fee || 0,
    tvlUSD: Number(pool.tvl_usd || 0),
    volumeUSD: 0,
    volumeUSD1d: Number(pool.volume_24h_usd || 0),
    volumeUSD7d: 0,
    token0Symbol: '',
    token1Symbol: '',
    token0Decimals: 0,
    token1Decimals: 0,
    token0Price: 0,
    token1Price: 0,
  }));

  if (pools.length === 0) {
    logger.warn(`No ICPSwap pools found for token ${tokenCanisterId}`);
    return;
  }

  logger.info(`Found ${pools.length} pools for ${tokenCanisterId}`);

  // 4. Compute time windows
  const now = Date.now();
  const window24h = now - 24 * 60 * 60 * 1000;
  const window7d = now - 7 * 24 * 60 * 60 * 1000;

  // 5. Process each holder with concurrency control
  const semaphore = new Semaphore(config.maxConcurrencyCanister);
  const analytics: HolderTradingAnalytics[] = [];

  let processed = 0;
  const holderArray = Array.from(holders);

  const analyticsPromises = holderArray.map((principalText) =>
    semaphore.execute(async () => {
      try {
        const principal = Principal.fromText(principalText);

        // Initialize analytics for each window
        const windows = {
          '24h': initWindowAnalytics(),
          '7d': initWindowAnalytics(),
          lifetime: initWindowAnalytics(),
        };

        // Collect all trades for PnL calculation (lifetime only)
        const trades: Trade[] = [];

        // Process each pool
        for (const pool of pools) {
          const transactions = await icpswap.getTransactionsByOwner(
            pool.canisterId,
            principal
          );

          // Process each transaction
          for (const tx of transactions) {
            const swapInfo = icpswap.extractSwapInfo(tx, pool);

            if (!swapInfo) {
              continue; // Not a swap transaction
            }

            // Determine if token0 or token1 is ICP
            const isToken0ICP = icpswap.isICP(pool.token0Id);
            const isToken1ICP = icpswap.isICP(pool.token1Id);

            // Compute ICP and token amounts
            let icpIn = 0n;
            let icpOut = 0n;
            let tokenIn = 0n;
            let tokenOut = 0n;
            let isBuy = false;
            let icpAmount = 0n;
            let tokenAmount = 0n;

            if (isToken0ICP && swapInfo.tokenIn === pool.token0Id) {
              // Swapping ICP (token0) for target token (token1) - BUY
              icpIn = swapInfo.amountIn;
              tokenOut = swapInfo.amountOut;
              isBuy = true;
              icpAmount = icpIn;
              tokenAmount = tokenOut;
            } else if (isToken0ICP && swapInfo.tokenOut === pool.token0Id) {
              // Swapping target token (token1) for ICP (token0) - SELL
              tokenIn = swapInfo.amountIn;
              icpOut = swapInfo.amountOut;
              isBuy = false;
              icpAmount = icpOut;
              tokenAmount = tokenIn;
            } else if (isToken1ICP && swapInfo.tokenIn === pool.token1Id) {
              // Swapping ICP (token1) for target token (token0) - BUY
              icpIn = swapInfo.amountIn;
              tokenOut = swapInfo.amountOut;
              isBuy = true;
              icpAmount = icpIn;
              tokenAmount = tokenOut;
            } else if (isToken1ICP && swapInfo.tokenOut === pool.token1Id) {
              // Swapping target token (token0) for ICP (token1) - SELL
              tokenIn = swapInfo.amountIn;
              icpOut = swapInfo.amountOut;
              isBuy = false;
              icpAmount = icpOut;
              tokenAmount = tokenIn;
            }

            // Determine which windows this transaction belongs to
            const txTimestamp = Number(swapInfo.timestamp) / 1000000; // Convert nanoseconds to milliseconds

            // Lifetime window (all transactions)
            windows.lifetime.icp_in += icpIn;
            windows.lifetime.icp_out += icpOut;
            windows.lifetime.token_in += tokenIn;
            windows.lifetime.token_out += tokenOut;

            // 24h window
            if (txTimestamp >= window24h) {
              windows['24h'].icp_in += icpIn;
              windows['24h'].icp_out += icpOut;
              windows['24h'].token_in += tokenIn;
              windows['24h'].token_out += tokenOut;
            }

            // 7d window
            if (txTimestamp >= window7d) {
              windows['7d'].icp_in += icpIn;
              windows['7d'].icp_out += icpOut;
              windows['7d'].token_in += tokenIn;
              windows['7d'].token_out += tokenOut;
            }

            // Add to trades for PnL calculation (if we have meaningful amounts)
            if (tokenAmount > 0n && icpAmount > 0n) {
              const pricePerToken = Number(icpAmount) / Number(tokenAmount);
              trades.push({
                timestamp: txTimestamp,
                isBuy,
                icpAmount,
                tokenAmount,
                pricePerToken,
              });
            }
          }
        }

        // Calculate PnL for lifetime window only
        const currentBalance = balanceMap.get(principalText) || 0n;
        const pnlData = calculatePnL(trades, currentBalance, currentPrice);

        // Debug logging for PnL calculation
        if (trades.length > 0) {
          logger.debug(`${principalText}: ${trades.length} trades, balance=${currentBalance}, price=${currentPrice}, unrealizedPnL=${pnlData.unrealizedPnL}`);
        }

        // Create analytics records for each window
        for (const [window, data] of Object.entries(windows)) {
          const netIcp = data.icp_in - data.icp_out;
          const netToken = data.token_in - data.token_out;

          // Only add PnL fields for lifetime window
          const isPnLWindow = window === 'lifetime';

          analytics.push({
            token_canister_id: tokenCanisterId,
            owner_principal: principalText,
            time_window: window as '24h' | '7d' | 'lifetime',
            icp_in_raw: data.icp_in.toString(),
            icp_out_raw: data.icp_out.toString(),
            token_in_raw: data.token_in.toString(),
            token_out_raw: data.token_out.toString(),
            net_icp_raw: netIcp.toString(),
            net_token_raw: netToken.toString(),
            pnl_proxy_icp_raw: netIcp.toString(), // Keep old field for backward compatibility
            cost_basis_icp_raw: isPnLWindow ? pnlData.costBasis.toString() : '0',
            avg_entry_price: isPnLWindow ? pnlData.avgEntryPrice.toString() : '0',
            realized_pnl_icp_raw: isPnLWindow ? pnlData.realizedPnL.toString() : '0',
            unrealized_pnl_icp_raw: isPnLWindow ? pnlData.unrealizedPnL.toString() : '0',
            confidence: 'high', // Using exact trader principals
          });
        }

        processed++;
        if (processed % 10 === 0) {
          logger.progress('Computing analytics', processed, holderArray.length);
        }
      } catch (error) {
        logger.error(`Failed to compute analytics for ${principalText}: ${error}`);
      }
    })
  );

  await Promise.all(analyticsPromises);

  // 4. Batch upsert analytics
  logger.info(`Upserting ${analytics.length} analytics records`);
  await db.upsertTradingAnalytics(analytics);

  logger.info(`Trading analytics complete`);
}

/**
 * Initialize window analytics
 */
function initWindowAnalytics(): WindowAnalytics {
  return {
    icp_in: 0n,
    icp_out: 0n,
    token_in: 0n,
    token_out: 0n,
  };
}

/**
 * Calculate PnL from trade history using weighted average cost basis
 */
function calculatePnL(
  trades: Trade[],
  currentBalance: bigint,
  currentPrice: number
): {
  costBasis: bigint;
  avgEntryPrice: number;
  realizedPnL: bigint;
  unrealizedPnL: bigint;
} {
  // Sort trades by timestamp (oldest first)
  const sortedTrades = [...trades].sort((a, b) => a.timestamp - b.timestamp);

  let tokenBalance = 0n;
  let totalCostBasis = 0n; // Total ICP spent on currently held tokens
  let realizedPnL = 0n; // PnL from closed positions

  for (const trade of sortedTrades) {
    if (trade.isBuy) {
      // Buying: Add to position
      tokenBalance += trade.tokenAmount;
      totalCostBasis += trade.icpAmount;
    } else {
      // Selling: Reduce position using weighted average cost
      if (tokenBalance > 0n) {
        // Calculate avg cost per token of current holdings
        const avgCostPerToken = Number(totalCostBasis) / Number(tokenBalance);

        // Cost basis of tokens being sold
        const soldCostBasis = BigInt(Math.floor(avgCostPerToken * Number(trade.tokenAmount)));

        // Realized PnL = ICP received - cost basis of sold tokens
        realizedPnL += trade.icpAmount - soldCostBasis;

        // Reduce position
        tokenBalance -= trade.tokenAmount;
        totalCostBasis -= soldCostBasis;

        // Handle edge cases
        if (tokenBalance <= 0n) {
          tokenBalance = 0n;
          totalCostBasis = 0n;
        }
      }
    }
  }

  // Calculate average entry price for remaining holdings
  const avgEntryPrice = tokenBalance > 0n
    ? Number(totalCostBasis) / Number(tokenBalance)
    : 0;

  // Calculate unrealized PnL on current holdings
  // unrealizedPnL = (currentBalance * currentPrice) - totalCostBasis
  const currentValue = BigInt(Math.floor(Number(currentBalance) * currentPrice));
  const unrealizedPnL = currentValue - totalCostBasis;

  return {
    costBasis: totalCostBasis,
    avgEntryPrice,
    realizedPnL,
    unrealizedPnL,
  };
}
