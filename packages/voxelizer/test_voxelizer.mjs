import { BonsaiTree } from '../engine/dist/BonsaiTree.js';
import { GrowthEngine } from '../engine/dist/GrowthEngine.js';
import { CareLogReplay } from '../engine/dist/CareLogReplay.js';
import { PruneEngine } from '../engine/dist/PruneEngine.js';
import { Voxelizer, Material } from './dist/index.js';

let passed = 0, failed = 0;
function assert(cond, name, detail) {
  detail = detail || '';
  if (cond) { console.log('  ✓ ' + name); passed++; }
  else { console.error('  ✗ ' + name + (detail ? ': ' + detail : '')); failed++; }
}

function grow(seed, days, waterThresh) {
  waterThresh = waterThresh || 25;
  const tree = new BonsaiTree(seed, 'hardwood');
  for (let d = 0; d < days; d++) {
    if (tree.getMoisture() < waterThresh) tree.water(30);
    GrowthEngine.growTick(tree);
  }
  return tree;
}

// V1 - Determinism
console.log('V1 - Voxelization determinism');
{
  const t1 = grow(464497, 200);
  const t2 = grow(464497, 200);
  const v1 = Voxelizer.voxelize(t1);
  const v2 = Voxelizer.voxelize(t2);
  assert(v1.count() === v2.count(), 'identical voxel count', v1.count() + ' vs ' + v2.count());
  const s1 = JSON.stringify(v1.serialize());
  const s2 = JSON.stringify(v2.serialize());
  assert(s1 === s2, 'identical material at every coordinate');
}

// V2 - Sane fill
console.log('V2 - Sane fill');
{
  const tree = grow(464497, 200);
  const v = Voxelizer.voxelize(tree);
  console.log('  Day-200 voxel count: ' + v.count());
  assert(v.count() >= 100 && v.count() <= 500000, 'count in sane range [100, 500000]', 'got ' + v.count());
}

// V3 - Pruned excluded
console.log('V3 - Pruned excluded');
{
  const tree = grow(464497, 50);
  const countBefore = Voxelizer.voxelize(tree).count();

  const branches = tree.getBranches();
  const target = branches.find(function(b) { return b.depth >= 1 && !b.pruned; });
  if (!target) throw new Error('V3: no pruneable branch found');

  const pruneResult = PruneEngine.prune(tree, target.id);
  assert(pruneResult === true, 'prune() returned true for a valid branch');

  const vAfter = Voxelizer.voxelize(tree);
  const countAfter = vAfter.count();
  const drop = countBefore - countAfter;
  console.log('  countBefore=' + countBefore + ' countAfter=' + countAfter + ' drop=' + drop + ' (pruned branch id=' + target.id + ' depth=' + target.depth + ')');

  assert(countAfter < countBefore, 'pruned tree has fewer voxels', 'before=' + countBefore + ' after=' + countAfter);
  assert(drop > 0, 'voxel drop is strictly positive', 'drop=' + drop);

  let scarCount = 0;
  vAfter.forEach(function(x, y, z, mat) { if (mat === Material.PRUNE_SCAR) scarCount++; });
  if (scarCount > 0) {
    console.log('  advisory: ' + scarCount + ' PRUNE_SCAR voxels at cut point');
  } else {
    console.log('  advisory: prune scars not yet voxelized (PRUNE_SCAR=0 voxels - non-blocking)');
  }
}

// V4 - Bounds
console.log('V4 - Bounds check');
{
  const tree = grow(464497, 200);
  const v = Voxelizer.voxelize(tree);
  let oob = 0;
  v.forEach(function(x, y, z) {
    if (x < 0 || x > 255 || y < 0 || y > 255 || z < 0 || z > 255) oob++;
  });
  assert(oob === 0, 'all voxels within [0,255]^3', oob + ' out-of-bounds');
}

// V5 - Growth monotonicity
console.log('V5 - Growth monotonicity');
{
  const c50  = Voxelizer.voxelize(grow(464497, 50)).count();
  const c100 = Voxelizer.voxelize(grow(464497, 100)).count();
  const c200 = Voxelizer.voxelize(grow(464497, 200)).count();
  console.log('  Day 50: ' + c50 + ' | Day 100: ' + c100 + ' | Day 200: ' + c200);
  assert(c200 > c100 && c100 > c50, 'Day200 > Day100 > Day50');
}

// V6 - Pipeline determinism
console.log('V6 - Pipeline determinism');
{
  const original = new BonsaiTree(464497, 'hardwood');
  for (let d = 0; d < 200; d++) {
    if (original.getMoisture() < 25) original.water(30);
    GrowthEngine.growTick(original);
  }
  const origVoxels = Voxelizer.voxelize(original);
  const careLog = original.getCareLog();

  const rebuilt = CareLogReplay.reconstruct(464497, 'hardwood', careLog, 200);
  const rebuildVoxels = Voxelizer.voxelize(rebuilt);

  console.log('  Original: ' + origVoxels.count() + ' voxels | Rebuilt: ' + rebuildVoxels.count() + ' voxels');
  assert(origVoxels.count() === rebuildVoxels.count(), 'identical voxel count after reconstruction');
  assert(
    JSON.stringify(origVoxels.serialize()) === JSON.stringify(rebuildVoxels.serialize()),
    'identical voxels at every coordinate after reconstruction'
  );
}

// V7 - Role coverage: every voxel has a valid VoxelRole; print histogram.
console.log('V7 - Role coverage');
{
  const tree = grow(464497, 200);
  const v = Voxelizer.voxelize(tree);
  const validRoles = new Set(['trunk', 'arm', 'leg', 'digit', 'canopy', 'root', 'scar']);
  let invalidCount = 0;
  const histogram = {};
  v.forEach(function(x, y, z, mat, role) {
    if (!validRoles.has(role)) { invalidCount++; }
    histogram[role] = (histogram[role] || 0) + 1;
  });
  console.log('  Role histogram: ' + JSON.stringify(histogram));
  assert(invalidCount === 0, 'every voxel has a valid VoxelRole', invalidCount + ' invalid roles');
}

// V8 - ARM/LEG split sane: Day-200 tree has both ARM and LEG voxels > 0.
console.log('V8 - ARM/LEG split sane');
{
  const tree = grow(464497, 200);
  const v = Voxelizer.voxelize(tree);
  let armCount = 0, legCount = 0;
  v.forEach(function(x, y, z, mat, role) {
    if (role === 'arm') armCount++;
    else if (role === 'leg') legCount++;
  });
  console.log('  ARM: ' + armCount + ', LEG: ' + legCount);
  assert(armCount > 0, 'ARM voxels > 0', 'got ' + armCount);
  assert(legCount > 0, 'LEG voxels > 0', 'got ' + legCount);
}

// V9 - Role determinism: same tree twice yields identical role at every coordinate.
console.log('V9 - Role determinism');
{
  const t1 = grow(464497, 200);
  const t2 = grow(464497, 200);
  const v1 = Voxelizer.voxelize(t1);
  const v2 = Voxelizer.voxelize(t2);
  const s1 = JSON.stringify(v1.serialize());
  const s2 = JSON.stringify(v2.serialize());
  const pass = s1 === s2;
  console.log('  ' + (pass ? 'PASS' : 'FAIL') + ' -- role+material identical at every coordinate');
  assert(pass, 'identical role at every coordinate');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
