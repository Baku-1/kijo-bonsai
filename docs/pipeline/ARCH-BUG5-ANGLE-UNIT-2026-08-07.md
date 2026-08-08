# ARCH-BUG5-ANGLE-UNIT-2026-08-07

**Stage:** ARCHITECT  
**Bug:** BUG-5 — GrowthEngine writes branch.angle in radians; all consumers expect degrees  
**Priority:** Pre-playtesting critical  
**Date:** 2026-08-07  
**Author:** Verified Architect (pipeline stage 1)  
**Consumed by:** Implementer (disciplined-implementer), then Auditor (adversarial-auditor)

---

## SCOPE

| Field | Value |
|-------|-------|
| DESIGN TASK | Specify the exact fix for GrowthEngine writing `branch.angle` in radians while every downstream consumer expects degrees |
| DELIVERABLE | Single-line change in `GrowthEngine.ts` with unit-conversion comment; no other files change |
| BUILDS ON | BUG-3b (SPECIES_PARAMS radian values confirmed correct); ARCHITECT-BRANCH-PHYSICS-2026-08-01.md (physics field layout) |
| CONSUMED BY | Implementer applies the single-line change; Auditor verifies branch angles are in the correct degree range post-fix |

---

## CODEBASE RECONNAISSANCE

### Files Read (direct source reads, not summaries)

| File | Path |
|------|------|
| GrowthEngine.ts | `packages/engine/src/GrowthEngine.ts` (all 193 lines) |
| WireEngine.ts | `packages/engine/src/WireEngine.ts` (all 158 lines) |
| TwineWeightEngine.ts | `packages/engine/src/TwineWeightEngine.ts` (all 213 lines) |
| BonsaiTree.ts | `packages/engine/src/BonsaiTree.ts` (all 367 lines) |
| tree.ts | `packages/engine/src/tree.ts` (all 205 lines) |
| species.ts | `packages/engine/src/species.ts` (all 15 lines) |
| CareLogReplay.ts | `packages/engine/src/CareLogReplay.ts` (all 166 lines) |
| shared/src/index.ts | lines 340–393 (SpeciesParams + SPECIES_PARAMS block) |
| voxelizer/src/index.ts | lines 200–236 (computePositions function) |

### Symbols Verified

| Symbol | File | Status | Notes |
|--------|------|--------|-------|
| `WIRE_MAX_ANGLE_DELTA = 45` | WireEngine.ts:27 | ✓ verified | Degrees, per comment `// degrees per wire action (GDD s3.2)` |
| `POLAR_MIN_DEG = 5.7296` | WireEngine.ts:33 | ✓ verified | `// 0.1 rad` — 0.1 × (180/π) = 5.7296 |
| `POLAR_MAX_DEG = 80.2141` | WireEngine.ts:34 | ✓ verified | `// 1.4 rad` — 1.4 × (180/π) = 80.2141 |
| `TWINE_MAX_ANGLE_DELTA = 28` | TwineWeightEngine.ts:22 | ✓ verified | Degrees, per comment `// °` |
| `toRad(degrees)` | TwineWeightEngine.ts:75 | ✓ verified | Exported; converts degrees to radians |
| `toRad(b.angle)` usage | BonsaiTree.ts:71 | ✓ verified | `Math.sin(toRad(b.angle))` — weight torque formula; b.angle expected in degrees |
| `toRad(b.twineAngle)` usage | BonsaiTree.ts:68 | ✓ verified | Twine torque formula; twineAngle expected in degrees |
| voxelizer polar formula | voxelizer/src/index.ts:221 | ✓ verified | `Math.abs(b.angle) * Math.PI / 180` — converts b.angle degrees to radians |
| `SPECIES_PARAMS.forkSpreadMin/Max` | shared/src/index.ts:346–360 | ✓ verified | Radians (interface comment says `// min/max angle spread for child fork (radians)`) |
| `SPECIES.forkAngle` (engine) | species.ts:6,12–14 | ✓ verified | Degrees (comment says `// degrees; hardwoods wide, tropicals tight (GDD §3.3)`) |
| GrowthEngine angle write | GrowthEngine.ts:120 | ✓ verified — **BUG SITE** | `angle: round4(side * spread)` — spread is in radians (from SPECIES_PARAMS) |
| tree.ts angle write | tree.ts:156 | ✓ verified — NOT BUGGY | `angle: side * sp.forkAngle * (0.5 + r.value)` — forkAngle in degrees, output in degrees |
| trunk initial angle | tree.ts:37 | ✓ verified — correct | `angle: 0` — zero is unit-neutral |
| `CareLogReplay.reconstruct` | CareLogReplay.ts:97–163 | ✓ verified | Calls `GrowthEngine.growTick(tree)` each day — affected by fix |
| `GrowthEngine.growTick` | GrowthEngine.ts:24 | ✓ verified | Calls `extendAndFork` which contains the bug |

