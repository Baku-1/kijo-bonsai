# ARCH-SCULPT-UI-2026-08-29

**Pipeline stage:** Architect (Verified Architect skill)  
**Date:** 2026-08-29  
**Author:** Architect pass — sculpt UI controls (twine, weight, jin, landscape) across all three views  
**Status:** READY FOR IMPLEMENTER  

---

## SCOPE

```
DESIGN TASK:  UI controls for four new care actions — twine, weight, jin, landscape —
              across all three tree views (3D voxel viewer, 2D debug, React production).
DELIVERABLE:  Per-view HTML structure, button IDs, callback signatures, CareBridge/CareHud
              extensions, and wiring patterns. Implementer builds from this spec alone.
BUILDS ON:    Wire UI (ARCH-WIRE-UI-2026-08-14.md) — reference pattern for expandable sub-controls.
              TwineWeightEngine (Phase 2 complete, TWE1-TWE9 37/37 assertions).
              JinEngine (Phase 1 stub — throws CareLogReplayError).
              BonsaiTree sculpt API methods (verified in BonsaiTree.ts).
CONSUMED BY:  Disciplined Implementer (IMPL phase next).
```

---

## CODEBASE RECONNAISSANCE

### Files read

| File | Notes |
|---|---|
| `apps/web/index3d.html` | 113 lines. Wire sub-controls at lines 74-85 = REFERENCE PATTERN. |
| `apps/web/index2d.html` | 90 lines. Simple button rows, no sub-controls exist yet. |
| `apps/web/index.html` | 81 lines. React mount point. Bottom HUD has 4 buttons. |
| `apps/web/src/main3d.ts` | 855 lines. Wire mode pattern: wireMode flag, selectWireBranch, deselectWireBranch, selectionIndicator, angle slider, apply/remove, localCareLog+persistAsync pattern. |
| `apps/web/src/main2d.ts` | 366 lines. No wire/sculpt controls. Simple prune click + care buttons. |
| `apps/web/src/components/ThreeCanvas.tsx` | 329 lines. React component. CareBridge + CareHud wired. Only Water/NextDay/Auto/BuySeed. |
| `apps/web/src/ui/hud.ts` | 79 lines. CareHud class with HudCallbacks interface. |
| `apps/web/src/bridge/care_bridge.ts` | 59 lines. CareBridge class. water(), nextDay(), toggleAuto(), setTree(). |
| `packages/engine/src/BonsaiTree.ts` | applyTwine, removeTwine, applyWeight, removeWeight, applyJin, addLandscape verified. |
| `packages/engine/src/TwineWeightEngine.ts` | Phase 2 COMPLETE. applyTwine returns TwineResult. applyWeight returns WeightResult. |
| `packages/engine/src/JinEngine.ts` | Phase 1 STUB. applyJin THROWS CareLogReplayError after validation — never returns JinResult. |
| `packages/shared/src/index.ts` | CareAction union, Branch interface (twined/weighted/etc.), TwineResult, WeightResult, JinResult, LandscapeElementType, Coordinate. |
| `docs/DESIGN-CARETAKER-OPACITY.md` | Production UI shows NO stats/style/technique. 3D viewer shows stats but NOT style name. |
| `docs/DESIGN-TWINE-VS-WIRE.md` | Twine ≠ wire. Free tier. ±28° max. Temporary. Weight = gravity-only, 1-4 bags. |
| `docs/pipeline/ARCH-WIRE-UI-2026-08-14.md` | Wire UI reference pattern: expandable div, branch info, angle slider, apply/remove. |

### Symbols verified

```
VERIFIED:
  ✓ BonsaiTree.applyTwine(branchId, angleDelta, storedDegradeDays?) → TwineResult
      — BonsaiTree.ts:203. Delegates to TwineWeightEngine.applyTwine.
      — TwineResult: { ok: boolean, reason?: TwineRejectReason, oldAngle?: number, newAngle?: number }
      — TwineRejectReason: 'not-found' | 'pruned' | 'already-twined'
      — Engine logs care entry internally via tree._logCare(). Also calls tree.markDirty().

  ✓ BonsaiTree.removeTwine(branchId) → void
      — BonsaiTree.ts:217. No-op if not found/pruned/!twined. Logs + markDirty internally.

  ✓ BonsaiTree.applyWeight(branchId, weightCount) → WeightResult
      — BonsaiTree.ts:226. Validates: isFinite, isInteger, 1-4 range. Throws CareLogReplayError on bad input.
      — WeightResult: { ok: boolean, reason?: WeightRejectReason, torqueContribution?: number }
      — WeightRejectReason: 'not-found' | 'pruned' | 'weight-cap-exceeded'
      — Engine logs care entry internally. Also calls tree.markDirty().

  ✓ BonsaiTree.removeWeight(branchId) → void
      — BonsaiTree.ts:245. No-op if not found/pruned/!weighted. Logs + markDirty internally.

  ✓ BonsaiTree.applyJin(branchId, segmentIndex, jinCost) → JinResult
      — BonsaiTree.ts:254. Validates inputs, then delegates to JinEngine.applyJin.
      — ⚠ JinEngine.applyJin THROWS CareLogReplayError after validation (Phase 1 stub, line 49).
      — NEVER returns JinResult in Phase 1. UI MUST try/catch.

  ✓ BonsaiTree.addLandscape(elementType, position) → void
      — BonsaiTree.ts:275. Validates position bounds [0,255] per axis. Logs + markDirty internally.
      — elementType: LandscapeElementType = 'rock' | 'moss' | 'pot'
      — position: Coordinate = { x: number, y: number, z: number }

  ✓ Branch.twined: boolean — shared/index.ts:83
  ✓ Branch.twineAppliedDay: number — shared/index.ts:88
  ✓ Branch.twineAngle: number — shared/index.ts:110
  ✓ Branch.twineDegradesDay: number — shared/index.ts:159
  ✓ Branch.weighted: boolean — shared/index.ts:123
  ✓ Branch.weightCount: number — shared/index.ts:130
  ✓ Branch.weightAppliedDay: number — shared/index.ts:133

  ✓ TWINE_MAX_ANGLE_DELTA = 28 — TwineWeightEngine.ts:23
  ✓ WEIGHT_DEGREES_PER_UNIT = 7 — TwineWeightEngine.ts:26

  ✓ CareAction 'twine' shape: { type: 'twine', branchId, angleDelta, oldAngle, newAngle, degradeDays }
  ✓ CareAction 'twine-remove' shape: { type: 'twine-remove', branchId }
  ✓ CareAction 'weight' shape: { type: 'weight', branchId, weightCount, torqueContribution }
  ✓ CareAction 'weight-remove' shape: { type: 'weight-remove', branchId }
  ✓ CareAction 'jin' shape: { type: 'jin', branchId, segmentIndex, jinCost }
  ✓ CareAction 'landscape' shape: { type: 'landscape', elementType, position: Coordinate }
```

