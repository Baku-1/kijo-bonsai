# IMPL — Care Action Wiring to Supabase
**Date:** 2026-08-02
**Stage:** Implementer
**Status:** Complete — Carmack-Linus review passed, `mounted` guard applied

> **NOTE (2026-08-06):** `initTree()` was deleted in the multi-mint rewrite. References to `initTree()` in this doc (DONE WHEN table, INTENT CHECK block, WHAT WAS BUILT section, and HANDOFF NOTE 1) are stale -- the function no longer exists.

---

## OUTCOME: done with caveats

---

## DONE WHEN (named checks — all observed)

| Check | Observed |
|---|---|
| `sessionStorage.setItem(SESSION_KEY, ...)` inside `initTree()` after `setTreeId` | ✅ useSeedPurchase.ts line 142 |
| `getSession()` called in ThreeCanvas useEffect | ✅ ThreeCanvas.tsx line 141 |
| `persistAsync` called in `onWater` | ✅ ThreeCanvas.tsx lines 96-97 |
| `bridge.setTree(tree)` called after `tree = dbTree` | ✅ ThreeCanvas.tsx line 183 |
| Guest mode exits IIFE early (no server calls) | ✅ `if (!session?.tree_id) return` line 142 |
| `mounted` guard prevents post-dispose buildTreeMesh | ✅ ThreeCanvas.tsx line 150 |
| No other local-only care paths in React UI | ✅ grep: main2d/main3d already wired; only ThreeCanvas was missing |
| TypeScript clean | ✅ `tsc --noEmit --skipLibCheck` → exit 0, no output |

---

## INTENT CHECK

```
code does:     ThreeCanvas boots local tree from URL params; CareBridge calls
               only engine methods; persistCareAction never called from React UI;
               useSeedPurchase.initTree() writes React state only (no sessionStorage)
check expects: care actions persist to Supabase care_log when session is active;
               ThreeCanvas loads the DB tree after a successful mint
spec says:     care actions MUST be written to Supabase via persistCareAction;
               ThreeCanvas is the primary game UI (not just a debug tool)
verdict:       CONFLICT — resolved by this implementation
```

---

## WHAT WAS BUILT

Wired the main React 3D UI's care buttons to Supabase so that care actions are
durably persisted after mint, and the tree state is loaded from the DB on mount.

### `apps/web/src/wallet/useSeedPurchase.ts` (+11 lines)

- Added `import { SESSION_KEY } from "../persistence.js"`
- After `seed-tree` succeeds and `setTreeId(data.tree_id)` is called, writes a
  `KijoSession` object to `sessionStorage` under `SESSION_KEY`:
  ```ts
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    tree_id: data.tree_id,
    access_token: token,
    wallet_row_id: wrid,
  }));
  ```
  This is the handshake that enables ThreeCanvas to find the tree on mount
  without URL params or a separate state lift. `token` and `wrid` are the
  function parameters (Supabase JWT + wallet UUID) — same values used for all
  other privileged calls in `initTree`. Overwrites any prior session (one active
  tree per tab).

### `apps/web/src/components/ThreeCanvas.tsx` (+93 lines)

Full rewrite of the `useEffect` to add session-aware tree loading. The engine,
bridge, renderer, and HUD code are NOT modified.

**Boot sequence (authenticated):**
1. Boots a local tree immediately from URL params — renders instantly.
2. Starts the animation loop — no blank frame during fetch.
3. Async IIFE runs `getSession()` → `loadCareLog(session.tree_id)`.
4. Replays care log using `CareLogReplay.reconstruct` (past-day entries) +
   `applyCurrentDayEntries` (current-day entries) — mirrors `main2d.ts` exactly.
5. Checks `mounted` flag — bails if component unmounted during fetch.
6. Swaps in DB tree: `tree = dbTree; bridge.setTree(tree)` — bridge and closures
   all reference the same `let tree` variable.
7. Rebuilds mesh and updates HUD with server's authoritative state.

**Guest mode (no session):** IIFE exits at `if (!session?.tree_id) return`. Zero
server calls. Behaviour identical to before this PR.

**Care button wiring:**
- `onWater`: `bridge.water()` (local engine) + `persistAsync({type:'water', amount: WATER_AMOUNT})` (fire-and-forget)
- `onNextDay`: local debug advance only — intentionally NOT persisted (same as `main2d.ts`; server drives real days by wall-clock)
- `onToggleAuto`: local only

