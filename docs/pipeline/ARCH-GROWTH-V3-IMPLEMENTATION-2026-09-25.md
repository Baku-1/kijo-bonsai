---
title: "Growth V3 Implementation Architecture"
page_type: architecture
project: kijo
date: 2026-09-25
status: corrections-applied
stage: ARCHITECT
implementation_status: not-started
controls:
  - docs/pipeline/PREFLIGHT-GROWTH-V3-2026-09-25.md
  - docs/pipeline/ARCH-GROWTH-V3-CONTINUOUS-DISPLAY-2026-09-24.md
  - DECISIONS.md
---

# Growth V3 Implementation Architecture

## 1. Outcome and authority

This document is the implementation contract for Growth V3. It resolves the ten questions in the dispatch preflight. It does not claim that the repository implements the contract yet.

Authority, highest first:

1. Owner decisions recorded in `DECISIONS.md` on 2026-09-24.
2. The approved continuous-display decision in `ARCH-GROWTH-V3-CONTINUOUS-DISPLAY-2026-09-24.md`.
3. The bounded evidence and source log in `PREFLIGHT-GROWTH-V3-2026-09-25.md`.
4. This implementation architecture.
5. Older API and technical text only where it does not conflict with 1-4.

The canonical names are Kijo, kijonsai, kijo, Yama-no-Kami, Flower Guild Rank, and the unnamed Guild seller. Tanaka and Gu Ahao are excluded. This work does not change twine, weight, wire, economy, combat balance, or lore except where a V3 boundary is explicitly named below.

## 2. Scope and verified foundation

### 2.1 Design task

- **Task:** replace day-boundary branch-local growth with a conserved, continuously evaluable, server-authoritative tree plan.
- **Deliverable:** an implementation-ready contract covering pure engine math, persistence, care concurrency, pruning, stats, migration, and every display surface.
- **Builds on:** current `@kijo/shared`, `@kijo/engine`, `@kijo/voxelizer`, Supabase functions, `ThreeCanvas.tsx`, debug renderers, and the approved V3 decision.
- **Consumed by:** Critic, then separate Implementer, Auditor, Linter, and gameplay/hardware verification passes.

### 2.2 Verification log

Verified from the repository and the preflight:

- `CareLogEntry` is currently only `{ day, action }`; it cannot order two actions inside a day or identify a retry.
- `GrowthEngine.growTick()` currently mutates branches during traversal and does not debit one immutable tree-wide budget.
- `SparseVoxelSet` currently keeps one `{ material, role, branchId }` contribution per coordinate, so last writer wins and overlap ownership is lost.
- `Voxelizer.fillTube()` includes `t == 1`; the non-jin threshold is also `1.0`, so an ordinary endpoint can currently become `VoxelRole.SCAR`.
- The current canopy rule gives a leaf sphere to any non-jinned branch with no living child; pruning the last child can therefore synthesize unearned foliage.
- Current ARM/LEG assignment is recomputed by sorting the live depth-one population. Without a stable role field, pruning can relabel surviving anatomy.
- `StatDeriver` reads current voxel roles. That is the correct basis for live HP, Power, Endurance, Ki, and Defense, but role stability and skill-point independence need explicit V3 rules.
- The current repository has `get-tree-public`, but the stale `apps/web/src/viewer.ts` entry named in `STATE.md` is absent. `ThreeCanvas.tsx`, `main3d.ts`, and `main2d.ts` are the real current web boundaries.
- `apps/server/supabase/functions/_shared/care-plan.mjs` and `test-care-plan.mjs` exist as untracked user work. They are not an approved source of truth and must not be overwritten.

Platform behavior is taken only from the sources already logged by the preflight:

- Supabase Broadcast is the preferred revision notification path; polling is the recovery path: <https://supabase.com/docs/guides/realtime/subscribing-to-database-changes>.
- Edge Functions may use Supabase clients or direct Postgres connections; this design uses a short optimistic computation plus one atomic commit RPC rather than pretending several `supabase-js` calls are a transaction: <https://supabase.com/docs/guides/functions/connect-to-postgres>.
- Browser `visibilitychange` is a resync signal: <https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event>.
- WebXR visibility/session restoration is a resync signal and hidden sessions cannot be assumed to receive animation frames: <https://www.w3.org/TR/webxr/>.

### 2.3 Code-source audit

The untracked `_shared/care-plan.mjs` prototype has unknown review and ownership status. Verdict: **do not adopt or edit it as the V3 implementation**. Preserve it byte-for-byte. An Implementer may run its existing test for comparison, but production V3 planning belongs in typed `packages/engine` modules and is bundled into the Edge Function only after Critic acceptance. This avoids silently blessing user work or creating two authorities.

### 2.4 Cross-reference result

- Package dependency direction remains `shared <- engine <- voxelizer`, with applications allowed to compose all three. Engine must not import voxelizer.
- `StatSheet` field names remain camelCase. V3 does not rename an existing field.
- Material remains presentation; role remains stat-bearing morphology.
- One game day remains eight real hours. A four-hour segment is display planning, not a second day.
- Older per-branch growth, dynamic ARM/LEG sorting, and day-only care-log descriptions are explicitly superseded for V3.
- The old verified invariant becomes: **versioned genesis/rebaseline snapshot + ordered CareEventV2 log + authoritative time -> identical canonical state, plan, voxels, and hashes**.

## 3. Non-negotiable invariants

1. The server is the only writer of canonical time, revisions, snapshots, plans, and accepted care order.
2. A client evaluates a published plan; it never allocates growth, rolls an event, advances a day, or creates the next segment.
3. One immutable day-start snapshot creates one daily budget. Two four-hour segments partition that budget; they do not duplicate it.
4. Every post-genesis geometric increment has an integer physical debit. Genesis and accepted legacy rebaseline geometry are explicitly tagged baselines, not silently charged to a later day.
5. Day-start branch eligibility, apical status, weight, and allocation do not change until the next day. A newborn branch is ineligible until that next day.
6. Care materializes the old plan first. It then mutates state and splices only the affected future events.
7. Published snapshots, plans, and events are immutable. A replacement gets a new ID; retained events keep byte-identical IDs and values.
8. A pruned ID is never reused. Pruning cancels its unmaterialized allocation and gives no same-day refund.
9. One coordinate can retain multiple source owners. Pruning one owner cannot erase a coordinate that still has a live owner.
10. Stable morphology is assigned at branch birth or rebaseline. Pruning does not re-sort surviving ARM and LEG identities.
11. Live stats come from canonical live voxels plus terrain under the rules in section 9. Historical technique provenance and presentation overlays are not stat inputs.
12. Seasons never mutate the canonical canopy, state hash, Ki, or combat snapshot.
13. All persisted numeric inputs are finite integers or validated q4 values. `NaN`, infinities, unsafe integers, `-0`, and unknown fields are rejected before state evaluation.
14. Any state-changing retry with the same idempotency key returns the first committed response; it never applies twice.

## 4. Versioned clock and canonical number model

### 4.1 Versions

The first V3 release uses these exact identifiers:

| Contract | Value |
|---|---|
| Engine/balance | `growth-v3.0.0` |
| State schema | `3` |
| Care event schema | `2` |
| Day-plan schema | `1` |
| Voxel ownership schema | `2` |
| Prune receipt schema | `1` |
| Display envelope schema | `1` |
| Canonical JSON/hash | `kijo-canonical-json-v1` / `sha256` |
| Presentation palette | `season-v1` |

Balance changes that affect canonical geometry require a new engine/balance version. Additive wireframe or palette changes require only a presentation version. A decoder may read old data; it may never interpret old bytes under a new version.

