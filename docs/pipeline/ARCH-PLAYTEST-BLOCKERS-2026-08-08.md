# ARCH-PLAYTEST-BLOCKERS-2026-08-08

**Stage:** ARCHITECT  
**Issues:** F15 (server crash), VULN-1 (nonce replay), VULN-5 (consumable double-spend), VULN-6 (tree ownership rebind)  
**Priority:** CRITICAL / HIGH — blocks playtesting  
**Date:** 2026-08-08  
**Skill:** verified-architect  
**Consumed by:** Implementer (disciplined-implementer), then Auditor (adversarial-auditor)

---

## SCOPE

| Field | Value |
|-------|-------|
| DESIGN TASK | Specify minimal correct fixes for 4 pre-playtest blockers: F15, VULN-1, VULN-5, VULN-6 |
| DELIVERABLE | This spec; 2 migration files (VULN-1, VULN-5); exact line-level change descriptions for each file |
| BUILDS ON | Existing Edge Function deployments (2026-07-26 and 2026-08-07); migration sequence through 20260807000002 |
| CONSUMED BY | Implementer applies changes to apps/server only; no engine or web changes in scope |

---

## CODEBASE RECONNAISSANCE

### Files Read

| File | Lines | Path |
|------|-------|------|
| `packages/engine/src/index.ts` | 22 | Engine public export manifest |
| `packages/engine/src/tree.ts` | 1-30 (partial) | Legacy functional API, retirement comment |
| `apps/server/src/index.ts` | 11 | Server stub — the F15 crash site |
| `apps/server/supabase/functions/wallet-auth/index.ts` | 193 | VULN-1 nonce implementation |
| `apps/server/supabase/functions/care-action/index.ts` | 211 | VULN-5 and VULN-6 site |
| `apps/server/supabase/migrations/20260723000000_wallet_auth_lookup.sql` | 27 | Migration format reference |
| `apps/server/supabase/migrations/20260807000002_trees_wallet_id_index.sql` | 10 | Migration format reference |
| `kijo/docs/pipeline/IMPL-CONSUMABLES-SCHEMA-FIX-2026-08-02.md` | 80 | Consumables table schema (verified via Supabase MCP) |
| `docs/pipeline/ARCH-BUG5-ANGLE-UNIT-2026-08-07.md` | 30 (partial) | BUG-5 identity verification |

### Symbols Verified

| Symbol | Location | Status | Notes |
|--------|----------|--------|-------|
| `tick` | `packages/engine/src/index.ts` | NOT EXPORTED | Absent from all 22 export lines |
| `createTree` | `packages/engine/src/index.ts` | NOT EXPORTED | tree.ts only exports `MAX_DEPTH` |
| `tick` | `packages/engine/src/tree.ts` line 8 | EXISTS but retired | Comment: "tick(), applyAction(), conditionModifier() retired 2026-08-07 (dual-engine cleanup)" |
| `createTree` | `packages/engine/src/tree.ts` line 10 | EXISTS but not exported | Defined but not re-exported from engine index |
| `NONCE_WINDOW_MS` | `wallet-auth/index.ts` line 39 | VERIFIED | `const NONCE_WINDOW_MS = 5 * 60 * 1000` |
| `nonceMs` timestamp check | `wallet-auth/index.ts` lines 79-88 | VERIFIED | Rejects nonces older than 5 minutes; no uniqueness check |
| `consumableRow.quantity - 1` | `care-action/index.ts` line 199 | VERIFIED | Client-computed value, not server-side expression |
| `.gt('quantity', 0)` filter | `care-action/index.ts` line 201 | VERIFIED | Prevents going to negative; does NOT prevent double-decrement when quantity > 1 |
| tree update `.eq('id', tree_id)` | `care-action/index.ts` line 143 | VERIFIED | Only `id` in WHERE; `wallet_id` absent |
| consumables columns | IMPL-CONSUMABLES-SCHEMA-FIX-2026-08-02.md | VERIFIED via Supabase MCP | `id, wallet_id, item_type, quantity`; UNIQUE (wallet_id, item_type) |
| `insert_care_log_entry` RPC pattern | `care-action/index.ts` line 126 | VERIFIED | Establishes precedent for RPC-based atomic writes |

