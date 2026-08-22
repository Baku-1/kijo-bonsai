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

  // ── Physics Fields (2026-08-01) ──────────────────────────────────────────────
  // Specification: ARCHITECT-BRANCH-PHYSICS-2026-08-01.md Part A (owner-confirmed).
  // Field names follow the C++ parity model from ARCHITECT-CAREACTION-TECHNIQUE-2026-07-30.md.

  /**
   * Branch diameter in voxel units. D = 2 × thickness (Branch.thickness is RADIUS).
   * Drives stress formula S = τ/D³ and setDays = lerp(28, 56, D/D_max).
   * Updated every GrowthEngine.thickeningPass() tick: diameter = round4(2 × b.thickness).
   * Default: 0 (set at fork time and in thickeningPass).
   */
  diameter: number;

  /**
   * Current wood stress. Recalculated fresh each tick in applyDailyUpdate as
   * (τ_twine + τ_weight) / D³. Default 0 (no binding active).
   * When ≤ STRESS_SET_THRESHOLD × stressInitial: bend is permanently set.
   */
  currentStress: number;

  /**
   * Wood stress at the time the most recent twine or weight binding was applied
   * (first non-zero value after application). Used for spring-back reference:
   * springBack = angleDelta × (currentStress / stressInitial). Default 0.
   */
  stressInitial: number;

  // ── Wire Binding State ───────────────────────────────────────────────────────

  /** True when metal wire is currently applied. Default: false. */
  wired: boolean;

  /**
   * Absolute game-day (from BonsaiTree.getAge()) when wire was applied.
   * 0 when not wired. Used for UI display and SCAR timing.
   * Do NOT use (currentDay − wireAppliedDay) for set/scar decisions via stress model.
   */
  wireAppliedDay: number;

  /**
   * Bend angle (degrees, signed) applied by the wire action.
   * Stored for spring-back on removal: branch.angle -= wireAngle × springBackFraction.
   * 0 when not wired.
   */
  wireAngle: number;

  /**
   * True when the wire bend has permanently set (currentStress crossed
   * STRESS_SET_THRESHOLD at wire removal time). Bend is permanent; no spring-back.
   * Reset to false when wire is re-applied (WireEngine.wire sets it to false).
   */
  wireSet: boolean;

  /**
   * True when wire was left on too long (SCAR trigger in applyDailyUpdate).
   * SCAR voxels scheduled on next voxelization. Permanent once set.
   * Twine and weight NEVER set wireScarred.
   */
  wireScarred: boolean;

  // ── Twine Binding State ──────────────────────────────────────────────────────

  /** True when natural-fiber twine is currently applied. Default: false. */
  twined: boolean;

  /**
   * Absolute game-day when twine was applied. 0 when not twined.
   * daysSinceTwine = currentDay − twineAppliedDay (computed, not stored).
   */
  twineAppliedDay: number;

  /**
   * Current remaining twine bend angle (degrees, signed).
   *
   * At applyTwine time: set to the applied delta (clamped to +/-TWINE_MAX_ANGLE_DELTA).
   * During natural degradation (processTwineDegrade): decremented by SPRING_RATE (1 deg/day)
   *   toward 0. Represents REMAINING bend, not original applied delta.
   * At removeTwine / processTwineDegrade completion: cleared to 0.
   * 0 when not twined.
   *
   * The original applied delta is the authoritative historical record stored in the
   * care log entry (type: 'twine', angleDelta). Do not use this field as the
   * original delta for any computation that runs after processTwineDegrade has fired.
   *
   * Used for spring-back reference in removeTwine:
   *   springBackAmount = twineAngle * springBackFraction
   * where springBackFraction = max(0, 1 - twineDaysApplied / setDays).
   * This is correct because twineAngle at removeTwine time IS the remaining bend
   * to be reversed.
   */
  twineAngle: number;

  /**
   * Per-tick tension increment for twine (Newtons per game day).
   * Twine tightens progressively: τ_twine(t) = twineForcePerDay × daysSinceApply × length × sin(θ).
   * Default: 0. Set to TWINE_FORCE_PER_DAY (0.02 N/day) when applyTwine is called.
   * Set to 0 when removeTwine is called.
   */
  twineForcePerDay: number;

  // ── Weight Binding State ─────────────────────────────────────────────────────

  /** True when one or more weight bags are attached. Default: false. */
  weighted: boolean;

  /**
   * Number of weight bags attached. Integer 1–4 when weighted===true; 0 otherwise.
   * Cap enforced by TwineWeightEngine at apply time.
   * Each weight contributes ≈7° downward (applied immediately at applyWeight time).
   */
  weightCount: number;

  /**
   * Absolute game-day when weight was most recently applied. 0 when not weighted.
   * Used for time-ratio spring-back in removeWeight (parallel to wireAppliedDay).
   * weightDaysApplied = currentDay - weightAppliedDay.
   * (OQ-1 Option A approved by Jeremy, 2026-08-14)
   */
  weightAppliedDay: number;

  /**
   * Accumulated bend angle applied by weight(s) (degrees, always >= 0).
   * Incremented by applyWeight (STACK: +=, capped at TWINE_MAX_ANGLE_DELTA = 28°).
   * Immediately applied to branch.angle at applyWeight time (OQ-5 STACK model).
   * Used as the spring-back reference in removeWeight:
   *   springBackAmount = weightAngleDelta × springBackFraction.
   * Reset to 0 on removeWeight. Default: 0.
   * (OQ-1 Option A approved by Jeremy, 2026-08-14)
   */
  weightAngleDelta: number;

  // ── Twine Degradation Cache (MAJOR-2 fix, 2026-08-01) ───────────────────────

  /**
   * The game day on which twine begins to degrade.
   * Set at applyTwine time: twineDegradesDay = twineAppliedDay + degradeDays.
   * Cached here for O(1) per-tick degradation check in applyDailyUpdate step 4d.
   * 0 when not twined.
   */
  twineDegradesDay: number;

  // ── Permanent-Set Sentinel (CRITICAL-C fix, 2026-08-02) ─────────────────────

  /**
   * True when the bend from twine or weight has permanently set — i.e., the binding
   * was removed after wireDaysApplied/twineDaysApplied/weightDaysApplied >= setDays.
   * When true, step 4a in applyDailyUpdate skips stress recalculation (the branch has
   * "learned" its new shape and stress is no longer accumulating toward a set condition).
   *
   * Set to true in removeWire (when wireDaysApplied >= computeSetDays(diameter)),
   * and in Phase 2 removeTwine/removeWeight when their daysApplied >= setDays.
   * Never reset to false once set (permanent history).
   * Default: false.
   */
  bendSet: boolean;

  /**
   * Number of times metal wire has been successfully applied to this branch.
   * Drives the Cascade gate in WireEngine: branches with wireCount < 3 are capped
   * at 120° (Han-Kengai range); wireCount >= 3 unlocks the full 150° Cascade ceiling.
   * Optional for backward-compat with branches created before this field existed;
   * treated as 0 when absent (new branches initialized by wire() on first application).
   * (GDD §3.2; owner decision 2026-08-07)
   *
   * ⚠️ ALWAYS read as `(b.wireCount ?? 0)` — undefined means zero prior wire applications.
   *    Never access directly without the nullish coalesce guard or you will get NaN on
   *    pre-physics-field branches. When all creation paths set wireCount:0, remove the `?`.
   */
  wireCount?: number;
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
  hardwood:  { extensionMultiplier: 1.0, forkSpreadMin: 0.50, forkSpreadMax: 1.00, secondaryForkChance: 0.45, trunkMaturationRate: 0.05 },
  evergreen: { extensionMultiplier: 0.8, forkSpreadMin: 0.30, forkSpreadMax: 0.70, secondaryForkChance: 0.35, trunkMaturationRate: 0.04 },
  tropical:  { extensionMultiplier: 1.3, forkSpreadMin: 0.10, forkSpreadMax: 0.40, secondaryForkChance: 0.25, trunkMaturationRate: 0.06 },
  // NOTE: tropical forkSpreadMin/Max equals historical evergreen values intentionally.
  // GDD s3.3 "tighter clusters" grounds tropical here; species differentiated further
  // by forkChance (TR:0.16 highest, from engine/src/species.ts), secondaryForkChance (TR:0.25 lowest), extensionMultiplier (TR:1.3).
};

