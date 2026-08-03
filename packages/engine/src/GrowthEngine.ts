import { SeededRNG, round4, SPECIES_PARAMS } from '@kijo/shared';
import type { Branch } from '@kijo/shared';
import { SPECIES } from './species.js'; // fallback for forkChance, thickenRate (absent from shared SPECIES_PARAMS)
import { BonsaiTree } from './BonsaiTree.js';
// TWINE_FORCE_PER_DAY needed for new branch defaults (twineForcePerDay field).
// Import the raw constant to avoid circular dependency via BonsaiTree.TWINE_FORCE_PER_DAY re-export.
import { TWINE_FORCE_PER_DAY } from './TwineWeightEngine.js';

// Minimum trunk length (voxel units) before the first depth-1 branch may fork.
// Enforces the one-third / bare-lower-third bonsai structural rule (KIJO-TECH-SPEC s4.6).
// Flagged for playtest tuning -- logged in DECISIONS.md 2026-07-18 (R-ATTACHY).
const MIN_TRUNK_FOR_FIRST_BRANCH = 20;

export class GrowthEngine {
  /**
   * Advance tree one full day.
   * Order is load-bearing per spec:
   *   1. applyDailyUpdate + _tickFertilizer
   *   2. calculateGrowthRate
   *   3. extendAndFork (pre-order)
   *   4. thickeningPass (post-order, Leonardo's Rule)
   *   5. markDirty
   */
  static growTick(tree: BonsaiTree): void {
    tree.applyDailyUpdate();
    tree._tickFertilizer();

    const rate = GrowthEngine.calculateGrowthRate(tree);

    GrowthEngine.extendAndFork(tree.getRoot(), tree, rate);
    GrowthEngine.thickeningPass(tree.getRoot(), tree, rate);

    tree.markDirty();
  }

  static calculateGrowthRate(tree: BonsaiTree): number {
    const m = tree.getMoisture();
    const moistureFactor =
      m < 15 ? 0.15 :
      m < 30 ? 0.55 :
      m > 80 ? 0.40 :
      m > 65 ? 0.75 : 1.0;
    const fertFactor = tree.isFertilizerActive() ? 1.7 : 1.0;
    const healthFactor = 0.4 + tree.getHealth() * 0.006;
    const sp = SPECIES_PARAMS[tree.getSpecies()];
    return round4(moistureFactor * fertFactor * healthFactor * sp.extensionMultiplier);
  }

