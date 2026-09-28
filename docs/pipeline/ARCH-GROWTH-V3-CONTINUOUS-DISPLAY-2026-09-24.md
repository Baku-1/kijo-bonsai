---
title: "V3 Continuous Growth and Living NFT Display"
page_type: decision
project: kijo
updated: 2026-09-24
status: approved
implementation_status: not-started
sources:
  - wiki/concepts/kijo-caretaker-idle-loop.md
  - wiki/decisions/nft-display-pipeline.md
  - wiki/patterns/kijo/threejs-webxr-viewer.md
---

# V3 Continuous Growth and Living NFT Display

## Owner Decision

Approved by Jeremy on 2026-09-24.

A healthy Kijonsai with a positive growth budget must visibly grow throughout a multi-hour viewing session. A player who leaves the caretaker browser open for three hours must witness structural progress. Closing and reopening the browser at the same server timestamp must reconstruct the same visible tree. Boundary-only visual popping every four or eight hours is rejected.

This requirement applies equally to:

- the authenticated caretaker view;
- the public NFT `animation_url` viewer;
- a long-running Looking Glass holographic display;
- compatible Meta/WebXR headsets or glasses;
- future third-party WebXR and voxel displays using the public tree contract.

## Clock Model

- The proposed canonical growth-planning interval is four real hours.
- The established game day remains eight real hours unless separately changed, so two growth intervals equal one game day.
- Age, Wisdom, daily ingredients, daily morale, and day-based tool timers do not automatically double.

## Canonical State Model

At any instant the visible tree is derived from:

`last committed snapshot + immutable active growth plan + server-time progress`

At the start of an interval, the authoritative server creates a deterministic growth plan from the interval-start snapshot. The plan contains all branch extension, thickening, canopy, and deterministic event information needed to evaluate visible progress at any timestamp within that interval.

The client never creates growth. It evaluates and animates a server-authoritative plan.

## Tree-Level Daily Growth Budget

The canonical growth allowance belongs to the whole tree for one eight-hour game day. A branch does not receive an independent fixed daily amount merely because it exists. This prevents a tree from manufacturing more total growth only by having more branches.

At the game-day boundary, V3 must:

1. Reconstruct one immutable day-start snapshot.
2. Calculate one fixed-point `dailyGrowthBudget` from the tree's species, health, moisture, care state, age/vigor rules, and versioned balance constants.
3. Determine every eligible living branch and its weight from that same snapshot.
4. Allocate the conserved budget proportionally:

   `branchAllocation = dailyGrowthBudget * branchWeight / sum(eligibleBranchWeights)`

5. Quantize allocations with a documented deterministic remainder rule so their exact sum equals the daily budget.
6. Divide each branch's allocation across the two four-hour presentation intervals. The intervals reveal one daily plan; they do not create two daily budgets.

Branch weight may differ by species, depth, vigor, apical role, light/rotation, damage, and prune/jin state. All role and weight decisions use the same day-start topology. Multiple branches therefore grow concurrently at different speeds without traversal order changing the result. A branch born during the current day starts receiving growth on the next game-day plan.

The daily plan contains stable event identities and offsets for extensions, thickening, forks, and canopy additions. Replanning after care may change only the affected remaining work. It must not reroll unaffected events.

### Sparse and Dense Trees

- A sparse tree divides the same tree-level budget among fewer eligible branches, so each may lengthen or thicken more.
- A dense tree divides the budget among more branches, producing finer distributed growth.
- An old sparse tree remains visually old through trunk maturity, bark, scars, age, and Wisdom. Age alone does not create free structural mass.
- Pruning can focus later growth, but cannot refund growth already assigned to the removed subtree during the current game day.

## Pruning, Lost Voxels, and Permanent Provenance

Owner clarification approved on 2026-09-24: pruning must preserve the existing lost-voxel consequence. A prune is a permanent structural and statistical loss, followed by more focused future growth in surviving branches.

When a prune is accepted during an active interval, the server must perform this transaction atomically:

1. Materialize the active plan through the authoritative action timestamp.
2. Voxelize the materialized pre-prune tree and record its canonical hash.
3. Mark the selected branch and every descendant as pruned.
4. Cancel all unmaterialized plan events belonging to that subtree. These cancelled future voxels were never earned and are reported separately from lost live voxels.
5. Re-voxelize from canonical branch state with the pruned subtree excluded.
6. Preserve only the versioned cut-plane stump representation and its source branch/location provenance.
7. Compute the lost-live-voxel delta from the pre-prune and post-prune canonical voxel sets.
8. Recompute morphology, Flower Guild match, and combat stats from the post-prune live voxel set.
9. Persist the prune event, delta receipt, new revision, and post-prune state hash before publishing a replacement display plan.

