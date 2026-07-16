# Kijo Bonsai — Decision Log
_Append-only. One decision per line, dated._

## 2026-07-15

- **Flat index arrays for Branch.children**: Children stored as `number[]` indices into `TreeState.branches`, NOT embedded objects. Reason: serialisation safety, no circular refs, simpler diff/patch for Merkle verification.

- **Per-branch RNG seeding**: Each branch each day uses `new SeededRNG(seed + branch.id×7919 + day×37)`. Reason: decorrelates branches — sibling forks get different random streams without global state.

- **round4() discipline**: `Math.round(x * 10000) / 10000` called after EVERY growth math operation that writes into TreeState. Reason: eliminates float drift across JS runtimes; critical for cross-platform determinism.

- **Fork threshold reconciled to 8 + depth×5**: Spec originally had `16 + depth×7`. Shipped at `8 + depth×5`. Reason: original values produced only 3 branches in 200 days vs target 15–30. Documented in KIJO-TECH-SPEC.md §4.2.

- **Fork probability reconciled to forkChance × (1.0 - depth×0.1) × rate**: Spec had `0.38 - depth×0.05`. Reason: same undergrowth issue. Linear falloff from 1.0 gives enough branching at low depth without over-branching.

- **Depth falloff**: `max(0.1, 1.0 - depth×0.15)`. Applied to growth rate per depth level.

- **Voxel grid**: 256³ (8-bit per axis). Trunk base at (128, 38, 128). Root cone fills y=[34,37].

- **Azimuthal angle from golden ratio**: `(branch.id × 137.508°) % 360°` → radians. Reason: deterministic from branch.id, produces good visual spread without clustering.

- **Polar angle clamped [0.1, 1.4] radians**: `|branch.angle|` in degrees → radians, clamped. Reason: prevents degenerate near-vertical or near-horizontal branches.

- **BonsaiTree initial state**: moisture=55, health=85 (overrides createTree defaults of 50/60). Reason: spec initial conditions.

- **Dirty flag — Renderer ONLY clears**: `markDirty()` called by GrowthEngine and PruneEngine. `clearDirty()` called only by the Renderer. GrowthEngine, tests, and other systems must never call clearDirty. Reason: prevents missed re-renders.

- **growTick order**: applyDailyUpdate → _tickFertilizer → calculateGrowthRate → extendAndFork (pre-order DFS) → thickeningPass (post-order DFS, Leonardo's Rule) → markDirty. Reason: children must exist before parent thickness is recalculated.

- **PruneEngine cascade**: Pruning branch X marks X + all descendants `pruned = true` via iterative stack. Trunk (depth===0) cannot be pruned — returns false. Already-pruned branch returns false. Reason: voxelizer skips pruned branches; cascade ensures no orphaned living children of pruned parent.

- **Fertilizer cooldown**: 5-day boost, 8-day cooldown. `fertilizerDays` and `fertilizerCooldown` tracked in TreeState.

- **CareLogReplay**: Reconstructs BonsaiTree day-by-day: apply care actions for day N, then growTick. Order within a day: care actions first, then tick. Backbone of NFT verification.

- **No wall-clock time**: All randomness flows from seed. SeededRNG uses Mulberry32 variant. Zero calls to Math.random(), Date.now(), or crypto anywhere in engine or voxelizer.
