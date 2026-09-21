# Critic Review: JinEngine Phase 2 Architect Spec
**Date:** 2026-09-18
**Reviewed:** ARCH-JINENGINE-PHASE2-2026-09-18.md (782 lines)
**Reviewer:** Critic pass (Carmack/Linus + Verified Architect framework)

---

## VERDICT: APPROVED WITH CHANGES

Fix 2 blocking issues before implementer proceeds. 6 advisory items documented.

---

## BLOCKING ISSUES

### B-1: Part 4a diff template uses wrong keyword and wrong line number

**Spec says (Part 4, section 4a):**
```
**4a -- extendAndFork (line 214):**
// BEFORE:
if (b.pruned) continue;
// AFTER:
if (b.pruned || b.jinned) continue;
```

**Actual code (GrowthEngine.ts line 314):**
```typescript
if (b.pruned) return;
```

`extendAndFork` is a recursive function, not a loop body. The skip uses `return`,
not `continue`. The line number is 314, not 214. An implementer following the spec
literally would search for `continue` on line 214 and not find it.

**Contrast:** Part 4b (thickeningPass) correctly shows `return 0` at line 479.
Part 5 (applyDailyUpdate physics loop) correctly shows `continue` at line 57.
Only Part 4a is wrong.

**Fix:** Change Part 4a to:
```
**4a -- extendAndFork (line 314):**
// BEFORE:
if (b.pruned) return;
// AFTER:
if (b.pruned || b.jinned) return;
```

**Severity:** BLOCKING. Subagent implementers follow diffs literally. Wrong keyword
in a diff template can produce incorrect code or wasted debugging.

---

### B-2: selectFloorTipId must skip jinned branches

**The spec does not mention selectFloorTipId** (GrowthEngine.ts lines 209-223).
This function selects the ONE branch allowed to fork when the floor recovery
mechanism is active (livingCount < branchFloor).

Current code (line 213-214):
```typescript
for (const b of branches) {
  if (b.pruned) continue;
```

This does NOT skip jinned branches. If a jinned branch is the lowest-ID eligible
tip, it becomes the floor tip every day. `extendAndFork` will then skip it
(b.jinned -> return), so the guaranteed fork never fires. The floor guarantee is
permanently broken for that tree.

**Scenario:** Tree has 10 living branches (below floor of 15). Branch 3 (lowest
eligible ID) was jinned. Every day, selectFloorTipId returns 3. Every day,
extendAndFork skips branch 3 because it is jinned. No new branch ever grows.
The tree is stuck below floor forever.

**Fix:** Add to spec FILES CHANGED table: GrowthEngine.ts selectFloorTipId.
The implementer must add `|| b.jinned` at line 214:
```typescript
if (b.pruned || b.jinned) continue;
```

**Severity:** BLOCKING. Breaks a core growth invariant (R1 band floor guarantee)
in any tree that jins a low-ID branch while below the floor.

---

## ADVISORY ISSUES

### A-1: Cascade marks ALL children regardless of attachmentY vs jinSegmentStart

OQ-4 resolution says: "Jin converts everything from the chosen point OUTWARD to
the tip. Picking segmentIndex N converts segment N through the branch tip, plus
ALL sub-branches extending beyond that point."

The cascade code does `const stack = [...b.children]` -- ALL children, including
those with `attachmentY < jinSegmentStart`. These children attach in the living
zone of the parent branch but become fully SCAR.

**Visual consequence:** A dead sub-branch growing from living wood (segments 0 to
jinSegmentStart-1 are living bark, but the child attached there is SCAR).

**Practical impact:** Low for depth-2+ children (attachmentY = parent tip at fork
time, usually above the jin point). Higher for trunk children: primary depth-1
branches attach at 33% of trunk length. If trunk is jin'd at segmentIndex above
the 33% point, the primary child is below the jin point but still cascaded.

**The spec documents this as Assumption A2:** "Jin kills the entire branch for
growth purposes. This simplifies the implementation." This is a valid
simplification for Phase 2 but should be explicitly flagged as a future
refinement: cascade only children where `child.attachmentY >= jinSegmentStart`.

**Action:** Add a note to Assumption A2 acknowledging the visual inconsistency
and marking it as a Phase 3 refinement.

---

### A-2: countLivingBranches includes jinned branches