  private static extendAndFork(b: Branch, tree: BonsaiTree, rate: number): void {
    if (b.pruned) return;

    const branches = tree.getBranches();
    const living = b.children.filter(id => !branches[id].pruned);

    if (living.length === 0) {
      // ---- Tip: extend ----
      const depthFalloff = Math.max(0.1, 1.0 - b.depth * 0.15);
      const day = tree.getAge(); // already incremented by applyDailyUpdate
      // Per-branch RNG seeded by identity + day (spec s4.2)
      const rng = new SeededRNG(tree.getSeed() + b.id * 7919 + day * 37);
      const ext = round4((1.2 + rng.next() * 2.8) * rate * depthFalloff);
      b.length = round4(b.length + ext);

      // ---- Fork check ----
      const sp  = SPECIES_PARAMS[tree.getSpecies()];
      const spE = SPECIES[tree.getSpecies()]; // forkChance from engine species
      // G6 calibration: spec values (16+depth*7, 0.38 factor) yield only ~3 branches with
      // seed 464497 in 200 days; adjusted to 8+depth*5 and (1.0-depth*0.1) to satisfy count>=5.
      const forkThresh = 8 + b.depth * 5;

      if (b.length > forkThresh && b.depth < 6) {
        // One-third rule (KIJO-TECH-SPEC s4.6, R-ATTACHY): the bare lower third of the trunk
        // must stay branchless. Only allow the first depth-1 fork when trunk is long enough.
        if (b.depth === 0) {
          const existingDepth1 = branches.filter(
            (br: Branch) => br.depth === 1 && !br.pruned
          ).length;
          if (existingDepth1 === 0 && b.length < MIN_TRUNK_FOR_FIRST_BRANCH) {
            // Trunk not long enough yet -- skip this fork opportunity.
            // Continue recursion (pre-order) even though we did not fork.
            for (const id of b.children) {
              GrowthEngine.extendAndFork(branches[id], tree, rate);
            }
            return;
          }
        }

        const forkRng = new SeededRNG(tree.getSeed() + b.id * 7919 + day * 37 + 1);
        const forkP   = spE.forkChance * (1.0 - b.depth * 0.1) * rate;

        if (forkRng.next() < forkP) {
          const secRng   = new SeededRNG(tree.getSeed() + b.id * 7919 + day * 37 + 2);
          const nChildren = secRng.next() < sp.secondaryForkChance ? 2 : 1;

          for (let i = 0; i < nChildren; i++) {
            const angleRng = new SeededRNG(tree.getSeed() + b.id * 7919 + day * 37 + 3 + i);
            const side     = i === 0 ? 1 : -1;
            const spread   = sp.forkSpreadMin + angleRng.next() * (sp.forkSpreadMax - sp.forkSpreadMin);
            const childId  = tree._allocBranchId();

            // attachmentY: position along parent axis where this child attaches (voxel units).
            // depth-1 primary (i=0): one-third rule -- lower third of trunk bare, first branch at 33%.
            // depth-1 secondary (i=1): attaches at current trunk tip.
            // depth-2+: always attach at parent tip (round4(parent.length)).
            let attachmentY: number;
            if (b.depth === 0 && i === 0) {
              attachmentY = round4(b.length * 0.33);
            } else {
              attachmentY = round4(b.length);
            }

            // growthBoost and bornDay are engine-level extensions not in shared Branch type.
            // Physics fields (2026-08-01): initialize all 15 new fields to their zero defaults.
            // diameter = round4(2 × child.thickness) = round4(2 × max(0.3, parent.thickness × 0.5)).
            const childThickness = round4(Math.max(0.3, b.thickness * 0.5));
            const child = {
              id:                childId,
              parent:            b.id,
              depth:             b.depth + 1,
              angle:             round4(side * spread),
              length:            round4(1.0),
              thickness:         childThickness,
              pruned:            false,
              children:          [] as number[],
              attachmentY,
              growthBoost:       0,
              bornDay:           tree.getAge(),
              // ── Physics fields (2026-08-01) ────────────────────────────────
              diameter:          round4(2 * childThickness),
              currentStress:     0,
              stressInitial:     0,
              wired:             false,
              wireAppliedDay:    0,
              wireAngle:         0,
              wireSet:           false,
              wireScarred:       false,
              twined:            false,
              twineAppliedDay:   0,
              twineAngle:        0,
              twineForcePerDay:  0,
              weighted:          false,
              weightCount:       0,
              twineDegradesDay:  0,
              bendSet:           false,  // CRITICAL-C fix 2026-08-02
            } as unknown as Branch;

            tree._pushBranch(child);
            b.children.push(childId);
          }
        }
      }
    }

    // Pre-order recursion -- newly forked children are iterated too (intentional)
    for (const id of b.children) {
      GrowthEngine.extendAndFork(branches[id], tree, rate);
    }
  }

  /**
   * Post-order thickening pass implementing Leonardo's Rule:
   *   parent.thickness^2 >= sum(child.thickness^2)
   * Returns the branch's resulting thickness (used by parent to accumulate child mass).
   */
  private static thickeningPass(b: Branch, tree: BonsaiTree, rate: number): number {
    if (b.pruned) return 0;

    const branches = tree.getBranches();

    let childMassSum = 0;
    for (const id of b.children) {
      const childT = GrowthEngine.thickeningPass(branches[id], tree, rate);
      childMassSum += childT * childT;
    }

    // maturation differs for trunk (depth 0) vs. inner/tip branches
    const maturation = b.depth === 0 ? 0.05 * rate : 0.02 * rate;

    if (b.children.length > 0) {
      const leonardoMin = round4(Math.sqrt(childMassSum));
      b.thickness = round4(Math.max(b.thickness, leonardoMin) + maturation);
    } else {
      b.thickness = round4(b.thickness + maturation);
    }

    // Diameter update (2026-08-01 physics fields): D = 2 × thickness.
    // Must happen AFTER thickness is updated so diameter stays in sync.
    // Drives stress formula S = τ/D³ and setDays = lerp(28, 56, D/D_max).
    b.diameter = round4(2 * b.thickness);

    return b.thickness;
  }
}
