import type { CareLogEntry } from '@kijo/shared';
import type { BonsaiTree } from './BonsaiTree.js';

/**
 * PruneEngine — stateless prune logic.
 *
 * Separated from BonsaiTree (which would create a circular import if it
 * held this logic directly) following the same stateless-class pattern as
 * GrowthEngine.
 *
 * BonsaiTree.prune() delegates here; CareLogReplay calls this directly on
 * replay so that pruned state is faithfully reconstructed.
 */
export class PruneEngine {
  /**
   * Prune branch `branchId` and all its descendants.
   *
   * Returns false (no-op) when:
   *   • branchId is out of range
   *   • the branch is the trunk (depth === 0)
   *   • the branch is already pruned
   *
   * On success:
   *   1. Marks target + all descendants `pruned = true` via iterative cascade.
   *   2. Logs { day: tree.getAge(), action: { type: 'prune', branchId } }.
   *   3. Calls tree.markDirty().
   *   4. Returns true.
   */
  static prune(tree: BonsaiTree, branchId: number): boolean {
    const branches = tree.getBranches();

    // Range guard
    if (branchId < 0 || branchId >= branches.length) return false;

    const target = branches[branchId];

    // Trunk guard (depth === 0 is always the trunk)
    if (target.depth === 0) return false;

    // Already-pruned guard
    if (target.pruned) return false;

    // Iterative cascade: mark branch + all descendants
    const stack: number[] = [branchId];
    while (stack.length > 0) {
      const id = stack.pop()!;
      const b = tree._getBranchMutable(id);
      if (!b || b.pruned) continue;
      b.pruned = true;
      for (const childId of b.children) {
        stack.push(childId);
      }
    }

    // Append to care log
    const entry: CareLogEntry = {
      day: tree.getAge(),
      action: { type: 'prune', branchId },
    };
    tree._logCare(entry);

    tree.markDirty();
    return true;
  }
}
