// ---------------------------------------------------------------------------
// ThreeCanvas — mounts the existing Three.js care client inside a React
// useEffect. The engine, renderer, bridge, and HUD code are NOT modified.
// CareHud writes to DOM elements by ID; those IDs are rendered in JSX below.
//
// initialized.current guard: React StrictMode calls effects twice in dev.
// Without it the scene would double-mount and leak a WebGL context.
// ---------------------------------------------------------------------------
import React, { useEffect, useRef } from 'react';
import { BonsaiTree } from '@kijo/engine';
import type { SpeciesClass } from '@kijo/shared';
import { createScene } from '../renderer/scene.js';
import { buildTreeMesh } from '../renderer/tree_mesh.js';
import { CareBridge } from '../bridge/care_bridge.js';
import { CareHud } from '../ui/hud.js';

export function ThreeCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized  = useRef(false);

  useEffect(() => {
    if (initialized.current || !containerRef.current) return;
    initialized.current = true;

    // -----------------------------------------------------------------------
    // Replicated from src/main.ts — wiring only, no engine logic lives here.
    // -----------------------------------------------------------------------
    const params = new URLSearchParams(location.search);
    const seed = Number(params.get('seed')) || 464497;
    const speciesParam = params.get('species');
    const species: SpeciesClass =
      speciesParam === 'evergreen' || speciesParam === 'tropical'
        ? speciesParam
        : 'hardwood';

    const tree = new BonsaiTree(seed, species);
    const careScene = createScene(containerRef.current!);

    function livingBranchCount(): number {
      return tree.getBranches().filter((b) => !b.pruned).length;
    }

    function refreshView(): void {
      if (tree.isDirty()) {
        buildTreeMesh(careScene.treeRoot, tree);
        tree.clearDirty();
      }
      hud.update(tree, livingBranchCount());
    }

    const bridge = new CareBridge(tree, refreshView);

    const hud = new CareHud({
      onWater:      () => bridge.water(),
      onNextDay:    () => bridge.nextDay(),
      onToggleAuto: () => bridge.toggleAuto(),
    });

    // First paint: trunk exists from creation, isDirty() starts false —
    // build the initial mesh explicitly (same as main.ts).
    buildTreeMesh(careScene.treeRoot, tree);
    hud.update(tree, livingBranchCount());
    console.log(`[kijo-care] boot seed=${seed} species=${species}`);

    let animId: number;
    function animate(): void {
      animId = requestAnimationFrame(animate);
      careScene.controls.update();
      careScene.renderer.render(careScene.scene, careScene.camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(animId);
      careScene.renderer.dispose();
    };
  }, []);

  // -------------------------------------------------------------------------
  // JSX renders the same DOM structure as the original index.html.
  // ALL element IDs that CareHud (hud.ts) accesses must be present here:
  //   moisture-fill, health-fill, day-label, season-label,
  //   info-line, warning, btn-water, btn-next-day, btn-auto
  // The new btn-buy-seed is wired to StoreModal via addEventListener.
  // The wallet-bar-anchor div is the portal target for WalletBar.tsx.
  // -------------------------------------------------------------------------
  return (
    <>
      {/* Three.js canvas target — containerRef passed to createScene */}
      <div id="scene-container" ref={containerRef} />

      {/* Top status bar */}
      <div id="hud-top">
        <h1>Kijonsai</h1>
        <div className="stat">
          💧 <div className="bar"><div id="moisture-fill" /></div>
        </div>
        <div className="stat">
          🌱 <div className="bar"><div id="health-fill" /></div>
        </div>
        <div className="stat" id="day-label">Day 0</div>
        <div className="stat" id="season-label">Spring</div>
        <div id="warning" />
        {/* WalletBar mounts here via React portal — see WalletBar.tsx */}
        <div id="wallet-bar-anchor" />
      </div>

      {/* Bottom controls */}
      <div id="hud-bottom">
        <div id="buttons">
          <button id="btn-water">💧 Water</button>
          <button id="btn-next-day" className="primary">☀️ Next Day</button>
          <button id="btn-auto">▶ Auto</button>
          <button id="btn-buy-seed" className="primary">🌱 Buy Seed</button>
        </div>
        <div id="info-line">Seed #— · — branches · —</div>
      </div>
    </>
  );
}
