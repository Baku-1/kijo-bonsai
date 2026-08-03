import type { Branch } from '@kijo/shared';
import type { TwineResult, WeightResult } from '@kijo/shared';
import type { BonsaiTree } from './BonsaiTree.js';
import { CareLogReplayError } from './errors.js';

// ---------------------------------------------------------------------------
// TwineWeightEngine — stateless physics stubs for twine and weight bindings.
//
// Pattern: stateless class, same as WireEngine / PruneEngine.
// BonsaiTree.applyTwine() / applyWeight() / etc. delegate here.
// CareLogReplay calls these indirectly via BonsaiTree methods.
//
// Specification: ARCHITECT-BRANCH-PHYSICS-2026-08-01.md Parts B, D, F.
// All physics methods are Phase 1 stubs — full implementation in Phase 2.
// ---------------------------------------------------------------------------

// ── Physics constants (owner-confirmed 2026-07-31) ────────────────────────────
// Source: ARCHITECT-CAREACTION-TECHNIQUE-2026-07-30.md Part 0 constants block.
// DECISIONS.md 2026-08-01 carries citation anchors for the formulas.

/** Max twine angle delta per application (degrees, signed). Owner-confirmed 2026-07-31. */
export const TWINE_MAX_ANGLE_DELTA = 28;      // °

/** Downward angle contribution per weight bag (degrees). Owner-confirmed 2026-07-31. */
export const WEIGHT_DEGREES_PER_UNIT = 7;     // °

/** Max cascade angle for any branch (Kengai/cascade style). */
export const KENGAI_POLAR_MAX = 150;          // °

/**
 * Stress threshold below which a bend is considered permanently set.
 * When currentStress / stressInitial ≤ this value, angle has set.
 * Source: ARCHITECT-CAREACTION-TECHNIQUE Part 0.1, owner-confirmed 2026-07-31.
 */
export const STRESS_SET_THRESHOLD = 0.001;

/** Minimum game-days for stress to decay to STRESS_SET_THRESHOLD (thin branch D→0). */
export const STRESS_DECAY_MIN_DAYS = 28;

/** Maximum game-days for stress to decay to STRESS_SET_THRESHOLD (thick branch D=D_max). */
export const STRESS_DECAY_MAX_DAYS = 56;

/**
 * Maximum diameter for setDays lerp normalization.
 * D_max = 2 × WIRE_MAX_THICKNESS (3.0) = 6.0.
 * Any wireable branch has D ≤ 6.0, so the lerp stays in [0,1] for all wire-eligible branches.
 * Source: ARCHITECT-BRANCH-PHYSICS-2026-08-01.md Part E; derived from WireEngine.WIRE_MAX_THICKNESS.
 */
export const D_MAX = 6.0;

/**
 * Per-tick twine tension increment (Newtons per game day).
 * Twine tightens progressively: τ_twine(t) = twineForcePerDay × daysSinceApply × length × sin(θ).
 * Calibration: 0.02 N/day → after 25 days ≈ 0.5 N (matches one weight bag).
 * Subject to playtesting. Source: ARCHITECT-BRANCH-PHYSICS-2026-08-01.md Part D constants.
 */
export const TWINE_FORCE_PER_DAY = 0.02;      // N/day

/** Mass per weight bag (kg). Approx 50g. Calibrated against WEIGHT_DEGREES_PER_UNIT. */
export const WEIGHT_MASS_PER_UNIT = 0.05;     // kg

/** Gravitational constant (m/s²). Real gravity; scale by game-unit factor if needed. */
export const GRAVITY_CONSTANT = 9.81;         // m/s²

/**
 * Branch breaking threshold. Phase 1: Infinity (no snapping).
 * Phase 2: calibrate per species before playtesting.
 * TODO: cite paper (see DECISIONS.md 2026-08-01 "Breaking threshold T").
 */
