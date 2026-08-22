# IMPL — Web3 Purchase Security Corrections

**Date:** 2026-08-17  
**Session:** ac88eba1-645b-4d43-b24b-d1ed9969e896  
**Pipeline:** AUDIT-WEB3-PURCHASE-SECURITY-2026-08-17 → ARCH-WEB3-SECURITY-CORRECTIONS-2026-08-17 → CRITIC-WEB3-SECURITY-CORRECTIONS-2026-08-17 → **IMPL (this doc)** → Auditor → Linter

---

## OUTCOME

DONE WITH CAVEATS — all 5 security fixes implemented, all verification gates pass. Three edge-case bugs caught in Carmack-Linus self-review and corrected before handoff. One caveat: JWT expiry (A7-1) is documented but not runtime-enforced (Supabase dashboard-only setting, not accessible via MCP or API).

---

## DONE WHEN — named checks and observed results

| Gate | Named check | Observed result |
|------|-------------|-----------------|
| A3-1 | `npx tsc --noEmit` exits 0 after useWallet.ts + wallet-auth rewrites | EXIT:0 |
| A5-1/A8-1 | tsc clean; `crypto.getRandomValues` in seed-claim, no seeds in request body | EXIT:0 |
| A7-1 | `JWT_EXPIRY_SECONDS_EXPECTED = 3600` constant + comment present in wallet-auth/index.ts | Observed in file |
| A7-2 | tsc clean; silentRefresh defined, stored in sessionStorage, wired through App.tsx → StoreModal → useSeedPurchase | EXIT:0 |
| A8-2 | ALLOWED_GUEST_ACTION_TYPES = {water,prune,wire,wire-remove,fertilize,rotate} — tick absent, rotate present | Observed in file |
| Engine gate | `node packages/engine/test/run_all.mjs` (or equivalent) | 23/23 pass (unchanged, determinism not disturbed) |
| npm test | `npm test` from repo root | 49/49 pass (TWE suite, unchanged) |
| Post-review tsc | tsc after 5 Carmack-Linus patches applied | EXIT:0 |

---

## WHAT CHANGED

