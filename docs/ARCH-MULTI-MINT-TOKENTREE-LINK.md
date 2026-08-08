# Architecture: Multi-Mint Fix + token_id/tree_id Link

**Stage:** ARCHITECT -- Revision 2 (corrective pass)
**Date:** 2026-08-06
**Status:** READY FOR IMPLEMENTER -- all BLOCKER/MAJOR/MINOR items from critic resolved
**Fixes:** BUG-1 (multi-mint RON loss), BUG-2 (tokenId/treeId unlinked)
**Supersedes:** Revision 1 of this document (draft before critic review)

---

## 0. Problem Statement

Two bugs share a root cause and must be fixed together.

**BUG-1 -- Multi-mint:** `seed-claim` calls `mintKijonsai` exactly once regardless
of the `count` field. A user buying qty=3 pays 9 RON and receives 1 NFT.

**BUG-2 -- tokenId/treeId unlinked:** `trees` has no `token_id` column. The NFT
metadata endpoint cannot locate its tree row given a tokenId. Guest->wallet
conversion loses the care log.

---

## 1. Scope

1. DB migrations: `trees.token_id`, named partial index, `render_queue` table,
   `seed_claims.token_ids` (replay recovery column)
2. `seed-claim` -- full rewrite: loop N mints, atomic trees INSERT per token,
   care_log hand-off, explicit nonce, render_queue enqueue, idempotent replay
3. `seed-tree` -- **unchanged**; guest path only (clarified, no code change)
4. `useSeedPurchase.ts` -- simplified; no more `seed-tree` calls from mint path;
   seeds array replaces single seed ref

No contract changes. `Kijonsai.mintKijonsai(address, uint256, string)` already
supports arbitrary tokenIds. OZ pinned at 5.0.2 unchanged
(5.1+ uses mcopy opcode, Ronin London EVM does not support it -- DECISIONS.md
2026-07-26).

---

## 2. Confirmed Decisions (Jeremy, 2026-08-06)

These were open questions or conflicts in Revision 1.

| # | Decision | Outcome |
|---|---|---|
| BLOCKER-1 | Which function creates the `trees` row on mint? | **`seed-claim` creates the row atomically inside the mint loop.** `seed-tree` is NOT called by the client after minting. |
| BLOCKER-1 | Guest path status? | `seed-tree` survives exclusively for guest trees (token_id = NULL). Two paths are mutually exclusive. |
| BLOCKER-2 | Nonce management | **Explicit nonce.** Fetch `eth_getTransactionCount(address, "pending")` once before the loop; pass `nonce: baseNonce + i` to each `writeContract` call. (viem v2 writeContract accepts nonce as number, not bigint.) |
| MAJOR-1 | Replay guard 409 vs find-or-create | **Find-or-create.** If `seed_claims` row exists and `token_ids` is populated, return previously-minted tokens as idempotent 200 (not 409). |
| MAJOR-2 | render_queue | `seed-claim` inserts one render_queue row per confirmed mint. |
| MAJOR-3 | Seed-index on partial failure | Resolved server-side: client sends `seeds[]` array; `seed-claim` uses `seeds[i]` for token `i`. No client-side position mapping at all. |
| MAJOR-4 | count=0 validation | Already present in current `seed-claim` (lines 147-149). Retain. Add `seeds.length === count` check alongside it. |

---

## 3. Architecture Constraints

These flow from DECISIONS.md and SESSION-START.md and must not be broken.

- `seed + care_log -> identical tree everywhere, every time` -- the core invariant.
  `seeds[i]` must be paired with token `i` end-to-end; pairing happens server-side
  inside the loop, eliminating client-side mapping ambiguity on partial failure.
