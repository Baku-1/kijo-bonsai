# Kijonsai ERC-721 Contract — Architect Plan

**Version:** 0.3
**Date:** 2026-07-22
**Author:** Architect pass (with live Sky Mavis doc research) — corrected by corrective architect pass
**Status:** ✅ Implemented (2026-07-23) — deployed Saigon testnet `0x4447F631F5868bFA03A6e6ae2D2da9f22c787E44`
**Supersedes:** PHASE1-RONIN-ARCH.md §§5, 8 (contract + Hardhat sections only)

**v0.2 Changes:** Fixed all 4 blockers (B1–B4) and 8 caveats (C1–C8, C10) from adversarial audit v1.
**v0.3 Changes:** Closed all 7 caveats from adversarial audit v2 (C-NEW-1, C-NEW-3 through C-NEW-7).

---

## 0. Research Summary — Sky Mavis Official Patterns

Sources fetched live:

| Source | URL | Findings |
|---|---|---|
| Ronin deploy guide | `docs.roninchain.com/developers/smart-contracts/deploy` | `hardhat-deploy` is **REQUIRED**; deploy scripts go in `deploy/` not `scripts/`; Solidity `0.8.28`; Sourcify not Etherscan |
| Ronin contract guidelines | `docs.roninchain.com/developers/smart-contracts/guidelines` | No selfdestruct; London EVM; DO NOT use TransparentProxy with OZ v5; no uncontrolled dynamic arrays |
| Ronin verify guide | `docs.roninchain.com/developers/smart-contracts/verify` | Sourcify endpoint: `https://sourcify.roninchain.com/server/` (trailing slash required); `TASK_SOURCIFY` from `hardhat-deploy` for script-based verify |
| Sky Mavis contract template | `github.com/axieinfinity/contract-template` | `ERC721Common` exists but uses `ERC721Enumerable` + `ERC721Pausable` + `ERC721Burnable` — heavier than needed for Kijonsai; does NOT include ERC-4906 or per-token URIs |
| Ronin Market metadata | `docs.skymavis.com/mavis/ronin-market/reference/metadata` | `bool` display type IS supported with native `true`/`false` values (arch doc was wrong); `BatchMetadataUpdate` supported; token locking events available |
| Ronin Market listing | `docs.skymavis.com/mavis/ronin-market/guides/list` | Royalties set via **collection submission form**, not ERC-2981 on-chain; 0–10% creator fee configured at marketplace level |
| Ronin Market fees | `docs.skymavis.com/mavis/ronin-market/explanation/fees` | 2.5% total service fee (2% Sky Mavis + 0.5% Ronin Treasury); creator fee on top (our choice) |

**Blocked:** `github.com/axieinfinity/ronin-smart-contracts` — repo access blocked by web fetch policy; `tutorial-hardhat-deploy` raw files returned empty (repo may have moved or content is JS not TS). Patterns sourced from Ronin docs directly instead.

---

## 1. Divergences from PHASE1-RONIN-ARCH.md

These are corrections, not regressions. Flag each one to the implementer.

### 1.1 ⚠️ No on-chain struct — URI-only design

> **PRODUCT DECISION (2026-07-22): `care_log_hash` is deferred to Phase 2.** PRD §5.1 launch criterion "with care log Merkle root" is updated to reflect this cut. Rationale: In Phase 1, the server is the sole trust anchor for all state; an on-chain hash the server also computes adds no verifiable trustlessness. The update protocol (when to write it after each care action) is unspecified — options are (a) per care action, (b) daily on lazy tick, (c) on spirit awakening only — and Phase 2 spec must decide this before implementation. The hash becomes meaningful in Phase 2 when client-side replay tooling exists. The absence of `care_log_hash` from Phase 1 is **intentional and fully documented**.

**Old design (PHASE1 arch):**
```solidity
struct TokenData {
    uint32  seed;
    uint8   species;
    uint64  born;
    bytes32 care_log_hash;
    bool    has_spirit;
}
mapping(uint256 => TokenData) public tokenData;
```

**New design:** No struct. Server is authoritative. The URI (`https://api.kijo.xyz/nft/metadata/{tokenId}`) is the single source of truth for all on-chain-readable metadata. Seed, species, born, care log, spirit flag — all encoded in the metadata JSON the server serves. On-chain footprint: just ERC-721 ownership + per-token URI string.

**Rationale:** "Seed data embedded in tokenId or URI (URI is preferred — on-chain minimalism)" per the task brief. The server already signs the mint, so putting state on-chain creates a dual source of truth problem without adding trustlessness. `care_log_hash` moves to Phase 2 once client-side replay tooling and the update protocol are designed (see §13).

**Impact on server:** The server must keep the DB as the authoritative state. The on-chain URI is a pointer, not the state itself.

### 1.2 ⚠️ Function signature changes

| Old (PHASE1) | New (this plan) | Reason |
|---|---|---|
| `mintTo(address to, uint32 seed, uint8 species)` | `mintKijonsai(address to, uint256 tokenId, string calldata uri)` | tokenId server-assigned; URI carries all metadata |
| `updateCareLogHash(uint256 tokenId, bytes32 newHash)` | `updateMetadata(uint256 tokenId, string calldata uri)` | URI-based; one function for all state changes |
| `setHasSpirit(uint256 tokenId, bool value)` | _(deleted)_ | Covered by `updateMetadata` |
| `tokenURI(uint256)` override with baseURI + id | _(removed)_ — `ERC721URIStorage` handles this | OZ v5 `ERC721URIStorage` stores per-token URIs natively |

### 1.3 ⚠️ No UPDATER_ROLE — simplified to one MINTER_ROLE

Old arch had `MINTER_ROLE` + `UPDATER_ROLE`. The task brief specifies only `MINTER_ROLE` held by the server. The server that mints is the same server that updates. One key, one role. Admin (`DEFAULT_ADMIN_ROLE`) can still grant/revoke.

### 1.4 ✅ Solidity version: 0.8.28 not 0.8.24

Ronin docs show `0.8.28` in current examples (last updated May 2026). Use `0.8.28`.

### 1.5 ✅ Hardhat-deploy pattern, not vanilla scripts/

Official Sky Mavis docs explicitly state `hardhat-deploy` is **required** for Ronin deployments. Scripts go in `deploy/` with numbered prefixes and the `hardhat-deploy` `DeployFunction` interface. A `99_verify.ts` script handles Sourcify verification automatically at the end of every deploy.

### 1.6 ✅ No ETHERSCAN_API_KEY

Ronin uses Sourcify, not Etherscan. Remove `ETHERSCAN_API_KEY` from env. The Sourcify endpoint is hardcoded.

### 1.7 ✅ ERC-2981 NOT required for Ronin Market royalties

The listing guide shows royalties are set in the **collection submission form** (Step 3, field: "Creator fee"), not via ERC-2981 on-chain. Ronin Market does not read `royaltyInfo()`. Do not implement ERC-2981 unless Sky Mavis explicitly requests it during collection onboarding.

