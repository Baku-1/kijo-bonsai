-- ============================================================================
-- Growth V3 Migration
-- Spec: ARCH-GROWTH-V3-IMPLEMENTATION-2026-09-25.md §11
-- ============================================================================

-- ---------------------------------------------------------------------------
-- §11.1 — Add V3 columns to trees table
-- ---------------------------------------------------------------------------

ALTER TABLE trees
  ADD COLUMN IF NOT EXISTS engine_version TEXT NOT NULL DEFAULT 'legacy-unversioned',
  ADD COLUMN IF NOT EXISTS state_schema_version SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS event_sequence BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS state_hash CHAR(64),
  ADD COLUMN IF NOT EXISTS active_snapshot_id CHAR(64),
  ADD COLUMN IF NOT EXISTS active_plan_id CHAR(64),
  ADD COLUMN IF NOT EXISTS last_materialized_at_ms BIGINT,
  ADD COLUMN IF NOT EXISTS rebaseline_status TEXT NOT NULL DEFAULT 'pending';

-- ---------------------------------------------------------------------------
-- §11.1 — tree_growth_snapshots
-- Immutable snapshots of tree state at a point in time.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tree_growth_snapshots (
  tree_id       UUID NOT NULL REFERENCES trees(id),
  snapshot_id   CHAR(64) NOT NULL,
  revision      BIGINT NOT NULL,
  effective_at_ms BIGINT NOT NULL,
  day_index     INTEGER NOT NULL,
  state_schema_version SMALLINT NOT NULL,
  engine_version TEXT NOT NULL,
  state_json    JSONB NOT NULL,
  state_hash    CHAR(64) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (tree_id, snapshot_id),
  UNIQUE (tree_id, revision)
);

-- RLS: owner-readable
ALTER TABLE tree_growth_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY snapshots_owner_read ON tree_growth_snapshots
  FOR SELECT USING (
    tree_id IN (SELECT id FROM trees WHERE wallet_id = auth.uid()::TEXT)
  );

-- ---------------------------------------------------------------------------
-- §11.1 — tree_growth_plans
-- Immutable day plans. Status transitions: active → superseded | committed.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tree_growth_plans (
  tree_id       UUID NOT NULL REFERENCES trees(id),
  plan_id       CHAR(64) NOT NULL,
  revision      BIGINT NOT NULL,
  day_index     INTEGER NOT NULL,
  segment_index SMALLINT NOT NULL CHECK (segment_index IN (0, 1)),
  interval_start_ms BIGINT NOT NULL,
  interval_end_ms   BIGINT NOT NULL,
  plan_schema_version SMALLINT NOT NULL,
  engine_version TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'committed')),
  plan_json     JSONB NOT NULL,
  plan_hash     CHAR(64) NOT NULL,
  parent_plan_id CHAR(64),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (tree_id, plan_id)
);

ALTER TABLE tree_growth_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY plans_owner_read ON tree_growth_plans
  FOR SELECT USING (
    tree_id IN (SELECT id FROM trees WHERE wallet_id = auth.uid()::TEXT)
  );

-- ---------------------------------------------------------------------------
-- §11.1 — tree_growth_events
-- Immutable growth event payloads. Status tracks retain/cancel/materialize.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tree_growth_events (
  tree_id       UUID NOT NULL REFERENCES trees(id),
  plan_id       CHAR(64) NOT NULL,
  event_id      CHAR(64) NOT NULL,
  branch_id     INTEGER NOT NULL,
  kind          TEXT NOT NULL,
  segment_index SMALLINT NOT NULL CHECK (segment_index IN (0, 1)),
  start_offset_ms BIGINT NOT NULL,
  end_offset_ms   BIGINT NOT NULL,
  allocation_gu TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  event_json    JSONB NOT NULL,

  PRIMARY KEY (tree_id, event_id)
);

ALTER TABLE tree_growth_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY events_owner_read ON tree_growth_events
  FOR SELECT USING (
    tree_id IN (SELECT id FROM trees WHERE wallet_id = auth.uid()::TEXT)
  );

