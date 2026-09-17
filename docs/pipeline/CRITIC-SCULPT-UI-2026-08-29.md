# CRITIC-SCULPT-UI-2026-08-29

**Pipeline stage:** Critic (Adversarial Auditor skill)
**Date:** 2026-08-29
**Target:** `docs/pipeline/ARCH-SCULPT-UI-2026-08-29.md`
**Verdict:** CAVEATS

---

## VERDICT: CAVEATS

The architect spec is substantially correct. The CareAction shapes, engine API signatures, caretaker opacity rules, twine!=wire separation, and triple-log pattern (engine self-log + localCareLog + persistAsync) are all verified against actual source. One blocking type-level bug (SculptMode missing 'landscape'), several documentation gaps (missing engine spec citations, ambiguous CareBridge pattern), and one non-functional production UX (buttons without raycaster) must be addressed before the implementer starts.

---

## CLAIMS CHECKED

```
CLAIM                                                              | V
-------------------------------------------------------------------+---
C1  BonsaiTree.applyTwine(branchId, angleDelta, storedDegradeDays?)| VERIFIED
    -> TwineResult. Confirmed BonsaiTree.ts:203. Signature exact.  |
    TwineResult: { ok, reason?, oldAngle?, newAngle? }             |
    TwineRejectReason: 'not-found'|'pruned'|'already-twined'      |
                                                                   |
C2  BonsaiTree.removeTwine(branchId) -> void                      | VERIFIED
    BonsaiTree.ts:217. Delegates to TwineWeightEngine.removeTwine. |
    No-op on not-found/pruned/!twined. Logs + markDirty internally.|
                                                                   |
C3  BonsaiTree.applyWeight(branchId, weightCount) -> WeightResult  | VERIFIED
    BonsaiTree.ts:226. Validates isFinite, isInteger, 1-4 range.   |
    Throws CareLogReplayError on bad input. Delegates to TWE.      |
    WeightResult: { ok, reason?, torqueContribution? }             |
    WeightRejectReason: 'not-found'|'pruned'|'weight-cap-exceeded' |
                                                                   |
C4  BonsaiTree.removeWeight(branchId) -> void                     | VERIFIED
    BonsaiTree.ts:245. Same no-op pattern as removeTwine.          |
                                                                   |
C5  BonsaiTree.applyJin(branchId, segmentIndex, jinCost) ->       | VERIFIED
    JinResult. BonsaiTree.ts:254. Validates segmentIndex (>=0 int) |
    and jinCost (>=1 int), then delegates to JinEngine.applyJin.   |
    JinEngine returns ok:false for not-found/pruned/segment-oob,   |
    then THROWS CareLogReplayError (Phase 1 stub, line 49).        |
    Spec correctly identifies the throw-after-validation behavior.  |
                                                                   |
C6  BonsaiTree.addLandscape(elementType, position) -> void         | VERIFIED
    BonsaiTree.ts:275. Validates position [0,255] per axis.        |
    Logs + markDirty internally. NOT branch-targeted.               |
    LandscapeElementType = 'rock'|'moss'|'pot'.                    |
    Coordinate = { x, y, z }.                                      |
                                                                   |
C7  Branch fields: twined, twineAppliedDay, twineAngle,           | VERIFIED
    twineDegradesDay, weighted, weightCount, weightAppliedDay      |
    All confirmed in shared/index.ts at the cited line numbers.     |
                                                                   |
C8  TWINE_MAX_ANGLE_DELTA = 28 (TwineWeightEngine.ts:23)          | VERIFIED
C9  WEIGHT_DEGREES_PER_UNIT = 7 (TwineWeightEngine.ts:26)         | VERIFIED
                                                                   |
C10 CareAction shapes for all 6 new types match shared/index.ts   | VERIFIED
    'twine', 'twine-remove', 'weight', 'weight-remove', 'jin',    |
    'landscape' -- all field names and types match exactly.         |
                                                                   |
C11 Engine self-logging pattern: TwineWeightEngine.applyTwine      | VERIFIED
    calls tree._logCare() at line 190. applyWeight at line 312.    |
    removeTwine at line 233 (logs twine-remove). removeWeight at   |
    line 348 (logs weight-remove). addLandscape at line 285.       |
    Spec correctly identifies the triple-log requirement.           |
                                                                   |
C12 Wire UI reference pattern in index3d.html lines 74-85:        | VERIFIED
    Hidden div, angle slider, apply/remove. Spec extends pattern.  |
                                                                   |
C13 Mutual exclusion: existing pruneMode/wireMode in main3d.ts    | VERIFIED
    Lines 628-661. Spec replaces with unified SculptMode enum.     |
                                                                   |
C14 Caretaker opacity: production view shows NO stats             | VERIFIED
    DESIGN-CARETAKER-OPACITY.md: App.tsx/ThreeCanvas/CareHud =    |
    None. Spec correctly limits production overlay to "Branch #N   |
    twined" / "2 weights" without angle values or stat impacts.    |
                                                                   |
C15 Twine != wire: separate CareAction types, separate Branch     | VERIFIED
    fields, separate controls. DESIGN-TWINE-VS-WIRE.md confirms   |
    twine does NOT count as wire for technique classification.     |
    Spec maintains full separation.                                |
                                                                   |
C16 HTML element IDs are collision-free with existing IDs          | VERIFIED
    Grep for btn-twine/weight/jin/landscape in apps/web: 0 hits.  |
    All 25+ proposed IDs checked against index3d.html IDs.         |
                                                                   |
C17 Landscape correctly avoids branch targeting                    | VERIFIED
    Uses (elementType, position) not branchId. Not a sculpt mode   |
    that disables orbit. Separate from branch selection mechanism.  |
                                                                   |
C18 CareBridge method signatures compatible with engine API        | VERIFIED
    applyTwine omits optional storedDegradeDays (correct for live  |
    calls). applyWeight matches engine signature. getBranch is new  |
    convenience method. All types importable from @kijo/shared.    |
                                                                   |
C19 A5: degradeDays = twineDegradesDay - currentAge               | VERIFIED
    TwineResult has NO degradeDays field. Engine stores             |
    twineDegradesDay = twineAppliedDay + degradeDays on branch.    |
    UI extraction: (twineDegradesDay - tree.getAge()) = degradeDays|
    This is algebraically correct immediately after applyTwine.    |
                                                                   |
C20 SculptMode type includes 'landscape'                          | *** REFUTED ***
    Spec defines: type SculptMode = 'none'|'prune'|'wire'|        |
    'twine'|'weight'|'jin'. NO 'landscape'. But the landscape      |
    button handler calls setSculptMode('landscape') and checks     |
    sculptMode === 'landscape'. TypeScript WILL reject both calls. |
    The hints Record<SculptMode, string> also has no 'landscape'   |
    key. This is a blocking type error.                            |
                                                                   |
C21 2D view localCareLog usage                                    | N/A
    main2d.ts has NO localCareLog variable. Spec's 2D code only    |
    calls persistAsync(), matching the existing 2D pattern.        |
    Consistent with existing debt (2D is debug-only).              |
                                                                   |
C22 Jin catch/error path correctness                              | VERIFIED
    JinEngine returns { ok:false, reason } for validation fails   |
    (not-found, pruned, segment-oob). THEN throws for the stub.   |
    Spec's try/catch wraps everything: validation rejections hit   |
    the if(!result.ok) path; stub throw hits the catch. Correct.  |
```

