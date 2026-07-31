# FIX: COMBAT-METADATA-REQUIREMENTS §3.1 StatSheet Update

**Date:** 2026-07-30  
**Task:** Audit follow-up to Task #65 (defense/stability added) and #71 (audit found stale doc)  
**File changed:** `docs/COMBAT-METADATA-REQUIREMENTS.md` (only)

---

Two targeted edits were made to `docs/COMBAT-METADATA-REQUIREMENTS.md`: (1) the NOTE blockquote in §1 (Model B turn-based damage formula, previously line 91) was corrected from the false claim that `defense` and `stability` are "NOT fields in the canonical TypeScript StatSheet" to an accurate statement that both fields were added in Task #65, with their correct layer attribution (`defense` — Layer 1: SCAR voxels × SCAR_DEFENSE_MULT (0.10) plus Layer 2 terrain; `stability` — Layer 2 terrain-only, no structural source); (2) the TypeScript `StatSheet` interface code block in §3.1 was updated to match `packages/shared/src/index.ts` exactly by adding `defense: number` and `stability: number` with inline comments documenting their layer sources, bringing the documented field count from 8 to the correct 10 (`hp, power, endurance, ki, skillSlots, skillPoints, wisdom, matchPct, defense, stability`). No TypeScript files, no other docs, no UI files were touched. The "remaining 7 styles" phrase was confirmed absent from this file (out of scope). §3.1 now accurately reflects the canonical 10-field StatSheet and the layer attribution for all fields.
