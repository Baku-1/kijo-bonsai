# Audit: Multi-Mint + tokenId/treeId Link

**Stage:** AUDITOR
**Date:** 2026-08-06
**Reviewing:** Item 13 -- multi-mint loop + tokenId/treeId link fix
**Against:** docs/ARCH-MULTI-MINT-TOKENTREE-LINK.md (Revision 2)
**Implementer report:** STATE.md "Item 13 -- Multi-mint + tokenId/treeId link"

---

## VERDICT: CAVEATS

Core implementation confirmed correct. Two items require Jeremy sign-off before
declaring done: (1) nonce type deviation from arch spec, (2) undisclosed file
modification. Neither blocks shipping -- both are informational.

---

## CLAIMS CHECKED

### BLOCKER-1: trees INSERT inside mint loop; seed-tree not touched

  CLAIM: seed-claim creates trees row atomically inside the mint loop.
  CLAIM: seed-tree is NOT called anywhere in seed-claim.
  CLAIM: seed-tree/index.ts is byte-for-byte unmodified.

  CHECK-A: seed-claim/index.ts lines 354-380 -- trees INSERT is inside
    `for (let i = 0; i < count; i++)` loop. Confirmed.
  CHECK-B: grep for 'seed-tree' in seed-claim/index.ts -- ZERO matches.
  CHECK-C: git status shows seed-tree/index.ts NOT in modified file list.
  CHECK-D: Read seed-tree/index.ts directly -- INSERT at lines 104-113 has
    NO token_id field. Function is unchanged guest-only path.

  RESULT: ✓ VERIFIED

### BLOCKER-2: explicit nonce with blockTag:'pending'

  CLAIM: getTransactionCount({ blockTag: 'pending' }) called before loop.
  CLAIM: nonce: baseNonce + i passed to each writeContract.

  CHECK-A: seed-claim/index.ts lines 321-324 --
    `const baseNonce: number = await publicClient.getTransactionCount({
       address: account.address,
       blockTag: 'pending',
     });`
    Confirmed: called BEFORE the for loop. blockTag 'pending' confirmed.

  CHECK-B: seed-claim/index.ts line 419 -- `nonce: baseNonce + i`
    Confirmed present inside the for loop at each writeContract call.

  CAVEAT (nonce type): The arch doc (ss6.4) states "viem v2 writeContract
    accepts nonce as bigint" and shows `nonce: BigInt(baseNonce) + BigInt(i)`.
    The implementation passes `nonce: baseNonce + i` (plain number arithmetic).
    tsc --noEmit exits 0, which proves viem v2 accepts number for nonce.
    The implementation is CORRECT. The arch doc's type claim was wrong.
    Jeremy should note: viem v2 getTransactionCount returns number; writeContract
    nonce is typed as number. No bigint needed. No functional issue.

  RESULT: ✓ VERIFIED (with nonce-type caveat above)

### MAJOR-1: find-or-create replay guard; token_ids column; token_ids UPDATE

  CLAIM: On 23505 -> find-or-create; if token_ids populated -> 200+replay;
         if token_ids NULL -> 409 (mid-loop die).
  CLAIM: seed_claims.token_ids UPDATED after loop.
  CLAIM: migration 3 adds token_ids BIGINT[].

  CHECK-A: seed-claim/index.ts lines 260-299 -- 23505 branch: SELECT
    token_ids, if populated -> return { v:2, ok:true, tokens:[...], replay:true };
    if NULL -> return 409. Confirmed.
  CHECK-B: lines 486-495 -- UPDATE seed_claims SET token_ids = mintedIds
    AFTER the loop and AFTER receipt merge. Confirmed.
  CHECK-C: 20260806000003_seed_claims_token_ids.sql --
    `ALTER TABLE public.seed_claims ADD COLUMN IF NOT EXISTS token_ids BIGINT[];`
    Confirmed.

  RESULT: ✓ VERIFIED

