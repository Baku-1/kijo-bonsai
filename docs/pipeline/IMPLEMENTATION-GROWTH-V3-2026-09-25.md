# Growth Engine V3 — Implementation Record

**Date**: 2026-09-25 → 2026-09-27
**Spec**: `ARCH-GROWTH-V3-IMPLEMENTATION-2026-09-25.md` (corrections-applied, critic-approved)
**Role**: Implementer
**Status**: Phases 1–13 complete. 129 probes (63 Pass 1 + 66 Pass 2) ready for auditor.

## Phases Completed

### Phase 1: Shared V3 Contracts (`packages/shared/src/growth-v3.ts`)
- ~530 lines of version constants, clock constants, GU/q4 numeric constants
- Type definitions: StableBranchRole, GrowthEventKind, GrowthEventV1, CareActionRequestV2, CareEventV2, VoxelOwnerV2, VoxelCellV2, PruneReceiptV1, TreeDisplayEnvelopeV1, DayPlanV1, BranchAllocationV1, BranchLedgerV1, BranchEscrowState, ClockState, ClockSample
- Pure functions: computeClockState(), computeSeason(), buildETag(), toQ4(), fromQ4()
- Strict validators for all V3 types
- Re-exported from `packages/shared/src/index.ts`

### Phase 2: GrowthLedger (`packages/engine/src/GrowthLedger.ts`)
- ~375 lines of bigint cost equations and deterministic allocation
- `ceilDivBig`, `cylinderCostGU`, `thickeningCostGU`, `canopyCellCostGU`
- `maxDeltaWithinBudget` — monotone binary search
- `healthBps`, `moistureBps`, `computeDailyBudgetGU` — integer fraction computation
- `largestRemainderAllocate` — deterministic allocation with bigint floor/remainder
- `allocateSinks` — per-branch sink allocation
- Conservation assertions: `assertBranchConservation`, `assertDailyBudgetConservation`
- `splitSegments` — segment 0 = floor(alloc/2), segment 1 = remainder

### Phase 3: GrowthPlanner (`packages/engine/src/GrowthPlanner.ts`)
- ~340 lines of immutable day plan creation
- `computeBranchWeight` — integer weight from apical dominance rules
- `isLeaderBranch` — longest living sibling, then lowest id
- `selectSinkDemands` — 4-row sink table selection
- `scheduleSegmentEvents` — create pending events per branch per segment
- `computeEmergenceStart` — deterministic 15-min window placement
- `sortEventsForOrdinal` — sort by (segmentIndex, startOffsetMs, kindPriority, branchId, localOrdinal)
- `createDayPlan` — full async day plan creation with content-addressed IDs

### Phase 4: GrowthMaterializer (`packages/engine/src/GrowthMaterializer.ts`)
- ~200 lines of integer-ppm evaluation and boundary materialization
- `interpolateQ4` — integer interpolation: from + floor((to-from)*ppm/1M)
- `computeEventProgressPpm` — clamp to [0, PROGRESS_SCALE]
- `evaluateEvent`, `evaluateSegmentEvents` — full event evaluation at a timestamp
- `findPendingBoundaries` — detect segment-0-close and day-close boundaries
- `evaluateBranchGeometry` — aggregate all branch events at a timestamp
- `q4ToRenderValues` — q4→float at the renderer edge only

### Phase 5: CanonicalHash (`packages/engine/src/CanonicalHash.ts`)
- ~155 lines of canonical JSON serialization and SHA-256 hashing
- `canonicalJsonSerialize` — canonical-json-v1 (sorted keys, no whitespace, integer-only, no -0)
- `canonicalHash`, `sha256Hex`, `contentAddressedId` — async Web Crypto API
- Rejects NaN, Infinity, bigint, functions, symbols

### Phase 6: CanopyGrammar (`packages/voxelizer/src/CanopyGrammar.ts`)
- ~165 lines of species-specific integer ellipsoid predicates
- `isInsideEllipsoid` — exact integer cross-product predicate (no floats)
- `enumerateCanopyCandidates` — scan bounding box, retain inside cells
- `sortCanopyCandidates` — deterministic hash-based ordering
- `getCanopyCandidates` — enumerate + sort entry point
- `isCanopyEligible` — terminal, live, non-jinned, ≥2 days old, health≥40, moisture>0

### Phase 7: Branch Schema Extensions (`packages/shared/src/index.ts`)
- Added to Branch interface: `stableRole?`, `birthDayIndex?`, `forkEscrowGU?`, `canopyEscrowGU?`
- All optional for backward-compat with pre-V3 branches

## NF-1 Fix Applied

In `ARCH-GROWTH-V3-IMPLEMENTATION-2026-09-25.md` §10.1, replaced:
> "conservative — borderline cells are excluded rather than included"

With:
> "permissive — integer truncation in the quotient reduces the squared terms, producing a slightly wider acceptance region than the continuous ellipsoid"

