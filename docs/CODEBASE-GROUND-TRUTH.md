# Kijo Codebase Ground Truth
**Generated**: 2026-09-27 by direct file scan (no delegation, no agent)
**Scope**: `playground/kijo/` (Godot combat) + `playground/kijo/kijo-bonsai/` (caretaker engine)
**Note**: `playground/kijo-bonsai/` (root level) is an old backup — ignored.

---

## Part 1: Kijo Combat (Godot) — `playground/kijo/`

### Scripts (12 GDScript + 2 shaders = 2,077 lines)

| File | Lines | What it does |
|------|-------|-------------|
| `anatomy_surface.gd` | 504 | Procedural mesh generation for kijo body from voxel data |
| `combat_snapshot.gd` | 114 | Imports tree state from kijo-bonsai engine for combat |
| `crown_surface.gdshader` | 27 | Shader for kijo crown/hair rendering |
| `fighter.gd` | 431 | Fighter node — movement, attacks, hit detection |
| `health_bar.gd` | 64 | Health bar UI |
| `juniper_foliage.gd` | 91 | Juniper-specific foliage rendering |
| `ki_bar.gd` | 65 | Ki energy bar UI |
| `kijo_stats.gd` | 65 | Stats display panel |
| `match_manager.gd` | 112 | Combat match lifecycle |
| `morphology_mapper.gd` | 203 | Maps tree branches to kijo body parts (arm/leg/trunk) |
| `move_hud.gd` | 67 | Move selection HUD |
| `move_list.gd` | 116 | Available moves list |
| `voxel_body.gd` | 214 | Builds kijo mesh from voxel grid |
| `wood_ink.gdshader` | 4 | Wood/ink shader stub |

### Scenes
- `main.tscn` — Main scene
- `scenes/combat/fighter.tscn` — Fighter scene
- `scenes/combat/bonsai_reference_prop.tscn` — Bonsai reference prop
- `scenes/combat/japanese_glade_backdrop.tscn` — Arena backdrop
- `scenes/combat/materials/bark_surface.tres` — Bark material
- `scenes/combat/materials/crown_surface.tres` — Crown material

### Test Probes (6 files)
- `branch_age_probe.gd` — Branch age visualization test
- `branch_animation_probe.gd` — Branch animation test
- `capture_branch_motion.gd` — Motion capture test
- `combat_25d_probe.gd` — 2.5D combat test
- `crown_attachment_probe.gd` — Crown-to-body attachment test
- `juniper_foliage_probe.gd` — Juniper foliage test

### Fixtures (12 combat JSON files)
- 3 species (hardwood, evergreen, tropical) × healthy/standard variants
- 5 age variants (young, middle, old, old_sparse, seedling)
- Plus `ficus_day200.json`, `oak_day200.json`, `hardwood_real.json`, `tropical_real.json`

### Assets
- Bonsai FBX + GLB models (high and low poly)
- PBR textures (trunk, leaves, pot, moss, vegetation)
- `characters.jpg` — Character reference

### Artifacts (visual captures)
- `branch-weave-2026-09-15/` — Screenshots of branch rendering across species/ages + motion GIF
- `juniper-2026-09-16/` — Juniper foliage screenshots

### Docs (in kijo/docs/)
- `GDD.md`, `KIJO-ARCHITECTURE.md`, `KIJO-ENGINE-API.md`, `KIJO-PRD.md`, `KIJO-TECH-SPEC.md`, `DECISIONS.md`
- 35 pipeline docs (architect/critic/audit/impl/lint stages)

---

## Part 2: Kijo Bonsai Caretaker Engine — `playground/kijo/kijo-bonsai/`

### packages/shared/src/ (3 files, 1,519 lines)

