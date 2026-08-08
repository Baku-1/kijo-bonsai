# Lint Report: Multi-Mint / token_id Link Pipeline
**Stage:** LINTER
**Date:** 2026-08-07
**Pipeline run:** ARCH-MULTI-MINT-TOKENTREE-LINK (Revision 2)
**Result: WARNINGS** — style issues only; no blockers to sign-off.

---

## Files inspected

1. `apps/server/supabase/functions/seed-claim/index.ts`
2. `apps/web/src/wallet/useSeedPurchase.ts`
3. `apps/web/src/components/StoreModal.tsx`
4. `apps/server/supabase/migrations/20260806000001_trees_token_id.sql`
5. `apps/server/supabase/migrations/20260806000002_render_queue.sql`
6. `apps/server/supabase/migrations/20260806000003_seed_claims_token_ids.sql`
7. `docs/ARCH-MULTI-MINT-TOKENTREE-LINK.md` (reference, not modified)

---

## Check 1 — TypeScript / style

**`npx tsc --noEmit` (apps/web):** EXIT 0. Clean. ✅

**`any` without suppression comment:** None found.
- `enqueueRender` param `client: any` in `seed-claim/index.ts` line 72 is preceded by
  `// deno-lint-ignore no-explicit-any`. ✅

**Dead code:** None found. All declared variables (`walletRowId`, `wrid`, `isConfirmed`,
`receipt`, `settledIdx`, etc.) are consumed. ✅

**`console.log` in production paths:** Not present. Only `console.error` and `console.warn`
are used. ✅

**Magic numbers:**
- `SEED_PRICE_WEI = 3_000_000_000_000_000_000n` is named; the bare literal never appears
  outside its declaration. ✅
- `SEED_PRICE_RON = "3"` is named; used via `parseEther(SEED_PRICE_RON)`. ✅
- W1 (minor): `60_000` (receipt timeout, ms) and `202601` (Ronin Saigon chain ID) are
  bare numeric literals. Not named constants. Both are used exactly once and are
  contextually self-evident, but they depart from the "named constants" rule.
  Consistent with the arch spec's own code examples, so acceptable for testnet.
  Flag for mainnet hardening.

**`Deno.serve` pattern:** Line 116 of `seed-claim/index.ts` uses `Deno.serve(async (req) => {`.
No `serve` import from std/http. ✅

---

## Check 2 — Name consistency

### Response shape: `tokens` field

| Location | Field name used | Expected |
|---|---|---|
| `seed-claim/index.ts` line 505 — final response | `tokens:` | `tokens` ✅ |
| `seed-claim/index.ts` lines 284-289 — replay 200 | `tokens:` | `tokens` ✅ |
| `useSeedPurchase.ts` line 167 — deploy-window guard | `data.tokens` | `tokens` ✅ |
| `useSeedPurchase.ts` line 177 — filter successful | `data.tokens.filter(...)` | `tokens` ✅ |
| `ClaimResult` interface line 53 | `tokens: SuccessfulToken[]` | `tokens` ✅ |

No `mints` field appears anywhere. ✅

### Type names

The linter brief references `MintResult` as the arch-spec type name. The actual arch spec
(ARCH-MULTI-MINT-TOKENTREE-LINK.md ss8.5) defines `SuccessfulToken` and `ClaimResult`
— not `MintResult`. The linter brief was written against an earlier draft.
Implementation correctly matches the current arch spec. No code mismatch; noting
for documentation accuracy only.

W2: The linter brief's type name reference (`SuccessfulToken`) matches the current
arch spec. No code change required.

### `Submission` type (internal)

Defined at `seed-claim/index.ts` lines 330-336. Used only within the edge function.
Not present in any response shape or client type. External response serializes to
`tokens[]`. ✅

### `pendingSeedsRef`

Declared in `useSeedPurchase.ts` line 70. Used in:
- `buySeeds()` line 246-249 (write)
- Claim effect line 122 (read snapshot)
- Claim effect line 111 (guard: `.length === 0`)

`StoreModal.tsx` does not reference `pendingSeedsRef` directly; it interacts only
through `buySeeds()` and the returned `claimResult`. No cross-file naming conflict. ✅

### Migration column names vs. edge function INSERT

| Column | Migration declaration | seed-claim INSERT field |
|---|---|---|
| `trees.token_id` | `BIGINT UNIQUE` (migration 1) | `token_id: Number(tokenId)` line 366 ✅ |
| `render_queue.token_id` | `BIGINT NOT NULL` (migration 2) | `token_id: tokenId` via `enqueueRender` line 78 ✅ |
| `render_queue.tree_id` | `UUID NOT NULL REFERENCES public.trees(id)` | `tree_id: treeId` line 78 ✅ |
| `render_queue.trigger` | `TEXT CHECK (trigger IN ('mint','prune','wire','tick'))` | `trigger` param = `'mint'` line 479 ✅ |
| `seed_claims.token_ids` | `BIGINT[]` (migration 3) | `.update({ token_ids: mintedIds })` line 490 ✅ |
| `seed_claims.token_ids` | select | `.select('token_ids, count')` line 264 ✅ |

