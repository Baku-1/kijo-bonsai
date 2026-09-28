---
title: "Critic Re-Review — Growth V3 Implementation Spec"
page_type: pipeline
project: kijo
stage: critic-rereview
updated: 2026-09-26
status: approved-for-implementation
controlling_doc: ARCH-GROWTH-V3-CONTINUOUS-DISPLAY-2026-09-24.md
spec_under_review: ARCH-GROWTH-V3-IMPLEMENTATION-2026-09-25.md
original_critic: CRITIC-GROWTH-V3-IMPLEMENTATION-2026-09-25.md
skills_applied:
  - carmack-linus-review
  - second-brain
---

# Critic Re-Review — Growth V3 Implementation Spec

## Scope

This re-review verifies that all 10 findings from the original critic report (`CRITIC-GROWTH-V3-IMPLEMENTATION-2026-09-25.md`) were properly corrected in `ARCH-GROWTH-V3-IMPLEMENTATION-2026-09-25.md` (status: `corrections-applied`). For each finding the re-review checks: (1) correction is present in the spec, (2) correction addresses the original issue, (3) no new contradictions are introduced, (4) consistency with the owner-approved controlling doc.

Trusted developer pattern citations are drawn from the Second Brain wiki where applicable.

---

## 1. Per-Finding Verification Table

