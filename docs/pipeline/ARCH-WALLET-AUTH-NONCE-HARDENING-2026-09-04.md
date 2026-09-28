# DESIGN: Wallet-Auth Nonce Hardening — Server-Issued Crypto Nonces
# DATE: 2026-09-04
# STAGE: Architect (verified-architect skill)
# STATUS: READY FOR IMPLEMENTER

---

## SCOPE

```
DESIGN TASK: Replace client-generated Date.now() nonce with server-issued cryptographic
             nonce backed by a Supabase auth_nonces table. Single-use, time-bound,
             rate-limited.
DELIVERABLE: This spec document. The implementer reads ONLY this spec and the source
             files it names. No other research required.
BUILDS ON:   ARCH-WEB3-SECURITY-CORRECTIONS-2026-08-17.md (Fix A3-1 EIP-712 upgrade),
             AUDIT-WEB3-PURCHASE-SECURITY-2026-08-17.md,
             Second Brain wiki patterns (dwi/siwe-convex-auth, truongnguyenptn/ronin-security)
CONSUMED BY: Implementer (disciplined-implementer skill), then Auditor (adversarial-auditor skill)
```

### What this spec covers

1. **`auth_nonces` Supabase table** -- schema for server-issued crypto nonces
2. **`wallet-auth-nonce` Edge Function** (NEW) -- generates and stores crypto nonce
3. **Updated `wallet-auth` Edge Function** -- verifies nonce against auth_nonces table
4. **Updated `useWalletAuth.ts`** -- fetches server nonce before EIP-712 signing

### Multiple wallet connection entry points

The Kijo Bonsai caretaker game has TWO wallet connection entry points:
1. **Store UI** -- wallet connects during seed purchase flow
2. **Header** -- persistent wallet connection/status in the app header

Both entry points MUST use the same auth flow. The design achieves this by
encapsulating the nonce fetch inside `useWalletAuth.signIn()`. Any component
that calls `signIn()` automatically gets server-issued nonce -> EIP-712 sign ->
verify flow. The implementer MUST NOT create separate auth logic for store vs
header. Both import and call the same `useWalletAuth` hook.

**Note:** This spec is for kijo-bonsai (the caretaker game) only. The kijo combat
game is NOT in scope. These are two parts of the same Kijo project.

### What this spec does NOT cover

- useWallet.ts -- already hardened with EIP-712 signTypedData (Fix A3-1). No changes.
- seed-claim or care-action flows -- out of scope
- SIWE message format -- we keep KijoAuth EIP-712 type, only swap nonce source
- No new npm dependencies on the client
- kijo combat game (separate part of Kijo project, separate auth scope)

---

## CODEBASE RECONNAISSANCE

### Files Read

```
CRITICAL GAP: The wallet source files and edge functions DO NOT EXIST on disk.
  - apps/web/src/wallet/useWalletAuth.ts -- NOT FOUND
  - apps/web/src/wallet/useWallet.ts -- NOT FOUND
  - apps/server/supabase/functions/wallet-auth/index.ts -- NOT FOUND
  - apps/web/package.json -- EXISTS (read directly, no wallet deps yet)

The repo has a single baseline commit (c168cba) containing only engine packages.
The web app has only main.ts, package.json (with @kijo/engine, @kijo/shared deps),
and a vite config.

BASELINE SOURCE: ARCH-WEB3-SECURITY-CORRECTIONS-2026-08-17.md (stored in Second Brain
raw/kijo/pipeline/) provides verified codebase reconnaissance with exact line numbers
and file contents for all wallet files as they existed on 2026-08-17. That spec's
reconnaissance is treated as the AUTHORITATIVE baseline for file interfaces.
```

### Symbols Verified (from prior spec's verified reconnaissance)

```
VERIFIED (via prior architect spec, not direct disk read):
  v useSignTypedData        -- useWallet.ts; imported from 'wagmi' (per Fix A3-1)
  v signTypedDataAsync      -- useWallet.ts; from useSignTypedData()
  v authenticate(nonce)     -- useWallet.ts line 27; (nonce: string) => Promise<string>
                               Signature UNCHANGED by this spec.
  v KIJO_AUTH_TYPES          -- useWallet.ts; KijoAuth: [{name:'address',type:'address'},
                               {name:'nonce',type:'string'}]
  v KIJO_CONTRACT            -- useWallet.ts; '0x4447F631F5868bFA03A6e6ae2D2da9f22c787E44'
  v signIn()                -- useWalletAuth.ts line 41; calls authenticate(nonce)
  v NONCE_WINDOW_MS          -- wallet-auth/index.ts line 39; 5 * 60 * 1000
  v verifyTypedData          -- wallet-auth/index.ts; imported from 'npm:viem@2' (per Fix A3-1)
  v RONIN_CHAIN_ID           -- wallet-auth/index.ts; from Deno.env, default 202601
  v KIJONSAI_CONTRACT_ADDRESS-- wallet-auth/index.ts; from Deno.env, default 0x4447F631...

NOT ON DISK (proposed additions by this spec):
  + auth_nonces table        -- NEW Supabase table (this spec)
  + wallet-auth-nonce function -- NEW Edge Function (this spec)
  + fetchNonce()             -- NEW client function in useWalletAuth.ts (this spec)
```