### Critical discovery: engine self-logging

TwineWeightEngine.applyTwine (line 190), applyWeight (line 311-313), removeTwine (line 237), removeWeight (line 349), and addLandscape (line 285) **all call `tree._logCare(entry)` internally**.

This differs from the wire UI pattern where `localCareLog.push(...)` is the PRIMARY log and the engine also logs internally. The pattern is:
1. Engine method logs to tree's internal care log (via `_logCare`)
2. UI ALSO pushes to `localCareLog` (client-side sessionStorage cache for page navigation)
3. UI calls `persistAsync()` (Supabase server persist)

All three must happen. The implementer must push to `localCareLog` even though the engine self-logs, because `localCareLog` is the sessionStorage cache that survives page navigations.

---

## VERIFICATION LOG

```
VERIFIED:
  ✓ Wire UI reference pattern (index3d.html:74-85) — hidden div, angle slider, apply/remove buttons
  ✓ Twine ≠ wire — separate CareAction types, separate Branch fields, separate controls required
  ✓ Twine max angle = ±28° (TWINE_MAX_ANGLE_DELTA = 28)
  ✓ Weight = gravity-only, integer 1-4 bags (BonsaiTree.ts validates range)
  ✓ Jin Phase 1 stub throws (JinEngine.ts:49) — UI must catch and display gracefully
  ✓ Landscape is NOT branch-targeted — uses (elementType, position) not branchId
  ✓ Caretaker opacity: production UI (ThreeCanvas/CareHud) shows NO stats, NO style, NO technique
  ✓ 3D viewer (main3d.ts) shows stats but NOT style name — sculpt controls can show which branch is twined/weighted
  ✓ Wire mode uses controls.enableRotate = false + selectionIndicator (yellow wireframe sphere)
  ✓ Mutual exclusion: only one sculpt mode active at a time (wire/prune precedent in main3d.ts:628-640)

ASSUMPTIONS:
  A1. Twine/weight/jin all reuse the SAME branch selection mechanism as wire (click-to-select via raycaster).
      Mitigation: wire's selectWireBranch + deselectWireBranch functions can be generalized to "selectSculptBranch".
  A2. Jin confirmation UX uses a browser confirm() dialog in 3D/2D views and a modal in production view.
      Mitigation: confirm() is simple/ugly but functional. Owner can upgrade to custom modal later.
  A3. Landscape position picker uses a text input (x, y, z) in 3D/2D views since voxel-grid coordinate picking
      in 3D space is complex. Production view defers landscape to Phase 2 or uses a simplified preset picker.
      Mitigation: exact position picking via raycaster is a FOLLOW-UP task.
  A4. Jin is DISABLED in production view (Phase 1 stub throws). 3D and 2D views show it with a catch + error message.
      Mitigation: when Phase 2 lands, enable it. The wiring exists, just the engine call is caught.
```

---

## CROSS-REFERENCE CHECK

```
checked against: DESIGN-CARETAKER-OPACITY.md, DESIGN-TWINE-VS-WIRE.md,
                 DESIGN-TECHNIQUE-CLASSIFICATION.md, ARCH-WIRE-UI-2026-08-14.md,
                 STATE.md, DECISIONS.md
consistent: YES
  - Twine/weight are free tier (no cost display needed) ✓
  - Jin is premium (jinCost shown) ✓
  - Landscape is premium (no per-unit cost in Phase 1 — addLandscape just logs + markDirty) ✓
  - Production view shows NO stats ✓
  - Twine ≠ wire: separate buttons, controls, visual treatment ✓
terminology aligned: YES
  - "twine" not "string" or "bind"
  - "weight" not "weight bag" (short form acceptable in UI)
  - "jin" not "jin pliers" (jin is the technique name)
  - "landscape" not "decoration" or "accent"
data shapes aligned: YES
  - All CareAction shapes match shared/index.ts union members exactly
boundary violations: NONE
```

---

## THE DESIGN

### Architecture Decision: Unified Sculpt Mode

Wire mode established a pattern: a boolean mode flag + branch selection via raycaster + expandable sub-controls. Twine, weight, and jin are ALL branch-targeted and follow the same pattern. Rather than four independent mode flags, the design uses a **single sculpt mode enum**:

```typescript
type SculptMode = 'none' | 'prune' | 'wire' | 'twine' | 'weight' | 'jin';
let sculptMode: SculptMode = 'none';
```

This replaces `pruneMode: boolean` and `wireMode: boolean`. The mutual-exclusion logic (only one mode at a time) becomes trivial: setting any mode clears the previous one. The existing `selectedBranchId` and `selectionIndicator` are reused.

**Landscape is NOT a sculpt mode** — it is not branch-targeted and has its own separate UX.

---

### VIEW 1: 3D Voxel Viewer (index3d.html + main3d.ts)

#### HTML additions to index3d.html

Insert after the wire controls `</div>` (after line 85) and before the Advance day row (line 86):

