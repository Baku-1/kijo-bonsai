# ARCH-BUG4: CareLogReplay Determinism Test Design
**Date**: 2026-08-07  
**Stage**: Architect  
**Author**: Verified-Architect pipeline stage  
**Bug**: BUG-4 — CareLogReplay path not covered by determinism suite

---

## SCOPE

```
DESIGN TASK:  Design a determinism test suite for CareLogReplay.reconstruct —
              the production path used when loading a tree from Supabase.

DELIVERABLE:  Test spec for packages/engine/test/carelog-determinism.test.js
              (design document only; implementer writes the code).

BUILDS ON:    packages/engine/src/CareLogReplay.ts (verified)
              packages/engine/test/determinism.test.js (existing test style)
              packages/shared/src/index.ts (CareLogEntry / Branch types)
              packages/engine/src/index.ts (exports)

CONSUMED BY:  Disciplined-Implementer (writes the test file);
              Auditor (verifies the implementation matches this spec).
```

---

## CODEBASE RECONNAISSANCE

### Files Read (every file touched by this design)

| File | Read? | Notes |
|---|---|---|
| `packages/engine/src/CareLogReplay.ts` | ✓ | Primary subject — full replay interface |
| `packages/engine/test/determinism.test.js` | ✓ | Existing style reference |
| `packages/shared/src/index.ts` | ✓ | Branch, CareLogEntry, CareAction types |
| `packages/engine/src/index.ts` | ✓ | Engine exports |
| `packages/engine/src/BonsaiTree.ts` | ✓ | All public accessors |
| `packages/engine/src/GrowthEngine.ts` | ✓ | growTick order and semantics |
| `packages/engine/src/PruneEngine.ts` | ✓ | Log-append pattern |
| `packages/engine/src/WireEngine.ts` | ✓ | Log-append pattern, wireCount gate |
| `packages/engine/src/errors.ts` | ✓ | CareLogReplayError |
| `packages/engine/package.json` | ✓ | Build/test command |

### Symbols Verified

```
✓ CareLogReplay.reconstruct — exists in CareLogReplay.ts, exported from index.ts
    signature: static reconstruct(seed: number, species: SpeciesClass,
                careLog: CareLogEntry[], totalDays: number): BonsaiTree
    behavior: creates fresh BonsaiTree(seed, species) internally;
              for day=0..totalDays-1: apply dayEntries, then GrowthEngine.growTick(tree);
              returns the reconstructed BonsaiTree.
    pre-groups entries by day in a Map<number, CareLogEntry[]> for O(1) per-day lookup.

✓ MAX_REPLAY_DAYS — 36_500; exported; guards totalDays upper bound
✓ CareLogReplayError — exported; thrown on invalid inputs and unknown action types

✓ BonsaiTree.getBranches() — returns Branch[] (mutable internal array by reference)
✓ BonsaiTree.getHealth() — returns number (0–100)
✓ BonsaiTree.getMoisture() — returns number (0–100)
✓ BonsaiTree.getAge() — returns current day counter (incremented by applyDailyUpdate)
✓ BonsaiTree.getSeed() — returns number
✓ BonsaiTree.getSpecies() — returns SpeciesClass
✓ BonsaiTree.getRotationState() — returns 0|90|180|270
✓ BonsaiTree.getCareLog() — returns CareLogEntry[] (internal array by reference)
✓ BonsaiTree.countLivingBranches() — counts non-pruned, non-trunk branches
✓ BonsaiTree.getPrunedCount() — counts pruned branches
✓ BonsaiTree.water(amount) — logs { day, action:{type:'water',amount} } to internal careLog
✓ BonsaiTree.rotate() — logs { day, action:{type:'rotate'} } to internal careLog
✓ BonsaiTree.wire(branchId, angleDelta) — delegates to WireEngine.wire()
✓ BonsaiTree.prune(branchId) — delegates to PruneEngine.prune()
✓ BonsaiTree.fertilize() — logs if cooldown===0; no-op otherwise (cooldown=8 days)

✓ GrowthEngine.growTick(tree) — exported; advances tree one full day;
    order: applyDailyUpdate → _tickFertilizer → extendAndFork → thickeningPass → markDirty

✓ PruneEngine.prune(tree, branchId) — exported; logs entry via tree._logCare()
✓ WireEngine.wire(tree, branchId, angleDelta) — exported; logs entry via tree.getCareLog().push()

✓ Branch interface fields (all from packages/shared/src/index.ts):
    id, parent, depth, angle, length, thickness, pruned, children, attachmentY,
    diameter, currentStress, stressInitial,
    wired, wireAppliedDay, wireAngle, wireSet, wireScarred, wireCount? (optional),
    twined, twineAppliedDay, twineAngle, twineForcePerDay, twineDegradesDay,
    weighted, weightCount, bendSet

✓ CareLogEntry — { day: number; action: CareAction }
✓ CareAction union (Phase 1 usable): 'water','rotate','prune','fertilize','wire','wire-remove'
✓ CareAction union (Phase 1 stubs — throw "not implemented"): 'twine','twine-remove','weight','weight-remove','jin'
✓ CareAction 'landscape' — implemented in Phase 1 (logs + markDirty, no state change to assert)

✓ Test file import pattern: from '../dist/index.js' (post-build .js, not .ts)
✓ Test runner: node:test + node:assert/strict (matches existing tests)
✓ Test command: node --test test/determinism.test.js test/WireEngine.test.js
    → new file must be added to this command (package.json scripts.test)

✓ SpeciesClass — 'hardwood' | 'evergreen' | 'tropical'
```

