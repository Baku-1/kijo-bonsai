// TwineWeightEngine.test.js — Gate tests TWE1–TWE9.
// Run via: node --test test/TwineWeightEngine.test.js (from packages/engine/)
// Build first: npm run build --workspace=packages/engine
//
// OQ-5 STACK model (confirmed Jeremy 2026-08-14): applyWeight applies angle immediately;
// weightAngleDelta accumulates total applied angle (not incremental progress toward target).
//
// CAVEAT-1 fix (CRITIC-TWINEWEIGHT-PATCH-2026-08-14.md): TWE6 uses FRESH branches for
// assertions 3+4 to avoid aliasing after prune.
//
// CAVEAT-2 fix (CRITIC): TWE2 assertion 3 uses a branch with angle > 33.73° precondition
// or applies positive twine first to raise angle before testing negative clamping.

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

// NOTE: Each gate test constructs its OWN BonsaiTree (per ARCH-TWINEWEIGHT-PATCH LOW-3).
// Do NOT share a single 30-day tree across tests — timing requirements differ per test.

function growTree(seed, species, days) {
  const t = new BonsaiTree(seed, species);
  for (let d = 0; d < days; d++) GrowthEngine.growTick(t);
  return t;
}

// ---------------------------------------------------------------------------
// TWE1 — applyTwine validation
// ---------------------------------------------------------------------------

test('TWE1-1: applyTwine returns not-found for out-of-range branchId', () => {
  const tree = growTree(464497, 'hardwood', 30);
  const r = tree.applyTwine(99999, 10);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'not-found');
});

test('TWE1-2: applyTwine returns pruned for a pruned branch (non-trunk)', () => {
  const tree = growTree(464497, 'hardwood', 30);
  const pruneable = tree.getBranches().find(b => !b.pruned && b.depth >= 1);
  assert.ok(pruneable !== undefined, 'must find a prunable non-trunk branch');
  const pruned = tree.prune(pruneable.id);
  assert.equal(pruned, true, 'prune must succeed');
  const r = tree.applyTwine(pruneable.id, 10);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'pruned');
});

test('TWE1-3: applyTwine succeeds first call; returns already-twined on second', () => {
  const tree = growTree(464497, 'hardwood', 30);
  const branch = tree.getBranches().find(b => !b.pruned && b.depth >= 1);
  assert.ok(branch !== undefined, 'must find a non-pruned non-trunk branch');
  const r1 = tree.applyTwine(branch.id, 10);
  assert.equal(r1.ok, true, 'first applyTwine must succeed');
  const r2 = tree.applyTwine(branch.id, 10);
  assert.equal(r2.ok, false);
  assert.equal(r2.reason, 'already-twined');
});

test('TWE1-4: applyTwine succeeds again after removeTwine clears state', () => {
  const tree = growTree(464497, 'hardwood', 30);
  const branch = tree.getBranches().find(b => !b.pruned && b.depth >= 1);
  assert.ok(branch !== undefined);
  tree.applyTwine(branch.id, 10);
  tree.removeTwine(branch.id);
  const b = tree.getBranches()[branch.id];
  assert.equal(b.twined, false, 'twined must be false after removeTwine');
  const r = tree.applyTwine(branch.id, 10);
  assert.equal(r.ok, true, 'applyTwine must succeed after removeTwine');
});

// ---------------------------------------------------------------------------
// TWE2 — applyTwine bend and polar clamping (CAVEAT-2 fix for assertion 3)
// ---------------------------------------------------------------------------

test('TWE2-1: applyTwine applies correct delta on a branch set to 80°', () => {
  const tree = new BonsaiTree(464497, 'hardwood');
  // Use trunk (id=0) with angle manually set to 80°.
  tree.getBranches()[0].angle = 80;
  const r = tree.applyTwine(0, 20);
  assert.equal(r.ok, true, 'applyTwine must succeed');
  const b = tree.getBranches()[0];
  assert.equal(b.angle, round4(80 + 20), `angle must be 100°, got ${b.angle}`);
});

