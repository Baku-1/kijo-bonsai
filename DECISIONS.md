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

## 2026-07-17

- **Horticultural grounding — bonsai structure rules adopted as engine constraints (owner directive)**: Real bonsai structure maps directly onto the growth engine and stat terrain; three rules documented in KIJO-TECH-SPEC §4.6 and GDD. (a) **One-third rule** — lowest main branch emerges at ~1/3 up the trunk, lower 33–50% bare; this is the real attachment-height model and the resolution path for R-ATTACHY (fork-at-tip same-Y mechanic replaced by explicit `attachmentY` on Branch at fork time, closing the ARM/LEG branchId proxy at the source). (b) **Taper rule** — trunk thickest at base thinning monotonically to apex; lowest branch thickest, highest thinnest. Serves as a correctness assertion (a tree violating taper is malformed) and a stat signal (thick low first branch clusters high-value ARM/LEG voxels, correlating with age). Open question: whether taper adherence feeds match%. (c) **Notching / forced sprouting** — future caretaker action, the inverse of pruning: force a dormant/adventitious bud at a chosen point. Premium precision action (alongside shears) enabling deliberate sculpting toward high-value stat-terrain coordinates. Deferred and tracked; not in prototype. Sequencing note: do NOT pull the one-third/attachmentY engine change into StatDeriver Task B — it builds against the branchId proxy as planned; one-third rule is its own engine task after StatDeriver lands.

## 2026-07-16

- **StatTerrain — NEUTRAL bucket kept at natural 1/6**: With `spatialHash % 6` producing 6 equal buckets, NEUTRAL gets ~16.7% naturally. Decision: keep as-is for first pass. Flagged for playtest tuning — may merge NEUTRAL into other buckets if terrain feels "too quiet". Observed in T2: 16.66%.

- **StatTerrain — Chokkan spline only (R4)**: Only Chokkan (formal upright) implemented: straight vertical spline from (128,38,128) to (128,220,128). Other 7 styles (Moyogi, Shakan, Kengai, Fukinagashi, Bunjin, Hokidachi, Sekijoju) stubbed with // TODO markers behind a clean `StyleSpline` interface. No restructuring required when styles 1–7 are added.

- **StatTerrain — seed routing clamped to Chokkan (R5)**: Style index = `seed % 8`. Only index 0 (Chokkan) is live. `splineForSeed()` clamps all seeds to Chokkan until styles 1–7 are implemented. Clamp is temporary — remove when styles ship. Consequence: T6 shows identical match% for all seeds under clamp (expected; noted in test as DEFERRED).

- **StatTerrain — proximity curve first-pass values (R6)**: `proximityCurve` values used as specified: dist=0→3.0, <5→2.0, <15→1.5, <30→1.0, else→0.8. Untuned. Flagged for playtest iteration.

- **StatTerrain — ideal region threshold = 10 voxel-units (R7)**: `distanceToIdealPath < 10` defines the ideal region for `calculateMatch`. Enumerated by walking the Chokkan spline neighbourhood bounding box ([118,138]×[28,230]×[118,138]). Flagged for playtest tuning.

- **C9 corrective — R2/R4/R5 registered in spec**: R2, R4, R5 were not in KIJO-TECH-SPEC.md §10 research register (only R6, R7, R9, R14, R15, R17, R18, R19 were). Added R2 (NEUTRAL bucket fraction), R4 (style splines), R5 (style assignment) to the register to match the labels used in code and decisions log.

## 2026-07-17

- **StatDeriver — R14 structural multipliers (first-pass)**: HP_MULT=0.35, POWER_MULT=0.50, ENDURANCE_MULT=0.50, KI_MULT=3.00. Calibrated so Day-200 hardwood seed 464497 lands hp≈961 ∈ [800,1500]. Observed trunk voxel region contributes ~2,700 HEARTWOOD voxels; ×0.35 → ~945 HP. All four multipliers FLAGGED FOR PLAYTEST TUNING.

- **StatDeriver — arm/leg split (mass-ratio approximation, TEMPORARY)**: BARK voxels cannot be attributed to individual branches without per-voxel branch IDs. First-pass: apportion BARK voxels between ARM and LEG using mass-ratio (thickness × estimated length) of depth-1 branches sorted by polar angle. Lower half by Y-position → LEG (Endurance), upper half → ARM (Power). Odd branch: middle goes to LEG (conservative). This is a known approximation — will be retired when role tagging is added to the voxelizer (Task A of role-tagging sprint).

