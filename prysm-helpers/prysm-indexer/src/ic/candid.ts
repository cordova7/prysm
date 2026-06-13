import { Actor, HttpAgent } from '@dfinity/agent';
import { IDL } from '@dfinity/candid';
import { Principal } from '@dfinity/principal';
import { logger } from '../utils/logger.js';

/**
 * Candid interface for introspection
 */
interface IntrospectionInterface {
  __get_candid_interface_tmp_hack?: () => Promise<string>;
}

/**
 * Introspect canister's Candid interface
 */
export async function introspectCanister(
  agent: HttpAgent,
  canisterId: string
): Promise<{ methods: string[]; candidSource?: string }> {
  logger.debug(`Introspecting canister: ${canisterId}`);

  try {
    // Method 1: Try __get_candid_interface_tmp_hack
    const actor = Actor.createActor<IntrospectionInterface>(
      () => IDL.Service({}),
      {
        agent,
        canisterId: Principal.fromText(canisterId),
      }
    );

    try {
      const candidSource = await actor.__get_candid_interface_tmp_hack?.();
      if (candidSource) {
        const methods = parseMethodsFromCandid(candidSource);
        logger.debug(`Found ${methods.length} methods via __get_candid_interface_tmp_hack`);
        return { methods, candidSource };
      }
    } catch (error) {
      logger.debug('__get_candid_interface_tmp_hack not available');
    }

    // Method 2: Try metadata query (ic:1)
    try {
      const metadata = await getCanisterMetadata(agent, canisterId);
      if (metadata) {
        const methods = parseMethodsFromCandid(metadata);
        logger.debug(`Found ${methods.length} methods via metadata`);
        return { methods, candidSource: metadata };
      }
    } catch (error) {
      logger.debug('Metadata query not available');
    }

    // If introspection fails, return empty methods list
    logger.warn(`Could not introspect canister ${canisterId}, returning empty methods list`);
    return { methods: [] };
  } catch (error) {
    logger.error(`Failed to introspect canister ${canisterId}:`, error);
    return { methods: [] };
  }
}

/**
 * Get canister metadata via IC management canister
 */
async function getCanisterMetadata(
  _agent: HttpAgent,
  _canisterId: string
): Promise<string | null> {
  try {
    // Simplified - metadata retrieval not fully implemented
    return null;

    /* const managementCanister = Actor.createActor(
      () =>
        IDL.Service({
          canister_status: IDL.Func(
            [IDL.Record({ canister_id: IDL.Principal })],
            [
              IDL.Record({
                module_hash: IDL.Opt(IDL.Vec(IDL.Nat8)),
              }),
            ],
            ['query']
          ),
        }),
      {
        agent,
        canisterId: Principal.fromText('aaaaa-aa'),
      }
    );

    // This is a simplified approach - actual metadata retrieval may vary
    return null; */
  } catch {
    return null;
  }
}

/**
 * Parse method names from Candid source
 */
function parseMethodsFromCandid(candidSource: string): string[] {
  const methods: string[] = [];

  // Match service methods in Candid IDL
  // Pattern: methodName : (args) -> (result) query/update
  const methodRegex = /(\w+)\s*:\s*\([^)]*\)\s*->\s*\([^)]*\)/g;

  let match;
  while ((match = methodRegex.exec(candidSource)) !== null) {
    methods.push(match[1]);
  }

  return methods;
}

/**
 * Check if canister has a specific method
 */
export function hasMethod(methods: string[], methodName: string): boolean {
  return methods.includes(methodName);
}

/**
 * Detect ledger API type from available methods
 */
export function detectLedgerApiType(methods: string[]): 'icrc3' | 'get_transactions' | 'query_blocks' | 'archives' | null {
  if (hasMethod(methods, 'icrc3_get_transactions')) {
    return 'icrc3';
  }

  if (hasMethod(methods, 'get_transactions')) {
    return 'get_transactions';
  }

  if (hasMethod(methods, 'query_blocks')) {
    return 'query_blocks';
  }

  if (hasMethod(methods, 'archives')) {
    return 'archives';
  }

  return null;
}

/**
 * Probe ledger API type by calling known methods directly.
 * This is a fallback when candid introspection is unavailable.
 */
export async function probeLedgerApiType(
  agent: HttpAgent,
  canisterId: string
): Promise<'icrc3' | 'get_transactions' | 'query_blocks' | 'archives' | null> {
  const target = Principal.fromText(canisterId);

  // Probe ICRC-3
  try {
    const actor = Actor.createActor(
      ({ IDL }: any) =>
        IDL.Service({
          icrc3_get_transactions: IDL.Func(
            [
              IDL.Record({
                start: IDL.Nat,
                length: IDL.Nat,
              }),
            ],
            [IDL.Record({ log_length: IDL.Nat, transactions: IDL.Vec(IDL.Unknown) })],
            ['query']
          ),
        }),
      { agent, canisterId: target }
    );
    await (actor as any).icrc3_get_transactions({ start: 0n, length: 0n });
    return 'icrc3';
  } catch {}

  // Probe get_transactions
  try {
    const actor = Actor.createActor(
      ({ IDL }: any) =>
        IDL.Service({
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
        }),
      { agent, canisterId: target }
    );
    await (actor as any).get_transactions({ start: 0n, length: 0n });
    return 'get_transactions';
  } catch {}

  // Probe query_blocks
  try {
    const actor = Actor.createActor(
      ({ IDL }: any) =>
        IDL.Service({
          query_blocks: IDL.Func(
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
        }),
      { agent, canisterId: target }
    );
    await (actor as any).query_blocks({ start: 0n, length: 0n });
    return 'query_blocks';
  } catch {}

  // Probe archives
  try {
    const actor = Actor.createActor(
      ({ IDL }: any) =>
        IDL.Service({
          archives: IDL.Func(
            [],
            [
              IDL.Vec(
                IDL.Record({
                  canister_id: IDL.Principal,
                  start: IDL.Nat,
                  end: IDL.Nat,
                })
              ),
            ],
            ['query']
          ),
        }),
      { agent, canisterId: target }
    );
    await (actor as any).archives();
    return 'archives';
  } catch {}

  return null;
}
