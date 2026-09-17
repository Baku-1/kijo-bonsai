import { BonsaiTree } from './dist/BonsaiTree.js';
import { GrowthEngine } from './dist/GrowthEngine.js';

let passed = 0, failed = 0;
function assert(cond, name, detail = '') {
  if (cond) { console.log(`  ✓ ${name}`); passed++; }
  else { console.error(`  ✗ ${name}${detail ? ': ' + detail : ''}`); failed++; }
}

function run200(seed) {
  const tree = new BonsaiTree(seed, 'hardwood');
  for (let d = 0; d < 200; d++) {
    if (tree.getMoisture() < 25) tree.water(30);
    GrowthEngine.growTick(tree);
    // G2 check every tick
    const expected = tree.countLivingBranches() + tree.getPrunedCount() + 1;
    if (tree.getNextBranchId() !== expected) {
      console.error(`  G2 FAIL at day ${d+1}: nextId=${tree.getNextBranchId()} expected=${expected}`);
      failed++;
      return null;
    }
  }
  return tree;
}

// G1 — Trunk matures
console.log('G1 — Trunk matures');
{
  const tree = new BonsaiTree(464497, 'hardwood');
  const day1Thickness = tree.getRoot().thickness;
  for (let d = 0; d < 200; d++) { tree.water(10); GrowthEngine.growTick(tree); }
  const day200Thickness = tree.getRoot().thickness;
  console.log(`  trunk thickness: Day 1=${day1Thickness}, Day 200=${day200Thickness}`);
  assert(day200Thickness > day1Thickness, 'trunk thickness grows over 200 days');
}

// G2 — ID integrity (checked inline during run200)
console.log('G2 — ID integrity');
{
  const tree = run200(464497);
  if (tree) { console.log('  ✓ ID integrity held for all 200 days'); passed++; }
}

// G3 — Leonardo holds
console.log('G3 — Leonardo holds');
{
  const tree = new BonsaiTree(464497, 'hardwood');
  for (let d = 0; d < 200; d++) { if (tree.getMoisture() < 25) tree.water(30); GrowthEngine.growTick(tree); }
  const branches = tree.getBranches();
  let violations = 0;
  for (const b of branches) {
    if (b.pruned || b.children.length === 0) continue;
    const childSumSq = b.children.filter(id => !branches[id].pruned).reduce((s, id) => s + branches[id].thickness ** 2, 0);
    if (b.thickness ** 2 < 0.9 * childSumSq) {
      console.log(`  Leonardo violation: branch ${b.id} depth=${b.depth} thickness=${b.thickness} childSumSq=${childSumSq.toFixed(4)}`);
      violations++;
    }
  }
  assert(violations === 0, `Leonardo rule holds (0 violations)`, `${violations} violations`);
}

// G4 — DETERMINISM
console.log('G4 — DETERMINISM');
{
  const t1 = new BonsaiTree(464497, 'hardwood');
  const t2 = new BonsaiTree(464497, 'hardwood');
  for (let d = 0; d < 200; d++) {
    if (t1.getMoisture() < 25) t1.water(30);
    if (t2.getMoisture() < 25) t2.water(30);
    GrowthEngine.growTick(t1);
    GrowthEngine.growTick(t2);
  }
  const m1 = t1.getTotalMass(), m2 = t2.getTotalMass();
  console.log(`  Run 1 totalMass=${m1}, Run 2 totalMass=${m2}`);
  assert(m1 === m2, 'identical totalMass after 200 days on same seed');
}

// G5 — Depth bound
console.log('G5 — Depth bound');
{
  const tree = new BonsaiTree(464497, 'hardwood');
  for (let d = 0; d < 200; d++) { if (tree.getMoisture() < 25) tree.water(30); GrowthEngine.growTick(tree); }
  const maxDepth = Math.max(...tree.getBranches().map(b => b.depth));
  console.log(`  max depth: ${maxDepth}`);
  assert(maxDepth <= 6, 'no branch exceeds depth 6', `max depth = ${maxDepth}`);
}

