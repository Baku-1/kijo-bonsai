# @kijo/shared

Foundation types and utilities used by all Kijo packages.

## Purpose

Single source of truth for types, the PRNG, spatial hash, and rounding discipline. Every other package imports from here. Nothing imports into here.

## Public Surface

**Types**
- `Branch` — `{ id, parent, depth, angle, length, thickness, pruned, children: number[] }`
- `TreeState` — full tree: seed, species, day, moisture, health, rotation, fertilizer, rngState, branches[]
- `CareAction` — `water | rotate | prune(branchId) | fertilize`
- `CareLogEntry` — `{ day, action: CareAction }`
- `SpeciesClass` — `'hardwood' | 'evergreen' | 'tropical'`
- `Coordinate`, `StatType`, `StatSheet`

**Utilities**
- `SeededRNG` — Mulberry32 variant. `new SeededRNG(seed)`, `.next() → [0,1)`
- `spatialHash(seed, x, y, z) → uint32` — deterministic coordinate hash for terrain stats
- `round4(x) → number` — `Math.round(x * 10000) / 10000`; call after every growth float op
- `SPECIES_PARAMS: Record<SpeciesClass, SpeciesParams>` — extensionMultiplier, forkSpread, secondaryForkChance, trunkMaturationRate

**Constants**
- `GRID_SIZE = 256`
- `MAX_DEPTH = 6`

## Gate Status

S1 ✓ Types compile  
S2 ✓ SeededRNG determinism (same seed → same sequence)  
S3 ✓ spatialHash determinism  
S4 ✓ round4 precision  
S5 ✓ SPECIES_PARAMS present for all three species  

## Dependencies

None. This package has zero runtime dependencies.
