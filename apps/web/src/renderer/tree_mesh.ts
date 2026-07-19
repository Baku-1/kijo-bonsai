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

// Species leaf palettes (GDD s3.3 visual identity) + 3% rare gold roll.
// Deterministic per branch: SeededRNG(branch.id * 997), same salt the tech
// spec uses for leaf placement.
const LEAF_PALETTES: Record<SpeciesClass, string[]> = {
  hardwood: ['#4E8A3C', '#B03A2E'],            // green / red
  evergreen: ['#3A7D44', '#2E6E6A'],           // green / blue-green
  tropical: ['#57A639', '#2F5D2A', '#C2A05C'], // green / dark green / tan
};
const RARE_LEAF = '#D4AF37'; // gold
const RARE_CHANCE = 0.03;

function leafColor(species: SpeciesClass, branchId: number): THREE.Color {
  const rng = new SeededRNG(branchId * 997);
  if (rng.next() < RARE_CHANCE) return new THREE.Color(RARE_LEAF);
  const palette = LEAF_PALETTES[species];
  return new THREE.Color(palette[Math.floor(rng.next() * palette.length) % palette.length]);
}

// Bark color lerp: light tan -> dark brown by thickness (thicker = darker).
const BARK_LIGHT = new THREE.Color('#A08060');
const BARK_DARK = new THREE.Color('#3A2A1A');
function barkColor(thickness: number): THREE.Color {
  const t = Math.max(0, Math.min(1, (thickness - 0.5) / 6));
  return BARK_LIGHT.clone().lerp(BARK_DARK, t);
}

interface Placement { start: Vec3; end: Vec3; dir: Vec3 }

// Walk the branch hierarchy computing start/end/dir — same recursion as the
// voxelizer's computePositions, but kept for ALL ids (including pruned) so we
// can place prune scars at cut points.
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
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m.dispose();
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

    if (b.pruned) continue; // pruned branches: no geometry (scar placed via parent below)

    // --- Branch tube: tapered cylinder, base radius = thickness * 0.5 (the
    // voxelizer's tube radius), tip = 60% of base ---
    const start = toWorld(p.start);
    const end = toWorld(p.end);
    const len = start.distanceTo(end);
    if (len > 0.01) {
      const baseR = Math.max(0.4, b.thickness * 0.5);
      const geo = new THREE.CylinderGeometry(baseR * 0.6, baseR, len, 7);
      const mat = new THREE.MeshLambertMaterial({ color: barkColor(b.thickness) });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(start).add(end).multiplyScalar(0.5);
      tmpDir.copy(end).sub(start).normalize();
      mesh.quaternion.setFromUnitVectors(UP, tmpDir);
      mesh.userData.branchId = b.id;
      mesh.userData.kind = 'branch';
      group.add(mesh);
    }

    // --- Leaf cluster at tips with no living children (same rule as the
    // voxelizer's CANOPY leaf sphere, r=2.0 voxel units) ---
    const hasLivingChildren = b.children.some((id) => branches[id] && !branches[id].pruned);
    if (!hasLivingChildren) {
      const leafGeo = new THREE.SphereGeometry(2.0, 10, 8);
      const leafMat = new THREE.MeshLambertMaterial({ color: leafColor(species, b.id) });
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.copy(end);
      leaf.userData.branchId = b.id;
      leaf.userData.kind = 'leaf';
      group.add(leaf);
    }

    // --- Prune scars: a small dark sphere where a pruned child was cut ---
    for (const childId of b.children) {
      const child = branches[childId];
      if (!child || !child.pruned) continue;
      const cp = placements.get(childId);
      if (!cp) continue;
      const scarGeo = new THREE.SphereGeometry(1.1, 8, 6);
      const scarMat = new THREE.MeshLambertMaterial({ color: '#1A0F06' });
      const scar = new THREE.Mesh(scarGeo, scarMat);
      scar.position.copy(toWorld(cp.start));
      scar.userData.branchId = childId;
      scar.userData.kind = 'scar';
      group.add(scar);
    }
  }
}
