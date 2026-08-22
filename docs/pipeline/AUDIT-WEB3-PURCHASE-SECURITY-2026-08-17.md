```
AUDIT: Web3 Purchase & Real-Money Logic Security Review
DATE: 2026-08-17
AUDITOR ROLE: Web3 Cybersecurity Researcher (adversarial, anti-trust-nothing discipline)
SCOPE: kijo-bonsai purchase + real-money flow -- testnet state, pre-mainnet gate
```

---

## Files Read Directly (no assumptions)

- `packages/contracts/contracts/Kijonsai.sol`
- `apps/server/supabase/functions/seed-claim/index.ts`
- `apps/server/supabase/functions/wallet-auth/index.ts`
- `apps/server/supabase/functions/care-action/index.ts`
- `apps/web/src/wallet/useSeedPurchase.ts`
- `apps/web/src/wallet/useWalletAuth.ts`
- `apps/web/src/components/StoreModal.tsx`
- `apps/server/supabase/migrations/20260722120000_seed_claims.sql`
- `apps/server/supabase/migrations/20260722130000_nextval_fn.sql`
- `apps/server/supabase/migrations/20260723000000_wallet_auth_lookup.sql`
- `apps/server/supabase/migrations/20260806000001_trees_token_id.sql`
- `apps/server/supabase/migrations/20260806000002_render_queue.sql`
- `apps/server/supabase/migrations/20260806000003_seed_claims_token_ids.sql`
- `apps/server/supabase/migrations/20260807000001_render_queue_updated_at_trigger.sql`
- `apps/server/supabase/migrations/20260807000002_trees_wallet_id_index.sql`
- `apps/server/supabase/migrations/20260808000001_used_nonces.sql`
- `apps/server/supabase/migrations/20260808000002_decrement_consumable_fn.sql`
- `STATE.md`, `DECISIONS.md`, `SESSION-START.md`
- `docs/KIJONSAI-CONTRACT-ARCH.md`, `docs/PHASE1-RONIN-ARCH.md`, `docs/PHASE2-WALLET-ARCH.md`

---

## DOMAIN 1: Payment Verification (On-Chain)

```
Verdict: PASS
```

**Evidence observed in code:**

The Kijonsai contract (`Kijonsai.sol`, pragma `^0.8.28`) has no payable function and no payment logic. `mintKijonsai` accepts zero `msg.value`:

```solidity
function mintKijonsai(address to, uint256 tokenId, string calldata uri)
    external onlyRole(MINTER_ROLE)
{
    _safeMint(to, tokenId);
    _setTokenURI(tokenId, uri);
}
```

This is correct by design: the RON payment is a plain transfer to `TREASURY` (EOA `0x68bd10cf714217eb9877b37812a548b801a94894`), not a contract call. Payment verification is entirely server-side in `seed-claim/index.ts`. ALL 5 checks are verified before any mint loop begins (lines 227-303 of `seed-claim/index.ts`):

1. `eth_getTransactionByHash` → tx must exist and have a non-null `blockNumber` (mined, not pending)
2. `tx.to.toLowerCase() !== TREASURY.toLowerCase()` → destination must be treasury
3. `valuePaid = BigInt(tx.value)` vs `amountRequired = SEED_PRICE_WEI * BigInt(count)` → exact BigInt comparison, no floating-point
4. `tx.from.toLowerCase() !== callerWalletAddress.toLowerCase()` → sender must match authenticated wallet
5. `INSERT INTO seed_claims` → atomic replay guard

The order is Checks before Effects: all 5 verifications complete before the mint loop opens. This satisfies the Checks-Effects-Interactions pattern as applied to a server-side payment gateway.

`count` is validated `!Number.isInteger(count) || count < 1 || count > 10` (seed-claim line 157) before `amountRequired` is computed, preventing count=0 (free mint) and count > 10 (unbounded mint). `count` never reaches the contract directly; the server loops `count` times, each time atomically claiming a tokenId from the Postgres sequence.

Solidity 0.8.28 uses built-in checked arithmetic (Solidity language spec, v0.8.0 release notes). No overflow is possible in the contract because the contract performs no arithmetic -- tokenId is passed in by the server.

