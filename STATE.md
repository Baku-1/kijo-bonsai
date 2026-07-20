# KIJO -- Project State

**Last updated:** 2026-07-19 (Texture upgrade: PBR materials applied to both renderers; WireEngine + web app documented)

---

## Packages Built

| Package | Status | Gate suite | Result |
|---------|--------|------------|--------|
| `@kijo/shared` | Built | S1-S5 | All pass |
| `@kijo/engine` (GrowthEngine + BonsaiTree + CareLogReplay) | Built | G1-G6 | All pass |
| `@kijo/engine` (PruneEngine) | Built | P1-P6 | All pass (17/17 assertions) |
| `@kijo/voxelizer` | Built | V1-V9 | All pass (14/14 assertions) |
| `@kijo/engine` (StatTerrain) | Built | T1-T6 | All pass (7/7 assertions) |
| `@kijo/engine` (StatDeriver) | ACCEPTED (auditor 2026-07-17) | D1-D7 35/35 | All pass (35/35 assertions) |
| `@kijo/engine` (WireEngine) | Built (2026-07-19) | W1-W6 | Test file written — gates not yet run |

Stat pipeline (Voxelizer + StatTerrain + StatDeriver): end-to-end complete and auditor-verified.

### Gate Details

**Shared S1-S5:** SeededRNG determinism, round4, spatialHash, type exports, constants -- all pass

**Engine G1-G6:** Tree construction, branch ID integrity, growTick sequence, same-seed determinism, moisture/health decay, Leonardo's Rule thickening -- all pass
- Fork constants reconciled 2026-07-15: threshold = `8 + depth*5`, prob = `forkChance * (1.0 - depth*0.1) * rate`

**Voxelizer V1-V9:**
- V1 -- Voxelization determinism: two identical trees produce identical voxel set
- V2 -- Sane fill: Day-200 tree = 9,029 voxels (seed 464497, hardwood)
- V3 -- Pruned excluded: Day-50 tree (720 voxels), pruned branch id=1 depth=1 -> 626 voxels (drop=94). PruneEngine.prune() used directly. PRUNE_SCAR voxels not yet emitted by voxelizer (advisory, non-blocking).
- V4 -- All voxels within [0,255]^3
- V5 -- Growth monotonicity: Day 50 -> Day 100 -> Day 200 = 720 -> 1,880 -> 9,029
- V6 -- Pipeline determinism: CareLogReplay rebuild -> voxelize -> byte-identical to original
- V7 -- Role coverage: every voxel has valid VoxelRole; histogram: root=104 trunk=2740 leg=340 arm=780 digit=4967 canopy=98
- V8 -- ARM/LEG split sane: ARM=780 > 0, LEG=340 > 0 (Day-200 hardwood seed 464497)
- V9 -- Role determinism: same tree grown twice -> identical role+material at every coordinate

**PruneEngine P1-P6:** (run via `node packages/engine/test_prune.mjs` from repo root)
- P1 -- Basic prune returns true, branch flagged pruned
- P2 -- Voxelizer gate: pruning leaf never increases voxel count
- P3 -- Cannot prune trunk (depth 0)
- P4 -- Cannot re-prune: second call returns false
- P5 -- Cascade: all descendants of pruned branch are also pruned
- P6 -- CareLogReplay determinism with prune: 4,275 voxels, serialize() byte-identical

**StatTerrain T1-T6:** (run via `node packages/engine/test_terrain.mjs` from repo root)
- T1 -- Determinism: `getStatAt(464497, 34, 120, 88)` returns `{type:'endurance', value:0.0008}` across 100 calls
- T2 -- Distribution: 64^3 grid, seed=1 -> all 6 buckets 16.60-16.81% (uniform, within 12-22%)
- T3 -- Proximity: on-spline coords (x=128,z=128) -> multiplier 3.0; (0,128,0) -> 0.8
- T4 -- Match range: Day-200 hardwood seed 464497 -> match=12.27% in [0,1]
- T5 -- Match determinism: two runs -> identical 0.1227
- T6 -- Cross-seed: seeds 1-5 all in [0,1]; identical under Chokkan-clamp (R5, expected -- variance emerges when styles 1-7 are implemented)

**StatDeriver D1-D7:** (run via `node packages/engine/test_statderiver.mjs` from repo root)
- D1 -- Structural (role-based): Day-200 hardwood seed 464497 -> hp=959, power=390, endurance=170, ki=294, skillSlots=21
- D2 -- Terrain stacks: delta-hp~2.26, delta-power~2.22, delta-endurance~2.16, delta-ki~2.23 (all positive)
- D3 -- Wisdom tiers: 50->0, 100->1, 200->2, 365->3, 500->4
- D4 -- Determinism: same tree+seed -> identical StatSheet x2
- D5 -- End-to-end: CareLogReplay tree -> voxelize -> derive = byte-identical to direct
- D6 -- Fixture: hp=961.2627 in [800,1500], all 8 keys present, all values > 0, matchPct=0.0805 in [0,1]
- D7 -- Morphology fidelity: arm-heavy (prune id=2 children) -> Power=1399.74 > Endurance=172; leg-heavy (prune id=1 children) -> Endurance=1242.57 > Power=392. Cross-tree Power and Endurance both ordered correctly.
- NOTE: D7 multi-branch coverage gap deferred to R-ATTACHY task.

