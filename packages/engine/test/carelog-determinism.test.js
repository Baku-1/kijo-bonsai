// carelog-determinism.test.js — BUG-4: CareLogReplay determinism suite
// Spec: docs/pipeline/ARCH-BUG4-CARELOG-DETERMINISM-2026-08-07.md
// Critic fixes applied:
//   BUG-C1 — hydratedSchedule uses water(15)/2 days (not water(50)/day) to keep
//             moisture in [30,65] so health gains +0.8/day instead of hitting the >80 floor.
//   GAP-C1 — prunedId retrieved via post-hoc scan, not assumed.
//
// Phase 1 only: uses water, prune, wire. Does NOT trigger Phase 2 stubs (twine, weight, jin).
// REQUIRES: npm run build in packages/engine before running.
// Run: node --test test/carelog-determinism.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { BonsaiTree, GrowthEngine, CareLogReplay, PruneEngine } from '../dist/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a tree over numDays by calling scheduleFn(tree, d) then growTick each day. */
function buildTree(seed, species, numDays, scheduleFn) {
  const tree = new BonsaiTree(seed, species);
  for (let d = 0; d < numDays; d++) {
    scheduleFn(tree, d);
    GrowthEngine.growTick(tree);
  }
  return tree;
}

/**
 * Standard care schedule factory — returns a stateful function.
 * Call makeStandardSchedule() fresh for each buildTree call.
 *   - water(25) every 3 days
 *   - prune first non-root, non-pruned branch at or after day 20 (deferred until available)
 *   - wire trunk (id=0) by +30° on day 30
 */
function makeStandardSchedule() {
  let pruneFired = false;
  return function standardSchedule(tree, d) {
    if (d % 3 === 0) tree.water(25);
    if (d >= 20 && !pruneFired) {
      const branch = tree.getBranches().find(b => b.parent !== null && !b.pruned);
      if (branch) {
        PruneEngine.prune(tree, branch.id);
        pruneFired = true;
      }
    }
    if (d === 30) tree.wire(0, 30);
  };
}

/** No-op schedule — no care actions. */
const noOpSchedule = () => {};

/**
 * Moderate watering schedule: water(15) every 2 days.
 * BUG-C1 fix: moisture stays ~[50-65] (in [30,65]) → health +0.8/day.
 * water(50)/day would saturate moisture at ~100 (>80) → health -1.5/day, same as drought.
 */
const hydratedSchedule = (tree, d) => { if (d % 2 === 0) tree.water(15); };

/** Drought schedule: never water. Moisture → 0, health → floor=10. */
const droughtSchedule = () => {};

// ---------------------------------------------------------------------------
// Test A — Identity: same seed + same care log → identical replay tree
// ---------------------------------------------------------------------------
test('Test A — same seed + care log reconstructed → identical tree', () => {
  const liveTree = buildTree(42, 'hardwood', 60, makeStandardSchedule());
  const careLog = liveTree.getCareLog();
  const N = liveTree.getAge();

  assert.equal(N, 60, 'liveTree.getAge() should equal 60 after 60 growTicks');

  const replayTree = CareLogReplay.reconstruct(42, 'hardwood', careLog, N);

  // Primary assertion: full branch state identity
  assert.deepEqual(replayTree.getBranches(), liveTree.getBranches());
  assert.equal(replayTree.getHealth(), liveTree.getHealth());
  assert.equal(replayTree.getMoisture(), liveTree.getMoisture());
  assert.equal(replayTree.getAge(), N);
  assert.equal(replayTree.getRotationState(), liveTree.getRotationState());

  // GAP-C1: scan post-hoc for the pruned non-root branch
  const prunedId = liveTree.getBranches().findIndex(b => b.pruned && b.parent !== null);
  assert.ok(
    prunedId >= 1,
    `Expected a pruned non-root branch (prunedId=${prunedId}); prune did not fire — check standardSchedule`
  );
  assert.equal(
    replayTree.getBranches()[prunedId].pruned,
    true,
    `Branch ${prunedId} should be pruned in replay tree`
  );

  // Spot check: wired trunk
  assert.ok(
    replayTree.getBranches()[0].wireCount >= 1,
    'Trunk wireCount should be >= 1 after wire(0, 30)'
  );
  assert.equal(
    replayTree.getBranches()[0].angle,
    liveTree.getBranches()[0].angle,
    'Trunk angle in replay should match live tree'
  );
});

