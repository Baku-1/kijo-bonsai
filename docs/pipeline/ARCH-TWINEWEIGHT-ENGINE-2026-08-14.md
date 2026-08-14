# ARCH — TwineWeightEngine Phase 2 Implementation Spec
**Date:** 2026-08-14  
**Author:** Verified Architect pass — follows skill protocol exactly  
**Status:** DESIGN — for implementer use  
**Pipeline:** Architect → Critic → Implementer → Auditor → Linter

---

## SCOPE

```
DESIGN TASK:  Specify the full Phase 2 implementation for every stub in
              TwineWeightEngine.ts, plus the matching CareLogReplay routing
              changes and gate test suite.

DELIVERABLE:  Precise pseudocode spec — no design decisions left for the
              implementer. Every constant, formula, field write, and log
              entry shape is pinned.

BUILDS ON:    packages/engine/src/TwineWeightEngine.ts (stubs to replace)
              packages/engine/src/WireEngine.ts (reference pattern, gate-verified)
              packages/engine/src/BonsaiTree.ts (delegation + applyDailyUpdate)
              packages/engine/src/CareLogReplay.ts (routing stubs to fix)
              packages/shared/src/index.ts (Branch fields, CareAction shapes)
              docs/ARCHITECT-CAREACTION-TECHNIQUE-2026-07-30.md (origin design)
              docs/KIJO-ENGINE-API.md (public API contract)

CONSUMED BY:  Implementer replacing stubs with working code. No new files
              created — changes confined to TwineWeightEngine.ts,
              BonsaiTree.ts (signature extension only), and CareLogReplay.ts.
```

---

## CODEBASE RECONNAISSANCE

```
FILES READ (in order):
  ✓ STATE.md
  ✓ DECISIONS.md
  ✓ packages/engine/src/TwineWeightEngine.ts
  ✓ packages/engine/src/WireEngine.ts
  ✓ packages/engine/src/BonsaiTree.ts
  ✓ packages/shared/src/index.ts
  ✓ packages/engine/src/CareLogReplay.ts
  ✓ docs/ARCHITECT-CAREACTION-TECHNIQUE-2026-07-30.md
  ✓ docs/KIJO-ENGINE-API.md
  ✓ packages/engine/src/index.ts
  ✓ packages/engine/src/errors.ts
  ✓ packages/engine/src/GrowthEngine.ts (diameter update path)

SYMBOLS VERIFIED:

  TwineWeightEngine.ts
  ✓ TWINE_MAX_ANGLE_DELTA = 28 — exported, line 22
  ✓ WEIGHT_DEGREES_PER_UNIT = 7 — exported, line 25
  ✓ KENGAI_POLAR_MAX = 150 — exported, line 28
  ✓ STRESS_SET_THRESHOLD = 0.001 — exported, line 35
  ✓ STRESS_DECAY_MIN_DAYS = 28 — exported, line 38
  ✓ STRESS_DECAY_MAX_DAYS = 56 — exported, line 41
  ✓ D_MAX = 6.0 — exported, line 49
  ✓ TWINE_FORCE_PER_DAY = 0.02 — exported, line 57
  ✓ WEIGHT_MASS_PER_UNIT = 0.05 — exported, line 60
  ✓ GRAVITY_CONSTANT = 9.81 — exported, line 63
  ✓ computeSetDays(diameter) — exported, line 90–96; clamps to D_MAX
  ✓ toRad(degrees) — exported, line 75–77
  ✗ round4 — NOT imported in TwineWeightEngine.ts (must add)
  ✗ SeededRNG — NOT imported in TwineWeightEngine.ts (must add)
  ✗ CareLogEntry — NOT imported in TwineWeightEngine.ts (must add)
  ✗ clamp helper — NOT defined in TwineWeightEngine.ts (must add)
  ✗ POLAR_MIN_DEG — NOT defined in TwineWeightEngine.ts (must add as module-level const)

  WireEngine.ts
  ✓ POLAR_MIN_DEG = 5.7296 (0.1 rad) — module-level const, NOT exported, line 33
  ✓ POLAR_MAX_DEG = 150 — module-level const, NOT exported, line 34
    NOTE: WireEngine's POLAR_MAX_DEG is already 150°, matching KENGAI_POLAR_MAX.
    The 2026-07-30 arch doc cited 80.2° for WireEngine — this was pre-W1-W6 gate
    verification. Actual shipped code uses 150° for both engines. This spec
    aligns with the gate-verified code, not the superseded arch doc.
  ✓ clamp helper — module-level const, NOT exported, line 46

  BonsaiTree.ts
  ✓ applyTwine(branchId, angleDelta): TwineResult — line 203
  ✓ removeTwine(branchId): void — line 217
  ✓ applyWeight(branchId, weightCount): WeightResult — line 226
  ✓ removeWeight(branchId): void — line 245
  ✓ _logCare(entry): void — exported helper, line 358; equivalent to getCareLog().push
  ✓ getCareLog(): CareLogEntry[] — line 310
  ✓ getAge(): number — line 305 (returns state.day)
  ✓ getSeed(): number — line 307
  ✓ getBranches(): Branch[] — line 311
  ✓ markDirty(): void — line 319
  ✓ applyDailyUpdate step 4a: currentStress recalculated each tick, stressInitial
    captured at first non-zero — lines 66–78
  ✓ applyDailyUpdate step 4d: processTwineDegrade called when day >= twineDegradesDay — lines 128–133
  ✓ applyDailyUpdate step 4e: processWeightTick called when b.weighted — lines 136–140

  packages/shared/src/index.ts — Branch interface fields
  ✓ twined: boolean — line 83
  ✓ twineAppliedDay: number — line 89
  ✓ twineAngle: number — line 95 (signed degrees, ±28° cap)
  ✓ twineForcePerDay: number — line 103
  ✓ twineDegradesDay: number — line 125
  ✓ weighted: boolean — line 108
  ✓ weightCount: number — line 115
  ✓ bendSet: boolean — line 140
  ✓ stressInitial: number — line 45
  ✓ currentStress: number — line 38
  ✓ diameter: number — line 31
  ✓ angle: number — line 8 (degrees relative to parent)
  ✗ weightAppliedDay — DOES NOT EXIST on Branch (OQ-1 below)
  ✗ weightAngleDelta — DOES NOT EXIST on Branch (OQ-1 below)

  packages/shared/src/index.ts — CareAction shapes (verified)
  ✓ twine: { type: 'twine'; branchId; angleDelta; oldAngle; newAngle; degradeDays } — line 202
  ✓ twine-remove: { type: 'twine-remove'; branchId } — line 204
  ✓ weight: { type: 'weight'; branchId; weightCount; torqueContribution } — line 209
  ✓ weight-remove: { type: 'weight-remove'; branchId } — line 211
  ✓ SeededRNG — exported from shared, line 316
  ✓ round4 — exported from shared, line 343

  CareLogReplay.ts
  ✓ wire-remove branch currently throws CareLogReplayError — lines 123–127
  ✓ twine branch currently calls tree.applyTwine(a.branchId, a.angleDelta) — line 132
    BUG: does NOT pass a.degradeDays; replay is non-deterministic until fixed
  ✓ twine-remove branch currently throws CareLogReplayError — lines 134–137
  ✓ weight branch currently calls tree.applyWeight(a.branchId, a.weightCount) — line 144
  ✓ weight-remove branch currently throws CareLogReplayError — lines 145–149

  GrowthEngine.ts
  ✓ diameter = round4(2 × b.thickness) updated every thickeningPass — line 189
  ✓ new branch forks: diameter = round4(2 × childThickness) at creation — line 129

CALL SITES FOR METHODS BEING CHANGED:
  BonsaiTree.applyTwine:
    - packages/engine/src/CareLogReplay.ts:132 — tree.applyTwine(a.branchId, a.angleDelta)
    - packages/engine/dist/BonsaiTree.d.ts:35 — dist (regenerated on build, not edited)
  BonsaiTree.removeTwine:
    - packages/engine/src/CareLogReplay.ts:136 — currently throws before reaching it
  BonsaiTree.applyWeight:
    - packages/engine/src/CareLogReplay.ts:144 — tree.applyWeight(a.branchId, a.weightCount)
  BonsaiTree.removeWeight:
    - packages/engine/src/CareLogReplay.ts:148 — currently throws before reaching it
  TwineWeightEngine.processTwineDegrade:
    - packages/engine/src/BonsaiTree.ts:131 — TwineWeightEngine.processTwineDegrade(b)
  TwineWeightEngine.processWeightTick:
    - packages/engine/src/BonsaiTree.ts:139 — TwineWeightEngine.processWeightTick(b)

GAPS FOUND:
  GAP-1: TwineWeightEngine.ts imports no round4, SeededRNG, CareLogEntry — all needed.
  GAP-2: POLAR_MIN_DEG undefined in TwineWeightEngine — must define locally.
  GAP-3: clamp() helper undefined in TwineWeightEngine — must define locally.
  GAP-4: CareLogReplay passes only (branchId, angleDelta) to applyTwine; does not
         pass a.degradeDays, making replay non-deterministic. Requires signature
         extension + CareLogReplay fix.
  GAP-5: Branch has no weightAppliedDay or weightAngleDelta fields. removeWeight
         spring-back and processWeightTick accumulation are both impossible without
         them. OQ-1 must be resolved by Jeremy before weight methods can be fully
         implemented.
  GAP-6: WireEngine.removeWire is fully implemented but CareLogReplay throws on
         'wire-remove'. This is a straightforward fix bundled into this phase.
```

