# Lint Gate: Cost & Consumable Parameter Validation Guard Sweep
**Date:** 2026-09-19
**Linter:** Final gate (Carmack-Linus persona, engineering-craft-standard)
**Spec:** docs/pipeline/ARCH-COST-GUARDS-2026-09-19.md
**Critic:** docs/pipeline/CRITIC-COST-GUARDS-2026-09-19.md
**Audit:** docs/pipeline/AUDIT-COST-GUARDS-2026-09-19.md

---

## VERDICT: SHIP IT — 0 BLOCKERs, 3 WARNINGs, 4 NITPICKs

The guard sweep implementation is clean, consistent, and correct. All 10 previously-vulnerable parameters are guarded at the engine layer. All 7 server-side numeric fields are validated with a fail-closed pattern. The CareLogReplay bypass paths are protected with defense-in-depth guards in static engines. The 44-case test file covers all spec-mandated gates (GUARD-1..GUARD-24, GUARD-S1..GUARD-S13) plus boundary cases (A-4, A-5, EXT-1..EXT-3, fail-closed).

No issues found that would allow corrupt data to enter care_log or bypass validation. The remaining warnings are test hygiene and dead code — none affect security or correctness.

---

## ISSUES

### WARNING-1: Server-side test logic is a replicated copy, not imported (DRIFT RISK)

**File:** `packages/engine/test/cost-guards.test.js` L230-323
**What:** The test file replicates all 6 server validation helpers (`requireFinite`, `requireNonNegInt`, `requirePositiveFinite`, `requirePositiveInt`, `requireIntRange`, `requireBranchId`) and the full `SCHEMAS` object verbatim from `care-action/index.ts` L33-128. These are independent copies.

**Why it matters:** If someone changes a validation rule in the server (e.g., adjusts `SERVER_MAX_BRANCH_ID` from 10000 to 5000, or tightens a range), the test replica stays on the old logic. Tests pass against stale rules while the real server enforces different ones. This is the classic "tests that test themselves" anti-pattern.

**Mitigated by:** The Deno vs Node.js boundary makes direct import impossible. The test file's L225-229 comment acknowledges this.

**Fix:** Add a sync marker comment at the top of both the server helpers block and the test replica:
```
// SYNC-MARKER: these helpers are replicated in packages/engine/test/cost-guards.test.js
// If you change validation logic here, update the test replica too.
```
And the inverse in the test file. Low effort, prevents surprise drift.

**Compared to trusted pattern:** SageStarCodes Guard Patterns (`wiki/patterns/SageStarCodes/guards-and-checks.md`) — validation logic in SageStarCodes is always tested via the same module that runs in production, not a copy. The Deno/Node split is a valid excuse, but the drift risk is real.

### WARNING-2: No engine-level test for water() CareLogReplayError (B-3 fix untested)

**File:** `packages/engine/test/cost-guards.test.js` — missing
**What:** The B-3 fix changed `BonsaiTree.water()` from throwing plain `Error` to throwing `CareLogReplayError` (BonsaiTree.ts L166-169). No engine-level test verifies this. GUARD-S1/S2/S3 test the *server-side* water validation, but those use replicated helpers that throw plain `Error`, not `CareLogReplayError`.

**Why it matters:** The whole point of B-3 was error type consistency — callers catching `CareLogReplayError` would miss a plain `Error`. If someone regresses B-3 (changes back to `Error`), no test catches it. This is the auditor's AB-2 partial gap.

**Fix:** Add 3 tests:
```javascript
test('GUARD-W1: water(NaN) → throws CareLogReplayError', () => {
  assertGuardThrows(() => freshTree().water(NaN), 'GUARD-W1');
});
test('GUARD-W2: water(-5) → throws CareLogReplayError (negative)', () => {
  assertGuardThrows(() => freshTree().water(-5), 'GUARD-W2');
});
test('GUARD-W3: water("hello") → throws CareLogReplayError (string)', () => {
  assertGuardThrows(() => freshTree().water(/** @type {any} */ ('hello')), 'GUARD-W3');
});
```

### WARNING-3: PruneEngine L41 redundant `branchId < 0` check (dead branch)

**File:** `packages/engine/src/PruneEngine.ts:41`
**What:** `if (branchId < 0 || branchId >= branches.length) return false;` — the `branchId < 0` condition is unreachable. L33-37 already throws `CareLogReplayError` for negative values. This was pre-existing code that should have been cleaned up when the guard was added.

**Why it matters (Linus lens):** Dead conditionals are lies to the reader. Someone reading L41 thinks "ah, negative branchId returns false" — but it actually throws 8 lines above. The reader forms a wrong mental model of the control flow. Carmack would call this a maintenance hazard.

