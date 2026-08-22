# AUDIT: TechniqueClassifier Test Suite
**Date:** 2026-08-17  
**Stage:** Adversarial Auditor  
**Subject:** `packages/engine/test_technique.mjs` — gate tests for `TechniqueClassifier.classify()`  
**Implementer report:** `docs/pipeline/IMPL-TECHNIQUE-TESTS-2026-08-17.md`  
**Spec:** `docs/ARCHITECT-CAREACTION-TECHNIQUE-2026-07-30.md` §3 + `DESIGN-TECHNIQUE-CLASSIFICATION.md`

---

## VERDICT: VERIFIED

---

## ORDER OF OPERATIONS

Spec and implementation were read BEFORE the implementer's pipeline doc. View of the
test file was formed independently. Implementer's doc was read last and compared against
independent findings only after all other analysis was complete.

---

## CLAIMS CHECKED

```
✓ "48 assertions, 0 failed" — OBSERVED: stdout "48 passed, 0 failed"
✓ "20 test blocks (T1–T19 + T17b)" — OBSERVED: 20 console.log headers counted
✓ "Exit code 0" — OBSERVED: EXIT_CODE:0 from direct shell run
✓ "No other files touched" — OBSERVED: git status shows test_technique.mjs as the
  only untracked file attributable to this task; all modified files belong to
  prior sessions (web3, TwineWeightEngine, CareLogReplay)
✓ "C1 fix: null guard in T15/T17" — OBSERVED: r = null before try; r != null && check
✓ "C2 fix: overlays reference equality (T19)" — OBSERVED: r1.overlays !== r2.overlays assert
✓ "T17b added for spec-named ignored types" — OBSERVED: weight/weight-remove/twine-remove
  block present at lines 273–284
```

---

## INTENT CHECK

```
INTENT CHECK — TechniqueClassifier.classify()
  code does:     switch on entry.action.type; increments wireCount for 'wire',
                 pruneCount for 'prune', jinCount for 'jin', landscapeCount for
                 'landscape'; all others fall to default:break. Primary is
                 'Clip-and-Grow' iff wireCount===0 && pruneCount>=2 &&
                 treeAgeDays>=30, else 'Bound-and-Cut'. Overlays: push 'Jin' if
                 jinCount>=1, push 'Water-and-Land' if landscapeCount>=3.
                 Returns fresh {primary, overlays, wireCount, pruneCount,
                 jinCount, landscapeCount, treeAgeDays}.
  check expects: same logic, confirmed across 48 assertions in 20 test blocks
                 covering all three gates (wire, prune, age), both overlays,
                 all six count fields, ignored types, adversarial inputs,
                 and determinism + distinct array objects.
  spec says:     identical — ARCHITECT-CAREACTION-TECHNIQUE-2026-07-30.md §3
                 pseudocode; DESIGN-TECHNIQUE-CLASSIFICATION.md authoritative.
  verdict:       ALIGNED
```

---

## SPEC COVERAGE AUDIT

Derived independently from the spec before reading the test file. Each rule
is matched to the test block that exercises it.

```
Rule 1:  wireCount counts 'wire' only (not twine, not wire-remove)
         → T6 (twine), T7 (wire-remove), T17b (weight/weight-remove/twine-remove)
         ALL THREE COVERED ✓

Rule 2:  pruneCount counts 'prune' entries only
         → T4 (1 prune → fails), T5 (2 prunes → passes), T13 (3 prunes counted)
         COVERED ✓

Rule 3:  Clip-and-Grow requires wireCount===0 AND pruneCount>=2 AND treeAgeDays>=30
         (all three gates — any single failure → Bound-and-Cut)
         → T2 (wire gate), T3 (age gate), T4 (prune gate), T5 (all pass)
         ALL THREE GATES INDIVIDUALLY TESTED ✓

Rule 4:  Bound-and-Cut is default (anything not qualifying for Clip-and-Grow)
         → T1, T2, T3, T4, T14, T15 all resolve to Bound-and-Cut
         COVERED ✓

Rule 5:  Jin overlay: jinCount >= 1
         → T8 (jinCount=1 → Jin present), T9 (jinCount=0 → Jin absent)
         COVERED ✓

Rule 6:  Water-and-Land overlay: landscapeCount >= 3
         → T10 (landscapeCount=3 → W&L present), T11 (landscapeCount=2 → W&L absent)
         COVERED ✓

Rule 7:  Both overlays simultaneously with any primary
         → T12 (jin + landscape≥3 → both overlays, overlays.length===2)
         COVERED ✓

Rule 8:  All six count fields returned in result
         → T13 (all four action counts + treeAgeDays explicitly asserted)
         COVERED ✓

Rule 9:  Ignored types cause no throw and no count change
         → T17 (unknown types 'tick','foo'), T17b (spec-named: weight, weight-remove,
           twine-remove), T18 (water, fertilize, rotate)
         THREE SEPARATE CLASSES OF IGNORED TYPES TESTED ✓

Rule 10: Determinism — same inputs → identical outputs, overlays as distinct objects
         → T19 (two calls same inputs; JSON.stringify equality; !== identity check)
         COVERED ✓

Rule 11: Boundary conditions for treeAgeDays
         → T14 (0), T15 (NaN), T16 (Infinity)
         COVERED ✓
```

---

## KIJO-SPECIFIC CHECKS

