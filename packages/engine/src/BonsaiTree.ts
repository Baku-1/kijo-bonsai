import { SeededRNG, round4 } from '@kijo/shared';
import type {
  TreeState, Branch, SpeciesClass, CareLogEntry,
  TwineResult, WeightResult, JinResult,
  LandscapeElementType, Coordinate,
} from '@kijo/shared';
import { createTree } from './tree.js';
import { PruneEngine } from './PruneEngine.js';
import { WireEngine } from './WireEngine.js';
import { TwineWeightEngine, WEIGHT_MASS_PER_UNIT, GRAVITY_CONSTANT, toRad, TWINE_FORCE_PER_DAY, computeSetDays } from './TwineWeightEngine.js';
import { JinEngine } from './JinEngine.js';
import { CareLogReplayError } from './errors.js';

export class BonsaiTree {
  private state: TreeState;
  private dirty: boolean = false;
  private careLog: CareLogEntry[] = [];
  private nextId: number;

  constructor(seed: number, species: SpeciesClass) {
    this.state = createTree(seed, species);
    // Spec initial conditions (override createTree defaults of moisture=50, health=60)
    this.state.moisture = 55;
    this.state.health = 85;
    this.nextId = 1; // trunk is id 0 (from createTree); next allocated id is 1
  }

  // -------------------------------------------------------------------------
  // State mutation
  // -------------------------------------------------------------------------

