# AUDIT — TwineWeightEngine Caveat Fixes
**Date:** 2026-08-16
**Audits:** IMPL-TWE-CAVEAT-FIXES-2026-08-14.md
**Audit ref:** AUDIT-TWINEWEIGHT-PHASE2-2026-08-14.md (previous audit, 3 caveats)
**Skill:** adversarial-auditor (loaded before all file reads)
**Pipeline:** Architect → Critic → Corrective Architect → Critic (patch) → Implementer → Phase 2 Auditor (CAVEATS) → Corrective Implementer → **This Auditor** → Linter

---

## VERDICT: VERIFIED WITH CAVEATS

All three caveats from AUDIT-TWINEWEIGHT-PHASE2-2026-08-14.md are resolved and
independently verified. Two advisory caveats remain (STATE.md not updated; three
no-op test assertions inherently weak by design). Neither is behavioral. The engine
is safe to hand to the Linter.

---

## SOURCES READ (observed directly — zero trust from report)

```
kijo-bonsai/SESSION-START.md
kijo-bonsai/STATE.md
kijo-bonsai/DECISIONS.md
docs/pipeline/ARCH-TWINEWEIGHT-PATCH-2026-08-14.md     -- confirmed §LOW-4 REPLACE text
docs/pipeline/PATCH-OQ-RESOLUTIONS-2026-07-31.md       -- verified OQ numbering context
docs/pipeline/AUDIT-TWINEWEIGHT-PHASE2-2026-08-14.md   -- prior audit (3 caveats)
docs/pipeline/IMPL-TWE-CAVEAT-FIXES-2026-08-14.md      -- implementation report being audited
packages/engine/src/TwineWeightEngine.ts                -- comment fix verified
packages/engine/src/BonsaiTree.ts                       -- applyTwine guard verified
packages/engine/test_security.mjs                       -- all tests read in full
```

---

## CLAIMS EXTRACTED (falsifiable)

```
C1  tsc --noEmit (shared) exits 0
C2  tsc --noEmit (engine) exits 0
C3  npm test: 49/49 pass, exit 0
C4  node test_security.mjs: 55/55 pass, exit 0
C5  SEC-3-3 updated: assertNoThrow + twined===true state check
C6  SEC-3-4 updated: assertNoThrow + twined===false (no-op) state check
C7  SEC-3-5 updated: assertNoThrow + weighted===true state check
C8  SEC-3-6 updated: assertNoThrow + weighted===false (no-op) state check
C9  SEC-3-1/1b updated: assertNoThrow + wired===false state check (SEC-3-1c added)
C10 DECISIONS.md OQ-5: ARCH DIVERGENCE NOTE added (REPLACE->STACK, Jeremy confirmed)
C11 TwineWeightEngine.ts: "direct-call safety" comment removed; accurate replacement added
C12 test_security.mjs SEC-6: BonsaiTree.applyTwine(0, NaN) throws CareLogReplayError
C13 Stale section preamble removed from test_security.mjs
C14 Line-number reference removed from TwineWeightEngine.ts comment
```

---

## VERIFICATION PASS

### Gate 1 — tsc --noEmit (C1, C2)

```
COMMAND: npx tsc -p packages/shared/tsconfig.json --noEmit
OUTPUT:  (no output)
EXIT:    0    PASS

COMMAND: npx tsc -p packages/engine/tsconfig.json --noEmit
OUTPUT:  (no output)
EXIT:    0    PASS
```

### Gate 2 — npm test (C3)

```
COMMAND: cd packages/engine && npm test
OUTPUT (tail):
  1..49
  # tests 49
  # suites 0
  # pass 49
  # fail 0
  # duration_ms 1769.9037
EXIT: 0    PASS
```

All 37 TWE subtests individually scrolled — TWE1-1 through TWE9-4 all show "ok".
Determinism pass (second run): 49/49, exit 0. Same count both runs. VERIFIED.

### Gate 3 — node test_security.mjs (C4)

```
COMMAND: node packages/engine/test_security.mjs (from kijo-bonsai/)
OUTPUT (verbatim tail):
  ✓ SEC-6-1: BonsaiTree.applyTwine(0, NaN) throws
  ✓ SEC-6-1b: thrown error is CareLogReplayError
  ────────────────────────────────────────────────────────────
  Security test result: 55 passed, 0 failed
EXIT: 0    PASS
```

