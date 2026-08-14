# ARCH: main3d.ts Authenticated Session Load

**Date:** 2026-08-08
**Pipeline stage:** Architect
**Status:** VERIFIED -- implementation exists and is correct; spec documents it for auditor and
STATE.md update
**Author:** Verified-Architect skill (Cowork session 2026-08-08)

---

## SCOPE

```
DESIGN TASK:  Verify and document the session-aware init pattern in main3d.ts that loads
              the authenticated player's tree from Supabase instead of the hardcoded
              placeholder seed.

DELIVERABLE:  Architect spec (this file). Confirms existing implementation is correct,
              identifies residual gaps, provides implementer and auditor with a
              done-when check.

BUILDS ON:    ARCH-TREE-PICKER-2026-08-07.md (session-load pattern ported to ThreeCanvas);
              persistence.ts (getSession, loadCareLog); CareLogReplay (D5/V6 gate-verified);
              DESIGN-CARETAKER-OPACITY.md (stat display policy by view surface).

CONSUMED BY:  Implementer (VERIFICATION ONLY -- see Finding 1 below); Auditor (done-when
              check); STATE.md update.
```

---

## CODEBASE RECONNAISSANCE

### Files read

| File | Lines read |
|------|-----------|
| `SESSION-START.md` | full |
| `STATE.md` | full |
| `DECISIONS.md` | full |
| `docs/DESIGN-CARETAKER-OPACITY.md` | full |
| `apps/web/src/main3d.ts` | full (1-534) |
| `apps/web/src/components/ThreeCanvas.tsx` | 1-220 |
| `apps/web/src/persistence.ts` | full (1-310) |
| `packages/engine/src/StatDeriver.ts` | full (1-243) |
| `packages/shared/src/index.ts` | full (1-407) |

### Symbols verified

| Symbol | File | Exported | Exact signature |
|--------|------|----------|-----------------|
| `getSession` | persistence.ts:57 | yes | `(): KijoSession \| null` |
| `loadCareLog` | persistence.ts:157 | yes | `(treeId: string): Promise<{ treeData: GetTreeResponse; careLog: CareLogEntry[] }>` |
| `KijoSession` | persistence.ts:38 | yes | `{ tree_id: string; access_token: string; wallet_row_id: string }` |
| `GetTreeResponse` | persistence.ts:86 | yes | `{ tree_id, seed, species, current_day, has_spirit, born_at, care_log }` |
| `applyCurrentDayEntries` | persistence.ts:288 | yes | `(tree: BonsaiTree, entries: CareLogEntry[]): void` |
| `validateCareAction` | persistence.ts:130 | **no** (module-private) | `(obj: unknown): obj is CareAction` |
| `CARE_ACTION_TYPES` | persistence.ts:113 | **no** (module-private) | `const` satisfies `ReadonlyArray<CareAction['type']>` |
| `CareLogEntry` | @kijo/shared | yes | `{ day: number; action: CareAction }` |
| `CareLogReplay.reconstruct` | @kijo/engine | yes | `(seed, species, log, totalDays) -> BonsaiTree` |
| `StatDeriver.derive` | @kijo/engine | yes | `(tree, voxels, seed, ageDays, zones) -> StatSheet` |
| `Voxelizer.voxelize` | @kijo/voxelizer | yes | `(tree: BonsaiTree) -> VoxelizeResult` |
| `VoxelizeResult.zones` | @kijo/voxelizer | yes | `Map<number, number>` (branchId -> zoneIndex) |
| `BonsaiTree` | @kijo/engine | yes | class |
| `StatSheet` | @kijo/shared:279 | yes | `{ hp, power, endurance, ki, skillSlots, skillPoints, wisdom, matchPct, defense, stability }` |
| `WATER_AMOUNT` | @kijo/shared:353 | yes | `28` |
| `SESSION_KEY` | persistence.ts:36 | yes | `'kijo_session'` |

### Call sites found

`getSession()` -- 2 call sites in apps/:
- `apps/web/src/main3d.ts:370` -- `kijoSession = getSession()` inside `async function init()`
- `apps/web/src/components/ThreeCanvas.tsx:141` -- `session = getSession()` inside void IIFE

