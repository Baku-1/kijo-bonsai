# Implementation vs Docs Comparison

**Date:** 2026-07-27  
**Sources read:** packages/engine/src/StatDeriver.ts, StatTerrain.ts, index.ts; packages/shared/src/index.ts  
**Purpose:** Compare actual TypeScript implementation against GDD, KIJO-ENGINE-API, and COMBAT-METADATA-REQUIREMENTS.md

---

## What Matches Correctly

| Claim | Source | Status |
|---|---|---|
| StatSheet has exactly 8 fields: hp, power, endurance, ki, skillSlots, skillPoints, wisdom, matchPct | shared/src/index.ts | ✅ CONFIRMED |
| No `technique` field in TypeScript StatSheet | shared/src/index.ts | ✅ CONFIRMED |
| VoxelRole: 7 values (TRUNK, ARM, LEG, DIGIT, CANOPY, ROOT, SCAR) | shared/src/index.ts | ✅ CONFIRMED |
| Layer 1 mapping: TRUNK→HP, ARM→Power, LEG→Endurance, CANOPY→Ki | StatDeriver.ts | ✅ CONFIRMED |
| Multipliers R14: HP=0.35, POWER=0.50, ENDURANCE=0.50, KI=3.00 | StatDeriver.ts | ✅ CONFIRMED |
| Endurance has BOTH structural (LEG×0.50) AND terrain sources | StatDeriver.ts | ✅ CONFIRMED |
| skillSlots = non-pruned depth-2+ branches (structural only) | StatDeriver.ts | ✅ CONFIRMED |
| skillPoints = terrain only (no structural source) | StatDeriver.ts | ✅ CONFIRMED |
| wisdom = wisdomFromAge(ageDays) — age in real days only, no voxel source | StatDeriver.ts | ✅ CONFIRMED |
| Wisdom tiers: <100→0, 100-199→1, 200-364→2, 365-499→3, ≥500→4 | StatDeriver.ts | ✅ CONFIRMED |
| matchPct = StatTerrain.calculateMatch(voxels, seed) | StatDeriver.ts | ✅ CONFIRMED |
| Terrain: spatialHash → 6-bucket StatType distribution | StatTerrain.ts | ✅ CONFIRMED |
| Terrain BASE_VALUES: hp/power/endurance/ki=0.001, skill_point=0.25, neutral=0.0 | StatTerrain.ts | ✅ CONFIRMED |
| CareAction: 5 types (water, rotate, prune, fertilize, wire) | shared/src/index.ts | ✅ CONFIRMED |
| Material vs Role are orthogonal (DECISIONS.md note preserved in code) | shared/src/index.ts | ✅ CONFIRMED |

---

## Critical Gaps — Implementation Missing vs Docs

### GAP-1: TechniqueClassifier Does Not Exist (BLOCKER for Technique NFT trait)

**Severity: CRITICAL**

grep for "technique" or "Technique" across ALL TypeScript source files: **zero results**.

- Not in `packages/shared/src/index.ts`
- Not in `packages/engine/src/index.ts`
- Not exported anywhere
- Not stubbed anywhere

The KIJO-ENGINE-API.md C++ spec describes `TechniqueClassifier` with `classify(care_log) → TechniqueResult`. TypeScript has no equivalent.

**Consequence:** Phase 1 NFTs cannot emit a `Technique` trait. The metadata schema in COMBAT-METADATA-REQUIREMENTS.md defines this trait, but there is no code to produce it.

**Related:** This was flagged as OQ-4 in NFT-METADATA-IMAGE-ARCH.md, but the actual situation is worse than OQ-4 implies — OQ-4 asked "is it exported?" The answer is it doesn't exist at all, not just missing from the export list.

---

### GAP-2: CareAction Missing jin, twine, weight, landscape (Blocks Technique Classification Input)

**Severity: CRITICAL**

