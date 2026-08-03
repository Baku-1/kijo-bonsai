# Kijo-Bonsai Connectivity Audit — 2026-08-02

**Stage:** AUDITOR  
**Scope:** Engine outputs and backend wiring — is each piece actually called, or just built?  
**Method:** Read actual call sites. Did not trust file names, comments, or prior reports.

---

## Summary Table

| Component | Status | Where called | What's missing |
|---|---|---|---|
| **StatDeriver** | WIRED (debug only) | `main2d.ts:150,338` · `main3d.ts:278,471` | Not in React app (ThreeCanvas). Not auto-sent to Godot. |
| **TechniqueClassifier** | IDLE | Nowhere in `apps/` | No frontend caller, not in export payload, not in metadata |
| **Godot export payload** | PARTIAL | `main2d.ts:336` · `main3d.ts:469` | Manual copy-paste only; no automated pipeline to Godot |
| **PruneEngine** (`tree.prune`) | WIRED | `main2d.ts:315` · `main3d.ts:335` · `persistence.ts:300` · `CareLogReplay:119` | None — fully wired and persisted |
| **WireEngine** (`wire`, `removeWire`) | PARTIAL | `CareLogReplay:121,126` (replay only) | No UI button in any frontend. Cannot be originated by user. |
| **TwineWeightEngine** (twine/weight) | IDLE | `CareLogReplay:130–144` (stubs, throws) | Phase 1 stubs that throw. No UI. Not in care-action whitelist. |
| **JinEngine** (`applyJin`) | IDLE | `CareLogReplay:148` (stub, throws) | Phase 1 stub that throws. No UI. Not in care-action whitelist. |
| **addLandscape** | IDLE | `CareLogReplay:151` (replay only) | No UI. Not in care-action whitelist. |
| **CareLogReplay** | WIRED | `main2d.ts:234` · `main3d.ts:381` (both on mount) | None — called on mount in both views |
| **Voxelizer** | WIRED (debug only) | `main2d.ts:148,337` · `main3d.ts:277,470` | Not in React app (ThreeCanvas). React app uses parametric mesh. |
| **Edge fn: get-tree** | WIRED | `persistence.ts:164` | None |
| **Edge fn: care-action** | PARTIAL | `persistence.ts:228` | `rotate` missing from whitelist — silently rejected server-side |
| **Edge fn: wallet-auth** | WIRED | `wallet/useWalletAuth.ts:26` | None |
| **Edge fn: seed-claim** | WIRED | `wallet/useSeedPurchase.ts:34` | None |
| **Edge fn: seed-tree** | ORPHANED | Nowhere in `apps/web/src/` | No frontend caller — new trees have no creation path |
| **Edge fn: nft-metadata** | PLANNED | Docs reference only | File does not exist in codebase |
| **Edge fn: nft-image** | PLANNED | Docs reference only | File does not exist in codebase |
| **StatTerrain** | WIRED (internal) | `StatDeriver:134,150` · `Voxelizer:133` | Not displayed standalone — consumed inside StatDeriver pipeline |
| **GrowthEngine.growTick** | WIRED | `main2d.ts:327` · `main3d.ts:465` · `care_bridge.ts:36` · `CareLogReplay:162` | None — fully wired |

---

## Detailed Findings

### 1. StatDeriver — WIRED (debug views only)

**What I read:**
- `main2d.ts:148–167` — `refreshStats()` calls `Voxelizer.voxelize(tree)` then `StatDeriver.derive(...)`, writes 10-row stat table to DOM.
- `main2d.ts:337–358` — `btn-export` handler re-derives the sheet, puts JSON in a `<textarea>`.
- `main3d.ts:277–295` — `refreshAll()` does the same. Stats displayed in stat table.
- `main3d.ts:471` — `btn-export` handler derives and exports.
- `ThreeCanvas.tsx` — no import of Voxelizer or StatDeriver. The live React app renders no stats.

**Verdict:** StatDeriver is fully functional and displayed in the 2D and 3D debug views. The main user-facing app (React / ThreeCanvas.tsx) shows none of it. Stats are invisible to players.

---

### 2. TechniqueClassifier — IDLE

**What I read:**
- `packages/engine/src/index.ts:15` — exported.
- `packages/shared/src/index.ts:214` — documented in type comment.
- `packages/engine/src/JinEngine.ts:10` — mentioned by name in a comment.
- Grepped `apps/**/*.ts` and `apps/**/*.tsx` for `TechniqueClassifier` — **zero matches**.