Full stdout observed: SEC-1 (9 assertions), SEC-2 (11), SEC-3 (21), SEC-4 (7),
SEC-5 (5), SEC-6 (2). Total = 55. Matches claimed count exactly.

---

### CAVEAT-A verification (C5–C9): SEC-3-x and SEC-3-1/1b/1c

**SEC-3-3 (C5):** assertNoThrow wraps reconstruct with `{type:'twine', branchId:0,
angleDelta:10, degradeDays:10}`. SEC-3-3b: `tree != null`. SEC-3-3c: `tree.getBranches()[0]?.twined === true`. All three asserted and observed passing. The state check (twined===true) is a real routing verification — if CareLogReplay silently dropped the action, twined would remain false. VERIFIED.

**SEC-3-4 (C6):** assertNoThrow wraps reconstruct with `{type:'twine-remove', branchId:0}`.
SEC-3-4b: `tree != null`. SEC-3-4c: `twined === false`. Observed passing. The no-op
assertion (false after never-applied remove) is inherently weak — see CAVEAT-1 below.
The key protection comes from SEC-3-3c having verified the positive apply path. VERIFIED
(with advisory weakness on 3-4c).

**SEC-3-5 (C7):** assertNoThrow wraps reconstruct with `{type:'weight', branchId:0,
weightCount:1}`. SEC-3-5b: `tree != null`. SEC-3-5c: `tree.getBranches()[0]?.weighted === true`.
Real state check — verifies actual routing. VERIFIED.

**SEC-3-6 (C8):** assertNoThrow + `weighted===false` (no-op). Same inherent weakness
as SEC-3-4c. VERIFIED with advisory note.

**SEC-3-1/1b/1c (C9):** SEC-3-1 was "pre-existing, not this task" per previous audit,
but the done criterion required exit 0. Implementer correctly fixed it. Observed:
assertNoThrow + `tree != null` + `branch[0].wired===false`. The wired===false check is
also a no-op assertion (inherent weakness). The positive routing is validated by SEC-3-3c
and SEC-3-5c for the analogous twine/weight paths. VERIFIED.

---

### CAVEAT-B verification (C10): DECISIONS.md OQ-5 ARCH DIVERGENCE NOTE

Read DECISIONS.md OQ-5 entry (2026-08-14) directly. Confirmed it contains:

(a) Original ARCH spec said REPLACE:
    "ARCH-TWINEWEIGHT-PATCH-2026-08-14.md §LOW-4 specified REPLACE semantics as the
    default implementation and instructed the implementer to flag OQ-5 as unconfirmed."
    Cross-checked against ARCH-TWINEWEIGHT-PATCH-2026-08-14.md §LOW-4 which reads:
    "Implement 'replace' semantics as specified in the ARCH doc. Flag in your implementer
    report that OQ-5 is unconfirmed." MATCH. VERIFIED.

(b) Jeremy confirmed STACK on 2026-08-14:
    "Confirmed by Jeremy Gordon 2026-08-14." VERIFIED.

(c) STACK = accumulate weightAngleDelta, capped at 28 degrees:
    "b.weightAngleDelta += actualDelta (capped at TWINE_MAX_ANGLE_DELTA = 28 degrees)."
    VERIFIED.

(d) Cross-reference to previous audit:
    "(Auditor flagged this divergence in AUDIT-TWINEWEIGHT-PHASE2-2026-08-14.md CAVEAT-B.)"
    VERIFIED.

**Traceability note:** The PATCH-OQ-RESOLUTIONS-2026-07-31.md document covers OQ-1
through OQ-7 from a DIFFERENT context (ARCH-CAREACTION-TECHNIQUE-2026-07-30.md). Its
"OQ-5" refers to DESIGN-TWINE-VS-WIRE.md line 27 wording — entirely unrelated to the
TwineWeightEngine Phase 2 REPLACE/STACK question. The TwineWeightEngine OQ-5 has its own
number space from ARCH-TWINEWEIGHT-ENGINE/PATCH. Traceability for this OQ-5 flows through:
ARCH-TWINEWEIGHT-PATCH-2026-08-14.md §LOW-4 → Phase 2 DECISIONS.md entry →
AUDIT-TWINEWEIGHT-PHASE2-2026-08-14.md CAVEAT-B → this audit. Chain is complete.
VERIFIED.

---

### CAVEAT-C part 1 verification (C11, C14): TwineWeightEngine.ts comment