`loadCareLog(tree_id)` -- 2 call sites in apps/:
- `apps/web/src/main3d.ts:373` -- `await loadCareLog(kijoSession.tree_id)` inside init() try block
- `apps/web/src/components/ThreeCanvas.tsx:145` -- `await loadCareLog(session.tree_id)` inside IIFE try block

`CareLogReplay.reconstruct()` -- 2 call sites:
- `apps/web/src/main3d.ts:381-386` -- inside init() try block, `treeData.current_day > 0` branch
- `apps/web/src/components/ThreeCanvas.tsx:167-172` -- inside IIFE try block

`StatDeriver.derive()` -- 2 call sites in main3d.ts:
- `apps/web/src/main3d.ts:278` -- inside `refreshAll()` (once per user action or init swap)
- `apps/web/src/main3d.ts:471` -- inside btn-export click handler

`Voxelizer.voxelize()` -- 2 call sites in main3d.ts:
- `apps/web/src/main3d.ts:277` -- inside `refreshAll()`
- `apps/web/src/main3d.ts:470` -- inside btn-export click handler

`applyCurrentDayEntries()` -- 2 call sites:
- `apps/web/src/main3d.ts:377` -- day-0 branch of init() (no prior ticks)
- `apps/web/src/main3d.ts:391-394` -- after CareLogReplay.reconstruct() for current-day tail entries

### CRITICAL GAP FOUND: task prompt assumes un-implemented work; reality contradicts

The task preflight states: "main3d.ts was built 2026-07-19 and boots from `?seed=464497&species=hardwood`
-- no session awareness."

**Reality (read directly from the file):** `apps/web/src/main3d.ts` contains a complete
`async function init()` at lines 367-414 and all required persistence imports at lines 11-15.
The implementation is present and mirrors the ThreeCanvas.tsx pattern from 2026-08-07.

Evidence:
- Line 11-15: imports `getSession, loadCareLog, persistCareAction, applyCurrentDayEntries, type KijoSession` from `./persistence.js` -- identical to ThreeCanvas.tsx:25-30
- Line 370: `kijoSession = getSession()`
- Line 371: guard `if (kijoSession?.tree_id)`
- Line 373: `const { treeData, careLog } = await loadCareLog(kijoSession.tree_id)`
- Lines 374-394: day-0 vs. replay branching with `CareLogReplay.reconstruct()` and `applyCurrentDayEntries()`
- Lines 395-396: DOM input sync from server-authoritative seed/species
- Line 413: `refreshAll()` (calls Voxelizer.voxelize -> StatDeriver.derive -> populates stat HUD)
- Lines 530-534: `refreshAll(); animate(); void init()` -- async-after-rAF boot sequence

**Root cause of the stale preflight:** STATE.md description of main3d.ts reads "3D voxel viewer:
OrbitControls, InstancedMesh voxels, canopy stream, prune raycasting, stat HUD, ghost ideal-path
hint, export/copy" with no mention of session-load. STATE.md was last updated 2026-08-07 -- the
same session that added ThreeCanvas.tsx session-load. It is likely that main3d.ts received the
session-load treatment in that same session but STATE.md was not updated to reflect it. The
preflight was written against stale STATE.md information.

**Consequence for this pipeline stage:** The implementer role below is VERIFICATION ONLY.
No TypeScript changes are required.

---

## VERIFICATION LOG

### Verified claims