### 4.2 Birth-anchored time

Constants:

```text
GAME_DAY_MS          = 28_800_000  // 8 hours
DISPLAY_SEGMENT_MS   = 14_400_000  // 4 hours
SEGMENTS_PER_DAY     = 2
PROGRESS_SCALE       = 1_000_000
```

For authoritative database time `t` and immutable `bornAtMs`:

```text
elapsedMs       = max(0, t - bornAtMs)
dayIndex        = floor(elapsedMs / GAME_DAY_MS)
dayStartMs      = bornAtMs + dayIndex * GAME_DAY_MS
segmentIndex    = floor((t - dayStartMs) / DISPLAY_SEGMENT_MS)  // 0 or 1
segmentStartMs  = dayStartMs + segmentIndex * DISPLAY_SEGMENT_MS
segmentEndMs    = segmentStartMs + DISPLAY_SEGMENT_MS
progressPpm     = clamp(floor((t - segmentStartMs) * PROGRESS_SCALE /
                              DISPLAY_SEGMENT_MS), 0, PROGRESS_SCALE)
```

Age, Wisdom, morale settlement, ingredients, and day-based tool timers advance once when a full `GAME_DAY_MS` closes. Segment 0 closing does none of those things.

### 4.3 Canonical numeric representation

- Skeleton distances, angles, thicknesses, and attachment positions are q4 integers in persisted V3 data: `valueQ4 = round(value * 10_000)`.
- The public evaluator converts q4 to a JavaScript number only at the renderer edge.
- Plan progress is integer parts-per-million.
- Revisions and database `BIGINT` fields are decimal strings in JSON to avoid JavaScript precision loss.
- Canonical state contains no arbitrary floating-point value. It contains bounded safe integers, decimal-string big integers, booleans, strings, arrays, and objects.
- `canonical-json-v1` recursively sorts object keys lexicographically, preserves array order, emits UTF-8 with no insignificant whitespace, normalizes integer zero, and rejects non-integers or duplicate logical keys. SHA-256 lower-case hex of those bytes is the digest.

## 5. Physical growth ledger

### 5.1 Unit and exact arithmetic

The physical ledger unit is:

```text
1 growth unit (GU) = 0.0001 canonical voxel^3
GROWTH_UNIT_SCALE  = 10_000 GU per voxel^3
PI_Q6              = 3_141_593 / 1_000_000
```

The planner uses `bigint` for products and division. Persisted individual amounts must satisfy `0 <= value <= Number.MAX_SAFE_INTEGER` and are serialized as decimal strings across JSON. No operation uses binary floating-point to decide whether budget is available. **Overflow note (FINDING-10):** the intermediate product `3_141_593 * r^2 * l` in `cylinderCostGU` can exceed `Number.MAX_SAFE_INTEGER` for large q4 values; this is why the planner uses `bigint` arithmetic for the entire computation, not just the final result. The implementer must ensure `r`, `l`, and all intermediate products are `bigint` before multiplication. The `ceilDiv` divisor `100_000_000_000_000` (10^14) is also a `bigint` literal.

For a q4 radius `r`, q4 length `l`, and `ceilDiv(n,d) = (n+d-1)/d`:

```text
cylinderCostGU(r,l) = ceilDiv(3_141_593 * r^2 * l, 100_000_000_000_000)

thickeningCostGU(r0,r1,l1) =
  ceilDiv(3_141_593 * (r1^2-r0^2) * l1, 100_000_000_000_000)
```

`r`, `r0`, `r1`, and `l1` in those equations are integer q4 values. The ceiling is mandatory: no visible geometry is ever undercharged. A monotone integer binary search chooses the greatest q4 delta whose cost is at most the event allocation. The difference between allocation and charged geometry is recorded as `quantizationReserveGU`; it never vanishes silently.

### 5.2 Daily budget

V3 uses these explicit initial balance constants, chosen as a conservative first calibration near the current Day-200 scale:

```text
BASE_DAILY_VOLUME_VOXELS_V3 = {
  hardwood:  48,
  evergreen: 38,
  tropical:  60
}
FERTILIZER_FACTOR_BPS = 12_500  // 1.25x when active at day start
FACTOR_SCALE          = 10_000
```

Day-start factors are:

```text
healthBps = clamp(floor(dayStartHealth * 100), 0, 10_000)

moistureBps =
  moisture < 30 ? floor(moisture / 30 * 10_000) :
  moisture > 65 ? floor((100 - moisture) / 35 * 10_000) :
                  10_000

fertilizerBps = dayStartFertilizerDays > 0 ? 12_500 : 10_000
ageVigorBps   = 10_000  // V3: age changes history/Wisdom, not free mass or decay
```

The actual implementation performs those ratios as integer fractions, not floats:

```text
baseGU = BASE_DAILY_VOLUME_VOXELS_V3[species] * 10_000

dailyGrowthBudgetGU = floor(
  baseGU * healthBps * moistureBps * fertilizerBps * ageVigorBps /
  10_000^4
)
```

Health or moisture may therefore produce a zero budget. Neglect never produces negative growth and does not delete existing geometry in this release. Fertilizer, water, and health changes accepted mid-day affect the next day budget; they cannot mint extra same-day mass.

### 5.3 Immutable branch allocation

Eligible branches are those that exist in the day-start snapshot and are neither pruned nor jinned. A branch born later that day has weight zero until the next day.

V3 retains the current apical-dominance meaning, evaluated only from day-start topology:

```text
roleFactor =
  unbranched trunk                 -> 1.0
  branched trunk                   -> trunkContinuedRate
  leader tip                       -> 1.0
  subordinate tip                  -> 1 - apicalDominance * 0.5
  inner leader                     -> parentExtensionRate
  inner subordinate                -> parentExtensionRate *
                                       (1 - apicalDominance * 0.5)

rawWeight = extensionMultiplier * depthFalloffBase^depth * roleFactor
weightU   = max(1, floor(rawWeight * 1_000_000))
```

The computation uses q4 species parameters and integer exponentiation. Leader selection remains longest living sibling, then lowest branch ID. Unlike the current traversal, all weights are captured before any event is applied.

**Precondition (FINDING-7):** `W = sum(w_i) > 0`. This is guaranteed by the trunk invariant: a living tree always has at least the trunk branch, which is always eligible (not pruned, not jinned) and always has `weightU >= 1`. If no eligible branch exists (impossible for a living tree), the day plan emits zero events and the full budget becomes `quantizationReserveGU`.

For budget `B`, weights `w_i`, and `W = sum(w_i)`:

```text
floor_i     = floor(B * w_i / W)
remainder_i = (B * w_i) mod W
left        = B - sum(floor_i)
```

Give one GU to the first `left` recipients sorted by:

1. `remainder_i` descending;
2. `branchId` ascending.

This largest-remainder rule makes `sum(branchAllocationGU) == dailyGrowthBudgetGU` exactly and removes traversal-order advantage.

### 5.4 Branch-local sinks and operation charging

Within a branch allocation, use the same largest-remainder algorithm with the following basis-point demands:

| Day-start branch state | Extension | Support thickening | Fork seed | Canopy |
|---|---:|---:|---:|---:|
| inner or trunk, not fork eligible | 7,000 | 3,000 | 0 | 0 |
| trunk, fork eligible | 6,000 | 3,000 | 1,000 | 0 |
| terminal, fork eligible | 6,000 | 2,500 | 1,000 | 500 |
| terminal, not fork eligible | 6,500 | 2,500 | 0 | 1,000 |

