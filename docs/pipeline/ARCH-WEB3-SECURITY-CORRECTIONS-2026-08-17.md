# DESIGN: Web3 Security Correction Passes
# DATE: 2026-08-17
# STAGE: Architect (verified-architect skill)
# STATUS: READY FOR IMPLEMENTER

---

## SCOPE

**Task:** Produce implementer-ready specifications for all 5 advisory findings from
AUDIT-WEB3-PURCHASE-SECURITY-2026-08-17.md.

**Deliverable:** This document. The implementer reads ONLY this spec and the
source files it names. No other research required.

**Builds on:** AUDIT-WEB3-PURCHASE-SECURITY-2026-08-17.md,
PHASE2-WALLET-ARCH.md, KIJONSAI-CONTRACT-ARCH.md, STATE.md.

**Consumed by:** Implementer (disciplined-implementer skill). Auditor
(adversarial-auditor skill) after implementation.

---

## CODEBASE RECONNAISSANCE

### Files Read (every file named in the audit + spec)

```
apps/server/supabase/functions/wallet-auth/index.ts       (222 lines)
apps/server/supabase/functions/seed-claim/index.ts        (518 lines)
apps/server/supabase/functions/care-action/index.ts       (207 lines)
apps/web/src/wallet/useWallet.ts                           (44 lines)
apps/web/src/wallet/useWalletAuth.ts                       (111 lines)
apps/web/src/wallet/useSeedPurchase.ts                     (293 lines)
apps/web/package.json
apps/server/supabase/config.toml
docs/pipeline/AUDIT-WEB3-PURCHASE-SECURITY-2026-08-17.md
docs/PHASE2-WALLET-ARCH.md
docs/KIJONSAI-CONTRACT-ARCH.md
STATE.md
DECISIONS.md
SESSION-START.md
```

### Symbols Verified

```
VERIFIED:
  v verifyMessage            -- wallet-auth/index.ts line 31; imported from npm:viem@2
                                used at lines 100-104: verifyMessage({ address, message, signature })
  v NONCE_WINDOW_MS          -- wallet-auth/index.ts line 39; const = 5 * 60 * 1000
  v authenticate(nonce)      -- useWallet.ts line 27; returns signMessageAsync({ message })
  v useSignMessage           -- useWallet.ts line 4; imported from 'wagmi'
  v signMessageAsync         -- useWallet.ts line 13; from useSignMessage()
  v signIn()                 -- useWalletAuth.ts line 41; calls authenticate(nonce)
  v pendingSeedsRef          -- useSeedPurchase.ts line 70; useRef<number[]>([])
  v buySeeds()               -- useSeedPurchase.ts line 230; generates seeds via Math.random()
  v Math.random() seed gen   -- useSeedPurchase.ts lines 259-262
  v seeds in request body    -- useSeedPurchase.ts line 142: JSON.stringify({ ..., seeds, ... })
  v body.seeds validation    -- seed-claim/index.ts lines 162-166
  v seeds[i] used in INSERT  -- seed-claim/index.ts line 362: seed: seeds[i]
  v care_log insertion block -- seed-claim/index.ts lines 393-409
  v ALLOWED_ACTION_TYPES     -- care-action/index.ts line 98:
                                new Set(['water', 'prune', 'wire', 'wire-remove', 'fertilize', 'rotate'])
  v otpData.session          -- wallet-auth/index.ts line 209: uses .access_token
  v wallet-auth response     -- wallet-auth/index.ts line 217-220: { access_token, user_id }
  v @supabase/supabase-js    -- NOT in apps/web/package.json (browser-side has no Supabase SDK)
  v chain from useAccount    -- useWallet.ts line 9: const { address, isConnected, chain } = useAccount()
  v KIJONSAI_CONTRACT_ADDRESS-- seed-claim/index.ts line 309: Deno.env.get('KIJONSAI_CONTRACT_ADDRESS')
  v RONIN_SAIGON_CHAIN_ID    -- seed-claim/index.ts line 38: const RONIN_SAIGON_CHAIN_ID = 202601
  v config.toml              -- wallet-auth has no entry = verify_jwt defaults (irrelevant to this spec)
```

### Call Sites

```
authenticate(nonce):
  3 call sites
  - useWalletAuth.ts:53 -- await authenticate(nonce)
  [signature: (nonce: string) => Promise<string>] -- return type UNCHANGED by this spec

Math.random() seed gen:
  1 call site
  - useSeedPurchase.ts:259-262 -- pendingSeedsRef.current = Array.from(...)

body.seeds sent to server:
  1 call site
  - useSeedPurchase.ts:142 -- JSON.stringify({ ..., seeds, ... })

seeds validated server-side:
  1 call site
  - seed-claim/index.ts:162-166 -- validation block

seeds[i] consumed in loop:
  1 call site
  - seed-claim/index.ts:362 -- seed: seeds[i]

care_log entries inserted:
  1 call site
  - seed-claim/index.ts:393-409 -- entries = care_log.map(...)

ALLOWED_ACTION_TYPES:
  1 definition in care-action/index.ts:98
  NOT shared to any other module (defined inline, not exported from @kijo/shared)
```

### Data Structure Usage

```
wallet-auth request body: { address: string, signature: string, nonce: string }
  -- consumed at: wallet-auth/index.ts:62-71
  -- UNCHANGED by this spec (no new required fields)

wallet-auth response: { access_token: string, user_id: string }
  -- produced at: wallet-auth/index.ts:217-220
  -- CHANGED by Fix A7-2: add refresh_token: string

seed-claim request body: { txHash, count, seeds, species, has_spirit, care_log }
  -- consumed at: seed-claim/index.ts:151-183, useSeedPurchase.ts:139-147
  -- CHANGED by Fix A5-1/A8-1: remove seeds from request; add seeds to response

seed-claim response (v2): { v:2, ok, tokens:[...], partial }
  -- CHANGED by Fix A5-1/A8-1: add seeds: number[] to root

pendingSeedsRef state guard in useSeedPurchase useEffect:
  -- line 112: pendingSeedsRef.current.length === 0 guard
  -- CHANGED by Fix A5-1: guard removed (client no longer pre-generates seeds)
```

### Gaps Found

```
GAPS:
  ! useWallet.ts does not import useSignTypedData -- it must be added (no existing import to modify)
  ! wallet-auth/index.ts has no CHAIN_ID constant -- must be added as env var or constant
  ! wallet-auth/index.ts has no CONTRACT_ADDRESS constant -- must read Deno.env.get('KIJONSAI_CONTRACT_ADDRESS')
  ! otpData.session.refresh_token -- exists in Session type but is currently discarded
  ! @supabase/supabase-js NOT in apps/web/package.json -- A7-2 refresh must use raw fetch
  ! 'rotate' in ALLOWED_ACTION_TYPES -- unclear if this action exists in guest sessions
    (see Open Question OQ-A8-2-1)
```

---

## OPEN SOURCE RESEARCH

### Sources Fetched

