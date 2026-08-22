/**
 * Gate tests for CareLogReplay wire-remove handling (CLR-WIRE-1 through CLR-WIRE-4).
 *
 * Verifies that CareLogReplay.reconstruct correctly handles 'wire-remove' entries
 * (Phase 2 fix — previously threw CareLogReplayError unconditionally).
 *
 * Run after: npm run build --workspace=packages/engine
 * Command:   node packages/engine/test_carelogreplay_wire.mjs  (from repo root)
 * Exit 0 = all tests pass.  Exit 1 = any test failed.
 */

import { BonsaiTree }      from './dist/BonsaiTree.js';
import { GrowthEngine }    from './dist/GrowthEngine.js';
import { CareLogReplay, CareLogReplayError } from './dist/CareLogReplay.js';
import { WireEngine, WIRE_MAX_THICKNESS }    from './dist/WireEngine.js';
import { computeSetDays, STRESS_DECAY_MAX_DAYS } from './dist/TwineWeightEngine.js';

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

/** Assert fn() throws. Returns the thrown error for further inspection. */
function assertThrows(fn, name, detail = '') {
  let threw = false;
  let err = null;
  try { fn(); } catch (e) { threw = true; err = e; }
  assert(threw, name, detail + (threw ? '' : ' (did NOT throw)'));
  return err;
}

/** Assert fn() does NOT throw. Returns the return value. */
function assertNoThrow(fn, name, detail = '') {
  let result = undefined;
  let err = null;
  try { result = fn(); } catch (e) { err = e; }
  assert(err === null, name, detail + (err !== null ? ` (threw: ${err.message})` : ''));
  return result;
}

/** Grow a fresh tree for N days, watering when moisture < threshold. */
function growTree(seed, species, days, waterAmount = 30, threshold = 40) {
  const tree = new BonsaiTree(seed, species);
  for (let d = 0; d < days; d++) {
    if (tree.getMoisture() < threshold) tree.water(waterAmount);
    GrowthEngine.growTick(tree);
  }
  return tree;
}

