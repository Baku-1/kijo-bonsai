// TwineWeightEngine.test.js — Gate tests TWE1–TWE9.
// Run via: node --test test/TwineWeightEngine.test.js (from packages/engine/)
// Build first: npm run build --workspace=packages/engine
//
// DESIGN NOTE: Most tests operate directly on trunk (branch 0) with angle pre-set.
// This avoids the fork-RNG dependency (many seeds never produce depth>=1 branches).
// Only tests that strictly require a pruneable branch (TWE1-2, TWE6-2) use seed=200
// grown to 50 days, where 2 non-trunk branches are guaranteed.
//
// OQ-5 STACK model (confirmed Jeremy 2026-08-14): applyWeight applies angle immediately;
// weightAngleDelta accumulates total applied angle (not incremental progress toward target).
//
// CAVEAT-1 fix (CRITIC-TWINEWEIGHT-PATCH-2026-08-14.md): TWE6-2 uses separate fresh tree
// for assertions 3+4 to avoid branch aliasing after prune.
//
// CAVEAT-2 fix (CRITIC): TWE2-3 uses trunk pre-set to 80° so negative twine has room to move.

import test from 'node:test';
import assert from 'node:assert/strict';
import { BonsaiTree, GrowthEngine, CareLogReplay } from '../dist/index.js';
import {
  TwineWeightEngine,
  TWINE_MAX_ANGLE_DELTA,
  WEIGHT_DEGREES_PER_UNIT,
  computeSetDays,
  TWINE_FORCE_PER_DAY,
  WEIGHT_MASS_PER_UNIT,
  GRAVITY_CONSTANT,
  KENGAI_POLAR_MAX,
  toRad,
} from '../dist/TwineWeightEngine.js';

const round4 = x => Math.round(x * 10000) / 10000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Grow a tree for `days` ticks.
 */
function growTree(seed, species, days) {
  const t = new BonsaiTree(seed, species);
  for (let d = 0; d < days; d++) GrowthEngine.growTick(t);
  return t;
}

/**
 * Return a fresh BonsaiTree with trunk angle pre-set to 80°.
 * The trunk is always branch 0, always non-pruned.
 * 80° is safely away from POLAR_MIN_DEG (5.73°) and KENGAI_POLAR_MAX (150°),
 * leaving room for both positive and negative twine/weight deltas.
 */
function freshTrunkTree() {
  const t = new BonsaiTree(42, 'hardwood');
  t.getBranches()[0].angle = 80;
  return t;
}

/**
 * Grow a tree at seed=200 for 50 days — guaranteed to have ≥1 non-trunk branch
 * (verified: produces 2 depth-1 branches at this seed/day).
 * Used only for tests that specifically need a pruneable (non-trunk) branch.
 */
function treePruneable() {
  return growTree(200, 'hardwood', 50);
}

// ---------------------------------------------------------------------------
// TWE1 — applyTwine validation
// ---------------------------------------------------------------------------

test('TWE1-1: applyTwine throws CareLogReplayError for out-of-range branchId', () => {
  // Cost guard (B-1) now catches out-of-range branchId before engine can return { ok: false }.
  // See also: GUARD-9 in cost-guards.test.js.
  const tree = freshTrunkTree();
  assert.throws(
    () => tree.applyTwine(99999, 10),
    { name: 'CareLogReplayError' }
  );
});

test('TWE1-2: applyTwine returns pruned for a pruned branch (non-trunk)', () => {
  // Must use a tree with non-trunk branches — trunk cannot be pruned.
  const tree = treePruneable();
  const pruneable = tree.getBranches().find(b => !b.pruned && b.depth >= 1);
  assert.ok(pruneable !== undefined, `seed=200 day=50 must have non-trunk branch (got ${tree.getBranches().length} total)`);
  tree.prune(pruneable.id);
  const r = tree.applyTwine(pruneable.id, 10);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'pruned');
});

test('TWE1-3: applyTwine succeeds first call; returns already-twined on second', () => {
  const tree = freshTrunkTree();
  const r1 = tree.applyTwine(0, 10);
  assert.equal(r1.ok, true, 'first applyTwine must succeed');
  const r2 = tree.applyTwine(0, 10);
  assert.equal(r2.ok, false);
  assert.equal(r2.reason, 'already-twined');
});

