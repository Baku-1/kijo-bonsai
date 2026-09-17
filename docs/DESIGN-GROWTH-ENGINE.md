# DESIGN: Kijonsai Growth Engine

**Phase:** ARCHITECT (stage 1 of verified-architect -> disciplined-implementer -> adversarial-auditor)
**Governing skill:** `res://kijo-bonsai/.claude/skills/verified-architect/SKILL.md`
**Created:** 2026-09-09
**Status:** DRAFT - pending owner approval. Section 2 is an OWNER DECISION and is not resolved here.
**Design-only:** no code, no config, no existing document was modified by this pass.

SCOPE
- Task: design the growth-rule change that reaches the documented 15-30 branch target while preserving structural rules, determinism, and minted-asset safety.
- Deliverable: this document.
- Builds on: `res://kijo-bonsai/docs/GOAL-GROWTH-ENGINE.md` (authoritative target, R1-R8), `res://kijo-bonsai/DECISIONS.md`, `res://kijo-bonsai/docs/KIJO-TECH-SPEC.md`, `res://kijo-bonsai/docs/GDD.md`.
- Consumed by: `disciplined-implementer` (stage 2), then `adversarial-auditor` (stage 3).

---

## 1. Problem statement

### 1.1 The target is documented, and the code was already once "fixed" to reach it

- VERIFIED `DECISIONS.md:12`: "**Fork threshold reconciled to 8 + depth x 5** ... Reason: original values produced only 3 branches in 200 days vs target 15-30."
- VERIFIED `DECISIONS.md:14`: fork probability reconciled to `forkChance x (1.0 - depth x 0.1) x rate`, spec had `0.38 - depth x 0.05`, "same undergrowth issue".
- VERIFIED `KIJO-TECH-SPEC.md:234-235` still carries the ORIGINAL spec constants: `max_length = 16 + branch.depth * 7` and `fork_chance = max(0, (0.38 - branch.depth * 0.05)) * rate`.
- VERIFIED: the reconciled constants shipped as code, not as spec text: `GrowthEngine.ts:99` `const forkThresh = 8 + b.depth * 5;` and `GrowthEngine.ts:119` `const forkP = spE.forkChance * (1.0 - b.depth * 0.1) * rate;`.

So the "15-30 branches" number is a documented product target, an earlier reconciliation was explicitly aimed at it, and that reconciliation folded into undocumented drift between `DECISIONS.md:12-14` and `KIJO-TECH-SPEC.md:234-235`.

### 1.2 The code admits it was tuned against the wrong number

- VERIFIED `GrowthEngine.ts:97-98`, in-file comment above the fork threshold:
  "G6 calibration: spec values (16+depth\*7, 0.38 factor) yield only ~3 branches with seed 464497 in 200 days; adjusted to 8+depth\*5 and (1.0-depth\*0.1) to satisfy count>=5."
- VERIFIED `packages/engine/test_growth.mjs:103`: `assert(count >= 5 && count <= 200, 'branch count in sane range [5, 200]', ...)`.

The design target is 15-30. The number the constants were tuned against is 5, the lower bound of an explosion guard. The 15-30 band is asserted by no test in the repository.

### 1.3 The audited product result

- VERIFIED-as-recorded `GOAL-GROWTH-ENGINE.md:18-20`: replaying kijonsai `140ec05f-...` (seed 7472909771253292, tropical, day 106, 139 log rows) produced **4 living branches** (trunk + 4 segments).
- UNVERIFIED by this pass: I have no shell in this environment, so `scripts/debug-branches.mjs` was not re-run and the 4-branch figure is quoted from the goal document, not independently re-measured. The script itself is real and appropriate for the check: `debug-branches.mjs:34-49` reconstructs via `CareLogReplay.reconstruct(seed, species, entries, current_day)` and prints `countLivingBranches()`, a flat non-pruned count, and a reachable-from-root count.
- ASSUMED (and material): that tree's care regime is not the "healthy, well-tended" regime R1 requires. Rate is multiplied by moisture and health (`GrowthEngine.ts:44-46`), so a day-106 tree with 139 log rows and low moisture legitimately grows slowly. The 4-branch figure is therefore evidence that the *shape* of the rule cannot reach the band under ordinary care; it is not a controlled measurement of the constants under the named regime. Section 3's acceptance check exists precisely to make that measurement.

### 1.4 Why the rule shape under-produces (structural analysis)

The mechanism, read directly off the code:

- VERIFIED `GrowthEngine.ts:87`: `if (living.length === 0)` - only a TIP can fork. A branch that has forked once becomes an inner branch and can never fork again. Living-branch count therefore equals 1 trunk plus the number of fork events that survived pruning, and every fork event first consumes a tip position.
- VERIFIED `GrowthEngine.ts:92`: `ext = round4((1.2 + rng.next() * 2.8) * rate * depthFalloff * tipMultiplier)`.
- VERIFIED `GrowthEngine.ts:82`: `depthFalloff = sp.depthFalloffBase ** b.depth` (hardwood 0.72, evergreen 0.68, tropical 0.78; `packages/shared/src/index.ts:407-409,401`). Extension per day decays exponentially with depth.
- VERIFIED `GrowthEngine.ts:99,101`: the gate is `b.length > 8 + b.depth * 5` - a threshold that grows LINEARLY with depth: 8, 13, 18, 23, 28, 33.
- VERIFIED `GrowthEngine.ts:119`: even after the gate opens, the fork still needs a per-day Bernoulli win at `forkChance * (1.0 - depth * 0.1) * rate`, i.e. 0.176/day at depth 1 for tropical and 0.088/day at depth 4 (`GrowthEngine.ts:96`, `species.ts:14` forkChance 0.16).
- VERIFIED `GrowthEngine.ts:152`: a newborn branch starts at `length: round4(1.0)`, so every child must re-earn its threshold from scratch.

ASSUMED (hand arithmetic, not simulated - flagged as such): with tropical `rate` about 1.2, a depth-4 tip extends about `2.6 * 1.2 * 0.370 * 0.775` = 0.89 voxel/day and needs 27 voxels past its birth length to clear the 28-unit threshold: about 31 days, plus about 9 days of failed rolls at 0.113/day. Roughly 40 days of uninterrupted health for one depth-4 fork, on a tip that must remain a tip for all 40. Exponential extension decay against a linear threshold means the depth>=4 frontier effectively stalls inside a 106-day window. That is the structural reason constant-tuning alone never reached 15-30, and it is the reason this design does not merely retune constants.

### 1.5 Secondary defects confirmed by reading

1. VERIFIED dead data: `species.ts:6` declares `forkAngle`, `species.ts:12-14` sets it (45 / 30 / 20), and `GrowthEngine.ts:3` imports `SPECIES` only for `forkChance` and `thickenRate`. No engine code reads `forkAngle`; the live spread values are `SPECIES_PARAMS.forkSpreadMin/Max` (`packages/shared/src/index.ts:396,407-409`). R4 explicitly names this ("`forkAngle` is currently dead data", `GOAL-GROWTH-ENGINE.md:74`).
2. VERIFIED rotation has no growth effect: `KIJO-TECH-SPEC.md:316-327` specifies `apply_rotation_bias` (sun-facing branches up to plus/minus 15 percent growth). Grepping the whole engine for `rotation` returns only `BonsaiTree.ts:178` (the rotate action mutates state) and `BonsaiTree.ts:308` (`getRotationState()`), plus `tree.ts:17`. Nothing consumes it in growth. R3's "rotation must have a real effect" (`GOAL-GROWTH-ENGINE.md:66`) is unmet.
3. VERIFIED duplicated algorithm: a committed bundle at `apps/server/supabase/functions/_shared/kijo-engine.js:929-930` contains the same `forkThresh = 8 + b.depth * 5` gate. It is produced by `build-edge.sh:45-51` and the script's own header says to "Regenerate whenever packages/engine ... change" (`build-edge.sh:8`) - i.e. regeneration is manual and drift is unguarded. The deployed Day-tick path and the client path can disagree about growth.
4. VERIFIED single growth path (good news that changes the plan): `tree.ts:8` records "tick(), applyAction(), conditionModifier() retired 2026-08-07 (dual-engine cleanup)". There is one algorithm to change, not two.
5. VERIFIED downstream coupling that makes branch count a combat number: `KIJO-ENGINE-API.md:79` "`skillSlots; // from depth-2+ branch COUNT`". Changing branch count changes derived stats, and `apps/web/src/renderer/tree_mesh.ts:17-18` states "the shipped Branch has no `curve` field. Curved-bezier trunks are a future engine feature" while leaves are drawn as spheres only at tips (`tree_mesh.ts:234-242`).

### 1.6 What is NOT broken and must be preserved verbatim

Per-branch per-day seeded RNG (`GrowthEngine.ts:85,118,122,126`), matching `DECISIONS.md:8`; `round4()` on every growth write (`DECISIONS.md:10`); the depth gate `b.depth < 6` and the one-third gate (`GrowthEngine.ts:101,104-116`); real `attachmentY` on depth-1 primaries (`GrowthEngine.ts:137-141`, resolved per `KIJO-TECH-SPEC.md:921`); the flat-index branch model (`DECISIONS.md:6`); prune, wire, twine, voxelizer, `StatDeriver`, renderer, and the engine/shared import boundary (`KIJO-ARCHITECTURE.md:242`). No `Math.random`, `Date.now`, or `crypto` anywhere in engine or voxelizer.

---

## 2. Engine-versioning decision (OWNER DECISION - not resolved by this document)

**This section presents options, prices them, and recommends. It does not decide. `GOAL-GROWTH-ENGINE.md:152-155` names this as owner decision 1, and R6 (`GOAL-GROWTH-ENGINE.md:81-85`) forbids a silent constant edit. Nothing in this section may be executed without the owner's explicit choice.**