// ---------------------------------------------------------------------------
// Species visual traits — leaf color, bark color, sub-type.
// §6.4 COMBAT-METADATA-REQUIREMENTS.md + bark color extension.
// Canonical source: all consumers import from here.
// ---------------------------------------------------------------------------

/** Leaf color palette per species. Last entry is rare (~3% roll). */
export const LEAF_COLORS: Record<SpeciesClass, readonly string[]> = {
  hardwood:  ['Red', 'Green', 'Maroon'],                   // §6.4: Maroon (blood-red) rare
  evergreen: ['Green', 'Blue', 'Cyan'],                     // §6.4: Cyan rare
  tropical:  ['Green', 'Dark Green', 'Tan', 'Yellow'],      // §6.4: Yellow rare
};

/** Bark color tint per species (hex, applied as multiply over base texture).
 *  Last entry is rare (~3% roll). */
export const BARK_COLORS: Record<SpeciesClass, readonly number[]> = {
  hardwood:  [0x8B6914, 0x3E2723, 0x9E9E9E],       // warm brown, dark umber, silver grey (rare)
  evergreen: [0x6D5D4E, 0x4E4E4E, 0xB87333],       // grey-brown, ashen, copper (rare)
  tropical:  [0xC4A882, 0xA89F91, 0xE8DFD0],       // tan, pale grey, white (rare)
};

