# Kijo Phase 2 — React Migration + Tanto Kit Wallet Integration

**Date:** 2026-07-21  
**Author:** Architect pass  
**Status:** Implemented (2026-07-26) — UI-verified end-to-end on Saigon testnet  
**Scope:** React migration for `apps/web`, Tanto Kit wallet connect, RON seed purchase flow, wallet auth  
**Supersedes:** PHASE1-RONIN-ARCH.md §9 (React migration) + connector setup

---

## ⚠️ BREAKING CHANGES FROM PHASE1-RONIN-ARCH.md

Before reading the plan, note three corrections to the previous arch doc:

| Item | Old (Phase 1 doc) | Correct (verified 2026-07-21) |
|------|-------------------|-------------------------------|
| Chain imports | `import { ronin, saigon } from 'viem/chains'` | `import { ronin, saigon } from '@sky-mavis/tanto-connect'` |
| Saigon chain ID | 2021 | **202601** (OP Stack migration; fixed in tanto-connect@0.0.22, Feb 6 2026) |
| tanto-connect version | pulled transitively via tanto-wagmi@0.0.11 (gets @0.0.21, which has WRONG chain ID) | Must pin `@sky-mavis/tanto-connect@0.0.22` explicitly |

The `viem/chains` package exports `saigon` with chain ID 2021 (the pre-OP-Stack chain). Any code using that import will fail to connect on the current Saigon testnet.

---

## Research Summary

### Package State (as of 2026-07-21)

| Package | npm version | Notes |
|---------|-------------|-------|
| `@sky-mavis/tanto-wagmi` | `0.0.11` | Last published Jun 23 2025. Pins `tanto-connect@0.0.21` in its published package.json, which has the **wrong** Saigon chain ID. |
| `@sky-mavis/tanto-connect` | `0.0.22` | Released Feb 6 2026 — critical fix: Saigon chain ID 2021 → 202601. Chain defs for `ronin` and `saigon` now live here, not in viem. |
| `@sky-mavis/tanto-widget` | `0.0.6` | Drop-in React connect button (optional). Released Feb 6 2026 with same chain ID fix. |
| `wagmi` | peer `^2.x` | Wagmi v2 confirmed — not migrated to v3. |
| `viem` | peer `^2.x` | viem v2 confirmed. |
| `@sky-mavis/waypoint` | `4.1.4` | Waypoint SDK used internally by tanto-connect. |

### Key conclusion
`@sky-mavis/tanto-wagmi` has not been re-published since the chain ID fix landed in `tanto-connect@0.0.22`. The workaround is to **explicitly install `@sky-mavis/tanto-connect@0.0.22`** in `apps/web/package.json`; npm will hoist it above the version tanto-wagmi pins.

### Current `apps/web` state
- Plain Vite + TypeScript. No React. No JSX.
- Entry: `src/main.ts` — Three.js care client (full-screen canvas + vanilla DOM HUD)
- `src/ui/hud.ts` — `CareHud` class that writes to DOM elements by ID
- `src/renderer/`, `src/bridge/` — Three.js scene and engine bridge (UNTOUCHED)
- Multi-page: `index.html` (care client), `index2d.html`, `index3d.html`
- `index3d.html` (`main3d.ts`) runs standalone — LEAVE ENTIRELY ALONE

---

## A. React Migration for `apps/web`

### A.1 Strategy

React takes over the `index.html` page shell. Three.js mounts inside a React `useEffect` via a `useRef`. The existing engine/renderer/bridge code is **not modified** — only the wiring from HTML to those modules changes.

The other pages (`index2d.html`, `index3d.html`) are not touched.

### A.2 New Dependencies

```bash
# Run in apps/web/
npm install react react-dom @vitejs/plugin-react
npm install --save-dev @types/react @types/react-dom
```

Final `package.json` deps block (full, after both React + wallet installs):

```json
{
  "dependencies": {
    "@kijo/engine": "*",
    "@kijo/shared": "*",
    "@kijo/voxelizer": "*",
    "three": "^0.166.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@sky-mavis/tanto-wagmi": "^0.0.11",
    "@sky-mavis/tanto-connect": "0.0.22",
    "wagmi": "^2.14.0",
    "viem": "^2.21.0",
    "@tanstack/react-query": "^5.62.0"
  },
  "devDependencies": {
    "vite": "^5.4.0",
    "@vitejs/plugin-react": "^4.3.0",
    "@types/three": "^0.166.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0"
  }
}
```

