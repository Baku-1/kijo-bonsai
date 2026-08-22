// ---------------------------------------------------------------------------
// useWallet -- thin abstraction over wagmi v2 account/connect/sign hooks.
// ---------------------------------------------------------------------------
import { useAccount, useConnect, useDisconnect, useSignTypedData } from 'wagmi';

export type WalletMode = 'guest' | 'connected';

// EIP-712 constants for Kijo wallet authentication.
// Must match wallet-auth Edge Function exactly.
// A3-1: chainId from VITE_RONIN_CHAIN_ID (202601 testnet, 2020 mainnet).
//        contract from VITE_KIJONSAI_CONTRACT_ADDRESS.
const KIJO_CONTRACT = (
  import.meta.env.VITE_KIJONSAI_CONTRACT_ADDRESS ??
  '0x4447F631F5868bFA03A6e6ae2D2da9f22c787E44'
) as `0x${string}`;

const KIJO_AUTH_TYPES = {
  KijoAuth: [
    { name: 'address', type: 'address' },
    { name: 'nonce',   type: 'string'  },
  ],
} as const;

export function useWallet() {
  const { address, isConnected, chain }      = useAccount();
  // connectAsync (not connect) -- connect() returns void; await would be misleading.
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnect }                          = useDisconnect();
  const { signTypedDataAsync }                  = useSignTypedData();

  const mode: WalletMode = isConnected ? 'connected' : 'guest';

  // Prefer the Ronin Wallet connector by connector id; fall back to first available.
  const roninConnector =
    connectors.find((c) => c.id === 'ronin') ?? connectors[0];

  async function connectWallet(): Promise<void> {
    if (!roninConnector) throw new Error('No Ronin connector found');
    await connectAsync({ connector: roninConnector });
  }

  // EIP-712 auth: server issues nonce, client signs with domain binding,
  // server verifies via verifyTypedData. Domain includes chainId to prevent
  // cross-chain signature replay (A3-1 mainnet blocker fix).
  async function authenticate(nonce: string): Promise<string> {
    if (!address) throw new Error('No wallet connected -- cannot authenticate');
    const chainId = chain?.id ?? (Number(import.meta.env.VITE_RONIN_CHAIN_ID || '202601'));
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
