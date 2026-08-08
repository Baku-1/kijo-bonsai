# Adversarial Audit — Dead & Duplicate Logic
**Date:** 2026-08-07  
**Scope:** `packages/shared`, `packages/engine`, `packages/voxelizer`, `apps/web/src`, `apps/server`  
**Auditor:** Adversarial-Auditor (adversarial-auditor skill)  
**Mandate:** Identify dead code, disconnected logic, duplicate logic, legacy artifacts, and disconnected test coverage. No fixes. No commits.

---

## Verdict

**CAVEATS**

The production runtime path (BonsaiTree → GrowthEngine → CareLogReplay → ThreeCanvas → Supabase Edge Functions) is correctly wired end-to-end. No false "tests pass" claims were found. However, 11 substantive findings remain: one broken import that will crash the server stub on load (F15), two same-value/different-name constant pairs (F8, F9), one same-name/different-schema type pair that is a developer trap (F4), four dead data fields in the SPECIES record (F5), an entire deprecated component file (F1), a fully dead exported function (F2), a verbatim function duplicate (F6), a polar ceiling discrepancy between two renderers (F7), a duplicate constant across packages (F3), and one permanently disconnected seed-routing function (F16).

---

## Scope Map

Files fully read and cross-referenced:

| Package | Files |
|---------|-------|
| packages/shared | src/index.ts |
| packages/engine | src/index.ts, src/rng.ts, src/tree.ts, src/species.ts, src/BonsaiTree.ts, src/GrowthEngine.ts, src/TwineWeightEngine.ts, src/WireEngine.ts, src/StatTerrain.ts, src/CareLogReplay.ts, src/StatDeriver.ts, src/PruneEngine.ts, test/determinism.test.js, test/carelog-determinism.test.js, test/WireEngine.test.js |
| packages/voxelizer | src/index.ts |
| apps/web/src | App.tsx, main.tsx, main2d.ts, main3d.ts, persistence.ts, bridge/care_bridge.ts, renderer/scene.ts, renderer/tree_mesh.ts, ui/hud.ts, components/SeedShopModal.tsx, components/StoreModal.tsx, components/ThreeCanvas.tsx, components/WalletBar.tsx, components/WalletTreeSelector.tsx, components/TutorialOverlay.tsx, wallet/useWallet.ts, wallet/useWalletAuth.ts, wallet/useSeedPurchase.ts, wallet/useListTrees.ts, wallet/config.ts |
| apps/server | src/index.ts, supabase/functions/care-action/index.ts, supabase/functions/get-tree/index.ts, supabase/functions/list-trees/index.ts, supabase/functions/seed-claim/index.ts, supabase/functions/seed-tree/index.ts, supabase/functions/wallet-auth/index.ts |

---

## Findings

---

### F1 — DEAD | REMOVE
**File:** `apps/web/src/components/SeedShopModal.tsx` (entire file)

**What it is:** A React component with a `// DEPRECATED — replaced by StoreModal.tsx` header comment. Exports a single `SeedShopModal` function.

**Why it is dead:** Grep across all of `apps/` and `packages/` finds zero import references to `SeedShopModal`. `App.tsx` imports `StoreModal` (the replacement). The deprecated file also hardcodes `species: 'hardwood'` in `handleBuy()` with an inline comment calling it out as deprecated behavior.

**Observed evidence:** `grep -r "SeedShopModal" apps/ packages/` → only the file's own definition. No import site.

**Action: REMOVE** — delete the file entirely.

---

### F2 — DEAD | REMOVE
**File:** `packages/engine/src/rng.ts` (full file); `packages/engine/src/index.ts` line 3

**What it is:** `export function nextRand(state: number): { value: number; state: number }` — a stateless functional variant of mulberry32. Re-exported from engine's public index.

**Why it is dead:** No caller outside the engine package. Grep for `nextRand` across all `.ts`/`.tsx` files in `apps/` and `packages/` returns only: (1) the definition in `rng.ts`, (2) the re-export in `engine/src/index.ts`, and (3) the dist type declaration. Zero call sites. A parallel mulberry32 implementation (`SeededRNG` class) already exists in `packages/shared/src/index.ts` and is used throughout the codebase.

**Observed evidence:** `grep -rn "nextRand" packages/ apps/` → 4 hits, all in engine's own files. No consumer.

**Action: REMOVE** — delete `rng.ts`; remove the re-export from `engine/src/index.ts`.

---

### F3 — DUPLICATE | CONSOLIDATE
**Files:**  
- `packages/shared/src/index.ts` — `export const MAX_DEPTH = 6`  
- `packages/engine/src/tree.ts` — `export const MAX_DEPTH = 6`

**What it is:** The same constant defined at the same value in two packages.

**Why it is a problem:** Engine re-exports `MAX_DEPTH` from `./tree.js` in its own index. Consumers who import from `@kijo/engine` get the engine copy; consumers who import from `@kijo/shared` get the shared copy. Currently they agree, but a future change to one will silently diverge from the other. The engine already imports from shared for other constants; this one leaked out.