```
VERIFIED:

  v CareLogReplay.reconstruct is the production path
    Source: STATE.md D5 gate ("end-to-end: CareLogReplay tree -> voxelize -> derive = byte-identical")
            and V6 gate ("pipeline determinism: CareLogReplay rebuild -> voxelize -> byte-identical").
            Both gate tests confirmed passing in STATE.md.

  v getSession() reads sessionStorage (written by useWalletAuth React hook)
    Source: persistence.ts:57-80 -- reads sessionStorage.getItem(SESSION_KEY) where
            SESSION_KEY = 'kijo_session'. DECISIONS.md 2026-07-26 "useWalletAuth hook --
            access_token stored in memory only" refers to the JWT in the React ref; the
            KijoSession object (including tree_id) IS written to sessionStorage by
            useSeedPurchase.ts dispatch-order fix (2026-08-07).

  v loadCareLog has a 10-second network timeout
    Source: persistence.ts:161-163 -- AbortController with setTimeout(10_000).

  v validateCareAction() guards all DB rows before they reach CareLogReplay
    Source: persistence.ts:130-137 + :191-195 -- every row is passed through
            validateCareAction() and skipped (with console.warn) if it fails.
            CARE_ACTION_TYPES uses `satisfies ReadonlyArray<CareAction['type']>` for
            compile-time exhaustiveness check (persistence.ts:113-117).

  v treeData.species as SpeciesClass safe cast is the established pattern
    Source: main3d.ts:381 and :390 match ThreeCanvas.tsx:158 and :168 exactly.

  v StatDeriver called once per refreshAll(), NOT per rAF tick
    Source: main3d.ts animate() at lines 509-526 -- only calls controls.update() and
            renderer.render(). refreshAll() at lines 276-305 is NOT called from animate().
            Satisfies DECISIONS.md dirty-flag constraint.

  v No Math.random() or Date.now() in the init/refresh path
    Source: init() calls only getSession(), loadCareLog(), CareLogReplay.reconstruct(),
            BonsaiTree constructor, and refreshAll(). None invoke non-deterministic sources.
            Confirmed: DECISIONS.md "No wall-clock time" entry; SESSION-START.md "Never call
            Math.random(), Date.now()... in engine or voxelizer."

  v Import boundary satisfied
    Source: DECISIONS.md "import boundary: apps/web can import from engine and voxelizer
            freely." main3d.ts imports from @kijo/engine and @kijo/voxelizer -- compliant.

  v async-after-rAF boot sequence is present
    Source: main3d.ts:530-534 --
      refreshAll();  // render placeholder immediately
      animate();     // start rAF loop
      void init();   // swap in real tree asynchronously
    The `void` cast discards the returned Promise; errors are caught inside init() try/catch.

  v StatDeriver.derive() NaN sentinel in place
    Source: StatDeriver.ts:232-239 -- throws if any stat field is not finite. If a corrupted
            care log produces NaN inputs, the throw propagates out of refreshAll() inside init()'s
            try block, which catches it and falls back to the placeholder tree.
```

### Unverified (future gaps, not blocking)

```
UNVERIFIED:

  ? DESIGN-CARETAKER-OPACITY.md calls for "morale" in main3d.ts stat HUD.
    StatSheet (shared/src/index.ts:279) has no morale field. morale is not in the
    engine. Gap is a future feature addition -- not part of the session-load task.

  ? DESIGN-CARETAKER-OPACITY.md calls for "style hints" in main3d.ts stat HUD.
    TechniqueClassifier.classify() is listed as "Not Yet Built" in STATE.md. Gap is a
    future feature addition -- not part of the session-load task.
```

---

## CODE SOURCE AUDIT: async-after-rAF pattern

The Three.js community recognizes two patterns for combining async data loading with
the requestAnimationFrame loop. The Kijo implementation uses Pattern B.

**Pattern A -- fetch-first (async-before-rAF):**
Start the rAF loop only after all async data resolves.

```js
fetch(api_url)
  .then(data => { init(data); animate(); })
  .catch(err => console.error(err));
```

- Advantage: scene is always meaningful on first rendered frame (no placeholder needed).
- Disadvantage: renderer is dormant during the network round-trip (50-500ms); the canvas
  appears blank until the server responds.
- Community citation: discourse.threejs.org/t/async-json-and-init/26389 post #5
  (@alessandro_guarino): "wait the first response from the server in order to execute
  the function where your json data is used." This post explicitly recommends fetch-first
  when a blank placeholder would be confusing.

**Pattern B -- rAF-first (async-after-rAF):**
Start the rAF loop immediately with a placeholder; swap in real data when async resolves.

