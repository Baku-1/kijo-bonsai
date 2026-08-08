# ARCH-TREE-PICKER-2026-08-07

**Stage:** ARCHITECT  
**Date:** 2026-08-07  
**Author:** verified-architect skill  
**Revision:** 2 — Critic fixes applied 2026-08-07  
**Status:** READY FOR IMPLEMENTER

**Changes in Rev 2:** BUG-1 (walletRowId guard in showPicker), BUG-2 (handleClose closes both
open states), BUG-3 (setLocalOpen replaces setOpen in DOM listener), GAP-1 (auto-select
useEffect dependency array), GAP-2 (migration filename), Race 4 (dispatch ordering in
useSeedPurchase), DC-1 (WalletTreeSelector uses callback prop not window CustomEvent),
DC-2 (useListTrees param rename). Owner decisions: OQ-6 resolved ("Legacy" label accepted),
OQ-1 deferred (Switch Tree out of scope for this release).

---

## SCOPE

```
DESIGN TASK:  Add a tree-picker flow so a player can see all kijonsai they own
              and select one to care for, triggered after Ronin wallet auth.

DELIVERABLE:  New Edge Function (list-trees), new React hook (useListTrees),
              new React component (WalletTreeSelector), plus targeted changes to
              App.tsx and StoreModal.tsx to lift auth state and wire the picker
              into the session flow.

BUILDS ON:    Multi-mint pipeline (ARCH-MULTI-MINT-TOKENTREE-LINK, LINT-MULTI-MINT-2026-08-07),
              wallet-auth Edge Function, care-action JWT pattern, persistence.ts
              session shape.

CONSUMED BY:  disciplined-implementer — all interfaces below are binding.
```

---

## CODEBASE RECONNAISSANCE

```
FILES READ:
  apps/web/src/App.tsx                                     (34 lines)
  apps/web/src/wallet/useWalletAuth.ts                     (111 lines)
  apps/web/src/wallet/useSeedPurchase.ts                   (280 lines)
  apps/web/src/persistence.ts                              (310 lines)
  apps/web/src/components/WalletBar.tsx                    (79 lines)
  apps/web/src/components/StoreModal.tsx                   (554 lines)
  apps/web/src/components/ThreeCanvas.tsx                  (100 lines read)
  apps/server/supabase/functions/get-tree/index.ts         (84 lines)
  apps/server/supabase/functions/care-action/index.ts      (210 lines)
  apps/server/supabase/functions/wallet-auth/index.ts      (192 lines)
  apps/server/supabase/functions/seed-claim/index.ts       (517 lines)
  apps/server/supabase/migrations/20260806000001_trees_token_id.sql
  docs/AUDIT-TREE-SELECTION-2026-08-06.md

SYMBOLS VERIFIED:
  ✓ SESSION_KEY           — persistence.ts:36, exported: yes, value: 'kijo_session'
  ✓ KijoSession           — persistence.ts:38, exported: yes,
                            shape: { tree_id: string; access_token: string; wallet_row_id: string }
  ✓ getSession()          — persistence.ts:57, exported: yes, returns KijoSession | null
  ✓ useWalletAuth()       — useWalletAuth.ts:34, exported: yes,
                            returns { accessToken, walletRowId, isAuthenticating,
                                      authError, signIn, signOut }
  ✓ useWallet()           — imported by WalletBar.tsx, StoreModal.tsx; returns { isConnected, ... }
  ✓ useSeedPurchase()     — useSeedPurchase.ts:57, exported: yes,
                            currently writes SESSION_KEY to sessionStorage at line 189–196
  ✓ StoreModal()          — StoreModal.tsx:119, exported: yes, currently zero props
  ✓ WalletBar()           — WalletBar.tsx:69, exported: yes, zero props, portals into
                            #wallet-bar-anchor
  ✓ ThreeCanvas()         — ThreeCanvas.tsx:32, exported: yes, zero props;
                            reads session via getSession() inside useEffect with
                            initialized.current guard (line 37) — will not re-run
                            after first mount without component remount

  trees table columns (confirmed from migrations + Edge Function queries):
    id (uuid PK), wallet_id (uuid), seed (int), species (text),
    has_spirit (bool), current_day (int), last_ticked_at (timestamptz),
    born_at (timestamptz), token_id (bigint NULLABLE UNIQUE)

CALL SITES FOUND:
  useWalletAuth():
    - apps/web/src/components/StoreModal.tsx:129  — only call site

  SESSION_KEY:
    - apps/web/src/wallet/useSeedPurchase.ts:33   — import
    - apps/web/src/wallet/useSeedPurchase.ts:190  — sessionStorage.setItem(SESSION_KEY, ...)
    - (persistence.ts:36 — definition)

  getSession():
    - apps/web/src/components/ThreeCanvas.tsx:25,141 — import + call on mount
    - apps/web/src/main2d.ts:6,217                   — import + call on mount
    - apps/web/src/main3d.ts:10,368                  — import + call on mount

  sessionStorage.setItem(SESSION_KEY):
    - apps/web/src/wallet/useSeedPurchase.ts:189–196  — only write site

DATA STRUCTURE USAGE:
  KijoSession constructed at:   useSeedPurchase.ts:189–196 (JSON.stringify)
  KijoSession deserialized at:  persistence.ts:64 (JSON.parse inside getSession)
  KijoSession consumed at:      ThreeCanvas.tsx, main2d.ts, main3d.ts (via getSession)

GAPS FOUND:
  - No existing index on trees.wallet_id (migrations inspected — only token_id index exists)
  - ThreeCanvas.initialized.current guard means getSession() is called exactly once;
    any new tree selection REQUIRES ThreeCanvas to remount to pick up the new session
  - useWalletAuth() is currently instantiated only in StoreModal; WalletBar has no
    auth state; App.tsx has no state at all
  - No custom DOM events in the codebase yet (kijo:tree-selected is a proposed addition)
  - StoreModal currently accepts zero props; adding auth props IS a breaking interface change
    but App.tsx is the only render site so impact is one file
```

