// ---------------------------------------------------------------------------
// ThreeCanvas — mounts the existing Three.js care client inside a React
// useEffect. The engine, renderer, bridge, and HUD code are NOT modified.
// CareHud writes to DOM elements by ID; those IDs are rendered in JSX below.
//
// initialized.current guard: React StrictMode calls effects twice in dev.
// Without it the scene would double-mount and leak a WebGL context.
//
// DB wiring: on mount we call getSession() from persistence.ts.
//   • Session present  → load tree from Supabase, replay care log.
//     Care buttons call persistCareAction (fire-and-forget) in addition to
//     the local engine method, so actions are durably saved.
//   • No session (guest / URL-param mode) → boot locally from ?seed & ?species,
//     identical to the previous behaviour. No server calls are made.
// ---------------------------------------------------------------------------
import React, { useEffect, useRef } from 'react';
import { BonsaiTree, CareLogReplay } from '@kijo/engine';
import type { SpeciesClass } from '@kijo/shared';
import { WATER_AMOUNT } from '@kijo/shared';
import { createScene } from '../renderer/scene.js';
import { buildTreeMesh } from '../renderer/tree_mesh.js';
import { CareBridge } from '../bridge/care_bridge.js';
import { CareHud } from '../ui/hud.js';
import {
  getSession,
  loadCareLog,
  persistCareAction,
  applyCurrentDayEntries,
  type KijoSession,
} from '../persistence.js';

