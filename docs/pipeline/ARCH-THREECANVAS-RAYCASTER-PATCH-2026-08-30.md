# ARCH-THREECANVAS-RAYCASTER-PATCH-2026-08-30

**Pipeline stage:** Architect (Corrective Patch)
**Date:** 2026-08-30
**Patches:** ARCH-THREECANVAS-RAYCASTER-2026-08-30.md (1081 lines)
**Triggered by:** CRITIC-THREECANVAS-RAYCASTER-2026-08-30.md (2 blockers, 8 advisories)
**Skills governing:** verified-architect, carmack-linus-review
**Status:** READY FOR IMPLEMENTER

---

## OVERVIEW

This patch resolves all findings from the critic review. Two blockers are fixed
with corrected code blocks. Eight advisories are addressed -- six patched into the
spec, two accepted as-is with documented rationale. The architecture (Option A,
userData.branchId raycaster) is unchanged.

**After this patch, the implementer reads THIS document alongside the original spec.**
Where this patch provides a corrected code block, it SUPERSEDES the corresponding
block in the original spec. All other sections of the original spec remain authoritative.

---

## SUPERSESSION TABLE

| Original spec section | Lines | Status | Superseded by |
|-----------------------|-------|--------|---------------|
| Wire overlay label (selectBranch, wire mode) | 374-378 | **SUPERSEDED** | Patch F1 below |
| Twine-apply listener (twineControlsListeners) | 451-472 | **SUPERSEDED (DELETE)** | Patch F2 below |
| Corrected twine-apply pattern | 694-702 | **SUPERSEDED** | Patch F2 below (complete version) |
| Self-correction narrative | 650-692 | **SUPERSEDED (DELETE)** | Patch F2 below |
| Weight-apply listener (weightControlsListeners) | 513-529 | **SUPERSEDED** | Patch F3 below |
| Weight preview text | 509 | **SUPERSEDED** | Patch F4 below |
| Pointer handler setup (addEventListener) | 292 | **SUPERSEDED** | Patch F5 below |
| Cleanup block (useEffect return) | 873-882 | **SUPERSEDED** | Patch F5 below |
| Prune handler in pointerdown | 313-320 | **SUPERSEDED** | Patch F6 below |
| Twine-apply rejection path | 457 | **SUPERSEDED** | Patch F7 below |
| Weight-apply rejection path | 519 | **SUPERSEDED** | Patch F7 below |
| Imports section | 853-865 | **SUPERSEDED** | Patch F4 below (adds WEIGHT_DEGREES_PER_UNIT) |

---

## F1 RESOLUTION (BLOCKER) -- Caretaker opacity: remove angle values from wire overlay

**Finding:** Spec line 377 shows `branch.angle.toFixed(1)` in the wire overlay label.
Spec line 412 explicitly states "does NOT show angle values." Direct contradiction.

**Resolution:** Remove angle values from the wire overlay label. Show only wired/unwired
status. The branch angle is a raw stat number -- the caretaker-opacity-by-design
philosophy (DESIGN-CARETAKER-OPACITY.md) requires that players observe the tree
visually, not read numbers. The wire slider delta ("0 deg" -> "+15 deg") is acceptable
because that shows the caretaker's chosen action amount, not a revealed stat.

**Corrected code (SUPERSEDES original spec lines 374-378):**

```typescript
  if (sculptMode === 'wire') {
    const wiredLabel = branch.wired ? 'wired' : 'unwired';
    label.textContent = `Branch #${branchId} -- ${wiredLabel}`;
    inner.innerHTML = buildWireControls(branch);
    wireControlsListeners(branchId);
  }
