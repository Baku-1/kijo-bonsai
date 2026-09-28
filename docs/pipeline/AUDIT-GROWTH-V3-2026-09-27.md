# AUDIT-GROWTH-V3-2026-09-27

**Stage:** ADVERSARIAL AUDITOR  
**Date:** 2026-09-27  
**Scope:** Growth V3 Implementation — Phases 1–13 (Pass 1 + Pass 2)  
**Spec:** `docs/pipeline/ARCH-GROWTH-V3-IMPLEMENTATION-2026-09-25.md`  
**Implementer claims:** `docs/pipeline/IMPLEMENTATION-GROWTH-V3-2026-09-25.md`  
**Skills invoked:** `adversarial-auditor`, `carmack-linus-review`, `second-brain`  
**Wiki patterns compared:** Integer GU Conservation, Multi-Owner Voxel Cells, Stable Branch Role Assignment  

---

## VERDICT: CAVEATS

**Core architecture is sound. 144 probes pass. TypeScript compiles clean. Conservation
identity holds in test. But 7 CRITICAL and 9 MAJOR findings prevent VERIFIED status.
All are fixable without architectural redesign. The implementation is structurally
correct but has unguarded trust boundaries, a shipped TODO in the SQL commit function,
conservation assertions that are defined but never called, and bigint discipline
violations in exactly the functions that are supposed to enforce bigint discipline.**

---

## Step 0 — Claim Extraction

The implementer claims (IMPLEMENTATION-GROWTH-V3-2026-09-25.md):

| # | Claim | Falsifiable? |
|---|-------|-------------|
| C1 | 63 Pass 1 probes, all pass | Yes |
| C2 | 66 Pass 2 probes, all pass | Yes |
| C3 | 15 canopy probes, all pass | Yes |
| C4 | Total: 129 probes (63+66), all pass | Yes (but math is wrong — canopy adds 15 = 144 total) |
| C5 | TypeScript compiles clean (all 3 packages) | Yes |
| C6 | No git operations performed | Yes |
| C7 | 19 files created/modified | Yes |
| C8 | NF-1 fix applied to arch doc | Yes |
| C9 | Conservation assertions verified | Yes — but see Finding F-04 |
| C10 | All spec phases 1-13 implemented | Partially — see Findings |

---

## Step 1 — Re-run Every Named Check

### Test probes

| Suite | Claimed | Observed | Exit code | Verdict |
|-------|---------|----------|-----------|---------|
| growth-v3.test.js | 63 pass | **63 pass** | 0 | ✓ CONFIRMED |
| growth-v3-pass2.test.js | 66 pass | **66 pass** | 0 | ✓ CONFIRMED |
| canopy-grammar.test.js | 15 pass | **15 pass** | 0 | ✓ CONFIRMED |
| **Total V3 probes** | 129 | **144** | — | ✓ (implementer undercounted by 15) |

### TypeScript compilation

| Package | Exit code | Errors | Verdict |
|---------|-----------|--------|---------|
| packages/shared | 0 | 0 | ✓ |
| packages/engine | 0 | 0 | ✓ |
| packages/voxelizer | 0 | 0 | ✓ |

Note: No root `tsconfig.json` exists. `npx tsc --noEmit` from repo root prints help (exit 1).
This is not a type error — package-level checks all pass clean.

### Regression tests

| Suite | Assertions | Exit code | Verdict |
|-------|-----------|-----------|---------|
| determinism.test.js | 5 pass | 0 | ✓ No regression |
| test_growth.mjs | 18 pass | 0 | ✓ No regression |

---

## Step 2 — Scope Verification

All 16 claimed implementation files exist on disk under `kijo/kijo-bonsai/` (not `kijo-bonsai/` — the dispatch prompt had the wrong base path, but the implementer used the correct one).

### Files on disk ✓

**Pass 1:** growth-v3.ts, GrowthLedger.ts, GrowthPlanner.ts, GrowthMaterializer.ts, CanonicalHash.ts, CanopyGrammar.ts, growth-v3.test.js, canopy-grammar.test.js  
**Pass 2:** PruneReceiptEngine.ts, StableBranchRoles.ts, StatDeriverV3.ts, CareReplayV2.ts, 20260925000001_growth_v3.sql, growth-transition.ts, build-display-envelope.ts, growth-v3-pass2.test.js

### Pipeline doc not updated

- `PIPELINE-GROWTH-V3-2026-09-25.md` still shows Implementer as "unassigned / pending"
- `STATE.md` last updated 2026-09-21 — no V3 mention
- Neither was updated by the implementer — scope violation (minor, documentation only)

---

