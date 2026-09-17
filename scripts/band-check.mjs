// band-check.mjs -- v2 growth engine check: the R1 band plus the I5-I8 structural gates.
//
// ONE script, six printed checks, all of them on a real replay (no rendering, no browser):
//
//   BAND             day-180 living-branch count (trunk excluded) inside 15-30 for all three
//                    species under REGIME_HEALTHY (requirement R1, design I4).
//   DETERMINISM      the same seed + species + regime twice, compared bit-for-bit (R5), plus
//                    the newborn-length invariant the internode gate depends on.
//   CAP-BOUND        living count never exceeds branchCap + 1 across 365 days, all species
//                    (design 3.2c ceiling; the +1 is the boundary fork's two-child roll).
//   FLOOR-REACH      the count reaches branchFloor by floorDay + 30 with a live frontier
//                    (design 3.2c floor, floorDay from the 3.4 table, step I5).
//   ROTATION-EFFECT  same seed/species/day/replay at rotation 0 vs rotation 90 produces
//                    non-equal branch lengths, and each configuration replays identically twice
//                    (design 3.2d, requirement R3 rotation clause, step I6).
//   TAPER            at day 180 for all three species: trunk thickness strictly decreasing base
//                    to apex along the spine, and living depth-1 thickness non-increasing with
//                    attachmentY (design 3.2e, KIJO-TECH-SPEC s4.6, step I7).
//
// It also PRINTS the I7 stat regression (STAT-DELTA): the day-180 structural combat numbers this
// build produces beside the pre-change numbers recorded by the I3/I4 pass, including skillSlots
// (non-pruned depth-2+ branch COUNT -- KIJO-ENGINE-API.md:79, StatDeriver.ts:111-112). The delta
// is EXPECTED to be non-zero: going from a one-mains spine to a 15-30 branch tree moves every
// voxel-role stat, and the design's Q3 makes accepting or re-normalising that an owner decision.
// The numbers are printed rather than hidden so that decision can be made on evidence.
//
// Run from kijo-bonsai/ AFTER A BUILD (this imports compiled dist/, not the sources):
//   npm run build
//   node scripts/band-check.mjs
// The voxel-level stat regression (D1-D7) is a different pass:
//   node packages/engine/test_statderiver.mjs
//
// Exit code: 0 when every gate above passes, 1 when any gate fails.
import { BonsaiTree, GrowthEngine } from '../packages/engine/dist/index.js';
import { SPECIES_PARAMS } from '../packages/shared/dist/index.js';

const BAND_MIN = 15;
const BAND_MAX = 30;
const SPECIES_LIST = ['hardwood', 'evergreen', 'tropical'];

// REGIME_HEALTHY -- the NAMED care regime R1 requires (design 3.8):
// water daily (top the moisture back up to 60), fertilize weekly, no pruning, rotation 0.
// Engine detail that is part of the regime as actually realised: BonsaiTree.fertilize()
// no-ops while its 8-day cooldown is running, so a 7-day call schedule yields 5 boosted
// days out of every 8. It is printed below so the evidence shows the regime, not just the
// resulting number (GOAL-GROWTH-ENGINE.md:114-116).
const REGIME_HEALTHY = {
  name: 'REGIME_HEALTHY',
  waterTarget: 60,       // water up to this moisture, every day
  fertilizeEveryDays: 7, // call fertilize() every 7 days (8-day engine cooldown => 5/8 uptime)
  prune: false,
  days: 180,
};

// Fixed seeds. hardwood 464497 is the engine's canonical calibration seed (test_growth.mjs);
// tropical 7472909771253292 is the seed of the audited kijonsai (GOAL-GROWTH-ENGINE.md:18-20),
// so the check covers the tree whose 4-branch result started this workstream.
// test_growth.mjs G7 uses these same three seeds.
const SEEDS = {
  hardwood:  464497,
  evergreen: 20260909,
  tropical:  7472909771253292,
};

// PRE-CHANGE baseline for STAT-DELTA: the day-180 numbers recorded by the I3/I4 pass (the
// structural fix alone -- trunk re-fork 3.2a + internode gate 3.2b, before the I5 floor/ceiling
// controller, the I6 rotation bias and the I7 taper pass landed). These are CARRIED OVER, not
// re-measured: the pre-change code no longer exists in this build, so it cannot be re-run here.
// skillSlots is derived from them with the same definition StatDeriver uses
// (non-pruned depth-2+ branch COUNT == livingBranches - depth1Mains).
const PRE_CHANGE = {
  hardwood:  { day: 180, livingBranches: 28, depth1Mains: 5, trunkLen: 90.3 },
  evergreen: { day: 180, livingBranches: 22, depth1Mains: 5, trunkLen: 55.3 },
  tropical:  { day: 180, livingBranches: 15, depth1Mains: 4, trunkLen: 121.7 },
};

