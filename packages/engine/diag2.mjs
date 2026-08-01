// Test: what happens when original tree waters with 30 but replay uses WATER_AMOUNT (28)?
import { BonsaiTree } from './dist/BonsaiTree.js';
import { GrowthEngine } from './dist/GrowthEngine.js';
import { CareLogReplay } from './dist/CareLogReplay.js';
import { WATER_AMOUNT } from '../shared/dist/index.js';

console.log('WATER_AMOUNT =', WATER_AMOUNT);

const SEED = 464497;
const SPECIES = 'hardwood';
const DAYS = 200;

// Grow original tree watering with 30 (like grow200())
const orig = new BonsaiTree(SEED, SPECIES);
for (let d = 0; d < DAYS; d++) {
  if (orig.getMoisture() < 25) orig.water(30);  // original uses 30
  GrowthEngine.growTick(orig);
}

const careLog = orig.getCareLog();
console.log(`Care log entries: ${careLog.length} (water entries: ${careLog.filter(e=>e.action.type==='water').length})`);

// Replay uses WATER_AMOUNT (28)
const replayed = CareLogReplay.reconstruct(SEED, SPECIES, careLog, DAYS);

const origBranches = orig.getBranches();
const repBranches = replayed.getBranches();

console.log(`Orig branch count: ${origBranches.length}, Replay branch count: ${repBranches.length}`);

console.log('\n=== depth-2+ attachmentY: orig vs replay ===');
let mismatches = 0;
for (let i = 0; i < Math.max(origBranches.length, repBranches.length); i++) {
  const o = origBranches[i], r = repBranches[i];
  if (!o && r) { console.log(`  id=${i} ONLY IN REPLAY: depth=${r.depth} attachmentY=${r.attachmentY}`); mismatches++; }
  else if (o && !r) { console.log(`  id=${i} ONLY IN ORIG: depth=${o.depth} attachmentY=${o.attachmentY}`); mismatches++; }
  else if (o.depth >= 2 && o.attachmentY !== r.attachmentY) {
    console.log(`  id=${i} depth=${o.depth} ORIG=${o.attachmentY} REPLAY=${r.attachmentY} DIFF=${(r.attachmentY-o.attachmentY).toFixed(4)}`);
    mismatches++;
  }
}
if (mismatches === 0) console.log('  (perfect match)');
else console.log(`  ${mismatches} mismatches total`);

// Show all replayed depth-2+ attachmentY values
const repDeep = repBranches.filter(b => !b.pruned && b.depth >= 2);
const repYs = repDeep.map(b => b.attachmentY);
const unique = new Set(repYs);
console.log(`\nReplayed depth-2+ unique attachmentY values: ${unique.size} of ${repYs.length}`);
