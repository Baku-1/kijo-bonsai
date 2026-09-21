# Audit: Cost & Consumable Parameter Validation Guard Sweep
**Date:** 2026-09-19
**Auditor:** Adversarial Auditor (Carmack-Linus persona, engineering-craft-standard)
**Spec:** docs/pipeline/ARCH-COST-GUARDS-2026-09-19.md
**Critic:** docs/pipeline/CRITIC-COST-GUARDS-2026-09-19.md

---

## VERDICT: CONDITIONAL PASS — 2 BLOCKERS remain

The implementation work on the guard logic itself is **solid and correct**. Server-side validators, BonsaiTree guards, and static engine method guards all match the spec patterns. All 3 critic blockers (B-1, B-2, B-3) are addressed in the code. Advisory items A-1, A-2, A-3 are implemented. The code quality is high — fail-closed server pattern, field stripping via clean object return, `_guardBranchId` helper with upper bound on `branches.length`.

**However, there are 2 BLOCKERS that prevent full PASS:**

| # | Blocker | Severity |
|---|---------|----------|
| AB-1 | **tsc --noEmit never ran** — sandbox mount failure; compilation NOT verified | BLOCKER |
| AB-2 | **ZERO test files created** — GUARD-1 through GUARD-S13 do not exist anywhere in the repo | BLOCKER |

These are not minor gaps. The spec mandates 37 test gate cases. Zero were written. The implementer acknowledged tsc could not run but the auditor cannot verify compilation either (same sandbox issue). Until tsc passes and all 37 test gates exist and pass, this work cannot be accepted.

---

## CLAIMS CHECKED

### Layer 2: Server-side (care-action/index.ts)

```
✓ CLAIM: fail-closed validators with per-type field allowlists
  OBSERVED: care-action/index.ts L211-213: `if (!validator) return json({error:...}, 400);`
  This is the fail-closed pattern (B-2). VERIFIED.

✓ CLAIM: unknown field stripping (A-2)
  OBSERVED: Each SCHEMAS entry returns a NEW clean object with ONLY known fields.
  L84: `water: (d) => ({ amount: requirePositiveFinite(d.amount, 'amount') })`
  L217: `const { type: _actionType, ...rawActionData } = action;`
  L220: `cleanActionData = validator(rawActionData);`
  L303: `p_action_data: cleanActionData` — uses the stripped object, NOT raw action.
  VERIFIED. Excellent implementation — returns clean objects rather than mutating input.

✓ CLAIM: helper functions (requireFinite, requireBranchId, requireIntRange, etc.)
  OBSERVED: L33-76. All 6 helpers present. All use `typeof val !== 'number'` check
  (stronger than spec's `!Number.isFinite()` — catches string inputs at server boundary).
  requireBranchId has hard upper bound SERVER_MAX_BRANCH_ID = 10000 (B-1 server fix).
  VERIFIED.

✓ CLAIM: degradeDays capped at 20 (A-3)
  OBSERVED: L103: `requireIntRange(d.degradeDays, 0, 20, 'degradeDays')`. VERIFIED.

✓ CLAIM: CEI ordering — validation BEFORE any DB mutation
  OBSERVED: Validation at L207-223, before lazy tick (L246) and insert (L299). VERIFIED.

✓ CLAIM: landscape validator present
  OBSERVED: L124-127. Passes elementType and position through without numeric validation.
  NOTE: This is a Phase 2 stub — landscape is not in ALLOWED_ACTION_TYPES.
  Position validation happens in BonsaiTree.addLandscape (integer [0,255] check).
  ACCEPTABLE for Phase 1, but server-side position validation should be added
  when landscape is unblocked.
```

### Layer 1: BonsaiTree.ts

