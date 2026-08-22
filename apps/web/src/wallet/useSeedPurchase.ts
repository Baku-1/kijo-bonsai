// ---------------------------------------------------------------------------
// useSeedPurchase -- RON payment hook (wagmi v2) + seed-claim wiring (v2).
//
// Flow:
//   1. buySeeds(count, species) -- validates args, checks auth, optionally
//      silently refreshes the access token, captures the current care_log
//      from localStorage, then sends RON on-chain.
//   2. useWaitForTransactionReceipt -- polls until the tx is mined.
//   3. useEffect (receipt.status === 'success') -- POSTs txHash + count +
//      species + care_log to the seed-claim Edge Function (no seeds in body;
//      seeds are now CSPRNG-generated server-side). The function returns
//      seeds in the response for future client use.
//      seed-claim verifies payment, loops count mints, INSERTs one trees row per token,
//      and returns { v:2, ok, tokens:[{tokenId,treeId,mintTxHash,ok}], partial }.
//   4. On success, stores tokens[0].treeId in sessionStorage and clears
//      localStorage care_log (one-time guest->wallet conversion).
//      No seed-tree call -- treeId comes directly from seed-claim response.
//   5. Exposes isClaiming / claimResult / claimError for the modal.
//
// Auth: caller passes accessToken (Supabase JWT) and walletRowId (UUID from
// JWT user_metadata, decoded by useWalletAuth). When no token is available,
// buySeeds() throws before sending any RON.
//
// Seeds: generated server-side via crypto.getRandomValues in the seed-claim Edge Function.
// A5-1/A8-1: client no longer provides seeds (prevents precomputation attacks).
// The server includes seeds in the response; client may use data.seeds for local replay.
//
// care_log: extracted from localStorage at buySeeds() call time (before any
// RON is sent). Passed to seed-claim for first-token care log hand-off.
// Cleared from localStorage on successful response (one-time consumption).
// ---------------------------------------------------------------------------
import { useEffect, useRef, useState } from "react";
import { useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { SESSION_KEY } from "../persistence.js";

// Server-controlled treasury wallet that accepts RON payments.
const TREASURY = "0x68bd10cf714217eb9877b37812a548b801a94894" as `0x${string}`;

// Hardcoded testnet price; production should fetch from server at purchase time.
const SEED_PRICE_RON = "3"; // 3 RON per seed

const SEED_CLAIM_URL =
  "https://xutjubkaskwchzyzwryk.supabase.co/functions/v1/seed-claim";

export type Species = "hardwood" | "evergreen" | "tropical";

export interface SuccessfulToken {
  tokenId:    string;
  treeId:     string;      // guaranteed non-null in this interface
  mintTxHash: string | null;
}

export interface ClaimResult {
  tokens:  SuccessfulToken[];  // only confirmed, tree-linked tokens
  partial: boolean;            // true if some tokens in the batch failed
}

export function useSeedPurchase(
  accessToken: string | null = null,
  walletRowId: string | null = null,
  silentRefresh?: () => Promise<boolean>,
) {
  // -- on-chain tx state ----------------------------------------------------
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);

  // Values captured at buySeeds() call-time. Refs avoid re-render on change
  // and give the claim effect always-current values without dep-array churn.
  const pendingCountRef   = useRef<number | undefined>(undefined);
  const pendingSpeciesRef = useRef<Species | undefined>(undefined);
  // Guest care_log snapshot -- extracted before sending RON.
  const pendingCareLogRef = useRef<unknown[]>([]);

  // Tracks which transactionHash has already triggered a claim. Ref (not
  // state) so updating it does NOT trigger a re-render.
  const claimedForTxHashRef = useRef<string | undefined>(undefined);

  // -- claim state ----------------------------------------------------------
  const [isClaiming,  setIsClaiming]  = useState(false);
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);
  const [claimError,  setClaimError]  = useState<string | null>(null);

  // -- wagmi hooks ----------------------------------------------------------
  const { sendTransactionAsync, isPending: isSending } = useSendTransaction();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    data: receipt,
  } = useWaitForTransactionReceipt({ hash: txHash });

  // -- claim effect ---------------------------------------------------------
  // Fires on every render; exits early until all conditions are met.
  useEffect(() => {
    const txToCheck = receipt?.transactionHash;

    if (!receipt) return;

    if (receipt.status === "reverted") {
      setClaimError("Transaction reverted on-chain -- no RON was charged.");
      return;
    }

    if (
      receipt.status !== "success" ||
      !txToCheck ||
      !accessToken ||
      !walletRowId ||
      pendingCountRef.current == null ||
      pendingSpeciesRef.current == null ||
      claimedForTxHashRef.current === txToCheck
    ) {
      return;
    }

    // Snapshot narrowed values before the async closure.
    const token:   string  = accessToken;
    const wrid:    string  = walletRowId;
    const count:   number  = pendingCountRef.current;
    const species: Species = pendingSpeciesRef.current;
    const careLog: unknown[] = pendingCareLogRef.current.slice();

    // Mark as in-flight immediately -- prevents double-fire on re-render.
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
          body: JSON.stringify({
            txHash:     txToCheck,
            count,
            species,
            has_spirit: true,
            care_log:   careLog,
          }),
        });

        const data: {
          v?: number;
          ok?: boolean;
          seeds?: number[];          // A5-1: server-generated seeds (available for future use)
          tokens?: Array<{
            tokenId:    string;
            treeId:     string | null;
            mintTxHash: string | null;
            ok:         boolean;
            error?:     string;
          }>;
          partial?: boolean;
          replay?:  boolean;
          error?:   string;
        } = await res.json();

        if (cancelled) return;

        // Deploy-window safety: old server returned { tokenId } not { tokens }.
        if (!data.tokens) {
          setClaimError("Server updated -- please refresh the page");
          return;
        }

        if (!res.ok || data.error) {
          setClaimError(data.error ?? "Claim failed -- please contact support");
          return;
        }

        const successfulTokens = data.tokens.filter(
          (t) => t.ok && t.treeId != null
        ) as SuccessfulToken[];

        setClaimResult({
          tokens:  successfulTokens,
          partial: data.partial ?? false,
        });

        // Store session for first successful tree.
        // seed-claim created the rows -- no initTree / seed-tree call needed.
        if (successfulTokens.length > 0 && successfulTokens[0].treeId) {
          sessionStorage.setItem(
            SESSION_KEY,
            JSON.stringify({
              tree_id:       successfulTokens[0].treeId,
              access_token:  token,
              wallet_row_id: wrid,
            }),
          );
          // One-time care_log consumption (client-side responsibility).
          // Race 4 fix: localStorage must be cleared BEFORE dispatching so the
          // newly-mounted ThreeCanvas (triggered by the picker's onTreeSelected
          // callback) starts with a clean slate — no guest care_log, valid session.
          localStorage.removeItem("care_log");

          // Notify useListTrees (inside WalletTreeSelector) to re-fetch so the
          // newly-minted tree appears in the picker and is auto-selected.
          // useSeedPurchase is a hook (not a React component) with no prop path
          // to App state — the window CustomEvent is the correct mechanism here.
          // WalletTreeSelector uses callback props instead (DC-1).
          window.dispatchEvent(
            new CustomEvent("kijo:tree-created", {
              detail: { treeId: successfulTokens[0].treeId },
            }),
          );
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
  }, [receipt, accessToken, walletRowId]);

  // -- buySeeds -------------------------------------------------------------
  async function buySeeds(
    count: number,
    species: Species,
  ): Promise<`0x${string}`> {
    if (count < 1 || count > 10) throw new Error("Count must be 1-10");

    if (!accessToken) {
      throw new Error("Not authenticated -- sign in before buying seeds");
    }
    if (!walletRowId) {
      throw new Error(
        "Wallet row ID unavailable -- sign out and sign in again",
      );
    }

    // Reset all state so a new purchase starts clean.
    setClaimResult(null);
    setClaimError(null);
    claimedForTxHashRef.current = undefined;
    setTxHash(undefined);
    pendingCountRef.current   = count;
    pendingSpeciesRef.current = species;

    // Snapshot care_log BEFORE the RON send (purchase-time snapshot).
    try {
      const raw = localStorage.getItem("care_log");
      pendingCareLogRef.current = raw ? (JSON.parse(raw) as unknown[]) : [];
    } catch {
      pendingCareLogRef.current = [];
    }

    // A7-2: Non-fatal proactive refresh before committing RON to chain.
    // If token is near-expired, refresh silently so the claim step has a valid JWT.
    if (silentRefresh) {
      await silentRefresh().catch(() => { /* non-fatal -- claim step will 401 if expired */ });
    }

    // BigInt arithmetic only -- no floating-point multiplication.
    const value = parseEther(SEED_PRICE_RON) * BigInt(count);

    const hash = await sendTransactionAsync({ to: TREASURY, value });
    setTxHash(hash);

    return hash;
  }

  return {
    buySeeds,
    txHash,
    isSending,
    isConfirming,
    isConfirmed,
    receipt,
    isClaiming,
    claimResult,
    claimError,
  };
}
