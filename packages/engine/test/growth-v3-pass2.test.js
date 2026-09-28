// growth-v3-pass2.test.js — Test probes for Growth V3 Phases 8-13.
// Spec: docs/pipeline/ARCH-GROWTH-V3-IMPLEMENTATION-2026-09-25.md
//
// Probe IDs: V3-PR01..PR09 (prune receipt), V3-SR01..SR06 (stable roles),
//            V3-SD01..SD04 (stat deriver v3), V3-CR01..CR06 (care replay v2),
//            V3-DE01..DE06 (display envelope), V3-GT01..GT04 (growth transition)
//
// Run: node --test test/growth-v3-pass2.test.js
// Framework: Node.js built-in test runner (node:test)

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  // PruneReceiptEngine
  compareVoxelOwners, sortVoxelOwners, buildVoxelCell,
  addOwnerToCell, removeOwnersFromCell,
  applyPruneStumpOverlay, packCoordinate, unpackCoordinate,
  computePruneDelta, computeCancelledEventData, computeCancelledEscrow,
  validatePruneReceiptInputs, assemblePruneReceipt,
  // StableBranchRoles
  assignDepthOneRoles, assignRoleByDepth,
  assignAllRolesAtRebaseline, assignNewbornDepthOneRoles,
  // StatDeriverV3
  deriveStructuralV3,
  // CareReplayV2
  compareCareEvents, compareDecimalStrings, sortCareEvents,
  getInfluenceScope, partitionByInfluence, computeSplice,
  validateCareEventV2,
} from '../dist/index.js';

import {
  VoxelRole,
  computeClockState, computeSeason, buildETag,
  toQ4,
} from '@kijo/shared';

// ===========================================================================
// Helper: build a minimal VoxelOwnerV2
// ===========================================================================
function mkOwner(branchId, branchDepth, sourceKind, role, ownerId) {
  return { ownerId, branchId, branchDepth, sourceKind, material: 1, role };
}

// Valid SHA-256 hex for test parameters
const VALID_HASH = 'a'.repeat(64);
const VALID_HASH_B = 'b'.repeat(64);

// ===========================================================================
// V3-PR01: VoxelOwnerV2 sorting
// ===========================================================================

test('V3-PR01a: owners sort by branchDepth first', () => {
  const a = mkOwner(1, 2, 'wood', VoxelRole.DIGIT, 'o1');
  const b = mkOwner(1, 0, 'wood', VoxelRole.TRUNK, 'o1');
  const sorted = sortVoxelOwners([a, b]);
  assert.equal(sorted[0].branchDepth, 0);
  assert.equal(sorted[1].branchDepth, 2);
});

test('V3-PR01b: owners sort by branchId second', () => {
  const a = mkOwner(5, 1, 'wood', VoxelRole.ARM, 'o1');
  const b = mkOwner(2, 1, 'wood', VoxelRole.ARM, 'o2');
  const sorted = sortVoxelOwners([a, b]);
  assert.equal(sorted[0].branchId, 2);
  assert.equal(sorted[1].branchId, 5);
});

test('V3-PR01c: owners sort by sourceKindPriority third', () => {
  const a = mkOwner(1, 0, 'canopy', VoxelRole.CANOPY, 'o1');
  const b = mkOwner(1, 0, 'root', VoxelRole.ROOT, 'o2');
  const sorted = sortVoxelOwners([a, b]);
  assert.equal(sorted[0].sourceKind, 'root');   // priority 0
  assert.equal(sorted[1].sourceKind, 'canopy'); // priority 3
});

test('V3-PR01d: owners sort by ownerId fourth', () => {
  const a = mkOwner(1, 0, 'wood', VoxelRole.TRUNK, 'zzz');
  const b = mkOwner(1, 0, 'wood', VoxelRole.TRUNK, 'aaa');
  const sorted = sortVoxelOwners([a, b]);
  assert.equal(sorted[0].ownerId, 'aaa');
  assert.equal(sorted[1].ownerId, 'zzz');
});

// ===========================================================================
// V3-PR02: VoxelCellV2 construction
// ===========================================================================

