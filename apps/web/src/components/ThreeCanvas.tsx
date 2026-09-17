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
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { BonsaiTree, CareLogReplay, WEIGHT_DEGREES_PER_UNIT } from '@kijo/engine';
import type { CareAction, SpeciesClass } from '@kijo/shared';
import { WATER_AMOUNT, round4 } from '@kijo/shared';
import type { Branch } from '@kijo/shared';
import { createScene } from '../renderer/scene.js';
import { buildTreeMesh, applyGrungeOverlay } from '../renderer/tree_mesh.js';
import { CareBridge } from '../bridge/care_bridge.js';
import { CareHud } from '../ui/hud.js';
import {
  getSession,
  loadCareLog,
  persistCareAction,
  applyCurrentDayEntries,
  saveTreeCache,
  loadTreeCache,
  clearTreeCache,
  type KijoSession,
  type CareLogEntry,
} from '../persistence.js';

// RAYCASTER-ADD 2026-08-30: full sculpt mode enum
type SculptMode = 'none' | 'prune' | 'wire' | 'twine' | 'weight' | 'jin' | 'landscape';

// ---------------------------------------------------------------------------
// Public NFT viewer support — consolidated from viewer.ts (2026-09-11)
// ---------------------------------------------------------------------------
const SUPABASE_URL    = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON   = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const GET_TREE_PUBLIC = `${SUPABASE_URL}/functions/v1/get-tree-public`;

interface CareLogEntryRaw { day: number; action: CareAction; }
interface TreePublicData {
  token_id:         number;
  seed:             number;
  species:          SpeciesClass;
  current_day:      number;
  health:           number;
  born_at:          string;
  care_log_entries: CareLogEntryRaw[];
}

async function fetchTreePublic(tokenId: number): Promise<TreePublicData> {
  const res = await fetch(`${GET_TREE_PUBLIC}?tokenId=${tokenId}`, {
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`get-tree-public returned ${res.status}: ${body}`);
  }
  return res.json() as Promise<TreePublicData>;
}

const EXCLUDED_PUBLIC_ACTIONS = new Set<CareAction['type']>(['tick', 'landscape'] as CareAction['type'][]);

function reconstructPublicTree(data: TreePublicData): BonsaiTree {
  const careLog = data.care_log_entries
    .filter(e => !EXCLUDED_PUBLIC_ACTIONS.has(e.action.type))
    .map(e => ({ day: e.day, action: e.action }));
  if (data.current_day <= 0) return new BonsaiTree(data.seed, data.species);
  return CareLogReplay.reconstruct(data.seed, data.species, careLog, data.current_day);
}