### Call Sites (from prior spec)

```
authenticate(nonce):
  1 call site -- useWalletAuth.ts signIn() body
  Signature: (nonce: string) => Promise<string>
  UNCHANGED by this spec. Only the source of the nonce argument changes.

signIn() in useWalletAuth.ts:
  Called by consumer components (specific call sites unknown -- not on disk)
  Interface UNCHANGED: signIn() remains a no-arg async function.
```

### Data Structure Usage

```
wallet-auth request body: { address: string, signature: string, nonce: string }
  UNCHANGED. The nonce field carries the server-issued hex string instead of Date.now().

wallet-auth response: { access_token: string, refresh_token: string, user_id: string }
  UNCHANGED by this spec.

NEW: wallet-auth-nonce request body: { address: string }
NEW: wallet-auth-nonce response: { nonce: string, expires_at: string }
```

### Gaps Found

```
GAPS:
  ! All wallet files are missing from disk -- implementer must create them
    (or the A3-1 implementer must create them first; this spec layers on top of A3-1)
  ! apps/web/package.json has no wagmi, viem, or wallet dependencies
    The A3-1 implementation must add these before this spec can be implemented.
  ! No Supabase CLI project structure (no supabase/ directory in repo)
    Edge functions must be scaffolded.

DEPENDENCY: This spec REQUIRES Fix A3-1 (EIP-712 upgrade) to be implemented first.
  The nonce hardening layers on top of the EIP-712 signing flow. If A3-1 is not yet
  implemented, implement it first per ARCH-WEB3-SECURITY-CORRECTIONS-2026-08-17.md.
```

---

## OPEN SOURCE RESEARCH

### Second Brain Wiki Patterns Used

#### Pattern 1: dwi's SIWE Nonce Generation (VERIFIED in wiki)

**Source:** `wiki/patterns/dwi/siwe-convex-auth.md` -- Pattern 2: SIWE Message Generation

dwi generates nonces server-side using:
```typescript
const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
  .map(b => b.toString(16).padStart(2, '0')).join('');
```

This produces a 32-character hex string (128 bits of entropy) from the Web Crypto API.
128 bits exceeds the EIP-4361 SIWE minimum of 8 alphanumeric characters.

**Applicability:** Direct. We use the same `crypto.getRandomValues(new Uint8Array(16))`
pattern for nonce generation in the wallet-auth-nonce Edge Function. The Deno runtime
(Supabase Edge Functions) implements the Web Crypto API natively.

**Adaptation:** dwi's pattern generates the nonce inline during message generation.
We separate nonce generation into its own Edge Function endpoint so the nonce can be
stored in the auth_nonces table before the client receives it.

#### Pattern 2: truongnguyenptn's CEI Pattern (VERIFIED in wiki)

**Source:** `wiki/patterns/truongnguyenptn/ronin-security.md` -- Guard: Checks-Effects-Interactions

```solidity
function withdraw(uint256 amount) external {
    // Checks
    require(balances[msg.sender] >= amount, "Insufficient balance");
    // Effects (state changes BEFORE external call)
    balances[msg.sender] -= amount;
    // Interactions (external calls LAST)
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success, "Transfer failed");
}
```

**Applicability:** We apply the CEI pattern to nonce verification in the wallet-auth
Edge Function. The nonce is marked `used = true` in the database BEFORE the EIP-712
signature verification call. This prevents a race condition where two concurrent requests
with the same nonce could both pass the "is nonce unused?" check before either marks it
used. The UPDATE ... SET used = true WHERE used = false returns the number of affected
rows -- if 0 rows affected, the nonce was already consumed (atomic single-use enforcement).

#### Pattern 3: truongnguyenptn's Signature Replay Prevention (VERIFIED in wiki)

**Source:** `wiki/patterns/truongnguyenptn/ronin-security.md` -- Security: Signature Replay Prevention

```solidity
mapping(address => uint256) public nonces;
function executeWithSignature(..., uint256 nonce, bytes memory signature) external {
    require(nonce == nonces[msg.sender]++, "Invalid nonce");
    // ... verify signature
}
```

**Applicability:** The on-chain pattern uses sequential nonces with atomic increment.
Our server-side pattern uses random nonces with single-use flag instead (more suitable
for stateless HTTP where requests may arrive out of order). The principle is the same:
consume the nonce atomically before acting on the signature.

#### Pattern 4: truongnguyenptn's Rate Limiting (VERIFIED in wiki)

**Source:** `wiki/patterns/truongnguyenptn/ronin-security.md` -- Guard: Rate Limiting Modifier

```solidity
mapping(address => uint256) public lastActionTime;
uint256 public constant COOLDOWN = 1 hours;
modifier rateLimited() {
    require(block.timestamp >= lastActionTime[msg.sender] + COOLDOWN, "Rate limited");
    lastActionTime[msg.sender] = block.timestamp;
    _;
}
```