An ineligible sink is removed and the row is renormalized by largest remainder. V2 fork maturity, internode, floor/cap, and deterministic hazard rules remain behaviorally unchanged, but read only the day-start snapshot. `FORK_SEED` creates the branch record and its initial visible cylinder; the initial cylinder is charged with `cylinderCostGU`. The parent support response is charged through `SUPPORT_THICKEN`. No child receives an extension allocation until the next day.

For simultaneous extension and thickening, debit in this fixed physical partition:

1. `EXTEND` adds length at the day-start radius: `pi * r0^2 * deltaLength`.
2. `SUPPORT_THICKEN` grows from `r0` to `r1` across the post-extension length `l1`: `pi * (r1^2-r0^2) * l1`.

Those two terms equal the cylinder volume change from `(r0,l0)` to `(r1,l1)` without omitting the cross-term. A fork seed is a separate cylinder. A canonical canopy cell costs exactly `10_000 GU` (one voxel cubed). Genesis root and trunk geometry is marked `GENESIS_BASELINE`; roots do not acquire free daily growth in V3. **Genesis note (FINDING-9):** genesis baseline geometry is a one-time creation event outside the daily conservation cycle. It is not charged against any `dailyGrowthBudgetGU` and does not appear in the per-day conservation identity in §5.5. It is recorded in the initial snapshot as `genesisBaselineGU` and is included in the total tree mass but excluded from daily budget accounting.

If a discrete fork or canopy cell cannot consume its sink allocation, the amount is stored as branch-owned `forkEscrowGU` or `canopyEscrowGU`. Escrow is not live geometry and contributes no stat. It remains locked to that branch across days. Pruning/jinning the branch cancels it; it is never redistributed to survivors.

#### 5.4.1 Escrow consumption rules (FINDING-6)

Escrow is consumed when the gated event becomes affordable:

1. **Fork escrow trigger:** At day-plan creation, if a branch has accumulated `forkEscrowGU >= cylinderCostGU(initialChildRadius, initialChildLength)` and the branch meets V2 fork maturity/internode rules at day start, a `FORK_SEED` event is emitted. The escrow is debited by the cylinder cost; any excess remains in `forkEscrowGU` for the next opportunity.
2. **Canopy escrow trigger:** At day-plan creation, if a canopy-eligible branch has `canopyEscrowGU >= 10_000` (one canonical canopy cell), a `CANOPY_CELL` event is emitted. The escrow is debited by `10_000 GU` per cell placed; any excess remains.
3. **Additive with today's sink:** Today's `FORK_SEED` or `CANOPY` sink allocation is added to the existing escrow balance before the trigger check. The combined total determines affordability.
4. **Prune/jin cancellation:** When a branch is pruned or jinned, its `forkEscrowGU` and `canopyEscrowGU` are set to zero and recorded in `cancelledEscrowGU` on the prune receipt. They are never redistributed.
5. **Ledger treatment:** Escrow balances appear in `branchEscrowGU` in the conservation identity. When consumed, they transfer to `materializedGeometryGU`.

### 5.5 Conservation equations

At day creation:

```text
dailyGrowthBudgetGU = sum(branchAllocationGU)
```

At any timestamp during the day:

```text
branchAllocationGU =
    materializedGeometryGU
  + activeFutureEventGU
  + branchEscrowGU
  + cancelledGU
  + quantizationReserveGU
```

Across the tree:

```text
dailyGrowthBudgetGU = sum(all five terms for all day-start branches)
```

`cancelledGU` and expired day-end `quantizationReserveGU` are terminal ledger categories, not spendable balance. They prove conservation but cannot create later geometry. No same-day refund exists.

**Cross-day escrow accounting (FINDING-3):** `branchEscrowGU` carried from prior days is **not** part of the current `dailyGrowthBudgetGU`. It is a separate per-branch balance that persists across day boundaries. The full tree balance at any timestamp is:

```text
totalTreeGU =
    dailyGrowthBudgetGU                        // today's fresh budget
  + sum(branchEscrowGU for all living branches) // carried from prior days
```

On day creation, `dailyGrowthBudgetGU = sum(branchAllocationGU)` covers only today's fresh allocation. Escrow balances are consumed by the rules in §5.4.1 and are never merged into today's budget or redistributed between branches.

Each branch allocation is split between display segments as:

```text
segment0GU = floor(branchAllocationGU / 2)
segment1GU = branchAllocationGU - segment0GU
```

An odd GU belongs to segment 1. A mid-day action does not change that split.

## 6. Plans, events, materialization, and splicing

### 6.1 Immutable IDs

All IDs are lower-case SHA-256 hex over `canonical-json-v1` arrays. They are content-addressed and contain no random input.

```text
dayPlanId = H(["kijo-day-plan-v1", treeId, engineVersion,
               dayIndex, baseRevision, dayStartStateHash])

eventId = H(["kijo-growth-event-v1", dayPlanId, branchId,
             eventKind, eventOrdinal])

replacementPlanId = H(["kijo-plan-splice-v1", priorPlanId,
                       careEventId, committedRevision])

replacementEventId = H(["kijo-event-replacement-v1", priorEventId,
                        careEventId, replacementOrdinal])
```

`eventOrdinal` is assigned after sorting proposed events by `(segmentIndex, startOffsetMs, kindPriority, branchId, localOrdinal)`. Kind priority is `EXTEND`, `SUPPORT_THICKEN`, `FORK_SEED`, `CANOPY_CELL`. IDs never depend on object iteration order.

### 6.2 Event shape

`packages/shared/src/growth-v3.ts` defines:

```ts
type GrowthEventKind =
  | 'extend'
  | 'support-thicken'
  | 'fork-seed'
  | 'canopy-cell';

interface GrowthEventV1 {
  schemaVersion: 1;
  eventId: string;
  entropyKey: string;
  sourcePlanId: string;
  branchId: number;
  kind: GrowthEventKind;
  segmentIndex: 0 | 1;
  startOffsetMs: number;
  endOffsetMs: number;
  allocationGU: string;
  chargedGeometryGU: string;
  quantizationReserveGU: string;
  fromQ4: Readonly<Record<string, number>>;
  toQ4: Readonly<Record<string, number>>;
  dependencies: readonly string[];
}
```

Continuous extension and thickening events span their segment. Fork and canopy events use a deterministic 15-minute emergence window whose start is selected from the valid segment range by `spatialHash(seed, dayIndex, branchId, localOrdinal)`. Their cost and random morphological samples are fixed when the day plan is made.

At evaluation time, event progress is integer ppm. Interpolation is `from + floor((to-from)*progressPpm/1_000_000)`, followed by q4 normalization. No frame delta enters canonical math.

### 6.3 Boundary materialization

- Segment 0 close materializes exactly through `segmentEndMs`, stores a snapshot, advances the one tree revision, and activates segment 1 from the already allocated day plan.
- Segment 1 close materializes the day, advances age/daily systems once, stores a snapshot, advances the revision, and creates the next day plan.
- Boundary work is idempotent on `(treeId, boundaryMs, engineVersion)`.
- A scheduled `advance-growth` function may process due trees, but every read and care write must also lazily advance missed boundaries before returning. Correctness does not depend on Cron punctuality.
- Newborn structures materialized in either segment remain absent from the day-start recipient list and therefore receive no allocation until the next day.

### 6.4 Care splice rules

Every accepted care action performs this order:

1. Obtain database server time and current revision.
2. Evaluate and materialize the active plan through that exact millisecond.
3. Apply the action to materialized state.
4. Determine the influence set below.
5. Retain unaffected future event records byte-for-byte.
6. Cancel affected records and create deterministic replacements only where the action permits future growth.
7. Persist the care event, receipts, new snapshot/plan, one new revision, and hashes atomically.

Influence sets:

