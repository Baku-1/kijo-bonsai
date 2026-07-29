import { GrowthEngine } from '@kijo/engine';
import type { BonsaiTree } from '@kijo/engine';
import { WATER_AMOUNT } from '@kijo/shared';

// ---------------------------------------------------------------------------
// Care bridge (Layer 1, item 3) — thin wiring between UI events and engine
// calls. ZERO logic here: the engine is the authority. This layer only
// dispatches public API calls and notifies the app so the renderer can
// rebuild (dirty-flag handshake) and the HUD can refresh.
// ---------------------------------------------------------------------------

const AUTO_INTERVAL_MS = 2200;

export class CareBridge {
  private tree: BonsaiTree;
  private afterAction: () => void;
  private autoTimer: ReturnType<typeof setInterval> | null = null;

  constructor(tree: BonsaiTree, afterAction: () => void) {
    this.tree = tree;
    this.afterAction = afterAction;
  }

  /** Swap in a different tree (New tree button). Stops auto mode. */
  setTree(tree: BonsaiTree): void {
    this.stopAuto();
    this.tree = tree;
  }

  water(): void {
    this.tree.water(WATER_AMOUNT);   // engine logs the action
    this.afterAction();
  }

  nextDay(): void {
    GrowthEngine.growTick(this.tree); // engine marks dirty
    this.afterAction();
  }

  get autoRunning(): boolean {
    return this.autoTimer !== null;
  }

  toggleAuto(): boolean {
    if (this.autoTimer !== null) {
      this.stopAuto();
      return false;
    }
    this.autoTimer = setInterval(() => this.nextDay(), AUTO_INTERVAL_MS);
    return true;
  }

  stopAuto(): void {
    if (this.autoTimer !== null) {
      clearInterval(this.autoTimer);
      this.autoTimer = null;
    }
  }
}