```html
<!-- Twine controls (SCULPT-ADD 2026-08-29) -->
<div class="row" style="margin-top:6px">
  <button id="btn-twine" class="grow">Twine...</button>
</div>
<div id="twine-controls" style="display:none; margin-top:6px; border-top:1px solid var(--edge); padding-top:6px">
  <div id="twine-branch-info" style="font-size:11px; opacity:.7; margin-bottom:4px">&#8212;</div>
  <div class="row">
    <label for="twine-angle" style="font-size:11px; white-space:nowrap">Bend &#916;</label>
    <input id="twine-angle" type="range" min="-28" max="28" value="0" class="grow" style="cursor:pointer" />
    <span id="twine-angle-label" style="font-size:12px; min-width:38px; text-align:right">0&#176;</span>
  </div>
  <div class="row" style="margin-top:4px">
    <button id="btn-twine-apply" class="grow">Apply</button>
    <button id="btn-twine-remove">Remove</button>
  </div>
</div>

<!-- Weight controls (SCULPT-ADD 2026-08-29) -->
<div class="row" style="margin-top:6px">
  <button id="btn-weight" class="grow">Weight...</button>
</div>
<div id="weight-controls" style="display:none; margin-top:6px; border-top:1px solid var(--edge); padding-top:6px">
  <div id="weight-branch-info" style="font-size:11px; opacity:.7; margin-bottom:4px">&#8212;</div>
  <div class="row">
    <label for="weight-count" style="font-size:11px; white-space:nowrap">Bags</label>
    <select id="weight-count" style="width:60px">
      <option value="1">1</option>
      <option value="2">2</option>
      <option value="3">3</option>
      <option value="4">4</option>
    </select>
    <span id="weight-angle-preview" style="font-size:11px; opacity:.7">+7&#176; down</span>
  </div>
  <div class="row" style="margin-top:4px">
    <button id="btn-weight-apply" class="grow">Apply</button>
    <button id="btn-weight-remove">Remove</button>
  </div>
</div>

<!-- Jin controls (SCULPT-ADD 2026-08-29) -->
<div class="row" style="margin-top:6px">
  <button id="btn-jin" class="grow">Jin...</button>
</div>
<div id="jin-controls" style="display:none; margin-top:6px; border-top:1px solid var(--edge); padding-top:6px">
  <div id="jin-branch-info" style="font-size:11px; opacity:.7; margin-bottom:4px">&#8212;</div>
  <div class="row">
    <label for="jin-segment" style="font-size:11px; white-space:nowrap">Segment</label>
    <input id="jin-segment" type="number" min="0" value="0" style="width:60px" />
    <span id="jin-cost-label" style="font-size:11px; color:#e0c060">Cost: 1 jin</span>
  </div>
  <div class="row" style="margin-top:4px">
    <button id="btn-jin-apply" class="grow" style="background:#4a2020; border-color:#c06040">Apply (irreversible)</button>
  </div>
  <div id="jin-stub-warning" style="font-size:10px; color:#e07040; margin-top:2px">Phase 1: jin engine stub — will error until Phase 2</div>
</div>

<!-- Landscape controls (SCULPT-ADD 2026-08-29) — NOT branch-targeted -->
<div class="row" style="margin-top:6px">
  <button id="btn-landscape" class="grow">Landscape...</button>
</div>
<div id="landscape-controls" style="display:none; margin-top:6px; border-top:1px solid var(--edge); padding-top:6px">
  <div class="row">
    <label for="landscape-type" style="font-size:11px">Element</label>
    <select id="landscape-type">
      <option value="rock">Rock</option>
      <option value="moss">Moss</option>
      <option value="pot">Pot</option>
    </select>
  </div>
  <div class="row" style="margin-top:4px">
    <label style="font-size:11px">Position</label>
    <input id="landscape-x" type="number" min="0" max="255" value="128" style="width:50px" placeholder="x" />
    <input id="landscape-y" type="number" min="0" max="255" value="38" style="width:50px" placeholder="y" />
    <input id="landscape-z" type="number" min="0" max="255" value="128" style="width:50px" placeholder="z" />
  </div>
  <div class="row" style="margin-top:4px">
    <button id="btn-landscape-apply" class="grow">Place element</button>
  </div>
</div>
```

#### main3d.ts changes

**1. Replace mode booleans with sculpt mode enum:**

```typescript
// Replace:
//   let pruneMode = false;
//   let wireMode = false;
// With:
type SculptMode = 'none' | 'prune' | 'wire' | 'twine' | 'weight' | 'jin';
let sculptMode: SculptMode = 'none';
```

**2. DOM element references (add after wire refs, ~line 48):**

```typescript
// Twine UI element references (SCULPT-ADD 2026-08-29)
const twineControls     = document.getElementById('twine-controls')! as HTMLDivElement;
const twineBranchInfo   = document.getElementById('twine-branch-info')!;
const twineAngleInput   = document.getElementById('twine-angle')! as HTMLInputElement;
const twineAngleLabel   = document.getElementById('twine-angle-label')!;
const btnTwineApply     = document.getElementById('btn-twine-apply')!;
const btnTwineRemove    = document.getElementById('btn-twine-remove')!;
const twineBtn          = document.getElementById('btn-twine')!;

// Weight UI element references (SCULPT-ADD 2026-08-29)
const weightControls    = document.getElementById('weight-controls')! as HTMLDivElement;
const weightBranchInfo  = document.getElementById('weight-branch-info')!;
const weightCountSelect = document.getElementById('weight-count')! as HTMLSelectElement;
const weightAnglePreview = document.getElementById('weight-angle-preview')!;
const btnWeightApply    = document.getElementById('btn-weight-apply')!;
const btnWeightRemove   = document.getElementById('btn-weight-remove')!;
const weightBtn         = document.getElementById('btn-weight')!;

// Jin UI element references (SCULPT-ADD 2026-08-29)
const jinControls       = document.getElementById('jin-controls')! as HTMLDivElement;
const jinBranchInfo     = document.getElementById('jin-branch-info')!;
const jinSegmentInput   = document.getElementById('jin-segment')! as HTMLInputElement;
const jinCostLabel      = document.getElementById('jin-cost-label')!;
const btnJinApply       = document.getElementById('btn-jin-apply')!;
const jinBtn            = document.getElementById('btn-jin')!;

// Landscape UI element references (SCULPT-ADD 2026-08-29)
const landscapeControls = document.getElementById('landscape-controls')! as HTMLDivElement;
const landscapeTypeSelect = document.getElementById('landscape-type')! as HTMLSelectElement;
const landscapeX        = document.getElementById('landscape-x')! as HTMLInputElement;
const landscapeY        = document.getElementById('landscape-y')! as HTMLInputElement;
const landscapeZ        = document.getElementById('landscape-z')! as HTMLInputElement;
const btnLandscapeApply = document.getElementById('btn-landscape-apply')!;
const landscapeBtn      = document.getElementById('btn-landscape')!;
```

**3. Unified sculpt mode activation (generalized from wire/prune pattern):**

