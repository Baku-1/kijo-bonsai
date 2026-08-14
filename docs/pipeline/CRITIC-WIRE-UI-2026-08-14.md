# CRITIC-WIRE-UI-2026-08-14

**Pipeline stage:** Critic (Adversarial Auditor standard)  
**Date:** 2026-08-14  
**Reviews:** `docs/pipeline/ARCH-WIRE-UI-2026-08-14.md`  
**Status:** PASS WITH CAVEATS — implementer may proceed after reading findings below

---

## VERDICT: PASS WITH CAVEATS

The spec is architecturally sound. The HTML diff is correct. The JS additions are complete. The pointerdown restructure correctly preserves existing prune behavior. Mode exclusion and cleanup logic covers all reachable UI paths. persistAsync shapes are exact matches to the `CareAction` union.

Two caveats require implementer awareness:
- One round4 discipline gap in the spec's `appliedDelta` computation (functionally harmless, cosmetically wrong — implementer should add `round4()`).
- Gate W11 is untestable on a fresh tree without special setup.

The two architect-flagged blockers are pre-existing server issues, not spec defects. They are confirmed correct and require Jeremy's decision before production use.

---

## SECTION 1 — ARCHITECT CRITICAL FINDINGS: VERIFIED INDEPENDENTLY

### OQ-WIRE-1: `'wire-remove'` absent from `ALLOWED_ACTION_TYPES`

**Source checked:** `apps/server/supabase/functions/care-action/index.ts:98` (read in full)

```typescript
const ALLOWED_ACTION_TYPES = new Set(['water', 'prune', 'wire', 'fertilize', 'rotate']);
```

**CONFIRMED CORRECT.** `'wire-remove'` is NOT in the set. Any `persistAsync({ type: 'wire-remove', ... })` call will receive a 400 with `{ error: 'Invalid action type' }` from the server. Local state updates; server log does not. State diverges on next full server reload.

The architect's recommended fix is exact — add `'wire-remove'` to the set. No consumable entry is needed (the `CONSUMABLE` map has no `wire-remove` key, so `consumableType` evaluates to `undefined` and the consumable block at lines 154-169 is skipped). The fix is one word in one file.

**This finding is not a spec defect. It is a pre-existing server gap requiring a deployment.**

---

### `WIRE_MAX_ANGLE_DELTA = 45` (not 28)

**Source checked:** `packages/engine/src/WireEngine.ts:27`

```typescript
export const WIRE_MAX_ANGLE_DELTA = 45;  // degrees per wire action (GDD s3.2)
```

**CONFIRMED CORRECT.** The task prompt's "±28°" claim is wrong. 28° is `TWINE_MAX_ANGLE_DELTA`, confirmed at `packages/shared/src/index.ts:201` (comment: "angleDelta clamped to ±TWINE_MAX_ANGLE_DELTA = 28°"). The spec's slider range `min="-45" max="45"` is correct.

---

## SECTION 2 — SPEC COMPLETENESS

### 2a. HTML additions

**Checked:** `apps/web/index3d.html` (98 lines, read in full).

The spec's insertion instruction is correct. The "old" block to be replaced (prune/rotate row opening + start of day-advance row) matches lines 67-71 exactly. The replacement appends the wire-controls block between those two rows. Resulting HTML is syntactically valid. The `for="wire-angle"` label attribute is standard HTML. `var(--edge)` is defined in `:root` at line 8. ✓

One minor ambiguity: the spec says `btn-wire-remove` has **no** `style="display:none"` in the HTML — the spec controls visibility from JS. This is consistent with the spec text at §1 Notes. The implementer should not add a `display:none` attribute to the button in HTML. ✓

### 2b. State variables and DOM references

All new variables reference element IDs that exist in the spec's HTML addition (`wire-controls`, `wire-branch-info`, `wire-angle`, `wire-angle-label`, `btn-wire-apply`, `btn-wire-remove`). TypeScript types are appropriate (HTMLDivElement for wireControls, HTMLInputElement for wireAngleInput, generic Element for others). ✓

`wireMode` and `selectedBranchId` declaration locations (after line 262 beside `pruneMode`) are correct. `pruneMode` is at line 261 in the actual file. ✓

### 2c. `persistAsync` call shapes

**Checked against:** `packages/shared/src/index.ts:193-197` (CareAction union, read in full)

Wire-apply shape in spec:
```typescript
{ type: 'wire', branchId, angleDelta, oldAngle, newAngle, wireCost }
```
Matches shared/index.ts:193 exactly. ✓

Wire-remove shape in spec:
```typescript
{ type: 'wire-remove', branchId }
```
Matches shared/index.ts:197 exactly. ✓