## Test Probes

- `packages/engine/test/growth-v3.test.js` — 63 probes, all pass
  - V3-L01 (12): bigint cost equations, boundary values, NaN/negative guards
  - V3-L02 (6): daily budget computation, dead/dry trees, fertilizer effect
  - V3-L03 (5): largest-remainder conservation, single entry, zero budget, tie-break
  - V3-L04 (6): sink allocation, conservation assertions, segment split
  - V3-H01 (10): canonical JSON serialization, rejects NaN/Infinity/floats/bigint/-0
  - V3-H02 (3): SHA-256 hashing, deterministic key-order independence
  - V3-P01 (2): branch weight, leader advantage
  - V3-M01 (5): interpolateQ4 boundaries and midpoint
  - V3-M02 (4): event progress ppm, zero-duration edge case
  - V3-M03 (4): boundary detection across segments and days
  - V3-M04 (2): evaluateEvent full materialization, q4ToRenderValues
  - V3-L05 (3): maxDeltaWithinBudget zero/full/binary-search
  - V3-Q4 (1): toQ4/fromQ4 round-trip

- `packages/voxelizer/test/canopy-grammar.test.js` — 15 probes, all pass
  - V3-V02 (5): ellipsoid predicate origin/boundary/outside/tropical-minY/evergreen-vertical
  - V3-V03 (4): candidate count, determinism, seed-sensitivity, all-inside-ellipsoid
  - V3-E01 (6): eligibility checks for all 6 conditions

**Total: 78 probes, 78 pass, 0 fail.**

## Second Brain Writebacks

5 pattern pages created:
1. `integer-gu-conservation` — bigint cost equations, conservation identity
2. `largest-remainder-allocation` — deterministic integer allocation
3. `canonical-json-hashing` — canonical-json-v1 spec and content-addressed IDs
4. `birth-anchored-clock` — per-tree timeline, segment boundaries
5. `escrow-accumulation` — fork/canopy escrow lifecycle

## Files Changed

| File | Change |
|------|--------|
| `packages/shared/src/growth-v3.ts` | NEW — V3 contracts, types, validators, clock |
| `packages/shared/src/index.ts` | V3 re-export + Branch V3 fields (stableRole, birthDayIndex, escrow) |
| `packages/engine/src/GrowthLedger.ts` | NEW — bigint cost, allocation, conservation |
| `packages/engine/src/GrowthPlanner.ts` | NEW — day plan creation |
| `packages/engine/src/GrowthMaterializer.ts` | NEW — ppm evaluation, boundaries |
| `packages/engine/src/CanonicalHash.ts` | NEW — canonical JSON, SHA-256 |
| `packages/engine/src/index.ts` | V3 module exports |
| `packages/voxelizer/src/CanopyGrammar.ts` | NEW — species ellipsoid predicates |
| `packages/voxelizer/src/index.ts` | CanopyGrammar exports |
| `packages/engine/test/growth-v3.test.js` | NEW — 63 test probes |
| `packages/voxelizer/test/canopy-grammar.test.js` | NEW — 15 test probes |
| `docs/pipeline/ARCH-GROWTH-V3-IMPLEMENTATION-2026-09-25.md` | NF-1 fix applied |

### Phase 8: PruneReceiptEngine (`packages/engine/src/PruneReceiptEngine.ts`)
- ~340 lines: multi-owner VoxelCellV2 management, prune receipt computation
- `compareVoxelOwners` — canonical sort: (branchDepth, branchId, sourceKindPriority, ownerId)
- `buildVoxelCell`, `addOwnerToCell`, `removeOwnersFromCell` — immutable cell ops
- `applyPruneStumpOverlay` — §8.3 stump overlay (`presentationOverlay: 'prune-scar'`)
- `packCoordinate`/`unpackCoordinate` — deterministic coordinate keys
- `computePruneDelta` — §8.4 removed voxels, overlapping surviving, owner claims, by-role counts
- `computeCancelledEventData`, `computeCancelledEscrow` — cancelled event/escrow aggregation
- `validatePruneReceiptInputs` — Web3 input guards (SHA-256 hex, safe integers, decimal strings)
- `assemblePruneReceipt` — full PruneReceiptV1 assembly, `sameDayRefundGU` always `'0'`

### Phase 9: StableBranchRoles + StatDeriverV3
- `packages/engine/src/StableBranchRoles.ts` (~160 lines)
  - `assignDepthOneRoles` — sort by (attachmentYQ4, branchId), lower ceil(n/2)→leg, upper floor(n/2)→arm
  - `assignRoleByDepth` — trunk/digit, throws for depth 1
  - `assignAllRolesAtRebaseline`, `assignNewbornDepthOneRoles`
