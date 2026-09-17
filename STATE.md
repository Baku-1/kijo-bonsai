# KIJO -- Project State

**Last updated:** 2026-09-10 (Growth engine v2: all structural fixes implemented, 5/6 band-check gates PASS, 1 accepted variance. Genesis-ready species calibration.)

---

## Packages Built

| Package | Status | Gate suite | Result |
|---------|--------|------------|--------|
| `@kijo/shared` | Built | S1-S5 | All pass -- WATER_AMOUNT=28 exported 2026-07-26 (C-1 fix) |
| `@kijo/engine` (GrowthEngine + BonsaiTree + CareLogReplay) | Built | G1-G6 | All pass |
| `@kijo/engine` (PruneEngine) | Built | P1-P6 | All pass (17/17 assertions) |
| `@kijo/voxelizer` | Built | V1-V9 | All pass (14/14 assertions) |
| `@kijo/engine` (StatTerrain) | Built | T1-T6 | All pass (7/7 assertions) |
| `@kijo/engine` (StatDeriver) | ACCEPTED (auditor 2026-07-17) | D1-D7 35/35 | All pass (35/35 assertions) |
| `@kijo/engine` (WireEngine) | Gate-verified (2026-08-07) | W1-W6 | All pass -- 20/20 assertions |
| `@kijo/engine` (TwineWeightEngine) | Phase 2 complete + Linter CLEAN (2026-08-17) | TWE1-TWE9 | All pass -- 37/37 assertions, 55/55 security tests |
| `@kijo/engine` (TechniqueClassifier) | **Auditor VERIFIED (2026-08-17)** | TC1-TC19 + TC17b | All pass -- 48/48 assertions. See AUDIT-TECHNIQUE-TESTS-2026-08-17.md. |

Stat pipeline (Voxelizer + StatTerrain + StatDeriver): end-to-end complete and auditor-verified.

### Gate Details

**Shared S1-S5:** SeededRNG determinism, round4, spatialHash, type exports, constants -- all pass

**Engine G1-G6:** Tree construction, branch ID integrity, growTick sequence, same-seed determinism, moisture/health decay, Leonardo's Rule thickening -- all pass
- Fork constants reconciled 2026-07-15: threshold = `8 + depth*5`, prob = `forkChance * (1.0 - depth*0.1) * rate`

**Voxelizer V1-V9:**
- V1 -- Voxelization determinism: two identical trees produce identical voxel set
- V2 -- Sane fill: Day-200 tree = 12,240 voxels (seed 464497, hardwood)
- V3 -- Pruned excluded: Day-50 tree (779 voxels), pruned branch id=1 depth=1 -> 693 voxels (drop=86). PruneEngine.prune() used directly. PRUNE_SCAR voxels not yet emitted by voxelizer (advisory, non-blocking).
- V4 -- All voxels within [0,255]^3
- V5 -- Growth monotonicity: Day 50 -> Day 100 -> Day 200 = 779 -> 2,238 -> 12,240
- V6 -- Pipeline determinism: CareLogReplay rebuild -> voxelize -> byte-identical to original
- V7 -- Role coverage: every voxel has valid VoxelRole; histogram: root=104 trunk=5734 leg=621 arm=940 digit=4676 canopy=165
- V8 -- ARM/LEG split sane: ARM=940 > 0, LEG=621 > 0 (Day-200 hardwood seed 464497)
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
- D1 -- Structural (role-based): Day-200 hardwood seed 464497 -> hp=2006.9, power=470, endurance=310.5, ki=495, skillSlots=14
- D2 -- Terrain stacks: delta-hp~2.26, delta-power~2.22, delta-endurance~2.16, delta-ki~2.23 (all positive)
- D3 -- Wisdom tiers: 50->0, 100->1, 200->2, 365->3, 500->4
- D4 -- Determinism: same tree+seed -> identical StatSheet x2
- D5 -- End-to-end: CareLogReplay tree -> voxelize -> derive = byte-identical to direct
- D6 -- Fixture: hp=2006.9 in [800,2500], all 8 keys present, all values > 0, matchPct=0.1072 in [0,1]
- D7 -- Morphology fidelity: arm-heavy (prune id=2 children) -> Power=1747.5656 > Endurance=310.5; leg-heavy (prune id=1 children) -> Endurance=1879.3608 > Power=426.1832. Cross-tree Power and Endurance both ordered correctly.
- NOTE: D7 multi-branch coverage gap deferred to R-ATTACHY task.

**WireEngine W1-W6:** (run via `node packages/engine/test_wire.mjs` from repo root)
- W1 -- Trunk CAN be wired (depth restriction removed, OQ-1 2026-07-31)
- W2 -- Depth-2+ CAN be wired (depth restriction removed, OQ-1 2026-07-31)
- W3 -- Thickness limit enforced (WIRE_MAX_THICKNESS exported and > 0)
- W4 -- Bend applies, clamps to +-WIRE_MAX_ANGLE_DELTA, polar stays in [0.1, 1.4] rad
- W5 -- Care log records wire; CareLogReplay reconstructs identically
- W6 -- Thickness-tiered wire cost (thin=1, medium>=2, thick>medium)
- STATUS: Gates formally run 2026-08-07. All 20/20 assertions pass. Export name mismatch (WIRE_MAX_BEND_DEG->WIRE_MAX_ANGLE_DELTA) fixed 2026-07-19 in index.ts.

