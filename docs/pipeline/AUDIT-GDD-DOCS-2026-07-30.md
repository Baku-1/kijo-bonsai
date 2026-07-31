# Adversarial Audit — GDD Design Documents
**Date:** 2026-07-30  
**Auditor:** Claude (adversarial-auditor skill)  
**Scope:** 13 design documents in `kijo-bonsai/docs/`  
**Ground truth:** GDD.md (v0.2), CANONICAL-STYLES.md (confirmed 2026-07-28), DESIGN-CARETAKER-OPACITY.md (confirmed 2026-07-28)

---

## Audit Method

Every claim treated as unverified until confirmed against ground truth. Each doc read in full. Numerical values cross-checked against GDD. Style stats cross-checked against CANONICAL-STYLES.md (which is AUTHORITATIVE and overrides GDD §4.2.1). Implementation-facing rules cross-checked for internal logic consistency. Known errors (Sekijoju, caretaker opacity) explicitly verified as absent / correctly preserved.

All 13 docs checked for Sekijoju: **None contain it. ✓**  
All 13 docs checked for stat display in caretaker UI: **None violate DESIGN-CARETAKER-OPACITY.md. ✓**  
All 13 docs checked for LEAF-COLOR-RARITY surfacing to players: **None surface it. ✓**

---

## Summary Table

| # | Document | Verdict | Highest Severity |
|---|---|---|---|
| 1 | DESIGN-CARETAKER-OPACITY.md | PASS | — |
| 2 | DESIGN-TWINE-VS-WIRE.md | FAIL | BLOCKER |
| 3 | DESIGN-SPECIES.md | FAIL | BLOCKER |
| 4 | DESIGN-TECHNIQUE-CLASSIFICATION.md | FAIL | BLOCKER |
| 5 | DESIGN-SPECIES-TECHNIQUE-ARCHETYPES.md | FAIL | MINOR |
| 6 | DESIGN-FLOWER-GUILD-RANK.md | PASS | — |
| 7 | DESIGN-SLP-DUAL-POTION.md | FAIL | MINOR |
| 8 | DESIGN-NOTCH-DEFERRED.md | PASS | — |
| 9 | DESIGN-SPIRIT-MORALE.md | FAIL | MINOR |
| 10 | DESIGN-LEAF-COLOR-RARITY.md | PASS | — |
| 11 | DESIGN-COMBAT-SYSTEM-STATUS.md | PASS | — |
| 12 | DESIGN-WISDOM-STAT.md | PASS | — |
| 13 | DESIGN-KIJO-MORPHOLOGY.md | FAIL | MINOR |

---

## Doc 1 — DESIGN-CARETAKER-OPACITY.md

**Verdict: PASS**

This is also a ground truth document. Audited for internal consistency.

- "All 8 (→10 after defense/stability)" in developer debug views is consistent: current 8-stat sheet grows to 10 when Defense and Stability are added.
- "NOT allowed" list covers: HP, Power, Endurance, Ki, SkillSlots, SkillPoints, Defense, Stability, Wisdom tier, matchPct, Style name/index. Complete for the stat sheet as defined.
- Allowed signals (health, moisture, age, branch count, visual form) are non-numeric approximations only. Internally consistent.
- The "For Auditors" and "For Implementers" sections correctly guard against treating the opacity as a bug.

**ONE OMISSION — MINOR:** Morale is not listed in the "NOT allowed" section. DESIGN-SPIRIT-MORALE.md explicitly says morale must not appear in the caretaker care interface. An implementer reading only DESIGN-CARETAKER-OPACITY.md would not know morale is forbidden. The omission creates an implementation gap if this doc is the spec for what is/isn't allowed. Recommend adding morale to the "NOT allowed" list with a pointer to DESIGN-SPIRIT-MORALE.md.

---

## Doc 2 — DESIGN-TWINE-VS-WIRE.md

**Verdict: FAIL — BLOCKER**

### Finding B-1: Self-contradictory rule on twine + Clip-and-Grow eligibility

