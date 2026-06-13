/**
 * Simple logger utility with levels and timestamps
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private level: LogLevel = LogLevel.INFO;

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.log(`[${this.timestamp()}] [DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.log(`[${this.timestamp()}] [INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[${this.timestamp()}] [WARN] ${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(`[${this.timestamp()}] [ERROR] ${message}`, ...args);
    }
  }

  private timestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Log progress for long-running operations
   */
  progress(message: string, current: number, total: number): void {
    const percent = ((current / total) * 100).toFixed(1);
    this.info(`${message} [${current}/${total}] (${percent}%)`);
  }

  /**
   * Log a separator line for visual grouping
   */
  separator(): void {
    console.log('='.repeat(80));
  }
}

// Export singleton instance
export const logger = new Logger();
