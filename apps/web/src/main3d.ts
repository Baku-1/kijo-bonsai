import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BonsaiTree, GrowthEngine, StatDeriver, CareLogReplay } from '@kijo/engine';
import type { SpeciesClass } from '@kijo/shared';
import { WATER_AMOUNT, round4 } from '@kijo/shared';
import { Voxelizer, VoxelRole, Material } from '@kijo/voxelizer';
import type { SparseVoxelSet, VoxelizeResult } from '@kijo/voxelizer';
import { mossMat } from './renderer/tree_mesh.js';
import {
  getSession,
  loadCareLog,
  persistCareAction,
  applyCurrentDayEntries,
  saveTreeCache,
  loadTreeCache,
  clearTreeCache,
  type KijoSession,
  type CareLogEntry,
} from './persistence.js';

// ===========================================================================
// Kijo 3D care loop -- the voxel grid is the truth; this renders it.
//
// Design decisions baked in here (owner directives 2026-07-18):
//  * Lazy-load by structure: trunk + depth-1 limbs appear instantly, depth-2
//    branches next, then the leaf/canopy flood streams in last. Structure
//    first, decoration last -- also the perf story for 9k+ voxel trees.
//  * Ideal-path guidance is a HINT, not a solution: a soft ghost column
//    shows roughly where the favoured form lives. No per-voxel heat map,
//    no paint-by-numbers. Mastery is the player's.
// ===========================================================================

const app = document.getElementById('app')!;
const meta = document.getElementById('meta')!;
const statTable = document.getElementById('stat-table')!;
const voxelCountEl = document.getElementById('voxel-count')!;
const fertStatus = document.getElementById('fert-status')!;
const exportOut = document.getElementById('export-out') as HTMLTextAreaElement;
const hintEl = document.getElementById('hint')!;

// Wire UI element references (WIRE-ADD 2026-08-14)
const wireControls   = document.getElementById('wire-controls')! as HTMLDivElement;
const wireBranchInfo = document.getElementById('wire-branch-info')!;
const wireAngleInput = document.getElementById('wire-angle')! as HTMLInputElement;
const wireAngleLabel = document.getElementById('wire-angle-label')!;
const btnWireApply   = document.getElementById('btn-wire-apply')!;
const btnWireRemove  = document.getElementById('btn-wire-remove')!;
const wireBtn        = document.getElementById('btn-wire')!;

// ---------------------------------------------------------------------------
// Three.js scene
// ---------------------------------------------------------------------------
const GRID = 256;
const BASE_Y = 38; // trunk base in grid coords (Voxelizer.BASE)

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141710);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
app.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxDistance = 600;
controls.minDistance = 40;

// World transform: grid (0..255, y up) -> world centered on pot.
function gridToWorld(x: number, y: number, z: number, out: THREE.Vector3): THREE.Vector3 {
  return out.set(x - 128, y - BASE_Y, z - 128);
}

const potWorld = gridToWorld(128, BASE_Y, 128, new THREE.Vector3());
controls.target.copy(potWorld).add(new THREE.Vector3(0, 60, 0));
camera.position.copy(controls.target).add(new THREE.Vector3(120, 60, 170));

scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const sun = new THREE.DirectionalLight(0xfff2dd, 1.4);
sun.position.set(200, 300, 160);
scene.add(sun);
const fill = new THREE.DirectionalLight(0x88aaff, 0.35);
fill.position.set(-150, 100, -120);
scene.add(fill);