```
CHECK K1: TechniqueClassifier NEVER conflates Technique with Style.
  Water-and-Land is an OVERLAY, not a style. T10/T11/T12 test it as
  overlays.includes('Water-and-Land'). No test treats it as a style string.
  PASS ✓

CHECK K2: Twine does NOT increment wireCount.
  T6: twineEntry + pruneEntries(2) + age=30 → Clip-and-Grow with wireCount=0.
  Two assertions: primary=Clip-and-Grow AND wireCount===0. Catches any
  implementation that accidentally routes 'twine' to wireCount.
  PASS ✓

CHECK K3: Landscape entries are countable by TechniqueClassifier without throwing.
  (CareLogReplay throws on landscape — intentional Phase 2 gate. TechniqueClassifier
  must NOT propagate this restriction since it reads the log directly, not via
  CareLogReplay.)
  T10 (3 entries), T11 (2 entries), T12 (3 entries), T13 (4 entries) all pass
  landscape entries directly to classify() with no throw. landscapeCount asserted
  correctly in each case.
  PASS ✓

CHECK K4: Determinism — same inputs → identical outputs AND distinct array objects.
  T19: r1.overlays !== r2.overlays asserts arrays are not shared refs. Combined
  with JSON.stringify equality, this verifies both content stability and
  referential independence.
  PASS ✓

CHECK K5: No Math.random() in test file.
  Scanned full file (330 lines). No Math.random() call present.
  PASS ✓
```

---

## ASSERTION COUNT VERIFICATION

Independent count from test file (T=block, A=assertions):

```
T1:  6  T2:  2  T3:  1  T4:  1  T5:  1  T6:  2  T7:  2
T8:  2  T9:  1  T10: 2  T11: 2  T12: 3  T13: 5  T14: 2
T15: 2  T16: 2  T17: 3  T17b:2  T18: 2  T19: 5
TOTAL: 48 ✓ (matches implementer's reported count)
```

---

## SCOPE VERIFICATION

```
SCOPE CLAIM: "No other files touched."

git status (untracked): test_technique.mjs — the only new file for this task.
git diff --stat HEAD: 16 modified files — all belong to prior sessions:
  - web3 security corrections (wallet-auth, seed-claim, App.tsx, StoreModal)
  - TwineWeightEngine tests
  - CareLogReplay wire-remove
  - DECISIONS.md / STATE.md / SESSION-START.md (prior sessions)
  None of these were touched by the TechniqueClassifier test implementation.

SCOPE: CLEAN ✓
```

---

## FRAUDS HUNTED

```
Weakened tests: NONE FOUND
  Assertions use strict equality (===), includes(), and identity (!==).
  No commented-out assertions, no skip(), no loosened expected values.
  T12 adds overlays.length===2 to prevent a false positive from an extra overlay.
  T19 adds distinct-object check (r1.overlays !== r2.overlays) to prevent a
  caching fraud from being invisible behind content equality.

False completion: NONE FOUND
  Gate independently re-run; stdout and exit code match the implementer's report
  exactly. 48 passed, 0 failed, EXIT_CODE:0 — all directly observed.

Intent inversion: NONE FOUND
  The classification logic in TechniqueClassifier.ts is identical to the spec
  pseudocode. Tests assert spec-correct outcomes. No test was adjusted to match
  wrong implementation behavior.

Phantom evidence: NONE FOUND
  All cited line references (T17 null-guard, T19 reference inequality) are
  present in the file at the described locations. File exists at the stated path.
  Test output in IMPL doc matches independently re-run output character-for-character.
```

---

## CARMACK-LINUS FINDINGS REVIEW

Implementer reported two fixes (C1, C2) and one added block (T17b).

**C1 — Null guard in T15/T17:** VERIFIED present at lines 224 and 255.
The guard pattern `r = null; try { r = classify(...) } catch { threw=true; }`
followed by `assert(!threw, ...)` + `assert(r != null && r.primary === ..., ...)`
is correctly implemented. A throw produces two recorded failures (not a harness
crash) and execution continues.

**C2 — Reference inequality in T19:** VERIFIED at line 316:
`assert(r1.overlays !== r2.overlays, 'overlays are distinct array objects (no shared ref)')`
This would catch a future shared-ref regression that JSON.stringify alone cannot detect.

**T17b — Spec-named ignored types:** VERIFIED at lines 273–284. Tests
`weight`, `weight-remove`, `twine-remove` by name — the three spec-defined
action types that are explicitly excluded from wireCount by the authoritative
classification doc. T17 alone (using `'tick'` and `'foo'`) would not catch an
accidental `case 'weight': wireCount++` regression.

All three Carmack-Linus findings are real, were actually fixed, and the fixes
improve test quality beyond the minimum spec requirements.

---

## MINOR NOTES (not caveats — for completeness)

- No test for a combined wire + wire-remove log. Not required: T2 tests wire→B&C
  and T7 tests wire-remove→not counted. The composition is trivially implied.
- No test for negative treeAgeDays. Not required: spec does not define this input.
- T12 doesn't assert primary value (would be Bound-and-Cut since pruneCount=0).
  Not a gap — T1–T7 cover primary exhaustively; T12's purpose is overlay coverage.

---

## BOTTOM LINE

Gate passes 48/48 (independently confirmed). All eleven spec rules are exercised.
All five Kijo-specific checks pass. No frauds, no weakened tests, no phantom evidence.
The C1/C2/T17b improvements over the minimum spec are genuine quality additions.

VERDICT: **VERIFIED**