**Verdict:** Built, tested (presumably), exported — but nothing in the frontend or backend pipeline ever calls it. Its `TechniqueResult` is not in the Godot export payload, not in any API response, not in any UI.

---

### 3. Godot Export Payload — PARTIAL

**What I read:**
- `main2d.ts:336–358` — `btn-export` click: voxelizes, derives, builds a JSON object with `seed`, `species`, `ageDays`, `generatedAt`, `stats` (10 fields). Writes to `<textarea id="export-out">`.
- `main2d.ts:360–362` — `btn-copy` copies textarea to clipboard.
- Same pattern in `main3d.ts:469–494`.

**Verdict:** The payload shape is correct (matches `KijoStats.from_json` per comment). But delivery is 100% manual: a developer clicks Export, clicks Copy, then pastes into Godot. There is no HTTP endpoint, no automated webhook, no file write. The Godot game is never automatically fed stats.

---

### 4. PruneEngine — WIRED

**What I read:**
- `main2d.ts:305–319` — toggle prune mode via button, canvas click calls `pickBranch`, then `tree.prune(id)`, then `persistAsync({ type: 'prune', branchId: id })`.
- `main3d.ts:314–339` — raycasts into voxel InstancedMesh, maps instanceId → branchId via `latestVoxels.voxels.get(...)`, calls `tree.prune(prunedId)`, persists.
- `persistence.ts:299–300` — `applyCurrentDayEntries` dispatches `a.type === 'prune'` to `tree.prune(a.branchId)`.
- `CareLogReplay.ts:118–119` — dispatches `prune` log entry to `PruneEngine.prune(tree, a.branchId)`.
- `care-action/index.ts:154` — `prune` is in the ALLOWED_ACTION_TYPES set. Decrements `shears` consumable.

**Verdict:** Fully wired end-to-end. UI → engine → persist → replay.

---

### 5. Branch Physics Methods — PARTIAL / IDLE

**wire / removeWire (WireEngine):**
- Implementation in `WireEngine.ts` is **complete** (not a stub). Spring-back, set-days model, SCAR tracking all implemented.
- `CareLogReplay.ts:120–126` dispatches `wire` and `wire-remove` correctly via `WireEngine.wire(tree, ...)` and `tree.removeWire(...)`.
- `care-action/index.ts:154` — `wire` IS in the whitelist. Decrements `wire` consumable.
- BUT: grepped `apps/**/*.ts` and `apps/**/*.tsx` for `wire(`, `removeWire` — **zero matches** in any frontend file. No UI button exists in `main2d.ts`, `main3d.ts`, or `ThreeCanvas.tsx`.

**Status: PARTIAL** — can be replayed from existing DB logs, but no user can originate a wire action from any UI. Wire consumables can be purchased in StoreModal (`live: false`) but the action cannot be performed.

**applyTwine, removeTwine, applyWeight, removeWeight (TwineWeightEngine):**
- All Phase 1 stubs that `throw new CareLogReplayError('...Phase 1 stub...')`.
- In `CareLogReplay`, these branches exist (`a.type === 'twine'`, etc.) but hitting them mid-replay will throw and fail the reconstruct.
- `care-action` whitelist does NOT include twine, weight — server rejects them even if UI existed.
- No UI.

**Status: IDLE**

**applyJin (JinEngine):**
- Phase 1 stub, throws `CareLogReplayError`.
- Not in care-action whitelist.
- No UI.

**Status: IDLE**

**addLandscape (BonsaiTree):**
- Implemented (logs care entry + markDirty). Not a stub.
- `CareLogReplay.ts:151` dispatches it for replay.
- Not in care-action whitelist (server would reject it).
- No UI.

**Status: IDLE**

---

### 6. CareLogReplay — WIRED

**What I read:**
- `main2d.ts:216–268` — `async function init()` calls `loadCareLog(kijoSession.tree_id)`, then calls `CareLogReplay.reconstruct(seed, species, priorLog, treeData.current_day)` when `current_day > 0`. Called via `void init()` at line 365.
- `main3d.ts:367–414` — identical pattern. `init()` called at line 534 (`void init()`).

**Verdict:** Called on mount in both views. The guard (`current_day === 0` path bypasses reconstruct correctly, applying day-0 entries directly).

---

