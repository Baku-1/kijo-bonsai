import type { JinResult } from '@kijo/shared';
import type { BonsaiTree } from './BonsaiTree.js';
import { CareLogReplayError } from './errors.js';

/**
 * JinEngine — stateless jin-pliers logic.
 * Pattern: stateless class, same as WireEngine / PruneEngine.
 *
 * Jin permanently converts bark segments to SCAR voxels (VoxelRole.SCAR),
 * granting a Defense bonus and qualifying the Jin overlay for TechniqueClassifier.
 * Jin is irreversible and is a premium action (costs jinCost consumables).
 *
 * Phase 1 stub: validates inputs only. Full voxelization in Phase 2 (when
 * VoxelManager integration is available).
 *
 * Specification: ARCHITECT-BRANCH-PHYSICS-2026-08-01.md Part B (applyJin stub).
 */
export class JinEngine {

  /**
   * Strip bark from a branch section using jin pliers → SCAR voxels.
   * Phase 1 stub — input validation only; voxelization in Phase 2.
   *
   * Returns { ok: false, reason } when:
   *   - branchId out of range → 'not-found'
   *   - branch.pruned === true → 'pruned'
   *   - segmentIndex out of [0, branch.length) → 'segment-out-of-range'
   *
   * @param tree         The BonsaiTree instance.
   * @param branchId     Index into TreeState.branches.
   * @param segmentIndex 0-based voxel segment position from trunk junction.
   * @param jinCost      Number of jin-pliers consumables spent (≥1).
   */
  static applyJin(tree: BonsaiTree, branchId: number, segmentIndex: number, jinCost: number): JinResult {
    const branches = tree.getBranches();
    const b = branches[branchId];
    if (!b) return { ok: false, reason: 'not-found' };
    if (b.pruned) return { ok: false, reason: 'pruned' };
    if (segmentIndex < 0 || segmentIndex >= b.length) {
      return { ok: false, reason: 'segment-out-of-range' };
    }

    // Phase 1 stub: validates inputs and returns stub success.
    // TODO Phase 2: convert bark voxels from segmentIndex to tip to VoxelRole.SCAR,
    //   freeze branch angle (deadwood), increment jinCount, log care entry, markDirty.
    void jinCost; // acknowledged; used in care log in Phase 2

    // Major-3 fix (2026-08-02): throw CareLogReplayError, not plain Error.
    throw new CareLogReplayError('JinEngine.applyJin: Phase 1 stub — voxelization in Phase 2.');
  }
}