**Applicability:** We apply rate limiting to the wallet-auth-nonce endpoint to prevent
nonce flooding (DoS via table bloat). The rate limit uses a SQL query counting recent
nonces per wallet address within a sliding window, rather than a last-action timestamp,
because we need to allow multiple nonces within a session (e.g., retry after failed signing)
while preventing abuse.

### Code Source Audits

#### Audit 1: crypto.getRandomValues in Deno Edge Functions

```
CODE SOURCE AUDIT
  snippet:     crypto.getRandomValues(new Uint8Array(16))
  origin:      Web Crypto API standard; Deno implements natively
  license:     Standard Web API -- no license restriction
  version:     Available in all Deno 1.x and 2.x (Supabase Edge Function runtime)
  current:     Yes -- standard, not deprecated
  assumptions: crypto global available in Deno without import (confirmed)
  limitations: Max buffer = 65536 bytes. 16 bytes << limit. PASS.
  adaptation:  None. Synchronous call, no await needed.
  verdict:     USE AS-IS
```

#### Audit 2: dwi's hex nonce encoding

```
CODE SOURCE AUDIT
  snippet:     Array.from(...).map(b => b.toString(16).padStart(2,'0')).join('')
  origin:      dwi/react-vite-convexauth-siwe-appkit-tanto-widget (GitHub)
  license:     MIT (dwi's repos are MIT-licensed)
  version:     Current JavaScript standard methods
  current:     Yes -- no deprecated APIs
  assumptions: Uint8Array values in [0,255]; toString(16) produces 1-2 hex chars
  limitations: None for this use case
  adaptation:  None. Used as-is.
  verdict:     USE AS-IS
```

---

## VERIFICATION LOG

```
VERIFIED:
  v crypto.getRandomValues() available in Deno Edge Function runtime
    Source: Deno docs (confirmed in prior spec's Code Source Audit 3)
  v EIP-712 KijoAuth types: [{name:'address',type:'address'},{name:'nonce',type:'string'}]
    Source: ARCH-WEB3-SECURITY-CORRECTIONS Fix A3-1 (verified against EIP-712 spec)
  v Nonce field in KijoAuth is type 'string' -- hex nonce string is compatible
    Source: EIP-712 spec; string type accepts arbitrary string values
  v viem verifyTypedData works for EOA verification without a Client object
    Source: Prior spec Audit 1 (viem.sh/docs/utilities/verifyTypedData)
  v Supabase project ref: xutjubkaskwchzyzwryk
    Source: Prior spec, task prompt
  v RONIN_CHAIN_ID default 202601 (Saigon testnet)
    Source: seed-claim/index.ts line 38 (prior spec reconnaissance)
  v KIJONSAI_CONTRACT_ADDRESS default 0x4447F631F5868bFA03A6e6ae2D2da9f22c787E44
    Source: Task prompt, prior spec
  v dwi nonce pattern: crypto.getRandomValues(new Uint8Array(16)) -> 32-char hex
    Source: wiki/patterns/dwi/siwe-convex-auth.md Pattern 2 (read directly)
  v truongnguyenptn CEI pattern: state change before external interaction
    Source: wiki/patterns/truongnguyenptn/ronin-security.md (read directly)
  v truongnguyenptn replay prevention: nonce consumed atomically
    Source: wiki/patterns/truongnguyenptn/ronin-security.md (read directly)
  v truongnguyenptn rate limiting: per-address cooldown/window
    Source: wiki/patterns/truongnguyenptn/ronin-security.md (read directly)

UNVERIFIED:
  ? Supabase Edge Function can query Supabase tables via service_role key
    Assumed: Edge Functions have access to SUPABASE_SERVICE_ROLE_KEY env var
    and can create a Supabase client to query tables. This is the standard
    Supabase Edge Function pattern. Cannot verify without running code.
    Mitigation: If service_role key is not available, use direct PostgreSQL
    connection string (SUPABASE_DB_URL).

  ? Exact Supabase SQL migration workflow for this project
    The repo has no supabase/ CLI directory. Migrations may be applied via
    dashboard or MCP tool. Mitigation: Provide raw SQL; implementer applies
    via whichever method is configured.

REFUTED:
  x "useWalletAuth.ts exists on disk at apps/web/src/wallet/useWalletAuth.ts"
    Actual: File does not exist. Repo has only baseline commit with engine packages.
    Impact: Implementer must create this file (or it must be created by A3-1 first).
```

---

## CROSS-REFERENCE CHECK

