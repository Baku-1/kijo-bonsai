# ARCH-SCULPT-UI-PATCH-2026-08-29

**Pipeline stage:** Corrective Architect Patch  
**Date:** 2026-08-29  
**Responds to:** CRITIC-SCULPT-UI-2026-08-29.md -- verdict CAVEATS  
**Original spec:** ARCH-SCULPT-UI-2026-08-29.md  
**Skills governing:** verified-architect, carmack-linus-review  
**Status:** CORRECTIVE PATCH -- resolves all five findings before implementer proceeds

---

## SCOPE

This document patches only the findings raised by the critic. Every section of the
original ARCH doc that is NOT mentioned here is unchanged and remains authoritative.
The implementer must read ARCH-SCULPT-UI-2026-08-29.md first, then apply the overrides
in this patch document. Where a section title matches, this patch wins.

---

## CODEBASE RECONNAISSANCE (patch-specific reads)

```
FILES READ:
  packages/shared/src/index.ts          -- CareAction union (lines 218-253), Branch interface (lines 1-188)
  apps/web/src/main3d.ts                -- pruneMode/wireMode all references (lines 282-661)
  apps/web/src/bridge/care_bridge.ts    -- CareBridge class (59 lines, full file)
  docs/ARCHITECT-CAREACTION-TECHNIQUE-2026-07-30.md -- origin CareAction spec (lines 0-176)
  docs/pipeline/ARCH-TWINEWEIGHT-ENGINE-2026-08-14.md -- TWE Phase 2 spec (lines 0-140)
  docs/pipeline/ARCH-TWINEWEIGHT-PATCH-2026-08-14.md -- corrective patch (lines 0-80)

SYMBOLS VERIFIED (patch-relevant):
  care_bridge.ts:
    CareBridge.water() -- line 31: calls this.afterAction() internally AFTER this.tree.water()
    CareBridge.nextDay() -- line 36: calls this.afterAction() internally AFTER GrowthEngine.growTick()
    CareBridge.afterAction -- line 16: private field, type () => void
    CareBridge.tree -- line 15: private field, type BonsaiTree

  main3d.ts pruneMode references (18 occurrences):
    line 282: let pruneMode = false;
    line 359: if (!pruneMode && !wireMode) return;
    line 381: if (pruneMode) {
    line 527: pruneMode = false;
    line 528: document.getElementById('btn-prune')!.classList.remove('active');
    line 629: if (pruneMode) {
    line 630: pruneMode = false;
    line 647: pruneMode = !pruneMode;
    line 648: pruneBtn.classList.toggle('active', pruneMode);
    line 650: if (pruneMode && wireMode) {
    line 657: controls.enableRotate = !(pruneMode || wireMode);
    line 658: hintEl.textContent = pruneMode

  main3d.ts wireMode references (16 occurrences):
    line 284: let wireMode = false;
    line 359: if (!pruneMode && !wireMode) return;
    line 391: if (wireMode) {
    line 408: if (wireMode && !hitBranch) deselectWireBranch();
    line 529: wireMode = false;
    line 624: wireMode = !wireMode;
    line 625: wireBtn.classList.toggle('active', wireMode);
    line 627: if (wireMode) {
    line 650: if (pruneMode && wireMode) {
    line 652: wireMode = false;
    line 657: controls.enableRotate = !(pruneMode || wireMode);

GAPS FOUND:
  SculptMode type does NOT exist in shared/index.ts -- it is a LOCAL type proposed
  by the original spec for main3d.ts only. Not a shared export.
```

---

## FINDING RESOLUTIONS

### F1 (BLOCKER) -- SculptMode missing 'landscape'

**Critic finding:** The spec defines `type SculptMode = 'none' | 'prune' | 'wire' | 'twine' | 'weight' | 'jin'` but calls `setSculptMode('landscape')` and checks `sculptMode === 'landscape'`. Three tsc errors. The `hints` Record has no `'landscape'` key.

