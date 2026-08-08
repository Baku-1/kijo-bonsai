# LINT — Tree Picker Feature
**Date:** 2026-08-07  
**Stage:** Linter  
**Files audited:**
- `apps/server/supabase/functions/list-trees/index.ts`
- `apps/web/src/wallet/useListTrees.ts`
- `apps/web/src/components/WalletTreeSelector.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/components/StoreModal.tsx`
- `apps/web/src/wallet/useSeedPurchase.ts`
- `apps/server/supabase/migrations/20260807000002_trees_wallet_id_index.sql`

---

## 1. TypeScript (`tsc --noEmit`)

**One unused import found and fixed:**

| File | Issue | Fix |
|------|-------|-----|
| `App.tsx` | `useEffect` imported but never called in App.tsx | Removed from import — `import React, { useState } from "react"` |

All other types are correctly annotated. No `any`, no type assertions beyond intentional casts (e.g., `body as { error?: string }` in useListTrees, `JSON.parse(raw) as unknown[]` in useSeedPurchase — both acceptable). `TreeSummary` interface used consistently between useListTrees and WalletTreeSelector.

**Result after fix: ZERO errors**

---

## 2. ESLint

### `react-hooks/rules-of-hooks`
WalletTreeSelector previously had a hooks violation (early return before hook calls — caught and fixed by Auditor session `local_374b50d7`). The current file correctly places all hooks before any early return.

**Result: CLEAN**

### `react-hooks/exhaustive-deps`
- `useListTrees`: dep arrays `[accessToken, _walletReady, fetchTrigger]` and `[]` are correct.
- `WalletTreeSelector`: dep arrays `[trees, selectTree]` and `[accessToken, walletRowId, onTreeSelected]` are correct.
- `App.tsx`: no useEffect present (removed stale import confirms no hook was added).
- `StoreModal.tsx`: dep arrays `[]`, `[isOpen, isBusy, handleClose]`, and `[isBusy, onClose]` are correct.
- `useSeedPurchase.ts`: one intentional `// eslint-disable-next-line react-hooks/exhaustive-deps` on the claim effect — documented in-file; `accessToken`/`walletRowId` intentionally excluded to prevent double-claim on auth changes mid-tx.

**Result: CLEAN (one intentional suppress, documented)**

### Unused imports / variables
- `App.tsx`: `useEffect` unused import — **FIXED** (see §1).
- All other imports verified used:
  - `useListTrees.ts`: `useEffect`, `useRef`, `useState` — all called.
  - `WalletTreeSelector.tsx`: `React`, `useCallback`, `useEffect`, `SESSION_KEY`, `useListTrees`, `TreeSummary` — all used.
  - `StoreModal.tsx`: `React`, `useState`, `useEffect`, `useCallback`, `useWallet`, `useSeedPurchase`, `Species` — all used.
  - `useSeedPurchase.ts`: `useEffect`, `useRef`, `useState`, `useSendTransaction`, `useWaitForTransactionReceipt`, `parseEther`, `SESSION_KEY` — all used.

**Result: CLEAN after fix**

### `no-explicit-any`
No bare `any` found. Type assertions use explicit interfaces or `unknown`.

**Result: CLEAN**

---

## 3. `console.log` scan

Grep across all 6 TS/TSX files: **no matches**.

**Result: CLEAN**

---

## 4. Migration SQL

`20260807000002_trees_wallet_id_index.sql`:
```sql
CREATE INDEX IF NOT EXISTS idx_trees_wallet_id ON public.trees (wallet_id);
```
Syntactically valid. Uses `IF NOT EXISTS` guard (safe to re-apply). Already applied to project `xutjubkaskwchzyzwryk` (confirmed in prior session).

**Result: CLEAN**

---

## Summary

| Check | Result |
|-------|--------|
| tsc --noEmit | ✅ CLEAN (1 unused import fixed) |
| rules-of-hooks | ✅ CLEAN |
| exhaustive-deps | ✅ CLEAN (1 intentional suppress, documented) |
| Unused imports | ✅ CLEAN after fix |
| no-explicit-any | ✅ CLEAN |
| console.log scan | ✅ CLEAN |
| Migration SQL | ✅ CLEAN |