```typescript
/** Deselect the currently selected branch (clears indicator + all sub-control panels). */
function deselectSculptBranch(): void {
  selectedBranchId = null;
  selectionIndicator.visible = false;
  // Hide all branch-targeted sub-controls
  wireControls.style.display = 'none';
  twineControls.style.display = 'none';
  weightControls.style.display = 'none';
  jinControls.style.display = 'none';
  // Reset inputs
  wireAngleInput.value = '0';
  wireAngleLabel.textContent = '0°';
  twineAngleInput.value = '0';
  twineAngleLabel.textContent = '0°';
  weightCountSelect.value = '1';
  jinSegmentInput.value = '0';
}

/**
 * Activate a sculpt mode. Deactivates any previous mode.
 * For branch-targeted modes (wire/twine/weight/jin): disables orbit, shows hint.
 * For landscape: does NOT disable orbit (not branch-targeted).
 */
function setSculptMode(mode: SculptMode): void {
  // Clear previous mode
  deselectSculptBranch();
  pruneBtn.classList.remove('active');
  wireBtn.classList.remove('active');
  twineBtn.classList.remove('active');
  weightBtn.classList.remove('active');
  jinBtn.classList.remove('active');
  landscapeBtn.classList.remove('active');
  landscapeControls.style.display = 'none';

  sculptMode = mode;

  const branchTargeted = mode === 'wire' || mode === 'twine' || mode === 'weight' || mode === 'jin';
  controls.enableRotate = !branchTargeted && mode !== 'prune';

  const hints: Record<SculptMode, string> = {
    none: 'Drag to orbit · scroll to zoom · the blue ghost is roughly where this seed wants to grow',
    prune: 'Prune mode: click a branch voxel to cut it. Trunk is protected.',
    wire: 'Wire mode: click a branch to select it. Set bend angle and click Apply.',
    twine: 'Twine mode: click a branch to select it. ±28° max. Free tier — temporary binding.',
    weight: 'Weight mode: click a branch to select it. Gravity-only (downward). 1-4 bags.',
    jin: 'Jin mode: click a branch to select it. Choose segment index. IRREVERSIBLE.',
  };
  hintEl.textContent = hints[mode];

  // Activate the matching button
  const btnMap: Record<string, HTMLElement> = {
    prune: pruneBtn, wire: wireBtn, twine: twineBtn,
    weight: weightBtn, jin: jinBtn, landscape: landscapeBtn,
  };
  if (btnMap[mode]) btnMap[mode].classList.add('active');
  if (mode === 'landscape') landscapeControls.style.display = '';
}
```

**4. Branch selection handler — generalized from wire pattern:**

When a branch is selected in twine/weight/jin mode, show the appropriate sub-controls:

```typescript
/**
 * Select a branch for the current sculpt mode.
 * Reuses selectionIndicator. Shows mode-specific sub-controls.
 */
function selectSculptBranch(branchId: number, worldPos: THREE.Vector3): void {
  selectedBranchId = branchId;
  selectionIndicator.position.copy(worldPos);
  selectionIndicator.visible = true;

  const branch = tree.getBranches()[branchId];

  if (sculptMode === 'wire') {
    // Existing wire selection logic (unchanged from WIRE-ADD)
    const wiredLabel = branch.wired
      ? `wired · angle ${branch.angle.toFixed(1)}° · applied day ${branch.wireAppliedDay}`
      : `unwired · angle ${branch.angle.toFixed(1)}°`;
    wireBranchInfo.textContent = `Branch #${branchId} · ${wiredLabel}`;
    btnWireRemove.style.display = branch.wired ? '' : 'none';
    wireControls.style.display = '';
    wireAngleInput.value = '0';
    wireAngleLabel.textContent = '0°';
  }

  if (sculptMode === 'twine') {
    const twinedLabel = branch.twined
      ? `twined · angle ${branch.angle.toFixed(1)}° · degrades day ${branch.twineDegradesDay}`
      : `free · angle ${branch.angle.toFixed(1)}°`;
    twineBranchInfo.textContent = `Branch #${branchId} · ${twinedLabel}`;
    btnTwineRemove.style.display = branch.twined ? '' : 'none';
    twineControls.style.display = '';
    twineAngleInput.value = '0';
    twineAngleLabel.textContent = '0°';
  }

  if (sculptMode === 'weight') {
    const weightedLabel = branch.weighted
      ? `weighted (${branch.weightCount} bags) · angle ${branch.angle.toFixed(1)}°`
      : `no weight · angle ${branch.angle.toFixed(1)}°`;
    weightBranchInfo.textContent = `Branch #${branchId} · ${weightedLabel}`;
    btnWeightRemove.style.display = branch.weighted ? '' : 'none';
    weightControls.style.display = '';
    weightCountSelect.value = '1';
    weightAnglePreview.textContent = '+7° down';
  }

  if (sculptMode === 'jin') {
    const maxSeg = Math.max(0, Math.floor(branch.length) - 1);
    jinBranchInfo.textContent = `Branch #${branchId} · length ${branch.length.toFixed(1)} · segments 0–${maxSeg}`;
    jinSegmentInput.max = String(maxSeg);
    jinSegmentInput.value = '0';
    jinCostLabel.textContent = 'Cost: 1 jin';
    jinControls.style.display = '';
  }
}
```

**5. Pointer handler update — extend existing raycaster handler:**

Replace the current `pointerdown` handler body. The raycaster hit logic stays the same; only the mode dispatch changes:

```typescript
// In the pointerdown handler, replace:
//   if (!pruneMode && !wireMode) return;
// With:
if (sculptMode === 'none') return;

// Replace the pruneMode/wireMode dispatch with:
if (sculptMode === 'prune') {
  if (cell.branchId === 0) continue; // trunk protected
  // ... existing prune logic ...
  return;
}

// Branch-targeted sculpt modes (wire, twine, weight, jin):
if (sculptMode === 'wire' || sculptMode === 'twine' || sculptMode === 'weight' || sculptMode === 'jin') {
  hitBranch = true;
  const clickedId = cell.branchId;
  if (selectedBranchId === clickedId) {
    deselectSculptBranch();
  } else {
    selectSculptBranch(clickedId, tmpVec.clone());
  }
  return;
}
```

**6. Twine apply/remove callbacks:**

```typescript
// Twine apply (SCULPT-ADD 2026-08-29)
btnTwineApply.addEventListener('click', () => {
  if (selectedBranchId === null) return;
  const angleDelta = parseFloat(twineAngleInput.value);
  if (!Number.isFinite(angleDelta) || angleDelta === 0) {
    hintEl.textContent = 'No angle change — adjust the slider before applying twine.';
    return;
  }

  const result = tree.applyTwine(selectedBranchId, angleDelta);
  if (!result.ok) {
    hintEl.textContent = `Twine failed: ${result.reason}`;
    return;
  }

  const appliedDelta = round4(result.newAngle! - result.oldAngle!);
  // Engine self-logs via _logCare. Push to localCareLog for sessionStorage cache.
  localCareLog.push({
    day: tree.getAge(),
    action: {
      type: 'twine', branchId: selectedBranchId,
      angleDelta: appliedDelta, oldAngle: result.oldAngle!, newAngle: result.newAngle!,
      degradeDays: tree.getBranches()[selectedBranchId].twineDegradesDay - tree.getAge(),
    },
  });

  refreshAll();
  persistAsync({
    type: 'twine', branchId: selectedBranchId,
    angleDelta: appliedDelta, oldAngle: result.oldAngle!, newAngle: result.newAngle!,
    degradeDays: tree.getBranches()[selectedBranchId].twineDegradesDay - tree.getAge(),
  });

  // Update sub-controls to reflect new state
  const branch = tree.getBranches()[selectedBranchId];
  twineBranchInfo.textContent =
    `Branch #${selectedBranchId} · twined · angle ${branch.angle.toFixed(1)}° · degrades day ${branch.twineDegradesDay}`;
  btnTwineRemove.style.display = '';
  twineAngleInput.value = '0';
  twineAngleLabel.textContent = '0°';
});