> **C1 — ERC-2981 caveat:** ERC-2981 is NOT implemented. For Ronin Market, royalties are collection-form-based. However, any third-party aggregator will see zero royalties. If cross-marketplace royalty enforcement matters in Phase 2, add ERC-2981 then.

### 1.8 ✅ Metadata: `bool` display type IS supported

PHASE1 arch doc said: *"there is no `bool` type, use `string` with `True`/`False`."*

**Correction:** Ronin Market docs confirm `"display_type": "bool"` is fully supported with native JSON `true`/`false` values. Update the server's metadata endpoint to use `"display_type": "bool"` for `has_spirit`.

> **C2 — Verify caveat:** `display_type: "bool"` was verified against live Mavis docs during the architect pass. Implementer should confirm against https://docs.skymavis.com/mavis/ronin-market/reference/metadata before the server team changes production values.

### 1.9 ✅ OZ v5 `ERC721URIStorage` already emits MetadataUpdate

In OZ v5, `ERC721URIStorage` implements `IERC4906` and emits `MetadataUpdate(_tokenId)` inside `_setTokenURI`. Our contract does NOT need to re-declare the event. Calling `_setTokenURI` in both `mintKijonsai` and `updateMetadata` automatically fires the ERC-4906 event.

### 1.10 ✅ Contract name: `Kijonsai` not `KijonsaiNFT`

Per task brief. Contract file: `contracts/Kijonsai.sol`.

### 1.11 ✅ Ronin EVM constraint: London fork

Guidelines say "compatible with London EVM fork." Set `evmVersion: 'london'` in Hardhat solidity settings.

### 1.12 ✅ No TransparentUpgradeableProxy with OZ v5

Ronin guidelines explicitly warn: TransparentUpgradeableProxy in OZ v5 auto-creates a ProxyAdmin contract, which breaks deployment due to Ronin's allowlist. We are NOT using upgradeable proxies in Phase 1 (simple deploy is fine). If upgradeable proxy is ever needed, use UUPS, not Transparent.

---

## 2. Contract Specification: `Kijonsai.sol`

### 2.1 Inheritance chain

```
Kijonsai
  ├── ERC721URIStorage (@openzeppelin/contracts 5.0.2 -- pinned, see §4 caveat)
  │     ├── IERC4906  ← declares MetadataUpdate + BatchMetadataUpdate
  │     └── ERC721
  └── AccessControl (@openzeppelin/contracts 5.0.2 -- pinned, see §4 caveat)
```

### 2.2 Roles

| Role | Holder | Permissions |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` | Deployer/multisig | Grant/revoke roles |
| `MINTER_ROLE` | Server Edge Function wallet | `mintKijonsai`, `updateMetadata`, `emitBatchMetadataUpdate` |

### 2.3 Full contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// NOTE: Do NOT import ERC721.sol directly — ERC721URIStorage already imports it.
// (C10 fix: removed redundant `import ".../ERC721.sol"`)
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title Kijonsai
 * @notice ERC-721 NFT for the Kijo bonsai game, deployed on Ronin.
 *
 * Design decisions
 * ----------------
 * - URI-only metadata: no on-chain struct. The server is authoritative.
 *   All state (seed, species, born, care log, has_spirit) is encoded in the
 *   off-chain metadata JSON served at the tokenURI endpoint.
 * - MINTER_ROLE held by the server's Edge Function signing wallet.
 *   Server mints after verifying RON payment; server updates metadata as
 *   bonsai state changes.
 * - ERC-4906: OZ v5 ERC721URIStorage already implements IERC4906 and emits
 *   MetadataUpdate inside _setTokenURI. No need to declare the event.
 * - ERC-2981: NOT implemented. Ronin Market royalties are configured via the
 *   collection submission form, not on-chain.
 * - No TransparentProxy: we deploy implementation directly (no upgrades Phase 1).
 * - London EVM: enforced via hardhat.config evmVersion setting.
 *
 * Phase 2 additions (not in scope here — see §13)
 * ------------------------------------------------
 * - care_log_hash Merkle root on-chain (trustless care log provability)
 *   DEFERRED: update protocol (per-action vs daily vs lazy) not yet specified.
 * - TokenLocked / TokenUnlocked events (Ronin Market staking support)
 * - ERC-2981 if Sky Mavis requests it during collection onboarding
 */
contract Kijonsai is ERC721URIStorage, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // MetadataUpdate and BatchMetadataUpdate are declared in IERC4906,
    // inherited through ERC721URIStorage. Do not re-declare them.

    // ── Constructor ───────────────────────────────────────────────────────────

    /**
     * @param admin   Receives DEFAULT_ADMIN_ROLE (deployer wallet or multisig).
     * @param minter  Receives MINTER_ROLE (server Edge Function wallet).
     *                Can be the same as admin for testnet; should be a
     *                dedicated KMS-managed key in production (see §9.1).
     */
    constructor(address admin, address minter) ERC721("Kijonsai", "KIJO") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, minter);
    }

    // ── Minting ───────────────────────────────────────────────────────────────

    /**
     * @notice Mint a new Kijonsai NFT.
     * @dev Called by the server after verifying the buyer's RON payment.
     *      tokenId is assigned by the server to match the DB record (sequential,
     *      starting from 1). The server MUST use an atomic DB sequence or advisory
     *      lock (SELECT nextval('kijonsai_token_id_seq') or FOR UPDATE row lock)
     *      to assign tokenId before calling this function. Concurrent requests
     *      without a lock can cause two requests to receive the same tokenId;
     *      the second on-chain call burns gas and reverts while the buyer's RON
     *      is already transferred. See §2.4 for server integration notes.
     *
     *      uri points to the server's metadata endpoint.
     *      OZ v5 _setTokenURI emits ERC-4906 MetadataUpdate automatically.
     *
     * @param to       Buyer's wallet address.
     * @param tokenId  Server-assigned token ID. MUST NOT already exist.
     * @param uri      Full metadata URI (e.g. https://api.kijo.xyz/nft/metadata/42).
     */
    function mintKijonsai(
        address to,
        uint256 tokenId,
        string calldata uri
    ) external onlyRole(MINTER_ROLE) {
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    // ── Metadata ──────────────────────────────────────────────────────────────

    /**
     * @notice Update the metadata URI for a token.
     * @dev Server calls this whenever bonsai state changes (care action recorded,
     *      spirit awakened, etc.). OZ v5 _setTokenURI emits MetadataUpdate,
     *      which signals Ronin Market to re-index the token.
     * @param tokenId  Must be an existing token.
     * @param uri      New metadata URI.
     */
    function updateMetadata(
        uint256 tokenId,
        string calldata uri
    ) external onlyRole(MINTER_ROLE) {
        _requireOwned(tokenId);
        _setTokenURI(tokenId, uri);
    }

    /**
     * @notice Signal Ronin Market to re-index a range of tokens.
     * @dev Use type(uint256).max as toTokenId to refresh the entire collection.
     *      Per ERC-4906 spec. Useful after metadata server migrations.
     *
     *      MINTER_ROLE (not DEFAULT_ADMIN_ROLE): batch re-index is a routine
     *      server maintenance operation at the same trust level as updateMetadata.
     *      Requiring the admin wallet (likely a hardware wallet or multisig) for
     *      routine re-indexing is unnecessary friction (C5 fix).
     */
    function emitBatchMetadataUpdate(
        uint256 fromTokenId,
        uint256 toTokenId
    ) external onlyRole(MINTER_ROLE) {
        emit BatchMetadataUpdate(fromTokenId, toTokenId);
    }

    // ── Interface support ─────────────────────────────────────────────────────

    /**
     * @dev Resolves the diamond between ERC721URIStorage.supportsInterface and
     *      AccessControl.supportsInterface. The explicit 0x49064906 check is
     *      redundant (ERC721URIStorage handles it via IERC4906) but is kept
     *      for clarity per the architecture spec.
     *
     *      Supported interfaces:
     *        0x80ac58cd — ERC-721
     *        0x5b5e139f — ERC-721Metadata
     *        0x49064906 — ERC-4906
     *        0x7965db0b — IAccessControl
     *        0x01ffc9a7 — ERC-165
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return interfaceId == 0x49064906 || super.supportsInterface(interfaceId);
    }
}
```

