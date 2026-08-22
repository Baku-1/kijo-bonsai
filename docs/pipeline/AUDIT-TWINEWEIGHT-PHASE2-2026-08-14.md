# AUDIT — TwineWeightEngine Phase 2
**Date:** 2026-08-14
**Audits:** IMPL-TWINEWEIGHT-ENGINE-2026-08-14.md
**Spec refs:** ARCH-TWINEWEIGHT-ENGINE-2026-08-14.md + ARCH-TWINEWEIGHT-PATCH-2026-08-14.md
**Critic pre-check:** CRITIC-TWINEWEIGHT-PATCH-2026-08-14.md
**Pipeline:** Architect → Critic → Corrective Architect → Critic (patch) → Implementer → **Auditor** → Linter
**Skill:** adversarial-auditor (loaded before all file reads)

---

## VERDICT: VERIFIED WITH CAVEATS

Core behavior is correct. The 49/49 npm test claim is observed true. tsc is clean.
Three caveats require action before this is fully green:
CAVEAT-A (test corpus regression) must be fixed; CAVEAT-B (OQ-5 CAVEATS omission)
and CAVEAT-C (NaN engine vulnerability + misleading comment) are advisory.

---

## SOURCES READ (observed directly — zero trust from report)

```
docs/pipeline/ARCH-TWINEWEIGHT-PATCH-2026-08-14.md    -- corrective arch spec
docs/pipeline/CRITIC-TWINEWEIGHT-PATCH-2026-08-14.md  -- pre-implementation caveats
docs/pipeline/IMPL-TWINEWEIGHT-ENGINE-2026-08-14.md   -- implementer report
packages/engine/src/TwineWeightEngine.ts              -- full implementation
packages/shared/src/index.ts                          -- Branch interface (new fields)
packages/engine/test/TwineWeightEngine.test.js        -- TWE1-TWE9 test suite
packages/engine/src/CareLogReplay.ts                  -- replay handlers
packages/engine/src/tree.ts                           -- trunk branch init
packages/engine/src/GrowthEngine.ts                   -- forked branch init
packages/engine/src/BonsaiTree.ts                     -- BonsaiTree guard layer
DECISIONS.md                                          -- OQ resolutions
packages/engine/test_security.mjs                     -- existing security gate
packages/engine/package.json                          -- test script
```

---

## CLAIMS EXTRACTED (falsifiable only)

```
C1  tsc --noEmit exits 0 on packages/shared
C2  tsc --noEmit exits 0 on packages/engine
C3  npm test: 49/49 pass, exit 0
C4  TwineWeightEngine.test.js: 37/37 pass
C5  TWINE_MAX_ANGLE_DELTA = 28°
C6  WEIGHT_DEGREES_PER_UNIT = 7°
C7  TWINE_FORCE_PER_DAY = 0.02
C8  computeSetDays(diameter) = lerp(28, 56, d/D_MAX)
C9  Spring-back: springBack = twineAngle × max(0, 1 − daysApplied/setDays)
C10 applyWeight uses STACK semantics (confirmed Jeremy 2026-08-14)
C11 weightAppliedDay: 0 initialized in tree.ts (trunk) and GrowthEngine.ts (forked)
C12 weightAngleDelta: 0 initialized in tree.ts and GrowthEngine.ts
C13 DECISIONS.md updated with OQ-1, OQ-3, OQ-5 entries
C14 CareLogReplay wired: twine passes degradeDays; twine-remove, weight-remove, wire-remove routed
C15 CAVEAT-1 fix (branch aliasing in TWE6): TWE6-3/4 use fresh trees
C16 CAVEAT-2 fix (assert(true) else-path): TWE2-3 uses trunk at 80°, no else branch
C17 CAVEAT-4 fix (comment/code mismatch in TWE6-1): comment corrected to "direct engine call"
```

---

## VERIFICATION PASS

### C1, C2 — tsc --noEmit both packages

```
COMMAND: npx tsc -p packages/shared/tsconfig.json --noEmit  → EXIT:0   ✓
COMMAND: npx tsc -p packages/engine/tsconfig.json --noEmit  → EXIT:0   ✓
```

**VERIFIED.**

---

### C3, C4 — npm test 49/49, TWE1–TWE9 37/37