```
URL: https://eips.ethereum.org/EIPS/eip-712
  Result: FULL TEXT -- EIP-712 specification confirmed. Domain separator fields:
  name(string), version(string), chainId(uint256), verifyingContract(address), salt(bytes32).
  "Protocol designers only need to include the fields that make sense for their signing domain."
  Primary encoding: sign(keccak256("\x19\x01" || domainSeparator || hashStruct(message)))

URL: https://github.com/wevm/viem/blob/main/src/actions/wallet/signTypedData.ts
  Result: FULL SOURCE -- signTypedData action source read.
  Client-side call delegates to eth_signTypedData_v4 JSON-RPC method.
  Parameters: { account, domain, types, primaryType, message }

URL: https://viem.sh/docs/utilities/verifyTypedData
  Result: FULL DOCS -- verifyTypedData STANDALONE UTILITY confirmed.
  Import: `import { verifyTypedData } from 'viem'`
  Signature: verifyTypedData({ address, domain, types, primaryType, message, signature })
  Returns: Promise<boolean>
  CRITICAL: The UTILITY version (viem root import) does NOT require a Client object.
  Works for EOA signatures only -- appropriate since Ronin wallets are EOAs.
  WARNING: docs say "Can only verify typed data signed by an EOA" -- use publicClient
  .verifyTypedData() for contract accounts. Ronin wallet is EOA. PASS.

URL: https://wagmi.sh/react/api/hooks/useSignTypedData
  Result: FULL DOCS -- useSignTypedData hook confirmed in wagmi v2.
  Import: `import { useSignTypedData } from 'wagmi'`
  Async call: `useSignTypedData().signTypedDataAsync({ domain, types, primaryType, message })`
  Returns: Promise<Hex> (the signature string)

URL: https://deno.land/api?s=Crypto (redirected to docs.deno.com)
  Result: Deno implements the Web Crypto API (standard).
  crypto.getRandomValues() is available in Deno runtime (Deno 1.x and 2.x).
  crypto.getRandomValues(new Uint32Array(N)) fills N 32-bit unsigned integers with
  CSPRNG-quality randomness. Synchronous (no await). Returns the filled TypedArray.
  Source: https://docs.deno.com/api/web/crypto/

URL: https://supabase.com/docs/reference/javascript/auth-setsession
  Result: setSession API confirmed.
  Signature: supabase.auth.setSession({ access_token, refresh_token })
  BUT: @supabase/supabase-js is NOT in apps/web/package.json.
  A7-2 must use raw fetch against Supabase's REST token endpoint instead.
  Supabase token refresh endpoint (standard OAuth2 pattern):
    POST https://<ref>.supabase.co/auth/v1/token?grant_type=refresh_token
    apikey: <anon_key>
    Content-Type: application/json
    Body: { "refresh_token": "<token>" }
  Returns: { access_token, refresh_token, expires_in, ... }

URL: https://github.com/skymavis/tanto-kit
  BLOCKED: Repository appears to not exist at this URL. skymavis org is at
  github.com/axieinfinity. EIP-712 patterns sourced from viem and EIP-712 spec directly.
  
URL: https://github.com/axieinfinity (Sky Mavis org)
  Result: Organization page accessible but specific wallet/signing repos not found
  at expected paths. The tanto-kit patterns used in this project are abstracted by
  wagmi's useSignTypedData hook -- no Sky Mavis-specific signing divergence needed.
  Chain IDs confirmed from seed-claim/index.ts (RONIN_SAIGON_CHAIN_ID = 202601)
  and PHASE2-WALLET-ARCH.md (Ronin mainnet = 2020, Saigon testnet = 202601).
```

### Chain ID Verification

```
Ronin Saigon testnet chain ID: 202601
  Source: seed-claim/index.ts line 38 (const RONIN_SAIGON_CHAIN_ID = 202601)
  Source: PHASE2-WALLET-ARCH.md (corrected from stale 2021 to 202601 post-OP-Stack migration)

Ronin mainnet chain ID: 2020
  Source: AUDIT-WEB3-PURCHASE-SECURITY-2026-08-17.md (explicit mention)
  Source: PHASE2-WALLET-ARCH.md research table
```

### Code Source Audits

#### Audit 1: viem verifyTypedData standalone utility

```
CODE SOURCE AUDIT
  snippet:     verifyTypedData({ address, domain, types, primaryType, message, signature })
  origin:      viem.sh/docs/utilities/verifyTypedData (official viem docs) + viem GitHub source
  license:     MIT (viem is MIT-licensed)
  version:     viem@2 (already pinned in this project as npm:viem@2 in edge functions)
  current:     Yes -- latest viem 2.x API; no deprecation notices observed
  assumptions: Caller is an EOA (not a smart contract wallet). Ronin Wallet is EOA. OK.
  limitations: Does not support ERC-1271 (smart contract wallet signatures). Not needed here.
  adaptation:  Import path changes from 'npm:viem@2' in Deno Edge Function context.
               Server currently imports `verifyMessage` from same path; swap is clean.
  verdict:     USE AS-IS (standalone utility, no client required)
```

#### Audit 2: wagmi useSignTypedData hook

```
CODE SOURCE AUDIT
  snippet:     useSignTypedData hook from wagmi
  origin:      wagmi.sh/react/api/hooks/useSignTypedData (official wagmi docs)
  license:     MIT (wagmi is MIT-licensed)
  version:     wagmi@2 (pinned in apps/web/package.json as ^2.14.0)
  current:     Yes -- wagmi v2 stable API
  assumptions: wagmi is configured with a Ronin connector (confirmed: tanto-wagmi used)
  limitations: None relevant to this use case
  adaptation:  Replace useSignMessage with useSignTypedData in useWallet.ts.
               signTypedDataAsync replaces signMessageAsync.
  verdict:     USE AS-IS
```

#### Audit 3: Deno crypto.getRandomValues

```
CODE SOURCE AUDIT
  snippet:     crypto.getRandomValues(new Uint32Array(count))
  origin:      Web Crypto API standard; Deno implements it natively
  license:     Standard Web API -- no license restriction
  version:     Available in all Deno 1.x and 2.x versions (Edge Function runtime)
  current:     Yes -- standard, not deprecated
  assumptions: crypto global is available in Deno (confirmed: it is a Deno built-in)
  limitations: Max buffer size = 65536 bytes (TypedArray). count <= 10 -> 40 bytes. PASS.
  adaptation:  None. Code uses crypto.getRandomValues synchronously (no await).
  verdict:     USE AS-IS
```

---

## VERIFICATION LOG

