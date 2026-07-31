# CRITIC REVIEW: ARCHITECT-STATSHEET-DEFENSE-STABILITY.md

**Stage:** CRITIC (pipeline stage 2 of 5)
**Date:** 2026-07-29
**Spec reviewed:** `docs/ARCHITECT-STATSHEET-DEFENSE-STABILITY.md`
**Context docs read:** ADR-STATSHEET-DEFENSE-STABILITY.md, CANONICAL-STYLES.md, packages/shared/src/index.ts, packages/engine/src/StatTerrain.ts, packages/engine/src/StatDeriver.ts

---

## Findings

### BLOCKER 1 — Wrong stability comment in StatSheet interface

**Location:** Spec §FILE 1 StatSheet "After" block, stability line comment
**Issue:** Spec writes `stability: number;  // knockdown/knockback reduction — Layer 1: ROOT voxels × ROOT_STABILITY_MULT; Layer 2: terrain`. ROOT_STABILITY_MULT does not exist anywhere in the spec. Stability has NO Layer 1 source. The spec body says so explicitly. An implementer reading the interface first will add ROOT_STABILITY_MULT and add stability to deriveStructural — the opposite of the design.
**Fix:** Change comment to: `stability: number;  // knockdown/knockback reduction — terrain-only; no structural (Layer 1) source`

---

### BLOCKER 2 — Third occurrence of `% 6` not covered

**Location:** Spec §FILE 2 StatTerrain.ts, hash modulo section; StatTerrain.ts line 79
**Issue:** Spec says "These are the only two occurrences of `% 6` in the file" — but there are three. Line 79 reads `// STAT_TYPES — six-bucket ordered list; index must be stable (hash % 6)`. The spec's "Before" block starts at line 81, silently omitting line 79. The explicit "Change both" instruction guarantees the implementer leaves line 79 stale.
**Fix:** Add line 79 to the STAT_TYPES "Before" block. "After" must read `// STAT_TYPES — eight-bucket ordered list; index must be stable (hash % 8)`. Correct claim to "three occurrences."

---

### MAJOR 1 — Summary table wrong: StructuralStats "+defense, +stability"

**Location:** Spec §Summary of All Changes, StatDeriver.ts row
**Issue:** Summary says "StructuralStats: +defense, +stability". Stability is NOT in StructuralStats — the spec body says so explicitly. Implementers use the summary as a quick-reference; this will cause stability to be added to StructuralStats.
**Fix:** "StructuralStats: +defense only. Stability intentionally excluded — terrain-only, same pattern as skillPoints."

---

### MAJOR 2 — Summary table wrong: deriveStructural "+2 counters, +2 switch cases, +2 return fields"

**Location:** Spec §Summary of All Changes, StatDeriver.ts row
**Issue:** deriveStructural gains exactly 1 counter (scarVoxels), 1 switch case (VoxelRole.SCAR), 1 return field (defense). Not 2 of each. An implementer following the summary will add rootVoxels + VoxelRole.ROOT + stability to deriveStructural — all wrong.
**Fix:** "deriveStructural: +1 counter (scarVoxels), +1 switch case (VoxelRole.SCAR), +1 return field (defense). No stability additions — terrain-only."

---

### MAJOR 3 — Sekijoju comment left in StatTerrain.ts by DO NOT CHANGE instruction

**Location:** Spec §DO NOT CHANGE List, STYLE_SPLINES entry; StatTerrain.ts line 63
**Issue:** StatTerrain.ts line 63 contains `// TODO: 7 — Sekijoju   (root over rock)`. CANONICAL-STYLES.md says "Remove from all documents." The DO NOT CHANGE instruction leaves a banned reference in the codebase.
**Fix:** Narrow the entry: "Do not add or reorder STYLE_SPLINES entries, but DO remove the `// TODO: 7 — Sekijoju` comment line and update 'Remaining 7 entries' to 'Remaining 6 entries' on line 54."

---

### MAJOR 4 — Summary table wrong: "2 new module-level constants"

**Location:** Spec §Summary of All Changes, StatDeriver.ts row
**Issue:** One constant is added (SCAR_DEFENSE_MULT). Not two. The count of 2 could lead an implementer to define ROOT_STABILITY_MULT, which must not exist.
**Fix:** "1 new module-level constant (SCAR_DEFENSE_MULT)."

---

### MINOR 1 — Sekijoju named in spec body

**Location:** Spec §Open Question Resolution, third paragraph
**Issue:** "Sekijoju" named explicitly. CANONICAL-STYLES.md says remove from all documents.
**Fix:** Replace with "A prior architect draft incorrectly conflated a penjing landscaping display style's aesthetic origin ('root over rock') with structural voxel combat contribution."

---

### MINOR 2 — ADR style spline table conflicts with CANONICAL-STYLES.md

**Location:** ADR §Style Spline Alignment table (referenced as future work)
**Issue:** ADR says Shakan→"power, stability", Bunjin→"ki, skill_point", Hokidachi→"hp, defense". CANONICAL-STYLES.md says Shakan→Power, Bunjin→skillPoints, Hokidachi→HP+Endurance. Spec defers style splines but doesn't flag the conflict.
**Fix:** Add to DO NOT CHANGE: "ADR §Style Spline Alignment does not fully match CANONICAL-STYLES.md. CANONICAL-STYLES.md is authoritative. Reconcile before implementing splines."

---

### MINOR 3 — Block comment line number off by one

**Location:** Spec §FILE 3 StatDeriver.ts, "Update the block comment at line 71-75"
**Issue:** Target text exists at line 72, not 71. Minor navigational error.
**Fix:** Update reference to "line 72."

---

### MINOR 4 — STYLE_SPLINES name doubled in DO NOT CHANGE list

**Location:** Spec §DO NOT CHANGE List, STYLE_SPLINES row
**Issue:** Entry reads "`STYLE_SPLINES` / `STYLE_SPLINES` array" — duplicated.
**Fix:** "`STYLE_SPLINES` array in StatTerrain.ts."

---

### MINOR 5 — splineForSeed() comments stale, not flagged

**Location:** StatTerrain.ts lines 69-74; Spec §DO NOT CHANGE list
**Issue:** splineForSeed() contains "seed % 8" and "remaining 7 styles" — both stale per CANONICAL-STYLES.md (7 styles total, 6 remaining, seed % 7). Spec defers but doesn't flag for future implementer.
**Fix:** Add note: "splineForSeed() comments say seed % 8 and 7 remaining — both stale. Update when splines land. Out of scope for this PR."

---

## Overall Verdict: NEEDS CORRECTIONS

Two blockers must be resolved before handing to the implementer:

1. The `stability` comment in StatSheet cites a non-existent ROOT_STABILITY_MULT and a wrong Layer 1 source. An implementer reading the interface comment will implement ROOT→Stability structurally — the opposite of the design.

2. A third occurrence of `% 6` in StatTerrain.ts (line 79) is not covered. The spec says "only two" — guaranteeing line 79 is left stale.

Four MAJORs must also be fixed — the summary table contradicts the spec body in four places. Summary tables are used as quick reference; wrong summaries produce wrong code.

The spec body is sound. Stability is terrain-only, ROOT has no structural contribution, SCAR→defense via SCAR_DEFENSE_MULT. Corrections are surgical. No rewrite needed.