```
CHECKED AGAINST:
  - ARCH-WEB3-SECURITY-CORRECTIONS-2026-08-17.md (Fix A3-1 EIP-712)
  - AUDIT-WEB3-PURCHASE-SECURITY-2026-08-17.md (advisory findings)
  - STATE.md (build status)
  - DECISIONS.md (architectural decisions)
  - SESSION-START.md (session rules)

CONSISTENT: Yes.
  - KijoAuth EIP-712 types unchanged from A3-1
  - Domain separator unchanged (name, version, chainId, verifyingContract)
  - Nonce field remains type 'string' in EIP-712 types (hex nonce is a string)
  - authenticate(nonce: string) signature unchanged
  - wallet-auth request body { address, signature, nonce } unchanged

TERMINOLOGY ALIGNED: Yes.
  - "nonce" used consistently (not "challenge" or "token")
  - "wallet-auth" and "wallet-auth-nonce" follow existing naming convention
  - "auth_nonces" table follows Supabase snake_case convention

DATA SHAPES ALIGNED:
  - wallet-auth request body: UNCHANGED
  - wallet-auth response: UNCHANGED
  - NEW endpoint wallet-auth-nonce: { address } -> { nonce, expires_at }

BOUNDARY VIOLATIONS: None.
  - New Edge Function (wallet-auth-nonce) follows existing pattern
  - New Supabase table (auth_nonces) is server-only
  - Client changes confined to useWalletAuth.ts (no new deps)
```

---

## THE DESIGN

---

### Component 1: `auth_nonces` Supabase Table

#### SQL Migration

```sql
-- Migration: create auth_nonces table for server-issued crypto nonces
-- Apply via: supabase migration new create_auth_nonces
-- Or via MCP: mcp__014608fa__apply_migration

CREATE TABLE IF NOT EXISTS auth_nonces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  nonce       TEXT NOT NULL UNIQUE,
  used        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);

-- Index for nonce lookup (used in wallet-auth verification)
CREATE INDEX idx_auth_nonces_nonce ON auth_nonces (nonce) WHERE used = false;

-- Index for rate limiting queries (count recent nonces per wallet)
CREATE INDEX idx_auth_nonces_wallet_created ON auth_nonces (wallet_address, created_at);

-- Index for cleanup job (expired nonces)
CREATE INDEX idx_auth_nonces_expires ON auth_nonces (expires_at) WHERE used = false;

-- RLS: no direct client access. Only Edge Functions via service_role key.
ALTER TABLE auth_nonces ENABLE ROW LEVEL SECURITY;
-- No RLS policies = no client access. Service role bypasses RLS.
```

#### Schema Rationale

| Column | Type | Why |
|--------|------|-----|
| id | UUID | Primary key, no sequential leak |
| wallet_address | TEXT | Lowercase hex address for rate limiting |
| nonce | TEXT UNIQUE | 32-char hex string (128-bit entropy). UNIQUE constraint prevents INSERT of duplicate nonce. |
| used | BOOLEAN | Single-use flag. Atomically set to true via UPDATE ... WHERE used = false. |
| created_at | TIMESTAMPTZ | For rate limiting window queries |
| expires_at | TIMESTAMPTZ | 5-minute expiry. Calculated as created_at + interval '5 minutes' at INSERT time. |

#### Cleanup

Expired and used nonces accumulate. Add a scheduled cleanup (can be a pg_cron job or
a periodic Edge Function):

```sql
-- Run daily (or hourly) to purge stale nonces
DELETE FROM auth_nonces
WHERE used = true OR expires_at < now() - interval '1 hour';
```

This is NOT a blocker for implementation. The table works without cleanup; it just grows.
Add cleanup as a follow-up task.

---

### Component 2: `wallet-auth-nonce` Edge Function (NEW)

#### Purpose

Generates a cryptographic nonce, stores it in auth_nonces, and returns it to the client.
The client includes this nonce in its EIP-712 signature. The wallet-auth function then
verifies the nonce exists and is unused before verifying the signature.

#### Request/Response

```
POST https://xutjubkaskwchzyzwryk.supabase.co/functions/v1/wallet-auth-nonce

Request Headers:
  Content-Type: application/json

Request Body:
  { "address": "0x..." }   // wallet address (lowercase hex)

Success Response (200):
  {
    "nonce": "a1b2c3d4e5f6...32chars",   // 32-char hex string
    "expires_at": "2026-09-04T12:05:00Z"  // ISO 8601, 5 minutes from now
  }

Error Responses:
  400: { "error": "address is required" }
  429: { "error": "rate limit exceeded", "retry_after": 60 }
  500: { "error": "internal error" }
```

#### Implementation Spec

