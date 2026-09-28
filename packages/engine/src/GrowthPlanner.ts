/**
 * Growth Planner — Immutable Day Plan Creation
 *
 * Creates an immutable day plan from a day-start snapshot:
 * 1. Captures branch weights from frozen topology (§5.3).
 * 2. Allocates daily budget via largest-remainder (§5.3).
 * 3. Splits per-branch allocation into sink demands (§5.4).
 * 4. Schedules growth events with content-addressed IDs (§6.1–6.2).
 * 5. Splits events across two display segments (§5.5).
 *
 * Spec: ARCH-GROWTH-V3-IMPLEMENTATION-2026-09-25.md §5–§6.
 *
 * @module @kijo/engine/GrowthPlanner
 */

import type {
  Branch,
  SpeciesClass,
  GrowthEventV1,
  GrowthEventKind,
  DayPlanV1,
  BranchAllocationV1,
  SinkDemandBps,
  BranchEscrowState,
} from '@kijo/shared';
import {
  V3_ENGINE_VERSION,
  V3_DAY_PLAN_SCHEMA_VERSION,
  DISPLAY_SEGMENT_MS,
  EMERGENCE_WINDOW_MS,
  WEIGHT_SCALE,
  GROWTH_EVENT_KIND_PRIORITY,
  SINK_INNER_NO_FORK,
  SINK_TRUNK_FORK,
  SINK_TERMINAL_FORK,
  SINK_TERMINAL_NO_FORK,
  CANOPY_CELL_COST_GU,
  SPECIES_PARAMS,
  spatialHash,
  toQ4,
} from '@kijo/shared';
import {
  computeDailyBudgetGU,
  largestRemainderAllocate,
  allocateSinks,
  splitSegments,
  cylinderCostGU,
  type DayStartFactors,
  type AllocationEntry,
} from './GrowthLedger.js';
import {
  contentAddressedId,
  canonicalHash,
} from './CanonicalHash.js';

// ═══════════════════════════════════════════════════════════════════════════
// §5.3 — Branch weight computation
// ═══════════════════════════════════════════════════════════════════════════

export interface BranchWeightInput {
  readonly branch: Readonly<Branch>;
  readonly isLeader: boolean;
  readonly isTip: boolean;
  readonly isForked: boolean; // trunk has forked (has living children)
  readonly isForkEligible: boolean;
  readonly isCanopyEligible: boolean;
}

/**
 * Compute the integer weight for a branch (§5.3).
 *
 * roleFactor:
 *   unbranched trunk           → 1.0
 *   branched trunk             → trunkContinuedRate
 *   leader tip                 → 1.0
 *   subordinate tip            → 1 - apicalDominance * 0.5
 *   inner leader               → parentExtensionRate
 *   inner subordinate          → parentExtensionRate * (1 - apicalDominance * 0.5)
 *
 * rawWeight = extensionMultiplier * depthFalloffBase^depth * roleFactor
 * weightU = max(1, floor(rawWeight * 1_000_000))
 */
export function computeBranchWeight(
  input: BranchWeightInput,
  species: SpeciesClass,
): number {
  const params = SPECIES_PARAMS[species];
  const b = input.branch;

  let roleFactor: number;
  if (b.depth === 0) {
    // Trunk
    roleFactor = input.isForked ? params.trunkContinuedRate : 1.0;
  } else if (input.isTip) {
    // Tip branch (no living children)
    roleFactor = input.isLeader ? 1.0 : 1 - params.apicalDominance * 0.5;
  } else {
    // Inner branch (has living children)
    roleFactor = input.isLeader
      ? params.parentExtensionRate
      : params.parentExtensionRate * (1 - params.apicalDominance * 0.5);
  }

  const rawWeight = params.extensionMultiplier
    * Math.pow(params.depthFalloffBase, b.depth)
    * roleFactor;

  return Math.max(1, Math.floor(rawWeight * WEIGHT_SCALE));
}

/**
 * Determine if a branch is the leader among its siblings.
 * Leader: longest living sibling, then lowest branchId.
 */
export function isLeaderBranch(
  branch: Readonly<Branch>,
  allBranches: readonly Readonly<Branch>[],
): boolean {
  if (branch.parent === null) return true; // Trunk is always leader

  const parent = allBranches[branch.parent];
  if (!parent) return true;

  const liveSiblings = parent.children
    .map(id => allBranches[id])
    .filter(b => b && !b.pruned && !b.jinned);

  if (liveSiblings.length === 0) return true;

  // Sort by length descending, then id ascending
  const sorted = [...liveSiblings].sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    return a.id - b.id;
  });

  return sorted[0].id === branch.id;
}