### 2.1 The deterministic input today, and what replay means

- VERIFIED `GOAL-GROWTH-ENGINE.md:76-79` (R5): "Same seed + species + care log produces a bit-identical tree." Same-version determinism is the contract; cross-version is the open question.
- VERIFIED `scripts/debug-branches.mjs:35`: replay is literally `CareLogReplay.reconstruct(data.seed, data.species, entries, data.current_day)`. The deterministic input tuple is (seed, species, care log, day) plus the code itself. The code version is the implicit fifth input - that is the whole problem.
- VERIFIED: no version field exists. Grepping the repository for `engineVersion` / `engine_version` returns exactly one hit, `GOAL-GROWTH-ENGINE.md:152`, which is this question. There is no existing mechanism to extend; anything here is new plumbing.
- VERIFIED `DECISIONS.md:238` - **precedent already exists**: "Cross-version determinism intentionally broken - testnet only (2026-08-26) ... Cross-version break is accepted because the old growth model was biologically incorrect (inner branches froze after forking). All existing minted tokens are on Saigon testnet (no mainnet tokens exist per STATE.md). No SQL migration required ... Existing renders in `renders` bucket will depict the old model; re-render via `INSERT INTO render_queue ... WHERE token_id IS NOT NULL` when ready."

So the project has already taken an in-place growth change once. The precedent's own justification is conditional: "no mainnet tokens exist". That condition is the pivot of this decision.

### 2.2 Options

**Option A - per-tree `engineVersion` stamp with replay dispatch.**
Mechanism: persist an integer version on the tree at seed/mint time; `CareLogReplay.reconstruct` and `BonsaiTree` take it as an explicit input; v1 code path retained verbatim alongside v2.
Cost: new DB column + every replay call site plumbed (engine API, `debug-branches.mjs`, the render worker which reconstructs trees for NFT art per `STATE.md:129`, and the deployed edge bundle). Two live algorithms become permanent maintenance.
Blast radius: engine, shared, server, render worker, web bridge, DB schema.
Residual risk: a divergent v1 path that no longer gets fixed when v2 changes; the version must reach every reconstruction site or a tree silently replays under the wrong rules - which is arguably worse than a uniform change.

**Option B - new-growth-only rule change (rules apply from day X onward).**
Mechanism: old rules for days before the switch, new rules after.
Cost: low-looking, actually the worst of A. Replay still needs the old rule set to reproduce pre-switch days, so it is Option A with the version derived from a day rather than stored - an implicit version, which is exactly the "silent" mechanism R6 forbids. It also creates a visible discontinuity in trunk/branch geometry at the switch day for live trees.
Blast radius: same as A, plus its own class of mixed-model bugs.
Residual risk: high. Not recommended for any purpose.

**Option C - feature gate / data-driven growth version (recommended mechanism).**
Mechanism: the current constant set is frozen as a named, data-only preset (`GROWTH_V1`), the new grammar table becomes `GROWTH_V2`, and the tree's deterministic input gains one `growthVersion` field that selects the preset. No duplicated algorithm - one algorithm parameterised by a frozen vs live preset.
Cost: same plumbing surface as A (one new stored field + replay dispatch), but the v1 path is inert data rather than a forked code path, so the maintenance burden is small and the v1 behaviour is provably frozen (a preset literal cannot drift).
Blast radius: engine, shared, server, render worker, web bridge, DB schema - one field, six call sites.
Residual risk: still requires the version to be present on every reconstruction path; mitigated by making the field required (no default) so a missing version is a loud failure rather than a silent default.

**Option D - in-place change with explicit owner acceptance (the `DECISIONS.md:238` precedent).**
Mechanism: all trees, including already-minted kijonsai, re-derive under the new rules on next reconstruction. No version field.
Cost: lowest implementation cost; requires a DECISIONS.md entry with the same shape as `DECISIONS.md:238`, and a re-render sweep (`INSERT INTO render_queue ... WHERE token_id IS NOT NULL`) because the ERC-721 art is downstream.
Blast radius and irreversibility: every existing token's derived morphology, voxels, stats and art change. `KIJO-ENGINE-API.md:79` ties `skillSlots` to depth-2+ branch count, so a 4-branch tree becoming a 20-branch tree is a combat-stat change, not just a cosmetic one. If any token is on mainnet, or if any holder was sold a specific tree's appearance, this is a permanent, unbuyable-back change.
Residual risk: if the owner's answer to "are there mainnet tokens?" is not a verified no, this option is not available.

### 2.3 Cost comparison

| | New stored field | Replay dispatch sites | Deployed bundle rebuild | Existing tree art changes | Reversible after mint |
|---|---|---|---|---|---|
| A stamp | yes (1) | 4-6 | yes | no | yes |
| B day cutoff | implicit | 4-6 + day logic | yes | partially, with a visible seam | partially |
| C feature gate | yes (1) | 4-6 | yes | no | yes |
| D in place | no | 0 | yes | yes, all trees | no |

All four options require the same follow-up regardless: rebuild the vendored edge bundle (`build-edge.sh:8,45-51`), since the deployed server currently carries its own copy of the fork constants at `kijo-engine.js:929-930`.

### 2.4 Recommendation (to be approved or rejected by the owner, not assumed by the implementer)

Recommend **Option C**: freeze `GROWTH_V1` as data, add one required `growthVersion` field to the deterministic input, default new trees to `GROWTH_V2`. Rationale: it is the only option that satisfies R6 without permanently maintaining two algorithms, and it is a strict superset of Option D - the owner can set every existing tree's `growthVersion` to 2 in one statement and get Option D's outcome deliberately instead of by accident.

The honest counter-argument, which the owner should weigh: the project already chose D once (`DECISIONS.md:238`) on the grounds that there are no mainnet tokens, and minted-tree replay exactness has never actually been needed by a user yet. If the owner confirms no mainnet tokens exist and no holder depends on a specific tree's current shape, D is defensible, cheaper, and consistent with precedent - and this is the last cheap window for it, because the first mainnet mint closes it permanently.

### 2.5 The question, verbatim, for the owner

**OWNER DECISION - engine versioning (blocks implementation step I1):**
> Existing minted kijonsai were created under growth v1 and re-derive differently under any new rule set. Choose one:
> (1) Option C - add a required `growthVersion` to the deterministic input, freeze v1 as a data preset, new trees get v2; legacy trees keep v1 (recommended);
> (2) Option D - accept a logged in-place change to all existing trees, per the `DECISIONS.md:238` precedent, including a re-render sweep and a combat-stat change to existing tokens;
> (3) some other explicit mechanism, which the implementer must be told verbatim.
> This also requires confirming: are there any mainnet Kijonsai ERC-721 tokens, and does any holder depend on a specific existing tree's derived shape or stats?

---

## 3. Growth algorithm design

### 3.1 The decisive structural finding: the trunk forks once, ever

- VERIFIED `GrowthEngine.ts:87`: `if (living.length === 0) { ... }` - the tip path, which is the only path that can fork, is entered only when a branch has no living children.
- VERIFIED `GrowthEngine.ts:104-116` + `DECISIONS.md:234`: the depth-1 gate exists ("Only allow the first depth-1 fork when trunk is long enough", keyed on `existingDepth1 === 0`), and "Inner branches do NOT fork (meristems are at tips only)".
- Therefore, VERIFIED by construction: after the trunk's first fork it has a living child, so it is an inner branch for the rest of its life and can never fork again. **One tree gets exactly one depth-1 main branch, ever.**
- The audited tree is exactly that shape (`GOAL-GROWTH-ENGINE.md:19-20`): trunk 33.09 -> id1 23.07 -> {id2 21.82 -> id4 7.01, id3 20.28}. A spine with side shoots, not a bonsai with distributed mains.
- This contradicts `KIJO-TECH-SPEC.md:349-359`, which requires depth-1 branches to be DISTRIBUTED up the upper trunk ("the first (lowest) main branch belongs at ~1/3 height, with subsequent main branches distributed up the remaining upper trunk"), and `GDD.md:235`, which makes that distribution load-bearing for the ARM/LEG morphology split.
- Corroborating evidence that the engine cannot produce what the design assumes: the morphology test constructs its inputs by hand - `STATE.md:97` "A5 - Multi-branch morphology (**4+ depth-1 constructed**)".

Retuning `forkChance` and `forkThresh` cannot fix a tree whose trunk may fork once. This is why the earlier reconciliation (`DECISIONS.md:12-14`) failed to reach 15-30, and it is the first thing v2 must change.

### 3.2 The v2 rule set

Five changes, each mapped to the requirement it serves. Everything not listed is preserved verbatim from section 1.6.

**(a) The trunk may fork repeatedly (serves R1, R2).**
Depth 0 is exempt from the tip-only rule. The trunk throws a new main branch when both hold:
- the trunk has extended at least `trunkInternode(species)` voxels since its last fork (deterministic spacing, so mains are distributed up the trunk rather than stacked);
- living branch count is inside the ceiling rule (c).

New mains attach at `round4(trunk.length)` at fork time (the existing behaviour for secondary children, `GrowthEngine.ts:139-141`), so `attachmentY` grows monotonically up the trunk and the ARM/LEG split by real attachment height keeps working. The FIRST main keeps the existing one-third behaviour: `attachmentY = round4(trunk.length * 0.33)` at the moment of its fork, gated on `trunk.length >= MIN_TRUNK_FOR_FIRST_BRANCH` (20, `GrowthEngine.ts:12,108`). Because the trunk keeps extending after that first fork, the bare lower zone stays at or above a third of the final trunk height by construction.

**(b) Internode schedule replaces the linear length threshold (serves R1, R4).**
`GrowthEngine.ts:99` (`8 + depth * 5`) is replaced by a per-species internode distance measured against the extension a tip has accumulated since it was born:

```
function internode(sp, depth):            // voxel units of extension between forks
    return round4(sp.internodeBase + sp.internodeDepthStep * depth)
```

The schedule is deliberately flat relative to extension decay, so deep tips stop clearing their internode ("stalls") instead of being forced to chase a threshold that grows linearly while their extension decays exponentially (`GrowthEngine.ts:82`). Species character comes from the table in 3.4, not from three numbers that are partly dead (`forkAngle`).

**(c) A deterministic floor and ceiling on living branch count (serves R1).**
A single snapshot `livingCount0 = tree.countLivingBranches()` is taken ONCE at the start of the day's tick, before any fork, and used for every fork decision that day. Snapshotting once is what makes the day's outcome independent of traversal order.

```
if livingCount0 >= cap(sp):                 forkP = 0            // ceiling
elif livingCount0 < floor(sp):              deterministic fork   // floor: see below
else:                                       forkP = sp.forkChance * depthFalloff * rate
```

- Ceiling: while living count is at or above `cap(sp)`, no fork occurs. Living count is therefore bounded by `cap + 1` (the two-child secondary roll at the boundary fork) - a provable bound, asserted by a test.
- Floor: while living count is below `floor(sp)`, the day's fork is deterministic rather than probabilistic: exactly one eligible tip forks (the lowest branch id whose internode has cleared, evaluated in flat-array id order). This turns "will it ever get there" into "it gets there as fast as the frontier can extend", and it is deterministic because the selection order is id order.
- Conditoning: the floor only operates while the tree is alive (`rate > 0`). A tree with no water does not grow, and the acceptance check for R1 uses a NAMED healthy regime, per `GOAL-GROWTH-ENGINE.md:52-53`. The floor is a guarantee about a living tree, not a promise that a neglected tree grows.

**(d) Phototropism from the existing rotation state (serves R3).**
`KIJO-TECH-SPEC.md:316-327` defines `apply_rotation_bias(branch, rotation_state)` with `sun_angle = rotation_state * PI/2` and `growth_bias = 1.0 + alignment * 0.15`. Implement it as the spec writes it, using a deterministic world-angle walk: `worldAngle(b) = worldAngle(parent) + b.angle` (engine stores `b.angle` in degrees relative to parent, `GrowthEngine.ts:151`). Rotation state already exists, already mutates deterministically by 90 degrees on the rotate action (`BonsaiTree.ts:178`) and is already persisted (`packages/shared/src/index.ts:197`), so this consumes existing deterministic input and adds no new state. This is the cheapest real answer to "rotation must have a real effect", and it is visible as asymmetric branch vigour without any schema change.

**(e) Taper as an enforced correctness constraint (serves R2).**
`KIJO-TECH-SPEC.md:371-385` calls monotonic taper a correctness constraint the engine can assert. Implementation is a deterministic end-of-day normalisation pass:
- child thickness at fork stays as today: `round4(Math.max(0.3, parent.thickness * 0.5))` (`GrowthEngine.ts:146`), with a per-species half factor so hardwood low branches stay deliberately thick (`KIJO-TECH-SPEC.md:381-385`);
- then, walking depth-first in id order, clamp `child.thickness <= round4(parent.thickness * 0.95)` and, among living depth-1 children, clamp thickness to be non-increasing as attachmentY increases (lowest main thickest, highest thinnest);
- pruned branches are exempt from the clamp.
Both the clamp and the assertion are `round4`-clean, so determinism is unaffected.

### 3.3 The day tick, v2 (pseudocode)

```
applyDailyUpdate():
    livingCount0 = countLivingBranches()          // SNAPSHOT, once, before any fork
    rate = round4(moistureFactor * fertFactor * healthFactor * extensionMultiplier)   // unchanged
    extendAndFork(trunk, rate, livingCount0)      // unchanged id-ordered pre-order walk

extendAndFork(b, rate, livingCount0):
    if b.pruned: return
    living = b.children where not pruned
    rng    = SeededRNG(seed + b.id * 7919 + day * 37)                 // unchanged
    canFork = (living.length === 0) or (b.depth === 0)                // (a): trunk exemption

    if living.length === 0:                                           // extension: unchanged
        tipMultiplier = isLeader ? 1.0 : round4(1.0 - apicalDominance * 0.5)
        ext = round4((1.2 + rng.next() * 2.8) * rate * depthFalloff * tipMultiplier)
        b.length = round4(b.length + ext)
    else:                                                             // inner: unchanged
        innerRate = round4(sp.parentExtensionRate * (1.0 - apicalDominance * 0.5))
        b.length  = round4(b.length + innerRate * rate)

    if canFork and b.depth < 6:                                       // depth 6 hard gate, unchanged
        if b.depth > 0 and round4(b.length - b.bornLength) < internode(sp, b.depth): pass
        elif b.depth === 0 and round4(b.length - lastMainForkLength) < trunkInternode(sp): pass
        else:
            if b.depth === 0 and existingLiveDepth1 === 0 and b.length < MIN_TRUNK_FOR_FIRST_BRANCH: pass
            else: fork(b, livingCount0, rate)

    for id of b.children: extendAndFork(branches[id], rate, livingCount0)   // order unchanged

fork(b, livingCount0, rate):
    if   livingCount0 >= cap(sp):      forkP = 0.0         // ceiling
    elif livingCount0 <  floor(sp):    forkP = 1.0         // floor, deterministic
    else:                              forkP = min(1.0, round4(baseForkChance * depthFalloffCap * rate * bias(rotation)))
    forkRng = SeededRNG(seed + b.id * 7919 + day * 37 + 1)             // unchanged
    if forkRng.next() >= forkP: return
    nChildren = (secRng.next() < sp.secondaryForkChance) ? 2 : 1       // unchanged
    ...child construction unchanged, with:
        angle      = round4(side * spread * (180 / PI))   // forkSpreadMin/Max, radians: unchanged
        length     = round4(1.0)                          // unchanged
        attachmentY = (b.depth === 0 and i === 0) ? round4(b.length * 0.33) : round4(b.length)
        bornLength = round4(1.0)                          // NEW: internode baseline
```

`bias(rotation)` is the `apply_rotation_bias` factor from 3.2(d), applied only to the probability term, not to extension, so it cannot break the extension invariants the existing tests cover.

State footprint of this pseudocode, kept deliberately small:
- `b.bornLength` does NOT need to be a stored field. Every branch is born at `length: round4(1.0)` (`GrowthEngine.ts:152`), so a branch's accumulated extension is exactly `round4(b.length - 1.0)`. Derive it; do not add a field.
- `lastMainForkLength` is a single scalar on the tree state (not one per branch), initialized to 0, which is precisely "the trunk has never forked". This is the only genuinely new piece of state the design requires, and only the trunk path reads it.
So v2 adds zero fields to `Branch`. That is the smallest possible schema surface, and it is deliberate: the more state is added, the more determinism surface and the more replay compatibility questions.

### 3.4 Species grammar table (serves R1, R4)

One live table, in `SPECIES_PARAMS` (`packages/shared/src/index.ts:406-409`), so the engine, the server bundle and the client all read the same numbers. `forkAngle` in `species.ts:6,12-14` is deleted; the angle data already lives in `forkSpreadMin/Max`.

| parameter | hardwood | evergreen | tropical | meaning |
|---|---|---|---|---|
| `internodeBase` | 6.0 | 5.0 | 3.5 | extension between forks at depth 0-1 (voxels) |
| `internodeDepthStep` | 1.0 | 0.8 | 0.5 | additional distance per depth level |
| `trunkInternode` | 16.0 | 13.0 | 10.0 | trunk extension between successive mains |
| `branchFloor` | 15 | 15 | 15 | deterministic catch-up floor (R1 band low end) |
| `branchCap` | 26 | 28 | 30 | ceiling; the 15-30 band's high end |
| `floorDay` | 90 | 75 | 60 | day the catch-up floor becomes active |
| `forkChance` (existing) | 0.10 | 0.12 | 0.16 | unchanged identity |
| `secondaryForkChance` (existing) | 0.45 | 0.35 | 0.25 | bifurcation probability, unchanged |
| `forkSpreadMin/Max` (existing) | 0.50/1.00 | 0.30/0.70 | 0.10/0.40 | branch angle, unchanged |
| `apicalDominance` (existing) | 0.65 | 0.80 | 0.45 | leader suppression strength, unchanged |
| `depthFalloffBase` (existing) | 0.72 | 0.68 | 0.78 | exponential decay, unchanged |

This is the "per-species L-system-like grammar" the project's own research asks for as parameters - branching angle, internode length, bifurcation probability, apical dominance strength (`res://kijo-bonsai/docs/research/RESEARCH-OPENSOURCE-BONSAI-2026-07-31.md:112,179`). All four are now plain numbers in one table. A string-rewriting L-system interpreter is explicitly NOT built: the research asks for the grammar's parameterisation, not for a turtle-graphics engine, and no consumer needs one.

**The specific numbers in that table are AIMS, not measurements.** They are calibrated in step I4 of the implementation plan by running the per-species count check and adjusting until all three species land in band. Nothing in this document claims the table as written already produces 15-30; that claim is only ever made by the printed output of the check.

### 3.5 Why this reaches 15-30 where constant-tuning could not

- The trunk may now produce a main branch every `trunkInternode` voxels of its own extension (3.2a), instead of one main in the tree's lifetime (3.1). Each main is a new subtree root, so the tip frontier - and therefore the achievable fork count - stops being a single spine.
- The floor rule (3.2c) makes the low end of the band a property of the frontier's extension speed rather than of a Bernoulli streak. With a healthy regime the frontier always extends, so the count climbs while below floor.
- The ceiling rule (3.2c) makes the high end a hard bound: living count cannot exceed `branchCap + 1`.
- The depth-6 gate, the one-third rule, the taper clamp and `round4` discipline are all preserved, so the band is reached inside the documented structural constraints rather than by relaxing them.

