/**
 * Gate tests for JinEngine Phase 2.
 * Run after: npm run build --workspace=packages/engine --workspace=packages/voxelizer
 * Command: node packages/engine/test_jin.mjs (from repo root)
 *
 * Specification: ARCH-JINENGINE-PHASE2-2026-09-18.md
 * Test gate: JIN-1 through JIN-11. All must pass.
 */
import { BonsaiTree } from './dist/BonsaiTree.js';
import { GrowthEngine } from './dist/GrowthEngine.js';
import { CareLogReplay } from './dist/CareLogReplay.js';
import { Voxelizer } from '../voxelizer/dist/index.js';
import { VoxelRole } from '../voxelizer/dist/index.js';

let passed = 0, failed = 0;

function assert(cond, name, detail = '') {
  if (cond) {
    console.log(`  OK ${name}`);
    passed++;
  } else {
    console.error(`  FAIL ${name}${detail ? ': ' + detail : ''}`);
    failed++;
  }
}

/** Grow a fresh tree for N days, watering when moisture < 40. */
function growTree(seed, species, days) {
  const tree = new BonsaiTree(seed, species);
  for (let d = 0; d < days; d++) {
    if (tree.getMoisture() < 40) tree.water(30);
    GrowthEngine.growTick(tree);
  }
  return tree;
}

/** Find first branch matching predicate. */
function findBranch(tree, pred) {
  return tree.getBranches().find(pred);
}

// ---------------------------------------------------------------------------
// JIN-1: Basic jin success
// ---------------------------------------------------------------------------
console.log('\nJIN-1 -- Basic jin success');
{
  const tree = growTree(464497, 'hardwood', 50);
  const b = findBranch(tree, b => !b.pruned && b.depth === 1 && b.length > 3);
  assert(b !== undefined, 'found a depth-1 branch with length > 3');
  if (b) {
    const segIdx = 2;
    tree.clearDirty(); // reset dirty to verify markDirty
    const result = tree.applyJin(b.id, segIdx, 1);
    assert(result.ok === true, 'result.ok === true');
    assert(tree.getBranches()[b.id].jinned === true, 'branch.jinned === true');
    assert(tree.getBranches()[b.id].jinSegmentStart === segIdx, 'branch.jinSegmentStart === 2');
    // Care log check
    const log = tree.getCareLog();
    const jinEntry = log.find(e => e.action.type === 'jin' && e.action.branchId === b.id);
    assert(jinEntry !== undefined, 'care log contains jin entry');
    if (jinEntry && jinEntry.action.type === 'jin') {
      assert(jinEntry.action.segmentIndex === segIdx, 'care log segmentIndex === 2');
      assert(jinEntry.action.jinCost === 1, 'care log jinCost === 1');
    }
    assert(tree.isDirty() === true, 'tree.isDirty() === true after applyJin');
  }
}

// ---------------------------------------------------------------------------
// JIN-2: Child cascade
// ---------------------------------------------------------------------------
console.log('\nJIN-2 -- Child cascade');
{
  const tree = growTree(464497, 'hardwood', 100);
  const branches = tree.getBranches();
  // Find a depth-1 branch with depth-2 children
  const parent = branches.find(b =>
    !b.pruned && b.depth === 1 &&
    b.children.some(id => branches[id] && !branches[id].pruned && branches[id].depth === 2)
  );
  assert(parent !== undefined, 'found a depth-1 branch with depth-2 children');
  if (parent) {
    const result = tree.applyJin(parent.id, 0, 1);
    assert(result.ok === true, 'jin at segmentIndex=0 succeeds');
    assert(branches[parent.id].jinned === true, 'parent.jinned === true');
    assert(branches[parent.id].jinSegmentStart === 0, 'parent.jinSegmentStart === 0');
    // Check all children
    let allChildrenJinned = true;
    const stack = [...parent.children];
    let descendantCount = 0;
    while (stack.length > 0) {
      const cid = stack.pop();
      const child = branches[cid];
      if (!child || child.pruned) continue;
      descendantCount++;
      if (!child.jinned || child.jinSegmentStart !== 0) {
        allChildrenJinned = false;
      }
      stack.push(...child.children);
    }
    assert(descendantCount > 0, 'has at least one non-pruned descendant');
    assert(allChildrenJinned, 'ALL descendants have jinned=true, jinSegmentStart=0');
  }
}

