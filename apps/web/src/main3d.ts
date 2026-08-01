import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BonsaiTree, GrowthEngine, StatDeriver, StatTerrain } from '@kijo/engine';
import type { SpeciesClass } from '@kijo/shared';
import { WATER_AMOUNT } from '@kijo/shared';
import { Voxelizer, VoxelRole, Material } from '@kijo/voxelizer';
import type { SparseVoxelSet, VoxelizeResult } from '@kijo/voxelizer';
import { mossMat } from './renderer/tree_mesh.js';

// ===========================================================================
// Kijo 3D care loop — the voxel grid is the truth; this renders it.
//
// Design decisions baked in here (owner directives 2026-07-18):
//  • Lazy-load by structure: trunk + depth-1 limbs appear instantly, depth-2
//    branches next, then the leaf/canopy flood streams in last. Structure
//    first, decoration last — also the perf story for 9k+ voxel trees.
//  • Ideal-path guidance is a HINT, not a solution: a soft ghost column
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

// World transform: grid (0..255, y up) → world centered on pot.
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
// Pot — PBR ceramic material.
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

  // Moss soil disc — sits at the top of the pot (y=5 = top rim).
  const soilGeo = new THREE.CircleGeometry(15.5, 32);
  const soil = new THREE.Mesh(soilGeo, mossMat);
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = 5;
  scene.add(soil);
}

// ---------------------------------------------------------------------------
// Ghost hint — soft shell around the ideal-path region (Chokkan: vertical
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

// Map populated in the init block below.
const VOXEL_MATS: Record<number, THREE.MeshStandardMaterial> = {};

// ---------------------------------------------------------------------------
// Voxel instancing — one InstancedMesh per material, rebuilt after mutations.
// Stream order: structure (depth ≤2 wood + trunk/root) first, canopy last.
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

  // Bark PBR — shared by HEARTWOOD + BARK + BRANCH_WOOD voxel types.
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

  // Canopy streams in over ~1.5s — leaves flood in last.
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
let latestVoxels: VoxelizeResult | null = null;

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
  fertStatus.textContent = tree.isFertilizerActive() ? 'fertilizer ACTIVE (1.7× growth)' : '';

  rebuildVoxels(latestVoxels.voxels);
}

// ---------------------------------------------------------------------------
// Prune picking — raycast against voxel instances, map instanceId → branchId
// via the voxel set's branchId at that coordinate.
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (!pruneMode || !latestVoxels) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObjects([...meshes.values()], false);
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
    if (cell.branchId === 0) continue; // trunk protected
    tree.prune(cell.branchId);
    refreshAll();
    return;
  }
});

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------
document.getElementById('btn-new')!.addEventListener('click', () => {
  tree = newTree();
  pruneMode = false;
  document.getElementById('btn-prune')!.classList.remove('active');
  exportOut.value = '';
  refreshAll();
});
document.getElementById('btn-water')!.addEventListener('click', () => { tree.water(WATER_AMOUNT); tree.markDirty(); refreshAll(); });
document.getElementById('btn-fertilize')!.addEventListener('click', () => { tree.fertilize(); refreshAll(); });
document.getElementById('btn-rotate')!.addEventListener('click', () => { tree.rotate(); refreshAll(); });

const pruneBtn = document.getElementById('btn-prune')!;
pruneBtn.addEventListener('click', () => {
  pruneMode = !pruneMode;
  pruneBtn.classList.toggle('active', pruneMode);
  controls.enableRotate = !pruneMode; // don't fight the camera while pruning
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
refreshAll();
animate();