| Action | Affected future geometry |
|---|---|
| water, fertilize | none in the current day; next day budget only |
| landscape | none in the tree plan; presentation scene revision only |
| rotate | all not-yet-materialized direction-dependent events; retain allocation, timing, and entropy samples |
| wire/twine/weight and removals | target branch plus descendant placement events; retain cost/timing/entropy |
| jin | cancel target dead segment and descendant growth; no redistribution |
| prune | cancel target subtree events and escrow; add only the charged render stump described in section 8 |

When geometry changes but an event remains economically the same, its replacement keeps the old `entropyKey`, `allocationGU`, start/end offsets, and morphology samples. Only dependent coordinates/orientation are recomputed. This prevents a care action from rerolling a favorable fork or canopy. Retained events keep their IDs; replaced events get the replacement ID above.

## 7. Care event, revision, transaction, and retry contract

### 7.1 Request and accepted event

The authenticated request is:

```ts
interface CareActionRequestV2 {
  schemaVersion: 2;
  treeId: string;
  expectedRevision: string;
  idempotencyKey: string; // UUID syntax, unique per intended action
  action: CareAction;
}
```

The server ignores client timestamps for ordering. The accepted record is:

```ts
interface CareEventV2 {
  schemaVersion: 2;
  careEventId: string;
  treeId: string;
  acceptedAtMs: number;
  eventSequence: string;
  baseRevision: string;
  committedRevision: string;
  idempotencyKey: string;
  action: CareAction;
  priorPlanId: string;
  resultingPlanId: string;
  resultStateHash: string;
  resultPlanHash: string;
}
```

`eventSequence` is allocated while the tree row is locked and is the final tie-breaker for equal milliseconds. Canonical care order is `(acceptedAtMs, eventSequence)`. `careEventId = H(["kijo-care-event-v2", treeId, acceptedAtMs, eventSequence, idempotencyKey, normalizedAction])`.

### 7.2 One revision

There is one monotonic `trees.revision`; do not introduce separate tree and plan counters.

It increments exactly once for each committed care transition, four-hour boundary, eight-hour boundary, and rebaseline. A read, retry, polling request, render, or Realtime notification does not increment it. The active snapshot and plan both declare the revision that published them.

### 7.3 Optimistic transaction

Edge Functions do not compose several independent Supabase calls and label them atomic. The transition is:

1. `prepare_growth_transition_v3(tree_id)` returns database `server_now_ms`, revision, snapshot, active plan, and an idempotency hit if one exists.
2. The Edge Function validates inputs and computes the pure deterministic transition outside a database transaction. This step receives only data returned by step 1; it does **not** allocate `eventSequence` or `committedRevision`, which are database-assigned in step 3. The `careEventId` hash therefore uses `eventSequence` and `committedRevision` values allocated inside step 3, not pre-computed here.
3. `commit_growth_transition_v3(...)` is one Postgres function call. It locks the tree row, allocates the next `event_sequence` and `revision`, checks idempotency first, checks `expectedRevision`, computes `careEventId` from the now-known sequence/revision, validates hashes/schema/ledger totals, inserts immutable records, updates the tree head, and commits.
4. Revision mismatch returns `409 REVISION_CONFLICT` with the current revision and envelope ETag. The server recomputes from the new head only on a new attempt; it does not patch stale output.
5. A database/deadlock/transient failure returns `503 RETRYABLE`. The client retries the identical body and idempotency key.

Idempotency table uniqueness is `(tree_id, idempotency_key)`. If a key already committed, the function returns the stored status/body/revision without evaluating the action again. Reuse of a key with a different canonical request hash returns `409 IDEMPOTENCY_KEY_REUSED`. No failed pre-commit attempt reserves the key forever.

The Realtime/Broadcast notification is emitted only after commit. Delivery is advisory; a missed broadcast is repaired by polling or resume resync.

### 7.4 Consumable/inventory transaction boundary (FINDING-5)

Actions that consume inventory items (fertilizer, twine, wire, weight, SLP, tools) are **not** part of the growth-plan transaction. The integration boundary is:

1. The Edge Function validates item availability and debits the inventory/consumable table inside `commit_growth_transition_v3` **within the same Postgres function call** and database transaction as the growth state commit.
2. If the growth commit succeeds but inventory was already consumed by a concurrent request, the transaction rolls back entirely.
3. The spec does not define the consumable schema; it defines only that the debit must be atomic with the growth state transition. The existing inventory/economy schema is the authority for consumable tables.

This prevents the failure mode where a fertilizer is consumed but the growth transition is rejected by OCC, or vice versa.

## 8. Pruning, ownership, and receipt

### 8.1 Multi-source voxel ownership

`SparseVoxelSet` becomes a coordinate map to a sorted owner list, not a last-writer cell:

```ts
interface VoxelOwnerV2 {
  ownerId: string;       // event/source identity
  branchId: number;
  branchDepth: number;
  sourceKind: 'root' | 'wood' | 'canopy' | 'prune-stump';
  material: Material;
  role: VoxelRole;
}

interface VoxelCellV2 {
  owners: readonly VoxelOwnerV2[];
  primaryOwnerIndex: number;
  presentationOverlay?: 'prune-scar';
}
```

Owners sort by `(branchDepth, branchId, sourceKindPriority, ownerId)`, where source-kind priority is root, wood, prune-stump, canopy. The first owner is the primary stat/material owner. Jin changes that owner's role to `SCAR` only on the jinned range. `presentationOverlay: prune-scar` changes material at render time but never changes role.

This ordering is independent of traversal and persists when one owner is removed. A coordinate is live while at least one live owner remains. Serialization sorts coordinate keys, then owners by the order above.

### 8.2 Ordinary endpoint and canopy fixes

- A non-jinned branch uses `jinThreshold = null`, not `1.0`. `fillTube` checks SCAR only when the threshold is non-null. Thus `t == 1` is ordinary wood.
- Canopy is stored canonical state created by charged `CANOPY_CELL` events. Voxelization does not infer foliage from `children.length` or from becoming terminal after a prune.
- Pruning a last child can make its parent eligible for new canopy only in the next day plan. It creates none in the prune transaction.

### 8.3 Stump

An accepted prune records the cut on the surviving parent at the child's stored attachment point. The stump consists only of already-live surviving parent cells intersecting the versioned cut plane. Those cells receive `presentationOverlay: prune-scar`; no new structural voxel is created. If visual closure needs a new cap cell, that cap is charged to the pruned branch's remaining allocation before cancellation; if no allocation remains, the overlay alone is used. In either case the role remains the parent's role and grants no Defense.

### 8.4 Receipt schema and delta rules

```ts
interface PruneReceiptV1 {
  receiptVersion: 1;
  careEventId: string;
  treeId: string;
  targetBranchId: number;
  acceptedAtMs: number;
  preRevision: string;
  postRevision: string;
  preStateHash: string;
  postStateHash: string;
  preVoxelHash: string;
  postVoxelHash: string;
  removedBranchIds: readonly number[];
  removedLiveVoxelCount: number;
  removedLiveVoxelCountByRole: Readonly<Record<VoxelRole, number>>;
  removedLiveVoxelDigest: string;
  removedOwnerClaimCount: number;
  overlappingSurvivingVoxelCount: number;
  overlappingSurvivingVoxelDigest: string;
  cancelledEventIds: readonly string[];
  cancelledPlannedGrowthGU: string;
  cancelledPlannedVoxelCount: number;
  cancelledEscrowGU: string;
  sameDayRefundGU: '0';
  preservedPruneStumpSurfaceCount: number;
  cut: {
    parentBranchId: number;
    removedBranchId: number;
    attachmentQ4: number;
    worldAnchorQ4: readonly [number, number, number];
    tangentQ4: readonly [number, number, number];
  };
  statsBefore: StatSheet;
  statsAfter: StatSheet;
  matchPctBefore: number;
  matchPctAfter: number;
}
```