### MAJOR-2: enqueueRender after confirmed receipts

  CLAIM: enqueueRender called for each s.ok && s.treeId after receipt merge.
  CLAIM: render_queue migration creates correct schema.

  CHECK-A: seed-claim/index.ts lines 477-481 --
    `for (const s of submissions) {
       if (s.ok && s.treeId) {
         await enqueueRender(serviceClient, Number(s.tokenId), s.treeId, 'mint');
       }
     }`
    Positioned AFTER the receipt merge block (settledIdx loop, lines 457-472).
    Confirmed: called after receipts waited, checks s.ok && s.treeId.

  CHECK-B: 20260806000002_render_queue.sql -- table created with exact schema
    from NFT-METADATA-IMAGE-ARCH.md: id BIGSERIAL PK, token_id BIGINT NOT NULL,
    tree_id UUID NOT NULL REFERENCES trees(id), trigger TEXT CHECK(...),
    status TEXT DEFAULT 'pending' CHECK(...), attempts INT DEFAULT 0,
    created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, error TEXT.
    Partial index on (status, created_at) WHERE status = 'pending'. Confirmed.

  RESULT: ✓ VERIFIED

### MAJOR-3: seeds[i] in trees INSERT; client sends seeds array

  CLAIM: seeds[i] used in trees INSERT (not seeds[0] or remapped index).
  CLAIM: client sends seeds array in useSeedPurchase.ts.

  CHECK-A: seed-claim/index.ts line 409 -- `seed: seeds[i]` inside the loop
    at iteration i. Confirmed: i-th seed assigned to i-th token.

  CHECK-B: useSeedPurchase.ts lines 246-249 --
    `pendingSeedsRef.current = Array.from(
       { length: count },
       () => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
     );`
    Array of length count generated. Lines 141-146 in claim body:
    `seeds: seeds` (snapshot of pendingSeedsRef.current). Confirmed.

  RESULT: ✓ VERIFIED

### MAJOR-4: count and seeds.length guards

  CLAIM: count < 1 || count > 10 guard exists.
  CLAIM: seeds.length !== count guard exists.

  CHECK-A: seed-claim/index.ts lines 155-157 --
    `if (!Number.isInteger(count) || count < 1 || count > 10) {
       return json({ error: 'count must be an integer between 1 and 10' }, 400);
     }`
    Confirmed.

  CHECK-B: lines 160-163 --
    `if (!Array.isArray(body.seeds) || (body.seeds as unknown[]).length !== count
        || !(body.seeds as unknown[]).every((s: unknown) => typeof s === 'number')) {`
    `length !== count` check confirmed.

  RESULT: ✓ VERIFIED

### Guest path integrity

  CLAIM: seed-tree/index.ts unmodified and has no token_id logic.

  CHECK-A: git status -- seed-tree/index.ts NOT in modified files list.
  CHECK-B: seed-tree/index.ts read in full -- INSERT at lines 104-113 does not
    include token_id. No token_id logic anywhere in the file.
  CHECK-C: seed-tree function body returns { ok: true, tree_id } -- unchanged shape.

  RESULT: ✓ VERIFIED

### TypeScript

  CLAIM: npx tsc --noEmit in apps/web exits 0.

  CHECK: Ran `npx tsc --noEmit` in apps/web directly.
  OBSERVED: No errors on stdout. EXIT:0.

  RESULT: ✓ VERIFIED (directly observed)

### SeedShopModal one-line patch

  CLAIM: SeedShopModal.tsx one-line patch, adds "hardwood" default species.

  CHECK: git diff HEAD -- apps/web/src/components/SeedShopModal.tsx
  OBSERVED: Exactly one code line changed:
    -      await buySeeds(count);
    +      await buySeeds(count, "hardwood"); // DEPRECATED: StoreModal.tsx has species picker
  Confirmed: one line in function body. Rest of diff is no-op whitespace.

  RESULT: ✓ VERIFIED

### care_log hand-off i===0 guard

  CLAIM: care_log attached to first token only (i === 0 guard).

  CHECK: seed-claim/index.ts line 383 --
    `if (i === 0 && care_log && care_log.length > 0) {`
  Confirmed.

  RESULT: ✓ VERIFIED

---

## INTENT CHECK

```
INTENT CHECK
  code does:     seed-claim loops count times; each iteration atomically assigns
                 tokenId from sequence, INSERTs trees row with seeds[i], submits
                 writeContract with explicit nonce (baseNonce + i as number);
                 waits all receipts in parallel; enqueues render jobs; updates
                 seed_claims.token_ids. useSeedPurchase sends seeds[] array,
                 no seed-tree call anywhere.
  check expects: tsc --noEmit exits 0 (observed: EXIT:0)
  spec says:     ARCH §6.5 seeds[i] -> token i server-side; BLOCKER-1 option A
                 (seed-claim creates trees row); BLOCKER-2 explicit nonce;
                 MAJOR-1 find-or-create; MAJOR-2 render_queue; MAJOR-3 seeds[i];
                 MAJOR-4 count+seeds guards.
  verdict:       ALIGNED -- with nonce-type discrepancy noted (implementation
                 correct; arch doc's bigint claim was wrong).
```

