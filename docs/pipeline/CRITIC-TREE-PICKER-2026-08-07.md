# CRITIC-TREE-PICKER-2026-08-07

**Stage:** CRITIC  
**Date:** 2026-08-07  
**Author:** critic stage (verified against source)  
**Spec reviewed:** `docs/pipeline/ARCH-TREE-PICKER-2026-08-07.md`  
**Status:** READY FOR IMPLEMENTER — with required fixes noted below

---

## VERDICT

The architect's core design is sound and the major claims check out against source. Three bugs must be fixed in the spec before the implementer touches code. Two additional spec gaps need explicit answers. The remaining findings are implementation guidance; none block the work.

---

## SOURCES READ FOR VERIFICATION

```
apps/web/src/App.tsx                                  (34 lines, verified)
apps/web/src/wallet/useWalletAuth.ts                  (111 lines, verified)
apps/web/src/components/WalletBar.tsx                 (79 lines, verified)
apps/web/src/components/StoreModal.tsx                (554 lines, verified)
apps/web/src/components/ThreeCanvas.tsx               (250 lines, full file read)
apps/web/src/wallet/useSeedPurchase.ts                (280 lines, verified)
apps/web/src/persistence.ts                           (310 lines, verified)
apps/web/src/main.tsx                                 (23 lines, verified)
apps/server/supabase/functions/care-action/index.ts   (211 lines, verified)
apps/server/supabase/migrations/ (all 7 files, verified)
docs/AUDIT-TREE-SELECTION-2026-08-06.md               (full, context)
```

---

## PART 1: VERIFIED CORRECT

The following architect claims were confirmed against source. Implementer can trust these without re-reading.

| Claim | Verification |
|---|---|
| SESSION_KEY = 'kijo_session' | persistence.ts:36 ✓ |
| KijoSession shape `{ tree_id, access_token, wallet_row_id }` | persistence.ts:38-44 ✓ |
| getSession() reads sessionStorage, then URL param ?tree_id | persistence.ts:57-80 ✓ |
| useWalletAuth() returns `{ accessToken, walletRowId, isAuthenticating, authError, signIn, signOut }` | useWalletAuth.ts:109 ✓ |
| useWalletAuth() only called in StoreModal (line 129-130) | StoreModal.tsx:129 ✓ |
| StoreModal exported with zero props | StoreModal.tsx:119 `export function StoreModal()` ✓ |
| WalletBar zero props, portals into #wallet-bar-anchor | WalletBar.tsx:69 ✓ |
| ThreeCanvas zero props | ThreeCanvas.tsx:32 ✓ |
| ThreeCanvas.initialized.current guard at line 37 | ThreeCanvas.tsx:37 ✓ |
| getSession() called once in async IIFE (line 141) | ThreeCanvas.tsx:141 ✓ |
| sessionStorage.setItem at useSeedPurchase.ts:188-196 | useSeedPurchase.ts:188-196 ✓ |
| Only one call site for useSeedPurchase: StoreModal.tsx:140 | StoreModal.tsx:140 ✓ |
| Only one render site for StoreModal: App.tsx | App.tsx:21 ✓ |
| JWT auth pattern (anonClient.auth.getUser) | care-action:52 ✓ |
| walletRowId extraction `user.user_metadata?.wallet_row_id ?? user.id` | care-action:74 ✓ |
| No idx_trees_wallet_id index in any migration | All 7 migrations read — confirmed absent ✓ |
| idx_trees_token_id exists (partial, WHERE token_id IS NOT NULL) | 20260806000001_trees_token_id.sql:20-23 ✓ |
| App.tsx is inside WagmiProvider + QueryClientProvider | main.tsx:17-22 ✓ |
| ThreeCanvas cleanup: mounted=false, cancelAnimationFrame, renderer.dispose | ThreeCanvas.tsx:201-205 ✓ |

### ThreeCanvas cleanup detail (critic concern #5 from task)

The architect claims `key={activeTreeId}` remount is safe. **Verified correct.** Three-way safety:

1. **Cleanup function is provided** (ThreeCanvas.tsx:201-205): `mounted = false`, `cancelAnimationFrame(animId)`, `careScene.renderer.dispose()`. These run synchronously on unmount before the new instance mounts.
2. **Async IIFE guards against disposed renderer** (ThreeCanvas.tsx:147): `if (!mounted) return;` is checked before any `buildTreeMesh` call. An in-flight `loadCareLog` from the OLD instance that completes after unmount exits before touching the disposed renderer.
3. **initialized.current resets correctly on remount**: `useRef(false)` initializes to `false` on every fresh component instance (React creates a new object). The guard prevents StrictMode double-invocation on the new instance, not the remount itself.

Conclusion: ThreeCanvas is safe to remount via key change.

### `kijo:tree-selected` DOM event — existing pattern check (critic concern #5 from task)

The architect says this is "consistent with the existing `#btn-buy-seed` DOM event pattern." **Partially true, partially overstated.** The `#btn-buy-seed` pattern (StoreModal.tsx:143-149) is a native `click` event on a DOM element — not a `CustomEvent` on `window`. The architect acknowledges "no custom DOM events in the codebase yet" in the GAPS section but then calls it "consistent" in ASSUMPTIONS. These two statements are in tension.

The pattern is technically sound but it IS a new communication mechanism, not an extension of the existing one. The CRITIC finding here is documentation/framing only, not a bug. See Design Critique DC-1 below.

---

## PART 2: BUGS — Fix before the implementer starts

### BUG-1 (High): `showPicker` missing `walletRowId` guard → potential null session write

**Location:** Spec section 7, App.tsx `showPicker` condition.

**The spec says:**
```typescript
const showPicker = isConnected && !!accessToken && !activeTreeId;
```

**The problem:** `walletRowId` is null-asserted inside `WalletTreeSelector.selectTree()`:
```typescript
sessionStorage.setItem(SESSION_KEY, JSON.stringify({
  tree_id:       tree.id,
  access_token:  accessToken!,
  wallet_row_id: walletRowId!,   // ← non-null asserted
}));
```

But `walletRowId` CAN be null even when `accessToken` is not null. In `useWalletAuth.ts`:
```typescript
setWalletRowId(
  payload?.user_metadata?.wallet_row_id ?? data.user_id ?? null
);
```

If the JWT decode fails AND `data.user_id` is absent from the server response, `walletRowId` is null while `accessToken` is set. The showPicker condition would pass (`!!accessToken = true`) and `selectTree()` would write `wallet_row_id: undefined` into sessionStorage — a corrupted session that would break `persistCareAction()` at the guard on `session.wallet_row_id`.

**Fix:**
```typescript
const showPicker = isConnected && !!accessToken && !!walletRowId && !activeTreeId;
```

Same fix required in `WalletTreeSelector` if it checks auth independently of `showPicker`.

---

### BUG-2 (High): `StoreModal.handleClose` must close BOTH `storeOpen` AND `localOpen`

**Location:** Spec section 8, `localOpen` pattern for StoreModal.

**The spec says:** "The `onClose` prop closes both." But the implementation path isn't fully specified.

The architect proposes:
```typescript
const [localOpen, setLocalOpen] = useState(false);
const isOpen = open || localOpen;
```

If `#btn-buy-seed` sets `localOpen=true` and then the user clicks the X button, `handleClose` must call BOTH `props.onClose()` (to set `storeOpen=false` in App) AND `setLocalOpen(false)`. If only `props.onClose()` is called:

```
storeOpen = false  (App state, from onClose)
localOpen = true   (StoreModal state, not cleared)
isOpen = false || true = true  ← modal does not close
```

**Fix:** The implementer's `handleClose` must be:
```typescript
const handleClose = useCallback(() => {
  if (isBusy) return;
  props.onClose();       // clears App.storeOpen
  setLocalOpen(false);   // clears DOM-event open path
  setQuantities({ ...DEFAULT_QUANTITIES });
  setSelectedSpecies(null);
  setSeedError(null);
}, [isBusy, props.onClose]);
```