All snake_case. All match. ✅

### `render_queue` trigger value

`enqueueRender` is called with `'mint'` (line 479). The CHECK constraint includes
`'mint'`. Exact match; lowercase. ✅

### `seed_claims.token_ids` (plural)

Column is `token_ids` (plural) in migration 3 and in both the UPDATE (line 490) and
the SELECT (line 264) in `seed-claim`. ✅

---

## Check 3 — SQL style

**snake_case column names:** All columns in all three migrations are snake_case. ✅

**`IF NOT EXISTS` idempotency:**

| Statement | IF NOT EXISTS |
|---|---|
| Migration 1 `ADD COLUMN` | ✅ |
| Migration 1 `CREATE INDEX` | ✅ |
| Migration 2 `CREATE TABLE` | ✅ |
| Migration 2 `CREATE INDEX` | ✅ |
| Migration 3 `ADD COLUMN` | ✅ |

**FK reference:** `render_queue.tree_id UUID NOT NULL REFERENCES public.trees(id)`.
Correct PK column (`id`, not `uuid` or `token_id`). ✅

**`BIGINT` for token_id columns:**

| Column | Type |
|---|---|
| `trees.token_id` | `BIGINT` ✅ |
| `render_queue.token_id` | `BIGINT` ✅ |
| `seed_claims.token_ids` | `BIGINT[]` ✅ |

No INT4 used for any token-ID column. ✅

**W3 — `render_queue.updated_at` has no auto-update trigger.**
The column is declared `TIMESTAMPTZ NOT NULL DEFAULT now()` and is correctly set
on INSERT. However there is no `BEFORE UPDATE` trigger to set `updated_at = now()`
when the render worker changes `status` or `attempts`. The column will remain at
the INSERT timestamp forever unless the worker explicitly includes `updated_at` in
its UPDATE statement. This is a missing-trigger gap, not a blocking schema error,
but it makes observability harder (you cannot tell when a job last transitioned
state from the column alone). Recommend adding a trigger in a follow-up migration
or documenting that the worker must set `updated_at` explicitly.

---

## Check 4 — Comments / docs

**Numbered sections 0–9 in `seed-claim/index.ts`:**

| Section | Header text | Present |
|---|---|---|
| 0 | JWT verification | line 122 ✅ |
| 1 | Parse and validate request body | line 140 ✅ |
| 2 | Resolve caller's Ronin wallet address | line 192 ✅ |
| 3 | Payment verification | line 215 ✅ |
| 4 | Setup wallet/public client and fetch base nonce | line 305 ✅ |
| 5 | Mint loop | line 328 ✅ |
| 6 | Parallel receipt wait | line 441 ✅ |
| 7 | Enqueue render jobs | line 476 ✅ |
| 8 | Update seed_claims with minted token_ids | line 485 ✅ |
| 9 | Response | line 499 ✅ |

All 10 sections present and in order. ✅

**Migration header comments:**

| File | Header | Quality |
|---|---|---|
| 20260806000001_trees_token_id.sql | Multi-line block with rationale, NULL semantics, backfill note | ✅ Thorough |
| 20260806000002_render_queue.sql | Single-line + reference to NFT-METADATA-IMAGE-ARCH.md | ✅ Adequate |
| 20260806000003_seed_claims_token_ids.sql | Single-line explaining change + NULL semantics | ✅ Adequate |

---

## Warning summary

| # | Severity | File | Issue |
|---|---|---|---|
| W1 | Minor | `seed-claim/index.ts` | `60_000` (timeout ms) and `202601` (chain ID) are unnamed literals. Flag for mainnet. |
| W2 | Minor | Linter brief | Brief updated to reference `SuccessfulToken` (arch spec ss8.5). Was stale `MintResult`. Resolved. |
| W3 | Warning | `20260806000002_render_queue.sql` | `updated_at` column has no auto-update trigger. Render worker must explicitly `SET updated_at = now()` in UPDATE, or a follow-up migration should add the trigger. |

---

## Sign-off

**Result: WARNINGS** — three style/ops notes, none blocking.

tsc exits 0. All name-consistency checks pass. All SQL checks pass. All section
comments present. No `console.log`, no bare magic numbers on the critical path,
no dead code.

Recommend: W3 (missing updated_at trigger) should be tracked as a follow-up
ticket before the render worker is built, so the migration can be added while
the table is still empty.

Pipeline is clear to proceed to Jeremy's final review.
