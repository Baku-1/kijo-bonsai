# AUDIT-BUG4: CareLogReplay Determinism Test Implementation
**Date**: 2026-08-07  
**Stage**: Adversarial Auditor  
**Subject**: `packages/engine/test/carelog-determinism.test.js`  
**Spec reviewed**: `docs/pipeline/ARCH-BUG4-CARELOG-DETERMINISM-2026-08-07.md`  
**Critic reviewed**: `docs/pipeline/CRITIC-BUG4-CARELOG-DETERMINISM-2026-08-07.md`

---

## VERDICT: CAVEATS

Core work holds. All 4 new tests pass, both critic-mandated fixes are applied correctly, no assertions are weakened. One real gap: `carelog-determinism.test.js` is excluded from `npm test` because `package.json` was not fully updated. One test comment mis-states the health mechanism (non-breaking).

---

## CLAIMS CHECKED

**Implementer implicit claims:**

- ✓ Test A passes: same seed + care log → identical replay — **observed: exit 0, ok 4**
- ✓ Test B passes: different care logs → divergent replays — **observed: exit 0, ok 5**
- ✓ Test C passes: empty care log matches no-care grow — **observed: exit 0, ok 6**
- ✓ Test D passes: partial replay to day 50 matches 50-day live tree — **observed: exit 0, ok 7**
- ✓ Full suite (12 tests) passes — **observed: 12 pass, 0 fail, exit 0**
- ✗ BUG-4 tests are wired into `npm test` — **REFUTED**: `scripts.test` was NOT updated to include `carelog-determinism.test.js`

**Critic-mandated fixes:**

- ✓ BUG-C1: `hydratedSchedule` uses `water(15) every 2 days`, not `water(50) every day` — **observed line 60**: `const hydratedSchedule = (tree, d) => { if (d % 2 === 0) tree.water(15); };`
- ✓ GAP-C1: `prunedId` retrieved via `findIndex` post-hoc with `prunedId >= 1` guard — **observed lines 85–94**: `const prunedId = liveTree.getBranches().findIndex(b => b.pruned && b.parent !== null); assert.ok(prunedId >= 1, ...)`

---

## INTENT CHECK

```
INTENT CHECK (Test A)
  code does:     assert.deepEqual(replayTree.getBranches(), liveTree.getBranches())
                 plus health, moisture, age, rotationState, spot-check pruned + wire
  check expects: full branch-array identity between live and replayed tree
  spec says:     "Replay faithfully reconstructs the exact same tree as live play
                  for the water → prune → wire combination." (ARCH, Test A)
  verdict:       ALIGNED

INTENT CHECK (Test B)
  code does:     assert.ok(replayHydrated.getHealth() > replayDrought.getHealth())
  check expects: hydrated health > drought health
  spec says:     "Two trees with the same seed but different care logs produce
                  distinct, non-equal results." (ARCH, Test B)
  verdict:       ALIGNED — BUT see CAVEATS for comment inaccuracy

INTENT CHECK (Test C)
  code does:     assert.deepEqual(replayTree.getBranches(), liveTree.getBranches())
                 with careLog=[], noOpSchedule, seed=99
  check expects: empty-log replay equals no-care grow
  spec says:     "CareLogReplay.reconstruct(seed, species, [], N) produces a tree
                  identical to a tree grown for N days with no care actions." (ARCH, Test C)
  verdict:       ALIGNED

INTENT CHECK (Test D)
  code does:     replayM = CareLogReplay.reconstruct(42,'hardwood', treeN.getCareLog(), 50)
                 compared against treeM = buildTree(42,'hardwood',50,makeStandardSchedule())
  check expects: partial replay truncates at day 50 correctly
  spec says:     "totalDays correctly bounds the replay. Stale or future entries do
                  not bleed through into the M-day result." (ARCH, Test D)
  verdict:       ALIGNED
```

---

## SCOPE

`packages/engine/package.json` diff — **gap confirmed**:

```diff
-"test": "node --test test/determinism.test.js",
+"test": "node --test test/determinism.test.js test/WireEngine.test.js",
```

`WireEngine.test.js` was added to the command. `carelog-determinism.test.js` was not. The arch spec explicitly required:
```
"test": "node --test test/determinism.test.js test/WireEngine.test.js test/carelog-determinism.test.js"
```