test('V3-PR02a: buildVoxelCell sorts and sets primaryOwnerIndex=0', () => {
  const owners = [
    mkOwner(5, 1, 'wood', VoxelRole.ARM, 'o2'),
    mkOwner(0, 0, 'root', VoxelRole.TRUNK, 'o1'),
  ];
  const cell = buildVoxelCell(owners);
  assert.equal(cell.primaryOwnerIndex, 0);
  assert.equal(cell.owners[0].branchDepth, 0); // trunk (depth 0) sorts first
});

test('V3-PR02b: buildVoxelCell rejects zero owners', () => {
  assert.throws(() => buildVoxelCell([]), /zero owners/);
});

test('V3-PR02c: addOwnerToCell inserts in sorted position', () => {
  const cell = buildVoxelCell([mkOwner(5, 1, 'wood', VoxelRole.ARM, 'o1')]);
  const newCell = addOwnerToCell(cell, mkOwner(0, 0, 'root', VoxelRole.TRUNK, 'o2'));
  assert.equal(newCell.owners.length, 2);
  assert.equal(newCell.owners[0].branchDepth, 0); // new owner (depth 0) sorts first
});

// ===========================================================================
// V3-PR03: Owner removal
// ===========================================================================

test('V3-PR03a: removeOwnersFromCell returns null when all removed', () => {
  const cell = buildVoxelCell([mkOwner(5, 1, 'wood', VoxelRole.ARM, 'o1')]);
  const result = removeOwnersFromCell(cell, new Set([5]));
  assert.equal(result, null);
});

test('V3-PR03b: removeOwnersFromCell preserves surviving owners', () => {
  const cell = buildVoxelCell([
    mkOwner(5, 1, 'wood', VoxelRole.ARM, 'o1'),
    mkOwner(0, 0, 'root', VoxelRole.TRUNK, 'o2'),
  ]);
  const result = removeOwnersFromCell(cell, new Set([5]));
  assert.notEqual(result, null);
  assert.equal(result.owners.length, 1);
  assert.equal(result.owners[0].branchId, 0);
});

test('V3-PR03c: removeOwnersFromCell no-op when branchId not present', () => {
  const cell = buildVoxelCell([mkOwner(5, 1, 'wood', VoxelRole.ARM, 'o1')]);
  const result = removeOwnersFromCell(cell, new Set([999]));
  assert.notEqual(result, null);
  assert.equal(result.owners.length, 1);
});

// ===========================================================================
// V3-PR04: Stump overlay
// ===========================================================================

test('V3-PR04a: applyPruneStumpOverlay adds overlay to parent cells', () => {
  const voxelMap = new Map();
  const cell = buildVoxelCell([mkOwner(0, 0, 'wood', VoxelRole.TRUNK, 'o1')]);
  voxelMap.set('0,5,0', cell);
  const count = applyPruneStumpOverlay(voxelMap, 0, ['0,5,0']);
  assert.equal(count, 1);
  assert.equal(voxelMap.get('0,5,0').presentationOverlay, 'prune-scar');
});

test('V3-PR04b: applyPruneStumpOverlay skips cells without parent owner', () => {
  const voxelMap = new Map();
  const cell = buildVoxelCell([mkOwner(5, 1, 'wood', VoxelRole.ARM, 'o1')]);
  voxelMap.set('0,5,0', cell);
  const count = applyPruneStumpOverlay(voxelMap, 0, ['0,5,0']); // parent is 0, cell has 5
  assert.equal(count, 0);
});

// ===========================================================================
// V3-PR05: Prune delta computation
// ===========================================================================

test('V3-PR05a: computePruneDelta detects removed voxels', () => {
  const pre = new Map();
  pre.set('0,0,0', buildVoxelCell([mkOwner(5, 1, 'wood', VoxelRole.ARM, 'o1')]));
  pre.set('1,0,0', buildVoxelCell([mkOwner(0, 0, 'root', VoxelRole.TRUNK, 'o2')]));
  const post = new Map();
  post.set('1,0,0', buildVoxelCell([mkOwner(0, 0, 'root', VoxelRole.TRUNK, 'o2')]));
  // 0,0,0 removed (branch 5 pruned)
  const delta = computePruneDelta(pre, post, new Set([5]));
  assert.equal(delta.removedLiveVoxelCount, 1);
  assert.equal(delta.removedOwnerClaimCount, 1);
  assert.equal(delta.overlappingSurvivingVoxelCount, 0);
});

