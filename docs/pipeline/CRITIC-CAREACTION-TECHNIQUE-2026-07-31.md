# Critic Pass: CareAction + TechniqueClassifier Spec

**Date:** 2026-07-31  
**Reviewer:** Critic stage (adversarial)  
**Spec reviewed:** `docs/ARCHITECT-CAREACTION-TECHNIQUE-2026-07-30.md`  
**Status:** FINDINGS — see verdict at end

---

## Files Read

| File | Finding |
|---|---|
| `packages/shared/src/index.ts` | CareAction union, Branch, TreeState, CareLogEntry confirmed |
| `packages/engine/src/WireEngine.ts` | Wire patterns, depth-1 gate, polar clamp |
| `packages/engine/src/BonsaiTree.ts` | Method surface, no twine/weight methods exist |
| `packages/engine/src/CareLogReplay.ts` | 5-case switch, no new action handling |
| `packages/engine/src/StatDeriver.ts` | SCAR→defense pattern confirmed |
| `packages/engine/src/index.ts` | Export patterns |
| `docs/DESIGN-TWINE-VS-WIRE.md` | Wire timing table, removal semantics |
| `docs/DESIGN-TECHNIQUE-CLASSIFICATION.md` | Classifier pseudocode, cache instruction line 152 |
| `docs/DESIGN-SPECIES-TECHNIQUE-ARCHETYPES.md` | Water-and-Land overlay, 12-archetype grid |
| `docs/DESIGN-SPIRIT-MORALE.md` | Prune morale bonus, phase separation |
| `docs/KIJO-ENGINE-API.md` | C++ spec — CareAction enum, Branch fields |
| `docs/pipeline/PATCH-OQ-RESOLUTIONS-2026-07-31.md` | OQ resolution record |
| `docs/pipeline/PATCH-TWINE-WEIGHT-CAP-2026-07-31.md` | 56° retraction |

---

## Findings

---

### BLOCKER-1 — `wire-remove` CareAction variant is missing

**Severity:** BLOCKER

**Issue:**  
The design canon is explicit: wire removal is free, timed, and consequential. From `DESIGN-TWINE-VS-WIRE.md`:

| Removal timing | Result |
|---|---|
| Too early (<6 months) | Branch springs back |
| Right time (6–12 months) | Branch sets permanently, no scar |
| Too late (>12 months) | Permanent wire scarring (SCAR voxels, Flower Guild Rank penalty) |
| Never removed | Heavy scarring |

`KIJO-ENGINE-API.md` has both `WIRE_REMOVE` in the C++ `CareAction` enum and `void removeWire(uint32_t branchId)` on `BonsaiTree`. The spec adds `twine-remove` and `weight-remove` but omits `wire-remove`.

Without `wire-remove` in the TypeScript `CareAction` union:
- `CareLogReplay` cannot reconstruct the removal event; replay outcome diverges from original
- The engine cannot distinguish "wire still on" from "wire removed early/on-time/late"
- The SCAR-from-overstay mechanic is unimplementable for replay

The spec's own verified-facts block says: "SCAR voxels have exactly two sources: wire overstay and jin." Wire-overstay SCAR is impossible without a removal action in the log.

**Recommendation:**  
Add to the `CareAction` union before the `jin` variant:

```typescript
// WIRE-REMOVE (free action; timing determines outcome — sets, springs, or scars).
// See DESIGN-TWINE-VS-WIRE.md timing table. Replay independence: the outcome
// (spring-back vs set vs scar) is derived from (wireAppliedDay, removeDay, window
// constants) at replay time — no additional fields needed here.
| { type: 'wire-remove'; branchId: number }
```

Also add `'wire-remove'` to `CareLogReplay`'s dispatch list in the flagged implementer section.

---

### BLOCKER-2 — `Branch` interface has no twine or weight state fields; spring-back architecture is unspecified

**Severity:** BLOCKER

**Issue:**  
The twine spring-back mechanic says: "branch returns to `oldAngle` at `applicationDay + degradeDays`." For this to work at runtime, the engine must know — on any given day tick — which branches have active twine and whether that twine has expired. The existing `Branch` interface in `packages/shared/src/index.ts` has no such fields:

```typescript
export interface Branch {
  id, parent, depth, angle, length, thickness, pruned, children, attachmentY
  // ← no twined, twineAppliedDay, twineOriginalAngle, degradeDays
  // ← no weighted, weightCount
  // ← no wired, wireAppliedDay, wireSet, wireScarred
}
```