```typescript
// File: apps/server/supabase/functions/wallet-auth-nonce/index.ts

import { createClient } from 'npm:@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std/http/server.ts';

// --- Constants ---

// Rate limit: max 10 nonce requests per wallet per 5-minute window.
// Prevents nonce flooding (table bloat DoS).
// Pattern: truongnguyenptn/ronin-security.md Rate Limiting Modifier
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_MAX = 10;

// Nonce expiry: 5 minutes (matches existing NONCE_WINDOW_MS in wallet-auth)
const NONCE_EXPIRY_MINUTES = 5;

// CORS headers (match existing wallet-auth pattern)
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const { address } = await req.json();

    // --- CHECK 1: address is present and valid hex ---
    if (!address || typeof address !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return new Response(
        JSON.stringify({ error: 'address is required (0x-prefixed, 40 hex chars)' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedAddress = address.toLowerCase();

    // --- Supabase client (service role -- bypasses RLS) ---
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // --- CHECK 2: Rate limit ---
    // Pattern: truongnguyenptn rate limiting (per-address sliding window)
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { count, error: countError } = await supabase
      .from('auth_nonces')
      .select('*', { count: 'exact', head: true })
      .eq('wallet_address', normalizedAddress)
      .gte('created_at', windowStart);

    if (countError) {
      console.error('Rate limit query error:', countError);
      return new Response(
        JSON.stringify({ error: 'internal error' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    if ((count ?? 0) >= RATE_LIMIT_MAX) {
      return new Response(
        JSON.stringify({ error: 'rate limit exceeded', retry_after: 60 }),
        { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // --- GENERATE NONCE ---
    // Pattern: dwi/siwe-convex-auth.md Pattern 2
    // crypto.getRandomValues(new Uint8Array(16)) -> 128-bit random -> 32-char hex
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const now = new Date();
    const expiresAt = new Date(now.getTime() + NONCE_EXPIRY_MINUTES * 60 * 1000);

    // --- STORE NONCE ---
    const { error: insertError } = await supabase
      .from('auth_nonces')
      .insert({
        wallet_address: normalizedAddress,
        nonce,
        used: false,
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      // UNIQUE constraint violation = nonce collision (astronomically unlikely with 128 bits)
      console.error('Nonce insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'internal error' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // --- RETURN NONCE ---
    return new Response(
      JSON.stringify({ nonce, expires_at: expiresAt.toISOString() }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('wallet-auth-nonce error:', err);
    return new Response(
      JSON.stringify({ error: 'internal error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
});
```

#### Security Invariants

1. **128-bit entropy:** `Uint8Array(16)` = 128 bits. Collision probability < 2^-64 even
   after 2^32 nonces (birthday bound). Far exceeds EIP-4361 minimum of 8 alphanumeric chars.