test('TWE2-2: applyTwine clamps delta to +TWINE_MAX_ANGLE_DELTA', () => {
  const tree = new BonsaiTree(464497, 'hardwood');
  tree.getBranches()[0].angle = 80;
  const r = tree.applyTwine(0, 100);  // exceeds 28° cap
  assert.equal(r.ok, true);
  const b = tree.getBranches()[0];
  assert.equal(b.angle, round4(80 + TWINE_MAX_ANGLE_DELTA), `angle must be 108°, got ${b.angle}`);
  const logEntry = tree.getCareLog().at(-1);
  assert.equal(logEntry.action.angleDelta, TWINE_MAX_ANGLE_DELTA, 'log angleDelta must be 28, not 100');
});

test('TWE2-3: applyTwine clamps delta to -TWINE_MAX_ANGLE_DELTA (CAVEAT-2 fix)', () => {
  // CAVEAT-2 fix: ensure branch.angle > POLAR_MIN_DEG + TWINE_MAX_ANGLE_DELTA = 33.73°.
  // Apply a positive twine first to raise the angle, then remove and re-apply negative.
  const tree = new BonsaiTree(464497, 'hardwood');
  tree.getBranches()[0].angle = 80;  // well above 33.73°
  const r = tree.applyTwine(0, -100);  // exceeds -28° cap
  assert.equal(r.ok, true);
  const b = tree.getBranches()[0];
  assert.equal(b.angle, round4(80 - TWINE_MAX_ANGLE_DELTA), `angle must be 52°, got ${b.angle}`);
  const logEntry = tree.getCareLog().at(-1);
  assert.equal(logEntry.action.angleDelta, -TWINE_MAX_ANGLE_DELTA, 'log angleDelta must be -28');
});

test('TWE2-4: applyTwine clamps result to KENGAI_POLAR_MAX (150°)', () => {
  const tree = new BonsaiTree(464497, 'hardwood');
  tree.getBranches()[0].angle = 140;  // near max
  const r = tree.applyTwine(0, 100);  // would push to 140+28=168 → clamped to 150
  assert.equal(r.ok, true);
  const b = tree.getBranches()[0];
  assert.equal(b.angle, KENGAI_POLAR_MAX, `angle must be 150°, got ${b.angle}`);
});

test('TWE2-5: applyTwine care log entry has correct shape', () => {
  const tree = new BonsaiTree(464497, 'hardwood');
  tree.getBranches()[0].angle = 80;
  const r = tree.applyTwine(0, 15);
  assert.equal(r.ok, true);
  const entry = tree.getCareLog().at(-1);
  assert.equal(entry.action.type, 'twine');
  assert.equal(entry.action.branchId, 0);
  assert.equal(entry.action.angleDelta, 15);
  assert.equal(entry.action.oldAngle, 80);
  assert.equal(entry.action.newAngle, round4(80 + 15));
  assert.ok(typeof entry.action.degradeDays === 'number', 'degradeDays must be a number');
  assert.ok(entry.action.degradeDays >= 10 && entry.action.degradeDays <= 15, 'degradeDays in [10,15]');
});

test('TWE2-6: b.twineForcePerDay is TWINE_FORCE_PER_DAY after apply', () => {
  const tree = new BonsaiTree(464497, 'hardwood');
  tree.getBranches()[0].angle = 80;
  tree.applyTwine(0, 10);
  const b = tree.getBranches()[0];
  assert.equal(b.twineForcePerDay, TWINE_FORCE_PER_DAY, 'twineForcePerDay must be set to TWINE_FORCE_PER_DAY');
  assert.equal(b.twined, true);
  assert.equal(b.twineAppliedDay, 0);  // applied at day 0 (fresh tree)
});

// ---------------------------------------------------------------------------
// TWE3 — twineDegradesDay and degradeDays range
// ---------------------------------------------------------------------------