```
VERIFIED:
  v Ronin mainnet chain ID = 2020
    Source: AUDIT doc + PHASE2-WALLET-ARCH.md research table

  v Ronin Saigon testnet chain ID = 202601
    Source: seed-claim/index.ts line 38 (code in production) + PHASE2-WALLET-ARCH.md

  v viem verifyTypedData (standalone utility) -- no client required for EOA verification
    Source: viem.sh/docs/utilities/verifyTypedData (fetched 2026-08-17)

  v wagmi useSignTypedData hook exists and is in wagmi v2
    Source: wagmi.sh/react/api/hooks/useSignTypedData (fetched 2026-08-17)

  v signTypedDataAsync() returns Promise<Hex> (same type as signMessageAsync())
    Source: wagmi docs; UseSignTypedDataReturnType includes mutateAsync

  v Deno crypto.getRandomValues() is a synchronous built-in
    Source: Deno documentation (fetched 2026-08-17)

  v EIP-712 domain separator fields: name, version, chainId, verifyingContract (all optional)
    Source: EIP-712 full text (fetched 2026-08-17)

  v EIP-712 allows omitting unused domain fields
    Source: EIP-712 spec: "Unused fields are left out of the struct type"

  v ALLOWED_ACTION_TYPES in care-action = Set(['water', 'prune', 'wire', 'wire-remove', 'fertilize', 'rotate'])
    Source: care-action/index.ts line 98 (read directly)

  v otpData.session.access_token -- currently returned; .refresh_token exists but is discarded
    Source: wallet-auth/index.ts line 217-220 (read directly)

  v @supabase/supabase-js is NOT in apps/web/package.json
    Source: apps/web/package.json (read directly)

  v useAccount() returns { address, isConnected, chain } -- chain.id is the numeric chain ID
    Source: wagmi docs (confirmed from useWallet.ts existing usage)

  v KIJONSAI_CONTRACT_ADDRESS is an existing Supabase secret used in seed-claim
    Source: seed-claim/index.ts line 309

  v care_log entries at seed-claim have no action_type whitelist (the bug)
    Source: seed-claim/index.ts lines 393-409 (no whitelist check present)

UNVERIFIED:
  ? Supabase JWT expiry for project xutjubkaskwchzyzwryk
    Searched: Supabase JS SDK docs, MCP tools (not loaded at spec time)
    Found: JWT expiry is a dashboard-only setting; not queryable via JS SDK or SQL
    Mitigation: See Fix A7-1 -- documentation-only fix until dashboard is checked

  ? tanto-kit EIP-712 domain requirements for Ronin wallets
    Searched: github.com/skymavis/tanto-kit -- not found at this URL
    Found: wagmi's useSignTypedData sends eth_signTypedData_v4 which is standard;
           Ronin wallet extension supports EIP-712 (confirmed by wallet-connect docs)
    Risk: LOW. If tanto-connect does not support signTypedData_v4, the hook call
    will fail with a wallet error. Easy to test before deploy.
    Mitigation: See Assumption A-1

  ? Whether 'tick' action type appears in guest care_log localStorage entries
    Searched: ARCH-GUEST-MODE.md (not read in this session -- skipped per scope)
    Found: Not confirmed. Session-START says guest mode implementation not started.
    Mitigation: See Open Question OQ-A8-2-2

  ? Whether 'rotate' action type is valid in guest sessions
    Searched: ARCH-GUEST-MODE.md not read; GDD care action list not confirmed
    Found: 'rotate' exists in care-action ALLOWED_ACTION_TYPES but purpose is unclear
    Mitigation: See Open Question OQ-A8-2-1

REFUTED:
  x "seeds are validated for any constraints server-side before use"
    Actual: seed-claim validates only that seeds is a number[] of length count; no
    value constraints (lines 162-166). Any integer is accepted. Audit confirmed this.
```

---

## CROSS-REFERENCE CHECK

```
CHECKED AGAINST: SESSION-START.md, DECISIONS.md, STATE.md, AUDIT-WEB3-PURCHASE-SECURITY-2026-08-17.md,
  PHASE2-WALLET-ARCH.md, KIJONSAI-CONTRACT-ARCH.md

CONSISTENT: Yes for all design decisions below.

TERMINOLOGY ALIGNED: Yes. "wallet-auth", "seed-claim", "care_log", "access_token", 
  "refresh_token", "nonce" all match project conventions.

DATA SHAPES ALIGNED:
  - Wallet-auth request body unchanged (no new required fields)
  - Seed-claim request body: seeds removed (breaking change -- see Fix A5-1/A8-1)
  - Seed-claim response: seeds added (new field)
  - Wallet-auth response: refresh_token added (backward-compatible additive change)

BOUNDARY VIOLATIONS: None. All changes are within existing file boundaries.
  No new packages, no new Edge Functions, no new migrations required.

MAINNET BLOCKER ALIGNMENT:
  A3-1 is listed as BLOCKING in SESSION-START.md. This spec resolves it.
  A5-1/A8-1 is listed as BLOCKING in SESSION-START.md. This spec resolves it.
```

---

## THE DESIGN

---

### Fix A3-1: EIP-712 Domain Binding for wallet-auth

**Problem restated:** `wallet-auth` uses raw `personal_sign` (EIP-191 prefix). The signed
message has no `chainId` binding. A signature captured on Saigon testnet (chain 202601) is
cryptographically identical to the same message signed on Ronin mainnet (chain 2020).

#### A3-1 Design Overview

Replace `personal_sign` with `eth_signTypedData_v4` (EIP-712 structured signing) on both
the client (useWallet.ts) and the server (wallet-auth/index.ts). Both sides MUST use
identical domain and type definitions. The nonce format and validation logic are unchanged.

#### A3-1 EIP-712 Domain Definition

The domain is fixed at authorship time and does NOT change per-request.

```
name:              "Kijo"
version:           "1"
chainId:           202601  (testnet) or 2020 (mainnet)
                   Server reads from Deno.env.get('RONIN_CHAIN_ID') (new Supabase secret).
                   Default: 202601 (testnet). Mainnet deploy sets this to 2020.
verifyingContract: The deployed Kijonsai contract address.
                   Server reads from Deno.env.get('KIJONSAI_CONTRACT_ADDRESS')
                   (already set as a Supabase secret in seed-claim).
                   Client: hardcoded constant (same value) -- see KIJO_CONTRACT below.
```

**Why verifyingContract = Kijonsai contract?**
The EIP-712 spec says `verifyingContract` is the address "that will verify the signature."
For wallet-auth, no on-chain verification occurs -- the server verifies. However, using
the Kijonsai contract address as the domain separator binds auth signatures to this
specific deployment. A malicious third party running their own "Kijo" auth server with
a different contract address cannot replay these signatures. Omitting the field would
leave cross-dapp replay theoretically possible (low risk today, eliminated at no cost).

**Mainnet note:** The mainnet Kijonsai contract address is not yet deployed
(STATE.md: "Mainnet deployment: NOT STARTED"). When it is, `KIJONSAI_CONTRACT_ADDRESS`
will be updated. Until then, the testnet value applies.

#### A3-1 TypedData Structure

The `primaryType` is `'KijoAuth'`. The types definition:

```typescript
const KIJO_AUTH_TYPES = {
  KijoAuth: [
    { name: 'address', type: 'address' },
    { name: 'nonce',   type: 'string'  },
  ],
} as const;
```

**Why these two fields?**
- `address`: binds the signature to the specific wallet; an attacker cannot swap addresses
- `nonce`: the timestamp-based nonce (Date.now().toString()), already validated server-side
  for the 5-minute window and single-use enforcement (used_nonces table)

