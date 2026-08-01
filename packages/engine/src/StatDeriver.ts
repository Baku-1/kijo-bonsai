import { round4, VoxelRole } from '@kijo/shared';
import type { StatSheet } from '@kijo/shared';
import { BonsaiTree } from './BonsaiTree.js';
import { StatTerrain } from './StatTerrain.js';

// ---------------------------------------------------------------------------
// VoxelSet — minimal structural interface used by StatDeriver.
// SparseVoxelSet (from @kijo/voxelizer) satisfies this via duck-typing.
// We cannot import SparseVoxelSet directly: voxelizer → engine circular dep.
// VoxelRole lives in @kijo/shared; engine already depends on shared → safe.
// ---------------------------------------------------------------------------

export interface VoxelSet {
  has(x: number, y: number, z: number): boolean;
  forEach(
    cb: (x: number, y: number, z: number, mat: number, role: VoxelRole, branchId: number) => void,
  ): void;
}

// ---------------------------------------------------------------------------
// R14 — structural multipliers (calibrated 2026-07-17, Task B)
//
// Reference: Day-200 Chokkan hardwood, seed 464497 (9,029 voxels total).
// Role counts (exact — stamped per voxel at voxelization time):
//   TRUNK voxels  = 2,740  →  HP_MULT = 0.35  →  HP ≈ 959  [target 800-1500 ✓]
//   ARM voxels    =   780  →  POWER_MULT = 0.50  →  Power ≈ 390
//   LEG voxels    =   340  →  ENDURANCE_MULT = 0.50  →  Endurance ≈ 170
//   CANOPY voxels =    98  →  KI_MULT = 3.00  →  Ki ≈ 294
//
// All four values FLAGGED FOR PLAYTEST TUNING (R14).
// ---------------------------------------------------------------------------

const HP_MULT        = 0.35;
const POWER_MULT     = 0.50;
const ENDURANCE_MULT = 0.50;
const KI_MULT        = 3.00;

const SCAR_DEFENSE_MULT = 0.10;  // FLAG FOR PLAYTEST TUNING — "small Defense bonus" per C++ spec (KIJO-ENGINE-API PruneEngine §)
// NOTE: Stability has no structural source. ROOT voxels do not contribute to stability.
// Stability is terrain-only (same pattern as skillPoints). No ROOT_STABILITY_MULT constant.

// ---------------------------------------------------------------------------
// Internal result types (not part of the public StatSheet contract)
// ---------------------------------------------------------------------------

export interface StructuralStats {
  hp: number;
  power: number;
  endurance: number;
  ki: number;
  skillSlots: number;
  defense: number;    // SCAR voxels × SCAR_DEFENSE_MULT
  // NOTE: stability is NOT in StructuralStats — it is terrain-only (no Layer 1 source).
  // Same pattern as skillPoints, which is also absent from StructuralStats.
}

export interface TerrainBonuses {
  hp: number;
  power: number;
  endurance: number;
  ki: number;
  skillPoints: number;
  defense: number;
  stability: number;
}

// ---------------------------------------------------------------------------
// StatDeriver — seed + care_log → tree → voxels → StatSheet (GDD §4.2)
// ---------------------------------------------------------------------------

export class StatDeriver {

  // -------------------------------------------------------------------------
  // deriveStructural(voxels, tree) → StructuralStats          Layer 1
  //
  // Counts voxels by ROLE (not material — GDD §4.2):
  //   VoxelRole.TRUNK  → HP          (main trunk tube voxels)
  //   VoxelRole.ARM    → Power       (upper depth-1 branch tubes)
  //   VoxelRole.LEG    → Endurance   (lower depth-1 branch tubes)
  //   VoxelRole.CANOPY → Ki          (leaf cluster voxels)
  //   DIGIT, ROOT → no structural stat
  //   SCAR  → Defense (small bonus per C++ spec: "scar voxels → small structural Defense/HP")
  //   NOTE: stability is terrain-only — ROOT voxels do not contribute structurally
  //
  // ARM/LEG assignment is done at voxelization time (packages/voxelizer/src/index.ts).
  // StatDeriver reads role directly — no mass-ratio approximation needed.
  //
  // skillSlots = count of non-pruned depth-2+ branches from the BonsaiTree
  // (branch COUNT, not voxel count — per GDD §4.2 / §4.3).
  // -------------------------------------------------------------------------

  static deriveStructural(voxels: VoxelSet, tree: BonsaiTree): StructuralStats {
    let trunkVoxels  = 0;
    let armVoxels    = 0;
    let legVoxels    = 0;
    let canopyVoxels = 0;
    let scarVoxels   = 0;

    voxels.forEach((_x, _y, _z, _mat, role, _branchId) => {
      switch (role) {
        case VoxelRole.TRUNK:  trunkVoxels++;  break;
        case VoxelRole.ARM:    armVoxels++;    break;
        case VoxelRole.LEG:    legVoxels++;    break;
        case VoxelRole.CANOPY: canopyVoxels++; break;
        case VoxelRole.SCAR:   scarVoxels++;   break;
        // DIGIT, ROOT: no structural stat contribution (SCAR now handled above)
      }
    });

    // Skill slots: depth-2+ branch count (not voxels — per GDD §4.2 / §4.3)
    const skillSlots = tree.getBranches()
      .filter(b => !b.pruned && b.depth >= 2).length;

    return {
      hp:        round4(trunkVoxels  * HP_MULT),
      power:     round4(armVoxels    * POWER_MULT),
      endurance: round4(legVoxels    * ENDURANCE_MULT),
      ki:        round4(canopyVoxels * KI_MULT),
      skillSlots,
      defense:   round4(scarVoxels   * SCAR_DEFENSE_MULT),
      // stability is NOT returned from deriveStructural — terrain-only stat (no Layer 1 source)
    };
  }

