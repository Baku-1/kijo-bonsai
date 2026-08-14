# ARCH-CARELOGREPLAY-WIRE-REMOVE-2026-08-14

**Pipeline stage:** Architect (Verified Architect skill)
**Date:** 2026-08-14
**Author:** Verified Architect pass
**Subject:** Fix `CareLogReplay.ts` — handle `wire-remove` entries without crashing

---

## DESIGN: CareLogReplay wire-remove fix

```
DESIGN TASK:  Replace the wire-remove throw in CareLogReplay.reconstruct with a
              WireEngine.removeWire call, closing the replay invariant gap created
              when care-action v7 began persisting wire-remove to the server.

DELIVERABLE:  Verified architect spec (this doc) + gate test definitions CLR-WIRE-1/2/3.
              The implementer writes the code and the tests; the auditor re-verifies.

BUILDS ON:    WireEngine.removeWire — W1–W6 gates verified 2026-08-07, 20/20 assertions.
              care-action v7 — wire-remove whitelist fix AUDIT-CARE-ACTION-WIRE-REMOVE-2026-08-14 VERIFIED.
              CAVEAT-2 from that audit report (the gap this doc closes).

CONSUMED BY:  Implementer (disciplined-implementer skill).
              Auditor (adversarial-auditor skill) after implementation.
```

---

## CODEBASE RECONNAISSANCE

### Files read

| File | Path | Lines |
|------|------|-------|
| CareLogReplay.ts | `packages/engine/src/CareLogReplay.ts` | 1–175 |
| WireEngine.ts | `packages/engine/src/WireEngine.ts` | 1–167 |
| BonsaiTree.ts | `packages/engine/src/BonsaiTree.ts` | 1–367 |
| TwineWeightEngine.ts | `packages/engine/src/TwineWeightEngine.ts` | 1–100 (constants + computeSetDays) |
| shared/index.ts | `packages/shared/src/index.ts` | 184–225 (CareAction union + CareLogEntry) |
| persistence.ts | `apps/web/src/persistence.ts` | 1–361 |
| derive-stats/index.ts | `apps/server/supabase/functions/derive-stats/index.ts` | 103–214 |
| test_wire.mjs | `packages/engine/test_wire.mjs` | 1–159 |
| STATE.md | repo root | full |
| DECISIONS.md | repo root | full |
| KIJO-ENGINE-API.md | `docs/` | full |
| AUDIT-CARE-ACTION-WIRE-REMOVE-2026-08-14.md | `docs/pipeline/` | full |
| main3d.ts | `apps/web/src/main3d.ts` | lines 779–805 (wire-remove handlers) |

### Symbols verified