| File | Lines | What it does |
|------|-------|-------------|
| `index.ts` | 627 | ALL shared types and constants: Branch (with physics fields), TreeState, SpeciesClass, CareAction, VoxelRole, LEAF_COLORS, BARK_COLORS, BARK_COLOR_NAMES, RARE_COLOR_CHANCE (0.03), deriveVisualTraits(), SPECIES_SUBTYPES, SPECIES_PARAMS, growth constants, physics constants |
| `growth-v3.ts` | 765 | V3 growth contracts: clock/season, GrowthEventV1, CareActionRequestV2, VoxelCellV2, PruneReceiptV1, TreeDisplayEnvelopeV1, DayPlanV1, validators, computeClockState(), toQ4/fromQ4 |
| `spiritMorale.ts` | 127 | Spirit morale system: mood computation, morale decay, care action effects |

### packages/engine/src/ (22 files, 5,155 lines)

| File | Lines | Status | What it does |
|------|-------|--------|-------------|
| `BonsaiTree.ts` | 402 | V1 LIVE | Core tree state manager — fork, grow, prune, age, tick |
| `GrowthEngine.ts` | 661 | V1 LIVE | Monolithic growth: daily update, thickening, forking |
| `CareLogReplay.ts` | 161 | V1 LIVE | Sequential care action replay |
| `StatDeriver.ts` | 243 | V1 LIVE | Combat stat derivation from voxels |
| `PruneEngine.ts` | 73 | V1 LIVE | Simple prune logic |
| `StatTerrain.ts` | 271 | V1 LIVE | Seed→terrain mapping, stat multipliers |
| `WireEngine.ts` | 186 | BUILT | Wire binding: apply, remove, stress, scar |
| `TwineWeightEngine.ts` | 430 | BUILT | Twine/weight binding with degradation |
| `TechniqueClassifier.ts` | 89 | BUILT | Classifies care log into technique (Jin, Water-and-Land, etc.) |
| `JinEngine.ts` | 103 | BUILT | Jin (deadwood) creation and weathering |
| `GrowthLedger.ts` | 376 | V3 NEW | Bigint cost equations, budget allocation, conservation |
| `GrowthPlanner.ts` | 488 | V3 NEW | Day plan creation, branch weight, sink demands |
| `GrowthMaterializer.ts` | 222 | V3 NEW | PPM event evaluation, boundary detection |
| `CanonicalHash.ts` | 160 | V3 NEW | Canonical JSON serialization + SHA-256 |
| `PruneReceiptEngine.ts` | 463 | V3 NEW | Multi-owner voxel management, prune receipts |
| `StableBranchRoles.ts` | 178 | V3 NEW | Depth-based arm/leg role assignment |
| `StatDeriverV3.ts` | 245 | V3 NEW | V3 stat derivation using VoxelCellV2 |
| `CareReplayV2.ts` | 257 | V3 NEW | Influence-set splicing replay |
| `errors.ts` | 16 | UTIL | Error classes |
| `index.ts` | 72 | UTIL | Re-exports |
| `rng.ts` | 7 | UTIL | SeededRNG |
| `tree.ts` | 52 | UTIL | Tree utilities |

**Status key**: V1 LIVE = currently running in production edge functions. BUILT = implemented and tested, used by web client. V3 NEW = Growth V3 system, built but not yet deployed (pending audit fixes).

### packages/voxelizer/src/ (3 files, 511 lines)

| File | Lines | What it does |
|------|-------|-------------|
| `index.ts` | 300 | Voxelizer: tree→voxel grid, tube fill, canopy spheres, Material enum |
| `CanopyGrammar.ts` | 172 | V3: species-specific integer ellipsoid canopy predicates |
| `CombatSnapshot.ts` | 39 | Export voxel grid for Godot combat import |

### packages/contracts/contracts/ (1 file)

| File | Lines | What it does |
|------|-------|-------------|
| `Kijonsai.sol` | 40 | ERC-721 NFT contract (AccessControl, URIStorage, Ronin deployment) |

### apps/server/supabase/functions/ (10 edge functions + 2 shared modules)

