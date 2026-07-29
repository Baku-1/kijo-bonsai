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

  let currentDay: number = tree.current_day as number;

  // -------------------------------------------------------------------------
  // 3. Insert tick entries and advance current_day if needed.
  //    Per-day max-sequence query avoids collision with player actions already
  //    recorded for that game_day (e.g. player watered at seq 0 earlier in
  //    the same session, then comes back next day — tick must use seq 1+).
  // -------------------------------------------------------------------------
  if (elapsedDays > 0) {
    for (let i = 0; i < elapsedDays; i++) {
      const gameDay = currentDay + i;

      // Find the highest sequence already used for this (tree_id, game_day)
      const { data: maxSeqRow } = await serviceClient
        .from('care_log_entries')
        .select('sequence')
        .eq('tree_id', tree_id)
        .eq('game_day', gameDay)
        .order('sequence', { ascending: false })
        .limit(1)
        .maybeSingle();

      const tickSeq = ((maxSeqRow?.sequence as number | null) ?? -1) + 1;

      const { error: tickErr } = await serviceClient
        .from('care_log_entries')
        .insert({
          tree_id,
          game_day: gameDay,
          sequence: tickSeq,
          action_type: 'tick',
          action_data: {},
        });

      if (tickErr) return json({ error: tickErr.message }, 500);
    }

    currentDay += elapsedDays;

    const { error: treeUpdateErr } = await serviceClient
      .from('trees')
      .update({
        current_day: currentDay,
        last_ticked_at: new Date(now).toISOString(),
      })
      .eq('id', tree_id);
    if (treeUpdateErr) return json({ error: treeUpdateErr.message }, 500);
  }

  // -------------------------------------------------------------------------
  // 4. Consumable check (prune -> shears, wire -> wire, fertilize -> fertilizer)
  // -------------------------------------------------------------------------
  const actionType = action.type as string;

  // Whitelist: only known player action types may be written to care_log_entries.
  // Prevents clients from injecting fake server-generated types (e.g. 'tick').
  const ALLOWED_ACTION_TYPES = new Set(['water', 'prune', 'wire', 'fertilize']);
  if (!ALLOWED_ACTION_TYPES.has(actionType)) {
    return json({ error: 'Invalid action type' }, 400);
  }

  const consumableType = CONSUMABLE[actionType];
  let consumableRow: { id: string; quantity: number } | null = null;

  if (consumableType !== undefined) {
    const { data: c, error: cErr } = await serviceClient
      .from('consumables')
      .select('id, quantity')
      .eq('tree_id', tree_id)
      .eq('type', consumableType)
      .single();

    if (cErr || !c) {
      return json({ error: `consumable '${consumableType}' record not found` }, 400);
    }
    if ((c.quantity as number) <= 0) {
      return json({ error: `not enough '${consumableType}' (quantity is 0)` }, 400);
    }
    consumableRow = c as { id: string; quantity: number };
  }

  // -------------------------------------------------------------------------
  // 5. Determine next sequence number for this game_day
  // -------------------------------------------------------------------------
  const { data: seqRow } = await serviceClient
    .from('care_log_entries')
    .select('sequence')
    .eq('tree_id', tree_id)
    .eq('game_day', currentDay)
    .order('sequence', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSequence = ((seqRow?.sequence as number | null) ?? -1) + 1;

  // Separate type from the rest of action fields (which become action_data)
  const { type: _type, ...actionData } = action;

  // -------------------------------------------------------------------------
  // 6. Insert the care action into care_log_entries
  // -------------------------------------------------------------------------
  const { error: insertErr } = await serviceClient
    .from('care_log_entries')
    .insert({
      tree_id,
      game_day: currentDay,
      sequence: nextSequence,
      action_type: actionType,
      action_data: actionData,
    });
  if (insertErr) return json({ error: insertErr.message }, 500);

  // -------------------------------------------------------------------------
  // 7. Decrement consumable quantity
  // -------------------------------------------------------------------------
  if (consumableRow !== null) {
    // Atomic guard: only update if quantity > 0 at write time.
    // If two concurrent requests race past the earlier quantity check, this
    // filter ensures at most one succeeds. Checking decremented.length === 0
    // detects the case where the row was not updated (quantity already at 0).
    // NOTE: this prevents going below 0, but does not prevent double-decrement
    // when quantity > 1 and two requests arrive simultaneously — a fully atomic
    // `SET quantity = quantity - 1` requires a stored procedure (deferred).
    const { data: decremented, error: decrErr } = await serviceClient
      .from('consumables')
      .update({ quantity: consumableRow.quantity - 1 })
      .eq('id', consumableRow.id)
      .gt('quantity', 0)
      .select('id');
    if (decrErr) return json({ error: decrErr.message }, 500);
    if (!decremented || decremented.length === 0) {
      return json({ error: 'Consumable already consumed or insufficient quantity' }, 409);
    }
  }

  return json({ ok: true, current_day: currentDay, elapsed_days: elapsedDays });
});
