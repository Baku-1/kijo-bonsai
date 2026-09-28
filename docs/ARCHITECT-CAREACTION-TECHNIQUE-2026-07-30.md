# Architect Spec: CareAction Additions + TechniqueClassifier
**Date:** 2026-07-30  
**Author:** Verified Architect pass — follows skill protocol exactly  
**Status:** DESIGN — for implementer use

---

## SCOPE

```
DESIGN TASK:  Define four new CareAction discriminated union variants (jin, twine,
              weight, landscape) and the TechniqueResult type + TechniqueClassifier
              class that classifies a care log into a technique state.

DELIVERABLE:  TypeScript interface spec — exact field names, types, constraints, and
              package placement. Implementers write no logic not specified here.

BUILDS ON:    packages/shared/src/index.ts (CareAction, CareLogEntry, Coordinate)
              packages/engine/src/WireEngine.ts (pattern for action shapes)
              packages/engine/src/StatDeriver.ts (pattern for engine class design)
              docs/DESIGN-TECHNIQUE-CLASSIFICATION.md (classification logic)
              docs/DESIGN-TWINE-VS-WIRE.md (twine/wire distinction)
              docs/DESIGN-SPECIES-TECHNIQUE-ARCHETYPES.md (archetype grid)

CONSUMED BY:  Implementer adding the 4 action types to packages/shared/src/index.ts,
              building packages/engine/src/TechniqueClassifier.ts, and updating
              packages/engine/src/CareLogReplay.ts to handle the new action types.
```

---

## VERIFICATION LOG

```
VERIFIED:
  ✓ CareAction is a 5-variant discriminated union in packages/shared/src/index.ts
    (lines 35-43). Variants: water, rotate, prune, fertilize, wire.
    Source: read packages/shared/src/index.ts directly.

  ✓ CareLogEntry is { day: number; action: CareAction } (index.ts line 45-48).
    Source: read packages/shared/src/index.ts directly.

  ✓ CareLogReplay.reconstruct() takes (seed, species, CareLogEntry[], totalDays).
    The care log type is CareLogEntry[], not CareAction[].
    Source: read packages/engine/src/CareLogReplay.ts line 16.

  ✓ Coordinate type exists in packages/shared/src/index.ts (lines 54-58).
    Fields: { x: number; y: number; z: number }. Grid is 256^3.
    Source: read packages/shared/src/index.ts directly.

  ✓ VoxelRole.SCAR = 'scar' exists (index.ts line 94). StatDeriver counts scarVoxels
    for defense calculation (StatDeriver.ts line 105). Jin deadwood maps to this role.
    Source: read both files directly.

  ✓ Canonical technique names: Bound-and-Cut / Clip-and-Grow / Jin / Water-and-Land
    (hyphenated, title case). Source: verified-architect SKILL.md terminology canon
    and DESIGN-TECHNIQUE-CLASSIFICATION.md section headers.

  ✓ Techniques are PRIMARY (mutually exclusive) + OVERLAYS (additive).
    Primary: Bound-and-Cut OR Clip-and-Grow.
    Overlays: Jin (≥1 jin use), Water-and-Land (≥3 landscape elements). Both optional.
    Source: DESIGN-TECHNIQUE-CLASSIFICATION.md lines 38-56, pseudocode lines 121-141.

  ✓ Classification pseudocode uses wireCount (metal wire only), pruneCount, jinCount,
    landscapeCount. Twine does NOT increment wireCount.
    Source: DESIGN-TECHNIQUE-CLASSIFICATION.md lines 121-141.

  ✓ Clip-and-Grow conditions: wireCount == 0 AND pruneCount >= 2 AND age >= 30 days.
    "R22 first-pass values — subject to playtesting tuning."
    Source: DESIGN-TECHNIQUE-CLASSIFICATION.md lines 127-129, note at line 144.

  ✓ Bound-and-Cut is the default — any care state not qualifying as Clip-and-Grow.
    Source: DESIGN-TECHNIQUE-CLASSIFICATION.md lines 33-36, pseudocode line 130.

  ✓ Jin threshold: ≥ 1 jin use. Water-and-Land threshold: ≥ 3 landscape elements.
    Source: DESIGN-TECHNIQUE-CLASSIFICATION.md lines 94, 91.

  ✓ Wire (metal) action = { type: 'wire'; branchId, angleDelta, oldAngle, newAngle,
    wireCost }. The pattern records APPLIED delta + angles for replay independence.
    Source: packages/shared/src/index.ts line 43; WireEngine.ts line 82.

  ✓ StatDeriver uses all static methods, no constructor, same pattern recommended for
    TechniqueClassifier. Source: packages/engine/src/StatDeriver.ts lines 71-213.

  ✓ Engine exports pattern: export { ClassName } + export type { TypeName } in
    packages/engine/src/index.ts. Source: read index.ts lines 1-15.

  ✓ StatSheet lives in packages/shared/src/index.ts (line 65). StatDeriver (engine)
    imports it from shared. Pattern: cross-boundary output types belong in shared.
    Source: read both files.

  ✓ Twine: free tier, bends ±28° max, temporary 10–15 game days, no penalty on lapse.
    [UPDATED 2026-07-31: confirmed ±28° per owner; was ±15–20° in original source.]
    Source: DESIGN-TWINE-VS-WIRE.md lines 19-30.

  ✓ Weights: free, gravity-only (downward only), 7° per weight, max 4 per branch = 28° max downward, sets slowly.
    [UPDATED 2026-07-31: confirmed per owner; was ~15–16° max arc in original source.]
    Combined with twine (twine attaches the weight bag).
    Source: DESIGN-TWINE-VS-WIRE.md lines 56-65.

  ✓ "A care log with zero wire ever AND twine uses = still Clip-and-Grow eligible."
    Source: DESIGN-TECHNIQUE-CLASSIFICATION.md line 71 (explicit sentence).

  ✓ Water-and-Land = overlay with no combat archetype contribution.
    Source: DESIGN-SPECIES-TECHNIQUE-ARCHETYPES.md line 15, lines 92-94.

  ✓ Landscape elements include: rocks, water features, moss, ceramic decorations.
    Source: DESIGN-TECHNIQUE-CLASSIFICATION.md line 52; DESIGN-SPECIES-TECHNIQUE-ARCHETYPES.md line 41.

  ✓ CareLogReplay handles 'water', 'fertilize', 'rotate', 'prune', 'wire' (lines 28-33)
    but has no handling for jin/twine/weight/landscape. Implementer must extend this.
    Source: read packages/engine/src/CareLogReplay.ts lines 28-33.

UNVERIFIED (could not confirm):
  ? C++ spec segment/depth encoding for jin — the task says "which segment/depth" but
    the C++ spec is not accessible for reading. Using segmentIndex: number (0-based
    position along branch from trunk junction) as a safe approximation.
    Searched: kijo-bonsai repo files for C++ spec. Not found as a readable file.
    RISK: if C++ spec uses a different field name (e.g., segmentId, depthOffset),
    implementer must reconcile.

  ? [SUPERSEDED 2026-07-31] Weight unit for weightAmount — original spec used
    `weightAmount: number` in engine-defined units. RESOLVED: weight action now uses
    `weightCount: number` (integer 1-4) + `torqueContribution: number` (τ at application time).
    Implementer defines WEIGHT_MASS_PER_UNIT and GRAVITY_CONSTANT in TwineWeightEngine constants.
    See MAJOR-4 resolution in Part 1 and Assumption 4.

  ? Whether twine can be applied to depth-2+ branches (the GDD says "depth-1 only"
    for wire; twine spec does not state depth restriction explicitly).
    Searched: DESIGN-TWINE-VS-WIRE.md. Not stated.
    RISK: if twine allows depth-2+ bending, the engine constraint differs from wire.
    → FLAGGED AS OPEN QUESTION.

  ? Whether landscape elements can be removed (an un-place action). The design docs
    describe only placement. Classification threshold is count ≥ 3 with no removal.
    → FLAGGED AS OPEN QUESTION.

REFUTED (found to be false):
  ✗ Task's proposed TechniqueClassifier signature uses CareAction[] as input.
    ACTUAL: the established engine type for the care log is CareLogEntry[] (with day
    timestamps), used by CareLogReplay and all engine code. CareAction[] alone loses
    the day context needed to pass treeAgeDays cleanly. The correct input is
    CareLogEntry[] with treeAgeDays as a separate explicit parameter.
    Source: CareLogReplay.ts line 16, all engine code pattern.
```

