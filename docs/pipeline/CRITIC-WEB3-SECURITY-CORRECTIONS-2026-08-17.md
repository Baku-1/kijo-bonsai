# CRITIC: Web3 Security Correction Passes
# DATE: 2026-08-17
# STAGE: Critic (adversarial-auditor skill)
# SPEC REVIEWED: docs/pipeline/ARCH-WEB3-SECURITY-CORRECTIONS-2026-08-17.md
# STATUS: APPROVED WITH CONDITIONS — one blocking spec correction on A8-2

---

## CRITIC VERDICT: APPROVED WITH CONDITIONS

Four of five fixes are sound or require implementer awareness only. Fix A8-2 has
one blocking spec error: the proposed `ALLOWED_GUEST_ACTION_TYPES` constant is
wrong in both directions -- `tick` included incorrectly (it is a server-scheduled
event per GDD, never a user action; client injection must be blocked) and `rotate`
excluded incorrectly (Jeremy confirmed it is a valid guest action per GDD ss3.1).
The implementer must use the corrected allowlist below, not the spec's literal text.

---

## FINDINGS BY FIX

```
A3-1  (EIP-712 domain binding):          CONCERNS (not blocking)
A5-1/A8-1 (server-side seed gen):        CONCERNS (not blocking)
A7-1  (JWT expiry confirmation):         SOUND
A7-2  (token refresh flow):              CONCERNS (not blocking)
A8-2  (care_log action whitelist):       BLOCKING ISSUE -- allowlist wrong
```

---

## BLOCKING ISSUES

### B1 -- A8-2: Spec's ALLOWED_GUEST_ACTION_TYPES is wrong on both tick and rotate

The spec proposes:
```typescript
const ALLOWED_GUEST_ACTION_TYPES = new Set([
  'water',
  'tick',        // spec says: "system-generated day-advance entries in guest session"
  'prune',
  'wire',
  'wire-remove',
  'fertilize',
  // 'rotate' excluded: "purpose unclear in a guest session"
]);
```

**Both decisions are wrong per Jeremy's resolutions (received this session) and
GDD authority. The corrected allowlist is at the bottom of this section.**

---

**'tick' must be EXCLUDED. This is not just wrong -- it is a security concern.**

GDD ss8.2: "Game server handles day ticks."
GDD ss3.2: "1 game day = 8 real hours" -- ticks are time-scheduled server events.

`tick` is never a user-submitted action. No user -- guest or authenticated -- ever
sends a tick action to the server. In care-action/index.ts, `tick` entries are
inserted server-side in the lazy-tick loop (lines 125-132); they are explicitly
excluded from care-action's own ALLOWED_ACTION_TYPES at line 98 (which does NOT
include 'tick') for exactly this reason.

Spec Assumption A-5 ("tick appears in guest localStorage care_log") is **false**.
Guest mode does not generate tick entries client-side. Ticks are server-scheduled.

Including 'tick' in the guest allowlist is a data-integrity risk: a malicious client
can inject fake 'tick' entries into the care_log submission, backdating game days
and corrupting the care log timeline for the converted tree. The A8-2 whitelist is
the primary server-side defense against this injection. The whitelist must REJECT
'tick', not silently pass it through.

---

**'rotate' must be INCLUDED. It is a valid guest care action per GDD.**

GDD ss3.1: "Rotate -- Rotates the tree 90 degrees. Simulates light exposure.
Affects directional growth bias (branches on the 'sun side' grow slightly faster).
Regular rotation produces balanced canopy. Neglecting rotation produces asymmetric
growth."

GDD fork algorithm: "Fork creates 1-2 child branches at angles influenced by
species and rotation state (light-side bias)."

Jeremy confirmed after reviewing GDD ss3.1 directly: guests DO get rotate. The
spec excluded rotate citing "purpose unclear in a guest session" -- GDD makes it
clear. GrowthEngine.ts currently has zero references to rotation (light-side bias
is specified but not yet implemented), but rotate is a legitimate care action with
defined game consequences once the bias lands. A converted guest tree with rotate
entries in its care_log must preserve those entries for correct future replay.

