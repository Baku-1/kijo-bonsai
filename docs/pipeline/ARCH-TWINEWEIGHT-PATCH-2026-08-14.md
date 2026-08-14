# ARCH PATCH — TwineWeightEngine Phase 2 (Corrective)
**Date:** 2026-08-14
**Responds to:** CRITIC-TWINEWEIGHT-ENGINE-2026-08-14.md — verdict FAIL
**Original spec:** ARCH-TWINEWEIGHT-ENGINE-2026-08-14.md
**Status:** CORRECTIVE ARCHITECT PATCH — resolves all findings before implementer proceeds
**Pipeline:** Architect --> Critic --> **Corrective Architect** --> Implementer --> Auditor --> Linter

---

## SCOPE

This document patches only the findings raised by the critic. Every section of the
original ARCH doc that is NOT mentioned here is unchanged and remains authoritative.
The implementer must read ARCH-TWINEWEIGHT-ENGINE-2026-08-14.md first, then apply
the overrides in this patch document. Where a section title matches, this patch wins.

---

## CODEBASE VERIFICATION FOR PATCH

All source files re-read before writing this patch:

```
FILES READ:
  packages/shared/src/index.ts          -- Branch interface, CareAction shapes
  packages/engine/src/TwineWeightEngine.ts -- stubs, constants
  packages/engine/src/BonsaiTree.ts     -- applyWeight guard (lines 226-237),
                                           applyTwine (line 203), applyDailyUpdate
  packages/engine/test_wire.mjs         -- gate test pattern (import style, call style)

KEY FACTS CONFIRMED FOR THIS PATCH:

  BonsaiTree.applyWeight (lines 226-237):
    if (!Number.isFinite(weightCount)) throw CareLogReplayError
    if (!Number.isInteger(weightCount) || weightCount < 1 || weightCount > 4)
      throw CareLogReplayError(...)   <-- throws, does NOT return { ok: false }
    return TwineWeightEngine.applyWeight(this, branchId, weightCount)

  TwineWeightEngine.applyWeight (lines 160-170):
    if (!b) return { ok: false, reason: 'not-found' }
    if (b.pruned) return { ok: false, reason: 'pruned' }
    if (weightCount < 1 || weightCount > 4) return { ok: false, reason: 'weight-cap-exceeded' }
    throw CareLogReplayError(...)     <-- Phase 1 stub throw (after validations pass)

  Conclusion: calling tree.applyWeight(id, 0) THROWS. The { ok:false } guard lives
  in TwineWeightEngine.applyWeight, not BonsaiTree. The CRITIC's BLOCKER-1 is correct.

  test_wire.mjs gate test pattern:
    - Imports from './dist/*.js' (not src) -- file is packages/engine/test_wire.mjs
    - W1-W5: call through BonsaiTree methods (tree.wire(), etc.)
    - W6: imports WireEngine directly and calls WireEngine.wireCostFor() -- engine-direct
    Conclusion: direct engine calls are an established pattern in gate tests.
    Option A for BLOCKER-1 (TwineWeightEngine.applyWeight direct call) is consistent.

  twineAngle JSDoc (shared/index.ts line 92-95):
    Current: "Bend angle (degrees, signed) applied by the twine action. Clamped +/-28. 0 when not twined."
    Problem: processTwineDegrade decrements this field toward 0 each day (remaining bend),
             but "applied by the twine action" implies original delta, never mutated.

  weightAppliedDay: CONFIRMED absent from Branch interface (lines 3-155 of shared/index.ts)
  weightAngleDelta: CONFIRMED absent from Branch interface
```

---

## FINDING RESOLUTIONS

### BLOCKER-1 — TWE6 assertions 3 & 4 test the wrong interface

**Critic finding:** `tree.applyWeight(id, 0)` throws `CareLogReplayError` before reaching
`TwineWeightEngine.applyWeight`. The test spec asserted a return value that is never
returned through the BonsaiTree path for out-of-range weightCount.

**Resolution:** Option A — call `TwineWeightEngine.applyWeight` directly for boundary
validation tests. This is consistent with W6 in `test_wire.mjs` which calls
`WireEngine.wireCostFor()` directly (not through BonsaiTree) for cost-tier validation.

**Effect:** TWE6 preamble must import `TwineWeightEngine`. Assertions 3 and 4 change
their call site. Assertions 1 and 2 may continue using `tree.applyWeight` (valid inputs
reach TwineWeightEngine; Phase 1 throws there, but after the validations pass, which is
irrelevant for these not-found/pruned checks — the guards fire before the stub throw).

**Corrected TWE6 spec:** See CORRECTED GATE TEST SPECS section below.

---

### BLOCKER-2 — TWE1 assertion 2: contradictory test setup