Both calls must be present. The spec does not make this explicit enough for the implementer to get right without reading this note.

---

### BUG-3 (Medium): `#btn-buy-seed` DOM handler uses `setOpen(true)` — must become `setLocalOpen(true)`

**Location:** Spec section 8, "Preservation" note; StoreModal.tsx:143-149.

The current StoreModal:
```typescript
useEffect(() => {
  const btn = document.getElementById("btn-buy-seed");
  if (!btn) return;
  const handler = () => setOpen(true);   // ← this is the LOCAL useState
  btn.addEventListener("click", handler);
  ...
}, []);
```

In the new design, `open` (the local state) is REMOVED in favor of `localOpen`. The handler must become `() => setLocalOpen(true)`. The spec says to "preserve" the `#btn-buy-seed` DOM listener but does not explicitly say the variable name changes from `open` to `localOpen`. An implementer working from the spec alone could leave this wired to the old (now-removed) `setOpen` and silently break the ThreeCanvas → StoreModal flow.

**Fix:** Spec section 8 should explicitly say: the handler `() => setOpen(true)` becomes `() => setLocalOpen(true)`. Also note the entire `const [open, setOpen] = useState(false)` line in StoreModal is deleted; `localOpen` replaces it.

---

## PART 3: SPEC GAPS — Implementer needs these answers before writing code

### GAP-1: Auto-select `useEffect` dependency array is unspecified

**Location:** Spec section 5, PICKER PANEL / auto-select state.

The spec says single-tree auto-select "runs `selectTree()` immediately in `useEffect`" but does not specify the dependency array. Two interpretations:

- `useEffect(() => { if (trees?.length === 1) selectTree(trees[0]); }, [trees])` — fires whenever `trees` reference changes. With the `refetch()` mechanism, this could fire multiple times if the reference changes between renders.
- `useEffect(() => { ... }, [])` — fires once on mount. Misses the case where `trees` loads asynchronously after mount (the common path).

**Required spec addition:** The auto-select effect should depend on `[trees]` and include an early return if `trees === null` (loading) or `trees.length !== 1`. The `selectTree` reference should also be stable (useCallback or inline). The spec must be explicit here — this is the most complex state transition in the component.

---

### GAP-2: Migration timestamp convention — `000002` vs. `120000`

**Location:** Spec section 3, migration filename.

The spec proposes `20260807120000` as a possible timestamp. The existing migrations use the pattern `YYYYMMDD000001`, `YYYYMMDD000002`, `YYYYMMDD000003` — a sequential counter, NOT wall-clock HHMMSS. Evidence:

```
20260806000001_trees_token_id.sql
20260806000002_render_queue.sql
20260806000003_seed_claims_token_ids.sql
20260807000001_render_queue_updated_at_trigger.sql
```

The next migration should be `20260807000002_trees_wallet_id_index.sql`, not `20260807120000_...`.

**Fix:** Change the filename in the spec to `20260807000002_trees_wallet_id_index.sql`.

---

## PART 4: DESIGN CRITIQUES (implementer-decision, not blockers)

### DC-1: `kijo:tree-selected` is not consistent with existing patterns — it's a new pattern

The spec assumption that the custom DOM event is "consistent with the existing pattern of #btn-buy-seed DOM events" is a stretch. The `#btn-buy-seed` pattern is native click event subscription on a DOM element (ThreeCanvas renders the button; StoreModal listens to its native click). The `kijo:tree-selected` pattern is a `CustomEvent` on `window` used for React-to-React state transfer.

These are different patterns solving different problems:
- `#btn-buy-seed`: non-React HUD element → React modal (DOM boundary)
- `kijo:tree-selected`: React component → React ancestor (could be a callback prop)

For `WalletTreeSelector`, which IS a child of App in the React tree, a callback prop `onTreeSelected(treeId: string)` would be idiomatic React and eliminate the DOM event layer entirely. Only `useSeedPurchase` (a hook, not a component) genuinely needs the DOM event to reach App state.