**Severity: BLOCKER**  
**Evidence:**  
Line 27: *"A player using ONLY twine (no wire) + shears is Bound-and-Cut, NOT Clip-and-Grow."*  
Line 65: *"A player using ONLY shears + twine + weights (no metal wire ever) is still Clip-and-Grow eligible."*

These two statements directly contradict each other within the same document. The only structural difference between the two cases is the presence of weights — but weights are a gravity-only tool that twine attaches. If twine counts as "binding" and therefore disqualifies Clip-and-Grow, adding weights to the twine cannot retroactively make the twine NOT count as binding. The addition of weights cannot change the classification status of the twine itself.

No document provides a coherent logical explanation for why the two cases differ. The GDD (§3.1.1) reproduces the same contradiction: it says "twine counts as binding — twine + shears = Bound-and-Cut" in one paragraph and "a player using only twine, weights, and shears is Clip-and-Grow eligible" in another.

**Impact:** An implementer cannot write the technique classifier correctly without knowing the answer. There are two incompatible implementations:
- Option A: Twine + shears → Bound-and-Cut; Twine + weights + shears → also Bound-and-Cut (because twine is twine regardless of weights). The "twine + weights + shears = C&G eligible" lines in both docs are wrong.
- Option B: Twine is always neutral for classification; only metal wire disqualifies C&G. Twine + shears IS C&G eligible. The "twine + shears = Bound-and-Cut" lines in both docs are wrong.

**Required action:** Jeremy must choose Option A or Option B and all documents must be updated consistently. The classifier pseudocode in DESIGN-TECHNIQUE-CLASSIFICATION.md must match the chosen rule.

---

## Doc 3 — DESIGN-SPECIES.md

**Verdict: FAIL — BLOCKER**

### Finding B-2: Hokidachi stat profile propagates GDD error

**Severity: BLOCKER**  
**Evidence:**  
DESIGN-SPECIES.md, Species × Bonsai Style Affinity table:  
*"Hardwood | Chokkan (Formal Upright), Hokidachi (Broom) | Stacked durability — maximizes HP and **Defense** from both structural and terrain sources"*

CANONICAL-STYLES.md (authoritative, overrides GDD):  
*"6 | Broom | Hokidachi | **HP + Endurance** | The wall — raw health and staying power"*

GDD §4.2.1 (known-error source):  
*"Broom | Hokidachi | High HP + high **Defense** — the wall, dense and balanced"*

DESIGN-SPECIES.md has copied the GDD error. Defense is **Fukinagashi's** stat (CANONICAL-STYLES index 4: "Defense + Stability"). Hokidachi gives HP + Endurance, not HP + Defense. An implementer building the stat terrain for the Hokidachi spatial zone reads DESIGN-SPECIES.md and assigns Defense terrain bonuses to that zone — which is wrong. The stat terrain for Hokidachi must be HP + Endurance.

**Required action:** Change "maximizes HP and Defense" to "maximizes HP and Endurance" in the species affinity table.

### Finding M-1: Tropical affinity description may propagate GDD's Bunjin Ki claim

**Severity: MINOR**  
**Evidence:**  
DESIGN-SPECIES.md: *"Tropical | Kengai (Cascade), Bunjin (Literati) | Glass cannon extreme — devastating burst, **maximal Ki and Skill Points**, minimal safety net"*

CANONICAL-STYLES.md:
- Kengai: primary stat = **skillSlots** (not Ki)
- Bunjin: primary stat = **skillPoints** (not Ki explicitly listed)

The GDD §4.2.1 lists Bunjin as "Extreme Ki + high Skill Points" and Kengai as "High Attack + high Ki." CANONICAL-STYLES overrides both, naming skillSlots for Kengai and skillPoints for Bunjin without listing Ki as a primary stat for either.

DESIGN-SPECIES.md says "maximal Ki and Skill Points" — the "Ki" component is inherited from the GDD's profile, not from CANONICAL-STYLES. If CANONICAL-STYLES intends Ki to be excluded from Bunjin's primary stat bonus, then the DESIGN-SPECIES description is wrong.

