// useListTrees — fetches all trees owned by the authenticated wallet.
//
// Parameters:
//   accessToken   — Supabase JWT from useWalletAuth. Null → no fetch.
//   _walletReady  — walletRowId from useWalletAuth (DC-2: renamed to signal
//                   it is NOT sent to the server — list-trees derives wallet
//                   identity from the JWT). Null → no fetch. Both args must
//                   be non-null before the first request fires.
//
// Refetch trigger: listens for the 'kijo:tree-created' DOM event dispatched
// by useSeedPurchase after a successful mint. This causes the hook to re-fetch
// so WalletTreeSelector sees the newly-minted tree and auto-selects it.
//
// Timeout: 10 s (matching loadCareLog in persistence.ts).
// No automatic retry — exposes error for the component to surface.

import { useEffect, useRef, useState } from "react";

const LIST_TREES_URL =
  "https://xutjubkaskwchzyzwryk.supabase.co/functions/v1/list-trees";

export interface TreeSummary {
  id: string;
  token_id: number | null;
  species: "hardwood" | "evergreen" | "tropical";
  current_day: number;
  born_at: string;
}

export function useListTrees(
  accessToken: string | null,
  // DC-2: renamed from walletRowId — NOT sent to the server. Acts as a fetch
  // gate only: the hook will not fetch until both args are non-null, which
  // aligns with the showPicker guard (BUG-1). Callers pass walletRowId so the
  // hook fires only when auth is fully established.
  _walletReady: string | null,
): {
  trees: TreeSummary[] | null;
  isLoading: boolean;
  error: string | null;
} {
  const [trees, setTrees] = useState<TreeSummary[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Counter incremented to force a re-fetch without changing accessToken/_walletReady.
  const [fetchTrigger, setFetchTrigger] = useState(0);

  // Track the latest abort controller so we can cancel inflight requests
  // when args change or the component unmounts.
  const abortRef = useRef<AbortController | null>(null);

  // Listen for kijo:tree-created dispatched by useSeedPurchase on successful mint.
  // Incrementing fetchTrigger causes the fetch effect to re-run.
  useEffect(() => {
    function onTreeCreated() {
      setFetchTrigger((t) => t + 1);
    }
    window.addEventListener("kijo:tree-created", onTreeCreated);
    return () => window.removeEventListener("kijo:tree-created", onTreeCreated);
  }, []);

  // Main fetch effect. Runs when auth args become available or fetchTrigger
  // increments (manual refetch via event).
  useEffect(() => {
    if (!accessToken || !_walletReady) {
      // Auth not yet established — reset to idle.
      setTrees(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Cancel any previous in-flight request.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // 10-second timeout, matching loadCareLog in persistence.ts.
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    setIsLoading(true);
    setError(null);

    const token = accessToken; // capture for closure

    (async () => {
      try {
        const res = await fetch(LIST_TREES_URL, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string }).error ?? `HTTP ${res.status}`
          );
        }

        const data = (await res.json()) as { trees: TreeSummary[] };
        setTrees(data.trees);
        setError(null);
      } catch (err) {
        if ((err as Error).name === "AbortError") return; // cancelled — ignore
        setError(
          err instanceof Error ? err.message : "Failed to load trees"
        );
        setTrees(null);
      } finally {
        clearTimeout(timeoutId);
        setIsLoading(false);
      }
    })();

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [accessToken, _walletReady, fetchTrigger]);

  return { trees, isLoading, error };
}
