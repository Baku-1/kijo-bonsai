# Kijo Phase 1 — Ronin Wallet & ERC-721 Architecture

**Date:** 2026-07-21 (updated 2026-07-23)  
**Author:** Architect pass  
**Status:** ✅ Implemented (2026-07-23) — UI-verified end-to-end on Saigon testnet  
**Scope:** Wallet connect button, seed purchase (RON payment), ERC-721 Kijonsai NFT contract

> **Implementation note (2026-07-26):** The deployed contract and auth flow differ from the spec in this doc. See §5.1-note and §3.3-note for deltas. See `KIJONSAI-CONTRACT-ARCH.md` and `PHASE2-WALLET-ARCH.md` for the authoritative implemented designs.

---

## 1. Network Config (Hardcode These)

| | Saigon Testnet | Ronin Mainnet |
|---|---|---|
| **Chain ID** | `202601` | `2020` |
| **RPC** | `https://saigon-testnet.roninchain.com/rpc` | `https://api.roninchain.com/rpc` |
| **Block Explorer** | `https://saigon-explorer.roninchain.com/` | `https://app.roninchain.com/` |
| **Currency** | RON | RON |
| **Block time** | ~2s | ~2s |
| **Consensus** | OP Stack (L2) | OP Stack (L2) |

> **Critical:** Ronin migrated from L1 to OP Stack on Feb 5, 2026. Saigon testnet chain ID changed from 2021 → **202601**. Any tutorials referencing chain ID 2021 are outdated. Use 202601.

Test RON faucet: https://faucet.roninchain.com/ (5 requests/day — requires Ronin Wallet)

---

## 2. npm Packages

Install in `apps/web/`:

```bash
npm install @sky-mavis/tanto-wagmi wagmi viem @tanstack/react-query
```

| Package | Latest | Purpose |
|---|---|---|
| `@sky-mavis/tanto-wagmi` | `0.0.11` | Wagmi v2 connectors for Ronin Wallet + Waypoint |
| `@sky-mavis/tanto-connect` | latest | Low-level EIP-6963 injected provider (skip if using tanto-wagmi) |
| `@sky-mavis/tanto-widget` | `0.0.6` | Drop-in React connect button widget (optional shortcut) |
| `wagmi` | v2.x | React hooks for wallet state, signing, transactions |
| `viem` | v2.x | Chain definitions (`ronin`, `saigon` from `viem/chains`) |
| `@tanstack/react-query` | v5.x | Required peer dep for Wagmi v2 |

GitHub: https://github.com/skymavis/tanto-kit  
Docs: https://docs.skymavis.com/ronin/wallet/guides/install-tanto-connect

---

## 3. Wallet Connect Flow

### 3.1 Wagmi Config (one file, import everywhere)

```typescript
// apps/web/src/wallet/config.ts
import { roninWallet } from '@sky-mavis/tanto-wagmi';
import { ronin, saigon } from 'viem/chains';
import { createConfig, http } from 'wagmi';

export const wagmiConfig = createConfig({
  chains: [saigon, ronin],          // saigon first = default during dev
  transports: {
    [saigon.id]: http(),            // uses public RPC; swap for paid endpoint in prod
    [ronin.id]:  http(),
  },
  multiInjectedProviderDiscovery: false,  // required — Ronin wallet is not EIP-6963 standard
  connectors: [roninWallet()],
});
```

### 3.2 Provider Wrapping (root of React app)

```typescript
// apps/web/src/main.tsx  (currently main.ts — needs to become React)
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { wagmiConfig } from './wallet/config';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </WagmiProvider>
);
```

### 3.3 Connect → Get Address → Sign (pseudocode + real hooks)

> **§3.3-note (2026-07-26):** Auth is implemented via `wallet-auth` Supabase Edge Function (not `/api/auth/verify`). The nonce is a client-generated timestamp (Date.now()). The hook is `useWalletAuth.ts`. See `PHASE2-WALLET-ARCH.md §B.6` for the implemented design.