---

### VERIFICATION LOG ADDENDUM — Corrective Pass 2026-07-31

```
VERIFIED (corrective pass):

  ✓ wire-remove (WIRE_REMOVE) exists in KIJO-ENGINE-API.md CareAction enum (line 36)
    and BonsaiTree method `void removeWire(uint32_t branchId)` (lines 157-164).
    C++ spec explicitly tracks removal: "Timing determines outcome:
    removed before 6 months → branch springs back; 6-12 months → bend sets permanently;
    still on at >12 months → wire scars permanently."
    BLOCKER-1 resolved: wire-remove variant added to TypeScript CareAction union.
    Source: read KIJO-ENGINE-API.md lines 36, 157-164 directly.

  ✓ Branch physics fields confirmed absent from packages/shared/src/index.ts Branch
    interface (lines 3-20): no wired, wireAppliedDay, twined, twineAppliedDay, weighted,
    diameter, currentStress, or stressInitial fields. TypeScript Branch is a pure
    geometry type with no binding state.
    KIJO-ENGINE-API.md Branch struct (lines 59-71) has all C++ binding state fields.
    BLOCKER-2 resolved by owner physics model (2026-07-31) — see Part 0 below.
    Source: read packages/shared/src/index.ts lines 3-20 and KIJO-ENGINE-API.md lines 59-71.

  ✓ LANDSCAPE_REMOVE exists in C++ CareAction enum (line 41) and BonsaiTree has
    `void removeLandscape(uint32_t elementId)` (lines 176-179).
    MAJOR-1 resolved: Phase 1 TypeScript explicitly diverges — landscape removal is
    Phase 2 only. The C++ API method is a forward stub for Phase 2. Any LANDSCAPE_REMOVE
    entries in a cross-engine care log are no-ops in TS Phase 1 replay.
    landscapeCount = gross placement count (not net) in Phase 1.
    Source: read KIJO-ENGINE-API.md lines 41, 176-179.

  ✓ WireEngine.ts depth-1 gate: `if (b.depth !== 1) return { ok: false, reason: 'not-depth-1' };`
    exists at line 69. WireRejectReason at line 34 includes 'not-depth-1'.
    Both must be removed per OQ-1 resolution (any branch at any depth can be wired).
    MAJOR-6 resolved: removal explicitly added to deliverables in Part 6 below.
    Source: read packages/engine/src/WireEngine.ts lines 34, 64-69.

  ✓ Polar clamp in WireEngine: POLAR_MIN_DEG = 5.7296°, POLAR_MAX_DEG = 80.2141°
    (lines 31-32). Cascade (Kengai) requires angles >90°. TwineWeightEngine must NOT
    apply this clamp. Kengai polar target and TwineWeightEngine clamp specified in Part 0.
    Source: read packages/engine/src/WireEngine.ts lines 29-32.

  ✓ overlays field in TechniqueResult already typed as Array<'Jin' | 'Water-and-Land'>.
    MINOR (overlays string[]) already resolved in current spec — no further action needed.
    Source: TechniqueResult definition in this document.

UNVERIFIED (corrective pass):
  ? Voxelizer support for polar angles >80.2°. The voxelizer's polar clamp is
    POLAR_MAX_DEG = 80.2141° in WireEngine, but it may be a voxelizer constraint or
    only a WireEngine gate. Cascade requires angles up to ~150°. The voxelizer package
    could not be read to confirm whether it supports these angles.
    → FLAGGED: voxelizer team must validate polar range before TwineWeightEngine ships.
    RISK: cascade is unrenderable if voxelizer hard-clamps at 80.2°.
```

---

## CODE SOURCE AUDITS

No external code snippets or third-party patterns incorporated. All design references
are internal to this repository (read directly). No audit required.

---

## CROSS-REFERENCE CHECK

```
CROSS-REFERENCE CHECK
  checked against:
    - packages/shared/src/index.ts
    - packages/engine/src/WireEngine.ts
    - packages/engine/src/StatDeriver.ts
    - packages/engine/src/CareLogReplay.ts
    - packages/engine/src/index.ts
    - docs/DESIGN-TECHNIQUE-CLASSIFICATION.md
    - docs/DESIGN-TWINE-VS-WIRE.md
    - docs/DESIGN-SPECIES-TECHNIQUE-ARCHETYPES.md
    - verified-architect SKILL.md (terminology canon)

  consistent: MOSTLY YES — one doc inconsistency found (see below)

  terminology aligned:
    ✓ Techniques: Bound-and-Cut / Clip-and-Grow / Jin / Water-and-Land
      (hyphenated, title case) — consistent across classification doc, archetypes doc,
      and skill terminology canon.
    ✓ VoxelRole.SCAR used for wire overstay and jin deadwood. NOT for prune scars
      (the comment at packages/shared/src/index.ts line 94 says "prune scar (reserved)"
      which is WRONG — see MINOR implementation note in Part 7 below).
      SCAR sources: wire overstay (unintentional) + jin (intentional) only.
      Source: confirmed by owner 2026-07-31 and PATCH-TWINE-SCAR-CLARIFICATION-2026-07-31.md.
    ✓ matchPct, skillSlots, skillPoints, wisdom — not affected by this spec.
    ✓ CareLogEntry (not "CareLog" as a standalone type) — the care log is CareLogEntry[].

  data shapes aligned:
    ✓ New CareAction variants follow exact pattern of existing wire action: snake_case
      type discriminant, camelCase fields, cost fields for premium consumables.
    ✓ TechniqueResult follows StatSheet pattern (output type in shared, consumed by engine
      and any downstream system).
    ✓ Coordinate type reused for landscape position (defined in shared, already imported
      by engine indirectly via other types).

  boundary violations: NONE
    - shared → no engine imports (safe)
    - engine → shared (CareLogEntry, CareAction, Coordinate, TechniqueResult): valid,
      consistent with current engine → shared dependency direction
    - engine does NOT import from voxelizer (no new circular dep introduced)

  DOC INCONSISTENCY FOUND — REQUIRES OWNER RESOLUTION:
    DESIGN-TWINE-VS-WIRE.md line 27 states:
      "twine counts as 'binding' — twine + shears = Bound-and-Cut. A player using
      ONLY twine (no wire) + shears is Bound-and-Cut, NOT Clip-and-Grow."
    DESIGN-TWINE-VS-WIRE.md line 28 states:
      "A player using ONLY shears + twine + weights (no metal wire ever) is still
      Clip-and-Grow eligible."
    DESIGN-TECHNIQUE-CLASSIFICATION.md line 71 states:
      "A care log with zero wire ever AND twine uses = still Clip-and-Grow eligible."

    Line 27 and line 28-29 of the same document contradict each other. The question:
    does twine use disqualify Clip-and-Grow?

    RESOLUTION (for implementer): This spec adopts the rule from
    DESIGN-TECHNIQUE-CLASSIFICATION.md (GDD v0.2, July 23 2026 — explicitly marked
    AUTHORITATIVE from GDD) and the second sentence in DESIGN-TWINE-VS-WIRE.md
    (confirmed 2026-07-28). The pseudocode in the classification doc is unambiguous:
    wireCount counts METAL WIRE ONLY. Twine use does NOT increment wireCount and does
    NOT disqualify Clip-and-Grow.

    Line 27 of DESIGN-TWINE-VS-WIRE.md appeared to describe the conceptual spirit of
    the Bound-and-Cut archetype rather than a classification rule. It was NOT
    implemented as a rule. OWNER RESOLVED 2026-07-31: DESIGN-TWINE-VS-WIRE.md patched
    (see docs/pipeline/PATCH-TWINE-SCAR-CLARIFICATION-2026-07-31.md). Confirmed:
    twine never increments wireCount, never creates SCAR voxels, and does not
    disqualify Clip-and-Grow. SCAR voxels have exactly two sources: wire overstay
    (unintentional) and jin (intentional).
```

