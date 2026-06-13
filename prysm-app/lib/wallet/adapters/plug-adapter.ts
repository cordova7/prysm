/**
 * Plug Wallet Adapter
 * Uses the Plug browser extension for authentication
 */
import { Actor, ActorSubclass, HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { IDL } from '@dfinity/candid';
import type { WalletAdapter, WalletAccount } from '../types';
import { IC_HOST, isLocalHost } from '../config';

// Plug wallet whitelist - canisters the app needs to interact with
const DEFAULT_WHITELIST: string[] = [
  // ICP Ledger (placeholder PRY)
  process.env.NEXT_PUBLIC_PRY_LEDGER_CANISTER_ID || 'ryjl3-tyaaa-aaaaa-aaaba-cai',
  // PRYSM Router (to be deployed)
  process.env.NEXT_PUBLIC_PRYSM_ROUTER_CANISTER_ID,
  // ICPSwap Factory
  process.env.NEXT_PUBLIC_ICPSWAP_SWAPFACTORY_CANISTER_ID || '4mmnk-kiaaa-aaaag-qbllq-cai',
].filter(Boolean) as string[];

// Type declaration for Plug wallet
declare global {
  interface Window {
    ic?: {
      plug?: {
        isConnected: () => Promise<boolean>;
        requestConnect: (options?: {
          whitelist?: string[];
          host?: string;
          timeout?: number;
        }) => Promise<boolean>;
        disconnect: () => Promise<void>;
        getPrincipal: () => Promise<Principal>;
        createAgent: (options: { whitelist: string[]; host: string }) => Promise<void>;
        agent?: HttpAgent;
        createActor: <T>(options: {
          canisterId: string;
          interfaceFactory: IDL.InterfaceFactory;
        }) => Promise<ActorSubclass<T>>;
      };
    };
  }
}

export class PlugAdapter implements WalletAdapter {
  id = 'plug' as const;
  name = 'Plug Wallet';
  icon = '/wallets/plug-logo.svg';

  private whitelist: string[];
  private actorCache = new Map<string, ActorSubclass<any>>();

  constructor(whitelist?: string[]) {
    this.whitelist = whitelist || DEFAULT_WHITELIST;
  }

  isAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    return !!window.ic?.plug;
  }

  private getPlug() {
    if (!this.isAvailable()) {
      throw new Error(
        'Plug wallet is not installed. Please install the Plug extension from https://plugwallet.ooo'
      );
    }
    return window.ic!.plug!;
  }

  private async ensureAgent(plug: any, force = false): Promise<void> {
    // Always recreate agent if forced or if agent doesn't exist
    if (force || !plug.agent) {
      await plug.createAgent({ whitelist: this.whitelist, host: IC_HOST });
    }
    await this.fetchRootKeyIfLocal(plug);
  }

  async connect(): Promise<WalletAccount> {
    const plug = this.getPlug();

    // Check if already connected
    const isConnected = await plug.isConnected();
    if (isConnected) {
      // Reconnect to refresh agent
      await this.ensureAgent(plug);

      const principal = await plug.getPrincipal();
      return { principal };
    }

    // Request connection
    const connected = await plug.requestConnect({
      whitelist: this.whitelist,
      host: IC_HOST,
      timeout: 120000, // 120 seconds (avoid "Reply not received" on slow networks)
    });

    if (!connected) {
      throw new Error('User rejected the connection request');
    }

    // Ensure agent exists after connect (some Plug versions require explicit createAgent).
    await this.ensureAgent(plug);

    const principal = await plug.getPrincipal();
    return { principal };
  }

  private async fetchRootKeyIfLocal(plug: any): Promise<void> {
    // Fetch root key for local replica (development only)
    if (process.env.NODE_ENV !== 'production' && isLocalHost && plug.agent) {
      try {
        await plug.agent.fetchRootKey();
        console.log('✓ Fetched root key for local development');
      } catch (error) {
        console.warn('Failed to fetch root key:', error);
      }
    }
  }

  async disconnect(): Promise<void> {
    const plug = this.getPlug();
    await plug.disconnect();
    this.actorCache.clear();
  }

  async isConnected(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const plug = window.ic!.plug!;
      const isConnected = await plug.isConnected();
      if (!isConnected) return false;

      // Rehydrate agent after reloads/extensions restarts.
      if (!plug.agent) {
        try {
          await this.ensureAgent(plug);
        } catch {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  async createActor<T>(
    canisterId: string,
    idlFactory: IDL.InterfaceFactory
  ): Promise<ActorSubclass<T>> {
    const plug = this.getPlug();

    const isConnected = await plug.isConnected();
    if (!isConnected) {
      throw new Error('Not connected. Please connect first.');
    }

    const cached = this.actorCache.get(canisterId);
    if (cached) return cached as ActorSubclass<T>;

    await this.ensureAgent(plug);

    // Ensure canister is in whitelist
    if (!this.whitelist.includes(canisterId)) {
      // Add to whitelist and force agent recreation
      this.whitelist.push(canisterId);
      await this.ensureAgent(plug, true); // FIX: Force recreation
    }

    const actor = await plug.createActor<T>({
      canisterId,
      interfaceFactory: idlFactory,
    });
    this.actorCache.set(canisterId, actor);
    return actor;
  }
}

export const plugAdapter = new PlugAdapter();