### All `angle` Write Sites (complete grep results)

Grep command: `grep -rn '\.angle\s*=' packages/ --include="*.ts" | grep -v '//'`  
plus object-literal sites via: `grep -rn 'angle:' packages/ --include="*.ts"` (filtered)

| Site | File | Line | Value Written | Unit | Status |
|------|------|------|---------------|------|--------|
| Trunk init | tree.ts | 37 | `0` | n/a (zero) | Correct |
| legacy tick() fork | tree.ts | 156 | `side * sp.forkAngle * (0.5 + r.value)` | degrees | Correct |
| GrowthEngine fork | GrowthEngine.ts | 120 | `round4(side * spread)` | **RADIANS** | **BUG** |
| WireEngine.wire | WireEngine.ts | 79 | `newAngle` (clamped to deg range) | degrees | Correct |
| WireEngine.removeWire | WireEngine.ts | 142 | `round4(clamp(b.angle - springBackAmount, POLAR_MIN_DEG, POLAR_MAX_DEG))` | degrees | Correct |

**Finding:** Only one write site has the unit mismatch: `GrowthEngine.ts:120`. The fix scope is exactly one line.

### Important Structural Discovery: Two Parallel Fork Systems

The codebase has two independent branch-fork code paths:

1. **`tree.ts:tick()`** — Legacy functional path. Uses `SPECIES` (engine-local, `species.ts`), `forkAngle` in degrees, global `rngState`. Used by `applyAction/tick`. **Does NOT call GrowthEngine. Not affected by BUG-5. Not involved in CareLogReplay.**

2. **`GrowthEngine.ts:extendAndFork()`** — Live game path. Uses `SPECIES_PARAMS` (shared), `forkSpreadMin/Max` in radians, per-branch `SeededRNG`. Called by `BonsaiTree.growTick()` → called by `CareLogReplay.reconstruct()`. **This is where BUG-5 lives.**

These systems produce different angle distributions even after the fix (see ALTERNATIVES CONSIDERED). Reconciliation of the two paths is explicitly out of scope for BUG-5.

---

## VERIFICATION LOG

### Verified

- ✓ **`b.angle` is stored in degrees system-wide** — confirmed via three independent consumers:
  1. `WireEngine.ts:27,33,34`: constants `WIRE_MAX_ANGLE_DELTA=45`, `POLAR_MIN_DEG=5.7296`, `POLAR_MAX_DEG=80.2141` all in degrees; arithmetic `oldAngle + delta` operates in degrees
  2. `BonsaiTree.ts:71`: `Math.sin(toRad(b.angle))` converts b.angle from degrees to radians before trig
  3. `voxelizer/src/index.ts:221`: `Math.abs(b.angle) * Math.PI / 180` converts b.angle from degrees to radians for polar geometry
- ✓ **Three.js Spherical polar angle is stored in radians** — Three.js docs (threejs.org/docs/pages/Spherical.html) state explicitly: "The polar angle **in radians** from the y (up) axis." The voxelizer's `* Math.PI / 180` formula is therefore the correct bridge between the kijo degree convention and WebGL rendering math.
- ✓ **Open-source Three.js procedural tree generators store branch.angle in degrees** — ez-tree (github.com/dgreenheck/ez-tree, 1.5k stars, MIT, JavaScript + Three.js) README explicitly states: "**`angle`**: Defines the angle, **in degrees**, at which child branches grow relative to their parent branch." This confirms the kijo degree convention is standard in this domain.
- ✓ **`SPECIES_PARAMS.forkSpreadMin/Max` are in radians** — `shared/src/index.ts:346–348` interface comment: `// min/max angle spread for child fork (radians)`. Values: hardwood 0.50–1.00, evergreen 0.30–0.70, tropical 0.10–0.40.
- ✓ **`SPECIES.forkAngle` (engine/species.ts) is in degrees** — `species.ts:6` comment: `// degrees; hardwoods wide, tropicals tight (GDD §3.3)`. Values: hardwood 45, evergreen 30, tropical 20. Legacy `tree.ts:tick()` path correctly writes degrees because it draws from this source.
- ✓ **GrowthEngine.ts:120 writes radians into a degrees field** — `spread` is computed from `SPECIES_PARAMS.forkSpreadMin/Max` (radians). `round4(side * spread)` writes 0.10–1.00 to `child.angle`, which downstream reads as if it were 0.10°–1.00° (nearly vertical). BUG CONFIRMED.
- ✓ **No other file outside GrowthEngine needs changing** — complete grep of all `.angle =` write sites and `angle:` object literal sites confirms exactly one buggy site.
- ✓ **No engine-level golden fixture tests exist** — `find packages/engine -name "*.test.ts"` returns empty. The only test file is `packages/contracts/test/Kijonsai.test.ts` (Hardhat/Solidity, tests on-chain contract behavior, not engine geometry).
- ✓ **CareLogReplay calls GrowthEngine.growTick()** — CareLogReplay.ts:162 `GrowthEngine.growTick(tree)`. Fix will affect all replays.