---

## THE DESIGN

---

### Part 0 — Physics Model & Branch Field Additions

*Owner-confirmed 2026-07-31. Resolves BLOCKER-2 and MAJOR-3.*

#### 0.1 — Bending Physics Formula

The wood stress model governs how wire, twine, and weight interact with branch wood:

**Core stress formula**
```
S = τ_Total / D³
```
- `S` = internal wood stress (normalized, dimensionless)
- `τ_Total` = sum of all applied torques on this branch (twine + weight contributions)
- `D` = branch diameter in voxel units  
  — NOTE: `Branch.thickness` in the codebase is **radius**; `D = 2 × thickness`
- `D³` determines resistance: doubling D makes a branch 8× harder to bend

**Breaking threshold**
```
T = branch_breaking_threshold  (species-defined constant)
T_wire = T × (1 + wireGaugeQuality)   // wire raises T; it does NOT add to τ_Total
```
If `S > T_wire`: branch snap → trigger snap animation.  
Wire is a mechanical constraint that forces a specific angle AND raises the breaking threshold. It does not contribute to `τ_Total` in the stress formula.

**Tool torque contributions**
| Tool | Torque formula | Notes |
|---|---|---|
| Twine / Guy Wire | `τ = F · r · sin(θ)` (static) | r = branch length at application; static — does not change as branch grows |
| Weights | `F_g = m · g` (continuous) | Grows as branch lengthens (longer r = more torque per tick). Gravity-axis only. |
| Wire (coiled) | n/a — raises T, not τ | Mechanically forces angle. Stress tracking uses timing windows (C++ parity). |

**Stress decay and set**
- Each game-day tick: `currentStress -= currentStress × stressDecayRatePerDay(D)`
- `stressDecayRatePerDay(D)` is D-dependent (not a single fixed constant across all branches):  
  calibrated so that `setDays(D) = lerp(28, 56, D / D_max)` is achieved per branch.
- When `currentStress ≤ STRESS_SET_THRESHOLD` (≈ 0.001 × stressInitial): **bend permanently set**.
  The branch's `angle` at that moment becomes the permanent resting angle.
  `currentStress` is zeroed (or left at threshold) as a sentinel.

**Spring-back on tool removal**
```
springBack = angleDelta × S_remaining / S_initial
           = angleDelta × (Branch.currentStress / Branch.stressInitial)
```
- `springBack = 0` when `currentStress ≈ 0` (fully set — no spring-back, cascade preserved)
- `springBack ≈ angleDelta` when `currentStress ≈ stressInitial` (removed immediately — near-full spring-back)

**SCAR trigger (wire overstay only)**
- SCAR is NOT triggered at `wire-remove` time.
- During `applyDailyUpdate` tick: if `Branch.wired === true` AND `currentStress ≤ STRESS_SET_THRESHOLD` AND `Branch.wireSet === false`: set `Branch.wireScarred = true`, mark SCAR voxels.
- `wire-remove` stops future SCAR accumulation; existing SCAR voxels are permanent.
- Twine and weights: NEVER produce SCAR. No SCAR on twine overstay or weight overstay.

#### 0.2 — Set Time Reference

```
setDays = lerp(28, 56, D / D_max)
1 week = 7 game days = 3.5 real days. No Evergreen species penalty.
```

| D | setDays | Real time |
|---|---|---|
| D_min (thin branch) | 28 game days | 4 game weeks ≈ 2 real weeks |
| D_max (thick trunk) | 56 game days | 8 game weeks ≈ 4 real weeks |
| D_max / 2 (mid) | 42 game days | 6 game weeks ≈ 3 real weeks |

`D_max` = maximum branch diameter in the growth simulation. The implementer calibrates `D_max` from the growth engine's max thickness constants.

#### 0.3 — Branch Field Additions (BLOCKER-2 resolution)

**Architecture decision (owner recommended, 2026-07-31):**  
Store `currentStress` on Branch for **O(1) per-tick updates**.  
On cold start / seed replay: derive `currentStress` by scanning the care log, computing S from τ at each binding event, and replaying decay ticks to the current day.

Add to `packages/shared/src/index.ts` **Branch** interface (after existing `attachmentY` field):

```typescript
  // ── Physics / Stress State (2026-07-31 — physics model; BLOCKER-2 fix) ──────────
  /**
   * Branch diameter in voxel units. D = 2 × thickness (Branch.thickness is radius).
   * Drives stress formula S = τ/D³. Grows each growTick with the thickening pass.
   * Initialized to 2 × thickness at fork time; updated every thickeningPass.
   */
  diameter: number;

  /**
   * Current wood stress [0 .. stressInitial]. Stored for O(1) per-tick access.
   * Each game-day: currentStress *= (1 - stressDecayRatePerDay(diameter)).
   * When currentStress ≤ STRESS_SET_THRESHOLD: bend is permanently set.
   * On cold start / seed replay: derived from log; see CareLogReplay.
   */
  currentStress: number;

  /**
   * S at the time the most recent twine or weight binding was applied.
   * Used for spring-back: springBack = angleDelta × currentStress / stressInitial.
   * Reset each time twine or weight is applied or removed (τ_Total changes).
   * NOT updated on wire-apply (wire raises T, not S).
   * 0 when no twine/weight is active.
   */
  stressInitial: number;

  // ── Wire Binding State (C++ parity — KIJO-ENGINE-API.md Branch struct) ──────────
  wired: boolean;           // wire currently applied to this branch
  wireAppliedDay: number;   // game-day when wire was applied; 0 if not wired
  wireAngle: number;        // bend angle (degrees) applied by wire
  wireSet: boolean;         // true: bend permanently set (6-12 month window hit)
  wireScarred: boolean;     // true: wire overstay — S=0 while wire still on → SCAR voxels applied

  // ── Twine Binding State (C++ parity) ────────────────────────────────────────────
  twined: boolean;          // twine currently applied
  twineAppliedDay: number;  // game-day when twine was applied; 0 if not twined
  twineAngle: number;       // bend angle (degrees) applied by twine

  // ── Weight Binding State ─────────────────────────────────────────────────────────
  weighted: boolean;        // one or more weights currently attached
  weightCount: number;      // number of weights attached; 0-4. Cap enforced by TwineWeightEngine.
```