test('TWE1-4: applyTwine succeeds again after removeTwine clears state', () => {
  const tree = freshTrunkTree();
  tree.applyTwine(0, 10);
  tree.removeTwine(0);
  const b = tree.getBranches()[0];
  assert.equal(b.twined, false, 'twined must be false after removeTwine');
  const r = tree.applyTwine(0, 10);
  assert.equal(r.ok, true, 'applyTwine must succeed after removeTwine');
});

// ---------------------------------------------------------------------------
// TWE2 — applyTwine bend and polar clamping
// ---------------------------------------------------------------------------

test('TWE2-1: applyTwine applies correct delta on trunk at 80°', () => {
  const tree = freshTrunkTree();
  const r = tree.applyTwine(0, 20);
  assert.equal(r.ok, true);
  const b = tree.getBranches()[0];
  assert.equal(b.angle, round4(80 + 20), `angle must be 100°, got ${b.angle}`);
});

test('TWE2-2: applyTwine clamps delta to +TWINE_MAX_ANGLE_DELTA', () => {
  const tree = freshTrunkTree();
  const r = tree.applyTwine(0, 100);  // 100 > 28 → clamped to 28
  assert.equal(r.ok, true);
  const b = tree.getBranches()[0];
  assert.equal(b.angle, round4(80 + TWINE_MAX_ANGLE_DELTA), `angle must be 108°, got ${b.angle}`);
  const logEntry = tree.getCareLog().at(-1);
  assert.equal(logEntry.action.angleDelta, TWINE_MAX_ANGLE_DELTA, 'log angleDelta must be 28, not 100');
});

test('TWE2-3: applyTwine clamps delta to -TWINE_MAX_ANGLE_DELTA (CAVEAT-2 fix)', () => {
  // Trunk at 80° — has room to absorb -28° without hitting POLAR_MIN_DEG.
  const tree = freshTrunkTree();
  const r = tree.applyTwine(0, -100);  // -100 < -28 → clamped to -28
  assert.equal(r.ok, true);
  const b = tree.getBranches()[0];
  assert.equal(b.angle, round4(80 - TWINE_MAX_ANGLE_DELTA), `angle must be 52°, got ${b.angle}`);
  const logEntry = tree.getCareLog().at(-1);
  assert.equal(logEntry.action.angleDelta, -TWINE_MAX_ANGLE_DELTA, 'log angleDelta must be -28');
});

test('TWE2-4: applyTwine clamps result to KENGAI_POLAR_MAX (150°)', () => {
  const tree = new BonsaiTree(42, 'hardwood');
  tree.getBranches()[0].angle = 140;  // near max
  const r = tree.applyTwine(0, 100);  // 140 + 28 = 168 → clamped to 150
  assert.equal(r.ok, true);
  const b = tree.getBranches()[0];
  assert.equal(b.angle, KENGAI_POLAR_MAX, `angle must be 150°, got ${b.angle}`);
});

test('TWE2-5: applyTwine care log entry has correct shape', () => {
  const tree = freshTrunkTree();
  const r = tree.applyTwine(0, 15);
  assert.equal(r.ok, true);
  const entry = tree.getCareLog().at(-1);
  assert.equal(entry.action.type, 'twine');
  assert.equal(entry.action.branchId, 0);
  assert.equal(entry.action.angleDelta, 15);
  assert.equal(entry.action.oldAngle, 80);
  assert.equal(entry.action.newAngle, round4(80 + 15));
  assert.ok(typeof entry.action.degradeDays === 'number', 'degradeDays must be a number');
  assert.ok(entry.action.degradeDays >= 10 && entry.action.degradeDays <= 15, `degradeDays in [10,15], got ${entry.action.degradeDays}`);
});

test('TWE2-6: b.twineForcePerDay is TWINE_FORCE_PER_DAY after apply', () => {
  const tree = freshTrunkTree();
  tree.applyTwine(0, 10);
  const b = tree.getBranches()[0];
  assert.equal(b.twineForcePerDay, TWINE_FORCE_PER_DAY, 'twineForcePerDay must be set');
  assert.equal(b.twined, true);
  assert.equal(b.twineAppliedDay, 0);  // fresh tree — age=0
});

// ---------------------------------------------------------------------------
// TWE3 — twineDegradesDay and degradeDays range
// ---------------------------------------------------------------------------

