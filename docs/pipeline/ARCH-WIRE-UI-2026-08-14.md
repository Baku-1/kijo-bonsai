# ARCH-WIRE-UI-2026-08-14

**Pipeline stage:** Architect (Verified Architect skill)  
**Date:** 2026-08-14  
**Author:** Architect pass — wire branch UI for `main3d.ts` / `index3d.html`  
**Status:** READY FOR IMPLEMENTER  

---

## SCOPE

```
DESIGN TASK:  Complete wire-branch UI in the 3D care client (index3d.html / main3d.ts).
DELIVERABLE:  Exact HTML diff for index3d.html; exact JS additions/modifications for
              main3d.ts; open questions requiring Jeremy's decision.
BUILDS ON:    WireEngine W1-W6 gate-verified (2026-08-07, 20/20 assertions).
              Prune UI in main3d.ts (reference pattern).
CONSUMED BY:  Disciplined Implementer (IMPL phase next).
```

---

## CODEBASE RECONNAISSANCE

### Files read (in order)

| File | Lines | Notes |
|---|---|---|
| `STATE.md` | 288 | Project state, gate results |
| `DECISIONS.md` | 179 | Append-only decision log |
| `apps/web/src/main3d.ts` | 592 | **ENTIRE FILE READ** — primary implementation target |
| `apps/web/index3d.html` | 98 | 3D client HTML — target for HTML additions |
| `apps/web/index.html` | 81 | 2D/React entry — NOT the target (confirmed) |
| `packages/engine/src/WireEngine.ts` | 167 | Engine API source of truth |
| `packages/shared/src/index.ts` | 407 | Branch interface, CareAction union |
| `apps/server/supabase/functions/care-action/index.ts` | 207 | **CRITICAL GAPS FOUND** |
| `docs/KIJO-ENGINE-API.md` | 434 | API reference |
| `packages/engine/src/BonsaiTree.ts` | 368 | BonsaiTree methods verified |
| `apps/web/src/persistence.ts` | 361 | persistCareAction signature, applyCurrentDayEntries |
| `apps/web/src/components/StoreModal.tsx` | ~120 (wire section) | Consumable live status |

---

### Symbols verified

```
VERIFIED:
  ✓ WIRE_MAX_ANGLE_DELTA — WireEngine.ts:27, value: 45 (not 28 — 28 is TWINE_MAX_ANGLE_DELTA)
  ✓ WIRE_MAX_THICKNESS   — WireEngine.ts:29, value: 3.0
  ✓ WIRE_COST_T1_MAX     — WireEngine.ts:30, value: 1.5

  ✓ WireEngine.wire(tree, branchId, angleDelta)
      — WireEngine.ts:66, returns WireResult { ok, reason?, wireCost?, oldAngle?, newAngle? }
      — Does NOT guard against re-wiring: a wired branch CAN be re-wired (clears wireSet)
      — Pushes to tree.getCareLog() internally (action entry logged inside engine)
      — Calls tree.markDirty() internally

  ✓ WireEngine.removeWire(tree, branchId)
      — WireEngine.ts:128, returns void
      — Silent no-op if: not found, pruned, or !branch.wired
      — Calls tree._logCare(entry) internally (not tree.getCareLog().push directly)
      — Calls tree.markDirty() internally

  ✓ WireResult interface
      — WireEngine.ts:38-44: { ok: boolean; reason?: WireRejectReason; wireCost?: number;
        oldAngle?: number; newAngle?: number }
      — When ok=true: wireCost, oldAngle, newAngle are always populated (non-optional in practice)

  ✓ WireRejectReason
      — WireEngine.ts:36: 'not-found' | 'pruned' | 'too-thick'
      — 'already-wired' does NOT exist — re-wiring is allowed

  ✓ BonsaiTree.wire(branchId, angleDelta)
      — BonsaiTree.ts:173, delegates to WireEngine.wire(this, branchId, angleDelta)
      — Returns WireResult

  ✓ BonsaiTree.removeWire(branchId)
      — BonsaiTree.ts:193, delegates to WireEngine.removeWire(this, branchId)
      — Returns void

  ✓ BonsaiTree.getBranches()
      — BonsaiTree.ts:311, returns Branch[] (state.branches)

  ✓ Branch.wired: boolean
      — shared/index.ts:49, true when metal wire is currently applied

  ✓ Branch.wireAngle: number
      — shared/index.ts:64, bend angle (degrees, signed) applied by the wire action

  ✓ Branch.wireCount?: number
      — shared/index.ts:154, optional; read as (b.wireCount ?? 0)

  ✓ Branch.thickness: number
      — shared/index.ts:9, radius in voxel units; checked against WIRE_MAX_THICKNESS

  ✓ Branch.angle: number
      — shared/index.ts:8, degrees relative to parent

  ✓ CareAction 'wire' shape
      — shared/index.ts:193:
        { type: 'wire'; branchId: number; angleDelta: number; oldAngle: number;
          newAngle: number; wireCost: number }
      — All fields required. angleDelta = appliedDelta (post-clamp, not user input)

  ✓ CareAction 'wire-remove' shape
      — shared/index.ts:197: { type: 'wire-remove'; branchId: number }

  ✓ persistAsync signature
      — main3d.ts:369: function persistAsync(action: Parameters<typeof persistCareAction>[1]): void
      — Takes CareAction (full discriminated union type)
      — Fire-and-forget: errors go to console.error, NOT surfaced to the user

  ✓ persistCareAction signature
      — persistence.ts:216: persistCareAction(session: KijoSession, action: CareAction)
      — Sends: { tree_id, wallet_row_id, action } as JSON body to care-action Edge Function

  ✓ pruneMode (reference pattern)
      — main3d.ts:262: let pruneMode = false;
      — pruneBtn.classList.toggle('active', pruneMode)
      — controls.enableRotate = !pruneMode
      — pointerdown guard: if (!pruneMode || !latestVoxels) return;

  ✓ raycaster / pointer / dummy / tmpVec / meshes — all defined, main3d.ts:187-191, 329-330

  ✓ latestVoxels: VoxelizeResult | null — main3d.ts:263
  ✓ latestVoxels.voxels.get(gx, gy, gz) — returns VoxelCell { material, role, branchId } or undefined
  ✓ cell.branchId — used in prune handler; branchId 0 = trunk (protected for prune, allowed for wire)

  ✓ localCareLog: CareLogEntry[] — main3d.ts:271
  ✓ refreshAll() — main3d.ts:293, rebuilds voxels + stats; calls rebuildVoxels() which replaces meshes
  ✓ hintEl — main3d.ts:39, bottom-left overlay inside #app canvas

  ✓ index3d.html button CSS
      — button.active { background: var(--accent); color: #141710; }
      — .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      — .grow { flex: 1; }

  ✓ Care fieldset structure (index3d.html:62-77)
      Row 1: btn-water, btn-fertilize
      Row 2: btn-prune, btn-rotate
      Row 3: btn-day + days-multi input
      fert-status div

  ✓ wire consumable live status
      — StoreModal.tsx: id: "wire", live: false
      — Wire is NOT purchasable via the store in the current build
```

