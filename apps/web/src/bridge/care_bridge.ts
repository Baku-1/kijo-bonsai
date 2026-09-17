import { GrowthEngine } from '@kijo/engine';
import type { BonsaiTree } from '@kijo/engine';
import { WATER_AMOUNT } from '@kijo/shared';
import type { TwineResult, WeightResult, Branch } from '@kijo/shared';

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

  // Sculpt methods (SCULPT-ADD 2026-08-29) -- F2 patch: call afterAction on success.
  applyTwine(branchId: number, angleDelta: number): TwineResult {
    const result = this.tree.applyTwine(branchId, angleDelta);
    if (result.ok) this.afterAction();
    return result;
  }

  removeTwine(branchId: number): void {
    this.tree.removeTwine(branchId);
    this.afterAction();
  }

  applyWeight(branchId: number, weightCount: number): WeightResult {
    const result = this.tree.applyWeight(branchId, weightCount);
    if (result.ok) this.afterAction();
    return result;
  }

  removeWeight(branchId: number): void {
    this.tree.removeWeight(branchId);
    this.afterAction();
  }

  /** Get current branch state for UI display. */
  getBranch(branchId: number): Branch | undefined {
    return this.tree.getBranches()[branchId];
  }

  stopAuto(): void {
    if (this.autoTimer !== null) {
      clearInterval(this.autoTimer);
      this.autoTimer = null;
    }
  }
}
