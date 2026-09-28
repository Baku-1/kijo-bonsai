/**
 * Growth Ledger — Integer Physical-Cost Functions & Largest-Remainder Allocation
 *
 * All arithmetic uses bigint for intermediate products to prevent overflow (FINDING-10).
 * Persisted amounts are non-negative safe integers serialized as decimal strings.
 *
 * Spec: ARCH-GROWTH-V3-IMPLEMENTATION-2026-09-25.md §5.
 *
 * @module @kijo/engine/GrowthLedger
 */

import {
  PI_Q6,
  COST_DIVISOR,
  GROWTH_UNIT_SCALE,
  CANOPY_CELL_COST_GU,
  BASE_DAILY_VOLUME_VOXELS_V3,
  FERTILIZER_FACTOR_BPS,
  FACTOR_SCALE,
  type SpeciesClass,
  type SinkDemandBps,
} from '@kijo/shared';

// ═══════════════════════════════════════════════════════════════════════════
// Bigint constants (evaluated once)
// ═══════════════════════════════════════════════════════════════════════════

const PI_Q6_BIG = BigInt(PI_Q6);
const COST_DIVISOR_BIG = BigInt(COST_DIVISOR);

// ═══════════════════════════════════════════════════════════════════════════
// §5.1 — Physical cost functions (bigint throughout)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ceiling division for bigints: ceilDiv(n, d) = (n + d - 1) / d.
 * Precondition: n >= 0, d > 0.
 */
export function ceilDivBig(n: bigint, d: bigint): bigint {
  if (n < 0n) throw new RangeError('ceilDivBig: n must be non-negative');
  if (d <= 0n) throw new RangeError('ceilDivBig: d must be positive');
  return (n + d - 1n) / d;
}

/**
 * Cylinder cost in GU for q4 radius `r` and q4 length `l`.
 *
 * cylinderCostGU(r, l) = ceilDiv(PI_Q6 * r² * l, 10^14)
 *
 * r and l are integer q4 values (i.e., round(value * 10_000)).
 * All intermediates are bigint to prevent overflow (FINDING-10).
 */
export function cylinderCostGU(rQ4: number, lQ4: number): number {
  if (rQ4 < 0 || lQ4 < 0) return 0;
  const r = BigInt(rQ4);
  const l = BigInt(lQ4);
  const numerator = PI_Q6_BIG * r * r * l;
  const result = ceilDivBig(numerator, COST_DIVISOR_BIG);
  // Result must be a safe integer for persistence.
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(`cylinderCostGU overflow: ${result}`);
  }
  return Number(result);
}

/**
 * Thickening cost in GU from old q4 radius `r0` to new q4 radius `r1`
 * over q4 length `l1` (post-extension length).
 *
 * thickeningCostGU(r0, r1, l1) = ceilDiv(PI_Q6 * (r1² - r0²) * l1, 10^14)
 *
 * Precondition: r1 >= r0 >= 0, l1 >= 0.
 */
export function thickeningCostGU(r0Q4: number, r1Q4: number, l1Q4: number): number {
  if (r1Q4 < r0Q4) throw new RangeError('thickeningCostGU: r1 must be >= r0');
  if (r0Q4 < 0 || l1Q4 < 0) return 0;
  if (r1Q4 === r0Q4) return 0;
  const r0 = BigInt(r0Q4);
  const r1 = BigInt(r1Q4);
  const l1 = BigInt(l1Q4);
  const rSqDiff = r1 * r1 - r0 * r0;
  const numerator = PI_Q6_BIG * rSqDiff * l1;
  const result = ceilDivBig(numerator, COST_DIVISOR_BIG);
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(`thickeningCostGU overflow: ${result}`);
  }
  return Number(result);
}

/**
 * Canopy cell cost: exactly CANOPY_CELL_COST_GU (10,000 GU = 1 voxel³).
 */
export function canopyCellCostGU(cellCount: number): number {
  if (cellCount < 0 || !Number.isSafeInteger(cellCount)) {
    throw new RangeError('canopyCellCostGU: invalid cellCount');
  }
  return cellCount * CANOPY_CELL_COST_GU;
}

// ═══════════════════════════════════════════════════════════════════════════
// §5.1 — Inverse: find max q4 delta whose cost fits an allocation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Monotone integer binary search: find greatest q4 delta such that
 * costFn(delta) <= allocationGU.
 *
 * Returns { delta, cost, reserve } where reserve = allocation - cost.
 */