```js
function initThree() {
  basicSceneSetup();
  getDataAsync();   // fires without blocking; updates scene on resolve
  animate();        // starts immediately with placeholder geometry
}
initThree();
```

- Advantage: scene is never blank; user sees geometry immediately.
- Disadvantage: there is a brief window (~50-200ms) during which user actions are applied
  locally but not persisted (acceptable in fire-and-forget architectures).
- Community citation: discourse.threejs.org/t/async-json-and-init/26389 post #4 (@World_Data
  final working form): `initThree()` contains both `getDataAsync()` (no await) and
  `animate()`, both called in sequence before the first async response arrives. This is
  the direct real-world analog of Kijo's `refreshAll(); animate(); void init();`.

**Verdict for Kijo:** Pattern B is correct here because:
1. The placeholder tree (from `newTree()`) renders correctly -- it is a valid BonsaiTree
   with voxels, not a black screen.
2. Supabase cold-start latency can be 200-800ms; users should not see a blank canvas.
3. The brief non-persist window is explicitly documented in main3d.ts line 363: "Note: actions
   fired before this load completes... are applied locally but not persisted."

```
CODE SOURCE AUDIT
  snippet:     async-after-rAF two-phase init pattern (refresh placeholder -> animate -> void init)
  origin:      discourse.threejs.org/t/async-json-and-init/26389 (community Q&A thread, 2021)
  license:     not applicable -- community design pattern, no code copied
  version:     works in all modern JS environments; does not depend on any Three.js version
  current:     yes -- ES2017 async/await is current; the structural pattern is valid
  assumptions: placeholder scene must be renderable before async resolves; scene swap is handled
               by mutating the outer `tree` variable (both init() and refreshAll() close over it)
  limitations: care actions fired between animate() and init() resolve are local-only
  adaptation:  Kijo uses `void init()` (Promise discarded; errors caught inside) rather than
               `getDataAsync()` (which does not return a Promise in the forum example) -- identical
               semantics; the void cast makes the non-awaited Promise explicit
  verdict:     PATTERN CONFIRMED -- Kijo's `refreshAll(); animate(); void init()` is consistent
               with community-validated Three.js real-world practice
```

---

## THE DESIGN

### 1. Where the async init block goes: AFTER animate()

The async init block is placed after `animate()` at line 534. This is the correct
placement (async-after-rAF, Pattern B). The sequence is:

```
line 530  hintEl.textContent = '...';      // set initial hint text
line 532  refreshAll();                     // render placeholder tree (never blank)
line 533  animate();                        // start rAF loop
line 534  void init();                      // fire async load; void = explicit non-await
```

This placement is locked by the placeholder-first design intent (main3d.ts lines 529-531
comment). **Do not move init() above animate().** If init() ran before animate(), the viewer
would show a blank canvas for ~50-800ms while awaiting Supabase.

### 2. Exact call sequence (already implemented in main3d.ts)

```
getSession()
  |-- null (no sessionStorage, no ?tree_id)
  |    --> guest mode: tree stays as newTree() placeholder; refreshAll() at line 532 renders it
  |
  \-- KijoSession with tree_id present
       |
       \-- loadCareLog(tree_id)           [10s AbortController timeout in persistence.ts:161]
            |
            |  TRUST BOUNDARY: validateCareAction() in persistence.ts:130 checks every DB row
            |  'tick' rows filtered at persistence.ts:175 (CareLogReplay handles ticks internally)
            |  Rows sorted by (game_day, sequence) for correct replay order
            |
            \-- returns { treeData: GetTreeResponse, careLog: CareLogEntry[] }
                 |
                 |-- treeData.current_day === 0
                 |    --> new BonsaiTree(treeData.seed, treeData.species as SpeciesClass)
                 |    --> applyCurrentDayEntries(tree, careLog.filter(e => e.day === 0))
                 |
                 \-- treeData.current_day > 0
                      --> CareLogReplay.reconstruct(         [D5/V6 gate-verified path]
                             treeData.seed,
                             treeData.species as SpeciesClass,
                             careLog.filter(e => e.day < treeData.current_day),
                             treeData.current_day
                          )
                      --> applyCurrentDayEntries(
                             tree,
                             careLog.filter(e => e.day === treeData.current_day)
                          )                                  [tail entries, no extra growTick]
                 |
                 \-- DOM inputs synced: #seed.value = treeData.seed; #species.value = treeData.species
                 |
                 \-- refreshAll()
                      --> Voxelizer.voxelize(tree)           [deterministic; once per action]
                      --> StatDeriver.derive(                 [once per refreshAll; NOT per rAF tick]
                             tree, voxels.voxels, seed, ageDays, voxels.zones
                          )
                      --> populate #stat-table with HP, Power, Endurance, Ki,
                             Skill slots, Skill points, Wisdom, Match %, Defense, Stability
                      --> update #voxel-count, #meta, #fert-status
                      --> rebuildVoxels(voxels.voxels)       [InstancedMesh rebuild + canopy stream]
```

