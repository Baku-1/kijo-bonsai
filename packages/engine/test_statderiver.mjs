/**
 * Gate suite for StatDeriver — D1 through D7.
 * Run from repo root: node packages/engine/test_statderiver.mjs
 * Exit 0 = all gates pass.  Exit 1 = any gate failed.
 */

import { BonsaiTree }    from './dist/BonsaiTree.js';
import { GrowthEngine }  from './dist/GrowthEngine.js';
import { CareLogReplay } from './dist/CareLogReplay.js';
import { PruneEngine }   from './dist/PruneEngine.js';
import { StatDeriver }   from './dist/StatDeriver.js';
import { Voxelizer }     from '../voxelizer/dist/index.js';

// ---------------------------------------------------------------------------
// Test harness
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Grow a Day-200 hardwood (seed 464497) with standard watering. */
function grow200() {
  const tree = new BonsaiTree(464497, 'hardwood');
  for (let d = 0; d < 200; d++) {
    if (tree.getMoisture() < 25) tree.water(30);
    GrowthEngine.growTick(tree);
  }
  return tree;
}

/**
 * Grow a Day-200 hardwood (seed 464497) while pruning all depth-2+ children
 * of branch `pruneBranchId` each tick.  This keeps the target branch as a
 * tip so it extends freely, biasing the tree toward that branch's role.
 *   pruneBranchId=2 (ARM) → arm-heavy → more ARM voxels → more Power
 *   pruneBranchId=1 (LEG) → leg-heavy → more LEG voxels → more Endurance
 */
function grow200Biased(pruneBranchId) {
  const tree = new BonsaiTree(464497, 'hardwood');
  for (let d = 0; d < 200; d++) {
    if (tree.getMoisture() < 25) tree.water(30);
    GrowthEngine.growTick(tree);
    const branches = tree.getBranches();
    const target = branches[pruneBranchId];
    if (target && !target.pruned) {
      for (const cid of [...target.children]) {
        const c = branches[cid];
        if (c && !c.pruned) PruneEngine.prune(tree, cid);
      }
    }
  }
  return tree;
}

function statEqual(a, b) {
  return (
    a.hp          === b.hp          &&
    a.power       === b.power       &&
    a.endurance   === b.endurance   &&
    a.ki          === b.ki          &&
    a.skillSlots  === b.skillSlots  &&
    a.skillPoints === b.skillPoints &&
    a.wisdom      === b.wisdom      &&
    a.matchPct    === b.matchPct
  );
}

// ---------------------------------------------------------------------------
// D1 — structural: all five structural stats > 0
// ---------------------------------------------------------------------------

console.log('\nD1 — structural stats > 0 (Day-200 hardwood seed 464497)');
{
  const tree           = grow200();
  const { voxels }     = Voxelizer.voxelize(tree);
  const s              = StatDeriver.deriveStructural(voxels, tree);

  console.log(`  hp=${s.hp}  power=${s.power}  endurance=${s.endurance}  ki=${s.ki}  skillSlots=${s.skillSlots}`);

  assert(s.hp        > 0, 'hp > 0',         `got ${s.hp}`);
  assert(s.power     > 0, 'power > 0',      `got ${s.power}`);
  assert(s.endurance > 0, 'endurance > 0',  `got ${s.endurance}`);
  assert(s.ki        > 0, 'ki > 0',         `got ${s.ki}`);
  assert(s.skillSlots > 0, 'skillSlots > 0', `got ${s.skillSlots}`);
}

// ---------------------------------------------------------------------------
// D2 — terrain stacks: derive() > structural-only for ≥1 stat
// ---------------------------------------------------------------------------

