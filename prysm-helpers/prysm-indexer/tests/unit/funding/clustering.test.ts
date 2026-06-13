import { describe, it, expect } from '@jest/globals';
import { generateClusterId } from '../../../src/funding/cluster.js';

describe('Wallet Clustering', () => {
  describe('generateClusterId', () => {
    it('should generate deterministic cluster IDs', () => {
      const terminalFunder = 'test-account-id-123';

      const id1 = generateClusterId(terminalFunder);
      const id2 = generateClusterId(terminalFunder);

      expect(id1).toBe(id2);
      expect(id1).toHaveLength(16);
    });

    it('should generate different IDs for different funders', () => {
      const funder1 = 'account-1';
      const funder2 = 'account-2';

      const id1 = generateClusterId(funder1);
      const id2 = generateClusterId(funder2);

      expect(id1).not.toBe(id2);
    });

    it('should generate valid hex strings', () => {
      const terminalFunder = 'test-account';
      const id = generateClusterId(terminalFunder);

      expect(id).toMatch(/^[0-9a-f]{16}$/);
    });
  });
});
