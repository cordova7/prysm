import { Actor, HttpAgent } from '@dfinity/agent';
import { idlLabelToId } from '@dfinity/candid';
import { Principal } from '@dfinity/principal';
import { ILedgerAdapter, NormalizedTxPage, NormalizedTransaction } from './types.js';
import { logger } from '../../utils/logger.js';

/**
 * GetTransactions Adapter (common pattern for many tokens)
 */
export class GetTransactionsAdapter implements ILedgerAdapter {
  public readonly apiType = 'get_transactions' as const;
  public readonly canisterId: string;
  private actor: any;
  private agent: HttpAgent;

  constructor(agent: HttpAgent, canisterId: string) {
    this.canisterId = canisterId;
    this.agent = agent;
    this.actor = this.createActor(agent, canisterId);
  }

  private createActor(agent: HttpAgent, canisterId: string) {
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
            first_index: IDL.Nat,
            log_length: IDL.Nat,
            transactions: IDL.Vec(IDL.Unknown),
            archived_transactions: IDL.Vec(IDL.Unknown),
          }),
        ],
        ['query']
      ),
      balance_of: IDL.Func([IDL.Principal], [IDL.Nat], ['query']),
      total_supply: IDL.Func([], [IDL.Nat], ['query']),
      decimals: IDL.Func([], [IDL.Nat8], ['query']),
      symbol: IDL.Func([], [IDL.Text], ['query']),
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
      icrc1_total_supply: IDL.Func([], [IDL.Nat], ['query']),
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
      const result = await this.actor.get_transactions({
        start: 0n,
        length: 0n,
      });
      return BigInt(result.log_length);
    } catch (error) {
      logger.error(`Failed to get total tx count: ${error}`);
      throw error;
    }
  }

  async getTxPage(start: bigint, length: number): Promise<NormalizedTxPage> {
    try {
      const result = await this.actor.get_transactions({
        start: BigInt(start),
        length: BigInt(length),
      });

      const transactions: NormalizedTransaction[] = [];
      const mainTxs = Array.isArray(result.transactions) ? result.transactions : [];

      for (let i = 0; i < mainTxs.length; i += 1) {
        transactions.push(this.normalizeTransaction(mainTxs[i], start + BigInt(i)));
      }

      const archived = Array.isArray(result.archived_transactions)
        ? result.archived_transactions
        : [];

      if (archived.length > 0) {
        const archivedTxs = await this.fetchArchivedTransactions(
          archived,
          start,
          BigInt(length)
        );
        transactions.push(...archivedTxs);
      }

      transactions.sort((a, b) => (a.index < b.index ? -1 : a.index > b.index ? 1 : 0));

      return {
        transactions,
        hasMore: start + BigInt(length) < BigInt(result.log_length),
      };
    } catch (error) {
      logger.error(`Failed to fetch tx page: ${error}`);
      throw error;
    }
  }

  private normalizeTransaction(tx: any, index: bigint): NormalizedTransaction {
    const root = this.readField(tx, 'transaction') || this.readField(tx, 'tx') || tx;
    const kindValue =
      this.readField(root, 'kind') ||
      this.readField(root, 'operation') ||
      this.readField(root, 'tx_type');
    const kindText = typeof kindValue === 'string' ? kindValue : undefined;
    const timestampValue = this.readField(root, 'timestamp') || this.readField(root, 'ts');
    const timestamp = timestampValue ? BigInt(timestampValue) : 0n;

    const normalized: NormalizedTransaction = {
      index,
      timestamp,
      kind: this.mapKind(kindText || 'transfer'),
    };

    const transfer = this.unwrapOpt(this.readField(root, 'transfer'));
    const mint = this.unwrapOpt(this.readField(root, 'mint'));
    const burn = this.unwrapOpt(this.readField(root, 'burn'));
    const approve = this.unwrapOpt(this.readField(root, 'approve'));

    if (transfer) {
      normalized.kind = 'transfer';
      normalized.from = this.extractAccount(this.readField(transfer, 'from'));
      normalized.to = this.extractAccount(this.readField(transfer, 'to'));
      const amountValue = this.readField(transfer, 'amount');
      if (amountValue !== undefined) {
        normalized.amount = BigInt(amountValue);
      }
      const feeValue = this.readField(transfer, 'fee');
      if (feeValue !== undefined) {
        normalized.fee = BigInt(feeValue);
      }
      return normalized;
    }

    if (mint) {
      normalized.kind = 'mint';
      normalized.to = this.extractAccount(this.readField(mint, 'to'));
      const amountValue = this.readField(mint, 'amount');
      if (amountValue !== undefined) {
        normalized.amount = BigInt(amountValue);
      }
      return normalized;
    }

    if (burn) {
      normalized.kind = 'burn';
      normalized.from = this.extractAccount(this.readField(burn, 'from'));
      const amountValue = this.readField(burn, 'amount');
      if (amountValue !== undefined) {
        normalized.amount = BigInt(amountValue);
      }
      return normalized;
    }

    if (approve) {
      normalized.kind = 'approve';
      normalized.from = this.extractAccount(this.readField(approve, 'from'));
      normalized.to = this.extractAccount(this.readField(approve, 'spender'));
      return normalized;
    }

    const fromValue = this.readField(root, 'from') || this.readField(root, 'sender');
    if (fromValue) {
      normalized.from = this.extractAccount(fromValue);
    }

    const toValue =
      this.readField(root, 'to') ||
      this.readField(root, 'recipient') ||
      this.readField(root, 'spender');
    if (toValue) {
      normalized.to = this.extractAccount(toValue);
    }

    const amountValue = this.readField(root, 'amount');
    if (amountValue !== undefined) {
      normalized.amount = BigInt(amountValue);
    }

    const feeValue = this.readField(root, 'fee');
    if (feeValue !== undefined) {
      normalized.fee = BigInt(feeValue);
    }

    return normalized;
  }

  private async fetchArchivedTransactions(
    archivedEntries: any[],
    start: bigint,
    length: bigint
  ): Promise<NormalizedTransaction[]> {
    const results: NormalizedTransaction[] = [];
    const endExclusive = start + length;

    for (const entry of archivedEntries) {
      const entryStartRaw =
        this.readField(entry, 'start') ??
        (Array.isArray(entry) ? entry[0] : undefined);
      const entryLengthRaw =
        this.readField(entry, 'length') ??
        (Array.isArray(entry) ? entry[1] : undefined);
      const callback =
        this.readField(entry, 'callback') ??
        (Array.isArray(entry) ? entry[2] : undefined);

      if (entryStartRaw === undefined || entryLengthRaw === undefined || !callback) {
        continue;
      }

      const entryStart = BigInt(entryStartRaw);
      const entryLength = BigInt(entryLengthRaw);
      const entryEndExclusive = entryStart + entryLength;

      const overlapStart = start > entryStart ? start : entryStart;
      const overlapEndExclusive = endExclusive < entryEndExclusive
        ? endExclusive
        : entryEndExclusive;
      const overlapLength = overlapEndExclusive - overlapStart;

      if (overlapLength <= 0n) {
        continue;
      }

      const archiveResult = await this.callArchiveCallback(
        callback,
        overlapStart,
        overlapLength,
        entryStart
      );

      const txs = Array.isArray(archiveResult?.transactions)
        ? archiveResult.transactions
        : [];

      for (let i = 0; i < txs.length; i += 1) {
        results.push(this.normalizeTransaction(txs[i], overlapStart + BigInt(i)));
      }
    }

    return results;
  }

  private async callArchiveCallback(
    callback: any,
    start: bigint,
    length: bigint,
    entryStart: bigint
  ): Promise<any> {
    const canisterIdValue =
      this.readField(callback, 'canister_id') ??
      this.readField(callback, 'principal') ??
      this.readField(callback, 'canisterId') ??
      (Array.isArray(callback) ? callback[0] : undefined);
    const method =
      this.readField(callback, 'method') ??
      this.readField(callback, 'method_name') ??
      this.readField(callback, 'methodName') ??
      (Array.isArray(callback) ? callback[1] : undefined);

    const canisterIdText = canisterIdValue?.toString?.() ?? String(canisterIdValue);
    const methodName = method ? String(method) : 'get_transactions';

    const archiveActor = this.createArchiveActor(canisterIdText, methodName);

    try {
      return await (archiveActor as any)[methodName]({
        start,
        length,
      });
    } catch (error) {
      const relativeStart = start - entryStart;
      if (relativeStart < 0n) {
        throw error;
      }

      return await (archiveActor as any)[methodName]({
        start: relativeStart,
        length,
      });
    }
  }

  private createArchiveActor(archiveCanisterId: string, methodName: string): any {
    const idlFactory = ({ IDL }: any) =>
      IDL.Service({
        [methodName]: IDL.Func(
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
      canisterId: Principal.fromText(archiveCanisterId),
    });
  }

  private mapKind(kind: string): NormalizedTransaction['kind'] {
    const lowerKind = kind.toLowerCase();
    if (lowerKind.includes('mint')) return 'mint';
    if (lowerKind.includes('burn')) return 'burn';
    if (lowerKind.includes('approve')) return 'approve';
    return 'transfer';
  }

  private extractAccount(value: any): { owner: string; subaccount?: Uint8Array } | undefined {
    if (!value) return undefined;
    const ownerValue = this.readField(value, 'owner') ?? this.readField(value, 'address') ?? value;
    const owner = typeof ownerValue === 'string' ? ownerValue : ownerValue.toString();
    const sub = this.unwrapOpt(this.readField(value, 'subaccount'));
    return sub ? { owner, subaccount: sub } : { owner };
  }

  private unwrapOpt<T>(value: T | [] | [T] | undefined): T | undefined {
    if (value === undefined) return undefined;
    if (Array.isArray(value)) {
      return value.length > 0 ? (value[0] as T) : undefined;
    }
    return value as T;
  }

  private readField(obj: any, name: string): any {
    if (!obj) return undefined;
    if (obj instanceof Map) {
      if (obj.has(name)) return obj.get(name);
      const id = idlLabelToId(name);
      const hashed = `_${id}_`;
      if (obj.has(hashed)) return obj.get(hashed);
      return undefined;
    }
    if (Array.isArray(obj) && obj.length > 0 && Array.isArray(obj[0]) && obj[0].length === 2) {
      const map = new Map<string, any>(obj as Array<[string, any]>);
      if (map.has(name)) return map.get(name);
      const id = idlLabelToId(name);
      const hashed = `_${id}_`;
      if (map.has(hashed)) return map.get(hashed);
      return undefined;
    }
    if (Object.prototype.hasOwnProperty.call(obj, name)) {
      return obj[name];
    }
    const id = idlLabelToId(name);
    const hashed = `_${id}_`;
    if (Object.prototype.hasOwnProperty.call(obj, hashed)) {
      return obj[hashed];
    }
    return undefined;
  }

  async balanceOf(owner: Principal): Promise<bigint> {
    try {
      return await this.actor.icrc1_balance_of({
        owner,
        subaccount: [],
      });
    } catch {
      return await this.actor.balance_of(owner);
    }
  }

  async totalSupply(): Promise<bigint> {
    try {
      return await this.actor.icrc1_total_supply();
    } catch {
      return await this.actor.total_supply();
    }
  }

  async decimals(): Promise<number> {
    try {
      const result = await this.actor.icrc1_decimals();
      return Number(result);
    } catch {
      const result = await this.actor.decimals();
      return Number(result);
    }
  }

  async symbol(): Promise<string> {
    try {
      return await this.actor.icrc1_symbol();
    } catch {
      return await this.actor.symbol();
    }
  }
}