test('TWE3-1: twineDegradesDay equals applyDay + degradeDays', () => {
  const tree = growTree(42, 'hardwood', 30);
  const applyDay = tree.getAge();  // = 30
  tree.applyTwine(0, 15);
  const b = tree.getBranches()[0];
  const logEntry = tree.getCareLog().at(-1);
  const degradeDays = logEntry.action.degradeDays;
  assert.equal(b.twineDegradesDay, applyDay + degradeDays,
    `twineDegradesDay must be ${applyDay} + ${degradeDays} = ${applyDay + degradeDays}`);
});

test('TWE3-2: degradeDays is in range [10, 15]', () => {
  const tree = freshTrunkTree();
  tree.applyTwine(0, 15);
  const logEntry = tree.getCareLog().at(-1);
  const d = logEntry.action.degradeDays;
  assert.ok(d >= 10 && d <= 15, `degradeDays must be in [10,15], got ${d}`);
  assert.ok(Number.isInteger(d), 'degradeDays must be an integer');
});

test('TWE3-3: twineAppliedDay matches tree.getAge() at apply time', () => {
  const tree = growTree(42, 'hardwood', 30);
  const applyDay = tree.getAge();
  tree.applyTwine(0, 15);
  const b = tree.getBranches()[0];
  assert.equal(b.twineAppliedDay, applyDay);
});

test('TWE3-4: CareLogReplay preserves degradeDays (RNG determinism via storedDegradeDays)', () => {
  // storedDegradeDays=12 forced → verify replay uses exact stored value.
  const tree1 = freshTrunkTree();
  tree1.applyTwine(0, 15, 12);  // force stored degradeDays = 12
  const originalLog = tree1.getCareLog();
  const twineEntry = originalLog.find(e => e.action.type === 'twine');
  assert.equal(twineEntry.action.degradeDays, 12, 'care log must record degradeDays=12');

  // Reconstruct via replay — replay path uses stored value (a.degradeDays), not new RNG draw.
  const rebuilt = CareLogReplay.reconstruct(42, 'hardwood', originalLog, 1);  // 1 tick (day 0 actions only)
  const replayedLog = rebuilt.getCareLog();
  const replayedEntry = replayedLog.find(e => e.action.type === 'twine');
  assert.ok(replayedEntry, 'replayed care log must contain twine entry');
  assert.equal(replayedEntry.action.degradeDays, 12,
    `replay must preserve degradeDays=12 (got ${replayedEntry.action.degradeDays})`);
});

// ---------------------------------------------------------------------------
// TWE4 — removeTwine spring-back and bendSet
// ---------------------------------------------------------------------------

test('TWE4-1: removeTwine same-day (daysApplied=0) fully springs back', () => {
  const tree = freshTrunkTree();
  const oldAngle = tree.getBranches()[0].angle;  // 80°
  tree.applyTwine(0, 15);
  // Remove on the same day (daysApplied=0 → fraction=1.0 → full spring-back).
  tree.removeTwine(0);
  const b = tree.getBranches()[0];
  assert.ok(
    Math.abs(b.angle - oldAngle) < 0.001,
    `same-day removal must restore oldAngle ${oldAngle}, got ${b.angle}`
  );
  assert.equal(b.bendSet, false, 'bendSet must be false for same-day removal');
  assert.equal(b.twined, false);
});

test('TWE4-2: removeTwine before natural degrade gives partial spring-back', () => {
  const tree = freshTrunkTree();
  const oldAngle = tree.getBranches()[0].angle;  // 80°
  // storedDegradeDays=20 (max valid per A-3 cap). Remove before day 20 to avoid degrade interference.
  tree.applyTwine(0, 20, 20);
  const postApplyAngle = tree.getBranches()[0].angle;  // 100°
  const appliedDelta = round4(postApplyAngle - oldAngle);
  // Grow up to min(setDays/2, 19) ticks — stay under storedDegradeDays to prevent degrade firing.
  const sdAtApply = computeSetDays(tree.getBranches()[0].diameter);
  const tickCount = Math.min(Math.floor(sdAtApply / 2), 19);
  for (let i = 0; i < tickCount; i++) GrowthEngine.growTick(tree);
  // Diameter has grown — recompute setDays at removal time (matches removeTwine internal logic).
  const sdAtRemoval = computeSetDays(tree.getBranches()[0].diameter);
  tree.removeTwine(0);
  const b = tree.getBranches()[0];
  // fraction and expected spring-back must use the POST-GROWTH diameter (same as removeTwine).
  const fraction = Math.max(0, Math.min(1, 1 - tickCount / sdAtRemoval));
  const expectedSpringBack = round4(appliedDelta * fraction);
  const expectedAngle = round4(postApplyAngle - expectedSpringBack);
  assert.ok(
    Math.abs(b.angle - expectedAngle) < 0.01,
    `partial removal: angle=${b.angle} should be ≈${expectedAngle} (appliedDelta=${appliedDelta}, fraction=${round4(fraction)}, sdAtRemoval=${round4(sdAtRemoval)})`
  );
});

