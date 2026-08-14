# CRITIC — TwineWeightEngine Phase 2 Implementation Spec
**Date:** 2026-08-14
**Reviews:** ARCH-TWINEWEIGHT-ENGINE-2026-08-14.md
**Pipeline:** Architect → **Critic** → Implementer → Auditor → Linter
**Skill:** adversarial-auditor (loaded before all file reads)

---

## VERDICT: FAIL

Two spec errors will cause the implementer to write tests that either crash at runtime
or validate the wrong interface. A third gap (twineAngle semantic mutation) risks
downstream consumers reading stale data. The implementation pseudocode itself is
sound; the test specs for TWE1 and TWE6 are not.

All findings below are grounded in direct file reads — not spec claims taken on faith.

---

## SOURCES READ

```
packages/shared/src/index.ts       — Branch interface, CareAction shapes, SeededRNG, round4
packages/engine/src/TwineWeightEngine.ts — existing stubs + constants
packages/engine/src/WireEngine.ts  — reference spring-back model
packages/engine/src/CareLogReplay.ts — four routing branches to fix
packages/engine/src/BonsaiTree.ts  — applyDailyUpdate steps 4d/4e, applyWeight guard
```

---

## OQ-1 SIGN-OFF

**GENUINELY BLOCKING — fields absent, architect's claim is correct.**

Observed in `packages/shared/src/index.ts` (Branch interface, lines 3–155):

- `weightAppliedDay` — **DOES NOT EXIST**
- `weightAngleDelta` — **DOES NOT EXIST**

Existing fields that could not serve as proxies: `weightCount` (semantic conflict),
`wireAppliedDay` (belongs to wire state). No aliasing is safe.

Both `processWeightTick` accumulation (needs a running total) and `removeWeight`
spring-back (needs elapsed days) are genuinely impossible without these fields.
The Tier B fallback spec (no-op tick, no spring-back on remove) is the correct
conservative path if Jeremy declines Option A.

**Decision still required from Jeremy: Option A / B / C (OQ-1 as stated).**

---

## FINDINGS

### BLOCKER-1 — TWE6 Assertions 3 & 4 test the wrong interface

**File verified:** `packages/engine/src/BonsaiTree.ts` lines 226–237

```typescript
applyWeight(branchId: number, weightCount: number): WeightResult {
  if (!Number.isFinite(weightCount)) {
    throw new CareLogReplayError(...);
  }
  if (!Number.isInteger(weightCount) || weightCount < 1 || weightCount > 4) {
    throw new CareLogReplayError(
      `applyWeight: weightCount must be an integer 1–4 (got ${weightCount}).`
    );
  }
  return TwineWeightEngine.applyWeight(this, branchId, weightCount);
}
```

`BonsaiTree.applyWeight` **throws** `CareLogReplayError` for `weightCount = 0`
(integer, but < 1) and `weightCount = 5` (integer, but > 4) before ever reaching
`TwineWeightEngine.applyWeight`.

TWE6 assertions 3 and 4 say:

> `tree.applyWeight(id, 0)` returns `{ ok: false, reason: 'weight-cap-exceeded' }`
> `tree.applyWeight(id, 5)` returns `{ ok: false, reason: 'weight-cap-exceeded' }`

These calls **throw**, not return. Any test written as `assert(result.reason ===
'weight-cap-exceeded')` will crash with an unhandled exception.

**Required correction — pick one:**

Option A (preferred): Change TWE6 assertions 3 & 4 to call
`TwineWeightEngine.applyWeight(tree, id, 0)` directly, bypassing BonsaiTree's guard.
This tests the engine method's own validation, which is what the assertion actually
wants to verify.

Option B: Keep `tree.applyWeight` as the call site but change the assertion to
`assert(throws CareLogReplayError)` for weightCount ∈ {0, 5}. Documents that
BonsaiTree is the validation layer, not TwineWeightEngine.

Option C: Remove BonsaiTree's integer/range throw guard (lines 232–236) and let
TwineWeightEngine return `{ ok: false, reason: 'weight-cap-exceeded' }` instead.
Requires confirming no existing code depends on BonsaiTree throwing here.

---

### BLOCKER-2 — TWE1 Assertion 2: Contradictory test setup

**Spec text (TWE1 assertion 2):**
> "`tree.applyTwine(0, 10)` returns `{ ok: false, reason: 'pruned' }` after
> `tree.prune(0)` — **NOTE:** trunk (id=0) cannot be pruned per PruneEngine, so
> use a prunable branch: grow tree, find a depth-1 branch, prune it, verify
> 'pruned' reason."