**DECISIONS.md compliance:**
- StatDeriver called once per user action or init swap, never per rAF tick. Satisfies
  "Dirty flag: main3d.ts is a viewer -- StatDeriver called once on load, not on every rAF tick."
- CareLogReplay.reconstruct is the production path. Satisfies "Determinism: CareLogReplay.reconstruct
  is the production path -- cite the V6/D5 gate results." V6: pipeline determinism confirmed;
  D5: end-to-end CareLogReplay -> voxelize -> derive byte-identical.

### 3. Guest fallback path

When `getSession()` returns null (no `kijo_session` in sessionStorage AND no `?tree_id`
in URL):
- init() hits `if (kijoSession?.tree_id)` at line 371 -- condition is false
- init() exits immediately (no server calls, no loading state)
- The placeholder `tree` from `newTree()` at line 256 remains active
- `refreshAll()` at line 532 has already rendered this placeholder before init() was called
- Viewer shows whatever seed/species values are in the DOM inputs (default: seed input value 42)

When `?tree_id=<uuid>` is in the URL with no sessionStorage (read-only link):
- `getSession()` at persistence.ts:75-77 returns `{ tree_id: urlTreeId, access_token: '', wallet_row_id: '' }`
- init() loads and replays the tree in read-only mode
- `persistAsync()` at line 350-353 no-ops because `kijoSession.access_token` is empty
- Care buttons still work locally but are not persisted to Supabase

**This is unchanged behavior from before the session-load implementation.** Guest mode was
explicitly preserved in the init() guard structure.

### 4. Error states

| Error state | Trigger | init() handling |
|-------------|---------|-----------------|
| Network failure | fetch() throws (DNS, timeout, offline) | try/catch at main3d.ts:403 catches, logs to console.error, tree stays as newTree() placeholder, `refreshAll()` at line 413 is NOT reached (catch falls through to the final `refreshAll()` at line 413 -- wait, actually line 403-410 is the catch block; line 413 is `refreshAll()` called AFTER the try/catch, always). |
| Non-200 response | `res.ok === false` in loadCareLog | throws `new Error(err.error ?? 'get-tree failed: ${status}')` -> caught by init() try block -> console.error -> falls through to refreshAll() |
| Network timeout (>10s) | AbortController.abort() in persistence.ts:162 | AbortError thrown -> caught by init() try block -> console.error -> falls through to refreshAll() |
| tree_id null or absent | `kijoSession?.tree_id` is falsy | init() exits at line 371 guard; no error logged; guest mode silently active |
| species invalid (not SpeciesClass) | `treeData.species as SpeciesClass` is a compile-time assertion only | Runtime: BonsaiTree receives unexpected species string; behavior depends on engine species lookup (may produce degenerate tree). This matches ThreeCanvas.tsx:158 exactly -- same cast, same risk, same Phase 2 deferral. |
| StatDeriver.derive() NaN | corrupted care log produces non-finite stat field | StatDeriver.ts:232-239 throws `Error('stat field X is not finite')`. This propagates OUT of refreshAll() and INTO init()'s try block -> caught -> console.error -> falls through to fallback refreshAll() at line 413 with placeholder tree. |