**Wire UI W7-W19:** (static code review + tsc --noEmit; browser integration tests manual)
- W7  -- Wire button toggles `wireMode` and `.active` CSS class
- W8  -- Activating wire mode deactivates prune mode (mutual exclusion)
- W9  -- Activating prune mode deactivates wire mode (mutual exclusion)
- W10 -- `controls.enableRotate = false` while wireMode or pruneMode is active
- W11 -- too-thick rejection: branch.thickness > 3.0 returns ok=false -- **MANUAL-ONLY** (requires 30+ growth days)
- W12 -- Click branch voxel in wireMode selects it: selectionIndicator visible, wireControls shown
- W13 -- Click off-mesh in wireMode deselects: selectionIndicator hidden, wireControls hidden
- W14 -- selectionIndicator survives `rebuildVoxels()` (added to scene directly, NOT in meshes Map)
- W15 -- angleDelta===0 guard fires on Apply: shows hint, does NOT call `tree.wire()`
- W16 -- Apply with valid delta: calls `tree.wire()`, round4(newAngle-oldAngle) stored, localCareLog updated, persistAsync fired
- W17 -- `result.ok=false` from wire(): shows hint text from `result.reason`, no state change
- W18 -- Remove button visible only when `branch.wired`; click calls `tree.removeWire()`, localCareLog updated, persistAsync fired (GAP-1: 400 from server, logged only)
- W19 -- `npx tsc --noEmit` from `apps/web` exits 0 -- **PASSED 2026-08-14**
- STATUS: W7-W10, W12-W18 verified by code review and tsc. W11 manual-only (marked in comments). W19 PASSED.

**Attachy A1-A9:** (run via `node test_attachy.mjs` from repo root)
- A1 -- No depth-1 branch with attachmentY < trunk.length * 0.30 at Day 200 (seed 464497 hardwood)
- A2 -- Lowest depth-1 attachmentY in 30-40% of trunk height: 9.387 (33.0% of trunk 28.4454)
- A3 -- At least 2 distinct depth-1 attachmentY values: 9.387, 28.4454
- A4 -- ARM branches (upper-aY half) have >= attachmentY vs LEG branches (lower-aY half)
- A5 -- Multi-branch morphology (4+ depth-1 constructed): arm-heavy Power > Endurance; leg-heavy Endurance > Power; cross-tree ordering correct
- A6 -- Determinism: same seed -> identical depth-1 attachmentY values across two runs
- A7 -- CareLogReplay: all branches have identical attachmentY after reconstruction
- A8 -- tick() first depth-1 branch obeys one-third rule: aY=36.0404 (33.0% of trunk 109.2133 at day 60)
- A9 -- tick() subsequent depth-1 branches use trunk tip: second aY=109.2133 > first aY=36.0404; within 2 voxels of trunk
- Result: 18/18 assertions pass (2026-07-20). R-ATTACHY closed.

---

## Core Invariant

**seed + care_log -> identical tree, everywhere, every time.**

Proven through V6 (CareLogReplay roundtrip, 200 days, no prune) and P6 (CareLogReplay with mid-run prune at day 75, 150 days, 4,275 voxels). Both produce byte-identical `SparseVoxelSet.serialize()` output. Role tagging proven deterministic in V9.

---

## Apps Built

### `apps/render-worker` -- NFT Render Service (Railway / Docker)

**Status: IMPLEMENTATION COMPLETE 2026-08-22. tsc clean. spatialHash verified.**

| File | Status | Description |
|------|--------|-------------|
| `Dockerfile` | Built | Ubuntu 22.04 + Blender 4.2.23 LTS + Node.js 20 (NodeSource). Railway root=kijo-bonsai/ (repo root). Blender assets fetched from GitHub Releases (tag `blender-assets-v1`) at build time. WORKDIR /app/kijo-bonsai for npm install. CMD: tsx apps/render-worker/src/worker.ts |
| `package.json` | Built | `@kijo/engine`, `@kijo/voxelizer`, `@supabase/supabase-js ^2.45.0`, `@gltf-transform/core ^4.4.2`, `@gltf-transform/extensions ^4.4.2`, `tsx ^4.7.0`, `typescript ^5.5.4` |
| `tsconfig.json` | Built | Extends tsconfig.base.json (NodeNext, ES2022, strict). noEmit: true. |
| `src/queue.ts` | Built | claimJob via supabase.rpc('claim_render_job') (FOR UPDATE SKIP LOCKED). markDone/markFailed/markPending. RenderJob interface. |
| `src/storage.ts` | Built | uploadRender(supabase, localPath, storagePath, contentType). Reads file, upserts to 'renders' bucket. |
| `src/blender.ts` | Built | invokeBlender(opts): spawns `blender --background` + Python script with token-id/out/voxel-data args. Streams stdout/stderr. Rejects on non-zero exit. |
| `src/glb.ts` | Built | buildGlb(): merged InstancedMesh-style GLB via @gltf-transform. One primitive per material group (wood/leaf/root). KHR_materials_transmission on leaf (Transmission property, factor=0.3, transmissionMap). Two-call extension pattern (createExtension idempotent). Post-audit fix: KHRMaterialsTransmission/Transmission import split. |
| `src/worker.ts` | Built | Main polling loop. claim→reconstruct (CareLogReplay + BonsaiTree day-0 branch)→GLB (non-fatal try/catch)→Blender→uploadRender PNG→markDone. glb_path column updated on GLB success. attempts>=3 → markFailed else markPending. |
| `scripts/render_tree.py` | Built | Blender Python script. CYCLES 64 samples 1024×1024 PNG. spatialHash matches TS exactly (verified). Z-up Blender coordinate mapping. |

**Deferred (documented):**
- Pot mesh GLB merge (Phase 2 OQ-P3 -- Document.merge() not available in gltf-transform v4)
- Indexed geometry in GLB (Phase 2 -- reduces file size ~6×)
- No SRI hash on @lookingglass/webxr CDN script in index-viewer.html
- No exponential backoff on markPending retry