```
✓ CLAIM: _guardBranchId helper with upper bound
  OBSERVED: L33-44. Checks: !isFinite, < 0, !isInteger, >= branches.length.
  Includes B-1 upper bound. Throws CareLogReplayError with descriptive message.
  VERIFIED. Clean implementation — single helper used by all methods.

✓ CLAIM: water() throws CareLogReplayError (B-3)
  OBSERVED: L166-169. `throw new CareLogReplayError(...)` — NOT plain Error.
  VERIFIED. B-3 is fixed.

✓ CLAIM: wire() guards
  OBSERVED: L188: `this._guardBranchId('wire', branchId)` + L189-193: angleDelta
  isFinite guard with CareLogReplayError. VERIFIED.

✓ CLAIM: removeWire() guard
  OBSERVED: L214: `this._guardBranchId('removeWire', branchId)`. VERIFIED.

✓ CLAIM: applyTwine() guards
  OBSERVED: L225: _guardBranchId. L226-229: angleDelta isFinite.
  L232-237: storedDegradeDays — isFinite + >= 0 + isInteger + <= 20 (A-3). VERIFIED.

✓ CLAIM: removeTwine() guard
  OBSERVED: L248: _guardBranchId. VERIFIED.

✓ CLAIM: applyWeight() guards
  OBSERVED: L258: _guardBranchId. L259-268: weightCount full canonical pattern.
  VERIFIED.

✓ CLAIM: removeWeight() guard
  OBSERVED: L278: _guardBranchId. VERIFIED.

✓ CLAIM: prune() guard
  OBSERVED: L327: _guardBranchId. VERIFIED.

✓ CLAIM: applyJin() guards (pre-existing)
  OBSERVED: L288-298. branchId via _guardBranchId, segmentIndex + jinCost
  canonical pattern. VERIFIED (was already guarded, now uses _guardBranchId).
```

### Layer 1b: Static Engine Methods

```
✓ CLAIM: WireEngine.wire() guards added
  OBSERVED: WireEngine.ts L70-78.
  branchId: isFinite + >= 0 + isInteger → throws CareLogReplayError. VERIFIED.
  angleDelta: isFinite → throws CareLogReplayError (A-1 — throws, not return ok:false). VERIFIED.

✓ CLAIM: WireEngine.removeWire() guard
  OBSERVED: WireEngine.ts L143-147. branchId: isFinite + >= 0 + isInteger →
  throws CareLogReplayError. VERIFIED.

✓ CLAIM: PruneEngine.prune() guard
  OBSERVED: PruneEngine.ts L33-37. branchId: isFinite + >= 0 + isInteger →
  throws CareLogReplayError. VERIFIED.
  NOTE: L41 has redundant `branchId < 0` check (was pre-existing). Harmless.
```

### CareLogReplay Bypass Path Check

```
✓ VERIFIED: prune path (CareLogReplay.ts L119) calls PruneEngine.prune() directly.
  PruneEngine.prune() now has its own guard at L33-37. PROTECTED.

✓ VERIFIED: wire path (CareLogReplay.ts L121) calls WireEngine.wire() directly.
  WireEngine.wire() now has its own guard at L70-78. PROTECTED.

✓ VERIFIED: wire-remove path (CareLogReplay.ts L125) calls WireEngine.removeWire() directly.
  WireEngine.removeWire() now has its own guard at L143-147. PROTECTED.

✓ VERIFIED: All other paths (twine, twine-remove, weight, weight-remove, jin, water)
  route through tree.applyXxx() methods which all have _guardBranchId. PROTECTED.

  CONCLUSION: No unguarded bypass paths remain.
```

---

## UNVERIFIABLE CLAIMS

```
? CLAIM: tsc --noEmit passes
  REASON: Sandbox mount failure (known Windows issue affecting Plan9 shares).
  The implementer also reported being unable to run tsc. Neither party has
  verified compilation. This is BLOCKER AB-1.

? CLAIM: Tests GUARD-1 through GUARD-S13 pass
  REASON: No test files exist. Zero test files were created for the guard sweep.
  Searched: *guard*test*, test_guard*, test_cost*, test_care_action*, GUARD-1 in all
  files under packages/. BLOCKER AB-2.
```

---

## INTENT CHECK

```
INTENT CHECK (Layer 2: Server)
  code does:     Fail-closed per-type validation, strips unknown fields, rejects unlisted types
  check expects: (no test exists)
  spec says:     Per-type SCHEMAS with fail-closed pattern, strip unknown fields, CEI ordering
  verdict:       ALIGNED (code matches spec; tests missing)

INTENT CHECK (Layer 1: BonsaiTree)
  code does:     _guardBranchId with upper bound, CareLogReplayError on all guards including water()
  check expects: (no test exists)
  spec says:     Canonical guard pattern on all branchId params, CareLogReplayError everywhere
  verdict:       ALIGNED (code matches spec; tests missing)

INTENT CHECK (Layer 1b: Static Engines)
  code does:     Guards in WireEngine.wire/removeWire and PruneEngine.prune throw CareLogReplayError
  check expects: (no test exists)
  spec says:     Defense-in-depth guards on static methods, A-1 mandates throw (not ok:false)
  verdict:       ALIGNED (code matches spec; tests missing)
```

