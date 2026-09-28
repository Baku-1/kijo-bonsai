// growth-v3.test.js — Test probes for Growth V3 modules.
// Spec: docs/pipeline/ARCH-GROWTH-V3-IMPLEMENTATION-2026-09-25.md
//
// Probe IDs: V3-L01..V3-L04 (ledger), V3-P01..V3-P03 (planner),
//            V3-M01..V3-M03 (materializer), V3-H01..V3-H03 (hash)
//
// Run: node --test test/growth-v3.test.js
// Framework: Node.js built-in test runner (node:test)

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  // GrowthLedger
  ceilDivBig, cylinderCostGU, thickeningCostGU, canopyCellCostGU,
  maxDeltaWithinBudget,
  healthBps, moistureBps, computeDailyBudgetGU,
  largestRemainderAllocate, allocateSinks,
  assertBranchConservation, assertDailyBudgetConservation,
  splitSegments,
  // CanonicalHash
  canonicalJsonSerialize, canonicalJsonString,
  canonicalHash, sha256Hex, contentAddressedId,
  // GrowthPlanner
  computeBranchWeight, isLeaderBranch, selectSinkDemands,
  sortEventsForOrdinal,
  // GrowthMaterializer
  interpolateQ4, computeEventProgressPpm,
  evaluateEvent, evaluateSegmentEvents,
  findPendingBoundaries, evaluateBranchGeometry, q4ToRenderValues,
} from '../dist/index.js';

import {
  PROGRESS_SCALE, GROWTH_UNIT_SCALE, CANOPY_CELL_COST_GU,
  GAME_DAY_MS, DISPLAY_SEGMENT_MS,
  computeClockState, toQ4, fromQ4,
} from '@kijo/shared';

// ===========================================================================
// V3-L01: Bigint cost equations
// ===========================================================================

test('V3-L01a: ceilDivBig basic', () => {
  assert.equal(ceilDivBig(10n, 3n), 4n);
  assert.equal(ceilDivBig(9n, 3n), 3n);
  assert.equal(ceilDivBig(0n, 5n), 0n);
});

test('V3-L01b: ceilDivBig rejects negative n', () => {
  assert.throws(() => ceilDivBig(-1n, 2n), /non-negative/);
});

test('V3-L01c: ceilDivBig rejects zero d', () => {
  assert.throws(() => ceilDivBig(1n, 0n), /positive/);
});

test('V3-L01d: cylinderCostGU positive case', () => {
  const r = toQ4(1.0); // 10000
  const l = toQ4(1.0); // 10000
  const cost = cylinderCostGU(r, l);
  assert.ok(cost > 0, `cylinder cost should be positive, got ${cost}`);
  // PI * 1^2 * 1 = PI voxel^3, at 10_000 GU/voxel^3 ≈ 31416 GU
  assert.ok(cost > 31000 && cost < 32000, `cylinder cost ≈ 31416, got ${cost}`);
});

test('V3-L01e: cylinderCostGU zero radius', () => {
  assert.equal(cylinderCostGU(0, toQ4(5)), 0);
});

test('V3-L01f: cylinderCostGU negative inputs', () => {
  assert.equal(cylinderCostGU(-1, toQ4(5)), 0);
});

test('V3-L01g: thickeningCostGU positive case', () => {
  const r0 = toQ4(1.0);
  const r1 = toQ4(2.0);
  const l = toQ4(1.0);
  const cost = thickeningCostGU(r0, r1, l);
  // PI * (4 - 1) * 1 = 3*PI ≈ 9.4248 voxel^3 → ~94248 GU
  assert.ok(cost > 94000 && cost < 95000, `thickening cost ≈ 94248, got ${cost}`);
});

test('V3-L01h: thickeningCostGU r1 < r0 throws', () => {
  assert.throws(() => thickeningCostGU(toQ4(2), toQ4(1), toQ4(1)), /r1 must be >= r0/);
});

test('V3-L01i: thickeningCostGU equal radii = 0', () => {
  assert.equal(thickeningCostGU(toQ4(3), toQ4(3), toQ4(5)), 0);
});

