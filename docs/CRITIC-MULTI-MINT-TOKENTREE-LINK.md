# Critic Review: ARCH-MULTI-MINT-TOKENTREE-LINK.md

**Stage:** CRITIC  
**Date:** 2026-08-06  
**Reviewing:** `docs/ARCH-MULTI-MINT-TOKENTREE-LINK.md`  
**Against:** `docs/KIJONSAI-CONTRACT-ARCH.md`, `docs/PHASE1-RONIN-ARCH.md`, `docs/NFT-METADATA-IMAGE-ARCH.md`, `DECISIONS.md`, `STATE.md`

---

## ⚡ Code Review: seed-claim multi-mint loop + trees.token_id linkage architecture

### The Verdict

This spec correctly identifies the two bugs and proposes fixes that are mostly sound. The DB migration is clean, the response shape is well-designed, and the seed-index handling is honestly scoped. But it has two genuine blockers and three majors that must be resolved before the implementer touches a file.

**Blocker 1** is a direct conflict with `NFT-METADATA-IMAGE-ARCH.md`, which contains a Jeremy-confirmed decision (2026-07-27) that `seed-claim` creates the trees row and `seed-tree` is retired from the mint path. This spec keeps `seed-tree` alive and has the client drive N separate `seed-tree` calls. That is an unresolved fork in the architecture.

**Blocker 2** is the nonce claim. The spec asserts that sequential `walletClient.writeContract` calls avoid nonce collision because "each submit-call goes out after the previous one is acknowledged." That sentence is load-bearing and possibly wrong. Whether it holds depends on whether viem uses `eth_getTransactionCount(address, "pending")` or `"latest"` for auto-nonce, and whether the Ronin RPC node tracks pending transactions correctly. If `"latest"` is used, all N sequential submits race to the same nonce and all but the first revert on-chain while RON is already transferred. The spec must verify this before shipping.

Everything else is fixable during implementation if the implementer is briefed clearly.

---

### ⚠️ Logic & Security Context (Step 0 Map)

**Invariants identified:**

1. `seed + care_log → identical tree everywhere, every time` — this spec touches the seed assignment path (§5.5). The off-by-index mapping on partial mint violates this invariant in a subtle way: tree at original-position 2 gets seed generated for position 1. Trees are seeded incorrectly when partial failure occurs. Aesthetic-only at testnet; genuine integrity break for the invariant.

2. `One tx_hash → one seed_claims row → N mints` — the replay guard is correct and unchanged. The threat: what happens when the Edge Function times out *after* `seed_claims` INSERT but *during* the mint loop? The claim is permanently locked; the client retries and gets 409 "already claimed." There is no status-query path for the client to recover. For N>1 mints the expected failure rate of mid-loop timeout is higher than single-mint.

3. `token_id → exactly one trees row` — the UNIQUE constraint enforces this. Correct.

**Trust model:**

- JWT auth on `seed-claim` and `seed-tree` is unchanged. Correct.
- `seed-claim` verifies: tx exists, tx.to = TREASURY, tx.value >= count * SEED_PRICE_WEI, tx.from = caller, tx_hash not previously claimed. All five checks run before the mint loop. This ordering is correct — validate before mutate.
- `get_next_kijonsai_token_id()` is SECURITY DEFINER. Token ID assignment is atomic server-side. No race possible between two concurrent requests.

**State ordering:**

The spec follows: verify payment → INSERT seed_claims → loop(claim tokenId → submit mint tx) → wait receipts → return.

This is correct for the replay guard. The issue is the "wait receipts" step can time out after some-but-not-all mints are confirmed, and there is no idempotent recovery path for the caller.

**TOCTOU:**

`seed_claims` INSERT is atomic. No TOCTOU on the replay guard. ✓

**Asset safety:**

Partial mint with no refund path: buyer loses RON for the undelivered fraction. The spec explicitly accepts this for testnet and calls it "support-mediated." The blocker is that the `seed_claims` replay guard ALSO prevents the support team from issuing a make-good through the same payment endpoint — they must call `mintKijonsai` directly. The spec says this is "out of scope" without specifying what tooling enables it. For mainnet this must be specified. For testnet: acceptable.

---

### 🕹️ Carmack's Notes

**The nonce problem is not solved — it is assumed away.**

Section 3.3 says:

> "Submit tx 1, record (tokenId1, hash1). Submit tx 2, record (tokenId2, hash2). Nonces are assigned naturally by the RPC node since each submit-call goes out after the previous one is acknowledged."

