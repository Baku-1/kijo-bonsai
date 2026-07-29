// ---------------------------------------------------------------------------
// StoreModal — Kijo item store. Opens when #btn-buy-seed is clicked.
//
// Replaces SeedShopModal.tsx. Preserves the same DOM-listener pattern for
// #btn-buy-seed so ThreeCanvas stays free of wallet/store state.
//
// Auth flow (same as SeedShopModal):
//   1. Wallet must be connected.
//   2. Wallet must be signed in via useWalletAuth.
//   3. Once authenticated, the Seed purchase button is active.
//
// Only Seed has a live purchase flow (useSeedPurchase → RON → NFT mint).
// All other items show "Coming soon" with a disabled button until wired.
// ---------------------------------------------------------------------------
import React, { useState, useEffect, useCallback } from "react";
import { useWallet } from "../wallet/useWallet.js";
import { useWalletAuth } from "../wallet/useWalletAuth.js";
import { useSeedPurchase } from "../wallet/useSeedPurchase.js";

type ItemId = "seed" | "shears" | "wire" | "fertilizer" | "twine" | "weights";

interface StoreItem {
  id: ItemId;
  name: string;
  category: string;
  icon: string;
  description: string;
  priceRon: number;
  live: boolean;
}

const STORE_ITEMS: StoreItem[] = [
  {
    id: "seed",
    name: "Seed",
    category: "Foundation",
    icon: "🌱",
    description: "Plant a new Kijonsai bonsai",
    priceRon: 3,
    live: true,
  },
  {
    id: "shears",
    name: "Shears",
    category: "Tools",
    icon: "✂️",
    description: "Prune branches to shape growth",
    priceRon: 1,
    live: false,
  },
  {
    id: "wire",
    name: "Wire",
    category: "Tools",
    icon: "🔧",
    description: "Train branches into position",
    priceRon: 1,
    live: false,
  },
  {
    id: "fertilizer",
    name: "Fertilizer",
    category: "Care",
    icon: "🌿",
    description: "Accelerate seasonal growth",
    priceRon: 1,
    live: false,
  },
  {
    id: "twine",
    name: "Twine",
    category: "Techniques",
    icon: "🪢",
    description: "Bind branches for directional training",
    priceRon: 1,
    live: false,
  },
  {
    id: "weights",
    name: "Weights",
    category: "Techniques",
    icon: "⚖️",
    description: "Apply downward pressure to branches",
    priceRon: 1,
    live: false,
  },
];

const DEFAULT_QUANTITIES: Record<ItemId, number> = {
  seed: 1,
  shears: 1,
  wire: 1,
  fertilizer: 1,
  twine: 1,
  weights: 1,
};