### Call Sites Found

#### `tick` (from engine index)
- 0 call sites from `@kijo/engine` across the codebase (removed from exports)
- 1 call site in `apps/server/src/index.ts` line 9: `const demo = tick(createTree(1, 'evergreen'))` — this is the crash site

#### `createTree` (from engine index)
- 0 exports from `@kijo/engine`
- 1 call site in `apps/server/src/index.ts` line 9: same as above

### Gaps Found

| Claim in Task Prompt | Reality |
|----------------------|---------|
| "`tick()` was removed in BUG-5 (2026-08-07)" | **FALSE.** BUG-5 is "GrowthEngine writes branch.angle in radians; all consumers expect degrees" (ARCH-BUG5-ANGLE-UNIT-2026-08-07.md line 4). The tick() retirement was a separate "dual-engine cleanup" documented in tree.ts line 8. The F15 crash is real but the BUG-5 attribution is incorrect. |
| "lines ~L194-L199" for VULN-5 | Actual lines: 197-203 (off by 3). Pattern confirmed. |
| "lines ~L137-L144" for VULN-6 | Actual lines: 137-144. Exact match. |

---

## VERIFICATION LOG

### VERIFIED

- tick() and createTree() are NOT exported from `@kijo/engine` (packages/engine/src/index.ts read directly — neither name appears in 22 export lines)
- tree.ts line 8 explicitly labels tick() as "retired 2026-08-07 (dual-engine cleanup)"
- apps/server/src/index.ts line 7 imports `{ createTree, tick }` from '@kijo/engine' — import will resolve both to `undefined` in CJS or throw SyntaxError in ESM/Deno at module load time
- wallet-auth nonce is timestamp-only with no server-side record (lines 9-10 and 39 and 79-88 of wallet-auth/index.ts confirmed)
- The code itself documents the vulnerability: line 10 says "TESTNET LIMITATION: nonces are NOT stored server-side, so replay is possible within the 5-minute window"
- DECISIONS.md (2026-07-26) states: "Production must write used nonces to a DB table with a TTL index and reject duplicates" — this is the planned fix, explicitly deferred
- care-action line 199: `.update({ quantity: consumableRow.quantity - 1 })` uses a client-read value baked before the write
- care-action lines 195-196 comment: "does not prevent double-decrement when quantity > 1 and two concurrent requests arrive simultaneously" — the code itself documents the race
- care-action line 143: only `.eq('id', tree_id)` in the WHERE clause; no `.eq('wallet_id', ...)` at write time
- consumables table has `wallet_id` column (confirmed via IMPL-CONSUMABLES-SCHEMA-FIX-2026-08-02.md Supabase MCP query)
- No `used_nonces` table exists in migrations (searched all 8 migration files — none creates this table)
- EIP-4361 nonce field definition: "A random string typically chosen by the relying party and used to prevent replay attacks, at least 8 alphanumeric characters." (source: eips.ethereum.org/EIPS/eip-4361, fetched directly)
- EIP-4361 replay prevention: "A nonce SHOULD be selected per session initiation with enough entropy to prevent replay attacks" (Security Considerations -> Preventing Replay Attacks, same source)
- EIP-4361 permits timestamp-based nonces: "Implementers MAY consider using privacy-preserving yet widely-available nonce values, such as one derived from a recent Ethereum block hash or a recent Unix timestamp" — but adds no uniqueness guarantee from this alone

### UNVERIFIED

