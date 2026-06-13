import { IndexerDatabase } from '../supabase/client.js';
import { logger } from '../utils/logger.js';
import { RosettaHttpClient } from './client.js';
import type { Block, Transaction, Operation } from './types.js';
import type { BlockRow, TransactionRow } from '../supabase/types.js';

export interface RosettaBlockIngestionOptions {
  startBlock?: number;
  endBlock?: number;
  bootstrapLookback?: number;
  stateId?: string;
  includeRaw?: boolean;
}

const DEFAULT_BOOTSTRAP_LOOKBACK = 50000;

export async function ingestRosettaBlocks(
  db: IndexerDatabase,
  rosetta: RosettaHttpClient,
  options: RosettaBlockIngestionOptions = {}
): Promise<void> {
  const stateId = options.stateId ?? 'icp_rosetta';
  const includeRaw = options.includeRaw ?? false;

  await rosetta.init();
  const status = await rosetta.networkStatus();
  const tip = status.current_block_identifier.index;
  const state = await db.getIngestionState(stateId);

  let startBlock = options.startBlock;
  if (startBlock === undefined) {
    if (state?.last_ingested_block !== undefined && state?.last_ingested_block !== null) {
      startBlock = state.last_ingested_block + 1;
    } else {
      const lookback = options.bootstrapLookback ?? DEFAULT_BOOTSTRAP_LOOKBACK;
      startBlock = Math.max(0, tip - lookback);
    }
  }

  const endBlock = options.endBlock ?? tip;

  if (endBlock < startBlock) {
    logger.warn(`No new blocks to ingest (start=${startBlock}, end=${endBlock})`);
    return;
  }

  logger.info(`Ingesting blocks ${startBlock}..${endBlock} (tip=${tip})`);

  for (let height = startBlock; height <= endBlock; height += 1) {
    const response = await rosetta.block(height);
    const block = response.block;

    const blockRow = buildBlockRow(block, includeRaw);
    await db.upsertBlocks([blockRow]);

    const txRows = buildTransactionRows(block, includeRaw);
    if (txRows.length > 0) {
      await db.upsertTransactions(txRows);
    }

    await db.setIngestionState({
      id: stateId,
      last_ingested_block: block.block_identifier.index,
    });

    if (height % 100 === 0 || height === endBlock) {
      logger.info(`Ingested block ${height}`);
    }
  }
}

function buildBlockRow(block: Block, includeRaw: boolean): BlockRow {
  const timestampMs = Number(block.timestamp);
  const timestampIso = Number.isFinite(timestampMs)
    ? new Date(timestampMs).toISOString()
    : new Date().toISOString();

  return {
    index: block.block_identifier.index,
    hash: block.block_identifier.hash,
    timestamp: timestampIso,
    parent_index: block.parent_block_identifier?.index,
    parent_hash: block.parent_block_identifier?.hash,
    raw: includeRaw ? block : undefined,
  };
}

function buildTransactionRows(block: Block, includeRaw: boolean): TransactionRow[] {
  const rows: TransactionRow[] = [];

  for (const tx of block.transactions) {
    const ops: Operation[] = tx.operations ?? [];

    const amountOps = ops.filter((op: Operation) => op.amount && op.account?.address);
    const positiveOps = amountOps.filter((op: Operation) => BigInt(op.amount!.value) > 0n);
    const negativeOps = amountOps.filter((op: Operation) => BigInt(op.amount!.value) < 0n);
    const nonFeeNegativeOps = negativeOps.filter(
      (op: Operation) => !op.type || !op.type.toLowerCase().includes('fee')
    );

    const toOp = positiveOps[0];
    const fromOp = nonFeeNegativeOps[0] ?? negativeOps[0];

    if (!toOp?.account || !fromOp?.account || !toOp.amount || !fromOp.amount) {
      continue;
    }

    const amount = BigInt(toOp.amount.value);
    const fee = extractFee(ops);
    const memo = extractMemo(tx);
    const createdAtTime = extractCreatedAtTime(tx);

    rows.push({
      block_index: block.block_identifier.index,
      tx_hash: tx.transaction_identifier.hash,
      type: ops[0]?.type ?? 'transfer',
      from_account: fromOp.account.address,
      to_account: toOp.account.address,
      amount_e8s: amount.toString(),
      fee_e8s: fee ? fee.toString() : undefined,
      memo,
      created_at_time: createdAtTime,
      raw: includeRaw ? tx : undefined,
    });
  }

  return rows;
}

function extractFee(ops: Transaction['operations']): bigint | undefined {
  for (const op of ops) {
    if (!op.amount) continue;
    if (op.type && op.type.toLowerCase().includes('fee')) {
      const value = BigInt(op.amount.value);
      return value < 0n ? -value : value;
    }
  }
  return undefined;
}

function extractMemo(tx: Transaction): string | undefined {
  const memo = tx.metadata?.memo ?? tx.metadata?.memo_hex ?? tx.metadata?.memo_text;
  if (memo === undefined || memo === null) return undefined;
  return String(memo);
}

function extractCreatedAtTime(tx: Transaction): string | undefined {
  const createdAt = tx.metadata?.created_at_time;
  if (createdAt === undefined || createdAt === null) return undefined;
  return String(createdAt);
}