-- ---------------------------------------------------------------------------
-- §11.1 — tree_care_events
-- Accepted care actions with server-assigned sequence and revision.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tree_care_events (
  tree_id             UUID NOT NULL REFERENCES trees(id),
  care_event_id       CHAR(64) NOT NULL,
  accepted_at_ms      BIGINT NOT NULL,
  event_sequence      BIGINT NOT NULL,
  base_revision       BIGINT NOT NULL,
  committed_revision  BIGINT NOT NULL,
  idempotency_key     UUID NOT NULL,
  request_hash        CHAR(64) NOT NULL,
  action_json         JSONB NOT NULL,
  response_json       JSONB,
  result_state_hash   CHAR(64) NOT NULL,
  result_plan_hash    CHAR(64),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (tree_id, care_event_id),
  UNIQUE (tree_id, idempotency_key),
  UNIQUE (tree_id, event_sequence)
);

ALTER TABLE tree_care_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY care_events_owner_read ON tree_care_events
  FOR SELECT USING (
    tree_id IN (SELECT id FROM trees WHERE wallet_id = auth.uid()::TEXT)
  );

-- ---------------------------------------------------------------------------
-- §11.1 — tree_prune_receipts
-- One-to-one with prune care events.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tree_prune_receipts (
  tree_id       UUID NOT NULL REFERENCES trees(id),
  care_event_id CHAR(64) NOT NULL,
  receipt_json  JSONB NOT NULL,
  receipt_hash  CHAR(64) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (tree_id, care_event_id)
);

ALTER TABLE tree_prune_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY prune_receipts_owner_read ON tree_prune_receipts
  FOR SELECT USING (
    tree_id IN (SELECT id FROM trees WHERE wallet_id = auth.uid()::TEXT)
  );

