# ADR: Add `defense` and `stability` to StatSheet

**Date:** 2026-07-28  
**Status:** DECIDED — pending implementation  
**Decision by:** Jeremy  
**Context:** GDD §4.2.1 bonsai style stat profiles reference Defense and Stability as distinct combat stats. These were omitted from the TypeScript StatSheet due to compaction in a prior session. Discovered via adversarial audit + implementation comparison.

---

## Decision

Add two new fields to `StatSheet` in `packages/shared/src/index.ts`:

```typescript
interface StatSheet {
  hp: number;
  power: number;
  endurance: number;
  ki: number;
  skillSlots: number;
  skillPoints: number;
  wisdom: number;
  matchPct: number;
  defense: number;    // NEW — damage reduction
  stability: number;  // NEW — knockdown/knockback reduction
}
```

StatSheet grows from 8 fields to 10.

---

## Definitions (confirmed by Jeremy, 2026-07-28)

- **defense** — damage reduction in combat. Not synonymous with Endurance. Distinct stat.
- **stability** — knockdown/knockback reduction. Not synonymous with Endurance or HP. Distinct stat.

---

## Why They Cannot Be Derived from Endurance

The GDD §4.2.1 bonsai style profiles treat Defense and Stability independently:

| Style | Defense | Stability |
|---|---|---|
| Shakan | — | moderate |
| Fukinagashi | high | high |
| Hokidachi | high | — |
| Sekijoju | — | extreme |

A style can have high Defense and low Stability (Hokidachi), or high Stability and low Defense (Sekijoju/Shakan). Therefore they cannot both derive from a single Endurance field — they are independent dimensions.

---

## Impact on StatType and StatTerrain

`StatType` in `shared/src/index.ts` must be extended:

```typescript
// Current:
export type StatType = 'hp' | 'power' | 'endurance' | 'ki' | 'skill_point' | 'neutral';

// After:
export type StatType = 'hp' | 'power' | 'endurance' | 'ki' | 'skill_point' | 'defense' | 'stability' | 'neutral';
```

`STAT_TYPES` array in `StatTerrain.ts` must be updated from 6 buckets to 8:

```typescript
// Current (hash % 6):
const STAT_TYPES: StatType[] = ['hp', 'power', 'endurance', 'ki', 'skill_point', 'neutral'];

// After (hash % 8):
const STAT_TYPES: StatType[] = ['hp', 'power', 'endurance', 'ki', 'skill_point', 'defense', 'stability', 'neutral'];
```

**NOTE:** Changing `hash % 6` to `hash % 8` changes stat terrain distribution for all existing seeds. Any trees grown before this change will have different stat terrain after. This is acceptable in Phase 1 (pre-launch) but must not happen post-launch.

---

## Impact on StatDeriver

`StatDeriver.ts` must:
1. Add `defense` and `stability` to `StructuralStats` and `TerrainBonuses` interfaces
2. Accumulate `defense` and `stability` from terrain (same loop as other terrain stats)
3. Determine if defense/stability have a structural (Layer 1) source or are terrain-only

**Resolved by architect pass (2026-07-28):**
- SCAR voxels → Defense (confirmed by KIJO-ENGINE-API C++ spec: "scar voxels → small structural Defense/HP")
- ROOT voxels → NO structural contribution. Stability is terrain-only.
  - REJECTED reasoning: "root over rock (Sekijoju) → ROOT→Stability" is wrong. Sekijoju's Extreme Stability comes from terrain cluster placement (spline positioning), not from ROOT voxels having structural combat meaning. "Root over rock" is a penjing landscaping style — it does not imply ROOT voxels contribute defensively at Layer 1.
- Stability follows the same pattern as skillPoints: terrain-only, no StructuralStats entry.

---

## Impact on BASE_VALUES

`BASE_VALUES` in `StatTerrain.ts` needs entries for the two new types:

```typescript
const BASE_VALUES: Record<StatType, number> = {
  hp:          0.001,
  power:       0.001,
  endurance:   0.001,
  ki:          0.001,
  skill_point: 0.25,
  defense:     0.001,   // NEW — tuning TBD
  stability:   0.001,   // NEW — tuning TBD
  neutral:     0.0,
};
```

Base values for defense and stability are placeholders — flag for playtest tuning (same pattern as other multipliers).

---

## Style Spline Alignment

Once defense and stability are StatType entries, the 7 bonsai style splines must be designed to cluster terrain bonuses appropriately:

| Style | Primary stat clusters | Source |
|---|---|---|
| Chokkan | balanced (all stats) | CANONICAL-STYLES.md |
| Moyogi | ki | CANONICAL-STYLES.md |
| Shakan | power, stability | CANONICAL-STYLES.md |
| Kengai | skill_point | CANONICAL-STYLES.md (cascade → digit voxels → ability slots) |
| Fukinagashi | defense, stability | CANONICAL-STYLES.md |
| Bunjin | ki, skill_point | CANONICAL-STYLES.md |
| Hokidachi | hp, defense | CANONICAL-STYLES.md |

**NOTE: Sekijoju removed.** Sekijoju ("Root Over Rock") is NEVER part of the design. GDD §4.2.1 was wrong to include it. See CANONICAL-STYLES.md (confirmed authoritative 2026-07-28). Any implementer following a prior draft of this table that listed 8 styles must use only 7. `seed % 7`, not `seed % 8`.

---

## Files Requiring Changes

1. `packages/shared/src/index.ts` — StatSheet interface, StatType union
2. `packages/engine/src/StatTerrain.ts` — STAT_TYPES, BASE_VALUES, hash modulo
3. `packages/engine/src/StatDeriver.ts` — StructuralStats, TerrainBonuses, derive() output
4. Any consumer of StatSheet (NFT metadata pipeline, combat system, frontend display)

---

## What to Update in Docs After Implementation

- `COMBAT-METADATA-REQUIREMENTS.md` §3 — stat list and layer attribution
- `KIJO-ENGINE-API.md` — StatSheet definition
- `IMPL-VS-DOCS-COMPARISON.md` — update gap list
