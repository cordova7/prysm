/**
 * Wallet integration types for PRYSM
 */
import { Principal } from '@dfinity/principal';
import { ActorSubclass, Identity } from '@dfinity/agent';
import { IDL } from '@dfinity/candid';

export type WalletType = 'plug' | 'ii';

export interface WalletAccount {
  principal: Principal;
  accountId?: string;
}

export interface WalletState {
  isConnected: boolean;
  isConnecting: boolean;
  walletType: WalletType | null;
  account: WalletAccount | null;
  error: string | null;
}

export interface WalletAdapter {
  id: WalletType;
  name: string;
  icon: string;
  isAvailable: () => boolean | Promise<boolean>;
  connect: () => Promise<WalletAccount>;
  disconnect: () => Promise<void>;
  isConnected: () => Promise<boolean>;
  getIdentity?: () => Identity | null;
  createActor: <T>(
    canisterId: string,
    idlFactory: IDL.InterfaceFactory
  ) => Promise<ActorSubclass<T>>;
}

export interface WalletContextValue {
  // State
  isConnected: boolean;
  isConnecting: boolean;
  walletType: WalletType | null;
  principal: Principal | null;
  account: WalletAccount | null;
  error: string | null;

  // Actions
  connect: (walletType: WalletType) => Promise<void>;
  disconnect: () => Promise<void>;

  // Actor creation
  getActor: <T>(
    canisterId: string,
    idlFactory: IDL.InterfaceFactory
  ) => Promise<ActorSubclass<T>>;

  // Wallet channel (best-effort)
  openChannel: () => Promise<void>;

  // Utilities
  truncatedPrincipal: string | null;
}

// Environment config
export interface WalletConfig {
  icHost: string;
  whitelist: string[];
}
