import type { Branch } from '@kijo/shared';
import type { BonsaiTree } from '@kijo/engine';

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

export class SparseVoxelSet {
  private cells: Map<number, Material> = new Map();

  private key(x: number, y: number, z: number): number {
    return ((x & 0xFF) << 16) | ((y & 0xFF) << 8) | (z & 0xFF);
  }

  set(x: number, y: number, z: number, mat: Material): void {
    x = Math.max(0, Math.min(255, Math.round(x)));
    y = Math.max(0, Math.min(255, Math.round(y)));
    z = Math.max(0, Math.min(255, Math.round(z)));
    this.cells.set(this.key(x, y, z), mat);
  }

  get(x: number, y: number, z: number): Material | undefined {
    return this.cells.get(this.key(x, y, z));
  }

  has(x: number, y: number, z: number): boolean {
    return this.cells.has(this.key(x, y, z));
  }

  count(): number { return this.cells.size; }

  forEach(cb: (x: number, y: number, z: number, mat: Material) => void): void {
    for (const [k, mat] of this.cells) {
      cb((k >>> 16) & 0xFF, (k >>> 8) & 0xFF, k & 0xFF, mat);
    }
  }

  serialize(): [number, Material][] {
    return [...this.cells.entries()].sort((a, b) => a[0] - b[0]);
  }
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

  static voxelize(tree: BonsaiTree): SparseVoxelSet {
    const voxels = new SparseVoxelSet();
    const branches = tree.getBranches();
    const BASE = Voxelizer.BASE;

    // Root cone
    for (let y = 34; y < 38; y++) {
      const r = (38 - y) * 1.5;
      const ri = Math.ceil(r);
      for (let dx = -ri; dx <= ri; dx++) {
        for (let dz = -ri; dz <= ri; dz++) {
          if (dx*dx + dz*dz <= r*r) {
            voxels.set(BASE.x + dx, y, BASE.z + dz, Material.ROOT);
          }
        }
      }
    }

    // 3D positions
    const positions = new Map<number, { start: Vec3; end: Vec3; dir: Vec3 }>();
    Voxelizer.computePositions(0, BASE, { x: 0, y: 1, z: 0 }, branches, positions);

    // Fill branches
    for (const b of branches) {
      if (b.pruned) continue;
      const pos = positions.get(b.id);
      if (!pos) continue;
      const mat: Material = b.depth === 0 ? Material.HEARTWOOD : b.depth === 1 ? Material.BARK : Material.BRANCH_WOOD;
      Voxelizer.fillTube(pos.start, pos.end, b.thickness, mat, voxels);
      const hasLivingChildren = b.children.some(id => branches[id] && !branches[id].pruned);
      if (!hasLivingChildren) {
        Voxelizer.fillSphere(pos.end, 2.0, Material.LEAF, voxels);
      }
    }

    return voxels;
  }

  private static computePositions(
    id: number, start: Vec3, parentDir: Vec3,
    branches: Branch[], out: Map<number, { start: Vec3; end: Vec3; dir: Vec3 }>
  ): void {
    const b = branches[id];
    if (!b || b.pruned) return;
    const polar = Math.max(0.1, Math.min(1.4, Math.abs(b.angle) * Math.PI / 180));
    const azimuthal = (b.id * 137.508 * Math.PI / 180) % (2 * Math.PI);
    const dir = rotateDirection(parentDir, polar, azimuthal);
    const end: Vec3 = { x: start.x + dir.x*b.length, y: start.y + dir.y*b.length, z: start.z + dir.z*b.length };
    out.set(id, { start, end, dir });
    for (const childId of b.children) {
      Voxelizer.computePositions(childId, end, dir, branches, out);
    }
  }

  private static fillTube(start: Vec3, end: Vec3, thickness: number, mat: Material, voxels: SparseVoxelSet): void {
    const dx = end.x-start.x, dy = end.y-start.y, dz = end.z-start.z;
    const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
    if (len < 0.001) return;
    const steps = Math.ceil(len / 0.5);
    const radius = Math.max(0.5, thickness * 0.5);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      Voxelizer.fillSphere({ x: start.x+dx*t, y: start.y+dy*t, z: start.z+dz*t }, radius, mat, voxels);
    }
  }

  private static fillSphere(center: Vec3, radius: number, mat: Material, voxels: SparseVoxelSet): void {
    const r = Math.ceil(radius);
    const cx = Math.round(center.x), cy = Math.round(center.y), cz = Math.round(center.z);
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
      if (dx*dx + dy*dy + dz*dz <= radius*radius) {
        voxels.set(cx+dx, cy+dy, cz+dz, mat);
      }
    }
  }
}