---

## INTENT CHECK

```
INTENT CHECK (Primary: SculptMode type)
  code does:    SculptMode = 'none'|'prune'|'wire'|'twine'|'weight'|'jin' (no 'landscape')
  check expects: setSculptMode('landscape') call compiles; sculptMode === 'landscape' compiles
  spec says:    "Landscape is NOT a sculpt mode" (heading) but then uses it as one in the
                button handler and setSculptMode dispatch.
  verdict:      CONFLICT — the spec contradicts itself. The design INTENT is that landscape
                participates in the unified mode system (mutual exclusion, active button CSS)
                but the type definition excludes it. Fix: add 'landscape' to SculptMode union
                and add a hints entry, or make the landscape handler fully independent.

INTENT CHECK (Secondary: CareBridge pattern)
  code does:    CareBridge.water() calls this.afterAction() internally
  check expects: sculpt methods either do or don't call afterAction()
  spec says:    First shows methods that DON'T call afterAction(), then says
                "Alternative (simpler, recommended):" with methods that DO.
                Two conflicting patterns in the same spec.
  verdict:      CONFLICT — ambiguous. Implementer gets no clear signal. The recommended
                pattern (call afterAction on ok) is correct. Delete the first pattern.

INTENT CHECK (Tertiary: production view completeness)
  code does:    ThreeCanvas.tsx has NO raycaster, no branch picking
  check expects: twine/weight buttons exist and are functional
  spec says:    "Add the buttons now, wire the mode toggle, but defer branch picking
                to a follow-up task. The buttons exist and do nothing until picking is wired."
  verdict:      ALIGNED — documented. The buttons are non-functional stubs. OQ-1 tracks this.
```

---

## SCOPE

Does the spec cover all four actions across all three views?

| Action    | 3D (main3d.ts) | 2D (main2d.ts) | Production (ThreeCanvas.tsx) |
|-----------|---------------|-----------------|------------------------------|
| Twine     | Full          | Full (prompt)   | Buttons only (no raycaster)  |
| Weight    | Full          | Full (prompt)   | Buttons only (no raycaster)  |
| Jin       | Full + catch  | Full + catch    | Deferred (documented)        |
| Landscape | Full          | Full (prompt)   | Deferred (documented)        |

Coverage is adequate. Jin/landscape deferral in production is justified (stub throws; position picker is complex). Production twine/weight are non-functional stubs but documented as such.

---

## FRAUDS HUNTED