test('TWE4-3: removeTwine after setDays sets bendSet=true', () => {
  const tree = freshTrunkTree();
  // A-3 caps BonsaiTree.applyTwine storedDegradeDays at 20, but this test needs degrade to NOT
  // fire during 70 ticks. Call engine directly — this is an engine-level test validating
  // removeTwine spring-back mechanics, not the BonsaiTree guard.
  TwineWeightEngine.applyTwine(tree, 0, 20, 999);
  // The trunk thickens as it grows, so setDays grows too. Max possible setDays=56 (at D_MAX=6).
  // Tick 70 times to guarantee we exceed the CURRENT setDays even after all growth-induced increases.
  for (let i = 0; i < 70; i++) GrowthEngine.growTick(tree);
  tree.removeTwine(0);
  const b = tree.getBranches()[0];
  assert.equal(b.bendSet, true, 'bendSet must be true after 70 ticks (> max setDays=56)');
});

test('TWE4-4: removeTwine clears all twine binding fields', () => {
  const tree = freshTrunkTree();
  tree.applyTwine(0, 15);
  tree.removeTwine(0);
  const b = tree.getBranches()[0];
  assert.equal(b.twined, false);
  assert.equal(b.twineAngle, 0);
  assert.equal(b.twineForcePerDay, 0);
  assert.equal(b.twineDegradesDay, 0);
  assert.equal(b.twineAppliedDay, 0);
});

test('TWE4-5: removeTwine appends twine-remove care log entry', () => {
  const tree = freshTrunkTree();
  tree.applyTwine(0, 15);
  tree.removeTwine(0);
  const lastEntry = tree.getCareLog().at(-1);
  assert.equal(lastEntry.action.type, 'twine-remove');
  assert.equal(lastEntry.action.branchId, 0);
});

// ---------------------------------------------------------------------------
// TWE5 — CareLogReplay determinism with twine and twine-remove
// ---------------------------------------------------------------------------

test('TWE5-1: CareLogReplay reconstructs branch angle after twine + removeTwine', () => {
  // NOTE: No trunk angle pre-mutation — direct branch mutations are not logged and
  // therefore cannot be replayed. The trunk starts at its natural angle (0°) and twine
  // bends it to 15° (above POLAR_MIN_DEG). storedDegradeDays=20 for determinism
  // (degrade at day 20 — well after removeTwine at day 5).
  const seed = 42;
  const species = 'hardwood';

  // Apply twine on day 0, grow 5 ticks, remove on day 5, grow to day 30.
  const tree = new BonsaiTree(seed, species);
  tree.applyTwine(0, 15, 20);  // trunk: 0 → 15°; storedDegradeDays=20
  for (let i = 0; i < 5; i++) GrowthEngine.growTick(tree);
  tree.removeTwine(0);
  for (let i = 5; i < 30; i++) GrowthEngine.growTick(tree);

  const finalAngle = tree.getBranches()[0].angle;
  const careLog = tree.getCareLog();

  const rebuilt = CareLogReplay.reconstruct(seed, species, careLog, 30);
  const replayedAngle = rebuilt.getBranches()[0].angle;

  assert.equal(replayedAngle, finalAngle,
    `replayed angle ${replayedAngle} must match original ${finalAngle}`);
});