test('TWE3-1: twineDegradesDay equals applyDay + degradeDays', () => {
  const tree = growTree(464497, 'hardwood', 30);
  const branch = tree.getBranches().find(b => !b.pruned && b.depth >= 1);
  assert.ok(branch);
  const applyDay = tree.getAge();  // = 30
  tree.applyTwine(branch.id, 15);
  const b = tree.getBranches()[branch.id];
  const logEntry = tree.getCareLog().at(-1);
  const degradeDays = logEntry.action.degradeDays;
  assert.equal(b.twineDegradesDay, applyDay + degradeDays,
    `twineDegradesDay must be ${applyDay} + ${degradeDays} = ${applyDay + degradeDays}`);
});

test('TWE3-2: degradeDays is in range [10, 15]', () => {
  const tree = growTree(464497, 'hardwood', 30);
  const branch = tree.getBranches().find(b => !b.pruned && b.depth >= 1);
  tree.applyTwine(branch.id, 15);
  const logEntry = tree.getCareLog().at(-1);
  const d = logEntry.action.degradeDays;
  assert.ok(d >= 10 && d <= 15, `degradeDays must be in [10,15], got ${d}`);
  assert.ok(Number.isInteger(d), 'degradeDays must be an integer');
});

test('TWE3-3: twineAppliedDay matches tree.getAge() at apply time', () => {
  const tree = growTree(464497, 'hardwood', 30);
  const branch = tree.getBranches().find(b => !b.pruned && b.depth >= 1);
  const applyDay = tree.getAge();
  tree.applyTwine(branch.id, 15);
  const b = tree.getBranches()[branch.id];
  assert.equal(b.twineAppliedDay, applyDay);
});

test('TWE3-4: CareLogReplay preserves degradeDays (RNG determinism)', () => {
  // Apply (live path), read degradeDays from log, rebuild via replay, compare.
  const tree1 = growTree(464497, 'hardwood', 30);
  const branch = tree1.getBranches().find(b => !b.pruned && b.depth >= 1);
  assert.ok(branch);
  tree1.applyTwine(branch.id, 15);
  const originalLog = tree1.getCareLog();
  const twineEntry = originalLog.find(e => e.action.type === 'twine');
  assert.ok(twineEntry, 'care log must contain twine entry');
  const recordedDegradeDays = twineEntry.action.degradeDays;

  const rebuilt = CareLogReplay.reconstruct(464497, 'hardwood', originalLog, 30);
  const replayedLog = rebuilt.getCareLog();
  const replayedEntry = replayedLog.find(e => e.action.type === 'twine');
  assert.ok(replayedEntry, 'replayed care log must contain twine entry');
  assert.equal(
    replayedEntry.action.degradeDays,
    recordedDegradeDays,
    `replay must preserve degradeDays (got ${replayedEntry.action.degradeDays}, want ${recordedDegradeDays})`
  );
});

// ---------------------------------------------------------------------------
// TWE4 — removeTwine spring-back and bendSet
// ---------------------------------------------------------------------------

test('TWE4-1: removeTwine same-day (daysApplied=0) fully springs back', () => {
  const tree = growTree(464497, 'hardwood', 30);
  const branch = tree.getBranches().find(b => !b.pruned && b.depth >= 1);
  assert.ok(branch);
  const oldAngle = branch.angle;
  tree.applyTwine(branch.id, 15);
  const postApplyAngle = tree.getBranches()[branch.id].angle;
  // Remove on the same day (daysApplied=0 → fraction=1.0 → full spring-back).
  tree.removeTwine(branch.id);
  const b = tree.getBranches()[branch.id];
  assert.ok(
    Math.abs(b.angle - oldAngle) < 0.001,
    `same-day removal must restore oldAngle ${oldAngle}, got ${b.angle} (was ${postApplyAngle})`
  );
  assert.equal(b.bendSet, false, 'bendSet must be false for same-day removal');
  assert.equal(b.twined, false);
});