```
COMMAND: cd packages/engine && npm test
OUTPUT:
  TWE1-1 … ok 1
  TWE1-2 … ok 2
  ...
  TWE9-4 … ok 37
  (determinism.test, WireEngine.test, carelog-determinism.test: ok 38–49)
  1..49 / # pass 49 / # fail 0   EXIT:0

37 TWE tests individually observed: TWE1-1–4, TWE2-1–6, TWE3-1–4, TWE4-1–5,
TWE5-1–3, TWE6-1–4, TWE7-1–4, TWE8-1–3, TWE9-1–4.
```

**VERIFIED.**

---

### C5–C8 — Constants and computeSetDays

```
TwineWeightEngine.ts line 23:  TWINE_MAX_ANGLE_DELTA = 28    ✓
TwineWeightEngine.ts line 26:  WEIGHT_DEGREES_PER_UNIT = 7   ✓
TwineWeightEngine.ts line 58:  TWINE_FORCE_PER_DAY = 0.02    ✓
TwineWeightEngine.ts lines 101–107:
  const d = Math.min(D_MAX, diameter);   // clamp at D_MAX=6
  return STRESS_DECAY_MIN_DAYS + (STRESS_DECAY_MAX_DAYS - STRESS_DECAY_MIN_DAYS) * (d / D_MAX);
  = 28 + (56-28) × (d/6) → [28, 56]     ✓
```

**VERIFIED.**

---

### C9 — Spring-back formula (removeTwine and removeWeight)

```
removeTwine (TwineWeightEngine.ts lines 224–227):
  const springBackFraction = Math.max(0, Math.min(1, 1 - twineDaysApplied / setDays));
  const springBackAmount = round4(b.twineAngle * springBackFraction);
  b.angle = round4(clamp(b.angle - springBackAmount, POLAR_MIN_DEG, KENGAI_POLAR_MAX));

removeWeight (TwineWeightEngine.ts lines 341–343):
  const springBackFraction = Math.max(0, Math.min(1, 1 - weightDaysApplied / setDays));
  const springBackAmount = round4(b.weightAngleDelta * springBackFraction);
  b.angle = round4(clamp(b.angle - springBackAmount, POLAR_MIN_DEG, KENGAI_POLAR_MAX));

Spec (ARCH-TWINEWEIGHT-PATCH HIGH-2, Jeremy confirmed 2026-08-14):
  springBack = bendAngle × max(0, 1 - daysElapsed/setDays)
  Applied immediately at removal, bendSet = true when daysElapsed >= setDays.

Both match spec formula exactly. bendSet=true branch present in both. ✓
```

**VERIFIED.**

---

### C10 — OQ-5 STACK semantics (spec deviation, see CAVEAT-B)

```
ARCH-TWINEWEIGHT-PATCH §LOW-4 said: "Implement 'replace' semantics. Flag OQ-5 as
unconfirmed in implementer report."

DECISIONS.md (observed, line 200):
  "OQ-5 RESOLVED — applyWeight STACK semantics confirmed (2026-08-14): Calling
  applyWeight() on an already-weighted branch ACCUMULATES weightAngleDelta.
  ... Confirmed by Jeremy Gordon 2026-08-14."

Implementation (TwineWeightEngine.ts lines 287–291):
  b.weightAngleDelta = round4(Math.min(TWINE_MAX_ANGLE_DELTA,
    b.weightAngleDelta + actualDelta));  // += not =
  b.weightAppliedDay = tree.getAge();
  b.weighted = true;
  b.weightCount = weightCount;

Test TWE8-3 verifies STACK: two applyWeight calls accumulate, passes ✓.
DECISIONS.md records Jeremy's confirmation ✓.
BUT: IMPL CAVEATS section does NOT flag OQ-5 as unconfirmed, as the patch
required. → See CAVEAT-B.
```

**VERIFIED (behavior correct per DECISIONS.md); CAVEAT-B on process deviation.**

---

### C11, C12 — New fields initialized in all branch creation paths

```
packages/engine/src/tree.ts line 40:   weightAppliedDay: 0,  // OQ-1 Option A
packages/engine/src/tree.ts line 41:   weightAngleDelta: 0,  // OQ-1 Option A
packages/engine/src/GrowthEngine.ts line 143:  weightAppliedDay: 0,  // OQ-1 Option A
packages/engine/src/GrowthEngine.ts line 144:  weightAngleDelta: 0,  // OQ-1 Option A
```