  // -------------------------------------------------------------------------
  // deriveTerrain(voxels, seed) → TerrainBonuses              Layer 2
  //
  // For every filled voxel, call StatTerrain.getStatAt and accumulate the
  // bonus into its stat category.  Terrain bonuses stack ADDITIVELY on top
  // of structural stats (GDD §4.2 — "the two layers stack").
  // round4() applied per accumulated total.
  // -------------------------------------------------------------------------

  static deriveTerrain(
    voxels: VoxelSet,
    seed:   number,
    zones:  Map<number, number>,  // branchId → zoneIndex; from Voxelizer.VoxelizeResult — REQUIRED
  ): TerrainBonuses {
    let hp = 0, power = 0, endurance = 0, ki = 0, skillPoints = 0, defense = 0, stability = 0;

    voxels.forEach((x, y, z, _mat, _role, branchId) => {
      // ZONE TYPE: from skeleton-derived zone map (always provided post-jitter-fix).
      // Fallback to per-voxel hash only if branchId not in map (defensive; should never happen).
      const statType = zones.has(branchId)
        ? StatTerrain.STAT_TYPES[zones.get(branchId)!]
        : StatTerrain.getStatAt(seed, x, y, z).type;

      // BONUS VALUE: proximity multiplier remains per-voxel integer eval (unchanged).
      const dist  = StatTerrain.distanceToIdealPath(seed, x, y, z);
      const mult  = StatTerrain.proximityCurve(dist);
      const value = round4(StatTerrain.BASE_VALUES[statType] * mult);

      switch (statType) {
        case 'hp':          hp          += value; break;
        case 'power':       power       += value; break;
        case 'endurance':   endurance   += value; break;
        case 'ki':          ki          += value; break;
        case 'skill_point': skillPoints += value; break;
        case 'defense':     defense     += value; break;
        case 'stability':   stability   += value; break;
        // 'neutral': no contribution
      }
    });

    return {
      hp:          round4(hp),
      power:       round4(power),
      endurance:   round4(endurance),
      ki:          round4(ki),
      skillPoints: round4(skillPoints),
      defense:     round4(defense),
      stability:   round4(stability),
    };
  }

  // -------------------------------------------------------------------------
  // wisdomFromAge(ageDays) → tier 0-4                         age-driven
  //
  // GDD §4.3: Wisdom is NOT voxel-derived — time cannot be manufactured.
  //   < 100  → 0
  //   100-199 → 1
  //   200-364 → 2
  //   365-499 → 3
  //   >= 500  → 4
  // -------------------------------------------------------------------------

  static wisdomFromAge(ageDays: number): number {
    if (ageDays < 100) return 0;
    if (ageDays < 200) return 1;
    if (ageDays < 365) return 2;
    if (ageDays < 500) return 3;
    return 4;
  }

  // -------------------------------------------------------------------------
  // derive(tree, voxels, seed, ageDays) → StatSheet           public entry
  //
  // Full dual-layer stat derivation (GDD §4.2):
  //   StatSheet = structural + terrain + wisdom + matchPct
  // All values round4()'d.  matchPct is raw [0,1] from StatTerrain.
  // -------------------------------------------------------------------------

  static derive(
    tree:    BonsaiTree,
    voxels:  VoxelSet,
    seed:    number,
    ageDays: number,
    zones:   Map<number, number>,  // branchId → zoneIndex; from Voxelizer.VoxelizeResult — REQUIRED
  ): StatSheet {
    const structural = StatDeriver.deriveStructural(voxels, tree);
    const terrain    = StatDeriver.deriveTerrain(voxels, seed, zones);
    const wisdom     = StatDeriver.wisdomFromAge(ageDays);
    const matchPct   = StatTerrain.calculateMatch(voxels, seed);

    const sheet: StatSheet = {
      hp:          round4(structural.hp          + terrain.hp),
      power:       round4(structural.power       + terrain.power),
      endurance:   round4(structural.endurance   + terrain.endurance),
      ki:          round4(structural.ki          + terrain.ki),
      skillSlots:  structural.skillSlots,
      skillPoints: round4(terrain.skillPoints),
      wisdom,
      matchPct,
      defense:     round4(structural.defense + terrain.defense),
      stability:   round4(terrain.stability),   // terrain-only — no structural source (same pattern as skillPoints)
    };

    // GAP-4 defense-in-depth: NaN sentinel.
    // If any numeric field is not finite, the stat pipeline has been corrupted
    // (e.g. by NaN moisture that bypassed the water() guard). Throw rather than
    // silently return a fraudulent StatSheet that would be stored on-chain.
    for (const [key, value] of Object.entries(sheet) as [string, number][]) {
      if (!Number.isFinite(value)) {
        throw new Error(
          `StatDeriver.derive(): stat field '${key}' is not finite (${value}). ` +
          `The stat pipeline has been corrupted — inspect the care log for invalid inputs.`
        );
      }
    }

    return sheet;
  }
}
