# CRITIC-BUG4: CareLogReplay Determinism Test Design — Pressure Test
**Date**: 2026-08-07
**Stage**: Critic
**Spec reviewed**: `docs/pipeline/ARCH-BUG4-CARELOG-DETERMINISM-2026-08-07.md`
**Files read**: `CareLogReplay.ts`, `BonsaiTree.ts`, `WireEngine.ts`, `GrowthEngine.ts`, `PruneEngine.ts`, `packages/engine/src/index.ts`, `packages/engine/test/determinism.test.js`

---

## VERDICT

**Conditionally approved with one blocking fix and one required clarification.**

The spec is architecturally sound. Signature, loop semantics, exports, `wireCount` reconstruction, cascade gate symmetry, day-counter alignment, and `round4()` safety are all verified. One assertion in Test B is provably wrong and must be corrected before implementation. One implementation ambiguity in Test A must be spelled out.

---

## BLOCKING ISSUES (must fix before implementation)

### BUG-C1 — Test B Assertion 1 is provably wrong: overwatered tree hits health floor as fast as drought tree

**What the spec claims:**
> `hydratedSchedule`: water 50 every day (`d => tree.water(50)`)
> `assert.ok(replayHydrated.getHealth() > replayDrought.getHealth())`
> "Hydrated tree has higher health (moisture in [30,65] range gives +0.8/day)"

**Why this is wrong:**

`BonsaiTree.water(50)` called every day before `growTick`:
- Day 0: moisture = min(100, 55+50) = **100**
- Every subsequent day: moisture decays 5–9 then spikes back to ~91–100 after the next water

`applyDailyUpdate()` (BonsaiTree.ts lines 43–49):
```typescript
if (m >= 30 && m <= 65) {
  health += 0.8;          // GOOD range
} else if (m < 15 || m > 80) {
  health -= 1.5;          // BAD — includes m > 80 ← THIS IS THE HYDRATED TREE
} else {
  health -= 0.3;
}
```

Moisture ≈ 91–100 (always > 80) → **health -1.5/day every day**, same penalty as severe drought. The architect assumed `hydratedSchedule` would keep moisture in [30,65]. It doesn't — it saturates at 100.

**Traced health trajectories over 60 days:**

*Hydrated tree* (water 50/day, moisture ≈ 100 from day 1):
- 85 − 1.5 × 60 = −5 → floor at **10**

*Drought tree* (no water, moisture hits 0 by day ~7):
- Days 0–4 (m ≈ 55→30, in good range): +0.8/day ≈ +4
- Days 5–6 (m ≈ 15–30, neutral range): −0.3/day ≈ −0.6
- Days 7–59 (m = 0, m < 15): −1.5/day × 53 = −79.5
- 85 + 4 − 0.6 − 79.5 ≈ 8.9 → floor at **10**

Both trees hit `Math.max(10, ...)` = **10** at approximately day 59–60. The assertion `10 > 10` is `false`. The test will fail.

**Required fix (two options — pick one):**

Option A — Fix `hydratedSchedule` to actually keep moisture in the [30,65] optimal range:
```javascript
// Moderate watering every 2 days: moisture stays ~30–65
const hydratedSchedule = (tree, d) => { if (d % 2 === 0) tree.water(15); };
```
With decay 5–9/day × 2 days = 10–18 lost between waterings, adding 15 back keeps moisture roughly in [30,65] → +0.8/day health gain. After 60 days, health ≈ 85 + 0.8×60 ≈ 100 (capped) vs. drought floor of 10. Assertion holds.

Option B — Drop assertion 1. Assertions 2 and 3 already prove what Test B needs to prove:
- `getMoisture()` comparison (assertion 2) is correct and sufficient to establish care divergence
- `notDeepEqual(getBranches())` (assertion 3) confirms observable state divergence
- Assertion 1 is redundant IF the schedule is corrected; it is wrong AS SPECIFIED

**Note**: Assertion 2 (`replayHydrated.getMoisture() > replayDrought.getMoisture()`) and assertion 3 (`notDeepEqual(branches)`) are verified correct. Keep them.

---

## REQUIRED CLARIFICATIONS (implementation will be ambiguous without these)