### Call Sites of CareLogReplay.reconstruct

```
grep -rn "CareLogReplay" packages/
  packages/engine/src/CareLogReplay.ts — definition
  packages/engine/src/index.ts — export
  (no existing test call sites — confirmed by grep of test/ directory)
```

CareLogReplay.reconstruct has **zero existing test call sites**. The new file is the first.

### Care-Log Append Pattern (Critical for Replay Symmetry)

How entries are appended to `BonsaiTree.careLog` in live play vs. replay:

| Action | Live-play log path | Replay: what is called | Replay tree log result |
|---|---|---|---|
| `water` | `BonsaiTree.water()` → `this.careLog.push()` | `tree.water(a.amount)` | same push → same entry |
| `rotate` | `BonsaiTree.rotate()` → `this.careLog.push()` | `tree.rotate()` | same push → same entry |
| `fertilize` | `BonsaiTree.fertilize()` → `this.careLog.push()` | `tree.fertilize()` | same push → same entry |
| `prune` | `PruneEngine.prune()` → `tree._logCare()` | `PruneEngine.prune(tree, a.branchId)` | same `_logCare()` → same entry |
| `wire` | `WireEngine.wire()` → `tree.getCareLog().push()` | `WireEngine.wire(tree, a.branchId, a.angleDelta)` | same push → same entry |
| `wire-remove` | `WireEngine.removeWire()` → `tree._logCare()` | `tree.removeWire(a.branchId)` | same `_logCare()` → same entry |

**Result**: both live tree and replayed tree accumulate structurally identical `careLog` arrays. `assert.deepEqual` on `getCareLog()` will hold (verified by tracing the code path for each action type).

**Note on WireEngine inconsistency**: `WireEngine.wire()` uses `tree.getCareLog().push()` (line 99 of WireEngine.ts) while all other engines use `tree._logCare()`. Both paths write to the same underlying array. This is a code-style inconsistency, not a functional bug, but the implementer should be aware.

### Day-Counter Alignment (Critical for Correctness)

In the live tree, `BonsaiTree.water(25)` on loop iteration `d=0` logs `{ day: this.state.day, ... }` where `this.state.day` is still `0` before `growTick` increments it. This matches replay: for `day=0` in `CareLogReplay.reconstruct`, entries with `entry.day === 0` are applied before `growTick`, which increments the day. The correspondence is exact across all 6 action types.

### Gaps Found