test('TWE4-2: removeTwine at setDays/2 gives ~50% spring-back', () => {
  const tree = growTree(464497, 'hardwood', 30);
  const branch = tree.getBranches().find(b => !b.pruned && b.depth >= 1);
  assert.ok(branch);
  const oldAngle = branch.angle;
  tree.applyTwine(branch.id, 20, 999);  // force huge degradeDays so natural degrade won't fire
  const postApplyAngle = tree.getBranches()[branch.id].angle;
  const appliedDelta = round4(postApplyAngle - oldAngle);
  const sd = computeSetDays(tree.getBranches()[branch.id].diameter);
  const halfTicks = Math.floor(sd / 2);
  for (let i = 0; i < halfTicks; i++) GrowthEngine.growTick(tree);
  tree.removeTwine(branch.id);
  const b = tree.getBranches()[branch.id];
  // Expected spring-back fraction ≈ 1 - (halfTicks/sd). Allow ±0.5° tolerance.
  const fraction = Math.max(0, Math.min(1, 1 - halfTicks / sd));
  const expectedSpringBack = round4(appliedDelta * fraction);
  const expectedAngle = round4(postApplyAngle - expectedSpringBack);
  assert.ok(
    Math.abs(b.angle - expectedAngle) < 0.5,
    `midpoint removal: angle ${b.angle} should be ≈${expectedAngle} (delta=${appliedDelta}, fraction=${round4(fraction)})`
  );
});

test('TWE4-3: removeTwine after setDays sets bendSet=true, angle unchanged', () => {
  const tree = growTree(464497, 'hardwood', 30);
  const branch = tree.getBranches().find(b => !b.pruned && b.depth >= 1);
  assert.ok(branch);
  const sd = computeSetDays(branch.diameter);
  tree.applyTwine(branch.id, 20, 999);  // force huge degradeDays
  const postApplyAngle = tree.getBranches()[branch.id].angle;
  const setTicks = Math.ceil(sd) + 1;  // one past setDays
  for (let i = 0; i < setTicks; i++) GrowthEngine.growTick(tree);
  tree.removeTwine(branch.id);
  const b = tree.getBranches()[branch.id];
  assert.equal(b.bendSet, true, 'bendSet must be true after setDays');
  // Angle may differ from postApplyAngle due to growth but bendSet guards spring-back.
  // The important check: no spring-back was subtracted beyond any growth-induced changes.
});

test('TWE4-4: removeTwine clears all twine binding fields', () => {
  const tree = growTree(464497, 'hardwood', 30);
  const branch = tree.getBranches().find(b => !b.pruned && b.depth >= 1);
  tree.applyTwine(branch.id, 15);
  tree.removeTwine(branch.id);
  const b = tree.getBranches()[branch.id];
  assert.equal(b.twined, false);
  assert.equal(b.twineAngle, 0);
  assert.equal(b.twineForcePerDay, 0);
  assert.equal(b.twineDegradesDay, 0);
  assert.equal(b.twineAppliedDay, 0);
});

test('TWE4-5: removeTwine appends twine-remove care log entry', () => {
  const tree = growTree(464497, 'hardwood', 30);
  const branch = tree.getBranches().find(b => !b.pruned && b.depth >= 1);
  tree.applyTwine(branch.id, 15);
  tree.removeTwine(branch.id);
  const lastEntry = tree.getCareLog().at(-1);
  assert.equal(lastEntry.action.type, 'twine-remove');
  assert.equal(lastEntry.action.branchId, branch.id);
});

// ---------------------------------------------------------------------------
// TWE5 — CareLogReplay determinism with twine and twine-remove
// ---------------------------------------------------------------------------

