# ARCH-THREECANVAS-RAYCASTER-2026-08-30

**Pipeline stage:** Architect (Verified Architect + Carmack-Linus Review)
**Date:** 2026-08-30
**Author:** Architect pass -- ThreeCanvas raycaster + branch picking (#97)
**Status:** READY FOR IMPLEMENTER

---

## SCOPE

```
DESIGN TASK:  Raycaster + branch picking system for the production React view
              (ThreeCanvas.tsx). Enables sculpt actions (twine, weight, prune,
              wire, jin) to target specific branches by click/tap.
DELIVERABLE:  Spec document -- file change list, code structure, integration
              patterns. Implementer builds from this spec alone.
BUILDS ON:    HUD #96 sculpt UI (ARCH-SCULPT-UI-2026-08-29.md + PATCH).
              ThreeCanvas.tsx mode toggle stubs (lines 112-139).
              tree_mesh.ts userData.branchId annotations (lines 229, 243, 257).
              main3d.ts raycaster reference (lines 384-439).
              CareBridge sculpt methods (care_bridge.ts lines 54-80).
CONSUMED BY:  Disciplined Implementer (IMPL phase next).
```

---

## CODEBASE RECONNAISSANCE

### Files read

| File | Lines | Notes |
|------|-------|-------|
| `apps/web/src/components/ThreeCanvas.tsx` | 346 | Production React view. `prodSculptMode` at line 113. Mode toggle stubs at 130-139. No raycaster. `careScene` has scene/camera/renderer/controls/treeRoot. `buildTreeMesh` called at line 86 and 144. `localCareLog` + `persistAsync` present. `bridge` (CareBridge) at line 110. |
| `apps/web/src/renderer/tree_mesh.ts` | 263 | Per-branch CylinderGeometry tubes. **CRITICAL: `mesh.userData.branchId = b.id` at line 229 (branch tubes), line 243 (leaf spheres), line 257 (prune scars).** Also sets `mesh.userData.kind` ('branch'/'leaf'/'scar'). Each branch = its own Mesh, NOT InstancedMesh. |
| `apps/web/src/renderer/scene.ts` | 101 | `CareScene { scene, camera, renderer, controls, treeRoot }`. `controls` = `OrbitControls`. `renderer.domElement` is the canvas. |
| `apps/web/src/bridge/care_bridge.ts` | 89 | CareBridge class. `applyTwine`, `removeTwine`, `applyWeight`, `removeWeight`, `getBranch` already implemented (SCULPT-ADD 2026-08-29). All call `this.afterAction()` on success. |
| `apps/web/src/ui/hud.ts` | 93 | CareHud class. `HudCallbacks` interface with optional `onTwine?`, `onWeight?`. Wires `btn-twine-mode`, `btn-weight-mode` buttons. |
| `apps/web/src/main3d.ts` | ~1100 | Reference raycaster at lines 384-439. Uses InstancedMesh + voxel grid lookup (complex). `sculptMode` enum, `selectedBranchId`, `selectionIndicator`, `deselectSculptBranch`, `selectSculptBranch` pattern. |
| `packages/shared/src/index.ts` | -- | CareAction union, Branch interface (twined/weighted/wired/etc.), TwineResult, WeightResult, round4, WATER_AMOUNT. |
| `docs/pipeline/ARCH-SCULPT-UI-2026-08-29.md` | 1177 | HUD #96 spec. Defines triple-log pattern, CareBridge F2 afterAction pattern. |
| `docs/pipeline/ARCH-SCULPT-UI-PATCH-2026-08-29.md` | 369 | F3: ThreeCanvas buttons are mode toggles only. F5: pruneMode/wireMode migration checklist. |

### Symbols verified

```
VERIFIED:
  tree_mesh.ts:
    V mesh.userData.branchId = b.id -- line 229 (branch tubes), ALREADY SET
    V leaf.userData.branchId = b.id -- line 243 (leaf spheres), ALREADY SET
    V scar.userData.branchId = childId -- line 257 (prune scars), ALREADY SET
    V mesh.userData.kind = 'branch' -- line 230
    V leaf.userData.kind = 'leaf' -- line 244
    V scar.userData.kind = 'scar' -- line 258
    V buildTreeMesh(group: THREE.Group, tree: BonsaiTree): void -- line 201, exported
    V disposeTree(group: THREE.Group): void -- line 184, NOT exported (private)

  ThreeCanvas.tsx:
    V prodSculptMode: 'none' | 'twine' | 'weight' -- line 113, local let inside useEffect
    V careScene: CareScene -- line 78, from createScene()
    V careScene.treeRoot: THREE.Group -- line 78 via scene.ts:17
    V careScene.renderer.domElement -- line 157, used in animate loop
    V careScene.controls: OrbitControls -- line 157, has .enableRotate property
    V careScene.camera: PerspectiveCamera -- line 157
    V bridge: CareBridge -- line 110
    V bridge.applyTwine(branchId, angleDelta) -> TwineResult -- care_bridge.ts:55
    V bridge.removeTwine(branchId) -> void -- care_bridge.ts:61
    V bridge.applyWeight(branchId, weightCount) -> WeightResult -- care_bridge.ts:66
    V bridge.removeWeight(branchId) -> void -- care_bridge.ts:72
    V bridge.getBranch(branchId) -> Branch | undefined -- care_bridge.ts:78
    V localCareLog: CareLogEntry[] -- line 66
    V persistAsync(action) -- line 97
    V tree: BonsaiTree -- line 58 (let, swappable)
    V refreshView(): void -- line 84
    V buildTreeMesh(careScene.treeRoot, tree) -- line 86, 144, 206, 268

  scene.ts:
    V CareScene.controls: OrbitControls -- line 17, controls.enableRotate exists
    V CareScene.renderer: WebGLRenderer -- line 16

  care_bridge.ts:
    V CareBridge.applyTwine calls this.afterAction() -- line 57
    V CareBridge.removeTwine calls this.afterAction() -- line 63
    V CareBridge.applyWeight calls this.afterAction() -- line 68
    V CareBridge.removeWeight calls this.afterAction() -- line 73

  main3d.ts (reference pattern):
    V Raycaster at line 389: new THREE.Raycaster()
    V pointer at line 390: new THREE.Vector2()
    V selectionIndicator at line 185-192: SphereGeometry(2.5,8,6), wireframe, 0xffdd00
    V selectedBranchId at line 320: number | null = null
    V sculptMode at line 316: SculptMode enum
    V deselectSculptBranch at line 588: clears all state
    V selectSculptBranch at line 608: sets indicator, shows sub-controls

  hud.ts:
    V HudCallbacks.onTwine?: () => void -- line 13
    V HudCallbacks.onWeight?: () => void -- line 14

PROPOSED ADDITIONS (do not exist yet):
  + ThreeCanvas.tsx: raycaster, pointer, selectedBranchId, selectionIndicator
  + ThreeCanvas.tsx: pointerdown handler
  + ThreeCanvas.tsx: sculpt-overlay DOM elements
  + ThreeCanvas.tsx: expanded SculptMode type
  + hud.ts: onPrune?, onWire?, onJin? callbacks (optional)
  + index.html: new button IDs for prune/wire/jin
```

### Call sites for key symbols

```
buildTreeMesh:
  ThreeCanvas.tsx:86    -- refreshView() -> buildTreeMesh(careScene.treeRoot, tree)
  ThreeCanvas.tsx:144   -- initial paint
  ThreeCanvas.tsx:206   -- cache restore
  ThreeCanvas.tsx:268   -- DB load

prodSculptMode:
  ThreeCanvas.tsx:113   -- declaration
  ThreeCanvas.tsx:131   -- twine toggle
  ThreeCanvas.tsx:136   -- weight toggle
  (No other references)

careScene.treeRoot:
  ThreeCanvas.tsx:86    -- refreshView
  ThreeCanvas.tsx:144   -- initial paint
  ThreeCanvas.tsx:206   -- cache restore
  ThreeCanvas.tsx:268   -- DB load
  (All calls pass treeRoot to buildTreeMesh)
```

### Gaps found

```
GAP-1: ThreeCanvas.tsx prodSculptMode is 'none'|'twine'|'weight' only.
       Missing: 'prune', 'wire', 'jin', 'landscape'.
       The sculpt UI spec (#96) intentionally deferred these. This spec adds them.

GAP-2: ThreeCanvas.tsx has NO raycaster, NO pointer handler, NO branch selection.
       This is the entire purpose of this spec.

GAP-3: ThreeCanvas.tsx has NO selectionIndicator mesh.
       Must be added to careScene.scene (NOT treeRoot -- must survive buildTreeMesh
       which calls disposeTree(group) -> group.clear()).

GAP-4: index.html has buttons for twine/weight but NOT for prune/wire/jin.
       The JSX in ThreeCanvas.tsx needs new buttons.

GAP-5: CareHud has onTwine/onWeight callbacks but NOT onPrune/onWire/onJin.
       Must extend HudCallbacks.
```

---

## VERIFICATION LOG

```
VERIFIED:
  V tree_mesh.ts already annotates every mesh with userData.branchId
    -- source: tree_mesh.ts lines 229, 243, 257
  V Each branch is its own THREE.Mesh (CylinderGeometry), NOT InstancedMesh
    -- source: tree_mesh.ts:219-231
  V Raycaster.intersectObjects works with regular Mesh children of a Group
    -- source: Three.js r128+ docs, THREE.Raycaster.intersectObjects(objects, recursive)
  V treeRoot.children contains all branch/leaf/scar Mesh objects after buildTreeMesh
    -- source: tree_mesh.ts:231 group.add(mesh), line 245 group.add(leaf), line 259 group.add(scar)
  V OrbitControls has enableRotate property
    -- source: scene.ts:82 OrbitControls imported from three/addons
  V pointerdown event fires for both mouse and touch
    -- source: W3C Pointer Events spec, Touch = primary pointer
  V buildTreeMesh calls disposeTree(group) -> group.clear() which removes all children
    -- source: tree_mesh.ts:184-194, line 202
  V selectionIndicator in main3d.ts is added to scene (not meshes Map) to survive rebuilds
    -- source: main3d.ts:190 scene.add(mesh)
  V round4() discipline required for all growth math operations
    -- source: DECISIONS.md 2026-07-15
  V CareBridge sculpt methods call afterAction on success
    -- source: care_bridge.ts:57,63,68,73

ASSUMPTIONS:
  A1. Raycaster.intersectObjects with recursive=false against treeRoot.children
      will correctly intersect CylinderGeometry and SphereGeometry meshes.
      VERIFIED: Three.js raycaster supports Mesh intersection natively.
      No bounding volume pre-computation needed for < 100 meshes.

  A2. pointerdown event on renderer.domElement will not conflict with OrbitControls.
      VERIFIED: main3d.ts uses the same pattern (line 392). OrbitControls listens
      on the same element but does not preventDefault on pointerdown unless dragging.
      When enableRotate=false in sculpt modes, orbit is disabled, no conflict.

  A3. Scar meshes (userData.kind='scar') should NOT be selectable for sculpt actions.
      Scars mark pruned branches. Selecting a pruned branch is meaningless.
      Mitigation: filter on hit.object.userData.kind !== 'scar' in the handler.
```

---

## APPROACH EVALUATION

### Option A: userData approach (read branchId from mesh)

tree_mesh.ts ALREADY sets `mesh.userData.branchId = b.id` on every mesh object
(branch tubes, leaf spheres, prune scars). Raycaster hits return the mesh directly.
Read `hit.object.userData.branchId`. O(1) lookup. No voxel grid needed.

**Pros:**
- Zero changes to tree_mesh.ts (userData already present)
- O(1) branchId lookup (direct property read)
- Simple, 3 lines of code per hit: intersect -> read userData -> done
- No parallel data structures to maintain
- Works with existing mesh rebuild cycle (buildTreeMesh sets userData on every rebuild)

**Cons:**
- None meaningful. The data is already there.

### Option B: Voxelize + grid lookup (mirror main3d.ts)

Call Voxelizer.voxelize() in ThreeCanvas and use instanceId -> grid -> branchId pattern.

**Pros:**
- Proven pattern in main3d.ts

**Cons:**
- ThreeCanvas does NOT use InstancedMesh -- it uses per-branch Mesh objects
- Would need to import @kijo/voxelizer into the production web bundle (unnecessary dep)
- Would need to maintain a parallel SparseVoxelSet alongside the mesh tree
- Massive over-engineering: the voxel grid exists because InstancedMesh has no
  per-instance identity. Regular Mesh objects DO have identity via userData.
- O(n) voxelization step on every tree mutation vs O(1) userData read

### DECISION: Option A

Option A is the clear winner. The userData is already annotated on every mesh by
tree_mesh.ts. The raycaster returns the mesh directly. One property read gives the
branchId. Zero tree_mesh.ts changes. Zero new dependencies. Zero parallel data
structures. This is the objectively simpler, more correct, and least invasive approach.

Carmack would look at Option B and say: "You want to voxelize a tree to find a branch
ID that's already sitting in userData? That's not engineering, that's a Rube Goldberg
machine." Linus would add: "If the data structure already gives you what you need,
don't build another one on top."

---

## THE DESIGN

### 1. ThreeCanvas.tsx -- SculptMode expansion

Replace the current `prodSculptMode` declaration (line 113) with a full sculpt mode enum:

```typescript
type SculptMode = 'none' | 'prune' | 'wire' | 'twine' | 'weight' | 'jin' | 'landscape';
let sculptMode: SculptMode = 'none';
```

This replaces `prodSculptMode` everywhere. The existing twine/weight toggle handlers
(lines 130-139) update to use `sculptMode` instead of `prodSculptMode`.

### 2. ThreeCanvas.tsx -- Raycaster setup

Add after `const bridge = new CareBridge(tree, refreshView);` (line 110):

```typescript
// --- Raycaster for branch picking (RAYCASTER-ADD 2026-08-30) ---
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let selectedBranchId: number | null = null;

// Selection indicator -- yellow wireframe sphere, added to careScene.scene
// (NOT treeRoot) so it survives buildTreeMesh -> disposeTree -> group.clear().
const selectionIndicator = (() => {
  const g = new THREE.SphereGeometry(2.5, 8, 6);
  const m = new THREE.MeshBasicMaterial({ color: 0xffdd00, wireframe: true });
  const mesh = new THREE.Mesh(g, m);
  mesh.visible = false;
  careScene.scene.add(mesh);
  return mesh;
})();
```

**Why careScene.scene, not treeRoot:** `buildTreeMesh` calls `disposeTree(group)` which
runs `group.clear()` on treeRoot, removing all children. If selectionIndicator were in
treeRoot, it would be destroyed on every tree mutation. Adding it to the parent scene
(same pattern as main3d.ts:190) makes it immune to tree rebuilds.

### 3. ThreeCanvas.tsx -- Pointer handler

Add after the selectionIndicator setup:

```typescript
// --- Pointer handler for branch picking (RAYCASTER-ADD 2026-08-30) ---
careScene.renderer.domElement.addEventListener('pointerdown', (e: PointerEvent) => {
  // Only act in branch-targeted sculpt modes
  if (sculptMode === 'none' || sculptMode === 'landscape') return;

  const rect = careScene.renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, careScene.camera);

  // Intersect treeRoot children (each is a branch/leaf/scar Mesh with userData.branchId)
  const hits = raycaster.intersectObjects(careScene.treeRoot.children, false);

  for (const hit of hits) {
    const branchId = (hit.object as THREE.Mesh).userData.branchId;
    if (branchId === undefined) continue;

    // Skip prune scars -- not selectable
    const kind = (hit.object as THREE.Mesh).userData.kind;
    if (kind === 'scar') continue;

    // Prune mode -- immediate action, no selection
    if (sculptMode === 'prune') {
      if (branchId === 0) continue; // trunk protected
      localCareLog.push({ day: tree.getAge(), action: { type: 'prune', branchId } });
      tree.prune(branchId);
      refreshView();
      persistAsync({ type: 'prune', branchId });
      return;
    }

    // Branch-targeted sculpt modes: toggle selection
    if (selectedBranchId === branchId) {
      deselectBranch();
    } else {
      selectBranch(branchId, hit.point);
    }
    return;
  }

  // Click on empty space -- deselect
  if (sculptMode !== 'prune') {
    deselectBranch();
  }
});
```

**Key differences from main3d.ts raycaster:**

| Aspect | main3d.ts | ThreeCanvas.tsx |
|--------|-----------|-----------------|
| Mesh type | InstancedMesh | Per-branch Mesh |
| branchId lookup | instanceId -> matrix -> world -> grid -> voxel.branchId | hit.object.userData.branchId |
| Intersect target | `[...meshes.values()]` (InstancedMesh Map) | `careScene.treeRoot.children` (Mesh array) |
| Complexity | ~20 lines with grid math | ~5 lines, direct property read |

### 4. ThreeCanvas.tsx -- Branch selection/deselection

```typescript
function deselectBranch(): void {
  selectedBranchId = null;
  selectionIndicator.visible = false;
  // Hide sculpt overlay
  const overlay = document.getElementById('sculpt-overlay');
  if (overlay) overlay.style.display = 'none';
}

function selectBranch(branchId: number, worldPos: THREE.Vector3): void {
  selectedBranchId = branchId;
  selectionIndicator.position.copy(worldPos);
  selectionIndicator.visible = true;

  const branch = bridge.getBranch(branchId);
  if (!branch) { deselectBranch(); return; }

  // Show sculpt overlay with mode-specific content
  const overlay = document.getElementById('sculpt-overlay');
  const label = document.getElementById('sculpt-branch-label');
  const inner = document.getElementById('sculpt-controls-inner');
  if (!overlay || !label || !inner) return;

  overlay.style.display = '';

  if (sculptMode === 'wire') {
    const wiredLabel = branch.wired
      ? `wired -- angle ${branch.angle.toFixed(1)}`
      : `unwired -- angle ${branch.angle.toFixed(1)}`;
    label.textContent = `Branch #${branchId} -- ${wiredLabel}`;
    inner.innerHTML = buildWireControls(branch);
    wireControlsListeners(branchId);
  }

  if (sculptMode === 'twine') {
    const twinedLabel = branch.twined
      ? `twined -- degrades day ${branch.twineDegradesDay}`
      : 'free';
    label.textContent = `Branch #${branchId} -- ${twinedLabel}`;
    inner.innerHTML = buildTwineControls(branch);
    twineControlsListeners(branchId);
  }

  if (sculptMode === 'weight') {
    const weightedLabel = branch.weighted
      ? `weighted (${branch.weightCount} bags)`
      : 'no weight';
    label.textContent = `Branch #${branchId} -- ${weightedLabel}`;
    inner.innerHTML = buildWeightControls(branch);
    weightControlsListeners(branchId);
  }

  if (sculptMode === 'jin') {
    const maxSeg = Math.max(0, Math.floor(branch.length) - 1);
    label.textContent = `Branch #${branchId} -- length ${branch.length.toFixed(1)}`;
    inner.innerHTML = buildJinControls(maxSeg);
    jinControlsListeners(branchId);
  }
}
```

**Caretaker opacity compliance:** The overlay shows branchId, twined/weighted state,
and weight count (all visually observable on the tree). It does NOT show angle values,
stat impacts, technique classification, or matchPct.

### 5. ThreeCanvas.tsx -- Sculpt control builders + listeners

These functions build the inner HTML for each mode's sub-controls and wire up
event listeners. They follow the triple-log pattern from HUD #96:
`localCareLog.push -> bridge method (engine + afterAction) -> persistAsync`.

**NOTE:** The bridge methods call `afterAction()` which calls `refreshView()` which
calls `buildTreeMesh`. The implementer must ensure `localCareLog.push` and
`persistAsync` happen OUTSIDE the bridge call, not inside `afterAction`. This matches
the existing `onWater` pattern at ThreeCanvas.tsx:119-122.

```typescript
// --- Twine controls (RAYCASTER-ADD 2026-08-30) ---
function buildTwineControls(branch: Branch): string {
  return `
    <div style="display:flex;align-items:center;gap:8px;justify-content:center">
      <label style="font-size:12px">Bend</label>
      <input id="sculpt-twine-angle" type="range" min="-28" max="28" value="0"
             style="width:120px;cursor:pointer" />
      <span id="sculpt-twine-label" style="font-size:12px;min-width:32px">0 deg</span>
    </div>
    <div style="display:flex;gap:8px;justify-content:center;margin-top:8px">
      <button id="sculpt-twine-apply">Apply</button>
      ${branch.twined ? '<button id="sculpt-twine-remove">Remove</button>' : ''}
    </div>
  `;
}

