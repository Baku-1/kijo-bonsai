import { round4 } from '@kijo/shared';
import type { CareLogEntry } from '@kijo/shared';
import type { BonsaiTree } from './BonsaiTree.js';
import { computeSetDays } from './TwineWeightEngine.js';

/**
 * WireEngine — stateless wire-bend logic ("Gu Ahao's Tied and Cut Toolkit").
 *
 * Same pattern as PruneEngine: BonsaiTree.wire() delegates here; CareLogReplay
 * calls this directly on replay so wired angles are faithfully reconstructed.
 * Replay TRUSTS the log — validation rules below gate live play only.
 *
 * Rules (GDD s3.2 + owner directives 2026-07-19, updated 2026-07-31):
 *   - Any branch at any depth, including trunk, can be wired (OQ-1 resolution 2026-07-31).
 *     Trunk wiring is required for Kengai (Cascade) style.
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

export type WireRejectReason = 'not-found' | 'pruned' | 'too-thick';

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
   * Bend a branch by angleDelta degrees (signed, caregiver-chosen).
   * Any branch at any depth, including the trunk, can be wired (OQ-1, 2026-07-31).
   *
   * Returns { ok: false, reason } (no-op) when:
   *   - branchId out of range
   *   - branch is pruned
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
    if (b.thickness > WIRE_MAX_THICKNESS) return { ok: false, reason: 'too-thick' };

    const oldAngle = b.angle;
    const delta = round4(clamp(angleDelta, -WIRE_MAX_ANGLE_DELTA, WIRE_MAX_ANGLE_DELTA));
    const newAngle = round4(clamp(oldAngle + delta, POLAR_MIN_DEG, POLAR_MAX_DEG));
    const appliedDelta = round4(newAngle - oldAngle);
    const wireCost = WireEngine.wireCostFor(b.thickness);

    b.angle = newAngle;

    // Update wire binding state on Branch (2026-08-01 physics fields).
    // Reset wireSet to false (MAJOR-3 fix: re-wiring clears prior set so SCAR can trigger again).
    b.wired = true;
    b.wireAppliedDay = tree.getAge();
    b.wireAngle = appliedDelta;
    b.wireSet = false;

    const entry: CareLogEntry = {
      day: tree.getAge(),
      action: { type: 'wire', branchId, angleDelta: appliedDelta, oldAngle, newAngle, wireCost },
    };
    tree.getCareLog().push(entry);
    tree.markDirty();

    return { ok: true, wireCost, oldAngle, newAngle };
  }

  /**
   * Remove wire from a branch. Free action — no consumable cost.
   *
   * Timing determines outcome (time-ratio model — CRITICAL-A fix 2026-08-02):
   *   Wire does NOT contribute to τ/currentStress, so the stress-based model cannot
   *   distinguish early vs. late removal for wire-only branches. Instead, timing is
   *   determined by wireDaysApplied relative to computeSetDays(diameter).
   *
   *   - wireDaysApplied >= setDays (wire removed after set window):
   *       wireSet = true, bendSet = true. No spring-back. Bend is permanent.
   *   - wireDaysApplied < setDays (wire removed early):
   *       springBackFraction = 1 - wireDaysApplied/setDays, clamped [0, 1].
   *       springBackAmount = wireAngle × fraction.
   *       angle springs back by springBackAmount, clamped to polar range.
   *
   *   wireScarred branches: bend permanent; wire-remove stops further SCAR accumulation
   *   (the step-4c SCAR timer is gated on b.wired, cleared below).
   *
   * No-op (silent) if branchId out of range, branch pruned, or !branch.wired.
   * Uses tree._logCare() (established pattern from PruneEngine).
   */
  static removeWire(tree: BonsaiTree, branchId: number): void {
    const branches = tree.getBranches();
    const b = branches[branchId];
    if (!b) return;
    if (b.pruned) return;
    if (!b.wired) return;

    // Time-ratio spring-back (CRITICAL-A fix). wireAppliedDay is the absolute day wire
    // was applied; tree.getAge() is the current day. wireDaysApplied is the elapsed time.
    const wireDaysApplied = tree.getAge() - b.wireAppliedDay;
    const setDays = computeSetDays(b.diameter);

    if (wireDaysApplied >= setDays) {
      // Wire left on long enough — bend has permanently set, no spring-back.
      b.wireSet = true;
      b.bendSet = true;
    } else {
      // Wire removed early — partial spring-back proportional to remaining set time.
      // Fraction = 1 at day 0 (full spring-back), approaches 0 as wireDaysApplied → setDays.
      // Clamped [0, 1] to guard edge cases (CRITICAL-B / Carmack C-3).
      const springBackFraction = Math.max(0, Math.min(1, 1 - wireDaysApplied / setDays));
      const springBackAmount = round4(b.wireAngle * springBackFraction);
      // Clamp result to polar range (Carmack C-3 fix).
      b.angle = round4(clamp(b.angle - springBackAmount, POLAR_MIN_DEG, POLAR_MAX_DEG));
    }

    // Clear wire binding state.
    b.wired = false;
    b.wireAngle = 0;
    b.wireAppliedDay = 0;
    // wireSet, wireScarred, and bendSet persist (history / permanent-set state).

    const entry: CareLogEntry = {
      day: tree.getAge(),
      action: { type: 'wire-remove', branchId },
    };
    tree._logCare(entry);
    tree.markDirty();
  }
}