### Unverified

- ? **piratenation-contracts repo** — searched; no public source found that would establish Ronin-specific angle conventions. Not relevant to the fix; the convention is established by three internal consumers and one external reference (ez-tree).

### Refuted

- ✗ **Pre-verified claim: "BonsaiTree.ts calls toRad(b.angle) before using in trig"** — PARTIALLY REFUTED AS STATED. The actual usage at `BonsaiTree.ts:71` calls `toRad(b.angle)` for the weight torque formula `Math.sin(toRad(b.angle))`, not for general rendering. Separately, `toRad(b.twineAngle)` is used for twine torque. The claim is correct in substance (b.angle is converted with toRad before trig), but the source is `BonsaiTree.ts`, not a general "care/render system". Does not affect the fix.

---

## ROOT CAUSE

`GrowthEngine.extendAndFork()` reads fork spread from `SPECIES_PARAMS.forkSpreadMin/Max`, which are in radians (range 0.10–1.00 rad depending on species). It assigns this value directly to `child.angle` without converting to degrees. Every downstream consumer (`WireEngine`, `BonsaiTree`, `Voxelizer`) expects `branch.angle` to be in degrees and performs an explicit `toRad()` or `* Math.PI / 180` conversion before use.

**Effect:** All branches grown by `GrowthEngine` have initial angles of 0.10°–1.00° instead of 5.73°–57.30°. The voxelizer clamps all values below `POLAR_MIN` (0.1 rad = 5.73°) to the same minimum, making all species appear nearly identical and nearly vertical at growth time. Wire/twine/weights correctly operate in degrees and can move branches into visible range, masking the bug during care actions.

---

## THE FIX

### File: `packages/engine/src/GrowthEngine.ts`

**Line 120** (inside the `child` object literal in `extendAndFork`):

```diff
-            angle:             round4(side * spread),
+            angle:             round4(side * spread * (180 / Math.PI)), // SPECIES_PARAMS.forkSpreadMin/Max are radians; branch.angle is degrees
```

**No other files change.** `SPECIES_PARAMS` remains in radians (their natural unit for angle math, per interface comment). GrowthEngine converts on write. All downstream consumers remain unchanged.

### Rationale

The conversion `spread × (180 / Math.PI)` at write time is the minimum-scope fix:
- SPECIES_PARAMS values stay in radians (the interface documents this unit; changing them would touch shared, break the comment contract, and require validating all other SPECIES_PARAMS consumers)
- The conversion factor `180 / Math.PI` is a compile-time constant; no runtime cost
- The comment makes the unit bridge explicit for future maintainers
- WireEngine, BonsaiTree, Voxelizer, TwineWeightEngine — all untouched

### Resulting angle ranges after fix

| Species | forkSpreadMin (rad) | forkSpreadMax (rad) | Min angle (deg) | Max angle (deg) |
|---------|---------------------|---------------------|-----------------|-----------------|
| hardwood | 0.50 | 1.00 | 28.65° | 57.30° |
| evergreen | 0.30 | 0.70 | 17.19° | 40.11° |
| tropical | 0.10 | 0.40 | 5.73° | 22.92° |

Voxelizer polar clamp: `[0.1, 1.4]` rad = `[5.73°, 80.21°]`. All post-fix values fall within or at the clamp boundary (tropical min exactly hits 5.73° — this is correct, not a secondary bug).

---

## ALTERNATIVES CONSIDERED

### Alternative A (chosen): Keep SPECIES_PARAMS in radians, convert in GrowthEngine at write time