  /**
   * Advance daily moisture decay and health update.
   * Decay: 5.0–9.0, seeded by seed + day*1000 (uses day BEFORE increment).
   * Health: +0.8 if moisture ∈ [30,65]; −1.5 if moisture <15 or >80; −0.3 otherwise.
   */
  applyDailyUpdate(): void {
    const rng = new SeededRNG(this.state.seed + this.state.day * 1000);
    const decay = round4(5.0 + rng.next() * 4.0);
    this.state.moisture = Math.max(0, round4(this.state.moisture - decay));

    const m = this.state.moisture;
    if (m >= 30 && m <= 65) {
      this.state.health = round4(Math.min(100, this.state.health + 0.8));
    } else if (m < 15 || m > 80) {
      this.state.health = round4(Math.max(10, this.state.health - 1.5));
    } else {
      this.state.health = round4(Math.max(10, this.state.health - 0.3));
    }

    this.state.day += 1;

    // ── Step 4: Per-tick branch physics (2026-08-01) ─────────────────────────
    // Specification: ARCHITECT-BRANCH-PHYSICS-2026-08-01.md Part F (steps 4a–4e).
    // Runs after day increment so (currentDay − appliedDay) counts this tick.
    for (const b of this.state.branches) {
      if (b.pruned) continue;

      // 4a: Recalculate currentStress fresh each tick (additive torque model).
      // currentStress = (τ_twine + τ_weight) / D³.
      // Wire does NOT contribute to τ — it raises the breaking threshold only.
      // Guard D³ against zero with 1e-6 to avoid NaN (branch.diameter=0 on day 0 before
      // thickeningPass has set it; will be patched to round4(2*thickness) in thickeningPass).
      // CRITICAL-C fix (2026-08-02): skip when b.bendSet === true — bend has permanently set;
      // stress recalculation would erroneously re-accumulate stress on a set branch.
      if ((b.twined || b.weighted) && !b.bendSet) {
        const tauTwine = b.twined
          ? b.twineForcePerDay * (this.state.day - b.twineAppliedDay) * b.length * Math.sin(toRad(b.twineAngle))
          : 0;
        const tauWeight = b.weighted
          ? b.weightCount * WEIGHT_MASS_PER_UNIT * GRAVITY_CONSTANT * b.length * Math.sin(toRad(b.angle))
          : 0;
        const dCubed = Math.max(Math.pow(b.diameter, 3), 1e-6);
        b.currentStress = round4((tauTwine + tauWeight) / dCubed);
        // Capture first non-zero currentStress as spring-back reference.
        if (b.stressInitial === 0 && b.currentStress > 0) {
          b.stressInitial = b.currentStress;
        }
      }

      // 4b: REMOVED (CRITICAL-C fix, 2026-08-02).
      // The per-tick set condition (currentStress ≤ 0.001 × stressInitial) is unreachable
      // under the growing-force twine model: τ_twine(t) grows each tick, so currentStress
      // grows monotonically. stressInitial is captured at the first non-zero value, and
      // thereafter currentStress ≥ stressInitial, making the ≤ condition permanently false.
      // Permanent set is now detected at removal time in removeWire/removeTwine/removeWeight
      // (see ARCHITECT-BRANCH-PHYSICS-2026-08-01.md CRITICAL-C and branch.bendSet field).

      // 4c: Wire SCAR check.
      //
      // DELIBERATE DEVIATION from ARCHITECT-BRANCH-PHYSICS-2026-08-01.md Part F step 4c.
      // See also: AUDIT-BRANCH-PHYSICS-2026-08-01.md MAJOR-D (deviation flagged by auditor).
      //
      // Spec says (stress-based):
      //   if (b.wired && wireDaysApplied > 0) {
      //     if (b.currentStress <= STRESS_SET_THRESHOLD * b.stressInitial) { b.wireScarred = true; }
      //   }
      //
      // Implementation uses (time-based):
      //   if (b.wired && !b.wireScarred) {
      //     if (wireDaysApplied >= computeSetDays(b.diameter)) { b.wireScarred = true; }
      //   }
      //
      // Reason for deviation: wire does NOT contribute to τ (stress formula S = τ/D³).
      // For wire-only branches, currentStress=0 and stressInitial=0. The spec's stress
      // condition (0 ≤ 0.001×0 = true) fires immediately on the very first tick after
      // wire is applied, causing every wired branch to SCAR on day 1 regardless of duration.
      // The time-based check correctly implements the intended "wire left on too long → SCAR"
      // semantic using computeSetDays(diameter) ∈ [28, 56] game days.
      //
      // Guard changed from spec's `wireDaysApplied > 0` to `!b.wireScarred` to prevent
      // repeated voxelization triggers after SCAR is already set (correct improvement).
      // This deviation has been reviewed; see AUDIT-BRANCH-PHYSICS-2026-08-01.md for context.
      if (b.wired && !b.wireScarred) {
        const wireDaysApplied = this.state.day - b.wireAppliedDay;
        if (wireDaysApplied > 0) {
          // Carmack C-4 fix (2026-08-02): call computeSetDays() instead of inline lerp.
          // computeSetDays clamps to D_MAX (Major-2 fix) — prevents SCAR-timer drift when
          // a branch grows past D_MAX while wired (audit confirmed +10.85 day drift at D=8.325).
          const setDays = computeSetDays(b.diameter);
          if (wireDaysApplied >= setDays) {
            b.wireScarred = true;
            // SCAR voxels scheduled on next voxelization (markDirty() called by GrowthEngine).
          }
        }
      }

      // 4d: Twine degradation check.
      // twineDegradesDay is cached at applyTwine time (MAJOR-2 fix, 2026-08-01).
      if (b.twined && b.twineDegradesDay > 0 && this.state.day >= b.twineDegradesDay) {
        TwineWeightEngine.processTwineDegrade(b);
        // Phase 1 stub: no-op. Full decay model (progressive spring-back) in Phase 2.
      }

      // 4e: Weight incremental angle update.
      // Weight bends angle INCREMENTALLY each tick — NOT immediately at apply time.
      // processWeightTick is a Phase 1 no-op stub; full 0.1°/tick model in Phase 2.
      if (b.weighted) {
        TwineWeightEngine.processWeightTick(b);
      }
    }
  }

  water(amount: number): void {
    // GAP-3 / GAP-4: Reject bad amounts before they corrupt the moisture pipeline.
    // NaN propagates through round4/Math.min silently; negative amounts dehydrate.
    if (!Number.isFinite(amount)) {
      throw new Error(
        `water amount must be a finite number (got ${amount}). NaN or Infinity would corrupt the moisture pipeline.`
      );
    }
    if (amount <= 0) {
      throw new Error(
        `water amount must be positive (got ${amount}). Zero or negative amounts are not valid care actions.`
      );
    }
    this.state.moisture = Math.min(100, round4(this.state.moisture + amount));
    this.careLog.push({ day: this.state.day, action: { type: 'water', amount } });
  }