---

## VERIFICATION LOG

```
VERIFIED:
  ✓ Spring-back model for twine must be TIME-RATIO (not stress-ratio).
    Rationale: τ_twine(t) = TWINE_FORCE_PER_DAY × (day − twineAppliedDay) × length × sin(θ)
    grows monotonically each tick. stressInitial is captured at t=1 (first non-zero tick).
    Thereafter currentStress ≥ stressInitial, so the CRITICAL-B formula
    clamp(currentStress/stressInitial, 0, 1) is always ≥ 1 — always full spring-back.
    This matches the BonsaiTree.ts comment at lines 81–87 which explicitly documents that
    "permanent set is now detected at removal time" because the stress-decay condition
    (step 4b) was REMOVED as unreachable. Conclusion: removeTwine must use the same
    time-ratio model as removeWire.
    Source: BonsaiTree.ts lines 81–87 (CRITICAL-C fix note), WireEngine.ts lines 140–152.

  ✓ CRITICAL-C cannot trigger at natural degrade time (processTwineDegrade path).
    setDays = computeSetDays(diameter) ∈ [28, 56]. degradeDays ∈ [10, 15].
    Since degradeDays < 28 ≤ setDays, twineDaysApplied at natural degrade is always
    < setDays. Therefore bendSet is NEVER set through natural degradation. It is only
    set by manual removeTwine after ≥ setDays.
    Source: constants verified in TwineWeightEngine.ts lines 38–41 and CareAction spec
    line 202 ("range 10–15 game days").

  ✓ POLAR_MAX_DEG in WireEngine is 150° (KENGAI_POLAR_MAX), NOT 80.2°.
    The 2026-07-30 arch doc stated WireEngine clamps to 80.2°. This was superseded
    before gate verification. Actual WireEngine.ts line 34: POLAR_MAX_DEG = 150.
    TwineWeightEngine already defines KENGAI_POLAR_MAX = 150. Both engines use 150°.
    Source: WireEngine.ts:34, TwineWeightEngine.ts:28.

  ✓ torqueContribution in weight log entry is HISTORICAL RECORD only — not used by replay.
    CareLogReplay calls tree.applyWeight(a.branchId, a.weightCount); it does NOT pass
    a.torqueContribution. Each tick, applyDailyUpdate recomputes τ_weight from current
    branch state (length and angle). The stored torqueContribution is for audit/metadata.
    Source: CareLogReplay.ts:144, BonsaiTree.ts:71–74.

  ✓ degradeDays must be passed from log entry to applyTwine for replay determinism.
    If the live path draws from RNG and replay re-draws, any change to the RNG formula
    or constant range would break historical replay. Storing degradeDays in the log entry
    and passing it on replay is the correct pattern (analogous to wireCost, angleDelta).
    Source: CareAction shape at shared/index.ts:202, ARCH-CAREACTION-TECHNIQUE §Assumption 3.

  ✓ _logCare(entry) is the canonical engine method for appending care log entries.
    Used by PruneEngine (line 60) and WireEngine.removeWire (line 164). This spec
    uses _logCare throughout for all TwineWeightEngine operations.
    Source: BonsaiTree.ts:358, PruneEngine.ts:60, WireEngine.ts:164.

  ✓ GrowthEngine.thickeningPass updates diameter = round4(2 × b.thickness) every tick.
    Therefore diameter is always current at removal time and computeSetDays(b.diameter)
    is correct to call at removeTwine/removeWeight time.
    Source: GrowthEngine.ts:189.

UNVERIFIED:
  ? Voxelizer support for polar angles in range (80°, 150°).
    voxelizer/src/index.ts has a comment "150° max = Cascade (Kengai) ceiling; 0.1 rad
    min = POLAR_MIN_DEG equivalent" suggesting support. Full verification requires reading
    the voxelizer's branch-to-voxel mapping path. Flagged by 2026-07-30 arch doc.
    Risk: cascade angles may render incorrectly until voxelizer is validated.
    MITIGATION: Gate tests in this spec use angles within [5.73°, 90°]; cascade range
    validation is a separate voxelizer task.

REFUTED:
  ✗ CRITICAL-B stress-ratio formula applies to removeTwine.
    The TODO stub comment says:
      "const clamped = Math.max(0, Math.min(1, b.currentStress / b.stressInitial))"
    This formula is UNREACHABLE for twine because τ_twine grows monotonically (see
    VERIFIED above). The implemented WireEngine uses time-ratio, not stress-ratio.
    The stub comment describes an EARLIER design that was superseded by the CRITICAL-C
    fix. Do NOT implement the stress-ratio formula for removeTwine. Use time-ratio.
    Source: BonsaiTree.ts:81–87 (removal of step 4b), WireEngine.ts:148.

  ✗ POLAR_MAX_DEG in WireEngine = 80.2°.
    Actual value is 150° (WireEngine.ts:34). See VERIFIED above.
```