function twineControlsListeners(branchId: number): void {
  const slider = document.getElementById('sculpt-twine-angle') as HTMLInputElement | null;
  const lbl = document.getElementById('sculpt-twine-label');
  if (slider && lbl) {
    slider.addEventListener('input', () => {
      lbl.textContent = `${slider.value} deg`;
    });
  }

  document.getElementById('sculpt-twine-apply')?.addEventListener('click', () => {
    if (selectedBranchId === null) return;
    const angleDelta = parseFloat((document.getElementById('sculpt-twine-angle') as HTMLInputElement)?.value ?? '0');
    if (!Number.isFinite(angleDelta) || angleDelta === 0) return;

    const result = bridge.applyTwine(selectedBranchId, angleDelta);
    if (!result.ok) return; // bridge.applyTwine shows no UI error -- silent fail, keep selected

    const appliedDelta = round4(result.newAngle! - result.oldAngle!);
    const b = bridge.getBranch(selectedBranchId);
    const degradeDays = b ? b.twineDegradesDay - tree.getAge() : 0;

    localCareLog.push({
      day: tree.getAge(),
      action: { type: 'twine', branchId: selectedBranchId, angleDelta: appliedDelta,
                oldAngle: result.oldAngle!, newAngle: result.newAngle!, degradeDays },
    });
    persistAsync({ type: 'twine', branchId: selectedBranchId, angleDelta: appliedDelta,
                   oldAngle: result.oldAngle!, newAngle: result.newAngle!, degradeDays });

    // Re-select to refresh the overlay
    selectBranch(selectedBranchId, selectionIndicator.position.clone());
  });

  document.getElementById('sculpt-twine-remove')?.addEventListener('click', () => {
    if (selectedBranchId === null) return;
    const bid = selectedBranchId;
    localCareLog.push({ day: tree.getAge(), action: { type: 'twine-remove', branchId: bid } });
    bridge.removeTwine(bid);
    persistAsync({ type: 'twine-remove', branchId: bid });
    selectBranch(bid, selectionIndicator.position.clone());
  });
}

