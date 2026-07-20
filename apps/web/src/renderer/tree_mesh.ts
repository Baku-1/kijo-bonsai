import * as THREE from 'three';
import { SeededRNG } from '@kijo/shared';
import type { Branch, SpeciesClass } from '@kijo/shared';
import type { BonsaiTree } from '@kijo/engine';

// ---------------------------------------------------------------------------
// Kijo care client — parametric tree mesh builder (Layer 1, item 2).
//
// The 3D embedding here MIRRORS @kijo/voxelizer's computePositions exactly:
//   - golden-ratio azimuth: (branch.id x 137.508 deg) mod 2 PI
//   - polar angle: clamp(|branch.angle| deg->rad, 0.1, 1.4)
//   - start = parentStart + parentDir x branch.attachmentY (one-third rule)
//   - trunk grows +Y from voxel base (128,38,128) -> world origin
// so the mesh you orbit is the same tree the stat pipeline voxelizes.
// Zero growth logic lives here — this file only reads Branch state.
//
// NOTE: the shipped Branch has no `curve` field. Curved-bezier trunks are a
// future engine feature; branches render as straight tapered tubes, exactly
// like the voxelizer's tube fill.
// ---------------------------------------------------------------------------

type Vec3 = { x: number; y: number; z: number };

// Exact port of the voxelizer's private rotateDirection (orientation math is
// presentation, not growth logic — duplicating it here keeps the visual tree
// identical to the voxelized tree without touching engine packages).
function rotateDirection(parent: Vec3, polar: number, azimuthal: number): Vec3 {
  const len = Math.sqrt(parent.x ** 2 + parent.y ** 2 + parent.z ** 2);
  const p = { x: parent.x / len, y: parent.y / len, z: parent.z / len };
  const perp: Vec3 = Math.abs(p.y) < 0.9 ? { x: -p.z, y: 0, z: p.x } : { x: 1, y: 0, z: 0 };
  const pLen = Math.sqrt(perp.x ** 2 + perp.y ** 2 + perp.z ** 2);
  const u = { x: perp.x / pLen, y: perp.y / pLen, z: perp.z / pLen };
  const v = { x: p.y * u.z - p.z * u.y, y: p.z * u.x - p.x * u.z, z: p.x * u.y - p.y * u.x };
  const cosA = Math.cos(azimuthal), sinA = Math.sin(azimuthal);
  const rotU = { x: cosA * u.x + sinA * v.x, y: cosA * u.y + sinA * v.y, z: cosA * u.z + sinA * v.z };
  const cosP = Math.cos(polar), sinP = Math.sin(polar);
  return { x: cosP * p.x + sinP * rotU.x, y: cosP * p.y + sinP * rotU.y, z: cosP * p.z + sinP * rotU.z };
}

// Voxel grid (128,38,128) -> world origin (pot soil surface).
const BASE: Vec3 = { x: 128, y: 38, z: 128 };
function toWorld(v: Vec3): THREE.Vector3 {
  return new THREE.Vector3(v.x - BASE.x, v.y - BASE.y, v.z - BASE.z);
}

// ---------------------------------------------------------------------------
// PBR texture loading — shared materials, loaded once, reused across all
// branch meshes. TextureLoader is stateless; caches by URL internally.
// ---------------------------------------------------------------------------
const loader = new THREE.TextureLoader();