test('V3-PR05b: computePruneDelta detects overlapping surviving voxels', () => {
  const pre = new Map();
  pre.set('0,0,0', buildVoxelCell([
    mkOwner(0, 0, 'root', VoxelRole.TRUNK, 'o1'),
    mkOwner(5, 1, 'wood', VoxelRole.ARM, 'o2'),
  ]));
  const post = new Map();
  post.set('0,0,0', buildVoxelCell([mkOwner(0, 0, 'root', VoxelRole.TRUNK, 'o1')]));
  const delta = computePruneDelta(pre, post, new Set([5]));
  assert.equal(delta.removedLiveVoxelCount, 0);
  assert.equal(delta.overlappingSurvivingVoxelCount, 1);
  assert.equal(delta.removedOwnerClaimCount, 1);
});

test('V3-PR05c: computePruneDelta counts by primary role', () => {
  const pre = new Map();
  pre.set('0,0,0', buildVoxelCell([mkOwner(5, 1, 'wood', VoxelRole.ARM, 'o1')]));
  pre.set('1,0,0', buildVoxelCell([mkOwner(5, 1, 'wood', VoxelRole.ARM, 'o2')]));
  pre.set('2,0,0', buildVoxelCell([mkOwner(6, 2, 'canopy', VoxelRole.CANOPY, 'o3')]));
  const post = new Map();
  const delta = computePruneDelta(pre, post, new Set([5, 6]));
  assert.equal(delta.removedLiveVoxelCount, 3);
  assert.equal(delta.removedLiveVoxelCountByRole[VoxelRole.ARM], 2);
  assert.equal(delta.removedLiveVoxelCountByRole[VoxelRole.CANOPY], 1);
});

// ===========================================================================
// V3-PR06: Cancelled event data
// ===========================================================================

test('V3-PR06a: computeCancelledEventData aggregates GU', () => {
  const events = [
    { eventId: 'b'.repeat(64), allocationGU: '1000' },
    { eventId: 'a'.repeat(64), allocationGU: '2000' },
  ];
  const result = computeCancelledEventData(events);
  assert.equal(result.cancelledPlannedGrowthGU, '3000');
  // Sorted by event ID
  assert.equal(result.cancelledEventIds[0], 'a'.repeat(64));
});

test('V3-PR06b: computeCancelledEscrow sums fork and canopy', () => {
  const branches = [
    { forkEscrowGU: '500', canopyEscrowGU: '300' },
    { forkEscrowGU: '200' },
  ];
  assert.equal(computeCancelledEscrow(branches), '1000');
});

test('V3-PR06c: computeCancelledEscrow handles empty', () => {
  assert.equal(computeCancelledEscrow([]), '0');
});

// ===========================================================================
// V3-PR07: Input validation (adversarial)
// ===========================================================================

test('V3-PR07a: validatePruneReceiptInputs rejects invalid careEventId', () => {
  assert.throws(() => validatePruneReceiptInputs({
    careEventId: 'not-a-hash', treeId: 'tree1', targetBranchId: 1,
    acceptedAtMs: 1000, preRevision: '1', postRevision: '2',
  }), /careEventId/);
});

test('V3-PR07b: validatePruneReceiptInputs rejects negative targetBranchId', () => {
  assert.throws(() => validatePruneReceiptInputs({
    careEventId: VALID_HASH, treeId: 'tree1', targetBranchId: -1,
    acceptedAtMs: 1000, preRevision: '1', postRevision: '2',
  }), /targetBranchId/);
});

test('V3-PR07c: validatePruneReceiptInputs rejects NaN acceptedAtMs', () => {
  assert.throws(() => validatePruneReceiptInputs({
    careEventId: VALID_HASH, treeId: 'tree1', targetBranchId: 1,
    acceptedAtMs: NaN, preRevision: '1', postRevision: '2',
  }), /acceptedAtMs/);
});

test('V3-PR07d: validatePruneReceiptInputs rejects Infinity acceptedAtMs', () => {
  assert.throws(() => validatePruneReceiptInputs({
    careEventId: VALID_HASH, treeId: 'tree1', targetBranchId: 1,
    acceptedAtMs: Infinity, preRevision: '1', postRevision: '2',
  }), /acceptedAtMs/);
});

