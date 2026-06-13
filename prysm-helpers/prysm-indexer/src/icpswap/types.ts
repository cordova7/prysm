/**
 * ICPSwap API types
 */

export interface PoolInfo {
  canisterId: string;
  token0Id: string;
  token1Id: string;
  fee: number;
  tvlUSD: number;
  volumeUSD: number;
  volumeUSD1d: number;
  volumeUSD7d: number;
  token0Symbol: string;
  token1Symbol: string;
  token0Decimals: number;
  token1Decimals: number;
  token0Price: number;
  token1Price: number;
}

export interface PoolsResponse {
  content: PoolInfo[];
  totalElements: number;
}

export interface SwapTransaction {
  index: bigint;
  owner: string;
  action: 'swap' | 'addLiquidity' | 'removeLiquidity' | 'claim';
  tokenIn?: string;
  tokenOut?: string;
  amountIn?: string;
  amountOut?: string;
  timestamp: bigint;
  poolId: string;
}

export interface SwapInfo {
  amountIn: bigint;
  amountOut: bigint;
  tokenIn: string;
  tokenOut: string;
  timestamp: bigint;
}

export const ICP_CANISTER_ID = 'ryjl3-tyaaa-aaaaa-aaaba-cai';