| Function | Lines | What it does |
|----------|-------|-------------|
| `wallet-auth/index.ts` | 281 | SIWE wallet authentication |
| `wallet-auth-nonce/index.ts` | 149 | Server-issued crypto nonce for wallet auth |
| `seed-claim/index.ts` | 546 | Claim a seed NFT (on-chain mint) |
| `seed-tree/index.ts` | 150 | Create a tree from a claimed seed |
| `care-action/index.ts` | 65 | Process care actions (water, prune, wire, etc.) |
| `derive-stats/index.ts` | 255 | Derive combat stats from tree state |
| `get-tree/index.ts` | 86 | Get authenticated user's tree |
| `get-tree-public/index.ts` | 122 | Get any tree (public, for visitors) |
| `list-trees/index.ts` | 73 | List user's trees |
| `combat-admission/index.ts` | 65 | Check if tree qualifies for combat |
| `nft-metadata/index.ts` | 385 | ERC-721 metadata JSON endpoint |
| `nft-image/index.ts` | 130 | NFT image rendering endpoint |
| `_shared/growth-transition.ts` | 230 | V3: OCC adapter for growth transitions |
| `_shared/build-display-envelope.ts` | 223 | V3: Display envelope builder |
| `_shared/kijo-engine.js` | — | Bundled engine for edge function use |

### apps/server/supabase/migrations/ (13 files, 963 lines)

| Migration | What it creates |
|-----------|----------------|
| `20260722120000` | seed_claims table |
| `20260722130000` | nextval function |
| `20260723000000` | wallet auth lookup |
| `20260806000001` | trees.token_id column |
| `20260806000002` | render_queue table |
| `20260806000003` | seed_claims token IDs |
| `20260807000001` | render_queue updated_at trigger |
| `20260807000002` | trees.wallet_id index |
| `20260808000001` | used_nonces table |
| `20260808000002` | decrement_consumable function |
| `20260817000001` | claim_render_job function |
| `20260822000001` | render_queue.glb_path |
| `20260904000001` | auth_nonces table (crypto nonces) |
| `20260917000000` | spirit_morale + care tables |
| `20260925000001` | V3: snapshots, plans, events, care_events, prune_receipts, rebaseline_audit, prepare/commit functions |

### apps/web/src/ (18 files, 6,652 lines)

| File | Lines | What it does |
|------|-------|-------------|
| `App.tsx` | 106 | React app shell with wallet provider |
| `main.tsx` | 23 | React entry point |
| `main2d.ts` | 478 | 2D canvas caretaker UI |
| `main3d.ts` | 1,216 | 3D Three.js caretaker UI (primary) |
| `persistence.ts` | 389 | Local state persistence |
| `bridge/care_bridge.ts` | 88 | Bridge between UI and engine |
| `renderer/scene.ts` | 175 | Three.js scene setup (lighting, camera) |
| `renderer/tree_mesh.ts` | 332 | Parametric 3D tree mesh builder (PBR textures, uses LEAF_COLORS/BARK_COLORS) |
| `renderer/atelier_room.ts` | 459 | Atelier room environment |
| `renderer/atelier_geometry.ts` | 101 | Room geometry helpers |
| `renderer/atelier_textures.ts` | 170 | Room texture loading |
| `ui/hud.ts` | 125 | HUD overlay |
| `wallet/config.ts` | 43 | Ronin wallet config |
| `wallet/useWallet.ts` | 75 | Wallet connection hook |
| `wallet/useWalletAuth.ts` | 216 | SIWE auth hook |
| `wallet/useListTrees.ts` | 123 | Tree listing hook |
| `wallet/useSeedPurchase.ts` | 285 | Seed purchase flow |
| `components/ThreeCanvas.tsx` | 964 | Main 3D canvas component |
| `components/StoreModal.tsx` | 581 | In-game store |
| `components/WalletTreeSelector.tsx` | 231 | Tree selector |
| `components/TutorialOverlay.tsx` | 229 | Tutorial system |
| `components/SeedShopModal.tsx` | 163 | Seed shop |
| `components/WalletBar.tsx` | 79 | Wallet status bar |

### apps/render-worker/src/ (5 files)

