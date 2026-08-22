# IMPL-CARELOGREPLAY-WIRE-REMOVE-2026-08-14

**Pipeline stage:** Implementer (disciplined-implementer + engineering-craft-standard skills)
**Date:** 2026-08-14
**Subject:** Gate tests for CareLogReplay wire-remove replay (CLR-WIRE-1 through CLR-WIRE-4)

---

## OUTCOME: DONE

```
DONE WHEN: tsc --noEmit exits 0 AND all 4 CLR-WIRE tests pass (node packages/engine/test_carelogreplay_wire.mjs)

OBSERVED:
  tsc --noEmit (packages/engine/tsconfig.json): exit 0
  node packages/engine/test_carelogreplay_wire.mjs: 23 passed, 0 failed, exit 0
```

---

## PIPELINE SEQUENCING ANOMALY (F-1, acknowledged)

The CRITIC confirmed (F-1) that `CareLogReplay.ts` already contains the fix
(`WireEngine.removeWire(tree, a.branchId)` at lines 122–125) before the implementer
stage ran. The implementer was therefore responsible only for writing the gate tests.
No code change to `CareLogReplay.ts` was made or needed.

---

## WHAT CHANGED

| File | Change |
|------|--------|
| `packages/engine/test_carelogreplay_wire.mjs` | **NEW FILE** — 4 gate tests (CLR-WIRE-1 through CLR-WIRE-4), 23 assertions, 0 failures |

No other files were modified.

---

## INTENT CHECK

```
INTENT CHECK
  code does:     WireEngine.removeWire(tree, a.branchId) in the wire-remove branch —
                 computes spring-back from (tree.getAge() - b.wireAppliedDay) / computeSetDays(b.diameter),
                 clears wired state, logs care entry, marks dirty.
  check expects: CLR-WIRE-1: rebuilt branch angle == postRemoveAngle (partial spring-back).
                 CLR-WIRE-2: rebuilt branch angle == wiredAngle, wireSet=true, bendSet=true.
                 CLR-WIRE-3: unknown action type throws CareLogReplayError.
                 CLR-WIRE-4: orphaned wire-remove doesn't throw; branch angle unchanged vs reference.
  spec says:     CareLogReplay.reconstruct must produce a tree bit-identical to the original.
                 wire-remove entries in the log must be replayed correctly.
                 (KIJO-ENGINE-API.md §CareLogReplay; ARCH-CARELOGREPLAY-WIRE-REMOVE-2026-08-14.md §DESIGN)
  verdict:       ALIGNED
```

---

## TEST FILE DESIGN

### Test pattern

Follows the existing convention: `.mjs` file at `packages/engine/`, run with `node`, imports from `./dist/`.
Harness (`assert`, `assertThrows`, `assertNoThrow`) copied from `test_security.mjs`.

### CLR-WIRE-1 — Early removal: partial spring-back

- Grow hardwood (seed=42) to day 50. `tree.getAge() = 50`.
- Wire branch 1 (`angleDelta = 20`). Record `wiredAngle` from live tree (F-2 fix).
- Grow 10 more days. `tree.getAge() = 60`. (10 days < setDays ~47.18 for this branch.)
- `tree.removeWire(b.id)`. Record `postRemoveAngle`.
- Replay with `totalDays = 61` (= wireRemoveDay + 1; day-60 wire-remove needs iteration `day=60`).
- Assert: rebuilt angle == postRemoveAngle; `wired === false`; `wireSet !== true`; angle moved back toward original.

**Key result:** `orig=38.79°, wired=58.79°, post=42.86°` — partial spring-back confirmed.

### CLR-WIRE-2 — Late removal: permanent set

- Same setup to day 50.
- Wire branch 1. Record `wiredAngle` from live tree (F-2 fix).
- Grow `STRESS_DECAY_MAX_DAYS + 10 = 66` extra days. `tree.getAge() = 116`.
  - Buffer of 66 exceeds max possible `setDays` (56, clamped at D_MAX=6.0) regardless of diameter growth.
- `tree.removeWire(b.id)`. Verify `postRemoveAngle == wiredAngle` (no spring-back on live tree).
- Replay with `totalDays = 117`.
- Assert: rebuilt angle == wiredAngle; `wireSet === true`; `bendSet === true`; `wired === false`.

### CLR-WIRE-3 — Unknown action type still throws (regression guard)

- Build `badLog = [{ day: 0, action: { type: 'unknown-future-action', branchId: 0 } }]`.
- Assert `CareLogReplay.reconstruct(42, 'hardwood', badLog, 1)` throws `CareLogReplayError`.
- Assert error message includes the type string.

### CLR-WIRE-4 — Orphaned wire-remove is a no-op (critic F-3)

- Grow tree, take `baseLog` (water entries only, no wire).
- Build `refTree = CareLogReplay.reconstruct(42, 'hardwood', baseLog, 50)`.
- Build `orphanLog = [...baseLog, { day: 10, action: { type: 'wire-remove', branchId: 1 } }]`.
- Assert no throw; branch 1 `wired === false`; branch 1 angle equals reference.

---

## VERIFIED BY OBSERVATION