**VERIFIED.** Both trunk init (tree.ts) and forked-branch init (GrowthEngine.ts) confirmed.

---

### C13 — DECISIONS.md updated

```
DECISIONS.md observed (lines 196–202):
  "OQ-1 RESOLVED — weightAppliedDay and weightAngleDelta fields approved (2026-08-14)" ✓
  "OQ-3 RESOLVED — time-ratio spring-back confirmed for twine and weight (2026-08-14)" ✓
  "OQ-5 RESOLVED — applyWeight STACK semantics confirmed (2026-08-14)" ✓
  "TwineWeightEngine Phase 2 complete (2026-08-14)" ✓
```

**VERIFIED.** All required DECISIONS.md entries observed.

---

### C14 — CareLogReplay routing

```
CareLogReplay.ts lines 126–140:
  'twine'        → tree.applyTwine(a.branchId, a.angleDelta, a.degradeDays)  ✓ (degradeDays passthrough)
  'twine-remove' → tree.removeTwine(a.branchId)                              ✓
  'weight'       → tree.applyWeight(a.branchId, a.weightCount)               ✓
  'weight-remove'→ tree.removeWeight(a.branchId)                             ✓
  'wire-remove'  → WireEngine.removeWire(tree, a.branchId)                   ✓
```

**VERIFIED.** All four Phase 2 routing cases confirmed live. Exhaustiveness guard at line 154–157 unchanged.

---

### C15 — CAVEAT-1 fix (branch aliasing)

The original corrective spec's corrected TWE6 block had validBranch === pruneable because
both `find()` calls used identical predicates before pruning. Critic flagged this.

Implementer's fix: each test is a separate `test()` function with its own tree instance.
- TWE6-3: `const tree = freshTrunkTree();` → fresh tree each call, `id=0` (trunk, never pruned)
- TWE6-4: same, separate fresh tree

Trunk cannot be pruned → the validBranch-aliasing-as-pruned failure is impossible.
**CAVEAT-1 correctly resolved. VERIFIED.**

---

### C16 — CAVEAT-2 fix (assert(true) else-path)

Original corrective spec's TWE2-3 had `else { assert(true, ...) }` as a fallback
if no branch with angle > 33.73° existed. Critic flagged this as a silent skip.

Implementer's fix: `freshTrunkTree()` pre-sets trunk angle to 80°. The find-a-high-angle-branch
logic is entirely absent; the test operates directly on the known-80° trunk. The else branch
becomes unnecessary and is not present.
**CAVEAT-2 correctly resolved. VERIFIED.**

---

### C17 — CAVEAT-4 fix (comment/code mismatch in TWE6-1)

Patch spec comment said "via BonsaiTree" but code was a direct engine call.
Observed test (line 361):
  `test('TWE6-1: applyWeight returns not-found for invalid branchId (direct engine call)', ...`
  `const r = TwineWeightEngine.applyWeight(tree, 99999, 2);`

Title and code both say "direct engine call". **VERIFIED.**

---

### twineAngle JSDoc update

```
shared/src/index.ts lines 92–110: Full 3-state lifecycle documented:
  "At applyTwine time: set to the applied delta..."
  "During natural degradation: decremented by SPRING_RATE (1 deg/day) toward 0.
   Represents REMAINING bend, not original applied delta."
  "The original applied delta is the authoritative historical record stored in the
   care log entry (type: 'twine', angleDelta)."

TwineWeightEngine.ts lines 123–125:
  "NOTE on b.twineAngle semantics: set to the applied delta at applyTwine time.
   processTwineDegrade decrements this field toward 0 (remaining bend accumulator)."
```

**VERIFIED.** HIGH-1 resolution confirmed in both files.

---

## INTENT CHECKS

