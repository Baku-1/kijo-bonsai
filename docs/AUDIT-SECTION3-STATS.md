# AUDIT — Section 3 Stats (COMBAT-METADATA-REQUIREMENTS.md)

**Auditor:** Claude (adversarial audit mode)  
**Date:** 2026-07-27  
**Scope:** §3 only — Complete Stat List, all subsections  
**Method:** Cross-reference against shared/src/index.ts (ground truth), KIJO-TECH-SPEC.md §2–6, KIJO-ENGINE-API.md StatDeriver section, GDD.md §4.2  

---

## FINDINGS WRITTEN INCREMENTALLY AS CONFIRMED

---

### After reading COMBAT-METADATA-REQUIREMENTS.md §3 — issues noted for cross-check

Flagged for verification:
- §3.5 Technique table says default technique is "Clip-and-Grow"
- §3.5 Water-and-Land described as "Root-based fighter"
- §3.5 Jin condition: "High scar/jin-landscape ratio" — conflation?
- §3.4 Wisdom Level 2 "~20% auto-block" — source?
- §3.2 Layer 1 table uses "HEARTWOOD/BARK voxels" as trunk identifier — conflates Material and Role?

---

### After reading packages/shared/src/index.ts

**StatSheet interface (ground truth):**
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
8 fields. **No `technique` field.**

**VoxelRole enum (ground truth):**
```typescript
export enum VoxelRole {
  TRUNK   = 'trunk',
  ARM     = 'arm',
  LEG     = 'leg',
  DIGIT   = 'digit',
  CANOPY  = 'canopy',
  ROOT    = 'root',
  SCAR    = 'scar',
}
```
7 values. Enum comment on SCAR: `// prune scar (reserved)` — no mention of Defense HP bonus.

**StatType (ground truth):**
```typescript
export type StatType = 'hp' | 'power' | 'endurance' | 'ki' | 'skill_point' | 'neutral';
```
6 types matching the mod-6 terrain distribution.

**spatialHash (ground truth):** Matches exactly what the doc quotes in §3.2.

---

### After reading KIJO-TECH-SPEC.md

**§6.1 derive_structural_stats confirms:**
- HP: trunk_voxels × TRUNK_HP_MULTIPLIER ✅
- Power: arm_voxels × ARM_POWER_MULTIPLIER ✅
- Endurance: leg_voxels × LEG_ENDURANCE_MULTIPLIER ✅ (NOT terrain-only)
- Ki: leaf_voxels × LEAF_KI_MULTIPLIER ✅
- SkillSlots: count_depth2_plus_branches(tree) ✅
- SkillPoints: NOT in structural stats at all ✅ (terrain only confirmed)

**§6.3 combined sheet confirms:**
- HP, Power, Endurance, Ki all = structural + terrain ✅
- SkillSlots structural only ✅
- SkillPoints terrain only ✅

**§5.2 ROOT material comment:** `ROOT = 4 // below-ground (structural: Endurance)` — but §6.1 derive_structural_stats does NOT count ROOT voxels anywhere. Endurance only comes from lower depth-1 leg branches. The §5.4 comment "Roots are mostly invisible but affect Stability/Endurance stats" is UNIMPLEMENTED in the derive function. Internal source doc inconsistency — not a doc error per se, but the COMBAT doc doesn't mention ROOT → Endurance either.

**§7.4 TechniqueClassifier:**
```
if wireCount == 0 AND pruneCount > 0:
    primary = CLIP_AND_GROW
else if wireCount > 0 AND pruneCount > 0:
    primary = BOUND_AND_CUT
else:
    primary = BOUND_AND_CUT  // default  ← EXPLICIT
```
Default is **BOUND_AND_CUT**, not Clip-and-Grow.

---

### After reading KIJO-ENGINE-API.md

**StatSheet (C++ spec):**
```cpp
struct StatSheet {
    float hp; float power; float endurance; float ki;
    uint32_t skillSlots; float skillPoints; uint32_t wisdom;
    float matchPct;
    Technique technique;    // classified from care log
};
```
C++ spec DOES include `technique`. TypeScript does NOT. Doc §3.1 correctly identifies this discrepancy. ✅

