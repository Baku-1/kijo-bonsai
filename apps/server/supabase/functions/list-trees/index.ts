// list-trees — GET
// Returns all trees owned by the authenticated wallet.
//
// Auth: Bearer JWT required. Wallet identity is derived entirely from the JWT —
// no body params are trusted for ownership. Uses the same JWT-verification
// pattern as care-action (anonClient.auth.getUser) and the same service-role
// pattern for DB reads.
//
// Response: { trees: Array<{ id, token_id, species, current_day, born_at }> }
// Empty array (not 404) when the wallet has no trees.
// Limit: 50 trees per request (testnet — pagination deferred to mainnet, OQ-3).

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

  // -------------------------------------------------------------------------
  // 0. JWT verification — identical pattern to care-action
  // -------------------------------------------------------------------------
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return json({ error: 'Missing authorization' }, 401);

  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  );

  const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
  if (authErr || !user) return json({ error: 'Invalid or expired token' }, 401);

  // -------------------------------------------------------------------------
  // 1. Extract walletRowId from JWT — identical pattern to care-action:74
  //    walletRowId is NOT taken from the request; it comes from the verified JWT.
  // -------------------------------------------------------------------------
  const walletRowId: string = user.user_metadata?.wallet_row_id ?? user.id;

  // -------------------------------------------------------------------------
  // 2. Fetch trees with service-role client (bypasses RLS, consistent with
  //    care-action and seed-claim patterns).
  // -------------------------------------------------------------------------
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: trees, error: treesErr } = await serviceClient
    .from('trees')
    .select('id, token_id, species, current_day, born_at')
    .eq('wallet_id', walletRowId)
    .order('born_at', { ascending: true })
    .limit(50);

  if (treesErr) return json({ error: treesErr.message }, 500);

  return json({ trees: trees ?? [] });
});
