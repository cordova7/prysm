import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface IndexerConfig {
  // Required
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  icHost: string;

  // Optional with defaults
  rosettaUrl: string;
  rosettaTimeoutMs: number;
  rosettaMaxRetries: number;
  rosettaRetryDelayMs: number;
  rosettaMaxInFlight: number;
  rosettaMinDelayMs: number;
  rosettaSearchLimit: number;
  rosettaSearchWindowSize: number;
  rosettaSearchMaxPages: number;
  rosettaSearchMaxWindows: number;
  enableFundingTrace: boolean;
  indexerRunMode: 'backfill' | 'incremental' | 'daily';
  maxConcurrencyCanister: number;
  maxConcurrencyHttp: number;
  txPageSizeDefault: number;
  maxTraceDepth: number;
  cexBalanceThreshold: number;
  enableCron: boolean;
  icpswapBaseIndexCanisterId: string;
  icpswapTxPageSize: number;
}

/**
 * Load and validate configuration from environment variables
 */
export function loadConfig(): IndexerConfig {
  // Required environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const icHost = process.env.IC_HOST;

  if (!supabaseUrl) {
    throw new Error('Missing required environment variable: SUPABASE_URL');
  }

  if (!supabaseServiceRoleKey) {
    throw new Error('Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY');
  }

  if (!icHost) {
    throw new Error('Missing required environment variable: IC_HOST');
  }

  // Optional environment variables with defaults
  const rosettaUrl = process.env.ROSETTA_URL || 'http://127.0.0.1:8081';
  const rosettaTimeoutMs = parseInt(process.env.ROSETTA_TIMEOUT_MS || '15000', 10);
  const rosettaMaxRetries = parseInt(process.env.ROSETTA_MAX_RETRIES || '5', 10);
  const rosettaRetryDelayMs = parseInt(process.env.ROSETTA_RETRY_DELAY_MS || '750', 10);
  const rosettaMaxInFlightRaw = parseInt(process.env.ROSETTA_MAX_INFLIGHT || '1', 10);
  const rosettaMaxInFlight = 1;
  const rosettaMinDelayMs = parseInt(process.env.ROSETTA_MIN_DELAY_MS || '250', 10);
  const rosettaSearchLimit = parseInt(process.env.ROSETTA_SEARCH_LIMIT || '20', 10);
  const rosettaSearchWindowSize = parseInt(
    process.env.ROSETTA_SEARCH_WINDOW_SIZE || '2000',
    10
  );
  const rosettaSearchMaxPages = parseInt(
    process.env.ROSETTA_SEARCH_MAX_PAGES || '2',
    10
  );
  const rosettaSearchMaxWindows = parseInt(
    process.env.ROSETTA_SEARCH_MAX_WINDOWS || '10',
    10
  );
  const enableFundingTrace = process.env.ENABLE_FUNDING_TRACE === 'true';
  const indexerRunMode = (process.env.INDEXER_RUN_MODE || 'daily') as 'backfill' | 'incremental' | 'daily';
  const maxConcurrencyCanister = parseInt(process.env.MAX_CONCURRENCY_CANISTER || '5', 10);
  const maxConcurrencyHttp = parseInt(process.env.MAX_CONCURRENCY_HTTP || '10', 10);
  const txPageSizeDefault = parseInt(process.env.TX_PAGE_SIZE_DEFAULT || '1000', 10);
  const maxTraceDepth = parseInt(process.env.MAX_TRACE_DEPTH || '4', 10);
  const cexBalanceThreshold = parseFloat(process.env.CEX_BALANCE_THRESHOLD || '10000.0');
  const enableCron = process.env.ENABLE_CRON === 'true';
  const icpswapBaseIndexCanisterId =
    process.env.ICPSWAP_BASE_INDEX_CANISTER_ID || 'g54jq-hiaaa-aaaag-qck5q-cai';
  const icpswapTxPageSize = parseInt(process.env.ICPSWAP_TX_PAGE_SIZE || '100', 10);

  // Validate numeric values
  if (maxConcurrencyCanister < 1) {
    throw new Error('MAX_CONCURRENCY_CANISTER must be >= 1');
  }

  if (maxConcurrencyHttp < 1) {
    throw new Error('MAX_CONCURRENCY_HTTP must be >= 1');
  }

  if (txPageSizeDefault < 1) {
    throw new Error('TX_PAGE_SIZE_DEFAULT must be >= 1');
  }

  if (rosettaTimeoutMs < 1000) {
    throw new Error('ROSETTA_TIMEOUT_MS must be >= 1000');
  }
  if (rosettaMaxRetries < 0) {
    throw new Error('ROSETTA_MAX_RETRIES must be >= 0');
  }
  if (rosettaRetryDelayMs < 100) {
    throw new Error('ROSETTA_RETRY_DELAY_MS must be >= 100');
  }
  if (rosettaMaxInFlightRaw < 1) {
    throw new Error('ROSETTA_MAX_INFLIGHT must be >= 1');
  }
  if (rosettaMaxInFlightRaw !== 1) {
    console.warn('ROSETTA_MAX_INFLIGHT is forced to 1 to avoid Rosetta crashes.');
  }
  if (rosettaMinDelayMs < 0) {
    throw new Error('ROSETTA_MIN_DELAY_MS must be >= 0');
  }
  if (rosettaSearchLimit < 1) {
    throw new Error('ROSETTA_SEARCH_LIMIT must be >= 1');
  }
  if (rosettaSearchWindowSize < 1) {
    throw new Error('ROSETTA_SEARCH_WINDOW_SIZE must be >= 1');
  }
  if (rosettaSearchMaxPages < 1) {
    throw new Error('ROSETTA_SEARCH_MAX_PAGES must be >= 1');
  }
  if (rosettaSearchMaxWindows < 1) {
    throw new Error('ROSETTA_SEARCH_MAX_WINDOWS must be >= 1');
  }

  if (maxTraceDepth < 1) {
    throw new Error('MAX_TRACE_DEPTH must be >= 1');
  }

  if (cexBalanceThreshold < 0) {
    throw new Error('CEX_BALANCE_THRESHOLD must be >= 0');
  }
  if (icpswapTxPageSize < 1) {
    throw new Error('ICPSWAP_TX_PAGE_SIZE must be >= 1');
  }

  // Validate run mode
  if (!['backfill', 'incremental', 'daily'].includes(indexerRunMode)) {
    throw new Error('INDEXER_RUN_MODE must be one of: backfill, incremental, daily');
  }

  return {
    supabaseUrl,
    supabaseServiceRoleKey,
    icHost,
    rosettaUrl,
    rosettaTimeoutMs,
    rosettaMaxRetries,
    rosettaRetryDelayMs,
    rosettaMaxInFlight,
    rosettaMinDelayMs,
    rosettaSearchLimit,
    rosettaSearchWindowSize,
    rosettaSearchMaxPages,
    rosettaSearchMaxWindows,
    enableFundingTrace,
    indexerRunMode,
    maxConcurrencyCanister,
    maxConcurrencyHttp,
    txPageSizeDefault,
    maxTraceDepth,
    cexBalanceThreshold,
    enableCron,
    icpswapBaseIndexCanisterId,
    icpswapTxPageSize,
  };
}