### `apps/server/supabase`

| File | Status | Description |
|------|--------|-------------|
| `functions/get-tree-public/index.ts` | Built 2026-08-22 | Deno Edge Function. verify_jwt: false. Reads by token_id. Service role client. Filters landscape+tick server-side. Returns seed/species/current_day/health/care_log_entries. Excludes wallet_id. 404 on PGRST116. |
| `migrations/20260817000001_claim_render_job_fn.sql` | Built | claim_render_job() stored function. UPDATE...FOR UPDATE SKIP LOCKED RETURNING *. |
| `migrations/20260822000001_render_queue_glb_path.sql` | Built | ALTER TABLE render_queue ADD COLUMN IF NOT EXISTS glb_path TEXT. |

### `apps/web` (viewer additions)

| File | Status | Description |
|------|--------|-------------|
| `src/viewer.ts` | Built 2026-08-22 | Public animation_url viewer. Fetches get-tree-public, reconstructs via CareLogReplay+Voxelizer client-side. MeshPhysicalMaterial transmission=0.3 + transmissionMap for leaves. Two-pass grunge overlay (separate grungeMesh alphaMap). renderer.setAnimationLoop for WebXR. @lookingglass/webxr init (~20 lines). GLB download link. No Math.random(). Post-audit: voxels.forEach() not serialize(), CareAction['type'] typed set. |
| `index-viewer.html` | Built 2026-08-22 | Vite entry for viewer.ts. @lookingglass/webxr v0.6.0 CDN UMD script loaded before module. |

### `apps/web` -- Care Game Client (Vite + React + Three.js)

Multi-page app (index.html / index2d.html / index3d.html). All TypeScript compiles clean.

| File | Status | Description |
|------|--------|-------------|
| `src/main3d.ts` | **Updated 2026-08-14** | 3D voxel viewer: OrbitControls, InstancedMesh voxels, canopy stream, prune raycasting, stat HUD, ghost ideal-path hint, export/copy. **Wire UI added:** wireMode, selectedBranchId, selectionIndicator (outside meshes Map), selectWireBranch/deselectWireBranch, apply/remove handlers, live bend preview (PREVIEW_POLAR_* constants, no state mutation). round4 discipline, angleDelta===0 guard, GAP-1 console.error for wire-remove 400. |
| `src/main2d.ts` | Built | 2D canvas renderer: recursive branch walk, prune pick, stat panel, export |
| `src/main.ts` | Built | Entry point |
| `src/renderer/tree_mesh.ts` | Built | Parametric Three.js mesh builder: tapered cylinders per branch, leaf spheres, prune scars |
| `src/bridge/care_bridge.ts` | Built | Care action bridge -- imports WATER_AMOUNT from @kijo/shared (C-1 fix 2026-07-26) |
| `src/ui/hud.ts` | Built | HUD component |
| `src/wallet/useWalletAuth.ts` | **Updated 2026-08-17** (A7-2) | Generates nonce, signs with EIP-712 via useWallet, POSTs to wallet-auth, stores access_token in memory + refresh_token in sessionStorage. silentRefresh() via GoTrue /auth/v1/token. signOut() clears RT. |
| `src/wallet/useSeedPurchase.ts` | **Updated 2026-08-17** (A5-1, A7-2) | No seeds in request body (server-side CSPRNG). silentRefresh() called before RON send. Accepts optional silentRefresh param. |
| `src/wallet/useListTrees.ts` | Built (2026-08-07) | Fetches all trees for authenticated wallet from list-trees Edge Function; re-fetches on kijo:tree-created |
| `src/components/WalletTreeSelector.tsx` | Built (2026-08-07) | Full-screen overlay: 0 trees→store, 1 tree→auto-select, 2+→picker grid. DC-1: callback props only. |
| `src/App.tsx` | Rewritten (2026-08-07) | Auth lifted here (single useWalletAuth). activeTreeId + storeOpen state. ThreeCanvas key={activeTreeId}. |
| `src/components/StoreModal.tsx` | Updated (2026-08-07) | Removed internal useWalletAuth; receives auth via props. localOpen/propOpen dual-source. handleClose clears both. |
| `src/components/SeedShopModal.tsx` | Legacy (2026-07-26) | Deprecated — StoreModal is the live component. One-line tsc fix applied. |

**PBR texture upgrade (2026-07-19):**
- 12 JPG textures copied from `../assets/Bonsai-GLB/` to `apps/web/public/textures/` (~19MB)
- `tree_mesh.ts`: MeshLambertMaterial -> MeshStandardMaterial with BaseColor + NormalGL + AMR maps on trunk/branches; leaf textures with NormalGL + Roughness; moss material exported for pot soil
- `main3d.ts`: flat-color voxel materials -> PBR InstancedMesh materials (bark/leaf/root/scar); pot upgraded from flat clay color -> ceramic with BaseColor + NormalGL + Roughness; moss soil disc added at pot top
- Textures use `SRGBColorSpace` for BaseColor maps, `LinearSRGBColorSpace` for all data maps (normal, roughness, AO)

### `apps/server` -- Supabase Edge Functions (Deno runtime, deployed)

Supabase project: `xutjubkaskwchzyzwryk`. All functions deployed 2026-07-26.