The assertion opens with a specific call (`applyTwine(0, 10)` after `tree.prune(0)`)
that is immediately contradicted by the NOTE. An implementer following the assertion
literally will try to prune the trunk, which is a no-op, and `applyTwine(0, ...)` will
return `{ ok: false, reason: 'not-found' }` (trunk is at index 0 and is NOT pruned),
not `'pruned'`. The test would pass for the wrong reason, or fail silently.

**Required correction:** Replace assertion 2 with unambiguous instruction:

> "Grow the tree for 30 days. Identify any non-trunk branch (depth ≥ 1) whose id is N.
> Call `tree.prune(N)`. Then call `tree.applyTwine(N, 10)`. Assert result is
> `{ ok: false, reason: 'pruned' }`."

---

### HIGH-1 — `b.twineAngle` mutated as shrinking accumulator in `processTwineDegrade`

**Spec section 6 (processTwineDegrade, partial step):**
```typescript
b.twineAngle = round4(b.twineAngle - step);
```

`twineAngle` is defined in `packages/shared/src/index.ts` line 94–95 as:
> "Bend angle (degrees, signed) applied by the twine action. Clamped ±28°. 0 when not twined."

The word "applied" and the JSDoc example usage in removeTwine (spring-back reference:
`b.angle -= twineAngle × springBackFraction`) both imply this field holds the
**original** applied delta, unchanged until twine is cleared.

After `processTwineDegrade` fires, the field holds the **remaining** angle (counting
down from the original), not the original delta. Any external consumer
(NFT verifier, voxelizer, a future UI progress bar showing "bend remaining") that
reads `b.twineAngle` expecting the original applied delta will get wrong values for
branches mid-degrade.

**Impact on replay correctness:** No correctness bug — CareLogReplay.reconstruct
replays from day 0 and runs all ticks, so the accumulator will be at the correct
value at any given day. The issue is semantic for external state readers.

**Required correction — pick one:**

Option A (recommended): Add `twineAngleApplied: number` as a read-only historical
field (set once by `applyTwine`, never decremented) for external consumers, and
keep `twineAngle` as the mutable accumulator. Requires a new Branch field (similar
to OQ-1 approach — can be bundled with OQ-1 decision).

Option B: Update the JSDoc for `twineAngle` in `shared/src/index.ts` explicitly:
> "During natural degradation (processTwineDegrade), this field decrements toward 0
> and represents REMAINING bend, not original applied delta. The care log entry
> (`type: 'twine', angleDelta`) is the authoritative record of original applied delta."

Option B is a documentation-only fix and has zero implementation cost. It should be
done regardless of Option A.

---

### HIGH-2 — OQ-3 marked ADVISORY but is foundational; should be resolved before implementation

The spring-back model (time-ratio vs. stress-ratio) is the single most consequential
physics decision in this spec. The spec correctly refutes the stress-ratio formula
(it's genuinely unreachable under the growing-torque model), and confirms time-ratio
matches the gate-verified WireEngine. However, OQ-3 is labeled ADVISORY, which tells
the implementer they can proceed before Jeremy confirms.

**Problem:** If Jeremy later decides the stress model should be rehabilitated (even
as a redesign of how τ_twine is computed), every `removeTwine`, `removeWeight`, and
`processTwineDegrade` implementation would need to be rewritten. The implementer
would be building on an unconfirmed foundation.

**Required correction:** Elevate OQ-3 to BLOCKING or REQUIRED-CONFIRMATION, and
obtain explicit Jeremy sign-off that time-ratio spring-back is the intended model
before the implementer writes removeTwine/removeWeight. A one-line confirmation in
DECISIONS.md suffices.

---

### LOW-1 — TWE2 Assertion 3: Branch angle not specified; polar clamp may silently truncate expected delta

**Spec assertion:**
> "`applyTwine(id, -100)` (negative, exceeds cap): applied delta clamped to -28°."

This is only true if the branch angle after clamping to −28° stays above `POLAR_MIN_DEG`
(5.7296°). If the branch angle is ≤ 33.7296° (5.7296 + 28), the polar clamp will
fire and the actual applied delta will be smaller in magnitude than −28°. An
implementer testing this on a branch with `b.angle = 20°` will see `appliedDelta =
round4(5.7296 − 20) = −14.2704°`, not `−28°`, and the assertion will fail.

**Required correction:** Specify that assertion 3 must use a branch with
`b.angle > 33.73°` (allowing full −28° without polar interference), or change the
assertion to read "applied delta clamped to at most −28° (may be less if polar
floor is hit)."

---

### LOW-2 — TWE3 Assertion 4 / TWE9 Assertion 1: degradeDays forced-value mechanism unspecified

**TWE3 assertion 4** says "same seed + same branch + same day → same degradeDays"
but does not say how a test verifies a specific value (10 vs. 11 vs. 15) without
knowing the RNG output in advance.