The canonical delta must distinguish:

- `removedBranchIds`: the target and descendant branch identities permanently removed from the live tree;
- `removedLiveVoxelCountByRole`: live TRUNK/ARM/LEG/DIGIT/CANOPY/ROOT/SCAR counts lost at the accepted timestamp;
- `removedLiveVoxelDigest`: a deterministic digest of the coordinate/role/source-branch delta;
- `cancelledPlannedVoxelCount`: future interval voxels cancelled before materialization and therefore never counted as owned tree mass or stats;
- `preservedPruneStumpSurfaceCount` and cut-plane provenance;
- stat and match values before and after the prune.

The delta is computed by canonical re-voxelization rather than deleting every coordinate formerly stamped with one branch ID. This matters where branches overlap: a coordinate still occupied by another living source remains present. V3 must either retain multi-source occupancy during delta calculation or produce an equivalent deterministic result that cannot erase a surviving branch's voxel.

### Growth Budget After a Prune

- The removed subtree's unused allocation for the current game day is discarded.
- Surviving branches do not receive an immediate same-day refund. This prevents a player from gaining extra mass by timing a prune near an interval boundary.
- At the next eight-hour game-day boundary, the new tree-level budget is distributed across the surviving eligible branches. This is when pruning begins to focus growth energy into them.
- A prune during the first four-hour interval and the same prune at the equivalent materialized state during the second interval must have identical structural consequences apart from the voxels that had legitimately materialized before the cut.

### Rendering and Stat Consequences

- Removed wood, digit, and canopy voxels disappear from caretaker, NFT, WebXR, Looking Glass, and combat morphology output on the new revision.
- Removed canopy voxels lower Ki immediately because Ki is derived from canonical live canopy mass.
- Seasons may recolor, hide, or restyle foliage for presentation, but they never remove canonical canopy voxels or lower Ki. A prune is structural; a season is visual.
- The fighter generated from the tree keeps the same loss: a pruned limb/digit/crown region is absent, while the retained stump/cut surface appears at the mapped body location.
- A pruned branch ID is never recycled. Catch-up, replay, reconnect, or plan regeneration may never make its voxels live again.

### Pruning Acceptance Gates

1. Prune a branch midway through an interval: every materialized voxel belonging only to that subtree is absent from the new live set.
2. Confirm the pre/post lost-voxel digest is identical when replayed from genesis and from the preceding snapshot.
3. Confirm overlapping voxels backed by a surviving branch remain live.
4. Confirm all subtree plan events are cancelled and cannot appear after reconnect or interval finalization.
5. Confirm no same-day budget refund occurs and the next game day redistributes its budget across surviving branches.
6. Confirm removed canopy lowers Ki while a seasonal foliage change does not.
7. Confirm the caretaker tree, public NFT, XR display, and combat morphology payload share the same post-prune revision and state hash.
8. Confirm the stump/cut surface remains permanently attributable to the original branch and cut location.

## Jin, Defense, and Later Pruning

Jin Defense remains voxel-grounded. `VoxelRole.SCAR` is intentional jin deadwood or a wire-overstay scar; it is not the visual byproduct of an ordinary prune. Each live SCAR voxel contributes the versioned structural Defense amount.

If a jinned branch or descendant is later pruned:

- every SCAR voxel removed with that subtree stops contributing Defense immediately;
- SCAR voxels on other surviving branches continue contributing Defense;
- the prune retains a visible cut surface using the render-only `Material.PRUNE_SCAR` treatment on the surviving side of the cut, with the surviving voxel's morphology role unchanged;
- that cut material adds no replacement Defense because material answers how a voxel looks while role answers what stat-bearing structure it is;
- the historical `jin` care event and Jin technique overlay may remain as provenance, but neither creates a detached or permanent stat bonus.

This rule prevents ghost Defense. The current Defense total must always be reproducible from the current canonical live voxel set. Replay order therefore matters in the expected way: `jin(branch) -> prune(branch)` records both actions but produces no Defense from the removed jin region, while `jin(branch A) -> prune(branch B)` retains branch A's live SCAR Defense.

### Jin/Prune Acceptance Gates

1. Jin a branch, record its SCAR count and Defense, then prune that branch: the removed SCAR count and corresponding Defense disappear.
2. Jin two branches and prune one: only the surviving branch's SCAR Defense remains.
3. Replay the same ordered care log from genesis and from a snapshot: post-prune SCAR count, Defense, revision, and state hash match.
4. Confirm the prune cut is visually present but does not increment `VoxelRole.SCAR` or Defense.
5. Confirm the Jin technique overlay follows its care-history rule independently of the live Defense calculation.