The pre-set is the canonical voxelization after materializing to `acceptedAtMs`; the post-set is a fresh canonical voxelization after the subtree is marked pruned.

- A **removed live voxel** is a coordinate live in pre and absent in post. Counts use its pre primary role.
- `removedLiveVoxelDigest` hashes sorted records `[packedCoordinate, prePrimaryRole, sortedRemovedSourceBranchIds]`.
- An **overlapping surviving voxel** had at least one removed owner in pre and at least one live owner in post. It is not in removed counts. Its digest hashes `[packedCoordinate, sortedRemovedOwnerIds, sortedSurvivingOwnerIds]`.
- `removedOwnerClaimCount` exposes resolution loss hidden by a unique-coordinate count.
- `cancelledPlannedVoxelCount` is the number of future unique coordinates that the cancelled events would newly occupy by day end under the pre-prune plan. It is simulated from the immutable old plan and is not added to live loss.
- All removed branch IDs, event IDs, and digest records are sorted. Replay from genesis and replay from the previous snapshot must produce byte-identical receipt JSON.

## 9. Stable roles and stat semantics

### 9.1 Stable branch role

Add immutable `stableRole` to every branch:

```ts
type StableBranchRole = 'trunk' | 'arm' | 'leg' | 'digit';
```

- Trunk is always `trunk`.
- Depth two and deeper are always `digit`.
- At a depth-one fork, classify the newborn sibling group by `(attachmentYQ4, branchId)` before publishing it. One child is `arm`; for two or more, the lower `ceil(n/2)` are `leg` and upper `floor(n/2)` are `arm`.
- Existing depth-one branches receive the same sort once at rebaseline. The result is then frozen, including on pruned historical records.
- A later fork classifies only its newborn sibling group; it never re-ranks older branches.
- `Voxelizer` reads `stableRole`; it does not sort the live population.

### 9.2 Stat table

| Field | V3 authority | Prune behavior | Season behavior |
|---|---|---|---|
| `hp` | live primary `TRUNK` cells plus HP terrain | changes only for actually removed/re-resolved cells | none |
| `power` | live primary `ARM` cells plus Power terrain | removed ARM cells can lower it; surviving LEG never becomes ARM | none |
| `endurance` | live primary `LEG` cells plus Endurance terrain | removed LEG cells can lower it; surviving ARM never becomes LEG | none |
| `ki` | live primary `CANOPY` cells plus Ki terrain | removed canopy can lower it | none |
| `skillSlots` | existing live `DIGIT` morphology formula | can fall when live DIGIT cells are removed | none |
| `skillPoints` | terrain contribution over the current live voxel set | changes only when the removed/re-resolved coordinates themselves carry skill-point terrain; never coupled to or clamped by `skillSlots` | none |
| `wisdom` | completed eight-hour game days | none | none |
| `matchPct` | current canonical live voxel set | may rise or fall; recompute | none |
| `defense` | current live primary `SCAR` cells | removed SCAR lowers it; prune-stump overlay adds zero | none |
| `stability` | terrain-only current rule | only coordinate/terrain changes apply | none |

`skillSlots` and `skillPoints` are deliberately independent. A depth-two prune may remove move slots without changing skill points when those removed coordinates contributed no skill-point terrain. V3 must not add `skillPoints = min(skillPoints, skillSlots)` or any other implicit coupling.

Historical `jin`, prune, wire, and landscape actions remain available to `TechniqueClassifier`. They do not create detached live stat bonuses. `jin(A) -> prune(A)` retains Jin history but loses A's SCAR Defense; `jin(A) -> prune(B)` retains A's live SCAR Defense.

## 10. Species canopies and presentation-only seasons

### 10.1 Canonical canopy grammar

Canopy candidates are integer local cells transformed by the branch-tip orthonormal basis. Candidate order is `(spatialHash(seed, branchId, localX, localY, localZ), localX, localY, localZ)` ascending. An already-owned candidate can gain another owner but cannot replace it.

| Species | Integer candidate predicate | Silhouette |
|---|---|---|
| Hardwood | `(x/3)^2 + (y/2)^2 + (z/3)^2 <= 1` | rounded irregular crown |
| Evergreen | `(x/4)^2 + (y/1)^2 + (z/3)^2 <= 1` | flat, layered fan pad; this is also the juniper-like evergreen treatment |
| Tropical | `(x/4)^2 + (y/2)^2 + (z/4)^2 <= 1` and `y >= -1` | broad umbrella crown |

The divisions above are evaluated as integer cross-products, not floats. Evergreen's vertical radius is exactly one cell; it is not the old radius-two sphere. **Intentional rounding note (FINDING-8):** integer division in these predicates truncates toward zero, which is permissive — integer truncation in the quotient reduces the squared terms, producing a slightly wider acceptance region than the continuous ellipsoid. This is deliberate: it produces deterministic compact silhouettes. The `<=` comparator combined with truncation means the effective boundary is slightly inside the continuous ellipsoid surface.

A terminal branch is canopy-eligible only when, at day start, it is live, non-jinned, at least two completed game days old, health is at least 40, and the day's moisture factor is positive. Neglect blocks new canopy allocation but does not erase canonical leaves. A prune never invokes this eligibility mid-day.

### 10.2 Seasons

`season-v1` is derived only for presentation:

```text
SEASON_LENGTH_GAME_DAYS = 90   // CONFIRMED by owner 2026-09-26.
                               // 4 seasons per 360 game-day year.
seasonIndex = floor(dayIndex / SEASON_LENGTH_GAME_DAYS) mod 4
0 spring, 1 summer, 2 autumn, 3 winter
```

Exact overlays:

| Season | Hardwood | Evergreen | Tropical |
|---|---|---|---|
| spring | base leaf color mixed 20% toward light green | base color | base color mixed 10% toward light green |
| summer | base color | base color | base color |
| autumn | deterministic red/amber palette by coordinate hash | base fan remains; 20% hash-selected cells receive a brown dried-foliage tint | 10% hash-selected cells receive a yellow tint |
| winter | only cells with `spatialHash(...) mod 5 == 0` are drawn; others are presentation-hidden | all canonical fan cells remain drawn | all canonical cells remain drawn with 10% lower saturation |

Hidden or tinted cells remain in canonical voxel serialization, state hash, combat snapshot, and StatDeriver input. The display envelope carries `season` and `paletteVersion` outside the canonical hash. The 90-day length and palette are safe defaults and may be changed only by a new presentation version; no rebaseline is needed.

## 11. Persistence, migration, and rebaseline

### 11.1 Database objects

Add one migration: `apps/server/supabase/migrations/20260925000001_growth_v3.sql`.

It adds to `trees`:

```text
engine_version          TEXT NOT NULL DEFAULT 'legacy-unversioned'
state_schema_version    SMALLINT NOT NULL DEFAULT 1
revision                BIGINT NOT NULL DEFAULT 0
event_sequence          BIGINT NOT NULL DEFAULT 0
state_hash              CHAR(64)
active_snapshot_id      CHAR(64)
active_plan_id          CHAR(64)
last_materialized_at_ms BIGINT
rebaseline_status       TEXT NOT NULL DEFAULT 'pending'
```

It creates:

- `tree_growth_snapshots(tree_id, snapshot_id, revision, effective_at_ms, day_index, state_schema_version, engine_version, state_json, state_hash, created_at)`; immutable, unique `(tree_id, revision)`.
- `tree_growth_plans(tree_id, plan_id, revision, day_index, segment_index, interval_start_ms, interval_end_ms, plan_schema_version, engine_version, status, plan_json, plan_hash, parent_plan_id, created_at)`; immutable payload, status only transitions active -> superseded/committed.
- `tree_growth_events(tree_id, plan_id, event_id, branch_id, kind, segment_index, start_offset_ms, end_offset_ms, allocation_gu, status, event_json)`; immutable payload, status records retain/cancel/materialize.
- `tree_care_events(tree_id, care_event_id, accepted_at_ms, event_sequence, base_revision, committed_revision, idempotency_key, request_hash, action_json, response_json, result_state_hash, result_plan_hash)`; unique `(tree_id,idempotency_key)` and `(tree_id,event_sequence)`.
- `tree_prune_receipts(tree_id, care_event_id, receipt_json, receipt_hash)`; one-to-one with prune care event.
- `tree_rebaseline_audit(tree_id, from_engine_version, to_engine_version, status, pre_hash, post_hash, reason, performed_at)`; append-only.
- boundary idempotency uniqueness on `(tree_id, effective_at_ms, engine_version)`.

Rows are never deleted by the migration. RLS keeps private snapshots/actions owner-readable; the public endpoint exposes only the safe display envelope.

### 11.2 Testnet policy

There are no mainnet kijonsai to migrate. Existing Saigon trees are disposable as baselines but not deletable data.

| Existing row | Policy |
|---|---|
| valid finite seed/species/care log, deterministic replay succeeds twice | reconstruct at cutover with the frozen pre-V3 bundle, assign stable roles, import current canopy as `LEGACY_REBASELINE_BASELINE`, create V3 snapshot/revision/plan, preserve the old row and full care history |
| legacy fields missing but deterministic defaults exist | fill only the documented legacy defaults, record every default in `tree_rebaseline_audit`, then rebaseline |
| unknown action, non-finite value, broken branch reference, or replay/hash mismatch | mark `quarantined`; preserve all bytes; block care writes with `409 REBASELINE_REQUIRED`; do not guess or delete |
| new tree at or after cutover | create natively as V3 |

The Implementer freezes the immediately pre-V3 replay bundle under `apps/server/supabase/functions/_shared/legacy-growth-v2/` solely for rebaseline. It is not a selectable live engine afterward. Existing renders are marked stale by revision and re-enqueued only after their tree reaches `ready`. Golden fixtures are re-recorded only in the dedicated baseline phase after old and new outputs are reported side-by-side and owner acceptance is recorded.

## 12. Shared display envelope and resynchronization

### 12.1 Envelope

Both authenticated `get-tree` and public `get-tree-public` call the same `_shared/build-display-envelope.ts`. The private response may wrap owner controls around it, but the embedded envelope is byte-identical.

```ts
interface TreeDisplayEnvelopeV1 {
  envelopeVersion: 1;
  treeId: string;
  tokenId: string | null;
  engineVersion: 'growth-v3.0.0';
  stateSchemaVersion: 3;
  planSchemaVersion: 1;
  revision: string;
  serverNowMs: number;
  snapshot: {
    snapshotId: string;
    effectiveAtMs: number;
    dayIndex: number;
    stateHash: string;
    canonicalState: unknown;
  };
  segment: {
    planId: string;
    planHash: string;
    segmentIndex: 0 | 1;
    startMs: number;
    endMs: number;
    events: readonly GrowthEventV1[];
  };
  evaluatedAtServerNowHash: string;
  presentation: {
    season: 'spring' | 'summer' | 'autumn' | 'winter';
    paletteVersion: 'season-v1';
  };
  sync: {
    etag: string;
    pollAfterMs: 60_000;
    realtimeTopic: string;
  };
}
```

It excludes wallet IDs, private inventory, authorization data, internal receipts, and future unrevealed entropy. `ETag` is `"tree:<treeId>:rev:<revision>:plan:<planId>"`.

### 12.2 Client evaluator and clocks

On load, a client takes three envelope/HEAD clock samples, rejects samples with round-trip time over 2,000 ms, and uses the median offset:

```text
offsetMs = serverNowMs - floor((clientSendMs + clientReceiveMs) / 2)
estimatedServerNow = clientNowMs + offsetMs
```

Canonical evaluation uses integer milliseconds and ppm. If no valid sample exists, the client displays the committed snapshot and reports `clock-unsynchronized`; it does not invent progress.

Resync occurs:

- immediately on a higher revision Broadcast;
- at segment end, scheduled from authoritative offset;
- every 60 seconds while visible or in an active XR session;
- on `online`, `visibilitychange` to visible, page focus, wake, and WebXR visibility/session restoration;
- when measured clock offset differs by more than 250 ms;
- when local evaluated hash disagrees with `evaluatedAtServerNowHash`.

On a higher revision, canonical geometry switches atomically to the new envelope. A renderer may cross-fade old/new presentation for 250 ms, but picking, stats, hashes, and care requests use the new revision immediately.

If offline, a display may evaluate only through the received `segment.endMs`. At that point it freezes exactly at plan end and shows a stale indicator. It does not enter the next segment. On reconnect it discards stale future state, fetches the current envelope, evaluates at server time, and verifies the hash.

Broadcast payload is only `{treeId, revision, stateHash, planId}` on topic `tree:<treeId>:revision`. Polling with `If-None-Match` is mandatory fallback; Broadcast delivery is never treated as durable.

### 12.3 Surfaces

- `ThreeCanvas.tsx`, `main3d.ts`, and `main2d.ts` use the same `PlanEvaluator`; none calls `growTick` to animate.
- Add `apps/web/src/public-viewer.ts` and `apps/web/index-viewer.html` because the stale documented viewer source is absent.
- Looking Glass mode and WebXR mode are renderer adapters over the same evaluated voxel set. They receive no special growth logic.
- `CombatSnapshot.ts` includes `revision`, `stateHash`, and `voxelHash` from the same evaluation.
- Render-worker jobs are keyed by `(treeId, revision, stateHash)` so an old job cannot overwrite a newer render.

Browser desktop convergence can be automated. Looking Glass hardware and headset WebXR visual/restore behavior remain **HARDWARE-UNVERIFIED** until observed on those devices. An emulator or ordinary browser is not sufficient evidence for a hardware claim.

## 13. Exact package and file impact

The file list is intentionally explicit. A later stage may split a file only with Critic approval; it may not move authority across package boundaries.