---

## SCOPE CHECK

### Files changed (verified by direct read):

| File | Changed? | Matches spec? |
|------|----------|---------------|
| `apps/server/supabase/functions/care-action/index.ts` | YES | YES — validation block added L30-128, fail-closed at L211-213, cleanActionData at L303 |
| `packages/engine/src/BonsaiTree.ts` | YES | YES — _guardBranchId helper L33-44, guards on wire/removeWire/applyTwine/removeTwine/applyWeight/removeWeight/prune, B-3 water fix |
| `packages/engine/src/WireEngine.ts` | YES | YES — guards on wire() L70-78 and removeWire() L143-147 |
| `packages/engine/src/PruneEngine.ts` | YES | YES — guard on prune() L33-37 |
| Test files (GUARD-1..GUARD-S13) | **NO — NOT CREATED** | **FAIL** |
| DECISIONS.md | **NO — NOT UPDATED** | **MISSING** |

### Files NOT changed (verified no guard-related modifications):
- `packages/engine/src/CareLogReplay.ts` — unchanged (correct: guards go in engines, not replay)
- `packages/engine/src/TwineWeightEngine.ts` — unchanged (correct: guards at BonsaiTree layer)
- `packages/engine/src/JinEngine.ts` — unchanged (correct: already guarded via BonsaiTree.applyJin)

---

## FRAUDS HUNTED

```
weakened tests:   NONE found. Searched all test files under packages/engine/ for skip, xtest,
                  xit, .only, pending, describe.skip. No existing test assertions were
                  changed, removed, or loosened.

false completion: FOUND — No test files were created despite the spec mandating 37 test gate
                  cases (GUARD-1 through GUARD-24 + GUARD-S1 through GUARD-S13). The
                  implementer's claim to have "completed" the work is incomplete — guards
                  were written but tests were not.

intent inversion: NONE found. All guard logic correctly matches spec intent.

phantom evidence: The implementer referenced a Second Brain page at
                  wiki/pipeline/IMPL-COST-GUARDS-2026-09-19.md. This page was NOT found
                  in Second Brain search results. The wiki page
                  wiki/lessons/cost-guard-sweep-2026-09-19.md exists but was written by the
                  architect, not the implementer. PHANTOM EVIDENCE for the wiki claim.
```

---

## PARAMETER CATALOG CROSS-REFERENCE (17 entries)

| # | Parameter | Guard Status | Evidence |
|---|-----------|-------------|----------|
| 1 | water(amount) | ✅ GUARDED | BonsaiTree.ts L166 (B-3 fixed: CareLogReplayError) |
| 2 | wire(branchId) | ✅ GUARDED | BonsaiTree.ts L188 via _guardBranchId |
| 3 | wire(angleDelta) | ✅ GUARDED | BonsaiTree.ts L189 + WireEngine.ts L75 |
| 4 | removeWire(branchId) | ✅ GUARDED | BonsaiTree.ts L214 via _guardBranchId |
| 5 | applyTwine(branchId) | ✅ GUARDED | BonsaiTree.ts L225 via _guardBranchId |
| 6 | applyTwine(angleDelta) | ✅ GUARDED | BonsaiTree.ts L226 (pre-existing + still present) |
| 7 | applyTwine(storedDegradeDays) | ✅ GUARDED | BonsaiTree.ts L232-237 (A-3: <= 20) |
| 8 | removeTwine(branchId) | ✅ GUARDED | BonsaiTree.ts L248 via _guardBranchId |
| 9 | applyWeight(branchId) | ✅ GUARDED | BonsaiTree.ts L258 via _guardBranchId |
| 10 | applyWeight(weightCount) | ✅ GUARDED | BonsaiTree.ts L259-268 (pre-existing, canonical) |
| 11 | removeWeight(branchId) | ✅ GUARDED | BonsaiTree.ts L278 via _guardBranchId |
| 12 | applyJin(branchId) | ✅ GUARDED | BonsaiTree.ts L288 via _guardBranchId |
| 13 | applyJin(segmentIndex) | ✅ GUARDED | BonsaiTree.ts L289-292 (pre-existing) |
| 14 | applyJin(jinCost) | ✅ GUARDED | BonsaiTree.ts L293-297 (pre-existing) |
| 15 | addLandscape(position) | ✅ GUARDED | BonsaiTree.ts L310-317 (pre-existing) |
| 16 | addLandscape(elementType) | ⚠️ UNGUARDED | TypeScript union only, no runtime check. Low priority per spec. |
| 17 | prune(branchId) | ✅ GUARDED | BonsaiTree.ts L327 via _guardBranchId + PruneEngine.ts L33 |