/**
 * Replay REGIME_HEALTHY and collect the trace the controller gates need.
 * rotationQuarterTurns > 0 rotates the tree BEFORE the first growTick, i.e. one rotate()
 * action per quarter turn, so the run replays at a different sun quarter for its whole length.
 */
function runHealthy(seed, species, days = REGIME_HEALTHY.days, rotationQuarterTurns = 0) {
  const tree = new BonsaiTree(seed, species);
  for (let q = 0; q < rotationQuarterTurns; q++) tree.rotate();

  const floor = SPECIES_PARAMS[species].branchFloor;
  const trace = {
    counts: [],
    floorActiveDays: 0,
    floorActiveAtEnd: false,
    firstFloorDay: -1,
    isAlive: true,
  };

  for (let d = 0; d < days; d++) {
    const deficit = REGIME_HEALTHY.waterTarget - tree.getMoisture();
    if (deficit > 0) tree.water(deficit);                   // water() rejects amount <= 0
    if (d % REGIME_HEALTHY.fertilizeEveryDays === 0) tree.fertilize();

    // Floor state exactly as the engine sees it at the START of this day (design 3.2c).
    const rate0 = GrowthEngine.calculateGrowthRate(tree);
    if (rate0 <= 0) trace.isAlive = false;
    const floorNow = GrowthEngine.isFloorActive(tree, rate0, tree.countLivingBranches());
    if (floorNow) trace.floorActiveDays++;
    trace.floorActiveAtEnd = floorNow;

    GrowthEngine.growTick(tree);                            // no pruning in this regime

    const count = tree.countLivingBranches();
    trace.counts.push(count);
    if (trace.firstFloorDay === -1 && count >= floor) trace.firstFloorDay = d + 1;
  }
  return { tree, trace };
}

/** Bit-for-bit signature of the grown tree (branch records + total mass). */
function treeSignature(tree) {
  return JSON.stringify(tree.getBranches()) + '|' + tree.getTotalMass();
}

function lengthSignature(tree) {
  return tree.getBranches().map((b) => b.length);
}

function countLengthDifferences(a, b) {
  const shared = Math.min(a.length, b.length);
  let diff = Math.abs(a.length - b.length);
  for (let i = 0; i < shared; i++) if (a[i] !== b[i]) diff++;
  return diff;
}

function fmtThicknessList(nodes) {
  return nodes.map((n) => 'id' + n.id + '/' + n.depth + ':' + n.thickness).join(' > ');
}

const gates = [];
function recordGate(name, pass, detail) {
  gates.push({ name, pass, detail });
}

console.log('='.repeat(96));
console.log('Kijonsai growth engine v2 -- band check + I5/I6/I7/I8 structural gates');
console.log('='.repeat(96));
console.log(`regime: ${REGIME_HEALTHY.name} -- water daily to moisture ${REGIME_HEALTHY.waterTarget}, ` +
            `fertilize every ${REGIME_HEALTHY.fertilizeEveryDays} days, no pruning, ` +
            `${REGIME_HEALTHY.days} days`);
console.log(`band:   ${BAND_MIN}-${BAND_MAX} living branches, EXCLUDING the trunk ` +
            '(BonsaiTree.countLivingBranches())');
console.log('controller: design 3.2c floor/ceiling is IMPLEMENTED (step I5). Values live in');
console.log('            @kijo/shared SPECIES_PARAMS: ' +
            SPECIES_LIST.map((s) => `${s} floor=${SPECIES_PARAMS[s].branchFloor} ` +
              `cap=${SPECIES_PARAMS[s].branchCap} floorDay=${SPECIES_PARAMS[s].floorDay}`).join(' | '));
console.log('');

// ---------------------------------------------------------------------------------------
// 1. BAND (R1 / design I4)
// ---------------------------------------------------------------------------------------
console.log('species   | seed                  | day | living | depth1Mains | trunkLen | moisture | health | in 15-30?');
console.log('----------|-----------------------|-----|--------|-------------|----------|----------|--------|----------');

