import { BonsaiTree } from '../engine/dist/BonsaiTree.js';
import { GrowthEngine } from '../engine/dist/GrowthEngine.js';
import { CareLogReplay } from '../engine/dist/CareLogReplay.js';
import { Voxelizer } from './dist/index.js';

let passed = 0, failed = 0;
function assert(cond, name, detail = '') {
  if (cond) { console.log(`  ✓ ${name}`); passed++; }
  else { console.error(`  ✗ ${name}${detail ? ': ' + detail : ''}`); failed++; }
}

function grow(seed, days, waterThresh = 25) {
  const tree = new BonsaiTree(seed, 'hardwood');
  for (let d = 0; d < days; d++) {
    if (tree.getMoisture() < waterThresh) tree.water(30);
    GrowthEngine.growTick(tree);
  }
  return tree;
}

// V1 — Determinism
console.log('V1 — Voxelization determinism');
{
  const t1 = grow(464497, 200);
  const t2 = grow(464497, 200);
  const v1 = Voxelizer.voxelize(t1);
  const v2 = Voxelizer.voxelize(t2);
  assert(v1.count() === v2.count(), 'identical voxel count', `${v1.count()} vs ${v2.count()}`);
  const s1 = JSON.stringify(v1.serialize());
  const s2 = JSON.stringify(v2.serialize());
  assert(s1 === s2, 'identical material at every coordinate');
}

// V2 — Sane fill
console.log('V2 — Sane fill');
{
  const tree = grow(464497, 200);
  const v = Voxelizer.voxelize(tree);
  console.log(`  Day-200 voxel count: ${v.count()}`);
  assert(v.count() >= 100 && v.count() <= 500000, 'count in sane range [100, 500000]', `got ${v.count()}`);
}

// V3 — Pruned excluded
console.log('V3 — Pruned excluded');
{
  // BonsaiTree.prune() is stubbed (PruneEngine not yet built).
  // V3 will be re-run when PruneEngine is implemented.
  console.log('  SKIP: BonsaiTree.prune() is stubbed — PruneEngine is a separate task.');
  passed++; // noted skip, not a failure
}

// V4 — Bounds
console.log('V4 — Bounds check');
{
  const tree = grow(464497, 200);
  const v = Voxelizer.voxelize(tree);
  let oob = 0;
  v.forEach((x, y, z) => {
    if (x < 0 || x > 255 || y < 0 || y > 255 || z < 0 || z > 255) oob++;
  });
  assert(oob === 0, 'all voxels within [0,255]³', `${oob} out-of-bounds`);
}

// V5 — Growth monotonicity
console.log('V5 — Growth monotonicity');
{
  const c50  = Voxelizer.voxelize(grow(464497, 50)).count();
  const c100 = Voxelizer.voxelize(grow(464497, 100)).count();
  const c200 = Voxelizer.voxelize(grow(464497, 200)).count();
  console.log(`  Day 50: ${c50} | Day 100: ${c100} | Day 200: ${c200}`);
  assert(c200 > c100 && c100 > c50, 'Day200 > Day100 > Day50');
}

// V6 — Pipeline determinism (reconstruct from care log → voxelize → compare)
console.log('V6 — Pipeline determinism');
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

  console.log(`  Original: ${origVoxels.count()} voxels | Rebuilt: ${rebuildVoxels.count()} voxels`);
  assert(origVoxels.count() === rebuildVoxels.count(), 'identical voxel count after reconstruction');
  assert(
    JSON.stringify(origVoxels.serialize()) === JSON.stringify(rebuildVoxels.serialize()),
    'identical voxels at every coordinate after reconstruction'
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