---

## CROSS-REFERENCE CHECK

```
CROSS-REFERENCE CHECK
  checked against:
    - packages/shared/src/index.ts (Branch, CareAction, TwineResult, WeightResult)
    - packages/engine/src/WireEngine.ts (reference pattern)
    - packages/engine/src/BonsaiTree.ts (applyDailyUpdate step 4a–4e)
    - packages/engine/src/CareLogReplay.ts (routing)
    - packages/engine/src/index.ts (exports)
    - DECISIONS.md (OQ-1 resolution, physics model decisions)
    - docs/ARCHITECT-CAREACTION-TECHNIQUE-2026-07-30.md (origin spec)
    - docs/KIJO-ENGINE-API.md (API contract)

  consistent: YES with clarifications noted
  terminology aligned: YES — twine/weight/bend/stress match shared/index.ts comments
  data shapes aligned: YES — CareAction shapes verified at shared/index.ts lines 202–211
  boundary violations: NONE proposed — all changes confined to @kijo/engine
  
  DISCREPANCY-1: The 2026-07-30 arch doc (Part 0 §0.4) describes the cascade mechanic
    as using angle accumulation via repeated bend-and-set cycles. The WireEngine
    POLAR_MAX_DEG = 150° and KENGAI_POLAR_MAX = 150° are already aligned. No action.

  DISCREPANCY-2: ARCH-CAREACTION-TECHNIQUE Part 0.1 describes a stress-decay model
    ("each game-day tick: currentStress -= currentStress × stressDecayRatePerDay(D)").
    BonsaiTree.ts step 4a does NOT implement decay — it recomputes currentStress fresh
    each tick from growing τ. The decay model was abandoned in the CRITICAL-C fix.
    This spec aligns with the shipped BonsaiTree.ts, not the original arch doc.

  DISCREPANCY-3: The WEIGHT-related CareAction spec (Part D, ARCH-CAREACTION doc) 
    references "torqueContribution: τ at application time, stored for replay independence."
    The actual CareLogReplay does NOT use torqueContribution on replay — it recomputes τ
    from branch state each tick. This is internally consistent: torqueContribution is
    metadata, not a replay input. Confirmed by reading CareLogReplay.ts:144.
```

---

## THE DESIGN

### 0. File-Level Additions to TwineWeightEngine.ts

The implementer must add these at the top of `TwineWeightEngine.ts` before touching any method.

**Import additions (after existing imports):**
```typescript
import { round4, SeededRNG } from '@kijo/shared';
import type { CareLogEntry } from '@kijo/shared';
```

**Module-level constants (after existing exports, before the class):**
```typescript
// Polar clamp for twine/weight bending — matches WireEngine's deployed values.
// POLAR_MIN_DEG is NOT exported from WireEngine; redefined here.
const POLAR_MIN_DEG = 5.7296;   // 0.1 rad — minimum branch polar angle

// clamp helper (same pattern as WireEngine)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
```

---

### 1. `applyTwine(tree, branchId, angleDelta, storedDegradeDays?)`

**Signature change (required for replay determinism):**

```typescript
// BEFORE (Phase 1):
static applyTwine(tree: BonsaiTree, branchId: number, angleDelta: number): TwineResult

// AFTER (Phase 2):
static applyTwine(
  tree: BonsaiTree,
  branchId: number,
  angleDelta: number,
  storedDegradeDays?: number   // present on replay path; absent on live path
): TwineResult
```

**Corresponding changes required in callers:**

BonsaiTree.ts — extend signature to pass through:
```typescript
// BonsaiTree.applyTwine (line 203) — add optional param and pass through:
applyTwine(branchId: number, angleDelta: number, storedDegradeDays?: number): TwineResult {
  if (!Number.isFinite(angleDelta)) {
    throw new CareLogReplayError(
      `applyTwine: angleDelta must be finite (got ${angleDelta}).`
    );
  }
  return TwineWeightEngine.applyTwine(this, branchId, angleDelta, storedDegradeDays);
}
```

CareLogReplay.ts — pass stored degradeDays on replay:
```typescript
// Line 132 currently: tree.applyTwine(a.branchId, a.angleDelta);
// Replace with:
tree.applyTwine(a.branchId, a.angleDelta, a.degradeDays);
```

**Full implementation of `TwineWeightEngine.applyTwine`:**