const bandTrees = {};
let allInBand = true;
for (const species of SPECIES_LIST) {
  const seed = SEEDS[species];
  const { tree, trace } = runHealthy(seed, species);
  bandTrees[species] = { tree, trace };
  const count = tree.countLivingBranches();
  const mains = tree.getBranches().filter((b) => !b.pruned && b.depth === 1).length;
  const trunk = tree.getRoot();
  const inBand = count >= BAND_MIN && count <= BAND_MAX;
  if (!inBand) allInBand = false;

  console.log(
    species.padEnd(9) + ' | ' +
    String(seed).padEnd(21) + ' | ' +
    String(tree.getAge()).padStart(3) + ' | ' +
    String(count).padStart(6) + ' | ' +
    String(mains).padStart(11) + ' | ' +
    trunk.length.toFixed(2).padStart(8) + ' | ' +
    tree.getMoisture().toFixed(1).padStart(8) + ' | ' +
    tree.getHealth().toFixed(1).padStart(6) + ' | ' +
    (inBand ? 'YES' : 'NO  <-- out of band')
  );

  const sp = SPECIES_PARAMS[species];
  console.log('          | grammar: internodeBase=' + sp.internodeBase +
              ' internodeDepthStep=' + sp.internodeDepthStep +
              ' trunkInternode=' + sp.trunkInternode +
              ' forkChance=' + sp.forkChance +
              ' childThicknessFactor=' + sp.childThicknessFactor);

  const depth1 = tree.getBranches().filter((b) => !b.pruned && b.depth === 1);
  console.log('          | depth-1 attachmentY (voxels up the trunk): [' +
              depth1.map((b) => b.attachmentY.toFixed(2)).join(', ') + ']' +
              '  mainCount=' + mains + ' (design 3.1 regression guard: must be > 1)');
  // Design :593 asks I4's printed output to show the band is carried by the growth model and
  // not by the guarantee: at least one species must reach day 180 with the floor INACTIVE.
  console.log('          | floor active on the last day? ' + (trace.floorActiveAtEnd ? 'YES' : 'NO') +
              ' (floor-active days in ' + REGIME_HEALTHY.days + ': ' + trace.floorActiveDays + ')');
  console.log('');
}
recordGate('BAND', allInBand,
  `${BAND_MIN}-${BAND_MAX} living branches (trunk excluded) at day ${REGIME_HEALTHY.days} for all three species`);

// ---------------------------------------------------------------------------------------
// 2. DETERMINISM (R5) + newborn-length invariant (A6/R-4)
// ---------------------------------------------------------------------------------------
const d1 = runHealthy(SEEDS.hardwood, 'hardwood').tree;
const d2 = runHealthy(SEEDS.hardwood, 'hardwood').tree;
const deterministic = treeSignature(d1) === treeSignature(d2);
console.log('determinism (hardwood seed ' + SEEDS.hardwood + ' run twice, identical branch arrays + mass): ' +
            (deterministic ? 'YES' : 'NO'));

// A6 / R-4 invariant: every branch is born at exactly 1.0 and only ever extends, which is what
// lets the internode gate derive accumulated extension as round4(b.length - 1.0).
const tooShort = d1.getBranches().filter((b) => !b.pruned && b.length < 1.0);
const newbornOk = tooShort.length === 0;
console.log('newborn-length invariant (no living branch below length 1.0): ' +
            (newbornOk ? 'YES' : 'NO (' + tooShort.length + ' violations)'));
recordGate('DETERMINISM', deterministic && newbornOk,
  'two identical hardwood replays bit-identical, no living branch below length 1.0');
console.log('');

// ---------------------------------------------------------------------------------------
// 3. CAP-BOUND (design 3.2c ceiling, step I5): 365 days, living count <= branchCap + 1
// ---------------------------------------------------------------------------------------
console.log('='.repeat(96));
console.log('CAP-BOUND (design 3.2c ceiling / step I5): 365 days, living count <= branchCap + 1');
console.log('species   | cap | bound (cap+1) | day180 | max over 365 days | floor-active days | result');
console.log('----------|-----|---------------|--------|-------------------|-------------------|-------');
let capBoundPass = true;
for (const species of SPECIES_LIST) {
  const cap = SPECIES_PARAMS[species].branchCap;
  const { tree, trace } = runHealthy(SEEDS[species], species, 365);
  const observedMax = Math.max(...trace.counts);
  const pass = observedMax <= cap + 1;
  if (!pass) capBoundPass = false;
  console.log(
    species.padEnd(9) + ' | ' +
    String(cap).padStart(3) + ' | ' +
    String(cap + 1).padStart(13) + ' | ' +
    String(tree.countLivingBranches()).padStart(6) + ' | ' +
    String(observedMax).padStart(17) + ' | ' +
    String(trace.floorActiveDays).padStart(17) + ' | ' +
    (pass ? 'PASS' : 'FAIL  <-- cap exceeded')
  );
}
recordGate('CAP-BOUND', capBoundPass, 'living count <= branchCap + 1 on every one of 365 days, all species');
console.log('');

