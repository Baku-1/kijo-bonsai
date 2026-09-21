# COMPARE: JinEngine Phase 2 vs Second Brain Trusted Developer Patterns

**Date:** 2026-09-18
**Stage:** Pattern Comparison (post-audit pipeline step)
**Subject:** `packages/engine/src/JinEngine.ts` (103 lines)
**Methodology:** Carmack x Linus review lens, per `reaudit-wiki-comparison-discipline.md`

---

## Summary

JinEngine Phase 2 was compared against 14 wiki pattern pages from 5 trusted developer collections, plus 3 internal Kijo engine patterns. The implementation is structurally sound and follows established patterns well. Two minor gaps were identified, zero blockers.

**Verdict: PASS — implementation aligns with or improves upon all comparable trusted-dev patterns.**

---

## 1. Cascade Pattern — PruneEngine (Direct Analog)

**Wiki/Source:** `packages/engine/src/PruneEngine.ts` (internal Kijo pattern)

| Dimension | PruneEngine | JinEngine | Match? |
|-----------|-------------|-----------|--------|
| Iterative stack (not recursion) | `const stack: number[] = [branchId]` | `const stack = [...b.children]` | YES — same pattern, different entry point |
| Skip already-affected | `if (!b || b.pruned) continue` | `if (!child || child.pruned) continue` + `if (child.jinned && child.jinSegmentStart === 0) continue` | IMPROVES — jin adds segment-level idempotency |
| Cascade scope | All descendants | All descendants | MATCH |
| Children iteration | `for (const childId of b.children)` | `stack.push(...child.children)` | EQUIVALENT — spread vs loop, both correct |
| Post-cascade logging | `tree._logCare(entry)` | `tree._logCare({...})` | MATCH |
| Post-cascade dirty | `tree.markDirty()` | `tree.markDirty()` | MATCH |

**Notable difference:** PruneEngine starts the stack with the target branch itself (`[branchId]`), while JinEngine processes the target branch separately (Steps 2-3) then cascades only to children (`[...b.children]`). This is correct because jin has per-segment semantics — the target branch gets a partial jin (`jinSegmentStart = segmentIndex`), while children get full jin (`jinSegmentStart = 0`). PruneEngine doesn't need this distinction because pruning is always whole-branch.

**Gap: NONE**

---

## 2. Guard Patterns — dwi GiftingContract Guards

**Wiki page:** `wiki/patterns/dwi/gifting-guards.md`

dwi's canonical three-check `validGift` modifier pattern:
```solidity
if (currentGift.cancelled) revert GiftAlreadyCancelled();
if (currentGift.claimed) revert GiftAlreadyClaimed();
if (currentGift.creator == address(0)) revert InvalidGift();
```

**JinEngine equivalent (Steps 1-2):**
```typescript
if (!b) return { ok: false, reason: 'not-found' };           // existence check
if (b.pruned) return { ok: false, reason: 'pruned' };        // dead-state check
if (segmentIndex < 0 || segmentIndex >= b.length) return ...  // range check
if (b.jinned && segmentIndex >= b.jinSegmentStart) return ... // already-done check
```

| dwi Pattern | JinEngine Equivalent | Match? |
|-------------|---------------------|--------|
| Existence check (creator != 0) | `if (!b)` | MATCH |
| Already-claimed check | `if (b.jinned && segmentIndex >= b.jinSegmentStart)` | MATCH — adapted for segment semantics |
| Already-cancelled check | `if (b.pruned)` | MATCH — pruned is the analog of cancelled |
| Custom error types | Typed reason strings (`'not-found'`, `'pruned'`, etc.) | MATCH in intent — TypeScript uses union types rather than Solidity custom errors |
| Check ordering (cheapest first) | Existence → dead state → range → idempotency | MATCH — follows short-circuit principle |

**Gap: NONE**

---

## 3. Irreversible State Transition — Proof of Play Token Guards

**Wiki page:** `wiki/patterns/proof-of-play/token-guards.md`