export function ThreeCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized  = useRef(false);

  useEffect(() => {
    if (initialized.current || !containerRef.current) return;
    initialized.current = true;

    // -----------------------------------------------------------------------
    // Local fallback params (used in guest mode when no session is present).
    // -----------------------------------------------------------------------
    const params = new URLSearchParams(location.search);
    const seed = Number(params.get('seed')) || 464497;
    const speciesParam = params.get('species');
    const species: SpeciesClass =
      speciesParam === 'evergreen' || speciesParam === 'tropical'
        ? speciesParam
        : 'hardwood';

    // `tree` is `let` so the async DB load can swap it out after boot.
    // Closures below reference the variable, not its initial value, so the
    // swap is automatically reflected in refreshView / livingBranchCount.
    let tree = new BonsaiTree(seed, species);

    // Session is set by the async init; persistAsync reads it from the closure
    // so it is always current even if set after the hud callbacks are wired.
    let session: KijoSession | null = null;

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

    // Fire-and-forget: applies action locally (already done by the caller) and
    // persists to Supabase in the background.  Skipped when there is no active
    // read-write session.  Errors are logged as warnings — they must not crash
    // the UI, and local tree state is already consistent.
    function persistAsync(
      action: Parameters<typeof persistCareAction>[1],
    ): void {
      if (!session || !session.access_token || !session.wallet_row_id) return;
      const s = session; // snapshot — avoids stale closure if session is cleared
      persistCareAction(s, action).catch((err: unknown) => {
        console.warn(
          '[kijo-care] persistCareAction failed:',
          err instanceof Error ? err.message : err,
        );
      });
    }

    const bridge = new CareBridge(tree, refreshView);

    const hud = new CareHud({
      // Water: apply locally via bridge, then persist async.
      onWater: () => {
        bridge.water();
        persistAsync({ type: 'water', amount: WATER_AMOUNT });
      },
      // nextDay is a local debug advance only — the server drives real days by
      // wall-clock time.  Same intentional non-persist as main2d.ts.
      onNextDay:    () => bridge.nextDay(),
      onToggleAuto: () => bridge.toggleAuto(),
    });

    // First paint: trunk exists from creation, isDirty() starts false —
    // build the initial mesh explicitly (same as main.ts).
    buildTreeMesh(careScene.treeRoot, tree);
    hud.update(tree, livingBranchCount());
    console.log(`[kijo-care] boot seed=${seed} species=${species}`);

    // Guards the async DB swap: if the component unmounts before the fetch
    // completes, the cleanup sets mounted=false first.  The IIFE then exits
    // before calling buildTreeMesh on a disposed renderer, which would throw.
    let mounted = true;

    let animId: number;
    function animate(): void {
      animId = requestAnimationFrame(animate);
      careScene.controls.update();
      careScene.renderer.render(careScene.scene, careScene.camera);
    }
    animate();

    // -----------------------------------------------------------------------
    // Async DB load — runs AFTER the animation loop is already rendering.
    // Mirrors the init() pattern in main2d.ts exactly.
    //
    // Guest / URL-param mode: session is null → returns immediately, leaving
    // the locally-booted tree in place.  Behaviour identical to before this PR.
    //
    // Authenticated mode: swaps in the server tree after replay so the 3D view
    // shows the same state as the DB.  bridge.setTree() is required because
    // CareBridge holds its own reference and must be updated alongside the
    // outer `tree` variable so future water() calls hit the right object.
    //
    // Note: actions fired before this load completes (~100ms) are applied
    // locally but not persisted — session is null until getSession() runs.
    // This window is acceptable given fire-and-forget semantics.
    // -----------------------------------------------------------------------
    void (async () => {
      session = getSession();
      if (!session?.tree_id) return;

      try {
        const { treeData, careLog } = await loadCareLog(session.tree_id);

        // Bail out if the component unmounted during the fetch.
        // careScene.renderer.dispose() will have already run; calling
        // buildTreeMesh after that throws in Three.js.
        if (!mounted) return;

        let dbTree: BonsaiTree;
        if (treeData.current_day === 0) {
          // No ticks yet — start from server seed/species; do NOT call reconstruct
          // (it throws on totalDays <= 0).
          dbTree = new BonsaiTree(
            treeData.seed,
            treeData.species as SpeciesClass,
          );
          const day0Entries = careLog.filter((e) => e.day === 0);
          applyCurrentDayEntries(dbTree, day0Entries);
        } else {
          // Replay completed tick-cycles via CareLogReplay.
          const priorLog = careLog.filter(
            (e) => e.day < treeData.current_day,
          );
          dbTree = CareLogReplay.reconstruct(
            treeData.seed,
            treeData.species as SpeciesClass,
            priorLog,
            treeData.current_day,
          );
          // Apply current-day actions that happened after the last tick but
          // before the next one — must NOT call growTick again.
          const currentDayEntries = careLog.filter(
            (e) => e.day === treeData.current_day,
          );
          applyCurrentDayEntries(dbTree, currentDayEntries);
        }

        // Swap in the DB tree.  bridge.setTree also stops any running auto mode.
        tree = dbTree;
        bridge.setTree(tree);
        buildTreeMesh(careScene.treeRoot, tree);
        hud.update(tree, livingBranchCount());

        const activeInfoEl = document.getElementById('active-tree-info');
        if (activeInfoEl) {
          activeInfoEl.textContent =
            `🌳 ${treeData.species} · Seed ${treeData.seed} · Day ${treeData.current_day}`;
        }

        const mode = session.access_token ? 'read-write' : 'read-only';
        console.info(
          `[kijo-care] tree restored — id=${session.tree_id} ` +
            `seed=${treeData.seed} species=${treeData.species} ` +
            `day=${treeData.current_day} actions=${careLog.length} mode=${mode}`,
        );
      } catch (err: unknown) {
        // Network error or tree not found — keep the locally-booted tree.
        console.warn(
          '[kijo-care] failed to load tree from DB; falling back to local tree.',
          err instanceof Error ? err.message : err,
        );
      }
    })();

    return () => {
      mounted = false;  // must be first — prevents IIFE from writing to disposed renderer
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
        <div id="active-tree-info" style={{ fontSize: '12px', color: 'var(--muted, #888)', padding: '4px 8px' }} />
      </div>
    </>
  );
}
