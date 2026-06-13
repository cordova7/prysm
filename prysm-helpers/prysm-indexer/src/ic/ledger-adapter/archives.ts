import { Actor, HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { ILedgerAdapter, NormalizedTxPage, NormalizedTransaction, ArchiveRange } from './types.js';
import { logger } from '../../utils/logger.js';

/**
 * Archives Adapter (for ledgers using archive canisters)
 */
export class ArchivesAdapter implements ILedgerAdapter {
  public readonly apiType = 'archives' as const;
  public readonly canisterId: string;
  private actor: any;
  private archiveRanges?: ArchiveRange[];
  private agent: HttpAgent;

  constructor(agent: HttpAgent, canisterId: string) {
    this.canisterId = canisterId;
    this.agent = agent;
    this.actor = this.createActor(agent, canisterId);
  }

  private createActor(agent: HttpAgent, canisterId: string) {
    const idlFactory = ({ IDL }: any) => IDL.Service({
      archives: IDL.Func(
        [],
        [
          IDL.Vec(
            IDL.Record({
              canister_id: IDL.Principal,
              start: IDL.Nat,
              end: IDL.Nat,
            })
          ),
        ],
        ['query']
      ),
      balance_of: IDL.Func([IDL.Principal], [IDL.Nat], ['query']),
      total_supply: IDL.Func([], [IDL.Nat], ['query']),
      decimals: IDL.Func([], [IDL.Nat8], ['query']),
      symbol: IDL.Func([], [IDL.Text], ['query']),
    });

    return Actor.createActor(idlFactory, {
      agent,
      canisterId: Principal.fromText(canisterId),
    });
  }

  async getArchives(): Promise<ArchiveRange[]> {
    if (this.archiveRanges && this.archiveRanges.length > 0) {
      return this.archiveRanges;
    }

    try {
      const archives = await this.actor.archives();
      this.archiveRanges = archives.map((archive: any) => ({
        canisterId: archive.canister_id.toString(),
        start: BigInt(archive.start),
        end: BigInt(archive.end),
      }));
      return this.archiveRanges || [];
    } catch (error) {
      logger.error(`Failed to get archives: ${error}`);
      throw error;
    }
  }

  async getTotalTxCount(): Promise<bigint> {
    const archives = await this.getArchives();
    if (archives.length === 0) return 0n;

    // Total count is the max end value
    const maxEnd = archives.reduce((max, archive) => {
      return archive.end > max ? archive.end : max;
    }, 0n);

    return maxEnd + 1n;
  }

  async getTxPage(start: bigint, length: number): Promise<NormalizedTxPage> {
    try {
      const archives = await this.getArchives();

      const targetEndExclusive = start + BigInt(length);
      const targetEndInclusive = targetEndExclusive - 1n;
      const relevantArchives = archives.filter(
        (archive) => archive.start <= targetEndInclusive && archive.end >= start
      );

      if (relevantArchives.length === 0) {
        return { transactions: [], hasMore: false };
      }

      const transactions: NormalizedTransaction[] = [];

      for (const archive of relevantArchives) {
        const overlapStart = start > archive.start ? start : archive.start;
        const overlapEndExclusive = targetEndExclusive < archive.end + 1n
          ? targetEndExclusive
          : archive.end + 1n;
        const overlapLength = overlapEndExclusive - overlapStart;

        if (overlapLength <= 0n) {
          continue;
        }

        const archiveActor = this.createArchiveActor(archive.canisterId);
        const result = await archiveActor.get_transactions({
          start: BigInt(overlapStart - archive.start),
          length: BigInt(overlapLength),
        });

        const batch: NormalizedTransaction[] = result.transactions.map(
          (tx: any, idx: number) => this.normalizeTransaction(tx, overlapStart + BigInt(idx))
        );

        transactions.push(...batch);
      }

      return {
        transactions,
        hasMore: targetEndInclusive < archives[archives.length - 1].end,
      };
    } catch (error) {
      logger.error(`Failed to fetch tx page from archives: ${error}`);
      throw error;
    }
  }

  private createArchiveActor(_archiveCanisterId: string): any {
    const idlFactory = ({ IDL }: any) => IDL.Service({
      get_transactions: IDL.Func(
        [
          IDL.Record({
            start: IDL.Nat,
            length: IDL.Nat,
          }),
        ],
        [
          IDL.Record({
            transactions: IDL.Vec(IDL.Unknown),
          }),
        ],
        ['query']
      ),
    });

    return Actor.createActor(idlFactory, {
      agent: this.agent,
      canisterId: Principal.fromText(_archiveCanisterId),
    });
  }

  private normalizeTransaction(tx: any, index: bigint): NormalizedTransaction {
    // Simplified normalization
    return {
      index,
      timestamp: tx.timestamp ? BigInt(tx.timestamp) : 0n,
      kind: 'transfer',
      from: tx.from ? { owner: tx.from.toString() } : undefined,
      to: tx.to ? { owner: tx.to.toString() } : undefined,
      amount: tx.amount ? BigInt(tx.amount) : undefined,
    };
  }

  async balanceOf(owner: Principal): Promise<bigint> {
    return await this.actor.balance_of(owner);
  }

  async totalSupply(): Promise<bigint> {
    return await this.actor.total_supply();
  }

  async decimals(): Promise<number> {
    const result = await this.actor.decimals();
    return Number(result);
  }

  async symbol(): Promise<string> {
    return await this.actor.symbol();
  }
}
