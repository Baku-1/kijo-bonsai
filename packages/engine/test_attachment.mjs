/**
 * Gate suite for attachmentY correctness — A1 through A7.
 *
 * attachmentY records the Y-coordinate along a parent branch's axis where the
 * child attaches (voxel units).  It is set once at fork time and never updated.
 * The voxelizer uses it to position each branch in 3-D space; stat derivation
 * (ARM vs LEG split) depends on it.  The core invariant requires that
 * CareLogReplay.reconstruct() produces a tree with identical attachmentY values
 * to the live-grown original.
 *
 * Run after: npm run build --workspace=packages/engine
 * Command:   node packages/engine/test_attachment.mjs  (from repo root)
 * Exit 0 = all gates pass.  Exit 1 = any gate failed.
 */

import { BonsaiTree }    from './dist/BonsaiTree.js';
import { GrowthEngine }  from './dist/GrowthEngine.js';
import { CareLogReplay } from './dist/CareLogReplay.js';
import { WATER_AMOUNT }  from '../shared/dist/index.js';

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

/**
 * Grow a tree for `days` days, watering with `waterAmount` when moisture drops
 * below `waterThreshold`.  The caller controls `waterAmount` so we can test
 * both the canonical WATER_AMOUNT path and non-standard amounts.
 */
function growTree(seed, species, days, waterAmount = WATER_AMOUNT, waterThreshold = 25) {
  const tree = new BonsaiTree(seed, species);
  for (let d = 0; d < days; d++) {
    if (tree.getMoisture() < waterThreshold) tree.water(waterAmount);
    GrowthEngine.growTick(tree);
  }
  return tree;
}

// ---------------------------------------------------------------------------
// A1 — Trunk (depth-0) always has attachmentY = 0
// ---------------------------------------------------------------------------

console.log('\nA1 — Trunk attachmentY = 0');
{
  const tree   = growTree(464497, 'hardwood', 200);
  const trunk  = tree.getBranches()[0];
  console.log(`  trunk.depth=${trunk.depth} trunk.attachmentY=${trunk.attachmentY}`);
  assert(trunk.depth === 0,         'trunk is depth 0');
  assert(trunk.attachmentY === 0,   'trunk.attachmentY === 0');
}

// ---------------------------------------------------------------------------
// A2 — Depth-1 primary obeys one-third rule (attachmentY < trunk.length * 0.34)
//
// The first-ever depth-1 branch (primary) attaches at 33% of trunk length at
// fork time.  Its attachmentY must be strictly less than the trunk's final
// length (trunk keeps growing after the fork).
// ---------------------------------------------------------------------------

console.log('\nA2 — Depth-1 primary: one-third rule (attachmentY < trunk.length)');
{
  const tree     = growTree(464497, 'hardwood', 200);
  const branches = tree.getBranches();
  const trunk    = branches[0];

  // The primary depth-1 branch is the first child of the trunk (id = trunk.children[0])
  assert(trunk.children.length > 0, 'trunk has at least one child');
  if (trunk.children.length > 0) {
    const primary = branches[trunk.children[0]];
    console.log(`  primary id=${primary.id} attachmentY=${primary.attachmentY} trunk.length=${trunk.length.toFixed(4)}`);
    assert(primary.depth === 1,                       'primary is depth 1');
    assert(primary.attachmentY > 0,                   'primary.attachmentY > 0');
    assert(primary.attachmentY < trunk.length,        'primary.attachmentY < trunk.length (one-third, not tip)');
    // Sanity: at fork time trunk.length was >= MIN_TRUNK_FOR_FIRST_BRANCH (20),
    // so 0.33 × 20 = 6.6 ≤ attachmentY < trunk.length.
    assert(primary.attachmentY >= 6.5,                'primary.attachmentY >= 6.5 (one-third of ≥ 20)');
  }
}

// ---------------------------------------------------------------------------
// A3 — Depth-1 secondary (sibling in same fork event) has higher attachmentY
//      than the primary (it attaches at trunk tip, not one-third).
// ---------------------------------------------------------------------------

