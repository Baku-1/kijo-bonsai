# AUDIT — §3.5 Technique Classification Table
## Target: `COMBAT-METADATA-REQUIREMENTS.md` §3.5
**Date:** 2026-07-27  
**Method:** Cross-referenced against GDD.md §3.1.1, KIJO-ENGINE-API.md `TechniqueClassifier`, KIJO-TECH-SPEC.md §7.4  
**Prior audit claim:** Water-and-Land was incorrectly given combat archetype "Root-based fighter" — verify if corrected.

---

## What §3.5 Claims (verbatim)

```
| Technique       | Care Log Pattern                      | Combat Archetype                        |
|-----------------|---------------------------------------|-----------------------------------------|
| Bound-and-Cut   | Wire actions + prune actions          | Control/grapple: bending limbs then cutting |
| Clip-and-Grow   | Prune ≥ 2, wire = 0, age ≥ 30 days   | Precision pruner: no wire, pure cuts    |
| Jin             | High scar/jin-landscape ratio         | Deadwood specialist: scar-based moves   |
| Water-and-Land  | High landscape/root-shaping ratio     | Root-based fighter                      |
```

Post-table note in §3.5:
> "Default technique (trees with no qualifying actions): appears to be Clip-and-Grow by process of elimination."

---

## Bound-and-Cut

**Doc claims:**
- Care pattern: Wire actions + prune actions
- Combat archetype: "Control/grapple: bending limbs then cutting"
- (No explicit Primary/Overlay label in §3.5 table)

**GDD §3.1.1 says:**
- Care pattern: "Uses BOTH wire and shears. Balanced shaping. wire uses > 0 AND prune uses > 0, with a roughly balanced ratio."
- Combat archetype: **"Balanced"** — "Moderate stats across the board, no exploitable weakness. Adaptable, well-rounded. The jack-of-all-trades."
- Classification: PRIMARY technique (and the default — "Bound-and-Cut is the default — it never triggers a notification because most players arrive there naturally.")

**ENGINE-API says:**
- "BOUND_AND_CUT: wire uses > 0 AND prune uses > 0. The default when both tools are used."
- Primary technique, not an overlay.

**TECH-SPEC §7.4 says:**
```
else if wireCount > 0 AND pruneCount > 0:
    primary = BOUND_AND_CUT
else:
    primary = BOUND_AND_CUT  // default
```

**Verdict: PARTIALLY CORRECT**

Issues found:
1. **Combat archetype is WRONG.** §3.5 says "Control/grapple: bending limbs then cutting." GDD §3.1.1 explicitly names it **"Balanced"** — all-rounder with no exploitable weakness. "Control/grapple" is fabricated; it has no basis in any source document.
2. Care pattern ("Wire actions + prune actions") is correct but omits the "roughly balanced ratio" qualifier from the GDD.
3. §3.5 does not identify this as the PRIMARY/default technique — an omission that matters for understanding the classification hierarchy.

---

## Clip-and-Grow / Lingnan

**Doc claims:**
- Care pattern: Prune ≥ 2, wire = 0, age ≥ 30 days
- Combat archetype: "Precision pruner: no wire, pure cuts"
- (No explicit Primary/Overlay label)

**GDD §3.1.1 says:**
- Full name: **"Absolute Clip-and-Grow"** (from the Lingnan School)
- Care pattern: "prune uses ≥ 2 AND wire uses == 0 AND age ≥ 30 game days. A single wire use at any point permanently disqualifies Clip-and-Grow classification. The technique rewards conviction. Twine and weights do NOT count as wire."
- Combat archetype: **"High-Crit"** — "Low sustained damage but devastating critical hits. Jagged, explosive power spikes from regrowth patterns. Wild, aggressive silhouette."

**ENGINE-API says:**
- "CLIP_AND_GROW: prune uses > 0 AND wire uses == 0 (zero, ever). One wire use permanently disqualifies. Twine and weights do NOT count as wire."
- Primary technique (not an overlay).
- Note: ENGINE-API omits the prune ≥ 2 and age ≥ 30 qualifiers from its summary, but TECH-SPEC R22 confirms them as first-pass values.

**TECH-SPEC §7.4 says:**
```
if wireCount == 0 AND pruneCount > 0:
    primary = CLIP_AND_GROW
```
R22 note: "Age ≥ 30 game days AND prune count ≥ 2 AND wire count == 0 — ensures commitment is real, not accidental."

**Verdict: PARTIALLY CORRECT**