```

**Cross-reference:** Consistent with DESIGN-CARETAKER-OPACITY.md. The twine overlay
shows "twined"/"free" (no angle). The weight overlay shows "weighted (N bags)"/"no weight"
(no angle). Wire now follows the same pattern.

---

## F2 RESOLUTION (BLOCKER) -- Single authoritative twine-apply handler

**Finding:** The original spec contains TWO conflicting twine-apply code blocks:
lines 451-472 (bridge before log -- WRONG) and lines 694-702 (corrected ordering).
The self-correction narrative (lines 650-692) reads like a design journal, not an
implementation spec. The implementer would see two code blocks for the same operation
with no clear visual marker that the first is superseded.

**Resolution:** Delete the original twine-apply block (lines 451-472) and the
self-correction narrative (lines 650-692). Present ONE authoritative handler below.

**Ordering rationale (verified against ThreeCanvas.tsx):**

The triple-log pattern for bridge-managed actions (twine, weight) has a chicken-and-egg:
the bridge call returns a result needed for the log entry, but `bridge.afterAction()`
calls `refreshView()` which calls `cacheTree()` (ThreeCanvas.tsx:90) which writes
`localCareLog` to sessionStorage. If we push to `localCareLog` after the bridge call,
`cacheTree()` runs once without the new entry.

This is acceptable. The window between bridge call and push is a single synchronous
block (no async gap). The only risk is a page crash between the two lines, which would
lose the sessionStorage entry but the engine state (via bridge) and server persist are
still correct. The explicit `cacheTree()` call after `persistAsync` ensures the entry
is saved to sessionStorage before the next user interaction.

**Corrected twine-apply handler (SUPERSEDES original spec lines 451-472 AND 694-702):**

```typescript
document.getElementById('sculpt-twine-apply')?.addEventListener('click', () => {
  if (selectedBranchId === null) return;
  const angleDelta = parseFloat(
    (document.getElementById('sculpt-twine-angle') as HTMLInputElement)?.value ?? '0');
  if (!Number.isFinite(angleDelta) || angleDelta === 0) return;

  // 1. Bridge call first -- gets result, triggers afterAction -> refreshView -> cacheTree
  //    (cacheTree runs without the new entry -- acceptable, single sync block)
  const result = bridge.applyTwine(selectedBranchId, angleDelta);
  if (!result.ok) {
    // F7: Show rejection reason in overlay instead of silent fail
    const label = document.getElementById('sculpt-branch-label');
    if (label) label.textContent = `Branch #${selectedBranchId} -- ${result.reason ?? 'rejected'}`;
    return;
  }

  // 2. Push to localCareLog (using result fields)
  const appliedDelta = round4(result.newAngle! - result.oldAngle!);
  const b = bridge.getBranch(selectedBranchId);
  const degradeDays = b ? b.twineDegradesDay - tree.getAge() : 0;

  localCareLog.push({
    day: tree.getAge(),
    action: { type: 'twine', branchId: selectedBranchId, angleDelta: appliedDelta,
              oldAngle: result.oldAngle!, newAngle: result.newAngle!, degradeDays },
  });

  // 3. Persist to server (fire-and-forget)
  persistAsync({ type: 'twine', branchId: selectedBranchId, angleDelta: appliedDelta,
                 oldAngle: result.oldAngle!, newAngle: result.newAngle!, degradeDays });

  // 4. Explicit cacheTree to save the new localCareLog entry
  cacheTree();

  // 5. Re-select to refresh overlay with updated branch state
  selectBranch(selectedBranchId, selectionIndicator.position.clone());
});
```

**Corrected twine-remove handler (unchanged from original, included for completeness):**

```typescript
document.getElementById('sculpt-twine-remove')?.addEventListener('click', () => {
  if (selectedBranchId === null) return;
  const bid = selectedBranchId;
  // Remove uses bridge (no result needed) -- log first, then bridge, then persist.
  // Matches onWater pattern at ThreeCanvas.tsx:119-122.
  localCareLog.push({ day: tree.getAge(), action: { type: 'twine-remove', branchId: bid } });
  bridge.removeTwine(bid);
  persistAsync({ type: 'twine-remove', branchId: bid });
  selectBranch(bid, selectionIndicator.position.clone());
});
```

---

## F3 RESOLUTION (ADVISORY) -- Weight-apply corrected to match twine-apply ordering

**Finding:** Weight-apply handler (lines 513-529) has the same bridge-before-push
ordering issue as the original twine-apply. The spec's self-correction only addressed
twine, not weight.

**Resolution:** Apply identical corrected ordering to weight-apply. Add `cacheTree()`
after `persistAsync`. Add rejection feedback (F7).

**Corrected weight-apply handler (SUPERSEDES original spec lines 513-529):**

```typescript
document.getElementById('sculpt-weight-apply')?.addEventListener('click', () => {
  if (selectedBranchId === null) return;
  const wc = parseInt(
    (document.getElementById('sculpt-weight-count') as HTMLSelectElement)?.value ?? '1', 10);
  if (wc < 1 || wc > 4) return;

  // 1. Bridge call first -- gets result
  const result = bridge.applyWeight(selectedBranchId, wc);
  if (!result.ok) {
    // F7: Show rejection reason
    const label = document.getElementById('sculpt-branch-label');
    if (label) label.textContent = `Branch #${selectedBranchId} -- ${result.reason ?? 'rejected'}`;
    return;
  }

  // 2. Push to localCareLog
  localCareLog.push({
    day: tree.getAge(),
    action: { type: 'weight', branchId: selectedBranchId, weightCount: wc,
              torqueContribution: result.torqueContribution! },
  });

  // 3. Persist
  persistAsync({ type: 'weight', branchId: selectedBranchId, weightCount: wc,
                 torqueContribution: result.torqueContribution! });

  // 4. Explicit cacheTree
  cacheTree();

  // 5. Re-select
  selectBranch(selectedBranchId, selectionIndicator.position.clone());
});
```

---

## F4 RESOLUTION (ADVISORY) -- Import WEIGHT_DEGREES_PER_UNIT, remove magic number

**Finding:** Spec line 509 hardcodes `wc * 7` for the weight preview. The `7` is
`WEIGHT_DEGREES_PER_UNIT` from `TwineWeightEngine.ts:26` (exported via
`@kijo/engine` -- verified: `packages/engine/src/index.ts:18`). Hardcoding creates
a maintenance risk.

**Resolution:** Import the constant. Add to the imports section.

**Corrected import block (SUPERSEDES original spec section 12):**

```typescript
import { round4 } from '@kijo/shared';
import type { Branch } from '@kijo/shared';
import { WEIGHT_DEGREES_PER_UNIT } from '@kijo/engine';
import * as THREE from 'three';
```

**Corrected weight preview (SUPERSEDES original spec line 509):**

```typescript
sel.addEventListener('change', () => {
  const wc = parseInt(sel.value, 10);
  preview.textContent = `+${wc * WEIGHT_DEGREES_PER_UNIT} deg down`;
});
```

**Also correct the initial preview value in `buildWeightControls`:**

The `<span>` at spec line 494 hardcodes `+7 deg down`. Replace with a computed default:

```typescript
function buildWeightControls(branch: Branch): string {
  const defaultPreview = `+${1 * WEIGHT_DEGREES_PER_UNIT} deg down`;
  return `
    <div style="display:flex;align-items:center;gap:8px;justify-content:center">
      <label style="font-size:12px">Bags</label>
      <select id="sculpt-weight-count" style="width:60px">
        <option value="1">1</option><option value="2">2</option>
        <option value="3">3</option><option value="4">4</option>
      </select>
      <span id="sculpt-weight-preview" style="font-size:11px;opacity:.7">${defaultPreview}</span>
    </div>
    <div style="display:flex;gap:8px;justify-content:center;margin-top:8px">
      <button id="sculpt-weight-apply">Apply</button>
      ${branch.weighted ? '<button id="sculpt-weight-remove">Remove</button>' : ''}
    </div>
  `;
}
```

---

## F5 RESOLUTION (ADVISORY) -- Proper pointerdown listener cleanup on unmount

**Finding:** The pointerdown handler is added to `renderer.domElement` but never
removed in the useEffect cleanup. While `initialized.current` prevents double-mounting
so no leak occurs in practice, proper cleanup is a best practice.

**Resolution:** Name the handler function and remove it on cleanup.

**Corrected handler setup (SUPERSEDES original spec section 3, line 292):**

```typescript
// --- Pointer handler for branch picking (RAYCASTER-ADD 2026-08-30) ---
const onPointerDown = (e: PointerEvent) => {
  if (sculptMode === 'none' || sculptMode === 'landscape') return;
  // ... (rest of handler body unchanged from original spec section 3)
};
careScene.renderer.domElement.addEventListener('pointerdown', onPointerDown);
```

**Corrected cleanup (SUPERSEDES original spec section 13, lines 873-882):**

```typescript
return () => {
  mounted = false;
  cancelAnimationFrame(animId);
  // Remove pointer handler (RAYCASTER-ADD 2026-08-30)
  careScene.renderer.domElement.removeEventListener('pointerdown', onPointerDown);
  // Dispose selection indicator geometry + material
  selectionIndicator.geometry.dispose();
  (selectionIndicator.material as THREE.Material).dispose();
  careScene.renderer.dispose();
};
```

---

## F6 RESOLUTION (ADVISORY) -- Check prune() return value

**Finding:** The prune handler (spec lines 313-320) logs and persists unconditionally
even when `tree.prune()` returns `false` (branch already pruned or not found). Same
pattern exists in main3d.ts -- pre-existing bug, not introduced by this spec.

**Resolution:** Patch the spec to check the return value. This is a minor correctness
improvement with no architectural impact.

**Corrected prune handler (SUPERSEDES original spec lines 313-320):**

```typescript
// Prune mode -- immediate action, no selection
if (sculptMode === 'prune') {
  if (branchId === 0) continue; // trunk protected
  const pruned = tree.prune(branchId);
  if (!pruned) continue; // already pruned or not found -- skip
  localCareLog.push({ day: tree.getAge(), action: { type: 'prune', branchId } });
  refreshView();
  persistAsync({ type: 'prune', branchId });
  return;
}
```

**Note:** The ordering here is `tree.prune()` -> `localCareLog.push()` -> `refreshView()`.
This is correct because prune does NOT go through CareBridge (no afterAction). The
`refreshView()` call triggers `cacheTree()` which will include the just-pushed log entry.
This matches the wire/jin pattern (direct engine call, not bridge-managed).

---

## F7 RESOLUTION (ADVISORY) -- Show rejection reason in overlay

**Finding:** When `bridge.applyTwine()` or `bridge.applyWeight()` returns `ok: false`,
the handler silently returns. The user clicks Apply, nothing happens. No feedback for
`'already-twined'`, `'pruned'`, `'weight-cap-exceeded'` rejections.

**Resolution:** Show the rejection reason in the branch label. Already incorporated
into the corrected twine-apply (F2) and weight-apply (F3) handlers above. The pattern:

```typescript
if (!result.ok) {
  const label = document.getElementById('sculpt-branch-label');
  if (label) label.textContent = `Branch #${selectedBranchId} -- ${result.reason ?? 'rejected'}`;
  return;
}
```

This is minimal, non-intrusive, and reuses the existing label element. The message
clears on the next `selectBranch()` call (re-selection or mode change). No new DOM
elements, no animation, no timer cleanup.

---

## F8 RESOLUTION (ADVISORY) -- confirm() accepted for Phase 1, Phase 2 note added

**Finding:** `window.confirm()` blocks the animation loop and has inconsistent mobile UX.

**Resolution:** Accept for Phase 1. Jin always throws in Phase 1 anyway (the stub
warning text is visible in the overlay). The confirm dialog serves as an explicit
user acknowledgment that jin is irreversible -- this is important for Phase 2 when
jin actually works.

**No code change.** Add this implementer note to the jin section:

```
// PHASE 2 TODO: Replace window.confirm() with a non-blocking overlay confirmation.
// confirm() blocks the animation loop and has inconsistent mobile UX.
// Acceptable in Phase 1 because jin is a stub that always throws.
```

**Rationale for accepting:** Replacing confirm() with a custom modal requires:
state management for the confirmation flow, DOM creation/cleanup, keyboard trap,
focus management. This is significant UI work for a feature that doesn't function
yet. The blocking nature of confirm() is actually a feature here -- it prevents
accidental double-clicks on an irreversible action.

---

## F9 RESOLUTION (ADVISORY) -- Deselect on tree swap

**Finding:** If a branch is selected when the async DB load completes and swaps `tree`,
the selection references the old tree's branch IDs. The selectionIndicator remains
visible at a stale position.

**Resolution:** Add `deselectBranch()` calls before tree swaps. The original spec
does not cover the async DB load path in detail (it's existing code). The implementer
must add `deselectBranch()` at two points:

```
IMPLEMENTER INSTRUCTION:
  Before every `tree = ...` reassignment in the async IIFE:
    1. ThreeCanvas.tsx ~line 203 (cache restore path): add deselectBranch() before tree swap
    2. ThreeCanvas.tsx ~line 264 (DB load path): add deselectBranch() before tree swap