  fertilize(): void {
    if (this.state.fertilizerCooldown > 0) return; // 8-day cooldown — no-op
    this.state.fertilizerDays = 5;
    this.state.fertilizerCooldown = 8;
    this.careLog.push({ day: this.state.day, action: { type: 'fertilize' } });
  }

  /**
   * Wire-bend a depth-1 branch (Gu Ahao's Tied and Cut Toolkit).
   * Delegates to WireEngine (stateless, same pattern as prune).
   * angleDelta is caregiver-chosen, clamped to +/-45 per action.
   */
  wire(branchId: number, angleDelta: number) {
    return WireEngine.wire(this, branchId, angleDelta);
  }

  rotate(): void {
    this.state.rotation = (this.state.rotation + 90) % 360;
    this.careLog.push({ day: this.state.day, action: { type: 'rotate' } });
  }

  // ── Branch physics methods (2026-08-01) ──────────────────────────────────────
  // Specification: ARCHITECT-BRANCH-PHYSICS-2026-08-01.md Part B.
  // All delegate to stateless engine classes (same pattern as wire → WireEngine,
  // prune → PruneEngine). Input validation for adversarial paths happens here
  // or in the engine before the "not yet implemented" throw.

  /**
   * Remove wire from a branch. Free action — no consumable cost.
   * Timing determines outcome: see WireEngine.removeWire for full semantics.
   * No-op if branchId is out of range, pruned, or !branch.wired.
   */
  removeWire(branchId: number): void {
    return WireEngine.removeWire(this, branchId);
  }

  /**
   * Apply natural-fiber twine to a branch, bending it by angleDelta degrees.
   * angleDelta clamped to ±28° (TWINE_MAX_ANGLE_DELTA).
   * Throws if inputs are non-finite or would be rejected by validation guards.
   * Phase 1 stub: delegates to TwineWeightEngine.applyTwine (throws "not implemented").
   */
  applyTwine(branchId: number, angleDelta: number): TwineResult {
    if (!Number.isFinite(angleDelta)) {
      throw new CareLogReplayError(
        `applyTwine: angleDelta must be finite (got ${angleDelta}).`
      );
    }
    return TwineWeightEngine.applyTwine(this, branchId, angleDelta);
  }

  /**
   * Remove twine from a branch before natural degradation.
   * No-op if branchId out of range, pruned, or !branch.twined.
   * Phase 1 stub.
   */
  removeTwine(branchId: number): void {
    return TwineWeightEngine.removeTwine(this, branchId);
  }

  /**
   * Attach weight bags to a branch. weightCount must be integer 1–4.
   * Throws CareLogReplayError for invalid (NaN, negative, infinite, non-integer, out-of-range) weightCount.
   * Phase 1 stub: delegates to TwineWeightEngine.applyWeight.
   */
  applyWeight(branchId: number, weightCount: number): WeightResult {
    if (!Number.isFinite(weightCount)) {
      throw new CareLogReplayError(
        `applyWeight: weightCount must be finite (got ${weightCount}). NaN or Infinity are not valid.`
      );
    }
    if (!Number.isInteger(weightCount) || weightCount < 1 || weightCount > 4) {
      throw new CareLogReplayError(
        `applyWeight: weightCount must be an integer 1–4 (got ${weightCount}).`
      );
    }
    return TwineWeightEngine.applyWeight(this, branchId, weightCount);
  }

  /**
   * Remove weight bags from a branch.
   * No-op if branchId out of range, pruned, or !branch.weighted.
   * Phase 1 stub.
   */
  removeWeight(branchId: number): void {
    return TwineWeightEngine.removeWeight(this, branchId);
  }

  /**
   * Apply jin pliers to a branch section → SCAR voxels. Irreversible. Premium action.
   * Throws CareLogReplayError for invalid segmentIndex or jinCost.
   * Phase 1 stub: delegates to JinEngine.applyJin.
   */
  applyJin(branchId: number, segmentIndex: number, jinCost: number): JinResult {
    if (!Number.isFinite(segmentIndex) || segmentIndex < 0 || !Number.isInteger(segmentIndex)) {
      throw new CareLogReplayError(
        `applyJin: segmentIndex must be a non-negative integer (got ${segmentIndex}).`
      );
    }
    if (!Number.isFinite(jinCost) || jinCost < 1 || !Number.isInteger(jinCost)) {
      throw new CareLogReplayError(
        `applyJin: jinCost must be a positive integer (got ${jinCost}).`
      );
    }
    return JinEngine.applyJin(this, branchId, segmentIndex, jinCost);
  }

