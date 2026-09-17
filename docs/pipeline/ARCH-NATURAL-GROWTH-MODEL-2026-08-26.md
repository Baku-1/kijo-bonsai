# ARCH: Natural Growth Model — Continuous Extension with Apical Dominance

**Date:** 2026-08-26
**Author:** Claude (Architect stage)
**Status:** SPEC ONLY — no code changes
**Consumed by:** Implementer (disciplined-implementer) → Auditor (adversarial-auditor)

---

## DESIGN TASK

Revise `GrowthEngine.extendAndFork` so that parent branches (including the trunk) continue extending after forking, at reduced rates governed by apical dominance. Currently, once a branch forks it stops extending forever — biologically incorrect and visually wrong.

**DELIVERABLE:** This architecture spec. Pseudocode, new SPECIES_PARAMS fields, migration plan, gate impact analysis, open questions.
**BUILDS ON:** GrowthEngine.ts (current implementation), KIJO-TECH-SPEC §4.2/§4.4, DECISIONS.md, RESEARCH-OPENSOURCE-BONSAI-2026-07-31.md
**CONSUMED BY:** Implementer who will modify GrowthEngine.ts, then Auditor who will verify gates.

---

## 1. CODEBASE RECONNAISSANCE

### Files read

| File | Path |
|---|---|
| GrowthEngine.ts | `packages/engine/src/GrowthEngine.ts` |
| shared/index.ts | `packages/shared/src/index.ts` (SPECIES_PARAMS at line 402) |
| species.ts | `packages/engine/src/species.ts` (legacy forkChance) |
| test_growth.mjs | `packages/engine/test_growth.mjs` (G1-G6 gates) |
| KIJO-TECH-SPEC.md | `docs/KIJO-TECH-SPEC.md` (§4.2, §4.4, §4.6) |
| KIJO-ENGINE-API.md | `docs/KIJO-ENGINE-API.md` (extendAndFork sig, determinism) |
| DECISIONS.md | root `DECISIONS.md` |
| STATE.md | root `STATE.md` |
| DESIGN-SPECIES.md | `docs/DESIGN-SPECIES.md` |
| GDD.md | `kijo/docs/GDD.md` (§3.3) |
| RESEARCH-OPENSOURCE-BONSAI-2026-07-31.md | `docs/research/` |

### Symbols verified

| Symbol | Location | Exported | Signature / Shape |
|---|---|---|---|
| `GrowthEngine.extendAndFork` | GrowthEngine.ts:49 | private static | `(b: Branch, tree: BonsaiTree, rate: number): void` |
| `GrowthEngine.thickeningPass` | GrowthEngine.ts:167 | private static | `(b: Branch, tree: BonsaiTree, rate: number): number` |
| `GrowthEngine.calculateGrowthRate` | GrowthEngine.ts:36 | static | `(tree: BonsaiTree): number` |
| `GrowthEngine.growTick` | GrowthEngine.ts:24 | static | `(tree: BonsaiTree): void` |
| `SPECIES_PARAMS` | shared/index.ts:402 | yes | `{ extensionMultiplier, forkSpreadMin, forkSpreadMax, secondaryForkChance, trunkMaturationRate }` |
| `SPECIES` | species.ts | yes | `{ growthRate, forkChance, forkAngle, thickenRate, moistureDecay }` |
| `SeededRNG` | shared/index.ts | yes | `constructor(seed: number)`, `.next(): number` |
| `round4` | shared/index.ts | yes | `(n: number): number` |
| `Branch` | shared/index.ts | yes (type) | `{ id, parent, depth, angle, length, thickness, pruned, children, attachmentY, ... }` |

### Call sites for `extendAndFork`

- `GrowthEngine.ts:30` — called from `growTick`: `GrowthEngine.extendAndFork(tree.getRoot(), tree, rate)`
- `GrowthEngine.ts:158` — recursive self-call: `GrowthEngine.extendAndFork(branches[id], tree, rate)`

### The bug (line 55)

```typescript
if (living.length === 0) {
  // ---- Tip: extend ----
  // ... extension logic ...
  // ... fork check ...
}
// Pre-order recursion (line 156-159) — children get iterated,
// but non-tip parents NEVER enter the extension block above.
```

