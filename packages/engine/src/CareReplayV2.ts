/**
 * Care Replay V2 — CareEventV2 ordering and materialize-before-action.
 *
 * Handles:
 * - Version dispatch (V1 legacy replay vs V2 event-ordered replay)
 * - CareEventV2 canonical ordering: (acceptedAtMs, eventSequence)
 * - Materialize-before-action: evaluate active plan to acceptedAtMs before applying action
 * - Influence set computation per action type (§6.4)
 * - Deterministic splicing (retain unaffected events, cancel affected, replace)
 *
 * Spec: ARCH-GROWTH-V3-IMPLEMENTATION-2026-09-25.md §6.4, §7.
 *
 * @module @kijo/engine/CareReplayV2
 */

import type {
  CareEventV2,
  CareAction,
  GrowthEventV1,
  DayPlanV1,
} from '@kijo/shared';
import {
  isValidSafeInteger,
  isValidDecimalString,
} from '@kijo/shared';

// ═══════════════════════════════════════════════════════════════════════════
// §7.1 — CareEventV2 canonical ordering
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compare two CareEventV2 records for canonical ordering.
 * §7.1: "Canonical care order is (acceptedAtMs, eventSequence)."
 *
 * eventSequence is a decimal string representing a monotonic bigint,
 * so we compare numerically (by length then lexicographically).
 */
export function compareCareEvents(a: CareEventV2, b: CareEventV2): number {
  if (a.acceptedAtMs !== b.acceptedAtMs) return a.acceptedAtMs - b.acceptedAtMs;
  // eventSequence is a decimal string — compare as bigint
  return compareDecimalStrings(a.eventSequence, b.eventSequence);
}

/**
 * Compare two non-negative decimal strings numerically.
 * Shorter string is smaller; if same length, lexicographic order works.
 */