The C++ `Branch` in `KIJO-ENGINE-API.md` has all of these:
```cpp
bool wired; uint32_t wireAppliedDay; float wireAngle; bool wireSet; bool wireScarred;
bool twined; uint32_t twineAppliedDay; float twineAngle;
bool weighted;
```

The spec says nothing about whether to add fields to `Branch` or to reconstruct live state purely from the care log. These are two architecturally different designs with different trade-offs:

- **Option A (C++ parity):** Add `twined`, `twineAppliedDay`, `degradeDays`, `weightCount`, `wired`, `wireAppliedDay`, `wireSet`, `wireScarred` fields to `Branch`. Live state available without log scan; matches C++ spec.  
- **Option B (log-derived):** `GrowthEngine.growTick()` scans the care log on each tick to find active twine/wire state. No Branch field additions; O(n) per tick.

The spec is silent on this choice. An implementer who picks Option B will be incompatible with one who picks Option A. This affects serialization, `TreeState` snapshots, NFT metadata, and cross-language interop with the C++ engine.

Additionally, the 4-weight-per-branch cap requires knowing the current count of attached weights per branch. No mechanism for tracking this is specified anywhere.

**Recommendation:**  
The spec must specify which architectural option to use, OR define the Branch field additions required. Given C++ parity and the explicit `processTwineTick()` / `processWireTick()` calls in the C++ `applyDailyUpdate()`, Option A (add fields to Branch) is strongly implied. The spec must make this explicit and enumerate the new Branch fields.

---

### MAJOR-1 — `LANDSCAPE_REMOVE` exists in C++ spec; Assumption 5 ("permanent") contradicts it

**Severity:** MAJOR

**Issue:**  
`KIJO-ENGINE-API.md` contains both `LANDSCAPE_REMOVE` in the `CareAction` enum and:

```cpp
void removeLandscape(uint32_t elementId);
// Removes a landscape element. Logs LANDSCAPE_REMOVE.
```

Assumption 5 in the spec says: "The design docs describe only placement. `landscapeCount` threshold is ≥ 3 with no mention of decrementing on removal." But the C++ spec is not a design doc — it is the **existing API contract**. A care log authored by the C++ side that includes `LANDSCAPE_REMOVE` entries will fail to replay in TypeScript.

A more serious consequence: if removal is possible and `landscapeCount` still counts only placement entries (gross), a tree that places 5 rocks and removes 4 would have `landscapeCount = 5` and trigger Water-and-Land with only 1 rock physically present. Classification would be wrong.

**Recommendation:**  
One of two choices must be made:

1. **Accept C++ parity:** Add `{ type: 'landscape-remove'; position: Coordinate }` (or `elementId`) to `CareAction`. Update `TechniqueClassifier` to count `landscapeCount = placements − removals` (net). Flag this as a `LAND_MIN_ELEMENTS` gate against net count.
2. **Explicitly diverge:** State in the spec that the TypeScript implementation does not support landscape removal in Phase 1, and that any C++ `LANDSCAPE_REMOVE` log entries are treated as no-ops in TS replay. Document the interop risk.

Leaving it at "assumed permanent" while the C++ spec has removal is an implementation trap.

---

### MAJOR-2 — DESIGN-TECHNIQUE-CLASSIFICATION.md line 152 directly contradicts OQ-6 resolution; the design doc is still marked authoritative

**Severity:** MAJOR

**Issue:**  
`DESIGN-TECHNIQUE-CLASSIFICATION.md` line 152:
> "Classification is re-evaluated on every care action that could change the result."

OQ-6 in the architect spec resolves this as: "Classification re-runs ONLY when the caretaker opens the voxel viewer."

The design doc is marked `Status: AUTHORITATIVE` at line 3. The architect spec's resolution is in a comment block that says "superseded by this owner confirmation" — but the source doc has not been patched. An implementer who reads `DESIGN-TECHNIQUE-CLASSIFICATION.md` (the authoritative doc) will build an eager re-evaluation strategy. An implementer who reads the architect spec will build a lazy/on-open strategy. Both are following the right document for what they read.

This is not a minor style inconsistency — the two strategies have different performance characteristics and different behavior during active play (e.g., whether a notification fires during watering vs only on viewer open).

**Recommendation:**  
Patch `DESIGN-TECHNIQUE-CLASSIFICATION.md` line 152 to: "Classification is re-evaluated lazily — only when the voxel viewer is opened. [Updated 2026-07-31: OQ-6 resolution.]" The architect spec must not be the sole record of a design decision that changes an authoritative doc.

---