---

## VERIFICATION LOG

```
VERIFIED:
  ✓ JWT auth pattern (anonClient.auth.getUser(token)) — confirmed working in care-action
    and seed-claim production code; same Supabase JS client v2 used everywhere
  ✓ walletRowId extraction from JWT — user.user_metadata?.wallet_row_id ?? user.id
    pattern confirmed in care-action:74 and seed-claim:195
  ✓ trees.wallet_id FK semantics — seed-claim inserts wallet_id: walletRowId (line 362);
    care-action queries .eq('wallet_id', wallet_row_id) (line 87); consistent
  ✓ SERVICE_ROLE_KEY required for DB writes — confirmed in care-action:56 and seed-claim:136
  ✓ ANON_KEY sufficient for auth.getUser() — confirmed in care-action:47 and seed-claim:128
  ✓ React key prop causes full unmount/remount — standard React behavior; consistent with
    initialized.current guard design in ThreeCanvas (guard prevents StrictMode double-mount,
    not intentional remount)
  ✓ token_id is NULLABLE BIGINT — migration 20260806000001 confirms; guest trees have NULL
  ✓ multiple sessionStorage.setItem calls are safe — each overwrites the previous; this is
    the current behavior already (sequential purchases overwrite, per audit L-4)
  ✓ CORS headers must include 'authorization' — confirmed present in get-tree, care-action,
    seed-claim, wallet-auth
  ✓ Deno.serve pattern (no explicit import) — confirmed in all four existing Edge Functions

UNVERIFIED:
  ? trees.wallet_id index existence — no migration creating one was found; the query
    .eq('wallet_id', ...) on trees is used in care-action but only fetches one row (by
    tree_id + wallet_id). list-trees will fetch ALL rows for a wallet and will do a full
    scan without an index. MITIGATION: the new migration must include this index.

  ? list-trees function existence in Supabase project — not yet deployed; this is a new
    function entirely.

REFUTED:
  ✗ "ThreeCanvas will pick up a new session without remount" — REFUTED by initialized.current
    guard at ThreeCanvas.tsx:37. The session is read exactly once on first mount. A new
    tree selection cannot be reflected without component remount.
```

---

## CROSS-REFERENCE CHECK