// Ground plane (the "bench" the pot sits on)
{
  const g = new THREE.CircleGeometry(300, 48);
  const m = new THREE.MeshStandardMaterial({ color: 0x232a1c, roughness: 1 });
  const ground = new THREE.Mesh(g, m);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -6;
  scene.add(ground);
}
// Pot -- PBR ceramic material.
{
  const tl = new THREE.TextureLoader();
  const potBase = tl.load('/textures/Bonsai_LowPoly_Pot_BaseColor.jpg');
  potBase.colorSpace = THREE.SRGBColorSpace;
  const potNormal   = tl.load('/textures/Bonsai_LowPoly_Pot_NormalGL.jpg');
  const potRoughness = tl.load('/textures/Bonsai_LowPoly_Pot_Roughness.jpg');
  const g = new THREE.CylinderGeometry(16, 12, 10, 32);
  const m = new THREE.MeshStandardMaterial({
    map: potBase,
    normalMap: potNormal,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughnessMap: potRoughness,
    roughness: 0.85,
    metalness: 0.0,
  });
  const pot = new THREE.Mesh(g, m);
  pot.position.y = 0;
  scene.add(pot);

  // Moss soil disc -- sits at the top of the pot (y=5 = top rim).
  const soilGeo = new THREE.CircleGeometry(15.5, 32);
  const soil = new THREE.Mesh(soilGeo, mossMat);
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = 5;
  scene.add(soil);
}