`shared/src/index.ts` CareAction union has only 5 types:
```typescript
type CareAction =
  | { type: 'water' }
  | { type: 'rotate' }
  | { type: 'prune'; branchId: number }
  | { type: 'fertilize' }
  | { type: 'wire'; branchId: number; angleDelta: number; oldAngle: number; newAngle: number; wireCost: number }
```

jin, twine, weight, and landscape are defined in the C++ spec but absent from TypeScript. Even if TechniqueClassifier were built, the CareLog inputs it needs don't exist:

- Clip-and-Grow requires `wireCount == 0 ever` — possible to derive from care log absence
- Jin requires `jinCount >= 1` — **no jin CareAction exists to count**
- Water-and-Land requires `landscapeCount >= 3` — **no landscape CareAction exists to count**

To implement technique classification, BOTH TechniqueClassifier AND 4 new CareAction types must be added.

---

### GAP-3: matchPct Is Only Correct for Chokkan Trees

**Severity: MAJOR**

StatTerrain.ts `calculateMatch()` uses `splineForSeed(_seed)` which currently returns **Chokkan for all seeds**:

```typescript
const STYLE_SPLINES: StyleSpline[] = [
  chokkanSpline(),  // 0 — Chokkan (formal upright)
  // TODO: 1 — Moyogi
  // TODO: 2 — Shakan
  // TODO: 3 — Kengai
  // TODO: 4 — Fukinagashi
  // TODO: 5 — Bunjin
  // TODO: 6 — Hokidachi
  // TODO: 7 — Sekijoju
];

function splineForSeed(_seed: number): StyleSpline {
  // const styleIndex = seed % 8;  ← future
  return STYLE_SPLINES[0]; // Clamp: Chokkan only
}
```

Every minted tree gets matchPct calculated against Chokkan's spline regardless of its actual style. Trees with style index 1-7 (Moyogi, Shakan, Kengai, etc.) get incorrect matchPct values.

**Consequence:** matchPct on Phase 1 NFTs will be wrong for 7/8 of trees. This is a known temporary state (comments say "remove when live") but it must be resolved before matchPct is meaningful as an NFT trait.

---

### GAP-4: C++ ENGINE-API StatSheet Has `technique` Field, TypeScript Does Not

**Severity: MINOR (documentation consistency)**

KIJO-ENGINE-API.md shows:
```
struct StatSheet {
  hp, power, endurance, ki, skillSlots, skillPoints, wisdom, matchPct, technique
}
```

TypeScript `shared/src/index.ts` StatSheet has 8 fields — no `technique`.

This is a **spec drift** issue. The two specs describe different StatSheet shapes. COMBAT-METADATA-REQUIREMENTS.md correctly reflects TypeScript (no technique field), but any implementer reading the C++ spec and TypeScript types simultaneously will be confused.

**Fix needed:** Update KIJO-ENGINE-API.md to either remove `technique` from StatSheet or add a note clarifying it is C++-only and not in the TypeScript interface.

---

## Terrain Proximity Curve (for reference)

Implemented in StatTerrain.ts (R6 decision 2026-07-16, flagged for playtest tuning):

```
distance === 0 → multiplier 3.0
distance  < 5  → multiplier 2.0
distance  < 15 → multiplier 1.5
distance  < 30 → multiplier 1.0
else           → multiplier 0.8
```

Base values × proximity multiplier = terrain stat contribution per voxel.

---

## Summary

| Item | Status |
|---|---|
| Stats math (Layer 1 + Layer 2) | ✅ Implemented and correct |
| Terrain/matchPct system | ⚠️ Implemented but Chokkan-only (7 styles TODO) |
| Wisdom tiers | ✅ Implemented and correct |
| Wire engine | ✅ Implemented (WireEngine.ts exported) |
| Prune engine | ✅ Implemented (PruneEngine.ts exported) |
| TechniqueClassifier | ❌ Does not exist in TypeScript |
| jin/twine/weight/landscape CareActions | ❌ Not in TypeScript CareAction union |
| `technique` field in TypeScript StatSheet | ❌ Absent (C++ spec has it; TypeScript does not) |

**The stats foundation is solid. Technique classification is entirely unbuilt.**
