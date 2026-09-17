import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { CareLogReplay, StatDeriver } from '../packages/engine/dist/index.js';
import { Voxelizer, buildCombatSnapshot } from '../packages/voxelizer/dist/index.js';
import { WATER_AMOUNT } from '../packages/shared/dist/index.js';
import { createCombatPayload } from '../apps/server/supabase/functions/derive-stats/combat-payload.mjs';

const log = Array.from({ length: 40 }, (_, i) => ({ day: i * 5, action: { type: 'water', amount: WATER_AMOUNT } }));
const identities = [];
for (const [seed, species] of [[464497, 'hardwood'], [777001, 'tropical'], [901, 'evergreen']]) {
  const tree = CareLogReplay.reconstruct(seed, species, log, 200);
  const v = Voxelizer.voxelize(tree);
  const before = JSON.stringify([tree.getBranches(), tree.getCareLog(), v.voxels.serialize(), tree.isDirty()]);
  const payload = buildCombatSnapshot(tree, v);
  assert.equal(JSON.stringify([tree.getBranches(), tree.getCareLog(), v.voxels.serialize(), tree.isDirty()]), before, 'read-only export');
  assert.deepEqual(payload.stats, StatDeriver.derive(tree, v.voxels, seed, 200, v.zones), 'all ten stats unchanged');
  assert.equal(Object.keys(payload.stats).length, 10);
  assert.deepEqual(payload.morphology.voxels, v.voxels.serialize(), 'exact voxel/material/role/branch provenance');
  const replay = CareLogReplay.reconstruct(seed, species, log, 200);
  assert.equal(JSON.stringify(buildCombatSnapshot(replay, Voxelizer.voxelize(replay))), JSON.stringify(payload), 'independent replay determinism');
  for (const [, , role, id] of payload.morphology.voxels) {
    const b = payload.morphology.branches.find(b => b.id === id);
    assert.ok(b && !b.pruned && b.placement, 'voxel owner is a placed live branch');
    if (role !== 'canopy' && role !== 'root') assert.equal(role, b.role, 'single role authority');
  }
  // Transport uses the exact same pure snapshot from the rebuilt edge bundle.
  const transport = await createCombatPayload(tree, v);
  const { snapshotId, ...transportContent } = transport;
  assert.deepEqual(transportContent, payload, 'bundle parity');
  assert.equal(snapshotId, createHash('sha256').update(JSON.stringify(payload)).digest('hex'));
  identities.push(snapshotId);
  // Export must own copies, not alias the live tree or voxel arrays.
  payload.morphology.branches[0].children.push(99999);
  payload.morphology.voxels[0][0] = -1;
  assert.equal(JSON.stringify([tree.getBranches(), tree.getCareLog(), v.voxels.serialize(), tree.isDirty()]), before);
  const limb = tree.getBranches().find(b => b.depth === 1 && !b.pruned);
  assert.ok(limb);
  tree.prune(limb.id);
  const pruned = buildCombatSnapshot(tree, Voxelizer.voxelize(tree));
  assert.ok(pruned.morphology.branches.find(b => b.id === limb.id).pruned);
  assert.ok(!pruned.morphology.voxels.some(c => c[3] === limb.id), 'removed limb never rendered');
  assert.equal(pruned.morphology.availability.locatedScars, false, 'missing provenance explicit');
}
console.log('COMBAT SNAPSHOT PASS: 3 species; determinism, stat parity, provenance, read-only, prune and bundle parity.');
console.log('DETERMINISM ' + identities.join(' '));
