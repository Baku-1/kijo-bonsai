# ARCH — BUG-3: Species Descriptions Inverted in StoreModal

**Date:** 2026-08-07  
**Stage:** ARCHITECT  
**Bug:** Species hints in `StoreModal.tsx` describe the wrong growth behavior for each species  
**Status:** READY FOR IMPLEMENTER

---

## DESIGN TASK

```
DESIGN TASK:  Produce correct one-line species descriptions for the StoreModal species picker
              that accurately reflect SPECIES_PARAMS behavior and DESIGN-SPECIES.md philosophy.
DELIVERABLE:  Corrected hint strings for SPECIES_OPTIONS in StoreModal.tsx + this spec.
BUILDS ON:    packages/shared/src/index.ts (SPECIES_PARAMS), docs/DESIGN-SPECIES.md
CONSUMED BY:  Implementer patching StoreModal.tsx; Auditor verifying the patch.
```

---

## CODEBASE RECONNAISSANCE

```
files read:
  - packages/shared/src/index.ts          (SPECIES_PARAMS source of truth)
  - packages/engine/src/GrowthEngine.ts   (how SPECIES_PARAMS is consumed)
  - packages/engine/src/species.ts        (legacy SPECIES — forkChance still used here)
  - apps/web/src/components/StoreModal.tsx (the UI with the wrong descriptions)
  - apps/web/src/components/SeedShopModal.tsx (deprecated — confirmed not rendered)
  - apps/web/src/App.tsx                  (confirmed StoreModal is the live render)
  - docs/DESIGN-SPECIES.md               (authoritative design intent)

symbols verified:
  ✓ SPECIES_PARAMS   — exists in packages/shared/src/index.ts:354, exported: yes
  ✓ SpeciesParams    — interface at packages/shared/src/index.ts:346, exported: yes
  ✓ SPECIES_OPTIONS  — const at StoreModal.tsx:92, local (not exported)
  ✓ SPECIES          — const at packages/engine/src/species.ts:14, exported: yes
                        (forkChance is used; forkAngle is NOT used by GrowthEngine)
  ✓ StoreModal       — rendered in App.tsx:21, the only active species picker in the UI
  ✗ SeedShopModal    — deprecated, not imported anywhere except its own file;
                        no species descriptions to fix there

call sites found:
  SPECIES_PARAMS: 2 call sites in GrowthEngine.ts
    - GrowthEngine.ts:45 — sp.extensionMultiplier (calculateGrowthRate)
    - GrowthEngine.ts:65 — sp.secondaryForkChance, sp.forkSpreadMin/Max (extendAndFork)
  SPECIES (legacy): 1 call site in GrowthEngine.ts
    - GrowthEngine.ts:66 — spE.forkChance (drives fork probability per tip per tick)
  SPECIES_OPTIONS: 1 usage in StoreModal.tsx
    - StoreModal.tsx:392 — .map() rendering the species picker buttons

gaps found:
  - trunkMaturationRate is defined in SPECIES_PARAMS but GrowthEngine.thickeningPass()
    uses hardcoded 0.05 (trunk) and 0.02 (inner), NOT the species param. Thickening rate
    is therefore NOT species-differentiated in the current engine. This is a pre-existing
    issue outside BUG-3 scope — noted, not fixed here.
  - species.ts::forkAngle field has a comment "hardwoods wide, tropicals tight (GDD §3.3)"
    but forkAngle is NEVER READ by GrowthEngine. The comment describes legacy intent that
    contradicts what SPECIES_PARAMS actually implements.
```

---

## VERIFICATION LOG