```typescript
// apps/web/src/wallet/useWallet.ts
import { useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi';

export function useWallet() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors }         = useConnect();
  const { disconnect }                  = useDisconnect();
  const { signMessageAsync }            = useSignMessage();

  // Step 1: Connect
  async function connectWallet() {
    const connector = connectors[0]; // roninWallet connector
    await connect({ connector });
    // After resolution: address is populated, chain.id === 202601 (saigon)
  }

  // Step 2: Sign a server-issued nonce for auth
  async function authenticate(nonce: string): Promise<string> {
    // nonce is fetched from server: GET /api/auth/nonce?address={address}
    const message = `Kijo authentication\nAddress: ${address}\nNonce: ${nonce}`;
    const signature = await signMessageAsync({ message });
    return signature;
    // POST signature to: /api/auth/verify → server recovers signer address,
    // confirms it matches {address}, issues session JWT
  }

  return { address, isConnected, chain, connectWallet, disconnect, authenticate };
}
```

**Flow:**
1. Player clicks "Connect Wallet" → `connectWallet()` → Ronin Wallet browser extension prompts
2. On success, `address` (0x...) is available
3. Client fetches nonce from server (`GET /api/auth/nonce?address=0x...`)
4. Client calls `authenticate(nonce)` → Ronin Wallet prompts to sign message
5. Client posts `{ address, signature }` to `POST /api/auth/verify`
6. Server uses `viem.recoverMessageAddress()` to verify, issues JWT
7. All subsequent server calls use JWT in `Authorization: Bearer` header

---

## 4. RON Payment Flow (Seed Purchase)

The server mints after detecting payment. The client triggers a plain RON transfer to the server's treasury address. No payable contract needed for Phase 1.

### 4.1 Client Side

```typescript
// apps/web/src/wallet/useSeedPurchase.ts
import { useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';

const TREASURY = '0xYOUR_TREASURY_ADDRESS'; // server-controlled wallet
const SEED_PRICE_RON = '3';                  // 3 RON ≈ $3 (adjust with oracle later)

export function useSeedPurchase() {
  const { sendTransactionAsync } = useSendTransaction();

  async function buySeeds(count: number = 1): Promise<`0x${string}`> {
    const txHash = await sendTransactionAsync({
      to:    TREASURY,
      value: parseEther(SEED_PRICE_RON) * BigInt(count),
    });
    // txHash is the RON transfer tx hash
    // POST txHash to: /api/seeds/claim → server verifies tx on-chain, mints NFT
    return txHash;
  }

  return { buySeeds };
}
```

### 4.2 Server Side (mint flow)

```
POST /api/seeds/claim  { txHash, buyerAddress }
  → verify txHash on Saigon:
      tx.to === TREASURY_ADDRESS
      tx.value >= SEED_PRICE (in wei)
      tx confirmed (block finalized)
      txHash not already claimed (idempotency table)
  → generate seed = cryptoRNG() as uint32
  → determine species from seed
  → call KijonsaiNFT.mintTo(buyerAddress, seed, species)
      (server holds private key for the minter role)
  → store { txHash, tokenId, seed, buyerAddress } in DB
  → return { tokenId, seed }
```

**Why client transfer not payable contract?** Simpler for Phase 1. Phase 2 can add a `SeedShop` contract with on-chain randomness and trustless minting. For now the server is already authoritative over the care log, so it minting is consistent with that model.

**RON/USD price:** Hardcode 3 RON = $3 for testnet. Production needs a Chainlink/API3 price oracle or a fixed USD-denominated price with RON amount computed server-side at purchase time.

---

## 5. ERC-721 Contract

> **§5.1-note (2026-07-26):** The spec contract below (`KijonsaiNFT` with `mintTo(address, uint32, uint8)` and on-chain `TokenData` struct) was **not built**. The implemented contract is simpler: `Kijonsai` (ERC721URIStorage + AccessControl, OZ 5.0.2) with `mintKijonsai(address to, uint256 tokenId, string uri)`. Token ID is assigned server-side via Postgres sequence. Seed/species/care_log_hash are NOT stored on-chain — metadata lives at `https://api.kijo.xyz/nft/metadata/{tokenId}`. Deployed at `0x4447F631F5868bFA03A6e6ae2D2da9f22c787E44` on Saigon testnet (block 52749550). See `KIJONSAI-CONTRACT-ARCH.md` for the full implemented spec.

