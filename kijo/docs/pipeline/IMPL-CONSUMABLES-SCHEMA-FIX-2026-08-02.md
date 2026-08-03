# IMPL-CONSUMABLES-SCHEMA-FIX-2026-08-02

**Date:** 2026-08-02  
**Author:** Implementer (Claude / Cowork)  
**Status:** DONE — awaiting Jeremy deploy  
**Skill pipeline used:** disciplined-implementer, engineering-craft-standard, carmack-linus-review

---

## OUTCOME: DONE

Edge Functions `seed-tree` and `care-action` both referenced wrong column names on the
`consumables` table. Both files are corrected. No deploy — Jeremy deploys manually.

---

## DONE WHEN (defined before editing)

Both files edited such that:
1. `seed-tree` inserts `{ wallet_id, item_type, quantity }` (not `{ tree_id, type, quantity }`)
2. `seed-tree` handles second-mint idempotently (no duplicate-key error)
3. `care-action` queries `.eq('wallet_id', wallet_row_id).eq('item_type', consumableType)`

Verified by: re-reading both files post-edit and grepping for every `consumables`-related
column reference to confirm no stray wrong names remain.

---

## INTENT CHECK

```
code does:     seed-tree inserted { tree_id, type, quantity }; care-action queried
               .eq('tree_id', tree_id).eq('type', consumableType)

check expects: consumables table columns are wallet_id, item_type (confirmed via
               information_schema query against project xutjubkaskwchzyzwryk)

spec says:     consumables are per-wallet, not per-tree; item_type and wallet_id
               are the correct column names per DB schema

verdict:       CONFLICT — code used wrong column names; unique constraint
               consumables_wallet_id_item_type_key on (wallet_id, item_type)
               was confirmed, enabling safe upsert for the duplicate guard
```

---

## DB SCHEMA VERIFIED (Supabase MCP, project xutjubkaskwchzyzwryk)

Constraints on `public.consumables`:

| Constraint name                       | Type        | Columns              |
|---------------------------------------|-------------|----------------------|
| consumables_pkey                      | PRIMARY KEY | id                   |
| consumables_wallet_id_fkey            | FOREIGN KEY | wallet_id            |
| consumables_wallet_id_item_type_key   | UNIQUE      | wallet_id, item_type |

Unique constraint on `(wallet_id, item_type)` confirms upsert with
`onConflict: 'wallet_id,item_type', ignoreDuplicates: true` is safe and atomic.

---

## WHAT CHANGED

### File 1: `apps/server/supabase/functions/seed-tree/index.ts`

**Lines 127–138 (seed-tree section 3 — consumable insert)**

Before:
```typescript
const consumableRows = STARTER_CONSUMABLE_TYPES.map((type) => ({
  tree_id,
  type,
  quantity: 0,
}));

const { error: consumableErr } = await serviceClient
  .from('consumables')
  .insert(consumableRows);
```

After:
```typescript
// wallet_row_id is the FK into consumables.wallet_id.
// Upsert is idempotent: if the wallet already has rows (second tree minted),
// the unique constraint on (wallet_id, item_type) makes ignoreDuplicates safe.
const consumableRows = STARTER_CONSUMABLE_TYPES.map((itemType) => ({
  wallet_id: wallet_row_id,
  item_type: itemType,
  quantity: 0,
}));

const { error: consumableErr } = await serviceClient
  .from('consumables')
  .upsert(consumableRows, { onConflict: 'wallet_id,item_type', ignoreDuplicates: true });
```

Changes:
- `tree_id` → `wallet_id: wallet_row_id` (`wallet_row_id` is already in scope from body destructuring on line 63)
- `type` → `item_type: itemType` (renamed loop variable to `itemType` to avoid shadowing)
- `.insert()` → `.upsert(..., { onConflict: 'wallet_id,item_type', ignoreDuplicates: true })` for idempotent second-mint

Note: `tree_id` on lines 142 and 147 (cleanup delete + return value) are on the `trees`
table and the response body respectively — both correct, not touched.

---

### File 2: `apps/server/supabase/functions/care-action/index.ts`

**Lines 157–158 (care-action section 4 — consumable lookup)**

Before:
```typescript
.eq('tree_id', tree_id)
.eq('type', consumableType)
```

After:
```typescript
.eq('wallet_id', wallet_row_id)
.eq('item_type', consumableType)
```

Changes:
- `.eq('tree_id', tree_id)` → `.eq('wallet_id', wallet_row_id)` (`wallet_row_id` is already in scope from body destructuring on line 68)
- `.eq('type', consumableType)` → `.eq('item_type', consumableType)`

No other logic changed. The quantity check, decrement, and atomic guard all operate on
`consumableRow.id` (the primary key), so they are unaffected.

---

## VERIFIED BY OBSERVATION

Grep across both files post-edit confirmed:

**seed-tree — consumables block:**
- `wallet_id: wallet_row_id` ✅
- `item_type: itemType` ✅
- `.upsert(consumableRows, { onConflict: 'wallet_id,item_type', ignoreDuplicates: true })` ✅
- Remaining `tree_id` references (lines 120, 142, 147) are all on the `trees` table or the HTTP response — correct ✅

**care-action — consumables block:**
- `.eq('wallet_id', wallet_row_id)` ✅
- `.eq('item_type', consumableType)` ✅
- Remaining `tree_id` references are: body field destructuring (line 68), trees-table queries (lines 85, 143), RPC parameters (`p_tree_id` lines 127, 179) — all correct ✅
- `action?.type` (line 69) references the HTTP request body field, not a DB column — correct ✅

No other references to wrong column names remain in either file.

---

## CAVEATS

- **Not deployed.** Jeremy deploys manually via Supabase CLI. Functions are edited only.
- **Not integration-tested.** Cannot call the live Edge Functions from this session.
  Functional correctness was verified by static analysis (column name matching against
  confirmed schema).
- **`ignoreDuplicates: true` behavior:** When a duplicate is ignored by Supabase's upsert,
  the existing row (with its current `quantity`) is preserved. This is the desired behavior —
  a second mint should not reset a wallet's consumable quantity back to 0.
- **No DECISIONS.md or STATE.md update performed** — this is a pure bug fix with no new
  design decisions; the schema was already the authority.