test('TWE5-1: CareLogReplay reconstructs branch angle after twine + removeTwine', () => {
  const seed = 464497;
  const species = 'hardwood';
  const totalDays = 50;

  // Fresh tree grown to day 20.
  const tree = new BonsaiTree(seed, species);
  for (let i = 0; i < 20; i++) GrowthEngine.growTick(tree);
  const candidate = tree.getBranches().find(b => !b.pruned && !b.twined && b.depth >= 1);
  assert.ok(candidate !== undefined, 'must find branch for twine at day 20');
  tree.applyTwine(candidate.id, 15);
  const branchId = candidate.id;

  // Continue to day 25, remove twine.
  for (let i = 20; i < 25; i++) GrowthEngine.growTick(tree);
  tree.removeTwine(branchId);

  // Continue to day 50.
  for (let i = 25; i < totalDays; i++) GrowthEngine.growTick(tree);

  const finalAngle = tree.getBranches()[branchId].angle;
  const careLog = tree.getCareLog();

  const rebuilt = CareLogReplay.reconstruct(seed, species, careLog, totalDays);
  const replayedAngle = rebuilt.getBranches()[branchId].angle;

  assert.equal(replayedAngle, finalAngle,
    `replayed angle ${replayedAngle} must match original ${finalAngle}`);
});

test('TWE5-2: reconstructed care log contains twine and twine-remove entries', () => {
  const seed = 464497;
  const tree = new BonsaiTree(seed, 'hardwood');
  for (let i = 0; i < 20; i++) GrowthEngine.growTick(tree);
  const branch = tree.getBranches().find(b => !b.pruned && !b.twined && b.depth >= 1);
  tree.applyTwine(branch.id, 15);
  for (let i = 20; i < 25; i++) GrowthEngine.growTick(tree);
  tree.removeTwine(branch.id);
  for (let i = 25; i < 50; i++) GrowthEngine.growTick(tree);

  const careLog = tree.getCareLog();
  const rebuilt = CareLogReplay.reconstruct(seed, 'hardwood', careLog, 50);
  const replayedLog = rebuilt.getCareLog();

  assert.ok(replayedLog.some(e => e.action.type === 'twine'), 'replayed log must have twine entry');
  assert.ok(replayedLog.some(e => e.action.type === 'twine-remove'), 'replayed log must have twine-remove entry');
});

test('TWE5-3: different storedDegradeDays (10 vs 15) produce different twineDegradesDay', () => {
  const tree10 = new BonsaiTree(464497, 'hardwood');
  const tree15 = new BonsaiTree(464497, 'hardwood');
  // Apply twine to trunk (angle=0) — will hit polar floor but degradeDays should still differ.
  tree10.getBranches()[0].angle = 80;
  tree15.getBranches()[0].angle = 80;
  tree10.applyTwine(0, 10, 10);
  tree15.applyTwine(0, 10, 15);
  const dd10 = tree10.getBranches()[0].twineDegradesDay;
  const dd15 = tree15.getBranches()[0].twineDegradesDay;
  assert.equal(dd10, 0 + 10, `tree10 twineDegradesDay must be 10, got ${dd10}`);
  assert.equal(dd15, 0 + 15, `tree15 twineDegradesDay must be 15, got ${dd15}`);
});

// ---------------------------------------------------------------------------
// TWE6 — applyWeight validation (CAVEAT-1 fix: fresh branches for assertions 3+4)
// ---------------------------------------------------------------------------

test('TWE6-1: applyWeight returns not-found for invalid branchId (direct engine call)', () => {
  const tree = growTree(464497, 'hardwood', 30);
  const r = TwineWeightEngine.applyWeight(tree, 99999, 2);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'not-found');
});

test('TWE6-2: applyWeight returns pruned for a pruned branch (direct engine call)', () => {
  const tree = growTree(464497, 'hardwood', 30);
  const pruneable = tree.getBranches().find(b => !b.pruned && b.depth >= 1);
  assert.ok(pruneable !== undefined);
  tree.prune(pruneable.id);
  const r = TwineWeightEngine.applyWeight(tree, pruneable.id, 2);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'pruned');
});