### MAJOR-3 — Cascade mechanic implies "partial set angle" tracking; no data model for it exists

**Severity:** MAJOR

**Issue:**  
The spec states the Kengai (Cascade) cascade path explicitly: "bend 28°, let partially set, re-apply for another 28°, repeat." This means the branch's "natural resting angle" changes over time as the bend sets. After partial set, the `oldAngle` stored in the first twine entry is no longer the angle the branch would spring back to if twine were removed.

No data structure in the spec models:
- What is the branch's *current natural angle* (i.e., the angle it would rest at without twine/weight)?
- How much has set since the last application?

The existing `Branch.angle` is the current applied angle. If twine expires or is removed, what does the engine restore it to? The first `twine` entry's `oldAngle`? The `naturalAngle` after partial set? These are different values.

Without modeling partial set, the cascade path described in the spec cannot be implemented correctly. The implementer will either (a) ignore set entirely and always spring back to original angle, breaking cascade; or (b) invent their own set-tracking fields without a spec.

**Recommendation:**  
The spec must either:
1. Define how "partial set" is tracked (e.g., a `naturalAngle` or `setAngle` field on `Branch` that `TwineWeightEngine` updates each tick based on elapsed time and bend magnitude), or
2. Explicitly declare that partial-set mechanics are out of scope for this spec and that `TwineWeightEngine` will define the model — but then the spec must not imply cascade works; that claim must be deferred.

---

### MAJOR-4 — `weight` action is missing `oldAngle`/`newAngle` for replay independence

**Severity:** MAJOR

**Issue:**  
The spec's own rationale for `twine.oldAngle/newAngle` is:
> "Without storing `degradeDays`, a change to the degradation RNG range would alter replay outcomes."

The same logic applies to `weight`. The spec says: "Max 4 weights per branch; each adds 7° downward." If the 7°/weight constant (`WEIGHT_DEGREES_PER_UNIT`) is tuned during playtesting, all historical weight replay entries will produce different angles. The `twine` action stores `oldAngle`/`newAngle` for exactly this reason; `weight` does not.

Comparably: `wire` stores `angleDelta`, `oldAngle`, `newAngle`, `wireCost`. `twine` stores `angleDelta`, `oldAngle`, `newAngle`, `degradeDays`. `weight` stores only `weightAmount` — no angle record at all.

**Recommendation:**  
Add `angleDelta: number`, `oldAngle: number`, `newAngle: number` to the `weight` action, consistent with wire and twine. The implementer computes these at application time and stores them in the log for replay independence.

---

### MAJOR-5 — `BonsaiTree` method additions not called out in the spec

**Severity:** MAJOR

**Issue:**  
The spec's deliverable section says:
> "`packages/engine/src/CareLogReplay.ts` line 33 currently has no handling for `jin`, `twine`, `weight`, or `landscape` actions. … Implementer must add branches for the four new types."

But `BonsaiTree.ts` (which `CareLogReplay` delegates to for all action types) also has no methods for the new action types. Currently:

```typescript
// CareLogReplay dispatch:
if (a.type === 'wire') WireEngine.wire(tree, a.branchId, a.angleDelta);
// BonsaiTree.wire() delegates to WireEngine
```

The pattern requires:
- `BonsaiTree.twine()` → `TwineWeightEngine.twine()`
- `BonsaiTree.removeTwine()` → `TwineWeightEngine.removeTwine()`
- `BonsaiTree.applyWeight()` → `TwineWeightEngine.applyWeight()`
- `BonsaiTree.removeWeight()` → `TwineWeightEngine.removeWeight()`
- `BonsaiTree.removeWire()` → `WireEngine.removeWire()` (also see BLOCKER-1)
- `BonsaiTree.jin()` → `JinEngine.jin()`
- `BonsaiTree.placeLandscape()` → (inline or LandscapeEngine)

The spec mentions only `CareLogReplay` extension, not `BonsaiTree`. An implementer reading only this spec will add `CareLogReplay` branches that call methods that don't exist, hit runtime errors immediately, and have no spec guidance on what the new `BonsaiTree` methods look like.

**Recommendation:**  
Add a section to Part 4 (Package Placement) listing the `BonsaiTree` method stubs needed and the new engine file(s) they delegate to (e.g., `TwineWeightEngine.ts`, `JinEngine.ts`).

---

### MAJOR-6 — WireEngine depth-1 gate removal is flagged in Assumption 2 but absent from the implementer deliverable

**Severity:** MAJOR

