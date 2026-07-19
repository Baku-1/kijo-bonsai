# KIJO — Architecture

**Version:** 0.1 (Draft)
**Date:** July 15, 2026
**Status:** Pre-Implementation
**Parent Documents:** KIJO-GDD.md, KIJO-TECH-SPEC.md

> This document describes the intended architecture derived from the GDD and technical spec. It may not match the current code exactly — reconcile against the actual repository as implementation proceeds and update this doc when boundaries shift.

---

## 1. System Overview

Kijo is composed of five concerns that must stay decoupled so the parametric tree (source of truth) can be reconstructed and rendered anywhere. The organizing principle: **the care log is the only authoritative state; everything else is derived.**

```
                    ┌─────────────────────────────────────┐
                    │         seed + care_log             │
                    │      (authoritative state)          │
                    └───────────────┬─────────────────────┘
                                    │
                    ┌───────────────▼─────────────────────┐
                    │            engine                    │
                    │  parametric tree + growth + stats    │
                    │         (pure, deterministic)        │
                    └───┬───────────────────────────┬─────┘
                        │                           │
              ┌─────────▼────────┐        ┌─────────▼────────┐
              │     voxelizer    │        │      shared      │
              │  tree → 256³      │        │  types, math,    │
              │  sparse voxels    │        │  RNG, constants  │
              └─────────┬────────┘        └──────────────────┘
                        │
          ┌─────────────┼─────────────┐
          │             │             │
    ┌─────▼─────┐ ┌─────▼─────┐ ┌────▼──────┐
    │    web    │ │  server   │ │ contracts │
    │  client   │ │  (auth,   │ │ (on-chain │
    │ (render,  │ │  combat,  │ │  NFT,     │
    │  care UI) │ │ care log) │ │  delegate)│
    └───────────┘ └───────────┘ └───────────┘
```

---

## 2. Package Boundaries

### 2.1 `shared`

**Purpose:** Foundation types and pure utilities used by every other package. Zero dependencies on other Kijo packages.

**Contains:**
- Core type definitions: `Branch`, `CareAction`, `SpeciesClass`, `StatSheet`, `Coordinate`
- `SeededRNG` — the single deterministic random source. All randomness in the entire system flows from here.
- Fixed-point / rounding utilities (the 4-decimal-place discipline from tech spec §9.1)
- Spatial hash function (tech spec §2.3)
- Constants: grid size (256), max depth (6), species parameter tables

**Depends on:** nothing (Kijo-internal)

**Critical rule:** Anything that affects tree reconstruction lives here so every package computes it identically. If the client and server disagree on a hash or a rounding rule, reconstruction breaks. `shared` is the single source of those rules.

### 2.2 `engine`

**Purpose:** The deterministic simulation core. Grows trees, derives stats, executes pruning. Pure functions — no I/O, no rendering, no network.

**Contains:**
- `BonsaiTree` — holds parametric tree, care state (moisture/health/age), care log, dirty flag
- `GrowthEngine` — stateless. `growTick()`, Leonardo's Rule thickening, fork logic
- `StatDeriver` — structural stats (morphology) + terrain bonuses (seed coordinate map). **Role-based (B02, implemented 2026-07-17, D1-D7 pass):** branches are classified by role (TRUNK / ARM / LEG / HEAD) via `attachmentY` (per ATTACHY-01 — lower third of trunk → LEG, upper → ARM), and stats are accumulated per role before combining into the StatBlock. Replaces the older voxel-role counting approach; ARM/LEG/HEAD remain derived, not stored (D-BODYTYPE2).
- `StatTerrain` — lazy coordinate → stat function, ideal-path proximity, match %
- `PruneEngine` — prune execution, growth-energy redistribution
- `CareLogReplay` — reconstruct a tree from seed + care log

**Depends on:** `shared`

**Critical rule:** Deterministic and platform-agnostic. Same seed + same care log = identical `StatSheet`, on every platform, every run. No floating-point accumulation drift. No wall-clock time. No `rand()`.

### 2.3 `voxelizer`

**Purpose:** Convert a parametric tree into a 256³ sparse voxel set. Used for stat terrain evaluation, NFT art, and morphology/kijo body generation.

