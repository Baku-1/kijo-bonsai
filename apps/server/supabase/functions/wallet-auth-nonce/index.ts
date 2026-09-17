// wallet-auth-nonce — POST
// Generates a server-issued 128-bit cryptographic nonce for wallet authentication.
// Stores the nonce in the auth_nonces table and returns it to the client.
//
// Request:  POST { address: string }
// Response: { nonce: string }
//           { error: string } + status on failure
//
// Rate limiting: max 10 nonces per wallet address per 5-minute sliding window.
// NOTE: This is per-wallet rate limiting only. Infrastructure-level rate limiting
// (IP-based, global throttling) should be handled at the edge/CDN layer
// (e.g., Supabase rate limits, Cloudflare WAF). Per-wallet limiting prevents
// a single address from flooding the nonce table but does not prevent an attacker
// from rotating wallet addresses. (Critic F1)
//
// Nonce: 128-bit random value from crypto.getRandomValues(), hex-encoded (32 chars).
// Pattern sourced from dwi's SIWE nonce generation (Second Brain).
//
// Expiry: 5 minutes from issuance.
// Cleanup: expired nonces are deleted best-effort on each request.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// TODO: Tighten CORS for production — replace '*' with the actual frontend origin
// (e.g., 'https://kijo.gg'). Wildcard is acceptable for testnet only. (Critic F4)
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 5-minute nonce validity window.
const NONCE_EXPIRY_MS = 5 * 60 * 1000;

// Max nonces a single wallet can request within the sliding window.
const RATE_LIMIT_MAX = 10;

// Sliding window for rate limiting (same as nonce expiry).
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;

/** Generate a 128-bit hex nonce (32 characters). */
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  // CORS preflight.
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // -------------------------------------------------------------------------
  // 1. Parse and validate input
  // -------------------------------------------------------------------------
  let body: { address?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { address } = body;
  if (!address || typeof address !== 'string') {
    return json({ error: 'Missing required field: address' }, 400);
  }

  // Normalize to lowercase for consistent lookups.
  const walletAddress = address.toLowerCase();

  // Basic hex address validation (0x + 40 hex chars).
  if (!/^0x[0-9a-f]{40}$/.test(walletAddress)) {
    return json({ error: 'Invalid wallet address format' }, 400);
  }

  // -------------------------------------------------------------------------
  // 2. Service-role client for DB operations
  // -------------------------------------------------------------------------
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // -------------------------------------------------------------------------
  // 3. Cleanup expired nonces (best-effort — log but do not fail the request)
  // -------------------------------------------------------------------------
  const { error: cleanupErr } = await serviceClient
    .from('auth_nonces')
    .delete()
    .lt('expires_at', new Date().toISOString());
  if (cleanupErr) {
    console.warn('auth_nonces cleanup failed (non-fatal):', cleanupErr.message);
  }

  // -------------------------------------------------------------------------
  // 4. Rate limiting — count nonces issued for this wallet in sliding window
  // -------------------------------------------------------------------------
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count, error: countErr } = await serviceClient
    .from('auth_nonces')
    .select('id', { count: 'exact', head: true })
    .eq('wallet_address', walletAddress)
    .gte('created_at', windowStart);

  if (countErr) {
    console.error('Rate limit check failed:', countErr.message);
    return json({ error: 'Rate limit check failed' }, 500);
  }

  if ((count ?? 0) >= RATE_LIMIT_MAX) {
    return json({ error: 'Rate limit exceeded — try again later' }, 429);
  }

  // -------------------------------------------------------------------------
  // 5. Generate nonce and store in auth_nonces
  // -------------------------------------------------------------------------
  const nonce = generateNonce();
  const expiresAt = new Date(Date.now() + NONCE_EXPIRY_MS).toISOString();

  const { error: insertErr } = await serviceClient
    .from('auth_nonces')
    .insert({
      wallet_address: walletAddress,
      nonce,
      used: false,
      expires_at: expiresAt,
    });

  if (insertErr) {
    console.error('Nonce insert failed:', insertErr.message);
    return json({ error: 'Failed to generate nonce' }, 500);
  }

  // -------------------------------------------------------------------------
  // 6. Return nonce to client
  // -------------------------------------------------------------------------
  // expires_at is returned for informational purposes. The server remains the sole
  // authority on expiry — the client intentionally discards expires_at and relies on
  // server-side rejection if the nonce has expired. See useWalletAuth.ts fetchNonce()
  // for the deliberate discard rationale. (Critic F2)
  return json({ nonce, expires_at: expiresAt });
});
