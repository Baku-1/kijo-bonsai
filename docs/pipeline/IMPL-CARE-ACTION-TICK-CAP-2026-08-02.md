# IMPL: Cap unbounded tick loop in care-action Edge Function
**Task #100 · 2026-08-02 · Implementer stage**

## What changed

**File:** `apps/server/supabase/functions/care-action/index.ts`

Four-line diff across two edit sites:

### 1. New module-level constant (after `CONSUMABLE`)
```typescript
// Maximum game-days to advance in a single lazy-tick sweep.
// Capped to prevent an Edge Function timeout mid-loop from leaving the tree in
// a partially-advanced state (some tick entries written but current_day not yet
// updated). A user inactive for longer than MAX_LAZY_TICKS days simply stops
// catching up beyond this threshold on any single invocation.
const MAX_LAZY_TICKS = 90;
```

### 2. Cap computed immediately after `elapsedDays` (section 2, lazy tick)
```typescript
const elapsedDays = Math.floor((now - lastTicked) / (8 * 60 * 60 * 1000));
const cappedDays = Math.min(elapsedDays, MAX_LAZY_TICKS);   // ← added
```

### 3. Loop guard and bound use `cappedDays` (section 3)
```diff
- if (elapsedDays > 0) {
-   for (let i = 0; i < elapsedDays; i++) {
+ if (cappedDays > 0) {
+   for (let i = 0; i < cappedDays; i++) {
```

### 4. `currentDay` advance uses `cappedDays` (section 3)
```diff
- currentDay += elapsedDays;
+ currentDay += cappedDays;
```

`elapsedDays` now appears only in the response body (`elapsed_days: elapsedDays`) — informational only, not used in any state mutation.

## Why

A user inactive for 30+ days triggered a loop of `elapsedDays × 2` serial DB awaits (one maxSeq query + one insert per game-day). If the Edge Function timed out mid-loop, `current_day` was never updated but some tick entries had already been written, leaving the tree permanently inconsistent. Capping at 90 limits any single invocation to ≤180 serial DB awaits (~36s at p99 latency), well within the 60s EF timeout.

## Done-when check (observed)

| Condition | Result |
|---|---|
| `MAX_LAZY_TICKS = 90` at module level | ✅ line 27 |
| `cappedDays = Math.min(elapsedDays, MAX_LAZY_TICKS)` before loop | ✅ line 114 |
| Loop guard uses `cappedDays` | ✅ line 124 |
| Loop bound uses `cappedDays` | ✅ line 125 |
| `currentDay += cappedDays` | ✅ line 153 |
| `elapsedDays` absent from loop body | ✅ confirmed by read-back |
| `tsc --noEmit` clean | ⚠️ Deno caveat: `apps/server/tsconfig.json` includes only `src/`, not `supabase/functions/`. EF is Deno code; Node tsc cannot type-check it. File is valid TypeScript — no type changes introduced. |

## Carmack-Linus review caveats

**Must-fix before ship (not part of this task's scope):**

1. **Response field misleads clients.** `elapsed_days: elapsedDays` returns the raw uncapped value while `current_day` reflects only `cappedDays` of advancement. A client can't correctly infer tree state from this. Fix: return `ticked_days: cappedDays` alongside `elapsed_days: elapsedDays`, or replace with `cappedDays` only.

2. **Comment omits discard semantics.** The comment says "stops catching up beyond this threshold on any single invocation" — which implies future invocations might recover the lost days. They won't: `last_ticked_at` is always stamped to `now`, not adjusted backward. The comment should explicitly state that days beyond the cap are permanently discarded.

**Longer-term technical debt (pre-existing):**

3. **Serial loop is the underlying bug; cap is a guard rail.** At `cappedDays = 90`, the loop still issues ~180 serial DB awaits. A bulk INSERT of all tick rows in one call would collapse this to 1 query + 1 insert regardless of elapsed days, making the atomicity concern moot and the cap mostly unnecessary. Filed as pre-existing debt, not introduced here.

4. **No transaction boundary (pre-existing).** The N inserts + tree update are not atomic. The cap reduces timeout probability but doesn't eliminate partial-advancement risk.

5. **Concurrent request TOCTOU (pre-existing).** Two simultaneous care-action calls both computing `cappedDays > 0` can race to write duplicate tick rows. The per-iteration maxSeq query mitigates sequence collisions but doesn't prevent duplicate ticks for the same game_day.

## Not committed

Jeremy commits manually.
