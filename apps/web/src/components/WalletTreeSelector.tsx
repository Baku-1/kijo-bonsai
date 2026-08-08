// WalletTreeSelector — full-screen overlay shown after wallet auth when no
// tree is active (showPicker = true in App.tsx).
//
// Three states:
//   0 trees → prompt to buy first tree (calls props.onBuyMore)
//   1 tree  → auto-selects immediately via useEffect; component is transparent
//             to the user (overlay disappears as soon as the pick is confirmed)
//   2+ trees → picker grid; player taps a card to select
//
// DC-1: communicates up via callback props only (onTreeSelected, onBuyMore).
//       NO window CustomEvent is dispatched from this component. The
//       kijo:tree-created event is handled internally by useListTrees to
//       trigger a refetch after a mint; WalletTreeSelector surfaces the result
//       through its normal render logic.
//
// Rendered only when: isConnected && !!accessToken && !!walletRowId && !activeTreeId
// (App.tsx showPicker guard — BUG-1 fix). Both accessToken and walletRowId are
// guaranteed non-null by the time this component mounts.

import React, { useCallback, useEffect } from "react";
import { SESSION_KEY } from "../persistence.js";
import { useListTrees, type TreeSummary } from "../wallet/useListTrees.js";

interface WalletTreeSelectorProps {
  accessToken: string | null;
  // walletRowId is needed both as a fetch gate (_walletReady arg to useListTrees)
  // AND to write the full KijoSession to sessionStorage in selectTree().
  walletRowId: string | null;
  onTreeSelected: (treeId: string) => void;
  onBuyMore: () => void;
}

// Format born_at ISO timestamp to a short readable date (e.g. "Aug 6, 2026").
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

// Capitalise first letter (for species display).
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function WalletTreeSelector({
  accessToken,
  walletRowId,
  onTreeSelected,
  onBuyMore,
}: WalletTreeSelectorProps) {
  const { trees, isLoading, error } = useListTrees(
    accessToken ?? "",
    walletRowId ?? "",
  );

  // selectTree writes the session to sessionStorage then notifies parent via
  // callback prop (DC-1). Both fields non-null: enforced by showPicker guard.
  const selectTree = useCallback(
    (tree: TreeSummary) => {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          tree_id:       tree.id,
          access_token:  accessToken,
          wallet_row_id: walletRowId,
        }),
      );
      // Callback prop — idiomatic React for child→parent communication.
      // App.tsx sets activeTreeId, which remounts ThreeCanvas via key prop.
      onTreeSelected(tree.id);
    },
    [accessToken, walletRowId, onTreeSelected],
  );

  // Auto-select when exactly one tree is found (GAP-1: explicit dep on trees).
  // Fires whenever trees loads (async) or reloads (post-mint refetch).
  // Early returns prevent spurious invocations on loading (null) or multi-tree.
  useEffect(() => {
    if (trees === null) return;     // still loading — do nothing
    if (trees.length !== 1) return; // 0 or >1 trees — render logic handles it
    selectTree(trees[0]);
    // selectTree is stable (useCallback with stable deps). Adding it to the
    // dep array is correct here since it is memoised.
  }, [trees, selectTree]);

  // Safety guard — should not be reachable due to showPicker condition in App.
  // Placed AFTER all hooks to comply with React's Rules of Hooks.
  if (!accessToken || !walletRowId) return null;

  // Overlay wrapper shared by all non-picker states.
  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.75)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  };

  const panelStyle: React.CSSProperties = {
    background: "var(--panel)",
    border: "1px solid var(--edge)",
    borderRadius: 12,
    padding: 32,
    width: "min(92vw, 560px)",
    maxHeight: "85vh",
    overflowY: "auto",
    textAlign: "center",
  };

  // --- Loading / error / zero-trees states -----------------------------------

  if (isLoading || trees === null) {
    return (
      <div style={overlayStyle}>
        <div style={panelStyle}>
          <p style={{ color: "var(--muted, #888)", margin: 0 }}>
            Finding your kijonsai…
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={overlayStyle}>
        <div style={panelStyle}>
          <p style={{ color: "#B0542A", marginBottom: 12 }}>{error}</p>
          <p style={{ fontSize: 13, color: "var(--muted, #888)" }}>
            Check your connection and refresh the page to try again.
          </p>
        </div>
      </div>
    );
  }

  if (trees.length === 0) {
    return (
      <div style={overlayStyle}>
        <div style={panelStyle}>
          <h2 style={{ margin: "0 0 12px", fontSize: 22 }}>🌱 No kijonsai yet</h2>
          <p style={{ color: "var(--muted, #888)", marginBottom: 24, fontSize: 14 }}>
            You don't have any kijonsai trees yet. Plant your first one to begin.
          </p>
          <button className="primary" onClick={onBuyMore} style={{ width: "100%" }}>
            Plant your first kijonsai
          </button>
        </div>
      </div>
    );
  }

  // trees.length === 1: auto-select is in-flight (useEffect above). Show a
  // brief loading state so the overlay doesn't flash blank for one frame.
  if (trees.length === 1) {
    return (
      <div style={overlayStyle}>
        <div style={panelStyle}>
          <p style={{ color: "var(--muted, #888)", margin: 0 }}>
            Loading your kijonsai…
          </p>
        </div>
      </div>
    );
  }

  // --- Picker (2+ trees) -----------------------------------------------------

  return (
    <div style={overlayStyle}>
      <div style={{ ...panelStyle, textAlign: "left" }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>🌳 Choose a kijonsai</h2>
        <p style={{ color: "var(--muted, #888)", fontSize: 13, marginBottom: 20 }}>
          You have {trees.length} kijonsai. Select one to care for.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          {trees.map((tree) => (
            <button
              key={tree.id}
              type="button"
              onClick={() => selectTree(tree)}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--edge)",
                borderRadius: 10,
                padding: "14px 16px",
                textAlign: "left",
                cursor: "pointer",
                color: "var(--text, #fff)",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                {cap(tree.species)}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted, #888)", marginBottom: 2 }}>
                {tree.token_id != null ? `Token #${tree.token_id}` : "Legacy"}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted, #888)", marginBottom: 2 }}>
                Day {tree.current_day}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted, #888)" }}>
                Born {formatDate(tree.born_at)}
              </div>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 20, textAlign: "right" }}>
          <button onClick={onBuyMore} style={{ fontSize: 13 }}>
            + Buy more seeds
          </button>
        </div>
      </div>
    </div>
  );
}