**Contains:**
- `Voxelizer` — walks branches as thick bezier tubes, fills cells (tech spec §5)
- `LeafClusterFiller`, `RootFiller` — canopy and root voxel generation
- `MorphologyMapper` — voxel regions → kijo skeleton (trunk→torso, branches→limbs, depth-2→digits)
- `SparseVoxelSet` — the storage structure (`{x,y,z} → material`), serialization to ~30-60KB

**Depends on:** `shared`, `engine` (reads `Branch` structure)

**Critical rule:** Voxelization is derived, never authoritative. You never edit voxels directly — you grow/prune the parametric tree and re-voxelize. The voxel set is a view, the tree is the truth.

### 2.4 `web` (client)

**Purpose:** Player-facing application. Care loop UI, 2D tree rendering, 3D voxel viewer, combat interface, kijo silhouette preview.

**Contains:**
- 2D canvas renderer (parametric branches, real-time care view)
- 3D voxel viewer (Three.js/WebGL for NFT display and kijo awakening)
- Care UI (water, prune, fertilize, rotate controls)
- Silhouette preview (runs `MorphologyMapper`, draws 2D outline, updates per growth tick)
- Combat client (fighting-game input, combo execution, tag mechanics)

**Depends on:** `shared`, `engine`, `voxelizer`

**Critical rule:** The client can run the engine locally for responsive preview, but the **server is authoritative** for anything that affects NFT state or combat outcomes. Client-side engine runs are for display only.

### 2.5 `server`

**Purpose:** Authoritative backend. Validates care actions, ticks days, resolves combat, maintains the care log, pushes Merkle roots on-chain.

**Contains:**
- Care log service (append-only, Merkle root updates)
- Day-tick scheduler (real-time or subscription-accelerated)
- Combat resolver (server-authoritative — clients submit inputs, server decides outcomes)
- Matchmaking (ELO)
- Indexer (reads on-chain NFT data, reconstructs trees, generates voxel previews for marketplace)

**Depends on:** `shared`, `engine`, `voxelizer`

**Critical rule:** Server is the single authority on care log and combat. It runs the same `engine` as the client but its results are canonical. Anti-cheat lives here: a client claiming a tree state the server can't reproduce from the care log is rejected.

### 2.6 `contracts`

**Purpose:** On-chain smart contracts. NFT ownership, delegation, marketplace, tournament escrow.

**Contains:**
- ERC-721 Kijonsai NFT (stores seed, species, born timestamp, care-log Merkle root)
- Delegation contract (caretaker/fighter roles, revenue split, prune authority)
- Marketplace (listing, sale, 5% fee)
- Tournament escrow (entry fees, prize distribution)

**Depends on:** `shared` (for type/constant parity where feasible; Solidity reimplements the hash and reconstruction rules)

**Critical rule:** Minimal on-chain footprint (~160 bytes/NFT). The chain stores the seed and the Merkle root, not the tree. Verification (reconstruct from log, compare root) can happen on-chain or off-chain but the rules must match `shared` exactly.

---

## 3. Data Flow

### 3.1 Care Action (player waters/prunes/fertilizes)

```
Player taps "Water" in web client
  → client optimistically updates local engine (instant visual feedback)
  → client sends action to server
  → server validates (is it a legal action? correct owner/delegate?)
  → server appends CareAction to care log
  → server runs engine.growTick / applies action → new canonical tree state
  → server periodically batches care-log Merkle root → contracts (on-chain)
  → server confirms to client (client reconciles if its optimistic state drifted)
```

### 3.2 Stat Query (viewing a kijo's combat stats)

```
Request stats for Kijonsai #N
  → load seed + care_log (from server DB, or reconstruct from chain Merkle-verified log)
  → engine.CareLogReplay: replay care log from Day 0 → parametric tree
  → voxelizer: tree → sparse voxels
  → engine.StatDeriver: structural stats (morphology) + terrain bonuses (seed map)
  → return StatSheet { HP, Power, Endurance, Ki, SkillSlots, SkillPoints, Wisdom, MatchPct }
```

### 3.3 Combat (fighter battles)