### Call sites found

```
WireEngine.wire:
  - packages/engine/src/BonsaiTree.ts:174 — tree.wire() delegate
  - packages/engine/test_wire.mjs — gate tests only (no UI yet)

WireEngine.removeWire:
  - packages/engine/src/BonsaiTree.ts:194 — tree.removeWire() delegate

tree.wire() (BonsaiTree method):
  - NO call sites in apps/web/src/* — confirmed zero wire UI exists

tree.removeWire() (BonsaiTree method):
  - NO call sites in apps/web/src/* — confirmed

persistAsync:
  - main3d.ts:356 — prune
  - main3d.ts:487 — water
  - main3d.ts:493 — fertilize
  - main3d.ts:499 — rotate

pruneMode:
  - main3d.ts:262 — declaration
  - main3d.ts:333 — pointerdown guard
  - main3d.ts:477, 505, 506 — btn-new reset + pruneBtn toggle
```

### Gaps found (reality vs. task prompt)

```
GAP-1 (CRITICAL): care-action ALLOWED_ACTION_TYPES whitelist
  Actual (care-action/index.ts:98):
    new Set(['water', 'prune', 'wire', 'fertilize', 'rotate'])
  'wire' IS present — wire applies will reach the server.
  'wire-remove' IS NOT present — removeWire persists will be rejected with 400.
  This is a server-side blocker for wire-remove persistence.

GAP-2 (CRITICAL): wire consumable is live: false
  StoreModal.tsx has wire: { live: false }. Players cannot purchase wire.
  care-action checks consumable quantity before applying the action.
  If the 'wire' consumable row is missing or quantity=0, server returns 400.
  persistAsync is fire-and-forget — the 400 will be logged to console only.
  Local state will have wire applied; server state will not.
  State diverges silently.

GAP-3: WIRE_MAX_ANGLE_DELTA = 45, not 28
  Task prompt said "±28° max, per TWINE_MAX_ANGLE_DELTA". This is wrong.
  Wire is ±45°. 28° is TWINE_MAX_ANGLE_DELTA (twine action, different tech).
  Slider range must be -45 to +45.

GAP-4: applyCurrentDayEntries skips wire / wire-remove
  persistence.ts:303: wire and wire-remove are `else { console.warn }` — skipped.
  If a wire action is applied in the current game day, navigating away and returning
  will restore the tree from cache but NOT re-apply the wire bend from the current day.
  The branch will appear at its pre-wire angle after reload.
  This is a known limitation — fixing it requires expanding applyCurrentDayEntries
  to call tree.wire(). Out of scope for this spec; flag for implementer.

GAP-5: angleDelta in localCareLog / persistAsync must be appliedDelta (post-clamp)
  WireEngine.wire() computes appliedDelta = round4(clampedAngle - oldAngle) internally
  and logs it to tree.getCareLog(). The localCareLog push in main3d.ts must use the
  same value. We derive it as: result.newAngle! - result.oldAngle! from WireResult.

GAP-6: WireEngine logs to tree.getCareLog() directly
  WireEngine.wire() calls tree.getCareLog().push(entry) at line 101.
  WireEngine.removeWire() calls tree._logCare(entry) at line 163.
  The internal engine care log IS populated automatically.
  localCareLog in main3d.ts is a SEPARATE client-side tracking array.
  We must still push to localCareLog for local cache fidelity (saveTreeCache uses it).
  Unlike prune (pushes before engine call), wire must push AFTER engine call to get
  oldAngle / newAngle / wireCost from WireResult.
```

---

## VERIFICATION LOG

