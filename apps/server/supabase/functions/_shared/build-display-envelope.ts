/**
 * Display Envelope Builder — Single evaluator for all display surfaces.
 *
 * §12.1: Both get-tree and get-tree-public call this same builder.
 * The private response may wrap owner controls around it, but the
 * embedded envelope is byte-identical.
 *
 * Surfaces served:
 * - ThreeCanvas.tsx (3D renderer)
 * - main3d.ts / main2d.ts (debug renderers)
 * - public-viewer.ts
 * - Looking Glass mode
 * - WebXR mode
 * - CombatSnapshot.ts
 *
 * Spec: ARCH-GROWTH-V3-IMPLEMENTATION-2026-09-25.md §12.
 *
 * @module build-display-envelope
 */

import type {
  TreeDisplayEnvelopeV1,
  GrowthEventV1,
  DayPlanV1,
  ClockState,
  Season,
} from '@kijo/shared';
import {
  V3_ENGINE_VERSION,
  V3_STATE_SCHEMA_VERSION,
  V3_DAY_PLAN_SCHEMA_VERSION,
  V3_PRESENTATION_PALETTE,
  DEFAULT_POLL_INTERVAL_MS,
  GAME_DAY_MS,
  DISPLAY_SEGMENT_MS,
  computeClockState,
  computeSeason,
  buildETag,
  isValidSafeInteger,
  isValidDecimalString,
  isValidSha256Hex,
} from '@kijo/shared';

// ═══════════════════════════════════════════════════════════════════════════
// §12.1 — Envelope builder input
// ═══════════════════════════════════════════════════════════════════════════