Running `npm test` today runs 8 tests. `carelog-determinism.test.js` (4 tests) is only reachable via `node --test test/*.test.js` or explicit path invocation. Any CI/CD that relies on `npm test` will silently skip the new determinism suite.

`packages/engine/test/carelog-determinism.test.js` — new file, untracked. All 4 tests verified passing. No other source files were touched by this implementation.

---

## FRAUDS HUNTED

**Weakened tests**: none found. Every assertion is substantive:
- Test A: `assert.deepEqual` on the full `getBranches()` array (all branch physics, angle, pruned, wired, wire state), plus 5 individual accessor checks, plus spot-checks on pruned branch and wired trunk.
- Test B: `assert.ok(health_gap)` with observed gap = **32.3** (42.3 vs 10). `assert.notDeepEqual(branches)` confirmed non-trivially by probe (branch arrays differ).
- Test C: `assert.deepEqual(branches)` + 4 accessor checks. `careLog` argument is `[]` (array literal), not null or undefined.
- Test D: expected tree built with `makeStandardSchedule()` for 50 days — not empty-log reconstruct.

**False completion**: none. Tests run and pass. Exit code 0 observed.

**Intent inversion**: none. Test fixes (BUG-C1, GAP-C1) match critic prescription exactly.

**Phantom evidence**: none. All file paths, line numbers, and symbols verified against actual source.

---

## CAVEATS

### CAVEAT-1 (Blocking for CI) — `package.json` not updated with new test file

**Severity**: High for CI integrity; tests are correct and pass when run explicitly.

`scripts.test` in `packages/engine/package.json` does not include `test/carelog-determinism.test.js`. Any automated or human run of `npm test` will not execute the new suite. This is the primary deliverable gap from this implementation.

**Required fix**:
```json
"test": "node --test test/determinism.test.js test/WireEngine.test.js test/carelog-determinism.test.js"
```

### CAVEAT-2 (Non-breaking) — Test B comment mis-states the health mechanism

**Severity**: Documentation only. The assertion is correct.

The test comment on line 57–59 says:
> "BUG-C1 fix: moisture stays ~[50-65] (in [30,65]) → health +0.8/day"

This is factually wrong. Probed actual values at day 60:
- `replayHydrated.getMoisture()` = **86.18** — above the > 80 penalty threshold
- `replayHydrated.getHealth()` = **42.3** — declining, not gaining (+0.8/day)

Moisture climbs above 80 by approximately day 4–6 under `water(15) every 2 days` because the decay rate (5–9/day, mean ≈ 7) minus replenishment (15 every 2 days, ≈ 7.5/day net gain) slowly saturates moisture upward. The hydrated health (42.3) still exceeds drought health (10) because the drought tree hits the floor ≈ 50 days sooner. The assertion passes with a non-trivial 32.3-point gap, but the reason is correct despite the comment being wrong.

The critic's own analysis (CRITIC-BUG4 line 65) also predicted moisture "roughly in [30,65]" — this was an incorrect prediction. However, the critic's Option A fix (`water(15) every 2 days`) does produce correct divergence; only the mechanism description was wrong.

The comment should read:
> "BUG-C1 fix: water(15) every 2 days — slower to saturate than water(50)/day.  
>  Hydrated moisture climbs to ~86 (>80 → -1.5/day health penalty) but the drought tree  
>  hits the floor much sooner. Observed gap at day 60: hydrated=42.3, drought=10."

**This does not require a code change.** Comment-only fix.

---

## KIJO MIRROR STATUS

`kijo/docs/pipeline/ARCH-BUG4-CARELOG-DETERMINISM-2026-08-07.md` — **exists** in kijo mirror  
`kijo/docs/pipeline/CRITIC-BUG4-CARELOG-DETERMINISM-2026-08-07.md` — **missing** from kijo mirror  
`kijo/docs/pipeline/AUDIT-BUG4-CARELOG-DETERMINISM-2026-08-07.md` — **this file** (being mirrored now)

---

## BOTTOM LINE

The 4 new tests are correct, non-trivial, and both critic-mandated fixes are applied faithfully. The single actionable gap is `package.json`: one line addition required before `npm test` covers the new suite. Until that line is added, these tests exist but are not gated by CI.
