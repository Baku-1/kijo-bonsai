# Tree Selection Feature — Adversarial Audit
**Date:** 2026-08-06  
**Scope:** Tree selection UI + purchase flow + species engine — all code from initial selection through tree creation in DB.  
**Auditor:** Claude (adversarial-auditor skill)  
**Verdict:** REFUTED on multiple critical claims

---

## VERDICT: REFUTED

Three independent blocking issues: a multi-seed RON loss bug, species descriptions that contradict what the engine actually does, and the determinism test suite testing a legacy engine that production never calls.

---

## CLAIMS CHECKED

| # | Claim | Status | Evidence |
|---|-------|--------|----------|
| 1 | Species required before Buy enables | ✓ VERIFIED | `canBuy = isConnected && !!accessToken && !!selectedSpecies`; `handleBuySeed` guard is belt-and-suspenders |
| 2 | Species stored durably in DB | ✓ VERIFIED | seed-tree validates against `['hardwood','evergreen','tropical']` and INSERTs into `trees.species` |
| 3 | Species permanently associated with minted NFT | ✗ REFUTED | seed-claim mints the NFT before seed-tree runs; species is never passed to seed-claim; the on-chain NFT carries only `metadataUri` (an opaque URL) |
| 4 | Buying N seeds creates N trees/NFTs | ✗ REFUTED | seed-claim always mints **1 NFT**; initTree always creates **1 DB row**; count only multiplies the RON charge |
| 5 | Species descriptions match in-game behavior | ✗ REFUTED | Tropical described as "Tight clusters" but has the widest fork spread (29°–69°); Evergreen described as "asymmetric reach" but is the tightest (6°–23°) |
| 6 | Species differentiates tree growth | ⚠ PARTIAL | Fork probability, spread, and extension rate ARE differentiated; thickening (thickenRate) is NOT used in GrowthEngine (hardcoded 0.05/0.02) |
| 7 | Species differentiates moisture decay | ✗ REFUTED | `moistureDecay` (4/5/7) is only read by the legacy `tree.ts::tick()`; production path `BonsaiTree.applyDailyUpdate()` uses seeded-random 5–9/day regardless of species |
| 8 | Production engine is deterministic | ? UNVERIFIABLE | Structurally plausible (seeded RNG); no determinism test covers the production code path |
| 9 | Determinism tests cover production replay | ✗ REFUTED | Tests call `tree.ts::tick()` (legacy); production calls `GrowthEngine.growTick()`; different moisture decay, water amount, growth formula, starting conditions |
| 10 | retryTreeInit works after failure | ⚠ CAVEAT | Normal path is correct; silent no-op if `pendingSpeciesRef.current == null` (no user feedback) |

---

## INTENT CHECKS

### INT-1: Tropical species description vs. engine

```
INTENT CHECK
  code does:     forkSpreadMin=0.5rad(29°), forkSpreadMax=1.2rad(69°), extensionMultiplier=1.3, forkChance=0.16, secondaryForkChance=0.25
  check expects: UI hint says "Tight clusters, fast-growing — aerial complexity"
  spec says:     engine/species.ts forkAngle=20° (tight), but this field is NOT used by GrowthEngine
  verdict:       CONFLICT — UI copy was written against the legacy species.ts forkAngle, but GrowthEngine
                 uses SPECIES_PARAMS forkSpreadMax=1.2rad=69°. Tropical is actually the widest, most
                 sprawling species. "Tight clusters" is factually incorrect.
```

### INT-2: Multi-seed purchase

```
INTENT CHECK
  code does:     Charges count × 3 RON. Mints exactly 1 NFT. Creates exactly 1 DB row.
  check expects: UI quantity selector allows 1–10 seeds, price display reads "count × 3 RON"
  spec says:     STORE_ITEMS description: "Plant a new Kijonsai bonsai" (1 seed = 1 bonsai)
  verdict:       CONFLICT — buying 3 seeds costs 9 RON but delivers 1 NFT and 1 tree.
                 The UI implies N→N; the backend implements N→1.
```

### INT-3: Determinism tests vs. production replay

