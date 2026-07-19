# @kijo/engine

Deterministic bonsai growth engine. Seed in, identical tree out — every time, everywhere.

## Purpose

Owns the full lifecycle of a BonsaiTree: daily growth, care actions, branch forking/thickening, pruning, and care-log replay for NFT verification. Stateless algorithms operate on BonsaiTree; BonsaiTree wraps the immutable functional core (tree.js).

## Public Surface

**`BonsaiTree`**
- `constructor(seed, species)` — moisture=55, health=85, trunk allocated
- `applyDailyUpdate()` — decay 5.0–9.0 seeded, 3-way health rule
- `water(amount)` / `fertilize()` / `rotate()` — care actions, all logged
- `prune(branchId): boolean` — delegates to PruneEngine; cascades to descendants
- `isDirty() / markDirty() / clearDirty()` — Renderer ONLY calls clearDirty
- `getBranches(): Branch[]` / `getMoisture()` / `getHealth()` / `getAge()` / `getSeed()` / `getSpecies()` / `getCareLog()`
- `countLivingBranches()` / `getPrunedCount()` / `getTotalMass()`

**`GrowthEngine`** (stateless)
- `static growTick(tree): void` — one day of growth
  - Order: applyDailyUpdate → _tickFertilizer → calculateGrowthRate → extendAndFork (pre-order) → thickeningPass (post-order Leonardo's Rule) → markDirty
  - Fork threshold: `8 + depth×5`
  - Fork probability: `forkChance × (1.0 - depth×0.1) × rate`
  - Per-branch RNG: `SeededRNG(seed + branch.id×7919 + day×37)`

**`PruneEngine`** (stateless)
- `static prune(tree, branchId): boolean`
  - Returns false for trunk (depth 0), out-of-range, already-pruned
  - Marks branch + all descendants pruned=true
  - Logs care action, calls markDirty

**`CareLogReplay`**
- `static reconstruct(seed, species, careLog, totalDays): BonsaiTree`
  - Replays day-by-day: apply care actions for day N, then growTick
  - Backbone of NFT verification

**`StatTerrain`** (stateless)
- `static getStatAt(seed, x, y, z): TerrainStat` — lazy per-coordinate stat lookup
- `static calculateMatch(voxels: VoxelReader, seed): number` — match ∈ [0,1]
- `static proximityCurve(distance): number`
- `static distanceToIdealPath(seed, x, y, z): number`

**`StatDeriver`** (stateless)
- `static derive(tree, voxels: VoxelSet, seed, ageDays): StatSheet` — full dual-layer stat derivation
- `static deriveStructural(voxels, tree): StructuralStats` — Layer 1: TRUNK→HP, ARM→Power, LEG→Endurance, CANOPY→Ki (role-based, exact); depth-2+ branch count→skillSlots
- `static deriveTerrain(voxels, seed): TerrainBonuses` — Layer 2: per-voxel StatTerrain accumulation
- `static wisdomFromAge(ageDays): number` — age tier 0–4 (thresholds: 100/200/365/500)

## Gate Status

G1 ✓ BonsaiTree constructs, trunk exists  
G2 ✓ nextId === living + pruned + 1  
G3 ✓ Moisture/health update deterministic  
G4 ✓ GrowthEngine produces ≥5 branches in 200 days (seed 464497)  
G5 ✓ Thickening satisfies Leonardo's Rule  
G6 ✓ CareLogReplay produces byte-identical tree  
P1 ✓ Basic prune returns true, branch marked  
P2 ✓ Voxel count non-increase after prune  
P3 ✓ Trunk guard (returns false)  
P4 ✓ Re-prune guard (returns false)  
P5 ✓ Cascade marks all descendants pruned  
P6 ✓ CareLogReplay determinism with prune (4,275 voxels byte-identical)  
T1 ✓ StatTerrain getStatAt determinism  
T2 ✓ Distribution uniform across 6 buckets  
T3 ✓ Proximity multipliers correct  
T4 ✓ Match range ∈ [0,1]  
T5 ✓ Match determinism  
T6 ✓ Cross-seed (Chokkan-clamp caveat noted)  
D1 ✓ Structural stats all > 0, role-based (hp=959, power=390, endurance=170, ki=294)  
D2 ✓ Terrain stacks additively on structural  
D3 ✓ Wisdom tiers correct (5/5)  
D4 ✓ Determinism: same inputs → identical StatSheet  
D5 ✓ CareLogReplay end-to-end: byte-identical StatSheet  
D6 ✓ HP=961.26 ∈ [800,1500], all keys present, matchPct ∈ [0,1]  
D7 ✓ Morphology fidelity: arm-heavy→Power>Endurance, leg-heavy→Endurance>Power (cross-tree ✓)  

## Dependencies

- `@kijo/shared`
