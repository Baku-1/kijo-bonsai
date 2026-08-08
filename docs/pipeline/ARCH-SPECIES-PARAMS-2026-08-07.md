# ARCH -- SPECIES_PARAMS forkSpreadMin/Max Correction

**Date:** 2026-08-07
**Stage:** ARCHITECT (Verified Architect skill)
**Task:** Correct SPECIES_PARAMS.forkSpreadMin/Max ordering, which is inverted vs. GDD 3.3
**Status:** READY FOR CRITIC

---

## DESIGN TASK

```
DESIGN TASK:  Determine whether SPECIES_PARAMS.forkSpreadMin/Max values are correct,
              and if not, propose corrected values grounded in GDD, DESIGN-SPECIES.md,
              and real bonsai horticultural sources.
DELIVERABLE:  Corrected forkSpreadMin/Max values for all three species + this spec.
              Side-effect list for the Implementer (UI strings, dist rebuild, fixtures).
BUILDS ON:    packages/shared/src/index.ts (SPECIES_PARAMS source of truth),
              kijo-bonsai/docs/DESIGN-SPECIES.md (authoritative species design),
              docs/GDD.md (game design authority)
CONSUMED BY:  Critic stage (review), then Implementer patching SPECIES_PARAMS.
```

---

## CODEBASE RECONNAISSANCE

```
FILES READ (full content, no limit):
  1. kijo-bonsai/SESSION-START.md
  2. kijo-bonsai/docs/DESIGN-SPECIES.md
  3. packages/shared/src/index.ts
  4. packages/engine/src/species.ts
  5. packages/engine/src/GrowthEngine.ts
  6. kijo-bonsai/DECISIONS.md
  7. kijo-bonsai/docs/pipeline/ARCH-BUG3-SPECIES-DESCRIPTIONS-2026-08-07.md
  8. docs/GDD.md (via grep -- lines 241-260 for section 3.3, line 251 key)

SYMBOLS VERIFIED:
  ✓ SPECIES_PARAMS       -- exists in packages/shared/src/index.ts:354, exported yes
  ✓ SpeciesParams        -- interface at packages/shared/src/index.ts:346, exported yes
  ✓ SpeciesParams.forkSpreadMin  -- field at line 348
  ✓ SpeciesParams.forkSpreadMax  -- field at line 349
  ✓ SpeciesParams.extensionMultiplier    -- field at line 347
  ✓ SpeciesParams.secondaryForkChance   -- field at line 350
  ✓ SpeciesParams.trunkMaturationRate   -- field at line 351 (DEFINED but never read -- see GAPS)
  ✓ SPECIES (legacy)     -- const in packages/engine/src/species.ts:14, exported yes
  ✓ SPECIES.forkAngle    -- field exists at species.ts; carries comment "GDD 3.3 hardwoods wide,
                            tropicals tight"; is NOT read by GrowthEngine (dead field)
  ✓ SPECIES.forkChance   -- field IS read by GrowthEngine.ts:66 (spE.forkChance)

CURRENT SPECIES_PARAMS VALUES (read directly from packages/shared/src/index.ts:355-357):
  hardwood:  extensionMultiplier:1.0, forkSpreadMin:0.3, forkSpreadMax:0.8,
             secondaryForkChance:0.45, trunkMaturationRate:0.05
  evergreen: extensionMultiplier:0.8, forkSpreadMin:0.1, forkSpreadMax:0.4,
             secondaryForkChance:0.35, trunkMaturationRate:0.04
  tropical:  extensionMultiplier:1.3, forkSpreadMin:0.5, forkSpreadMax:1.2,
             secondaryForkChance:0.25, trunkMaturationRate:0.06

CURRENT ORDERING (forkSpreadMax, largest to smallest):
  tropical  1.2 rad (68.8 deg) -- CURRENT "WIDEST"
  hardwood  0.8 rad (45.8 deg) -- CURRENT "MIDDLE"
  evergreen 0.4 rad (22.9 deg) -- CURRENT "NARROWEST"

LEGACY SPECIES.TS VALUES (species.ts:15-17, dead for fork spread but carries design intent):
  hardwood:  forkAngle:45 deg (0.785 rad), forkChance:0.10
  evergreen: forkAngle:30 deg (0.524 rad), forkChance:0.12
  tropical:  forkAngle:20 deg (0.349 rad), forkChance:0.16
  Comment: "forkAngle: number; // degrees; hardwoods wide, tropicals tight (GDD 3.3)"
  NOTE: forkAngle is NEVER READ by GrowthEngine. This is dead code for spread calculation.
        However it preserves the original designer intent before SPECIES_PARAMS was introduced.

CALL SITES FOR SPECIES_PARAMS (grep -rn, packages/ only, src only):
  GrowthEngine.ts:45  -- sp = SPECIES_PARAMS[tree.getSpecies()]
                         reads: sp.extensionMultiplier (calculateGrowthRate)
  GrowthEngine.ts:65  -- sp = SPECIES_PARAMS[tree.getSpecies()]
                         reads: sp.secondaryForkChance (line 93), sp.forkSpreadMin (line 98),
                                sp.forkSpreadMax (line 98)
  CareLogReplay.ts:65 -- reads only for species key validation, never reads fields
  (dist/ copies are compiled output -- not source of truth)

HOW forkSpread IS CONSUMED (GrowthEngine.ts:77-98):
  const spread = sp.forkSpreadMin + angleRng.next() * (sp.forkSpreadMax - sp.forkSpreadMin);
  child.angle  = round4(side * spread);   // side = +1 or -1
  spread is in RADIANS. child.angle is stored in radians on Branch.

DECISIONS.MD NOTES ON POLAR ANGLE:
  "Polar angle clamped [0.1, 1.4] radians" -- any forkSpreadMax up to 1.4 rad (80.2 deg)
  is within the allowed branch angle envelope.

GAPS FOUND:
  GAP-1: trunkMaturationRate is defined in SpeciesParams (shared/src/index.ts:351) and
         has values in SPECIES_PARAMS (0.05/0.04/0.06) but GrowthEngine.thickeningPass
         hardcodes maturation as `b.depth === 0 ? 0.05 * rate : 0.02 * rate` without
         reading the param. trunkMaturationRate is therefore dead code. OUT OF SCOPE here.
  GAP-2: DECISIONS.md entry BUG-3 (2026-08-07) already documented the forkSpread vs.
         legacy forkAngle discrepancy but ACCEPTED the current SPECIES_PARAMS ordering
         as correct and only corrected UI copy. The ARCH-BUG3 spec did not check GDD 3.3.
         This is the error that the current task is correcting.
  GAP-3: species.ts::forkAngle is dead code but preserves original design intent. No code
         reads it; its comment "hardwoods wide, tropicals tight (GDD 3.3)" is accurate
         as the intended ordering. No change needed here; flag for future cleanup.
```

