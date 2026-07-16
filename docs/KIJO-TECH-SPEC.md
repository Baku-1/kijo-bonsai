# KIJO — Technical Specification

**Version:** 0.1 (Draft)
**Date:** July 15, 2026
**Status:** Pre-Implementation (engine growth core shipped; voxelizer in progress)
**Parent Documents:** KIJO-GDD.md, KIJO-ARCHITECTURE.md

---

## §1 Purpose

This document is the authoritative source for implementation-level constants, algorithms, and research decisions in the Kijo codebase. Where the GDD describes *what* the game does and the Architecture document describes *how the packages relate*, this spec describes the *exact values and formulas* used in code. When code and spec conflict, file a reconciliation note here — do not silently let them drift. See §10 for open research questions.

---

## §2 Shared Package

### §2.1 Types

See `packages/shared/src/index.ts` and KIJO-ENGINE-API.md §Core Types for canonical type definitions.

### §2.2 SeededRNG

Mulberry32 variant. Seeded as `seed + branch.id×7919 + day×37` per growth operation. Full algorithm:

```ts
let t = (seed += 0x6D2B79F5) >>> 0;
t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
t ^= t + (Math.imul(t ^ (t >>> 7), t | 61) >>> 0);
return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
```

Do not alter the mixing constants. This is a critical determinism surface — the Solidity reimplementation must match bit-for-bit.

### §2.3 Spatial Hash

`spatialHash(seed, x, y, z)`: pack `(x<<16)|(y<<8)|z`, XOR with seed, apply one pass of the SeededRNG mixing function. Returns `uint32`. See `packages/shared/src/index.ts` for the canonical implementation.

### §2.4 round4

`Math.round(x * 10000) / 10000`. Called after every growth math assignment in the engine. See §9.1.

---

## §3 Species Parameters

<!-- TODO: reconcile against GDD §3.3 when finalized -->

| Species | extensionMultiplier | forkSpreadMin (rad) | forkSpreadMax (rad) | secondaryForkChance | trunkMaturationRate |
|---------|---|---|---|---|---|
| hardwood | 1.0 | 0.3 | 0.8 | 0.45 | 0.05 |
| evergreen | 0.8 | 0.1 | 0.4 | 0.35 | 0.04 |
| tropical | 1.3 | 0.5 | 1.2 | 0.25 | 0.06 |

Engine-level params (in `packages/engine/src/species.ts`):

| Species | growthRate | forkChance | forkAngle (°) | thickenRate | moistureDecay |
|---------|---|---|---|---|---|
| hardwood | 0.6 | 0.10 | 45 | 0.08 | 4 |
| evergreen | 0.8 | 0.12 | 30 | 0.05 | 5 |
| tropical | 1.2 | 0.16 | 20 | 0.03 | 7 |

---

## §4 Growth Engine

### §4.1 Daily Update (`BonsaiTree.applyDailyUpdate`)

1. Moisture decay: `5.0 + SeededRNG(seed + day×1000).next() × 4.0` → range [5.0, 9.0] per day.
2. Health adjust:
   - moisture ∈ [30, 65]: `health += 0.8` (clamped ≤ 100)
   - moisture < 15 or > 80: `health -= 1.5` (clamped ≥ 10)
   - otherwise: `health -= 0.3` (clamped ≥ 10)
3. Increment age.

### §4.2 Fork Threshold and Probability

A tip branch forks when:
- `branch.length > 8 + branch.depth × 5` (the **fork threshold**)
- `branch.depth < 6`
- `SeededRNG(seed + branch.id×7919 + day×37 + 1).next() < forkChance × (1.0 − depth×0.1) × rate` (the **fork probability**)

> **Values reconciled against shipped engine 2026-07-15 — earlier draft values (`16+depth×7`, `0.38−depth×0.05`) undergrew (3 branches / 200 days vs. target 15–30 at Day 200).**

Number of children: 1 primary always; 1 secondary with probability `SPECIES_PARAMS[species].secondaryForkChance`.

### §4.3 Growth Rate (`GrowthEngine.calculateGrowthRate`)

```
moistureFactor =  <15 → 0.15 | <30 → 0.55 | >80 → 0.40 | >65 → 0.75 | else 1.0
fertFactor     =  1.7 if fertilizer active, else 1.0
healthFactor   =  0.4 + health × 0.006
rate           =  moistureFactor × fertFactor × healthFactor × species.extensionMultiplier
```

### §4.4 Depth Falloff

Tip extension multiplier by depth:

```
depthFalloff(depth) = max(0.1, 1.0 − depth × 0.15)
```

> **Values reconciled against shipped engine 2026-07-15 — earlier draft value (`0.38 − depth×0.05`) was used as the fork probability coefficient; depth falloff was always `1.0 − depth×0.15` in the extension formula, which is correct and unchanged.**

### §4.5 Thickening (Leonardo's Rule)

Post-order traversal. For each non-tip branch:

```
leonardoMin = sqrt(Σ child.thickness²)
maturation  = 0.05 × rate  (trunk, depth 0)
            = 0.02 × rate  (other)
thickness   = max(thickness, leonardoMin) + maturation
```

Round to 4 decimals after assignment. Trunk thickens every tick even with no children.

---

## §5 Voxelizer

See KIJO-ARCHITECTURE.md §2.3 for the architectural role of the voxelizer. `SparseVoxelSet` maps `(x,y,z)→material` in a 256³ grid (each axis 0–255). Trunk base at `(128, 38, 128)`. Branch tubes are thick tapered bezier capsules sampled at 0.5-voxel intervals, filled as spheres of radius `max(0.5, thickness×0.5)`. Leaf clusters (radius 2.0) at living tips. Root voxels (disc cone) at y=[34,37] below trunk base. Pruned branches are skipped entirely. Voxelization is derived, never authoritative — the tree is the truth.

**3D angle mapping:** The engine's `Branch.angle` is a single value (degrees, relative to parent). For 3D placement, polar angle = `|angle|` → radians (clamped [0.1, 1.4]); azimuthal angle = `(branch.id × 137.508°) % 360°` (golden angle, deterministic from branch.id). Direction computed via Rodrigues' rotation formula.

**Materials:** HEARTWOOD (1, trunk), BARK (2, depth 1), BRANCH_WOOD (3, depth 2+), LEAF (4, tips + clusters), ROOT (5, below base), PRUNE_SCAR (6, reserved).

---

## §6 StatDeriver

*Not yet implemented. See KIJO-ENGINE-API.md §StatDeriver for the intended API.*

---

## §7 StatTerrain

*Not yet implemented. See KIJO-ENGINE-API.md §StatTerrain for the intended API.*

---

## §8 PruneEngine

*Not yet implemented. See KIJO-ENGINE-API.md §PruneEngine for the intended API.*

---

## §9 Determinism

### §9.1 Invariant

`CareLogReplay.reconstruct(seed, species, careLog)` on any platform, any number of times, must yield a bit-identical `StatSheet` and identical `SparseVoxelSet`. This is the foundation of NFT verification, combat fairness, and marketplace trust.

**Rules:**
- All randomness through `SeededRNG` in `shared`. Never `Math.random()`, `Date`, or `crypto`.
- `round4()` after every growth math assignment (prevents per-operation float drift accumulation).
- No wall-clock time anywhere in the engine or voxelizer.
- SeededRNG seeded as `seed + branch.id×7919 + day×37`. Separate RNG instances per branch per day — never shared mutable state across branches.
- The spatial hash and Merkle reconstruction algorithm in `contracts` (Solidity) must match `shared` bit-for-bit.

### §9.2 Fixed-Point vs Float (R18 — OPEN CRITICAL)

Current implementation uses IEEE 754 float + `round4`. This is sufficient for single-platform determinism (Node.js → Node.js) but may fail cross-platform (JS → Rust → Solidity) due to FPU rounding differences. Q16.16 fixed-point is the safe path. Decision deferred pending cross-platform test suite.

---

## §10 Open Research Register

| # | Affects | Question | Status |
|---|---|---|---|
| R2 | `StatTerrain::getStatAt` | NEUTRAL bucket fraction (1 of 6 hash buckets; first-pass keep 1/6 ≈16.7%; may need merging if terrain feels too quiet) | Open |
| R4 | `StatTerrain` (style splines) | Non-Chokkan style implementations: Moyogi, Shakan, Kengai, Fukinagashi, Bunjin, Hokidachi, Sekijoju — all stubbed behind `StyleSpline` interface | Open |
| R5 | `StatTerrain::splineForSeed` | Style-to-seed routing: `seed % 8` → styleIndex; indices 1–7 blocked until styles ship; clamp to Chokkan (index 0) is temporary | Open |
| R6 | `StatTerrain::proximityCurve` | Curve steepness tuning (dist 0→3.0, <5→2.0, etc.) | Open |
| R7 | `StatTerrain::calculateMatch` | Ideal region size (match denominator)