-- ---------------------------------------------------------------------------
-- §11.1 — tree_rebaseline_audit
-- Append-only audit trail for engine version upgrades.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tree_rebaseline_audit (
  id                BIGSERIAL PRIMARY KEY,
  tree_id           UUID NOT NULL REFERENCES trees(id),
  from_engine_version TEXT NOT NULL,
  to_engine_version   TEXT NOT NULL,
  status            TEXT NOT NULL,
  pre_hash          CHAR(64),
  post_hash         CHAR(64),
  reason            TEXT,
  performed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tree_rebaseline_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY rebaseline_audit_owner_read ON tree_rebaseline_audit
  FOR SELECT USING (
    tree_id IN (SELECT id FROM trees WHERE wallet_id = auth.uid()::TEXT)
  );

-- ---------------------------------------------------------------------------
-- §11.1 — Boundary idempotency
-- Uniqueness on (tree_id, effective_at_ms, engine_version).
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS idx_snapshots_boundary_idempotency
  ON tree_growth_snapshots (tree_id, effective_at_ms, engine_version);

-- ---------------------------------------------------------------------------
-- §7.3 — prepare_growth_transition_v3
-- Returns current server time, revision, snapshot, active plan, and
-- idempotency hit if one exists.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION prepare_growth_transition_v3(
  p_tree_id UUID,
  p_idempotency_key UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tree RECORD;
  v_snapshot JSONB;
  v_plan JSONB;
  v_idempotency_hit JSONB;
  v_server_now_ms BIGINT;
BEGIN
  -- Server time in milliseconds
  v_server_now_ms := EXTRACT(EPOCH FROM clock_timestamp())::BIGINT * 1000;

  -- Read tree (no lock — optimistic)
  SELECT id, revision, event_sequence, state_hash,
         active_snapshot_id, active_plan_id, engine_version,
         rebaseline_status
    INTO v_tree
    FROM trees
   WHERE id = p_tree_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'TREE_NOT_FOUND');
  END IF;

  IF v_tree.rebaseline_status != 'ready' THEN
    RETURN jsonb_build_object('error', 'REBASELINE_REQUIRED',
                              'status', v_tree.rebaseline_status);
  END IF;

  -- Fetch active snapshot
  IF v_tree.active_snapshot_id IS NOT NULL THEN
    SELECT state_json INTO v_snapshot
      FROM tree_growth_snapshots
     WHERE tree_id = p_tree_id
       AND snapshot_id = v_tree.active_snapshot_id;
  END IF;

  -- Fetch active plan
  IF v_tree.active_plan_id IS NOT NULL THEN
    SELECT plan_json INTO v_plan
      FROM tree_growth_plans
     WHERE tree_id = p_tree_id
       AND plan_id = v_tree.active_plan_id
       AND status = 'active';
  END IF;

  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT jsonb_build_object(
      'care_event_id', care_event_id,
      'committed_revision', committed_revision,
      'response_json', response_json
    ) INTO v_idempotency_hit
      FROM tree_care_events
     WHERE tree_id = p_tree_id
       AND idempotency_key = p_idempotency_key;
  END IF;

  RETURN jsonb_build_object(
    'server_now_ms', v_server_now_ms,
    'revision', v_tree.revision,
    'event_sequence', v_tree.event_sequence,
    'state_hash', v_tree.state_hash,
    'engine_version', v_tree.engine_version,
    'snapshot', COALESCE(v_snapshot, 'null'::JSONB),
    'plan', COALESCE(v_plan, 'null'::JSONB),
    'idempotency_hit', v_idempotency_hit
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- §7.3 — commit_growth_transition_v3
-- Atomic commit: lock tree, check revision, allocate sequence, insert records.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION commit_growth_transition_v3(
  p_tree_id UUID,
  p_expected_revision BIGINT,
  p_idempotency_key UUID,
  p_request_hash CHAR(64),
  p_accepted_at_ms BIGINT,
  p_action_json JSONB,
  p_new_snapshot_json JSONB DEFAULT NULL,
  p_new_snapshot_id CHAR(64) DEFAULT NULL,
  p_new_snapshot_hash CHAR(64) DEFAULT NULL,
  p_new_snapshot_day_index INTEGER DEFAULT NULL,
  p_new_plan_json JSONB DEFAULT NULL,
  p_new_plan_id CHAR(64) DEFAULT NULL,
  p_new_plan_hash CHAR(64) DEFAULT NULL,
  p_new_plan_day_index INTEGER DEFAULT 0,
  p_new_plan_segment_index SMALLINT DEFAULT 0,
  p_new_plan_interval_start_ms BIGINT DEFAULT 0,
  p_new_plan_interval_end_ms BIGINT DEFAULT 0,
  p_result_state_hash CHAR(64) DEFAULT NULL,
  p_cancelled_event_ids TEXT[] DEFAULT NULL,
  p_new_events_json JSONB[] DEFAULT NULL,
  p_prune_receipt_json JSONB DEFAULT NULL,
  p_prune_receipt_hash CHAR(64) DEFAULT NULL,
  p_response_json JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tree RECORD;
  v_new_revision BIGINT;
  v_new_sequence BIGINT;
  v_care_event_id CHAR(64);
  v_existing_key RECORD;
  v_evt JSONB;
BEGIN
  -- Lock the tree row
  SELECT id, revision, event_sequence, engine_version
    INTO v_tree
    FROM trees
   WHERE id = p_tree_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'TREE_NOT_FOUND');
  END IF;

  -- §7.3 step 3: Idempotency check first
  SELECT care_event_id, committed_revision, request_hash, response_json
    INTO v_existing_key
    FROM tree_care_events
   WHERE tree_id = p_tree_id
     AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_existing_key.request_hash != p_request_hash THEN
      RETURN jsonb_build_object('error', 'IDEMPOTENCY_KEY_REUSED');
    END IF;
    -- Return stored result
    RETURN jsonb_build_object(
      'care_event_id', v_existing_key.care_event_id,
      'committed_revision', v_existing_key.committed_revision,
      'response_json', v_existing_key.response_json,
      'idempotent_replay', true
    );
  END IF;

  -- §7.3 step 3: Revision check
  IF v_tree.revision != p_expected_revision THEN
    RETURN jsonb_build_object(
      'error', 'REVISION_CONFLICT',
      'current_revision', v_tree.revision
    );
  END IF;

  -- Allocate next revision and sequence
  v_new_revision := v_tree.revision + 1;
  v_new_sequence := v_tree.event_sequence + 1;

  -- The care_event_id is computed by the caller using the now-known
  -- sequence and revision (or passed in). For now we use a placeholder
  -- that will be replaced when the Edge Function computes it.
  -- In practice the Edge Function computes it from the hash and passes it in.
  v_care_event_id := p_request_hash; -- Placeholder; Edge Function replaces

  -- Insert care event
  INSERT INTO tree_care_events (
    tree_id, care_event_id, accepted_at_ms, event_sequence,
    base_revision, committed_revision, idempotency_key,
    request_hash, action_json, response_json,
    result_state_hash, result_plan_hash
  ) VALUES (
    p_tree_id, v_care_event_id, p_accepted_at_ms, v_new_sequence,
    p_expected_revision, v_new_revision, p_idempotency_key,
    p_request_hash, p_action_json, p_response_json,
    p_result_state_hash, p_new_plan_hash
  );

  -- Insert snapshot if provided
  IF p_new_snapshot_json IS NOT NULL THEN
    INSERT INTO tree_growth_snapshots (
      tree_id, snapshot_id, revision, effective_at_ms,
      day_index, state_schema_version, engine_version,
      state_json, state_hash
    ) VALUES (
      p_tree_id, p_new_snapshot_id, v_new_revision, p_accepted_at_ms,
      p_new_snapshot_day_index, 3, v_tree.engine_version,
      p_new_snapshot_json, p_new_snapshot_hash
    );
  END IF;

  -- Supersede old plan and insert new plan if provided
  IF p_new_plan_json IS NOT NULL THEN
    UPDATE tree_growth_plans
       SET status = 'superseded'
     WHERE tree_id = p_tree_id
       AND status = 'active';

    INSERT INTO tree_growth_plans (
      tree_id, plan_id, revision, day_index, segment_index,
      interval_start_ms, interval_end_ms,
      plan_schema_version, engine_version, status,
      plan_json, plan_hash
    ) VALUES (
      p_tree_id, p_new_plan_id, v_new_revision, p_new_plan_day_index,
      p_new_plan_segment_index,
      p_new_plan_interval_start_ms, p_new_plan_interval_end_ms,
      1, v_tree.engine_version, 'active',
      p_new_plan_json, p_new_plan_hash
    );
  END IF;

  -- Cancel events if specified
  IF p_cancelled_event_ids IS NOT NULL THEN
    UPDATE tree_growth_events
       SET status = 'cancelled'
     WHERE tree_id = p_tree_id
       AND event_id = ANY(p_cancelled_event_ids);
  END IF;

  -- Insert new growth events if provided
  IF p_new_events_json IS NOT NULL THEN
    FOREACH v_evt IN ARRAY p_new_events_json
    LOOP
      INSERT INTO tree_growth_events (
        tree_id, plan_id, event_id, branch_id, kind,
        segment_index, start_offset_ms, end_offset_ms,
        allocation_gu, status, event_json
      ) VALUES (
        p_tree_id,
        v_evt->>'sourcePlanId',
        v_evt->>'eventId',
        (v_evt->>'branchId')::INTEGER,
        v_evt->>'kind',
        (v_evt->>'segmentIndex')::SMALLINT,
        (v_evt->>'startOffsetMs')::BIGINT,
        (v_evt->>'endOffsetMs')::BIGINT,
        v_evt->>'allocationGU',
        'pending',
        v_evt
      );
    END LOOP;
  END IF;

  -- Insert prune receipt if provided
  IF p_prune_receipt_json IS NOT NULL THEN
    INSERT INTO tree_prune_receipts (
      tree_id, care_event_id, receipt_json, receipt_hash
    ) VALUES (
      p_tree_id, v_care_event_id, p_prune_receipt_json, p_prune_receipt_hash
    );
  END IF;

  -- Update tree head
  UPDATE trees SET
    revision = v_new_revision,
    event_sequence = v_new_sequence,
    state_hash = COALESCE(p_result_state_hash, state_hash),
    active_snapshot_id = COALESCE(p_new_snapshot_id, active_snapshot_id),
    active_plan_id = COALESCE(p_new_plan_id, active_plan_id),
    last_materialized_at_ms = p_accepted_at_ms
  WHERE id = p_tree_id;

  RETURN jsonb_build_object(
    'care_event_id', v_care_event_id,
    'committed_revision', v_new_revision,
    'event_sequence', v_new_sequence,
    'idempotent_replay', false
  );
END;
$$;
