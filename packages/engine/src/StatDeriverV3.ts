/**
 * StatDeriverV3 — V3 stat semantics with multi-owner primary-role input.
 *
 * §9.2: V3 stat table. Uses VoxelCellV2 primary owner role for structural
 * stat counting instead of the single-owner VoxelSet interface.
 *
 * Key enforcement:
 * - skillSlots and skillPoints are deliberately independent (§9.2)
 * - Prune only affects actually removed/re-resolved cells
 * - No skillPoints = min(skillPoints, skillSlots) coupling
 * - Stump overlay (prune-scar) grants no Defense
 *
 * Spec: ARCH-GROWTH-V3-IMPLEMENTATION-2026-09-25.md §9.
 *
 * @module @kijo/engine/StatDeriverV3
 */

import type { VoxelCellV2, StableBranchRole } from '@kijo/shared';
import { VoxelRole, round4 } from '@kijo/shared';
import type { StatSheet } from '@kijo/shared';
import { StatTerrain } from './StatTerrain.js';

// ═══════════════════════════════════════════════════════════════════════════
// §9.2 — Structural multipliers (same as StatDeriver for consistency)
// ═══════════════════════════════════════════════════════════════════════════

const HP_MULT        = 0.35;
const POWER_MULT     = 0.50;
const ENDURANCE_MULT = 0.50;
const KI_MULT        = 3.00;
const SCAR_DEFENSE_MULT = 0.10;

// ═══════════════════════════════════════════════════════════════════════════
// §9.2 — V3 structural stats from multi-owner voxel map
// ═══════════════════════════════════════════════════════════════════════════

export interface StructuralStatsV3 {
  readonly hp: number;
  readonly power: number;
  readonly endurance: number;
  readonly ki: number;
  readonly skillSlots: number;
  readonly defense: number;
}

/**
 * Derive structural stats from a V3 multi-owner voxel map.
 *
 * §9.2: Uses each cell's PRIMARY owner role for stat contribution.
 * §8.3: presentationOverlay: 'prune-scar' does NOT change role for stats.
 * The prune-stump overlay "grants no Defense" — the parent's role is preserved.
 *
 * @param voxelMap - coordinate → VoxelCellV2
 * @param livingDigitBranchCount - count of living branches with stableRole 'digit'
 *   for skillSlots. This is branch COUNT, not voxel count (§9.2).
 */
export function deriveStructuralV3(
  voxelMap: ReadonlyMap<string, Readonly<VoxelCellV2>>,
  livingDigitBranchCount: number,
): StructuralStatsV3 {
  let trunkVoxels  = 0;
  let armVoxels    = 0;
  let legVoxels    = 0;
  let canopyVoxels = 0;
  let scarVoxels   = 0;

  for (const cell of voxelMap.values()) {
    // §9.2: primary owner determines the stat category
    const primaryOwner = cell.owners[cell.primaryOwnerIndex];
    if (!primaryOwner) continue;

    const role = primaryOwner.role;
    switch (role) {
      case VoxelRole.TRUNK:  trunkVoxels++;  break;
      case VoxelRole.ARM:    armVoxels++;    break;
      case VoxelRole.LEG:    legVoxels++;    break;
      case VoxelRole.CANOPY: canopyVoxels++; break;
      case VoxelRole.SCAR:   scarVoxels++;   break;
      // DIGIT, ROOT: no structural stat contribution
    }
  }

  return {
    hp:        round4(trunkVoxels  * HP_MULT),
    power:     round4(armVoxels    * POWER_MULT),
    endurance: round4(legVoxels    * ENDURANCE_MULT),
    ki:        round4(canopyVoxels * KI_MULT),
    skillSlots: livingDigitBranchCount,
    defense:   round4(scarVoxels   * SCAR_DEFENSE_MULT),
  };
}

/**
 * Derive terrain bonuses from a V3 voxel map.
 *
 * Same as StatDeriver.deriveTerrain but operates on VoxelCellV2 map.
 * Each coordinate contributes terrain once regardless of owner count.
 */