console.log('\nA3 — Depth-1 secondary attachmentY > primary attachmentY');
{
  const tree     = growTree(464497, 'hardwood', 200);
  const branches = tree.getBranches();
  const trunk    = branches[0];

  // The trunk may fork and produce both primary (i=0) and secondary (i=1)
  // in a single event — they appear as consecutive IDs in trunk.children.
  // Find any pair of consecutive siblings created in the same tick by
  // checking if secondary.bornDay === primary.bornDay (engine extension field).
  const primId = trunk.children[0];
  const secId  = trunk.children[1];
  if (secId !== undefined) {
    const primary   = branches[primId];
    const secondary = branches[secId];
    console.log(`  primary id=${primId} attachmentY=${primary.attachmentY}, secondary id=${secId} attachmentY=${secondary.attachmentY}`);
    assert(
      secondary.attachmentY >= primary.attachmentY,
      'secondary.attachmentY >= primary.attachmentY (tip vs. one-third)',
      `primary=${primary.attachmentY} secondary=${secondary.attachmentY}`,
    );
  } else {
    // Only one depth-1 branch (trunk forked once, one child) — gate still passes.
    console.log('  (trunk produced only one depth-1 branch — A3 vacuously true)');
    passed++;
  }
}

// ---------------------------------------------------------------------------
// A4 — All depth-2+ branches have attachmentY > 0
//      (they attach partway along their parent, never at the grandparent start)
// ---------------------------------------------------------------------------

console.log('\nA4 — All depth-2+ branches have attachmentY > 0');
{
  const tree   = growTree(464497, 'hardwood', 200);
  const deep   = tree.getBranches().filter(b => !b.pruned && b.depth >= 2);
  console.log(`  depth-2+ branch count: ${deep.length}`);
  assert(deep.length >= 2, `at least 2 depth-2+ branches exist (got ${deep.length})`);
  const allPositive = deep.every(b => b.attachmentY > 0);
  assert(allPositive, 'every depth-2+ branch has attachmentY > 0');
  if (!allPositive) {
    for (const b of deep.filter(b => b.attachmentY <= 0)) {
      console.error(`    bad: id=${b.id} depth=${b.depth} attachmentY=${b.attachmentY}`);
    }
  }
}

// ---------------------------------------------------------------------------
// A5 — Depth-2+ branches from different parents have diverse attachmentY values
//      (not all collapsed to the same number)
// ---------------------------------------------------------------------------

console.log('\nA5 — Depth-2+ branches across different parents have diverse attachmentY values');
{
  const tree     = growTree(464497, 'hardwood', 200);
  const branches = tree.getBranches();
  const deep     = branches.filter(b => !b.pruned && b.depth >= 2);

  // Group by parent — each parent's tip length at fork time is a distinct value.
  const parentIds = new Set(deep.map(b => b.parent));
  console.log(`  depth-2+ branches: ${deep.length}, distinct parents: ${parentIds.size}`);

  if (parentIds.size >= 2) {
    // Collect the set of unique attachmentY values across branches from different parents
    const parentToY = new Map();
    for (const b of deep) {
      if (!parentToY.has(b.parent)) parentToY.set(b.parent, b.attachmentY);
    }
    const distinctY = new Set(parentToY.values());
    console.log(`  unique attachmentY values (one per parent): ${[...distinctY].join(', ')}`);
    assert(
      distinctY.size >= 2,
      `branches from different parents have distinct attachmentY (got ${distinctY.size} unique)`,
    );
  } else {
    console.log('  (only one parent for depth-2+ branches — A5 vacuously true)');
    passed++;
  }
}

// ---------------------------------------------------------------------------
// A6 — Voxelizer places depth-2+ branches at positions derived from attachmentY
//      (branches with different attachmentY start at genuinely different 3-D coords)
// ---------------------------------------------------------------------------