**Action: CONSOLIDATE** — remove `MAX_DEPTH` from `engine/src/tree.ts`; import it from `@kijo/shared` there, and re-export from `engine/src/index.ts` sourcing shared.

---

### F4 — DUPLICATE NAME / SCHEMA DIVERGENCE | CONSOLIDATE
**Files:**  
- `packages/shared/src/index.ts` — `export interface SpeciesParams { extensionMultiplier, forkSpreadMin, forkSpreadMax, secondaryForkChance, trunkMaturationRate }`  
- `packages/engine/src/species.ts` — `export interface SpeciesParams { growthRate, forkChance, forkAngle, thickenRate, moistureDecay }`

**What it is:** Two interfaces with the identical name `SpeciesParams` but completely different fields. Engine re-exports its own `SpeciesParams` type from index.ts.

**Why it is a problem:** Any file that imports `SpeciesParams` without a qualified path gets whichever one TypeScript resolves first. The two types are structurally incompatible — no field overlaps. A developer adding a parameter to "SpeciesParams" must know to check which one they're editing. `GrowthEngine.ts` imports `SPECIES_PARAMS` (shared) and `SPECIES` (engine/species.ts) for different fields, making the split load-bearing but invisible.

**Action: CONSOLIDATE** — rename the engine-side interface to `EngineSpeciesParams` (or merge all fields into a unified `SpeciesParams` in shared with one SPECIES_PARAMS record).

---

### F5 — DEAD DATA | CONSOLIDATE
**File:** `packages/engine/src/species.ts`

**What it is:** The `SPECIES` record has 5 fields per species: `growthRate`, `forkChance`, `forkAngle`, `thickenRate`, `moistureDecay`. Comment in `GrowthEngine.ts` line 3 says "fallback for forkChance, thickenRate (absent from shared SPECIES_PARAMS)".

**Why it is dead:** Grep of `GrowthEngine.ts` for `spE.` (the engine species object) finds only one hit: `spE.forkChance` at line 89. Fields `thickenRate`, `growthRate`, `forkAngle`, and `moistureDecay` are never read from this record. `GrowthEngine` uses hardcoded `0.05 * rate` (depth-0) and `0.02 * rate` (others) for thickening — the `thickenRate` field in SPECIES is ignored. The import comment incorrectly implies `thickenRate` is used.

**Observed evidence:**
```
grep -n "spE\." packages/engine/src/GrowthEngine.ts
→ line 89: const forkP = spE.forkChance * ...
(only one match)
```

**Action: CONSOLIDATE** — add `forkChance` to `SPECIES_PARAMS` in shared; delete `engine/src/species.ts` entirely (removing 4 dead fields and the confusing comment). Harmonize with F4 fix.

---

### F6 — DUPLICATE FUNCTION | CONSOLIDATE
**Files:**  
- `packages/voxelizer/src/index.ts` — private `function rotateDirection(dir, axis, angle)`  
- `apps/web/src/renderer/tree_mesh.ts` — private `function rotateDirection(dir, axis, angle)`

**What it is:** Verbatim copy of a 3D vector rotation helper. The comment in `tree_mesh.ts` explicitly acknowledges this: "Exact port of the voxelizer's private rotateDirection."

**Why it is a problem:** Two copies of a geometric formula; a bug fix in one does not propagate to the other. The comment acknowledges the duplication but makes no plan to resolve it.

**Action: CONSOLIDATE** — export `rotateDirection` from voxelizer's public API (or move to a `packages/shared` math utility) and import it in `tree_mesh.ts`.

---

### F7 — DISCREPANCY / DISCONNECTED LOGIC | CONSOLIDATE
**Files:**  
- `packages/voxelizer/src/index.ts` — `computePositions()` clamps polar to `[0.1, 2.618]` rad (~150°)  
- `apps/web/src/renderer/tree_mesh.ts` — `computePlacements()` clamps polar to `[0.1, 1.4]` rad (~80.2°)

