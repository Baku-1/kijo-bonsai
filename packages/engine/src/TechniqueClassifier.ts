import type { CareLogEntry, TechniqueResult } from '@kijo/shared';

/**
 * TechniqueClassifier — pure, stateless technique classification.
 *
 * Reads a CareLogEntry array and tree age, counts action types that affect
 * technique classification, and returns a TechniqueResult.
 *
 * Classification rules (DESIGN-TECHNIQUE-CLASSIFICATION.md, authoritative):
 *
 *   wireCount      = count of { type: 'wire' } entries  (twine does NOT count)
 *   pruneCount     = count of { type: 'prune' } entries
 *   jinCount       = count of { type: 'jin' } entries
 *   landscapeCount = count of { type: 'landscape' } entries
 *
 *   primary:
 *     'Clip-and-Grow' if wireCount === 0 && pruneCount >= CLIP_MIN_PRUNES && treeAgeDays >= CLIP_MIN_AGE_DAYS
 *     'Bound-and-Cut' otherwise (default)
 *
 *   overlays:
 *     'Jin'            if jinCount >= JIN_MIN_USES (= 1)
 *     'Water-and-Land' if landscapeCount >= LAND_MIN_ELEMENTS (= 3)
 *
 * Thresholds are extracted to named constants for easy playtesting tuning.
 * All marked "R22 first-pass values" in DESIGN-TECHNIQUE-CLASSIFICATION.md.
 *
 * Follows StatDeriver pattern: all static methods, no constructor, pure computation.
 *
 * Caching strategy [RESOLVED 2026-07-31 OQ-6]: re-classify ONLY when the caretaker
 * opens the voxel viewer (lazy/on-demand). Cache at the call site; this class is
 * stateless and does not cache internally.
 */
export class TechniqueClassifier {
  // Tuning constants — from DESIGN-TECHNIQUE-CLASSIFICATION.md.
  // Change only these constants for playtest tuning; no magic numbers in classify().
  static readonly CLIP_MIN_PRUNES   = 2;   // R22 first-pass
  static readonly CLIP_MIN_AGE_DAYS = 30;  // R22 first-pass
  static readonly LAND_MIN_ELEMENTS = 3;   // Water-and-Land overlay threshold
  static readonly JIN_MIN_USES      = 1;   // one jin action qualifies Jin overlay

  /**
   * Classify a tree's care log into a TechniqueResult.
   *
   * @param careLog     The tree's full care log (CareLogEntry[]).
   *                    Scans every entry's action.type to count qualifying actions.
   *                    Types not affecting classification (water, rotate, fertilize,
   *                    twine, twine-remove, weight, weight-remove, wire-remove) are ignored.
   *
   * @param treeAgeDays The tree's current age in game days (from TreeState.day).
   *                    Cannot be derived from the care log alone — a tree may go many
   *                    days without a care action, so max(entry.day) would undercount.
   *                    Caller must provide this explicitly.
   *
   * @returns TechniqueResult with primary, overlays, and diagnostic count fields.
   *
   * Pure and referentially transparent: same inputs → same output.
   */
  static classify(careLog: CareLogEntry[], treeAgeDays: number): TechniqueResult {
    let wireCount      = 0;
    let pruneCount     = 0;
    let jinCount       = 0;
    let landscapeCount = 0;

    for (const entry of careLog) {
      switch (entry.action.type) {
        case 'wire':      wireCount++;      break;
        case 'prune':     pruneCount++;     break;
        case 'jin':       jinCount++;       break;
        case 'landscape': landscapeCount++; break;
        // water, rotate, fertilize, twine, twine-remove,
        // weight, weight-remove, wire-remove: ignored for classification
        default: break;
      }
    }

    const primary: 'Bound-and-Cut' | 'Clip-and-Grow' =
      wireCount === 0 &&
      pruneCount     >= TechniqueClassifier.CLIP_MIN_PRUNES &&
      treeAgeDays    >= TechniqueClassifier.CLIP_MIN_AGE_DAYS
        ? 'Clip-and-Grow'
        : 'Bound-and-Cut';

    const overlays: Array<'Jin' | 'Water-and-Land'> = [];
    if (jinCount       >= TechniqueClassifier.JIN_MIN_USES)      overlays.push('Jin');
    if (landscapeCount >= TechniqueClassifier.LAND_MIN_ELEMENTS) overlays.push('Water-and-Land');

    return { primary, overlays, wireCount, pruneCount, jinCount, landscapeCount, treeAgeDays };
  }
}