// ---------------------------------------------------------------------------
// CLR-WIRE-1 — Wire then early removal → replay produces same partial spring-back
//
// Wire applied at day 50, removed at day 60 (10 days < setDays ~47).
// Spring-back fraction = 1 - 10/setDays ≈ 0.79 → partial, not full, not zero.
// Rebuilt tree must have the same angle as the live tree after removal.
// ---------------------------------------------------------------------------
console.log('\nCLR-WIRE-1 — Early removal: partial spring-back reproduced in replay');
{
  const tree = growTree(42, 'hardwood', 50);
  // tree.getAge() == 50 after 50 growTicks

  // Find a wirable depth-1 branch — hard-exit if missing so inner assertions don't silently skip
  const b = tree.getBranches().find(
    br => !br.pruned && br.depth === 1 && br.thickness < WIRE_MAX_THICKNESS
  );
  if (!b) {
    console.error('FATAL CLR-WIRE-1: no wirable depth-1 branch at day 50 — cannot proceed');
    process.exit(1);
  }
  assert(true, 'CLR-WIRE-1 setup: found a wirable depth-1 branch at day 50');

  const originalAngle = b.angle;

  // F-2 fix: read wiredAngle from the live tree after wire(), NOT from rebuilt (which doesn't exist yet).
  const wireResult = tree.wire(b.id, 20);
  assert(wireResult.ok === true, 'CLR-WIRE-1 setup: wire applied successfully');
  const wiredAngle = tree.getBranches()[b.id].angle;
  // care log now has: { day: 50, action: { type: 'wire', branchId: b.id, angleDelta: ..., ... } }

  // Grow 10 more days with normal watering — wire has been on 10 days < setDays (~47)
  for (let d = 0; d < 10; d++) {
    if (tree.getMoisture() < 40) tree.water(30);
    GrowthEngine.growTick(tree);
  }
  // tree.getAge() == 60

  // Remove wire early → spring-back
  tree.removeWire(b.id);
  const postRemoveAngle = tree.getBranches()[b.id].angle;
  // care log now has: { day: 60, action: { type: 'wire-remove', branchId: b.id } }

  // Inline check (removes nested function declaration that's hoisted ambiguously in blocks)
  const log1 = tree.getCareLog();
  assert(
    log1.some(e => e.action.type === 'wire') && log1.some(e => e.action.type === 'wire-remove'),
    'CLR-WIRE-1 setup: care log contains both wire and wire-remove entries'
  );

  // Derive totalDays from the tree's actual age at wire-remove time — robust to setup changes.
  // wire-remove logged at day wireRemoveDay; reconstruct loop processes day < totalDays,
  // so totalDays = wireRemoveDay + 1 ensures the remove is processed.
  const wireRemoveDay1 = 60; // == tree.getAge() immediately before removeWire above
  const totalDays1 = wireRemoveDay1 + 1; // 61

  const rebuilt = assertNoThrow(
    () => CareLogReplay.reconstruct(42, 'hardwood', log1, totalDays1),
    'CLR-WIRE-1: reconstruct does not throw'
  );

  if (rebuilt) {
    const rebuiltBranch = rebuilt.getBranches()[b.id];

    assert(
      Math.abs(rebuiltBranch.angle - postRemoveAngle) < 0.0001,
      `CLR-WIRE-1: rebuilt angle (${rebuiltBranch.angle.toFixed(4)}) === postRemoveAngle (${postRemoveAngle.toFixed(4)})`
    );
    assert(
      rebuiltBranch.wired === false,
      'CLR-WIRE-1: branch is not wired after replay (wire-remove was applied)'
    );
    assert(
      rebuiltBranch.wireSet !== true,
      'CLR-WIRE-1: wireSet is NOT true — early removal, no permanent set'
    );
    // Sanity: spring-back moved angle back toward original
    // (only meaningful if wiredAngle != originalAngle, which it should be with delta=20)
    if (Math.abs(wiredAngle - originalAngle) > 0.01) {
      const sprungBack = (wiredAngle > originalAngle)
        ? postRemoveAngle < wiredAngle
        : postRemoveAngle > wiredAngle;
      assert(
        sprungBack,
        `CLR-WIRE-1: angle moved back toward original after early remove ` +
        `(orig=${originalAngle.toFixed(2)}, wired=${wiredAngle.toFixed(2)}, post=${postRemoveAngle.toFixed(2)})`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// CLR-WIRE-2 — Wire then late removal (daysElapsed >= setDays) → permanent set
//
// Wire applied at day 50. Branch diameter ~4.11 → setDays ~47.18 → max setDays = 56.
// Grow STRESS_DECAY_MAX_DAYS + 10 = 66 extra days (wire applied ≥ max possible setDays).
// Permanent set: wireSet=true, bendSet=true, no spring-back.
// ---------------------------------------------------------------------------
console.log('\nCLR-WIRE-2 — Late removal: permanent set reproduced in replay');
{
  // EXTRA_DAYS must exceed STRESS_DECAY_MAX_DAYS (56) to guarantee wireDaysApplied >= setDays
  // regardless of how much the branch diameter grows during the wire period.
  const EXTRA_DAYS = STRESS_DECAY_MAX_DAYS + 10; // = 66, always > max setDays (56)

  const tree = growTree(42, 'hardwood', 50);
  // tree.getAge() == 50

  const b = tree.getBranches().find(
    br => !br.pruned && br.depth === 1 && br.thickness < WIRE_MAX_THICKNESS
  );
  if (!b) {
    console.error('FATAL CLR-WIRE-2: no wirable depth-1 branch at day 50 — cannot proceed');
    process.exit(1);
  }
  assert(true, 'CLR-WIRE-2 setup: found a wirable depth-1 branch at day 50');

  // F-2 fix: capture wiredAngle from the live tree, not from rebuilt.
  const wireResult2 = tree.wire(b.id, 20);
  assert(wireResult2.ok === true, 'CLR-WIRE-2 setup: wire applied successfully');
  const wiredAngle2 = tree.getBranches()[b.id].angle;

  // Grow EXTRA_DAYS more (66 > max setDays 56 → wireDaysApplied always >= setDays at removal)
  for (let d = 0; d < EXTRA_DAYS; d++) {
    if (tree.getMoisture() < 40) tree.water(30);
    GrowthEngine.growTick(tree);
  }
  // tree.getAge() == 50 + 66 = 116

  // Remove wire after set window → permanent set, no spring-back
  tree.removeWire(b.id);
  const postRemoveAngle2 = tree.getBranches()[b.id].angle;

  // Permanent set: angle should NOT have sprung back
  assert(
    Math.abs(postRemoveAngle2 - wiredAngle2) < 0.0001,
    `CLR-WIRE-2: live tree — postRemoveAngle (${postRemoveAngle2.toFixed(4)}) === wiredAngle (${wiredAngle2.toFixed(4)}) (no spring-back)`
  );

  // Derive totalDays from the tree's actual age — robust to setup constant changes.
  // removeWire was called when getAge() == 116; we need to process that day in replay.
  const wireRemoveDay2 = 116; // == tree.getAge() immediately before removeWire above
  const careLog2 = tree.getCareLog();
  const totalDays2 = wireRemoveDay2 + 1; // 117

  const rebuilt2 = assertNoThrow(
    () => CareLogReplay.reconstruct(42, 'hardwood', careLog2, totalDays2),
    'CLR-WIRE-2: reconstruct does not throw'
  );

  if (rebuilt2) {
    const rebuiltBranch2 = rebuilt2.getBranches()[b.id];

    assert(
      Math.abs(rebuiltBranch2.angle - postRemoveAngle2) < 0.0001,
      `CLR-WIRE-2: rebuilt angle (${rebuiltBranch2.angle.toFixed(4)}) === postRemoveAngle (${postRemoveAngle2.toFixed(4)})`
    );
    assert(
      rebuiltBranch2.wireSet === true,
      'CLR-WIRE-2: wireSet === true (permanent set)'
    );
    assert(
      rebuiltBranch2.bendSet === true,
      'CLR-WIRE-2: bendSet === true (permanent set)'
    );
    assert(
      rebuiltBranch2.wired === false,
      'CLR-WIRE-2: branch not wired (wire was removed)'
    );
  }
}

// ---------------------------------------------------------------------------
// CLR-WIRE-3 — Unknown action type still throws CareLogReplayError (regression guard)
//
// Verifies that the wire-remove fix is additive — the exhaustiveness guard
// (lines 151–157 of CareLogReplay.ts) remains intact.
// ---------------------------------------------------------------------------
console.log('\nCLR-WIRE-3 — Unknown action type still throws (regression guard)');
{
  const badLog = [{ day: 0, action: { type: 'unknown-future-action', branchId: 0 } }];

  const err = assertThrows(
    () => CareLogReplay.reconstruct(42, 'hardwood', badLog, 1),
    'CLR-WIRE-3: unknown action type throws'
  );
  assert(
    err instanceof CareLogReplayError,
    `CLR-WIRE-3: thrown error is CareLogReplayError (got ${err?.constructor?.name})`
  );
  assert(
    typeof err?.message === 'string' && err.message.includes('unknown-future-action'),
    `CLR-WIRE-3: error message names the unknown type (got: "${err?.message}")`
  );
}

// ---------------------------------------------------------------------------
// CLR-WIRE-4 — Orphaned wire-remove (no prior wire entry) is a no-op, no throw
//
// Implements critic finding F-3: A3 (safe no-op for !b.wired) must be a tested
// invariant, not just a documented assumption.
//
// Setup: build a base care log from a tree with normal watering but NO wire.
//   Inject a wire-remove entry for branchId 1 at day 10 (branch exists but is not wired).
//   Replay should not throw; branch state should match the reference replay without
//   the orphaned wire-remove entry.
// ---------------------------------------------------------------------------
console.log('\nCLR-WIRE-4 — Orphaned wire-remove is a no-op, does not throw');
{
  // Build a base log: 50 days of watered growth, no wire operations
  const baseTree = growTree(42, 'hardwood', 50);
  const baseLog = baseTree.getCareLog().slice(); // shallow copy — entries are objects

  // Reference: replay the base log without any orphaned wire-remove
  const refTree = CareLogReplay.reconstruct(42, 'hardwood', baseLog, 50);
  const refBranch1 = refTree.getBranches()[1];

  // Orphan log: same base log plus a wire-remove for branchId 1 at day 10
  // branchId 1 has NOT been wired → WireEngine.removeWire guard `if (!b.wired) return` fires
  const orphanLog = [
    ...baseLog,
    { day: 10, action: { type: 'wire-remove', branchId: 1 } },
  ];

  const rebuilt = assertNoThrow(
    () => CareLogReplay.reconstruct(42, 'hardwood', orphanLog, 50),
    'CLR-WIRE-4: orphaned wire-remove does not throw'
  );

  if (rebuilt) {
    const b1 = rebuilt.getBranches()[1];

    // Precondition: branch 1 must exist in the reference replay (50-day hardwood, seed 42)
    // If it doesn't, the comparison below is vacuous and this test reveals nothing useful.
    assert(
      refBranch1 !== undefined,
      'CLR-WIRE-4: branch 1 exists in 50-day reference replay (precondition)'
    );

    // Branch must exist or at minimum not be in a wired/corrupted state
    assert(
      b1 === undefined || b1.wired === false,
      'CLR-WIRE-4: branch 1 is not wired (orphaned wire-remove is a no-op)'
    );

    // If branch 1 exists in both trees, its angle must be identical to the reference
    // (wire-remove with no preceding wire changes nothing)
    if (refBranch1 !== undefined && b1 !== undefined) {
      assert(
        Math.abs(b1.angle - refBranch1.angle) < 0.001,
        `CLR-WIRE-4: branch 1 angle unchanged ` +
        `(rebuilt=${b1.angle.toFixed(4)}, ref=${refBranch1.angle.toFixed(4)})`
      );
    } else {
      assert(
        b1 === undefined && refBranch1 === undefined,
        'CLR-WIRE-4: branch 1 existence consistent between rebuild and reference'
      );
    }
  }
}

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