```typescript
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

  // Clamp input delta to ±TWINE_MAX_ANGLE_DELTA, then apply round4.
  const clampedInput = round4(
    clamp(angleDelta, -TWINE_MAX_ANGLE_DELTA, TWINE_MAX_ANGLE_DELTA)
  );

  // Apply to branch angle, clamping result to polar range [POLAR_MIN_DEG, KENGAI_POLAR_MAX].
  const oldAngle = b.angle;
  const newAngle = round4(clamp(oldAngle + clampedInput, POLAR_MIN_DEG, KENGAI_POLAR_MAX));
  const appliedDelta = round4(newAngle - oldAngle);  // actual delta after polar clamp

  // Determine degradeDays:
  //   Replay path  — storedDegradeDays provided; use it verbatim.
  //   Live path    — draw from seeded RNG → integer in [10, 15].
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

  // Apply angle change.
  b.angle = newAngle;

  // Set twine binding state.
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
```

**Key decisions pinned:**
- `angleDelta` in the log entry is the **applied** delta (after polar clamp), not the raw input. This matches WireEngine's `appliedDelta` pattern (line 85).
- RNG seed formula: `tree.getSeed() + branchId * 31337 + tree.getAge() * 997`. Pin this; do not change without regenerating golden fixtures.
- `degradeDays` range: `Math.floor(10 + rng.next() * 6)` → {10, 11, 12, 13, 14, 15}. Six values.
- `stressInitial` and `currentStress` reset to 0 at apply time; tick loop populates them.

---

### 2. `removeTwine(tree, branchId)`

**No signature change needed.**

```typescript
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
    // TIME-RATIO spring-back (same model as WireEngine.removeWire lines 148–151).
    // springBackFraction: 1.0 at day 0 (immediate removal = full spring-back),
    //                     0.0 at day setDays (just before permanent set).
    // Clamped [0, 1] to guard against edge cases (e.g., tree age manipulation).
    const springBackFraction = Math.max(0, Math.min(1, 1 - twineDaysApplied / setDays));
    const springBackAmount = round4(b.twineAngle * springBackFraction);
    // Subtract: b.twineAngle is signed; spring-back opposes the bend.
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
```

**CareLogReplay change for twine-remove (currently throws):**
```typescript
// Replace lines 134–137:
// } else if (a.type === 'twine-remove') {
//   throw new CareLogReplayError(`'twine-remove' is not yet implemented...`);
// }
// With:
} else if (a.type === 'twine-remove') {
  tree.removeTwine(a.branchId);
}
```

**Key decisions pinned:**
- TIME-RATIO spring-back: `1 - twineDaysApplied / setDays`. NOT stress-ratio (see REFUTED).
- `b.twineAngle` is the signed applied delta; subtracting it × fraction reverses the bend correctly for both positive and negative angles.
- Stress fields cleared only when `!b.weighted` — if both twine and weight are active simultaneously, removing twine should not zero out weight-driven stress.

---

### 3. `applyWeight(tree, branchId, weightCount)`

**No signature change needed.**

```typescript
static applyWeight(tree: BonsaiTree, branchId: number, weightCount: number): WeightResult {
  const branches = tree.getBranches();
  const b = branches[branchId];
  if (!b) return { ok: false, reason: 'not-found' };
  if (b.pruned) return { ok: false, reason: 'pruned' };
  if (weightCount < 1 || weightCount > 4) return { ok: false, reason: 'weight-cap-exceeded' };
  // NOTE: BonsaiTree.applyWeight (line 227–236) already validates !isFinite and
  // !isInteger before calling here. These guards are here for direct-call safety.

  // Compute torqueContribution at application time.
  // τ = weightCount × m_per_unit × g × branchLength × sin(angle_in_radians)
  // This is HISTORICAL METADATA for the log — replay recomputes τ each tick
  // from current branch state (branch grows, so τ grows over time).
  const torqueContribution = round4(
    weightCount * WEIGHT_MASS_PER_UNIT * GRAVITY_CONSTANT *
    b.length * Math.sin(toRad(b.angle))
  );

  // Set weight binding state.
  b.weighted = true;
  b.weightCount = weightCount;
  // OQ-1: b.weightAppliedDay = tree.getAge(); — REQUIRES NEW BRANCH FIELD.
  // Implementation BLOCKED on OQ-1 resolution for the weight-applied-day tracking.
  // Implementer: if OQ-1 resolves to "add field", add here.
  // If OQ-1 resolves to "no new fields", see OQ-1 resolution path in Open Questions.

  // Reset stress reference for new binding cycle.
  // If twine is currently applied, its stress history is preserved only if the
  // intent is additive. Per physics model, stressInitial resets here so spring-back
  // reference is relative to this weight application. This matches the "most recent
  // binding" semantics from shared/index.ts line 41–46.
  if (!b.twined) {
    b.stressInitial = 0;
    b.currentStress = 0;
  }
  // If both twine AND weight, leave stressInitial/currentStress to accumulate across
  // both — the tick loop handles combined τ correctly.

  // Log care entry (verbatim CareAction 'weight' shape from shared/index.ts:209).
  const entry: CareLogEntry = {
    day: tree.getAge(),
    action: { type: 'weight', branchId, weightCount, torqueContribution },
  };
  tree._logCare(entry);
  tree.markDirty();

  return { ok: true, torqueContribution };
}
```

**CareLogReplay weight routing (no change needed — already correct):**
```typescript
// CareLogReplay.ts line 144 is already correct:
tree.applyWeight(a.branchId, a.weightCount);
// torqueContribution from a.torqueContribution is NOT passed — recomputed each tick.
```

---

### 4. `removeWeight(tree, branchId)`

**⚠️ PARTIALLY BLOCKED on OQ-1.** Spring-back and CRITICAL-C require `weightAppliedDay` and `weightAngleDelta` fields that do not exist on Branch. Two implementation tiers are specified below.

