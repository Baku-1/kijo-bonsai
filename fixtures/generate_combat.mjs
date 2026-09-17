import { writeFileSync, mkdirSync } from 'node:fs';
import { CareLogReplay, BonsaiTree } from '../packages/engine/dist/index.js';
import { Voxelizer } from '../packages/voxelizer/dist/index.js';
import { WATER_AMOUNT } from '../packages/shared/dist/index.js';
import { createCombatPayload } from '../apps/server/supabase/functions/derive-stats/combat-payload.mjs';

// Offline demonstrators, never represented as the user's live NFT trees.
const log = Array.from({ length: 40 }, (_, i) => ({ day: i * 5, action: { type: 'water', amount: WATER_AMOUNT } }));
const output = new URL('../../fixtures/combat/', import.meta.url);
mkdirSync(output, { recursive: true });
for (const [seed, species] of [[464497, 'hardwood'], [777001, 'tropical'], [901, 'evergreen']]) {
  const tree = CareLogReplay.reconstruct(seed, species, log, 200);
  const payload = await createCombatPayload(tree, Voxelizer.voxelize(tree));
  writeFileSync(new URL(species + '.json', output), JSON.stringify(payload));
  console.log(`${species}: ${payload.morphology.voxels.length} source voxels; ${payload.snapshotId}`);
}
const seedling = new BonsaiTree(464497, 'hardwood');
writeFileSync(new URL('seedling.json', output), JSON.stringify(await createCombatPayload(seedling, Voxelizer.voxelize(seedling))));
