import type { SpeciesClass, CareLogEntry } from '@kijo/shared';
import { SPECIES_PARAMS } from '@kijo/shared';
import { BonsaiTree } from './BonsaiTree.js';
import { GrowthEngine } from './GrowthEngine.js';
import { PruneEngine } from './PruneEngine.js';
import { WireEngine } from './WireEngine.js';

/**
 * Maximum number of game days the engine will replay.
 * 100 game years (1 game year = 365 days).
 * Guards against totalDays = Infinity / MAX_SAFE_INTEGER DoS (GAP-2).
 */
export const MAX_REPLAY_DAYS = 36_500;

/**
 * Thrown by CareLogReplay.reconstruct() when inputs are invalid or when the
 * care log contains an action type the engine has not yet implemented.
 * Callers (server edge functions) should catch this and reject the replay.
 */
export class CareLogReplayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CareLogReplayError';
  }
}

export class CareLogReplay {
  /**
   * Reconstruct a BonsaiTree from seed + species + care log.
   * Replays day-by-day: apply care actions logged for that day, then growTick.
   * Produces a tree bit-identical to the original if the log is complete.
   * This is the backbone of NFT verification: reconstruct from Merkle-verified log,
   * compare to claimed state.
   *
   * Throws CareLogReplayError on:
   *   - Invalid totalDays (non-finite, ≤ 0, > MAX_REPLAY_DAYS)
   *   - Invalid species
   *   - careLog is not an array
   *   - Care log entry with an unimplemented or unknown action type
   */
  static reconstruct(
    seed: number,
    species: SpeciesClass,
    careLog: CareLogEntry[],
    totalDays: number
  ): BonsaiTree {
    // --- GAP-2: totalDays validation (must come first — prevents infinite loop DoS) ---
    if (!Number.isFinite(totalDays)) {
      throw new CareLogReplayError(
        `totalDays must be finite (got ${totalDays}). Infinite or NaN totalDays would cause an infinite loop.`
      );
    }
    if (!Number.isInteger(totalDays)) {
      throw new CareLogReplayError(
        `totalDays must be an integer (got ${totalDays}). Non-integer values cause silent care-action skipping when entry.day falls above the fractional floor.`
      );
    }
    if (totalDays <= 0) {
      throw new CareLogReplayError(
        `totalDays must be positive (got ${totalDays}).`
      );
    }
    if (totalDays > MAX_REPLAY_DAYS) {
      throw new CareLogReplayError(
        `totalDays exceeds maximum allowed replay length (${totalDays} > ${MAX_REPLAY_DAYS}).`
      );
    }

    // --- species validation ---
    // Use hasOwnProperty, not `in`, to avoid prototype chain false-positives
    // (__proto__, constructor, etc. would pass `in` but are not valid species).
    if (!Object.prototype.hasOwnProperty.call(SPECIES_PARAMS, species)) {
      throw new CareLogReplayError(
        `Invalid species: ${String(species)}. Must be one of: ${Object.keys(SPECIES_PARAMS).join(', ')}.`
      );
    }

    // --- careLog type check ---
    if (!Array.isArray(careLog)) {
      throw new CareLogReplayError(
        `careLog must be an array (got ${typeof careLog}).`
      );
    }

    const tree = new BonsaiTree(seed, species);
    for (let day = 0; day < totalDays; day++) {
      // Apply care actions logged for this day before the tick
      for (const entry of careLog) {
        if (entry.day === day) {
          const a = entry.action;
          if (a.type === 'water') {
            // Re-wrap any validation error so callers see CareLogReplayError,
            // not a plain Error that leaks BonsaiTree internals.
            try {
              tree.water(a.amount);
            } catch (e) {
              throw new CareLogReplayError(
                `Invalid 'water' action on day ${day}: ${(e as Error).message}`
              );
            }
          } else if (a.type === 'fertilize') {
            tree.fertilize();
          } else if (a.type === 'rotate') {
            tree.rotate();
          } else if (a.type === 'prune') {
            PruneEngine.prune(tree, a.branchId);
          } else if (a.type === 'wire') {
            WireEngine.wire(tree, a.branchId, a.angleDelta);
          } else if (a.type === 'wire-remove') {
            // GAP-1: WireRemoveEngine not yet implemented.
            // Spring-back = angleDelta × (currentStress / stressInitial) per BLOCKER-1.
            console.warn(
              `[CareLogReplay] 'wire-remove' handler not yet implemented (branchId=${a.branchId}, day=${day}). Replay is incomplete.`
            );
            throw new CareLogReplayError(
              `Action type 'wire-remove' is not yet implemented. A care log containing wire-remove cannot be replayed faithfully — spring-back would be missing and all downstream voxels would be misplaced.`
            );
          } else if (a.type === 'twine') {
            // GAP-1: TwineEngine not yet implemented.
            console.warn(
              `[CareLogReplay] 'twine' handler not yet implemented (branchId=${a.branchId}, day=${day}). Replay is incomplete.`
            );
            throw new CareLogReplayError(
              `Action type 'twine' is not yet implemented. A care log containing twine cannot be replayed faithfully.`
            );
          } else if (a.type === 'twine-remove') {
            // GAP-1: TwineEngine not yet implemented.
            console.warn(
              `[CareLogReplay] 'twine-remove' handler not yet implemented (branchId=${a.branchId}, day=${day}). Replay is incomplete.`
            );
            throw new CareLogReplayError(
              `Action type 'twine-remove' is not yet implemented. A care log containing twine-remove cannot be replayed faithfully.`
            );
          } else if (a.type === 'weight') {
            // GAP-1: WeightEngine not yet implemented.
            console.warn(
              `[CareLogReplay] 'weight' handler not yet implemented (branchId=${a.branchId}, day=${day}). Replay is incomplete.`
            );
            throw new CareLogReplayError(
              `Action type 'weight' is not yet implemented. A care log containing weight cannot be replayed faithfully.`
            );
          } else if (a.type === 'weight-remove') {
            // GAP-1: WeightEngine not yet implemented.
            console.warn(
              `[CareLogReplay] 'weight-remove' handler not yet implemented (branchId=${a.branchId}, day=${day}). Replay is incomplete.`
            );
            throw new CareLogReplayError(
              `Action type 'weight-remove' is not yet implemented. A care log containing weight-remove cannot be replayed faithfully.`
            );
          } else if (a.type === 'jin') {
            // GAP-1: JinEngine not yet implemented.
            // jin permanently converts bark to SCAR voxels (GDD §3.2); without replay, defense stat diverges.
            console.warn(
              `[CareLogReplay] 'jin' handler not yet implemented (branchId=${a.branchId}, day=${day}). Replay is incomplete.`
            );
            throw new CareLogReplayError(
              `Action type 'jin' is not yet implemented. A care log containing jin cannot be replayed faithfully — SCAR voxels and defense stat would be missing from the replayed tree.`
            );
          } else if (a.type === 'landscape') {
            // GAP-1: Landscape elements affect TechniqueClassifier counts.
            // No tree/voxel effect in current engine, but raise anyway for strict correctness.
            console.warn(
              `[CareLogReplay] 'landscape' handler not yet implemented (elementType=${a.elementType}, day=${day}). Replay is incomplete.`
            );
            throw new CareLogReplayError(
              `Action type 'landscape' is not yet implemented. A care log containing landscape cannot be replayed faithfully.`
            );
          } else {
            // Exhaustiveness guard: the TypeScript union is fully covered above,
            // but at runtime a crafted care log can include arbitrary type strings.
            const _exhaustive: never = a;
            throw new CareLogReplayError(
              `Unknown CareAction type: '${(_exhaustive as { type: string }).type}'. This action cannot be replayed.`
            );
          }
        }
      }
      GrowthEngine.growTick(tree);
    }
    return tree;
  }
}
