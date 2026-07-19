import type { BonsaiTree } from '@kijo/engine';

// ---------------------------------------------------------------------------
// Care HUD (Layer 1, item 4) — DOM overlay, not Three.js. Crisp text,
// responsive layout, mobile-first (works on a 375px viewport with touch).
// ---------------------------------------------------------------------------

export interface HudCallbacks {
  onWater: () => void;
  onNextDay: () => void;
  onToggleAuto: () => boolean; // returns new auto state
}

const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];

function el<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`HUD element #${id} missing from index.html`);
  return e as T;
}

export class CareHud {
  private moistureFill: HTMLElement;
  private healthFill: HTMLElement;
  private ageLabel: HTMLElement;
  private seasonLabel: HTMLElement;
  private infoLine: HTMLElement;
  private warnLine: HTMLElement;
  private autoBtn: HTMLButtonElement;

  constructor(cb: HudCallbacks) {
    this.moistureFill = el('moisture-fill');
    this.healthFill = el('health-fill');
    this.ageLabel = el('day-label');
    this.seasonLabel = el('season-label');
    this.infoLine = el('info-line');
    this.warnLine = el('warning');
    this.autoBtn = el<HTMLButtonElement>('btn-auto');

    el<HTMLButtonElement>('btn-water').addEventListener('click', cb.onWater);
    el<HTMLButtonElement>('btn-next-day').addEventListener('click', cb.onNextDay);
    this.autoBtn.addEventListener('click', () => {
      const running = cb.onToggleAuto();
      this.autoBtn.textContent = running ? '⏸ Pause' : '▶ Auto';
      this.autoBtn.classList.toggle('active', running);
    });
  }

  /** Sync the Auto button label/state from outside (boot reset, programmatic stops). */
  setAutoLabel(running: boolean): void {
    this.autoBtn.textContent = running ? '⏸ Pause' : '▶ Auto';
    this.autoBtn.classList.toggle('active', running);
  }

  /** Reflect engine state. Pure read — no engine mutation. */
  update(tree: BonsaiTree, livingBranches: number): void {
    const moisture = tree.getMoisture();
    const health = tree.getHealth();
    const age = tree.getAge();

    this.moistureFill.style.width = `${Math.max(0, Math.min(100, moisture))}%`;
    this.healthFill.style.width = `${Math.max(0, Math.min(100, health))}%`;
    this.ageLabel.textContent = `Day ${age}`;
    this.seasonLabel.textContent = SEASONS[Math.floor((age % 120) / 30)];
    this.infoLine.textContent =
      `Seed #${tree.getSeed()} · ${livingBranches} branches · ${tree.getSpecies()}`;

    if (moisture < 20) {
      this.warnLine.textContent = 'Thirsty — water soon';
      this.warnLine.className = 'warn';
    } else if (moisture > 80) {
      this.warnLine.textContent = 'Overwatered — let it dry';
      this.warnLine.className = 'warn';
    } else {
      this.warnLine.textContent = '';
      this.warnLine.className = '';
    }
  }
}
