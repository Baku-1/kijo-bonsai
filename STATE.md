# KIJO -- Project State

**Last updated:** 2026-07-26 (Wallet/NFT integration: Kijonsai ERC-721 deployed Saigon testnet; Supabase Edge Functions seed-claim + wallet-auth deployed; WATER_AMOUNT C-1 fix; E2E mint verified)

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
| `@kijo/engine` (WireEngine) | Built (2026-07-19) | W1-W6 | Test file written -- gates not yet run |

Stat pipeline (Voxelizer + StatTerrain + StatDeriver): end-to-end complete and auditor-verified.

### Gate Details

**Shared S1-S5:** SeededRNG determinism, round4, spatialHash, type exports, constants -- all pass

**Engine G1-G6:** Tree construction, branch ID integrity, growTick sequence, same-seed determinism, moisture/health decay, Leonardo's Rule thickening -- all pass
- Fork constants reconciled 2026-07-15: threshold = `8 + depth*5`, prob = `forkChance * (1.0 - depth*0.1) * rate`

**Voxelizer V1-V9:**
- V1 -- Voxelization determinism: two identical trees produce identical voxel set
- V2 -- Sane fill: Day-200 tree = 8,797 voxels (seed 464497, hardwood)
- V3 -- Pruned excluded: Day-50 tree (707 voxels), pruned branch id=1 depth=1 -> 626 voxels (drop=81). PruneEngine.prune() used directly. PRUNE_SCAR voxels not yet emitted by voxelizer (advisory, non-blocking).
- V4 -- All voxels within [0,255]^3
- V5 -- Growth monotonicity: Day 50 -> Day 100 -> Day 200 = 707 -> 1,802 -> 8,797
- V6 -- Pipeline determinism: CareLogReplay rebuild -> voxelize -> byte-identical to original
- V7 -- Role coverage: every voxel has valid VoxelRole; histogram: root=104 trunk=2308 leg=496 arm=756 digit=4995 canopy=138
- V8 -- ARM/LEG split sane: ARM=756 > 0, LEG=496 > 0 (Day-200 hardwood seed 464497)
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
- D1 -- Structural (role-based): Day-200 hardwood seed 464497 -> hp=807.8, power=378, endurance=248, ki=414, skillSlots=21
- D2 -- Terrain stacks: delta-hp~2.26, delta-power~2.22, delta-endurance~2.16, delta-ki~2.23 (all positive)
- D3 -- Wisdom tiers: 50->0, 100->1, 200->2, 365->3, 500->4
- D4 -- Determinism: same tree+seed -> identical StatSheet x2
- D5 -- End-to-end: CareLogReplay tree -> voxelize -> derive = byte-identical to direct
- D6 -- Fixture: hp=809.9401 in [800,1500], all 8 keys present, all values > 0, matchPct=0.0776 in [0,1]
- D7 -- Morphology fidelity: arm-heavy (prune id=2 children) -> Power=1387.6265 > Endurance=250.1181; leg-heavy (prune id=1 children) -> Endurance=1420.6053 > Power=392.1301. Cross-tree Power and Endurance both ordered correctly.
- NOTE: D7 multi-branch coverage gap deferred to R-ATTACHY task.

**WireEngine W1-W6:** (run via `node packages/engine/test_wire.mjs` from repo root)
- W1 -- Cannot wire trunk (depth 0)
- W2 -- Cannot wire depth-2+ (too fragile)
- W3 -- Thickness limit enforced (WIRE_MAX_THICKNESS exported and > 0)
- W4 -- Bend applies, clamps to +-WIRE_MAX_ANGLE_DELTA, polar stays in [0.1, 1.4] rad
- W5 -- Care log records wire; CareLogReplay reconstructs identically
- W6 -- Thickness-tiered wire cost (thin=1, medium>=2, thick>medium)
- STATUS: Test file written 2026-07-19. Gates not yet formally run. Export name mismatch (WIRE_MAX_BEND_DEG->WIRE_MAX_ANGLE_DELTA) fixed 2026-07-19 in index.ts.

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

### `apps/web` -- Care Game Client (Vite + React + Three.js)