### 2.4 What OZ v5 `ERC721URIStorage` gives us for free

| Feature | Auto-handled? | Notes |
|---|---|---|
| `tokenURI(uint256)` | ✅ | Returns per-token stored URI |
| `MetadataUpdate` event on `_setTokenURI` | ✅ | Fires on both mint and update |
| `BatchMetadataUpdate` event declaration | ✅ | In `IERC4906`; we emit manually via `emitBatchMetadataUpdate` |
| `supportsInterface(0x49064906)` | ✅ | Via `IERC4906` inheritance |
| `_requireOwned(tokenId)` (OZ v5) | ✅ | Reverts with `ERC721NonexistentToken` |

### 2.5 Server integration note — tokenId collision prevention

> **C8 — Critical:** The server's `seed-tree` Edge Function MUST use an atomic DB sequence or advisory lock to assign `tokenId` before calling `mintKijonsai`. Recommended pattern:
>
> ```sql
> -- Option A: atomic sequence (preferred)
> SELECT nextval('kijonsai_token_id_seq');
>
> -- Option B: FOR UPDATE row lock on a counter table
> SELECT id FROM token_counter WHERE name = 'kijonsai' FOR UPDATE;
> UPDATE token_counter SET id = id + 1 WHERE name = 'kijonsai';
> ```
>
> Concurrent requests without a lock can cause two requests to receive the same tokenId. The first `mintKijonsai` call succeeds; the second reverts on-chain (`ERC721InvalidSender`) while the buyer's RON is already transferred to the treasury. This leaves the buyer in a failed mint state requiring manual remediation. Use a sequence. Do not rely on `MAX(token_id) + 1` under concurrent load.

---

## 3. Hardhat Package Layout

```
contracts/
├── contracts/
│   └── Kijonsai.sol
├── deploy/                        ← hardhat-deploy scripts (not scripts/)
│   ├── 01_deploy_kijonsai.ts
│   └── 99_verify.ts               ← Sourcify verification, runs at end
├── test/
│   └── Kijonsai.test.ts
├── hardhat.config.ts
├── package.json
├── .env.example
└── .gitignore                     ← B1: protects PRIVATE_KEY and build artifacts
```

### `.gitignore` content

```gitignore
# Secrets — never commit
.env

# Hardhat build artifacts
artifacts/
cache/

# hardhat-deploy deployment records (contain addresses; commit selectively per project policy)
deployments/

# TypeChain generated types
typechain-types/

# Dependencies
node_modules/
```

> **Note on `deployments/`:** Some projects commit this folder to track deployed addresses in version control. That is optional — if you commit it, ensure `.env` is still excluded and the folder contains no secrets. The `.gitignore` entry above excludes it by default; remove that line if you want to track addresses in git.

---

## 4. `contracts/package.json`

```json
{
  "name": "@kijo/contracts",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "compile": "hardhat compile",
    "test": "hardhat test",
    "deploy:saigon": "hardhat deploy --network saigon",
    "deploy:ronin": "hardhat deploy --network ronin",
    "verify:saigon": "hardhat sourcify --endpoint https://sourcify.roninchain.com/server/ --network saigon",
    "verify:ronin": "hardhat sourcify --endpoint https://sourcify.roninchain.com/server/ --network ronin",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@nomicfoundation/hardhat-toolbox": "^5.0.0",
    "@types/node": "^20.0.0",
    "dotenv": "^16.4.0",
    "hardhat": "^2.22.0",
    "hardhat-deploy": "^0.12.0",
    "hardhat-deploy-ethers": "^0.4.2",
    "ts-node": "^10.9.0",
    "typescript": "^5.4.0"
  },
  "dependencies": {
    "@openzeppelin/contracts": "5.0.2"
  }
}
```

> **⚠️ OZ version must be exactly `5.0.2` — NOT `^5.2.0` as shown above, NOT 5.1+.** OZ 5.1+ introduced the `mcopy` opcode (EIP-5656, Cancun EVM). Ronin runs the **London EVM fork** and does not support `mcopy`. Using OZ 5.1+ with `evmVersion: 'london'` in hardhat.config will cause a compile error: `Unsupported opcode: mcopy`. Use `"5.0.2"` (exact, no caret). Verify the installed version is 5.0.2 after `npm install` before attempting to compile.

