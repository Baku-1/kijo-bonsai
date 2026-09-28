import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { moraleAdmission, moraleEnvelope } from '../_shared/morale-transport.mjs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return json({ error: 'Missing authorization' }, 401);
  const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data: { user }, error: authErr } = await anon.auth.getUser(token);
  if (authErr || !user) return json({ error: 'Invalid or expired token' }, 401);

  let body: { tree_id?: unknown; request_id?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'invalid JSON' }, 400); }
  if (typeof body.tree_id !== 'string' || !UUID.test(body.tree_id)
      || typeof body.request_id !== 'string' || !UUID.test(body.request_id)) {
    return json({ error: 'tree_id and request_id UUIDs are required' }, 400);
  }
  const walletId = user.app_metadata?.wallet_row_id;
  if (typeof walletId !== 'string' || !UUID.test(walletId)) {
    return json({ error: 'Wallet authorization missing; sign in with your wallet again' }, 403);
  }

  const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: context, error: loadErr } = await service.rpc('get_care_commit_context', {
      p_tree_id: body.tree_id,
      p_request_id: body.request_id,
    });
    if (loadErr) return json({ error: loadErr.message }, 500);
    if (!context?.tree || context.tree.wallet_id !== walletId) return json({ error: 'tree not found' }, 404);

    const morale = moraleEnvelope(context.tree.spirit_morale);
    const admission = moraleAdmission(context.tree.spirit_morale);
    if (!admission.allowed) {
      return json({ ok: true, allowed: false, reason: admission.reason, morale });
    }

    const { data: result, error: commitErr } = await service.rpc('admit_tree_to_combat', {
      p_tree_id: body.tree_id,
      p_wallet_id: walletId,
      p_request_id: body.request_id,
      p_expected_revision: context.tree.care_revision,
      p_expected_morale: context.tree.spirit_morale,
    });
    if (commitErr?.code === '40001') continue;
    if (commitErr) return json({ error: commitErr.message }, commitErr.code === '42501' ? 403 : 500);
    return json({ ...result, morale: moraleEnvelope(result.morale) });
  }
  return json({ error: 'Spirit state changed during admission; retry with the same request_id' }, 409);
});