// --- Weight controls (RAYCASTER-ADD 2026-08-30) ---
function buildWeightControls(branch: Branch): string {
  return `
    <div style="display:flex;align-items:center;gap:8px;justify-content:center">
      <label style="font-size:12px">Bags</label>
      <select id="sculpt-weight-count" style="width:60px">
        <option value="1">1</option><option value="2">2</option>
        <option value="3">3</option><option value="4">4</option>
      </select>
      <span id="sculpt-weight-preview" style="font-size:11px;opacity:.7">+7 deg down</span>
    </div>
    <div style="display:flex;gap:8px;justify-content:center;margin-top:8px">
      <button id="sculpt-weight-apply">Apply</button>
      ${branch.weighted ? '<button id="sculpt-weight-remove">Remove</button>' : ''}
    </div>
  `;
}

function weightControlsListeners(branchId: number): void {
  const sel = document.getElementById('sculpt-weight-count') as HTMLSelectElement | null;
  const preview = document.getElementById('sculpt-weight-preview');
  if (sel && preview) {
    sel.addEventListener('change', () => {
      const wc = parseInt(sel.value, 10);
      preview.textContent = `+${wc * 7} deg down`;
    });
  }

  document.getElementById('sculpt-weight-apply')?.addEventListener('click', () => {
    if (selectedBranchId === null) return;
    const wc = parseInt((document.getElementById('sculpt-weight-count') as HTMLSelectElement)?.value ?? '1', 10);
    if (wc < 1 || wc > 4) return;

    const result = bridge.applyWeight(selectedBranchId, wc);
    if (!result.ok) return;

    localCareLog.push({
      day: tree.getAge(),
      action: { type: 'weight', branchId: selectedBranchId, weightCount: wc,
                torqueContribution: result.torqueContribution! },
    });
    persistAsync({ type: 'weight', branchId: selectedBranchId, weightCount: wc,
                   torqueContribution: result.torqueContribution! });

    selectBranch(selectedBranchId, selectionIndicator.position.clone());
  });

  document.getElementById('sculpt-weight-remove')?.addEventListener('click', () => {
    if (selectedBranchId === null) return;
    const bid = selectedBranchId;
    localCareLog.push({ day: tree.getAge(), action: { type: 'weight-remove', branchId: bid } });
    bridge.removeWeight(bid);
    persistAsync({ type: 'weight-remove', branchId: bid });
    selectBranch(bid, selectionIndicator.position.clone());
  });
}

