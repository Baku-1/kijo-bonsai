# AUDIT -- Web3 Security Corrections
# DATE: 2026-08-17
# STAGE: Auditor (adversarial-auditor skill)
# PIPELINE: AUDIT-WEB3-PURCHASE-SECURITY -> ARCH -> CRITIC -> IMPL -> **AUDIT (this doc)** -> Linter
# STATUS: VERIFIED WITH CAVEATS

---

## VERDICT: VERIFIED WITH CAVEATS

All 5 security fixes are correctly implemented. All gate binaries pass by direct
observation. Five Carmack-Linus patches confirmed present. One caveat (C1: JWT expiry
not runtime-enforced) is a known Supabase limitation, not a code error. Two architectural
notes (C2: deploy required, C3: concurrent silentRefresh) are inherited from the
implementer's own caveats and assessed below.

---

## GATES (run by auditor -- not taken from implementer report)

```
tsc apps/web:      PASS  (exit 0, zero errors, zero output)
engine test:       PASS  (23/23 -- CLR-WIRE-1/2/3/4 all pass; exit 0)
npm test:          PASS  (49/49 pass, 0 fail, 0 skip; exit 0)
```

Commands run:
```
cd apps/web && npx tsc --noEmit 2>&1; echo "EXIT:$?"
  -> EXIT:0

node packages/engine/test_carelogreplay_wire.mjs 2>&1; echo "EXIT:$?"
  -> 23 passed, 0 failed  EXIT:0

npm test 2>&1 | tail -10; echo "EXIT:$?"
  -> 49 pass, 0 fail  EXIT:0
```

---

## FRAUD CHECKS

```
Weakened tests:    NONE -- test files not in implementer's changed-file list;
                           npm test and engine gate pass with unchanged test content.

False completion:  NONE -- all three gates re-run by auditor; exit codes observed
                           directly, not taken from implementer transcript.

Intent inversion:  NONE -- see INTENT CHECK below.

Phantom evidence:  NONE -- all 5 source files read directly; line-number claims
                           checked against actual file content; see per-fix
                           verification below.
```

---

## INTENT CHECK

```
INTENT CHECK -- A8-2 (highest-risk item; Critic B1 blocking correction)
  code does:     ALLOWED_GUEST_ACTION_TYPES = new Set(['water','prune','wire',
                 'wire-remove','fertilize','rotate']) at module scope, line 121 of
                 seed-claim/index.ts (above Deno.serve at line 129). 'tick' absent.
                 'rotate' present.
  check expects: Critic B1 mandatory correction: tick EXCLUDED (server-scheduled,
                 GDD ss8.2), rotate INCLUDED (valid guest action, GDD ss3.1).
                 Set must match care-action/index.ts ALLOWED_ACTION_TYPES exactly.
  spec says:     ARCH spec (before Critic correction): tick IN, rotate OUT.
                 CRITIC B1 (overrides spec): tick OUT, rotate IN.
  verdict:       ALIGNED with Critic B1. Implementer correctly followed the
                 correction, not the original spec text. No intent inversion.

INTENT CHECK -- A3-1 (cross-chain replay fix)
  code does:     useWallet.ts uses useSignTypedData with domain { name:'Kijo',
                 version:'1', chainId, verifyingContract: KIJO_CONTRACT }.
                 wallet-auth/index.ts uses verifyTypedData with identical domain.
                 chainId sourced from chain?.id || VITE_RONIN_CHAIN_ID || 202601
                 (client); parseInt(RONIN_CHAIN_ID) || 202601 (server).
  check expects: EIP-712 domain binding with chainId and verifyingContract.
                 Both sides must be identical.
  spec says:     Replace personal_sign / verifyMessage with signTypedDataAsync /
                 verifyTypedData; domain: name, version, chainId, verifyingContract.
  verdict:       ALIGNED. Implementation matches spec + Critic C4 deviation
                 (VITE env vars instead of hardcoded literals).

INTENT CHECK -- A5-1/A8-1 (server-side seed generation)
  code does:     seed-claim generates seeds via crypto.getRandomValues(new Uint32Array(count)).
                 'seeds' key absent from fetch body in useSeedPurchase.ts (lines 137-143).
                 pendingSeedsRef and Math.random() block removed. Seeds included in response.
  check expects: Client no longer provides seeds; server CSPRNG generates them.
  spec says:     Same.
  verdict:       ALIGNED.
```

---

## ALLOWLIST CHECK

```
tick excluded:    YES -- 'tick' not present in Set on line 121
rotate included:  YES -- 'rotate' present in Set on line 121
module scope:     YES -- const declared at line 121, Deno.serve begins at line 129
matches care-action ALLOWED_ACTION_TYPES: YES
  care-action: Set(['water','prune','wire','wire-remove','fertilize','rotate'])
  seed-claim:  Set(['water','prune','wire','wire-remove','fertilize','rotate'])
  IDENTICAL
```

---

## CARMACK-LINUS PATCHES VERIFIED (all 5)

All patches confirmed by direct file read. Not taken from implementer report.

