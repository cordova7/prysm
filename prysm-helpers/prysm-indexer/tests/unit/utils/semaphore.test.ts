import { describe, it, expect } from '@jest/globals';
import { Semaphore } from '../../../src/utils/semaphore.js';

describe('Semaphore', () => {
  it('should allow up to N concurrent operations', async () => {
    const semaphore = new Semaphore(2);
    let activeCount = 0;
    let maxActiveCount = 0;

    const operations = Array.from({ length: 5 }, () =>
      semaphore.execute(async () => {
        activeCount++;
        maxActiveCount = Math.max(maxActiveCount, activeCount);

        await new Promise((resolve) => setTimeout(resolve, 10));

        activeCount--;
      })
    );

    await Promise.all(operations);

    expect(maxActiveCount).toBe(2);
  });

  it('should queue operations when permits are exhausted', async () => {
    const semaphore = new Semaphore(1);
    const results: number[] = [];

    const operations = [
      semaphore.execute(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        results.push(1);
      }),
      semaphore.execute(async () => {
        results.push(2);
      }),
    ];

    await Promise.all(operations);

    expect(results).toEqual([1, 2]);
  });

  it('should return correct available permits', () => {
    const semaphore = new Semaphore(3);
    expect(semaphore.availablePermits()).toBe(3);
  });
});