---

**Corrected constant -- implementer MUST use this:**

```typescript
// A8-2: Whitelist for guest care_log entries submitted via seed-claim.
// Prevents malicious clients from injecting fake or server-reserved action types.
// Matches care-action/index.ts ALLOWED_ACTION_TYPES exactly (same set).
// 'tick' is EXCLUDED: ticks are server-scheduled (GDD ss8.2 / ss3.2).
//   A 'tick' in the user-submitted care_log is a spoofed server event -- reject it.
// 'rotate' is INCLUDED: valid guest care action (GDD ss3.1, light-side bias).
// See ARCH-WEB3-SECURITY-CORRECTIONS-2026-08-17.md Fix A8-2 + Critic corrections.
const ALLOWED_GUEST_ACTION_TYPES = new Set([
  'water',
  'prune',
  'wire',
  'wire-remove',
  'fertilize',
  'rotate',
]);
```

This set is **identical** to care-action/index.ts `ALLOWED_ACTION_TYPES` (line 98).
The spec comment "subset appropriate for guest sessions" should be updated to
"matches care-action/index.ts ALLOWED_ACTION_TYPES exactly." One canonical set of
user-facing care actions; no drift between the two files.

---

**GDD rotation note for implementer awareness:**
Once GrowthEngine implements the light-side bias, guest trees converted via
seed-claim will replay correctly: trees that were rotated will have their rotation
entries applied; trees that were never rotated will grow with default sun-side
orientation. GDD notes "neglecting rotation produces asymmetric growth" -- this is
valid designed behavior. No engine change needed by A8-2; this is a forward note.

---

## CONCERNS (implementer should be aware, may proceed)

### C1 -- A3-1: Deployment transition window is under-specified

The spec says: "Deploy wallet-auth and apps/web atomically (or within the 5-minute
nonce window)."

This does not account for browser/CDN caching. A Vite build served from a CDN may
be stale in user browsers beyond the 5-minute nonce window. During that window:
- Old clients (EIP-191 sigs) hit new server (expects EIP-712) -- 401 "Signature invalid"
- OR new clients (EIP-712 sigs) hit old server (expects EIP-191) -- 401 "Signature invalid"

The failure is clean (401) and recoverable (user refreshes the page to get the new
client). Crucially, nonces are NOT burned on failed verification: in the actual
wallet-auth code, nonce insertion (labeled "section 2b") executes AFTER signature
verification (step 4). A failed EIP-712 check does not consume the nonce.

**Implementer guidance:** Deploy server first. Use Vite's content-hash filenames
(default in `vite build`) to bust browser caches. Document the deploy order in the
release note. Accept a brief window where old clients see 401 on auth.

### C2 -- A3-1: Verify KIJONSAI_CONTRACT_ADDRESS is present in wallet-auth environment

Spec Assumption A-4: Supabase secrets are project-wide; KIJONSAI_CONTRACT_ADDRESS
is already set for seed-claim therefore available to wallet-auth.

Supabase secrets are project-wide per documentation -- this assumption is almost
certainly correct. The fallback in the spec (`?? '0x4447F631...'`) is the correct
testnet address, so even a missing secret is safe for testnet. Still:
```
supabase secrets list --project-ref xutjubkaskwchzyzwryk
```
Run this before deploying wallet-auth to confirm.

### C3 -- A5-1/A8-1: Guest seed mismatch is intentional but should be in DECISIONS.md