Read TwineWeightEngine.ts applyWeight method directly. Confirmed at lines 276-278:

OLD (misleading):
  "These guards are present for direct-call safety."

NEW (accurate):
  "The engine assumes valid inputs; BonsaiTree is responsible for validation."
  "Direct callers of TwineWeightEngine bypass BonsaiTree and must ensure valid inputs themselves."

The phrase "direct-call safety" which falsely implied the BonsaiTree guards protected
direct engine callers is gone. No line-number reference present. VERIFIED.

---

### CAVEAT-C part 2 verification (C12): SEC-6 NaN guard test

test_security.mjs lines 593-603 (read directly):
  SEC-6-1: `growTree(42, 'hardwood', 5)` → `tree.applyTwine(0, NaN)` → assertThrows
  SEC-6-1b: thrown error is CareLogReplayError (by constructor name check)

This exercises `BonsaiTree.applyTwine` (not TwineWeightEngine directly), which contains
the guard at BonsaiTree.ts line 204: `if (!Number.isFinite(angleDelta)) throw new CareLogReplayError(...)`.
The test verifies the guard fires on the BonsaiTree path, which is the production path.

Observed in stdout: both SEC-6-1 and SEC-6-1b show checkmark. VERIFIED.

---

### CAVEAT-C part 3 (C13): Stale preamble removed

Read test_security.mjs in full. The SEC-3 section has no preamble comment about
"Grow a tree for 50 days...Use totalDays=55 so the actions on day 51 are in range."
All SEC-3 tests use `totalDays=10, day=1` and this is consistent with what's in the file.
The stale comment is absent. VERIFIED.

---

## INTENT CHECKS

```
INTENT CHECK — CAVEAT-A (SEC-3-3 twine routing)
  code does:     CareLogReplay routes 'twine' to BonsaiTree.applyTwine -> TwineWeightEngine.applyTwine
  test expects:  reconstruct succeeds AND branch[0].twined === true
  spec says:     Phase 2 implements twine action; should succeed and bind the branch
  verdict:       ALIGNED

INTENT CHECK — CAVEAT-A (SEC-3-4 twine-remove no-op)
  code does:     CareLogReplay routes 'twine-remove' to BonsaiTree.removeTwine; no-op on untwined branch
  test expects:  reconstruct succeeds AND branch[0].twined === false
  spec says:     removeTwine is no-op on untwined branch; reconstruct must not throw
  verdict:       ALIGNED (assertion is weak but correct; see CAVEAT-1)

INTENT CHECK — CAVEAT-B (OQ-5 STACK documentation)
  DECISIONS.md says:  REPLACE written in ARCH-PATCH §LOW-4; Jeremy confirmed STACK 2026-08-14
  ARCH-PATCH §LOW-4:  "Implement 'replace' semantics... Flag OQ-5 as unconfirmed"
  code does:          STACK (b.weightAngleDelta += actualDelta)
  verdict:            ALIGNED with DECISIONS.md (authoritative). ARCH-PATCH superseded by owner.

INTENT CHECK — CAVEAT-C (comment accuracy)
  old comment:  "These guards are present for direct-call safety" (implied engine guards direct callers)
  new comment:  "BonsaiTree is responsible for validation; direct callers bypass BonsaiTree"
  spec says:    Guards live in BonsaiTree.applyWeight/applyTwine, not in TwineWeightEngine
  verdict:      ALIGNED — new comment accurately describes the validation contract
```

---

## SCOPE

Files changed by caveat-fix implementer (claimed; verified by reading each file):
```
packages/engine/test_security.mjs        -- SEC-3-1/1b/1c updated; SEC-3-3/4/5/6 updated;
                                            SEC-6 added; stale preamble removed
packages/engine/src/TwineWeightEngine.ts -- comment fixed, line-number ref removed
DECISIONS.md                             -- OQ-5 ARCH DIVERGENCE NOTE added
```

No other source files changed. DECISIONS.md and STATE.md: DECISIONS.md has the
new OQ-5 note. STATE.md was NOT updated (implementer explicitly disclosed this;
see CAVEAT-2 below).

---

## FRAUDS HUNTED