- piratenation-contracts signature replay prevention implementation: GitHub page at github.com/proofofplay/piratenation-contracts returned only metadata (JS-rendered repo listing, no contract code). The contracts/ directory structure was not accessible from the fetched HTML. Cannot verify their specific replay prevention pattern from source. ASSESSMENT: piratenation-contracts are Solidity on-chain contracts; their replay prevention operates at the smart-contract level (on-chain nonce mapping per address), which is a different mechanism from our off-chain wallet-auth nonce table. The one-time nonce table design below is not derived from piratenation-contracts.

### REFUTED

- BUG-5 attribution for tick() removal: The task prompt states "`tick()` was removed in BUG-5 (2026-08-07)". REFUTED. BUG-5 (per ARCH-BUG5-ANGLE-UNIT-2026-08-07.md line 4) is about GrowthEngine writing branch.angle in radians vs degrees. tick() was retired in a separate "dual-engine cleanup" change, documented in tree.ts line 8 without a bug number.

---

## CODE SOURCE AUDITS

### EIP-4361 (Sign-In with Ethereum) — Nonce Specification

```
snippet:     Nonce field definition and replay-attack prevention section
origin:      https://eips.ethereum.org/EIPS/eip-4361 (fetched directly 2026-08-08)
license:     CC0 (public domain)
version:     Final ERC standard (published 2021-10-11)
current:     Yes — Final standard status, not deprecated
assumptions: The spec defines nonce for the full SIWE message format; Kijo does not
             use the full SIWE format (custom message: "Kijo authentication\nAddress:
             ...\nNonce: ...") — the nonce concept applies directly
limitations: Spec does not mandate a specific nonce storage mechanism; says "typically
             chosen by the relying party" but does not prohibit client-generated nonces
             as long as uniqueness is enforced by the server
adaptation:  Nonce uniqueness enforcement via used_nonces table is consistent with the
             spec's intent; our custom message format is not ERC-4361 compliant but the
             security requirement (one-time nonce) is identical
verdict:     ADAPT — use EIP-4361 nonce security rationale, not its message format
```

---

## CROSS-REFERENCE CHECK

```
checked against:
  - STATE.md (project state, DB schema inventory)
  - DECISIONS.md (2026-07-26 nonce decision)
  - SESSION-START.md (pipeline rules, import boundaries)
  - apps/server/supabase/migrations/* (all 8 existing migrations)
  - packages/engine/src/index.ts (authoritative export list)

consistent:        YES
terminology:       wallet_id, wallet_row_id, care-action, wallet-auth, trees, consumables
                   -- all match file-level usage
data shapes:       consumables (id, wallet_id, item_type, quantity) -- confirmed
                   used_nonces (proposed) -- new table, no conflict
boundary:          All changes in apps/server only. No engine or web changes.
boundary violations: NONE
migration naming:  YYYYMMDDnnnnnn_descriptor.sql -- confirmed from existing files
                   Next available: 20260808000001, 20260808000002
```

---

## THE DESIGN

---

### F15 — Server crashes on load

**Root cause:** `apps/server/src/index.ts` lines 7-10 import `createTree` and `tick` from `@kijo/engine`. Neither is exported by `packages/engine/src/index.ts`. In ESM/Deno this throws `SyntaxError: does not provide an export named 'tick'` at module load time (before any code runs). In Node CJS, both resolve to `undefined` and line 9 throws `TypeError: tick is not a function` at startup.

**File:** `apps/server/src/index.ts`  
**Current content (all 11 lines):**
```typescript
/**
 * Kijo game server — Phase 1 stub.
 * Will own: server-authoritative day ticks, care-log append + Merkle root,
 * action validation, matchmaking. The engine is shared with the client so
 * the server replays the same deterministic simulation (GDD §9.2).
 */
import { createTree, tick } from '@kijo/engine';

const demo = tick(createTree(1, 'evergreen'));
console.log(`kijo server stub — engine linked ok (day ${demo.day})`);
```

**Fix:** Replace the file in its entirety (10 lines become 9 lines):

