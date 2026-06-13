/**
 * Internet Identity Wallet Adapter
 * Uses @dfinity/auth-client for authentication
 */
import { AuthClient } from '@dfinity/auth-client';
import { HttpAgent, Actor, ActorSubclass, Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { IDL } from '@dfinity/candid';
import type { WalletAdapter, WalletAccount } from '../types';
import { IC_HOST, getDerivationOrigin, getIdentityProviderUrl, isLocalHost } from '../config';

export class InternetIdentityAdapter implements WalletAdapter {
  id = 'ii' as const;
  name = 'Internet Identity';
  icon = '/wallets/ii-logo.svg';

  private authClient: AuthClient | null = null;
  private authClientPromise: Promise<AuthClient> | null = null;
  private agent: HttpAgent | undefined;
  private actorCache = new Map<string, ActorSubclass<any>>();

  isAvailable(): boolean {
    // II is always available (web-based)
    return true;
  }

  private async getAuthClient(): Promise<AuthClient> {
    if (this.authClient) return this.authClient;

    // FIX: Create promise on first use (browser only) to avoid SSR issues
    // Cache the promise to prevent race conditions
    if (!this.authClientPromise) {
      this.authClientPromise = AuthClient.create({
        idleOptions: {
          idleTimeout: 1000 * 60 * 60 * 24, // 24 hours
          disableDefaultIdleCallback: true,
        },
      }).then((client) => {
        this.authClient = client;
        return client;
      });
    }

    return await this.authClientPromise;
  }

  async connect(): Promise<WalletAccount> {
    const authClient = await this.getAuthClient();

    // Check if already authenticated
    const isAuthenticated = await authClient.isAuthenticated();
    if (isAuthenticated) {
      const identity = authClient.getIdentity();
      const principal = identity.getPrincipal();

      if (!principal.isAnonymous()) {
        await this.initAgent(identity);
        return { principal };
      }
    }

    // Need to perform login
    return new Promise((resolve, reject) => {
      const width = 500;
      const height = 600;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      const derivationOrigin = getDerivationOrigin();

      console.log('[IIAdapter] Starting login with:', {
        identityProvider: getIdentityProviderUrl(),
        derivationOrigin: derivationOrigin || '(none - will use default)',
        isLocalhost: isLocalHost
      });

      authClient.login({
        identityProvider: getIdentityProviderUrl(),
        ...(derivationOrigin ? { derivationOrigin } : {}),
        maxTimeToLive: BigInt(24 * 60 * 60 * 1000 * 1000 * 1000), // 24 hours in nanoseconds
        windowOpenerFeatures: `width=${width},height=${height},left=${left},top=${top}`,
        onSuccess: async () => {
          try {
            const identity = authClient.getIdentity();
            const principal = identity.getPrincipal();

            if (principal.isAnonymous()) {
              reject(new Error('Authentication failed: received anonymous principal'));
              return;
            }

            await this.initAgent(identity);
            resolve({ principal });
          } catch (error) {
            reject(error);
          }
        },
        onError: (error?: string) => {
          reject(new Error(`Internet Identity login failed: ${error || 'Unknown error'}`));
        },
      });
    });
  }

  private async initAgent(identity: Identity): Promise<void> {
    this.agent = await HttpAgent.create({
      host: IC_HOST,
      identity,
    });

    // Fetch root key in development (local replica)
    if (process.env.NODE_ENV !== 'production' && isLocalHost) {
      await this.agent.fetchRootKey();
    }
  }

  async disconnect(): Promise<void> {
    if (this.authClient) {
      await this.authClient.logout();
    }
    this.agent = undefined;
    this.actorCache.clear();
  }

  async isConnected(): Promise<boolean> {
    const authClient = await this.getAuthClient();
    const isAuthenticated = await authClient.isAuthenticated();
    if (!isAuthenticated) return false;

    const identity = authClient.getIdentity();
    const connected = !identity.getPrincipal().isAnonymous();

    // If we have a valid session but no agent (e.g. page reload), recreate it lazily.
    if (connected && !this.agent) {
      await this.initAgent(identity);
    }

    return connected;
  }

  getIdentity(): Identity | null {
    return this.authClient?.getIdentity() || null;
  }

  async createActor<T>(
    canisterId: string,
    idlFactory: IDL.InterfaceFactory
  ): Promise<ActorSubclass<T>> {
    const cached = this.actorCache.get(canisterId);
    if (cached) return cached as ActorSubclass<T>;

    if (!this.agent) {
      // Attempt lazy init from existing session
      const authClient = await this.getAuthClient();
      const identity = authClient.getIdentity();
      if (identity.getPrincipal().isAnonymous()) {
        throw new Error('Not connected. Please connect first.');
      }
      await this.initAgent(identity);
    }

    const agent = this.agent;
    if (!agent) {
      throw new Error('Not connected. Please connect first.');
    }

    const actor = Actor.createActor<T>(idlFactory, {
      agent,
      canisterId,
    });
    this.actorCache.set(canisterId, actor);
    return actor;
  }
}

export const iiAdapter = new InternetIdentityAdapter();
