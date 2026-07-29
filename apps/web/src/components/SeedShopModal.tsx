// DEPRECATED — replaced by StoreModal.tsx
// ---------------------------------------------------------------------------
// SeedShopModal — Buy seeds with RON. Opens when #btn-buy-seed is clicked.
//
// The modal wires to #btn-buy-seed (rendered by ThreeCanvas) via a DOM
// addEventListener in useEffect — keeps ThreeCanvas free of wallet state.
//
// Auth flow:
//   1. Wallet must be connected (shows "Connect your Ronin Wallet" if not).
//   2. Wallet must be signed in via useWalletAuth — shows "Sign in with Wallet"
//      button if connected but not yet authenticated.
//   3. Once authenticated, the Buy Seeds button is active.
//
// txHash is owned by useSeedPurchase (not duplicated here — arch Q4 fix).
// accessToken is owned by useWalletAuth and passed down to useSeedPurchase.
// ---------------------------------------------------------------------------
import React, { useState } from "react";
import { useWallet } from "../wallet/useWallet.js";
import { useWalletAuth } from "../wallet/useWalletAuth.js";
import { useSeedPurchase } from "../wallet/useSeedPurchase.js";

export function SeedShopModal() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const { isConnected } = useWallet();
  const { accessToken, isAuthenticating, authError, signIn } = useWalletAuth();
  const { buySeeds, txHash, isSending, isConfirming, isConfirmed } =
    useSeedPurchase(accessToken);

  // Wire the Buy Seed button (rendered by ThreeCanvas) to open this modal.
  React.useEffect(() => {
    const btn = document.getElementById("btn-buy-seed");
    if (!btn) return;
    const handler = () => setOpen(true);
    btn.addEventListener("click", handler);
    return () => btn.removeEventListener("click", handler);
  }, []);

  if (!open) return null;

  async function handleBuy() {
    setError(null);
    try {
      await buySeeds(count);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transaction failed");
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
      onClick={() => setOpen(false)}
    >
      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--edge)",
          borderRadius: 12,
          padding: 24,
          minWidth: 280,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>Buy Seeds</h2>

        {!isConnected && (
          <p style={{ color: "#B0542A" }}>Connect your Ronin Wallet first.</p>
        )}

        {isConnected && !accessToken && (
          <div>
            {authError && (
              <p style={{ color: "#B0542A", fontSize: 13 }}>{authError}</p>
            )}
            <button
              className="primary"
              onClick={signIn}
              disabled={isAuthenticating}
              style={{ width: "100%" }}
            >
              {isAuthenticating ? "Signing in…" : "Sign in with Wallet"}
            </button>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
              Sign a message to verify your wallet before purchasing.
            </p>
          </div>
        )}

        {isConnected && accessToken && (
          <>
            {isConfirmed ? (
              <p style={{ color: "#5CAA50" }}>
                ✅ Purchase confirmed!
                <br />
                <small>TX: {txHash?.slice(0, 10)}…</small>
              </p>
            ) : txHash ? (
              <p>
                ⏳{" "}
                {isConfirming
                  ? "Waiting for confirmation…"
                  : "Transaction sent…"}
              </p>
            ) : (
              <>
                <label>
                  Seeds (1–10):&nbsp;
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={count}
                    onChange={(e) =>
                      setCount(
                        Math.max(1, Math.min(10, Number(e.target.value)))
                      )
                    }
                    style={{ width: 60 }}
                  />
                </label>
                <p style={{ fontSize: 13, margin: "8px 0" }}>
                  Cost: {count * 3} RON
                </p>
                {error && (
                  <p style={{ color: "#B0542A", fontSize: 13 }}>{error}</p>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button
                    className="primary"
                    onClick={handleBuy}
                    disabled={isSending}
                  >
                    {isSending
                      ? "Confirm in wallet…"
                      : `Buy ${count} Seed${count > 1 ? "s" : ""}`}
                  </button>
                  <button onClick={() => setOpen(false)}>Cancel</button>
                </div>
              </>
            )}
          </>
        )}

        {!accessToken && (
          <div style={{ marginTop: 12, textAlign: "right" }}>
            <button onClick={() => setOpen(false)}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