**WireEngine W1-W6:** (run via `node packages/engine/test_wire.mjs` from repo root)
- W1 -- Cannot wire trunk (depth 0)
- W2 -- Cannot wire depth-2+ (too fragile)
- W3 -- Thickness limit enforced (WIRE_MAX_THICKNESS exported and > 0)
- W4 -- Bend applies, clamps to ±WIRE_MAX_ANGLE_DELTA, polar stays in [0.1, 1.4] rad
- W5 -- Care log records wire; CareLogReplay reconstructs identically
- W6 -- Thickness-tiered wire cost (thin=1, medium>=2, thick>medium)
- STATUS: Test file written 2026-07-19. Gates not yet formally run. Export name mismatch (WIRE_MAX_BEND_DEG→WIRE_MAX_ANGLE_DELTA) fixed 2026-07-19 in index.ts.

---

## Core Invariant

**seed + care_log -> identical tree, everywhere, every time.**

Proven through V6 (CareLogReplay roundtrip, 200 days, no prune) and P6 (CareLogReplay with mid-run prune at day 75, 150 days, 4,275 voxels). Both produce byte-identical `SparseVoxelSet.serialize()` output. Role tagging proven deterministic in V9.

---

## Apps Built

### `apps/web` — Care Game Client (Vite + Three.js)

Multi-page app (index.html / index2d.html / index3d.html). All TypeScript compiles clean as of 2026-07-19.

| File | Status | Description |
|------|--------|-------------|
| `src/main3d.ts` | Built | 3D voxel viewer: OrbitControls, InstancedMesh voxels, canopy stream, prune raycasting, stat HUD, ghost ideal-path hint, export/copy |
| `src/main2d.ts` | Built | 2D canvas renderer: recursive branch walk, prune pick, stat panel, export |
| `src/main.ts` | Built | Entry point |
| `src/renderer/tree_mesh.ts` | Built | Parametric Three.js mesh builder: tapered cylinders per branch, leaf spheres, prune scars |
| `src/bridge/care_bridge.ts` | Built | Care action bridge |
| `src/ui/hud.ts` | Built | HUD component |

**PBR texture upgrade (2026-07-19):**
- 12 JPG textures copied from `../assets/Bonsai-GLB/` to `apps/web/public/textures/` (~19MB)
- `tree_mesh.ts`: MeshLambertMaterial → MeshStandardMaterial with BaseColor + NormalGL + AMR maps on trunk/branches; leaf textures with NormalGL + Roughness; moss material exported for pot soil
- `main3d.ts`: flat-color voxel materials → PBR InstancedMesh materials (bark/leaf/root/scar); pot upgraded from flat clay color → ceramic with BaseColor + NormalGL + Roughness; moss soil disc added at pot top
- Textures use `SRGBColorSpace` for BaseColor maps, `LinearSRGBColorSpace` for all data maps (normal, roughness, AO)

### `apps/server` — Care Log Service (stub)

`src/index.ts` exists (scaffolded). No meaningful implementation yet.

---

## Not Yet Built

| Item | Notes |
|------|-------|
| `MorphologyMapper` | Voxel regions -> kijo skeleton. See KIJO-ARCHITECTURE.md s2.3 |
| `apps/server` | Care log service, day scheduler, combat resolver (stub only) |
| `contracts` | ERC-721 NFT, delegation, marketplace (chain TBD) |
| WireEngine W1-W6 gates | Test file written; needs formal run and pass confirmation |

---

## Next Task Pointer

1. ~~Re-run V3~~ -- Complete (2026-07-17).
2. ~~Build `StatDeriver`~~ -- Complete (2026-07-17). D1-D6 all pass, 31/31 assertions.
3. ~~Task A: VoxelRole tagging~~ -- Complete (2026-07-17). V1-V9 all pass, 14/14 assertions.
4. ~~Task B: StatDeriver refactor~~ -- Complete (2026-07-17). D1-D7 all pass, 35/35 assertions. Role-based counting, mass-ratio approximation retired.
5. ~~WireEngine~~ -- Built 2026-07-19. Export name fixed. **Run W1-W6 gates to formally accept.**
6. ~~PBR texture upgrade~~ -- Complete (2026-07-19). Both renderers upgraded.
7. **Next:** Run W1-W6 wire gates → then `MorphologyMapper`.

---

## Key Docs

| File | Purpose |
|------|---------|
| `docs/KIJO-ARCHITECTURE.md` | Package boundaries, data flow, dirty-flag contract, dependency rules |
| `docs/KIJO-ENGINE-API.md` | Full public API reference for all engine classes |
| `docs/KIJO-TECH-SPEC.md` | Reconciled constants, formulas, open research register (R6-R19) |
| `DECISIONS.md` | Append-only log of every architectural decision (read this before coding) |
| `SESSION-START.md` | Quick orientation for new sessions |