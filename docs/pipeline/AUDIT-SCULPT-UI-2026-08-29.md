# Audit Report: HUD #96 Sculpt UI Implementation

**Date:** 2026-08-30  
**Auditor:** Adversarial Auditor (pipeline stage 4/5)  
**Spec:** ARCH-SCULPT-UI-2026-08-29.md + ARCH-SCULPT-UI-PATCH-2026-08-29.md  
**Critic:** CRITIC-SCULPT-UI-2026-08-29.md  

---

## VERDICT: VERIFIED

All 10 implementer claims observed true. No frauds found. Intent aligned across all checks. Scope clean (UI-only, no engine changes).

---

## CLAIMS CHECKED

1. **tsc --noEmit exits 0 from apps/web** -- VERIFIED. Re-ran myself: exit code 0, zero errors.

2. **No pruneMode/wireMode variable references remain in main3d.ts** -- VERIFIED. Grep returns only a comment on line 317 mentioning the old names. Zero variable declarations or usages.

3. **SculptMode includes 'landscape' (F1 fix)** -- VERIFIED. Line 318: `type SculptMode = 'none' | 'prune' | 'wire' | 'twine' | 'weight' | 'jin' | 'landscape';`

4. **CareBridge afterAction() pattern (F2 fix)** -- VERIFIED. care_bridge.ts lines 55-75: applyTwine calls afterAction on result.ok; removeTwine calls afterAction unconditionally; applyWeight calls afterAction on result.ok; removeWeight calls afterAction unconditionally. No ambiguous CareBridge pattern remains.

5. **All 6 handlers follow triple-log pattern (engine self-log -> localCareLog -> persistAsync)** -- VERIFIED. Observed in main3d.ts:
   - Twine apply (lines 928-950): engine logs via _logCare internally, localCareLog.push at 936, persistAsync at 946.
   - Twine remove (lines 967-971): engine logs internally, localCareLog at 969, persistAsync at 971.
   - Weight apply (lines 1010-1021): engine logs internally, localCareLog at 1016, persistAsync at 1021.
   - Weight remove (lines 1035-1039): engine logs internally, localCareLog at 1037, persistAsync at 1039.
   - Jin apply (lines 1069-1082): try/catch wraps engine call, localCareLog at 1077, persistAsync at 1082.
   - Landscape apply (lines 1103-1110): engine logs internally, localCareLog at 1105, persistAsync at 1110.

6. **round4 discipline on angle deltas** -- VERIFIED. Line 842 (wire apply): `round4(result.newAngle! - result.oldAngle!)`. Line 934 (twine apply): `round4(result.newAngle! - result.oldAngle!)`.

7. **Jin try/catch catches CareLogReplayError** -- VERIFIED. Lines 1068-1088: try block calls tree.applyJin; catch block at 1084 handles the error. JinEngine.ts line 49 confirms it throws CareLogReplayError. Catch displays stub message in hint bar.

8. **Landscape handler does NOT use selectedBranchId** -- VERIFIED. Lines 1094-1115: reads from DOM inputs (landscapeTypeSelect, landscapeX/Y/Z). Zero references to selectedBranchId. Pointer handler guard at line 394 excludes landscape: `if (sculptMode === 'none' || sculptMode === 'landscape') return;`

9. **HTML element IDs match spec and are collision-free** -- VERIFIED. index3d.html lines 86-161: all IDs present (twine-controls, twine-branch-info, twine-angle, twine-angle-label, btn-twine-apply, btn-twine-remove, weight-controls, weight-branch-info, weight-count, weight-angle-preview, btn-weight-apply, btn-weight-remove, jin-controls, jin-branch-info, jin-segment, jin-cost-label, btn-jin-apply, jin-stub-warning, landscape-controls, landscape-type, landscape-x/y/z, btn-landscape-apply). No collisions with existing IDs (wire-*, btn-*, seed, species, etc.).

10. **ThreeCanvas production view shows NO stats/style/technique (caretaker opacity)** -- VERIFIED. ThreeCanvas.tsx renders only: moisture/health bars, day/season labels, info-line, warning, btn-water, btn-next-day, btn-auto, btn-buy-seed, btn-twine-mode, btn-weight-mode, active-tree-info. CareHud.update() (hud.ts lines 69-91) writes only moisture%, health%, day, season, branch count. No StatSheet, no TechniqueResult, no classification data exposed.

---

## INTENT CHECK