```
CHECKED AGAINST:
  docs/KIJO-TECH-SPEC.md (reference)
  docs/KIJO-ARCHITECTURE.md (reference)
  docs/KIJO-PRD.md (reference)
  docs/GDD.md (reference)
  docs/AUDIT-TREE-SELECTION-2026-08-06.md (blockers awareness)

CONSISTENT: yes — this design does not touch the care loop, engine, or combat layers
TERMINOLOGY ALIGNED: yes — "kijonsai" for NFT trees, "kijo" for spirit
DATA SHAPES ALIGNED: yes — KijoSession shape is preserved; tree_id stays required in session
BOUNDARY VIOLATIONS: none — no engine package references introduced in web-only files
AUDIT AWARENESS: The audit (AUDIT-TREE-SELECTION-2026-08-06) flagged L-4 (sessionStorage
  overwrite on sequential purchases) as low-impact until multi-tree is supported. This
  design resolves L-4 structurally by making the picker the canonical session-write path.
```

---

## THE DESIGN

### 1. Overview — What Changes and Why

After a successful multi-mint, `useSeedPurchase` currently stores only `tokens[0].treeId`
in sessionStorage. All other minted trees are unreachable without their UUID. This design
introduces a **post-auth tree picker** that:

1. Lists all trees owned by the authenticated wallet
2. Auto-selects if the player has exactly one tree
3. Shows a picker grid if the player has multiple trees
4. Opens the store if the player has zero trees
5. Causes ThreeCanvas to remount with the selected tree's session

Three cardinal rules preserved from the existing architecture:
- `get-tree` stays public (no auth requirement added)
- `KijoSession.tree_id` stays required (session is only written when a tree is known)
- ThreeCanvas stays stateless (reads session from sessionStorage on mount; remount is the
  mechanism for session change)

---

### 2. New: `list-trees` Edge Function

**File:** `apps/server/supabase/functions/list-trees/index.ts`

**Method:** GET  
**Auth:** Required — `Authorization: Bearer <access_token>`  
**CORS:** Same headers as all other Edge Functions (includes `authorization`)

**Request:**
```
GET /functions/v1/list-trees
Authorization: Bearer <supabase-jwt>
```
No query params — wallet identity is derived entirely from the JWT.

**Handler outline:**
```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405);

  // Step 1: JWT verification (identical to care-action pattern)
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return json({ error: 'Missing authorization' }, 401);

  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  );
  const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
  if (authErr || !user) return json({ error: 'Invalid or expired token' }, 401);

  // Step 2: Extract walletRowId from JWT (identical to care-action pattern)
  const walletRowId: string = user.user_metadata?.wallet_row_id ?? user.id;

  // Step 3: Fetch trees (service role for RLS bypass consistency)
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: trees, error: treesErr } = await serviceClient
    .from('trees')
    .select('id, token_id, species, current_day, born_at')
    .eq('wallet_id', walletRowId)
    .order('born_at', { ascending: true })
    .limit(50);  // see OQ-3

  if (treesErr) return json({ error: treesErr.message }, 500);

  return json({ trees: trees ?? [] });
});
```

**Response shape:**
```typescript
interface ListTreesResponse {
  trees: Array<{
    id: string;           // UUID — becomes session.tree_id
    token_id: number | null;  // null for guest-converted trees
    species: 'hardwood' | 'evergreen' | 'tropical';
    current_day: number;
    born_at: string;          // ISO timestamp
  }>;
}
```

`seed` is intentionally excluded — it's the genome hash and has no display value in the
picker. `has_spirit` is not included — all minted trees have `has_spirit: true`.

**Security:** walletRowId is extracted from the verified JWT, not from the request body.
A caller cannot list another wallet's trees. No input from the request body is trusted.

---

### 3. New: Migration — Index on `trees.wallet_id`

**File:** `apps/server/supabase/migrations/20260807000002_trees_wallet_id_index.sql`

The project uses sequential counter timestamps (`YYYYMMDD000001`, `000002`, …), NOT
wall-clock HHMMSS. Evidence: `20260806000001_trees_token_id.sql`, `000002_render_queue.sql`,
`000003_seed_claims_token_ids.sql`, `20260807000001_render_queue_updated_at_trigger.sql`.
Next in sequence is `20260807000002`.

```sql
-- list-trees queries trees by wallet_id without a tree_id filter.
-- Without this index the query degrades to a full table scan.
-- Named index for query-plan debugging (consistent with idx_trees_token_id pattern).
CREATE INDEX IF NOT EXISTS idx_trees_wallet_id
  ON public.trees (wallet_id);

-- Down (reference only -- never run in production):
-- DROP INDEX IF EXISTS idx_trees_wallet_id;
```