```
VERIFIED:
  ✓ SPECIES_PARAMS.forkSpreadMin/Max ordering
      hardwood:  0.3–0.8 rad (17.2°–45.8°)
      evergreen: 0.1–0.4 rad ( 5.7°–22.9°)  ← NARROWEST
      tropical:  0.5–1.2 rad (28.6°–68.8°)  ← WIDEST
      Source: packages/shared/src/index.ts:355-357 (read directly)

  ✓ SPECIES_PARAMS.extensionMultiplier ordering (growth speed)
      hardwood:  1.0  (baseline)
      evergreen: 0.8  (slowest)
      tropical:  1.3  (fastest)
      Source: packages/shared/src/index.ts:355-357

  ✓ SPECIES_PARAMS.secondaryForkChance (double-branch probability at each fork event)
      hardwood:  0.45 (highest — most likely to spawn 2 children at a fork)
      evergreen: 0.35 (middle)
      tropical:  0.25 (lowest — forks are mostly single-child)
      Source: packages/shared/src/index.ts:350 (comment confirms HW/EG/TR values)

  ✓ SPECIES.forkChance (base fork probability per tip per tick, from legacy species.ts)
      hardwood:  0.10 (least frequent fork events)
      evergreen: 0.12 (middle)
      tropical:  0.16 (most frequent fork events)
      Source: packages/engine/src/species.ts:15-17

  ✓ GrowthEngine uses forkSpreadMin/Max from SPECIES_PARAMS (not forkAngle from SPECIES)
      GrowthEngine.ts:98: spread = sp.forkSpreadMin + angleRng.next() * (sp.forkSpreadMax - sp.forkSpreadMin)
      species.ts forkAngle field is never read by GrowthEngine.
      Source: GrowthEngine.ts:88-98 (read directly)

  ✓ Current UI hints in StoreModal.tsx:93-107 (read directly):
      hardwood:  "Upright, dense -- wide forked branches"
      evergreen: "Flexible, layered -- asymmetric reach"
      tropical:  "Tight clusters, fast-growing -- aerial complexity"

  ✓ DESIGN-SPECIES.md is authoritative (header says "AUTHORITATIVE", confirmed by Jeremy)
      Hardwood:  "wide branching angles", "Chokkan/Hokidachi broom form", "brawler"
      Evergreen: "steady year-round", "Moyogi/Fukinagashi", "pressure fighter"
      Tropical:  "explosive summer growth", "Kengai/Bunjin cascade", "glass cannon"
      Source: docs/DESIGN-SPECIES.md (read directly)

REFUTED:
  ✗ "tropical has tight clusters" (current UI)
      Actual: tropical has the WIDEST fork spread (0.5–1.2 rad = 29°–69°).
      This claim was written against species.ts::forkAngle:20 (tight) which GrowthEngine
      does not use. The operative parameter is SPECIES_PARAMS.forkSpreadMax = 1.2.

  ✗ "evergreen has asymmetric reach" (current UI)
      Actual: evergreen has the NARROWEST fork spread (0.1–0.4 rad = 6°–23°), producing
      the most compact, upright form — not a "reaching" silhouette.

  ✗ "hardwood has wide forked branches" (current UI — misleading)
      Partially wrong: hardwood is middle in spread (0.3–0.8 rad). The truly distinctive
      hardwood trait is secondaryForkChance = 0.45 (highest — branches most often double
      at each fork node), which produces density, not spread width. Tropical actually has
      the widest spread.
```

---

## ROOT CAUSE

The `SPECIES_OPTIONS.hint` strings in `StoreModal.tsx` were authored against the legacy
`species.ts::forkAngle` field, which carries this comment:

```ts
forkAngle: number;   // degrees; hardwoods wide, tropicals tight (GDD §3.3)
```

That legacy field ordered: hardwood = 45° (wide) > evergreen = 30° > tropical = 20° (tight).

`SPECIES_PARAMS` in `@kijo/shared` — the actual driver of fork spread in GrowthEngine —
has the **opposite ordering** for spread:

```
tropical = 1.2 rad (widest)  >  hardwood = 0.8 rad  >  evergreen = 0.4 rad (narrowest)
```

`GrowthEngine.ts:98` reads `sp.forkSpreadMin/Max` from `SPECIES_PARAMS` exclusively.
`species.ts::forkAngle` is never read. The descriptions are inverted.

---

## CROSS-REFERENCE CHECK

```
checked against: docs/DESIGN-SPECIES.md, packages/shared/src/index.ts
consistent:      YES — DESIGN-SPECIES.md says Tropical grows with "dramatic, vertically
                 extreme forms" (Kengai/Bunjin) and is the fastest class, which aligns
                 with SPECIES_PARAMS tropical (1.3× extension, widest spread 0.5–1.2 rad).
                 DESIGN-SPECIES.md says Evergreen is "most predictable" and "steady," which
                 aligns with slowest extension (0.8×) and narrowest spread (0.1–0.4 rad).
                 DESIGN-SPECIES.md says Hardwood has "wide branching angles" and tends
                 toward "Chokkan/Broom" — consistent with moderate-wide spread (0.3–0.8 rad)
                 and highest secondaryForkChance (0.45) producing dense node structure.
terminology:     Aligned. "Hardwood / Evergreen / Tropical" (title case) per GDD canon.
boundary:        No cross-package boundary violations. This is a UI string change only.
```

---

## THE DESIGN

### What the UI currently says vs. what is correct

| Species | Current (WRONG) hint | Behavior per SPECIES_PARAMS | DESIGN-SPECIES.md identity |
|---|---|---|---|
| Hardwood | "Upright, dense -- wide forked branches" | extensionMultiplier 1.0, forkSpread 17°–46°, secondaryForkChance 0.45 (highest density), forkChance 0.10 (least frequent) | Brawler; wide angles; Chokkan/Hokidachi broom form |
| Evergreen | "Flexible, layered -- asymmetric reach" | extensionMultiplier 0.8 (slowest), forkSpread 6°–23° (NARROWEST), secondaryForkChance 0.35 | Pressure fighter; steady; Moyogi/Fukinagashi |
| Tropical | "Tight clusters, fast-growing -- aerial complexity" | extensionMultiplier 1.3 (fastest), forkSpread 29°–69° (WIDEST), secondaryForkChance 0.25 (sparse nodes), forkChance 0.16 (most frequent) | Burst/glass cannon; explosive; Kengai/Bunjin cascade |

### Correct replacement hints

These are one-liner `hint` strings for `SPECIES_OPTIONS` in `StoreModal.tsx`. Format matches
the existing pattern: `"[growth character] -- [distinctive trait, combat identity]"`.

