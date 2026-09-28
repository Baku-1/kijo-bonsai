/**
 * Prune Receipt Engine — Multi-owner voxel cells and prune receipt computation.
 *
 * Handles:
 * - VoxelOwnerV2 sorting per §8.1
 * - VoxelCellV2 management (multi-owner coordinate map)
 * - PruneReceiptV1 delta computation per §8.4
 * - Stump overlay per §8.3
 * - Zero same-day refund enforcement
 *
 * Spec: ARCH-GROWTH-V3-IMPLEMENTATION-2026-09-25.md §8.
 *
 * @module @kijo/engine/PruneReceiptEngine
 */

import type {
  VoxelOwnerV2,
  VoxelCellV2,
  PruneReceiptV1,
  VoxelSourceKind,
  StatSheet,
} from '@kijo/shared';
import {
  VoxelRole,
  VOXEL_SOURCE_KIND_PRIORITY,
  isValidSafeInteger,
  isValidNonNegativeInteger,
  isValidSha256Hex,
} from '@kijo/shared';

// ═══════════════════════════════════════════════════════════════════════════
// §8.1 — Owner sorting
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compare two VoxelOwnerV2 records for deterministic ordering.
 * Sort key: (branchDepth ASC, branchId ASC, sourceKindPriority ASC, ownerId ASC).
 *
 * This ordering is independent of traversal and persists when one owner is removed.
 */
export function compareVoxelOwners(a: VoxelOwnerV2, b: VoxelOwnerV2): number {
  if (a.branchDepth !== b.branchDepth) return a.branchDepth - b.branchDepth;
  if (a.branchId !== b.branchId) return a.branchId - b.branchId;
  const aPri = VOXEL_SOURCE_KIND_PRIORITY[a.sourceKind] ?? 99;
  const bPri = VOXEL_SOURCE_KIND_PRIORITY[b.sourceKind] ?? 99;
  if (aPri !== bPri) return aPri - bPri;
  if (a.ownerId < b.ownerId) return -1;
  if (a.ownerId > b.ownerId) return 1;
  return 0;
}

/**
 * Sort an array of VoxelOwnerV2 in canonical order.
 * Returns a new sorted array (does not mutate input).
 */
export function sortVoxelOwners(owners: readonly VoxelOwnerV2[]): VoxelOwnerV2[] {
  return [...owners].sort(compareVoxelOwners);
}

/**
 * Build a VoxelCellV2 from a list of owners.
 * Owners are sorted canonically; primaryOwnerIndex is always 0 (first in sort order).
 */
export function buildVoxelCell(
  owners: readonly VoxelOwnerV2[],
  presentationOverlay?: 'prune-scar',
): VoxelCellV2 {
  if (owners.length === 0) {
    throw new Error('PruneReceiptEngine: cannot build VoxelCellV2 with zero owners');
  }
  const sorted = sortVoxelOwners(owners);
  const cell: VoxelCellV2 = {
    owners: sorted,
    primaryOwnerIndex: 0,
    ...(presentationOverlay ? { presentationOverlay } : {}),
  };
  return cell;
}

/**
 * Add an owner to an existing VoxelCellV2.
 * Returns a new cell with the owner inserted in sorted position.
 * §8.1: "An already-owned candidate can gain another owner but cannot replace it."
 */
export function addOwnerToCell(
  cell: Readonly<VoxelCellV2>,
  newOwner: VoxelOwnerV2,
): VoxelCellV2 {
  const owners = [...cell.owners, newOwner];
  const sorted = sortVoxelOwners(owners);
  return {
    owners: sorted,
    primaryOwnerIndex: 0,
    ...(cell.presentationOverlay ? { presentationOverlay: cell.presentationOverlay } : {}),
  };
}

/**
 * Remove all owners matching a set of branch IDs from a VoxelCellV2.
 * Returns the new cell (or null if no owners remain → coordinate is dead).
 * §8.4: "A coordinate is live while at least one live owner remains."
 */
