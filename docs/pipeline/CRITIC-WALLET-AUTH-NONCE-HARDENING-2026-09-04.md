# CRITIC REVIEW: Wallet-Auth Nonce Hardening — Server-Issued Crypto Nonces
# DATE: 2026-09-04
# STAGE: Critic
# SPEC REVIEWED: ARCH-WALLET-AUTH-NONCE-HARDENING-2026-09-04.md

---

## VERDICT: PASS WITH CAVEATS

The spec is thorough, well-researched, and security-conscious. All 4 deliverables are
specified with sufficient detail for an implementer. Wiki citations verified against
source pages. CEI pattern correctly applied. No contradictions with DECISIONS.md,
STATE.md, or the prior security spec (ARCH-WEB3-SECURITY-CORRECTIONS-2026-08-17).

The caveats below are implementer action items — none require the architect to revise.

---

## REVIEW CRITERIA

### 1. Completeness — All 4 Deliverables Covered

| Deliverable | Covered | Detail Level |
|-------------|---------|--------------|
| auth_nonces Supabase table | YES | Full SQL migration, 3 indices, RLS, column rationale, cleanup SQL |
| wallet-auth-nonce Edge Function (NEW) | YES | Full implementation code, request/response shapes, security invariants |
| Updated wallet-auth Edge Function | YES | Remove/replace blocks with exact old/new code, CEI ordering annotated |
| Updated useWalletAuth.ts | YES | fetchNonce() function, updated signIn() flow, dual entry point guarantee |

**Finding: NONE.** All deliverables fully specified.

### 2. Security Invariants

| Invariant | Specified | Correct |
|-----------|-----------|---------|
| 128-bit entropy nonce | YES | crypto.getRandomValues(Uint8Array(16)) = 128 bits. Exceeds EIP-4361 minimum. |
| Single-use (atomic) | YES | UPDATE ... WHERE used = false; 0 rows = rejected. No TOCTOU. |
| CEI ordering | YES | Mark used BEFORE verifyTypedData. Race condition analysis provided. |
| 5-minute expiry | YES | expires_at = created_at + 5 min. Checked server-side. |
| Rate limiting | YES | 10 per wallet per 5-min sliding window. |
| Address binding | YES | Nonce bound to wallet_address; cross-wallet rejected. |
| RLS (no client access) | YES | RLS enabled, no policies = service_role only. |

**Finding F1 (MEDIUM): Multi-address nonce flooding not addressed.**

The rate limit is per-wallet (10/5min). An attacker can generate nonces from unlimited
wallet addresses, each creating a DB row. Without IP-based or global rate limiting, this
is a table-bloat DoS vector. Supabase infrastructure may provide some protection, and
the cleanup job mitigates accumulation, but the spec should acknowledge this gap.

**Implementer action:** Add a comment noting the limitation. For production, add either
Supabase Edge Function invocation-rate limiting (via Supabase dashboard) or an IP-based
check. Not a blocker for testnet.

### 3. Consistency — EIP-712 Domain/Types Match

| Element | Spec Value | Prior Spec (A3-1) | Match |
|---------|-----------|-------------------|-------|
| KIJO_AUTH_TYPES | [{name:'address',type:'address'},{name:'nonce',type:'string'}] | Same | YES |
| Domain separator | name, version, chainId, verifyingContract | Same | YES |
| authenticate() signature | (nonce: string) => Promise<string> | Same | YES |
| wallet-auth request body | { address, signature, nonce } | Same | YES |
| wallet-auth response | { access_token, refresh_token, user_id } | Same | YES |
| RONIN_CHAIN_ID | 202601 (Saigon default) | Same | YES |
| KIJONSAI_CONTRACT_ADDRESS | 0x4447F631F5868bFA03A6e6ae2D2da9f22c787E44 | Same | YES |
| Nonce field type | 'string' (hex nonce is a string) | 'string' | YES |

**Finding: NONE.** Full consistency with prior spec.

### 4. Error Handling

All failure modes specified:

**Server-side:** invalid nonce (401), nonce expired (401), wrong wallet (401), nonce
already used (401), invalid signature (401), DB errors (500), rate limit (429).

**Client-side:** Rate limit, server error, network error, user rejection, expiry,
replay, invalid signature — all with user-facing messages and recovery actions.

**Race condition:** Concurrent-request scenario explicitly analyzed with step-by-step
UPDATE atomicity proof.

**Finding F2 (MEDIUM): Client discards expires_at without comment.**

`fetchNonce()` receives `{ nonce, expires_at }` but only returns `nonce`. If the user
is on a slow connection and 4+ minutes elapse between nonce fetch and signature
submission, the nonce expires server-side. The spec should state whether the client
should: (a) check expires_at before signing and auto-retry if close to expiry, or
(b) intentionally discard it and let the server reject (current behavior).

**Implementer action:** The current design (discard + server rejection) is acceptable
for MVP. Add a code comment explaining the deliberate choice. Consider a future
enhancement: if `Date.now() > expires_at - 30_000`, auto-fetch a fresh nonce before
signing.

