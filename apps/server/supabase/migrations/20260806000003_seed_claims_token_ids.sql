-- Adds token_ids to seed_claims for idempotent replay recovery (MAJOR-1 fix).
-- Written after all mint submissions attempt; NULL means the previous run
-- did not complete (died mid-loop before UPDATE).
ALTER TABLE public.seed_claims
  ADD COLUMN IF NOT EXISTS token_ids BIGINT[];
