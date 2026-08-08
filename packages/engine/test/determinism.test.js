// determinism.test.js — migrated 2026-08-07 from tick() (legacy) to BonsaiTree + GrowthEngine (production).
// Legacy tick() was retired as part of dual-engine cleanup; this file now exercises the authoritative path.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BonsaiTree, GrowthEngine } from '../dist/index.js';

function grow(seed, species = 'hardwood', days = 150) {
  const tree = new BonsaiTree(seed, species);
  for (let d = 0; d < days; d++) {
    if (d % 3 === 0) tree.water(25);
    if (d % 7 === 0) tree.rotate();
    GrowthEngine.growTick(tree);
  }
  return tree;
}

test('same seed + species + care log ⇒ identical tree (core invariant)', () => {
  assert.deepEqual(grow(42), grow(42));
});

test('different seeds diverge', () => {
  assert.notDeepEqual(grow(1).getBranches(), grow(2).getBranches());
});

test('tree grows branches over 150 days', () => {
  const t = grow(42);
  assert.ok(t.getBranches().length > 3, `expected >3 branches, got ${t.getBranches().length}`);
});

test('prune is permanent and cascades to descendants', () => {
  const t = grow(42);
  const branches = t.getBranches();
  const target = branches.find((b) => b.children.length > 0 && b.parent !== null);
  assert.ok(target, 'need a branch with children');
  t.prune(target.id);
  assert.equal(t.getBranches()[target.id].pruned, true);
  for (const c of target.children) assert.equal(t.getBranches()[c].pruned, true);
  GrowthEngine.growTick(t);
  assert.equal(t.getBranches()[target.id].pruned, true); // pruned branch never regrows
});

test('drought stress degrades health', () => {
  // BonsaiTree initial health=85, moisture=55. Run 40 days with no watering.
  // After ~8 days moisture hits 0 (tropical decay ~7/day); thereafter health drops 1.5/day.
  // 40 days gives ample margin to fall well below 70 regardless of exact RNG path.
  const t = new BonsaiTree(7, 'tropical');
  for (let d = 0; d < 40; d++) GrowthEngine.growTick(t); // never water
  assert.ok(t.getHealth() < 70, `health should drop under drought, got ${t.getHealth()}`);
  assert.equal(t.getMoisture(), 0);
});
