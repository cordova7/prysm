import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { fetchICCanisterId } from '@/lib/ic-id-fetcher'

export async function POST() {
  try {
    console.log('Testing single token seed...')

    // Test with one real token
    const testToken = {
      token_ledger_id: 'ryjl3-tyaaa-aaaaa-aaaba-cai',
      tokenName: 'Internet Computer',
      tokenSymbol: 'ICP',
      price: '100',
      volumeUSD24H: '1000000',
      priceChange24H: '5',
      tvlUSD: '5000000'
    }

    console.log('Fetching IC ID for:', testToken.token_ledger_id)
    const icData = await fetchICCanisterId(testToken.token_ledger_id)
    console.log('IC API returned:', JSON.stringify(icData))

    const tokenToSave = {
      token_ledger_id: testToken.token_ledger_id,
      ic_id: icData.id,
      controllers: icData.controllers || [],
      name: testToken.tokenName,
      symbol: testToken.tokenSymbol,
      price: parseFloat(testToken.price),
      volume_24h: parseFloat(testToken.volumeUSD24H),
      price_change_24h: parseFloat(testToken.priceChange24H),
      liquidity: parseFloat(testToken.tvlUSD)
    }

    console.log('Saving token:', JSON.stringify(tokenToSave, null, 2))

    const { data, error } = await supabaseAdmin
      .from('tokens')
      .insert(tokenToSave)
      .select()

    if (error) {
      console.error('Insert error:', error)
      return NextResponse.json({ success: false, error: error.message, details: error }, { status: 500 })
    }

    console.log('✅ Insert successful:', data)

    // Clean up
    await supabaseAdmin.from('tokens').delete().eq('token_ledger_id', testToken.token_ledger_id)

    return NextResponse.json({ success: true, data: data[0] }, { status: 200 })

  } catch (error) {
    console.error('Exception:', error)
    return NextResponse.json({ success: false, error: error.message, stack: error.stack }, { status: 500 })
  }
}
