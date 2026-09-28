# Critic Report — Growth V3 Implementation Architecture

Date: 2026-09-25
Spec under review: `docs/pipeline/ARCH-GROWTH-V3-IMPLEMENTATION-2026-09-25.md`
Controlling documents: `ARCH-GROWTH-V3-CONTINUOUS-DISPLAY-2026-09-24.md` (owner-approved), `PREFLIGHT-GROWTH-V3-2026-09-25.md`, `docs/GDD.md`, `kijo-bonsai/DECISIONS.md`
Skills applied: `carmack-linus-review`, `second-brain`
Role: Independent Critic (pipeline stage 3)

---

## Verdict: APPROVED WITH CHANGES

The architecture is structurally sound and demonstrates rigorous thinking on conservation, determinism, and replay correctness. The integer-only budget/charging system, content-addressed immutable IDs, largest-remainder allocation, and OCC transaction model are well-designed. However, two blockers and five major findings must be resolved before the Implementer may begin. None require a full redesign — all are addressable with targeted spec amendments.

---

## Findings

### FINDING-1 — BLOCKER: Trunk receives zero fork-seed allocation but trunk re-forking is retained

**Spec citation:** §5.4, sink table row "inner or trunk" assigns Fork seed = 0 BPS, Canopy = 0 BPS. Same section states: "V2 fork maturity, internode, floor/cap, and deterministic hazard rules remain behaviorally unchanged, but read only the day-start snapshot."

**Code evidence:** `GrowthEngine.ts` line 333: `const canFork = living.length === 0 || b.depth === 0;` — the trunk (`depth === 0`) always enters the fork path. The trunk is the sole origin of new depth-1 branches (arms and legs). If the trunk has no living depth-1 children (all pruned), it MUST fork to produce new growth.

**Contradiction:** Under V3's budget system, the trunk's fork-seed allocation is zero. The trunk can never accumulate `forkEscrowGU` because 0 BPS produces 0 GU. Trunk re-forking is therefore economically impossible despite being behaviorally retained. A tree with all depth-1 branches pruned becomes permanently stunted.

**Required fix:** Add a fourth sink-table row for "trunk, fork eligible" (depth 0, no living children or fork-maturity met) with a non-zero FORK_SEED allocation. The existing "inner or trunk" row should be narrowed to "inner (depth > 0) or trunk with living children."

---

### FINDING-2 — BLOCKER: Content-addressed IDs require transaction-internal inputs, contradicting the "pure deterministic transition outside a database transaction" claim

**Spec citation:** §7.3 step 2 states the Edge Function "validates and computes the pure deterministic transition outside a database transaction." §7.3 step 3 states `commit_growth_transition_v3` "locks the tree row" and then commits.

**ID dependencies:** §7.1 defines `careEventId = H(["kijo-care-event-v2", treeId, acceptedAtMs, eventSequence, idempotencyKey, normalizedAction])`. §7.1 states `eventSequence` is "allocated while the tree row is locked." §6.1 defines `replacementPlanId = H(["kijo-plan-splice-v1", priorPlanId, careEventId, committedRevision])` and `replacementEventId = H(["kijo-event-replacement-v1", priorEventId, careEventId, replacementOrdinal])`.

**Contradiction:** `eventSequence` is only available inside the commit function (under row lock). `committedRevision` is only known after the revision increment inside the commit. Therefore `careEventId`, `replacementPlanId`, and all `replacementEventId` values CANNOT be computed in step 2 ("outside a database transaction"). The Edge Function can compute the structural transition (new state, new events, allocation accounting) but not the final identities.

**Impact:** An implementer following the spec literally would attempt to compute IDs outside the transaction and fail, or would split ID computation between steps 2 and 3 without guidance, creating a fragile boundary.