console.log('\nD2 — terrain stacks additively on structural');
{
  const tree             = grow200();
  const { voxels, zones } = Voxelizer.voxelize(tree);
  const seed             = tree.getSeed();

  const structural = StatDeriver.deriveStructural(voxels, tree);
  const combined   = StatDeriver.derive(tree, voxels, seed, tree.getAge(), zones);

  const deltaHp        = combined.hp        - structural.hp;
  const deltaPower     = combined.power     - structural.power;
  const deltaEndurance = combined.endurance - structural.endurance;
  const deltaKi        = combined.ki        - structural.ki;

  console.log(`  delta hp=${deltaHp}  power=${deltaPower}  endurance=${deltaEndurance}  ki=${deltaKi}`);

  const atLeastOnePositive = deltaHp > 0 || deltaPower > 0 || deltaEndurance > 0 || deltaKi > 0;
  assert(atLeastOnePositive, 'terrain bonus > 0 for ≥1 stat');
  assert(combined.hp >= structural.hp, 'combined.hp >= structural.hp');
}

// ---------------------------------------------------------------------------
// D3 — wisdom tiers
// ---------------------------------------------------------------------------

console.log('\nD3 — wisdomFromAge tier thresholds');
{
  const cases = [
    [50,  0],
    [100, 1],
    [200, 2],
    [365, 3],
    [500, 4],
  ];
  for (const [days, expected] of cases) {
    const got = StatDeriver.wisdomFromAge(days);
    console.log(`  wisdomFromAge(${days}) = ${got} (expected ${expected})`);
    assert(got === expected, `wisdomFromAge(${days}) → ${expected}`, `got ${got}`);
  }
}

// ---------------------------------------------------------------------------
// D4 — determinism: same tree + seed → identical StatSheet ×2
// ---------------------------------------------------------------------------

console.log('\nD4 — determinism: same inputs → identical StatSheet');
{
  const tree              = grow200();
  const { voxels, zones } = Voxelizer.voxelize(tree);
  const seed              = tree.getSeed();
  const ageDays           = tree.getAge();

  const sheet1 = StatDeriver.derive(tree, voxels, seed, ageDays, zones);
  const sheet2 = StatDeriver.derive(tree, voxels, seed, ageDays, zones);

  console.log('  run1:', JSON.stringify(sheet1));
  console.log('  run2:', JSON.stringify(sheet2));

  assert(statEqual(sheet1, sheet2), 'sheet1 === sheet2 (field-by-field)');
}

// ---------------------------------------------------------------------------
// D5 — end-to-end determinism: direct tree vs CareLogReplay roundtrip
// ---------------------------------------------------------------------------

console.log('\nD5 — end-to-end: direct grow vs CareLogReplay → identical StatSheet');
{
  // Build the tree directly (source of truth)
  const treeA                       = grow200();
  const { voxels: voxelsA, zones: zonesA } = Voxelizer.voxelize(treeA);
  const seed                        = treeA.getSeed();
  const ageDays                     = treeA.getAge();
  const sheetA                      = StatDeriver.derive(treeA, voxelsA, seed, ageDays, zonesA);

  // Replay from the extracted care log
  const careLog                     = treeA.getCareLog();
  const treeB                       = CareLogReplay.reconstruct(seed, 'hardwood', careLog, 200);
  const { voxels: voxelsB, zones: zonesB } = Voxelizer.voxelize(treeB);
  const sheetB                      = StatDeriver.derive(treeB, voxelsB, seed, treeB.getAge(), zonesB);

  console.log('  direct:  ', JSON.stringify(sheetA));
  console.log('  replayed:', JSON.stringify(sheetB));

  assert(statEqual(sheetA, sheetB), 'direct === replayed (byte-identical StatSheet)');
}

// ---------------------------------------------------------------------------
// D6 — sanity + fixture export
// ---------------------------------------------------------------------------

