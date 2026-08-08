import type { Branch } from '@kijo/shared';
import { VoxelRole } from '@kijo/shared';
import { StatTerrain } from '@kijo/engine';
import type { BonsaiTree } from '@kijo/engine';

export { VoxelRole } from '@kijo/shared';

export const GRID_SIZE = 256;

export const Material = {
  HEARTWOOD:   1,
  BARK:        2,
  BRANCH_WOOD: 3,
  LEAF:        4,
  ROOT:        5,
  PRUNE_SCAR:  6,
} as const;
export type Material = typeof Material[keyof typeof Material];

// Per-voxel cell: material (render) + role (morphology) + branchId.
// Design 2026-07-17: material=render-only, role=morphology, branchId for MorphologyMapper.
// Footprint: was ~4 bytes/voxel. Now ~7 bytes (role+branchId). JS Map overhead separate.

interface VoxelCell {
  material: Material;
  role: VoxelRole;
  branchId: number;
}

export class SparseVoxelSet {
  private cells: Map<number, VoxelCell> = new Map();

  private key(x: number, y: number, z: number): number {
    return ((x & 0xFF) << 16) | ((y & 0xFF) << 8) | (z & 0xFF);
  }

  set(x: number, y: number, z: number, mat: Material, role: VoxelRole, branchId: number): void {
    x = Math.max(0, Math.min(255, Math.round(x)));
    y = Math.max(0, Math.min(255, Math.round(y)));
    z = Math.max(0, Math.min(255, Math.round(z)));
    this.cells.set(this.key(x, y, z), { material: mat, role, branchId });
  }

  get(x: number, y: number, z: number): VoxelCell | undefined {
    return this.cells.get(this.key(x, y, z));
  }

  has(x: number, y: number, z: number): boolean {
    return this.cells.has(this.key(x, y, z));
  }

  count(): number { return this.cells.size; }

  forEach(cb: (x: number, y: number, z: number, mat: Material, role: VoxelRole, branchId: number) => void): void {
    for (const [k, cell] of this.cells) {
      cb((k >>> 16) & 0xFF, (k >>> 8) & 0xFF, k & 0xFF, cell.material, cell.role, cell.branchId);
    }
  }

  // Sorted by key for deterministic comparison. Format: [key, material, role, branchId].
  serialize(): Array<[number, Material, VoxelRole, number]> {
    const out: Array<[number, Material, VoxelRole, number]> = [];
    for (const [k, c] of this.cells) {
      out.push([k, c.material, c.role, c.branchId]);
    }
    out.sort((a, b) => a[0] - b[0]);
    return out;
  }
}

// ---------------------------------------------------------------------------
// VoxelizeResult — returned by Voxelizer.voxelize().
// zones: branchId → zoneIndex [0-7]; derived from float-space branch start
// positions via StatTerrain.getZoneIndex (low-frequency trilinear Value Noise).
// Zone type is stable under sub-voxel branch angle jitter — see spec
// ARCHITECT-VOXEL-STATZONE-2026-07-31 Decision 1.
// ---------------------------------------------------------------------------

export interface VoxelizeResult {
  voxels: SparseVoxelSet;
  zones:  Map<number, number>;  // branchId → zoneIndex (0-7)
}

type Vec3 = { x: number; y: number; z: number };

function rotateDirection(parent: Vec3, polar: number, azimuthal: number): Vec3 {
  const len = Math.sqrt(parent.x ** 2 + parent.y ** 2 + parent.z ** 2);
  const p = { x: parent.x / len, y: parent.y / len, z: parent.z / len };
  const perp: Vec3 = Math.abs(p.y) < 0.9 ? { x: -p.z, y: 0, z: p.x } : { x: 1, y: 0, z: 0 };
  const pLen = Math.sqrt(perp.x ** 2 + perp.y ** 2 + perp.z ** 2);
  const u = { x: perp.x / pLen, y: perp.y / pLen, z: perp.z / pLen };
  const v = { x: p.y*u.z - p.z*u.y, y: p.z*u.x - p.x*u.z, z: p.x*u.y - p.y*u.x };
  const cosA = Math.cos(azimuthal), sinA = Math.sin(azimuthal);
  const rotU = { x: cosA*u.x + sinA*v.x, y: cosA*u.y + sinA*v.y, z: cosA*u.z + sinA*v.z };
  const cosP = Math.cos(polar), sinP = Math.sin(polar);
  return { x: cosP*p.x + sinP*rotU.x, y: cosP*p.y + sinP*rotU.y, z: cosP*p.z + sinP*rotU.z };
}

