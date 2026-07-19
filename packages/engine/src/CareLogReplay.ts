import type { SpeciesClass, CareLogEntry } from '@kijo/shared';
import { BonsaiTree } from './BonsaiTree.js';
import { GrowthEngine } from './GrowthEngine.js';
import { PruneEngine } from './PruneEngine.js';
import { WireEngine } from './WireEngine.js';

export class CareLogReplay {
  /**
   * Reconstruct a BonsaiTree from seed + species + care log.
   * Replays day-by-day: apply care actions logged for that day, then growTick.
   * Produces a tree bit-identical to the original if the log is complete.
   * This is the backbone of NFT verification: reconstruct from Merkle-verified log,
   * compare to claimed state.
   */
  static reconstruct(
    seed: number,
    species: SpeciesClass,
    careLog: CareLogEntry[],
    totalDays: number
  ): BonsaiTree {
    const tree = new BonsaiTree(seed, species);
    for (let day = 0; day < totalDays; day++) {
      // Apply care actions logged for this day before the tick
      for (const entry of careLog) {
        if (entry.day === day) {
          const a = entry.action;
          if (a.type === 'water') tree.water(30);
          else if (a.type === 'fertilize') tree.fertilize();
          else if (a.type === 'rotate') tree.rotate();
          else if (a.type === 'prune') PruneEngine.prune(tree, a.branchId);
          else if (a.type === 'wire') WireEngine.wire(tree, a.branchId, a.angleDelta);
        }
      }
      GrowthEngine.growTick(tree);
    }
    return tree;
  }
}