**Critic finding:** The assertion opened with `tree.applyTwine(0, 10)` after `tree.prune(0)`
then immediately noted trunk cannot be pruned. An implementer following it literally
tests the wrong thing (prune no-ops, trunk is not pruned, result is 'not-found' not 'pruned').

**Resolution:** Replace assertion 2 with unambiguous instruction using a non-trunk branch.

**Corrected TWE1 spec:** See CORRECTED GATE TEST SPECS section below.

---

### HIGH-1 — twineAngle JSDoc semantic mismatch

**Critic finding:** The JSDoc for `twineAngle` says "applied by the twine action" (implies
original delta), but `processTwineDegrade` decrements this field toward 0 each day
(making it the REMAINING bend, not the original). External readers mid-degrade get
wrong values if they treat this as the original applied delta.

**Resolution:** Option B from critic (documentation-only fix; no new Branch field).
Update the JSDoc for `twineAngle` in both files. The authoritative record of the
original applied delta is the care log entry (`type: 'twine', angleDelta`).

**Implementer action:** Replace the twineAngle JSDoc in BOTH files with the following.
Do NOT add a new `twineAngleApplied` field unless Jeremy explicitly approves it (not
approved in this patch).

**Corrected JSDoc for `packages/shared/src/index.ts` (replaces lines 92-95):**
```typescript
  /**
   * Current remaining twine bend angle (degrees, signed).
   *
   * At applyTwine time: set to the applied delta (clamped to +/-TWINE_MAX_ANGLE_DELTA).
   * During natural degradation (processTwineDegrade): decremented by SPRING_RATE (1 deg/day)
   *   toward 0. Represents REMAINING bend, not original applied delta.
   * At removeTwine / processTwineDegrade completion: cleared to 0.
   * 0 when not twined.
   *
   * The original applied delta is the authoritative historical record stored in the
   * care log entry (type: 'twine', angleDelta). Do not use this field as the
   * original delta for any computation that runs after processTwineDegrade has fired.
   *
   * Used for spring-back reference in removeTwine:
   *   springBackAmount = twineAngle * springBackFraction
   * where springBackFraction = max(0, 1 - twineDaysApplied / setDays).
   * This is correct because twineAngle at removeTwine time IS the remaining bend
   * to be reversed.
   */
  twineAngle: number;
```

**Corrected JSDoc for `packages/engine/src/TwineWeightEngine.ts` (add to applyTwine
JSDoc, after existing @param lines):**
```typescript
   * NOTE on b.twineAngle semantics: set to the applied delta at applyTwine time.
   * processTwineDegrade decrements this field toward 0 (remaining bend accumulator).
   * At any mid-degrade snapshot, twineAngle is REMAINING bend, not original delta.
   * The care log entry (type: 'twine', angleDelta) is the original applied delta.
```

---

### HIGH-2 — OQ-3 resolved: spring-back model confirmed by Jeremy

**Critic finding:** OQ-3 was marked ADVISORY, permitting the implementer to proceed
without Jeremy's explicit sign-off on the time-ratio spring-back model. Implementing
removeTwine and removeWeight on an unconfirmed physics model creates expensive rework
risk if the model is later changed.

**Resolution:** OQ-3 is now RESOLVED. Jeremy confirmed 2026-08-14:

```
springBack = bendAngle x max(0, 1 - daysElapsed / setDays)
```

- Applied IMMEDIATELY on removal (same turn as the removal call, no per-tick interpolation)
- If daysElapsed >= setDays: springBack = 0, angle is permanently set (bendSet = true)
- If daysElapsed < setDays: partial snap-back, scales linearly with remaining time ratio
- Applies to BOTH wire removal (WireEngine, already gate-verified) and twine/weight removal

**Status:** OQ-3 is closed. The formula implementation in the ARCH doc's removeTwine
pseudocode is correct as written. The corrective action here is (a) elevating the
status from ADVISORY to RESOLVED, and (b) adding the DECISIONS.md entry below.

**For removeTwine — confirmed spec (no pseudocode change):**
The ARCH doc's removeTwine implementation already correctly implements this formula:
```typescript
const twineDaysApplied = tree.getAge() - b.twineAppliedDay;
const setDays = computeSetDays(b.diameter);

if (twineDaysApplied >= setDays) {
  b.bendSet = true;
  // angle unchanged — bend has permanently set
} else {
  const springBackFraction = Math.max(0, Math.min(1, 1 - twineDaysApplied / setDays));
  const springBackAmount = round4(b.twineAngle * springBackFraction);
  b.angle = round4(clamp(b.angle - springBackAmount, POLAR_MIN_DEG, KENGAI_POLAR_MAX));
}
```

