// wallet-auth — POST
// Verifies a Ronin wallet ECDSA signature and returns a Supabase JWT
// for the associated auth.users account.
//
// Request:  POST { address: string, signature: string, nonce: string }
// Response: { access_token: string, refresh_token: string, user_id: string }
//           { error: string } + status on failure
//
// Nonce strategy: server-issued 128-bit crypto nonce from wallet-auth-nonce endpoint.
// Nonces are stored in the auth_nonces table (single-use, 5-minute expiry).
// CEI (Checks-Effects-Interactions): nonce is marked used BEFORE signature verification.
// This prevents replay even if signature verification is slow or crashes mid-flight.
// Expired nonces are cleaned up best-effort on each request.
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
import { verifyTypedData } from 'npm:viem@2';

// TODO: Tighten CORS for production — replace '*' with the actual frontend origin
// (e.g., 'https://kijo.gg'). Wildcard is acceptable for testnet only. (Critic F4)
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// JWT expiry: set to 3600 seconds (1 hour) in Supabase Dashboard -> Auth -> JWT Settings.
// DO NOT increase above 3600s. A longer expiry increases the blast radius of a stolen token.
// Confirmed setting: xutjubkaskwchzyzwryk project. RFC 7519 ss4.1.4; OWASP JWT Cheat Sheet.
const JWT_EXPIRY_SECONDS_EXPECTED = 3600; // informational -- not enforced in code
void JWT_EXPIRY_SECONDS_EXPECTED;        // suppress unused-var lint warning

// EIP-712 type definitions -- MUST match useWallet.ts KIJO_AUTH_TYPES exactly.
// Any divergence (field names, types, primaryType) will fail signature verification.
const KIJO_AUTH_TYPES = {
  KijoAuth: [
    { name: 'address', type: 'address' },
    { name: 'nonce',   type: 'string'  },
  ],
} as const;

// Expected chain ID for this deployment (202601 = Saigon testnet, 2020 = mainnet).
// Set via Supabase secret RONIN_CHAIN_ID; defaults to testnet if not set.
const RONIN_CHAIN_ID = parseInt(Deno.env.get('RONIN_CHAIN_ID') ?? '202601', 10) || 202601;

