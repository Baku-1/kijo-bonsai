import { round4, SeededRNG } from '@kijo/shared';
import type { Branch, CareLogEntry } from '@kijo/shared';
import type { TwineResult, WeightResult } from '@kijo/shared';
import type { BonsaiTree } from './BonsaiTree.js';

// ---------------------------------------------------------------------------
// TwineWeightEngine — stateless physics for twine and weight bindings.
//
// Pattern: stateless class, same as WireEngine / PruneEngine.
// BonsaiTree.applyTwine() / applyWeight() / etc. delegate here.
// CareLogReplay calls these indirectly via BonsaiTree methods.
//
// Specification: ARCH-TWINEWEIGHT-ENGINE-2026-08-14.md + ARCH-TWINEWEIGHT-PATCH-2026-08-14.md
// Phase 2: full physics implementation replacing Phase 1 stubs.
// OQ-5 STACK semantics confirmed by Jeremy Gordon 2026-08-14.
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

// ── Module-level constants (not exported — internal use only) ─────────────────

/** Minimum polar angle (degrees). 0.1 rad = 5.7296°. Matches WireEngine.POLAR_MIN_DEG. */
const POLAR_MIN_DEG = 5.7296;

/** Spring-back rate for natural twine degradation (degrees per game day). */
const SPRING_RATE = 1.0;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

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
   *
   * @param tree            The BonsaiTree instance.
   * @param branchId        Index into TreeState.branches.
   * @param angleDelta      Signed degrees. Clamped to ±TWINE_MAX_ANGLE_DELTA (28°).
   * @param storedDegradeDays  Optional: on replay path, the stored RNG draw from
   *                           the original care log. Absent on live path (new draw).
   *
   * NOTE on b.twineAngle semantics: set to the applied delta at applyTwine time.
   * processTwineDegrade decrements this field toward 0 (remaining bend accumulator).
   * At any mid-degrade snapshot, twineAngle is REMAINING bend, not original delta.
   * The care log entry (type: 'twine', angleDelta) is the original applied delta.
   *
   * Returns { ok: false, reason } when: branch not found, already pruned, already twined.
   * Returns { ok: true, oldAngle, newAngle } on success.
   */
  static applyTwine(
    tree: BonsaiTree,
    branchId: number,
    angleDelta: number,
    storedDegradeDays?: number
  ): TwineResult {
    const branches = tree.getBranches();
    const b = branches[branchId];
    if (!b) return { ok: false, reason: 'not-found' };
    if (b.pruned) return { ok: false, reason: 'pruned' };
    if (b.twined) return { ok: false, reason: 'already-twined' };

    // Clamp input delta to ±TWINE_MAX_ANGLE_DELTA, then round4.
    const clampedInput = round4(clamp(angleDelta, -TWINE_MAX_ANGLE_DELTA, TWINE_MAX_ANGLE_DELTA));

    // Apply to branch angle, clamping result to polar range [POLAR_MIN_DEG, KENGAI_POLAR_MAX].
    const oldAngle = b.angle;
    const newAngle = round4(clamp(oldAngle + clampedInput, POLAR_MIN_DEG, KENGAI_POLAR_MAX));
    const appliedDelta = round4(newAngle - oldAngle);  // actual delta after polar clamp

    // Determine degradeDays:
    //   Replay path — storedDegradeDays provided; use verbatim for determinism.
    //   Live path   — draw from seeded RNG → integer in [10, 15].
    let degradeDays: number;
    if (storedDegradeDays !== undefined) {
      degradeDays = storedDegradeDays;
    } else {
      // RNG seed: tree.seed + branchId × 31337 + currentDay × 997.
      // Large primes chosen to minimize collision with GrowthEngine RNG
      // (seed + id×7919 + day×37) and applyDailyUpdate (seed + day×1000).
      const rng = new SeededRNG(tree.getSeed() + branchId * 31337 + tree.getAge() * 997);
      degradeDays = Math.floor(10 + rng.next() * 6);  // [10, 15] inclusive (6 values)
    }

    // Apply angle change and set twine binding state.
    b.angle = newAngle;
    b.twined = true;
    b.twineAppliedDay = tree.getAge();
    b.twineAngle = appliedDelta;
    b.twineForcePerDay = TWINE_FORCE_PER_DAY;
    b.twineDegradesDay = tree.getAge() + degradeDays;

    // Reset stress reference. applyDailyUpdate step 4a will capture stressInitial
    // on the first tick after application (when daysSinceApply = 1 → τ > 0).
    // Explicit reset guards against residual values from a prior binding cycle.
    b.stressInitial = 0;
    b.currentStress = 0;

    // Log care entry (verbatim shape from shared/index.ts CareAction 'twine').
    const entry: CareLogEntry = {
      day: tree.getAge(),
      action: {
        type: 'twine',
        branchId,
        angleDelta: appliedDelta,   // APPLIED delta (post-clamp), not raw input
        oldAngle,
        newAngle,
        degradeDays,
      },
    };
    tree._logCare(entry);
    tree.markDirty();

    return { ok: true, oldAngle, newAngle };
  }

  /**
   * Remove twine from a branch before natural degradation.
   * Applies time-ratio spring-back: springBack = twineAngle × max(0, 1 - daysApplied/setDays).
   * No-op if branchId not found, branch pruned, or branch not twined.
   *
   * OQ-3 RESOLVED (Jeremy, 2026-08-14): time-ratio spring-back confirmed for all bindings.
   */
  static removeTwine(tree: BonsaiTree, branchId: number): void {
    const branches = tree.getBranches();
    const b = branches[branchId];
    if (!b) return;
    if (b.pruned) return;
    if (!b.twined) return;

    // Elapsed time since twine was applied.
    const twineDaysApplied = tree.getAge() - b.twineAppliedDay;
    const setDays = computeSetDays(b.diameter);  // [28, 56] based on diameter

    if (twineDaysApplied >= setDays) {
      // CRITICAL-C: twine left on long enough — bend has permanently set.
      // No spring-back. Bend is the new natural angle.
      b.bendSet = true;
      // Do NOT adjust b.angle — the bent angle IS the set angle.
    } else {
      // TIME-RATIO spring-back (same model as WireEngine.removeWire).
      // springBackFraction: 1.0 at day 0 (immediate removal = full spring-back),
      //                     0.0 at day setDays (just before permanent set).
      // Clamped [0, 1] to guard against edge cases.
      const springBackFraction = Math.max(0, Math.min(1, 1 - twineDaysApplied / setDays));
      const springBackAmount = round4(b.twineAngle * springBackFraction);
      // Subtract: b.twineAngle is the remaining signed bend; spring-back opposes it.
      b.angle = round4(clamp(b.angle - springBackAmount, POLAR_MIN_DEG, KENGAI_POLAR_MAX));
    }

    // Clear twine binding state.
    b.twined = false;
    b.twineAngle = 0;
    b.twineAppliedDay = 0;
    b.twineForcePerDay = 0;
    b.twineDegradesDay = 0;
    // Clear stress only if NOT also weighted (weight may still be generating stress).
    if (!b.weighted) {
      b.stressInitial = 0;
      b.currentStress = 0;
    }
    // bendSet, wireSet, wireScarred persist (permanent history — never cleared).

    // Log care entry.
    const entry: CareLogEntry = {
      day: tree.getAge(),
      action: { type: 'twine-remove', branchId },
    };
    tree._logCare(entry);
    tree.markDirty();
  }

  /**
   * Attach weight bags to a branch.
   *
   * OQ-5 STACK semantics (confirmed by Jeremy Gordon, 2026-08-14):
   *   Calling applyWeight on an already-weighted branch ACCUMULATES weightAngleDelta.
   *   New delta is added to existing weightAngleDelta, capped at TWINE_MAX_ANGLE_DELTA (28°).
   *   Angle change is applied IMMEDIATELY to branch.angle at call time.
   *   Does not replace or reject — no already-weighted guard.
   *
   * @param tree        The BonsaiTree instance.
   * @param branchId    Index into TreeState.branches.
   * @param weightCount Integer 1–4.
   *
   * Returns { ok: false, reason } when: not-found, pruned, weight-cap-exceeded.
   * Returns { ok: true, torqueContribution } on success.
   */
  static applyWeight(tree: BonsaiTree, branchId: number, weightCount: number): WeightResult {
    const branches = tree.getBranches();
    const b = branches[branchId];
    if (!b) return { ok: false, reason: 'not-found' };
    if (b.pruned) return { ok: false, reason: 'pruned' };
    if (weightCount < 1 || weightCount > 4) return { ok: false, reason: 'weight-cap-exceeded' };
    // NOTE: No already-weighted guard — OQ-5 STACK semantics (Jeremy, 2026-08-14).
    // Calling applyWeight on an already-weighted branch accumulates weightAngleDelta.
    // NOTE: BonsaiTree.applyWeight (line 227–236) validates !isFinite and !isInteger before
    // calling here. These guards are present for direct-call safety.

    const newDelta = round4(weightCount * WEIGHT_DEGREES_PER_UNIT);
    const oldAngle = b.angle;

    // Apply angle change IMMEDIATELY (STACK model: no incremental tick mechanism).
    b.angle = round4(clamp(b.angle + newDelta, POLAR_MIN_DEG, KENGAI_POLAR_MAX));
    const actualDelta = round4(b.angle - oldAngle);  // may be less than newDelta if clamped

    // Accumulate weightAngleDelta (STACK: += not reset). Capped at TWINE_MAX_ANGLE_DELTA.
    // This field is the spring-back reference in removeWeight.
    b.weightAngleDelta = round4(Math.min(TWINE_MAX_ANGLE_DELTA, b.weightAngleDelta + actualDelta));
    b.weightAppliedDay = tree.getAge();
    b.weighted = true;
    b.weightCount = weightCount;

    // Reset stress reference for new binding cycle (only if twine is not also active).
    // If twine AND weight are both active, leave stress to accumulate across both.
    if (!b.twined) {
      b.stressInitial = 0;
      b.currentStress = 0;
    }

    // torqueContribution at application time: τ = weightCount × m × g × L × sin(θ).
    // HISTORICAL METADATA for the log — replay recomputes τ each tick from current state
    // (branch grows, so τ grows over time). The stored value is for audit only.
    const torqueContribution = round4(
      weightCount * WEIGHT_MASS_PER_UNIT * GRAVITY_CONSTANT * b.length * Math.sin(toRad(b.angle))
    );

    const entry: CareLogEntry = {
      day: tree.getAge(),
      action: { type: 'weight', branchId, weightCount, torqueContribution },
    };
    tree._logCare(entry);
    tree.markDirty();

    return { ok: true, torqueContribution };
  }

  /**
   * Remove weight bags from a branch.
   * Applies time-ratio spring-back using weightAngleDelta as the accumulated applied angle.
   * No-op if branchId not found, branch pruned, or branch not weighted.
   *
   * OQ-3 RESOLVED (Jeremy, 2026-08-14): same spring-back formula as removeTwine.
   * OQ-1 RESOLVED (Jeremy, 2026-08-14): uses weightAppliedDay and weightAngleDelta fields.
   */
  static removeWeight(tree: BonsaiTree, branchId: number): void {
    const branches = tree.getBranches();
    const b = branches[branchId];
    if (!b) return;
    if (b.pruned) return;
    if (!b.weighted) return;

    const weightDaysApplied = tree.getAge() - b.weightAppliedDay;
    const setDays = computeSetDays(b.diameter);

    if (weightDaysApplied >= setDays) {
      // CRITICAL-C: weight left on long enough — bend has permanently set.
      b.bendSet = true;
      // Do NOT adjust b.angle — the bent angle IS the set angle.
    } else {
      // TIME-RATIO spring-back. b.weightAngleDelta is the total angle applied (STACK model).
      const springBackFraction = Math.max(0, Math.min(1, 1 - weightDaysApplied / setDays));
      const springBackAmount = round4(b.weightAngleDelta * springBackFraction);
      b.angle = round4(clamp(b.angle - springBackAmount, POLAR_MIN_DEG, KENGAI_POLAR_MAX));
    }

    // Clear weight binding state.
    b.weighted = false;
    b.weightCount = 0;
    b.weightAppliedDay = 0;
    b.weightAngleDelta = 0;
    if (!b.twined) {
      b.stressInitial = 0;
      b.currentStress = 0;
    }

    const entry: CareLogEntry = {
      day: tree.getAge(),
      action: { type: 'weight-remove', branchId },
    };
    tree._logCare(entry);
    tree.markDirty();
  }

  /**
   * Process per-tick angle change for weight.
   * Called from BonsaiTree.applyDailyUpdate step 4e when b.weighted === true.
   *
   * No-op: Under OQ-5 STACK model (Jeremy confirmed 2026-08-14), weight angle is
   * applied IMMEDIATELY at applyWeight time. No incremental tick accumulation needed.
   * This method exists for structural symmetry with processTwineDegrade and to
   * satisfy the BonsaiTree step-4e call contract.
   *
   * @param _b The branch (unused — angle already applied).
   */
  static processWeightTick(_b: Branch): void {
    // No-op: weight angle applied immediately in applyWeight (OQ-5 STACK model, 2026-08-14).
    // processWeightTick is called by applyDailyUpdate step 4e when b.weighted; this is
    // intentionally inert so the tick loop does not double-apply angle changes.
  }

  /**
   * Process twine degradation when twineDegradesDay has been reached.
   * Called from BonsaiTree.applyDailyUpdate step 4d when:
   *   b.twined === true && b.twineDegradesDay > 0 && currentDay >= b.twineDegradesDay.
   *
   * Applies 1°/day (SPRING_RATE) spring-back in the direction that reduces b.twineAngle
   * toward 0. On the final step (|b.twineAngle| <= SPRING_RATE), reverses the remaining
   * angle and clears all twine state.
   *
   * NOTE: bendSet is NOT set during natural degrade — natural degradation period [10, 15] days
   * is always shorter than setDays [28, 56], so the bend cannot permanently set via degrade.
   *
   * NOTE: markDirty() is NOT called here — GrowthEngine.growTick calls markDirty() after
   * applyDailyUpdate. Adding another markDirty here would be redundant.
   *
   * @param b The branch (mutable).
   */
  static processTwineDegrade(b: Branch): void {
    // Guard: if already cleared (e.g., twine removed manually before this fires), skip.
    if (b.twineAngle === 0) return;

    if (Math.abs(b.twineAngle) <= SPRING_RATE) {
      // Last step — reverse the remaining twineAngle exactly (avoid float overshoot).
      const remainingAngle = b.twineAngle;
      b.angle = round4(clamp(b.angle - remainingAngle, POLAR_MIN_DEG, KENGAI_POLAR_MAX));

      // Clear all twine binding state (degradation complete).
      b.twined = false;
      b.twineAngle = 0;
      b.twineAppliedDay = 0;
      b.twineForcePerDay = 0;
      b.twineDegradesDay = 0;
      // Clear stress only if not also weighted.
      if (!b.weighted) {
        b.stressInitial = 0;
        b.currentStress = 0;
      }
      // NOTE: bendSet is NOT set — natural degrade never permanently sets the bend.
    } else {
      // Partial step — move 1° in the spring-back direction.
      // b.twineAngle is signed: positive = bent away from trunk, negative = toward trunk.
      // step has the same sign as b.twineAngle; subtracting it reduces the bend toward 0.
      const step = Math.sign(b.twineAngle) * SPRING_RATE;
      b.angle = round4(clamp(b.angle - step, POLAR_MIN_DEG, KENGAI_POLAR_MAX));
      b.twineAngle = round4(b.twineAngle - step);
      // twineForcePerDay and twineAppliedDay remain — τ_twine still active while twined=true.
    }
  }
}