// ═══════════════════════════════════════════════════════════════════════════
// §5.4 — Sink demand selection
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Select the sink demand row for a branch based on its day-start state.
 */
export function selectSinkDemands(
  branch: Readonly<Branch>,
  isTip: boolean,
  isForkEligible: boolean,
): SinkDemandBps {
  if (branch.depth === 0) {
    // Trunk
    return isForkEligible ? SINK_TRUNK_FORK : SINK_INNER_NO_FORK;
  }

  if (isTip) {
    return isForkEligible ? SINK_TERMINAL_FORK : SINK_TERMINAL_NO_FORK;
  }

  // Inner non-trunk
  return isForkEligible ? SINK_TRUNK_FORK : SINK_INNER_NO_FORK;
}

// ═══════════════════════════════════════════════════════════════════════════
// §6.2 — Event scheduling
// ═══════════════════════════════════════════════════════════════════════════

interface PendingEvent {
  branchId: number;
  kind: GrowthEventKind;
  segmentIndex: 0 | 1;
  startOffsetMs: number;
  endOffsetMs: number;
  allocationGU: number;
  fromQ4: Record<string, number>;
  toQ4: Record<string, number>;
  chargedGeometryGU: number;
  quantizationReserveGU: number;
  dependencies: string[];
  localOrdinal: number;
}

/**
 * Schedule growth events for a branch within a segment.
 *
 * Continuous events (extend, support-thicken) span the full segment.
 * Discrete events (fork-seed, canopy-cell) use a 15-minute emergence window
 * positioned deterministically by spatialHash.
 */
export function scheduleSegmentEvents(
  branchId: number,
  segmentIndex: 0 | 1,
  segmentGU: number,
  sinks: { extension: number; supportThicken: number; forkSeed: number; canopy: number },
  branch: Readonly<Branch>,
  seed: number,
  dayIndex: number,
  escrow: BranchEscrowState,
): PendingEvent[] {
  const events: PendingEvent[] = [];
  let localOrdinal = 0;

  // Extension event — spans full segment
  if (sinks.extension > 0) {
    const rQ4 = toQ4(branch.thickness);
    // Extension: we'll compute the max delta length within budget
    // For now, record the allocation; materializer resolves exact geometry.
    events.push({
      branchId,
      kind: 'extend',
      segmentIndex,
      startOffsetMs: 0,
      endOffsetMs: DISPLAY_SEGMENT_MS,
      allocationGU: sinks.extension,
      fromQ4: { lengthQ4: toQ4(branch.length), radiusQ4: rQ4 },
      toQ4: { lengthQ4: toQ4(branch.length), radiusQ4: rQ4 }, // Materializer fills actual toQ4
      chargedGeometryGU: 0, // Materializer fills
      quantizationReserveGU: sinks.extension, // Materializer adjusts
      dependencies: [],
      localOrdinal: localOrdinal++,
    });
  }

  // Support thickening — spans full segment
  if (sinks.supportThicken > 0) {
    const rQ4 = toQ4(branch.thickness);
    const lQ4 = toQ4(branch.length);
    events.push({
      branchId,
      kind: 'support-thicken',
      segmentIndex,
      startOffsetMs: 0,
      endOffsetMs: DISPLAY_SEGMENT_MS,
      allocationGU: sinks.supportThicken,
      fromQ4: { radiusQ4: rQ4, lengthQ4: lQ4 },
      toQ4: { radiusQ4: rQ4, lengthQ4: lQ4 }, // Materializer fills
      chargedGeometryGU: 0,
      quantizationReserveGU: sinks.supportThicken,
      dependencies: [],
      localOrdinal: localOrdinal++,
    });
  }

  // Fork seed — discrete 15-minute window, deterministic start
  if (sinks.forkSeed > 0) {
    const totalEscrow = parseInt(escrow.forkEscrowGU || '0', 10) + sinks.forkSeed;
    // Check if fork is affordable (we'd need initial child dimensions to know cost)
    // For now, record the event; planner resolves affordability after escrow addition.
    const startMs = computeEmergenceStart(seed, dayIndex, branchId, localOrdinal);
    events.push({
      branchId,
      kind: 'fork-seed',
      segmentIndex,
      startOffsetMs: startMs,
      endOffsetMs: startMs + EMERGENCE_WINDOW_MS,
      allocationGU: sinks.forkSeed,
      fromQ4: {},
      toQ4: {},
      chargedGeometryGU: 0,
      quantizationReserveGU: sinks.forkSeed,
      dependencies: [],
      localOrdinal: localOrdinal++,
    });
  }

  // Canopy cell — discrete 15-minute window
  if (sinks.canopy > 0) {
    const startMs = computeEmergenceStart(seed, dayIndex, branchId, localOrdinal);
    events.push({
      branchId,
      kind: 'canopy-cell',
      segmentIndex,
      startOffsetMs: startMs,
      endOffsetMs: startMs + EMERGENCE_WINDOW_MS,
      allocationGU: sinks.canopy,
      fromQ4: {},
      toQ4: {},
      chargedGeometryGU: 0,
      quantizationReserveGU: sinks.canopy,
      dependencies: [],
      localOrdinal: localOrdinal++,
    });
  }

  return events;
}

