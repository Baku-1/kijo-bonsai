# IMPL-TWE-CAVEAT-FIXES-2026-08-14

**Phase:** Implementer (caveat resolution)
**Date:** 2026-08-14
**Engineer:** Claude (Sonnet 4.6)
**Audit ref:** `AUDIT-TWINEWEIGHT-PHASE2-2026-08-14.md`
**Verdict:** VERIFIED WITH CAVEATS (3 caveats — all resolved here)

---

## OUTCOME: done

All three caveats from `AUDIT-TWINEWEIGHT-PHASE2-2026-08-14.md` resolved. All done criteria met by direct observation.

---

## DONE WHEN (from task spec)

| Check | Observed Result |
|---|---|
| `tsc --noEmit` (shared) exits 0 | exit 0 |
| `tsc --noEmit` (engine) exits 0 | exit 0 |
| `npm test` 49/49 pass | 49/49 pass, exit 0 |
| `node packages/engine/test_security.mjs` exits 0 | 55/55 pass, exit 0 |
| DECISIONS.md OQ-5 note added | confirmed in file |
| TwineWeightEngine.ts comment fixed | confirmed in file |

---

## WHAT CHANGED

### CAVEAT-A — SEC-3-3/4/5/6 test updates (`packages/engine/test_security.mjs`)

**Root cause:** Phase 1 stubs in CareLogReplay threw `CareLogReplayError` for `twine`, `twine-remove`, `weight`, `weight-remove` action types. Phase 2 implemented real routing. The 4 tests asserting throws were now failing because the stubs no longer exist.

**Fix:** Converted SEC-3-3, SEC-3-4, SEC-3-5, SEC-3-6 from `assertThrows` to `assertNoThrow` + return value capture + two state assertions each:

- **SEC-3-3:** twine action → `tree.getBranches()[0]?.twined === true` (positive binding applied)
- **SEC-3-4:** twine-remove on un-twined branch → `twined === false` (no-op, no throw)
- **SEC-3-5:** weight action → `tree.getBranches()[0]?.weighted === true` (positive binding applied)
- **SEC-3-6:** weight-remove on un-weighted branch → `weighted === false` (no-op, no throw)

**Rationale for branch 0 assertions:** Branch 0 (trunk) is the only guaranteed-present branch at 10 days. `angleDelta=10` is finite and within ±28°. For SEC-3-3, `degradeDays=10` (passed as `storedDegradeDays`) means `twineDegradesDay = 1 + 10 = 11`; replay runs 10 days (days 0–9), so degrade never fires — branch 0 remains `twined=true` at replay end.

### CAVEAT-A (additional) — SEC-3-1/1b test updates

**Context:** The audit labeled SEC-3-1/1b "pre-existing, not this task" but the done criterion required `node test_security.mjs` to exit 0. SEC-3-1/1b test that `wire-remove` throws — Phase 2 routed `wire-remove` to `WireEngine.removeWire`, same root cause as CAVEAT-A.

**Observed behavior:** `WireEngine.removeWire(tree, 0)` on an unwired branch returns `undefined` (no throw). `CareLogReplay.reconstruct` with a `wire-remove` action succeeds, returning a valid tree with `branch[0].wired === false`.

**Fix:** Same pattern as SEC-3-3/4/5/6. Added SEC-3-1c state assertion. Renamed old SEC-3-1b (was error class check) to SEC-3-1b (now "reconstruct returns a tree") + SEC-3-1c (state check). Noted in caveats.

### CAVEAT-B — DECISIONS.md OQ-5 ARCH divergence note

