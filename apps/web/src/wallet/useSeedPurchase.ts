// ---------------------------------------------------------------------------
// useSeedPurchase — RON payment hook (wagmi v2) + seed-claim + seed-tree wiring.
//
// Flow:
//   1. buySeeds(count, species) — validates args, checks auth, captures a
//      random seed in pendingSeedRef, sends RON on-chain.
//   2. useWaitForTransactionReceipt — polls until the tx is mined.
//   3. useEffect (receipt.status === 'success') — POSTs txHash + count to the
//      seed-claim Supabase Edge Function, which verifies payment on-chain and
//      mints the Kijonsai NFT. Returns { tokenId, mintTxHash }.
//   4. Immediately after seed-claim succeeds, calls initTree() to POST to
//      seed-tree and create the trees DB row. Guarded by initedForTokenIdRef
//      (a Set) to prevent double-call on React StrictMode or effect re-fire.
//   5. Exposes isClaiming / claimResult / claimError / isInitingTree /
//      treeId / treeInitError for the modal to render appropriate states.
//      retryTreeInit() is exposed to allow a second attempt after failure.
//
// Auth: caller passes accessToken (Supabase JWT) and walletRowId (UUID from
// JWT user_metadata, decoded by useWalletAuth). When no token is available,
// buySeeds() throws before sending any RON. Pass null when the user is not
// yet signed in — the throw serves as the guard.
//
// Seed value: a random integer generated at buySeeds() call time via
// Math.random(). Each token gets a unique large number so tree growth patterns
// diverge across players. seed-claim does not return a seed value.
//
// txHash is tracked in local state so useWaitForTransactionReceipt activates
// as soon as sendTransactionAsync resolves, without the component needing to
// manage a separate hash state.
// ---------------------------------------------------------------------------
import { useEffect, useRef, useState } from "react";
import { useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { SESSION_KEY } from "../persistence.js";

// Server-controlled treasury wallet that accepts RON payments.
const TREASURY = "0x68bd10cf714217eb9877b37812a548b801a94894" as `0x${string}`;

// Hardcoded testnet price; production should fetch from server at purchase time
// to avoid race conditions with RON/USD price fluctuation.
const SEED_PRICE_RON = "3"; // 3 RON per seed

const SEED_CLAIM_URL =
  "https://xutjubkaskwchzyzwryk.supabase.co/functions/v1/seed-claim";

const SEED_TREE_URL =
  "https://xutjubkaskwchzyzwryk.supabase.co/functions/v1/seed-tree";

export type Species = "hardwood" | "evergreen" | "tropical";

export interface ClaimResult {
  tokenId: string;
  mintTxHash: string;
}

export function useSeedPurchase(
  accessToken: string | null = null,
  walletRowId: string | null = null,
) {
  // ── on-chain tx state ─────────────────────────────────────────────────────
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);

  // Values captured at buySeeds() call-time. Stored in refs so the useEffect
  // closure always reads the latest value without needing them in its deps,
  // and without requiring an extra re-render when they change.
  const pendingCountRef = useRef<number | undefined>(undefined);
  const pendingSpeciesRef = useRef<Species | undefined>(undefined);
  // Random integer seed — each purchase gets a unique large number so tree
  // growth patterns diverge across players (seed-claim does not supply one).
  const pendingSeedRef = useRef<number | undefined>(undefined);

  // Tracks which transactionHash has already triggered a claim. Stored in a
  // ref (not state) so updating it does NOT trigger a re-render — avoids the
  // effect cleanup / cancellation race that would keep isClaiming stuck true.
  const claimedForTxHashRef = useRef<string | undefined>(undefined);

  // Idempotency guard — Set of tokenIds for which initTree() has already been
  // called. Prevents double-insert on React StrictMode double-fire or effect
  // re-run. Cleared on each buySeeds() call (fresh purchase starts clean).
  // retryTreeInit() deletes the tokenId to allow exactly one more attempt.
  const initedForTokenIdRef = useRef<Set<string>>(new Set());

  // ── claim state ───────────────────────────────────────────────────────────
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  // ── tree init state ───────────────────────────────────────────────────────
  const [isInitingTree, setIsInitingTree] = useState(false);
  const [treeId, setTreeId] = useState<string | null>(null);
  const [treeInitError, setTreeInitError] = useState<string | null>(null);

  // ── wagmi hooks ───────────────────────────────────────────────────────────
  const { sendTransactionAsync, isPending: isSending } = useSendTransaction();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    data: receipt,
  } = useWaitForTransactionReceipt({ hash: txHash });

  // ── initTree ──────────────────────────────────────────────────────────────
  // POSTs to seed-tree to create the trees DB row. All inputs are passed as
  // arguments (not closed over from state) so the function can be safely
  // called from both the claim effect and retryTreeInit without stale values.
  async function initTree(
    token: string,
    wrid: string,
    species: Species,
    seed: number,
    tokenIdStr: string,
  ): Promise<void> {
    // Idempotency guard — do not call seed-tree twice for the same tokenId.
    if (initedForTokenIdRef.current.has(tokenIdStr)) return;
    initedForTokenIdRef.current.add(tokenIdStr);

    setIsInitingTree(true);
    setTreeInitError(null);

    try {
      const res = await fetch(SEED_TREE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          wallet_row_id: wrid,
          seed,
          species,
          has_spirit: true,
        }),
      });

      const data: { ok?: boolean; tree_id?: string; error?: string } =
        await res.json();

      if (res.ok && data.tree_id) {
        setTreeId(data.tree_id);
        // Write session so ThreeCanvas can find this tree on mount and persist
        // care actions. Overrides any prior session (one active tree per tab).
        sessionStorage.setItem(
          SESSION_KEY,
          JSON.stringify({
            tree_id: data.tree_id,
            access_token: token,
            wallet_row_id: wrid,
          }),
        );
      } else {
        const msg = data.error ?? "Tree setup failed";
        if (res.status === 401) {
          setTreeInitError("Session expired — sign in again before retrying");
        } else if (res.status === 403) {
          setTreeInitError("Auth mismatch — please contact support");
        } else {
          setTreeInitError(`${msg} — tap Retry Setup`);
        }
      }
    } catch (err) {
      // TypeError = network failure (DNS, CORS, offline). Anything else is
      // unexpected — show the actual message so support can diagnose it.
      const msg =
        err instanceof TypeError
          ? "Network error"
          : err instanceof Error
          ? err.message
          : "Request failed";
      setTreeInitError(`${msg} — tap Retry Setup`);
    } finally {
      setIsInitingTree(false);
    }
  }

  // ── retryTreeInit ──────────────────────────────────────────────────────────
  // Clears the idempotency guard for the current claimResult's tokenId and
  // runs initTree again. Resets treeInitError immediately (optimistic) so the
  // user sees the in-progress state while the retry is in flight.
  async function retryTreeInit(): Promise<void> {
    if (!claimResult) return;
    if (!accessToken || !walletRowId) {
      // Session expired between mint and retry — tell the user rather than
      // silently no-oping while the Retry button remains visible.
      setTreeInitError("Session expired — sign in again before retrying");
      return;
    }
    if (pendingSpeciesRef.current == null || pendingSeedRef.current == null)
      return;

    // Clear the guard so the next initTree call proceeds.
    initedForTokenIdRef.current.delete(claimResult.tokenId);

    await initTree(
      accessToken,
      walletRowId,
      pendingSpeciesRef.current,
      pendingSeedRef.current,
      claimResult.tokenId,
    );
  }

  // ── claim effect ──────────────────────────────────────────────────────────
  // Fires on every render but exits early until all conditions are met:
  //   • receipt confirmed on-chain (status === 'success')
  //   • auth token + walletRowId present
  //   • count, species, seed captured from buySeeds() call
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
      !walletRowId ||
      pendingCountRef.current == null ||
      pendingSpeciesRef.current == null ||
      pendingSeedRef.current == null ||
      claimedForTxHashRef.current === txToCheck
    ) {
      return;
    }

    // Snapshot narrowed values before the async closure so TypeScript keeps
    // their types (function params can't be narrowed inside closures).
    const token: string = accessToken;
    const wrid: string = walletRowId;
    const count: number = pendingCountRef.current;
    const species: Species = pendingSpeciesRef.current;
    const seed: number = pendingSeedRef.current;

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
          // NFT is minted — immediately create the trees DB row.
          // Runs unguarded by `cancelled` intentionally: the tree init should
          // complete even if the effect is cleaned up (e.g. StrictMode).
          // isBusy in StoreModal includes isInitingTree to block premature close.
          void initTree(token, wrid, species, seed, data.tokenId);
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
    // initTree is intentionally excluded from deps: all its dependencies are
    // passed as arguments captured in the snapshots above; the function
    // reference itself closes over only stable setter functions and module
    // constants.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt, accessToken, walletRowId]);

  // ── buySeeds ──────────────────────────────────────────────────────────────
  async function buySeeds(
    count: number,
    species: Species,
  ): Promise<`0x${string}`> {
    if (count < 1 || count > 10) throw new Error("Count must be 1–10");

    // Auth checks before sending any RON.
    if (!accessToken) {
      throw new Error("Not authenticated — sign in before buying seeds");
    }
    if (!walletRowId) {
      throw new Error(
        "Wallet row ID unavailable — sign out and sign in again",
      );
    }

    // Reset all state so a new purchase starts clean.
    setClaimResult(null);
    setClaimError(null);
    setTreeId(null);
    setTreeInitError(null);
    claimedForTxHashRef.current = undefined;
    initedForTokenIdRef.current.clear();
    setTxHash(undefined);
    pendingCountRef.current = count;
    pendingSpeciesRef.current = species;
    // Random seed per token — large integer so growth patterns diverge across
    // players. Math.random() is sufficient for testnet (aesthetic diversity,
    // not security). TODO(pre-mainnet): switch to crypto.getRandomValues for
    // a cryptographically uniform 32-bit seed: crypto.getRandomValues(new Uint32Array(1))[0]
    pendingSeedRef.current = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

    // BigInt arithmetic only — no floating-point multiplication.
    // parseEther('3') * BigInt(2) = 6_000_000_000_000_000_000n (6 RON in wei).
    const value = parseEther(SEED_PRICE_RON) * BigInt(count);

    const hash = await sendTransactionAsync({ to: TREASURY, value });
    setTxHash(hash);

    return hash;
  }

  return {
    buySeeds,
    retryTreeInit,
    txHash,         // exposed so modal can display it without duplicating state
    isSending,      // wallet is prompting user
    isConfirming,   // tx broadcast, waiting for block
    isConfirmed,    // tx included in block
    receipt,        // full TransactionReceipt when confirmed
    isClaiming,     // POST to seed-claim in-flight
    claimResult,    // { tokenId, mintTxHash } on success
    claimError,     // error message if claim fails
    isInitingTree,  // POST to seed-tree in-flight
    treeId,         // UUID of created tree row; null until seed-tree succeeds
    treeInitError,  // error message if seed-tree fails; null otherwise
  };
}