| File | Intended change |
|---|---|
| `packages/shared/src/growth-v3.ts` (new) | versions, q4/GU DTOs, plans, events, care V2, receipts, envelope, validators |
| `packages/shared/src/index.ts` | export V3 contracts; add `Branch.stableRole`, birth day, canopy ownership/escrow state |
| `packages/engine/src/GrowthLedger.ts` (new) | bigint cost equations, largest remainder, conservation assertions |
| `packages/engine/src/GrowthPlanner.ts` (new) | immutable day snapshot weights, allocation, event IDs/timing |
| `packages/engine/src/GrowthMaterializer.ts` (new) | integer-ppm evaluation and boundary materialization |
| `packages/engine/src/CanonicalHash.ts` (new) | canonical JSON and SHA-256 adapter contract |
| `packages/engine/src/GrowthEngine.ts` | retire branch-local V3 mutation path; expose pure v2 morphology eligibility helpers to planner |
| `packages/engine/src/BonsaiTree.ts` | V3 state/version fields and stable role initialization; preserve existing care APIs |
| `packages/engine/src/CareLogReplay.ts` | version dispatch; order `CareEventV2`; materialize-before-action |
| `packages/engine/src/PruneEngine.ts` | pure topology/cut result only; no voxelizer import and no receipt fabrication |
| `packages/engine/src/StatDeriver.ts` | enforce section 9 independence and multi-owner primary-role input |
| `packages/engine/src/index.ts` | export new pure modules |
| `packages/voxelizer/src/CanopyGrammar.ts` (new) | exact species candidate predicates and deterministic ordering |
| `packages/voxelizer/src/VoxelDigest.ts` (new) | multi-owner serialization, state/delta/prune digests |
| `packages/voxelizer/src/index.ts` | VoxelCellV2 owners, stable roles, null jin threshold, charged canopy state, stump overlay |
| `packages/voxelizer/src/CombatSnapshot.ts` | attach revision/state/voxel hashes; consume same evaluated state |
| `apps/server/supabase/migrations/20260925000001_growth_v3.sql` (new) | tables, constraints, RLS, prepare/commit/boundary functions |
| `apps/server/supabase/functions/_shared/growth-transition.ts` (new) | server-time prepare, pure compose, commit adapter |
| `apps/server/supabase/functions/_shared/build-display-envelope.ts` (new) | one public/private envelope builder |
| `apps/server/supabase/functions/_shared/legacy-growth-v2/` (new) | frozen rebaseline-only bundle |
| `apps/server/supabase/functions/care-action/index.ts` | V2 validation, OCC, idempotent commit, revision response |
| `apps/server/supabase/functions/get-tree/index.ts` | lazy catch-up and shared envelope |
| `apps/server/supabase/functions/get-tree-public/index.ts` | public-safe shared envelope and ETag |
| `apps/server/supabase/functions/advance-growth/index.ts` (new) | scheduled due-boundary worker using skip-locked claims |
| `apps/web/src/growth/PlanEvaluator.ts` (new) | pure envelope evaluation, hashes, freeze-at-end |
| `apps/web/src/growth/DisplaySync.ts` (new) | clock samples, Broadcast, polling, resume/resync |
| `apps/web/src/components/ThreeCanvas.tsx` | render evaluator output; revision-aware care and picking |
| `apps/web/src/main3d.ts`, `apps/web/src/main2d.ts` | use the same evaluator in debug pages |
| `apps/web/src/public-viewer.ts`, `apps/web/index-viewer.html` (new) | actual public NFT/Looking Glass/WebXR entry point |
| `apps/render-worker/src/queue.ts`, `worker.ts`, `glb.ts` | revision/state-hash job identity and stale-write guard |
| `DECISIONS.md`, `STATE.md`, `docs/KIJO-ARCHITECTURE.md`, `docs/KIJO-TECH-SPEC.md`, `docs/KIJO-ENGINE-API.md` | implementation-stage reconciliation after gates, never before observed results |

The existing untracked `_shared/care-plan.mjs` and `test-care-plan.mjs` are not in the change list and must remain untouched.

## 14. Red-test-first matrix

Every row starts red against current production behavior. Tests must be added before its implementation concern.

| ID | Red condition and expected acceptance |
|---|---|
| V3-L01 | Two trees with identical day-start state but different branch array traversal order produce byte-identical allocations, events, state hash, and voxel hash. |
| V3-L02 | Sum of branch allocations equals daily budget; for every branch the five ledger categories sum to allocation at 0h, 3h, 4h, care splice, 8h, and replay. |
| V3-L03 | Every positive extension, thickness, fork seed, support, and canopy delta has positive `chargedGeometryGU`; recomputed cost never exceeds allocation and never undercharges geometry. |
| V3-L04 | Adding eligible branches does not increase the tree daily budget. Sparse recipients get larger allocations than dense recipients under the same day-start factors. |
| V3-L05 | A child born at hour 1 has zero allocation through hour 8 and becomes eligible in the next day plan. |
| V3-C01 | Actions in the same millisecond order by `eventSequence`; genesis and snapshot replay agree. |
| V3-C02 | Same idempotency key/body returns the stored response under concurrent requests; exactly one care row/revision exists. Different body with same key is 409. |
| V3-C03 | Two writers with one base revision yield one commit and one 409; recomputation from the winner converges. |
| V3-P01 | Unaffected events are byte-identical after a splice. Affected replacement events retain allocation/timing/entropy and receive deterministic new IDs. |
| V3-P02 | Water/fertilizer at hour 3 does not increase the current day's budget; the next day uses the changed day-start state. |
| V3-V01 | An ordinary non-jinned branch endpoint is not SCAR. This directly catches `t == 1` with threshold `1.0`. |
| V3-V02 | Pruning a last child creates no canopy immediately. New canopy can begin only under the next day plan and is charged. |
| V3-V03 | Every evergreen canopy has vertical local extent at most one cell and wider horizontal extent; it is not equal to the old radius-two sphere. Species outputs differ deterministically. |
| V3-O01 | Remove one of two owners at the same coordinate: coordinate survives, surviving owner becomes primary, and receipt records overlap rather than live loss. |
| V3-R01 | Mid-segment prune receipt has sorted permanent IDs, unique live loss, owner-claim loss, canceled future voxels/GU, stump provenance, and refund exactly zero. |
| V3-R02 | Replay receipt from genesis and preceding snapshot is byte-identical. Canceled subtree events never reappear after reconnect or boundary commit. |
| V3-S01 | Pruning a LEG never relabels an ARM or vice versa. Only actually removed/re-resolved role cells affect structural Power/Endurance. |
| V3-S02 | A depth-two prune can lower `skillSlots` while `skillPoints` remains identical when removed coordinates have no skill-point terrain. A terrain-contributing removal changes only its calculated terrain amount. |
| V3-S03 | `jin(A)->prune(A)` loses A Defense but retains Jin provenance; `jin(A)->prune(B)` retains A Defense. Prune-stump overlay adds zero Defense. |
| V3-S04 | Spring/summer/autumn/winter presentations have identical canonical canopy, Ki, stats, state hash, and combat snapshot. |
| V3-T01 | Healthy positive-budget tree differs visibly and canonically between 0h and 3h. Zero-budget neglected tree does not grow. No day-level system advances at 4h. |
| V3-T02 | At exactly 4h and 8h, repeated scheduled/lazy calls commit each boundary once with no pop, rollback, duplicate age, or duplicate economy settlement. |
| V3-T03 | Continuous-open, close/reopen, background/resume, and genesis/snapshot replay produce the same evaluated hash at the same server millisecond. |
| V3-D01 | Caretaker, public NFT page, 3D debug, 2D debug, render-worker input, and combat snapshot agree on revision/state/voxel hash. |
| V3-D02 | Offline client freezes at segment end, does not create segment 2, and converges after reconnect. Missed Broadcast is repaired by ETag poll. |
| V3-I01 | Unknown fields/actions, invalid UUIDs, stale revisions, non-finite/q4 values, negative GU, unsafe integers, malformed owner lists, and wrong versions fail closed without revision change. |
| V3-M01 | Valid legacy tree rebaselines twice to identical output. Invalid tree is quarantined without data deletion. Native V3 tree bypasses legacy replay. |
| V3-H01 | Automated browser WebXR/Looking Glass modes can share evaluator output, but the report labels actual device display/restore claims HARDWARE-UNVERIFIED until a signed manual observation exists. |

Fixture policy: add V3 fixtures beside old fixtures first. Do not overwrite current golden files in the same task that introduces the algorithm. The baseline task reports both hashes/counts and then replaces only the explicitly accepted testnet/golden baselines.

## 15. Requirement-to-change-to-test traceability

