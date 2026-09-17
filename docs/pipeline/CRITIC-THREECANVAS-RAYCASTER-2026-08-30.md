# CRITIC-THREECANVAS-RAYCASTER-2026-08-30

**Pipeline stage:** Critic (Carmack-Linus Review)
**Date:** 2026-08-30
**Spec under review:** ARCH-THREECANVAS-RAYCASTER-2026-08-30.md (1081 lines)
**Skills governing:** carmack-linus-review, adversarial-auditor
**Status:** CAVEATS

---

## VERDICT: CAVEATS

The spec is fundamentally sound. Option A (userData.branchId) is the correct and
obvious approach -- zero tree_mesh.ts changes, O(1) branchId lookup, no parallel
data structures. The critical claim that tree_mesh.ts already annotates every mesh
with userData.branchId is TRUE (verified: lines 229, 243, 257). The raycaster
pattern, pointer handler, mode toggle, and cleanup are all correct in structure.

However, the spec has one BLOCKER (caretaker opacity self-contradiction), one
structural confusion that will trip the implementer (two conflicting twine-apply
code versions), and several advisories. All are fixable without changing the
architecture.

---

## CRITICAL VERIFICATION: userData.branchId

**CLAIM:** tree_mesh.ts already sets `mesh.userData.branchId` on every mesh.

**VERDICT: TRUE.**

Evidence:
- `tree_mesh.ts:229` -- `mesh.userData.branchId = b.id;` (branch tubes)
- `tree_mesh.ts:243` -- `leaf.userData.branchId = b.id;` (leaf spheres)
- `tree_mesh.ts:257` -- `scar.userData.branchId = childId;` (prune scars)

Also verified:
- `tree_mesh.ts:230` -- `mesh.userData.kind = 'branch';`
- `tree_mesh.ts:244` -- `leaf.userData.kind = 'leaf';`
- `tree_mesh.ts:258` -- `scar.userData.kind = 'scar';`

All meshes are added directly to `group` (treeRoot) via `group.add()` at lines
231, 245, 259. No nesting. `intersectObjects(treeRoot.children, false)` is correct.

Option A is validated. The spec's entire approach stands.

---

## FINDINGS

### F1 (BLOCKER) -- Caretaker opacity self-contradiction: angle values shown

**Severity:** BLOCKER
**Evidence:** Spec lines 377, 410-412

The spec's caretaker opacity compliance note (lines 410-412) explicitly states:

> "It does NOT show angle values, stat impacts, technique classification, or matchPct."

But the wire mode overlay code (line 377) shows the branch angle:

```typescript
const wiredLabel = branch.wired
  ? `wired -- angle ${branch.angle.toFixed(1)}`
  : `unwired -- angle ${branch.angle.toFixed(1)}`;
```

This is a direct contradiction within the spec. The production view must not
expose precise angle values per the caretaker opacity doctrine. The user can
SEE the branch visually; they don't need the number.

**Recommended fix:** Remove angle values from the wire label. Show only:

```typescript
const wiredLabel = branch.wired ? 'wired' : 'unwired';
label.textContent = `Branch #${branchId} -- ${wiredLabel}`;
```

The wire slider delta (`0 deg` -> `+15 deg`) is acceptable -- that's the
caretaker's chosen action amount, not a revealed stat.

---

### F2 (BLOCKER) -- Spec contains two conflicting twine-apply code versions

**Severity:** BLOCKER (implementer confusion, not architectural)
**Evidence:** Spec lines 451-472 (original), lines 655-702 (corrected)

The spec presents the twine-apply handler twice:

1. **Lines 451-472 (original):** Calls `bridge.applyTwine()` BEFORE
   `localCareLog.push()`. The spec itself identifies this as a bug at line 658:
   "This is a bug in the design. Let me correct it."

2. **Lines 694-702 (corrected):** Calls bridge first, then push, then
   `cacheTree()` explicitly.

The implementer sees TWO code blocks for the same operation with no clear
visual marker that the first is SUPERSEDED. The inline self-correction reads
like a design journal, not an implementation spec.

**Recommended fix:** Remove the original twine-apply code (lines 451-472)
entirely. Replace with the corrected version. The spec should present ONE
authoritative code block per handler. Apply the same corrected ordering to
weight-apply (lines 513-529), which has the same bridge-before-push issue
but was not explicitly corrected.

Correct ordering for ALL bridge-managed apply actions (twine, weight):

```
1. const result = bridge.applyX(branchId, ...);  // engine + afterAction
2. if (!result.ok) return;
3. localCareLog.push({ ... });                    // using result fields
4. persistAsync({ ... });
5. cacheTree();                                   // explicit save
6. selectBranch(bid, ...);                        // refresh overlay
```

---

### F3 (ADVISORY) -- Weight-apply has the same ordering bug as twine

**Severity:** ADVISORY (not called out in spec's self-correction)
**Evidence:** Spec lines 513-529

The weight-apply handler calls `bridge.applyWeight()` at line 518 BEFORE
`localCareLog.push()` at line 521. Same bug as the original twine-apply
code. The spec's corrected pattern (lines 694-702) only addresses twine.

**Recommended fix:** Apply the same corrected ordering to weight-apply.
Add `cacheTree()` after `persistAsync` call.

---

### F4 (ADVISORY) -- Magic number 7 in weight preview

**Severity:** ADVISORY
**Evidence:** Spec line 509

```typescript
preview.textContent = `+${wc * 7} deg down`;
```

The `7` is `WEIGHT_DEGREES_PER_UNIT` from `TwineWeightEngine.ts:26`. Hardcoding
it creates a maintenance risk -- if the engine constant changes, the preview lies.

**Recommended fix:** Import `WEIGHT_DEGREES_PER_UNIT` from `@kijo/engine` and use it:

```typescript
import { WEIGHT_DEGREES_PER_UNIT } from '@kijo/engine';
// ...
preview.textContent = `+${wc * WEIGHT_DEGREES_PER_UNIT} deg down`;
```

---

### F5 (ADVISORY) -- Missing pointerdown listener removal on unmount

**Severity:** ADVISORY
**Evidence:** Spec section 3 (line 292), section 13 (lines 873-882)

The pointerdown handler is added to `careScene.renderer.domElement` but never
removed in the useEffect cleanup. The `initialized.current` guard prevents
double-mounting, so no leak occurs in practice. But proper cleanup is:

```typescript
const onPointerDown = (e: PointerEvent) => { ... };
careScene.renderer.domElement.addEventListener('pointerdown', onPointerDown);
// In cleanup:
careScene.renderer.domElement.removeEventListener('pointerdown', onPointerDown);
```

---

### F6 (ADVISORY) -- prune() return value unchecked

**Severity:** ADVISORY (pre-existing pattern)
**Evidence:** Spec line 316-318

```typescript
localCareLog.push({ day: tree.getAge(), action: { type: 'prune', branchId } });
tree.prune(branchId);
refreshView();
persistAsync({ type: 'prune', branchId });
```

`BonsaiTree.prune()` returns `boolean` (BonsaiTree.ts:292). If the prune fails
(branch already pruned, not found), a no-op entry is logged and persisted.
Same pattern exists in main3d.ts:419-422. Not a new bug, but worth noting.

**Recommended fix (deferred):** Check return value, skip log/persist on false.

---

### F7 (ADVISORY) -- Sculpt rejection reasons silently swallowed

**Severity:** ADVISORY
**Evidence:** Spec lines 457, 519

For twine: `if (!result.ok) return;` -- user clicks Apply, nothing happens.
For weight: same pattern. No feedback for `'already-twined'`, `'pruned'`,
`'weight-cap-exceeded'` rejections.

The main3d.ts debug view shows hint text for rejections. The production view
should at minimum flash a brief message or shake the overlay.

**Recommended fix:** Add a one-line status message in the overlay:

```typescript
if (!result.ok) {
  label.textContent = `Branch #${branchId} -- ${result.reason ?? 'rejected'}`;
  return;
}
```

---

### F8 (ADVISORY) -- Jin confirm() blocks animation loop

**Severity:** ADVISORY (Phase 1 only, jin always throws anyway)
**Evidence:** Spec line 628

```typescript
if (!confirm(`Jin is irreversible. Apply to branch #${selectedBranchId}, segment ${segIdx}?`)) {
  return;
}
```

`window.confirm()` is a synchronous blocking call that freezes the animation
loop and Three.js rendering. On mobile browsers, the native confirm dialog
has inconsistent UX. Acceptable for Phase 1 since jin is a stub that always
throws, but should be replaced with a non-blocking overlay confirmation in
Phase 2.

---

### F9 (ADVISORY) -- Tree swap during async init doesn't reset selection state

**Severity:** ADVISORY
**Evidence:** ThreeCanvas.tsx lines 177-292 (async IIFE), spec section 4

If a branch is selected (`selectedBranchId !== null`) when the async DB load
completes and swaps `tree`, the selection references the old tree's branch IDs.
The selectionIndicator remains visible at the old position.

In practice this is unlikely (async load completes before user interaction),
but the implementer should call `deselectBranch()` before the tree swap at
ThreeCanvas.tsx:203 and :264.

---

### F10 (ADVISORY) -- Weight preview doesn't account for STACK semantics

**Severity:** ADVISORY
**Evidence:** Spec line 509, DECISIONS.md OQ-5 (2026-08-14)

The weight preview shows `+${wc * 7} deg down` as the TOTAL bend for this
application. Under STACK semantics (DECISIONS.md 2026-08-14), calling
applyWeight on an already-weighted branch ACCUMULATES weightAngleDelta.
The preview doesn't show the cumulative effect -- a branch with existing
weight of 14 deg getting +7 deg will show "+7 deg down" not "+21 deg total".

Not incorrect (the preview shows this application's contribution), but
could be confusing. Consider showing "total: X deg" when branch is already
weighted.

---

## CROSS-REFERENCE CHECK

| Check | Result |
|-------|--------|
| userData.branchId in tree_mesh.ts | CONFIRMED (lines 229, 243, 257) |
| CareBridge signatures match spec | CONFIRMED (care_bridge.ts:55-79) |
| HudCallbacks has onTwine/onWeight | CONFIRMED (hud.ts:13-14) |
| WireEngine.wire returns WireResult with ok/oldAngle/newAngle | CONFIRMED (WireEngine.ts:38-44) |
| TwineResult has ok/oldAngle/newAngle | CONFIRMED (shared/index.ts:496-501) |
| WeightResult has ok/torqueContribution | CONFIRMED (shared/index.ts:504-508) |
| JinEngine.applyJin throws CareLogReplayError for valid inputs | CONFIRMED (JinEngine.ts:49) |
| BonsaiTree.prune returns boolean | CONFIRMED (BonsaiTree.ts:292) |
| WireEngine.wire calls tree.markDirty() | CONFIRMED (WireEngine.ts:102) |
| disposeTree calls group.clear() | CONFIRMED (tree_mesh.ts:193) |
| WEIGHT_DEGREES_PER_UNIT = 7 | CONFIRMED (TwineWeightEngine.ts:26) |
| Caretaker opacity (ARCH-SCULPT-UI-2026-08-29.md) | VIOLATED by F1 |
| round4 discipline | CONFIRMED applied in spec (line 459, 575) |
| Triple-log pattern | CONFIRMED (localCareLog + bridge/tree + persistAsync) |
| DECISIONS.md contradictions | NONE found |
| SculptMode includes 'landscape' | CONFIRMED consistent with PATCH F1 resolution |

---

## SECURITY REVIEW

**Can a malicious client exploit the raycaster to corrupt tree state?**

No. The raycaster is read-only (intersectObjects returns hit data, does not
mutate the scene). All state mutations go through engine methods (tree.prune,
tree.wire, bridge.applyTwine, bridge.applyWeight, tree.applyJin) which have
their own validation. The branchId comes from userData set by tree_mesh.ts at
build time -- a client cannot inject arbitrary branchIds through the raycaster
because the meshes are built from BonsaiTree.getBranches(), and the engine
validates branchId bounds internally.

**Determinism impact:** None. The raycaster is a UI-only interaction layer.
All state changes flow through the same engine methods used by main3d.ts.
No non-deterministic state is introduced.

---

## PERFORMANCE REVIEW

**Raycasting every pointerdown against the full tree mesh:**

For a typical bonsai (16-30 branches), treeRoot.children contains ~50-90 meshes
(branches + leaves + scars). Three.js Raycaster performs bounding sphere checks
before detailed intersection tests. 90 bounding sphere checks are sub-microsecond
on any modern device, including mobile. No concern at current scale.

At extreme scale (100+ branches, 300+ meshes), the cost is still negligible --
Three.js handles scenes with thousands of objects. The bottleneck would be the
tree mesh rebuild, not the raycast.

No optimization needed.

---

## SUMMARY

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| F1 | BLOCKER | Caretaker opacity: angle values shown in wire overlay | Must fix before impl |
| F2 | BLOCKER | Two conflicting twine-apply code blocks | Must fix before impl |
| F3 | ADVISORY | Weight-apply has same ordering bug | Fix alongside F2 |
| F4 | ADVISORY | Magic number 7 in weight preview | Import constant |
| F5 | ADVISORY | Missing pointerdown listener cleanup | Best practice |
| F6 | ADVISORY | prune() return value unchecked | Pre-existing pattern |
| F7 | ADVISORY | Sculpt rejections silently swallowed | UX improvement |
| F8 | ADVISORY | confirm() blocks animation loop | Phase 2 fix |
| F9 | ADVISORY | Tree swap doesn't reset selection | Edge case |
| F10 | ADVISORY | Weight preview ignores STACK state | UX improvement |

---

## WHAT MUST CHANGE BEFORE IMPLEMENTATION

1. **F1:** Remove `branch.angle.toFixed(1)` from wire mode overlay labels. Show
   "wired" / "unwired" only. The spec's own caretaker opacity note forbids angle
   values.

2. **F2:** Remove the original twine-apply code block (lines 451-472). Present
   ONE authoritative version using the corrected ordering (bridge -> push ->
   persist -> cacheTree). Apply the same corrected ordering to weight-apply.

After these two fixes, the spec is implementation-ready. All advisories (F3-F10)
can be addressed during implementation or deferred.