```ts
// BEFORE (wrong — written against legacy species.ts::forkAngle which GrowthEngine ignores):
{ value: "hardwood",  hint: "Upright, dense -- wide forked branches" },
{ value: "evergreen", hint: "Flexible, layered -- asymmetric reach" },
{ value: "tropical",  hint: "Tight clusters, fast-growing -- aerial complexity" },

// AFTER (correct — reflects SPECIES_PARAMS and DESIGN-SPECIES.md):
{ value: "hardwood",  hint: "Steady growth, wide angles -- dense branching, brawler form" },
{ value: "evergreen", hint: "Slow and compact -- tightest angles, consistent year-round" },
{ value: "tropical",  hint: "Fastest growth, widest spread -- dramatic open form, glass cannon" },
```

**Rationale per species:**

**Hardwood** — "Steady growth, wide angles -- dense branching, brawler form"  
`extensionMultiplier: 1.0` (baseline — "steady"), `forkSpreadMax: 0.8` (second-widest at 46° — "wide angles"),
`secondaryForkChance: 0.45` (highest — "dense branching" because most forks produce 2 children).
"brawler form" matches DESIGN-SPECIES.md combat identity. `forkChance: 0.10` means fork events are
least frequent but prolific when they occur — reinforcing density over sprawl.

**Evergreen** — "Slow and compact -- tightest angles, consistent year-round"  
`extensionMultiplier: 0.8` (slowest — "slow"), `forkSpreadMax: 0.4` (narrowest at 23° — "compact,
tightest angles"). "consistent year-round" reflects DESIGN-SPECIES.md's "no seasonal leaf loss,
consistent growth rate" and the steady pressure fighter identity. `secondaryForkChance: 0.35` (middle)
and `forkChance: 0.12` (middle) — no unusual trait to highlight beyond tightness and consistency.

**Tropical** — "Fastest growth, widest spread -- dramatic open form, glass cannon"  
`extensionMultiplier: 1.3` (fastest — "fastest growth"), `forkSpreadMax: 1.2` (widest at 69° — "widest
spread, dramatic open form"), `secondaryForkChance: 0.25` (lowest — forks tend to be single branches,
contributing to the "sparse, vertically extreme" Kengai/Bunjin silhouette in DESIGN-SPECIES.md).
`forkChance: 0.16` (most frequent) means many fork events, but each typically produces one branch —
wide, dramatic, not clustered. "glass cannon" matches DESIGN-SPECIES.md burst/combat identity.

---

## FILE TO CHANGE

**One file. One constant. Three strings.**

```
apps/web/src/components/StoreModal.tsx
  Constant:  SPECIES_OPTIONS (line 92)
  Field:     hint (string) on each of the 3 species entries (lines 96, 101, 106)
  Change:    Replace all three hint strings per the AFTER block above
```

No other files require changes. `SeedShopModal.tsx` is deprecated and not rendered — do NOT
touch it. `packages/shared/src/index.ts` and `packages/engine/src/species.ts` are out of scope
(the bug is in the UI copy, not in the engine values).

---

## DONE WHEN (criteria for Implementer and Auditor)

1. `SPECIES_OPTIONS` in `StoreModal.tsx` has exactly these three hint values, character-for-character:
   - `hardwood`:  `"Steady growth, wide angles -- dense branching, brawler form"`
   - `evergreen`: `"Slow and compact -- tightest angles, consistent year-round"`
   - `tropical`:  `"Fastest growth, widest spread -- dramatic open form, glass cannon"`

2. No other strings, constants, or logic in `StoreModal.tsx` were changed.

3. `SeedShopModal.tsx` is untouched.

4. The description for **tropical** no longer contains the word "tight" or "cluster".

5. The description for **evergreen** no longer contains "reach" or "asymmetric".

6. The description for **hardwood** accurately reflects wide angles AND density (not just "wide").

---

## ASSUMPTIONS

1. **The hint strings are the only species-facing UI copy.** Confirmed by grep — no other
   `.tsx`/`.ts` file in `apps/web/src/` contains user-visible species description text
   beyond ThreeCanvas.tsx and renderer/tree_mesh.ts (which contain no descriptions, only
   color/species switch logic).

2. **`trunkMaturationRate` mismatch is out of scope.** GrowthEngine hardcodes maturation
   rates (0.05 trunk / 0.02 inner) and does not read `SPECIES_PARAMS.trunkMaturationRate`.
   This is a pre-existing issue. BUG-3 scope is descriptions only.

3. **`species.ts::forkAngle` is dead code in the engine context.** It is defined and has a
   comment referencing GDD §3.3 but `GrowthEngine.ts` never reads it. No spec change needed
   here; however the Implementer should NOT add a code comment saying forkAngle drives
   fork spread — it does not.

---

## OPEN QUESTIONS

None that block implementation. The Implementer has exact replacement strings and a single file.

*(Post-launch note for backlog: A follow-up task should investigate whether `trunkMaturationRate`
in `SPECIES_PARAMS` is intended to be wired into `GrowthEngine.thickeningPass()` — currently
it is defined but never read. This could be an unintentional hardcode or a deliberate design
decision. Out of scope for BUG-3.)*