**Tier A — OQ-1 resolved (new fields approved): Full implementation.**
```typescript
static removeWeight(tree: BonsaiTree, branchId: number): void {
  const branches = tree.getBranches();
  const b = branches[branchId];
  if (!b) return;
  if (b.pruned) return;
  if (!b.weighted) return;

  const weightDaysApplied = tree.getAge() - b.weightAppliedDay;  // NEW FIELD
  const setDays = computeSetDays(b.diameter);

  if (weightDaysApplied >= setDays) {
    // CRITICAL-C: weight left on long enough — bend has permanently set.
    b.bendSet = true;
    // Do NOT adjust b.angle.
  } else {
    // TIME-RATIO spring-back (same model as removeTwine).
    const springBackFraction = Math.max(0, Math.min(1, 1 - weightDaysApplied / setDays));
    // Spring-back is over the ACCUMULATED weight angle, not the full target.
    // b.weightAngleDelta tracks how much angle processWeightTick has applied.
    const springBackAmount = round4(b.weightAngleDelta * springBackFraction);  // NEW FIELD
    b.angle = round4(clamp(b.angle - springBackAmount, POLAR_MIN_DEG, KENGAI_POLAR_MAX));
  }

  // Clear weight binding state.
  b.weighted = false;
  b.weightCount = 0;
  b.weightAppliedDay = 0;   // NEW FIELD
  b.weightAngleDelta = 0;   // NEW FIELD
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
```

**Tier B — OQ-1 not resolved (no new fields): Minimal safe implementation.**
```typescript
static removeWeight(tree: BonsaiTree, branchId: number): void {
  const branches = tree.getBranches();
  const b = branches[branchId];
  if (!b) return;
  if (b.pruned) return;
  if (!b.weighted) return;

  // OQ-1 unresolved: cannot compute spring-back or bendSet without weightAppliedDay
  // and weightAngleDelta. Clearing state only — angle change from weight is permanent.
  // This is conservative (no spring-back) rather than incorrect.
  b.weighted = false;
  b.weightCount = 0;
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
```

**CareLogReplay change for weight-remove (currently throws):**
```typescript
// Replace lines 145–149:
} else if (a.type === 'weight-remove') {
  tree.removeWeight(a.branchId);
}
```

---

### 5. `processWeightTick(b)`

**⚠️ PARTIALLY BLOCKED on OQ-1.** The accumulator requires `weightAngleDelta` on Branch.

**Tier A — OQ-1 resolved (new fields approved):**
```typescript
static processWeightTick(b: Branch): void {
  // Target total angle change due to this weight application.
  const targetDelta = round4(WEIGHT_DEGREES_PER_UNIT * b.weightCount);

  // Already at or past target — no further movement.
  if (b.weightAngleDelta >= targetDelta) return;  // NEW FIELD

  // Move 0.1° per tick toward target (downward = positive polar angle for a
  // downward-hanging branch). Weight always increases polar angle (gravity pulls down).
  const remaining = round4(targetDelta - b.weightAngleDelta);
  const step = Math.min(0.1, remaining);  // don't overshoot

  b.angle = round4(clamp(b.angle + step, POLAR_MIN_DEG, KENGAI_POLAR_MAX));
  b.weightAngleDelta = round4(b.weightAngleDelta + step);  // NEW FIELD
  // NOTE: do NOT call markDirty() here — processWeightTick is called inside
  // applyDailyUpdate which runs inside GrowthEngine.growTick which calls markDirty().
}
```

**Tier B — OQ-1 not resolved (no new fields): Minimal safe no-op with comment.**
```typescript
static processWeightTick(_b: Branch): void {
  // OQ-1 unresolved: cannot track incremental progress without weightAngleDelta field.
  // Remains no-op until OQ-1 resolves. Weight angle does not change per tick.
}
```

---

### 6. `processTwineDegrade(b)`

**No signature change.** Each call from applyDailyUpdate step 4d = exactly 1 day of degradation.

The call site guard in BonsaiTree.ts (line 130) ensures this is called ONLY when:
- `b.twined === true`
- `b.twineDegradesDay > 0`
- `this.state.day >= b.twineDegradesDay`

Once `b.twined` is set to false, the guard stops calling this method.

```typescript
static processTwineDegrade(b: Branch): void {
  // Twine has reached its natural degradation day. Spring back 1° per call
  // (per game day) in the direction opposite to the applied bend.
  // b.twineAngle is signed: positive = branch bent away from trunk, negative = toward trunk.
  // Spring-back reverses the bend, so we subtract the step from b.angle.

  const SPRING_RATE = 1.0;  // degrees per game day (natural degradation rate)

  if (Math.abs(b.twineAngle) <= SPRING_RATE) {
    // Last step — reverse the remaining twineAngle exactly (avoid overshoot).
    // Guard: if twineAngle = 0 (already neutral), just clear state.
    const remainingAngle = b.twineAngle;
    b.angle = round4(clamp(b.angle - remainingAngle, POLAR_MIN_DEG, KENGAI_POLAR_MAX));

    // Clear all twine binding state.
    b.twined = false;
    b.twineAngle = 0;
    b.twineAppliedDay = 0;
    b.twineForcePerDay = 0;
    b.twineDegradesDay = 0;
    // Clear stress (no longer contributing to τ_twine).
    // Guard: if also weighted, leave currentStress for the weight contribution.
    if (!b.weighted) {
      b.stressInitial = 0;
      b.currentStress = 0;
    }
    // NOTE: bendSet is NOT set here. Natural degrade (degradeDays ∈ [10,15]) is
    // always shorter than setDays (∈ [28,56]), so the bend never permanently sets
    // through natural degradation. See VERIFIED section.
  } else {
    // Partial step — move 1° in the spring-back direction.
    const step = Math.sign(b.twineAngle) * SPRING_RATE;
    b.angle = round4(clamp(b.angle - step, POLAR_MIN_DEG, KENGAI_POLAR_MAX));
    b.twineAngle = round4(b.twineAngle - step);
    // twineForcePerDay and twineAppliedDay remain — τ_twine is still active while
    // twined=true, reflecting decreasing effective tension during spring-back.
  }
  // NOTE: markDirty() is NOT called here. GrowthEngine.growTick calls markDirty()
  // after applyDailyUpdate. Adding another markDirty here would be redundant.
}
```

**Key decisions pinned:**
- `SPRING_RATE = 1.0` degree/day. A 28° twine bend takes 28 days to fully degrade. A 5° bend takes 5 days. This is intentional and matches the "1 game-unit/day" spec from the stub comment.
- Angle cleared using `b.twineAngle` as the accumulator of remaining bend. Each call reduces it by 1° toward 0.
- `bendSet` is never set by `processTwineDegrade` (see VERIFIED: natural degradation always completes before setDays).