"Acknowledged" is doing enormous work here. When `walletClient.writeContract` resolves, the transaction is in the mempool. The nonce for the *next* call depends on how viem calls `eth_getTransactionCount`. If it calls with `"latest"` (the finalized block count), tx1 is still unconfirmed and the node returns nonce=N for both calls. Both tx1 and tx2 get nonce=N. On-chain, the first to be mined wins; the other reverts. RON is transferred; one NFT is minted instead of two.

viem v2's `prepareTransactionRequest` (which `writeContract` calls internally) uses `eth_getTransactionCount(address, "pending")` by default. If the Ronin RPC node correctly tracks pending transactions, the pending count for tx1 is already N+1 when tx2 is submitted, and the scheme works.

**This must be verified empirically, not assumed.** Not all EVM-compatible nodes implement `"pending"` tag correctly — some return `"latest"` regardless. Ronin runs an OP Stack L2; behavior is node-implementation-dependent.

**The safe fix** requires one of:
1. Fetch nonce once (`eth_getTransactionCount(address, "pending")`), increment per submit: `nonce: baseNonce + BigInt(i)`. Explicit, safe, well-specified.
2. Wait for receipt after each submit (fully sequential, eliminates the parallel-wait optimization). For N=3 at 2s blocks: 6s total. Acceptable for testnet.

Option 1 is the correct engineering call. The spec should specify it.

**Mid-loop timeout budget not calculated.**

Supabase Edge Functions have an execution time limit (up to 150s on Pro). For N=10:
- 10 sequential `get_next_kijonsai_token_id()` RPC calls: ~100–500ms each
- 10 sequential `walletClient.writeContract` RPC calls: ~200–500ms each
- `Promise.allSettled` receipt wait: ~2–4s (one block cycle)
- Total estimate: 3–9s for N=10 with fast RPC

For N=10 this is well within 150s. For N=1: fine. But the spec never documents this, leaving the implementer to discover a timeout failure at N=10 in production. Add a table of expected latencies by N.

**The merge step in §3.5 (Step D) is correct.**

The `idx` counter mapping `settled` results back into `submissions` is correct. `settled` is built from `submissions.filter(ok && mintTxHash)`, and the idx-indexed loop skips non-ok entries matching that filter. No off-by-one. ✓

**Sequence gaps are fine on-chain; the spec correctly accepts them.** The contract has no enumeration invariant (no ERC721Enumerable). Ronin Market looks up tokens by owner or by tokenId directly. Gaps are visible in explorers but cause no functional issues. ✓

---

### 🐧 Linus's Notes

**There is a direct conflict with a decided architecture that the spec ignores.**

`NFT-METADATA-IMAGE-ARCH.md` contains the following Jeremy-confirmed decision (2026-07-27, Option A):

> "seed-claim creates the trees row. seed-tree is retired from the mint path."

This spec (ARCH-MULTI-MINT-TOKENTREE-LINK.md §4) proposes:

> "Add `token_id?: number` to the accepted request body [of seed-tree]. When present, write it to the trees INSERT."

These are mutually exclusive designs. Either `seed-tree` creates the tree row (this spec) or `seed-claim` creates it (NFT-METADATA-IMAGE-ARCH.md). The implementer cannot implement both. The spec must explicitly supersede NFT-METADATA-IMAGE-ARCH.md Option A or be revised to follow it. Right now both docs are "authoritative" and they disagree.

This is also not an academic concern — it has downstream implications:

1. **render_queue** (specified in NFT-METADATA-IMAGE-ARCH.md) requires `tree_id` (UUID) to insert a job. If `seed-claim` doesn't create the tree row, it doesn't have the `tree_id`. This spec doesn't mention `render_queue` at all. The fresh NFTs will never be rendered until someone adds render_queue insertion somewhere.

2. **care_log hand-off** (guest → wallet conversion) is specified in NFT-METADATA-IMAGE-ARCH.md §"The care_log is a one-time birth record." This spec doesn't mention `care_log` in the seed-claim request body at all. If implemented as written, the guest care history is silently dropped at first mint.

**409 Conflict on UNIQUE violation in seed-tree is the wrong status code.**

§4.3 says: when `23505` fires on the trees INSERT, return 409 with "A tree for this token ID already exists."

This is incorrect because `initTree` is not idempotent by this spec's design. In practice:
- React StrictMode fires effects twice in dev
- The client has retry logic (`retryTreeInit`) 
- The network can lose a response after the server committed the INSERT

