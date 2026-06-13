import { Command } from 'commander';
import { loadConfig, printConfigSummary } from '../config/index.js';
import { createICAgent } from '../ic/agent.js';
import { IndexerDatabase } from '../supabase/client.js';
import { RosettaHttpClient } from '../rosetta/client.js';
import { ingestRosettaBlocks } from '../rosetta/ingest.js';
import { logger } from '../utils/logger.js';
import { syncPools } from './sync-pools.js';
import { runBackfill } from './backfill.js';
import { runDaily, runIncremental } from './incremental.js';

/**
 * CLI Scheduler for token indexer
 */
export async function createCLI(): Promise<Command> {
  const program = new Command();

  program
    .name('prysm-indexer')
    .description('PRYSM Token Indexer - ICP token holder and trading analytics')
    .version('1.0.0');

  // Sync pools command
  program
    .command('sync-pools')
    .description('Sync ICPSwap pools to database (run first)')
    .action(async () => {
      try {
        const config = loadConfig();
        printConfigSummary(config);

        const agent = await createICAgent(config.icHost);
        const db = new IndexerDatabase(config.supabaseUrl, config.supabaseServiceRoleKey);

        await syncPools(agent, db);

        logger.info('Pools synced successfully');
        process.exit(0);
      } catch (error) {
        logger.error(`Sync pools failed: ${error}`);
        process.exit(1);
      }
    });

  // Backfill command
  program
    .command('backfill')
    .description('Backfill token data from genesis')
    .option('-t, --token <canisterId>', 'Index specific token by canister ID')
    .action(async (options) => {
      try {
        const config = loadConfig();
        printConfigSummary(config);

        const agent = await createICAgent(config.icHost);
        const db = new IndexerDatabase(config.supabaseUrl, config.supabaseServiceRoleKey);
        const rosetta = new RosettaHttpClient(
          config.rosettaUrl,
          config.rosettaTimeoutMs,
          config.rosettaMaxRetries,
          config.rosettaRetryDelayMs,
          config.rosettaMaxInFlight,
          config.rosettaMinDelayMs
        );

        await runBackfill(agent, db, rosetta, config, options.token);

        logger.info('Backfill completed successfully');
        process.exit(0);
      } catch (error) {
        logger.error(`Backfill failed: ${error}`);
        process.exit(1);
      }
    });

  // Rosetta block ingestion command
  program
    .command('ingest-blocks')
    .description('Ingest Rosetta blocks into Supabase')
    .option('--start <height>', 'Start block height (overrides stored state)')
    .option('--end <height>', 'End block height (defaults to tip)')
    .option('--bootstrap-lookback <count>', 'Lookback from tip if no state found')
    .option('--state-id <id>', 'Ingestion state id (default: icp_rosetta)')
    .option('--include-raw', 'Store raw block/transaction JSON')
    .action(async (options) => {
      try {
        const config = loadConfig();
        printConfigSummary(config);

        const db = new IndexerDatabase(config.supabaseUrl, config.supabaseServiceRoleKey);
        const rosetta = new RosettaHttpClient(
          config.rosettaUrl,
          config.rosettaTimeoutMs,
          config.rosettaMaxRetries,
          config.rosettaRetryDelayMs,
          config.rosettaMaxInFlight,
          config.rosettaMinDelayMs
        );

        const startBlock = options.start && Number.isFinite(Number(options.start))
          ? Number(options.start)
          : undefined;
        const endBlock = options.end && Number.isFinite(Number(options.end))
          ? Number(options.end)
          : undefined;
        const bootstrapLookback =
          options.bootstrapLookback && Number.isFinite(Number(options.bootstrapLookback))
            ? Number(options.bootstrapLookback)
            : undefined;

        await ingestRosettaBlocks(db, rosetta, {
          startBlock,
          endBlock,
          bootstrapLookback,
          stateId: options.stateId,
          includeRaw: Boolean(options.includeRaw),
        });

        logger.info('Rosetta block ingestion completed successfully');
        process.exit(0);
      } catch (error) {
        logger.error(`Rosetta block ingestion failed: ${error}`);
        process.exit(1);
      }
    });

  // Incremental command
  program
    .command('incremental')
    .description('Process new transactions only')
    .option('-t, --token <canisterId>', 'Index specific token by canister ID')
    .action(async (options) => {
      try {
        const config = loadConfig();
        printConfigSummary(config);

        const agent = await createICAgent(config.icHost);
        const db = new IndexerDatabase(config.supabaseUrl, config.supabaseServiceRoleKey);
        const rosetta = new RosettaHttpClient(
          config.rosettaUrl,
          config.rosettaTimeoutMs,
          config.rosettaMaxRetries,
          config.rosettaRetryDelayMs,
          config.rosettaMaxInFlight,
          config.rosettaMinDelayMs
        );

        await runIncremental(agent, db, rosetta, config, options.token);

        logger.info('Incremental indexing completed successfully');
        process.exit(0);
      } catch (error) {
        logger.error(`Incremental indexing failed: ${error}`);
        process.exit(1);
      }
    });

  // Daily command
  program
    .command('daily')
    .description('Run incremental update + refresh snapshots')
    .option('-t, --token <canisterId>', 'Index specific token by canister ID')
    .action(async (options) => {
      try {
        const config = loadConfig();
        printConfigSummary(config);

        const agent = await createICAgent(config.icHost);
        const db = new IndexerDatabase(config.supabaseUrl, config.supabaseServiceRoleKey);
        const rosetta = new RosettaHttpClient(
          config.rosettaUrl,
          config.rosettaTimeoutMs,
          config.rosettaMaxRetries,
          config.rosettaRetryDelayMs,
          config.rosettaMaxInFlight,
          config.rosettaMinDelayMs
        );

        await runDaily(agent, db, rosetta, config, options.token);

        logger.info('Daily indexing completed successfully');
        process.exit(0);
      } catch (error) {
        logger.error(`Daily indexing failed: ${error}`);
        process.exit(1);
      }
    });

  return program;
}