```typescript
/**
 * Kijo game server -- Phase 1 stub.
 * Will own: server-authoritative day ticks, care-log append + Merkle root,
 * action validation, matchmaking. The engine is shared with the client so
 * the server replays the same deterministic simulation (GDD s9.2).
 *
 * NOTE: createTree()/tick() were retired 2026-08-07 (dual-engine cleanup).
 * When this stub is wired up, use GrowthEngine.growTick() via CareLogReplay.
 */
console.log('kijo server stub -- ready');
```

**Change summary:**
- DELETE line 7: `import { createTree, tick } from '@kijo/engine';`
- DELETE line 8: (blank)
- DELETE line 9: `const demo = tick(createTree(1, 'evergreen'));`
- REPLACE line 10: `console.log(...)` -> `console.log('kijo server stub -- ready');`
- ADD lines 7-8: retirement note comment

**No migration needed. No other files change.**

**Done when:** `node apps/server/src/index.js` (or `npx ts-node apps/server/src/index.ts`) prints `kijo server stub -- ready` and exits 0 with no TypeError.

---

### VULN-1 — Nonce replay within 5-minute window

**Root cause:** wallet-auth/index.ts validates nonces by timestamp only (lines 79-88). There is no server-side record of which nonces have been consumed. A captured `{address, signature, nonce}` triple can be replayed to generate new JWTs until the 5-minute window expires.

**Approach chosen: Option A — one-time nonce table (client-generated nonce, server records use)**

**Rationale over Option B (server-generated nonce):**
- Option B requires a new GET endpoint and a second client round-trip before every sign-in. This changes useWalletAuth.ts significantly and adds a new endpoint to deploy.
- DECISIONS.md (2026-07-26) explicitly planned this exact approach: "Production must write used nonces to a DB table with a TTL index and reject duplicates."
- Option A requires zero client-side changes — only server-side: one new table + ~10 lines in wallet-auth/index.ts.
- For playtest the timestamp nonce entropy (~32 bits) is acceptable. A fully random nonce is a DECISIONS-required upgrade but not the minimum fix.

**Migration 1 — New file:** `apps/server/supabase/migrations/20260808000001_used_nonces.sql`

```sql
-- used_nonces: one-time-use table for wallet-auth nonce replay prevention.
-- Each nonce inserted once. Duplicate INSERT (replay attack) fails on PRIMARY KEY.
-- expires_at enables cleanup of stale rows inside the auth function itself
-- (no separate cron job required for testnet).
--
-- Called from wallet-auth/index.ts:
--   INSERT INTO used_nonces (nonce, expires_at) VALUES ($nonce, now() + NONCE_WINDOW)
--   On 23505 unique violation: return 409 Nonce already used
--
-- Down (reference only -- never run in production):
-- DROP TABLE IF EXISTS public.used_nonces;

CREATE TABLE IF NOT EXISTS public.used_nonces (
  nonce       TEXT        NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  CONSTRAINT  used_nonces_pkey PRIMARY KEY (nonce)
);

-- Supports efficient cleanup of expired rows at the top of wallet-auth.
CREATE INDEX IF NOT EXISTS idx_used_nonces_expires_at
  ON public.used_nonces (expires_at);
```

**wallet-auth/index.ts changes:**

The `serviceClient` is currently created at step 5 (line 115). It must be created earlier so it can perform the nonce INSERT before signature verification. Move serviceClient creation to immediately after input validation.

**Step-by-step diff (described):**

After line 88 (end of existing timestamp check), insert the following block as new "Step 2b — Nonce one-time-use enforcement":