```
INTENT CHECK — applyTwine
  code does:     clamp angleDelta to ±28°, apply to b.angle, clamp result to [5.73°, 150°]
  test expects:  angle = round4(oldAngle + clampedDelta) (TWE2-1, TWE2-2, TWE2-3)
  spec says:     angleDelta clamped to ±TWINE_MAX_ANGLE_DELTA; polar bounds enforced
  verdict:       ALIGNED

INTENT CHECK — removeTwine spring-back
  code does:     fraction = max(0, min(1, 1 - daysApplied/setDays)); springBack = twineAngle × fraction
  test expects:  same-day → full spring-back (TWE4-1); half-point → ~50% (TWE4-2)
  spec says:     springBack = bendAngle × max(0, 1 - daysElapsed/setDays), immediate
  verdict:       ALIGNED

INTENT CHECK — applyWeight (OQ-5 STACK)
  code does:     b.angle += newDelta; b.weightAngleDelta += actualDelta (capped 28°)
  test expects:  TWE8-3 two calls accumulate; TWE8-1 immediate angle change
  spec says (ARCH-PATCH §LOW-4): "replace semantics" (written)
  spec says (DECISIONS.md OQ-5): "STACK semantics confirmed by Jeremy 2026-08-14"
  verdict:       CONFLICT in written spec vs. DECISIONS.md. DECISIONS.md wins (more recent,
                 owner-authorized). Behavior is internally consistent with DECISIONS.md.

INTENT CHECK — processTwineDegrade
  code does:     SPRING_RATE (1°/day) step; final step clears state; bendSet NOT set
  test expects:  TWE9-1 angle decreases by 1°; TWE9-2 twined=false, bendSet=false after full degrade
  spec says:     natural degrade [10,15] < setDays [28,56]; bendSet never set via degrade
  verdict:       ALIGNED

INTENT CHECK — CareLogReplay determinism
  code does:     replay passes a.degradeDays to applyTwine as storedDegradeDays
  test expects:  TWE3-4 replay preserves degradeDays=12 (forced storedDegradeDays=12)
  spec says:     replay must use stored RNG draw (determinism invariant)
  verdict:       ALIGNED
```

---

## SCOPE

Files changed (implementer claimed; observed-confirmed):
```
  packages/shared/src/index.ts              ✓ (new fields + twineAngle JSDoc)
  packages/engine/src/TwineWeightEngine.ts  ✓ (full Phase 2 implementation)
  packages/engine/src/BonsaiTree.ts         ✓ (applyTwine signature)
  packages/engine/src/CareLogReplay.ts      ✓ (four stubs replaced)
  packages/engine/src/tree.ts               ✓ (weightAppliedDay/Delta: 0)
  packages/engine/src/GrowthEngine.ts       ✓ (weightAppliedDay/Delta: 0)
  packages/engine/package.json              ✓ (TwineWeightEngine.test.js in test script)
  packages/engine/test/TwineWeightEngine.test.js  ✓ (new file)
  DECISIONS.md                              ✓ (OQ-1, OQ-3, OQ-5 entries)
  STATE.md                                  ✓ (progress tracking — expected)
```