```
CODEBASE RECONNAISSANCE — SYMBOLS VERIFIED

✓ CareLogReplay.reconstruct
    exists in packages/engine/src/CareLogReplay.ts
    exported: yes (class CareLogReplay, method reconstruct, line 34)
    signature: static reconstruct(seed: number, species: SpeciesClass,
                  careLog: CareLogEntry[], totalDays: number): BonsaiTree

✓ WireEngine (import in CareLogReplay.ts)
    already imported at CareLogReplay.ts line 6:
      import { WireEngine } from './WireEngine.js';
    no new import needed.

✓ WireEngine.removeWire
    exists in packages/engine/src/WireEngine.ts, line 128
    exported: yes (public static method on exported class WireEngine)
    signature: static removeWire(tree: BonsaiTree, branchId: number): void
    NO daysElapsed parameter — computed internally.

✓ BonsaiTree.removeWire
    exists in packages/engine/src/BonsaiTree.ts, line 193
    signature: removeWire(branchId: number): void
    delegates to WireEngine.removeWire(this, branchId)
    exported: yes (public method on exported class BonsaiTree)

✓ computeSetDays
    exists in packages/engine/src/TwineWeightEngine.ts, line 90
    exported: yes
    signature: function computeSetDays(diameter: number): number
    returns: STRESS_DECAY_MIN_DAYS + (STRESS_DECAY_MAX_DAYS - STRESS_DECAY_MIN_DAYS) * (d / D_MAX)
    where D_MAX = 6.0, MIN = 28 days, MAX = 56 days
    input clamped to D_MAX (Major-2 fix).

✓ CareAction 'wire-remove' type (shared/index.ts line 197)
    { type: 'wire-remove'; branchId: number }
    — branchId is the only payload field. No daysElapsed, no angleDelta.

✓ CareLogEntry (shared/index.ts line 221)
    { day: number; action: CareAction }

✓ wire-remove branch in CareLogReplay.ts (lines 122–127)
    CURRENT CODE — THROWS:
      } else if (a.type === 'wire-remove') {
        // Phase 1: wire-remove is not implemented in CareLogReplay.
        // A care log containing wire-remove cannot be replayed until Phase 2.
        throw new CareLogReplayError(
          `'wire-remove' is not yet implemented and cannot be replayed (Phase 2).`
        );

✓ wire-remove action narrowing in CareLogReplay dispatch block
    TypeScript narrows `a` to { type: 'wire-remove'; branchId: number } inside the
    `else if (a.type === 'wire-remove')` branch. `a.branchId` is accessible without cast.

✓ BonsaiTree.getAge()
    exists at BonsaiTree.ts line 305
    returns this.state.day — incremented by applyDailyUpdate() each tick.
    At replay day N, tree.getAge() === N because growTick → applyDailyUpdate increments
    state.day once per loop iteration before the next iteration's actions are applied.

✓ b.wireAppliedDay set by WireEngine.wire()
    WireEngine.ts line 93: b.wireAppliedDay = tree.getAge()
    Set at the time the wire action is applied. During replay, when the wire action
    at day W is processed, tree.getAge() == W. At remove time (day R), wireDaysApplied
    = R - W. Correct: identical to the original run.

✓ Spring-back formula in WireEngine.removeWire (lines 148–151):
    const springBackFraction = Math.max(0, Math.min(1, 1 - wireDaysApplied / setDays));
    const springBackAmount = round4(b.wireAngle * springBackFraction);
    b.angle = round4(clamp(b.angle - springBackAmount, POLAR_MIN_DEG, POLAR_MAX_DEG));
    No external input needed — all state is on the Branch (wireAngle, wireAppliedDay,
    diameter) and in the tree (getAge()). All set correctly during replay by the prior
    wire action processing.

✓ tree._logCare() used by WireEngine.removeWire (WireEngine.ts line 164)
    WireEngine.removeWire already calls tree._logCare() — it logs the wire-remove entry
    to the in-memory care log. During CareLogReplay, this means the replayed tree's
    internal care log will contain the wire-remove entry. This is correct — the replayed
    tree's log should mirror the original.

✓ Existing action dispatch pattern for 'wire' (CareLogReplay.ts line 121):
    } else if (a.type === 'wire') {
      WireEngine.wire(tree, a.branchId, a.angleDelta);
    The wire-remove fix must follow the same pattern: call engine directly.
```

### Call sites for CareLogReplay.reconstruct

```
CareLogReplay.reconstruct — 4 call sites:
  apps/web/src/main2d.ts:234
    CareLogReplay.reconstruct(seed, species, priorLog, currentDay)
  apps/web/src/main3d.ts:448
    CareLogReplay.reconstruct(seed, species, cache.careLog.filter(...), age)
  apps/web/src/main3d.ts:484
    CareLogReplay.reconstruct(seed, species, careLog, currentDay)
  apps/server/supabase/functions/derive-stats/index.ts:211
    CareLogReplay.reconstruct(tree.seed, tree.species, priorLog, currentDay)

All four crash today if care log contains a wire-remove entry (throws CareLogReplayError).
All four are fixed simultaneously by the CareLogReplay.ts change — no call site changes.
```

### Call sites for applyCurrentDayEntries (GAP-4 — separate task, NOT this fix)

```
applyCurrentDayEntries — 7 call sites across 3 files:
  apps/web/src/main2d.ts:229
  apps/web/src/main2d.ts:245
  apps/web/src/main3d.ts:446
  apps/web/src/main3d.ts:453
  apps/web/src/main3d.ts:481
  apps/web/src/main3d.ts:490
  apps/server/supabase/functions/derive-stats/index.ts:214 (local mirror function)

All currently fall through to the else/console.warn for wire-remove (persistence.ts:302–308).
THIS IS A SEPARATE GAP (GAP-4, auditor CAVEAT-1) — NOT part of this fix's scope.
The implementer must NOT touch persistence.ts or derive-stats as part of this change.
```