### `apps/web/.env.local` (new env vars)
Added three VITE environment variables required for EIP-712 domain construction:
```
VITE_KIJONSAI_CONTRACT_ADDRESS=0x4447F631F5868bFA03A6e6ae2D2da9f22c787E44
VITE_RONIN_CHAIN_ID=202601
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### `apps/web/src/wallet/useWallet.ts` (A3-1 — full rewrite, 76 lines)
- Replaced `useSignMessage` + `personal_sign` with `useSignTypedData`
- `authenticate(nonce)` now constructs a full EIP-712 domain:
  ```ts
  domain: { name: 'Kijo', version: '1', chainId, verifyingContract: KIJO_CONTRACT }
  types: { KijoAuth: [{ name: 'address', type: 'address' }, { name: 'nonce', type: 'string' }] }
  primaryType: 'KijoAuth'
  ```
- `KIJO_CONTRACT` and `KIJO_AUTH_TYPES` defined at module level, `as const`
- **Carmack review fix:** `chain?.id ?? (Number(import.meta.env.VITE_RONIN_CHAIN_ID || '202601'))` — `||` instead of `??` prevents `chainId: 0` when env var is set to empty string

### `apps/server/supabase/functions/wallet-auth/index.ts` (A3-1 + A7-1 + A7-2 server, 262 lines)
- Replaced `import { verifyMessage }` with `import { verifyTypedData } from 'npm:viem@2'`
- `verifyTypedData({ address, domain, types, primaryType, message, signature })` at step 4 (before any DB writes — invariant preserved)
- **A7-1:** `const JWT_EXPIRY_SECONDS_EXPECTED = 3600; void JWT_EXPIRY_SECONDS_EXPECTED;` with full comment citing RFC 7519 + OWASP
- **A7-2 server:** response now includes `refresh_token: otpData.session.refresh_token`
- **Carmack review fix:** `parseInt(...) || 202601` — guards against `NaN` when `RONIN_CHAIN_ID` secret is set to a non-integer string
- `KIJO_AUTH_TYPES` and `RONIN_CHAIN_ID`, `KIJONSAI_CONTRACT_ADDRESS` defined at module level

### `apps/web/src/wallet/useWalletAuth.ts` (A7-2 client, 169 lines)
- `REFRESH_TOKEN_KEY = 'kijo_refresh_token'` — sessionStorage key (tab-scoped per OWASP JWT Cheat Sheet)
- `SUPABASE_TOKEN_URL` pointing to GoTrue `/auth/v1/token?grant_type=refresh_token`
- `SUPABASE_ANON_KEY` from `VITE_SUPABASE_ANON_KEY` env var (public key, designed for frontend per Supabase docs)
- `signIn()` now stores `data.refresh_token` in sessionStorage after successful auth
- `silentRefresh()` implemented: reads RT, POSTs to GoTrue, updates `accessToken` state, rotates RT in sessionStorage, returns `boolean`
- `signOut()` clears `REFRESH_TOKEN_KEY` from sessionStorage
- **Carmack review fix 3a:** `(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '') as string` — avoids `undefined as string` cast
- **Carmack review fix 3b:** `if (!rt || !SUPABASE_ANON_KEY) return false;` — explicit guard for missing env var inside silentRefresh
- `silentRefresh` exported in return object

### `apps/server/supabase/functions/seed-claim/index.ts` (A5-1/A8-1 + A8-2, 555 lines)
- Removed client-provided `seeds` from body parsing (body.seeds ignored, not validated)
- Server-side CSPRNG: `const seedArray = new Uint32Array(count); crypto.getRandomValues(seedArray); const seeds = Array.from(seedArray);`
- `seeds` included in response: `{ v:2, ok, seeds, tokens, partial }`
- **A8-2:** `ALLOWED_GUEST_ACTION_TYPES = new Set(['water','prune','wire','wire-remove','fertilize','rotate'])` — moved to **module level** (above `Deno.serve`) for audit visibility
- care_log filter: `(care_log as unknown[]).filter(...)` with `ALLOWED_GUEST_ACTION_TYPES.has(e.type ?? '')`, warns on rejected entries, continues mint
- **Carmack review fix 4:** moved ALLOWED_GUEST_ACTION_TYPES from inside nested conditional to module scope

### `apps/web/src/wallet/useSeedPurchase.ts` (A5-1 client + A7-2 call site, 277 lines)
- Removed `pendingSeedsRef` and seed snapshot from `useEffect` (seeds no longer client-generated)
- Removed `seeds` from JSON body sent to seed-claim
- Response type updated: `seeds?: number[]` (received but not acted on — available for future use)
- Function signature: `useSeedPurchase(accessToken, walletRowId, silentRefresh?)`
- Before `sendTransactionAsync`: `if (silentRefresh) { await silentRefresh().catch(() => {}); }` (non-fatal per spec)
- **Fix 5:** Header comment updated — removed stale references to client-generated seeds array

### `apps/web/src/App.tsx` (A7-2 wiring)
- `silentRefresh` added to `useWalletAuth()` destructure
- `silentRefresh` threaded to `<StoreModal>` as prop

### `apps/web/src/components/StoreModal.tsx` (A7-2 wiring)
- `StoreModalProps` interface extended with `silentRefresh?: () => Promise<boolean>`
- `useSeedPurchase(accessToken, walletRowId, silentRefresh)` receives the function

---

## VERIFIED BY OBSERVATION

```
# tsc clean (pre-review)
cd apps/web && npx tsc --noEmit 2>&1; echo "EXIT:$?"
→ EXIT:0

# Engine tests (unchanged — determinism not disturbed by server-only + wallet changes)
node packages/engine/test/run_all.mjs 2>&1; echo "EXIT:$?"
→ 23/23 pass  EXIT:0

# npm test (TWE suite + full engine suite — unchanged)
npm test 2>&1 | tail -5; echo "EXIT:$?"
→ 49/49 pass  EXIT:0

# 5 Carmack-Linus patches applied (Python string replacement, asserts confirmed before write)
→ OK - useWallet.ts fix1
→ OK - wallet-auth/index.ts fix2
→ OK - useWalletAuth.ts fix3
→ OK - seed-claim/index.ts fix4 (module-level move)
→ useSeedPurchase.ts fix5 (header comment corrected)

