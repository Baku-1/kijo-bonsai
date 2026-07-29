# ARCHITECT SPEC: Add `defense` and `stability` to StatSheet

**Stage:** ARCHITECT (pipeline stage 1 of 5)  
**Date:** 2026-07-28  
**Author:** Architect pass — Jeremy  
**ADR:** `docs/ADR-STATSHEET-DEFENSE-STABILITY.md`  
**Status:** READY FOR IMPLEMENTER

---

## Sources Read

| File | Purpose |
|---|---|
| `packages/shared/src/index.ts` | StatSheet, StatType, VoxelRole |
| `packages/engine/src/StatTerrain.ts` | STAT_TYPES, BASE_VALUES, hash logic |
| `packages/engine/src/StatDeriver.ts` | StructuralStats, TerrainBonuses, derive() |
| `packages/engine/src/index.ts` | Package exports |
| `packages/engine/src/PruneEngine.ts` | Scar placement reality-check |
| `apps/server/src/index.ts` | StatSheet consumer check |
| `docs/ADR-STATSHEET-DEFENSE-STABILITY.md` | Decision record |
| `docs/KIJO-ENGINE-API.md` | C++ spec — PruneEngine, StatDeriver, VoxelRole |

---

## Open Question Resolution: Structural Sources for Defense and Stability

**Do SCAR or ROOT voxels contribute structurally (Layer 1) to defense or stability?**

### Decision: SCAR → Defense YES (C++ spec). ROOT → Stability NO (terrain-only).

**SCAR → structural Defense: CONFIRMED by C++ spec**

KIJO-ENGINE-API.md, PruneEngine section:
> "places scar (scar voxels → small structural Defense/HP)"