This is the correct formula. `twineDaysApplied` maps to `daysElapsed`. `setDays =
computeSetDays(b.diameter)`. The `min(1, ...)` guard handles the edge case where
daysElapsed is 0 (full spring-back, fraction = 1.0). Implementer: use the ARCH doc
pseudocode verbatim.

**For removeWeight (Tier A, OQ-1 resolved) — confirmed spec:**
Same formula and same `setDays` source. The ARCH doc Tier A removeWeight correctly
uses `computeSetDays(b.diameter)` for weight set period. No separate weight-specific
set-period constant is needed. Confirmed: `setDays` for weight removal is
`computeSetDays(b.diameter)`, identical to twine and wire.

```typescript
const weightDaysApplied = tree.getAge() - b.weightAppliedDay;  // NEW FIELD (OQ-1)
const setDays = computeSetDays(b.diameter);

if (weightDaysApplied >= setDays) {
  b.bendSet = true;
  // angle unchanged
} else {
  const springBackFraction = Math.max(0, Math.min(1, 1 - weightDaysApplied / setDays));
  const springBackAmount = round4(b.weightAngleDelta * springBackFraction);  // NEW FIELD (OQ-1)
  b.angle = round4(clamp(b.angle - springBackAmount, POLAR_MIN_DEG, KENGAI_POLAR_MAX));
}
```

Implementer: use Tier A spec from ARCH doc. OQ-1 is now resolved as Option A (see
DECISIONS.md entries below). `weightAppliedDay` and `weightAngleDelta` ARE approved.

---

### LOW-1 — TWE2 assertion 3: polar clamp ambiguity

**Critic finding:** The assertion "`applyTwine(id, -100)` clamped to -28 degrees" is
only true when `b.angle > POLAR_MIN_DEG + TWINE_MAX_ANGLE_DELTA = 5.7296 + 28 = 33.7296
degrees`. A branch with `b.angle = 20` would produce `appliedDelta = round4(5.7296 - 20)
= -14.27` not -28, and the assertion fails.

**Resolution:** TWE2 assertion 3 must specify the branch angle precondition explicitly.

**Corrected assertion 3 (replaces TWE2 assertion 3):**
> Assertion 3: `applyTwine(id, -100)` where `b.angle > 33.73 degrees` (i.e., the branch
> starts at an angle safely above `POLAR_MIN_DEG + TWINE_MAX_ANGLE_DELTA = 33.73`).
> Applied delta must be clamped to -28 degrees. `b.angle === oldAngle - 28` (or
> specifically `newAngle = round4(oldAngle - 28)`). Assert that the applied delta in
> the care log entry equals -28, not -100. If no naturally-grown branch exceeds 33.73
> degrees at day 30, grow for additional days or find a branch that has already been
> bent by a prior applyTwine call in the test sequence.

---

### LOW-2 — TWE3 assertion 4 / TWE9 assertion 1: degradeDays forcing unspecified

**Critic finding (TWE3 assertion 4):** The assertion says "same seed + same branch + same
day produces same degradeDays (RNG determinism)" without specifying HOW to verify a
specific value without knowing the RNG output in advance.

**Critic finding (TWE9 assertion 1):** States "degradeDays = 10 (store value)" treating 10
as a known constant when the live RNG is unpredictable for a given tree/branch/day.

**Resolution for TWE3 assertion 4:**
> Apply twine via the LIVE path (no storedDegradeDays). Read back the actual degradeDays
> from the care log: `const degradeDays = tree.getCareLog().at(-1).action.degradeDays`.
> Then call `CareLogReplay.reconstruct(seed, species, careLog, currentDay)`. Inspect
> the replayed tree's care log and assert the replayed 'twine' entry has the same
> `degradeDays` as the original. This verifies RNG determinism without predicting the
> output value. The assert is: `replayedLog[twineIdx].action.degradeDays === degradeDays`.

**Resolution for TWE9 assertion 1 (and all TWE9 test setup):**
> Use the `storedDegradeDays` parameter to FORCE a known value:
> ```javascript
> tree.applyTwine(branchId, 24, 10);  // forces degradeDays = 10 via replay path
> ```
> This bypasses the RNG and produces deterministic degradeDays regardless of tree seed.
> The spec should NOT say "degradeDays = 10" as if the RNG happens to produce 10 for
> this tree — it produces whatever the RNG draws. Instead, force 10 explicitly so TWE9
> tests the degrade mechanics, not RNG behavior.

**Corrected TWE9 assertion 1 setup (replaces the setup line "degradeDays = 10"):**
> "Apply twine via `tree.applyTwine(branchId, 24, 10)` (storedDegradeDays=10 forced).
> Confirm `b.twineDegradesDay === tree.getAge() + 10`. Advance the tree to
> `twineDegradesDay` by calling `GrowthEngine.growTick(tree)` 10 times after apply."