```
INTENT CHECK
  code does:     determinism.test.js calls createTree()+tick() (tree.ts legacy). Water = +25 hardcoded.
                 Moisture decay = species-specific deterministic (4/5/7).
                 Starting state: moisture=50, health=60.
  check expects: "same seed + species + care log ⇒ identical tree (core invariant)"
  spec says:     Production: CareLogReplay → GrowthEngine.growTick → BonsaiTree.applyDailyUpdate.
                 WATER_AMOUNT = 28. Moisture decay = seeded-random 5–9, species-agnostic.
                 Starting state: moisture=55, health=85.
  verdict:       CONFLICT — tests verify the legacy functional API; the production OOP engine
                 has never been verified for determinism. These are different code paths.
```

---

## SCOPE

No single file claims to own tree selection end-to-end; the feature is spread across 7 files. Scope of this audit covered all of them. Key observation: the engine module exports two parallel, incompatible systems from the same `index.ts`:
- Legacy: `createTree`, `applyAction`, `tick` (from tree.ts)
- Production: `BonsaiTree`, `GrowthEngine`, `CareLogReplay`

Both are exported. Only the production system is called by the UI. Only the legacy system is tested.

---

## FRAUDS HUNTED

**Weakened tests:** No. The tests are honest but they're testing the wrong system.  
**False completion:** No explicit completion claim was made; the bugs are design/implementation gaps.  
**Intent inversion:** YES — INT-1 above. The UI copy for species was written against `species.ts::forkAngle` (which IS tight for tropical at 20°), but GrowthEngine was later switched to use `SPECIES_PARAMS::forkSpreadMax` (which is wide for tropical at 69°). The description became wrong when the growth engine changed, without the UI copy being updated.  
**Phantom evidence:** `GrowthEngine.ts` line 3 comment says "fallback for forkChance, thickenRate (absent from shared SPECIES_PARAMS)". `thickenRate` is listed but is NOT actually imported or used in GrowthEngine anywhere. The comment describes intent that was never implemented.

---

## FINDINGS BY SEVERITY

### CRITICAL — Block before any Phase 2 work

**C-1: Multi-seed RON loss**  
File: `useSeedPurchase.ts`, `seed-claim/index.ts`  
Buying count > 1 seeds charges count × 3 RON but delivers 1 NFT and 1 tree. With the quantity input accepting 1–10, a player paying 30 RON (10 seeds) receives exactly 1 NFT. The other 9 seeds' worth of RON is unrecoverable. The quantity input in the UI must be removed or disabled until multi-seed minting is implemented end-to-end.  
**Fix:** Either cap quantity to 1 and remove the quantity selector, OR implement a mint loop in seed-claim that calls mintKijonsai N times and calls initTree N times.

**C-2: Determinism tests test the wrong engine**  
Files: `packages/engine/test/determinism.test.js`, `packages/engine/src/tree.ts`, `packages/engine/src/BonsaiTree.ts`  
The test suite verifies `tree.ts::tick()` — a legacy system never called by the UI. The production engine (`BonsaiTree + GrowthEngine`) has no determinism test. The NFT verification claim ("reconstruct from Merkle-verified log, compare to claimed state") rests on determinism that is unverified. A production replay of the same log may produce different results across versions.  
**Fix:** Write determinism tests using `CareLogReplay.reconstruct()` with `BonsaiTree` + `GrowthEngine`. Run twice, `deepEqual` the resulting TreeState. The legacy `tick()` tests can be kept for regression but should be labelled as such.

**C-3: Species descriptions are factually wrong**  
File: `apps/web/src/components/StoreModal.tsx` (SPECIES_OPTIONS)  
The descriptions were written against `engine/species.ts::forkAngle` (20°/30°/45°) but GrowthEngine uses `shared::SPECIES_PARAMS::forkSpreadMin/forkSpreadMax` (converted from radians). These disagree:

| Species | UI says | Engine actually does |
|---------|---------|---------------------|
| Hardwood | "wide forked branches" | Medium spread 17°–46°, highest branching (0.45 secondary) |
| Evergreen | "asymmetric reach" | **Tightest** spread 6°–23°, slowest growth (0.8×) |
| Tropical | "Tight clusters, fast-growing" | **Widest** spread 29°–69°, highest fork probability (0.16), lowest secondary branching (0.25) |

Players choosing "Tropical" for compact trees will receive the most sprawling growth. This is a deceptive user experience on an irreversible choice.  
**Fix:** Update SPECIES_OPTIONS hints to match what `GrowthEngine.extendAndFork()` actually produces, or invert the SPECIES_PARAMS values to match the descriptions.

---

### HIGH — Fix before Phase 2 entry

**H-1: Species/NFT integrity gap**  
Files: `seed-claim/index.ts`, `seed-tree/index.ts`  
The NFT is minted in seed-claim; species is recorded in seed-tree. These are sequential, not atomic. If seed-tree fails permanently (all retries exhausted), the on-chain NFT exists with no species in the DB. The metadata API (`https://api.kijo.xyz/nft/metadata/${tokenId}`) would serve a tree with no species. The `retryTreeInit` retry path helps but does not eliminate the gap.  
**Fix:** Either include species in the seed-claim request (store in seed_claims table) as a durable record, or make seed-tree idempotent and guaranteed via a queue/job system.

**H-2: Two engine implementations with conflicting behavior**  
Files: `packages/engine/src/tree.ts`, `packages/engine/src/BonsaiTree.ts`, `packages/engine/src/species.ts`, `packages/shared/src/index.ts`  
- Growth rate: legacy uses `growthRate` (0.6/0.8/1.2); production uses `extensionMultiplier` (1.0/0.8/1.3)
- Moisture decay: legacy is species-specific (4/5/7); production is seeded-random species-agnostic (5–9)
- Water amount: legacy hardcodes +25; production uses WATER_AMOUNT=28
- Fork angle: legacy uses degrees (45/30/20°); production uses radians (0.3–0.8 / 0.1–0.4 / 0.5–1.2)
- Thickening: legacy uses thickenRate (0.08/0.05/0.03); production hardcodes 0.05/0.02
- Starting conditions: legacy moisture=50, health=60; production moisture=55, health=85

These will produce diverging trees from the same seed and species. Any NFT verification that crosses the engine version boundary will fail.  
**Fix:** Deprecate `tree.ts::tick()`, `createTree()`, `applyAction()` and their tests, or unify both systems. If `tree.ts` is truly legacy, mark it `@deprecated`, remove it from `index.ts` exports, and migrate the test suite.

**H-3: Buy button re-enables after successful purchase**  
File: `apps/web/src/components/StoreModal.tsx`  
After `treeId` is set (full success), `isBusy = false` and if `selectedSpecies` is still set, `canBuy = true`. The "Buy Seed" button is active. Accidental click starts a second RON transfer immediately. There is no confirmation step.  
**Fix:** Clear `selectedSpecies` on success (when `treeId` is set), OR add a guard in `handleBuySeed` checking `!treeId`.

**H-4: Species cast at DOM boundary is unvalidated**  
Files: `apps/web/src/main2d.ts` (line 27), `apps/web/src/main3d.ts` (line 268)  
```typescript
const species = (document.getElementById('species') as HTMLSelectElement).value as SpeciesClass;
```
If the select is absent from the DOM or has a blank value, `SPECIES_PARAMS[undefined]` returns `undefined`, and `sp.extensionMultiplier` in `calculateGrowthRate()` throws `TypeError: Cannot read properties of undefined` on the first `growTick`. The 3D view starts blank with an invisible console error.  
**Fix:** Validate `species` against known values before constructing BonsaiTree. CareLogReplay already shows the pattern: `Object.prototype.hasOwnProperty.call(SPECIES_PARAMS, species)`.

---

### MEDIUM — Fix before mainnet