```
VERIFIED:
  ✓ WireEngine.wire accepts any branchId including 0 (trunk) — OQ-1 resolution, DECISIONS.md 2026-07-31
  ✓ WireEngine.wire does not have 'already-wired' guard — re-wiring a wired branch is valid
  ✓ WIRE_MAX_ANGLE_DELTA = 45 degrees — WireEngine.ts:27
  ✓ WIRE_MAX_THICKNESS = 3.0 — WireEngine.ts:29
  ✓ 'wire' IS in ALLOWED_ACTION_TYPES — care-action/index.ts:98
  ✓ 'wire-remove' is NOT in ALLOWED_ACTION_TYPES — care-action/index.ts:98 (confirmed absent)
  ✓ wire requires 'wire' consumable — CONSUMABLE map care-action/index.ts:16-21
  ✓ wire consumable live: false in StoreModal — StoreModal.tsx ~line 58
  ✓ VoxelCell.branchId 0 = trunk; prune skips 0; wire should NOT skip 0 — main3d.ts:351
  ✓ refreshAll() rebuilds meshes.clear() then re-adds — selectionIndicator must be a
    separate Object3D not in meshes Map to survive rebuild
  ✓ controls.enableRotate = !pruneMode pattern — main3d.ts:506
  ✓ btn-new resets pruneMode — main3d.ts:477 (must also reset wireMode)

UNVERIFIED:
  ? Wire consumable quantity for test accounts — unknown; no DB query done.
    If 'wire' consumable row missing, server returns "consumable 'wire' record not found" (400).
    If row exists with quantity=0, server returns "not enough 'wire' (quantity is 0)" (400).
    Either way the server rejects until live: true and consumables are provisioned.

REFUTED:
  ✗ Task prompt: "±28° max, per TWINE_MAX_ANGLE_DELTA"
    Actual: wire is ±45°. WIRE_MAX_ANGLE_DELTA = 45. 28° is twine only.
```

---

## CROSS-REFERENCE CHECK

```
checked against: STATE.md, DECISIONS.md, KIJO-ENGINE-API.md, shared/index.ts, WireEngine.ts
consistent: YES on engine API; NO on care-action whitelist (wire-remove missing)
terminology aligned: YES
data shapes aligned: YES — CareAction 'wire' shape in shared matches WireEngine log entry
boundary violations: NONE — UI changes in apps/web only; no engine changes required
```

---

## THE DESIGN

### 1. Mode button — index3d.html

**Where:** Care fieldset, new row inserted AFTER the existing prune/rotate row (row 2),
BEFORE the day-advance row (row 3).

**HTML to add** (insert between line 69 and line 71 of index3d.html):

```html
        <div class="row" style="margin-top:6px">
          <button id="btn-wire" class="grow">Wire…</button>
        </div>
        <div id="wire-controls" style="display:none; margin-top:6px; border-top:1px solid var(--edge); padding-top:6px">
          <div id="wire-branch-info" style="font-size:11px; opacity:.7; margin-bottom:4px">—</div>
          <div class="row">
            <label for="wire-angle" style="font-size:11px; white-space:nowrap">Bend Δ</label>
            <input id="wire-angle" type="range" min="-45" max="45" value="0" class="grow" style="cursor:pointer" />
            <span id="wire-angle-label" style="font-size:12px; min-width:38px; text-align:right">0°</span>
          </div>
          <div class="row" style="margin-top:4px">
            <button id="btn-wire-apply" class="grow">Apply</button>
            <button id="btn-wire-remove">Remove</button>
          </div>
        </div>
```

**Insertion point (exact):** Replace this block in index3d.html:

```html
        <div class="row" style="margin-top:6px">
          <button id="btn-prune" class="grow">Prune…</button>
          <button id="btn-rotate" class="grow">Rotate 90°</button>
        </div>
        <div class="row" style="margin-top:6px">
```

with:

```html
        <div class="row" style="margin-top:6px">
          <button id="btn-prune" class="grow">Prune…</button>
          <button id="btn-rotate" class="grow">Rotate 90°</button>
        </div>
        <div class="row" style="margin-top:6px">
          <button id="btn-wire" class="grow">Wire…</button>
        </div>
        <div id="wire-controls" style="display:none; margin-top:6px; border-top:1px solid var(--edge); padding-top:6px">
          <div id="wire-branch-info" style="font-size:11px; opacity:.7; margin-bottom:4px">—</div>
          <div class="row">
            <label for="wire-angle" style="font-size:11px; white-space:nowrap">Bend Δ</label>
            <input id="wire-angle" type="range" min="-45" max="45" value="0" class="grow" style="cursor:pointer" />
            <span id="wire-angle-label" style="font-size:12px; min-width:38px; text-align:right">0°</span>
          </div>
          <div class="row" style="margin-top:4px">
            <button id="btn-wire-apply" class="grow">Apply</button>
            <button id="btn-wire-remove">Remove</button>
          </div>
        </div>
        <div class="row" style="margin-top:6px">
```

**Notes:**
- `btn-wire-remove` has NO `.grow` class intentionally — it is a secondary action and should appear smaller than Apply.
- `btn-wire-remove` has no `style="display:none"` in HTML — it is shown/hidden via JS based on `branch.wired`.
- `wire-controls` is hidden by default (`display:none`) and shows only when a branch is selected in wire mode.
- `btn-wire` gets class `active` (background: var(--accent)) when wire mode is active — same as `btn-prune`.

