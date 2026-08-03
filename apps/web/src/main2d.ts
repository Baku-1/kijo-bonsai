import { BonsaiTree, GrowthEngine, StatDeriver, CareLogReplay } from '@kijo/engine';
import type { Branch, SpeciesClass } from '@kijo/shared';
import { WATER_AMOUNT } from '@kijo/shared';
import { Voxelizer } from '@kijo/voxelizer';
import {
  getSession,
  loadCareLog,
  persistCareAction,
  applyCurrentDayEntries,
  type KijoSession,
} from './persistence.js';

// ---------------------------------------------------------------------------
// Persistence state — null = local / guest mode (no server wiring).
// ---------------------------------------------------------------------------
let kijoSession: KijoSession | null = null;

// ---------------------------------------------------------------------------
// State — BonsaiTree is the single source of truth; we re-render on dirty.
// ---------------------------------------------------------------------------
let tree: BonsaiTree = newTree();
let pruneMode = false;
let voxelCount = 0;

function newTree(): BonsaiTree {
  const seed = (document.getElementById('seed') as HTMLInputElement).valueAsNumber || 42;
  const species = (document.getElementById('species') as HTMLSelectElement).value as SpeciesClass;
  const t = new BonsaiTree(seed, species);
  t.markDirty();
  return t;
}

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------
const canvas = document.getElementById('tree') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const meta = document.getElementById('meta')!;
const statTable = document.getElementById('stat-table')!;
const voxelCountEl = document.getElementById('voxel-count')!;
const fertStatus = document.getElementById('fert-status')!;
const exportOut = document.getElementById('export-out') as HTMLTextAreaElement;

// ---------------------------------------------------------------------------
// Rendering — 2D recursive branch walk (same projection as the old demo).
// ---------------------------------------------------------------------------
const POT_X = 400, POT_Y = 560;

function render(): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // pot
  ctx.fillStyle = '#8a4b2d';
  ctx.fillRect(POT_X - 60, POT_Y, 120, 30);

  const branches = tree.getBranches();
  drawBranch(branches[0], POT_X, POT_Y, 0, branches);

  const trunk = branches[0];
  const trunkH = Math.max(1, trunk.length);
  const oneThird = trunkH * 0.33;
  const below = branches.filter(
    (b) => !b.pruned && b.depth === 1 && (b as any).bornDay !== undefined && b.length > 0 && (b as any).attachmentY === undefined && b.length <= oneThird,
  ).length;
  const above = branches.filter((b) => !b.pruned && b.depth === 1 && b.length > oneThird).length;
  const thirdRule = `${below} low / ${above} high depth-1`;

  meta.textContent =
    `seed ${tree.getSeed()} · ${tree.getSpecies()} · day ${tree.getAge()} · ` +
    `health ${tree.getHealth().toFixed(0)} · moisture ${tree.getMoisture().toFixed(0)} · ` +
    `${tree.countLivingBranches()} branches (${tree.getPrunedCount()} pruned) · ` +
    `⅓-rule: ${thirdRule}`;
  meta.className = tree.getMoisture() < 15 || tree.getMoisture() > 80 ? 'moisture-bad' : '';

  fertStatus.textContent = tree.isFertilizerActive()
    ? 'fertilizer ACTIVE (1.7× growth)'
    : '';
}

function drawBranch(b: Branch, x: number, y: number, absAngle: number, branches: Branch[]): void {
  if (b.pruned) return;
  const rad = (absAngle * Math.PI) / 180;
  const scale = 3;
  const ex = x + Math.sin(rad) * b.length * scale;
  const ey = y - Math.cos(rad) * b.length * scale;

  ctx.strokeStyle = b.depth === 0 ? '#6b4f2a' : '#7a5c33';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1, b.thickness);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  const living = b.children.filter((c) => !branches[c].pruned);
  if (living.length === 0 && b.depth >= 1) {
    ctx.fillStyle = '#5a8f3c';
    ctx.beginPath();
    ctx.arc(ex, ey, 4 + b.length * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const c of living) {
    drawBranch(branches[c], ex, ey, absAngle + branches[c].angle, branches);
  }
}