// ---------------------------------------------------------------------------
// Test B — Divergence: different care logs → different replayed trees
// ---------------------------------------------------------------------------
test('Test B — different care logs → divergent replays (same seed)', () => {
  const treeHydrated = buildTree(42, 'hardwood', 60, hydratedSchedule);
  const treeDrought  = buildTree(42, 'hardwood', 60, droughtSchedule);

  const replayHydrated = CareLogReplay.reconstruct(42, 'hardwood', treeHydrated.getCareLog(), 60);
  const replayDrought  = CareLogReplay.reconstruct(42, 'hardwood', treeDrought.getCareLog(),  60);

  // BUG-C1: moderate watering keeps moisture in [30,65] → health +0.8/day → health ≈ 100.
  // Drought: moisture → 0 within ~7 days → health -1.5/day → health = 10 (floor).
  assert.ok(
    replayHydrated.getHealth() > replayDrought.getHealth(),
    `hydrated health (${replayHydrated.getHealth()}) should exceed drought health (${replayDrought.getHealth()})`
  );

  // Moisture divergence: hydrated ~55, drought = 0.
  assert.ok(
    replayHydrated.getMoisture() > replayDrought.getMoisture(),
    `hydrated moisture (${replayHydrated.getMoisture()}) should exceed drought moisture (${replayDrought.getMoisture()})`
  );

  // Branch geometry diverges: moisture-dependent growth rate produces different lengths/thicknesses.
  assert.notDeepEqual(
    replayHydrated.getBranches(),
    replayDrought.getBranches(),
    'Branch arrays should differ between hydrated and drought replays'
  );
});

// ---------------------------------------------------------------------------
// Test C — Empty care log: reconstruct with [] matches no-care grow
// ---------------------------------------------------------------------------
test('Test C — empty care log replay matches no-care grow (seed=99)', () => {
  const liveTree   = buildTree(99, 'hardwood', 100, noOpSchedule);
  const replayTree = CareLogReplay.reconstruct(99, 'hardwood', [], 100);

  assert.deepEqual(replayTree.getBranches(), liveTree.getBranches());
  assert.equal(replayTree.getHealth(), liveTree.getHealth());
  assert.equal(replayTree.getMoisture(), liveTree.getMoisture());
  assert.equal(replayTree.getAge(), 100);
  // No rotate in empty schedule; both rotation states should be 0.
  assert.equal(replayTree.getRotationState(), liveTree.getRotationState());
});

// ---------------------------------------------------------------------------
// Test D — Partial replay: totalDays=50 truncates a 100-day log correctly
// ---------------------------------------------------------------------------
test('Test D — partial replay (totalDays=50) matches 50-day live tree', () => {
  // treeN: full 100-day run; treeM: only 50-day run — same seed + schedule.
  // First 50 days are identical in both because standardSchedule is a pure function of (tree, d)
  // and tree state is identical up to day 50 for the same seed.
  const treeN   = buildTree(42, 'hardwood', 100, makeStandardSchedule());
  const treeM   = buildTree(42, 'hardwood',  50, makeStandardSchedule());
  // Feed treeN's full 100-day log but ask for only 50 days — entries for days 50–99 are ignored.
  const replayM = CareLogReplay.reconstruct(42, 'hardwood', treeN.getCareLog(), 50);

  assert.deepEqual(replayM.getBranches(), treeM.getBranches());
  assert.equal(replayM.getHealth(), treeM.getHealth());
  assert.equal(replayM.getMoisture(), treeM.getMoisture());
  assert.equal(replayM.getAge(), 50);
});