**TechniqueClassifier:**
- BOUND_AND_CUT: wire uses > 0 AND prune uses > 0 — described as "The default when both tools are used"
- CLIP_AND_GROW: prune uses > 0 AND wire uses == 0 — "zero wire use ever"
- JIN: "jin strip actions > threshold (overlay)" — NOT "scar/jin-landscape ratio"
- WATER_AND_LAND: "landscape element count > threshold (overlay — care-loop only, no combat archetype)" — explicitly **NO combat archetype**

---

### After reading GDD.md §4.2 and §3.1.1

**§4.2 Layer 1 table:** Trunk → HP, lower depth-1 → Endurance, upper depth-1 → Power, depth-2+ → Skill Slots, canopy → Ki. ✅ All match.

**§4.2 terrain bonuses:** "+0.1% HP, +0.1% Power, +0.1% Endurance, +0.1% Ki, +0.25 skill points" ✅

**§4.3 Wisdom in fighting game:** 100 days → 10%, 365 days → 35%, 500 days → 50%. Only these three values cited. No value given for 200 days.

**§3.1.1 Technique:**
- Bound-and-Cut: "default — it never triggers a notification because most players arrive there naturally"
- Water-and-Land: `"None (care-loop only)"` for combat archetype
- Jin: "jin/bark-stripping actions > threshold" — NOT "scar/landscape ratio"

---

## ISSUE REGISTER

---

### [SEVERITY: CRITICAL]

**Claim in doc §3.5:**
> "Default technique (trees with no qualifying actions): appears to be Clip-and-Grow by process of elimination."

**What source says:**
- KIJO-TECH-SPEC.md §7.4: `else: primary = BOUND_AND_CUT  // default`
- KIJO-ENGINE-API.md: "BOUND_AND_CUT: ... The default when both tools are used."
- GDD §3.1.1: "Bound-and-Cut is the default — it never triggers a notification because most players arrive there naturally."

All three sources are unambiguous. A tree with no prune actions and no wire actions defaults to **BOUND_AND_CUT**, not Clip-and-Grow. Clip-and-Grow requires `pruneCount > 0 AND wireCount == 0` — a tree with zero prunes doesn't qualify.

**Fix needed:**
Replace: "Default technique (trees with no qualifying actions): appears to be Clip-and-Grow by process of elimination."
With: "Default technique (trees with no wire AND no prune actions, or both wire AND prune actions): **Bound-and-Cut**. GDD §3.1.1 explicitly states this is the default. Clip-and-Grow is NOT the default — it requires positive prune count AND zero wire ever."

---

### [SEVERITY: MAJOR]

**Claim in doc §3.5:**
> `| Water-and-Land | High landscape/root-shaping ratio | Root-based fighter |`

**What source says:**
- GDD §3.1.1: "Water-and-Land: **None (care-loop only)**" for combat archetype. Text: "The tree can still awaken a kijo, but the landscape elements are display-only. This is the pure aesthetic/collector path — the Exhibition feature."
- KIJO-ENGINE-API.md: "WATER_AND_LAND: landscape element count > threshold (overlay — care-loop only, **no combat archetype**)."

Water-and-Land has **no combat archetype**. Calling it "Root-based fighter" is incorrect. The Kijo can still fight if Water-and-Land is the technique, but landscape elements don't modify combat stats. Describing it as "Root-based fighter" implies a combat bonus that does not exist.

**Fix needed:**
Change the Combat Archetype for Water-and-Land from "Root-based fighter" to "None (care-loop only — display, no combat stat effect)".

---

### [SEVERITY: MAJOR]

**Claim in doc §3.5:**
> `| Jin | High scar/jin-landscape ratio | Deadwood specialist: scar-based moves |`

**What source says:**
- KIJO-ENGINE-API.md: "JIN: jin strip actions > threshold (overlay — can combine with Bound-and-Cut or Clip-and-Grow)."
- GDD §3.1.1: "Jin: jin/bark-stripping actions > threshold."
- KIJO-TECH-SPEC.md §7.4: `if jinCount >= 1: overlays.push(JIN)`

The condition is **jin strip action count** (JIN_STRIP actions), not a "scar/jin-landscape ratio". The phrase "jin-landscape ratio" incorrectly conflates Jin with Water-and-Land. Scars from pruning don't count — only JIN_STRIP care actions trigger this classification. Also, the threshold per TECH-SPEC §7.4 is `>= 1`, not a "high ratio".

**Fix needed:**
Change Jin care log pattern from "High scar/jin-landscape ratio" to "jin strip actions ≥ 1 (JIN_STRIP care action type)". Remove any conflation with landscape elements.

