/**
 * Gate tests for PruneEngine.
 * Run after: npm run build --workspace=packages/engine
 * Command: node packages/engine/test_prune.mjs (from repo root)
 */
import { BonsaiTree } from './dist/BonsaiTree.js';
import { GrowthEngine } from './dist/GrowthEngine.js';
import { CareLogReplay } from './dist/CareLogReplay.js';
import { Voxelizer } from '../voxelizer/dist/index.js';

let passed = 0, failed = 0;

function assert(cond, name, detail = '') {
  if (cond) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name}${detail ? ': ' + detail : ''}`);
    failed++;
  }
}

/** Grow a fresh tree for N days, watering when moisture < 40 to ensure healthy growth. */
function growTree(seed, species, days) {
  const tree = new BonsaiTree(seed, species);
  for (let d = 0; d < days; d++) {
    if (tree.getMoisture() < 40) tree.water(30);
    GrowthEngine.growTick(tree);
  }
  return tree;
}

// ---------------------------------------------------------------------------
// P1 — Basic prune: returns true, branch flagged pruned
// ---------------------------------------------------------------------------
console.log('\nP1 — Basic prune');
{
  const tree = growTree(42, 'hardwood', 100);
  const branches = tree.getBranches();
  const nonTrunk = branches.find(b => !b.pruned && b.depth > 0);
  assert(nonTrunk !== undefined, 'found a non-trunk living branch');
  if (nonTrunk) {
    const result = tree.prune(nonTrunk.id);
    assert(result === true, 'prune() returns true');
    assert(tree.getBranches()[nonTrunk.id].pruned === true, 'branch is now pruned');
  }
}

// ---------------------------------------------------------------------------
// P2 — V3 gate (voxelizer): pruning a leaf never increases voxel count
// ---------------------------------------------------------------------------
console.log('\nP2 — Voxelizer gate: prune leaf, count decreases or stays same');
{
  const tree = growTree(42, 'hardwood', 100);
  const branches = tree.getBranches();
  // Find a leaf: non-pruned, non-trunk, no living children
  const leaf = branches.find(
    b => !b.pruned && b.depth > 0 &&
      b.children.filter(id => !branches[id].pruned).length === 0
  );
  assert(leaf !== undefined, 'found a living leaf branch');
  if (leaf) {
    const { voxels: beforeVoxels } = Voxelizer.voxelize(tree);
    const beforeCount = beforeVoxels.count();
    tree.prune(leaf.id);
    const { voxels: afterVoxels } = Voxelizer.voxelize(tree);
    const afterCount = afterVoxels.count();
    assert(
      afterCount <= beforeCount,
      `voxel count does not increase after pruning leaf`,
      `before=${beforeCount} after=${afterCount}`
    );
  }
}

// ---------------------------------------------------------------------------
// P3 — Cannot prune trunk (id 0)
// ---------------------------------------------------------------------------
console.log('\nP3 — Cannot prune trunk');
{
  const tree = growTree(42, 'hardwood', 100);
  const result = tree.prune(0);
  assert(result === false, 'prune(0) returns false');
  assert(tree.getBranches()[0].pruned === false, 'trunk remains unpruned');
}

// ---------------------------------------------------------------------------
// P4 — Cannot re-prune: second call returns false
// ---------------------------------------------------------------------------
console.log('\nP4 — Cannot re-prune');
{
  const tree = growTree(42, 'hardwood', 100);
  const branches = tree.getBranches();
  const b = branches.find(b => !b.pruned && b.depth > 0);
  assert(b !== undefined, 'found a living branch');
  if (b) {
    tree.prune(b.id);
    const second = tree.prune(b.id);
    assert(second === false, 'second prune() returns false');
  }
}

// ---------------------------------------------------------------------------
// P5 — Cascade: prune a branch with living children; all descendants pruned
// ---------------------------------------------------------------------------
console.log('\nP5 — Cascade: all descendants pruned');
{
  const tree = growTree(42, 'hardwood', 100);
  const branches = tree.getBranches();
  // Find a branch with at least one living child
  const parent = branches.find(
    b => !b.pruned && b.depth > 0 &&
      b.children.filter(id => !branches[id].pruned).length > 0
  );
  assert(parent !== undefined, 'found a branch with living children');
  if (parent) {
    // Collect all living descendants before pruning
    const descendants = [];
    const stack = [...parent.children];
    while (stack.length > 0) {
      const id = stack.pop();
      const desc = branches[id];
      if (!desc || desc.pruned) continue;
      descendants.push(id);
      stack.push(...desc.children);
    }
    assert(descendants.length > 0, 'parent has living descendants');

    tree.prune(parent.id);
    const afterBranches = tree.getBranches();
    assert(afterBranches[parent.id].pruned, 'parent is pruned');
    let allDescPruned = true;
    for (const id of descendants) {
      if (!afterBranches[id].pruned) { allDescPruned = false; break; }
    }
    assert(allDescPruned, `all ${descendants.length} descendants are pruned`);
  }
}

// ---------------------------------------------------------------------------
// P6 — CareLogReplay determinism with prune
//
// Build original tree watering whenever moisture < 40 (same deterministic
// pattern) and prune one branch at day 75.  Replay must produce bit-identical
// voxelization.
// ---------------------------------------------------------------------------
console.log('\nP6 — CareLogReplay determinism with prune');
{
  const seed = 42;
  const species = 'hardwood';
  const totalDays = 150;

  const tree = new BonsaiTree(seed, species);
  let pruneBranchId = -1;

  for (let i = 0; i < totalDays; i++) {
    // Apply care BEFORE the tick (mirrors CareLogReplay.reconstruct order)
    if (tree.getMoisture() < 40) tree.water(30);
    if (i === 75 && pruneBranchId === -1) {
      const bs = tree.getBranches();
      const target = bs.find(b => !b.pruned && b.depth > 0);
      if (target) {
        tree.prune(target.id);
        pruneBranchId = target.id;
      }
    }
    GrowthEngine.growTick(tree);
  }

  assert(pruneBranchId !== -1, `a branch was pruned at day 75 (id=${pruneBranchId})`);

  const careLog = tree.getCareLog();
  const hasPruneEntry = careLog.some(e => e.action.type === 'prune');
  assert(hasPruneEntry, 'care log contains prune entry');
  console.log(`    care log length: ${careLog.length} entries`);

  const { voxels: voxOrig } = Voxelizer.voxelize(tree);

  // Reconstruct from seed + species + care log
  const rebuilt = CareLogReplay.reconstruct(seed, species, careLog, totalDays);
  const { voxels: voxRebuilt } = Voxelizer.voxelize(rebuilt);

  assert(
    voxOrig.count() === voxRebuilt.count(),
    `voxel count identical (${voxOrig.count()})`,
    `orig=${voxOrig.count()} rebuilt=${voxRebuilt.count()}`
  );

  const origSerial = JSON.stringify(voxOrig.serialize());
  const rebuiltSerial = JSON.stringify(voxRebuilt.serialize());
  assert(origSerial === rebuiltSerial, 'serialize() output identical');
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
