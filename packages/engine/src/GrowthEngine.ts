import { SeededRNG, round4, SPECIES_PARAMS } from '@kijo/shared';
import type { Branch, SpeciesParams } from '@kijo/shared';
// Species grammar (design 3.4, retired in step I8): ONE live table, SPECIES_PARAMS in
// @kijo/shared, so the engine, the server bundle and the client all read the same numbers.
// packages/engine/src/species.ts is retired; nothing imports it any more.
import { BonsaiTree } from './BonsaiTree.js';
// TWINE_FORCE_PER_DAY needed for new branch defaults (twineForcePerDay field).
// Import the raw constant to avoid circular dependency via BonsaiTree.TWINE_FORCE_PER_DAY re-export.
import { TWINE_FORCE_PER_DAY } from './TwineWeightEngine.js';

// Minimum trunk length (voxel units) before the first depth-1 branch may fork.
// Enforces the one-third / bare-lower-third bonsai structural rule (KIJO-TECH-SPEC s4.6).
// Flagged for playtest tuning -- logged in DECISIONS.md 2026-07-18 (R-ATTACHY).
const MIN_TRUNK_FOR_FIRST_BRANCH = 20;

// Newborn branch length (voxels). Every branch is created at exactly this length (see the
// child literal in extendAndFork), so the extension a branch has accumulated since birth is
// exactly round4(b.length - NEWBORN_BRANCH_LENGTH). That is what the v2 internode gate
// (design 3.2b) measures, which is why no new Branch field is needed for it (design A6/R-4).
// If a different birth length is ever introduced, the internode schedule drifts silently:
// scripts/band-check.mjs and test_growth.mjs assert this invariant.
const NEWBORN_BRANCH_LENGTH = 1.0;

// Rotation (phototropism) bias strength from KIJO-TECH-SPEC.md:326 / design 3.2d:
//   growth_bias = 1.0 + alignment * 0.15
// so the factor spans 0.85 (facing away from the sun) to 1.15 (facing it). It multiplies the
// FORK PROBABILITY term ONLY -- never extension -- so the extension path and the G-gates are
// untouched (design R-6). round4() is applied to the returned factor (design 3.6).
const ROTATION_BIAS_STRENGTH = 0.15;

// Taper (design 3.2e, step I7). KIJO-TECH-SPEC.md:371-385 calls monotonic taper a CORRECTNESS
// CONSTRAINT: the trunk is thickest at the base and thins toward the apex, and the lowest main
// branch is the thickest. A tree that violates it is malformed, so the engine clamps it every
// day and can assert it (GrowthEngine.taperReport).
const TAPER_CLAMP_FACTOR = 0.95;   // design :189: child.thickness <= round4(parent.thickness * 0.95)
const MIN_BRANCH_THICKNESS = 0.3;  // the same floor the pre-v2 fork-time literal used

// ---------------------------------------------------------------------------
// Step I7 observability: the 3.2e taper report and the combat-stat delta surface.
// Plain data only. No new tree state, and nothing the voxelizer or StatDeriver reads (R8).
// ---------------------------------------------------------------------------

export interface TaperNode {
  id: number;
  depth: number;
  attachmentY: number;
  thickness: number;
}

/** Result of the 3.2e taper assertion at the moment it is asked for. */
export interface TaperReport {
  ok: boolean;
  violations: string[];
  spine: TaperNode[];   // trunk -> apex: living chain of most-distal children
  mains: TaperNode[];   // living depth-1 mains, ascending attachmentY
}

/**
 * Structural stat snapshot. skillSlots (depth2Plus) mirrors StatDeriver's definition
 * (StatDeriver.ts:111-112, KIJO-ENGINE-API.md:79): non-pruned depth-2+ branch COUNT.
 */
