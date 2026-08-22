// apps/web/src/viewer.ts
// Public animation_url viewer for Kijonsai NFTs.
// Read-only -- no care UI. Fetches tree state via get-tree-public Edge Function.
// Runs CareLogReplay + Voxelizer client-side for a live "current state" render.
//
// URL form: ?tokenId=42  (query param)
// Three.js r166 -- MeshPhysicalMaterial.transmission fully supported.
//
// No Math.random() -- all randomness flows from seed (determinism invariant).

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CareLogReplay, BonsaiTree } from '@kijo/engine';
import { Voxelizer, Material } from '@kijo/voxelizer';
import type { CareAction, SpeciesClass } from '@kijo/shared';

// ---------------------------------------------------------------------------
// Supabase project reference (must match deployed project)
// ---------------------------------------------------------------------------
const SUPABASE_URL    = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY        = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const GET_TREE_PUBLIC = `${SUPABASE_URL}/functions/v1/get-tree-public`;

// ---------------------------------------------------------------------------
// Constants -- must match glb.ts and main3d.ts
// ---------------------------------------------------------------------------
const VOXEL_SCALE = 0.08;
const CENTER      = 128;
const BASE_Y      = 38;
const HEALTH_WILTING_THRESHOLD = 30;

// ---------------------------------------------------------------------------
// Parse tokenId from URL query params
// ---------------------------------------------------------------------------
function getTokenId(): number | null {
  const params = new URLSearchParams(window.location.search);
  const raw    = params.get('tokenId');
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return isNaN(n) ? null : n;
}

// ---------------------------------------------------------------------------
// Fetch tree data from get-tree-public Edge Function
// ---------------------------------------------------------------------------
interface CareLogEntryRaw {
  day:    number;
  action: CareAction;   // Edge Function serialises full CareAction JSON
}

interface TreePublicData {
  token_id:         number;
  seed:             number;
  species:          SpeciesClass;
  current_day:      number;
  health:           number;
  born_at:          string;
  care_log_entries: CareLogEntryRaw[];
}

