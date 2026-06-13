import { Actor, HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { AccountIdentifier, SubAccount } from '@dfinity/ledger-icp';
import { ILedgerAdapter, NormalizedTxPage, NormalizedTransaction } from './types.js';
import { logger } from '../../utils/logger.js';

/**
 * QueryBlocks Adapter (ICP ledger style)
 */
export class QueryBlocksAdapter implements ILedgerAdapter {
  public readonly apiType = 'query_blocks' as const;
  public readonly canisterId: string;
  private actor: any;

  constructor(agent: HttpAgent, canisterId: string) {
    this.canisterId = canisterId;
    this.actor = this.createActor(agent, canisterId);
  }

  private createActor(agent: HttpAgent, canisterId: string) {
    const idlFactory = ({ IDL }: any) => IDL.Service({
      query_blocks: IDL.Func(
        [
          IDL.Record({
            start: IDL.Nat64,
            length: IDL.Nat64,
          }),
        ],
        [
          IDL.Record({
            chain_length: IDL.Nat64,
            blocks: IDL.Vec(IDL.Unknown),
          }),
        ],
        ['query']
      ),
      account_balance: IDL.Func(
        [IDL.Record({ account: IDL.Vec(IDL.Nat8) })],
        [IDL.Record({ e8s: IDL.Nat64 })],
        ['query']
      ),
    });

    return Actor.createActor(idlFactory, {
      agent,
      canisterId: Principal.fromText(canisterId),
    });
  }

  async getTotalTxCount(): Promise<bigint> {
    try {
      const result = await this.actor.query_blocks({
        start: 0n,
        length: 0n,
      });
      return result.chain_length;
    } catch (error) {
      logger.error(`Failed to get total tx count: ${error}`);
      throw error;
    }
  }

  async getTxPage(start: bigint, length: number): Promise<NormalizedTxPage> {
    try {
      const result = await this.actor.query_blocks({
        start: BigInt(start),
        length: BigInt(length),
      });

      const transactions: NormalizedTransaction[] = result.blocks.map(
        (block: any, idx: number) => this.normalizeBlock(block, start + BigInt(idx))
      );

      return {
        transactions,
        hasMore: start + BigInt(length) < result.chain_length,
      };
    } catch (error) {
      logger.error(`Failed to fetch tx page: ${error}`);
      throw error;
    }
  }

  private normalizeBlock(block: any, index: bigint): NormalizedTransaction {
    const transaction = block.transaction;
    const timestamp = block.timestamp ? BigInt(block.timestamp.timestamp_nanos) : 0n;

    const normalized: NormalizedTransaction = {
      index,
      timestamp,
      kind: 'transfer',
    };

    if (transaction?.operation) {
      const op = transaction.operation;
      if (op.Transfer) {
        normalized.kind = 'transfer';
        normalized.from = { owner: this.accountIdToText(op.Transfer.from) };
        normalized.to = { owner: this.accountIdToText(op.Transfer.to) };
        normalized.amount = op.Transfer.amount ? BigInt(op.Transfer.amount.e8s) : undefined;
        normalized.fee = op.Transfer.fee ? BigInt(op.Transfer.fee.e8s) : undefined;
      } else if (op.Mint) {
        normalized.kind = 'mint';
        normalized.to = { owner: this.accountIdToText(op.Mint.to) };
        normalized.amount = op.Mint.amount ? BigInt(op.Mint.amount.e8s) : undefined;
      } else if (op.Burn) {
        normalized.kind = 'burn';
        normalized.from = { owner: this.accountIdToText(op.Burn.from) };
        normalized.amount = op.Burn.amount ? BigInt(op.Burn.amount.e8s) : undefined;
      }
    }

    return normalized;
  }

  private accountIdToText(accountId: Uint8Array | number[]): string {
    // Simple hex encoding for account IDs
    const bytes = Array.from(accountId);
    return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async balanceOf(owner: Principal, subaccount?: Uint8Array): Promise<bigint> {
    // For ICP ledger, need to convert principal to account identifier
    const accountId = this.principalToAccountId(owner, subaccount);
    const result = await this.actor.account_balance({ account: accountId });
    return BigInt(result.e8s);
  }

  private principalToAccountId(principal: Principal, subaccount?: Uint8Array): Uint8Array {
    const sub = subaccount ? SubAccount.fromBytes(subaccount) : undefined;
    if (sub instanceof Error) {
      throw sub;
    }

    const accountIdentifier = AccountIdentifier.fromPrincipal({
      principal,
      subAccount: sub,
    });
    return accountIdentifier.toUint8Array();
  }

  async totalSupply(): Promise<bigint> {
    // ICP ledger doesn't have a direct total_supply method
    // Would need to sum all accounts or use a known endpoint
    logger.warn('totalSupply not directly available for query_blocks adapter');
    return 0n;
  }

  async decimals(): Promise<number> {
    // ICP has 8 decimals
    return 8;
  }

  async symbol(): Promise<string> {
    return 'ICP';
  }
}