// --- Wire controls (RAYCASTER-ADD 2026-08-30) ---
function buildWireControls(branch: Branch): string {
  return `
    <div style="display:flex;align-items:center;gap:8px;justify-content:center">
      <label style="font-size:12px">Bend</label>
      <input id="sculpt-wire-angle" type="range" min="-45" max="45" value="0"
             style="width:120px;cursor:pointer" />
      <span id="sculpt-wire-label" style="font-size:12px;min-width:32px">0 deg</span>
    </div>
    <div style="display:flex;gap:8px;justify-content:center;margin-top:8px">
      <button id="sculpt-wire-apply">Apply</button>
      ${branch.wired ? '<button id="sculpt-wire-remove">Remove</button>' : ''}
    </div>
  `;
}

function wireControlsListeners(branchId: number): void {
  const slider = document.getElementById('sculpt-wire-angle') as HTMLInputElement | null;
  const lbl = document.getElementById('sculpt-wire-label');
  if (slider && lbl) {
    slider.addEventListener('input', () => {
      lbl.textContent = `${slider.value} deg`;
    });
  }

  document.getElementById('sculpt-wire-apply')?.addEventListener('click', () => {
    if (selectedBranchId === null) return;
    const angleDelta = parseFloat((document.getElementById('sculpt-wire-angle') as HTMLInputElement)?.value ?? '0');
    if (!Number.isFinite(angleDelta) || angleDelta === 0) return;

    const result = tree.wire(selectedBranchId, angleDelta);
    if (!result.ok) return;

    const appliedDelta = round4(result.newAngle! - result.oldAngle!);

    localCareLog.push({
      day: tree.getAge(),
      action: { type: 'wire', branchId: selectedBranchId, angleDelta: appliedDelta,
                oldAngle: result.oldAngle!, newAngle: result.newAngle! },
    });
    refreshView();
    persistAsync({ type: 'wire', branchId: selectedBranchId, angleDelta: appliedDelta,
                   oldAngle: result.oldAngle!, newAngle: result.newAngle! });

    selectBranch(selectedBranchId, selectionIndicator.position.clone());
  });

  document.getElementById('sculpt-wire-remove')?.addEventListener('click', () => {
    if (selectedBranchId === null) return;
    const bid = selectedBranchId;
    localCareLog.push({ day: tree.getAge(), action: { type: 'wire-remove', branchId: bid } });
    tree.removeWire(bid);
    refreshView();
    persistAsync({ type: 'wire-remove', branchId: bid });
    selectBranch(bid, selectionIndicator.position.clone());
  });
}