```
INTENT CHECK #1 -- SculptMode type
  code does:     type SculptMode = 'none' | 'prune' | 'wire' | 'twine' | 'weight' | 'jin' | 'landscape'
  check expects: F1 BLOCKER requires 'landscape' in union
  spec says:     ARCH-SCULPT-UI-PATCH s2 F1: "Add 'landscape' to SculptMode union"
  verdict:       ALIGNED

INTENT CHECK #2 -- CareBridge pattern
  code does:     afterAction() called on success for apply methods, unconditionally for remove methods
  check expects: F2 BLOCKER: keep afterAction() on success
  spec says:     ARCH-SCULPT-UI-PATCH s3 F2: "Delete ambiguous CareBridge pattern, keep afterAction()"
  verdict:       ALIGNED

INTENT CHECK #3 -- Production view opacity
  code does:     ThreeCanvas shows only mode toggles (btn-twine-mode, btn-weight-mode), no stats/technique
  check expects: Caretaker cannot see internal stats
  spec says:     ARCH-SCULPT-UI s5.3: "Production UI shows NO stats/style/technique"
  verdict:       ALIGNED

INTENT CHECK #4 -- Landscape not branch-targeted
  code does:     landscape handler reads (elementType, position) from DOM inputs; pointer guard excludes landscape from raycaster
  check expects: Landscape uses position-based placement
  spec says:     ARCH-SCULPT-UI s4.4: "Landscape is NOT branch-targeted, uses (elementType, position) not branchId"
  verdict:       ALIGNED

INTENT CHECK #5 -- Jin Phase 1 stub
  code does:     try/catch wraps applyJin, catches CareLogReplayError, shows stub message in hint bar
  check expects: JinEngine throws CareLogReplayError; UI handles gracefully
  spec says:     JinEngine.ts: "Phase 1 stub -- voxelization in Phase 2"
  verdict:       ALIGNED

INTENT CHECK #6 -- Weight stacking (OQ-5 STACK)
  code does:     Weight handler does not check if already weighted; TwineWeightEngine.applyWeight accumulates weightAngleDelta (line 289: +=)
  check expects: OQ-5 STACK semantics: weight stacks, doesn't replace
  spec says:     DECISIONS.md OQ-5: "Calling applyWeight on already-weighted branch ACCUMULATES"
  verdict:       ALIGNED

INTENT CHECK #7 -- Twine degradeDays
  code does:     main3d.ts line 941/949: `tree.getBranches()[selectedBranchId].twineDegradesDay - tree.getAge()`
  check expects: degradeDays = twineDegradesDay - currentAge (Assumption A5)
  spec says:     ARCH-SCULPT-UI s4.1: "degradeDays = twineDegradesDay - currentAge"
  verdict:       ALIGNED
```

---

## SCOPE

**Files changed (UI only, no engine changes):**
- `apps/web/index3d.html` -- new HTML controls for twine/weight/jin/landscape
- `apps/web/index2d.html` -- new button row (btn-twine, btn-weight, btn-jin, btn-landscape)
- `apps/web/src/main3d.ts` -- SculptMode migration, all 6 handlers, setSculptMode, selectSculptBranch, deselectSculptBranch
- `apps/web/src/main2d.ts` -- SculptMode2D type, twine/weight/jin/landscape handlers using prompt() dialogs
- `apps/web/src/bridge/care_bridge.ts` -- applyTwine, removeTwine, applyWeight, removeWeight, getBranch
- `apps/web/src/ui/hud.ts` -- optional onTwine/onWeight callbacks
- `apps/web/src/components/ThreeCanvas.tsx` -- prodSculptMode toggle, btn-twine-mode/btn-weight-mode in JSX

**No engine files modified. No shared types modified. Scope matches implementer's claim.**

**Note on main2d.ts:** The 2D debug view retains `pruneMode` as a separate boolean alongside `SculptMode2D`, with mutual exclusion logic. This is architecturally acceptable: the 2D view is a debug tool, not the production UI, and was not required to adopt the full 7-value SculptMode union. The F5 migration checklist targeted main3d.ts (the 3D debug/care view) and ThreeCanvas (production).

---

## FRAUDS HUNTED

- **Weakened tests:** None found. No test files modified. UI-only changes.
- **False completion:** None found. tsc exit code 0 confirmed by independent re-run.
- **Intent inversion:** None found. All 7 intent checks ALIGNED. No spec/test conflicts.
- **Phantom evidence:** None found. Line numbers from implementer report match actual file contents. Element IDs verified in HTML. Function signatures match across files.

---

## ADDITIONAL CHECKS (Kijo-specific)

- **round4 discipline:** Present at lines 842 (wire) and 934 (twine). No new engine math introduced (UI only).
- **DECISIONS.md sync:** No new decisions expected (UI task, no engine changes). Confirmed correct.
- **Import boundaries:** care_bridge.ts imports from @kijo/engine and @kijo/shared only. main3d.ts/main2d.ts import from @kijo/engine and @kijo/shared. ThreeCanvas.tsx imports from @kijo/engine and @kijo/shared. No forbidden imports.
- **btn-new reset:** Line 559: `setSculptMode('none')` -- properly resets sculpt state on new tree.

---

## BOTTOM LINE

VERIFIED. The Sculpt UI implementation correctly wires all 6 sculpt actions (twine, twine-remove, weight, weight-remove, jin, landscape) across 3 views (3D debug, 2D debug, production). Both F1 and F2 blockers from the corrective patch are resolved. The pruneMode/wireMode migration is complete in main3d.ts. Triple-log pattern is consistent. round4 discipline is maintained. Production view respects caretaker opacity. tsc clean. No frauds detected.
