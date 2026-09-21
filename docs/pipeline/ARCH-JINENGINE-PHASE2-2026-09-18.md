# Architect Spec: JinEngine Phase 2 -- Full Implementation
**Date:** 2026-09-18
**Author:** Verified Architect pass -- follows skill protocol exactly
**Status:** DESIGN -- for implementer use
**Scope:** JinEngine Phase 2 only. Landscape is a separate task.

---

## SCOPE

```
DESIGN TASK:  Implement JinEngine.applyJin() -- replace Phase 1 stub (throws
              CareLogReplayError) with working logic that converts branch
              segments to deadwood, freezes the branch, increments jinCount,
              and logs the care action.

DELIVERABLE:  TypeScript implementation spec with exact field additions, logic
              steps, file changes, edge cases, determinism guarantees, done-when
              criteria, and test gate design.

BUILDS ON:    packages/engine/src/JinEngine.ts (51-line Phase 1 stub)
              packages/shared/src/index.ts (Branch, JinResult, JinRejectReason, VoxelRole)
              packages/engine/src/BonsaiTree.ts (applyJin delegation, applyDailyUpdate)
              packages/engine/src/GrowthEngine.ts (branch skip patterns)
              packages/voxelizer/src/index.ts (role assignment)
              docs/ARCHITECT-CAREACTION-TECHNIQUE-2026-07-30.md (jin design)
              docs/DESIGN-TECHNIQUE-CLASSIFICATION.md (jinCount threshold)
              docs/pipeline/AUDIT-CARE-REPLAY-GAPS-2026-09-18.md (gap audit)

CONSUMED BY:  Implementer building JinEngine Phase 2.
              After: re-add 'jin' to server ALLOWED_ACTION_TYPES.
```

---

## VERIFICATION LOG