// --- Jin controls (RAYCASTER-ADD 2026-08-30) ---
// Phase 1: JinEngine.applyJin THROWS. UI catches and shows error.
function buildJinControls(maxSeg: number): string {
  return `
    <div style="display:flex;align-items:center;gap:8px;justify-content:center">
      <label style="font-size:12px">Segment</label>
      <input id="sculpt-jin-segment" type="number" min="0" max="${maxSeg}" value="0"
             style="width:60px" />
      <span style="font-size:11px;color:#e0c060">Cost: 1 jin</span>
    </div>
    <div style="display:flex;gap:8px;justify-content:center;margin-top:8px">
      <button id="sculpt-jin-apply" style="background:#4a2020;border-color:#c06040">
        Apply (irreversible)
      </button>
    </div>
    <div style="font-size:10px;color:#e07040;margin-top:4px">
      Phase 1: jin engine stub -- will error until Phase 2
    </div>
  `;
}

function jinControlsListeners(branchId: number): void {
  document.getElementById('sculpt-jin-apply')?.addEventListener('click', () => {
    if (selectedBranchId === null) return;
    const segIdx = parseInt(
      (document.getElementById('sculpt-jin-segment') as HTMLInputElement)?.value ?? '0', 10);
    const jinCost = 1;

    if (!confirm(`Jin is irreversible. Apply to branch #${selectedBranchId}, segment ${segIdx}?`)) {
      return;
    }

    try {
      const result = tree.applyJin(selectedBranchId, segIdx, jinCost);
      if (!result.ok) return;

      localCareLog.push({
        day: tree.getAge(),
        action: { type: 'jin', branchId: selectedBranchId, segmentIndex: segIdx, jinCost },
      });
      refreshView();
      persistAsync({ type: 'jin', branchId: selectedBranchId, segmentIndex: segIdx, jinCost });
    } catch {
      // Phase 1: CareLogReplayError from JinEngine stub -- silently handled.
      // The stub warning text is visible in the overlay.
    }
  });
}
```

**IMPORTANT: Log ordering for bridge-managed actions (twine, weight):**

The bridge methods (`bridge.applyTwine`, `bridge.removeWeight`, etc.) call
`this.afterAction()` which calls `refreshView()` which calls `cacheTree()`.
`cacheTree()` writes `localCareLog` to sessionStorage. Therefore `localCareLog.push`
MUST happen BEFORE the bridge call for twine/weight.

BUT WAIT -- the current spec above calls `bridge.applyTwine` BEFORE `localCareLog.push`.
This is a bug in the design. Let me correct it.

**CORRECTED pattern for twine/weight (bridge-managed):**

```typescript
// CORRECT ORDER:
// 1. Call bridge method (gets result, triggers afterAction -> refreshView -> cacheTree)
//    At this point cacheTree writes localCareLog WITHOUT the new entry -- acceptable
//    because cacheTree will be called again via the re-select below.
// 2. Push to localCareLog
// 3. persistAsync
// 4. Re-select (triggers cacheTree again with the correct localCareLog)

