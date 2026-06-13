/**
 * Semaphore for concurrency control
 */
export class Semaphore {
  private permits: number;
  private tasks: Array<() => void> = [];

  constructor(permits: number) {
    if (permits < 1) {
      throw new Error('Semaphore permits must be >= 1');
    }
    this.permits = permits;
  }

  /**
   * Acquire a permit (waits if no permits available)
   */
  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.tasks.push(resolve);
    });
  }

  /**
   * Release a permit (allows next waiting task to proceed)
   */
  release(): void {
    this.permits++;
    const nextTask = this.tasks.shift();
    if (nextTask) {
      this.permits--;
      nextTask();
    }
  }

  /**
   * Execute a function with semaphore protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /**
   * Get current available permits
   */
  availablePermits(): number {
    return this.permits;
  }
}