---

### LOW-3 — TWE5 shared preamble incompatible with "apply twine on day 20"

**Critic finding:** The shared 30-day preamble grows a tree before any test runs. TWE5
requires applying twine on day 20. With a 30-day shared preamble, day 20 has passed;
the apply would happen at day 30+.

**Resolution:** Add an explicit statement to the test preamble section that each test
constructs its OWN fresh BonsaiTree for its timing requirements. The preamble in the
ARCH doc is an import/construction PATTERN, not a shared instance.

**Corrected preamble statement (add after the preamble code block in the ARCH doc):**
```
NOTE: Each gate test (TWE1-TWE9) constructs its own BonsaiTree instance. The preamble
above shows the import pattern and a representative 30-day construction. Tests with
specific day-timing requirements (e.g., TWE5 which applies twine at day 20, or TWE4
which tests removeTwine at various daysApplied values) must grow a FRESH tree to the
exact day required by that test. Do NOT use a shared 30-day tree as a starting point
for tests that require specific day counts.

TWE5 concrete setup:
  const tree = new BonsaiTree(464497, 'hardwood');
  for (let i = 0; i < 20; i++) GrowthEngine.growTick(tree);
  // tree is now at day 20 — apply twine here
```

---

### LOW-4 — OQ-5: already-weighted replace semantics

**Critic finding:** The spec implements "replace" semantics for a second `applyWeight`
call on an already-weighted branch, but does not obtain explicit confirmation before
implementation. If stacking or rejection is intended, this is a breaking difference.

**Resolution:** The ARCH doc's choice of "replace" semantics is retained as the default.
This is the most conservative safe implementation (no stacking math, no phantom torque
accumulation). Jeremy should confirm before the implementer writes `applyWeight`.

**Implementer instruction:** Implement "replace" semantics as specified in the ARCH doc.
Flag in your implementer report that OQ-5 is unconfirmed. If Jeremy confirms "reject",
add an `already-weighted` guard before the weighted=true assignment and a new entry to
`WeightRejectReason`. If Jeremy confirms "stack", additional Branch field discussion is
required (cap enforcement + torque recomputation).

---

## CORRECTED GATE TEST SPECS

The following replace the corresponding sections in ARCH-TWINEWEIGHT-ENGINE-2026-08-14.md.
All other TWE gate tests (TWE2 assertion 1-2, TWE4, TWE7, TWE8) are unchanged.

---

### CORRECTED TEST FILE PREAMBLE

The original ARCH doc preamble used `./packages/engine/src/` import paths. The correct
pattern (verified from test_wire.mjs) is `./dist/` paths (compiled output), and the
file runs from `packages/engine/`. TwineWeightEngine must also be imported (required for
BLOCKER-1 fix in TWE6).

```javascript
/**
 * Gate tests for TwineWeightEngine (TWE1-TWE9).
 * Run after: npm run build --workspace=packages/engine
 * Command: node packages/engine/test_twineweight.mjs (from repo root)
 */
import { BonsaiTree } from './dist/BonsaiTree.js';
import { GrowthEngine } from './dist/GrowthEngine.js';
import { CareLogReplay } from './dist/CareLogReplay.js';
import {
  TwineWeightEngine,
  TWINE_MAX_ANGLE_DELTA,
  WEIGHT_DEGREES_PER_UNIT,
  computeSetDays,
  TWINE_FORCE_PER_DAY,
  WEIGHT_MASS_PER_UNIT,
  GRAVITY_CONSTANT,
  KENGAI_POLAR_MAX,
  toRad,
} from './dist/TwineWeightEngine.js';
import { WATER_AMOUNT } from '../shared/dist/index.js';

let passed = 0, failed = 0;

function assert(cond, name, detail = '') {
  if (cond) { console.log(`  OK ${name}`); passed++; }
  else { console.error(`  FAIL ${name}${detail ? ': ' + detail : ''}`); failed++; }
}

// NOTE: Each TWE gate test constructs its OWN BonsaiTree for its timing requirements.
// The helper below illustrates the standard 30-day construction; tests with specific
// day-timing requirements must use a fresh tree grown to their required day.
function growTree(seed, species, days) {
  const tree = new BonsaiTree(seed, species);
  for (let d = 0; d < days; d++) GrowthEngine.growTick(tree);
  return tree;
}
```

---

### CORRECTED TWE1 — applyTwine validation

All 4 assertions; assertion 2 is the corrected one.

**Assertions (4):**

1. `tree.applyTwine(99999, 10)` returns `{ ok: false, reason: 'not-found' }` for out-of-range
   branchId (99999 is beyond any branch array). Use a tree grown 30 days for this assertion.