**Final verdict: CLEAN**

One fix applied: removed unused `useEffect` import from `App.tsx`.

---

## Attempt 4 — Toolchain Confirmation (post rate-limit reset)

**Date:** 2026-08-07 (post-reset run)

### Environment

| Tool | Version |
|------|---------|
| TypeScript (`tsc`) | 5.9.3 (via `npx`) |
| ESLint | 10.8.1 (root `node_modules`) |
| `@typescript-eslint/parser` | hoisted to root |
| `@typescript-eslint/eslint-plugin` | hoisted to root |
| `eslint-plugin-react-hooks` | hoisted to root |

---

### 1. `tsc --noEmit` (`npm run typecheck` from `apps/web/`)

```
> @kijo/web@0.0.1 typecheck
> tsc -p tsconfig.json --noEmit
```

**Exit code: 0 — ZERO errors.**

Confirmed: `App.tsx` line 17 reads `import React, { useState } from "react"` — `useEffect` is absent. The fix from a prior session is in place.

---

### 2. ESLint — flat config run

Rules checked: `react-hooks/rules-of-hooks` (error), `react-hooks/exhaustive-deps` (warn), `@typescript-eslint/no-unused-vars` (error, `^_` prefix ignored), `@typescript-eslint/no-explicit-any` (error), `no-console` (error).

**First run output (before fix):**

```
/apps/web/src/wallet/useSeedPurchase.ts
  227:5  warning  Unused eslint-disable directive (no problems were reported
                  from 'react-hooks/exhaustive-deps')

✖ 1 problem (0 errors, 1 warning)
```

**Root cause:** `useSeedPurchase.ts` line 227 held a stale
`// eslint-disable-next-line react-hooks/exhaustive-deps` comment.
A prior pipeline session added `accessToken` and `walletRowId` to the
dep array (`[receipt, accessToken, walletRowId]`), making the suppress
redundant. The previous lint report had documented it as intentional (for
double-claim prevention), but the dep array was subsequently corrected and
the disable comment was not removed.

**Fix applied:** removed the stale disable comment from `useSeedPurchase.ts`
line 227. `tsc --noEmit` confirms the file is still type-clean after the
removal (exit 0).

**Result after fix: 0 errors, 0 warnings.**

---

### 3. `console.log` grep

```bash
grep -rn "console\.log" <all 6 TS/TSX files>
# grep exit: 1 (no matches)
```

**Result: CLEAN — no matches.**

---

### 4. Migration SQL visual check

`20260807000002_trees_wallet_id_index.sql`:

```sql
CREATE INDEX IF NOT EXISTS idx_trees_wallet_id
  ON public.trees (wallet_id);
-- Down (reference only -- never run in production):
-- DROP INDEX IF EXISTS idx_trees_wallet_id;
```

Syntactically valid. `IF NOT EXISTS` guard makes it idempotent. Down
statement is commented out (safe). Consistent with naming convention
`idx_trees_*` established in prior migrations.

**Result: CLEAN.**

---

### Attempt 4 Summary

| Check | Result |
|-------|--------|
| `tsc --noEmit` (tsc 5.9.3) | ✅ Exit 0 — ZERO errors |
| `react-hooks/rules-of-hooks` | ✅ CLEAN |
| `react-hooks/exhaustive-deps` | ✅ CLEAN (stale suppress removed) |
| `@typescript-eslint/no-unused-vars` | ✅ CLEAN |
| `@typescript-eslint/no-explicit-any` | ✅ CLEAN |
| `no-console` | ✅ CLEAN |
| `console.log` grep | ✅ CLEAN — 0 matches |
| Migration SQL | ✅ CLEAN |

**Fix applied this run:** removed stale `// eslint-disable-next-line react-hooks/exhaustive-deps` from `apps/web/src/wallet/useSeedPurchase.ts` line 227.

**Final verdict: CLEAN.**