### Gaps found

```
GAPS FOUND:
  G-1: docs/SESSION-START.md does not exist (referenced in task prompt, no file on disk).
       Non-blocking — STATE.md and DECISIONS.md provide equivalent orientation.

  G-2: No __tests__/ directory under packages/engine/src/. Gate tests live as .mjs files
       at packages/engine/test_*.mjs. New tests (CLR-WIRE-*) must follow this pattern.

  G-3: applyCurrentDayEntries in persistence.ts and derive-stats/index.ts also skips
       wire-remove (GAP-4 per auditor CAVEAT-1). Not in scope here — separate Task.

  G-4: The task prompt says "springBack = bendAngle × max(0, 1 - daysElapsed/computeSetDays(branch.diameter))."
       This is accurate but uses 'daysElapsed' as if it's a parameter. CONFIRMED: it is NOT
       a parameter to removeWire. The engine computes it internally from tree.getAge() - b.wireAppliedDay.
       No action needed — the formula in the prompt describes the implementation, not a signature.
```

---

## VERIFICATION LOG

```
VERIFIED:

  ✓ WireEngine.removeWire takes (tree, branchId) — no daysElapsed parameter.
    Source: WireEngine.ts line 128, read directly.

  ✓ WireEngine is already imported in CareLogReplay.ts (line 6).
    Source: CareLogReplay.ts line 6 read directly. No new imports needed.

  ✓ a.branchId is type-safe in the wire-remove branch without cast.
    Source: shared/index.ts line 197 (CareAction union); TypeScript discriminated union
    narrowing on a.type === 'wire-remove'.

  ✓ Spring-back is fully deterministic at replay time.
    Source: WireEngine.ts lines 137–151. All inputs (wireAngle, wireAppliedDay, diameter,
    tree.getAge()) are set correctly during the replay loop before removeWire is called.
    No external input required.

  ✓ tree.getAge() at wire-remove replay day equals the original remove day.
    Source: CareLogReplay.ts lines 97–172 (day loop); BonsaiTree.ts line 305 (getAge).
    The loop runs: apply actions for day N → GrowthEngine.growTick(tree) (which calls
    applyDailyUpdate → increments state.day). So at iteration start for day N,
    tree.getAge() == N. Wire-remove actions at day R have a.day == R and are processed
    while tree.getAge() == R. Correct.

  ✓ WireEngine.removeWire already calls tree._logCare() — no double-logging risk.
    Source: WireEngine.ts line 160–164. The logged entry is { day: tree.getAge(),
    action: { type: 'wire-remove', branchId } }. During replay this re-logs the
    entry to the replayed tree's internal care log, mirroring the original tree.
    This is the same pattern as WireEngine.wire() which also pushes to tree.getCareLog().

  ✓ WireEngine.removeWire is a no-op for unrecognized / already-unwired branches.
    Source: WireEngine.ts lines 130–133. Guard: if (!b) return; if (b.pruned) return;
    if (!b.wired) return. A wire-remove entry in the log for an already-removed wire
    silently no-ops — does not crash. Safe for replay.

  ✓ care-action v7 persists wire-remove entries to the server (AUDIT confirmed).
    Source: AUDIT-CARE-ACTION-WIRE-REMOVE-2026-08-14.md CHECK 1, VERIFIED.
    Any cold-reload from this point forward risks care logs with wire-remove entries.
    The crash is production-blocking.

  ✓ Existing gate test pattern: .mjs files at packages/engine/test_*.mjs.
    Source: test_wire.mjs read directly; STATE.md gate detail section.

  ✓ No existing test covers CareLogReplay with wire-remove (new tests required).
    Source: W5 in test_wire.mjs covers replay with wire but does NOT include
    a wire-remove action. CLR-WIRE-1/2/3 are new tests.

UNVERIFIED:

  ? piratenation-contracts: Action-log replay pattern in TypeScript.
    Searched: GitHub proofofplay/piratenation-contracts.
    Found: Solidity-only contracts repo, no TypeScript action-log replay code.
    Not applicable. See Open Source Reference section below.

REFUTED:

  ✗ The task prompt says "daysElapsed = replayDay - entry.day" and references passing
    daysElapsed to removeWire.
    REFUTED: WireEngine.removeWire has no daysElapsed parameter. It computes elapsed
    time internally. The formula description in the prompt is accurate, but the parameter
    suggestion is not — removeWire's signature is (tree, branchId) only.
    The implementer must NOT add a daysElapsed parameter.
```