```

These are one-line additions. No architectural change.

---

## F10 RESOLUTION (ADVISORY) -- Weight preview shows cumulative total when already weighted

**Finding:** Under STACK semantics (DECISIONS.md 2026-08-14), calling applyWeight on
an already-weighted branch accumulates weightAngleDelta. The preview shows only this
application's contribution, not the cumulative effect. A branch with existing 14 deg
weight getting +7 deg shows "+7 deg down" not "+21 deg total".

**Resolution:** Show both the delta and the cumulative total when the branch is
already weighted. The `buildWeightControls` function receives the full `Branch` object,
which has `weightAngleDelta` (the current accumulated weight bend).

**Corrected weight preview listener (SUPERSEDES original spec line 509):**

```typescript
sel.addEventListener('change', () => {
  const wc = parseInt(sel.value, 10);
  const newDelta = wc * WEIGHT_DEGREES_PER_UNIT;
  if (branch.weighted && branch.weightAngleDelta > 0) {
    const total = branch.weightAngleDelta + newDelta;
    preview.textContent = `+${newDelta} deg (total: ${total} deg)`;
  } else {
    preview.textContent = `+${newDelta} deg down`;
  }
});
```

**Note:** `branch` is captured in the closure from `weightControlsListeners`. The
`branch` object is fetched fresh via `bridge.getBranch()` in `selectBranch()` each
time the overlay is shown, so it reflects current state. The `TWINE_MAX_ANGLE_DELTA`
cap (28 deg) is enforced by the engine, not the UI -- the preview shows what the user
is asking for; the engine caps the actual application.

---

## CORRECTED LOG ORDERING SUMMARY

For implementer reference, the authoritative log ordering for all sculpt actions:

### Bridge-managed actions (twine-apply, weight-apply):

```
1. result = bridge.applyX(branchId, ...)   // engine + afterAction -> refreshView -> cacheTree
2. if (!result.ok) { show reason; return }  // F7 rejection feedback
3. localCareLog.push({ ... })              // using result fields
4. persistAsync({ ... })                   // server persist (fire-and-forget)
5. cacheTree()                             // explicit save (entry was missing from step 1's cacheTree)
6. selectBranch(bid, ...)                  // refresh overlay
```

### Bridge-managed remove actions (twine-remove, weight-remove):

```
1. localCareLog.push({ ... })              // no result needed
2. bridge.removeX(branchId)                // engine + afterAction -> refreshView -> cacheTree
3. persistAsync({ ... })                   // server persist
4. selectBranch(bid, ...)                  // refresh overlay
```

Rationale: remove actions don't return a result object, so there's no chicken-and-egg.
Push first, then bridge. This matches the `onWater` pattern at ThreeCanvas.tsx:119-122.

### Direct engine actions (prune, wire-apply/remove, jin):

```
1. engine call (tree.prune / tree.wire / tree.applyJin)  // check return value
2. if (!ok) skip
3. localCareLog.push({ ... })
4. refreshView()                           // triggers cacheTree with the new entry
5. persistAsync({ ... })
```

Rationale: no bridge involvement, no afterAction. `refreshView()` is called explicitly
and includes `cacheTree()` (ThreeCanvas.tsx:90), so the log entry is saved.

---

## CROSS-REFERENCE CHECK

```
checked against: ARCH-THREECANVAS-RAYCASTER-2026-08-30.md,
                 CRITIC-THREECANVAS-RAYCASTER-2026-08-30.md,
                 DESIGN-CARETAKER-OPACITY.md, DECISIONS.md, STATE.md
