# AUDIT: ARCHITECT-STATSHEET-DEFENSE-STABILITY.md (post-patch)

**Stage:** ADVERSARIAL AUDITOR  
**Date:** 2026-07-30  
**Spec audited:** `docs/ARCHITECT-STATSHEET-DEFENSE-STABILITY.md`  
**Patch audited:** `docs/pipeline/PATCH-ARCHITECT-STATSHEET-2026-07-29.md`  
**Critic findings audited:** `docs/pipeline/CRITIC-STATSHEET-DEFENSE-STABILITY.md`  
**Source docs verified:** `docs/ADR-STATSHEET-DEFENSE-STABILITY.md`, `docs/CANONICAL-STYLES.md`, `docs/DESIGN-CARETAKER-OPACITY.md`, `packages/engine/src/StatTerrain.ts`

---

## Method

Every claim was verified against the actual files. No claim from the patch summary was accepted as evidence of its own truth. Findings are keyed to specific line numbers.

---

## MAJOR — BLOCKER 2 Incompletely Patched: Summary Table Still Says "×2 Occurrences"

**Severity: MAJOR**  
**Location:** `ARCHITECT-STATSHEET-DEFENSE-STABILITY.md` line 459, Summary of All Changes, StatTerrain.ts row  
**Evidence:**

Spec body (line 220) now correctly reads:
> "These are the only **three** occurrences of `% 6` in the file. Change **all three**."

Summary table (line 459) still reads:
> `` `hash % 6` → `hash % 8` **(×2 occurrences: comment + code)** ``

These two statements are in the same document and directly contradict each other.

The BLOCKER 2 patch fixed the explicit claim text and the STAT_TYPES Before/After blocks, but did not update the Summary table. An implementer using the summary as a quick reference — which is its stated purpose — will still change only 2 of the 3 occurrences.

**Observed state of StatTerrain.ts** (independently verified by grepping the file):
- Line 79: `// STAT_TYPES — six-bucket ordered list; index must be stable (hash % 6)` ← third occurrence
- Line 147: `//   2. bucket = h % 6 → StatType`
- Line 155: `const bucket = hash % 6;`

Count: **3 occurrences**. "×2 occurrences" in the summary is wrong.

This is a partial patch failure. BLOCKER 2 is not fully resolved.

---

## PASS — BLOCKER 1: Stability Comment Corrected

**Location:** Spec line 131  
**Observed:** `stability: number;  // knockdown/knockback reduction — terrain-only; no structural (Layer 1) source`  
Matches patch description. Previous text (citing ROOT_STABILITY_MULT) is gone. ✓

---

## PASS — MAJOR 1: Summary Table StructuralStats Cell Corrected

**Location:** Spec line 460  
**Observed:** "StructuralStats: +defense only. Stability intentionally excluded — terrain-only stat, same pattern as skillPoints."  
Previous text ("+defense, +stability") is gone. ✓

---

## PASS — MAJOR 2: Summary Table deriveStructural Cell Corrected

**Location:** Spec line 460  
**Observed:** "deriveStructural: +1 counter (scarVoxels), +1 switch case (VoxelRole.SCAR), +1 return field (defense). No stability additions — terrain-only."  
Previous text ("+2 counters, +2 switch cases, +2 return fields") is gone. ✓

---

## PASS — MAJOR 3: Summary Table Constants Cell Corrected

**Location:** Spec line 460  
**Observed:** "1 new module-level constant (SCAR_DEFENSE_MULT)."  
Previous text ("2 new module-level constants") is gone. ✓

---

## PASS — MAJOR 4: DO NOT CHANGE STYLE_SPLINES Entry Corrected

**Location:** Spec line 437  
**Observed:**
- Duplicate "`STYLE_SPLINES` / `STYLE_SPLINES`" name removed — now reads "`STYLE_SPLINES` array in StatTerrain.ts"
- Sekijoju TODO removal instruction present: "DO remove the `// TODO: 7 — Sekijoju (root over rock)` comment line"
- "Remaining 6 entries" update instruction present
- ADR reconciliation note present: "reconcile against CANONICAL-STYLES.md before implementing"

All four sub-changes from the patch are applied. ✓

---

## PASS — % 6 Occurrence Count Verified

**Claim:** "These are the only three occurrences of `% 6` in the file." (spec line 220)  
**Observed by direct grep of `packages/engine/src/StatTerrain.ts`:**

| Line | Content |
|---|---|
| 79 | `// STAT_TYPES — six-bucket ordered list; index must be stable (hash % 6)` |
| 147 | `//   2. bucket = h % 6 → StatType` |
| 155 | `const bucket = hash % 6;` |

Exactly 3 occurrences. Claim is correct. ✓

---

## PASS — Defense/Stability Structural Source: Internally Consistent

All instances in the spec agree: defense has a Layer 1 structural source (SCAR voxels × SCAR_DEFENSE_MULT); stability is terrain-only with no Layer 1 source.

Checked at:
- Line 47: "Stability is terrain-only at Layer 1 … no structural source, terrain source only." ✓
- Line 57-58: SCAR → Defense (small) | Layer 1 NEW; ROOT → — | (none — terrain only) ✓
- Line 131: stability comment "terrain-only; no structural (Layer 1) source" ✓
- Lines 250-262: StructuralStats interface has `defense` but NOT `stability`; comment explains why ✓
- Lines 332-342: deriveStructural return has `defense`, no `stability`; comment explains ✓
- Lines 409-421: derive return: `defense = structural.defense + terrain.defense`; `stability = terrain.stability` ✓
- Line 460: Summary table — consistent with all of the above ✓

