// ---------------------------------------------------------------------------
// App — root component. Wagmi + React Query providers are above this in
// main.tsx. App composes the Three.js canvas, wallet bar, and seed modal.
// ---------------------------------------------------------------------------
import React from "react";
import { ThreeCanvas } from "./components/ThreeCanvas.js";
import { WalletBar } from "./components/WalletBar.js";
import { StoreModal } from "./components/StoreModal.js";
import { TutorialOverlay } from "./components/TutorialOverlay.js";

export function App() {
  return (
    <>
      {/* Three.js canvas fills the page; also renders #hud-top / #hud-bottom */}
      <ThreeCanvas />

      {/* WalletBar portals into #wallet-bar-anchor inside ThreeCanvas's #hud-top */}
      <WalletBar />

      {/* Store modal — hidden until user clicks #btn-buy-seed */}
      <StoreModal />

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
