export type SpeciesClass = 'hardwood' | 'evergreen' | 'tropical';

export interface Branch {
  id: number;
  parent: number | null; // null = trunk
  depth: number;         // 0 = trunk, max 6 (GDD s3.3)
  angle: number;         // degrees relative to parent
  length: number;
  thickness: number;
  pruned: boolean;
  // NOTE: engine API spec shows Branch.children as embedded std::vector<Branch> (C++ style);
  // we use a flat index array instead -- indices into TreeState.branches -- for serialisation safety.
  children: number[];    // indices into TreeState.branches
  // attachmentY: Y-coordinate along the PARENT axis where this branch forks (voxel units).
  // Recorded at fork time. depth-0 trunk: 0.
  // depth-1: round4(trunk.length * 0.33) for primary, round4(trunk.length) for secondary.
  // depth-2+: round4(parent.length) at fork time.
  // Drives ARM/LEG split in voxelizer (real morphology, closes R-ATTACHY proxy).
  attachmentY: number;
}

export interface TreeState {
  seed: number;
  species: SpeciesClass;
  day: number;
  moisture: number;          // 0-100, optimal 30-65 (GDD s3.2)
  health: number;            // 0-100
  rotation: number;          // 0 | 90 | 180 | 270
  fertilizerDays: number;    // remaining boosted days
  fertilizerCooldown: number;
  rngState: number;          // deterministic PRNG state
  branches: Branch[];
}

/**
 * The element types that can be placed in a bonsai pot for Water-and-Land technique.
 * Each placed element is a landscape action in the care log.
 * Threshold for Water-and-Land overlay: landscapeCount >= 3.
 *
 * Phase 1 (Gu Ahao basic store items): rock, moss, pot.
 * Phase 2+ (NFT collectible items — out of Phase 1 scope): water_feature, figurine, ceramic.
 * [RESOLVED 2026-07-31 OQ-7: confirmed 3-literal Phase 1 union per owner.]
 */
export type LandscapeElementType =
  | 'rock'
  | 'moss'
  | 'pot';

export type CareAction =
  | { type: 'water'; amount: number }
  | { type: 'rotate' }
  | { type: 'prune'; branchId: number }
  | { type: 'fertilize' }
  // WIRE (2026-07-19): bend a branch. angleDelta is the replay input
  // (degrees, signed); oldAngle/newAngle/wireCost are the historical record so
  // replay stays independent of tuning constants. See WireEngine.
  // NOTE: depth-1 restriction REMOVED per OQ-1 (any branch/trunk can be wired).
  | { type: 'wire'; branchId: number; angleDelta: number; oldAngle: number; newAngle: number; wireCost: number }
  // WIRE-REMOVE (2026-07-31): free action. Timing determines outcome per physics model.
  // Spring-back = angleDelta × (currentStress / stressInitial). SCAR triggered during
  // applyDailyUpdate ticks (overstay), NOT at wire-remove time. [BLOCKER-1 fix]
  | { type: 'wire-remove'; branchId: number }
  // TWINE (2026-07-30): free-tier impermanent bend. degradeDays drawn from RNG at
  // application time (range 10–15 game days) and stored for replay independence.
  // Does NOT count as a wire use for Clip-and-Grow classification.
  // angleDelta clamped to ±TWINE_MAX_ANGLE_DELTA = 28°. [RESOLVED 2026-07-31 OQ-3]
  | { type: 'twine'; branchId: number; angleDelta: number; oldAngle: number; newAngle: number; degradeDays: number }
  // TWINE-REMOVE (2026-07-31): caretaker removes twine before natural degradation.
  | { type: 'twine-remove'; branchId: number }
  // WEIGHT (2026-07-30): free-tier downward pull. Gravity-only (cannot bend upward).
  // weightCount: integer 1-4. torqueContribution: τ at application time, stored for
  // replay independence. Does NOT count as wire use. No SCAR ever.
  // [MAJOR-4 fix 2026-07-31: weightAmount → weightCount + torqueContribution]
  | { type: 'weight'; branchId: number; weightCount: number; torqueContribution: number }
  // WEIGHT-REMOVE (2026-07-31): caretaker removes an attached weight bag from a branch.
  | { type: 'weight-remove'; branchId: number }
  // JIN (2026-07-30): premium jin pliers. Permanently converts a bark segment to
  // deadwood (SCAR voxels). segmentIndex is 0-based position from trunk junction.
  // jinCost is the consumable count spent. Irreversible. Increments jinCount.
  | { type: 'jin'; branchId: number; segmentIndex: number; jinCost: number }
  // LANDSCAPE (2026-07-30): premium. Places an element in the pot for Water-and-Land.
  // Increments landscapeCount toward the >= 3 Water-and-Land overlay threshold.
  // position uses the shared Coordinate type (voxel grid, 0-255 each axis).
  | { type: 'landscape'; elementType: LandscapeElementType; position: Coordinate };

export interface CareLogEntry {
  day: number;
  action: CareAction;
}

/**
 * The full technique classification of a kijonsai at a given point in its care log.
 * Produced by TechniqueClassifier.classify() in @kijo/engine.
 * Mirrors the StatSheet pattern: output type lives in shared so any downstream
 * system (awakening, NFT metadata, fighter) can import it without depending on engine.
 *
 * primary — mutually exclusive: always exactly one.
 * overlays — additive: zero, one, or both may be present simultaneously.
 *
 * GDD §7.4: classification logic. DESIGN-TECHNIQUE-CLASSIFICATION.md: authoritative.
 */
export interface TechniqueResult {
  /** The primary (exclusive) technique. Default: 'Bound-and-Cut'. */
  primary: 'Bound-and-Cut' | 'Clip-and-Grow';

