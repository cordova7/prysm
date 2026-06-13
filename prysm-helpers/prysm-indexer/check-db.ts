import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkDatabase() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('='.repeat(60));
  console.log('DATABASE DIAGNOSTIC CHECK');
  console.log('='.repeat(60));
  console.log('');

  // 1. Check if v_token_top_holders view exists
  console.log('1. Checking if v_token_top_holders view exists...');
  try {
    const { data, error } = await supabase
      .from('v_token_top_holders')
      .select('token_canister_id')
      .limit(1);

    if (error) {
      console.log('❌ View does NOT exist or there is a permission issue');
      console.log(`   Error: ${error.message}`);
      console.log('   → You need to apply the schema: psql -h <host> -U postgres -d postgres -f schema.sql');
    } else {
      console.log('✅ View exists');
    }
  } catch (err: any) {
    console.log('❌ Error checking view:', err.message);
  }
  console.log('');

  // 2. Check token_holder_snapshots table
  console.log('2. Checking token_holder_snapshots table...');
  try {
    const { data, error, count } = await supabase
      .from('token_holder_snapshots')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log('❌ Error querying table:', error.message);
    } else {
      console.log(`✅ Table exists with ${count} snapshots`);
      if (count === 0) {
        console.log('   → No snapshots found. You need to run the indexer.');
      }
    }
  } catch (err: any) {
    console.log('❌ Error:', err.message);
  }
  console.log('');

  // 3. Check which tokens have snapshots
  console.log('3. Checking which tokens have snapshot data...');
  try {
    const { data, error } = await supabase
      .from('token_holder_snapshots')
      .select('token_canister_id, snapshot_at')
      .order('snapshot_at', { ascending: false })
      .limit(10);

    if (error) {
      console.log('❌ Error:', error.message);
    } else if (!data || data.length === 0) {
      console.log('❌ No snapshot data found');
      console.log('   → Run the indexer: npm run index backfill --token <token-id>');
    } else {
      console.log('✅ Found snapshots for the following tokens:');
      const tokenMap = new Map<string, string>();
      data.forEach((row) => {
        if (!tokenMap.has(row.token_canister_id)) {
          tokenMap.set(row.token_canister_id, row.snapshot_at);
        }
      });
      tokenMap.forEach((snapshot_at, token_id) => {
        console.log(`   - ${token_id} (last snapshot: ${snapshot_at})`);
      });
    }
  } catch (err: any) {
    console.log('❌ Error:', err.message);
  }
  console.log('');

  // 4. Check tokens table
  console.log('4. Checking tokens table...');
  try {
    const { data, error, count } = await supabase
      .from('tokens')
      .select('token_ledger_id, name, symbol', { count: 'exact' })
      .limit(5);

    if (error) {
      console.log('❌ Error:', error.message);
    } else {
      console.log(`✅ Found ${count} tokens in the database`);
      if (data && data.length > 0) {
        console.log('   Sample tokens:');
        data.forEach((token) => {
          console.log(`   - ${token.token_ledger_id} (${token.symbol || 'unknown'})`);
        });
      }
    }
  } catch (err: any) {
    console.log('❌ Error:', err.message);
  }
  console.log('');

  // 5. Check if view returns data
  console.log('5. Checking if v_token_top_holders view returns data...');
  try {
    const { data, error } = await supabase
      .from('v_token_top_holders')
      .select('token_canister_id, owner_principal, percent_bps')
      .limit(5);

    if (error) {
      console.log('❌ Error:', error.message);
    } else if (!data || data.length === 0) {
      console.log('❌ View returns no data');
      console.log('   → This means token_holder_snapshots is empty');
      console.log('   → Run the indexer to populate data');
    } else {
      console.log('✅ View returns data!');
      console.log(`   Found ${data.length} holders (showing first 5)`);
      data.forEach((holder, i) => {
        console.log(`   ${i + 1}. ${holder.owner_principal} - ${holder.percent_bps / 100}% of ${holder.token_canister_id}`);
      });
    }
  } catch (err: any) {
    console.log('❌ Error:', err.message);
  }
  console.log('');

  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log('');
  console.log('If the view does NOT exist:');
  console.log('  → Apply schema: psql -h <host> -U postgres -d postgres -f schema.sql');
  console.log('');
  console.log('If there is NO snapshot data:');
  console.log('  → Run indexer: npm run index backfill --token <token-id>');
  console.log('');
  console.log('If everything looks good but UI still shows no data:');
  console.log('  → Check browser console for errors');
  console.log('  → Verify the API endpoint works: /api/token-holders/<token-id>');
  console.log('  → Clear session storage cache');
  console.log('');
}

checkDatabase().catch(console.error);
