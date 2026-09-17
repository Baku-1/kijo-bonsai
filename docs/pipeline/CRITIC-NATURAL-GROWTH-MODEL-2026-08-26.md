# CRITIC: Natural Growth Model — Continuous Extension with Apical Dominance

**Date:** 2026-08-26
**Author:** Claude (Critic stage)
**Reviewing:** `docs/pipeline/ARCH-NATURAL-GROWTH-MODEL-2026-08-26.md`
**Skills applied:** adversarial-auditor, carmack-linus-review
**Status:** REVIEW COMPLETE

---

## GOVERNING PRINCIPLE

Every claim in the architect spec is treated as an unproven assertion until verified against actual code and documentation. Findings are ordered by severity.

---

## FINDING-1: Subordinate tip extension rate missing from pseudocode (MAJOR)

**Spec claims (§4.1 table):** Subordinate tips (no living children, NOT the longest child of parent) should extend at `1.0 - apicalDominance * 0.5` multiplier. For evergreen this is 0.60×, for tropical 0.775×.

**Pseudocode actually shows (§4.2):**
```
if living.length === 0:
    ext = round4((1.2 + rng.next() * 2.8) * rate * depthFalloff)
    b.length = round4(b.length + ext)
```

The tip path has NO `isLeaderChild` check. All tips — leader and subordinate — get identical extension rates. The `isLeaderChild` function is only called in the `else` (inner branch) path.

**Gap:** §4.1 defines five roles with four distinct rate multipliers for tips vs inner branches, leader vs subordinate. But §4.2 only differentiates inner leader / inner subordinate / trunk. The subordinate-tip multiplier is described in the table but never applied in the pseudocode.

**Impact:** Without subordinate tip differentiation, apical dominance only affects inner branches — approximately half the intended effect. The "leader tip suppresses subordinate tips" dynamic (the core of apical dominance in real trees) is missing.

**Recommended resolution:** Either:
- **(A)** Add `isLeaderChild` to the tip path in §4.2: `ext *= isLeaderChild(b, branches) ? 1.0 : round4(1.0 - sp.apicalDominance * 0.5)`. This matches §4.1 and completes the apical dominance model.
- **(B)** Remove the subordinate-tip row from §4.1 if the intent is tips-equal-always. Document the rationale (e.g., "tips compete equally; apical dominance only governs inner extension").

**Recommendation:** Option A. The biological model and the spec's own table demand it. Without subordinate tip suppression, the visual difference between species apical dominance will be subtle and only visible on older trees with many inner branches.

---

## FINDING-2: Cross-version determinism break under-documented for minted NFTs (MAJOR)

**Spec claims (§6, "Existing trees"):** "No migration needed for persisted trees... replaying the same care log from day 0 will produce a different tree... cross-version determinism is intentionally broken."

**What the codebase actually shows:**
- `nft-metadata/index.ts` (STATE.md line 191) runs the full engine pipeline: `CareLogReplay -> Voxelizer -> StatDeriver -> TechniqueClassifier` on every metadata request.
- `nft-image/index.ts` serves rendered PNGs from `renders/{tokenId}.png` in Supabase Storage.
- `render_queue` triggers Blender renders via the render worker.

**Gap:** After this code change ships:
1. **All existing NFT metadata changes** — stats (hp, power, endurance, ki), voxel counts, and Flower Guild Rank shift for every minted token. Marketplace listings show stale values.
2. **Rendered images become stale** — existing PNGs in the `renders` bucket depict the old growth model. Trees will look different when re-rendered.
3. **No re-render trigger** — the migration plan doesn't mention re-queuing existing tokens into `render_queue`. Without this, old renders persist indefinitely.
4. **No user notification** — tokens' combat stats change silently. A player who optimized their tree for the old stat distribution gets different stats with no warning.