### 7. Voxelizer — WIRED (debug only)

**What I read:**
- `main2d.ts:148` — `Voxelizer.voxelize(tree)` in `refreshStats()`.
- `main3d.ts:277` — `Voxelizer.voxelize(tree)` in `refreshAll()`. Result passed to `rebuildVoxels(latestVoxels.voxels)` which populates `THREE.InstancedMesh` per material. The 3D canvas **does** render voxels (one box per voxel, PBR materials, canopy stream).
- `ThreeCanvas.tsx` — imports `buildTreeMesh` from `renderer/tree_mesh.ts`. `tree_mesh.ts` uses parametric `THREE.CylinderGeometry` (tapered tubes), not voxels. Voxelizer is never imported.

**Verdict:** The debug 3D view (main3d.ts / index3d.html) renders actual voxels. The live React app renders a parametric mesh. Players never see the voxel representation unless they navigate to `/index3d.html`.

---

### 8. Supabase Edge Functions

Functions live in `apps/server/supabase/functions/` (NOT the empty root `supabase/functions/`).

**get-tree** — WIRED  
Called at `persistence.ts:164`: `fetch(\`${GET_TREE_URL}?tree_id=...\`)`. Returns raw tree + care log.

**care-action** — PARTIAL  
Called at `persistence.ts:228`. Handles: water, prune, wire, fertilize.  
**BUG:** `ALLOWED_ACTION_TYPES = new Set(['water', 'prune', 'wire', 'fertilize'])` — `rotate` is absent. Both `main2d.ts:301` and `main3d.ts:442` call `persistAsync({ type: 'rotate' })`. The server returns `{ error: 'Invalid action type' }` with HTTP 400. The client never sees the error because `persistAsync` is fire-and-forget (`.catch()` only logs to console). Every rotate action is silently dropped from the care log. Trees that were rotated cannot be faithfully replayed.

**wallet-auth** — WIRED  
Called at `apps/web/src/wallet/useWalletAuth.ts:26`. Signs wallet, exchanges for Supabase JWT.

**seed-claim** — WIRED  
Called at `apps/web/src/wallet/useSeedPurchase.ts:34`. Verifies RON payment on-chain, mints NFT.

**seed-tree** — ORPHANED  
Exists at `apps/server/supabase/functions/seed-tree/index.ts`. Grepped `apps/web/src/**/*.{ts,tsx}` — zero matches. No frontend ever calls it. It creates a `trees` DB row for a newly minted seed. Without this call, a player who buys a seed via `seed-claim` (which mints the NFT) gets no corresponding DB tree row — they cannot water, prune, or view their tree in the care loop.

**nft-metadata** — PLANNED, ABSENT  
Referenced in `docs/NFT-METADATA-IMAGE-ARCH.md`. File does not exist in the repo.

**nft-image** — PLANNED, ABSENT  
Same.

---

### 9. StatTerrain — WIRED (internal)

**What I read:**
- `StatDeriver.ts:134,150` — `deriveTerrain()` calls `StatTerrain.STAT_TYPES[zones.get(branchId)]`, `StatTerrain.distanceToIdealPath(...)`, `StatTerrain.proximityCurve(...)`.
- `StatDeriver.ts:213` — `derive()` calls `StatTerrain.calculateMatch(voxels, seed)` for `matchPct`.
- `Voxelizer/src/index.ts:133` — `StatTerrain.getZoneIndex(seed, pos.start.x, ...)` per branch, stored in `zones` map.

**Verdict:** StatTerrain is a pure-computation dependency, not an entry point. Its outputs flow into StatDeriver which flows into the debug stat tables. Not displayed or accessible independently.

---

### 10. GrowthEngine.growTick — WIRED

**What I read:**
- `main2d.ts:327` — `btn-day` listener: `for (let i=0; i<n; i++) GrowthEngine.growTick(tree)`.
- `main3d.ts:465` — same.
- `bridge/care_bridge.ts:36` — `CareBridge.nextDay()` calls `GrowthEngine.growTick(this.tree)`. CareBridge is constructed in `ThreeCanvas.tsx:51` with `onNextDay: () => bridge.nextDay()`, which is wired to the `btn-next-day` button via `CareHud`.
- `CareLogReplay.ts:162` — `GrowthEngine.growTick(tree)` at end of each day loop.
- Server-side lazy tick in `care-action`: inserts `action_type: 'tick'` rows — the client-side replay interprets these as "call growTick once."