// Twine remove (SCULPT-ADD 2026-08-29)
btnTwineRemove.addEventListener('click', () => {
  if (selectedBranchId === null) return;
  const branch = tree.getBranches()[selectedBranchId];
  if (!branch || !branch.twined) return;

  const bid = selectedBranchId;
  tree.removeTwine(bid);

  localCareLog.push({ day: tree.getAge(), action: { type: 'twine-remove', branchId: bid } });
  refreshAll();
  persistAsync({ type: 'twine-remove', branchId: bid });

  const updated = tree.getBranches()[bid];
  twineBranchInfo.textContent = `Branch #${bid} · free · angle ${updated.angle.toFixed(1)}°`;
  btnTwineRemove.style.display = 'none';
  twineAngleInput.value = '0';
  twineAngleLabel.textContent = '0°';
});
```

**7. Weight apply/remove callbacks:**

```typescript
// Weight apply (SCULPT-ADD 2026-08-29)
btnWeightApply.addEventListener('click', () => {
  if (selectedBranchId === null) return;
  const wc = parseInt(weightCountSelect.value, 10);
  if (wc < 1 || wc > 4) return;

  const result = tree.applyWeight(selectedBranchId, wc);
  if (!result.ok) {
    hintEl.textContent = `Weight failed: ${result.reason}`;
    return;
  }

  localCareLog.push({
    day: tree.getAge(),
    action: { type: 'weight', branchId: selectedBranchId, weightCount: wc, torqueContribution: result.torqueContribution! },
  });
  refreshAll();
  persistAsync({ type: 'weight', branchId: selectedBranchId, weightCount: wc, torqueContribution: result.torqueContribution! });

  const branch = tree.getBranches()[selectedBranchId];
  weightBranchInfo.textContent =
    `Branch #${selectedBranchId} · weighted (${branch.weightCount} bags) · angle ${branch.angle.toFixed(1)}°`;
  btnWeightRemove.style.display = '';
});

// Weight remove (SCULPT-ADD 2026-08-29)
btnWeightRemove.addEventListener('click', () => {
  if (selectedBranchId === null) return;
  const branch = tree.getBranches()[selectedBranchId];
  if (!branch || !branch.weighted) return;

  const bid = selectedBranchId;
  tree.removeWeight(bid);

  localCareLog.push({ day: tree.getAge(), action: { type: 'weight-remove', branchId: bid } });
  refreshAll();
  persistAsync({ type: 'weight-remove', branchId: bid });

  const updated = tree.getBranches()[bid];
  weightBranchInfo.textContent = `Branch #${bid} · no weight · angle ${updated.angle.toFixed(1)}°`;
  btnWeightRemove.style.display = 'none';
});
```

**8. Jin apply callback (Phase 1 stub — catches throw):**

```typescript
// Jin apply (SCULPT-ADD 2026-08-29)
// ⚠ Phase 1: JinEngine.applyJin THROWS CareLogReplayError after validation.
// The UI catches it and shows the stub message. When Phase 2 lands, the catch
// path becomes the error path and the happy path processes JinResult normally.
btnJinApply.addEventListener('click', () => {
  if (selectedBranchId === null) return;
  const segIdx = parseInt(jinSegmentInput.value, 10);
  const jinCost = 1; // Phase 1: fixed cost = 1

  // Jin is IRREVERSIBLE — require confirmation.
  if (!confirm(`Jin is irreversible. Apply jin pliers to branch #${selectedBranchId}, segment ${segIdx}? This cannot be undone.`)) {
    return;
  }

  try {
    const result = tree.applyJin(selectedBranchId, segIdx, jinCost);

    // Phase 2 happy path (never reached in Phase 1):
    if (!result.ok) {
      hintEl.textContent = `Jin failed: ${result.reason}`;
      return;
    }

    localCareLog.push({
      day: tree.getAge(),
      action: { type: 'jin', branchId: selectedBranchId, segmentIndex: segIdx, jinCost },
    });
    refreshAll();
    persistAsync({ type: 'jin', branchId: selectedBranchId, segmentIndex: segIdx, jinCost });
    hintEl.textContent = `Jin applied to branch #${selectedBranchId} segment ${segIdx}.`;
  } catch (err: unknown) {
    // Phase 1: CareLogReplayError thrown by JinEngine stub.
    hintEl.textContent = `Jin unavailable: ${err instanceof Error ? err.message : 'Phase 1 stub'}`;
  }
});
```

**9. Landscape apply callback (not branch-targeted):**

```typescript
// Landscape apply (SCULPT-ADD 2026-08-29)
btnLandscapeApply.addEventListener('click', () => {
  const elementType = landscapeTypeSelect.value as LandscapeElementType;
  const position: Coordinate = {
    x: parseInt(landscapeX.value, 10),
    y: parseInt(landscapeY.value, 10),
    z: parseInt(landscapeZ.value, 10),
  };

  try {
    tree.addLandscape(elementType, position);

    localCareLog.push({
      day: tree.getAge(),
      action: { type: 'landscape', elementType, position },
    });
    refreshAll();
    persistAsync({ type: 'landscape', elementType, position });
    hintEl.textContent = `Placed ${elementType} at (${position.x}, ${position.y}, ${position.z}).`;
  } catch (err: unknown) {
    hintEl.textContent = `Landscape failed: ${err instanceof Error ? err.message : 'invalid position'}`;
  }
});
```

**10. Mode toggle button wiring:**

```typescript
// Twine button toggle (SCULPT-ADD 2026-08-29)
twineBtn.addEventListener('click', () => {
  setSculptMode(sculptMode === 'twine' ? 'none' : 'twine');
});

// Weight button toggle (SCULPT-ADD 2026-08-29)
weightBtn.addEventListener('click', () => {
  setSculptMode(sculptMode === 'weight' ? 'none' : 'weight');
});

// Jin button toggle (SCULPT-ADD 2026-08-29)
jinBtn.addEventListener('click', () => {
  setSculptMode(sculptMode === 'jin' ? 'none' : 'jin');
});

// Landscape button toggle (SCULPT-ADD 2026-08-29)
landscapeBtn.addEventListener('click', () => {
  if (sculptMode === 'landscape') {
    setSculptMode('none');
    landscapeControls.style.display = 'none';
  } else {
    setSculptMode('landscape');
  }
});

