// ---------------------------------------------------------------------------
// useSeedPurchase — RON payment hook (wagmi v2) + seed-claim wiring.
//
// Flow:
//   1. buySeeds(count) — validates args, checks auth token, sends RON on-chain.
//   2. useWaitForTransactionReceipt — polls until the tx is mined.
//   3. useEffect (receipt.status === 'success') — POSTs txHash + count to the
//      seed-claim Supabase Edge Function, which verifies payment on-chain and
//      mints the Kijonsai NFT.
//   4. Exposes isClaiming / claimResult / claimError for the modal to render
//      the appropriate spinner / success / error state.
//
// Auth: caller passes accessToken (Supabase JWT). When no token is available,
// buySeeds() throws before sending any RON. Pass null when the user is not
// yet signed in — the throw serves as the guard.
//
// txHash is tracked in local state so useWaitForTransactionReceipt activates
// as soon as sendTransactionAsync resolves, without the component needing to
// manage a separate hash state. txHash is also returned so StoreModal can
// display it immediately on confirmation.
// ---------------------------------------------------------------------------
import { useEffect, useRef, useState } from "react";
import { useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";

// Server-controlled treasury wallet that accepts RON payments.
const TREASURY = "0x68bd10cf714217eb9877b37812a548b801a94894" as `0x${string}`;

// Hardcoded testnet price; production should fetch from server at purchase time
// to avoid race conditions with RON/USD price fluctuation.
const SEED_PRICE_RON = "3"; // 3 RON per seed

const SEED_CLAIM_URL =
  "https://xutjubkaskwchzyzwryk.supabase.co/functions/v1/seed-claim";

export interface ClaimResult {
  tokenId: string;
  mintTxHash: string;
}

export function useSeedPurchase(accessToken: string | null = null) {
  // ── on-chain tx state ─────────────────────────────────────────────────────
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);

  // Count captured at buySeeds() call-time. Stored in a ref so the useEffect
  // closure always reads the latest value without needing count in its deps,
  // and without requiring an extra re-render when it changes.
  const pendingCountRef = useRef<number | undefined>(undefined);

  // Tracks which transactionHash has already triggered a claim. Stored in a
  // ref (not state) so updating it does NOT trigger a re-render — avoids the
  // effect cleanup / cancellation race that would keep isClaiming stuck true.
  const claimedForTxHashRef = useRef<string | undefined>(undefined);

  // ── claim state ───────────────────────────────────────────────────────────
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  // ── wagmi hooks ───────────────────────────────────────────────────────────
  const { sendTransactionAsync, isPending: isSending } = useSendTransaction();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    data: receipt,
  } = useWaitForTransactionReceipt({ hash: txHash });

  // ── claim effect ──────────────────────────────────────────────────────────
  // Fires on every render but exits early until all conditions are met:
  //   • receipt confirmed on-chain (status === 'success')
  //   • auth token present
  //   • count captured from buySeeds() call
  //   • not already claimed for this tx hash (replay guard)
  useEffect(() => {
    const txToCheck = receipt?.transactionHash;

    if (!receipt) return;

    if (receipt.status === "reverted") {
      setClaimError("Transaction reverted on-chain — no RON was charged.");
      return;
    }

    if (
      receipt.status !== "success" ||
      !txToCheck ||
      !accessToken ||
      pendingCountRef.current == null ||
      claimedForTxHashRef.current === txToCheck
    ) {
      return;
    }

    // Snapshot narrowed values before the async closure so TypeScript keeps
    // their types (function params can't be narrowed inside closures).
    const token: string = accessToken;
    const count: number = pendingCountRef.current;

    // Mark as in-flight immediately — prevents double-fire if the effect
    // re-runs (e.g. from the setClaimedForTxHash call below) while the
    // fetch is already in progress.
    claimedForTxHashRef.current = txToCheck;
    setIsClaiming(true);

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(SEED_CLAIM_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ txHash: txToCheck, count }),
        });

        const data: {
          ok?: boolean;
          tokenId?: string;
          mintTxHash?: string;
          error?: string;
        } = await res.json();

        if (cancelled) return;

        if (!res.ok || data.error || !data.tokenId || !data.mintTxHash) {
          setClaimError(data.error ?? "Claim failed — please contact support");
        } else {
          setClaimResult({
            tokenId: data.tokenId,
            mintTxHash: data.mintTxHash,
          });
        }
      } catch (err) {
        if (cancelled) return;
        setClaimError(
          err instanceof Error ? err.message : "Network error during claim"
        );
      } finally {
        if (!cancelled) setIsClaiming(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [receipt, accessToken]);

  // ── buySeeds ──────────────────────────────────────────────────────────────
  async function buySeeds(count: number = 1): Promise<`0x${string}`> {
    if (count < 1 || count > 10) throw new Error("Count must be 1–10");

    // Auth check before sending any RON — can't mint without a valid session.
    if (!accessToken) {
      throw new Error("Not authenticated — sign in before buying seeds");
    }

    // Reset claim state so a new purchase starts clean.
    setClaimResult(null);
    setClaimError(null);
    claimedForTxHashRef.current = undefined;
    setTxHash(undefined);
    pendingCountRef.current = count;

    // BigInt arithmetic only — no floating-point multiplication.
    // parseEther('3') * BigInt(2) = 6_000_000_000_000_000_000n (6 RON in wei).
    const value = parseEther(SEED_PRICE_RON) * BigInt(count);

    const hash = await sendTransactionAsync({ to: TREASURY, value });
    setTxHash(hash);

    return hash;
  }

  return {
    buySeeds,
    txHash, // exposed so modal can display it without duplicating state
    isSending, // wallet is prompting user
    isConfirming, // tx broadcast, waiting for block
    isConfirmed, // tx included in block
    receipt, // full TransactionReceipt when confirmed
    isClaiming, // POST to seed-claim in-flight
    claimResult, // { tokenId, mintTxHash } on success
    claimError, // error message if claim fails
  };
}