---

### 2. main3d.ts — complete additions

All code below is added to `apps/web/src/main3d.ts`. No changes to any other source file.

#### 2a. State variables (add after line 262, beside `let pruneMode = false;`)

```typescript
let wireMode = false;
let selectedBranchId: number | null = null;
```

#### 2b. DOM element references (add after line 39, in the element-reference block)

```typescript
const wireControls    = document.getElementById('wire-controls')! as HTMLDivElement;
const wireBranchInfo  = document.getElementById('wire-branch-info')!;
const wireAngleInput  = document.getElementById('wire-angle')! as HTMLInputElement;
const wireAngleLabel  = document.getElementById('wire-angle-label')!;
const btnWireApply    = document.getElementById('btn-wire-apply')!;
const btnWireRemove   = document.getElementById('btn-wire-remove')!;
```

#### 2c. Selection indicator mesh (add immediately after the `ghost` block, around line 135)

```typescript
// Wire selection indicator — a wireframe sphere placed at the clicked voxel's world
// position to mark the selected branch. NOT added to meshes Map — survives rebuildVoxels.
const selectionIndicator = (() => {
  const g = new THREE.SphereGeometry(2.5, 8, 6);
  const m = new THREE.MeshBasicMaterial({ color: 0xffdd00, wireframe: true });
  const mesh = new THREE.Mesh(g, m);
  mesh.visible = false;
  scene.add(mesh);
  return mesh;
})();
```

#### 2d. Wire helper functions (add in the Controls section, before the existing event listeners at line 471)

```typescript
// ---------------------------------------------------------------------------
// Wire mode helpers
// ---------------------------------------------------------------------------

/** Clear branch selection: hide indicator, hide controls, reset angle input. */
function deselectWireBranch(): void {
  selectedBranchId = null;
  selectionIndicator.visible = false;
  wireControls.style.display = 'none';
  wireAngleInput.value = '0';
  wireAngleLabel.textContent = '0°';
}

/**
 * Select a branch in wire mode. Updates the info panel and positions the
 * selection indicator at the clicked voxel's world position.
 */
function selectWireBranch(branchId: number, worldPos: THREE.Vector3): void {
  selectedBranchId = branchId;
  selectionIndicator.position.copy(worldPos);
  selectionIndicator.visible = true;

  const branch = tree.getBranches()[branchId];
  const wiredLabel = branch.wired
    ? `wired · angle ${branch.angle.toFixed(1)}° · applied day ${branch.wireAppliedDay}`
    : `unwired · angle ${branch.angle.toFixed(1)}°`;
  wireBranchInfo.textContent = `Branch #${branchId} · ${wiredLabel}`;
  btnWireRemove.style.display = branch.wired ? '' : 'none';
  wireControls.style.display = '';
  wireAngleInput.value = '0';
  wireAngleLabel.textContent = '0°';
}
```

#### 2e. Live angle label listener (add in Controls section)

```typescript
wireAngleInput.addEventListener('input', () => {
  wireAngleLabel.textContent = `${wireAngleInput.value}°`;
});
```

#### 2f. Wire mode toggle button (add in Controls section)

```typescript
const wireBtn = document.getElementById('btn-wire')!;
wireBtn.addEventListener('click', () => {
  wireMode = !wireMode;
  wireBtn.classList.toggle('active', wireMode);

  if (wireMode) {
    // Deactivate prune if it was active — only one sculpt mode at a time.
    if (pruneMode) {
      pruneMode = false;
      pruneBtn.classList.remove('active');
    }
    controls.enableRotate = false; // disable orbit while selecting voxels
    hintEl.textContent =
      'Wire mode: click a branch voxel to select it. Trunk can be wired. ' +
      'Set bend angle and click Apply.';
  } else {
    deselectWireBranch();
    controls.enableRotate = true;
    hintEl.textContent =
      'Drag to orbit · scroll to zoom · the blue ghost is roughly where this seed wants to grow';
  }
});
```

#### 2g. Modify pruneBtn listener to handle wire conflict

**Replace** the existing pruneBtn listener (main3d.ts lines 503-510):

```typescript
// BEFORE:
pruneBtn.addEventListener('click', () => {
  pruneMode = !pruneMode;
  pruneBtn.classList.toggle('active', pruneMode);
  controls.enableRotate = !pruneMode;
  hintEl.textContent = pruneMode
    ? 'Prune mode: click a branch voxel to cut it. Trunk is protected.'
    : 'Drag to orbit · scroll to zoom · the blue ghost is roughly where this seed wants to grow';
});
```

**With:**

```typescript
// AFTER:
pruneBtn.addEventListener('click', () => {
  pruneMode = !pruneMode;
  pruneBtn.classList.toggle('active', pruneMode);

  if (pruneMode && wireMode) {
    // Wire mode loses to prune — clear wire without touching controls.enableRotate here.
    wireMode = false;
    wireBtn.classList.remove('active');
    deselectWireBranch();
  }

  controls.enableRotate = !(pruneMode || wireMode);
  hintEl.textContent = pruneMode
    ? 'Prune mode: click a branch voxel to cut it. Trunk is protected.'
    : 'Drag to orbit · scroll to zoom · the blue ghost is roughly where this seed wants to grow';
});
```

#### 2h. Modify btn-new listener to reset wire state

**Replace** the existing btn-new listener (lines 471-481) to add wire cleanup.
The added lines are marked with `// WIRE-ADD`:

```typescript
document.getElementById('btn-new')!.addEventListener('click', () => {
  kijoSession = null;
  tree = newTree();
  localCareLog = [];
  cacheReady = true;
  clearTreeCache();
  pruneMode = false;
  document.getElementById('btn-prune')!.classList.remove('active');
  wireMode = false;                                           // WIRE-ADD
  wireBtn.classList.remove('active');                        // WIRE-ADD
  deselectWireBranch();                                      // WIRE-ADD
  controls.enableRotate = true;                              // WIRE-ADD
  exportOut.value = '';
  refreshAll();
});
```

#### 2i. Replace pointerdown handler to share raycast between prune and wire

**Replace** the entire existing pointerdown listener (main3d.ts lines 332-359):

```typescript
// BEFORE (lines 332-359):
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (!pruneMode || !latestVoxels) return;
  // ... raycast + prune logic ...
});
```

**With:**

```typescript
// AFTER:
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (!latestVoxels) return;
  if (!pruneMode && !wireMode) return;

  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObjects([...meshes.values()], false);
  let hitBranch = false;

  for (const hit of hits) {
    if (hit.instanceId === undefined) continue;
    const mesh = hit.object as THREE.InstancedMesh;
    mesh.getMatrixAt(hit.instanceId, dummy.matrix);
    tmpVec.setFromMatrixPosition(dummy.matrix);
    // world → grid
    const gx = Math.round(tmpVec.x + 128);
    const gy = Math.round(tmpVec.y + BASE_Y);
    const gz = Math.round(tmpVec.z + 128);
    const cell = latestVoxels.voxels.get(gx, gy, gz);
    if (!cell) continue;

    if (pruneMode) {
      if (cell.branchId === 0) continue; // trunk protected from prune
      const prunedId = cell.branchId;
      localCareLog.push({ day: tree.getAge(), action: { type: 'prune', branchId: prunedId } });
      tree.prune(prunedId);
      refreshAll();
      persistAsync({ type: 'prune', branchId: prunedId });
      return;
    }

    if (wireMode) {
      // Trunk (branchId 0) IS wireable (OQ-1, DECISIONS.md 2026-07-31).
      hitBranch = true;
      const clickedId = cell.branchId;
      if (selectedBranchId === clickedId) {
        // Clicking the already-selected branch toggles off (deselects).
        deselectWireBranch();
      } else {
        selectWireBranch(clickedId, tmpVec.clone());
      }
      return;
    }
  }

  // Wire mode: clicking empty space (no valid voxel hit) deselects.
  if (wireMode && !hitBranch) deselectWireBranch();
});
```

**CRITICAL NOTE on `tmpVec.clone()`:** `tmpVec` is a reused scratch vector. We must call
`.clone()` to capture its value before the next raycaster call mutates it.
The existing code does NOT clone because it returns immediately after using tmpVec.
In the wire path we store the position for the indicator, so clone is required.

#### 2j. Apply wire event listener