**Recommendation:** Give `WalletTreeSelector` an `onTreeSelected(treeId: string)` callback prop instead of having it dispatch on `window`. Keep the DOM event only for `useSeedPurchase`. App.tsx listens to the DOM event for useSeedPurchase's dispatch AND calls `setActiveTreeId` directly from the WalletTreeSelector callback. This separates concerns cleanly.

This is a design preference, not a correctness issue. The DOM event approach works. But the implementer should choose consciously.

---

### DC-2: `useListTrees` `walletRowId` parameter misleads about what's sent to the server

The spec defines:
```typescript
export function useListTrees(
  accessToken: string | null,
  walletRowId: string | null,
): { ... }
```

The `list-trees` Edge Function does NOT accept `walletRowId` — it derives wallet identity from the JWT. The `walletRowId` parameter in the hook is used only as a "both args are non-null → fetch" gate.

This is confusing: a caller reading the hook signature assumes both args flow to the server. Consider either:
(a) Rename the parameter to `_walletReadySignal: string | null` to make its purpose clear, or  
(b) Remove it: the hook can use `!!accessToken` alone as the fetch gate, since `walletRowId` being null when `accessToken` is non-null is already guarded by BUG-1's fix to `showPicker`.

---

### DC-3: `signOut` has no UI entry point after auth state is lifted to App.tsx

`useWalletAuth()` returns `signOut`. In the current code, StoreModal owns auth state but never exposes a sign-out button. After the refactor, App.tsx owns auth state via `useWalletAuth()` but the spec's proposed App.tsx doesn't pass `signOut` to any child component or render a sign-out button.

The player can disconnect their wallet (via WalletBar) but cannot sign out of Supabase auth without also disconnecting. For testnet this is acceptable. For mainnet this is a UX gap. Flagging for awareness — it's not a spec error, just an omission worth tracking.

---

## PART 5: EDGE CASES AND RACE CONDITIONS

### Race 1: Wallet switch without sign-out

Player signs in with Wallet A → selects tree (activeTreeId set) → disconnects → connects with Wallet B. Current state:
- `isConnected = true` (Wallet B)
- `accessToken` = JWT for Wallet A (in-memory, not cleared)
- `walletRowId` = Wallet A's row ID
- `activeTreeId` = Wallet A's tree ID
- `showPicker = false` (because activeTreeId is set)
- ThreeCanvas loads Wallet A's session from sessionStorage

The player sees Wallet B connected in WalletBar but Wallet A's tree in ThreeCanvas. The picker doesn't show because `activeTreeId` is set. **This is a pre-existing issue** (noted in useWalletAuth.ts comments as a known caveat, OQ-2 adjacent). The spec doesn't make it worse, but the new design doesn't address it either. Note for the implementer: the safest fix is to clear `activeTreeId` (and the sessionStorage) on wallet disconnect, but this is out of scope for this spec.

---

### Race 2: Multi-tree mint → picker immediately locked

When the player has 0 trees, clicks "Plant first kijonsai" → StoreModal opens → mints 3 trees:

1. `useSeedPurchase` dispatches `kijo:tree-selected` with `tokens[0].treeId`
2. App.setActiveTreeId fires → `showPicker = false`
3. WalletTreeSelector unmounts
4. ThreeCanvas remounts with tree[0]

Trees 1 and 2 are **inaccessible** until OQ-1 (Switch Tree) is implemented. The spec acknowledges this under OQ-1 but understates the impact: a user who mints a multi-tree batch on first use is immediately locked into tree[0] with no discoverable way to switch. The spec should say this explicitly so the product owner can decide whether OQ-1 must be in scope for this release.

---

### Race 3: `#btn-buy-seed` listener fires before `wallet-bar-anchor` exists (pre-existing, not new)

This is a pre-existing concern noted in WalletBar.tsx comments (the useEffect for anchor lookup). The StoreModal's `#btn-buy-seed` listener has the same initialization dependency. Not introduced by this spec, not changed by it.

---

### Race 4: Session write order in `useSeedPurchase` (minor)