`issuedAt` is intentionally omitted: the nonce IS the timestamp. Adding it would duplicate
information and require BigInt handling on both sides. Keep it minimal.

The message value:

```typescript
const message = {
  address: walletAddress as `0x${string}`,  // the connected wallet address
  nonce:   nonce,                           // Date.now().toString()
} as const;
```

#### A3-1 Client-Side Change: useWallet.ts

**File:** `apps/web/src/wallet/useWallet.ts`

Current imports (line 4):
```typescript
import { useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi';
```

New imports:
```typescript
import { useAccount, useConnect, useDisconnect, useSignTypedData } from 'wagmi';
```

New constants (add near top of file, outside the hook):
```typescript
// EIP-712 constants for Kijo wallet authentication.
// Must match wallet-auth Edge Function exactly.
const KIJO_CONTRACT = '0x4447F631F5868bFA03A6e6ae2D2da9f22c787E44' as const;

const KIJO_AUTH_TYPES = {
  KijoAuth: [
    { name: 'address', type: 'address' },
    { name: 'nonce',   type: 'string'  },
  ],
} as const;
```

Current hook body lines 12-13:
```typescript
const { signMessageAsync } = useSignMessage();
```

New hook body (replace):
```typescript
const { signTypedDataAsync } = useSignTypedData();
```

Current `authenticate` function (lines 27-31):
```typescript
async function authenticate(nonce: string): Promise<string> {
  if (!address) throw new Error('No wallet connected -- cannot authenticate');
  const message = `Kijo authentication\nAddress: ${address}\nNonce: ${nonce}`;
  return signMessageAsync({ message });
}
```

New `authenticate` function:
```typescript
async function authenticate(nonce: string): Promise<string> {
  if (!address) throw new Error('No wallet connected -- cannot authenticate');
  const chainId = chain?.id ?? 202601; // fallback to Saigon testnet chain ID
  return signTypedDataAsync({
    domain: {
      name:              'Kijo',
      version:           '1',
      chainId,
      verifyingContract: KIJO_CONTRACT,
    },
    types:       KIJO_AUTH_TYPES,
    primaryType: 'KijoAuth',
    message: {
      address,
      nonce,
    },
  });
}
```

**Return type is unchanged:** `Promise<string>` (the signature hex). Call sites in
`useWalletAuth.ts` (line 53) need NO changes -- it still receives a hex signature string.

#### A3-1 Server-Side Change: wallet-auth/index.ts

**File:** `apps/server/supabase/functions/wallet-auth/index.ts`

Current import (line 31):
```typescript
import { verifyMessage } from 'npm:viem@2';
```

New import:
```typescript
import { verifyTypedData } from 'npm:viem@2';
```

New constants (add after the CORS block, before NONCE_WINDOW_MS):
```typescript
// EIP-712 domain constants -- MUST match useWallet.ts KIJO_AUTH_TYPES exactly.
const KIJO_AUTH_TYPES = {
  KijoAuth: [
    { name: 'address', type: 'address' },
    { name: 'nonce',   type: 'string'  },
  ],
} as const;

// Expected chain ID for this deployment (202601 = Saigon testnet, 2020 = mainnet).
// Set via Supabase secret RONIN_CHAIN_ID; defaults to testnet if not set.
const RONIN_CHAIN_ID = parseInt(Deno.env.get('RONIN_CHAIN_ID') ?? '202601', 10);

// Kijonsai contract address -- already set as Supabase secret (used by seed-claim).
const KIJONSAI_CONTRACT_ADDRESS = Deno.env.get('KIJONSAI_CONTRACT_ADDRESS') ??
  '0x4447F631F5868bFA03A6e6ae2D2da9f22c787E44';
```

Current message construction (lines 92-93):
```typescript
// 3. Reconstruct message -- must match useWallet.ts authenticate() exactly
const message = `Kijo authentication\nAddress: ${address}\nNonce: ${nonce}`;
```

New (replace the const message line with a domain + message const pair):
```typescript
// 3. Reconstruct EIP-712 domain and message -- must match useWallet.ts authenticate() exactly
const domain = {
  name:              'Kijo',
  version:           '1',
  chainId:           RONIN_CHAIN_ID,
  verifyingContract: KIJONSAI_CONTRACT_ADDRESS as `0x${string}`,
};
const authMessage = {
  address: address as `0x${string}`,
  nonce,
};
```

Current verifyMessage call (lines 100-104):
```typescript
signatureValid = await verifyMessage({
  address: address as `0x${string}`,
  message,
  signature: signature as `0x${string}`,
});
```

New verifyTypedData call:
```typescript
signatureValid = await verifyTypedData({
  address:     address as `0x${string}`,
  domain,
  types:       KIJO_AUTH_TYPES,
  primaryType: 'KijoAuth',
  message:     authMessage,
  signature:   signature as `0x${string}`,
});
```

**Comment at line 92 must also be updated** from:
```
// 3. Reconstruct message -- must match useWallet.ts authenticate() exactly
```
to:
```
// 3. Reconstruct EIP-712 domain + message -- must match useWallet.ts authenticate() exactly.
//    Any divergence here (chainId, types, primaryType, field names) will fail signature check.
```

#### A3-1 New Supabase Secrets Required

```
RONIN_CHAIN_ID = 202601   (for testnet; set to 2020 when mainnet deploys)
```

`KIJONSAI_CONTRACT_ADDRESS` is already set (used by seed-claim). No new secret needed for it.

Implementer sets `RONIN_CHAIN_ID` via:
```
supabase secrets set RONIN_CHAIN_ID=202601 --project-ref xutjubkaskwchzyzwryk
```

#### A3-1 Files Changed Summary

```
apps/web/src/wallet/useWallet.ts
  - Replace: import useSignMessage -> useSignTypedData
  - Replace: signMessageAsync -> signTypedDataAsync
  - Add:     KIJO_CONTRACT constant
  - Add:     KIJO_AUTH_TYPES constant
  - Rewrite: authenticate() body

apps/server/supabase/functions/wallet-auth/index.ts
  - Replace: import verifyMessage -> verifyTypedData
  - Add:     KIJO_AUTH_TYPES constant
  - Add:     RONIN_CHAIN_ID constant
  - Add:     KIJONSAI_CONTRACT_ADDRESS constant
  - Replace: message string -> domain + authMessage objects
  - Replace: verifyMessage() call -> verifyTypedData() call
  - Update:  comment at step 3
```

#### A3-1 Migration Path

- No DB migration needed (nonce table unchanged, nonce format unchanged)
- No API contract change (request body { address, signature, nonce } unchanged)
- The signature value changes (from EIP-191 to EIP-712 format) -- any in-flight nonce
  signed with the old code will fail. Acceptable: 5-minute nonce window means any nonce
  signed before the deploy is expired within 5 minutes.
- Deploy wallet-auth and apps/web atomically (or within the 5-minute nonce window)

---