// ---------------------------------------------------------------------------
// JIN-3: Already-jin rejection
// ---------------------------------------------------------------------------
console.log('\nJIN-3 -- Already-jin rejection');
{
  const tree = growTree(464497, 'hardwood', 50);
  const b = findBranch(tree, b => !b.pruned && b.depth === 1 && b.length > 4);
  assert(b !== undefined, 'found branch for already-jin test');
  if (b) {
    const r1 = tree.applyJin(b.id, 2, 1);
    assert(r1.ok === true, 'first jin at segmentIndex=2 ok');
    const r2 = tree.applyJin(b.id, 3, 1);
    assert(r2.ok === false, 'second jin at segmentIndex=3 rejected');
    assert(r2.reason === 'already-jin', 'reason is already-jin');
  }
}

// ---------------------------------------------------------------------------
// JIN-4: Jin extension (lower segmentIndex)
// ---------------------------------------------------------------------------
console.log('\nJIN-4 -- Jin extension (lower segmentIndex)');
{
  const tree = growTree(464497, 'hardwood', 50);
  const b = findBranch(tree, b => !b.pruned && b.depth === 1 && b.length > 5);
  assert(b !== undefined, 'found branch for extension test');
  if (b) {
    const r1 = tree.applyJin(b.id, 4, 1);
    assert(r1.ok === true, 'first jin at segmentIndex=4 ok');
    const r2 = tree.applyJin(b.id, 1, 1);
    assert(r2.ok === true, 'second jin at segmentIndex=1 (lower) ok');
    assert(tree.getBranches()[b.id].jinSegmentStart === 1, 'jinSegmentStart updated to 1');
  }
}

// ---------------------------------------------------------------------------
// JIN-5: Validation rejections (unchanged from Phase 1)
// ---------------------------------------------------------------------------
console.log('\nJIN-5 -- Validation rejections');
{
  const tree = growTree(464497, 'hardwood', 50);
  const branches = tree.getBranches();

  // Invalid branchId
  const r1 = tree.applyJin(9999, 0, 1);
  assert(r1.ok === false && r1.reason === 'not-found', 'invalid branchId -> not-found');

  // Pruned branch
  const leaf = branches.find(b =>
    !b.pruned && b.depth > 0 &&
    b.children.filter(id => !branches[id].pruned).length === 0
  );
  if (leaf) {
    tree.prune(leaf.id);
    const r2 = tree.applyJin(leaf.id, 0, 1);
    assert(r2.ok === false && r2.reason === 'pruned', 'pruned branch -> pruned');
  }

  // segmentIndex >= branch.length
  const living = findBranch(tree, b => !b.pruned && b.depth === 1);
  if (living) {
    const r3 = tree.applyJin(living.id, Math.ceil(living.length) + 10, 1);
    assert(r3.ok === false && r3.reason === 'segment-out-of-range', 'segmentIndex too high -> segment-out-of-range');
  }

  // segmentIndex < 0 -- caught by BonsaiTree.applyJin (throws CareLogReplayError)
  let threw = false;
  try { tree.applyJin(0, -1, 1); } catch (e) { threw = true; }
  assert(threw, 'negative segmentIndex throws CareLogReplayError');
}

// ---------------------------------------------------------------------------
// JIN-6: Growth engine skip
// ---------------------------------------------------------------------------
console.log('\nJIN-6 -- Growth engine skip');
{
  const tree = growTree(464497, 'hardwood', 50);
  const b = findBranch(tree, b => !b.pruned && b.depth === 1 && b.length > 2);
  assert(b !== undefined, 'found branch for growth skip test');
  if (b) {
    const preLen = b.length;
    const preThick = b.thickness;
    const preChildCount = b.children.length;
    tree.applyJin(b.id, 0, 1);
    // Run 10 more growth ticks
    for (let i = 0; i < 10; i++) {
      if (tree.getMoisture() < 40) tree.water(30);
      GrowthEngine.growTick(tree);
    }
    const after = tree.getBranches()[b.id];
    assert(after.length === preLen, 'jinned branch length unchanged after 10 ticks');
    assert(after.thickness === preThick, 'jinned branch thickness unchanged after 10 ticks');
    assert(after.children.length === preChildCount, 'jinned branch has no new children');
  }
}

