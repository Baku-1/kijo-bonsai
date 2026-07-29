// seed-tree — POST
// Plants a new seed for a wallet. Creates the trees row and, for spirit-bound
// trees, creates starter consumable records (quantity=0; player must purchase).
//
// Caller must supply a valid Supabase JWT; wallet_row_id is verified against
// the JWT's identity before any DB write.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Consumable types issued to spirit-bound trees at creation (quantity=0).
// Player must purchase quantity before spending.
const STARTER_CONSUMABLE_TYPES = ['shears', 'wire', 'fertilizer'];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  // -------------------------------------------------------------------------
  // 0. JWT verification — confirm caller owns the wallet_row_id they claim
  // -------------------------------------------------------------------------
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return json({ error: 'Missing authorization' }, 401);

  // Use anon client to validate JWT against Supabase auth (not service role)
  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  );

  const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
  if (authErr || !user) return json({ error: 'Invalid or expired token' }, 401);

  // Service-role client for all DB operations
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let body: {
    wallet_row_id: string;
    seed: number;
    species: 'hardwood' | 'evergreen' | 'tropical';
    has_spirit: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON' }, 400);
  }

  const { wallet_row_id, seed, species, has_spirit } = body;

  // has_spirit must be explicitly boolean (not undefined/null)
  if (typeof has_spirit !== 'boolean') {
    return json({ error: 'has_spirit required' }, 400);
  }

  if (!wallet_row_id || seed == null || !species) {
    return json({ error: 'missing wallet_row_id, seed, or species' }, 400);
  }

  // Verify the JWT's wallet identity matches the claimed wallet_row_id
  const jwtWalletRowId = user.user_metadata?.wallet_row_id ?? user.id;
  if (jwtWalletRowId !== wallet_row_id) {
    return json({ error: 'Forbidden' }, 403);
  }

  const validSpecies = ['hardwood', 'evergreen', 'tropical'];
  if (!validSpecies.includes(species)) {
    return json({ error: `invalid species; must be one of: ${validSpecies.join(', ')}` }, 400);
  }

  // -------------------------------------------------------------------------
  // 1. Verify wallet exists
  // -------------------------------------------------------------------------
  const { data: wallet, error: walletErr } = await serviceClient
    .from('wallets')
    .select('id')
    .eq('id', wallet_row_id)
    .single();

  if (walletErr || !wallet) {
    return json({ error: 'wallet not found' }, 404);
  }

  // -------------------------------------------------------------------------
  // 2. Insert into trees
  // -------------------------------------------------------------------------
  const now = new Date().toISOString();
  const { data: newTree, error: treeErr } = await serviceClient
    .from('trees')
    .insert({
      wallet_id: wallet_row_id,
      seed,
      species,
      has_spirit,
      born_at: now,
      current_day: 0,
      last_ticked_at: now,
    })
    .select('id')
    .single();

  if (treeErr || !newTree) {
    return json({ error: treeErr?.message ?? 'failed to create tree' }, 500);
  }

  const tree_id: string = newTree.id as string;

  // -------------------------------------------------------------------------
  // 3. If has_spirit: create starter consumable records (quantity=0 each)
  //    Guest trees (has_spirit=false) skip this — no consumables tracked.
  // -------------------------------------------------------------------------
  if (has_spirit) {
    const consumableRows = STARTER_CONSUMABLE_TYPES.map((type) => ({
      tree_id,
      type,
      quantity: 0,
    }));

    const { error: consumableErr } = await serviceClient
      .from('consumables')
      .insert(consumableRows);

    if (consumableErr) {
      // Best-effort cleanup of the orphaned tree row, then surface the error.
      await serviceClient.from('trees').delete().eq('id', tree_id);
      return json({ error: consumableErr.message }, 500);
    }
  }

  return json({ ok: true, tree_id });
});