Once a branch has any living children (`living.length > 0`), it skips the entire extension+fork block. It only recurses into children. The branch's `length` is frozen forever after its first fork.

### Gap found

Tech spec §4.2 line 249 shows `tree.length += 0.25 * rate` for explicit trunk extension on every tick. This pseudocode is **NOT implemented** in GrowthEngine.ts — the trunk only extends while it has zero children (i.e., before its first fork). This is the discrepancy this spec resolves.

---

## 2. VERIFICATION LOG

### Verified

- ✓ **Palubicki et al. 2009 "Self-organizing tree models for image synthesis" (SIGGRAPH)** — Vigor distribution with apical dominance. Resource allocated to main shoot vs lateral branches via apical control parameter λ. Main shoot gets `λ * light_main`, lateral gets `(1-λ) * light_lateral`. Confirmed via Caner Coşkun's TreeGen implementation (MIT, C++, GitHub: caner-milko/TreeGen) which implements this paper directly with working code.
- ✓ **Borchert-Honda model** — Extended BH model for resource allocation in tree structures. ML ratio (main-to-lateral length ratio) determines apical control strength. Higher ratio = stronger apical dominance = more excurrent (conifer-like) growth. Cited in multiple academic sources.
- ✓ **Runions 2007 space colonization** — Already referenced in RESEARCH-OPENSOURCE-BONSAI-2026-07-31.md. Competition for space determines branching structure. Relevant for direction, not directly for extension rate.
- ✓ **Leonardo's Rule** — Implemented at GrowthEngine.ts:167-194. `parent.thickness² >= sum(child.thickness²)`. Confirmed in code.
- ✓ **Determinism invariant** — Per-branch RNG: `SeededRNG(seed + branch.id * 7919 + day * 37)`. Confirmed at GrowthEngine.ts:60. round4() discipline confirmed throughout.
- ✓ **Depth falloff currently linear** — `Math.max(0.1, 1.0 - b.depth * 0.15)` at line 57. Tech spec §4.4 line 312 TODO flags exponential `0.7^depth` as potentially more realistic (R9, MEDIUM priority).
- ✓ **Gate fixture values (seed 464497, hardwood, day 200)** — 8,797 voxels, hp=807.8, power=378, endurance=248, ki=414, skillSlots=21. From STATE.md.

### Unverified

- ? **Optimal apical dominance ratio for game-feel** — No empirical data on what λ values produce the best visual results in a voxelized bonsai game context. Must be playtested.

### Refuted

- ✗ **"Trunk always extends per tech spec"** — Tech spec §4.2 line 249 describes this, but the TypeScript implementation does NOT do it. The spec and code are out of sync. This architecture resolves the discrepancy by making the code match the spec's intent (continuous parent extension).

---

## 3. RESEARCH REFERENCES

### 3.1 Palubicki et al. 2009 — Self-organizing tree models (SIGGRAPH)

**Core mechanism:** Each branch node accumulates light from its buds (leaf-to-root), then distributes vigor from root to leaf. The distribution at each fork point uses an **apical control parameter λ**:

```
vigor_main    = λ * light_main
vigor_lateral = (1 - λ) * light_lateral
multiplier    = parent_vigor / (vigor_main + vigor_lateral)
vigor_main    *= multiplier
vigor_lateral *= multiplier
```

When λ > 0.5, the main (terminal) shoot gets proportionally more resources → stronger apical dominance → more excurrent (Christmas-tree) shapes. When λ < 0.5, lateral branches dominate → decurrent (oak-like) spreading crowns.

**Kijo adaptation:** We don't need the full light-accumulation pass (too expensive for a per-tick game engine). Instead, we approximate the vigor distribution ratio as a **post-fork extension dampening factor** applied to inner branches. The leader child (longest living child) extends at full rate; subordinate children and the parent itself extend at reduced rates.

