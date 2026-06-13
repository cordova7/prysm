import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const VISIT_ROW_ID = 1;
const VISIT_REFRESH_MS = 60 * 1000;

export async function POST(request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, error: 'Supabase admin not configured' },
        { status: 500 }
      );
    }

    const now = new Date();
    const nowIso = now.toISOString();

    const { data: visitRow } = await supabaseAdmin
      .from('site_visits')
      .select('last_seen')
      .eq('id', VISIT_ROW_ID)
      .maybeSingle();

    const lastSeen = visitRow?.last_seen ? new Date(visitRow.last_seen).getTime() : 0;
    const shouldRefresh = !lastSeen || now.getTime() - lastSeen > VISIT_REFRESH_MS;

    await supabaseAdmin
      .from('site_visits')
      .upsert({ id: VISIT_ROW_ID, last_seen: nowIso }, { onConflict: 'id' });

    if (shouldRefresh) {
      const seedUrl = new URL('/api/seed-registry/supabase', request.url);
      fetch(seedUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed' }),
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, refreshed: shouldRefresh }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
