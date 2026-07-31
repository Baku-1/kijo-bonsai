# Adversarial Audit — Defense + Stability Implementation
Date: 2026-07-30
Auditor: adversarial-auditor (cold read, no implementer context)

---

## Verdict: PASS WITH MINORS

All 17 code-level claims verified by direct file read and git diff. Four tsc checks
observed at EXIT:0. One required doc update was not performed and leaves an actively
false statement in COMBAT-METADATA-REQUIREMENTS.md — flag as blocker before commit.
Two undisclosed scope additions (correct) and two structural minors noted below.

---

## TypeScript

All checks run directly and exit codes observed:

| Command | Exit |
|---|---|
| `cd packages/shared && npx tsc --noEmit` | **0** |
| `cd packages/engine && npx tsc --noEmit` | **0** |
| `cd apps/web && npx tsc -p tscheck2d.json` | **0** |
| `cd apps/web && npx tsc -p tscheck3d.json` | **0** |

Note: full `apps/web && npx tsc --noEmit` (no skipLibCheck, no scoped config) timed out
at 35 s due to Three.js type volume. The scoped configs (tscheck2d.json / tscheck3d.json)
target only the modified files against pre-built `.d.ts` stubs — valid proxy for our
purposes since the packages themselves compile clean.

---

## File-by-file findings

### packages/shared/src/index.ts

- CONFIRMED — StatType union has exactly 8 members:
  `'hp' | 'power' | 'endurance' | 'ki' | 'skill_point' | 'defense' | 'stability' | 'neutral'`
  (git diff confirms prior 6-member union; 'defense' and 'stability' added)
- CONFIRMED — StatSheet has exactly 10 fields:
  hp, power, endurance, ki, skillSlots, skillPoints, wisdom, matchPct, defense, stability
- CONFIRMED — defense comment: "damage reduction — Layer 1: SCAR voxels × SCAR_DEFENSE_MULT; Layer 2: terrain"
- CONFIRMED — stability comment: "knockdown/knockback reduction — terrain-only; no structural (Layer 1) source"
- CONFIRMED — all pre-existing fields and ordering unchanged

### packages/engine/src/StatTerrain.ts

- CONFIRMED — STAT_TYPES has 8 entries (hp, power, endurance, ki, skill_point, defense, stability, neutral)
- CONFIRMED — BASE_VALUES: defense: 0.001, stability: 0.001 (both flagged for playtest tuning)
- CONFIRMED — exactly THREE `% 6` → `% 8` changes, verified via `git diff HEAD`:
    1. STAT_TYPES header comment: `"eight-bucket ordered list; index must be stable (hash % 8)"`
    2. getStatAt algorithm comment: `"2. bucket = h % 8 → StatType"`
    3. getStatAt active code: `const bucket = hash % 8;`
  Zero remaining `% 6` occurrences (grep confirmed)
- CONFIRMED — `// TODO: 7 — Sekijoju   (root over rock)` removed (diff observed)
- CONFIRMED — "Remaining 7 entries" → "Remaining 6 entries" (diff observed)
- MINOR — `splineForSeed` JSDoc (line 68 area) still reads "remaining 7 styles are built"
  while the STYLE_SPLINES comment directly above now says "Remaining 6". Inconsistent.
  Not in spec scope; carry forward as doc debt.

### packages/engine/src/StatDeriver.ts

- CONFIRMED — `SCAR_DEFENSE_MULT = 0.10` at module level (exact value, not 0.05 or other)
- CONFIRMED — companion NOTE comment: "Stability has no structural source. ROOT voxels do not contribute."
- CONFIRMED — StructuralStats has `defense: number`; stability is NOT present
- CONFIRMED — StructuralStats NOTE comment documents why (terrain-only, same pattern as skillPoints)
- CONFIRMED — TerrainBonuses has both `defense: number` and `stability: number`
- CONFIRMED — deriveStructural(): `scarVoxels` counter declared; `case VoxelRole.SCAR: scarVoxels++; break;`
  in switch; `defense: round4(scarVoxels * SCAR_DEFENSE_MULT)` in return object;
  stability absent from return (comment documents this explicitly)
- CONFIRMED — deriveTerrain(): `defense = 0, stability = 0` in accumulator line;
  `case 'defense': defense += stat.value; break;` and `case 'stability': stability += stat.value; break;`
  both present; `defense: round4(defense)` and `stability: round4(stability)` in return
- CONFIRMED — derive(): `defense: round4(structural.defense + terrain.defense)` (dual-layer, additive)
- CONFIRMED — derive(): `stability: round4(terrain.stability)` (terrain-only, comment explains why)
- CONFIRMED — round4() applied at every accumulation boundary; fixed-point discipline maintained

### apps/web/src/main2d.ts