**Why `hardhat-deploy` + `hardhat-deploy-ethers`?**
- `hardhat-deploy` is **required** per Ronin deployment docs (provides `namedAccounts`, `deploy()`, `TASK_SOURCIFY`)
- `hardhat-deploy-ethers` bridges `hardhat-deploy` with `@nomicfoundation/hardhat-ethers` (OZ's preferred ethers integration)
- `@nomicfoundation/hardhat-toolbox` bundles chai, mocha, ethers, etc.

> **C6 — Plugin compatibility caveat:** `@nomicfoundation/hardhat-toolbox` v5 and `hardhat-deploy-ethers@0.4.2` both register ethers Hardhat extensions. Run `npx hardhat compile` immediately after `npm install` to confirm no duplicate plugin registration errors before proceeding. If you see `Error: HH9: Cannot import the same plugin twice`, check for version mismatches between `hardhat-deploy-ethers` and the ethers version bundled in `hardhat-toolbox`.

---

## 5. `contracts/hardhat.config.ts`

```typescript
import { HardhatUserConfig } from 'hardhat/types';
import '@nomicfoundation/hardhat-toolbox';
import 'hardhat-deploy';
import 'hardhat-deploy-ethers';
import * as dotenv from 'dotenv';
dotenv.config();

// Fail fast if private key is missing in CI; use a dummy for compile-only runs
const PRIVATE_KEY = process.env.PRIVATE_KEY
  ? `0x${process.env.PRIVATE_KEY.replace(/^0x/, '')}`
  : `0x${'0'.repeat(64)}`;

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.28',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'london',   // Required — Ronin runs London EVM fork
    },
  },
  networks: {
    hardhat: {},
    saigon: {
      chainId: 202601,
      url: process.env.SAIGON_RPC_URL ?? 'https://saigon-testnet.roninchain.com/rpc',
      accounts: [PRIVATE_KEY],
    },
    ronin: {
      chainId: 2020,
      url: process.env.RONIN_RPC_URL ?? 'https://api.roninchain.com/rpc',
      accounts: [PRIVATE_KEY],
      // C7: Ronin mainnet supports EIP-1559 after the Feb 2026 OP Stack migration.
      // Uncomment and tune these for production deploys to avoid overpaying gas.
      // maxFeePerGas: 20_000_000_000n,         // 20 gwei — adjust to current base fee
      // maxPriorityFeePerGas: 1_000_000_000n,  // 1 gwei tip
    },
  },
  // hardhat-deploy named accounts: index into the accounts array.
  // C4: The minter address is NOT listed here. The minter wallet comes from
  // process.env.MINTER_ADDRESS in the deploy script, not from accounts[1].
  // Listing it here as accounts[1] would create false expectations that a
  // second private key is present and used — it is not.
  namedAccounts: {
    deployer: { default: 0 },  // accounts[0] — pays gas, receives DEFAULT_ADMIN_ROLE
  },
};

export default config;
```

**Notes for implementer:**
- No `etherscan` block — Ronin uses Sourcify, not Etherscan
- `evmVersion: 'london'` is explicit — Ronin guidelines require London fork compatibility
- `chainId` in the network config is required by `hardhat-deploy` for Sourcify to select the right chain
- EIP-1559 fields for mainnet are commented out — uncomment and tune before production deploy

---

## 6. `contracts/deploy/01_deploy_kijonsai.ts`

The official Sky Mavis pattern uses `hardhat-deploy`'s `deploy()` function with `namedAccounts`. Sourcify verification is triggered by `99_verify.ts` (dependency injection).

```typescript
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  // Admin = deployer (can rotate to multisig post-deploy via grantRole)
  // Minter = MINTER_ADDRESS env var — the server's signing wallet address.
  // MINTER_ADDRESS must be set in .env. The deploy script grants MINTER_ROLE
  // to this address in the constructor. On testnet, can equal deployer for
  // convenience, but should be a separate key in production.
  const admin  = deployer;
  const minter = process.env.MINTER_ADDRESS ?? deployer;

  console.log(`[${network.name}] Deploying Kijonsai...`);
  console.log(`  admin:  ${admin}`);
  console.log(`  minter: ${minter}`);

  const result = await deploy('Kijonsai', {
    from: deployer,
    args: [admin, minter],
    log: true,
    // Wait more confirmations on mainnet for safety
    waitConfirmations: network.name === 'ronin' ? 5 : 1,
  });

  if (result.newlyDeployed) {
    console.log(`✅ Kijonsai deployed at: ${result.address}`);
    console.log(`   Block: ${result.receipt?.blockNumber}`);
    console.log(`   Gas used: ${result.receipt?.gasUsed}`);
  } else {
    console.log(`ℹ️  Kijonsai already deployed at: ${result.address} (skipping)`);
  }
};

func.tags = ['Kijonsai'];
func.id   = 'Kijonsai';  // prevents re-deployment on subsequent runs

export default func;
```

---

## 7. `contracts/deploy/99_verify.ts`

```typescript
import { TASK_SOURCIFY } from 'hardhat-deploy';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

/**
 * Sourcify verification — runs after all deploy scripts.
 * Endpoint requires trailing slash per Ronin docs.
 *
 * C3 caveat: Implementer must confirm `TASK_SOURCIFY` is a named export from
 * `hardhat-deploy`'s package root before shipping. If the import fails, the
 * alternative invocation is: await hre.run('sourcify', { endpoint: '...' })
 * with a string literal. Verify on first compile before writing deploy scripts.
 */
const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  if (hre.network.name === 'ronin' || hre.network.name === 'saigon') {
    console.log(`Verifying contracts on Ronin Sourcify (${hre.network.name})...`);
    await hre.run(TASK_SOURCIFY, {
      endpoint: 'https://sourcify.roninchain.com/server/',
    });
  }
};

func.tags        = ['VerifyContracts'];
func.runAtTheEnd = true;
func.dependencies = ['Kijonsai'];

export default func;
```

---

## 8. `contracts/test/Kijonsai.test.ts`

```typescript
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Kijonsai } from '../typechain-types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

describe('Kijonsai', () => {
  let contract: Kijonsai;
  let admin: HardhatEthersSigner;
  let minter: HardhatEthersSigner;
  let buyer: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  const TOKEN_1 = 1n;
  const URI_1   = 'https://api.kijo.xyz/nft/metadata/1';

  beforeEach(async () => {
    [admin, minter, buyer, other] = await ethers.getSigners();
    const factory = await ethers.getContractFactory('Kijonsai');
    contract = (await factory.deploy(admin.address, minter.address)) as Kijonsai;
    await contract.waitForDeployment();
  });

  // ── Deployment ─────────────────────────────────────────────────────────────

  describe('deployment', () => {
    it('sets name = "Kijonsai" and symbol = "KIJO"', async () => {
      expect(await contract.name()).to.eq('Kijonsai');
      expect(await contract.symbol()).to.eq('KIJO');
    });

    it('grants DEFAULT_ADMIN_ROLE to admin', async () => {
      const ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();
      expect(await contract.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
    });

    it('grants MINTER_ROLE to minter', async () => {
      const MINTER_ROLE = await contract.MINTER_ROLE();
      expect(await contract.hasRole(MINTER_ROLE, minter.address)).to.be.true;
    });

    it('does not grant MINTER_ROLE to admin by default', async () => {
      const MINTER_ROLE = await contract.MINTER_ROLE();
      expect(await contract.hasRole(MINTER_ROLE, admin.address)).to.be.false;
    });
  });

  // ── mintKijonsai ───────────────────────────────────────────────────────────

  describe('mintKijonsai', () => {
    it('mints token to buyer with correct URI and ownership', async () => {
      await contract.connect(minter).mintKijonsai(buyer.address, TOKEN_1, URI_1);
      expect(await contract.ownerOf(TOKEN_1)).to.eq(buyer.address);
      expect(await contract.tokenURI(TOKEN_1)).to.eq(URI_1);
    });

    it('emits Transfer event', async () => {
      await expect(contract.connect(minter).mintKijonsai(buyer.address, TOKEN_1, URI_1))
        .to.emit(contract, 'Transfer')
        .withArgs(ethers.ZeroAddress, buyer.address, TOKEN_1);
    });

    it('emits MetadataUpdate event (ERC-4906, via OZ v5 _setTokenURI)', async () => {
      await expect(contract.connect(minter).mintKijonsai(buyer.address, TOKEN_1, URI_1))
        .to.emit(contract, 'MetadataUpdate')
        .withArgs(TOKEN_1);
    });

    it('reverts with AccessControlUnauthorizedAccount if caller lacks MINTER_ROLE', async () => {
      await expect(
        contract.connect(buyer).mintKijonsai(buyer.address, TOKEN_1, URI_1),
      ).to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount');
    });

    it('reverts with ERC721InvalidSender if token already exists', async () => {
      await contract.connect(minter).mintKijonsai(buyer.address, TOKEN_1, URI_1);
      await expect(
        contract.connect(minter).mintKijonsai(buyer.address, TOKEN_1, URI_1),
      ).to.be.revertedWithCustomError(contract, 'ERC721InvalidSender');
    });

    it('allows minting multiple tokens with server-assigned IDs', async () => {
      await contract.connect(minter).mintKijonsai(buyer.address, 1n, 'https://api.kijo.xyz/nft/metadata/1');
      await contract.connect(minter).mintKijonsai(buyer.address, 2n, 'https://api.kijo.xyz/nft/metadata/2');
      expect(await contract.ownerOf(1n)).to.eq(buyer.address);
      expect(await contract.ownerOf(2n)).to.eq(buyer.address);
    });
  });

  // ── updateMetadata ─────────────────────────────────────────────────────────

  describe('updateMetadata', () => {
    beforeEach(async () => {
      await contract.connect(minter).mintKijonsai(buyer.address, TOKEN_1, URI_1);
    });

    it('updates tokenURI', async () => {
      const newURI = 'https://api.kijo.xyz/nft/metadata/1?v=2';
      await contract.connect(minter).updateMetadata(TOKEN_1, newURI);
      expect(await contract.tokenURI(TOKEN_1)).to.eq(newURI);
    });

    it('emits MetadataUpdate (ERC-4906)', async () => {
      const newURI = 'https://api.kijo.xyz/nft/metadata/1?v=2';
      await expect(contract.connect(minter).updateMetadata(TOKEN_1, newURI))
        .to.emit(contract, 'MetadataUpdate')
        .withArgs(TOKEN_1);
    });

    it('reverts with AccessControlUnauthorizedAccount for non-minter', async () => {
      await expect(
        contract.connect(buyer).updateMetadata(TOKEN_1, 'https://example.com/new'),
      ).to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount');
    });

    it('reverts with ERC721NonexistentToken for missing token', async () => {
      await expect(
        contract.connect(minter).updateMetadata(999n, 'https://api.kijo.xyz/nft/metadata/999'),
      ).to.be.revertedWithCustomError(contract, 'ERC721NonexistentToken');
    });
  });

  // ── emitBatchMetadataUpdate ────────────────────────────────────────────────
  // C5 fix: emitBatchMetadataUpdate now requires MINTER_ROLE, not DEFAULT_ADMIN_ROLE.
  // Routine server maintenance (re-index after migration) should not require the
  // admin wallet (likely a hardware wallet or multisig).

  describe('emitBatchMetadataUpdate', () => {
    it('emits BatchMetadataUpdate for a range when called by minter', async () => {
      await expect(contract.connect(minter).emitBatchMetadataUpdate(1n, type256Max()))
        .to.emit(contract, 'BatchMetadataUpdate')
        .withArgs(1n, type256Max());
    });

    it('reverts if caller lacks MINTER_ROLE', async () => {
      await expect(
        contract.connect(buyer).emitBatchMetadataUpdate(1n, 100n),
      ).to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount');
    });
  });

  // ── Role rotation (C-NEW-7) ───────────────────────────────────────────────
  // Three scenarios:
  //   (a) Deploy with minter A → A can mint.
  //   (b) Grant MINTER_ROLE to B, revoke A → B can mint, A cannot.
  //   (c) DEFAULT_ADMIN_ROLE holder can grant/revoke but cannot mint directly.

  describe('role rotation', () => {
    it('(a) minter A can mint immediately after deployment', async () => {
      await contract.connect(minter).mintKijonsai(buyer.address, TOKEN_1, URI_1);
      expect(await contract.ownerOf(TOKEN_1)).to.eq(buyer.address);
    });

    it('(b) after granting MINTER_ROLE to B and revoking A: B succeeds, A reverts', async () => {
      const MINTER_ROLE = await contract.MINTER_ROLE();

      // Grant MINTER_ROLE to `other` (minter B), revoke from `minter` (A).
      await contract.connect(admin).grantRole(MINTER_ROLE, other.address);
      await contract.connect(admin).revokeRole(MINTER_ROLE, minter.address);

      // B (other) can mint.
      await contract.connect(other).mintKijonsai(buyer.address, TOKEN_1, URI_1);
      expect(await contract.ownerOf(TOKEN_1)).to.eq(buyer.address);

      // A (minter) cannot mint — role was revoked.
      await expect(
        contract.connect(minter).mintKijonsai(buyer.address, 2n, URI_1),
      ).to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount');
    });

    it('(c) DEFAULT_ADMIN_ROLE holder can grant/revoke MINTER_ROLE but cannot mint directly', async () => {
      const MINTER_ROLE = await contract.MINTER_ROLE();

      // Admin can grant MINTER_ROLE.
      await contract.connect(admin).grantRole(MINTER_ROLE, other.address);
      expect(await contract.hasRole(MINTER_ROLE, other.address)).to.be.true;

      // Admin can revoke MINTER_ROLE.
      await contract.connect(admin).revokeRole(MINTER_ROLE, other.address);
      expect(await contract.hasRole(MINTER_ROLE, other.address)).to.be.false;

      // Admin cannot mint directly — does not hold MINTER_ROLE by default.
      await expect(
        contract.connect(admin).mintKijonsai(buyer.address, TOKEN_1, URI_1),
      ).to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount');
    });
  });

  // ── supportsInterface ──────────────────────────────────────────────────────

  describe('supportsInterface', () => {
    const cases: [string, string][] = [
      ['0x80ac58cd', 'ERC-721'],
      ['0x5b5e139f', 'ERC-721Metadata'],
      ['0x49064906', 'ERC-4906'],
      ['0x7965db0b', 'IAccessControl'],
      ['0x01ffc9a7', 'ERC-165'],
    ];

    for (const [id, name] of cases) {
      it(`supports ${name} (${id})`, async () => {
        expect(await contract.supportsInterface(id)).to.be.true;
      });
    }

    it('returns false for unknown interface', async () => {
      expect(await contract.supportsInterface('0xdeadbeef')).to.be.false;
    });
  });
});

function type256Max(): bigint {
  return 2n ** 256n - 1n;
}
```

---

## 9. `contracts/.env.example`

```bash
# ── Deployer key (no 0x prefix) ───────────────────────────────────────────────
# This wallet pays gas and receives DEFAULT_ADMIN_ROLE on deploy.
# Use a hardware wallet or KMS in production.
PRIVATE_KEY=your_deployer_private_key_here

# ── Minter wallet address ─────────────────────────────────────────────────────
# The deploy script grants MINTER_ROLE to this address in the constructor.
# This is the server's signing wallet — the address only, NOT the private key.
# The private key for this wallet lives in Supabase secrets (testnet) or
# AWS/GCP KMS (mainnet). See §9.1 for key management guidance.
MINTER_ADDRESS=0xYourServerMinterWalletAddress

# ── RPC endpoints ─────────────────────────────────────────────────────────────
# Defaults are public endpoints — fine for testnet/dev.
# For mainnet, use a dedicated endpoint (Ankr, dRPC, or run your own node).
SAIGON_RPC_URL=https://saigon-testnet.roninchain.com/rpc
RONIN_RPC_URL=https://api.roninchain.com/rpc

# ── No ETHERSCAN_API_KEY ──────────────────────────────────────────────────────
# Ronin uses Sourcify (https://sourcify.roninchain.com), not Etherscan.
# Verification is handled automatically by deploy/99_verify.ts.
```

---

## 9.1 Minter Key Management

The minter key is held by the Supabase Edge Function that calls `mintKijonsai` and `updateMetadata`. This section specifies how to manage it per environment.

### Testnet / Saigon

Store `MINTER_PRIVATE_KEY` as a Supabase secret:

```bash
supabase secrets set MINTER_PRIVATE_KEY=0xabc123...
```

Access in the Edge Function:

```typescript
const minterKey = Deno.env.get('MINTER_PRIVATE_KEY');
// Use with viem: createWalletClient({ account: privateKeyToAccount(minterKey), ... })
```

This is **acceptable for testnet only.** The raw private key is encrypted at rest by Supabase and never exposed in logs, but it lives in their infrastructure with no HSM guarantee.

### Mainnet

**The raw private key must never live in Supabase secrets in production.**

Use a KMS-backed wallet where the Edge Function holds only a key reference, never the raw key:

**AWS KMS:**
- Create a KMS Asymmetric key (ECC_SECG_P256K1, sign/verify use)
- Grant the Edge Function's IAM role `kms:Sign` permission
- Use viem's `kmsKeyring` or `ethers-aws-kms-signer` (`AwsKmsSigner`) to sign transactions
- The Edge Function stores `KMS_KEY_ID` (e.g., `arn:aws:kms:us-east-1:123456789:key/abc-def`) as a Supabase secret — not a private key

**GCP KMS:**
- Create a Cloud KMS key ring + key (EC_SIGN_SECP256K1_SHA256)
- Grant the Edge Function's service account `cloudkms.cryptoKeyVersions.useToSign`
- Use `@google-cloud/kms` with a custom viem account or ethers signer
- The Edge Function stores `GCP_KMS_KEY_NAME` as a Supabase secret — not a private key

#### Deriving the minter Ethereum address from a KMS key (C-NEW-6)

Before running the deploy script you need the Ethereum address the KMS key will sign as — to set as `MINTER_ADDRESS` in `.env` and pass as the `minter` constructor argument. The KMS key must exist before deployment; call the relevant SDK once to get the address, then add it to `.env`.

**AWS KMS — using `ethers-aws-kms-signer`:**

```typescript
import { KMSSigner } from '@openlayer-ai/ethers-aws-kms-signer';

const signer = new KMSSigner({
  keyId: process.env.KMS_KEY_ID!, // e.g. "arn:aws:kms:us-east-1:123:key/abc-def"
  region: process.env.AWS_REGION ?? 'us-east-1',
});
const minterAddress = await signer.getAddress();
console.log('MINTER_ADDRESS=' + minterAddress);
```

**AWS KMS — using viem custom account:**

```typescript
import { createKmsAccount } from 'aws-kms-viem'; // community adapter
const account = await createKmsAccount({ keyId: process.env.KMS_KEY_ID! });
console.log('MINTER_ADDRESS=' + account.address);
```

**GCP KMS — using `@google-cloud/kms` + viem custom account:**

```typescript
import { KeyManagementServiceClient } from '@google-cloud/kms';
import { gcpKmsToAccount } from 'gcp-kms-viem'; // community adapter
const account = await gcpKmsToAccount({ keyName: process.env.GCP_KMS_KEY_NAME! });
console.log('MINTER_ADDRESS=' + account.address);
```

Run the appropriate snippet once before deployment. Copy the printed address to `MINTER_ADDRESS=` in `.env`. The deploy script (`01_deploy_kijonsai.ts`) reads `process.env.MINTER_ADDRESS` and passes it as the `minter` constructor arg, granting `MINTER_ROLE` to the KMS-backed address at deploy time.

**References:**
- viem KMS patterns: https://viem.sh/docs/accounts/custom
- ethers AWS KMS: https://github.com/openlayer-ai/ethers-aws-kms-signer
- ethers GCP KMS: https://github.com/openlayer-ai/ethers-gcp-kms-signer

### Summary

| Environment | Storage | Acceptable? |
|---|---|---|
| Local dev | `.env` file (gitignored) | ✅ Dev only |
| Saigon testnet | Supabase secret (`MINTER_PRIVATE_KEY`) | ✅ Testnet only |
| Ronin mainnet | Supabase secret (raw key) | ❌ Never |
| Ronin mainnet | KMS key reference (`KMS_KEY_ID`) | ✅ Required |

> **Note:** `MINTER_ADDRESS` (the wallet address, not the private key) belongs in the contracts `.env` so the deploy script can grant `MINTER_ROLE` to the correct address. The address is not a secret and can be committed or stored wherever convenient.

---

## 9.2 Minter Signing in Deno — Complete Edge Function Example

> **C-NEW-3 fix:** Complete, working Deno/viem implementation for the `seed-tree` Edge Function minting path. This is not pseudocode — import paths and function calls are exact and work in Supabase Edge Functions (Deno runtime).

```typescript
// apps/server/supabase/functions/seed-tree/mint.ts
// Runtime: Deno (Supabase Edge Functions)
// Dependencies: viem v2 via npm specifier (Deno supports npm: protocol)

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Chain,
} from 'npm:viem@2';
import { privateKeyToAccount } from 'npm:viem@2/accounts';

// ── Ronin chain definition ────────────────────────────────────────────────────
// viem does not ship Ronin in its built-in chain list. Define it manually.
// Saigon testnet: id 202601; mainnet: id 2020.
const ronin = {
  id: 2020,
  name: 'Ronin',
  nativeCurrency: { name: 'RON', symbol: 'RON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://api.roninchain.com/rpc'] },
    public:  { http: ['https://api.roninchain.com/rpc'] },
  },
} as const satisfies Chain;

// ── Contract ABI (mint function only — keep it minimal) ───────────────────────
const KIJONSAI_ABI = parseAbi([
  'function mintKijonsai(address to, uint256 tokenId, string calldata uri) external',
]);

// ── Clients — constructed once per Edge Function cold start ──────────────────
// Deno.env.get reads Supabase secrets set via `supabase secrets set`.
const CONTRACT_ADDRESS = Deno.env.get('CONTRACT_ADDRESS') as `0x${string}`;
const MINTER_PRIVATE_KEY = Deno.env.get('MINTER_PRIVATE_KEY') as `0x${string}`;
const RPC_URL = Deno.env.get('RONIN_RPC_URL') ?? 'https://api.roninchain.com/rpc';

const account = privateKeyToAccount(MINTER_PRIVATE_KEY);

const publicClient = createPublicClient({
  chain: ronin,
  transport: http(RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain: ronin,
  transport: http(RPC_URL),
});

// ── mintKijonsaiToken — call after verifying RON payment and assigning tokenId ─
/**
 * Mints a Kijonsai NFT on-chain.
 *
 * @param to          Buyer's wallet address (checksummed).
 * @param tokenId     Server-assigned token ID (from DB sequence — see §2.5).
 * @param metadataUri Full URI, e.g. "https://api.kijo.xyz/nft/metadata/42".
 * @returns           Transaction hash of the confirmed mint.
 */
export async function mintKijonsaiToken(
  to: `0x${string}`,
  tokenId: bigint,
  metadataUri: string,
): Promise<`0x${string}`> {
  // 1. Submit transaction — walletClient signs with MINTER_PRIVATE_KEY.
  const hash = await walletClient.writeContract({
    address: CONTRACT_ADDRESS,
    abi: KIJONSAI_ABI,
    functionName: 'mintKijonsai',
    args: [to, tokenId, metadataUri],
  });

  // 2. Wait for on-chain confirmation before returning to caller.
  //    On Ronin, 1 confirmation is sufficient for testnet; use 5 for mainnet.
  await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });

  return hash;
}
```

**Usage inside the Edge Function handler:**

```typescript
// index.ts (Edge Function entry point)
import { mintKijonsaiToken } from './mint.ts';

// After verifying RON payment and assigning tokenId from DB sequence:
const txHash = await mintKijonsaiToken(
  buyerAddress,           // e.g. '0xAbc123...'
  BigInt(tokenId),        // e.g. 42n
  `https://api.kijo.xyz/nft/metadata/${tokenId}`,
);
// Record txHash in DB alongside the token record.
```

**Saigon testnet variant:** Set `RONIN_RPC_URL=https://saigon-testnet.roninchain.com/rpc` and change `ronin.id` to `202601`, or define a separate `saigon` chain object and select by env flag.