---

### 4. New: `useListTrees` hook

**File:** `apps/web/src/wallet/useListTrees.ts`

```typescript
export interface TreeSummary {
  id: string;
  token_id: number | null;
  species: 'hardwood' | 'evergreen' | 'tropical';
  current_day: number;
  born_at: string;
}

export function useListTrees(
  accessToken: string | null,
  // DC-2: renamed from `walletRowId` — this parameter is NOT sent to the server.
  // list-trees derives wallet identity from the JWT. This arg is a fetch gate only:
  // the hook will not fetch unless both args are non-null, which aligns with the
  // showPicker guard (BUG-1 fix). Callers pass walletRowId so the hook fires only
  // when auth is fully established (accessToken + walletRowId both present).
  _walletReady: string | null,
): {
  trees: TreeSummary[] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}
```

**Behavior:**
- Returns `{ trees: null, isLoading: false, error: null }` when either arg is null
- Auto-fetches when both `accessToken` and `_walletReady` become non-null
- `refetch()` forces a new request — called by `WalletTreeSelector` after a successful
  mint so the picker reflects newly-minted trees
- Uses `AbortController` with a 10s timeout (matching `loadCareLog` in persistence.ts)
- Does NOT retry on failure — exposes `error` for the component to show and `refetch`
  for the player to retry manually

**URL:** `https://xutjubkaskwchzyzwryk.supabase.co/functions/v1/list-trees`

---

### 5. New: `WalletTreeSelector` component

**File:** `apps/web/src/components/WalletTreeSelector.tsx`

**Props (DC-1: uses callback prop, not window CustomEvent):**
```typescript
interface WalletTreeSelectorProps {
  accessToken: string | null;
  walletRowId: string | null;
  isAuthenticating: boolean;
  authError: string | null;
  signIn: () => Promise<void>;
  onStoreOpen: () => void;          // called when 0 trees — parent opens StoreModal
  onTreeSelected: (treeId: string) => void;  // called when a tree is chosen/auto-selected
}
```

**Rationale (DC-1):** `WalletTreeSelector` is a React child of `App`. Callback props are
idiomatic React for parent-child communication and are preferable to `window.CustomEvent`
within the React tree. The `kijo:tree-selected` DOM event is reserved exclusively for
`useSeedPurchase` (a hook, not a component), which has no other path to reach App state.

**Render logic (state machine):**

```
isConnected = false          → null (hidden; wallet not connected)
isConnected = true
  accessToken = null         → SIGN-IN PANEL (sign-in prompt + error + button)
  accessToken ≠ null
    isLoading = true         → LOADING PANEL ("Finding your kijonsai…")
    error ≠ null             → ERROR PANEL (error message + retry button)
    trees = null             → LOADING PANEL (shouldn't occur; safety fallback)
    trees.length = 0         → ZERO-TREES PANEL (text + "Plant your first kijonsai" button)
    trees.length = 1         → AUTO-SELECT (no UI — runs selectTree() immediately
                                            in useEffect, component returns null)
    trees.length > 1         → PICKER PANEL (grid of tree cards)
```

**Internal `selectTree(tree: TreeSummary)` function (DC-1: callback, not CustomEvent):**
```typescript
function selectTree(tree: TreeSummary): void {
  // 1. Write full session to sessionStorage (synchronous — always before callback)
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    tree_id:       tree.id,
    access_token:  accessToken!,   // non-null: showPicker guard enforces !!accessToken
    wallet_row_id: walletRowId!,   // non-null: BUG-1 fix enforces !!walletRowId in showPicker
  }));

  // 2. Notify parent via callback prop — App.tsx sets activeTreeId,
  //    which causes ThreeCanvas to remount via key prop.
  //    No window.CustomEvent here — that pattern is only for useSeedPurchase (a hook).
  props.onTreeSelected(tree.id);
}
```

**Auto-select `useEffect` (GAP-1: explicit dependency array required):**
```typescript
// Auto-select when exactly one tree is found. Dependency array is [trees] so this
// fires whenever the trees list loads (async) or reloads (after refetch).
// Early returns prevent spurious invocations on loading (null) or many-tree states.
useEffect(() => {
  if (trees === null) return;       // still loading — do nothing
  if (trees.length !== 1) return;   // 0 or >1 trees — let render logic handle it
  selectTree(trees[0]);
  // selectTree is intentionally not in deps: it closes over stable hook values
  // (accessToken, walletRowId, props.onTreeSelected) and sessionStorage write is
  // idempotent. Adding it would require useCallback and create churn.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [trees]);
```