consistent: YES
  - F1: angle removal aligns with DESIGN-CARETAKER-OPACITY.md                  V
  - F2/F3: corrected ordering matches onWater pattern (ThreeCanvas.tsx:119-122) V
  - F4: WEIGHT_DEGREES_PER_UNIT exported from @kijo/engine (index.ts:18)       V
  - F5: cleanup pattern matches React useEffect best practice                  V
  - F6: tree.prune() returns boolean (BonsaiTree.ts:292)                       V
  - F7: TwineResult/WeightResult have .reason field (shared/index.ts)          V
  - F9: tree swaps at ThreeCanvas.tsx ~203, ~264                               V
  - F10: Branch.weightAngleDelta exists (DECISIONS.md 2026-08-14, OQ-1)        V
  - round4 discipline maintained in all appliedDelta computations              V
  - Caretaker opacity: no stat numbers exposed anywhere in corrected code      V
terminology aligned: YES
data shapes aligned: YES
boundary violations: NONE
```

---

## ASSUMPTIONS

```
A1. cacheTree() is safe to call multiple times per synchronous block.
    VERIFIED: cacheTree() at ThreeCanvas.tsx:69 calls saveTreeCache() which
    writes to sessionStorage -- idempotent, last-writer-wins. No race condition
    within a single sync block.

