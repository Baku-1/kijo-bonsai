-- Migration: seed_claims
-- Purpose: Replay guard table for RON payment claims.
--   tx_hash is PRIMARY KEY — a unique violation means the txHash was already
--   used to claim seeds. The server returns 409 Conflict in that case.
--   claimed_by ties the claim to a specific auth.users row so disputes can
--   be investigated (who claimed which tx, when, for how many seeds).

CREATE TABLE IF NOT EXISTS seed_claims (
  tx_hash    TEXT        PRIMARY KEY,
  claimed_by UUID        NOT NULL REFERENCES auth.users(id),
  count      INTEGER     NOT NULL CHECK (count BETWEEN 1 AND 10),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
