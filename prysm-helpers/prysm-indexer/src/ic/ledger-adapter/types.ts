import { Principal } from '@dfinity/principal';

/**
 * Normalized transaction structure (across all ledger types)
 */
export interface NormalizedTransaction {
  index: bigint;
  timestamp: bigint; // nanoseconds
  kind: 'mint' | 'transfer' | 'burn' | 'approve';
  from?: Account;
  to?: Account;
  amount?: bigint;
  fee?: bigint;
}

/**
 * Account structure (principal + optional subaccount)
 */
export interface Account {
  owner: string; // Principal as text
  subaccount?: Uint8Array;
}

/**
 * Normalized transaction page result
 */
export interface NormalizedTxPage {
  transactions: NormalizedTransaction[];
  hasMore: boolean;
}

/**
 * Archive range info
 */
export interface ArchiveRange {
  canisterId: string;
  start: bigint;
  end: bigint;
}

/**
 * Ledger adapter interface (all adapters must implement this)
 */
export interface ILedgerAdapter {
  apiType: 'icrc3' | 'get_transactions' | 'query_blocks' | 'archives' | 'index-ng' | 'balance-only';
  canisterId: string;

  /**
   * Get total transaction count
   */
  getTotalTxCount(): Promise<bigint>;

  /**
   * Get a page of transactions starting from `start` with max `length`
   */
  getTxPage(start: bigint, length: number): Promise<NormalizedTxPage>;

  /**
   * Get archive canister ranges (if applicable)
   */
  getArchives?(): Promise<ArchiveRange[]>;

  /**
   * Get balance for an account
   */
  balanceOf(owner: Principal, subaccount?: Uint8Array): Promise<bigint>;

  /**
   * Get total supply
   */
  totalSupply(): Promise<bigint>;

  /**
   * Get token decimals
   */
  decimals(): Promise<number>;

  /**
   * Get token symbol
   */
  symbol(): Promise<string>;
}