`WireResult` fields: `oldAngle`, `newAngle`, `wireCost` are all defined on the interface (WireEngine.ts:38-44). When `ok === true` the spec says these are "always populated" — this is confirmed by WireEngine.ts:104: `return { ok: true, wireCost, oldAngle, newAngle: clampedAngle }`. ✓ The non-null assertions (`!`) are safe.

### 2d. Pointer handler restructure — prune behavior preservation

**Checked:** `apps/web/src/main3d.ts:332-358` (existing handler, read in full)

Existing handler logic:
1. Guard: `if (!pruneMode || !latestVoxels) return;`
2. Raycast
3. For each hit: skip if `branchId === 0`; push to localCareLog; call `tree.prune()`; `refreshAll()`; `persistAsync`; `return`

Spec's restructured handler:
1. Guard: `if (!latestVoxels) return; if (!pruneMode && !wireMode) return;`
2. Same raycast block (identical pointer/raycaster setup)
3. If pruneMode: identical prune logic including `branchId === 0` skip, localCareLog push, tree.prune, refreshAll, persistAsync, return
4. If wireMode: new selection logic

**Prune behavior is preserved identically.** The combined guard `(!pruneMode && !wireMode)` is equivalent to the original `!pruneMode` when wireMode is false. The prune block inside the loop is copied verbatim. ✓

**One important note**: `tmpVec.clone()` is called in the wire path. The spec explicitly explains why (§2i critical note). The prune path doesn't need clone because it returns immediately after using `tmpVec`. The wire path stores the vector in the selection indicator position, so clone is required. The logic is correct. ✓

### 2e. `rebuildVoxels()` and selection indicator survival

**Checked:** `apps/web/src/main3d.ts:192-251` (`clearVoxels()` and `rebuildVoxels()`)