**Added to OQ-5 entry:** An ARCH DIVERGENCE NOTE documenting that `ARCH-TWINEWEIGHT-PATCH-2026-08-14.md §LOW-4` specified REPLACE semantics as the default and instructed the implementer to flag OQ-5 as unconfirmed. The Phase 2 implementer instead implemented STACK semantics based on Jeremy's direct confirmation during pipeline review (2026-08-14). The note:
- Declares DECISIONS.md as the authoritative resolution
- Explicitly supersedes the written §LOW-4 instruction
- Provides a forward-looking guard: do NOT revert to REPLACE without a new owner confirmation and new DECISIONS.md entry
- Cross-references `AUDIT-TWINEWEIGHT-PHASE2-2026-08-14.md CAVEAT-B`

### CAVEAT-C part 1 — TwineWeightEngine.ts comment fix

**Old comment (lines 276-277):**
```ts
// NOTE: BonsaiTree.applyWeight (line 227–236) validates !isFinite and !isInteger before
// calling here. These guards are present for direct-call safety.
```

**New comment:**
```ts
// NOTE: BonsaiTree.applyWeight validates !isFinite and !isInteger before calling here.
// The engine assumes valid inputs; BonsaiTree is responsible for validation.
// Direct callers of TwineWeightEngine bypass BonsaiTree and must ensure valid inputs themselves.
```

**What was wrong:** "These guards are present for direct-call safety" falsely implied the guards protected direct engine callers. The guards exist only in `BonsaiTree.applyWeight` — they are never invoked on the direct `TwineWeightEngine.applyWeight(tree, branchId, weightCount)` path. A direct caller cannot rely on them. The new comment correctly states the validation contract: BonsaiTree validates, the engine assumes valid inputs.

**Also removed:** The fragile line-number reference `(line 227–236)` — line numbers drift silently on every unrelated edit. The new comment references by method name.

### CAVEAT-C part 2 — SEC-6 guard layer test (`packages/engine/test_security.mjs`)

**Added SEC-6 section** ("BonsaiTree guard layer validation") with two assertions:

- **SEC-6-1:** `BonsaiTree.applyTwine(0, NaN)` throws (non-finite angleDelta rejected by guard)
- **SEC-6-1b:** Thrown error is `CareLogReplayError` (not a generic Error)

The section header comment documents the guard architecture: guards live in BonsaiTree, the engine assumes valid inputs, direct callers bypass BonsaiTree.

Also added a coverage gap note: `applyWeight` guard coverage (non-finite, non-integer, out-of-range) is deferred to a future task.

### Post-review cleanup (carmack-linus-review findings)

Two additional edits applied after self-review:

1. **Removed stale section preamble** (lines 242-243) from test_security.mjs — "Grow a tree for 50 days...Use totalDays=55 so the actions on day 51 are in range." This comment was a relic from the original test structure; all SEC-3 tests use `totalDays=10`, `day=1`. The comment actively misdirected readers.

2. **Removed line-number reference** from TwineWeightEngine.ts comment — changed `(lines 227-236)` to reference by method name only. Line numbers are the worst possible reference mechanism; they drift silently.

---

## VERIFIED BY OBSERVATION

```
$ npx tsc -p packages/shared/tsconfig.json --noEmit
(exit 0, no errors)

$ npx tsc -p packages/engine/tsconfig.json --noEmit
(exit 0, no errors)

$ cd packages/engine && npm test
1..49
# tests 49
# pass 49
# fail 0
(exit 0)

$ node packages/engine/test_security.mjs
  [SEC-1 through SEC-6 output]
Security test result: 55 passed, 0 failed
(exit 0)
```

The security test now has 55 assertions (up from 49 before CAVEAT fixes), reflecting:
- SEC-3-1: 2 assertions → 3 (added SEC-3-1c state check)
- SEC-3-3/4/5/6: 2 assertions each → 3 each (added state checks)
- SEC-6: 2 new assertions added (SEC-6-1, SEC-6-1b)

---

## INTENT CHECK

**CAVEAT-A (SEC-3-3/4/5/6):**
```
code does:     CareLogReplay routes twine/twine-remove/weight/weight-remove to real Phase 2 handlers
check expects: (old) assertThrows → CareLogReplayError
spec says:     Phase 2 implements these action types; they should succeed
verdict:       CONFLICT — old tests tested Phase 1 stub behavior. Fixed tests to match Phase 2 spec.
```