**Fix:** Change L41 to:
```typescript
if (branchId >= branches.length) return false;
```

**Compared to trusted pattern:** dwi GiftingContract Guards (`wiki/patterns/dwi/gifting-guards.md`) — dwi's `validGift` modifier has exactly one check per condition, no redundancy. Clean and readable.

---

### NITPICK-1: Static engine guards lack upper-bound check (inconsistency)

**Files:** `WireEngine.ts:70`, `WireEngine.ts:143`, `PruneEngine.ts:33`
**What:** Static engine guards check `branchId < 0` but NOT `branchId >= branches.length`. BonsaiTree's `_guardBranchId` does check the upper bound. The `!b` check on array access catches `undefined` from out-of-range, so the system is safe. But the defense-in-depth is incomplete at the static layer — out-of-range values get a silent no-op (`return false` / `return void`) instead of a `CareLogReplayError` throw.

**Impact:** None in practice — BonsaiTree layer catches it first in live path, server layer caps at 10000. Only affects hypothetical direct calls to static methods with bad data, which would silently skip instead of throwing. Auditor flagged as F-3.

### NITPICK-2: `landscape` server validator passes data through unvalidated

**File:** `care-action/index.ts:124-127`
**What:** `elementType` and `position` are passed through without type checking or range validation. This is acceptable because `landscape` is gated (not in `ALLOWED_ACTION_TYPES`), but when it's unblocked, position should get `requireIntRange(0, 255)` per axis at the server layer. Auditor flagged as F-1.

### NITPICK-3: `deno-lint-ignore no-explicit-any` comment could be more specific

**File:** `care-action/index.ts:80`
**What:** The lint suppression is justified (incoming HTTP JSON is genuinely untyped), and the preceding comment (L78-79) explains the design. However, the suppression itself has no inline rationale. A `// incoming JSON is untyped by nature` suffix would help future readers.

### NITPICK-4: DECISIONS.md not updated with decision record

**File:** `DECISIONS.md` — missing append
**What:** The architect spec includes a decision record (ARCH-COST-GUARDS-2026-09-19.md L393-419) that should be appended to DECISIONS.md. The auditor flagged this as F-2. Still not done.

---

## LINT CHECKLIST RESULTS

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 1 | Code style consistency | PASS | All guards follow canonical pattern. `_guardBranchId` used uniformly for branchId in BonsaiTree. Server helpers are consistent. Error messages all include `(got ${val})`. |
| 2 | Import correctness | PASS | `CareLogReplayError` imported in BonsaiTree.ts, WireEngine.ts, PruneEngine.ts. Exported from `index.ts` via CareLogReplay.ts re-export. Test imports from `../dist/index.js`. Server correctly uses plain `Error` (HTTP boundary, not replay). |
| 3 | Dead code | WARNING-3 | PruneEngine L41 `branchId < 0` is redundant (already thrown at L33). No commented-out code, no debug statements, no console.log/debug anywhere. |
| 4 | Comment quality | PASS | Comments explain WHY, not WHAT. Spec references cited: B-1, B-2, B-3, A-1, A-2, A-3, GAP-3, GAP-4, CEI ordering. `_guardBranchId` JSDoc explains the contract. Server validation block comments reference trust boundary and CEI ordering. |
| 5 | Test quality | WARNING-1, WARNING-2 | 44 test cases covering all mandated gates + boundary cases. `assertGuardThrows` properly checks `instanceof CareLogReplayError`. BUT: server tests use replicated logic (drift risk), and B-3 fix (water CareLogReplayError) has no engine-level test. |
| 6 | Edge cases auditor missed | NONE | Auditor was thorough. F-1, F-2, F-3, F-4, A-4 all correctly identified. No additional bypass paths found. |
| 7 | Server validator completeness | PASS | All 10 ALLOWED_ACTION_TYPES have SCHEMAS entries. `jin` and `landscape` have stubs for Phase 2. Fail-closed pattern at L211-213 catches any mismatch. `rotate` and `fertilize` correctly validate to empty objects. |
| 8 | Type safety | PASS | Zero `as any` casts in implementation code. One justified `deno-lint-ignore no-explicit-any` for incoming JSON type. Test uses `/** @type {any} */` JSDoc casts only for type-coercion boundary tests. |
| 9 | Naming | PASS | `_guardBranchId` (private helper), `requireXxx` (server validators), `cleanActionData` (stripped payload), `SERVER_MAX_BRANCH_ID` (constant). Error messages consistent: `"methodName: paramName must be X (got Y)."` |
| 10 | Second Brain pattern comparison | PASS | See comparisons below. |