### A.3 Vite Config Change

```typescript
// apps/web/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),    // React care client
        care2d: resolve(__dirname, 'index2d.html'), // unchanged
        care3d: resolve(__dirname, 'index3d.html'), // unchanged
      },
    },
  },
});
```

### A.4 `index.html` Change

Strip the HUD divs and page-links from the HTML — React renders them. Keep the CSS (it's pure CSS, React components will use the same class names). Add `<div id="root">`.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <title>Kijo — Bonsai Care</title>
  <!-- Inline CSS unchanged from current index.html — keep the full block -->
  <style>
    /* ... same :root vars, body reset, #scene-container, #hud-top, #hud-bottom,
       button styles, #page-links styles, @media query ... */
    /* ADD: wallet overlay styles */
    #wallet-bar {
      display: flex; align-items: center; gap: 10px; margin-left: auto;
    }
    .wallet-btn {
      font-size: 13px; padding: 6px 14px; min-height: 32px; min-width: auto;
      background: #EAF2E0; border-color: var(--accent);
    }
    .wallet-addr { font-size: 12px; font-family: monospace; opacity: 0.8; }
    .wallet-chain { font-size: 11px; opacity: 0.6; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

### A.5 `src/main.tsx` (replaces `src/main.ts`)

```tsx
// apps/web/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { wagmiConfig } from './wallet/config.js';
import { App } from './App.js';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </WagmiProvider>
);
```

### A.6 `src/App.tsx`

```tsx
// apps/web/src/App.tsx
import React from 'react';
import { ThreeCanvas } from './components/ThreeCanvas.js';
import { WalletBar } from './components/WalletBar.js';
import { SeedShopModal } from './components/SeedShopModal.js';

export function App() {
  return (
    <>
      {/* Three.js canvas — fills the page */}
      <ThreeCanvas />

      {/* Wallet bar replaces the static WalletButton in hud-top */}
      {/* ThreeCanvas renders #hud-top via the existing CareHud class, */}
      {/* so WalletBar is injected into that same div via a portal */}
      <WalletBar />

      {/* Seed purchase modal — hidden until user clicks "Buy Seed" */}
      <SeedShopModal />

      {/* Nav links preserved */}
      <nav id="page-links">
        <a href="/index3d.html">voxel view</a>
        <a href="/index2d.html">2d debug</a>
      </nav>
    </>
  );
}
```

### A.7 `src/components/ThreeCanvas.tsx`

This component mounts the existing Three.js code inside a `useEffect`. The `CareHud` class still writes to DOM elements by ID — those elements are rendered by this component's JSX.

```tsx
// apps/web/src/components/ThreeCanvas.tsx
import React, { useEffect, useRef } from 'react';
import { BonsaiTree } from '@kijo/engine';
import type { SpeciesClass } from '@kijo/shared';
import { createScene } from '../renderer/scene.js';
import { buildTreeMesh } from '../renderer/tree_mesh.js';
import { CareBridge } from '../bridge/care_bridge.js';
import { CareHud } from '../ui/hud.js';

export function ThreeCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !containerRef.current) return;
    initialized.current = true;

    const params = new URLSearchParams(location.search);
    const seed = Number(params.get('seed')) || 464497;
    const speciesParam = params.get('species');
    const species: SpeciesClass =
      speciesParam === 'evergreen' || speciesParam === 'tropical'
        ? speciesParam
        : 'hardwood';

    const tree = new BonsaiTree(seed, species);
    const careScene = createScene(containerRef.current!);

    function livingBranchCount() {
      return tree.getBranches().filter((b) => !b.pruned).length;
    }
    function refreshView() {
      if (tree.isDirty()) {
        buildTreeMesh(careScene.treeRoot, tree);
        tree.clearDirty();
      }
      hud.update(tree, livingBranchCount());
    }

    const bridge = new CareBridge(tree, refreshView);
    const hud = new CareHud({
      onWater: () => bridge.water(),
      onNextDay: () => bridge.nextDay(),
      onToggleAuto: () => bridge.toggleAuto(),
    });

    buildTreeMesh(careScene.treeRoot, tree);
    hud.update(tree, livingBranchCount());
    console.log(`[kijo-care] boot seed=${seed} species=${species}`);

    let animId: number;
    function animate() {
      animId = requestAnimationFrame(animate);
      careScene.controls.update();
      careScene.renderer.render(careScene.scene, careScene.camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(animId);
      careScene.renderer.dispose();
    };
  }, []);

  return (
    <>
      {/* Three.js canvas target */}
      <div id="scene-container" ref={containerRef} />

      {/* HUD — same structure as original index.html; CareHud writes to these IDs */}
      <div id="hud-top">
        <h1>Kijonsai</h1>
        <div className="stat">💧 <div className="bar"><div id="moisture-fill" /></div></div>
        <div className="stat">🌱 <div className="bar"><div id="health-fill" /></div></div>
        <div className="stat" id="day-label">Day 0</div>
        <div className="stat" id="season-label">Spring</div>
        <div id="warning" />
        {/* WalletBar mounts here via React portal — see WalletBar.tsx */}
        <div id="wallet-bar-anchor" />
      </div>

      <div id="hud-bottom">
        <div id="buttons">
          <button id="btn-water">💧 Water</button>
          <button id="btn-next-day" className="primary">☀️ Next Day</button>
          <button id="btn-auto">▶ Auto</button>
          <button id="btn-buy-seed" className="primary">🌱 Buy Seed</button>
        </div>
        <div id="info-line">Seed #— · — branches · —</div>
      </div>
    </>
  );
}
```

**Why `initialized.current`?** React StrictMode calls effects twice in dev. The guard prevents double-mounting the Three.js scene.

---

## B. Tanto Kit / Ronin Wallet Connect

### B.1 Correct Install Command

```bash
# Run in apps/web/
npm install @sky-mavis/tanto-wagmi @sky-mavis/tanto-connect@0.0.22 wagmi viem @tanstack/react-query
```

`@sky-mavis/tanto-connect@0.0.22` must be pinned explicitly because:
- `tanto-wagmi@0.0.11` (published Jun 23 2025) pulls `tanto-connect@0.0.21`, which exports `saigon.id = 2021`
- `tanto-connect@0.0.22` (Feb 6 2026) corrects it to `saigon.id = 202601`
- npm hoisting will use the highest satisfying version if we list it as a direct dep

### B.2 Wagmi Config

```typescript
// apps/web/src/wallet/config.ts
import { roninWallet, waypoint } from '@sky-mavis/tanto-wagmi';
import { ronin, saigon } from '@sky-mavis/tanto-connect'; // ← NOT viem/chains
import { createConfig, http } from 'wagmi';

// Waypoint is optional for Phase 1; include it now so the connector list is
// future-proof. Requires a clientId from https://developers.roninchain.com
// Set VITE_WAYPOINT_CLIENT_ID in .env (empty string disables Waypoint connector)
const waypointClientId = import.meta.env.VITE_WAYPOINT_CLIENT_ID ?? '';

const connectors = [
  roninWallet(),
  ...(waypointClientId
    ? [waypoint({ clientId: waypointClientId, chainId: saigon.id })]
    : []),
];

export const wagmiConfig = createConfig({
  chains: [saigon, ronin],          // saigon first = default network during dev
  transports: {
    [saigon.id]: http(),             // public RPC; swap for paid endpoint in prod
    [ronin.id]:  http(),
  },
  multiInjectedProviderDiscovery: false, // required — Ronin Wallet is not EIP-6963
  connectors,
});
```

**Chain ID reference (confirmed from tanto-connect@0.0.22):**
- Saigon testnet: `202601` (post-OP-Stack; old value `2021` is dead)
- Ronin mainnet: `2020` (unchanged)

### B.3 Wallet Hook

```typescript
// apps/web/src/wallet/useWallet.ts
import { useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi';

export type WalletMode = 'guest' | 'connected';

export function useWallet() {
  const { address, isConnected, chain }  = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect }                    = useDisconnect();
  const { signMessageAsync }              = useSignMessage();

  const mode: WalletMode = isConnected ? 'connected' : 'guest';

  // Prefer Ronin Wallet connector (index 0); fall back to first available
  const roninConnector = connectors.find((c) => c.id === 'ronin') ?? connectors[0];

  async function connectWallet() {
    if (!roninConnector) throw new Error('No Ronin connector found');
    await connect({ connector: roninConnector });
  }

  // Nonce-based auth: server issues nonce, client signs, server verifies
  async function authenticate(nonce: string): Promise<string> {
    const message = `Kijo authentication\nAddress: ${address}\nNonce: ${nonce}`;
    return signMessageAsync({ message });
  }

  return {
    address,
    isConnected,
    mode,
    chain,
    connectors,
    isPending,
    connectWallet,
    disconnect,
    authenticate,
  };
}
```

**Guest vs wallet mode detection:**
- `mode === 'guest'` → no address, no chain — show "Connect Wallet" button
- `mode === 'connected'` → `address` and `chain` are populated — show truncated address + disconnect

### B.4 WalletBar Component

```tsx
// apps/web/src/components/WalletBar.tsx
import React from 'react';
import ReactDOM from 'react-dom';
import { useWallet } from '../wallet/useWallet.js';

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function WalletBarContent() {
  const { address, isConnected, chain, isPending, connectWallet, disconnect } = useWallet();

  if (!isConnected) {
    return (
      <div id="wallet-bar">
        <button
          className="wallet-btn"
          onClick={connectWallet}
          disabled={isPending}
        >
          {isPending ? 'Connecting…' : '🔗 Connect Wallet'}
        </button>
      </div>
    );
  }

  return (
    <div id="wallet-bar">
      <span className="wallet-chain">{chain?.name ?? 'Unknown chain'}</span>
      <span className="wallet-addr">{truncate(address!)}</span>
      <button className="wallet-btn" onClick={() => disconnect()}>
        Disconnect
      </button>
    </div>
  );
}

// Mount into the #wallet-bar-anchor div inside ThreeCanvas's HUD
export function WalletBar() {
  const anchor = typeof document !== 'undefined'
    ? document.getElementById('wallet-bar-anchor')
    : null;

  if (!anchor) return null;
  return ReactDOM.createPortal(<WalletBarContent />, anchor);
}
```

**Why a portal?** `ThreeCanvas` renders the HUD DOM structure synchronously, but `App` renders `WalletBar` as a sibling. The portal lets `WalletBar` appear inside `#hud-top` without `ThreeCanvas` knowing about wallet state. Clean separation of concerns.

### B.5 Chain Mismatch Guard

If the user's wallet is on the wrong chain, wagmi's `useAccount().chain` will be `undefined` or not match `saigon.id`/`ronin.id`. Surface this in `WalletBar`:

```tsx
// Add to WalletBarContent after isConnected check
const isWrongChain = isConnected && chain?.id !== saigon.id && chain?.id !== ronin.id;
if (isWrongChain) {
  return (
    <div id="wallet-bar">
      <span style={{ color: '#B0542A' }}>Wrong network</span>
      <button className="wallet-btn" onClick={() => disconnect()}>Disconnect</button>
    </div>
  );
}
```

---

## B.6 `useWalletAuth` Hook (implemented 2026-07-26)

This hook was NOT in the original architect plan — it was added during implementation to provide Supabase JWT authentication for wallet-connected users. The `wallet-auth` Edge Function (verify_jwt: false) is the auth bootstrapping endpoint.

```typescript
// apps/web/src/wallet/useWalletAuth.ts
// Runtime: React (browser)

export function useWalletAuth() {
  const accessTokenRef = useRef<string | null>(null); // stored in memory only (not localStorage)
  const [isAuthed, setIsAuthed] = useState(false);

  async function authenticate(address: `0x${string}`, signMessage: (msg: string) => Promise<string>): Promise<string> {
    // 1. Generate nonce (timestamp-based, within 5-minute window)
    const nonce = Math.floor(Date.now() / 1000).toString();
    const message = `Kijo authentication\nAddress: ${address}\nNonce: ${nonce}`;

    // 2. Sign with Ronin wallet
    const signature = await signMessage(message);

    // 3. POST to wallet-auth Edge Function (no JWT required -- bootstrapping endpoint)
    const res = await fetch(`${SUPABASE_URL}/functions/v1/wallet-auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, signature, nonce }),
    });
    if (!res.ok) throw new Error('wallet-auth failed');

    const { access_token } = await res.json();
    accessTokenRef.current = access_token;
    setIsAuthed(true);
    return access_token;
  }

  function getToken(): string | null {
    return accessTokenRef.current;
  }

  return { authenticate, getToken, isAuthed };
}
```

**Key decisions:**
- `verify_jwt: false` on wallet-auth is **permanent and required** — it cannot have JWT verification because the user has no JWT yet.
- Nonce is timestamp-based (Unix seconds). Server rejects nonces older than 5 minutes. Single-use nonce table is Phase 2 hardening.
- Token stored in a React ref (memory), not localStorage — prevents XSS exposure. User re-authenticates on page reload.

---

## C. RON Payment Flow (Seed Purchase)

### C.1 `useSeedPurchase` Hook (implemented 2026-07-26 — wired to seed-claim Edge Function)

> **Note:** The implementation below is the ARCHITECT PLAN stub. The actual shipped version additionally: (a) accepts an `accessToken` parameter (JWT from useWalletAuth), (b) POSTs `{ txHash, count }` to the `seed-claim` Edge Function after waiting for the RON receipt, (c) returns `{ claimResult, isClaiming, claimError }` instead of the stub's `{ buySeeds, isSending, isConfirming, isConfirmed, receipt }`. The seed-claim Edge Function verifies the RON payment on-chain, enforces replay-guard via `seed_claims` table, and calls `mintKijonsai` on-chain.

```typescript
// apps/web/src/wallet/useSeedPurchase.ts
import { useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';

// Server-controlled treasury wallet that accepts RON payments
// Replace with real address before testnet testing
const TREASURY = '0xYOUR_TREASURY_ADDRESS' as `0x${string}`;

// Hardcoded testnet price; production should fetch from server at purchase time
// to avoid race conditions with RON/USD fluctuation
const SEED_PRICE_RON = '3'; // 3 RON per seed

export function useSeedPurchase() {
  const { sendTransactionAsync, isPending: isSending } = useSendTransaction();
  const { data: txHash, reset } = { data: undefined as `0x${string}` | undefined, reset: () => {} };

  // waitForTransactionReceipt is called post-send with the txHash
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    data: receipt,
  } = useWaitForTransactionReceipt({ hash: txHash });

  async function buySeeds(count: number = 1): Promise<`0x${string}`> {
    if (count < 1 || count > 10) throw new Error('Count must be 1–10');

    // Use BigInt arithmetic — no floating point
    const value = parseEther(SEED_PRICE_RON) * BigInt(count);

    const hash = await sendTransactionAsync({ to: TREASURY, value });
    // POST hash to server: POST /api/seeds/claim { txHash: hash, count }
    // Server verifies on-chain, mints NFTs, returns { tokenIds, seeds }
    return hash;
  }

  return {
    buySeeds,
    isSending,     // wallet is prompting user
    isConfirming,  // tx broadcast, waiting for block
    isConfirmed,   // tx included in block
    receipt,       // full TransactionReceipt when confirmed
  };
}
```

**Price math:** `parseEther('3') * BigInt(2)` = `6000000000000000000n` (6 RON in wei). Never multiply a float by count — use BigInt × BigInt.

### C.2 `SeedShopModal` Component

```tsx
// apps/web/src/components/SeedShopModal.tsx
import React, { useState } from 'react';
import { useWallet } from '../wallet/useWallet.js';
import { useSeedPurchase } from '../wallet/useSeedPurchase.js';

