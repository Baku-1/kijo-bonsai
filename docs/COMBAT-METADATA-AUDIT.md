# Adversarial Audit — COMBAT-METADATA-REQUIREMENTS.md

**Date:** 2026-07-27  
**Auditor:** Adversarial audit pass  
**Target:** `kijo/kijo-bonsai/docs/COMBAT-METADATA-REQUIREMENTS.md`  
**Sources cross-checked:** GDD.md, KIJO-ENGINE-API.md, KIJO-TECH-SPEC.md, NFT-METADATA-IMAGE-ARCH.md, KIJONSAI-CONTRACT-ARCH.md, packages/shared/src/index.ts  
**Verdict: NEEDS REVISION (3 CRITICAL, 5 MAJOR, 8 MINOR)**

---

## CRITICAL Issues

---

```
[SEVERITY: CRITICAL]
Location: §3.5 — Technique Classification table, "Combat Archetype" column (all four rows)
Issue: Every combat archetype in the table is wrong. The doc fills the "Combat Archetype"
       column with descriptions of the CARE PATTERN, not the fighting style the GDD defines.
Evidence: GDD §3.1.1 specifies:
  - Bound-and-Cut → "Balanced — Moderate stats across the board, no exploitable weakness."
  - Clip-and-Grow → "High-Crit — Low sustained damage but devastating critical hits."
  - Jin            → "Defensive — High Defense and Endurance. Fights by absorbing punishment."
  - Water-and-Land → "None (care-loop only)"
  The doc instead uses care-pattern descriptions in the archetype column.
Fix: Replace archetype column with GDD §3.1.1 values:
  Bound-and-Cut=Balanced, Clip-and-Grow=High-Crit, Jin=Defensive, Water-and-Land=None.
```

---

```
[SEVERITY: CRITICAL]
Location: §3.5 — Water-and-Land row
Issue: The doc assigns Water-and-Land a combat archetype ("Root-based fighter") that every
       source doc explicitly says does not exist. This will cause implementers to wire
       Water-and-Land into the combat stat and move system incorrectly.
Evidence: GDD §3.1.1: "Water-and-Land Landscape | None (care-loop only) | The tree can
          still awaken a kijo, but the landscape elements are display-only. This is the pure
          aesthetic/collector path — the Exhibition feature."
          KIJO-ENGINE-API.md TechniqueClassifier: "WATER_AND_LAND: overlay — care-loop only,
          no combat archetype."
Fix: Change Water-and-Land archetype to "None — care-loop only." Add explicit note that
     landscape elements are display-only and produce no combat stat or move.
```

---

```
[SEVERITY: CRITICAL]
Location: §10.1 — Stat renaming table: "Tempo → Ki (energy resource)"
Issue: v0.1 "Tempo" is the species-based combat RESOLUTION ORDER (Tropical first, Hardwood
       last). v0.2 "Ki" is the leaf-voxel ENERGY POOL for special moves. These are entirely
       different game concepts. Mapping Tempo → Ki will mislead any implementer who reads
       this table.
Evidence: GDD §4.4: "Resolution order — determined by Tempo (species class). Tropicals
          resolve first, Evergreens second, Hardwoods last." — no energy pool meaning.
          StatSheet in shared/src/index.ts: ki is sourced from LEAF_KI_MULTIPLIER × leaf
          voxel count; used as energy pool regenerating +5%/turn. Ki is a new v0.2 concept
          with no v0.1 predecessor.
Fix: Remove "Tempo → Ki" from renaming table. Add separate entries:
     "Tempo (v0.1) → became species class combat-order property (SpeciesClass enum, not a
     StatSheet field). Ki is NEW in v0.2 — leaf-voxel energy pool, no v0.1 equivalent."
```

---

## MAJOR Issues

---

```
[SEVERITY: MAJOR]
Location: §3.4 — Wisdom threshold table, "200–364 | Level 2 | Auto-blocks ~20%"
Issue: The ~20% auto-block value for the 200–364 day bracket is invented. GDD only specifies
       three data points: 100 days=10%, 365 days=35%, 500 days=50%. No intermediate value
       is defined.
Evidence: GDD §4.3: "At 100 days, she auto-blocks 10% of ambiguous attacks. At 365 days,
          35%. At 500 days, 50%." — three points only.
Fix: Mark 200–364 row as "Intermediate (rate TBD — GDD defines only 10%/35%/50%)."
     Remove the specific ~20% value.
```

---

