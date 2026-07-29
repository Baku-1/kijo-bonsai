# AUDIT: Web View Files — Adversarial Auditor Pass
**Date:** 2026-07-28  
**Stage:** Adversarial Auditor (pipeline stage 4 of 5)  
**Files audited:** `apps/web/src/main2d.ts`, `apps/web/src/main3d.ts`, `apps/web/src/App.tsx`  
**Reference sources:** `packages/shared/src/index.ts`, `packages/engine/src/StatDeriver.ts`, `docs/CANONICAL-STYLES.md`, `docs/ADR-STATSHEET-DEFENSE-STABILITY.md`, `docs/ARCHITECT-STATSHEET-DEFENSE-STABILITY.md`  
**Also read:** `apps/web/src/components/ThreeCanvas.tsx`, `apps/web/src/ui/hud.ts`, `apps/web/src/bridge/care_bridge.ts`, `apps/web/src/components/StoreModal.tsx`, `apps/web/src/components/TutorialOverlay.tsx`

---

## CRITICAL Findings

---

```
[SEVERITY: CRITICAL]
Location: main2d.ts line 169 / main3d.ts line 335
Issue: Both views water with 25ml, not the spec-defined 28ml. WATER_AMOUNT constant exists in @kijo/shared but is never imported or used in either file.
Evidence: main2d.ts: `tree.water(25)`. main3d.ts: `tree.water(25)`. shared/src/index.ts line 137: `export const WATER_AMOUNT = 28;  // GDD s3.2 — one watering can`. care_bridge.ts line 3 correctly imports WATER_AMOUNT and uses it at line 31 — but main2d and main3d bypass CareBridge entirely and hardcode the wrong amount.
Fix: Import WATER_AMOUNT from '@kijo/shared' in both files. Replace both `tree.water(25)` calls with `tree.water(WATER_AMOUNT)`.
```

---

```
[SEVERITY: CRITICAL]
Location: main2d.ts lines 221-229 / main3d.ts lines 372-380
Issue: Export payload stats block does not include `defense` or `stability`. When the architect spec (ARCHITECT-STATSHEET-DEFENSE-STABILITY.md) is implemented, these two fields will exist on StatSheet but will be silently absent from every exported JSON. The Godot consumer (`KijoStats.from_json`) will receive a payload missing two combat stats.
Evidence: Both export blobs hardcode exactly 8 stat fields: `{ hp, power, endurance, ki, skillSlots, skillPoints, wisdom, matchPct }`. StatSheet will grow to 10 fields. Neither view destructures the full sheet — both hardcode property names. No `defense` or `stability` key is present or will be added automatically.
Fix: When the implementation lands, both export stat blocks must add `defense: sheet.defense` and `stability: sheet.stability`. These lines must be added explicitly; they will not appear from TypeScript spread unless the export object is restructured to `stats: sheet` minus non-stat fields.
```

---

```
[SEVERITY: CRITICAL]
Location: main3d.ts lines 104-123
Issue: The 3D ghost hint is hardcoded as a Chokkan (Formal Upright) vertical cylinder regardless of the seed's actual style archetype. 6 out of 7 possible style archetypes receive a ghost that shows the wrong ideal form, actively misleading players.
Evidence: Code comment at line 105: "Ghost hint — soft shell around the ideal-path region (Chokkan: vertical axis at x=z=128, y 38..220, radius = IDEAL_REGION_DISTANCE = 10)". The `seed % 7` style index is never computed in this file. The ghost geometry is created once at startup and never adapted to the tree's actual style. A Kengai (Cascade) seed — where branches should hang downward — will show an upward vertical cylinder as its "ideal" guide.
Fix: Compute `const styleIndex = tree.getSeed() % 7` and generate style-appropriate ghost geometry. At minimum, the ghost must be suppressed (or replaced with a neutral marker) for non-Chokkan seeds until per-style ghosts are implemented. Showing a wrong ghost is worse than no ghost.
```

---

```
[SEVERITY: CRITICAL]
Location: docs/ADR-STATSHEET-DEFENSE-STABILITY.md §Style Spline Alignment table (lines 119-130)
Issue: The ADR's style spline alignment table lists 8 styles including Sekijoju ("Root Over Rock | stability, hp"). CANONICAL-STYLES.md (confirmed authoritative 2026-07-28) explicitly says there are 7 styles and Sekijoju is NEVER part of the design. If an implementer follows the ADR's style table when writing the style splines, they will implement an 8th style that does not exist in the game design.
Evidence: ADR lines 119-130 include `| Sekijoju | stability, hp |`. CANONICAL-STYLES.md lines 30-33: "Sekijoju (Root Over Rock) — NEVER part of Jeremy's design. Appeared in GDD §4.2.1 erroneously. Remove from all documents." The architect spec does not catch this inconsistency — it reproduces the ADR's style alignment table verbatim.
Fix: Remove the Sekijoju row from the ADR's §Style Spline Alignment table. The table must have exactly 7 rows (Chokkan, Moyogi, Shakan, Kengai, Fukinagashi, Bunjin, Hokidachi). Also fix the architect spec if it reproduces the same table.
```

---

```
[SEVERITY: CRITICAL]
Location: apps/web/src/App.tsx (all) / apps/web/src/components/ThreeCanvas.tsx (all) / apps/web/src/ui/hud.ts (all)
Issue: The primary React app (App.tsx → ThreeCanvas → CareHud) shows NO StatSheet stats whatsoever. HP, Power, Endurance, Ki, SkillSlots, SkillPoints, Wisdom, and matchPct are invisible to players using the main app. The CareHud.update() method (hud.ts line 56-78) takes only `tree` and `livingBranches` — it never calls StatDeriver and has no stat table in its DOM output. The JSX in ThreeCanvas.tsx has no #stat-table element, no voxel count display, no fertilizer status.
Evidence: hud.ts update() method reads only `getMoisture()`, `getHealth()`, `getAge()`. Never imports or calls StatDeriver. ThreeCanvas JSX (lines 87-119) renders moisture bar, health bar, day label, season label, info-line, warning, water button, next-day button, auto button, buy-seed button. No stat rows. No export button. No matchPct display.
Fix: ThreeCanvas must either (a) call StatDeriver and display a stat table, or (b) link players to main3d/main2d where stats are shown. The current state ships the game with its core progression mechanics (HP, Ki, Power, etc.) completely hidden from the primary UI path.
```

---

## MAJOR Findings

---

```
[SEVERITY: MAJOR]
Location: main2d.ts (all), main3d.ts (all), ThreeCanvas.tsx (all)
Issue: Wire CareAction exists in the type system, the store sells it, and the tutorial promises it, but no view implements it.
Evidence: shared/src/index.ts lines 41-43: `{ type: 'wire'; branchId: number; angleDelta: number; oldAngle: number; newAngle: number; wireCost: number }` with comment "WIRE (2026-07-19)". StoreModal.tsx line 20: `type ItemId = "seed" | "shears" | "wire" | "fertilizer" | "twine" | "weights"`. Line 52: `id: "wire"` — wire is a purchasable item. TutorialOverlay.tsx line 39: "pruning cuts, wire training, and weighting". Neither main2d.ts, main3d.ts, nor App.tsx/ThreeCanvas has a wire button, WireEngine import, or wire action dispatch.
Fix: Either implement wire in all three views before the tutorial mentions it, or remove wire from the tutorial text and store items until the implementation exists. Currently the store can sell an item (wire) with no in-game function.
```

---

```
[SEVERITY: MAJOR]
Location: apps/web/src/components/StoreModal.tsx line 20 / apps/web/src/components/TutorialOverlay.tsx line 39
Issue: "twine" and "weights" appear as purchasable items in the store and "weighting" is mentioned in the tutorial, but neither `twine` nor `weights`/`weighting` appear anywhere in the CareAction union or in any engine file.
Evidence: StoreModal.tsx line 20: `type ItemId = "seed" | "shears" | "wire" | "fertilizer" | "twine" | "weights"`. TutorialOverlay.tsx line 39: "pruning cuts, wire training, and weighting". shared/src/index.ts CareAction union has no `twine` or `weights` type member. No grep hit for these terms in any engine or shared file.
Fix: Add `twine` and `weights` to the CareAction union with their full parameter shapes, implement the corresponding engine methods, and wire them to the UI — OR remove them from the store and tutorial until implemented. Selling items with no engine effect is a dead feature that will confuse testers.
```

---

```
[SEVERITY: MAJOR]
Location: main2d.ts lines 55-59 / main3d.ts lines 282-285 / hud.ts line 65-66
Issue: Bonsai style (Chokkan, Moyogi, Shakan, Kengai, Fukinagashi, Bunjin, Hokidachi) is never displayed in any view. The style archetype — deterministically derived as `seed % 7` — is the fundamental game mechanic that tells players what their tree is trying to become. Players have no way to know it.
Evidence: main2d.ts meta line: `seed ${tree.getSeed()} · ${tree.getSpecies()} · day ${tree.getAge()} · health ... · moisture ...`. No style. main3d.ts meta line: same fields, no style. hud.ts info-line: `Seed #${tree.getSeed()} · ${livingBranches} branches · ${tree.getSpecies()}`. No style. None of the three views computes or displays `seed % 7` or the corresponding style name.
Fix: Compute `['Chokkan','Moyogi','Shakan','Kengai','Fukinagashi','Bunjin','Hokidachi'][tree.getSeed() % 7]` and display it in meta/info-line in all three views. This is the minimum viable disclosure. The export payload should also include `style` as a string field.
```

---

```
[SEVERITY: MAJOR]
Location: main2d.ts lines 49-53
Issue: The ⅓-rule branch display in main2d.ts is broken. The "below" filter uses `(b as any).attachmentY === undefined`, but `attachmentY` is a required field on the Branch interface. It is always defined. This condition is permanently false, making `below` always 0 regardless of actual branch distribution.
Evidence: shared/src/index.ts line 19: `attachmentY: number;` — required field, no `?`. The runtime value of `b.attachmentY` is always a number (never undefined) for any branch constructed by the engine. `(b as any).attachmentY === undefined` will never be true. Consequently the meta line always shows "0 low / N high depth-1" even when branches exist below the one-third mark.
Fix: Remove the `(b as any).attachmentY === undefined` condition from the below filter. Use `b.attachmentY <= oneThird` (comparing the field value to the threshold) instead of testing for undefined. The entire `as any` cast should be removed; Branch.attachmentY is fully typed.
```

---

```
[SEVERITY: MAJOR]
Location: apps/web/src/components/ThreeCanvas.tsx / apps/web/src/ui/hud.ts
Issue: App.tsx/ThreeCanvas is missing fertilize, rotate, prune, and wire buttons. The primary player UI only exposes water, next-day, and auto. All four missing actions have engine implementations and appear in main2d/main3d.
Evidence: ThreeCanvas.tsx JSX lines 109-115: renders only `btn-water`, `btn-next-day`, `btn-auto`, `btn-buy-seed`. hud.ts wires only those four IDs. No `btn-fertilize`, `btn-rotate`, `btn-prune`, `btn-wire` present. Meanwhile main2d.ts wires all of water, fertilize, rotate, prune. main3d.ts wires all of water, fertilize, rotate, prune (plus ghost toggle).
Fix: Add fertilize, rotate, and prune to ThreeCanvas JSX and wire them in hud.ts (or via CareBridge). Wire is gated on implementation; the others are not.
```

---

```
[SEVERITY: MAJOR]
Location: docs/ADR-STATSHEET-DEFENSE-STABILITY.md §Style Spline Alignment vs. docs/CANONICAL-STYLES.md
Issue: The ADR's style spline alignment lists Kengai → "power, ki" as primary terrain stat clusters. CANONICAL-STYLES.md (authoritative) says Kengai's primary stat is `skillSlots` (cascade style maximises digit voxels for ability slots). These are contradictory. If the spline implementation follows the ADR, Kengai terrain will cluster power+ki bonuses while the canonical spec expects a skillSlots specialist.
Evidence: CANONICAL-STYLES.md line 14: `| 3 | Cascade | Kengai | skillSlots | Most digit voxels from hanging branches → most ability slots |`. ADR line 126: `| Kengai | power, ki |`. skillSlots is a structural stat (digit voxel count) not a terrain stat, but terrain bonuses should reinforce the style's combat identity — which for Kengai means `skill_point` bonuses (not power+ki).
Fix: Correct ADR §Style Spline Alignment to `| Kengai | skill_point |` to match CANONICAL-STYLES.md. Review the other style mappings in the ADR against CANONICAL-STYLES.md for similar conflicts. The canonical doc is the authority.
```

---

```
[SEVERITY: MAJOR]
Location: main2d.ts / main3d.ts stat display (lines 140-149 / lines 269-277) / export payload
Issue: When defense and stability are added to StatSheet (per ARCHITECT spec), the stat table and export payload in both views will silently omit them. The stat display hardcodes exactly 8 rows by name — no dynamic iteration. The export hardcodes 8 property names.
Evidence: main2d.ts lines 140-149 and main3d.ts lines 269-277 both construct a fixed `rows: Array<[string, number | string]>` literal with 8 entries. There is no loop over `Object.keys(sheet)` or equivalent. When `sheet.defense` and `sheet.stability` exist, they will not appear in the table unless explicitly added. Same pattern in both export payloads (main2d lines 221-229, main3d lines 372-380).
Fix: Add `['Defense', sheet.defense]` and `['Stability', sheet.stability]` to both stat tables, and `defense: sheet.defense` / `stability: sheet.stability` to both export payloads, as part of the defense/stability implementation PR. Do not merge the implementation without these view updates.
```

---

## MINOR Findings

---

```
[SEVERITY: MINOR]
Location: main2d.ts line 145 vs. main3d.ts line 273 / main2d.ts line 147 vs. main3d.ts line 275
Issue: Skill slots and wisdom are formatted inconsistently between the two views. main3d wraps both in Math.round() before rendering; main2d uses the raw value. Both values are already integers in the current implementation, but the inconsistency is a latent bug if either field becomes non-integer (e.g., a fractional skill slot from a future mechanic).
Evidence: main2d.ts line 145: `['Skill slots', sheet.skillSlots]`. main3d.ts line 273: `['Skill slots', Math.round(sheet.skillSlots)]`. Same pattern for wisdom. Both then apply `toFixed(2)`, so current output is "2.00" in both cases — but the defensive rounding only exists in one view.
Fix: Standardise. Either add Math.round() to main2d for skillSlots and wisdom, or remove it from main3d and rely on the engine to always return integers for these fields (which it does, per StatDeriver source). The latter is more honest — remove the Math.round() calls from main3d since they mask the type contract.
```

---

```
[SEVERITY: MINOR]
Location: main2d.ts line 63 / main3d.ts line 287
Issue: Fertilizer status hardcodes "1.7× growth" as a string literal. If the fertilizer multiplier changes in BonsaiTree, the display will be wrong without any compile-time warning.
Evidence: main2d.ts line 63: `'fertilizer ACTIVE (1.7× growth)'`. main3d.ts line 287: `'fertilizer ACTIVE (1.7× growth)'`. Neither file imports or reads the fertilizer multiplier constant from the engine.
Fix: Either export a FERTILIZER_MULTIPLIER constant from the engine and interpolate it into the string, or accept the hardcoding and flag it with a TODO comment linking to the engine constant location.
```

---

```
[SEVERITY: MINOR]
Location: main3d.ts line 4
Issue: StatTerrain is imported from '@kijo/engine' but never used directly in main3d.ts. StatDeriver handles terrain internally.
Evidence: `import { BonsaiTree, GrowthEngine, StatDeriver, StatTerrain } from '@kijo/engine';` — StatTerrain does not appear anywhere else in the file. TypeScript compilation with strict unused-import checking (via eslint or `verbatimModuleSyntax`) will flag this.
Fix: Remove StatTerrain from the import line.
```

---

```
[SEVERITY: MINOR]
Location: main2d.ts lines 221-229 / main3d.ts lines 372-380 / display in both views
Issue: matchPct is displayed as a percentage (×100, e.g., "75.3%") but exported as a raw decimal (e.g., 0.753). The Godot KijoStats.from_json consumer must handle this correctly; if it expects an integer percentage (75), it will receive 0.753 and produce wrong stats.
Evidence: Display: `(sheet.matchPct * 100).toFixed(1) + '%'` (both views). Export: `matchPct: sheet.matchPct` — raw StatDeriver output [0, 1]. No Godot-side schema is visible for verification. No comment in the export code clarifies the expected format.
Fix: Add a comment to the export block: `// matchPct: raw 0-1 value; Godot KijoStats.from_json must multiply by 100 to get percentage`. Alternatively, standardise on exporting as a percentage integer to match the display format. Confirm with the Godot consumer.
```

---

```
[SEVERITY: MINOR]
Location: apps/web/src/ui/hud.ts line 68 vs. main2d.ts line 60 / main3d.ts line 286
Issue: Moisture warning thresholds are inconsistent. The App.tsx path (CareHud) warns at moisture < 20; main2d and main3d warn at moisture < 15. Different players see different alert behaviour depending on which view they use.
Evidence: hud.ts line 68: `if (moisture < 20)`. main2d.ts line 60: `tree.getMoisture() < 15`. main3d.ts line 286: `tree.getMoisture() < 15`. The spec (shared/src/index.ts line 29) states optimal moisture is 30-65 but does not define a warning threshold. There is no shared constant.
Fix: Define a `MOISTURE_WARN_LOW` constant in @kijo/shared and use it in all three views. Decide on one threshold; 15 and 20 are both reasonable but must be the same value everywhere.
```

---

```
[SEVERITY: MINOR]
Location: apps/web/src/App.tsx lines 8 / apps/web/src/components/ directory
Issue: App.tsx imports `{ StoreModal }` from `"./components/StoreModal.js"`, but a second component `SeedShopModal.tsx` also exists in the same directory. Both appear to cover seed purchasing. One may be dead code; or they may serve different contexts (main app vs. 2D debug view) with no documentation distinguishing them.
Evidence: Glob of `apps/web/src/components/` returns both `StoreModal.tsx` and `SeedShopModal.tsx`. App.tsx line 8 imports StoreModal only. No import of SeedShopModal appears in App.tsx. No comments in either file explain the distinction.
Fix: If SeedShopModal.tsx is unused, delete it. If it serves a separate entry point (e.g., index2d.html), document that in both files. Dead component files accumulate silently.
```

---

## Summary Table

| Severity | Count |
|----------|-------|
| CRITICAL | 5     |
| MAJOR    | 7     |
| MINOR    | 5     |
| **Total**| **17**|

---

## Overall Verdict: **DO NOT SHIP — CRITICAL BLOCKERS PRESENT**

Five critical defects must be resolved before any of these views are used in production:

1. **Water amount bug** (25 vs 28ml) silently corrupts every watering action in two of three views.
2. **Defense/stability export gap** will break the Godot combat system the moment the spec lands.
3. **Style-blind ghost hint** actively misleads players for 6 out of 7 tree archetypes.
4. **Sekijoju in ADR table** will cause the implementer to build an 8th style that is explicitly prohibited by the authoritative design document.
5. **App.tsx has no stat display** — the primary player-facing UI path ships with the entire progression system invisible.

Beyond the criticals: the wire action is a dangling stub (sold in store, mentioned in tutorial, unimplemented everywhere); style is never shown in any view; the ⅓-rule display in main2d always reads "0 low" due to a type-system misuse; and fertilize/rotate/prune are absent from the App.tsx UI despite being available in the engine.

The two debug views (main2d, main3d) are internally functional for developer testing but cannot serve as the player UI without the stat display, style display, wire action, and correct water amount.