export class Voxelizer {
  static readonly BASE: Vec3 = { x: 128, y: 38, z: 128 };

  static voxelize(tree: BonsaiTree): VoxelizeResult {
    const voxels = new SparseVoxelSet();
    const branches = tree.getBranches();
    const BASE = Voxelizer.BASE;

    // Root cone -- VoxelRole.ROOT, branchId=0 (trunk).
    for (let y = 34; y < 38; y++) {
      const r = (38 - y) * 1.5;
      const ri = Math.ceil(r);
      for (let dx = -ri; dx <= ri; dx++) {
        for (let dz = -ri; dz <= ri; dz++) {
          if (dx*dx + dz*dz <= r*r) {
            voxels.set(BASE.x + dx, y, BASE.z + dz, Material.ROOT, VoxelRole.ROOT, 0);
          }
        }
      }
    }

    // Compute 3D positions for all branches.
    // Pass BASE as parentStart for the trunk; children will compute their start as
    //   parentStart + parentDir * child.attachmentY (one-third rule, R-ATTACHY).
    const positions = new Map<number, { start: Vec3; end: Vec3; dir: Vec3 }>();
    Voxelizer.computePositions(0, BASE, { x: 0, y: 1, z: 0 }, branches, positions);

    // Compute zone label per branch from float-space start position.
    // Evaluated ONCE per branch at float coordinates — stable under sub-voxel
    // angle jitter.  All voxels in a branch segment inherit this zone label.
    // branchId=0 (trunk/root) is always in positions (start = BASE).
    const seed  = tree.getSeed();
    const zones = new Map<number, number>();
    for (const [branchId, pos] of positions) {
      zones.set(branchId, StatTerrain.getZoneIndex(seed, pos.start.x, pos.start.y, pos.start.z));
    }

    // ARM / LEG classification for depth-1 branches (R-ATTACHY resolution, 2026-07-18).
    // Rule: sort depth-1 branches by attachmentY (real Y-coordinate on trunk at fork time).
    //   Lower attachmentY = LEG (Endurance); upper attachmentY = ARM (Power).
    // The one-third rule gives each depth-1 branch a genuine, varied attachmentY --
    //   primary child at 33% of trunk, secondary at trunk tip -- so the split is real.
    // n=0: no depth-1 branches.
    // n=1: single branch -> ARM (lone limb reads as reaching, not standing).
    // n>1: lower half (by attachmentY) -> LEG; upper half -> ARM.
    //      nArms = floor(n/2); odd count: median branch goes to LEG (stable base).
    const depth1Live = branches.filter((b: Branch) => b.depth === 1 && !b.pruned);
    // Sort ascending by attachmentY (real morphology; was id-order proxy before R-ATTACHY).
    const sorted1 = [...depth1Live].sort((a: Branch, b: Branch) => a.attachmentY - b.attachmentY);
    const n1 = sorted1.length;
    const armIds = new Set<number>();
    if (n1 === 1) {
      armIds.add(sorted1[0].id);
    } else if (n1 > 1) {
      const nArms = Math.floor(n1 / 2);
      for (let i = n1 - nArms; i < n1; i++) {
        armIds.add(sorted1[i].id);
      }
    }

    // Build per-branch role map.
    const branchRole = new Map<number, VoxelRole>();
    for (const b of branches) {
      if (b.pruned) continue;
      if (b.depth === 0) {
        branchRole.set(b.id, VoxelRole.TRUNK);
      } else if (b.depth === 1) {
        branchRole.set(b.id, armIds.has(b.id) ? VoxelRole.ARM : VoxelRole.LEG);
      } else {
        branchRole.set(b.id, VoxelRole.DIGIT);
      }
    }

    // Fill branches. Tube voxels carry structural role; leaf spheres get CANOPY.
    for (const b of branches) {
      if (b.pruned) continue;
      const pos = positions.get(b.id);
      if (!pos) continue;
      const mat: Material = b.depth === 0
        ? Material.HEARTWOOD
        : b.depth === 1 ? Material.BARK : Material.BRANCH_WOOD;
      const role: VoxelRole = branchRole.get(b.id) ?? VoxelRole.TRUNK;
      Voxelizer.fillTube(pos.start, pos.end, b.thickness, mat, role, b.id, voxels);
      const hasLivingChildren = b.children.some(
        (id: number) => branches[id] && !branches[id].pruned
      );
      if (!hasLivingChildren) {
        Voxelizer.fillSphere(pos.end, 2.0, Material.LEAF, VoxelRole.CANOPY, b.id, voxels);
      }
    }

    return { voxels, zones };
  }

