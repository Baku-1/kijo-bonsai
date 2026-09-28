/**
 * Growth V3 — Shared Contracts
 *
 * Server-authoritative growth with integer GU/q4 conservation.
 * Spec: ARCH-GROWTH-V3-IMPLEMENTATION-2026-09-25.md §4–§12.
 *
 * All types, constants, validators, and DTOs for the V3 growth system.
 * No runtime logic beyond validation lives here — that belongs in engine.
 *
 * @module @kijo/shared/growth-v3
 */

import type { CareAction, StatSheet, SpeciesClass } from './index.js';
import { VoxelRole } from './index.js';

// ═══════════════════════════════════════════════════════════════════════════
// §4.1 — Version constants
// ═══════════════════════════════════════════════════════════════════════════

export const V3_ENGINE_VERSION = 'growth-v3.0.0' as const;
export const V3_STATE_SCHEMA_VERSION = 3 as const;
export const V3_CARE_EVENT_SCHEMA_VERSION = 2 as const;
export const V3_DAY_PLAN_SCHEMA_VERSION = 1 as const;
export const V3_VOXEL_OWNERSHIP_SCHEMA_VERSION = 2 as const;
export const V3_PRUNE_RECEIPT_SCHEMA_VERSION = 1 as const;
export const V3_DISPLAY_ENVELOPE_SCHEMA_VERSION = 1 as const;
export const V3_CANONICAL_JSON_VERSION = 'kijo-canonical-json-v1' as const;
export const V3_HASH_ALGORITHM = 'sha256' as const;
export const V3_PRESENTATION_PALETTE = 'season-v1' as const;

// ═══════════════════════════════════════════════════════════════════════════
// §4.2 — Birth-anchored clock constants
// ═══════════════════════════════════════════════════════════════════════════

/** One game day = 8 real hours. */
export const GAME_DAY_MS = 28_800_000;

/** One display segment = 4 real hours. */
export const DISPLAY_SEGMENT_MS = 14_400_000;

/** Two segments per game day. */
export const SEGMENTS_PER_DAY = 2;

/** Integer ppm scale for continuous progress. */
export const PROGRESS_SCALE = 1_000_000;

// ═══════════════════════════════════════════════════════════════════════════
// §4.3 / §5.1 — Canonical numeric constants
// ═══════════════════════════════════════════════════════════════════════════

/** 1 GU = 0.0001 canonical voxel³. */
export const GROWTH_UNIT_SCALE = 10_000;

/** π scaled to 6 decimal places, used as integer numerator in cost equations. */
export const PI_Q6 = 3_141_593;

/** Divisor for cylinderCostGU / thickeningCostGU: 10^14. Must be bigint in computations. */
export const COST_DIVISOR = 100_000_000_000_000;

/** Canonical canopy cell cost: exactly 10,000 GU (one voxel³). */
export const CANOPY_CELL_COST_GU = 10_000;

// ═══════════════════════════════════════════════════════════════════════════
// §5.2 — Daily budget constants
// ═══════════════════════════════════════════════════════════════════════════

/** Base daily volume in voxels per species. Multiply by GROWTH_UNIT_SCALE for GU. */
export const BASE_DAILY_VOLUME_VOXELS_V3: Readonly<Record<SpeciesClass, number>> = {
  hardwood: 48,
  evergreen: 38,
  tropical: 60,
};

/** Fertilizer multiplier in basis points (1.25×). */
export const FERTILIZER_FACTOR_BPS = 12_500;

/** Basis point scale denominator. */
export const FACTOR_SCALE = 10_000;

// ═══════════════════════════════════════════════════════════════════════════
// §5.4 — Branch-local sink allocation demands (basis points)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sink demand rows from §5.4 table.
 * Order: [extension, supportThicken, forkSeed, canopy]
 */
export interface SinkDemandBps {
  readonly extension: number;
  readonly supportThicken: number;
  readonly forkSeed: number;
  readonly canopy: number;
}

/** inner or trunk, not fork eligible */
export const SINK_INNER_NO_FORK: SinkDemandBps = {
  extension: 7_000, supportThicken: 3_000, forkSeed: 0, canopy: 0,
};

