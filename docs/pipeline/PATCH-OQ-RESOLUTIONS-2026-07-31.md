# Patch: Open Question Resolutions — 2026-07-31

**Patch date:** 2026-07-31  
**Authority:** Jeremy (owner confirmations in session 2026-07-31)  
**Files patched:**
- `docs/ARCHITECT-CAREACTION-TECHNIQUE-2026-07-30.md`
- `docs/DESIGN-TWINE-VS-WIRE.md`

---

## Summary

Seven open questions closed. Two new CareAction variants added. Angle values updated throughout.

---

## Resolved Open Questions

### OQ-1 — Twine/wire depth restriction [RESOLVED]

**Answer:** No depth restriction. Twine AND wire can be applied to ANY branch at any depth, AND to the trunk itself. Required for Kengai (Cascade) style where the trunk bends downward. TwineEngine and WireEngine must NOT enforce a depth-1-only constraint.

**Files changed:** Assumption 2 in ARCHITECT doc updated (original assumption was incorrect). OQ-1 marked resolved.

---

### OQ-2 — Weight removal action [RESOLVED]

**Answer:** Weight removal must be tracked. A `weight-remove` CareAction variant is required:
```typescript
{ type: 'weight-remove'; branchId: number }
```

**Files changed:** `weight-remove` variant added to CareAction union in ARCHITECT doc. OQ-2 marked resolved.

---

### OQ-3 — Multiple weights + angle values [RESOLVED]

**Answer:**
- Up to **4 weights** per branch
- Each weight adds **7° of downward bend**
- Max weight contribution: 4 × 7° = **28° downward**
- **Twine max bend updated: ±28°** (replaces ±15–20° range previously in DESIGN-TWINE-VS-WIRE.md)
- Wire max bend: ±45° (unchanged)
- ~~Combined twine + 4 weights: up to **56° total downward bend**~~ **[RETRACTED 2026-07-31: the 56° combined figure was wrong. Both twine and weight caps are independent at 28° each, not additive. Cascade to Kengai is achieved by stacking over time (bend → set → re-apply), not simultaneous additive force. See PATCH-TWINE-WEIGHT-CAP-2026-07-31.md.]**

**Files changed:**
- ARCHITECT doc: twine `angleDelta` clamp updated to ±28°, weight notes updated with 4-weight cap and 7°/weight, CareAction union comment updated.
- DESIGN-TWINE-VS-WIRE.md: twine bullet updated (±28°), weights bullet updated (7°/weight, 28° max), summary table Twine row updated (±28°), Weights row updated (7° per weight, ≤28°).

---

### OQ-4 — Jin segmentIndex semantics [RESOLVED]

**Answer:** Jin converts everything from the chosen point **outward to the tip**. Picking `segmentIndex` N converts segment N through the branch tip, plus ALL sub-branches extending beyond that point — all become SCAR voxels (deadwood). `segmentIndex` = 0-based index from the branch's trunk junction.

C++ spec reconciliation remains a TBD implementation task; if C++ uses a different field name, an adapter in JinEngine reconciles without changing the TypeScript type.

**Files changed:** OQ-4 marked resolved in ARCHITECT doc.

---

### OQ-5 — DESIGN-TWINE-VS-WIRE.md line 27 wording [PREVIOUSLY RESOLVED]

Already marked `[RESOLVED 2026-07-31]` in a prior patch (PATCH-TWINE-SCAR-CLARIFICATION-2026-07-31.md). No changes needed in this patch.

---

### OQ-6 — TechniqueClassifier re-evaluation strategy [RESOLVED]

**Answer:** Classification re-runs **only when the caretaker opens the voxel viewer** — not on every care action. The engine caches the last `TechniqueResult` and invalidates it when the viewer is opened (lazy/on-demand strategy). `TechniqueClassifier` itself remains stateless; caching lives at the call site.

**Files changed:** OQ-6 marked resolved in ARCHITECT doc. `classify()` JSDoc updated to reflect cache strategy.

---

### OQ-7 — LandscapeElementType completeness [RESOLVED]

**Answer:** Phase 1 union confirmed: `'rock' | 'moss' | 'pot'` (basic store items sold by the fictional Guild seller). <!-- Lore terminology revised 2026-09-24; personal name pending. --> Phase 2+ NFT items (`water_feature`, `figurine`, `ceramic`) are earned through gameplay and out of Phase 1 scope.

**Files changed:** `LandscapeElementType` updated to 3-literal union in ARCHITECT doc. All "5 literal values" references updated to "3 literal values (Phase 1)".

---

## Additional Changes (from earlier in session)

### twine-remove CareAction [ADDED]

A `twine-remove` variant allows caretakers to remove twine before it degrades naturally:
```typescript
{ type: 'twine-remove'; branchId: number }
```
Added to the CareAction union in ARCHITECT doc alongside `weight-remove`.

---

## Verification Checklist

| Check | Result |
|---|---|
| No `±15–20°` for twine in patched files | ✓ Only in historical "was ..." notes |
| `LandscapeElementType` = `'rock' \| 'moss' \| 'pot'` | ✓ |
| All 7 OQs marked `[RESOLVED 2026-07-31]` | ✓ |
| `twine-remove` variant in CareAction union | ✓ Line 283 |
| `weight-remove` variant in CareAction union | ✓ Line 291 |
| Other docs (GDD, PRD, TECH-SPEC, ENGINE-API) | ⚠ Still reference old ±15–20° — out of scope for this patch; flagged for follow-up |