  /**
   * Recursively compute 3D start/end/dir for each branch.
   *
   * parentStart: the world-space START of the parent branch.
   * parentDir:   the unit direction vector of the parent branch.
   *
   * Each branch's actual start = parentStart + parentDir * branch.attachmentY.
   * For depth-2+ branches attachmentY equals the parent's full length, so
   *   actualStart = parentEnd (same as old behaviour).
   * For depth-1 primary branches attachmentY = trunk.length * 0.33, so the tube
   *   begins one-third up the trunk rather than at the trunk tip (R-ATTACHY).
   */
  private static computePositions(
    id: number, parentStart: Vec3, parentDir: Vec3,
    branches: Branch[], out: Map<number, { start: Vec3; end: Vec3; dir: Vec3 }>
  ): void {
    const b = branches[id];
    if (!b || b.pruned) return;

    const attachY = b.attachmentY ?? 0;
    const start: Vec3 = attachY > 0
      ? {
          x: parentStart.x + parentDir.x * attachY,
          y: parentStart.y + parentDir.y * attachY,
          z: parentStart.z + parentDir.z * attachY,
        }
      : parentStart;

    const polar = Math.max(0.1, Math.min(150 * Math.PI / 180, Math.abs(b.angle) * Math.PI / 180));
    // 150° max = Cascade (Kengai) ceiling; 0.1 rad min = POLAR_MIN_DEG equivalent
    const azimuthal = (b.id * 137.508 * Math.PI / 180) % (2 * Math.PI);
    const dir = rotateDirection(parentDir, polar, azimuthal);
    const end: Vec3 = {
      x: start.x + dir.x * b.length,
      y: start.y + dir.y * b.length,
      z: start.z + dir.z * b.length,
    };
    out.set(id, { start, end, dir });

    // Pass this branch's own start and dir as parentStart/parentDir for children.
    // Children's attachmentY is measured along THIS branch's axis from THIS start.
    for (const childId of b.children) {
      Voxelizer.computePositions(childId, start, dir, branches, out);
    }
  }

  private static fillTube(
    start: Vec3, end: Vec3, thickness: number,
    mat: Material, role: VoxelRole, branchId: number,
    voxels: SparseVoxelSet
  ): void {
    const dx = end.x - start.x, dy = end.y - start.y, dz = end.z - start.z;
    const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
    if (len < 0.001) return;
    const steps = Math.ceil(len / 0.5);
    const radius = Math.max(0.5, thickness * 0.5);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      Voxelizer.fillSphere(
        { x: start.x + dx*t, y: start.y + dy*t, z: start.z + dz*t },
        radius, mat, role, branchId, voxels
      );
    }
  }

  private static fillSphere(
    center: Vec3, radius: number,
    mat: Material, role: VoxelRole, branchId: number,
    voxels: SparseVoxelSet
  ): void {
    const r = Math.ceil(radius);
    const cx = Math.round(center.x), cy = Math.round(center.y), cz = Math.round(center.z);
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dz = -r; dz <= r; dz++) {
          if (dx*dx + dy*dy + dz*dz <= radius*radius) {
            voxels.set(cx + dx, cy + dy, cz + dz, mat, role, branchId);
          }
        }
      }
    }
  }
}