**Ambiguity flag:** CANONICAL-STYLES column header says "Primary Stat(s)" — it may be listing the defining/primary bonus rather than all bonuses. This does not resolve whether Ki is a legitimate Bunjin bonus or a GDD error. Jeremy must confirm whether Bunjin grants a Ki terrain bonus or only skillPoints.

---

## Doc 4 — DESIGN-TECHNIQUE-CLASSIFICATION.md

**Verdict: FAIL — BLOCKER**

### Finding B-3: Classifier pseudocode contradicts the stated binding rule

**Severity: BLOCKER**  
**Evidence:**  
The narrative states (§"Twine ≠ Wire" section):  
*"twine + shears = Bound-and-Cut"*

The classifier pseudocode states:
```
wireCount = count of metal wire uses in care log (twine does NOT count)
...
if wireCount == 0 AND pruneCount >= 2 AND treeAgeDays >= 30:
    primary = CLIP_AND_GROW
else:
    primary = BOUND_AND_CUT
```

Under this code: a player with twine uses, prune ≥ 2, age ≥ 30, and wireCount == 0 returns **CLIP_AND_GROW**. But the narrative says this should be BOUND_AND_CUT.

The code does not implement the stated rule. An implementer following the pseudocode produces the opposite result from what the narrative prescribes for the twine + shears case. The code is authoritative to implementers; the narrative is authoritative to designers. They say different things.

**Required action:** After Jeremy resolves Finding B-1 (the underlying design question), update the pseudocode to match the chosen rule. If twine disqualifies C&G (Option A from B-1), the code needs a `bindingCount` variable or a `twineCount == 0` condition added to the C&G check. If twine does NOT disqualify C&G (Option B), the "twine + shears = Bound-and-Cut" narrative lines must be removed.

### Finding M-2: Explanatory paragraph contains logically incoherent sentence

**Severity: MAJOR**  
**Evidence:**  
*"This is a subtle but important nuance: twine + shears = Bound-and-Cut. Twine + weights + shears (no wire ever) = Clip-and-Grow eligible. **The difference is whether the caretaker also used shears** — Clip-and-Grow requires shears (prune ≥ 2) and no wire; twine and weights are neutral."*

Both cases in the nuance statement include shears. The stated explanation ("The difference is whether the caretaker also used shears") is logically incoherent — it identifies a factor that is identical in both cases as the distinguishing factor. No implementer can derive a rule from this text.

The likely intended sentence was "The difference is whether the caretaker also used wire (metal)" but "wire" was written as "shears." Even with that correction, the paragraph contradicts itself (twine + shears = B&C, but the correction would imply twine + shears = C&G since no wire was used).

**Required action:** After B-1 is resolved, rewrite this paragraph completely to state the actual rule clearly without self-contradiction.

---

## Doc 5 — DESIGN-SPECIES-TECHNIQUE-ARCHETYPES.md

**Verdict: FAIL — MINOR**

### Finding M-3: "12 distinct combat archetypes" claim is misleading

**Severity: MINOR**  
**Evidence:**  
Introduction: *"The cross-product of 3 species × 4 techniques produces **12 distinct combat archetypes**."*

Body (same document): *"Water-and-Land is an overlay with no combat archetype contribution, so all three species × Water-and-Land produce the same result: the base species archetype, unchanged. **The meaningful grid is 3 × 3 (primary techniques only)** plus the Jin overlay modifier."*

The document contradicts itself on this point. 3 × 4 = 12 combinations, but only 9 distinct combat archetypes exist. Water-and-Land produces no new archetype for any species. The "12 distinct combat archetypes" claim is false — there are at most 9 base archetypes (expanded with Jin overlay), not 12.

An implementer building the combat archetype system reads "12 archetypes" and might allocate 12 archetype slots, then be confused when the 9-cell grid accounts for everything. The 3×3 + overlay model is correct; the "12 distinct" framing is wrong.

**Required action:** Change "12 distinct combat archetypes" to "9 distinct combat archetypes across 3 species × 3 primary techniques (plus Jin overlay modifier)." The GDD §3.1.1 also says "12 combat archetypes from 3 species × 4 techniques" — this GDD claim is propagated here and should be noted as a doc-level correction when the GDD is next updated.

