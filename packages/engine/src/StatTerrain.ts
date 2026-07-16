import { spatialHash, round4 } from '@kijo/shared';
import type { StatType } from '@kijo/shared';

// ---------------------------------------------------------------------------
// VoxelReader — minimal interface for calculateMatch.
// SparseVoxelSet from @kijo/voxelizer satisfies this structurally.
// We cannot import @kijo/voxelizer here because voxelizer already depends on
// @kijo/engine — importing it would create a circular dependency.
// ---------------------------------------------------------------------------

export interface VoxelReader {
  has(x: number, y: number, z: number): boolean;
}

// ---------------------------------------------------------------------------
// TerrainStat — what getStatAt returns
// ---------------------------------------------------------------------------

export interface TerrainStat {
  type: StatType;
  value: number;
}

// ---------------------------------------------------------------------------
// Bonsai style splines
//
// R4 decision (2026-07-16): Only Chokkan (formal upright) is implemented.
// The other 7 styles are stubbed with TODO markers and a clean interface so
// they slot in later without restructuring anything here.
//
// Chokkan ideal path: straight vertical trunk spline from (128, 38, 128) to
// (128, 220, 128).  Radial branch zones are captured implicitly by the
// distance-to-spline calculation — voxels near the vertical axis score high.
// ---------------------------------------------------------------------------

type StyleSpline = {
  /** Returns the shortest Euclidean distance from (x,y,z) to the spline. */
  distanceTo(x: number, y: number, z: number): number;
};

function chokkanSpline(): StyleSpline {
  // Straight vertical line segment: x=128, z=128, y ∈ [38, 220]
  return {
    distanceTo(x: number, y: number, z: number): number {
      const clampedY = Math.max(38, Math.min(220, y));
      const dx = x - 128;
      const dy = y - clampedY;
      const dz = z - 128;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    },
  };
}

// Only Chokkan is implemented.  Remaining 7 entries are TODO placeholders.
const STYLE_SPLINES: StyleSpline[] = [
  chokkanSpline(),         // 0 — Chokkan  (formal upright)
  // TODO: 1 — Moyogi     (informal upright)
  // TODO: 2 — Shakan     (slant)
  // TODO: 3 — Kengai     (cascade)
  // TODO: 4 — Fukinagashi (windswept)
  // TODO: 5 — Bunjin     (literati)
  // TODO: 6 — Hokidachi  (broom)
  // TODO: 7 — Sekijoju   (root over rock)
];

/**
 * Return the style spline for a given seed.
 *
 * R5 decision (2026-07-16): style index = seed % 8, but only index 0
 * (Chokkan) is implemented.  All seeds are clamped to Chokkan until the
 * remaining 7 styles are built.  Clamp is temporary — remove when live.
 */
function splineForSeed(_seed: number): StyleSpline {
  // const styleIndex = seed % 8;  ← future: route to STYLE_SPLINES[styleIndex]
  return STYLE_SPLINES[0]; // Clamp: Chokkan only
}

// ---------------------------------------------------------------------------
// STAT_TYPES — six-bucket ordered list; index must be stable (hash % 6)
//
// R2 decision (2026-07-16): NEUTRAL is naturally ~16.7 % (1/6 of buckets).
// Kept as-is for first pass.  Flag for playtest tuning.
// ---------------------------------------------------------------------------

const STAT_TYPES: StatType[] = [
  'hp', 'power', 'endurance', 'ki', 'skill_point', 'neutral',
];

// Base value emitted when a coordinate maps to a given stat type.
const BASE_VALUES: Record<StatType, number> = {
  hp:          0.001,
  power:       0.001,
  endurance:   0.001,
  ki:          0.001,
  skill_point: 0.25,
  neutral:     0.0,
};

// R7 decision (2026-07-16): Ideal region = all integer coords with
// distanceToIdealPath < 10.  This threshold is the match% denominator.
// Flag for playtest tuning.
const IDEAL_REGION_DISTANCE = 10;