test('V3-L01j: canopyCellCostGU', () => {
  assert.equal(canopyCellCostGU(0), 0);
  assert.equal(canopyCellCostGU(1), CANOPY_CELL_COST_GU);
  assert.equal(canopyCellCostGU(5), 5 * CANOPY_CELL_COST_GU);
});

test('V3-L01k: canopyCellCostGU rejects NaN', () => {
  assert.throws(() => canopyCellCostGU(NaN));
});

test('V3-L01l: canopyCellCostGU rejects negative', () => {
  assert.throws(() => canopyCellCostGU(-1));
});

// ===========================================================================
// V3-L02: Daily budget computation
// ===========================================================================

test('V3-L02a: healthBps clamp 0-10000', () => {
  assert.equal(healthBps(0), 0);
  assert.equal(healthBps(50), 5000);
  assert.equal(healthBps(100), 10000);
  assert.equal(healthBps(-5), 0);
  assert.equal(healthBps(200), 10000);
});

test('V3-L02b: moistureBps piecewise linear', () => {
  assert.equal(moistureBps(0), 0);
  assert.equal(moistureBps(30), 10000);
  assert.equal(moistureBps(50), 10000);
  assert.equal(moistureBps(65), 10000);
  assert.equal(moistureBps(100), 0);
  // midpoint of dry region: 15 → floor(15/30 * 10000) = 5000
  assert.equal(moistureBps(15), 5000);
});

test('V3-L02c: computeDailyBudgetGU healthy tree', () => {
  const budget = computeDailyBudgetGU({
    species: 'hardwood',
    health: 100,
    moisture: 50,
    fertilizerDays: 0,
  });
  assert.ok(Number.isSafeInteger(budget), 'budget must be safe integer');
  assert.ok(budget > 0, 'budget must be positive');
});

test('V3-L02d: computeDailyBudgetGU dead tree = 0', () => {
  const budget = computeDailyBudgetGU({
    species: 'hardwood',
    health: 0,
    moisture: 50,
    fertilizerDays: 0,
  });
  assert.equal(budget, 0);
});

test('V3-L02e: computeDailyBudgetGU dry tree = 0', () => {
  const budget = computeDailyBudgetGU({
    species: 'tropical',
    health: 100,
    moisture: 0,
    fertilizerDays: 0,
  });
  assert.equal(budget, 0);
});

test('V3-L02f: fertilizer increases budget', () => {
  const base = computeDailyBudgetGU({ species: 'evergreen', health: 100, moisture: 50, fertilizerDays: 0 });
  const fert = computeDailyBudgetGU({ species: 'evergreen', health: 100, moisture: 50, fertilizerDays: 5 });
  assert.ok(fert > base, `fertilized ${fert} should be > base ${base}`);
});

// ===========================================================================
// V3-L03: Largest-remainder allocation
// ===========================================================================

test('V3-L03a: allocation sums to budget exactly', () => {
  const budget = 1000;
  const entries = [
    { id: 0, weight: 3 },
    { id: 1, weight: 2 },
    { id: 2, weight: 5 },
  ];
  const result = largestRemainderAllocate(budget, entries);
  const sum = result.reduce((s, r) => s + r.allocation, 0);
  assert.equal(sum, budget, 'conservation: sum must equal budget');
});

test('V3-L03b: allocation with single entry gets all', () => {
  const result = largestRemainderAllocate(42, [{ id: 0, weight: 1 }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].allocation, 42);
});

test('V3-L03c: allocation with zero budget', () => {
  const result = largestRemainderAllocate(0, [{ id: 0, weight: 5 }, { id: 1, weight: 3 }]);
  assert.ok(result.every(r => r.allocation === 0));
});

test('V3-L03d: allocation empty entries', () => {
  const result = largestRemainderAllocate(100, []);
  assert.equal(result.length, 0);
});

test('V3-L03e: allocation deterministic tie-break (id ascending)', () => {
  // Equal weights → equal remainders → tie-break by id ascending
  const result = largestRemainderAllocate(7, [
    { id: 0, weight: 1 },
    { id: 1, weight: 1 },
    { id: 2, weight: 1 },
  ]);
  const sum = result.reduce((s, r) => s + r.allocation, 0);
  assert.equal(sum, 7);
  // floor(7/3) = 2 each, 1 remainder → goes to lowest id first
  assert.equal(result[0].allocation, 3);
  assert.equal(result[1].allocation, 2);
  assert.equal(result[2].allocation, 2);
});