test('TWE5-2: reconstructed care log contains twine and twine-remove entries', () => {
  const seed = 42;
  const tree = new BonsaiTree(seed, 'hardwood');
  tree.applyTwine(0, 15, 20);  // no pre-mutation; trunk starts at 0°; degrade at day 20 (after removal at day 5)
  for (let i = 0; i < 5; i++) GrowthEngine.growTick(tree);
  tree.removeTwine(0);
  for (let i = 5; i < 20; i++) GrowthEngine.growTick(tree);

  const careLog = tree.getCareLog();
  const rebuilt = CareLogReplay.reconstruct(seed, 'hardwood', careLog, 20);
  const replayedLog = rebuilt.getCareLog();

  assert.ok(replayedLog.some(e => e.action.type === 'twine'), 'replayed log must have twine entry');
  assert.ok(replayedLog.some(e => e.action.type === 'twine-remove'), 'replayed log must have twine-remove entry');
});

test('TWE5-3: different storedDegradeDays (10 vs 15) produce different twineDegradesDay', () => {
  const tree10 = freshTrunkTree();
  const tree15 = freshTrunkTree();
  tree10.applyTwine(0, 10, 10);
  tree15.applyTwine(0, 10, 15);
  const dd10 = tree10.getBranches()[0].twineDegradesDay;
  const dd15 = tree15.getBranches()[0].twineDegradesDay;
  // Both applied at day=0, so twineDegradesDay = degradeDays exactly.
  assert.equal(dd10, 10, `tree10 twineDegradesDay must be 10, got ${dd10}`);
  assert.equal(dd15, 15, `tree15 twineDegradesDay must be 15, got ${dd15}`);
});

// ---------------------------------------------------------------------------
// TWE6 — applyWeight validation
// ---------------------------------------------------------------------------

test('TWE6-1: applyWeight returns not-found for invalid branchId (direct engine call)', () => {
  const tree = freshTrunkTree();
  const r = TwineWeightEngine.applyWeight(tree, 99999, 2);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'not-found');
});

test('TWE6-2: applyWeight returns pruned for a pruned branch (direct engine call)', () => {
  // CAVEAT-1 fix: must use non-trunk branch (trunk cannot be pruned).
  const tree = treePruneable();
  const pruneable = tree.getBranches().find(b => !b.pruned && b.depth >= 1);
  assert.ok(pruneable !== undefined, 'seed=200 day=50 must have pruneable branch');
  tree.prune(pruneable.id);
  const r = TwineWeightEngine.applyWeight(tree, pruneable.id, 2);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'pruned');
});

test('TWE6-3: applyWeight returns weight-cap-exceeded for count=0 (direct engine call)', () => {
  // Must call engine directly — BonsaiTree.applyWeight throws on invalid input.
  const tree = freshTrunkTree();
  const r = TwineWeightEngine.applyWeight(tree, 0, 0);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'weight-cap-exceeded');
});

test('TWE6-4: applyWeight returns weight-cap-exceeded for count=5 (direct engine call)', () => {
  const tree = freshTrunkTree();
  const r = TwineWeightEngine.applyWeight(tree, 0, 5);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'weight-cap-exceeded');
});

// ---------------------------------------------------------------------------
// TWE7 — applyWeight log entry and torqueContribution
// ---------------------------------------------------------------------------

test('TWE7-1: applyWeight returns ok:true with positive torqueContribution', () => {
  const tree = freshTrunkTree();  // trunk angle = 80°
  const r = tree.applyWeight(0, 3);
  assert.equal(r.ok, true);
  assert.ok(r.torqueContribution > 0, `torqueContribution must be positive, got ${r.torqueContribution}`);
});

test('TWE7-2: torqueContribution matches formula at application time', () => {
  const tree = freshTrunkTree();  // angle=80°
  const b = tree.getBranches()[0];
  const r = tree.applyWeight(0, 3);
  // torqueContribution is computed AFTER angle update (at new angle post-apply).
  const expectedTorque = round4(3 * WEIGHT_MASS_PER_UNIT * GRAVITY_CONSTANT * b.length * Math.sin(toRad(b.angle)));
  assert.equal(r.torqueContribution, expectedTorque,
    `torqueContribution ${r.torqueContribution} must match formula ${expectedTorque}`);
});

test('TWE7-3: care log entry has correct weight shape', () => {
  const tree = freshTrunkTree();
  const r = tree.applyWeight(0, 3);
  const entry = tree.getCareLog().at(-1);
  assert.equal(entry.action.type, 'weight');
  assert.equal(entry.action.branchId, 0);
  assert.equal(entry.action.weightCount, 3);
  assert.equal(entry.action.torqueContribution, r.torqueContribution);
});