| Gap | Details |
|---|---|
| `wireCount` is optional on Branch | Initialized `undefined`; set to an integer only after the first `WireEngine.wire()` call. `assert.deepEqual` on Branch arrays will see `undefined` consistently for never-wired branches — no issue. |
| Phase 1 stubs | `twine`, `twine-remove`, `weight`, `weight-remove`, `jin` throw "not implemented". The test MUST NOT include these action types in its care log. |
| `landscape` fully implemented but unobservable in branch state | Phase 1 `addLandscape` logs and marks dirty; no Branch field changed. Including it adds no value to a branch-state determinism test. Omit. |
| WireEngine.wire uses different log API than other engines | Functional concern only; does not affect test design. Flag for code cleanup (separate issue). |

---

## VERIFICATION LOG

```
VERIFIED:
  ✓ CareLogReplay.reconstruct creates fresh BonsaiTree internally (line 96: const tree = new BonsaiTree(seed, species))
  ✓ Replay loops day=0..totalDays-1: apply care entries for that day, then GrowthEngine.growTick (lines 97-163)
  ✓ totalDays > MAX_REPLAY_DAYS throws CareLogReplayError (line 56-60)
  ✓ careLog entries for days >= totalDays are silently ignored (byDay is built for all entries but loop only reads 0..totalDays-1)
  ✓ Wire replay uses stored angleDelta (= appliedDelta, post-clamp from live play) — replay-independent of tuning constants
  ✓ wireCount is incremented inside WireEngine.wire during replay (line 79: b.wireCount = (b.wireCount ?? 0) + 1)
  ✓ Cascade gate (120° vs 150°) is correctly replayed because wireCount advances in the same sequence
  ✓ BonsaiTree constructor initializes: moisture=55, health=85, day=0, nextId=1
  ✓ branch.angle stored in degrees (verified: WireEngine POLAR_MIN_DEG = 5.7296, POLAR_MAX_DEG = 150)
  ✓ node:test + node:assert/strict pattern — matches existing determinism.test.js and WireEngine.test.js
  ✓ fertilize cooldown: BonsaiTree.fertilize() is no-op when fertilizerCooldown > 0; care log only contains successful entries; replay will succeed when called for logged entries because cooldown state advances identically

UNVERIFIED (could not confirm without running the build):
  ? branch ID of first forkable branch after N days for seed=42 — not needed; spec uses dynamic branch discovery at test runtime
  ? exact day the first depth-1 branch appears for seed=42 — not needed; spec uses ≥ 20-day warm-up before prune

REFUTED:
  (none)
```

---

## CROSS-REFERENCE CHECK

```
checked against:
  docs/GDD.md                        (core invariant: seed + care_log → identical tree)
  docs/KIJO-ARCHITECTURE.md          (engine boundary: no external state in BonsaiTree)
  docs/KIJO-ENGINE-API.md            (CareLogReplay interface)
  docs/KIJO-TECH-SPEC.md             (species, day cycle, action types)
  packages/engine/test/determinism.test.js (existing test style)

consistent: yes
terminology aligned:
  - 'hardwood' / 'evergreen' / 'tropical' ✓ (SpeciesClass in shared)
  - 'water', 'prune', 'wire', 'rotate', 'fertilize' ✓ (CareAction types)
  - 1 game day = 1 GrowthEngine.growTick ✓
data shapes aligned: yes — Branch fields from shared/src/index.ts match all references
boundary violations: none — test imports only from '../dist/index.js' (engine public API)
```

---

## THE DESIGN

### New Test File

**Path**: `packages/engine/test/carelog-determinism.test.js`  
**Style**: identical to `determinism.test.js` — plain `node:test`, `node:assert/strict`, ES module, imports from `'../dist/index.js'`

**Additions required to `package.json`**:  
The `scripts.test` command must include the new file:
```
"test": "node --test test/determinism.test.js test/WireEngine.test.js test/carelog-determinism.test.js"
```