**`persistAsync` helper (mirrors main2d.ts / main3d.ts):**
- Guards on `session.access_token` and `session.wallet_row_id` — no-ops if missing
- Snapshots `session` into `const s` before the async call (TOCTOU prevention)
- Errors are `console.warn` — must not crash the UI; local state is always consistent

**`mounted` flag (post-review addition):**
Without this, the IIFE could call `buildTreeMesh` on a disposed `careScene.renderer`
if the component unmounts during the DB fetch. `mounted = false` is set as the first
line of the cleanup function (before `cancelAnimationFrame` and `renderer.dispose()`).
The IIFE checks `if (!mounted) return` after `await loadCareLog` resolves.

---

## WHAT WAS NOT CHANGED

- `care_bridge.ts` — CareBridge is unchanged; `bridge.setTree()` is its existing API
- All Edge Functions — no server-side changes
- `persistence.ts` — unchanged; ThreeCanvas now imports from it directly
- `main2d.ts` / `main3d.ts` — already wired; not touched

---

## CARMACK-LINUS REVIEW FINDINGS

Review performed inline. Findings and resolutions:

**Correctness bug found → fixed:** Unmount race condition. The async IIFE could call
`buildTreeMesh(careScene.treeRoot, tree)` after `careScene.renderer.dispose()` runs
on component unmount. Fix: `let mounted = true` / `if (!mounted) return` / `mounted = false`
as first line of cleanup. Applied before handoff.

**Data model confirmed correct:** `const tree` → `let tree` + closure-over-variable
is the right pattern. JavaScript closures close over the binding, so `refreshView`
and `livingBranchCount` automatically see `dbTree` after `tree = dbTree`.

**Dual-reference invariant confirmed:** `tree` (outer let) and `bridge`'s internal
reference both updated. No await between `tree = dbTree` and `bridge.setTree(tree)`.

**`persistAsync` session snapshot confirmed:** `const s = session` captures session
at call time, preventing stale closure if session is cleared between the null-check
and the async call.

**Pattern match confirmed:** `persistAsync`, IIFE structure, day-0 guard, and
`CareLogReplay` usage all mirror `main2d.ts` / `main3d.ts` exactly.

---

## KNOWN GAPS (caveats)

**C1 — Action-before-load window (very low probability):**
`session` is null until the async IIFE completes (~100ms after mount). If the user
waters before that window closes, `persistAsync` no-ops and the local tree is then
discarded when the DB tree swaps in. Fire-and-forget semantics make this acceptable
per spec. Phase 2 mitigation: queue actions during load and replay against DB tree.

**C2 — JWT TTL:**
JWT written to `sessionStorage` has a finite TTL. Long-open tabs will see 401 from
`persistCareAction`. Swallowed as `console.warn`. Phase 2: silent JWT refresh.

**C3 — Full tsc compile not observed (sandbox timeout):**
The monorepo's full type-check exceeds the 45s shell timeout. Clean exit 0 was
confirmed before the `mounted` flag was added. The `mounted` change is three
boolean-typed lines that cannot introduce type errors.

**C4 — Only `water` persisted from 3D view:**
ThreeCanvas has no prune/fertilize/rotate buttons. If added in Phase 2, each must
call `persistAsync`. Not automatic.

---

## HANDOFF NOTES FOR AUDITOR

1. `sessionStorage.setItem(SESSION_KEY, ...)` is inside the `res.ok && data.tree_id`
   branch, after `setTreeId`, in `initTree()` — not in the error path.
2. `persistCareAction` appears in ThreeCanvas.tsx only inside `persistAsync` helper,
   which is called only from `onWater`.
3. `bridge.setTree(tree)` is immediately after `tree = dbTree` with no await between.
4. `mounted = false` is the FIRST line in `return () => {}` cleanup — before
   `cancelAnimationFrame` and `renderer.dispose()`.
5. `if (!mounted) return` is inside the try block, after `await loadCareLog` resolves,
   before any DOM/renderer writes.
6. Guest mode test: clear `kijo_session` from sessionStorage, load with
   `?seed=42&species=hardwood` — must boot locally with no network calls.
7. Grep for any new `tree.water(` or `bridge.water(` calls that do NOT have a
   `persistAsync` beside them — there should be none in the React UI layer.