export function StoreModal() {
  const [open, setOpen] = useState(false);
  const [quantities, setQuantities] = useState<Record<ItemId, number>>(() => ({
    ...DEFAULT_QUANTITIES,
  }));
  const [seedError, setSeedError] = useState<string | null>(null);

  const { isConnected } = useWallet();
  const { accessToken, isAuthenticating, authError, signIn } = useWalletAuth();
  const {
    buySeeds,
    txHash,
    isSending,
    isConfirming,
    isConfirmed,
    isClaiming,
    claimResult,
    claimError,
  } = useSeedPurchase(accessToken);

  // Wire the Buy Seed button (rendered by ThreeCanvas) to open this modal.
  // Same pattern as SeedShopModal — keeps ThreeCanvas free of wallet state.
  useEffect(() => {
    const btn = document.getElementById("btn-buy-seed");
    if (!btn) return;
    const handler = () => setOpen(true);
    btn.addEventListener("click", handler);
    return () => btn.removeEventListener("click", handler);
  }, []);

  // isBusy: block close while the wallet is prompting, the on-chain tx is
  // confirming, or the claim POST is in-flight. Closing during isConfirming
  // would unmount useSeedPurchase and silently cancel the NFT claim.
  const isBusy = isSending || isConfirming || isClaiming;

  const handleClose = useCallback(function handleClose() {
    if (isBusy) return;
    setOpen(false);
    // Reset per-item quantities and local error so reopening starts fresh.
    setQuantities({ ...DEFAULT_QUANTITIES });
    setSeedError(null);
  }, [isBusy]);

  function setQty(id: ItemId, val: number) {
    setQuantities((q) => ({ ...q, [id]: Math.max(1, Math.min(10, val)) }));
  }

  async function handleBuySeed() {
    setSeedError(null);
    try {
      await buySeeds(quantities.seed);
    } catch (e) {
      setSeedError(e instanceof Error ? e.message : "Transaction failed");
    }
  }

  // Dismiss the modal on Escape when nothing is in-flight.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isBusy) {
        e.stopImmediatePropagation();
        handleClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, isBusy, handleClose]);

  if (!open) return null;

  const canBuy = isConnected && !!accessToken;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="store-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--edge)",
          borderRadius: 12,
          padding: 24,
          width: "min(92vw, 620px)",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <h2 id="store-modal-title" style={{ margin: 0, fontSize: 20 }}>🏪 Kijo Store</h2>
          <button
            onClick={handleClose}
            disabled={isBusy}
            aria-label="Close store"
            style={{
              background: "none",
              border: "none",
              fontSize: 22,
              lineHeight: 1,
              padding: "0 4px",
              cursor: isBusy ? "not-allowed" : "pointer",
              color: "var(--text, #fff)",
            }}
          >
            ×
          </button>
        </div>

        {/* ── Wallet not connected ── */}
        {!isConnected && (
          <p style={{ color: "#B0542A", marginBottom: 12, fontSize: 14 }}>
            Connect your Ronin Wallet first to purchase items.
          </p>
        )}

        {/* ── Connected but not authenticated ── */}
        {isConnected && !accessToken && (
          <div style={{ marginBottom: 16 }}>
            {authError && (
              <p style={{ color: "#B0542A", fontSize: 13, marginBottom: 8 }}>
                {authError}
              </p>
            )}
            <button
              className="primary"
              onClick={signIn}
              disabled={isAuthenticating}
              style={{ width: "100%" }}
            >
              {isAuthenticating ? "Signing in…" : "Sign in with Wallet"}
            </button>
            <p
              style={{
                fontSize: 12,
                color: "var(--muted, #888)",
                marginTop: 8,
              }}
            >
              Sign a message to verify your wallet before purchasing.
            </p>
          </div>
        )}

        {/* ── Item grid ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          {STORE_ITEMS.map((item) => {
            const qty = quantities[item.id];
            const isSeedCard = item.id === "seed";

            return (
              <div
                key={item.id}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--edge)",
                  borderRadius: 10,
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {/* Card title row */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 26 }}>{item.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>
                      {item.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--muted, #888)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {item.category}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--muted, #888)",
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  {item.description}
                </p>

                {/* Price */}
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {isSeedCard && qty > 1
                    ? `${item.priceRon} RON × ${qty} = ${
                        item.priceRon * qty
                      } RON`
                    : `${item.priceRon} RON`}
                </div>

                {/* Seed-only: transaction / claim status messages */}
                {isSeedCard && (
                  <>
                    {claimResult && (
                      <p style={{ color: "#5CAA50", fontSize: 13, margin: 0 }}>
                        ✅ Minted! Token #{claimResult.tokenId}
                        <br />
                        <small>
                          Mint TX: {claimResult.mintTxHash.slice(0, 10)}…
                        </small>
                      </p>
                    )}
                    {!claimResult && isClaiming && (
                      <p style={{ fontSize: 13, margin: 0 }}>
                        🌱 Minting your NFT…
                      </p>
                    )}
                    {!claimResult && !isClaiming && txHash && isConfirming && (
                      <p style={{ fontSize: 13, margin: 0 }}>
                        ⏳ Waiting for confirmation…
                      </p>
                    )}
                    {!claimResult &&
                      !isClaiming &&
                      txHash &&
                      isConfirmed &&
                      !isConfirming && (
                        <p style={{ fontSize: 13, margin: 0 }}>
                          ✅ Confirmed — claiming…
                        </p>
                      )}
                    {(claimError || seedError) && (
                      <p style={{ color: "#B0542A", fontSize: 13, margin: 0 }}>
                        {claimError ?? seedError}
                      </p>
                    )}
                  </>
                )}

                {/* Quantity selector + purchase button */}
                {/* Always rendered — buySeeds() resets claimResult on next purchase */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 4,
                  }}
                >
                  {/* Quantity selector — only shown for seed (the live item) */}
                  {isSeedCard && (
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={qty}
                      onChange={(e) => setQty(item.id, Number(e.target.value))}
                      disabled={!canBuy || isBusy}
                      aria-label="Seed quantity"
                      style={{ width: 52, opacity: canBuy ? 1 : 0.5 }}
                    />
                  )}

                  {item.live ? (
                    <button
                      className="primary"
                      onClick={handleBuySeed}
                      disabled={!canBuy || isBusy}
                      style={{ flex: 1 }}
                    >
                      {isSending
                        ? "Confirm in wallet…"
                        : isConfirming
                        ? "Confirming…"
                        : isClaiming
                        ? "Minting…"
                        : `Buy ${qty > 1 ? `${qty} ` : ""}Seed${
                            qty > 1 ? "s" : ""
                          }`}
                    </button>
                  ) : (
                    <button
                      disabled
                      title="Coming soon"
                      style={{
                        flex: 1,
                        opacity: 0.45,
                        cursor: "not-allowed",
                      }}
                    >
                      Coming soon
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Footer ── */}
        {!isBusy && (
          <div style={{ marginTop: 20, textAlign: "right" }}>
            <button onClick={handleClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