**Imports needed**:
```
BonsaiTree, GrowthEngine, CareLogReplay, PruneEngine, WireEngine
```
All verified as exported from `packages/engine/src/index.ts`.

---

### Shared Helper: buildTree(seed, species, numDays, scheduleFn)

The implementer should define a helper `buildTree(seed, species, numDays, scheduleFn)` that:
1. Constructs `new BonsaiTree(seed, species)`
2. For each day `d` from `0` to `numDays - 1`:
   a. Calls `scheduleFn(tree, d)` — where the schedule applies care actions based on the current day
   b. Calls `GrowthEngine.growTick(tree)`
3. Returns the finished tree

This mirrors the `grow()` helper in `determinism.test.js` but accepts a schedule function for composable test setups.

**Note**: `getAge()` returns the internal day counter. After `numDays` growTick calls, `tree.getAge() === numDays`. The implementer should use this as `totalDays` when calling `CareLogReplay.reconstruct`.

---

### Care Schedule for Tests A and D: `standardSchedule(tree, d)`

The implementer should define a standard care schedule with all three required action types:

- **Every 3 days** (when `d % 3 === 0`): `tree.water(25)`
- **On day 20** (when `d === 20`): find the first non-trunk, non-pruned branch (`branches.find(b => b.parent !== null && !b.pruned)`) and call `PruneEngine.prune(tree, branch.id)`. If no non-trunk branch exists yet, defer until one exists (check each day, prune on the first day it is available at or after day 20).
- **On day 30** (when `d === 30`): call `tree.wire(0, 30)` — wires the trunk (branchId=0) by +30 degrees. Trunk is wirable per OQ-1 resolution; initial thickness=2 is below WIRE_MAX_THICKNESS=3.

**Rationale for these choices**:
- `water` — exercises the moisture/health path and is the most common care action
- `prune` on a real branch — exercises cascading prune-state propagation
- `wire` on trunk (id=0) — always present; exercises `wireCount`, `wireAppliedDay`, `wireAngle`, Cascade gate state
- Day 30 wire ensures the prune (day 20) has already happened; the wired trunk is not the pruned branch

**Note**: `d === 20` may not have any non-trunk branches yet for some seeds. The implementer should use a sentinel — try on day 20, and if no non-trunk branch exists, try on each subsequent day until one is found. The care log will record the actual day the prune succeeded, so the replay will reproduce it exactly.

---

### Test A — Same Seed + Same Care Log Replayed Twice → Identical Tree

**Purpose**: Core invariant — `CareLogReplay.reconstruct(seed, species, careLog, N)` produces a tree bit-identical to the live tree that generated the care log.

**Setup**:
1. `liveTree = buildTree(42, 'hardwood', 60, standardSchedule)`
2. `careLog = liveTree.getCareLog()` — captures the full log including prune, water, wire entries
3. `N = liveTree.getAge()` — must equal 60
4. `replayTree = CareLogReplay.reconstruct(42, 'hardwood', careLog, N)`

**Assertions**:
1. `assert.deepEqual(replayTree.getBranches(), liveTree.getBranches())`  
   — Covers: all angles, lengths, thicknesses, pruned flags, children arrays, wireCount, wired state, wireScarred, bendSet, diameter, currentStress for every branch.
2. `assert.equal(replayTree.getHealth(), liveTree.getHealth())`
3. `assert.equal(replayTree.getMoisture(), liveTree.getMoisture())`
4. `assert.equal(replayTree.getAge(), N)`  
   — Verifies replay ran the correct number of ticks.
5. `assert.equal(replayTree.getRotationState(), liveTree.getRotationState())`
6. Spot check — pruned branch: locate the branch that was pruned in `liveTree` (found during `standardSchedule`). Assert `replayTree.getBranches()[prunedId].pruned === true`. (This should be covered by assertion 1 but is stated explicitly for documentation clarity.)
7. Spot check — wired trunk: `assert.ok(replayTree.getBranches()[0].wireCount >= 1)` and `assert.equal(replayTree.getBranches()[0].angle, liveTree.getBranches()[0].angle)`.