**Result: 15/17 fully guarded, 1 intentionally unguarded (elementType, documented), 1 pre-existing (position). All 10 VULNERABLE parameters from the spec are now guarded.**

### Layer 1b (Static Engine Methods)

| # | Method | Guard Status | Evidence |
|---|--------|-------------|----------|
| 18 | WireEngine.wire(branchId) | ✅ GUARDED | WireEngine.ts L70-73 |
| 19 | WireEngine.wire(angleDelta) | ✅ GUARDED | WireEngine.ts L75-78 (A-1: throws, not ok:false) |
| 20 | WireEngine.removeWire(branchId) | ✅ GUARDED | WireEngine.ts L143-147 |
| 21 | PruneEngine.prune(branchId) | ✅ GUARDED | PruneEngine.ts L33-37 |

**All 4 replay-bypass parameters guarded. Defense-in-depth achieved.**

### Layer 2 (Server-Side)

All 7 vulnerable server-side fields from the spec now validated:

| Field | Validator | Evidence |
|-------|-----------|----------|
| branchId | requireBranchId (0..10000, integer) | care-action/index.ts L71-76 |
| angleDelta | requireFinite | L92, L100 |
| amount | requirePositiveFinite | L85 |
| weightCount | requireIntRange(1,4) | L112 |
| segmentIndex | requireNonNegInt | L119 |
| jinCost | requirePositiveInt | L120 |
| degradeDays | requireIntRange(0,20) | L103 |

---

## BLOCKER B-1/B-2/B-3 VERIFICATION

| Blocker | Status | Evidence |
|---------|--------|---------|
| B-1: Missing upper-bound on branchId | ✅ FIXED | BonsaiTree: `>= this.state.branches.length` (L38). Server: `> SERVER_MAX_BRANCH_ID` (L72, cap=10000). |
| B-2: Fail-closed for unlisted types | ✅ FIXED | `if (!validator) return json({error:...}, 400)` at L212-213. |
| B-3: water() throws plain Error | ✅ FIXED | `throw new CareLogReplayError(...)` at L167-169. |

---

## ADVISORY VERIFICATION

| Advisory | Status | Evidence |
|----------|--------|---------|
| A-1: WireEngine NaN angleDelta throws (not ok:false) | ✅ IMPLEMENTED | WireEngine.ts L75-78: `throw new CareLogReplayError(...)` |
| A-2: Strip unknown fields via allowlists | ✅ IMPLEMENTED | Each SCHEMAS entry returns clean object. L303 uses cleanActionData. |
| A-3: storedDegradeDays upper bound of 20 | ✅ IMPLEMENTED | BonsaiTree.ts L233: `> 20`. Server L103: `requireIntRange(0, 20)`. |
| A-4: -0 behavior documented | ❌ NOT DONE | No documentation of -0 behavior found in source or tests. |
| A-5: Additional boundary test cases | ❌ NOT DONE | No test files created at all. |
| A-6: Replay attack vector documented | ❓ NOT CHECKED | Out of scope for this sweep per spec. |

---

## TRUSTED DEVELOPER PATTERN COMPARISON

### Patterns consulted (from Second Brain wiki):

1. **Proof of Play Token Guards** (`wiki/patterns/proof-of-play/token-guards.md`)
   - PoP pattern: validate ALL parameters including log-only ones.
   - Kijo comparison: ✅ All numeric parameters now guarded at both engine and server layers. storedDegradeDays (log-only replay parameter) is validated with range check.

2. **dwi GiftingContract Guards** (`wiki/patterns/dwi/gifting-guards.md`)
   - dwi pattern: `validGift` modifier — validate before ANY state mutation. Triple-check on critical references.
   - Kijo comparison: ✅ Server validation runs before lazy tick (CEI ordering). BonsaiTree._guardBranchId checks 4 conditions (isFinite, >= 0, isInteger, < branches.length) — analogous to dwi's triple-check.

3. **SageStarCodes Guard Patterns** (`wiki/patterns/SageStarCodes/guards-and-checks.md`)
   - SageStarCodes pattern: Mode-based parameter validation with type checking and descriptive error messages.
   - Kijo comparison: ✅ Per-type SCHEMAS at server layer is the same mode-based approach. Each action type has its own field requirements. Error messages include the invalid value (`got ${val}`).