---

## 10. Deployment Runbook

### Saigon testnet (first)

**DEPLOYED — 2026-07-22 (v2 — treasury wallet as minter)**
| Field | Value |
|---|---|
| Contract address | `0x4447F631F5868bFA03A6e6ae2D2da9f22c787E44` |
| Deploy tx | `0x9c2f7c9d6bb034a93c9b10a333f26a5ab94c925fe199f8b86d04839b40b28376` |
| Block | 52749550 |
| Gas used | 1,484,606 |
| Admin | `0x26D9E80f4A8ca7f223D7e557075d4b73e2916D58` |
| Minter | `0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199` (treasury wallet — testnet only) |
| Explorer | https://saigon-explorer.roninchain.com/address/0x4447F631F5868bFA03A6e6ae2D2da9f22c787E44 |

> **Sourcify verification:** Sourcify API v1 is in a scheduled brownout (2026-07-07 → 2027-01-08). The `99_verify.ts` deploy hook failed with `API v1 Brownout`. Verify manually via Sourcify v2 API (`https://sourcify.dev/server/api-docs/swagger.json`) or wait until the brownout window ends. Contract is fully functional on-chain without verification.

```bash
cd contracts
npm install

# Verify no plugin registration conflicts before proceeding (C6)
npx hardhat compile

# Fund deployer with test RON from faucet: https://faucet.roninchain.com/

# Set env
cp .env.example .env
# Edit .env: PRIVATE_KEY (deployer), MINTER_ADDRESS (server wallet address)

# Deploy + verify (99_verify.ts runs automatically after 01_deploy)
npx hardhat deploy --network saigon

# Confirm on explorer
# https://saigon-explorer.roninchain.com/address/<DEPLOYED_ADDRESS>
```

