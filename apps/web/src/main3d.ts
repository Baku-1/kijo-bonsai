import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BonsaiTree, GrowthEngine, StatDeriver, CareLogReplay } from '@kijo/engine';
import type { SpeciesClass, LandscapeElementType, Coordinate } from '@kijo/shared';
import { WATER_AMOUNT, round4 } from '@kijo/shared';
import { Voxelizer, VoxelRole, Material } from '@kijo/voxelizer';
import type { SparseVoxelSet, VoxelizeResult } from '@kijo/voxelizer';
import { mossMat } from './renderer/tree_mesh.js';
import { createAtelierRoom } from './renderer/atelier_room';
import { loadAtelierTextures } from './renderer/atelier_textures';
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

// ---------------------------------------------------------------------------
// Three.js scene
// ---------------------------------------------------------------------------
const GRID = 256;
const BASE_Y = 38; // trunk base in grid coords (Voxelizer.BASE)

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x16120e); // dark warm workshop
scene.fog = new THREE.FogExp2(0x16120e, 0.0018); // subtle warm haze

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
app.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false; // keep the camera inside the atelier room
controls.minDistance = 35;
controls.maxDistance = 185;
controls.minPolarAngle = 0.5; // stay below the ceiling (~241 world y)
controls.maxPolarAngle = 1.4; // stay above the bench/floor

// World transform: grid (0..255, y up) -> world centered on pot.
function gridToWorld(x: number, y: number, z: number, out: THREE.Vector3): THREE.Vector3 {
  return out.set(x - 128, y - BASE_Y, z - 128);
}

const potWorld = gridToWorld(128, BASE_Y, 128, new THREE.Vector3());
controls.target.copy(potWorld).add(new THREE.Vector3(0, 70, 0)); // mid-canopy
camera.position.set(95, 100, 125); // slightly elevated three-quarter view
controls.update();

// Atelier lighting: warm key from the shoji window (-X), soft fill from the
// right, gentle hemi/ambient, and a focused spot through the window shaft.
// Positions are authored for ATELIER_SCALE=110 (window at x ~= -270).
scene.add(new THREE.AmbientLight(0x3a322c, 0.45));
const hemi = new THREE.HemisphereLight(0xffd9b0, 0x1a1410, 0.55);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xffe3b8, 2.4);
key.position.set(-320, 220, 80);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 1;
key.shadow.camera.far = 800;
key.shadow.camera.left = -240;
key.shadow.camera.right = 240;
key.shadow.camera.top = 240;
key.shadow.camera.bottom = -240;
key.shadow.bias = -0.0005;
scene.add(key);
const fill = new THREE.DirectionalLight(0xc9a07a, 0.5);
fill.position.set(220, 80, -160);
scene.add(fill);
const windowLight = new THREE.SpotLight(0xffe6bf, 80000, 450, 0.5, 0.8);
windowLight.position.set(-160, 90, 20);
windowLight.target.position.set(0, 20, 0);
scene.add(windowLight);
scene.add(windowLight.target);

// Old flat backdrop -- ground "bench" + PBR pot. Kept until the atelier room
// textures resolve, then removed so exactly ONE pot sits at the tree base.
const oldGround = new THREE.Mesh(
  new THREE.CircleGeometry(300, 48),
  new THREE.MeshStandardMaterial({ color: 0x232a1c, roughness: 1 }),
);
oldGround.rotation.x = -Math.PI / 2;
oldGround.position.y = -6;
scene.add(oldGround);

const potLoader = new THREE.TextureLoader();
const potBase = potLoader.load('/textures/Bonsai_LowPoly_Pot_BaseColor.jpg');
potBase.colorSpace = THREE.SRGBColorSpace;
const potNormal   = potLoader.load('/textures/Bonsai_LowPoly_Pot_NormalGL.jpg');
const potRoughness = potLoader.load('/textures/Bonsai_LowPoly_Pot_Roughness.jpg');
const oldPotMat = new THREE.MeshStandardMaterial({
  map: potBase,
  normalMap: potNormal,
  normalScale: new THREE.Vector2(0.8, 0.8),
  roughnessMap: potRoughness,
  roughness: 0.85,
  metalness: 0.0,
});
const oldPot = new THREE.Mesh(new THREE.CylinderGeometry(16, 12, 10, 32), oldPotMat);
oldPot.position.y = 0;
scene.add(oldPot);

// Moss soil disc -- sits at the top of the old pot (y=5 = top rim).
const oldSoil = new THREE.Mesh(new THREE.CircleGeometry(15.5, 32), mossMat);
oldSoil.rotation.x = -Math.PI / 2;
oldSoil.position.y = 5;
scene.add(oldSoil);

// ---------------------------------------------------------------------------
// Bonsai Atelier room -- replaces the old ground + pot once its textures
// resolve. Same scale fit as scene.ts: the care tree maps 1 voxel = 1 world
// unit and can reach y~150-200, so the room group is scaled ATELIER_SCALE=110
// with its soil plane on world y=0 (the tree base).
// ---------------------------------------------------------------------------
const ATELIER_SCALE = 110;
let roomTick: ((elapsed: number, dt: number) => void) | null = null;