// ===========================================================================
// V3-L04: Sink allocation + conservation
// ===========================================================================

test('V3-L04a: allocateSinks distributes correctly', () => {
  const demands = { extension: 7000, supportThicken: 3000, forkSeed: 0, canopy: 0 };
  const result = allocateSinks(100, demands);
  assert.equal(result.extension + result.supportThicken + result.forkSeed + result.canopy, 100);
  assert.equal(result.forkSeed, 0);
  assert.equal(result.canopy, 0);
});

test('V3-L04b: assertBranchConservation passes on correct values', () => {
  assert.doesNotThrow(() => assertBranchConservation(0, 100, 30, 20, 10, 5, 35));
});

test('V3-L04c: assertBranchConservation throws on mismatch', () => {
  assert.throws(() => assertBranchConservation(0, 100, 30, 20, 10, 5, 30), /Conservation/);
});

test('V3-L04d: assertDailyBudgetConservation passes', () => {
  assert.doesNotThrow(() => assertDailyBudgetConservation(100, [40, 30, 30]));
});

test('V3-L04e: assertDailyBudgetConservation throws', () => {
  assert.throws(() => assertDailyBudgetConservation(100, [40, 30, 29]), /budget conservation/);
});

test('V3-L04f: splitSegments odd allocation', () => {
  const { segment0GU, segment1GU } = splitSegments(11);
  assert.equal(segment0GU, 5);
  assert.equal(segment1GU, 6);
  assert.equal(segment0GU + segment1GU, 11);
});

// ===========================================================================
// V3-H01: Canonical JSON serialization
// ===========================================================================

test('V3-H01a: canonical JSON sorts keys', () => {
  const json = canonicalJsonSerialize({ b: 1, a: 2 });
  assert.equal(json, '{"a":2,"b":1}');
});

test('V3-H01b: canonical JSON no whitespace', () => {
  const json = canonicalJsonSerialize({ x: [1, 2, 3] });
  assert.ok(!json.includes(' '), 'no whitespace');
  assert.ok(!json.includes('\n'), 'no newlines');
});

test('V3-H01c: canonical JSON rejects NaN', () => {
  assert.throws(() => canonicalJsonSerialize(NaN), /non-finite/);
});

test('V3-H01d: canonical JSON rejects Infinity', () => {
  assert.throws(() => canonicalJsonSerialize(Infinity), /non-finite/);
});

test('V3-H01e: canonical JSON rejects floats', () => {
  assert.throws(() => canonicalJsonSerialize(1.5), /non-integer/);
});

test('V3-H01f: canonical JSON normalizes -0', () => {
  assert.equal(canonicalJsonSerialize(-0), '0');
});

test('V3-H01g: canonical JSON rejects bigint', () => {
  assert.throws(() => canonicalJsonSerialize(42n), /bigint/);
});

test('V3-H01h: canonical JSON rejects functions', () => {
  assert.throws(() => canonicalJsonSerialize(() => {}), /function/);
});

test('V3-H01i: canonical JSON handles null', () => {
  assert.equal(canonicalJsonSerialize(null), 'null');
});

test('V3-H01j: canonical JSON nested objects sorted', () => {
  const json = canonicalJsonSerialize({ z: { b: 1, a: 2 }, a: 0 });
  assert.equal(json, '{"a":0,"z":{"a":2,"b":1}}');
});

// ===========================================================================
// V3-H02: SHA-256 hashing
// ===========================================================================

test('V3-H02a: sha256Hex returns 64 hex chars', async () => {
  const hash = await sha256Hex('hello');
  assert.equal(hash.length, 64);
  assert.ok(/^[0-9a-f]{64}$/.test(hash), 'lowercase hex');
});

test('V3-H02b: canonicalHash deterministic', async () => {
  const h1 = await canonicalHash({ a: 1, b: 2 });
  const h2 = await canonicalHash({ b: 2, a: 1 });
  assert.equal(h1, h2, 'key order should not affect hash');
});