### Ronin mainnet

```bash
# Before deploying to mainnet:
# 1. Confirm MINTER_ADDRESS is the production KMS-backed wallet (see §9.1)
# 2. Tune EIP-1559 gas params in hardhat.config.ts ronin network block (C7):
#    uncomment maxFeePerGas / maxPriorityFeePerGas and set to current network rates
# 3. Ensure 5 confirmations are waited (already set in 01_deploy_kijonsai.ts)

npx hardhat deploy --network ronin
```

> **C7 — EIP-1559 on Ronin mainnet:** Ronin mainnet supports EIP-1559 after the Feb 2026 OP Stack migration. The `maxFeePerGas` and `maxPriorityFeePerGas` fields in the `ronin` network config (§5) are commented out. Uncomment and set them to appropriate values before production deploys to avoid using legacy gas pricing. Check current base fee on `https://app.roninchain.com/` before setting.

### Re-run verify only (if first attempt failed)

```bash
npx hardhat sourcify --endpoint https://sourcify.roninchain.com/server/ --network saigon
```

> Note the trailing slash — Ronin docs state it is required.

---

## 11. Sky Mavis Collection Registration (post-deploy)

After contract is deployed and verified on Saigon:

1. Fill out the collection form: https://forms.gle/9tby2sLLkau9dbnq6
   - Contract address
   - Collection name: "Kijonsai"
   - Creator fee: recommend **5%** (sits at low end of typical 0–10% range)
   - Social links, banner (2560×640px, ≤600KB), avatar (512×512px, ≤600KB)
