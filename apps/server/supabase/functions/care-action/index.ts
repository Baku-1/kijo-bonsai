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

// ---------------------------------------------------------------------------
// Field-level validation helpers (trust boundary — CEI ordering)
// ---------------------------------------------------------------------------

function requireFinite(val: unknown, name: string): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) {
    throw new Error(`${name} must be a finite number (got ${val}).`);
  }
  return val;
}

function requireNonNegInt(val: unknown, name: string): number {
  if (typeof val !== 'number' || !Number.isFinite(val) || val < 0 || !Number.isInteger(val)) {
    throw new Error(`${name} must be a non-negative integer (got ${val}).`);
  }
  return val;
}

function requirePositiveFinite(val: unknown, name: string): number {
  if (typeof val !== 'number' || !Number.isFinite(val) || val <= 0) {
    throw new Error(`${name} must be a positive finite number (got ${val}).`);
  }
  return val;
}

function requirePositiveInt(val: unknown, name: string): number {
  if (typeof val !== 'number' || !Number.isFinite(val) || val < 1 || !Number.isInteger(val)) {
    throw new Error(`${name} must be a positive integer (got ${val}).`);
  }
  return val;
}

function requireIntRange(val: unknown, lo: number, hi: number, name: string): number {
  if (typeof val !== 'number' || !Number.isFinite(val) || val < lo || val > hi || !Number.isInteger(val)) {
    throw new Error(`${name} must be an integer in [${lo}, ${hi}] (got ${val}).`);
  }
  return val;
}

// Hard upper bound for branchId at server layer. No tree can have this many branches.
const SERVER_MAX_BRANCH_ID = 10000;

function requireBranchId(val: unknown): number {
  if (typeof val !== 'number' || !Number.isFinite(val) || val < 0 || !Number.isInteger(val) || val > SERVER_MAX_BRANCH_ID) {
    throw new Error(`branchId must be a non-negative integer <= ${SERVER_MAX_BRANCH_ID} (got ${val}).`);
  }
  return val;
}

// Per-type validation schemas: validate fields AND return a clean object
// with ONLY allowed fields (A-2: strip unknown fields).
// deno-lint-ignore no-explicit-any
type ActionValidator = (data: Record<string, any>) => Record<string, unknown>;

const SCHEMAS: Record<string, ActionValidator> = {
  water: (d) => ({
    amount: requirePositiveFinite(d.amount, 'amount'),
  }),
  prune: (d) => ({
    branchId: requireBranchId(d.branchId),
  }),
  wire: (d) => ({
    branchId: requireBranchId(d.branchId),
    angleDelta: requireFinite(d.angleDelta, 'angleDelta'),
  }),
  'wire-remove': (d) => ({
    branchId: requireBranchId(d.branchId),
  }),
  twine: (d) => {
    const clean: Record<string, unknown> = {
      branchId: requireBranchId(d.branchId),
      angleDelta: requireFinite(d.angleDelta, 'angleDelta'),
    };
    if (d.degradeDays !== undefined) {
      clean.degradeDays = requireIntRange(d.degradeDays, 0, 20, 'degradeDays');
    }
    return clean;
  },
  'twine-remove': (d) => ({
    branchId: requireBranchId(d.branchId),
  }),
  weight: (d) => ({
    branchId: requireBranchId(d.branchId),
    weightCount: requireIntRange(d.weightCount, 1, 4, 'weightCount'),
  }),
  'weight-remove': (d) => ({
    branchId: requireBranchId(d.branchId),
  }),
  jin: (d) => ({
    branchId: requireBranchId(d.branchId),
    segmentIndex: requireNonNegInt(d.segmentIndex, 'segmentIndex'),
    jinCost: requirePositiveInt(d.jinCost, 'jinCost'),
  }),
  fertilize: (_) => ({}),
  rotate: (_) => ({}),
  landscape: (d) => ({
    elementType: d.elementType,
    position: d.position,
  }),
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
  // 1b. Whitelist check — must precede any DB mutation
  // -------------------------------------------------------------------------
  // Prevents clients from injecting fake server-generated types (e.g. 'tick').
  const actionType = action.type as string;
  // jin and landscape gated until Phase 2 — stubs crash CareLogReplay.
  // See: AUDIT-CARE-REPLAY-GAPS-2026-09-18.md
  const ALLOWED_ACTION_TYPES = new Set(['water', 'prune', 'wire', 'wire-remove', 'fertilize', 'rotate', 'twine', 'twine-remove', 'weight', 'weight-remove']);
  if (!ALLOWED_ACTION_TYPES.has(actionType)) {
    return json({ error: 'Invalid action type' }, 400);
  }

  // -------------------------------------------------------------------------
  // 1c. Field-level validation — FAIL-CLOSED (B-2: reject unlisted types)
  // -------------------------------------------------------------------------
  // Validates all numeric fields per action type AND strips unknown fields (A-2).
  // Must run BEFORE any DB mutation (CEI ordering — truongnguyenptn pattern).
  const validator = SCHEMAS[actionType];
  if (!validator) {
    return json({ error: `No validation schema for action type '${actionType}'` }, 400);
  }

  // Separate type from the rest of action fields
  const { type: _actionType, ...rawActionData } = action;
  let cleanActionData: Record<string, unknown>;
  try {
    cleanActionData = validator(rawActionData);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
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

  // -------------------------------------------------------------------------
  // 5. Atomically insert care action with next sequence number.
  //    COALESCE(MAX(sequence), -1) + 1 runs inside a single SQL INSERT…SELECT —
  //    no separate read round-trip, no race window for duplicate sequences.
  //    Uses cleanActionData (validated + stripped in step 1c), NOT raw action fields.
  // -------------------------------------------------------------------------
  const { error: insertErr } = await serviceClient.rpc('insert_care_log_entry', {
    p_tree_id:     tree_id,
    p_game_day:    currentDay,
    p_action_type: actionType,
    p_action_data: cleanActionData,
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