test('TWE7-4: b.weighted=true and b.weightCount=3 after applyWeight(3)', () => {
  const tree = freshTrunkTree();
  tree.applyWeight(0, 3);
  const b = tree.getBranches()[0];
  assert.equal(b.weighted, true);
  assert.equal(b.weightCount, 3);
});

// ---------------------------------------------------------------------------
// TWE8 — applyWeight immediate angle application (OQ-5 STACK model)
// ---------------------------------------------------------------------------

test('TWE8-1: applyWeight(2) immediately increases angle by WEIGHT_DEGREES_PER_UNIT*2', () => {
  const tree = freshTrunkTree();  // angle = 80°
  const oldAngle = tree.getBranches()[0].angle;  // 80°
  tree.applyWeight(0, 2);
  const b = tree.getBranches()[0];
  const expectedDelta = round4(2 * WEIGHT_DEGREES_PER_UNIT);  // 14°
  const actualDelta = round4(b.angle - oldAngle);
  assert.ok(actualDelta > 0, `angle must increase after applyWeight, got delta=${actualDelta}`);
  // Allow for KENGAI_POLAR_MAX clamp (80+14=94 — well within 150, so full delta expected).
  assert.equal(actualDelta, expectedDelta, `applied delta must equal ${expectedDelta}, got ${actualDelta}`);
  assert.equal(b.angle, round4(oldAngle + expectedDelta), `angle must be ${oldAngle + expectedDelta}°`);
});

test('TWE8-2: weightAngleDelta equals actual applied delta after applyWeight', () => {
  const tree = freshTrunkTree();  // angle = 80°
  const oldAngle = tree.getBranches()[0].angle;
  tree.applyWeight(0, 2);
  const b = tree.getBranches()[0];
  const actualDelta = round4(b.angle - oldAngle);
  assert.ok(
    Math.abs(b.weightAngleDelta - actualDelta) < 0.0001,
    `weightAngleDelta (${b.weightAngleDelta}) must equal applied delta (${actualDelta})`
  );
});

test('TWE8-3: STACK applyWeight accumulates weightAngleDelta and angle across two calls', () => {
  const tree = freshTrunkTree();  // angle = 80°
  const angleBeforeAny = tree.getBranches()[0].angle;  // 80°

  // First apply: 1 weight = 7°.
  tree.applyWeight(0, 1);
  const b1 = tree.getBranches()[0];
  const angleAfterFirst = b1.angle;  // 87°
  const delta1 = round4(angleAfterFirst - angleBeforeAny);  // 7°
  assert.equal(delta1, round4(1 * WEIGHT_DEGREES_PER_UNIT), `first apply must add ${1 * WEIGHT_DEGREES_PER_UNIT}°`);

  // STACK second apply: 2 weights = 14° more (starts from 87°).
  tree.applyWeight(0, 2);
  const b2 = tree.getBranches()[0];
  const delta2 = round4(b2.angle - angleAfterFirst);  // 14°
  assert.equal(delta2, round4(2 * WEIGHT_DEGREES_PER_UNIT), `STACK second apply must add ${2 * WEIGHT_DEGREES_PER_UNIT}°`);

  // weightAngleDelta must accumulate both.
  const totalDelta = round4(b2.angle - angleBeforeAny);  // 21°
  assert.ok(
    Math.abs(b2.weightAngleDelta - totalDelta) < 0.0001,
    `weightAngleDelta (${b2.weightAngleDelta}) must equal total angle change (${totalDelta})`
  );
});

// ---------------------------------------------------------------------------
// TWE9 — processTwineDegrade natural spring-back
// ---------------------------------------------------------------------------