**Root cause:** The spec heading says "Landscape is NOT a sculpt mode" (correct conceptually -- it is not branch-targeted) but then routes it through the same `setSculptMode` dispatch for mutual exclusion and button CSS. The type definition was not updated to match the routing.

**Resolution:** Add `'landscape'` to the SculptMode union. Landscape participates in the unified mode system for mutual exclusion (only one mode active at a time, only one button highlighted) even though it is not branch-targeted. This is simpler and safer than maintaining a separate landscape-only toggle that must manually deactivate all other modes.

**Corrected type definition (replaces original spec section "Architecture Decision: Unified Sculpt Mode"):**

```typescript
type SculptMode = 'none' | 'prune' | 'wire' | 'twine' | 'weight' | 'jin' | 'landscape';
let sculptMode: SculptMode = 'none';
```

**Corrected hints map (replaces the `hints` Record in `setSculptMode`):**

```typescript
const hints: Record<SculptMode, string> = {
  none: 'Drag to orbit . scroll to zoom . the blue ghost is roughly where this seed wants to grow',
  prune: 'Prune mode: click a branch voxel to cut it. Trunk is protected.',
  wire: 'Wire mode: click a branch to select it. Set bend angle and click Apply.',
  twine: 'Twine mode: click a branch to select it. +/-28 deg max. Free tier -- temporary binding.',
  weight: 'Weight mode: click a branch to select it. Gravity-only (downward). 1-4 bags.',
  jin: 'Jin mode: click a branch to select it. Choose segment index. IRREVERSIBLE.',
  landscape: 'Landscape mode: choose an element type and position, then click Place.',
};
```

**Corrected landscape button handler (replaces the landscape toggle in section 10):**

The original spec had a redundant `landscapeControls.style.display = 'none'` in the landscape-off path that is already handled by `setSculptMode('none')` (which calls `deselectSculptBranch` -> hides all sub-controls, and explicitly hides `landscapeControls`). Simplify to match the other toggles:

```typescript
landscapeBtn.addEventListener('click', () => {
  setSculptMode(sculptMode === 'landscape' ? 'none' : 'landscape');
});
```

**Corrected `setSculptMode` orbit logic:**

The original spec's line `controls.enableRotate = !branchTargeted && mode !== 'prune';` is correct. Landscape does NOT disable orbit (not branch-targeted, not prune). The `branchTargeted` check excludes landscape because `mode === 'landscape'` is not in the branchTargeted set. No change needed here -- the logic is already correct once 'landscape' is in the union.

**Verification (implementer check):** After applying this fix, `npx tsc --noEmit` from `apps/web` must exit 0 with zero type errors on `setSculptMode('landscape')`, `sculptMode === 'landscape'`, and `hints[mode]` where mode is 'landscape'.

---

### F2 (BLOCKER) -- Ambiguous CareBridge pattern

**Critic finding:** The spec shows two conflicting CareBridge patterns: one without `afterAction()` (section "CareBridge extension") and one with `afterAction()` ("Alternative (simpler, recommended)"). The implementer gets two contradictory designs.

**Root cause:** The architect identified two viable patterns but failed to delete the rejected one.

**Resolution:** DELETE the first pattern entirely. The canonical pattern is: **CareBridge sculpt methods call `this.afterAction()` on success, matching the existing `bridge.water()` pattern.**

**Corrected CareBridge extension (replaces BOTH patterns in the original spec):**

```typescript
// In CareBridge class -- add these methods:

applyTwine(branchId: number, angleDelta: number): TwineResult {
  const result = this.tree.applyTwine(branchId, angleDelta);
  if (result.ok) this.afterAction();
  return result;
}

removeTwine(branchId: number): void {
  this.tree.removeTwine(branchId);
  this.afterAction();
}

applyWeight(branchId: number, weightCount: number): WeightResult {
  const result = this.tree.applyWeight(branchId, weightCount);
  if (result.ok) this.afterAction();
  return result;
}

removeWeight(branchId: number): void {
  this.tree.removeWeight(branchId);
  this.afterAction();
}

/** Get current branch state for UI display. */
getBranch(branchId: number): Branch | undefined {
  return this.tree.getBranches()[branchId];
}
```