```
Fighter selects moves, inputs combos (web client)
  → client sends inputs to server
  → server (authoritative) resolves each exchange using both kijo StatSheets
  → server updates morale, records result
  → server batches ranked results → contracts (on-chain)
  → clients render the resolved fight
```

### 3.4 Marketplace Browse (buyer scouting trees)

```
Buyer opens marketplace
  → indexer has pre-computed snapshots (tree state + voxel preview) per NFT
  → client displays cached snapshots (no live reconstruction per listing)
  → on detailed view / purchase: client can independently reconstruct + Merkle-verify
```

---

## 4. The Dirty-Flag Handshake

Rendering must not rebuild GPU buffers every frame — only when the tree changes. Ownership of the "clear" step is strict.

```
1. Sim Tick:   GrowthEngine mutates BonsaiTree  →  tree.markDirty()
2. Sync Phase: Renderer sees isDirty  →  TreeRenderer.generateMesh()
3. Commit:     Renderer calls tree.clearDirty()   ← ONLY the Renderer clears
4. Render:     TreeRenderer.draw()
```

**Rule:** A component never clears the dirty state of data it observes. The tree marks itself dirty; only the orchestrating Renderer clears it. This prevents both redundant rebuilds (flag never cleared → GPU hammered 60x/sec) and missed updates (component clears prematurely → stale mesh).

Instrumentation: track `rebuildCount` vs `frameCount`. At 1 day/sec sim over 10 seconds, expect ~10 rebuilds and ~600 frames. `rebuildCount > 15` means the handshake is broken.

---

## 5. Determinism Contract (Cross-Package)

The whole system rests on one guarantee: **seed + care_log reconstructs to an identical tree everywhere.**

For that to hold across `web` (JS), `server` (JS/Rust), and `contracts` (Solidity):

- All randomness flows from `SeededRNG` in `shared`, seeded as `seed + branch.id * 7919 + day * 37`
- No wall-clock time in any reconstruction path
- Rounding discipline: round to 4 decimals after every growth operation (or fixed-point Q16.16 — see tech spec R18, still open)
- The spatial hash (terrain stats) has one canonical definition in `shared`, reimplemented bit-identically in Solidity
- `contracts` and `engine` must agree on the reconstruction algorithm or Merkle verification fails

This is the single most important invariant in the codebase. A determinism break anywhere silently corrupts NFT verification, marketplace trust, and combat fairness.

---

## 6. Dependency Rules (Enforce in Build)

```
shared      → (no Kijo deps)
engine      → shared
voxelizer   → shared, engine
web         → shared, engine, voxelizer
server      → shared, engine, voxelizer
contracts   → shared (parity only; reimplements critical rules in Solidity)
```

- No circular dependencies.
- `engine` must never import `web`, `server`, `voxelizer`, or any I/O, rendering, or network library. If it does, determinism and testability are compromised.
- `voxelizer` reads tree structure but never mutates it.
- Rendering code lives only in `web`. `engine` produces data; it never draws.

---

## 7. Recommended Repo Layout

```
kijo/
├── packages/
│   ├── shared/
│   │   ├── README.md
│   │   └── src/         (types, SeededRNG, hash, constants, rounding)
│   ├── engine/
│   │   ├── README.md
│   │   ├── API.md       (engine public API reference)
│   │   └── src/         (BonsaiTree, GrowthEngine, StatDeriver, StatTerrain, PruneEngine, CareLogReplay)
│   ├── voxelizer/
│   │   ├── README.md
│   │   └── src/         (Voxelizer, MorphologyMapper, SparseVoxelSet)
│   ├── web/
│   │   ├── README.md
│   │   └── src/         (renderers, care UI, combat client)
│   └── server/
│       ├── README.md
│       └── src/         (care log service, day scheduler, combat resolver, indexer)
├── contracts/
│   └── README.md        (currently 8-line stub — chain TBD)
├── pipeline/            (architect / critic / implementer / auditor / linter)
├── docs/
│   ├── KIJO-GDD.md
│   ├── KIJO-TECH-SPEC.md
│   └── KIJO-ARCHITECTURE.md   (this file)
└── README.md
```

---

*Reconcile this document against the actual repository as it evolves. When a package boundary or data-flow path changes in code, update this doc in the same commit.*