// Kijonsai contract address -- set as Supabase secret (shared with seed-claim).
// Used as EIP-712 verifyingContract to bind auth signatures to this specific deployment.
const KIJONSAI_CONTRACT_ADDRESS = (
  Deno.env.get('KIJONSAI_CONTRACT_ADDRESS') ??
  '0x4447F631F5868bFA03A6e6ae2D2da9f22c787E44'
) as `0x${string}`;

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
  // 2. Service-role client for all privileged DB and admin-auth operations.
  //    Created early because CEI requires DB access before signature verify.
  // -------------------------------------------------------------------------
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // -------------------------------------------------------------------------
  // 3. Cleanup expired nonces (best-effort — do not fail the request on error)
  // -------------------------------------------------------------------------
  const { error: cleanupErr } = await serviceClient
    .from('auth_nonces')
    .delete()
    .lt('expires_at', new Date().toISOString());
  if (cleanupErr) {
    console.warn('auth_nonces cleanup failed (non-fatal):', cleanupErr.message);
  }

  // -------------------------------------------------------------------------
  // 4. CEI — Mark nonce as used BEFORE signature verification.
  //    Atomic UPDATE ... WHERE used = false AND expires_at > now() ensures:
  //      - Nonce exists and was issued by wallet-auth-nonce
  //      - Nonce has not expired
  //      - Nonce has not already been consumed (single-use)
  //    If UPDATE matches 0 rows: nonce is invalid, expired, or already used.
  //    This is the "Effects" step of CEI — state is changed before the
  //    expensive "Interactions" step (signature verification). Even if
  //    verifyTypedData crashes or times out, the nonce is already burned.
  // -------------------------------------------------------------------------
  const { data: nonceRows, error: nonceErr } = await serviceClient
    .from('auth_nonces')
    .update({ used: true })
    .eq('nonce', nonce)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .select('wallet_address');

  if (nonceErr) {
    console.error('Nonce consumption failed:', nonceErr.message);
    return json({ error: 'Nonce verification failed' }, 500);
  }
  if (!nonceRows || nonceRows.length === 0) {
    return json({ error: 'Invalid, expired, or already used nonce' }, 401);
  }

  // Verify the nonce was issued for the requesting wallet address.
  const nonceWallet = nonceRows[0].wallet_address;
  if (nonceWallet !== (address as string).toLowerCase()) {
    // Nonce was issued for a different wallet — reject.
    return json({ error: 'Nonce was not issued for this wallet address' }, 401);
  }

  // -------------------------------------------------------------------------
  // 5. Reconstruct EIP-712 domain + message — must match useWallet.ts exactly.
  //    Any divergence (chainId, types, primaryType, field names) fails sig check.
  // -------------------------------------------------------------------------
  const domain = {
    name:              'Kijo',
    version:           '1',
    chainId:           RONIN_CHAIN_ID,
    verifyingContract: KIJONSAI_CONTRACT_ADDRESS,
  };
  const authMessage = {
    address: address as `0x${string}`,
    nonce,
  };

  // -------------------------------------------------------------------------
  // 6. Verify ECDSA signature via viem — recovers signer from the message hash.
  //    This is the "Interactions" step of CEI — the nonce is already burned.
  // -------------------------------------------------------------------------
  let signatureValid: boolean;
  try {
    signatureValid = await verifyTypedData({
      address:     address as `0x${string}`,
      domain,
      types:       KIJO_AUTH_TYPES,
      primaryType: 'KijoAuth',
      message:     authMessage,
      signature:   signature as `0x${string}`,
    });
  } catch (err) {
    console.error('Signature verification error:', (err as Error).message);
    return json({ error: 'Signature verification failed' }, 400);
  }
  if (!signatureValid) {
    return json({ error: 'Signature verification failed' }, 401);
  }

  // -------------------------------------------------------------------------
  // 7. Resolve user_id from wallet address via SECURITY DEFINER RPC
  //    (wallets has no user_id column; join is through auth.users.raw_user_meta_data)
  // -------------------------------------------------------------------------
  const { data: userId, error: rpcErr } = await serviceClient.rpc(
    'get_user_id_by_wallet_address',
    { addr: address.toLowerCase() },
  );

  if (rpcErr) {
    console.error('wallet lookup RPC error:', rpcErr);
    return json({ error: 'Wallet lookup failed' }, 500);
  }
  if (!userId) {
    return json({ error: 'Wallet not registered' }, 404);
  }

  // -------------------------------------------------------------------------
  // 8. Fetch the auth user — need email for generateLink
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

  // Bind authorization to server-controlled app_metadata. The existing
  // raw_user_meta_data lookup is retained only to find the account after its
  // wallet signature has been verified; care and ownership endpoints never
  // authorize from user-editable user_metadata.
  const { data: walletRow, error: walletErr } = await serviceClient
    .from('wallets')
    .select('id')
    .eq('wallet_address', address.toLowerCase())
    .single();
  if (walletErr || !walletRow) {
    return json({ error: 'Verified wallet record not found' }, 404);
  }
  const { error: metadataErr } = await serviceClient.auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, wallet_row_id: walletRow.id },
  });
  if (metadataErr) {
    console.error('app_metadata wallet binding failed:', metadataErr);
    return json({ error: 'Failed to bind wallet authorization' }, 500);
  }

  // -------------------------------------------------------------------------
  // 9. Generate a one-time magic-link token (does NOT send email — admin API)
  // -------------------------------------------------------------------------
  const { data: linkData, error: linkErr } = await serviceClient.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email,
  });
  if (linkErr || !linkData?.properties?.hashed_token) {
    console.error('generateLink error:', linkErr);
    return json(
      { error: 'Failed to generate auth token' },
      500,
    );
  }

  // -------------------------------------------------------------------------
  // 10. Exchange hashed token for a Supabase session JWT
  // -------------------------------------------------------------------------
  const { data: otpData, error: otpErr } = await serviceClient.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  });
  if (otpErr || !otpData?.session?.access_token) {
    console.error('verifyOtp error:', otpErr);
    return json({ error: 'Failed to create session' }, 500);
  }

  return json({
    access_token:  otpData.session.access_token,
    refresh_token: otpData.session.refresh_token,  // A7-2: expose for client silent refresh
    user_id:       user.id,
  });
});