export const BRANCH_BREAK_THRESHOLD = Infinity;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert degrees to radians. */
export function toRad(degrees: number): number {
  return degrees * Math.PI / 180;
}

/**
 * Compute setDays for a branch of the given diameter.
 * setDays = lerp(STRESS_DECAY_MIN_DAYS, STRESS_DECAY_MAX_DAYS, D / D_MAX)
 *
 * This is the time in game-days for a bend to permanently set.
 * Thicker branches take longer to set (higher inertia).
 * NOT stored on Branch — recomputed at check time as diameter may have changed.
 *
 * Source: ARCHITECT-BRANCH-PHYSICS-2026-08-01.md Part E, owner-confirmed 2026-07-31.
 * Citation: bonsai4me.com/wiring-bonsai/ (see DECISIONS.md 2026-08-01).
 */
export function computeSetDays(diameter: number): number {
  // Major-2 fix (2026-08-02): clamp input to D_MAX.
  // A branch wired at D≤6.0 can grow past D_MAX during the wire period.
  // Without clamping, setDays would drift above 56 (e.g., +10.85 at D=8.325 — observed by audit).
  const d = Math.min(D_MAX, diameter);
  return STRESS_DECAY_MIN_DAYS + (STRESS_DECAY_MAX_DAYS - STRESS_DECAY_MIN_DAYS) * (d / D_MAX);
}

// ── Engine class ─────────────────────────────────────────────────────────────

export class TwineWeightEngine {

  /**
   * Apply natural-fiber twine to a branch, bending it by angleDelta degrees.
   * Phase 1 stub — input validation only; full physics in Phase 2.
   *
   * @param tree      The BonsaiTree instance.
   * @param branchId  Index into TreeState.branches.
   * @param angleDelta Signed degrees. Clamped to ±TWINE_MAX_ANGLE_DELTA (28°).
   */
  static applyTwine(tree: BonsaiTree, branchId: number, angleDelta: number): TwineResult {
    const branches = tree.getBranches();
    const b = branches[branchId];
    if (!b) return { ok: false, reason: 'not-found' };
    if (b.pruned) return { ok: false, reason: 'pruned' };
    if (b.twined) return { ok: false, reason: 'already-twined' };

    // Clamp delta to ±TWINE_MAX_ANGLE_DELTA
    const clamped = Math.max(-TWINE_MAX_ANGLE_DELTA, Math.min(TWINE_MAX_ANGLE_DELTA, angleDelta));

    // Phase 1 stub: validates inputs and returns ok. Full bend logic in Phase 2.
    // TODO Phase 2: apply angle, set twined=true, twineAppliedDay, twineAngle, twineForcePerDay,
    //   twineDegradesDay (= currentDay + degradeDays from SeededRNG), log care entry, markDirty.
    // TODO Phase 2 CRITICAL-B: clamp springBackFraction = Math.max(0, Math.min(1, currentStress/stressInitial))
    //   in removeTwine before computing springBackAmount = twineAngle × clamped.
    //   Also clamp resulting angle to [POLAR_MIN_DEG, POLAR_MAX_DEG] after spring-back.
    // TODO Phase 2 CRITICAL-C: in removeTwine, set b.bendSet = true when twineDaysApplied >= computeSetDays(b.diameter).
    void clamped; // acknowledged; applied in Phase 2
    // Major-3 fix (2026-08-02): throw CareLogReplayError, not plain Error.
    // Plain Error escapes CareLogReplay's catch (e instanceof CareLogReplayError) guard.
    throw new CareLogReplayError('TwineWeightEngine.applyTwine: Phase 1 stub — full implementation in Phase 2.');
  }