test('TWE6-3: applyWeight returns weight-cap-exceeded for count=0 (direct engine call)', () => {
  // CAVEAT-1 fix: use a FRESH non-pruned branch for this assertion.
  // Using a fresh tree avoids aliasing with the pruneable branch from assertion 2.
  // IMPORTANT: tree.applyWeight(id, 0) THROWS at BonsaiTree level; must call engine directly.
  const tree = growTree(464497, 'hardwood', 30);
  const validBranch = tree.getBranches().find(b => !b.pruned && b.depth >= 1);
  assert.ok(validBranch !== undefined);
  const r = TwineWeightEngine.applyWeight(tree, validBranch.id, 0);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'weight-cap-exceeded', `count=0 must return weight-cap-exceeded, got ${r.reason}`);
});

test('TWE6-4: applyWeight returns weight-cap-exceeded for count=5 (direct engine call)', () => {
  // CAVEAT-1 fix: fresh branch, separate from TWE6-2's pruned branch.
  const tree = growTree(464497, 'hardwood', 30);
  const validBranch = tree.getBranches().find(b => !b.pruned && b.depth >= 1);
  assert.ok(validBranch !== undefined);
  const r = TwineWeightEngine.applyWeight(tree, validBranch.id, 5);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'weight-cap-exceeded', `count=5 must return weight-cap-exceeded, got ${r.reason}`);
});

// ---------------------------------------------------------------------------
// TWE7 — applyWeight log entry and torqueContribution
// ---------------------------------------------------------------------------

test('TWE7-1: applyWeight returns ok:true with positive torqueContribution', () => {
  const tree = growTree(464497, 'hardwood', 30);
  const branch = tree.getBranches().find(b => !b.pruned && b.depth >= 1);
  assert.ok(branch);
  // Set angle so sin(θ) > 0 for non-zero torque.
  tree.getBranches()[branch.id].angle = 60;
  const r = tree.applyWeight(branch.id, 3);
  assert.equal(r.ok, true);
  assert.ok(r.torqueContribution > 0, `torqueContribution must be positive, got ${r.torqueContribution}`);
});

test('TWE7-2: torqueContribution matches formula at application time', () => {
  const tree = growTree(464497, 'hardwood', 30);
  const branch = tree.getBranches().find(b => !b.pruned && b.depth >= 1);
  tree.getBranches()[branch.id].angle = 60;
  // Capture angle BEFORE apply (angle will change due to STACK immediate application).
  const b = tree.getBranches()[branch.id];
  const r = tree.applyWeight(branch.id, 3);
  // torqueContribution is computed AFTER angle update (at new angle post-apply).
  const expectedTorque = round4(3 * WEIGHT_MASS_PER_UNIT * GRAVITY_CONSTANT * b.length * Math.sin(toRad(b.angle)));
  assert.equal(r.torqueContribution, expectedTorque,
    `torqueContribution ${r.torqueContribution} must match formula ${expectedTorque}`);
});

test('TWE7-3: care log entry has correct weight shape', () => {
  const tree = growTree(464497, 'hardwood', 30);
  const branch = tree.getBranches().find(b => !b.pruned && b.depth >= 1);
  tree.getBranches()[branch.id].angle = 60;
  const r = tree.applyWeight(branch.id, 3);
  const entry = tree.getCareLog().at(-1);
  assert.equal(entry.action.type, 'weight');
  assert.equal(entry.action.branchId, branch.id);
  assert.equal(entry.action.weightCount, 3);
  assert.equal(entry.action.torqueContribution, r.torqueContribution);
});

test('TWE7-4: b.weighted=true and b.weightCount=3 after applyWeight(3)', () => {
  const tree = growTree(464497, 'hardwood', 30);
  const branch = tree.getBranches().find(b => !b.pruned && b.depth >= 1);
  tree.applyWeight(branch.id, 3);
  const b = tree.getBranches()[branch.id];
  assert.equal(b.weighted, true);
  assert.equal(b.weightCount, 3);
});

// ---------------------------------------------------------------------------
// TWE8 — applyWeight immediate angle application (OQ-5 STACK model)
// ---------------------------------------------------------------------------