export function removeOwnersFromCell(
  cell: Readonly<VoxelCellV2>,
  removedBranchIds: ReadonlySet<number>,
): VoxelCellV2 | null {
  const surviving = cell.owners.filter(o => !removedBranchIds.has(o.branchId));
  if (surviving.length === 0) return null;
  // Re-sort to ensure canonical order after removal
  const sorted = sortVoxelOwners(surviving);
  return {
    owners: sorted,
    primaryOwnerIndex: 0,
    ...(cell.presentationOverlay ? { presentationOverlay: cell.presentationOverlay } : {}),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// §8.3 — Stump overlay
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Apply prune-scar presentation overlay to cells at the cut site.
 * §8.3: "Those cells receive presentationOverlay: prune-scar; no new structural voxel is created."
 * "The role remains the parent's role and grants no Defense."
 *
 * @param voxelMap - mutable coordinate map of VoxelCellV2 cells
 * @param parentBranchId - the surviving parent branch
 * @param cutCoordinates - coordinates at the cut plane (from parent cells intersecting attachment)
 * @returns count of cells that received the prune-scar overlay
 */
export function applyPruneStumpOverlay(
  voxelMap: Map<string, VoxelCellV2>,
  parentBranchId: number,
  cutCoordinates: readonly string[],
): number {
  let count = 0;
  for (const coordKey of cutCoordinates) {
    const cell = voxelMap.get(coordKey);
    if (!cell) continue;
    // Only overlay cells owned by the parent branch
    const hasParentOwner = cell.owners.some(o => o.branchId === parentBranchId);
    if (!hasParentOwner) continue;
    // Apply overlay without changing role or material
    voxelMap.set(coordKey, {
      owners: cell.owners,
      primaryOwnerIndex: cell.primaryOwnerIndex,
      presentationOverlay: 'prune-scar',
    });
    count++;
  }
  return count;
}

// ═══════════════════════════════════════════════════════════════════════════
// §8.4 — Prune receipt delta computation
// ═══════════════════════════════════════════════════════════════════════════

/** Packed coordinate key for deterministic sorting. */
export function packCoordinate(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

/** Unpack a coordinate key. */
export function unpackCoordinate(key: string): [number, number, number] {
  const parts = key.split(',');
  if (parts.length !== 3) throw new Error(`Invalid packed coordinate: ${key}`);
  return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
}

/**
 * Compute the prune delta between pre and post voxel maps.
 *
 * §8.4 rules:
 * - A removed live voxel: coordinate live in pre and absent in post.
 *   Count uses its pre primary role.
 * - An overlapping surviving voxel: had at least one removed owner in pre
 *   and at least one live owner in post. Not in removed counts.
 * - removedOwnerClaimCount exposes resolution loss hidden by unique-coordinate count.
 *
 * @returns delta data for receipt construction
 */
export function computePruneDelta(
  preVoxelMap: ReadonlyMap<string, Readonly<VoxelCellV2>>,
  postVoxelMap: ReadonlyMap<string, Readonly<VoxelCellV2>>,
  removedBranchIds: ReadonlySet<number>,
): {
  removedLiveVoxelCount: number;
  removedLiveVoxelCountByRole: Record<string, number>;
  removedOwnerClaimCount: number;
  overlappingSurvivingVoxelCount: number;
  removedCoordRecords: Array<{ coord: string; prePrimaryRole: string; removedSourceBranchIds: number[] }>;
  overlappingRecords: Array<{ coord: string; removedOwnerIds: string[]; survivingOwnerIds: string[] }>;
} {
  let removedLiveVoxelCount = 0;
  const removedLiveVoxelCountByRole: Record<string, number> = {};
  let removedOwnerClaimCount = 0;
  let overlappingSurvivingVoxelCount = 0;

  const removedCoordRecords: Array<{
    coord: string;
    prePrimaryRole: string;
    removedSourceBranchIds: number[];
  }> = [];

  const overlappingRecords: Array<{
    coord: string;
    removedOwnerIds: string[];
    survivingOwnerIds: string[];
  }> = [];

  // Sort coordinate keys for deterministic processing
  const allPreCoords = [...preVoxelMap.keys()].sort();

  for (const coordKey of allPreCoords) {
    const preCell = preVoxelMap.get(coordKey)!;
    const postCell = postVoxelMap.get(coordKey);

    // Count removed owner claims at this coordinate
    const removedOwners = preCell.owners.filter(o => removedBranchIds.has(o.branchId));
    if (removedOwners.length === 0) continue;

    removedOwnerClaimCount += removedOwners.length;

    if (!postCell || postCell.owners.length === 0) {
      // §8.4: coordinate absent in post → removed live voxel
      removedLiveVoxelCount++;
      const primaryRole = preCell.owners[preCell.primaryOwnerIndex].role;
      const roleKey = String(primaryRole);
      removedLiveVoxelCountByRole[roleKey] = (removedLiveVoxelCountByRole[roleKey] ?? 0) + 1;

      const branchIds = [...new Set(removedOwners.map(o => o.branchId))].sort((a, b) => a - b);
      removedCoordRecords.push({
        coord: coordKey,
        prePrimaryRole: roleKey,
        removedSourceBranchIds: branchIds,
      });
    } else {
      // §8.4: at least one removed owner + at least one surviving owner → overlapping
      const survivingOwners = postCell.owners;
      if (survivingOwners.length > 0) {
        overlappingSurvivingVoxelCount++;
        overlappingRecords.push({
          coord: coordKey,
          removedOwnerIds: removedOwners.map(o => o.ownerId).sort(),
          survivingOwnerIds: survivingOwners.map(o => o.ownerId).sort(),
        });
      }
    }
  }

  // Sort records for deterministic output
  removedCoordRecords.sort((a, b) => a.coord < b.coord ? -1 : a.coord > b.coord ? 1 : 0);
  overlappingRecords.sort((a, b) => a.coord < b.coord ? -1 : a.coord > b.coord ? 1 : 0);

  return {
    removedLiveVoxelCount,
    removedLiveVoxelCountByRole,
    removedOwnerClaimCount,
    overlappingSurvivingVoxelCount,
    removedCoordRecords,
    overlappingRecords,
  };
}

/**
 * Compute cancelled event data for the prune receipt.
 *
 * §8.4: cancelledPlannedGrowthGU is the total allocationGU of cancelled events.
 * cancelledPlannedVoxelCount is the count of future unique coordinates.
 *
 * @param cancelledEvents - growth events cancelled by the prune
 * @returns cancelled aggregate data
 */
export function computeCancelledEventData(
  cancelledEvents: ReadonlyArray<{ eventId: string; allocationGU: string }>,
): {
  cancelledEventIds: string[];
  cancelledPlannedGrowthGU: string;
} {
  const cancelledEventIds = cancelledEvents.map(e => e.eventId).sort();

  let totalGU = 0n;
  for (const evt of cancelledEvents) {
    totalGU += BigInt(evt.allocationGU);
  }

  return {
    cancelledEventIds,
    cancelledPlannedGrowthGU: totalGU.toString(),
  };
}

/**
 * Compute cancelled escrow data for the prune receipt.
 * §5.4.1 rule 4: "prune/jin cancellation zeroes escrow"
 *
 * @param removedBranches - branches being pruned with their escrow state
 * @returns total cancelled escrow as decimal string
 */
export function computeCancelledEscrow(
  removedBranches: ReadonlyArray<{
    forkEscrowGU?: string;
    canopyEscrowGU?: string;
  }>,
): string {
  let totalEscrow = 0n;
  for (const branch of removedBranches) {
    if (branch.forkEscrowGU) totalEscrow += BigInt(branch.forkEscrowGU);
    if (branch.canopyEscrowGU) totalEscrow += BigInt(branch.canopyEscrowGU);
  }
  return totalEscrow.toString();
}

// ═══════════════════════════════════════════════════════════════════════════
// §8.4 — Input validation guards (Web3 real currency)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate prune receipt inputs.
 * Every parameter is guarded — Web3 real currency at stake.
 *
 * @throws on any invalid input
 */
export function validatePruneReceiptInputs(params: {
  careEventId: string;
  treeId: string;
  targetBranchId: number;
  acceptedAtMs: number;
  preRevision: string;
  postRevision: string;
}): void {
  if (!isValidSha256Hex(params.careEventId)) {
    throw new Error('PruneReceiptEngine: invalid careEventId — must be SHA-256 hex');
  }
  if (typeof params.treeId !== 'string' || params.treeId.length === 0) {
    throw new Error('PruneReceiptEngine: treeId must be non-empty string');
  }
  if (!isValidNonNegativeInteger(params.targetBranchId)) {
    throw new Error(`PruneReceiptEngine: invalid targetBranchId (${params.targetBranchId})`);
  }
  if (!isValidSafeInteger(params.acceptedAtMs) || params.acceptedAtMs < 0) {
    throw new Error(`PruneReceiptEngine: invalid acceptedAtMs (${params.acceptedAtMs})`);
  }
  if (!/^(0|[1-9][0-9]*)$/.test(params.preRevision)) {
    throw new Error(`PruneReceiptEngine: invalid preRevision (${params.preRevision})`);
  }
  if (!/^(0|[1-9][0-9]*)$/.test(params.postRevision)) {
    throw new Error(`PruneReceiptEngine: invalid postRevision (${params.postRevision})`);
  }
}

/**
 * Assemble a PruneReceiptV1 from computed deltas.
 *
 * §8.4: "sameDayRefundGU is always '0' — no same-day refund in V3."
 * All digest hashes are provided by the caller (who has access to CanonicalHash).
 */
export function assemblePruneReceipt(params: {
  careEventId: string;
  treeId: string;
  targetBranchId: number;
  acceptedAtMs: number;
  preRevision: string;
  postRevision: string;
  preStateHash: string;
  postStateHash: string;
  preVoxelHash: string;
  postVoxelHash: string;
  removedBranchIds: readonly number[];
  removedLiveVoxelCount: number;
  removedLiveVoxelCountByRole: Readonly<Record<string, number>>;
  removedLiveVoxelDigest: string;
  removedOwnerClaimCount: number;
  overlappingSurvivingVoxelCount: number;
  overlappingSurvivingVoxelDigest: string;
  cancelledEventIds: readonly string[];
  cancelledPlannedGrowthGU: string;
  cancelledPlannedVoxelCount: number;
  cancelledEscrowGU: string;
  preservedPruneStumpSurfaceCount: number;
  cut: {
    parentBranchId: number;
    removedBranchId: number;
    attachmentQ4: number;
    worldAnchorQ4: readonly [number, number, number];
    tangentQ4: readonly [number, number, number];
  };
  statsBefore: StatSheet;
  statsAfter: StatSheet;
  matchPctBefore: number;
  matchPctAfter: number;
}): PruneReceiptV1 {
  // Validate core inputs
  validatePruneReceiptInputs({
    careEventId: params.careEventId,
    treeId: params.treeId,
    targetBranchId: params.targetBranchId,
    acceptedAtMs: params.acceptedAtMs,
    preRevision: params.preRevision,
    postRevision: params.postRevision,
  });

  // Validate hash fields
  for (const field of ['preStateHash', 'postStateHash', 'preVoxelHash', 'postVoxelHash',
                        'removedLiveVoxelDigest', 'overlappingSurvivingVoxelDigest'] as const) {
    if (!isValidSha256Hex(params[field])) {
      throw new Error(`PruneReceiptEngine: invalid ${field} — must be SHA-256 hex`);
    }
  }

  // Validate non-negative counts
  for (const field of ['removedLiveVoxelCount', 'removedOwnerClaimCount',
                        'overlappingSurvivingVoxelCount', 'cancelledPlannedVoxelCount',
                        'preservedPruneStumpSurfaceCount'] as const) {
    if (!isValidNonNegativeInteger(params[field])) {
      throw new Error(`PruneReceiptEngine: invalid ${field} (${params[field]})`);
    }
  }

  // Validate decimal strings
  for (const field of ['cancelledPlannedGrowthGU', 'cancelledEscrowGU'] as const) {
    if (!/^(0|[1-9][0-9]*)$/.test(params[field])) {
      throw new Error(`PruneReceiptEngine: invalid ${field} (${params[field]})`);
    }
  }

  // Validate sorted arrays
  const sortedBranchIds = [...params.removedBranchIds].sort((a, b) => a - b);
  const sortedEventIds = [...params.cancelledEventIds].sort();

  return {
    receiptVersion: 1,
    careEventId: params.careEventId,
    treeId: params.treeId,
    targetBranchId: params.targetBranchId,
    acceptedAtMs: params.acceptedAtMs,
    preRevision: params.preRevision,
    postRevision: params.postRevision,
    preStateHash: params.preStateHash,
    postStateHash: params.postStateHash,
    preVoxelHash: params.preVoxelHash,
    postVoxelHash: params.postVoxelHash,
    removedBranchIds: sortedBranchIds,
    removedLiveVoxelCount: params.removedLiveVoxelCount,
    removedLiveVoxelCountByRole: params.removedLiveVoxelCountByRole,
    removedLiveVoxelDigest: params.removedLiveVoxelDigest,
    removedOwnerClaimCount: params.removedOwnerClaimCount,
    overlappingSurvivingVoxelCount: params.overlappingSurvivingVoxelCount,
    overlappingSurvivingVoxelDigest: params.overlappingSurvivingVoxelDigest,
    cancelledEventIds: sortedEventIds,
    cancelledPlannedGrowthGU: params.cancelledPlannedGrowthGU,
    cancelledPlannedVoxelCount: params.cancelledPlannedVoxelCount,
    cancelledEscrowGU: params.cancelledEscrowGU,
    sameDayRefundGU: '0',
    preservedPruneStumpSurfaceCount: params.preservedPruneStumpSurfaceCount,
    cut: params.cut,
    statsBefore: params.statsBefore,
    statsAfter: params.statsAfter,
    matchPctBefore: params.matchPctBefore,
    matchPctAfter: params.matchPctAfter,
  };
}