| # | Severity | Finding | Correction Present? | Addresses Issue? | New Contradictions? | Trusted Dev Citation | Verdict |
|---|----------|---------|:-------------------:|:----------------:|:-------------------:|---------------------|---------|
| F-1 | BLOCKER | Trunk fork-seed=0 makes re-forking impossible after all children pruned | YES — §5.4 sink table now has 4 rows: "inner or trunk, not fork eligible" (7000/3000/0/0), "trunk, fork eligible" (6000/3000/1000/0), "terminal, fork eligible" (6000/2500/1000/500), "terminal, not fork eligible" (6500/2500/0/1000) | YES — trunk can now accumulate fork escrow when fork-eligible, enabling re-fork | NONE | Proof of Play marketplace `burn-as-escrow` pattern: discrete resource accumulation toward a threshold event matches the fork escrow model (wiki/patterns/proof-of-play/token-marketplace-shop.md) | **PASS** |
| F-2 | BLOCKER | careEventId hash requires eventSequence/committedRevision only available inside DB transaction | YES — §7.3 step 2 now explicitly states it does **not** allocate `eventSequence` or `committedRevision`; step 3 allocates them inside the Postgres function and computes `careEventId` from the now-known values | YES — the prepare/commit partition is clean; no hash inputs are assumed before they exist | NONE | dwi SIWE auth nonce-based replay protection: nonce assigned at commit time, not pre-allocated, matching the step 3 allocation pattern (wiki/patterns/dwi/siwe-wallet-auth.md). Proof of Play receipt generation via GUID entities assigned inside the transaction (wiki/patterns/proof-of-play/token-marketplace-shop.md) | **PASS** |
| F-3 | MAJOR | Cross-day escrow balance absent from conservation identity | YES — §5.5 adds: `totalTreeGU = dailyGrowthBudgetGU + sum(branchEscrowGU for all living branches)`. Escrow is "never merged into today's budget or redistributed between branches" | YES — escrow is now tracked as a separate per-branch balance with explicit cross-day persistence | NONE — minor clarity note: the exact ledger treatment of an escrow-funded fork event (which day's conservation does the consumed prior-escrow appear in?) could be more explicit, but §5.4.1 point 5 ("When consumed, they transfer to materializedGeometryGU") combined with the totalTreeGU equation is sufficient for implementation | Proof of Play energy/cooldown lazy-regen pattern: `(lastAmount, lastTimestamp)` carry-forward across boundaries parallels escrow carry-forward (wiki/patterns/proof-of-play/token-marketplace-shop.md) | **PASS** |
| F-4 | MAJOR | Season length 90 vs GDD's 30 — owner decision required | YES — §10.2 now reads: `SEASON_LENGTH_GAME_DAYS = 90 // CONFIRMED by owner 2026-09-26. 4 seasons per 360 game-day year.` | YES — owner confirmation resolves the ambiguity | NONE — consistent with controlling doc which does not specify season length (seasons are presentation-only per §10) | N/A — owner decision, no pattern comparison applicable | **PASS** |
| F-5 | MAJOR | Consumable transaction boundary unnamed | YES — §7.4 added: "Consumable Debit Boundary". Atomic inventory debit happens inside `commit_growth_transition_v3` within the same Postgres function call and database transaction | YES — consumable debit is now explicitly atomic with the growth commit | NONE | Proof of Play marketplace: burn-as-escrow bundles inventory debit with state mutation in a single atomic call. Per-operation replay components prevent double-consumption on retry (wiki/patterns/proof-of-play/token-marketplace-shop.md) | **PASS** |
| F-6 | MAJOR | Escrow consumption mechanism undefined | YES — §5.4.1 added with 5 rules: (1) fork escrow trigger at day-plan creation, (2) canopy escrow trigger, (3) today's allocation additive with existing escrow, (4) prune/jin cancellation zeroes escrow, (5) ledger treatment | YES — complete lifecycle defined: accumulation → threshold check → debit → cancellation | NONE | Proof of Play burn-as-escrow: resource burns accumulate toward threshold, event fires atomically when affordable. Token guards (wiki/patterns/proof-of-play/token-guards.md): precondition balance checks before state mutation match the escrow affordability check | **PASS** |
| F-7 | MAJOR | W=0 division-by-zero guard missing in largest-remainder allocation | YES — §5.3 adds: "Precondition (FINDING-7): W = sum(w_i) > 0. This is guaranteed by the trunk invariant: every living tree has at least the trunk with w_trunk > 0" | YES — the division-by-zero is provably impossible given the trunk invariant | NONE — consistent with controlling doc §"Tree-Level Daily Growth Budget" which mandates "every eligible living branch" with trunk always present | Proof of Play token guards: balance+ownership precondition checks before any arithmetic (wiki/patterns/proof-of-play/token-guards.md). Principle: validate assumptions at the API boundary, prove invariants structurally | **PASS** |
| F-8 | MINOR | Canopy integer predicate accepts wider/narrower region than continuous ellipsoid — ambiguity | YES — §10.1 adds: "Intentional rounding note (FINDING-8): integer division in these predicates truncates toward zero, which is conservative — borderline cells are excluded rather than included" | PARTIALLY — see **NEW FINDING NF-1** below | **YES — mathematical error in the explanation** (see NF-1) | N/A — this is a documentation accuracy issue | **CONDITIONAL PASS** |
| F-9 | MINOR | Genesis baseline geometry outside daily conservation cycle | YES — §5.4 adds: "Genesis note (FINDING-9): genesis baseline geometry is a one-time creation event outside the daily conservation cycle" | YES — genesis is explicitly scoped out of the daily budget | NONE | N/A — standard game-engine pattern: initial state is a fixture, not a tick output | **PASS** |
| F-10 | MINOR | Bigint intermediate overflow bounds | YES — §5.1 adds: "Overflow note (FINDING-10): the intermediate product... can exceed Number.MAX_SAFE_INTEGER... this is why the planner uses bigint arithmetic for the entire computation" | YES — the requirement for bigint is documented with rationale | NONE | N/A — standard numeric discipline for fixed-point integer conservation systems | **PASS** |

---

## 2. New Issues Found During Re-Review

### NF-1 (MINOR, NON-BLOCKING): F-8 correction has incorrect mathematical explanation

**Location:** §10.1, "Intentional rounding note (FINDING-8)"

**The claim:** "integer division in these predicates truncates toward zero, which is conservative — borderline cells are excluded rather than included"

**The math:** Consider `x = 2, radius = 3`. Integer division: `(2 / 3) = 0`, then `0² = 0`. Continuous: `(2/3)² = 0.44`. The integer result is **smaller** than the continuous result. In the ellipsoid predicate `(x/rx)² + (y/ry)² + (z/rz)² <= 1`, a smaller left side makes it **easier** to pass, meaning **more** cells are accepted. The effective boundary is therefore **wider** than the continuous ellipsoid, not tighter.

The original critic's analysis (F-8) was mathematically correct: truncation toward zero in the quotient reduces the sum of squared terms, which **widens** the acceptance region.

**Impact:** This is a documentation-only error. The integer predicates are deterministic and produce correct, reproducible canopy shapes. The note incorrectly labels the rounding direction. The shapes themselves are fine — they are simply defined by the integer predicates, not by a continuous ellipsoid.

**Recommended correction:** Replace "conservative — borderline cells are excluded rather than included" with "permissive — integer truncation in the quotient reduces the squared terms, producing a slightly wider acceptance region than the continuous ellipsoid. This is deliberate: it produces deterministic compact silhouettes with slightly fuller crowns."

**Severity:** MINOR. Does not block implementation. The implementer should use the integer predicates as written; the note is explanatory only.

---

## 3. Controlling Document Consistency Check

All 10 corrections were checked against `ARCH-GROWTH-V3-CONTINUOUS-DISPLAY-2026-09-24.md` (owner-approved):

- **Conservation requirement** (controlling doc §"Tree-Level Daily Growth Budget"): F-1, F-3, F-7, F-9, F-10 corrections all preserve or strengthen the conservation model. No contradiction.
- **Pruning consequence** (controlling doc §"Pruning, Lost Voxels, and Permanent Provenance"): F-6 (escrow cancellation on prune) is consistent with "pruning must preserve the existing lost-voxel consequence."
- **Deterministic replay** (controlling doc §"Care Actions During an Interval"): F-2 (transaction-scoped ID computation) and F-5 (atomic consumable debit) strengthen deterministic replay guarantees.
- **Presentation-only seasons** (controlling doc §"Jin/Prune Acceptance Gates" and rendering rules): F-4 (season length confirmation) and F-8 (canopy predicates) are presentation-layer; seasons never mutate canonical state per both docs.

No contradictions with the controlling document were found.

---

## 4. Second Brain Pattern Cross-References

| Pattern Source | Wiki Path | Findings Referenced | Relevance |
|---|---|---|---|
| Proof of Play — Token Marketplace Shop | `wiki/patterns/proof-of-play/token-marketplace-shop.md` | F-1, F-2, F-3, F-5, F-6 | Burn-as-escrow, per-operation replay components, GUID-based receipt generation, four-layer SKU validation |
| Proof of Play — Token Guards | `wiki/patterns/proof-of-play/token-guards.md` | F-6, F-7 | Soulbound guards, balance+ownership precondition checks, three-state reentrancy guard |
| dwi — SIWE Wallet Auth | `wiki/patterns/dwi/siwe-wallet-auth.md` | F-2 | Nonce-based replay protection, commit-time ID assignment |

---

## 5. Final Verdict

### **APPROVED FOR IMPLEMENTATION**

All 10 original findings have been addressed. Two BLOCKER findings (F-1, F-2) are fully resolved. Five MAJOR findings (F-3 through F-7) are fully resolved. Three MINOR findings (F-8 through F-10) are resolved, with F-8 carrying a non-blocking documentation accuracy note (NF-1).

**One new non-blocking finding (NF-1):** The F-8 correction note has the rounding direction backwards. The implementer should use the integer predicates as specified and note that the acceptance region is slightly wider (not narrower) than the continuous ellipsoid. This can be corrected in a documentation pass without blocking implementation.

**Conditions for implementation:**
1. The implementer should be aware of NF-1 and implement the integer predicates as written (the predicates themselves are correct; only the explanatory note is wrong).
2. The implementer should treat the Second Brain pattern references as context, not as binding API — the patterns inform the approach but the spec is authoritative.

**The spec is ready for the Implementer stage.**

---

## Appendix: Review Identity

- **Role:** Critic (re-review)
- **Skills applied:** `carmack-linus-review`, `second-brain`
- **Documents reviewed:** ARCH-GROWTH-V3-IMPLEMENTATION-2026-09-25.md (954 lines), CRITIC-GROWTH-V3-IMPLEMENTATION-2026-09-25.md (218 lines), ARCH-GROWTH-V3-CONTINUOUS-DISPLAY-2026-09-24.md (233 lines)
- **Second Brain pages consulted:** wiki/patterns/proof-of-play/token-marketplace-shop.md, wiki/patterns/proof-of-play/token-guards.md, wiki/patterns/dwi/siwe-wallet-auth.md, wiki/decisions/growth-v3-correction-pass-2026-09-26.md
- **Date:** 2026-09-26
- **No implementation performed. No git operations performed.**