// ---------------------------------------------------------------------------
// StatTerrain — the seed's hidden stat map
// ---------------------------------------------------------------------------

export class StatTerrain {

  // -------------------------------------------------------------------------
  // proximityCurve(distance) → multiplier
  //
  // R6 decision (2026-07-16): First-pass values, untuned.  Flag for playtest.
  //   dist === 0 → 3.0
  //   dist  < 5  → 2.0
  //   dist  < 15 → 1.5
  //   dist  < 30 → 1.0
  //   else       → 0.8
  // -------------------------------------------------------------------------

  static proximityCurve(distance: number): number {
    if (distance === 0) return 3.0;
    if (distance < 5)  return 2.0;
    if (distance < 15) return 1.5;
    if (distance < 30) return 1.0;
    return 0.8;
  }

  // -------------------------------------------------------------------------
  // distanceToIdealPath(seed, x, y, z) → float
  //
  // Euclidean distance from (x,y,z) to the nearest point on the seed's
  // favoured bonsai-style spline.  Pure and deterministic.
  // -------------------------------------------------------------------------

  static distanceToIdealPath(seed: number, x: number, y: number, z: number): number {
    return splineForSeed(seed).distanceTo(x, y, z);
  }

  // -------------------------------------------------------------------------
  // getStatAt(seed, x, y, z) → TerrainStat
  //
  // Core lazy function.  No storage, no wall-clock time.
  //
  // Algorithm:
  //   1. spatialHash(seed, x, y, z) → uint32 h
  //   2. bucket = h % 6 → StatType
  //   3. base  = BASE_VALUES[type]
  //   4. value = base × proximityCurve(distanceToIdealPath(seed, x, y, z))
  //   5. round4(value)
  // -------------------------------------------------------------------------

  static getStatAt(seed: number, x: number, y: number, z: number): TerrainStat {
    const hash   = spatialHash(seed, x, y, z);
    const bucket = hash % 6;
    const type   = STAT_TYPES[bucket];
    const base   = BASE_VALUES[type];

    const dist       = StatTerrain.distanceToIdealPath(seed, x, y, z);
    const multiplier = StatTerrain.proximityCurve(dist);
    const value      = round4(base * multiplier);

    return { type, value };
  }

  // -------------------------------------------------------------------------
  // calculateMatch(voxels, seed) → float  [0.0, 1.0]
  //
  // Overlap of filled voxels with the seed's ideal-path region ÷ region size.
  //
  // R7: ideal region = coords where distanceToIdealPath < IDEAL_REGION_DISTANCE (10).
  // R17: efficiency — we walk only the tight bounding box of the Chokkan spline's
  // neighbourhood instead of the full 256³ grid.  For the straight-vertical
  // Chokkan spline (x=128, z=128, y=[38,220]) the bounding box is:
  //   x ∈ [118, 138], z ∈ [118, 138], y ∈ [28, 230]
  // This is exact: no Chokkan-region coordinate lies outside this box.
  // -------------------------------------------------------------------------

  static calculateMatch(voxels: VoxelReader, seed: number): number {
    const spline = splineForSeed(seed);
    const D      = IDEAL_REGION_DISTANCE;

    // Bounding box around Chokkan spline (x=128,z=128,y=[38,220]) ± D
    const xLo = Math.max(0,   128 - D), xHi = Math.min(255, 128 + D);
    const zLo = Math.max(0,   128 - D), zHi = Math.min(255, 128 + D);
    const yLo = Math.max(0,    38 - D), yHi = Math.min(255, 220 + D);

    let idealCount   = 0;
    let overlapCount = 0;

    for (let cx = xLo; cx <= xHi; cx++) {
      for (let cy = yLo; cy <= yHi; cy++) {
        for (let cz = zLo; cz <= zHi; cz++) {
          if (spline.distanceTo(cx, cy, cz) < D) {
            idealCount++;
            if (voxels.has(cx, cy, cz)) overlapCount++;
          }
        }
      }
    }

    if (idealCount === 0) return 0.0;
    return round4(overlapCount / idealCount);
  }
}