---

## VERIFICATION LOG

```
VERIFIED -- GDD / DESIGN DOC SOURCES:
  ✓ GDD 3.3, line 251 (docs/GDD.md, read via grep):
    "Fork creates 1-2 child branches at angles influenced by species
    (hardwoods: wider angles, tropicals: tighter clusters)"
    Source: docs/GDD.md line 251 (grep output, confirmed exact text)
    AUTHORITY: GDD is the design authority per Kijo-specific architect rules.

  ✓ DESIGN-SPECIES.md, Hardwood section (read directly):
    "Branching angles are wide; lower branches spread outward, naturally working
    toward Chokkan (Formal Upright) and Hokidachi (Broom) style zones"
    Source: kijo-bonsai/docs/DESIGN-SPECIES.md (read directly)

  ✓ DESIGN-SPECIES.md, Tropical section (read directly):
    "naturally pushes toward Kengai (Cascade) and Bunjin (Literati) style zones --
    dramatic, sparse, vertically extreme forms"
    Source: kijo-bonsai/docs/DESIGN-SPECIES.md (read directly)

  ✓ DESIGN-SPECIES.md, Evergreen section (read directly):
    "naturally tends toward Moyogi (Informal Upright) and Fukinagashi (Windswept)
    style zones -- flowing forms that suggest perpetual movement"
    Source: kijo-bonsai/docs/DESIGN-SPECIES.md (read directly)

  ✓ species.ts comment "hardwoods wide, tropicals tight (GDD 3.3)":
    Confirms original implementation intent was HW widest, TR narrowest.
    This was set before SPECIES_PARAMS existed and reflects the same GDD 3.3 ordering.
    Source: packages/engine/src/species.ts (read directly)

VERIFIED -- BONSAI HORTICULTURAL SOURCES:
  ✓ Hokidachi/Broom style (Hardwood natural form): branches spread in all directions
    at 1/3 trunk height, forming a wide rounded crown. Best for deciduous species:
    elms, maples, zelkovas.
    Source: https://bonsai-arbor.com/mastering-hokidachi-your-guide-to-creating-a-broom-style-bonsai/
            https://cincinnatibonsai.org/broom-hokidachi

  ✓ Deciduous vs. conifer branching character (real horticultural comparison):
    "Deciduous and broadleaf species such as Elms, Maples and box should have
    predominantly naturally ascending branching... [deciduous] the movement of the
    branches is less steep and its tips face slightly upward."
    "Coniferous species such as Pines and Junipers are often seen with largely
    horizontal branching and clearly defined 'clouds' of foliage. For conifers,
    the angle remains almost constant. It is acute and the branch is directed towards
    base."
    Source: https://bonsaif4me.com/styling-the-basic-forms-of-bonsai/
            (Bonsai4Me, "The Basic Forms of Bonsai")
    INTERPRETATION: Deciduous (Hardwood) branches ascend outward with wide initial spread
    angles -- the fork from the trunk in broom form is VERY wide. Conifers have moderate
    but consistent horizontal angles -- medium fork spread.

  ✓ Cascade/Kengai style (Tropical natural form): "trunk growing upward slightly and
    then abruptly going down... alternating branches on the outermost curves of the trunk,
    with branches growing horizontally to maintain visual balance. A tall, narrow pot."
    Source: https://www.virginiabonsai.org/bonsai-styles/

  ✓ Literati/Bunjin style (Tropical natural form): "tall, lean trunk with foliage only
    at the top... extremely reduced number of branches... narrow, tapered foundation."
    Source: https://bonsaireview.com/bonsai-art-design/literati-bunjin-bonsai/
    INTERPRETATION: Sparse minimal branching, near-vertical orientation. Tight fork angles
    cause sub-branches to continue near-parallel to parent (amplifying cascade / vertical
    literati silhouette). GDD 3.3 "tighter clusters" matches this.

  ✓ Cedar bonsai (Evergreen): "majestic evergreens known for their stiff, needle-like
    foliage, rugged bark, and strong horizontal branching... naturally develop an elegant,
    layered look, which makes them ideal for formal upright and slanting bonsai styles."
    Source: https://www.bonsaiempire.com/tree-species/cedar

UNVERIFIED:
  ? Exact degree measurements for real juniper/pine branching angles: no horticultural
    source provided specific angle measurements in degrees. Searched; results were
    qualitative (horizontal, ascending, moderate, wide) rather than quantitative.
    Not a blocker -- GDD 3.3 is the design authority; real biology confirms ordering.

REFUTED:
  ✗ ARCH-BUG3 claim: "Tropical's widest spread (0.5-1.2 rad) aligns with DESIGN-SPECIES.md
    'dramatic, vertically extreme forms (Kengai/Bunjin)'"
    ACTUAL: 'vertically extreme' and 'sparse' Kengai/Bunjin forms require TIGHT fork angles
    so sub-branches continue near-parallel to parent, producing tall/cascade silhouettes.
    Wide fork angles (0.5-1.2 rad = 29-69 deg) produce the OPPOSITE: wide-spreading,
    bushy canopies -- the opposite of Kengai/Bunjin visual character.
    ARCH-BUG3 did not check GDD 3.3, which explicitly contradicts the ordering it accepted.
    Source: GDD 3.3 line 251 (read directly); DESIGN-SPECIES.md (read directly)

  ✗ Current SPECIES_PARAMS ordering (tropical = widest, evergreen = narrowest):
    Contradicts GDD 3.3 ("hardwoods: wider angles, tropicals: tighter clusters").
    Contradicts DESIGN-SPECIES.md ("wide branching angles" for Hardwood; Tropical natural
    form is sparse Kengai/Bunjin).
    Contradicts legacy species.ts comment ("hardwoods wide, tropicals tight (GDD 3.3)").
    All three independent sources agree the ordering is wrong.
    Source: GDD line 251, DESIGN-SPECIES.md, species.ts:13-17 (all read directly)
```