---

### [SEVERITY: MINOR]

**Claim in doc §3.4:**
> `| 200–364 | Level 2 | Auto-blocks ~20%; faster knockdown recovery | ... |`

**What source says:**
GDD §4.3 fighting game Wisdom effects: "At 100 days, she auto-blocks 10% of ambiguous attacks. At 365 days, 35%. At 500 days, 50%." No value is given for 200 days. The "~20%" at Level 2 (200–364 days) is an interpolated estimate with no source in any document.

**Fix needed:**
Acknowledge this value is not sourced. Change "~20%" to "~20% (interpolated — not specified in sources; GDD only gives 10%/35%/50% thresholds at 100/365/500 days)". Or remove the interpolated value and mark the cell "unspecified between 10% and 35%".

---

### [SEVERITY: MINOR]

**Claim in doc §3.2, Layer 1 table:**
> `| Trunk (depth-0, HEARTWOOD/BARK voxels) | Voxel count × TRUNK_HP_MULTIPLIER | HP | ... |`

**What source says:**
HEARTWOOD and BARK are **Material** types (render), not **VoxelRole** types. The engine derives trunk HP from `VoxelRole.TRUNK` voxels, not from material names. The doc itself states in §3.6: "Material (render) and Role (combat) are orthogonal. A BARK voxel can carry ARM role. Do not conflate them."

Using "HEARTWOOD/BARK voxels" as the trunk identifier in the stat derivation table directly violates this principle stated later in the same document.

**Fix needed:**
Change column 1 entry from "Trunk (depth-0, HEARTWOOD/BARK voxels)" to "Trunk (VoxelRole.TRUNK — depth-0)". HEARTWOOD/BARK are material render types, not the identifier the engine uses for HP derivation.

---

### [SEVERITY: MINOR]

**Claim in doc §3.6:**
> `SCAR    = 'scar',     // prune scar (reserved; small Defense HP bonus in turn-based)`

**What source says:**
`packages/shared/src/index.ts` line 92: `SCAR    = 'scar',     // prune scar (reserved)`  
No mention of "small Defense HP bonus" in the shared/src comment.

The Defense HP bonus claim comes from KIJO-ENGINE-API.md PruneEngine description: "scar voxels → small structural Defense/HP" — but this is in prose documentation, not in the enum definition. The TypeScript enum comment, which is the ground truth for the codebase, says only "(reserved)".

**Fix needed:**
This is a low-risk addition (the bonus is mentioned in ENGINE-API prose), but the qualifier should be explicit about the source. Change to: `SCAR = 'scar',  // prune scar (reserved; per ENGINE-API, scar voxels yield small Defense/HP in turn-based — not yet in StatDeriver implementation)`.

---

### [SEVERITY: MINOR]

**Omission in doc §3.5:**
The Technique Classification table does not state that **Twine and Weights do NOT count as wire** for technique classification.

**What source says:**
- KIJO-ENGINE-API.md: "Twine and weights do NOT count as wire."
- GDD §3.1.1: "Twine and weights do NOT count as wire — they use natural force, consistent with the Lingnan School's rejection of metal shaping."
- KIJO-TECH-SPEC.md §7.4: `// Note: TWINE_APPLY and WEIGHT_APPLY do NOT count as wire`

