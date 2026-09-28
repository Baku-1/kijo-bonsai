/**
 * Canopy Grammar — Species-Specific Integer Ellipsoid Predicates
 *
 * Determines canopy candidate cells for each species using integer-only
 * arithmetic. Candidate ordering is deterministic via spatialHash.
 *
 * Spec: ARCH-GROWTH-V3-IMPLEMENTATION-2026-09-25.md §10.1.
 *
 * FINDING-8: Integer division truncates toward zero in the quotient,
 * which is permissive — it produces a slightly wider acceptance region
 * than the continuous ellipsoid.
 *
 * @module @kijo/voxelizer/CanopyGrammar
 */

import {
  type SpeciesClass,
  type CanopyEllipsoidParams,
  CANOPY_ELLIPSOID,
  spatialHash,
} from '@kijo/shared';

// ═══════════════════════════════════════════════════════════════════════════
// §10.1 — Integer ellipsoid predicate
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Test whether a local cell (x, y, z) is inside the species canopy ellipsoid.
 *
 * Integer cross-product predicate (no floats):
 *   (x/ax)² + (y/ay)² + (z/az)² <= 1
 *
 * Evaluated as:
 *   x² * ay² * az² + y² * ax² * az² + z² * ax² * ay² <= ax² * ay² * az²
 *
 * FINDING-8: This is the exact integer cross-product form. No division
 * or truncation occurs — the comparison is exact for integer inputs.
 * The spec's note about truncation applies to the (x/ax)² form if one
 * were to evaluate it with integer division; we avoid that by using the
 * cross-product form instead.
 */
export function isInsideEllipsoid(
  x: number, y: number, z: number,
  params: CanopyEllipsoidParams,
): boolean {
  // Additional constraint (tropical: y >= minY)
  if (params.minY !== undefined && y < params.minY) return false;

  const { ax, ay, az } = params;
  const ax2 = ax * ax;
  const ay2 = ay * ay;
  const az2 = az * az;

  const lhs = x * x * ay2 * az2 + y * y * ax2 * az2 + z * z * ax2 * ay2;
  const rhs = ax2 * ay2 * az2;

  return lhs <= rhs;
}

// ═══════════════════════════════════════════════════════════════════════════
// §10.1 — Candidate cell enumeration
// ═══════════════════════════════════════════════════════════════════════════

/** A canopy candidate cell in local (branch-tip) coordinates. */
export interface CanopyCandidate {
  readonly localX: number;
  readonly localY: number;
  readonly localZ: number;
  /** Deterministic hash for ordering and seasonal effects. */
  readonly hash: number;
}

/**
 * Enumerate all candidate cells for a species canopy in local coordinates.
 * Scans the bounding box of the ellipsoid and retains cells that pass
 * the integer predicate.
 */
export function enumerateCanopyCandidates(
  species: SpeciesClass,
  seed: number,
  branchId: number,
): CanopyCandidate[] {
  const params = CANOPY_ELLIPSOID[species];
  const candidates: CanopyCandidate[] = [];

  // Scan the bounding box [-ax..ax, -ay..ay, -az..az]
  for (let x = -params.ax; x <= params.ax; x++) {
    for (let y = -params.ay; y <= params.ay; y++) {
      for (let z = -params.az; z <= params.az; z++) {
        if (isInsideEllipsoid(x, y, z, params)) {
          // Pack branchId into seed to keep spatial coords in their own args
          candidates.push({
            localX: x,
            localY: y,
            localZ: z,
            hash: spatialHash(seed + branchId * 7919, x, y, z),
          });
        }
      }
    }
  }

  return candidates;
}

/**
 * Sort candidates in the canonical order defined by §10.1:
 *   (spatialHash(seed, branchId, localX, localY, localZ), localX, localY, localZ) ascending
 *
 * This is the allocation order — first candidate gets GU first.
 */
export function sortCanopyCandidates(candidates: CanopyCandidate[]): CanopyCandidate[] {
  return [...candidates].sort((a, b) => {
    if (a.hash !== b.hash) return a.hash - b.hash;
    if (a.localX !== b.localX) return a.localX - b.localX;
    if (a.localY !== b.localY) return a.localY - b.localY;
    return a.localZ - b.localZ;
  });
}

/**
 * Get the ordered canopy candidates for a species.
 * This is the main entry point: enumerate + sort in canonical order.
 *
 * The returned count is the maximum canopy cells for this species.
 * Actual allocation depends on available GU from the canopy sink.
 */
export function getCanopyCandidates(
  species: SpeciesClass,
  seed: number,
  branchId: number,
): CanopyCandidate[] {
  const candidates = enumerateCanopyCandidates(species, seed, branchId);
  return sortCanopyCandidates(candidates);
}

// ═══════════════════════════════════════════════════════════════════════════
// §10.1 — Eligibility check
// ═══════════════════════════════════════════════════════════════════════════

export interface CanopyEligibilityInput {
  /** Is the branch live (not jinned/pruned)? */
  readonly isLive: boolean;
  /** Has the branch been jinned? */
  readonly isJinned: boolean;
  /** Branch completed game days since birth. */
  readonly completedDays: number;
  /** Tree health (0–100). */
  readonly health: number;
  /** Day moisture factor in bps (0 = no moisture). */
  readonly moistureBps: number;
  /** Is this branch terminal (no children)? */
  readonly isTerminal: boolean;
}

/**
 * Check if a terminal branch is eligible for canopy allocation.
 *
 * Spec §10.1: "A terminal branch is canopy-eligible only when, at day start,
 * it is live, non-jinned, at least two completed game days old, health is
 * at least 40, and the day's moisture factor is positive."
 */
export function isCanopyEligible(input: CanopyEligibilityInput): boolean {
  return (
    input.isTerminal &&
    input.isLive &&
    !input.isJinned &&
    input.completedDays >= 2 &&
    input.health >= 40 &&
    input.moistureBps > 0
  );
}