---

## Doc 6 — DESIGN-FLOWER-GUILD-RANK.md

**Verdict: PASS**

Rank tier table verified against GDD §4.2.2:
| 0–30% Seedling ✓ | 30–50% Sapling ✓ | 50–65% Pruned ✓ | 65–80% Styled ✓ | 80–90% Exhibition ✓ | 90–95% Master Work ✓ | 95–100% Living Painting ✓ |

Wire timing table matches GDD §3.2 and DESIGN-TWINE-VS-WIRE.md. ✓

matchPct formula `(filled_voxels ∩ ideal_form_voxels) / ideal_form_voxels` is correctly stated. ✓

matchPct correctly hidden from caretaker view (references DESIGN-CARETAKER-OPACITY.md). ✓

Raffia wrap mechanics match GDD §3.2. ✓

No Sekijoju. ✓ No stat display in caretaker UI. ✓

---

## Doc 7 — DESIGN-SLP-DUAL-POTION.md

**Verdict: FAIL — MINOR**

### Finding M-4: Soothing Leaf Potion restoration timing conflicts with DESIGN-SPIRIT-MORALE.md

**Severity: MINOR**  
**Evidence:**  
DESIGN-SLP-DUAL-POTION.md:  
*"Soothing Leaf Potion provides **full morale restoration over time**."*

DESIGN-SPIRIT-MORALE.md §Method 2:  
*"The caretaker's Soothing Leaf Potion restores full morale to 100% **when applied**. No cap, no diminishing returns."*

"Over time" and "when applied" are mutually exclusive. Either the restoration is instantaneous (when applied) or it is gradual (over time). The two documents give different answers. An implementer must know which: instantaneous restoration affects how quickly a fighter can return to full combat; gradual restoration changes the economic calculus significantly (the fighter still has to wait even after the caretaker uses the potion).

The GDD says "calms the kijo's spirit through the care bond" and "returns to full fighting willingness" without specifying timing. The GDD does not resolve this.

**Required action:** Jeremy must specify whether Soothing Leaf Potion restores morale (a) instantly to 100% on application, or (b) gradually to 100% over some defined period. One document must be updated to match the decision.

### Finding M-5: Diminishing returns window is undefined

**Severity: MINOR**  
**Evidence:**  
The doc correctly notes: *"'same recovery window' needs a concrete implementation (e.g., a 24-hour window from first SLP use, tracked per tree per fighter)."*

The 24-hour example is just an example, not a decision. The window is essential for implementing the diminishing returns correctly. An implementer cannot build this without a concrete window value.

**Required action:** Jeremy must define the recovery window duration. This is an open design decision, not just a tuning value — the window length significantly affects how much SLP fighters can spend before being forced to wait for their caretaker.

Numerical values cross-checked against GDD: 20–30% first use ✓, ~15% second use ✓, ~8% third use ✓, 65% morale cap ✓. All match.

---

## Doc 8 — DESIGN-NOTCH-DEFERRED.md

**Verdict: PASS**

Deferral status matches GDD §3.2 ("Deferred — not in the current prototype"). ✓

Constraints listed (lower third, existing branches, depth-1 restriction, proximity distance TBD) match GDD. The TBD on proximity distance is correctly flagged as TBD rather than given a placeholder value. ✓

"Must not be accidentally implemented early" guard is correct and valuable. ✓

Phase ordering rationale is sound and consistent with GDD §10.1 (bonsai side first). ✓

---

## Doc 9 — DESIGN-SPIRIT-MORALE.md

**Verdict: FAIL — MINOR**

Numerical values cross-checked against GDD §3.5:

| Trigger | GDD | Doc | Match |
|---|---|---|---|
| Consecutive loss | −15 | −15 | ✓ |
| Low health during battle (health < 40) | −5 | −5 | ✓ |
| Drought stress (<20%) | −3/day | −3/day | ✓ |
| Overwatering stress (>80%) | −3/day | −3/day | ✓ |
| Victory | +10 | +10 | ✓ |
| Optimal care day | +2/day | +2/day | ✓ |
| Fertilizer | +5 | +5 | ✓ |
| Rest day | +3/day | +3/day | ✓ |
| Pruning | +8 | +8 | ✓ |

