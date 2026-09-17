import { deriveVisualTraits } from '@kijo/shared';
import { StatDeriver } from '@kijo/engine';
import type { BonsaiTree } from '@kijo/engine';
import type { VoxelizeResult, Vec3 } from './index.js';

const tuple = (v: Vec3): [number, number, number] => [v.x, v.y, v.z];

/** Pure export of ONE tree/voxelization. No growth, second voxelization or I/O. */
export function buildCombatSnapshot(tree: BonsaiTree, result: VoxelizeResult) {
  const seed = tree.getSeed();
  const species = tree.getSpecies();
  const ageDays = tree.getAge();
  return {
    seed, species, ageDays,
    stats: StatDeriver.derive(tree, result.voxels, seed, ageDays, result.zones),
    morphology: {
      schemaVersion: 1,
      gridSize: 256,
      coordinateEncoding: 'x16-y8-z0',
      source: { seed, species, ageDays },
      visualTraits: deriveVisualTraits(seed, species),
      availability: { seasonalLeaves: false, locatedScars: false, morale: false },
      // Preserve canonical order, including equal-attachment-height tie order.
      branches: tree.getBranches().map(b => {
        const placement = result.placements.get(b.id);
        return {
          id: b.id, parent: b.parent, depth: b.depth, angle: b.angle,
          length: b.length, thickness: b.thickness, attachmentY: b.attachmentY,
          children: [...b.children], pruned: b.pruned,
          role: result.branchRoles.get(b.id) ?? null,
          placement: placement ? {
            start: tuple(placement.start), end: tuple(placement.end), direction: tuple(placement.dir),
          } : null,
        };
      }),
      voxels: result.voxels.serialize(),
    },
  };
}
