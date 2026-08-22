// apps/server/supabase/functions/get-tree-public/index.ts
// Public tree data endpoint for the animation_url viewer.
// verify_jwt: false -- this endpoint is intentionally unauthenticated.
//   Security: returns only public-safe fields; wallet_id and private data excluded.
//   Reads by token_id (query param) -- the public NFT identifier.
//
// LANDSCAPE FILTER: care_log_entries with action_type === 'landscape' are removed
// server-side before returning. CareLogReplay.reconstruct() throws CareLogReplayError
// on landscape entries (Phase 1 limit, DECISIONS.md 2026-08-22). Any unfiltered
// landscape entry reaching the viewer would crash it for affected trees.
//
// OQ-P1 resolved by Jeremy 2026-08-22: new endpoint, verify_jwt=false, by tokenId.

import { createClient } from 'jsr:@supabase/supabase-js@2';

// verify_jwt: false is set in the Supabase deploy config, not in the code.
// This comment documents the intent; the actual flag is in supabase/config.toml
// or passed via `supabase functions deploy --no-verify-jwt`.

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url      = new URL(req.url);
    const tokenId  = url.searchParams.get('tokenId');

    if (!tokenId || isNaN(Number(tokenId))) {
      return new Response(
        JSON.stringify({ error: 'tokenId query param required (integer)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const tokenIdNum = Number(tokenId);

    // Use service role client -- needs to bypass RLS to read tree data
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    // 1. Fetch the tree row by token_id (public NFT identifier)
    //    Exclude wallet_id and any other private fields explicitly.
    const { data: tree, error: treeErr } = await supabase
      .from('trees')
      .select('id, token_id, seed, species, current_day, health, born_at')
      .eq('token_id', tokenIdNum)
      .single();

    if (treeErr) {
      if (treeErr.code === 'PGRST116') {
        return new Response(
          JSON.stringify({ error: `Tree not found for tokenId ${tokenIdNum}` }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      throw new Error(`Tree fetch failed: ${treeErr.message}`);
    }

    // 2. Fetch care log entries, filtered server-side:
    //    - Exclude 'landscape': CareLogReplay.reconstruct() throws on landscape entries
    //    - Exclude 'tick': server-internal; never a valid user action
    const { data: logRows, error: logErr } = await supabase
      .from('care_log_entries')
      .select('game_day, sequence, action_type, action_data')
      .eq('tree_id', tree.id)
      .not('action_type', 'in', '("landscape","tick")')
      .order('game_day',  { ascending: true })
      .order('sequence',  { ascending: true });

    if (logErr) {
      throw new Error(`Care log fetch failed: ${logErr.message}`);
    }

    // 3. Return public-safe tree data
    //    wallet_id is intentionally excluded (private ownership data).
    //    health defaults to 100 if absent from schema (defensive).
    const response = {
      token_id:          tree.token_id,
      seed:              tree.seed,
      species:           tree.species,
      current_day:       tree.current_day,
      health:            tree.health ?? 100,
      born_at:           tree.born_at,
      care_log_entries:  (logRows ?? []).map((r: {
        game_day: number;
        sequence: number;
        action_type: string;
        action_data: Record<string, unknown>;
      }) => ({
        day:    r.game_day,
        action: { type: r.action_type, ...r.action_data },
      })),
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    console.error('[get-tree-public] error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