/**
 * Print configuration summary (redacting secrets)
 */
export function printConfigSummary(config: IndexerConfig): void {
  console.log('\n=== PRYSM Token Indexer Configuration ===');
  console.log(`Supabase URL: ${config.supabaseUrl}`);
  console.log(`Supabase Service Role Key: ${redactSecret(config.supabaseServiceRoleKey)}`);
  console.log(`IC Host: ${config.icHost}`);
  console.log(`Rosetta URL: ${config.rosettaUrl}`);
  console.log(`Rosetta Timeout: ${config.rosettaTimeoutMs} ms`);
  console.log(`Rosetta Max Retries: ${config.rosettaMaxRetries}`);
  console.log(`Rosetta Retry Delay: ${config.rosettaRetryDelayMs} ms`);
  console.log(`Rosetta Max In-Flight: ${config.rosettaMaxInFlight}`);
  console.log(`Rosetta Min Delay: ${config.rosettaMinDelayMs} ms`);
  console.log(`Rosetta Search Limit: ${config.rosettaSearchLimit}`);
  console.log(`Rosetta Search Window Size: ${config.rosettaSearchWindowSize}`);
  console.log(`Rosetta Search Max Pages: ${config.rosettaSearchMaxPages}`);
  console.log(`Rosetta Search Max Windows: ${config.rosettaSearchMaxWindows}`);
  console.log(`Funding Trace Enabled: ${config.enableFundingTrace}`);
  console.log(`Run Mode: ${config.indexerRunMode}`);
  console.log(`Max Concurrency (Canister): ${config.maxConcurrencyCanister}`);
  console.log(`Max Concurrency (HTTP): ${config.maxConcurrencyHttp}`);
  console.log(`Default TX Page Size: ${config.txPageSizeDefault}`);
  console.log(`Max Trace Depth: ${config.maxTraceDepth}`);
  console.log(`CEX Balance Threshold: ${config.cexBalanceThreshold} ICP`);
  console.log(`Cron Enabled: ${config.enableCron}`);
  console.log(`ICPSwap BaseIndex: ${config.icpswapBaseIndexCanisterId}`);
  console.log(`ICPSwap TX Page Size: ${config.icpswapTxPageSize}`);
  console.log('========================================\n');
}

/**
 * Redact secret values for logging
 */
function redactSecret(secret: string): string {
  if (secret.length <= 8) {
    return '***';
  }
  return `${secret.substring(0, 4)}...${secret.substring(secret.length - 4)}`;
}
