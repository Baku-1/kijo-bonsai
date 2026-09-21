import type { JinResult } from '@kijo/shared';
import type { BonsaiTree } from './BonsaiTree.js';

/**
 * JinEngine -- stateless jin-pliers logic.
 * Pattern: stateless class, same as WireEngine / PruneEngine.
 *
 * Jin permanently converts bark segments to SCAR voxels (VoxelRole.SCAR),
 * granting a Defense bonus and qualifying the Jin overlay for TechniqueClassifier.
 * Jin is irreversible and is a premium action.
 *
 * Phase 2: full implementation (2026-09-18).
 *
 * Specification: ARCH-JINENGINE-PHASE2-2026-09-18.md.
 */
export class JinEngine {

  /**
   * Strip bark from a branch section using jin pliers -> SCAR voxels.
   *
   * Steps:
   *   1. Validate branchId, pruned, segmentIndex (existing Phase 1 logic)
   *   2. Check already-jin: if jinned && segmentIndex >= jinSegmentStart
   *   3. Mark branch jinned, set jinSegmentStart
   *   4. Cascade: mark all child branches fully jinned
   *   5. Freeze is implicit (GrowthEngine/physics skip b.jinned)
   *   6. Log care entry via tree._logCare
   *   7. tree.markDirty()
   *   8. Return { ok: true }
   *
   * @param tree         The BonsaiTree instance.
   * @param branchId     Index into TreeState.branches.
   * @param segmentIndex 0-based position from trunk junction.
   * @param jinCost      jin-pliers consumables spent (>= 1). Logged only.
   */
  static applyJin(
    tree: BonsaiTree,
    branchId: number,
    segmentIndex: number,
    jinCost: number,
  ): JinResult {
    const branches = tree.getBranches();
    const b = branches[branchId];

    // -- Step 1: Input validation (unchanged from Phase 1) --
    if (!b) return { ok: false, reason: 'not-found' };
    if (b.pruned) return { ok: false, reason: 'pruned' };
    if (segmentIndex < 0 || segmentIndex >= b.length) {
      return { ok: false, reason: 'segment-out-of-range' };
    }

    // -- Step 2: Already-jin check --
    // If the branch is already jinned and the requested region is already
    // covered (segmentIndex >= jinSegmentStart), there is nothing new to do.
    if (b.jinned && segmentIndex >= b.jinSegmentStart) {
      return { ok: false, reason: 'already-jin' };
    }

    // -- Step 3: Mark branch jinned --
    // If already jinned at a higher segmentIndex, extend toward the base.
    // Otherwise, first jin on this branch.
    if (b.jinned) {
      // Extending: move jinSegmentStart lower (toward trunk junction).
      b.jinSegmentStart = segmentIndex;
    } else {
      b.jinned = true;
      b.jinSegmentStart = segmentIndex;
    }

    // -- Step 4: Cascade to children --
    // All child branches are fully jinned (they attach beyond or at the
    // deadwood zone). Use iterative stack (same pattern as PruneEngine cascade).
    const stack = [...b.children];
    while (stack.length > 0) {
      const childId = stack.pop()!;
      const child = branches[childId];
      if (!child || child.pruned) continue;
      // Skip if already fully jinned (jinSegmentStart === 0 means entire branch).
      if (child.jinned && child.jinSegmentStart === 0) continue;
      child.jinned = true;
      child.jinSegmentStart = 0; // entire child branch is deadwood
      stack.push(...child.children);
    }

    // -- Step 5: Freeze is implicit --
    // GrowthEngine and BonsaiTree.applyDailyUpdate check b.jinned to skip.
    // No additional mutation needed here.

    // -- Step 6: Log care entry --
    tree._logCare({
      day: tree.getAge(),
      action: { type: 'jin', branchId, segmentIndex, jinCost },
    });

    // -- Step 7: Mark dirty --
    tree.markDirty();

    // -- Step 8: Return success --
    // scarVoxelCount left undefined -- actual count determined at voxelization
    // time. The engine does not have voxel geometry at applyJin time.
    return { ok: true };
  }
}