This is the most counterintuitive design decision in the technique system. A caretaker using only Twine + Shears is Clip-and-Grow eligible (twine doesn't disqualify). The doc mentions this in §5.3 (Wire Count in metadata section) but omits it from §3.5 where it's most critical.

**Fix needed:**
Add to §3.5 after the Clip-and-Grow row: "Note: Twine (TWINE_APPLY) and Weights (WEIGHT_APPLY) do NOT count as wire for technique classification. A caretaker using only Twine + Shears remains Clip-and-Grow eligible."

---

## VERIFIED CORRECT ITEMS

The following claims in §3 were cross-checked against all sources and are confirmed accurate:

1. **StatSheet TypeScript interface** (§3.1) — all 8 fields listed correctly (hp, power, endurance, ki, skillSlots, skillPoints, wisdom, matchPct), no extra fields, no missing fields. ✅

2. **`technique` field discrepancy** (§3.1) — correctly identifies that C++ StatSheet includes `technique` but TypeScript `shared/src/index.ts` does not. ✅

3. **Layer 1 HP attribution** — trunk voxels × TRUNK_HP_MULTIPLIER (structural) + terrain HP% (Layer 2). ✅

4. **Layer 1 Power attribution** — upper depth-1 ARM voxels × ARM_POWER_MULTIPLIER + terrain Power% (Layer 2). ✅

5. **Layer 1 Endurance attribution** — lower depth-1 LEG voxels × LEG_ENDURANCE_MULTIPLIER + terrain Endurance% (Layer 2). The doc correctly says Endurance has BOTH structural AND terrain sources (it is NOT terrain-only). ✅

6. **Layer 1 Ki attribution** — CANOPY leaf voxels × LEAF_KI_MULTIPLIER + terrain Ki% (Layer 2). ✅

7. **Skill Slots** — COUNT of depth-2+ branches (DIGIT role), structural only, integer. ✅

8. **Skill Points** — terrain ONLY (no structural source). Derive function in TECH-SPEC §6.1 confirms SkillPoints absent from structural stats, only appears in terrain bonuses. ✅

9. **Wisdom** — age in days ONLY (wisdomFromAge). Not voxel-derived. All sources confirm. ✅

10. **Terrain base values** — 0.001 for HP/Power/Endurance/Ki, 0.25 for SkillPoint, 0.0 for Neutral. ✅

11. **Mod-6 distribution** — `stat_index = spatialHash(seed,x,y,z) mod 6`, array `[HP, Power, Endurance, Ki, SkillPoint, Neutral]`. ✅

12. **Proximity multiplier curve** — `0→3.0, <5→2.0, <15→1.5, <30→1.0, else→0.8`. Matches TECH-SPEC §3.3 and ENGINE-API exactly. ✅

13. **spatialHash quoted code** (§3.2) — byte-for-byte matches `packages/shared/src/index.ts`. ✅

14. **VoxelRole enum** (§3.6) — all 7 values correct (TRUNK, ARM, LEG, DIGIT, CANOPY, ROOT, SCAR) with correct string values. ✅

15. **Material vs Role orthogonality** (§3.6 note) — correctly stated: "Material (render) and Role (combat) are orthogonal. A BARK voxel can carry ARM role." ✅

16. **Wisdom thresholds at 100/365/500 days** — GDD values match. ✅

17. **Turn-based Wisdom effects** — (§3.4): last stance at 100d, 30% reveal at 200d, 50% reveal at 365d, change-after-seeing at 500d. All match GDD §4.4 exactly. ✅

18. **attachmentY ARM/LEG split** — one-third rule implementation quoted correctly from shared/src/index.ts. ✅

19. **Ki regenerates +5%/turn in combat** — confirmed in GDD §4.4. ✅

20. **Bonsai Styles table** (§3 via §6.3) — 8 styles with correct stat profiles matching GDD §4.2.1. ✅

21. **Species parameters table** (§6.2) — matches SPECIES_PARAMS in shared/src/index.ts exactly. ✅

22. **Clip-and-Grow requires prune ≥ 2 AND age ≥ 30 days** — consistent with GDD §3.1.1 and TECH-SPEC §7.4 R22 first-pass values (though ENGINE-API says only prune > 0; this is an unresolved internal source inconsistency, not a doc error). ✅

---

## TOTAL ISSUE COUNT

| Severity | Count |
|---|---|
| CRITICAL | 1 |
| MAJOR | 2 |
| MINOR | 4 |
| **Total** | **7** |

---

## PRIORITY ORDER FOR FIXES

1. **[CRITICAL] Default technique** — Fix immediately. The doc will cause an implementer to code the wrong fallback. The correct default is Bound-and-Cut.

2. **[MAJOR] Water-and-Land = "Root-based fighter"** — Fix immediately. This would cause a metadata consumer to expect a combat bonus that doesn't exist.

3. **[MAJOR] Jin condition = "scar/jin-landscape ratio"** — Fix before implementation. The actual trigger is `JIN_STRIP` action type, not a compound ratio.

4. **[MINOR] Twine/Weights omission from §3.5** — Fix before technique classifier is implemented.

5. **[MINOR] Trunk table entry uses Material names** — Fix for clarity (won't cause bugs but violates the doc's own Material/Role principle).

6. **[MINOR] SCAR Defense bonus not sourced in enum** — Low urgency; add source qualifier.

7. **[MINOR] Wisdom Level 2 "~20%" unsourced** — Mark as interpolated.

---

*Audit complete. No code was changed. All findings are from direct cross-reference of sources.*