**Recommended resolution:** Add a §6.6 "Operational Migration" to the spec:
- Document that all existing token metadata will change (expected and accepted).
- Add a migration step: `INSERT INTO render_queue (token_id, tree_id, trigger, status) SELECT token_id, id, 'model-update', 'pending' FROM trees WHERE token_id IS NOT NULL` to re-render all minted trees.
- Note that this is a testnet-only concern (no mainnet tokens exist per STATE.md).
- If mainnet tokens existed, this would be a CRITICAL finding requiring a versioned replay mechanism.

**Severity justification:** MAJOR not CRITICAL because STATE.md confirms mainnet deployment has NOT started. All minted tokens are on Saigon testnet. But the operational gap should be closed before this pattern repeats at mainnet scale.

---

## FINDING-3: `isLeaderChild` tiebreaker undefined (MINOR)

**Spec claims (§4.2):** `longest = max(siblings, by: id => branches[id].length); return longest === b.id`

**Gap:** When two siblings have identical `length` (which happens on the fork tick — both children start at `length: round4(1.0)` per GrowthEngine.ts:121), `max()` returns one of them based on array iteration order. The spec doesn't define which sibling wins.

**Actual behavior in code:** `b.children` is a `number[]` in insertion order (GrowthEngine.ts:150: `b.children.push(childId)`). The primary child (i=0) is always pushed first, so it wins ties. This IS deterministic, but it's implicit — the invariant depends on array insertion order, not on an explicit documented rule.

**Impact:** Low. Ties resolve deterministically. But the first fork tick is a guaranteed tie (both children start at length 1.0), so leadership assignment on that tick is entirely determined by insertion order, not by any biological property.

**Recommended resolution:** Add to §4.2: "Tiebreaker: when siblings have equal length, the earlier-inserted child (lower array index) wins. This is deterministic by construction (children are pushed in i=0, i=1 order during fork)."

---

## FINDING-4: Evergreen apical dominance 0.80 may conflict with DESIGN-SPECIES.md growth identity (ADVISORY)

**Spec claims (§4.3):** Evergreen 0.80 apical dominance → "tall, narrow, conifer-like. Leader tip dominates heavily."

**DESIGN-SPECIES.md says (line 37-39):** "Naturally tends toward Moyogi (Informal Upright) and Fukinagashi (Windswept) — flowing forms that suggest perpetual movement."

**Analysis:** 0.80 apical dominance produces strongly excurrent growth (Christmas-tree silhouette) where the leader tip extends 2.5× faster than subordinate tips (if FINDING-1 Option A is applied: subordinate rate = `1.0 - 0.80 * 0.5 = 0.60`). This creates a tall/narrow shape consistent with conifers but potentially inconsistent with the "flowing forms" description.

**Counterargument:** Apical dominance governs extension rate, not branch angle. The "flowing" character comes from forkSpread (0.30-0.70 rad for evergreen) and wiring, not from how fast the leader grows. A tall tree with moderate branch angles can still look flowing.

**Recommendation:** Accept the 0.80 value as a starting point (OQ-3 resolved — Jeremy accepted values for playtesting). Flag for visual review after implementation. If evergreen trees look too rigid/Christmas-tree-like, reduce to 0.65-0.70.

---

## FINDING-5: Trunk `trunkContinuedRate` deviates from tech spec §4.2 constant (MINOR)

**Tech spec §4.2 line 249-250:**
```
tree.thickness += 0.05 * rate
tree.length += 0.25 * rate
```

**Arch spec inner trunk extension (§4.2 pseudocode):**
```
innerExt = round4((0.8 + rng.next() * 0.4) * rate * depthFalloff * trunkContinuedRate)
```
With depthFalloff = 1.0 at depth 0, trunkContinuedRate = 0.25 for hardwood:
→ effective range: `[0.20, 0.30] * rate` per tick

**Gap:** The tech spec defines trunk extension as a constant `0.25 * rate`. The arch spec introduces randomness via `(0.8 + rng * 0.4)`, producing a range [0.20, 0.30] centered on 0.25. This is a deliberate improvement (natural variance) but is a deviation from the tech spec's exact formula.

**Impact:** Low — the mean is identical (0.25 * rate). The variance adds naturalism. But the tech spec should be updated to match.