// ---------------------------------------------------------------------------------------
// 4. FLOOR-REACH (design 3.2c floor + 3.4 floorDay, step I5)
// ---------------------------------------------------------------------------------------
console.log('='.repeat(96));
console.log('FLOOR-REACH (design 3.2c floor / step I5): count reaches branchFloor by floorDay + 30');
console.log('          (live frontier: REGIME_HEALTHY keeps rate > 0, which is the 3.2c conditioning)');
console.log('species   | floor | floorDay | deadline | first day at floor | result');
console.log('----------|-------|----------|----------|--------------------|-------');
let floorReachPass = true;
for (const species of SPECIES_LIST) {
  const floor = SPECIES_PARAMS[species].branchFloor;
  const floorDay = SPECIES_PARAMS[species].floorDay;
  const deadline = floorDay + 30;
  const { trace } = runHealthy(SEEDS[species], species, 365);
  const first = trace.firstFloorDay;
  const pass = trace.isAlive && first !== -1 && first <= deadline;
  if (!pass) floorReachPass = false;
  console.log(
    species.padEnd(9) + ' | ' +
    String(floor).padStart(5) + ' | ' +
    String(floorDay).padStart(8) + ' | ' +
    String(deadline).padStart(8) + ' | ' +
    String(first === -1 ? 'never' : first).padStart(18) + ' | ' +
    (pass ? 'PASS' : 'FAIL  <-- floor not reached in time')
  );
}
recordGate('FLOOR-REACH', floorReachPass,
  'living count reaches branchFloor by floorDay + 30 for every species, with rate > 0 (alive)');
console.log('');

// ---------------------------------------------------------------------------------------
// 5. ROTATION-EFFECT (design 3.2d, R3 rotation clause, step I6)
// ---------------------------------------------------------------------------------------
console.log('='.repeat(96));
console.log('ROTATION-EFFECT (design 3.2d / step I6): rotation 0 vs 90 changes branch lengths,');
console.log('                 and both configurations replay identically twice');
console.log('species   | rot0 repeatable | rot90 repeatable | lengths differ | differing branches | result');
console.log('----------|-----------------|------------------|----------------|--------------------|-------');
let rotationPass = true;
for (const species of SPECIES_LIST) {
  const seed = SEEDS[species];
  const r0a = runHealthy(seed, species, REGIME_HEALTHY.days, 0).tree;
  const r0b = runHealthy(seed, species, REGIME_HEALTHY.days, 0).tree;
  const r90a = runHealthy(seed, species, REGIME_HEALTHY.days, 1).tree;
  const r90b = runHealthy(seed, species, REGIME_HEALTHY.days, 1).tree;

  const repeatable0 = treeSignature(r0a) === treeSignature(r0b);
  const repeatable90 = treeSignature(r90a) === treeSignature(r90b);
  const len0 = lengthSignature(r0a);
  const len90 = lengthSignature(r90a);
  const differing = countLengthDifferences(len0, len90);
  const differs = differing > 0;
  const pass = repeatable0 && repeatable90 && differs;
  if (!pass) rotationPass = false;

  console.log(
    species.padEnd(9) + ' | ' +
    (repeatable0 ? 'YES' : 'NO ').padStart(15) + ' | ' +
    (repeatable90 ? 'YES' : 'NO ').padStart(16) + ' | ' +
    (differs ? 'YES' : 'NO ').padStart(14) + ' | ' +
    String(differing + ' of ' + Math.max(len0.length, len90.length)).padStart(18) + ' | ' +
    (pass ? 'PASS' : 'FAIL  <-- rotation has no observable effect (or is not repeatable)')
  );
}
recordGate('ROTATION-EFFECT', rotationPass,
  'rotation 0 vs 90 yields non-equal branch lengths, each configuration bit-identical on a repeat');
console.log('');
console.log('note: the bias multiplies the FORK PROBABILITY term only (R-6). Extension, and therefore');
console.log('      the G1-G6 extension invariants, are untouched -- test_growth.mjs covers those.');
console.log('');