---

## OPEN SOURCE REFERENCE

**Search conducted:** GitHub for piratenation-contracts (Proof of Play), TypeScript event-sourcing action-log replay patterns.

**piratenation-contracts** ([github.com/proofofplay/piratenation-contracts](https://github.com/proofofplay/piratenation-contracts)):
The repo is Solidity contracts only — no TypeScript action-log replay. Not directly applicable.

**General event-sourcing pattern** ([typescript-event-sourcing](https://github.com/xolvio/typescript-event-sourcing), [event-sourcing-game-inventory](https://www.springfuse.com/event-sourcing-game-inventory/)):

Two directly applicable principles from standard event-sourcing literature:

1. **Replay handlers must be total functions.** Every event type that can appear in the log must have a handler. A partial handler — one that throws for "unimplemented" types that now appear in live data — breaks the replay invariant the moment those events are persisted. The `wire-remove` throw is exactly this failure mode: it was safe when care-action did not persist `wire-remove`, but became a production-blocker the moment care-action v7 went live.

2. **Temporal anchoring: store absolute day numbers, not relative durations.** `CareLogEntry` stores `day: number` (absolute game day). The engine computes elapsed time at replay by subtraction (`removeWire` does `tree.getAge() - b.wireAppliedDay`). This is the correct pattern — storing a pre-computed `daysElapsed` in the log would make the log non-self-contained (the elapsed duration would depend on which prior events are present in the log).

**Verdict:** The fix aligns CareLogReplay with both standard event-sourcing principles. No adaptation from open-source code is needed — the engine already implements these patterns for all other action types.

---

## CROSS-REFERENCE CHECK

```
CROSS-REFERENCE CHECK
  checked against:
    - KIJO-ENGINE-API.md (CareLogReplay, BonsaiTree, WireEngine sections)
    - DECISIONS.md (round4 discipline, CareLogReplay decision, WireEngine OQ-1 resolution)
    - STATE.md (W1–W6 verified, GAP-1 tracking)
    - AUDIT-CARE-ACTION-WIRE-REMOVE-2026-08-14.md (CAVEAT-2 gap)

  consistent: YES
    KIJO-ENGINE-API.md §CareLogReplay documents reconstruct as producing a tree
    "bit-identical to the original." wire-remove breaking this is a direct spec violation.
    The fix restores the documented invariant.

  terminology aligned: YES
    'wire-remove' (hyphenated, lowercase) — consistent across CareAction union,
    ALLOWED_ACTION_TYPES in care-action, CareLogReplay dispatch, and audit doc.

  data shapes aligned: YES
    CareAction['wire-remove'] = { type: 'wire-remove'; branchId: number }
    WireEngine.removeWire(tree, branchId) — branchId is the only payload field needed.
    No shape mismatch.

  boundary violations: NONE
    The change is inside packages/engine/src/CareLogReplay.ts.
    engine imports WireEngine (same package) — no boundary crossing.
    No imports from apps/ or shared/ added.
```

---

## THE DESIGN

### What changes

**File:** `packages/engine/src/CareLogReplay.ts`

**Where:** Inside the `reconstruct` static method, the `else if (a.type === 'wire-remove')` branch (lines 122–127 in the current file).

**Current code (lines 122–127):**
```typescript
} else if (a.type === 'wire-remove') {
  // Phase 1: wire-remove is not implemented in CareLogReplay.
  // A care log containing wire-remove cannot be replayed until Phase 2.
  throw new CareLogReplayError(
    `'wire-remove' is not yet implemented and cannot be replayed (Phase 2).`
  );
```

**Replacement:**
```typescript
} else if (a.type === 'wire-remove') {
  WireEngine.removeWire(tree, a.branchId);
```

**Lines changed:** 5 lines removed (the 4-line throw block + the stale comments), 1 line added. Net: −4 lines. Total touched: 5 lines.

**New imports required:** None. `WireEngine` is already imported at line 6.

**No other files change as part of this fix.**

### Why this is correct

`WireEngine.removeWire(tree, branchId)` is already the correct, tested implementation of wire removal. It:

1. Looks up the branch by `branchId` in `tree.getBranches()` — no-op if not found.
2. Computes `wireDaysApplied = tree.getAge() - b.wireAppliedDay`.
   - At replay time, `tree.getAge()` equals the `wire-remove` entry's `day` (because `applyDailyUpdate` increments `state.day` on each `growTick`, and the loop processes day-N entries while `tree.getAge() == N`).
   - `b.wireAppliedDay` was set when the `wire` action at day W was replayed (`b.wireAppliedDay = tree.getAge()` → W). So `wireDaysApplied = R - W` — identical to the original run.
3. Computes `setDays = computeSetDays(b.diameter)` — deterministic from branch state.
4. If `wireDaysApplied >= setDays`: marks `wireSet = true`, `bendSet = true`. Angle stays.
5. Else: spring-back = `round4(b.wireAngle × (1 - wireDaysApplied/setDays))`. Angle adjusts.
6. Clears `b.wired`, `b.wireAngle`, `b.wireAppliedDay`. Logs the care entry. Marks dirty.

All inputs to the spring-back formula are on the Branch object and are set deterministically by the replay loop before `removeWire` is called. No additional log fields are needed.

### Spring-back formula (confirmed match with task spec)

`springBack = b.wireAngle × max(0, 1 - wireDaysApplied / computeSetDays(b.diameter))`

This is the formula as implemented in `WireEngine.removeWire` lines 148–151. It is consistent with the spec stated in the task. `b.wireAngle` holds the `appliedDelta` recorded by the preceding `wire` action replay. It is NOT the total branch angle — it is the delta applied by the wire.

---

## GATE TESTS FOR THE IMPLEMENTER

Tests must follow the existing pattern: `.mjs` file at `packages/engine/` root, run via `node packages/engine/test_carelogreplay_wire.mjs` from repo root. Import from `./dist/` after build.

### CLR-WIRE-1 — Early removal: partial spring-back

**Setup:**
1. Grow tree (seed=42, hardwood) to day 50.
2. Find a wirable depth-1 branch (`b`). Record `originalAngle = b.angle`.
3. Call `tree.wire(b.id, 20)` — record `result.newAngle` (the wired angle) and `result.oldAngle`.
4. Call `GrowthEngine.growTick(tree)` for 10 more days (tree is now at day 60). Wire has been on 10 days.
5. Build `careLog = tree.getCareLog()`.
6. Replay: `const rebuilt = CareLogReplay.reconstruct(42, 'hardwood', careLog, 60)`.

**Assertions:**
- `rebuilt` does not throw.
- The wire-remove action is in `careLog` (logged by `tree.removeWire(b.id)` call or the wire-remove at day 60).

Wait — actually CLR-WIRE-1 needs the tree to actually call removeWire on the original tree before replay. Let me revise:

**Revised CLR-WIRE-1 setup:**
1. Grow tree (seed=42, hardwood) to day 50. Find wirable depth-1 branch `b`. Record `originalAngle = b.angle`.
2. Wire: `tree.wire(b.id, 20)`. Record `wiredAngle = rebuilt.getBranches()[b.id].angle`.
3. Grow 10 more days via `GrowthEngine.growTick`. (wire has been applied 10 days < setDays ~28–56).
4. Remove wire: `tree.removeWire(b.id)`.
5. Record `postRemoveAngle = tree.getBranches()[b.id].angle`.
6. Build care log: `const careLog = tree.getCareLog()`.
7. Replay: `const rebuilt = CareLogReplay.reconstruct(42, 'hardwood', careLog, 60)`.

**Assertions:**
- `rebuilt` does not throw — the replay completes.
- `rebuilt.getBranches()[b.id].angle` equals `postRemoveAngle` (within round4 tolerance ≤ 0.0001).
- `postRemoveAngle` is strictly between `originalAngle` and `wiredAngle` (partial spring-back — not fully back, not fully held).
- `careLog.some(e => e.action.type === 'wire-remove')` — wire-remove entry is in the log.

**What this proves:** CareLogReplay correctly calls `WireEngine.removeWire` during replay, producing a tree with the same partially-sprung-back angle as the original.

---

### CLR-WIRE-2 — Full set period: angle stays permanent

**Setup:**
1. Grow tree (seed=42, hardwood) to day 50. Find wirable depth-1 branch `b`. Record `originalAngle`.
2. Wire: `tree.wire(b.id, 20)`. Record `wiredAngle`.
3. Grow `setDays + 5` more days (wire well past set threshold; `setDays` is ~28–56 based on diameter).
4. Remove wire: `tree.removeWire(b.id)`.
5. Record `postRemoveAngle = tree.getBranches()[b.id].angle`.
6. Build care log: `const careLog = tree.getCareLog()`.
7. Replay: `const rebuilt = CareLogReplay.reconstruct(42, 'hardwood', careLog, 50 + setDays + 5 + 1)`.

**Assertions:**
- Replay does not throw.
- `rebuilt.getBranches()[b.id].angle` equals `postRemoveAngle` (round4 tolerance).
- `postRemoveAngle` equals `wiredAngle` (bend permanently set — no spring-back).
- `rebuilt.getBranches()[b.id].wireSet === true`.
- `rebuilt.getBranches()[b.id].bendSet === true`.

**Note for implementer:** To get `setDays`, call `computeSetDays(b.diameter)` (import from `TwineWeightEngine.js`). Use `Math.ceil(setDays) + 5` extra ticks to safely exceed the threshold.

**What this proves:** CareLogReplay correctly reproduces the permanent-set outcome when wire was removed after the set window.

---

### CLR-WIRE-3 — Unknown action type still throws (regression guard)

**Setup:**
1. Build a minimal care log with a fake action type:
   ```js
   const badLog = [{ day: 0, action: { type: 'unknown-future-action', branchId: 0 } }];
   ```
2. Attempt: `CareLogReplay.reconstruct(42, 'hardwood', badLog, 1)`.

**Assertions:**
- Throws `CareLogReplayError` (the exhaustiveness guard at the bottom of the dispatch chain, lines 163–166 in current file).
- Error message includes the unknown type string.
- Does NOT throw for `wire-remove` (confirmed by CLR-WIRE-1 passing).

**What this proves:** The fix did not remove the exhaustiveness guard. Unknown action types still throw correctly. The `wire-remove` fix is additive — only the `wire-remove` branch changes.

---

## SCOPE

### Files that CHANGE

| File | Change | Lines touched |
|------|--------|--------------|
| `packages/engine/src/CareLogReplay.ts` | Replace 4-line throw block with 1-line `WireEngine.removeWire` call in the `wire-remove` branch. Remove stale Phase 1 comments. | ~5 lines |
| `packages/engine/test_carelogreplay_wire.mjs` | **NEW FILE** — CLR-WIRE-1, CLR-WIRE-2, CLR-WIRE-3 gate tests. | ~120–150 lines |

### Files that MUST NOT CHANGE

| File | Reason |
|------|--------|
| `packages/engine/src/WireEngine.ts` | Signature is correct. No change needed or wanted. |
| `packages/engine/src/BonsaiTree.ts` | `removeWire(branchId)` already correctly delegates. No change. |
| `packages/shared/src/index.ts` | CareAction type is correct. No new fields. |
| `apps/web/src/persistence.ts` | GAP-4 fix is a separate task. Do NOT touch here. |
| `apps/server/supabase/functions/derive-stats/index.ts` | Same GAP-4, separate task. |
| `apps/web/src/main3d.ts` | No change needed. |
| `apps/web/src/main2d.ts` | No change needed. |
| Any existing test files | CLR-WIRE-1/2/3 go in a NEW file. Do NOT modify test_wire.mjs. |

### Lines changed in CareLogReplay.ts

**5 lines touched:** 4 removed (throw block + stale comments), 1 added (`WireEngine.removeWire(tree, a.branchId)`). Net: −4 lines.

---

## ASSUMPTIONS

1. **A1 — No daysElapsed in wire-remove CareLogEntry (CONFIRMED).** The CareAction union `{ type: 'wire-remove'; branchId: number }` carries only `branchId`. Elapsed days are computed internally by `WireEngine.removeWire`. This is verified against shared/index.ts line 197. The implementer must NOT add new fields to the shared type.

2. **A2 — Branch diameter is stable enough at replay time for spring-back correctness.** `computeSetDays(b.diameter)` uses the branch's diameter at the moment `wire-remove` is processed during replay. The branch grows during replay just as it did in the original run (same seed, same care actions, same tick sequence). Therefore `b.diameter` at replay day R will be identical to what it was at day R in the original run. Determinism is maintained.

3. **A3 — wire-remove can only appear in the log after a wire entry for the same branchId.** `WireEngine.removeWire` is a no-op if `!b.wired`. If somehow a malformed log has wire-remove without a prior wire, the no-op is safe — no crash, no state corruption. The replay invariant is not broken.

4. **A4 — The GAP-4 fix (applyCurrentDayEntries) is out of scope.** Current-day wire-remove entries will still be skipped (console.warn only) until a separate task fixes `applyCurrentDayEntries`. This is a known, documented limitation. The CareLogReplay fix (cold-reload reconstruction) is the production-blocking issue.

---

## OPEN QUESTIONS

**OQ-CLR-1 (implementer decision): Test file location.**
Gate tests for CareLogReplay should go in a new file `packages/engine/test_carelogreplay_wire.mjs`, following the existing `test_wire.mjs` pattern. Confirm this with the project owner or use the pattern from test_wire.mjs as authority.

**OQ-CLR-2 (follow-up task, not this fix): GAP-4 — applyCurrentDayEntries.**
Both `persistence.ts` and `derive-stats/index.ts` have a local `applyCurrentDayEntries` function that silently skips wire-remove (falls to `else`/console.warn, persistence.ts lines 302–308). Until these are fixed, a wire-remove that occurs on the same game day as the page reload will not be re-applied after cold-load. Track as a follow-up task after this CareLogReplay fix lands.

**OQ-CLR-3 (implementer verification): Does CLR-WIRE-2 setDays need to account for branch growth during wire period?**
`computeSetDays(b.diameter)` uses the diameter at remove-time, which may differ from the diameter at wire-apply-time (the branch grows). The engine's time-based SCAR check also uses the current diameter (BonsaiTree.ts lines 120–121). Confirm that using `computeSetDays(b.diameter)` at remove-time in both the live run and replay produces identical `wireDaysApplied >= setDays` comparisons. If diameter changes between wire and remove cause the threshold to flip differently in replay than in the original, the test will surface it.

---

## BOTTOM LINE FOR IMPLEMENTER

**The fix is one effective line change in CareLogReplay.ts:**

```typescript
// BEFORE (lines 123–126 — remove these):
// Phase 1: wire-remove is not implemented in CareLogReplay.
// A care log containing wire-remove cannot be replayed until Phase 2.
throw new CareLogReplayError(
  `'wire-remove' is not yet implemented and cannot be replayed (Phase 2).`
);

// AFTER (replace the above with):
WireEngine.removeWire(tree, a.branchId);
```

`WireEngine` is already imported. `a.branchId` is type-safe (discriminated union narrows `a` in this branch). No other file changes. Write CLR-WIRE-1/2/3 gate tests in a new `.mjs` file, run them, and hand to the auditor.

---

*Sources: [piratenation-contracts (Proof of Play)](https://github.com/proofofplay/piratenation-contracts) · [typescript-event-sourcing (xolvio)](https://github.com/xolvio/typescript-event-sourcing) · [Event Sourcing in Game Inventory (springfuse)](https://www.springfuse.com/event-sourcing-game-inventory/)*
