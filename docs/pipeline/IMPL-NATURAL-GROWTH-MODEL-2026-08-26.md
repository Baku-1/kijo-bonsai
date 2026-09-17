# IMPL: Natural Growth Model — Continuous Extension with Apical Dominance

**Date:** 2026-08-26
**Author:** Claude (Implementer stage)
**Skills applied:** disciplined-implementer, carmack-linus-review
**Architect spec:** `docs/pipeline/ARCH-NATURAL-GROWTH-MODEL-2026-08-26.md`
**Critic doc:** `docs/pipeline/CRITIC-NATURAL-GROWTH-MODEL-2026-08-26.md`
**Status:** IMPLEMENTATION COMPLETE

---

## OUTCOME

`GrowthEngine.extendAndFork` revised to implement continuous parent extension with apical dominance. All non-pruned branches now extend every tick at role-modulated rates. Exponential depth falloff replaces linear. Four new species params added. G1-G6 gates pass. Determinism verified. tsc clean.

---

## DONE WHEN (all met)

- [x] `node packages/engine/test_growth.mjs` — G1-G6 all pass (6/6, 0 failures)
- [x] G4 determinism: two runs produce identical totalMass (13187.6718 = 13187.6718)
- [x] `npx tsc --noEmit` exits 0 on both `packages/shared` and `packages/engine`
- [x] Diff scoped to 4 files: `shared/src/index.ts`, `engine/src/GrowthEngine.ts`, `DECISIONS.md`, this IMPL doc

---

## WHAT CHANGED

### 1. `packages/shared/src/index.ts`

**SpeciesParams interface (FINDING-7):** Added 4 fields:
- `apicalDominance: number` — leader-tip preference strength (Palubicki 2009 / Borchert-Honda)
- `depthFalloffBase: number` — exponential depth falloff base (resolves R9)
- `parentExtensionRate: number` — inner branch extension multiplier
- `trunkContinuedRate: number` — trunk extension after first fork (tech spec §4.2 line 249)

**SPECIES_PARAMS entries:** Added values for all 3 species:

| Field | Hardwood | Evergreen | Tropical |
|---|---|---|---|
| apicalDominance | 0.65 | 0.80 | 0.45 |
| depthFalloffBase | 0.72 | 0.68 | 0.78 |
| parentExtensionRate | 0.20 | 0.15 | 0.30 |
| trunkContinuedRate | 0.25 | 0.20 | 0.35 |

### 2. `packages/engine/src/GrowthEngine.ts`

**New private static `isLeaderChild(b, branches)`:** Returns true if `b` is the longest living sibling of its parent. Trunk always leader. Tiebreaker: lowest array index wins (FINDING-3 — documented in code comment).

**Revised `extendAndFork`:**

- **Depth falloff:** Changed from `Math.max(0.1, 1.0 - b.depth * 0.15)` to `round4(sp.depthFalloffBase ** b.depth)`. Exponential, species-specific.
- **RNG + sp hoisted:** `rng`, `sp`, `depthFalloff` computed before the tip/inner branch, so both paths share them.
- **Tip path (FINDING-1):** Added `isLeaderChild` check. Subordinate tips get `* round4(1.0 - sp.apicalDominance * 0.5)` multiplier. Leader tips get full rate (1.0).
- **Inner path (new):** `else` block for `living.length > 0`. Role-based rate: trunk=`trunkContinuedRate`, leader=`parentExtensionRate`, subordinate=`parentExtensionRate * (1.0 - apicalDominance * 0.5)`. Base range `(0.8 + rng.next() * 0.4)`. Inner branches do NOT fork.
- **RNG transition note (FINDING-8):** Code comment documenting rng consumption on tip→inner transition tick.
- **No cap on inner extension (OQ-4):** Documented in code comment — exponential falloff naturally reduces it.

**Unchanged:** `growTick` signature, `thickeningPass`, `calculateGrowthRate`, fork logic internals (threshold, probability, child allocation, one-third rule, attachmentY). Pre-order recursion order unchanged.

### 3. `DECISIONS.md`

Three new entries under `## 2026-08-26`:
1. Apical dominance model — full description of the design, species values, references
2. Exponential depth falloff — R9 RESOLVED, supersedes 2026-07-15 linear entry
3. Cross-version determinism break — testnet only, no migration, accepted (FINDING-2)

### 4. This IMPL doc

---

## VERIFIED BY OBSERVATION

```
G1 — Trunk matures
  trunk thickness: Day 1=2, Day 200=4.2831
  ✓ trunk thickness grows over 200 days
G2 — ID integrity
  ✓ ID integrity held for all 200 days
G3 — Leonardo holds
  ✓ Leonardo rule holds (0 violations)
G4 — DETERMINISM
  Run 1 totalMass=13187.6718, Run 2 totalMass=13187.6718
  ✓ identical totalMass after 200 days on same seed
G5 — Depth bound
  max depth: 5
  ✓ no branch exceeds depth 6
G6 — No explosion
  final branch count: 16
  ✓ branch count in sane range [5, 200]

6 passed, 0 failed
```

Second independent run: identical totalMass 13187.6718. Cross-run determinism confirmed.

`npx tsc --noEmit` — exits 0 on both `packages/shared/tsconfig.json` and `packages/engine/tsconfig.json`.

---

## INTENT CHECK

```
INTENT CHECK
  task says:       Implement natural growth model per architect spec, incorporating ALL critic findings
  code now does:   Inner branches extend at role-modulated rates; exponential depth falloff; subordinate tips suppressed
  spec required:   §4.1 five roles, §4.2 pseudocode, §4.3 four new params, §4.4 exponential falloff
  critic required: FINDING-1 (subordinate tips ✓), FINDING-2 (cross-version doc ✓),
                   FINDING-3 (tiebreaker ✓), FINDING-7 (interface ✓), FINDING-8 (RNG note ✓)
  verdict:         ALIGNED — all MUST-incorporate critic findings addressed
```

---

## CRITIC FINDINGS — DISPOSITION

| Finding | Severity | Status | How addressed |
|---|---|---|---|
| FINDING-1 | MAJOR | ✅ DONE | `isLeaderChild` added to tip path; subordinate tips get `* round4(1.0 - sp.apicalDominance * 0.5)` |
| FINDING-2 | MAJOR | ✅ DONE | DECISIONS.md entry documents cross-version break, testnet-only, re-render SQL provided |
| FINDING-3 | MINOR | ✅ DONE | Code comment: "lowest array index wins on equal length" |
| FINDING-7 | MINOR | ✅ DONE | SpeciesParams interface updated with 4 new fields |
| FINDING-8 | MINOR | ✅ DONE | Code comment in inner-branch block about RNG consumption on tip→inner transition |

---

## CAVEATS

1. **Fixture values changed (expected):** Day-200 hardwood seed 464497 totalMass went from ~6,752 (pre-change, inferred from prior V2 8,797 voxels) to 13,187.67. Branch count: 16 (was ~16). Downstream fixtures (V-suite, D-suite) will need re-recording when those test suites are run.
2. **Server bundle not rebuilt:** `apps/server/supabase/functions/_shared/kijo-engine.js` must be rebuilt before deploying. Not in scope per task instructions ("WHAT NOT TO CHANGE").
3. **Species param values are starting points:** All 4 new params flagged for playtest tuning in DECISIONS.md. Community tuning after playtesting (OQ-3 resolved).
4. **FINDING-4 advisory (evergreen 0.80):** Evergreen apical dominance may produce overly excurrent shapes. Monitor visually. Not a code issue — param tuning.