**What this proves**: Replay faithfully reconstructs the exact same tree as live play for the water → prune → wire combination.

---

### Test B — Same Seed, Different Care Logs → Trees Diverge

**Purpose**: Verify the inverse — different care logs for the same seed produce distinct observable state (replay is sensitive to care input, not just seed).

**Setup**:
1. Build `treeHydrated = buildTree(42, 'hardwood', 60, hydratedSchedule)`  
   `hydratedSchedule`: water 50 every day (`d => tree.water(50)`)
2. Build `treeDrought = buildTree(42, 'hardwood', 60, droughtSchedule)`  
   `droughtSchedule`: never water (no-op schedule)
3. `replayHydrated = CareLogReplay.reconstruct(42, 'hardwood', treeHydrated.getCareLog(), 60)`
4. `replayDrought = CareLogReplay.reconstruct(42, 'hardwood', treeDrought.getCareLog(), 60)`

**Assertions**:
1. `assert.ok(replayHydrated.getHealth() > replayDrought.getHealth())`  
   — Hydrated tree has higher health (moisture in [30,65] range gives +0.8/day; drought gives −1.5/day).
2. `assert.ok(replayHydrated.getMoisture() > replayDrought.getMoisture())`  
   — Drought tree moisture = 0 after ~8 days (confirmed by existing drought test in determinism.test.js).
3. `assert.notDeepEqual(replayHydrated.getBranches(), replayDrought.getBranches())`  
   — Branch geometry diverges because growth rate (`calculateGrowthRate`) is moisture-dependent; drought yields lower extension per tick.

**What this proves**: Replay output is determined by the care log content, not just the seed. Two trees with the same seed but different care logs produce distinct, non-equal results.

**Note**: The assertions in Test B compare the two **replayed** trees, not each replay against its live source. This tests replay-relative divergence. The equivalence of each replay to its live source is established by Test A.

---

### Test C — Empty Care Log Replay Matches No-Care Grow

**Purpose**: Verify that `CareLogReplay.reconstruct(seed, species, [], N)` produces a tree identical to a tree grown for `N` days with no care actions at all. This isolates the GrowthEngine tick path from the care action path.

**Setup**:
1. `liveTree = buildTree(99, 'hardwood', 100, noOpSchedule)`  
   `noOpSchedule`: does nothing (`(tree, d) => {}`)
2. `replayTree = CareLogReplay.reconstruct(99, 'hardwood', [], 100)`

**Assertions**:
1. `assert.deepEqual(replayTree.getBranches(), liveTree.getBranches())`
2. `assert.equal(replayTree.getHealth(), liveTree.getHealth())`
3. `assert.equal(replayTree.getMoisture(), liveTree.getMoisture())`
4. `assert.equal(replayTree.getAge(), 100)`
5. `assert.equal(replayTree.getRotationState(), liveTree.getRotationState())`  
   — Both should be 0 (no rotate in empty schedule).

**Why seed=99 instead of 42**: Avoids test interdependence and exercises a different RNG path. Any seed works; 99 is chosen to distinguish this test's baseline from Test A's seed=42 baseline.

**What this proves**: The replay loop over 0..N-1 with empty per-day entries is equivalent to the raw `GrowthEngine.growTick` loop with no intervening care actions. GrowthEngine ticks are deterministic under replay.

---

### Test D — Partial Replay: totalDays Truncation Produces Correct Mid-State

**Purpose**: Verify that passing a full N-day care log to `CareLogReplay.reconstruct` with `totalDays = M < N` produces the same tree as a tree built with exactly M days of care, not N days. This tests that entries with `day >= M` are correctly ignored and do not corrupt the M-day state.

**Setup**:
1. `treeN = buildTree(42, 'hardwood', 100, standardSchedule)` (full 100-day run)
2. `treeM = buildTree(42, 'hardwood', 50, standardSchedule)` (only 50-day run)  
   — Same seed, same schedule; treeM is the 50-day prefix of treeN.