// G6 — No explosion
console.log('G6 — No explosion');
{
  const tree = new BonsaiTree(464497, 'hardwood');
  const progEvery = 20;
  console.log('  day | moisture | health | branches | trunkThick | totalMass');
  for (let d = 0; d < 200; d++) {
    if (tree.getMoisture() < 25) tree.water(30);
    GrowthEngine.growTick(tree);
    if ((d + 1) % progEvery === 0) {
      console.log(`  ${d+1} | ${tree.getMoisture().toFixed(1)} | ${tree.getHealth().toFixed(1)} | ${tree.countLivingBranches()} | ${tree.getRoot().thickness.toFixed(4)} | ${tree.getTotalMass().toFixed(2)}`);
    }
  }
  const count = tree.countLivingBranches();
  console.log(`  final branch count: ${count}`);
  assert(count >= 5 && count <= 200, 'branch count in sane range [5, 200]', `got ${count}`);
}

// ---------------------------------------------------------------------------
// G7 - v2 structural band: 15-30 living branches (trunk excluded) at day 180 under
//      REGIME_HEALTHY, for all three species (design 3.4 / step I4 / R1).
// REGIME_HEALTHY and the seeds below use the SAME definition as scripts/band-check.mjs
// (the calibration instrument): water daily to moisture 60, fertilize every 7 days, no
// pruning, 180 days. The floor/ceiling controller (design 3.2c / step I5) is not part of
// this build, so this count is the structural fix (3.2a trunk re-fork + 3.2b internodes)
// alone -- if a species is under 15 the frontier is too thin, not the floor missing.
// ---------------------------------------------------------------------------
const BAND_MIN = 15;
const BAND_MAX = 30;
const REGIME_HEALTHY = { waterTarget: 60, fertilizeEvery: 7, days: 180 };
const BAND_SEEDS = {
  hardwood:  464497,           // engine canonical calibration seed
  evergreen: 20260909,
  tropical:  7472909771253292, // audited kijonsai 140ec05f (GOAL-GROWTH-ENGINE.md:18)
};

function runHealthy(seed, species, days = REGIME_HEALTHY.days) {
  const tree = new BonsaiTree(seed, species);
  for (let d = 0; d < days; d++) {
    const deficit = REGIME_HEALTHY.waterTarget - tree.getMoisture();
    if (deficit > 0) tree.water(deficit); // water() rejects amount <= 0
    if (d % REGIME_HEALTHY.fertilizeEvery === 0) tree.fertilize();
    GrowthEngine.growTick(tree);
  }
  return tree;
}

console.log('G7 - v2 structural band (REGIME_HEALTHY, 180 days)');
{
  for (const species of ['hardwood', 'evergreen', 'tropical']) {
    const tree = runHealthy(BAND_SEEDS[species], species);
    const count = tree.countLivingBranches(); // excludes trunk
    const mains = tree.getBranches().filter(b => !b.pruned && b.depth === 1).length;
    const inBand = count >= BAND_MIN && count <= BAND_MAX;
    console.log(`  ${species}: day=${tree.getAge()} living=${count} depth1Mains=${mains} trunkLen=${tree.getRoot().length.toFixed(2)} health=${tree.getHealth().toFixed(1)} moisture=${tree.getMoisture().toFixed(1)} inBand=${inBand}`);
    assert(count >= BAND_MIN && count <= BAND_MAX, `${species}: day-180 living branch count inside the 15-30 band`, `got ${count}`);
    // Regression guard for the design 3.1 root cause: the trunk used to fork exactly once in
    // a tree's entire lifetime, which is why the audited kijonsai was a bare spine.
    assert(mains > 1, `${species}: trunk produced more than one depth-1 main over 180 days`, `got ${mains}`);
    // A6 / R-4 invariant: branches are born at exactly length 1.0, so accumulated extension
    // is round4(b.length - 1.0) and no Branch field is needed to store it.
    const tooShort = tree.getBranches().filter(b => !b.pruned && b.length < 1.0).length;
    assert(tooShort === 0, `${species}: newborn-length invariant (no living branch below 1.0)`, `${tooShort} violations`);
  }
}

// ---------------------------------------------------------------------------
// G8 - determinism under the named regime (two identical runs, identical trees)
// ---------------------------------------------------------------------------
console.log('G8 - determinism under REGIME_HEALTHY');
{
  const a = runHealthy(BAND_SEEDS.hardwood, 'hardwood');
  const b = runHealthy(BAND_SEEDS.hardwood, 'hardwood');
  assert(
    JSON.stringify(a.getBranches()) === JSON.stringify(b.getBranches()),
    'two REGIME_HEALTHY runs produce identical branch arrays'
  );
  assert(a.getTotalMass() === b.getTotalMass(), 'two REGIME_HEALTHY runs agree on totalMass');
  assert(a.countLivingBranches() === b.countLivingBranches(), 'two REGIME_HEALTHY runs agree on living branch count');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