| File | What it does |
|------|-------------|
| `worker.ts` | Queue processor for server-side rendering |
| `blender.ts` | Blender integration for GLB rendering |
| `glb.ts` | GLB file generation |
| `queue.ts` | Job queue management |
| `storage.ts` | Storage (Supabase bucket) integration |

### Test Files (9 files)

| File | What it tests |
|------|-------------|
| `engine/test/growth-v3.test.js` | V3 Pass 1: 63 probes (cost equations, hashing, planning, materializer) |
| `engine/test/growth-v3-pass2.test.js` | V3 Pass 2: 66 probes (prune receipts, roles, replay, display) |
| `engine/test/determinism.test.js` | Growth engine determinism |
| `engine/test/carelog-determinism.test.js` | Care log replay determinism |
| `engine/test/cost-guards.test.js` | Input validation guards |
| `engine/test/WireEngine.test.js` | Wire binding tests |
| `engine/test/TwineWeightEngine.test.js` | Twine/weight binding tests |
| `voxelizer/test/canopy-grammar.test.js` | V3 canopy predicates: 15 probes |
| `contracts/test/Kijonsai.test.ts` | Smart contract tests |

---

## Part 3: What's Built vs What's Not

### BUILT AND WORKING
- Tree growth (V1 monolith + V3 modular — both on disk)
- Branch physics (wire, twine, weight binding with stress model)
- Voxelization (tree→voxel grid with material classification)
- Combat snapshot export (voxels→Godot)
- Kijo morphology mapping (tree→body in Godot)
- Fighter combat system (Godot: movement, attacks, health/ki)
- Stat derivation (V1 + V3)
- Prune engine (V1 simple + V3 receipt-based)
- Jin engine (deadwood)
- Technique classification
- Wallet auth (SIWE with server nonces)
- Seed claim / NFT minting
- Care action processing
- 3D web renderer with PBR textures
- Color system (LEAF_COLORS, BARK_COLORS, deriveVisualTraits — IN SHARED, IMPORTED BY RENDERER)
- Spirit morale system
- Database schema with RLS
- Atelier room environment
- Store/shop UI

### BUILT BUT PENDING AUDIT FIXES (V3)
- GrowthLedger, GrowthPlanner, GrowthMaterializer
- CanonicalHash, CareReplayV2
- PruneReceiptEngine, StableBranchRoles, StatDeriverV3
- CanopyGrammar
- DB migration for V3 tables
- OCC growth-transition + display-envelope
- 7 critical audit findings need fixing before deploy

### NOT BUILT (designed but no code)
- Seasonal palette shift (design doc exists, no implementation)
- Kijo crown color inheritance from leaf color (designed, not in Godot scripts)
- Rare color display in NFT marketplace metadata
- Species-specific canopy shapes (CanopyGrammar has ellipsoids but species params not wired)
- Flower/guild rank system
- SLP dual-potion system
- Combat move system (move_list.gd exists but move data is placeholder)
- Landscape handler (spec exists, not deployed)
- Multi-viewer display (V3 Phase 16 — spec only)
- Manual clock demo (V3 Phase 18 — spec only)
- Render worker deployment (code exists, Railway config exists, not deployed)

---

## Part 4: Known Stray Files

- `playground/docs/` — 5 files, 3 orphans moved to kijo-bonsai/docs, needs manual delete
- `playground/kijo-bonsai/` — old backup copy, can be ignored
- `playground/output/` — unknown, not inspected

---

## Totals

| Layer | Files | Lines |
|-------|-------|-------|
| Godot scripts + shaders | 14 | 2,077 |
| Engine (TS) | 22 | 5,155 |
| Shared (TS) | 3 | 1,519 |
| Voxelizer (TS) | 3 | 511 |
| Contract (Sol) | 1 | 40 |
| Edge functions (TS) | 12 | 2,307 |
| Migrations (SQL) | 13 | 963 |
| Web client (TS/TSX) | 18 | 6,652 |
| Render worker (TS) | 5 | ~200 est |
| Tests | 9 | ~1,500 est |
| **Total source** | **100** | **~20,924** |
| Design + pipeline docs | ~165 | — |