---

## SCOPE

  Files the implementer reported changing:
    apps/server/supabase/migrations/20260806000001_trees_token_id.sql  [NEW]
    apps/server/supabase/migrations/20260806000002_render_queue.sql    [NEW]
    apps/server/supabase/migrations/20260806000003_seed_claims_token_ids.sql [NEW]
    apps/server/supabase/functions/seed-claim/index.ts                 [MODIFIED]
    apps/web/src/wallet/useSeedPurchase.ts                             [MODIFIED]
    apps/web/src/components/StoreModal.tsx                             [MODIFIED]
    apps/web/src/components/SeedShopModal.tsx                          [MODIFIED]

  All reported changes confirmed present.

  SCOPE VIOLATION: kijo/docs/pipeline/IMPL-CARE-WIRING-2026-08-02.md was
    MODIFIED but NOT disclosed in the implementer's completion report.
    git status shows this file as ' M' (modified).
    diff shows: status line updated, DONE WHEN table and INTENT CHECK block
    added, and WHAT WAS BUILT section expanded.
    -- The content refers to useSeedPurchase.ts line 142 as initTree() --
       but initTree() no longer exists in the rewritten useSeedPurchase.ts.
       These are STALE line references to the pre-rewrite code.
    -- The change itself is doc-only and does not affect any build artifact.
    -- Low risk, but undisclosed. Jeremy should confirm this was intentional.

  DECISIONS.md: NOT updated (correct -- implementer stated explicitly that
    DECISIONS.md entries are appended AFTER auditor passes).

---

## FRAUDS HUNTED

  weakened tests:     NONE. No test files appear in git status (modified or
                      untracked). No existing test was touched.

  false completion:   NONE. tsc --noEmit was re-run directly. EXIT:0 observed.
                      Implementation report's only binary claim is tsc; verified.

  intent inversion:   NONE. grep for 'seed-tree' in useSeedPurchase.ts and
                      seed-claim/index.ts: zero matches. The mint path does not
                      call seed-tree. Guest path preserved in seed-tree/index.ts
                      unmodified.

  phantom evidence:   PARTIAL. kijo/docs/pipeline/IMPL-CARE-WIRING-2026-08-02.md
                      references "useSeedPurchase.ts line 142" as initTree(),
                      but initTree() was deleted in this rewrite. The stale
                      reference is in an old doc (2026-08-02, care-wiring task),
                      not in the current implementation report. Low severity --
                      the audit doc reflects old state, not the post-rewrite state.

---

## ITEMS FOR JEREMY'S SIGN-OFF

  CAVEAT-1: Nonce type (number vs bigint)
    The arch doc (ARCH-MULTI-MINT-TOKENTREE-LINK.md ss6.4) states:
      "// viem v2 writeContract accepts nonce as bigint."
      "nonce: BigInt(baseNonce) + BigInt(i)"
    The implementation uses: `nonce: baseNonce + i` (plain number).
    tsc --noEmit exits 0 with number, proving viem v2 accepts number here.
    The arch doc was wrong about the type. The implementation is CORRECT.
    ACTION: Update arch doc ss6.4 to reflect that nonce is number, not bigint.
    BLOCKING? No -- functionally correct.

  CAVEAT-2: Undisclosed file modification
    kijo/docs/pipeline/IMPL-CARE-WIRING-2026-08-02.md was modified and not
    mentioned in the completion report. The content contains stale line numbers
    from the pre-rewrite useSeedPurchase.ts (references to initTree() at line 142
    that no longer exist). The file is doc-only, not compiled.
    ACTION: Confirm intentional; update stale line references if the doc is to
    be kept accurate.
    BLOCKING? No -- does not affect build or runtime.

---

## BOTTOM LINE

All seven BLOCKER/MAJOR fixes are confirmed correct by direct code inspection and
observed tsc exit 0. The seed + care_log -> identical tree invariant is preserved:
seeds[i] is paired server-side with token i in the loop, eliminating client-side
position ambiguity on partial failure. Two caveats (nonce type discrepancy in arch
doc; one undisclosed doc modification with stale line refs) require Jeremy's
acknowledgment but do not block the Linter stage.

