import { HttpAgent, Actor } from '@dfinity/agent';
import { IDL } from '@dfinity/candid';
import { supabase, supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ICP_LEDGER_ID = 'ryjl3-tyaaa-aaaaa-aaaba-cai';
const ICP_LOGO_PATH = '/icp-logo.png';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
};

// ICRC-1 Metadata IDL Factory
const idlFactory = ({ IDL: IDLParam }) => {
  const MetadataValue = IDLParam.Variant({
    Nat: IDLParam.Nat,
    Int: IDLParam.Int,
    Text: IDLParam.Text,
    Blob: IDLParam.Vec(IDLParam.Nat8),
  });

  const MetadataEntry = IDLParam.Tuple(IDLParam.Text, MetadataValue);

  return IDLParam.Service({
    icrc1_metadata: IDLParam.Func([], [IDLParam.Vec(MetadataEntry)], ['query']),
  });
};

async function fetchLogoFromIC(canisterId) {
  const agent = new HttpAgent({ host: 'https://ic0.app' });
  const actor = Actor.createActor(idlFactory, {
    agent,
    canisterId,
  });

  const metadata = await Promise.race([
    actor.icrc1_metadata(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000)),
  ]);

  const logoEntry = metadata.find(([key]) => key.toLowerCase().includes('logo'));
  if (!logoEntry) {
    return null;
  }

  const [, value] = logoEntry;
  const logoValue = value?.Text;
  if (!logoValue || !logoValue.trim()) {
    return null;
  }

  return logoValue;
}

export async function GET(request, { params }) {
  const tokenId = params.tokenId;

  try {
    if (!isSupabaseConfigured()) {
      return new Response(
        JSON.stringify({ error: 'Supabase not configured' }),
        { status: 500, headers: CACHE_HEADERS }
      );
    }

    if (tokenId === ICP_LEDGER_ID) {
      return new Response(
        JSON.stringify({ tokenId, logo: ICP_LOGO_PATH, cached: true }),
        { status: 200, headers: CACHE_HEADERS }
      );
    }

    // Check cache first
    const { data: cachedData } = await supabase
      .from('token_logos')
      .select('logo_url, expires_at')
      .eq('token_ledger_id', tokenId)
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .maybeSingle();

    if (cachedData?.logo_url) {
      return new Response(
        JSON.stringify({
          tokenId,
          logo: cachedData.logo_url,
          cached: true,
          timestamp: new Date().toISOString(),
        }),
        { status: 200, headers: CACHE_HEADERS }
      );
    }

    const logo = await fetchLogoFromIC(tokenId);

    if (logo && supabaseAdmin) {
      const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();
      await supabaseAdmin
        .from('token_logos')
        .upsert(
          {
            token_ledger_id: tokenId,
            logo_url: logo,
            expires_at: expiresAt,
          },
          { onConflict: 'token_ledger_id' }
        );
    }

    return new Response(
      JSON.stringify({
        tokenId,
        logo: logo || null,
        cached: false,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: CACHE_HEADERS }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        tokenId,
        logo: null,
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: CACHE_HEADERS }
    );
  }
}
