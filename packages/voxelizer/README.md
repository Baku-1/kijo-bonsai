# @kijo/voxelizer

Converts a grown BonsaiTree into a deterministic 256³ voxel representation.

## Purpose

Translates the engine's 2D branch graph into a 3D voxel volume for rendering and morphology analysis. Pure math — no rendering, no canvas, no Three.js. Output is a `SparseVoxelSet` which is serializable and deterministic.

## Public Surface

**`Material`** (const enum)
- `HEARTWOOD = 1` — trunk (depth 0)
- `BARK = 2` — depth 1 branches
- `BRANCH_WOOD = 3` — depth 2+ branches
- `LEAF = 4` — tip clusters (no living children)
- `ROOT = 5` — below trunk base (y < 38)
- `PRUNE_SCAR = 6` — reserved

**`SparseVoxelSet`**
- `set(x, y, z, mat)` — clamps to [0,255]
- `get(x, y, z): Material | undefined`
- `has(x, y, z): boolean`
- `count(): number`
- `forEach(cb)` — iterate all filled voxels
- `serialize(): [number, Material][]` — sorted by key for determinism

**`Voxelizer`**
- `static readonly BASE = { x: 128, y: 38, z: 128 }` — trunk base in voxel space
- `static voxelize(tree: BonsaiTree): SparseVoxelSet`
  - Root cone: y=[34,37], radius=(38-y)×1.5, material=ROOT
  - 3D positions: polar=|branch.angle|→rad clamped [0.1,1.4], azimuthal=(id×137.508°)%360°
  - Tubes: sample every 0.5 units, fill sphere of radius max(0.5, thickness×0.5)
  - Leaf clusters: sphere radius 2.0 at tips (no living children)
  - Pruned branches skipped entirely

## Gate Status

V1 ✓ Determinism — identical trees → identical SparseVoxelSet  
V2 ✓ Sane fill — 9,029 voxels at day 200 (seed 464497, hardwood)  
V3 ⚠ Pruned excluded — SKIP at build time (PruneEngine not yet built); **re-run required** now PruneEngine is complete  
V4 ✓ Bounds — all voxels in [0,255]³  
V5 ✓ Monotonicity — day 50 (720) < day 100 (1,880) < day 200 (9,029)  
V6 ✓ Pipeline determinism — CareLogReplay rebuild → voxelize → byte-identical  

## Dependencies

- `@kijo/shared`
- `@kijo/engine`