PoP's Soulbound Guard is the closest analog to jin's irreversibility: once a token is soulbound, it cannot be transferred. Jin similarly cannot be undone.

| PoP Pattern | JinEngine Equivalent | Match? |
|-------------|---------------------|--------|
| Trait-based flag (`SOULBOUND_TRAIT_ID`) | `b.jinned = true` | MATCH — boolean flag marks irreversible state |
| Allows mint/burn of soulbound (from==0 or to==0) | Jin allows prune check before jin (pruned branches reject jin) | ANALOGOUS — different domain, same principle of "some transitions remain valid even in restricted state" |
| Dynamic per-token soulbound | Per-branch jin with segment granularity | IMPROVES — jin is more granular (partial branch) |
| Batch iteration for soulbound check | Iterative stack cascade | MATCH in structure |

**Gap: NONE**

---

## 4. Replay Protection / Idempotency — Proof of Play Marketplace

**Wiki page:** `wiki/patterns/proof-of-play/token-marketplace-shop.md`

PoP uses per-operation replay components to prevent double-processing:
```solidity
if (listingEscrowedReplayComponent.getLayoutValue(orderData.listingId).value != 0) {
    revert ListingAlreadyEscrowed();
}
```

**JinEngine equivalent:**
```typescript
if (b.jinned && segmentIndex >= b.jinSegmentStart) {
    return { ok: false, reason: 'already-jin' };
}
```

Both use check-before-mutate to prevent double-processing of irreversible operations.

| Dimension | PoP Replay | JinEngine | Match? |
|-----------|-----------|-----------|--------|
| Check before mutation | Timestamp != 0 | `b.jinned && segmentIndex >= start` | MATCH |
| Separate replay state per operation | Per-listingId component | Per-branch jinned + jinSegmentStart | MATCH — adapted for tree domain |
| Fail explicitly on duplicate | Custom error | `{ ok: false, reason: 'already-jin' }` | MATCH |

**Gap: NONE**

---

## 5. Batch Mutation Pattern — dwi Multicall & Bulk Ops

**Wiki page:** `wiki/patterns/dwi/multicall-bulk-ops.md`

dwi's batch pattern uses `allowFailure: true` per call to prevent one bad item from aborting the batch. JinEngine's cascade handles a related concern differently:

| Dimension | dwi Multicall | JinEngine Cascade | Match? |
|-----------|-------------|-------------------|--------|
| Per-item failure isolation | `allowFailure: true` | `if (!child || child.pruned) continue` — skips invalid/dead children | ANALOGOUS |
| Batch scope | Configurable batch size | All descendants (unbounded) | DIFFERS — see note below |

**Note:** JinEngine's cascade is unbounded — it processes ALL descendants in one call. In dwi's on-chain context, unbounded loops risk gas exhaustion. In JinEngine's off-chain TypeScript context, this is safe because tree depth is bounded by the growth model (practical max ~50 branches). This is the correct adaptation for the domain.

**Gap: NONE**

---

## 6. State Machine Ordering — Proof of Play Game Guards

**Wiki page:** `wiki/patterns/proof-of-play/game-guards.md`

PoP's standard guard stack: `whenNotPaused` + `nonReentrant` + `onlyRole(...)`.

**JinEngine's ordering:**
1. Existence check (`!b`)
2. Dead-state check (`b.pruned`)
3. Range validation (`segmentIndex < 0 || >= b.length`)
4. Idempotency check (`b.jinned && segmentIndex >= jinSegmentStart`)
5. State mutation (Steps 3-4)
6. Side effects (logging, dirty flag)

This follows Checks-Effects-Interactions (CEI) ordering exactly: all validation precedes all mutation, which precedes all side effects.

| Dimension | PoP Guard Stack | JinEngine | Match? |
|-----------|----------------|-----------|--------|
| CEI ordering | validate → compute → mutate → interact | validate (1-4) → mutate (5) → log (6-7) | MATCH |
| Cascading pause check | Contract + registry pause | Not applicable (single-threaded TypeScript) | N/A |
| Ban check before action | `_isBanned()` | `b.pruned` (dead branch = "banned" analog) | ANALOGOUS |

