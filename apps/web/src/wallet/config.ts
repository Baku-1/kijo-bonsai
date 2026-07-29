// ---------------------------------------------------------------------------
// Wagmi / Tanto Kit config
//
// Chain imports come from @sky-mavis/tanto-connect (NOT viem/chains).
// viem/chains exports saigon.id = 2021 (dead pre-OP-Stack chain).
// tanto-connect@0.0.22 corrects it to 202601 (current Saigon testnet).
//
// Pin: @sky-mavis/tanto-connect@0.0.22 must be a direct dep in package.json
// so npm hoists it above the 0.0.21 version pulled by tanto-wagmi@0.0.11.
// ---------------------------------------------------------------------------
import { roninWallet, waypoint } from '@sky-mavis/tanto-wagmi';
import { ronin, saigon } from '@sky-mavis/tanto-connect'; // ← NOT viem/chains
import { createConfig, http } from 'wagmi';
import type { CreateConnectorFn } from '@wagmi/core'; // wagmi doesn't re-export this

// Waypoint connector is optional — only enabled when the client ID env var is
// set. Get a client ID from https://developers.roninchain.com/console/applications/
const waypointClientId = import.meta.env.VITE_WAYPOINT_CLIENT_ID ?? '';

// tanto-wagmi@0.0.11 was published before wagmi added the `withCapabilities`
// generic to CreateConnectorFn (the connector's connect() return type changed
// from `accounts: `0x${string}`[]` to a conditional readonly type). The cast
// is safe at runtime — the connector behaviour is unchanged; only the type
// declaration lags behind wagmi's current interface.
const connectors = [
  roninWallet(),
  ...(waypointClientId
    ? [waypoint({ clientId: waypointClientId, chainId: saigon.id })]
    : []),
] as unknown as readonly CreateConnectorFn[];

export const wagmiConfig = createConfig({
  chains: [saigon, ronin],          // saigon first = default network during dev
  transports: {
    [saigon.id]: http(),            // public RPC; swap for paid endpoint in prod
    [ronin.id]:  http(),
  },
  multiInjectedProviderDiscovery: false, // required — Ronin Wallet is not EIP-6963
  connectors,
});

// Re-export chains so components can reference IDs without importing tanto-connect.
export { ronin, saigon };
