# AUDIT-THREECANVAS-RAYCASTER-2026-09-01

**Pipeline stage:** Auditor (Adversarial Auditor + Carmack × Linus Review)
**Date:** 2026-09-01
**Skills governing:** adversarial-auditor, carmack-linus-review
**Target:** ThreeCanvas raycaster + branch picking (#97)
**Spec:** ARCH-THREECANVAS-RAYCASTER-2026-08-30.md + PATCH-2026-08-30.md
**Implementer gate:** `npx tsc --noEmit -p apps/web/tsconfig.json` exits 0

---

## VERDICT: VERIFIED

---

## STEP 0 — CLAIMS EXTRACTED

From the implementer report, 16 falsifiable claims:

| # | Claim |
|---|-------|
| C1 | SculptMode expanded to 7 modes (none/prune/wire/twine/weight/jin/landscape) |
| C2 | THREE.Raycaster + pointer setup for branch picking |
| C3 | Yellow wireframe selection indicator on careScene.scene |
| C4 | selectBranch() / deselectBranch() with overlay management |
| C5 | Control builders + listeners for all 5 sculpt modes |
| C6 | Named onPointerDown handler with proper cleanup (F5) |
| C7 | setSculptMode() with OrbitControls disable + cursor + button active state |
| C8 | F1: Wire overlay shows "wired"/"unwired" only — no angle values |
| C9 | F2/F3: Correct triple-log ordering (bridge → push → persist → cacheTree) |
| C10 | F4: WEIGHT_DEGREES_PER_UNIT imported, no magic 7 |
| C11 | F6: prune() return value checked |
| C12 | F7: Rejection reason shown in overlay |
| C13 | F9: deselectBranch() before both tree swap points |
| C14 | F10: Weight preview shows cumulative total |
| C15 | JSX: Added prune/wire/jin buttons + sculpt-overlay div |
| C16 | tsc --noEmit exits 0 |

---

## STEP 1 — RE-RUN GATE

```
$ npx tsc --noEmit -p apps/web/tsconfig.json
EXIT:0
```

**Observed: exit code 0.** No errors, no warnings (other than npm update notice). Claim C16 CONFIRMED.

---

## STEP 2 — DIFF AGAINST SPEC + PATCH

### Files changed

| File | Claim | Observed |
|------|-------|----------|
| `apps/web/src/components/ThreeCanvas.tsx` | Major raycaster addition | 757 lines total. All raycaster code present. |
| `apps/web/src/ui/hud.ts` | +onPrune/onWire/onJin callbacks | Lines 16-18: callbacks declared. Lines 65-70: wired in constructor. |
| `apps/web/src/renderer/tree_mesh.ts` | NO CHANGES | Confirmed: userData.branchId at lines 229, 243, 257 — pre-existing, untouched. |
| `apps/web/src/bridge/care_bridge.ts` | NO CHANGES | Confirmed: sculpt methods from #96 intact, untouched. |
| `apps/web/src/renderer/scene.ts` | NO CHANGES | Confirmed: untouched. |

Scope matches the implementer report exactly. No undisclosed file changes.

---

## CLAIMS CHECKED

```
✓ C1  — SculptMode 7 modes
         observed: ThreeCanvas.tsx:39 — type SculptMode = 'none' | 'prune' | 'wire' | 'twine' | 'weight' | 'jin' | 'landscape'

✓ C2  — Raycaster + pointer
         observed: ThreeCanvas.tsx:121-122 — new THREE.Raycaster(), new THREE.Vector2()

✓ C3  — Yellow wireframe indicator on careScene.scene
         observed: ThreeCanvas.tsx:126-133 — SphereGeometry(2.5,8,6), color 0xffdd00, wireframe:true,
                   careScene.scene.add(mesh). NOT treeRoot — survives buildTreeMesh.

✓ C4  — selectBranch/deselectBranch
         observed: ThreeCanvas.tsx:135-183 — deselectBranch hides indicator + overlay.
                   selectBranch sets position, shows overlay with mode-specific content.

✓ C5  — 5 sculpt mode control builders + listeners
         observed: ThreeCanvas.tsx:187-436
           buildTwineControls (187-200) + twineControlsListeners (202-249)
           buildWeightControls (252-268) + weightControlsListeners (270-321)
           buildWireControls (323-336) + wireControlsListeners (338-381)
           buildJinControls (383-400) + jinControlsListeners (402-436)
           Prune: handled directly in onPointerDown (456-463), no sub-controls needed.

✓ C6  — Named onPointerDown + cleanup
         observed: ThreeCanvas.tsx:439 — const onPointerDown = (e: PointerEvent) => { ... }
                   ThreeCanvas.tsx:480 — addEventListener('pointerdown', onPointerDown)
                   ThreeCanvas.tsx:688 — removeEventListener('pointerdown', onPointerDown) in cleanup

✓ C7  — setSculptMode with controls/cursor/active
         observed: ThreeCanvas.tsx:483-504
           Line 484: deselectBranch() on mode change
           Lines 485-489: remove 'active' from all 5 mode buttons
           Line 494: controls.enableRotate = !branchTargeted && mode !== 'prune'
           Line 495: cursor = crosshair when mode !== 'none'
           Lines 501-503: add 'active' class to active button

✓ C8  — F1: Wire overlay — no angle values
         observed: ThreeCanvas.tsx:157-161
           const wiredLabel = branch.wired ? 'wired' : 'unwired';
           label.textContent = `Branch #${branchId} -- ${wiredLabel}`;
           NO branch.angle anywhere in wire overlay. CARETAKER OPACITY COMPLIANT.

✓ C9  — F2/F3: Correct triple-log ordering
         observed:
           TWINE-APPLY (212-238): bridge → check ok (F7) → push → persist → cacheTree → selectBranch ✓
           WEIGHT-APPLY (288-310): bridge → check ok (F7) → push → persist → cacheTree → selectBranch ✓
           TWINE-REMOVE (241-248): push → bridge → persist → selectBranch ✓ (no result needed)
           WEIGHT-REMOVE (313-320): push → bridge → persist → selectBranch ✓
           WIRE-APPLY (347-369): tree.wire → check ok → push → refreshView → persist → selectBranch ✓
           WIRE-REMOVE (372-380): push → tree.removeWire → refreshView → persist → selectBranch ✓
           PRUNE (456-463): tree.prune → check ok → push → refreshView → persist ✓
           JIN (416-429): tree.applyJin → check ok → push → refreshView → persist ✓
         All 8 action handlers follow the correct ordering per PATCH spec.

✓ C10 — F4: WEIGHT_DEGREES_PER_UNIT imported, no magic 7
         observed: ThreeCanvas.tsx:18 — import { ..., WEIGHT_DEGREES_PER_UNIT } from '@kijo/engine'
                   ThreeCanvas.tsx:253 — 1 * WEIGHT_DEGREES_PER_UNIT in default preview
                   ThreeCanvas.tsx:277 — wc * WEIGHT_DEGREES_PER_UNIT in change listener
                   Zero occurrences of magic number 7.

✓ C11 — F6: prune() return value checked
         observed: ThreeCanvas.tsx:458-459
           const pruned = tree.prune(hitBranchId);
           if (!pruned) continue;
           Log/persist only runs on successful prune.

✓ C12 — F7: Rejection reason shown in overlay
         observed:
           Twine-apply (221-223): rejLabel.textContent = `... ${result.reason ?? 'rejected'}`
           Weight-apply (296-299): same pattern
           Wire-apply (355-357): same pattern
           Jin-apply (419-421): same pattern
           Jin catch (432-433): shows 'jin stub (Phase 2)' on thrown error

✓ C13 — F9: deselectBranch() before tree swaps
         observed: ThreeCanvas.tsx:589 — deselectBranch() before cache restore swap
                   ThreeCanvas.tsx:651 — deselectBranch() before DB load swap
                   Both swap points covered.

✓ C14 — F10: Weight preview shows cumulative total
         observed: ThreeCanvas.tsx:274-284
           weightControlsListeners receives (branchId, branch) — branch passed explicitly.
           If branch.weighted && branch.weightAngleDelta > 0:
             shows `+${newDelta} deg (total: ${total} deg)`
           Else: shows `+${newDelta} deg down`

✓ C15 — JSX: buttons + sculpt overlay
         observed: ThreeCanvas.tsx:734-736 — btn-prune-mode, btn-wire-mode, btn-jin-mode buttons
                   ThreeCanvas.tsx:742-753 — sculpt-overlay div with sculpt-branch-label + sculpt-controls-inner
```

**16/16 claims CONFIRMED. Zero refuted. Zero unverifiable.**

---

## STEP 3 — FRAUDS HUNTED

### Weakened tests
**NONE.** The gate is `tsc --noEmit` only — no test files exist for ThreeCanvas.tsx.
No test files were created, modified, or weakened. The gate is the same one used
by all prior pipeline stages. No assertion was loosened, commented out, or skipped.

### False completion
**NONE.** Auditor re-ran `npx tsc --noEmit -p apps/web/tsconfig.json` independently.
Exit code 0 confirmed. The implementer's claim matches reality.

### Intent inversion
**NONE.** See Step 4 (Intent Checks) below. All 10 patch findings implemented as
specified. No spec requirement was silently ignored or inverted.

### Phantom evidence
**NONE.** Every line number, function name, and code pattern cited by the implementer
was located in the actual file. Spot-checked:
- `deselectBranch()` at line 589 and 651 — confirmed present
- `WEIGHT_DEGREES_PER_UNIT` import at line 18 — confirmed present
- Named `onPointerDown` at line 439, cleanup at line 688 — confirmed present
- `tree.prune` return check at line 458-459 — confirmed present

---

## STEP 4 — INTENT CHECKS

### F1: Wire overlay caretaker opacity

```
INTENT CHECK
  code does:     Shows "wired"/"unwired" text only. No angle values. (ThreeCanvas.tsx:159)
  check expects: tsc --noEmit passes (type-checks only, not behavioral)
  spec says:     PATCH F1: "Remove angle values from wire overlay label. Show only wired/unwired."
  verdict:       ALIGNED
```

### F2: Twine-apply handler ordering

```
INTENT CHECK
  code does:     bridge.applyTwine → check ok → localCareLog.push → persistAsync → cacheTree()
  check expects: tsc --noEmit (no runtime ordering assertion)
  spec says:     PATCH F2: "bridge call first, then push, persist, cacheTree"
  verdict:       ALIGNED
```

### F3: Weight-apply handler ordering

```
INTENT CHECK
  code does:     bridge.applyWeight → check ok → localCareLog.push → persistAsync → cacheTree()
  check expects: tsc --noEmit (no runtime ordering assertion)
  spec says:     PATCH F3: "Apply identical corrected ordering to weight-apply"
  verdict:       ALIGNED
```

### F4: WEIGHT_DEGREES_PER_UNIT import

```
INTENT CHECK
  code does:     Imports WEIGHT_DEGREES_PER_UNIT from @kijo/engine, uses in preview computation
  check expects: tsc --noEmit verifies import resolves and type is number
  spec says:     PATCH F4: "Import the constant. Add to the imports section."
  verdict:       ALIGNED
```

### F5: Named pointer handler + cleanup

```
INTENT CHECK
  code does:     Named `onPointerDown` const, addEventListener on mount, removeEventListener in cleanup
  check expects: tsc --noEmit (type-checks the handler signature)
  spec says:     PATCH F5: "Name the handler function and remove it on cleanup"
  verdict:       ALIGNED
```

### F6: prune() return value checked

```
INTENT CHECK
  code does:     const pruned = tree.prune(hitBranchId); if (!pruned) continue;
  check expects: tsc --noEmit (prune returns boolean, boolean checked)
  spec says:     PATCH F6: "Patch the spec to check the return value"
  verdict:       ALIGNED
```

### F7: Rejection reason shown

```
INTENT CHECK
  code does:     All 4 apply handlers show result.reason in sculpt-branch-label on !result.ok
  check expects: tsc --noEmit (reason is string | undefined per TwineResult/WeightResult types)
  spec says:     PATCH F7: "Show the rejection reason in the branch label"
  verdict:       ALIGNED
```

### F8: confirm() accepted for Phase 1

```
INTENT CHECK
  code does:     window.confirm() used for jin. Phase 2 TODO comment present (lines 409-411).
  check expects: tsc --noEmit (confirm returns boolean, checked)
  spec says:     PATCH F8: "Accept for Phase 1. Add implementer note."
  verdict:       ALIGNED
```

### F9: deselectBranch() before tree swaps

```
INTENT CHECK
  code does:     deselectBranch() at line 589 (cache restore) and line 651 (DB load)
  check expects: tsc --noEmit (function exists and is callable)
  spec says:     PATCH F9: "Add deselectBranch() before tree swaps at ~line 203 and ~264"
  verdict:       ALIGNED
```

### F10: Weight preview cumulative total

```
INTENT CHECK
  code does:     Shows "+N deg (total: M deg)" when branch.weighted && weightAngleDelta > 0
  check expects: tsc --noEmit (weightAngleDelta exists on Branch type)
  spec says:     PATCH F10: "Show both the delta and the cumulative total when already weighted"
  verdict:       ALIGNED
```

**10/10 intent checks ALIGNED. Zero CONFLICT.**

---

## STEP 5 — SCOPE

```
FILES CHANGED:
  apps/web/src/components/ThreeCanvas.tsx — EXPECTED (major addition)
  apps/web/src/ui/hud.ts                 — EXPECTED (minor: 3 callbacks + 6 lines wiring)

FILES CLAIMED UNCHANGED — CONFIRMED UNCHANGED:
  apps/web/src/renderer/tree_mesh.ts     — userData.branchId pre-existing at 229/243/257
  apps/web/src/bridge/care_bridge.ts     — sculpt methods from #96 intact
  apps/web/src/renderer/scene.ts         — untouched

NO UNDISCLOSED FILE CHANGES.
```

---

## KIJO-SPECIFIC CHECKS

| Check | Result |
|-------|--------|
| Caretaker opacity: wire overlay no angle numbers (F1) | ✓ Only "wired"/"unwired" shown |
| Caretaker opacity: no stats/technique/matchPct anywhere | ✓ Overlay shows branchId, twined/weighted state, weight bags only |
| Triple-log ordering per PATCH spec | ✓ All 8 handlers verified |
| round4 discipline | ✓ appliedDelta = round4(newAngle - oldAngle) at lines 226, 277, 360 |
| Import boundaries (apps/web → @kijo/shared, @kijo/engine) | ✓ No forbidden imports |
| No raw stat numbers exposed to player | ✓ Branch length shown in jin overlay (physical property, not stat) |
| DECISIONS.md sync | N/A — no R-numbers resolved in this task |
| STATE.md next-task pointer | Matches: #97 ThreeCanvas raycaster is the documented next task |

---

## FRAUDS HUNTED (summary)

```
weakened tests:    NONE (no test files involved; gate is tsc --noEmit only)
false completion:  NONE (auditor re-ran tsc, exit 0 confirmed)
intent inversion:  NONE (10/10 patch findings aligned)
phantom evidence:  NONE (all cited lines/symbols verified in actual files)
```

---

## BOTTOM LINE

Every claim verified. 16/16 claims confirmed. 10/10 patch findings implemented correctly.
tsc gate re-run independently — exit 0. No frauds. No scope violations. No caretaker
opacity violations. Implementation is faithful to the architect spec + corrective patch.

---

---

# ⚡ CODE REVIEW: ThreeCanvas raycaster + branch picking

## The Verdict

This is clean, well-structured code. The implementer correctly chose Option A
(userData.branchId from existing mesh annotations) over the InstancedMesh voxel-grid
approach, resulting in a ~320-line addition that is dramatically simpler than the
equivalent in main3d.ts (~750 lines). Every patch finding (F1-F10) is addressed
surgically. The log ordering is correct for all 8 action handlers. The code reads
like it was written by someone who understood the architecture, not someone who
cargo-culted from the spec.

## ⚠️ Logic & Security Context

- **Invariants preserved:** Raycaster is read-only. All state mutations go through
  engine methods (tree.prune, tree.wire, bridge.applyTwine, etc.) which validate
  branchId bounds internally. No new trust boundary introduced.
- **Trust model:** Client-side UI only. branchId comes from userData set by tree_mesh.ts
  at mesh build time — not injectable by external input.
- **State ordering:** All 8 handlers follow the correct log ordering per the PATCH spec.
  Bridge-managed apply: bridge → push → persist → cacheTree. Bridge-managed remove:
  push → bridge → persist. Direct engine: engine → push → refreshView → persist.
- **Reentrancy:** No async gaps in the critical sections. Bridge calls are synchronous.
  The only async code is persistAsync (fire-and-forget).
- **Determinism impact:** None. Raycaster is UI-only. All state changes flow through
  the same engine methods used by main3d.ts.

## 🕹️ Carmack's Notes

1. **Raycaster performance:** On pointerdown against ~50-90 meshes with bounding sphere
   pre-checks — sub-microsecond. No concern at any realistic branch count. The
   `recursive: false` flag in `intersectObjects` is correct since all meshes are
   direct children of treeRoot (no nesting). Good.

2. **Selection indicator placement:** Using `hit.point` (surface intersection) rather
   than branch centroid. This means the indicator appears where the user clicked, not
   at the branch center. Acceptable UX — the indicator is a selection feedback signal,
   not a precise position marker.

3. **Memory discipline:** selectionIndicator geometry + material properly disposed in
   cleanup (lines 690-691). innerHTML-created DOM nodes die with their parent on
   replacement. No leaks.

4. **Hot path:** The `onPointerDown` handler is NOT in the animation loop — it fires
   only on user clicks. No performance concern. The animate loop (540-544) is untouched
   and clean.

5. **Minor addition beyond spec:** Wire apply/remove log entries include `wireCost:
   result.wireCost!` (lines 364, 368) which the spec omitted. This is a correct
   addition — recording the wire cost for care log replay fidelity. tsc passes, so
   the CareAction 'wire' type includes this field.

## 🐧 Linus's Notes

1. **Data structure:** userData.branchId is the right lookup. O(1) from raycast hit to
   branchId. The main3d.ts approach (InstancedMesh → matrix → world → grid → voxel →
   branchId) is an artifact of InstancedMesh lacking per-instance identity. The
   implementer correctly did NOT replicate that complexity here.

2. **Error handling:** Every apply handler checks `result.ok` and shows the rejection
   reason (F7). Prune checks the boolean return (F6). Jin wraps the Phase 1 stub throw
   in try/catch with user feedback. No silent failures.

3. **API design:** `setSculptMode` is a clean centralized mode switch that handles
   deselection, button highlighting, orbit control, and cursor in one place. Can't be
   misused — calling with 'none' resets everything correctly.

4. **Cleanup completeness:** The useEffect return (684-693) disposes: animation frame,
   pointer listener, indicator geometry, indicator material, and renderer. Complete.

5. **weightControlsListeners signature:** Takes `(branchId, branch)` as explicit
   parameters rather than capturing `branch` from an outer closure. This is actually
   cleaner than the spec's closure capture approach — the dependency is explicit.

6. **Jin catch block enhancement:** The implementer added rejection feedback in the
   catch block (lines 432-433) showing "jin stub (Phase 2)" — not in the spec but a
   sensible UX improvement over silent failure.

## What This Code Gets Right

- Zero changes to tree_mesh.ts, care_bridge.ts, or scene.ts — the raycaster exploits
  existing annotations without modifying the data source
- Every F1-F10 patch finding addressed, not just acknowledged
- Consistent log ordering across all 8 action types
- Caretaker opacity strictly maintained — no stat leakage
- Phase 1 jin stub handled gracefully with user-visible warning + try/catch
- Clean separation between mode-agnostic selection (selectBranch/deselectBranch) and
  mode-specific behavior (control builders)

## Critical Fixes

None required.

## Minor Observations (non-blocking)

1. **Jin overlay shows `branch.length.toFixed(1)` (line 179).** This is a physical
   property (how long the branch is), not a hidden stat. The architect spec includes it
   explicitly. Not a caretaker opacity violation — the user can see the branch length
   visually. Noting for completeness.

2. **Twine overlay shows `branch.twineDegradesDay` (line 165).** This is gameplay
   information (when does the twine wear off), not a hidden stat. Consistent with the
   architect spec. Acceptable.

3. **No landscape button in JSX.** Per ARCH spec OQ-3: "Landscape requires 3D position
   picking (not branch picking) — defer to Phase 2." The `SculptMode` type includes
   `'landscape'` for forward compatibility, and `onPointerDown` returns early for it.
   Correct design.