### 5.1 On-Chain Storage (what goes in the contract)

```solidity
struct KijonsaiData {
    uint32  seed;            // deterministic tree genome
    uint8   species;         // 0=hardwood, 1=evergreen, 2=tropical (from GDD)
    uint64  born;            // unix timestamp of mint
    bytes32 care_log_hash;   // Merkle root of care log (updated periodically by server)
    bool    has_spirit;      // awakened (set by server when technique qualifies)
}
```

**NOT stored on-chain:** the full parametric tree, voxel data, stat sheet, or care log entries. Those live on the server (and are Merkle-provable via `care_log_hash`). This matches `KIJO-ARCHITECTURE.md §2.6`: minimal on-chain footprint, ~160 bytes/NFT.

### 5.2 Contract Skeleton

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract KijonsaiNFT is ERC721URIStorage, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant UPDATER_ROLE = keccak256("UPDATER_ROLE");

    struct TokenData {
        uint32  seed;
        uint8   species;
        uint64  born;
        bytes32 care_log_hash;
        bool    has_spirit;
    }

    uint256 private _nextTokenId;
    mapping(uint256 => TokenData) public tokenData;

    // ERC-4906: tell Ronin Market to re-index metadata
    event MetadataUpdate(uint256 _tokenId);

    string private _baseTokenURI;

    constructor(address admin, string memory baseURI) ERC721("Kijonsai", "KIJO") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(UPDATER_ROLE, admin);
        _baseTokenURI = baseURI;
    }

    /// @notice Server calls this after verifying RON payment
    function mintTo(
        address to,
        uint32  seed,
        uint8   species
    ) external onlyRole(MINTER_ROLE) returns (uint256) {
        uint256 tokenId = ++_nextTokenId;
        _safeMint(to, tokenId);
        tokenData[tokenId] = TokenData({
            seed:          seed,
            species:       species,
            born:          uint64(block.timestamp),
            care_log_hash: bytes32(0),
            has_spirit:    false
        });
        return tokenId;
    }

    /// @notice Server pushes updated care log Merkle root on-chain
    function updateCareLogHash(
        uint256 tokenId,
        bytes32 newHash
    ) external onlyRole(UPDATER_ROLE) {
        tokenData[tokenId].care_log_hash = newHash;
        emit MetadataUpdate(tokenId);
    }

    /// @notice Server sets spirit flag when technique qualifies
    function setHasSpirit(
        uint256 tokenId,
        bool    value
    ) external onlyRole(UPDATER_ROLE) {
        tokenData[tokenId].has_spirit = value;
        emit MetadataUpdate(tokenId);
    }

    /// @notice Ronin Market calls this to get metadata URL
    function tokenURI(uint256 tokenId)
        public view override returns (string memory)
    {
        _requireOwned(tokenId);
        return string(abi.encodePacked(_baseTokenURI, Strings.toString(tokenId)));
        // Example: https://api.kijo.xyz/nft/metadata/42
    }

    function setBaseURI(string memory newURI)
        external onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _baseTokenURI = newURI;
    }

    // Required for ERC721 + AccessControl + ERC-4906 (interface ID 0x49064906)
    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721URIStorage, AccessControl) returns (bool)
    {
        return interfaceId == 0x49064906 || super.supportsInterface(interfaceId);
    }
}
```

**Why `AccessControl` not `Ownable`?** The server needs a `MINTER_ROLE` and `UPDATER_ROLE` separately from the owner key. Ownable would mean one key does everything, which is a security problem in production.

**Why no ERC721Enumerable?** Adds gas cost. Indexing by owner is done off-chain by the server (or Ronin's Skynet API). Add it later if needed.

---

## 6. Off-Chain Metadata (Ronin Market compatibility)

The server must serve a metadata endpoint matching the Mavis/OpenSea standard:

```
GET https://api.kijo.xyz/nft/metadata/{tokenId}
```

Response (JSON):

```json
{
  "name": "Kijonsai #42",
  "description": "A living bonsai — grown through care, shaped by the player.",
  "image": "https://api.kijo.xyz/nft/image/42.png",
  "animation_url": "https://api.kijo.xyz/nft/viewer/42",
  "attributes": [
    { "display_type": "number",  "trait_type": "Seed",       "value": 464497 },
    { "display_type": "string",  "trait_type": "Species",    "value": "Hardwood" },
    { "display_type": "date",    "trait_type": "Born",       "value": 1721520000 },
    { "display_type": "string",  "trait_type": "Has Spirit", "value": "False" },
    { "display_type": "number",  "trait_type": "HP",         "value": 959 },
    { "display_type": "number",  "trait_type": "Power",      "value": 390 },
    { "display_type": "number",  "trait_type": "Endurance",  "value": 170 },
    { "display_type": "number",  "trait_type": "Ki",         "value": 294 },
    { "display_type": "number",  "trait_type": "Match %",    "value": 73 },
    { "display_type": "string",  "trait_type": "Technique",  "value": "Bound-and-Cut" }
  ]
}
```

**Key rules from Mavis docs:**
- `name` and `image` are required; everything else optional
- `display_type` options: `"string"`, `"number"`, `"date"` — use exactly these strings; there is no `"bool"` type, use `"string"` with `"True"` / `"False"` values instead
- `"date"` values are Unix timestamps in **seconds** (not milliseconds)
- Do NOT use nested attributes — all traits flat in the `attributes` array
- No bot protection on the metadata server (Ronin Market crawls it)
- To notify Ronin Market of metadata changes: emit `MetadataUpdate(tokenId)` on-chain (ERC-4906), OR call the GraphQL API, OR use the REST API with an `X-API-Key`

**Metadata deployment options (cheapest first):**
1. Server endpoint (already needed for dynamic stats)
2. IPFS for static image/animation assets (pinata, nft.storage)
3. CDN for serving images (required for video — must allowlist domain with Sky Mavis)

---

## 7. Ronin Market — Collection Listing Requirements

To list Kijonsai on Ronin Market (https://marketplace.roninchain.com/):

1. **Contract deployed on Ronin mainnet** (Saigon testnet is supported for testing listing process)
2. **`tokenURI()` implemented** and returning valid metadata JSON
3. **Contract is ERC-721** (standard OpenZeppelin is fine — no proprietary ERC721Common needed)
4. **Collection registration:** Go to [Ronin Developer Console](https://developers.roninchain.com/console) → submit collection. Contract owner must sign with Ronin Wallet.
5. **Sky Mavis review:** For featured/promoted listings Sky Mavis reviews manually. Basic secondary trading listing can be self-served via Developer Console.

Docs: https://docs.skymavis.com/mavis/ronin-market/guides/list  
Dev Console: https://developers.roninchain.com/console/applications/

---

## 8. Contracts Folder Layout (Use Hardhat)

The Ronin ecosystem uses **Hardhat**. `axieinfinity/ronin-smart-contracts` uses `hardhat.config.ts`. No Foundry examples exist in official Ronin docs. Use Hardhat.

```
contracts/
├── contracts/
│   └── KijonsaiNFT.sol
├── scripts/
│   └── deploy.ts
├── test/
│   └── KijonsaiNFT.test.ts
├── hardhat.config.ts
├── package.json
└── .env                    # PRIVATE_KEY, SAIGON_RPC_URL (gitignored)
```

### hardhat.config.ts

```typescript
import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import * as dotenv from 'dotenv';
dotenv.config();

