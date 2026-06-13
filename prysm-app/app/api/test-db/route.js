import { NextResponse } from 'next/server'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 500 }
      )
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Supabase admin client not configured' },
        { status: 500 }
      )
    }

    // Test single insert
    const testToken = {
      token_ledger_id: 'test-' + Date.now(),
      ic_id: 999999,
      controllers: ['ctrl1', 'ctrl2'],
      symbol: 'TEST',
      name: 'Test Token',
      price: 1.0,
      volume_24h: 100.0,
      liquidity: 1000.0
    }

    const { data, error } = await supabaseAdmin
      .from('tokens')
      .insert(testToken)
      .select()

    if (error) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Insert failed',
          error: error.message,
          details: error
        },
        { status: 500 }
      )
    }

    // Clean up test token
    await supabaseAdmin
      .from('tokens')
      .delete()
      .eq('token_ledger_id', testToken.token_ledger_id)

    return NextResponse.json(
      {
        status: 'success',
        message: 'Database connection working!',
        inserted: data
      },
      { status: 200 }
    )

  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'Exception occurred',
        error: error.message,
        stack: error.stack
      },
      { status: 500 }
    )
  }
}