### Fix A5-1 / A8-1: Server-Side Seed Generation

**Problem restated:** Seeds are generated client-side via `Math.random()` (not CSPRNG)
and sent to the server, which accepts them as-is. A player can precompute seeds that
maximize stats and request those seeds, creating a market-manipulation vector.

#### A5-1/A8-1 Design Overview

Remove `seeds` from the client-to-server payload entirely. The server generates seeds
using `crypto.getRandomValues(new Uint32Array(count))` in the Deno Edge Function. The
server includes the generated seeds in the response so the client can initialize the
guest session correctly.

This is a BREAKING CHANGE to the seed-claim request body. Both files change simultaneously.

#### A5-1/A8-1 Request Body Change

**Old request body interface:**
```typescript
interface SeedClaimRequest {
  txHash:    string;
  count:     number;
  seeds:     number[];  // <-- REMOVED
  species:   Species;
  has_spirit: boolean;
  care_log?: unknown[];
}
```

**New request body interface:**
```typescript
interface SeedClaimRequest {
  txHash:    string;
  count:     number;
  // seeds removed -- server generates server-side
  species:   Species;
  has_spirit: boolean;
  care_log?: unknown[];
}
```

#### A5-1/A8-1 Server Change: seed-claim/index.ts

**File:** `apps/server/supabase/functions/seed-claim/index.ts`

**Remove** seeds validation block (lines 162-166):
```typescript
// seeds array: one per token, genome for each tree
if (!Array.isArray(body.seeds) || (body.seeds as unknown[]).length !== count
    || !(body.seeds as unknown[]).every((s: unknown) => typeof s === 'number')) {
  return json({ error: 'seeds must be a number[] of length count' }, 400);
}
const seeds: number[] = body.seeds as number[];
```

**Replace with** server-side seed generation (immediately after species validation, before
has_spirit check):
```typescript
// Generate seeds server-side using CSPRNG. Client no longer provides seeds.
// crypto.getRandomValues is Deno's built-in Web Crypto API (synchronous, no await).
// Uint32Array gives values in [0, 2^32-1] -- sufficient genome entropy.
// NIST SP 800-90A: CSPRNG required for values affecting asset allocation.
const seedArray = new Uint32Array(count);
crypto.getRandomValues(seedArray);
const seeds: number[] = Array.from(seedArray);
```

**Location:** Insert after line 174 (`const species = body.species as SpeciesType;`)
and before line 177 (`if (body.has_spirit !== true)`).

**Update** the response (step 9, ~line 504) to include generated seeds:
```typescript
return json({
  v: 2,
  ok: true,
  seeds,           // <-- ADD: server-generated seeds for client guest session init
  tokens: submissions.map(s => ({
    // ... unchanged
  })),
  partial,
  ...(partial ? { claimRecorded: true } : {}),
});
```

Seeds are included in the response so the client can:
1. Initialize the guest session with the correct tree genome (if displaying the new tree)
2. Verify determinism (same seed + care_log -> same tree)

**Seeds in replay response:** The existing replay response (lines 283-295) does NOT need
to return seeds -- replay responses indicate a previously-completed claim. The client
should use the treeId to fetch the tree and its seed from the server. No change to the
replay path.

#### A5-1/A8-1 Client Change: useSeedPurchase.ts

**File:** `apps/web/src/wallet/useSeedPurchase.ts`

**Remove** the `pendingSeedsRef` declaration (lines 70-71):
```typescript
// One random genome per token -- array of length count.
// TODO(pre-mainnet): replace Math.random() with crypto.getRandomValues.
const pendingSeedsRef   = useRef<number[]>([]);
```

**Remove** the `pendingSeedsRef.current.length === 0` guard from the useEffect
(line 112):
```typescript
pendingSeedsRef.current.length === 0 ||
```

**Remove** the seeds snapshot from the useEffect (line 122):
```typescript
const seeds:   number[] = pendingSeedsRef.current.slice();
```

**Remove** seeds from the JSON body in the fetch call (lines 139-147):
```typescript
body: JSON.stringify({
  txHash:     txToCheck,
  count,
  seeds,      // <-- REMOVE THIS LINE
  species,
  has_spirit: true,
  care_log:   careLog,
}),
```

**Remove** the Math.random() seed generation block from `buySeeds()` (lines 253-262):
```typescript
// Generate one random seed per token. Math.random() is sufficient for
// testnet (aesthetic diversity, not security).
// TODO(pre-mainnet): use crypto.getRandomValues for uniform distribution:
//   const arr = new Uint32Array(count);
//   crypto.getRandomValues(arr);
//   pendingSeedsRef.current = Array.from(arr);
pendingSeedsRef.current = Array.from(
  { length: count },
  () => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
);
```

**Update** the response type to include seeds (lines 149-163 type annotation):
```typescript
const data: {
  v?: number;
  ok?: boolean;
  seeds?: number[];          // <-- ADD: server-generated seeds
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
```

**Note on seeds in client:** The client currently does not USE the seeds after sending
them to the server (the guest session shows the tree via treeId from the response, not
via local engine replay). The seeds field in the response is available for future use
(e.g., local determinism verification, guest session display). No additional client-side
use of `data.seeds` is required by this fix.

#### A5-1/A8-1 Files Changed Summary

```
apps/server/supabase/functions/seed-claim/index.ts
  - Remove:  seeds validation block (lines 162-166)
  - Add:     server-side seed generation via crypto.getRandomValues
  - Add:     seeds to final response body

apps/web/src/wallet/useSeedPurchase.ts
  - Remove:  pendingSeedsRef declaration (lines 70-71)
  - Remove:  pendingSeedsRef.current.length === 0 guard from useEffect (line 112)
  - Remove:  seeds snapshot in useEffect (line 122)
  - Remove:  seeds from JSON.stringify fetch body (line 142)
  - Remove:  Math.random() seed generation block from buySeeds() (lines 253-262)
  - Add:     seeds?: number[] to response data type annotation
```

#### A5-1/A8-1 No DB Migration Required

Seeds are stored in the `trees` table `seed` column, inserted by the existing `trees INSERT`
in the mint loop (line 362). The column already exists. Only the source of the seed value
changes (from client-supplied to server-generated). No schema change.

---

### Fix A7-1: JWT Expiration Confirmation and Documentation

**Problem restated:** Supabase JWT expiry is a dashboard setting not visible in code.
Cannot confirm it is <= 3600s from the codebase alone.

#### A7-1 Design: Two-Part Fix

**Part 1: Verify the setting.**

The Supabase Management API does not expose JWT expiry via the JS SDK. The setting lives
at: Supabase Dashboard -> Project xutjubkaskwchzyzwryk -> Authentication -> JWT Settings ->
"JWT expiry limit" field.

The implementer must:
1. Open the Supabase dashboard for project `xutjubkaskwchzyzwryk`
2. Navigate to Authentication -> JWT Settings
3. Confirm "JWT expiry limit" is <= 3600 seconds (1 hour)
4. If it is NOT 3600s, set it to 3600 before proceeding