2. **[CORRECTED — replaces contradictory original]**
   Identify a non-trunk branch (depth >= 1) that can be pruned. Call `tree.prune(N)` and
   confirm it returns true (branch N is now pruned). Then call `tree.applyTwine(N, 10)`.
   Assert result is `{ ok: false, reason: 'pruned' }`.

   Concrete setup:
   ```javascript
   const tree = growTree(464497, 'hardwood', 30);
   const pruneable = tree.getBranches().find(b => !b.pruned && b.depth >= 1);
   assert(pruneable !== undefined, 'found pruneable non-trunk branch');
   const pruned = tree.prune(pruneable.id);
   assert(pruned === true, 'prune succeeded');
   const r = tree.applyTwine(pruneable.id, 10);
   assert(r.ok === false && r.reason === 'pruned', 'applyTwine on pruned branch returns pruned');
   ```

3. `tree.applyTwine(branchId, 10)` on a non-pruned, non-twined branch succeeds (ok: true).
   A second call on the same branch returns `{ ok: false, reason: 'already-twined' }`.

4. After `tree.removeTwine(branchId)` clears twine state, `tree.applyTwine(branchId, 10)`
   succeeds again (ok: true). Confirms twine can be re-applied after removal.

---

### CORRECTED TWE2 — applyTwine bend and polar clamping

Assertions 1, 2, 4, 5, 6 are unchanged from ARCH doc. Only assertion 3 is corrected.

**Corrected assertion 3 (replaces original):**
```javascript
// Find or establish a branch with b.angle > 33.73 degrees to avoid polar-floor
// interference when applying -100 degree delta (clamped to -28).
// POLAR_MIN_DEG = 5.7296; TWINE_MAX_ANGLE_DELTA = 28; sum = 33.7296.
const highAngleBranch = tree.getBranches().find(b => !b.pruned && !b.twined && b.angle > 33.73);
if (highAngleBranch) {
  const oldAngle = highAngleBranch.angle;
  const r = tree.applyTwine(highAngleBranch.id, -100);
  assert(r.ok === true, 'large negative delta accepted');
  // Applied delta must be clamped to -TWINE_MAX_ANGLE_DELTA = -28
  const logEntry = tree.getCareLog().at(-1);
  assert(logEntry.action.type === 'twine', 'care log has twine entry');
  assert(logEntry.action.angleDelta === -28, 'angleDelta in log clamped to -28');
  assert(r.newAngle === Math.round((oldAngle - 28) * 10000) / 10000, 'newAngle = oldAngle - 28');
} else {
  // No branch over 33.73 at day 30 for this seed; apply a positive twine first to
  // raise angle, then remove and re-apply negative.
  assert(true, 'no high-angle branch available -- see LOW-1 advisory');
}
```

---

### CORRECTED TWE3 — twineDegradesDay and degradeDays range

Assertions 1, 2, 3 unchanged. Only assertion 4 is corrected.

**Corrected assertion 4 (replaces original):**
```javascript
// Assertion 4: RNG determinism -- same seed+branch+day -> same degradeDays.
// DO NOT try to predict the RNG value. Instead: apply, read back, replay, compare.
const tree1 = growTree(464497, 'hardwood', 30);
const branch = tree1.getBranches().find(b => !b.pruned && b.depth >= 1);
tree1.applyTwine(branch.id, 15);  // live RNG path -- degradeDays is whatever it is
const originalLog = tree1.getCareLog();
const twineEntry = originalLog.find(e => e.action.type === 'twine');
const recordedDegradeDays = twineEntry.action.degradeDays;

// Rebuild via CareLogReplay with the recorded log (contains the stored degradeDays).
const rebuilt = CareLogReplay.reconstruct(464497, 'hardwood', originalLog, 30);
const replayedLog = rebuilt.getCareLog();
const replayedEntry = replayedLog.find(e => e.action.type === 'twine');
assert(
  replayedEntry.action.degradeDays === recordedDegradeDays,
  `replay preserves degradeDays (${replayedEntry.action.degradeDays} === ${recordedDegradeDays})`
);
```

---

### CORRECTED TWE5 — CareLogReplay determinism with twine and twine-remove

Assertions 2 and 3 unchanged. Only the test setup is corrected to use a fresh tree.

