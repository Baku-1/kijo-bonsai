# IMPL: TechniqueClassifier Test File
**Date:** 2026-08-17  
**Stage:** Implementer  
**File created:** `packages/engine/test_technique.mjs`  
**Spec:** `docs/ARCHITECT-CAREACTION-TECHNIQUE-2026-07-30.md` §3, `docs/DESIGN-TECHNIQUE-CLASSIFICATION.md`

---

## OUTCOME: PASS

---

## DONE WHEN (named check from Step 1)

`node packages/engine/test_technique.mjs` runs from repo root and prints PASS for all cases with zero ERRORs.

**Observed result:**
```
48 passed, 0 failed
```
Exit code 0. Observed directly — not inferred.

---

## WHAT CHANGED

**New file:** `packages/engine/test_technique.mjs`  
No other files touched.

Pattern: follows `test_wire.mjs` exactly — node-native, no vitest, `assert(cond, name, detail)` function, section headers with `console.log`, `process.exit(1)` if any failed.

Import: `import { TechniqueClassifier } from './dist/TechniqueClassifier.js'` (from built dist, same pattern as test_wire.mjs).

---

## VERIFIED BY OBSERVATION

```
node packages/engine/test_technique.mjs

T1 — Empty care log → Bound-and-Cut, all counts 0
  ✓ primary is Bound-and-Cut
  ✓ overlays empty
  ✓ wireCount=0
  ✓ pruneCount=0
  ✓ jinCount=0
  ✓ landscapeCount=0

T2 — Wire + prune≥2 + age≥30 → Bound-and-Cut (wire disqualifies)
  ✓ wire disqualifies Clip-and-Grow
  ✓ wireCount=1

T3 — Zero wire + prune≥2 + age<30 → Bound-and-Cut (age gate)
  ✓ age=29 < 30 fails age gate → Bound-and-Cut

T4 — Zero wire + prune<2 + age≥30 → Bound-and-Cut (prune gate)
  ✓ pruneCount=1 < 2 fails prune gate → Bound-and-Cut

T5 — Zero wire + prune≥2 + age≥30 → Clip-and-Grow
  ✓ all three gates pass → Clip-and-Grow

T6 — Twine-only + prune≥2 + age≥30 → Clip-and-Grow (twine ≠ wire)
  ✓ twine does not disqualify Clip-and-Grow
  ✓ wireCount=0 — twine NOT counted as wire

T7 — Wire-remove only + prune≥2 + age≥30 → Clip-and-Grow
  ✓ wire-remove does not count as a wire use
  ✓ wireCount=0 — wire-remove NOT counted

T8 — jin=1 → overlays includes Jin
  ✓ overlays includes 'Jin'
  ✓ jinCount=1

T9 — jin=0 → overlays does NOT include Jin
  ✓ overlays does not include 'Jin'

T10 — landscape=3 → overlays includes Water-and-Land
  ✓ overlays includes 'Water-and-Land'
  ✓ landscapeCount=3

T11 — landscape=2 → overlays does NOT include Water-and-Land
  ✓ overlays does not include 'Water-and-Land'
  ✓ landscapeCount=2

T12 — jin≥1 AND landscape≥3 → both overlays present
  ✓ overlays includes 'Jin'
  ✓ overlays includes 'Water-and-Land'
  ✓ exactly 2 overlays

T13 — Count fields correct
  ✓ wireCount=2 (got 2)
  ✓ pruneCount=3 (got 3)
  ✓ jinCount=3 (got 3)
  ✓ landscapeCount=4 (got 4)
  ✓ treeAgeDays=55 (got 55)

T14 — treeAgeDays=0 → Bound-and-Cut
  ✓ age=0 fails age gate → Bound-and-Cut
  ✓ treeAgeDays=0 passed through

T15 — treeAgeDays=NaN → Bound-and-Cut, no throw
  ✓ no exception thrown for NaN treeAgeDays
  ✓ NaN age fails age gate (NaN>=30 is false) → Bound-and-Cut

T16 — treeAgeDays=Infinity → Clip-and-Grow
  ✓ Infinity >= 30 is true → Clip-and-Grow
  ✓ treeAgeDays=Infinity passed through

T17 — Unknown action types ignored, no throw
  ✓ no exception for unknown action types
  ✓ unknown types ignored; prune+age gates pass → Clip-and-Grow
  ✓ wireCount unaffected by unknown types

T17b — weight/weight-remove/twine-remove ignored, wireCount unaffected
  ✓ wireCount=0 — weight/weight-remove/twine-remove NOT counted
  ✓ spec-named ignored types do not disqualify Clip-and-Grow

T18 — water/fertilize/rotate only → Bound-and-Cut, all counts 0
  ✓ no qualifying actions → Bound-and-Cut
  ✓ all counts=0

T19 — Determinism: same inputs → identical outputs
  ✓ primary identical across two calls
  ✓ overlays identical (same order)
  ✓ overlays are distinct array objects (no shared ref)
  ✓ all counts identical
  ✓ treeAgeDays identical

48 passed, 0 failed
```

---

## INTENT CHECK

```
INTENT CHECK
  code does:     count wire/prune/jin/landscape entries via switch; Clip-and-Grow if
                 wireCount===0 && pruneCount>=2 && treeAgeDays>=30, else Bound-and-Cut;
                 overlays: Jin if jinCount>=1, Water-and-Land if landscapeCount>=3.
  check expects: same behavior across 20 test blocks (19 spec-required + T17b added)
  spec says:     same logic — ARCHITECT-CAREACTION-TECHNIQUE-2026-07-30.md §3 and
                 DESIGN-TECHNIQUE-CLASSIFICATION.md (authoritative)
  verdict:       ALIGNED
```

---

## TEST COUNT

- **20 test blocks** (T1–T19 + T17b)
- **48 assertions** total
- **0 failures**

---

## CARMACK-LINUS REVIEW FINDINGS

Review was performed on the initial draft. Two structural defects were found and fixed before final ship.

### Fixed defects

**C1 — Unguarded `r` access in T15 and T17 (correctness — test harness crash)**

Initial draft: if `TechniqueClassifier.classify` threw an exception, `r` remained `undefined` and the subsequent `assert(r.primary === ...)` would throw a `TypeError`, crashing the entire test process rather than recording clean failures. T16–T19 would never run.

Fix applied: initialized `r = null` before the `try` block; guarded downstream asserts with `r != null && r.primary === ...`. This ensures any throw produces two clean failures and execution continues.

**C2 — T19 overlays reference equality not checked (robustness)**

A caching regression that returned a shared `overlays` array across calls would pass the `JSON.stringify` comparison but silently break the pure/stateless contract. Added: `assert(r1.overlays !== r2.overlays, 'overlays are distinct array objects (no shared ref)')`.

### Additional coverage added (from review recommendation)

**T17b** — Added explicit test for `weight`, `weight-remove`, `twine-remove` action types being ignored. These are spec-named, explicitly excluded action types. T17 covered truly unknown types (`tick`, `foo`); T17b verifies the spec-defined-but-non-counting types by name. A future accidental `case 'weight': wireCount++` would not have been caught by T17 alone.

### Remaining minor observations (not fixed — not worth it)

- Helper functions have inconsistent return shapes (singular vs array). The naming (`wireEntry` vs `pruneEntries`) signals this; no runtime impact.
- `wireEntry()` always emits `day: 1`; two calls in T13 produce duplicate day values. TechniqueClassifier ignores day; no current impact.

---

## CAVEATS

None. All 48 assertions were observed to pass. All code changes were verified by running the actual node process and reading its output.
