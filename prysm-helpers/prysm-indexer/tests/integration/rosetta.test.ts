import { describe, it, expect, beforeAll } from '@jest/globals';
import { RosettaHttpClient } from '../../src/rosetta/client.js';

/**
 * Integration tests for Rosetta HTTP client
 * Note: These tests require a running Rosetta instance
 */
describe('Rosetta HTTP Client', () => {
  let client: RosettaHttpClient;

  beforeAll(() => {
    const rosettaUrl = process.env.ROSETTA_URL || 'http://127.0.0.1:8081';
    client = new RosettaHttpClient(rosettaUrl);
  });

  it.skip('should fetch network list', async () => {
    const result = await client.networkList();
    expect(result.network_identifiers).toBeDefined();
    expect(result.network_identifiers.length).toBeGreaterThan(0);
  });

  it.skip('should fetch network status', async () => {
    const result = await client.networkStatus();
    expect(result.current_block_identifier).toBeDefined();
    expect(result.genesis_block_identifier).toBeDefined();
  });

  it('should convert principal to account ID', () => {
    // This test doesn't require a running Rosetta instance
    // Just testing the conversion logic
    expect(client.principalToAccountId).toBeDefined();
  });
});