4. **truongnguyenptn Pre-Deployment Checklist** (referenced in architect spec)
   - Pattern: "Input validation on all external functions" as a pre-deployment gate.
   - Kijo comparison: ✅ care-action Edge Function (the external entry point) now validates all fields before DB mutation.

5. **dwi updateController Triple-Check** (referenced in architect spec)
   - Pattern: Three-layer validation (code-length + ERC-165 + zero-address) before critical state update.
   - Kijo comparison: ✅ Defense-in-depth: server validates → BonsaiTree validates → static engine validates. Three layers for the replay-bypass actions (prune/wire/wire-remove).

---

## ADDITIONAL FINDINGS

### F-1: `landscape` server validator does not validate `position` (LOW)

care-action/index.ts L124-127 passes `position` through without any numeric validation:
```typescript
landscape: (d) => ({
  elementType: d.elementType,
  position: d.position,
}),
```

Since `landscape` is not in ALLOWED_ACTION_TYPES (gated), this is not currently exploitable. But when landscape is unblocked, position should be validated at the server layer (integer, [0,255] per axis). BonsaiTree.addLandscape has the guard, but defense-in-depth requires server-side too.

**Severity:** LOW (not reachable until landscape is unblocked)

### F-2: DECISIONS.md not updated

The spec's decision record was not appended to DECISIONS.md. This is a documentation gap, not a security issue.

### F-3: Static engine guards lack upper-bound check (MINOR)

WireEngine.wire/removeWire and PruneEngine.prune check `branchId < 0` but do NOT check `branchId >= branches.length`. BonsaiTree._guardBranchId does check this, so the double-guard at BonsaiTree layer catches out-of-range values before they reach static methods. The `!b` check in the engines catches `undefined` from array access.

This means out-of-range branchId in replay triggers the `!b` silent no-op path (return false / return void) rather than throwing CareLogReplayError. For replay, corrupt branchId data should arguably throw rather than silently skip. However, the BonsaiTree guard prevents this in the live path, and corrupted care_log data entering the DB is prevented by server-side requireBranchId.

**Severity:** MINOR — defense-in-depth gap, not exploitable in practice.

### F-4: PruneEngine redundant negative check (TRIVIAL)

PruneEngine.ts L41: `if (branchId < 0 || branchId >= branches.length) return false;`

The `branchId < 0` check is redundant — L33 already throws on negative values. Harmless but indicates the pre-existing code was not cleaned up after the guard was added.

---

## FINAL VERDICT

### CONDITIONAL PASS

**The guard logic itself is correct, thorough, and matches the spec.** All 3 critic blockers (B-1, B-2, B-3) are properly fixed. All 10 previously-vulnerable parameters are now guarded. The CareLogReplay bypass paths are protected with defense-in-depth guards. The server-side fail-closed pattern with field stripping is excellent work.

**Two blockers prevent full PASS:**

1. **AB-1: tsc --noEmit must pass.** Neither implementer nor auditor could run the TypeScript compiler due to sandbox issues. Someone must verify this on a working machine.

2. **AB-2: Test files GUARD-1 through GUARD-S13 must be written and pass.** The spec mandates 37 test gate cases. Zero were created. This is the single largest gap in the implementation.

### Required fixes before PASS:

| # | Fix | Effort |
|---|-----|--------|
| AB-1 | Run `npx tsc --noEmit` from both `packages/engine` and `apps/server` and verify exit 0 | 5 min |
| AB-2 | Create test files for GUARD-1..GUARD-24 (engine) and GUARD-S1..GUARD-S13 (server) | ~2 hours |
| F-2 | Append decision record to DECISIONS.md | 5 min |

### Optional improvements (not blocking):

| # | Fix | Effort |
|---|-----|--------|
| A-4 | Document -0 behavior in a test case | 10 min |
| F-1 | Add position validation to landscape server validator | 15 min |
| F-3 | Add upper-bound to static engine guards for replay-path consistency | 15 min |

---

*Audit conducted using adversarial-auditor, carmack-linus-review, and engineering-craft-standard skill protocols. Trusted developer patterns from Second Brain wiki consulted: PoP token-guards, dwi gifting-guards, SageStarCodes guards-and-checks, truongnguyenptn ronin-security (referenced via architect spec).*
