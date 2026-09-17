-- auth_nonces: server-issued cryptographic nonces for wallet authentication.
--
-- Replaces the old used_nonces table (timestamp-based client nonces).
-- Each row represents a single nonce issued by wallet-auth-nonce edge function.
-- Nonces are 128-bit hex strings (32 chars) from crypto.getRandomValues().
--
-- CEI (Checks-Effects-Interactions) enforcement:
--   wallet-auth marks `used = true` via atomic UPDATE ... WHERE used = false
--   BEFORE verifying the signature. This prevents replay even if verification
--   is slow or crashes mid-flight.
--
-- Rate limiting: composite index on (wallet_address, created_at) supports
-- per-wallet sliding-window queries in the nonce-issuance function.
-- NOTE: This provides per-wallet rate limiting only. Infrastructure-level
-- rate limiting (IP-based, global) should be handled at the edge/CDN layer
-- (e.g., Supabase rate limits, Cloudflare WAF) and is outside the scope of
-- this table. (Critic F1)
--
-- Down (reference only — never run in production):
-- DROP TABLE IF EXISTS public.auth_nonces;

CREATE TABLE IF NOT EXISTS public.auth_nonces (
  id              UUID        NOT NULL DEFAULT gen_random_uuid(),
  wallet_address  TEXT        NOT NULL,
  nonce           TEXT        NOT NULL,
  used            BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL,
  CONSTRAINT auth_nonces_pkey PRIMARY KEY (id)
);

-- Unique constraint on nonce ensures no duplicate issuance.
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_nonces_nonce
  ON public.auth_nonces (nonce);

-- Per-wallet rate-limit lookups: "how many nonces issued for this wallet in last N minutes?"
CREATE INDEX IF NOT EXISTS idx_auth_nonces_wallet_created
  ON public.auth_nonces (wallet_address, created_at);

-- Efficient cleanup of expired rows.
CREATE INDEX IF NOT EXISTS idx_auth_nonces_expires_at
  ON public.auth_nonces (expires_at);

-- RLS: restrict PostgREST access. Only service_role (edge functions) should
-- read/write this table. No anon or authenticated access. Without this,
-- anyone with the anon key could mark other users' nonces as used (DoS).
-- (Auditor F-HIGH-1)
ALTER TABLE public.auth_nonces ENABLE ROW LEVEL SECURITY;
-- No RLS policies = no access via PostgREST for anon/authenticated roles.
-- service_role bypasses RLS by default.