**Verdict:** Fully wired on all paths — debug buttons, React app button, and replay.

---

## Prioritized Gap List

### P0 — Data loss / correctness bugs (fix before any production use)

**GAP-A: `rotate` missing from care-action whitelist**  
File: `apps/server/supabase/functions/care-action/index.ts:154`  
Fix: Add `'rotate'` to `ALLOWED_ACTION_TYPES`. Also add `rotate` to `CONSUMABLE` map (currently absent — should be free, like water). Every rotate the user has ever clicked has been silently lost from the server care log. Replay is wrong for any tree that was rotated.

**GAP-B: `seed-tree` edge function never called after mint**  
File: No call site exists in `apps/web/src/`.  
Fix: After `seed-claim` succeeds (the NFT is minted), the frontend must POST to `seed-tree` to create the DB tree row (seed, species, has_spirit, wallet_row_id). Without this, no care loop is possible for newly purchased seeds.

---

### P1 — Player-visible gaps (blocks playable features)

**GAP-C: Wire has no UI entry point**  
WireEngine is complete. care-action accepts wire. But no button exists anywhere. Players cannot wire branches — the core "Bound-and-Cut" technique is physically unavailable.

**GAP-D: TechniqueClassifier is never called**  
No frontend, no export, no API uses it. The technique classification (Clip-and-Grow vs Bound-and-Cut, Jin overlay, Water-and-Land overlay) does not appear anywhere a player or the Godot game can see it.

**GAP-E: Stat pipeline (Voxelizer + StatDeriver) not in the live React app**  
Players using the main app see no stats. Stats are only in the debug pages (`/index2d.html`, `/index3d.html`). The HUD shows moisture/health/day/season but no HP/Power/Ki/etc.

---

### P2 — Infrastructure / future-readiness

**GAP-F: Godot export is manual copy-paste**  
The export payload is correct and complete. The delivery mechanism (textarea + clipboard) is a dev tool, not a production flow. A webhook endpoint or file-write pipeline is needed before Godot integration is automated.

**GAP-G: twine, weight, jin, landscape cannot be persisted**  
care-action whitelist blocks them. TwineWeightEngine and JinEngine are Phase 1 stubs. Before Phase 2 implementation, the whitelist also needs expanding. Currently, even if a Phase 2 stub were removed, the server would reject the action.

**GAP-H: nft-metadata and nft-image edge functions do not exist**  
Documented in `docs/NFT-METADATA-IMAGE-ARCH.md`. The NFT tokenURI points to `api.kijo.xyz/nft/metadata/:tokenId`, which currently returns nothing. Any minted token has a broken metadata URI.

---

## Surprises

**1. The live React app and the debug pages are effectively separate products.**  
`ThreeCanvas.tsx` (the live app) uses a parametric mesh renderer with no stats. `main2d.ts` / `main3d.ts` are standalone HTML pages with full stats but no wallet integration. The voxelizer, StatDeriver, and TechniqueClassifier are invisible to players using the main app.

**2. WireEngine is fully implemented but completely unreachable.**  
WireEngine has spring-back physics, set-days model, SCAR tracking — more complete than most of the engine. But there is no button for it in any of the three frontends. It can only be exercised via CareLogReplay, which requires a `wire` row already in the DB — which cannot be created because there is no UI.

**3. The `rotate` bug is silent and has been silently losing data.**  
`persistAsync` is fire-and-forget with only a console.error on failure. The `rotate` action has never successfully persisted. Every rotated tree in the DB is missing those care log entries. Replay diverges from live state for any rotated tree.

**4. seed-tree is a ghost function.**  
It's deployed (or deployable), handles JWTs correctly, creates DB rows — but no client ever calls it. The NFT mint and the tree creation are decoupled with nothing bridging them. A player who successfully buys a seed mints an NFT that points to a tokenURI that doesn't resolve, for a tree that doesn't exist in the DB.

**5. SeedShopModal.tsx is marked DEPRECATED but still present.**  
`apps/web/src/components/SeedShopModal.tsx` starts with `// DEPRECATED — replaced by StoreModal.tsx`. It's not imported in `App.tsx` (which uses `StoreModal`), so it's inert. Low priority, but worth deleting to avoid confusion.

---

*Audit performed by: AUDITOR stage, kijo pipeline*  
*All findings based on direct file reads. No claims accepted without observed call sites.*