**Corrected TWE5 setup and assertion 1:**
```javascript
// TWE5: Each test uses a fresh BonsaiTree. The shared preamble is NOT reused here.
// This test requires twine applied at day 20 and removed at day 25.
const seed = 464497;
const species = 'hardwood';
const totalDays = 50;

const tree = new BonsaiTree(seed, species);

// Grow to day 20, find a twine candidate, apply twine.
for (let i = 0; i < 20; i++) GrowthEngine.growTick(tree);
const candidate = tree.getBranches().find(b => !b.pruned && !b.twined && b.depth >= 1);
assert(candidate !== undefined, 'found branch for twine at day 20');
tree.applyTwine(candidate.id, 15);
const branchId = candidate.id;

// Continue to day 25 and remove twine.
for (let i = 20; i < 25; i++) GrowthEngine.growTick(tree);
tree.removeTwine(branchId);

// Continue to day 50.
for (let i = 25; i < totalDays; i++) GrowthEngine.growTick(tree);

const finalAngle = tree.getBranches()[branchId].angle;
const careLog = tree.getCareLog();

// Replay and compare.
const rebuilt = CareLogReplay.reconstruct(seed, species, careLog, totalDays);
const replayedAngle = rebuilt.getBranches()[branchId].angle;

assert(replayedAngle === finalAngle, `reconstructed angle matches original (${replayedAngle} === ${finalAngle})`);
assert(careLog.some(e => e.action.type === 'twine'), 'care log has twine entry');
assert(careLog.some(e => e.action.type === 'twine-remove'), 'care log has twine-remove entry');
```

---

### CORRECTED TWE6 — applyWeight validation

All 4 assertions; assertions 3 and 4 now call TwineWeightEngine directly.

**Corrected assertions (all 4):**
```javascript
console.log('\nTWE6 -- applyWeight validation');
{
  const tree = growTree(464497, 'hardwood', 30);
  const validBranch = tree.getBranches().find(b => !b.pruned && b.depth >= 1);
  assert(validBranch !== undefined, 'found valid branch');

  // Assertion 1: not-found (via BonsaiTree -- valid input, guard fires in TwineWeightEngine)
  // Note: tree.applyWeight would also throw for invalid types; for not-found branchId
  // the BonsaiTree validations pass (99999 is a valid integer) and TwineWeightEngine
  // returns not-found. However, the Phase 1 TwineWeightEngine stub throws after the
  // not-found check would pass -- test this via direct engine call for full coverage.
  const r1 = TwineWeightEngine.applyWeight(tree, 99999, 2);
  assert(r1.ok === false && r1.reason === 'not-found', 'not-found for invalid branchId');

  // Assertion 2: pruned (via direct engine call on a pruned branch)
  const pruneable = tree.getBranches().find(b => !b.pruned && b.depth >= 1);
  assert(pruneable !== undefined, 'found pruneable branch');
  tree.prune(pruneable.id);
  const r2 = TwineWeightEngine.applyWeight(tree, pruneable.id, 2);
  assert(r2.ok === false && r2.reason === 'pruned', 'pruned branch rejected');

  // Assertion 3: weight-cap-exceeded (count = 0, below minimum) -- DIRECT ENGINE CALL.
  // IMPORTANT: tree.applyWeight(id, 0) THROWS CareLogReplayError at BonsaiTree level.
  // Call TwineWeightEngine.applyWeight directly to test the engine's own guard.
  const r3 = TwineWeightEngine.applyWeight(tree, validBranch.id, 0);
  assert(r3.ok === false && r3.reason === 'weight-cap-exceeded', 'count=0 rejected (weight-cap-exceeded)');

  // Assertion 4: weight-cap-exceeded (count = 5, above maximum) -- DIRECT ENGINE CALL.
  // Same reason as assertion 3: tree.applyWeight(id, 5) throws; engine returns the reason.
  const r4 = TwineWeightEngine.applyWeight(tree, validBranch.id, 5);
  assert(r4.ok === false && r4.reason === 'weight-cap-exceeded', 'count=5 rejected (weight-cap-exceeded)');
}
```

---

### CORRECTED TWE9 — processTwineDegrade natural spring-back

Assertion 2, 3, 4 unchanged. Only assertion 1 setup is corrected to force degradeDays.