This is explicit. SCAR voxels yield a small Defense bonus per voxel. The phrase "small" is preserved in the placeholder multiplier value (`SCAR_DEFENSE_MULT = 0.10`, flagged for playtest tuning — lower than ARM/LEG at 0.50 to reflect the C++ spec's "small" qualifier).

Note: The API also mentions SCAR → HP, but that component is a pre-existing implementation gap (PruneEngine.ts does not place scar voxels; StatDeriver comments say "SCAR → no structural stat"). **Do not fix SCAR→HP in this PR.** It requires separate PruneEngine + voxelizer work.

**ROOT → structural Stability: REJECTED**

A prior architect draft incorrectly assigned ROOT → Stability by reasoning from "Sekijoju = root over rock → Extreme Stability." This was wrong. Sekijoju ("root over rock") is a penjing landscaping style — its Extreme Stability stat profile comes from terrain cluster placement (the spline for Sekijoju is positioned in stability-rich terrain zones), NOT from ROOT voxels having a structural combat contribution. Conflating the style's aesthetic origin with structural voxel role is a design error.

ROOT voxels have NO structural stat contribution. This is consistent with DIGIT (also no structural stat). ROOT and DIGIT exist for morphology and rendering; they do not earn structural combat stats.

**Stability is terrain-only at Layer 1.** It accumulates from the terrain system (hash % 8 bucket distribution) exactly like skillPoints does — no structural source, terrain source only.

**Summary:**

| VoxelRole | Structural stat | Layer |
|---|---|---|
| TRUNK | HP | Layer 1 (existing) |
| ARM | Power | Layer 1 (existing) |
| LEG | Endurance | Layer 1 (existing) |
| CANOPY | Ki | Layer 1 (existing) |
| SCAR | Defense (small) | Layer 1 **NEW** |
| ROOT | — | (none — terrain only) |
| DIGIT | — | (none) |

---

## Consumer Audit

Grep result for `StatSheet|StatType` across all `*.ts` files (excluding `node_modules`):

| File | Usage | Change needed? |
|---|---|---|
| `packages/shared/src/index.ts` | Defines both | **YES** |
| `packages/engine/src/StatTerrain.ts` | Imports StatType; defines STAT_TYPES, BASE_VALUES | **YES** |
| `packages/engine/src/StatDeriver.ts` | Imports StatSheet; defines StructuralStats, TerrainBonuses | **YES** |
| `packages/engine/src/index.ts` | Re-exports StructuralStats, TerrainBonuses by type | No — re-exports are structural, new fields flow automatically |
| `apps/server/src/index.ts` | Imports `createTree`, `tick` only — no StatSheet/StatType | No |

No other TypeScript files in the monorepo import StatSheet or StatType.

---

## Hash Modulo Change — Pre-Launch Invalidation Note

Changing `hash % 6` → `hash % 8` shifts the stat terrain distribution for every seed. Trees grown before this change will produce different stat terrain after. **This is explicitly acceptable pre-launch** (confirmed in ADR). It must not happen post-launch. The Implementer must update both the code and the inline comment that documents the bucket count.

---

## File-by-File Change Spec

### FILE 1: `packages/shared/src/index.ts`

#### StatType union — line 62

**Before:**
```typescript
export type StatType = 'hp' | 'power' | 'endurance' | 'ki' | 'skill_point' | 'neutral';
```

**After:**
```typescript
export type StatType = 'hp' | 'power' | 'endurance' | 'ki' | 'skill_point' | 'defense' | 'stability' | 'neutral';
```

`'neutral'` remains last. `'defense'` and `'stability'` are inserted before it. Order within the union type is convention only; the runtime behaviour is driven by STAT_TYPES array index in StatTerrain.ts.

#### StatSheet interface — lines 65-74

**Before:**
```typescript
export interface StatSheet {
  hp: number;
  power: number;
  endurance: number;
  ki: number;
  skillSlots: number;
  skillPoints: number;
  wisdom: number;
  matchPct: number;
}
```

**After:**
```typescript
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
  stability: number;  // knockdown/knockback reduction — Layer 1: ROOT voxels × ROOT_STABILITY_MULT; Layer 2: terrain
}
```

`defense` and `stability` are appended at the end. Do not reorder existing fields.

---

### FILE 2: `packages/engine/src/StatTerrain.ts`

#### STAT_TYPES array — lines 85-87

**Before:**
```typescript
// R2 decision (2026-07-16): NEUTRAL is naturally ~16.7 % (1/6 of buckets).
// Kept as-is for first pass.  Flag for playtest tuning.
// ---------------------------------------------------------------------------

const STAT_TYPES: StatType[] = [
  'hp', 'power', 'endurance', 'ki', 'skill_point', 'neutral',
];
```

**After:**
```typescript
// R2 decision (2026-07-16): NEUTRAL is naturally ~12.5 % (1/8 of buckets).
// defense and stability added 2026-07-28 (ADR-STATSHEET-DEFENSE-STABILITY).
// Flag for playtest tuning.
// ---------------------------------------------------------------------------

const STAT_TYPES: StatType[] = [
  'hp', 'power', 'endurance', 'ki', 'skill_point', 'defense', 'stability', 'neutral',
];
```

`'neutral'` remains last (index 7). `'defense'` is at index 5, `'stability'` at index 6. Array length goes from 6 to 8.

#### BASE_VALUES — lines 90-97

**Before:**
```typescript
const BASE_VALUES: Record<StatType, number> = {
  hp:          0.001,
  power:       0.001,
  endurance:   0.001,
  ki:          0.001,
  skill_point: 0.25,
  neutral:     0.0,
};
```

**After:**
```typescript
const BASE_VALUES: Record<StatType, number> = {
  hp:          0.001,
  power:       0.001,
  endurance:   0.001,
  ki:          0.001,
  skill_point: 0.25,
  defense:     0.001,   // FLAG FOR PLAYTEST TUNING
  stability:   0.001,   // FLAG FOR PLAYTEST TUNING
  neutral:     0.0,
};
```

`neutral: 0.0` remains last. Existing values are unchanged.

#### Hash modulo — line 155 (getStatAt method body) and line 147 (comment)

**Before** (comment at line 147):
```
  //   2. bucket = h % 6 → StatType
```
**After:**
```
  //   2. bucket = h % 8 → StatType
```

**Before** (line 155):
```typescript
    const bucket = hash % 6;
```
**After:**
```typescript
    const bucket = hash % 8;
```

These are the only two occurrences of `% 6` in the file. Change both. No other numeric literals in this file need to change.

---

### FILE 3: `packages/engine/src/StatDeriver.ts`

#### New multiplier constants — after line 36 (`KI_MULT = 3.00`)

Add the following two constants immediately after the existing four multiplier constants, before the comment block starting `// Internal result types`:

```typescript
const SCAR_DEFENSE_MULT = 0.10;  // FLAG FOR PLAYTEST TUNING — "small Defense bonus" per C++ spec (KIJO-ENGINE-API PruneEngine §)
// NOTE: Stability has no structural source. ROOT voxels do not contribute to stability.
// Stability is terrain-only (same pattern as skillPoints). No ROOT_STABILITY_MULT constant.
```

#### StructuralStats interface — lines 42-48

**Before:**
```typescript
export interface StructuralStats {
  hp: number;
  power: number;
  endurance: number;
  ki: number;
  skillSlots: number;
}
```

**After:**
```typescript
export interface StructuralStats {
  hp: number;
  power: number;
  endurance: number;
  ki: number;
  skillSlots: number;
  defense: number;    // SCAR voxels × SCAR_DEFENSE_MULT
  // NOTE: stability is NOT in StructuralStats — it is terrain-only (no Layer 1 source).
  // Same pattern as skillPoints, which is also absent from StructuralStats.
}
```

#### TerrainBonuses interface — lines 50-56

**Before:**
```typescript
export interface TerrainBonuses {
  hp: number;
  power: number;
  endurance: number;
  ki: number;
  skillPoints: number;
}
```

**After:**
```typescript
export interface TerrainBonuses {
  hp: number;
  power: number;
  endurance: number;
  ki: number;
  skillPoints: number;
  defense: number;
  stability: number;
}
```

#### deriveStructural — full method update (lines 81-108)

**Update the block comment** at line 71-75 (the comment documenting what DIGIT/ROOT/SCAR do):

**Before:**
```
  //   DIGIT, ROOT, SCAR → no structural stat
```
**After:**
```
  //   DIGIT, ROOT → no structural stat
  //   SCAR  → Defense (small bonus per C++ spec: "scar voxels → small structural Defense/HP")
  //   NOTE: stability is terrain-only — ROOT voxels do not contribute structurally
```

**Add one counter variable** immediately after `let canopyVoxels = 0;` (line 85):

```typescript
    let scarVoxels = 0;
```

**Extend the switch statement** inside the `voxels.forEach` callback — add one new case after `case VoxelRole.CANOPY`:

```typescript
        case VoxelRole.SCAR:   scarVoxels++;   break;
```

ROOT and DIGIT continue to have no structural stat contribution. The existing comment `// DIGIT, ROOT, SCAR: no structural stat contribution` should be updated to `// DIGIT, ROOT: no structural stat contribution (SCAR now handled above)`.

**Extend the return object** to include the two new fields:

**Before:**
```typescript
    return {
      hp:        round4(trunkVoxels  * HP_MULT),
      power:     round4(armVoxels    * POWER_MULT),
      endurance: round4(legVoxels    * ENDURANCE_MULT),
      ki:        round4(canopyVoxels * KI_MULT),
      skillSlots,
    };
```

**After:**
```typescript
    return {
      hp:        round4(trunkVoxels  * HP_MULT),
      power:     round4(armVoxels    * POWER_MULT),
      endurance: round4(legVoxels    * ENDURANCE_MULT),
      ki:        round4(canopyVoxels * KI_MULT),
      skillSlots,
      defense:   round4(scarVoxels   * SCAR_DEFENSE_MULT),
      // stability is NOT returned from deriveStructural — terrain-only stat (no Layer 1 source)
    };
```

#### deriveTerrain — accumulator and switch update (lines 119-141)

**Extend the accumulator declaration** at line 120:

**Before:**
```typescript
    let hp = 0, power = 0, endurance = 0, ki = 0, skillPoints = 0;
```

**After:**
```typescript
    let hp = 0, power = 0, endurance = 0, ki = 0, skillPoints = 0, defense = 0, stability = 0;
```

**Extend the switch** inside the `voxels.forEach` callback — add two new cases after `case 'skill_point'`:

```typescript
        case 'defense':   defense   += stat.value; break;
        case 'stability': stability += stat.value; break;
```

**Extend the return object**:

**Before:**
```typescript
    return {
      hp:          round4(hp),
      power:       round4(power),
      endurance:   round4(endurance),
      ki:          round4(ki),
      skillPoints: round4(skillPoints),
    };
```

**After:**
```typescript
    return {
      hp:          round4(hp),
      power:       round4(power),
      endurance:   round4(endurance),
      ki:          round4(ki),
      skillPoints: round4(skillPoints),
      defense:     round4(defense),
      stability:   round4(stability),
    };
```

#### derive — return object update (lines 181-190)

**Before:**
```typescript
    return {
      hp:          round4(structural.hp          + terrain.hp),
      power:       round4(structural.power       + terrain.power),
      endurance:   round4(structural.endurance   + terrain.endurance),
      ki:          round4(structural.ki          + terrain.ki),
      skillSlots:  structural.skillSlots,
      skillPoints: round4(terrain.skillPoints),
      wisdom,
      matchPct,
    };
```

**After:**
```typescript
    return {
      hp:          round4(structural.hp          + terrain.hp),
      power:       round4(structural.power       + terrain.power),
      endurance:   round4(structural.endurance   + terrain.endurance),
      ki:          round4(structural.ki          + terrain.ki),
      skillSlots:  structural.skillSlots,
      skillPoints: round4(terrain.skillPoints),
      wisdom,
      matchPct,
      defense:     round4(structural.defense + terrain.defense),
      stability:   round4(terrain.stability),   // terrain-only — no structural source (same pattern as skillPoints)
    };
```

`defense` and `stability` are appended last. Do not reorder existing fields.

---

## DO NOT CHANGE List

The Implementer must leave the following unchanged:

| Item | Reason |
|---|---|
| `packages/engine/src/index.ts` | Re-exports StructuralStats and TerrainBonuses by type; new fields flow automatically |
| `apps/server/src/index.ts` | Does not import StatSheet or StatType |
| `packages/engine/src/PruneEngine.ts` | Does not reference StatSheet or StatType; SCAR→HP structural gap is a separate issue |
| `spatialHash()` in shared/src/index.ts | Pure hash function; unchanged by this spec |
| `STYLE_SPLINES` / `STYLE_SPLINES` array in StatTerrain.ts | Style spline alignment to new stat clusters is future work (ADR §Style Spline Alignment) |
| `IDEAL_REGION_DISTANCE` constant | Unchanged |
| `proximityCurve` static method | Unchanged |
| `calculateMatch` static method | Unchanged |
| `chokkanSpline()` and `splineForSeed()` | Unchanged |
| `VoxelRole` enum in shared/src/index.ts | ROOT and SCAR already exist; do not add or remove roles |
| `HP_MULT`, `POWER_MULT`, `ENDURANCE_MULT`, `KI_MULT` constants | Existing multipliers unchanged |
| All existing StatType union members | `'hp' | 'power' | 'endurance' | 'ki' | 'skill_point' | 'neutral'` — preserve exactly |

---

## Pre-existing Gap — Do NOT Fix in This PR

The C++ spec (KIJO-ENGINE-API.md, PruneEngine section) also says: "scar voxels → small structural Defense/**HP**". The HP component of SCAR is not implemented in the current TypeScript (PruneEngine.ts only sets `pruned = true` and does not place scar voxels; StatDeriver.ts comment previously said "SCAR → no structural stat"). The SCAR→HP gap requires PruneEngine + voxelizer work outside this spec's scope. Log it as a separate issue after this PR lands.

---

## Summary of All Changes

| File | What changes |
|---|---|
| `packages/shared/src/index.ts` | StatType: 6 → 8 members. StatSheet: 8 → 10 fields. |
| `packages/engine/src/StatTerrain.ts` | STAT_TYPES: 6 → 8 entries. BASE_VALUES: 2 new keys. `hash % 6` → `hash % 8` (×2 occurrences: comment + code). |
| `packages/engine/src/StatDeriver.ts` | 2 new module-level constants. StructuralStats: +defense, +stability. TerrainBonuses: +defense, +stability. deriveStructural: +2 counters, +2 switch cases, +2 return fields. deriveTerrain: +2 accumulators, +2 switch cases, +2 return fields. derive: +2 return fields. |
| All other files | **No changes.** |