Refusal threshold (below 20) ✓. Re-engagement threshold (above 50) ✓. The boundary condition note ("at exactly 20 morale is correct behavior — below 20 is strict less-than") is a correct and valuable clarification. ✓

### Finding M-6: "Health stable" threshold for optimal care day bonus is undefined

**Severity: MINOR**  
**Evidence:**  
The morale increase table says: *"Optimal care day (moisture 30–65%, **health stable**) | +2 per day in healthy range"*

"Health stable" is not defined numerically. Health is a 0–100 scale. An implementer needs to know the health threshold below which the optimal care day bonus does NOT apply. The GDD does not define this threshold either. Without it, the morale tick calculation cannot be implemented.

**Required action:** Define a minimum health value for "health stable" (e.g., health ≥ 60, health ≥ 50). This should be added to both DESIGN-SPIRIT-MORALE.md and to the relevant implementer notes.

### Note on Soothing Leaf Potion timing (Finding M-4)
The same "over time" vs "when applied" conflict appears in this doc's §Method 2 ("Soothing Leaf Potion restores full morale to 100% when applied"). This is the same conflict documented in Doc 7. One of the two documents must be corrected after Jeremy's decision.

---

## Doc 10 — DESIGN-LEAF-COLOR-RARITY.md

**Verdict: PASS**

Correctly marked "INTERNAL USE ONLY — DO NOT SURFACE IN PLAYER-FACING DOCUMENTATION." ✓

Color palettes match GDD §10.4:
- Hardwood: Red, Green common / Maroon rare ✓
- Evergreen: Green, Blue common / Cyan rare ✓
- Tropical: Green, Dark Green, Tan/Brown common / Yellow rare ✓

Roll rate (~3%) matches GDD. ✓