// ---------------------------------------------------------------------------
// Ghost hint -- soft shell around the ideal-path region (Chokkan: vertical
// axis at x=z=128, y 38..220, radius = IDEAL_REGION_DISTANCE = 10).
// Deliberately vague: a region, not a line.
// ---------------------------------------------------------------------------
const ghost = new THREE.Group();
{
  const g = new THREE.CylinderGeometry(10, 10, 220 - 38, 20, 1, true);
  const m = new THREE.MeshBasicMaterial({
    color: 0x9fc7ff,
    transparent: true,
    opacity: 0.05,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const shell = new THREE.Mesh(g, m);
  const center = gridToWorld(128, (38 + 220) / 2, 128, new THREE.Vector3());
  shell.position.copy(center);
  ghost.add(shell);
}
scene.add(ghost);
let ghostVisible = true;

// Wire selection indicator -- a wireframe sphere placed at the clicked voxel's
// world position to mark the selected branch. NOT added to the meshes Map so
// it survives rebuildVoxels() which calls clearVoxels() (WIRE-ADD 2026-08-14).
const selectionIndicator = (() => {
  const g = new THREE.SphereGeometry(2.5, 8, 6);
  const m = new THREE.MeshBasicMaterial({ color: 0xffdd00, wireframe: true });
  const mesh = new THREE.Mesh(g, m);
  mesh.visible = false;
  scene.add(mesh);
  return mesh;
})();

// Map populated in the init block below.
const VOXEL_MATS: Record<number, THREE.MeshStandardMaterial> = {};

// ---------------------------------------------------------------------------
// Voxel instancing -- one InstancedMesh per material, rebuilt after mutations.
// Stream order: structure (depth <=2 wood + trunk/root) first, canopy last.
// PBR textures: trunk/bark share bark maps; leaves get leaf maps; roots/scar
// stay flat-color (below pot line, rarely visible).
// ---------------------------------------------------------------------------
{
  const tl = new THREE.TextureLoader();
  const srgb = THREE.SRGBColorSpace;
  const linear = THREE.LinearSRGBColorSpace;
  const rep = (t: THREE.Texture, rs: THREE.ColorSpace, rS = 2, rT = 4) => {
    t.colorSpace = rs; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rS, rT); return t;
  };
  const tBase   = rep(tl.load('/textures/Bonsai_LowPoly_Bonsai_Trunk_BaseColor.jpg'), srgb);
  const tNormal = rep(tl.load('/textures/Bonsai_LowPoly_Bonsai_Trunk_LowPoly_NormalGL.jpg'), linear);
  const tAMR    = rep(tl.load('/textures/Bonsai_LowPoly_Bonsai_Trunk_AMR.jpg'), linear);
  const lBase   = rep(tl.load('/textures/Bonsai_LowPoly_Leaves_BaseColor.jpg'), srgb, 1, 1);
  const lNormal = rep(tl.load('/textures/Bonsai_LowPoly_Leaves_NormalGL.jpg'), linear, 1, 1);
  const lRough  = rep(tl.load('/textures/Bonsai_LowPoly_Leaves_Roughness.jpg'), linear, 1, 1);

  // Bark PBR -- shared by HEARTWOOD + BARK + BRANCH_WOOD voxel types.
  const barkMat = new THREE.MeshStandardMaterial({
    map: tBase, normalMap: tNormal, normalScale: new THREE.Vector2(0.7, 0.7),
    roughnessMap: tAMR, aoMap: tAMR, roughness: 0.88, metalness: 0.0,
  });
  // Leaf PBR.
  const leafVoxMat = new THREE.MeshStandardMaterial({
    map: lBase, normalMap: lNormal, normalScale: new THREE.Vector2(0.5, 0.5),
    roughnessMap: lRough, roughness: 0.75, metalness: 0.0,
    color: 0x5a8f3c, side: THREE.DoubleSide,
  });
  // Flat for root (below soil) and prune scar.
  const rootMat = new THREE.MeshStandardMaterial({ color: 0x3d2c1a, roughness: 0.95 });
  const scarVoxMat = new THREE.MeshStandardMaterial({ color: 0x8c8c74, roughness: 0.7 });

  VOXEL_MATS[Material.HEARTWOOD]  = barkMat;
  VOXEL_MATS[Material.BARK]       = barkMat;
  VOXEL_MATS[Material.BRANCH_WOOD] = barkMat;
  VOXEL_MATS[Material.LEAF]       = leafVoxMat;
  VOXEL_MATS[Material.ROOT]       = rootMat;
  VOXEL_MATS[Material.PRUNE_SCAR] = scarVoxMat;
}

const CANOPY_ROLES = new Set<VoxelRole>([VoxelRole.CANOPY, VoxelRole.DIGIT]);

const meshes = new Map<number, THREE.InstancedMesh>();
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const dummy = new THREE.Object3D();
const tmpVec = new THREE.Vector3();

function clearVoxels(): void {
  for (const mesh of meshes.values()) {
    scene.remove(mesh);
    mesh.dispose();
  }
  meshes.clear();
}

function rebuildVoxels(voxels: SparseVoxelSet): void {
  clearVoxels();

  // Partition into structure vs canopy, grouped per material.
  const structure = new Map<number, Array<[number, number, number]>>();
  const canopy = new Map<number, Array<[number, number, number]>>();
  voxels.forEach((x, y, z, mat, role) => {
    const bucket = CANOPY_ROLES.has(role) ? canopy : structure;
    let arr = bucket.get(mat);
    if (!arr) { arr = []; bucket.set(mat, arr); }
    arr.push([x, y, z]);
  });

  const spawnGroup = (group: Map<number, Array<[number, number, number]>>) => {
    for (const [mat, cells] of group) {
      const material = VOXEL_MATS[mat] ?? new THREE.MeshStandardMaterial({ color: 0xffffff });
      const mesh = new THREE.InstancedMesh(boxGeo, material, cells.length);
      mesh.userData.materialId = mat;
      mesh.count = 0;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(mesh);
      meshes.set(mat, mesh);
      // Pre-fill instance transforms; we reveal them by raising mesh.count.
      for (let i = 0; i < cells.length; i++) {
        const [x, y, z] = cells[i];
        gridToWorld(x, y, z, tmpVec);
        dummy.position.copy(tmpVec);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  };

  // Structure materials reveal fully right away: the skeleton reads first.
  // (Materials map 1:1 with structure/canopy roles in the voxelizer, so the
  // two groups never share a material entry in `meshes`.)
  spawnGroup(structure);
  for (const mesh of meshes.values()) mesh.count = mesh.instanceMatrix.count;

  // Canopy streams in over ~1.5s -- leaves flood in last.
  spawnGroup(canopy);
  const canopyMeshes: THREE.InstancedMesh[] = [];
  for (const [mat, cells] of canopy) {
    const mesh = meshes.get(mat)!;
    mesh.count = 0;
    (mesh as any)._targetCount = cells.length;
    canopyMeshes.push(mesh);
  }
  streamQueue = canopyMeshes;
  streamElapsed = 0;
}

let streamQueue: THREE.InstancedMesh[] = [];
let streamElapsed = 0;
const STREAM_SECONDS = 1.5;

// ---------------------------------------------------------------------------
// Tree state
// ---------------------------------------------------------------------------
let tree: BonsaiTree = newTree();
let pruneMode = false;
// Wire mode state (WIRE-ADD 2026-08-14)
let wireMode = false;
let selectedBranchId: number | null = null;
let latestVoxels: VoxelizeResult | null = null;

// ---------------------------------------------------------------------------
// Persistence state -- null = local / guest mode (no server wiring).
// ---------------------------------------------------------------------------
let kijoSession: KijoSession | null = null;

// Local care log -- tracks all actions for sessionStorage cache.
let localCareLog: CareLogEntry[] = [];
let cacheReady = false;

function cacheTree(): void {
  if (!cacheReady) return;
  saveTreeCache(
    kijoSession?.tree_id ?? null,
    tree.getSeed(), tree.getSpecies(),
    tree.getAge(), localCareLog,
  );
}

function newTree(): BonsaiTree {
  const seed = (document.getElementById('seed') as HTMLInputElement).valueAsNumber || 42;
  const species = (document.getElementById('species') as HTMLSelectElement).value as SpeciesClass;
  const t = new BonsaiTree(seed, species);
  t.markDirty();
  return t;
}

// ---------------------------------------------------------------------------
// HUD / stats
// ---------------------------------------------------------------------------
function refreshAll(): void {
  latestVoxels = Voxelizer.voxelize(tree);
  const sheet = StatDeriver.derive(tree, latestVoxels.voxels, tree.getSeed(), tree.getAge(), latestVoxels.zones);

  voxelCountEl.textContent = `${latestVoxels.voxels.count()} voxels`;
  const rows: Array<[string, number | string]> = [
    ['HP', sheet.hp],
    ['Power', sheet.power],
    ['Endurance', sheet.endurance],
    ['Ki', sheet.ki],
    ['Skill slots', Math.round(sheet.skillSlots)],
    ['Skill points', sheet.skillPoints],
    ['Wisdom (tier)', Math.round(sheet.wisdom)],
    ['Match %', (sheet.matchPct * 100).toFixed(1) + '%'],
    ['Defense', sheet.defense],
    ['Stability', sheet.stability],
  ];
  statTable.innerHTML = rows
    .map(([k, v]) => `<tr><td>${k}</td><td>${typeof v === 'number' ? v.toFixed(2) : v}</td></tr>`)
    .join('');

  meta.textContent =
    `seed ${tree.getSeed()} · ${tree.getSpecies()} · day ${tree.getAge()} · ` +
    `health ${tree.getHealth().toFixed(0)} · moisture ${tree.getMoisture().toFixed(0)} · ` +
    `${tree.countLivingBranches()} branches (${tree.getPrunedCount()} pruned)`;
  meta.className = tree.getMoisture() < 15 || tree.getMoisture() > 80 ? 'moisture-bad' : '';
  fertStatus.textContent = tree.isFertilizerActive() ? 'fertilizer ACTIVE (1.7x growth)' : '';

  rebuildVoxels(latestVoxels.voxels);
  cacheTree();
}

// ---------------------------------------------------------------------------
// Pointer picking -- raycast against voxel instances, map instanceId -> branchId
// via the voxel set's branchId at that coordinate.
// Handles both prune mode (click to cut) and wire mode (click to select branch).
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

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
    // world -> grid
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
      // Trunk (branchId 0) IS wireable (OQ-1 resolution, DECISIONS.md 2026-07-31).
      hitBranch = true;
      const clickedId = cell.branchId;
      if (selectedBranchId === clickedId) {
        // Clicking the already-selected branch toggles off (deselects).
        deselectWireBranch();
      } else {
        // tmpVec.clone() is required: tmpVec is a reused scratch vector and will be
        // mutated on the next raycaster call. Clone captures the current position.
        selectWireBranch(clickedId, tmpVec.clone());
      }
      return;
    }
  }

  // Wire mode: clicking empty space (no valid voxel hit) deselects.
  if (wireMode && !hitBranch) deselectWireBranch();
});

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