// Update existing wire/prune toggles to use setSculptMode:
wireBtn.addEventListener('click', () => {
  setSculptMode(sculptMode === 'wire' ? 'none' : 'wire');
});
pruneBtn.addEventListener('click', () => {
  setSculptMode(sculptMode === 'prune' ? 'none' : 'prune');
});
```

**11. Twine angle slider preview (mirrors wire pattern):**

```typescript
twineAngleInput.addEventListener('input', () => {
  twineAngleLabel.textContent = `${twineAngleInput.value}°`;
  if (selectedBranchId !== null) {
    const branch = tree.getBranches()[selectedBranchId];
    if (branch) {
      const delta = parseFloat(twineAngleInput.value);
      if (delta !== 0) {
        const preview = Math.min(Math.max(branch.angle + delta, 5.7296), 150);
        twineBranchInfo.textContent =
          `Branch #${selectedBranchId} · ${branch.twined ? 'twined' : 'free'} · ${branch.angle.toFixed(1)}° → ${preview.toFixed(1)}°`;
      } else {
        const label = branch.twined
          ? `twined · angle ${branch.angle.toFixed(1)}° · degrades day ${branch.twineDegradesDay}`
          : `free · angle ${branch.angle.toFixed(1)}°`;
        twineBranchInfo.textContent = `Branch #${selectedBranchId} · ${label}`;
      }
    }
  }
});

// Weight count preview
weightCountSelect.addEventListener('change', () => {
  const wc = parseInt(weightCountSelect.value, 10);
  weightAnglePreview.textContent = `+${wc * 7}° down`;
});
```

**12. New tree reset — extend existing handler:**

Add after the existing wire cleanup in the btn-new click handler:

```typescript
// In btn-new handler, add after wireMode cleanup:
setSculptMode('none');
landscapeControls.style.display = 'none';
```

**13. Imports to add in main3d.ts:**

```typescript
import type { LandscapeElementType, Coordinate } from '@kijo/shared';
```

---

### VIEW 2: 2D Canvas Debug View (index2d.html + main2d.ts)

The 2D view is developer-only. Minimal controls, no sub-panels. Add buttons to the existing button rows.

#### HTML additions to index2d.html

Insert after the Prune/Rotate button row (after line 63):

```html
<div class="row">
  <button id="btn-twine">Twine…</button>
  <button id="btn-weight">Weight…</button>
  <button id="btn-jin">Jin…</button>
  <button id="btn-landscape">Landscape…</button>
</div>
```

#### main2d.ts changes

The 2D view uses `pickBranch()` (click-on-canvas hit test) for prune. Sculpt actions reuse the same mechanism. Since this is a debug view, the UX uses `prompt()` dialogs for parameters.

```typescript
// Add state:
type SculptMode2D = 'none' | 'prune' | 'twine' | 'weight' | 'jin';
let sculptMode2D: SculptMode2D = 'none';

// Twine button
document.getElementById('btn-twine')!.addEventListener('click', () => {
  sculptMode2D = sculptMode2D === 'twine' ? 'none' : 'twine';
  document.getElementById('btn-twine')!.classList.toggle('active', sculptMode2D === 'twine');
  // Deactivate other modes
  if (sculptMode2D === 'twine') {
    pruneMode = false;
    document.getElementById('btn-prune')!.classList.remove('active');
  }
});

// Weight button
document.getElementById('btn-weight')!.addEventListener('click', () => {
  sculptMode2D = sculptMode2D === 'weight' ? 'none' : 'weight';
  document.getElementById('btn-weight')!.classList.toggle('active', sculptMode2D === 'weight');
  if (sculptMode2D === 'weight') {
    pruneMode = false;
    document.getElementById('btn-prune')!.classList.remove('active');
  }
});

// Jin button
document.getElementById('btn-jin')!.addEventListener('click', () => {
  sculptMode2D = sculptMode2D === 'jin' ? 'none' : 'jin';
  document.getElementById('btn-jin')!.classList.toggle('active', sculptMode2D === 'jin');
  if (sculptMode2D === 'jin') {
    pruneMode = false;
    document.getElementById('btn-prune')!.classList.remove('active');
  }
});

// Landscape — not branch-targeted, uses prompt() for params
document.getElementById('btn-landscape')!.addEventListener('click', () => {
  const elementType = prompt('Element type (rock/moss/pot):', 'rock') as LandscapeElementType | null;
  if (!elementType || !['rock', 'moss', 'pot'].includes(elementType)) return;
  const x = parseInt(prompt('X (0-255):', '128') ?? '', 10);
  const y = parseInt(prompt('Y (0-255):', '38') ?? '', 10);
  const z = parseInt(prompt('Z (0-255):', '128') ?? '', 10);
  if ([x, y, z].some(v => !Number.isFinite(v))) return;

  try {
    tree.addLandscape(elementType as LandscapeElementType, { x, y, z });
    refreshStats();
    render();
    persistAsync({ type: 'landscape', elementType: elementType as LandscapeElementType, position: { x, y, z } });
  } catch (err: unknown) {
    alert(`Landscape failed: ${err instanceof Error ? err.message : err}`);
  }
});