---

### 7. CareLogReplay Routing Changes

All changes are in `packages/engine/src/CareLogReplay.ts`. Three throws replaced; one call updated.

**wire-remove (line 123–127) — replace throw:**
```typescript
} else if (a.type === 'wire-remove') {
  // WireEngine.removeWire is fully implemented (gate-verified W1-W6).
  // Time-ratio spring-back; CRITICAL-C at removal time.
  WireEngine.removeWire(tree, a.branchId);
}
```
Add `import { WireEngine } from './WireEngine.js';` — already imported at line 6.

**twine (line 132) — add degradeDays passthrough:**
```typescript
} else if (a.type === 'twine') {
  // Pass a.degradeDays so replay uses the stored RNG draw, not a new draw.
  // Without this, any change to the RNG seed formula would break historical replay.
  tree.applyTwine(a.branchId, a.angleDelta, a.degradeDays);
}
```

**twine-remove (lines 134–137) — replace throw:**
```typescript
} else if (a.type === 'twine-remove') {
  tree.removeTwine(a.branchId);
}
```

**weight-remove (lines 145–149) — replace throw:**
```typescript
} else if (a.type === 'weight-remove') {
  tree.removeWeight(a.branchId);
}
```

*(weight routing at line 144 already correct — no change needed.)*

---

## CARE LOG ENTRY SHAPES

All shapes are already defined in `packages/shared/src/index.ts`. Verified against actual source. No changes to @kijo/shared required. Listed here for implementer reference.

```
type: 'twine'
  branchId: number          — which branch was twined
  angleDelta: number        — APPLIED delta degrees (post-clamp, after polar bound)
                             Signed. Stored for replay and historical audit.
  oldAngle: number          — branch.angle before applying twine
  newAngle: number          — branch.angle after applying twine (= b.angle post-write)
  degradeDays: number       — integer in [10,15], RNG-drawn at apply time.
                             MUST be stored: replay uses this value, not a re-draw.

type: 'twine-remove'
  branchId: number          — which branch had twine removed

type: 'weight'
  branchId: number          — which branch received weight bags
  weightCount: number       — integer 1–4
  torqueContribution: number — τ = weightCount × WEIGHT_MASS_PER_UNIT × GRAVITY_CONSTANT
                              × b.length × sin(toRad(b.angle)) at application time.
                              HISTORICAL RECORD only; replay recomputes τ each tick.

type: 'weight-remove'
  branchId: number          — which branch had weights removed

type: 'wire-remove'         — no change; already defined
  branchId: number          — which branch had wire removed
  (Note: replay now calls WireEngine.removeWire instead of throwing)
```

---

## GATE TESTS (TWE1–TWE9)

These are the Phase 2 equivalent of W1-W6. Run via a new test file
`packages/engine/test_twineweight.mjs` from repo root.

The test preamble must construct a real tree using the same pattern as `test_wire.mjs`:
```javascript
import { BonsaiTree } from './packages/engine/src/BonsaiTree.js';
import { GrowthEngine } from './packages/engine/src/GrowthEngine.js';
import { CareLogReplay } from './packages/engine/src/CareLogReplay.js';
import { TWINE_MAX_ANGLE_DELTA, WEIGHT_DEGREES_PER_UNIT, computeSetDays }
  from './packages/engine/src/TwineWeightEngine.js';

// Grow a tree for 30 days so branches have non-zero thickness/diameter.
const tree = new BonsaiTree(464497, 'hardwood');
for (let i = 0; i < 30; i++) GrowthEngine.growTick(tree);
```

---

### TWE1 — applyTwine validation
**Assertions (4):**
1. `tree.applyTwine(99999, 10)` returns `{ ok: false, reason: 'not-found' }` (out-of-range branchId)
2. `tree.applyTwine(0, 10)` returns `{ ok: false, reason: 'pruned' }` after `tree.prune(0)` — **NOTE:** trunk (id=0) cannot be pruned per PruneEngine, so use a prunable branch: grow tree, find a depth-1 branch, prune it, verify 'pruned' reason.
3. `tree.applyTwine(branchId, 10)` succeeds (ok: true); second call returns `{ ok: false, reason: 'already-twined' }`.
4. `tree.removeTwine(branchId)` after twine clears state; `tree.applyTwine(branchId, 10)` succeeds again.

---

### TWE2 — applyTwine bend and polar clamping
**Assertions (6):**
1. `applyTwine(id, 20)` on a branch with angle 80°: newAngle = round4(80 + 20) = 100°. `b.angle === 100`.
2. `applyTwine(id, 100)` (exceeds ±28° cap): applied delta clamped to 28°. `b.angle === oldAngle + 28` (if within polar range).
3. `applyTwine(id, -100)` (negative, exceeds cap): applied delta clamped to -28°.
4. `applyTwine(id, 100)` on a branch near KENGAI_POLAR_MAX=150: newAngle clamped to 150. `b.angle === 150`.
5. Care log entry `{ type: 'twine', angleDelta, oldAngle, newAngle, degradeDays }` shape is correct.
6. `b.twineForcePerDay === TWINE_FORCE_PER_DAY` (0.02) after apply.

---

### TWE3 — twineDegradesDay and degradeDays range
**Assertions (4):**
1. `b.twineDegradesDay === tree.getAge() + degradeDays` where `degradeDays = log.action.degradeDays`.
2. `degradeDays >= 10 && degradeDays <= 15` — within specified range.
3. `b.twineAppliedDay === tree.getAge()` at time of application.
4. Same seed + same branch + same day produces same degradeDays (RNG determinism): apply twine, record degradeDays, rebuild tree from care log, verify same degradeDays in replayed log.

---

### TWE4 — removeTwine spring-back and bendSet
**Assertions (5):**
1. **Immediate removal (day 0):** apply twine on day 30, remove on day 30 (same day, daysApplied=0). springBackFraction = 1.0. `b.angle` returns to `oldAngle` exactly. `b.bendSet === false`.
2. **Midpoint removal:** apply on day 30, remove on day (30 + setDays/2). springBackFraction ≈ 0.5. `b.angle ≈ oldAngle + (appliedDelta / 2)`. Allow ±0.01 tolerance for round4.
3. **Late removal (>= setDays):** apply on day 30, remove on day (30 + computeSetDays(b.diameter)). `b.bendSet === true`. `b.angle` unchanged from post-apply value.
4. After any removeTwine: `b.twined === false`, `b.twineForcePerDay === 0`, `b.twineDegradesDay === 0`.
5. Care log entry `{ type: 'twine-remove', branchId }` appended after removal.