- **StatDeriver — VoxelSet structural interface**: StatDeriver uses a structural `VoxelSet` interface (`has`, `get`, `forEach`) instead of importing `SparseVoxelSet` directly. Avoids circular dep (voxelizer→engine already exists). SparseVoxelSet satisfies VoxelSet via duck-typing. Same pattern as StatTerrain's VoxelReader.

- **StatDeriver — matchPct key name**: Output uses `matchPct` (not `matchPercent`). Authoritative source is KIJO-ENGINE-API.md StatSheet type definition which uses `matchPct`. The build prompt contained a discrepancy — KIJO-ENGINE-API.md wins.

- **Design decision — material vs role separation (owner directive)**: A voxel carries TWO orthogonal fields: `material` (render-only — what it's made of; heartwood/bark/leaf/root by actual composition; unchanged in meaning) and `role` (morphology — what body part it became; TRUNK/ARM/LEG/DIGIT/CANOPY/ROOT/SCAR). Material answers "how does it look." Role answers "what is it." A BARK voxel can simultaneously be ARM role. Do NOT conflate them. The prior spec definition of material by depth (BARK="depth 1") conflated the two — this is the bug being fixed. Role tagging moves into the voxelizer (where branch identity is known at fill time) and StatDeriver reads role directly, retiring the mass-ratio approximation entirely.

- **ARM/LEG split — attachment Y-position (corrected from polar angle)**: Sort depth-1 branches by the Y-coordinate of their attachment point on the trunk. Lower attachment → LEG (Endurance), upper attachment → ARM (Power). Split at median — lower half LEG, upper half ARM. Growth angle is irrelevant: a branch attached at hip height that grows upward is still a LEG; a downward-sweeping branch attached at shoulder height is still an ARM. Cascade/Kengai styles would misclassify every limb under an angle rule — attachment height stays correct regardless of style. Tiebreak rules: odd count → median branch goes to LEG (a 3-branch tree = 2 legs + 1 arm, stable base). Single depth-1 branch → ARM (a lone limb reads as reaching, not standing).

- **VoxelRole tagging -- Task A complete (2026-07-17)**: VoxelRole enum added to @kijo/shared. SparseVoxelSet updated from Map<number,Material> to Map<number,VoxelCell> where VoxelCell = {material, role, branchId}. Voxelizer assigns roles at fill time. Per-voxel branchId included (+3 bytes/voxel vs prior, footprint ~7 bytes total vs ~4 bytes). Decision to include branchId: enables MorphologyMapper and retires StatDeriver mass-ratio approximation in Task B without a second voxel traversal. V7, V8, V9 gate tests added and passing.

- **branchId per voxel -- included (yes)**: Adds ~3 bytes/voxel (JS Map entry grows from {material} to {material,role,branchId}). JS Map overhead dominates anyway (~50 bytes per entry). Absolute footprint change negligible. Benefit: MorphologyMapper can attribute any voxel to its source branch without re-running voxelization. Decision: include. Revisit only if memory profiling shows Map as a bottleneck (flag: R-VOXMEM).

- **ARM/LEG split -- branch ID proxy for attachment Y (implementation note)**: In the current engine, all depth-1 branches attach at the same Y-coordinate (trunk tip at fork time). Branch ID proxies attachment height because lower ID = created on an earlier growth tick = trunk was shorter = effectively lower anatomical attachment. The proxy is correct given current fork mechanics. If engine is ever changed to allow multi-Y attachment (e.g., branch grafting), replace ID proxy with explicit attachment Y stored on Branch. Flag: R-ATTACHY.

- **StatDeriver Task B — mass-ratio approximation retired (2026-07-17)**: `deriveStructural` rewritten to read VoxelRole directly from voxels (role is stamped per voxel at voxelization time). TRUNK→HP, ARM→Power, LEG→Endurance, CANOPY→Ki. DIGIT/ROOT/SCAR contribute no structural stat. The TEMPORARY mass-ratio bark-splitting approximation (polar-angle sort of depth-1 branches, fractional BARK attribution) is deleted entirely. VoxelSet interface: `get()` removed (unused in StatDeriver; return type incompatible with new VoxelCell). Interface now: `{has, forEach(6-arg)}`. Gate suite expanded to D1–D7 (35/35 assertions).

- **R14 recalibration after Task B**: Exact role counts for Day-200 hardwood seed 464497 are TRUNK=2740, ARM=780, LEG=340, CANOPY=98. Prior D1 fixture (mass-ratio) was hp=959, power=184.34, endurance=375.66, ki=294. New D1 fixture (role-based) is hp=959, power=390, endurance=170, ki=294. HP unchanged (TRUNK×0.35). Multipliers kept at HP_MULT=0.35, POWER_MULT=0.50, ENDURANCE_MULT=0.50, KI_MULT=3.00 — HP still ∈ [800,1500], all values positive. All four multipliers still FLAGGED FOR PLAYTEST TUNING (R14).

- **D7 morphology fidelity gate**: ARM-heavy tree (prune id=2 children each tick → ARM tip grows to 2795 voxels) yields Power=1399.74. LEG-heavy tree (prune id=1 children each tick → LEG tip grows to 2481 voxels) yields Endurance=1242.57. Cross-tree: armHeavy.power > legHeavy.power (1399 > 392) ✓, legHeavy.endurance > armHeavy.endurance (1242 > 172) ✓. Role-to-stat mapping confirmed correct end-to-end (GDD §4.2 exact).

### D7 multi-branch coverage — deferred to R-ATTACHY (2026-07-17)
D7 validates morphology fidelity only for seed 464497's 2-branch topology (1 ARM + 1 LEG).
The floor(n/2) ARM/LEG split at 4+ depth-1 branches is not yet tested.
grow200Biased's index-based pruning would mis-target branches at higher branch counts.
Resolution: bundle a multi-branch D7 variant with the R-ATTACHY task. When the growth engine
gains proper one-third-rule branch placement and explicit attachmentY (KIJO-TECH-SPEC ss4.6),
trees will naturally produce realistic branch counts, and D7 gets a multi-branch variant
selecting the pruned branch from the true ARM id set.
Do NOT add a synthetic multi-branch test before R-ATTACHY is resolved.

- **Care->combat JSON contract locked (2026-07-17)**: `fixtures/exportFixture.mjs` is the I/O bridge connecting the care side to the combat side. It wraps CareLogReplay -> Voxelizer -> StatDeriver and writes JSON to disk. Engine stays PURE -- exportFixture lives in `fixtures/` at repo root; engine never imports from it.

- **Fixture JSON shape -- canonical contract**: The fixture envelope has `{seed, species, ageDays, generatedAt, stats}`. Godot reads from `.stats`. The 8 keys under `.stats` are the KijoStats resource contract: `{hp, power, endurance, ki, skillSlots, skillPoints, wisdom, matchPct}`. All camelCase. Any change to StatSheet keys in `@kijo/shared` must update BOTH the engine (StatSheet interface) and the Godot resource (`kijo/scripts/kijo_stats.gd`). These two sides must stay in sync.

- **Godot integration note (2026-07-17)**: `kijo/scripts/kijo_stats.gd` currently reads keys from the JSON ROOT (`data.get("hp", 0.0)`). To read from the `.stats` sub-object (the canonical contract), update `from_json()` to extract `var stats_data = data.get("stats", {})` and read from `stats_data`. This one-line change is deferred to the Godot integration task -- the fixture shape is correct as specified.

- **Canonical fixture files**: `fixtures/hardwood_real.json` (hardwood, seed 464497, 200 days, water every 5 days) and `fixtures/tropical_real.json` (tropical, seed 777001, 200 days, same care). These are real engine-derived numbers, not authored. They are the reference examples for the care->combat contract. E1-E5 all pass (56 assertions, exit 0).

- **Stat fidelity doctrine — downstream consumers must not re-scale engine stats (owner directive, 2026-07-18)**: Combat prototype showed the Day-200 tropical (seed 777001) at Ki=99.35 vs hardwood Ki=336.46 — the opposite of the GDD glass-cannon fantasy ("thin trunk, enormous canopy = massive Ki"). Root cause is engine-side: CANOPY=33 voxels x KI_MULT=3.00 (R14, flagged for tuning), and this tropical's real canopy is thin at 200 days. Owner ruled: NO prototype-side Ki normalization, NO hand-editing fixtures to hit a target feel. If a kijo feels Ki-starved, the correct fixes are (a) tune LEAF_KI_MULTIPLIER / canopy density in the engine under R14, or (b) grow a leafier tree through the care loop. The care system's horticultural truth (one-third rule, taper, notching) must flow into combat truth unfiltered — authenticity of the growth model is the product. Tropical Ki benchmark target: ~600-900 pool at 200 days when R14 tuning lands, so the glass-cannon archetype can throw specials all day as designed.

- **3D care client — three.js over voxel truth, staged lazy-load by structure (owner directive, 2026-07-18)**: The 2D canvas projection cannot show where the tree sits in the 256^3 stat terrain, so `apps/web/index3d.html` + `src/main3d.ts` render the SparseVoxelSet directly with three.js (one InstancedMesh per material; 10k+ voxels is trivial for instancing). Load order doubles as readability and perf: trunk + depth-1 limbs appear instantly, depth-2 (DIGIT) and canopy (LEAF) stream in over ~1.5s — owner: "if we lazy load the trunk and main limbs and let the depth 2 branches and leaves load afterwards then it shouldn't be a performance problem ever." The 2D page (index.html) stays as the lightweight fallback/debug view; engine code untouched.

## 2026-07-18 (R-ATTACHY)

- **R-ATTACHY closed -- branchId proxy retired (2026-07-18)**: `attachmentY: number` added to the `Branch` interface in `@kijo/shared`. Set at fork time in `GrowthEngine.extendAndFork`. The voxelizer now sorts depth-1 branches by `attachmentY` (ascending) instead of `id` for the ARM/LEG split. ARM/LEG role assignment is now based on real morphological attachment height, not historical fork order.

- **One-third rule implemented (2026-07-18)**: The bare-lower-third constraint from KIJO-TECH-SPEC s4.6 is enforced in `GrowthEngine`. For depth-1 branches created in a single trunk fork event: primary child (i=0) records `attachmentY = round4(trunk.length * 0.33)` (one-third of trunk at fork time); secondary child (i=1) records `attachmentY = round4(trunk.length)` (trunk tip). This gives each pair a genuine, varied attachment height: lower child is LEG, upper child is ARM. Verified: seed 464497 hardwood trunk forks at length 28.4454 -> primary aY=9.387 (33.0%), secondary aY=28.4454 (100%).

- **MIN_TRUNK_FOR_FIRST_BRANCH = 20 (voxel units) -- FLAGGED FOR PLAYTEST TUNING**: The trunk will not fork its first depth-1 branch until `trunk.length >= 20`. Enforces the one-third rule minimum (bare zone must be meaningful). For seed 464497 hardwood this threshold has no effect (trunk already at 28.4 when fork triggers at day 10). Impact on other seeds/species: any tree that would fork before trunk length 20 is now delayed until that minimum is reached. Tune upward if bare zone feels too short; downward if branching is delayed too long.

- **Backward compat -- retroactive attachmentY (2026-07-18)**: All branch creation paths now set `attachmentY` at fork time. Functional path `tree.ts:tick()` uses `round4(parent.length)` (parent-tip fallback) for any child. No old-branch retroactive assignment needed for current gate tests since all branches are freshly grown through GrowthEngine.

- **ARM/LEG split sort: attachmentY ascending (2026-07-18)**: Voxelizer `computePositions` now accepts `parentStart` (Vec3) and computes each branch's actual start as `parentStart + parentDir * branch.attachmentY`. Depth-1 primary branches (aY=0.33*T) now begin their tube at one-third of the trunk, not at the tip. Depth-2+ branches (aY=parent.length) still start at their parent's tip. Gate impact: voxel counts shifted slightly (8797 vs previous 9029), HP 809.94 still in [800,1500], all roles present, D7 morphology fidelity preserved.

- **Ideal-path guidance is a HINT, not a solution (owner directive, 2026-07-18)**: The 3D client shows a soft translucent ghost shell around the seed's favoured-form region (Chokkan: the vertical axis cylinder, radius = IDEAL_REGION_DISTANCE) — toggleable, deliberately vague. NO per-voxel stat heat map, NO paint-by-numbers overlay. Owner: "growing into a perfect form is meant to be a Bonsai Tree Master that takes people decades to achieve. The perfect form is a long term player goal." Suggestions only; mastery stays with the player.

## 2026-07-20

- **tick() one-third rule (2026-07-20)**: The functional `tick()` path in `packages/engine/src/tree.ts` now mirrors `GrowthEngine.extendAndFork` for depth-1 branch creation. Before this change, all new children received `attachmentY = round4(b.length)` (parent tip) regardless of depth. Now: (1) the first depth-1 fork is suppressed until trunk.length >= MIN_TRUNK_FOR_FIRST_BRANCH (20), matching GrowthEngine's gate; (2) the primary child (i=0) of the first depth-1 fork receives `attachmentY = round4(trunk.length * 0.33)` (one-third rule); (3) all subsequent depth-1 children and all depth-2+ children continue to use `round4(parent.length)`. MIN_TRUNK_FOR_FIRST_BRANCH is defined as a local const in tree.ts (value 20, same as GrowthEngine) -- not imported to avoid coupling the functional path to the class path. A8 and A9 gate the tick() path: A8 verifies first depth-1 attachmentY lands 30-40% of trunk; A9 verifies second is strictly higher and near the trunk tip. A1-A9 all pass (18/18 assertions). R-ATTACHY fully closed.

## 2026-07-26

- **WATER_AMOUNT = 28 exported from @kijo/shared (C-1 fix)**: `WATER_AMOUNT = 28` is now the single source of truth in `packages/shared/src/index.ts`. Both `packages/engine/src/CareLogReplay.ts` and `apps/web/src/bridge/care_bridge.ts` import it instead of hardcoding. Resolves conflict C-1 from ARCH-GUEST-MODE.md (care_bridge used 28, CareLogReplay hardcoded 30 -- care logs recorded with 28 would replay with 30, breaking determinism). This was a required fix before guest mode can be implemented.

- **OpenZeppelin pinned to 5.0.2 (NOT 5.1+)**: `contracts/package.json` uses `"@openzeppelin/contracts": "5.0.2"` (exact version, no caret). OZ 5.1+ introduced the `mcopy` opcode (EIP-5656, Cancun EVM), which Ronin runs on the London EVM fork and does not support. Using OZ 5.1+ with `evmVersion: 'london'` in hardhat.config causes a compile error: `Unsupported opcode: mcopy`. The arch doc (KIJONSAI-CONTRACT-ARCH.md §4) specifies `"^5.2.0"` -- this is incorrect for Ronin. **Use 5.0.2 exactly.** Do not upgrade without verifying Ronin's EVM version first.

- **Kijonsai ERC-721 deployed to Saigon testnet**: Contract address `0x4447F631F5868bFA03A6e6ae2D2da9f22c787E44`, deploy tx `0x9c2f7c9d6bb034a93c9b10a333f26a5ab94c925fe199f8b86d04839b40b28376`, block 52749550. Admin: `0x26D9E80f4A8ca7f223D7e557075d4b73e2916D58`. Minter: `0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199` (treasury wallet, testnet only -- NOT for mainnet; mainnet requires KMS key per §9.1 of contract arch doc).

- **Supabase project: xutjubkaskwchzyzwryk**: All backend objects live in this project.

- **seed_claims table as replay guard**: Schema: `tx_hash TEXT PRIMARY KEY, claimed_by UUID, count INTEGER, claimed_at TIMESTAMPTZ`. The seed-claim Edge Function inserts a row keyed on `tx_hash` before minting. A duplicate `tx_hash` INSERT fails with a unique constraint violation, preventing double-minting from the same RON payment transaction. This is the idempotency mechanism for the seed purchase flow.

- **kijonsai_token_id_seq as atomic token ID source**: Postgres sequence `kijonsai_token_id_seq` is the single source of token IDs. The seed-claim Edge Function calls `get_next_kijonsai_token_id()` (SECURITY DEFINER function wrapping `nextval`) to atomically claim the next token ID before calling `mintKijonsai` on-chain. This prevents two concurrent requests from being assigned the same tokenId (which would cause the second on-chain call to revert while the buyer's RON is already transferred).

- **wallet_auth_lookup() as SECURITY DEFINER**: `wallet_auth_lookup(p_address TEXT)` is a Postgres function with SECURITY DEFINER, callable from the wallet-auth Edge Function. It looks up the Supabase user_id for a given wallet address. SECURITY DEFINER is required because the wallets table uses RLS and the Edge Function's service role bypasses it -- this function provides a controlled, auditable lookup path.

- **wallet-auth Edge Function: verify_jwt MUST be false (permanent)**: `wallet-auth` is the auth bootstrapping endpoint. It accepts an unsigned request (wallet address + signature + nonce), verifies the ECDSA signature, and issues a Supabase JWT. If `verify_jwt: true` were set, the function would require a valid JWT to be called -- but the user has no JWT yet (that's the purpose of the call). This is NOT a security weakness; the function's security comes from ECDSA signature verification of the wallet. Do NOT change this setting. Every other Edge Function uses `verify_jwt: true`.

- **Nonce strategy: timestamp-based (within 5-minute window)**: The wallet-auth nonce is the current Unix timestamp in seconds. The server rejects nonces older than 5 minutes. This prevents signature replay attacks without requiring a server-side nonce table. Single-use nonce table (prevents replay within the 5-minute window) is **Phase 2 hardening** -- deferred. Rationale for deferral: the 5-minute window is short enough that a stolen signed message has limited utility, and the `seed_claims` replay guard already prevents the most dangerous replay (double-minting).

- **care_log_hash Merkle root deferred to Phase 2**: PRD §5.1 launch criterion "with care log Merkle root" is officially cut from Phase 1. See KIJONSAI-CONTRACT-ARCH.md §1.1 for full rationale. In Phase 1, the server is the sole trust anchor; an on-chain hash the server also computes adds no verifiable trustlessness. The update protocol (per-action vs daily vs on awakening) is unspecified. The hash becomes meaningful in Phase 2 when client-side replay tooling exists. The Kijonsai contract has no `care_log_hash` field -- this is intentional.

- **Mint flow architecture (2026-07-26)**: `client -> useWalletAuth (sign nonce) -> wallet-auth Edge Function (verify sig, issue JWT) -> useSeedPurchase (send RON via wagmi sendTransaction) -> wait for receipt -> POST to seed-claim Edge Function (JWT in Authorization header, tx_hash in body) -> seed-claim: verify RON payment on-chain, insert seed_claims row (replay guard), call get_next_kijonsai_token_id() (atomic), call mintKijonsai on-chain -> return { tokenId, txHash }`. **UI-verified end-to-end (2026-07-26):** User clicked "Sign in with Wallet" in SeedShopModal in the live browser app, signed the auth message in Ronin Wallet extension, purchased via the Buy Seeds modal. Token #2 minted to treasury wallet on Saigon testnet, tx `0x8a9df011...f09f6b61`. This is a browser UI test, not a curl/server-side test.

- **useWalletAuth hook -- access_token stored in memory only**: The Supabase JWT returned by wallet-auth is stored in a React ref inside `useWalletAuth` -- NOT in localStorage, NOT in sessionStorage. Reason: JWTs are bearer tokens; storing in localStorage exposes them to XSS. Memory storage means the user must re-authenticate on page reload. This is acceptable for Phase 1 (the bonsai game session is typically short-lived). Phase 2 can add refresh token flow if session persistence becomes a UX issue.

## 2026-07-31

- **Stat-zone index — trilinear Value Noise at float-space attachment point (jitter fix)**: Zone index per branch is derived from trilinear Value Noise evaluated at the branch's continuous float-space attachment point (not the nearest integer voxel). Wavelength = 32 voxel-units (ZONE_WAVELENGTH). Noise output maps to zoneIndex 0–7, which indexes STAT_TYPES buckets. Chosen over per-voxel spatial hash because the hash produced visible jitter when a branch's growth changed its outermost integer voxel position — zone-assignment flipped on a single-tick grow. Float-space evaluation anchors the zone to the skeleton, not the voxel grid, eliminating boundary flicker.

- **seed % 7, not seed % 8 — Sekijoju is banned**: Style index used in `splineForSeed` is `seed % 7` (not `% 8`). There are exactly 7 playable growth styles (Chokkan, Moyogi, Shakan, Kengai, Fukinagashi, Bunjin, Hokidachi — indices 0–6). Sekijoju (landscape/root-over-rock) has no spline and is not a playable solo style; index 7 must never route. Using `% 8` would silently produce index 7 for some seeds, hitting a missing-spline path. Using `% 7` ensures all seeds map to a valid implemented (or future-implemented) style.

- **CareAction water amount required in care log (fix 2026-07-31)**: `CareLogEntry` water actions must carry `amount: number`. The `buildWaterLog` helpers in `fixtures/test_fixtures.mjs` and `fixtures/generate.mjs` previously emitted `{ type: 'water' }` without `amount`, causing `CareLogReplay.reconstruct` to call `tree.water(undefined)` → NaN moisture on every replay. Fixed: both helpers now include `amount: WATER_AMOUNT` (28, imported from `@kijo/shared`). Golden fixtures (`hardwood_real.json`, `tropical_real.json`) regenerated with correct watering. Prior fixture values were derived from a non-watered replay and are now replaced.
