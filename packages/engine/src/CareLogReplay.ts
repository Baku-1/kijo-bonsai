import type { SpeciesClass, CareLogEntry } from '@kijo/shared';
import { SPECIES_PARAMS } from '@kijo/shared';
import { BonsaiTree } from './BonsaiTree.js';
import { GrowthEngine } from './GrowthEngine.js';
import { PruneEngine } from './PruneEngine.js';
import { WireEngine } from './WireEngine.js';
export { CareLogReplayError } from './errors.js';

/**
 * Maximum number of game days the engine will replay.
 * 100 game years (1 game year = 365 days).
 * Guards against totalDays = Infinity / MAX_SAFE_INTEGER DoS (GAP-2).
 */
export const MAX_REPLAY_DAYS = 36_500;

// CareLogReplayError is defined in errors.ts (to avoid circular import with BonsaiTree.ts)
// and re-exported above via `export { CareLogReplayError } from './errors.js'`.
import { CareLogReplayError } from './errors.js';

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

    // --- Carmack C-1 fix (2026-08-02): careLog.length guard ---
    // A log with more entries than MAX_REPLAY_DAYS cannot be valid for a replay of
    // totalDays days (at most one action per day per action type). Reject it early to
    // prevent the O(n×m) loop below from becoming a DoS vector.
    if (careLog.length > MAX_REPLAY_DAYS) {
      throw new CareLogReplayError(
        `careLog.length (${careLog.length}) exceeds MAX_REPLAY_DAYS (${MAX_REPLAY_DAYS}). Cannot replay.`
      );
    }

    // Pre-group care log entries by day for O(1) lookup in the day loop.
    // Without this, the inner scan is O(totalDays × careLog.length) = O(n²) at full scale.
    const byDay = new Map<number, CareLogEntry[]>();
    for (const entry of careLog) {
      if (!byDay.has(entry.day)) byDay.set(entry.day, []);
      byDay.get(entry.day)!.push(entry);
    }

    const tree = new BonsaiTree(seed, species);
    for (let day = 0; day < totalDays; day++) {
      // Apply care actions logged for this day before the tick.
      // O(actions_on_this_day) — not O(careLog.length).
      const dayEntries = byDay.get(day) ?? [];
      for (const entry of dayEntries) {
        {
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
            // Delegates to BonsaiTree.removeWire → WireEngine.removeWire.
            // Spring-back from (currentStress / stressInitial) model. (2026-08-01)
            tree.removeWire(a.branchId);
          } else if (a.type === 'twine') {
            // Delegates to BonsaiTree.applyTwine → TwineWeightEngine.applyTwine.
            // Phase 1 stub: TwineWeightEngine.applyTwine throws "not implemented".
            // CareLogReplay will propagate that error until Phase 2 implementation lands.
            tree.applyTwine(a.branchId, a.angleDelta);
          } else if (a.type === 'twine-remove') {
            // Delegates to BonsaiTree.removeTwine → TwineWeightEngine.removeTwine.
            // Phase 1 stub.
            tree.removeTwine(a.branchId);
          } else if (a.type === 'weight') {
            // Delegates to BonsaiTree.applyWeight → TwineWeightEngine.applyWeight.
            // Uses a.weightCount (integer 1–4); a.torqueContribution stored for future
            // replay-independence use (MAJOR-7 pattern) when Phase 2 implements storedTorque overload.
            // Phase 1 stub.
            tree.applyWeight(a.branchId, a.weightCount);
          } else if (a.type === 'weight-remove') {
            // Delegates to BonsaiTree.removeWeight → TwineWeightEngine.removeWeight.
            // Phase 1 stub.
            tree.removeWeight(a.branchId);
          } else if (a.type === 'jin') {
            // Delegates to BonsaiTree.applyJin → JinEngine.applyJin.
            // Phase 1 stub: JinEngine.applyJin throws "not implemented".
            tree.applyJin(a.branchId, a.segmentIndex, a.jinCost);
          } else if (a.type === 'landscape') {
            // Delegates to BonsaiTree.addLandscape (logs + markDirty — fully implemented in Phase 1).
            tree.addLandscape(a.elementType, a.position);
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
