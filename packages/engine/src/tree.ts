import type { SpeciesClass, TreeState } from '@kijo/shared';

export const MAX_DEPTH = 6;

/**
 * Allocate the initial TreeState for a new bonsai.
 * Called by BonsaiTree constructor — the only remaining consumer.
 * tick(), applyAction(), conditionModifier() retired 2026-08-07 (dual-engine cleanup).
 */
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
    // v2 (2026-09-09, design 3.2a): explicit 0 default == "the trunk has never forked".
    lastMainForkLength: 0,
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
        weightAppliedDay: 0,   // OQ-1 Option A (2026-08-14)
        weightAngleDelta: 0,   // OQ-1 Option A (2026-08-14)
        twineDegradesDay: 0,
        bendSet:          false,  // CRITICAL-C fix 2026-08-02
      }
    ]
  };
}
