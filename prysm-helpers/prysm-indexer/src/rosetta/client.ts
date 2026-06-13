import { AccountIdentifier as LedgerAccountIdentifier } from '@dfinity/ledger-icp';
import { Principal } from '@dfinity/principal';
import { logger } from '../utils/logger.js';
import type {
  NetworkListResponse,
  NetworkStatusResponse,
  AccountBalanceResponse,
  SearchTransactionsResponse,
  NetworkIdentifier,
  BlockResponse,
} from './types.js';

/**
 * Rosetta HTTP Client for ICP ledger operations
 */
export class RosettaHttpClient {
  private rosettaUrl: string;
  private networkId?: NetworkIdentifier;
  private timeoutMs: number;
  private maxRetries: number;
  private retryDelayMs: number;
  private maxInFlight: number;
  private minDelayMs: number;
  private inFlight: number = 0;
  private waiters: Array<() => void> = [];
  private nextReadyAt: number = 0;

  constructor(
    rosettaUrl: string,
    timeoutMs: number = 15000,
    maxRetries: number = 2,
    retryDelayMs: number = 750,
    maxInFlight: number = 1,
    minDelayMs: number = 250
  ) {
    this.rosettaUrl = rosettaUrl;
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
    this.retryDelayMs = retryDelayMs;
    this.maxInFlight = maxInFlight;
    this.minDelayMs = minDelayMs;
  }

  /**
   * Discover and validate the Rosetta network identifier.
   */
  async init(): Promise<void> {
    if (this.networkId) {
      return;
    }

    const networkList = await this.networkList();
    if (!networkList.network_identifiers.length) {
      throw new Error('Rosetta /network/list returned no networks');
    }

    const preferred = networkList.network_identifiers.find(
      (network) => network.blockchain === 'Internet Computer'
    );

    this.networkId = preferred || networkList.network_identifiers[0];

    await this.networkStatus();
  }

  /**
   * Get list of available networks
   */
  async networkList(): Promise<NetworkListResponse> {
    return this.post<NetworkListResponse>('/network/list', {
      metadata: {},
    });
  }

  /**
   * Get network status
   */
  async networkStatus(): Promise<NetworkStatusResponse> {
    await this.ensureNetworkId();
    return this.post<NetworkStatusResponse>('/network/status', {
      network_identifier: this.networkId,
      metadata: {},
    });
  }

  /**
   * Get account balance
   */
  async accountBalance(
    accountId: string,
    blockIndex?: number
  ): Promise<AccountBalanceResponse> {
    await this.ensureNetworkId();
    return this.post<AccountBalanceResponse>('/account/balance', {
      network_identifier: this.networkId,
      account_identifier: {
        address: accountId,
      },
      block_identifier: blockIndex
        ? {
            index: blockIndex,
          }
        : undefined,
    });
  }

  /**
   * Search transactions for an account
   */
  async searchTransactions(
    accountId: string,
    limit: number = 20,
    offset?: number,
    maxBlock?: number
  ): Promise<SearchTransactionsResponse> {
    await this.ensureNetworkId();
    return this.post<SearchTransactionsResponse>('/search/transactions', {
      network_identifier: this.networkId,
      account_identifier: {
        address: accountId,
      },
      limit,
      offset,
      max_block: maxBlock,
    }, {
      timeoutMs: 300000,
      maxRetries: 0,
    });
  }

  /**
   * Fetch a block by index
   */
  async block(index: number): Promise<BlockResponse> {
    await this.ensureNetworkId();
    return this.post<BlockResponse>('/block', {
      network_identifier: this.networkId,
      block_identifier: {
        index,
      },
    });
  }

  /**
   * Convert principal to ICP account identifier
   */
  principalToAccountId(principal: Principal, subaccount?: Uint8Array): string {
    const accountIdentifier = LedgerAccountIdentifier.fromPrincipal({
      principal,
      subAccount: subaccount as any,
    });
    return accountIdentifier.toHex();
  }

  /**
   * Make POST request to Rosetta API
   */
  private async post<T>(
    endpoint: string,
    body: any,
    options?: { timeoutMs?: number; maxRetries?: number }
  ): Promise<T> {
    const url = `${this.rosettaUrl}${endpoint}`;

    logger.debug(`Rosetta API request: POST ${endpoint}`);

    let lastError: Error | undefined;
    const timeoutMs = options?.timeoutMs ?? this.timeoutMs;
    const maxRetries = options?.maxRetries ?? this.maxRetries;

    await this.acquireSlot();
    try {
      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), timeoutMs);
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
              `ROSETTA_HTTP_${response.status}: ${response.statusText} - ${errorText}`
            );
          }

          const data = await response.json();
          return data as T;
        } catch (error: any) {
          if (error?.name === 'AbortError') {
            const timeoutMessage = `ROSETTA_TIMEOUT ${endpoint} after ${timeoutMs}ms`;
            logger.error(timeoutMessage);
            lastError = new Error(timeoutMessage);
          } else {
            lastError = error;
          }

          const isLastAttempt = attempt === maxRetries;
          if (isLastAttempt) {
            logger.error(`Rosetta API request failed: ${lastError}`);
            throw lastError;
          }

          logger.warn(
          `Rosetta API request failed (attempt ${attempt + 1}/${
            maxRetries + 1
          }): ${lastError}. Retrying...`
        );
          await new Promise((resolve) =>
            setTimeout(resolve, this.retryDelayMs * (attempt + 1))
          );
        }
      }
    } finally {
      this.releaseSlot();
    }

    throw lastError ?? new Error('ROSETTA_UNKNOWN');
  }

  private async ensureNetworkId(): Promise<void> {
    if (!this.networkId) {
      await this.init();
    }
  }

  private async acquireSlot(): Promise<void> {
    if (this.inFlight >= this.maxInFlight) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }

    this.inFlight += 1;

    if (this.minDelayMs <= 0) {
      return;
    }

    const now = Date.now();
    const waitMs = Math.max(0, this.nextReadyAt - now);
    this.nextReadyAt = Math.max(this.nextReadyAt, now) + this.minDelayMs;

    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  private releaseSlot(): void {
    this.inFlight = Math.max(0, this.inFlight - 1);
    const next = this.waiters.shift();
    if (next) {
      next();
    }
  }
}
