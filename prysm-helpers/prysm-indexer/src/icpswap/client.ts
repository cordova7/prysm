import { Actor, HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { logger } from '../utils/logger.js';
import { SwapPoolIDL } from './swap-pool.did.js';
import type { PoolInfo, SwapTransaction, SwapInfo } from './types.js';
import { ICP_CANISTER_ID } from './types.js';

/**
 * ICPSwap Client for pool discovery and trading analytics
 */
export class ICPSwapClient {
  private agent: HttpAgent;
  private restApiUrl: string = 'https://api.icpswap.com';

  constructor(agent: HttpAgent) {
    this.agent = agent;
  }

  /**
   * Get all pools from REST API
   */
  async getAllPools(): Promise<PoolInfo[]> {
    logger.info('Fetching all pools from ICPSwap REST API');

    try {
      const response = await fetch(`${this.restApiUrl}/info/pool/all`);

      if (!response.ok) {
        throw new Error(`Failed to fetch pools: ${response.statusText}`);
      }

      const data = await response.json() as any;
      const rawPools = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.content)
        ? data.content
        : [];

      if (!rawPools.length) {
        throw new Error('ICPSwap pool response contained no pools');
      }

      const pools = rawPools.map((pool: any) => this.normalizePool(pool));
      logger.info(`Fetched ${pools.length} pools`);

      return pools;
    } catch (error) {
      logger.error(`Failed to fetch all pools: ${error}`);
      throw error;
    }
  }

  /**
   * Get pools for a specific token
   */
  async getPoolsForToken(tokenCanisterId: string): Promise<PoolInfo[]> {
    const allPools = await this.getAllPools();

    const pools = allPools.filter(
      (pool) => pool.token0Id === tokenCanisterId || pool.token1Id === tokenCanisterId
    );

    logger.info(`Found ${pools.length} pools for token ${tokenCanisterId}`);
    return pools;
  }

  /**
   * Get transactions by owner from a specific pool
   */
  async getTransactionsByOwner(
    poolCanisterId: string,
    ownerPrincipal: Principal
  ): Promise<SwapTransaction[]> {
    logger.debug(
      `Fetching transactions for ${ownerPrincipal.toString()} from pool ${poolCanisterId}`
    );

    try {
      const actor = Actor.createActor(SwapPoolIDL, {
        agent: this.agent,
        canisterId: Principal.fromText(poolCanisterId),
      });

      const transactions: SwapTransaction[] = [];

      while (true) {
        const result: any = await actor.getTransactionsByOwner(
          ownerPrincipal
        );

        if (result.err) {
          logger.error(`SwapPool getTransactionsByOwner error: ${JSON.stringify(result.err)}`);
          return [];
        }

        const entries = result.ok || [];
        const batch: SwapTransaction[] = entries.map((entry: any) => {
          const index = BigInt(entry[0] ?? entry['0']);
          const tx = entry[1] ?? entry['1'];
          const actionInfo = this.extractActionInfo(tx.action);

          return {
            index,
            owner: tx.owner.toString(),
            action: actionInfo.action,
            tokenIn: actionInfo.tokenIn,
            tokenOut: actionInfo.tokenOut,
            amountIn: actionInfo.amountIn,
            amountOut: actionInfo.amountOut,
            timestamp: BigInt(tx.timestamp),
            poolId: tx.canisterId.toString(),
          };
        });

        transactions.push(...batch);

        break;
      }

      logger.debug(`Fetched ${transactions.length} transactions`);
      return transactions;
    } catch (error) {
      logger.error(`Failed to fetch transactions by owner: ${error}`);
      return [];
    }
  }

  /**
   * Extract swap info from transaction
   */
  extractSwapInfo(
    tx: SwapTransaction,
    _poolInfo: PoolInfo
  ): SwapInfo | null {
    if (tx.action !== 'swap') {
      return null;
    }

    if (!tx.amountIn || !tx.amountOut || !tx.tokenIn || !tx.tokenOut) {
      logger.warn(`Swap transaction missing swap info`);
      return null;
    }

    return {
      amountIn: BigInt(tx.amountIn),
      amountOut: BigInt(tx.amountOut),
      tokenIn: tx.tokenIn,
      tokenOut: tx.tokenOut,
      timestamp: tx.timestamp,
    };
  }

  /**
   * Check if token is ICP
   */
  isICP(tokenCanisterId: string): boolean {
    return tokenCanisterId === ICP_CANISTER_ID;
  }

  /**
   * Map action variant to string
   */
  private extractActionInfo(action: any): {
    action: SwapTransaction['action'];
    tokenIn?: string;
    tokenOut?: string;
    amountIn?: string;
    amountOut?: string;
  } {
    const entries = Object.entries(action || {});
    if (entries.length === 0) {
      return { action: 'swap' };
    }

    const [kind, payload] = entries[0] as [string, any];

    if (kind === 'Swap') {
      const tokenIn = payload?.tokenIn?.address?.toString();
      const tokenOut = payload?.tokenOut?.address?.toString();
      return {
        action: 'swap',
        tokenIn,
        tokenOut,
        amountIn: payload?.amountIn?.toString?.() ?? String(payload?.amountIn ?? 0),
        amountOut: payload?.amountOut?.toString?.() ?? String(payload?.amountOut ?? 0),
      };
    }

    if (kind === 'AddLiquidity') return { action: 'addLiquidity' };
    if (kind === 'DecreaseLiquidity' || kind === 'RemoveLimitOrder') {
      return { action: 'removeLiquidity' };
    }
    if (kind === 'Claim') return { action: 'claim' };

    return { action: 'swap' };
  }

  private normalizePool(pool: any): PoolInfo {
    const canisterId = pool.canisterId || pool.poolId || pool.id;
    const token0Id = pool.token0Id || pool.token0LedgerId || pool.asset0Id;
    const token1Id = pool.token1Id || pool.token1LedgerId || pool.asset1Id;
    const fee = Number(pool.fee ?? pool.poolFee ?? pool.feeBps ?? 0);

    return {
      canisterId,
      token0Id,
      token1Id,
      fee,
      tvlUSD: Number(pool.tvlUSD ?? pool.tvlUsd ?? 0),
      volumeUSD: Number(pool.totalVolumeUSD ?? pool.volumeUSD ?? 0),
      volumeUSD1d: Number(pool.volumeUSD24H ?? pool.volumeUSD1d ?? 0),
      volumeUSD7d: Number(pool.volumeUSD7D ?? pool.volumeUSD7d ?? 0),
      token0Symbol: pool.token0Symbol || pool.asset0Symbol || '',
      token1Symbol: pool.token1Symbol || pool.asset1Symbol || '',
      token0Decimals: Number(pool.token0Decimals ?? 0),
      token1Decimals: Number(pool.token1Decimals ?? 0),
      token0Price: Number(pool.token0Price ?? 0),
      token1Price: Number(pool.token1Price ?? 0),
    };
  }
}