**NOTE on the final `refreshAll()` in init():** Line 413 is unconditional -- it is called both
when the session load succeeds (to render the server tree) and when the try/catch catches an
error (to render the placeholder). The catch block at lines 403-410 sets `tree` back to
placeholder only implicitly (tree was never swapped on error, so it remains newTree() from
line 256). This is correct because line 376 `const { treeData, careLog }` is declared inside
the try block and the `tree` module variable is only mutated at lines 380 and 385, so a throw
before those lines leaves `tree` unchanged.

### 5. Auth posture

**Validated upstream (before main3d.ts runs):**
- Wallet ECDSA signature verified by `wallet-auth` Edge Function (verify_jwt: false, ECDSA-secured)
- Supabase JWT issued and stored in memory by `useWalletAuth` React hook
- `KijoSession` (including `tree_id`, `access_token`, `wallet_row_id`) written to sessionStorage
  by `useSeedPurchase` dispatch-order fix (2026-08-07)
- `tree_id` ownership confirmed: written by WalletTreeSelector after `list-trees` returns the
  wallet's trees (list-trees derives wallet_id from JWT -- only owned trees returned)

**What main3d.ts must enforce:**
- Read session from sessionStorage only via `getSession()` -- already done
- Do NOT take write actions without non-empty `access_token` -- already enforced by `persistAsync()`
  at lines 350-353: `if (!kijoSession || !kijoSession.access_token || !kijoSession.wallet_row_id) return`

**What main3d.ts does NOT need to enforce:**
- Re-validating the JWT: `get-tree` Edge Function uses `verify_jwt: false` and accepts any
  `tree_id` param -- it provides public read access. This is intentional for the viewer (deep-link
  share a tree with anyone).
- Ownership of the tree: main3d.ts is a viewer; it renders whatever tree_id points to. Ownership
  gating applies to write paths only (care-action Edge Function checks JWT ownership).

**Auth posture summary:** Trust getSession() for identity. Trust loadCareLog() for data shape
(it validates via validateCareAction()). Trust the Edge Function layer for ownership gating
on write paths. No additional auth logic is needed in main3d.ts.

### 6. Trust boundary

`loadCareLog()` in persistence.ts is the trust boundary between raw DB rows and CareLogReplay.
Three layers of defense are in place:

**Layer 1 -- 'tick' exclusion (persistence.ts:175):**
Rows with `action_type === 'tick'` are filtered out before the array reaches the caller.
CareLogReplay.reconstruct() handles growth ticks internally (one `growTick()` per iteration).
A 'tick' row reaching CareLogReplay would cause an exhaustiveness error.

**Layer 2 -- type-discriminant validation (persistence.ts:130-137):**
`validateCareAction(candidate)` checks that `candidate.type` is a member of `CARE_ACTION_TYPES`.
`CARE_ACTION_TYPES` is declared with `as const satisfies ReadonlyArray<CareAction['type']>` --
TypeScript errors at build time if any CareAction['type'] discriminant is misspelled or missing.
Rows failing the check are skipped with `console.warn` and a `return []` from flatMap. They
never reach CareLogReplay.

**Layer 3 -- sort (persistence.ts:179-180):**
Rows sorted by `(game_day, sequence)` ensures replay order is correct even if the server
returns rows out of order. CareLogReplay applies per-day entries in array order.

**The safe cast pattern (from ThreeCanvas.tsx, confirmed in main3d.ts):**
`treeData.species as SpeciesClass` at main3d.ts:381 and :390 is a TypeScript type assertion.
It tells the compiler the species string from the server is a valid SpeciesClass.
This is a compile-time assertion only -- at runtime any string passes through.
ThreeCanvas.tsx uses the identical cast at lines 158 and 168. This is the accepted codebase
pattern; full runtime validation is a Phase 2 TODO (persistence.ts:122-124).

### 7. Done-when check (binary observable fact)

**Binary test:** Open `index3d.html` while logged in as a wallet that owns a tree with seed
DIFFERENT from the default (the page default seed is 42 from `newTree()`).