```
WEAKENED TESTS:
  SEC-3-3/4/5/6 converted from assertThrows to assertNoThrow + state assertions.
  Did assertions get loosened? SEC-3-3c checks twined===true (real positive verification).
  SEC-3-5c checks weighted===true (real positive verification). These add genuine value.
  SEC-3-4c/6c check false-after-never-applied — inherently weak by design (no-op nature),
  honestly disclosed by implementer in carmack-linus self-review. Not fraud.
  SEC-3-1c checks wired===false (same no-op weakness). Honestly disclosed.
  VERDICT: no weakened tests; inherent no-op weakness is structural and disclosed.

FALSE COMPLETION:
  Claimed 55/55. Observed 55/55, exit 0. Counted sections: SEC-1(9)+SEC-2(11)+
  SEC-3(21)+SEC-4(7)+SEC-5(5)+SEC-6(2) = 55. Exact match.
  VERDICT: none.

INTENT INVERSION:
  SEC-3-3c tests that twine IS applied (twined===true). This is the correct assertion
  for Phase 2 behavior. SEC-3-5c similarly for weight. No inversion found.
  VERDICT: none.

PHANTOM EVIDENCE:
  DECISIONS.md OQ-5 entry confirmed to exist with described content.
  TwineWeightEngine.ts comment confirmed replaced at lines 276-278.
  SEC-6 section confirmed present in test_security.mjs at lines 576-603.
  ARCH-TWINEWEIGHT-PATCH-2026-08-14.md §LOW-4 confirmed to say REPLACE.
  VERDICT: none.
```

---

## CAVEATS

### CAVEAT-1 (ADVISORY): Weak no-op assertions in SEC-3-1c, SEC-3-4c, SEC-3-6c

SEC-3-1c (`wired===false`), SEC-3-4c (`twined===false`), SEC-3-6c (`weighted===false`)
assert state that is unchanged by the no-op remove actions. If CareLogReplay ever
regressed to silently dropping these action types, these three assertions would still
pass. The implementer disclosed this explicitly in their carmack-linus self-review.

Mitigation: the positive apply tests (SEC-3-3c `twined===true`, SEC-3-5c `weighted===true`)
do verify real routing occurred on the apply path. The no-op paths are structurally
untestable beyond "did not throw."

Action required: none for now. This is a known test-harness limitation. If
spy/intercept infrastructure is ever added, these three should be hardened.

### CAVEAT-2 (ADVISORY): STATE.md not updated

The implementer explicitly deferred STATE.md update to the auditor (implementer
report caveat 4): "If the auditor's verdict changes from 'VERIFIED WITH CAVEATS' to
'VERIFIED' after these fixes, STATE.md should be updated to reflect that."

STATE.md currently says:
  "| @kijo/engine (TwineWeightEngine) | Phase 2 complete (2026-08-14) | TWE1-TWE9 | All pass -- 37/37 assertions |"

This does not reflect:
  - Security test suite: 55/55 (was 49/49 before caveat fixes — SEC-3-x + SEC-6 added)
  - Caveat resolution status: VERIFIED (previous audit was "VERIFIED WITH CAVEATS")

The Linter or next implementer should update STATE.md to note that:
  - test_security.mjs: 55/55 (updated from 49 to 55 by caveat fix task)
  - Phase 2 + caveat fixes: AUDITOR-VERIFIED 2026-08-16

Action required: update STATE.md before closing the TwineWeightEngine task thread.

---

## DETERMINISM CHECK

```
npm test RUN 1: 49/49 pass, exit 0, duration ~1770ms
npm test RUN 2: 49/49 pass, exit 0, duration ~2260ms
Same pass count both runs. VERIFIED.
```

---

## BOTTOM LINE

VERIFIED WITH CAVEATS. All three caveats from AUDIT-TWINEWEIGHT-PHASE2-2026-08-14.md
are resolved:

- CAVEAT-A: SEC-3-3/4/5/6 and SEC-3-1/1b/1c updated for Phase 2 behavior; positive
  state assertions (twined===true, weighted===true) verify real routing. 55/55 observed.
- CAVEAT-B: DECISIONS.md OQ-5 entry now contains the ARCH DIVERGENCE NOTE with all
  required information; traceability to ARCH-PATCH §LOW-4 confirmed.
- CAVEAT-C: Misleading "direct-call safety" comment gone; accurate replacement present;
  SEC-6-1/1b NaN guard test added and passes.

Remaining caveats are advisory only (weak no-op assertions; STATE.md update deferred).
No behavioral issues. Safe to proceed to Linter.