function loadTex(path: string, colorSpace: THREE.ColorSpace = THREE.LinearSRGBColorSpace): THREE.Texture {
  const t = loader.load(path);
  t.colorSpace = colorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Trunk textures. Repeat scale chosen so the bark pattern tiles naturally on
// ~6-unit-radius trunk cylinders without looking stretched or bricklike.
const TRUNK_REPEAT = new THREE.Vector2(2, 4);
const trunkBase   = loadTex('/textures/Bonsai_LowPoly_Bonsai_Trunk_BaseColor.jpg', THREE.SRGBColorSpace);
const trunkNormal = loadTex('/textures/Bonsai_LowPoly_Bonsai_Trunk_LowPoly_NormalGL.jpg');
const trunkAMR    = loadTex('/textures/Bonsai_LowPoly_Bonsai_Trunk_AMR.jpg');
trunkBase.repeat.copy(TRUNK_REPEAT);
trunkNormal.repeat.copy(TRUNK_REPEAT);
trunkAMR.repeat.copy(TRUNK_REPEAT);

// Leaf textures — small cards, single tile per sphere face looks fine.
const leafBase      = loadTex('/textures/Bonsai_LowPoly_Leaves_BaseColor.jpg', THREE.SRGBColorSpace);
const leafNormal    = loadTex('/textures/Bonsai_LowPoly_Leaves_NormalGL.jpg');
const leafRoughness = loadTex('/textures/Bonsai_LowPoly_Leaves_Roughness.jpg');

// Moss for ground cover patch inside the pot top.
const mossBase      = loadTex('/textures/Bonsai_LowPoly_Moss_Baked_BaseColor.jpg', THREE.SRGBColorSpace);
const mossNormal    = loadTex('/textures/Bonsai_LowPoly_Moss_Baked_NormalGL.jpg');
const mossRoughness = loadTex('/textures/Bonsai_LowPoly_Moss_Baked_Roughness.jpg');

// ---------------------------------------------------------------------------
// Shared material instances — one per visual category.
// The trunk material is cloned per branch so each gets its own repeat scale
// driven by branch length; leaf material is shared (same repeat on all).
// AMR texture: A=AO(R), M=metallic(G), R=roughness(B).
// Wood is non-metallic (metalness=0) so we use AMR.R for AO, AMR.B for roughness.
// ---------------------------------------------------------------------------
function makeTrunkMat(thickness: number): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    map: trunkBase,
    normalMap: trunkNormal,
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughnessMap: trunkAMR,   // Three reads G channel for roughness
    aoMap: trunkAMR,          // Three reads R channel for AO
    roughness: 0.88,
    metalness: 0.0,
  });
  // Thicker branches tile the texture more — prevents single bark panel look.
  const rep = Math.max(1, Math.round(thickness * 0.6));
  mat.map!.repeat.set(rep, 4);
  mat.normalMap!.repeat.set(rep, 4);
  mat.roughnessMap!.repeat.set(rep, 4);
  mat.aoMap!.repeat.set(rep, 4);
  return mat;
}

// Leaf material — shared, transparent for eventual alpha-clip upgrade.
const leafMat = new THREE.MeshStandardMaterial({
  map: leafBase,
  normalMap: leafNormal,
  normalScale: new THREE.Vector2(0.5, 0.5),
  roughnessMap: leafRoughness,
  roughness: 0.75,
  metalness: 0.0,
  side: THREE.DoubleSide,
});

// Moss material — used for the soil disc inside the pot top.
export const mossMat = new THREE.MeshStandardMaterial({
  map: mossBase,
  normalMap: mossNormal,
  normalScale: new THREE.Vector2(0.6, 0.6),
  roughnessMap: mossRoughness,
  roughness: 0.9,
  metalness: 0.0,
});

// Prune-scar material — dark resin, no texture needed.
const scarMat = new THREE.MeshStandardMaterial({ color: 0x1a0f06, roughness: 0.6 });

// ---------------------------------------------------------------------------
// Species leaf color tints — multiplied on top of the leaf base texture.
// Deterministic per branch: SeededRNG(branch.id * 997), same salt the tech
// spec uses for leaf placement. 3% rare gold roll preserved.
// ---------------------------------------------------------------------------
const LEAF_PALETTES: Record<SpeciesClass, number[]> = {
  hardwood: [0x4e8a3c, 0xb03a2e],
  evergreen: [0x3a7d44, 0x2e6e6a],
  tropical: [0x57a639, 0x2f5d2a, 0xc2a05c],
};
const RARE_LEAF = 0xd4af37;
const RARE_CHANCE = 0.03;

function leafColor(species: SpeciesClass, branchId: number): THREE.Color {
  const rng = new SeededRNG(branchId * 997);
  if (rng.next() < RARE_CHANCE) return new THREE.Color(RARE_LEAF);
  const palette = LEAF_PALETTES[species];
  return new THREE.Color(palette[Math.floor(rng.next() * palette.length) % palette.length]);
}

// ---------------------------------------------------------------------------
// Branch placement — same recursion as the voxelizer's computePositions.
// ---------------------------------------------------------------------------
interface Placement { start: Vec3; end: Vec3; dir: Vec3 }