  /**
   * Overlay techniques (additive, order-independent).
   * May be empty []. May contain one or both of 'Jin' | 'Water-and-Land'.
   * A tree can carry both overlays simultaneously with any primary.
   */
  overlays: Array<'Jin' | 'Water-and-Land'>;

  /** Metal wire uses in care log. Twine does NOT increment this. */
  wireCount: number;

  /** Shear (prune) uses in care log. */
  pruneCount: number;

  /** Jin pliers uses in care log. Qualifies Jin overlay at >= 1. */
  jinCount: number;

  /** Landscape elements placed. Qualifies Water-and-Land overlay at >= 3. */
  landscapeCount: number;

  /** Tree age in game days at time of classification. Drives Clip-and-Grow age gate. */
  treeAgeDays: number;
}

// ---------------------------------------------------------------------------
// Coordinate & stat types
// ---------------------------------------------------------------------------

/** A position in the 256^3 voxel grid. Each axis is 0-255. */
export interface Coordinate {
  x: number;
  y: number;
  z: number;
}

/** Which stat a branch segment or skill slot is associated with. */
export type StatType = 'hp' | 'power' | 'endurance' | 'ki' | 'skill_point' | 'defense' | 'stability' | 'neutral';

/** Full stat sheet attached to a grown tree (computed, not stored in TreeState). */
export interface StatSheet {
  hp: number;
  power: number;
  endurance: number;
  ki: number;
  skillSlots: number;
  skillPoints: number;
  wisdom: number;
  matchPct: number;
  defense: number;    // damage reduction — Layer 1: SCAR voxels × SCAR_DEFENSE_MULT; Layer 2: terrain
  stability: number;  // knockdown/knockback reduction — terrain-only; no structural (Layer 1) source
}

// ---------------------------------------------------------------------------
// VoxelRole -- morphology classification, orthogonal to Material (render).
//
// Design decision (2026-07-17, DECISIONS.md):
//   material answers "how does it look" (render-only, unchanged).
//   role    answers "what body part is it" (morphology -- stats + kijo skeleton).
// A BARK voxel can simultaneously carry ARM role. Do NOT conflate the two.
// ---------------------------------------------------------------------------

export enum VoxelRole {
  TRUNK   = 'trunk',    // torso / HP source
  ARM     = 'arm',      // upper depth-1 branches / Power
  LEG     = 'leg',      // lower depth-1 branches / Endurance
  DIGIT   = 'digit',    // depth-2+ branches / skill slots
  CANOPY  = 'canopy',   // leaf clusters / Ki
  ROOT    = 'root',     // root cone
  SCAR    = 'scar',     // deadwood: wire overstay (unintentional) or jin pliers (intentional). NOT a prune byproduct.
}

// ---------------------------------------------------------------------------
// Deterministic PRNG -- Mulberry32 variant (exact algorithm from prototype)
// ---------------------------------------------------------------------------

export class SeededRNG {
  private seed: number;
  constructor(seed: number) { this.seed = seed >>> 0; }
  next(): number {
    let t = (this.seed += 0x6D2B79F5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t ^= t + (Math.imul(t ^ (t >>> 7), t | 61) >>> 0);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

// ---------------------------------------------------------------------------
// spatialHash -- maps (seed, x, y, z) to a deterministic uint32
// ---------------------------------------------------------------------------

export function spatialHash(seed: number, x: number, y: number, z: number): number {
  const packed = ((x & 0xFF) << 16) | ((y & 0xFF) << 8) | (z & 0xFF);
  let h = (seed ^ packed) >>> 0;
  h = (h += 0x6D2B79F5) >>> 0;
  h = Math.imul(h ^ (h >>> 15), h | 1) >>> 0;
  h ^= h + (Math.imul(h ^ (h >>> 7), h | 61) >>> 0);
  return (h ^ (h >>> 14)) >>> 0;
}

// ---------------------------------------------------------------------------
// round4 -- round to 4 decimal places (used for deterministic float comparison)
// ---------------------------------------------------------------------------

export function round4(x: number): number {
  return Math.round(x * 10000) / 10000;
}

// ---------------------------------------------------------------------------
// Grid & depth constants
// ---------------------------------------------------------------------------

export const GRID_SIZE = 256;
export const MAX_DEPTH = 6;
export const WATER_AMOUNT = 28;  // GDD s3.2 — one watering can

// ---------------------------------------------------------------------------
// Species parameters
// TODO: reconcile against KIJO-TECH-SPEC.md s4.3 when written
// ---------------------------------------------------------------------------

export interface SpeciesParams {
  extensionMultiplier: number;   // growth rate multiplier for branch extension
  forkSpreadMin: number;         // min angle spread for child fork (radians)
  forkSpreadMax: number;         // max angle spread for child fork (radians)
  secondaryForkChance: number;   // HW 0.45 / EG 0.35 / TR 0.25
  trunkMaturationRate: number;   // thickening rate for trunk per tick
}

export const SPECIES_PARAMS: Record<SpeciesClass, SpeciesParams> = {
  hardwood:  { extensionMultiplier: 1.0, forkSpreadMin: 0.3, forkSpreadMax: 0.8, secondaryForkChance: 0.45, trunkMaturationRate: 0.05 },
  evergreen: { extensionMultiplier: 0.8, forkSpreadMin: 0.1, forkSpreadMax: 0.4, secondaryForkChance: 0.35, trunkMaturationRate: 0.04 },
  tropical:  { extensionMultiplier: 1.3, forkSpreadMin: 0.5, forkSpreadMax: 1.2, secondaryForkChance: 0.25, trunkMaturationRate: 0.06 },
};