export function maxDeltaWithinBudget(
  allocationGU: number,
  costFn: (delta: number) => number,
  maxDelta: number,
): { delta: number; cost: number; reserve: number } {
  if (allocationGU <= 0 || maxDelta <= 0) {
    return { delta: 0, cost: 0, reserve: allocationGU };
  }

  let lo = 0;
  let hi = maxDelta;

  // Check if the full delta fits.
  const fullCost = costFn(hi);
  if (fullCost <= allocationGU) {
    return { delta: hi, cost: fullCost, reserve: allocationGU - fullCost };
  }

  // Binary search for the greatest delta whose cost fits.
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo + 1) / 2);
    if (costFn(mid) <= allocationGU) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  const cost = lo > 0 ? costFn(lo) : 0;
  return { delta: lo, cost, reserve: allocationGU - cost };
}

// ═══════════════════════════════════════════════════════════════════════════
// §5.2 — Daily budget computation
// ═══════════════════════════════════════════════════════════════════════════

export interface DayStartFactors {
  readonly species: SpeciesClass;
  readonly health: number;       // 0–100 float
  readonly moisture: number;     // 0–100 float
  readonly fertilizerDays: number;
}

/**
 * Compute health factor in basis points (0–10,000).
 * healthBps = clamp(floor(health * 100), 0, 10000)
 */
export function healthBps(health: number): number {
  return Math.max(0, Math.min(10_000, Math.floor(health * 100)));
}

/**
 * Compute moisture factor in basis points (0–10,000).
 *
 * moisture < 30: floor(moisture / 30 * 10_000)
 * 30 <= moisture <= 65: 10_000
 * moisture > 65: floor((100 - moisture) / 35 * 10_000)
 */
export function moistureBps(moisture: number): number {
  if (moisture < 30) return Math.floor(moisture / 30 * 10_000);
  if (moisture > 65) return Math.max(0, Math.floor((100 - moisture) / 35 * 10_000));
  return 10_000;
}

/**
 * Compute the daily growth budget in GU from day-start factors.
 * Uses integer fraction arithmetic (§5.2).
 */
export function computeDailyBudgetGU(factors: DayStartFactors): number {
  const baseGU = BASE_DAILY_VOLUME_VOXELS_V3[factors.species] * GROWTH_UNIT_SCALE;
  const hBps = healthBps(factors.health);
  const mBps = moistureBps(factors.moisture);
  const fBps = factors.fertilizerDays > 0 ? FERTILIZER_FACTOR_BPS : FACTOR_SCALE;
  const aBps = FACTOR_SCALE; // ageVigorBps = 10_000 in V3

  // Integer fraction: baseGU * hBps * mBps * fBps * aBps / 10_000^4
  // Use bigint to avoid overflow in the intermediate product.
  const numerator = BigInt(baseGU)
    * BigInt(hBps)
    * BigInt(mBps)
    * BigInt(fBps)
    * BigInt(aBps);
  const denominator = BigInt(FACTOR_SCALE) ** 4n;
  const result = numerator / denominator; // floor division

  if (result > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(`dailyBudgetGU overflow: ${result}`);
  }
  return Number(result);
}

// ═══════════════════════════════════════════════════════════════════════════
// §5.3 — Largest-remainder allocation (deterministic)
// ═══════════════════════════════════════════════════════════════════════════

export interface AllocationEntry {
  /** Identifier for the recipient (branchId). */
  readonly id: number;
  /** Integer weight (weightU >= 1 for eligible branches). */
  readonly weight: number;
}

export interface AllocationResult {
  readonly id: number;
  readonly allocation: number;
}

/**
 * Largest-remainder allocation: distributes `budget` among recipients
 * proportionally to their weights, guaranteeing sum(allocations) === budget.
 *
 * Tie-breaking: remainder descending, then id ascending.
 *
 * Precondition: budget >= 0, all weights >= 1, at least one entry.
 * Returns empty array if entries is empty (zero-budget tree edge case).
 */