/** trunk, fork eligible */
export const SINK_TRUNK_FORK: SinkDemandBps = {
  extension: 6_000, supportThicken: 3_000, forkSeed: 1_000, canopy: 0,
};

/** terminal, fork eligible */
export const SINK_TERMINAL_FORK: SinkDemandBps = {
  extension: 6_000, supportThicken: 2_500, forkSeed: 1_000, canopy: 500,
};

/** terminal, not fork eligible */
export const SINK_TERMINAL_NO_FORK: SinkDemandBps = {
  extension: 6_500, supportThicken: 2_500, forkSeed: 0, canopy: 1_000,
};

// ═══════════════════════════════════════════════════════════════════════════
// §10.2 — Season constants
// ═══════════════════════════════════════════════════════════════════════════

/** Game days per season. CONFIRMED by owner 2026-09-26. */
export const SEASON_LENGTH_GAME_DAYS = 90;

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

// ═══════════════════════════════════════════════════════════════════════════
// §9.1 — Stable branch role
// ═══════════════════════════════════════════════════════════════════════════

export type StableBranchRole = 'trunk' | 'arm' | 'leg' | 'digit';

// ═══════════════════════════════════════════════════════════════════════════
// §6.2 — Growth event types
// ═══════════════════════════════════════════════════════════════════════════

export type GrowthEventKind =
  | 'extend'
  | 'support-thicken'
  | 'fork-seed'
  | 'canopy-cell';

/** Priority order for event sorting (§6.1). Lower = higher priority. */
export const GROWTH_EVENT_KIND_PRIORITY: Readonly<Record<GrowthEventKind, number>> = {
  'extend': 0,
  'support-thicken': 1,
  'fork-seed': 2,
  'canopy-cell': 3,
};