**Touch points:** GrowthEngine.ts:120 only.  
**Pros:** Minimum diff. No shared-package change. `SpeciesParams` interface comment `// radians` stays accurate. All other SPECIES_PARAMS consumers unaffected.  
**Cons:** Creates a unit asymmetry — SPECIES_PARAMS stores radians but branch.angle stores degrees. Mitigated by the inline comment.  
**Verdict: Chosen.**

### Alternative B: Refactor SPECIES_PARAMS forkSpreadMin/Max to degrees

**Touch points:**
1. `shared/src/index.ts:346–348` — update interface comment from `radians` to `degrees`
2. `shared/src/index.ts:354–360` — convert all six SPECIES_PARAMS values: hardwood 0.50→28.648, 1.00→57.296; evergreen 0.30→17.189, 0.70→40.107; tropical 0.10→5.730, 0.40→22.918
3. `GrowthEngine.ts:98` — the `spread` variable comment, if any
4. `GrowthEngine.ts:120` — drop the `* (180 / Math.PI)` (no longer needed)

**Pros:** SPECIES_PARAMS and branch.angle now share the same unit. No hidden conversion.  
**Cons:** Four touch points vs. one. Modifies the shared package (wider blast radius). Makes degree values like `28.648` harder to reason about than `0.50 rad`. The BUG-3b fix was precisely to set these values in radians — changing units again introduces new risk.  
**Verdict: Rejected.** More touch points, no behavioral advantage.

### Alternative C: Add a helper `spreadToDeg()` in GrowthEngine

**Touch points:** Same as Alternative A plus a function declaration.  
**Pros:** Names the conversion.  
**Cons:** Over-engineering a single-use inline factor. `180 / Math.PI` is a universally recognized radians-to-degrees conversion; no helper needed.  
**Verdict: Rejected.**

---

## SCOPE

### Files that MUST change

| File | Line | Change |
|------|------|--------|
| `packages/engine/src/GrowthEngine.ts` | 120 | `round4(side * spread)` → `round4(side * spread * (180 / Math.PI))` plus inline comment |

### Files that MUST NOT change

| File | Reason |
|------|--------|
| `packages/shared/src/index.ts` | SPECIES_PARAMS stays in radians — correct per interface contract |
| `packages/engine/src/WireEngine.ts` | Already correct — operates entirely in degrees |
| `packages/engine/src/TwineWeightEngine.ts` | Already correct — TWINE_MAX_ANGLE_DELTA in degrees |
| `packages/engine/src/BonsaiTree.ts` | Already correct — `toRad(b.angle)` is the right bridge |
| `packages/voxelizer/src/index.ts` | Already correct — `* Math.PI / 180` is the right bridge |
| `packages/engine/src/tree.ts` | Already correct — uses `SPECIES.forkAngle` (degrees source) |
| `packages/engine/src/CareLogReplay.ts` | No change needed — fix propagates automatically via GrowthEngine |
| `packages/engine/src/species.ts` | Already correct — `forkAngle` explicitly documented as degrees |

---

## FIXTURE / REPLAY IMPACT

### Existing golden fixtures

**There are none.** `find packages/engine -name "*.test.ts"` returns empty. No engine-level golden fixtures, snapshot files, or golden-output tests exist that could be invalidated by this fix.

The only test file in the repository is `packages/contracts/test/Kijonsai.test.ts`, which exercises Solidity smart contract behavior and does not depend on engine-computed branch angles.

### CareLogReplay determinism

CareLogReplay.reconstruct() calls GrowthEngine.growTick() once per day in the replay loop (CareLogReplay.ts:162). After this fix, any replay that includes grow ticks will produce branches with correct degree-range angles instead of near-zero radian-range angles.

**This is a behavior change for existing care logs.** Any care log captured against the pre-fix engine (where GrowthEngine produced 0.1°–1.0° angles) will now replay with 5.7°–57.3° angles. This is the correct output — the pre-fix replay was producing wrong geometry.

**Impact assessment:** Since the project is pre-playtesting and no real kijonsai NFTs exist, there are no production care logs to break. The fix makes replays correct. If any hand-crafted integration test care logs exist outside the `packages/` tree (checked: none found in `kijo-bonsai/docs/pipeline/`, none in `kijo/docs/`), they would need to have their expected outputs updated. None were found.

**Replay determinism is preserved** (same seed + same care log → same output), just now producing correct geometry rather than bugged near-zero geometry.

---

## DONE WHEN

The Implementer's task is complete when ALL of the following hold:

### D1 — Code change
- [ ] `GrowthEngine.ts:120` reads exactly: `angle: round4(side * spread * (180 / Math.PI)),`
- [ ] An inline comment at that line identifies the unit conversion (e.g., `// SPECIES_PARAMS.forkSpreadMin/Max are radians; branch.angle is degrees`)
- [ ] No other file is modified

### D2 — Angle range (run programmatically, 100 growTicks, seed 464497)
- [ ] All non-trunk branches on a hardwood tree have `|branch.angle|` ∈ [28.64°, 57.30°]
- [ ] All non-trunk branches on an evergreen tree have `|branch.angle|` ∈ [17.18°, 40.11°]
- [ ] All non-trunk branches on a tropical tree have `|branch.angle|` ∈ [5.72°, 22.93°] (small float tolerance for round4)
- [ ] No non-trunk branch from GrowthEngine has `|branch.angle|` < 1.0° (the old bugged range was 0.10–1.00°)

### D3 — No regressions in adjacent systems
- [ ] WireEngine: applying `angleDelta = 10` to a newly-grown branch still produces `newAngle = oldAngle + 10` clamped to [5.7296, 80.2141] — same behavior as before fix (only the oldAngle value changes)
- [ ] Voxelizer: `computePositions` receives `b.angle` values such that `b.angle * Math.PI / 180` does NOT always equal 0.1 rad (the clamp floor) — branches now have distinct directions
- [ ] tree.ts `tick()` path: angles unaffected (different code path, was never buggy)

### D4 — TypeScript compiles
- [ ] `tsc --noEmit` in `packages/engine` passes with no errors

### D5 — Auditor observable check
- [ ] Auditor re-runs D2 independently by constructing a BonsaiTree, calling growTick 100 times, and reading branch.angle values directly — does NOT rely on Implementer's test output

---

## DUAL-ENGINE DIVERGENCE (Critical Finding — Not in Original Bug Report)

### What Was Found

The codebase contains two independent, publicly-exported branch-growth engines producing different trees from the same seed:

**Engine A — `tree.ts:tick()`**
- Exported publicly via `packages/engine/src/index.ts:1`: `export { createTree, applyAction, tick, ... } from './tree.js'`
- Self-documented at `tree.ts:196`: `// fixes the legacy tick() path (used by determinism tests and replay)`
- Angle source: `SPECIES.forkAngle` from `species.ts` — **degrees**
- RNG: global `rngState` field (simple linear congruential, state carried across branches)
- Produced angles: hardwood ±22.5–67.5°, evergreen ±15–45°, tropical ±10–30°
- **Always wrote degrees — never had BUG-5**

**Engine B — `GrowthEngine.extendAndFork()`**
- Called by `BonsaiTree.growTick()` → called by `CareLogReplay.reconstruct()` (production path)
- Angle source: `SPECIES_PARAMS.forkSpreadMin/Max` from shared — **radians** (converted to degrees by BUG-5 fix)
- RNG: per-branch `SeededRNG(seed + branchId * 7919 + day * 37)` — deterministic per-branch
- Produced angles after fix: hardwood ±28.6–57.3°, evergreen ±17.2–40.1°, tropical ±5.7–22.9°
- **Had BUG-5; will produce correct output after fix**

### The Core Problem

These two engines are NOT equivalent. From the same `seed` + `careLog`:
- `tick()` produces Tree-A with one set of branch angles (degree-source, global RNG)
- `GrowthEngine.growTick()` produces Tree-B with a different set of branch angles (radian-source-converted, per-branch RNG)

Even after BUG-5 is fixed, Tree-A ≠ Tree-B for any real tree. This means:
- Any test that uses `tick()` and expects its output to match GrowthEngine output will fail — **this was true before BUG-5 and remains true after**
- Any test that hardcodes `tick()` output (branch count, angle values, trunk thickness) and compares against GrowthEngine output is testing against the wrong reference

### Which Engine Is Authoritative?

**GrowthEngine is the production engine.** Evidence:
1. `CareLogReplay.reconstruct()` calls `GrowthEngine.growTick()` — this is the on-chain replay path for NFT verification
2. `BonsaiTree.growTick()` delegates to GrowthEngine — this is what the game calls every day
3. SPECIES_PARAMS (used by GrowthEngine) is in the shared package — designed for cross-service consumption
4. Per-branch `SeededRNG` in GrowthEngine provides stronger determinism guarantees than the global `rngState` in `tick()`

`tick()` appears to be a legacy/prototype implementation predating the current engine architecture.

### Impact on Determinism Tests