test('V3-PR07e: validatePruneReceiptInputs rejects empty treeId', () => {
  assert.throws(() => validatePruneReceiptInputs({
    careEventId: VALID_HASH, treeId: '', targetBranchId: 1,
    acceptedAtMs: 1000, preRevision: '1', postRevision: '2',
  }), /treeId/);
});

test('V3-PR07f: validatePruneReceiptInputs rejects leading-zero revision', () => {
  assert.throws(() => validatePruneReceiptInputs({
    careEventId: VALID_HASH, treeId: 'tree1', targetBranchId: 1,
    acceptedAtMs: 1000, preRevision: '01', postRevision: '2',
  }), /preRevision/);
});

// ===========================================================================
// V3-PR08: Zero-refund enforcement
// ===========================================================================

test('V3-PR08a: assemblePruneReceipt always sets sameDayRefundGU to "0"', () => {
  const receipt = assemblePruneReceipt({
    careEventId: VALID_HASH, treeId: 'tree1', targetBranchId: 1,
    acceptedAtMs: 1000, preRevision: '1', postRevision: '2',
    preStateHash: VALID_HASH, postStateHash: VALID_HASH,
    preVoxelHash: VALID_HASH, postVoxelHash: VALID_HASH,
    removedBranchIds: [1], removedLiveVoxelCount: 5,
    removedLiveVoxelCountByRole: { [VoxelRole.ARM]: 5 },
    removedLiveVoxelDigest: VALID_HASH,
    removedOwnerClaimCount: 5,
    overlappingSurvivingVoxelCount: 0,
    overlappingSurvivingVoxelDigest: VALID_HASH,
    cancelledEventIds: [], cancelledPlannedGrowthGU: '0',
    cancelledPlannedVoxelCount: 0, cancelledEscrowGU: '0',
    preservedPruneStumpSurfaceCount: 2,
    cut: {
      parentBranchId: 0, removedBranchId: 1,
      attachmentQ4: toQ4(5.0),
      worldAnchorQ4: [0, toQ4(5.0), 0],
      tangentQ4: [0, toQ4(1.0), 0],
    },
    statsBefore: { hp: 100, power: 50, endurance: 30, ki: 20, skillSlots: 2, skillPoints: 5, wisdom: 1, matchPct: 0.5, defense: 10, stability: 8 },
    statsAfter: { hp: 80, power: 30, endurance: 30, ki: 20, skillSlots: 1, skillPoints: 5, wisdom: 1, matchPct: 0.4, defense: 10, stability: 8 },
    matchPctBefore: 0.5, matchPctAfter: 0.4,
  });
  assert.equal(receipt.sameDayRefundGU, '0');
  assert.equal(receipt.receiptVersion, 1);
});

// ===========================================================================
// V3-PR09: packCoordinate / unpackCoordinate round-trip
// ===========================================================================

test('V3-PR09a: packCoordinate/unpackCoordinate round-trip', () => {
  const packed = packCoordinate(3, -7, 12);
  const [x, y, z] = unpackCoordinate(packed);
  assert.equal(x, 3);
  assert.equal(y, -7);
  assert.equal(z, 12);
});

test('V3-PR09b: unpackCoordinate rejects malformed input', () => {
  assert.throws(() => unpackCoordinate('1,2'), /Invalid/);
});

// ===========================================================================
// V3-SR01: Stable branch role assignment — depth 0, 2+
// ===========================================================================

test('V3-SR01a: assignRoleByDepth returns trunk for depth 0', () => {
  assert.equal(assignRoleByDepth(0), 'trunk');
});

test('V3-SR01b: assignRoleByDepth returns digit for depth 2+', () => {
  assert.equal(assignRoleByDepth(2), 'digit');
  assert.equal(assignRoleByDepth(5), 'digit');
});

test('V3-SR01c: assignRoleByDepth throws for depth 1', () => {
  assert.throws(() => assignRoleByDepth(1), /depth-1/);
});

test('V3-SR01d: assignRoleByDepth rejects negative depth', () => {
  assert.throws(() => assignRoleByDepth(-1), /invalid depth/);
});

test('V3-SR01e: assignRoleByDepth rejects NaN', () => {
  assert.throws(() => assignRoleByDepth(NaN), /invalid depth/);
});

// ===========================================================================
// V3-SR02: Depth-one sibling group assignment
// ===========================================================================

