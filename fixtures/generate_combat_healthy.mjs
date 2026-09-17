import { mkdirSync, writeFileSync } from 'node:fs';
import { BonsaiTree, GrowthEngine } from '../packages/engine/dist/index.js';
import { Voxelizer } from '../packages/voxelizer/dist/index.js';
import { deriveVisualTraits } from '../packages/shared/dist/index.js';
import { createCombatPayload } from '../apps/server/supabase/functions/derive-stats/combat-payload.mjs';

// Additional offline visual examples. Original sparse fixtures remain untouched.
// Canonical REGIME_HEALTHY: daily water to 60, weekly fertilize, 180 growth days.
let redSeed = 1;
while (deriveVisualTraits(redSeed, 'hardwood').leafColor !== 'Red') redSeed++;
const output = new URL('../../fixtures/combat/', import.meta.url);
mkdirSync(output, { recursive: true });
const selectedSpecies = process.argv[2];
for (const [seed, species] of [[redSeed, 'hardwood'], [7472909771253292, 'tropical'], [901, 'evergreen']]) {
  if (selectedSpecies && selectedSpecies !== species) continue;
  const tree = new BonsaiTree(seed, species);
  for (let day = 0; day < 180; day++) {
    const water = 60 - tree.getMoisture();
    if (water > 0) tree.water(water);
    if (day % 7 === 0) tree.fertilize();
    GrowthEngine.growTick(tree);
  }
  const payload = await createCombatPayload(tree, Voxelizer.voxelize(tree));
  writeFileSync(new URL(species + '_healthy.json', output), JSON.stringify(payload));
  console.log(JSON.stringify({species, seed, voxelCount: payload.morphology.voxels.length, roles: payload.morphology.branches.filter(b => b.depth === 1).map(b => b.role), snapshotId: payload.snapshotId}));
}