---

### TWE5 — CareLogReplay determinism with twine and twine-remove
**Assertions (3):**
1. Build a tree, apply twine on day 20, remove on day 25, continue to day 50. Capture `tree.getBranches()[branchId].angle`. Serialize care log. CareLogReplay.reconstruct(seed, species, log, 50). Reconstructed `b.angle` equals original.
2. Care log in reconstructed tree contains `{ type: 'twine', degradeDays: N }` and `{ type: 'twine-remove' }` entries.
3. Different degradeDays (e.g., 10 vs 15) produce different twineDegradesDay — verify that a tree with degradeDays=10 starts natural degradation 10 days after apply, while one with degradeDays=15 starts at 15.

---

### TWE6 — applyWeight validation
**Assertions (4):**
1. `tree.applyWeight(99999, 2)` returns `{ ok: false, reason: 'not-found' }`.
2. `tree.applyWeight(prunedBranchId, 2)` returns `{ ok: false, reason: 'pruned' }`.
3. `tree.applyWeight(id, 0)` returns `{ ok: false, reason: 'weight-cap-exceeded' }` (0 < 1).
4. `tree.applyWeight(id, 5)` returns `{ ok: false, reason: 'weight-cap-exceeded' }` (5 > 4).

---

### TWE7 — applyWeight log entry and torqueContribution
**Assertions (4):**
1. `applyWeight(id, 3)` returns `{ ok: true, torqueContribution: N }` where N > 0.
2. `torqueContribution` matches formula: `round4(3 × 0.05 × 9.81 × b.length × sin(toRad(b.angle)))`.
3. Care log entry `{ type: 'weight', branchId, weightCount: 3, torqueContribution: N }` is correct.
4. `b.weighted === true`, `b.weightCount === 3` after apply.

---

### TWE8 — processWeightTick incremental angle
**Conditional on OQ-1 resolution (new fields approved). If OQ-1 unresolved: skip or mark DEFERRED.**
**Assertions (3):**
1. After `applyWeight(id, 2)` and 1 growTick: `b.angle` increased by exactly 0.1° (round4). `b.weightAngleDelta === 0.1`.
2. After `applyWeight(id, 2)` and N ticks where N = `(WEIGHT_DEGREES_PER_UNIT × 2) / 0.1 = 140` ticks: `b.weightAngleDelta === 14.0°` (= 7 × 2). No further increase.
3. angle at end = oldAngle + 14.0, clamped to [POLAR_MIN_DEG, KENGAI_POLAR_MAX].

---

### TWE9 — processTwineDegrade natural spring-back
**Assertions (4):**
1. Apply twine (24°) on day 30. degradeDays = 10 (store value). Advance to day 40 (10 ticks after apply). On day 40 tick, first `processTwineDegrade` call: `b.angle` reduced by 1°. `b.twineAngle` reduced by 1° (from 24° to 23°). `b.twined === true` (not yet complete).
2. After 24 calls to `processTwineDegrade` (days 40–63): `b.twined === false`. `b.twineAngle === 0`. `b.angle === originalAngle` (fully returned). `b.bendSet === false` (never set — natural degrade).
3. After twined cleared, further growTicks do NOT call processTwineDegrade (guard condition `b.twined` is false).
4. `processTwineDegrade` with negative twineAngle (-20°): angle increases (spring-back toward parent) by 1°/call until returned.

---

## ASSUMPTIONS

1. **RNG seed formula pinned.** `tree.getSeed() + branchId * 31337 + tree.getAge() * 997` is the canonical formula for degradeDays RNG. This choice was made to avoid collision with existing RNG seeds (GrowthEngine uses `seed + id*7919 + day*37`, applyDailyUpdate uses `seed + day*1000`). If changed, all historical care logs that relied on the live-path draw (before storedDegradeDays was stored in logs) must be regenerated. Post-fix, replay always uses the stored value, making this formula irrelevant for replay correctness.

2. **SPRING_RATE = 1.0°/day for natural degrade.** This means a 28° twine bend (maximum) takes 28 days to spring back after natural degradation begins. Total twine active period: degradeDays (10–15) + springBackDays (up to 28) = 38–43 game days. This feels appropriate for a "temporary" technique. Flag R-SPRING-RATE for playtest tuning.

3. **Stress fields reset on twine/weight apply.** When applyTwine is called, stressInitial and currentStress are reset to 0 (with the `!weighted` guard). This matches the spec's "S at the time the most recent binding was applied" semantics. If the caretaker re-applies twine to an already-weighted branch, the stress resets to accumulate only from the new combined state. This is the correct interpretation per shared/index.ts line 41–46.

4. **processTwineDegrade does NOT call markDirty().** GrowthEngine.growTick calls markDirty() after applyDailyUpdate completes. Per DECISIONS.md "Dirty flag — Renderer ONLY clears," markDirty() by processWeightTick or processTwineDegrade would be redundant (growTick already marks dirty). If processTwineDegrade is ever called outside growTick, the caller must markDirty.

5. **torqueContribution on replay is not re-derived.** CareLogReplay calls `tree.applyWeight(a.branchId, a.weightCount)` — it does NOT pass `a.torqueContribution`. The engine re-derives τ from current branch state each tick. The stored torqueContribution is for audit/metadata only. This is consistent with the "replay independence" intent: if `WEIGHT_MASS_PER_UNIT` or `GRAVITY_CONSTANT` change, historical tick behavior changes too, but the application state (weighted, weightCount) is correctly restored.

---

## OPEN QUESTIONS

### OQ-1 [BLOCKING for weight spring-back and processWeightTick] — Weight tracking fields in @kijo/shared

**Context:** `removeWeight` spring-back and `processWeightTick` incremental accumulation both require knowing (a) when weight was applied and (b) how much angle has been applied so far. Neither datum is on the Branch interface, and no existing field can serve double-duty without semantic corruption.