**What it is:** Two renderers that process the same `TreeState` branch data but apply different polar angle ceilings: 150° (voxelizer, matches WireEngine's `POLAR_MAX_DEG`) vs ~80.2° (tree_mesh.ts, no documented justification).

**Why it is a problem:** A branch trained by `WireEngine` to 130° polar will render correctly in the voxelizer path (ThreeCanvas when no voxelizer is active uses tree_mesh.ts directly) and will be clipped to ~80.2° in the parametric mesh path. The tree looks different depending on which code path renders it. This is not a cosmetic concern — in the NFT verification model, voxelizer output is the canonical visual; tree_mesh.ts silently disagrees.

**Action: CONSOLIDATE** — extract a shared `POLAR_MAX_RAD` constant (= 2.618, matching WireEngine and GDD §3.5) and use it in both `computePositions()` and `computePlacements()`. The 1.4 rad ceiling in `tree_mesh.ts` appears to be an unreferenced leftover.

---

### F8 — DEAD CONSTANT | REMOVE
**File:** `packages/engine/src/TwineWeightEngine.ts`

**What it is:** `export const BRANCH_BREAK_THRESHOLD = Infinity` — defined and exported.

**Why it is dead:** Grep across all source files finds no read site. The constant is never referenced in any conditional, assertion, or calculation. Its value (`Infinity`) means it could never trigger a break condition regardless; this is a Phase 1 placeholder that was exported but never wired.

**Action: REMOVE** — delete the constant and its export.

---

### F9 — DUPLICATE CONSTANT | CONSOLIDATE
**Files:**  
- `packages/engine/src/WireEngine.ts` — `const POLAR_MAX_DEG = 150`  
- `packages/engine/src/TwineWeightEngine.ts` — `const KENGAI_POLAR_MAX = 150`

**What it is:** Two file-local constants holding the same value (150 degrees) with different names. Both cap wire/twine polar angles.

**Why it is a problem:** The 150° Kengai ceiling is a domain rule from the GDD; its value is not arbitrary. Two separate constants means a future GDD change requires hunting two sites. The names also diverge semantically (`POLAR_MAX_DEG` vs `KENGAI_POLAR_MAX`), making their identity non-obvious.

**Action: CONSOLIDATE** — export one `POLAR_MAX_DEG = 150` (or `KENGAI_POLAR_MAX_DEG`) from a shared location (engine constants or shared index) and import in both WireEngine and TwineWeightEngine. Note: when TwineWeightEngine Phase 2 stubs are implemented, this constant will matter.

---

### F10 — RESOLVED (not dead)
**File:** `apps/web/src/renderer/scene.ts` — `createScene()`

**Confirmed live:** `ThreeCanvas.tsx` imports and calls `createScene(containerRef.current!)`. The scene (camera, renderer, controls, treeRoot) is the root of the 3D render loop.

---

### F11 — RESOLVED (not dead)
**File:** `apps/web/src/ui/hud.ts` — `CareHud`

**Confirmed live:** `ThreeCanvas.tsx` imports `CareHud` and instantiates it with `onWater`, `onNextDay`, `onToggleAuto` callbacks. `main2d.ts` and `main3d.ts` do NOT use it (they handle HUD via raw DOM), but those are debug stubs, not the production path. The production path (ThreeCanvas) uses it.

---

### F12 — RESOLVED (not dead)
**File:** `apps/web/src/renderer/tree_mesh.ts` — `buildTreeMesh()`

**Confirmed live:** `ThreeCanvas.tsx` imports and calls `buildTreeMesh(careScene.treeRoot, tree)` on initial boot and after each `refreshView()`. See F7 for the polar ceiling discrepancy in this file.

---

### F13 — RESOLVED (not disconnected test)
**File:** `packages/engine/test/determinism.test.js`

**Claimed issue from prior audit notes:** "tests legacy `tick()`, not production path."

**Confirmed resolved:** The file has a comment at the top: "migrated 2026-08-07 from tick() (legacy) to BonsaiTree + GrowthEngine (production)." All five tests now use `new BonsaiTree()` + `GrowthEngine.growTick()`. Exit code and test pass/fail were not re-run (no runner available in this context), but the source is unambiguous. The `tick()` disconnection is gone.

---

### F14 — INTENTIONAL (Phase 1 whitelist)
**File:** `apps/server/supabase/functions/care-action/index.ts`

**What it is:** `ALLOWED_ACTION_TYPES = ['water', 'prune', 'wire', 'fertilize', 'rotate']` — excludes `twine`, `weight`, `jin`, `landscape`.

**Why intentional:** Phase 1 scope. `TwineWeightEngine` methods and `JinEngine.applyJin` are stub-throwing (`CareLogReplayError`) in the engine. Allowing server-side persistence of Phase 2 actions before the engine handles them would corrupt care logs. The whitelist is the correct guard.

**Action: NONE** — document in whitelist comment that Phase 2 will extend it.

---

### F15 — BROKEN IMPORT / DEAD STUB | REMOVE or REWRITE
**File:** `apps/server/src/index.ts`

**What it is:**
```typescript
import { createTree, tick } from '@kijo/engine';
const demo = tick(createTree(1, 'evergreen'));
console.log(`kijo server stub — engine linked ok (day ${demo.day})`);
```

**Why it is broken:** `tick()` was retired on 2026-08-07 per the comment in `engine/src/tree.ts`: "tick(), applyAction(), conditionModifier() retired 2026-08-07 (dual-engine cleanup)." It is not exported from `engine/src/index.ts`. This import will throw a runtime error on load. Additionally, `createTree` is an internal function called only by `BonsaiTree`'s constructor and may not be re-exported from the engine public index.

**Why it is also dead:** The file is a "Phase 1 stub" (per its own JSDoc). Nothing in the server calls it; there is no HTTP server, no route registration, no worker process — only a `console.log`. It is not referenced by any build script or Dockerfile. The Supabase Edge Functions (the actual server logic) live in `supabase/functions/` and are completely independent.

**Observed evidence:** `grep -n "createTree\|tick" packages/engine/src/index.ts` → no matches for `tick` or `createTree` in re-exports.

**Action: REMOVE** — delete `apps/server/src/index.ts` and `apps/server/src/`. The Edge Functions are the server. If a future standalone server is needed, start from BonsaiTree + GrowthEngine per the correct API.

---

### F16 — DISCONNECTED LOGIC | CONNECT (Phase 2)
**File:** `packages/engine/src/StatTerrain.ts`

**What it is:** `splineForSeed(seed: number)` is intended to select a bonsai style spline based on the tree's seed. `STYLE_SPLINES` array has 7 indices (0–6), but only index 0 (`Chokkan`) is populated. Indices 1–6 are `TODO` stubs. The function unconditionally returns `STYLE_SPLINES[0]` because `Math.min(idx, 0)` clamps everything to 0.

**Why it is disconnected:** The `seed` parameter is effectively ignored. All trees get the Chokkan style regardless of seed. The function signature promises seed-driven diversity that does not exist. This is not a Phase 1 intentional stub (unlike F14) — the wiring logic is written; only the data is missing.

**Action: CONNECT** — when Phase 2 styles are defined, populate `STYLE_SPLINES[1]`–`[6]` and remove the `Math.min(idx, 0)` clamp. Until then, add a comment making the stub-state explicit.

---

## Summary Table

| ID | Category | Severity | Location | Recommended Action |
|----|----------|----------|----------|--------------------|
| F1 | DEAD | Medium | `apps/web/src/components/SeedShopModal.tsx` | REMOVE entire file |
| F2 | DEAD | Medium | `packages/engine/src/rng.ts` + index re-export | REMOVE |
| F3 | DUPLICATE | Low | `shared/index.ts` + `engine/src/tree.ts` (MAX_DEPTH) | CONSOLIDATE in shared |
| F4 | DUPLICATE NAME | High | `shared/index.ts` + `engine/src/species.ts` (SpeciesParams) | CONSOLIDATE — rename engine type |
| F5 | DEAD DATA | High | `packages/engine/src/species.ts` (SPECIES record, 4 fields) | CONSOLIDATE — fold forkChance into shared, delete file |
| F6 | DUPLICATE | Low | `voxelizer/src/index.ts` + `renderer/tree_mesh.ts` (rotateDirection) | CONSOLIDATE — export from voxelizer |
| F7 | DISCREPANCY | High | `voxelizer/src/index.ts` vs `renderer/tree_mesh.ts` (polar ceiling) | CONSOLIDATE — shared constant, align to 2.618 rad |
| F8 | DEAD | Low | `engine/src/TwineWeightEngine.ts` (BRANCH_BREAK_THRESHOLD) | REMOVE |
| F9 | DUPLICATE | Low | `engine/src/WireEngine.ts` + `TwineWeightEngine.ts` (polar 150°) | CONSOLIDATE — one exported constant |
| F10 | RESOLVED | — | `renderer/scene.ts` (createScene) | — |
| F11 | RESOLVED | — | `ui/hud.ts` (CareHud) | — |
| F12 | RESOLVED | — | `renderer/tree_mesh.ts` (buildTreeMesh) | — |
| F13 | RESOLVED | — | `engine/test/determinism.test.js` | — |
| F14 | INTENTIONAL | — | `care-action/index.ts` (ALLOWED_ACTION_TYPES) | — |
| F15 | BROKEN/DEAD | Critical | `apps/server/src/index.ts` (imports retired tick()) | REMOVE |
| F16 | DISCONNECTED | Medium | `engine/src/StatTerrain.ts` (splineForSeed) | CONNECT in Phase 2 |

---

## Severity Breakdown

- **Critical (will crash):** 1 — F15
- **High (developer trap / visual correctness):** 3 — F4, F5, F7
- **Medium (dead weight):** 3 — F1, F2, F16
- **Low (cleanup):** 4 — F3, F6, F8, F9

---

## Production Path Verdict

The path that runs in production is clean:

```
BonsaiTree(seed, species)
  → GrowthEngine.growTick()          [care-action lazy tick]
  → CareLogReplay.reconstruct()      [NFT verification, ThreeCanvas DB load]
  → Voxelizer.voxelize()             [StatDeriver input]
  → StatDeriver.derive()             [stat sheet]
  → ThreeCanvas (React)
      → createScene() + buildTreeMesh() + CareHud
      → CareBridge (water/prune/wire)
      → persistCareAction() → Supabase Edge Functions
```

All links in this chain are wired and non-dead. The Supabase Edge Functions (care-action, get-tree, list-trees, seed-claim, seed-tree, wallet-auth) are all active, correctly JWT-gated, and do not import any retired symbols.

---

## Frauds Hunted

- **Weakened tests:** None found. `determinism.test.js` was genuinely migrated (not just commented out). `WireEngine.test.js` and `carelog-determinism.test.js` test live production paths.
- **False completion:** None. No "all pass" claims with unchecked exit codes in this audit scope.
- **Intent inversion:** None. Phase 1 stubs (TwineWeightEngine, JinEngine) throw `CareLogReplayError` rather than silently returning zero — they fail loudly rather than producing wrong results.
- **Phantom evidence:** None. Every finding above was verified by direct file read and/or grep before being recorded.

---

*Pass 1 audit complete. No fixes applied. No commits made.*

---

## Pass 2

**Date:** 2026-08-07 (same session)  
**Additional scope:** All test files (`test_*.mjs`, `test/`), `fixtures/`, `apps/web/` outside `src/`, root-level scripts, `packages/engine/src/` files not flagged in Pass 1 (`TechniqueClassifier.ts`, `JinEngine.ts`, `errors.ts`), `apps/server/src/` (beyond F15), `packages/shared/test_shared.mjs`, `packages/voxelizer/test_voxelizer.mjs`, `packages/contracts/test/`.

**Methodology:** Every claim verified by direct file read and grep before recording. No accepted-at-face-value assertions.

---

### F17 — BROKEN TEST | REMOVE or FIX
**File:** `packages/voxelizer/test_voxelizer.mjs` (entire file, V1–V9)

**What it is:** Nine tests for Voxelizer gating (determinism, bounds, pruning, role coverage, monotonicity, pipeline round-trip). Each stores the result of `Voxelizer.voxelize(tree)` in a local variable (`v`, `v1`, `v2`, etc.) and immediately calls `.count()`, `.serialize()`, or `.forEach()` on it.

**Why it is broken:** `Voxelizer.voxelize()` now returns `VoxelizeResult = { voxels: SparseVoxelSet, zones: Map<number,number> }`. The `.count()`, `.serialize()`, and `.forEach()` methods exist on `SparseVoxelSet` (at `result.voxels`) — NOT on the `VoxelizeResult` wrapper object. Every test will throw `TypeError: v.count is not a function` (or `.serialize is not a function`) at the first assertion. V1–V9 all crash before any assertion evaluates.

**When this broke:** When `VoxelizeResult` was introduced to carry the `zones` map (the jitter-fix, ARCHITECT-VOXEL-STATZONE-2026-07-31). The test was written against the old API where `voxelize()` returned a bare `SparseVoxelSet`. It was never updated.

**Observed evidence:**
```
grep -n "voxelize\|\.count\|\.serialize" packages/voxelizer/test_voxelizer.mjs
→ line 29: const v1 = Voxelizer.voxelize(t1);
→ line 31: assert(v1.count() === v2.count(), ...)   ← crashes here
→ line 32: const s1 = JSON.stringify(v1.serialize()); ← and here
(etc — every test uses the same broken pattern)
```

**CI status:** `test_voxelizer.mjs` is NOT in `packages/voxelizer/package.json`'s test script (which has no test entry) and is not referenced by the root `"test"` script (`npm run test -w @kijo/engine`). The breakage is invisible to automated CI. A developer running `node packages/voxelizer/test_voxelizer.mjs` would see immediate failure.

**Fix:** Destructure `const { voxels } = Voxelizer.voxelize(tree)` in every test; update the 9 call sites to use `voxels.count()`, `voxels.serialize()`, `voxels.forEach()`. V6 additionally needs the `zones` map for full fidelity.

**Action: FIX** — update all 9 tests to use the current `VoxelizeResult` API.

---

### F18 — BROKEN TEST | FIX
**File:** `packages/engine/test_terrain.mjs` — T4, T5, T6

**What it is:** Tests for `StatTerrain.calculateMatch()`. T4 and T5 test range and determinism. T6 tests cross-seed variance (deferred, range-only).

**Why it is broken:** All three sub-tests assign the full `Voxelizer.voxelize(tree)` return value to a variable named `voxels` and pass it directly to `StatTerrain.calculateMatch(voxels, seed)`:
```js
const voxels  = Voxelizer.voxelize(tree);  // returns { voxels: SparseVoxelSet, zones: Map }
const match   = StatTerrain.calculateMatch(voxels, 464497);  // expects VoxelReader
```
`StatTerrain.calculateMatch` expects a `VoxelReader` (`{ has(x,y,z): boolean }`). The `VoxelizeResult` object `{ voxels, zones }` has no `.has()` method. Inside `calculateMatch`, the first call to `voxels.has(cx, cy, cz)` throws `TypeError: voxels.has is not a function`.

**Production impact:** `calculateMatch` IS correctly called in production — `StatDeriver.derive()` calls `StatTerrain.calculateMatch(voxels, seed)` with the properly destructured `SparseVoxelSet`. The tests fail; the production path is fine.

**Test suite gap:** No test in the formal test suite (or any `.mjs` gate) successfully exercises `calculateMatch` end-to-end. The function that generates `matchPct` for NFT metadata has zero passing test coverage.

**Observed evidence:**
```
StatTerrain.calculateMatch signature (StatTerrain.ts:245):
  static calculateMatch(voxels: VoxelReader, seed: number): number
VoxelReader requires: has(x, y, z): boolean
VoxelizeResult = { voxels: SparseVoxelSet, zones: Map } → no .has() method
```

**Action: FIX** — replace `const voxels = Voxelizer.voxelize(tree)` with `const { voxels } = Voxelizer.voxelize(tree)` in T4, T5, T6.

---

### F19 — BROKEN TEST | FIX
**File:** `test_attachy.mjs` (repo root) — tests A8 and A9

**What it is:** A8 and A9 test the legacy functional API (`createTree` / `applyAction` / `tick`) to verify that the one-third attachment rule holds in the old code path.

**Why it is broken:** Line 22 of `test_attachy.mjs`:
```js
import { createTree, applyAction, tick } from './packages/engine/dist/tree.js';
```
`tree.ts` comment: "tick(), applyAction(), conditionModifier() retired 2026-08-07 (dual-engine cleanup)." Confirmed by `grep -n "^export" packages/engine/src/tree.ts` → only `MAX_DEPTH` and `createTree` are exported. `applyAction` and `tick` do not exist in the module. The import silently resolves to `undefined`. A8 and A9 call `applyAction(s, { type: 'water' })` and `tick(s)` immediately, throwing `TypeError: applyAction is not a function`.

**Production impact:** Zero. These tests target the retired API. The production path uses `BonsaiTree + GrowthEngine`, which A1–A7 and `test_attachment.mjs` cover correctly.

**CI status:** `test_attachy.mjs` is not in any npm script. Breakage is invisible to CI.

**Action: REMOVE A8 and A9** — the legacy `tick()/applyAction()` path is gone. Remove the two tests; the retired functions they test are confirmed dead.

---

### F20 — LEGACY ARTIFACT / BROKEN | REMOVE
**File:** `fixtures/_test_patched.mjs`

**What it is:** A near-copy of `fixtures/test_fixtures.mjs` (the E1–E5 fixture gate suite). The filename prefix `_test_patched` and the presence of `test_fixtures.mjs` as a parallel file identify it as a pre-fix intermediate that was never cleaned up.

**Why it is broken:**
1. Does NOT import `WATER_AMOUNT` — the correct water amount constant was not brought in.
2. Builds care log entries as `{ day: d, action: { type: 'water' } }` — **no `amount` field**. The current `BonsaiTree.water()` validates that amount must be a finite positive number; `water(undefined)` throws `CareLogReplayError`. The entire E1 setup call `exportFixture(...)` will throw before any assert runs.
3. Writes test artifacts to hardcoded paths in `fixtures/` (`'fixtures/_test_e1_e3.json'`, etc.) — would pollute the committed fixtures/ directory if run.
4. Not referenced by any npm script.

The live version, `test_fixtures.mjs`, correctly imports `WATER_AMOUNT` and includes `amount` in every care log water entry. `_test_patched.mjs` is a stale snapshot from before the water-amount validation landed.

**Observed evidence:**
```
grep "WATER_AMOUNT\|import" fixtures/_test_patched.mjs
→ No WATER_AMOUNT import
→ Imports: existsSync, readFileSync, createHash, exportFixture, CareLogReplay, StatDeriver, Voxelizer

grep "buildWaterLog\|water" fixtures/_test_patched.mjs
→ line 39: log.push({ day: d, action: { type: 'water' } });  ← no amount field
```

**Action: REMOVE** — delete `fixtures/_test_patched.mjs`.

---

### F21 — DEAD SCRIPTS | REMOVE
**Files:** `packages/engine/diag2.mjs`, `packages/engine/diag_attachment.mjs`

**What they are:** One-off diagnostic scripts written during debugging of the attachmentY-replay divergence bug (the bug where `CareLogReplay` grew trees with water(WATER_AMOUNT=28) while the original was grown with water(30), causing different branch placements).

**Why they are dead:**
- Neither has an `assert()` function or a pass/fail harness. Both always exit 0.
- Both print comparative data to stdout and nothing else. They are `console.log` sessions, not gates.
- The bug they investigated is now fixed and covered by A7 in `test_attachment.mjs` (formal gate with assertions).
- Neither is referenced in any npm script, Makefile, CI config, or package.json.
- `diag2.mjs` describes the exact scenario that A7 now tests: "what happens when original tree waters with 30 but replay uses WATER_AMOUNT (28)?"

**Action: REMOVE** — delete both files.

---

### F22 — DEAD EXPORT | CONNECT (Phase 2)
**File:** `packages/engine/src/TechniqueClassifier.ts`; `packages/engine/src/index.ts` line 15

**What it is:** `TechniqueClassifier.classify(careLog, treeAgeDays)` — a pure, stateless classifier that reads a care log and returns a `TechniqueResult` indicating primary technique (`Bound-and-Cut` vs `Clip-and-Grow`) and overlays (`Jin`, `Water-and-Land`).

**Why it is dead:** Grep across ALL of `apps/` returns zero import or call sites. No Supabase Edge Function calls it. No React component calls it. No test file exercises `TechniqueClassifier.classify()`. The class is correctly written and exported, but the output it produces — technique classification — does not reach any consumer: not the web UI, not the fighter JSON export, not the NFT metadata pipeline.

**Observed evidence:**
```
grep -rn "TechniqueClassifier" apps/ packages/engine/test*/
→ Only hits: src/index.ts (re-export), src/TechniqueClassifier.ts (definition),
  src/JinEngine.ts (doc comment only — does not call it)
→ Zero import sites in apps/ or any test file
```

**Impact:** Technique classification (Clip-and-Grow, Jin overlay, Water-and-Land overlay) is supposed to appear in NFT metadata and affect awakening (GDD §7.4). It currently produces no visible effect in any build path.

**Action: CONNECT** — wire `TechniqueClassifier.classify(tree.getCareLog(), tree.getAge())` into the fighter JSON export (`main2d.ts`, `main3d.ts`) and the `get-tree` Edge Function's response, so technique reaches the Godot client and NFT metadata.

---

### F23 — DISCONNECTED STAT CONTRACT | RESOLVE
**File:** `fixtures/exportFixture.mjs`

**What it is:** The offline fixture generator (used by `fixtures/generate.mjs` and `fixtures/test_fixtures.mjs`) that writes the stat JSON consumed by Godot.

**Why it is a problem:** `StatDeriver.derive()` returns a 10-field `StatSheet`: hp, power, endurance, ki, skillSlots, skillPoints, wisdom, matchPct, **defense**, **stability**. `exportFixture.mjs` silently omits `defense` and `stability`:
```js
stats: {
  hp, power, endurance, ki, skillSlots, skillPoints, wisdom, matchPct
  // defense: sheet.defense  ← missing
  // stability: sheet.stability  ← missing
}
```
The E5 gate enforces this 8-stat contract for Godot. Meanwhile, `main2d.ts` (line 162–163, 353–354) and `main3d.ts` (line 290–291, 486–487) both display and include `defense` and `stability` in their fighter JSON exports. Two consumers of the same `StatSheet` expose different stat subsets with no documented rationale.

**Observed evidence:**
```
grep "defense\|stability" apps/web/src/main2d.ts
→ line 162: ['Defense', sheet.defense],
→ line 353: defense: sheet.defense,

grep "defense\|stability" fixtures/exportFixture.mjs
→ (no match) — fields absent
```

**Impact:** If Godot uses the offline fixture JSON and the web client uses the live fighter export, a fighter's `defense` and `stability` stats differ depending on which path generated the data. This is a silent schema divergence between two consumers of the same engine output.

**Action: RESOLVE** — either (a) add `defense` and `stability` to `exportFixture.mjs` and update the E5 contract, or (b) explicitly document that `defense`/`stability` are web-only (Phase 2 Godot integration) and add a comment to `exportFixture.mjs` explaining the intentional omission.

---

### F24 — DUPLICATE TEST COVERAGE | CONSOLIDATE
**Files:** `test_attachy.mjs` (repo root) and `packages/engine/test_attachment.mjs`

**What it is:** Both files contain tests numbered A1–A7 covering the attachmentY invariants for the same calibration tree (seed 464497, hardwood, day 200). The assertions are functionally equivalent — trunk attachmentY=0, one-third rule, secondary > primary, depth-2+ > 0, diversity across parents, voxelizer consistency, CareLogReplay fidelity.

**Overlap detail:**
- `test_attachment.mjs` A1–A7: thorough, correct, uses `{ voxels }` destructuring from `Voxelizer.voxelize()`.
- `test_attachy.mjs` A1–A7: slightly different assertion text but the same invariants.
- `test_attachy.mjs` additionally has A8–A10 (A8/A9 now broken per F19; A10 is a valuable zone-path integration test not present in `test_attachment.mjs`).
- Neither file is in any npm test script.

**Problem:** Two versions of A1–A7 means a regression requires fixes in two places, and the test with broken A8/A9 (F19) makes the root-level file a liability. A10 contains the only formal test for the zone-path integration — a valuable gate that is currently orphaned.

**Action: CONSOLIDATE** — after fixing A8/A9 (or removing them per F19), merge A10's zone-path integration test into `test_attachment.mjs`. Delete the now-redundant A1–A7 in `test_attachy.mjs` (or the entire file).

---

### F25 — TEST COMMENT LIES | LOW
**File:** `packages/engine/test_wire.mjs` — W4 header

**What it is:** W4 comment says "polar stays in [0.1, 1.4]" but the assertion is:
```js
assert(Math.abs(after1) <= 90 + 0.001, 'polar-equivalent angle within bounds');
```

**Why it is wrong:** The `angle` field on a `Branch` is the **azimuthal** rotation in degrees (how far the branch is rotated around its parent's axis). The `WireEngine` applies an angle delta to this field. The assertion `Math.abs(after1) <= 90` checks azimuthal angle (degrees) — reasonable, but not what the comment claims. The comment's "[0.1, 1.4]" is the **polar** range from `tree_mesh.ts` (the same ceiling that F7 flags as incorrect). W4 does not test polar angle at all; polar clamping happens inside `WireEngine.wire()` and is not inspected by this assertion.

**Impact:** W4 gives false confidence that the WireEngine polar-clamp guard (POLAR_MAX_DEG=150, ~2.618 rad) is tested. It is not tested by any gate. This is a comment error that echoes the F7 discrepancy.

**Action: CORRECT** — update the W4 comment to accurately describe what it tests ("azimuthal angle stays within ±90°") and add a separate sub-assertion that directly reads the polar angle if the polar clamp matters for the test.

---

## Pass 2 Summary Table

| ID | Category | Severity | Location | Recommended Action |
|----|----------|----------|----------|--------------------|
| F17 | BROKEN TEST | High | `packages/voxelizer/test_voxelizer.mjs` (V1–V9) | FIX — destructure `{ voxels }` from voxelize() result |
| F18 | BROKEN TEST | High | `packages/engine/test_terrain.mjs` (T4/T5/T6) | FIX — destructure `{ voxels }` before passing to calculateMatch |
| F19 | BROKEN TEST | Medium | `test_attachy.mjs` (A8, A9) | REMOVE A8/A9 — retired API called |
| F20 | LEGACY ARTIFACT | High | `fixtures/_test_patched.mjs` | REMOVE entire file |
| F21 | DEAD SCRIPTS | Low | `packages/engine/diag2.mjs`, `diag_attachment.mjs` | REMOVE both files |
| F22 | DEAD EXPORT | Medium | `packages/engine/src/TechniqueClassifier.ts` | CONNECT — wire into fighter JSON + get-tree response |
| F23 | DISCONNECTED STAT | Medium | `fixtures/exportFixture.mjs` (defense/stability) | RESOLVE — add to Godot fixture or document omission |
| F24 | DUPLICATE COVERAGE | Low | `test_attachy.mjs` A1–A7 vs `test_attachment.mjs` A1–A7 | CONSOLIDATE — merge A10 into test_attachment.mjs, delete root file |
| F25 | WRONG COMMENT | Low | `test_wire.mjs` W4 header | CORRECT — azimuthal, not polar; add explicit polar-clamp assertion |

---

## Pass 2 Severity Breakdown (new findings only)

- **High (test infrastructure crashes / broken gates):** 3 — F17, F18, F20
- **Medium (dead export / stat divergence / broken legacy tests):** 3 — F19, F22, F23
- **Low (cleanup / comments):** 3 — F21, F24, F25

---

## Frauds Hunted (Pass 2)

- **Weakened tests:** Found in historical evidence only — `test_wire.mjs` W6 documents that the previous `thickB > mid` strict assertion was loosened. The current W6 asserts the actual two-tier contract and explains why; the self-documentation is honest, not fraudulent.
- **False completion:** F17 is the closest — V1–V9 in `test_voxelizer.mjs` appear to be a complete gate suite but all crash before evaluating any assertion. The CI doesn't run this file, so the failure is invisible.
- **Intent inversion:** F23 (defense/stability) is a near-miss — the stat values are computed and reach the web app but not the Godot fixture, silently creating two different fighter profiles depending on which export path was used.
- **Phantom evidence:** F20 — `_test_patched.mjs` presents itself as a complete E1–E5 gate suite but will throw `CareLogReplayError` on every run due to the missing `amount` field. Any "pass" claimed from this file is phantom.

---

## Updated Aggregate Verdict

**CAVEATS** (unchanged from Pass 1)

The production runtime path remains clean. Pass 2 reveals that **the manual test infrastructure has significant rot**: the Voxelizer's entire manual gate suite (V1–V9) crashes on the current API, the terrain gate misconnects `calculateMatch`'s type, and a broken pre-fix test file was left in `fixtures/`. Additionally, `TechniqueClassifier` — the technique-classification engine — has no consumer anywhere in the build, meaning the GDD §7.4 technique feature is silently absent from all output.

Combined findings across both passes:

- **Critical (will crash in production):** 1 — F15
- **High (test infrastructure crashes / developer traps / visual correctness):** 6 — F4, F5, F7, F17, F18, F20
- **Medium:** 6 — F1, F2, F16, F19, F22, F23
- **Low:** 7 — F3, F6, F8, F9, F21, F24, F25

---

*Pass 2 audit complete. No fixes applied. No commits made.*