**Gap: NONE**

---

## 7. ECS Flag Propagation — martindevans Myriad.ECS

**Wiki page:** `wiki/patterns/martindevans/ecs-architecture.md`

martindevans' bit-packed component flags (`IsPhantom`, `IsRelation`, etc.) are baked into the ComponentID itself, making downstream checks single bitmask tests.

JinEngine's `b.jinned` is a simple boolean on the Branch object — not a bitmask. This is appropriate because:
- Branch objects have few flags (pruned, jinned, wired) — bitmask compression isn't needed
- The TypeScript engine doesn't have martindevans' performance constraints (60fps ECS vs. daily tree updates)

**Relevance:** martindevans' generational entity IDs (version bits to detect use-after-delete) have no JinEngine analog, but this is correct — branches are never deleted, only marked pruned/jinned.

**Gap: NONE**

---

## 8. Guard Validation — SageStarCodes

**Wiki page:** `wiki/patterns/SageStarCodes/guards-and-checks.md`

SageStarCodes' Object Existence Guard pattern:
```lua
if not self.data then error("Object does not exist", 2) end
```

JinEngine's equivalent:
```typescript
if (!b) return { ok: false, reason: 'not-found' };
```

Both prevent operations on non-existent objects. JinEngine returns a typed result instead of throwing, which is the correct pattern for the Kijo engine (all care actions return `Result` types).

**Gap: NONE**

---

## 9. Determinism — CareLogReplay Pattern

**Wiki/Source:** `wiki/implementation/jinengine-phase2-2026-09-18.md` + `raw/kijo/pipeline/AUDIT-BUG4-CARELOG-DETERMINISM-2026-08-07.md`

The CareLogReplay determinism invariant requires: same seed + same care log → identical tree state. Jin was verified to use:
- No RNG calls
- No `Date.now()` or `Math.random()`
- Pure boolean/integer mutations
- Deterministic cascade order (stack-based, children array order)

This matches the invariant proven in the BUG-4 audit and confirmed by JIN-9 test case.

**Gap: NONE**

---

## 10. Voxelizer Role Assignment

**Wiki/Source:** `wiki/concepts/nft-metadata-image-arch.md`

The NFT metadata spec defines `VoxelRole.SCAR` (value 5) as the role for jin-affected voxels. The implementation in `packages/voxelizer/src/index.ts` correctly assigns SCAR based on `jinThreshold` computed from `b.jinSegmentStart / b.length`.

This matches the architect decision in `raw/kijo/ARCHITECT-STATSHEET-DEFENSE-STABILITY.md`:
> "SCAR → structural Defense: CONFIRMED by C++ spec"

**Gap: NONE**

---

## 11. GrowthEngine Skip Checks

**Wiki/Source:** `wiki/lessons/critic-jinengine-phase2-2026-09-18.md`

The critic lesson documents a critical pattern: "grep for `b.pruned` across the entire engine package and evaluate each hit" when adding a new state flag. Four skip checks were added:
1. `extendAndFork`: `if (b.pruned || b.jinned) return;`
2. `thickeningPass`: `if (b.pruned || b.jinned) return 0;`
3. `selectFloorTipId`: `if (b.pruned || b.jinned) continue;` (Critic B-2)
4. `BonsaiTree.ts` physics: `if (b.pruned || b.jinned) continue;`

This pattern matches PoP's approach of stacking guards at every entry point.

**Gap: NONE**

---

## Gaps Found

### GAP-1: No jinCost validation (MINOR)

**Observation:** `jinCost` parameter is accepted but only logged. There is no `if (jinCost < 1)` guard. The JSDoc says `>= 1` but this isn't enforced.

**Comparison:** dwi's GiftingContract validates ALL parameters — even those used only for logging. PoP's action patterns validate amounts before any mutation.

**Severity:** MINOR — jinCost is purely informational (logged to care entry), not consumed. No inventory system exists in the engine. However, a negative or zero jinCost in the care log could confuse downstream analytics.