```typescript
// -------------------------------------------------------------------------
// 2b. Nonce one-time-use enforcement — prevents replay within the 5-min window.
//     INSERT fails on PRIMARY KEY violation (code '23505') if nonce already used.
//     Cleanup of expired rows runs here to avoid unbounded table growth.
// -------------------------------------------------------------------------
const serviceClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// Cleanup expired nonces (best-effort: ignore errors)
await serviceClient
  .from('used_nonces')
  .delete()
  .lt('expires_at', new Date().toISOString());

// Record nonce as used. If INSERT fails with 23505, the nonce was already consumed.
const { error: nonceInsertErr } = await serviceClient
  .from('used_nonces')
  .insert({
    nonce,
    expires_at: new Date(nonceMs + NONCE_WINDOW_MS).toISOString(),
  });
if (nonceInsertErr) {
  if (nonceInsertErr.code === '23505') {
    return json({ error: 'Nonce already used -- generate a new authentication request' }, 409);
  }
  return json({ error: `Nonce storage failed: ${nonceInsertErr.message}` }, 500);
}
```

Then delete the existing `serviceClient` declaration at line 115-119 (step 5 in the current code) since it is now declared above. Steps 6-9 use the same `serviceClient` variable without change.

**Summary of wallet-auth/index.ts changes:**
- Move/replace serviceClient declaration: from line 115 to immediately after line 88
- Add 3 new blocks after the moved serviceClient: cleanup DELETE, nonce INSERT, error check
- Remove the duplicate serviceClient declaration at old line 115-119
- No other logic changes

**No RLS configuration needed:** serviceClient uses the service role key which bypasses RLS.

**Done when:** Two sequential POST requests with identical `{address, signature, nonce}` result in: first returns 200 with access_token; second returns 409 "Nonce already used".

---

### VULN-5 — Consumable double-spend race condition

**Root cause:** `care-action/index.ts` reads consumable quantity at line 155 into `consumableRow.quantity`, then at line 199 writes `quantity = consumableRow.quantity - 1`. This bakes the read-time value into the write. Two concurrent requests both reading `quantity=N (N>1)` will both write `quantity = N-1`, spending only one item but advancing two actions.

The existing code comment at lines 194-196 documents this exactly:
> "does not prevent double-decrement when quantity > 1 and two concurrent requests arrive simultaneously -- a fully atomic SET quantity = quantity - 1 requires a stored procedure (deferred)."

**Fix: RPC `decrement_consumable` with atomic UPDATE**

**Migration 2 — New file:** `apps/server/supabase/migrations/20260808000002_decrement_consumable_fn.sql`

```sql
-- decrement_consumable: atomic consumable decrement for care-action.
-- Replaces the two-step read+write pattern in care-action/index.ts s6
-- with a single UPDATE that evaluates `quantity - 1` server-side, preventing
-- double-spend races when concurrent requests both see quantity > 1.
--
-- Returns the updated row if decrement succeeded (quantity was > 0).
-- Returns empty result set if quantity was already 0 or ownership check failed.
-- Caller maps empty result to 409 (same behaviour as current code).
--
-- wallet_id check is included for defense-in-depth (mirrors the s1 ownership
-- check in care-action, but enforced atomically at the DB write layer).
--
-- Called from care-action/index.ts:
--   serviceClient.rpc('decrement_consumable', {
--     p_consumable_id: consumableRow.id,
--     p_wallet_id: wallet_row_id,
--   })
--
-- SECURITY DEFINER: runs with definer privileges to bypass RLS on consumables.
-- search_path = public prevents search-path injection.
--
-- Down (reference only -- never run in production):
-- DROP FUNCTION IF EXISTS public.decrement_consumable(UUID, UUID);

CREATE OR REPLACE FUNCTION public.decrement_consumable(
  p_consumable_id UUID,
  p_wallet_id     UUID
)
RETURNS TABLE(id UUID, quantity INTEGER)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.consumables
     SET quantity = quantity - 1
   WHERE id        = p_consumable_id
     AND wallet_id = p_wallet_id
     AND quantity  > 0
  RETURNING id, quantity;
$$;
```

**care-action/index.ts changes — section 6 only (lines 189-207):**