  /**
   * Remove twine from a branch before natural degradation.
   * Phase 1 stub.
   */
  static removeTwine(tree: BonsaiTree, branchId: number): void {
    const branches = tree.getBranches();
    const b = branches[branchId];
    if (!b || b.pruned || !b.twined) return; // no-op

    // TODO Phase 2: compute spring-back FIRST (guard stressInitial > 0).
    //   CRITICAL-B: const clamped = Math.max(0, Math.min(1, b.currentStress / b.stressInitial));
    //   const springBackAmount = round4(b.twineAngle * clamped);
    //   b.angle = round4(clamp(b.angle - springBackAmount, POLAR_MIN_DEG, POLAR_MAX_DEG));
    //   CRITICAL-C: if (twineDaysApplied >= computeSetDays(b.diameter)) b.bendSet = true;
    //   Then: set twined=false, twineAngle=0, stressInitial=0, currentStress=0 (if !weighted),
    //   log care entry, markDirty.
    throw new CareLogReplayError('TwineWeightEngine.removeTwine: Phase 1 stub — full implementation in Phase 2.');
  }

  /**
   * Attach weight bags to a branch.
   * Phase 1 stub — validates inputs only.
   *
   * @param tree        The BonsaiTree instance.
   * @param branchId    Index into TreeState.branches.
   * @param weightCount Integer 1–4.
   */
  static applyWeight(tree: BonsaiTree, branchId: number, weightCount: number): WeightResult {
    const branches = tree.getBranches();
    const b = branches[branchId];
    if (!b) return { ok: false, reason: 'not-found' };
    if (b.pruned) return { ok: false, reason: 'pruned' };
    if (weightCount < 1 || weightCount > 4) return { ok: false, reason: 'weight-cap-exceeded' };

    // TODO Phase 2: set weighted=true, b.weightCount=weightCount, compute torqueContribution,
    //   log care entry with torqueContribution for replay independence, markDirty.
    // TODO Phase 2 CRITICAL-C: in removeWeight, set b.bendSet = true when weightDaysApplied >= computeSetDays(b.diameter).
    throw new CareLogReplayError('TwineWeightEngine.applyWeight: Phase 1 stub — full implementation in Phase 2.');
  }

  /**
   * Remove weight bags from a branch.
   * Phase 1 stub.
   */
  static removeWeight(tree: BonsaiTree, branchId: number): void {
    const branches = tree.getBranches();
    const b = branches[branchId];
    if (!b || b.pruned || !b.weighted) return; // no-op

    // TODO Phase 2: compute spring-back FIRST (guard stressInitial > 0).
    //   CRITICAL-B: const clamped = Math.max(0, Math.min(1, b.currentStress / b.stressInitial));
    //   const springBackAmount = round4(b.twineAngle * clamped); // weight uses angle delta, adjust field name
    //   b.angle = round4(clamp(b.angle - springBackAmount, POLAR_MIN_DEG, POLAR_MAX_DEG));
    //   CRITICAL-C: if (weightDaysApplied >= computeSetDays(b.diameter)) b.bendSet = true;
    //   Then: set weighted=false, weightCount=0, stressInitial=0, log care entry, markDirty.
    throw new CareLogReplayError('TwineWeightEngine.removeWeight: Phase 1 stub — full implementation in Phase 2.');
  }

  /**
   * Process per-tick angle change for weight (incremental, not immediate).
   * Called from BonsaiTree.applyDailyUpdate step 4e.
   * Phase 1 stub — no-op.
   *
   * @param b The branch (mutable).
   */
  static processWeightTick(_b: Branch): void {
    // TODO Phase 2: apply 0.1° per tick toward targetDelta = WEIGHT_DEGREES_PER_UNIT × weightCount.
    // Track accumulated angle via a separate field (e.g. weightAngleAccum) to be added in Phase 2.
  }

  /**
   * Process twine degradation when twineDegradesDay has been reached.
   * Called from BonsaiTree.applyDailyUpdate step 4d.
   * Phase 1 stub — no-op.
   *
   * @param b The branch (mutable).
   */
  static processTwineDegrade(_b: Branch): void {
    // TODO Phase 2: implement progressive spring-back at 1 game-unit/day as twine degrades.
  }
}