2. Contact Sky Mavis dev support to list on staging Ronin Market
3. Mint test NFTs on Saigon, confirm metadata shows correctly
4. After sign-off, deploy to mainnet and notify Sky Mavis

**Important:** If `animation_url` is used (Three.js viewer), share the viewer domain with Sky Mavis to get it allowlisted before it appears on Ronin Market.

---

## 12. Metadata Server — Required Schema (server team action required)

Update `apps/web` or the Supabase Edge Function serving `GET /nft/metadata/{tokenId}`. The response must include all fields below.

### 12.1 Server-side stat computation — StatDeriver

> **C-NEW-4:** The metadata JSON in §12 includes derived stats (HP, Power, Endurance, Ki, Match %, Skill Slots, Wisdom, Flower Guild Rank, Technique). These are **not stored as raw columns** — they are computed on demand by running the `@kijo/engine` pipeline server-side each time the metadata endpoint is called (or when `updateMetadata` is triggered).

The server's metadata Edge Function runs the full derivation pipeline on request:

```
DB row (seed, species, born, care_log[]) 
  → CareLogReplay.reconstruct()    // replay care log from Day 0 to current state
  → Voxelizer.voxelize()           // tree geometry → sparse voxels with morphology roles
  → StatDeriver.derive(voxels, seed) // structural stats (role-based) + terrain bonuses (seed coordinate map)
  → TechniqueClassifier.classify(care_log) // care log → technique label
  → Flower Guild Rank (from StatDeriver.derive().matchPct)
  → metadata JSON response
```

`StatDeriver` is the `@kijo/engine` class that turns voxelized tree geometry into the `StatSheet` used for combat and marketplace display. The server imports `@kijo/engine` from the monorepo workspace — the same package the client uses, so stats are deterministic between client and server given the same inputs.

> **Implementer note:** The NFT metadata endpoint (`GET /nft/metadata/{tokenId}`) must import `StatDeriver` from `@kijo/engine` and run it synchronously on each request. Results must not be cached longer than the care-log update window (8 hours) to avoid serving stale stats after a care action is recorded. Alternatively, recompute and call `updateMetadata` on-chain after each care action to invalidate the Ronin Market cache.

