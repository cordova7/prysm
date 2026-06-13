import { HttpAgent } from '@dfinity/agent';
import { logger } from '../utils/logger.js';

/**
 * Create IC HTTP agent with configured host
 */
export async function createICAgent(icHost: string): Promise<HttpAgent> {
  logger.info(`Creating IC agent with host: ${icHost}`);

  const agent = new HttpAgent({ host: icHost });

  // Fetch root key only if not mainnet
  if (!isMainnet(icHost)) {
    logger.warn('Fetching root key for non-mainnet environment');
    await agent.fetchRootKey();
  }

  return agent;
}

/**
 * Check if IC host is mainnet
 */
function isMainnet(icHost: string): boolean {
  const mainnetHosts = ['https://ic0.app', 'https://icp0.io', 'https://icp-api.io'];
  return mainnetHosts.some((host) => icHost.startsWith(host));
}
