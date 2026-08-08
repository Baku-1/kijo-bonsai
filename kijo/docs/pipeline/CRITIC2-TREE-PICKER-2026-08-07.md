# CRITIC2-TREE-PICKER-2026-08-07

**Stage:** CRITIC — Second Pass  
**Date:** 2026-08-07  
**Author:** critic stage (second pass)  
**Spec reviewed:** `docs/pipeline/ARCH-TREE-PICKER-2026-08-07.md` Rev 2  
**Prior critic:** `docs/pipeline/CRITIC-TREE-PICKER-2026-08-07.md`  
**Status:** APPROVED FOR IMPLEMENTER — one stale reference noted (non-blocking)

---

## VERDICT

All 9 required fixes from the first critic pass are correctly applied. The `onTreeSelected` prop threading in App.tsx is complete and type-safe. The `useListTrees` rename is internally consistent. One residual stale reference was introduced during patching (Section 11 table, non-blocking). No new bugs found.

---

## FIX VERIFICATION — ALL 9 CONFIRMED

| Fix | Location in Rev 2 | Status |
|---|---|---|
| **BUG-1** `showPicker` includes `!!walletRowId` | Section 7: `const showPicker = isConnected && !!accessToken && !!walletRowId && !activeTreeId;` | ✅ APPLIED |
| **BUG-2** `handleClose` calls both `props.onClose()` AND `setLocalOpen(false)` | Section 8: both calls present in `useCallback`, with comments naming each responsibility | ✅ APPLIED |
| **BUG-3** `const [open, setOpen]` deleted; DOM handler → `() => setLocalOpen(true)` | Section 8: "deleted entirely"; handler comment reads `// BUG-3: was setOpen(true)` | ✅ APPLIED |
| **GAP-1** Auto-select `useEffect` has `[trees]` dep, early returns for null and length !== 1 | Section 5: both early returns present before `selectTree(trees[0])`; dep array is `[trees]` | ✅ APPLIED |
| **GAP-2** Migration filename is `20260807000002_trees_wallet_id_index.sql` | Section 3: filename correct; sequential counter evidence cited | ✅ APPLIED |
| **Race 4** `localStorage.removeItem("care_log")` precedes `dispatchEvent` | Section 6: removal line marked `// ← must precede dispatch`; event fires after | ✅ APPLIED |
| **DC-1** `WalletTreeSelector` uses `onTreeSelected(treeId: string)` callback; DOM event reserved for `useSeedPurchase` | Section 5 props + `selectTree` body: `props.onTreeSelected(tree.id)` with explicit comment "No window.CustomEvent here"; DOM event only in Section 6 | ✅ APPLIED |
| **DC-2** `useListTrees` second param renamed to `_walletReady` with explanatory comment | Section 4: renamed; four-line comment explains fetch-gate semantics | ✅ APPLIED |
| **OQ-6** RESOLVED; "Legacy" label confirmed | Section 5 picker card + Open Questions: `OQ-6 (RESOLVED)` block present | ✅ APPLIED |
| **OQ-1** DEFERRED | Open Questions: explicit DEFERRED with owner decision date | ✅ APPLIED |

---

## NEW ISSUES CHECK

### `onTreeSelected` prop threading — CORRECT

App.tsx passes `onTreeSelected={setActiveTreeId}`. TypeScript compatibility is valid: `Dispatch<SetStateAction<string | null>>` accepts a `string` argument, satisfying `(treeId: string) => void`. All seven `WalletTreeSelectorProps` fields are present in the JSX call site. No missing prop.

### `useListTrees` rename consistency — CONSISTENT

The rename to `_walletReady` is explained in Section 4's comment block and is not referenced elsewhere under the old name `walletRowId` in hook-parameter context. The WalletTreeSelector prop is still named `walletRowId` (correctly — it IS walletRowId conceptually at the call site; the rename is only at the hook's parameter boundary). No contradiction.

### Internal contradictions from patching — ONE FOUND (non-blocking)

**Section 11 file-change table has stale migration filename.**

Section 3 (correctly patched): `20260807000002_trees_wallet_id_index.sql`  
Section 11 table (not updated): `2026080TXXXXXX_trees_wallet_id_index.sql`

This is a documentation inconsistency only. The correct filename is unambiguous from Section 3 and Section 3's sequential-counter evidence. An implementer scanning only the table would see the placeholder. The implementer must use the Section 3 filename.

**Severity:** Non-blocking. The implementer is told to create the file described in Section 3; the table is a summary, not an authoritative filename source.

---

## ADDITIONAL OBSERVATIONS (pre-existing, not introduced by patch)

These existed in Rev 1 and are noted for completeness — they do not block implementation.

**WalletTreeSelector does not receive `isConnected` as a prop.** The state machine in Section 5 lists `isConnected = false → null` as the first branch, but `isConnected` is not in `WalletTreeSelectorProps`. Since `showPicker` in App.tsx already gates on `isConnected`, this branch is unreachable when the component is mounted via App.tsx. The implementer can either omit this branch entirely or call `useWallet()` internally as a defensive measure. Either is acceptable.

**`useListTrees` call site inside `WalletTreeSelector.tsx` body is not shown.** Section 4 implies `useListTrees(accessToken, walletRowId)` from context, and Section 4's comment confirms "Callers pass walletRowId." Inferable but not explicit. Low risk.

---

## SUMMARY

All required fixes verified. One stale filename in Section 11 table (use Section 3 filename: `20260807000002_trees_wallet_id_index.sql`). No new correctness issues. The spec is ready for the implementer.