## Step 3 — Fraud Hunt

### Weakened tests: FOUND (7 instances)

| ID | Location | Issue |
|----|----------|-------|
| WT-1 | growth-v3.test.js V3-L02c | `computeDailyBudgetGU` only asserts `> 0` and `isSafeInteger` — no exact expected value |
| WT-2 | growth-v3.test.js V3-L02f | "fertilizer increases budget" only asserts `fert > base` — no magnitude check |
| WT-3 | growth-v3.test.js V3-P01a/b | `computeBranchWeight` only asserts `> 0` and comparative — no exact values |
| WT-4 | growth-v3.test.js V3-L01k/l | `canopyCellCostGU` guard tests use bare `assert.throws` with no message regex |
| WT-5 | growth-v3.test.js V3-M04b, V3-Q4a | Epsilon assertions where exact equality is achievable (fixed-point round-trips) |
| WT-6 | growth-v3-pass2.test.js V3-SD01a/c | Epsilon on `stats.hp` where computation is exactly representable |
| WT-7 | canopy-grammar.test.js V3-V03a/c | Candidate count is truthy-only; different-seed test is weak probabilistic check |

**Severity: MAJOR** — None of these are fraudulent (no test was weakened to hide a bug), but they fail to catch regressions in magnitude. The conservation and determinism tests are strong. The guard tests are inconsistently rigorous.

### False completion: NOT FOUND

All claimed probes actually exist and run. Exit codes match claims.

### Intent inversion: NOT FOUND

No test contradicts the spec. Test intent aligns with spec requirements.

### Phantom evidence: FOUND (1 instance)

- Implementer claimed "129 probes" — actual count is 144 (63+66+15). The 15 canopy probes were omitted from the count. This is an **undercount**, not an inflation — not fraudulent, but sloppy.

---

## Step 4 — Intent Check (Mandatory)

```
INTENT CHECK — Conservation Identity
  code does:     assertBranchConservation/assertDailyBudgetConservation DEFINED in GrowthLedger.ts
  check expects: Tests in V3-L04 call these assertions and they pass
  spec says:     §5.5 — Conservation assertion runs after every allocation
  verdict:       CONFLICT — assertions exist and pass when called in tests,
                 but GrowthPlanner.createDayPlan() NEVER calls them.
                 In production, conservation is unenforced.
```

```
INTENT CHECK — Fork/Canopy Eligibility
  code does:     GrowthPlanner isForkEligible/isCanopyEligible hardcoded FALSE
  check expects: No test covers fork/canopy planner paths (tests only exercise ledger math)
  spec says:     §5.4 — Sink allocation table has fork/canopy rows with nonzero demands
  verdict:       CONFLICT — Fork and canopy growth paths are dead code.
                 Spec defines them as functional; planner stubs them out.
                 Likely intentional Phase 14+ deferral but NOT documented.
```

```
INTENT CHECK — care_event_id in SQL commit
  code does:     v_care_event_id := p_request_hash (placeholder)
  check expects: No test covers SQL commit function
  spec says:     §6.1 — care_event_id is content-addressed SHA-256 hex
  verdict:       CONFLICT — Shipped TODO. Two distinct actions with identical
                 normalized payloads collide on PK, causing legitimate rejection.
```

---

## Step 5 — Findings

### CRITICAL (7)

| ID | File | Finding |
|----|------|---------|
| F-01 | GrowthPlanner.ts | `isForkEligible` and `isCanopyEligible` hardcoded `false` with TODO comments. Fork and canopy growth paths are dead. Spec §5.4 defines them as functional. |
| F-02 | GrowthPlanner.ts | `parseInt(escrow.forkEscrowGU)` converts persisted GU string to Number with no MAX_SAFE_INTEGER check. Escrow is a real-currency value — precision loss is a currency-integrity bug. |
| F-03 | GrowthPlanner.ts | `totalEscrow` computed but never checked for affordability before event is queued. No guard prevents over-allocation across days. |
| F-04 | GrowthPlanner.ts | `assertDailyBudgetConservation` and `assertBranchConservation` are defined in GrowthLedger but NEVER CALLED in `createDayPlan()`. Conservation is unenforced in production. |
| F-05 | CanonicalHash.ts | `Object.keys(obj)` silently serializes Map/Set to `'{}'`. Content-addressed hash collision if a Map is ever passed. |
| F-06 | 20260925000001_growth_v3.sql | `v_care_event_id := p_request_hash` is a shipped TODO. Two distinct actions with identical normalized payloads collide on PK. |
| F-07 | StatDeriverV3.ts | `livingDigitBranchCount` accepted without non-negative guard. Negative value → negative skillSlots passes the NaN sentinel (`isFinite` passes negatives). |