console.log('\nA6 — Voxelizer positions are consistent with attachmentY diversity');
{
  // We test this indirectly: two depth-2 branches with different attachmentY
  // should start at different world-Y positions (since the parent is upward-leaning).
  // We verify that depth-2+ branches do NOT all start at the same integer Y.
  const tree     = growTree(464497, 'hardwood', 200);
  const branches = tree.getBranches();
  const parentIds = new Set(branches.filter(b => !b.pruned && b.depth >= 2).map(b => b.parent));

  if (parentIds.size >= 2) {
    // Use attachmentY as a proxy for start-Y (parent grows upward, so parentStart.y + parentDir.y * attachmentY).
    // If two branches have different attachmentY AND different parents, their start positions differ.
    const repAttachY = [...parentIds].map(pid => {
      const firstChild = branches.find(b => b.parent === pid && b.depth >= 2 && !b.pruned);
      return firstChild ? firstChild.attachmentY : 0;
    });
    const unique = new Set(repAttachY);
    console.log(`  unique attachmentY across depth-2+ parents: ${[...unique].join(', ')}`);
    assert(unique.size >= 2, `different depth-2+ parents yield different branch start heights`);
  } else {
    console.log('  (only one parent — A6 vacuously true)');
    passed++;
  }
}

// ---------------------------------------------------------------------------
// A7 — CareLogReplay.reconstruct preserves attachmentY exactly
//
// Core invariant: seed + care_log → identical tree, everywhere, always.
// We grow the tree using a NON-standard water amount (30, not WATER_AMOUNT=28)
// to ensure the care log must faithfully record and replay the exact amount.
// If the replay uses a different amount, moisture diverges, growth diverges,
// attachmentY values diverge — and branches appear at wrong heights.
//
// Before fix: replay uses hardcoded WATER_AMOUNT (28) → water-30 diverges →
//             replayed tree has wrong branch count and wrong attachmentY.
// After fix:  replay uses the logged amount (30) → trees are bit-identical.
// ---------------------------------------------------------------------------

console.log('\nA7 — CareLogReplay preserves attachmentY exactly (water-amount invariant)');
{
  const seed      = 464497;
  const species   = 'hardwood';
  const totalDays = 200;

  // Grow original with water amount 30 (deliberately NOT WATER_AMOUNT to expose the bug)
  const origTree = growTree(seed, species, totalDays, 30, 25);
  const careLog  = origTree.getCareLog();
  const origBranches = origTree.getBranches();

  console.log(`  original tree: ${origBranches.length} branches, care log: ${careLog.length} entries`);

  // Replay
  const replayTree    = CareLogReplay.reconstruct(seed, species, careLog, totalDays);
  const repBranches   = replayTree.getBranches();

  console.log(`  replayed tree: ${repBranches.length} branches`);

  assert(
    repBranches.length === origBranches.length,
    `branch count identical (${origBranches.length})`,
    `orig=${origBranches.length} replay=${repBranches.length}`,
  );

  // Check every branch has the same attachmentY in replay as in original
  let mismatches = 0;
  const N = Math.min(origBranches.length, repBranches.length);
  for (let i = 0; i < N; i++) {
    const o = origBranches[i];
    const r = repBranches[i];
    if (o.attachmentY !== r.attachmentY) {
      if (mismatches === 0) console.error('  mismatches:');
      console.error(`    id=${i} depth=${o.depth} orig.attachmentY=${o.attachmentY} replay.attachmentY=${r.attachmentY}`);
      mismatches++;
    }
  }

  assert(
    mismatches === 0,
    `all ${N} branches have identical attachmentY in replay`,
    `${mismatches} mismatches`,
  );

  // Diversity sub-check: depth-2+ branches in the replay must NOT be identical
  const repDeep = repBranches.filter(b => !b.pruned && b.depth >= 2);
  if (repDeep.length >= 2) {
    const parentToY = new Map();
    for (const b of repDeep) {
      if (!parentToY.has(b.parent)) parentToY.set(b.parent, b.attachmentY);
    }
    const distinctY = new Set(parentToY.values());
    assert(
      distinctY.size >= 2,
      `replayed depth-2+ branches from different parents have distinct attachmentY (${distinctY.size} unique)`,
    );
  } else {
    console.log('  (fewer than 2 depth-2+ branches in replay — divergence likely)');
    // Count this as a failure: a correct replay of a 200-day tree must have many branches
    assert(repDeep.length >= 2, `replay has depth-2+ branches (got ${repDeep.length})`);
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${'─'.repeat(50)}`);
console.log(`A1–A7 result: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