```
VERIFIED:
  V JinEngine.ts is a 51-line Phase 1 stub. applyJin validates branchId, pruned,
    segmentIndex range, then throws CareLogReplayError (line 49).
    Source: read packages/engine/src/JinEngine.ts directly (all 51 lines).

  V CareLogReplay.ts line 141-144: delegates jin to tree.applyJin(a.branchId,
    a.segmentIndex, a.jinCost). No CareLogReplay changes needed -- it already
    passes all three fields. The problem is JinEngine throws, not CareLogReplay.
    Source: read packages/engine/src/CareLogReplay.ts lines 141-144.

  V BonsaiTree.applyJin (lines 253-266): validates segmentIndex (non-negative
    integer) and jinCost (positive integer), then delegates to JinEngine.applyJin.
    Input validation is COMPLETE -- no changes needed in BonsaiTree.
    Source: read packages/engine/src/BonsaiTree.ts lines 253-266.

  V JinResult type exists in shared/index.ts (lines 557-561):
    { ok: boolean; reason?: JinRejectReason; scarVoxelCount?: number }
    JinRejectReason = 'not-found' | 'pruned' | 'segment-out-of-range'
    Note: 'already-jin' was removed by Carmack C-5 (line 554) because no
    Branch.jinned field existed. Phase 2 adds the field -> re-add the reason.
    Source: read packages/shared/src/index.ts lines 554-561.

  V VoxelRole.SCAR = 'scar' exists (line 352). Comment already corrected to:
    "deadwood: wire overstay (unintentional) or jin pliers (intentional)."
    Source: read packages/shared/src/index.ts lines 345-353.

  V StatDeriver counts SCAR voxels for defense: defense = scarVoxels * 0.10.
    (SCAR_DEFENSE_MULT = 0.10, line 38). No StatDeriver changes needed --
    once voxelizer emits SCAR role for jinned segments, defense "just works."
    Source: read packages/engine/src/StatDeriver.ts lines 38, 97-120.

  V Voxelizer role assignment (index.ts lines 162-173): assigns VoxelRole by
    branch depth only (TRUNK/ARM/LEG/DIGIT). Does NOT check wireScarred.
    Wire SCAR voxels are NOT currently emitted by the voxelizer either -- this
    is a known gap (V3 advisory note). Jin SCAR requires the same fix path.
    Source: read packages/voxelizer/src/index.ts lines 162-184.

  V Branch interface (shared/index.ts lines 5-191): NO jinned field exists.
    No jinSegmentStart field exists. These must be added.
    Source: read packages/shared/src/index.ts lines 5-191.

  V GrowthEngine skips pruned branches with `if (b.pruned) continue` in:
    - extendAndFork (line 214)
    - thickeningPass (line 479)
    Jin'd branches need the same skip pattern.
    Source: read packages/engine/src/GrowthEngine.ts lines 214, 479.

  V BonsaiTree.applyDailyUpdate skips pruned branches (line 57):
    `if (b.pruned) continue` in the physics loop.
    Jin'd branches need the same skip in physics.
    Source: read packages/engine/src/BonsaiTree.ts line 57.

  V createTree (tree.ts lines 25-46): trunk Branch has no jinned field.
    Must add jinned: false, jinSegmentStart: -1 defaults.
    Source: read packages/engine/src/tree.ts lines 25-46.

  V GrowthEngine fork path (lines 399-430): new branches have no jinned field.
    Must add jinned: false, jinSegmentStart: -1 defaults.
    Source: read packages/engine/src/GrowthEngine.ts lines 399-430.

  V OQ-4 resolution (ARCHITECT-CAREACTION-TECHNIQUE-2026-07-30.md):
    "Jin converts everything from the chosen point OUTWARD to the tip. Picking
    segmentIndex N converts segment N through the branch tip, plus ALL sub-branches
    extending beyond that point -- all become SCAR voxels (deadwood)."
    Source: read ARCHITECT-CAREACTION-TECHNIQUE doc, OQ-4 (line 1045-1048).

  V TechniqueClassifier (TechniqueClassifier.ts lines 59-87): counts
    { type: 'jin' } entries in care log to produce jinCount. jinCount >= 1
    qualifies Jin overlay. TechniqueClassifier reads the CARE LOG, not Branch
    fields. Therefore: no TechniqueClassifier changes needed -- as long as
    the care log entry is written, classification works.
    Source: read packages/engine/src/TechniqueClassifier.ts lines 59-87.

  V Server gate decision (wiki/decisions/gate-jin-landscape-server-2026-09-18.md):
    jin removed from ALLOWED_ACTION_TYPES. Must be re-added after Phase 2 passes
    its gate suite.
    Source: read Second Brain wiki page.

  V CareLogReplay handlers for jin (line 141-144): passes a.branchId,
    a.segmentIndex, a.jinCost. No additional fields needed from the care log.
    Source: read CareLogReplay.ts lines 141-144.

UNVERIFIED:
  ? Whether voxelizer should also emit SCAR role for wireScarred branches.
    This is a parallel gap (V3 advisory) and out of scope for this spec, but
    the voxelizer changes for jin could share the same code path.
    RISK: low -- separate task. Jin SCAR and wire SCAR use the same VoxelRole.

REFUTED:
  X "jinCost consumption" -- the care action type stores jinCost for historical
    record, but the engine has no consumable inventory system. jinCost is logged
    in the care entry; the server-side Edge Function gates the purchase.
    The engine does NOT "consume" jinCost -- it acknowledges it in the log.
    Phase 1 stub's `void jinCost` was correct: it is used only in the log entry.
```

---

## THE DESIGN

---

### Part 1 -- Branch Field Additions

Add to `packages/shared/src/index.ts` Branch interface, after the `bendSet` field:

```typescript
  // -- Jin / Deadwood State (2026-09-18, JinEngine Phase 2) ---------------------

  /**
   * True when jin pliers have been applied to this branch (any segment).
   * A jinned branch is DEAD -- it stops growing, stops forking, is skipped
   * by GrowthEngine and physics. But it is NOT pruned -- it remains visible
   * and its voxels are rendered as VoxelRole.SCAR.
   *
   * Set by JinEngine.applyJin (direct application) or by jin cascade
   * (parent jin'd at a point before this branch's attachment).
   * Default: false. Once true, never reverts (jin is irreversible).
   */
  jinned: boolean;

  /**
   * 0-based segment index from trunk junction where jin begins.
   * Segments [jinSegmentStart, branch.length) are deadwood (SCAR voxels).
   * Segments [0, jinSegmentStart) retain their original role.
   *
   * -1 when not jinned (sentinel: no jin applied).
   * 0 when the entire branch is deadwood (cascade from parent, or jin at base).
   *
   * A second jin at a LOWER segmentIndex updates this field to the lower value
   * (jin expands toward the base, never shrinks).
   *
   * The voxelizer uses this to split the branch tube: voxels with parameter
   * t >= (jinSegmentStart / branch.length) get VoxelRole.SCAR; those below
   * keep their original role.
   */
  jinSegmentStart: number;
```