3. `replayM = CareLogReplay.reconstruct(42, 'hardwood', treeN.getCareLog(), 50)`  
   — Full 100-day care log, but `totalDays = 50`. Entries for days 50–99 are ignored.

**Assertions**:
1. `assert.deepEqual(replayM.getBranches(), treeM.getBranches())`
2. `assert.equal(replayM.getHealth(), treeM.getHealth())`
3. `assert.equal(replayM.getMoisture(), treeM.getMoisture())`
4. `assert.equal(replayM.getAge(), 50)`

**What this proves**: The `totalDays` parameter correctly bounds the replay. Stale or future entries in the care log do not bleed through into the M-day result. This mirrors the production scenario where a client may replay a tree to an intermediate checkpoint.

**Implementation note**: For `treeM` to be the true 50-day prefix of `treeN`, the `standardSchedule` must produce identical entries for days 0–49 regardless of how many total days the enclosing loop runs. This holds because `standardSchedule` is a pure function of `(tree, d)` — it makes care decisions based on `d` and `tree` state, and both `treeN` and `treeM` have identical `tree` state at each day 0–49 (same seed, same care actions produce the same tree). ✓

---

### State Fields to Assert

| Field | Assert in Test | Source |
|---|---|---|
| `getBranches()` — full array | A, C, D (deepEqual); B (notDeepEqual) | Branch[] from BonsaiTree.ts |
| `getBranches()[i].angle` | A (spot), covered by deepEqual | Branch.angle — degrees |
| `getBranches()[i].pruned` | A (spot), covered by deepEqual | Branch.pruned — boolean |
| `getBranches()[i].wireCount` | A (spot), covered by deepEqual | Branch.wireCount — number? |
| `getBranches()[i].wireScarred` | covered by deepEqual | Branch.wireScarred — boolean |
| `getBranches()[i].wired` | covered by deepEqual | Branch.wired — boolean |
| `getBranches()[i].bendSet` | covered by deepEqual | Branch.bendSet — boolean |
| `getHealth()` | A, B, C, D | BonsaiTree.getHealth() |
| `getMoisture()` | A, B, C, D | BonsaiTree.getMoisture() |
| `getAge()` | A, C, D (equals N or M) | BonsaiTree.getAge() |
| `getRotationState()` | A, C | BonsaiTree.getRotationState() |
| `countLivingBranches()` | Optional (covered by deepEqual branch count) | BonsaiTree.countLivingBranches() |

**Fields NOT to assert directly** (internal to TreeState, not part of public Branch API):
- `rngState` — internal, not exposed via public accessors
- Internal tick counters (none exposed; `getAge()` is the public day counter)
- `fertilizerDays`, `fertilizerCooldown` — internal TreeState fields, not public

**Note on deepEqual scope**: `assert.deepEqual` on `getBranches()` covers the entire Branch array including all physics fields (diameter, currentStress, stressInitial, all binding state). This is the primary assertion for identity tests. The individual spot-checks in Test A are redundant with deepEqual but are specified explicitly for test readability and failure localization.

---

## ASSUMPTIONS

1. **Build is current before test runs**: The test imports from `'../dist/index.js'`. The implementer must run `npm run build` in `packages/engine` before running tests. If the CI pipeline doesn't auto-build, the test will import stale code. Mitigation: note this in test file header comment.

2. **standardSchedule prune fires before day 30 wire**: The prune is attempted from day 20 onward. Seed=42 hardwood grows branches within the first 30 days (verified: determinism.test.js confirms >3 branches after 150 days with similar water/rotate schedule). If no branch exists by day 20, the prune is deferred — the care log will record the actual day. The wire at day 30 does not depend on the prune. Mitigation: implementer should assert `PruneEngine.prune()` returned `true` at least once during the standardSchedule run.

3. **Test D's treeM is the true prefix of treeN**: This holds because `buildTree` is a pure function of (seed, species, numDays, scheduleFn) and `standardSchedule` is a pure function of (tree, d). The 50-day tree and the first 50 days of the 100-day tree are identical in all state. Verified by tracing code paths — the RNG is seeded by `seed + id * 7919 + day * 37`, so same seed + same day = same RNG output regardless of outer loop length.