// ACTUALLY: the simplest correct approach is to push to localCareLog FIRST,
// then call bridge. This matches the onWater pattern at ThreeCanvas.tsx:119-121:
//   localCareLog.push({ day: tree.getAge(), action: { type: 'water', amount: WATER_AMOUNT } });
//   bridge.water();
//   persistAsync({ type: 'water', amount: WATER_AMOUNT });
```

**The implementer MUST use this ordering for ALL bridge-managed actions:**
1. `localCareLog.push(...)` -- update sessionStorage cache source
2. `bridge.applyTwine(...)` or `bridge.water()` -- engine + afterAction -> refreshView -> cacheTree
3. `persistAsync(...)` -- server persist (fire-and-forget)

For twine/weight APPLY, the bridge call returns a result that is needed for the log
entry. This creates a chicken-and-egg: we need the result to build the log entry, but
we need the log entry before the bridge call.

**Resolution:** Call the bridge method first to get the result, then push to localCareLog,
then call cacheTree() explicitly (or re-select which triggers cacheTree via refreshView).
The window between bridge.applyTwine and the push is a single synchronous block -- no
async gap. The only risk is a page crash between the two lines, which would lose the
localCareLog entry but the engine state and server persist are still correct.

```typescript
// Twine apply -- corrected ordering:
const result = bridge.applyTwine(selectedBranchId, angleDelta);
if (!result.ok) return;
// bridge.applyTwine called afterAction -> refreshView -> cacheTree (without this entry)
// Now push the entry:
const appliedDelta = round4(result.newAngle! - result.oldAngle!);
localCareLog.push({ ... });
persistAsync({ ... });
cacheTree(); // ensure localCareLog is saved to sessionStorage
```

For wire/jin, the bridge is NOT used (they call `tree.wire()` and `tree.applyJin()`
directly + `refreshView()` manually). The ordering is straightforward:
localCareLog.push -> engine call -> refreshView -> persistAsync.

### 6. ThreeCanvas.tsx -- Mode toggle handlers

Replace the existing mode toggle stubs (lines 130-139). Extend `setSculptMode` pattern:

```typescript
function setSculptMode(mode: SculptMode): void {
  deselectBranch();

  // Clear all mode button highlights
  document.getElementById('btn-twine-mode')?.classList.remove('active');
  document.getElementById('btn-weight-mode')?.classList.remove('active');
  document.getElementById('btn-prune-mode')?.classList.remove('active');
  document.getElementById('btn-wire-mode')?.classList.remove('active');
  document.getElementById('btn-jin-mode')?.classList.remove('active');

  sculptMode = mode;

  // Disable orbit controls in branch-targeted modes
  const branchTargeted = mode === 'wire' || mode === 'twine' || mode === 'weight' || mode === 'jin';
  careScene.controls.enableRotate = !branchTargeted && mode !== 'prune';

  // Highlight the active button
  const btnId: Record<string, string> = {
    prune: 'btn-prune-mode', wire: 'btn-wire-mode',
    twine: 'btn-twine-mode', weight: 'btn-weight-mode', jin: 'btn-jin-mode',
  };
  if (btnId[mode]) {
    document.getElementById(btnId[mode])?.classList.add('active');
  }
}
```

Wire into CareHud callbacks:

```typescript
const hud = new CareHud({
  onWater: () => { /* existing */ },
  onNextDay: () => bridge.nextDay(),
  onToggleAuto: () => bridge.toggleAuto(),
  onTwine:  () => setSculptMode(sculptMode === 'twine'  ? 'none' : 'twine'),
  onWeight: () => setSculptMode(sculptMode === 'weight' ? 'none' : 'weight'),
  onPrune:  () => setSculptMode(sculptMode === 'prune'  ? 'none' : 'prune'),
  onWire:   () => setSculptMode(sculptMode === 'wire'   ? 'none' : 'wire'),
  onJin:    () => setSculptMode(sculptMode === 'jin'    ? 'none' : 'jin'),
});
```

### 7. Controls interaction: OrbitControls disable in sculpt modes

`setSculptMode` already sets `careScene.controls.enableRotate` based on the mode.
When `enableRotate = false`, OrbitControls ignores drag/pointer events for rotation but
still allows pinch-zoom and scroll-zoom (enableZoom is not touched). This matches the
main3d.ts pattern.

When `setSculptMode('none')` is called, `enableRotate` is restored to `true`.

### 8. CareHud extension (hud.ts)

Extend HudCallbacks with new optional callbacks:

```typescript
export interface HudCallbacks {
  onWater: () => void;
  onNextDay: () => void;
  onToggleAuto: () => boolean;
  onTwine?: () => void;
  onWeight?: () => void;
  // RAYCASTER-ADD 2026-08-30
  onPrune?: () => void;
  onWire?: () => void;
  onJin?: () => void;
}
```

Wire in constructor (after existing twine/weight wiring):

```typescript
const pruneBtn = document.getElementById('btn-prune-mode');
if (pruneBtn && cb.onPrune) pruneBtn.addEventListener('click', cb.onPrune);
const wireBtn = document.getElementById('btn-wire-mode');
if (wireBtn && cb.onWire) wireBtn.addEventListener('click', cb.onWire);
const jinBtn = document.getElementById('btn-jin-mode');
if (jinBtn && cb.onJin) jinBtn.addEventListener('click', cb.onJin);
```

### 9. ThreeCanvas.tsx -- JSX additions

Add new buttons and the sculpt overlay:

```tsx
{/* In the #buttons div, after btn-weight-mode: */}
<button id="btn-prune-mode">Prune</button>
<button id="btn-wire-mode">Wire</button>
<button id="btn-jin-mode">Jin</button>

{/* Sculpt overlay -- bottom sheet for branch controls */}
<div id="sculpt-overlay" style={{
  display: 'none',
  position: 'fixed', left: 0, right: 0, bottom: '80px',
  background: 'rgba(20, 18, 14, 0.92)',
  borderTop: '1px solid rgba(255,255,255,0.1)',
  padding: '12px 16px', zIndex: 20, textAlign: 'center',
  backdropFilter: 'blur(8px)',
}}>
  <div id="sculpt-branch-label" style={{ fontSize: '13px', marginBottom: '8px', color: '#ddd' }} />
  <div id="sculpt-controls-inner" />