**TWE9 assertion 1** says "Apply twine (24°) on day 30. degradeDays = 10 (store value)"
treating 10 as a known constant, but the live RNG produces an unpredictable value
for seed 464497 + branchId × 31337 + 30 × 997.

**Required correction:** For any test that needs a specific degradeDays value, use
the `storedDegradeDays` parameter explicitly:
```javascript
tree.applyTwine(branchId, 24, 10);  // force degradeDays = 10 via replay path
```
This bypasses the RNG and produces a deterministic degradeDays regardless of tree
seed. The spec should state this explicitly for TWE9 assertion 1. For TWE3 assertion
4, the test should apply twine (live path), read back the stored degradeDays from
the care log, rebuild via CareLogReplay, and assert the replayed log has the same
stored value — no need to predict what the RNG produced.

---

### LOW-3 — TWE5 shared preamble incompatible with "apply twine on day 20"

The file-level preamble grows the tree for 30 days before any test. TWE5 requires
applying twine on day 20 (so that days 20–25 have twine active). A 30-day preamble
means day 20 has already passed; calling `applyTwine` after that would be day 30+.

**Required correction:** State explicitly that each test in the file uses its own
`BonsaiTree` instance constructed fresh for that test's timing requirements. The
shared preamble illustrates the import/construction pattern only. TWE5 must construct
a fresh tree and advance it to day 20 before applying twine.

---

### LOW-4 — OQ-5 (already-weighted replace semantics) should be confirmed before implementation

**Spec says:** "This spec implements it as replace (the simplest and safest: set
weighted=true, weightCount=newCount, recompute torque)."

**Problem for replay:** Two sequential `applyWeight` entries in the care log for the
same branch will replay as two apply calls. The second silently overwrites the first.
If the first entry logged `torqueContribution = X` (at application time) and the
second replays with a larger branch (grown further), the second `torqueContribution`
will differ from either logged value. Since `torqueContribution` is explicitly marked
HISTORICAL RECORD ONLY and replay does not use it, this does not break replay
correctness. However, the care log becomes misleading: it looks like weight was
applied twice but only the second is effective.

If stacking or rejection is intended, this is a breaking semantic difference.
**Required confirmation from Jeremy before implementation:** silently replace, stack
(with cap 4), or reject?

---

## VERIFIED CLAIMS (architect's reconnaissance confirmed accurate)

```
✓ OQ-1: weightAppliedDay absent from Branch — CONFIRMED absent (lines 3–155, index.ts)
✓ OQ-1: weightAngleDelta absent from Branch — CONFIRMED absent
✓ twined: boolean exists at shared/index.ts:83
✓ twineAppliedDay: number exists at shared/index.ts:89
✓ twineAngle: number exists at shared/index.ts:95
✓ twineForcePerDay: number exists at shared/index.ts:103
✓ twineDegradesDay: number exists at shared/index.ts:125
✓ weighted: boolean exists at shared/index.ts:108
✓ weightCount: number exists at shared/index.ts:115
✓ bendSet: boolean exists at shared/index.ts:140
✓ SeededRNG exported from shared, line 315
✓ round4 exported from shared, line 343

✓ WireEngine spring-back (removeWire, lines 148–151):
    springBackFraction = Math.max(0, Math.min(1, 1 - wireDaysApplied / setDays))
    springBackAmount = round4(b.wireAngle * springBackFraction)
    b.angle = round4(clamp(b.angle - springBackAmount, POLAR_MIN_DEG, POLAR_MAX_DEG))
  IDENTICAL structure to spec's removeTwine pseudocode. Model is consistent.
  POLAR_MAX_DEG in WireEngine = 150 (line 34). Matches KENGAI_POLAR_MAX = 150.

✓ CareLogReplay wire-remove (lines 123–127): throws CareLogReplayError. Spec fix correct.
✓ CareLogReplay twine (line 132): calls tree.applyTwine(a.branchId, a.angleDelta).
    Does NOT pass a.degradeDays. BUG confirmed. Spec fix (add a.degradeDays) correct.
✓ CareLogReplay twine-remove (lines 134–137): throws. Spec fix correct.
✓ CareLogReplay weight-remove (lines 145–149): throws. Spec fix correct.
✓ CareLogReplay weight (line 144): tree.applyWeight(a.branchId, a.weightCount). NO change
    needed. Spec correctly says "already correct."
✓ WireEngine already imported in CareLogReplay at line 6. Spec note is correct.

✓ BonsaiTree.applyDailyUpdate step 4d (lines 130–133):
    TwineWeightEngine.processTwineDegrade(b) already called. No new call site needed.
✓ BonsaiTree.applyDailyUpdate step 4e (lines 138–140):
    TwineWeightEngine.processWeightTick(b) already called. No new call site needed.
  → BonsaiTree.ts change required is ONLY the applyTwine signature extension.

✓ CareAction 'twine' shape at shared/index.ts:202 includes degradeDays: number.
    a.degradeDays is accessible after the a.type === 'twine' guard in CareLogReplay. ✓

✓ Stress-ratio formula in TODO comment (removeTwine stub, line 143–144):
    "CRITICAL-B: const clamped = Math.max(0, Math.min(1, b.currentStress / b.stressInitial))"
  UNREACHABLE confirmed. BonsaiTree step 4a (line 76–78) only captures stressInitial
  when it is 0 and currentStress > 0 (first non-zero tick). τ_twine grows monotonically
  each tick → currentStress ≥ stressInitial for all subsequent ticks. Fraction is always
  ≥ 1, clamped to 1 → full spring-back always. Time-ratio model is correct.

✓ computeSetDays range: D=0 → 28 days, D=6 → 56 days. degradeDays ∈ [10,15].
  degradeDays < setDays always true. processTwineDegrade never sets bendSet. Verified.

✓ CRITICAL-C: spec note that bendSet is NOT set in processTwineDegrade is correct.

✓ _logCare(entry) canonical pattern: BonsaiTree line 358. Used by PruneEngine and
  WireEngine.removeWire. Using it in TwineWeightEngine is consistent.
  (WireEngine.wire uses getCareLog().push() — pre-existing inconsistency, not new.)
```