4. **No Phase 2 stubs are triggered**: The standardSchedule and all test schedules use only `water`, `prune`, `wire`, and empty (no-op). None trigger the "not implemented" stubs (`twine`, `weight`, `jin`). Mitigation: explicitly note in test file that Phase 1 test scope excludes stub actions.

5. **Branch id=0 is always the trunk and is always wirable**: Trunk starts at thickness=2 < WIRE_MAX_THICKNESS=3. Unless growTick runs enough to thicken the trunk past 3.0 before day 30, the wire will succeed. With seed=42 hardwood at day 30, trunk thickness is unlikely to reach 3.0 (the determinism test shows reasonable growth at day 150). Mitigation: implementer should assert `tree.wire(0, 30).ok === true` during setup.

---

## OPEN QUESTIONS

**OQ-1 (BLOCKER — must resolve before implementation)**: Does `assert.deepEqual` on two `BonsaiTree` instances compare private TypeScript fields?  
TypeScript `private` fields (using `private` keyword, NOT the `#` syntax) compile to plain JavaScript object properties. Node.js `util.isDeepStrictEqual` (used by `assert.deepEqual`) compares all own enumerable and non-enumerable properties. This means `state`, `dirty`, `careLog`, `nextId` ARE included in a full `deepEqual(liveTree, replayTree)`. This is desirable — it's the strongest possible assertion. However, the implementer should decide whether to call `deepEqual` on the BonsaiTree objects directly or on `getBranches()` separately. **Recommendation**: Use `getBranches()` + individual accessor checks (as specified above) rather than full BonsaiTree deepEqual, to keep the assertion surface explicit and failure messages readable.

**OQ-2 (LOW — informational)**: WireEngine.wire uses `tree.getCareLog().push(entry)` (line 99 of WireEngine.ts) rather than `tree._logCare(entry)`. This is a code-style inconsistency. Both paths mutate the same internal array. The implementer should not work around this — it functions correctly. However, this should be filed as a separate cleanup issue (does not affect test design).

**OQ-3 (LOW — test design choice)**: Should Test B also verify that each replayed tree matches its live source tree (i.e., replay of hydratedSchedule === live hydratedSchedule)? Technically yes, but this is covered by Test A for the standardSchedule. Test B's purpose is specifically to assert divergence between the two *replays*, not equality of each replay with its live source. The implementer may optionally add identity assertions for completeness.

**OQ-4 (LOW — scope)**: Should a Test E be added for invalid inputs to `CareLogReplay.reconstruct`? (e.g., `totalDays <= 0`, `totalDays = Infinity`, invalid species, `careLog` not an array, unknown action type.) These throw `CareLogReplayError`. They are already tested conceptually in the security test suite (`docs/pipeline/ARCHITECT-SECURITY-TESTS-2026-08-01.md`). Recommendation: include three negative-path tests (invalid totalDays, invalid species, unknown action type) in the same file under a comment block `// --- Negative-path tests (CareLogReplayError) ---`. These are not part of the core BUG-4 scope but add resilience. Leave as implementer discretion.

**OQ-5 (LOW — dependency)**: Does the test file need to be added to `package.json scripts.test`? Yes — verified. Current command is `node --test test/determinism.test.js test/WireEngine.test.js`. The implementer must add `test/carelog-determinism.test.js` to this list.

---

## SUMMARY OF TESTS

| Test | Seed | Species | Days | Care | Assert |
|---|---|---|---|---|---|
| A | 42 | hardwood | 60 | water + prune + wire | replay deepEquals live |
| B | 42 | hardwood | 60 | hydrated vs. drought | replays diverge (health, moisture, branches) |
| C | 99 | hardwood | 100 | none (empty log) | replay deepEquals no-care grow |
| D | 42 | hardwood | 100 vs. 50 | standard (both) | partial replay (50-day) deepEquals 50-day live |
