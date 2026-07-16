import { SeededRNG, round4 } from '@kijo/shared';
import type { TreeState, Branch, SpeciesClass, CareLogEntry } from '@kijo/shared';
import { createTree } from './tree.js';
import { PruneEngine } from './PruneEngine.js';

export class BonsaiTree {
  private state: TreeState;
  private dirty: boolean = false;
  private careLog: CareLogEntry[] = [];
  private nextId: number;

  constructor(seed: number, species: SpeciesClass) {
    this.state = createTree(seed, species);
    // Spec initial conditions (override createTree defaults of moisture=50, health=60)
    this.state.moisture = 55;
    this.state.health = 85;
    this.nextId = 1; // trunk is id 0 (from createTree); next allocated id is 1
  }

  // -------------------------------------------------------------------------
  // State mutation
  // -------------------------------------------------------------------------

  /**
   * Advance daily moisture decay and health update.
   * Decay: 5.0–9.0, seeded by seed + day*1000 (uses day BEFORE increment).
   * Health: +0.8 if moisture ∈ [30,65]; −1.5 if moisture <15 or >80; −0.3 otherwise.
   */
  applyDailyUpdate(): void {
    const rng = new SeededRNG(this.state.seed + this.state.day * 1000);
    const decay = round4(5.0 + rng.next() * 4.0);
    this.state.moisture = Math.max(0, round4(this.state.moisture - decay));

    const m = this.state.moisture;
    if (m >= 30 && m <= 65) {
      this.state.health = round4(Math.min(100, this.state.health + 0.8));
    } else if (m < 15 || m > 80) {
      this.state.health = round4(Math.max(10, this.state.health - 1.5));
    } else {
      this.state.health = round4(Math.max(10, this.state.health - 0.3));
    }

    this.state.day += 1;
  }

  water(amount: number): void {
    this.state.moisture = Math.min(100, round4(this.state.moisture + amount));
    this.careLog.push({ day: this.state.day, action: { type: 'water' } });
  }

  fertilize(): void {
    if (this.state.fertilizerCooldown > 0) return; // 8-day cooldown — no-op
    this.state.fertilizerDays = 5;
    this.state.fertilizerCooldown = 8;
    this.careLog.push({ day: this.state.day, action: { type: 'fertilize' } });
  }

  rotate(): void {
    this.state.rotation = (this.state.rotation + 90) % 360;
    this.careLog.push({ day: this.state.day, action: { type: 'rotate' } });
  }

  prune(branchId: number): boolean {
    return PruneEngine.prune(this, branchId);
  }

  // -------------------------------------------------------------------------
  // Accessors
  // -------------------------------------------------------------------------

  getRoot(): Branch { return this.state.branches[0]; }
  getRootMutable(): Branch { return this.state.branches[0]; }
  getMoisture(): number { return this.state.moisture; }
  getHealth(): number { return this.state.health; }
  /** Returns current day counter (incremented by applyDailyUpdate). */
  getAge(): number { return this.state.day; }
  getSeed(): number { return this.state.seed; }
  getSpecies(): SpeciesClass { return this.state.species; }
  getRotationState(): number { return this.state.rotation; }
  isFertilizerActive(): boolean { return this.state.fertilizerDays > 0; }
  getCareLog(): CareLogEntry[] { return this.careLog; }
  getBranches(): Branch[] { return this.state.branches; }
  getNextBranchId(): number { return this.nextId; }

  // -------------------------------------------------------------------------
  // Dirty flag — Renderer ONLY clears (see KIJO-ARCHITECTURE.md §4)
  // -------------------------------------------------------------------------

  isDirty(): boolean { return this.dirty; }
  markDirty(): void { this.dirty = true; }
  clearDirty(): void { this.dirty = false; }

  // -------------------------------------------------------------------------
  // Verification helpers
  // -------------------------------------------------------------------------

  /**
   * Counts living (non-pruned) non-trunk branches.
   * Excludes trunk so that: nextId === countLivingBranches() + getPrunedCount() + 1 (G2 invariant).
   */
  countLivingBranches(): number {
    return this.state.branches.filter(b => !b.pruned && b.parent !== null).length;
  }

  getPrunedCount(): number {
    return this.state.branches.filter(b => b.pruned).length;
  }

  getTotalMass(): number {
    return round4(
      this.state.branches
        .filter(b => !b.pruned)
        .reduce((sum, b) => sum + b.thickness * b.thickness * b.length, 0)
    );
  }

  // -------------------------------------------------------------------------
  // Internal — for GrowthEngine / PruneEngine use only
  // -------------------------------------------------------------------------

  _getState(): TreeState { return this.state; }

  /** Allocate and return the next branch id, advancing the counter. */
  _allocBranchId(): number { return this.nextId++; }

  _pushBranch(b: Branch): void { this.state.branches.push(b); }

  /** Append a care-log entry (used by PruneEngine). */
  _logCare(entry: CareLogEntry): void { this.careLog.push(entry); }

  /** Return the mutable Branch at index id (used by PruneEngine to set pruned). */
  _getBranchMutable(id: number): Branch | undefined { return this.state.branches[id]; }

  _tickFertilizer(): void {
    if (this.state.fertilizerDays > 0) this.state.fertilizerDays--;
    if (this.state.fertilizerCooldown > 0) this.state.fertilizerCooldown--;
  }
}