/**
 * Fire-and-forget care action persist.  See main2d.ts for rationale.
 * In read-only mode (no access_token / wallet_row_id) the call is a no-op.
 */
function persistAsync(action: Parameters<typeof persistCareAction>[1]): void {
  if (!kijoSession || !kijoSession.access_token || !kijoSession.wallet_row_id) return;
  const session = kijoSession;
  persistCareAction(session, action).catch((err: unknown) => {
    console.error('[kijo] persist failed:', err instanceof Error ? err.message : err);
  });
}

/**
 * On mount: load tree from Supabase and replay care log to restore state.
 * Mirrors the init() in main2d.ts but calls refreshAll() (not refreshStats +
 * render) and starts the animate loop BEFORE this resolves so the Three.js
 * scene is visible immediately while the server round-trip completes.
 *
 * Note: the "Advance day xN" button is intentionally NOT persisted -- see
 * main2d.ts init() for the full rationale.
 */
async function init(): Promise<void> {
  kijoSession = getSession();
  const treeId = kijoSession?.tree_id ?? null;

  // --- Local cache check ---------------------------------------------------
  const cache = loadTreeCache();
  if (cache && cache.tree_id === treeId) {
    try {
      if (cache.age === 0) {
        tree = new BonsaiTree(cache.seed, cache.species as SpeciesClass);
        applyCurrentDayEntries(tree, cache.careLog.filter((e) => e.day === 0));
      } else {
        tree = CareLogReplay.reconstruct(
          cache.seed, cache.species as SpeciesClass,
          cache.careLog.filter((e) => e.day < cache.age),
          cache.age,
        );
        applyCurrentDayEntries(
          tree,
          cache.careLog.filter((e) => e.day === cache.age),
        );
      }
      (document.getElementById('seed') as HTMLInputElement).value = String(cache.seed);
      (document.getElementById('species') as HTMLSelectElement).value = cache.species;
      localCareLog = cache.careLog;
      cacheReady = true;
      console.info(
        `[kijo] restored from local cache -- age=${cache.age} actions=${cache.careLog.length}`,
      );
      ghost.visible = ghostVisible && (((tree.getSeed() % 7) + 7) % 7 === 0);
      refreshAll();
      return;
    } catch (err: unknown) {
      console.warn('[kijo] cache reconstruction failed; falling back to server.', err);
      clearTreeCache();
    }
  }

  // --- Server load (existing behaviour) ------------------------------------
  if (treeId) {
    try {
      const { treeData, careLog } = await loadCareLog(treeId);

      if (treeData.current_day === 0) {
        tree = new BonsaiTree(treeData.seed, treeData.species as SpeciesClass);
        applyCurrentDayEntries(tree, careLog.filter((e) => e.day === 0));
      } else {
        const priorLog = careLog.filter((e) => e.day < treeData.current_day);
        tree = CareLogReplay.reconstruct(
          treeData.seed,
          treeData.species as SpeciesClass,
          priorLog,
          treeData.current_day,
        );
        applyCurrentDayEntries(
          tree,
          careLog.filter((e) => e.day === treeData.current_day),
        );
      }

      (document.getElementById('seed') as HTMLInputElement).value = String(treeData.seed);
      (document.getElementById('species') as HTMLSelectElement).value = treeData.species;
      localCareLog = careLog;

      const mode = kijoSession!.access_token ? 'read-write' : 'read-only';
      console.info(
        `[kijo] tree restored -- id=${treeId} ` +
        `day=${treeData.current_day} actions=${careLog.length} mode=${mode}`,
      );
    } catch (err: unknown) {
      console.error(
        '[kijo] failed to restore tree from Supabase; starting fresh.',
        err instanceof Error ? err.message : err,
      );
    }
  }

  cacheReady = true;
  ghost.visible = ghostVisible && (((tree.getSeed() % 7) + 7) % 7 === 0);
  refreshAll();
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------
document.getElementById('btn-new')!.addEventListener('click', () => {
  kijoSession = null;
  tree = newTree();
  localCareLog = [];
  cacheReady = true;
  clearTreeCache();
  pruneMode = false;
  document.getElementById('btn-prune')!.classList.remove('active');
  wireMode = false;                 // WIRE-ADD
  wireBtn.classList.remove('active'); // WIRE-ADD
  deselectWireBranch();             // WIRE-ADD
  controls.enableRotate = true;     // WIRE-ADD
  exportOut.value = '';
  refreshAll();
});
document.getElementById('btn-water')!.addEventListener('click', () => {
  localCareLog.push({ day: tree.getAge(), action: { type: 'water', amount: WATER_AMOUNT } });
  tree.water(WATER_AMOUNT);
  tree.markDirty();
  refreshAll();
  persistAsync({ type: 'water', amount: WATER_AMOUNT });
});
document.getElementById('btn-fertilize')!.addEventListener('click', () => {
  localCareLog.push({ day: tree.getAge(), action: { type: 'fertilize' } });
  tree.fertilize();
  refreshAll();
  persistAsync({ type: 'fertilize' });
});
document.getElementById('btn-rotate')!.addEventListener('click', () => {
  localCareLog.push({ day: tree.getAge(), action: { type: 'rotate' } });
  tree.rotate();
  refreshAll();
  persistAsync({ type: 'rotate' });
});

// ---------------------------------------------------------------------------
// Wire mode helpers (WIRE-ADD 2026-08-14)
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

// Bend preview: live angle-preview label on slider drag (no BonsaiTree mutation).
// POLAR_MIN / POLAR_MAX / HAN_KENGAI_GATE mirror WireEngine.ts constants -- UI read-only.
const PREVIEW_POLAR_MIN  = 5.7296;  // 0.1 rad (WireEngine.ts:33)
const PREVIEW_POLAR_MAX  = 150;     // 2.618 rad (WireEngine.ts:34)
const PREVIEW_HAN_KENGAI = 120;     // Han-Kengai ceiling (WireEngine.ts:80)
wireAngleInput.addEventListener('input', () => {
  const delta = parseFloat(wireAngleInput.value);
  wireAngleLabel.textContent = `${wireAngleInput.value}°`;

  // Update wireBranchInfo with predicted result angle -- pure display, no state mutation.
  // Reverts automatically when slider returns to 0 or branch is deselected.
  if (selectedBranchId !== null) {
    const branch = tree.getBranches()[selectedBranchId];
    if (branch) {
      if (delta !== 0) {
        // Mirror WireEngine cascade gate: wireCount is incremented BEFORE gate check.
        const nextWireCount = (branch.wireCount ?? 0) + 1;
        const cascadeGate = nextWireCount >= 3 ? PREVIEW_POLAR_MAX : PREVIEW_HAN_KENGAI;
        const rawPreview  = Math.min(Math.max(branch.angle + delta, PREVIEW_POLAR_MIN), PREVIEW_POLAR_MAX);
        const preview     = Math.min(rawPreview, cascadeGate);
        const baseLabel   = branch.wired ? 'wired' : 'unwired';
        wireBranchInfo.textContent =
          `Branch #${selectedBranchId} · ${baseLabel} · ${branch.angle.toFixed(1)}° → ${preview.toFixed(1)}°`;
      } else {
        // Slider back at 0 -- restore full static label (no pending change).
        const wiredLabel = branch.wired
          ? `wired · angle ${branch.angle.toFixed(1)}° · applied day ${branch.wireAppliedDay}`
          : `unwired · angle ${branch.angle.toFixed(1)}°`;
        wireBranchInfo.textContent = `Branch #${selectedBranchId} · ${wiredLabel}`;
      }
    }
  }
});

wireBtn.addEventListener('click', () => {
  wireMode = !wireMode;
  wireBtn.classList.toggle('active', wireMode);

  if (wireMode) {
    // Deactivate prune if it was active -- only one sculpt mode at a time.
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

const pruneBtn = document.getElementById('btn-prune')!;
pruneBtn.addEventListener('click', () => {
  pruneMode = !pruneMode;
  pruneBtn.classList.toggle('active', pruneMode);

  if (pruneMode && wireMode) {
    // Wire mode loses to prune -- clear wire state without clobbering controls.enableRotate yet.
    wireMode = false;
    wireBtn.classList.remove('active');
    deselectWireBranch();
  }

  controls.enableRotate = !(pruneMode || wireMode);
  hintEl.textContent = pruneMode
    ? 'Prune mode: click a branch voxel to cut it. Trunk is protected.'
    : 'Drag to orbit · scroll to zoom · the blue ghost is roughly where this seed wants to grow';
});

const ghostBtn = document.getElementById('btn-ghost')!;
ghostBtn.addEventListener('click', () => {
  ghostVisible = !ghostVisible;
  ghost.visible = ghostVisible;
  ghostBtn.classList.toggle('active', ghostVisible);
});
ghostBtn.classList.add('active');

document.getElementById('btn-day')!.addEventListener('click', () => {
  const n = Math.max(1, Math.min(30, (document.getElementById('days-multi') as HTMLInputElement).valueAsNumber || 1));
  for (let i = 0; i < n; i++) GrowthEngine.growTick(tree);
  refreshAll();
});

document.getElementById('btn-export')!.addEventListener('click', () => {
  const result = latestVoxels ?? Voxelizer.voxelize(tree);
  const sheet = StatDeriver.derive(tree, result.voxels, tree.getSeed(), tree.getAge(), result.zones);
  const payload = {
    seed: tree.getSeed(),
    species: tree.getSpecies().toUpperCase(),
    ageDays: tree.getAge(),
    generatedAt: new Date().toISOString(),
    stats: {
      hp: sheet.hp,
      power: sheet.power,
      endurance: sheet.endurance,
      ki: sheet.ki,
      skillSlots: sheet.skillSlots,
      skillPoints: sheet.skillPoints,
      wisdom: sheet.wisdom,
      matchPct: sheet.matchPct,
      defense: sheet.defense,
      stability: sheet.stability,
    },
  };
  exportOut.value = JSON.stringify(payload, null, 2);
});
document.getElementById('btn-copy')!.addEventListener('click', async () => {
  if (exportOut.value) await navigator.clipboard.writeText(exportOut.value);
});

// ---------------------------------------------------------------------------
// Wire apply / remove event listeners (WIRE-ADD 2026-08-14)
// ---------------------------------------------------------------------------

// Apply wire: call WireEngine via tree.wire(), then persist.
// NOTE: wire-apply will succeed on server only if 'wire' consumable row exists
// with quantity > 0. Until OQ-WIRE-2 is resolved (task #161 consumable provisioning),
// persistAsync will receive a 400 from the server and log to console only.
btnWireApply.addEventListener('click', () => {
  if (selectedBranchId === null || !latestVoxels) return;

  const angleDelta = parseFloat(wireAngleInput.value);
  if (!Number.isFinite(angleDelta)) return; // guard against NaN from empty input

  // Critic finding (CRITIC-WIRE-UI-2026-08-14 §4 FINDING-2):
  // Guard angleDelta === 0 to avoid wasting a wire consumable on a no-op.
  // WireEngine.wire(branchId, 0) marks the branch wired and deducts a consumable
  // without changing branch.angle. Prevent this accidental spend.
  if (angleDelta === 0) {
    hintEl.textContent = 'No angle change -- adjust the slider before applying wire.';
    return;
  }

  const result = tree.wire(selectedBranchId, angleDelta);

  if (!result.ok) {
    // Surface engine rejection in the hint bar. Do NOT call persistAsync.
    // W11 (too-thick rejection): requires branch thickness > 3.0; manual test only --
    // a fresh tree has all branches near thickness 1.0. Grow to >=30 days first.
    hintEl.textContent = `Wire failed: ${result.reason}`;
    return;
  }

  // result.ok === true guarantees oldAngle, newAngle, wireCost are populated.
  // Critic finding (CRITIC-WIRE-UI-2026-08-14 §3 DEFECT):
  // Wrap in round4() to match engine's internal discipline (DECISIONS.md 2026-07-15).
  // result.newAngle and result.oldAngle are both already round4'd but subtracting
  // two round4'd floats can produce a result that is not round4'd (binary float).
  const appliedDelta = round4(result.newAngle! - result.oldAngle!);

  // Push to localCareLog AFTER engine call so we have the post-clamp values.
  // (Unlike prune which pushes before -- wire requires WireResult fields.)
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

// Remove wire: call WireEngine via tree.removeWire(), then persist.
// NOTE: 'wire-remove' is now whitelisted in care-action ALLOWED_ACTION_TYPES (v7, 2026-08-14).
// persistAsync will succeed server-side. GAP-1/OQ-WIRE-1 resolved by task #161.
// Remaining gap: CareLogReplay.ts does not yet handle wire-remove (throws CareLogReplayError);
// cold-reload tree reconstruction will crash if care log contains wire-remove entries (tracked separately).
btnWireRemove.addEventListener('click', () => {
  if (selectedBranchId === null) return;

  // Guard against stale UI state (branch may have been pruned since selection).
  const branch = tree.getBranches()[selectedBranchId];
  if (!branch || !branch.wired) return;

  const branchIdToRemove = selectedBranchId;

  // WireEngine.removeWire: silent no-op if not wired/pruned/not-found.
  // Spring-back physics: angle reverts proportionally if wire removed before set window.
  // set window = computeSetDays(branch.diameter). Computed server-side in WireEngine.
  tree.removeWire(branchIdToRemove);

  localCareLog.push({
    day: tree.getAge(),
    action: { type: 'wire-remove', branchId: branchIdToRemove },
  });

  refreshAll();

  // wire-remove now server-whitelisted (care-action v7). Persists to Supabase.
  persistAsync({ type: 'wire-remove', branchId: branchIdToRemove });

  // Update controls: branch is now unwired, angle may have sprung back.
  const updatedBranch = tree.getBranches()[branchIdToRemove];
  wireBranchInfo.textContent =
    `Branch #${branchIdToRemove} · unwired · angle ${updatedBranch.angle.toFixed(1)}°`;
  btnWireRemove.style.display = 'none';
  wireAngleInput.value = '0';
  wireAngleLabel.textContent = '0°';
});

// ---------------------------------------------------------------------------
// Resize + main loop
// ---------------------------------------------------------------------------
function resize(): void {
  const w = app.clientWidth, h = app.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
function animate(): void {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  // Stream canopy reveal.
  if (streamQueue.length > 0) {
    streamElapsed += dt;
    const t = Math.min(1, streamElapsed / STREAM_SECONDS);
    for (const mesh of streamQueue) {
      const target = (mesh as any)._targetCount ?? 0;
      mesh.count = Math.floor(target * t);
    }
    if (t >= 1) streamQueue = [];
  }

  controls.update();
  renderer.render(scene, camera);
}

hintEl.textContent = 'Drag to orbit · scroll to zoom · the blue ghost is roughly where this seed wants to grow';
// Populate voxels immediately from the in-memory placeholder tree so the
// scene is never blank.  init() calls refreshAll() again once the server
// round-trip completes, swapping in the persisted tree.
refreshAll();
animate();
void init();
