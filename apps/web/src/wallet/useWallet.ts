// ---------------------------------------------------------------------------
// useWallet — thin abstraction over wagmi v2 account/connect/sign hooks.
// ---------------------------------------------------------------------------
import { useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi';

export type WalletMode = 'guest' | 'connected';

export function useWallet() {
  const { address, isConnected, chain }      = useAccount();
  // connectAsync (not connect) — connect() returns void; await would be misleading.
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnect }                          = useDisconnect();
  const { signMessageAsync }                    = useSignMessage();

  const mode: WalletMode = isConnected ? 'connected' : 'guest';

  // Prefer the Ronin Wallet connector by connector id; fall back to first available.
  const roninConnector =
    connectors.find((c) => c.id === 'ronin') ?? connectors[0];

  async function connectWallet(): Promise<void> {
    if (!roninConnector) throw new Error('No Ronin connector found');
    await connectAsync({ connector: roninConnector });
  }

  // Nonce-based auth: server issues nonce, client signs, server verifies.
  async function authenticate(nonce: string): Promise<string> {
    if (!address) throw new Error('No wallet connected — cannot authenticate');
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