After server-side seed generation the minted tree's CSPRNG seed differs from
whatever seed the guest session used locally. The seed + care_log -> identical tree
invariant holds for the SERVER-SIDE minted tree (see Invariant Check below). The
guest preview mismatch is a pre-existing design gap (the current code also generates
fresh seeds in pendingSeedsRef that differ from the guest's play seed). This is not
a new invariant violation -- it is the existing guest->wallet conversion behavior.

Implementer should add to DECISIONS.md: "Guest seed mismatch: server generates
CSPRNG seeds for minted trees. Minted tree may differ from guest preview. Guest
mode implementation (ARCH-GUEST-MODE.md) must account for this -- either display
the minted tree using data.seeds from the seed-claim response, or accept that guest
preview is approximate."

Also: `data.seeds` added to the client response type annotation is dead code --
the field is received but never consumed anywhere in the current client. The spec
returns it "for future use" (local determinism verification). A comment to this
effect in useSeedPurchase is appropriate.

### C4 -- A7-2: Use Vite env variables, not hardcoded literals

The spec proposes hardcoded string constants in browser-side source:
- `const SUPABASE_ANON_KEY = '<insert-anon-key>';` (useWalletAuth.ts)
- `const KIJO_CONTRACT = '0x4447F631F5868bFA03A6e6ae2D2da9f22c787E44' as const;` (useWallet.ts)

Jeremy's OQ-A7-2-1 resolution confirms the GoTrue refresh call will use the anon
key "from VITE_SUPABASE_ANON_KEY env" -- confirming the Vite env variable pattern.

**Implementer should deviate from spec's literal form:**
```typescript
// useWallet.ts
const KIJO_CONTRACT = (import.meta.env.VITE_KIJO_CONTRACT_ADDRESS ??
  '0x4447F631F5868bFA03A6e6ae2D2da9f22c787E44') as `0x${string}`;

// useWalletAuth.ts
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
```

Add both to `.env`. The VITE pattern handles mainnet deployment (different contract
address, different project) without source changes and avoids placeholder literals
in git history.

### C5 -- A7-2: silentRefresh() has no call site

The spec implements and exports `silentRefresh()` but does not specify where it is
called. Without a call site it is effectively dead code in Phase 1.

Minimum viable call site (implementer should add, not in spec):
In `useSeedPurchase.buySeeds()` before `sendTransactionAsync`:
```typescript
// Non-fatal proactive refresh before committing RON to chain.
if (silentRefresh) {
  await silentRefresh().catch(() => { /* non-fatal -- claim step will 401 if expired */ });
}
```
`silentRefresh` would be passed as a prop from App.tsx (which already receives it
from `useWalletAuth`). Phase 1 acceptably leaves auto-401-interception unimplemented.

### C6 -- A7-1: 'void JWT_EXPIRY_SECONDS_EXPECTED' pattern

`void JWT_EXPIRY_SECONDS_EXPECTED;` to suppress unused-var is valid TypeScript/ESLint
but unusual. An eslint-disable comment is more idiomatic. Style note only.

---

## OPEN QUESTIONS -- ALL RESOLVED

```
OQ-A3-1-1: RESOLVED -- spec default is correct
  Jeremy: Use Kijonsai contract address as verifyingContract. Standard EIP-712
  practice. Testnet auth requires fresh sigs when mainnet deploys -- expected
  behavior for environment separation. Spec as written is correct.
  Implementer action: none.

OQ-A7-1-1: RESOLVED -- 3600s confirmed as intended value
  Jeremy: Supabase default JWT expiry is 3600s; that is what the spec constant
  documents. Implementer will visually verify in Auth -> Configuration -> JWT
  Settings before deploying.
  Implementer action: visual verification in dashboard; fill date in DECISIONS.md.

OQ-A7-2-1: RESOLVED -- anon key confirmed; VITE env variable confirmed
  Jeremy: Anon key confirmed present via Supabase MCP. GoTrue refresh call uses
  it as `apikey` header from `VITE_SUPABASE_ANON_KEY` env. Confirms C4 deviation.
  Implementer action: use import.meta.env.VITE_SUPABASE_ANON_KEY, add to .env.

OQ-A8-2-1 (rotate): RESOLVED -- rotate IS in the guest allowlist
  Jeremy (final ruling after GDD ss3.1 review): rotate is a valid guest action.
  GDD ss3.1 defines rotate as affecting directional growth bias (light-side).
  Implementer action: see B1 above. Use corrected constant.

OQ-A8-2-2 (tick): RESOLVED -- tick is excluded as a server-reserved event
  Jeremy + GDD authority: guests do not submit tick. Ticks are server-scheduled
  per GDD ss8.2 / ss3.2. A tick in the user-submitted care_log is a spoofed
  server event and must be rejected by the whitelist.
  Implementer action: see B1 above. 'tick' must not appear in the allowlist.
```

---

## SOURCING VERIFICATION

```
viem@2 verifyTypedData standalone utility:
  HOLDS. Confirmed import path: `import { verifyTypedData } from 'npm:viem@2'`.
  wallet-auth/index.ts line 31 currently uses verifyMessage from same path.
  Named-export swap is clean. EOA-only limitation is appropriate. ✓

wagmi useSignTypedData hook:
  HOLDS. wagmi "^2.14.0" confirmed in apps/web/package.json. useSignMessage
  currently imported at useWallet.ts line 4; swap to useSignTypedData is valid.
  signTypedDataAsync returns Promise<Hex> compatible with Promise<string>. ✓

Deno crypto.getRandomValues:
  HOLDS. Deno built-in Web Crypto API, synchronous. Uint32Array(count) for
  count <= 10 is 40 bytes, well under 65536-byte limit. ✓

EIP-712 field names and types:
  HOLDS. `{ name: 'address', type: 'address' }` is valid EIP-712 atomic type
  usage. EIP712Domain handled internally by viem v2 (not added to types). ✓

signTypedDataAsync TypeScript type inference:
  HOLDS. With KIJO_AUTH_TYPES as const and primaryType 'KijoAuth', wagmi/viem
  infers message type as `{ address: Address, nonce: string }`. address from
  useAccount() returns Address = `0x${string}`. Correct. ✓

Ronin chain IDs:
  HOLDS. 202601 confirmed at seed-claim/index.ts line 38. 2020 confirmed in
  AUDIT doc and PHASE2-WALLET-ARCH.md. ✓

KIJONSAI_CONTRACT_ADDRESS as verifyingContract:
  HOLDS. OQ-A3-1-1 RESOLVED: use contract address, no sentinel. ✓

care-action ALLOWED_ACTION_TYPES (line 98):
  VERIFIED as Set(['water','prune','wire','wire-remove','fertilize','rotate']).
  Confirmed 'tick' is NOT in this set -- consistent with GDD ss8.2 (ticks are
  server-generated). Corrected A8-2 allowlist matches this set exactly. ✓

Sky Mavis / tanto-kit citations:
  NOT VERIFIED from source. Repo not found at attempted URL. Assumption A-1
  flags Ronin Wallet EIP-712 support as UNVERIFIED. @sky-mavis/tanto-wagmi
  "^0.0.11" is in package.json; whether it correctly proxies eth_signTypedData_v4
  to the Ronin Wallet extension should be tested on Saigon testnet before deploy.

OWASP JWT Cheat Sheet URL:
  SUSPECT. Cited URL is the Java-specific variant. Content (sessionStorage over
  localStorage, short expiry) is consistent with the general version. ✓ on content.

GDD ss3.1 (rotate, light-side bias):
  CITED BY JEREMY -- not read directly by this critic session. Jeremy quotes:
  "Rotate -- Rotates the tree 90 degrees. Simulates light exposure. Affects
  directional growth bias." GrowthEngine.ts has zero references to rotation,
  confirming it is unimplemented but specified. ✓ on authority of citation.

GDD ss8.2 (server handles day ticks) and ss3.2 (1 game day = 8 real hours):
  CITED BY JEREMY -- not read directly by this critic session. Consistent with
  care-action/index.ts lazy-tick loop (server-side tick generation, not user-sent)
  and care-action's ALLOWED_ACTION_TYPES (no 'tick' in the user-facing set). ✓

Line numbers cited in spec against actual source files:
  ALL VERIFIED.
  wallet-auth line 31 (verifyMessage import): MATCH ✓
  wallet-auth line 93 (message construction): MATCH ✓
  wallet-auth lines 100-104 (verifyMessage call): MATCH ✓
  wallet-auth lines 217-220 (return statement): MATCH ✓
  useSeedPurchase lines 70-71 (pendingSeedsRef): MATCH ✓
  useSeedPurchase line 112 (pendingSeedsRef.current.length guard): MATCH ✓
  useSeedPurchase lines 259-262 (Math.random block): MATCH ✓
  seed-claim lines 162-166 (seeds validation): MATCH ✓
  seed-claim lines 393-401 (care_log map): MATCH ✓
  seed-claim line 504 (final return): MATCH ✓
  care-action line 98 (ALLOWED_ACTION_TYPES): MATCH ✓
```

---

## INVARIANT CHECK

**Core invariant: seed + care_log -> identical tree, everywhere**

```
A3-1 EIP-712 change:
  Does not touch seed, care_log, or tree reconstruction. Nonce format
  unchanged (Date.now().toString() timestamp string).
  INVARIANT UNAFFECTED. ✓

A5-1/A8-1 server-side seed generation:
  Minted tree created with server CSPRNG seed stored in DB trees row.
  CareLogReplay reconstructs any minted tree from (DB_seed, care_log).
  Guest preview mismatch (S_local != S_server) is a pre-existing design
  gap -- not a new invariant violation.
  INVARIANT PRESERVED for minted trees. ✓

A7-1 / A7-2:
  No effect on tree state.
  INVARIANT UNAFFECTED. ✓

A8-2 care_log whitelist (using CORRECTED allowlist):
  Filtered entries are dropped, not corrupted. Surviving entries are
  reassigned sequential sequence numbers from 0. Insertion only occurs
  when existingLogCount === 0 (409 guard at seed-claim line 392).
  'tick' entries submitted by a client are now rejected (spoofed server
  events). 'rotate' entries from genuine guest sessions are preserved.
  Once GrowthEngine implements light-side bias, rotate entries in converted
  care logs will replay correctly.
  INVARIANT PRESERVED for valid entries. ✓
```

---

## IMPLEMENTATION ORDER (affirmed from spec, with corrections)

```
1. Fix A3-1  (BLOCKING mainnet) -- EIP-712 signature upgrade
   Deviation: use import.meta.env.VITE_KIJO_CONTRACT_ADDRESS in useWallet.ts.
   Verify KIJONSAI_CONTRACT_ADDRESS secret in wallet-auth environment.
   Gate: npx tsc --noEmit exits 0 (exercises signTypedDataAsync type inference).

2. Fix A5-1/A8-1 (BLOCKING mainnet) -- server-side seed generation
   No deviations from spec.
   Add DECISIONS.md entry on guest seed mismatch.

3. Fix A8-2 (data integrity) -- care_log whitelist
   CRITICAL DEVIATION from spec: use corrected constant (see B1).
   Final allowlist: {water, prune, wire, wire-remove, fertilize, rotate}.
   'tick' rejected as spoofed server event. 'rotate' accepted per GDD ss3.1.

4. Fix A7-1 (verification task) -- JWT expiry confirmation + documentation
   No deviations from spec. Visual verification in Supabase dashboard.

5. Fix A7-2 (UX advisory) -- token refresh flow
   Deviation: use import.meta.env.VITE_SUPABASE_ANON_KEY, add to .env.
   Add silentRefresh() call site in useSeedPurchase.buySeeds() (see C5).
```

---

*Critic: adversarial-auditor skill. No code changes. No commits.*
*All 4 open questions resolved by Jeremy during this session.*
*APPROVED WITH CONDITIONS.*
*Blocking: B1 (A8-2 allowlist corrected: tick OUT per GDD ss8.2, rotate IN per GDD ss3.1).*
*Notable deviations from spec: C4 (Vite env vars for SUPABASE_ANON_KEY and KIJO_CONTRACT).*