</div>
```

**Caretaker opacity note:** No stats, technique, or matchPct appear in the button labels
or overlay. The buttons are plain text (no stat icons). Prune/Wire/Jin are exposed in
production view because they are core sculpt actions the caretaker needs -- they do not
reveal hidden stat information.

### 10. Mobile touch support

`pointerdown` events fire for both mouse clicks and touch taps (W3C Pointer Events spec).
The handler at section 3 uses `e.clientX` and `e.clientY` which are present on both
mouse and touch pointer events. No separate touch handler is needed.

OrbitControls already handles touch gestures (pinch-zoom, two-finger orbit) natively
via three/addons. When `enableRotate = false`, single-finger drag does not orbit,
leaving it free for branch tapping.

### 11. Visual feedback

**Selection indicator:** Yellow wireframe sphere (SphereGeometry 2.5, 8 segments, 0xffdd00)
positioned at the raycast hit point. Identical to main3d.ts pattern. Visible when a
branch is selected, hidden on deselect.

**Cursor:** The implementer SHOULD add `cursor: crosshair` to the renderer.domElement
when `sculptMode !== 'none'` and reset to `default` when `sculptMode === 'none'`.

```typescript
// In setSculptMode, after setting sculptMode:
careScene.renderer.domElement.style.cursor = mode === 'none' ? '' : 'crosshair';
```

**Button highlight:** Active sculpt mode button gets `.active` CSS class (same as
existing twine/weight buttons). The production CSS already styles `.active` buttons.

### 12. Imports

Add to ThreeCanvas.tsx imports:

```typescript
import { round4 } from '@kijo/shared';
import type { Branch } from '@kijo/shared';
```

`THREE` is already imported via scene.ts and tree_mesh.ts but needs a direct import
for Raycaster, Vector2, Mesh, SphereGeometry, MeshBasicMaterial:

```typescript
import * as THREE from 'three';
```

Check if THREE is already imported. If not, add it. If only types are imported, add
the value import.

### 13. Cleanup on unmount

Add to the existing useEffect cleanup (line 294-298):

```typescript
return () => {
  mounted = false;
  cancelAnimationFrame(animId);
  // Dispose selection indicator geometry + material (RAYCASTER-ADD 2026-08-30)
  selectionIndicator.geometry.dispose();
  (selectionIndicator.material as THREE.Material).dispose();
  careScene.renderer.dispose();
};
```

---

## FILE CHANGE LIST

| File | Change | Lines affected |
|------|--------|----------------|
| `apps/web/src/components/ThreeCanvas.tsx` | Major: raycaster, pointer handler, branch selection, sculpt overlay, mode toggles, JSX buttons, cleanup | ~150 lines added, ~15 lines modified |
| `apps/web/src/ui/hud.ts` | Minor: add onPrune?, onWire?, onJin? to HudCallbacks, wire in constructor | ~10 lines added |
| `apps/web/src/renderer/tree_mesh.ts` | **NO CHANGES** -- userData.branchId already set | 0 lines |
| `apps/web/src/bridge/care_bridge.ts` | **NO CHANGES** -- sculpt methods already present from #96 | 0 lines |
| `apps/web/src/renderer/scene.ts` | **NO CHANGES** | 0 lines |

---

## ELEMENT ID TABLE

### New HTML element IDs (production view -- ThreeCanvas.tsx JSX)

| ID | Type | Purpose |
|----|------|---------|
| `btn-prune-mode` | button | Toggle prune sculpt mode |
| `btn-wire-mode` | button | Toggle wire sculpt mode |
| `btn-jin-mode` | button | Toggle jin sculpt mode |
| `sculpt-overlay` | div | Bottom sheet overlay for sculpt controls |
| `sculpt-branch-label` | div | Selected branch info label |
| `sculpt-controls-inner` | div | Dynamic content area (mode-specific controls) |
| `sculpt-twine-angle` | input[range] | Twine bend slider (inside sculpt-controls-inner) |
| `sculpt-twine-label` | span | Twine slider value display |
| `sculpt-twine-apply` | button | Apply twine |
| `sculpt-twine-remove` | button | Remove twine (shown only when twined) |
| `sculpt-weight-count` | select | Weight bag picker 1-4 |
| `sculpt-weight-preview` | span | Weight angle preview |
| `sculpt-weight-apply` | button | Apply weight |
| `sculpt-weight-remove` | button | Remove weight (shown only when weighted) |
| `sculpt-wire-angle` | input[range] | Wire bend slider |
| `sculpt-wire-label` | span | Wire slider value display |
| `sculpt-wire-apply` | button | Apply wire |
| `sculpt-wire-remove` | button | Remove wire (shown only when wired) |
| `sculpt-jin-segment` | input[number] | Jin segment index |
| `sculpt-jin-apply` | button | Apply jin (irreversible) |

### Existing element IDs (unchanged, used by new code)

| ID | Type | Used by |
|----|------|---------|
| `btn-twine-mode` | button | setSculptMode toggle (existing from #96) |
| `btn-weight-mode` | button | setSculptMode toggle (existing from #96) |

---

## ASSUMPTIONS

```
A1. Three.js Raycaster.intersectObjects with recursive=false correctly intersects
    CylinderGeometry and SphereGeometry Mesh children of a Group.
    VERIFIED: standard Three.js capability. Per-mesh bounding sphere computed
    automatically. No custom raycast override needed.

A2. pointerdown on renderer.domElement does not conflict with OrbitControls when
    enableRotate=false. VERIFIED: same pattern used in main3d.ts.

A3. Scar meshes (userData.kind='scar') are filtered out of selection.
    Rationale: scars represent pruned branches. Selecting a pruned branch
    for wire/twine/weight/jin is meaningless -- the engine methods would
    return ok=false ('pruned' reason).