Multi-page app (index.html / index2d.html / index3d.html). All TypeScript compiles clean.

| File | Status | Description |
|------|--------|-------------|
| `src/main3d.ts` | Built | 3D voxel viewer: OrbitControls, InstancedMesh voxels, canopy stream, prune raycasting, stat HUD, ghost ideal-path hint, export/copy |
| `src/main2d.ts` | Built | 2D canvas renderer: recursive branch walk, prune pick, stat panel, export |
| `src/main.ts` | Built | Entry point |
| `src/renderer/tree_mesh.ts` | Built | Parametric Three.js mesh builder: tapered cylinders per branch, leaf spheres, prune scars |
| `src/bridge/care_bridge.ts` | Built | Care action bridge -- imports WATER_AMOUNT from @kijo/shared (C-1 fix 2026-07-26) |
| `src/ui/hud.ts` | Built | HUD component |
| `src/wallet/useWalletAuth.ts` | Built (2026-07-26) | New hook: generates nonce (timestamp), signs with Ronin wallet, POSTs to wallet-auth, stores access_token in memory |
| `src/wallet/useSeedPurchase.ts` | Built (2026-07-26) | Fully wired: sends RON -> waits for receipt -> POSTs to seed-claim -> returns { claimResult, isClaiming, claimError } |
| `src/components/SeedShopModal.tsx` | Updated (2026-07-26) | Shows "Sign in with Wallet" when not authed; passes access_token to useSeedPurchase |

**PBR texture upgrade (2026-07-19):**
- 12 JPG textures copied from `../assets/Bonsai-GLB/` to `apps/web/public/textures/` (~19MB)
- `tree_mesh.ts`: MeshLambertMaterial -> MeshStandardMaterial with BaseColor + NormalGL + AMR maps on trunk/branches; leaf textures with NormalGL + Roughness; moss material exported for pot soil
- `main3d.ts`: flat-color voxel materials -> PBR InstancedMesh materials (bark/leaf/root/scar); pot upgraded from flat clay color -> ceramic with BaseColor + NormalGL + Roughness; moss soil disc added at pot top
- Textures use `SRGBColorSpace` for BaseColor maps, `LinearSRGBColorSpace` for all data maps (normal, roughness, AO)

### `apps/server` -- Supabase Edge Functions (Deno runtime, deployed)

Supabase project: `xutjubkaskwchzyzwryk`. All functions deployed 2026-07-26.

| Function | verify_jwt | Status | Description |
|----------|-----------|--------|-------------|
| `seed-claim` | true | Deployed | Verify RON payment on-chain, replay guard via seed_claims table, mint NFT via walletClient.writeContract |
| `wallet-auth` | **false** (**permanent**) | Deployed | ECDSA signature verification, issues Supabase JWT for wallet -- MUST stay false (auth bootstrapping endpoint) |
| `care-action` | true | Deployed (existing) | Process care actions |
| `get-tree` | true | Deployed (existing) | Retrieve tree state |
| `seed-tree` | true | Deployed (existing) | Seed a new tree |

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

---

## Not Yet Built

| Item | Notes |
|------|-------|
| `MorphologyMapper` | Voxel regions -> kijo skeleton. See docs/KIJO-ARCHITECTURE.md s2.3 |
| `apps/server` (care log service) | Day scheduler, combat resolver still stub. Edge Functions (seed-claim, wallet-auth) ARE deployed. |
| WireEngine W1-W6 gates | Test file written; needs formal run and pass confirmation |
| Contracts (mainnet) | Saigon testnet deployed. Mainnet deploy + Sky Mavis collection onboarding not started. |
| Guest mode | ARCH-GUEST-MODE.md architecture complete; C-1 (WATER_AMOUNT) fixed; implementation not started |
| PWA + Netlify deploy | Not started |
| Tutorial system | Not started |
| TechniqueClassifier | Engine gap -- classify() not yet implemented |
| GuildRankDisplay.tsx | Component not yet built |

---

## Next Task Pointer

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
11. **Next (engine):** Run W1-W6 wire gates -> then `MorphologyMapper`.
12. **Next (product):** Guest mode implementation (ARCH-GUEST-MODE.md), PWA + Netlify deploy.

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
