/**
 * exportFixture -- thin I/O wrapper around the Kijo stat pipeline.
 *
 * NOT part of the engine core.  Engine never imports from here.
 * Architecture rule (KIJO-ARCHITECTURE.md s2.2): engine is pure -- no I/O,
 * no rendering, no network.  This wrapper lives in fixtures/ at repo root.
 *
 * Dependency chain (read-only, no mutation of engine internals):
 *   CareLogReplay -> reconstructed BonsaiTree
 *   Voxelizer     -> SparseVoxelSet
 *   StatDeriver   -> StatSheet
 *   writeFileSync -> JSON on disk
 *
 * @param {number}  seed        - deterministic seed
 * @param {string}  species     - 'hardwood' | 'evergreen' | 'tropical'
 * @param {Array}   careLog     - CareLogEntry[] ({day, action})
 * @param {number}  totalDays   - days to replay (CareLogReplay loop bound)
 * @param {string}  outPath     - file path to write JSON fixture
 * @param {string}  [generatedAt] - ISO timestamp; defaults to now.
 *                                  Pass a fixed string in tests requiring byte-identity (E2).
 */

import { writeFileSync } from 'node:fs';
import { CareLogReplay } from '../packages/engine/dist/CareLogReplay.js';
import { StatDeriver }   from '../packages/engine/dist/StatDeriver.js';
import { Voxelizer }     from '../packages/voxelizer/dist/index.js';

export function exportFixture(
  seed,
  species,
  careLog,
  totalDays,
  outPath,
  generatedAt = new Date().toISOString()
) {
  // 1. Reconstruct parametric tree from seed + species + care log.
  //    CareLogReplay.reconstruct(seed, species, careLog, totalDays) -> BonsaiTree
  const tree = CareLogReplay.reconstruct(seed, species, careLog, totalDays);

  // 2. Voxelize: BonsaiTree -> SparseVoxelSet (256^3 sparse grid, roles stamped per voxel).
  const voxels = Voxelizer.voxelize(tree);

  // 3. Derive StatSheet: structural (role voxel counts) + terrain bonuses + wisdom + matchPct.
  //    StatDeriver.derive(tree, voxels, seed, ageDays) -> StatSheet (all 8 keys)
  const sheet = StatDeriver.derive(tree, voxels, seed, tree.getAge());

  // 4. Build fixture envelope.
  //    .stats is the Godot KijoStats resource contract -- keys must match exactly.
  //    Outer metadata (seed, species, ageDays, generatedAt) is for humans/debugging only.
  const fixture = {
    seed,
    species,
    ageDays:     tree.getAge(),
    generatedAt,                   // ISO timestamp -- metadata, not engine output
    stats: {
      hp:          sheet.hp,
      power:       sheet.power,
      endurance:   sheet.endurance,
      ki:          sheet.ki,
      skillSlots:  sheet.skillSlots,
      skillPoints: sheet.skillPoints,
      wisdom:      sheet.wisdom,
      matchPct:    sheet.matchPct,
    },
  };

  writeFileSync(outPath, JSON.stringify(fixture, null, 2), 'utf8');
}
