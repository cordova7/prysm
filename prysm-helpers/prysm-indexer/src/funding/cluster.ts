import crypto from 'crypto';
import { IndexerDatabase } from '../supabase/client.js';
import { logger } from '../utils/logger.js';
import type { WalletCluster, WalletClusterMember } from '../supabase/types.js';
import type { FundingTrace } from './trace.js';

/**
 * Cluster wallets by terminal funders
 */
export async function clusterWallets(
  traces: Map<string, FundingTrace>,
  db: IndexerDatabase,
  principalAccountIds: Map<string, string>
): Promise<void> {
  logger.info(`Clustering ${traces.size} wallets`);

  const clusters = new Map<string, WalletCluster>();
  const members: WalletClusterMember[] = [];

  for (const [principalText, trace] of traces.entries()) {
    // Determine terminal funder
    const terminalFunder = trace.funder;

    // Generate deterministic cluster ID
    const clusterId = generateClusterId(terminalFunder);

    // Create cluster if not exists
    if (!clusters.has(clusterId)) {
      const label = determineLabel(trace);
      const colorIndex = generateColorIndex(clusterId);

      clusters.set(clusterId, {
        cluster_id: clusterId,
        terminal_funder_account_id: terminalFunder,
        label,
        color_index: colorIndex,
        heuristic_reason: trace.isCEX
          ? { type: 'CEX', reason: trace.reason }
          : trace.depth === 0
          ? { type: 'root', reason: 'No inbound transactions' }
          : { type: 'unknown', reason: `Depth: ${trace.depth}` },
      });
    }

    // Add member
    // Note: We need to map account ID back to principal for later use
    // For now, we'll use the principal directly
    const walletAccountId = principalAccountIds.get(principalText);

    if (!walletAccountId) {
      logger.warn(`Missing account ID for ${principalText}, skipping cluster member`);
      continue;
    }

    members.push({
      cluster_id: clusterId,
      wallet_account_id: walletAccountId,
      owner_principal: principalText,
    });
  }

  logger.info(`Created ${clusters.size} clusters`);

  // Batch upsert clusters and members
  await db.upsertClusters(Array.from(clusters.values()));
  await db.upsertClusterMembers(members);

  logger.info(`Clustering complete`);
}

/**
 * Generate deterministic cluster ID from terminal funder
 */
export function generateClusterId(terminalFunder: string): string {
  return crypto
    .createHash('sha256')
    .update(terminalFunder)
    .digest('hex')
    .substring(0, 16);
}

/**
 * Determine cluster label based on trace
 */
function determineLabel(trace: FundingTrace): 'CEX' | 'root' | 'unknown' {
  if (trace.isCEX) {
    return 'CEX';
  }

  if (trace.depth === 0) {
    return 'root';
  }

  return 'unknown';
}

/**
 * Generate color index (0-15) for frontend palette
 */
function generateColorIndex(clusterId: string): number {
  const hash = crypto.createHash('sha256').update(clusterId).digest();
  return hash[0] % 16;
}