## Current Implementation Gap

This document is the approved V3 design target, not a claim that the current engine already satisfies it.

- `GrowthEngine.ts` currently calculates extension independently for each visited branch; it does not conserve a tree-level daily budget or apply all branch roles from one immutable snapshot.
- `PruneEngine.ts` currently marks the target subtree `pruned`, logs the action, and marks the tree dirty. It does not calculate a voxel-loss receipt, record a cut-plane anchor, discard/track active-plan allocation, or implement the documented future-growth redistribution.
- `Voxelizer.voxelize()` currently skips pruned branches. That correctly removes their live wood, canopy, and jin SCAR voxels during a fresh derivation, so Defense from a pruned jin region disappears. It does not yet render an ordinary prune cut with `Material.PRUNE_SCAR`.
- `StatDeriver` already derives structural Defense from current `VoxelRole.SCAR` count. V3 must preserve that live-voxel rule rather than adding historical stat bonuses.
- Technique classification counts historical care actions, so the Jin overlay can remain after its physical deadwood is later removed. That classification is provenance and must not be used as a Defense input.

## Continuous Presentation

A renderer evaluates normalized progress:

`u = clamp((serverNow - intervalStart) / (intervalEnd - intervalStart), 0, 1)`

Branch length, thickness, and canopy emergence are evaluated from the plan at `u`. Fork and foliage events receive deterministic offsets inside the interval so they emerge without boundary popping.

The same plan and timestamp must produce the same visible geometry in caretaker, public browser, Looking Glass, Meta/WebXR, and server verification paths.

## Care Actions During an Interval

When a care action is accepted:

1. Materialize the active plan through the authoritative server timestamp.
2. Persist that exact progress and the ordered care action.
3. Increment the public tree/plan revision.
4. Generate a deterministic replacement plan for the remaining interval from the updated state.
5. Notify or allow displays to discover the new revision.

This makes care responsive while preserving deterministic replay.

## Long-Running Display Synchronization

A display does not write state continuously. On initial load it fetches a public-safe display envelope containing:

- token ID and engine version;
- committed state or reconstructable snapshot reference;
- active plan;
- interval start and end server timestamps;
- tree/plan revision;
- canonical state hash.

It then animates locally from synchronized server time. It refreshes:

- at interval boundaries;
- when a public tree/plan revision changes after care;
- after reconnect, focus, wake, or WebXR session restoration;
- when its local clock-drift tolerance is exceeded.

Supabase Realtime or a lightweight revision subscription is preferred for immediate cross-device care updates. Bounded polling remains a fallback. A care action performed on a phone can therefore appear on an owner's separate Looking Glass or compatible Meta/WebXR display without restarting the display.

## Offline and Recovery Behavior

If a display loses its network connection, it may continue animating only the already received immutable plan through that plan's end. It must not invent the next interval. On reconnect it requests the current envelope and deterministically catches up.

Browser throttling cannot affect growth. Visibility and WebXR session resume handlers always resynchronize from server time.

## Economy and Rate Preservation

Splitting the existing eight-hour progression into two four-hour intervals requires rate conversion rather than copying full-day effects twice:

- linear growth, thickening, moisture, and health rates are proportionally divided;
- probabilistic events use equivalent hazard conversion;
- Wisdom and age use completed eight-hour game days;
- daily ingredient and morale rules remain attached to the approved game-day economy;
- twine, weight, wire, fertilizer, and other day-based durations retain their real-time meaning.

## Acceptance Gates

1. Open a healthy tree for three hours: geometry visibly progresses.
2. Open two independent viewers for the same token: their geometry hashes match at the same timestamp tolerance.
3. Close at hour one and reopen at hour three: output matches a continuously open viewer.
4. Perform care on another device: the display receives a new revision and transitions to the replacement plan.
5. Sleep/wake or background the browser: no lost or duplicate growth.
6. Cross a four-hour boundary: the completed plan commits once and the next plan begins without a pop or rollback.
7. Disconnect past a boundary: the display freezes at the known plan end, then catches up authoritatively on reconnect.
8. Caretaker, public NFT, Looking Glass, and compatible Meta/WebXR renderers agree on canonical structure.

## Related Pages

- [[kijo-caretaker-idle-loop]]
- [[nft-display-pipeline]]
- [[threejs-webxr-viewer]]
- [[wisdom-stat]]