```
weakened tests:     N/A — this is an architecture spec, not implementation.
                    No tests existed to weaken.

false completion:   FOUND (minor) — The spec claims "READY FOR IMPLEMENTER" but
                    contains a blocking type error (SculptMode missing 'landscape')
                    and an ambiguous CareBridge pattern (two conflicting designs).
                    Neither is a deep design flaw; both are spec-level cleanup.

intent inversion:   NONE — all design decisions align with DESIGN-CARETAKER-OPACITY.md,
                    DESIGN-TWINE-VS-WIRE.md, and DESIGN-TECHNIQUE-CLASSIFICATION.md.
                    Engine API usage is correct throughout.

phantom evidence:   FOUND (minor) — The reconnaissance table claims 16 files read but
                    does NOT cite three mandatory engine specs:
                    - ARCHITECT-CAREACTION-TECHNIQUE-2026-07-30.md
                    - ARCH-TWINEWEIGHT-ENGINE-2026-08-14.md
                    - ARCH-TWINEWEIGHT-PATCH-2026-08-14.md
                    Despite the citation gap, the spec's design IS consistent with
                    those docs (verified by auditor). The omission is sloppy but
                    not fraudulent — the architect clearly read the source files
                    that those docs describe.
```

---

## SOURCE CITATION GAP ANALYSIS

The spec's reconnaissance table omits three engine specs that the task brief flagged as mandatory reads. Auditor verified consistency despite the omissions:

| Missing doc | Key content | Spec consistent? |
|---|---|---|
| ARCHITECT-CAREACTION-TECHNIQUE-2026-07-30.md | TwineResult/WeightResult/JinResult shapes, Branch fields | YES — spec cites shared/index.ts directly, which is the implementation of this doc |
| ARCH-TWINEWEIGHT-ENGINE-2026-08-14.md | applyTwine degradeDays, time-ratio spring-back, CareLogReplay routing | YES — spec's A5 degradeDays extraction is correct; care log entry shapes match |
| ARCH-TWINEWEIGHT-PATCH-2026-08-14.md | OQ-1 weightAppliedDay, OQ-3 time-ratio, corrected gate tests | YES — spec's weight handling uses the corrected field names (weightAppliedDay, not the pre-patch naming) |

The architect went to the source (actual .ts files) rather than the architecture docs. This is defensible but violates the mandatory-read requirement. Flagged as CAVEAT.

---

## SPECIFIC FINDINGS

### F1: SculptMode type missing 'landscape' (BLOCKING)

**Severity:** Blocking — tsc will reject the spec as written.

The spec defines:
```typescript
type SculptMode = 'none' | 'prune' | 'wire' | 'twine' | 'weight' | 'jin';
```

But the landscape button handler calls `setSculptMode('landscape')` and checks `sculptMode === 'landscape'`. The `hints` Record has no 'landscape' key. Three type errors.

**Fix:** Add `'landscape'` to the SculptMode union. Add a landscape hint string. OR refactor the landscape handler to be fully independent of setSculptMode (less clean).

### F2: Ambiguous CareBridge pattern (BLOCKING for implementer clarity)

**Severity:** Medium — implementer gets two contradictory designs.

The spec shows CareBridge.applyTwine without `afterAction()` call (section "CareBridge extension"), then immediately shows "Alternative (simpler, recommended):" with `afterAction()`. The implementer must choose, but the spec should have already chosen.

**Fix:** Delete the first pattern. Keep only the recommended pattern (afterAction on ok). This matches the existing `bridge.water()` pattern.

### F3: Production view buttons are non-functional stubs

**Severity:** Low — documented in OQ-1 and the spec text.

ThreeCanvas.tsx has no raycaster. The spec adds buttons and mode toggles but the TODO comments say "raycaster branch picking required." The implementer will produce buttons that toggle a mode flag but can't select branches.

**Recommendation:** Either defer the production buttons entirely (cleaner) or explicitly mark the follow-up task with a gate condition.

### F4: Missing engine spec citations

**Severity:** Low — design is verified correct despite omissions.

See Source Citation Gap Analysis above. The architect should cite the engine specs for traceability even when going directly to source.

### F5: pruneMode/wireMode migration not fully specified

**Severity:** Low — implied but could lead to missed spots.

The spec shows replacing the boolean declarations and the pointer handler but doesn't enumerate all 15+ references to `pruneMode`/`wireMode` in main3d.ts (lines 282, 284, 359, 381, 391, 408, 527, 529, 624, 625, 627, 629, 630, 647, 648, 650, 652, 657, 658). The implementer must find and replace all of them.

**Recommendation:** Add a note: "All references to `pruneMode` and `wireMode` in main3d.ts must be replaced with `sculptMode === 'prune'` and `sculptMode === 'wire'` respectively."

---

## BOTTOM LINE

The spec's design is sound — engine API usage is correct, caretaker opacity is respected, twine!=wire separation is maintained, and the triple-log pattern is properly applied. Two blocking issues must be fixed before implementation: (1) add 'landscape' to SculptMode union so tsc passes, and (2) delete the ambiguous CareBridge pattern and keep only the recommended one. Everything else is advisory.