A2. WEIGHT_DEGREES_PER_UNIT import from @kijo/engine does not introduce a
    circular dependency in apps/web.
    VERIFIED: apps/web already imports from @kijo/engine (CareBridge imports
    TwineWeightEngine). No new dependency edge.

A3. Branch.weightAngleDelta is always a number >= 0 when branch.weighted is true.
    VERIFIED: TwineWeightEngine.ts:280 sets weightAngleDelta via round4() and
    only increases it. removeWeight resets to 0.
```

---

## OPEN QUESTIONS (inherited, unchanged)

OQ-1, OQ-2, OQ-3 from the original spec remain unchanged. No new open questions.

---

## CARMACK-LINUS SELF-REVIEW OF THIS PATCH

### Carmack's Notes

The corrected log ordering has a single-sync-block gap where cacheTree runs without
the new entry. This is the minimal cost of the chicken-and-egg problem. The explicit
`cacheTree()` call after `persistAsync` closes the gap before any user interaction
can occur. The alternative (restructuring CareBridge to not call afterAction) would
be a much larger change for zero practical benefit -- a page crash in a 3-line
synchronous window is not a realistic failure mode to engineer against.

### Linus's Notes

The rejection feedback (F7) reuses the existing label element instead of creating a
new status div. Minimal, correct, no new DOM nodes. The weight preview cumulative
display (F10) captures `branch` in a closure -- this is safe because `selectBranch`
fetches a fresh branch on every invocation and the closure is recreated each time
`weightControlsListeners` is called (which happens on every `selectBranch`).

### What This Patch Gets Right

- Every finding has a concrete resolution, not just "acknowledged"
- Corrected code blocks are copy-paste ready for the implementer
- The supersession table makes it unambiguous what replaces what
- No architecture changes -- all fixes are surgical to the affected code blocks
- F8 (confirm) accepted with documented rationale instead of over-engineering

---

## VERIFICATION LOG

```
VERIFIED:
  V refreshView() calls cacheTree() -- ThreeCanvas.tsx:90
  V onWater pattern: log -> bridge -> persist -- ThreeCanvas.tsx:119-122
  V WEIGHT_DEGREES_PER_UNIT = 7, exported from @kijo/engine -- index.ts:18
  V tree.prune() returns boolean -- BonsaiTree.ts:292 (per critic)
  V Branch.weightAngleDelta field exists -- DECISIONS.md 2026-08-14 OQ-1
  V TwineResult has .reason field -- shared/index.ts (per critic cross-ref)
  V WeightResult has .reason field -- shared/index.ts (per critic cross-ref)
  V Tree swaps exist at ThreeCanvas.tsx ~203 (cache) and ~264 (DB load)
  V deselectBranch() is a proposed addition (spec section 4), not yet in file
```
