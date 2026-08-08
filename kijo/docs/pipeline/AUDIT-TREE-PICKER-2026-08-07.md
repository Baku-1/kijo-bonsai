# AUDIT-TREE-PICKER-2026-08-07

**Stage:** AUDITOR (adversarial)
**Date:** 2026-08-07
**Auditor:** adversarial-auditor skill
**Subject:** Tree picker feature (L-4) — 7 files per ARCH-TREE-PICKER-2026-08-07.md
**Verdict:** FAIL

---

## VERDICT: FAIL

One blocking issue prevents progression to the linter stage.

---

## CLAIMS CHECKED

Every claim below was verified by directly reading the file. No completion report was trusted.

### Security

✓ **list-trees rejects unauthenticated requests (401)** — OBSERVED at `index.ts:34-35`:
`const token = req.headers.get('Authorization')?.replace('Bearer ', '');`
`if (!token) return json({ error: 'Missing authorization' }, 401);`
And at `index.ts:42-43`: invalid/expired JWT → `return json({ error: 'Invalid or expired token' }, 401);`
Both paths confirmed present and correct.

✓ **wallet_id derived from JWT, not from a query param** — OBSERVED at `index.ts:49`:
`const walletRowId: string = user.user_metadata?.wallet_row_id ?? user.id;`
`walletRowId` is extracted from the verified `user` object returned by `anonClient.auth.getUser(token)`.
No request body, no URL params, no headers other than the Bearer token are consulted for ownership.
Identical to the `care-action:74` pattern confirmed in the ARCH.

✓ **Returns ONLY trees belonging to the authenticated wallet** — OBSERVED at `index.ts:60-65`:
`.eq('wallet_id', walletRowId)` where `walletRowId` comes from the JWT.
`.limit(50)` applied. No user-controlled filter applied to the query.

---

### Bug Fixes

✓ **BUG-1: showPicker includes `!!walletRowId`** — OBSERVED at `App.tsx:56`:
```typescript
const showPicker =
  isConnected && !!accessToken && !!walletRowId && !activeTreeId;
```
All four guards present. The picker cannot fire when `walletRowId` is null.

✓ **BUG-2: handleClose calls BOTH `onClose()` AND `setLocalOpen(false)`** — OBSERVED at `StoreModal.tsx:176-188`:
```typescript
const handleClose = useCallback(function handleClose() {
  if (isBusy) return;
  onClose();           // clears App.storeOpen (parent-controlled path)
  setLocalOpen(false); // clears DOM-event open path
  setQuantities({ ...DEFAULT_QUANTITIES });
  setSelectedSpecies(null);
  setSeedError(null);
}, [isBusy, onClose]);
```
Both states cleared. All three close call sites (backdrop `onClick`, X button `onClick`, Escape handler) call `handleClose()`.

✓ **BUG-3: Old `const [open, setOpen]` is gone; `#btn-buy-seed` handler uses `setLocalOpen(true)`** — OBSERVED:
- `StoreModal.tsx:140-141`: `const [localOpen, setLocalOpen] = useState(false);` / `const isOpen = propOpen || localOpen;`
- No `const [open, setOpen]` exists anywhere in the file (confirmed by full read).
- `StoreModal.tsx:164-169`: DOM listener wires `handler = () => setLocalOpen(true)` to `#btn-buy-seed`. ✓

---

### Gap Fixes

✗ **GAP-1: Auto-select useEffect — early return BEFORE hooks** — **BLOCKING** (see FAIL below)

✓ **GAP-1 (dep array)**: The auto-select `useEffect` dep array is `[trees, selectTree]` at `WalletTreeSelector.tsx:90`. `selectTree` is memoized via `useCallback([accessToken, walletRowId, onTreeSelected])` at line 64-79. Both early-return guards (`trees === null`, `trees.length !== 1`) are present inside the effect. This is BETTER than the spec's `[trees]` + eslint-disable approach because `selectTree` is in deps correctly.

✓ **GAP-2: Migration filename** — OBSERVED: file exists at
`apps/server/supabase/migrations/20260807000002_trees_wallet_id_index.sql`
Filename matches the `YYYYMMDD000NNN` sequential counter pattern. Content confirmed:
`CREATE INDEX IF NOT EXISTS idx_trees_wallet_id ON public.trees (wallet_id);`

---

### Race Condition

✓ **Race 4: `localStorage.removeItem("care_log")` is BEFORE `dispatchEvent`** — OBSERVED at `useSeedPurchase.ts:201-212`:
```typescript
localStorage.removeItem("care_log");   // line 201 — FIRST

window.dispatchEvent(                  // line 208 — SECOND
  new CustomEvent("kijo:tree-created", { ... })
);
```
Order confirmed. The dispatch cannot trigger a ThreeCanvas remount before the guest log is cleared.

---

### Design Contracts

