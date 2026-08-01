# Corrective Architect Pass: CareAction + TechniqueClassifier
**Date:** 2026-07-31  
**Stage:** Corrective Architect (verified-architect skill protocol)  
**Spec patched:** `docs/ARCHITECT-CAREACTION-TECHNIQUE-2026-07-30.md`  
**Also patched:** `docs/DESIGN-TECHNIQUE-CLASSIFICATION.md` (MAJOR-2), `docs/pipeline/PATCH-OQ-RESOLUTIONS-2026-07-31.md` (MINOR-3)  
**Authority:** Physics model owner-confirmed 2026-07-31; critic findings from `CRITIC-CAREACTION-TECHNIQUE-2026-07-31.md`

---

## What Changed and Why — One Paragraph Per Issue

**BLOCKER-1 — `wire-remove` variant added.** The spec previously omitted `{ type: 'wire-remove'; branchId: number }` from the `CareAction` union despite the C++ API having both `WIRE_REMOVE` in its CareAction enum and `BonsaiTree::removeWire()`. Without this variant, `CareLogReplay` cannot distinguish "wire still applied" from "wire was removed at day N," making the spring-back computation non-reproducible and the SCAR-from-overstay mechanic unreplayable. The new owner-confirmed physics model makes the omission unmistakable: SCAR is triggered during `applyDailyUpdate` ticks when wire remains on after `currentStress` reaches zero — a tick-driven event that requires knowing when removal happened (or didn't). The variant was added to the union immediately after the `wire` entry with a full comment explaining that SCAR is NOT triggered at removal time but rather by the tick watchdog; removal merely stops further accumulation.

**BLOCKER-2 — Branch field additions + spring-back architecture specified.** The original spec was silent on whether `Branch` should gain new state fields or derive live twine/wire/weight state from log scanning each tick — two architecturally incompatible approaches. The owner-confirmed physics model (2026-07-31) resolves this definitively: store `currentStress` on `Branch` for O(1) per-tick access; derive on cold start / seed replay only. The spec now adds a full `Part 0` section covering (a) the core stress formula `S = τ_Total / D³` with tool contributions by type, (b) the stress decay model and set-time formula `setDays = lerp(28, 56, D / D_max)`, (c) the spring-back formula `springBack = angleDelta × currentStress / stressInitial`, (d) the SCAR trigger rule (wire overstay tick, not removal event), and (e) the complete set of new `Branch` interface fields: `diameter`, `currentStress`, `stressInitial`, `wired`, `wireAppliedDay`, `wireAngle`, `wireSet`, `wireScarred`, `twined`, `twineAppliedDay`, `twineAngle`, `weighted`, `weightCount` — in C++ parity with `KIJO-ENGINE-API.md`. Default values for newly-forked branches are specified. The architecture choice (store on Branch) is stated once, unambiguously.

**MAJOR-1 — `landscape-remove` C++ divergence explicitly documented.** `KIJO-ENGINE-API.md` has `LANDSCAPE_REMOVE` in the C++ enum and `BonsaiTree::removeLandscape()`, while Assumption 5 of the spec called landscape "permanent" without acknowledging this contradiction. The corrective pass resolves this by formal explicit divergence: the C++ `removeLandscape()` is designated a Phase 2 forward stub, not currently wired to any game flow. Phase 1 TypeScript does not add `landscape-remove` to `CareAction`. Classification uses gross placement count (no decrement). Any `LANDSCAPE_REMOVE` entries from a C++ → TS cross-engine care log are treated as no-ops in TS replay, and `CareLogReplay` must add a no-op branch for this type. Phase 2 migration path is documented: add `{ type: 'landscape-remove'; elementId: number }`, update `TechniqueClassifier` to use net count. This is a concrete decision, not a "mitigate later" punt.

**MAJOR-2 — `DESIGN-TECHNIQUE-CLASSIFICATION.md` line 152 patched to match OQ-6.** The authoritative classification doc said "re-evaluated on every care action that could change the result" while the architect spec's OQ-6 resolution said "only when the voxel viewer is opened." Two implementers reading the two documents would build incompatible systems — one eager, one lazy — with different notification timing behavior. The line in the authoritative doc has been updated to read "cached and re-evaluated lazily — only when the caretaker opens the voxel viewer" with an inline attribution to OQ-6. The architect spec is not the sole record of this decision; it now lives in both places.

**MAJOR-3 — Cascade mechanic fully specified by physics model.** The original spec stated that cascade (Kengai style) was achieved by "bend 28°, let partially set, re-apply" but provided no data model for "partial set angle" — the branch's natural resting angle after a partial set. Without this, an implementer would either (a) always spring back to the pre-twine angle (breaking cascade) or (b) invent their own set-tracking fields. The physics model resolves this: there is no separate `naturalAngle` field. When `currentStress` decays to the set threshold, the branch's `angle` field at that moment IS its new natural angle — the cascade accumulates in `Branch.angle` across repeated bind-set-rebind cycles. The spec now includes a step-by-step cascade mechanic description, a polar angle range for `TwineWeightEngine` (`KENGAI_POLAR_MAX = 150°`), and a set of named constants (`STRESS_DECAY_MIN_DAYS`, `STRESS_DECAY_MAX_DAYS`, `STRESS_SET_THRESHOLD`, `KENGAI_POLAR_MAX`) for the implementer.

**MAJOR-4 — `weight` action updated to `weightCount` + `torqueContribution`.** The original `weight` action stored only `weightAmount` (an opaque number in "engine-defined units") with no angle snapshot for replay independence — in contrast to `wire` and `twine` which both store angle deltas to resist tuning-constant changes. The physics model clarifies that weights apply continuous gravity torque `τ = F_g × r`, not a discrete angle delta at application time; `oldAngle/newAngle` are therefore misleading. The action is updated to `{ branchId: number; weightCount: number; torqueContribution: number }` where `torqueContribution` is τ computed at application time and stored for replay independence. Historical replay uses the stored τ; if `WEIGHT_MASS_PER_UNIT` or `GRAVITY_CONSTANT` constants are later tuned, existing log entries remain correct.

**MAJOR-5 — BonsaiTree method stubs listed as explicit deliverables.** The spec mentioned that `CareLogReplay` must be extended for the new action types but did not list the `BonsaiTree` methods those replay branches would delegate to. An implementer adding CareLogReplay branches would call methods that don't exist and hit runtime errors with no spec guidance. `Part 5` now enumerates all required `BonsaiTree` stubs: `applyTwine`, `removeTwine`, `applyWeight`, `removeWeight`, `removeWire` (new — BLOCKER-1 delegate), `applyJin`, `addLandscape`. It also specifies two new engine files (`TwineWeightEngine.ts`, `JinEngine.ts`), their result/reject types (`TwineResult`, `WeightResult`, `JinResult` and their corresponding reason types), and the new `packages/engine/src/index.ts` export entries. The implementer now has a complete method surface to implement against.

**MAJOR-6 — WireEngine depth-1 gate removal added to deliverables.** OQ-1 resolution (Assumption 2) stated that twine and wire can be applied to any branch at any depth, and that "WireEngine's depth-1 gate should be removed." However, this was only in an assumption comment — not in the deliverables section. An implementer reading only the deliverables would see no instruction to change `WireEngine.ts` and would leave the gate in place, silently breaking trunk wiring (required for Kengai). `Part 6` now explicitly lists: (1) remove the `b.depth !== 1` guard at WireEngine.ts line 69, (2) remove `'not-depth-1'` from `WireRejectReason` (public type — breaking change, grep required before shipping), (3) update the WireEngine JSDoc, and (4) note that WireEngine's polar clamp (`80.2°` max) is unchanged — cascade angles beyond that use `TwineWeightEngine` instead.

---

## Minors Addressed

**MINOR-1 (JIN_MIN_USES constant):** Added `static readonly JIN_MIN_USES = 1` to `TechniqueClassifier` alongside the existing `CLIP_MIN_PRUNES`, `CLIP_MIN_AGE_DAYS`, `LAND_MIN_ELEMENTS` constants. The jin threshold was previously a magic `1` inline in the pseudocode; it now has a named constant with a rationale comment.

**MINOR-2 (Kengai polar angle):** `Part 7.2` specifies `KENGAI_POLAR_MAX = 150°` as the `TwineWeightEngine` ceiling, and a trunk spline target of approximately `120°` for the Kengai style (CANONICAL-STYLES.md style index 3). A voxelizer validation task is flagged: angles in `[90°, 150°]` must be confirmed renderable — the current WireEngine polar clamp (`80.2°`) represents the voxelizer's validated range; anything beyond it is currently unverified.

**MINOR-3 (OQ-3 retraction note):** `docs/pipeline/PATCH-OQ-RESOLUTIONS-2026-07-31.md` OQ-3 section had "56° total downward bend" without an inline retraction. The 56° figure was already retracted by `PATCH-TWINE-WEIGHT-CAP-2026-07-31.md`, but the OQ document (the first a pipeline reader would consult) still showed the wrong number. A strikethrough retraction with cross-reference has been added inline.

**MINOR-4 (VoxelRole.SCAR comment):** `Part 7.1` specifies the corrected comment for `VoxelRole.SCAR` in `packages/shared/src/index.ts` line 94: from `"prune scar (reserved)"` to `"deadwood: wire overstay (unintentional) or jin pliers (intentional). NOT a prune byproduct."` This is a comment-only change.

**MINOR-5 (overlays typing):** Already resolved in the previous architect pass. `TechniqueResult.overlays` is `Array<'Jin' | 'Water-and-Land'>`, not `string[]`. No further action.

---

## Cross-Reference Check (Corrective Pass)

| Claim | Doc verified against | Result |
|---|---|---|
| `wire-remove` in C++ CareAction enum + BonsaiTree | `KIJO-ENGINE-API.md` lines 36, 157-164 | ✓ |
| C++ Branch has wired/twined/weighted state fields | `KIJO-ENGINE-API.md` lines 59-71 | ✓ |
| `LANDSCAPE_REMOVE` + `removeLandscape()` in C++ | `KIJO-ENGINE-API.md` lines 41, 176-179 | ✓ — explicitly diverged in Phase 1 |
| WireEngine depth-1 gate at line 69 | `packages/engine/src/WireEngine.ts` line 69 | ✓ — added to deliverables |
| `WireRejectReason` includes `'not-depth-1'` | `packages/engine/src/WireEngine.ts` line 34 | ✓ — removal in deliverables |
| POLAR_MAX_DEG = 80.2° in WireEngine | `packages/engine/src/WireEngine.ts` lines 31-32 | ✓ — TwineWeightEngine uses 150° instead |
| Classification line 152 now says lazy/cached | `docs/DESIGN-TECHNIQUE-CLASSIFICATION.md` | ✓ — patched |
| OQ-3 "56°" retracted inline | `docs/pipeline/PATCH-OQ-RESOLUTIONS-2026-07-31.md` | ✓ — patched |
| CANONICAL-STYLES.md style index 3 = Kengai | `docs/CANONICAL-STYLES.md` line 16 | ✓ |
| TechniqueResult.overlays already typed | This spec | ✓ — no action needed |

---

## Verdict

**READY FOR IMPLEMENTER**

All 2 blockers and 6 majors resolved. All 5 minors addressed. No open blockers remain.

Outstanding implementation tasks for the implementer (not spec gaps):
- Validate voxelizer polar range supports [90°, 150°] before TwineWeightEngine ships
- Grep for `'not-depth-1'` across codebase before removing `WireRejectReason` member
- Verify C++ segment identifier encoding against `JinEngine.applyJin()` at integration time
- Implement `TwineWeightEngine.ts` and `JinEngine.ts` as new engine files
- Calibrate `WEIGHT_MASS_PER_UNIT`, `GRAVITY_CONSTANT`, and `STRESS_DECAY_RATE` constants with owner before playtesting