**Default values for new fields on a newly-forked branch (Day-0 / new fork):**
All boolean fields = `false`. All numeric fields = `0`. `diameter` initialized to `2 × b.thickness` at fork time. `currentStress = 0`, `stressInitial = 0` (no binding yet).

#### 0.4 — Cascade Mechanic (MAJOR-3 resolution)

The Kengai (Cascade) bonsai style is achieved through iterative bend-and-set — NOT a single large bend. The physics model makes this deterministic:

1. **Apply** twine/weight: branch bends to angle θ₁. `stressInitial = τ₁ / D³`. `currentStress = stressInitial`.
2. **Tick**: each game-day `currentStress` decays at `stressDecayRatePerDay(D)`.
3. **Set**: at `currentStress ≤ STRESS_SET_THRESHOLD`, `Branch.angle` (now = θ₁) is the **permanent** resting angle.
4. **Re-apply**: remove twine (spring-back ≈ 0 since S_remaining ≈ 0). Apply new twine for another Δθ.
5. **New angle**: branch now bends to θ₂ = θ₁ + Δθ. Repeat.
6. **Cascade**: cumulative angle grows past 90° (horizontal), then past 150°+ (hanging below pot edge).

`Branch.naturalAngle` is **NOT** a separate field. The cascade accumulates in `Branch.angle` as bends permanently set. The branch's `angle` after each full set cycle IS its new natural resting angle. There is no separate tracking needed.

