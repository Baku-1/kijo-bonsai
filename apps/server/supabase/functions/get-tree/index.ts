// get-tree — GET ?tree_id=<uuid>
// Returns raw tree state (seed, species, current_day, care_log as JSON array).
//
// Stats computation (CareLogReplay, Voxelizer, StatDeriver) happens client-side
// using @kijo/engine, @kijo/voxelizer, @kijo/shared from the npm workspace.
//
// WHY: Engine packages are not published to npm and have no publishConfig.
// The import_map.json relative paths (../../../../packages/*/dist/index.js) do
// not survive Supabase Edge Function deployment — the Deno runtime has no access
// to the local monorepo. Moving reconstruction client-side is the correct fix;
// the client already has all engine packages via the workspace.
//
// get-tree is intentionally unauthenticated — public game data per PRD (the
// marketplace must be able to read any tree without requiring auth).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405);

  const url = new URL(req.url);
  const tree_id = url.searchParams.get('tree_id');
  if (!tree_id) return json({ error: 'missing tree_id query param' }, 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  );

  // -------------------------------------------------------------------------
  // 1. Load tree row
  // -------------------------------------------------------------------------
  const { data: tree, error: treeErr } = await supabase
    .from('trees')
    .select('id, seed, species, has_spirit, current_day, born_at')
    .eq('id', tree_id)
    .single();

  if (treeErr || !tree) {
    return json({ error: 'tree not found' }, 404);
  }

  // -------------------------------------------------------------------------
  // 2. Load care_log_entries ordered by game_day, sequence
  // -------------------------------------------------------------------------
  const { data: logRows, error: logErr } = await supabase
    .from('care_log_entries')
    .select('game_day, sequence, action_type, action_data')
    .eq('tree_id', tree_id)
    .order('game_day', { ascending: true })
    .order('sequence', { ascending: true });

  if (logErr) return json({ error: logErr.message }, 500);

  // -------------------------------------------------------------------------
  // 3. Return raw tree state + care log for client-side reconstruction.
  //    Client uses CareLogReplay.reconstruct() + Voxelizer.voxelize() +
  //    StatDeriver.derive() from the @kijo/engine / @kijo/voxelizer workspace
  //    packages. Tick rows are included in the log so the client can
  //    determine totalDays independently.
  // -------------------------------------------------------------------------
  return json({
    tree_id,
    seed: tree.seed,
    species: tree.species,
    current_day: tree.current_day,
    has_spirit: tree.has_spirit,
    born_at: tree.born_at,
    care_log: logRows ?? [],
  });
});