In all these cases: the tree row IS successfully created, but the second call gets 409. The client's `treeInitErrors` map then has the tokenId → "409 error" string, and the UI shows the user a failed tree that actually exists.

The correct behavior: when `23505` fires, SELECT the existing row and return `{ ok: true, tree_id: existingId }`. This makes `seed-tree` idempotent (find-or-create). The `initedForTokenIdRef` guard remains as the primary defense; the 409→200 change is the correct safety net.

**Seed-index off-by-one on partial mint should be fixed now, not deferred.**

§5.5 approach (a): `successfulMints[i]` maps to `pendingSeedsRef.current[i]`. When partial failure occurs (e.g., mint[1] failed, mint[0] and mint[2] succeeded), `successfulMints = [mint0, mint2]`. mint2 gets `pendingSeedsRef.current[1]` instead of `[2]`. Wrong seed, wrong tree.

The core invariant is `seed + care_log → identical tree everywhere`. Giving a tree the wrong seed violates this at creation, permanently. This isn't "seed assignment is aesthetic" — if the user's guest care log gets attached to a tree with the wrong seed, the tree they grew in the guest session is not the tree they get on-chain.

The fix is trivial and approach (b) is not more complex than (a):

```typescript
// Correct: iterate by original index
data.mints.forEach((mint: any, i: number) => {
  if (mint.ok) {
    const mintSeed = pendingSeedsRef.current[i];
    void initTree(token, wrid, species, mintSeed, mint.tokenId);
  }
});
```

This eliminates the off-by-one with zero added complexity. Use this. Do not defer.

**`count=0` is an edge case that produces silent RON theft.**

The five payment checks include: `tx.value >= count * SEED_PRICE_WEI`. If `count=0`, this becomes `tx.value >= 0`, which is always true. A tx with `value=0` passes all five checks. `seed_claims` INSERT fires. The mint loop runs 0 times. The user's tx_hash is permanently consumed. They cannot re-submit.

Add `if (count < 1 || count > 10) return json({ error: 'count must be 1–10' }, 400)` before the payment checks. This should already be there for the single-mint case; explicitly validate it here.

**The return shape for count=1 is a breaking change with no migration window.**

§9 recommends: "Deploy seed-claim + client simultaneously." Simultaneous deployment doesn't exist — there is always a window. Old clients hitting new seed-claim receive `{ mints: [...], partial: false }` and try to access `.tokenId` on `undefined`. New clients hitting old seed-claim receive `{ tokenId: "1", mintTxHash: "0x..." }` and try to access `.mints` on `undefined`. Both break hard, not gracefully.

Minimum mitigation: add a version field to the response (`"v": 2`) so old clients can detect the shape change and surface a "please refresh" error instead of a cryptic crash.

**MintResult literal `ok: true` type — confusing asymmetry.**

```typescript
export interface MintResult {
  ok: true;   // literal type — only successful mints
}
```

This type conflates two concerns: "what we filter before calling initTree" and "what's in the public interface." Call it `SuccessfulMint`. The name `MintResult` implies it could represent a failed mint (as the seed-claim API response does). Rename to reduce the mental load on the next person who reads `useSeedPurchase.ts`.

---

### What This Spec Gets Right

- **DB migration is clean.** `ADD COLUMN IF NOT EXISTS token_id BIGINT UNIQUE` with nullable semantics and multiple-NULL Postgres behavior is correctly specified and correctly justified. The explicit note about UNIQUE already creating an index is correct.

- **Sequential submit, parallel receipt-wait** is the right optimization direction *if the nonce issue is solved*. The design choice itself (submit all, then wait) correctly identifies that the bottleneck is block confirmation time, not RPC round-trips.

- **The response shape** (`{ ok, mints: [...], partial }`) is clean API design. Per-item results instead of a single failure/success is the right call for a batch operation. The `partial` shorthand flag is a good ergonomic choice.

- **Payment validation runs before the mint loop.** Check-then-act ordering is correct. The five payment checks are unchanged and run in the right order.

- **count=1 backwards compat note in §8.7** is good. Explicitly calling out that count=1 should produce the same externally-visible behavior prevents regressions in the common case.

- **UNIQUE constraint behavior with NULLs** is correctly understood and documented. Multiple guest trees can coexist with NULL token_id. No ORM footguns identified — `.eq('token_id', tokenId)` where tokenId is always a number (never null) in the metadata lookup path. ✓

