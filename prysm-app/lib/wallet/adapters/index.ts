/**
 * Wallet Adapters Index
 */
export { InternetIdentityAdapter, iiAdapter } from './ii-adapter';
export { PlugAdapter, plugAdapter } from './plug-adapter';

import type { WalletAdapter, WalletType } from '../types';
import { iiAdapter } from './ii-adapter';
import { plugAdapter } from './plug-adapter';

// Map of wallet types to their adapters
export const adapters: Record<WalletType, WalletAdapter> = {
  ii: iiAdapter,
  plug: plugAdapter,
};

// Get adapter by type
export function getAdapter(walletType: WalletType): WalletAdapter {
  const adapter = adapters[walletType];
  if (!adapter) {
    throw new Error(`Unknown wallet type: ${walletType}`);
  }
  return adapter;
}

// Get all available adapters
export async function getAvailableAdapters(): Promise<WalletAdapter[]> {
  const available: WalletAdapter[] = [];

  for (const adapter of Object.values(adapters)) {
    try {
      const isAvailable = await Promise.resolve(adapter.isAvailable());
      if (isAvailable) {
        available.push(adapter);
      }
    } catch {
      // Adapter check failed, skip it
    }
  }

  return available;
}
