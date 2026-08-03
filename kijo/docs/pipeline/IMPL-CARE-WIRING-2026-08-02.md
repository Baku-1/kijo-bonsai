# IMPL — Care Action Wiring to Supabase
**Date:** 2026-08-02  
**Stage:** Implementer  
**Status:** Complete — ready for Carmack-Linus review

---

## What Was Built

Wired the main React 3D UI's care buttons to Supabase so that care actions are
durably persisted after mint, and the tree state is loaded from the DB on mount.

### Files Changed

#### `apps/web/src/wallet/useSeedPurchase.ts`
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
  This is the handshake that enables ThreeCanvas to find the tree on next render
  without requiring URL params or a separate state lift.

#### `apps/web/src/components/ThreeCanvas.tsx`
Full rewrite of the `useEffect` to add session-aware tree loading:

**Boot sequence (authenticated):**
1. Boots a local tree immediately from URL params (same as before) — renders instantly.
2. Starts the animation loop immediately — no blank frame while fetching.
3. Async IIFE runs `getSession()` → `loadCareLog(session.tree_id)`.
4. Replays care log using `CareLogReplay.reconstruct` (past-day entries) +
   `applyCurrentDayEntries` (current-day entries) — mirrors `main2d.ts` exactly.
5. Swaps in DB tree via `tree = dbTree; bridge.setTree(tree)` — bridge and
   closures all reference the same `let tree` variable.
6. Rebuilds mesh and updates HUD with the server's authoritative state.

**Guest mode (no session):** falls through to URL-param behavior, no server calls.

**Care button wiring:**
- `onWater`: calls `bridge.water()` (local engine) + `persistAsync({type:'water', amount: WATER_AMOUNT})` (fire-and-forget to Supabase)
- `onNextDay`: local debug advance only — intentionally NOT persisted (same as `main2d.ts`)
- `onToggleAuto`: local only

**`persistAsync` helper:**
- No-ops if `session` is null or session is read-only (empty access_token/wallet_row_id)
- Errors are `console.warn` only — local tree state is always consistent regardless of server response
- Snapshots `session` at call time to avoid stale closure bugs

---

## What Was NOT Changed

- `care_bridge.ts` — CareBridge is unchanged; `bridge.setTree()` is used to swap
  the tree reference after async DB load
- All Edge Functions — no server-side changes in this task
- `persistence.ts` — unchanged; ThreeCanvas now imports from it directly
- `main2d.ts` / `main3d.ts` — unchanged debug pages

---

## Known Gaps / Assumptions

1. **Only `water` is persisted from the 3D view.** ThreeCanvas has no prune/fertilize/rotate
   buttons (those are 2D debug only). If those buttons are added to the 3D UI in Phase 2,
   add corresponding `persistAsync` calls in `onPrune` / `onFertilize` / `onRotate`.

2. **`nextDay` is NOT persisted.** The server drives real days by wall-clock time (8 hr = 1
   game day). Local day-advances are a sandbox convenience — same intentional decision as
   `main2d.ts`.

3. **No error UI shown if DB load fails.** Falls back silently to local tree. This is
   appropriate for testnet — consider a toast/warning in Phase 2.

4. **One active tree per tab.** `sessionStorage` is tab-scoped. If the user opens multiple
   tabs, each tab has its own session. This is correct behavior; tree selection UI (Phase 2)
   will handle multi-tree wallets.

5. **Pre-mainnet TODO (inherited):** `Math.random()` → `crypto.getRandomValues` in
   `useSeedPurchase.ts` for seed generation. Comment already in-file.

---

## Next Stage

**Carmack-Linus code review** on:
- `apps/web/src/wallet/useSeedPurchase.ts` — sessionStorage write after `setTreeId`
- `apps/web/src/components/ThreeCanvas.tsx` — full async rewrite

Review focus areas:
- Is the `let tree` + `bridge.setTree()` swap race-safe if the animation loop fires
  between the initial mount and the async DB load completing?
- Does `persistAsync` snapshot the session correctly to avoid stale closure issues?
- Does the `void (async () => { ... })()` pattern handle cleanup correctly when the
  component unmounts before the fetch completes?
- Are there any TypeScript type errors introduced (CareLogReplay import from `@kijo/engine`)?