**CODE SOURCE AUDIT:**
- **Origin:** Caner Coşkun's TreeGen (GitHub: caner-milko/TreeGen, MIT license)
- **License:** MIT ✓ (commercial OK)
- **Version:** C++20 / OpenGL 4.6
- **Current:** Active project (2024), implements Palubicki 2009 faithfully
- **Adaptation:** Algorithm-level reference only. No code will be copied. Kijo uses a simplified approximation (no shadow propagation, no space colonization).
- **Verdict:** REFERENCE ONLY — adapt the apical control concept, not the code.

### 3.2 Borchert-Honda Model — ML Ratio

The **main-to-lateral length ratio (ML ratio)** is a measurable property of real trees that quantifies apical dominance strength. Trees with strong apical dominance (conifers) have ML ratios of 2-4×; trees with weak apical dominance (spreading hardwoods) have ML ratios near 1.

**Kijo adaptation:** Each species class gets an `apicalDominance` parameter that functions as a simplified ML ratio, controlling how much the leader child's extension rate exceeds that of subordinate siblings and the parent.

### 3.3 Existing Kijo Research (RESEARCH-OPENSOURCE-BONSAI-2026-07-31.md)

Key finding from the existing audit: **"No existing repo implements structural stress physics or apical dominance."** This confirms Kijo's natural growth model is original work. The L-System grammar reference (abiusx/L3D) and Frank Force's Go Bonsai seasonal growth design are relevant as design inspiration, not as implementation references.

---

## 4. THE DESIGN

### 4.1 Core Change: Inner Branch Extension

**Current behavior:** Only tip branches (no living children) extend.
**New behavior:** ALL non-pruned branches extend every tick, but at rates modulated by their role in the tree hierarchy.

A branch's **extension role** is one of:

| Role | Condition | Extension Rate Multiplier |
|---|---|---|
| **Leader tip** | No living children AND is the longest living child of its parent (or is root) | `1.0` (full rate — current behavior preserved) |
| **Subordinate tip** | No living children AND is NOT the longest living child of parent | `1.0 - apicalDominance * 0.5` |
| **Inner leader** | Has living children AND is the longest living child of parent | `parentExtensionRate` (species-specific, see §4.3) |
| **Inner subordinate** | Has living children AND is NOT the longest living child of parent | `parentExtensionRate * (1.0 - apicalDominance * 0.5)` |
| **Trunk (depth 0)** | Root branch, always the leader by definition | `trunkContinuedRate` (species-specific, see §4.3) |

### 4.2 Revised `extendAndFork` Pseudocode

```
extendAndFork(b: Branch, tree: BonsaiTree, rate: number):
    if b.pruned: return

    branches = tree.getBranches()
    living = b.children.filter(id => !branches[id].pruned)

    day = tree.getAge()
    rng = SeededRNG(seed + b.id * 7919 + day * 37)
    sp = SPECIES_PARAMS[tree.getSpecies()]
    spE = SPECIES[tree.getSpecies()]

    depthFalloff = round4(sp.depthFalloffBase ^ b.depth)  // NEW: exponential, species-specific

    if living.length === 0:
        // ── TIP BRANCH: full extension (current behavior, minor refactor) ──
        ext = round4((1.2 + rng.next() * 2.8) * rate * depthFalloff)
        b.length = round4(b.length + ext)

        // Fork check (unchanged from current implementation)
        forkThresh = 8 + b.depth * 5
        if b.length > forkThresh AND b.depth < 6:
            // one-third rule, fork probability, child allocation
            // ... (no changes to fork logic) ...

    else:
        // ── INNER BRANCH: continued extension at reduced rate ──
        // Determine if this branch is the "leader" among its siblings
        isLeader = isLeaderChild(b, branches)

        if b.depth === 0:
            // Trunk: always extends
            innerRate = sp.trunkContinuedRate
        else if isLeader:
            innerRate = sp.parentExtensionRate
        else:
            innerRate = round4(sp.parentExtensionRate * (1.0 - sp.apicalDominance * 0.5))

        innerExt = round4((0.8 + rng.next() * 0.4) * rate * depthFalloff * innerRate)
        b.length = round4(b.length + innerExt)

    // Pre-order recursion (unchanged)
    for id in b.children:
        extendAndFork(branches[id], tree, rate)


isLeaderChild(b: Branch, branches: Branch[]): boolean
    if b.depth === 0: return true  // trunk is always leader
    parent = branches[b.parent]
    siblings = parent.children.filter(id => !branches[id].pruned)
    if siblings.length === 0: return true
    // Leader = longest living sibling
    longest = max(siblings, by: id => branches[id].length)
    return longest === b.id
```

