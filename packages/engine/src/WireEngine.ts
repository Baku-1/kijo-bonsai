import { round4 } from '@kijo/shared';
import type { CareLogEntry } from '@kijo/shared';
import type { BonsaiTree } from './BonsaiTree.js';

/**
 * WireEngine — stateless wire-bend logic ("Gu Ahao's Tied and Cut Toolkit").
 *
 * Same pattern as PruneEngine: BonsaiTree.wire() delegates here; CareLogReplay
 * calls this directly on replay so wired angles are faithfully reconstructed.
 * Replay TRUSTS the log — validation rules below gate live play only.
 *
 * Rules (GDD s3.2 + owner directives 2026-07-19):
 *   - Depth-1 only: trunk too thick, depth-2+ too fragile.
 *   - Thickness limit: above WIRE_MAX_THICKNESS the branch cannot be wired at
 *     all (real bonsai: thick caliper needs a jack/rebar, not wire).
 *   - Bend is caregiver-chosen, clamped to +/-WIRE_MAX_ANGLE_DELTA per action
 *     and to the voxelizer's valid polar range [0.1, 1.4] rad.
 *   - Wire is a consumable: cost scales with branch thickness
 *     (thin = 1 wire, thick = 2). Multi-wire / purchase flow = later phase.
 *   - Wire removes NO voxels and changes NO branch counts — same mass,
 *     new spatial direction. Logged with full angle history.
 */

// First-pass tuning values — flagged for playtest (DECISIONS.md 2026-07-19).
export const WIRE_MAX_ANGLE_DELTA = 45;  // degrees per wire action (GDD s3.2)
export const WIRE_MAX_THICKNESS = 3.0;   // voxel units; above = too thick to wire
export const WIRE_COST_T1_MAX = 1.5;     // thickness <= this costs 1 wire, else 2

// Voxelizer polar clamp [0.1, 1.4] rad, in degrees. For depth-1 branches the
// parent is the trunk (straight up), so branch angle == polar angle.
const POLAR_MIN_DEG = 5.7296;  // 0.1 rad
const POLAR_MAX_DEG = 80.2141; // 1.4 rad

export type WireRejectReason = 'not-found' | 'pruned' | 'not-depth-1' | 'too-thick';

export interface WireResult {
  ok: boolean;
  reason?: WireRejectReason;
  wireCost?: number;
  oldAngle?: number;
  newAngle?: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export class WireEngine {
  /** Wire cost for a branch of the given thickness. Thickness-tiered. */
  static wireCostFor(thickness: number): number {
    return thickness <= WIRE_COST_T1_MAX ? 1 : 2;
  }

  /**
   * Bend a depth-1 branch by angleDelta degrees (signed, caregiver-chosen).
   *
   * Returns { ok: false, reason } (no-op) when:
   *   - branchId out of range
   *   - branch is pruned
   *   - branch is not depth 1
   *   - branch thickness > WIRE_MAX_THICKNESS
   *
   * On success: clamps delta to +/-45 and the result to the polar range,
   * applies round4, pushes the care-log entry, marks the tree dirty.
   */
  static wire(tree: BonsaiTree, branchId: number, angleDelta: number): WireResult {
    const branches = tree.getBranches();
    const b = branches[branchId];
    if (!b) return { ok: false, reason: 'not-found' };
    if (b.pruned) return { ok: false, reason: 'pruned' };
    if (b.depth !== 1) return { ok: false, reason: 'not-depth-1' };
    if (b.thickness > WIRE_MAX_THICKNESS) return { ok: false, reason: 'too-thick' };

    const oldAngle = b.angle;
    const delta = round4(clamp(angleDelta, -WIRE_MAX_ANGLE_DELTA, WIRE_MAX_ANGLE_DELTA));
    const newAngle = round4(clamp(oldAngle + delta, POLAR_MIN_DEG, POLAR_MAX_DEG));
    const appliedDelta = round4(newAngle - oldAngle);
    const wireCost = WireEngine.wireCostFor(b.thickness);

    b.angle = newAngle;

    const entry: CareLogEntry = {
      day: tree.getAge(),
      action: { type: 'wire', branchId, angleDelta: appliedDelta, oldAngle, newAngle, wireCost },
    };
    tree.getCareLog().push(entry);
    tree.markDirty();

    return { ok: true, wireCost, oldAngle, newAngle };
  }
}
