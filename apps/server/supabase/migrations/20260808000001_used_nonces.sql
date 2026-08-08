-- used_nonces: one-time-use table for wallet-auth nonce replay prevention.
-- Each nonce inserted once. Duplicate INSERT (replay attack) fails on PRIMARY KEY.
-- expires_at enables cleanup of stale rows inside the auth function itself
-- (no separate cron job required for testnet).
--
-- Called from wallet-auth/index.ts:
--   INSERT INTO used_nonces (nonce, expires_at) VALUES ($nonce, now() + NONCE_WINDOW)
--   On 23505 unique violation: return 409 Nonce already used
--
-- Down (reference only -- never run in production):
-- DROP TABLE IF EXISTS public.used_nonces;

CREATE TABLE IF NOT EXISTS public.used_nonces (
  nonce       TEXT        NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  CONSTRAINT  used_nonces_pkey PRIMARY KEY (nonce)
);

-- Supports efficient cleanup of expired rows at the top of wallet-auth.
CREATE INDEX IF NOT EXISTS idx_used_nonces_expires_at
  ON public.used_nonces (expires_at);
