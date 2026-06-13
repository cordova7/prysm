/**
 * GET /api/comments/[tokenId]
 * Fetch comments for a specific token
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(
  request: NextRequest,
  { params }: { params: { tokenId: string } }
) {
  try {
    const tokenId = params.tokenId;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Fetch comments from database
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('token_ledger_id', tokenId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch comments' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      comments: data || [],
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=30, s-maxage=120, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('Comment fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
