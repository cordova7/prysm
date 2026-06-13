/**
 * Shared wallet configuration helpers.
 */
const DEFAULT_IC_HOST = 'https://icp0.io';
const DEFAULT_II_PROVIDER = 'https://id.ai';

export const IC_HOST = process.env.NEXT_PUBLIC_IC_HOST || DEFAULT_IC_HOST;

export const isLocalHost = IC_HOST.includes('localhost') || IC_HOST.includes('127.0.0.1');

export function getIdentityProviderUrl(): string {
  const envProvider = process.env.NEXT_PUBLIC_II_PROVIDER_URL;
  if (envProvider) return envProvider;

  const iiCanisterId = process.env.NEXT_PUBLIC_II_CANISTER_ID;
  if (iiCanisterId && isLocalHost) {
    return `${IC_HOST.replace(/\/$/, '')}/?canisterId=${iiCanisterId}`;
  }

  return DEFAULT_II_PROVIDER;
}

export function getDerivationOrigin(): string | undefined {
  const envOrigin = process.env.NEXT_PUBLIC_II_DERIVATION_ORIGIN;
  if (envOrigin) return envOrigin;

  const frontendCanisterId = process.env.NEXT_PUBLIC_FRONTEND_CANISTER_ID;
  if (frontendCanisterId && !isLocalHost) {
    return `https://${frontendCanisterId}.icp0.io`;
  }

  // For II 2.0 (id.ai), use the current origin as derivation origin
  // This supports both prysm.cc and www.prysm.cc automatically
  if (typeof window !== 'undefined' && !isLocalHost) {
    return window.location.origin;
  }

  return undefined;
}