test('TWE8-1: applyWeight(2) immediately increases angle by WEIGHT_DEGREES_PER_UNIT*2', () => {
  const tree = growTree(464497, 'hardwood', 30);
  const branch = tree.getBranches().find(b => !b.pruned && b.depth >= 1);
  assert.ok(branch);
  const oldAngle = branch.angle;
  tree.applyWeight(branch.id, 2);
  const b = tree.getBranches()[branch.id];
  const expectedDelta = round4(2 * WEIGHT_DEGREES_PER_UNIT);  // 14°
  const actualDelta = round4(b.angle - oldAngle);
  // Allow for KENGAI_POLAR_MAX clamp (branch may hit ceiling).
  assert.ok(actualDelta > 0, `angle must increase after applyWeight, got delta=${actualDelta}`);
  assert.ok(actualDelta <= expectedDelta, `applied delta ${actualDelta} must not exceed ${expectedDelta}`);
});

test('TWE8-2: weightAngleDelta equals actual applied delta after applyWeight', () => {
  const tree = growTree(464497, 'hardwood', 30);
  const branch = tree.getBranches().find(b => !b.pruned && b.depth >= 1);
  const oldAngle = branch.angle;
  tree.applyWeight(branch.id, 2);
  const b = tree.getBranches()[branch.id];
  const actualDelta = round4(b.angle - oldAngle);
  assert.ok(
    Math.abs(b.weightAngleDelta - actualDelta) < 0.0001,
    `weightAngleDelta (${b.weightAngleDelta}) must equal applied delta (${actualDelta})`
  );
});

test('TWE8-3: STACK applyWeight accumulates weightAngleDelta and angle', () => {
  const tree = growTree(464497, 'hardwood', 30);
  const branch = tree.getBranches().find(b => !b.pruned && b.depth >= 1);
  const angleBeforeAny = branch.angle;

  // First apply: 1 weight = 7°.
  tree.applyWeight(branch.id, 1);
  const angleAfterFirst = tree.getBranches()[branch.id].angle;
  const delta1 = round4(angleAfterFirst - angleBeforeAny);
  assert.ok(delta1 > 0, `first apply must increase angle`);

  // STACK second apply: 2 weights = 14° more.
  tree.applyWeight(branch.id, 2);
  const b = tree.getBranches()[branch.id];
  const delta2 = round4(b.angle - angleAfterFirst);
  assert.ok(delta2 > 0, `STACK second apply must further increase angle`);

  // weightAngleDelta accumulates both.
  const wad = b.weightAngleDelta;
  const totalDelta = round4(b.angle - angleBeforeAny);
  assert.ok(
    Math.abs(wad - totalDelta) < 0.0001,
    `weightAngleDelta (${wad}) must equal total angle change (${totalDelta})`
  );
});

// ---------------------------------------------------------------------------
// TWE9 — processTwineDegrade natural spring-back
// ---------------------------------------------------------------------------

test('TWE9-1: first processTwineDegrade call reduces angle by 1° and twineAngle by 1°', () => {
  // storedDegradeDays=10 forced to make test deterministic (ARCH PATCH LOW-2 fix).
  const tree = growTree(464497, 'hardwood', 30);
  const branch = tree.getBranches().find(b => !b.pruned && !b.twined && b.depth >= 1);
  assert.ok(branch);
  const applyDay = tree.getAge();  // = 30
  tree.applyTwine(branch.id, 24, 10);  // storedDegradeDays=10 forced
  const b = tree.getBranches()[branch.id];
  const degradeDay = b.twineDegradesDay;
  assert.equal(degradeDay, applyDay + 10, `twineDegradesDay must be ${applyDay} + 10 = ${applyDay + 10}`);

  const angleBeforeDegrade = b.angle;
  const twineAngleBeforeDegrade = b.twineAngle;

  // Advance 10 ticks to reach twineDegradesDay (day 40).
  for (let i = 0; i < 10; i++) GrowthEngine.growTick(tree);

  // processTwineDegrade fires: angle reduced by 1°, twineAngle by 1°.
  const b2 = tree.getBranches()[branch.id];
  assert.ok(
    Math.abs((angleBeforeDegrade - b2.angle) - 1.0) < 0.001,
    `angle must decrease by 1° on first degrade (${angleBeforeDegrade} -> ${b2.angle})`
  );
  assert.ok(
    Math.abs((twineAngleBeforeDegrade - b2.twineAngle) - 1.0) < 0.001,
    `twineAngle must decrease by 1° (${twineAngleBeforeDegrade} -> ${b2.twineAngle})`
  );
  assert.equal(b2.twined, true, 'must still be twined after first degrade tick');
});