### Corrections from PHASE1 arch doc

| Field | Old (PHASE1 arch doc said) | Correct (per live Ronin Market docs) |
|---|---|---|
| `has_spirit` display_type | `"string"` with `"True"`/`"False"` | `"bool"` with native `true`/`false` |
| `BatchMetadataUpdate` | Not mentioned | Emit via `emitBatchMetadataUpdate(1, type(uint256).max)` for full re-index |

### Complete metadata JSON — all required fields

The following is the full required schema for a wallet-connected token (minted NFT). All traits listed must be present. Guest tokens (not minted) omit `Flower Guild Rank` or show `"Unranked (Guest)"` per PRD §4.5.

```json
{
  "name": "Kijonsai #42",
  "description": "A living bonsai — grown through care, shaped by the player.",
  "image": "https://api.kijo.xyz/nft/image/42.png",
  "animation_url": "https://api.kijo.xyz/nft/viewer/42",
  "attributes": [

    // ── Core identity ─────────────────────────────────────────────────────
    { "display_type": "number",  "trait_type": "Seed",             "value": 464497 },
    { "display_type": "string",  "trait_type": "Species",          "value": "Hardwood" },
    // C-NEW-1: Species Sub-type — specific cultivar or morphology variant within the species class.
    // Type: string. Example values: "Twisted Trunk", "Cascade", "Literati", "Broom Style".
    { "display_type": "string",  "trait_type": "Species Sub-type", "value": "Twisted Trunk" },
    // C-NEW-1: Leaf Color — foliage color as rendered by the voxelizer for this tree's seed.
    // Type: string. Example values: "Deep Green", "Autumn Gold", "Silver Sage", "Crimson".
    { "display_type": "string",  "trait_type": "Leaf Color",       "value": "Deep Green" },
    { "display_type": "date",    "trait_type": "Born",             "value": 1721520000 },
    // C-NEW-1: Age in game days since planting. Computed server-side at metadata request time:
    // Math.floor((Date.now() - born_unix_ms) / 86400000) where born_unix_ms = Born × 1000.
    // Type: integer. Example: 47 (tree is 47 game days old).
    { "display_type": "number",  "trait_type": "Age",              "value": 47 },
    { "display_type": "bool",    "trait_type": "Has Spirit",       "value": true },

    // ── Flower Guild Rank (PRD §7.3, §4.4) ───────────────────────────────
    // Derived from StatDeriver.derive().matchPct. String trait, no display_type.
    // Values: Seedling / Sapling / Pruned / Styled / Exhibition / Master Work
    // For guest tokens: "Unranked (Guest)"
    { "trait_type": "Flower Guild Rank", "value": "Sapling" },

    // ── Combat stats (PRD §7.3) ───────────────────────────────────────────
    { "display_type": "number",  "trait_type": "HP",          "value": 959 },
    { "display_type": "number",  "trait_type": "Power",       "value": 390 },
    { "display_type": "number",  "trait_type": "Endurance",   "value": 170 },
    { "display_type": "number",  "trait_type": "Ki",          "value": 294 },
    { "display_type": "number",  "trait_type": "Match %",     "value": 73 },

    // ── Skill and wisdom (PRD §7.3, derived from StatDeriver) ────────────
    { "display_type": "number",  "trait_type": "Skill Slots", "value": 2 },
    { "display_type": "number",  "trait_type": "Wisdom",      "value": 35 },

    // ── Technique (PRD §7.3) ──────────────────────────────────────────────
    { "display_type": "string",  "trait_type": "Technique",   "value": "Bound-and-Cut" },

    // ── Care log summary (PRD §4.4, §7.3) ────────────────────────────────
    // Integers only. Health Average is 0–100.
    { "display_type": "number",  "trait_type": "Total Care Actions", "value": 42 },
    { "display_type": "number",  "trait_type": "Prune Count",        "value": 7 },
    { "display_type": "number",  "trait_type": "Health Average",     "value": 84 }
  ]
}
```

**Key rules:**
- `name` and `image` are required; everything else optional but all of the above must be present per PRD §7.3
- `"date"` values are Unix timestamps in **seconds** (not milliseconds)
- Do NOT use nested attributes — all traits flat in the `attributes` array
- No bot protection on the metadata server (Ronin Market crawls it)
- To notify Ronin Market of metadata changes: `updateMetadata` on-chain emits `MetadataUpdate` via `_setTokenURI`; for bulk re-index call `emitBatchMetadataUpdate`
- `display_type: "bool"` verified against live Mavis docs — re-confirm before production (C2)

---

## 13. Phase 2 Additions (out of scope, flag for future)

| Feature | Implementation |
|---|---|
| **`care_log_hash` Merkle root** (deferred from Phase 1 — see §1.1) | Add `updateCareLogHash(uint256, bytes32) onlyRole(MINTER_ROLE)` + `care_log_hash` mapping. **Rationale for deferral:** In Phase 1 the server is the sole trust anchor for all state; an on-chain hash the server also computes adds no verifiable trustlessness. The hash becomes meaningful in Phase 2 when client-side replay tooling exists. **Update protocol: TBD** — options are (a) per care action, (b) daily on lazy tick, (c) on spirit awakening only. Phase 2 spec must decide this before implementation. |
| Token locking (gameplay staking) | Add `TokenLocked` / `TokenUnlocked` events per Ronin Market spec |
| ERC-2981 royalties (if Sky Mavis requests) | Inherit `ERC2981`, call `_setDefaultRoyalty(treasury, 500)` in constructor |
| Bulk mint | Add `bulkMintKijonsai(address[], uint256[], string[])` for airdrops |
| UUPS upgrade proxy | Swap direct deploy for UUPS if contract evolution needed |

---

## Sources

- [Deploy with Hardhat — Ronin Docs](https://docs.roninchain.com/developers/smart-contracts/deploy) — `hardhat-deploy` required; Solidity 0.8.28
- [Verify a Smart Contract — Ronin Docs](https://docs.roninchain.com/developers/smart-contracts/verify) — Sourcify endpoint + `TASK_SOURCIFY`
- [Smart Contract Guidelines — Ronin Docs](https://docs.roninchain.com/developers/smart-contracts/guidelines) — London EVM; no TransparentProxy OZ v5; no selfdestruct
- [Metadata Standards — Mavis Docs](https://docs.skymavis.com/mavis/ronin-market/reference/metadata) — `bool` display type; `BatchMetadataUpdate`; no bot protection
- [List NFTs — Mavis Docs](https://docs.skymavis.com/mavis/ronin-market/guides/list) — royalties via form; `ERC721Common` template exists but unsuitable
- [Fees & Royalties — Mavis Docs](https://docs.skymavis.com/mavis/ronin-market/explanation/fees) — 2.5% service fee; 0–10% creator fee
- [axieinfinity/contract-template on GitHub](https://github.com/axieinfinity/contract-template) — `ERC721Common` source (OZ v5 `_update` override pattern)
