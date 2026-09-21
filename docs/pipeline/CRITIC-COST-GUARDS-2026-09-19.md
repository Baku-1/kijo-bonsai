# Critic Review: Cost & Consumable Parameter Validation Guard Sweep
**Date:** 2026-09-19
**Reviewer:** Critic stage (Carmack-Linus persona)
**Spec under review:** docs/pipeline/ARCH-COST-GUARDS-2026-09-19.md
**Verdict:** APPROVED WITH CHANGES

---

## SUMMARY

The architect produced a thorough, security-minded spec. The parameter catalog is accurate — every claim was verified against source code. The CareLogReplay bypass finding (prune/wire/wire-remove route directly to static engines) is real and correctly identified. The server-side gap (zero field-level validation) is real and correctly prioritized. The canonical guard pattern is sound.

**However, there are 3 blockers and 6 advisories that must be addressed before implementation.**

---

## VERIFICATION RESULTS (spec claims vs. source code)

All 17 BonsaiTree parameter entries verified against source:

| # | Entry | Spec claim | Verified? | Source |
|---|-------|-----------|-----------|--------|
| 1 | water(amount) | GUARDED | YES | BonsaiTree.ts L144-159 (but throws Error, not CareLogReplayError — see B-3) |
| 2 | wire(branchId) | VULNERABLE | YES | L173-174, raw delegation to WireEngine |
| 3 | wire(angleDelta) | VULNERABLE | YES | L173-174, raw delegation |
| 4 | removeWire(branchId) | VULNERABLE | YES | L193-194, raw delegation |
| 5 | applyTwine(branchId) | VULNERABLE | YES | L203-209, no branchId check |
| 6 | applyTwine(angleDelta) | GUARDED | YES | L204 isFinite check |
| 7 | applyTwine(storedDegradeDays) | VULNERABLE | YES | TwineWeightEngine L154-155 used verbatim |
| 8 | removeTwine(branchId) | VULNERABLE | YES | L217-219 |
| 9 | applyWeight(branchId) | VULNERABLE | YES | L226, no branchId check |
| 10 | applyWeight(weightCount) | GUARDED | YES | L227-236, full canonical pattern |
| 11 | removeWeight(branchId) | VULNERABLE | YES | L245-247 |
| 12 | applyJin(branchId) | GUARDED | YES | L255-264, segmentIndex + jinCost guarded |
| 13 | applyJin(segmentIndex) | GUARDED | YES | L255-264 |
| 14 | applyJin(jinCost) | GUARDED | YES | L255-264 |
| 15 | addLandscape(position) | GUARDED | YES | L276-283 |
| 16 | addLandscape(elementType) | Unguarded at runtime | YES | TypeScript union only, no runtime check |
| 17 | prune(branchId) | VULNERABLE | YES | L292, raw delegation to PruneEngine |