**CAVEAT-A (SEC-3-1/1b — wire-remove):**
```
code does:     CareLogReplay routes wire-remove to WireEngine.removeWire; no-op on unwired branch
check expects: (old) assertThrows → CareLogReplayError
spec says:     Phase 2 implements wire-remove routing; it should succeed (no-op behavior)
verdict:       CONFLICT — same root cause as SEC-3-3/4/5/6. Fixed tests to match Phase 2 spec.
               Noted: done criterion ("exits 0") required fixing despite audit's "not this task" label.
```

**CAVEAT-C (TwineWeightEngine.ts comment):**
```
code does:     engine validates branchId/pruned/range; does NOT validate isFinite/isInteger
comment says:  (old) "These guards are present for direct-call safety"
spec says:     guards live in BonsaiTree, not engine; engine assumes valid inputs
verdict:       CONFLICT — comment was false. Fixed to accurately describe the contract.
```

---

## CARMACK × LINUS SELF-REVIEW FINDINGS

Applied carmack-linus-review to all changed files. Three findings; two acted on immediately:

**1. (LOW, FIXED) Stale section preamble in test_security.mjs** — removed. See post-review cleanup above.

**2. (LOW, FIXED) Line-number reference in TwineWeightEngine.ts comment** — removed. See post-review cleanup above.

**3. (MED, DEFERRED) SEC-6 coverage gap** — `BonsaiTree.applyWeight` guard coverage (non-finite, non-integer, out-of-range) is not tested in SEC-6. CAVEAT-C specified only `applyTwine(branchId, NaN)`. A coverage gap note was added to the SEC-6 section header. Full applyWeight guard tests are deferred.

**4. (OBSERVABILITY NOTE, not fixed) No-op tests cannot distinguish execution from silent drop** — SEC-3-1c, SEC-3-4c, SEC-3-6c assert `wired/twined/weighted === false` after a remove action on a never-applied binding. This is inherent to the no-op nature of these calls — there is no positive state change to assert. If CareLogReplay ever regressed back to silently dropping these action types, these tests would still pass. The assertion is correct but weak. Noted for future test hardening (e.g., spy/intercept hooks in a future test refactor).

---

## CAVEATS

1. **SEC-3-1/1b were labeled "pre-existing, not this task" by the auditor** — I fixed them anyway because the done criterion required `node test_security.mjs` to exit 0, which was unachievable with SEC-3-1/1b still failing. The root cause is identical (Phase 2 routing replacing Phase 1 stubs). The fix is the same pattern. This is documented here and in the DECISIONS.md note.

2. **`dist/` was not rebuilt** — The security test imports from `packages/engine/dist/`. The dist was built during the Phase 2 implementation task (`IMPL-TWINEWEIGHT-ENGINE-2026-08-14.md`). The changes in this task are: (a) `test_security.mjs` (plain JS, not compiled), (b) a comment in `TwineWeightEngine.ts` (comments don't affect compiled output), (c) `DECISIONS.md` (not compiled). No rebuild was required; the dist remains valid. `tsc --noEmit` confirmed the TypeScript is clean.

3. **BonsaiTree.applyWeight guard tests deferred** — SEC-6 covers only the `applyTwine` NaN guard as specified in CAVEAT-C. The `applyWeight` guards (non-finite, non-integer, out-of-range) have no dedicated security test coverage. A gap note was added to SEC-6.

4. **No STATE.md update performed** — The audit verified Phase 2 is complete; this task resolves audit caveats only. STATE.md was last updated by the Phase 2 implementer. If the auditor's verdict changes from "VERIFIED WITH CAVEATS" to "VERIFIED" after these fixes, STATE.md should be updated to reflect that.