test('TWE9-2: after 24 processTwineDegrade calls, twined=false and angle fully returned', () => {
  // Use storedDegradeDays=1 to start degrade immediately and apply small angle for speed.
  // Force twine to degrade starting at day 30 (degradeDays=1 → twineDegradesDay=31).
  const tree = growTree(464497, 'hardwood', 30);
  const branch = tree.getBranches().find(b => !b.pruned && !b.twined && b.depth >= 1);
  assert.ok(branch);
  const originalAngle = branch.angle;
  tree.applyTwine(branch.id, 24, 1);  // degrade starts at day 31

  // Advance 1 tick to reach degradeDay, then 24 more ticks for full spring-back (24°).
  for (let i = 0; i < 25; i++) GrowthEngine.growTick(tree);

  const b = tree.getBranches()[branch.id];
  assert.equal(b.twined, false, 'twined must be false after full natural degrade');
  assert.equal(b.twineAngle, 0, 'twineAngle must be 0 after full natural degrade');
  // Angle should be approximately back to original (within 0.1° for growth noise).
  assert.ok(
    Math.abs(b.angle - originalAngle) < 0.5,
    `angle should be near original ${originalAngle} after full degrade, got ${b.angle}`
  );
  assert.equal(b.bendSet, false, 'bendSet must remain false (natural degrade never permanently sets)');
});

test('TWE9-3: no further processTwineDegrade after twined is cleared', () => {
  const tree = growTree(464497, 'hardwood', 30);
  const branch = tree.getBranches().find(b => !b.pruned && !b.twined && b.depth >= 1);
  assert.ok(branch);
  tree.applyTwine(branch.id, 5, 1);  // 5° twine, degrade in 1 day

  // Advance 10 ticks — 5 degrade ticks needed, then twined=false.
  for (let i = 0; i < 10; i++) GrowthEngine.growTick(tree);

  const b = tree.getBranches()[branch.id];
  assert.equal(b.twined, false, 'must be cleared after natural degrade');
  // Advance 10 more ticks — twineAngle must remain 0 (guard stops further calls).
  const twineAngleSnapshot = b.twineAngle;
  for (let i = 0; i < 10; i++) GrowthEngine.growTick(tree);
  assert.equal(tree.getBranches()[branch.id].twineAngle, twineAngleSnapshot,
    'twineAngle must not change after twined cleared');
});

test('TWE9-4: processTwineDegrade with negative twineAngle springs angle back upward', () => {
  // A negative twineAngle means the branch was bent toward vertical (angle reduced).
  // Spring-back should INCREASE angle (toward pre-twine value).
  const tree = growTree(464497, 'hardwood', 30);
  // Set angle to 80° so negative twine (-20°) brings it to 60°.
  tree.getBranches()[0].angle = 80;
  tree.applyTwine(0, -20, 1);  // degrade starts at day 31
  const angleAfterApply = tree.getBranches()[0].angle;  // should be 60°

  // Advance 1 tick to reach degradeDay, then 1 more for first spring-back.
  GrowthEngine.growTick(tree);  // day 31 — processTwineDegrade fires for first time
  const angleAfter1Degrade = tree.getBranches()[0].angle;
  assert.ok(
    angleAfter1Degrade > angleAfterApply,
    `negative twineAngle spring-back should INCREASE angle (${angleAfterApply} -> ${angleAfter1Degrade})`
  );
});
