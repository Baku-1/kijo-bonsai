import { createTree, tick, applyAction } from '@kijo/engine';
import type { TreeState, Branch } from '@kijo/shared';

// Demo: grow a hardwood 200 days with regular watering, render the result.
let tree: TreeState = createTree(42, 'hardwood');
for (let d = 0; d < 200; d++) {
  if (d % 3 === 0) tree = applyAction(tree, { type: 'water' });
  tree = tick(tree);
}

const canvas = document.getElementById('tree') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const meta = document.getElementById('meta')!;
meta.textContent = `seed 42 · hardwood · day ${tree.day} · health ${tree.health.toFixed(0)} · ${tree.branches.length} branches`;

function drawBranch(b: Branch, x: number, y: number, absAngle: number): void {
  if (b.pruned) return;
  const rad = (absAngle * Math.PI) / 180;
  const scale = 3;
  const ex = x + Math.sin(rad) * b.length * scale;
  const ey = y - Math.cos(rad) * b.length * scale;

  ctx.strokeStyle = '#6b4f2a';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1, b.thickness);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  const living = b.children.filter((c) => !tree.branches[c].pruned);
  if (living.length === 0 && b.depth >= 1) {
    ctx.fillStyle = '#5a8f3c';
    ctx.beginPath();
    ctx.arc(ex, ey, 4 + b.length * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const c of living) drawBranch(tree.branches[c], ex, ey, absAngle + tree.branches[c].angle);
}

// Pot
ctx.fillStyle = '#8a4b2d';
ctx.fillRect(340, 560, 120, 30);
drawBranch(tree.branches[0], 400, 560, 0);
