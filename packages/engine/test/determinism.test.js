import test from 'node:test';
import assert from 'node:assert/strict';
import { createTree, tick, applyAction } from '../dist/index.js';

function grow(seed, species = 'hardwood', days = 150) {
  let t = createTree(seed, species);
  for (let d = 0; d < days; d++) {
    if (d % 3 === 0) t = applyAction(t, { type: 'water' });
    if (d % 7 === 0) t = applyAction(t, { type: 'rotate' });
    t = tick(t);
  }
  return t;
}

test('same seed + species + care log ⇒ identical tree (core invariant)', () => {
  assert.deepEqual(grow(42), grow(42));
});

test('different seeds diverge', () => {
  assert.notDeepEqual(grow(1).branches, grow(2).branches);
});

test('tree grows branches over 150 days', () => {
  const t = grow(42);
  assert.ok(t.branches.length > 3, `expected >3 branches, got ${t.branches.length}`);
});

test('prune is permanent and cascades to descendants', () => {
  let t = grow(42);
  const target = t.branches.find((b) => b.children.length > 0 && b.parent !== null);
  assert.ok(target, 'need a branch with children');
  t = applyAction(t, { type: 'prune', branchId: target.id });
  assert.equal(t.branches[target.id].pruned, true);
  for (const c of target.children) assert.equal(t.branches[c].pruned, true);
  t = tick(t);
  assert.equal(t.branches[target.id].pruned, true); // never regrows
});

test('drought stress degrades health', () => {
  let t = createTree(7, 'tropical');
  for (let d = 0; d < 20; d++) t = tick(t); // never water
  assert.ok(t.health < 60, `health should drop, got ${t.health}`);
  assert.equal(t.moisture, 0);
});