const config: HardhatUserConfig = {
  solidity: '0.8.24',
  networks: {
    saigon: {
      chainId: 202601,
      url: process.env.SAIGON_RPC_URL ?? 'https://saigon-testnet.roninchain.com/rpc',
      accounts: process.env.PRIVATE_KEY ? [`0x${process.env.PRIVATE_KEY}`] : [],
    },
    ronin: {
      chainId: 2020,
      url: 'https://api.roninchain.com/rpc',
      accounts: process.env.PRIVATE_KEY ? [`0x${process.env.PRIVATE_KEY}`] : [],
    },
  },
};

export default config;
```

### package.json (contracts/)

```json
{
  "name": "@kijo/contracts",
  "version": "0.0.1",
  "devDependencies": {
    "hardhat": "^2.22.0",
    "@nomicfoundation/hardhat-toolbox": "^5.0.0",
    "dotenv": "^16.0.0"
  },
  "dependencies": {
    "@openzeppelin/contracts": "5.0.2"
    // ⚠️ MUST be exactly 5.0.2 — no caret. v5.1+ uses mcopy opcode (Cancun only), incompatible with Ronin London EVM.
  }
}
```

### Deployment

```bash
cd contracts
npm install
npx hardhat run scripts/deploy.ts --network saigon
```

### Verification (Sourcify — Ronin's verifier)

```bash
npx hardhat verify --network saigon <DEPLOYED_ADDRESS> <CONSTRUCTOR_ARGS>
# OR
yarn hardhat --network saigon sourcify --endpoint https://sourcify.roninchain.com/server
```

Block explorer verification page: `https://saigon-explorer.roninchain.com/`