**Recommended resolution:** §5 (Migration Plan, Step 5) already lists "KIJO-TECH-SPEC §4.2: Update pseudocode." Ensure the update reflects the randomized range, not just the multiplier. No code change needed.

---

## FINDING-6: Depth falloff values — tropical 0.78 allows significant deep-branch growth (ADVISORY)

**Spec proposes (§4.4 table):**

| Depth | Evergreen (0.68^d) | Tropical (0.78^d) | Ratio |
|---|---|---|---|
| 4 | 0.21 | 0.37 | 1.76× |
| 5 | 0.15 | 0.29 | 1.93× |
| 6 | 0.10 | 0.22 | 2.20× |

**Analysis:** At depth 6, tropical branches grow at 2.2× the rate of evergreen branches. Combined with tropical's higher `parentExtensionRate` (0.30 vs 0.15) and `extensionMultiplier` (1.3 vs 0.8), a tropical depth-6 tip extends at:
```
(1.2 + rng*2.8) * 1.3 * 0.8 * 0.22 ≈ [0.27, 0.92] per tick (tropical)
(1.2 + rng*2.8) * 0.8 * 0.68^6 * 0.15 ≈ [0.01, 0.03] per tick (evergreen depth-6 inner)
```

Tropical depth-6 branches are ~30× more active than evergreen depth-6 branches. This creates extreme species differentiation at deep depths, which is either the intended "glass cannon" identity or a source of G6 branch count explosion for tropical trees.

**Recommended resolution:** No code change. Flag for playtest verification. The spec's Assumption A2 notes that inner branches don't fork so branch count shouldn't explode, but the wider fork window (tropical tips at depth 5 cross forkThresh faster due to 0.29 falloff vs current 0.25) should be monitored.

---

## FINDING-7: `SpeciesParams` TypeScript interface not mentioned in diff estimate (MINOR)

**Spec's §11 diff estimate** lists `packages/shared/src/index.ts` as "Add 4 fields to 3 species entries" (+12 lines). But the `SpeciesParams` interface at shared/index.ts:394-400 must ALSO be updated to include the 4 new fields:

```typescript
export interface SpeciesParams {
  extensionMultiplier: number;
  forkSpreadMin: number;
  forkSpreadMax: number;
  secondaryForkChance: number;
  trunkMaturationRate: number;
  // NEW — must be added:
  apicalDominance: number;
  depthFalloffBase: number;
  parentExtensionRate: number;
  trunkContinuedRate: number;
}
```

**Impact:** Without the interface update, TypeScript will error when accessing `sp.apicalDominance` in GrowthEngine.ts. The implementer will discover this immediately, so it's not a real risk — just an incomplete spec.

**Recommended resolution:** Add "Update `SpeciesParams` interface with 4 new fields" to §6 Step 1 and §11 diff estimate. Adjust estimate from +12 to +16.

---

## FINDING-8: RNG consumption order on transition tick needs explicit documentation (MINOR)

**Spec claims (§4.6, point 6):** "For inner branches, exactly one rng.next() call is consumed for the inner extension. This is a new consumption — but since inner branches previously consumed zero RNG calls, there is no change to the RNG state of any other branch's seeded sequence."

**Verified:** Each branch creates `new SeededRNG(seed + b.id * 7919 + day * 37)` — a fresh, independent RNG instance per branch per day (GrowthEngine.ts:60). Adding a consumption on branch X's instance has zero effect on branch Y's instance. **Claim is correct.**

**Minor gap:** The spec doesn't discuss the **transition tick** — the tick where a branch goes from tip (0 children) to inner (>0 children, just forked on the previous tick). On tick N-1, branch X was a tip and consumed 1 `rng.next()` for extension. On tick N, branch X is inner and consumes 1 `rng.next()` for inner extension. The fork check RNGs (offset +1, +2, +3) don't fire on tick N because the branch already has children. This is correct but should be stated explicitly to prevent the implementer from accidentally creating an off-by-one where the fork-tick itself double-consumes.