**Key design decisions in the pseudocode:**

1. **Inner extension base range is `(0.8 + rng * 0.4)` not `(1.2 + rng * 2.8)`** — inner branches extend more slowly and more uniformly than tips. Tips need high variance for natural-looking crown shapes; inner branches should extend steadily.

2. **`isLeaderChild` uses length as the proxy for vigor** — consistent with Borchert-Honda's ML ratio. The longest child has the most "apical vigor." This is a runtime check, not stored state, so it can shift as children grow (natural leadership competition).

3. **Same RNG seed pattern** — `SeededRNG(seed + b.id * 7919 + day * 37)` preserved exactly. The inner-extension path consumes one `rng.next()` call. Fork RNG (offset +1, +2, +3) is untouched since inner branches don't fork (they already have children).

4. **Inner branches do NOT re-fork** — only tips fork. Once a branch has children, it only extends (never spawns additional children from the middle). This is biologically accurate (meristems are at tips) and keeps the branching topology clean.

### 4.3 New SPECIES_PARAMS Fields

Add to `SPECIES_PARAMS` in `packages/shared/src/index.ts`:

| Field | Type | Hardwood | Evergreen | Tropical | Description |
|---|---|---|---|---|---|
| `apicalDominance` | `number` | `0.65` | `0.80` | `0.45` | Strength of leader-tip preference (0=equal, 1=leader-only). Higher = more excurrent (tall/narrow). |
| `depthFalloffBase` | `number` | `0.72` | `0.68` | `0.78` | Base of exponential depth falloff: `depthFalloffBase ^ depth`. Replaces linear `max(0.1, 1.0 - depth*0.15)`. |
| `parentExtensionRate` | `number` | `0.20` | `0.15` | `0.30` | Inner branch extension multiplier relative to tip rate. |
| `trunkContinuedRate` | `number` | `0.25` | `0.20` | `0.35` | Trunk (depth 0) extension multiplier after first fork. Aligns with tech spec §4.2 line 249. |

**Rationale for species values:**

- **Hardwood (0.65 apical dominance):** Moderate apical dominance — wide spreading crowns with a visible leader. Oak/Maple archetype. Parent branches extend at 20% of tip rate (they thicken more than they lengthen).
- **Evergreen (0.80 apical dominance):** Strong apical dominance — tall, narrow, conifer-like. Leader tip dominates heavily. Parent branches extend least (15%) — growth energy goes to the leader. Matches "steady year-round, pressure combat" species identity.
- **Tropical (0.45 apical dominance):** Weak apical dominance — explosive, chaotic branching. All children grow nearly equally. Parent branches extend most (30%) — ficus-like growth where every branch becomes a sub-trunk. Matches "burst, glass cannon" identity.

### 4.4 Depth Falloff Change

**Current:** `Math.max(0.1, 1.0 - b.depth * 0.15)` (linear, floors at 0.1 at depth ≥ 6)
**Proposed:** `round4(sp.depthFalloffBase ** b.depth)` (exponential, species-specific)

| Depth | Current (linear) | Hardwood (0.72^d) | Evergreen (0.68^d) | Tropical (0.78^d) |
|---|---|---|---|---|
| 0 | 1.00 | 1.00 | 1.00 | 1.00 |
| 1 | 0.85 | 0.72 | 0.68 | 0.78 |
| 2 | 0.70 | 0.52 | 0.46 | 0.61 |
| 3 | 0.55 | 0.37 | 0.31 | 0.47 |
| 4 | 0.40 | 0.27 | 0.21 | 0.37 |
| 5 | 0.25 | 0.19 | 0.15 | 0.29 |
| 6 | 0.10 | 0.14 | 0.10 | 0.22 |

