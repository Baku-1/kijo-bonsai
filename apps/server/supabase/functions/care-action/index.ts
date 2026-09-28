// Authenticated care is prepared with the canonical engine and committed once.
// No client-supplied morale value, event, cooldown decision or cost is accepted.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { prepareCareCommit } from '../_shared/care-plan.mjs';
import { moraleEnvelope } from '../_shared/morale-transport.mjs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return json({ error: 'Missing authorization' }, 401);
  const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data: { user }, error: authErr } = await anon.auth.getUser(token);
  if (authErr || !user) return json({ error: 'Invalid or expired token' }, 401);
  let body;
  try { body = await req.json(); } catch { return json({ error: 'invalid JSON' }, 400); }
  if (!body || typeof body !== 'object') return json({ error: 'invalid request' }, 400);
  const { tree_id, wallet_row_id, request_id, action } = body;
  if (![tree_id, wallet_row_id, request_id].every(v => typeof v === 'string' && UUID.test(v))
      || !action || typeof action !== 'object' || Array.isArray(action)) {
    return json({ error: 'tree_id, wallet_row_id, request_id UUIDs and action are required' }, 400);
  }
  // app_metadata is set only after wallet-auth verifies ownership of the address.
  // User-editable user_metadata is never an authorization source.
  if (user.app_metadata?.wallet_row_id !== wallet_row_id) {
    return json({ error: 'Wallet authorization missing or mismatched; sign in with your wallet again' }, 403);
  }
  const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const request = { action };
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: context, error: loadErr } = await service.rpc('get_care_commit_context', {
      p_tree_id: tree_id, p_request_id: request_id,
    });
    if (loadErr) return json({ error: loadErr.message }, 500);
    if (!context?.tree || context.tree.wallet_id !== wallet_row_id) return json({ error: 'tree not found' }, 404);
    let plan = {};
    // A prior result is returned by the RPC before revision/plan checks. This
    // handles a timeout after commit without reapplying a now-invalid prune.
    if (!context.prior_request) {
      try { plan = prepareCareCommit(context, action, request_id, Date.now()); }
      catch (err) { return json({ error: err instanceof Error ? err.message : String(err) }, 422); }
    }
    const { data: result, error: commitErr } = await service.rpc('commit_care_action', {
      p_tree_id: tree_id, p_wallet_id: wallet_row_id, p_request_id: request_id,
      p_expected_revision: context.tree.care_revision, p_request: request, p_plan: plan,
    });
    if (commitErr?.code === '40001') continue;
    if (commitErr) {
      const status = commitErr.code === '42501' ? 403
        : ['22023', '23505', 'P0001'].includes(commitErr.code) ? 409 : 500;
      return json({ error: commitErr.message }, status);
    }
    return json({ ...result, morale: moraleEnvelope(result.morale) });
  }
  return json({ error: 'Tree changed during care; retry with the same request_id' }, 409);
});