- `token_id` column: `BIGINT UNIQUE` nullable. Multiple NULLs are allowed.
  PostgreSQL UNIQUE permits multiple NULLs because NULL != NULL per the SQL standard
  (ISO/IEC 9075-2:2016 ss10.6; PostgreSQL docs:
  https://www.postgresql.org/docs/current/ddl-constraints.html
  #DDL-CONSTRAINTS-UNIQUE-CONSTRAINTS -- "The null value is never equal to
  another null value."). No partial-index workaround is needed for nullability.
- `get_next_kijonsai_token_id()` must be called once per mint INSIDE the loop, not
  once before it. Calling it before the loop pre-consumes all N IDs before any
  mint attempt.
- Sequential mint submit + parallel receipt-wait is correct. Explicit nonce makes
  it safe (see ss6.4).
- OZ 5.0.2 pinned -- no contract changes in this spec.

---

## 4. DB Migrations

Three migration files. Apply in order.

### 4.1 trees.token_id + named partial index

**File:** `apps/server/supabase/migrations/20260806000001_trees_token_id.sql`

```sql
-- Adds token_id to the trees table.
--
-- NULLABLE: guest trees (has_spirit=false) have no NFT; they receive NULL.
-- UNIQUE: two tree rows cannot reference the same tokenId.
-- Multiple NULLs are allowed -- PostgreSQL UNIQUE permits this because
-- NULL != NULL (SQL standard ISO/IEC 9075-2:2016 ss10.6).
-- Reference: https://www.postgresql.org/docs/current/ddl-constraints.html
--            #DDL-CONSTRAINTS-UNIQUE-CONSTRAINTS
--
-- Backfill: existing testnet trees minted before this migration remain with
-- token_id = NULL. Manual backfill is out of scope (only a few testnet tokens).
-- All mainnet mints go through the fixed seed-claim flow.

ALTER TABLE public.trees
  ADD COLUMN IF NOT EXISTS token_id BIGINT UNIQUE;

-- Named partial index (explicit name aids query-plan debugging; partial form
-- excludes NULL guest-tree rows from the B-tree, which is the lookup-hot path).
-- Matches the index form specified in NFT-METADATA-IMAGE-ARCH.md.
CREATE INDEX IF NOT EXISTS idx_trees_token_id
  ON public.trees (token_id)
  WHERE token_id IS NOT NULL;

-- Down (reference only -- never run in production):
-- DROP INDEX IF EXISTS idx_trees_token_id;
-- ALTER TABLE public.trees DROP COLUMN IF EXISTS token_id;
```

### 4.2 render_queue table

**File:** `apps/server/supabase/migrations/20260806000002_render_queue.sql`

Full schema from NFT-METADATA-IMAGE-ARCH.md (reproduced here so the implementer
has one place to look):

```sql
CREATE TABLE IF NOT EXISTS public.render_queue (
  id         BIGSERIAL    PRIMARY KEY,
  token_id   BIGINT       NOT NULL,
  tree_id    UUID         NOT NULL REFERENCES public.trees(id),
  trigger    TEXT         NOT NULL CHECK (trigger IN ('mint','prune','wire','tick')),
  status     TEXT         NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','processing','done','failed')),
  attempts   INTEGER      NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  error      TEXT
);

CREATE INDEX IF NOT EXISTS idx_render_queue_status_created
  ON public.render_queue (status, created_at)
  WHERE status = 'pending';
```

### 4.3 seed_claims.token_ids (replay recovery column)

**File:** `apps/server/supabase/migrations/20260806000003_seed_claims_token_ids.sql`

```sql
-- Adds token_ids to seed_claims for idempotent replay recovery (MAJOR-1 fix).
-- Written after all mint submissions attempt; NULL means the previous run
-- did not complete (died mid-loop before UPDATE).
ALTER TABLE public.seed_claims
  ADD COLUMN IF NOT EXISTS token_ids BIGINT[];
```

---

## 5. Two Mutually Exclusive Paths

These paths are **never mixed**. A request follows one or the other.

```
GUEST PATH
  client -> seed-tree (POST)
  seed-tree: INSERT INTO trees {
    wallet_id, seed, species, has_spirit=false, token_id=NULL,
    born_at, current_day=0, last_ticked_at
  }
  seed-tree: returns { ok, tree_id }
  care log lives in localStorage; no NFT minted.

MINT PATH
  client sends RON on-chain (wagmi sendTransaction)
  client waits for receipt (useWaitForTransactionReceipt)
  client -> seed-claim (POST, JWT required)
  seed-claim:
    1. JWT auth
    2. Validate: count in [1,10], seeds.length == count
    3. 5 payment checks (unchanged from current impl)
    4. INSERT seed_claims (replay guard)
       -- on 23505: find-or-create; return existing token_ids if set
    5. Fetch base nonce: eth_getTransactionCount(minterAddress, "pending")
    6. For i = 0..count-1:
         get_next_kijonsai_token_id()          -- one call per iteration
         INSERT INTO trees { token_id, seeds[i], species, has_spirit=true, ... }
         if i==0 and care_log non-empty: bulk-INSERT care_log_entries
         walletClient.writeContract({ nonce: baseNonce + i, ... })
    7. Promise.allSettled(all receipts in parallel)
    8. For each confirmed success: INSERT render_queue (trigger='mint')
    9. UPDATE seed_claims SET token_ids = [minted token ids]
   10. Return { v:2, ok, tokens:[{tokenId,treeId,mintTxHash,ok}], partial }
  client: clears localStorage care_log (one-time consumption)
  client: stores tokens[0].treeId in sessionStorage -- NO seed-tree call
```

`seed-tree` is **not called** during the mint path. The `treeId` comes directly
in the `seed-claim` response.

---

## 6. seed-claim Revised Spec

### 6.1 Request Body (expanded)

```typescript
{
  txHash:     string;                              // existing
  count:      number;                              // existing -- 1..10
  seeds:      number[];                            // NEW -- length == count; seeds[i] -> tree i
  species:    'hardwood' | 'evergreen' | 'tropical'; // NEW
  has_spirit: boolean;                             // NEW -- always true for mint path
  care_log?:  CareLogEntry[];                      // NEW -- optional guest history; first token only
}
```

**care_log field:** The client reads `localStorage.getItem('care_log')` at
`buySeeds()` call time (before any RON is sent) and includes it in the body.
`seed-claim` bulk-inserts these entries into `care_log_entries` for `trees[0].id`
only. Tokens at index 1..count-1 are fresh seedlings.

On successful response, the client calls `localStorage.removeItem('care_log')`.
This is a client-side responsibility. The server cannot enforce it and does not
try. The server has a 409 guard: if `care_log_entries` already exist for the
target `tree_id`, the bulk-insert is skipped (not an error).

**Seed assignment invariant:** `seeds[i]` is the genome for `tokens[i]`. The
pairing is done server-side in the loop -- there is no client-side mapping on
partial failure (resolves MAJOR-3).

### 6.2 Body Validation (expanded)

After parsing JSON:

```typescript
// count validation -- already present in current code (lines 147-149)
if (!Number.isInteger(count) || count < 1 || count > 10) {
  return json({ error: 'count must be an integer between 1 and 10' }, 400);
}

// NEW: seeds array validation
if (!Array.isArray(body.seeds) || body.seeds.length !== count
    || !body.seeds.every((s: unknown) => typeof s === 'number')) {
  return json({ error: 'seeds must be a number[] of length count' }, 400);
}

const seeds: number[] = body.seeds as number[];

// NEW: species validation
const validSpecies = ['hardwood', 'evergreen', 'tropical'] as const;
if (!validSpecies.includes(body.species as typeof validSpecies[number])) {
  return json({ error: 'invalid species' }, 400);
}
const species = body.species as typeof validSpecies[number];

// NEW: has_spirit
if (body.has_spirit !== true) {
  return json({ error: 'has_spirit must be true for mint path' }, 400);
}

// NEW: care_log (optional)
const care_log: unknown[] | undefined =
  Array.isArray(body.care_log) ? (body.care_log as unknown[]) : undefined;
```

These run before the payment checks. `count=0` is blocked by `count < 1`.

### 6.3 Replay Guard -- Find-or-Create (MAJOR-1)

Replace the current 409 on `23505` with find-or-create:

```typescript
const { error: claimErr } = await serviceClient
  .from('seed_claims')
  .insert({ tx_hash: normalizedTxHash, claimed_by: user.id, count });

if (claimErr) {
  if (claimErr.code === '23505') {
    // tx_hash already claimed. Return the previously-minted tokens idempotently.
    const { data: existing } = await serviceClient
      .from('seed_claims')
      .select('token_ids, count')
      .eq('tx_hash', normalizedTxHash)
      .single();

    if (existing?.token_ids?.length) {
      // Previous run completed -- recover treeIds from trees table.
      const { data: treesRows } = await serviceClient
        .from('trees')
        .select('id, token_id')
        .in('token_id', existing.token_ids);

      const treeMap = new Map(
        (treesRows ?? []).map((t: { id: string; token_id: number }) =>
          [Number(t.token_id), t.id]
        )
      );

      return json({
        v: 2,
        ok: true,
        tokens: existing.token_ids.map((tid: number) => ({
          tokenId: String(tid),
          treeId: treeMap.get(tid) ?? null,
          mintTxHash: null,  // not stored; caller verifies on-chain if needed
          ok: true,
        })),
        partial: false,
        replay: true,
      });
    }

    // token_ids is NULL: previous run died mid-loop. Cannot recover idempotently.
    return json({
      error: 'Transaction already claimed but mint may be incomplete -- contact support',
      claimRecorded: true,
    }, 409);
  }
  return json({ error: claimErr.message }, 500);
}
```

### 6.4 Explicit Nonce Fetch (BLOCKER-2)

**Why this is required:**

`walletClient.writeContract` internally calls `prepareTransactionRequest`, which
calls `eth_getTransactionCount(address, blockTag)` to derive the nonce.
[viem v2 source: `prepareTransactionRequest` action; viem v2 docs:
https://viem.sh/docs/actions/wallet/prepareTransactionRequest]

The `blockTag` defaults to `"pending"` in viem v2. The Ethereum JSON-RPC spec
defines `eth_getTransactionCount` with `"pending"` as returning the count
including pending (unconfirmed) transactions.
[Ethereum JSON-RPC spec: https://ethereum.org/en/developers/docs/apis/json-rpc/
#eth_gettransactioncount]

**Ronin / OP Stack risk:** Ronin runs an OP Stack L2. Not all OP Stack-derived
nodes maintain a per-connection pending-tx view. If the node returns the `"latest"`
confirmed count for `"pending"`, sequential `writeContract` calls on the same
wallet all receive the same nonce N. Tx 1 mines; tx 2..N revert on-chain. RON
is already transferred. [OP Stack go-ethereum fork does not guarantee pending
mempool state on all node configurations -- behavior on Saigon testnet not
empirically verified for this project as of 2026-08-06.]

**The fix (Jeremy confirmed):** Fetch `baseNonce` once explicitly before the
loop. Increment manually. The RPC's `"pending"` tag behavior is irrelevant.

```typescript
// Fetch the current pending nonce for the minter wallet once before the loop.
// viem v2 publicClient.getTransactionCount: returns number.
// Ref: https://viem.sh/docs/actions/public/getTransactionCount
const baseNonce: number = await publicClient.getTransactionCount({
  address: account.address,
  blockTag: 'pending',
});
// Even if "pending" returns "latest" on this node, explicit increments below
// guarantee distinct nonces for all N submissions.
```

Pass the explicit nonce in each `writeContract` call (inside the loop at
iteration `i`):

```typescript
// viem v2 writeContract accepts nonce as number, not bigint -- tsc (exit 0) confirms number.
// Ref: https://viem.sh/docs/contract/writeContract
nonce: baseNonce + i,
```

### 6.5 Mint Loop

The five payment checks (tx exists, tx.to = TREASURY, tx.value >= count *
SEED_PRICE_WEI, tx.from = caller, seed_claims INSERT) run once before the loop,
unchanged from the current implementation.

```typescript
const now = new Date().toISOString();
type Submission = {
  tokenId: bigint;
  treeId: string | null;
  mintTxHash: `0x${string}` | null;
  ok: boolean;
  error?: string;
};
const submissions: Submission[] = [];

// walletRowId is user.user_metadata?.wallet_row_id (JWT claim, already verified
// against the wallets table during the payment check block above).

for (let i = 0; i < count; i++) {

  // Step A: Atomically claim next tokenId from Postgres sequence.
  // CALLED ONCE PER ITERATION -- not before the loop (constraint from
  // DECISIONS.md: get_next_kijonsai_token_id() must be called inside the loop).
  const { data: tokenIdData, error: seqErr } =
    await serviceClient.rpc('get_next_kijonsai_token_id');
  if (seqErr || tokenIdData == null) {
    submissions.push({
      tokenId: 0n, treeId: null, mintTxHash: null, ok: false,
      error: 'Failed to assign token ID',
    });
    continue;  // try remaining iterations -- do not abort the batch
  }
  const tokenId = BigInt(tokenIdData as number);

  // Step B: Create trees row atomically (BLOCKER-1 fix -- Option A confirmed).
  // seeds[i] is the genome for this specific token (MAJOR-3 fix).
  const { data: treeRow, error: treeErr } = await serviceClient
    .from('trees')
    .insert({
      wallet_id: walletRowId,
      seed:       seeds[i],
      species,
      has_spirit: true,
      born_at:         now,
      current_day:     0,
      last_ticked_at:  now,
      token_id:        Number(tokenId),
    })
    .select('id')
    .single();

  if (treeErr || !treeRow) {
    console.error(`trees INSERT failed for tokenId ${tokenId}:`, treeErr?.message);
    submissions.push({
      tokenId, treeId: null, mintTxHash: null, ok: false,
      error: `Tree INSERT failed: ${treeErr?.message ?? 'unknown'}`,
    });
    continue;
  }

  const treeId: string = treeRow.id as string;

  // Step C: care_log hand-off -- first token only (guest -> wallet conversion).
  if (i === 0 && care_log && care_log.length > 0) {
    // 409 guard: skip if care_log_entries already exist for this tree_id.
    const { count: existingCount } = await serviceClient
      .from('care_log_entries')
      .select('id', { count: 'exact', head: true })
      .eq('tree_id', treeId);

    if (!existingCount) {
      const entries = care_log.map((entry: unknown, seq: number) => {
        const e = entry as { day?: number; type?: string; data?: unknown };
        return {
          tree_id:     treeId,
          game_day:    e.day ?? 0,
          sequence:    seq,
          action_type: e.type ?? '',
          action_data: e.data ?? null,
        };
      });
      const { error: logErr } = await serviceClient
        .from('care_log_entries')
        .insert(entries);
      if (logErr) {
        // Non-fatal: tree row exists; care log is lost. Log for manual recovery.
        console.error('care_log_entries INSERT failed (non-fatal):', logErr.message);
      }
    }
  }

  // Step D: Submit on-chain mint with explicit nonce (BLOCKER-2 fix).
  const metadataUri = `https://api.kijo.xyz/nft/metadata/${tokenId}`;
  try {
    const mintTxHash = await walletClient.writeContract({
      address:      contractAddress,
      abi:          KIJONSAI_ABI,
      functionName: 'mintKijonsai',
      args:         [callerWalletAddress as `0x${string}`, tokenId, metadataUri],
      nonce:        baseNonce + i,                  // explicit -- BLOCKER-2 fix (number, not bigint)
    });
    submissions.push({ tokenId, treeId, mintTxHash, ok: true });
  } catch (err) {
    // Tree row exists and tokenId is consumed from the sequence.
    // The tree row has token_id set. Support must call mintKijonsai directly
    // for this tokenId to make the user whole. See ss10.2 stuck-nonce note.
    console.error(
      `mintKijonsai failed for tokenId ${tokenId} (tree ${treeId}),`,
      `nonce ${baseNonce + i}:`, err,
    );
    submissions.push({
      tokenId, treeId, mintTxHash: null, ok: false,
      error: (err as Error).message,
    });
    // NOTE: nonce (baseNonce + i) may now be stuck if this writeContract threw
    // before the tx reached the mempool. Log the stuck nonce for ops recovery.
    console.warn(
      `STUCK_NONCE_CANDIDATE: minter ${account.address} nonce ${baseNonce + i}`,
      `-- check eth_getTransactionCount after this request`
    );
  }
}
```

### 6.6 Parallel Receipt Wait

```typescript
// Collect only the successfully submitted txes.
const successfulSubmissions = submissions.filter(s => s.ok && s.mintTxHash);

// Wait for all N receipts simultaneously. Total wall-clock time ~ 1 block (~2s
// on Saigon) regardless of N, since all receipts are waited in parallel.
const settled = await Promise.allSettled(
  successfulSubmissions.map(async (s) => {
    const receipt = await publicClient.waitForTransactionReceipt({
      hash:          s.mintTxHash as `0x${string}`,
      confirmations: 1,
      timeout:       60_000,  // 60s -- generous for Saigon 2s blocks
    });
    return { ...s, receiptStatus: receipt.status };
  })
);

// Merge receipt results back. Mark reverted or timed-out mints as failed.
let settledIdx = 0;
for (let i = 0; i < submissions.length; i++) {
  if (!submissions[i].ok || !submissions[i].mintTxHash) continue;
  const result = settled[settledIdx++];
  if (result.status === 'rejected') {
    submissions[i] = {
      ...submissions[i], ok: false,
      error: 'Receipt wait failed or timed out',
    };
  } else if (result.value.receiptStatus !== 'success') {
    submissions[i] = {
      ...submissions[i], mintTxHash: null, ok: false,
      error: 'Mint tx reverted on-chain',
    };
  }
}
```

### 6.7 render_queue Insertion (MAJOR-2)

After receipt merge, insert one render_queue job per confirmed mint. This is
required for the Blender render worker to generate the NFT image
(NFT-METADATA-IMAGE-ARCH.md ss"Trigger Integration Points -- seed-claim").

```typescript
// enqueueRender is a non-blocking helper (from NFT-METADATA-IMAGE-ARCH.md).
// Failure is logged but does not fail the mint response.
for (const s of submissions) {
  if (s.ok && s.treeId) {
    await enqueueRender(serviceClient, Number(s.tokenId), s.treeId, 'mint');
  }
}

// Helper (can live in _shared/ or inline):
async function enqueueRender(
  client: SupabaseClient,
  tokenId: number,
  treeId: string,
  trigger: 'mint' | 'prune' | 'wire' | 'tick',
): Promise<void> {
  const { error } = await client.from('render_queue').insert({
    token_id: tokenId, tree_id: treeId, trigger, status: 'pending',
  });
  if (error) console.error('render_queue insert failed:', error.message);
}
```

Without this step, freshly minted NFTs never generate images. The metadata
server would serve placeholder.png indefinitely.

### 6.8 Update seed_claims with Minted token_ids

```typescript
// Record minted tokenIds for idempotent replay (MAJOR-1 fix -- feeds ss6.3).
const mintedIds = submissions
  .filter(s => s.ok)
  .map(s => Number(s.tokenId));

if (mintedIds.length > 0) {
  const { error: updateErr } = await serviceClient
    .from('seed_claims')
    .update({ token_ids: mintedIds })
    .eq('tx_hash', normalizedTxHash);
  if (updateErr) {
    // Non-fatal for this request, but breaks idempotent replay.
    console.error('seed_claims token_ids update failed:', updateErr.message);
  }
}
```

### 6.9 Response Shape

```typescript
const partial = submissions.some(s => !s.ok);

return json({
  v: 2,            // version field -- old clients check data.tokenId; absence
                   // of top-level tokenId signals the shape changed.
                   // Old clients should surface "Server updated -- please refresh."
  ok: true,
  tokens: submissions.map(s => ({
    tokenId:    s.tokenId > 0n ? s.tokenId.toString() : null,
    treeId:     s.treeId,
    mintTxHash: s.mintTxHash ?? null,
    ok:         s.ok,
    ...(s.error ? { error: s.error } : {}),
  })),
  partial,
  ...(partial ? { claimRecorded: true } : {}),
});
```

**Backward compatibility for count=1:** When count=1 and the mint succeeds,
`tokens` has one element with `ok:true`. The old client checks `data.tokenId`
(undefined in the new shape) and hits its error branch. This is acceptable
during the deploy window -- the user sees "please refresh" rather than a silent
wrong-tree-id bug. Add the following to the OLD client's claim handler before
deploying the new `seed-claim`:

```typescript
// Old client safety check (deploy window only):
if (!data.tokens) {
  setClaimError('Server updated -- please refresh the page');
  return;
}
```

### 6.10 Stuck-Nonce Recovery

**Scenario:** Submission `i` fails to submit (throws before tx enters mempool)
but `i+1` is submitted with `nonce baseNonce+i+1`. Nonce `baseNonce+i` is now
"stuck" -- the minter wallet's next auto-nonce lookup sees it as the pending
nonce, blocking all future mints for other buyers.

**Detection:** The loop logs `STUCK_NONCE_CANDIDATE` on any `writeContract` throw
(see ss6.5 Step D). Monitor this log in Railway/Supabase Edge Function logs.

**Recovery (support action, manual):**
1. Check stuck nonce: `eth_getTransactionCount(minterAddress, "pending")` -- if
   result is `N` and there is no pending tx at nonce `N`, nonce `N` is stuck.
2. Send a zero-value no-op tx from the minter wallet with exactly nonce `N` and
   a gas price higher than the stuck tx (if any). This flushes the gap.
3. Alternatively, if the Ronin node supports nonce replacement, submit a
   replacement tx at the same nonce with higher gas.
4. Verify: `eth_getTransactionCount(minterAddress, "pending")` advances past `N`.

**Prevention:** The explicit nonce strategy does not prevent stuck nonces on
throw-before-mempool failures. It does prevent the nonce-collision problem
(two txes with the same nonce) which was the primary risk.

**For the support team re: partial mint make-good:** The `seed_claims` replay
guard means the support team cannot re-submit through the `seed-claim` endpoint
for an already-claimed tx_hash. Support must call `mintKijonsai` directly on
the deployed contract. The tree row (with the correct `token_id` and `seed`)
already exists in the DB. Only the on-chain mint is missing. Required data:
- buyer address (from `seed_claims.claimed_by` -> `wallets.wallet_address`)
- tokenId (from failed submission log or `trees.token_id` for the orphaned row)
- metadataUri: `https://api.kijo.xyz/nft/metadata/{tokenId}`

### 6.11 Expected Latency by N

Supabase Edge Function Pro limit: 150s. All cases are well within budget.
Saigon testnet block time: ~2s.

| count | Seq-submit est. (DB + RPC) | Parallel-wait est. | Total est. |
|-------|----------------------------|--------------------|------------|
|     1 | ~400ms                     | ~2s (1 block)      | ~2.5s      |
|     3 | ~1.2s                      | ~2s                | ~3.2s      |
|    10 | ~4s                        | ~2s                | ~6s        |

Per-iteration cost: ~100ms trees INSERT + ~300ms writeContract submit.
Parallel-wait cost: ~1 block regardless of N (all receipts waited simultaneously).

---

## 7. seed-tree (Guest Path -- Unchanged)

`seed-tree` requires **zero code changes** from this spec.

Its exclusive role: create trees rows for guests (token_id = NULL, has_spirit = false).

When the `trees.token_id` column is added by migration 20260806000001, the
existing `seed-tree` INSERT does not specify `token_id`, so the column defaults
to NULL. The UNIQUE constraint allows multiple NULLs. No conflict.

**Implementer note:** Do not touch `apps/server/supabase/functions/seed-tree/
index.ts`. Any modification is a mistake.

---

## 8. useSeedPurchase Changes

The hook is significantly simplified. `initTree` is removed. `seed-tree` is
never called from the mint path. The `treeId` comes directly in the
`seed-claim` response.

### 8.1 Seeds Array (replaces single pendingSeedRef)

```typescript
// Before:
const pendingSeedRef = useRef<number | undefined>(undefined);
// in buySeeds():
pendingSeedRef.current = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

// After:
const pendingSeedsRef = useRef<number[]>([]);
// in buySeeds(), before the RON send:
pendingSeedsRef.current = Array.from({ length: count }, () =>
  Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
);
// TODO(pre-mainnet): replace Math.random() with crypto.getRandomValues:
//   const arr = new Uint32Array(count);
//   crypto.getRandomValues(arr);
//   pendingSeedsRef.current = Array.from(arr);
```

### 8.2 care_log Extraction

```typescript
// In buySeeds(), before sendTransactionAsync:
const pendingCareLogRef = useRef<unknown[]>([]);

// Extract care_log from localStorage at purchase time.
try {
  const raw = localStorage.getItem('care_log');
  pendingCareLogRef.current = raw ? (JSON.parse(raw) as unknown[]) : [];
} catch {
  pendingCareLogRef.current = [];  // malformed JSON -- treat as empty seedling
}
```

### 8.3 Claim Body

```typescript
// In the claim effect, when POSTing to seed-claim:
body: JSON.stringify({
  txHash:     txToCheck,
  count,
  seeds:      pendingSeedsRef.current,        // NEW -- array of length count
  species,
  has_spirit: true,
  care_log:   pendingCareLogRef.current,      // NEW -- may be empty
}),
```

### 8.4 Response Handling

```typescript
const data: {
  v?: number;
  ok?: boolean;
  tokens?: Array<{
    tokenId:    string;
    treeId:     string | null;
    mintTxHash: string | null;
    ok:         boolean;
    error?:     string;
  }>;
  partial?: boolean;
  replay?:  boolean;
  error?:   string;
} = await res.json();

// Deploy-window safety check.
if (!data.tokens) {
  setClaimError('Server updated -- please refresh the page');
  return;
}

if (!res.ok || data.error) {
  setClaimError(data.error ?? 'Claim failed -- please contact support');
  return;
}

const successfulTokens = data.tokens.filter(t => t.ok && t.treeId != null);

setClaimResult({
  tokens:  successfulTokens as SuccessfulToken[],
  partial: data.partial ?? false,
});

// Store session for first successful tree. seed-claim created the rows;
// no initTree / seed-tree call needed.
if (successfulTokens.length > 0 && successfulTokens[0].treeId) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    tree_id:       successfulTokens[0].treeId,
    access_token:  token,
    wallet_row_id: wrid,
  }));
  // One-time care_log consumption (client-side responsibility).
  localStorage.removeItem('care_log');
}
```

Seed-to-tree mapping is guaranteed server-side (MAJOR-3 resolved): `seeds[i]`
was used for `tokens[i]` inside the `seed-claim` loop. There is no position
ambiguity on partial failure.

### 8.5 Types

```typescript
export interface SuccessfulToken {
  tokenId:    string;
  treeId:     string;      // guaranteed non-null in this interface
  mintTxHash: string | null;
}

export interface ClaimResult {
  tokens:  SuccessfulToken[];  // only confirmed, tree-linked tokens
  partial: boolean;            // true if some tokens in the batch failed
}
```

### 8.6 State Removed

Remove from `useSeedPurchase`:
- `pendingSeedRef` (replaced by `pendingSeedsRef`)
- `isInitingTree` / `setIsInitingTree`
- `treeId` / `setTreeId`
- `treeInitError` / `setTreeInitError`
- `retryTreeInit` function
- `initedForTokenIdRef`
- `initTree` function

Keep:
- `isClaiming` / `claimResult` / `claimError`
- `pendingCountRef` / `pendingSpeciesRef`
- `claimedForTxHashRef`
- All wagmi state (`txHash`, `isSending`, `isConfirming`, `isConfirmed`, `receipt`)

### 8.7 State Reset in buySeeds

```typescript
// Add to the reset block in buySeeds() (alongside existing setClaimResult(null) etc.):
pendingSeedsRef.current = [];
pendingCareLogRef.current = [];
```

### 8.8 Return Shape

```typescript
return {
  buySeeds,
  txHash,
  isSending,
  isConfirming,
  isConfirmed,
  receipt,
  isClaiming,
  claimResult,    // ClaimResult | null
  claimError,     // string | null
};
```

---

## 9. NFT Selection Query Pattern

With `token_id BIGINT UNIQUE` on `trees`, the canonical lookup from on-chain
world to off-chain world:

```sql
SELECT id, seed, species, has_spirit, current_day, born_at
FROM   public.trees
WHERE  token_id = $1;
```

In Edge Functions (e.g., future `nft-metadata`):
```typescript
const { data: tree } = await supabase
  .from('trees')
  .select('id, seed, species, has_spirit, current_day, born_at, token_id')
  .eq('token_id', tokenId)   // tokenId is a number, never null in this path
  .single();
if (!tree) return json({ error: 'tree not found' }, 404);
```

The partial index `idx_trees_token_id WHERE token_id IS NOT NULL` makes this
lookup O(log N) with N = minted trees only (not including guest trees).

---

## 10. Error Strategy

### 10.1 Happy Path

All N mints confirm. Response: `{ v:2, ok:true, tokens:[...N all ok:true],
partial:false }`. Client sets session from `tokens[0].treeId`. N render_queue
rows inserted. N trees rows linked to N on-chain NFTs.

### 10.2 Partial Mint (K < N succeed)

- On-chain: K NFTs minted to buyer
- DB: K trees rows linked (NFT + tree). (N-K) trees rows have `token_id` set
  but no on-chain NFT yet.
- Response: `{ ok:true, partial:true, tokens:[...K ok + (N-K) failed],
  claimRecorded:true }`
- Client: surfaces "X of N seeds minted. Contact support about the remaining Y."
- **Support path:** call `mintKijonsai(buyerAddress, tokenId, metadataUri)` directly
  for each failed tokenId. The trees row already exists with the correct
  `token_id` and `seed`. The support team cannot use the `seed-claim` endpoint
  for make-good (replay guard blocks it). They must use the contract's
  `mintKijonsai` function directly via a multisig or admin script.

### 10.3 Full Mint Failure (0 succeed)

Same support path as partial. The buyer's RON is held on the treasury but no
on-chain NFTs exist. All N trees rows exist in DB. Support mints each tokenId
directly.

### 10.4 Replay Guard -- Idempotent (MAJOR-1)

- `token_ids` populated in `seed_claims`: return previously-minted tokens, 200
  with `replay:true`. Client handles identically to a fresh success response.
- `token_ids` NULL (mid-loop die): return 409 with `claimRecorded:true`. Client
  shows support message. Support must investigate via the `seed_claims` table
  and on-chain logs.

### 10.5 Mid-Loop Timeout

Edge Function Pro limit: 150s. Expected max for N=10: ~6s. Timeout is extremely
unlikely in normal operation. If it occurs: `seed_claims` row exists; some trees
rows and mints may be in various states; `token_ids` not updated. Retry hits the
replay guard. Support path same as full failure.

### 10.6 Sequence Gap

`get_next_kijonsai_token_id()` advances the sequence non-transactionally. A gap
tokenId (sequence consumed but no on-chain NFT) is acceptable. The contract has
no `ERC721Enumerable` -- there is no on-chain invariant requiring contiguous IDs.
Gap tokenIds are visible in block explorers but have no gameplay impact.

---

## 11. Migration Sequence (for the Implementer)

Order matters.

1. **Apply all three DB migrations** (20260806000001, 20260806000002,
   20260806000003). All add nullable columns or new tables. Safe against live DB.
   Existing `seed-tree` calls get NULL for `token_id` -- no conflict.

2. **seed-tree** -- no code changes; redeploy is not required.

3. **Deploy seed-claim** (new loop, new response shape, new body fields).
   Breaking change to old clients (old clients check `.tokenId`, now undefined).
   Must deploy with client update, or add `v` version check to old client first.

4. **Deploy useSeedPurchase + StoreModal** (reads `tokens[]` instead of
   `tokenId`).

**Recommended order:** DB migrations -> seed-claim + client simultaneously.
There is always a brief deploy window. The `v:2` field in the response and the
`if (!data.tokens)` client guard limit the blast radius to a single confusing
error message ("Server updated -- please refresh.") rather than a silent
wrong-tree-id write.

---

## 12. Non-goals / Out of Scope

- Backfilling `token_id` on existing testnet trees (few; handle manually)
- A `seed-trees` batch endpoint (N inserts in one HTTP call)
- `get-tree` support for `?token_id=` query param (separate task)
- RON refund mechanism (none; support-mediated)
- Parallel `writeContract` submissions with pre-computed nonce array (not needed
  for N<=10 at testnet; re-evaluate for mainnet throughput)
- Mainnet deploy (blocked on KMS key setup per KIJONSAI-CONTRACT-ARCH.md ss9.1)
- BUG-3 species description inversion in UI (separate task)
- BUG-4 production-path determinism test (separate task)

---

## 13. DECISIONS.md Update (for the Implementer)

After implementation passes auditor, append to DECISIONS.md:

> **seed-claim creates trees rows -- Option A (2026-08-06):** `seed-claim`
> atomically creates the `trees` row inside its mint loop (not via a subsequent
> client-driven `seed-tree` call). `seed-tree` is preserved exclusively for
> the guest path (token_id=NULL). These are mutually exclusive code paths.
> Jeremy confirmed this resolving BLOCKER-1 from the critic review of
> ARCH-MULTI-MINT-TOKENTREE-LINK.md. Client no longer calls `seed-tree` after
> a successful mint; `treeId` comes directly in the `seed-claim` response.

> **Explicit nonce for multi-mint (2026-08-06):** `seed-claim` calls
> `publicClient.getTransactionCount(minterAddress, "pending")` once before the
> mint loop and passes `nonce: baseNonce + i` (number, not bigint) to each
> `walletClient.writeContract` call. This avoids relying on viem v2's
> auto-nonce via `eth_getTransactionCount("pending")`, which may return a
> stale count on OP Stack-derived RPC nodes (Ronin Saigon testnet behaviour
> not empirically verified). Explicit increment guarantees distinct nonces.
> On partial loop failure, a nonce gap may occur -- documented in the
> ARCH-MULTI-MINT-TOKENTREE-LINK.md ss6.10 stuck-nonce recovery procedure.

> **seed_claims.token_ids for idempotent replay (2026-08-06):** After all
> mint submissions complete, `seed-claim` updates `seed_claims.token_ids` with
> the minted tokenId array. On replay (same tx_hash 23505), if `token_ids` is
> set, the endpoint returns the previously-minted tokens as a 200 (replay:true).
> If `token_ids` is NULL (previous run died mid-loop), returns 409
> (claimRecorded:true). Schema change: `ALTER TABLE seed_claims ADD COLUMN
> token_ids BIGINT[]`.

> **render_queue INSERT on mint (2026-08-06):** `seed-claim` inserts one
> render_queue row per confirmed successful mint (trigger='mint', status='pending').
> Required for the Blender render worker to generate NFT images. Without this
> insert, freshly minted trees never get rendered and the metadata endpoint
> serves placeholder.png indefinitely. Render is best-effort: INSERT failure is
> logged but does not fail the mint response.
