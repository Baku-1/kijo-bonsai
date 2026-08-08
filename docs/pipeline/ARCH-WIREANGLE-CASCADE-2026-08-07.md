# ARCH-WIREANGLE-CASCADE-2026-08-07

**Stage:** ARCHITECT  
**Bug:** BUG-WIRE-CASCADE — Cascade (Kengai) style is unachievable; wire clamp caps at 80.21°  
**Priority:** Pre-playtesting critical — one of 7 playable styles is permanently blocked  
**Date:** 2026-08-07  
**Author:** Verified Architect (pipeline stage 1)  
**Consumes:** ARCH-BUG5-ANGLE-UNIT-2026-08-07 (branch.angle degrees convention confirmed)  
**Consumed by:** Implementer (disciplined-implementer), then Auditor (adversarial-auditor)

---

## SCOPE

| Field | Value |
|-------|-------|
| DESIGN TASK | Fix the wire angle clamp so players can reach Cascade (Kengai) branch angles (> 90° from vertical) |
| DELIVERABLE | Two constant changes: WireEngine.ts:34 and voxelizer/src/index.ts:221, with supporting analysis |
| BUILDS ON | ARCH-BUG5-ANGLE-UNIT-2026-08-07 (degrees convention); KENGAI_POLAR_MAX = 150 in TwineWeightEngine.ts:28 (already owner-confirmed) |
| CONSUMED BY | Implementer applies two constant changes; Auditor verifies Cascade angles are reachable end-to-end |

---

## CODEBASE RECONNAISSANCE

### Files Read (direct source reads)

| File | Path | Lines Read |
|------|------|------------|
| WireEngine.ts | `packages/engine/src/WireEngine.ts` | All 158 lines |
| voxelizer/src/index.ts | `packages/voxelizer/src/index.ts` | All 274 lines |
| BonsaiTree.ts | `packages/engine/src/BonsaiTree.ts` | All 368 lines |
| TwineWeightEngine.ts | `packages/engine/src/TwineWeightEngine.ts` | All 213 lines |
| ARCH-BUG5-ANGLE-UNIT-2026-08-07.md | `docs/pipeline/` | Complete cross-reference |

### Symbols Verified

| Symbol | File | Line | Status | Notes |
|--------|------|------|--------|-------|
| `POLAR_MIN_DEG = 5.7296` | WireEngine.ts | 33 | ✓ verified | `// 0.1 rad`; private const |
| `POLAR_MAX_DEG = 80.2141` | WireEngine.ts | 34 | ✓ verified — **BUG SITE #1** | `// 1.4 rad`; must change to 150 |
| `WIRE_MAX_ANGLE_DELTA = 45` | WireEngine.ts | 27 | ✓ verified | Degrees, exported; unchanged |
| `KENGAI_POLAR_MAX = 150` | TwineWeightEngine.ts | 28 | ✓ verified — **TARGET VALUE** | Exported; comment: "Max cascade angle for any branch (Kengai/cascade style)." Owner already decided the value; WireEngine and voxelizer were never updated to match. |
| Voxelizer polar clamp | voxelizer/src/index.ts | 221 | ✓ verified — **BUG SITE #2** | `Math.max(0.1, Math.min(1.4, Math.abs(b.angle) * Math.PI / 180))` — 1.4 rad must change to `150 * Math.PI / 180` |
| `rotateDirection()` | voxelizer/src/index.ts | 86–97 | ✓ verified | `cosP*p + sinP*rotU`; mathematically correct for polar 0 to π |
| `Math.sin(toRad(b.angle))` | BonsaiTree.ts | 71 | ✓ verified | Weight torque formula; sin(>90°) stays positive — correct physics |
| `clamp(oldAngle+delta, POLAR_MIN_DEG, POLAR_MAX_DEG)` | WireEngine.ts | 75 | ✓ verified | wire() — uses POLAR_MAX_DEG |
| `clamp(b.angle−springBackAmount, POLAR_MIN_DEG, POLAR_MAX_DEG)` | WireEngine.ts | 142 | ✓ verified | removeWire() — uses POLAR_MAX_DEG |
| Phase 2 TODO refs to POLAR_MAX_DEG | TwineWeightEngine.ts | 145, 185 | ✓ noted | Comments only — not live code; Phase 2 implementer must use new value |

### Call Sites for POLAR_MAX_DEG

`POLAR_MAX_DEG` is a `const` private to WireEngine.ts. Only two usages exist in the file:

| Location | Context |
|----------|---------|
| WireEngine.ts:75 | `clamp(oldAngle + delta, POLAR_MIN_DEG, POLAR_MAX_DEG)` in `wire()` |
| WireEngine.ts:142 | `clamp(b.angle - springBackAmount, POLAR_MIN_DEG, POLAR_MAX_DEG)` in `removeWire()` |

Both usages automatically pick up the new value when the constant is changed. No caller-side updates needed.

### Call Sites for the Voxelizer Polar Clamp Literal

| Location | Context |
|----------|---------|
| voxelizer/src/index.ts:221 | `Math.max(0.1, Math.min(1.4, Math.abs(b.angle) * Math.PI / 180))` in `computePositions()` |

Single occurrence. Update in place.

### No Engine Test Files

Confirmed by ARCH-BUG5 spec: `find packages/engine -name "*.test.ts"` returns empty. Only test file is `packages/contracts/test/Kijonsai.test.ts` (Solidity on-chain — not affected).

### Gaps Found

- `KENGAI_POLAR_MAX = 150` exists in TwineWeightEngine (line 28) as an owner-confirmed constant, but WireEngine and the voxelizer never import or reference it. This is the proximate cause of the bug: the correct value was established but not propagated.
- TwineWeightEngine Phase 2 TODO comments at lines 145 and 185 informally reference `POLAR_MIN_DEG` and `POLAR_MAX_DEG` by name (these names belong to WireEngine's private scope). Phase 2 implementer should use `KENGAI_POLAR_MAX` or the numeric value 150 rather than these names. No action required now.

---

## PROBLEM STATEMENT

`WireEngine.ts` clamps `branch.angle` to `POLAR_MAX_DEG = 80.2141°` (= 1.4 rad). The voxelizer independently applies the same cap at line 221. Cascade (Kengai) style requires the trunk to cascade past horizontal — a minimum of ~91°+ from vertical — which neither system can produce.

A player applying successive wire actions starting from 30°:

| Action | Expected angle | Actual angle (pre-fix) |
|--------|---------------|------------------------|
| Wire +45° | 75° | 75° |
| Wire +45° | 120° | **80.21° (capped)** |
| Wire +45° | 165° | **80.21° (capped)** |

Cascade is permanently unachievable regardless of how many wire actions a player applies.

`TwineWeightEngine.ts:28` already declares `export const KENGAI_POLAR_MAX = 150` with the comment "Max cascade angle for any branch (Kengai/cascade style)." The owner decision was made; the bug is that WireEngine and the voxelizer were never updated to match.

---

## ROOT CAUSE

Two independent subsystems hardcode 1.4 rad (80.21°) as the maximum polar angle:

1. **WireEngine.ts line 34** — `POLAR_MAX_DEG = 80.2141` gates the angle a player can reach via wire actions.
2. **voxelizer/src/index.ts line 221** — `Math.min(1.4, ...)` gates the angle the renderer will display, even if WireEngine somehow stored a higher value.

The correct target `KENGAI_POLAR_MAX = 150°` (2.6180 rad) was already defined in `TwineWeightEngine.ts` as an exported owner-confirmed constant but was never applied to either subsystem.

---

## VERIFICATION LOG

### Verified

- ✓ **`KENGAI_POLAR_MAX = 150°` is owner-confirmed** — TwineWeightEngine.ts:28 reads: `export const KENGAI_POLAR_MAX = 150; // °` with JSDoc comment: "Max cascade angle for any branch (Kengai/cascade style)." This is the authoritative target for WireEngine and voxelizer upper bounds.

- ✓ **Real Cascade (Kengai) requires branch angle > 90° from vertical** — Per Bonsai Learning Center (citing Naka's *Bonsai Techniques*): "Full cascade trunk flows downward below the pot's base." Per Bonsai Society of Greater Cincinnati: "cascade style has the apex of the tree below the base of the pot." By the Kijo angle convention (0° = vertical up, 90° = horizontal, 180° = vertical down), any branch whose apex descends below the pot's rim must have angle > 90°.

- ✓ **Han-Kengai (semi-cascade) max ≈ 90°–135°; Kengai max ≈ 120°–150°** — BSGC: semi-cascade "no more than 45 degrees below horizontal" = 90° + 45° = 135° from vertical. Bonsai Learning Center: semi-cascade "to just below horizontal" (≈90°–100°), full cascade "below the pot's base" (implying substantially steeper). 150° (= 30° above straight-down) accommodates extreme Kengai while keeping branches from the degenerate 180° (straight-down) case.

- ✓ **`rotateDirection()` handles polar > π/2 correctly** — Verified in voxelizer/src/index.ts:86–97. Formula: `cosP*p + sinP*rotU`. At polar = 150° (2.618 rad): cosP = cos(150°) = −0.866, sinP = sin(150°) = 0.5. For trunk parent `{0,1,0}`: result y ≈ −0.866 (large downward component). Geometrically correct for a cascade branch. No code path breaks at polar = 150°.

- ✓ **Voxel grid bounds safe at 150°** — BASE = {x:128, y:38, z:128}. Worst-case branch: trunk at 150°, length 20. Δy = 20 × cos(150°) = −17.3 voxels → y = 38 − 17.3 = 20.7. Well within 0–255 grid. SparseVoxelSet.set() additionally clamps to [0, 255] as a safety net.

- ✓ **`Math.sin(toRad(b.angle))` correct for angles > 90°** — BonsaiTree.ts:71 weight torque: `b.length * Math.sin(toRad(b.angle))`. sin(120°) = 0.866, sin(135°) = 0.707, sin(150°) = 0.5 — all positive. Gravity torque remains physically meaningful (decreasing as branch approaches vertical-down, correct for real physics). No change to BonsaiTree.ts.

- ✓ **Three.js Spherical supports polar 0 to π in radians** — Confirmed per ARCH-BUG5 spec citation: threejs.org/docs/pages/Spherical.html. The voxelizer's conversion `b.angle * π/180` is the correct bridge from Kijo degrees to WebGL radians, and supports all angles up to 180°.

- ✓ **ez-tree branch.angle stored in degrees** — Confirmed per ARCH-BUG5 spec citation: github.com/dgreenheck/ez-tree README. Kijo degree convention is standard in Three.js procedural tree implementations.

- ✓ **No engine test files to update** — Confirmed: `packages/engine` contains no `.test.ts` or `.spec.ts` files. Only `packages/contracts/test/Kijonsai.test.ts` exists (Solidity, unaffected).

### Unverified

- ? **ez-tree internal polar angle cap value** — Raw GitHub source fetch returned empty (JS-rendered page). ARCH-BUG5's citation of the README was sufficient for the degrees convention claim; the specific internal cap value is not needed for this spec.

### Refuted

- ✗ **"Voxelizer clamp is a rendering-only issue and can be fixed independently"** — REFUTED. If only WireEngine.ts is fixed but the voxelizer clamp is not, WireEngine would correctly store 120° in `b.angle` but `computePositions()` at line 221 would still cap the rendering to 80.21°. Player would wire a Cascade tree that renders identically to a 80°-angled tree. Both bug sites must be fixed together.

---

## CODE SOURCE AUDIT

No external code snippets are proposed. All changes are constant-value updates to existing lines in the codebase. No audit needed.

---

## THE FIX

### Fix 1 — WireEngine.ts (two changes in the same file)

**Change 1a — constant value (line 34):**

```diff
-const POLAR_MAX_DEG = 80.2141; // 1.4 rad
+const POLAR_MAX_DEG = 150;     // 2.618 rad — matches KENGAI_POLAR_MAX (TwineWeightEngine.ts:28)
```

**Change 1b — block comment update (line 19):**

```diff
-// Voxelizer polar clamp [0.1, 1.4] rad, in degrees. For depth-1 branches the
-// parent is the trunk (straight up), so branch angle == polar angle.
+// Polar angle clamp [0.1, 2.618] rad expressed in degrees [5.73°, 150°].
+// Upper bound = KENGAI_POLAR_MAX (TwineWeightEngine.ts:28) — enables Cascade (Kengai) style.
+// For depth-1 branches the parent is the trunk (straight up), so branch angle == polar angle.
```

### Fix 2 — voxelizer/src/index.ts (line 221)

```diff
-    const polar = Math.max(0.1, Math.min(1.4, Math.abs(b.angle) * Math.PI / 180));
+    const polar = Math.max(0.1, Math.min(150 * Math.PI / 180, Math.abs(b.angle) * Math.PI / 180)); // 150° = KENGAI_POLAR_MAX
```

`150 * Math.PI / 180 ≈ 2.6180 rad`. The `150 * Math.PI / 180` form is preferred over the pre-computed literal because it makes the degree value obvious to future readers.

### Why only these two files

| File | Verdict | Reason |
|------|---------|--------|
| `packages/engine/src/WireEngine.ts` | **CHANGE** | Bug site #1 — POLAR_MAX_DEG is wrong |
| `packages/voxelizer/src/index.ts` | **CHANGE** | Bug site #2 — voxelizer polar cap is wrong |
| `packages/engine/src/BonsaiTree.ts` | No change | `Math.sin(toRad(b.angle))` correct for all angles |
| `packages/engine/src/TwineWeightEngine.ts` | No change | `KENGAI_POLAR_MAX = 150` is already the correct value |
| `packages/engine/src/GrowthEngine.ts` | No change | BUG-5 fix (angle unit) is a separate concern |
| `packages/engine/src/tree.ts` | No change | Legacy path, not wired through WireEngine |
| `packages/engine/src/CareLogReplay.ts` | No change | Propagates through engine methods, auto-fixed |
| `packages/contracts/` | No change | Solidity; not affected |

---

## VOXELIZER IMPACT ANALYSIS

### rotateDirection() at angles > 90°

The `rotateDirection(parent, polar, azimuthal)` function computes the new branch direction as:

```
result = cos(polar) × parent + sin(polar) × rotU
```

where `parent` is the parent branch unit direction vector and `rotU` is a perpendicular vector in the plane of rotation. For the trunk parent `{0, 1, 0}` (straight up):

| polar | cos(polar) | sin(polar) | y-component of result | Visual |
|-------|-----------|-----------|----------------------|--------|
| 80.21° (current max) | +0.170 | +0.985 | +0.170 (upward lean) | Max current capability |
| 90° | 0 | +1.000 | 0 (horizontal) | Horizontal |
| 120° | −0.500 | +0.866 | −0.500 (downward) | Han-Kengai / early Cascade |
| 135° | −0.707 | +0.707 | −0.707 (steep down) | Cascade |
| 150° | −0.866 | +0.500 | −0.866 (near-vertical down) | Extreme Cascade |

All values are numerically well-defined. No degenerate cases. The function was always capable of producing cascade directions — it was only the upstream clamp preventing inputs from reaching those values.

### Grid overflow check

`SparseVoxelSet` key encoding: `((x & 0xFF) << 16) | ((y & 0xFF) << 8) | (z & 0xFF)` — 0–255 on each axis. `set()` clamps at line 38–40: `x = Math.max(0, Math.min(255, Math.round(x)))`.

For a trunk at 150°, length 20, from BASE `{128, 38, 128}`:
- Δy = 20 × cos(150°) ≈ −17.3 → y = 38 − 17.3 = **20.7** ✓ (in bounds)
- Horizontal components add up to ≤ 20 from center → x,z: 128 ± 20 = [108, 148] ✓

No overflow risk. Extreme cascade branches stay well within the 256³ grid.

---

## DOWNSTREAM CONSUMER ANALYSIS

| Consumer | How `b.angle` is used | Handles > 90°? | Action needed |
|----------|-----------------------|----------------|---------------|
| `WireEngine.wire()` | `clamp(old+delta, POLAR_MIN_DEG, POLAR_MAX_DEG)` | After Fix 1: yes | **Fix 1** |
| `WireEngine.removeWire()` | `clamp(angle−springback, POLAR_MIN_DEG, POLAR_MAX_DEG)` | After Fix 1: yes | **Fix 1** |
| `Voxelizer.computePositions()` | `Math.min(1.4, b.angle * π/180)` for polar | After Fix 2: yes | **Fix 2** |
| `BonsaiTree step 4a` (weight) | `b.length * Math.sin(toRad(b.angle))` | Yes — sin(90°–150°) > 0 | No change |
| `BonsaiTree step 4a` (twine) | `Math.sin(toRad(b.twineAngle))` | twineAngle is a delta, not absolute | No change |
| `TwineWeightEngine` Phase 2 stubs | TODO comments referencing POLAR_MIN_DEG / POLAR_MAX_DEG | N/A (comments, not live code) | Phase 2 implementer uses 150° |
| `tree.ts tick()` | Assigns `forkAngle` (legacy path, not through WireEngine) | n/a | No change |
| `GrowthEngine.extendAndFork()` | Writes `b.angle` (BUG-5 concern) — does not read POLAR_MAX | n/a | No change |

---

## DONE CRITERIA

### D1 — WireEngine constant updated

- [ ] WireEngine.ts:34 reads: `const POLAR_MAX_DEG = 150;` with inline comment referencing `KENGAI_POLAR_MAX`
- [ ] WireEngine.ts block comment (line 19 area) updated from `[0.1, 1.4] rad` to `[0.1, 2.618] rad`
- [ ] No other constant in WireEngine.ts is modified

### D2 — Voxelizer clamp updated

- [ ] voxelizer/src/index.ts:221 upper bound changed from `1.4` to `150 * Math.PI / 180` with comment `// 150° = KENGAI_POLAR_MAX`
- [ ] No other line in voxelizer/src/index.ts is modified

### D3 — Cascade angles reachable (verify programmatically)

```
const tree = new BonsaiTree(12345, 'hardwood');
// Advance enough days for trunk to exist; initial trunk angle = 0
tree.wire(0, 45);  // → clamped to 45 but must be >= 5.73 (POLAR_MIN)
tree.wire(0, 45);  // → 90 (horizontal)
tree.wire(0, 45);  // → 135 (cascade territory — BLOCKED pre-fix, reachable post-fix)
assert(tree.getBranches()[0].angle >= 120);  // must pass post-fix
```

- [ ] After 3 wire actions of +45° from 5.73° start: final angle ≥ 120°
- [ ] After 3 wire actions of +45° from 5.73° start: final angle ≤ 150° (cap respected)
- [ ] Pre-fix: same sequence produces angle = 80.21° (verify fix actually changes behavior)

### D4 — Voxelizer renders cascade geometry

- [ ] Voxelize a tree with trunk `b.angle = 120°`
- [ ] At least some trunk voxels have y < BASE.y (38) — branch extends downward below base
- [ ] No ArrayBuffer overflow or key collision in SparseVoxelSet

### D5 — Sub-90° wire behavior unchanged

- [ ] Wire a branch from 30° with +10° delta → newAngle = 40° (unchanged for angles well below 90°)
- [ ] Spring-back on early removeWire still clamps to valid [POLAR_MIN_DEG, new POLAR_MAX_DEG] range

### D6 — TypeScript compiles

- [ ] `tsc --noEmit` in `packages/engine` — no errors
- [ ] `tsc --noEmit` in `packages/voxelizer` — no errors

---

## CROSS-REFERENCE CHECK

| Document | Consistent? | Notes |
|----------|-------------|-------|
| ARCH-BUG5-ANGLE-UNIT-2026-08-07.md | ✓ | Confirms degrees convention; says `voxelizer Already correct — * Math.PI / 180 is the right bridge` — that referred to the formula, not the cap value. This spec fixes the cap, not the formula. No contradiction. |
| ARCHITECT-BRANCH-PHYSICS-2026-08-01.md | ✓ | Physics torque `sin(toRad(b.angle))` is correct per that spec; we don't change it |
| GDD s3.2 (referenced in WireEngine comment) | ✓ | `WIRE_MAX_ANGLE_DELTA = 45°` per action is unchanged; only the cumulative cap changes |
| TwineWeightEngine.ts `KENGAI_POLAR_MAX = 150` | ✓ | This spec is the delayed propagation of that existing constant |

No inconsistencies found.

---

## OPEN QUESTIONS

### OQ-1 (non-blocking): Import KENGAI_POLAR_MAX vs. hardcode 150

The voxelizer already imports from `@kijo/engine` (for `StatTerrain`). It could import `KENGAI_POLAR_MAX` directly to keep both subsystems in sync if the value ever changes. Recommended: for now, use the inline comment `// 150° = KENGAI_POLAR_MAX` to establish traceability without adding a new import dependency. Revisit when Phase 2 physics are implemented.

### OQ-2 (non-blocking): POLAR_MIN_DEG unchanged

Currently 5.7296° (0.1 rad). No Cascade concern involves the minimum. Tropical branches at minimum GrowthEngine spread (5.73°, per ARCH-BUG5 OQ-BUG5-3) hit this floor — this is expected and acceptable. Leave POLAR_MIN_DEG at 5.7296 / voxelizer at 0.1.

### OQ-3 (non-blocking): Phase 2 TwineWeightEngine clamp sites

TwineWeightEngine.ts TODO comments at lines 145 and 185 informally name `POLAR_MIN_DEG` and `POLAR_MAX_DEG` as if they were importable from WireEngine. They are not exported. Phase 2 implementer should use `KENGAI_POLAR_MAX` (already exported) or the literal value 150 for the angle clamp in `removeTwine()` and `removeWeight()`. No action required now; flag for Phase 2.

### OQ-4 (non-blocking): Minimum wire actions to reach Cascade

With POLAR_MAX_DEG = 150°, a player starting from a GrowthEngine-grown hardwood branch (angle ≈ 28°–57°) needs:
- From 30°: wire 1 → 75°, wire 2 → 120° (Cascade). 2 actions to reach Cascade.
- From 57° (max hardwood fork): wire 1 → 102° (Cascade on first wire). 1 action.

This seems very fast. GDD s3.2 should specify the intended minimum wire count for Cascade — owner may want to require more actions (e.g., 3 wires) to make Cascade a meaningful achievement. If so, either reduce `WIRE_MAX_ANGLE_DELTA` or increase the required Cascade threshold. This is a playtest-tuning question, not a bug fix concern.

---

## EXTERNAL CITATIONS

1. **Bonsai Learning Center, "Cascade and Semi-Cascade Bonsai: Embracing Nature's Flow" (2025, citing John Naka's *Bonsai Techniques*)**  
   "Semi-cascade trunk flows downward from the soil line at an angle between 45° above horizontal to just below horizontal."  
   "Full cascade trunk flows downward below the pot's base."  
   URL: https://bonsailearningcenter.com/cascade-and-semi-cascade-bonsai-embracing-natures-flow/  
   Grounds: Kengai requires angle past horizontal (> 90° from vertical). Han-Kengai max ≈ 90°–100°.

2. **Bonsai Society of Greater Cincinnati — "Cascade 'Kengai'" and "Semi-cascade 'Han-kengai'"**  
   Semi-cascade: "the trunk typically bends at an angle of no more than 45 degrees below horizontal" → 135° from vertical max.  
   Cascade: "the apex of the tree [is] below the base of the pot."  
   URLs: https://cincinnatibonsai.org/cascade-kengai | https://cincinnatibonsai.org/semi-cascade-han-kengai  
   Grounds: Han-Kengai max 135°; Kengai requires angles beyond that (up to ~150°). KENGAI_POLAR_MAX = 150° is consistent with both style requirements.

3. **Bonsai Empire, "Bonsai styles, shapes and forms"**  
   "Cascade Bonsai style (Kengai): The tree should grow upright for a small stretch but then bend downward."  
   "Semi-cascade style: the semi-cascade trunk will never grow below the bottom of the pot" (implying cascade does).  
   URL: https://www.bonsaiempire.com/origin/bonsai-styles  
   Grounds: Corroborates the below-pot-bottom requirement for Kengai (> 90° from vertical).

4. **Three.js Spherical documentation — polar angle 0 to π in radians**  
   URL: https://threejs.org/docs/#api/en/math/Spherical  
   Grounds: The voxelizer's `b.angle * Math.PI / 180` formula is correct for the full 0°–180° range. `rotateDirection()` uses standard spherical math that handles polar > π/2 without modification. (Confirmed in ARCH-BUG5-ANGLE-UNIT-2026-08-07.md.)

5. **ez-tree (github.com/dgreenheck/ez-tree, MIT license, Three.js) — branch.angle in degrees**  
   README: "angle: Defines the angle, in degrees, at which child branches grow relative to their parent branch."  
   URL: https://github.com/dgreenheck/ez-tree  
   Grounds: Corroborates Kijo degree convention; degrees-to-radians conversion at the voxelizer boundary is standard practice. (Confirmed in ARCH-BUG5-ANGLE-UNIT-2026-08-07.md.)

---

## ASSUMPTIONS

1. **KENGAI_POLAR_MAX = 150° is a finalized owner decision**, not a placeholder. Evidence: exported constant in TwineWeightEngine.ts with explicit JSDoc comment naming the style. If the owner wants a different max, the constant should change in TwineWeightEngine.ts first, and this fix will use whatever value it resolves to.

2. **The voxelizer is expected to render branches at their actual wired angle**, not clip them for visual cleanliness. If the owner wants a visual cap different from the physics cap (e.g., wire allows 150° but voxelizer only renders up to 120°), the two constants can be separated. Not recommended — divergence between physics and render is a source of player confusion.

3. **`Math.abs(b.angle)` in the voxelizer is correct as-is**. Angles from WireEngine are always positive (clamped to [POLAR_MIN_DEG, POLAR_MAX_DEG]). Angles from GrowthEngine after the BUG-5 fix can be negative (side × spread × 180/π, where side ∈ {−1, +1}). The abs() handles both cases. Do not remove it.
