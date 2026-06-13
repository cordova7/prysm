import { Actor, HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { ILedgerAdapter, NormalizedTxPage, NormalizedTransaction, Account } from './types.js';
import { logger } from '../../utils/logger.js';

/**
 * Index-ng Adapter (ICRC-1 index canister, tx history via get_blocks)
 */
export class IndexNgAdapter implements ILedgerAdapter {
  public readonly apiType = 'index-ng' as const;
  public readonly canisterId: string;
  private indexActor: any;
  private ledgerActor: any;

  constructor(agent: HttpAgent, indexCanisterId: string, ledgerCanisterId: string) {
    this.canisterId = indexCanisterId;
    this.indexActor = this.createIndexActor(agent, indexCanisterId);
    this.ledgerActor = this.createLedgerActor(agent, ledgerCanisterId);
  }

  private createIndexActor(agent: HttpAgent, canisterId: string) {
    const idlFactory = ({ IDL }: any) =>
      IDL.Service({
        get_blocks: IDL.Func(
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
      });

    return Actor.createActor(idlFactory, {
      agent,
      canisterId: Principal.fromText(canisterId),
    });
  }

  private createLedgerActor(agent: HttpAgent, canisterId: string) {
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
    try {
      const result = await this.indexActor.get_blocks({ start: 0n, length: 0n });
      return BigInt(result.chain_length);
    } catch (error) {
      logger.error(`Failed to get total tx count via index-ng: ${error}`);
      throw error;
    }
  }

  async getTxPage(start: bigint, length: number): Promise<NormalizedTxPage> {
    try {
      const result = await this.indexActor.get_blocks({
        start: BigInt(start),
        length: BigInt(length),
      });

      const transactions: NormalizedTransaction[] = result.blocks.map(
        (block: any, idx: number) => this.normalizeBlock(block, start + BigInt(idx))
      );

      const chainLength = BigInt(result.chain_length);
      return {
        transactions,
        hasMore: start + BigInt(length) < chainLength,
      };
    } catch (error) {
      logger.error(`Failed to fetch tx page via index-ng: ${error}`);
      throw error;
    }
  }

  private normalizeBlock(block: any, index: bigint): NormalizedTransaction {
    const blockValue = this.unwrapValue(block);
    const blockMap = this.toMap(blockValue);
    const txValue =
      this.getMapValue(blockMap, 'tx') ||
      this.getMapValue(blockMap, 'transaction') ||
      blockValue;
    const txMap = this.toMap(txValue);

    const timestampValue =
      this.getMapValue(blockMap, 'ts') ||
      this.getMapValue(txMap, 'ts') ||
      this.getMapValue(txMap, 'timestamp');
    const timestamp = timestampValue !== undefined ? BigInt(timestampValue as any) : 0n;
    const kind = this.detectTxKind(txMap);

    const normalized: NormalizedTransaction = {
      index,
      timestamp,
      kind,
    };

    const transferMap = this.toMap(this.getMapValue(txMap, 'transfer'));
    const mintMap = this.toMap(this.getMapValue(txMap, 'mint'));
    const burnMap = this.toMap(this.getMapValue(txMap, 'burn'));
    const approveMap = this.toMap(this.getMapValue(txMap, 'approve'));

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
    const op = this.getMapValue(txData, 'op');
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
    const value = this.unwrapValue(account);
    const map = this.toMap(value);
    const ownerValue =
      this.getMapValue(map, 'owner') ||
      this.getMapValue(map, 'address') ||
      this.getMapValue(map, 'principal') ||
      value;
    const subaccountValue = this.getMapValue(map, 'subaccount');
    return {
      owner: ownerValue?.toText?.() ?? ownerValue?.toString?.() ?? String(ownerValue),
      subaccount: Array.isArray(subaccountValue) ? subaccountValue[0] : subaccountValue,
    };
  }

  private unwrapValue(value: any): any {
    if (value === undefined || value === null) return value;
    if (Array.isArray(value)) return value.map((entry) => this.unwrapValue(entry));
    if (value instanceof Uint8Array) return value;
    if (typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length === 1) {
        const key = keys[0];
        const inner = value[key];
        switch (key) {
          case 'Map':
          case 'Array':
            return this.unwrapValue(inner);
          case 'Blob':
          case 'Text':
          case 'Nat':
          case 'Nat64':
          case 'Int':
            return inner;
          default:
            return this.unwrapValue(inner);
        }
      }
    }
    return value;
  }

  private toMap(value: any): Map<string, any> {
    const unwrapped = this.unwrapValue(value);
    if (!unwrapped) return new Map();
    if (unwrapped instanceof Map) return unwrapped;
    if (Array.isArray(unwrapped)) {
      if (unwrapped.length > 0 && Array.isArray(unwrapped[0])) {
        return new Map<string, any>(
          unwrapped.map(([key, val]: any) => [String(key), this.unwrapValue(val)])
        );
      }
      if (unwrapped.length > 0 && typeof unwrapped[0] === 'object') {
        const entries: Array<[string, any]> = [];
        for (const item of unwrapped) {
          if (Array.isArray(item) && item.length >= 2) {
            entries.push([String(item[0]), this.unwrapValue(item[1])]);
            continue;
          }
          if (item && typeof item === 'object') {
            if ('0' in item && '1' in item) {
              entries.push([String((item as any)[0]), this.unwrapValue((item as any)[1])]);
              continue;
            }
            if ('text' in item && ('value' in item || 'Value' in item)) {
              const val = 'value' in item ? (item as any).value : (item as any).Value;
              entries.push([String((item as any).text), this.unwrapValue(val)]);
              continue;
            }
          }
        }
        return new Map<string, any>(entries);
      }
    }
    if (typeof unwrapped === 'object') {
      return new Map<string, any>(
        Object.entries(unwrapped).map(([key, val]) => [key, this.unwrapValue(val)])
      );
    }
    return new Map();
  }

  private getMapValue(map: Map<string, any>, key: string): any {
    if (!map || map.size === 0) return undefined;
    if (map.has(key)) return this.unwrapValue(map.get(key));
    return undefined;
  }

  async balanceOf(owner: Principal, subaccount?: Uint8Array): Promise<bigint> {
    const result = await this.ledgerActor.icrc1_balance_of({
      owner,
      subaccount: subaccount ? [subaccount] : [],
    });
    return result;
  }

  async totalSupply(): Promise<bigint> {
    return await this.ledgerActor.icrc1_total_supply();
  }

  async decimals(): Promise<number> {
    const result = await this.ledgerActor.icrc1_decimals();
    return Number(result);
  }

  async symbol(): Promise<string> {
    return await this.ledgerActor.icrc1_symbol();
  }
}