// Canvas click handler — extend for sculpt modes
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const id = pickBranch(e.clientX - rect.left, e.clientY - rect.top);

  if (pruneMode && id !== null) {
    tree.prune(id);
    refreshStats();
    render();
    persistAsync({ type: 'prune', branchId: id });
    return;
  }

  if (sculptMode2D === 'twine' && id !== null) {
    const branch = tree.getBranches()[id];
    const deltaStr = prompt(`Twine branch #${id} (angle ${branch.angle.toFixed(1)}°). Bend delta (±28):`, '10');
    if (!deltaStr) return;
    const delta = parseFloat(deltaStr);
    if (!Number.isFinite(delta)) return;
    const result = tree.applyTwine(id, delta);
    if (!result.ok) { alert(`Twine failed: ${result.reason}`); return; }
    refreshStats();
    render();
    persistAsync({
      type: 'twine', branchId: id,
      angleDelta: round4(result.newAngle! - result.oldAngle!),
      oldAngle: result.oldAngle!, newAngle: result.newAngle!,
      degradeDays: tree.getBranches()[id].twineDegradesDay - tree.getAge(),
    });
    return;
  }

  if (sculptMode2D === 'weight' && id !== null) {
    const wcStr = prompt(`Weight branch #${id}. Bags (1-4):`, '1');
    if (!wcStr) return;
    const wc = parseInt(wcStr, 10);
    if (wc < 1 || wc > 4) { alert('Weight count must be 1-4'); return; }
    const result = tree.applyWeight(id, wc);
    if (!result.ok) { alert(`Weight failed: ${result.reason}`); return; }
    refreshStats();
    render();
    persistAsync({ type: 'weight', branchId: id, weightCount: wc, torqueContribution: result.torqueContribution! });
    return;
  }

  if (sculptMode2D === 'jin' && id !== null) {
    const segStr = prompt(`Jin branch #${id} (length ${tree.getBranches()[id].length.toFixed(1)}). Segment index:`, '0');
    if (!segStr) return;
    const seg = parseInt(segStr, 10);
    if (!confirm('Jin is IRREVERSIBLE. Continue?')) return;
    try {
      tree.applyJin(id, seg, 1);
      refreshStats();
      render();
      persistAsync({ type: 'jin', branchId: id, segmentIndex: seg, jinCost: 1 });
    } catch (err: unknown) {
      alert(`Jin error: ${err instanceof Error ? err.message : err}`);
    }
    return;
  }
});
```

**Import to add in main2d.ts:**

```typescript
import { round4 } from '@kijo/shared';
import type { LandscapeElementType } from '@kijo/shared';
```

---

### VIEW 3: React Production Care UI (ThreeCanvas.tsx + hud.ts + care_bridge.ts)

#### Caretaker opacity rules

The production UI does NOT show stats, style, technique, or matchPct. Sculpt controls show **only observable state**: which branch has twine (visible fiber), which has weights (visible bags), but NOT stat impacts.

In Phase 1, the production view adds **twine and weight only**. Jin and landscape are deferred:
- **Jin** — Phase 1 engine stub throws. No point wiring a button that always errors.
- **Landscape** — requires 3D position picking UX that is complex for mobile. Deferred to Phase 2.

#### CareBridge extension (care_bridge.ts)

Add new methods to the CareBridge class:

```typescript
// In CareBridge class:

applyTwine(branchId: number, angleDelta: number): TwineResult {
  return this.tree.applyTwine(branchId, angleDelta);
  // afterAction is NOT called here — caller does it after logging.
}

removeTwine(branchId: number): void {
  this.tree.removeTwine(branchId);
}

applyWeight(branchId: number, weightCount: number): WeightResult {
  return this.tree.applyWeight(branchId, weightCount);
}