**Default values for all creation paths:**
- `jinned: false`
- `jinSegmentStart: -1`

These must be added to:
1. `packages/engine/src/tree.ts` -- trunk creation (line 25)
2. `packages/engine/src/GrowthEngine.ts` -- fork child creation (line 399)

---

### Part 2 -- JinRejectReason Update

Re-add `'already-jin'` to JinRejectReason (reverting Carmack C-5 removal):

```typescript
// packages/shared/src/index.ts
// Carmack C-5 fix (2026-08-02) removed 'already-jin' because no Branch.jinned
// field existed. Phase 2 adds the field -- re-adding the reason.
export type JinRejectReason = 'not-found' | 'pruned' | 'segment-out-of-range' | 'already-jin';
```

`'already-jin'` is returned when:
- `b.jinned === true` AND `segmentIndex >= b.jinSegmentStart`
  (the requested region is already fully jin'd -- no new deadwood to create)

A jin at a LOWER segmentIndex on an already-jinned branch is VALID -- it extends
the deadwood region toward the base.

---

### Part 3 -- JinEngine.applyJin Implementation

Replace the Phase 1 stub with:

```typescript
import type { JinResult } from '@kijo/shared';
import type { BonsaiTree } from './BonsaiTree.js';

/**
 * JinEngine -- stateless jin-pliers logic.
 * Pattern: stateless class, same as WireEngine / PruneEngine.
 *
 * Jin permanently converts bark segments to SCAR voxels (VoxelRole.SCAR),
 * granting a Defense bonus and qualifying the Jin overlay for TechniqueClassifier.
 * Jin is irreversible and is a premium action.
 *
 * Phase 2: full implementation.
 *
 * Specification: ARCH-JINENGINE-PHASE2-2026-09-18.md (this document).
 */
export class JinEngine {

  /**
   * Strip bark from a branch section using jin pliers -> SCAR voxels.
   *
   * Steps:
   *   1. Validate branchId, pruned, segmentIndex (existing Phase 1 logic)
   *   2. Check already-jin (new): if jinned && segmentIndex >= jinSegmentStart
   *   3. Mark branch jinned, set jinSegmentStart
   *   4. Cascade: mark all child branches fully jinned
   *   5. Freeze: jinned branches are dead (growth/physics skip them)
   *   6. Log care entry via tree._logCare
   *   7. tree.markDirty()
   *   8. Return { ok: true }
   *
   * @param tree         The BonsaiTree instance.
   * @param branchId     Index into TreeState.branches.
   * @param segmentIndex 0-based position from trunk junction.
   * @param jinCost      jin-pliers consumables spent (>= 1). Logged only.
   */
  static applyJin(
    tree: BonsaiTree,
    branchId: number,
    segmentIndex: number,
    jinCost: number,
  ): JinResult {
    const branches = tree.getBranches();
    const b = branches[branchId];

    // -- Step 1: Input validation (unchanged from Phase 1) --
    if (!b) return { ok: false, reason: 'not-found' };
    if (b.pruned) return { ok: false, reason: 'pruned' };
    if (segmentIndex < 0 || segmentIndex >= b.length) {
      return { ok: false, reason: 'segment-out-of-range' };
    }

    // -- Step 2: Already-jin check --
    // If the branch is already jinned and the requested region is already
    // covered (segmentIndex >= jinSegmentStart), there is nothing new to do.
    if (b.jinned && segmentIndex >= b.jinSegmentStart) {
      return { ok: false, reason: 'already-jin' };
    }

    // -- Step 3: Mark branch jinned --
    // If already jinned at a higher segmentIndex, extend toward the base.
    // Otherwise, first jin on this branch.
    if (b.jinned) {
      // Extending: move jinSegmentStart lower (toward trunk junction).
      b.jinSegmentStart = segmentIndex;
    } else {
      b.jinned = true;
      b.jinSegmentStart = segmentIndex;
    }

    // -- Step 4: Cascade to children --
    // All child branches are fully jinned (they attach beyond or at the
    // deadwood zone). Use iterative stack (same pattern as PruneEngine cascade).
    const stack = [...b.children];
    while (stack.length > 0) {
      const childId = stack.pop()!;
      const child = branches[childId];
      if (!child || child.pruned) continue;
      // Skip if already fully jinned (jinSegmentStart === 0 means entire branch).
      if (child.jinned && child.jinSegmentStart === 0) continue;
      child.jinned = true;
      child.jinSegmentStart = 0; // entire child branch is deadwood
      stack.push(...child.children);
    }

    // -- Step 5: Freeze is implicit --
    // GrowthEngine and BonsaiTree.applyDailyUpdate check b.jinned to skip.
    // No additional mutation needed here.

    // -- Step 6: Log care entry --
    tree._logCare({
      day: tree.getAge(),
      action: { type: 'jin', branchId, segmentIndex, jinCost },
    });

    // -- Step 7: Mark dirty --
    tree.markDirty();

    // -- Step 8: Return success --
    // scarVoxelCount left undefined -- actual count determined at voxelization
    // time. The engine does not have voxel geometry at applyJin time.
    return { ok: true };
  }
}
```

**Key design decisions:**

1. **No separate "freeze" mutation.** Jin'd branches are frozen by the skip checks
   in GrowthEngine and applyDailyUpdate. Setting `jinned = true` is sufficient.

2. **Cascade uses iterative stack** (PruneEngine pattern). All descendants of the
   jin'd zone become fully deadwood (jinSegmentStart = 0).

3. **scarVoxelCount is undefined.** The engine has no voxel geometry -- the voxelizer
   computes the actual count. The field is optional in JinResult for this reason.

4. **jinCost is logged, not consumed.** The engine has no inventory system. The
   server-side Edge Function gates the purchase. jinCost appears in the care log
   entry for historical record and replay independence.

5. **Extending jin.** A second jin at a lower segmentIndex on the same branch is
   allowed -- it moves jinSegmentStart down. A jin at a higher segmentIndex is
   rejected as 'already-jin'.

---

### Part 4 -- GrowthEngine Changes

**File:** `packages/engine/src/GrowthEngine.ts`

Three skip-check additions (minimal diff):

**4a -- extendAndFork (line 314):**
```typescript
// BEFORE:
if (b.pruned) return;

// AFTER:
if (b.pruned || b.jinned) return;
```

**4b -- thickeningPass (line 479):**
```typescript
// BEFORE:
if (b.pruned) return 0;

// AFTER:
if (b.pruned || b.jinned) return 0;
```

**4c -- selectFloorTipId (line 213-214):**
```typescript
// BEFORE:
if (b.pruned) continue;

// AFTER:
if (b.pruned || b.jinned) continue;
```

**Rationale:** A jinned branch is permanently dead — no growth, no forks, no new
tissue. If selectFloorTipId picks a jinned branch as the floor tip, the R1 band
guarantee is broken forever: extendAndFork skips it, so the guaranteed fork never
fires. The floor recovery mechanism must skip jinned branches the same way it
skips pruned ones.

**Rationale (extendAndFork + thickeningPass):** A jinned branch is dead. It does
not extend, fork, or thicken. The physical wood remains (unlike prune which
conceptually removes it), but
biological growth has stopped. The voxelizer still renders it -- as SCAR.

---

### Part 5 -- BonsaiTree.applyDailyUpdate Changes

**File:** `packages/engine/src/BonsaiTree.ts`

**5a -- Physics loop skip (line 57):**
```typescript
// BEFORE:
if (b.pruned) continue;

// AFTER:
if (b.pruned || b.jinned) continue;
```

**Rationale:** Dead wood has no stress response. Twine/weight/wire on a jinned
branch is meaningless -- the branch cannot bend further. The physics loop
(steps 4a-4e) should skip jinned branches entirely.

**Note:** If a branch has active wire/twine/weight when jin is applied, those
bindings become inert. The binding state fields (wired, twined, weighted) are
NOT cleared -- they remain as historical record. But the physics loop skips
the branch, so the bindings have no further mechanical effect. This is correct:
jin supersedes all mechanical bindings by killing the branch.

---

### Part 6 -- Voxelizer Changes

**File:** `packages/voxelizer/src/index.ts`

The voxelizer must check `branch.jinned` and `branch.jinSegmentStart` when
assigning roles to tube voxels.

**6a -- Role assignment for jinned branches (around line 176-184):**

Current code assigns role purely by depth. For jinned branches, the role
must be split:

```typescript
// In the branch fill loop (line 176 area):
for (const b of branches) {
  if (b.pruned) continue;
  const pos = positions.get(b.id);
  if (!pos) continue;
  const mat: Material = b.depth === 0
    ? Material.HEARTWOOD
    : b.depth === 1 ? Material.BARK : Material.BRANCH_WOOD;
  const baseRole: VoxelRole = branchRole.get(b.id) ?? VoxelRole.TRUNK;

  // --- JIN SCAR SPLIT ---
  // If branch is jinned, segments from jinSegmentStart onward get SCAR role.
  // If jinSegmentStart === 0, the entire branch is SCAR.
  // The split is parameterized by t = position along the branch tube [0, 1].
  // t >= (jinSegmentStart / branch.length) -> VoxelRole.SCAR
  // t <  (jinSegmentStart / branch.length) -> baseRole (original)
  //
  // Implementation: fillTube already iterates along the tube parameterized by t.
  // Add a jinThreshold parameter.
  const jinThreshold = (b.jinned && b.jinSegmentStart >= 0)
    ? b.jinSegmentStart / Math.max(b.length, 1)
    : 1.0; // 1.0 = no jin (t never reaches 1.0 in the loop)

  Voxelizer.fillTube(pos.start, pos.end, b.thickness, mat, baseRole, b.id,
    voxels, jinThreshold);

  // Leaf spheres: jinned branches do NOT get canopy (dead wood has no leaves).
  const hasLivingChildren = b.children.some(
    (id: number) => branches[id] && !branches[id].pruned
  );
  if (!hasLivingChildren && !b.jinned) {
    Voxelizer.fillSphere(pos.end, 2.0, Material.LEAF, VoxelRole.CANOPY,
      b.id, voxels);
  }
}
```

**6b -- fillTube signature change:**

```typescript
// BEFORE:
private static fillTube(
  start: Vec3, end: Vec3, thickness: number,
  mat: Material, role: VoxelRole, branchId: number,
  voxels: SparseVoxelSet
): void

// AFTER:
private static fillTube(
  start: Vec3, end: Vec3, thickness: number,
  mat: Material, role: VoxelRole, branchId: number,
  voxels: SparseVoxelSet,
  jinThreshold: number = 1.0,  // default: no jin (backward compatible)
): void
```

Inside fillTube, the loop that places voxels along the tube already has a
parameter `t` in [0, 1] representing position along the branch:

```typescript
// Inside the loop:
const effectiveRole = (t >= jinThreshold) ? VoxelRole.SCAR : role;
voxels.set(px, py, pz, mat, effectiveRole, branchId);
```

**6c -- Wire SCAR (parallel gap, out of scope but noted):**

The same jinThreshold approach could be used for wireScarred branches:
```
If b.wireScarred, override role to VoxelRole.SCAR for the entire branch.
This is NOT part of this spec -- it is a separate task (V3 advisory).
```

---

### Part 7 -- CareLogReplay: No Changes Needed

`CareLogReplay.ts` lines 141-144 already correctly delegates to
`tree.applyJin(a.branchId, a.segmentIndex, a.jinCost)`. Once JinEngine stops
throwing and actually works, replay will work automatically.

No CareLogReplay changes are needed for jin Phase 2.

---

### Part 8 -- What "jinCost consumption" Means

The engine does NOT have a consumable inventory. `jinCost` is:
1. Validated by BonsaiTree.applyJin (must be positive integer)
2. Passed to JinEngine.applyJin (used in care log entry)
3. Logged in the care entry: `{ type: 'jin', branchId, segmentIndex, jinCost }`
4. The server-side Edge Function handles the actual purchase gate

The Phase 1 stub's `void jinCost` was correct in spirit -- jinCost is acknowledged
in the log, not "consumed" by the engine. Phase 2 removes the `void` statement
because jinCost is now used in the _logCare call.

---

### Part 9 -- Determinism Guarantee

Jin is fully deterministic: same seed + same jin actions -> identical result.

**Why:**
- applyJin is pure mutation: no RNG calls, no Date.now(), no Math.random()
- Branch fields are set to exact values (boolean, integer index)
- Cascade is deterministic: iterative stack with pop() over children array
  (children array is always in insertion order, which is deterministic)
- Voxelizer reads jinned/jinSegmentStart deterministically
- Care log entry is deterministic (day from tree.getAge(), which is incremented
  by applyDailyUpdate deterministically from seed)

**No new RNG needed.** Jin does not use any randomness.

---

### Part 10 -- Edge Cases

**E1: segmentIndex is 0 (jin the entire branch from base)**
- Valid. Sets jinSegmentStart = 0. Entire branch is SCAR.
- All children cascade to full SCAR.
- Equivalent to "shari" in real bonsai (trunk deadwood).

**E2: Branch is already fully jinned (jinned=true, jinSegmentStart=0)**
- Any segmentIndex >= 0 satisfies `segmentIndex >= jinSegmentStart`.
- Returns { ok: false, reason: 'already-jin' }.

**E3: Branch is partially jinned, new jin at lower segmentIndex**
- Valid. Extends jin toward base: jinSegmentStart = new lower value.
- No re-cascade needed (children are already fully jinned from first jin).

**E4: Branch is partially jinned, new jin at same or higher segmentIndex**
- Returns { ok: false, reason: 'already-jin' }.
- That region is already deadwood.

**E5: Jin on trunk (depth=0, branchId=0)**
- Valid. No depth restriction. Real bonsai shari = trunk deadwood.
- Trunk jin'd from segmentIndex=0 kills the entire tree above that point
  (all depth-1 branches cascade to full SCAR). This is an extreme action.

**E6: Jin on a branch with active wire/twine/weight**
- Jin supersedes mechanical bindings. The branch is now dead.
- Binding state fields (wired, twined, weighted) are NOT cleared.
- Physics loop skips the branch (b.jinned -> continue), so bindings are inert.
- Historical record preserved in care log.

**E7: Jin on a branch whose parent is already jinned**
- The cascade from parent jin already marked this branch as fully jinned.
- Returns { ok: false, reason: 'already-jin' }.

**E8: segmentIndex equals b.length (one past the end)**
- Existing validation: `segmentIndex >= b.length` -> 'segment-out-of-range'.
- segmentIndex is 0-based, valid range is [0, b.length - 1].

**E9: Jin during replay**
- CareLogReplay passes stored branchId, segmentIndex, jinCost.
- JinEngine applies them deterministically. Same result as original.
- If branchId has grown additional children since the jin action, the cascade
  still works: it cascades to all current children, which matches the
  reconstruction state at that day (children are added by growTick after
  care actions, per replay order: care first, then tick).

---

## FILES CHANGED

| File | Change | Reason |
|------|--------|--------|
| `packages/shared/src/index.ts` | Add Branch.jinned, Branch.jinSegmentStart fields | Engine needs per-branch jin state |
| `packages/shared/src/index.ts` | Add 'already-jin' to JinRejectReason | Phase 2 can detect duplicate jin |
| `packages/engine/src/JinEngine.ts` | Replace Phase 1 stub with full implementation | Core deliverable |
| `packages/engine/src/tree.ts` | Add jinned: false, jinSegmentStart: -1 to trunk | Default branch creation |
| `packages/engine/src/GrowthEngine.ts` | Add `b.jinned` skip in extendAndFork + thickeningPass + selectFloorTipId | Dead branches do not grow or get selected as floor tip |
| `packages/engine/src/BonsaiTree.ts` | Add `b.jinned` skip in applyDailyUpdate physics loop | Dead branches have no stress |
| `packages/voxelizer/src/index.ts` | Add jinThreshold to fillTube; SCAR role for jin'd segments; no canopy for jinned branches | Render deadwood correctly |
| `apps/server/.../care-action/index.ts` | Re-add 'jin' to ALLOWED_ACTION_TYPES | Ungate after Phase 2 passes |

**Files NOT changed:**
- `CareLogReplay.ts` -- already correctly delegates; no changes needed
- `TechniqueClassifier.ts` -- reads care log, not Branch fields; works as-is
- `StatDeriver.ts` -- counts SCAR voxels; works as-is once voxelizer emits them
- `PruneEngine.ts` -- jin and prune are orthogonal; no interaction

---

## DONE-WHEN CRITERIA

The implementer declares done when ALL of the following are observed:

**DW-1: JinEngine no longer throws.**
Calling `JinEngine.applyJin(tree, validBranchId, validSegmentIndex, 1)` returns
`{ ok: true }` instead of throwing CareLogReplayError.

**DW-2: Branch.jinned is set.**
After applyJin, `tree.getBranches()[branchId].jinned === true`.

**DW-3: Branch.jinSegmentStart is set.**
After applyJin with segmentIndex=3, `branch.jinSegmentStart === 3`.

**DW-4: Children cascade.**
After jin on a branch with children, all descendant branches have
`jinned === true, jinSegmentStart === 0`.

**DW-5: Care log entry written.**
After applyJin, `tree.getCareLog()` contains an entry with
`{ type: 'jin', branchId, segmentIndex, jinCost }`.

**DW-6: markDirty called.**
After applyJin, `tree.isDirty() === true`.

**DW-7: Growth engine skips jinned branches.**
A jinned branch does not extend or fork in subsequent growTick calls.

**DW-8: Physics skips jinned branches.**
A jinned branch is not processed in applyDailyUpdate physics loop.

**DW-9: Voxelizer emits SCAR for jinned segments.**
Voxels in the jin'd region of a branch have VoxelRole.SCAR.

**DW-10: Replay determinism.**
Reconstruct a tree with jin actions via CareLogReplay.reconstruct() twice
with same seed/species/careLog/totalDays. Both trees are byte-identical
(voxelize both, serialize both, compare).

**DW-11: Already-jin rejection.**
A second jin at the same or higher segmentIndex returns
`{ ok: false, reason: 'already-jin' }`.

**DW-12: Jin extension.**
A second jin at a LOWER segmentIndex on the same branch returns
`{ ok: true }` and updates jinSegmentStart to the lower value.

**DW-13: Floor recovery skips jinned branches.**
`selectFloorTipId` does not return a jinned branch id. A tree below the
branch floor with its lowest-ID branch jinned still recovers via the
next eligible living branch.

---

## TEST GATE DESIGN

Test file: `packages/engine/test_jin.mjs`

```
JIN-1: Basic jin success
  - Grow tree to day 50 (has branches). Pick a depth-1 branch.
  - Call tree.applyJin(branchId, 2, 1).
  - Assert: result.ok === true.
  - Assert: branch.jinned === true, branch.jinSegmentStart === 2.
  - Assert: care log contains { type: 'jin', branchId, segmentIndex: 2, jinCost: 1 }.
  - Assert: tree.isDirty() === true.

JIN-2: Child cascade
  - Grow tree to day 100 (depth-2 branches exist).
  - Find a depth-1 branch with depth-2 children.
  - Call tree.applyJin(parentId, 0, 1) (jin entire parent).
  - Assert: parent.jinned === true, parent.jinSegmentStart === 0.
  - Assert: ALL children have jinned === true, jinSegmentStart === 0.
  - Assert: ALL grandchildren (if any) have jinned === true.

JIN-3: Already-jin rejection
  - Jin a branch at segmentIndex=2.
  - Jin same branch at segmentIndex=3 (higher).
  - Assert: second call returns { ok: false, reason: 'already-jin' }.

JIN-4: Jin extension (lower segmentIndex)
  - Jin a branch at segmentIndex=4.
  - Jin same branch at segmentIndex=1 (lower).
  - Assert: second call returns { ok: true }.
  - Assert: branch.jinSegmentStart === 1.

JIN-5: Validation rejections (unchanged from Phase 1)
  - Invalid branchId -> { ok: false, reason: 'not-found' }.
  - Pruned branch -> { ok: false, reason: 'pruned' }.
  - segmentIndex >= branch.length -> { ok: false, reason: 'segment-out-of-range' }.
  - segmentIndex < 0 -> caught by BonsaiTree.applyJin (throws CareLogReplayError).

JIN-6: Growth engine skip
  - Grow tree to day 50. Record branch count and lengths.
  - Jin a branch at segmentIndex=0.
  - Call GrowthEngine.growTick(tree) 10 more times.
  - Assert: jinned branch length and thickness unchanged.
  - Assert: jinned branch has no new children.

JIN-7: Physics skip
  - Apply twine to a branch, then jin it.
  - Run applyDailyUpdate 10 times.
  - Assert: branch.currentStress unchanged after jin (stays at pre-jin value or 0).

JIN-8: Voxelizer SCAR emission
  - Grow tree to day 50. Jin a branch at segmentIndex=2.
  - Voxelize the tree.
  - Assert: some voxels for the jinned branch have VoxelRole.SCAR.
  - Assert: voxels below the jin point retain original role.
  - Assert: jinned branch has NO canopy (no LEAF sphere at tip).

JIN-9: Replay determinism
  - Build care log with water + prune + jin entries.
  - CareLogReplay.reconstruct(seed, species, log, 60) twice.
  - Voxelize both trees, serialize both.
  - Assert: byte-identical.

JIN-10: Full cascade from trunk
  - Grow tree to day 100. Jin trunk (branchId=0) at segmentIndex=0.
  - Assert: ALL branches in tree have jinned === true.
  - Assert: no growth occurs on subsequent ticks.

JIN-11: Floor recovery after jin
  - Grow tree to day 50, ensure livingCount < branchFloor.
  - Jin the lowest-ID eligible (non-pruned) branch.
  - Call GrowthEngine.growTick(tree) 20 more times.
  - Assert: selectFloorTipId never returns the jinned branch id.
  - Assert: new branches still fork (floor recovery works around the jinned tip).
```

**Gate pass criterion:** JIN-1 through JIN-11 all pass. 0 failures.

---

## ASSUMPTIONS

1. **segmentIndex semantics:** 0-based integer index along the branch from trunk
   junction. Valid range: [0, branch.length - 1]. Maps to the tube parameter
   t = segmentIndex / branch.length in the voxelizer. If C++ spec uses a different
   encoding, reconcile in the engine layer without changing the TypeScript type.

2. **Jin kills the entire branch for growth purposes.** Even if only the tip is
   jin'd (segmentIndex > 0), the branch stops growing entirely. This simplifies
   the implementation (no partial-growth model). If a future design requires
   partial growth (living base still extends), this is a separate spec change.

3. **No undo/reversal of jin.** Jin is permanent and irreversible. No
   "jin-remove" action exists or is planned. Once jinned, always jinned.

4. **Existing bindings become inert on jin.** Wire/twine/weight on a jin'd branch
   are not cleared but have no mechanical effect (physics loop skips the branch).

5. **jinThreshold approach in voxelizer** assumes fillTube's internal loop has a
   parameter t in [0, 1]. The implementer must verify this against the actual
   fillTube implementation and adapt if the parameterization differs.

---

## OPEN QUESTIONS

None. All design questions are resolved by the verified sources above.

---

## CROSS-REFERENCE CHECK

```
CROSS-REFERENCE CHECK
  checked against:
    - packages/shared/src/index.ts (Branch, JinResult, VoxelRole)
    - packages/engine/src/JinEngine.ts (Phase 1 stub)
    - packages/engine/src/BonsaiTree.ts (applyJin, applyDailyUpdate)
    - packages/engine/src/GrowthEngine.ts (extendAndFork, thickeningPass)
    - packages/engine/src/CareLogReplay.ts (jin handler)
    - packages/engine/src/TechniqueClassifier.ts (jinCount)
    - packages/engine/src/StatDeriver.ts (scarVoxels -> defense)
    - packages/voxelizer/src/index.ts (role assignment, fillTube)
    - docs/ARCHITECT-CAREACTION-TECHNIQUE-2026-07-30.md (jin design)
    - docs/DESIGN-TECHNIQUE-CLASSIFICATION.md (classifier logic)
    - docs/pipeline/AUDIT-CARE-REPLAY-GAPS-2026-09-18.md (gap audit)
    - wiki/decisions/gate-jin-landscape-server-2026-09-18.md (server gate)

  consistent: YES
    - JinEngine follows WireEngine/PruneEngine stateless pattern
    - Branch field additions follow physics fields pattern (2026-08-01)
    - GrowthEngine skip pattern matches pruned-branch skip
    - VoxelRole.SCAR already exists and StatDeriver already counts it
    - TechniqueClassifier already counts jin actions from care log
    - CareLogReplay already delegates correctly

  boundary violations: NONE
    - shared -> no engine imports (safe; Branch fields are data-only)
    - engine -> shared (JinResult, Branch): valid, existing dep direction
    - voxelizer -> shared + engine: valid, existing dep direction

  terminology: ALIGNED
    - "jin" (lowercase) for the action type in care log
    - "Jin" (capitalized) for the technique overlay
    - VoxelRole.SCAR for deadwood voxels
    - jinned/jinSegmentStart for Branch fields (camelCase, consistent with
      wired/wireAppliedDay pattern)
```