**Issue:**  
OQ-1 resolution (Assumption 2) states: "TwineEngine and WireEngine must NOT enforce a depth-1-only constraint. Original assumption (depth-1 only by analogy with WireEngine.ts line 69) was incorrect — **WireEngine's depth-1 gate should be removed as well**."

`WireEngine.ts` line 69 today:
```typescript
if (b.depth !== 1) return { ok: false, reason: 'not-depth-1' };
```

This removal is explicitly required by the owner resolution. But it is not listed in the spec's deliverables — only noted in Assumption 2. The implementer will add twine/weight/jin/landscape, see that WireEngine still has the depth-1 gate, and either (a) leave it in place (contradicts resolved OQ-1), or (b) remove it without a spec — changing an existing file that is not in scope.

Additionally, `WireRejectReason = 'not-found' | 'pruned' | 'not-depth-1' | 'too-thick'` in `WireEngine.ts` line 34 must lose `'not-depth-1'` if the gate is removed. This is a breaking public-type change.

**Recommendation:**  
Add to the spec's deliverables section:
- `packages/engine/src/WireEngine.ts`: remove the `b.depth !== 1` guard at line 69
- `packages/engine/src/WireEngine.ts`: remove `'not-depth-1'` from `WireRejectReason` (or deprecate it — clients may compare this string)

---

### MINOR-1 — Discovery notification flags have no specified home

**Severity:** MINOR

**Issue:**  
`DESIGN-TECHNIQUE-CLASSIFICATION.md` says: "Discovery notifications are one-time events stored as flags on the tree record: `notified_clip_and_grow`, `notified_jin`, `notified_water_and_land`."

`TechniqueResult` includes count fields and notes: "needed for discovery notification gating." But `TreeState` has no `notified_*` fields, `TechniqueResult` has no `notified_*` fields, and no new type for notification state is defined. The implementer building the notification system will invent a home for these flags without a spec.

**Recommendation:**  
Either (a) add `notifiedClipAndGrow: boolean; notifiedJin: boolean; notifiedWaterAndLand: boolean` to `TechniqueResult` as output fields (then the call site persists them), or (b) add them to `TreeState`/`BonsaiTree` and note they are part of persistent tree state. Punting this to the notification-system implementer creates a hidden structural decision.

---

### MINOR-2 — Polar range clamp may silently prevent Kengai

**Severity:** MINOR

**Issue:**  
`WireEngine.ts` enforces a polar range: `[POLAR_MIN_DEG (5.7°), POLAR_MAX_DEG (80.2°)]` — the valid voxelizer input range. If the same clamp is applied to twine/weight bends, a cascade to Kengai (trunk past vertical, below pot edge) requires angles >90°, which exceeds POLAR_MAX_DEG by a wide margin. A repeated 28° stack that passes 80° will be silently clamped and the trunk will never cascade past the pot.

The spec doesn't address whether `TwineWeightEngine` should apply the voxelizer polar clamp, a different clamp, or no clamp at all. The Kengai example is cited as the primary use case for the cascade mechanic.

**Recommendation:**  
The spec should state explicitly whether TwineWeightEngine uses the same polar clamp as WireEngine, and if not, what the valid range is for twine/weight bends. If Kengai requires >90° angles, the voxelizer's polar range must also be validated as supporting those values.

---

### MINOR-3 — OQ-3 patch document still carries the retracted 56° figure

**Severity:** MINOR

**Issue:**  
`docs/pipeline/PATCH-OQ-RESOLUTIONS-2026-07-31.md` under OQ-3 says: "Combined with twine (twine attaches the weight bag) + 4 weights: up to **56° total downward bend**." This was explicitly retracted by `PATCH-TWINE-WEIGHT-CAP-2026-07-31.md`, which states caps are independent at 28°, not additive. The ARCHITECT spec itself is correctly patched. But the OQ patch doc — which is the first document a pipeline reader will consult for the OQ record — still has the wrong figure with no retraction note inline.

**Recommendation:**  
Add a one-line retraction inline in OQ-3: `[RETRACTED: the 56° combined figure was wrong — caps are independent, not additive. See PATCH-TWINE-WEIGHT-CAP-2026-07-31.md.]`

---

### MINOR-4 — `VoxelRole.SCAR` comment still says "prune scar" (pre-existing inconsistency, surface now)

**Severity:** MINOR

**Issue:**  
`packages/shared/src/index.ts` line 94:
```typescript
SCAR = 'scar', // prune scar (reserved)
```