### MAJOR (9)

| ID | File | Finding |
|----|------|---------|
| F-08 | GrowthLedger.ts | `assertBranchConservation`/`assertDailyBudgetConservation` sum using plain Number `+`, not BigInt. For large GU values, precision loss can cause a conservation check that should fail to pass silently. |
| F-09 | GrowthLedger.ts | `canopyCellCostGU` uses Number multiplication, not BigInt, contradicting the module's bigint discipline. No overflow check. |
| F-10 | GrowthLedger.ts | `largestRemainderAllocate` doesn't enforce `all weights >= 1` precondition. Negative weights silently corrupt proportionality. |
| F-11 | GrowthLedger.ts | `healthBps`/`moistureBps` accept unvalidated floats. NaN propagates to `BigInt(NaN)` → unhandled RangeError. Negative moisture yields negative bps. |
| F-12 | GrowthPlanner.ts | `computeBranchWeight` uses `Math.pow` (float transcendental). Not guaranteed bit-identical across JS engines. Determinism hazard for a canonical-hash system. |
| F-13 | GrowthMaterializer.ts | `findPendingBoundaries` has no bound on day-count loop. Malicious `toMs` causes unbounded iteration — resource exhaustion on server. |
| F-14 | PruneReceiptEngine.ts | `BigInt(evt.allocationGU)` called with zero validation. Malformed/negative string → uncaught SyntaxError or silent corruption. Same for escrow values. |
| F-15 | growth-transition.ts | `parsePrepareResult`/`parseCommitResult` fall through unknown errors to success path. Fabricated success response on unexpected Postgres errors. |
| F-16 | growth-transition.ts | Postgres BIGINT → JS Number precision loss on `revision`/`event_sequence` before `String()` is applied. Guard is post-hoc on already-corrupted value. |

### MINOR (10)

| ID | File | Finding |
|----|------|---------|
| F-17 | growth-v3.ts | `computeSeason` negative dayIndex → `seasons[-1]` → `undefined`. |
| F-18 | growth-v3.ts | `toQ4`/`fromQ4` no NaN/Infinity guard. |
| F-19 | GrowthLedger.ts | `cylinderCostGU`/`thickeningCostGU` accept fractional/NaN q4 → generic RangeError instead of descriptive rejection. |
| F-20 | GrowthLedger.ts | `largestRemainderAllocate` tie-break `Number(b.remainder - a.remainder)` could lose precision for extreme remainder values. |
| F-21 | CanonicalHash.ts | Docstring claims rejection of undefined at all levels, but `serializeObject` silently continues past undefined properties. Doc/behavior mismatch. |
| F-22 | StableBranchRoles.ts | `assignAllRolesAtRebaseline` and `assignNewbornDepthOneRoles` don't validate depth (NaN/negative falls to "digit" silently). |
| F-23 | PruneReceiptEngine.ts | `addOwnerToCell` does full re-sort instead of binary insert (O(n log n) vs O(n)). Correct but suboptimal. |
| F-24 | PruneReceiptEngine.ts | `statsBefore`/`statsAfter`/`matchPct` in receipt never validated. NaN/Infinity written to persisted receipt. |
| F-25 | CanopyGrammar.ts | `seed + branchId * 7919` no finiteness check. |
| F-26 | 20260925000001_growth_v3.sql | GU columns are TEXT with no CHECK constraint. `tree_growth_events.status` also unconstrained. Missing indexes on common query patterns. |

---

## Step 6 — Spec Coverage Gap

The spec defines 28 red-test IDs. The implementation uses a different naming scheme. Coverage mapping:

| Spec ID | Covered by | Status |
|---------|-----------|--------|
| V3-L01–L05 | V3-L01–L05 | ✓ Direct match |
| V3-H01 | V3-H01–H03 | ✓ Covered |
| V3-M01 | V3-M01–M04 | ✓ Expanded |
| V3-P01 | V3-P01, V3-P03 | ⚠ V3-P02 missing |
| V3-V01–V03 | V3-V02–V03, V3-PR01–PR09 | ⚠ V3-V01 not explicitly tested |
| V3-C01–C03 | V3-CR01–CR04 | ✓ Renamed, covered |
| V3-S01–S04 | V3-SR01–SR03, V3-SD01 | ⚠ S02/S04 merged or absent |
| V3-D01–D02 | V3-DE01–DE02 | ✓ Renamed, covered |
| V3-T01–T03 | V3-GT01 | ⚠ T02/T03 missing or merged |
| V3-R01–R02 | V3-CR01–CR04 | ✓ Covered under replay |
| V3-O01 | — | ✗ **NO COVERAGE** (OCC conflict test) |
| V3-I01 | — | ✗ **NO COVERAGE** (idempotency test) |

