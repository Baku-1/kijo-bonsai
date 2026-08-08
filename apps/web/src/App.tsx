// ---------------------------------------------------------------------------
// App — root component. Wagmi + React Query providers are above this in
// main.tsx. App composes the Three.js canvas, wallet bar, tree picker,
// and store modal.
//
// Auth is lifted here (single useWalletAuth instance) so that both
// WalletTreeSelector and StoreModal receive auth props — eliminating the
// duplicate hook instance that previously lived in StoreModal.
//
// activeTreeId drives ThreeCanvas remounting via the key prop.
// Initialised from sessionStorage so a page reload with an existing session
// immediately shows the tree without the picker.
//
// storeOpen is controlled here so WalletTreeSelector can open the store
// (via onBuyMore callback) without importing StoreModal.
// ---------------------------------------------------------------------------
import React, { useState } from "react";
import { useWallet } from "./wallet/useWallet.js";
import { useWalletAuth } from "./wallet/useWalletAuth.js";
import { SESSION_KEY, type KijoSession } from "./persistence.js";
import { ThreeCanvas } from "./components/ThreeCanvas.js";
import { WalletBar } from "./components/WalletBar.js";
import { StoreModal } from "./components/StoreModal.js";
import { TutorialOverlay } from "./components/TutorialOverlay.js";
import { WalletTreeSelector } from "./components/WalletTreeSelector.js";

/** Read tree_id from sessionStorage on first render (handles page reload). */
function readStoredTreeId(): string | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) return (JSON.parse(raw) as KijoSession).tree_id ?? null;
  } catch { /* ignore malformed JSON */ }
  return null;
}

export function App() {
  const { isConnected } = useWallet();
  const { accessToken, walletRowId, isAuthenticating, authError, signIn } =
    useWalletAuth();

  // activeTreeId drives ThreeCanvas remounting via key prop.
  // Initialised from sessionStorage so a reload with an existing session
  // skips the picker and loads the tree immediately.
  const [activeTreeId, setActiveTreeId] = useState<string | null>(readStoredTreeId);

  // StoreModal open state — controlled here so WalletTreeSelector can open it
  // via the onBuyMore callback (DC-1: no DOM event from WalletTreeSelector).
  const [storeOpen, setStoreOpen] = useState(false);

  // Show picker when: connected, fully authenticated, and no tree selected yet.
  // BUG-1 fix: both accessToken AND walletRowId must be non-null before showing
  // the picker. WalletTreeSelector.selectTree() non-null-asserts both when
  // writing the session; this guard prevents a corrupted session write if
  // walletRowId is null while accessToken is non-null (JWT decode edge case).
  const showPicker =
    isConnected && !!accessToken && !!walletRowId && !activeTreeId;

  return (
    <>
      {/* ThreeCanvas key prop: full remount when the selected tree changes.
          ThreeCanvas reads session via getSession() inside initialized.current
          guard — it only reads once on mount, so remount is required for a
          new tree to take effect. */}
      <ThreeCanvas key={activeTreeId ?? "guest"} />

      {/* WalletBar portals into #wallet-bar-anchor inside ThreeCanvas's #hud-top */}
      <WalletBar />

      {/* Tree picker — shown after full auth when no session tree is active.
          DC-1: onTreeSelected is a callback prop (not a DOM event). WalletTreeSelector
          is a React child of App; callbacks are idiomatic for child→parent communication.
          onBuyMore opens StoreModal from within the picker (zero-trees state). */}
      {showPicker && (
        <WalletTreeSelector
          accessToken={accessToken}
          walletRowId={walletRowId}
          onTreeSelected={setActiveTreeId}
          onBuyMore={() => setStoreOpen(true)}
        />
      )}

      {/* StoreModal — always in tree so its DOM listener for #btn-buy-seed
          works regardless of picker visibility. Auth props passed from here
          (single useWalletAuth instance). */}
      <StoreModal
        open={storeOpen}
        onClose={() => setStoreOpen(false)}
        accessToken={accessToken}
        walletRowId={walletRowId}
        isAuthenticating={isAuthenticating}
        authError={authError}
        signIn={signIn}
      />

      {/* First-time tutorial overlay — self-dismisses after completion */}
      <TutorialOverlay />

      {/* Navigation links preserved from original index.html */}
      <nav id="page-links">
        <a href="/index3d.html">voxel view</a>
        <a href="/index2d.html">2d debug</a>
      </nav>
    </>
  );
}
