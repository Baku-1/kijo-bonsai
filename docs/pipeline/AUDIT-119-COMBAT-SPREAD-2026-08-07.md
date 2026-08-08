# AUDIT-119 — Combat Stats Fallout from BUG-3b (forkSpread Inversion Fix)

**Date:** 2026-08-07  
**Ticket:** #119  
**Auditor:** Research audit pass  
**Scope:** Does the BUG-3b forkSpread ordering correction change any combat stat outputs? Are any combat balance tables calibrated against the old (wrong) spread values?  
**Verdict:** Phase 2 — safe to defer. No combat stat fallout requiring pre-playtest action.

---

## What Was Fixed

BUG-3b corrected an inversion in `SPECIES_PARAMS.forkSpreadMin/Max` in `packages/shared/src/index.ts`. Before the fix, tropical had the widest spread and evergreen the narrowest — the reverse of GDD §3.3. After the fix:

| Species  | Old (wrong)       | New (correct)     |
|----------|-------------------|-------------------|
| hardwood | 0.30–0.80 rad     | 0.50–1.00 rad     |
| evergreen| 0.10–0.40 rad     | 0.30–0.70 rad     |
| tropical | 0.50–1.20 rad     | 0.10–0.40 rad     |

---

## Files Read

- `packages/engine/src/StatDeriver.ts` — stat derivation implementation (ground truth)
- `packages/engine/src/GrowthEngine.ts` — forkSpread consumption (extendAndFork)
- `packages/shared/src/index.ts` — SPECIES_PARAMS current values (post-fix confirmed)
- `kijo-bonsai/docs/DESIGN-COMBAT-SYSTEM-STATUS.md` — combat implementation status
- `kijo-bonsai/docs/COMBAT-METADATA-REQUIREMENTS.md` — combat stat reference doc
- `kijo-bonsai/docs/pipeline/ARCH-SPECIES-PARAMS-2026-08-07.md` — BUG-3b architect spec

---

## Finding 1: forkSpread affects branch angle only, not branch count or voxel roles

`GrowthEngine.extendAndFork()` uses `forkSpread` exclusively to set `child.angle`:

```ts
const spread = sp.forkSpreadMin + angleRng.next() * (sp.forkSpreadMax - sp.forkSpreadMin);
child.angle  = round4(side * spread * (180 / Math.PI));
```

Whether a fork fires is controlled by `spE.forkChance` (from `engine/src/species.ts`) and how many children fork is controlled by `sp.secondaryForkChance`. **Neither of those changed in BUG-3b.**

---

## Finding 2: Layer 1 combat stats are not sensitive to branch angle

`StatDeriver.deriveStructural()` counts voxels by VoxelRole:

| Stat       | Source                           | Affected by angle? |
|------------|----------------------------------|--------------------|
| HP         | TRUNK voxels × HP_MULT           | No — trunk is depth-0, grows vertically |
| Power      | ARM voxels × POWER_MULT          | No — count set by branch length/thickness, not angle |
| Endurance  | LEG voxels × ENDURANCE_MULT      | No — same |
| Ki         | CANOPY voxels × KI_MULT          | No — leaf cluster count set by growth, not angle |
| Skill Slots| COUNT of depth-2+ branches       | No — fork COUNT is unchanged; spread only sets where they point |
| Defense    | SCAR voxels × SCAR_DEFENSE_MULT  | No |

ARM/LEG split is determined by `attachmentY` (one-third rule), not by angle. The number of voxels in any branch depends on length and thickness accumulation — both independent of fork direction.

**Skill Slots is the structural combat stat most sensitive to species.** It counts depth-2+ branches. That count is driven by `forkChance` and `secondaryForkChance`, neither of which changed. The fix has zero effect on Skill Slot output per species.

---

## Finding 3: Layer 2 terrain bonuses shift slightly but are already handled

Branch angle determines the 3D path through the voxel grid, so different angles do hit different `(x, y, z)` coordinates and therefore different `spatialHash`-assigned terrain stat types. However:

1. Terrain bonuses are small (base value 0.001 per coordinate) relative to structural stats.
2. The stat type distribution is random (`spatialHash mod 6`) — changing which coordinates are hit produces no systematic species-level shift.
3. The BUG-3b architect spec (ARCH-SPECIES-PARAMS-2026-08-07.md, SIDE-EFFECT-2) **already requires fixture regeneration** — `hardwood_real.json` and `tropical_real.json` must be rebuilt and gate tests rerun. This is correctly scoped.

No additional action needed here beyond what is already in the BUG-3b implementation plan.

---

## Finding 4: No combat balance tables exist calibrated against spread values

The combat engine is **not implemented**. `DESIGN-COMBAT-SYSTEM-STATUS.md` explicitly states: *"Phase 1 does not include combat."* Specifically:

- The structural stat multipliers (HP_MULT 0.35, POWER_MULT 0.50, etc.) are calibrated against **total voxel counts** of a reference day-200 Chokkan hardwood — not against species spread values. They are flagged "FLAGGED FOR PLAYTEST TUNING (R14)" and are not final.
- The ~15% species triangle advantage (turn-based model) exists only in the GDD as a design note. It is not implemented anywhere in code.
- The fighting game vs. turn-based decision is unresolved (see DESIGN-COMBAT-SYSTEM-STATUS.md). No combat engine code exists to be miscalibrated.

There are no hardcoded species combat stat tables, species damage modifiers, or spread-derived balance values anywhere in the codebase or docs that were calibrated against the old (wrong) spread ordering.

---

## Finding 5: COMBAT-METADATA-REQUIREMENTS.md already reflects corrected values

`COMBAT-METADATA-REQUIREMENTS.md §6.2` shows the post-fix SPECIES_PARAMS (hardwood 0.50–1.00, evergreen 0.30–0.70, tropical 0.10–0.40), with the BUG-3b annotation. No update needed.

---

## Summary

| Question | Finding |
|----------|---------|
| Does forkSpread affect branch count? | No — forkChance and secondaryForkChance control count; unchanged |
| Does forkSpread affect structural Layer 1 stats (HP/Power/Endurance/Ki/Skill Slots)? | No |
| Does forkSpread affect terrain Layer 2 bonuses? | Negligibly — random per coordinate; already handled by fixture regen in BUG-3b plan |
| Are combat balance tables calibrated against old spread values? | No — combat engine unimplemented; no such tables exist |
| Does COMBAT-METADATA-REQUIREMENTS.md need updating? | No — already shows corrected values |

---

## Verdict: Phase 2

No combat-blocking fallout from BUG-3b. The fix is fully self-contained within the scope defined by ARCH-SPECIES-PARAMS-2026-08-07.md (SPECIES_PARAMS values, dist rebuild, StoreModal hints, fixture regeneration). No pre-playtest combat doc or code changes are required as a result of this fix.

The one downstream action — fixture regeneration and gate test rerun — is already captured as SIDE-EFFECT-2 in the BUG-3b implementation plan. No new tickets required.

---

*Files read: StatDeriver.ts, GrowthEngine.ts, shared/src/index.ts, DESIGN-COMBAT-SYSTEM-STATUS.md, COMBAT-METADATA-REQUIREMENTS.md, ARCH-SPECIES-PARAMS-2026-08-07.md. No code changed.*