**Required fields (proposed):**
```typescript
// In packages/shared/src/index.ts Branch interface, after weightCount field:

/**
 * Absolute game-day when weight bags were applied. 0 when not weighted.
 * Used for time-ratio spring-back in removeWeight (same pattern as wireAppliedDay).
 */
weightAppliedDay: number;

/**
 * Cumulative angle change (degrees, always positive) applied by processWeightTick
 * since most recent applyWeight. Tracks progress toward targetDelta =
 * WEIGHT_DEGREES_PER_UNIT × weightCount. Used for spring-back reference in removeWeight.
 * Reset to 0 on applyWeight and removeWeight.
 */
weightAngleDelta: number;
```

**Default values for both:** `0` (same as all other numeric physics fields).

**Constraint conflict:** The task prompt says "No changes to @kijo/shared package (existing fields only)." These fields break that constraint. However, the prompt also says "No new Branch interface fields unless absolutely required." These fields ARE absolutely required — weight cannot function without them.

**Decision needed from Jeremy:**
- Option A: Approve the two new Branch fields. Implementer adds them to @kijo/shared.
- Option B: Deny new fields. Implement weight apply/remove without spring-back (Tier B spec above). processWeightTick remains no-op. CRITICAL-C does not apply to weight. Angle from weight is permanent at remove time.
- Option C: Redesign weight to be immediate (not incremental) — apply `WEIGHT_DEGREES_PER_UNIT × weightCount` to `b.angle` at `applyWeight` time. No accumulator needed. Spring-back uses `weightCount` to reconstruct total delta. This requires storing `weightAppliedDay` but not `weightAngleDelta`.

**Recommendation:** Option A. The two fields are small (2 × 8 bytes), semantically parallel to `wireAppliedDay` and `wireAngle` (already on Branch), and required for functional completeness.

---

### OQ-2 [MINOR] — degradeDays range endpoint inclusion

`Math.floor(10 + rng.next() * 6)` produces values in {10, 11, 12, 13, 14, 15} (6 values). `rng.next()` returns `[0, 1)`. The maximum value `Math.floor(10 + 0.9999... * 6) = Math.floor(15.9999...) = 15`. Confirm this range {10–15 inclusive} is the intended design per GDD. The original spec says "10–15 game days." If the intent is "10–14 inclusive" (5 values), change to `* 5`.

---

### OQ-3 [ADVISORY] — Spring-back model alignment with original arch spec

The 2026-07-30 arch spec (Part 0 §0.1) describes spring-back as:
```
springBack = angleDelta × S_remaining / S_initial = angleDelta × (currentStress / stressInitial)
```
This spec uses TIME-RATIO instead, matching WireEngine's gate-verified implementation. The stress-ratio model is inapplicable because τ_twine grows monotonically (currentStress/stressInitial ≥ 1 always after first tick — confirmed by BonsaiTree.ts comment at lines 81–87).

**Confirm:** Jeremy should confirm that time-ratio spring-back is the intended model for twine and weight, or specify an alternative if the original stress-decay model should be rehabilitated (which would require changing how τ_twine is computed — a much larger change).

---

### OQ-4 [ADVISORY] — Voxelizer polar angle validation for cascade range

WireEngine.POLAR_MAX_DEG = 150° (gate-verified, line 34). Voxelizer comment references this ceiling. TwineWeightEngine.KENGAI_POLAR_MAX = 150°. The 2026-07-30 arch doc flagged the voxelizer as unverified for angles in (80°, 150°). Before shipping any branch that reaches cascade angles, the voxelizer team should validate that the branch-to-voxel mapping handles polar angles in [90°, 150°] correctly. This is not a blocker for implementing TWE gates (gate tests use angles < 90°).

---

### OQ-5 [ADVISORY] — applyWeight when branch is already-weighted

The current stub validation for `applyWeight` does NOT check for `already-weighted` (unlike `applyTwine` which checks `already-twined`). The BonsaiTree.ts spec comment also does not mention this case. Should a second `applyWeight` call on a weighted branch:
- Replace the existing weight? (`b.weightCount = newCount`)
- Stack? (`b.weightCount += newCount`, capped at 4)
- Reject? (return `{ ok: false, reason: 'already-weighted' }`)

This spec implements it as **replace** (the simplest and safest: set weighted=true, weightCount=newCount, recompute torque). If stacking is intended, both `TwineWeightResult` and Branch `weightCount` semantics need clarification.

---

## SUMMARY OF FILE CHANGES

```
packages/engine/src/TwineWeightEngine.ts
  ADD: import { round4, SeededRNG } from '@kijo/shared'
  ADD: import type { CareLogEntry } from '@kijo/shared'
  ADD: const POLAR_MIN_DEG = 5.7296
  ADD: const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
  REPLACE: applyTwine stub → full implementation (new optional storedDegradeDays param)
  REPLACE: removeTwine stub → full implementation (time-ratio spring-back)
  REPLACE: applyWeight stub → full implementation
  REPLACE: removeWeight stub → Tier A or Tier B pending OQ-1
  REPLACE: processWeightTick no-op → Tier A or Tier B pending OQ-1
  REPLACE: processTwineDegrade no-op → full implementation

packages/engine/src/BonsaiTree.ts
  MODIFY: applyTwine(branchId, angleDelta) → applyTwine(branchId, angleDelta, storedDegradeDays?)
  MODIFY: TwineWeightEngine.applyTwine call → pass storedDegradeDays through

packages/engine/src/CareLogReplay.ts
  MODIFY: 'wire-remove' branch — replace throw with WireEngine.removeWire(tree, a.branchId)
  MODIFY: 'twine' branch — tree.applyTwine(a.branchId, a.angleDelta, a.degradeDays)
  MODIFY: 'twine-remove' branch — replace throw with tree.removeTwine(a.branchId)
  MODIFY: 'weight-remove' branch — replace throw with tree.removeWeight(a.branchId)

packages/shared/src/index.ts  [CONDITIONAL on OQ-1 approval]
  ADD (if OQ-1 Option A): weightAppliedDay: number to Branch interface
  ADD (if OQ-1 Option A): weightAngleDelta: number to Branch interface

packages/engine/test_twineweight.mjs  [NEW FILE]
  Gate tests TWE1–TWE9

No changes to: packages/voxelizer, packages/shared (except OQ-1 conditional),
  apps/web, apps/server, or any other package.
```