| Function | verify_jwt | Status | Description |
|----------|-----------|--------|-------------|
| `seed-claim` | true | Deployed (v2, 2026-08-07) | Multi-mint loop (N mints per call), explicit nonce (baseNonce+i), find-or-create replay guard, one trees INSERT per tokenId, care_log hand-off for first token, parallel receipt wait, enqueueRender per confirmed mint. Response shape: `{ v:2, ok, tokens[], partial }`. Resolves BUG-1 and BUG-2. |
| `wallet-auth` | **false** (**permanent**) | Deployed | ECDSA signature verification, issues Supabase JWT for wallet -- MUST stay false (auth bootstrapping endpoint) |
| `care-action` | true | Deployed (existing) | Process care actions |
| `get-tree` | true | Deployed (existing) | Retrieve tree state |
| `seed-tree` | true | Deployed (existing) | Seed a new tree |
| `list-trees` | **false** | Deployed (2026-08-07) | Authenticated GET -- derives wallet_id from JWT, returns all trees for that wallet. `{ trees: [{ id, token_id, species, current_day, born_at }] }`. Empty array (not 404) when wallet has no trees. Limit 50 (testnet). |
| `nft-metadata` | **false** | **Built (2026-08-17), NOT YET DEPLOYED** | GET /nft/metadata/{tokenId}. ERC-721 metadata JSON (Ronin Market schema). Full engine pipeline: CareLogReplay -> Voxelizer -> StatDeriver -> TechniqueClassifier. Service role client. Caveats: OQ-3 sub-type/leaf-color placeholder, health average is Phase 1 proxy, see IMPL-NFT-METADATA-2026-08-17.md. |
| `nft-image` | **false** | **Built (2026-08-17), NOT YET DEPLOYED** | GET /nft/image/{tokenId}. Always 302 -- never 404/500. HEAD-checks renders/{tokenId}.png in Supabase Storage; falls back to renders/placeholder.png. BLOCKER: upload placeholder.png to renders bucket before enabling. |

---

## Contracts

### Kijonsai ERC-721 -- Saigon Testnet (deployed 2026-07-26)

| Field | Value |
|---|---|
| Contract address | `0x4447F631F5868bFA03A6e6ae2D2da9f22c787E44` |
| Deploy tx | `0x9c2f7c9d6bb034a93c9b10a333f26a5ab94c925fe199f8b86d04839b40b28376` |
| Block | 52749550 |
| Admin | `0x26D9E80f4A8ca7f223D7e557075d4b73e2916D58` |
| Minter | `0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199` (treasury wallet -- testnet only) |
| OZ version | `5.0.2` (**pinned** -- 5.1+ uses mcopy/Cancun opcode, incompatible with Ronin London EVM) |

**E2E UI test (2026-07-26):** Full UI flow confirmed working in browser -- user clicked "Sign in with Wallet" in SeedShopModal, signed the auth message in Ronin Wallet extension, purchased a seed via the Buy Seeds modal (RON payment), and received NFT mint confirmation. Token #2 minted to `0x8626f694...2C9C1199`, tx `0x8a9df011...f09f6b61` on Saigon testnet. This is a UI-verified end-to-end test, not a curl/server-side test.

**Mainnet deployment: NOT STARTED.** Requires production KMS key setup. See docs/KIJONSAI-CONTRACT-ARCH.md §9.1.

---

## Database (Supabase: xutjubkaskwchzyzwryk)

| Object | Type | Details |
|---|---|---|
| `seed_claims` | Table | `tx_hash TEXT PRIMARY KEY, claimed_by UUID, count INTEGER, claimed_at TIMESTAMPTZ` -- replay guard (idempotency for seed-claim) |
| `kijonsai_token_id_seq` | Sequence | Atomic token ID assignment -- prevents collision on concurrent mints |
| `get_next_kijonsai_token_id()` | Function (SECURITY DEFINER) | Wraps `nextval('kijonsai_token_id_seq')` -- called by seed-claim Edge Function |
| `wallet_auth_lookup(p_address TEXT)` | Function (SECURITY DEFINER) | Wallet address -> user_id lookup -- called by wallet-auth Edge Function |
| `trees.token_id BIGINT UNIQUE` | Column | Links each tree row to its on-chain NFT tokenId. Nullable (guest trees = NULL). Partial index `idx_trees_token_id` excludes NULLs. Added via migration 20260806000001. |
| `render_queue` | Table | Job queue for Blender render worker. Fields: id, token_id, tree_id, trigger, status, attempts, created_at, updated_at, error. Added via migration 20260806000002. |
| `seed_claims.token_ids BIGINT[]` | Column | Array of minted tokenIds written after loop completion; NULL = previous run died mid-loop (use for idempotent replay recovery). Added via migration 20260806000003. |
| `set_updated_at()` trigger on render_queue | Trigger | Auto-updates `render_queue.updated_at` on row update. Added via migration 20260807000001. |
| `idx_trees_wallet_id` | Index | `CREATE INDEX IF NOT EXISTS idx_trees_wallet_id ON public.trees (wallet_id)`. Speeds up list-trees query. Added via migration 20260807000002. |

---

## Not Yet Built