✓ **DC-1: WalletTreeSelector uses callback prop, NOT window CustomEvent** — OBSERVED:
- `WalletTreeSelector.tsx:76`: `onTreeSelected(tree.id);` — callback prop invocation only.
- No `window.dispatchEvent` anywhere in `WalletTreeSelector.tsx`.
- `App.tsx:73-79`: WalletTreeSelector rendered with `onTreeSelected={setActiveTreeId}` and `onBuyMore={() => setStoreOpen(true)}`.

✓ **DC-2: useListTrees second param is `_walletReady: string | null`** — OBSERVED at `useListTrees.ts:36`:
`_walletReady: string | null,`
Named with underscore prefix to signal it is NOT sent to the server. Callers pass `walletRowId` (a string). Type is `string | null`, not `boolean`. WalletTreeSelector calls `useListTrees(accessToken, walletRowId)` at line 60. Consistent.

---

### Auth Lifting

✓ **`useWalletAuth()` called exactly ONCE in App.tsx** — OBSERVED at `App.tsx:38-39`:
```typescript
const { accessToken, walletRowId, isAuthenticating, authError, signIn } =
  useWalletAuth();
```
Single call site. No other `useWalletAuth` in the file.

✓ **`useWalletAuth()` NOT called in StoreModal** — OBSERVED: `StoreModal.tsx` imports only
`{ useWallet }` and `{ useSeedPurchase, type Species }`. No `useWalletAuth` import present.
Auth state arrives via props: `accessToken`, `walletRowId`, `isAuthenticating`, `authError`, `signIn`.

---

### ThreeCanvas Remount

✓ **App.tsx passes `key={activeTreeId ?? 'guest'}` to ThreeCanvas** — OBSERVED at `App.tsx:64`:
```typescript
<ThreeCanvas key={activeTreeId ?? "guest"} />
```
String `"guest"` (lowercase, not `'guest'`) — matches the spec. Full remount occurs when `activeTreeId` changes.

---

### Event Wiring

✓ **useListTrees listens for `kijo:tree-created`** — OBSERVED at `useListTrees.ts:55-61`:
```typescript
useEffect(() => {
  function onTreeCreated() { setFetchTrigger((t) => t + 1); }
  window.addEventListener("kijo:tree-created", onTreeCreated);
  return () => window.removeEventListener("kijo:tree-created", onTreeCreated);
}, []);
```
Counter increment causes the fetch effect to re-run. Clean removal on unmount.

✓ **useSeedPurchase dispatches `kijo:tree-created` after successful mint** — OBSERVED at `useSeedPurchase.ts:208-212`:
```typescript
window.dispatchEvent(
  new CustomEvent("kijo:tree-created", {
    detail: { treeId: successfulTokens[0].treeId },
  }),
);
```
Dispatched AFTER sessionStorage write and localStorage removal. ✓

---

### Implementer Caveat

✓ **WalletTreeSelector receives `walletRowId: string | null`** — OBSERVED at `WalletTreeSelector.tsx:28`:
`walletRowId: string | null;`
It serves dual purpose: fetch gate passed to `useListTrees` as `_walletReady`, AND used in
`selectTree()` to write `wallet_row_id` into the sessionStorage session object (line 71).
This is consistent — the ARCH spec's `_walletReady` rename applies to the useListTrees
parameter name, not to the WalletTreeSelector prop name. No mismatch.

---

## FAIL — BLOCKING ISSUE

### HOOKS VIOLATION: WalletTreeSelector.tsx has a conditional return before hook calls

**File:** `apps/web/src/components/WalletTreeSelector.tsx`
**Lines:** 58 (early return) vs 60, 64, 84 (hook calls)

**Observed code:**
```typescript
export function WalletTreeSelector({ accessToken, walletRowId, ... }) {
  // Safety guard — should not be reachable due to showPicker condition in App.
  if (!accessToken || !walletRowId) return null;   // ← LINE 58: EARLY RETURN

  const { trees, isLoading, error } = useListTrees(accessToken, walletRowId);  // LINE 60: hook
  const selectTree = useCallback(...);                                           // LINE 64: hook
  useEffect(...);                                                                // LINE 84: hook
```

This violates the **Rules of Hooks**: hooks must be called unconditionally on every render.
`eslint react-hooks/rules-of-hooks` will flag this as an error during the linter stage.

**Severity:** While App.tsx's `showPicker` guard (`!!accessToken && !!walletRowId`) ensures
the component is only ever mounted with both props truthy — making the early return unreachable
at runtime — the static violation will still fail `eslint react-hooks/rules-of-hooks`.

**Required fix:** Move all hook calls above the early return:
```typescript
export function WalletTreeSelector({ accessToken, walletRowId, ... }) {
  const { trees, isLoading, error } = useListTrees(accessToken, walletRowId);
  const selectTree = useCallback(...);
  useEffect(() => { ... }, [trees, selectTree]);

  // Safety guard AFTER hooks — safe because hook calls are now unconditional.
  if (!accessToken || !walletRowId) return null;
  ...
```

Alternatively, remove the guard entirely and rely on the `showPicker` guarantee (the comment
"should not be reachable" already documents this intent).

---

## INTENT CHECK