function computePlacements(branches: Branch[]): Map<number, Placement> {
  const out = new Map<number, Placement>();
  const walk = (id: number, parentStart: Vec3, parentDir: Vec3): void => {
    const b = branches[id];
    if (!b) return;
    const attachY = b.attachmentY ?? 0;
    const start: Vec3 = attachY > 0
      ? { x: parentStart.x + parentDir.x * attachY, y: parentStart.y + parentDir.y * attachY, z: parentStart.z + parentDir.z * attachY }
      : parentStart;
    const polar = Math.max(0.1, Math.min(1.4, Math.abs(b.angle) * Math.PI / 180));
    const azimuthal = (b.id * 137.508 * Math.PI / 180) % (2 * Math.PI);
    const dir = rotateDirection(parentDir, polar, azimuthal);
    const end: Vec3 = { x: start.x + dir.x * b.length, y: start.y + dir.y * b.length, z: start.z + dir.z * b.length };
    out.set(id, { start, end, dir });
    for (const childId of b.children) walk(childId, start, dir);
  };
  walk(0, BASE, { x: 0, y: 1, z: 0 });
  return out;
}

const UP = new THREE.Vector3(0, 1, 0);
const tmpDir = new THREE.Vector3();

function disposeTree(group: THREE.Group): void {
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      const m = obj.material;
      // Only dispose cloned trunk mats — shared mats (leaf, scar) must not be disposed here.
      if (!Array.isArray(m) && (m as any)._kijoCloned) m.dispose();
    }
  });
  group.clear();
}

/**
 * Build (or rebuild) the full tree mesh into `group`. Call only when the
 * tree is dirty (growTick / prune / wire) — dirty-flag pattern; the caller
 * is the renderer and clears the flag after this runs.
 */
export function buildTreeMesh(group: THREE.Group, tree: BonsaiTree): void {
  disposeTree(group);

  const branches = tree.getBranches();
  const placements = computePlacements(branches);
  const species = tree.getSpecies();

  for (const b of branches) {
    const p = placements.get(b.id);
    if (!p) continue;
    if (b.pruned) continue;

    // --- Branch tube: tapered cylinder, base radius = thickness * 0.5 ---
    const start = toWorld(p.start);
    const end   = toWorld(p.end);
    const len   = start.distanceTo(end);
    if (len > 0.01) {
      const baseR = Math.max(0.4, b.thickness * 0.5);
      const geo   = new THREE.CylinderGeometry(baseR * 0.6, baseR, len, 8);

      // Clone trunk mat so each branch can have its own repeat scale.
      const mat = makeTrunkMat(b.thickness);
      (mat as any)._kijoCloned = true;

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(start).add(end).multiplyScalar(0.5);
      tmpDir.copy(end).sub(start).normalize();
      mesh.quaternion.setFromUnitVectors(UP, tmpDir);
      mesh.userData.branchId = b.id;
      mesh.userData.kind = 'branch';
      group.add(mesh);
    }

    // --- Leaf cluster at tips — shared leaf material, color-tinted per species ---
    const hasLivingChildren = b.children.some((id) => branches[id] && !branches[id].pruned);
    if (!hasLivingChildren) {
      const leafGeo = new THREE.SphereGeometry(2.0, 10, 8);
      const tintedLeaf = leafMat.clone();
      tintedLeaf.color = leafColor(species, b.id);
      (tintedLeaf as any)._kijoCloned = true;
      const leaf = new THREE.Mesh(leafGeo, tintedLeaf);
      leaf.position.copy(end);
      leaf.userData.branchId = b.id;
      leaf.userData.kind = 'leaf';
      group.add(leaf);
    }

    // --- Prune scars ---
    for (const childId of b.children) {
      const child = branches[childId];
      if (!child || !child.pruned) continue;
      const cp = placements.get(childId);
      if (!cp) continue;
      const scarGeo = new THREE.SphereGeometry(1.1, 8, 6);
      const scar = new THREE.Mesh(scarGeo, scarMat);
      scar.position.copy(toWorld(cp.start));
      scar.userData.branchId = childId;
      scar.userData.kind = 'scar';
      group.add(scar);
    }
  }
}