### 3.6 Determinism rules for the implementer

- No `Math.random`, `Date.now`, or `crypto` anywhere in engine or voxelizer (`GOAL-GROWTH-ENGINE.md:77-78`); use the existing `SeededRNG` with the existing per-branch derivation `seed + b.id * 7919 + day * 37` (`DECISIONS.md:8`) and keep the existing `+1`, `+2`, `+3+i` stream offsets for the fork roll, secondary roll and per-child angle (`GrowthEngine.ts:118,122,126`).
- `round4()` after EVERY growth math write (`DECISIONS.md:10`), including the new internode accumulator, the taper clamp and the rotation bias.
- Every new decision input must be derived from (seed, species, care log, day, growthVersion) - never from wall clock, array iteration over a Map or Set, or object property order.
- The count snapshot is taken once per day before forking (3.2c) - do not read `countLivingBranches()` inside the traversal.

### 3.7 Requirement traceability

| Req | Where satisfied | Machine check |
|---|---|---|
| R1 branch target 15-30 | 3.2a trunk re-fork, 3.2b internodes, 3.2c floor/ceiling, 3.4 table | NEW per-species check, prints count per species under the named regime |
| R2 one-third rule | 3.2a: first main at `trunk.length * 0.33`, gated on `MIN_TRUNK_FOR_FIRST_BRANCH`; later mains attach at the then-tip, above it | existing A1 shape of check (`STATE.md:93`) re-pointed at the new engine |
| R2 taper | 3.2e clamp + assertion | NEW taper assertion; existing G3 Leonardo bound retained |
| R2 max depth 6 | `b.depth < 6` gate kept (`GrowthEngine.ts:101`) | existing G5 (`test_growth.mjs:85`) |
| R2 1-2 children, species angles | unchanged fork code, `forkSpreadMin/Max` | existing per-branch angle checks |
| R3 apical dominance | kept (`GrowthEngine.ts:91,200`); pruning releases suppression via the count snapshot falling below cap | NEW release check: prune a leader, assert surviving laterals gain rate |
| R3 phototropism / rotation | 3.2d `apply_rotation_bias`, `KIJO-TECH-SPEC.md:316-327` | NEW check: same seed with rotation 0 vs 90 produces different branch lengths, and each still replays identically |
| R3 internode length | 3.2b | covered by R1 check output |
| R3 curvature | DEFERRED - section 4 | none (deliberately); no `curve` field exists (`tree_mesh.ts:17-18`) |
| R3 per-species grammar | 3.4 | NEW check: the three species produce measurably different depth profiles |
| R4 species character | 3.4 (single live table), `forkAngle` deleted | NEW check: no dead species field; grep gate |
| R5 determinism | 3.6 | existing G4 plus reconstruct-twice diff |
| R6 minted-asset safety | section 2 - OWNER DECISION | legacy replay check, whichever option the owner picks |
| R7 care-loop truthfulness | NOT in this design's scope; it is a client/consumable bug, see section 7 | flagged, not silently dropped |
| R8 stat contract intact | no `Branch` field is removed; `attachmentY` gains no new semantics; voxelizer and `StatDeriver` untouched | existing D1-D7 and V1-V5 suites |

### 3.8 Visual target: age-milestone expectations

Two of the goal document's four named visual traits are machine-checkable without a browser (structure and voxel volume); the other two are shape judgements only a human can make. The aims below are split accordingly, and the machine-checkable half is what the implementer should print.

Named regime for every row: `REGIME_HEALTHY` = water daily to keep moisture at or above 60, fertilize every 7 days, no pruning, rotation left at 0, 180 days.

Machine-checkable aims (assertable in tests, no rendering needed):

| Day | Living branches (all species) | Max depth | Canopy: tips carrying leaves | Total voxels |
|---|---|---|---|---|
| 30 | 2-5 | <= 2 | 1-2 | ~400-900 |
| 90 | 6-14 | <= 4 | 4-10 | ~1,500-3,000 |
| 180 | 15-30 (the R1 band) | 4-6 | 12-28 | ~3,000-8,000 |
| 365 | 15-30, cap-bound | 6 | 12-30 | ~8,000-20,000 |

- The total-voxel aims are anchored on measured baselines in the repo: `STATE.md:33` "Day-50 tree (779 voxels)" and `STATE.md:35` "Day 50 -> Day 100 -> Day 200 = 779 -> 2,238 -> 12,240". The 180-day aim is deliberately ABOVE the current curve at day 150-200, because more terminal tips means more leaf-cluster voxels; that direction is what leaf clusters at tips (`tree_mesh.ts:234-242`) implies. ASSUMED, not measured.
- Structural aims, assertable: no living depth-1 branch below 30 percent of final trunk height (the existing A1 shape, `STATE.md:93`); trunk thickness strictly decreasing base to apex; among living depth-1 branches, thickness non-increasing as `attachmentY` increases.
- Per-species silhouette aims, stated so they can be checked by eye against the owner's reference image:
  - hardwood: fewer, longer, wider-angled mains (`forkSpreadMin/Max` 0.50-1.00 rad), thick low branches, open crown, height roughly 1.4x crown width;
  - evergreen: even tiers, moderate spread (0.30-0.70 rad), narrow conical crown, height roughly 2x crown width;
  - tropical: many short thin branches (internodeBase 3.5), tight spread (0.10-0.40 rad), wide rounded canopy, crown width roughly equal to height.

Honest limitation, stated plainly: **this environment cannot open a browser or capture the rendered app.** The dream-loop critic step described in `GOAL-GROWTH-ENGINE.md:123-134` cannot execute here, and no automated visual verification is promised. The visual judge for silhouette, foliage density as seen on screen and overall "does it look like a bonsai" is the owner, play-testing the web client, optionally against a reference image. The voxel and branch-count aims above are the part that can be settled without eyes.

---

## 4. Realism mechanisms: build now vs defer

R3 (`GOAL-GROWTH-ENGINE.md:63-70`) allows either implementing a mechanism or deferring it "explicitly and durably with a logged decision". This section says which, and why, per mechanism.

### 4.1 Apical dominance: already built, needs one behaviour tied off

- VERIFIED built: leader/subordinate differentiation exists (`GrowthEngine.ts:90-91`, and `:200` for inner branches), and `DECISIONS.md:234` records the model, its species strengths (`apicalDominance` HW 0.65 / EG 0.80 / TR 0.45) and its grounding (Palubicki et al. 2009, Borchert-Honda).
- R3's clause is not just "leader suppresses laterals", it is "(leader suppresses laterals; **pruning releases them**)" (`GOAL-GROWTH-ENGINE.md:65`). The player-facing promise is already written down: `KIJO-PRD.md:203` "branch and children vanish, scar appears, **remaining tips boost**".
- UNVERIFIED in this pass: whether the surviving-tip boost is actually implemented in `packages/engine/src/PruneEngine.ts`. I did not read that file. The implementer must read it before claiming this clause satisfied. It is not a growth-rule change, so it is not in the I-step sequence below; it is flagged as a pre-check in step I0.
- Design intent regardless of what I0 finds: with the v2 ceiling (3.2c), pruning a leader drops the living count below `cap`, which re-opens forking in the surrounding region - so pruning is now a genuine release valve in the v2 rules, not only a removal.

### 4.2 Phototropism and space colonization: build the cheap half, defer the algorithm

- BUILD NOW - rotation-driven vigour bias. `KIJO-TECH-SPEC.md:316-327` specifies it (`apply_rotation_bias`, up to plus/minus 15 percent), the rotation state already exists and mutates deterministically (`BonsaiTree.ts:178`), and it is already persisted (`packages/shared/src/index.ts:197`). Cost: one deterministic world-angle walk plus one multiplier. This closes R3's "(rotation must have a real effect)" with no schema change.
- DEFER - full space colonization. The research names it as the right model - `RESEARCH-OPENSOURCE-BONSAI-2026-07-31.md:175`: "Study paternostrox/AdaptableTrees for the voxel+flood-fill obstacle approach and the space colonization attractor model. Port the algorithm in TypeScript from scratch - do not copy GPL code. The Runions 2007 paper ... is the primary source." - and `:145` names the observable it would buy: "branches in the interior of a dense tree should elongate faster (reaching for light)".
  Why defer: it is a spatial attractor optimisation (point cloud, nearest-attractor queries per tip per tick) with no existing infrastructure, and `Branch` has no stored 3D position - direction is reconstructible from the parent chain plus the golden-ratio azimuth (`DECISIONS.md:20`) but nothing in the engine computes world positions today. Introducing a nearest-neighbour structure into the deterministic core is a real project with its own determinism burden (iteration order, float use), and it buys direction rather than count. R1 and R6 both outrank it.
  Honest consequence of the deferral: after v2, rotating the tree changes growth RATES (sun-facing shoots gain up to 15 percent), not growth DIRECTION. A player who rotates expecting branches to bend toward the light will not see that. The deferred decision must say so in those words.

### 4.3 Internode length and curvature: split them

