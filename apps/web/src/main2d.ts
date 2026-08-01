import { BonsaiTree, GrowthEngine, StatDeriver } from '@kijo/engine';
import type { Branch, SpeciesClass } from '@kijo/shared';
import { WATER_AMOUNT } from '@kijo/shared';
import { Voxelizer } from '@kijo/voxelizer';

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
// Controls
// ---------------------------------------------------------------------------
document.getElementById('btn-new')!.addEventListener('click', () => {
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
});

document.getElementById('btn-fertilize')!.addEventListener('click', () => {
  tree.fertilize();
  render();
});

document.getElementById('btn-rotate')!.addEventListener('click', () => {
  tree.rotate();
  render();
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
  }
});

document.getElementById('btn-day')!.addEventListener('click', () => {
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

// Boot
refreshStats();
render();