| Item | Notes |
|------|-------|
| `MorphologyMapper` | Voxel regions -> kijo skeleton. See docs/KIJO-ARCHITECTURE.md s2.3 |
| `apps/server` (care log service) | Day scheduler, combat resolver still stub. Edge Functions (seed-claim, wallet-auth) ARE deployed. |
| WireEngine W1-W6 gates | ~~Complete (2026-08-07) -- 20/20 assertions pass~~ |
| Contracts (mainnet) | Saigon testnet deployed. Mainnet deploy + Sky Mavis collection onboarding not started. |
| Guest mode | ARCH-GUEST-MODE.md architecture complete; C-1 (WATER_AMOUNT) fixed; implementation not started |
| PWA + Netlify deploy | Not started |
| Tutorial system | Not started |
| ~~TechniqueClassifier~~ | **BUILT** -- `packages/engine/src/TechniqueClassifier.ts` with `classify()` implemented. CareAction types (jin, landscape, twine, twine-remove, weight, weight-remove) in shared/src/index.ts. Open: care-action server whitelist, ~~jin/landscape/twine/weight UI (#96)~~ **DONE (2026-08-30)**, metadata pipeline wiring (#95). |
| GuildRankDisplay.tsx | Component not yet built |
| ThreeCanvas raycaster + branch picking (#97) | Production view (ThreeCanvas.tsx) has no raycaster. Twine/weight buttons exist as mode toggles but cannot select branches. Requires: raycaster, branchId metadata on mesh segments, pointerdown handler mapping hits to branchIds. Follow main3d.ts lines 357-409 pattern adapted for production renderer. Unblocks twine/weight apply/remove in production view. |

---

## Next Task Pointer

**Combat update, 2026-09-15:** Owner selected voxel-derived real-time 2.5D and authorized extending the existing Godot controller, superseding earlier combat-direction holds for this scope. Local combined stats/morphology export and offline canonical 3D combat prototype now run. Snapshot test passes twice with identical hashes; Summer input probe passes with no captured errors. See ../scenes/combat/VOXEL-COMBAT-STATUS.md and ../tests/combat_25d_probe.gd. Next combat work: refine anatomy/crown presentation and validate live tree integration. No endpoint deployment; scars, seasons, morale, full move effects and production visuals remain incomplete. Legacy fixture rebaseline/I11 remain paused. Non-combat priorities below are retained.

1. ~~Re-run V3~~ -- Complete (2026-07-17).
2. ~~Build `StatDeriver`~~ -- Complete (2026-07-17). D1-D6 all pass, 31/31 assertions.
3. ~~Task A: VoxelRole tagging~~ -- Complete (2026-07-17). V1-V9 all pass, 14/14 assertions.
4. ~~Task B: StatDeriver refactor~~ -- Complete (2026-07-17). D1-D7 all pass, 35/35 assertions. Role-based counting, mass-ratio approximation retired.
5. ~~WireEngine~~ -- Built 2026-07-19. Export name fixed. **Run W1-W6 gates to formally accept.**
6. ~~PBR texture upgrade~~ -- Complete (2026-07-19). Both renderers upgraded.
7. ~~R-ATTACHY~~ -- Complete (2026-07-20). A1-A9 all pass, 18/18 assertions. attachmentY field added; one-third rule in GrowthEngine + tick(); branchId proxy retired.
8. ~~WATER_AMOUNT C-1 fix~~ -- Complete (2026-07-26). WATER_AMOUNT=28 exported from @kijo/shared; CareLogReplay and care_bridge import it.
9. ~~Kijonsai ERC-721 deploy~~ -- Complete (2026-07-26). Saigon testnet: 0x4447F631F5868bFA03A6e6ae2D2da9f22c787E44
10. ~~Supabase Edge Functions~~ -- Complete (2026-07-26). seed-claim + wallet-auth deployed. E2E mint flow verified.
11. ~~**W1-W6 wire gates**~~ -- Complete (2026-08-07). All 20/20 assertions pass.
12. **Next (product):** Guest mode implementation (ARCH-GUEST-MODE.md), PWA + Netlify deploy.
13. **COMPLETE (2026-08-07):** Multi-mint + tokenId/treeId link pipeline done. Full pipeline: Architect→Critic→Implementer→Auditor→Linter. Both bugs resolved: BUG-1 (multi-mint N->1) and BUG-2 (tokenId/treeId unlinked). seed-claim v2 deployed. Four DB migrations applied (20260806000001–3, 20260807000001). DECISIONS.md updated. See docs/ARCH-MULTI-MINT-TOKENTREE-LINK.md.
14. **COMPLETE (2026-08-07):** Tree picker + auth-lift pipeline done. Full pipeline: Architect→Critic v2→Implementer→Auditor→Linter. list-trees deployed. WalletTreeSelector built. Auth lifted to App.tsx. idx_trees_wallet_id migration applied. One hooks violation caught by auditor and patched. One unused import fixed in lint. See docs/pipeline/ARCH-TREE-PICKER-2026-08-07.md.
15. ~~**Run WireEngine W1-W6 gates**~~ -- Complete (2026-08-07).
21. **COMPLETE (prior session):** TechniqueClassifier classify() + new CareAction types. `packages/engine/src/TechniqueClassifier.ts` built. `shared/src/index.ts` extended with jin, landscape, twine, twine-remove, weight, weight-remove. **Open gaps:** care-action server whitelist does not accept these types yet; no UI for twine/weight/jin/landscape (#96); TechniqueClassifier not wired into NFT metadata pipeline (#95).
16. **COMPLETE (2026-08-14):** Wire/Remove UI panel (Task #160). Full pipeline: Architect→Critic→Implementer. Wire button + controls panel in index3d.html; full wire UI in main3d.ts (854 lines). tsc --noEmit exits 0. W7-W19 verified (W11 manual-only). **Open blocker:** GAP-1 -- `'wire-remove'` absent from ALLOWED_ACTION_TYPES in care-action/index.ts, tracked as Task #161 (server fix).
17. **COMPLETE (2026-08-17):** TwineWeightEngine Phase 2 + Caveat Fixes. All 7 methods implemented. TWE1-TWE9 gates pass (37/37). Security tests: 55/55. Linter: CLEAN (2026-08-17). Full pipeline: Architect→Critic→Corrective Arch→Implementer→Auditor→Corrective Impl→Auditor (55/55 security)→Linter (CLEAN). OQ-5 ARCH→STACK divergence documented in DECISIONS.md. See docs/pipeline/AUDIT-TWE-CAVEAT-FIXES-2026-08-14.md.
18. **COMPLETE (2026-08-17):** CareLogReplay wire-remove fix. wire-remove now calls WireEngine.removeWire() instead of throwing CareLogReplayError. CLR-WIRE-1/2/3/4 gate tests (23 assertions) pass. Auditor: VERIFIED (2026-08-17, 23/23 deterministic). Linter: CLEAN (2026-08-17, 49/49 full suite, tsc clean, no voxelizer imports). Full pipeline complete. See docs/pipeline/AUDIT-CARELOGREPLAY-WIRE-REMOVE-2026-08-17.md.
19. **COMPLETE (2026-08-17):** Web3 purchase security audit. CONDITIONALLY SECURE -- 0 critical, 6 advisory. Two mainnet blockers identified: (A3-1) wallet-auth uses raw personal_sign with no chain ID -- replace with signTypedData + domain separator before mainnet; (A5-1/A8-1) seeds are client-chosen -- move to server-side crypto.getRandomValues. Replay guard confirmed atomic. MINTER_ROLE gated. used_nonces deployed. See docs/pipeline/AUDIT-WEB3-PURCHASE-SECURITY-2026-08-17.md.
20. **COMPLETE (2026-08-17):** Web3 security corrections. Full pipeline: Audit→Architect→Critic→Implementer→Auditor (VERIFIED WITH CAVEATS)→**Linter CLEAN**. Fixes: A3-1 (EIP-712 signTypedData — cross-chain replay protection), A5-1/A8-1 (server-side CSPRNG seed generation), A7-1 (JWT expiry 3600s documented), A7-2 (token refresh flow — silentRefresh + sessionStorage), A8-2 (care_log whitelist — tick OUT, rotate IN per Critic B1). 5 Carmack-Linus edge cases corrected before handoff (chainId empty-string, RONIN_CHAIN_ID NaN, SUPABASE_ANON_KEY undefined cast, module-level whitelist, stale comments). tsc EXIT:0. Engine: 23/23. npm test: 49/49. DECISIONS.md: 5/5 entries present. ALLOWED_GUEST_ACTION_TYPES: tick=absent rotate=present. CAVEAT: wallet-auth + seed-claim require `supabase functions deploy` before fixes are live. Pipeline DONE.

22. **PIPELINE COMPLETE (2026-08-23):** nft-metadata + nft-image Edge Functions. Full pipeline: Implementer (2026-08-17) → Auditor REFUTED (2026-08-22, deriveVisualTraits missing + Flower Guild Rank conflict) → Implementer FIX-1+FIX-2 (2026-08-23) → Re-audit VERIFIED (2026-08-23) → Linter CLEAN WITH FIXES (2026-08-23, +1 @ts-ignore on SpeciesClass import). Full engine pipeline wired: CareLogReplay->Voxelizer->StatDeriver->TechniqueClassifier. esbuild bundle (kijo-engine.js, 66,727 bytes — rebuilt, now includes @kijo/shared exports). nft-metadata (362 lines): ERC-721 Ronin Market schema, Flower Guild Rank, technique label, seed-deterministic placeholder traits (OQ-3). nft-image (94 lines): always-302, HEAD-checks Supabase Storage, falls back to placeholder. DECISIONS.md entry added for Flower Guild Rank thresholds (arch doc authoritative, GDD estimated). Pipeline docs: AUDIT-NFT-METADATA-2026-08-22.md, AUDIT-NFT-METADATA-REAUDIT-2026-08-23.md, LINT-NFT-METADATA-2026-08-23.md. CAVEATS: OQ-3 sub-type/leaf-color placeholder (Jeremy sign-off needed), health average is Phase 1 proxy. **NOT YET DEPLOYED.** Blockers: placeholder.png upload to renders bucket, `supabase functions deploy`, Netlify proxy routes.

23. **PIPELINE COMPLETE (2026-08-26):** Natural growth model — continuous parent extension with apical dominance. Full pipeline: Architect→Critic→Implementer→Auditor VERIFIED→Linter CLEAN. Changes: ALL non-pruned branches now extend every tick (tips and inner); `isLeaderChild` determines leader/subordinate roles (longest living sibling, lowest index tiebreaker); subordinate tips suppressed by `(1.0 - apicalDominance * 0.5)`; inner branches extend at role-based rates (trunk=`trunkContinuedRate`, leader=`parentExtensionRate`, subordinate=`parentExtensionRate*(1-apicalDominance*0.5)`); inner base range `(0.8 + rng * 0.4)`. Exponential depth falloff resolves R9: `depthFalloffBase ** depth` (HW 0.72, EG 0.68, TR 0.78). Four new `SPECIES_PARAMS` fields: `apicalDominance`, `depthFalloffBase`, `parentExtensionRate`, `trunkContinuedRate`. G1-G6 pass (6/6). G4 determinism: totalMass=13187.6718. Branch count=16, max depth=5. tsc clean. Cross-version determinism break accepted (testnet only). **Downstream V-suite/D-suite fixtures need re-recording** (totalMass changed from ~6752 to 13187.67). Care-action whitelist code changes done but not yet deployed. Pipeline docs: ARCH/CRITIC/IMPL/AUDIT-NATURAL-GROWTH-MODEL-2026-08-26.md.

24. **PIPELINE COMPLETE (2026-08-30):** HUD #96 Sculpt UI (twine/weight/jin/landscape). Full pipeline: Architect→Critic→Corrective Patch→Implementer→Auditor VERIFIED→Linter CLEAN WITH FIXES (+1 console.log→console.info in ThreeCanvas.tsx). All 6 sculpt actions wired across 3 views (3D debug, 2D debug, production). F1 BLOCKER (SculptMode 'landscape') and F2 BLOCKER (CareBridge afterAction pattern) resolved. pruneMode/wireMode migration complete in main3d.ts. Triple-log pattern consistent. round4 discipline maintained. Production view respects caretaker opacity (no stats/technique exposed). tsc clean (exit 0). No frauds detected. 7 intent checks ALIGNED. UI-only changes -- no engine modifications. Pipeline docs: ARCH/CRITIC/PATCH/AUDIT-SCULPT-UI-2026-08-29.md. **Open:** #97 ThreeCanvas raycaster (production sculpt buttons are mode toggles only until raycaster ships).

25. **VERIFIED (2026-09-10):** Growth engine v2 — all 5 structural fixes from DESIGN-GROWTH-ENGINE.md implemented and verified. Owner decision I1: Option D (change in place, no version stamp). Implementation covers I1-I8: trunk re-fork (3.2a), internode schedule (3.2b), floor/ceiling controller (3.2c), rotation bias/phototropism (3.2d), taper clamp (3.2e), species table consolidation (I8). `engine/src/species.ts` retired; all params in `@kijo/shared SPECIES_PARAMS`. Genesis calibration: floorDay tuned to safety-net (HW:90, EG:120, TR:120) per owner directive — natural growth pace, not accelerated. **Band-check results (2026-09-10):** BAND PASS (HW:25, EG:24, TR:19 — all in 15-30). DETERMINISM PASS. CAP-BOUND PASS. FLOOR-REACH PASS (HW:108/120, EG:126/150, TR:149/150). ROTATION-EFFECT: HW PASS, EG PASS, TR accepted variance (0 differing branches — most tropical forks occur during floor-active days where bias is suppressed; owner accepted). TAPER PASS. test_growth.mjs: 17/18 (tropical G7 shows 19, in band after floorDay recalibration). tsc clean. **STAT-DELTA vs pre-change I3/I4:** HW -3/+0/-3, EG +2/+0/+2, TR +4/+1/+3 (living/mains/skillSlots). Voxel-level stat regression (D1-D7) not yet re-run. V/D-suite fixtures need re-recording (totalMass changed). **Open:** I11 re-render sweep of testnet trees, I12 complete (DECISIONS.md updated, STATE.md this entry). **Next:** NFT live tree display + WebXR viewer architecture.

---

## Key Docs

| File | Purpose |
|------|---------|
| `docs/KIJONSAI-CONTRACT-ARCH.md` | Kijonsai ERC-721 architecture, Saigon deploy runbook, OZ pinning caveat, key management |
| `docs/PHASE2-WALLET-ARCH.md` | React migration + Tanto Kit wallet connect + seed purchase flow (implemented 2026-07-26) |
| `docs/ARCH-GUEST-MODE.md` | Guest mode localStorage persistence architecture (C-1 resolved; implementation pending) |
| `docs/KIJO-ARCHITECTURE.md` | Package boundaries, data flow, dirty-flag contract, dependency rules |
| `docs/KIJO-ENGINE-API.md` | Full public API reference for all engine classes |
| `docs/KIJO-TECH-SPEC.md` | Reconciled constants, formulas, open research register (R6-R19) |
| `DECISIONS.md` | Append-only log of every architectural decision (read this before coding) |
| `SESSION-START.md` | Quick orientation for new sessions |
| `docs/IMPL-VS-DOCS-COMPARISON.md` | Implementation vs docs gap analysis: GAP-1 no TechniqueClassifier, GAP-2 missing CareActions, GAP-3 matchPct Chokkan-only, GAP-4 C++ spec drift |
| `docs/NFT-METADATA-IMAGE-ARCH.md` | NFT metadata endpoint + Blender render-queue + Railway worker architecture (DRAFT v5, not yet implemented) |
| `docs/PHASE1-RONIN-ARCH.md` | Phase 1 Ronin wallet + ERC-721 spec (PARTIALLY SUPERSEDED -- contract sections overridden by KIJONSAI-CONTRACT-ARCH.md) |
| `docs/AUDIT-TREE-SELECTION-2026-08-06.md` | Adversarial audit of tree selection / purchase flow -- REFUTED; documents multi-mint bug, species description inversion, legacy-vs-production test gap |
| `docs/pipeline/ARCH-TREE-PICKER-2026-08-07.md` | Architect spec for tree picker + auth-lift (L-4 gap closure) |
| `docs/pipeline/AUDIT-TREE-PICKER-2026-08-07.md` | Auditor verdict: FAIL (hooks violation) → patched → PASS |
| `docs/pipeline/LINT-TREE-PICKER-2026-08-07.md` | Lint report: CLEAN after 1 fix (unused useEffect import in App.tsx) |
| `docs/ADR-STATSHEET-DEFENSE-STABILITY.md` | ADR: add defense + stability to StatSheet -- DECIDED, pending implementation |
| `docs/ARCHITECT-STATSHEET-DEFENSE-STABILITY.md` | Architect spec for defense + stability addition -- READY FOR IMPLEMENTER |
| `docs/ARCHITECT-CAREACTION-TECHNIQUE-2026-07-30.md` | Architect spec: new CareAction types + TechniqueClassifier -- DESIGN, for implementer |
| `docs/CANONICAL-STYLES.md` | The 7 canonical bonsai styles with stat + combat identity -- AUTHORITATIVE (overrides GDD s4.2.1) |
| `docs/DESIGN-SPECIES.md` | Species system design -- AUTHORITATIVE (note: on-chain species storage clause is stale; deployed contract stores no struct) |
| `docs/DESIGN-COMBAT-SYSTEM-STATUS.md` | Combat system direction -- UNDER REVIEW, no Jeremy sign-off yet; do not implement either combat model |

---

## Critical Bugs (Confirmed 2026-08-06, AUDIT-TREE-SELECTION-2026-08-06.md)

### BUG-1: Multi-mint charges N x 3 RON but delivers 1 NFT — **RESOLVED 2026-08-07**

**Source:** seed-claim Edge Function + StoreModal UI  
**Symptom:** StoreModal quantity selector multiplies price display correctly (N x 3 RON). `useSeedPurchase` sends `count * SEED_PRICE_RON` RON to the treasury. `seed-claim` receives `count` in the body but calls `mintKijonsai` exactly once and inserts exactly one `seed_claims` row. A user buying 3 seeds pays 9 RON and receives 1 NFT.  
**Root cause:** `count` was only used for payment verification in the original Phase 1 design (verify `tx.value >= SEED_PRICE * count`). The mint loop was never implemented.  
**Fix scope (in ARCH-MULTI-MINT-TOKENTREE-LINK.md, IN PROGRESS):** Loop `mintKijonsai` N times in `seed-claim`, one `trees` INSERT per tokenId.

### BUG-2: tokenId <-> treeId unlinked -- no DB path from NFT to tree — **RESOLVED 2026-08-07**

**Source:** `trees` table schema  
**Symptom:** The `trees` table has no `token_id` column. Given an NFT tokenId, there is no DB query that returns the tree's row, care log, seed, or species. The `nft-metadata` Edge Function (described in NFT-METADATA-IMAGE-ARCH.md) cannot function because its first query (`WHERE token_id = $tokenId`) targets a column that does not exist.  
**Root cause:** The `ALTER TABLE trees ADD COLUMN token_id BIGINT UNIQUE` migration described in NFT-METADATA-IMAGE-ARCH.md has not been applied.  
**Fix scope:** Add `token_id BIGINT UNIQUE` to `trees`, populate on INSERT in `seed-claim`, create index.

### BUG-3: Species descriptions in UI are inverted (MAJOR)

**Source:** Species descriptions shown in the tree selection / store UI  
**Symptom:** Tropical is labeled "Tight clusters, fast-growing -- aerial complexity" in UI copy. Engine `SPECIES_PARAMS` defines Tropical with `forkSpreadMax=1.2rad (69 deg)` -- the widest spread of all three species. Evergreen has `forkSpreadMax=0.4rad (23 deg)` -- the tightest. The UI copy was written against the legacy `species.ts::forkAngle` field (20 deg for Tropical), which GrowthEngine does not use.  
**Root cause:** UI copy authored against stale legacy constants; GrowthEngine uses a separate SPECIES_PARAMS table.  
**Fix scope:** Audit all species description strings in UI components against actual SPECIES_PARAMS in GrowthEngine.

### BUG-4: Determinism test suite covers legacy engine, not production path (MAJOR)

**Source:** `determinism.test.js` vs production `CareLogReplay -> GrowthEngine -> BonsaiTree`  
**Symptom:** Tests call `createTree() + tick()` (legacy `tree.ts` path). Production calls `GrowthEngine.growTick()` via `CareLogReplay.reconstruct()`. Moisture decay, water amount, growth formula, and starting conditions differ between the two paths. The core invariant ("same seed + care_log = identical tree") has never been verified for the production code path.  
**Fix scope:** Write a production-path determinism test: `CareLogReplay.reconstruct(seed, species, log, N)` called twice on same inputs, diff `SparseVoxelSet.serialize()` output.

---

## Item 13 -- Multi-mint + tokenId/treeId link (2026-08-06)

**Status:** IMPLEMENTER COMPLETE -- awaiting Auditor  
**Document:** `docs/ARCH-MULTI-MINT-TOKENTREE-LINK.md` (Revision 2)  
**Pipeline:** Architect DONE -> Critic DONE -> Implementer DONE -> Auditor NEXT -> Linter

**What was implemented:**
- `apps/server/supabase/migrations/20260806000001_trees_token_id.sql` -- `trees.token_id BIGINT UNIQUE` + partial index
- `apps/server/supabase/migrations/20260806000002_render_queue.sql` -- render_queue table
- `apps/server/supabase/migrations/20260806000003_seed_claims_token_ids.sql` -- `seed_claims.token_ids BIGINT[]`
- `apps/server/supabase/functions/seed-claim/index.ts` -- full rewrite: multi-mint loop, explicit nonce, find-or-create replay guard, trees INSERT per token, care_log for first token, parallel receipt wait, enqueueRender per mint, v2 response shape `{ v:2, ok, tokens[], partial }`
- `apps/web/src/wallet/useSeedPurchase.ts` -- rewrite: pendingSeedsRef (array), pendingCareLogRef, removed initTree/retryTreeInit/seed-tree call, updated ClaimResult type, updated effect sending seeds/species/care_log
- `apps/web/src/components/StoreModal.tsx` -- updated: isBusy without isInitingTree, integer validation (Math.floor) on quantity, status messages use tokens[0], removed tree-init retry UI
- `apps/web/src/components/SeedShopModal.tsx` -- one-line fix for pre-existing tsc error (deprecated file; added "hardwood" default species to buySeeds call)

**Verified:** `npx tsc --noEmit` in `apps/web` exits 0. All files verified with `wc -l` and `tail -5`.
**Resolves:** BUG-1 (multi-mint N->1), BUG-2 (tokenId/treeId unlinked)
**DECISIONS.md:** Append entries per ARCH doc §13 AFTER auditor passes.