loadAtelierTextures()
  .then((tex) => {
    scene.environment = tex.env;
    scene.environmentIntensity = 0.35;
    const room = createAtelierRoom(tex, { scale: ATELIER_SCALE, baseY: 0 });
    scene.add(room.group);
    roomTick = room.tick;

    // Remove the old ground + pot -- exactly ONE pot now (the room's).
    scene.remove(oldGround, oldPot, oldSoil);
    oldGround.geometry.dispose();
    (oldGround.material as THREE.Material).dispose();
    oldPot.geometry.dispose();
    oldPotMat.dispose();
    potBase.dispose();
    potNormal.dispose();
    potRoughness.dispose();
    oldSoil.geometry.dispose();
  })
  .catch((err: unknown) => {
    console.warn('[kijo] atelier room load failed; keeping flat backdrop.', err);
  });

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
// Unified sculpt mode (SCULPT-ADD 2026-08-29) -- replaces pruneMode + wireMode booleans.
type SculptMode = 'none' | 'prune' | 'wire' | 'twine' | 'weight' | 'jin' | 'landscape';
let sculptMode: SculptMode = 'none';
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
  if (sculptMode === 'none' || sculptMode === 'landscape') return;

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

    if (sculptMode === 'prune') {
      if (cell.branchId === 0) continue; // trunk protected from prune
      const prunedId = cell.branchId;
      localCareLog.push({ day: tree.getAge(), action: { type: 'prune', branchId: prunedId } });
      tree.prune(prunedId);
      refreshAll();
      persistAsync({ type: 'prune', branchId: prunedId });
      return;
    }

    // Branch-targeted sculpt modes: wire, twine, weight, jin (SCULPT-ADD 2026-08-29)
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
  }

  // Branch-targeted modes: clicking empty space deselects.
  if (['wire', 'twine', 'weight', 'jin'].includes(sculptMode) && !hitBranch) deselectSculptBranch();
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
  setSculptMode('none');
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
 * Select a branch for the current sculpt mode.
 * Reuses selectionIndicator. Shows mode-specific sub-controls.
 */
function selectSculptBranch(branchId: number, worldPos: THREE.Vector3): void {
  selectedBranchId = branchId;
  selectionIndicator.position.copy(worldPos);
  selectionIndicator.visible = true;

  const branch = tree.getBranches()[branchId];

  if (sculptMode === 'wire') {
    const wiredLabel = branch.wired
      ? `wired \xb7 angle ${branch.angle.toFixed(1)}\xb0 \xb7 applied day ${branch.wireAppliedDay}`
      : `unwired \xb7 angle ${branch.angle.toFixed(1)}\xb0`;
    wireBranchInfo.textContent = `Branch #${branchId} \xb7 ${wiredLabel}`;
    btnWireRemove.style.display = branch.wired ? '' : 'none';
    wireControls.style.display = '';
    wireAngleInput.value = '0';
    wireAngleLabel.textContent = '0\xb0';
  }

  if (sculptMode === 'twine') {
    const twinedLabel = branch.twined
      ? `twined \xb7 angle ${branch.angle.toFixed(1)}\xb0 \xb7 degrades day ${branch.twineDegradesDay}`
      : `free \xb7 angle ${branch.angle.toFixed(1)}\xb0`;
    twineBranchInfo.textContent = `Branch #${branchId} \xb7 ${twinedLabel}`;
    btnTwineRemove.style.display = branch.twined ? '' : 'none';
    twineControls.style.display = '';
    twineAngleInput.value = '0';
    twineAngleLabel.textContent = '0\xb0';
  }

  if (sculptMode === 'weight') {
    const weightedLabel = branch.weighted
      ? `weighted (${branch.weightCount} bags) \xb7 angle ${branch.angle.toFixed(1)}\xb0`
      : `no weight \xb7 angle ${branch.angle.toFixed(1)}\xb0`;
    weightBranchInfo.textContent = `Branch #${branchId} \xb7 ${weightedLabel}`;
    btnWeightRemove.style.display = branch.weighted ? '' : 'none';
    weightControls.style.display = '';
    weightCountSelect.value = '1';
    weightAnglePreview.textContent = '+7\xb0 down';
  }

  if (sculptMode === 'jin') {
    const maxSeg = Math.max(0, Math.floor(branch.length) - 1);
    jinBranchInfo.textContent = `Branch #${branchId} \xb7 length ${branch.length.toFixed(1)} \xb7 segments 0–${maxSeg}`;
    jinSegmentInput.max = String(maxSeg);
    jinSegmentInput.value = '0';
    jinCostLabel.textContent = 'Cost: 1 jin';
    jinControls.style.display = '';
  }
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
    none: 'Drag to orbit \xb7 scroll to zoom \xb7 the blue ghost is roughly where this seed wants to grow',
    prune: 'Prune mode: click a branch voxel to cut it. Trunk is protected.',
    wire: 'Wire mode: click a branch to select it. Set bend angle and click Apply.',
    twine: 'Twine mode: click a branch to select it. +/-28 deg max. Free tier -- temporary binding.',
    weight: 'Weight mode: click a branch to select it. Gravity-only (downward). 1-4 bags.',
    jin: 'Jin mode: click a branch to select it. Choose segment index. IRREVERSIBLE.',
    landscape: 'Landscape mode: choose an element type and position, then click Place.',
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
  setSculptMode(sculptMode === 'wire' ? 'none' : 'wire');
});