test('V3-SR02a: single depth-1 child → arm', () => {
  const roles = assignDepthOneRoles([
    { branchId: 1, depth: 1, attachmentYQ4: toQ4(5.0) },
  ]);
  assert.equal(roles.get(1), 'arm');
});

test('V3-SR02b: two depth-1 children → one leg, one arm', () => {
  const roles = assignDepthOneRoles([
    { branchId: 1, depth: 1, attachmentYQ4: toQ4(5.0) },
    { branchId: 2, depth: 1, attachmentYQ4: toQ4(10.0) },
  ]);
  // Lower attachmentY → leg (ceil(2/2) = 1 leg)
  assert.equal(roles.get(1), 'leg');
  assert.equal(roles.get(2), 'arm');
});

test('V3-SR02c: three depth-1 children → 2 leg, 1 arm', () => {
  const roles = assignDepthOneRoles([
    { branchId: 1, depth: 1, attachmentYQ4: toQ4(3.0) },
    { branchId: 2, depth: 1, attachmentYQ4: toQ4(7.0) },
    { branchId: 3, depth: 1, attachmentYQ4: toQ4(10.0) },
  ]);
  // ceil(3/2) = 2 legs, floor(3/2) = 1 arm
  assert.equal(roles.get(1), 'leg');
  assert.equal(roles.get(2), 'leg');
  assert.equal(roles.get(3), 'arm');
});

test('V3-SR02d: tie-break by branchId when attachmentYQ4 equal', () => {
  const roles = assignDepthOneRoles([
    { branchId: 5, depth: 1, attachmentYQ4: toQ4(5.0) },
    { branchId: 2, depth: 1, attachmentYQ4: toQ4(5.0) },
  ]);
  // Same Y → sort by branchId: 2 first (leg), 5 second (arm)
  assert.equal(roles.get(2), 'leg');
  assert.equal(roles.get(5), 'arm');
});

test('V3-SR02e: empty sibling group → empty map', () => {
  const roles = assignDepthOneRoles([]);
  assert.equal(roles.size, 0);
});

// ===========================================================================
// V3-SR03: Full rebaseline assignment
// ===========================================================================

test('V3-SR03a: assignAllRolesAtRebaseline handles mixed depths', () => {
  const roles = assignAllRolesAtRebaseline([
    { branchId: 0, depth: 0, attachmentYQ4: 0 },
    { branchId: 1, depth: 1, attachmentYQ4: toQ4(3.0) },
    { branchId: 2, depth: 1, attachmentYQ4: toQ4(8.0) },
    { branchId: 3, depth: 2, attachmentYQ4: toQ4(1.0) },
  ]);
  assert.equal(roles.get(0), 'trunk');
  assert.equal(roles.get(1), 'leg');
  assert.equal(roles.get(2), 'arm');
  assert.equal(roles.get(3), 'digit');
});

// ===========================================================================
// V3-SD01: StatDeriverV3 structural stats
// ===========================================================================

test('V3-SD01a: deriveStructuralV3 counts by primary owner role', () => {
  const voxelMap = new Map();
  voxelMap.set('0,0,0', buildVoxelCell([mkOwner(0, 0, 'wood', VoxelRole.TRUNK, 'o1')]));
  voxelMap.set('1,0,0', buildVoxelCell([mkOwner(0, 0, 'wood', VoxelRole.TRUNK, 'o2')]));
  voxelMap.set('2,0,0', buildVoxelCell([mkOwner(1, 1, 'wood', VoxelRole.ARM, 'o3')]));
  voxelMap.set('3,0,0', buildVoxelCell([mkOwner(2, 2, 'canopy', VoxelRole.CANOPY, 'o4')]));

  const stats = deriveStructuralV3(voxelMap, 3);
  // 2 TRUNK × 0.35 = 0.7
  assert.ok(Math.abs(stats.hp - 0.7) < 0.001);
  // 1 ARM × 0.50 = 0.5
  assert.ok(Math.abs(stats.power - 0.5) < 0.001);
  // 1 CANOPY × 3.0 = 3.0
  assert.ok(Math.abs(stats.ki - 3.0) < 0.001);
  assert.equal(stats.skillSlots, 3);
});