- BUILD NOW - internode length. It is a scheduling parameter (3.2b, 3.4) with zero schema impact, and it is exactly what the research asks for (`RESEARCH-OPENSOURCE-BONSAI-2026-07-31.md:112,179`: "branching angle, internode length, bifurcation probability, apical dominance strength").
- DEFER - curvature. `Branch` has no `curve` field and the renderer says so in its own header (`tree_mesh.ts:17-18`: "the shipped Branch has no `curve` field. Curved-bezier trunks are a future engine feature"). `KIJO-TECH-SPEC.md:206` already reserves the field (`curve: float // bezier control point offset`), so the spec's intent is not in question; the cost is. Adding curvature touches: the shared `Branch` type, the voxelizer's tube rasterisation, the web mesh builder, the GLB render worker, and every already-rendered kijonsai image. It is a second pipeline-sized change, and bundling it into this one would make the R1 result unmeasurable.
- Mitigation that costs nothing: "growing limbs rather than one-shot segments" is partially satisfied already, because inner branches keep extending every tick after forking (`DECISIONS.md:234`, `GrowthEngine.ts:200`). That is the honest description of what ships: limbs that keep growing, still drawn straight.
- When curvature is picked up, the research already names the representation: `RESEARCH-OPENSOURCE-BONSAI-2026-07-31.md:177` - Ball-B-spline (Ao 2009) with displaced control points, "not a rigid rotation".

### 4.4 Per-species branching grammar: build as data, not as an interpreter

- BUILD NOW - the grammar as a parameter table (3.4). Research: `RESEARCH-OPENSOURCE-BONSAI-2026-07-31.md:179` "Design Kijo's species files as parameterized L-System-like grammars: branching angle, internode length, bifurcation probability, apical dominance strength." All four parameters already exist or are added as plain numbers in `SPECIES_PARAMS`.
- DEFER - an L-system interpreter (string rewriting, turtle graphics). The research's own verdict on the reference implementation is `:117`: "REFERENCE ONLY ... Don't use the C++ code; use the grammar file format as inspiration for Kijo's species definition files." The abstraction requested is a parameterised grammar, and that is what the table is. No consumer - renderer, voxelizer, stat pipeline - reads a production-rule string.

### 4.5 Summary

| Mechanism | Build now | Defer | Evidence for the split |
|---|---|---|---|
| Apical dominance | yes (exists) | - | `GrowthEngine.ts:91,200`; `DECISIONS.md:234` |
| Pruning releases laterals | verify then wire | - | `KIJO-PRD.md:203`; `GOAL-GROWTH-ENGINE.md:65` |
| Rotation / phototropism bias | yes | - | `KIJO-TECH-SPEC.md:316-327`; `BonsaiTree.ts:178` |
| Space colonization attractors | - | yes | `RESEARCH-...-2026-07-31.md:145,175` |
| Internode length | yes | - | `:112,179` |
| Branch curvature / spline | - | yes | `tree_mesh.ts:17-18`; `KIJO-TECH-SPEC.md:206`; research `:177` |
| Per-species grammar as data | yes | - | research `:112,117,179` |
| L-system interpreter | - | yes | research `:117` |

Every deferral above has to be written into `DECISIONS.md` in the same commit as the v2 change, or R3's "explicitly and durably defer" is not satisfied.

---

## 5. Verification Log

Every factual claim this design rests on, tagged. Nothing in this document is presented as measured that is not tagged VERIFIED with a path and line.

### 5.1 VERIFIED - read directly from code this pass

| # | Claim | Evidence |
|---|---|---|
| V1 | Shipped fork gate is `8 + b.depth * 5`, distance-based | `packages/engine/src/GrowthEngine.ts:99` |
| V2 | Shipped fork probability is `spE.forkChance * (1.0 - b.depth * 0.1) * rate` | `GrowthEngine.ts:119` |
| V3 | Only a branch with zero living children (a tip) can fork | `GrowthEngine.ts:87` |
| V4 | Inferred from V3 plus the depth-1 gate: the trunk forks at most once in a tree's life | `GrowthEngine.ts:87,104-116`; corroborated by `DECISIONS.md:234` ("Inner branches do NOT fork") |
| V5 | The in-file comment states the constants were adjusted to satisfy `count>=5` with seed 464497 | `GrowthEngine.ts:97-98` |
| V6 | Extension is `(1.2 + rng() * 2.8) * rate * depthFalloff * tipMultiplier` | `GrowthEngine.ts:92` |
| V7 | Depth falloff is exponential, `depthFalloffBase ** depth` | `GrowthEngine.ts:82` |
| V8 | `depthFalloffBase` is HW 0.72 / EG 0.68 / TR 0.78; `apicalDominance` HW 0.65 / EG 0.80 / TR 0.45 | `packages/shared/src/index.ts:407-409` (fields declared `:400-401`) |
| V9 | Rate is `moistureFactor * fertFactor * healthFactor * extensionMultiplier`, with `healthFactor = 0.4 + health * 0.006` and fertiliser x1.7 | `GrowthEngine.ts:44-46` |
| V10 | Newborn branches start at `length: round4(1.0)` | `GrowthEngine.ts:152` |
| V11 | Child thickness is `round4(Math.max(0.3, b.thickness * 0.5))` | `GrowthEngine.ts:146` |
| V12 | First depth-1 primary attaches at `round4(b.length * 0.33)`; every other child attaches at the parent tip | `GrowthEngine.ts:137-141` |
| V13 | `MIN_TRUNK_FOR_FIRST_BRANCH = 20` guards the first depth-1 fork | `GrowthEngine.ts:12,108` |
| V14 | Depth is hard-gated at `< 6` | `GrowthEngine.ts:101`; asserted at `packages/engine/test_growth.mjs:85` |
| V15 | RNG streams are `seed + b.id * 7919 + day * 37` with `+1`, `+2`, `+3+i` offsets | `GrowthEngine.ts:85,118,122,126`; mandated by `DECISIONS.md:8` |
| V16 | Leader selection is `isLeaderChild` (longest living sibling, lowest index wins ties) | `GrowthEngine.ts:55-70,90-91` |
| V17 | `species.ts` `forkAngle` is declared and set but read by no engine code | `packages/engine/src/species.ts:6,12-14`; `GrowthEngine.ts:3` imports `SPECIES` only for `forkChance`/`thickenRate` |
| V18 | The live angle data is `forkSpreadMin/Max` in shared, in radians | `packages/shared/src/index.ts:396,407-409` |
| V19 | `tick()` / `applyAction()` / `conditionModifier()` were retired 2026-08-07; there is one growth path | `packages/engine/src/tree.ts:8` |
| V20 | `countLivingBranches()` excludes the trunk, and `nextId === living + pruned + 1` | `packages/engine/src/BonsaiTree.ts:328,330` |
| V21 | The rotate action mutates rotation deterministically by 90 degrees, and the state is exposed | `BonsaiTree.ts:178,308` |
| V22 | Rotation is persisted as `0 | 90 | 180 | 270` | `packages/shared/src/index.ts:197` |
| V23 | Nothing in growth consumes rotation (repo-wide grep for `rotation` returns only the writers above, `tree.ts:17`, and renderer/GLB uses) | grep over `*.{ts,tsx,mjs,js}`; engine hits limited to `BonsaiTree.ts:178,308`, `tree.ts:17` |
| V24 | A committed server bundle contains a second copy of the fork gate | `apps/server/supabase/functions/_shared/kijo-engine.js:929-930` |
| V25 | That bundle is regenerated by a script whose own header says to regenerate on every engine change; the output is committed | `.../_shared/build-edge.sh:8-10,19,45-51` |
| V26 | The renderer's own header states `Branch` has no `curve` field and curved bezier trunks are a future feature | `apps/web/src/renderer/tree_mesh.ts:17-18` |
| V27 | Replay entry point is `CareLogReplay.reconstruct(seed, species, entries, currentDay)` | `scripts/debug-branches.mjs:35` |
| V28 | No engine-version field exists anywhere in the repository | repo-wide grep for `engineVersion|engine_version` returns exactly one hit, the question at `docs/GOAL-GROWTH-ENGINE.md:152` |

### 5.2 VERIFIED - docs and specifications read this pass

| # | Claim | Evidence |
|---|---|---|
| V29 | The 15-30 branch target is documented | `DECISIONS.md:12` |
| V30 | The spec still carries the pre-reconciliation constants `16 + depth*7` and `0.38 - depth*0.05` | `res://docs/KIJO-TECH-SPEC.md:234-235` |
| V31 | The spec's fork rules spawn 1-2 children with species spreads and a secondary chance | `KIJO-TECH-SPEC.md:255-287` |
| V32 | The spec requires depth-1 branches DISTRIBUTED up the trunk above a bare lower third | `KIJO-TECH-SPEC.md:343-360` |
| V33 | The spec calls monotonic taper a correctness constraint the engine can assert, and makes the lowest branch the thickest | `KIJO-TECH-SPEC.md:371-385` |
| V34 | The spec specifies `apply_rotation_bias` with a plus/minus 15 percent factor | `KIJO-TECH-SPEC.md:316-327` |
| V35 | The spec's data model already reserves `curve: float // bezier control point offset` | `KIJO-TECH-SPEC.md:204-211` |
| V36 | Depth falloff and the exponential alternative are both left as open research in the spec | `KIJO-TECH-SPEC.md:296-314` |
| V37 | `attachmentY` is recorded as resolved | `KIJO-TECH-SPEC.md:921`; `KIJO-ENGINE-API.md:58` |
| V38 | GDD makes the one-third bare trunk and taper load-bearing for the ARM/LEG split and stat weighting | `res://docs/GDD.md:235` |
| V39 | The engine must never import web/server/voxelizer/IO/rendering/network | `res://docs/KIJO-ARCHITECTURE.md:242` |
| V40 | The determinism invariant is called the single most important invariant in the codebase | `KIJO-ARCHITECTURE.md:226` |
| V41 | `skillSlots` derives from depth-2+ branch COUNT - a combat stat tied to branch count | `KIJO-ENGINE-API.md:79` |
| V42 | Branch wire/prune/twine API surface, including the wire-to-depth-1-only rule | `KIJO-ENGINE-API.md:118-158` |
| V43 | PRD promises that after a prune "remaining tips boost" | `res://docs/KIJO-PRD.md:203` |
| V44 | PRD treats branch count as player-visible ("watches growth tick: new branch extension, possible fork, thickening") | `KIJO-PRD.md:183` |
| V45 | The research calls for parameterised L-system-like species grammars: branching angle, internode length, bifurcation probability, apical dominance strength | `docs/research/RESEARCH-OPENSOURCE-BONSAI-2026-07-31.md:112,179` |
| V46 | The research names space colonization / Runions 2007 as the phototropism model, to be ported from scratch (no GPL code) | `RESEARCH-OPENSOURCE-BONSAI-2026-07-31.md:175` |
| V47 | The research names interior branches elongating toward light as the phototropism observable | `RESEARCH-OPENSOURCE-BONSAI-2026-07-31.md:145` |
| V48 | The research names Ball-B-spline control-point displacement as the right curvature representation | `RESEARCH-OPENSOURCE-BONSAI-2026-07-31.md:177` |
| V49 | The research's own verdict on the L-system reference is code-free reuse of the grammar format | `RESEARCH-OPENSOURCE-BONSAI-2026-07-31.md:117` |
| V50 | Existing structural gates exist and are named: A1 (no depth-1 below 30 percent of trunk), A4/A5 (attachmentY ordering, multi-branch morphology), G1-G6 | `STATE.md:93,96,97,12` |
| V51 | A5 builds its 4+ depth-1 branches by hand, i.e. construction, not growth | `STATE.md:97` |
| V52 | Voxel-volume baselines for this seed config: day 50 = 779, day 100 = 2,238, day 200 = 12,240 | `STATE.md:33,35` |