Per the confirmed design: SCAR voxels have exactly two sources — wire overstay and jin. Pruning does not produce SCAR voxels (the comment is wrong). The new spec adds `jin` as a SCAR source, making this comment more visibly incorrect than before. Any implementer reading this comment before reading the design docs will misimplement the SCAR source logic.

**Recommendation:**  
Update comment to: `SCAR = 'scar', // deadwood: wire overstay (unintentional) or jin pliers (intentional). NOT a prune byproduct.`

---

### MINOR-5 — No `JIN_MIN_USES` tuning constant defined in TechniqueClassifier

**Severity:** MINOR

**Issue:**  
The spec defines three tuning constants:
```typescript
static readonly CLIP_MIN_PRUNES   = 2;
static readonly CLIP_MIN_AGE_DAYS = 30;
static readonly LAND_MIN_ELEMENTS = 3;
```

But the Jin threshold (`jinCount >= 1`) is hardcoded inline in the pseudocode with no named constant. All four thresholds are design values; if the Jin threshold were ever tuned from 1 to 2, an implementer would need to find and change a magic number in the loop body.

**Recommendation:**  
Add `static readonly JIN_MIN_USES = 1;` to the constants block, even though the current value is 1. Consistency with the other three constants and a comment "one jin action qualifies — see design doc rationale" avoids future confusion.

---

## Cross-Reference Summary

| Claim in spec | Verified against | Result |
|---|---|---|
| CareLogEntry = { day, action } | `packages/shared/src/index.ts` line 45 | ✓ |
| TechniqueResult goes in shared (StatSheet pattern) | `packages/shared/src/index.ts` lines 64-76 | ✓ |
| `overlays: Array<'Jin' \| 'Water-and-Land'>` (typed, not string[]) | Design docs, type system | ✓ Good |
| Static-only class (StatDeriver pattern) | `packages/engine/src/StatDeriver.ts` | ✓ |
| Engine exports: `export { X }` + `export type { T }` | `packages/engine/src/index.ts` | ✓ |
| SCAR voxels → defense (StatDeriver.ts) | StatDeriver.ts lines 97-120 | ✓ jin SCAR lands correctly |
| CareLogReplay uses CareLogEntry[] | CareLogReplay.ts line 19 | ✓ |
| Wire count = metal only; twine ≠ wire | DESIGN-TECHNIQUE-CLASSIFICATION.md pseudocode | ✓ |
| wire-remove in CareAction union | Searched spec | ✗ MISSING (BLOCKER-1) |
| Branch fields for twine state | packages/shared/src/index.ts | ✗ ABSENT (BLOCKER-2) |
| landscape-remove in CareAction | KIJO-ENGINE-API.md | ✗ C++ has it, TS doesn't (MAJOR-1) |
| Cache strategy aligned with DESIGN-TECHNIQUE-CLASSIFICATION.md | Line 152 of that doc | ✗ CONTRADICTION (MAJOR-2) |

---

## Verdict

**PASS WITH REVISIONS**

The core type design is sound: discriminated union variants are well-formed, TechniqueResult type is correct and well-motivated, classifier signature is right (CareLogEntry[] not CareAction[]), `overlays` is a properly typed array instead of `string[]`, and the count fields in TechniqueResult are a good design call. The architect did real verification work.

**The following must be patched before this spec goes to an implementer:**

1. **BLOCKER-1 (wire-remove):** Add `{ type: 'wire-remove'; branchId: number }` to the CareAction union. Without it the wire timing mechanic cannot be replayed and SCAR-from-overstay is unimplementable.

2. **BLOCKER-2 (Branch fields / spring-back architecture):** Specify whether Branch gets new state fields for twine/wire/weight tracking (Option A — C++ parity), or whether the engine derives live state from log scan (Option B). This is a load-bearing architectural decision; the implementer cannot proceed without it.

3. **MAJOR-1 (landscape-remove):** Decide explicitly: add `landscape-remove` to CareAction, or document a Phase 1 divergence from the C++ spec with the interop risk stated. Also fix `landscapeCount` counting if removal is added.

4. **MAJOR-2 (cache contradiction):** Patch `DESIGN-TECHNIQUE-CLASSIFICATION.md` line 152 to match OQ-6 resolution. Do not leave an authoritative doc contradicting the spec.

5. **MAJOR-3 (partial set / cascade data model):** Either specify how `naturalAngle` / partial-set tracking works, or remove the cascade claim from this spec's scope.

Items MAJOR-4 through MAJOR-6 and all MINORs should be addressed in the same revision pass — they are quick fixes (field additions, method surface callout, WireEngine gate removal) that will otherwise create mid-implementation surprises.