**Imports to add in care_bridge.ts:**

```typescript
import type { TwineResult, WeightResult, Branch } from '@kijo/shared';
```

**Pattern rationale (Carmack-Linus lens):** CareBridge is a thin dispatch layer. Every existing method (water, nextDay) calls `afterAction()` internally. Sculpt methods must not break this invariant. The caller (ThreeCanvas.tsx) pushes to `localCareLog` BEFORE calling the bridge method, then calls `persistAsync` AFTER. This matches the existing `onWater` pattern in ThreeCanvas.tsx. One pattern, no branching, no ambiguity.

**Verification (implementer check):** After implementation, confirm that `bridge.water()`, `bridge.applyTwine()`, `bridge.applyWeight()`, `bridge.removeTwine()`, and `bridge.removeWeight()` ALL call `this.afterAction()`. No sculpt method should be the odd one out.

---

### F3 (ADVISORY) -- Production stub buttons (ThreeCanvas.tsx)

**Critic finding:** ThreeCanvas.tsx has no raycaster. The spec adds twine/weight buttons and mode toggles that do nothing until branch picking is wired.

**Resolution:** The original spec's OQ-1 recommendation is confirmed as the correct approach. Document explicitly:

**The implementer MUST understand:** The twine/weight buttons in ThreeCanvas.tsx are **mode toggles only** in this task. They toggle a `prodSculptMode` string and highlight the button CSS. They do NOT select branches, show sub-controls, call engine methods, push to care logs, or call persistAsync. All of that requires a raycaster, which does not exist in ThreeCanvas.tsx and is NOT part of this task's scope.

**What the implementer must NOT do:**
- Do NOT add a raycaster to ThreeCanvas.tsx in this task
- Do NOT wire apply/remove handlers for twine or weight in ThreeCanvas.tsx
- Do NOT show the sculpt-overlay div (it exists in the DOM for the FOLLOW-UP task)
- Do NOT attempt to call `bridge.applyTwine()` or `bridge.applyWeight()` from ThreeCanvas.tsx

**Follow-up task gate:** The production sculpt controls become functional when a separate task adds raycaster branch picking to ThreeCanvas.tsx, mirroring the main3d.ts pointer handler pattern (lines 354-409). That task is NOT this task.

**Verification (implementer check):** The buttons exist in the JSX, toggle `prodSculptMode` and button CSS, and do nothing else. `npx tsc --noEmit` passes.

---

### F4 (ADVISORY) -- Missing engine spec citations

**Critic finding:** The original spec's reconnaissance table omits three mandatory engine specs: ARCHITECT-CAREACTION-TECHNIQUE-2026-07-30.md, ARCH-TWINEWEIGHT-ENGINE-2026-08-14.md, and ARCH-TWINEWEIGHT-PATCH-2026-08-14.md.

**Resolution:** Cross-reference section added below. The original spec's design decisions are verified consistent with all three engine specs.

#### Cross-Reference: Engine Spec Consistency

**1. ARCHITECT-CAREACTION-TECHNIQUE-2026-07-30.md (origin CareAction spec)**

This document defined the four new CareAction variants (jin, twine, weight, landscape) and the TechniqueClassifier. The sculpt UI spec's CareAction shapes are verified consistent:

| Field | Origin spec (2026-07-30) | Sculpt UI spec | Match? |
|-------|--------------------------|----------------|--------|
| twine.angleDelta | "angleDelta: number (clamped +/-28)" | `angleDelta: number` with +-28 slider range | YES |
| twine.degradeDays | "degradeDays: number (RNG 10-15)" | Extracted post-apply as `twineDegradesDay - tree.getAge()` | YES -- A5 verified |
| weight.weightCount | "weightCount: number (integer 1-4)" (MAJOR-4 fix) | `parseInt(weightCountSelect.value, 10)`, select options 1-4 | YES |
| weight.torqueContribution | "torqueContribution: number" (MAJOR-4 fix) | `result.torqueContribution!` from WeightResult | YES |
| jin.segmentIndex | "segmentIndex: number (0-based)" | `parseInt(jinSegmentInput.value, 10)` with min=0 | YES |
| jin.jinCost | "jinCost: number (consumable count)" | Fixed `const jinCost = 1` (Phase 1) | YES |
| landscape.elementType | "LandscapeElementType = 'rock'\|'moss'\|'pot'" | Select with 3 options matching exactly | YES |
| landscape.position | "Coordinate = { x, y, z }" | Three number inputs, parseInt, passed as Coordinate | YES |

The origin spec's verification log (line 64) confirms: "Twine does NOT increment wireCount" for Clip-and-Grow classification. The sculpt UI spec does not touch wireCount or technique classification -- consistent.

The origin spec's UNVERIFIED item (line 128) about twine depth restriction was resolved: TwineWeightEngine.applyTwine has no depth gate (verified in source). The sculpt UI correctly allows twine on any branch, including trunk.

**2. ARCH-TWINEWEIGHT-ENGINE-2026-08-14.md (Phase 2 implementation spec)**

This document specified the full physics implementation. Key consistency checks:

| Decision | Engine spec | Sculpt UI spec | Match? |
|----------|-------------|----------------|--------|
| applyTwine returns TwineResult | Line 83: `applyTwine(branchId, angleDelta): TwineResult` | Spec uses `result.ok`, `result.newAngle!`, `result.oldAngle!` | YES |
| applyWeight returns WeightResult | Line 85: `applyWeight(branchId, weightCount): WeightResult` | Spec uses `result.ok`, `result.torqueContribution!` | YES |
| Engine self-logs via _logCare | Line 87: `_logCare(entry): void -- exported helper` | Spec acknowledges triple-log (engine + localCareLog + persistAsync) | YES |
| degradeDays not in TwineResult | TwineResult: `{ ok, reason?, oldAngle?, newAngle? }` only | A5: UI extracts from branch state post-apply | YES |
| TWINE_MAX_ANGLE_DELTA = 28 | Line 54: exported constant | Slider range min=-28 max=28 | YES |
| WEIGHT_DEGREES_PER_UNIT = 7 | Line 56: exported constant | Preview: `+${wc * 7} deg down` | YES |

CareLogReplay routing (engine spec lines 122-128): `twine` passes `a.degradeDays`, `twine-remove` and `weight-remove` route to TwineWeightEngine, `wire-remove` routes to WireEngine.removeWire. The sculpt UI spec's care log entry shapes include `degradeDays` for twine, confirming replay compatibility.

**3. ARCH-TWINEWEIGHT-PATCH-2026-08-14.md (corrective patch)**

This document resolved OQ-1 (weightAppliedDay/weightAngleDelta fields), OQ-3 (time-ratio spring-back), and OQ-5 (STACK semantics). Key consistency checks:

| Decision | Patch spec | Sculpt UI spec | Match? |
|----------|------------|----------------|--------|
| OQ-1: weightAppliedDay field on Branch | Approved by Jeremy, added to shared/index.ts | Sculpt UI reads `branch.weighted`, `branch.weightCount` -- does NOT read weightAppliedDay (correct, UI doesn't need it) | YES |
| OQ-5: STACK semantics for applyWeight | DECISIONS.md 2026-08-14: accumulates weightAngleDelta | OQ-3 in sculpt UI spec: "Allow stacking -- the engine supports it" | YES |
| TWE6 test boundary: direct TwineWeightEngine call | Patch resolution: call TWE directly for boundary tests | Sculpt UI calls through BonsaiTree (live path, not test path) | YES -- not relevant to UI |

**Citation gap closed.** All three engine specs are consistent with the sculpt UI design. No discrepancies found.

---

### F5 (ADVISORY) -- pruneMode/wireMode migration checklist

**Critic finding:** The spec shows replacing the boolean declarations and the pointer handler but doesn't enumerate all references to `pruneMode`/`wireMode` in main3d.ts. The implementer must find and replace all of them.

**Resolution:** Complete migration checklist below. Every reference to `pruneMode` and `wireMode` in main3d.ts is listed with the exact replacement.

#### pruneMode migration (12 occurrences)

| Line | Current code | Replacement |
|------|-------------|-------------|
| 282 | `let pruneMode = false;` | DELETE (replaced by `let sculptMode: SculptMode = 'none';`) |
| 359 | `if (!pruneMode && !wireMode) return;` | `if (sculptMode === 'none' \|\| sculptMode === 'landscape') return;` |
| 381 | `if (pruneMode) {` | `if (sculptMode === 'prune') {` |
| 527 | `pruneMode = false;` | DELETE (replaced by `setSculptMode('none');` in btn-new handler) |
| 528 | `document.getElementById('btn-prune')!.classList.remove('active');` | DELETE (handled by `setSculptMode('none')`) |
| 629 | `if (pruneMode) {` | DELETE (mutual exclusion handled by `setSculptMode`) |
| 630 | `pruneMode = false;` | DELETE (mutual exclusion handled by `setSculptMode`) |
| 631 | `pruneBtn.classList.remove('active');` | DELETE (handled by `setSculptMode`) |
| 647 | `pruneMode = !pruneMode;` | `setSculptMode(sculptMode === 'prune' ? 'none' : 'prune');` |
| 648 | `pruneBtn.classList.toggle('active', pruneMode);` | DELETE (handled by `setSculptMode`) |
| 650 | `if (pruneMode && wireMode) {` | DELETE (mutual exclusion handled by `setSculptMode`) |
| 657-658 | `controls.enableRotate = !(pruneMode \|\| wireMode);` + hint text | DELETE (handled by `setSculptMode`) |

#### wireMode migration (11 occurrences)

| Line | Current code | Replacement |
|------|-------------|-------------|
| 284 | `let wireMode = false;` | DELETE (replaced by sculptMode enum) |
| 359 | `if (!pruneMode && !wireMode) return;` | (already covered in pruneMode migration above) |
| 391 | `if (wireMode) {` | `if (sculptMode === 'wire') {` |
| 408 | `if (wireMode && !hitBranch) deselectWireBranch();` | `if (sculptMode === 'wire' && !hitBranch) deselectSculptBranch();` |
| 529 | `wireMode = false;` | DELETE (replaced by `setSculptMode('none')` in btn-new handler) |
| 530 | `wireBtn.classList.remove('active');` | DELETE (handled by `setSculptMode('none')`) |
| 531 | `deselectWireBranch();` | DELETE (handled by `setSculptMode('none')` -> `deselectSculptBranch()`) |
| 532 | `controls.enableRotate = true;` | DELETE (handled by `setSculptMode('none')`) |
| 624 | `wireMode = !wireMode;` | `setSculptMode(sculptMode === 'wire' ? 'none' : 'wire');` |
| 625 | `wireBtn.classList.toggle('active', wireMode);` | DELETE (handled by `setSculptMode`) |
| 627-642 | entire wireBtn if/else block | DELETE (replaced by `setSculptMode` call above) |
| 650-655 | `if (pruneMode && wireMode)` block | DELETE (mutual exclusion handled by `setSculptMode`) |
| 652 | `wireMode = false;` | DELETE |

#### btn-new handler consolidation (lines 521-535)

Replace lines 526-532 with a single call:

```typescript
// In btn-new handler, replace all mode cleanup lines with:
setSculptMode('none');
```

This replaces: `pruneMode = false`, classList.remove on prune, `wireMode = false`, classList.remove on wire, `deselectWireBranch()`, and `controls.enableRotate = true`.

#### Pointer handler refactor (lines 357-409)

The existing pointerdown handler's mode dispatch (lines 359, 381, 391, 408) is replaced by the spec's section 5 ("Pointer handler update"). Key changes:

- Line 359: `if (!pruneMode && !wireMode)` -> `if (sculptMode === 'none' || sculptMode === 'landscape')`
- Line 381: `if (pruneMode)` -> `if (sculptMode === 'prune')`
- Lines 391-404: `if (wireMode)` block expands to `if (sculptMode === 'wire' || sculptMode === 'twine' || sculptMode === 'weight' || sculptMode === 'jin')`
- Line 408: `if (wireMode && !hitBranch) deselectWireBranch()` -> `if (['wire','twine','weight','jin'].includes(sculptMode) && !hitBranch) deselectSculptBranch()`

#### deselectWireBranch -> deselectSculptBranch rename

The existing `deselectWireBranch()` function (which clears selectedBranchId, hides selectionIndicator, hides wireControls, resets wireAngleInput) is REPLACED by the spec's `deselectSculptBranch()` which additionally hides twineControls, weightControls, jinControls and resets their inputs.

All call sites of `deselectWireBranch()`:
- line 397 (toggle-off on re-click): `deselectWireBranch()` -> `deselectSculptBranch()`
- line 408 (click empty space): `deselectWireBranch()` -> `deselectSculptBranch()`
- line 531 (btn-new): DELETE (handled by `setSculptMode('none')`)
- line 638 (wire off): DELETE (handled by `setSculptMode('none')`)
- line 654 (prune overrides wire): DELETE (handled by `setSculptMode`)

#### selectWireBranch -> selectSculptBranch rename

The existing `selectWireBranch()` function is REPLACED by the spec's `selectSculptBranch()` which dispatches to mode-specific sub-control display.

All call sites:
- line 401: `selectWireBranch(clickedId, tmpVec.clone())` -> `selectSculptBranch(clickedId, tmpVec.clone())`

**Verification (implementer check):** After migration, grep for `pruneMode` and `wireMode` in main3d.ts. Both must return zero results. `npx tsc --noEmit` from `apps/web` must exit 0.

---

## NEW ASSUMPTIONS INTRODUCED BY FIXES

```
PA1. The landscape pointerdown early-return (sculptMode === 'landscape' skips raycaster)
     is correct because landscape uses coordinate text inputs, not branch clicking.
     Mitigation: if a future Phase 2 landscape picker uses raycaster, the early-return
     must be reconsidered. Phase 1 text inputs do not need it.

PA2. deselectSculptBranch() hiding all four sub-controls on every deselect is acceptable
     (no lazy-hide optimization needed). With 4 controls, 4 style.display = 'none'
     assignments per deselect is negligible.
     Mitigation: none needed. This is the correct simple approach.
```

---

## OPEN QUESTIONS (no new OQs introduced)

All three OQs from the original spec remain unchanged and are NOT affected by this patch:

- OQ-1: Production view raycaster deferral (confirmed as stub buttons, see F3 above)
- OQ-2: Landscape coordinate defaults (pot center 128,38,128 -- confirmed)
- OQ-3: Weight STACK re-application (allow stacking -- confirmed per OQ-5 DECISIONS.md)

---

## SUMMARY FOR IMPLEMENTER

Read ARCH-SCULPT-UI-2026-08-29.md first. Then apply these overrides:

1. **F1:** SculptMode type MUST include `'landscape'`. Add the landscape hint string. Landscape toggle handler simplified (no redundant display:none).
2. **F2:** CareBridge sculpt methods MUST call `this.afterAction()` on success. DELETE the "without afterAction" pattern from the spec. Only one pattern exists.
3. **F3:** ThreeCanvas.tsx twine/weight buttons are MODE TOGGLES ONLY. Do NOT wire apply handlers, raycaster, or sub-controls. That is a separate follow-up task.
4. **F4:** Engine spec citations confirmed consistent. No design change -- for traceability only.
5. **F5:** Use the line-by-line migration checklist above. After migration, `pruneMode` and `wireMode` must not appear anywhere in main3d.ts. Grep to confirm.