Issues found:
1. **Combat archetype is WRONG.** §3.5 says "Precision pruner: no wire, pure cuts." This is a description of the **care technique**, not the combat archetype. GDD §3.1.1 names the combat archetype **"High-Crit"** with devastating critical hits. The §3.5 description belongs in the Care Pattern column, not Combat Archetype.
2. Care pattern ("Prune ≥ 2, wire = 0, age ≥ 30 days") is CORRECT — matches GDD §3.1.1 and TECH-SPEC R22.
3. §3.5 does not identify this as a PRIMARY technique. The permanent disqualification on any single wire use — a crucial design detail — is also omitted.

---

## Jin

**Doc claims:**
- Care pattern: "High scar/jin-landscape ratio"
- Combat archetype: "Deadwood specialist: scar-based moves"
- (No explicit Primary/Overlay label)

**GDD §3.1.1 says:**
- Full name: "Trunk Splitting / Jin" (deadwood technique: jin/shari)
- Care pattern: "Strips bark to create exposed deadwood. Deliberate structural damage that hardens. jin/bark-stripping actions > threshold."
- Combat archetype: **"Defensive"** — "High Defense and Endurance. Fights by absorbing punishment and outlasting. Exposed heartwood = hardened interior. Scarred, weathered, unkillable."
- Classification: **OVERLAY** — "A tree can be both Jin AND Bound-and-Cut or Clip-and-Grow — Jin is an overlay technique, not exclusive."

**ENGINE-API says:**
- "JIN: jin strip actions > threshold (overlay — can combine with Bound-and-Cut or Clip-and-Grow)."
- "The classifier returns the PRIMARY technique. Jin and Water-and-Land are overlays stored separately. A tree can be CLIP_AND_GROW + JIN or BOUND_AND_CUT + WATER_AND_LAND."

**TECH-SPEC §7.4 says:**
```
overlays = []
if jinCount >= 1:
    overlays.push(JIN)
```
Threshold is `jinCount >= 1` — just one jin strip action qualifies.

**Verdict: WRONG**

Issues found:
1. **Combat archetype is WRONG.** §3.5 says "Deadwood specialist: scar-based moves." GDD §3.1.1 names it **"Defensive"** — high Defense and Endurance, absorbs punishment, outlasts opponents. "Deadwood specialist" is not an archetype name in any source.
2. **Care pattern description is imprecise and partially wrong.** §3.5 says "High scar/jin-landscape ratio" — this incorrectly conflates landscape elements with jin. Landscape count is a separate classifier for Water-and-Land. Jin classification is purely `jinCount >= 1` (TECH-SPEC), not a "ratio" involving landscape. The word "High" is also misleading; the threshold is just 1 jin strip action.
3. **OVERLAY status is absent.** §3.5 does not identify Jin as an overlay. This is a critical omission — Jin stacks ON TOP of the primary technique, it does not replace it.
4. **Jin + Bound-and-Cut and Jin + Clip-and-Grow combinations are not mentioned.** Per ENGINE-API: "A tree can be CLIP_AND_GROW + JIN or BOUND_AND_CUT + WATER_AND_LAND." §3.5 gives no indication these combinations exist.

---

## Water-and-Land

**Doc claims:**
- Care pattern: "High landscape/root-shaping ratio"
- Combat archetype: "Root-based fighter"
- (No explicit Primary/Overlay label)

**GDD §3.1.1 says:**
- Full name: "Water-and-Land Landscape" (Shanshui penjing — landscape composition)
- Care pattern: "Adds rocks, water features, moss, ceramic decorations around the tree. landscape element count > threshold."
- Combat archetype: **"None (care-loop only)"** — "The tree can still awaken a kijo, but the landscape elements are display-only. This is the pure aesthetic/collector path — the Exhibition feature."
- Kijo Fighting Style: none — "the landscape elements are display-only."
- Classification: **OVERLAY** — "This is additive — any tree can have landscape elements regardless of its other technique."

**ENGINE-API says:**
- "WATER_AND_LAND: landscape element count > threshold (overlay — care-loop only, **no combat archetype**)."
- Stored as an overlay alongside the primary technique.

**TECH-SPEC §7.4 says:**
```
if landscapeCount >= 3:  // threshold: at least 3 elements
    overlays.push(WATER_AND_LAND)
```
Threshold is `landscapeCount >= 3`. Water-and-Land is an overlay, not a primary.

**Verdict: WRONG**

Issues found:
1. **Combat archetype is WRONG — THIS IS THE KNOWN PRIOR-AUDIT ERROR, STILL UNCORRECTED.** §3.5 says "Root-based fighter." ALL three source documents agree: Water-and-Land has **no combat archetype**. GDD: "None (care-loop only)." ENGINE-API: "no combat archetype." The technique affects display only. The prior audit's finding is confirmed — the error was not fixed.
2. **Care pattern is partially wrong.** §3.5 says "High landscape/root-shaping ratio." The phrase "root-shaping" appears in no source document and is fabricated. Landscape elements are rocks, water features, moss, and ceramic decorations — not root-shaping actions. The correct care pattern is landscape element count ≥ 3 (TECH-SPEC).
3. **OVERLAY status is absent.** §3.5 does not identify Water-and-Land as an overlay. Like Jin, it stacks on the primary technique; it does not replace or compete with it.
4. **The threshold "≥ 3 elements" is not documented in §3.5** — it only says "high ratio" which is vague and incorrect framing.