`clearVoxels()` iterates `meshes.values()`, calls `scene.remove()` and `dispose()`, then `meshes.clear()`. Since `selectionIndicator` is NOT added to `meshes` (it's a separate `scene.add(mesh)` object), it is NOT removed by `clearVoxels()`. ✓

`rebuildVoxels()` calls `clearVoxels()` then re-adds from voxel data. selectionIndicator persists in scene. ✓

Insertion point "after the ghost block, around line 135" — `ghost` block ends at line 136 (`scene.add(ghost)`). The next statements are `let ghostVisible = true;` (line 136) and `const VOXEL_MATS` block (line 139). Inserting `selectionIndicator` between lines 136 and 139 is clean. ✓

### 2f. Mode deactivation paths

The spec covers:

| Path | wireMode | deselectWireBranch() | wireBtn.classList | controls.enableRotate |
|---|---|---|---|---|
| Wire button (toggle off) | → false | ✓ | .remove('active') | = true |
| Prune button (toggle on) | → false | ✓ | .remove('active') | = !(pruneMode \|\| wireMode) |
| btn-new | → false | ✓ | .remove('active') | = true |

All three paths are covered. ✓

**One edge case examined**: In §2f (wire toggle button), when wire is toggled OFF, `controls.enableRotate = true` is hardcoded. This is safe because the wire-on state always deactivated pruneMode (at the start of the `if (wireMode)` block). When wire is then toggled off, pruneMode is guaranteed to be false. `controls.enableRotate = true` is correct. ✓

For symmetry the implementer COULD write `controls.enableRotate = !(pruneMode || wireMode)` but it evaluates to the same value in all reachable states.

**Navigation away** (tab close, link click): wireMode is a module-level JS variable. It doesn't persist across page loads. Not a concern.

### 2g. `wireBtn` scope dependency in `pruneBtn` listener

The spec notes in ASSUMPTIONS §5 that `wireBtn` (const declared at §2f) must be placed BEFORE the `pruneBtn` listener replacement (§2g). This is a real ordering constraint. The existing `pruneBtn` listener is at `main3d.ts:502-510`. The spec's §2f wireBtn handler must be inserted before line 502. The spec says "add in Controls section" — the Controls section starts at line 471. Implementer must maintain declaration-before-use. ✓

---

## SECTION 3 — DEFECT FOUND: `appliedDelta` missing `round4()`

**Severity: LOW** (functionally harmless for replay; violates round4 discipline)

The engine computes (WireEngine.ts:85):
```typescript
const appliedDelta = round4(clampedAngle - oldAngle);
```

The spec's `btnWireApply` listener computes:
```typescript
const appliedDelta = result.newAngle! - result.oldAngle!;  // NO round4()
```

**Why this matters (barely):** `result.newAngle` and `result.oldAngle` are both already round4'd floats. Subtracting two round4-rounded floats does not always produce a round4-rounded result in binary floating point. The value stored in `localCareLog.action.angleDelta` and sent to `persistAsync` may differ from the engine-internal `appliedDelta` by ≤ 1 ulp.

**Why it doesn't matter for correctness:** On CareLogReplay, `WireEngine.wire(branchId, angleDelta)` is called with the stored `angleDelta`. The engine re-applies `round4(clamp(...))` internally, producing the same `clampedAngle` regardless of whether the input was round4'd. Replay is deterministic. ✓

**Required fix (LOW):** The implementer should change the spec line to:
```typescript
import { round4 } from '@kijo/shared'; // already imported by BonsaiTree; available in engine bundle
// ...
const appliedDelta = round4(result.newAngle! - result.oldAngle!);
```

Verify `round4` is importable in `main3d.ts`. If not imported from `@kijo/shared`, import it. This is a one-line change to maintain the Kijo round4 discipline standard (DECISIONS.md).

---

## SECTION 4 — ADDITIONAL FINDINGS

### FINDING-2: `angleDelta === 0` not guarded
**Severity: LOW (UX gap)**

`btnWireApply` does not guard against `angleDelta === 0`. Calling `tree.wire(branchId, 0)` with a zero delta is valid engine behavior — it marks the branch as `wired: true`, increments `wireCount`, sets `wireAppliedDay`, and deducts a wire consumable — all without changing `branch.angle`. A player could accidentally waste a wire consumable by clicking Apply with the slider at its default position.

**Suggested fix:** Add before the `tree.wire()` call:
```typescript
if (angleDelta === 0) {
  hintEl.textContent = 'Set a bend angle before applying wire.';
  return;
}
```

This is optional for a debug tool. Flag for Jeremy if wire consumables become real.

---

### FINDING-3: Gate W11 is impractical on a fresh tree
**Severity: LOW (test coverage gap)**

W11: "Select a branch with thickness > 3.0, click Apply → hintEl shows 'Wire failed: too-thick'."

Fresh trees have branch thickness near 1.0. Getting a branch to thickness > 3.0 requires many growth ticks. The gate doesn't specify how many ticks or what seed to use to reliably produce a thick branch quickly. A tester following W1-W19 in order would hit W11 with a young tree and find no wireable-but-too-thick branch.

**Required addition to gate W11:** "Grow the tree to ≥30 days (click Advance Day ×30) before testing this gate. Thick branches (thickness > 3.0) appear on mature specimens." Or: explicitly skip this gate and document it as "requires controlled tree state."

---

### FINDING-4: `wireControls` panel is not reset on `refreshAll()` after prune in wire mode
**Severity: LOW (cosmetic, unreachable in practice)**

If somehow a user in wire mode prunes the selected branch (impossible via the spec's UI — prune and wire mode are mutually exclusive), `wire-controls` would show info for a branch that no longer exists. This is not reachable in the specified UI flow because pruneMode activation deactivates wireMode via deselectWireBranch(). Not a blocker, but worth noting.

---

## SECTION 5 — UNADDRESSED CONCERNS FROM CRITIC PROMPT

### `SESSION-START.md` replay correctness: double-log risk?

**No double-log risk.** Investigated independently.

`WireEngine.wire()` pushes to `tree.getCareLog()` (the tree's in-memory internal log). The UI code pushes to `localCareLog` (a separate client-side tracking array). These are independent arrays serving different purposes:
- `tree.getCareLog()`: in-memory; used by CareLogReplay on reconstruction  
- `localCareLog`: serialized to sessionStorage via `saveTreeCache()`; fed back to `CareLogReplay.reconstruct()` on page reload from cache

On cache reload, `localCareLog` entries are fed to `CareLogReplay.reconstruct()`, which replays each action (including wire) by calling `tree.wire(branchId, angleDelta)`. The engine's internal log is repopulated during replay. No duplication.

On server reload, `loadCareLog()` reads from DB and builds `localCareLog` fresh. No duplication.

**Replay is deterministic.** The `angleDelta` from the DB is used as input to `WireEngine.wire()`, which re-applies its own `round4(clamp(...))` internally. Even if `angleDelta` in the DB is not round4'd (per FINDING-1), the engine produces the same `clampedAngle`. ✓

---

### Wire consumable gate — both wire-apply AND wire-remove fail for real users

The spec presents OQ-WIRE-1 (wire-remove blocked) and OQ-WIRE-2 (consumable not provisioned) as separate issues of different urgency. The critic notes: **they are equally blocking for server persistence.**

With `wire: live: false` in StoreModal and no consumable rows provisioned in DB:
- Wire-apply → server returns 400 "consumable 'wire' record not found" (CONSUMABLE map has `wire: 'wire'`)
- Wire-remove → server returns 400 "Invalid action type"

Both actions fail silently (console.error only). Local state applies; server log has neither. On full server reload (cold start, cache miss), **the tree appears as if no wire actions were ever taken.**

The spec's §6 defense (index3d.html is a debug tool, same behavior as prune/shears) is correct but should be stated more clearly: **the entire wire persistence pipeline is currently inoperative for any real user or test wallet without DB-level provisioning.** This is not a spec defect — the spec accurately describes the situation — but the implementer should understand that neither wire action will be server-persisted until OQ-WIRE-2 is resolved.

---

## SECTION 6 — OPEN QUESTIONS STATUS

| ID | Genuine design decision? | Can code answer it? | Clarity for Jeremy |
|---|---|---|---|
| OQ-WIRE-1 | No — this is a known fix with a known code change | Fix is one word: add `'wire-remove'` to Set | ✓ Stated unambiguously. Jeremy approves deploy. |
| OQ-WIRE-2 | Yes — 4 options presented | Code cannot resolve this (requires product decision on consumable economy) | ✓ Options A-D with recommendation are clear. |
| OQ-WIRE-3 | Yes — UX preference on input widget | A slider-only or slider+number-input is a product call | ✓ One-sentence answerable. |
| OQ-WIRE-4 | Yes — UX default preference | Both options are implemented with 2-3 lines difference | ✓ One-sentence answerable. |

All four open questions are genuine. None can be resolved from code alone. All are stated clearly enough for a one-sentence response.

---

## SECTION 7 — SIGN-OFF CHECKLIST

```
ARCHITECT CRITICAL FINDINGS:
  ✓ OQ-WIRE-1: 'wire-remove' absent from ALLOWED_ACTION_TYPES
    — CONFIRMED. Independently read care-action/index.ts:98. The set is exactly
      ['water', 'prune', 'wire', 'fertilize', 'rotate']. 'wire-remove' is absent.
      Server will 400. Spec is correct.

  ✓ WIRE_MAX_ANGLE_DELTA = 45 (not 28):
    — CONFIRMED. Independently read WireEngine.ts:27. Value is 45. Also confirmed
      that 28 = TWINE_MAX_ANGLE_DELTA (shared/index.ts:201 comment). Slider range
      -45 to +45 is correct.

SPEC DEFECTS:
  SEVERITY LOW — 'appliedDelta' missing round4():
    Spec computes: result.newAngle! - result.oldAngle!
    Engine computes: round4(clampedAngle - oldAngle)
    Implementer must add round4() wrapper. Functionally harmless; disciplinary violation.

  SEVERITY LOW — angleDelta === 0 not guarded:
    Player can waste wire consumable by clicking Apply at slider=0.
    Optional guard for debug tool scope.

  SEVERITY LOW — Gate W11 untestable on fresh tree:
    Needs "grow to ≥30 days first" instruction added.

INTERACTIONS WITH EXISTING CODE:
  ✓ Pointerdown prune behavior: restructured handler is an exact copy of existing prune
    logic inside an `if (pruneMode)` guard. No regression risk.
  ✓ selectionIndicator survives rebuildVoxels(): confirmed not in meshes Map.
  ✓ Mode exclusion paths: all reachable deactivation sequences analyzed. Controls correct.

UNADDRESSED CONCERNS:
  ✓ Double-log risk: No. engine.getCareLog() and localCareLog are separate arrays.
  ✓ Wire consumable: Both actions fail on server for real users until OQ-WIRE-2 resolved.
    Spec correctly describes this; both OQ-WIRE-1 and OQ-WIRE-2 are equally blocking.
```

---

## SECTION 8 — QUESTIONS REQUIRING JEREMY'S ANSWER BEFORE IMPLEMENTATION STARTS

The following decisions must be resolved before the implementer begins. In priority order:

**OQ-WIRE-1 (Unblock wire-remove server persistence):**
> Add `'wire-remove'` to `ALLOWED_ACTION_TYPES` in `apps/server/supabase/functions/care-action/index.ts:98` and redeploy. Approve yes/no?

**OQ-WIRE-2 (Unblock wire-apply server persistence):**
> Choose: A) leave as-is (console-only error, debug-tool only), B) DB INSERT `consumables` rows for test wallets (type='wire', quantity=99), C) flip wire to `live: true` in StoreModal, or D) add async pre-flight check before Apply. Recommendation: B.

**OQ-WIRE-3 (UX — angle input):**
> Slider-only (current spec), or add a companion `<input type="number">` synced to the slider for exact-degree entry?

**OQ-WIRE-4 (UX — angle default):**
> Reset slider to 0 after each Apply/on each selection (current spec), or remember the last-used angle?

---

*Critic pass complete. No source files changed — critique doc only. Pipeline: Architect → **Critic** → Implementer → Auditor → Linter.*