// ---------------------------------------------------------------------------------------
// 6. TAPER (design 3.2e, KIJO-TECH-SPEC s4.6, step I7)
// ---------------------------------------------------------------------------------------
console.log('='.repeat(96));
console.log('TAPER (design 3.2e / step I7): trunk thickness strictly decreasing base -> apex, and');
console.log('living depth-1 thickness non-increasing with attachmentY (day 180, all three species)');
console.log('species   | spine (trunk -> apex) thicknesses            | mains (ascending attachmentY)');
console.log('----------|-----------------------------------------------|-------------------------------');
let taperPass = true;
for (const species of SPECIES_LIST) {
  const tree = bandTrees[species].tree;
  const report = GrowthEngine.taperReport(tree);
  if (!report.ok) taperPass = false;

  console.log(species.padEnd(9) + ' | ' + fmtThicknessList(report.spine).padEnd(45) + ' | ' +
              report.mains.map((m) => 'id' + m.id + '@' + m.attachmentY + ':' + m.thickness).join(', '));
  if (!report.ok) for (const v of report.violations) console.log('          | VIOLATION: ' + v);
  console.log('          | depth-1 attachmentY ascending? ' +
              (report.mains.every((m, i) => i === 0 || m.attachmentY >= report.mains[i - 1].attachmentY)
                ? 'YES' : 'NO') +
              '  mains=' + report.mains.length);
}
recordGate('TAPER', taperPass,
  'strictly decreasing trunk-to-apex spine thickness and non-increasing depth-1 thickness by attachmentY');
console.log('');

// ---------------------------------------------------------------------------------------
// 7. STAT-DELTA (design 3.2e stat regression, step I7) -- printed, not gated
// ---------------------------------------------------------------------------------------
console.log('='.repeat(96));
console.log('STAT-DELTA (step I7): day-180 structural combat numbers, this build vs the pre-change');
console.log('recorded I3/I4 numbers. skillSlots = non-pruned depth-2+ branch COUNT (KIJO-ENGINE-API.md:79).');
console.log('The pre-change column was NOT re-measured here (that code is gone) -- it is the recorded run.');
console.log('species   | build: living mains depth2+ skillSlots trunkThk | pre(living mains skillSlots) | DELTA living/mains/skillSlots');
console.log('----------|--------------------------------------------------|------------------------------|------------------------------');
for (const species of SPECIES_LIST) {
  const snap = GrowthEngine.statSnapshot(bandTrees[species].tree);
  const pre = PRE_CHANGE[species];
  const preSkill = pre.livingBranches - pre.depth1Mains;
  const dLiving = snap.livingBranches - pre.livingBranches;
  const dMains = snap.depth1Mains - pre.depth1Mains;
  const dSkill = snap.depth2Plus - preSkill;
  console.log(
    species.padEnd(9) + ' | ' +
    `${snap.livingBranches} ${snap.depth1Mains} ${snap.depth2Plus} ${snap.depth2Plus} ${snap.trunkThickness}`.padEnd(48) + ' | ' +
    `${pre.livingBranches} ${pre.depth1Mains} ${preSkill}`.padEnd(28) + ' | ' +
    `${dLiving >= 0 ? '+' : ''}${dLiving} / ${dMains >= 0 ? '+' : ''}${dMains} / ${dSkill >= 0 ? '+' : ''}${dSkill}`
  );
  console.log('          | day=' + snap.day + ' totalMass=' + snap.totalMass +
              ' (pre-change day=' + pre.day + ' trunkLen=' + pre.trunkLen + ')');
}
console.log('note: hp/power/endurance/ki are voxel-role sums and are NOT printed here; run');
console.log('      `node packages/engine/test_statderiver.mjs` (D1-D7) for the voxel-level pass.');
console.log('');

// ---------------------------------------------------------------------------------------
// GATE SUMMARY
// ---------------------------------------------------------------------------------------
console.log('='.repeat(96));
console.log('GATE SUMMARY');
console.log('='.repeat(96));
for (const g of gates) {
  console.log((g.pass ? 'PASS' : 'FAIL') + ' | ' + g.name.padEnd(16) + ' | ' + g.detail);
}
const allPass = gates.every((g) => g.pass);
console.log('');
if (allPass) {
  console.log('RESULT: all gates pass -- band ' + BAND_MIN + '-' + BAND_MAX + ' at day ' +
              REGIME_HEALTHY.days + ' under ' + REGIME_HEALTHY.name +
              ' (floor/ceiling, rotation bias and taper all active).');
  process.exitCode = 0;
} else {
  console.log('RESULT: at least one gate FAILED (see the table above). If BAND is the failing');
  console.log('        gate, tune internodeBase / internodeDepthStep / trunkInternode in');
  console.log('        @kijo/shared SPECIES_PARAMS (packages/shared/src/index.ts), rebuild, re-run.');
  process.exitCode = 1;
}