---

## CODE SOURCE AUDIT

No external code snippets used. All values are proposed from first principles based on:
- Legacy species.ts forkAngle as anchor points for center values
- GDD 3.3 / DESIGN-SPECIES.md for ordering constraint
- Real bonsai biology for visual validation

No snippet audit required.

---

## CROSS-REFERENCE CHECK

```
checked against:
  - docs/GDD.md (section 3.3, line 251 + species triangle section)
  - kijo-bonsai/docs/DESIGN-SPECIES.md (full document)
  - kijo-bonsai/docs/DESIGN-SPECIES-TECHNIQUE-ARCHETYPES.md (full document)
  - kijo-bonsai/DECISIONS.md (BUG-3 entry, species/branch decisions)
  - kijo-bonsai/docs/pipeline/ARCH-BUG3-SPECIES-DESCRIPTIONS-2026-08-07.md (full document)
  - packages/engine/src/species.ts (legacy design intent)

DISCREPANCIES FOUND:
  CRITICAL-1: GDD 3.3 line 251 says "hardwoods: wider angles, tropicals: tighter clusters".
    Current SPECIES_PARAMS has tropical as WIDEST (1.2 rad max) and evergreen as NARROWEST
    (0.4 rad max). This is a direct inversion of GDD intent.

  CRITICAL-2: ARCH-BUG3 accepted the wrong SPECIES_PARAMS ordering as truth and corrected
    UI copy to match it, without checking GDD 3.3. BUG-3's "corrected" UI hints now also
    contradict GDD 3.3. If SPECIES_PARAMS is corrected to match GDD, StoreModal.tsx hints
    need updating AGAIN (the BUG-3 fix is partially reversed).

  INFORMATIONAL-1: Jeremy (designer) believes Evergreen = widest spread. This also conflicts
    with GDD 3.3 (which says Hardwood = widest). The GDD was authored by Jeremy. This spec
    surfaces the conflict and defers to OQ-1 for owner confirmation.

  INFORMATIONAL-2: DESIGN-SPECIES-TECHNIQUE-ARCHETYPES.md archetype descriptions are
    internally consistent with GDD species identities (Hardwood=brawler, Tropical=glass
    cannon) but do not reference specific fork spread values. No action needed.

terminology: Consistent. "Hardwood / Evergreen / Tropical" throughout.
data shapes:  No shape change proposed. SpeciesParams interface unchanged.
boundaries:   Change is in packages/shared/src/index.ts only. No boundary violations.
```