**M-1: moistureDecay in engine/species.ts is dead code**  
File: `packages/engine/src/species.ts`  
`moistureDecay` (hardwood=4, evergreen=5, tropical=7) is declared and used only in `tree.ts::tick()`. The production `BonsaiTree.applyDailyUpdate()` ignores it entirely, using seeded-random 5–9. All species decay at the same rate in production. The per-species water management implied by the values is not implemented.  
**Fix:** Either remove the field and implement per-species decay in `BonsaiTree.applyDailyUpdate()`, or accept that moisture is species-agnostic and remove the dead values.

**M-2: thickenRate in engine/species.ts is dead code**  
File: `packages/engine/src/species.ts`; comment mismatch in `GrowthEngine.ts` line 3  
`thickenRate` (0.08/0.05/0.03) is listed in the GrowthEngine comment as a "fallback" but is never imported or used in GrowthEngine. Thickening uses hardcoded 0.05×rate (trunk) and 0.02×rate (branches). The per-species thickening differentiation is not implemented.

**M-3: Non-integer quantity passes client validation**  
File: `apps/web/src/components/StoreModal.tsx` (line 524)  
`setQty(item.id, Number(e.target.value))` — `Number("1.5")` passes `Math.max(1, Math.min(10, 1.5))` = 1.5. `buySeeds` only checks `count < 1 || count > 10`, not `Number.isInteger(count)`. Server correctly rejects fractional count with 400. Client should prevent input.  
**Fix:** `Math.floor(Number(e.target.value))` in `setQty`, or `type="number" step="1"` in the input.

**M-4: Claim failure has no UI retry path**  
File: `apps/web/src/wallet/useSeedPurchase.ts`  
When `mintKijonsai` fails after `seed_claims` INSERT succeeds, seed-claim returns `{ error: ..., claimRecorded: true }`. The client renders the error string but ignores `claimRecorded`. There is no "retry claim" button; `retryTreeInit` is not applicable (no `claimResult`). The user is told to contact support with no self-service option.

**M-5: Math.random() for seed generation**  
File: `apps/web/src/wallet/useSeedPurchase.ts` (line 331)  
`Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)` — a TODO is present. Predictable on mainnet (browser Math.random is not cryptographically secure; an attacker who can observe outputs can predict seeds). Aesthetic only on testnet, but must change before mainnet.

---

### LOW — Track for Phase 2

**L-1: CARE_ACTION_TYPES not exhaustive**  
File: `apps/web/src/persistence.ts` (line 113)  
`satisfies` proves list elements are valid CareAction types but does NOT prove coverage. A new action variant added to `@kijo/shared` but missed in this list would cause valid DB rows to silently skip at replay time. The PHASE-2 TODO comment in the file has the correct fix but it's not implemented.

**L-2: action_data type key collision risk**  
File: `apps/web/src/persistence.ts` (line 190)  
`{ type: row.action_type, ...row.action_data }` — if `action_data` ever contains a `type` key, it overwrites `action_type`. The PHASE-2 TODO acknowledges this; fix it before any external writers touch `care_log_entries`.

**L-3: SeedShopModal.tsx is dead code still in the codebase**  
File: `apps/web/src/components/SeedShopModal.tsx`  
Marked DEPRECATED in its own header. Not imported anywhere. Safe to delete; keeping it risks accidental reference during Phase 2 refactor.

**L-4: sessionStorage overwrites on sequential purchases**  
File: `apps/web/src/wallet/useSeedPurchase.ts` (line 142)  
Each successful tree init writes `SESSION_KEY` and overwrites the previous session. A player who buys multiple trees in one session loses the ability to navigate back to their earlier trees without external tracking. Low impact until multi-tree is supported.

---

## BOTTOM LINE

The tree selection UI correctly gates the buy button behind species selection and validates server-side — the guard rails are there. But three things are broken at the foundation:

1. **Multi-seed RON loss** (C-1): Remove the quantity selector or implement multi-mint end-to-end before enabling any purchase.
2. **Species descriptions are wrong** (C-3): Players are making an irreversible game choice based on text that contradicts what the engine actually does. This must be corrected before any real-money purchases go live.
3. **The determinism tests are testing a dead code path** (C-2): The core NFT verification invariant — that replay produces the same tree — has never been verified for the production engine. This is the most architecturally dangerous finding and must be addressed before Phase 2 replay work begins.
