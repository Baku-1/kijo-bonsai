# KIJO — Project State

**Last updated:** 2026-07-16 (StatTerrain complete)

---

## Packages Built

| Package | Status | Gate suite | Result |
|---------|--------|------------|--------|
| `@kijo/shared` | ✓ Built | S1–S5 | All pass |
| `@kijo/engine` (GrowthEngine + BonsaiTree + CareLogReplay) | ✓ Built | G1–G6 | All pass |
| `@kijo/engine` (PruneEngine) | ✓ Built | P1–P6 | All pass (17/17 assertions) |
| `@kijo/voxelizer` | ✓ Built | V1–V6 | All pass (V3 was SKIP at build time — see below) |
| `@kijo/engine` (StatTerrain) | ✓ Built | T1–T6 | All pass (7/7 assertions) |

### Gate Details

**Shared S1–S5:** SeededRNG determinism, round4, spatialHash, type exports, constants — all ✓

**Engine G1–G6:** Tree construction, branch ID integrity, growTick sequence, same-seed determinism, moisture/health decay, Leonardo's Rule thickening — all ✓
- Fork constants reconciled 2026-07-15: threshold = `8 + depth×5`, prob = `forkChance × (1.0 - depth×0.1) × rate`

**Voxelizer V1–V6:**
- V1 ✓ — Voxelization determinism: two identical trees → identical voxel set
- V2 ✓ — Sane fill: Day-200 tree = **9,029 voxels** (seed 464497, hardwood)
- V3 SKIP → **re-run required** — stub was written before PruneEngine existed; PruneEngine is now complete; update `test_voxelizer.mjs` V3 block and run to confirm pruned branches are excluded
- V4 ✓ — All voxels within [0,255]³
- V5 ✓ — Growth monotonicity: Day 50 → Day 100 → Day 200 = 720 → 1,880 → 9,029
- V6 ✓ — Pipeline det