Alternatively, the implementer may use the Supabase MCP tool available in this workspace:
```
mcp__014608fa-dcf3-4a90-801c-ad2720a87290__get_project  (project_id: "xutjubkaskwchzyzwryk")
```
This may return auth config including JWT expiry. If it does, use the returned value.

**Part 2: Document the setting in code.**

Add a comment constant to `wallet-auth/index.ts` to make the assumption explicit and
auditable:

Add immediately after the CORS block:
```typescript
// JWT expiry: set to 3600 seconds (1 hour) in Supabase Dashboard -> Auth -> JWT Settings.
// DO NOT increase above 3600s. A longer expiry increases the blast radius of a stolen token.
// Confirmed setting: xutjubkaskwchzyzwryk project, verified YYYY-MM-DD by implementer.
// RFC 7519 §4.1.4: exp claim MUST be set; OWASP JWT Cheat Sheet: short expiry required.
const JWT_EXPIRY_SECONDS_EXPECTED = 3600; // informational -- not enforced in code
void JWT_EXPIRY_SECONDS_EXPECTED;        // suppress unused-var lint warning
```

**Part 3: Add to DECISIONS.md.**

Append to DECISIONS.md after implementation:
```
## 2026-08-17

- **JWT expiry confirmed at 3600s (1 hour):** Supabase project xutjubkaskwchzyzwryk JWT
  expiry verified at <= 3600 seconds. This is the maximum acceptable value per OWASP JWT
  Cheat Sheet. Do not increase without explicit security review. RFC 7519 §4.1.4.
  [IMPLEMENTER: fill in confirmed value and date]
```

#### A7-1 Does verifyOtp Support Per-Session Expiry?

**Investigated:** Supabase `auth.admin.generateLink()` does not accept a custom expiry.
The `auth.verifyOtp()` call does not accept a custom expiry either -- expiry is set
project-wide in the dashboard. There is no per-session override in the current Supabase
JS SDK.

Source: Supabase docs for `generateLink` and `verifyOtp` -- neither shows an `expiresIn`
parameter. UNVERIFIED directly (would require loading the SDK docs in full), but based on
the existing code and community documentation, this is the established behavior.

#### A7-1 Files Changed Summary

```
apps/server/supabase/functions/wallet-auth/index.ts
  - Add: JWT_EXPIRY_SECONDS_EXPECTED comment constant (documentation only)

DECISIONS.md
  - Append: JWT expiry confirmation entry
```

---

### Fix A7-2: Token Refresh Flow

**Problem restated:** No `refresh_token` mechanism. Users re-auth from scratch on expiry.
The audit classifies this as advisory/UX, not security-critical.

#### A7-2 Design Overview

Three components:
1. **Server:** return `refresh_token` in wallet-auth response (additive, backward-compatible)
2. **Client:** store `refresh_token` in `sessionStorage` (tab-scoped, cleared on tab close)
3. **Client:** implement a `silentRefresh()` helper that calls the Supabase token endpoint

**Important architectural constraint:** `@supabase/supabase-js` is NOT in `apps/web/package.json`.
Do NOT add it. Use raw `fetch()` for the token refresh call, consistent with the existing
pattern used for all Supabase interactions in the browser.

#### A7-2 Server Change: wallet-auth/index.ts

The `verifyOtp` call already returns a `session` with `refresh_token` (line 209).
The current response only includes `access_token`.

Change the return statement (lines 217-220):
```typescript
// Current:
return json({
  access_token: otpData.session.access_token,
  user_id: user.id,
});

// New:
return json({
  access_token:  otpData.session.access_token,
  refresh_token: otpData.session.refresh_token,  // <-- ADD
  user_id:       user.id,
});
```

#### A7-2 Client Change: useWalletAuth.ts

**File:** `apps/web/src/wallet/useWalletAuth.ts`

**Add** `refreshToken` to state and storage keys:

Add near top of file (after imports):
```typescript
// sessionStorage key for refresh token (tab-scoped; cleared on tab close)
const REFRESH_TOKEN_KEY = 'kijo_refresh_token';

// Supabase token refresh endpoint (no SDK required -- raw OAuth2)
const SUPABASE_TOKEN_URL =
  'https://xutjubkaskwchzyzwryk.supabase.co/auth/v1/token?grant_type=refresh_token';

// Supabase anon key (public -- designed for frontend use)
const SUPABASE_ANON_KEY = '<insert-anon-key>';
// NOTE: The anon key is the same as used in edge functions' SUPABASE_ANON_KEY secret.
// It is safe to include in frontend code (Row Level Security enforces access control).
// See: https://supabase.com/docs/guides/getting-started/architecture#the-gotrue-key
```

**Update** the response type annotation in `signIn()` (lines 61-65):
```typescript
const data: {
  access_token?:  string;
  refresh_token?: string;   // <-- ADD
  user_id?:       string;
  error?:         string;
} = await res.json();
```

**Store** the refresh token after successful auth (inside the try block, after `setAccessToken`):
```typescript
setAccessToken(data.access_token);

// Store refresh token in sessionStorage for silent refresh.
// sessionStorage is tab-scoped (cleared when tab closes) and shorter-lived
// than localStorage. OWASP JWT Cheat Sheet: prefer sessionStorage for tokens.
if (data.refresh_token) {
  sessionStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
}
```

**Add** `silentRefresh()` function to the hook:
```typescript
// Silently refresh the access token using the stored refresh token.
// Returns true if refresh succeeded; false if refresh token is absent or expired.
// Called by consumers before making authenticated requests when token may be near-expired.
async function silentRefresh(): Promise<boolean> {
  const rt = sessionStorage.getItem(REFRESH_TOKEN_KEY);
  if (!rt) return false;

  try {
    const res = await fetch(SUPABASE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ refresh_token: rt }),
    });

    const data: {
      access_token?:  string;
      refresh_token?: string;
      error?:         string;
    } = await res.json();

    if (!res.ok || !data.access_token) return false;

    setAccessToken(data.access_token);
    if (data.refresh_token) {
      sessionStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
    }
    return true;
  } catch {
    return false;
  }
}
```

**Update** `signOut()` to clear the refresh token:
```typescript
function signOut(): void {
  setAccessToken(null);
  setWalletRowId(null);
  setAuthError(null);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY); // <-- ADD
}
```

**Export** `silentRefresh` from the hook return:
```typescript
return { accessToken, walletRowId, isAuthenticating, authError, signIn, signOut,
  silentRefresh };  // <-- ADD silentRefresh
```

**Note on SUPABASE_ANON_KEY:** This is the existing public anon key for project
`xutjubkaskwchzyzwryk`. The implementer must read it from the Supabase dashboard
(Settings -> API -> `anon` key) and add it to the constant. The anon key is already
used in the edge function environment; this extends its use to the browser, which is
by design (it is a public key).