export function deriveTerrainV3(
  voxelMap: ReadonlyMap<string, Readonly<VoxelCellV2>>,
  seed: number,
  zones: ReadonlyMap<number, number>,
): {
  hp: number;
  power: number;
  endurance: number;
  ki: number;
  skillPoints: number;
  defense: number;
  stability: number;
} {
  let hp = 0, power = 0, endurance = 0, ki = 0, skillPoints = 0, defense = 0, stability = 0;

  for (const [coordKey, cell] of voxelMap) {
    const parts = coordKey.split(',');
    if (parts.length !== 3) continue;
    const x = Number(parts[0]);
    const y = Number(parts[1]);
    const z = Number(parts[2]);

    // Use primary owner's branchId for zone lookup
    const primaryOwner = cell.owners[cell.primaryOwnerIndex];
    if (!primaryOwner) continue;
    const branchId = primaryOwner.branchId;

    const statType = zones.has(branchId)
      ? StatTerrain.STAT_TYPES[zones.get(branchId)!]
      : StatTerrain.getStatAt(seed, x, y, z).type;

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
    }
  }

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

/**
 * Full V3 stat derivation from multi-owner voxel map.
 *
 * §9.2: skillSlots and skillPoints are deliberately independent.
 * V3 must NOT add skillPoints = min(skillPoints, skillSlots).
 *
 * @param voxelMap - coordinate → VoxelCellV2
 * @param seed - tree seed for terrain
 * @param ageDays - completed game days for wisdom
 * @param livingDigitBranchCount - living branches with stableRole 'digit'
 * @param zones - branchId → zoneIndex
 */
export function deriveV3(
  voxelMap: ReadonlyMap<string, Readonly<VoxelCellV2>>,
  seed: number,
  ageDays: number,
  livingDigitBranchCount: number,
  zones: ReadonlyMap<number, number>,
): StatSheet {
  const structural = deriveStructuralV3(voxelMap, livingDigitBranchCount);
  const terrain = deriveTerrainV3(voxelMap, seed, zones);

  // Wisdom from age (same formula as V1)
  let wisdom: number;
  if (ageDays < 100) wisdom = 0;
  else if (ageDays < 200) wisdom = 1;
  else if (ageDays < 365) wisdom = 2;
  else if (ageDays < 500) wisdom = 3;
  else wisdom = 4;

  // matchPct: we need a VoxelSet-compatible iteration for StatTerrain.calculateMatch
  // Build an adapter
  const matchPct = calculateMatchPctFromMap(voxelMap, seed);

  const sheet: StatSheet = {
    hp:          round4(structural.hp          + terrain.hp),
    power:       round4(structural.power       + terrain.power),
    endurance:   round4(structural.endurance   + terrain.endurance),
    ki:          round4(structural.ki          + terrain.ki),
    skillSlots:  structural.skillSlots,
    // §9.2: skillPoints is terrain-only, independent of skillSlots
    skillPoints: round4(terrain.skillPoints),
    wisdom,
    matchPct,
    defense:     round4(structural.defense + terrain.defense),
    stability:   round4(terrain.stability),
  };

  // NaN sentinel (same pattern as StatDeriver)
  for (const [key, value] of Object.entries(sheet) as [string, number][]) {
    if (!Number.isFinite(value)) {
      throw new Error(
        `StatDeriverV3.deriveV3(): stat field '${key}' is not finite (${value}). ` +
        `The stat pipeline has been corrupted.`
      );
    }
  }

  return sheet;
}

/**
 * Compute matchPct from a VoxelCellV2 map by adapting to the VoxelSet
 * interface that StatTerrain.calculateMatch expects.
 */
function calculateMatchPctFromMap(
  voxelMap: ReadonlyMap<string, Readonly<VoxelCellV2>>,
  seed: number,
): number {
  // Build a minimal VoxelSet adapter
  const adapter = {
    has(x: number, y: number, z: number): boolean {
      return voxelMap.has(`${x},${y},${z}`);
    },
    forEach(cb: (x: number, y: number, z: number, mat: number, role: string, branchId: number) => void): void {
      for (const [coordKey, cell] of voxelMap) {
        const parts = coordKey.split(',');
        const x = Number(parts[0]);
        const y = Number(parts[1]);
        const z = Number(parts[2]);
        const primary = cell.owners[cell.primaryOwnerIndex];
        if (primary) {
          cb(x, y, z, primary.material, primary.role, primary.branchId);
        }
      }
    },
  };

  return StatTerrain.calculateMatch(adapter as any, seed);
}