```typescript
countLivingBranches(): number {
  return this.state.branches.filter(b => !b.pruned && b.parent !== null).length;
}
```

This does not check `!b.jinned`. The floor/ceiling controller uses this count to
decide whether recovery or suppression is active. A tree with 15 jinned branches
and 0 truly-living branches reports 15 living, above the floor.

**Impact:** The floor recovery mechanism will not activate for a tree whose branches
are all dead from jin. This may be intentional (jin is a deliberate premium
choice), but the design decision should be documented explicitly.

**Action:** Add a decision to the spec: "Jinned branches count as living for
floor/ceiling purposes. Rationale: jin is a deliberate caretaker choice, not an
accident. The caretaker chose to kill those branches and accepts the
consequence." Or decide to exclude them -- either way, document it.

---

### A-3: Voxelizer hasLivingChildren does not exclude jinned children

```typescript
const hasLivingChildren = b.children.some(
  (id: number) => branches[id] && !branches[id].pruned
);
```

A branch with only jinned (not pruned) children reports `hasLivingChildren=true`
and gets no canopy sphere. This is arguably correct (the children exist, even if
dead) but could cause visual gaps where a "lonely living branch tip" has no
leaves because all its children are dead.

**Impact:** Minor visual. No gameplay effect.
**Action:** Note for future visual polish.

---

### A-4: No test for jin + floor recovery interaction (B-2 scenario)

Test gate JIN-1 through JIN-10 are comprehensive for the jin operation itself,
but none tests the scenario from B-2: jinning a branch while the tree is below
the floor, and verifying that the floor still works.

**Action:** Add JIN-11 or equivalent:
```
JIN-11: Floor recovery after jin
  - Grow tree to day 50, ensure below floor.
  - Jin the lowest-ID eligible branch.
  - Run 20 more growTick calls.
  - Assert: new branches still fork (floor recovery works around the jinned tip).
```

---

### A-5: JIN-8 partial jin voxel verification could be more specific

JIN-8 says: "Assert: voxels below the jin point retain original role." This is
correct but vague. The test should verify the SPLIT: for a branch jin'd at
segmentIndex=2 with length=10, voxels with t < 0.2 retain their original role
(ARM/LEG/TRUNK) and voxels with t >= 0.2 get VoxelRole.SCAR.

**Action:** Spec out the split assertion more precisely in JIN-8.

---

### A-6: Wire SCAR timing pauses for jinned branches (untested correct behavior)

When a branch is jinned, the physics loop skip at line 57 also skips the wire
SCAR timer (line 114: `if (b.wired && !b.wireScarred)`). This means a wired
branch that gets jinned will never accumulate wire SCAR -- it is already SCAR from
jin. This is correct behavior (jin supersedes wire SCAR) but is not explicitly
tested. Consider adding an assertion to JIN-7.

**Action:** Add to JIN-7: "Assert: if branch was wired before jin,
branch.wireScarred remains unchanged after 10 ticks."

---

## VERIFICATION OF SPEC CLAIMS

### Claims CONFIRMED against source code