const pruneBtn = document.getElementById('btn-prune')!;
pruneBtn.addEventListener('click', () => {
  setSculptMode(sculptMode === 'prune' ? 'none' : 'prune');
});

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
  setSculptMode(sculptMode === 'landscape' ? 'none' : 'landscape');
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
// Twine apply / remove event listeners (SCULPT-ADD 2026-08-29)
// ---------------------------------------------------------------------------

btnTwineApply.addEventListener('click', () => {
  if (selectedBranchId === null) return;
  const angleDelta = parseFloat(twineAngleInput.value);
  if (!Number.isFinite(angleDelta) || angleDelta === 0) {
    hintEl.textContent = 'No angle change -- adjust the slider before applying twine.';
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
    `Branch #${selectedBranchId} \xb7 twined \xb7 angle ${branch.angle.toFixed(1)}\xb0 \xb7 degrades day ${branch.twineDegradesDay}`;
  btnTwineRemove.style.display = '';
  twineAngleInput.value = '0';
  twineAngleLabel.textContent = '0\xb0';
});

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
  twineBranchInfo.textContent = `Branch #${bid} \xb7 free \xb7 angle ${updated.angle.toFixed(1)}\xb0`;
  btnTwineRemove.style.display = 'none';
  twineAngleInput.value = '0';
  twineAngleLabel.textContent = '0\xb0';
});

// Twine angle slider preview (SCULPT-ADD 2026-08-29)
twineAngleInput.addEventListener('input', () => {
  twineAngleLabel.textContent = `${twineAngleInput.value}\xb0`;
  if (selectedBranchId !== null) {
    const branch = tree.getBranches()[selectedBranchId];
    if (branch) {
      const delta = parseFloat(twineAngleInput.value);
      if (delta !== 0) {
        const preview = Math.min(Math.max(branch.angle + delta, PREVIEW_POLAR_MIN), 150);
        twineBranchInfo.textContent =
          `Branch #${selectedBranchId} \xb7 ${branch.twined ? 'twined' : 'free'} \xb7 ${branch.angle.toFixed(1)}\xb0 → ${preview.toFixed(1)}\xb0`;
      } else {
        const label = branch.twined
          ? `twined \xb7 angle ${branch.angle.toFixed(1)}\xb0 \xb7 degrades day ${branch.twineDegradesDay}`
          : `free \xb7 angle ${branch.angle.toFixed(1)}\xb0`;
        twineBranchInfo.textContent = `Branch #${selectedBranchId} \xb7 ${label}`;
      }
    }
  }
});

// ---------------------------------------------------------------------------
// Weight apply / remove event listeners (SCULPT-ADD 2026-08-29)
// ---------------------------------------------------------------------------

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
    `Branch #${selectedBranchId} \xb7 weighted (${branch.weightCount} bags) \xb7 angle ${branch.angle.toFixed(1)}\xb0`;
  btnWeightRemove.style.display = '';
});

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
  weightBranchInfo.textContent = `Branch #${bid} \xb7 no weight \xb7 angle ${updated.angle.toFixed(1)}\xb0`;
  btnWeightRemove.style.display = 'none';
});

// Weight count preview (SCULPT-ADD 2026-08-29)
weightCountSelect.addEventListener('change', () => {
  const wc = parseInt(weightCountSelect.value, 10);
  weightAnglePreview.textContent = `+${wc * 7}\xb0 down`;
});

// ---------------------------------------------------------------------------
// Jin apply event listener (SCULPT-ADD 2026-08-29)
// Phase 1: JinEngine.applyJin THROWS CareLogReplayError after validation.
// The UI catches it and shows the stub message.
// ---------------------------------------------------------------------------

btnJinApply.addEventListener('click', () => {
  if (selectedBranchId === null) return;
  const segIdx = parseInt(jinSegmentInput.value, 10);
  const jinCost = 1; // Phase 1: fixed cost = 1

  // Jin is IRREVERSIBLE -- require confirmation.
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

// ---------------------------------------------------------------------------
// Landscape apply event listener (SCULPT-ADD 2026-08-29) -- NOT branch-targeted
// ---------------------------------------------------------------------------

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

  // Atelier room animation (god-ray pulse + seeded dust drift).
  if (roomTick) roomTick(clock.elapsedTime, dt);

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