---

## THE DESIGN

### Root Cause Summary

`SPECIES_PARAMS.forkSpreadMin/Max` has Tropical as the widest and Evergreen as the narrowest
species. The GDD (line 251) states the opposite: "hardwoods: wider angles, tropicals: tighter
clusters." The legacy `species.ts` (written before `SPECIES_PARAMS` existed) captured this
correctly as: hardwood=45deg, evergreen=30deg, tropical=20deg.

Separately, Jeremy believes Evergreen should be the widest (not Hardwood). This ALSO conflicts
with GDD 3.3. See OQ-1 -- Jeremy must confirm before implementation proceeds.

This spec proposes Option A (GDD-compliant correction) as the default. Option B (Jeremy's
instinct) is documented for comparison. Only one option is implemented; OQ-1 resolves which.

---

### Conversion reference

| radians | degrees |
|---------|---------|
| 0.10    |  5.7    |
| 0.25    | 14.3    |
| 0.30    | 17.2    |
| 0.50    | 28.6    |
| 0.65    | 37.2    |
| 0.70    | 40.1    |
| 0.785   | 45.0    |
| 1.00    | 57.3    |
| 1.20    | 68.8    |

---

### Option A -- GDD 3.3 compliant (RECOMMENDED)

Ordering: Hardwood widest, Evergreen middle, Tropical narrowest.
Anchored on legacy species.ts forkAngle values (45/30/20 deg) as center points.

| Species  | forkSpreadMin | forkSpreadMax | Center | Degrees range | Rationale |
|----------|---------------|---------------|--------|---------------|-----------|
| hardwood | 0.50          | 1.00          | 0.75   | 28.6 - 57.3   | Wide Hokidachi broom; anchored on legacy 45 deg (0.785 rad). Wide upper |
|          |               |               |        |               | range supports dramatic broom-style spreading. Within polar clamp [0.1, 1.4]. |
| evergreen| 0.30          | 0.70          | 0.50   | 17.2 - 40.1   | Moderate horizontal layered branching (cedar/juniper pads). Anchored |
|          |               |               |        |               | on legacy 30 deg (0.524 rad). Produces flowing Moyogi/Fukinagashi canopy. |
| tropical | 0.10          | 0.40          | 0.25   | 5.7  - 22.9   | Tight clusters; GDD 3.3 "tighter clusters". Anchored on legacy 20 deg |
|          |               |               |        |               | (0.349 rad). Tight fork angles cause sub-branches to continue near- |
|          |               |               |        |               | parallel to parent, amplifying cascade/literati vertical silhouette. |