---

## INTENT CHECK

```
INTENT CHECK — TWE6 assertions 3 & 4
  code does:      BonsaiTree.applyWeight throws CareLogReplayError for weightCount < 1 or > 4
  test expects:   { ok: false, reason: 'weight-cap-exceeded' }
  spec says:      Engine returns { ok: false, reason: 'weight-cap-exceeded' } for same range
  verdict:        CONFLICT — test calls BonsaiTree, spec describes TwineWeightEngine behavior;
                  the layers produce different observable results for the same inputs.
```

```
INTENT CHECK — processTwineDegrade
  code does:      (per spec) decrements b.twineAngle by 1°/call as remaining-bend accumulator
  check expects:  (TWE9 assertion 2) b.twineAngle === 0 and b.angle === originalAngle after 24 calls
  spec says:      twineAngle is "bend angle applied by twine action" (historical delta)
  verdict:        CONFLICT on field semantics; no correctness issue for the test assertion itself,
                  but field meaning diverges from JSDoc definition during degrade phase.
```

---

## ADDITIONAL OPEN QUESTION

### OQ-6 [REQUIRED before implementation] — Spring-back model confirmation

Per OQ-3 analysis: Jeremy must confirm time-ratio spring-back is the intended model
for twine and weight before the implementer writes `removeTwine` and `removeWeight`.
A one-line DECISIONS.md entry suffices:

> "R-SPRING-MODEL: time-ratio spring-back (1 − daysApplied/setDays) confirmed for
> all three techniques (wire, twine, weight). Stress-ratio model abandoned per
> CRITICAL-C analysis."

---

## REQUIRED ACTIONS BEFORE IMPLEMENTER PROCEEDS

```
REQUIRED (blocking implementation):
  1. Jeremy confirm OQ-1: Option A / B / C for weightAppliedDay / weightAngleDelta.
  2. Correct TWE6 assertions 3 & 4: pick Option A/B/C in BLOCKER-1 above.
  3. Correct TWE1 assertion 2: replace contradictory branchId=0 prune setup.
  4. Jeremy confirm OQ-3 / OQ-6: time-ratio spring-back model sign-off. Log in DECISIONS.md.

REQUIRED (low cost, do before implementation):
  5. Update twineAngle JSDoc in shared/index.ts to document mid-degrade semantics.
  6. Specify that TWE9 assertion 1 uses storedDegradeDays=10 parameter directly (not RNG).
  7. Clarify that TWE5 uses a fresh tree instance, not the shared 30-day preamble.

ADVISORY (can proceed with, document in DECISIONS.md):
  8. Jeremy confirm OQ-5: already-weighted replace/stack/reject semantics.
  9. TWE2 assertion 3: add branch angle constraint (> 33.73°) to prevent polar-clamp ambiguity.
```

---

## BOTTOM LINE

The implementation pseudocode is sound and internally consistent with WireEngine's
gate-verified model. OQ-1 is genuinely blocking for weight spring-back and the spec
correctly provides Tier A/B paths. The two blockers are both in the gate test spec,
not in the physics logic: TWE6 tests the wrong interface (BonsaiTree throws where the
test expects a return value), and TWE1 gives contradictory instructions for the pruned
branch test case. Fix these before handing to the implementer; the rest of the spec
is ready to build against.