The spec says to add `dispatchEvent` "after the existing `sessionStorage.setItem(SESSION_KEY, ...)` call." In the actual code, `localStorage.removeItem("care_log")` immediately follows the setItem (useSeedPurchase.ts:197). The event dispatch should go AFTER the localStorage removal:

```typescript
sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ... }));
localStorage.removeItem("care_log");        // ← must precede dispatch
window.dispatchEvent(new CustomEvent(...)); // ← dispatch last
```

This ensures the new ThreeCanvas sees a clean state (no guest care_log, valid session) when it mounts. The spec's "after the sessionStorage write" phrasing could be read as "between setItem and removeItem." Clarify the order.

---

## PART 6: OPEN QUESTION TRIAGE

Of the six OQs the architect flagged, the critic assessment of which BLOCK implementation:

| OQ | Summary | Blocks impl? | Notes |
|---|---|---|---|
| OQ-1 | Switch Tree UX | No | Out of scope, defer. But see Race 2 above — urgency higher than spec implies. |
| OQ-2 | Auth persistence on reload | No | Pre-existing caveat, documented. |
| OQ-3 | Pagination >50 trees | No | Testnet: acceptable. Hardcode limit is fine. |
| OQ-4 | ThreeCanvas imperative reinit | No | key-remount is verified safe (Part 1 above). |
| OQ-5 | Picker visibility with existing session | No | Condition `showPicker = isConnected && !!accessToken && !activeTreeId` is provably correct. Page reload → `accessToken=null` → `showPicker=false`. No picker shown until re-sign-in. Expected behavior. |
| OQ-6 | Legacy label for null token_id | **Soft blocker** | The picker card renders this string. If "Legacy" is acceptable as a placeholder, implementation can proceed. If the product owner wants a different label, it must be decided before the picker UI is built. Recommend defaulting to "Legacy" and tracking as a follow-up. |

**OQ-5 can be marked RESOLVED:** The condition is correct. The stated concern ("picker should NOT appear if activeTreeId is already set") is handled: `readStoredTreeId()` initializes `activeTreeId` from sessionStorage on load, so `showPicker = false` whenever a stored session exists.

---

## PART 7: WHAT THE SPEC GETS RIGHT (acknowledgments)

1. **Session write before event dispatch** is correctly ordered. sessionStorage.setItem is synchronous; the event fires after the write is complete. The new ThreeCanvas's async IIFE calls getSession() after the event handler triggers React's render cycle — the session is always available when ThreeCanvas reads it.

2. **The `mounted = false` flag correctly prevents the old ThreeCanvas from writing to a disposed renderer after remount.** This was verified explicitly. The architecture is sound.

3. **Lifting `useWalletAuth()` from StoreModal to App.tsx** is the right move. The single-owner auth state eliminates the possibility of two hook instances diverging.

4. **`ThreeCanvas key={activeTreeId ?? 'guest'}`** correctly differentiates guest mode (key='guest', stable) from tree-loaded mode (key=uuid). ThreeCanvas does NOT remount during sign-in/auth state changes (because key only changes when activeTreeId changes). This is the right behavior.

5. **`readStoredTreeId` as lazy initializer** `useState<string | null>(readStoredTreeId)` is the correct React pattern for sessionStorage reads at init time.

---

## SUMMARY FOR IMPLEMENTER

**Must-fix before writing code:**
- BUG-1: Add `!!walletRowId` to `showPicker` condition
- BUG-2: `handleClose` must call BOTH `props.onClose()` AND `setLocalOpen(false)`
- BUG-3: `#btn-buy-seed` handler → `setLocalOpen(true)` (not `setOpen(true)`)

**Must-have clarifications from spec:**
- GAP-1: Auto-select `useEffect` needs explicit dependency array `[trees]` in spec
- GAP-2: Migration filename is `20260807000002_trees_wallet_id_index.sql` (not `20260807120000`)
- GAP-4 (implicit): Event dispatch in useSeedPurchase goes AFTER `localStorage.removeItem("care_log")`

**Product decision before UI build:**
- OQ-6: Confirm "Legacy" label for null token_id is acceptable

**Everything else in the spec is correct and implementable.**