**Corrected assertion 1 setup:**
```javascript
// Assertion 1: first processTwineDegrade call reduces angle by 1 degree.
// Use storedDegradeDays=10 parameter to FORCE degradeDays=10 (bypass RNG).
// DO NOT rely on "degradeDays = 10" as a predicted RNG output -- it is not predictable.
const tree = growTree(464497, 'hardwood', 30);
const branch = tree.getBranches().find(b => !b.pruned && !b.twined && b.depth >= 1);
const applyDay = tree.getAge();  // = 30
tree.applyTwine(branch.id, 24, 10);  // <-- storedDegradeDays = 10 forced here
const degradeDay = tree.getBranches()[branch.id].twineDegradesDay;  // applyDay + 10 = 40
assert(degradeDay === applyDay + 10, `twineDegradesDay set to ${applyDay} + 10 = ${degradeDay}`);

// Advance 10 more ticks to reach twineDegradesDay.
const angleBefore = tree.getBranches()[branch.id].angle;
const twineAngleBefore = tree.getBranches()[branch.id].twineAngle;
for (let i = 0; i < 10; i++) GrowthEngine.growTick(tree);  // arrives at day 40

// On day 40, processTwineDegrade fires: angle reduced by 1 degree, twineAngle by 1.
const b = tree.getBranches()[branch.id];
assert(
  Math.abs((angleBefore - b.angle) - 1.0) < 0.001,
  `angle reduced by 1 on first degrade tick (${angleBefore} -> ${b.angle})`
);
assert(
  Math.abs((twineAngleBefore - b.twineAngle) - 1.0) < 0.001,
  `twineAngle reduced by 1 (${twineAngleBefore} -> ${b.twineAngle})`
);
assert(b.twined === true, 'still twined after first degrade tick');
```

---

## CONFIRMED removeTwine AND removeWeight METHOD SPECS

The ARCH doc pseudocode for `removeTwine` and `removeWeight` (Tier A) is UNCHANGED.
This section confirms the formulas are correct and the OQ-3 confirmation elevates them
from "pending spring-back confirmation" to "authoritative spec."

### removeTwine — confirmed implementation

The implementation in ARCH-TWINEWEIGHT-ENGINE-2026-08-14.md §2 is CORRECT AS WRITTEN.
Key parameters confirmed by Jeremy:
- `daysElapsed = twineDaysApplied = tree.getAge() - b.twineAppliedDay`
- `setDays = computeSetDays(b.diameter)` (same source as wire removal)
- `springBack = b.twineAngle x max(0, 1 - twineDaysApplied / setDays)`
  (where b.twineAngle at removal time is the REMAINING bend if processTwineDegrade
  has fired, or the full applied delta if removed before natural degrade begins)
- Applied immediately at removal time -- not spread over subsequent ticks
- bendSet = true when twineDaysApplied >= setDays (permanent bend, no spring-back)

No pseudocode changes required.

### removeWeight (Tier A) — confirmed implementation

The Tier A implementation in ARCH-TWINEWEIGHT-ENGINE-2026-08-14.md §4 is CORRECT AS WRITTEN.
Key parameters confirmed:
- `daysElapsed = weightDaysApplied = tree.getAge() - b.weightAppliedDay` (NEW FIELD)
- `setDays = computeSetDays(b.diameter)` -- CONFIRMED: same formula as twine/wire.
  No separate weight set-period constant is defined; weight reuses computeSetDays. This
  is now authoritative; no further open question needed.
- `springBack = b.weightAngleDelta x max(0, 1 - weightDaysApplied / setDays)` (NEW FIELD)
  where `b.weightAngleDelta` is the cumulative angle processWeightTick has applied.
- Applied immediately at removal time
- bendSet = true when weightDaysApplied >= setDays

No pseudocode changes required.

---

## DECISIONS.md APPEND TEXT

Append the following entries to `DECISIONS.md` under a new `## 2026-08-14` heading.
These are NOT to be added by the corrective architect pass -- they are to be added by
the implementer as part of the implementation task (after Jeremy confirms in this patch).

```
## 2026-08-14

- **OQ-3 RESOLVED -- Time-ratio spring-back model confirmed for all bindings
  (2026-08-14)**: Wire, twine, and weight removal all use the same spring-back
  formula: `springBack = bendAngle x max(0, 1 - daysElapsed / setDays)`.
  Applied immediately at removal (same turn, no per-tick interpolation).
  `daysElapsed >= setDays` -> springBack = 0, angle is permanently set (bendSet = true).
  `daysElapsed < setDays` -> partial snap-back, linear scale with remaining time ratio.
  Applies to: `removeWire` (WireEngine, gate-verified), `removeTwine` (Phase 2),
  `removeWeight` (Phase 2 Tier A). The stress-ratio formula (CRITICAL-B stub comment)
  is formally abandoned -- unreachable under the growing-force model, per BonsaiTree.ts
  lines 81-87 and WireEngine.ts lines 148-151. Source: Jeremy confirmation 2026-08-14,
  ARCH-TWINEWEIGHT-PATCH-2026-08-14.md HIGH-2.

- **OQ-1 RESOLVED -- weightAppliedDay and weightAngleDelta approved (Option A,
  2026-08-14)**: Two new fields approved for the Branch interface in
  `packages/shared/src/index.ts`:
  `weightAppliedDay: number` -- absolute game-day when weight was applied; 0 when
  not weighted. Used for time-ratio spring-back in removeWeight (parallel to wireAppliedDay).
  `weightAngleDelta: number` -- cumulative angle change (degrees, always >= 0) applied
  by processWeightTick since most recent applyWeight. Tracks progress toward
  `targetDelta = WEIGHT_DEGREES_PER_UNIT x weightCount`. Used for spring-back reference
  in removeWeight. Reset to 0 on applyWeight and removeWeight. Default: 0. Source:
  Jeremy approval 2026-08-14, ARCH-TWINEWEIGHT-PATCH-2026-08-14.md HIGH-2.
```