async function fetchTree(tokenId: number): Promise<TreePublicData> {
  const res = await fetch(`${GET_TREE_PUBLIC}?tokenId=${tokenId}`, {
    headers: {
      'apikey':        ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`get-tree-public returned ${res.status}: ${body}`);
  }
  return res.json() as Promise<TreePublicData>;
}

// ---------------------------------------------------------------------------
// Reconstruct tree from public data.
// Server already filters landscape; we also filter 'tick' defensively
// so CareLogReplay never receives either.
// ---------------------------------------------------------------------------
const EXCLUDED_ACTIONS = new Set<CareAction['type']>(['tick', 'landscape'] as CareAction['type'][]);

function reconstructTree(data: TreePublicData): BonsaiTree {
  const careLog = data.care_log_entries
    .filter(e => !EXCLUDED_ACTIONS.has(e.action.type))
    .map(e => ({ day: e.day, action: e.action }));

  if (data.current_day <= 0) {
    return new BonsaiTree(data.seed, data.species);
  }
  return CareLogReplay.reconstruct(data.seed, data.species, careLog, data.current_day);
}

// ---------------------------------------------------------------------------
// Grunge opacity based on tree health
// ---------------------------------------------------------------------------
function healthToGrungeOpacity(health: number): number {
  if (health >= 60) return 0.0;
  if (health < HEALTH_WILTING_THRESHOLD) return 0.7;
  // stressed: linear 0.4 -> 0.0 as health goes from 30 -> 60
  return 0.4 * (1.0 - (health - HEALTH_WILTING_THRESHOLD) / (60 - HEALTH_WILTING_THRESHOLD));
}

// ---------------------------------------------------------------------------
// Voxel grid coords -> world space (matches main3d.ts gridToWorld)
// ---------------------------------------------------------------------------
function gridToWorld(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(
    (x - CENTER) * VOXEL_SCALE,
    (y - BASE_Y)  * VOXEL_SCALE,
    (z - CENTER)  * VOXEL_SCALE,
  );
}

// ---------------------------------------------------------------------------
// Main viewer
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const statusEl = document.getElementById('status');
  const setStatus = (msg: string): void => { if (statusEl) statusEl.textContent = msg; };

  const tokenId = getTokenId();
  if (!tokenId) {
    setStatus('Error: tokenId query param required (?tokenId=42)');
    return;
  }

  setStatus(`Loading Kijonsai #${tokenId}...`);

  // -- Renderer --
  const canvas   = document.getElementById('canvas') as HTMLCanvasElement;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  const scene  = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 1000);
  camera.position.set(0, 8, 20);
  camera.lookAt(0, 4, 0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  // Lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const sun = new THREE.DirectionalLight(0xfff5e0, 1.2);
  sun.position.set(5, 10, 5);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x8ab4f8, 0.3);
  fill.position.set(-5, 3, -5);
  scene.add(fill);

  // -- Texture loader --
  const tl     = new THREE.TextureLoader();
  const srgb   = THREE.SRGBColorSpace;
  const linear = THREE.LinearSRGBColorSpace;
  const tex    = (path: string, cs: string): THREE.Texture => {
    const t = tl.load(path);
    (t as unknown as { colorSpace: string }).colorSpace = cs;
    return t;
  };

  // Bark
  const tBase   = tex('/textures/Bonsai_LowPoly_Bonsai_Trunk_BaseColor.jpg',        srgb);
  const tNormal = tex('/textures/Bonsai_LowPoly_Bonsai_Trunk_LowPoly_NormalGL.jpg', linear);
  const tAMR    = tex('/textures/Bonsai_LowPoly_Bonsai_Trunk_AMR.jpg',              linear);
  // Leaves
  const lBase         = tex('/textures/Bonsai_LowPoly_Leaves_BaseColor.jpg',    srgb);
  const lNormal       = tex('/textures/Bonsai_LowPoly_Leaves_NormalGL.jpg',     linear);
  const lRough        = tex('/textures/Bonsai_LowPoly_Leaves_Roughness.jpg',    linear);
  const lTranslucency = tex('/textures/Bonsai_LowPoly_Leaves_Translucency.png', linear);
  // Grunge
  const grungeAlive = tex('/textures/Bonsai_Grunge_Alive.png', linear);
  const grungeDead  = tex('/textures/Bonsai_Grunge_Dead.png',  linear);

  // -- PBR materials --
  const barkMat = new THREE.MeshStandardMaterial({
    map: tBase, normalMap: tNormal, normalScale: new THREE.Vector2(1, 1),
    roughnessMap: tAMR, aoMap: tAMR, aoMapIntensity: 1.0,
    roughness: 0.8, metalness: 0.0,
  });

  // MeshPhysicalMaterial for leaf light-through (r166: transmission fully supported)
  const leafMat = new THREE.MeshPhysicalMaterial({
    map: lBase, normalMap: lNormal, normalScale: new THREE.Vector2(0.5, 0.5),
    roughnessMap: lRough, roughness: 0.75, metalness: 0.0,
    color: 0x5a8f3c, side: THREE.DoubleSide,
    transmission: 0.3,
    transmissionMap: lTranslucency,
    thickness: 0.05,
  });

  const rootMat = new THREE.MeshStandardMaterial({ color: 0x3d2c1a });
  const scarMat = new THREE.MeshStandardMaterial({ color: 0x8c8c74 });

  // -- Fetch tree --
  let treeData: TreePublicData;
  try {
    treeData = await fetchTree(tokenId);
  } catch (err) {
    setStatus(`Error loading tree: ${err}`);
    return;
  }

  setStatus(`Reconstructing Kijonsai #${tokenId} (day ${treeData.current_day})...`);

  let bonsai: BonsaiTree;
  try {
    bonsai = reconstructTree(treeData);
  } catch (err) {
    setStatus(`Error reconstructing tree: ${err}`);
    return;
  }

  const { voxels } = Voxelizer.voxelize(bonsai);

  // -- Build InstancedMesh per material group --
  // Use forEach (direct Map iteration, no sort/copy allocation) per Carmack review note.
  const groups = new Map<number, THREE.Vector3[]>();
  voxels.forEach((x, y, z, mat) => {
    if (!groups.has(mat)) groups.set(mat, []);
    groups.get(mat)!.push(gridToWorld(x, y, z));
  });

  const voxelGeo = new THREE.BoxGeometry(VOXEL_SCALE, VOXEL_SCALE, VOXEL_SCALE);
  const dummy    = new THREE.Object3D();
  let   barkMesh: THREE.InstancedMesh | null = null;

  for (const [mat, positions] of groups) {
    const material =
      mat === Material.LEAF       ? leafMat :
      mat === Material.ROOT       ? rootMat :
      mat === Material.PRUNE_SCAR ? scarMat :
      barkMat; // HEARTWOOD, BARK, BRANCH_WOOD

    const mesh = new THREE.InstancedMesh(voxelGeo, material, positions.length);
    mesh.castShadow = mesh.receiveShadow = true;
    positions.forEach((pos, i) => {
      dummy.position.copy(pos);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);

    if (mat === Material.BARK || mat === Material.HEARTWOOD || mat === Material.BRANCH_WOOD) {
      if (!barkMesh || mat === Material.BARK) barkMesh = mesh; // prefer BARK (most numerous)
    }
  }

  // -- TWO-PASS GRUNGE OVERLAY --
  // Separate transparent grungeMesh with alphaMap overlaid on bark voxels.
  // Leaves barkMat.aoMap (Trunk_AMR baked AO) untouched -- per CAVEAT-5.
  const health        = treeData.health ?? 100;
  const grungeOpacity = healthToGrungeOpacity(health);

  if (barkMesh && grungeOpacity > 0) {
    const grungeMap = health < HEALTH_WILTING_THRESHOLD ? grungeDead : grungeAlive;
    const grungeMesh = new THREE.InstancedMesh(
      barkMesh.geometry,
      new THREE.MeshStandardMaterial({
        alphaMap: grungeMap, transparent: true,
        opacity: grungeOpacity, color: 0x1a1008, depthWrite: false,
      }),
      barkMesh.count,
    );
    for (let i = 0; i < barkMesh.count; i++) {
      barkMesh.getMatrixAt(i, dummy.matrix);
      grungeMesh.setMatrixAt(i, dummy.matrix);
    }
    grungeMesh.instanceMatrix.needsUpdate = true;
    grungeMesh.renderOrder = 1;
    scene.add(grungeMesh);
  }

  setStatus('');

  // -- GLB download link --
  const glbStorageUrl = `${SUPABASE_URL}/storage/v1/object/public/renders/${tokenId}.glb`;
  const dlLink = document.createElement('a');
  dlLink.href          = glbStorageUrl;
  dlLink.download      = `kijonsai-${tokenId}.glb`;
  dlLink.textContent   = 'Download GLB for WebXR';
  dlLink.style.cssText = 'position:absolute;bottom:20px;left:20px;color:#9fc7ff;font-family:sans-serif;font-size:14px;';
  document.body.appendChild(dlLink);

  // -- Resize --
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // -- Render loop --
  function render(): void {
    controls.update();
    renderer.render(scene, camera);
  }

  // setAnimationLoop drives WebXR (CAVEAT-6). Also behaves like rAF when XR is inactive.
  renderer.xr.enabled = true;
  renderer.setAnimationLoop(render);

  // -- Looking Glass WebXR init (~20 lines) --
  // @lookingglass/webxr polyfill loaded via CDN in index-viewer.html BEFORE this module.
  // When LKG Bridge is running the polyfill makes navigator.xr.isSessionSupported return
  // true for 'immersive-vr' and intercepts requestSession to drive the holographic display.
  await initLookingGlass(renderer, render);
}

// ---------------------------------------------------------------------------
// Looking Glass WebXR button (~20 lines)
// ---------------------------------------------------------------------------
async function initLookingGlass(
  renderer: THREE.WebGLRenderer,
  renderFn: () => void,
): Promise<void> {
  if (!navigator.xr) return;
  const supported = await navigator.xr.isSessionSupported('immersive-vr').catch(() => false);
  if (!supported) return;

  const btn = document.createElement('button');
  btn.textContent  = 'View on Looking Glass';
  btn.style.cssText = 'position:absolute;bottom:20px;right:20px;padding:10px 20px;' +
    'font-family:sans-serif;font-size:14px;cursor:pointer;' +
    'background:#1a3a6c;color:#fff;border:none;border-radius:4px;';
  document.body.appendChild(btn);

  btn.addEventListener('click', async () => {
    try {
      const session = await navigator.xr!.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'bounded-floor'],
      });
      await renderer.xr.setSession(session);
      renderer.setAnimationLoop(renderFn);
    } catch (err) {
      console.error('[viewer] LKG session request failed:', err);
    }
  });
}

// Boot
main().catch(err => {
  console.error('[viewer] fatal:', err);
  const el = document.getElementById('status');
  if (el) el.textContent = `Fatal: ${err}`;
});