---

## Default Technique Claim

**§3.5 says:** "Default technique (trees with no qualifying actions): appears to be Clip-and-Grow by process of elimination."

**All source docs say:**
- GDD §3.1.1: "Bound-and-Cut is the default — it never triggers a notification because most players arrive there naturally."
- ENGINE-API: "BOUND_AND_CUT: The default when both tools are used."
- TECH-SPEC §7.4: `else: primary = BOUND_AND_CUT  // default`

**Verdict: WRONG.** The default technique is **Bound-and-Cut**, not Clip-and-Grow. Clip-and-Grow requires a positive qualifying action set (prune ≥ 2, zero wire, age ≥ 30). The fallback for any tree that doesn't qualify for Clip-and-Grow is Bound-and-Cut. §3.5's claim that Clip-and-Grow is the default "by process of elimination" inverts the actual logic.

---

## Jin Overlay Combination Verification

**Question:** Can Jin combine with Bound-and-Cut or Clip-and-Grow simultaneously?

**Answer: YES — confirmed by all three source docs.**

- GDD §3.1.1: "A tree can be both Jin AND Bound-and-Cut or Clip-and-Grow — Jin is an overlay technique, not exclusive."
- ENGINE-API: "A tree can be CLIP_AND_GROW + JIN or BOUND_AND_CUT + WATER_AND_LAND."
- TECH-SPEC §7.4: Jin is pushed to the `overlays` array independently of primary technique; the primary is set first, overlays appended after.

**§3.5 does not document this behavior at all.** The flat table presentation implies all four techniques are mutually exclusive primaries, which is incorrect.

---

## Overall Verdict

**Total errors found: 8**

| # | Error | Severity |
|---|---|---|
| 1 | Bound-and-Cut combat archetype wrong ("Control/grapple" should be "Balanced") | HIGH |
| 2 | Clip-and-Grow combat archetype wrong ("Precision pruner" should be "High-Crit") | HIGH |
| 3 | Jin care pattern imprecise — adds "landscape" to jin formula, uses "ratio" framing | MEDIUM |
| 4 | Jin combat archetype wrong ("Deadwood specialist" should be "Defensive") | HIGH |
| 5 | Water-and-Land care pattern wrong — "root-shaping" is fabricated, threshold not specified | MEDIUM |
| 6 | Water-and-Land combat archetype wrong ("Root-based fighter" should be "None") — **KNOWN PRIOR ERROR, UNCORRECTED** | CRITICAL |
| 7 | Primary vs Overlay distinction absent — Jin and Water-and-Land are overlays; §3.5 table implies all four are peers | HIGH |
| 8 | Default technique wrong — §3.5 says Clip-and-Grow; all sources say Bound-and-Cut | HIGH |

**3.5 contains ZERO correctly stated combat archetypes out of four.** Every archetype in the table is wrong. The only correct content in the table is the Clip-and-Grow care log pattern (prune ≥ 2, wire = 0, age ≥ 30 days) and the Bound-and-Cut care pattern (wire + prune).

The section requires a full rewrite. The corrected table should be:

```
| Technique      | Type    | Care Log Pattern                                  | Combat Archetype              |
|----------------|---------|---------------------------------------------------|-------------------------------|
| Bound-and-Cut  | PRIMARY | wire > 0 AND prune > 0                            | Balanced (all-rounder)        |
| Clip-and-Grow  | PRIMARY | prune ≥ 2 AND wire == 0 AND age ≥ 30 days         | High-Crit                     |
| Jin            | OVERLAY | jin strip actions ≥ 1 (stacks on primary)         | Defensive                     |
| Water-and-Land | OVERLAY | landscape elements ≥ 3 (stacks on primary)        | None (care-loop / display only)|
```

Default: Bound-and-Cut (fires when tree has any actions but doesn't qualify for Clip-and-Grow).

Jin may combine with Bound-and-Cut or Clip-and-Grow simultaneously.
Water-and-Land may combine with any primary technique.

---

*Sources read: GDD.md §3.1.1 (v0.2, 2026-07-23), KIJO-ENGINE-API.md TechniqueClassifier section (v0.2, 2026-07-23), KIJO-TECH-SPEC.md §7.4 (v0.2, 2026-07-23)*