test('V3-H02c: contentAddressedId returns 64 hex', async () => {
  const id = await contentAddressedId(['prefix', 'tree-123', 0]);
  assert.equal(id.length, 64);
  assert.ok(/^[0-9a-f]{64}$/.test(id));
});

// ===========================================================================
// V3-P01: Branch weight computation
// ===========================================================================

/** Minimal branch object for weight tests. */
function fakeBranch(overrides = {}) {
  return {
    id: 1, parent: 0, depth: 1, angle: 30, length: 5, thickness: 1,
    pruned: false, children: [], attachmentY: 3, diameter: 2,
    currentStress: 0, stressInitial: 0, wired: false, wireAppliedDay: 0,
    wireAngle: 0, wireSet: false, wireScarred: false, twined: false,
    twineAppliedDay: 0, twineAngle: 0, twineForcePerDay: 0, weighted: false,
    weightCount: 0, weightAppliedDay: 0, weightAngleDelta: 0,
    twineDegradesDay: 0, bendSet: false, jinned: false, jinSegmentStart: -1,
    ...overrides,
  };
}

test('V3-P01a: computeBranchWeight non-zero for living branch', () => {
  const w = computeBranchWeight({
    branch: fakeBranch({ depth: 1 }),
    isLeader: true,
    isTip: true,
    isForked: false,
    isForkEligible: false,
    isCanopyEligible: false,
  }, 'hardwood');
  assert.ok(w > 0, `weight should be positive: ${w}`);
});

test('V3-P01b: leader branch gets more weight', () => {
  const leader = computeBranchWeight({
    branch: fakeBranch({ id: 1, depth: 1 }),
    isLeader: true, isTip: true, isForked: false,
    isForkEligible: false, isCanopyEligible: false,
  }, 'hardwood');
  const nonLeader = computeBranchWeight({
    branch: fakeBranch({ id: 2, depth: 1 }),
    isLeader: false, isTip: true, isForked: false,
    isForkEligible: false, isCanopyEligible: false,
  }, 'hardwood');
  assert.ok(leader > nonLeader, `leader ${leader} > non-leader ${nonLeader}`);
});

// ===========================================================================
// V3-M01: Integer PPM interpolation
// ===========================================================================

test('V3-M01a: interpolateQ4 at 0 = from', () => {
  assert.equal(interpolateQ4(1000, 2000, 0), 1000);
});

test('V3-M01b: interpolateQ4 at PROGRESS_SCALE = to', () => {
  assert.equal(interpolateQ4(1000, 2000, PROGRESS_SCALE), 2000);
});

test('V3-M01c: interpolateQ4 at midpoint', () => {
  const mid = interpolateQ4(0, 10000, 500_000);
  assert.equal(mid, 5000);
});

test('V3-M01d: interpolateQ4 negative progress = from', () => {
  assert.equal(interpolateQ4(100, 200, -100), 100);
});

test('V3-M01e: interpolateQ4 over PROGRESS_SCALE = to', () => {
  assert.equal(interpolateQ4(100, 200, 2_000_000), 200);
});

// ===========================================================================
// V3-M02: Event progress computation
// ===========================================================================

test('V3-M02a: computeEventProgressPpm before event = 0', () => {
  const event = { startOffsetMs: 1000, endOffsetMs: 2000 };
  assert.equal(computeEventProgressPpm(event, 0, 500), 0);
});

test('V3-M02b: computeEventProgressPpm after event = PROGRESS_SCALE', () => {
  const event = { startOffsetMs: 1000, endOffsetMs: 2000 };
  assert.equal(computeEventProgressPpm(event, 0, 3000), PROGRESS_SCALE);
});

test('V3-M02c: computeEventProgressPpm at midpoint', () => {
  const event = { startOffsetMs: 0, endOffsetMs: 1000 };
  const ppm = computeEventProgressPpm(event, 0, 500);
  assert.equal(ppm, 500_000);
});