**Recommended resolution:** Add a note to §4.2: "On the tick immediately after forking, a branch transitions from tip to inner. It will consume `rng.next()` for inner extension instead of tip extension. Fork RNGs (offsets +1, +2, +3+i) are NOT consumed since the branch already has children."

---

## FINDING-9: Inner branch RNG base range justified but should document effective magnitude (ADVISORY)

**Spec claims (§4.2, key decision 1):** "Inner extension base range is `(0.8 + rng * 0.4)` not `(1.2 + rng * 2.8)` — inner branches extend more slowly and more uniformly than tips."

**Analysis of effective extension per tick (hardwood, healthy, depth 1):**

| Role | Effective range per tick |
|---|---|
| Leader tip | `[0.864, 2.88] * rate` |
| Inner leader | `[0.115, 0.173] * rate` |
| Inner subordinate | `[0.080, 0.121] * rate` |

Leader tips extend 5-25× faster than inner branches at the same depth. This is a dramatic difference. The spec justifies it ("inner branches extend steadily"), and real trees do exhibit this pattern (internode elongation at tips far exceeds secondary thickening-driven elongation of inner segments).

**Recommended resolution:** Add a table like the above to the spec so the implementer and auditor can verify the magnitudes are intentional, not accidentally too small.

---

## FINDING-10: Thickening pass interaction — Leonardo's Rule correctness preserved (VERIFIED)

**Spec claims (§5, G3 analysis):** "Thickening pass is unchanged. Inner branches extending longer may produce slightly different thickness distributions, but Leonardo's Rule is enforced post-order regardless."

**Verified against code (GrowthEngine.ts:167-194):** Leonardo's Rule operates on `child.thickness`, not on `child.length`. The formula `b.thickness = max(b.thickness, sqrt(sum(child_thickness^2))) + maturation` is unchanged. Inner branches extending longer increases their contribution to voxel count (more length = more voxels), but their thickness is driven by their children's thickness, not their own length.

**Impact on stats:** More inner-branch length → more TRUNK/ARM/LEG voxels → higher hp/power/endurance. This is a stat inflation effect. The spec correctly notes fixture values must be re-recorded (§5, G4/V-suite/D-suite). **Claim is correct.**

---

## FINDING-11: Determinism invariant — independently seeded per-branch RNG (VERIFIED)

**Spec claims (§4.6):** "Same RNG seed pattern... Adding consumption on branch X's RNG doesn't affect branch Y's RNG sequence."

**Verified against code (GrowthEngine.ts:60):** `const rng = new SeededRNG(tree.getSeed() + b.id * 7919 + day * 37)` creates a NEW SeededRNG instance per branch per day. The instance is local — no shared state between branches. A `rng.next()` call on branch 3's RNG cannot affect branch 5's RNG. **Claim is correct.**

**Cross-verified:** The fork RNGs use distinct seeds (offset +1, +2, +3+i at lines 88, 92, 96). These are also independent instances. **No determinism risk from the new inner-extension consumption.**

---

## FINDING-12: G5 max depth ≤ 6 — inner branches don't fork (VERIFIED)

**Spec claims (§5, G5):** "Inner branches don't fork (only tips fork), so no new deeper branches are created."

**Verified against pseudocode (§4.2):** The fork check is inside the `if living.length === 0` block (tip-only path). Inner branches (living.length > 0) never enter the fork check. The depth cap at `b.depth < 6` (GrowthEngine.ts:71) is unchanged and only evaluated for tips. **Claim is correct.**

**Indirect risk (depth falloff change):** Exponential depth falloff at depth 5 differs per species: hardwood 0.19, evergreen 0.15, tropical 0.29. Current linear gives 0.25. For evergreen, tips at depth 5 grow 40% slower under the new model (0.15 vs 0.25), making them LESS likely to hit the fork threshold and create depth-6 branches. For tropical, tips grow 16% faster (0.29 vs 0.25) — marginally more likely to reach depth 6, but still within G5's existing bound. **No G5 breach expected.**

---

## INTENT CHECK (per adversarial-auditor protocol)