```typescript
btnWireApply.addEventListener('click', () => {
  if (selectedBranchId === null || !latestVoxels) return;

  const angleDelta = parseFloat(wireAngleInput.value);
  if (!Number.isFinite(angleDelta)) return; // guard against NaN from empty input

  const result = tree.wire(selectedBranchId, angleDelta);

  if (!result.ok) {
    // Surface the engine rejection in the hint bar. Do NOT call persistAsync.
    hintEl.textContent = `Wire failed: ${result.reason}`;
    return;
  }

  // result.ok === true guarantees oldAngle, newAngle, wireCost are populated.
  const appliedDelta = result.newAngle! - result.oldAngle!;

  // Push to localCareLog AFTER engine call so we have the post-clamp values.
  // (Unlike prune, which pushes before — wire requires WireResult fields.)
  localCareLog.push({
    day: tree.getAge(),
    action: {
      type: 'wire',
      branchId: selectedBranchId,
      angleDelta: appliedDelta,
      oldAngle: result.oldAngle!,
      newAngle: result.newAngle!,
      wireCost: result.wireCost!,
    },
  });

  refreshAll();

  persistAsync({
    type: 'wire',
    branchId: selectedBranchId,
    angleDelta: appliedDelta,
    oldAngle: result.oldAngle!,
    newAngle: result.newAngle!,
    wireCost: result.wireCost!,
  });

  // Update the controls to reflect the new wire state without deselecting.
  const branch = tree.getBranches()[selectedBranchId];
  wireBranchInfo.textContent =
    `Branch #${selectedBranchId} · wired · angle ${branch.angle.toFixed(1)}° · applied day ${branch.wireAppliedDay}`;
  btnWireRemove.style.display = '';
  wireAngleInput.value = '0';
  wireAngleLabel.textContent = '0°';
});
```

#### 2k. Remove wire event listener

```typescript
btnWireRemove.addEventListener('click', () => {
  if (selectedBranchId === null) return;

  // Verify the branch is still wired (guard against stale UI state).
  const branch = tree.getBranches()[selectedBranchId];
  if (!branch || !branch.wired) return;

  const branchIdToRemove = selectedBranchId;

  tree.removeWire(branchIdToRemove);

  localCareLog.push({
    day: tree.getAge(),
    action: { type: 'wire-remove', branchId: branchIdToRemove },
  });

  refreshAll();

  // ⚠️ KNOWN SERVER-SIDE BLOCKER (GAP-1):
  // 'wire-remove' is not in care-action ALLOWED_ACTION_TYPES.
  // The line below will produce a 400 from the server and the error will be
  // logged to console by persistAsync's .catch(). Local state IS updated;
  // server state is NOT. See Open Question OQ-WIRE-1 for resolution path.
  persistAsync({ type: 'wire-remove', branchId: branchIdToRemove });

  // Update controls: branch is now unwired, angle may have sprung back.
  const updatedBranch = tree.getBranches()[branchIdToRemove];
  wireBranchInfo.textContent =
    `Branch #${branchIdToRemove} · unwired · angle ${updatedBranch.angle.toFixed(1)}°`;
  btnWireRemove.style.display = 'none';
  wireAngleInput.value = '0';
  wireAngleLabel.textContent = '0°';
});
```

---

### 3. persistAsync call shapes — verified against care-action Edge Function

#### 3a. Wire apply

```typescript
persistAsync({
  type: 'wire',
  branchId: selectedBranchId,      // number — branch index
  angleDelta: appliedDelta,        // number — post-clamp delta (newAngle - oldAngle)
  oldAngle: result.oldAngle!,      // number — branch angle before wire
  newAngle: result.newAngle!,      // number — branch angle after wire (post-clamp)
  wireCost: result.wireCost!,      // number — 1 or 2 (thickness-tiered)
});
```

This matches `CareAction` shape for `'wire'` (shared/index.ts:193) and will pass the
`ALLOWED_ACTION_TYPES` check on the server (wire IS in the set).

The server will then check the 'wire' consumable. If the consumable record is missing
or quantity === 0, the server returns 400 and `persistAsync.catch(console.error)` logs it.
Local state remains updated; server log does not contain the action.
**This is the current behavior as specified — see OQ-WIRE-2 for resolution.**

#### 3b. Wire remove

```typescript
persistAsync({ type: 'wire-remove', branchId: branchIdToRemove });
```

This matches `CareAction` shape for `'wire-remove'` (shared/index.ts:197).
**However:** `'wire-remove'` is NOT in `ALLOWED_ACTION_TYPES` in care-action/index.ts.
The server will return `{ error: 'Invalid action type' }` (400).
`persistAsync.catch(console.error)` will log the error.
Wire remove IS applied locally; server log does NOT record it.
**See OQ-WIRE-1 (blocker) — must be resolved before wire-remove can be persisted.**

---

### 4. Branch selection — allowed behavior

**Re-wiring a wired branch:** WireEngine.wire() does NOT have an `'already-wired'`
guard. A wired branch CAN be re-wired (the prior wireSet is cleared, wireCount increments,
a new angleDelta is applied clamped to ±45°). The UI should allow this — do NOT add
a guard that prevents Apply when `branch.wired === true`.

**Selecting branches:**
- Any branch at any depth including trunk (branchId 0) is selectable in wire mode.
- Clicking the same branch again deselects it.
- Clicking empty space (no voxel hit) deselects.
- Clicking a different branch while one is already selected: selects the new branch
  immediately (replaces selection). No confirmation needed.
- Pruned branches: their voxels are excluded by the voxelizer. They cannot be clicked.
  The branchId will not appear in latestVoxels.voxels, so no guard needed.

**After `refreshAll()`:** The selectionIndicator persists across voxel rebuilds because
it is NOT in the `meshes` Map (which is cleared by `clearVoxels()`). It is a separate
`scene.add(mesh)` object. However, after refreshAll(), the indicator remains at the
pre-rebuild world position. This is acceptable — the branch's voxels will be in
approximately the same location (angle changes are relatively small). The branch info
text is updated immediately after Apply.

**Visual feedback:** The wireframe yellow sphere (`color: 0xffdd00, wireframe: true`)
at the clicked voxel's world position. No per-instance color override on InstancedMesh
is required — this approach avoids touching the instancing system entirely.

---

### 5. Mode cleanup

When `wireMode` is set to false (by any path):
1. `selectedBranchId = null`
2. `selectionIndicator.visible = false`
3. `wireControls.style.display = 'none'`
4. `wireAngleInput.value = '0'`
5. `wireAngleLabel.textContent = '0°'`
6. `controls.enableRotate = !(pruneMode || wireMode)` — re-enable orbit if prune is also off

Paths that deactivate wire mode:
- `wireBtn.click()` (wire → off): calls `deselectWireBranch()`, sets `controls.enableRotate = true`
- `pruneBtn.click()` (prune activates): calls `deselectWireBranch()`, wireMode=false, wireBtn.classList.remove('active')
- `btn-new.click()`: calls `deselectWireBranch()`, wireMode=false, wireBtn.classList.remove('active')

---

### 6. Consumable gate — specified behavior for Phase 1

**Decision needed from Jeremy: see OQ-WIRE-2.**

Until OQ-WIRE-2 is resolved, the spec follows the existing `persistAsync` pattern:

1. Local engine action applies immediately (optimistic).
2. `persistAsync` fires and forgets.
3. If server rejects (400 — no consumable), error is logged to console only.
4. No user-facing error message is shown for consumable failure.
5. No UI is blocked by consumable availability.

**Rationale for this interim behavior:**
- `prune` also uses `persistAsync` fire-and-forget with consumable check.
- `shears` consumable is also `live: false` in StoreModal.
- The existing prune UI has the same divergence risk for the same reason.
- The 3D debug page (`index3d.html`) is not the production player-facing UI.
  It is a developer/debug tool. Graceful consumable handling is a product feature,
  not a debug tool requirement.

**If Jeremy directs:** add a pre-flight check that fetches consumable quantity before
calling `tree.wire()`, and gates the Apply button. This requires a new API call pattern
(not fire-and-forget) and is a scope expansion beyond this spec.

---

### 7. Known limitations (for implementer awareness)

**L-1: wire-remove not persisted (BLOCKER for production).**
`'wire-remove'` must be added to `ALLOWED_ACTION_TYPES` in care-action/index.ts before
wire-remove can be server-persisted. This requires a server update and redeploy.
Spec recommendation: add 'wire-remove' to the set; no consumable is needed (it is a free action
per GDD §3.2 and shared/index.ts:195).

**L-2: applyCurrentDayEntries skips wire/wire-remove.**
If a wire is applied within the current game day and the user navigates away (or reloads),
the local cache will include the wire action but `applyCurrentDayEntries` will skip it.
The tree will appear at its pre-wire angle after reload until the server's care log is
replayed. Fix: add wire/wire-remove branches to `applyCurrentDayEntries` in persistence.ts.
This is a separate task — flag it but do not fix it here.

**L-3: Selection indicator does not track branch after angle change.**
After Apply, the branch's angle changes and its voxels shift in world space. The yellow
sphere stays at the original clicked position. It does not "follow" the branch.
This is acceptable for Phase 1 (the indicator is a tap target helper, not a live tracker).

**L-4: wireCount display.**
`branch.wireCount` tracks Cascade gate progression (unlock full 150° at wireCount >= 3).
The UI does not currently display wireCount. For Phase 1, the branch info line shows
only branchId, wired/unwired, and current angle. wireCount display deferred to Phase 2.

---

## OPEN QUESTIONS (requiring Jeremy's decision)

### OQ-WIRE-1 (BLOCKER — server): Add 'wire-remove' to ALLOWED_ACTION_TYPES

**File:** `apps/server/supabase/functions/care-action/index.ts`  
**Line 98:** `const ALLOWED_ACTION_TYPES = new Set(['water', 'prune', 'wire', 'fertilize', 'rotate']);`

**Required change:**
```typescript
const ALLOWED_ACTION_TYPES = new Set(['water', 'prune', 'wire', 'wire-remove', 'fertilize', 'rotate']);
```

`'wire-remove'` carries no consumable cost (CONSUMABLE map does not need updating — it
already has no entry for wire-remove, meaning no consumable is deducted — this is correct).

**Without this fix:** wire-remove actions apply locally but are silently rejected by the
server. On next reload from server, the wire is still present (never removed in server's
log). State diverges.

**Jeremy decision needed:** Approve adding 'wire-remove' to the whitelist and deploy
the updated care-action function. This can be done as a micro-task alongside or after
the wire UI implementation.

---

### OQ-WIRE-2 (BLOCKER for gameplay — consumable): Wire consumable gate behavior

**Context:** Wire is `live: false` in StoreModal. Players cannot purchase wire.
The care-action server will reject wire actions if the consumable row is missing or
quantity=0. The local engine applies the bend; the server rejects silently.

**Options:**

A. **Leave as-is (Phase 1 behavior).** Local-only wire. Console-only error.
   The 3D page is a debug/development tool; full consumable flow is a Phase 2 product feature.
   Acceptable for internal testing if testers have wire consumable rows provisioned in DB.

B. **Pre-provision wire consumables in DB for test wallets.**
   Insert a `consumables` row with `item_type='wire', quantity=99` for each test wallet.
   This unblocks server persistence without changing any code.
   Requires a DB migration or manual INSERT.

C. **Set `wire: live: true` in StoreModal.** Opens wire purchase flow.
   Requires pricing/RON payment architecture to be tested.

D. **Block Apply button until consumable is confirmed available.**
   Add an async consumable-count fetch before enabling Apply.
   Requires new API call pattern; larger scope.

**Recommendation:** Option B (DB-level provision for test wallets) unblocks the full
wire UI test without code scope expansion. Option A is also acceptable if the debug
tool use case is the only near-term target.

---

### OQ-WIRE-3 (UX): Angle input — slider only vs slider + number input?

**Current spec:** slider only (`<input type="range" min="-45" max="45">`).
Range sliders are coarse on desktop (1-degree precision, which is fine for wire).

**Alternative:** Add a companion `<input type="number" min="-45" max="45">` synced to
the slider for exact value entry. Adds ~5 lines of JS (sync listeners). Useful for
precision sculpting (e.g., exactly +30° for a Kengai branch).

**Jeremy decision:** Slider-only is sufficient for Phase 1? Or add number input now?

---

### OQ-WIRE-4 (UX): Angle input default value — 0 or last-used?

**Current spec:** slider resets to 0 after each Apply (and on each branch selection).

**Alternative:** Remember the last-used angleDelta in a `let lastWireAngle = 0` variable
and pre-populate the slider on each new branch selection.
Useful if the player is wiring many branches to the same angle (e.g., all depth-1
branches to +30° for Kengai).

**Jeremy decision:** Reset to 0 (cleaner, less surprising) or remember last-used?

---

## GATE TESTS (Implementer must pass all before marking IMPL complete)

The implementer runs these as manual browser tests. No test script required.

| Gate | Description | Pass condition |
|---|---|---|
| WIRE-UI-W1 | Wire button activates mode | Click Wire… → `btn-wire` gets `active` class, wireMode===true, hint updated, orbit disabled |
| WIRE-UI-W2 | Wire button deactivates mode | Click Wire… again → `btn-wire` loses `active` class, wireMode===false, hint restored, orbit enabled |
| WIRE-UI-W3 | Wire + prune mutual exclusion | Activate prune, then click Wire… → prune deactivates (`btn-prune` loses `active`), wire activates |
| WIRE-UI-W4 | Prune + wire mutual exclusion | Activate wire, then click Prune… → wire deactivates (`btn-wire` loses `active`), prune activates |
| WIRE-UI-W5 | Branch voxel selection | In wire mode, click a branch voxel → yellow sphere visible at click point, wire-controls div visible, branch info shows branchId and angle |
| WIRE-UI-W6 | Trunk selection allowed | In wire mode, click a trunk voxel (branchId 0) → selected (same UI as W5); not blocked |
| WIRE-UI-W7 | Deselect: re-click same branch | Click the already-selected branch → sphere hides, wire-controls hides, selectedBranchId===null |
| WIRE-UI-W8 | Deselect: click empty space | Click canvas where no voxel is hit → deselects |
| WIRE-UI-W9 | Slider live label | Move slider → `wire-angle-label` updates in real time matching slider value with ° suffix |
| WIRE-UI-W10 | Apply wire — success | Select branch, move slider to +20, click Apply → WireEngine called, branch angle changes by ~20°, voxels rebuild, branch info updates to "wired", Remove button visible |
| WIRE-UI-W11 | Apply wire — thick branch rejection | Select a branch with thickness > 3.0, click Apply → hintEl shows "Wire failed: too-thick", no persistAsync fired |
| WIRE-UI-W12 | Apply wire — localCareLog entry | After W10, `localCareLog` last entry has type:'wire', correct branchId, oldAngle, newAngle, wireCost |
| WIRE-UI-W13 | Apply wire — persistAsync called | After W10, network inspector shows POST to care-action with action.type='wire' and correct fields |
| WIRE-UI-W14 | Re-wire already-wired branch | After W10, apply wire again (still selected) → succeeds (no 'already-wired' rejection), wireCount increments |
| WIRE-UI-W15 | Remove wire | Select a wired branch → Remove button visible; click Remove → branch springs back or sets, Remove button hides, voxels rebuild |
| WIRE-UI-W16 | Remove wire — unwired branch | Select an unwired branch → Remove button NOT visible |
| WIRE-UI-W17 | Mode cleanup on deactivate | Activate wire, select branch, deactivate wire (click Wire…) → indicator hides, controls hide, orbit enabled |
| WIRE-UI-W18 | btn-new resets wire state | With wire mode active, click New tree → wire mode off, no selection indicator, controls hidden |
| WIRE-UI-W19 | TypeScript compiles clean | `npx tsc --noEmit` from `apps/web` exits 0 after changes |

---

## ASSUMPTIONS

1. **`selectionIndicator` sphere radius 2.5:** Chosen to be visible but not overwhelming.
   Adjust if it obscures too many voxels at close zoom. (Mitigation: change radius constant.)

2. **No consumable count pre-fetch:** Spec assumes fire-and-forget is acceptable for Phase 1
   (same pattern as prune). If OQ-WIRE-2 resolves to option D, this assumption is invalidated.

3. **Branch info text format is English only:** Internationalization is not in scope.

4. **`tmpVec.clone()` is available:** `THREE.Vector3.clone()` is a standard Three.js method.
   The existing code does not use `.clone()` in the raycaster handler, but tmpVec is a
   `THREE.Vector3` instance and `.clone()` is confirmed in the Three.js r128 API.

5. **`wireBtn` is accessible in the `pruneBtn` click handler:** Both are defined as `const`
   at module level before the event listener block. The `wireBtn` reference declared at
   §2f will be accessible in the `pruneBtn` listener at §2g, provided §2f code is placed
   BEFORE the existing pruneBtn listener in the file. Implementer must maintain this order.

---

## APPENDIX: Quick-reference constants (verified)

| Constant | Value | File | Purpose in UI |
|---|---|---|---|
| `WIRE_MAX_ANGLE_DELTA` | 45 | WireEngine.ts:27 | Slider range `-45` to `+45` |
| `WIRE_MAX_THICKNESS` | 3.0 | WireEngine.ts:29 | Error case: 'too-thick' |
| `WIRE_COST_T1_MAX` | 1.5 | WireEngine.ts:30 | thickness ≤ 1.5 → wireCost=1; else wireCost=2 |
| `POLAR_MIN_DEG` | 5.7296 (0.1 rad) | WireEngine.ts:33 | Minimum angle the engine clamps to |
| `POLAR_MAX_DEG` | 150 (cascadeGate) | WireEngine.ts:34 | Max at wireCount ≥ 3; else 120° |
| `HAN_KENGAI_GATE_DEG` | 120 | WireEngine.ts:80 | Cascade limit before 3rd wire application |

---

*Spec complete. No source file changes — spec doc only. Pipeline: Architect → Critic → Implementer → Auditor → Linter.*
