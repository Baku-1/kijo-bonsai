# IMPL-TWINEWEIGHT-ENGINE-2026-08-14

**Phase:** Implementer  
**Date:** 2026-08-14  
**Engineer:** Claude (Sonnet 4.6)  
**Spec refs:** `ARCH-TWINEWEIGHT-ENGINE-2026-08-14.md`, `ARCH-TWINEWEIGHT-PATCH-2026-08-14.md`  
**Verified by:** node --test (49/49 pass), tsc --noEmit (exit 0 both packages)

---

## OUTCOME: done

**DONE WHEN (from Step 1):** `tsc --noEmit` exits 0 on both packages; `npm test` in `packages/engine` passes all tests including TWE1–TWE9 — **OBSERVED: 49/49 pass, both tsc runs exit 0.**

---

## WHAT CHANGED

### `packages/shared/src/index.ts`
Added two fields to the `Branch` interface:
- `weightAppliedDay: number` — absolute game-day when weight was most recently applied (0 = not weighted). Mirrors `wireAppliedDay`. Used as the spring-back reference base in `removeWeight`.
- `weightAngleDelta: number` — accumulated bend angle applied by weight(s) in degrees (always ≥ 0). Incremented by each `applyWeight` call (STACK model). Used as the spring-back reference magnitude in `removeWeight`. Reset to 0 on `removeWeight`.

### `packages/engine/src/TwineWeightEngine.ts`
Full Phase 2 implementation replacing 6 stubs. Key decisions:

**`applyTwine(tree, branchId, angleDelta, storedDegradeDays?)`**
- Guards: not-found, pruned, already-twined.
- `angleDelta` clamped to `±TWINE_MAX_ANGLE_DELTA (28°)` before application.
- Final angle clamped to `[POLAR_MIN_DEG (5.73°), KENGAI_POLAR_MAX (150°)]`.
- `degradeDays` drawn from `SeededRNG(seed + branchId × 31337 + age × 997)` → `[10, 15]` on live path; taken verbatim from `storedDegradeDays` on replay path for determinism.
- Sets: `b.twined`, `b.twineAppliedDay`, `b.twineAngle` (= `appliedDelta`), `b.twineForcePerDay`, `b.twineDegradesDay`.
- Logs `CareLogEntry` with `angleDelta: appliedDelta` (post-clamp, not raw input) and `degradeDays`.

**`removeTwine(tree, branchId)`**
- Guards: not-found, pruned, not-twined.
- Time-ratio spring-back: `fraction = max(0, 1 − daysApplied / setDays)` where `setDays = computeSetDays(b.diameter)` at removal time.
- If `daysApplied ≥ setDays`: `b.bendSet = true`, no spring-back.
- Clears all twine binding fields. Stress cleared only if not also weighted.

**`applyWeight(tree, branchId, weightCount)`**
- Guards: not-found, pruned, count outside [1, 4].
- **OQ-5 STACK**: no already-weighted guard. Applies `newDelta = weightCount × WEIGHT_DEGREES_PER_UNIT` IMMEDIATELY to `b.angle`. `b.weightAngleDelta += actualDelta`, capped at `TWINE_MAX_ANGLE_DELTA (28°)`.
- `torqueContribution = round4(weightCount × WEIGHT_MASS_PER_UNIT × g × b.length × sin(θ))` stored in care log for auditing; recomputed from live state on each tick.

**`removeWeight(tree, branchId)`**
- Same time-ratio spring-back formula as `removeTwine`, using `b.weightAngleDelta` as the reference magnitude and `b.weightAppliedDay` as the reference time.
- Clears: `b.weighted`, `b.weightCount`, `b.weightAppliedDay`, `b.weightAngleDelta`.

**`processWeightTick(_b)`**
- Explicit no-op. Exists for structural symmetry and to satisfy the `applyDailyUpdate` step-4e call contract. Comment documents the OQ-5 STACK rationale.

**`processTwineDegrade(b)`**
- Guard: `b.twineAngle === 0` → return immediately (also handles the case where twine was manually removed before degrade fires).
- Final step (`|b.twineAngle| ≤ SPRING_RATE`): reverses remaining angle exactly; clears all twine fields.
- Normal step: subtracts `sign(twineAngle) × SPRING_RATE (1°)` from both `b.angle` and `b.twineAngle`.
- `bendSet` is NOT set on natural degrade — degrade period `[10, 15]` days is always shorter than `setDays [28, 56]`.

### `packages/engine/src/BonsaiTree.ts`
`applyTwine` signature updated to `(branchId, angleDelta, storedDegradeDays?: number)`. Passes `storedDegradeDays` through to `TwineWeightEngine.applyTwine`.

### `packages/engine/src/CareLogReplay.ts`
Four stubs replaced:
- `wire-remove` → `WireEngine.removeWire(tree, a.branchId)`
- `twine` → `tree.applyTwine(a.branchId, a.angleDelta, a.degradeDays)` (degradeDays passthrough)
- `twine-remove` → `tree.removeTwine(a.branchId)`
- `weight-remove` → `tree.removeWeight(a.branchId)`

