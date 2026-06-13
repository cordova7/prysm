import { Actor, HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { ILedgerAdapter, NormalizedTxPage, NormalizedTransaction, Account } from './types.js';
import { logger } from '../../utils/logger.js';

/**
 * ICRC-3 Adapter (most modern standard)
 */
export class ICRC3Adapter implements ILedgerAdapter {
  public readonly apiType = 'icrc3' as const;
  public readonly canisterId: string;
  private actor: any;

  constructor(agent: HttpAgent, canisterId: string) {
    this.canisterId = canisterId;
    this.actor = this.createActor(agent, canisterId);
  }

  private createActor(agent: HttpAgent, canisterId: string) {
    const idlFactory = ({ IDL }: any) => IDL.Service({
      icrc3_get_transactions: IDL.Func(
        [
          IDL.Record({
            start: IDL.Nat,
            length: IDL.Nat,
          }),
        ],
        [
          IDL.Record({
            log_length: IDL.Nat,
            transactions: IDL.Vec(
              IDL.Record({
                transaction: IDL.Opt(IDL.Vec(IDL.Tuple(IDL.Text, IDL.Unknown))),
                tx: IDL.Opt(IDL.Vec(IDL.Tuple(IDL.Text, IDL.Unknown))),
                id: IDL.Opt(IDL.Nat),
              })
            ),
          }),
        ],
        ['query']
      ),
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
    try {
      const result = await this.actor.icrc3_get_transactions({
        start: 0n,
        length: 0n,
      });
      return result.log_length;
    } catch (error) {
      logger.error(`Failed to get total tx count: ${error}`);
      throw error;
    }
  }

  async getTxPage(start: bigint, length: number): Promise<NormalizedTxPage> {
    try {
      const result = await this.actor.icrc3_get_transactions({
        start: BigInt(start),
        length: BigInt(length),
      });

      const transactions: NormalizedTransaction[] = result.transactions.map(
        (tx: any, idx: number) => this.normalizeTransaction(tx, start + BigInt(idx))
      );

      return {
        transactions,
        hasMore: start + BigInt(length) < result.log_length,
      };
    } catch (error) {
      logger.error(`Failed to fetch tx page: ${error}`);
      throw error;
    }
  }

  private normalizeTransaction(tx: any, index: bigint): NormalizedTransaction {
    const tupleData = this.unwrapOpt(tx.transaction) || this.unwrapOpt(tx.tx) || tx.transaction || tx.tx;
    if (!tupleData) {
      throw new Error('ICRC3 transaction missing tx data');
    }

    const txData = this.toMap(tupleData);

    const timestampValue =
      this.getMapValue(txData, 'ts') ||
      this.getMapValue(txData, 'timestamp') ||
      this.getMapValue(this.toMap(this.getMapValue(txData, 'tx')), 'ts');
    const timestamp = timestampValue ? BigInt(timestampValue as any) : 0n;
    const kind = this.detectTxKind(txData);

    const normalized: NormalizedTransaction = {
      index,
      timestamp,
      kind,
    };

    const txMap = this.toMap(this.getMapValue(txData, 'tx'));
    const transferMap = this.toMap(this.getMapValue(txData, 'transfer'));
    const mintMap = this.toMap(this.getMapValue(txData, 'mint'));
    const burnMap = this.toMap(this.getMapValue(txData, 'burn'));
    const approveMap = this.toMap(this.getMapValue(txData, 'approve'));

    // Extract from/to based on kind
    if (kind === 'transfer') {
      const transfer = transferMap.size > 0 ? transferMap : txMap;
      const fromValue = this.getMapValue(transfer, 'from') || this.getMapValue(transfer, 'sender');
      const toValue = this.getMapValue(transfer, 'to') || this.getMapValue(transfer, 'recipient');
      const amountValue =
        this.getMapValue(transfer, 'amount') ||
        this.getMapValue(transfer, 'amt') ||
        this.getMapValue(transfer, 'value');
      const feeValue = this.getMapValue(transfer, 'fee');

      normalized.from = this.extractAccount(fromValue);
      normalized.to = this.extractAccount(toValue);
      if (amountValue !== undefined) {
        normalized.amount = BigInt(amountValue as any);
      }
      if (feeValue !== undefined) {
        normalized.fee = BigInt(feeValue as any);
      }
    } else if (kind === 'mint') {
      const mint = mintMap.size > 0 ? mintMap : txMap;
      const toValue = this.getMapValue(mint, 'to') || this.getMapValue(mint, 'recipient');
      const amountValue =
        this.getMapValue(mint, 'amount') || this.getMapValue(mint, 'amt');
      normalized.to = this.extractAccount(toValue);
      if (amountValue !== undefined) {
        normalized.amount = BigInt(amountValue as any);
      }
    } else if (kind === 'burn') {
      const burn = burnMap.size > 0 ? burnMap : txMap;
      const fromValue = this.getMapValue(burn, 'from') || this.getMapValue(burn, 'sender');
      const amountValue =
        this.getMapValue(burn, 'amount') || this.getMapValue(burn, 'amt');
      normalized.from = this.extractAccount(fromValue);
      if (amountValue !== undefined) {
        normalized.amount = BigInt(amountValue as any);
      }
    } else if (kind === 'approve') {
      const approve = approveMap.size > 0 ? approveMap : txMap;
      const fromValue = this.getMapValue(approve, 'from') || this.getMapValue(approve, 'sender');
      const toValue =
        this.getMapValue(approve, 'spender') || this.getMapValue(approve, 'to');
      normalized.from = this.extractAccount(fromValue);
      normalized.to = this.extractAccount(toValue);
    }

    return normalized;
  }

  private detectTxKind(txData: Map<string, any>): NormalizedTransaction['kind'] {
    if (txData.has('mint')) return 'mint';
    if (txData.has('burn')) return 'burn';
    if (txData.has('approve')) return 'approve';
    const txMap = this.toMap(this.getMapValue(txData, 'tx'));
    const op = this.getMapValue(txMap, 'op');
    if (typeof op === 'string') {
      const lower = op.toLowerCase();
      if (lower.includes('mint')) return 'mint';
      if (lower.includes('burn')) return 'burn';
      if (lower.includes('approve')) return 'approve';
    }
    return 'transfer';
  }

  private extractAccount(account: any): Account | undefined {
    if (!account) return undefined;
    const value = this.unwrapOpt(account);
    const map = this.toMap(value);
    const ownerValue =
      this.getMapValue(map, 'owner') ||
      this.getMapValue(map, 'address') ||
      this.getMapValue(map, 'principal') ||
      value;
    const subaccountValue = this.getMapValue(map, 'subaccount');
    return {
      owner: ownerValue?.toString?.() ?? String(ownerValue),
      subaccount: Array.isArray(subaccountValue) ? subaccountValue[0] : subaccountValue,
    };
  }

  private toMap(value: any): Map<string, any> {
    if (!value) return new Map();
    if (value instanceof Map) return value;
    if (Array.isArray(value) && value.length > 0 && Array.isArray(value[0])) {
      return new Map<string, any>(value as Array<[string, any]>);
    }
    if (typeof value === 'object') {
      return new Map<string, any>(Object.entries(value));
    }
    return new Map();
  }

  private getMapValue(map: Map<string, any>, key: string): any {
    if (!map || map.size === 0) return undefined;
    if (map.has(key)) return this.unwrapOpt(map.get(key));
    return undefined;
  }

  private unwrapOpt<T>(value: T | [] | [T] | undefined): T | undefined {
    if (value === undefined) return undefined;
    if (Array.isArray(value)) {
      return value.length > 0 ? (value[0] as T) : undefined;
    }
    return value as T;
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
