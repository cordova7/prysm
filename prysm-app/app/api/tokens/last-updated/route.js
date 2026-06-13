import { NextResponse } from 'next/server'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Supabase not configured. Please check environment variables.' },
        { status: 500 }
      )
    }

    const { data, error } = await supabase
      .from('tokens')
      .select('last_updated')
      .order('last_updated', { ascending: false })
      .limit(1)

    if (error) {
      return NextResponse.json(
        { error: 'Database query failed', details: error.message },
        { status: 500 }
      )
    }

    const lastUpdated = Array.isArray(data) && data.length > 0 ? data[0]?.last_updated : null

    return NextResponse.json(
      { lastUpdated, timestamp: new Date().toISOString() },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}