- **NFT metadata server is correctly treated as independent.** The spec specifies the query pattern without requiring the endpoint to exist first. Minting a token whose metadata 404s is acceptable — the URI is a pointer, not the data. ✓

---

## Critical Fixes (Priority Order)

---

### BLOCKER-1: Resolve conflict with NFT-METADATA-IMAGE-ARCH.md Option A

**What:** The spec must either adopt NFT-METADATA-IMAGE-ARCH.md's Option A (seed-claim creates trees rows atomically) or explicitly supersede it with a DECISIONS.md entry.

**Why:** Two authoritative docs say opposite things. The implementer cannot implement both. If seed-tree is retained, render_queue has no insertion point and care_log hand-off is unspecified.

**How (Option A — follow NFT-METADATA-IMAGE-ARCH.md):**

Move the trees INSERT into seed-claim, inside the mint loop:

```typescript
for (let i = 0; i < count; i++) {
  const tokenId = BigInt(await getNextTokenId());
  const metadataUri = `https://api.kijo.xyz/nft/metadata/${tokenId}`;

  // Create tree row atomically before on-chain mint
  const { data: treeRow, error: treeErr } = await serviceClient
    .from('trees')
    .insert({
      wallet_id: wallet_row_id,
      seed: seeds[i],
      species,
      has_spirit: true,
      born_at: now,
      current_day: 0,
      last_ticked_at: now,
      token_id: Number(tokenId),
    })
    .select('id')
    .single();

  if (treeErr) {
    submissions.push({ tokenId, mintTxHash: null, ok: false, error: 'Tree row insert failed' });
    continue;
  }

  // Attach care_log to first token only (guest → wallet conversion)
  if (i === 0 && care_log?.length) {
    // bulk INSERT care_log_entries for treeRow.id
    // 409 guard: if care_log_entries already exist for this tree_id, skip
  }

  // Submit on-chain mint
  try {
    const mintTxHash = await walletClient.writeContract({ ... });
    submissions.push({ tokenId, treeId: treeRow.id, mintTxHash, ok: true });
    // Enqueue render job
    await enqueueRender(serviceClient, Number(tokenId), treeRow.id, 'mint');
  } catch (err) {
    submissions.push({ tokenId, treeId: treeRow.id, mintTxHash: null, ok: false, error: ... });
  }
}
```

`seed-tree` reverts to a standalone endpoint for fresh-seedling creation in non-mint contexts (guest mode, future use). The client no longer drives N seed-tree calls after claim.

**If Option B (keep seed-tree) is chosen instead:** explicitly state it in DECISIONS.md, add `render_queue` insertion to `seed-tree`, and add `care_log` to `seed-claim` request body per NFT-METADATA-IMAGE-ARCH.md.

---

### BLOCKER-2: Prove or fix the nonce management strategy

**What:** Before shipping, verify whether `walletClient.writeContract` on Ronin uses `eth_getTransactionCount(address, "pending")` for nonce auto-selection, or switch to explicit nonce management.

**Why:** If the RPC returns "latest" count (pre-pending-tx), sequential submits race to the same nonce. All but the first revert on-chain. Users lose RON.

**How:**

Replace the sequential auto-nonce approach with explicit nonce management:

```typescript
// Fetch base nonce once before the loop
const baseNonce = await publicClient.getTransactionCount({
  address: walletClient.account.address,
  blockTag: 'pending',   // ← MUST be 'pending', not 'latest'
});

