/**
 * Plug N Play wallet singleton.
 */
import { createPNP } from '@windoge98/plug-n-play';
import { IC_HOST, isLocalHost, getIdentityProviderUrl } from './config';

function buildCanisterAllowlist(): string[] {
  const envList = (process.env.NEXT_PUBLIC_PNP_WHITELIST || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const baseList = [
    process.env.NEXT_PUBLIC_PRY_LEDGER_CANISTER_ID,
    process.env.NEXT_PUBLIC_PRYSM_ROUTER_CANISTER_ID,
    process.env.NEXT_PUBLIC_ICPSWAP_SWAPFACTORY_CANISTER_ID,
    process.env.NEXT_PUBLIC_FRONTEND_CANISTER_ID,
  ].filter(Boolean) as string[];

  return Array.from(new Set([...baseList, ...envList]));
}

function resolveReplicaPort(): number | undefined {
  try {
    const hostUrl = new URL(IC_HOST);
    if (hostUrl.port) {
      const port = Number(hostUrl.port);
      return Number.isFinite(port) ? port : undefined;
    }
  } catch {
    // Ignore invalid URLs
  }
  return undefined;
}

const allowlist = buildCanisterAllowlist();

export const pnp = createPNP({
  network: isLocalHost ? 'local' : 'ic',
  delegation: (() => {
    return allowlist.length ? { targets: allowlist } : undefined;
  })(),
  ...(isLocalHost
    ? {
        ports: {
          replica: resolveReplicaPort() ?? 8080,
          frontend: 3000,
        },
      }
    : {}),
  adapters: {
    ii: {
      enabled: true,
      iiProviderUrl: getIdentityProviderUrl()
    },
    plug: { enabled: true, whitelist: allowlist, host: IC_HOST },
  },
});