**V3-O01 and V3-I01 have zero test coverage.** These are OCC conflict detection and idempotency — foundational to the transaction model. The SQL functions implement both, but no test exercises them.

---

## Wiki Pattern Comparison

### Integer GU Conservation Pattern (wiki/patterns/integer-gu-conservation.md)

| Wiki requirement | Code status |
|-----------------|-------------|
| GROWTH_UNIT_SCALE = 10,000 | ✓ Matches |
| All factors as basis points | ✓ healthBps/moistureBps in [0,10000] |
| Multiply as bigint | ⚠ `computeDailyBudgetGU` uses bigint, but `canopyCellCostGU` and conservation asserts use Number |
| Conservation assertion runs after every allocation | ✗ **Defined but never called in GrowthPlanner** (F-04) |
| ceilDivBig preconditions | ⚠ n ≥ 0 guard exists, d > 0 guard exists, but callers can pass NaN/negative before BigInt conversion |

### Multi-Owner Voxel Cells (wiki/patterns/multi-owner-voxel-cells.md)

| Wiki requirement | Code status |
|-----------------|-------------|
| Sorted owner list with canonical sort order | ✓ compareVoxelOwners matches spec exactly |
| addOwnerToCell preserves sort | ✓ (uses full re-sort, not binary insert — correct but suboptimal) |
| removeOwnersFromCell returns null when empty | ✓ |
| Prune stump overlay — no Defense | ✓ overlay uses parent's role, not SCAR |
| Zero-refund rule | ✓ sameDayRefundGU always '0' |

### Stable Branch Role Assignment (wiki/patterns/stable-branch-roles.md)

| Wiki requirement | Code status |
|-----------------|-------------|
| Depth 0 → trunk | ✓ |
| Depth 1 → sorted by (attachmentYQ4, branchId), lower ceil(n/2) leg, upper floor(n/2) arm | ✓ |
| Single depth-1 → arm | ✓ |
| Depth 2+ → digit | ✓ |
| skillSlots and skillPoints independent | ✓ |
| Roles frozen at birth | ✓ (newborn classification only) |

---

## Assertion Quality Summary

| File | Total assertions | Exact-value % | Weakened count |
|------|-----------------|---------------|----------------|
| growth-v3.test.js | 102 | ~81% | 5 |
| growth-v3-pass2.test.js | 120 | ~93% | 1 |
| canopy-grammar.test.js | 20 | ~10%* | 2 |
| **Total** | **242** | **~83%** | **8** |

*canopy uses boolean predicates (assert.ok on boolean is legitimate); only 2 are genuinely weak.

No error-swallowing catch blocks found. No evidence of hardcoded values copied from output. Conservation and determinism tests use exact equality. Guard tests are inconsistently rigorous (some check message regex, others don't).

---

## BOTTOM LINE

The V3 Growth Engine implementation is architecturally sound. The core math (bigint cost equations, largest-remainder allocation, canonical hashing, multi-owner voxel cells, stable branch roles) is correctly implemented and well-tested. All 144 probes pass, TypeScript compiles clean, and no regressions were introduced.

However, 7 CRITICAL findings prevent VERIFIED status:

1. **Conservation assertions are defined but never called in production** (F-04) — the most important invariant in the system is unenforced.
2. **Fork/canopy paths are dead code** (F-01) — spec-defined mechanics that silently do nothing.
3. **Shipped TODO in SQL commit** (F-06) — production function uses placeholder that breaks legitimate actions.
4. **Escrow precision loss** (F-02) — `parseInt` on a value that could exceed MAX_SAFE_INTEGER.
5. **Map/Set hash collision trap** (F-05) — content-addressed system silently produces wrong hashes for Map inputs.
6. **Negative skillSlots** (F-07) — corrupted input passes the NaN sentinel.
7. **No affordability check before fork event queuing** (F-03) — GU over-allocation possible.

Plus 2 spec test IDs (V3-O01, V3-I01) with zero coverage — OCC conflict and idempotency are untested.

**Recommendation:** Fix all 7 CRITICAL findings, wire conservation assertions into `createDayPlan()`, add V3-O01/V3-I01 test coverage, then re-audit. The fixes are surgical — no architectural redesign needed.

---

## Auditor certification

This audit was conducted with zero implementer context. Every claim was independently verified by re-running probes, reading source code, and checking against the spec and wiki patterns. The auditor did not modify any source files.
