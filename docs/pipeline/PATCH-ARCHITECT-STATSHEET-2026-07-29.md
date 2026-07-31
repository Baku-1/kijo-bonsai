# PATCH: ARCHITECT-STATSHEET-DEFENSE-STABILITY.md

**Date:** 2026-07-29  
**Source of truth:** `CRITIC-STATSHEET-DEFENSE-STABILITY.md`  
**Target:** `docs/ARCHITECT-STATSHEET-DEFENSE-STABILITY.md`

---

## Changes Applied

### BLOCKER 1 — StatSheet stability comment
**Line ~131 (StatSheet "After" block)**  
Removed false `ROOT_STABILITY_MULT` / Layer 1 claim from stability comment.  
New: `// knockdown/knockback reduction — terrain-only; no structural (Layer 1) source`

### BLOCKER 2 — Third `% 6` occurrence in STAT_TYPES section
**Lines ~144–164 (FILE 2 STAT_TYPES Before/After blocks) and line ~218 (claim)**  
Added `// STAT_TYPES — six-bucket ordered list; index must be stable (hash % 6)` as first line of the "Before" block.  
Added `// STAT_TYPES — eight-bucket ordered list; index must be stable (hash % 8)` as first line of the "After" block.  
Corrected claim from "only two occurrences … Change both" to "only three occurrences … Change all three."

### MAJOR 1 — Summary table: StructuralStats cell
Changed `StructuralStats: +defense, +stability.` → `StructuralStats: +defense only. Stability intentionally excluded — terrain-only stat, same pattern as skillPoints.`

### MAJOR 2 — Summary table: deriveStructural cell
Changed `+2 counters, +2 switch cases, +2 return fields` → `+1 counter (scarVoxels), +1 switch case (VoxelRole.SCAR), +1 return field (defense). No stability additions — terrain-only.`

### MAJOR 3 — Summary table: constants cell
Changed `2 new module-level constants.` → `1 new module-level constant (SCAR_DEFENSE_MULT).`

### MAJOR 4 — DO NOT CHANGE list: STYLE_SPLINES entry
Removed duplicated `` `STYLE_SPLINES` / `STYLE_SPLINES` `` name (MINOR 4 from critic, bundled here).  
Narrowed blanket "do not touch" to permit the Sekijoju TODO removal and "Remaining 6 entries" update per CANONICAL-STYLES.md.  
Added ADR reconciliation note.

---

## Files Touched

- `docs/ARCHITECT-STATSHEET-DEFENSE-STABILITY.md` — 5 surgical edits
- `docs/pipeline/PATCH-ARCHITECT-STATSHEET-2026-07-29.md` — this file (new)

No other files modified.