### 5.3 VERIFIED AS RECORDED (in-repo record, not re-measured by me)

| # | Claim | Evidence |
|---|---|---|
| V53 | kijonsai `140ec05f-...` (seed 7472909771253292, tropical, day 106, 139 log rows) replays to 4 living branches: trunk 33.09 -> id1 23.07 -> {id2 21.82 -> id4 7.01, id3 20.28} | `docs/GOAL-GROWTH-ENGINE.md:18-20` |
| V54 | An apical-dominance growth model was already shipped once, "FLAGGED FOR PLAYTEST TUNING", recorded against `ARCH-NATURAL-GROWTH-MODEL-2026-08-26.md` | `DECISIONS.md:234` |
| V55 | Cross-version determinism was already intentionally broken once, on the grounds of "no mainnet tokens exist per STATE.md", with a re-render path named | `DECISIONS.md:238` |

I did not re-run V53. There is no shell in this environment; `scripts/debug-branches.mjs` also requires network access to the Supabase project (`debug-branches.mjs:11,18`). The figure is the project's own recorded audit and is used as such.

### 5.4 ASSUMED (reasoning, not measurement - must be re-derived before it is trusted)

| # | Assumption | Why it is only assumed | How to settle it |
|---|---|---|---|
| A1 | The audited tree's care regime is not the healthy regime R1 names, so 4 branches is not a clean measurement of the constants | I cannot see the 139 log rows; rate is regime-scaled (`GrowthEngine.ts:44-46`) | run the named-regime count check (step I4) and print rate, moisture, health alongside count |
| A2 | Hand arithmetic: with tropical rate about 1.2, a depth-4 tip gains about 0.89 voxel/day and needs roughly 40 days per fork | arithmetic on V6/V7/V8, not a simulation | the same check, printing per-depth time-to-fork |
| A3 | The 180-day voxel aims in section 3.8 sit above the current growth curve | inferred from V52 baselines and "more tips means more canopy", not measured for v2 | run the voxelizer at day 180 for the same seed under v2 |
| A4 | The taper normalisation pass is cheap enough to run every tick | no profiling was done at all in this pass | measure with the existing engine run before/after |
| A5 | The species table values in 3.4 are starting points that will land in band after calibration | no simulation was possible here | step I4 calibration loop |
| A6 | No `Branch` field is needed at all: branch extension-since-birth derives as `round4(b.length - 1.0)` (newborn length is always 1.0, V10), and only the trunk needs one new tree-level scalar | the derivation is sound only while newborn length stays exactly 1.0 | assert newborn length in the same check that asserts the internode schedule; add the tree-level scalar with an explicit 0 default |

### 5.5 UNVERIFIED (checked and could not be confirmed, or not checked - do not treat as fact)

| # | Item | Status |
|---|---|---|
| U1 | Whether prune actually boosts surviving tips (`KIJO-PRD.md:203`) | not read: `packages/engine/src/PruneEngine.ts`. Pre-check for step I0. |
| U2 | The exact `moistureFactor` and `fertFactor` expressions | `GrowthEngine.ts:43` was not read in full; only `healthFactor` and the product were. The named regime in 3.8 therefore specifies actions, not a rate value. |
| U3 | Which edge functions and DB columns carry a tree to reconstruction (beyond `get-tree` used at `debug-branches.mjs:18` and the render worker reconstructing per `STATE.md:129`) | not inspected; section 2 prices the plumbing as "4-6 call sites" from what IS visible, and the implementer must enumerate them for real |
| U4 | Whether any file type outside `*.{ts,tsx,mjs,js}` carries a third copy of the growth constants | grep was globbed to those extensions for `forkThresh`; the untagged grep for `forkAngle` did cover all files |
| U5 | Whether any mainnet-minted tree exists, and whether any holder depends on a current tree's derived shape or stats | cannot be determined from this environment; it is the second half of the owner question in 2.5 |
| U6 | Contents of `ARCH-NATURAL-GROWTH-MODEL-2026-08-26.md` (referenced by `DECISIONS.md:234`) | not read; it is the design record for the apical-dominance change and should be read by the implementer before touching that code |
| U7 | Whether the implementer phase has write authority under `packages/` and `apps/` | this chat's enforced authority excludes both; see step I0 |
| U8 | Anything about how the tree looks when rendered | no browser, no capture, no screenshot tool exists here. All visual aims in 3.8 are targets for the owner, not observations. |

### 5.6 What was NOT done in this pass

No test was run, no code was executed, no build was produced, no browser was opened, no frame was captured, and no file other than this document was created or modified. This is a design artifact only.

---

## 6. Code Source Audit

For every existing file this design builds on: reuse, repair, or replace, with the reason. "Reuse" means no edit is proposed in this workstream.

| File | Verdict | Change | Risk of touching it |
|---|---|---|---|
| `packages/engine/src/GrowthEngine.ts` | REPAIR | internode gate (3.2b), trunk re-fork exemption (3.2a), floor/ceiling (3.2c), rotation bias (3.2d), taper pass (3.2e) | highest in the repo: it is the single growth authority and every edit is determinism-critical |
| `packages/engine/src/species.ts` | REPLACE (retire) | move `forkChance`, `thickenRate`, `growthRate`, `moistureDecay` into `SPECIES_PARAMS`; delete `forkAngle` | needs a full importer sweep before deletion |
| `packages/shared/src/index.ts` | REUSE + EXTEND | `SPECIES_PARAMS` gains the 3.4 parameters only; `Branch` is NOT extended (see the state-footprint note in 3.3) | shared is imported everywhere, so adding fields is the expensive kind of change and is avoided here |
| `packages/engine/src/BonsaiTree.ts` | REUSE | at most a day-start `countLivingBranches()` snapshot helper | must not change `countLivingBranches()` semantics - the G2 id invariant depends on it (`BonsaiTree.ts:328,330`) |
| `packages/engine/src/tree.ts` | REUSE | none - `tick()` is retired (`tree.ts:8`), it is types and constants now | none |
| `packages/engine/src/CareLogReplay.ts` | REPAIR only under Option A or C | plumb the chosen version input through `reconstruct` | replay is the determinism authority; `DECISIONS.md:124` records a real determinism break caused by a record/replay constant mismatch |
| `packages/engine/src/PruneEngine.ts` | REUSE | none in this workstream | U1: the surviving-tip boost must be confirmed present before R3's pruning clause is called satisfied |
| `packages/engine/src/StatDeriver.ts` | REUSE | none | downstream of branch count: V41 says `skillSlots` comes from depth-2+ branch count, so its OUTPUT changes even though the file does not |
| `packages/voxelizer/src/index.ts` | REUSE | none | untouched only because curvature is deferred; R8 requires this stay true |
| `apps/web/src/renderer/tree_mesh.ts` | REUSE for v2 | none; it draws straight tapered tubes with tip leaves and will draw more of them | if curvature is later built, this file is replaced, not patched (`tree_mesh.ts:17-18`) |
| `apps/server/supabase/functions/_shared/kijo-engine.js` | REPLACE (regenerate) | rebuild via `build-edge.sh`; never hand-edit | it is a generated artifact carrying a second copy of the algorithm (`:929-930`); hand-editing it is the drift the script header warns about |
| `apps/server/supabase/functions/_shared/build-edge.sh` | REUSE | run it; optionally add a staleness check | none |
| `packages/engine/test_growth.mjs` | REPAIR | keep G1-G5; replace G6's `[5,200]` with the R1 band check plus an explosion bound; add the new checks in 3.7 | the existing G6 is the reason the wrong number got tuned in the first place (`GrowthEngine.ts:97-98`) |
| `scripts/debug-branches.mjs` | REUSE | optionally print the growth version | none - it is a read-only audit tool |
| `DECISIONS.md` | REPAIR (append) | the owner's section 2 choice, plus one entry per deferral in section 4 | protected path: only an agent or session with that authority may write it |
| `STATE.md` | REPAIR | record the new gates; mark A8/A9 superseded (they test the retired `tick()`, `STATE.md:100-101`) | protected path |

Sequencing note: `GrowthEngine.ts` and `species.ts` are the same change viewed twice. Do the engine edit with `SPECIES` still imported, then retire `species.ts` in its own commit once the importer sweep is clean - never both in one commit, so a determinism diff has one cause.

---

## 7. Cross-reference check

### 7.1 Terminology