- CONFIRMED — Defense and Stability rows added (rows array now 10 entries, indices 8–9)
- CONFIRMED — references sheet.defense and sheet.stability directly
- MINOR — export payload (btn-export handler) still lists only original 8 stats. Defense and
  stability are NOT in the JSON sent to Godot. Display is correct; export is incomplete.
  Not in this task's spec scope, but creates a concrete downstream gap before any Godot
  combat work can consume these fields.
- UNDISCLOSED CHANGE (correct) — `tree.water(25)` → `tree.water(WATER_AMOUNT)` with new
  import added. Not claimed by implementer. The change is correct (WATER_AMOUNT = 28 is
  the canonical constant; 25 was wrong). Not a bug, but scope was not disclosed.

### apps/web/src/main3d.ts

- CONFIRMED — Defense and Stability rows added (same 10-entry rows array)
- CONFIRMED — Morale NOT added (correct; not on StatSheet yet)
- MINOR — same export payload gap as main2d.ts
- UNDISCLOSED CHANGE (correct) — same WATER_AMOUNT substitution as main2d.ts

### App.tsx

- CONFIRMED — file NOT in git modified list; content read directly; zero stat-related
  code present. The component composes ThreeCanvas, WalletBar, StoreModal, TutorialOverlay
  only. CareHud stat display invariant honoured.

---

## Intent Check

```
INTENT CHECK — StructuralStats stability exclusion
  code does:     stability absent from StructuralStats; only defense present
  check expects: tsc EXIT:0 with stability absent (no compile error — type system agrees)
  spec says:     "stability is terrain-only (no Layer 1 source). Same pattern as skillPoints."
  verdict:       ALIGNED

INTENT CHECK — defense dual-layer accumulation
  code does:     derive() returns round4(structural.defense + terrain.defense)
  check expects: tsc EXIT:0; value type number
  spec says:     "Layer 1: SCAR voxels × SCAR_DEFENSE_MULT; Layer 2: terrain (stack additively)"
  verdict:       ALIGNED

INTENT CHECK — COMBAT-METADATA-REQUIREMENTS.md §3.1 update
  code does:     StatSheet has 10 fields including defense and stability (TypeScript confirmed)
  doc says:      §3.1 shows 8-field StatSheet; line 91 reads "'Defense%' and 'Stability' are
                 NOT fields in the canonical TypeScript StatSheet" (directly false post-impl)
  spec says:     "What to Update in Docs After Implementation:
                 COMBAT-METADATA-REQUIREMENTS.md §3 — stat list and layer attribution"
  verdict:       CONFLICT — required doc update not performed; active lie in live doc
```

---

## Blockers (must fix before Jeremy commits)

**COMBAT-METADATA-REQUIREMENTS.md §3 not updated**

The ARCHITECT spec explicitly listed this doc update as required. It was not done. Two
concrete harms:

1. §3.1 StatSheet definition (lines ~199–211) still shows the old 8-field interface without
   defense or stability.
2. Line 91 now actively contradicts the implementation: `"'Defense%' and 'Stability'
   referenced in this formula are NOT fields in the canonical TypeScript StatSheet"`. This
   is false. Any future reader — human or agent — will have a wrong model.

Fix: update §3.1 to show the 10-field StatSheet, delete or correct the stale line-91 note,
and remove the reference to ADR-STATSHEET-DEFENSE-STABILITY.md as an "open design gap"
(it is closed).

---

## Minors (fix or carry forward)

**1. splineForSeed JSDoc stale ("remaining 7 styles")**
STYLE_SPLINES comment correctly reads "Remaining 6" but the nearby JSDoc still says
"remaining 7 styles are built." Carry forward as doc debt; not a runtime bug.

**2. Export payload omits defense and stability (main2d.ts + main3d.ts)**
The Godot JSON export from both caretaker views does not include the new fields. The
stat table display is correct. Before any Godot combat work references defense or stability
from exported metadata, a follow-up task should add these to the payload.

**3. WATER_AMOUNT substitution undisclosed**
Both main files silently fixed `tree.water(25)` → `tree.water(WATER_AMOUNT)`. The fix
is correct but was not in the implementer's claims. Not harmful; document in commit message.

---

## Summary

All 17 code-level implementer claims are true — verified by direct file read and git diff,
not from any report. Four tsc checks exit 0 (observed). Design invariants hold: SCAR_DEFENSE_MULT
is exactly 0.10, stability has no structural source, ROOT voxels do not contribute to
stability, and the `% 6` → `% 8` change was made in exactly three places. The single blocker
is a doc update that was not performed: COMBAT-METADATA-REQUIREMENTS.md §3 still carries an
actively false statement at line 91 claiming defense and stability are not in the TypeScript
StatSheet. Fix that, carry the two export-payload and stale-JSDoc minors forward, and this
implementation is clean to commit.