export interface GrowthStatSnapshot {
  day: number;
  livingBranches: number;
  depth1Mains: number;
  depth2Plus: number;
  trunkThickness: number;
  totalMass: number;
}

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

    // v2 floor/ceiling controller snapshot (design 3.2c, step I5).
    // Taken ONCE per day, BEFORE any fork, with the same definition as
    // BonsaiTree.countLivingBranches() (living, trunk excluded). The traversal never calls
    // countLivingBranches() again: the day's fork outcome must not depend on how many
    // branches exist halfway through the walk.
    const livingCount0 = tree.countLivingBranches();
    // The floor's single eligible tip, preselected once per day in flat-array id order.
    // -1 means the floor is not active today (in band, above cap, not yet floorDay, or dead).
    const floorTipId = GrowthEngine.selectFloorTipId(tree, rate, livingCount0);

    GrowthEngine.extendAndFork(tree.getRoot(), tree, rate, livingCount0, floorTipId);
    GrowthEngine.thickeningPass(tree.getRoot(), tree, rate);
    // Taper clamp (design 3.2e, step I7). LAST write of the day: it runs after Leonardo
    // thickening so the saved state always satisfies the monotonic-taper constraint, which is
    // what makes the assertion (taperReport) meaningful at any day boundary.
    GrowthEngine.enforceTaper(tree);

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

  /**
   * Determine if branch `b` is the "leader" child among its parent's living children.
   * Leader = longest living sibling. Trunk (depth 0) is always leader.
   * Tiebreaker: lowest array index wins on equal length (deterministic by insertion order;
   * primary child i=0 is pushed first during fork — FINDING-3 from critic doc).
   */
  private static isLeaderChild(b: Branch, branches: Branch[]): boolean {
    if (b.depth === 0) return true; // trunk is always leader
    const parent = branches[b.parent!];
    const siblings = parent.children.filter(id => !branches[id].pruned);
    if (siblings.length <= 1) return true;
    // Leader = first sibling with max length (lowest index wins ties)
    let maxLen = -1;
    let leaderId = siblings[0];
    for (const id of siblings) {
      if (branches[id].length > maxLen) {
        maxLen = branches[id].length;
        leaderId = id;
      }
    }
    return leaderId === b.id;
  }

  /**
   * v2 internode schedule (design 3.2b; values from design 3.4 as calibrated in step I4):
   * the voxel extension a tip at `depth` must accumulate after birth before it may fork.
   * Replaces the pre-v2 linear threshold `b.length > 8 + depth * 5`. Every returned value
   * goes through round4 so the gate only ever compares deterministic numbers.
   */
  private static internode(spE: SpeciesParams, depth: number): number {
    return round4(spE.internodeBase + spE.internodeDepthStep * depth);
  }

  /**
   * v2 fork-gate eligibility (design 3.2b), shared by the traversal and the floor pre-scan so
   * both apply exactly the same test. Replaces the pre-v2 threshold
   * `b.length > 8 + depth * 5`, which every tip cleared within a few days and which deep tips
   * could never clear again once their extension had decayed.
   *   tip   (depth > 0): must have EXTENDED internode(spE, depth) voxels since birth
   *   trunk (depth 0)  : must have extended trunkInternode(spE) voxels since its last fork
   * The trunk's length at its last forking is the tree-level scalar
   * TreeState.lastMainForkLength (0 == never forked). round4 on both sides keeps the
   * comparison deterministic and free of float drift (DECISIONS.md:10).
   */
  private static internodeCleared(b: Branch, tree: BonsaiTree): boolean {
    const state = tree._getState();
    const spE   = SPECIES_PARAMS[tree.getSpecies()];
    return b.depth === 0
      ? round4(b.length - state.lastMainForkLength) >= round4(spE.trunkInternode)
      : round4(b.length - NEWBORN_BRANCH_LENGTH) >= GrowthEngine.internode(spE, b.depth);
  }

  /**
   * One-third rule gate (KIJO-TECH-SPEC s4.6, R-ATTACHY): the bare lower third of the trunk
   * must stay branchless. The FIRST main is additionally gated on trunk length; later mains
   * attach at the then-current trunk tip, so the bare zone never moves downward.
   */
  private static isFirstMainBlocked(b: Branch, branches: Branch[]): boolean {
    if (b.depth !== 0) return false;
    if (b.length >= MIN_TRUNK_FOR_FIRST_BRANCH) return false;
    return !branches.some((br: Branch) => br.depth === 1 && !br.pruned);
  }

  /**
   * v2 floor state (design 3.2c, step I5). True while the living count is under floor(sp), the
   * tree is alive, and the floor day has arrived:
   *   rate > 0                   -- the floor is a guarantee about a LIVING tree (3.2c
   *                                 "conditioning"): a starved tree is not promised growth.
   *   livingCount0 < branchFloor -- below the low end of the R1 band.
   *   day >= floorDay            -- design 3.4: the floor is a catch-up rule, not a head start.
   * Always evaluated against the day-start snapshot, never a fresh mid-walk count.
   */
  static isFloorActive(tree: BonsaiTree, rate: number, livingCount0: number): boolean {
    if (rate <= 0) return false;
    const spCtl = SPECIES_PARAMS[tree.getSpecies()];
    if (livingCount0 >= spCtl.branchFloor) return false;
    return tree.getAge() >= spCtl.floorDay;
  }

  /**
   * v2 floor selection (design 3.2c, step I5): the ONE branch id allowed to fork today while
   * the floor is active, or -1 when it is not.
   *
   * The candidate is the LOWEST branch id whose internode has cleared, evaluated in flat-array
   * id order -- in this engine branches[i].id === i, so array order IS id order. That is what
   * makes the floor deterministic (design :180) instead of a Bernoulli streak. The trunk
   * (id 0) is a candidate because v2 lets it re-fork (3.2a); it still has to clear
   * trunkInternode and the one-third first-main gate.
   */
  static selectFloorTipId(tree: BonsaiTree, rate: number, livingCount0: number): number {
    if (!GrowthEngine.isFloorActive(tree, rate, livingCount0)) return -1;

    const branches = tree.getBranches();
    for (const b of branches) {
      if (b.pruned || b.jinned) continue;
      if (b.depth >= 6) continue;                            // depth-6 hard gate (unchanged)
      const hasLivingChild = b.children.some((id) => !branches[id].pruned);
      if (hasLivingChild && b.depth !== 0) continue;          // only tips fork, plus the trunk (3.2a)
      if (!GrowthEngine.internodeCleared(b, tree)) continue;
      if (GrowthEngine.isFirstMainBlocked(b, branches)) continue;
      return b.id;
    }
    return -1;
  }

  /**
   * apply_rotation_bias (design 3.2d, KIJO-TECH-SPEC.md:316-327) -- step I6.
   *
   *   sun_angle = rotation_state * (PI / 2)         -- rotation_state is the quarter index
   *   alignment = cos(worldAngle(b) - sun_angle)    -- +1 facing the sun, -1 facing away
   *   bias      = 1.0 + alignment * 0.15            -- 0.85 .. 1.15
   *
   * The engine stores rotation in DEGREES (0 | 90 | 180 | 270; rotate() adds one quarter turn,
   * BonsaiTree.ts:178) while b.angle is stored in degrees relative to the parent branch
   * (GrowthEngine.ts fork), so both are converted with * (PI / 180). That reproduces the spec's
   * quarter-turn sun angle exactly for every reachable rotation state, and stays correct if
   * rotation ever lands off a quarter.
   *
   * worldAngle(b) = worldAngle(parent) + b.angle: a walk up the parent chain over state that was
   * fixed at fork time. No new state, no wall clock, no unordered iteration (design 3.6).
   *
   * The caller must use this on the FORK PROBABILITY term only. This function never touches
   * length or extension, which is the R-6 guarantee that keeps the extension invariants and the
   * G-gates untouched.
   */
  static applyRotationBias(b: Branch, branches: Branch[], rotationDegrees: number): number {
    let worldAngleDeg = 0;
    let cursor: Branch | null = b;
    while (cursor !== null) {
      worldAngleDeg += cursor.angle;
      const parentId: number | null = cursor.parent;
      cursor = parentId === null ? null : branches[parentId];
    }

    const worldAngleRad = worldAngleDeg * (Math.PI / 180);
    const sunAngleRad   = rotationDegrees * (Math.PI / 180);
    const alignment     = Math.cos(worldAngleRad - sunAngleRad);
    return round4(1.0 + alignment * ROTATION_BIAS_STRENGTH);
  }

  /**
   * v2 fork probability (design 3.2c / 3.3, step I5).
   *
   *   ceiling: livingCount0 >= cap(sp) -> 0.0. Because that test uses the DAY-START snapshot,
   *            the branch that arrives at the ceiling may still roll its two-child secondary
   *            fork, so the provable living bound is cap + 1.
   *   floor:   the day's fork is deterministic: the preselected id forks and every other
   *            branch is suppressed, so exactly ONE new branch appears that day (design :180).
   *            (The pseudocode at design :226 gives forkP = 1.0 to every branch, which would
   *            fork on every eligible tip in one day; the prose is the stricter, intended
   *            reading and is what is implemented here.)
   *   in band: the unchanged probabilistic roll, forkChance * depth term * rate, with round4()
   *            as every growth number gets (design 3.6, DECISIONS.md:10).
   *
   * `depthFalloffCap` from design :227 is NOT used: the design never defines that term, so the
   * live pre-v2 depth term (1.0 - depth * 0.1) is kept rather than inventing a value for it.
   */
  private static forkProbability(
    b: Branch,
    tree: BonsaiTree,
    rate: number,
    livingCount0: number,
    floorTipId: number,
  ): number {
    // Ceiling first: at or above cap no fork occurs at all, and the floor cannot apply
    // (branchFloor < branchCap for every species).
    const spCtl = SPECIES_PARAMS[tree.getSpecies()];
    if (livingCount0 >= spCtl.branchCap) return 0.0;

    if (GrowthEngine.isFloorActive(tree, rate, livingCount0)) {
      return b.id === floorTipId ? 1.0 : 0.0;
    }

    // In band: the unchanged probabilistic roll, with the rotation bias (design 3.2d, step I6)
    // on the PROBABILITY term only. Extension is computed in extendAndFork and never sees it,
    // so R-6 holds: the bias cannot change how fast anything grows, only whether it forks.
    const spE  = SPECIES_PARAMS[tree.getSpecies()];
    const bias = GrowthEngine.applyRotationBias(b, tree.getBranches(), tree.getRotationState());
    return round4(spE.forkChance * (1.0 - b.depth * 0.1) * rate * bias);
  }

  /**
   * Id-ordered pre-order walk: extend one branch, then decide whether it forks.
   * livingCount0 and floorTipId are the DAY-START controller inputs (design 3.2c, step I5):
   * the living-branch snapshot taken once in growTick and the floor's preselected tip id.
   * Neither is recomputed here, so the walk cannot depend on its own progress.
   */
  private static extendAndFork(
    b: Branch,
    tree: BonsaiTree,
    rate: number,
    livingCount0: number,
    floorTipId: number,
  ): void {
    if (b.pruned || b.jinned) return;

    const branches = tree.getBranches();
    const state    = tree._getState(); // v2: lastMainForkLength read/write (design 3.2a)
    const living = b.children.filter(id => !branches[id].pruned);
    const day = tree.getAge(); // already incremented by applyDailyUpdate
    const sp  = SPECIES_PARAMS[tree.getSpecies()];

    // Exponential depth falloff (resolves R9 — replaces linear max(0.1, 1.0 - depth*0.15)).
    // Species-specific base: HW 0.72, EG 0.68, TR 0.78. See ARCH-NATURAL-GROWTH-MODEL §4.4.
    const depthFalloff = round4(sp.depthFalloffBase ** b.depth);

    // Per-branch RNG seeded by identity + day (spec s4.2)
    const rng = new SeededRNG(tree.getSeed() + b.id * 7919 + day * 37);

    // v2 (design 3.2a): the trunk (depth 0) is exempt from the tip-only fork rule. It enters
    // this path when it already has living children so that it can reach the fork gate below;
    // it still EXTENDS at trunkContinuedRate (see the ternary on `ext`), which is identical
    // to the pre-v2 inner-extension path the trunk used.
    const canFork = living.length === 0 || b.depth === 0;

    if (canFork) {
      // ── TIP or TRUNK-WITH-CHILDREN: extend ──
      // FINDING-1 (critic): subordinate tips get reduced rate via isLeaderChild.
      const isLeader = GrowthEngine.isLeaderChild(b, branches);
      const tipMultiplier = isLeader ? 1.0 : round4(1.0 - sp.apicalDominance * 0.5);
      // A trunk that already has living children keeps the pre-v2 inner-extension formula
      // ((0.8 + rng * 0.4) at trunkContinuedRate). The ternary keeps exactly one rng.next()
      // draw either way, so RNG consumption per branch-day is unchanged by the trunk
      // exemption and the trunk's own extension stays bit-identical to pre-v2.
      const isTrunkContinuation = b.depth === 0 && living.length > 0;
      const ext = isTrunkContinuation
        ? round4((0.8 + rng.next() * 0.4) * rate * depthFalloff * sp.trunkContinuedRate)
        : round4((1.2 + rng.next() * 2.8) * rate * depthFalloff * tipMultiplier);
      b.length = round4(b.length + ext);

      // ── v2 fork gate: internode spacing (3.2b) and repeated trunk forks (3.2a) ──
      // The v2 internode gate (design 3.2b) and the one-third gate (KIJO-TECH-SPEC s4.6,
      // R-ATTACHY) are extracted into helpers, so this walk and the floor pre-scan
      // (selectFloorTipId) apply exactly the same eligibility test.
      const cleared = GrowthEngine.internodeCleared(b, tree);
      const firstMainBlocked = GrowthEngine.isFirstMainBlocked(b, branches);

      if (cleared && !firstMainBlocked && b.depth < 6) {
        const forkRng = new SeededRNG(tree.getSeed() + b.id * 7919 + day * 37 + 1);
        // v2 floor/ceiling controller (design 3.2c, step I5) now owns this number.
        const forkP = GrowthEngine.forkProbability(b, tree, rate, livingCount0, floorTipId);

        if (forkRng.next() < forkP) {
          // v2 (design 3.2a): a trunk fork records where it happened, so the next main is
          // spaced trunkInternode voxels further up the trunk. round4 keeps the write clean.
          if (b.depth === 0) {
            state.lastMainForkLength = round4(b.length);
          }

          const secRng   = new SeededRNG(tree.getSeed() + b.id * 7919 + day * 37 + 2);
          const nChildren = secRng.next() < sp.secondaryForkChance ? 2 : 1;

          for (let i = 0; i < nChildren; i++) {
            const angleRng = new SeededRNG(tree.getSeed() + b.id * 7919 + day * 37 + 3 + i);
            const side     = i === 0 ? 1 : -1;
            const spread   = sp.forkSpreadMin + angleRng.next() * (sp.forkSpreadMax - sp.forkSpreadMin);
            const childId  = tree._allocBranchId();

            // attachmentY: position along parent axis where this child attaches (voxel units).
            // OQ-1 RESOLVED: children keep original attachmentY as parent extends. Biologically accurate.
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
            // Child thickness (design 3.2e, step I7): the pre-v2 fixed half factor is now the
            // per-species SPECIES_PARAMS.childThicknessFactor, so hardwood low branches stay
            // deliberately thick (KIJO-TECH-SPEC s4.6) while tropical stays finer. The 0.3 floor
            // is the same literal the old formula used, now named MIN_BRANCH_THICKNESS. diameter
            // stays 2 * thickness (physics contract) and the value is round4-clean (design 3.6).
            const childThickness = round4(Math.max(MIN_BRANCH_THICKNESS, b.thickness * sp.childThicknessFactor));
            const child = {
              id:                childId,
              parent:            b.id,
              depth:             b.depth + 1,
              angle:             round4(side * spread * (180 / Math.PI)), // SPECIES_PARAMS forkSpread is in radians; branch.angle is stored in degrees
              length:            round4(NEWBORN_BRANCH_LENGTH),
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
              weightAppliedDay:  0,   // OQ-1 Option A (2026-08-14)
              weightAngleDelta:  0,   // OQ-1 Option A (2026-08-14)
              twineDegradesDay:  0,
              bendSet:           false,  // CRITICAL-C fix 2026-08-02
              // Jin / Deadwood State (2026-09-18, JinEngine Phase 2)
              jinned:            false,
              jinSegmentStart:   -1,
            } as unknown as Branch;

            tree._pushBranch(child);
            b.children.push(childId);
          }
        }
      }
    } else {
      // ── INNER BRANCH: continued extension at reduced rate ──
      // On the tick immediately after forking, a branch transitions from tip to inner.
      // It consumes rng.next() for inner extension instead of tip extension.
      // Fork RNGs (offsets +1, +2, +3+i) are NOT consumed since the branch already
      // has children. (FINDING-8 from critic doc — RNG consumption on tip→inner transition.)
      const isLeader = GrowthEngine.isLeaderChild(b, branches);

      let innerRate: number;
      if (b.depth === 0) {
        // Trunk: always extends. NOTE: unreachable since v2 -- depth 0 always takes the
        // canFork path above and gets this same rate through the `ext` ternary. Kept so the
        // pre-v2 inner-rate table stays readable. (tech spec §4.2 line 249)
        innerRate = sp.trunkContinuedRate;
      } else if (isLeader) {
        innerRate = sp.parentExtensionRate;
      } else {
        innerRate = round4(sp.parentExtensionRate * (1.0 - sp.apicalDominance * 0.5));
      }

      // Inner extension base range (0.8 + rng * 0.4) — slower and more uniform than tips.
      // No cap on inner extension (OQ-4 resolved): exponential depth falloff naturally
      // reduces it to negligible at deep branches.
      const innerExt = round4((0.8 + rng.next() * 0.4) * rate * depthFalloff * innerRate);
      b.length = round4(b.length + innerExt);

      // Non-trunk inner branches never fork again (v2: the trunk re-forks, 3.2a) — only tips fork. Meristems are at tips.
      // This keeps branching topology clean and prevents branch count explosion.
    }

    // Pre-order recursion -- newly forked children are iterated too (intentional)
    for (const id of b.children) {
      GrowthEngine.extendAndFork(branches[id], tree, rate, livingCount0, floorTipId);
    }
  }

  /**
   * Post-order thickening pass implementing Leonardo's Rule:
   *   parent.thickness^2 >= sum(child.thickness^2)
   * Returns the branch's resulting thickness (used by parent to accumulate child mass).
   */
  private static thickeningPass(b: Branch, tree: BonsaiTree, rate: number): number {
    if (b.pruned || b.jinned) return 0;

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

  // ---------------------------------------------------------------------------
  // Taper clamp and assertion (design 3.2e, step I7)
  // ---------------------------------------------------------------------------

  /**
   * End-of-day taper normalisation (design 3.2e). Deterministic, O(n), round4-clean, and it
   * only ever LOWERS a thickness, so it cannot break Leonardo's rule (G3) and cannot add mass.
   * Pruned branches are exempt, as the design requires.
   */
  static enforceTaper(tree: BonsaiTree): void {
    const branches = tree.getBranches();

    // Pass 1: clamp every living child to at most TAPER_CLAMP_FACTOR of its parent. Flat-array
    // id order already gives a base-to-apex cascade: a parent's id is always lower than its
    // children's ids, so the parent is final before its children are clamped.
    GrowthEngine.clampChildrenToParents(branches);

    // Pass 2: among the trunk's living depth-1 mains, thickness must be non-increasing with
    // attachmentY (lowest main thickest, highest thinnest).
    GrowthEngine.clampMainsByAttachment(branches);

    // Pass 3: pass 2 can lower a main AFTER pass 1 already clamped that main's subtree, so the
    // new bound has to be pushed down the subtree again.
    GrowthEngine.clampChildrenToParents(branches);
  }

  private static clampChildrenToParents(branches: Branch[]): void {
    for (const b of branches) {
      if (b.pruned) continue;                    // pruned branches are exempt from the clamp
      const parentId: number | null = b.parent;
      if (parentId === null) continue;           // the trunk is the base: nothing above it
      const parent = branches[parentId];
      if (parent.pruned) continue;

      const bound = round4(parent.thickness * TAPER_CLAMP_FACTOR);
      if (b.thickness > bound) {
        b.thickness = round4(Math.max(MIN_BRANCH_THICKNESS, bound));
        b.diameter  = round4(2 * b.thickness);   // physics contract: D = 2 * thickness
      }
    }
  }

  private static clampMainsByAttachment(branches: Branch[]): void {
    const mains = branches.filter((b: Branch) => b.depth === 1 && !b.pruned && b.parent === 0);
    // Deterministic order: ascending attachmentY, ties broken by id. Never rely on the
    // stability of Array.prototype.sort.
    mains.sort((a: Branch, b: Branch) => (a.attachmentY - b.attachmentY) || (a.id - b.id));

    let cap = Infinity;
    for (const m of mains) {
      if (m.thickness > cap) {
        m.thickness = round4(Math.max(MIN_BRANCH_THICKNESS, cap));
        m.diameter  = round4(2 * m.thickness);
      }
      cap = m.thickness;
    }
  }

  /**
   * 3.2e assertion: trunk thickness strictly decreasing base to apex, and living depth-1
   * thickness non-increasing with attachmentY. Read-only; nothing here writes tree state.
   *
   * "Base to apex" is the SPINE: start at the trunk and, at each level, continue into the living
   * child with the greatest attachmentY (ties broken by highest id). That is the chain of tube
   * segments a renderer draws along the trunk axis, and it is the chain the clamp keeps strictly
   * decreasing. NOTE: TreeState stores ONE thickness scalar per branch (the voxelizer turns it
   * into a single tube radius), so this spine is the only machine-checkable reading of "trunk
   * taper" in this engine; see the I7 report note.
   */
  static taperReport(tree: BonsaiTree): TaperReport {
    const branches = tree.getBranches();
    const violations: string[] = [];
    const spine: TaperNode[] = [];

    const trunk = tree.getRoot();
    let cursor: Branch | null = trunk.pruned ? null : trunk;
    while (cursor !== null) {
      spine.push({
        id: cursor.id,
        depth: cursor.depth,
        attachmentY: cursor.attachmentY,
        thickness: cursor.thickness,
      });

      let next: Branch | null = null;
      for (const id of cursor.children) {
        const child = branches[id];
        if (child.pruned) continue;
        if (next === null ||
            child.attachmentY > next.attachmentY ||
            (child.attachmentY === next.attachmentY && child.id > next.id)) {
          next = child;
        }
      }
      cursor = next;
    }

    for (let i = 1; i < spine.length; i++) {
      if (!(spine[i].thickness < spine[i - 1].thickness)) {
        violations.push(
          'spine thickness not strictly decreasing base to apex: branch ' + spine[i].id +
          ' (depth ' + spine[i].depth + ') has thickness ' + spine[i].thickness +
          ', which is not below branch ' + spine[i - 1].id + ' thickness ' + spine[i - 1].thickness,
        );
      }
    }

    const mains: TaperNode[] = branches
      .filter((b: Branch) => b.depth === 1 && !b.pruned && b.parent === 0)
      .sort((a: Branch, b: Branch) => (a.attachmentY - b.attachmentY) || (a.id - b.id))
      .map((b: Branch) => ({
        id: b.id,
        depth: b.depth,
        attachmentY: b.attachmentY,
        thickness: b.thickness,
      }));

    for (let i = 1; i < mains.length; i++) {
      if (mains[i].thickness > mains[i - 1].thickness) {
        violations.push(
          'depth-1 thickness increases with attachmentY: branch ' + mains[i].id +
          ' (attachmentY ' + mains[i].attachmentY + ') thickness ' + mains[i].thickness +
          ' > branch ' + mains[i - 1].id + ' (attachmentY ' + mains[i - 1].attachmentY +
          ') thickness ' + mains[i - 1].thickness,
        );
      }
    }

    return { ok: violations.length === 0, violations, spine, mains };
  }

  /**
   * Combat-stat delta surface for step I7. This is the part of the StatSheet that does NOT need
   * the voxelizer: StatDeriver derives skillSlots as the non-pruned depth-2+ branch COUNT
   * (StatDeriver.ts:111-112, KIJO-ENGINE-API.md:79), so it moves the moment the branch scheme
   * moves. hp / power / endurance / ki are voxel ROLE sums and need Voxelizer + StatDeriver:
   * that full regression pass is `node packages/engine/test_statderiver.mjs` (D1-D7), which this
   * function deliberately does not duplicate.
   */
  static statSnapshot(tree: BonsaiTree): GrowthStatSnapshot {
    const branches = tree.getBranches();
    const living = branches.filter((b: Branch) => !b.pruned && b.parent !== null);
    return {
      day: tree.getAge(),
      livingBranches: living.length,
      depth1Mains: living.filter((b: Branch) => b.depth === 1).length,
      depth2Plus: living.filter((b: Branch) => b.depth >= 2).length,
      trunkThickness: round4(tree.getRoot().thickness),
      totalMass: tree.getTotalMass(),
    };
  }
}