**ZERO-TREES PANEL** calls `props.onStoreOpen()` when the player clicks
"Plant your first kijonsai". This opens StoreModal without duplicating its logic.

**PICKER PANEL** — each card shows:
- Species name (Hardwood / Evergreen / Tropical)
- `token_id` if non-null (e.g. "Token #42"), or "Legacy" if null
- `current_day` as "Day N"
- `born_at` formatted as a short date

**Visibility:** Component is visible only when `isConnected && !activeTreeId`. App.tsx
controls this via the `activeTreeId` state (see section 7).

**Styling:** Follows the StoreModal overlay pattern — `position: fixed`, `inset: 0`,
`zIndex: 100`, panel in center of screen. The component is self-contained; it does NOT
portal (unlike WalletBar which needs a specific anchor inside ThreeCanvas's DOM).

**OQ-6 (RESOLVED):** Trees with `token_id = null` display the label **"Legacy"** in the
picker card. This is confirmed acceptable by the product owner.

---

### 6. Changed: `useSeedPurchase` — dispatch `kijo:tree-selected` after mint

**File:** `apps/web/src/wallet/useSeedPurchase.ts`

**Change:** Insert the dispatch AFTER the `localStorage.removeItem("care_log")` call at
line 197 (Race 4: the new ThreeCanvas must see a clean state — no guest care_log, valid
session — on mount). The complete block after the fix:

```typescript
// Existing code (lines 188-197) — preserved, no modification:
if (successfulTokens.length > 0 && successfulTokens[0].treeId) {
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      tree_id:       successfulTokens[0].treeId,
      access_token:  token,
      wallet_row_id: wrid,
    }),
  );
  // One-time care_log consumption (client-side responsibility).
  localStorage.removeItem("care_log");        // ← must precede dispatch

  // NEW: dispatch AFTER both storage writes are complete.
  // useSeedPurchase is a hook (not a React component) and has no callback prop path
  // to App state — the window CustomEvent is the correct mechanism here.
  // WalletTreeSelector uses a callback prop instead (DC-1).
  window.dispatchEvent(
    new CustomEvent<string>('kijo:tree-selected', {
      detail: successfulTokens[0].treeId,
    })
  );
}
```

This is **additive only** — the existing sessionStorage write and localStorage removal are
preserved unchanged. The event dispatch causes App.tsx to update `activeTreeId`, which
remounts ThreeCanvas with the newly-minted tree.

**Call sites for `useSeedPurchase`:** only `StoreModal.tsx:140`. No other callers.

---

### 7. Changed: `App.tsx` — lift auth state, add tree picker

**File:** `apps/web/src/App.tsx`

**Full replacement** (current file is 33 lines; new version ~60 lines):

```typescript
import React, { useEffect, useState } from 'react';
import { useWallet } from './wallet/useWallet.js';
import { useWalletAuth } from './wallet/useWalletAuth.js';
import { SESSION_KEY, type KijoSession } from './persistence.js';
import { ThreeCanvas } from './components/ThreeCanvas.js';
import { WalletBar } from './components/WalletBar.js';
import { StoreModal } from './components/StoreModal.js';
import { TutorialOverlay } from './components/TutorialOverlay.js';
import { WalletTreeSelector } from './components/WalletTreeSelector.js';

/** Read tree_id from sessionStorage on first render (handles page reload). */
function readStoredTreeId(): string | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) return (JSON.parse(raw) as KijoSession).tree_id ?? null;
  } catch { /* ignore */ }
  return null;
}

export function App() {
  const { isConnected } = useWallet();
  const { accessToken, walletRowId, isAuthenticating, authError, signIn } =
    useWalletAuth();

  // activeTreeId drives ThreeCanvas remounting via key prop.
  // Initialized from sessionStorage so a page reload with an existing session
  // immediately loads the tree without showing the picker.
  const [activeTreeId, setActiveTreeId] = useState<string | null>(readStoredTreeId);

  // StoreModal visibility — controlled here so WalletTreeSelector can open it
  const [storeOpen, setStoreOpen] = useState(false);

  // DC-1: Listen ONLY for useSeedPurchase's DOM event (hook → App state).
  // WalletTreeSelector communicates via onTreeSelected callback prop (not DOM event).
  useEffect(() => {
    function onMintTreeSelected(e: Event) {
      setActiveTreeId((e as CustomEvent<string>).detail);
    }
    window.addEventListener('kijo:tree-selected', onMintTreeSelected);
    return () => window.removeEventListener('kijo:tree-selected', onMintTreeSelected);
  }, []);

  // Show picker when: connected, fully authenticated, and no tree selected yet.
  // BUG-1 fix: walletRowId guard added — both accessToken AND walletRowId must be
  // non-null before showing the picker. WalletTreeSelector.selectTree() non-null
  // asserts both when writing the session; this guard prevents a corrupted write
  // if walletRowId is null while accessToken is non-null (JWT decode edge case).
  const showPicker = isConnected && !!accessToken && !!walletRowId && !activeTreeId;

  return (
    <>
      {/* ThreeCanvas key prop: remounts the scene when the selected tree changes */}
      <ThreeCanvas key={activeTreeId ?? 'guest'} />

      <WalletBar />

      {/* Tree picker — shown after full auth when no session tree is active.
          DC-1: onTreeSelected is a callback prop (not a DOM event) — WalletTreeSelector
          is a React child of App; callbacks are idiomatic. The DOM event listener above
          handles only useSeedPurchase (a hook with no prop path to App state). */}
      {showPicker && (
        <WalletTreeSelector
          accessToken={accessToken}
          walletRowId={walletRowId}
          isAuthenticating={isAuthenticating}
          authError={authError}
          signIn={signIn}
          onStoreOpen={() => setStoreOpen(true)}
          onTreeSelected={setActiveTreeId}
        />
      )}

      <StoreModal
        open={storeOpen}
        onClose={() => setStoreOpen(false)}
        accessToken={accessToken}
        walletRowId={walletRowId}
        isAuthenticating={isAuthenticating}
        authError={authError}
        signIn={signIn}
      />

      <TutorialOverlay />

      <nav id="page-links">
        <a href="/index3d.html">voxel view</a>
        <a href="/index2d.html">2d debug</a>
      </nav>
    </>
  );
}
```

**Note on `useWallet()`:** `App.tsx` must be inside the Wagmi provider (confirmed by
existing `main.tsx` wrapping). `useWallet` is already used in WalletBar and StoreModal —
same import pattern.

---

### 8. Changed: `StoreModal` — accept auth props, add open/close control

**File:** `apps/web/src/components/StoreModal.tsx`

**Interface changes:**
```typescript
interface StoreModalProps {
  open: boolean;
  onClose: () => void;
  accessToken: string | null;
  walletRowId: string | null;
  isAuthenticating: boolean;
  authError: string | null;
  signIn: () => Promise<void>;
}

export function StoreModal({
  open, onClose, accessToken, walletRowId,
  isAuthenticating, authError, signIn,
}: StoreModalProps) { ... }
```

**Removals from StoreModal:**
- The `useWalletAuth()` call (line 129–131) — replaced by props
- The existing `const [open, setOpen] = useState(false)` line (line 120) is **deleted
  entirely** and replaced with the `localOpen` pattern below (BUG-3)

**DOM-event open path (BUG-3 fix — explicit):**

The `#btn-buy-seed` DOM listener is **preserved in StoreModal** (not moved to App.tsx).
The variable name changes from `open`/`setOpen` to `localOpen`/`setLocalOpen`:

```typescript
// NEW: replaces const [open, setOpen] = useState(false)
const [localOpen, setLocalOpen] = useState(false);
const isOpen = props.open || localOpen;   // either parent-controlled or DOM-triggered

useEffect(() => {
  const btn = document.getElementById("btn-buy-seed");
  if (!btn) return;
  const handler = () => setLocalOpen(true);  // BUG-3: was setOpen(true)
  btn.addEventListener("click", handler);
  return () => btn.removeEventListener("click", handler);
}, []);
```

Every occurrence of `open` in the existing StoreModal body that referred to the old
local state must be replaced with `isOpen`. The `props.open` and `props.onClose` names
are distinct and must not be confused with the removed local state.

**handleClose (BUG-2 fix — both states must be cleared):**

If `#btn-buy-seed` sets `localOpen=true` and the user clicks X, calling only `props.onClose()`
leaves `localOpen=true`, so `isOpen = false || true = true` — the modal stays open.
The implementer must use exactly this pattern:

```typescript
const handleClose = useCallback(function handleClose() {
  if (isBusy) return;
  props.onClose();        // clears App.storeOpen (parent-controlled path)
  setLocalOpen(false);    // clears DOM-event open path (BUG-2)
  setQuantities({ ...DEFAULT_QUANTITIES });
  setSelectedSpecies(null);
  setSeedError(null);
}, [isBusy, props.onClose]);
```

All three close call sites (backdrop `onClick`, X button `onClick`, Escape key handler)
call `handleClose()` — all three will correctly close both states.

**Preservation:** All purchase logic, species picker, quantity selector, and status display
remain exactly as-is. Only auth state and modal-open state sourcing changes.

**Only render site:** `App.tsx` — confirmed by grep; no other imports of `StoreModal`.

---

### 9. Session flow — complete state diagram

```
PAGE LOAD
  sessionStorage has KijoSession?
    YES → activeTreeId set from storage → ThreeCanvas mounts with tree → picker hidden
    NO  → activeTreeId = null → ThreeCanvas mounts as guest (seed/species from URL params)

WALLET CONNECTS (isConnected = true)
  accessToken = null?
    YES → picker visible → SIGN-IN PANEL shown
    NO  → (already authed from this session) → skip to TREE LIST

PLAYER CLICKS "Sign in with Wallet"
  useWalletAuth.signIn() → ECDSA sig → wallet-auth → accessToken + walletRowId
  → useListTrees auto-fetches → picker transitions to LOADING

LIST-TREES RESPONSE
  0 trees → ZERO-TREES PANEL → player clicks "Plant first kijonsai"
            → props.onStoreOpen() → App.setStoreOpen(true) → StoreModal opens
  1 tree  → AUTO-SELECT useEffect ([trees] dep) → selectTree(trees[0])
            → sessionStorage written → props.onTreeSelected(tree.id) [callback, not event]
            → App.setActiveTreeId → ThreeCanvas remounts with tree
  N trees → PICKER PANEL → player clicks a tree card → selectTree(chosen)
            → same callback path as above

SUCCESSFUL MINT (in StoreModal / useSeedPurchase hook)
  → sessionStorage written with tokens[0].treeId
  → localStorage.removeItem("care_log")
  → window.dispatchEvent('kijo:tree-selected', tokens[0].treeId)  [hook → window event]
  → App listener: setActiveTreeId(treeId) → ThreeCanvas remounts
  → picker is now hidden (activeTreeId is set)

PLAYER WANTS TO SWITCH TREE
  OQ-1: DEFERRED — out of scope for this release (owner decision 2026-08-07).
  The picker reappears only if activeTreeId is reset to null.
```

---

### 10. KijoSession shape — no change

The `KijoSession` interface in `persistence.ts` is **unchanged**:
```typescript
export interface KijoSession {
  tree_id: string;
  access_token: string;
  wallet_row_id: string;
}
```

Sessions are only written when all three fields are known. The picker enforces this.

`main2d.ts` and `main3d.ts` call `getSession()` (standalone pages, not in the React tree).
They are not affected by this design — they read from sessionStorage and continue to work
for any session written by either the picker or useSeedPurchase.

---

### 11. File-change summary

| File | Action | Scope |
|---|---|---|
| `apps/server/supabase/functions/list-trees/index.ts` | **CREATE** | ~70 lines |
| `apps/server/supabase/migrations/2026080TXXXXXX_trees_wallet_id_index.sql` | **CREATE** | 5 lines |
| `apps/web/src/wallet/useListTrees.ts` | **CREATE** | ~60 lines |
| `apps/web/src/components/WalletTreeSelector.tsx` | **CREATE** | ~150 lines |
| `apps/web/src/App.tsx` | **REWRITE** | 33 → ~60 lines |
| `apps/web/src/components/StoreModal.tsx` | **MODIFY** | remove `useWalletAuth()` call; add props; add `localOpen` for DOM listener |
| `apps/web/src/wallet/useSeedPurchase.ts` | **MODIFY** | add `dispatchEvent` after sessionStorage write (~3 lines) |
| `apps/web/src/persistence.ts` | **NO CHANGE** | |
| `apps/web/src/components/WalletBar.tsx` | **NO CHANGE** | |
| `apps/web/src/components/ThreeCanvas.tsx` | **NO CHANGE** | |
| `apps/web/src/main2d.ts` | **NO CHANGE** | |
| `apps/web/src/main3d.ts` | **NO CHANGE** | |

---

## ASSUMPTIONS

1. **`useWallet()` is safe to call in App.tsx.** App.tsx is rendered inside the Wagmi
   provider in `main.tsx`. Confirmed by existing WalletBar and StoreModal usage of
   `useWallet`. If this is ever moved outside the provider, all wallet hooks break.

2. **`list-trees` will return ≤50 trees per wallet for the foreseeable testnet period.**
   The `.limit(50)` in the Edge Function is acceptable for MVP. On mainnet, pagination
   will be needed (see OQ-3).

3. **The `trees.wallet_id` column is a non-nullable UUID matching `user.user_metadata.wallet_row_id`.**
   This is confirmed by seed-claim's INSERT (line 362) and care-action's ownership check
   (line 87). The new index relies on this invariant.

4. **`kijo:tree-selected` CustomEvent on `window` is used exclusively by `useSeedPurchase`**
   to cross the hook→App state boundary (DC-1). `WalletTreeSelector` uses the `onTreeSelected`
   callback prop instead (it is a React child of App; callbacks are idiomatic). The event
   must be dispatched with `detail: string` (tree UUID) and must fire AFTER both
   `sessionStorage.setItem` and `localStorage.removeItem("care_log")` (Race 4 fix).

5. **ThreeCanvas remounting on `key` change has acceptable UX cost.** The Three.js scene
   is torn down and rebuilt from scratch. For testnet with simple tree geometries this
   is imperceptible. On mainnet with complex scenes, an imperative reinit path may be
   preferred (see OQ-4).

6. **`storeOpen` state in App.tsx replacing the DOM-listener approach in StoreModal is
   acceptable.** The `#btn-buy-seed` button is rendered by ThreeCanvas (inside the Three.js
   HUD). The `localOpen` pattern in StoreModal (section 8) preserves the existing DOM-event
   path without requiring ThreeCanvas to dispatch React state changes.

---

## OPEN QUESTIONS

**OQ-1 — Switch Tree UX:** DEFERRED — owner decision 2026-08-07. Out of scope for
this release. A player locked into tree[0] after a multi-tree mint has no discoverable
switch path until this is implemented. Track as a follow-up ticket.

**OQ-2 — Auth persistence across page reload:** After a reload, `accessToken` is null
(in-memory only). The session in sessionStorage still loads the tree read-only via
ThreeCanvas, but `persistCareAction` will fail. The player must sign in again to perform
care actions. This pre-exists this design (noted in useWalletAuth.ts comment). Persisting
`access_token` to sessionStorage or using Supabase `setSession()` for auto-refresh is a
separate concern. Do not block this feature on it.

**OQ-3 — Pagination for wallets with many trees:** The `.limit(50)` is hardcoded. A player
who mints more than 50 trees will not see all of them in the picker. For testnet this is
not a concern. For mainnet, add `offset` support to `list-trees` and a "Load more" button
in `WalletTreeSelector`.

**OQ-4 — ThreeCanvas imperative reinit vs. remount:** Using `key={activeTreeId}` is
correct React but destroys and rebuilds the entire Three.js scene (renderer, geometries,
materials). If this causes visible flicker or performance issues during testing, the
implementer should extract the async init logic into a function callable via
`useImperativeHandle`, allowing reinit without unmount. This is a progressive enhancement,
not a blocker.

**OQ-5 — `WalletTreeSelector` visibility after tree is already in session:** RESOLVED by
BUG-1 fix analysis. The `showPicker = isConnected && !!accessToken && !!walletRowId && !activeTreeId`
condition is provably correct. On page reload, `activeTreeId` is initialized from sessionStorage
so `showPicker = false` even after re-authentication. Verified during critic stage.

**OQ-6 — Token ID display for legacy trees:** RESOLVED — owner decision 2026-08-07.
Trees with `token_id = NULL` display **"Legacy"** in the picker card. No alternative label needed.
