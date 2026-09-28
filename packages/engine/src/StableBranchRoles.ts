/**
 * Stable Branch Role Assignment — §9.1
 *
 * Assigns immutable stableRole to every branch at birth or rebaseline.
 * Once assigned, roles never change — even after pruning siblings.
 *
 * Rules:
 * - Trunk is always 'trunk'.
 * - Depth 2+ are always 'digit'.
 * - At a depth-one fork, classify the newborn sibling group by
 *   (attachmentYQ4, branchId). One child → 'arm'. Two+ → lower ceil(n/2)
 *   are 'leg', upper floor(n/2) are 'arm'.
 * - Existing depth-one branches receive the same sort once at rebaseline.
 *   The result is then frozen.
 * - A later fork classifies only its newborn sibling group; it never
 *   re-ranks older branches.
 *
 * Spec: ARCH-GROWTH-V3-IMPLEMENTATION-2026-09-25.md §9.1
 *
 * @module @kijo/engine/StableBranchRoles
 */

import type { StableBranchRole } from '@kijo/shared';
import { isValidNonNegativeInteger, isValidSafeInteger } from '@kijo/shared';

// ═══════════════════════════════════════════════════════════════════════════
// §9.1 — Branch descriptor for role assignment
// ═══════════════════════════════════════════════════════════════════════════

export interface BranchRoleInput {
  readonly branchId: number;
  readonly depth: number;
  /** q4-encoded attachment Y coordinate (for depth-1 sorting). */
  readonly attachmentYQ4: number;
}

/**
 * Assign stable roles to a set of depth-1 branches (a sibling group).
 *
 * Sort by (attachmentYQ4 ASC, branchId ASC).
 * One child → 'arm'.
 * Two+ → lower ceil(n/2) are 'leg', upper floor(n/2) are 'arm'.
 *
 * @param siblings - depth-1 branches in the sibling group (must all be depth 1)
 * @returns Map of branchId → StableBranchRole
 */
export function assignDepthOneRoles(
  siblings: readonly BranchRoleInput[],
): Map<number, StableBranchRole> {
  if (siblings.length === 0) return new Map();

  // Validate all are depth 1
  for (const s of siblings) {
    if (s.depth !== 1) {
      throw new Error(`StableBranchRoles: expected depth 1, got depth ${s.depth} for branch ${s.branchId}`);
    }
    if (!isValidNonNegativeInteger(s.branchId)) {
      throw new Error(`StableBranchRoles: invalid branchId ${s.branchId}`);
    }
    if (!isValidSafeInteger(s.attachmentYQ4)) {
      throw new Error(`StableBranchRoles: invalid attachmentYQ4 ${s.attachmentYQ4} for branch ${s.branchId}`);
    }
  }

  // Sort by (attachmentYQ4 ASC, branchId ASC)
  const sorted = [...siblings].sort((a, b) => {
    if (a.attachmentYQ4 !== b.attachmentYQ4) return a.attachmentYQ4 - b.attachmentYQ4;
    return a.branchId - b.branchId;
  });

  const n = sorted.length;
  const result = new Map<number, StableBranchRole>();

  if (n === 1) {
    // Single child → arm
    result.set(sorted[0].branchId, 'arm');
  } else {
    // Lower ceil(n/2) → leg, upper floor(n/2) → arm
    const legCount = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) {
      result.set(sorted[i].branchId, i < legCount ? 'leg' : 'arm');
    }
  }

  return result;
}

/**
 * Assign stable role for a single branch based on its depth.
 *
 * - depth 0 (trunk) → 'trunk'
 * - depth 1 → must use assignDepthOneRoles for the sibling group
 * - depth 2+ → 'digit'
 *
 * @throws if depth is 1 (must use sibling group assignment)
 */
export function assignRoleByDepth(depth: number): StableBranchRole {
  if (!isValidNonNegativeInteger(depth)) {
    throw new Error(`StableBranchRoles: invalid depth ${depth}`);
  }
  if (depth === 0) return 'trunk';
  if (depth === 1) {
    throw new Error('StableBranchRoles: depth-1 branches must use assignDepthOneRoles with sibling group');
  }
  return 'digit';
}

/**
 * Assign stable roles to all branches in a tree at rebaseline time.
 *
 * Groups depth-1 branches, sorts and assigns arm/leg. Trunk → 'trunk'.
 * Depth-2+ → 'digit'. Results are frozen after assignment.
 *
 * @param branches - all living branches in the tree
 * @returns Map of branchId → StableBranchRole
 */
export function assignAllRolesAtRebaseline(
  branches: readonly BranchRoleInput[],
): Map<number, StableBranchRole> {
  const result = new Map<number, StableBranchRole>();

  // Separate by depth
  const depthOneBranches: BranchRoleInput[] = [];

  for (const b of branches) {
    if (b.depth === 0) {
      result.set(b.branchId, 'trunk');
    } else if (b.depth === 1) {
      depthOneBranches.push(b);
    } else {
      result.set(b.branchId, 'digit');
    }
  }

  // Assign depth-1 roles as a group
  if (depthOneBranches.length > 0) {
    const depthOneRoles = assignDepthOneRoles(depthOneBranches);
    for (const [id, role] of depthOneRoles) {
      result.set(id, role);
    }
  }

  return result;
}

/**
 * Assign roles to a newly forked sibling group (depth-1 only).
 * §9.1: "A later fork classifies only its newborn sibling group;
 * it never re-ranks older branches."
 *
 * @param newborns - the newly created depth-1 branches from this fork
 * @returns Map of branchId → StableBranchRole
 */
export function assignNewbornDepthOneRoles(
  newborns: readonly BranchRoleInput[],
): Map<number, StableBranchRole> {
  // Newborns at depth 1 get arm/leg assignment
  // Newborns at depth 2+ get 'digit'
  const depthOne = newborns.filter(b => b.depth === 1);
  const result = new Map<number, StableBranchRole>();

  // Non-depth-1 newborns
  for (const b of newborns) {
    if (b.depth !== 1) {
      result.set(b.branchId, b.depth === 0 ? 'trunk' : 'digit');
    }
  }

  // Depth-1 newborns as a group
  if (depthOne.length > 0) {
    const roles = assignDepthOneRoles(depthOne);
    for (const [id, role] of roles) {
      result.set(id, role);
    }
  }

  return result;
}