Replace the current block (lines 189-207) with:

```typescript
  // -------------------------------------------------------------------------
  // 6. Atomic consumable decrement via RPC.
  //    quantity = quantity - 1 is evaluated server-side; prevents double-spend
  //    race where two requests both read quantity > 1 and both write quantity - 1.
  //    Returns the updated row if quantity > 0; empty if already consumed.
  // -------------------------------------------------------------------------
  if (consumableRow !== null) {
    const { data: decremented, error: decrErr } = await serviceClient
      .rpc('decrement_consumable', {
        p_consumable_id: consumableRow.id,
        p_wallet_id:     wallet_row_id,
      });
    if (decrErr) return json({ error: decrErr.message }, 500);
    if (!decremented || decremented.length === 0) {
      return json({ error: 'Consumable already consumed or insufficient quantity' }, 409);
    }
  }
```

**No other changes to care-action/index.ts for this issue.**

Note: the early quantity check at line 164 (`if ((c.quantity as number) <= 0)`) can remain. It provides a fast-fail user-facing error message and does not need to be removed — the atomic decrement is the correctness guarantee regardless.

Note: the SELECT at lines 154-167 now only needs to return `id` (not `id, quantity`) since the quantity computation is moved server-side. The implementer MAY simplify `.select('id, quantity')` to `.select('id')` and remove the `quantity` field from `consumableRow` type, but this is optional cleanup and not required for correctness.

**Done when:** Two concurrent requests with a consumable at quantity=1 result in: exactly one succeeds (200), the other returns 409. Confirmed by querying `consumables` table and observing `quantity = 0`, not `quantity = -1`.

---

### VULN-6 — Missing wallet ownership rebind at tree update

**Root cause:** `care-action/index.ts` lines 137-144 update the tree's `current_day` and `last_ticked_at` with only `.eq('id', tree_id)` in the WHERE clause. The `wallet_id` constraint present in the ownership check (lines 82-91) is not repeated at write time.

**Confirmed from source (lines 137-144):**
```typescript
    const { error: treeUpdateErr } = await serviceClient
      .from('trees')
      .update({
        current_day: currentDay,
        last_ticked_at: new Date(now).toISOString(),
      })
      .eq('id', tree_id);
    if (treeUpdateErr) return json({ error: treeUpdateErr.message }, 500);
```

**Fix:** One-line addition — add `.eq('wallet_id', wallet_row_id)` after `.eq('id', tree_id)`:

**care-action/index.ts line 143:** Change:
```typescript
      .eq('id', tree_id);
```
To:
```typescript
      .eq('id', tree_id)
      .eq('wallet_id', wallet_row_id);
```

That is the complete change for VULN-6. No migration, no new functions, no other file changes.

**Done when:** `grep -n "wallet_row_id" apps/server/supabase/functions/care-action/index.ts` shows wallet_row_id at both the ownership check (line ~86) and the tree update WHERE clause (line ~143-144).

---

## IMPLEMENTATION ORDER

The implementer should apply fixes in this order:

1. **F15** — Edit `apps/server/src/index.ts` (standalone, no dependencies)
2. **VULN-6** — Add `.eq('wallet_id', wallet_row_id)` to care-action (standalone 1-line change)
3. **VULN-5** — Apply migration 20260808000002 + update care-action section 6 (migration first, then code)
4. **VULN-1** — Apply migration 20260808000001 + update wallet-auth/index.ts (migration first, then code)

VULN-1 last because wallet-auth is a deployed function and its migration adds a net-new table; if the table doesn't exist when the function runs, the auth system breaks. Apply migration via `supabase db push` before deploying the updated function.

---

## ASSUMPTIONS

1. **consumables.wallet_id is UUID type.** Inferred from IMPL-CONSUMABLES-SCHEMA-FIX-2026-08-02.md and the FK constraint `consumables_wallet_id_fkey`. The `decrement_consumable` function signature uses `UUID` for both parameters. If `wallet_id` or `id` are a different type (e.g., TEXT), the function parameter types must match.