`tree.ts:196`'s comment states `tick()` is "used by determinism tests and replay." No test files calling `tick()` were found within `packages/` (only `packages/contracts/test/Kijonsai.test.ts` exists, which tests Solidity contracts). If determinism tests exist outside `packages/` (e.g., in a `/tests/` or `/e2e/` directory not found in this reconnaissance), they use `tick()` and produce different trees than GrowthEngine.

**After BUG-5 fix:** GrowthEngine output changes (correct angles instead of near-zero). Any `tick()`-based determinism tests that compare against hardcoded GrowthEngine output will require output updates — but the correct fix for those tests is to migrate them to use GrowthEngine, not to update expected values for a legacy engine.

### Recommendation (for Jeremy's decision)

This architect's recommendation (not a binding decision):

**Deprecate and eventually remove `tree.ts:tick()`.**

Rationale:
- It is not used by CareLogReplay (the NFT verification path)
- It uses a different, weaker RNG strategy
- It produces different trees than the production engine from the same seed
- Keeping two growth engines creates a maintenance surface where future fixes (like BUG-5) must be applied in two places or risk silent divergence
- If any "determinism tests" reference `tick()`, they should be migrated to GrowthEngine before playtesting begins

**BUG-5 does NOT require removing `tree.ts:tick()`.** The fix is one line in GrowthEngine. The dual-engine question is a separate architectural decision. It is documented here to ensure it is not invisible to the Implementer or to Jeremy.

### What the Implementer Must NOT Do

- Do NOT modify `tree.ts:tick()` as part of this BUG-5 fix
- Do NOT attempt to reconcile the two engines' angle ranges
- If any determinism test comparing tick() output to GrowthEngine output breaks after BUG-5, that is a pre-existing divergence problem, not a regression introduced by this fix

---

## OPEN QUESTIONS

### OQ-BUG5-1 (BLOCKING — requires Jeremy decision): Deprecate or align tree.ts:tick()?

See the DUAL-ENGINE DIVERGENCE section above. `tick()` is a public export used by determinism tests per its own source comment. It produces materially different trees from the same seed than GrowthEngine. Options:

a. **Deprecate tick() and migrate tests to GrowthEngine** — recommended  
b. **Align tick() to GrowthEngine behavior** — larger change, must touch both RNG strategy and angle source  
c. **Leave both engines as-is** — not recommended; creates ongoing maintenance liability  

Jeremy must decide before the Implementer ships BUG-5. If option (a): any determinism tests using tick() must be identified and migrated. If option (b): scope expands significantly beyond BUG-5.

**BUG-5 fix itself is not blocked** — the one-line change in GrowthEngine is correct regardless of this decision. But the test suite cleanup is.

### OQ-BUG5-2 (non-blocking): Comment precision on SPECIES_PARAMS interface

`shared/src/index.ts:349` currently reads `// min angle spread for child fork (radians)`. A future maintainer could mistake the radian values for degrees and introduce BUG-5 again. Consider adding a cross-reference: `// radians — GrowthEngine converts to degrees at write time (see GrowthEngine.ts:120)`. This is a doc-only change and can be deferred to the Implementer's discretion.

### OQ-BUG5-3 (non-blocking): tropical forkSpreadMin = 0.10 rad = 5.730° hits POLAR_MIN exactly

Tropical minimum angle (5.730°) equals the voxelizer's `POLAR_MIN` (5.7296° = 0.1 rad). The voxelizer clamps to `max(0.1, ...)`, so tropical branches at minimum spread are just barely visible (not clipped). This is not a bug but is worth noting for playtest tuning: if tropical trees look too vertical at low spread rolls, `POLAR_MIN` or `tropical.forkSpreadMin` may need adjustment.

---

## EXTERNAL CITATIONS

1. **Three.js Spherical class — polar angle in radians**  
   https://threejs.org/docs/pages/Spherical.html  
   Quoted: "The polar angle **in radians** from the y (up) axis."  
   Grounds the claim that the voxelizer's `* Math.PI / 180` conversion is required — `b.angle` in degrees must be converted to radians for WebGL/Three.js spherical geometry.

2. **ez-tree (procedural tree generator, Three.js + JavaScript) — branch angle in degrees**  
   https://github.com/dgreenheck/ez-tree  
   Quoted: "**`angle`**: Defines the angle, **in degrees**, at which child branches grow relative to their parent branch."  
   Grounds the claim that storing branch angles in degrees is the established convention in Three.js procedural tree implementations, corroborating the kijo design decision.