- `packages/engine/src/StatDeriverV3.ts` (~230 lines)
  - Uses VoxelCellV2 primary owner role for structural stat derivation
  - Same multipliers as V2 (HP_MULT=0.35, POWER_MULT=0.50, ENDURANCE_MULT=0.50, KI_MULT=3.00)
  - skillSlots/skillPoints deliberately independent — no min() coupling
  - Prune-scar overlay grants no Defense

### Phase 10: CareReplayV2 (`packages/engine/src/CareReplayV2.ts`)
- ~250 lines: §6.4/§7 care replay with influence sets and splicing
- `compareCareEvents` — canonical order: (acceptedAtMs, eventSequence)
- `compareDecimalStrings` — numeric comparison of arbitrary-precision decimal strings
- 6 influence scopes: none, scene-only, direction-all, target-descendants, target-cancel, subtree-cancel
- `partitionByInfluence` — split future events into retained/affected
- `computeSplice` — full splice with SpliceResult
- `validateCareEventV2` — validates all CareEventV2 fields

### Phase 11: Database Schema (`apps/server/supabase/migrations/20260925000001_growth_v3.sql`)
- ~300 lines: full V3 Postgres migration
- ALTER TABLE trees: engine_version, state_schema_version, revision, event_sequence, state_hash, active_snapshot_id, active_plan_id, last_materialized_at_ms, rebaseline_status
- 6 new tables: tree_growth_snapshots, tree_growth_plans, tree_growth_events, tree_care_events, tree_prune_receipts, tree_rebaseline_audit
- RLS policies (owner-readable), boundary idempotency index
- `prepare_growth_transition_v3` — returns server time, revision, snapshot, plan, idempotency hit
- `commit_growth_transition_v3` — atomic: lock, idempotency check first, revision check, allocate, insert, commit

### Phase 12: Growth Transition (`apps/server/supabase/functions/_shared/growth-transition.ts`)
- ~230 lines: server-side OCC adapter
- `GrowthTransitionError` with OccErrorCode + httpStatus
- `validateRequest` — CareActionRequestV2 validation
- `parsePrepareResult`, `parseCommitResult` — handle REVISION_CONFLICT, IDEMPOTENCY_KEY_REUSED
- `buildSuccessResponse`, `buildErrorResponse` — response formatting with ETag

### Phase 13: Display Envelope (`apps/server/supabase/functions/_shared/build-display-envelope.ts`)
- ~230 lines: single evaluator for all display surfaces
- `buildDisplayEnvelope` — full TreeDisplayEnvelopeV1 construction with input validation
- `computeClockSample` — §12.2 clock sample from round-trip measurement
- `selectMedianOffset` — filter by MAX_CLOCK_RTT_MS, take median
- `estimateServerNow`, `hasClockDrifted` — client clock sync helpers

## Pass 2 Test Probes

File: `packages/engine/test/growth-v3-pass2.test.js` — 66 probes, all pass.

| Prefix | Module | Count |
|--------|--------|-------|
| V3-PR01..PR09 | PruneReceiptEngine | 27 |
| V3-SR01..SR03 | StableBranchRoles | 11 |
| V3-SD01 | StatDeriverV3 | 3 |
| V3-CR01..CR04 | CareReplayV2 | 16 |
| V3-DE01..DE02 | Display envelope (shared clock) | 6 |
| V3-GT01 | Growth transition (toQ4) | 2 |
| **Total** | | **66** |

Adversarial coverage: NaN, Infinity, -1, empty arrays, null, wrong schema version, malformed strings, leading-zero revisions, unknown action types.

## Second Brain Writebacks (Pass 2)

4 wiki pages written:
1. `wiki/patterns/multi-owner-voxel-cells.md` — VoxelCellV2 ownership pattern
2. `wiki/patterns/stable-branch-roles.md` — depth-based role assignment
3. `wiki/patterns/care-replay-v2-splice.md` — influence sets and splice
4. `wiki/patterns/occ-growth-transition.md` — OCC flow and display envelope

## Files Modified (Pass 2)

| File | Change |
|------|--------|
| `packages/engine/src/PruneReceiptEngine.ts` | Created (~340 lines) |
| `packages/engine/src/StableBranchRoles.ts` | Created (~160 lines) |
| `packages/engine/src/StatDeriverV3.ts` | Created (~230 lines) |
| `packages/engine/src/CareReplayV2.ts` | Created (~250 lines) |
| `apps/server/supabase/migrations/20260925000001_growth_v3.sql` | Created (~300 lines) |
| `apps/server/supabase/functions/_shared/growth-transition.ts` | Created (~230 lines) |
| `apps/server/supabase/functions/_shared/build-display-envelope.ts` | Created (~230 lines) |
| `packages/engine/src/index.ts` | Modified (added 3 export blocks) |
| `packages/engine/test/growth-v3-pass2.test.js` | Created (66 probes) |

## No Git Operations

No `git add`, `git commit`, or `git push` was performed. All changes are on disk for Jeremy's review.
