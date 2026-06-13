import { Actor, HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { logger } from '../utils/logger.js';

interface BaseIndexActor {
  baseStorage: () => Promise<string[]>;
}

interface RecordPage<T> {
  content: T[];
  offset: bigint;
  limit: bigint;
  totalElements: bigint;
}

interface SwapInfoTx {
  from?: string;
  to?: string;
  recipient?: string;
  sender?: string;
  maker?: string;
}

/**
 * SwapInformation BaseIndex/BaseStorage client (on-chain).
 */
export class ICPSwapInfoClient {
  private agent: HttpAgent;
  private baseIndexId: string;

  constructor(agent: HttpAgent, baseIndexId: string) {
    this.agent = agent;
    this.baseIndexId = baseIndexId;
  }

  async listBaseStorages(): Promise<string[]> {
    const idlFactory = ({ IDL }: any) =>
      IDL.Service({
        baseStorage: IDL.Func([], [IDL.Vec(IDL.Text)], ['query']),
      });

    const actor = Actor.createActor<BaseIndexActor>(idlFactory, {
      agent: this.agent,
      canisterId: Principal.fromText(this.baseIndexId),
    });

    try {
      return await actor.baseStorage();
    } catch (error) {
      logger.error(`Failed to fetch baseStorage from ${this.baseIndexId}: ${error}`);
      return [];
    }
  }

  async getPoolTransactions(
    storageCanisterId: string,
    poolId: string,
    offset: number,
    limit: number
  ): Promise<RecordPage<SwapInfoTx>> {
    const idlFactory = ({ IDL }: any) =>
      IDL.Service({
        getByPool: IDL.Func(
          [IDL.Nat, IDL.Nat, IDL.Text],
          [
            IDL.Record({
              content: IDL.Vec(IDL.Record({
                from: IDL.Opt(IDL.Text),
                to: IDL.Opt(IDL.Text),
                recipient: IDL.Opt(IDL.Text),
                sender: IDL.Opt(IDL.Text),
                maker: IDL.Opt(IDL.Text),
              })),
              offset: IDL.Nat,
              limit: IDL.Nat,
              totalElements: IDL.Nat,
            }),
          ],
          ['query']
        ),
      });

    const actor = Actor.createActor<any>(idlFactory, {
      agent: this.agent,
      canisterId: Principal.fromText(storageCanisterId),
    });

    const result = await actor.getByPool(BigInt(offset), BigInt(limit), poolId);
    return result as RecordPage<SwapInfoTx>;
  }
}