### GAP-C1 — Test A "locate the pruned branch" is underspecified

**What the spec says:**
> Spot check — pruned branch: locate the branch that was pruned in `liveTree` (found during `standardSchedule`). Assert `replayTree.getBranches()[prunedId].pruned === true`.

**Problem:** `buildTree(seed, species, numDays, scheduleFn)` returns a finished `BonsaiTree` with no way to retrieve which branch ID was pruned. The spec says "found during `standardSchedule`" but `standardSchedule` is a closure (or function) that has no return path to the test.

The implementer must either:
1. Capture `prunedId` in a closure variable outside `buildTree`, or
2. Scan `liveTree.getBranches().findIndex(b => b.pruned && b.parent !== null)` after `buildTree` returns

The spec should prescribe option 2 explicitly, since `deepEqual(getBranches())` assertion 1 already covers pruned state. Option 2 is the right pattern: scan for a pruned non-trunk branch post-hoc. The spec should add this sentence:
> "Retrieve `prunedId` by scanning `liveTree.getBranches().findIndex(b => b.pruned && b.parent !== null)` after `buildTree` returns. Assert `prunedId >= 1` to confirm the prune fired."

Without this direction the implementer may use an incorrect mechanism or skip the spot check.

---

## VERIFIED CLAIMS (all passed)

**Signature and behavior:**
- ✓ `reconstruct(seed, species, careLog, totalDays): BonsaiTree` — exact match, CareLogReplay.ts lines 34–39
- ✓ Replay loop: `for day = 0..totalDays-1`: apply entries, then `GrowthEngine.growTick(tree)` — lines 97–163
- ✓ `MAX_REPLAY_DAYS = 36_500` — exported, line 14
- ✓ `CareLogReplayError` — exported via `export { CareLogReplayError } from './errors.js'`
- ✓ `BonsaiTree` constructor initializes moisture=55, health=85, day=0, nextId=1 — BonsaiTree.ts lines 21–26

**wireCount reconstruction — the architect's central claim holds:**

`WireEngine.wire()` (line 79): `b.wireCount = (b.wireCount ?? 0) + 1` — this runs during replay when `WireEngine.wire(tree, a.branchId, a.angleDelta)` is called. The cascade gate (`wireCount >= 3 ? 150 : 120`) uses the post-increment value in BOTH live and replay, so the gate fires identically in sequence.

The stored `angleDelta` in the care log is `appliedDelta = round4(clampedAngle - oldAngle)`. Proved that `|appliedDelta| ≤ 45` always (delta is first clamped to ±45, cascade gate only further restricts the result). Therefore the re-clamping in replay (`clamp(appliedDelta, -45, 45)`) is a no-op and replay produces the same `clampedAngle`. wireCount does NOT need to be serialized into the care log. ✓

**Care log does NOT need `wireCount` in serialized entries** — confirmed. ✓

**Day-counter alignment:**
- `water()` logs at `this.state.day` BEFORE `growTick` increments it (BonsaiTree.ts line 158)
- `growTick` calls `applyDailyUpdate()` first (GrowthEngine.ts line 25), which increments `state.day`
- In replay, `tree.water(a.amount)` fires on iteration `day=0` before `growTick`, so replay tree also logs at `state.day=0`. Correspondence is exact. ✓

**Test D partial replay (truncation to 50 days):**
- `byDay` map is built for all entries but loop only reads day=0..49 (CareLogReplay.ts line 97: `day < totalDays`)
- Entries with `entry.day >= 50` are silently ignored — verified by code inspection. ✓
- `treeM` at day 50 equals `treeN` at day 50 because: same seed, same schedule, RNG seeded by `seed + b.id * 7919 + day * 37` (GrowthEngine.ts line 60) — pure function of (seed, id, day), not of loop length. ✓

**Test C empty care log:**
- `CareLogReplay.reconstruct(99, 'hardwood', [], 100)` runs 100 growTicks with no care actions
- `buildTree(99, 'hardwood', 100, noOpSchedule)` also runs 100 growTicks with no care actions
- Both trees start from `new BonsaiTree(99, 'hardwood')` → moisture=55, health=85, day=0
- Structurally identical by construction. ✓