export function SeedShopModal() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(1);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { isConnected } = useWallet();
  const { buySeeds, isSending, isConfirming, isConfirmed } = useSeedPurchase();

  // Wire the Buy Seed button in ThreeCanvas HUD to open this modal
  React.useEffect(() => {
    const btn = document.getElementById('btn-buy-seed');
    if (!btn) return;
    const handler = () => setOpen(true);
    btn.addEventListener('click', handler);
    return () => btn.removeEventListener('click', handler);
  }, []);

  if (!open) return null;

  async function handleBuy() {
    setError(null);
    try {
      const hash = await buySeeds(count);
      setTxHash(hash);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transaction failed');
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={() => setOpen(false)}
    >
      <div
        style={{ background: 'var(--panel)', border: '1px solid var(--edge)', borderRadius: 12, padding: 24, minWidth: 280 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>Buy Seeds</h2>

        {!isConnected && (
          <p style={{ color: '#B0542A' }}>Connect your Ronin Wallet first.</p>
        )}

        {isConfirmed ? (
          <p style={{ color: '#5CAA50' }}>
            ✅ Purchase confirmed!<br />
            <small>TX: {txHash?.slice(0, 10)}…</small>
          </p>
        ) : txHash ? (
          <p>⏳ {isConfirming ? 'Waiting for confirmation…' : 'Transaction sent…'}</p>
        ) : (
          <>
            <label>
              Seeds (1–10):&nbsp;
              <input
                type="number" min={1} max={10} value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(10, Number(e.target.value))))}
                style={{ width: 60 }}
              />
            </label>
            <p style={{ fontSize: 13, margin: '8px 0' }}>
              Cost: {count * 3} RON (≈ ${count * 3} USD)
            </p>
            {error && <p style={{ color: '#B0542A', fontSize: 13 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                className="primary"
                onClick={handleBuy}
                disabled={!isConnected || isSending}
              >
                {isSending ? 'Confirm in wallet…' : `Buy ${count} Seed${count > 1 ? 's' : ''}`}
              </button>
              <button onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

### C.3 Transaction Lifecycle States

| State | `isSending` | `isConfirming` | `isConfirmed` |
|-------|-------------|----------------|---------------|
| Idle | false | false | false |
| Wallet prompting | **true** | false | false |
| Tx broadcast | false | **true** | false |
| Included in block | false | false | **true** |
| Error | false | false | false (+ error thrown) |

---

## D. File-by-File Change List

### D.1 Files to CREATE

```
apps/web/src/main.tsx              ← New React entry point
apps/web/src/App.tsx               ← App shell (WagmiProvider already at main.tsx)
apps/web/src/components/
  ThreeCanvas.tsx                  ← Mounts Three.js inside useEffect + renders HUD
  WalletBar.tsx                    ← Connect/disconnect UI (portal into #hud-top)
  SeedShopModal.tsx                ← Buy seeds modal
apps/web/src/wallet/
  config.ts                        ← Wagmi config (ronin+saigon from tanto-connect)
  useWallet.ts                     ← Connect, disconnect, sign hooks
  useSeedPurchase.ts               ← RON transfer + receipt polling
```

### D.2 Files to MODIFY

| File | What changes |
|------|--------------|
| `apps/web/package.json` | Add `react`, `react-dom`, `@sky-mavis/tanto-wagmi`, `@sky-mavis/tanto-connect@0.0.22`, `wagmi`, `viem`, `@tanstack/react-query`; add `@vitejs/plugin-react`, `@types/react`, `@types/react-dom` to devDeps |
| `apps/web/vite.config.ts` | Add `react()` plugin import and usage |
| `apps/web/index.html` | Replace `<div id="scene-container">` + HUD divs with `<div id="root">`; change script src to `main.tsx`; keep CSS block; add `#wallet-bar` CSS |
| `apps/web/tsconfig.json` | Add `"jsx": "react-jsx"` and `"jsxImportSource": "react"` to compilerOptions |

### D.3 Files to DELETE

```
apps/web/src/main.ts   ← Replaced by main.tsx
```

### D.4 Files UNTOUCHED (preserved)

```
apps/web/src/renderer/scene.ts
apps/web/src/renderer/tree_mesh.ts
apps/web/src/bridge/care_bridge.ts
apps/web/src/ui/hud.ts             ← CareHud class still writes to DOM IDs; ThreeCanvas renders those IDs
apps/web/src/main3d.ts
apps/web/index2d.html
apps/web/index3d.html
apps/web/src/main2d.ts
```

---

## E. TypeScript Config Change

```json
// apps/web/tsconfig.json — add to compilerOptions:
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true
    // ... existing options unchanged
  }
}
```

---

## F. Environment Variables

Create `apps/web/.env.local` (gitignored):

```bash
# Required only if enabling Waypoint connector
# Get from: https://developers.roninchain.com/console/applications/
VITE_WAYPOINT_CLIENT_ID=

# Optional: treasury address override (defaults to hardcoded in useSeedPurchase)
VITE_TREASURY_ADDRESS=0xYOUR_TREASURY_ADDRESS
```

---

## G. Implementation Order (for implementer)

1. `package.json` — add deps, run `npm install`
2. `tsconfig.json` — add jsx settings
3. `vite.config.ts` — add React plugin
4. `apps/web/src/wallet/config.ts` — wagmi config (validates chains import works)
5. `apps/web/src/wallet/useWallet.ts`
6. `apps/web/src/wallet/useSeedPurchase.ts`
7. `apps/web/src/components/ThreeCanvas.tsx` — ported from main.ts logic
8. `apps/web/src/components/WalletBar.tsx`
9. `apps/web/src/components/SeedShopModal.tsx`
10. `apps/web/src/App.tsx`
11. `apps/web/src/main.tsx`
12. `apps/web/index.html` — replace HUD with `<div id="root">`
13. Delete `apps/web/src/main.ts`
14. `npm run dev` — verify Three.js boots, wallet button appears, seed modal opens

**Verification steps:**
- `npm run typecheck` — zero errors
- `npm run dev` → open `http://localhost:5173` → Three.js scene renders
- Click "Connect Wallet" → Ronin Wallet extension prompts
- After connect: address appears in HUD bar, chain shows "Saigon" (id 202601)
- Click "Buy Seed" → modal opens, count picker works
- Cancel transaction → modal closes cleanly
- `index3d.html` and `index2d.html` still load independently (no React)

---

## H. Open Questions for Critic

| # | Question | Impact |
|---|----------|--------|
| Q1 | Should `WalletBar` be a portal or should `ThreeCanvas` accept `children`? Portal is clean but unusual for this codebase size. | Architecture |
| Q2 | `CareHud` writes to DOM by ID from inside `useEffect` — is there a React-side render race where `ThreeCanvas` JSX hasn't committed before Three.js starts? (Answer: no, `useEffect` fires *after* DOM paint, so `#moisture-fill` etc. exist.) | Correctness |
| Q3 | `@tanstack/react-query` v5 requires `QueryClientProvider` above all hooks — is the current nesting order correct? (WagmiProvider → QueryClientProvider → App) Wagmi v2 docs show QueryClient *inside* WagmiProvider. | Correctness |
| Q4 | The `useSeedPurchase` hook has a stale `txHash` pattern — `useWaitForTransactionReceipt` won't activate until `txHash` is set. Implementer should use local state for the hash, not destructure from hook. Shown correctly in the code above but worth flagging. | Correctness |
| Q5 | `tanto-wagmi@0.0.11` + `tanto-connect@0.0.22` — npm may not honor the override if workspace uses `npm@<7`. Confirm npm version in the monorepo. | Compatibility |
| Q6 | Is a WalletConnect QR-code connector needed (for mobile Ronin Wallet app without extension)? The `@sky-mavis/tanto-connect` README shows `requestRoninWalletConnectConnector` exists. Phase 2 scope is extension-only; WC is Phase 3. | Scope |

---

## Sources

- [skymavis/tanto-kit GitHub](https://github.com/skymavis/tanto-kit) — packages/wagmi README, packages/connect README, package.json files
- [tanto-connect/0.0.22 release](https://github.com/skymavis/tanto-kit/releases/tag/tanto-connect%2F0.0.22) — "fix: change saigon chainId (#72)"
- [tanto-widget/0.0.6 release](https://github.com/skymavis/tanto-kit/releases/tag/tanto-widget%2F0.0.6) — same fix, Feb 6 2026
- [Sky Mavis Ronin Waypoint Web SDK docs](https://docs.skymavis.com/mavis/ronin-waypoint/reference/web-sdk)
- [PHASE1-RONIN-ARCH.md](./PHASE1-RONIN-ARCH.md) — chain IDs (§1), wagmi config pattern (§3.1), seed purchase (§4), provider nesting (§3.2)