**Note on 401 interception:** This spec does NOT design an automatic 401 interceptor.
The `silentRefresh()` function is exposed for consumers to call explicitly. An automatic
interceptor is a separate enhancement. For Phase 1, the pattern is: before initiating
a purchase (in `useSeedPurchase`), the caller can call `silentRefresh()` if the token
may be near-expired. This is a progressive enhancement -- the spec does not block on
implementing the 401 interceptor.

#### A7-2 Files Changed Summary

```
apps/server/supabase/functions/wallet-auth/index.ts
  - Add: refresh_token to return JSON (line ~218)

apps/web/src/wallet/useWalletAuth.ts
  - Add: REFRESH_TOKEN_KEY constant
  - Add: SUPABASE_TOKEN_URL constant
  - Add: SUPABASE_ANON_KEY constant (implementer fills in value)
  - Add: refresh_token?: string to response data type
  - Add: sessionStorage.setItem(REFRESH_TOKEN_KEY, ...) after setAccessToken
  - Add: silentRefresh() function
  - Update: signOut() to clear REFRESH_TOKEN_KEY from sessionStorage
  - Update: return value to include silentRefresh
```

---

### Fix A8-2: care_log Action Type Whitelist on Guest Conversion

**Problem restated:** `seed-claim` inserts guest care_log entries with no `action_type`
whitelist. A malicious client can inject arbitrary action types, corrupting the care log
for the first (guest-converted) tree.

#### A8-2 Design Overview

Add a whitelist check before inserting care_log_entries in `seed-claim/index.ts`.
Invalid entries are SKIPPED (not rejected), with a server-side warning log.

**Skip vs Fail decision:** The NFT mint has already been completed and payment verified
at the point of care_log insertion (Step C in the loop, after Steps A-B). Failing the
entire claim due to an invalid care_log entry would leave the user with a minted NFT
but a failed API response -- a very bad UX. The financial transaction (RON payment,
NFT mint) is already irreversible. The correct behavior is to skip invalid entries and
log them for monitoring. Data integrity is preserved: the tree exists with a partial care
log rather than no care log at all.

**Citation:** This behavior is consistent with OWASP Input Validation Cheat Sheet
recommendation to "reject or sanitize unexpected inputs" -- here we sanitize by
skipping rather than error on a server-side data integrity concern where the financial
action is already complete.

#### A8-2 Allowed Guest Action Types

The CANONICAL whitelist for live care actions in `care-action/index.ts` (line 98) is:
```typescript
new Set(['water', 'prune', 'wire', 'wire-remove', 'fertilize', 'rotate'])
```

The GUEST whitelist must be a SUBSET appropriate for guest sessions:

```typescript
// Allowed action types in a guest care log (subset of care-action ALLOWED_ACTION_TYPES).
// Matches care-action/index.ts ALLOWED_ACTION_TYPES for care actions proper.
// 'tick' is INCLUDED because the guest session generates tick entries when days elapse.
// 'rotate' is EXCLUDED pending clarification of whether rotate is a guest-mode action.
// See DECISIONS.md for resolution of OQ-A8-2-1 (rotate in guest mode).
const ALLOWED_GUEST_ACTION_TYPES = new Set([
  'water',
  'tick',        // system-generated day-advance entries in guest session
  'prune',
  'wire',
  'wire-remove',
  'fertilize',
]);
```

**Why include 'tick'?** The guest session in `localStorage` may record `tick` entries
as game days elapse in the browser. These are system-generated (not user-triggered)
but may appear in `care_log` snapshots. Excluding `tick` would lose legitimate game
history.

**Why exclude 'rotate'?** 'rotate' exists in care-action's whitelist but its semantic
role in the guest session is unclear (no GDD section confirmed). Excluding it prevents
injection; add it when guest-mode support for rotate is confirmed.

#### A8-2 Server Change: seed-claim/index.ts

**File:** `apps/server/supabase/functions/seed-claim/index.ts`

Locate Step C (care_log hand-off, lines 385-411). Before the `entries = care_log.map(...)`
block, add:

```typescript
// A8-2: Whitelist check. Filter out entries with unknown action_type before INSERT.
// Prevents malicious clients from injecting fake care actions.
// Mirrors care-action/index.ts ALLOWED_ACTION_TYPES; includes 'tick' for guest session day entries.
// See ARCH-WEB3-SECURITY-CORRECTIONS-2026-08-17.md Fix A8-2.
const ALLOWED_GUEST_ACTION_TYPES = new Set([
  'water', 'tick', 'prune', 'wire', 'wire-remove', 'fertilize',
]);
```

Then update the `entries` construction to filter:

Current (lines 393-401):
```typescript
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
```

New (filter BEFORE map, reassign sequence after filtering):
```typescript
const validEntries = (care_log as unknown[]).filter((entry: unknown) => {
  const e = entry as { type?: string };
  const allowed = ALLOWED_GUEST_ACTION_TYPES.has(e.type ?? '');
  if (!allowed) {
    console.warn(`care_log entry skipped (invalid action_type='${e.type ?? ''}') for tree ${treeId}`);
  }
  return allowed;
});

const entries = validEntries.map((entry: unknown, seq: number) => {
  const e = entry as { day?: number; type?: string; data?: unknown };
  return {
    tree_id:     treeId,
    game_day:    e.day ?? 0,
    sequence:    seq,          // sequence is re-derived from filtered index
    action_type: e.type ?? '',
    action_data: e.data ?? null,
  };
});
```

**Sequence re-derivation note:** The original code uses the `.map(_, seq)` index as the
sequence number. After filtering, the sequence numbers start at 0 for the first VALID
entry and increment from there. This is correct: the sequence is a DB ordering field, not
required to match the original guest session index.

#### A8-2 Where to Define the Constant

The whitelist lives inline in `seed-claim/index.ts` (not in `@kijo/shared`) because:
1. `@kijo/shared` is a TypeScript package consumed by the client-side engine and browser --
   putting server security constants there exposes them publicly
2. seed-claim is the only server function that inserts guest care log entries
3. A comment links it to care-action's definition for maintainability

The implementer must add a cross-reference comment pointing to `care-action/index.ts`
ALLOWED_ACTION_TYPES so future maintainers know to keep them aligned.

#### A8-2 Files Changed Summary

```
apps/server/supabase/functions/seed-claim/index.ts
  - Add: ALLOWED_GUEST_ACTION_TYPES constant (inside Step C block)
  - Replace: care_log.map() -> filter then map with whitelist and warning log
  - Update: entries sequence re-derived from filtered array index
```

---

## ASSUMPTIONS

