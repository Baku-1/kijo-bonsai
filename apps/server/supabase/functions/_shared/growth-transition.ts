/**
 * Growth Transition — Server-side prepare/compute/commit adapter.
 *
 * Implements the OCC flow from §7.3:
 * 1. prepare_growth_transition_v3 → server time, revision, snapshot, plan, idempotency
 * 2. Pure deterministic compute outside DB transaction
 * 3. commit_growth_transition_v3 → atomic lock, allocate, validate, insert, commit
 *
 * Spec: ARCH-GROWTH-V3-IMPLEMENTATION-2026-09-25.md §7, §12.
 *
 * @module growth-transition
 */

import type {
  CareActionRequestV2,
  CareEventV2,
  GrowthEventV1,
  DayPlanV1,
  PruneReceiptV1,
  OccErrorCode,
} from '@kijo/shared';
import {
  validateCareActionRequestV2,
  isValidSha256Hex,
  isValidDecimalString,
  OCC_ERROR_REVISION_CONFLICT,
  OCC_ERROR_IDEMPOTENCY_KEY_REUSED,
  OCC_ERROR_RETRYABLE,
  OCC_ERROR_REBASELINE_REQUIRED,
} from '@kijo/shared';

// ═══════════════════════════════════════════════════════════════════════════
// §7.3 — OCC error responses
// ═══════════════════════════════════════════════════════════════════════════

export class GrowthTransitionError extends Error {
  readonly code: OccErrorCode;
  readonly httpStatus: number;
  readonly details?: Record<string, unknown>;

  constructor(code: OccErrorCode, message: string, httpStatus: number, details?: Record<string, unknown>) {
    super(message);
    this.name = 'GrowthTransitionError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// §7.1 — Request validation (Web3 real currency — all params guarded)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate and normalize a CareActionRequestV2.
 * Every field is checked before any DB interaction.
 *
 * @throws GrowthTransitionError on invalid input
 */
export function validateRequest(body: unknown): CareActionRequestV2 {
  if (body === null || typeof body !== 'object') {
    throw new GrowthTransitionError(
      OCC_ERROR_RETRYABLE,
      'Request body must be a JSON object',
      400,
    );
  }

  const validationError = validateCareActionRequestV2(body);
  if (validationError !== null) {
    throw new GrowthTransitionError(
      OCC_ERROR_RETRYABLE,
      `Invalid request: ${validationError}`,
      400,
    );
  }

  return body as CareActionRequestV2;
}

// ═══════════════════════════════════════════════════════════════════════════
// §7.3 — Prepare phase
// ═══════════════════════════════════════════════════════════════════════════

export interface PrepareResult {
  readonly serverNowMs: number;
  readonly revision: string;
  readonly eventSequence: string;
  readonly stateHash: string | null;
  readonly engineVersion: string;
  readonly snapshot: unknown | null;
  readonly plan: unknown | null;
  readonly idempotencyHit: {
    readonly careEventId: string;
    readonly committedRevision: string;
    readonly responseJson: unknown;
  } | null;
}

/**
 * Parse the result of prepare_growth_transition_v3 Postgres function.
 *
 * @throws GrowthTransitionError on tree not found or rebaseline required
 */
export function parsePrepareResult(result: Record<string, unknown>): PrepareResult {
  if (result.error === 'TREE_NOT_FOUND') {
    throw new GrowthTransitionError(
      OCC_ERROR_RETRYABLE,
      'Tree not found',
      404,
    );
  }
  if (result.error === 'REBASELINE_REQUIRED') {
    throw new GrowthTransitionError(
      OCC_ERROR_REBASELINE_REQUIRED,
      `Tree requires rebaseline (status: ${result.status})`,
      409,
      { status: result.status },
    );
  }

  return {
    serverNowMs: result.server_now_ms as number,
    revision: String(result.revision),
    eventSequence: String(result.event_sequence),
    stateHash: result.state_hash as string | null,
    engineVersion: result.engine_version as string,
    snapshot: result.snapshot ?? null,
    plan: result.plan ?? null,
    idempotencyHit: result.idempotency_hit ? {
      careEventId: (result.idempotency_hit as Record<string, unknown>).care_event_id as string,
      committedRevision: String((result.idempotency_hit as Record<string, unknown>).committed_revision),
      responseJson: (result.idempotency_hit as Record<string, unknown>).response_json,
    } : null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// §7.3 — Commit phase
// ═══════════════════════════════════════════════════════════════════════════

export interface CommitResult {
  readonly careEventId: string;
  readonly committedRevision: string;
  readonly eventSequence: string;
  readonly idempotentReplay: boolean;
}

/**
 * Parse the result of commit_growth_transition_v3 Postgres function.
 *
 * @throws GrowthTransitionError on revision conflict, idempotency reuse, or other errors
 */
export function parseCommitResult(result: Record<string, unknown>): CommitResult {
  if (result.error === 'TREE_NOT_FOUND') {
    throw new GrowthTransitionError(
      OCC_ERROR_RETRYABLE,
      'Tree not found during commit',
      404,
    );
  }
  if (result.error === 'REVISION_CONFLICT') {
    throw new GrowthTransitionError(
      OCC_ERROR_REVISION_CONFLICT,
      `Revision conflict: current revision is ${result.current_revision}`,
      409,
      { currentRevision: String(result.current_revision) },
    );
  }
  if (result.error === 'IDEMPOTENCY_KEY_REUSED') {
    throw new GrowthTransitionError(
      OCC_ERROR_IDEMPOTENCY_KEY_REUSED,
      'Idempotency key was already used with a different request',
      409,
    );
  }

  return {
    careEventId: result.care_event_id as string,
    committedRevision: String(result.committed_revision),
    eventSequence: String(result.event_sequence),
    idempotentReplay: result.idempotent_replay as boolean,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// §7.3 — Full transition flow (for Edge Function use)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build the response for a successful care action.
 *
 * §12.1: Response includes the new envelope ETag so the client
 * can poll with If-None-Match.
 */
export function buildSuccessResponse(params: {
  careEventId: string;
  committedRevision: string;
  treeId: string;
  planId: string;
  stateHash: string;
  idempotentReplay: boolean;
}): Record<string, unknown> {
  return {
    ok: true,
    careEventId: params.careEventId,
    revision: params.committedRevision,
    etag: `tree:${params.treeId}:rev:${params.committedRevision}:plan:${params.planId}`,
    stateHash: params.stateHash,
    idempotentReplay: params.idempotentReplay,
  };
}

/**
 * Build the error response for OCC failures.
 */
export function buildErrorResponse(error: GrowthTransitionError): {
  status: number;
  body: Record<string, unknown>;
} {
  return {
    status: error.httpStatus,
    body: {
      ok: false,
      error: error.code,
      message: error.message,
      ...(error.details ?? {}),
    },
  };
}