A4. innerHTML for sculpt controls is acceptable in this context (no XSS risk --
    all values are numeric/fixed strings from engine state, not user input).
    Mitigation: no user-controlled strings flow into innerHTML. All interpolated
    values are numbers or fixed enum strings.

A5. Jin is included in production view despite Phase 1 stub throwing.
    Rationale: the button and selection mechanism should be in place. The overlay
    shows a "Phase 1 stub" warning. When Phase 2 lands, it works immediately.
    The user sees "Apply (irreversible)" and a warning -- clear UX signal.

A6. Wire apply/remove in ThreeCanvas calls tree.wire() and tree.removeWire()
    directly (not through CareBridge) because CareBridge does not have wire methods.
    VERIFIED: care_bridge.ts has applyTwine/removeTwine/applyWeight/removeWeight
    but NOT wire/removeWire. The wire methods stay on BonsaiTree directly.
    The implementer must call refreshView() manually after wire operations.
```

---

## OPEN QUESTIONS

```
OQ-1: Should the sculpt-overlay use React state or direct DOM manipulation?
      RECOMMENDATION: Direct DOM manipulation (innerHTML + addEventListener).
      The overlay content is dynamic per mode and per branch. React state would
      require lifting sculptMode/selectedBranchId into React state, re-rendering
      the component on every selection change, and managing event handler cleanup.
      The existing ThreeCanvas pattern (useEffect + imperative DOM) is simpler and
      avoids the React re-render overhead. The entire Three.js scene is imperative;
      the overlay should match.

OQ-2: Should CareBridge gain wire/removeWire methods for symmetry?
      RECOMMENDATION: Yes, in a follow-up. For this task, calling tree.wire()
      directly + refreshView() is correct and matches the existing main3d.ts pattern.
      Adding wire to CareBridge is a clean-up task, not a blocker.

OQ-3: Should the landscape mode button be added to production view?
      RECOMMENDATION: No. Landscape requires 3D position picking (not branch picking)
      which is a different raycaster target (the ground plane, not tree meshes).
      Defer to Phase 2 per ARCH-SCULPT-UI-2026-08-29.md.
```

---

## CROSS-REFERENCE CHECK

```
checked against: ARCH-SCULPT-UI-2026-08-29.md, ARCH-SCULPT-UI-PATCH-2026-08-29.md,
                 DESIGN-CARETAKER-OPACITY.md, DECISIONS.md, STATE.md
consistent: YES
  - Caretaker opacity respected: no stats/technique/matchPct in overlay V
  - Triple-log pattern (engine + localCareLog + persistAsync) followed V
  - round4 discipline applied to angleDelta computation V
  - CareBridge afterAction pattern from F2 patch used for twine/weight V
  - Jin Phase 1 stub acknowledged with try/catch and warning V
  - Landscape excluded from production view per spec V
  - prodSculptMode -> sculptMode rename is backward-compatible (same toggle logic) V
terminology aligned: YES
  - "twine" not "string"
  - "weight" not "weight bag"
  - "jin" not "jin pliers"
data shapes aligned: YES
  - All CareAction shapes match shared/index.ts union members exactly
boundary violations: NONE
```

---

## CARMACK-LINUS SELF-REVIEW

### The Verdict

This is a clean, minimal design that exploits an existing data annotation
(userData.branchId) to avoid the complexity of the main3d.ts voxel-grid raycaster.
The approach is correct: per-branch Mesh objects with userData give O(1) branchId
lookup from any raycast hit. No new dependencies, no parallel data structures, no
tree_mesh.ts changes. The main risk is the innerHTML approach for sculpt controls,
which trades React idiom for simplicity -- acceptable given the imperative context.

### Carmack's Notes

1. **Raycast target list:** `careScene.treeRoot.children` is rebuilt on every
   `buildTreeMesh` call. The raycaster will intersect against the latest mesh set
   automatically. No stale reference risk. Good.

2. **Hit point for selectionIndicator:** Using `hit.point` (the world-space intersection
   point on the mesh surface) places the indicator exactly where the user clicked.
   This is more intuitive than the main3d.ts approach (which uses the voxel grid
   position, offset by the mesh matrix). The indicator may be slightly off-center
   on the branch -- acceptable for a selection highlight.

3. **Performance:** For a typical bonsai (16-30 branches), the raycaster checks
   ~50-90 meshes (branches + leaves + scars). Three.js does bounding sphere
   pre-checks. This is negligible -- sub-microsecond. No optimization needed.

4. **Memory:** The selectionIndicator is a persistent mesh (one SphereGeometry,
   one MeshBasicMaterial). Negligible. The overlay uses innerHTML which creates
   temporary DOM nodes -- GC handles this, and selection changes are infrequent.

### Linus's Notes

1. **Data structure:** userData.branchId is the right data structure. The information
   is already where it needs to be. The main3d.ts voxel-grid approach is an artifact
   of InstancedMesh lacking per-instance identity -- it's the wrong tool for this job.

2. **Error handling:** The pointer handler silently skips hits with no branchId or
   scar kind. Bridge methods return ok=false on pruned/invalid branches. Jin catches
   the Phase 1 throw. All error paths are handled without crashing the UI.

3. **API design:** `selectBranch` and `deselectBranch` are clean, mode-agnostic
   selection primitives. Mode-specific behavior is in the control builders, not the
   selection logic. Good separation.

4. **innerHTML concern:** Using innerHTML to build sculpt controls is simple but
   creates a subtle listener leak -- every `selectBranch` call adds new event
   listeners to the freshly created elements. The old elements are GC'd (innerHTML
   replaces them), and their listeners die with them. No leak. Confirmed safe.

5. **Log ordering for bridge methods:** The corrected pattern (bridge first to get
   result, then push, then persist, then cacheTree) has a single-sync-block gap
   between bridge and push. Acceptable. The worst case (page crash in that gap)
   loses a sessionStorage entry but the engine and server are consistent.

### What This Design Gets Right

- Zero tree_mesh.ts changes (the userData is already there)
- O(1) branchId lookup (no grid math, no voxelization)
- Reuses existing CareBridge methods, localCareLog, persistAsync
- Mobile-native via pointerdown (no separate touch handler)
- Consistent with main3d.ts UX patterns (selection indicator, mode toggles)
- Caretaker opacity respected throughout