export interface EnvelopeInput {
  readonly treeId: string;
  readonly tokenId: string | null;
  readonly revision: string;
  readonly serverNowMs: number;
  readonly bornAtMs: number;
  readonly snapshot: {
    readonly snapshotId: string;
    readonly effectiveAtMs: number;
    readonly dayIndex: number;
    readonly stateHash: string;
    readonly canonicalState: unknown;
  };
  readonly plan: {
    readonly planId: string;
    readonly planHash: string;
    readonly dayIndex: number;
    readonly events: readonly GrowthEventV1[];
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// §12.1 — Envelope builder
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a TreeDisplayEnvelopeV1 from tree state.
 *
 * §12.1: "It excludes wallet IDs, private inventory, authorization data,
 * internal receipts, and future unrevealed entropy."
 *
 * @param input - tree state from DB
 * @param evaluatedAtServerNowHash - hash of the evaluated state at serverNowMs
 * @returns the display envelope
 */
export function buildDisplayEnvelope(
  input: EnvelopeInput,
  evaluatedAtServerNowHash: string,
): TreeDisplayEnvelopeV1 {
  // Input validation (Web3 — all params guarded)
  if (typeof input.treeId !== 'string' || input.treeId.length === 0) {
    throw new Error('buildDisplayEnvelope: invalid treeId');
  }
  if (!isValidDecimalString(input.revision)) {
    throw new Error('buildDisplayEnvelope: invalid revision');
  }
  if (!isValidSafeInteger(input.serverNowMs) || input.serverNowMs < 0) {
    throw new Error('buildDisplayEnvelope: invalid serverNowMs');
  }
  if (!isValidSafeInteger(input.bornAtMs) || input.bornAtMs < 0) {
    throw new Error('buildDisplayEnvelope: invalid bornAtMs');
  }
  if (!isValidSha256Hex(evaluatedAtServerNowHash)) {
    throw new Error('buildDisplayEnvelope: invalid evaluatedAtServerNowHash');
  }

  // Compute clock state for segment info
  const clock = computeClockState(input.serverNowMs, input.bornAtMs);
  if (!clock) {
    throw new Error('buildDisplayEnvelope: serverNowMs is before tree birth');
  }

  // §10.2: Season from dayIndex
  const season = computeSeason(input.snapshot.dayIndex);

  // §12.1: Segment window
  const segmentIndex = clock.segmentIndex;
  const segmentStartMs = clock.segmentStartMs;
  const segmentEndMs = clock.segmentEndMs;

  // Filter events to current segment
  const segmentEvents = input.plan.events.filter(e => e.segmentIndex === segmentIndex);

  // §12.1: ETag = "tree:<treeId>:rev:<revision>:plan:<planId>"
  const etag = buildETag(input.treeId, input.revision, input.plan.planId);

  return {
    envelopeVersion: 1,
    treeId: input.treeId,
    tokenId: input.tokenId,
    engineVersion: V3_ENGINE_VERSION,
    stateSchemaVersion: V3_STATE_SCHEMA_VERSION,
    planSchemaVersion: V3_DAY_PLAN_SCHEMA_VERSION,
    revision: input.revision,
    serverNowMs: input.serverNowMs,
    snapshot: {
      snapshotId: input.snapshot.snapshotId,
      effectiveAtMs: input.snapshot.effectiveAtMs,
      dayIndex: input.snapshot.dayIndex,
      stateHash: input.snapshot.stateHash,
      canonicalState: input.snapshot.canonicalState,
    },
    segment: {
      planId: input.plan.planId,
      planHash: input.plan.planHash,
      segmentIndex,
      startMs: segmentStartMs,
      endMs: segmentEndMs,
      events: segmentEvents,
    },
    evaluatedAtServerNowHash,
    presentation: {
      season,
      paletteVersion: V3_PRESENTATION_PALETTE,
    },
    sync: {
      etag,
      pollAfterMs: DEFAULT_POLL_INTERVAL_MS as 60_000,
      realtimeTopic: `tree:${input.treeId}:revision`,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// §12.2 — Client clock sync helpers
// ═══════════════════════════════════════════════════════════════════════════

import type { ClockSample } from '@kijo/shared';
import { MAX_CLOCK_RTT_MS, MAX_CLOCK_DRIFT_MS } from '@kijo/shared';

/**
 * Compute a clock sample from a round-trip measurement.
 *
 * §12.2: offsetMs = serverNowMs - floor((clientSendMs + clientReceiveMs) / 2)
 */
export function computeClockSample(
  clientSendMs: number,
  clientReceiveMs: number,
  serverNowMs: number,
): ClockSample {
  const roundTripMs = clientReceiveMs - clientSendMs;
  const offsetMs = serverNowMs - Math.floor((clientSendMs + clientReceiveMs) / 2);

  return {
    clientSendMs,
    clientReceiveMs,
    serverNowMs,
    roundTripMs,
    offsetMs,
  };
}

/**
 * Select the median offset from valid clock samples.
 *
 * §12.2: "takes three samples, rejects samples with round-trip time
 * over 2,000 ms, and uses the median offset"
 *
 * @returns median offsetMs, or null if no valid samples
 */
export function selectMedianOffset(samples: readonly ClockSample[]): number | null {
  const valid = samples.filter(s => s.roundTripMs >= 0 && s.roundTripMs <= MAX_CLOCK_RTT_MS);
  if (valid.length === 0) return null;

  const sorted = [...valid].sort((a, b) => a.offsetMs - b.offsetMs);
  const mid = Math.floor(sorted.length / 2);
  return sorted[mid].offsetMs;
}

/**
 * Estimate server time from client time and offset.
 *
 * §12.2: estimatedServerNow = clientNowMs + offsetMs
 */
export function estimateServerNow(clientNowMs: number, offsetMs: number): number {
  return clientNowMs + offsetMs;
}

/**
 * Check if clock offset has drifted beyond threshold.
 *
 * §12.2: resync "when measured clock offset differs by more than 250 ms"
 */
export function hasClockDrifted(currentOffsetMs: number, newOffsetMs: number): boolean {
  return Math.abs(currentOffsetMs - newOffsetMs) > MAX_CLOCK_DRIFT_MS;
}
