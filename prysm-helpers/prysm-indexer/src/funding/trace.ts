import { Principal } from '@dfinity/principal';
import { RosettaHttpClient } from '../rosetta/client.js';
import { IndexerConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type { WalletFundingEdge } from '../supabase/types.js';

/**
 * Funding trace result
 */
export interface FundingTrace {
  funder: string; // Terminal funder account ID
  isCEX: boolean;
  reason?: string;
  edges: WalletFundingEdge[];
  depth: number;
}

/**
 * Trace wallet funding sources using Rosetta API
 */
export async function traceWalletFunding(
  principal: Principal,
  rosetta: RosettaHttpClient,
  config: IndexerConfig
): Promise<FundingTrace> {
  const accountId = rosetta.principalToAccountId(principal);

  logger.debug(`Tracing funding for ${principal.toString()} (${accountId})`);

  const visited = new Set<string>();
  const edges: WalletFundingEdge[] = [];

  let currentAccountId = accountId;
  let depth = 0;

  while (depth < config.maxTraceDepth) {
    // Check if already visited (loop detection)
    if (visited.has(currentAccountId)) {
      logger.debug(`Loop detected at ${currentAccountId}`);
      break;
    }

    visited.add(currentAccountId);

    // Check CEX heuristics
    const cexCheck = await checkCEXHeuristics(currentAccountId, rosetta, config);
    if (cexCheck.isCEX) {
      return {
        funder: currentAccountId,
        isCEX: true,
        reason: cexCheck.reason,
        edges,
        depth,
      };
    }

    // Get earliest significant inbound ICP transaction
    const inboundTx = await getEarliestInboundTransaction(currentAccountId, rosetta, config);

    if (!inboundTx) {
      // No inbound transaction found, this is the terminal funder
      return {
        funder: currentAccountId,
        isCEX: false,
        edges,
        depth,
      };
    }

    // Add edge
    edges.push({
      wallet_account_id: currentAccountId,
      funder_account_id: inboundTx.from,
      block_index: inboundTx.blockIndex,
      amount_raw: inboundTx.amount,
      tx_hash: inboundTx.hash,
    });

    // Move to funder
    currentAccountId = inboundTx.from;
    depth++;
  }

  // Max depth reached
  return {
    funder: currentAccountId,
    isCEX: false,
    edges,
    depth,
  };
}

/**
 * Check if account matches CEX heuristics
 */
async function checkCEXHeuristics(
  accountId: string,
  rosetta: RosettaHttpClient,
  config: IndexerConfig
): Promise<{ isCEX: boolean; reason?: string }> {
  try {
    // Get account balance
    const balanceResponse = await rosetta.accountBalance(accountId);
    const balance = balanceResponse.balances[0];

    if (!balance) {
      return { isCEX: false };
    }

    // Parse balance (e8s)
    const balanceE8s = BigInt(balance.value);
    const balanceICP = Number(balanceE8s) / 100000000; // Convert e8s to ICP

    // Check balance threshold
    if (balanceICP >= config.cexBalanceThreshold) {
      return {
        isCEX: true,
        reason: `High balance: ${balanceICP.toFixed(2)} ICP (>= ${config.cexBalanceThreshold})`,
      };
    }

    // Could add more heuristics here:
    // - High transaction count from many sources
    // - Known CEX account patterns
    // - etc.

    return { isCEX: false };
  } catch (error: any) {
    if (error?.message?.startsWith('ROSETTA_')) {
      throw error;
    }
    logger.debug(`Failed to check CEX heuristics for ${accountId}: ${error}`);
    return { isCEX: false };
  }
}

/**
 * Get earliest significant inbound ICP transaction
 */
async function getEarliestInboundTransaction(
  accountId: string,
  rosetta: RosettaHttpClient,
  config: IndexerConfig
): Promise<{ from: string; amount: string; blockIndex: number; hash: string } | null> {
  try {
    let earliestInbound: typeof undefined | {
      from: string;
      amount: string;
      blockIndex: number;
      hash: string;
    };

    const status = await rosetta.networkStatus();
    const tip = status.current_block_identifier.index;
    const limit = config.rosettaSearchLimit;
    const maxPagesPerWindow = config.rosettaSearchMaxPages;
    const windowSize = config.rosettaSearchWindowSize;
    const maxWindows = config.rosettaSearchMaxWindows;
    let windowMax = tip;
    let windowsSearched = 0;

    while (windowMax >= 0 && windowsSearched < maxWindows) {
      let offset: number | undefined = 0;
      let pages = 0;

      while (pages < maxPagesPerWindow) {
        const response = await rosetta.searchTransactions(
          accountId,
          limit,
          offset,
          windowMax
        );

        if (response.transactions.length === 0) {
          break;
        }

        const inboundTxs = response.transactions.filter((tx) => {
          const ops = tx.transaction.operations;
          return ops.some((op) => {
            return (
              op.account?.address === accountId &&
              op.amount &&
              BigInt(op.amount.value) > 0n
            );
          });
        });

        if (inboundTxs.length > 0) {
          const candidate = inboundTxs[inboundTxs.length - 1];

          const senderOp = candidate.transaction.operations.find(
            (op) => op.amount && BigInt(op.amount.value) < 0n
          );

          const receiverOp = candidate.transaction.operations.find(
            (op) => op.account?.address === accountId && op.amount && BigInt(op.amount.value) > 0n
          );

          if (senderOp?.account) {
            earliestInbound = {
              from: senderOp.account.address,
              amount: receiverOp?.amount?.value || '0',
              blockIndex: candidate.block_identifier.index,
              hash: candidate.transaction.transaction_identifier.hash,
            };
            return earliestInbound;
          }
        }

        if (response.next_offset === undefined) {
          break;
        }

        offset = response.next_offset;
        pages++;
      }

      if (windowMax === 0) {
        break;
      }

      windowMax = Math.max(0, windowMax - windowSize);
      windowsSearched++;
    }

    return earliestInbound || null;
  } catch (error: any) {
    if (error?.message?.startsWith('ROSETTA_')) {
      throw error;
    }
    logger.debug(`Failed to get inbound transactions for ${accountId}: ${error}`);
    return null;
  }
}