// ---------------------------------------------------------------------------
// Looking Glass WebXR init (~20 lines, ported from viewer.ts)
// ---------------------------------------------------------------------------
async function initLookingGlass(
  renderer: THREE.WebGLRenderer,
  renderFn: () => void,
): Promise<void> {
  if (!navigator.xr) return;
  const supported = await navigator.xr.isSessionSupported('immersive-vr').catch(() => false);
  if (!supported) return;

  // Show the XR button in the HUD
  const xrBtn = document.getElementById('btn-xr');
  if (xrBtn) {
    xrBtn.style.display = '';
    xrBtn.addEventListener('click', async () => {
      try {
        const xrSession = await navigator.xr!.requestSession('immersive-vr', {
          optionalFeatures: ['local-floor', 'bounded-floor'],
        });
        await renderer.xr.setSession(xrSession);
        renderer.setAnimationLoop(renderFn);
      } catch (err) {
        console.error('[kijo-care] XR session request failed:', err);
      }
    });
  }
}

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
    const tokenIdParam = params.get('tokenId');
    const isReadOnly = tokenIdParam !== null;
    const publicTokenId = isReadOnly ? parseInt(tokenIdParam!, 10) : null;

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

    // Local care log — tracks all actions applied (server + local) so we can
    // cache them in sessionStorage and survive full-page navigation.
    let localCareLog: CareLogEntry[] = [];
    let cacheReady = false;

    function cacheTree(): void {
      if (!cacheReady) return;
      saveTreeCache(
        session?.tree_id ?? null,
        tree.getSeed(), tree.getSpecies(),
        tree.getAge(), localCareLog,
      );
    }

    const careScene = createScene(containerRef.current!);

    function livingBranchCount(): number {
      // Canonical branch count: matches engine countLivingBranches() and
      // excludes the trunk (parent === null). The trunk is not a branch.
      return tree.countLivingBranches();
    }

    function refreshView(): void {
      if (tree.isDirty()) {
        buildTreeMesh(careScene.treeRoot, tree);
        applyGrungeOverlay(careScene.treeRoot, tree.getHealth());
        tree.clearDirty();
      }
      hud.update(tree, livingBranchCount());
      cacheTree();
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

    // WEB3-FIX 2026-09-08: persistence rejection must be visible, not silent.
    // The care log is the only authoritative state for the tree (an NFT/combat
    // asset), so a rejected action is shown to the player with the real reason
    // (e.g. "no shears consumable") instead of a prune/wire that silently
    // reverts on the next reload.
    function showPersistError(err: unknown): void {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[kijo-care] care action NOT saved:', msg);
      let banner = document.getElementById('kijo-persist-error');
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'kijo-persist-error';
        banner.style.cssText =
          'position:fixed;top:14px;left:50%;transform:translateX(-50%);' +
          'background:#8b1e1e;color:#ffe9e9;padding:10px 18px;border-radius:6px;' +
          'font:600 14px/1.3 sans-serif;z-index:9999;box-shadow:0 4px 14px rgba(0,0,0,.5);' +
          'max-width:min(90vw,560px);text-align:center;pointer-events:none;';
        document.body.appendChild(banner);
      }
      banner.textContent = 'Care action NOT saved - ' + msg;
      window.clearTimeout(persistErrorTimer);
      persistErrorTimer = window.setTimeout(() => {
        banner?.remove();
      }, 8000);
    }
    let persistErrorTimer: number = 0;

    const bridge = new CareBridge(tree, refreshView);

    // --- Raycaster + branch picking (RAYCASTER-ADD 2026-08-30) ---
    let sculptMode: SculptMode = 'none';
    let selectedBranchId: number | null = null;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    // Selection indicator -- yellow wireframe sphere, added to careScene.scene
    // (NOT treeRoot) so it survives buildTreeMesh -> disposeTree -> group.clear().
    const selectionIndicator = (() => {
      const g = new THREE.SphereGeometry(2.5, 8, 6);
      const m = new THREE.MeshBasicMaterial({ color: 0xffdd00, wireframe: true });
      const mesh = new THREE.Mesh(g, m);
      mesh.visible = false;
      careScene.scene.add(mesh);
      return mesh;
    })();

    function deselectBranch(): void {
      selectedBranchId = null;
      selectionIndicator.visible = false;
      const overlay = document.getElementById('sculpt-overlay');
      if (overlay) overlay.style.display = 'none';
    }

    function selectBranch(branchId: number, worldPos: THREE.Vector3): void {
      selectedBranchId = branchId;
      selectionIndicator.position.copy(worldPos);
      selectionIndicator.visible = true;

      const branch = bridge.getBranch(branchId);
      if (!branch) { deselectBranch(); return; }

      const overlay = document.getElementById('sculpt-overlay');
      const label = document.getElementById('sculpt-branch-label');
      const inner = document.getElementById('sculpt-controls-inner');
      if (!overlay || !label || !inner) return;

      overlay.style.display = '';

      if (sculptMode === 'wire') {
        // F1: Show wired/unwired ONLY. No angle values (caretaker opacity).
        const wiredLabel = branch.wired ? 'wired' : 'unwired';
        label.textContent = `Branch #${branchId} -- ${wiredLabel}`;
        inner.innerHTML = buildWireControls(branch);
        wireControlsListeners(branchId);
      } else if (sculptMode === 'twine') {
        const twinedLabel = branch.twined
          ? `twined -- degrades day ${branch.twineDegradesDay}`
          : 'free';
        label.textContent = `Branch #${branchId} -- ${twinedLabel}`;
        inner.innerHTML = buildTwineControls(branch);
        twineControlsListeners(branchId);
      } else if (sculptMode === 'weight') {
        const weightedLabel = branch.weighted
          ? `weighted (${branch.weightCount} bags)`
          : 'no weight';
        label.textContent = `Branch #${branchId} -- ${weightedLabel}`;
        inner.innerHTML = buildWeightControls(branch);
        weightControlsListeners(branchId, branch);
      } else if (sculptMode === 'jin') {
        const maxSeg = Math.max(0, Math.floor(branch.length) - 1);
        label.textContent = `Branch #${branchId} -- length ${branch.length.toFixed(1)}`;
        inner.innerHTML = buildJinControls(maxSeg);
        jinControlsListeners(branchId);
      }
    }

    // --- Sculpt control builders (RAYCASTER-ADD 2026-08-30) ---

    function buildTwineControls(branch: Branch): string {
      return `
        <div style="display:flex;align-items:center;gap:8px;justify-content:center">
          <label style="font-size:12px">Bend</label>
          <input id="sculpt-twine-angle" type="range" min="-28" max="28" value="0"
                 style="width:120px;cursor:pointer" />
          <span id="sculpt-twine-label" style="font-size:12px;min-width:32px">0 deg</span>
        </div>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:8px">
          <button id="sculpt-twine-apply">Apply</button>
          ${branch.twined ? '<button id="sculpt-twine-remove">Remove</button>' : ''}
        </div>
      `;
    }

    function twineControlsListeners(branchId: number): void {
      const slider = document.getElementById('sculpt-twine-angle') as HTMLInputElement | null;
      const lbl = document.getElementById('sculpt-twine-label');
      if (slider && lbl) {
        slider.addEventListener('input', () => {
          lbl.textContent = `${slider.value} deg`;
        });
      }

      // F2 PATCH: bridge call first (gets result), then push, persist, cacheTree
      document.getElementById('sculpt-twine-apply')?.addEventListener('click', () => {
        if (selectedBranchId === null) return;
        const angleDelta = parseFloat(
          (document.getElementById('sculpt-twine-angle') as HTMLInputElement)?.value ?? '0');
        if (!Number.isFinite(angleDelta) || angleDelta === 0) return;

        const result = bridge.applyTwine(selectedBranchId, angleDelta);
        if (!result.ok) {
          // F7: Show rejection reason
          const rejLabel = document.getElementById('sculpt-branch-label');
          if (rejLabel) rejLabel.textContent = `Branch #${selectedBranchId} -- ${result.reason ?? 'rejected'}`;
          return;
        }

        const appliedDelta = round4(result.newAngle! - result.oldAngle!);
        const b = bridge.getBranch(selectedBranchId);
        const degradeDays = b ? b.twineDegradesDay - tree.getAge() : 0;

        localCareLog.push({
          day: tree.getAge(),
          action: { type: 'twine', branchId: selectedBranchId, angleDelta: appliedDelta,
                    oldAngle: result.oldAngle!, newAngle: result.newAngle!, degradeDays },
        });
        persistAsync({ type: 'twine', branchId: selectedBranchId, angleDelta: appliedDelta,
                       oldAngle: result.oldAngle!, newAngle: result.newAngle!, degradeDays });
        cacheTree();
        selectBranch(selectedBranchId, selectionIndicator.position.clone());
      });

      document.getElementById('sculpt-twine-remove')?.addEventListener('click', () => {
        if (selectedBranchId === null) return;
        const bid = selectedBranchId;
        localCareLog.push({ day: tree.getAge(), action: { type: 'twine-remove', branchId: bid } });
        bridge.removeTwine(bid);
        persistAsync({ type: 'twine-remove', branchId: bid });
        selectBranch(bid, selectionIndicator.position.clone());
      });
    }

    // F4: Use WEIGHT_DEGREES_PER_UNIT, not magic number 7
    function buildWeightControls(branch: Branch): string {
      const defaultPreview = `+${1 * WEIGHT_DEGREES_PER_UNIT} deg down`;
      return `
        <div style="display:flex;align-items:center;gap:8px;justify-content:center">
          <label style="font-size:12px">Bags</label>
          <select id="sculpt-weight-count" style="width:60px">
            <option value="1">1</option><option value="2">2</option>
            <option value="3">3</option><option value="4">4</option>
          </select>
          <span id="sculpt-weight-preview" style="font-size:11px;opacity:.7">${defaultPreview}</span>
        </div>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:8px">
          <button id="sculpt-weight-apply">Apply</button>
          ${branch.weighted ? '<button id="sculpt-weight-remove">Remove</button>' : ''}
        </div>
      `;
    }

    function weightControlsListeners(branchId: number, branch: Branch): void {
      const sel = document.getElementById('sculpt-weight-count') as HTMLSelectElement | null;
      const preview = document.getElementById('sculpt-weight-preview');
      if (sel && preview) {
        // F10: Show cumulative total when branch already weighted
        sel.addEventListener('change', () => {
          const wc = parseInt(sel.value, 10);
          const newDelta = wc * WEIGHT_DEGREES_PER_UNIT;
          if (branch.weighted && branch.weightAngleDelta > 0) {
            const total = branch.weightAngleDelta + newDelta;
            preview.textContent = `+${newDelta} deg (total: ${total} deg)`;
          } else {
            preview.textContent = `+${newDelta} deg down`;
          }
        });
      }

      // F3 PATCH: same corrected ordering as twine-apply
      document.getElementById('sculpt-weight-apply')?.addEventListener('click', () => {
        if (selectedBranchId === null) return;
        const wc = parseInt(
          (document.getElementById('sculpt-weight-count') as HTMLSelectElement)?.value ?? '1', 10);
        if (wc < 1 || wc > 4) return;

        const result = bridge.applyWeight(selectedBranchId, wc);
        if (!result.ok) {
          // F7: Show rejection reason
          const rejLabel = document.getElementById('sculpt-branch-label');
          if (rejLabel) rejLabel.textContent = `Branch #${selectedBranchId} -- ${result.reason ?? 'rejected'}`;
          return;
        }

        localCareLog.push({
          day: tree.getAge(),
          action: { type: 'weight', branchId: selectedBranchId, weightCount: wc,
                    torqueContribution: result.torqueContribution! },
        });
        persistAsync({ type: 'weight', branchId: selectedBranchId, weightCount: wc,
                       torqueContribution: result.torqueContribution! });
        cacheTree();
        selectBranch(selectedBranchId, selectionIndicator.position.clone());
      });

      document.getElementById('sculpt-weight-remove')?.addEventListener('click', () => {
        if (selectedBranchId === null) return;
        const bid = selectedBranchId;
        localCareLog.push({ day: tree.getAge(), action: { type: 'weight-remove', branchId: bid } });
        bridge.removeWeight(bid);
        persistAsync({ type: 'weight-remove', branchId: bid });
        selectBranch(bid, selectionIndicator.position.clone());
      });
    }

    function buildWireControls(branch: Branch): string {
      return `
        <div style="display:flex;align-items:center;gap:8px;justify-content:center">
          <label style="font-size:12px">Bend</label>
          <input id="sculpt-wire-angle" type="range" min="-45" max="45" value="0"
                 style="width:120px;cursor:pointer" />
          <span id="sculpt-wire-label" style="font-size:12px;min-width:32px">0 deg</span>
        </div>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:8px">
          <button id="sculpt-wire-apply">Apply</button>
          ${branch.wired ? '<button id="sculpt-wire-remove">Remove</button>' : ''}
        </div>
      `;
    }

    function wireControlsListeners(branchId: number): void {
      const slider = document.getElementById('sculpt-wire-angle') as HTMLInputElement | null;
      const lbl = document.getElementById('sculpt-wire-label');
      if (slider && lbl) {
        slider.addEventListener('input', () => {
          lbl.textContent = `${slider.value} deg`;
        });
      }

      document.getElementById('sculpt-wire-apply')?.addEventListener('click', () => {
        if (selectedBranchId === null) return;
        const bid = selectedBranchId; // narrow for TS closure
        const angleDelta = parseFloat(
          (document.getElementById('sculpt-wire-angle') as HTMLInputElement)?.value ?? '0');
        if (!Number.isFinite(angleDelta) || angleDelta === 0) return;

        // WEB3-FIX: server-first for wire (consumable-gated). The engine
        // validates geometry locally to preview the delta, but the action is
        // recorded only after the server accepts it. Rejection (e.g. no wire
        // consumable) leaves the tree untouched and shows the real reason.
        if (!session || !session.access_token || !session.wallet_row_id) {
          const result = tree.wire(bid, angleDelta);
          if (!result.ok) {
            const rejLabel = document.getElementById('sculpt-branch-label');
            if (rejLabel) rejLabel.textContent = `Branch #${bid} -- ${result.reason ?? 'rejected'}`;
            return;
          }
          const appliedDeltaG = round4(result.newAngle! - result.oldAngle!);
          localCareLog.push({
            day: tree.getAge(),
            action: { type: 'wire', branchId: bid, angleDelta: appliedDeltaG,
                      oldAngle: result.oldAngle!, newAngle: result.newAngle!, wireCost: result.wireCost! },
          });
          refreshView();
          selectBranch(bid, selectionIndicator.position.clone());
          return;
        }
        const sWire = session;
        const wireAction = { type: 'wire', branchId: bid, angleDelta,
                             wireCost: 1 } as const;
        persistCareAction(sWire, wireAction as Parameters<typeof persistCareAction>[1])
          .then(() => {
            const result = tree.wire(bid, angleDelta);
            if (!result.ok) return;
            const appliedDelta = round4(result.newAngle! - result.oldAngle!);
            localCareLog.push({
              day: tree.getAge(),
              action: { type: 'wire', branchId: bid, angleDelta: appliedDelta,
                        oldAngle: result.oldAngle!, newAngle: result.newAngle!, wireCost: result.wireCost! },
            });
            refreshView();
            selectBranch(bid, selectionIndicator.position.clone());
          })
          .catch(showPersistError);
      });

      document.getElementById('sculpt-wire-remove')?.addEventListener('click', () => {
        if (selectedBranchId === null) return;
        const bid = selectedBranchId;
        localCareLog.push({ day: tree.getAge(), action: { type: 'wire-remove', branchId: bid } });
        tree.removeWire(bid);
        refreshView();
        persistAsync({ type: 'wire-remove', branchId: bid });
        selectBranch(bid, selectionIndicator.position.clone());
      });
    }

    function buildJinControls(maxSeg: number): string {
      return `
        <div style="display:flex;align-items:center;gap:8px;justify-content:center">
          <label style="font-size:12px">Segment</label>
          <input id="sculpt-jin-segment" type="number" min="0" max="${maxSeg}" value="0"
                 style="width:60px" />
          <span style="font-size:11px;color:#e0c060">Cost: 1 jin</span>
        </div>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:8px">
          <button id="sculpt-jin-apply" style="background:#4a2020;border-color:#c06040">
            Apply (irreversible)
          </button>
        </div>
        <div style="font-size:10px;color:#e07040;margin-top:4px">
          Phase 1: jin engine stub -- will error until Phase 2
        </div>
      `;
    }

    function jinControlsListeners(branchId: number): void {
      document.getElementById('sculpt-jin-apply')?.addEventListener('click', () => {
        if (selectedBranchId === null) return;
        const segIdx = parseInt(
          (document.getElementById('sculpt-jin-segment') as HTMLInputElement)?.value ?? '0', 10);
        const jinCost = 1;

        // PHASE 2 TODO: Replace window.confirm() with a non-blocking overlay confirmation.
        // confirm() blocks the animation loop and has inconsistent mobile UX.
        // Acceptable in Phase 1 because jin is a stub that always throws.
        if (!confirm(`Jin is irreversible. Apply to branch #${selectedBranchId}, segment ${segIdx}?`)) {
          return;
        }

        try {
          const result = tree.applyJin(selectedBranchId, segIdx, jinCost);
          if (!result.ok) {
            const rejLabel = document.getElementById('sculpt-branch-label');
            if (rejLabel) rejLabel.textContent = `Branch #${selectedBranchId} -- ${result.reason ?? 'rejected'}`;
            return;
          }

          localCareLog.push({
            day: tree.getAge(),
            action: { type: 'jin', branchId: selectedBranchId, segmentIndex: segIdx, jinCost },
          });
          refreshView();
          persistAsync({ type: 'jin', branchId: selectedBranchId, segmentIndex: segIdx, jinCost });
        } catch {
          // Phase 1: CareLogReplayError from JinEngine stub -- silently handled.
          const rejLabel = document.getElementById('sculpt-branch-label');
          if (rejLabel) rejLabel.textContent = `Branch #${selectedBranchId} -- jin stub (Phase 2)`;
        }
      });
    }

    // --- Pointer handler (F5: named for cleanup on unmount) ---
    const onPointerDown = (e: PointerEvent) => {
      if (sculptMode === 'none' || sculptMode === 'landscape') return;

      const rect = careScene.renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, careScene.camera);

      const hits = raycaster.intersectObjects(careScene.treeRoot.children, false);

      for (const hit of hits) {
        const hitBranchId = (hit.object as THREE.Mesh).userData.branchId as number | undefined;
        if (hitBranchId === undefined) continue;
        const kind = (hit.object as THREE.Mesh).userData.kind as string;
        if (kind === 'scar') continue;

        // F6: Prune mode -- server-first. The care log is the only
        // authoritative state: the prune must be recorded BEFORE the local
        // tree shows it. If the server rejects (e.g. no shears consumable)
        // the tree stays untouched and the player sees the real reason
        // instead of a prune that silently reverts on reload. (WEB3-FIX
        // 2026-09-08) Guest/read-only sessions apply locally only.
        if (sculptMode === 'prune') {
          if (hitBranchId === 0) continue; // trunk protected
          if (!session || !session.access_token || !session.wallet_row_id) {
            const pruned = tree.prune(hitBranchId);
            if (!pruned) continue; // already pruned or not found -- skip
            localCareLog.push({ day: tree.getAge(), action: { type: 'prune', branchId: hitBranchId } });
            refreshView();
            return;
          }
          const s = session;
          persistCareAction(s, { type: 'prune', branchId: hitBranchId })
            .then(() => {
              const pruned = tree.prune(hitBranchId);
              if (!pruned) return;
              localCareLog.push({ day: tree.getAge(), action: { type: 'prune', branchId: hitBranchId } });
              refreshView();
            })
            .catch((err: unknown) => {
              showPersistError(err);
            });
          return;
        }

        // Branch-targeted sculpt modes: toggle selection
        if (selectedBranchId === hitBranchId) {
          deselectBranch();
        } else {
          selectBranch(hitBranchId, hit.point);
        }
        return;
      }

      // Click on empty space -- deselect
      if (sculptMode !== 'prune') {
        deselectBranch();
      }
    };
    careScene.renderer.domElement.addEventListener('pointerdown', onPointerDown);

    // --- Mode toggle (RAYCASTER-ADD 2026-08-30) ---
    function setSculptMode(mode: SculptMode): void {
      deselectBranch();
      document.getElementById('btn-twine-mode')?.classList.remove('active');
      document.getElementById('btn-weight-mode')?.classList.remove('active');
      document.getElementById('btn-prune-mode')?.classList.remove('active');
      document.getElementById('btn-wire-mode')?.classList.remove('active');
      document.getElementById('btn-jin-mode')?.classList.remove('active');

      sculptMode = mode;

      const branchTargeted = mode === 'wire' || mode === 'twine' || mode === 'weight' || mode === 'jin';
      careScene.controls.enableRotate = !branchTargeted && mode !== 'prune';
      careScene.renderer.domElement.style.cursor = mode === 'none' ? '' : 'crosshair';

      const btnId: Record<string, string> = {
        prune: 'btn-prune-mode', wire: 'btn-wire-mode',
        twine: 'btn-twine-mode', weight: 'btn-weight-mode', jin: 'btn-jin-mode',
      };
      if (btnId[mode]) {
        document.getElementById(btnId[mode])?.classList.add('active');
      }
    }

    const hud = new CareHud({
      // Water: apply locally via bridge, then persist async.
      // Push to localCareLog BEFORE bridge.water() — bridge calls refreshView
      // which calls cacheTree, so the log must be updated first.
      onWater: () => {
        localCareLog.push({ day: tree.getAge(), action: { type: 'water', amount: WATER_AMOUNT } });
        bridge.water();
        persistAsync({ type: 'water', amount: WATER_AMOUNT });
      },
      // nextDay is a local debug advance only — the server drives real days by
      // wall-clock time.  bridge.nextDay() calls refreshView -> cacheTree,
      // which captures the updated age.
      onNextDay:    () => bridge.nextDay(),
      onToggleAuto: () => bridge.toggleAuto(),
      // RAYCASTER-ADD 2026-08-30: sculpt mode toggles
      onTwine:  () => setSculptMode(sculptMode === 'twine'  ? 'none' : 'twine'),
      onWeight: () => setSculptMode(sculptMode === 'weight' ? 'none' : 'weight'),
      onPrune:  () => setSculptMode(sculptMode === 'prune'  ? 'none' : 'prune'),
      onWire:   () => setSculptMode(sculptMode === 'wire'   ? 'none' : 'wire'),
      onJin:    () => setSculptMode(sculptMode === 'jin'    ? 'none' : 'jin'),
    });

    // First paint: trunk exists from creation, isDirty() starts false —
    // build the initial mesh explicitly (same as main.ts).
    buildTreeMesh(careScene.treeRoot, tree);
    applyGrungeOverlay(careScene.treeRoot, tree.getHealth());
    hud.update(tree, livingBranchCount());
    console.info(`[kijo-care] boot seed=${seed} species=${species}`);

    // Guards the async DB swap: if the component unmounts before the fetch
    // completes, the cleanup sets mounted=false first.  The IIFE then exits
    // before calling buildTreeMesh on a disposed renderer, which would throw.
    let mounted = true;

    const clock = new THREE.Clock();
    function animate(): void {
      const dt = clock.getDelta();
      // Atelier room animation (god-ray pulse + seeded dust drift). No-op
      // until the room textures resolve.
      careScene.tick(clock.elapsedTime, dt);
      careScene.controls.update();
      careScene.renderer.render(careScene.scene, careScene.camera);
    }
    // WebXR: setAnimationLoop drives both rAF and XR frame callbacks.
    careScene.renderer.xr.enabled = true;
    careScene.renderer.setAnimationLoop(animate);

    // -----------------------------------------------------------------------
    // Async DB load — runs AFTER the animation loop is already rendering.
    // Mirrors the init() pattern in main2d.ts exactly.
    //
    // Guest / URL-param mode: session is null -> returns immediately, leaving
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
    // WebXR: probe for Looking Glass / headset support (both modes).
    void initLookingGlass(careScene.renderer, animate);

    void (async () => {
      // --- Read-only public NFT viewer (?tokenId=N) ---
      if (isReadOnly && publicTokenId && !isNaN(publicTokenId)) {
        try {
          const treeData = await fetchTreePublic(publicTokenId);
          if (!mounted) return;
          const publicTree = reconstructPublicTree(treeData);
          deselectBranch();
          tree = publicTree;
          bridge.setTree(tree);
          buildTreeMesh(careScene.treeRoot, tree);
          applyGrungeOverlay(careScene.treeRoot, tree.getHealth());
          hud.update(tree, livingBranchCount());

          // Hide care action buttons
          const btns = document.getElementById('buttons');
          if (btns) btns.style.display = 'none';
          // Show read-only info
          const infoEl = document.getElementById('active-tree-info');
          if (infoEl) {
            infoEl.textContent =
              `Kijonsai #${publicTokenId} · ${treeData.species} · Seed ${treeData.seed} · Day ${treeData.current_day}`;
          }
          // Show GLB download link
          const glbLink = document.getElementById('viewer-glb-link') as HTMLAnchorElement | null;
          if (glbLink) {
            glbLink.href = `${SUPABASE_URL}/storage/v1/object/public/renders/${publicTokenId}.glb`;
            glbLink.download = `kijonsai-${publicTokenId}.glb`;
            glbLink.style.display = '';
          }
          console.info(
            `[kijo-viewer] read-only -- token=${publicTokenId} species=${treeData.species} ` +
              `seed=${treeData.seed} day=${treeData.current_day}`,
          );
        } catch (err: unknown) {
          console.error('[kijo-viewer] failed to load public tree:', err);
          const infoEl = document.getElementById('active-tree-info');
          if (infoEl) infoEl.textContent = `Error loading Kijonsai #${publicTokenId}`;
        }
        return; // skip normal session load
      }

      session = getSession();
      const treeId = session?.tree_id ?? null;

      // --- Local cache check ---------------------------------------------------
      // If we have a sessionStorage cache matching this tree, reconstruct from
      // it. This preserves local day advances across full-page navigations.
      const cache = loadTreeCache();
      if (cache && cache.tree_id === treeId) {
        try {
          let cachedTree: BonsaiTree;
          if (cache.age === 0) {
            cachedTree = new BonsaiTree(cache.seed, cache.species as SpeciesClass);
            applyCurrentDayEntries(cachedTree, cache.careLog.filter((e) => e.day === 0));
          } else {
            cachedTree = CareLogReplay.reconstruct(
              cache.seed, cache.species as SpeciesClass,
              cache.careLog.filter((e) => e.day < cache.age),
              cache.age,
            );
            applyCurrentDayEntries(
              cachedTree,
              cache.careLog.filter((e) => e.day === cache.age),
            );
          }
          // F9: deselect before tree swap
          deselectBranch();
          tree = cachedTree;
          bridge.setTree(tree);
          localCareLog = cache.careLog;
          cacheReady = true;
          buildTreeMesh(careScene.treeRoot, tree);
          applyGrungeOverlay(careScene.treeRoot, tree.getHealth());
          hud.update(tree, livingBranchCount());
          console.info(
            `[kijo-care] restored from local cache -- age=${cache.age} actions=${cache.careLog.length}`,
          );
          return;
        } catch (err: unknown) {
          console.warn('[kijo-care] cache reconstruction failed; falling back to server.', err);
          clearTreeCache();
        }
      }

      // --- Server load (existing behaviour) ------------------------------------
      if (!treeId) {
        cacheReady = true;
        cacheTree();
        return;
      }

      try {
        const { treeData, careLog } = await loadCareLog(treeId);

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

        // F9: deselect before tree swap
        deselectBranch();
        // Swap in the DB tree.  bridge.setTree also stops any running auto mode.
        tree = dbTree;
        bridge.setTree(tree);
        localCareLog = careLog;
        cacheReady = true;
        cacheTree();
        buildTreeMesh(careScene.treeRoot, tree);
        applyGrungeOverlay(careScene.treeRoot, tree.getHealth());
        hud.update(tree, livingBranchCount());

        const activeInfoEl = document.getElementById('active-tree-info');
        if (activeInfoEl) {
          activeInfoEl.textContent =
            `🌳 ${treeData.species} · Seed ${treeData.seed} · Day ${treeData.current_day}`;
        }

        if (!session) return; // invariant: non-null because treeId was non-null above
        const mode = session.access_token ? 'read-write' : 'read-only';
        console.info(
          `[kijo-care] tree restored -- id=${session.tree_id} ` +
            `seed=${treeData.seed} species=${treeData.species} ` +
            `day=${treeData.current_day} actions=${careLog.length} mode=${mode}`,
        );
      } catch (err: unknown) {
        // Network error or tree not found — keep the locally-booted tree.
        cacheReady = true;
        console.warn(
          '[kijo-care] failed to load tree from DB; falling back to local tree.',
          err instanceof Error ? err.message : err,
        );
      }
    })();

    return () => {
      mounted = false;  // must be first — prevents IIFE from writing to disposed renderer
      careScene.renderer.setAnimationLoop(null);
      // F5: remove named pointer handler
      careScene.renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      // Dispose selection indicator geometry + material (RAYCASTER-ADD 2026-08-30)
      selectionIndicator.geometry.dispose();
      (selectionIndicator.material as THREE.Material).dispose();
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
          <button id="btn-twine-mode">🧵 Twine</button>
          <button id="btn-weight-mode">⚖️ Weight</button>
          <button id="btn-prune-mode">✂️ Prune</button>
          <button id="btn-wire-mode">🪝 Wire</button>
          <button id="btn-jin-mode">🪵 Jin</button>
        </div>
        <div id="info-line">Seed #— · — branches · —</div>
        <div id="active-tree-info" style={{ fontSize: '12px', color: 'var(--muted, #888)', padding: '4px 8px' }} />
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button id="btn-xr" style={{ display: 'none' }}>🥽 View in XR</button>
          <a id="viewer-glb-link" href="#" style={{ display: 'none', fontSize: '12px', color: '#9fc7ff' }}>Download GLB</a>
        </div>
      </div>

      {/* Sculpt overlay -- bottom sheet for branch controls (RAYCASTER-ADD 2026-08-30) */}
      <div id="sculpt-overlay" style={{
        display: 'none',
        position: 'fixed', left: 0, right: 0, bottom: '80px',
        background: 'rgba(20, 18, 14, 0.92)',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        padding: '12px 16px', zIndex: 20, textAlign: 'center',
        backdropFilter: 'blur(8px)',
      }}>
        <div id="sculpt-branch-label" style={{ fontSize: '13px', marginBottom: '8px', color: '#ddd' }} />
        <div id="sculpt-controls-inner" />
      </div>
    </>
  );
}