/**
 * Compute deterministic emergence start within a segment.
 * Uses spatialHash to place a 15-minute window within the valid range.
 */
function computeEmergenceStart(
  seed: number,
  dayIndex: number,
  branchId: number,
  localOrdinal: number,
): number {
  const maxStart = DISPLAY_SEGMENT_MS - EMERGENCE_WINDOW_MS;
  if (maxStart <= 0) return 0;
  const hash = spatialHash(seed, dayIndex, branchId, localOrdinal);
  return Math.floor((hash / 0xFFFFFFFF) * maxStart);
}

// ═══════════════════════════════════════════════════════════════════════════
// §6.1 — Event sorting for ordinal assignment
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sort events by (segmentIndex, startOffsetMs, kindPriority, branchId, localOrdinal).
 * Returns sorted array; does not mutate input.
 */
export function sortEventsForOrdinal(events: readonly PendingEvent[]): PendingEvent[] {
  return [...events].sort((a, b) => {
    if (a.segmentIndex !== b.segmentIndex) return a.segmentIndex - b.segmentIndex;
    if (a.startOffsetMs !== b.startOffsetMs) return a.startOffsetMs - b.startOffsetMs;
    const aPri = GROWTH_EVENT_KIND_PRIORITY[a.kind];
    const bPri = GROWTH_EVENT_KIND_PRIORITY[b.kind];
    if (aPri !== bPri) return aPri - bPri;
    if (a.branchId !== b.branchId) return a.branchId - b.branchId;
    return a.localOrdinal - b.localOrdinal;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// §5.3 + §6 — Full day plan creation
// ═══════════════════════════════════════════════════════════════════════════

export interface PlanInput {
  readonly treeId: string;
  readonly seed: number;
  readonly species: SpeciesClass;
  readonly dayIndex: number;
  readonly baseRevision: string;
  readonly dayStartStateHash: string;
  readonly branches: readonly Readonly<Branch>[];
  readonly dayStartFactors: DayStartFactors;
  readonly escrowStates: ReadonlyMap<number, BranchEscrowState>;
}

/**
 * Create a complete immutable day plan.
 *
 * Steps:
 * 1. Compute daily budget from day-start factors.
 * 2. Identify eligible branches and compute weights.
 * 3. Allocate budget via largest-remainder.
 * 4. For each branch, determine sink demands and allocate sinks.
 * 5. Schedule events across both segments.
 * 6. Sort events and assign content-addressed IDs.
 * 7. Compute plan hash.
 */
export async function createDayPlan(input: PlanInput): Promise<DayPlanV1> {
  const { treeId, seed, species, dayIndex, baseRevision, dayStartStateHash, branches } = input;

  // 1. Compute daily budget
  const dailyBudgetGU = computeDailyBudgetGU(input.dayStartFactors);

  // 2. Identify eligible branches and compute weights
  const eligibleBranches: BranchWeightInput[] = [];
  for (const b of branches) {
    if (b.pruned || b.jinned) continue;

    const liveSiblings = b.parent !== null
      ? branches[b.parent]?.children.filter(id => branches[id] && !branches[id].pruned && !branches[id].jinned) ?? []
      : [];
    const hasLivingChildren = b.children.some(id => branches[id] && !branches[id].pruned && !branches[id].jinned);

    eligibleBranches.push({
      branch: b,
      isLeader: isLeaderBranch(b, branches),
      isTip: !hasLivingChildren,
      isForked: b.depth === 0 ? b.children.some(id => branches[id] && !branches[id].pruned && !branches[id].jinned) : false,
      isForkEligible: false, // TODO: V2 fork maturity/internode rules — planner resolves in Phase 3 refinement
      isCanopyEligible: false, // TODO: canopy eligibility from §10.1 — resolved by CanopyGrammar
    });
  }

  // 3. Allocate budget via largest-remainder
  const weightEntries: AllocationEntry[] = eligibleBranches.map(bw => ({
    id: bw.branch.id,
    weight: computeBranchWeight(bw, species),
  }));

  const allocations = largestRemainderAllocate(dailyBudgetGU, weightEntries);
  const allocationMap = new Map(allocations.map(a => [a.id, a.allocation]));

  // 4–5. For each branch, determine sinks and schedule events
  const allPendingEvents: PendingEvent[] = [];
  const branchAllocations: BranchAllocationV1[] = [];

  for (const bw of eligibleBranches) {
    const branchId = bw.branch.id;
    const allocation = allocationMap.get(branchId) ?? 0;
    const { segment0GU, segment1GU } = splitSegments(allocation);
    const demands = selectSinkDemands(bw.branch, bw.isTip, bw.isForkEligible);

    // Allocate sinks per segment
    const sinks0 = allocateSinks(segment0GU, demands);
    const sinks1 = allocateSinks(segment1GU, demands);

    const escrow = input.escrowStates.get(branchId) ?? { forkEscrowGU: '0', canopyEscrowGU: '0' };

    // Schedule events for each segment
    const seg0Events = scheduleSegmentEvents(branchId, 0, segment0GU, sinks0, bw.branch, seed, dayIndex, escrow);
    const seg1Events = scheduleSegmentEvents(branchId, 1, segment1GU, sinks1, bw.branch, seed, dayIndex, escrow);

    allPendingEvents.push(...seg0Events, ...seg1Events);

    branchAllocations.push({
      branchId,
      allocationGU: String(allocation),
      weightU: weightEntries.find(e => e.id === branchId)!.weight,
      segment0GU: String(segment0GU),
      segment1GU: String(segment1GU),
      sinkDemands: demands,
    });
  }

  // 6. Sort events and assign content-addressed IDs
  const sortedPending = sortEventsForOrdinal(allPendingEvents);

  // Compute plan ID first (events need it)
  const planId = await contentAddressedId([
    'kijo-day-plan-v1', treeId, V3_ENGINE_VERSION,
    dayIndex, baseRevision, dayStartStateHash,
  ]);

  // Assign event IDs
  const finalEvents: GrowthEventV1[] = [];
  for (let i = 0; i < sortedPending.length; i++) {
    const pe = sortedPending[i];
    const eventId = await contentAddressedId([
      'kijo-growth-event-v1', planId, pe.branchId,
      pe.kind, i, // eventOrdinal = sorted index
    ]);

    // Entropy key is deterministic from plan + branch + ordinal
    const entropyKey = await contentAddressedId([
      'kijo-entropy-v1', planId, pe.branchId, pe.kind, i,
    ]);

    finalEvents.push({
      schemaVersion: 1,
      eventId,
      entropyKey,
      sourcePlanId: planId,
      branchId: pe.branchId,
      kind: pe.kind,
      segmentIndex: pe.segmentIndex,
      startOffsetMs: pe.startOffsetMs,
      endOffsetMs: pe.endOffsetMs,
      allocationGU: String(pe.allocationGU),
      chargedGeometryGU: String(pe.chargedGeometryGU),
      quantizationReserveGU: String(pe.quantizationReserveGU),
      fromQ4: pe.fromQ4,
      toQ4: pe.toQ4,
      dependencies: pe.dependencies,
    });
  }

  // 7. Compute plan hash
  const planHash = await canonicalHash({
    schemaVersion: V3_DAY_PLAN_SCHEMA_VERSION,
    planId,
    treeId,
    engineVersion: V3_ENGINE_VERSION,
    dayIndex,
    baseRevision,
    dayStartStateHash,
    dailyGrowthBudgetGU: String(dailyBudgetGU),
    branchAllocations,
    events: finalEvents,
  });

  return {
    schemaVersion: V3_DAY_PLAN_SCHEMA_VERSION,
    planId,
    treeId,
    engineVersion: V3_ENGINE_VERSION,
    dayIndex,
    baseRevision,
    dayStartStateHash,
    dailyGrowthBudgetGU: String(dailyBudgetGU),
    branchAllocations,
    events: finalEvents,
    planHash,
  };
}