/** Bark color human-readable names (parallel to BARK_COLORS). For NFT metadata. */
export const BARK_COLOR_NAMES: Record<SpeciesClass, readonly string[]> = {
  hardwood:  ['Warm Brown', 'Dark Umber', 'Silver Grey'],
  evergreen: ['Grey-Brown', 'Ashen', 'Copper'],
  tropical:  ['Tan', 'Pale Grey', 'Bleached'],
};

/** Species sub-type names. Seed-deterministic, cosmetic. */
export const SPECIES_SUBTYPES: Record<SpeciesClass, readonly string[]> = {
  hardwood:  ['Straight Trunk', 'Twisted Trunk', 'Multi-Trunk'],
  evergreen: ['Compact', 'Layered', 'Cascading'],
  tropical:  ['Aerial Roots', 'Spreading', 'Curved'],
};

/** Probability of rolling the rare (last) color in a palette. */
export const RARE_COLOR_CHANCE = 0.03;

/** Derive visual traits deterministically from seed + species.
 *  Uses SeededRNG for proper probability distribution (~3% rare). */
export function deriveVisualTraits(
  seed: number,
  species: SpeciesClass,
): { subtype: string; leafColor: string; barkColor: number; barkColorName: string } {
  const rng = new SeededRNG(seed * 7919);   // prime salt to decorrelate from growth RNG

  // Sub-type: uniform across all entries
  const subtypes = SPECIES_SUBTYPES[species];
  const subtype = subtypes[Math.floor(rng.next() * subtypes.length)];

  // Leaf color: ~3% chance for last entry (rare), uniform among commons
  const leafPalette = LEAF_COLORS[species];
  const leafRoll = rng.next();
  const leafIdx = leafRoll < RARE_COLOR_CHANCE
    ? leafPalette.length - 1                                                      // rare
    : Math.floor(leafRoll * (leafPalette.length - 1)) % (leafPalette.length - 1); // common

  // Bark color: same ~3% rare mechanic
  const barkPalette = BARK_COLORS[species];
  const barkNames = BARK_COLOR_NAMES[species];
  const barkRoll = rng.next();
  const barkIdx = barkRoll < RARE_COLOR_CHANCE
    ? barkPalette.length - 1
    : Math.floor(barkRoll * (barkPalette.length - 1)) % (barkPalette.length - 1);

  return {
    subtype,
    leafColor: leafPalette[leafIdx],
    barkColor: barkPalette[barkIdx],
    barkColorName: barkNames[barkIdx],
  };
}

// ---------------------------------------------------------------------------
// Branch physics result types (2026-08-01)
// Specification: ARCHITECT-BRANCH-PHYSICS-2026-08-01.md Part G
// ---------------------------------------------------------------------------

// Carmack C-5 fix (2026-08-02): 'too-thick' removed — no TWINE_MAX_THICKNESS constant defined
// (OQ-PHYSICS-4 unresolved) and no code path produces this reason. Removed until Phase 2.
export type TwineRejectReason = 'not-found' | 'pruned' | 'already-twined';
export interface TwineResult {
  ok: boolean;
  reason?: TwineRejectReason;
  oldAngle?: number;
  newAngle?: number;
}

export type WeightRejectReason = 'not-found' | 'pruned' | 'weight-cap-exceeded';
export interface WeightResult {
  ok: boolean;
  reason?: WeightRejectReason;
  torqueContribution?: number;
}

// Carmack C-5 fix (2026-08-02): 'already-jin' removed — no Branch.jinned field exists
// and no code path produces this reason in Phase 1. Removed until Phase 2.
export type JinRejectReason = 'not-found' | 'pruned' | 'segment-out-of-range';
export interface JinResult {
  ok: boolean;
  reason?: JinRejectReason;
  scarVoxelCount?: number;
}