```
Patch 1 -- chainId empty-string footgun (useWallet.ts line 47):
  CONFIRMED: chain?.id ?? (Number(import.meta.env.VITE_RONIN_CHAIN_ID || '202601'))
  '||' prevents empty string from producing chainId:0. '??' version would pass
  empty string through to Number(), yielding 0.

Patch 2 -- RONIN_CHAIN_ID NaN guard (wallet-auth/index.ts line 55):
  CONFIRMED: parseInt(Deno.env.get('RONIN_CHAIN_ID') ?? '202601', 10) || 202601
  '|| 202601' catches NaN when secret is set to a non-integer string. Without this,
  viem.verifyTypedData with chainId:NaN in domain would reject every valid signature.

Patch 3a -- SUPABASE_ANON_KEY undefined cast (useWalletAuth.ts line 43):
  CONFIRMED: (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '') as string
  ?? '' prevents undefined being cast to string. Without this, the apikey
  header would be the string 'undefined'.

Patch 3b -- silentRefresh guard (useWalletAuth.ts line 129):
  CONFIRMED: if (!rt || !SUPABASE_ANON_KEY) return false;
  Explicit guard for missing env var. Without this, fetch would proceed with
  an empty apikey header, producing a confusing 401 with no log.

Patch 4 -- ALLOWED_GUEST_ACTION_TYPES at module scope (seed-claim/index.ts line 121):
  CONFIRMED: const ALLOWED_GUEST_ACTION_TYPES at line 121, above Deno.serve (line 129).
  Implementer stated it was previously buried inside nested if-blocks; now auditable
  at the top of the handler file.

Patch 5 -- Stale header comment removed (useSeedPurchase.ts):
  CONFIRMED: Header (lines 1-31) accurately describes server-side CSPRNG seed gen
  and the absence of seeds from the request body. No reference to 'seeds array
  (one random int per token)' remains.
```

---

## SCOPE VERIFICATION

Implementer reported 8 files changed. Auditor confirmed all 8 via direct read and grep:

```
apps/web/.env.local                                 -- new; VITE env vars present
apps/web/src/wallet/useWallet.ts                    -- A3-1; 76 lines; confirmed
apps/server/supabase/functions/wallet-auth/index.ts -- A3-1+A7-1+A7-2; 262 lines; confirmed
apps/web/src/wallet/useWalletAuth.ts                -- A7-2 client; 169 lines; confirmed
apps/server/supabase/functions/seed-claim/index.ts  -- A5-1/A8-1/A8-2; 544 lines; confirmed
apps/web/src/wallet/useSeedPurchase.ts              -- A5-1 client+A7-2 callsite; confirmed
apps/web/src/App.tsx                                -- A7-2 wiring; silentRefresh confirmed
apps/web/src/components/StoreModal.tsx              -- A7-2 wiring; prop confirmed
```

No unexpected files changed (engine, voxelizer, shared, test files untouched -- confirmed
by gate results: npm test and engine test pass on unchanged suites).

---

## CAVEATS ASSESSED

**C1 -- JWT expiry not runtime-enforced (A7-1)**
Assessment: ACCEPTABLE AT CURRENT STAGE. The JWT_EXPIRY_SECONDS_EXPECTED constant
with RFC 7519 + OWASP citations is the correct documentation artifact for a dashboard-
only setting. Runtime enforcement would require either (a) reading the 'exp' claim
from the JWT and comparing it, or (b) Supabase config-as-code. Neither is in scope
for this fix. The constant is a forcing function. Risk is low: the Supabase default
is 3600s and the implementer confirmed it is at the default. Post-audit action:
Jeremy should visually verify in Dashboard -> Auth -> JWT Settings and fill in the
date in the DECISIONS.md entry. This is not a blocker for the gate.

**C2 -- Edge Function deployment not performed**
Flag: POST-AUDIT REQUIRED. Both wallet-auth/index.ts and seed-claim/index.ts are
modified locally but not deployed to Supabase project xutjubkaskwchzyzwryk.
The security fixes (A3-1, A5-1/A8-1, A8-2) are NOT live until deployment runs:
  supabase functions deploy wallet-auth --project-ref xutjubkaskwchzyzwryk
  supabase functions deploy seed-claim  --project-ref xutjubkaskwchzyzwryk
This is expected (implementer constraint: no commit/deploy in task sessions).
Jeremy must run these commands before the fixes take effect on testnet.

**C3 -- Concurrent silentRefresh race condition**
Assessment: ACCEPTABLE at current call site. A single call site exists:
useSeedPurchase.buySeeds() -> one StoreModal -> one user action. Two concurrent
callers are not reachable in the current component tree. The risk is real but
theoretical until additional call sites are added. The implementer's note to
add a debounce/in-flight lock in Phase 2 is correct. Not a Phase 1 blocker.

---

## OPEN ITEMS FOR JEREMY

1. **Deploy Edge Functions** (C2 -- required before fixes are live):
   ```
   supabase functions deploy wallet-auth --project-ref xutjubkaskwchzyzwryk
   supabase functions deploy seed-claim  --project-ref xutjubkaskwchzyzwryk
   ```

2. **Confirm JWT expiry in Supabase Dashboard** (A7-1):
   Dashboard -> Authentication -> JWT Settings -> confirm value is 3600s.
   Fill in date in the DECISIONS.md entry added by the implementer.

3. **Set RONIN_CHAIN_ID Supabase secret** (A3-1):
   ```
   supabase secrets set RONIN_CHAIN_ID=202601 --project-ref xutjubkaskwchzyzwryk
   ```

4. **DECISIONS.md** -- the implementer's report does not mention appending the
   JWT expiry and guest-seed-mismatch entries to DECISIONS.md. Linter should
   verify these are present before closing the pipeline.

---

## BOTTOM LINE

All 5 security fixes (A3-1, A5-1/A8-1, A7-1, A7-2, A8-2) are correctly implemented.
Critic B1's mandatory correction (tick OUT, rotate IN) was followed exactly. Five
Carmack-Linus edge-case bugs are confirmed patched. All three gates pass by direct
observation (tsc EXIT:0, engine 23/23, npm 49/49). The implementation is ready for
the Linter stage; the two mainnet blockers (A3-1, A5-1/A8-1) are resolved in code
pending deployment.

---

*Auditor: adversarial-auditor skill. No code changes. No commits.*
*Gates re-run independently; implementer transcript not trusted as evidence.*