```
INTENT CHECK
  code does:     Reject unauthenticated requests (401), derive walletRowId from JWT,
                 return only the authenticated wallet's trees — all security properties
                 implemented correctly in list-trees. Bug fixes (BUG-1/2/3), GAP-2,
                 Race 4, DC-1/DC-2 all correctly implemented. Auth lifted to App.tsx.
                 ThreeCanvas remounts via key prop. Events consistent (kijo:tree-created).

  check expects: All of the above, PLUS hooks called unconditionally in WalletTreeSelector.

  spec says:     ARCH-TREE-PICKER-2026-08-07 (Rev 2) requires correct React hook discipline.
                 The Rules of Hooks is a React fundamental; a violation will fail static analysis.

  verdict:       CONFLICT — on the hooks violation only. All other intent checks ALIGNED.
```

---

## SCOPE

Seven files in scope per the ARCH spec. All seven were read and verified:

| File | Status |
|---|---|
| `apps/server/supabase/functions/list-trees/index.ts` | ✓ Created, correct |
| `apps/server/supabase/migrations/20260807000002_trees_wallet_id_index.sql` | ✓ Created, correct filename |
| `apps/web/src/wallet/useListTrees.ts` | ✓ Created, correct |
| `apps/web/src/components/WalletTreeSelector.tsx` | ✗ **Hooks violation at L58** |
| `apps/web/src/App.tsx` | ✓ Modified correctly |
| `apps/web/src/components/StoreModal.tsx` | ✓ Modified correctly |
| `apps/web/src/wallet/useSeedPurchase.ts` | ✓ Modified correctly |

No unexpected files appear to have been modified (the auditor cannot run `git diff` but
all reviewed files contain only changes consistent with the feature scope).

---

## FRAUDS HUNTED

**Weakened tests:** No test files were part of this feature. N/A.

**False completion:** No gate or test runner was invoked by the implementer.
The hooks violation is a genuine defect, not a concealed failure.

**Intent inversion:** None found. Security properties are correctly implemented.
Bug fixes are correctly applied. The hooks violation is an oversight, not an inversion.

**Phantom evidence:** All line numbers cited in the implementation are verified.
The ARCH spec's references to care-action and seed-claim patterns are confirmed
present in the new list-trees function.

---

## NOTABLE FINDINGS (non-blocking, for record)

These are design evolutions from the ARCH spec that are internally consistent and
do not block the linter. They are documented here for traceability.

**F-1: Event name evolved from `kijo:tree-selected` to `kijo:tree-created`**
The ARCH spec (sections 6, 7, assumption 4) used `kijo:tree-selected`. The
implementation uses `kijo:tree-created` in both producer (`useSeedPurchase.ts:209`) and
consumer (`useListTrees.ts:59`). Producer and consumer are in sync. The behavioral
difference: the spec had App.tsx listening to `kijo:tree-selected` and calling
`setActiveTreeId` directly; the implementation routes through useListTrees refetch →
picker auto-select → callback. Both achieve the same end state. The new name is more
semantically accurate (the event announces that a tree was minted, not that one was selected).

**F-2: App.tsx has no `kijo:tree-selected` listener**
Consistent with F-1. Post-mint tree activation routes via `kijo:tree-created` →
useListTrees refetch → WalletTreeSelector auto-select (if 1 tree) or picker (if 2+ trees)
→ `onTreeSelected` callback → `setActiveTreeId`. Correct. For the multi-tree case this
is better than the spec (user sees updated picker with new tree rather than being
auto-jumped to the newly-minted one).

**F-3: WalletTreeSelector props simplified vs. spec**
Spec included `isAuthenticating`, `authError`, `signIn` (for a sign-in panel state).
Implementation omits these because `showPicker` in App.tsx guarantees the component only
mounts when `!!accessToken && !!walletRowId`. The sign-in panel state is handled by
WalletBar instead. `onStoreOpen` renamed to `onBuyMore`. Simpler and correct.

**F-4: useListTrees omits `refetch()` return**
Spec declared `refetch: () => void` in the return shape. Implementation drops it —
refetch is triggered internally via the `kijo:tree-created` event listener. Since no
other consumer calls `refetch()` (the hook is brand-new), this is safe.

**F-5: auto-select dep array `[trees, selectTree]` vs spec's `[trees]`**
Spec had `[trees]` with `// eslint-disable-next-line react-hooks/exhaustive-deps`.
Implementation wraps `selectTree` in `useCallback` and adds it to deps. More correct
from a hooks hygiene standpoint. No infinite loop risk because `selectTree` is stable
(its own deps `[accessToken, walletRowId, onTreeSelected]` are stable at mount time).

---

## BOTTOM LINE

All security checks pass. All seven named bug/gap/race fixes are correctly implemented.
Auth lifting is clean. Event wiring works (though under a renamed event). The single
blocker is a **Rules of Hooks violation** in `WalletTreeSelector.tsx` line 58: an early
return appears before three hook calls, which will fail `eslint react-hooks/rules-of-hooks`.
Fix is one structural move (hooks before guards). Once fixed, the implementation is
ready for the linter stage.