---

## 9. What Goes in `apps/web/src/` (Phase 1 additions)

Current `apps/web/` is a plain Vite + TypeScript project with no React. Phase 1 requires React for Wagmi hooks.

**Required changes:**
1. Add React to `apps/web/package.json` (`react`, `react-dom`, `@types/react`, `@types/react-dom`)
2. Change Vite config to handle JSX/TSX
3. Create `src/wallet/config.ts` — wagmi config (Section 3.1)
4. Create `src/wallet/useWallet.ts` — connect + auth hooks (Section 3.3)
5. Create `src/wallet/useSeedPurchase.ts` — RON payment hook (Section 4.1)
6. Create `src/components/WalletButton.tsx` — connect button UI
7. Wrap root in `WagmiProvider` + `QueryClientProvider`

The existing Three.js renderer (`src/renderer/`, `src/main3d.ts`) stays untouched. React handles the wallet/HUD layer; Three.js handles the canvas layer.

---

## 10. Open Questions for Implementer

| # | Question | Decision needed |
|---|---|---|
| Q1 | RON/USD price mechanism | Hardcode 3 RON testnet; use Chainlink oracle mainnet? |
| Q2 | Treasury wallet | ✅ Resolved: `0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199` (testnet treasury wallet, doubles as minter) |
| Q3 | Metadata image | Static PNG per species at mint, or rendered per tree state? |
| Q4 | `animation_url` | Serve the Three.js viewer from a separate origin? (needs Mavis allowlist) |
| Q5 | Care log hash cadence | How often does server push Merkle root on-chain? Per action vs daily batch? |
| Q6 | Minter private key storage | ✅ Resolved: Supabase secret (`MINTER_PRIVATE_KEY`) for testnet. Production: KMS TBD. |

---

## Sources

- [@sky-mavis/tanto-wagmi README](https://socket.dev/npm/package/@sky-mavis/tanto-wagmi) — v0.0.11 usage
- [Tanto Kit GitHub](https://github.com/skymavis/tanto-kit)
- [Ronin Network Info](https://docs.roninchain.com/developers/network/) — chain IDs, RPC URLs
- [Deploy with Hardhat | Ronin Docs](https://docs.roninchain.com/developers/smart-contracts/deploy)
- [Ronin Market Metadata Standards](https://docs.skymavis.com/mavis/ronin-market/reference/metadata)
- [List NFTs on Ronin Market](https://docs.skymavis.com/mavis/ronin-market/guides/list)
- [Ronin Faucet](https://faucet.roninchain.com/)