```
INTENT CHECK
  spec proposes:   Inner branches extend at reduced rates with apical dominance; exponential depth falloff
  code currently:  Inner branches do NOT extend (living.length === 0 gate); linear depth falloff
  tech spec says:  §4.2 line 249 "tree.length += 0.25 * rate" (trunk always extends); §4.4 R9 TODO exponential
  verdict:         ALIGNED — spec resolves a known code/tech-spec discrepancy and an open research question
```

```
INTENT CHECK
  spec proposes:   Subordinate tips extend at reduced rate (§4.1 table)
  pseudocode shows: All tips extend at same rate (§4.2 pseudocode, no isLeaderChild in tip path)
  verdict:         CONFLICT — §4.1 table contradicts §4.2 pseudocode (FINDING-1)
```

---

## VERDICT: APPROVED WITH CHANGES

The architecture is sound. The apical dominance model is well-grounded in academic literature (Palubicki 2009, Borchert-Honda), the species parameter values are defensible starting points, determinism is preserved, and the implementation is minimally invasive (~80 lines). The cross-reference check is thorough and the gate impact analysis is realistic.

### Changes the implementer MUST incorporate:

1. **FINDING-1 (MAJOR):** Resolve the §4.1 vs §4.2 contradiction for subordinate tips. Either apply `isLeaderChild` in the tip path (recommended) or remove the subordinate-tip row from the §4.1 table. The implementer cannot proceed without knowing which behavior to implement.

2. **FINDING-2 (MAJOR):** Add operational migration documentation. At minimum: note that all existing NFT metadata will change, and include a SQL migration step to re-queue minted tokens for re-rendering. Testnet-only today, but the pattern matters for mainnet.

3. **FINDING-3 (MINOR):** Define the `isLeaderChild` tiebreaker explicitly: "lowest array index wins on equal length."

4. **FINDING-7 (MINOR):** Add `SpeciesParams` interface update to the diff estimate and migration steps.

5. **FINDING-8 (MINOR):** Add a note documenting RNG consumption on the transition tick (tip → inner).

### Changes that are ADVISORY (implementer should consider but not blocking):

6. **FINDING-4:** Monitor evergreen 0.80 apical dominance for visual correctness after implementation.
7. **FINDING-5:** Update tech spec §4.2 to reflect randomized trunk extension range.
8. **FINDING-6:** Playtest tropical depth-6 branch activity (2.2× evergreen) for G6 safety.
9. **FINDING-9:** Add effective extension-per-tick magnitude table to the spec.

---

## DOCUMENTS READ (evidence chain)

| File | Lines read | Purpose |
|---|---|---|
| `STATE.md` | 1-353 | Project state, gate results, fixture values |
| `DECISIONS.md` | 1-231 | Settled decisions, depth falloff (line 16), fork constants (12-15) |
| `docs/KIJO-TECH-SPEC.md` | 210-329 | §4.2 growth algorithm, §4.4 depth falloff, R9 TODO |
| `docs/KIJO-ENGINE-API.md` | 1-434 | Engine API contract, determinism requirements |
| `packages/engine/src/GrowthEngine.ts` | 1-196 | ACTUAL implementation — extendAndFork, thickeningPass, depthFalloff |
| `packages/shared/src/index.ts` | 390-470 | SPECIES_PARAMS (line 402), SpeciesParams interface (394) |
| `packages/engine/test_growth.mjs` | 1-108 | G1-G6 gate tests, assertions, fixture values |
| `packages/engine/src/species.ts` | 1-16 | Legacy species params (forkChance, forkAngle) |
| `docs/DESIGN-SPECIES.md` | 1-80 | Species identity descriptions, combat styles, growth profiles |
| `docs/pipeline/ARCH-NATURAL-GROWTH-MODEL-2026-08-26.md` | 1-408 | THE SPEC BEING REVIEWED |

---

*Critic review complete. Findings above are the input for the implementer. The auditor stage will independently verify the implementation against both this critic document and the (amended) architect spec.*