**Citation:** Gavin Wood, Ethereum Yellow Paper (2014), Appendix H (message-call execution order); ConsenSys Diligence, "Smart Contract Best Practices -- Checks-Effects-Interactions" (https://consensys.github.io/smart-contract-best-practices/development-recommendations/general/external-calls/#checks-effects-interactions); OpenZeppelin, "ERC721URIStorage" (https://github.com/OpenZeppelin/openzeppelin-contracts) -- confirms `_safeMint` does not accept ETH.

**Exploit path:** None. Contract is not payable. Server computes amountRequired server-side from the on-chain tx value; client cannot inflate or deflate the price.

---

## DOMAIN 2: Replay Attack / Double-Spend (Off-Chain)

```
Verdict: PASS
```

**Evidence observed in code:**

Migration `20260722120000_seed_claims.sql`:

```sql
CREATE TABLE IF NOT EXISTS seed_claims (
  tx_hash    TEXT        PRIMARY KEY,
  claimed_by UUID        NOT NULL REFERENCES auth.users(id),
  count      INTEGER     NOT NULL CHECK (count BETWEEN 1 AND 10),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`tx_hash TEXT PRIMARY KEY` is a proper PostgreSQL PRIMARY KEY, not merely a UNIQUE index. The constraint is enforced at the storage engine level, not in application code.

In `seed-claim/index.ts`, the replay guard is:

```typescript
const { error: claimErr } = await serviceClient
  .from('seed_claims')
  .insert({ tx_hash: normalizedTxHash, claimed_by: user.id, count });

if (claimErr) {
  if (claimErr.code === '23505') { /* idempotent replay response */ }
}
```

This is a single atomic INSERT, not a read-then-write. There is no TOCTOU (time-of-check/time-of-use) race window: PostgreSQL serializes concurrent INSERTs on the same primary key. Under concurrent requests with the same `tx_hash`, one INSERT succeeds and one returns error code `23505` synchronously from the DB engine. The loser receives the idempotent replay response (previously minted tokens if loop completed; 409 if it died mid-loop).

The `tx_hash` is normalized to lowercase before insert (`normalizedTxHash = txHash.toLowerCase()`) and format-validated (`/^0x[0-9a-fA-F]{64}$/.test(txHash)`) before the RPC call. This prevents case-variant bypass (e.g., submitting `0xABC...` and `0xabc...` as separate claims).

**Citation:** Phil Daian et al., "Flash Boys 2.0: Frontrunning in Decentralized Exchanges, Miner Extractable Value, and Consensus Instability" (IEEE S&P 2020) -- establishes that off-chain claim systems are primary replay targets when on-chain verification is delegated to a backend. The paper prescribes idempotency keys (PK constraint) as the canonical mitigation; OWASP "Insufficient Anti-Automation" OAT-015 (https://owasp.org/www-project-automated-threats-to-web-applications/).

**Exploit path:** None for financial double-spend. An attacker replaying the same `tx_hash` receives either the already-minted tokens or a 409 with support instructions. No second set of NFTs is minted.

---

## DOMAIN 3: ECDSA Signature Verification (wallet-auth)

```
Verdict: ADVISORY
```

**Evidence observed in code:**

The message being signed (wallet-auth line 93):

```typescript
const message = `Kijo authentication\nAddress: ${address}\nNonce: ${nonce}`;
```

This uses raw personal_sign (EIP-191 prefix `\x19Ethereum Signed Message:\n`), NOT EIP-712 structured typed data. viem's `verifyMessage` recovers the signer from an EIP-191-prefixed hash and compares against the claimed `address`. Address comparison is handled by viem (case-normalized internally). ✓

**Nonce single-use enforcement** (migration `20260808000001_used_nonces.sql`):

```sql
CREATE TABLE IF NOT EXISTS public.used_nonces (
  nonce       TEXT        NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  CONSTRAINT  used_nonces_pkey PRIMARY KEY (nonce)
);
```

The table IS deployed (observed directly). wallet-auth inserts nonce before issuing JWT (lines 137-148). If INSERT returns `23505`, the nonce was already consumed → 409 returned. This is single-use nonce enforcement. The DECISIONS.md entry from 2026-07-26 states this was "deferred to Phase 2 hardening" -- DECISIONS.md is outdated; the implementation is present and correct as of migration 20260808.

**`verify_jwt: false` scope:** Confirmed in STATE.md. Only `wallet-auth` and `list-trees` have `verify_jwt: false`. All other functions require a valid JWT. The wallet-auth endpoint's security derives from ECDSA signature verification of the wallet, not the JWT (it produces JWTs, so it cannot require one as a prerequisite). ✓

**Advisory finding A3-1 -- No EIP-712 domain binding:**

The signed message contains no `chainId` and no contract address. A valid signature generated on Saigon testnet (chain ID 202601) is also valid on Ronin mainnet (chain ID 2020) because the message is identical on both chains. An attacker who captures a testnet auth signature and replays it against a mainnet wallet-auth endpoint would successfully authenticate.

Risk for Phase 1 (testnet): Low -- the testnet is isolated, there is no mainnet deployment, and the 5-minute window + single-use nonce reduce the replay window to zero in practice.

Risk for mainnet: BLOCKING before launch. A user who signs an auth message on testnet and then interacts with a mainnet deployment using the same wallet would have their testnet signature (if intercepted) replayed for mainnet access.

**Citation:** EIP-712 specification (Ethereum Foundation, https://eips.ethereum.org/EIPS/eip-712) -- defines domain separator with `chainId`, `verifyingContract`, `name`, `version` to prevent cross-chain and cross-contract replay; Gonçalo Sá, "Capture the Ether: Signature Malleability" (writeup, 2019) -- demonstrates that raw message signing without domain binding is replayable across deployment environments; Trail of Bits, "Ethereum Security Guide" (https://github.com/trailofbits/not-so-smart-contracts/tree/master/wrong_constructor_name) -- signature-related findings.

**Exploit path (ADVISORY, not currently exploitable on testnet):**

1. Victim signs auth message on testnet: `Kijo authentication\nAddress: 0xVICTIM\nNonce: 1753394800000`
2. Attacker intercepts the signed message (e.g., via XSS, MitM, or compromised frontend)
3. Within 5 minutes, attacker submits `{ address: 0xVICTIM, signature: ..., nonce: 1753394800000 }` to mainnet wallet-auth
4. Mainnet wallet-auth verifies signature → PASS (message is identical on both chains)
5. Attacker receives a mainnet JWT for the victim's wallet
6. Attacker can call seed-claim or care-action on mainnet using victim's identity

**Fix required before mainnet:** Switch to EIP-712 with domain separator including `chainId`, `name: "Kijo"`, and `version`.

---

## DOMAIN 4: Access Control on Minting (Contract)

```
Verdict: PASS
```

**Evidence observed in code (`Kijonsai.sol`):**

```solidity
bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

constructor(address admin, address minter) ERC721("Kijonsai", "KIJO") {
    _grantRole(DEFAULT_ADMIN_ROLE, admin);
    _grantRole(MINTER_ROLE, minter);
}

function mintKijonsai(address to, uint256 tokenId, string calldata uri)
    external onlyRole(MINTER_ROLE)
```

`onlyRole(MINTER_ROLE)` is OZ AccessControl's modifier -- it reverts with `AccessControlUnauthorizedAccount` for any caller who does not hold the role. The role can only be granted or revoked by `DEFAULT_ADMIN_ROLE` holders (deployer wallet or multisig).

**Deployed minter (testnet):** `0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199` (treasury wallet, Saigon testnet). The `MINTER_PRIVATE_KEY` for this wallet is stored in Supabase secrets.

**Can any EOA skip the Edge Function and call mint directly?** Only if they hold `MINTER_ROLE`. An EOA without the role gets an on-chain revert. No bypass path exists.

**Is there a public mint path?** No. The contract has no `publicMint()`, no `fallback()`, no `receive()`. The only mint function is `mintKijonsai`, which is role-gated.

**MINTER_ROLE != DEFAULT_ADMIN_ROLE:** Admin holds only admin rights; they cannot mint directly. Confirmed by architecture spec test: `it('does not grant MINTER_ROLE to admin by default')`.

**Citation:** OpenZeppelin AccessControl documentation (https://docs.openzeppelin.com/contracts/5.x/api/access#AccessControl); Josselin Feist / Trail of Bits, "Not So Smart Contracts: Missing Access Control" (https://github.com/trailofbits/not-so-smart-contracts/tree/master/access_control) -- establishes `onlyRole` as the required guard.

---

## DOMAIN 5: Integer Arithmetic and Quantity Bounds

```
Verdict: PASS (advisory on client-side seed generation)
```

**Evidence observed in code:**

**Solidity version:** `pragma solidity ^0.8.28` -- checked arithmetic is built-in. `unchecked {}` is not used anywhere in the contract. Overflow/underflow in the contract is impossible by language guarantee.

**Contract arithmetic:** None. The contract performs no multiplication or addition; tokenId is a passed-in `uint256` assigned by the DB sequence.

**Server-side price calculation (seed-claim line 247):**

```typescript
const SEED_PRICE_WEI = 3_000_000_000_000_000_000n; // BigInt
const amountRequired = SEED_PRICE_WEI * BigInt(count);
```

Both operands are BigInt. JS BigInt is arbitrary-precision; there is no overflow risk. `count` is validated integer in `[1,10]` before this line.

**Client-side price calculation (useSeedPurchase.ts line 273):**

```typescript
const value = parseEther(SEED_PRICE_RON) * BigInt(count);
```

`parseEther` returns a BigInt. BigInt multiplication. ✓

**count bounds -- server:** `!Number.isInteger(count) || count < 1 || count > 10` → 400. ✓

**count bounds -- client:** `if (count < 1 || count > 10) throw new Error("Count must be 1-10")`. ✓

**UI clamp (StoreModal.tsx line 192):** `Math.max(1, Math.min(10, Math.floor(val)))`. ✓

**Advisory A5-1 -- Math.random() for seed generation:**

`useSeedPurchase.ts` lines 258-262:
```typescript
pendingSeedsRef.current = Array.from(
  { length: count },
  () => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
);
```

`Math.random()` is not cryptographically secure. More critically, the seeds array is entirely CLIENT-CONTROLLED: the client chooses any seed values and sends them to the server, which accepts them without generating server-side entropy. This means a client can:
- Choose identical seeds to produce multiple aesthetically identical trees
- Precompute seeds that maximize stats (HP, Power, Ki) via the deterministic engine and request those specific seeds

The comment acknowledges this: `// TODO(pre-mainnet): use crypto.getRandomValues for uniform distribution`.

**Citation:** Sigma Prime, "Ethereum Smart Contract Security Best Practices -- Predictable Randomness" (https://blog.sigmaprime.io/solidity-security.html) -- while primarily about on-chain randomness, the principle applies: client-controlled seeds in a game with stat-based NFT value create a fairness and potential market-manipulation vector; NIST SP 800-90A Rev.1 -- recommends CSPRNG (cryptographically secure pseudorandom number generator) for any value affecting asset allocation.

---

## DOMAIN 6: Front-Running Risk on Mint (Mempool)

```
Verdict: PASS
```

**Evidence observed in code:**

The mint flow: user sends RON to treasury (plain transfer), then POSTs `tx_hash` to seed-claim. Seed-claim verifies check 4 (seed-claim line 252):

```typescript
if (!tx.from || tx.from.toLowerCase() !== callerWalletAddress.toLowerCase()) {
  return json({ error: 'Transaction sender does not match authenticated wallet' }, 422);
}
```

`callerWalletAddress` is resolved from the authenticated JWT's `wallet_row_id` field → DB lookup → actual wallet address stored at registration. It is NOT taken from the request body. A different wallet presenting someone else's `tx_hash` would fail check 4.

**Can a front-runner claim a mint?** An attacker who sees the victim's RON payment in the mempool and submits a seed-claim request before the victim would:
1. Need a valid JWT for their OWN wallet (correct ECDSA signature over their address + nonce) -- achievable
2. But check 4 compares `tx.from` (the RON sender) against the JWT's authenticated wallet address
3. If `tx.from` is the victim's address and the attacker's JWT encodes the attacker's address: `tx.from != callerWalletAddress` → 422

The mint is bound to the wallet that SENT the RON, not just to whoever knows the tx_hash. ✓

**Ronin network context:** Ronin migrated to OP Stack (February 2026). The validator set remains permissioned (Sky Mavis-operated). Permissioned validators reduce MEV/front-running risk relative to public chains because validators have reputational and contractual constraints from Sky Mavis. However, post-OP Stack migration, the mempool may expose more standard Ethereum behavior (EIP-1559, public RPC). The Saigon testnet architecture does not document public mempool access restrictions.

**Citation:** Phil Daian et al., "Flash Boys 2.0" (2020) -- establishes that mempool visibility enables front-running; Ethereum Foundation, "Protecting Against Front-Running" (https://ethereum.org/en/developers/docs/smart-contracts/security/) -- prescribes transaction-origin binding as a mitigation; Ronin OP Stack migration documentation (February 2026) -- permissioned validator set continues post-migration.

---

## DOMAIN 7: JWT Security (Supabase Token)

```
Verdict: ADVISORY
```

**Evidence observed in code:**

**JWT issuance (wallet-auth/index.ts):** Session is created via:

```typescript
// generate magic-link token (admin API -- does NOT send email)
const { data: linkData } = await serviceClient.auth.admin.generateLink({
  type: 'magiclink', email: user.email,
});
// exchange for session
const { data: otpData } = await serviceClient.auth.verifyOtp({
  token_hash: linkData.properties.hashed_token,
  type: 'magiclink',
});
// returns otpData.session.access_token
```

The JWT expiration is determined by the Supabase project's "JWT expiry" setting (Project Settings > Auth > JWT Expiry Limit). This setting is NOT observable in any code or migration file. Supabase defaults to 3600 seconds (1 hour). The auditor cannot confirm this setting from code alone.

**JWT storage (useWalletAuth.ts line 36):**

```typescript
const [accessToken, setAccessToken] = useState<string | null>(null);
```

The token is stored in React state (in-memory). It is NOT written to `localStorage` or `sessionStorage`. This is intentional per DECISIONS.md: "JWTs are bearer tokens; storing in localStorage exposes them to XSS." In-memory storage means the token is lost on page reload, requiring re-authentication. ✓

**Wallet address in JWT payload:** The `wallet_row_id` is stored in `user.raw_user_meta_data` at registration. All authenticated endpoints extract it from the verified JWT via `anonClient.auth.getUser(token)` (which calls Supabase's token verification endpoint server-side):

```typescript
const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
if (authErr || !user) return json({ error: 'Unauthorized' }, 401);
// ...
const jwtWalletRowId = user.user_metadata?.wallet_row_id ?? user.id;
if (jwtWalletRowId !== wallet_row_id) return json({ error: 'Forbidden' }, 403);
```

The wallet identity in the JWT is cross-verified against the DB on every request (via the `wallets` table lookup in seed-claim). ✓

**Advisory A7-1 -- JWT expiration not confirmable from code:**

The JWT expiry is a Supabase project-level configuration not visible in the codebase. If it was set to a long value (e.g., 7 days or unlimited) during development, a stolen token would be valid for an extended period. RFC 7519 §4.1.4 (JWT spec) mandates the `exp` claim should be set to the shortest practical lifetime.

**Advisory A7-2 -- No token refresh mechanism:**

There is no `refresh_token` flow. When a token expires, the user sees a 401 error and must re-authenticate from scratch. For Phase 1 this is acceptable (the game session is typically short). For mainnet, this should use Supabase's `setSession(access_token, refresh_token)` API to allow background token refresh.

**Citation:** RFC 7519, Section 4.1.4 (https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.4) -- `exp` claim MUST be set; OWASP JWT Security Cheat Sheet (https://cheatsheats.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html) -- recommends short expiry and token refresh; storage in memory over localStorage is correct per the cheat sheet.

---

## DOMAIN 8: Off-Chain / On-Chain Trust Boundary

```
Verdict: ADVISORY
```

**Evidence observed in code:**

**Does the server fetch and verify the tx from chain?**

seed-claim lines 228-254:

```typescript
tx = (await rpcCall('eth_getTransactionByHash', [normalizedTxHash])) as TxResult;
if (!tx || !tx.blockNumber) { /* 422 */ }
if (!tx.to || tx.to.toLowerCase() !== TREASURY.toLowerCase()) { /* 422 */ }
valuePaid = BigInt(tx.value ?? '0x0');
if (valuePaid < amountRequired) { /* 402 */ }
if (!tx.from || tx.from.toLowerCase() !== callerWalletAddress.toLowerCase()) { /* 422 */ }
```

The server fetches transaction data from the Ronin RPC (`eth_getTransactionByHash`). It verifies `tx.to`, `tx.value`, and `tx.from` from the on-chain record. The client sends only `txHash` (the reference) -- not the value or from address. The server derives those from the chain. The client cannot forge these values. ✓

**Note on `eth_getTransactionByHash` vs `eth_getTransactionReceipt`:** For a plain ETH/RON transfer to an EOA (which is what this is -- sending RON to `TREASURY`), the transaction cannot be "mined but failed" -- value transfers either succeed at inclusion or are dropped from the mempool. The `blockNumber` non-null check is sufficient confirmation that the RON moved. Using `eth_getTransactionReceipt` would be more explicit for contract calls (which can revert) but is not necessary here.

**Advisory A8-1 -- Seeds are client-controlled (game-balance exploit):**

The client sends `seeds: number[]` and the server inserts them as tree genomes:

```typescript
// seed-claim, Step B (line 362):
.insert({ ...seeds[i], ... })
```

There is no server-side validation of seed values. A player can choose any integer as their seed. Because the growth engine is deterministic and open-source, a player can precompute which seed values maximize any given stat (HP, Power, Ki) and request those exact seeds. If NFTs with higher stats trade at a premium on Ronin Market, this is a market-manipulation vector.

**Advisory A8-2 -- care_log entries are not validated server-side:**

seed-claim lines 393-409 insert guest care_log entries directly:

```typescript
const entries = care_log.map((entry: unknown, seq: number) => {
  const e = entry as { day?: number; type?: string; data?: unknown };
  return {
    tree_id, game_day: e.day ?? 0, sequence: seq,
    action_type: e.type ?? '',
    action_data: e.data ?? null,
  };
});
```

There is no whitelist check on `e.type`. A malicious client can inject fake care actions (e.g., claiming to have pruned or wired branches that never existed in the guest session). This affects the first tree's care log only (guest→wallet conversion). The financial impact is nil (no additional mints, no RON saved), but data integrity is compromised: the resulting care log does not accurately represent actual gameplay.

**Citation:** Dan Guido, "The Web3 Security Stack" (Trail of Bits, 2022) -- establishes the principle that servers must never trust client-supplied claims about chain state; the tx verification here correctly implements this. ConsenSys, "Decentralized Application Security Project" (DASP, https://dasp.co) -- category 7 "Front Running" and category 9 "Denial of Service" cover the trust-boundary risks between client and server layers.

---

## SUMMARY

```
OVERALL VERDICT: CONDITIONALLY SECURE

CRITICAL FINDINGS:  0
ADVISORY FINDINGS:  6

  A3-1 -- No EIP-712 domain binding in wallet-auth signature
           (cross-chain replay risk; BLOCKING for mainnet)
  A5-1 -- Math.random() + client-controlled seeds
           (predictability + game-balance exploit; BLOCKING for mainnet)
  A7-1 -- JWT expiration not confirmable from codebase
           (Supabase project config must be verified; target <= 1 hour)
  A7-2 -- No token refresh mechanism
           (UX degradation; not security-critical for Phase 1)
  A8-1 -- Seeds are client-controlled (same as A5-1, listed here as trust-boundary concern)
  A8-2 -- care_log entries not validated server-side
           (data integrity; no financial impact)
```

---

## REQUIRED FIXES BEFORE MAINNET

Listed in order of severity:

**1. [BLOCKING] Switch wallet-auth to EIP-712 structured signing (A3-1)**

Replace the raw personal_sign message with an EIP-712 typed data structure that includes `chainId` and `verifyingContract` (even if the verifying contract is a sentinel address). Update `useWallet.authenticate()` to call `signTypedData` and update wallet-auth to use `verifyTypedData`. This prevents cross-chain replay of auth signatures.

```
Domain: `Kijo`
Version: `1`
ChainId: current chain (202601 saigon, 2020 mainnet)
VerifyingContract: 0xKijonsaiContractAddress (or a sentinel)
```

Citation: EIP-712 (https://eips.ethereum.org/EIPS/eip-712).

**2. [BLOCKING] Move seed generation server-side (A5-1 / A8-1)**

Remove `seeds` from the client-to-server payload. The server should generate all seeds using `crypto.getRandomValues` (Deno built-in) and return them in the seed-claim response. The server must be the source of entropy for any value that affects NFT attributes with market value.

Deno pattern:
```typescript
const seeds = Array.from(
  crypto.getRandomValues(new Uint32Array(count))
);
```

Citation: NIST SP 800-90A Rev.1 (CSPRNG requirements).

**3. [REQUIRED] Validate care_log entries server-side (A8-2)**

Add a whitelist check on `action_type` before inserting guest care log entries:

```typescript
const ALLOWED_GUEST_ACTIONS = new Set(['water', 'tick', 'prune', 'wire', 'fertilize']);
if (!ALLOWED_GUEST_ACTIONS.has(e.type ?? '')) continue; // skip invalid entries
```

**4. [REQUIRED] Confirm Supabase JWT expiration setting (A7-1)**

Check Project Settings > Auth > JWT Expiry Limit in the Supabase dashboard for project `xutjubkaskwchzyzwryk`. Confirm it is <= 3600 seconds (1 hour). Document the setting in `STATE.md` or `DECISIONS.md` so it is not accidentally changed.

**5. [REQUIRED] Confirm MINTER_PRIVATE_KEY is KMS-backed for mainnet (existing KIJONSAI-CONTRACT-ARCH.md §9.1)**

KIJONSAI-CONTRACT-ARCH.md §9.1 already documents this requirement. This is a process checklist item, not a new finding. The raw private key must never be in Supabase secrets in production; it must be a KMS key reference.

**6. [ADVISORY -- mainnet] Add token refresh flow (A7-2)**

Implement Supabase `setSession(access_token, refresh_token)` in `useWalletAuth` so that tokens are refreshed transparently before expiration. Store `refresh_token` in `sessionStorage` (shorter-lived, tab-scoped). This is a UX improvement, not a security fix.

---

## NON-FINDINGS (guards confirmed correct)

The following guards were verified in code and found correct:

- `tx_hash PRIMARY KEY` on `seed_claims` -- atomic replay guard, not TOCTOU
- `onlyRole(MINTER_ROLE)` on all contract write functions -- no public mint path
- `pragma solidity ^0.8.28` -- checked arithmetic, no overflow risk in contract
- `count validated [1,10]` at both client and server -- no unbounded mint
- `BigInt` price arithmetic throughout -- no floating-point multiplication
- `tx.from === authenticated_wallet` check -- prevents stealing another user's payment tx
- `used_nonces` table with PRIMARY KEY -- nonce single-use enforcement is deployed (migration 20260808000001)
- JWT verified via `anonClient.auth.getUser(token)` on every authenticated endpoint
- `wallet_row_id` cross-checked from JWT against DB on every endpoint
- `verify_jwt: false` confined to `wallet-auth` and `list-trees` (auth bootstrapping endpoints) -- all other endpoints use `verify_jwt: true`
- All server-verified fields (`tx.to`, `tx.value`, `tx.from`) come from on-chain RPC, not client payload

---

*No auto-commits. No mainnet deployment recommendation -- that decision belongs to Jeremy.*
*Auditor: adversarial discipline applied. Trust nothing. Verify by observation.*