export interface GrowthEventV1 {
  readonly schemaVersion: 1;
  readonly eventId: string;
  /** Deterministic entropy derived from plan; prevents rerolling on splice. */
  readonly entropyKey: string;
  readonly sourcePlanId: string;
  readonly branchId: number;
  readonly kind: GrowthEventKind;
  readonly segmentIndex: 0 | 1;
  /** Offset from segment start in ms. */
  readonly startOffsetMs: number;
  /** Offset from segment start in ms. */
  readonly endOffsetMs: number;
  /** Decimal string — allocated GU for this event. */
  readonly allocationGU: string;
  /** Decimal string — actually charged geometry GU. */
  readonly chargedGeometryGU: string;
  /** Decimal string — allocation minus charged (never negative). */
  readonly quantizationReserveGU: string;
  /** q4 values before this event (keys are property names). */
  readonly fromQ4: Readonly<Record<string, number>>;
  /** q4 values after this event. */
  readonly toQ4: Readonly<Record<string, number>>;
  /** Event IDs this event depends on (for splice ordering). */
  readonly dependencies: readonly string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// §7.1 — Care event V2
// ═══════════════════════════════════════════════════════════════════════════

export interface CareActionRequestV2 {
  readonly schemaVersion: 2;
  readonly treeId: string;
  /** Decimal string — current expected revision. */
  readonly expectedRevision: string;
  /** UUID syntax, unique per intended action. */
  readonly idempotencyKey: string;
  readonly action: CareAction;
}

export interface CareEventV2 {
  readonly schemaVersion: 2;
  readonly careEventId: string;
  readonly treeId: string;
  /** Server-assigned acceptance timestamp. */
  readonly acceptedAtMs: number;
  /** Decimal string — monotonic sequence within tree. */
  readonly eventSequence: string;
  /** Decimal string — revision before this event. */
  readonly baseRevision: string;
  /** Decimal string — revision after this event. */
  readonly committedRevision: string;
  readonly idempotencyKey: string;
  readonly action: CareAction;
  readonly priorPlanId: string;
  readonly resultingPlanId: string;
  readonly resultStateHash: string;
  readonly resultPlanHash: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// §8.1 — Voxel ownership V2
// ═══════════════════════════════════════════════════════════════════════════

export type VoxelSourceKind = 'root' | 'wood' | 'canopy' | 'prune-stump';

/** Source-kind priority for owner sorting: lower = higher priority. */
export const VOXEL_SOURCE_KIND_PRIORITY: Readonly<Record<VoxelSourceKind, number>> = {
  'root': 0,
  'wood': 1,
  'prune-stump': 2,
  'canopy': 3,
};

export interface VoxelOwnerV2 {
  /** Event or source identity. */
  readonly ownerId: string;
  readonly branchId: number;
  readonly branchDepth: number;
  readonly sourceKind: VoxelSourceKind;
  readonly material: number; // Material enum value
  readonly role: VoxelRole;
}

export interface VoxelCellV2 {
  readonly owners: readonly VoxelOwnerV2[];
  /** Index into owners for the primary stat/material owner. */
  readonly primaryOwnerIndex: number;
  readonly presentationOverlay?: 'prune-scar';
}

// ═══════════════════════════════════════════════════════════════════════════
// §8.4 — Prune receipt V1
// ═══════════════════════════════════════════════════════════════════════════

export interface PruneReceiptV1 {
  readonly receiptVersion: 1;
  readonly careEventId: string;
  readonly treeId: string;
  readonly targetBranchId: number;
  readonly acceptedAtMs: number;
  /** Decimal string. */
  readonly preRevision: string;
  /** Decimal string. */
  readonly postRevision: string;
  readonly preStateHash: string;
  readonly postStateHash: string;
  readonly preVoxelHash: string;
  readonly postVoxelHash: string;
  readonly removedBranchIds: readonly number[];
  readonly removedLiveVoxelCount: number;
  readonly removedLiveVoxelCountByRole: Readonly<Record<string, number>>;
  readonly removedLiveVoxelDigest: string;
  readonly removedOwnerClaimCount: number;
  readonly overlappingSurvivingVoxelCount: number;
  readonly overlappingSurvivingVoxelDigest: string;
  readonly cancelledEventIds: readonly string[];
  /** Decimal string. */
  readonly cancelledPlannedGrowthGU: string;
  readonly cancelledPlannedVoxelCount: number;
  /** Decimal string. */
  readonly cancelledEscrowGU: string;
  /** Always '0' — no same-day refund in V3. */
  readonly sameDayRefundGU: '0';
  readonly preservedPruneStumpSurfaceCount: number;
  readonly cut: {
    readonly parentBranchId: number;
    readonly removedBranchId: number;
    readonly attachmentQ4: number;
    readonly worldAnchorQ4: readonly [number, number, number];
    readonly tangentQ4: readonly [number, number, number];
  };
  readonly statsBefore: StatSheet;
  readonly statsAfter: StatSheet;
  readonly matchPctBefore: number;
  readonly matchPctAfter: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// §12.1 — Display envelope V1
// ═══════════════════════════════════════════════════════════════════════════

export interface TreeDisplayEnvelopeV1 {
  readonly envelopeVersion: 1;
  readonly treeId: string;
  readonly tokenId: string | null;
  readonly engineVersion: typeof V3_ENGINE_VERSION;
  readonly stateSchemaVersion: typeof V3_STATE_SCHEMA_VERSION;
  readonly planSchemaVersion: typeof V3_DAY_PLAN_SCHEMA_VERSION;
  /** Decimal string. */
  readonly revision: string;
  readonly serverNowMs: number;
  readonly snapshot: {
    readonly snapshotId: string;
    readonly effectiveAtMs: number;
    readonly dayIndex: number;
    readonly stateHash: string;
    readonly canonicalState: unknown;
  };
  readonly segment: {
    readonly planId: string;
    readonly planHash: string;
    readonly segmentIndex: 0 | 1;
    readonly startMs: number;
    readonly endMs: number;
    readonly events: readonly GrowthEventV1[];
  };
  readonly evaluatedAtServerNowHash: string;
  readonly presentation: {
    readonly season: Season;
    readonly paletteVersion: typeof V3_PRESENTATION_PALETTE;
  };
  readonly sync: {
    readonly etag: string;
    readonly pollAfterMs: 60_000;
    readonly realtimeTopic: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// §6.1 — Immutable ID hash input arrays
// ═══════════════════════════════════════════════════════════════════════════

export const HASH_PREFIX_DAY_PLAN = 'kijo-day-plan-v1' as const;
export const HASH_PREFIX_GROWTH_EVENT = 'kijo-growth-event-v1' as const;
export const HASH_PREFIX_PLAN_SPLICE = 'kijo-plan-splice-v1' as const;
export const HASH_PREFIX_EVENT_REPLACEMENT = 'kijo-event-replacement-v1' as const;
export const HASH_PREFIX_CARE_EVENT = 'kijo-care-event-v2' as const;

// ═══════════════════════════════════════════════════════════════════════════
// §5.5 — Conservation ledger categories
// ═══════════════════════════════════════════════════════════════════════════

/** Per-branch ledger breakdown for conservation assertions. */
export interface BranchLedgerV1 {
  readonly branchId: number;
  /** Decimal string — total allocation from day budget. */
  readonly allocationGU: string;
  /** Decimal string — geometry already materialized. */
  readonly materializedGeometryGU: string;
  /** Decimal string — future events not yet materialized. */
  readonly activeFutureEventGU: string;
  /** Decimal string — fork/canopy escrow from prior days. */
  readonly branchEscrowGU: string;
  /** Decimal string — cancelled by prune/jin. */
  readonly cancelledGU: string;
  /** Decimal string — rounding remainder. */
  readonly quantizationReserveGU: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// §6.3 — Day plan shape
// ═══════════════════════════════════════════════════════════════════════════

export interface DayPlanV1 {
  readonly schemaVersion: 1;
  readonly planId: string;
  readonly treeId: string;
  readonly engineVersion: typeof V3_ENGINE_VERSION;
  readonly dayIndex: number;
  readonly baseRevision: string;
  readonly dayStartStateHash: string;
  /** Decimal string — total daily budget in GU. */
  readonly dailyGrowthBudgetGU: string;
  readonly branchAllocations: readonly BranchAllocationV1[];
  readonly events: readonly GrowthEventV1[];
  readonly planHash: string;
}

export interface BranchAllocationV1 {
  readonly branchId: number;
  /** Decimal string — total allocation for this branch this day. */
  readonly allocationGU: string;
  /** Integer weight used in largest-remainder. */
  readonly weightU: number;
  readonly segment0GU: string;
  readonly segment1GU: string;
  readonly sinkDemands: SinkDemandBps;
}

// ═══════════════════════════════════════════════════════════════════════════
// §4.2 — Clock computation helpers (pure, no side effects)
// ═══════════════════════════════════════════════════════════════════════════

export interface ClockState {
  readonly elapsedMs: number;
  readonly dayIndex: number;
  readonly dayStartMs: number;
  readonly segmentIndex: 0 | 1;
  readonly segmentStartMs: number;
  readonly segmentEndMs: number;
  readonly progressPpm: number;
}

/**
 * Compute birth-anchored clock state from absolute time and birth timestamp.
 * All values are integers. Returns null if t < bornAtMs.
 */
export function computeClockState(t: number, bornAtMs: number): ClockState | null {
  const elapsedMs = t - bornAtMs;
  if (elapsedMs < 0) return null;

  const dayIndex = Math.floor(elapsedMs / GAME_DAY_MS);
  const dayStartMs = bornAtMs + dayIndex * GAME_DAY_MS;
  const dayElapsed = t - dayStartMs;
  const segmentIndex = (Math.floor(dayElapsed / DISPLAY_SEGMENT_MS) === 0 ? 0 : 1) as 0 | 1;
  const segmentStartMs = dayStartMs + segmentIndex * DISPLAY_SEGMENT_MS;
  const segmentEndMs = segmentStartMs + DISPLAY_SEGMENT_MS;

  const progressPpm = Math.max(0, Math.min(
    PROGRESS_SCALE,
    Math.floor((t - segmentStartMs) * PROGRESS_SCALE / DISPLAY_SEGMENT_MS),
  ));

  return {
    elapsedMs,
    dayIndex,
    dayStartMs,
    segmentIndex,
    segmentStartMs,
    segmentEndMs,
    progressPpm,
  };
}

/**
 * Derive season from dayIndex.
 * §10.2: seasonIndex = floor(dayIndex / 90) mod 4
 */
export function computeSeason(dayIndex: number): Season {
  const seasonIndex = Math.floor(dayIndex / SEASON_LENGTH_GAME_DAYS) % 4;
  const seasons: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];
  return seasons[seasonIndex];
}

// ═══════════════════════════════════════════════════════════════════════════
// §4.3 / §13 — Strict validators (invariant 13)
// ═══════════════════════════════════════════════════════════════════════════

/** Reject NaN, Infinity, -Infinity, -0, non-integer, or unsafe integer. */
export function isValidSafeInteger(v: unknown): v is number {
  if (typeof v !== 'number') return false;
  if (!Number.isFinite(v)) return false;
  if (!Number.isSafeInteger(v)) return false;
  // Reject -0
  if (v === 0 && 1 / v === -Infinity) return false;
  return true;
}

/** Validate a non-negative safe integer (for GU amounts, counts). */
export function isValidNonNegativeInteger(v: unknown): v is number {
  return isValidSafeInteger(v) && (v as number) >= 0;
}

/** Validate a q4 value: must be a safe integer. */
export function isValidQ4(v: unknown): v is number {
  return isValidSafeInteger(v);
}

/** Validate a non-negative q4 value. */
export function isValidNonNegativeQ4(v: unknown): v is number {
  return isValidSafeInteger(v) && (v as number) >= 0;
}

/**
 * Validate a decimal string representing a non-negative integer.
 * Used for GU amounts and revision numbers in JSON.
 */
export function isValidDecimalString(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  if (v.length === 0) return false;
  // Must match /^(0|[1-9][0-9]*)$/
  if (!/^(0|[1-9][0-9]*)$/.test(v)) return false;
  return true;
}

/**
 * Validate a SHA-256 hex digest: 64 lowercase hex chars.
 */
export function isValidSha256Hex(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  return /^[0-9a-f]{64}$/.test(v);
}

/**
 * Validate a UUID v4 string (lowercase with hyphens).
 */
export function isValidUuidV4(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
}

/** Validate segment index: exactly 0 or 1. */
export function isValidSegmentIndex(v: unknown): v is 0 | 1 {
  return v === 0 || v === 1;
}

/** Validate growth event kind string. */
export function isValidGrowthEventKind(v: unknown): v is GrowthEventKind {
  return v === 'extend' || v === 'support-thicken' || v === 'fork-seed' || v === 'canopy-cell';
}

/** Validate voxel source kind string. */
export function isValidVoxelSourceKind(v: unknown): v is VoxelSourceKind {
  return v === 'root' || v === 'wood' || v === 'canopy' || v === 'prune-stump';
}

/** Validate stable branch role string. */
export function isValidStableBranchRole(v: unknown): v is StableBranchRole {
  return v === 'trunk' || v === 'arm' || v === 'leg' || v === 'digit';
}

/** Validate season string. */
export function isValidSeason(v: unknown): v is Season {
  return v === 'spring' || v === 'summer' || v === 'autumn' || v === 'winter';
}

/**
 * Validate a progress ppm value: integer in [0, PROGRESS_SCALE].
 */
export function isValidProgressPpm(v: unknown): v is number {
  return isValidSafeInteger(v) && (v as number) >= 0 && (v as number) <= PROGRESS_SCALE;
}

/**
 * Reject an object that has keys not in the allowed set.
 * Returns the first unknown key, or null if clean.
 */
export function findUnknownKey(
  obj: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
): string | null {
  for (const key of Object.keys(obj)) {
    if (!allowedKeys.has(key)) return key;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// §4.3 — q4 conversion helpers
// ═══════════════════════════════════════════════════════════════════════════

/** Convert a float value to q4 integer: round(value * 10_000). */
export function toQ4(value: number): number {
  return Math.round(value * 10_000);
}

/** Convert a q4 integer back to float (renderer edge only). */
export function fromQ4(q4Value: number): number {
  return q4Value / 10_000;
}

// ═══════════════════════════════════════════════════════════════════════════
// §12.2 — Client clock synchronization types
// ═══════════════════════════════════════════════════════════════════════════

export interface ClockSample {
  readonly clientSendMs: number;
  readonly clientReceiveMs: number;
  readonly serverNowMs: number;
  readonly roundTripMs: number;
  readonly offsetMs: number;
}

/** Maximum acceptable round-trip time for clock samples (ms). */
export const MAX_CLOCK_RTT_MS = 2_000;

/** Maximum clock offset drift before forced resync (ms). */
export const MAX_CLOCK_DRIFT_MS = 250;

/** Default poll interval (ms). */
export const DEFAULT_POLL_INTERVAL_MS = 60_000;

// ═══════════════════════════════════════════════════════════════════════════
// §7.2 — Revision type alias
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Revision is a decimal string representation of a monotonically increasing bigint.
 * Never use as a number — JS loses precision past 2^53.
 */
export type Revision = string;

// ═══════════════════════════════════════════════════════════════════════════
// §7.3 — OCC error codes
// ═══════════════════════════════════════════════════════════════════════════

export const OCC_ERROR_REVISION_CONFLICT = 'REVISION_CONFLICT' as const;
export const OCC_ERROR_IDEMPOTENCY_KEY_REUSED = 'IDEMPOTENCY_KEY_REUSED' as const;
export const OCC_ERROR_RETRYABLE = 'RETRYABLE' as const;
export const OCC_ERROR_REBASELINE_REQUIRED = 'REBASELINE_REQUIRED' as const;

export type OccErrorCode =
  | typeof OCC_ERROR_REVISION_CONFLICT
  | typeof OCC_ERROR_IDEMPOTENCY_KEY_REUSED
  | typeof OCC_ERROR_RETRYABLE
  | typeof OCC_ERROR_REBASELINE_REQUIRED;

// ═══════════════════════════════════════════════════════════════════════════
// §11.2 — Rebaseline status
// ═══════════════════════════════════════════════════════════════════════════

export type RebaselineStatus = 'pending' | 'ready' | 'quarantined';

// ═══════════════════════════════════════════════════════════════════════════
// §5.4.1 — Escrow state per branch
// ═══════════════════════════════════════════════════════════════════════════

export interface BranchEscrowState {
  /** Accumulated fork escrow in GU (decimal string). */
  readonly forkEscrowGU: string;
  /** Accumulated canopy escrow in GU (decimal string). */
  readonly canopyEscrowGU: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// §6.2 — Emergence window for fork/canopy events
// ═══════════════════════════════════════════════════════════════════════════

/** 15-minute emergence window in ms. */
export const EMERGENCE_WINDOW_MS = 15 * 60 * 1_000; // 900_000

// ═══════════════════════════════════════════════════════════════════════════
// §5.3 — Weight computation constants
// ═══════════════════════════════════════════════════════════════════════════

/** Scale for integer weight computation: rawWeight * 1_000_000. */
export const WEIGHT_SCALE = 1_000_000;

// ═══════════════════════════════════════════════════════════════════════════
// §12.1 — ETag format
// ═══════════════════════════════════════════════════════════════════════════

/** Build the canonical ETag string for a tree revision + plan. */
export function buildETag(treeId: string, revision: string, planId: string): string {
  return `tree:${treeId}:rev:${revision}:plan:${planId}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// §5.4 — Genesis baseline marker
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Genesis and rebaseline geometry source kind.
 * Not charged against dailyGrowthBudgetGU (FINDING-9).
 */
export const GENESIS_BASELINE = 'GENESIS_BASELINE' as const;
export const LEGACY_REBASELINE_BASELINE = 'LEGACY_REBASELINE_BASELINE' as const;

// ═══════════════════════════════════════════════════════════════════════════
// §10.1 — Canopy eligibility constants
// ═══════════════════════════════════════════════════════════════════════════

/** Minimum completed game days before a branch is canopy-eligible. */
export const CANOPY_MIN_AGE_DAYS = 2;

/** Minimum health for canopy eligibility. */
export const CANOPY_MIN_HEALTH = 40;

// ═══════════════════════════════════════════════════════════════════════════
// §10.1 — Species canopy predicates (integer ellipsoid semi-axes)
// ═══════════════════════════════════════════════════════════════════════════

export interface CanopyEllipsoidParams {
  /** Semi-axis in X. */
  readonly ax: number;
  /** Semi-axis in Y (vertical). */
  readonly ay: number;
  /** Semi-axis in Z. */
  readonly az: number;
  /** Optional: minimum Y offset (for tropical y >= -1 constraint). */
  readonly minY?: number;
}

export const CANOPY_ELLIPSOID: Readonly<Record<SpeciesClass, CanopyEllipsoidParams>> = {
  hardwood: { ax: 3, ay: 2, az: 3 },
  evergreen: { ax: 4, ay: 1, az: 3 },
  tropical: { ax: 4, ay: 2, az: 4, minY: -1 },
};

// ═══════════════════════════════════════════════════════════════════════════
// Composite validation: GrowthEventV1
// ═══════════════════════════════════════════════════════════════════════════

const GROWTH_EVENT_V1_KEYS = new Set([
  'schemaVersion', 'eventId', 'entropyKey', 'sourcePlanId', 'branchId',
  'kind', 'segmentIndex', 'startOffsetMs', 'endOffsetMs', 'allocationGU',
  'chargedGeometryGU', 'quantizationReserveGU', 'fromQ4', 'toQ4', 'dependencies',
]);

/**
 * Validate a GrowthEventV1 object. Returns null if valid, or an error string.
 */
export function validateGrowthEventV1(e: unknown): string | null {
  if (e === null || typeof e !== 'object') return 'not an object';
  const obj = e as Record<string, unknown>;

  const unknown = findUnknownKey(obj, GROWTH_EVENT_V1_KEYS);
  if (unknown !== null) return `unknown field: ${unknown}`;

  if (obj.schemaVersion !== 1) return 'schemaVersion must be 1';
  if (!isValidSha256Hex(obj.eventId)) return 'invalid eventId';
  if (typeof obj.entropyKey !== 'string' || obj.entropyKey.length === 0) return 'invalid entropyKey';
  if (!isValidSha256Hex(obj.sourcePlanId)) return 'invalid sourcePlanId';
  if (!isValidNonNegativeInteger(obj.branchId)) return 'invalid branchId';
  if (!isValidGrowthEventKind(obj.kind)) return 'invalid kind';
  if (!isValidSegmentIndex(obj.segmentIndex)) return 'invalid segmentIndex';
  if (!isValidNonNegativeInteger(obj.startOffsetMs)) return 'invalid startOffsetMs';
  if (!isValidNonNegativeInteger(obj.endOffsetMs)) return 'invalid endOffsetMs';
  if (!isValidDecimalString(obj.allocationGU)) return 'invalid allocationGU';
  if (!isValidDecimalString(obj.chargedGeometryGU)) return 'invalid chargedGeometryGU';
  if (!isValidDecimalString(obj.quantizationReserveGU)) return 'invalid quantizationReserveGU';

  if (obj.fromQ4 === null || typeof obj.fromQ4 !== 'object') return 'invalid fromQ4';
  for (const v of Object.values(obj.fromQ4 as Record<string, unknown>)) {
    if (!isValidQ4(v)) return 'invalid fromQ4 value';
  }

  if (obj.toQ4 === null || typeof obj.toQ4 !== 'object') return 'invalid toQ4';
  for (const v of Object.values(obj.toQ4 as Record<string, unknown>)) {
    if (!isValidQ4(v)) return 'invalid toQ4 value';
  }

  if (!Array.isArray(obj.dependencies)) return 'dependencies must be array';
  for (const dep of obj.dependencies) {
    if (!isValidSha256Hex(dep)) return 'invalid dependency eventId';
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Composite validation: CareActionRequestV2
// ═══════════════════════════════════════════════════════════════════════════

const CARE_REQUEST_V2_KEYS = new Set([
  'schemaVersion', 'treeId', 'expectedRevision', 'idempotencyKey', 'action',
]);

/**
 * Validate a CareActionRequestV2 object. Returns null if valid, or an error string.
 */
export function validateCareActionRequestV2(r: unknown): string | null {
  if (r === null || typeof r !== 'object') return 'not an object';
  const obj = r as Record<string, unknown>;

  const unknown = findUnknownKey(obj, CARE_REQUEST_V2_KEYS);
  if (unknown !== null) return `unknown field: ${unknown}`;

  if (obj.schemaVersion !== 2) return 'schemaVersion must be 2';
  if (typeof obj.treeId !== 'string' || obj.treeId.length === 0) return 'invalid treeId';
  if (!isValidDecimalString(obj.expectedRevision)) return 'invalid expectedRevision';
  if (!isValidUuidV4(obj.idempotencyKey)) return 'invalid idempotencyKey';
  if (obj.action === null || typeof obj.action !== 'object') return 'invalid action';

  return null;
}
