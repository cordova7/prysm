/**
 * Rosetta API types (simplified for ICP ledger)
 */

export interface NetworkIdentifier {
  blockchain: string;
  network: string;
}

export interface AccountIdentifier {
  address: string;
}

export interface Amount {
  value: string; // Decimal string (e.g., "-100000000")
  currency: {
    symbol: string;
    decimals: number;
  };
}

export interface Operation {
  operation_identifier: {
    index: number;
  };
  type: string;
  status?: string;
  account?: AccountIdentifier;
  amount?: Amount;
}

export interface Transaction {
  transaction_identifier: {
    hash: string;
  };
  operations: Operation[];
  metadata?: Record<string, any>;
}

export interface Block {
  block_identifier: {
    index: number;
    hash: string;
  };
  parent_block_identifier: {
    index: number;
    hash: string;
  };
  timestamp: number;
  transactions: Transaction[];
}

export interface NetworkListResponse {
  network_identifiers: NetworkIdentifier[];
}

export interface NetworkStatusResponse {
  current_block_identifier: {
    index: number;
    hash: string;
  };
  current_block_timestamp: number;
  genesis_block_identifier: {
    index: number;
    hash: string;
  };
}

export interface AccountBalanceResponse {
  block_identifier: {
    index: number;
    hash: string;
  };
  balances: Amount[];
  metadata?: Record<string, any>;
}

export interface SearchTransactionsResponse {
  transactions: Array<{
    block_identifier: {
      index: number;
      hash: string;
    };
    transaction: Transaction;
  }>;
  total_count: number;
  next_offset?: number;
}

export interface BlockResponse {
  block: Block;
}
