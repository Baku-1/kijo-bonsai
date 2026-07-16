import type { CareAction, SpeciesClass, TreeState } from '@kijo/shared';
import { nextRand } from './rng.js';
import { SPECIES } from './species.js';

export const MAX_DEPTH = 6;
const FORK_LENGTH_THRESHOLD = 6;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** GDD §3.2 moisture bands → growth condition modifier. */
export function conditionModifier(moisture: number): number {
  if (moisture < 20) return 0.15; // drought stress
  if (moisture < 30) return 0.6;
  if (moisture <= 65) return 1.0; // optimal
  if (moisture <= 80) return 0.7;
  return 0.4;                     // overwatered
}

export function createTree(seed: number, species: SpeciesClass): TreeState {
  return {
    seed,
    species,
    day: 0,
    moisture: 50,
    health: 60,
    rotation: 0,
    fertilizerDays: 0,
    fertilizerCooldown: 0,
    rngState: seed | 0,
    branches: [
      { id: 0, parent: null, depth: 0, angle: 0, length: 8, thickness: 2, pruned: false, children: [] }
    ]
  };
}

export function applyAction(prev: TreeState, action: CareAction): TreeState {
  const s = structuredClone(prev);
  switch (action.type) {
    case 'water':
      s.moisture = clamp(s.moisture + 25, 0, 100);
      break;
    case 'rotate':
      // TODO(Phase 0): light-side growth bias uses this (GDD §3.2)
      s.rotation = (s.rotation + 90) % 360;
      break;
    case 'fertilize':
      if (s.fertilizerCooldown === 0) {
        s.fertilizerDays = 5;   // ~1.7x for 5 days
        s.fertilizerCooldown = 8;
      } else {
        s.health = clamp(s.health - 5, 0, 100); // burn (GDD §3.2)
      }
      break;
    case 'prune': {
      // Permanent: mark branch + all descendants (GDD §3.2)
      const stack = [action.branchId];
      while (stack.length > 0) {
        const id = stack.pop()!;
        const b = s.branches[id];
        if (!b || b.pruned) continue;
        b.pruned = true;
        stack.push(...b.children);
      }
      break;
    }
  }
  return s;
}

/** One game-day tick. Deterministic: identical input state ⇒ identical output state. */
export function tick(prev: TreeState): TreeState {
  const s = structuredClone(prev);
  const sp = SPECIES[s.species];

  s.day += 1;
  s.moisture = clamp(s.moisture - sp.moistureDecay, 0, 100);

  const optimal = s.moisture >= 30 && s.moisture <= 65;
  s.health = clamp(s.health + (optimal ? 0.8 : -1.5), 0, 100);

  const fert = s.fertilizerDays > 0 ? 1.7 : 1;
  if (s.fertilizerDays > 0) s.fertilizerDays -= 1;
  if (s.fertilizerCooldown > 0) s.fertilizerCooldown -= 1;

  const cond = conditionModifier(s.moisture);
  const healthMod = 0.5 + s.health / 200; // 0.5–1.0
  const growth = sp.growthRate * cond * fert * healthMod;

  // Tips: living branches with no living children. Iterate in id order for determinism.
  const tipIds = s.branches
    .filter((b) => !b.pruned && b.children.every((c) => s.branches[c].pruned))
    .map((b) => b.id);

  for (const id of tipIds) {
    const b = s.branches[id];
    const depthFalloff = 1 / (1 + b.depth * 0.4);
    b.length += growth * depthFalloff * 4;

    if (b.depth >= MAX_DEPTH || b.length <= FORK_LENGTH_THRESHOLD) continue;
    const p = sp.forkChance * cond * (1 - b.depth / (MAX_DEPTH + 1));
    let r = nextRand(s.rngState);
    s.rngState = r.state;
    if (r.value >= p) continue;

    r = nextRand(s.rngState);
    s.rngState = r.state;
    const nChildren = r.value < 0.5 ? 1 : 2;
    for (let i = 0; i < nChildren; i++) {
      r = nextRand(s.rngState);
      s.rngState = r.state;
      const side = i === 0 ? 1 : -1;
      const child = {
        id: s.branches.length,
        parent: b.id,
        depth: b.depth + 1,
        angle: side * sp.forkAngle * (0.5 + r.value),
        length: 1,
        thickness: Math.max(0.3, b.thickness * 0.5),
        pruned: false,
        children: []
      };
      s.branches.push(child);
      b.children.push(child.id);
    }
  }

  // Inner branches thicken with living children; trunk thickens every tick (GDD §3.3).
  for (const b of s.branches) {
    if (b.pruned) continue;
    const living = b.children.filter((c) => !s.branches[c].pruned).length;
    if (living > 0) b.thickness += sp.thickenRate * 0.5 * living;
  }
  s.branches[0].thickness += sp.thickenRate;

  return s;
}