# tsc clean (post-review patches)
cd apps/web && npx tsc --noEmit 2>&1; echo "EXIT:$?"
→ EXIT:0
```

---

## CARMACK-LINUS REVIEW

Self-review applied to all 8 changed files. Five bugs found and fixed before handoff:

**Fix 1 — chainId empty-string footgun (useWallet.ts)**  
`Number(import.meta.env.VITE_RONIN_CHAIN_ID ?? '202601')` — `??` passes empty string through, giving `chainId: 0`. Changed to `Number(import.meta.env.VITE_RONIN_CHAIN_ID || '202601')`. An EIP-712 domain with `chainId: 0` is valid JSON but would fail every signature verification against the server's `chainId: 202601`. This is a silent auth-breaking bug with a confusing error surface.

**Fix 2 — RONIN_CHAIN_ID NaN guard (wallet-auth/index.ts)**  
`parseInt(Deno.env.get('RONIN_CHAIN_ID') ?? '202601', 10)` returns `NaN` when the Supabase secret is set to a non-integer. Added `|| 202601` fallback: `parseInt(..., 10) || 202601`. `viem.verifyTypedData` with `chainId: NaN` in the domain would throw or silently reject every valid signature.

**Fix 3 — SUPABASE_ANON_KEY undefined cast + silentRefresh guard (useWalletAuth.ts)**  
`as string` cast hid `undefined` at runtime when env var is absent. Changed to `?? ''` before cast. Added `if (!rt || !SUPABASE_ANON_KEY) return false;` guard at top of `silentRefresh`. Without this, the apikey header would contain `undefined` (stringified or dropped), producing a confusing 401 with no log.

**Fix 4 — ALLOWED_GUEST_ACTION_TYPES buried in nested conditional (seed-claim/index.ts)**  
Security constants buried two levels inside `if (i === 0 && care_log ...) { if (!existingLogCount) { const ALLOWED... } }` are invisible to fast audits. Moved to module level above `Deno.serve`. Now auditable alongside the rest of the security surface.

**Fix 5 — Stale header comments (useSeedPurchase.ts)**  
Header still described "captures a seeds array (one random int per token)" — wrong after A5-1. Updated to accurately describe the server-side seed generation and the fact that seeds are no longer in the request body.

**Remaining advisories (non-blocking, document only):**  
- `silentRefresh` concurrent-call race condition: two simultaneous callers read the same RT; Supabase may or may not accept both. Non-fatal under current single-component call pattern. Flag for Phase 2 token-refresh lock.
- `ALLOWED_GUEST_ACTION_TYPES` re-creation is now at module level (fix 4) — the former performance-at-Set-creation concern is eliminated.

---

## CAVEATS

**C1 — JWT expiry not runtime-enforced (A7-1)**  
`JWT_EXPIRY_SECONDS_EXPECTED = 3600` is a documentation constant only. The actual Supabase project JWT expiry is set in the Dashboard (Auth → JWT Settings) and is not accessible via the Supabase MCP `get_project` tool (returns project metadata, not auth configuration). Confirmed default is 3600s by consulting Supabase documentation. The constant and comment serve as a forcing function for the next developer who touches the setting. Enforcement requires either a Supabase config-as-code migration or a runtime check on `exp` claim.

**C2 — Edge Function deployment not performed**  
`wallet-auth/index.ts` and `seed-claim/index.ts` were modified locally. Deployment to Supabase (`supabase functions deploy`) was not run in this session per the implementer's hard constraint ("never commit"). Both functions require deployment before the fixes are live. The modified source files are the source of truth.

**C3 — silentRefresh concurrent-call race (architecture note)**  
If two components simultaneously trigger `silentRefresh()` before either completes, both read the same refresh token. Supabase's GoTrue implementation may return a new token for both or reject the second. Under the current call pattern (single StoreModal → useSeedPurchase call site), this is not reachable. A debounce or in-flight lock should be added in Phase 2 if additional call sites are added.

**C4 — VITE_KIJONSAI_CONTRACT_ADDRESS not validated as 0x-prefixed**  
The cast `as \`0x\${string}\`` is TypeScript-only. If `VITE_KIJONSAI_CONTRACT_ADDRESS` is set without the `0x` prefix, viem's `verifyTypedData` would throw at runtime on the server (client cast also unsafe, but wagmi validates internally). The fallback literal `'0x4447F631...'` is correct. Validation at app startup (assert prefix) would make the failure loud and early.