// Hit-test: find the nearest non-pruned, non-trunk branch within `limit` px of (px,py).
// Walks the tree accumulating endpoints the same way drawBranch does.
function pickBranch(px: number, py: number): number | null {
  const branches = tree.getBranches();
  let best: number | null = null;
  let bestDist = 22; // px click tolerance

  function walk(b: Branch, x: number, y: number, absAngle: number): void {
    if (b.pruned) return;
    const rad = (absAngle * Math.PI) / 180;
    const scale = 3;
    const ex = x + Math.sin(rad) * b.length * scale;
    const ey = y - Math.cos(rad) * b.length * scale;

    if (b.depth > 0) {
      // distance from click point to segment (x,y)-(ex,ey)
      const d = distToSegment(px, py, x, y, ex, ey);
      if (d < bestDist) { bestDist = d; best = b.id; }
    }
    for (const c of b.children) {
      const child = branches[c];
      if (!child.pruned) walk(child, ex, ey, absAngle + child.angle);
    }
  }
  walk(branches[0], POT_X, POT_Y, 0);
  return best;
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// ---------------------------------------------------------------------------
// Live stats — voxelize + derive on demand (throttled: only after mutations).
// ---------------------------------------------------------------------------
function refreshStats(): void {
  const { voxels, zones } = Voxelizer.voxelize(tree);
  voxelCount = voxels.count();
  const sheet = StatDeriver.derive(tree, voxels, tree.getSeed(), tree.getAge(), zones);

  voxelCountEl.textContent = `${voxelCount} voxels`;
  const rows: Array<[string, number | string]> = [
    ['HP', sheet.hp],
    ['Power', sheet.power],
    ['Endurance', sheet.endurance],
    ['Ki', sheet.ki],
    ['Skill slots', sheet.skillSlots],
    ['Skill points', sheet.skillPoints],
    ['Wisdom (tier)', sheet.wisdom],
    ['Match %', (sheet.matchPct * 100).toFixed(1) + '%'],
    ['Defense', sheet.defense],
    ['Stability', sheet.stability],
  ];
  statTable.innerHTML = rows
    .map(([k, v]) => `<tr><td>${k}</td><td>${typeof v === 'number' ? v.toFixed(2) : v}</td></tr>`)
    .join('');
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

/**
 * Fire-and-forget care action persist: applies the action locally first (UI is
 * already updated by the caller), then persists to Supabase in the background.
 * If there is no session or the session is read-only, the action is silently
 * skipped — the page continues to work in local-only mode.
 *
 * Errors are logged to the console (not shown as UI alerts) because the 2D
 * page is a debug tool and a transient network failure shouldn't break the UI.
 * The local tree state is already consistent; the only risk is state diverging
 * from the server until the next successful persist.
 */
function persistAsync(action: Parameters<typeof persistCareAction>[1]): void {
  if (!kijoSession || !kijoSession.access_token || !kijoSession.wallet_row_id) return;
  const session = kijoSession;
  persistCareAction(session, action).catch((err: unknown) => {
    console.error('[kijo] persist failed:', err instanceof Error ? err.message : err);
  });
}

// ---------------------------------------------------------------------------
// Mount: load tree from Supabase and replay care log to restore state.
// ---------------------------------------------------------------------------

/**
 * On mount:
 *   1. Read session from sessionStorage / URL params.
 *   2. If a tree_id is known, fetch the tree from the get-tree Edge Function.
 *   3. Replay past-day entries via CareLogReplay.reconstruct (up to current_day ticks).
 *   4. Apply current-day entries (game_day === current_day) directly — these
 *      happened after the most recent tick and must not be ticked again.
 *   5. Sync the seed/species DOM inputs to the server values.
 *   6. Render.
 *
 * Falls back to a fresh in-memory tree (current behavior) if:
 *   - No session / tree_id available (guest / dev mode).
 *   - get-tree fetch fails (network error, tree not found, etc.).
 *
 * Note: the "Advance day ×N" debug button is intentionally NOT persisted.
 *   The server advances game days based on real wall-clock time (8 hr = 1 day).
 *   Local day-advances are a sandbox convenience and will be overwritten on the
 *   next refresh by the server's current_day.
 */
async function init(): Promise<void> {
  kijoSession = getSession();

  if (kijoSession?.tree_id) {
    try {
      const { treeData, careLog } = await loadCareLog(kijoSession.tree_id);

      if (treeData.current_day === 0) {
        // No ticks have elapsed yet — start with the server's seed/species.
        // Do NOT call CareLogReplay.reconstruct (it throws on totalDays <= 0).
        tree = new BonsaiTree(treeData.seed, treeData.species as SpeciesClass);
        // Apply any day-0 actions (e.g., watering before the first tick).
        const day0Entries = careLog.filter((e) => e.day === 0);
        applyCurrentDayEntries(tree, day0Entries);
      } else {
        // Replay completed tick-cycles.
        // Past entries: game_day < current_day — each has a tick after it.
        const priorLog = careLog.filter((e) => e.day < treeData.current_day);
        tree = CareLogReplay.reconstruct(
          treeData.seed,
          treeData.species as SpeciesClass,
          priorLog,
          treeData.current_day,
        );
        // Current-day entries: game_day === current_day — after the last tick,
        // before the next one.  Apply directly without growTick.
        const currentDayEntries = careLog.filter(
          (e) => e.day === treeData.current_day,
        );
        applyCurrentDayEntries(tree, currentDayEntries);
      }

      // Sync DOM inputs to the server's authoritative seed/species.
      (document.getElementById('seed') as HTMLInputElement).value = String(treeData.seed);
      (document.getElementById('species') as HTMLSelectElement).value = treeData.species;

      const mode = kijoSession.access_token ? 'read-write' : 'read-only';
      console.info(
        `[kijo] tree restored — id=${kijoSession.tree_id} ` +
        `day=${treeData.current_day} actions=${careLog.length} mode=${mode}`,
      );
    } catch (err: unknown) {
      console.error(
        '[kijo] failed to restore tree from Supabase; starting fresh.',
        err instanceof Error ? err.message : err,
      );
      // Fall through: tree remains the initial newTree() value.
    }
  }

  refreshStats();
  render();
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------
document.getElementById('btn-new')!.addEventListener('click', () => {
  // Creating a new in-memory tree severs the link to the persisted tree.
  // Clear the session so subsequent care actions are not sent to the wrong tree.
  kijoSession = null;
  tree = newTree();
  pruneMode = false;
  document.getElementById('btn-prune')!.classList.remove('active');
  exportOut.value = '';
  refreshStats();
  render();
});

document.getElementById('btn-water')!.addEventListener('click', () => {
  tree.water(WATER_AMOUNT);
  tree.markDirty();
  render();
  persistAsync({ type: 'water', amount: WATER_AMOUNT });
});

document.getElementById('btn-fertilize')!.addEventListener('click', () => {
  tree.fertilize();
  render();
  persistAsync({ type: 'fertilize' });
});

document.getElementById('btn-rotate')!.addEventListener('click', () => {
  tree.rotate();
  render();
  persistAsync({ type: 'rotate' });
});

const pruneBtn = document.getElementById('btn-prune')!;
pruneBtn.addEventListener('click', () => {
  pruneMode = !pruneMode;
  pruneBtn.classList.toggle('active', pruneMode);
});

canvas.addEventListener('click', (e) => {
  if (!pruneMode) return;
  const rect = canvas.getBoundingClientRect();
  const id = pickBranch(e.clientX - rect.left, e.clientY - rect.top);
  if (id !== null) {
    tree.prune(id);
    refreshStats();
    render();
    persistAsync({ type: 'prune', branchId: id });
  }
});

document.getElementById('btn-day')!.addEventListener('click', () => {
  // Local-only debug advance: not persisted to Supabase.
  // The server advances days based on real time (8 hr = 1 game day).
  const n = Math.max(1, Math.min(30, (document.getElementById('days-multi') as HTMLInputElement).valueAsNumber || 1));
  for (let i = 0; i < n; i++) {
    GrowthEngine.growTick(tree);
  }
  refreshStats();
  render();
});

// ---------------------------------------------------------------------------
// Export — exact fixture shape the Godot game loads (KijoStats.from_json).
// ---------------------------------------------------------------------------
document.getElementById('btn-export')!.addEventListener('click', () => {
  const { voxels, zones } = Voxelizer.voxelize(tree);
  const sheet = StatDeriver.derive(tree, voxels, tree.getSeed(), tree.getAge(), zones);
  const payload = {
    seed: tree.getSeed(),
    species: tree.getSpecies().toUpperCase(),
    ageDays: tree.getAge(),
    generatedAt: new Date().toISOString(),
    stats: {
      hp: sheet.hp,
      power: sheet.power,
      endurance: sheet.endurance,
      ki: sheet.ki,
      skillSlots: sheet.skillSlots,
      skillPoints: sheet.skillPoints,
      wisdom: sheet.wisdom,
      matchPct: sheet.matchPct,
      defense: sheet.defense,
      stability: sheet.stability,
    },
  };
  exportOut.value = JSON.stringify(payload, null, 2);
});

document.getElementById('btn-copy')!.addEventListener('click', async () => {
  if (exportOut.value) await navigator.clipboard.writeText(exportOut.value);
});

// Boot — restore from Supabase if session is available, otherwise start fresh.
void init();