  /**
   * Place a landscape element in the pot. Phase 1: logs and marks dirty.
   * Throws CareLogReplayError if position is out of 0-255 bounds (each axis).
   * See ARCHITECT-BRANCH-PHYSICS-2026-08-01.md Part B addLandscape stub.
   * Note: addLandscape signature uses (elementType, position) per ARCHITECT spec,
   * not (position) alone as in the task prompt (which omits elementType).
   */
  addLandscape(elementType: LandscapeElementType, position: Coordinate): void {
    if (
      !Number.isInteger(position.x) || position.x < 0 || position.x > 255 ||
      !Number.isInteger(position.y) || position.y < 0 || position.y > 255 ||
      !Number.isInteger(position.z) || position.z < 0 || position.z > 255
    ) {
      throw new CareLogReplayError(
        `addLandscape: position must be integers in [0, 255] on each axis (got ${JSON.stringify(position)}).`
      );
    }
    this._logCare({ day: this.state.day, action: { type: 'landscape', elementType, position } });
    this.markDirty();
  }

  // Expose TWINE_FORCE_PER_DAY for test/verification without engine internals.
  static readonly TWINE_FORCE_PER_DAY = TWINE_FORCE_PER_DAY;

  prune(branchId: number): boolean {
    return PruneEngine.prune(this, branchId);
  }

  // -------------------------------------------------------------------------
  // Accessors
  // -------------------------------------------------------------------------

  getRoot(): Branch { return this.state.branches[0]; }
  getRootMutable(): Branch { return this.state.branches[0]; }
  getMoisture(): number { return this.state.moisture; }
  getHealth(): number { return this.state.health; }
  /** Returns current day counter (incremented by applyDailyUpdate). */
  getAge(): number { return this.state.day; }
  getSeed(): number { return this.state.seed; }
  getSpecies(): SpeciesClass { return this.state.species; }
  getRotationState(): number { return this.state.rotation; }
  isFertilizerActive(): boolean { return this.state.fertilizerDays > 0; }
  getCareLog(): CareLogEntry[] { return this.careLog; }
  getBranches(): Branch[] { return this.state.branches; }
  getNextBranchId(): number { return this.nextId; }

  // -------------------------------------------------------------------------
  // Dirty flag — Renderer ONLY clears (see KIJO-ARCHITECTURE.md §4)
  // -------------------------------------------------------------------------

  isDirty(): boolean { return this.dirty; }
  markDirty(): void { this.dirty = true; }
  clearDirty(): void { this.dirty = false; }

  // -------------------------------------------------------------------------
  // Verification helpers
  // -------------------------------------------------------------------------

  /**
   * Counts living (non-pruned) non-trunk branches.
   * Excludes trunk so that: nextId === countLivingBranches() + getPrunedCount() + 1 (G2 invariant).
   */
  countLivingBranches(): number {
    return this.state.branches.filter(b => !b.pruned && b.parent !== null).length;
  }

  getPrunedCount(): number {
    return this.state.branches.filter(b => b.pruned).length;
  }

  getTotalMass(): number {
    return round4(
      this.state.branches
        .filter(b => !b.pruned)
        .reduce((sum, b) => sum + b.thickness * b.thickness * b.length, 0)
    );
  }

  // -------------------------------------------------------------------------
  // Internal — for GrowthEngine / PruneEngine use only
  // -------------------------------------------------------------------------

  _getState(): TreeState { return this.state; }

  /** Allocate and return the next branch id, advancing the counter. */
  _allocBranchId(): number { return this.nextId++; }

  _pushBranch(b: Branch): void { this.state.branches.push(b); }

  /** Append a care-log entry (used by PruneEngine). */
  _logCare(entry: CareLogEntry): void { this.careLog.push(entry); }

  /** Return the mutable Branch at index id (used by PruneEngine to set pruned). */
  _getBranchMutable(id: number): Branch | undefined { return this.state.branches[id]; }

  _tickFertilizer(): void {
    if (this.state.fertilizerDays > 0) this.state.fertilizerDays--;
    if (this.state.fertilizerCooldown > 0) this.state.fertilizerCooldown--;
  }
}
