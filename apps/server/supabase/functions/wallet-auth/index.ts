// wallet-auth — POST
// Verifies a Ronin wallet ECDSA signature and returns a Supabase JWT
// for the associated auth.users account.
//
// Request:  POST { address: string, signature: string, nonce: string }
// Response: { access_token: string, user_id: string }
//           { error: string } + status on failure
//
// Nonce strategy: timestamp-based (Date.now().toString()), valid for 5 minutes.
// TESTNET LIMITATION: nonces are NOT stored server-side, so replay is possible
// within the 5-minute window. Production must write used nonces to a DB table
// with a TTL index and reject duplicates.
//
// Session creation:
//   admin.createSession() does NOT exist in @supabase/supabase-js@2.
//   Confirmed 2026-07: no docs page, open feature request since 2023.
//   Pattern used (confirmed working, community 2025):
//     admin.generateLink({ type: 'magiclink', email }) → hashed_token
//     auth.verifyOtp({ token_hash: hashed_token, type: 'magiclink' }) → access_token
//   generateLink does NOT send an email — admin endpoint is programmatic-use only.
//
// Wallet → user_id lookup:
//   wallets table has no user_id column. The link is:
//     auth.users.raw_user_meta_data->>'wallet_row_id' → wallets.id
//   A SECURITY DEFINER function (get_user_id_by_wallet_address) inverts this join.
//   See migration 20260723000000_wallet_auth_lookup.sql.
//
// Import pattern copied from seed-claim/index.ts.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyMessage } from 'npm:viem@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 5-minute nonce window. Replay possible within this period (testnet acceptable).
const NONCE_WINDOW_MS = 5 * 60 * 1000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // -------------------------------------------------------------------------
  // 1. Parse and validate inputs
  // -------------------------------------------------------------------------
  let body: { address?: unknown; signature?: unknown; nonce?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { address, signature, nonce } = body;
  if (
    !address ||
    typeof address !== 'string' ||
    !signature ||
    typeof signature !== 'string' ||
    !nonce ||
    typeof nonce !== 'string'
  ) {
    return json({ error: 'Missing required fields: address, signature, nonce' }, 400);
  }

  // -------------------------------------------------------------------------
  // 2. Validate nonce — must be a millisecond timestamp (Date.now().toString())
  //    UUID nonces are explicitly rejected; they cannot be timestamp-validated
  //    without a stored-nonce table.
  // -------------------------------------------------------------------------
  const nonceMs = parseInt(nonce, 10);
  if (isNaN(nonceMs) || nonceMs <= 0) {
    return json(
      { error: 'Invalid nonce: must be Date.now().toString() (millisecond timestamp)' },
      400,
    );
  }
  if (Date.now() - nonceMs > NONCE_WINDOW_MS) {
    return json({ error: 'Nonce expired — request must be within 5 minutes' }, 400);
  }

  // -------------------------------------------------------------------------
  // 3. Reconstruct message — must match useWallet.ts authenticate() exactly
  // -------------------------------------------------------------------------
  const message = `Kijo authentication\nAddress: ${address}\nNonce: ${nonce}`;

  // -------------------------------------------------------------------------
  // 4. Verify ECDSA signature via viem — recovers signer from the message hash
  // -------------------------------------------------------------------------
  let signatureValid: boolean;
  try {
    signatureValid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
  } catch (err) {
    return json({ error: `Signature verification error: ${(err as Error).message}` }, 400);
  }
  if (!signatureValid) {
    return json({ error: 'Signature invalid' }, 401);
  }

  // -------------------------------------------------------------------------
  // 5. Service-role client for all privileged DB and admin-auth operations
  // -------------------------------------------------------------------------
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // -------------------------------------------------------------------------
  // 6. Resolve user_id from wallet address via SECURITY DEFINER RPC
  //    (wallets has no user_id column; join is through auth.users.raw_user_meta_data)
  // -------------------------------------------------------------------------
  const { data: userId, error: rpcErr } = await serviceClient.rpc(
    'get_user_id_by_wallet_address',
    { addr: address.toLowerCase() },
  );

  if (rpcErr) {
    console.error('wallet lookup RPC error:', rpcErr);
    return json({ error: `Wallet lookup failed: ${rpcErr.message}` }, 500);
  }
  if (!userId) {
    return json({ error: 'Wallet not registered' }, 404);
  }

  // -------------------------------------------------------------------------
  // 7. Fetch the auth user — need email for generateLink
  // -------------------------------------------------------------------------
  const {
    data: { user },
    error: userErr,
  } = await serviceClient.auth.admin.getUserById(userId as string);
  if (userErr || !user) {
    console.error('getUserById error:', userErr);
    return json({ error: 'User not found' }, 404);
  }
  if (!user.email) {
    // Wallet users created without email cannot use the generateLink flow.
    // This is a registration-time constraint, not a wallet-auth bug.
    return json(
      { error: 'User account has no email address — wallet registration incomplete' },
      500,
    );
  }

  // -------------------------------------------------------------------------
  // 8. Generate a one-time magic-link token (does NOT send email — admin API)
  // -------------------------------------------------------------------------
  const { data: linkData, error: linkErr } = await serviceClient.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email,
  });
  if (linkErr || !linkData?.properties?.hashed_token) {
    console.error('generateLink error:', linkErr);
    return json(
      { error: `Failed to generate auth token: ${linkErr?.message ?? 'unknown'}` },
      500,
    );
  }

  // -------------------------------------------------------------------------
  // 9. Exchange hashed token for a Supabase session JWT
  // -------------------------------------------------------------------------
  const { data: otpData, error: otpErr } = await serviceClient.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  });
  if (otpErr || !otpData?.session?.access_token) {
    console.error('verifyOtp error:', otpErr);
    return json(
      { error: `Failed to create session: ${otpErr?.message ?? 'unknown'}` },
      500,
    );
  }

  return json({
    access_token: otpData.session.access_token,
    user_id: user.id,
  });
});