```
VERIFIED BY OBSERVATION:

  ✓ tsc --noEmit (packages/engine/tsconfig.json)
      Command:  npx tsc --noEmit --project packages/engine/tsconfig.json
      Exit:     0
      Output:   no errors (npm version notice only)

  ✓ node packages/engine/test_carelogreplay_wire.mjs
      Exit:     0
      Output:   23 passed, 0 failed (full output below)

CLR-WIRE-1 — Early removal: partial spring-back reproduced in replay
  ✓ CLR-WIRE-1 setup: found a wirable depth-1 branch at day 50
  ✓ CLR-WIRE-1 setup: wire applied successfully
  ✓ CLR-WIRE-1 setup: care log contains both wire and wire-remove entries
  ✓ CLR-WIRE-1: reconstruct does not throw
  ✓ CLR-WIRE-1: rebuilt angle (42.8635) === postRemoveAngle (42.8635)
  ✓ CLR-WIRE-1: branch is not wired after replay (wire-remove was applied)
  ✓ CLR-WIRE-1: wireSet is NOT true — early removal, no permanent set
  ✓ CLR-WIRE-1: angle moved back toward original after early remove (orig=38.79, wired=58.79, post=42.86)

CLR-WIRE-2 — Late removal: permanent set reproduced in replay
  ✓ CLR-WIRE-2 setup: found a wirable depth-1 branch at day 50
  ✓ CLR-WIRE-2 setup: wire applied successfully
  ✓ CLR-WIRE-2: live tree — postRemoveAngle (58.7858) === wiredAngle (58.7858) (no spring-back)
  ✓ CLR-WIRE-2: reconstruct does not throw
  ✓ CLR-WIRE-2: rebuilt angle (58.7858) === postRemoveAngle (58.7858)
  ✓ CLR-WIRE-2: wireSet === true (permanent set)
  ✓ CLR-WIRE-2: bendSet === true (permanent set)
  ✓ CLR-WIRE-2: branch not wired (wire was removed)

CLR-WIRE-3 — Unknown action type still throws (regression guard)
  ✓ CLR-WIRE-3: unknown action type throws
  ✓ CLR-WIRE-3: thrown error is CareLogReplayError (got CareLogReplayError)
  ✓ CLR-WIRE-3: error message names the unknown type

CLR-WIRE-4 — Orphaned wire-remove is a no-op, does not throw
  ✓ CLR-WIRE-4: orphaned wire-remove does not throw
  ✓ CLR-WIRE-4: branch 1 exists in 50-day reference replay (precondition)
  ✓ CLR-WIRE-4: branch 1 is not wired (orphaned wire-remove is a no-op)
  ✓ CLR-WIRE-4: branch 1 angle unchanged (rebuilt=38.7858, ref=38.7858)

23 passed, 0 failed
```

---

## CRITIC CAVEATS ADDRESSED

| Finding | Resolution |
|---------|------------|
| F-1: sequencing anomaly | Acknowledged. CareLogReplay.ts fix already present. Tests written; no code change needed. |
| F-2: `rebuilt` reference in pseudocode | Fixed in all tests: `wiredAngle` captured from `tree.getBranches()[b.id].angle` (live tree) after `tree.wire()`. |
| F-3: orphaned wire-remove not tested | CLR-WIRE-4 added as specified. |

---

## CARMACK-LINUS REVIEW FINDINGS AND RESOLUTIONS

The carmack-linus-review skill was invoked post-implementation. Four findings were reported:

| Finding | Action |
|---------|--------|
| Magic `totalDays` numbers (61, 117) disconnected from setup | Fixed: added named `wireRemoveDay1/2` variables with comments explaining derivation. Numbers still appear but are now documented and adjacent to the logic that produces them. A future refactor could use `tree.getAge()` directly, but the current approach is explicit and clear. |
| `if (b)` guard silently skips all inner assertions on setup failure | Fixed: replaced with `if (!b) { console.error(...); process.exit(1); }`. Hard exit on missing setup. |
| Nested `careLog_check()` function (hoisting ambiguity, redundant) | Fixed: inlined as a direct expression in the `assert()` call. |
| CLR-WIRE-4 branch-1 existence not asserted as precondition | Fixed: added `assert(refBranch1 !== undefined, ...)` before the comparison block. |

---

## SCOPE COMPLIANCE

| File | Status |
|------|--------|
| `packages/engine/src/CareLogReplay.ts` | NOT TOUCHED (fix already present, confirmed by CRITIC) |
| `packages/engine/src/WireEngine.ts` | NOT TOUCHED |
| `packages/shared/src/index.ts` | NOT TOUCHED |
| `apps/web/src/persistence.ts` | NOT TOUCHED (GAP-4, separate task) |
| `packages/engine/test_wire.mjs` | NOT TOUCHED |
| All other existing test files | NOT TOUCHED |

---

## OPEN ITEMS / CAVEATS

1. **GAP-4 still open.** `applyCurrentDayEntries` in `persistence.ts` and `derive-stats/index.ts` still silently skips `wire-remove` entries (falls to `else`/`console.warn`). This was deferred as a separate task per ARCH and CRITIC docs. Track as follow-up.

2. **CLR-WIRE-1 spring-back magnitude not precisely asserted.** The test verifies directional spring-back but not exact fraction. With `wireAngle ≈ 20°` and `springBackFraction ≈ 0.79`, the actual spring-back is `≈ 15.76°` (from 58.79° to 42.86° observed). A future hardening pass could add a tolerance-bounded magnitude check.

3. **b.diameter vs b.thickness.** Discovered during implementation: `b.diameter ≈ 2 × b.thickness` for this species/seed. `WireEngine.removeWire` uses `b.diameter` for `computeSetDays`; the WIRE_MAX_THICKNESS check uses `b.thickness`. This is consistent with WireEngine.ts source and produces correct setDays (~47.18 for this branch). The CLR-WIRE-2 buffer (`STRESS_DECAY_MAX_DAYS + 10 = 66`) was set high enough to guarantee permanent set regardless.

---

*No auto-commits. Auditor to re-verify.*