```
[SEVERITY: MAJOR]
Location: §3.5 — Technique table structure; §10.3 note on overlays
Issue: The table presents all four techniques as parallel primary archetypes. Jin and
       Water-and-Land are OVERLAY techniques — they combine with primaries, they are not
       primary archetypes. A reader of §3.5 alone cannot know Jin can combine with
       Bound-and-Cut, or that Water-and-Land is additive.
Evidence: KIJO-ENGINE-API.md: "Jin is an overlay — can combine with Bound-and-Cut or
          Clip-and-Grow." KIJO-TECH-SPEC §7.4 shows overlays as a separate list.
Fix: Split the table into PRIMARY TECHNIQUES (Bound-and-Cut, Clip-and-Grow) and OVERLAY
     TECHNIQUES (Jin, Water-and-Land). Note overlays combine with primaries.
```

---

```
[SEVERITY: MAJOR]
Location: §10.3 — "wire / twine / weight / jin / landscape as care action types"
Issue: packages/shared/src/index.ts (declared ground truth) defines only FIVE care action
       types: water, rotate, prune, fertilize, wire. Twine, weight, jin, and landscape exist
       in the C++ API spec but are NOT in the TypeScript implementation. The doc treats both
       as equivalent when they are not.
Evidence: shared/src/index.ts CareAction union: only water | rotate | prune | fertilize | wire.
          Twine, weight, jin, landscape are absent from TypeScript entirely.
Fix: Add paragraph: "twine, weight, jin, and landscape are in the C++ API spec but NOT in
     packages/shared/src/index.ts. Technique classification and CareLogEntry replay must
     use only the 5 TypeScript-implemented types."
```

---

```
[SEVERITY: MAJOR]
Location: §1.1 — Turn-Based model damage formula ("Defense%") and Root stance ("Stability")
Issue: The damage formula references "Defender's Defense%" and Root heals "HP from Stability."
       Neither "Defense" nor "Stability" is a field in StatSheet. The doc presents these as
       real combat inputs without flagging that they are undefined in the type system.
Evidence: StatSheet (shared/src/index.ts): hp, power, endurance, ki, skillSlots, skillPoints,
          wisdom, matchPct — no Defense, no Stability field.
Fix: Add note after formula: "NOTE: 'Defense%' and 'Stability' referenced here are NOT in
     canonical StatSheet. If turn-based model is implemented, these must be derived from
     existing stats (e.g., Defense% = f(Endurance)) or added as new fields. Open design gap."
```

---

```
[SEVERITY: MAJOR]
Location: §6.3 — Bonsai style stat profiles (Fukinagashi, Hokidachi rows)
Issue: Doc uses "Defense" as a stat in style profiles ("High Endurance + high Defense",
       "High HP + high Defense"). Defense is not a StatSheet field. Also translates GDD's
       "Stability" to "Endurance" without attribution — Stability and Endurance are not
       confirmed synonyms (Stability = Root healing; Endurance = stagger resistance).
Evidence: GDD §4.2.1: "Windswept | High Stability + high Defense" and "Broom | High HP +
          high Defense." StatSheet has no Defense or Stability fields.
Fix: Replace "Defense" with "[Defense — undefined in StatSheet; may map to Endurance;
     TBD]". Flag Stability→Endurance translation as an assumption needing Jeremy's
     confirmation.
```

---

## MINOR Issues

---

```
[SEVERITY: MINOR]
Location: §3.6 — VoxelRole SCAR comment: "(small Defense HP bonus in turn-based)"
Issue: shared/src/index.ts says only "prune scar (reserved)". The "in turn-based" qualifier
       is unsupported — source docs describe the scar bonus without model restriction.
Fix: Rewrite as: "// prune scar (reserved; small Defense bonus per KIJO-ENGINE-API — model
     applicability TBD)"
```

---

```
[SEVERITY: MINOR]
Location: §3.2 — Layer 1 table: "Trunk (depth-0, HEARTWOOD/BARK voxels)"
Issue: HEARTWOOD and BARK are Material types (render-only), not VoxelRole designations.
       The doc correctly states in §3.6 that material and role are orthogonal, but then uses
       material names in the structural stat table.
Fix: Change to "Trunk (VoxelRole.TRUNK voxels)" to maintain the material/role distinction.
```

---

```
[SEVERITY: MINOR]
Location: §3.5 — Water-and-Land classification rule: "High landscape/root-shaping ratio"
Issue: The actual rule is an absolute COUNT threshold (>= 3), not a ratio. There is no
       "root-shaping" in Water-and-Land classification.
Evidence: KIJO-TECH-SPEC §7.4: "if landscapeCount >= 3: overlays.push(WATER_AND_LAND)"
Fix: Change to "landscape element count >= 3 (absolute threshold, not ratio)."
```

---

