// care-action — POST
// Validates a care action, optionally advances game days (lazy tick), appends
// to care_log_entries, and decrements the relevant consumable.
//
// Uses a service-role client for all DB writes (bypasses RLS).
// Uses an anon client solely to verify the caller's JWT via auth.getUser().

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Which consumable each action type spends (undefined = no consumable needed)
const CONSUMABLE: Record<string, string | undefined> = {
  prune: 'shears',
  wire: 'wire',
  fertilize: 'fertilizer',
};

// Maximum game-days to advance in a single lazy-tick sweep.
// Capped to prevent an Edge Function timeout mid-loop from leaving the tree in
// a partially-advanced state (some tick entries written but current_day not yet
// updated). A user inactive for longer than MAX_LAZY_TICKS days simply stops
// catching up beyond this threshold on any single invocation.
const MAX_LAZY_TICKS = 90;

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

  let body: { tree_id: string; wallet_row_id: string; action: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON' }, 400);
  }

  const { tree_id, wallet_row_id, action } = body;
  if (!tree_id || !wallet_row_id || !action?.type) {
    return json({ error: 'missing tree_id, wallet_row_id, or action.type' }, 400);
  }

  // Verify the JWT's wallet identity matches the claimed wallet_row_id
  const jwtWalletRowId = user.user_metadata?.wallet_row_id ?? user.id;
  if (jwtWalletRowId !== wallet_row_id) {
    return json({ error: 'Forbidden' }, 403);
  }

  // -------------------------------------------------------------------------
  // 1. Ownership check
  // -------------------------------------------------------------------------
  const { data: tree, error: treeErr } = await serviceClient
    .from('trees')
    .select('id, wallet_id, current_day, last_ticked_at, born_at')
    .eq('id', tree_id)
    .eq('wallet_id', wallet_row_id)
    .single();

  if (treeErr || !tree) {
    return json({ error: 'tree not found or does not belong to wallet' }, 404);
  }

  // -------------------------------------------------------------------------
  // 1b. Whitelist check — must precede any DB mutation
  // -------------------------------------------------------------------------
  // Prevents clients from injecting fake server-generated types (e.g. 'tick').
  const actionType = action.type as string;
  const ALLOWED_ACTION_TYPES = new Set(['water', 'prune', 'wire', 'fertilize', 'rotate']);
  if (!ALLOWED_ACTION_TYPES.has(actionType)) {
    return json({ error: 'Invalid action type' }, 400);
  }

  // -------------------------------------------------------------------------
  // 2. Lazy tick — how many 8-hour game days have elapsed since last tick?
  // -------------------------------------------------------------------------
  const now = Date.now();
  // Null guard: fall back to born_at if last_ticked_at is missing
  const lastTickedStr =
    (tree.last_ticked_at as string | null) ??
    (tree.born_at as string | null) ??
    new Date().toISOString();
  const lastTicked = new Date(lastTickedStr).getTime();
  const elapsedDays = Math.floor((now - lastTicked) / (8 * 60 * 60 * 1000));
  const cappedDays = Math.min(elapsedDays, MAX_LAZY_TICKS);

  let currentDay: number = tree.current_day as number;

  // -------------------------------------------------------------------------
  // 3. Insert tick entries and advance current_day if needed.
  //    insert_care_log_entry assigns the next sequence atomically (single SQL
  //    statement), eliminating the race with any concurrent player action on
  //    the same (tree_id, game_day).
  // -------------------------------------------------------------------------
  if (cappedDays > 0) {
    for (let i = 0; i < cappedDays; i++) {
      const { error: tickErr } = await serviceClient.rpc('insert_care_log_entry', {
        p_tree_id:     tree_id,
        p_game_day:    currentDay + i,
        p_action_type: 'tick',
        p_action_data: {},
      });
      if (tickErr) return json({ error: tickErr.message }, 500);
    }

    currentDay += cappedDays;

    const { error: treeUpdateErr } = await serviceClient
      .from('trees')
      .update({
        current_day: currentDay,
        last_ticked_at: new Date(now).toISOString(),
      })
      .eq('id', tree_id)
      .eq('wallet_id', wallet_row_id);
    if (treeUpdateErr) return json({ error: treeUpdateErr.message }, 500);
  }

  // -------------------------------------------------------------------------
  // 4. Consumable check (prune -> shears, wire -> wire, fertilize -> fertilizer)
  // -------------------------------------------------------------------------
  const consumableType = CONSUMABLE[actionType];
  let consumableRow: { id: string; quantity: number } | null = null;

  if (consumableType !== undefined) {
    const { data: c, error: cErr } = await serviceClient
      .from('consumables')
      .select('id, quantity')
      .eq('wallet_id', wallet_row_id)
      .eq('item_type', consumableType)
      .single();

    if (cErr || !c) {
      return json({ error: `consumable '${consumableType}' record not found` }, 400);
    }
    if ((c.quantity as number) <= 0) {
      return json({ error: `not enough '${consumableType}' (quantity is 0)` }, 400);
    }
    consumableRow = c as { id: string; quantity: number };
  }

  // Separate type from the rest of action fields (which become action_data)
  const { type: _type, ...actionData } = action;

  // -------------------------------------------------------------------------
  // 5. Atomically insert care action with next sequence number.
  //    COALESCE(MAX(sequence), -1) + 1 runs inside a single SQL INSERT…SELECT —
  //    no separate read round-trip, no race window for duplicate sequences.
  // -------------------------------------------------------------------------
  const { error: insertErr } = await serviceClient.rpc('insert_care_log_entry', {
    p_tree_id:     tree_id,
    p_game_day:    currentDay,
    p_action_type: actionType,
    p_action_data: actionData,
  });
  if (insertErr) return json({ error: insertErr.message }, 500);

  // -------------------------------------------------------------------------
  // 6. Atomic consumable decrement via RPC.
  //    quantity = quantity - 1 is evaluated server-side; prevents double-spend
  //    race where two requests both read quantity > 1 and both write quantity - 1.
  //    Returns the updated row if quantity > 0; empty if already consumed.
  // -------------------------------------------------------------------------
  if (consumableRow !== null) {
    const { data: decremented, error: decrErr } = await serviceClient
      .rpc('decrement_consumable', {
        p_consumable_id: consumableRow.id,
        p_wallet_id:     wallet_row_id,
      });
    if (decrErr) return json({ error: decrErr.message }, 500);
    if (!decremented || decremented.length === 0) {
      return json({ error: 'Consumable already consumed or insufficient quantity' }, 409);
    }
  }

  return json({ ok: true, current_day: currentDay, elapsed_days: elapsedDays });
});