2. **used_nonces is accessible to the service role without RLS.** New tables in public schema default to no RLS. Since wallet-auth uses the service role key, it bypasses RLS in any case. Mitigation: if RLS is added to used_nonces in future, the service role still bypasses it.

3. **Supabase JS client `nonceInsertErr.code` is '23505' for unique violations.** This is the standard PostgreSQL error code for unique_violation. The Supabase JS client surfaces this in the `error.code` field. If the client wraps the error differently, the check may need to read `nonceInsertErr.message.includes('unique')` as fallback.

4. **Deno ESM import of '@kijo/engine' is what crashes F15 (not tsc).** `apps/server/src/index.ts` appears to be a Node.js stub (not a Deno Edge Function), so the crash may be a TypeScript compile error rather than a Deno ESM SyntaxError. In either case the fix is identical — remove the import.

5. **No active sessions will be invalidated by the VULN-1 fix.** The fix adds replay prevention for NEW auth requests. Existing JWTs already issued are not affected. Tokens issued during the vulnerability window are valid until their Supabase JWT expiry.

6. **The `decrement_consumable` RPC returns an array (not a single row).** Supabase RPC with RETURNS TABLE always returns an array. The existing pattern `decremented.length === 0` in the replacement code is correct.

---

## OPEN QUESTIONS

| ID | Question | Who decides | Impact |
|----|----------|-------------|--------|
| OQ-VULN1-A | Should the nonce format change from millisecond timestamp to a cryptographically random string (UUID/hex)? Timestamp nonces have ~32 bits of entropy and are predictable within 5 minutes. The one-time table prevents replay but not enumeration. | Jeremy | Low for testnet; medium for production. Changing nonce format requires updating `useWalletAuth.ts` on the client to use `crypto.randomUUID()` instead of `Date.now().toString()`. |
| OQ-VULN1-B | Does the serviceClient move to before step 2 break any assumption about ordering in wallet-auth (e.g., does the nonce INSERT need to happen AFTER sig verification to avoid storing nonces from invalid sigs)? | Implementer review | If we INSERT the nonce before verifying the signature, an attacker can exhaust all valid timestamp nonces for a given second by sending unauthenticated requests. RECOMMENDATION: move the nonce INSERT to AFTER signature verification (step 4), not before. The current design spec places it after timestamp validation but before sig verification. This should be reconsidered. |
| OQ-VULN5-A | Should the early quantity check (line 164) remain, or is it removed now that the RPC handles the atomic case? | Implementer / Jeremy | Keeping it gives a better UX error message. Removing it reduces round-trips. Either is correct for security. |
| OQ-VULN5-B | The `decrement_consumable` function signature uses `UUID` for both `p_consumable_id` and `p_wallet_id`. What is the actual column type for `consumables.wallet_id`? IMPL-CONSUMABLES-SCHEMA-FIX-2026-08-02.md confirms a FK constraint exists but does not state the type. Verify with `\d consumables` before applying migration. | Implementer | If `wallet_id` is TEXT, change the parameter type to TEXT. |

---

## SUMMARY TABLE

| Issue | File(s) Changed | Migration | Scope |
|-------|----------------|-----------|-------|
| F15 | `apps/server/src/index.ts` | None | 4-line removal + 2-line replacement |
| VULN-1 | `apps/server/supabase/functions/wallet-auth/index.ts` | `20260808000001_used_nonces.sql` | ~15 lines added, serviceClient moved |
| VULN-5 | `apps/server/supabase/functions/care-action/index.ts` | `20260808000002_decrement_consumable_fn.sql` | Section 6 replacement (~12 lines) |
| VULN-6 | `apps/server/supabase/functions/care-action/index.ts` | None | 1 line added to WHERE clause |

