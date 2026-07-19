import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ---------------------------------------------------------------------------
// Kijo care client — Three.js scene shell (Layer 1, item 1).
// Warm morning-sun feel on a cream/parchment backdrop, matching the
// prototype aesthetic. The pot sits at the origin; the tree grows +Y.
// Voxel->world mapping (tree_mesh.ts): (x-128, y-38, z-128), so trunk base
// (voxel 128,38,128) lands exactly on the soil surface at the origin.
// ---------------------------------------------------------------------------

export interface CareScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  treeRoot: THREE.Group; // tree meshes attach here
}

export function createScene(container: HTMLElement): CareScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#F4EDE2'); // cream / parchment

  // --- Lights: soft ambient + one warm directional (morning sun) ---
  const ambient = new THREE.AmbientLight('#FFF4E0', 0.55);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight('#FFE3C0', 1.35);
  sun.position.set(80, 140, 60); // slight angle, high — morning
  scene.add(sun);
  // Gentle fill from the opposite side so shadowed faces stay readable.
  const fill = new THREE.DirectionalLight('#E8E0D4', 0.35);
  fill.position.set(-60, 40, -80);
  scene.add(fill);

  // --- Ground / table surface ---
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(220, 48),
    new THREE.MeshLambertMaterial({ color: '#E8E0D4' })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -10.2;
  scene.add(ground);

  // --- Ceramic pot at origin (terracotta) with soil surface on top ---
  // Tapered cylinder: wider at top than bottom, like a real bonsai pot.
  const potMat = new THREE.MeshLambertMaterial({ color: '#C07848' });
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(17, 13, 10, 24), potMat);
  pot.position.y = -5.2;
  scene.add(pot);
  // Rim lip
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(18, 17, 1.6, 24), potMat);
  rim.position.y = -0.8;
  scene.add(rim);
  // Soil surface — dark, at y=0 where the trunk base (voxel y=38) lands.
  const soil = new THREE.Mesh(
    new THREE.CylinderGeometry(16.4, 16.4, 0.8, 24),
    new THREE.MeshLambertMaterial({ color: '#2A1808' })
  );
  soil.position.y = 0.0;
  scene.add(soil);

  // --- Tree root group: all tree meshes live under here ---
  const treeRoot = new THREE.Group();
  scene.add(treeRoot);

  // --- Camera: slightly above and in front, looking down ~30 degrees ---
  const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    2000
  );
  camera.position.set(85, 75, 85);

  // --- Renderer ---
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  // --- OrbitControls: drag to orbit, scroll/pinch to zoom (touch native) ---
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 40, 0); // mid-canopy of a young tree
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 25;
  controls.maxDistance = 400;
  controls.maxPolarAngle = Math.PI * 0.52; // don't go under the table
  controls.update();

  // --- Resize handling (mobile-first: rotation changes viewport) ---
  window.addEventListener('resize', () => {
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  return { scene, camera, renderer, controls, treeRoot };
}