| Requirement | Primary change boundary | Proof |
|---|---|---|
| 8h day, two 4h segments | shared clock constants, planner, boundary worker | V3-T01, V3-T02 |
| One conserved immutable budget | `GrowthLedger`, `GrowthPlanner` | V3-L01-L04 |
| Charge all geometry | ledger cost equations, canopy grammar | V3-L02, V3-L03, V3-V03 |
| Authoritative within-day care/order | CareEventV2, transaction RPC | V3-C01-C03 |
| Stable plan/event identity and selective splice | planner/materializer | V3-P01, V3-P02 |
| Prune live loss, cancellation, no refund | voxel ownership, receipt, transaction | V3-O01, V3-R01, V3-R02 |
| No ID resurrection | branch allocator and replay validators | V3-R02, V3-I01 |
| Jin live Defense; ordinary cut no Defense | voxelizer and StatDeriver | V3-V01, V3-S03 |
| Stable roles and terrain skill points | Branch schema, voxelizer, StatDeriver | V3-S01, V3-S02 |
| Species canopy; presentation seasons | `CanopyGrammar`, presentation adapter | V3-V02, V3-V03, V3-S04 |
| Canonical voxel combat morphology | multi-owner serialization, CombatSnapshot | V3-O01, V3-D01 |
| Shared caretaker/NFT/XR state | envelope builder/evaluator/sync | V3-T03, V3-D01, V3-D02 |
| Preserve unrelated twine/weight/wire | influence sets and existing regression suite | existing TWE/Wire suites plus V3-P01 |
| Non-destructive testnet rebaseline | migration and audit tool | V3-M01 |
| Healthy/neglected/species/age variation | budget factors and species tests | V3-T01, V3-V03 plus multi-day matrix |
| Malformed/concurrent/retry safety | shared validators and commit RPC | V3-I01, V3-C02, V3-C03 |
| Hardware truthfulness | labeled manual gate | V3-H01 |

## 16. Implementation phases: one concern per task

Each numbered task is a separate implementation concern and receives its own red tests and review. Do not combine them into one broad rewrite.

1. **Shared V3 contracts only:** add versions, q4/GU types, DTOs, strict validators, and exports.
2. **Ledger arithmetic only:** integer physical-cost functions, largest remainder, and conservation assertions.
3. **Day planner only:** immutable snapshot roles/weights, allocation, IDs, segment split, and event scheduling.
4. **Materializer only:** integer-ppm evaluation, partial timestamps, and boundary application.
5. **Stable branch roles only:** birth/rebaseline assignment and removal of live-population ARM/LEG sorting.
6. **Voxel ownership only:** multi-source cells, deterministic primary owner, serialization, and ordinary endpoint SCAR fix.
7. **Canopy only:** charged stateful species grammars and removal of inferred terminal spheres.
8. **Prune receipt only:** pre/post voxel deltas, overlap proof, cancellation, escrow loss, and stump overlay.
9. **Stat semantics only:** stable roles, skill-slot/skill-point independence, Ki/Defense, and provenance separation.
10. **Care replay only:** CareEventV2 order, materialize-before-action, influence sets, and deterministic splicing.
11. **Database schema/commit only:** migration, immutable tables, OCC, idempotency, and boundary uniqueness.
12. **Care Edge Function only:** validation and prepare/compute/commit error mapping.
13. **Envelope/read endpoints only:** lazy catch-up, public filtering, one builder, ETag.
14. **Web evaluator/sync only:** clock sampling, Broadcast/polling, freeze/resume, no local growth.
15. **Public viewer adapters only:** actual NFT entry point, Looking Glass mode, WebXR mode; hardware claims remain unverified.
16. **Render/combat revision fencing only:** state-hash job keys and shared snapshot identity.
17. **Legacy rebaseline only:** frozen pre-V3 bundle, stable-role assignment, audit/quarantine, no deletion.
18. **Fixture/balance acceptance only:** side-by-side evidence, owner acceptance, then explicit fixture/render rebaseline.
19. **Documentation reconciliation only:** update `DECISIONS.md`, `STATE.md`, API/architecture/tech docs to observed implementation.

## 17. Runnable gates and gameplay demo

The Implementer adds these scripts to the root package manifest so the commands below are the stable interface:

```powershell
npm run test:growth-v3:shared
npm run test:growth-v3:ledger
npm run test:growth-v3:planner
npm run test:growth-v3:voxel
npm run test:growth-v3:prune
npm run test:growth-v3:stats
npm run test:growth-v3:server
npm run test:growth-v3:display
npm run test:growth-v3:rebaseline
npm run test:growth-v3:determinism -- --runs 2
npm run typecheck
npm test
```

The determinism command writes two canonical state, plan, receipt, and voxel serializations for the same scenarios and exits nonzero on any byte difference. The full existing Growth, Prune, Voxelizer, StatDeriver, Wire, TwineWeight, Jin, cost-guard, and care-log suites remain required; V3 may update accepted baselines only in phase 18, not weaken assertions.

The gameplay proof is:

```powershell
npm run demo:growth-v3 -- --seed 464497 --species hardwood --clock manual
```

The manual-clock demo must expose controls for `+1h`, `+3h`, `to 4h`, `to 8h`, reload, offline/online, water, rotate, jin, and prune. Its scripted acceptance sequence is:

1. Start a healthy tree at hour 0 in caretaker and public viewers; record revision/hashes.
2. Advance to hour 3; show visible charged extension and identical hashes in both viewers.
3. Reload public viewer at the same simulated server time; prove the same output as continuously open.
4. Submit water with an idempotency key; prove one revision, unchanged same-day budget, and retry-identical response.
5. Submit rotate; prove only direction-dependent future events are replaced.
6. Advance into segment 1, prune an overlapping branch, and display the full receipt. Prove surviving overlap, no instant canopy, no refund, and immediate live-stat result.
7. Disconnect before a boundary, advance beyond it, and prove freeze. Reconnect and prove authoritative catch-up.
8. Toggle all four season presentations at one timestamp and prove identical canonical/Ki/combat hashes.
9. Run the same end state from genesis and from the latest snapshot; byte-diff all artifacts.

Desktop/browser output is a software gate. Looking Glass and headset execution get a separate checklist with device model, browser/runtime version, tested restore sequence, observed result, operator, and date. Until that exists, reports must say **HARDWARE-UNVERIFIED**.

## 18. Assumptions, defaults, and Critic focus

No repository-answerable question is left open. The following are explicit architecture choices, not hidden facts:

- The initial daily volume constants, 90-day season length, canopy radii, and 15-minute emergence window are safe V3 defaults. They are versioned and may be tuned prospectively after phase-18 evidence.
- V3 does not model canonical leaf drop or root expansion. It blocks new growth under neglect and keeps season effects presentational. Adding either later requires a charged event and a new balance version.
- Mid-day water/fertilizer affects next-day growth, not the immutable current budget. This is the safest anti-exploit interpretation of day-start conservation.
- Multi-source primary-owner order intentionally counts a coordinate once for structural stats. Owner claims remain available in receipts so overlap is not hidden.
- Existing testnet rows are preserved or quarantined. The default for any uncertain legacy value is quarantine, not invention or deletion.

Critic should concentrate on integer equation overflow bounds, PostgreSQL atomicity/constraint completeness, canonical serialization portability, primary-owner stat implications, plan-splice influence sets, and whether every current renderer truly reaches the one evaluator. Those are review risks, not unresolved design choices.

## 19. Architecture completion statement

This artifact resolves all ten preflight architecture questions and names the changes and evidence required to implement them. Production code, migrations, fixtures, deployments, commits, and data were not changed by the Architect. Approval belongs to a fresh Critic; this document does not self-approve.