for (let i = 0; i < count; i++) {
  const tokenId = ...;
  const mintTxHash = await walletClient.writeContract({
    address: contractAddress,
    abi: KIJONSAI_ABI,
    functionName: 'mintKijonsai',
    args: [callerWalletAddress, tokenId, metadataUri],
    nonce: baseNonce + i,   // ← explicit, no RPC race
  });
  submissions.push({ tokenId, mintTxHash, ok: true });
}
```

This is explicit, testable, and safe regardless of the RPC node's "pending" tag behavior. Add `nonce: baseNonce + i` to the spec's pseudocode.

**Note on mid-loop failures with explicit nonce:** If submission `i` fails, submission `i+1` proceeds with `nonce+i+1`, creating a gap. The gap nonce gets "stuck" until a replacement tx is submitted for it or the minter wallet is flushed. Document this and add a wallet health check endpoint to detect stuck nonces.

---

### MAJOR-1: seed-tree 409 must be find-or-create

**What:** Change the `23505` handler in `seed-tree` to return the existing tree row instead of 409.

**Why:** The client has retry paths (StrictMode, network retry, explicit `retryTreeInit`) that will hit this code path. A 409 causes the client to show an error for a successfully-created tree.

**How:**

```typescript
if (treeErr?.code === '23505') {
  // find-or-create: the tree already exists — return its id
  const { data: existing } = await serviceClient
    .from('trees')
    .select('id')
    .eq('token_id', token_id)
    .single();
  if (existing) {
    return json({ ok: true, tree_id: existing.id, already_existed: true });
  }
  // If we can't find it (shouldn't happen), fall through to 500
  return json({ error: 'Conflict: tree exists but could not be retrieved' }, 500);
}
```

---

### MAJOR-2: Add render_queue insertion

**What:** After each successful mint + tree row creation, `INSERT INTO render_queue (token_id, tree_id, trigger='mint', status='pending')`.

**Why:** Without this, freshly minted NFTs never generate images. The metadata server will serve placeholder images indefinitely. This was specified in `NFT-METADATA-IMAGE-ARCH.md` and is missing from this spec entirely.

**How:** Per NFT-METADATA-IMAGE-ARCH.md trigger integration spec. Insertion must be non-blocking (log failure, don't abort the mint response):

```typescript
await enqueueRender(serviceClient, Number(tokenId), treeRow.id, 'mint');
// enqueueRender catches its own errors — render is best-effort
```

---

### MAJOR-3: Fix seed-index mapping on partial mint

**What:** Replace approach (a) with approach (b) in §5.5.

**Why:** Approach (a) maps the wrong seed to trees on partial failure. The core invariant `seed + care_log → identical tree` is violated at creation.

**How:**

```typescript
// Replace:
successfulMints.forEach((mint: MintResult, i: number) => {
  const mintSeed = pendingSeedsRef.current[i] ?? pendingSeedsRef.current[0];
  void initTree(token, wrid, species, mintSeed, mint.tokenId);
});

