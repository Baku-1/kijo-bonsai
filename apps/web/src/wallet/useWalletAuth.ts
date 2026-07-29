// useWalletAuth — wallet-based Supabase authentication hook.
//
// Flow:
//   signIn():
//     1. Generate nonce = Date.now().toString()
//        Must be a millisecond timestamp — server validates within a 5-minute window.
//        Do NOT use crypto.randomUUID(): server rejects non-integer nonces.
//     2. useWallet().authenticate(nonce) → ECDSA signature via Ronin Wallet
//     3. POST { address, signature, nonce } to wallet-auth edge function
//     4. Store returned access_token in state
//
//   signOut(): clears accessToken + authError state.
//
//   accessToken: null until signIn() succeeds.
//     Consumers pass it to useSeedPurchase(accessToken).
//     CAVEAT: in-memory only — lost on page refresh. Production should persist
//     to sessionStorage or use Supabase setSession() for auto-refresh.
//
// Guards:
//   signIn() exits early with authError if no wallet is connected.

import { useState } from "react";
import { useWallet } from "./useWallet.js";

const WALLET_AUTH_URL =
  "https://xutjubkaskwchzyzwryk.supabase.co/functions/v1/wallet-auth";

export function useWalletAuth() {
  const { address, isConnected, authenticate } = useWallet();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  async function signIn(): Promise<void> {
    if (!isConnected || !address) {
      setAuthError("No wallet connected — connect your Ronin Wallet first");
      return;
    }

    setIsAuthenticating(true);
    setAuthError(null);

    try {
      // Nonce must be a timestamp — server validates within a 5-minute window.
      const nonce = Date.now().toString();
      const signature = await authenticate(nonce);

      const res = await fetch(WALLET_AUTH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature, nonce }),
      });

      const data: {
        access_token?: string;
        user_id?: string;
        error?: string;
      } = await res.json();

      if (!res.ok || !data.access_token) {
        throw new Error(data.error ?? "Authentication failed");
      }

      setAccessToken(data.access_token);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : "Authentication failed"
      );
    } finally {
      setIsAuthenticating(false);
    }
  }

  function signOut(): void {
    setAccessToken(null);
    setAuthError(null);
  }

  return { accessToken, isAuthenticating, authError, signIn, signOut };
}