**Recommendation:** Add `if (jinCost < 1) return { ok: false, reason: 'invalid-cost' };` after Step 1. Low priority.

### GAP-2: No wiki pattern page for "iterative stack cascade" (CATALOG GAP)

**Observation:** Both PruneEngine and JinEngine use the exact same iterative-stack-with-skip cascade pattern. This pattern is NOT cataloged as a reusable wiki pattern page. It should be, per the lesson in `reaudit-wiki-comparison-discipline.md` point 5.

**Recommendation:** Create `wiki/patterns/kijo/iterative-cascade.md` documenting the pattern with both PruneEngine and JinEngine as examples. This makes it citable in future specs.

---

## Wiki Pages Consulted

| # | Wiki Page | Relevance |
|---|-----------|-----------|
| 1 | `wiki/patterns/dwi/gifting-guards.md` | Guard ordering, existence/idempotency checks |
| 2 | `wiki/patterns/dwi/gifting-functions.md` | Batch transfer, emergency exit patterns |
| 3 | `wiki/patterns/dwi/multicall-bulk-ops.md` | Bulk operation with per-item failure isolation |
| 4 | `wiki/patterns/proof-of-play/token-guards.md` | Soulbound (irreversible flag), reentrancy, ban |
| 5 | `wiki/patterns/proof-of-play/game-guards.md` | CEI ordering, guard stacking, cooldown-as-guard |
| 6 | `wiki/patterns/proof-of-play/game-actions.md` | Action patterns, counter systems, checkpoint progression |
| 7 | `wiki/patterns/proof-of-play/token-marketplace-shop.md` | Replay protection via timestamp components |
| 8 | `wiki/patterns/proof-of-play/token-modifiers-roles.md` | Role-based access control, system ID pattern |
| 9 | `wiki/patterns/martindevans/ecs-architecture.md` | Entity flags, bit-packed state, generational IDs |
| 10 | `wiki/patterns/SageStarCodes/guards-and-checks.md` | Object existence guard, mode validation |
| 11 | `wiki/implementation/jinengine-phase2-2026-09-18.md` | Implementation notes (internal) |
| 12 | `wiki/lessons/critic-jinengine-phase2-2026-09-18.md` | Critic review, skip-check discipline |
| 13 | `wiki/lessons/reaudit-wiki-comparison-discipline.md` | Audit comparison methodology |
| 14 | `wiki/concepts/nft-metadata-image-arch.md` | VoxelRole.SCAR assignment |

---

## Trusted Developers Checked

| Developer | Collection | Patterns Compared | Verdict |
|-----------|-----------|-------------------|---------|
| **dwi** | GiftingContract (guards, functions, multicall) | 3 pages, 8 patterns | MATCH/IMPROVES |
| **Proof of Play** | piratenation-contracts (guards, actions, marketplace, roles) | 4 pages, 14 patterns | MATCH/ANALOGOUS |
| **martindevans** | Myriad.ECS (architecture) | 1 page, 3 patterns | N/A (different domain, no gaps) |
| **SageStarCodes** | Guards & Validation | 1 page, 2 patterns | MATCH |
| **jaatster** | axie-3d-assets | 0 directly applicable (3D asset pipeline, not state mutation) | N/A |
| **truongnguyenptn** | Ronin ecosystem | Covered via PoP cross-references | N/A (security patterns covered by PoP comparison) |
| **karpathy** | ML/training patterns | 0 directly applicable (ML training loops, not game state) | N/A |

---

## Conclusion

JinEngine Phase 2 correctly implements all patterns comparable to the trusted developer references in the Second Brain wiki. The two gaps found are both minor: one is a missing input validation on a log-only parameter, and the other is a catalog gap (the iterative cascade pattern should be documented as a reusable wiki pattern).

No code changes are recommended as blockers. The implementation follows CEI ordering, uses proper guard stacking, handles idempotency correctly, preserves determinism, and cascades via the same proven iterative stack pattern as PruneEngine.