**Polar angle range for TwineWeightEngine:**  
WireEngine clamps to `[POLAR_MIN_DEG = 5.7°, POLAR_MAX_DEG = 80.2°]` (the voxelizer's current validated polar range). Cascade requires angles beyond 80.2°. TwineWeightEngine must **NOT** apply the WireEngine polar clamp. Instead, use `[0°, KENGAI_POLAR_MAX = 150°]`. See MINOR: voxelizer must validate support for angles in this range.

```typescript
// TwineWeightEngine clamp constants (not WireEngine constants)
export const TWINE_MAX_ANGLE_DELTA = 28;       // degrees per application (owner-confirmed)
export const WEIGHT_DEGREES_PER_UNIT = 7;      // degrees per weight (owner-confirmed)
export const KENGAI_POLAR_MAX = 150;           // ° — max cumulative cascade angle
export const STRESS_SET_THRESHOLD = 0.001;     // currentStress / stressInitial ratio = "fully set"
export const STRESS_DECAY_MIN_DAYS = 28;       // setDays for D = D_min (thin branch)
export const STRESS_DECAY_MAX_DAYS = 56;       // setDays for D = D_max (trunk)
```

---

### Part 1 — CareAction Additions

Add to `packages/shared/src/index.ts`. Four new discriminated union members appended
to the existing CareAction union. Also add `LandscapeElementType` as a new exported type.

#### 1.1 — New exported type: LandscapeElementType

```typescript
/**
 * The element types that can be placed in a bonsai pot for Water-and-Land technique.
 * Each placed element is a landscape action in the care log.
 * Threshold for Water-and-Land overlay: landscapeCount >= 3.
 *
 * Phase 1 (fictional Guild seller basic store items): rock, moss, pot. // Lore terminology revised 2026-09-24; personal name pending.
 * Phase 2+ (NFT collectible items — out of Phase 1 scope): water_feature, figurine, ceramic.
 * [RESOLVED 2026-07-31 OQ-7: confirmed 3-literal Phase 1 union per owner.]
 */
export type LandscapeElementType =
  | 'rock'
  | 'moss'
  | 'pot';
```

**Notes:**
- Snake_case for consistency with existing string literal types in shared (`'skill_point'`,
  `'neutral'` in StatType).
- Phase 1 set confirmed by owner (2026-07-31): `'rock' | 'moss' | 'pot'` (basic store items
  from the fictional Guild seller). Phase 2+ items (`water_feature`, `figurine`, `ceramic`) are earned NFT
  collectibles — out of Phase 1 scope. Adding new literals later is non-breaking; removing is breaking.
- Element type affects visual rendering and NFT metadata, not combat stats.

---

#### 1.2 — Updated CareAction union

Replace the current definition (lines 35-43 of index.ts) with:

```typescript
export type CareAction =
  | { type: 'water' }
  | { type: 'rotate' }
  | { type: 'prune'; branchId: number }
  | { type: 'fertilize' }
  // WIRE (2026-07-19): bend a depth-1 branch. angleDelta is the replay input
  // (degrees, signed); oldAngle/newAngle/wireCost are the historical record so
  // replay stays independent of tuning constants. See WireEngine.
  // NOTE: depth-1 restriction REMOVED per OQ-1 (any branch/trunk can be wired).
  | { type: 'wire'; branchId: number; angleDelta: number; oldAngle: number; newAngle: number; wireCost: number }
  // WIRE-REMOVE (2026-07-31): free action. Timing determines outcome per physics model.
  // Spring-back = angleDelta × (S_remaining / S_initial) = angleDelta × (currentStress / stressInitial).
  // S_remaining derived from Branch.currentStress at the moment of this log entry.
  // SCAR is triggered during applyDailyUpdate ticks (overstay), NOT at wire-remove time.
  // wire-remove stops future SCAR accumulation; existing SCAR is permanent.
  // Without this entry: CareLogReplay cannot distinguish "wire still on" from "removed at day N";
  // spring-back is non-reproducible; SCAR overstay mechanic is unimplementable for replay.
  // [BLOCKER-1 fix 2026-07-31]
  | { type: 'wire-remove'; branchId: number }
  // TWINE (2026-07-30): free-tier impermanent bend. degradeDays drawn from RNG at
  // application time (range 10–15 game days) and stored for replay independence.
  // Does NOT count as a wire use for Clip-and-Grow classification.
  // angleDelta clamped to ±TWINE_MAX_ANGLE_DELTA = 28°. [RESOLVED 2026-07-31 OQ-3]
  // oldAngle/newAngle are historical record same as wire.
  | { type: 'twine'; branchId: number; angleDelta: number; oldAngle: number; newAngle: number; degradeDays: number }
  // TWINE-REMOVE (2026-07-31): caretaker removes twine before natural degradation.
  // branchId identifies which branch's twine is removed. No additional fields needed.
  | { type: 'twine-remove'; branchId: number }
  // WEIGHT (2026-07-30): free-tier downward pull. Gravity-only (cannot bend upward).
  // Physics model (2026-07-31): weights apply continuous gravity torque τ = F_g × r (grows as branch grows).
  // weightCount: integer 1-4 (discrete count; cap enforced by TwineWeightEngine).
  // torqueContribution: τ at application time = weightCount × m_per_weight × g × branchLength × sin(θ),
  //   stored for replay independence — if branch length or mass constants change during tuning,
  //   historical replay uses the stored torque value not the recomputed one.
  // Max 4 weights per branch; each adds ≈7° downward at game-constant mass. [RESOLVED 2026-07-31 OQ-3]
  // Does NOT count as a wire use for classification. No SCAR ever.
  // [MAJOR-4 fix 2026-07-31: weightAmount → weightCount + torqueContribution]
  | { type: 'weight'; branchId: number; weightCount: number; torqueContribution: number }
  // WEIGHT-REMOVE (2026-07-31): caretaker removes an attached weight bag from a branch.
  // Weight removal must be tracked for replay independence. [RESOLVED 2026-07-31 OQ-2]
  | { type: 'weight-remove'; branchId: number }
  // JIN (2026-07-30): premium jin pliers. Permanently converts a bark segment to
  // deadwood (SCAR voxels). segmentIndex is 0-based position from trunk junction.
  // jinCost is the consumable count spent (analogous to wireCost). Irreversible.
  // Increments jinCount for Jin overlay classification.
  | { type: 'jin'; branchId: number; segmentIndex: number; jinCost: number }
  // LANDSCAPE (2026-07-30): premium. Places an element in the pot for Water-and-Land.
  // Increments landscapeCount toward the >= 3 Water-and-Land overlay threshold.
  // position uses the shared Coordinate type (voxel grid, 0-255 each axis).
  | { type: 'landscape'; elementType: LandscapeElementType; position: Coordinate };
```

**Field-by-field specification:**

**`twine`**

| Field | Type | Required | Constraint | Purpose |
|---|---|---|---|---|
| `type` | `'twine'` | ✓ | discriminant | |
| `branchId` | `number` | ✓ | valid branch index | which branch to bend |
| `angleDelta` | `number` | ✓ | clamped to ±28° [RESOLVED 2026-07-31] | replay input (degrees, signed) |
| `oldAngle` | `number` | ✓ | polar range [0.1–1.4 rad in deg] | historical record for replay independence |
| `newAngle` | `number` | ✓ | same | historical record after clamp |
| `degradeDays` | `number` | ✓ | integer, 10–15 game days | RNG-drawn at application time; when to spring back |

- **Tier:** free (no cost field)
- **Impermanence:** branch returns to oldAngle at `applicationDay + degradeDays` unless re-applied
- **Classification:** does NOT increment wireCount. Twine use has no effect on Clip-and-Grow eligibility.
- `degradeDays` follows the `wireCost`/`angleDelta` pattern of storing derived values in the log for replay independence. Without storing `degradeDays`, a change to the degradation RNG range would alter replay outcomes.

**`weight`** *(updated 2026-07-31 MAJOR-4 fix)*

| Field | Type | Required | Constraint | Purpose |
|---|---|---|---|---|
| `type` | `'weight'` | ✓ | discriminant | |
| `branchId` | `number` | ✓ | valid branch index | which branch receives the weight(s) |
| `weightCount` | `number` | ✓ | integer 1–4 | discrete count of weights attached in this action |
| `torqueContribution` | `number` | ✓ | > 0, N·m in engine units | τ at application time; stored for replay independence |

- **Tier:** free (no cost field)
- **Direction:** always downward (gravity-only). Weights apply `τ = F_g × r × sin(θ)` where `F_g = weightCount × m_per_weight × g` and `r = Branch.length` at application time. No direction field needed — gravity axis is implicit.
- **Torque grows over time:** as the branch grows (increasing `r`), the weight's effective torque increases each tick. This is factored into the stress update: `currentStress += (torqueAddedPerTick) / D³` each tick while weighted. The stored `torqueContribution` is the initial τ at application — the engine recomputes actual τ each tick based on current branch length.
- **Permanence:** bend sets gradually via stress decay. Engine tracks active weight via `Branch.weighted` and `Branch.weightCount`.
- **Classification:** does NOT increment wireCount. Weight use has no effect on Clip-and-Grow eligibility.
- **SCAR:** never. Weights are free-tier with no SCAR risk ever.
- **Max weights:** 4 per branch (`Branch.weightCount ≤ 4`). Each weight ≈ 7° downward per game-constant mass. Max contribution: 4 × 7° = 28° per application (capped independently from twine). [RESOLVED 2026-07-31 OQ-3]
- **Removal:** `weight-remove` variant required for replay. [RESOLVED 2026-07-31 OQ-2]
- **Replay independence justification (MAJOR-4):** storing `torqueContribution` means historical replay entries are not affected by tuning changes to `m_per_weight` or `g` constants. The engine uses the stored τ for stress-initial computation, not re-derived values. Analogous to `wireCost` and `angleDelta` in the wire action.

**`jin`**

| Field | Type | Required | Constraint | Purpose |
|---|---|---|---|---|
| `type` | `'jin'` | ✓ | discriminant | |
| `branchId` | `number` | ✓ | valid branch index | which branch loses bark |
| `segmentIndex` | `number` | ✓ | ≥ 0, integer, < branch segment count | 0 = base (trunk junction), increases toward tip |
| `jinCost` | `number` | ✓ | positive integer, ≥ 1 | jin pliers consumables spent |

- **Tier:** premium (jinCost tracks consumable spend; premium gate enforced upstream)
- **Effect:** converts segment's bark voxels to SCAR voxels (VoxelRole.SCAR). Irreversible.
- **Classification:** increments `jinCount`. Qualifies Jin overlay at `jinCount >= 1`.
- **Note on `segmentIndex`:** 0-based index along the branch from trunk junction toward tip. The C++ spec's exact encoding is UNVERIFIED — see Assumptions register. If the C++ spec uses a different identifier, reconcile at that boundary.

**`landscape`**

| Field | Type | Required | Constraint | Purpose |
|---|---|---|---|---|
| `type` | `'landscape'` | ✓ | discriminant | |
| `elementType` | `LandscapeElementType` | ✓ | one of 3 literal values (Phase 1) | element category |
| `position` | `Coordinate` | ✓ | x,y,z each 0–255 | placement in pot (voxel grid) |

- **Tier:** premium (gate enforced upstream, not in type)
- **Classification:** increments `landscapeCount`. Qualifies Water-and-Land overlay at `landscapeCount >= 3`.
- **Combat:** landscape elements do NOT modify any combat stat. Engine code reading technique state for combat must explicitly ignore `'Water-and-Land'` in overlays.
- **Position required:** stored for deterministic replay and visual rendering of the Water-and-Land scene. The classification only cares about count, but replay requires knowing where elements were placed.

---

### Part 2 — TechniqueResult Type

Add to `packages/shared/src/index.ts` (same file as StatSheet, same pattern).

```typescript
/**
 * The full technique classification of a kijonsai at a given point in its care log.
 * Produced by TechniqueClassifier.classify() in @kijo/engine.
 * Mirrors the StatSheet pattern: output type lives in shared so any downstream
 * system (awakening, NFT metadata, fighter) can import it without depending on engine.
 *
 * primary — mutually exclusive: always exactly one.
 * overlays — additive: zero, one, or both may be present simultaneously.
 *
 * The diagnostic count fields are included because they are needed for:
 *   - discovery notification gating (one-time flags per tree per technique)
 *   - NFT metadata embedding
 *   - downstream test/audit assertions without re-scanning the log
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
```

**Design decisions:**

1. **Canonical string values** — uses GDD-canonical hyphenated forms (`'Bound-and-Cut'`,
   `'Clip-and-Grow'`, `'Jin'`, `'Water-and-Land'`) not the pseudocode identifiers
   (`BOUND_AND_CUT`, `CLIP_AND_GROW`, etc.). Consistent with how SpeciesClass uses
   lowercase strings (`'hardwood'`, `'evergreen'`, `'tropical'`) rather than enum constants.

2. **overlays as Array<...>** — not a fixed-shape object — because overlays are independent
   and both optional. Callers check `result.overlays.includes('Jin')` rather than a
   nullable field. This matches the doc's description of `overlays = []` as an array.

3. **Count fields included** — `wireCount`, `pruneCount`, `jinCount`, `landscapeCount`,
   `treeAgeDays` are outputs alongside the classification decision because:
   - Notification gating logic needs these values without re-scanning the log
   - NFT metadata layer needs them for on-chain embedding
   - Tests assert on intermediate values, not just final classification
   - Cost: the classifier already computes these; returning them is free.

4. **No confidence field** — technique classification is deterministic, not probabilistic.
   No confidence value is meaningful or needed.

---

### Part 3 — TechniqueClassifier Class Signature

Create at `packages/engine/src/TechniqueClassifier.ts`:

```typescript
import type { CareLogEntry, TechniqueResult } from '@kijo/shared';

/**
 * TechniqueClassifier — pure, stateless technique classification.
 *
 * Reads a CareLogEntry array and tree age, counts action types that affect
 * technique classification, and returns a TechniqueResult.
 *
 * Classification rules (DESIGN-TECHNIQUE-CLASSIFICATION.md, authoritative):
 *
 *   wireCount   = count of { type: 'wire' } entries  (twine does NOT count)
 *   pruneCount  = count of { type: 'prune' } entries
 *   jinCount    = count of { type: 'jin' } entries
 *   landscapeCount = count of { type: 'landscape' } entries
 *
 *   primary:
 *     CLIP_AND_GROW if wireCount === 0 && pruneCount >= 2 && treeAgeDays >= 30
 *     else BOUND_AND_CUT (default)
 *
 *   overlays:
 *     'Jin'            if jinCount >= JIN_MIN_USES (= 1)
 *     'Water-and-Land' if landscapeCount >= LAND_MIN_ELEMENTS (= 3)
 *
 * Thresholds (pruneCount >= 2, treeAgeDays >= 30, landscapeCount >= 3, jinCount >= 1)
 * are extracted to named constants (see below) for easy playtesting tuning.
 * All marked "R22 first-pass values" in the design doc except JIN_MIN_USES which
 * is deliberate-design (each jin use is costly; even 1 qualifies).
 *
 * Follows StatDeriver pattern: all static methods, no constructor, pure computation.
 */
export class TechniqueClassifier {
  // Tuning constants — extract from design doc thresholds.
  // All marked for playtest tuning per DESIGN-TECHNIQUE-CLASSIFICATION.md note.
  static readonly CLIP_MIN_PRUNES   = 2;   // R22 first-pass
  static readonly CLIP_MIN_AGE_DAYS = 30;  // R22 first-pass
  static readonly LAND_MIN_ELEMENTS = 3;   // from design doc
  static readonly JIN_MIN_USES      = 1;   // one jin action qualifies; see DESIGN-TECHNIQUE-CLASSIFICATION.md §Jin
  // [MINOR fix 2026-07-31: JIN_MIN_USES added for consistency; currently 1 per design doc.
  //  If ever tuned to 2, change only this constant — not a magic number in the loop.]

  /**
   * Classify a tree's care log into a TechniqueResult.
   *
   * @param careLog   The tree's full care log (CareLogEntry[], not CareAction[]).
   *                  Implementer: scan every entry's action.type to count qualifying
   *                  actions. Action types not listed in the classification rules
   *                  (water, rotate, fertilize, twine, weight) are ignored.
   *
   * @param treeAgeDays  The tree's current age in game days (from TreeState.day).
   *                     Cannot be reliably derived from the care log alone — a tree
   *                     may go many days without a care action, so max(entry.day)
   *                     would undercount. Caller must provide this explicitly.
   *
   * @returns TechniqueResult with primary, overlays, and diagnostic count fields.
   *
   * This method is pure and referentially transparent: same inputs → same output.
   * Caching strategy [RESOLVED 2026-07-31 OQ-6]: re-classify ONLY when the caretaker
   * opens the voxel viewer (lazy/on-demand). Cache the last TechniqueResult at the call
   * site (e.g., viewer open handler) and invalidate on viewer open. Do NOT re-run on
   * every care action.
   */
  static classify(careLog: CareLogEntry[], treeAgeDays: number): TechniqueResult;
}
```

**Static vs instance decision:**
- Static. No external dependencies, no configuration, no injected state.
- Consistent with StatDeriver which is also all-static.
- If caching is desired in the future, it belongs at the call site (e.g., in CareLogReplay or a tree record layer), not inside TechniqueClassifier itself.

**No additional public helpers:**
- The count fields are returned inside TechniqueResult — callers can read them from the result
  without a separate `countWireUses()` helper.
- Internal counting logic is one private loop; no reason to expose it.

**CareAction[] vs CareLogEntry[] — rationale for the change from task's proposed signature:**

The task proposed `classify(careLog: CareAction[]): TechniqueResult`. This is refuted by
observed engine patterns:
1. All engine code uses `CareLogEntry[]` for the care log (CareLogReplay, BonsaiTree).
2. A bare `CareAction[]` would require the caller to destructure `entry.action` from every
   `CareLogEntry` before calling, which is a pointless transform.
3. `treeAgeDays` must be explicit because a tree can have age 40 with its last care action
   on day 5 — max(entry.day) would return 5, not 40. The age gate would misfire.

The correct signature passes the log as-is (`CareLogEntry[]`) and takes `treeAgeDays` as a
separate, explicit parameter.

---

### Part 4 — Package Placement

#### CareAction additions → `packages/shared/src/index.ts`

Extend the existing CareAction union (lines 35-43). Add `LandscapeElementType` type
immediately before or immediately after the CareAction type. No new files.

```
packages/shared/src/index.ts
  ADD: export type LandscapeElementType = ...        (new, before CareAction)
  MODIFY: export type CareAction = ... | twine | weight | jin | landscape
  ADD: export interface TechniqueResult { ... }      (new, after CareLogEntry)
```

**Rationale for TechniqueResult in shared:**
StatSheet lives in shared; TechniqueResult is the same kind of cross-boundary output type.
The awakening system (which derives combat archetype from technique × species) is not
in the engine package — it should be able to import `TechniqueResult` without depending
on `@kijo/engine`. Same pattern as how all downstream systems import `StatSheet` from
`@kijo/shared`.

#### TechniqueClassifier → `packages/engine/src/TechniqueClassifier.ts`

New file. Imports `CareLogEntry` and `TechniqueResult` from `@kijo/shared`.
No imports from voxelizer (preserves current engine→shared-only dep graph).

#### Export from `packages/engine/src/index.ts`

Add two lines following existing export patterns:

```typescript
export { TechniqueClassifier } from './TechniqueClassifier.js';
export type { TechniqueResult } from '@kijo/shared';   // re-export for engine consumers
```

Re-exporting `TechniqueResult` from engine is optional but follows the precedent of
`WireResult` (exported from engine/src/index.ts line 10). Keeps engine consumers from
needing to know TechniqueResult lives in shared.

#### CareLogReplay update (out of scope for this spec — flagged for implementer)

`packages/engine/src/CareLogReplay.ts` line 33 currently has no handling for `jin`,
`twine`, `weight`, or `landscape` actions. The `else if` chain will silently ignore
them (no `else` clause, no error). Implementer must add branches for all new action types:
`twine`, `twine-remove`, `weight`, `weight-remove`, `wire-remove`, `jin`, `landscape`.

---

### Part 5 — BonsaiTree Method Stubs (MAJOR-5 resolution)

`BonsaiTree.ts` currently has no methods for the new action types. CareLogReplay delegates
to BonsaiTree for every action type (same pattern as `WireEngine.wire(tree, ...)` dispatch).
The following method stubs must be added to `packages/engine/src/BonsaiTree.ts`:

```typescript
// New engine files to create (delegates):
//   packages/engine/src/TwineWeightEngine.ts — handles twine + weight bending physics
//   packages/engine/src/JinEngine.ts          — handles jin bark-strip → SCAR voxels

/**
 * Apply twine to a branch, bending it by angleDelta degrees.
 * Delegate to TwineWeightEngine.applyTwine().
 * Returns TwineResult { ok: boolean; reason?: TwineRejectReason }.
 */
applyTwine(branchId: number, angleDelta: number): TwineResult;

/**
 * Remove twine from a branch. Trigger spring-back computation.
 * Spring-back = twineAngle × (currentStress / stressInitial).
 * Delegate to TwineWeightEngine.removeTwine().
 */
removeTwine(branchId: number): void;

/**
 * Attach weightCount weights to a branch. Downward gravity pull only.
 * torqueContribution computed by TwineWeightEngine from branch state at call time.
 * Returns WeightResult { ok: boolean; reason?: WeightRejectReason; torqueContribution: number }.
 */
applyWeight(branchId: number, weightCount: number): WeightResult;

/**
 * Remove weights from a branch. Updates Branch.weighted, Branch.weightCount.
 * Stress adjustment handled by TwineWeightEngine.removeWeight().
 */
removeWeight(branchId: number): void;

/**
 * Remove wire from a branch. Free action. Timing determines outcome (spring-back vs set).
 * Spring-back handled by WireEngine.removeWire() using Branch.currentStress, Branch.stressInitial.
 * Logs { type: 'wire-remove', branchId }.
 * Delegate to WireEngine.removeWire().
 */
removeWire(branchId: number): void;

/**
 * Strip bark from a branch section using jin pliers → SCAR voxels (VoxelRole.SCAR).
 * Converts segment segmentIndex through branch tip + all sub-branches to SCAR.
 * Increments jinCount for TechniqueClassifier.
 * Returns JinResult { ok: boolean; reason?: JinRejectReason; scarVoxelCount: number }.
 * Delegate to JinEngine.applyJin().
 */
applyJin(branchId: number, segmentIndex: number, jinCost: number): JinResult;

/**
 * Place a landscape element in the pot for Water-and-Land technique.
 * Increments landscapeCount toward LAND_MIN_ELEMENTS (= 3) overlay threshold.
 * Logs { type: 'landscape', elementType, position }.
 * Position validated to be within pot bounds (Coordinate 0–255 each axis).
 */
addLandscape(elementType: LandscapeElementType, position: Coordinate): void;
```

**New result types to add to `packages/shared/src/index.ts`:**
```typescript
// Analogous to WireResult in WireEngine.ts
export type TwineRejectReason = 'not-found' | 'pruned' | 'too-thick' | 'already-twined';
export interface TwineResult { ok: boolean; reason?: TwineRejectReason; oldAngle?: number; newAngle?: number; }

export type WeightRejectReason = 'not-found' | 'pruned' | 'weight-cap-exceeded';
export interface WeightResult { ok: boolean; reason?: WeightRejectReason; torqueContribution?: number; }

export type JinRejectReason = 'not-found' | 'pruned' | 'segment-out-of-range' | 'already-jin';
export interface JinResult { ok: boolean; reason?: JinRejectReason; scarVoxelCount?: number; }
```

**Export from `packages/engine/src/index.ts`:**
```typescript
export { TwineWeightEngine } from './TwineWeightEngine.js';
export { JinEngine }         from './JinEngine.js';
export type { TwineResult, TwineRejectReason, WeightResult, WeightRejectReason,
              JinResult, JinRejectReason } from '@kijo/shared';
```

---

### Part 6 — WireEngine Gate Removal (MAJOR-6 resolution)

Per OQ-1 resolution (Assumption 2): any branch at any depth, including the trunk (depth 0),
can be wired. This is required for the Kengai (Cascade) style where the trunk bends downward.

**Deliverables in `packages/engine/src/WireEngine.ts`:**

1. **Remove the depth-1 gate** at line 69:
   ```typescript
   // DELETE THIS LINE:
   if (b.depth !== 1) return { ok: false, reason: 'not-depth-1' };
   ```

2. **Remove `'not-depth-1'` from `WireRejectReason`** (line 34):
   ```typescript
   // BEFORE:
   export type WireRejectReason = 'not-found' | 'pruned' | 'not-depth-1' | 'too-thick';
   // AFTER:
   export type WireRejectReason = 'not-found' | 'pruned' | 'too-thick';
   ```
   **Note:** This is a breaking public-type change. Any callsite comparing `reason === 'not-depth-1'`
   will never match after this change. Grep for `'not-depth-1'` across the codebase before shipping.

3. **Update WireEngine JSDoc** (line 14): remove "Depth-1 only: trunk too thick, depth-2+ too fragile."
   Replace with: "Any branch at any depth, including trunk, can be wired (OQ-1 resolution 2026-07-31).
   Trunk wiring is required for Kengai (Cascade) style."

4. **Polar clamp note:** The existing WireEngine polar clamp `[POLAR_MIN_DEG, POLAR_MAX_DEG = 80.2°]`
   continues to apply to wire (wire bends are clamped to 80.2°). For cascade angles >80.2°, use
   `TwineWeightEngine` (which uses the KENGAI_POLAR_MAX = 150° clamp). Wire is capped at 80.2° per
   its existing clamp; this spec does not change WireEngine's angle clamp.

---

### Part 7 — Implementation Notes for Minors

#### 7.1 — VoxelRole.SCAR comment (MINOR fix — in packages/shared/src/index.ts)

`packages/shared/src/index.ts` line 94 currently reads:
```typescript
SCAR = 'scar', // prune scar (reserved)
```
This comment is **wrong**. SCAR voxels have exactly two sources: wire overstay (unintentional) and jin pliers (intentional). Pruning does NOT produce SCAR voxels. Implementer must update to:
```typescript
SCAR = 'scar', // deadwood: wire overstay (unintentional) or jin pliers (intentional). NOT a prune byproduct.
```
This is a comment-only change; no runtime impact.

#### 7.2 — Kengai polar angle target

Kengai (Cascade, style index 3 per CANONICAL-STYLES.md) is the only style whose ideal-path spline requires angles past horizontal. The StatTerrain spline for seed-index 3 should target a trunk polar angle of approximately **120°** (trunk hangs 30° past horizontal, well below the pot rim — classic full-cascade silhouette). TwineWeightEngine enforces `KENGAI_POLAR_MAX = 150°` as the hard ceiling.

Note: `STYLE_SPLINES[3]` (Kengai) is currently a stub per CANONICAL-STYLES.md. When implementing, the spline's terminal angle should be set to 120°. The implementer must validate with the voxelizer team that angles in range [90°, 150°] are renderable.

#### 7.3 — OQ-3 retraction inline note (DONE — patched in this corrective pass)

`docs/pipeline/PATCH-OQ-RESOLUTIONS-2026-07-31.md` OQ-3 section previously contained "56° total downward bend" without an inline retraction. **Patched in this corrective architect pass:** a strikethrough retraction with cross-reference to `PATCH-TWINE-WEIGHT-CAP-2026-07-31.md` has been added inline. Pipeline documentation fix; no code impact.

#### 7.4 — overlays typing (already resolved)

`TechniqueResult.overlays` is already typed as `Array<'Jin' | 'Water-and-Land'>` in this spec.
Not `string[]`. No further action required.

---

## ASSUMPTIONS

1. **`segmentIndex` maps to the C++ spec's segment identifier.** The C++ spec is not
   readable from the codebase. `segmentIndex: number` (0-based, trunk-junction = 0)
   is a reasonable TypeScript approximation of any sequential segment identifier.
   **Mitigation:** at integration time, verify against the C++ spec. If C++ uses a
   different enumeration scheme, reconcile in the engine layer without changing the
   TypeScript type (an adapter in JinEngine can convert).

   **BLOCKER-2 [RESOLVED 2026-07-31]:** Branch field additions + spring-back architecture
   now specified in Part 0.3. Architecture decision: store `currentStress` on Branch for
   O(1) per-tick updates. Derive from log on cold start / seed replay. See Part 0 for
   full Branch interface additions, spring-back formula, cascade mechanic, and SCAR trigger.

2. **[RESOLVED 2026-07-31 OQ-1] No depth restriction on twine or wire.**
   Owner confirmed 2026-07-31: twine AND wire can be applied to ANY branch at any depth,
   AND to the trunk itself. No depth-1-only restriction. This is required for the Kengai
   (Cascade) style where the trunk itself bends downward. TwineEngine and WireEngine must
   NOT enforce a depth-1-only constraint. Original assumption (depth-1 only by analogy
   with WireEngine.ts line 69) was incorrect — WireEngine's depth-1 gate should be
   removed as well.

3. **`degradeDays` is stored in the action for replay independence.**
   If degradeDays is always a fixed constant (not randomized), it doesn't need to be in
   the log (the engine can re-derive it from the constant). The 10–15 day range in the
   design docs implies randomization. This spec treats it as randomized (drawn at
   application time) and stores it in the log following the `wireCost` precedent.
   **Mitigation:** if owner decides degradation is always a fixed value, drop `degradeDays`
   from the twine action and use a `TWINE_DEGRADE_DAYS` constant instead. Non-breaking
   type change (field removal requires a minor bump).

4. **[MAJOR-4 RESOLVED 2026-07-31] `weightCount` + `torqueContribution` replace `weightAmount`.**
   The weight action now stores `weightCount: number` (integer 1–4) and
   `torqueContribution: number` (τ at application time in engine units: N·m or voxel-force·voxel).
   The implementer must define `WEIGHT_MASS_PER_UNIT` and `GRAVITY_CONSTANT` in TwineWeightEngine
   constants. `torqueContribution = weightCount × WEIGHT_MASS_PER_UNIT × GRAVITY_CONSTANT × branchLength × sin(currentAngle)`.
   **Mitigation:** owner specifies mass unit before implementing. Historical replay always uses the
   stored `torqueContribution`, not the re-derived value, so tuning constant changes don't break replay.

5. **[MAJOR-1 RESOLVED 2026-07-31] Landscape removal: Phase 2 explicit divergence.**  
   `KIJO-ENGINE-API.md` has `LANDSCAPE_REMOVE` in the C++ CareAction enum and
   `BonsaiTree::removeLandscape()`. This TypeScript Phase 1 spec explicitly diverges:
   - **Phase 1 TypeScript:** no `landscape-remove` CareAction variant. Landscape elements are permanent.
   - **The C++ `removeLandscape()` API method** is a forward stub for Phase 2 only. It is NOT
     currently wired to any game flow. The C++ enum entry `LANDSCAPE_REMOVE` is a forward declaration.
   - **Classification in Phase 1:** `landscapeCount = gross placements` (no decrement on removal).
   - **Cross-engine interop:** any `LANDSCAPE_REMOVE` entries in a C++ → TS replay are treated as
     **no-ops**. Implementer must add a no-op branch for this action type in CareLogReplay.
   - **Phase 2:** when landscape removal ships, add `{ type: 'landscape-remove'; elementId: number }`
     to CareAction and update TechniqueClassifier to count `landscapeCount = placements − removals`.
     This is a non-trivial design change requiring a classifier update and a versioned log format.
   **Mitigation:** Explicitly document the Phase 1 divergence in CareLogReplay comments so no
   implementer adds landscape removal under the assumption it affects classification.

---

## OPEN QUESTIONS

1. **[RESOLVED 2026-07-31] Twine depth restriction.** Twine AND wire can be applied to ANY
   branch at any depth, AND to the trunk itself. No depth restriction. Required for the
   Kengai (Cascade) style where the trunk itself bends downward. TwineEngine and WireEngine
   must NOT enforce a depth-1-only constraint. CareAction type is unaffected.

2. **[RESOLVED 2026-07-31] Weight removal action.** Weight removal must be tracked for
   replay independence. A `weight-remove` CareAction variant is required:
   `{ type: 'weight-remove'; branchId: number }`. Added to the CareAction union above.

3. **[RESOLVED 2026-07-31, CORRECTED 2026-07-31] Maximum cumulative weight per branch.** Up to 4 weights per
   branch. Each weight adds 7° of downward bend. Max weight contribution: 4 × 7° = 28°
   downward. Twine also caps at ±28°. These caps are INDEPENDENT — using twine AND weights
   on the same branch does NOT stack additively. A single application is still capped at 28°.
   Cascade (Kengai) is achieved by stacking over time: bend 28°, let partially set, re-apply
   for another 28°, repeat until trunk cascades past the pot edge. [PRIOR TEXT RETRACTED:
   an earlier version of this entry stated that twine and weights produced an additive combined
   bend exceeding 28°. Owner confirmed 2026-07-31 that claim was wrong — both methods cap
   independently at 28°, not additively.]
   Engine must enforce the 4-weight cap per branch. Twine max updated from ±15–20° to ±28°.

4. **[RESOLVED 2026-07-31] Jin segmentIndex semantics.** Jin converts everything from the
   chosen point OUTWARD to the tip. Picking `segmentIndex` N converts segment N through
   the branch tip, plus ALL sub-branches extending beyond that point — all become SCAR
   voxels (deadwood). `segmentIndex` = 0-based index from the branch's trunk junction.
   Reconciliation with the C++ segment identifier remains a TBD implementation task, but
   the semantic is confirmed. If C++ uses a different field name, an adapter in JinEngine
   reconciles without changing this TypeScript type.

5. **[RESOLVED 2026-07-31]** DESIGN-TWINE-VS-WIRE.md line 27 wording. Owner confirmed
   2026-07-31: twine does NOT affect wireCount or Clip-and-Grow eligibility. SCAR voxels
   have exactly two sources: wire overstay (unintentional) and jin (intentional) —
   twine and weights are never a SCAR source. DESIGN-TWINE-VS-WIRE.md patched (see
   docs/pipeline/PATCH-TWINE-SCAR-CLARIFICATION-2026-07-31.md). Open question closed.

6. **[RESOLVED 2026-07-31] TechniqueClassifier re-evaluation strategy.** Classification
   re-runs ONLY when the caretaker opens the voxel viewer — not on every care action.
   The engine caches the last TechniqueResult and invalidates the cache when the viewer
   is opened (lazy/on-demand strategy). "Re-evaluate on every relevant action" wording
   from the design doc is superseded by this owner confirmation. The `TechniqueClassifier`
   class itself remains stateless; caching lives at the call site (viewer open handler).

7. **[RESOLVED 2026-07-31] LandscapeElementType completeness.** Phase 1 union confirmed:
   `'rock' | 'moss' | 'pot'` (basic store items sold by the fictional Guild seller). Phase 2+ NFT items
   (`water_feature`, `figurine`, `ceramic`) are earned through gameplay and out of Phase 1
   scope. LandscapeElementType updated to 3-literal union. See §1.1.