**Required fix:** §7.3 must explicitly partition what step 2 computes (structural transition, accounting, validation) vs. what step 3 computes (eventSequence allocation, all content-addressed IDs, final immutable record insertion). Alternatively, allocate `eventSequence` from a PostgreSQL sequence in `prepare` (sequences are non-transactional and don't require row locks), allowing the Edge Function to compute all IDs in step 2. Either approach works; the spec must choose one and document it.

---

### FINDING-3 — MAJOR: Opening escrow absent from the daily conservation identity

**Spec citation:** §5.5 defines the conservation equation:
```
branchAllocationGU = materializedGeometryGU + activeFutureEventGU
                   + branchEscrowGU + cancelledGU + quantizationReserveGU
```
§5.4 states: "If a discrete fork or canopy cell cannot consume its sink allocation, the amount is stored as branch-owned forkEscrowGU or canopyEscrowGU. Escrow... remains locked to that branch across days."

**Problem:** The conservation equation (§5.5) covers only "at any timestamp during the day" — it accounts for today's new budget. But escrow accumulated from prior days ("remains locked to that branch across days") is a separate, carried-forward balance. The equation `dailyGrowthBudgetGU = sum(branchAllocationGU)` is correct for today's budget, but the total economic state of the tree includes opening escrow that predates today's budget.

The spec never defines:
1. How opening escrow interacts with today's sink allocation. Does today's FORK_SEED allocation ADD to the opening `forkEscrowGU`? Or is it a separate pool?
2. The trigger for consuming escrow. When escrow reaches the cost of a fork cylinder, is a fork emitted? During which day's plan? Does the escrow-funded fork appear as an event in the plan?
3. Whether the conservation equation should be `dailyGrowthBudgetGU + openingEscrowGU = sum(five terms including updated escrow)` for full-tree accounting.

**Required fix:** Define a "branch economic state" that includes opening escrow. Specify the accumulation rule (today's sink allocation adds to opening escrow when the discrete event cannot fire), the consumption rule (escrow funds the next eligible fork/canopy event, debited atomically when the plan is created), and the cross-day conservation identity that includes opening and closing escrow.

---

### FINDING-4 — MAJOR: Season length 90 game-days contradicts GDD's 30 game-days

**Spec citation:** §10.2: `SEASON_LENGTH_GAME_DAYS = 90`, producing a 360-game-day full cycle. §18 (phases) calls this a "safe default."

**GDD citation:** §3.2 (line 233 of `docs/GDD.md`): "30 game-days per season." The PRD references a "120-day cycle" (= 30 × 4 = 120 game-day full cycle).

**Discrepancy:** The spec's value is 3× the GDD's value. A 90-game-day season at 8h/game-day = 720 real hours = 30 real days per season = 120 real days per full cycle. The GDD's 30-game-day season = 240 real hours = 10 real days per season = 40 real days per full cycle.

The spec §18 acknowledges this is a "safe default" but does not cite or override the GDD. The GDD is a controlling document per the preflight (§ "Controlling decisions").

**Required fix:** Either (a) record an explicit owner decision in `DECISIONS.md` overriding the GDD's 30 to 90 and cite it in the spec, or (b) change the spec to 30 and adjust the seasonal palette timing. Since the spec calls seasons "presentation-only" and "may be changed only by a new presentation version," this is not structurally blocking, but the implementer needs an unambiguous number.

---

### FINDING-5 — MAJOR: Transaction integration boundary for consumables unnamed

**Spec citation:** §7.3 describes the OCC transaction for tree state. §1 states: "This work does not change... economy." §6.4 influence sets include jin and wire, which currently cost consumables.

**Problem:** The care-action Edge Function must deduct consumable costs (wire premium currency, jin consumable, etc.) AND commit the tree state transition atomically. §7.3's `commit_growth_transition_v3` handles tree state only. If consumable deduction is a separate database operation, a crash between tree commit and consumable deduction creates an inconsistency: the tree mutated but the consumable wasn't spent (or vice versa).

The spec correctly scopes out economy changes, but the integration surface where V3's new OCC commit meets the existing consumable deduction is never named. An implementer could reasonably build the commit function without considering consumable atomicity.

**Required fix:** Add a one-paragraph integration boundary statement: either (a) `commit_growth_transition_v3` includes a `consumable_deductions` parameter and deducts within the same transaction, or (b) the existing consumable deduction mechanism is documented as already atomic with tree mutation (cite how), or (c) consumable deduction is pre-authorized and non-refundable (deduct first, then attempt tree commit; failed commit means consumable is lost, which must be a product decision).

---

### FINDING-6 — MAJOR: Escrow consumption mechanism undefined

**Spec citation:** §5.4: "If a discrete fork or canopy cell cannot consume its sink allocation, the amount is stored as branch-owned forkEscrowGU or canopyEscrowGU."

**Problem:** The spec defines escrow ACCUMULATION but never defines escrow CONSUMPTION. When accumulated `forkEscrowGU` exceeds the cost of a fork cylinder (`cylinderCostGU` for the initial branch), what happens?

Unanswered questions:
1. Does the planner check `openingForkEscrowGU + todayForkSeedGU >= cylinderCostGU(initialRadius, initialLength)` at plan creation?
2. If yes, does the fork appear as a `FORK_SEED` event in the day plan?
3. Is the escrow debited at plan creation or at event materialization?
4. If the fork fires, is the surplus escrow (accumulated - cost) retained or zeroed?
5. For canopy: does `canopyEscrowGU >= 10_000` trigger a `CANOPY_CELL` event?

Without these rules, the implementer cannot write the planner's fork/canopy scheduling logic.

**Required fix:** Add a "§5.4.1 Escrow consumption" subsection defining the trigger condition, the event type emitted, the debit timing, and surplus handling.

---

### FINDING-7 — MAJOR: Division-by-zero guard missing in largest-remainder algorithm

**Spec citation:** §5.3: `floor_i = floor(B * w_i / W)` where `W = sum(w_i)`.

**Edge case:** If all eligible branches have `rawWeight` that floors to zero after the `max(1, ...)` clamp, this cannot happen (minimum weight is 1). However, if zero branches are eligible — every branch pruned and jinned — then the sum W = 0 and the division is undefined.

**Current code evidence:** The trunk (depth 0) cannot be pruned in the current engine (`PruneEngine` rejects it). Jin on the trunk is semantically invalid (jin creates SCAR deadwood, and the trunk must remain alive). So W > 0 should always hold.

**Problem:** The spec does not STATE this invariant. An implementer might not realize W = 0 is impossible without tracing through PruneEngine and jin validation — both of which are outside the V3 spec's scope.

**Required fix:** Add an explicit precondition to §5.3: "The trunk is always eligible (it cannot be pruned or jinned). Therefore W > 0 and the division is well-defined. An implementation MUST reject prune/jin actions targeting the trunk before reaching the allocator."

---

### FINDING-8 — MINOR: Canopy grammar integer predicates accept a wider region than the continuous ellipsoid

**Spec citation:** §10.1: "The divisions above are evaluated as integer cross-products, not floats." Example: Hardwood `(x/3)^2 + (y/2)^2 + (z/3)^2 <= 1`.

**Observation:** Integer division truncates toward zero. For x=2: `(2/3)^2 = 0` in integer math, but the continuous value is `(2/3)^2 = 0.44`. The integer predicate therefore accepts MORE candidates than the continuous ellipsoid — every coordinate whose integer-divided quotient is 0 or ±1 passes. The effective shape is a rectangular-ish region larger than the intended ellipsoid.

For Hardwood with radii (3,2,3): the integer predicate accepts all cells where `|x| <= 4, |y| <= 2, |z| <= 4` (approximately), which is significantly larger than the continuous ellipsoid.

**Impact:** This is not necessarily wrong — the spec may intend the wider region to produce a "rougher, more natural" canopy. But it should be documented as intentional.

**Required fix:** Add a note to §10.1: "Integer truncation widens the acceptance region beyond the continuous ellipsoid. This is intentional: the resulting irregular shape approximates natural foliage better than a smooth mathematical surface. The effective radius in each axis is [state the actual bounds]."

---

### FINDING-9 — MINOR: Genesis/rebaseline geometry not accounted in daily conservation equation

**Spec citation:** §5.4: "Genesis root and trunk geometry is marked GENESIS_BASELINE." §5.5: conservation equation applies "at any timestamp during the day."

**Problem:** Genesis geometry (the initial trunk cylinder, root cone, etc.) was never debited from any day's budget — it exists at tree birth before the first daily plan. The conservation equation `dailyGrowthBudgetGU = sum(branchAllocationGU)` covers only daily-plan growth. The tree's total geometry includes genesis baseline + sum of all daily plans' materialized geometry.

This is not strictly a conservation violation (genesis is a separate category), but the spec should state that `GENESIS_BASELINE` geometry is outside the daily conservation identity and is tracked as a separate immutable quantity for total-tree accounting.

**Required fix:** Add one sentence to §5.5: "Genesis baseline geometry is outside the daily conservation identity. It is a fixed, immutable quantity established at tree creation and recorded in the genesis snapshot. Total tree volume = genesis baseline + sum of all daily materialized geometry."

---

### FINDING-10 — MINOR: Bigint overflow intermediate bounds not stated

**Spec citation:** §5.1: `cylinderCostGU(r,l) = ceilDiv(3_141_593 * r^2 * l, 100_000_000_000_000)`. §5.1 also states: "The planner uses bigint for products and division."

**Observation:** With q4 inputs: for a thick mature trunk, r ≈ 50,000 (5.0 voxels), l ≈ 2,000,000 (200 voxels). The intermediate product `3_141_593 * 2,500,000,000 * 2,000,000 ≈ 1.57 × 10^22`, which exceeds `Number.MAX_SAFE_INTEGER` (≈ 9 × 10^15). JavaScript BigInt handles this correctly, but the spec says "Persisted individual amounts must satisfy 0 <= value <= Number.MAX_SAFE_INTEGER."

The FINAL result after division by 10^14 is ≈ 1.57 × 10^8, well within safe integer range. But the spec should confirm that intermediate bigint products are expected to exceed MAX_SAFE_INTEGER and that only final persisted results must satisfy the bound.

**Required fix:** Add to §5.1: "Intermediate products in cylinderCostGU may exceed Number.MAX_SAFE_INTEGER; bigint arithmetic handles this. Only the final quotient, which is the persisted GU amount, must satisfy the safe-integer bound."

---

## Prior-Critic Verification Summary

A previous independent critic flagged 4 preliminary blockers. My independent verification:

| Prior Finding | My Verdict | Severity |
|---|---|---|
| 1. Trunk receives zero fork funding | **CONFIRMED** (FINDING-1 above) | BLOCKER |
| 2. Opening escrow absent from conservation equation | **CONFIRMED with extension** (FINDING-3 + FINDING-6) | MAJOR × 2 |
| 3. Transaction does not reconcile consumable concurrency | **CONFIRMED, narrowed** (FINDING-5) | MAJOR (not BLOCKER — economy is explicitly out of scope, but the boundary must be named) |
| 4. Season timing 90 vs 30 days | **CONFIRMED** (FINDING-4) | MAJOR (not BLOCKER — seasons are presentation-only, but the GDD conflict must be resolved) |

---

## Acceptance Traceability Spot Check

The spec's §16 traceability matrix maps 8 owner acceptance gates from `ARCH-GROWTH-V3-CONTINUOUS-DISPLAY-2026-09-24.md` to red tests. Verified:

- Gate 1 (3-hour visible growth): mapped to `red-test-01` and `red-test-04` — adequate.
- Gate 2 (two-viewer hash match): mapped to `red-test-02` — adequate.
- Gate 3 (close/reopen equivalence): mapped to `red-test-03` — adequate.
- Gate 5 (sleep/wake no lost growth): mapped to `red-test-05` — adequate.
- Gate 7 (disconnect past boundary): mapped to `red-test-07` — adequate.

No acceptance gate is unmapped. The 28 red tests in §15 cover the critical behavioral contracts.

---

## What the Architecture Gets Right

The spec demonstrates exceptional rigor in several areas:

1. **Integer-only conservation** — the GU/q4 system with largest-remainder eliminates rounding leakage entirely. This is the right approach for a deterministic blockchain game.
2. **Content-addressed immutable IDs** — making plan and event identity a pure function of content prevents ghost state and makes replay verification trivial.
3. **OCC with idempotency** — the prepare/compute/commit split with idempotency keys is the correct pattern for Edge Functions that cannot hold database transactions open.
4. **Stable branch roles** — freezing ARM/LEG classification at fork time and never re-sorting on prune eliminates an entire class of prune-induced stat instability.
5. **Multi-source voxel ownership** — solving the overlap problem at the voxel layer rather than the branch layer produces correct prune receipts without special-casing every geometry intersection.
6. **Presentation-only seasons** — keeping seasons out of canonical state is the right boundary for a competitive game where stats must be deterministic.

---

## Summary of Required Actions Before Implementation

| # | Finding | Severity | Action |
|---|---|---|---|
| 1 | Trunk fork-seed = 0 | BLOCKER | Add trunk fork-eligible sink row |
| 2 | Content-addressed IDs need transaction-internal inputs | BLOCKER | Partition step 2 vs step 3 computations, or allocate eventSequence in prepare |
| 3 | Opening escrow not in conservation identity | MAJOR | Define cross-day escrow accounting |
| 4 | Season length 90 vs GDD 30 | MAJOR | Owner decision or spec change |
| 5 | Consumable transaction boundary unnamed | MAJOR | Add integration boundary statement |
| 6 | Escrow consumption mechanism undefined | MAJOR | Add §5.4.1 escrow trigger/debit rules |
| 7 | Division-by-zero guard unstated | MAJOR | Add trunk-always-eligible precondition |
| 8 | Integer predicate wider than ellipsoid | MINOR | Document as intentional |
| 9 | Genesis geometry outside conservation | MINOR | Add clarifying sentence |
| 10 | Bigint intermediate overflow bounds | MINOR | Add clarifying sentence |

The 2 BLOCKERs and 5 MAJORs must return to the Architect for correction. The Critic must re-review the corrected spec before the Implementer begins. The 3 MINORs may be addressed in the correction pass or deferred to implementation.