Proposed change to packages/shared/src/index.ts lines 355-357:

```ts
// BEFORE (wrong -- tropical widest, evergreen narrowest):
hardwood:  { extensionMultiplier: 1.0, forkSpreadMin: 0.3, forkSpreadMax: 0.8, secondaryForkChance: 0.45, trunkMaturationRate: 0.05 },
evergreen: { extensionMultiplier: 0.8, forkSpreadMin: 0.1, forkSpreadMax: 0.4, secondaryForkChance: 0.35, trunkMaturationRate: 0.04 },
tropical:  { extensionMultiplier: 1.3, forkSpreadMin: 0.5, forkSpreadMax: 1.2, secondaryForkChance: 0.25, trunkMaturationRate: 0.06 },

// AFTER (Option A -- GDD 3.3 compliant, hardwood widest, tropical tightest):
hardwood:  { extensionMultiplier: 1.0, forkSpreadMin: 0.50, forkSpreadMax: 1.00, secondaryForkChance: 0.45, trunkMaturationRate: 0.05 },
evergreen: { extensionMultiplier: 0.8, forkSpreadMin: 0.30, forkSpreadMax: 0.70, secondaryForkChance: 0.35, trunkMaturationRate: 0.04 },
tropical:  { extensionMultiplier: 1.3, forkSpreadMin: 0.10, forkSpreadMax: 0.40, secondaryForkChance: 0.25, trunkMaturationRate: 0.06 },
```

NOTE: The proposed tropical values (0.10-0.40) are identical to the current evergreen values.
The proposed evergreen values (0.30-0.70) are close to (not identical to) the current hardwood
values. Hardwood gets an upward shift. This is not a pure three-way swap -- it is a deliberate
re-anchoring to the legacy 45/30/20 deg design intent.

---

### Option B -- Jeremy's instinct (requires GDD 3.3 errata, NOT recommended as default)

Ordering: Evergreen widest, Tropical middle, Hardwood moderate.
This ordering would require:
  1. Updating GDD 3.3 line 251 to say "evergreens: wider angles, hardwoods: moderate"
  2. Updating DESIGN-SPECIES.md to remove "Branching angles are wide" from Hardwood
  3. Reconsidering whether Hokidachi broom (Hardwood natural style) can achieve its
     wide-spreading visual with NARROWER fork angles (possible but harder to achieve)

| Species  | forkSpreadMin | forkSpreadMax | Degrees range |
|----------|---------------|---------------|---------------|
| evergreen| 0.50          | 1.00          | 28.6 - 57.3   |
| tropical | 0.25          | 0.70          | 14.3 - 40.1   |
| hardwood | 0.20          | 0.60          | 11.5 - 34.4   |

THIS OPTION IS DOCUMENTED FOR COMPLETENESS ONLY. The architect does not recommend it
because it contradicts two authoritative documents (GDD 3.3 and DESIGN-SPECIES.md) that
Jeremy himself authored. OQ-1 is the gate before any implementation proceeds.

---

### Visual logic: why tight fork angles produce vertically extreme forms

For Kengai (cascade): the trunk itself curves/descends. When child branches fork with TIGHT
angles (near 0), they continue nearly parallel to the parent direction -- amplifying the
cascade. Tight fork angles at each recursive level cause the whole tree to continue in the
direction of the trunk. This produces the dramatic downward cascade visual.

For Bunjin (literati): sparse, tall, minimal. Low secondaryForkChance (0.25) means few
secondary forks. Tight fork spread means the few branches that DO fork stay close to the
parent direction -- graceful, near-vertical sparse forms. NOT a bushy wide-spreading canopy.

Wide fork angles (current wrong tropical values 0.5-1.2 rad) produce a BUSHY SPREADING
canopy, which is the opposite of Kengai/Bunjin visual character. This is the visual
evidence that the current ordering is wrong.

---

### Parameters NOT changed

These params are correct per GDD/DESIGN-SPECIES.md intent:

| Param                | hardwood | evergreen | tropical | Verdict |
|----------------------|----------|-----------|----------|---------|
| extensionMultiplier  | 1.0      | 0.8       | 1.3      | CORRECT -- TR fastest matches GDD |
| secondaryForkChance  | 0.45     | 0.35      | 0.25     | CORRECT -- HW densest (broom) |
| trunkMaturationRate  | 0.05     | 0.04      | 0.06     | DEFINED but NEVER READ (GAP-1) |
| forkChance (species.ts) | 0.10  | 0.12      | 0.16     | CORRECT (TR most frequent forks) |

---

### Side effects -- Implementer must also address

SIDE-EFFECT-1 (REQUIRED): Rebuild dist after SPECIES_PARAMS change.
  packages/shared/dist/index.js:55-58 -- compiled copy, must regenerate via npm run build.
  packages/engine/dist/GrowthEngine.js -- compiled copy, rebuilt transitively.

SIDE-EFFECT-2 (REQUIRED): Regenerate golden fixtures.
  fixtures/hardwood_real.json and fixtures/tropical_real.json were built by running
  CareLogReplay --> Voxelizer --> StatDeriver. Branch angles will change, changing voxel
  positions, changing stat zone assignments, changing output stats.
  Command: node fixtures/generate.mjs (or equivalent per fixtures/README).
  All gate tests that check specific stat values (D1, etc.) must be re-run against
  regenerated fixtures. Gate tests checking structural properties (G6 branch count,
  A8/A9 attachmentY) should be unaffected (fork ANGLE changes, not fork CHANCE or
  attachment position).

SIDE-EFFECT-3 (REQUIRED): Update StoreModal.tsx species hints.
  apps/web/src/components/StoreModal.tsx SPECIES_OPTIONS hints (lines ~96, 101, 106)
  were already updated by ARCH-BUG3 to match the WRONG SPECIES_PARAMS ordering.
  After correcting SPECIES_PARAMS, those hints describe the wrong species again:
  - tropical "widest spread" is now FALSE (tropical becomes narrowest)
  - evergreen "tightest angles" is now FALSE (evergreen becomes middle)
  Correct hints after Option A SPECIES_PARAMS fix:
    hardwood:  "Steady growth, wide angles -- dense branching, brawler form"
               (unchanged from BUG-3 -- this hint was already correct in spirit)
    evergreen: "Moderate spread, layered -- flowing forms, pressure fighter"
               (replaces "Slow and compact -- tightest angles, consistent year-round")
    tropical:  "Tight clusters, fastest growth -- sparse vertically extreme, glass cannon"
               (replaces "Fastest growth, widest spread -- dramatic open form, glass cannon")
  NOTE: Implementer should update DECISIONS.md to note BUG-3 UI hints were partially
  reversed by this SPECIES_PARAMS correction.

SIDE-EFFECT-4 (INFORMATIONAL): On-chain / NFT data -- not affected.
  This is a pre-playtest, pre-mint change. No trees are on-chain. No care logs exist in
  production. All existing gate tests are run against regenerated fixtures. No stored
  TreeState on any chain references forkSpread values.

---

## ASSUMPTIONS

1. The one-file source of truth for SPECIES_PARAMS is packages/shared/src/index.ts lines
   354-358. The dist/ files are compiled output and must be rebuilt, not edited directly.
   NOT VERIFIED independently but consistent with all source file reads and import patterns.

2. fixtures/generate.mjs (or equivalent) still runs cleanly to regenerate golden fixtures.
   The fixture generation pipeline was verified as working in DECISIONS.md 2026-07-31 entry
   but has not been re-verified today. MITIGATION: Implementer runs generate.mjs and
   confirms exit 0 before marking done.

3. No test hardcodes the specific angular spread values (0.3, 0.8, etc.) as numeric
   literals in test assertions. If any test does, it will fail and must be updated.
   MITIGATION: Implementer greps for "0.3, 0.8" and "0.1, 0.4" and "0.5, 1.2" in
   packages/*/src/**/__tests__/ before proceeding.

4. The polar angle clamp [0.1, 1.4] rad (DECISIONS.md) applies to Branch.angle at render
   time, not to forkSpread at fork time. The proposed hardwood forkSpreadMax of 1.0 rad is
   within the [0.1, 1.4] render clamp. VERIFIED: clamp is in DECISIONS.md but not traced
   to specific code line in this recon pass. MITIGATION: Implementer confirms clamp applies
   at branch.angle level and that forkSpreadMax 1.0 produces valid branch.angle values.

