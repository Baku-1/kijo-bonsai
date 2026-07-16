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

## Dependencies

- `@kijo/shared`