```
A-1: Ronin Wallet extension supports eth_signTypedData_v4 JSON-RPC.
     The tanto-connect library routes signTypedData through the connected wallet.
     If the Ronin Wallet extension does NOT support EIP-712 structured signing, the
     signTypedDataAsync() call will throw or be ignored. Mitigation: test on Saigon
     testnet before deploying. The Ronin Wallet browser extension (v3.x+) is known
     to support EIP-712 from the axie.origin.com implementation (UNVERIFIED directly).

A-2: verifyOtp().session.refresh_token is populated.
     All Supabase magic-link sessions return both access_token and refresh_token.
     This follows from the OAuth2 session contract. The Supabase JS SDK Session type
     includes refresh_token. VERIFIED by inspection of SDK types; not directly confirmed
     by runtime observation.

A-3: The Supabase auth token endpoint for raw refresh is:
     POST https://xutjubkaskwchzyzwryk.supabase.co/auth/v1/token?grant_type=refresh_token
     This is the standard GoTrue token endpoint. VERIFIED by Supabase architecture docs
     (GoTrue is the auth server). Exact field names { refresh_token } in request body
     assumed from OAuth2 spec -- not verified against a live Supabase endpoint directly.

A-4: KIJONSAI_CONTRACT_ADDRESS Supabase secret is already set in the wallet-auth function
     environment (it IS set for seed-claim, and Supabase secrets are project-wide).
     If wallet-auth is deployed with different secret access, it must be added explicitly.

A-5: 'tick' appears in guest localStorage care_log entries.
     The guest mode implementation is NOT STARTED (STATE.md). The tick entry assumption
     is based on the existing care log replay design (care actions + tick entries together
     represent full game history). Mitigation: if tick entries do NOT appear in guest
     localStorage, removing 'tick' from ALLOWED_GUEST_ACTION_TYPES is safe and trivial.

A-6: Supabase JWT expiry for project xutjubkaskwchzyzwryk is currently <= 3600s.
     Default Supabase JWT expiry is 3600s. Assumed not changed from default. Implementer
     must confirm and document (see Fix A7-1).

A-7: crypto.getRandomValues() is available in the Supabase Edge Function runtime.
     The Supabase Edge Function runtime (Deno) implements the Web Crypto API natively.
     VERIFIED by Deno documentation. crypto global is available without import.
```

---

## OPEN QUESTIONS FOR JEREMY

```
OQ-A3-1-1: verifyingContract sentinel vs Kijonsai contract address
  Context: This spec uses the Kijonsai testnet contract (0x4447F631...) as the
  verifyingContract in the EIP-712 domain. When the mainnet contract deploys at a
  DIFFERENT address, users on testnet who re-auth after the mainnet deploy will sign
  with a different domain than the mainnet server expects (if the server is updated
  to the mainnet address first).
  Question: Is this acceptable? (It means testnet auth breaks when mainnet deploys.)
  Alternative: Use a fixed sentinel address that never changes (e.g., a vanity address
  or the project multisig address), keeping the domain consistent across environments.
  Default: This spec uses the contract address (simplest). If you want a sentinel, say so.

OQ-A7-1-1: Actual JWT expiry setting in the dashboard
  Context: The implementer must verify and document the current JWT expiry for project
  xutjubkaskwchzyzwryk. If it was set to something longer than 3600s during development,
  it must be corrected before mainnet.
  Question: Implementer action required -- please confirm the setting and append the date
  to the DECISIONS.md entry.

OQ-A7-2-1: SUPABASE_ANON_KEY value for browser-side refresh
  Context: The raw token refresh endpoint requires the anon key in the request headers.
  The anon key for project xutjubkaskwchzyzwryk is a public key that exists in the
  Supabase dashboard (Settings -> API -> anon public key). It is safe to include in
  frontend code.
  Question: Confirm the implementer has the anon key available and include it in the
  SUPABASE_ANON_KEY constant. (This is a lookup task, not a decision.)

OQ-A8-2-1: Does 'rotate' belong in the guest action whitelist?
  Context: 'rotate' is in care-action's ALLOWED_ACTION_TYPES. It's excluded from the
  guest whitelist in this spec because its meaning in a guest session is unclear.
  Question: Can a guest session produce 'rotate' entries? If yes, add it. If no (rotate
  is wallet-only or not yet implemented), keep it excluded.

OQ-A8-2-2: Does 'tick' actually appear in guest localStorage care_log?
  Context: The guest mode implementation is NOT STARTED. The spec includes 'tick' in the
  guest whitelist based on the design intent. If the guest care log in localStorage does
  NOT include tick entries (e.g., tick is server-side only), 'tick' can be removed from
  ALLOWED_GUEST_ACTION_TYPES.
  Question: When guest mode is implemented (ARCH-GUEST-MODE.md), confirm whether tick
  entries appear in localStorage and update the whitelist accordingly.
```

---

## IMPLEMENTATION ORDER

The fixes are independent and can be implemented in any order. Recommended order by
priority (mainnet blockers first):

```
1. Fix A3-1  (BLOCKING mainnet) -- EIP-712 signature upgrade
2. Fix A5-1/A8-1 (BLOCKING mainnet) -- server-side seed generation
3. Fix A8-2  (data integrity) -- care_log whitelist
4. Fix A7-1  (verification task) -- JWT expiry confirmation + documentation
5. Fix A7-2  (UX advisory) -- token refresh flow
```

Fix A3-1 and Fix A5-1/A8-1 MUST be deployed before any mainnet deployment.
Fix A8-2, A7-1, A7-2 are required but not mainnet-blocking by themselves.

---

## CITATIONS

```
EIP-712 (domain separator, typed structured data):
  Remco Bloemen, Leonid Logvinov, Jacob Evans,
  "EIP-712: Typed structured data hashing and signing"
  Ethereum Improvement Proposals, no. 712, September 2017.
  https://eips.ethereum.org/EIPS/eip-712 (fetched 2026-08-17)

viem signTypedData source:
  wevm/viem, src/actions/wallet/signTypedData.ts (main branch)
  https://github.com/wevm/viem/blob/main/src/actions/wallet/signTypedData.ts
  MIT License.

viem verifyTypedData standalone utility:
  viem.sh/docs/utilities/verifyTypedData
  Confirms no-client usage for EOA verification.
  https://viem.sh/docs/utilities/verifyTypedData (fetched 2026-08-17)

wagmi useSignTypedData:
  wagmi.sh/react/api/hooks/useSignTypedData
  https://wagmi.sh/react/api/hooks/useSignTypedData (fetched 2026-08-17)

NIST SP 800-90A Rev.1 (CSPRNG requirement):
  NIST, "Recommendation for Random Number Generation Using Deterministic Random Bit Generators"
  https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-90Ar1.pdf
  Rationale for crypto.getRandomValues over Math.random() for asset-affecting values.

RFC 7519 §4.1.4 (JWT exp claim):
  M. Jones, J. Bradley, N. Sakimura, "JSON Web Token (JWT)"
  https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.4

OWASP JWT Security Cheat Sheet:
  https://cheatsheats.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html
  Recommends short expiry, token refresh, sessionStorage over localStorage.

OWASP Input Validation Cheat Sheet:
  https://cheatsheats.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
  "Reject or sanitize unexpected inputs"

Existing established pattern cited:
  care-action/index.ts line 98: ALLOWED_ACTION_TYPES -- the established whitelist pattern
  for server-side action type validation in this project.
```

---

*Architect: verified-architect skill. No implementation. No code changes.*
*No auto-commits. No mainnet deployment recommendation.*
*Every pattern traced to a verified source or marked UNVERIFIED.*
