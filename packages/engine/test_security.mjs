/**
 * Adversarial security test suite for CareLogReplay.reconstruct().
 *
 * Verifies all 4 critical security gaps identified by the architect pass
 * (ARCHITECT-SECURITY-TESTS-2026-08-01.md):
 *
 *   GAP-1 — 7 CareAction types silently dropped → now throw CareLogReplayError
 *   GAP-2 — totalDays=Infinity infinite loop   → now throws before loop
 *   GAP-3 — water(-1) dehydrates tree          → now throws
 *   GAP-4 — water(NaN) corrupts pipeline       → now throws; StatDeriver sentinel added
 *
 * Run after: npm run build --workspace=packages/engine
 * Command:   node packages/engine/test_security.mjs  (from repo root)
 * Exit 0 = all tests pass.  Exit 1 = any test failed.
 */

import { BonsaiTree }    from './dist/BonsaiTree.js';
import { GrowthEngine }  from './dist/GrowthEngine.js';
import { CareLogReplay } from './dist/CareLogReplay.js';
import { StatDeriver }   from './dist/StatDeriver.js';
import { Voxelizer }     from '../voxelizer/dist/index.js';

// ---------------------------------------------------------------------------
// Test harness (same pattern as existing gate tests)
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(cond, name, detail = '') {
  if (cond) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name}${detail ? ': ' + detail : ''}`);
    failed++;
  }
}

/** Assert fn() throws.  Returns the thrown error for further inspection. */
function assertThrows(fn, name, detail = '') {
  let threw = false;
  let err = null;
  try {
    fn();
  } catch (e) {
    threw = true;
    err = e;
  }
  assert(threw, name, detail + (threw ? '' : ' (did NOT throw)'));
  return err;
}

/** Assert fn() does NOT throw.  Returns the return value. */
function assertNoThrow(fn, name, detail = '') {
  let result = undefined;
  let err = null;
  try {
    result = fn();
  } catch (e) {
    err = e;
  }
  assert(err === null, name, detail + (err ? ` (threw: ${err.message})` : ''));
  return result;
}

/** Grow a fresh tree for N days, watering when moisture < threshold. */
function growTree(seed, species, days, waterAmount = 28, threshold = 25) {
  const tree = new BonsaiTree(seed, species);
  for (let d = 0; d < days; d++) {
    if (tree.getMoisture() < threshold) tree.water(waterAmount);
    GrowthEngine.growTick(tree);
  }
  return tree;
}

/** Check all numeric fields in a StatSheet for NaN or Infinity. */
function hasNonFiniteField(sheet) {
  for (const [k, v] of Object.entries(sheet)) {
    if (typeof v === 'number' && !Number.isFinite(v)) {
      return k;  // return the offending key
    }
  }
  return null;
}

// ===========================================================================
// SECTION 1 — Input validation: water()
// ===========================================================================

console.log('\n━━━ SEC-1: water() input validation ━━━');

// SEC-1-1: water(NaN) must throw
{
  const err = assertThrows(
    () => { const t = new BonsaiTree(42, 'hardwood'); t.water(NaN); },
    'SEC-1-1: water(NaN) throws',
    'NaN moisture would corrupt the entire stat pipeline'
  );
  assert(err instanceof Error, 'SEC-1-1b: thrown value is an Error');
}

// SEC-1-2: water(-1) must throw
{
  assertThrows(
    () => { const t = new BonsaiTree(42, 'hardwood'); t.water(-1); },
    'SEC-1-2: water(-1) throws',
    'negative amount dehydrates instead of hydrating'
  );
}

// SEC-1-3: water(0) must throw
{
  assertThrows(
    () => { const t = new BonsaiTree(42, 'hardwood'); t.water(0); },
    'SEC-1-3: water(0) throws',
    'zero-amount water is a no-op that should never appear in a valid care log'
  );
}

// SEC-1-4: water(Infinity) must throw
{
  assertThrows(
    () => { const t = new BonsaiTree(42, 'hardwood'); t.water(Infinity); },
    'SEC-1-4: water(Infinity) throws',
    'Infinity is not finite — must be rejected regardless of Math.min clamp'
  );
}

// SEC-1-5: water(-Infinity) must throw
{
  assertThrows(
    () => { const t = new BonsaiTree(42, 'hardwood'); t.water(-Infinity); },
    'SEC-1-5: water(-Infinity) throws',
    '-Infinity is not finite — must be rejected'
  );
}

// SEC-1-6: water(28) must NOT throw (valid care action)
{
  assertNoThrow(
    () => { const t = new BonsaiTree(42, 'hardwood'); t.water(28); },
    'SEC-1-6: water(28) does not throw (valid amount)'
  );
}

// SEC-1-7: water(Number.MAX_SAFE_INTEGER) must NOT throw (clamps to 100)
{
  const result = assertNoThrow(
    () => {
      const t = new BonsaiTree(42, 'hardwood');
      t.water(Number.MAX_SAFE_INTEGER);
      return t.getMoisture();
    },
    'SEC-1-7: water(MAX_SAFE_INTEGER) does not throw — clamps to 100'
  );
  assert(result <= 100, 'SEC-1-7b: moisture clamped to ≤ 100', `got ${result}`);
}

// ===========================================================================
// SECTION 2 — Input validation: totalDays in reconstruct()
// ===========================================================================

console.log('\n━━━ SEC-2: totalDays validation in reconstruct() ━━━');

// SEC-2-1: Infinity MUST throw, NOT hang
{
  const start = Date.now();
  const err = assertThrows(
    () => CareLogReplay.reconstruct(42, 'hardwood', [], Infinity),
    'SEC-2-1: reconstruct(…, Infinity) throws (does NOT hang)'
  );
  const elapsed = Date.now() - start;
  assert(elapsed < 1000, `SEC-2-1b: returned in < 1s (elapsed ${elapsed}ms)`);
  assert(
    err && err.message && err.message.includes('finite'),
    'SEC-2-1c: error message mentions "finite"',
    err ? err.message : '(no error)'
  );
}

// SEC-2-2: totalDays = -1 must throw
{
  assertThrows(
    () => CareLogReplay.reconstruct(42, 'hardwood', [], -1),
    'SEC-2-2: reconstruct(…, -1) throws'
  );
}

// SEC-2-3: totalDays = 0 must throw
{
  assertThrows(
    () => CareLogReplay.reconstruct(42, 'hardwood', [], 0),
    'SEC-2-3: reconstruct(…, 0) throws'
  );
}

// SEC-2-4: totalDays = NaN must throw
{
  const start = Date.now();
  const err = assertThrows(
    () => CareLogReplay.reconstruct(42, 'hardwood', [], NaN),
    'SEC-2-4: reconstruct(…, NaN) throws (does NOT hang)'
  );
  const elapsed = Date.now() - start;
  assert(elapsed < 1000, `SEC-2-4b: returned in < 1s (elapsed ${elapsed}ms)`);
}

// SEC-2-5: totalDays > MAX_REPLAY_DAYS (36500) must throw
{
  assertThrows(
    () => CareLogReplay.reconstruct(42, 'hardwood', [], 36501),
    'SEC-2-5: reconstruct(…, 36501) throws (exceeds 36500 max)'
  );
}

// SEC-2-6: totalDays = Number.MAX_SAFE_INTEGER must throw fast (NOT hang)
{
  const start = Date.now();
  assertThrows(
    () => CareLogReplay.reconstruct(42, 'hardwood', [], Number.MAX_SAFE_INTEGER),
    'SEC-2-6: reconstruct(…, MAX_SAFE_INTEGER) throws (does NOT hang)'
  );
  const elapsed = Date.now() - start;
  assert(elapsed < 1000, `SEC-2-6b: returned in < 1s (elapsed ${elapsed}ms)`);
}

// SEC-2-7: totalDays = 1 must NOT throw (minimum valid value)
{
  assertNoThrow(
    () => CareLogReplay.reconstruct(42, 'hardwood', [], 1),
    'SEC-2-7: reconstruct(…, 1) does not throw (minimum valid)'
  );
}

// ===========================================================================
// SECTION 3 — Unknown / unimplemented action types
// ===========================================================================

console.log('\n━━━ SEC-3: Unknown/unimplemented action types ━━━');

// SEC-3-1: wire-remove must be processed (Phase 2 -- no longer throws).
{
  const tree = assertNoThrow(
    () => CareLogReplay.reconstruct(42, 'hardwood', [
      { day: 1, action: { type: 'wire-remove', branchId: 0 } }
    ], 10),
    'SEC-3-1: care log with wire-remove succeeds (Phase 2 -- WireEngine.removeWire now routed)'
  );
  assert(tree != null, 'SEC-3-1b: reconstruct returns a tree');
  assert(
    tree != null && tree.getBranches()[0]?.wired === false,
    'SEC-3-1c: branch 0 remains un-wired after replay (removeWire is no-op when not wired)'
  );
}

// SEC-3-2: jin must NOT silently pass
{
  const err = assertThrows(
    () => CareLogReplay.reconstruct(42, 'hardwood', [
      { day: 1, action: { type: 'jin', branchId: 0, segmentIndex: 0, jinCost: 1 } }
    ], 10),
    'SEC-3-2: care log with jin throws (not silently dropped)'
  );
  assert(
    err && err.constructor.name === 'CareLogReplayError',
    'SEC-3-2b: thrown error is CareLogReplayError',
    err ? `got ${err.constructor.name}` : '(no error)'
  );
}

// SEC-3-3: twine must be processed (Phase 2 -- no longer throws).
// Phase 1 stubs threw CareLogReplayError; Phase 2 implements the real logic.
// Verify: reconstruct with a valid twine action succeeds and branch 0 ends up twined.
{
  const tree = assertNoThrow(
    () => CareLogReplay.reconstruct(42, 'hardwood', [
      { day: 1, action: { type: 'twine', branchId: 0, angleDelta: 10, oldAngle: 20, newAngle: 30, degradeDays: 10 } }
    ], 10),
    'SEC-3-3: care log with valid twine action succeeds (Phase 2 -- applyTwine now implemented)'
  );
  assert(tree != null, 'SEC-3-3b: reconstruct returns a tree');
  assert(
    tree != null && tree.getBranches()[0]?.twined === true,
    'SEC-3-3c: branch 0 is twined after replay (Phase 2 applyTwine wired in CareLogReplay)'
  );
}

// SEC-3-4: twine-remove must be processed (Phase 2 -- no longer throws).
// removeTwine on an un-twined branch is a no-op; reconstruct must not throw.
// Verify: branch 0 remains un-twined (was never twined in this log).
{
  const tree = assertNoThrow(
    () => CareLogReplay.reconstruct(42, 'hardwood', [
      { day: 1, action: { type: 'twine-remove', branchId: 0 } }
    ], 10),
    'SEC-3-4: care log with twine-remove succeeds (Phase 2 -- no-op on un-twined branch)'
  );
  assert(tree != null, 'SEC-3-4b: reconstruct returns a tree');
  assert(
    tree != null && tree.getBranches()[0]?.twined === false,
    'SEC-3-4c: branch 0 remains un-twined after replay (removeTwine is no-op when not twined)'
  );
}

// SEC-3-5: weight must be processed (Phase 2 -- no longer throws).
// Verify: reconstruct with a valid weight action succeeds and branch 0 ends up weighted.
{
  const tree = assertNoThrow(
    () => CareLogReplay.reconstruct(42, 'hardwood', [
      { day: 1, action: { type: 'weight', branchId: 0, weightCount: 1, torqueContribution: 0.5 } }
    ], 10),
    'SEC-3-5: care log with valid weight action succeeds (Phase 2 -- applyWeight now implemented)'
  );
  assert(tree != null, 'SEC-3-5b: reconstruct returns a tree');
  assert(
    tree != null && tree.getBranches()[0]?.weighted === true,
    'SEC-3-5c: branch 0 is weighted after replay (Phase 2 applyWeight wired in CareLogReplay)'
  );
}

// SEC-3-6: weight-remove must be processed (Phase 2 -- no longer throws).
// removeWeight on an un-weighted branch is a no-op; reconstruct must not throw.
// Verify: branch 0 remains un-weighted (was never weighted in this log).
{
  const tree = assertNoThrow(
    () => CareLogReplay.reconstruct(42, 'hardwood', [
      { day: 1, action: { type: 'weight-remove', branchId: 0 } }
    ], 10),
    'SEC-3-6: care log with weight-remove succeeds (Phase 2 -- no-op on un-weighted branch)'
  );
  assert(tree != null, 'SEC-3-6b: reconstruct returns a tree');
  assert(
    tree != null && tree.getBranches()[0]?.weighted === false,
    'SEC-3-6c: branch 0 remains un-weighted after replay (removeWeight is no-op when not weighted)'
  );
}

// SEC-3-7: landscape must NOT silently pass
{
  assertThrows(
    () => CareLogReplay.reconstruct(42, 'hardwood', [
      { day: 1, action: { type: 'landscape', elementType: 'rock', position: { x: 128, y: 128, z: 128 } } }
    ], 10),
    'SEC-3-7: care log with landscape throws (not silently dropped)'
  );
}

// SEC-3-8: unknown-action must throw
{
  const err = assertThrows(
    () => CareLogReplay.reconstruct(42, 'hardwood', [
      // @ts-ignore — deliberately invalid type for adversarial testing
      { day: 1, action: { type: 'unknown-action' } }
    ], 10),
    'SEC-3-8: care log with unknown-action type throws'
  );
  // The error message should name the unknown type
  assert(
    err && err.message && err.message.includes('unknown-action'),
    "SEC-3-8b: error message identifies the unknown type 'unknown-action'",
    err ? err.message : '(no error)'
  );
}

// SEC-3-9: Valid care log (water + prune) must NOT throw — regression guard
{
  const tree = growTree(42, 'hardwood', 100);
  const careLog = tree.getCareLog();
  const hasPruneOrWater = careLog.some(e => e.action.type === 'water' || e.action.type === 'prune');
  assertNoThrow(
    () => CareLogReplay.reconstruct(42, 'hardwood', careLog, 100),
    'SEC-3-9: valid care log (water/prune only) does not throw',
    `careLog has ${careLog.length} entries`
  );
}

// ===========================================================================
// SECTION 4 — Determinism probes (must PASS, not throw)
// ===========================================================================

console.log('\n━━━ SEC-4: Determinism probes ━━━');

// SEC-4-1: seed=0 produces a valid StatSheet with no NaN fields
{
  const result = assertNoThrow(
    () => {
      const tree = CareLogReplay.reconstruct(0, 'hardwood', [], 50);
      const { voxels, zones } = Voxelizer.voxelize(tree);
      return StatDeriver.derive(tree, voxels, tree.getSeed(), tree.getAge(), zones);
    },
    'SEC-4-1: seed=0, empty log, 50 days produces valid StatSheet'
  );
  if (result) {
    const badField = hasNonFiniteField(result);
    assert(badField === null, 'SEC-4-1b: no NaN/Infinity fields in StatSheet', badField ? `field '${badField}' is not finite` : '');
    console.log(`    seed=0 StatSheet: ${JSON.stringify(result)}`);
  }
}

// SEC-4-2: seed=Number.MAX_SAFE_INTEGER produces a valid StatSheet
{
  const result = assertNoThrow(
    () => {
      const tree = CareLogReplay.reconstruct(Number.MAX_SAFE_INTEGER, 'hardwood', [], 50);
      const { voxels, zones } = Voxelizer.voxelize(tree);
      return StatDeriver.derive(tree, voxels, tree.getSeed(), tree.getAge(), zones);
    },
    'SEC-4-2: seed=MAX_SAFE_INTEGER, empty log, 50 days produces valid StatSheet'
  );
  if (result) {
    const badField = hasNonFiniteField(result);
    assert(badField === null, 'SEC-4-2b: no NaN/Infinity fields in StatSheet (MAX_SAFE_INTEGER seed)', badField ? `field '${badField}' is not finite` : '');
    console.log(`    seed=MAX_SAFE_INTEGER StatSheet: ${JSON.stringify(result)}`);
  }
}

// SEC-4-3: Same seed+log run twice → bit-identical StatSheet
{
  const seed    = 42;
  const species = 'hardwood';
  const days    = 80;

  // Build a care log with water + prune
  const origTree = growTree(seed, species, days);
  const careLog  = origTree.getCareLog();
  console.log(`    SEC-4-3 care log: ${careLog.length} entries`);

  const sheet1 = (() => {
    const t = CareLogReplay.reconstruct(seed, species, careLog, days);
    const { voxels, zones } = Voxelizer.voxelize(t);
    return StatDeriver.derive(t, voxels, t.getSeed(), t.getAge(), zones);
  })();

  const sheet2 = (() => {
    const t = CareLogReplay.reconstruct(seed, species, careLog, days);
    const { voxels, zones } = Voxelizer.voxelize(t);
    return StatDeriver.derive(t, voxels, t.getSeed(), t.getAge(), zones);
  })();

  const identical = JSON.stringify(sheet1) === JSON.stringify(sheet2);
  assert(identical, 'SEC-4-3: same seed+log run twice → bit-identical StatSheet');
  if (!identical) {
    console.error('    run1:', JSON.stringify(sheet1));
    console.error('    run2:', JSON.stringify(sheet2));
  }
}

// SEC-4-4: Determinism across different totalDays values (superset property)
//   A tree grown to 100 days should have the same trunk length at day-50
//   as a tree grown to exactly 50 days.  (CareLogReplay grows from day 0 each time.)
{
  const seedA = 99;
  const tree50 = CareLogReplay.reconstruct(seedA, 'hardwood', [], 50);
  const tree100 = CareLogReplay.reconstruct(seedA, 'hardwood', [], 100);

  // The day-50 trunk should have the same length in both (superset property)
  const trunk50  = tree50.getBranches()[0];
  const trunk100 = tree100.getBranches()[0];

  assert(
    trunk50.length <= trunk100.length,
    'SEC-4-4: trunk at day-100 ≥ trunk at day-50 (monotone growth)',
    `day50=${trunk50.length} day100=${trunk100.length}`
  );

  const branchCount50  = tree50.getBranches().length;
  const branchCount100 = tree100.getBranches().length;
  assert(
    branchCount100 >= branchCount50,
    'SEC-4-4b: more days → same or more total branches (no de-growth)',
    `day50=${branchCount50} day100=${branchCount100}`
  );
}

// ===========================================================================
// SECTION 5 — NaN propagation sentinel
// ===========================================================================

console.log('\n━━━ SEC-5: NaN propagation sentinel ━━━');

// SEC-5-1: water(NaN) is blocked at source — NaN never reaches moisture
{
  let moistureAfter = undefined;
  try {
    const t = new BonsaiTree(42, 'hardwood');
    t.water(NaN);
    moistureAfter = t.getMoisture();  // should never reach here
  } catch (_) {
    // expected
  }
  assert(
    moistureAfter === undefined,
    'SEC-5-1: water(NaN) throws before moisture is mutated (NaN never enters moisture)'
  );
}

// SEC-5-2: water(-28) is blocked at source — moisture cannot be dehydrated by a water action
{
  let moistureAfter = undefined;
  try {
    const t = new BonsaiTree(42, 'hardwood');
    const before = t.getMoisture();
    t.water(-28);
    moistureAfter = t.getMoisture();  // should never reach here
  } catch (_) {
    // expected
  }
  assert(
    moistureAfter === undefined,
    'SEC-5-2: water(-28) throws before moisture is mutated (dehydration exploit blocked)'
  );
}

// SEC-5-3: A valid 50-day tree via reconstruct() produces a StatSheet with no non-finite fields
{
  const tree = CareLogReplay.reconstruct(42, 'hardwood', [
    { day: 0, action: { type: 'water', amount: 28 } },
    { day: 10, action: { type: 'fertilize' } },
  ], 50);
  const { voxels, zones } = Voxelizer.voxelize(tree);
  const sheet = StatDeriver.derive(tree, voxels, tree.getSeed(), tree.getAge(), zones);
  const badField = hasNonFiniteField(sheet);
  assert(
    badField === null,
    'SEC-5-3: valid reconstruct() → StatSheet has no NaN/Infinity fields',
    badField ? `field '${badField}' is not finite` : ''
  );
}

// SEC-5-4: StatDeriver sentinel: construct a scenario where all voxels exist
//   (empty care log, just growth) and confirm all StatSheet fields are finite
{
  const tree = CareLogReplay.reconstruct(464497, 'hardwood', [], 100);
  const { voxels, zones } = Voxelizer.voxelize(tree);
  const sheet = StatDeriver.derive(tree, voxels, tree.getSeed(), tree.getAge(), zones);
  const badField = hasNonFiniteField(sheet);
  assert(
    badField === null,
    'SEC-5-4: 100-day empty-log tree → all StatSheet fields finite',
    badField ? `field '${badField}' is not finite` : ''
  );
  console.log(`    StatSheet (100-day, no care): ${JSON.stringify(sheet)}`);
}

// SEC-5-5: End-to-end NaN gate — confirm no crafted care log (from the implemented
//   types) can produce a NaN StatSheet without first throwing
{
  // Try every legal variant of bad water amounts through reconstruct —
  // all must throw BEFORE a NaN enters the tree/stat system.
  const badAmounts = [NaN, -1, 0, -28, Infinity, -Infinity];
  let allThrew = true;
  for (const amount of badAmounts) {
    let threw = false;
    try {
      const tree = CareLogReplay.reconstruct(42, 'hardwood', [
        { day: 0, action: { type: 'water', amount } }
      ], 5);
      // If we reach here, reconstruct did NOT throw — check moisture for NaN
      if (!Number.isFinite(tree.getMoisture())) {
        console.error(`  NaN moisture escaped for water(${amount})!`);
        allThrew = false;
      }
    } catch (_) {
      threw = true;
    }
    if (!threw) allThrew = false;
  }
  assert(
    allThrew,
    'SEC-5-5: every bad water amount in a care log throws before corrupting the tree'
  );
}

// ===========================================================================
// SECTION 6 -- BonsaiTree guard layer validation (CAVEAT-C, 2026-08-14)
// ===========================================================================
//
// The engine (TwineWeightEngine) assumes valid inputs; the guard layer lives in
// BonsaiTree. Direct callers of TwineWeightEngine bypass these guards and must
// ensure valid inputs themselves. This section verifies that BonsaiTree's guards
// are present and functional for the applyTwine path.
//
// See: AUDIT-TWINEWEIGHT-PHASE2-2026-08-14.md CAVEAT-C
//      IMPL-TWE-CAVEAT-FIXES-2026-08-14.md (this fix)
// NOTE: applyWeight guard coverage (non-finite, non-integer, out-of-range) is deferred to a future task.

console.log('\n--- SEC-6: BonsaiTree guard layer validation ---');

// SEC-6-1: BonsaiTree.applyTwine(0, NaN) must throw CareLogReplayError.
// Guard is in BonsaiTree (line 204-208): !Number.isFinite(angleDelta) throws.
// NOT in TwineWeightEngine -- direct engine calls bypass this guard entirely.
{
  const tree = growTree(42, 'hardwood', 5);
  const err = assertThrows(
    () => tree.applyTwine(0, NaN),
    'SEC-6-1: BonsaiTree.applyTwine(0, NaN) throws (non-finite angleDelta rejected by guard)'
  );
  assert(
    err && err.constructor.name === 'CareLogReplayError',
    'SEC-6-1b: thrown error is CareLogReplayError (BonsaiTree guard, not a generic Error)',
    err ? `got ${err.constructor.name}` : '(no error)'
  );
}

// ===========================================================================
// Summary
// ===========================================================================

const line = '─'.repeat(60);
console.log(`\n${line}`);
console.log(`Security test result: ${passed} passed, ${failed} failed`);
console.log(line);

if (failed > 0) {
  process.exit(1);
}