This resolves tech spec §4.4 TODO R9 ("exponential `0.7^depth` might be more realistic"). The exponential curve drops off faster at shallow depths (more dramatic differentiation between trunk and first-order branches) and asymptotes more gently at deep depths (avoids the sharp floor at 0.1).

### 4.5 Pruning Interaction

**No changes needed to pruning logic itself.** However, pruning now has a more interesting emergent effect:

- When the **leader child** is pruned, the next-longest sibling becomes the new leader and receives full tip-extension rate. This is biologically accurate — removing the apical meristem releases auxin inhibition on subordinate buds (apical dominance release).
- When an **inner branch** is pruned, its parent's extension rate is unaffected (parent extends based on its own role, not its children's count).
- The `isLeaderChild` function is evaluated dynamically every tick, so leadership naturally shifts after pruning. No stored "leader" flag needed.

This creates the gameplay loop the GDD intends: pruning the leader redirects growth energy to subordinate branches, exactly how real bonsai shaping works.

### 4.6 Determinism Invariant

**Preserved.** The changes maintain determinism because:

1. Same RNG seed pattern: `SeededRNG(seed + b.id * 7919 + day * 37)` — unchanged.
2. `isLeaderChild` is a pure function of current branch lengths — deterministic given the same tree state.
3. `round4()` applied to every arithmetic result — unchanged.
4. Pre-order recursion order — unchanged.
5. No new sources of non-determinism introduced. All new fields (`apicalDominance`, `depthFalloffBase`, `parentExtensionRate`, `trunkContinuedRate`) are constant per species.

**RNG consumption order:** For tip branches, the call pattern is identical (one `rng.next()` for extension, separate RNGs for fork). For inner branches, exactly one `rng.next()` call is consumed for the inner extension. This is a new consumption — but since inner branches previously consumed zero RNG calls, there is no change to the RNG state of any other branch's seeded sequence (each branch has its own independent seed).

---

## 5. GATE IMPACT ANALYSIS