console.log('\nD6 — sanity + fixture export');
{
  const tree              = grow200();
  const { voxels, zones } = Voxelizer.voxelize(tree);
  const seed              = tree.getSeed();
  const ageDays           = tree.getAge();

  const sheet = StatDeriver.derive(tree, voxels, seed, ageDays, zones);

  console.log('\n  StatSheet (combat client fixture):');
  console.log(JSON.stringify(sheet, null, 2));

  // Eight required keys
  const requiredKeys = ['hp','power','endurance','ki','skillSlots','skillPoints','wisdom','matchPct'];
  for (const k of requiredKeys) {
    assert(k in sheet, `key '${k}' present`);
  }

  // Core stats > 0
  assert(sheet.hp         > 0,  'hp > 0',         `got ${sheet.hp}`);
  assert(sheet.power      > 0,  'power > 0',      `got ${sheet.power}`);
  assert(sheet.endurance  > 0,  'endurance > 0',  `got ${sheet.endurance}`);
  assert(sheet.ki         > 0,  'ki > 0',         `got ${sheet.ki}`);
  assert(sheet.skillSlots > 0,  'skillSlots > 0', `got ${sheet.skillSlots}`);
  assert(sheet.wisdom     > 0,  'wisdom > 0',     `got ${sheet.wisdom}`);
  assert(sheet.matchPct   >= 0, 'matchPct >= 0',  `got ${sheet.matchPct}`);

  // HP target range
  assert(sheet.hp >= 800 && sheet.hp <= 2500, `HP in [800,2500]`, `got ${sheet.hp}`);

  // matchPct in [0,1]
  assert(sheet.matchPct >= 0 && sheet.matchPct <= 1, 'matchPct in [0,1]', `got ${sheet.matchPct}`);
}

// ---------------------------------------------------------------------------
// D7 — morphology fidelity: arm-heavy → Power, leg-heavy → Endurance
//
// Branch id=1 is LEG (lower attachment), id=2 is ARM (upper attachment).
// ARM-heavy: prune id=2's depth-2+ children each tick → ARM tip grows free.
// LEG-heavy: prune id=1's depth-2+ children each tick → LEG tip grows free.
// Confirms GDD §4.2 role-to-stat mapping produces correct combat biases.
// ---------------------------------------------------------------------------

console.log('\nD7 — morphology fidelity: pruning bias → correct Power/Endurance split');
{
  const treeArm                            = grow200Biased(2);  // ARM branch tip extends freely
  const { voxels: voxArm, zones: zonesArm } = Voxelizer.voxelize(treeArm);
  const sheetArm = StatDeriver.derive(treeArm, voxArm, treeArm.getSeed(), treeArm.getAge(), zonesArm);

  const treeLeg                            = grow200Biased(1);  // LEG branch tip extends freely
  const { voxels: voxLeg, zones: zonesLeg } = Voxelizer.voxelize(treeLeg);
  const sheetLeg = StatDeriver.derive(treeLeg, voxLeg, treeLeg.getSeed(), treeLeg.getAge(), zonesLeg);

  console.log('  ARM-heavy:', JSON.stringify(sheetArm));
  console.log('  LEG-heavy:', JSON.stringify(sheetLeg));

  assert(
    sheetArm.power > sheetArm.endurance,
    'arm-heavy: Power > Endurance (within tree)',
    `power=${sheetArm.power} endurance=${sheetArm.endurance}`,
  );
  assert(
    sheetLeg.endurance > sheetLeg.power,
    'leg-heavy: Endurance > Power (within tree)',
    `endurance=${sheetLeg.endurance} power=${sheetLeg.power}`,
  );
  assert(
    sheetArm.power > sheetLeg.power,
    'arm-heavy produces more Power than leg-heavy',
    `armPower=${sheetArm.power} legPower=${sheetLeg.power}`,
  );
  assert(
    sheetLeg.endurance > sheetArm.endurance,
    'leg-heavy produces more Endurance than arm-heavy',
    `legEndurance=${sheetLeg.endurance} armEndurance=${sheetArm.endurance}`,
  );
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${'─'.repeat(50)}`);
console.log(`D1–D7 result: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
