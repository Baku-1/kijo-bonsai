// useWalletAuth — wallet-based Supabase authentication hook.
//
// Flow:
//   signIn():
//     1. Generate nonce = Date.now().toString()
//        Must be a millisecond timestamp — server validates within a 5-minute window.
//        Do NOT use crypto.randomUUID(): server rejects non-integer nonces.
//     2. useWallet().authenticate(nonce) → ECDSA signature via Ronin Wallet
//     3. POST { address, signature, nonce } to wallet-auth edge function
//     4. Store returned access_token in state; decode JWT payload to extract
//        walletRowId (user_metadata.wallet_row_id). No sig verification — the
//        server re-validates on every request. Fallback: data.user_id, which
//        mirrors seed-tree's own: user.user_metadata?.wallet_row_id ?? user.id
//
//   signOut(): clears accessToken + walletRowId + authError state.
//
//   accessToken: null until signIn() succeeds.
//     Consumers pass it to useSeedPurchase(accessToken, walletRowId).
//     CAVEAT: in-memory only — lost on page refresh. Production should persist
//     to sessionStorage or use Supabase setSession() for auto-refresh.
//
//   walletRowId: UUID of the wallets row, decoded from JWT user_metadata.
//     Null until signIn() succeeds. Used by seed-tree for ownership verification.
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
  const [walletRowId, setWalletRowId] = useState<string | null>(null);
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

      // Decode JWT payload client-side (no signature verification — informational
      // read; the server re-validates on every request). base64url → base64 fix
      // replaces "-" → "+" and "_" → "/" before atob. Fallback to data.user_id
      // mirrors seed-tree's own: user.user_metadata?.wallet_row_id ?? user.id
      try {
        const b64 = data.access_token
          .split(".")[1]
          .replace(/-/g, "+")
          .replace(/_/g, "/");
        // JWT segments are base64url without padding. atob() is lenient in
        // Chrome/Firefox but strict environments (Node, some Safaris) require
        // proper padding to a multiple of 4.
        const padded = b64.padEnd(b64.length + (4 - (b64.length % 4)) % 4, "=");
        const payload = JSON.parse(atob(padded));
        setWalletRowId(
          payload?.user_metadata?.wallet_row_id ?? data.user_id ?? null
        );
      } catch {
        // Malformed JWT — fall back to user_id from wallet-auth response.
        setWalletRowId(data.user_id ?? null);
      }
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
    setWalletRowId(null);
    setAuthError(null);
  }

  return { accessToken, walletRowId, isAuthenticating, authError, signIn, signOut };
}