### G1: Trunk thickness grows over 200 days
**Impact: NONE.** Thickening pass is unchanged. Trunk thickness will actually increase slightly (trunk extends longer → more mass → Leonardo's Rule drives slightly higher thickness). G1 passes more easily.

### G2: ID integrity (nextBranchId == livingBranches + prunedCount + 1)
**Impact: NONE.** No change to branch allocation or ID assignment.

### G3: Leonardo's Rule (parent.thickness² >= 0.9 * sum child.thickness²)
**Impact: NONE.** Thickening pass is unchanged. Inner branches extending longer may produce slightly different thickness distributions, but Leonardo's Rule is enforced post-order regardless.

### G4: Determinism (identical totalMass on same seed)
**Impact: FIXTURE VALUES CHANGE.** Trees will have different totalMass values because inner branches now extend. The assertion passes (same seed → same tree) but the expected fixture value will differ. **Action:** Re-record fixture values after implementation.

### G5: Max depth ≤ 6
**Impact: NONE.** Inner branches don't fork (only tips fork), so no new deeper branches are created. Depth cap check at line 71 (`b.depth < 6`) is unchanged.

### G6: Branch count in [5, 200]
**Impact: POSSIBLE SHIFT.** Longer inner branches may cause more tip extensions to cross the fork threshold faster (children of an inner branch that extends have a longer parent, potentially changing when subordinate tips fork). The range may need adjustment. **Action:** Run the gate after implementation; widen range if needed.

### Voxelizer (V-suite)
**Impact: FIXTURE VALUES CHANGE.** More total branch length → more voxels. V2 voxel count fixture (8,797 at day 200, seed 464497 hardwood) will increase. **Action:** Re-record after implementation.

### Stats (D-suite)
**Impact: FIXTURE VALUES CHANGE.** More voxels → different hp, power, endurance, ki, skillSlots. D1 fixture values will change. **Action:** Re-record after implementation.

### Server bundle
`apps/server/supabase/functions/_shared/kijo-engine.js` must be rebuilt after GrowthEngine.ts changes.

---

## 6. MIGRATION PLAN

### Step 1: Add SPECIES_PARAMS fields
Add `apicalDominance`, `depthFalloffBase`, `parentExtensionRate`, `trunkContinuedRate` to each species entry in `packages/shared/src/index.ts`. Non-breaking — existing code ignores unknown fields.

### Step 2: Modify `extendAndFork`
Replace the `if (living.length === 0)` gate with the new logic per §4.2. Add `isLeaderChild` helper (private static method or inline). Change `depthFalloff` from linear to exponential using `sp.depthFalloffBase`.

### Step 3: Re-record all fixture values
Run `test_growth.mjs` with current seeds, capture new fixture values for G4, G6, V2, D1. Update test assertions.

### Step 4: Rebuild server bundle
Run build pipeline for `apps/server/supabase/functions/_shared/kijo-engine.js`.

### Step 5: Update documentation
- KIJO-TECH-SPEC §4.2: Update pseudocode to match new implementation
- KIJO-TECH-SPEC §4.4: Mark R9 as RESOLVED (exponential depth falloff implemented)
- DECISIONS.md: Add entry for apical dominance model choice
- STATE.md: Update fixture values
- KIJO-ENGINE-API.md: Update `extendAndFork` description

### Existing trees
**No migration needed for persisted trees.** The change affects `extendAndFork` (runtime growth), not stored tree state. Existing trees will simply start extending inner branches on their next growth tick. There is no backward-incompatible data format change — `Branch` type gains no new fields; the new SPECIES_PARAMS fields are read-only constants.

However, **replaying the same care log from day 0 will produce a different tree** than before. This is the expected and accepted consequence — the old growth model was biologically wrong. Determinism is preserved (same seed + same code version = same tree), but cross-version determinism is intentionally broken.

---

## 7. CROSS-REFERENCE CHECK

| Document | Consistent? | Notes |
|---|---|---|
| GDD §3.3 | ✓ | GDD describes "per-day growth tick, tip extension, fork probability, inner branch thickening, trunk always thickens." New model adds inner branch extension alongside the existing thickening — consistent with GDD's intent. |
| KIJO-TECH-SPEC §4.2 | ✓ (resolves discrepancy) | Tech spec line 249 shows `tree.length += 0.25 * rate` for trunk. New model implements this via `trunkContinuedRate`. |
| KIJO-TECH-SPEC §4.4 | ✓ (resolves R9) | Exponential depth falloff replaces linear. R9 TODO resolved. |
| KIJO-ENGINE-API.md | ✓ | `extendAndFork` signature unchanged. Behavior description needs updating. |
| DECISIONS.md | ✓ | Fork threshold `8 + depth*5`, fork probability `forkChance * (1.0 - depth*0.1) * rate` — both unchanged. Depth falloff decision changes (linear → exponential). |
| DESIGN-SPECIES.md | ✓ | Hardwood slow/dense, Evergreen steady, Tropical explosive — new apical dominance values align with these identities. |
| RESEARCH-OPENSOURCE-BONSAI-2026-07-31.md | ✓ | Confirms no existing repo has apical dominance. This is original work with academic reference. |

**Terminology aligned:** ✓ — kijonsai, kijo, species classes (Hardwood/Evergreen/Tropical), care log, growth tick, depth falloff all consistent.
**Data shapes aligned:** ✓ — `Branch` type unchanged, `SPECIES_PARAMS` extended with new fields (additive).
**Boundary violations:** None — changes stay within `packages/engine/` and `packages/shared/`.

---

## 8. DECISION SUMMARY TABLE

| Decision | Choice | Rationale | Alternative Considered |
|---|---|---|---|
| Inner branch extension model | Reduced-rate extension with role-based multipliers | Simple, deterministic, species-differentiating. Avoids full resource-flow simulation. | Full Palubicki vigor distribution (too expensive per-tick), fixed trunk-only extension (doesn't extend inner branches at depth > 0) |
| Apical dominance mechanism | Length-based leader detection per tick | Dynamic (leadership shifts after pruning), no stored state, pure function of current tree. Borchert-Honda ML ratio simplified. | Stored "leader" flag (brittle, requires bookkeeping), birth-order-based (biologically inaccurate) |
| Depth falloff | Exponential `base^depth`, species-specific base | More realistic curve shape (Palubicki 2009), resolves tech spec R9 TODO, allows species differentiation. | Keep linear (simple but flat), universal 0.7 exponent (no species differentiation) |
| Inner branch forking | Disabled (only tips fork) | Biologically accurate (meristems at tips only), keeps topology clean, prevents branch count explosion. | Allow re-forking (complex, unpredictable branch counts, breaks G5/G6) |
| Cross-version determinism | Intentionally broken | Old model was wrong. Preserving wrong behavior for compatibility is worse than fixing it. Same-version determinism preserved. | Version-flag to switch models (added complexity for no gameplay benefit) |

---

## 9. ASSUMPTIONS REGISTER

| # | Assumption | Risk | Mitigation |
|---|---|---|---|
| A1 | The proposed species param values (apicalDominance, depthFalloffBase, etc.) will produce visually acceptable trees without extensive tuning | MEDIUM | Implement with the proposed values, then playtest. Values are easy to adjust — they're constants in SPECIES_PARAMS, not structural code changes. |
| A2 | Inner branches extending won't cause G6 branch count to exceed 200 | LOW | Inner branches don't fork, so they don't create new branches. Only tip fork timing may shift slightly due to changed depth falloff. Monitor and widen G6 range if needed. |
| A3 | One `rng.next()` call for inner extension won't affect downstream branch determinism | VERIFIED LOW | Each branch has its own independently seeded RNG. Adding consumption on branch X's RNG doesn't affect branch Y's RNG sequence. |
| A4 | `isLeaderChild` lookup (iterating parent's children) is O(small) and won't be a performance concern | LOW | Max children per branch is typically 1-2 (one fork = 1-2 children). Linear scan of 1-2 elements is negligible. |

---

## 10. OPEN QUESTIONS FOR JEREMY

**OQ-1: Should inner branch extension affect `attachmentY` of existing children?**
Currently, children record `attachmentY` at birth (their position along the parent). If the parent extends after forking, the child's attachment point is at the parent's length-at-birth, not the current tip. This means children appear to "slide down" the parent as it extends — which is biologically accurate (older branches are lower on the trunk). Confirm this is acceptable or whether `attachmentY` should be updated.

**OQ-2: Should the exponential depth falloff change (§4.4) be bundled with the inner-extension change, or shipped separately?**
These are logically independent changes. Bundling keeps the "natural growth model" atomic; separating reduces gate fixture churn to two smaller diffs. Recommend bundling since both affect the same function and fixture values change regardless.

**OQ-3: Do the proposed species param values feel right for game-feel?**
Hardwood apical dominance 0.65 (moderate leader preference), Evergreen 0.80 (strong — tall/narrow), Tropical 0.45 (weak — chaotic spread). These should produce visually distinct growth patterns, but may need tuning after seeing the first renders. Should we set up a visual comparison tool before implementing?

**OQ-4: Should inner branch extension be capped?**
Currently, inner branches extend indefinitely (just slowly). Should there be a maximum inner-branch length or a cap like `innerExt = 0 if b.length > maxInnerLength`? Real trees do exhibit determinate growth on older branches. For MVP, recommend no cap — let depth falloff naturally reduce extension to negligible amounts at deep branches.

---

## 11. ESTIMATED DIFF SIZE

| File | Change Type | Est. Lines |
|---|---|---|
| `packages/shared/src/index.ts` | Add 4 fields to 3 species entries | +12 |
| `packages/engine/src/GrowthEngine.ts` | Modify `extendAndFork`, add `isLeaderChild` | +25, -5 |
| `packages/engine/test_growth.mjs` | Update fixture values for G4, G6, V-suite, D-suite | ~10 (value changes) |
| `docs/KIJO-TECH-SPEC.md` | Update §4.2 pseudocode, mark R9 resolved | ~15 |
| `DECISIONS.md` | Add apical dominance entry | +10 |
| `STATE.md` | Update fixture values | ~5 |

**Total estimated diff: ~80 lines changed.** Well within the "smallest possible diff" principle.
