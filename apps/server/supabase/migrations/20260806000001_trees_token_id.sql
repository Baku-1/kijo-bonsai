-- Adds token_id to the trees table.
--
-- NULLABLE: guest trees (has_spirit=false) have no NFT; they receive NULL.
-- UNIQUE: two tree rows cannot reference the same tokenId.
-- Multiple NULLs are allowed -- PostgreSQL UNIQUE permits this because
-- NULL != NULL (SQL standard ISO/IEC 9075-2:2016 ss10.6).
-- Reference: https://www.postgresql.org/docs/current/ddl-constraints.html
--            #DDL-CONSTRAINTS-UNIQUE-CONSTRAINTS
--
-- Backfill: existing testnet trees minted before this migration remain with
-- token_id = NULL. Manual backfill is out of scope (only a few testnet tokens).
-- All mainnet mints go through the fixed seed-claim flow.

ALTER TABLE public.trees
  ADD COLUMN IF NOT EXISTS token_id BIGINT UNIQUE;

-- Named partial index (explicit name aids query-plan debugging; partial form
-- excludes NULL guest-tree rows from the B-tree, which is the lookup-hot path).
-- Matches the index form specified in NFT-METADATA-IMAGE-ARCH.md.
CREATE INDEX IF NOT EXISTS idx_trees_token_id
  ON public.trees (token_id)
  WHERE token_id IS NOT NULL;

-- Down (reference only -- never run in production):
-- DROP INDEX IF EXISTS idx_trees_token_id;
-- ALTER TABLE public.trees DROP COLUMN IF EXISTS token_id;