2. **Rate limited:** Max 10 nonces per wallet per 5 minutes prevents table bloat DoS.
3. **No authentication required:** The nonce endpoint is unauthenticated (the wallet hasn't
   proven identity yet -- that's what the nonce is for). Rate limiting by address prevents abuse.
4. **Server-only storage:** RLS enabled with no policies = no client-side access to auth_nonces.

---

### Component 3: Updated `wallet-auth` Edge Function

#### Changes from Current

The current wallet-auth (per prior spec) uses Date.now() nonce validation:
- Client sends `nonce: Date.now().toString()`
- Server checks `|serverTime - parseInt(nonce)| < NONCE_WINDOW_MS`
- Server checks `used_nonces` table for replay

**New flow:** Server verifies nonce against `auth_nonces` table instead:
- Client sends `nonce: "<32-char hex from wallet-auth-nonce>"`
- Server looks up nonce in auth_nonces table
- Server marks nonce used BEFORE signature verification (CEI pattern)
- Server verifies EIP-712 signature with the nonce

#### Updated Verification Logic

Replace the existing nonce validation block in wallet-auth/index.ts. The exact line
numbers depend on the state of the file after A3-1 implementation.

**Remove:**
```typescript
// Old: timestamp-based nonce validation
const nonceTimestamp = parseInt(nonce, 10);
const now = Date.now();
if (isNaN(nonceTimestamp) || Math.abs(now - nonceTimestamp) > NONCE_WINDOW_MS) {
  return json({ error: 'nonce expired or invalid' }, 401);
}

// Old: used_nonces replay check
const { data: existingNonce } = await supabase
  .from('used_nonces')
  .select('nonce')
  .eq('nonce', nonce)
  .single();

if (existingNonce) {
  return json({ error: 'nonce already used' }, 401);
}
```

**Replace with:**
```typescript
// --- NONCE VERIFICATION (CEI PATTERN) ---
// Pattern: truongnguyenptn/ronin-security.md Checks-Effects-Interactions
// Mark nonce used BEFORE signature verification to prevent race conditions.

// CHECK: Look up nonce in auth_nonces table
const { data: nonceRow, error: nonceError } = await supabase
  .from('auth_nonces')
  .select('id, wallet_address, used, expires_at')
  .eq('nonce', nonce)
  .single();

if (nonceError || !nonceRow) {
  return json({ error: 'invalid nonce' }, 401);
}

// CHECK: Nonce not expired
if (new Date(nonceRow.expires_at) < new Date()) {
  return json({ error: 'nonce expired' }, 401);
}

// CHECK: Nonce was issued for this wallet address
if (nonceRow.wallet_address !== address.toLowerCase()) {
  return json({ error: 'nonce not issued for this address' }, 401);
}

// EFFECT: Mark nonce as used BEFORE verification (CEI pattern)
// The UPDATE ... WHERE used = false is atomic. If another request already
// consumed this nonce, affectedRows = 0 and we reject.
// Pattern: truongnguyenptn replay prevention -- consume nonce atomically
const { data: updateResult, error: updateError } = await supabase
  .from('auth_nonces')
  .update({ used: true })
  .eq('id', nonceRow.id)
  .eq('used', false)
  .select('id');

if (updateError || !updateResult || updateResult.length === 0) {
  return json({ error: 'nonce already used' }, 401);
}

// INTERACTION: Now verify the EIP-712 signature (external crypto operation)
// ... existing verifyTypedData call follows unchanged ...
```

**Remove** the old `used_nonces` INSERT after signature verification (no longer needed --
nonce is already marked used above):
```typescript
// Old: INSERT into used_nonces after verification -- REMOVE
await supabase.from('used_nonces').insert({ nonce, wallet_address: address });
```

#### Old `used_nonces` Table

The old `used_nonces` table (if it exists) is superseded by `auth_nonces`. It can be
dropped after migration, but this is NOT part of this spec's scope. Leave it in place
until confirmed unused by all code paths.

#### Updated wallet-auth Request/Response

```
POST https://xutjubkaskwchzyzwryk.supabase.co/functions/v1/wallet-auth

Request Body (UNCHANGED):
  {
    "address": "0x...",
    "signature": "0x...",
    "nonce": "a1b2c3d4..."   // now a 32-char hex string instead of timestamp
  }

Success Response (UNCHANGED):
  {
    "access_token": "...",
    "refresh_token": "...",
    "user_id": "..."
  }

Error Responses (updated):
  401: { "error": "invalid nonce" }        // nonce not found in auth_nonces
  401: { "error": "nonce expired" }         // past expires_at
  401: { "error": "nonce not issued for this address" }  // wallet mismatch
  401: { "error": "nonce already used" }    // single-use violation (CEI atomic check)
  401: { "error": "invalid signature" }     // EIP-712 verification failed (unchanged)
```

#### Security Invariants

1. **CEI ordering:** Nonce marked used BEFORE signature verification. Even if verifyTypedData
   is slow or throws, the nonce is consumed. A failed signing attempt requires a fresh nonce.
2. **Atomic single-use:** `UPDATE ... WHERE used = false` returns 0 rows if already consumed.
   No TOCTOU race between check and consume.
3. **Address binding:** Nonce is bound to the requesting wallet address. Attacker cannot
   request a nonce for wallet A and use it to authenticate as wallet B.
4. **5-minute expiry:** Same window as before. Prevents stale nonce accumulation.
5. **No timestamp dependency:** Server no longer trusts client-provided timestamps.

---

### Component 4: Updated `useWalletAuth.ts`

#### Changes

Add a `fetchNonce()` function that calls the wallet-auth-nonce endpoint. Update `signIn()`
to fetch a server nonce before calling `authenticate(nonce)`.

#### New Constants

```typescript
// Server nonce endpoint
const NONCE_URL = 'https://xutjubkaskwchzyzwryk.supabase.co/functions/v1/wallet-auth-nonce';
```

#### New `fetchNonce()` Function

```typescript
// Fetch a server-issued crypto nonce for wallet authentication.
// The nonce is single-use and expires in 5 minutes.
async function fetchNonce(address: string): Promise<string> {
  const res = await fetch(NONCE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: address.toLowerCase() }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 429) {
      throw new Error('Too many authentication attempts. Please wait a minute and try again.');
    }
    throw new Error(data.error || 'Failed to get authentication nonce');
  }

  const data: { nonce?: string; expires_at?: string } = await res.json();
  if (!data.nonce) {
    throw new Error('Invalid nonce response from server');
  }

  return data.nonce;
}
```

#### Updated `signIn()` Flow

The current signIn() flow (per prior spec):
```typescript
// Old flow:
async function signIn() {
  const nonce = Date.now().toString();   // <-- client-generated
  const signature = await authenticate(nonce);
  // ... send { address, signature, nonce } to wallet-auth
}
```

New flow:
```typescript
// New flow:
async function signIn() {
  if (!address) {
    setAuthError('No wallet connected');
    return;
  }

  setIsAuthenticating(true);
  setAuthError(null);

  try {
    // Step 1: Fetch server-issued nonce
    const nonce = await fetchNonce(address);

    // Step 2: Sign with EIP-712 (nonce is now server-issued hex string)
    // authenticate() in useWallet.ts signs { address, nonce } with EIP-712 typed data.
    // The nonce field in KijoAuth is type 'string' -- hex nonce is compatible.
    const signature = await authenticate(nonce);

    // Step 3: Submit to wallet-auth (unchanged request body shape)
    const res = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: address.toLowerCase(),
        signature,
        nonce,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Authentication failed');
    }

    setAccessToken(data.access_token);
    // ... rest of success handling unchanged
  } catch (err) {
    setAuthError(err instanceof Error ? err.message : 'Authentication failed');
  } finally {
    setIsAuthenticating(false);
  }
}
```

#### Dual Entry Point Guarantee (Store UI + Header)

The Kijo Bonsai caretaker game connects wallets from two places:
1. **Store UI** -- user connects wallet to purchase seeds
2. **Header** -- persistent wallet status / connect button

Both MUST call `useWalletAuth().signIn()` as their auth entry point. Since
`fetchNonce()` is called inside `signIn()`, both paths automatically get
server-issued nonces. The implementer MUST NOT duplicate nonce-fetching
logic in store or header components.

**Correct pattern:**
```typescript
// In StoreWalletConnect.tsx or HeaderWallet.tsx -- same hook, same call
const { signIn, accessToken, isAuthenticating } = useWalletAuth();
// ... onClick={() => signIn()}
```

**Wrong pattern (DO NOT DO):**
```typescript
// DO NOT fetch nonce separately in component code
const nonce = await fetch(NONCE_URL, ...); // WRONG -- this is signIn()'s job
```

#### What Does NOT Change in useWalletAuth.ts

- The `authenticate()` call signature: `(nonce: string) => Promise<string>` -- unchanged
- The wallet-auth request body shape: `{ address, signature, nonce }` -- unchanged
- The response handling: access_token, refresh_token, user_id -- unchanged
- All other hooks and state variables -- unchanged
- The public API of the hook: `signIn()` remains a no-arg function. Both store and
  header components call it identically.

#### What Does NOT Change in useWallet.ts

- Nothing. useWallet.ts already has EIP-712 signing (Fix A3-1). The nonce parameter is
  type `string` in both the function signature and the KijoAuth EIP-712 type. A hex nonce
  string works identically to a timestamp string.

---

## FAILURE MODES AND ERROR RESPONSES

### Client-Side Failures

| Failure | User-Facing Error | Recovery |
|---------|-------------------|----------|
| wallet-auth-nonce returns 429 | "Too many authentication attempts. Please wait a minute and try again." | Wait 60s, retry |
| wallet-auth-nonce returns 500 | "Failed to get authentication nonce" | Retry after brief delay |
| wallet-auth-nonce network error | "Failed to get authentication nonce" | Check connection, retry |
| User rejects EIP-712 signing | Wallet-specific rejection message | User clicks sign-in again |
| wallet-auth returns "nonce expired" | "Authentication failed" (nonce took >5min) | Auto-retry with fresh nonce (or user retries) |
| wallet-auth returns "nonce already used" | "Authentication failed" | signIn() fetches a new nonce on next call |
| wallet-auth returns "invalid signature" | "Authentication failed" | Likely domain mismatch; debug |

### Server-Side Failures

| Failure | HTTP Status | Response | Root Cause |
|---------|-------------|----------|------------|
| Nonce not in auth_nonces | 401 | `{"error":"invalid nonce"}` | Fabricated nonce or table purged |
| Nonce expired | 401 | `{"error":"nonce expired"}` | >5 minutes between nonce request and auth |
| Nonce for wrong wallet | 401 | `{"error":"nonce not issued for this address"}` | Address swap attack |
| Nonce already consumed | 401 | `{"error":"nonce already used"}` | Replay attempt or race condition (both blocked) |
| Signature invalid | 401 | `{"error":"invalid signature"}` | Wrong key, domain mismatch, tampered message |
| DB error on nonce lookup | 500 | `{"error":"internal error"}` | Supabase down |
| DB error on nonce update | 500 | `{"error":"internal error"}` | Supabase down |

### Race Condition Analysis

**Scenario:** Two concurrent requests with the same nonce.

1. Request A: SELECT nonce -> found, used=false
2. Request B: SELECT nonce -> found, used=false
3. Request A: UPDATE SET used=true WHERE used=false -> 1 row affected -> proceeds
4. Request B: UPDATE SET used=true WHERE used=false -> 0 rows affected -> REJECTED

The CEI pattern (mark used before verify) combined with the atomic UPDATE WHERE ensures
exactly one request succeeds. This is the core security property.

**Scenario:** Nonce requested but never used (user closes tab).

The nonce sits in auth_nonces with used=false until expires_at passes. The cleanup job
purges it. No security impact -- unused nonces cannot be exploited without the wallet's
private key to produce a valid EIP-712 signature.

---

## FILES CHANGED SUMMARY

```
NEW FILES:
  apps/server/supabase/functions/wallet-auth-nonce/index.ts  -- nonce generation endpoint
  supabase/migrations/YYYYMMDD_create_auth_nonces.sql        -- table migration

MODIFIED FILES:
  apps/server/supabase/functions/wallet-auth/index.ts
    - Remove: timestamp-based nonce validation
    - Remove: used_nonces table INSERT
    - Add:    auth_nonces table lookup + CEI atomic consume
    - Remove: NONCE_WINDOW_MS constant (expiry is in the table row)

  apps/web/src/wallet/useWalletAuth.ts
    - Add:    NONCE_URL constant
    - Add:    fetchNonce() function
    - Change: signIn() to call fetchNonce() instead of Date.now()
    - Remove: Date.now().toString() nonce generation

UNCHANGED FILES:
  apps/web/src/wallet/useWallet.ts  -- EIP-712 signing already handles string nonces
```

---

## IMPLEMENTATION ORDER

```
1. Apply SQL migration (create auth_nonces table)
2. Deploy wallet-auth-nonce Edge Function
3. Update wallet-auth Edge Function (nonce verification)
4. Update useWalletAuth.ts (fetch server nonce)
5. Test end-to-end: connect wallet -> fetch nonce -> sign -> authenticate
```

Steps 2+3 can be deployed together (server-side). Step 4 must deploy with or after
steps 2+3 (client must not request server nonces before the endpoint exists).

---

## ASSUMPTIONS

```
A-1: Fix A3-1 (EIP-712 upgrade) is implemented before this spec.
     This spec layers on top of the EIP-712 signing flow. If A3-1 is not yet
     implemented, implement it first.
     Mitigation: Check useWallet.ts for signTypedDataAsync before starting.

A-2: Supabase Edge Functions have access to SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
     These are standard Supabase Edge Function environment variables.
     Mitigation: Verify with `supabase functions env list` or dashboard.

A-3: The wallet-auth Edge Function currently uses a used_nonces table.
     The prior spec references this table for replay prevention. If it doesn't
     exist yet (implementation not completed), the removal step is a no-op.

A-4: No client-side Supabase SDK is needed.
     All nonce requests use raw fetch(). Consistent with existing wallet-auth pattern.
     @supabase/supabase-js is NOT in apps/web/package.json and should not be added.

A-5: The auth_nonces table can be created without conflicting with existing schema.
     No table named auth_nonces currently exists. If it does, the migration will
     fail with a conflict -- check first.
```

---

## OPEN QUESTIONS

```
OQ-1: Should the nonce endpoint require an API key header?
  Context: The wallet-auth-nonce endpoint is currently open (no auth required).
  Rate limiting by address provides abuse protection. Adding an API key (e.g.,
  the Supabase anon key) would add a layer but is not strictly necessary since
  the nonce is useless without the wallet's private key.
  Default: No API key required. Rate limiting is sufficient.

OQ-2: Should failed signature verification un-mark the nonce (set used=false)?
  Context: CEI pattern means the nonce is consumed even if signature verification
  fails. A legitimate user who fat-fingers something loses their nonce and must
  request a new one. This is a minor UX cost but preserves security.
  Default: No. Keep nonce consumed on failure. Fresh nonce is cheap (one fetch).

OQ-3: Cleanup strategy for auth_nonces table.
  Context: Expired/used nonces accumulate. Options: pg_cron job (if enabled),
  scheduled Edge Function, or inline cleanup (delete expired on each INSERT).
  Default: Defer to follow-up task. Table works without cleanup initially.

OQ-4: Should the old used_nonces table be dropped?
  Context: This spec supersedes used_nonces with auth_nonces. The old table
  should be dropped after confirming no other code path uses it.
  Default: Leave in place. Drop in a separate cleanup task after audit confirms
  no remaining references.
```

---

## CITATIONS

```
dwi SIWE nonce generation pattern:
  Source: wiki/patterns/dwi/siwe-convex-auth.md, Pattern 2
  Repository: dwi/react-vite-convexauth-siwe-appkit-tanto-widget (GitHub)
  Used: crypto.getRandomValues(new Uint8Array(16)) -> hex encoding for nonce generation

truongnguyenptn CEI (Checks-Effects-Interactions) pattern:
  Source: wiki/patterns/truongnguyenptn/ronin-security.md, "Guard: Checks-Effects-Interactions"
  Repository: truongnguyenptn/ethereum-dev-skill (security.md)
  Used: State change (mark nonce used) BEFORE external interaction (signature verification)

truongnguyenptn signature replay prevention:
  Source: wiki/patterns/truongnguyenptn/ronin-security.md, "Security: Signature Replay Prevention"
  Repository: truongnguyenptn/ethereum-dev-skill (security.md)
  Used: Atomic nonce consumption preventing replay attacks

truongnguyenptn rate limiting modifier:
  Source: wiki/patterns/truongnguyenptn/ronin-security.md, "Guard: Rate Limiting Modifier"
  Repository: truongnguyenptn/ethereum-dev-skill (security.md)
  Used: Per-address rate limiting on nonce endpoint (adapted from on-chain cooldown to
  SQL sliding window)

EIP-712 (domain separator, typed structured data):
  Source: https://eips.ethereum.org/EIPS/eip-712
  Used: KijoAuth typed data structure for nonce signing

ARCH-WEB3-SECURITY-CORRECTIONS-2026-08-17.md:
  Source: Second Brain raw/kijo/pipeline/
  Used: Baseline for file interfaces, EIP-712 domain definition, KIJO_AUTH_TYPES

EIP-4361 (Sign-In with Ethereum) nonce specification:
  Source: https://eips.ethereum.org/EIPS/eip-4361
  Used: Nonce entropy requirements (128 bits exceeds minimum 8 alphanumeric chars)
```

---

*Architect: verified-architect skill. No implementation. No code changes.*
*No auto-commits. No mainnet deployment recommendation.*
*Every pattern traced to a verified source or marked UNVERIFIED.*