---

## TRUSTED DEVELOPER PATTERN COMPARISONS

### 1. Proof of Play Token Guards (`wiki/patterns/proof-of-play/token-guards.md`)
- **PoP standard:** Every transfer, ownership check, and balance check goes through explicit guards. Validates ALL parameters including log-only ones.
- **Kijo comparison:** All 17 catalog entries guarded (15 fully, 1 intentionally unguarded at runtime — elementType — and 1 pre-existing — position). `storedDegradeDays` (log-only replay parameter) validated with range check [0, 20]. **Matches PoP rigor.**

### 2. dwi GiftingContract Guards (`wiki/patterns/dwi/gifting-guards.md`)
- **dwi standard:** `validGift` modifier — validate before ANY state mutation. Triple-check (code-length + ERC-165 + zero-address) on critical references.
- **Kijo comparison:** `_guardBranchId` checks 4 conditions (isFinite, >= 0, isInteger, < branches.length) — exceeds dwi's triple-check. CEI ordering at server layer: validation (L207-223) → tick (L246) → insert (L299) → decrement (L313). **Matches dwi CEI discipline.**

### 3. SageStarCodes Guard Patterns (`wiki/patterns/SageStarCodes/guards-and-checks.md`)
- **SageStarCodes standard:** Mode-based parameter validation with type checking and descriptive error messages.
- **Kijo comparison:** `SCHEMAS` object is mode-based (per action type). Each validator returns a clean object (field stripping). Error messages are descriptive with value echo. **Matches SageStarCodes pattern.**

### 4. truongnguyenptn Pre-Deployment Checklist (`wiki/patterns/truongnguyenptn/ronin-security.md`)
- **truongnguyenptn standard:** "Input validation on all external functions" as a mandatory pre-deployment gate.
- **Kijo comparison:** care-action Edge Function (the external entry point) now validates all numeric fields before any DB mutation. Fail-closed for unknown types. Field stripping prevents payload injection. **Satisfies the checklist item.**

### 5. dwi updateController Triple-Check (defense-in-depth)
- **dwi standard:** Three-layer validation before updating a critical reference.
- **Kijo comparison:** Three validation layers for prune/wire/wire-remove: (1) server `requireBranchId`, (2) BonsaiTree `_guardBranchId`, (3) static engine guards. Other action types have two layers (server + BonsaiTree). **Matches or exceeds dwi depth.**

---

## FINAL SUMMARY

### What this code gets right

The implementation demonstrates genuine engineering discipline:

1. **`_guardBranchId` helper** is the single best pattern choice in this sweep. One function, one truth, used by every BonsaiTree method. No copy-paste, no drift risk at the engine layer.

2. **Server validators return clean objects** instead of mutating input. This is the right design — constructive validation produces a provably-clean payload. Unknown fields die by omission, not by explicit deletion.

3. **Fail-closed server pattern** (`if (!validator) return 400`) is the correct security posture. The architect spec originally had a fail-open suggestion; the critic caught it (B-2), and the implementer did the right thing.

4. **CEI ordering** is preserved — validation before tick, tick before insert, insert before decrement. The comment at L297 explicitly calls out "uses cleanActionData, NOT raw action fields."

5. **Error messages are excellent** — every one includes the method name, the constraint violated, and the actual value. When this throws at 3am in a replay failure, the operator knows exactly what happened.

### Required fixes before shipping (WARNINGs)

| # | Fix | Effort | Impact |
|---|-----|--------|--------|
| W-1 | Add SYNC-MARKER comments linking server helpers and test replicas | 5 min | Prevents silent drift |
| W-2 | Add 3 water() CareLogReplayError tests (GUARD-W1/W2/W3) | 10 min | Covers B-3 regression |
| W-3 | Remove redundant `branchId < 0` from PruneEngine L41 | 1 min | Eliminates dead branch |

### Optional improvements (NITPICKs — do at leisure)

| # | Fix | Effort |
|---|-----|--------|
| N-1 | Add upper-bound to static engine guards for consistency | 15 min |
| N-2 | Add position validation to landscape server validator stub | 15 min |
| N-3 | Add inline rationale to `deno-lint-ignore` | 1 min |
| N-4 | Append decision record to DECISIONS.md | 5 min |

---

*Lint conducted using carmack-linus-review, engineering-craft-standard, and second-brain skill protocols. Trusted developer patterns consulted: PoP token-guards, dwi gifting-guards, SageStarCodes guards-and-checks, truongnguyenptn ronin-security. All comparisons cited with wiki paths above.*
