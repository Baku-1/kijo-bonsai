import { BonsaiTree } from './dist/BonsaiTree.js';
import { GrowthEngine } from './dist/GrowthEngine.js';
import { CareLogReplay } from './dist/CareLogReplay.js';
import { WATER_AMOUNT } from '../shared/dist/index.js';

const SEED = 42;
const SPECIES = 'hardwood';
const DAYS = 200;

// Grow original tree (watering with WATER_AMOUNT to match replay)
const orig = new BonsaiTree(SEED, SPECIES);
for (let d = 0; d < DAYS; d++) {
  if (orig.getMoisture() < 25) orig.water(WATER_AMOUNT);
  GrowthEngine.growTick(orig);
}

const careLog = orig.getCareLog();

// Replay
const replayed = CareLogReplay.reconstruct(SEED, SPECIES, careLog, DAYS);

console.log('=== ORIGINAL TREE depth-2+ branches ===');
const origBranches = orig.getBranches();
const origDeep = origBranches.filter(b => !b.pruned && b.depth >= 2);
console.log(`Count: ${origDeep.length}`);
for (const b of origDeep) {
  const parent = origBranches[b.parent];
  console.log(`  id=${b.id} depth=${b.depth} parent=${b.parent} parentLen=${parent?.length?.toFixed(4)} attachmentY=${b.attachmentY}`);
}

console.log('\n=== REPLAYED TREE depth-2+ branches ===');
const repBranches = replayed.getBranches();
const repDeep = repBranches.filter(b => !b.pruned && b.depth >= 2);
console.log(`Count: ${repDeep.length}`);
for (const b of repDeep) {
  const parent = repBranches[b.parent];
  console.log(`  id=${b.id} depth=${b.depth} parent=${b.parent} parentLen=${parent?.length?.toFixed(4)} attachmentY=${b.attachmentY}`);
}

// Check for identical values
const repAttachmentYs = repDeep.map(b => b.attachmentY);
const unique = new Set(repAttachmentYs);
console.log(`\nReplayed depth-2+ attachmentY unique values: ${unique.size} of ${repAttachmentYs.length}`);
console.log(`Values: ${[...unique].join(', ')}`);

if (unique.size <= 1 && repAttachmentYs.length > 1) {
  console.log('\n*** BUG CONFIRMED: all depth-2+ branches have identical attachmentY in replay! ***');
} else if (unique.size < repAttachmentYs.length) {
  console.log('\n*** PARTIAL BUG: some depth-2+ branches share attachmentY in replay ***');
} else {
  console.log('\n✓ No identical-attachmentY bug detected');
}

// Branch-by-branch comparison (orig vs replay)
console.log('\n=== attachmentY mismatches (orig vs replay) ===');
let mismatches = 0;
for (let i = 0; i < Math.min(origBranches.length, repBranches.length); i++) {
  const o = origBranches[i], r = repBranches[i];
  if (o.attachmentY !== r.attachmentY) {
    console.log(`  id=${i} depth=${o.depth} orig=${o.attachmentY} replay=${r.attachmentY}`);
    mismatches++;
  }
}
if (mismatches === 0) console.log('  (all attachmentY values match orig)');
else console.log(`  ${mismatches} mismatches`);