test('V3-SD01b: deriveStructuralV3 empty map → zero stats', () => {
  const stats = deriveStructuralV3(new Map(), 0);
  assert.equal(stats.hp, 0);
  assert.equal(stats.power, 0);
  assert.equal(stats.ki, 0);
  assert.equal(stats.skillSlots, 0);
});

test('V3-SD01c: multi-owner cell uses primary role only (first in sort)', () => {
  const voxelMap = new Map();
  // Primary owner (first after sort) is trunk, second is canopy
  voxelMap.set('0,0,0', buildVoxelCell([
    mkOwner(0, 0, 'root', VoxelRole.TRUNK, 'o1'),
    mkOwner(5, 1, 'canopy', VoxelRole.CANOPY, 'o2'),
  ]));
  const stats = deriveStructuralV3(voxelMap, 0);
  // Should count as TRUNK (primary), NOT canopy
  assert.ok(stats.hp > 0);
  assert.equal(stats.ki, 0);
});

// ===========================================================================
// V3-CR01: CareEventV2 ordering
// ===========================================================================

test('V3-CR01a: compareCareEvents orders by acceptedAtMs first', () => {
  const a = { acceptedAtMs: 1000, eventSequence: '2' };
  const b = { acceptedAtMs: 2000, eventSequence: '1' };
  assert.ok(compareCareEvents(a, b) < 0);
});

test('V3-CR01b: compareCareEvents orders by eventSequence when same time', () => {
  const a = { acceptedAtMs: 1000, eventSequence: '1' };
  const b = { acceptedAtMs: 1000, eventSequence: '2' };
  assert.ok(compareCareEvents(a, b) < 0);
});

test('V3-CR01c: compareDecimalStrings handles different lengths', () => {
  assert.ok(compareDecimalStrings('9', '10') < 0); // 9 < 10
  assert.ok(compareDecimalStrings('100', '99') > 0); // 100 > 99
});

test('V3-CR01d: sortCareEvents produces canonical order', () => {
  const events = [
    { acceptedAtMs: 2000, eventSequence: '1' },
    { acceptedAtMs: 1000, eventSequence: '2' },
    { acceptedAtMs: 1000, eventSequence: '1' },
  ];
  const sorted = sortCareEvents(events);
  assert.equal(sorted[0].eventSequence, '1');
  assert.equal(sorted[0].acceptedAtMs, 1000);
  assert.equal(sorted[1].eventSequence, '2');
  assert.equal(sorted[2].acceptedAtMs, 2000);
});

// ===========================================================================
// V3-CR02: Influence scope
// ===========================================================================

test('V3-CR02a: water/fertilize → none', () => {
  assert.equal(getInfluenceScope({ type: 'water', amount: 50 }), 'none');
  assert.equal(getInfluenceScope({ type: 'fertilize' }), 'none');
});

test('V3-CR02b: prune → subtree-cancel', () => {
  assert.equal(getInfluenceScope({ type: 'prune', branchId: 1 }), 'subtree-cancel');
});

test('V3-CR02c: jin → target-cancel', () => {
  assert.equal(getInfluenceScope({ type: 'jin', branchId: 1, segmentIndex: 0, jinCost: 100 }), 'target-cancel');
});

test('V3-CR02d: rotate → direction-all', () => {
  assert.equal(getInfluenceScope({ type: 'rotate' }), 'direction-all');
});

test('V3-CR02e: wire → target-descendants', () => {
  assert.equal(getInfluenceScope({ type: 'wire', branchId: 1, angleDelta: 5 }), 'target-descendants');
});

test('V3-CR02f: unknown action type throws', () => {
  assert.throws(() => getInfluenceScope({ type: 'invalid_action' }), /unknown action type/);
});

// ===========================================================================
// V3-CR03: Influence partitioning
// ===========================================================================

test('V3-CR03a: none scope retains all events', () => {
  const events = [{ branchId: 1, kind: 'extend' }, { branchId: 2, kind: 'extend' }];
  const { retained, affected } = partitionByInfluence(events, 'none', 1, new Set([1]));
  assert.equal(retained.length, 2);
  assert.equal(affected.length, 0);
});