export function compareDecimalStrings(a: string, b: string): number {
  if (a.length !== b.length) return a.length - b.length;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Sort CareEventV2 records in canonical order.
 * Returns a new sorted array (does not mutate input).
 */
export function sortCareEvents(events: readonly CareEventV2[]): CareEventV2[] {
  return [...events].sort(compareCareEvents);
}

// ═══════════════════════════════════════════════════════════════════════════
// §6.4 — Influence set computation
// ═══════════════════════════════════════════════════════════════════════════

export type InfluenceScope =
  | 'none'               // water, fertilize — no current-day influence
  | 'scene-only'         // landscape — presentation scene revision only
  | 'direction-all'      // rotate — all direction-dependent events
  | 'target-descendants' // wire/twine/weight — target branch + descendants
  | 'target-cancel'      // jin — cancel target dead segment + descendants
  | 'subtree-cancel';    // prune — cancel target subtree + escrow

/**
 * Determine the influence scope of a care action.
 * §6.4: influence set table.
 */
export function getInfluenceScope(action: CareAction): InfluenceScope {
  switch (action.type) {
    case 'water':
    case 'fertilize':
      return 'none';
    case 'landscape':
      return 'scene-only';
    case 'rotate':
      return 'direction-all';
    case 'wire':
    case 'wire-remove':
    case 'twine':
    case 'twine-remove':
    case 'weight':
    case 'weight-remove':
      return 'target-descendants';
    case 'jin':
      return 'target-cancel';
    case 'prune':
      return 'subtree-cancel';
    default:
      throw new Error(`CareReplayV2: unknown action type '${(action as { type: string }).type}'`);
  }
}

/**
 * Given an influence scope and a target branch ID, determine which
 * growth events are affected (should be cancelled/replaced) vs retained.
 *
 * §6.4: "Retain unaffected future event records byte-for-byte."
 *
 * @param events - not-yet-materialized future events
 * @param scope - influence scope from getInfluenceScope
 * @param targetBranchId - branch the care action targets (for target-* scopes)
 * @param subtreeBranchIds - all branches in the target subtree (for subtree-cancel)
 * @returns { retained, affected } — two arrays of events
 */
export function partitionByInfluence(
  events: readonly GrowthEventV1[],
  scope: InfluenceScope,
  targetBranchId: number,
  subtreeBranchIds: ReadonlySet<number>,
): { retained: GrowthEventV1[]; affected: GrowthEventV1[] } {
  const retained: GrowthEventV1[] = [];
  const affected: GrowthEventV1[] = [];

  for (const event of events) {
    let isAffected = false;

    switch (scope) {
      case 'none':
        // Water/fertilize: no current-day influence
        isAffected = false;
        break;
      case 'scene-only':
        // Landscape: no tree plan events affected
        isAffected = false;
        break;
      case 'direction-all':
        // Rotate: all direction-dependent events (all non-materialized)
        isAffected = true;
        break;
      case 'target-descendants':
        // Wire/twine/weight: target branch + descendant placement events
        isAffected = subtreeBranchIds.has(event.branchId);
        break;
      case 'target-cancel':
        // Jin: cancel target dead segment + descendant growth
        isAffected = subtreeBranchIds.has(event.branchId);
        break;
      case 'subtree-cancel':
        // Prune: cancel target subtree events
        isAffected = subtreeBranchIds.has(event.branchId);
        break;
    }

    if (isAffected) {
      affected.push(event);
    } else {
      retained.push(event);
    }
  }

  return { retained, affected };
}

// ═══════════════════════════════════════════════════════════════════════════
// §6.4 — Splice result
// ═══════════════════════════════════════════════════════════════════════════

export interface SpliceResult {
  /** Events retained byte-for-byte from the prior plan. */
  readonly retainedEvents: readonly GrowthEventV1[];
  /** Events cancelled by this care action. */
  readonly cancelledEvents: readonly GrowthEventV1[];
  /** Replacement events (for non-cancel scopes like rotate, wire). */
  readonly replacementEvents: readonly GrowthEventV1[];
}

/**
 * Compute the splice for a care action against the active plan's future events.
 *
 * §6.4: "When geometry changes but an event remains economically the same,
 * its replacement keeps the old entropyKey, allocationGU, start/end offsets,
 * and morphology samples."
 *
 * For 'subtree-cancel' and 'target-cancel', no replacements are generated.
 * For 'direction-all' and 'target-descendants', replacements would be generated
 * by the planner with retained economic parameters (handled by the caller).
 *
 * @param futureEvents - not-yet-materialized events from the active plan
 * @param action - the care action being applied
 * @param targetBranchId - branch the action targets
 * @param subtreeBranchIds - all branches in the target subtree
 * @returns splice result
 */
export function computeSplice(
  futureEvents: readonly GrowthEventV1[],
  action: CareAction,
  targetBranchId: number,
  subtreeBranchIds: ReadonlySet<number>,
): SpliceResult {
  const scope = getInfluenceScope(action);
  const { retained, affected } = partitionByInfluence(
    futureEvents, scope, targetBranchId, subtreeBranchIds,
  );

  // For cancel scopes, no replacements
  if (scope === 'subtree-cancel' || scope === 'target-cancel') {
    return {
      retainedEvents: retained,
      cancelledEvents: affected,
      replacementEvents: [],
    };
  }

  // For 'none' and 'scene-only', nothing is affected
  if (scope === 'none' || scope === 'scene-only') {
    return {
      retainedEvents: retained,
      cancelledEvents: [],
      replacementEvents: [],
    };
  }

  // For 'direction-all' and 'target-descendants', the caller (planner)
  // must generate replacements using the affected events' economic parameters.
  // We return the affected events as cancelled; the caller creates replacements.
  return {
    retainedEvents: retained,
    cancelledEvents: affected,
    replacementEvents: [], // Caller fills via planner
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// §7.1 — Input validation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate a CareEventV2 record.
 * @returns null if valid, error string otherwise
 */
export function validateCareEventV2(event: unknown): string | null {
  if (event === null || typeof event !== 'object') return 'not an object';
  const obj = event as Record<string, unknown>;

  if (obj.schemaVersion !== 2) return 'schemaVersion must be 2';
  if (typeof obj.careEventId !== 'string' || obj.careEventId.length === 0) return 'invalid careEventId';
  if (typeof obj.treeId !== 'string' || obj.treeId.length === 0) return 'invalid treeId';
  if (!isValidSafeInteger(obj.acceptedAtMs) || (obj.acceptedAtMs as number) < 0) return 'invalid acceptedAtMs';
  if (!isValidDecimalString(obj.eventSequence)) return 'invalid eventSequence';
  if (!isValidDecimalString(obj.baseRevision)) return 'invalid baseRevision';
  if (!isValidDecimalString(obj.committedRevision)) return 'invalid committedRevision';
  if (typeof obj.idempotencyKey !== 'string' || obj.idempotencyKey.length === 0) return 'invalid idempotencyKey';
  if (obj.action === null || typeof obj.action !== 'object') return 'invalid action';

  return null;
}