**PASS:** The `#meta` element reads:
```
seed <OWNED_SEED> * <OWNED_SPECIES> * day <OWNED_DAY> * health ... * moisture ... * N branches
```
AND the browser console contains:
```
[kijo] tree restored -- id=<UUID> day=<N> actions=<M> mode=read-write
```
AND the `#stat-table` shows HP/Power/etc values computed from the owned tree (not from seed 42).

**FAIL:** The `#meta` element reads `seed 42 * hardwood * day 0 ...` (placeholder tree),
OR console shows `[kijo] failed to restore tree from Supabase; starting fresh.`

There is no ambiguous intermediate state: either the server tree's seed appears, or the
placeholder seed (42) does.

**Note:** Seed 464497 (the hardwood used throughout gate testing) is NOT the default seed --
main3d.ts:266 uses `valueAsNumber || 42` as the DOM input fallback. If the authenticated
wallet's tree uses seed 464497, the meta line would show 464497 -- which is correct. The
failure indicator is specifically the day: `day 0` with the default seed.

### 8. Files changed

**Zero files require changes.** The implementation is complete.

The existing implementation in `apps/web/src/main3d.ts`:
- Lines 11-15: persistence imports (getSession, loadCareLog, persistCareAction,
  applyCurrentDayEntries, KijoSession)
- Lines 263-263: `let kijoSession: KijoSession | null = null;` -- module-level session state
- Lines 367-414: `async function init()` -- full session-load block
- Lines 530-534: boot sequence (`refreshAll(); animate(); void init()`)

The only action required by the implementer is VERIFICATION: run the done-when check
against a real wallet-owned tree and confirm the console log appears.

**STATE.md MUST be updated** to add "session-aware init, Supabase tree load, CareLogReplay
replay" to the main3d.ts description. This is the root cause of the stale preflight and must
be corrected to prevent the same confusion in future sessions.

---

## ASSUMPTIONS

1. **KijoSession.tree_id is populated before the user opens index3d.html.** The React app
   (App.tsx with WalletTreeSelector) writes the active tree to sessionStorage and then navigates.
   If the user opens index3d.html directly without the React flow, tree_id may not be set --
   guest mode activates. This is correct behavior.
   Mitigation: See Open Question 5 (navigation from App.tsx to index3d.html).

2. **get-tree Edge Function provides public read by tree_id.** Confirmed: STATE.md shows
   get-tree with `verify_jwt: false`. This means any caller with a valid UUID tree_id can read
   the tree. The auth model is intentional for the viewer (shareable deep-links).
   Risk: none for read-only viewer; write gating handled by care-action Edge Function.

3. **StatDeriver.derive() does not throw on a well-formed reconstructed tree.** D5 gate confirms
   the CareLogReplay -> voxelize -> derive pipeline produces valid finite stats. The NaN sentinel
   in StatDeriver.ts:232-239 throws only on corrupted inputs. A valid care log should not
   corrupt. If it does, init()'s try/catch falls back to the placeholder.

4. **The useSeedPurchase dispatch-order fix (2026-08-07) correctly writes tree_id to
   sessionStorage before the session object is read by main3d.ts.** Confirmed in STATE.md:
   "dispatch-order fix (Race 4): sessionStorage write -> localStorage.removeItem -> kijo:tree-created event."

---

## OPEN QUESTIONS

1. **STATE.md update required.** The main3d.ts description must be updated to include
   session-aware init, Supabase tree load, and CareLogReplay replay. This is not optional --
   the omission caused this task to be dispatched against already-complete work.

2. **morale field.** DESIGN-CARETAKER-OPACITY.md specifies that main3d.ts should show morale.
   StatSheet (10 fields) has no morale field; it is not in the engine. When morale is designed,
   a new row in `refreshAll()`'s stat table must be added. This is a separate future task --
   NOT part of this spec. Do not add morale to StatSheet without a dedicated architect spec.