```
[SEVERITY: MINOR]
Location: §10.1 — Old stat names; §7.4 GDD Economy section
Issue: GDD v0.2 §7.4 (Economy section) still contains v0.1 stat names "Vitality" and
       "Specialization" as remnants. The doc only mentions Phase 2 roadmap as having old
       names; it misses this instance in the v0.2 GDD itself.
Fix: Add note in §10.1: "GDD v0.2 §7.4 (Economy) also contains remnant v0.1 names.
     Vitality = HP, Specialization = Skill Points in that context."
```

---

```
[SEVERITY: MINOR]
Location: §8.3 — "false: tree age < 60 days. Kijo cannot be awakened."
Issue: has_spirit=false doesn't exclusively mean age < 60 days. A tree >= 60 days where the
       player has not performed the awakening action is also has_spirit=false.
Fix: Change to: "false: either (a) age < 60 days — awakening not yet unlocked, OR (b)
     age >= 60 days but player has not yet performed the awakening action."
```

---

```
[SEVERITY: MINOR]
Location: §3.4 — Wisdom effects table structure
Issue: Table implies tier effects are exclusive per bracket (stop getting Level 1 at Level 2).
       GDD uses "+" phrasing implying effects stack/accumulate.
Evidence: GDD §4.4: "At 100+ days... At 200+ days... At 365+ days..." — additive.
Fix: Add note: "Effects are cumulative — a 500-day kijo has all four Wisdom effects
     simultaneously. The table shows when each UNLOCKS, not exclusive tier behavior."
```

---

```
[SEVERITY: MINOR]
Location: §11 — Open Questions (missing OQ-4 from NFT-METADATA-IMAGE-ARCH.md)
Issue: OQ-4 from NFT-METADATA-IMAGE-ARCH.md is not captured: TechniqueClassifier.classify()
       is not exported from packages/engine/src/index.ts. This directly affects the
       Technique metadata trait every buyer sees on the NFT.
Fix: Add Q11: "Technique trait in Phase 1 — Is TechniqueClassifier exported from
     packages/engine? If not, Phase 1 ships Technique='Unclassified'. What is the export
     plan? (From OQ-4 in NFT-METADATA-IMAGE-ARCH.md)"
```

---

```
[SEVERITY: MINOR]
Location: §10 — Document Version Conflicts (missing image URL format conflict)
Issue: NFT-METADATA-IMAGE-ARCH.md metadata schema has image URL WITHOUT .png extension
       ("https://api.kijo.xyz/nft/image/42"). KIJONSAI-CONTRACT-ARCH.md §12.1 shows it
       WITH .png ("https://api.kijo.xyz/nft/image/42.png"). The audit doc reproduces one
       version in §4 without flagging the conflict.
Fix: Add §10.5: "Image URL format conflict — NFT-METADATA-IMAGE-ARCH.md uses no extension;
     KIJONSAI-CONTRACT-ARCH.md §12.1 uses .png. Resolve before building nft-metadata Edge
     Function. NFT-METADATA-IMAGE-ARCH.md description ('format-agnostic, permanent') suggests
     no extension is correct."
```

---

```
[SEVERITY: MINOR]
Location: §6.3 / §11 Q9 — Bonsai style list (8 styles)
Issue: KIJO-TECH-SPEC §3.2 lists 8 styles including "Han-kengai" (semi-cascade).
       GDD §4.2.1 lists 8 styles including "Sekijoju" (root over rock) instead.
       The two docs disagree on one style. The audit doc uses only the GDD list and does
       not flag this conflict.
Fix: Add to §10 and Q9: "TECH-SPEC has Han-kengai where GDD has Sekijoju — canonical 8-style
     list must be confirmed by Jeremy before parametric curves or Match% calculations are
     implemented."
```

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 3 |
| MAJOR | 5 |
| MINOR | 8 |

**Verdict: NEEDS REVISION**

The document is well-structured and captures genuine complexity, but three critical errors would directly poison an implementer:

1. **All four technique combat archetypes are wrong** — the doc substitutes care descriptions for GDD combat styles, and assigns a non-existent archetype to Water-and-Land.
2. **Tempo → Ki renaming is incorrect** — these are different v0.2 concepts; conflating them corrupts understanding of species resolution order vs. the Ki energy pool.
3. **Turn-based model references undefined stats** — "Defense%" and "Stability" appear in §1.1's damage formula but exist nowhere in StatSheet; an implementer will look for fields that aren't there.

The gap analysis (§5) and open questions (§11) are largely sound. Sections 2, 4, 6.1–6.2, 7, 9, 10.2–10.4 are accurate. The document needs targeted corrections to §3.5, §6.3, §10.1, and additions for the missing gaps listed above.