export function largestRemainderAllocate(
  budget: number,
  entries: readonly AllocationEntry[],
): AllocationResult[] {
  if (entries.length === 0) return [];
  if (budget <= 0) return entries.map(e => ({ id: e.id, allocation: 0 }));

  const W = entries.reduce((sum, e) => sum + e.weight, 0);
  if (W <= 0) {
    throw new RangeError('largestRemainderAllocate: total weight must be positive');
  }

  // Use bigint for floor and remainder to avoid precision loss.
  const budgetBig = BigInt(budget);
  const wBig = BigInt(W);

  const floors: { id: number; floor: number; remainder: bigint }[] = entries.map(e => {
    const wiBig = BigInt(e.weight);
    const product = budgetBig * wiBig;
    const floor = Number(product / wBig);
    const remainder = product % wBig;
    return { id: e.id, floor, remainder };
  });

  const sumFloors = floors.reduce((s, f) => s + f.floor, 0);
  let left = budget - sumFloors;

  // Sort by remainder descending, then id ascending for tie-break.
  const sorted = [...floors].sort((a, b) => {
    const cmp = Number(b.remainder - a.remainder);
    if (cmp !== 0) return cmp > 0 ? 1 : -1;
    return a.id - b.id;
  });

  // Give one GU to the first `left` recipients.
  const bonusSet = new Set<number>();
  for (let i = 0; i < left && i < sorted.length; i++) {
    bonusSet.add(sorted[i].id);
  }

  return floors.map(f => ({
    id: f.id,
    allocation: f.floor + (bonusSet.has(f.id) ? 1 : 0),
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// §5.4 — Branch-local sink allocation
// ═══════════════════════════════════════════════════════════════════════════

export interface SinkAllocationResult {
  readonly extension: number;
  readonly supportThicken: number;
  readonly forkSeed: number;
  readonly canopy: number;
}

/**
 * Allocate a branch's GU among its sinks using largest-remainder.
 * Ineligible sinks (demand = 0) are excluded from the allocation.
 */
export function allocateSinks(
  branchAllocationGU: number,
  demands: SinkDemandBps,
): SinkAllocationResult {
  // Build entries only for eligible sinks (demand > 0).
  const sinkEntries: AllocationEntry[] = [];
  const sinkNames: (keyof SinkDemandBps)[] = [];

  for (const name of ['extension', 'supportThicken', 'forkSeed', 'canopy'] as const) {
    if (demands[name] > 0) {
      sinkEntries.push({ id: sinkNames.length, weight: demands[name] });
      sinkNames.push(name);
    }
  }

  if (sinkEntries.length === 0) {
    return { extension: 0, supportThicken: 0, forkSeed: 0, canopy: 0 };
  }

  const allocations = largestRemainderAllocate(branchAllocationGU, sinkEntries);

  const result: Record<string, number> = {
    extension: 0, supportThicken: 0, forkSeed: 0, canopy: 0,
  };
  for (const alloc of allocations) {
    const name: string = sinkNames[alloc.id];
    result[name] = alloc.allocation;
  }
  return result as unknown as SinkAllocationResult;
}

// ═══════════════════════════════════════════════════════════════════════════
// §5.5 — Conservation assertion
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Assert the per-branch conservation identity:
 * allocation = materialized + activeFuture + escrow + cancelled + reserve
 *
 * Throws if the identity does not hold.
 */
export function assertBranchConservation(
  branchId: number,
  allocation: number,
  materialized: number,
  activeFuture: number,
  escrow: number,
  cancelled: number,
  reserve: number,
): void {
  const sum = materialized + activeFuture + escrow + cancelled + reserve;
  if (sum !== allocation) {
    throw new Error(
      `Conservation violation on branch ${branchId}: ` +
      `allocation=${allocation} but sum=${sum} ` +
      `(mat=${materialized} future=${activeFuture} escrow=${escrow} ` +
      `cancel=${cancelled} reserve=${reserve})`,
    );
  }
}

/**
 * Assert the daily budget conservation identity:
 * dailyBudget = sum(branchAllocations)
 */
export function assertDailyBudgetConservation(
  dailyBudgetGU: number,
  branchAllocations: readonly number[],
): void {
  const sum = branchAllocations.reduce((s, a) => s + a, 0);
  if (sum !== dailyBudgetGU) {
    throw new Error(
      `Daily budget conservation violation: budget=${dailyBudgetGU} but sum(allocations)=${sum}`,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// §5.5 — Segment split
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Split a branch allocation between two display segments.
 * segment0 = floor(allocation / 2), segment1 = allocation - segment0.
 * An odd GU belongs to segment 1.
 */
export function splitSegments(allocationGU: number): { segment0GU: number; segment1GU: number } {
  const segment0GU = Math.floor(allocationGU / 2);
  return { segment0GU, segment1GU: allocationGU - segment0GU };
}