CareLogReplay bypass (Layer 1b entries #18-21) verified:
- CareLogReplay.ts L119: `PruneEngine.prune(tree, a.branchId)` — DIRECT, bypasses BonsaiTree. **CONFIRMED.**
- CareLogReplay.ts L121: `WireEngine.wire(tree, a.branchId, a.angleDelta)` — DIRECT. **CONFIRMED.**
- CareLogReplay.ts L125: `WireEngine.removeWire(tree, a.branchId)` — DIRECT. **CONFIRMED.**
- All other types (twine, twine-remove, weight, weight-remove, jin, water) go through BonsaiTree. **CONFIRMED.**

Server-side gap verified:
- care-action/index.ts L174: `const { type: _type, ...actionData } = action;` — raw destructure
- care-action/index.ts L181-186: `actionData` passed directly to `insert_care_log_entry` RPC. **CONFIRMED zero field-level validation.**

**100% of spec claims verified correct against source code.**

---

## BLOCKERS

### B-1: Missing upper-bound guard on branchId (SECURITY)

**What:** The canonical branchId pattern in the spec is `branchId < 0`. This catches negative values but NOT values >= branches.length. The `!b` implicit check in static engines catches `undefined` from out-of-range indexing, but the BonsaiTree guards run BEFORE engine delegation and should reject impossible values before delegation happens.

Additionally, `Number.MAX_SAFE_INTEGER + 1` (= 9007199254740992) causes integer precision loss in JS: `MAX_SAFE_INTEGER + 1 === MAX_SAFE_INTEGER + 2` is true. While the `!b` check catches `undefined`, the guard pattern claims to validate but doesn't enforce an upper bound.

**Impact:** Defense-in-depth gap. The BonsaiTree layer should not delegate values it knows are invalid.

**Fix:** Add `branchId >= tree.getBranches().length` to all BonsaiTree branchId guards. For server-side, use a hard upper bound (e.g., `branchId <= 10000`) since no tree can have that many branches.

**Severity:** BLOCKER — the guard pattern must be complete for the spec to be correct.

### B-2: Server schema must REJECT unlisted action types, not silently pass (SECURITY)

**What:** The spec's SCHEMAS object covers all 10 ALLOWED_ACTION_TYPES plus jin. But `jin` and `landscape` are currently REMOVED from ALLOWED_ACTION_TYPES (gated, per care-action/index.ts L100). When they're re-added, the server-side validation must be in place BEFORE the whitelist gate is lifted.

The spec does not mandate a hard fail-closed pattern: if a validator function does not exist for an action type that passes the ALLOWED_ACTION_TYPES whitelist, the current design would silently pass it through unvalidated.

**Impact:** Jin has 3 numeric params (branchId, segmentIndex, jinCost). jinCost=0 would be a free-jin exploit. This is a time-bomb.

**Fix:** The implementation must use a fail-closed pattern:
```typescript
const validator = SCHEMAS[actionType];
if (!validator) return json({ error: `No validation schema for ${actionType}` }, 400);
try { validator(actionData); } ...
```
NOT:
```typescript
const validator = SCHEMAS[actionType];
if (validator) { try { validator(actionData); } ... }
```

**Severity:** BLOCKER — silent pass-through of unschema'd types defeats the purpose of the guard sweep.

### B-3: `water()` throws plain `Error` instead of `CareLogReplayError` (CORRECTNESS)

**What:** BonsaiTree.water() at L147 throws `new Error(...)` (plain Error), not `new CareLogReplayError(...)`. Every other guard in the codebase uses CareLogReplayError. The architect's spec says to use CareLogReplayError for all guards (canonical pattern section).

CareLogReplay.ts L107-111 wraps the water error in CareLogReplayError via try/catch, so the replay path is functionally fine. But direct callers of `tree.water()` would catch a different error type than expected.

**Impact:** Error handling inconsistency. A caller catching `CareLogReplayError` specifically would miss the water validation error.

**Fix:** Change BonsaiTree.water() to throw `new CareLogReplayError(...)` instead of `new Error(...)`. 2-line change during the guard sweep.

**Severity:** BLOCKER — error type consistency is load-bearing for replay error handling.

---

## ADVISORIES

### A-1: WireEngine.wire() NaN angleDelta guard must throw, not return `{ ok: false }` (CORRECTNESS)

**What:** The spec correctly identifies that `clamp(NaN, lo, hi)` passes NaN through (`Math.min(hi, Math.max(lo, NaN))` = NaN). However, the spec does not specify whether the guard should throw CareLogReplayError (halting replay) or return `{ ok: false, reason }` (silent no-op).

For replay safety, it MUST throw. A NaN angleDelta in a care log entry means the log is corrupt and replay must halt. A silent `{ ok: false }` would skip the action, producing a different tree than the original — violating the core invariant.

**Fix:** Spec should explicitly mandate: guards in static engines that detect corrupt data throw CareLogReplayError, not return `{ ok: false }`.

### A-2: Extra fields stripping (GUARD-S13) needs a decision, not "assess" (SECURITY)

**What:** GUARD-S13 says "Assess: strip or reject unknown fields." This is a security spec — "assess" is not a verdict.

Extra fields in `actionData` go directly to `insert_care_log_entry` and are stored in the `action_data` JSONB column. A malicious client could store arbitrary JSON in the DB: log injection, storage bloat (1MB payloads × thousands), or prototype pollution if downstream code does `Object.assign({}, actionData)`.

**Fix:** STRIP unknown fields using an allowlist per action type. Construct a clean `actionData` from known fields only, discard everything else.

### A-3: `storedDegradeDays` needs an upper bound (CORRECTNESS)

**What:** The spec recommends `>= 0, isInteger` for storedDegradeDays. But the live path draws from `[10, 15]`. A crafted care log with `storedDegradeDays: 999999` would set `b.twineDegradesDay = tree.getAge() + 999999` — twine would never degrade within any reasonable game lifetime. Permanent twine without degradation, bypassing the intended 10-15 day window.

**Fix:** Add upper bound: `storedDegradeDays > 20` → reject. Use `requireIntRange(d.degradeDays, 0, 20, 'degradeDays')` on server side.

### A-4: Negative zero (-0) passes the canonical guard pattern (EDGE CASE)

**What:** `Number.isFinite(-0)` is true. `-0 >= 0` is true. `Number.isInteger(-0)` is true. So -0 passes all guards. `branches[-0]` is `branches[0]` = trunk.

Not exploitable for branchId (indexes to trunk, caught by engine-level business rules like "can't prune trunk"). But worth a test case to document the behavior.

**Fix:** Add one test case: `wire(-0, 10)` → should succeed (equivalent to `wire(0, 10)`) or be rejected by engine's "can't wire trunk" logic. Document which.

### A-5: Test coverage gap: type coercion and boundary cases (TESTING)

**What:** 37 test cases is a good count. Missing categories:
- Type coercion: `wire(true, 0)` — `true` coerces to `1` (valid branchId). Passes isFinite + isInteger. Is this desired?
- `branchId = 0` (trunk) — guard should NOT reject; engine rejects operations on trunk. Guard validates type/range only.
- `Number.MAX_SAFE_INTEGER` — passes all guards but indexes far beyond branches.length. Caught by `!b` but should be caught by BonsaiTree guard (per B-1).

**Fix:** Add 3-5 additional boundary test cases. Target ~40-42 total.

### A-6: Replay attack vector not addressed (SECURITY FRAMING)

**What:** The spec focuses on parameter validation but does not address duplicate care log entries. A client POSTs `{ type: "wire", branchId: 1, angleDelta: 10 }` legitimately, then replays the identical request. The server inserts a duplicate. CareLogReplay applies the wire twice, producing a different tree than what the user sees client-side.

This is out of scope for the guard sweep, but should be documented as an OPEN RISK. The server has no deduplication mechanism for care log entries within the same game day.

**Fix:** Add a "NOT IN SCOPE — documented risks" section listing: (1) duplicate action deduplication, (2) action ordering within a day, (3) care log entry count limits per day.

---

## DECISION ON OPTION A vs OPTION B (CareLogReplay bypass)

The architect recommends **Option A** (add guards to static engine methods) over Option B (reroute CareLogReplay through BonsaiTree). **AGREED.** Option A is correct:

1. Defense-in-depth: guards at both layers catch bugs regardless of call path
2. Minimal diff: 3-5 lines per static method vs refactoring CareLogReplay routing
3. No behavioral change: CareLogReplay's direct-call pattern is intentional (DECISIONS.md 2026-07-17)

---

## IMPLEMENTATION ORDER REVIEW

The spec says: server-side first → BonsaiTree → static engines → tests.

**AGREED.** Server-side first is correct because:
- It's the trust boundary — malicious data enters here
- Engine guards are defense-in-depth; server guards are the primary gate
- If server validation ships before engine guards, the system is partially protected
- The reverse order leaves the server wide open while engine guards are added

---

## FINAL VERDICT

**APPROVED WITH CHANGES** — fix B-1, B-2, B-3 before implementation. Advisories A-1 through A-6 are recommended improvements.

The architect's spec is thorough, accurate, and correctly identifies the highest-priority security gap (server-side zero-validation trust boundary). The implementation order (server first, then BonsaiTree, then static engines) is correct. The canonical guard pattern is sound. The CareLogReplay bypass finding is real and the Option A recommendation is correct.

**Fix the 3 blockers, then ship to implementer.**
