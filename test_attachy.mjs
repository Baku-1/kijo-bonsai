/**
 * Gate suite for R-ATTACHY -- A1 through A7.
 * Run from repo root: node test_attachy.mjs
 * Exit 0 = all gates pass.  Exit 1 = any gate failed.
 *
 * Verifies:
 *   A1 -- bare lower third
 *   A2 -- first branch placement (30-40% of trunk)
 *   A3 -- varied attachment heights across depth-1 branches
 *   A4 -- ARM branches have higher attachmentY than LEG branches
 *   A5 -- multi-branch morphology (closes D7 coverage gap, 4+ depth-1 branches)
 *   A6 -- determinism: same seed -> identical attachmentY values
 *   A7 -- reconstruction fidelity: CareLogReplay = identical attachmentY to original
 */

import { BonsaiTree }               from './packages/engine/dist/BonsaiTree.js';
import { GrowthEngine }             from './packages/engine/dist/GrowthEngine.js';
import { CareLogReplay }            from './packages/engine/dist/CareLogReplay.js';
import { PruneEngine }              from './packages/engine/dist/PruneEngine.js';
import { StatDeriver }              from './packages/engine/dist/StatDeriver.js';
import { StatTerrain }              from './packages/engine/dist/StatTerrain.js';
import { createTree, applyAction, tick } from './packages/engine/dist/tree.js';
import { Voxelizer }                from './packages/voxelizer/dist/index.js';
import { round4 }                   from './packages/shared/dist/index.js';

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(cond, name, detail) {
  if (cond) {
    console.log('  PASS ' + name);
    passed++;
  } else {
    console.error('  FAIL ' + name + (detail ? ': ' + detail : ''));
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function grow200(seed, species) {
  seed    = seed    ?? 464497;
  species = species ?? 'hardwood';
  const tree = new BonsaiTree(seed, species);
  for (let d = 0; d < 200; d++) {
    if (tree.getMoisture() < 25) tree.water(30);
    GrowthEngine.growTick(tree);
  }
  return tree;
}

function depth1Live(tree) {
  return tree.getBranches().filter(b => b.depth === 1 && !b.pruned);
}

// ---------------------------------------------------------------------------
// A1 -- bare lower third
// No depth-1 branch may have attachmentY < trunk.length * 0.30 at Day 200.
// ---------------------------------------------------------------------------

console.log('\nA1 -- bare lower third (no depth-1 branch below 30% of trunk height)');
{
  const tree   = grow200();
  const trunk  = tree.getRoot();
  const d1     = depth1Live(tree);
  const thresh = trunk.length * 0.30;

  console.log('  trunk.length = ' + trunk.length.toFixed(4));
  console.log('  30% threshold = ' + thresh.toFixed(4));
  console.log('  depth-1 attachmentY values:');
  d1.forEach(b => console.log('    id=' + b.id + ' attachmentY=' + b.attachmentY + ' (' + (b.attachmentY / trunk.length * 100).toFixed(1) + '% of trunk)'));

  const violators = d1.filter(b => b.attachmentY < thresh);
  assert(
    violators.length === 0,
    'zero depth-1 branches with attachmentY < trunk.length * 0.30',
    'violators: ' + violators.map(b => 'id=' + b.id + ' aY=' + b.attachmentY).join(', ')
  );
}

// ---------------------------------------------------------------------------
// A2 -- first branch placement (30-40% of trunk height)
// ---------------------------------------------------------------------------

console.log('\nA2 -- first branch placement (lowest attachmentY in 30-40% of trunk)');
{
  const tree  = grow200();
  const trunk = tree.getRoot();
  const d1    = depth1Live(tree);

  const lowestAY = Math.min(...d1.map(b => b.attachmentY));
  const pct      = lowestAY / trunk.length * 100;

  console.log('  lowest attachmentY = ' + lowestAY + ' (' + pct.toFixed(2) + '% of trunk.length=' + trunk.length.toFixed(4) + ')');

  assert(
    pct >= 30 && pct <= 40,
    'lowest attachmentY is 30-40% of trunk height',
    'got ' + pct.toFixed(2) + '%'
  );
}

// ---------------------------------------------------------------------------
// A3 -- varied attachment heights (at least 2 different values)
// ---------------------------------------------------------------------------

console.log('\nA3 -- varied attachment heights (>=2 depth-1 branches with distinct values)');
{
  const tree  = grow200();
  const d1    = depth1Live(tree);
  const aYs   = d1.map(b => b.attachmentY);
  const uniq  = [...new Set(aYs)];

  console.log('  all depth-1 attachmentY values: ' + aYs.join(', '));
  console.log('  unique values: ' + uniq.join(', '));

  assert(
    d1.length >= 2,
    'at least 2 depth-1 branches exist',
    'got ' + d1.length
  );
  assert(
    uniq.length >= 2,
    'at least 2 distinct attachmentY values',
    'got ' + uniq.length + ' unique: ' + uniq.join(', ')
  );
}

// ---------------------------------------------------------------------------
// A4 -- ARM branches have higher attachmentY than LEG branches
// ---------------------------------------------------------------------------

console.log('\nA4 -- ARM branches have higher attachmentY than LEG branches');
{
  const tree  = grow200();
  const d1    = depth1Live(tree);

  // Sort by attachmentY ascending (same logic as voxelizer).
  const sorted = [...d1].sort((a, b) => a.attachmentY - b.attachmentY);
  const n      = sorted.length;
  const nArms  = Math.floor(n / 2);

  const legBranches = n === 1 ? []                                : sorted.slice(0, n - nArms);
  const armBranches = n === 1 ? sorted                           : sorted.slice(n - nArms);

  console.log('  depth-1 count=' + n + ', nArms=' + nArms);
  console.log('  ARM branches: ' + armBranches.map(b => 'id=' + b.id + ' aY=' + b.attachmentY).join(', '));
  console.log('  LEG branches: ' + legBranches.map(b => 'id=' + b.id + ' aY=' + b.attachmentY).join(', '));

  if (n >= 2 && legBranches.length > 0) {
    const maxLegAY = Math.max(...legBranches.map(b => b.attachmentY));
    const minArmAY = Math.min(...armBranches.map(b => b.attachmentY));
    console.log('  maxLEG_aY=' + maxLegAY + ' minARM_aY=' + minArmAY);
    assert(
      minArmAY >= maxLegAY,
      'ARM branches have >= attachmentY vs LEG branches',
      'minArmAY=' + minArmAY + ' maxLegAY=' + maxLegAY
    );
  } else {
    assert(true, 'A4 skip -- fewer than 2 depth-1 branches (tree has n=' + n + ')');
  }

  // Verify via voxelizer: ARM-role voxels have higher branchIds corresponding to higher-aY branches
  // zones not needed here — this site only checks VoxelRole assignments.
  const { voxels } = Voxelizer.voxelize(tree);
  let armAYSum = 0, armCount = 0, legAYSum = 0, legCount = 0;
  const armIdSet = new Set(armBranches.map(b => b.id));
  const legIdSet = new Set(legBranches.map(b => b.id));

  voxels.forEach((x, y, z, mat, role, branchId) => {
    if (role === 'arm' && armIdSet.has(branchId)) {
      armAYSum += tree.getBranches()[branchId]?.attachmentY ?? 0;
      armCount++;
    } else if (role === 'leg' && legIdSet.has(branchId)) {
      legAYSum += tree.getBranches()[branchId]?.attachmentY ?? 0;
      legCount++;
    }
  });

  const avgArmAY = armCount > 0 ? armAYSum / armCount : 0;
  const avgLegAY = legCount > 0 ? legAYSum / legCount : 0;
  console.log('  avg attachmentY -- ARM voxels: ' + avgArmAY.toFixed(4) + ', LEG voxels: ' + avgLegAY.toFixed(4));
  assert(
    armCount > 0 && legCount > 0 && avgArmAY > avgLegAY,
    'ARM voxels carry higher avg attachmentY than LEG voxels',
    'armAvg=' + avgArmAY.toFixed(4) + ' legAvg=' + avgLegAY.toFixed(4)
  );
}

// ---------------------------------------------------------------------------
// A5 -- multi-branch morphology (closes D7 coverage gap)
// Construct a tree with 4+ depth-1 branches by growing to Day 200 (yields 2)
// then injecting 2 more with different attachmentY values via internal API.
// Prune to arm-heavy / leg-heavy using the TRUE ARM id set (upper-aY half).
// ---------------------------------------------------------------------------

console.log('\nA5 -- multi-branch morphology (4+ depth-1 branches)');
{
  // Grow base tree to Day 200 -- yields 2 depth-1 branches (id=1 aY=9.387, id=2 aY=28.4454).
  const base    = grow200();
  const trunk   = base.getRoot();
  const tLen    = trunk.length;

  // Inject 2 more depth-1 branches at 50% and 80% of trunk.
  // This "constructs" the multi-branch morphology -- see scope s3.A5.
  const idC = base._allocBranchId();
  base._pushBranch({
    id: idC, parent: 0, depth: 1,
    angle: 30, length: 8, thickness: 1.5,
    pruned: false, children: [],
    attachmentY: round4(tLen * 0.50),
  });
  trunk.children.push(idC);

  const idD = base._allocBranchId();
  base._pushBranch({
    id: idD, parent: 0, depth: 1,
    angle: -40, length: 6, thickness: 1.2,
    pruned: false, children: [],
    attachmentY: round4(tLen * 0.80),
  });
  trunk.children.push(idD);

  const d1    = depth1Live(base);
  const n     = d1.length;
  console.log('  depth-1 count (constructed) = ' + n);
  assert(n >= 4, 'tree has 4+ depth-1 branches', 'got ' + n);

  // Determine TRUE ARM id set: upper half by attachmentY.
  const sorted = [...d1].sort((a, b) => a.attachmentY - b.attachmentY);
  const nArms  = Math.floor(n / 2);
  const armSet = new Set(sorted.slice(n - nArms).map(b => b.id));
  const legSet = new Set(sorted.slice(0, n - nArms).map(b => b.id));

  console.log('  sorted depth-1 by attachmentY:');
  sorted.forEach(b => console.log('    id=' + b.id + ' aY=' + b.attachmentY + ' role=' + (armSet.has(b.id) ? 'ARM' : 'LEG')));

  // Arm-heavy: clone care log from base and replay, then prune LEG branches.
  // Since base is already grown, we voxelize two derived states:
  //   armHeavy = voxelize base with LEG branches pruned
  //   legHeavy = voxelize base with ARM branches pruned
  // Use CareLogReplay to get a fresh tree, inject branches, then prune.
  function makeVariant(pruneIds) {
    // Rebuild from care log
    const careLog = base.getCareLog();
    const t = CareLogReplay.reconstruct(464497, 'hardwood', careLog, 200);
    const tr = t.getRoot();
    const trLen = tr.length;
    // Re-inject the extra depth-1 branches
    const c1 = t._allocBranchId();
    t._pushBranch({ id: c1, parent: 0, depth: 1, angle: 30, length: 8, thickness: 1.5, pruned: false, children: [], attachmentY: round4(trLen * 0.50) });
    tr.children.push(c1);
    const c2 = t._allocBranchId();
    t._pushBranch({ id: c2, parent: 0, depth: 1, angle: -40, length: 6, thickness: 1.2, pruned: false, children: [], attachmentY: round4(trLen * 0.80) });
    tr.children.push(c2);
    // Prune the target ids (use raw branch mutation since IDs may differ after replay)
    // Map by attachmentY to find correct ids in replayed tree
    const repD1 = depth1Live(t);
    const repSorted = [...repD1].sort((a, b) => a.attachmentY - b.attachmentY);
    const repNArms = Math.floor(repD1.length / 2);
    // pruneIds is 'arm' or 'leg'
    const toPrune = pruneIds === 'leg'
      ? repSorted.slice(0, repD1.length - repNArms)   // LEG = lower half
      : repSorted.slice(repD1.length - repNArms);      // ARM = upper half
    for (const b of toPrune) {
      PruneEngine.prune(t, b.id);
    }
    return t;
  }

  const tArm = makeVariant('leg'); // prune LEG -> arm-heavy
  const tLeg = makeVariant('arm'); // prune ARM -> leg-heavy

  const { voxels: vArm, zones: zonesArm } = Voxelizer.voxelize(tArm);
  const { voxels: vLeg, zones: zonesLeg } = Voxelizer.voxelize(tLeg);
  const sArm = StatDeriver.derive(tArm, vArm, tArm.getSeed(), tArm.getAge(), zonesArm);
  const sLeg = StatDeriver.derive(tLeg, vLeg, tLeg.getSeed(), tLeg.getAge(), zonesLeg);

  console.log('\n  ARM-heavy stat sheet: ' + JSON.stringify(sArm));
  console.log('  LEG-heavy stat sheet: ' + JSON.stringify(sLeg));

  assert(sArm.power     > sArm.endurance,   'arm-heavy: Power > Endurance',          'power=' + sArm.power     + ' endurance=' + sArm.endurance);
  assert(sLeg.endurance > sLeg.power,       'leg-heavy: Endurance > Power',          'endurance=' + sLeg.endurance + ' power=' + sLeg.power);
  assert(sArm.power     > sLeg.power,       'arm-heavy Power > leg-heavy Power',     sArm.power + ' vs ' + sLeg.power);
  assert(sLeg.endurance > sArm.endurance,   'leg-heavy Endurance > arm-heavy Endurance', sLeg.endurance + ' vs ' + sArm.endurance);
}

// ---------------------------------------------------------------------------
// A6 -- determinism: same seed -> identical attachmentY across two runs
// ---------------------------------------------------------------------------

console.log('\nA6 -- determinism (same seed -> identical attachmentY)');
{
  const t1 = grow200();
  const t2 = grow200();

  const d1_1 = depth1Live(t1).sort((a, b) => a.id - b.id);
  const d1_2 = depth1Live(t2).sort((a, b) => a.id - b.id);

  console.log('  run1 depth-1 attachmentY: ' + d1_1.map(b => 'id=' + b.id + ':' + b.attachmentY).join(', '));
  console.log('  run2 depth-1 attachmentY: ' + d1_2.map(b => 'id=' + b.id + ':' + b.attachmentY).join(', '));

  const match = d1_1.length === d1_2.length &&
    d1_1.every((b, i) => b.id === d1_2[i].id && b.attachmentY === d1_2[i].attachmentY);

  assert(match, 'same seed -> identical depth-1 attachmentY values', match ? 'OK' : 'mismatch');
}

// ---------------------------------------------------------------------------
// A7 -- reconstruction fidelity: CareLogReplay tree = original attachmentY
// ---------------------------------------------------------------------------

console.log('\nA7 -- reconstruction fidelity (CareLogReplay has identical attachmentY)');
{
  const original = grow200();
  const careLog  = original.getCareLog();
  const replayed = CareLogReplay.reconstruct(464497, 'hardwood', careLog, 200);

  const origD1 = depth1Live(original).sort((a, b) => a.id - b.id);
  const repD1  = depth1Live(replayed).sort((a, b) => a.id - b.id);

  console.log('  original depth-1 attachmentY: ' + origD1.map(b => 'id=' + b.id + ':' + b.attachmentY).join(', '));
  console.log('  replayed depth-1 attachmentY: ' + repD1.map(b => 'id=' + b.id + ':' + b.attachmentY).join(', '));

  const match = origD1.length === repD1.length &&
    origD1.every((b, i) => b.id === repD1[i].id && b.attachmentY === repD1[i].attachmentY);

  assert(match, 'CareLogReplay tree has identical attachmentY to original', match ? 'OK' : 'mismatch');

  // Also verify all branches (not just depth-1) match attachmentY
  const origAll = original.getBranches().filter(b => !b.pruned).sort((a, b) => a.id - b.id);
  const repAll  = replayed.getBranches().filter(b => !b.pruned).sort((a, b) => a.id - b.id);
  const allMatch = origAll.length === repAll.length &&
    origAll.every((b, i) => b.id === repAll[i].id && b.attachmentY === repAll[i].attachmentY);
  assert(allMatch, 'all branches have identical attachmentY after CareLogReplay', allMatch ? 'OK' : 'mismatch');
}

// ---------------------------------------------------------------------------
// A8 -- tick() first depth-1 branch obeys one-third rule
// Grow via tick() (functional path) until first depth-1 branch appears.
// Assert: lowest depth-1 attachmentY in [30%, 40%] of trunk at that moment.
// Assert: no depth-1 branch below 30% of trunk (mirrors A1 for tick() path).
// ---------------------------------------------------------------------------

console.log('\nA8 -- tick() first depth-1 branch obeys one-third rule');
{
  let s = createTree(464497, 'hardwood');
  let found = false;
  for (let d = 0; d < 500; d++) {
    if (s.moisture < 25) s = applyAction(s, { type: 'water' });
    s = tick(s);
    const d1 = s.branches.filter(b => b.depth === 1 && !b.pruned);
    if (d1.length >= 1) {
      const trunk     = s.branches[0];
      const lowestAY  = Math.min(...d1.map(b => b.attachmentY));
      const pct       = lowestAY / trunk.length * 100;
      const violators = d1.filter(b => b.attachmentY < trunk.length * 0.30);

      console.log('  First depth-1 appeared at day ' + s.day);
      console.log('  trunk.length = ' + trunk.length.toFixed(4));
      console.log('  lowest depth-1 attachmentY = ' + lowestAY + ' (' + pct.toFixed(2) + '%)');

      assert(
        pct >= 30 && pct <= 40,
        'tick() first depth-1 attachmentY in [30%, 40%] of trunk',
        'got ' + pct.toFixed(2) + '%'
      );
      assert(
        violators.length === 0,
        'tick() no depth-1 branch below 30% of trunk',
        'violators: ' + violators.map(b => 'id=' + b.id + ' aY=' + b.attachmentY).join(', ')
      );
      found = true;
      break;
    }
  }
  if (!found) assert(false, 'tick() first depth-1 branch appeared within 500 days', 'none found');
}

// ---------------------------------------------------------------------------
// A9 -- tick() subsequent depth-1 branches use trunk tip
// Grow via tick() until >= 2 depth-1 branches exist.
// Assert: second (higher-aY) branch strictly greater than first (lower-aY).
// Assert: second.attachmentY within 2 voxels of trunk.length at check time
//         (both forked same tick => second.aY == trunk.length at that tick).
// ---------------------------------------------------------------------------

console.log('\nA9 -- tick() subsequent depth-1 branches use trunk tip');
{
  let s = createTree(464497, 'hardwood');
  let found = false;
  for (let d = 0; d < 500; d++) {
    if (s.moisture < 25) s = applyAction(s, { type: 'water' });
    s = tick(s);
    const d1 = s.branches.filter(b => b.depth === 1 && !b.pruned);
    if (d1.length >= 2) {
      const trunk  = s.branches[0];
      const sorted = [...d1].sort((a, b) => a.attachmentY - b.attachmentY);
      const first  = sorted[0];
      const second = sorted[sorted.length - 1];

      console.log('  >=2 depth-1 branches at day ' + s.day);
      console.log('  trunk.length = ' + trunk.length.toFixed(4));
      console.log('  first  id=' + first.id  + ' aY=' + first.attachmentY);
      console.log('  second id=' + second.id + ' aY=' + second.attachmentY);

      assert(
        second.attachmentY > first.attachmentY,
        'tick() second depth-1 branch.attachmentY strictly > first',
        'second=' + second.attachmentY + ' first=' + first.attachmentY
      );
      // second used round4(trunk.length) at fork time; trunk only grows after,
      // so second.aY <= current trunk.length.  When both fork same tick, equality holds.
      assert(
        second.attachmentY >= trunk.length - 2,
        'tick() second depth-1 attachmentY within 2 voxels of trunk.length',
        'second.aY=' + second.attachmentY + ' trunk=' + trunk.length.toFixed(4)
      );
      found = true;
      break;
    }
  }
  if (!found) assert(false, 'tick() second depth-1 branch appeared within 500 days', 'none found');
}

// ---------------------------------------------------------------------------
// A10 -- zone-path integration test (MAJOR-4 requirement, 2026-07-31)
//
// Verifies:
//   - voxelize() populates zones map (not empty)
//   - trunk branchId=0 is in zones
//   - all zone indices are valid [0, 7]
//   - zones are deterministic (two calls → identical map)
//   - skill_point zone lookup is exercised and deriveTerrain uses zone path
// ---------------------------------------------------------------------------

console.log('\nA10 -- zone-path integration test (seed 464497, hardwood, day 200)');
{
  const tree = grow200();   // seed 464497, hardwood, day 200 (R14 calibration tree)
  const { voxels, zones } = Voxelizer.voxelize(tree);
  const seed = tree.getSeed();

  console.log('  zones map size=' + zones.size);
  console.log('  zone values: ' + [...zones.values()].join(', '));

  // zones map must be populated
  assert(zones.size > 0, 'A10 zones map is populated (size > 0)', 'size=' + zones.size);

  // trunk branchId=0 must be in the map (OQ-1 resolved: always true)
  assert(zones.has(0), 'A10 zones map contains trunk (branchId=0)');

  // all zone indices must be valid [0, 7]
  const allValid = [...zones.values()].every(idx => idx >= 0 && idx <= 7);
  assert(allValid, 'A10 all zone indices in [0, 7]');

  // determinism: voxelize same tree twice → identical zone map
  const { zones: zones2 } = Voxelizer.voxelize(tree);
  const sortedEntries = m => JSON.stringify([...m.entries()].sort((a, b) => a[0] - b[0]));
  assert(
    sortedEntries(zones) === sortedEntries(zones2),
    'A10 zone map is deterministic (two voxelize calls produce identical zones)',
  );

  // skill_point zone: find the index for 'skill_point' in STAT_TYPES
  // StatTerrain.STAT_TYPES = ['hp','power','endurance','ki','skill_point','defense','stability','neutral']
  const skillPointIdx = [...StatTerrain.STAT_TYPES].findIndex(t => t === 'skill_point');
  const skillPointBranchIds = [...zones.entries()]
    .filter(([, idx]) => idx === skillPointIdx)
    .map(([id]) => id);

  console.log('  skill_point zone index=' + skillPointIdx + ', skill_point branch ids: ' + (skillPointBranchIds.length ? skillPointBranchIds.join(', ') : '(none)'));

  assert(
    skillPointBranchIds.length > 0,
    'A10 at least one branch zone maps to skill_point',
    'found ' + skillPointBranchIds.length + ' skill_point branches (zone idx ' + skillPointIdx + ')',
  );

  // If skill_point branches exist, deriveTerrain via zone path must produce skillPoints > 0
  if (skillPointBranchIds.length > 0) {
    const terrain = StatDeriver.deriveTerrain(voxels, seed, zones);
    console.log('  terrain.skillPoints (zone path) = ' + terrain.skillPoints);
    assert(
      terrain.skillPoints > 0,
      'A10 zone-path deriveTerrain.skillPoints > 0',
      'got ' + terrain.skillPoints,
    );
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\n' + '-'.repeat(50));
console.log('A1-A10 result: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