Crown inheritance rule (kijo's crown inherits leaf color) matches GDD §5.4. ✓

Implementation note: `seed_derived_color_roll >= 97` gives ~3% rare rate. Consistent with stated intent. ✓

No other audited document surfaces the rarity system to players. ✓

---

## Doc 11 — DESIGN-COMBAT-SYSTEM-STATUS.md

**Verdict: PASS**

Correctly identifies and documents the GDD §4.3 vs §4.4 conflict without taking a position. ✓

All Wisdom thresholds for both systems verified against GDD:

**Fighting game (§4.3):** 100 days = 10% ✓, 365 days = 35% ✓, 500 days = 50% ✓  
**Turn-based (§4.4):** 100 days = last-stance reveal ✓, 200 days = 30% current reveal ✓, 365 days = 50% current reveal ✓, 500 days = stance-change once per fight ✓

The table of what CAN vs. CANNOT be built without a combat decision is accurate and useful. ✓

"Do not implement either combat model" directive is correct and clearly stated. ✓

---

## Doc 12 — DESIGN-WISDOM-STAT.md

**Verdict: PASS**

Core formula `wisdom = tree_age_days` matches GDD ("Wisdom remains derived from tree age in days"). ✓

All combat threshold values verified against GDD:

**Turn-based:** All four thresholds (100/200/365/500 days) match GDD §4.4 exactly. ✓  
**Fighting game:** All three thresholds (100/365/500 days) match GDD §4.3 exactly. ✓  
"Faster knockdown recovery" clause matches GDD §4.3 ("Wisdom also affects kijo recovery speed after being knocked down"). ✓

Tie-breaking rule ("raw age in days, not a threshold bucket: 367 days beats 362 days") is clearly stated and consistent with GDD. ✓

Subscription interaction ("The time subscription affects how quickly Wisdom accumulates") is correctly flagged — subscribers accumulate game days faster and therefore Wisdom faster. This is consistent with GDD §7.2 (subscription adjusts day cycle speed). ✓

500-day cap ("Wisdom exceeding 50% auto-block at any age beyond 500 is a bug") is correctly stated. ✓

---

## Doc 13 — DESIGN-KIJO-MORPHOLOGY.md

**Verdict: FAIL — MINOR**

Trunk thickness mapping verified against GDD §5.4: <4 voxels lithe ✓, 4–7 athletic ✓, 8+ broad ✓. ✓

Eye colors verified: hardwood amber ✓, evergreen silver ✓, tropical green ✓. Matches GDD §5.4 and DESIGN-SPECIES.md. ✓

Weapon generation table (downward=blade, horizontal=shield, upward=horn) verified against GDD §5.4. ✓

Morale expression thresholds verified against DESIGN-SPIRIT-MORALE.md: >70 fierce ✓, 40–70 neutral ✓, 20–40 reluctant ✓, <20 withdrawn ✓. ✓

Phase 1 = 2D silhouette, Phase 2 = full 3D: correctly stated. ✓

Scar mapping (prune scars on tree → scars on kijo body) correctly described and consistent with GDD §5.4. ✓

### Finding M-7: Leg/arm split threshold not defined in this document

**Severity: MINOR**  
**Evidence:**  
*"Depth-1 branches must be classified into leg vs. arm by Y-position on the trunk. The threshold (lower third → legs, upper → arms) must be defined — the GDD's 'attachment height determines the arm/leg morphology split' (KIJO-TECH-SPEC.md §4.6 is the reference)."*

The threshold is deferred to KIJO-TECH-SPEC.md §4.6, which is out of scope for this audit. This is an implementation gap in the morphology spec itself. A Phase 2 implementer reading only this document cannot implement the leg/arm classifier without referencing the tech spec.

The GDD §3.1.1 says "The lowest main branch emerges around one-third up the trunk, leaving the lower third bare" — suggesting the structural boundary is at one-third trunk height. But this describes typical growth, not the morphology split rule.

**Required action:** Define the explicit leg/arm split threshold (e.g., "branches with attachment Y < trunk_height / 2 are legs; branches with attachment Y ≥ trunk_height / 2 are arms") directly in this document. Do not rely on an external tech spec reference for a rule that is load-bearing for morphology generation.

---

## Cross-Cutting Issues

### XC-1: Sekijoju verified absent across all 13 documents

All 13 documents were checked. None contain the word "Sekijoju" or "Root Over Rock" as a valid style. ✓ The GDD §4.2.1 error has not propagated to any of the design documents.

### XC-2: Caretaker opacity verified across all 13 documents

No document proposes surfacing stats (HP, Power, Endurance, Ki, SkillSlots, SkillPoints, Defense, Stability, matchPct, style name, Wisdom as number) to the caretaker-facing UI. ✓

All relevant documents either (a) reference DESIGN-CARETAKER-OPACITY.md explicitly or (b) contain their own "must not show in caretaker view" language consistent with it.

### XC-3: LEAF-COLOR-RARITY correctly treated as internal in all 13 documents

DESIGN-SPECIES.md references DESIGN-LEAF-COLOR-RARITY.md for implementers but does not state roll rates, exact hex values, or the undisclosed-easter-egg nature in player-facing terms. No other document surfaces the rarity information to players. ✓

### XC-4: GDD stat table errors confirmed not to have propagated further than found

GDD §4.2.1 contains multiple known-or-newly-identified errors in the stat profile column:
- Sekijoju row: banned, absent from all docs ✓
- Hokidachi: "High HP + high Defense" should be "HP + Endurance" — propagated to DESIGN-SPECIES.md only (Finding B-2)
- Kengai: "High Attack + high Ki" should be "skillSlots" (per CANONICAL-STYLES) — partially propagated to DESIGN-SPECIES.md (Finding M-1), not propagated elsewhere
- Bunjin: "Extreme Ki + high Skill Points" — Ki component uncertain vs. CANONICAL-STYLES "skillPoints" only; partially propagated to DESIGN-SPECIES.md (Finding M-1)

No other documents enumerate per-style stat profiles, so contamination is limited to DESIGN-SPECIES.md.

---

## Required Actions — Ranked by Severity

### BLOCKERS (must be resolved before any implementation of affected systems)

**B-1 (DESIGN-TWINE-VS-WIRE.md):** Jeremy must decide: does twine use with shears disqualify Clip-and-Grow? Both options are self-consistent; no option is currently consistent with both docs. Choose one, then update DESIGN-TWINE-VS-WIRE.md, DESIGN-TECHNIQUE-CLASSIFICATION.md narrative, and the classifier pseudocode together.

**B-2 (DESIGN-SPECIES.md):** Change Hokidachi's stat description from "HP and Defense" to "HP and Endurance." Cross-check against `StatTerrain.ts` — if the Hokidachi spline's terrain bonuses are already implemented, verify they assign Endurance (not Defense) bonuses.

**B-3 (DESIGN-TECHNIQUE-CLASSIFICATION.md):** After B-1 is resolved, update the classifier pseudocode to match the chosen rule for twine. Either add a `twineCount == 0` condition to the Clip-and-Grow check (if twine disqualifies), or remove the "twine + shears = Bound-and-Cut" narrative lines (if twine is neutral). These two things must agree.

### MAJOR

**M-2 (DESIGN-TECHNIQUE-CLASSIFICATION.md):** Rewrite the explanatory paragraph for twine/weights distinction. The current sentence "The difference is whether the caretaker also used shears" is incoherent (both cases have shears) and cannot be parsed by an implementer. Rewrite after B-1 is resolved.

### MINOR

**M-1 (DESIGN-SPECIES.md):** Confirm whether Bunjin grants Ki terrain bonuses (GDD position) or only skillPoints (CANONICAL-STYLES position). Update the Tropical species affinity description accordingly.

**M-3 (DESIGN-SPECIES-TECHNIQUE-ARCHETYPES.md):** Change "12 distinct combat archetypes" to "9 distinct base archetypes" in the introduction. Water-and-Land produces no distinct combat archetype.

**M-4 (DESIGN-SLP-DUAL-POTION.md + DESIGN-SPIRIT-MORALE.md):** Jeremy must decide: is Soothing Leaf Potion restoration instantaneous or gradual ("over time")? One of the two documents is wrong. Update the other after deciding.

**M-5 (DESIGN-SLP-DUAL-POTION.md):** Define the "recovery window" duration for SLP diminishing returns. A concrete value (e.g., 24 hours, 48 hours) is required before the morale recovery system can be built.

**M-6 (DESIGN-SPIRIT-MORALE.md):** Define a minimum health value for "health stable" (the threshold below which the +2/day morale bonus stops applying). Add to the doc and to implementer notes.

**M-7 (DESIGN-KIJO-MORPHOLOGY.md):** Define the leg/arm split threshold explicitly in this document. Do not rely on KIJO-TECH-SPEC.md §4.6 as the sole reference for a rule that Phase 2 morphology implementers will need.

**XC-1 (DESIGN-CARETAKER-OPACITY.md):** Add morale to the "NOT allowed in caretaker view" list, with a pointer to DESIGN-SPIRIT-MORALE.md. Currently the omission means an implementer reading only CARETAKER-OPACITY could mistakenly add morale to the caretaker UI.

---

## Documents That Pass Cleanly

**DESIGN-FLOWER-GUILD-RANK.md** — All rank tiers match GDD. Wire penalty mechanics match. matchPct correctly hidden from caretaker. Implementation notes are correct and complete. No issues.

**DESIGN-NOTCH-DEFERRED.md** — Correctly deferred. Guards against early implementation. Constraints match GDD. TBDs explicitly flagged as TBD. No issues.

**DESIGN-LEAF-COLOR-RARITY.md** — Colors match GDD. Roll rate (~3%) internally consistent. Crown inheritance correct. Internal-only status correctly enforced. No issues.

**DESIGN-COMBAT-SYSTEM-STATUS.md** — Correctly documents the conflict, correctly defers implementation, all threshold values verified against GDD. No issues.

**DESIGN-WISDOM-STAT.md** — All thresholds verified. Formula clear. Combat model dependency correctly cross-referenced. No issues.

---

*Audit complete. Five documents pass cleanly. Three BLOCKERs require Jeremy's direct design decision before implementation of the affected systems. All BLOCKERs are concentrated in the technique classification logic and one stat assignment error.*