3. **style hints.** DESIGN-CARETAKER-OPACITY.md specifies style hints (not style name) in
   main3d.ts. TechniqueClassifier.classify() is listed as "Not Yet Built." When TechniqueClassifier
   is implemented, a hint row (based on primary technique category, not style label) can be
   appended to the stat table. Separate future task.

4. **species cast hardening.** `treeData.species as SpeciesClass` in main3d.ts:381/:390 should
   eventually become a runtime guard (e.g., validate against `['hardwood','evergreen','tropical']`
   before casting). Deferred to Phase 2, matching persistence.ts:122-124 PHASE-2 TODO.

5. **Navigation from App.tsx to index3d.html.** Is there a button or link in the React app
   that opens index3d.html with the active tree's sessionStorage already populated? If not,
   authenticated users have no in-product path to the Voxel 3D Viewer. This is a UI routing gap
   separate from the session-load implementation, but it must be resolved before the done-when
   check can be run in the real product flow.

---

## CROSS-REFERENCE CHECK

```
CROSS-REFERENCE CHECK
  checked against:  SESSION-START.md, STATE.md, DECISIONS.md, DESIGN-CARETAKER-OPACITY.md,
                    packages/shared/src/index.ts (StatSheet, CareLogEntry, CareAction),
                    packages/engine/src/StatDeriver.ts (derive, VoxelSet interface),
                    apps/web/src/persistence.ts (getSession, loadCareLog, validateCareAction),
                    apps/web/src/components/ThreeCanvas.tsx (reference implementation)

  consistent:       yes, with exceptions listed below

  terminology:      aligned -- "kijonsai", "caretaker", "care log", "CareLogReplay",
                    "StatDeriver", "VoxelRole", "Voxel 3D Viewer" all match GDD / DECISIONS.md

  data shapes:      aligned -- StatSheet 10-field shape at shared/src/index.ts:279 matches
                    refreshAll() stat table rows exactly; CareLogEntry shape matches;
                    GetTreeResponse shape matches field usage in init()

  boundary:         aligned -- apps/web imports from @kijo/engine and @kijo/voxelizer; no
                    circular dependency; StatDeriver uses VoxelSet interface (not SparseVoxelSet
                    directly) to avoid voxelizer -> engine circular dep

  boundary violations: none found

  inconsistencies:
    1. STATE.md description of main3d.ts OMITS session-load -- root cause of stale preflight.
       Must be updated. (Open Question 1)
    2. DESIGN-CARETAKER-OPACITY.md calls for "morale" in main3d.ts. StatSheet has no morale.
       Not a session-load gap -- future feature. (Open Question 2)
    3. DESIGN-CARETAKER-OPACITY.md calls for "style hints". TechniqueClassifier not built.
       Not a session-load gap -- future feature. (Open Question 3)
```

---

## SUMMARY FOR IMPLEMENTER

This spec describes an architect stage that found the work already done. Your role:

1. Open `index3d.html` while authenticated as a wallet with an owned tree.
2. Confirm the browser console shows `[kijo] tree restored -- id=<UUID> day=<N> ...`.
3. Confirm the `#meta` element shows the owned tree's seed and species (not seed 42).
4. Confirm the `#stat-table` shows non-zero stats computed from the owned tree.
5. Update STATE.md -- add "session-aware init, Supabase tree load, CareLogReplay replay"
   to the main3d.ts row in the Apps Built table.

No TypeScript changes. No new files. No import changes. Verification and STATE.md update only.

---

## SUMMARY FOR AUDITOR

The session-load implementation in main3d.ts was found to already exist. The auditor must:

1. Re-run the done-when check (Section 7) independently -- do NOT trust the implementer's
   report that the console showed the right output; observe it directly.
2. Confirm `async function init()` exists at lines 367-414 and contains the full call sequence.
3. Confirm `void init()` appears at line 534, AFTER `animate()` at line 533 (not before).
4. Confirm `validateCareAction()` in persistence.ts is called for every care log row.
5. Confirm STATE.md was updated (Open Question 1).
6. The morale and style hints gaps (Open Questions 2-3) are OUT OF SCOPE for this audit --
   do NOT flag them as defects in the session-load task.
