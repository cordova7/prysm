import { Actor, HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { ILedgerAdapter, NormalizedTxPage } from './types.js';

/**
 * Balance-only adapter for ledgers without tx history APIs.
 */
export class BalanceOnlyAdapter implements ILedgerAdapter {
  public readonly apiType = 'balance-only' as const;
  public readonly canisterId: string;
  private actor: any;

  constructor(agent: HttpAgent, canisterId: string) {
    this.canisterId = canisterId;
    this.actor = this.createActor(agent, canisterId);
  }

  private createActor(agent: HttpAgent, canisterId: string) {
    const idlFactory = ({ IDL }: any) =>
      IDL.Service({
        icrc1_total_supply: IDL.Func([], [IDL.Nat], ['query']),
        icrc1_balance_of: IDL.Func(
          [
            IDL.Record({
              owner: IDL.Principal,
              subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)),
            }),
          ],
          [IDL.Nat],
          ['query']
        ),
        icrc1_decimals: IDL.Func([], [IDL.Nat8], ['query']),
        icrc1_symbol: IDL.Func([], [IDL.Text], ['query']),
      });

    return Actor.createActor(idlFactory, {
      agent,
      canisterId: Principal.fromText(canisterId),
    });
  }

  async getTotalTxCount(): Promise<bigint> {
    throw new Error('Balance-only adapter does not support tx history');
  }

  async getTxPage(_start: bigint, _length: number): Promise<NormalizedTxPage> {
    throw new Error('Balance-only adapter does not support tx history');
  }

  async balanceOf(owner: Principal, subaccount?: Uint8Array): Promise<bigint> {
    const result = await this.actor.icrc1_balance_of({
      owner,
      subaccount: subaccount ? [subaccount] : [],
    });
    return result;
  }

  async totalSupply(): Promise<bigint> {
    return await this.actor.icrc1_total_supply();
  }

  async decimals(): Promise<number> {
    const result = await this.actor.icrc1_decimals();
    return Number(result);
  }

  async symbol(): Promise<string> {
    return await this.actor.icrc1_symbol();
  }
}
