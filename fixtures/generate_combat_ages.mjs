import { mkdirSync, writeFileSync } from 'node:fs';
import { BonsaiTree, GrowthEngine } from '../packages/engine/dist/index.js';
import { Voxelizer } from '../packages/voxelizer/dist/index.js';
import { createCombatPayload } from '../apps/server/supabase/functions/derive-stats/combat-payload.mjs';

// Offline morphology examples, not live NFT records or hand-edited trees.
// Same seed/species and healthy regimen isolate age and pruning differences.
const output = new URL('../../fixtures/combat/ages/', import.meta.url);
mkdirSync(output, { recursive: true });
const manifest = { seed: 3, species: 'hardwood', regimen: 'Daily water to 60; fertilize every seven days; canonical daily growth.', examples: [] };
for (const [name, days, sparse] of [['young', 45, false], ['middle', 180, false], ['old', 540, false], ['old_sparse', 540, true]]) {
  const tree = new BonsaiTree(manifest.seed, manifest.species);
  for (let day = 0; day < days; day++) {
    const water = 60 - tree.getMoisture();
    if (water > 0) tree.water(water);
    if (day % 7 === 0) tree.fertilize();
    GrowthEngine.growTick(tree);
  }
  const prunes = [];
  if (sparse) {
    // Keep the original primary scaffold; remove its ramification through the
    // real prune API. Old age alone must not refill these missing strands.
    for (const branch of tree.getBranches().filter(b => b.depth === 2)) {
      if (tree.prune(branch.id)) prunes.push(branch.id);
    }
  }
  const payload = await createCombatPayload(tree, Voxelizer.voxelize(tree));
  writeFileSync(new URL(name + '.json', output), JSON.stringify(payload));
  const example = { name, days, file: name + '.json', liveBranches: payload.morphology.branches.filter(b => !b.pruned).length, prunedBranches: payload.morphology.branches.filter(b => b.pruned).length, pruneOperations: prunes, wisdom: payload.stats.wisdom, voxelCount: payload.morphology.voxels.length, snapshotId: payload.snapshotId };
  manifest.examples.push(example);
  console.log(JSON.stringify(example));
}
writeFileSync(new URL('manifest.json', output), JSON.stringify(manifest, null, 2) + '\n');
