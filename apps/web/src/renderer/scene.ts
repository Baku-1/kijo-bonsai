import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createAtelierRoom } from './atelier_room';
import { loadAtelierTextures } from './atelier_textures';

// ---------------------------------------------------------------------------
// Kijo care client -- Three.js scene shell (Layer 1, item 1).
// The Bonsai Atelier workshop room surrounds the care tree: plaster walls,
// hinoki floor, shoji window on the -X side with morning god rays, dark wet
// ceramic pot with soil/moss/stones at the tree base, hinoki workbench with
// copper tools, seeded dust motes.
//
// Voxel->world mapping (tree_mesh.ts): (x-128, y-38, z-128), so trunk base
// (voxel 128,38,128) lands exactly on the pot soil surface at the origin.
//
// SCALE: the care tree maps 1 voxel = 1 world unit and can reach y~150-200,
// so the room group is scaled ATELIER_SCALE=110 (vs S=8 in the NFT viewer)
// with its soil plane aligned to world y=0 -- the tree base. Room pieces
// enclose the orbit camera (ceiling ~241 world units above the base).
//
// The room textures load async: the old cream backdrop/ground/pot stays in
// place until the room resolves to avoid a flash of untextured meshes, then
// the old pieces are removed so exactly ONE pot sits at the tree base.
// ---------------------------------------------------------------------------

export interface CareScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  treeRoot: THREE.Group; // tree meshes attach here
  tick: (elapsed: number, dt: number) => void; // atelier room animation
}

// Room scale for the care scenes (grok units -> world units). Interior
// ceiling lands at 3.15 * ATELIER_SCALE + ROOM_Y = ~241 world units, clear of
// a ~200-unit tree crown.
const ATELIER_SCALE = 110;
// World y of the pot soil plane == the tree base (voxel 128,38,128).
const ATELIER_BASE_Y = 0;

export function createScene(container: HTMLElement): CareScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x16120e); // dark warm workshop
  scene.fog = new THREE.FogExp2(0x16120e, 0.0018); // subtle warm haze

  // --- Renderer ---
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.appendChild(renderer.domElement);

  // --- Atelier lighting: warm key from the shoji window (-X), soft fill ---
  // Positions are authored for ATELIER_SCALE=110 (window at x ~= -270).
  const ambient = new THREE.AmbientLight(0x3a322c, 0.45);
  scene.add(ambient);
  const hemi = new THREE.HemisphereLight(0xffd9b0, 0x1a1410, 0.55);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffe3b8, 2.4);
  key.position.set(-320, 220, 80); // through the -X window
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
  fill.position.set(220, 80, -160); // right side, gentle bounce
  scene.add(fill);
  const windowLight = new THREE.SpotLight(0xffe6bf, 80000, 450, 0.5, 0.8);
  windowLight.position.set(-160, 90, 20); // inside the window shaft
  windowLight.target.position.set(0, 20, 0);
  scene.add(windowLight);
  scene.add(windowLight.target);

  // --- Old backdrop: cream ground + plain terracotta pot. Kept until the
  // atelier room textures resolve, then removed so exactly ONE pot exists. ---
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(220, 48),
    new THREE.MeshLambertMaterial({ color: '#E8E0D4' })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -10.2;
  scene.add(ground);

  const potMat = new THREE.MeshLambertMaterial({ color: '#C07848' });
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(17, 13, 10, 24), potMat);
  pot.position.y = -5.2;
  scene.add(pot);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(18, 17, 1.6, 24), potMat);
  rim.position.y = -0.8;
  scene.add(rim);
  const soil = new THREE.Mesh(
    new THREE.CylinderGeometry(16.4, 16.4, 0.8, 24),
    new THREE.MeshLambertMaterial({ color: '#2A1808' })
  );
  soil.position.y = 0.0;
  scene.add(soil);

  // --- Tree root group: all tree meshes live under here (raycast target) ---
  const treeRoot = new THREE.Group();
  scene.add(treeRoot);

  // --- Camera: slightly elevated three-quarter view of the tree ---
  const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    2000
  );
  camera.position.set(90, 120, 120);

  // --- OrbitControls: drag to orbit, scroll/pinch to zoom (touch native).
  // Bounds keep the camera INSIDE the room: no panning through walls, polar
  // range stays above the bench and below the ceiling, distance stays within
  // the walls. ---
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 70, 0); // mid-canopy of a mature tree
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 35;
  controls.maxDistance = 185;
  controls.minPolarAngle = 0.5;  // stay below the ceiling (~241 world y)
  controls.maxPolarAngle = 1.4;  // stay above the bench/floor
  controls.update();

  // --- Room tick: no-op until the atelier loads ---
  let roomTick: ((elapsed: number, dt: number) => void) | null = null;

  // --- Load the atelier room (async; keep the old backdrop until resolved) ---
  loadAtelierTextures()
    .then((tex) => {
      scene.environment = tex.env;
      scene.environmentIntensity = 0.35;
      const room = createAtelierRoom(tex, { scale: ATELIER_SCALE, baseY: ATELIER_BASE_Y });
      scene.add(room.group);
      roomTick = room.tick;

      // Remove the old backdrop + plain pot -- exactly ONE pot now (the room's).
      scene.remove(ground, pot, rim, soil);
      ground.geometry.dispose();
      (ground.material as THREE.Material).dispose();
      pot.geometry.dispose();
      potMat.dispose();
      rim.geometry.dispose();
      soil.geometry.dispose();
      (soil.material as THREE.Material).dispose();
    })
    .catch((err: unknown) => {
      console.warn('[kijo-care] atelier room load failed; keeping flat backdrop.', err);
    });

  // --- Resize handling (mobile-first: rotation changes viewport) ---
  window.addEventListener('resize', () => {
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  const tick = (elapsed: number, dt: number): void => {
    if (roomTick) roomTick(elapsed, dt);
  };

  return { scene, camera, renderer, controls, treeRoot, tick };
}