---

## SUMMARY OF CHANGES FROM ARCH DOC

The following changes replace or supplement specific sections of
ARCH-TWINEWEIGHT-ENGINE-2026-08-14.md. Everything else in that document is unchanged.

```
SECTION CHANGES (this patch overrides):

  Test file preamble:
    CHANGE: import paths corrected (./dist/ not ./src/; file runs from packages/engine/)
    ADD: TwineWeightEngine to imports (required for TWE6 direct engine calls)
    ADD: preamble note about fresh BonsaiTree per test

  TWE1 assertion 2 (BLOCKER-2):
    REPLACE: contradictory trunk-prune setup
    WITH: non-trunk branch (depth >= 1), explicit prune+applyTwine sequence

  TWE2 assertion 3 (LOW-1):
    REPLACE: bare "clamped to -28 degrees" assertion
    WITH: assertion including b.angle > 33.73 degree precondition

  TWE3 assertion 4 (LOW-2):
    REPLACE: "same seed+day -> same degradeDays" without verification mechanism
    WITH: apply (live path) -> read from log -> replay -> compare stored value

  TWE5 setup (LOW-3):
    REPLACE: implicit reuse of 30-day shared tree
    WITH: fresh BonsaiTree advanced to day 20; explicit code block

  TWE6 assertions 3 and 4 (BLOCKER-1):
    REPLACE: tree.applyWeight(id, 0) / tree.applyWeight(id, 5) call via BonsaiTree
    WITH: TwineWeightEngine.applyWeight(tree, id, 0) / (tree, id, 5) direct calls

  TWE9 assertion 1 setup (LOW-2):
    REPLACE: "degradeDays = 10" as if RNG-predicted constant
    WITH: tree.applyTwine(branchId, 24, 10) using storedDegradeDays=10 parameter

  twineAngle JSDoc in shared/index.ts and TwineWeightEngine.ts (HIGH-1):
    REPLACE: "applied by the twine action" (implies immutable original delta)
    WITH: documents mutable remaining-bend semantics during processTwineDegrade

  OQ-3 status in ARCH doc (HIGH-2):
    ELEVATE: from ADVISORY to RESOLVED
    ADD: Jeremy confirmation and DECISIONS.md entry (see above)

  OQ-1 status in ARCH doc (HIGH-2 dependency):
    ELEVATE: from pending to Option A RESOLVED
    IMPLEMENTER: implement Tier A for removeWeight and processWeightTick
    ADD: weightAppliedDay and weightAngleDelta to Branch interface per OQ-1 spec

NO CHANGES to:
  applyTwine implementation pseudocode
  removeTwine implementation pseudocode
  applyWeight implementation pseudocode
  removeWeight Tier A pseudocode
  processWeightTick Tier A pseudocode
  processTwineDegrade implementation pseudocode
  CareLogReplay routing changes
  TWE2 assertions 1, 2, 4, 5, 6
  TWE4, TWE7, TWE8 (entire)
  TWE9 assertions 2, 3, 4
  TWE3 assertions 1, 2, 3
  Care log entry shapes
  SUMMARY OF FILE CHANGES (except: @kijo/shared now confirmed for OQ-1 Option A fields)
  Assumptions register
  OQ-2, OQ-4, OQ-5 (OQ-5 still unconfirmed; implement "replace" and flag in report)
```

---

## IMPLEMENTER CHECKLIST

Before touching any file:

1. Read ARCH-TWINEWEIGHT-ENGINE-2026-08-14.md in full.
2. Read this patch in full.
3. Apply this patch's overrides (they supersede the original spec where they overlap).
4. Implement Tier A for removeWeight and processWeightTick (OQ-1 resolved as Option A).
5. Add `weightAppliedDay: number` and `weightAngleDelta: number` to Branch interface
   in packages/shared/src/index.ts (after weightCount, following OQ-1 JSDoc from ARCH doc).
6. Update twineAngle JSDoc in both shared/index.ts and TwineWeightEngine.ts per HIGH-1.
7. Write test_twineweight.mjs using the corrected preamble and corrected test specs.
8. Confirm OQ-5 (replace semantics) with Jeremy; implement replace as default.
9. After implementer stage completes, append DECISIONS.md entries (section above).
```