### `packages/engine/src/tree.ts`
Added `weightAppliedDay: 0` and `weightAngleDelta: 0` to trunk init object.

### `packages/engine/src/GrowthEngine.ts`
Added `weightAppliedDay: 0` and `weightAngleDelta: 0` to forked branch init object.

### `packages/engine/package.json`
`TwineWeightEngine.test.js` appended to the `test` script.

### `packages/engine/test/TwineWeightEngine.test.js` (new file)
37 assertions across TWE1–TWE9. Framework: `node:test` with `node:assert/strict`.

Key design choices in the test file:
- **Trunk-first**: all tests operate on `branch[0]` with `angle` pre-set to `80°` unless the test specifically requires a pruneable non-trunk branch (TWE1-2, TWE6-2 use `seed=200 days=50` which reliably forks).
- **TWE4-2 (spring-back tolerance)**: `expectedAngle` computed using `computeSetDays(b.diameter)` AFTER the growth ticks (not before), matching the diameter the engine sees at removal time. Tolerance `< 0.01°`.
- **TWE4-3 (bendSet)**: 70 growth ticks used (not `Math.ceil(sd)+1`) to guarantee exceeding the actual grown setDays even as the trunk thickens.
- **TWE5-1 (replay)**: No trunk angle pre-mutation (direct branch mutations are not logged and cannot be replayed). Trunk starts at 0°; twine of +15° bends to 15° above `POLAR_MIN_DEG`.
- **TWE9 (processTwineDegrade)**: `storedDegradeDays=1` forces degrade to start at tick 1, making the test deterministic without predicting the RNG draw.

---

## CARMACK × LINUS SELF-REVIEW (pre-completion)

Applied carmack-linus-review to `TwineWeightEngine.ts`:

**Found and confirmed correct:**
- `round4` after every angle operation. ✓
- `clamp` applied at both input (delta) and output (final angle) stages. ✓
- `b.twineAngle` set to `appliedDelta` (post-clamp), not raw `angleDelta`. The care log also records `appliedDelta`. This means replay is exact even when the branch is near a polar boundary.

**Issue 1 (LOW): `computeSetDays` recomputes from grown diameter at removal time, not apply time.**
Consequence: a branch that grew thick during a long wire period will have a higher setDays at removal than at apply time, making it harder to achieve `bendSet`. This is correct physically (thicker branches resist permanent deformation), but the test file had an initial bug where it computed `halfTicks` and `fraction` from the apply-time diameter then called `removeTwine` with a different (grown) diameter. Fixed in TWE4-2 by reading the diameter a second time after ticks.

**Issue 2 (LOW): `processWeightTick` is a no-op but is still called from `applyDailyUpdate` step-4e.**
The call has zero runtime cost. The no-op is intentional and documented with an OQ-5 reference. Acceptable.

**Issue 3 (MED): `degradeDays` range is `Math.floor(10 + rng.next() * 6)`.**
`rng.next()` returns `[0, 1)`. So `rng.next() * 6 ∈ [0, 6)`, and `Math.floor(...)` gives `[0, 5]`, so the full result is `[10, 15]` — 6 distinct values. TWE3-2 verifies this range. Correct.

**Issue 4 (LOW): TWE5-1 replay test can't use trunk angle pre-mutation.**
Addressed by design: trunk starts at natural angle 0°, twine bends it to 15°. Both the live and replay paths see the same initial state (neither knows about the pre-mutation). The test is clean.

**No critical issues found.** All identified issues were either pre-existing design constraints or test scaffolding issues that have been resolved.

---

## VERIFIED BY OBSERVATION

```
packages/engine $ node --test test/TwineWeightEngine.test.js
1..37
# tests 37
# pass 37
# fail 0

packages/engine $ npm test
1..49
# tests 49
# pass 49
# fail 0

$ npx tsc -p packages/shared/tsconfig.json --noEmit   exit 0
$ npx tsc -p packages/engine/tsconfig.json --noEmit   exit 0
```

---

## CAVEATS

1. **`processWeightTick` and `applyDailyUpdate` step-4e wiring**: The test suite does not directly verify that `processWeightTick` is called from `applyDailyUpdate`. Its no-op semantics are verified implicitly by TWE8 (angle is applied immediately at `applyWeight` time, not accumulated over ticks). If `applyDailyUpdate` were ever changed to call `processWeightTick` with non-STACK semantics, TWE8 would catch the regression.

2. **TWE4-3 uses 70 ticks, not exact setDays**: This is a safe overestimate. If `computeSetDays` ever returns values above 70 (e.g., D_MAX raised), this test would need to increase the tick count. The current max is 56 days at D_MAX=6.0.

3. **`weight-remove` in care-action server (`ALLOWED_ACTION_TYPES`)**: `care-action/index.ts` on the server likely has the same `ALLOWED_ACTION_TYPES` gap as `wire-remove` (GAP-1, Task #161). `weight-remove` client persistence will 400 until the server is updated. Engine and replay are correct; this is a server-side concern.

4. **JinEngine `applyJin` still throws "not implemented"** in `CareLogReplay` (retained Phase 1 stub). Not in scope for this task.