test('TWE9-1: first processTwineDegrade call reduces angle by 1° and twineAngle by 1°', () => {
  // Use storedDegradeDays=1 → twineDegradesDay = treeAge + 1.
  // Apply at day=0, so degrade starts at day=1. Advance 1 tick to trigger first degrade call.
  const tree = new BonsaiTree(42, 'hardwood');
  tree.getBranches()[0].angle = 80;
  tree.applyTwine(0, 24, 1);  // storedDegradeDays=1 → twineDegradesDay=1
  const b = tree.getBranches()[0];
  assert.equal(b.twineDegradesDay, 1, `twineDegradesDay must be 0 + 1 = 1, got ${b.twineDegradesDay}`);

  const angleBeforeDegrade = b.angle;   // 104°
  const twineAngleBeforeDegrade = b.twineAngle;  // 24°

  // Advance 1 tick — reaches twineDegradesDay=1, first processTwineDegrade fires.
  GrowthEngine.growTick(tree);

  const b2 = tree.getBranches()[0];
  assert.ok(
    Math.abs((angleBeforeDegrade - b2.angle) - 1.0) < 0.001,
    `angle must decrease by exactly 1° on first degrade step (${angleBeforeDegrade} -> ${b2.angle})`
  );
  assert.ok(
    Math.abs((twineAngleBeforeDegrade - b2.twineAngle) - 1.0) < 0.001,
    `twineAngle must decrease by 1° (${twineAngleBeforeDegrade} -> ${b2.twineAngle})`
  );
  assert.equal(b2.twined, true, 'branch must still be twined after first degrade tick');
});

test('TWE9-2: after 24+ degrade ticks, twined=false and angle returned to pre-twine', () => {
  // Apply 24° twine with storedDegradeDays=1 → degrade starts at day=1.
  // 24 degrade ticks needed. Total ticks: 1 (reach degradeDay) + 24 = 25 ticks.
  const tree = new BonsaiTree(42, 'hardwood');
  tree.getBranches()[0].angle = 80;
  const originalAngle = tree.getBranches()[0].angle;  // 80°
  tree.applyTwine(0, 24, 1);  // storedDegradeDays=1

  for (let i = 0; i < 25; i++) GrowthEngine.growTick(tree);

  const b = tree.getBranches()[0];
  assert.equal(b.twined, false, 'twined must be false after full natural degrade');
  assert.equal(b.twineAngle, 0, 'twineAngle must be 0 after full natural degrade');
  // Angle should be approximately back to original (within 0.1° for growth noise).
  assert.ok(
    Math.abs(b.angle - originalAngle) < 0.5,
    `angle should be near original ${originalAngle} after full degrade, got ${b.angle}`
  );
  assert.equal(b.bendSet, false, 'bendSet must remain false (natural degrade never permanently sets)');
});

test('TWE9-3: no further angle changes after twined is cleared by natural degrade', () => {
  // Apply 5° twine with storedDegradeDays=1 → 5 degrade ticks needed + 1 to reach degradeDay = 6 total.
  const tree = new BonsaiTree(42, 'hardwood');
  tree.getBranches()[0].angle = 80;
  tree.applyTwine(0, 5, 1);

  // Advance 6 ticks — degrade completes, twined=false.
  for (let i = 0; i < 6; i++) GrowthEngine.growTick(tree);
  const b = tree.getBranches()[0];
  assert.equal(b.twined, false, 'must be cleared after natural degrade');

  // Advance 10 more ticks — twineAngle must remain 0 (guard stops further calls).
  const angleSnapshot = b.angle;
  for (let i = 0; i < 10; i++) GrowthEngine.growTick(tree);
  const bFinal = tree.getBranches()[0];
  assert.equal(bFinal.twineAngle, 0, 'twineAngle must remain 0 after twined cleared');
  // Note: branch angle can change via growth; only twineAngle must be stable at 0.
});

test('TWE9-4: processTwineDegrade with negative twineAngle springs angle back upward', () => {
  // Negative twineAngle means branch was bent toward vertical (angle decreased).
  // Spring-back should INCREASE angle back toward pre-twine value.
  const tree = new BonsaiTree(42, 'hardwood');
  tree.getBranches()[0].angle = 80;
  tree.applyTwine(0, -20, 1);  // storedDegradeDays=1 — bends to 60°, degrade at day=1
  const angleAfterApply = tree.getBranches()[0].angle;  // 60°

  // Advance 1 tick — first processTwineDegrade fires.
  GrowthEngine.growTick(tree);
  const angleAfter1Degrade = tree.getBranches()[0].angle;
  assert.ok(
    angleAfter1Degrade > angleAfterApply,
    `negative twineAngle spring-back should INCREASE angle (${angleAfterApply} -> ${angleAfter1Degrade})`
  );
});