### 5. Dual Entry Points — Store UI + Header

**Finding: NONE.** This is well-handled.

The spec explicitly addresses dual entry points (lines 29-39, 816-829):
- Both store and header call `useWalletAuth().signIn()`
- fetchNonce() is encapsulated inside signIn()
- Anti-pattern explicitly called out with "DO NOT" example
- Public API unchanged: signIn() remains no-arg

### 6. Contradictions with Prior Decisions

**Checked against:**
- DECISIONS.md — no wallet-auth decisions recorded (all engine/voxelizer/statderiver).
  No conflicts.
- STATE.md — web, server, contracts listed as "Not Yet Built." Spec correctly
  acknowledges greenfield (no files on disk). No conflicts.
- ARCH-WEB3-SECURITY-CORRECTIONS-2026-08-17.md — spec builds on Fix A3-1 EIP-712
  upgrade. Types, domain, signatures all consistent. Dependency chain clear (A3-1
  must be implemented first). No conflicts.

**Finding: NONE.** No contradictions.

### 7. Second Brain Wiki Citation Accuracy

| Citation | Wiki Page | Verified |
|----------|-----------|----------|
| dwi nonce: crypto.getRandomValues(Uint8Array(16)) -> hex | wiki/patterns/dwi/siwe-convex-auth.md Pattern 2 | YES — exact code matches |
| truongnguyenptn CEI: state change before external call | wiki/patterns/truongnguyenptn/ronin-security.md | YES — pattern matches |
| truongnguyenptn replay: atomic nonce consumption | wiki/patterns/truongnguyenptn/ronin-security.md | YES — sequential nonce pattern cited, adaptation to random nonces correctly noted |
| truongnguyenptn rate limiting: per-address cooldown | wiki/patterns/truongnguyenptn/ronin-security.md | YES — adaptation from on-chain cooldown to SQL sliding window correctly noted |
| Decision page wiki/decisions/wallet-auth-nonce-hardening.md | Read directly | YES — matches spec content |

**Finding: NONE.** All citations accurate.

---

## FINDINGS SUMMARY

| ID | Severity | Finding | Implementer Action |
|----|----------|---------|-------------------|
| F1 | MEDIUM | Multi-address nonce flooding: rate limit is per-wallet only; no IP/global limit | Add comment acknowledging gap. For production: configure Supabase invocation rate limiting or add IP check. Not a testnet blocker. |
| F2 | MEDIUM | Client discards expires_at: slow-connection users may hit server-side expiry with no client-side warning | Add code comment explaining intentional discard. Consider future enhancement: pre-flight expiry check before signing. |
| F3 | LOW | Deno serve() import: spec uses `import { serve } from 'https://deno.land/std/http/server.ts'` without version pin. Modern Supabase Edge Functions use `Deno.serve()` directly. | Use whichever pattern the project's other Edge Functions use. If greenfield, prefer `Deno.serve()` (no import needed). |
| F4 | LOW | CORS wildcard `Access-Control-Allow-Origin: '*'`: acceptable for testnet, should be tightened for production | Match existing wallet-auth pattern. Flag for production hardening. |
| F5 | LOW | Error message inconsistency: client failure table says "Authentication failed" for expired nonce, but the actual code shows the server's error message directly via `err.message` | Minor documentation inconsistency. The code behavior (showing server message) is correct. |

---

## WHAT THE IMPLEMENTER MUST ADDRESS BEYOND THE SPEC

1. **F1 — Multi-address flooding comment:** Add a TODO comment in the wallet-auth-nonce
   function acknowledging that per-wallet rate limiting does not prevent multi-address
   flooding. Note that Supabase infrastructure-level rate limiting is the mitigation.

2. **F2 — expires_at discard comment:** Add a code comment in fetchNonce() explaining
   why expires_at is fetched but not used client-side.

3. **F3 — Deno.serve() vs imported serve():** Check if the project has existing Edge
   Functions and match their pattern. If greenfield, use `Deno.serve()` (built-in,
   no import, version-pinning-safe).

4. **Invoke required skills:** `disciplined-implementer` + `engineering-craft-standard`
   per pipeline SOP. Run `carmack-linus-review` after implementation, before auditor.

---

## SPEC QUALITY NOTES (for the record)

Strengths of this spec:
- Verification log with VERIFIED / UNVERIFIED / REFUTED classification — excellent
- Code Source Audits for every external snippet — proper provenance
- Race condition analysis with step-by-step atomicity proof
- Explicit "DO NOT DO" anti-pattern for dual entry points
- Cross-reference check against all related specs
- Clear dependency chain (A3-1 must exist first)
- Open questions are genuine open questions, not undecided requirements

---

*Critic review complete. Verdict: PASS WITH CAVEATS (5 findings, 0 HIGH, 2 MEDIUM, 3 LOW).*
*Implementer may proceed. Address F1-F3 during implementation.*