5. OQ-1 is resolved by Jeremy before Implementer begins. If OQ-1 is resolved as Option B,
   the Implementer uses Option B values instead and the GDD 3.3 errata is written first.

---

## OPEN QUESTIONS

OQ-1 RESOLVED 2026-08-07: Jeremy confirmed Option A. Critic approved with required changes (C2, C4 addressed by Implementer).

OQ-1 (CRITICAL -- blocks implementation):
  GDD 3.3 line 251 says "hardwoods: wider angles, tropicals: tighter clusters."
  Jeremy's current instinct says Evergreen should be widest.
  These two positions conflict. Both conflict with current SPECIES_PARAMS (tropical widest).
  Three possible resolutions:

  RESOLUTION A (recommended): SPECIES_PARAMS is wrong; GDD 3.3 is correct.
    Fix SPECIES_PARAMS to match GDD (hardwood widest, tropical narrowest). GDD unchanged.
    Proceed with Option A values above.

  RESOLUTION B: Jeremy's instinct reflects a DESIGN REVISION not yet in GDD.
    Fix SPECIES_PARAMS to Jeremy's intent (evergreen widest) AND update GDD 3.3 + DESIGN-
    SPECIES.md to match. Proceed with Option B values above.

  RESOLUTION C: Jeremy confirms current SPECIES_PARAMS (tropical widest) is intentional.
    No change to SPECIES_PARAMS. The task was based on a false premise. Document and close.

  Jeremy must choose A, B, or C. Implementer does not proceed until OQ-1 is resolved.

OQ-2 (non-blocking, backlog):
  trunkMaturationRate is defined in SpeciesParams but never read by GrowthEngine. The
  thickeningPass hardcodes 0.05 (trunk) and 0.02 (inner). Should trunkMaturationRate be
  wired into thickeningPass? This would make trunk thickening species-differentiated.
  Currently: tropical grows fastest (extensionMultiplier 1.3) but thickens at the same
  rate as hardwood. May or may not be intended. Out of scope for this task.

OQ-3 (non-blocking, backlog):
  species.ts::forkAngle is dead code in GrowthEngine. Should it be deleted to prevent
  future confusion (another BUG-3-class error where UI/docs are written against it)?
  Or preserved as documentation of intent? Recommend deletion with a comment in
  SPECIES_PARAMS referencing GDD 3.3. Out of scope for this task.

---

## DONE WHEN (criteria for Critic, then Implementer, then Auditor)

AFTER OQ-1 resolved as Option A:
  1. packages/shared/src/index.ts SPECIES_PARAMS shows:
       hardwood:  forkSpreadMin:0.50, forkSpreadMax:1.00
       evergreen: forkSpreadMin:0.30, forkSpreadMax:0.70
       tropical:  forkSpreadMin:0.10, forkSpreadMax:0.40
  2. packages/shared/dist/index.js reflects new values (npm run build completed)
  3. StoreModal.tsx species hints updated (SIDE-EFFECT-3)
  4. fixtures regenerated, gate tests pass with new fixtures
  5. DECISIONS.md updated noting BUG-3 UI hints partially reversed by this fix
  6. Polar angle clamp confirmed: hardwood forkSpreadMax 1.00 does not produce
     branch.angle values outside [0.1, 1.4] range under normal growth

---

*Sources:*
*- GDD 3.3 line 251: docs/GDD.md (read directly)*
*- DESIGN-SPECIES.md: kijo-bonsai/docs/DESIGN-SPECIES.md (read directly)*
*- species.ts comment: packages/engine/src/species.ts (read directly)*
*- Hokidachi broom style: https://bonsai-arbor.com/mastering-hokidachi-your-guide-to-creating-a-broom-style-bonsai/*
*- Deciduous vs. conifer branching: https://bonsai4me.com/styling-the-basic-forms-of-bonsai/*
*- Cascade/Kengai style: https://www.virginiabonsai.org/bonsai-styles/*
*- Literati/Bunjin style: https://bonsaireview.com/bonsai-art-design/literati-bunjin-bonsai/*
*- Cedar bonsai horizontal branching: https://www.bonsaiempire.com/tree-species/cedar*