test('V3-CR03b: subtree-cancel cancels subtree events only', () => {
  const events = [{ branchId: 1, kind: 'extend' }, { branchId: 2, kind: 'extend' }];
  const { retained, affected } = partitionByInfluence(events, 'subtree-cancel', 1, new Set([1]));
  assert.equal(retained.length, 1);
  assert.equal(retained[0].branchId, 2);
  assert.equal(affected.length, 1);
  assert.equal(affected[0].branchId, 1);
});

test('V3-CR03c: direction-all affects all events', () => {
  const events = [{ branchId: 1 }, { branchId: 2 }];
  const { retained, affected } = partitionByInfluence(events, 'direction-all', 1, new Set());
  assert.equal(retained.length, 0);
  assert.equal(affected.length, 2);
});

// ===========================================================================
// V3-CR04: CareEventV2 validation
// ===========================================================================

test('V3-CR04a: validateCareEventV2 accepts valid event', () => {
  assert.equal(validateCareEventV2({
    schemaVersion: 2, careEventId: 'test', treeId: 'tree1',
    acceptedAtMs: 1000, eventSequence: '1', baseRevision: '0',
    committedRevision: '1', idempotencyKey: 'key', action: { type: 'water', amount: 50 },
  }), null);
});

test('V3-CR04b: validateCareEventV2 rejects wrong schema version', () => {
  assert.notEqual(validateCareEventV2({
    schemaVersion: 1, careEventId: 'test', treeId: 'tree1',
    acceptedAtMs: 1000, eventSequence: '1', baseRevision: '0',
    committedRevision: '1', idempotencyKey: 'key', action: { type: 'water', amount: 50 },
  }), null);
});

test('V3-CR04c: validateCareEventV2 rejects NaN acceptedAtMs', () => {
  assert.notEqual(validateCareEventV2({
    schemaVersion: 2, careEventId: 'test', treeId: 'tree1',
    acceptedAtMs: NaN, eventSequence: '1', baseRevision: '0',
    committedRevision: '1', idempotencyKey: 'key', action: { type: 'water', amount: 50 },
  }), null);
});

test('V3-CR04d: validateCareEventV2 rejects null', () => {
  assert.notEqual(validateCareEventV2(null), null);
});

// ===========================================================================
// V3-DE01: Display envelope helpers
// ===========================================================================

test('V3-DE01a: computeClockState basic', () => {
  const born = 0;
  const now = 14_400_000; // exactly 1 segment in
  const clock = computeClockState(now, born);
  assert.notEqual(clock, null);
  assert.equal(clock.dayIndex, 0);
  assert.equal(clock.segmentIndex, 1);
});

test('V3-DE01b: computeClockState returns null before birth', () => {
  assert.equal(computeClockState(0, 1000), null);
});

test('V3-DE01c: computeSeason cycles correctly', () => {
  assert.equal(computeSeason(0), 'spring');
  assert.equal(computeSeason(89), 'spring');
  assert.equal(computeSeason(90), 'summer');
  assert.equal(computeSeason(180), 'autumn');
  assert.equal(computeSeason(270), 'winter');
  assert.equal(computeSeason(360), 'spring'); // wrap
});

test('V3-DE01d: buildETag format', () => {
  const etag = buildETag('tree-123', '42', 'plan-abc');
  assert.equal(etag, 'tree:tree-123:rev:42:plan:plan-abc');
});

// ===========================================================================
// V3-DE02: Clock sample helpers (import from build file not possible in test,
// but we can test the shared clock functions used by the envelope)
// ===========================================================================

test('V3-DE02a: computeClockState day boundary', () => {
  const born = 0;
  const dayMs = 28_800_000; // GAME_DAY_MS
  const clock = computeClockState(dayMs, born);
  assert.equal(clock.dayIndex, 1);
  assert.equal(clock.segmentIndex, 0);
});

test('V3-DE02b: computeClockState multi-day', () => {
  const born = 0;
  const clock = computeClockState(28_800_000 * 5 + 14_400_000, born);
  assert.equal(clock.dayIndex, 5);
  assert.equal(clock.segmentIndex, 1);
});

// ===========================================================================
// V3-GT01: Growth transition validation (adversarial inputs)
// ===========================================================================
// These test the shared validators used by the transition flow

test('V3-GT01a: toQ4 negative preserved', () => {
  assert.equal(toQ4(-1.5), -15000);
});

test('V3-GT01b: toQ4 zero', () => {
  assert.equal(toQ4(0), 0);
});