// ---------------------------------------------------------------------------
// JIN-7: Physics skip
// ---------------------------------------------------------------------------
console.log('\nJIN-7 -- Physics skip');
{
  const tree = growTree(464497, 'hardwood', 50);
  const b = findBranch(tree, b => !b.pruned && b.depth === 1 && b.length > 2);
  assert(b !== undefined, 'found branch for physics skip test');
  if (b) {
    // Apply twine first to create stress
    const twineResult = tree.applyTwine(b.id, 10);
    // Record stress state
    const preStress = tree.getBranches()[b.id].currentStress;
    const preWireScarred = tree.getBranches()[b.id].wireScarred;

    // Now jin it
    tree.applyJin(b.id, 0, 1);

    // Run 10 daily updates
    for (let i = 0; i < 10; i++) {
      if (tree.getMoisture() < 40) tree.water(30);
      GrowthEngine.growTick(tree);
    }

    const after = tree.getBranches()[b.id];
    // currentStress should NOT have changed (physics loop skips jinned branches)
    assert(after.currentStress === preStress, 'currentStress unchanged after jin (physics skipped)');
    // wireScarred should also remain unchanged
    assert(after.wireScarred === preWireScarred, 'wireScarred unchanged after jin');
  }
}

// ---------------------------------------------------------------------------
// JIN-8: Voxelizer SCAR emission
// ---------------------------------------------------------------------------
console.log('\nJIN-8 -- Voxelizer SCAR emission');
{
  const tree = growTree(464497, 'hardwood', 50);
  const b = findBranch(tree, b => !b.pruned && b.depth === 1 && b.length > 3);
  assert(b !== undefined, 'found branch for voxelizer test');
  if (b) {
    const segIdx = 2;
    tree.applyJin(b.id, segIdx, 1);
    const result = Voxelizer.voxelize(tree);
    const voxels = result.voxels;

    // Count SCAR voxels for the jinned branch
    let scarCount = 0;
    let nonScarCount = 0;
    voxels.forEach((x, y, z, mat, role, bid) => {
      if (bid === b.id) {
        if (role === VoxelRole.SCAR) scarCount++;
        else nonScarCount++;
      }
    });

    assert(scarCount > 0, 'jinned branch has SCAR voxels (count: ' + scarCount + ')');
    // With segIdx=2 and length > 3, there should be some non-SCAR voxels below the jin point
    assert(nonScarCount > 0, 'voxels below jin point retain original role (count: ' + nonScarCount + ')');

    // Check no CANOPY for jinned branch
    let canopyCount = 0;
    voxels.forEach((x, y, z, mat, role, bid) => {
      if (bid === b.id && role === VoxelRole.CANOPY) canopyCount++;
    });
    assert(canopyCount === 0, 'jinned branch has no CANOPY voxels');
  }
}