removeWeight(branchId: number): void {
  this.tree.removeWeight(branchId);
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

Note: CareBridge methods do NOT call `this.afterAction()` for sculpt actions because the caller (ThreeCanvas.tsx) needs to push to localCareLog and call persistAsync BEFORE refreshView. The caller calls `refreshView()` explicitly after logging. This matches the pattern where `bridge.water()` calls `afterAction` internally but the sculpt flow needs more control.

**Alternative (simpler, recommended):** Have CareBridge sculpt methods call `this.afterAction()` and have ThreeCanvas.tsx push to localCareLog BEFORE calling the bridge method (same pattern as `onWater` in ThreeCanvas.tsx line 117-118). This keeps the bridge dumb.

```typescript
// Recommended pattern:
applyTwine(branchId: number, angleDelta: number): TwineResult {
  const result = this.tree.applyTwine(branchId, angleDelta);
  if (result.ok) this.afterAction();
  return result;
}
```

#### CareHud extension (hud.ts)

Add new callbacks to HudCallbacks interface:

```typescript
export interface HudCallbacks {
  onWater: () => void;
  onNextDay: () => void;
  onToggleAuto: () => boolean;
  // SCULPT-ADD 2026-08-29
  onTwine?: () => void;    // toggles twine sculpt mode
  onWeight?: () => void;   // toggles weight sculpt mode
}
```

Optional callbacks (`?`) so existing callers don't break. CareHud wires them if present:

```typescript
// In CareHud constructor, after existing button wiring:
const twineBtn = document.getElementById('btn-twine-mode');
if (twineBtn && cb.onTwine) {
  twineBtn.addEventListener('click', cb.onTwine);
}
const weightBtn = document.getElementById('btn-weight-mode');
if (weightBtn && cb.onWeight) {
  weightBtn.addEventListener('click', cb.onWeight);
}
```

#### ThreeCanvas.tsx JSX additions

Add twine and weight buttons to the bottom HUD:

```tsx
{/* In the #buttons div, after btn-buy-seed: */}
<button id="btn-twine-mode">🧵 Twine</button>
<button id="btn-weight-mode">⚖️ Weight</button>
```

#### ThreeCanvas.tsx wiring

In the useEffect, after the hud is created, add sculpt mode state and handlers:

```typescript
// Sculpt mode for production view (twine/weight only in Phase 1)
let prodSculptMode: 'none' | 'twine' | 'weight' = 'none';

const hud = new CareHud({
  onWater: () => { /* existing */ },
  onNextDay: () => bridge.nextDay(),
  onToggleAuto: () => bridge.toggleAuto(),
  onTwine: () => {
    prodSculptMode = prodSculptMode === 'twine' ? 'none' : 'twine';
    // TODO: enable branch picking via raycaster (same as main3d.ts pattern)
    // When a branch is picked, show a simple angle input overlay
    // For Phase 1: this enables the mode. Branch picking requires adding
    // a raycaster to the ThreeCanvas scene (follow main3d.ts pointer handler).
  },
  onWeight: () => {
    prodSculptMode = prodSculptMode === 'weight' ? 'none' : 'weight';
    // Same TODO as twine — raycaster branch picking required.
  },
});
```

**Critical implementation note for ThreeCanvas.tsx:** The production view does NOT currently have a raycaster or voxel picking. The 3D viewer (main3d.ts) has this because it renders voxels as InstancedMesh and raycasts against them. ThreeCanvas uses `buildTreeMesh()` which builds a different mesh structure. Adding branch picking to ThreeCanvas requires:

1. Adding a raycaster to the createScene output
2. Storing branchId metadata on mesh segments (or rebuilding voxel-level picking)
3. A pointer handler that maps hits to branchIds

This is the SAME pattern as main3d.ts lines 357-409 but adapted for the production renderer. The implementer must:
- Add `raycaster`, `pointer`, `selectedBranchId` state to ThreeCanvas
- Wire a `pointerdown` handler on the container
- Map mesh hits to branchIds via the tree mesh's userData

#### Production sculpt UX (mobile-first)

When a branch is selected in twine/weight mode, show a **bottom sheet overlay** (not a sidebar panel — mobile viewport is too narrow):

```html
<!-- Add to ThreeCanvas JSX, inside the return fragment: -->
<div id="sculpt-overlay" style={{
  display: 'none',
  position: 'fixed', left: 0, right: 0, bottom: '80px',
  background: 'var(--panel)', borderTop: '1px solid var(--edge)',
  padding: '12px', zIndex: 20, textAlign: 'center'
}}>
  <div id="sculpt-branch-label" style={{ fontSize: '13px', marginBottom: '8px' }} />
  <div id="sculpt-controls-inner" />
</div>
```

The overlay content is dynamically populated by the sculpt mode handler in ThreeCanvas.tsx — twine shows a range slider ±28°, weight shows a 1-4 picker. Both show Apply/Remove.

**Caretaker opacity compliance:** The overlay shows "Branch #N · twined" or "Branch #N · 2 weights" but NOT angle values, stat impacts, or technique classification.

---

## JIN PHASE 1 STUB LIMITATION

**JinEngine.applyJin (JinEngine.ts:49) throws `CareLogReplayError('Phase 1 stub — voxelization in Phase 2')` after input validation passes.**

Consequences for UI:
1. **3D viewer:** Jin button exists, controls are wirable. Apply handler wraps in try/catch. On catch, displays "Jin unavailable: Phase 1 stub" in the hint bar. No care log entry is pushed. No persistAsync call.
2. **2D viewer:** Same try/catch pattern. Alert dialog shows the error.
3. **Production view:** Jin button is NOT added. No point showing a button that always errors in the player-facing UI.

When Phase 2 lands (JinEngine returns JinResult instead of throwing), the 3D/2D UIs work immediately — the try/catch happy path processes the result. The production view adds a Jin button at that time.

---

## LANDSCAPE NON-BRANCH-TARGETED UX

Landscape is fundamentally different from twine/weight/jin/wire:
- It does NOT use branch selection (no raycaster, no selectionIndicator)
- It targets a position in the voxel grid (Coordinate { x, y, z })
- It has an element type picker (rock/moss/pot)

The 3D viewer uses text inputs for x/y/z coordinates. Phase 2 can add a 3D position picker (click on the pot to place elements). The 2D viewer uses prompt() dialogs. The production view defers landscape to Phase 2.

---

## ASSUMPTIONS

```
A1. Twine/weight/jin share the branch selection mechanism with wire.
    Mitigation: verified — same raycaster → branchId mapping works. selectSculptBranch
    is a generalization of selectWireBranch.

A2. Jin confirmation uses confirm() in 3D/2D views.
    Mitigation: functional for dev views. Production view defers jin to Phase 2.

A3. Landscape position uses text inputs (x, y, z).
    Mitigation: simple, correct, adequate for Phase 1. 3D position picking is Phase 2.

A4. ThreeCanvas.tsx requires raycaster addition for branch picking.
    Mitigation: clear implementation path (mirror main3d.ts pattern). The spec defines
    the wiring but flags the raycaster as new code the implementer must write.

A5. degradeDays for the care log entry is computed as (twineDegradesDay - currentAge).
    Verified: TwineWeightEngine.applyTwine stores degradeDays in the care log entry
    at line 187. The UI must extract it from the branch state post-apply because
    applyTwine does NOT return degradeDays in TwineResult.
```

---

## OPEN QUESTIONS

```
OQ-1: Should the production view (ThreeCanvas) show twine/weight in Phase 1, or defer
      ALL sculpt controls to Phase 2 when the raycaster is built?
      RECOMMENDATION: Add the buttons now, wire the mode toggle, but defer branch picking
      to a follow-up task. The buttons exist and do nothing until picking is wired.

OQ-2: Should landscape coordinates in the 3D viewer default to the pot center (128, 38, 128)
      or to the last clicked voxel position?
      RECOMMENDATION: Default to pot center. Last-clicked requires raycaster state leaking
      across sculpt modes.

OQ-3: Weight STACK semantics (OQ-5 from TwineWeightEngine): calling applyWeight on an
      already-weighted branch accumulates weightAngleDelta. Should the UI prevent
      re-application (disable Apply when weighted=true) or allow stacking?
      RECOMMENDATION: Allow stacking — the engine supports it. Show current weightCount
      in the branch info and let the caretaker add more.
```

---

## SUMMARY: ELEMENT IDS AND CALLBACK SIGNATURES

### New HTML element IDs (3D viewer)

| ID | Type | Purpose |
|---|---|---|
| `btn-twine` | button | Toggle twine sculpt mode |
| `twine-controls` | div | Expandable twine sub-controls (hidden by default) |
| `twine-branch-info` | div | Selected branch info for twine |
| `twine-angle` | input[range] | ±28° slider |
| `twine-angle-label` | span | Slider value display |
| `btn-twine-apply` | button | Apply twine |
| `btn-twine-remove` | button | Remove twine |
| `btn-weight` | button | Toggle weight sculpt mode |
| `weight-controls` | div | Expandable weight sub-controls |
| `weight-branch-info` | div | Selected branch info for weight |
| `weight-count` | select | 1-4 bag picker |
| `weight-angle-preview` | span | Preview angle change |
| `btn-weight-apply` | button | Apply weight |
| `btn-weight-remove` | button | Remove weight |
| `btn-jin` | button | Toggle jin sculpt mode |
| `jin-controls` | div | Expandable jin sub-controls |
| `jin-branch-info` | div | Selected branch info for jin |
| `jin-segment` | input[number] | Segment index input |
| `jin-cost-label` | span | Shows jinCost |
| `btn-jin-apply` | button | Apply jin (irreversible) |
| `jin-stub-warning` | div | Phase 1 stub warning text |
| `btn-landscape` | button | Toggle landscape controls |
| `landscape-controls` | div | Landscape sub-controls |
| `landscape-type` | select | rock/moss/pot picker |
| `landscape-x/y/z` | input[number] | Position inputs |
| `btn-landscape-apply` | button | Place landscape element |

### New HTML element IDs (production view)

| ID | Type | Purpose |
|---|---|---|
| `btn-twine-mode` | button | Toggle twine mode (bottom HUD) |
| `btn-weight-mode` | button | Toggle weight mode (bottom HUD) |
| `sculpt-overlay` | div | Bottom sheet for sculpt controls |
| `sculpt-branch-label` | div | Selected branch label |
| `sculpt-controls-inner` | div | Dynamic control content |

### CareBridge new methods

| Method | Signature | Returns |
|---|---|---|
| `applyTwine` | `(branchId: number, angleDelta: number)` | `TwineResult` |
| `removeTwine` | `(branchId: number)` | `void` |
| `applyWeight` | `(branchId: number, weightCount: number)` | `WeightResult` |
| `removeWeight` | `(branchId: number)` | `void` |
| `getBranch` | `(branchId: number)` | `Branch \| undefined` |

### CareHud new callbacks

| Callback | Signature | Purpose |
|---|---|---|
| `onTwine?` | `() => void` | Toggle twine sculpt mode |
| `onWeight?` | `() => void` | Toggle weight sculpt mode |
