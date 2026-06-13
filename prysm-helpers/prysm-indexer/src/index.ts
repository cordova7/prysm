#!/usr/bin/env node

import { createCLI } from './scheduler/index.js';
import { loadConfig, printConfigSummary } from './config/index.js';
import { createICAgent } from './ic/agent.js';
import { IndexerDatabase } from './supabase/client.js';
import { RosettaHttpClient } from './rosetta/client.js';
import { runBackfill } from './scheduler/backfill.js';
import { runDaily, runIncremental } from './scheduler/incremental.js';

/**
 * Main entry point for PRYSM Token Indexer
 */
async function main() {
  if (process.argv.length <= 2) {
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

    if (config.indexerRunMode === 'backfill') {
      await runBackfill(agent, db, rosetta, config);
      return;
    }

    if (config.indexerRunMode === 'incremental') {
      await runIncremental(agent, db, rosetta, config);
      return;
    }

    await runDaily(agent, db, rosetta, config);
    return;
  }

  const program = await createCLI();
  await program.parseAsync(process.argv);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