// With:
data.mints.forEach((mint: any, i: number) => {
  if (mint.ok) {
    const mintSeed = pendingSeedsRef.current[i];
    void initTree(token, wrid, species, mintSeed, mint.tokenId);
  }
});
```

The `i` here is the original index from `data.mints`, so seed assignment is position-preserving regardless of which mints succeed.

---

### MAJOR-4: Add count validation

**What:** Validate `count` is in `[1, 10]` before the payment checks.

**Why:** `count=0` passes the `tx.value >= 0` check and permanently consumes the tx_hash while minting nothing.

**How:**

```typescript
const count = Number(body.count);
if (!Number.isInteger(count) || count < 1 || count > 10) {
  return json({ error: 'count must be an integer between 1 and 10' }, 400);
}
```

This goes before the payment verification block.

---

### MINOR-1: Deployment window — add version field

**What:** Include `"v": 2` in the new seed-claim response.

**Why:** Old clients cannot gracefully detect the response shape change. A version field lets old clients surface "please refresh" instead of crashing on `undefined.mints`.

**How:**
```typescript
return json({ v: 2, ok: true, mints: [...], partial });
```

Old client code that checks `data.tokenId` will see undefined and should fail with a readable error. Add: `if (!data.mints) { setClaimError('Server updated — please refresh the page'); return; }` to the old client's claim handler.

---

### MINOR-2: Rename MintResult to SuccessfulMint

**What:** Rename `MintResult` interface to `SuccessfulMint`.

**Why:** The raw API response has both `ok: true` and `ok: false` items. The filtered interface has only `ok: true`. Calling it `MintResult` implies it represents any mint outcome. `SuccessfulMint` makes the invariant explicit.

---

### MINOR-3: Explicit index name in migration

**What:** Add `CREATE INDEX IF NOT EXISTS idx_trees_token_id ON public.trees(token_id) WHERE token_id IS NOT NULL;` to the migration.

**Why:** The UNIQUE constraint auto-creates an index with a system-generated name (e.g., `trees_token_id_key`). The partial index form with an explicit name is better for query plan debugging and matches `NFT-METADATA-IMAGE-ARCH.md`'s explicit index spec. The `WHERE token_id IS NOT NULL` partial index is also more efficient — it excludes guest tree NULLs from the index, which is the lookup-hot path.

---

### MINOR-4: Document Supabase Edge Function execution budget

**What:** Add a latency table to §3.2.

**Why:** The implementer should know the expected execution time per N before discovering timeout failures at N=10.

```
| count | Seq-submit (est.) | Parallel-wait (est.) | Total  |
|-------|-------------------|----------------------|--------|
|     1 | ~300ms            | ~2s                  | ~2.3s  |
|     3 | ~900ms            | ~2s                  | ~2.9s  |
|    10 | ~3s               | ~2s                  | ~5s    |
```

Supabase Pro Edge Function limit: 150s. All cases are well within budget. Document this so future engineers don't guess.

---

## Checklist Response (per prompt)

| # | Question | Finding |
|---|---|---|
| 1 | Sequential submit + parallel receipt-wait: nonce collision safe? | **NOT PROVEN.** Auto-nonce from `"latest"` blockTag causes collision. Must use explicit `nonce: baseNonce + i`. See BLOCKER-2. |
| 2 | Partial mint + no refund: acceptable UX? | Acceptable for testnet. For mainnet: a status-query endpoint (`GET /seed-claim-status?tx_hash=`) is needed so clients can self-recover without human support. Currently MAJOR. |
| 3 | Idempotency: can seed_claims loop double-mint on timeout + retry? | No double-mint possible — replay guard (23505 on tx_hash) fires on retry. But: mid-loop timeout with partial on-chain mints leaves state unrecoverable from the client. 409 on retry is ambiguous (was it partial? how partial?). See MAJOR-4 above. |
| 4 | seed-tree UNIQUE race: 409 or 200? | **409 is wrong.** Should be find-or-create returning 200 with existing tree_id. See MAJOR-1. |
| 5 | Deploy order: migration → seed-tree → seed-claim+client simultaneously? | Migration-first is correct. "Simultaneously" is aspirational. Add `"v": 2` to response and a client-side version check. See MINOR-1. |
| 6 | Breaking change to ClaimResult: other consumers? | Only `SeedShopModal.tsx` identified. Implementer must `grep -r "ClaimResult\|useSeedPurchase\|claimResult\." apps/web/src/` to confirm. If clean: one consumer. |
| 7 | Guest tree NULL token_id UNIQUE: Postgres behavior correct? | Postgres UNIQUE allows multiple NULLs. Confirmed correct. `.eq('token_id', tokenId)` never fires with null tokenId in the lookup path. No ORM footgun. ✓ |
| 8 | Sequence gaps: on-chain or off-chain assumption of contiguity? | No contract enumeration (no ERC721Enumerable). No off-chain assumption of contiguity identified. Gaps acceptable. ✓ |
| 9 | NFT metadata server: does this spec depend on it being built first? | No. The URI is a pointer stored at mint time. 404s until server is built; acceptable for testnet. Independent of this fix. ✓ |

---

## Summary Table

| ID | Severity | Issue |
|----|----------|-------|
| BLOCKER-1 | 🔴 BLOCKER | Direct conflict with NFT-METADATA-IMAGE-ARCH.md Option A — seed-tree vs seed-claim creates tree row |
| BLOCKER-2 | 🔴 BLOCKER | Nonce collision not actually prevented — needs explicit `nonce: baseNonce + i` |
| MAJOR-1 | 🟠 MAJOR | seed-tree returns 409 on UNIQUE collision — should be find-or-create returning 200 |
| MAJOR-2 | 🟠 MAJOR | render_queue insertion completely missing from spec |
| MAJOR-3 | 🟠 MAJOR | Seed-index off-by-one on partial mint violates core invariant |
| MAJOR-4 | 🟠 MAJOR | count=0 bypasses payment check, permanently consumes tx_hash with 0 mints |
| MINOR-1 | 🟡 MINOR | No version field on response — deploy window breaks old clients hard |
| MINOR-2 | 🟡 MINOR | MintResult should be named SuccessfulMint |
| MINOR-3 | 🟡 MINOR | Migration should add explicit named partial index on token_id |
| MINOR-4 | 🟡 MINOR | Supabase Edge Function execution budget not documented |

**Items confirmed sound:** DB migration semantics, UNIQUE+NULL behavior, count=1 backwards compat path, payment validation ordering, response shape design, sequence gap policy, NFT metadata server independence, atomic token ID sequence, JWT auth unchanged.

**Recommended next step:** Jeremy resolves BLOCKER-1 (Option A vs B — which arch is authoritative). Once that decision is in DECISIONS.md, the Implementer can proceed with BLOCKER-2 fix + all MAJORs in a single implementation pass.
