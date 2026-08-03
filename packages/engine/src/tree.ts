import type { CareAction, SpeciesClass, TreeState } from '@kijo/shared';
import { round4 } from '@kijo/shared';
import { nextRand } from './rng.js';
import { SPECIES } from './species.js';

export const MAX_DEPTH = 6;
const FORK_LENGTH_THRESHOLD = 6;
// Minimum trunk length before first depth-1 fork -- mirrors GrowthEngine constant.
// Enforces one-third / bare-lower-third rule (KIJO-TECH-SPEC s4.6, DECISIONS.md 2026-07-18).
// Flagged for playtest tuning.
const MIN_TRUNK_FOR_FIRST_BRANCH = 20;

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
      {
        id: 0, parent: null, depth: 0, angle: 0, length: 8, thickness: 2, pruned: false, children: [], attachmentY: 0,
        // Physics fields (2026-08-01): trunk starts at thickness=2 (radius), so diameter=4.
        // All binding fields default to 0/false (no bindings on creation).
        diameter:         4,      // round4(2 × thickness=2) = 4.0
        currentStress:    0,
        stressInitial:    0,
        wired:            false,
        wireAppliedDay:   0,
        wireAngle:        0,
        wireSet:          false,
        wireScarred:      false,
        twined:           false,
        twineAppliedDay:  0,
        twineAngle:       0,
        twineForcePerDay: 0,
        weighted:         false,
        weightCount:      0,
        twineDegradesDay: 0,
        bendSet:          false,  // CRITICAL-C fix 2026-08-02
      }
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

    // One-third rule (KIJO-TECH-SPEC s4.6): count existing depth-1 branches for trunk.
    // Suppress first depth-1 fork until trunk is long enough -- mirrors GrowthEngine.extendAndFork.
    // See DECISIONS.md 2026-07-18 and 2026-07-20.
    const existingD1 = b.depth === 0
      ? s.branches.filter(br => br.depth === 1 && !br.pruned).length
      : -1;
    if (b.depth === 0 && existingD1 === 0 && b.length < MIN_TRUNK_FOR_FIRST_BRANCH) continue;

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
      // depth-1 primary child when it is the first ever: one-third rule (mirrors GrowthEngine).
      // All other children (secondary depth-1, depth-2+): attach at parent tip.
      const attachmentY = (b.depth === 0 && i === 0 && existingD1 === 0)
        ? round4(b.length * 0.33)
        : round4(b.length);
      const childThickness = Math.max(0.3, b.thickness * 0.5);
      const child = {
        id: s.branches.length,
        parent: b.id,
        depth: b.depth + 1,
        angle: side * sp.forkAngle * (0.5 + r.value),
        length: 1,
        thickness: childThickness,
        pruned: false,
        children: [] as number[],
        attachmentY,
        // Physics fields (2026-08-01): zero/false defaults for new branches.
        diameter:         round4(2 * childThickness),
        currentStress:    0,
        stressInitial:    0,
        wired:            false,
        wireAppliedDay:   0,
        wireAngle:        0,
        wireSet:          false,
        wireScarred:      false,
        twined:           false,
        twineAppliedDay:  0,
        twineAngle:       0,
        twineForcePerDay: 0,
        weighted:         false,
        weightCount:      0,
        twineDegradesDay: 0,
        bendSet:          false,  // CRITICAL-C fix 2026-08-02
      };
      s.branches.push(child as unknown as import('@kijo/shared').Branch);
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

  // Major-1 fix (2026-08-02): sync diameter after all thickness updates.
  // Without this, physics code run on a tick()-produced tree computes wrong S = τ/D³.
  // GrowthEngine.thickeningPass() already does this for the GrowthEngine path; this
  // fixes the legacy tick() path (used by determinism tests and replay).
  // Audit confirmed 1.6 voxel diameter drift at day 10 on this path.
  for (const b of s.branches) {
    if (!b.pruned) {
      b.diameter = round4(2 * b.thickness);
    }
  }

  return s;
}