test('V3-M02d: computeEventProgressPpm zero-duration event = 0', () => {
  const event = { startOffsetMs: 100, endOffsetMs: 100 };
  assert.equal(computeEventProgressPpm(event, 0, 100), 0);
});

// ===========================================================================
// V3-M03: Boundary detection
// ===========================================================================

test('V3-M03a: findPendingBoundaries within same segment = empty', () => {
  const bornAt = 0;
  const from = 1000;
  const to = 2000;
  const boundaries = findPendingBoundaries(bornAt, from, to);
  assert.equal(boundaries.length, 0);
});

test('V3-M03b: findPendingBoundaries across segment 0 close', () => {
  const bornAt = 0;
  const from = 0;
  const to = DISPLAY_SEGMENT_MS + 1000;
  const boundaries = findPendingBoundaries(bornAt, from, to);
  assert.ok(boundaries.length >= 1, 'should find segment-0-close');
  assert.equal(boundaries[0].kind, 'segment-0-close');
  assert.equal(boundaries[0].boundaryMs, DISPLAY_SEGMENT_MS);
});

test('V3-M03c: findPendingBoundaries across full day', () => {
  const bornAt = 0;
  const from = 0;
  const to = GAME_DAY_MS + 1000;
  const boundaries = findPendingBoundaries(bornAt, from, to);
  assert.ok(boundaries.length >= 2, 'should find both boundaries');
  assert.equal(boundaries[0].kind, 'segment-0-close');
  assert.equal(boundaries[1].kind, 'day-close');
  assert.equal(boundaries[1].advancesDay, true);
});

test('V3-M03d: findPendingBoundaries toMs <= fromMs = empty', () => {
  assert.equal(findPendingBoundaries(0, 1000, 500).length, 0);
});

// ===========================================================================
// V3-M04: evaluateEvent and q4ToRenderValues
// ===========================================================================

test('V3-M04a: evaluateEvent fully materialized', () => {
  const event = {
    eventId: 'test-event-1',
    branchId: 1,
    kind: 'EXTENSION',
    segmentIndex: 0,
    startOffsetMs: 0,
    endOffsetMs: 1000,
    fromQ4: { length: 0 },
    toQ4: { length: 10000 },
  };
  const result = evaluateEvent(event, 0, 2000);
  assert.equal(result.materialized, true);
  assert.equal(result.currentQ4.length, 10000);
});

test('V3-M04b: q4ToRenderValues converts correctly', () => {
  const render = q4ToRenderValues({ length: 10000, radius: 5000 });
  assert.ok(Math.abs(render.length - 1.0) < 0.001);
  assert.ok(Math.abs(render.radius - 0.5) < 0.001);
});

// ===========================================================================
// V3-L05: maxDeltaWithinBudget
// ===========================================================================

test('V3-L05a: maxDeltaWithinBudget zero budget', () => {
  const result = maxDeltaWithinBudget(0, (d) => d * d, 100);
  assert.equal(result.delta, 0);
  assert.equal(result.reserve, 0);
});

test('V3-L05b: maxDeltaWithinBudget full fit', () => {
  const result = maxDeltaWithinBudget(1000, (d) => d, 100);
  assert.equal(result.delta, 100);
  assert.equal(result.cost, 100);
  assert.equal(result.reserve, 900);
});

test('V3-L05c: maxDeltaWithinBudget binary search finds max', () => {
  // cost = d^2, budget = 100 → max d = 10 (cost = 100)
  const result = maxDeltaWithinBudget(100, (d) => d * d, 20);
  assert.equal(result.delta, 10);
  assert.equal(result.cost, 100);
  assert.equal(result.reserve, 0);
});

// ===========================================================================
// V3-Q4: q4 round-trip
// ===========================================================================

test('V3-Q4a: toQ4/fromQ4 round-trip', () => {
  const values = [0, 0.5, 1.0, 3.14159, 99.9999];
  for (const v of values) {
    const q4 = toQ4(v);
    assert.ok(Number.isInteger(q4), `toQ4(${v}) must be integer`);
    const back = fromQ4(q4);
    assert.ok(Math.abs(back - v) < 0.0001, `round-trip error: ${v} → ${q4} → ${back}`);
  }
});