**`deepEqual` on `getBranches()` safety:**
- All physics values computed through `round4()` (imported in BonsaiTree.ts, GrowthEngine.ts, WireEngine.ts)
- Same seed + same care actions → same RNG sequence → same `round4()` outputs → no floating-point divergence. ✓

**Fertilize cooldown during replay:**
- Cooldown state (`fertilizerCooldown`) advances by `_tickFertilizer()` inside `growTick` — same call sequence in live and replay
- Care log only contains SUCCESSFUL fertilize entries (BonsaiTree.ts line 162: `if (this.state.fertilizerCooldown > 0) return`)
- Replay fires `tree.fertilize()` only when log says it succeeded; cooldown state is identical at that point. ✓

**Phase 2 stubs not triggered:**
- `standardSchedule` uses water, prune, wire only
- `hydratedSchedule` / `droughtSchedule` / `noOpSchedule` use water (or nothing)
- None trigger twine, weight, jin. ✓

**Exports confirmed in `packages/engine/src/index.ts`:**
- `BonsaiTree` — line 5 ✓
- `GrowthEngine` — line 6 ✓
- `CareLogReplay`, `CareLogReplayError`, `MAX_REPLAY_DAYS` — line 7 ✓
- `PruneEngine` — line 8 ✓
- `WireEngine` — line 9 ✓

**Test file style matches existing pattern:**
- `import test from 'node:test'` + `import assert from 'node:assert/strict'` — matches determinism.test.js lines 3–4 ✓
- Import from `'../dist/index.js'` — matches determinism.test.js line 5 ✓

**GrowthEngine.growTick order:**
- spec says: applyDailyUpdate → _tickFertilizer → extendAndFork → thickeningPass → markDirty
- GrowthEngine.ts lines 24–34: confirmed exactly. ✓

**WireEngine log API inconsistency (OQ-2):**
- `WireEngine.wire()` uses `tree.getCareLog().push()` (line 99) vs. `tree._logCare()` used by all others
- Functional parity confirmed — both write to `this.careLog`. Style issue only, does not affect test design. ✓

---

## OPTIONAL SUGGESTIONS

**S1 — Rename `hydratedSchedule` to `overwateredSchedule`** once the schedule is corrected, or rename it `moderateSchedule` if using Option A above. The current name implies optimal hydration; calling it `overwatered` or `moderate` makes the test intent obvious.

**S2 — Assumption #5 (trunk wire at day 30) adds runtime risk**

The spec acknowledges trunk thickness might exceed `WIRE_MAX_THICKNESS=3.0` by day 30, which would silently make wire a no-op (no care log entry → no wire assertions). The proposed mitigation ("implementer should assert `tree.wire(0, 30).ok === true` during setup") is sound. Consider specifying a backup: if the assertion fails, move the wire to day 15 (before Leonardo's Rule has thickened the trunk significantly) and update test fixture comments accordingly.

**S3 — Test E negative paths (OQ-4)**

The spec notes these as implementer discretion. Recommend including at least three:
- `totalDays = 0` → `CareLogReplayError`
- `species = 'bamboo'` → `CareLogReplayError`
- Care log with `{ type: 'unknown-action' }` → `CareLogReplayError`

These are already guarded by lines 41–76 and 156–159 of CareLogReplay.ts. The tests are trivial to write and add meaningful regression coverage.

---

## SUMMARY

| # | Category | Item | Decision |
|---|---|---|---|
| BUG-C1 | **BLOCKING** | Test B Assertion 1 health comparison is wrong (both trees hit floor=10) | Must fix hydratedSchedule or drop assertion |
| GAP-C1 | **Required** | How to retrieve `prunedId` in Test A is unspecified | Add post-hoc scan instruction |
| S1 | Optional | Rename `hydratedSchedule` for clarity | Implementer discretion |
| S2 | Optional | Trunk wire timing risk backup plan | Implementer discretion |
| S3 | Optional | Test E negative paths | Recommend including |
| All other claims | **Approved** | Signature, loop, wireCount, cascade gate, day alignment, Test C, Test D, exports, round4 | ✓ Verified |