No contradictions found. The defense/stability structural source distinction is consistently stated throughout the spec.

---

## PASS — DESIGN-CARETAKER-OPACITY.md: App.tsx Not Touched

Spec scope is `packages/shared/src/index.ts`, `packages/engine/src/StatTerrain.ts`, `packages/engine/src/StatDeriver.ts`. App.tsx, ThreeCanvas, and CareHud are not referenced anywhere in the change instructions. The spec does not violate this constraint. ✓

---

## PASS — CANONICAL-STYLES.md: 7 Styles Only, Sekijoju Banned

The spec's STAT_TYPES array (8 entries: hp, power, endurance, ki, skill_point, defense, stability, neutral) is the stat terrain bucket list, not the style list. These are independent. The style count (`seed % 7`) is correctly deferred and flagged for the spline implementation PR.

The spec does NOT add Sekijoju to STAT_TYPES or any style-selection logic. ✓

DO NOT CHANGE instruction (line 437) directs removal of the Sekijoju TODO line from `STYLE_SPLINES`. ✓

---

## MINOR — Critic MINOR 1 Not Addressed: "Sekijoju" Named in Spec Body

**Location:** Spec line 43  
**Observed:** Spec body explicitly names "Sekijoju" twice in the §Open Question Resolution section, using it to explain why ROOT→Stability was rejected.

CANONICAL-STYLES.md, §What Is NOT In Scope: "Remove from all documents."

The patch made no attempt to address this. The reasoning is correct — this doesn't cause wrong implementation — but the document violates the authoritative ban.

**Note:** The ADR also names "Sekijoju" repeatedly (lines 49, 131). The "remove from all documents" requirement is broadly unenforced across the pipeline documents.

---

## MINOR — Critic MINOR 3 Not Addressed: Block Comment Line Reference Off by One

**Location:** Spec line 291  
**Observed:** "Update the block comment at line 71-75 (the comment documenting what DIGIT/ROOT/SCAR do)"

**Actual file (StatDeriver.ts):**
- Line 71: blank
- Line 72: `//   DIGIT, ROOT, SCAR → no structural stat`

The target text is at line 72, not 71. The patch made no attempt to fix this. Navigational error for the implementer.

---

## MINOR — Critic MINOR 5 Not Addressed: splineForSeed() Stale Comments Not Flagged

**Location:** `packages/engine/src/StatTerrain.ts` lines 69-74 (verified by reading the file); spec DO NOT CHANGE list  
**Observed:** `splineForSeed()` JSDoc comment says "style index = seed % 8" and "remaining 7 styles" — both stale per CANONICAL-STYLES.md (7 styles total, 6 remaining, `seed % 7`). The spec's DO NOT CHANGE list does not flag these as known stale. Future implementer has no warning.

---

## MINOR — ADR Internal Inconsistency (Pre-existing, Not Introduced by Patch)

**Location:** `docs/ADR-STATSHEET-DEFENSE-STABILITY.md` §Impact on StatDeriver, item 1  
**Observed:** "Add `defense` and `stability` to `StructuralStats` and `TerrainBonuses` interfaces"

The ADR's own resolution (two paragraphs later) says "ROOT voxels → NO structural contribution. Stability is terrain-only." Stability should NOT be in StructuralStats. The spec correctly implements the resolution. But ADR item 1 is wrong and will mislead any implementer who skims only the decision list without reading the resolution.

This is a pre-existing error in the ADR, not introduced by the patch.

---

## Summary

| Severity | Finding | Status |
|---|---|---|
| MAJOR | BLOCKER 2 incompletely patched: Summary table (line 459) still says "×2 occurrences: comment + code" for `hash % 6` — contradicts body fix (line 220, "three occurrences … all three") | **OPEN — requires fix** |
| PASS | BLOCKER 1: stability comment corrected | ✓ |
| PASS | MAJOR 1: Summary StructuralStats cell corrected | ✓ |
| PASS | MAJOR 2: Summary deriveStructural cell corrected | ✓ |
| PASS | MAJOR 3: Summary constants cell corrected | ✓ |
| PASS | MAJOR 4: DO NOT CHANGE STYLE_SPLINES scoped correctly | ✓ |
| PASS | % 6 count in StatTerrain.ts: exactly 3 (lines 79, 147, 155) | ✓ |
| PASS | defense/stability structural source consistent throughout spec | ✓ |
| PASS | App.tsx not touched | ✓ |
| PASS | CANONICAL-STYLES.md 7-style constraint respected | ✓ |
| MINOR | Critic MINOR 1 not addressed: "Sekijoju" named in spec body (line 43) | Known gap |
| MINOR | Critic MINOR 3 not addressed: block comment line ref "71-75" should be "72" (line 291) | Known gap |
| MINOR | Critic MINOR 5 not addressed: splineForSeed() stale comments unflagged | Known gap |
| MINOR | ADR §Impact on StatDeriver item 1 says add stability to StructuralStats — wrong, pre-existing | Pre-existing |

---

## Required Action

The spec must not be handed to the implementer as-is. The Summary table still says "×2 occurrences" for `hash % 6` while the body says "three occurrences." This is the exact failure mode that BLOCKER 2 was supposed to fix, now living one paragraph away from the correct text. An implementer who reads the summary first (standard practice) will miss the third `% 6` occurrence at line 79 of `StatTerrain.ts`.

Fix: Change line 459 from:
```
`hash % 6` → `hash % 8` (×2 occurrences: comment + code)
```
to:
```
`hash % 6` → `hash % 8` (×3 occurrences: STAT_TYPES header comment + getStatAt comment + getStatAt code)
```