Terms this design uses, and where each is canonical. Nothing is renamed or redefined here.

| Term | Canonical source | Used here as |
|---|---|---|
| kijonsai / kijo | `docs/GDD.md`, `docs/KIJO-PRD.md` | kijonsai = the tree and its NFT; kijo = the spirit. Filenames such as `kijo-engine.js` are quoted, not renamed. |
| one-third rule / bare lower trunk | `KIJO-TECH-SPEC.md:343-351` | the lower third of the trunk stays branchless; first main at `trunk.length * 0.33` |
| taper | `KIJO-TECH-SPEC.md:371-385`, `GDD.md:235` | monotonic thickness, lowest branch thickest |
| `attachmentY` | `KIJO-ENGINE-API.md:58`, `KIJO-TECH-SPEC.md:921` | attachment height of a branch on its parent, unchanged semantics |
| apical dominance | `packages/shared/src/index.ts:400`, `DECISIONS.md:234` | leader-tip suppression strength, unchanged |
| internode | research `RESEARCH-OPENSOURCE-BONSAI-2026-07-31.md:112,179` | extension distance between forks - the research's own term |
| main branch | `KIJO-TECH-SPEC.md:349-351`, `GDD.md:235` | a depth-1 branch off the trunk |
| `growthVersion` | NEW - introduced by this design (section 2) | a new term, explicitly new, and only if the owner picks Option A or C |
| 15-30 branch target | `DECISIONS.md:12` | the R1 acceptance band, unchanged |

### 7.2 Conflicts and gaps found

| # | Conflict or gap | Where | Resolution proposed here |
|---|---|---|---|
| X1 | Fork constants disagree three ways: `16 + depth*7` / `0.38 - depth*0.05` (spec) vs `8 + depth*5` / `(1.0 - depth*0.1)` (decision log) vs both shipping in code | `KIJO-TECH-SPEC.md:234-235` vs `DECISIONS.md:12-14` vs `GrowthEngine.ts:99,119` | v2 replaces both sets with the internode schedule; the spec section gets a one-line pointer to the decision log, and the new constants get their own DECISIONS entry |
| X2 | The spec requires depth-1 mains DISTRIBUTED up the upper trunk; the engine can only ever produce one main | `KIJO-TECH-SPEC.md:349-359` vs `GrowthEngine.ts:87,104-116` | fixed by 3.2a (trunk re-fork); this is the highest-value change in the design |
| X3 | Rotation influence fully specified, entirely unimplemented | `KIJO-TECH-SPEC.md:316-327` vs grep result (V23) | implemented in 3.2d; closes R3's rotation clause |
| X4 | Spec leaves depth falloff as open research with two candidates; the exponential form already shipped | `KIJO-TECH-SPEC.md:296-314` vs `GrowthEngine.ts:82` | no change to the formula; a doc-hygiene note that the spec's open question is closed by `DECISIONS.md:234`, not by the spec |
| X5 | GDD's ARM/LEG morphology split keys off attachment height across MULTIPLE mains; the engine has been computing it over one main | `GDD.md:235` vs V4 and `STATE.md:97` | after v2 there are several mains, so ARM/LEG distribution and every derived stat profile changes. This is a GDD-facing consequence the owner should see BEFORE approving, and a reason the v2 change needs its own stat-regression pass (step I7) |
| X6 | `skillSlots` derives from depth-2+ branch COUNT; no cap or scaling rule documented | `KIJO-ENGINE-API.md:79` | UNVERIFIED: read `StatDeriver` before and after v2 and report the delta in the implementation record |
| X7 | `nextBranchId` start value left explicitly ambiguous in the API doc | `KIJO-ENGINE-API.md:98` vs `BonsaiTree.ts:328,330` | doc hygiene: the code already pins the invariant; the API doc should stop saying "or 1" |
| X8 | The decision log contradicts itself and the shipping constants on fork spread ordering: `DECISIONS.md:180` says tropical is widest (1.2 rad), while `DECISIONS.md:184-186` and `packages/shared/src/index.ts:407-409` make tropical narrowest (0.10-0.40 rad) | `DECISIONS.md:180` vs `:184-186` | the code wins (0.10-0.40 rad for tropical); the 3.4 table follows the code. The stale entry is not reverted - the log is append-only - but the new DECISIONS entry should note it |
| X9 | PRD promises surviving tips boost after a prune; the mechanism is unverified in the engine | `KIJO-PRD.md:203`, U1 | pre-check in step I0; if absent, it becomes its own task (it is not a growth-rule change) |
| X10 | The PRD describes server-side growth ticking every 8 hours; the server runs a committed copy of the algorithm that does not update itself | `KIJO-PRD.md:337` vs `kijo-engine.js:929-930`, `build-edge.sh:8` | bundle regeneration is part of "done" (step I8), not optional polish. A stale bundle means the design is not live in production even when the tests pass |
| X11 | `STATE.md` lists A8/A9 as passing evidence, and both test `tick()`, which was retired 2026-08-07 | `STATE.md:100-101` vs `tree.ts:8` | mark superseded in step I10; do not cite them as current evidence |
| X12 | Architecture boundary: engine imports `shared` only, and must never import the voxelizer or any IO/rendering library | `KIJO-ARCHITECTURE.md:242` | honored: the new parameters are plain numbers in `shared`; phototropism uses rotation state, not voxel data. This boundary is the main reason full space colonization is deferred (4.2) |
| X13 | No acceptance document states the branch band except a passing mention in the decision log | `DECISIONS.md:12` | this design supplies the per-species count check (step I4) as the durable acceptance artifact |
| X14 | R7 (care-loop truthfulness) is named by the goal document but is not a growth-rule problem | `GOAL-GROWTH-ENGINE.md:86-88` | explicitly out of scope here and flagged, not silently dropped; see open question Q4 |

### 7.3 Cross-reference verdict

The design does not introduce a new architecture, a new package, or a new data model beyond one optional version field and one optional `Branch` field. It removes a spec/code contradiction (X1, X2, X3), closes a documented gap (X13), and creates one new visible consequence that needs owner awareness: X5, the ARM/LEG and stat-profile shift caused by going from one main branch to many.

---

## 8. Assumptions register

Each assumption the design depends on, what breaks if it is wrong, and how it is mitigated. ASSUMED and UNVERIFIED items from section 5 appear here as risks, not as facts.

| # | Assumption | If it is wrong | Mitigation | Revisit trigger |
|---|---|---|---|---|
| R-1 | The trunk re-fork change (3.2a) is the dominant cause of the low count | The count stalls again and the band depends entirely on the floor controller, producing a legal but shapeless tree | Build the measurement before the fix: step I3 measures count with ONLY 3.2a plus the internode gate, and I4 only then tunes | count at day 180 still under 15 after I3 |
| R-2 | The 3.4 starting values land in band after calibration | Species over- or under-shoot the band | I4 is an explicit calibration loop with printed per-species counts, not a one-shot value guess; the band is asserted, never assumed | any species outside 15-30 at day 180 |
| R-3 | The audited tree's regime was not the healthy regime (A1) | The 4-branch result IS representative of healthy care, meaning the constants are far worse than diagnosed and the fix must be larger | I4 runs the named regime and prints rate/moisture/health next to count, so the comparison is controlled | the audited tree's log shows daily watering and fertiliser |
| R-4 | Deriving branch extension-since-birth as `round4(b.length - 1.0)` (A6) | The internode schedule drifts silently for any branch not born at exactly 1.0 | assert newborn length in the same check as the internode schedule; fail loudly if a different birth length is ever introduced | any change to the newborn branch literal |
| R-5 | The taper normalisation pass is cheap (A4) | Per-tick cost grows with branch count, on top of the branch-count increase already caused by v2 | measure engine run before and after in one step; if it is not cheap, run the clamp once per day instead of per pass | any measured tick-time regression |
| R-6 | Rotation bias (3.2d) does not destabilize existing extension invariants | The existing extension/G-gate suite breaks | bias multiplies the FORK PROBABILITY term only, never extension (3.3), so the extension path is untouched | any G-gate regression after I6 |
| R-7 | The engine/test suites that exist can still be run by the implementer | Landed changes have no local proof, and the design's "named done-check" pattern collapses to description | I0 must confirm the test runner works before the first code edit; if it cannot be run, the implementer reports blocked rather than editing blind | test command unavailable or failing at baseline |
| R-8 | Regenerating the edge bundle is enough to make the change live server-side | Production keeps running the old algorithm while tests pass locally (X10) | I9 compares the same count check run against the bundle and the TS sources and requires identical numbers | bundle and source disagree |
| R-9 | The stat pipeline (voxelizer -> `StatDeriver` -> combat) needs no code change, only acceptance | Combat balance shifts without anyone noticing, because `skillSlots` keys off depth-2+ branch count (V41) | I7 records the printed stat delta and surfaces it as owner question Q3 | stat delta larger than the owner accepts |
| R-10 | Postponing curvature (4.3) leaves the tree recognisable as a bonsai | The result still reads as a straight-tube scaffold and the visual goal fails even though the branch count passes | the owner's playtest is the only judge (3.8); if it fails, curvature becomes a second bounded pipeline, and it is already scoped in 4.3 with the research's representation | owner playtest says it does not read as a bonsai |
| R-11 | The named regime is an acceptable definition of "healthy" | The band is provable only inside a regime nobody plays, which would make the acceptance check theatre | Q9 asks the owner to confirm or replace the regime, and the check prints the regime alongside the count | owner disagrees with the regime |
| R-12 | Legacy trees' safety is decided explicitly rather than by default (section 2) | Minted kijonsai change shape and stats silently - the one outcome R6 forbids | no code path that changes legacy replay may be merged before I1's recorded owner choice | any attempt to merge v2 constants without the I1 record |

---

## 9. Implementation plan (for the disciplined-implementer phase)