No unexpected source changes observed in the above files. Other files visible in
`git status` (apps/web, apps/server, docs/pipeline/*.md) are pre-existing uncommitted
work from earlier tasks, not introduced by this implementer pass.

---

## FRAUDS HUNTED

```
WEAKENED TESTS:
  TWE tests are new (no prior TWE file to weaken).
  Existing tests: observed that test_security.mjs SEC-3-3/4/5/6 now FAIL because
  the Phase 1 stub expectations are no longer valid. These were NOT weakened —
  they were NOT UPDATED to match Phase 2 behavior. This is an omission, not fraud.
  The existing passing test files (determinism, WireEngine, carelog-determinism)
  are unchanged in behavior; checked that none of their assertions were loosened.
  VERDICT: no weakened tests; 4 un-updated tests are a CAVEAT.

FALSE COMPLETION:
  Implementer claimed 49/49 pass. Observed: 49/49 pass. Claim is literally true.
  Implementer did NOT claim test_security.mjs passes. But also did not flag
  the 4 new regressions (SEC-3-3/4/5/6) in CAVEATS. Silent omission, not fraud.
  VERDICT: no false completion; regression omission is CAVEAT-A.

INTENT INVERSION:
  NONE. The spring-back formula, degrade semantics, and replay path all match spec.
  OQ-5 STACK vs REPLACE is a spec evolution (DECISIONS.md records Jeremy confirmation),
  not a case where code was bent to satisfy a wrong test.

PHANTOM EVIDENCE:
  Checked: DECISIONS.md entries observed. tree.ts and GrowthEngine.ts fields confirmed.
  tsc and test exit codes directly observed. CareLogReplay routing confirmed in live code.
  NONE found.
```

---

## CAVEATS

### CAVEAT-A (FIX REQUIRED): test_security.mjs — 4 new regressions

**Severity:** Must fix before marking Phase 2 fully complete.

Running `node test_security.mjs` from `packages/engine/`:
```
✗ SEC-3-3: care log with twine throws (not silently dropped): (did NOT throw)
✗ SEC-3-4: care log with twine-remove throws (not silently dropped): (did NOT throw)
✗ SEC-3-5: care log with weight throws (not silently dropped): (did NOT throw)
✗ SEC-3-6: care log with weight-remove throws (not silently dropped): (did NOT throw)
Security test result: 38 passed, 6 failed
```

(SEC-3-1/1b are wire-remove regressions from an earlier phase — pre-existing, not this task.)

These 4 tests were written against Phase 1 stub behavior (twine/weight actions threw
`CareLogReplayError`). Phase 2 implements them correctly, so they no longer throw — but
the tests were not updated. The expected behavior is now success, not throw. The implementer
must update SEC-3-3 through SEC-3-6 to assert the Phase 2 success path (e.g., reconstruct
with a valid twine action succeeds, resulting care log contains the twine entry).

Note: `test_security.mjs` is NOT in the npm test script. It is a standalone gate. The
implementer's "49/49 pass" claim is technically correct for npm test, but the test corpus
regression is a real issue that must be addressed.

---

### CAVEAT-B (ADVISORY): OQ-5 process violation — REPLACE→STACK without flagging

The ARCH-TWINEWEIGHT-PATCH §LOW-4 required the implementer to:
1. Implement REPLACE semantics (the spec default), AND
2. Flag OQ-5 as unconfirmed in the CAVEATS section of the implementer report.

The implementer did neither: implemented STACK and did not list OQ-5 in CAVEATS.
The DECISIONS.md records "OQ-5 RESOLVED — STACK semantics confirmed by Jeremy Gordon
2026-08-14," which legitimizes the semantic choice. The behavior is internally consistent
and the DECISIONS.md record is authoritative.

However, the implementer deviated from written spec without explicit pipeline documentation
of the spec change (no corrective patch for OQ-5). Future pipeline stages should produce
a corrective note closing OQ-5 in the spec chain, or the next ARCH doc should reference
the DECISIONS.md confirmation directly.

---

### CAVEAT-C (ADVISORY): NaN corruption via direct engine calls

`TwineWeightEngine.applyTwine(tree, 0, NaN)` and
`TwineWeightEngine.applyWeight(tree, 0, NaN)` were verified empirically:
both return `{ ok: true, ... }` and set `b.angle = NaN`, corrupting branch state.

The comment in TwineWeightEngine.ts reads:
> "NOTE: BonsaiTree.applyWeight (line 227–236) validates !isFinite and !isInteger before
> calling here. These guards are present for direct-call safety."

This comment is misleading: BonsaiTree guards protect callers-via-BonsaiTree, not
direct engine callers. Direct callers (including the tests themselves for TWE6-3/4)
bypass BonsaiTree. The engine-level NaN guard is absent.

Production path is safe: BonsaiTree.applyTwine (line 204) and BonsaiTree.applyWeight
(line 227) both have `!Number.isFinite()` throws. No production path calls TwineWeightEngine
directly without going through BonsaiTree.

Recommended: either add an engine-level `!Number.isFinite(angleDelta)` guard in
TwineWeightEngine.applyTwine, or correct the comment to "BonsaiTree provides the safety
guard; direct callers must ensure finite inputs."

No test exercises `BonsaiTree.applyTwine(0, NaN)` throwing. Since BonsaiTree.applyWeight
NaN guard is implicitly exercised (BonsaiTree.applyWeight guards weightCount), the
applyTwine gap is minor but worth noting.

---

## BOTTOM LINE

VERIFIED WITH CAVEATS. Core Phase 2 physics — all 7 methods, spring-back formula,
STACK weight semantics, replay determinism, degradation — are correctly implemented and
pass 49/49 observed tests with clean tsc. CAVEAT-A (test_security.mjs SEC-3-3/4/5/6
not updated for Phase 2) requires a fix before this is fully green; CAVEAT-B and CAVEAT-C
are advisory but should be addressed by the linter or next implementer pass.