// ---------------------------------------------------------------------------
// JIN-9: Replay determinism
// ---------------------------------------------------------------------------
console.log('\nJIN-9 -- Replay determinism');
{
  const SEED = 464497;
  const SPECIES = 'hardwood';
  const DAYS = 60;

  // Build a tree with water + prune + jin actions
  const orig = new BonsaiTree(SEED, SPECIES);
  for (let d = 0; d < DAYS; d++) {
    if (orig.getMoisture() < 40) orig.water(30);
    GrowthEngine.growTick(orig);
    // On day 40: prune a leaf
    if (d === 39) {
      const leaf = orig.getBranches().find(b =>
        !b.pruned && b.depth > 0 &&
        b.children.filter(id => !orig.getBranches()[id].pruned).length === 0
      );
      if (leaf) orig.prune(leaf.id);
    }
    // On day 50: jin a branch
    if (d === 49) {
      const target = orig.getBranches().find(b =>
        !b.pruned && b.depth === 1 && b.length > 2 && !b.jinned
      );
      if (target) orig.applyJin(target.id, 1, 1);
    }
  }

  const careLog = orig.getCareLog();

  // Reconstruct twice
  const r1 = CareLogReplay.reconstruct(SEED, SPECIES, careLog, DAYS);
  const r2 = CareLogReplay.reconstruct(SEED, SPECIES, careLog, DAYS);

  // Voxelize both
  const v1 = Voxelizer.voxelize(r1);
  const v2 = Voxelizer.voxelize(r2);

  const s1 = JSON.stringify(v1.voxels.serialize());
  const s2 = JSON.stringify(v2.voxels.serialize());

  assert(s1 === s2, 'replay determinism: two reconstructions are byte-identical');
  assert(v1.voxels.count() > 0, 'voxelized tree has voxels (count: ' + v1.voxels.count() + ')');
}

// ---------------------------------------------------------------------------
// JIN-10: Full cascade from trunk
// ---------------------------------------------------------------------------
console.log('\nJIN-10 -- Full cascade from trunk');
{
  const tree = growTree(464497, 'hardwood', 100);
  const branchesBefore = tree.getBranches();
  const livingBefore = branchesBefore.filter(b => !b.pruned && b.parent !== null).length;
  assert(livingBefore > 0, 'tree has living branches before trunk jin');

  // Jin trunk at segmentIndex=0 (kill entire tree)
  const r = tree.applyJin(0, 0, 1);
  assert(r.ok === true, 'trunk jin succeeds');

  const branchesAfter = tree.getBranches();
  let allJinned = true;
  for (const b of branchesAfter) {
    if (b.pruned) continue;
    if (!b.jinned) { allJinned = false; break; }
  }
  assert(allJinned, 'ALL non-pruned branches are jinned after trunk jin');

  // No growth on subsequent ticks
  const trunkLenBefore = branchesAfter[0].length;
  for (let i = 0; i < 5; i++) {
    if (tree.getMoisture() < 40) tree.water(30);
    GrowthEngine.growTick(tree);
  }
  assert(tree.getBranches()[0].length === trunkLenBefore, 'trunk does not grow after jin');
}

// ---------------------------------------------------------------------------
// JIN-11: Floor recovery after jin
// ---------------------------------------------------------------------------
console.log('\nJIN-11 -- Floor recovery after jin');
{
  // Use a tree with fewer branches to get near the floor
  const tree = growTree(464497, 'hardwood', 50);
  const branches = tree.getBranches();

  // Find the lowest-ID eligible non-pruned non-trunk branch
  const lowestLiving = branches.find(b => !b.pruned && b.depth > 0);
  assert(lowestLiving !== undefined, 'found lowest-ID living branch');

  if (lowestLiving) {
    // Jin it
    tree.applyJin(lowestLiving.id, 0, 1);

    // selectFloorTipId should never return the jinned branch
    const livingCount = tree.countLivingBranches();
    const rate = GrowthEngine.calculateGrowthRate(tree);
    const floorTipId = GrowthEngine.selectFloorTipId(tree, rate, livingCount);

    assert(floorTipId !== lowestLiving.id,
      'selectFloorTipId does not return jinned branch (returned ' + floorTipId + ', jinned was ' + lowestLiving.id + ')');

    // Grow 20 more ticks -- tree should still be able to fork
    const branchCountBefore = tree.getBranches().filter(b => !b.pruned && !b.jinned).length;
    for (let i = 0; i < 20; i++) {
      if (tree.getMoisture() < 40) tree.water(30);
      GrowthEngine.growTick(tree);
    }
    const branchCountAfter = tree.getBranches().filter(b => !b.pruned && !b.jinned).length;
    // Floor recovery must not lose branches -- jinned branch count is stable,
    // and the floor mechanism should not regress living count.
    assert(branchCountAfter >= branchCountBefore,
      'floor recovery did not lose branches (after=' + branchCountAfter + ' >= before=' + branchCountBefore + ')');
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n=== JIN GATE: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