| # | Claim | Source file | Finding |
|---|-------|-------------|---------|
| V1 | JinEngine.ts is 51-line Phase 1 stub | JinEngine.ts:1-51 | CONFIRMED. Throws at line 49. |
| V2 | CareLogReplay delegates jin correctly | CareLogReplay.ts:141-144 | CONFIRMED. Passes branchId, segmentIndex, jinCost. |
| V3 | BonsaiTree.applyJin validates inputs | BonsaiTree.ts:254-266 | CONFIRMED. Non-negative integer segmentIndex, positive integer jinCost. |
| V4 | JinResult type, no 'already-jin' | shared/index.ts:554-561 | CONFIRMED. Line 554 documents Carmack C-5 removal. |
| V5 | VoxelRole.SCAR exists | shared/index.ts:352 | CONFIRMED. Comment matches. |
| V6 | Branch interface has no jinned field | shared/index.ts:5-191 | CONFIRMED. 191 lines, no jinned or jinSegmentStart. |
| V7 | GrowthEngine extendAndFork skips pruned | GrowthEngine.ts:314 | CONFIRMED but `return` not `continue`. (See B-1.) |
| V8 | GrowthEngine thickeningPass skips pruned | GrowthEngine.ts:479 | CONFIRMED. `if (b.pruned) return 0;` |
| V9 | BonsaiTree physics loop skips pruned | BonsaiTree.ts:57 | CONFIRMED. `if (b.pruned) continue;` |
| V10 | createTree trunk has no jinned field | tree.ts:23-46 | CONFIRMED. No jinned or jinSegmentStart in literal. |
| V11 | GrowthEngine fork child has no jinned | GrowthEngine.ts:399-430 | CONFIRMED. 15 physics fields, no jin fields. |
| V12 | Voxelizer fillTube has t parameter | voxelizer/index.ts:252-253 | CONFIRMED. `const t = i / steps;` |
| V13 | TechniqueClassifier reads care log | TechniqueClassifier.ts:59-87 | CONFIRMED. Counts {type:'jin'} entries. |
| V14 | StatDeriver counts SCAR voxels | StatDeriver.ts:38 | CONFIRMED. SCAR_DEFENSE_MULT = 0.10. |
| V15 | CareAction union includes jin | shared/index.ts:258-259 | CONFIRMED. `{ type: 'jin'; branchId; segmentIndex; jinCost }` |
| V16 | Voxelizer role assignment by depth only | voxelizer/index.ts:164-173 | CONFIRMED. No jinned/wireScarred check. |

### Claims CONFIRMED: no changes needed

| System | Reason | Verified |
|--------|--------|----------|
| CareLogReplay | Already delegates correctly | CareLogReplay.ts:141-144 |
| TechniqueClassifier | Reads care log, not Branch fields | TechniqueClassifier.ts:59-87 |
| StatDeriver | Counts SCAR voxels generically | StatDeriver.ts:38, 97-120 |
| PruneEngine | Orthogonal to jin | No interaction paths |

---

## DECISIONS.MD CONSISTENCY CHECK

| Decision | Conflict? | Notes |
|----------|-----------|-------|
| round4() discipline | NO | Jin has no new growth math. jinSegmentStart is integer. Voxelizer jinThreshold is read-only (not written to TreeState). |
| Flat index children | NO | Cascade uses b.children (number[]) correctly. |
| Per-branch RNG seeding | NO | Jin uses no RNG. |
| Dirty flag Renderer-only clears | NO | Spec calls markDirty(), never clearDirty(). |
| No wall-clock time | NO | No Date.now() or Math.random() in jin logic. |
| PruneEngine cascade pattern | NO | Jin cascade follows same iterative stack pattern. |
| Import boundaries | NO | shared has no engine imports; engine imports shared; voxelizer imports shared+engine. All correct. |

No contradictions found.

---

## DETERMINISM CHECK

Jin is deterministic: no RNG, no Date.now(), no Math.random(). All mutations are
exact assignments (boolean, integer). Cascade is iterative stack with pop() over
children array (insertion-order deterministic). fillTube jinThreshold comparison
uses IEEE 754 deterministic division. PASS.

---

## DONE-WHEN CRITERIA ASSESSMENT

DW-1 through DW-12 are all observable and testable. Each maps to at least one
test gate (JIN-1 through JIN-10). Coverage is sufficient.

**Gap:** No DW criterion for selectFloorTipId skip (B-2). Add:
```
DW-13: Floor recovery skips jinned branches.
selectFloorTipId does not return a jinned branch id.
```

---

## TEST GATE ASSESSMENT

JIN-1 through JIN-10 are comprehensive for the jin operation. Missing:

- JIN-11 (proposed): Floor recovery after jin (B-2 scenario)
- JIN-8 should be more specific about partial-jin voxel split verification (A-5)
- JIN-7 should verify wire SCAR timer also pauses (A-6)

---

## SUMMARY

The spec is thorough, well-verified, and correctly identifies that CareLogReplay,
TechniqueClassifier, and StatDeriver need no changes. The design decisions
(jinCost logged not consumed, cascade pattern, scarVoxelCount undefined) are
sound. The verification log demonstrates genuine source reading.

Two blocking issues must be fixed:
1. **B-1:** Correct the extendAndFork diff template (`return` not `continue`, line 314 not 214)
2. **B-2:** Add selectFloorTipId jinned-skip to the spec and FILES CHANGED table

Six advisory items are documented for spec clarity and test completeness.