Rules for the implementer: one step per commit, never two determinism-critical changes in one commit; every step's done-check is a NAMED, PRINTED result, not "looks right"; if a done-check cannot be produced, the step is blocked and reported, not declared done. The engines of this design live under `res://kijo-bonsai/packages/` and `res://kijo-bonsai/apps/`, which are outside this design pass's enforced write authority - step I0 exists to establish whether the implementer has it.

| Step | Work | Named done-check |
|---|---|---|
| I0 | Pre-flight. Establish write authority; then resolve U1 (does `PruneEngine` boost surviving tips), U2 (exact `moistureFactor`/`fertFactor`), U3 (enumerate every replay call site), U6 (read `ARCH-NATURAL-GROWTH-MODEL-2026-08-26.md`); confirm the existing test suites run at baseline | `PREFLIGHT-REPORT`: each of U1/U2/U3/U6 answered with file+line or "absent", plus a baseline test run recorded, plus an explicit statement of whether writes under `packages/` succeed |
| I1 | Owner decision gate on section 2. Record the choice | `OWNER-VERSION-CHOICE`: a `DECISIONS.md` line naming the chosen option (A/C/D) and the mainnet-token answer. No further step may merge before this exists |
| I2 | Only if A or C: freeze the current constant set as a named v1 preset, data-only, no behaviour change | `V1-FREEZE`: replaying seed 464497 for 200 days with the v1 preset reproduces the pre-change branch structure and `totalMass` exactly; printed diff = 0 |
| I3 | Structural fix only: trunk re-fork (3.2a) plus the internode gate (3.2b). No floor, no ceiling, no rotation | `TRUNK-REFORK`: at day 180 under `REGIME_HEALTHY`, at least 3 living depth-1 branches, each with `attachmentY >= 0.30 * finalTrunkLength`, and no depth-1 branch before `trunk.length >= MIN_TRUNK_FOR_FIRST_BRANCH` |
| I4 | Calibrate the 3.4 species table until the band is met, then freeze the values | `BAND-180`: for all three species under `REGIME_HEALTHY`, day 180, zero prunes, printed living-branch count in 15-30, printed alongside rate/moisture/health |
| I5 | Floor and ceiling controller (3.2c) with the once-per-day count snapshot | `CAP-BOUND`: living count never exceeds `branchCap + 1` over 365 days for all three species. `FLOOR-REACH`: with a live frontier, count reaches `branchFloor` by `floorDay + 30` |
| I6 | Rotation bias (3.2d) as `apply_rotation_bias` | `ROTATION-EFFECT`: identical seed/species/day/replay with rotation 0 vs 90 produces non-equal branch lengths; each configuration replays identically twice in a row |
| I7 | Taper clamp and assertion (3.2e), then the stat regression pass | `TAPER`: at day 180 for all three species, trunk thickness strictly decreasing base to apex and living depth-1 thickness non-increasing with `attachmentY`. `STAT-DELTA`: D1-D7 and V1-V5 pass and the printed combat-stat delta versus pre-change is recorded |
| I8 | Retire `species.ts`: move the remaining fields, delete `forkAngle` | `NO-DEAD-SPECIES-FIELD`: repo grep for `forkAngle` returns zero code hits and zero importers of `species.js`, with the build passing |
| I9 | Regenerate the server bundle | `BUNDLE-MATCH`: `kijo-engine.js` regenerated, byte size recorded, and the 180-day band check run against the bundle returns the same numbers as the TS run |
| I10 | Tests and docs | `GATES`: G1-G5 pass unchanged; G6 asserts the 15-30 band under the named regime plus an explosion bound; new taper/rotation/band gates listed pass/fail in the implementation record; `STATE.md` A8/A9 marked superseded (X11); `DECISIONS.md` carries the version choice (I1) and one entry per section-4 deferral |
| I11 | Legacy safety, per the I1 choice: A/C - prove legacy replay unchanged; D - run the re-render sweep | A/C: `LEGACY-EXACT` - kijonsai `140ec05f` replays to the same branch-by-branch structure printed before and after. D: `RE-RENDER` - `render_queue` rows inserted for every minted token and the affected-token count recorded |
| I12 | Handoff packet to the adversarial-auditor phase | `AUDIT-PACKET`: every changed file with its hash, every gate output, the three-species band print, and the deferral list - with no claim that any visual or behavioural result was verified |

Two ordering constraints that are not negotiable:
- I1 before I2-I11 whenever the owner's choice is A or C. The version mechanism is not retrofittable onto an already-changed algorithm without re-doing the replay evidence.
- I3 and I4 before I5. The floor controller (I5) is a backstop that can hide a broken structural fix: if the band is only reachable because the floor forces forks, the tree shape is being held up by the guarantee rather than by the growth model. I4's printed output must show the band is reached with the floor inactive at day 180 for at least one species.

What the implementer must NOT do: change `Branch` semantics or the voxelizer/`StatDeriver` contract (R8); add `Math.random`, `Date.now`, `crypto`, or any wall-clock/unordered iteration to the engine; hand-edit `kijo-engine.js`; relax the depth-6, one-third, or taper constraints to hit the branch count; or claim any visual outcome, since no step here can produce one.

---

## 10. Open Questions

**Q1 - OWNER DECISION - engine versioning. This is the gate on the whole plan.**
How do the new growth rules reach the 15-30 target without changing how already-minted kijonsai derive? Options, trade-offs and a recommendation are in section 2; the question is restated verbatim in 2.5. Nothing in section 9 beyond I0 may run until this is answered and recorded in `DECISIONS.md`. The design does NOT choose.

**Q2 - OWNER - mainnet exposure.**
Are there any mainnet Kijonsai ERC-721 tokens, and does any holder depend on a specific existing tree's shape, voxel profile or stats? The `DECISIONS.md:238` precedent rests on "no mainnet tokens exist per STATE.md"; if that is still true, Option D is defensible, and if it is not, Option D is unavailable.

**Q3 - OWNER - the stat consequence.**
`skillSlots` derives from depth-2+ branch count (`KIJO-ENGINE-API.md:79`). Going from a 4-branch spine to a 15-30 branch tree changes the derived combat profile of every future tree, and the ARM/LEG split (`GDD.md:235`) goes from being computed over one main to several (X5). Does the owner accept the stat shift, or should the stat pipeline be re-normalised in the same pipeline so the current power scale is preserved? Step I7 prints the delta either way.

**Q4 - OWNER - R7 care-loop truthfulness.**
The goal document's R7 (`GOAL-GROWTH-ENGINE.md:86-88`) is not a growth-rule problem and this design does not touch it. It needs an owner of its own, or an explicit statement that it is out of this workstream. It is flagged rather than dropped.

**Q5 - HARNESS - write authority for the implementer phase.**
The changes in section 6 are all under `res://kijo-bonsai/packages/` and `res://kijo-bonsai/apps/`, plus `DECISIONS.md` and `STATE.md`, which are protected in this environment. If the implementer session inherits the same bounds, that phase is blocked at its first write and must report it rather than work around it. Step I0 checks this first.

**Q6 - OWNER - re-auditing the product tree.**
Should the audited kijonsai (`140ec05f`) be re-replayed after v2 to produce a before/after product measurement? `scripts/debug-branches.mjs` needs network access to the Supabase project (`debug-branches.mjs:11,18`), which this environment does not have. The step I4 check is synthetic (same engine, named regime); the product-tree re-audit is the honest end-to-end measurement, and someone with network access has to run it.

**Q7 - OWNER - which document is the target of record for growth constants.**
`KIJO-TECH-SPEC.md:234-235` and `DECISIONS.md:12-14` currently disagree with each other and with the code (X1). This design proposes: the spec keeps the algorithm shape, the numbers live in `SPECIES_PARAMS`, and the spec section gains a pointer to the decision log. Confirm that the spec stays the target-of-record, or demote §4.2 to historical.

**Q8 - OWNER - curvature deferral.**
Section 4.3 defers branch curvature. Accepting that deferral means the tree is still drawn as straight tapered tubes with leaves only at tips (`tree_mesh.ts:17-18,234-242`) after this workstream, and the "grows in a direction" trait is satisfied only by rotation-driven vigour, not by visible bend. If the owner wants bend in the same breath, this becomes a second bounded pipeline that invalidates every existing render.

**Q9 - OWNER - the named care regime.**
The band is regime-conditioned by construction (3.2c): a tree with no water does not grow, and should not. Section 3.8 uses `REGIME_HEALTHY` = water daily, fertilize weekly, no pruning. Is that the right definition of "healthy, well-tended" for R1's acceptance check, or does the owner want a second, weaker "typical player" regime reported alongside it?

**Q10 - OWNER - cap semantics.**
The design makes `branchCap` a hard ceiling on forking, so a species cannot exceed `cap + 1` living branches no matter how long it is played, and a heavily pruned tree regrows back toward the cap. Confirm that is the intended product behaviour, versus a soft target that intensive long-term care can exceed.

**Q11 - DESIGN - branch-count definition.**
`countLivingBranches()` excludes the trunk (`BonsaiTree.ts:328,330`), and the recorded audit uses that same definition (`debug-branches.mjs:47`). The 15-30 target in `DECISIONS.md:12` does not say which count it means. This design assumes living branches excluding the trunk, consistent with the existing gate and the audit. Confirm, because a 15-30 target that includes the trunk shifts every aim in 3.8 by one.

**Q12 - AUDITOR - what counts as evidence in this pipeline.**
No step in section 9 produces a visual or behavioural verdict. The deliverable of this workstream is a saved, asserted, printed set of structural measurements. If the owner expects a rendered proof of "it looks like a bonsai", that expectation has to be met by the owner's playtest of the web client, optionally against a reference image - it cannot be met from inside this environment, and this design does not pretend otherwise.
