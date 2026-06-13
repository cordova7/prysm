'use client';

/**
 * Wallet Context Provider
 * Provides wallet connection state and methods throughout the app
 */
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  ReactNode,
} from 'react';
import { Principal } from '@dfinity/principal';
import { ActorSubclass } from '@dfinity/agent';
import { IDL } from '@dfinity/candid';
import type {
  WalletContextValue,
  WalletType,
  WalletAccount,
} from '@/lib/wallet/types';
import { pnp } from '@/lib/wallet/pnp';
import { getAdapter } from '@/lib/wallet/adapters';

// Storage key for persisting wallet connection
const WALLET_STORAGE_KEY = 'prysm_wallet_type';

// Create the context
const WalletContext = createContext<WalletContextValue | null>(null);

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletType, setWalletType] = useState<WalletType | null>(null);
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const actorCacheRef = useRef<
    WeakMap<IDL.InterfaceFactory, Map<string, ActorSubclass<any>>>
  >(new WeakMap());
  const lastChannelOpenRef = useRef<number>(0);

  // Try to restore previous session on mount
  useEffect(() => {
    const restoreSession = async () => {
      if (typeof window === 'undefined') return;

      try {
        const savedWalletType = localStorage.getItem(WALLET_STORAGE_KEY) as WalletType | null;
        if (!savedWalletType) return;

        setIsConnecting(true);

        let principal: Principal;

        // Use custom adapter for II
        if (savedWalletType === 'ii') {
          const adapter = getAdapter('ii');
          const isConnected = await adapter.isConnected();

          if (isConnected) {
            const identity = adapter.getIdentity?.();
            if (identity) {
              principal = identity.getPrincipal();
            } else {
              throw new Error('No identity found');
            }
          } else {
            // Session expired, clear it
            throw new Error('Session expired');
          }
        } else {
          // Use plug-n-play for other wallets
          if (!pnp.isAuthenticated()) {
            try {
              await pnp.connect(savedWalletType);
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              if (message.toLowerCase().includes('user rejected')) {
                return;
              }
              throw err;
            }
          }

          const accountData = pnp.account;
          if (!accountData?.owner) {
            throw new Error('No account found');
          }

          principal = Principal.fromText(String(accountData.owner));
        }

        setAccount({ principal });
        setWalletType(savedWalletType);
        setIsConnected(true);
        setError(null);
      } catch (err) {
        console.warn('Failed to restore wallet session:', err);

        // Clear stale state
        setIsConnected(false);
        setAccount(null);
        setWalletType(null);

        // Clear localStorage
        try {
          localStorage.removeItem(WALLET_STORAGE_KEY);
        } catch {
          // Private browsing mode - ignore
        }
      } finally {
        setIsConnecting(false);
      }
    };

    restoreSession();
  }, []);

  // Connect to a wallet
  const connect = useCallback(async (type: WalletType) => {
    setIsConnecting(true);
    setError(null);

    try {
      let walletAccount: WalletAccount;

      // Use custom adapter for II (bypasses plug-n-play's old auth-client)
      if (type === 'ii') {
        const adapter = getAdapter('ii');
        walletAccount = await adapter.connect();
      } else {
        // Use plug-n-play for other wallets (Plug)
        const pnpAccount = await pnp.connect(type);
        if (!pnpAccount?.owner) {
          throw new Error('Wallet did not return an account');
        }
        walletAccount = { principal: Principal.fromText(String(pnpAccount.owner)) };
      }

      if (!walletAccount?.principal) {
        throw new Error('Wallet did not return a principal');
      }

      setAccount(walletAccount);
      setWalletType(type);
      setIsConnected(true);
      actorCacheRef.current = new WeakMap();

      // Persist the wallet type
      localStorage.setItem(WALLET_STORAGE_KEY, type);
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const message = raw.toLowerCase().includes('tab closed')
        ? 'Wallet window closed. Please reconnect.'
        : raw || 'Failed to connect wallet';
      setError(message);
      console.error('Wallet connection error:', err);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Disconnect from wallet
  const disconnect = useCallback(async () => {
    try {
      // Disconnect using custom adapter for II
      if (walletType === 'ii') {
        const adapter = getAdapter('ii');
        await adapter.disconnect();
      } else {
        // Use plug-n-play for other wallets
        await pnp.disconnect();
      }
    } catch (err) {
      console.warn('Error during disconnect:', err);
    } finally {
      setIsConnected(false);
      setAccount(null);
      setWalletType(null);
      setError(null);
      actorCacheRef.current = new WeakMap();
      localStorage.removeItem(WALLET_STORAGE_KEY);
    }
  }, [walletType]);

  // Create an actor for canister interaction
  const getActor = useCallback(
    async <T,>(
      canisterId: string,
      idlFactory: IDL.InterfaceFactory
    ): Promise<ActorSubclass<T>> => {
      if (!isConnected) {
        throw new Error('Wallet not connected');
      }

      let cache = actorCacheRef.current.get(idlFactory);
      if (!cache) {
        cache = new Map<string, ActorSubclass<any>>();
        actorCacheRef.current.set(idlFactory, cache);
      }
      const cached = cache.get(canisterId);
      if (cached) return cached as ActorSubclass<T>;

      let actor: ActorSubclass<T>;

      // Use custom adapter for II
      if (walletType === 'ii') {
        const adapter = getAdapter('ii');
        actor = await adapter.createActor<T>(canisterId, idlFactory);
      } else {
        // Use plug-n-play for other wallets
        if (!pnp.isAuthenticated()) {
          throw new Error('Wallet not connected');
        }
        actor = pnp.getActor({ canisterId, idl: idlFactory }) as ActorSubclass<T>;
      }

      cache.set(canisterId, actor);
      return actor;
    },
    [isConnected, walletType]
  );

  const openChannel = useCallback(async () => {
    if (!isConnected) {
      throw new Error('Wallet not connected');
    }

    const now = Date.now();
    if (now - lastChannelOpenRef.current < 10_000) {
      return;
    }
    lastChannelOpenRef.current = now;

    // Only use plug-n-play for non-II wallets (II doesn't need channel opening)
    if (walletType !== 'ii' && pnp.isAuthenticated()) {
      await pnp.openChannel().catch(() => {
        // Best effort: some wallets don't support persistent channels.
      });
    }
  }, [isConnected, walletType]);

  // Truncated principal for display
  const truncatedPrincipal = useMemo(() => {
    if (!account?.principal) return null;
    const text = account.principal.toText();
    if (text.length <= 16) return text;
    return `${text.slice(0, 8)}...${text.slice(-8)}`;
  }, [account?.principal]);

  const value: WalletContextValue = {
    isConnected,
    isConnecting,
    walletType,
    principal: account?.principal || null,
    account,
    error,
    connect,
    disconnect,
    getActor,
    openChannel,
    truncatedPrincipal,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

// Hook to use wallet context
export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

// Hook to check if a specific wallet is available
export function useWalletAvailability() {
  const [availability, setAvailability] = useState<Record<WalletType, boolean>>({
    plug: false,
    ii: true, // II is always available
  });

  useEffect(() => {
    const checkAvailability = async () => {
      setAvailability({
        plug: typeof window !== 'undefined' && !!(window as any).ic?.plug,
        ii: true,
      });
    };

    checkAvailability();
  }, []);

  return availability;
}

export default WalletContext;
