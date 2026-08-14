# CRITIC -- TwineWeightEngine Corrective Architect Patch
**Date:** 2026-08-14
**Reviews:** ARCH-TWINEWEIGHT-PATCH-2026-08-14.md
**Original findings doc:** CRITIC-TWINEWEIGHT-ENGINE-2026-08-14.md
**Pipeline:** Architect --> Critic --> Corrective Architect --> **Critic (patch review)** --> Implementer --> Auditor --> Linter
**Skill:** adversarial-auditor (loaded before all file reads)

---

## VERDICT: PASS WITH CAVEATS

Both blockers are genuinely resolved. Both HIGH findings are resolved. Four caveats
for the implementer follow -- none rises to BLOCKER level, but two will cause gate test
failures if ignored.

---

## SOURCES READ (direct observation only)

```
SESSION-START.md
STATE.md
docs/pipeline/CRITIC-TWINEWEIGHT-ENGINE-2026-08-14.md    -- original findings
docs/pipeline/ARCH-TWINEWEIGHT-PATCH-2026-08-14.md       -- patch under review
docs/pipeline/ARCH-TWINEWEIGHT-ENGINE-2026-08-14.md      -- original spec
packages/engine/src/TwineWeightEngine.ts                 -- stubs + constants (actual code)
packages/engine/src/BonsaiTree.ts (lines 200-300)        -- applyWeight guard, prune()
packages/engine/src/PruneEngine.ts                       -- prune return type + depth guard
packages/shared/src/index.ts (lines 1-220)               -- Branch interface, CareActions
packages/engine/test_prune.mjs                           -- gate test pattern reference
```

---

## CLAIM INVENTORY

The patch claims to resolve:

```
BLOCKER-1 (TWE6)   -- test calls wrong interface (BonsaiTree throws; test expects return)
BLOCKER-2 (TWE1)   -- TWE1 assertion 2 contradictory trunk-prune setup
HIGH-1             -- twineAngle JSDoc implies immutable original delta; field is mutable
HIGH-2 / OQ-3      -- spring-back model unconfirmed; OQ-3 marked ADVISORY
LOW-1              -- TWE2 assertion 3 missing b.angle > 33.73 deg precondition
LOW-2              -- TWE3/TWE9 degradeDays forcing mechanism unspecified
LOW-3              -- TWE5 incompatible with shared 30-day preamble
LOW-4 / OQ-5       -- already-weighted replace semantics unconfirmed
```

---

## BLOCKER-1 VERIFICATION (TWE6)

**Critic finding:** `tree.applyWeight(id, 0)` and `tree.applyWeight(id, 5)` throw
`CareLogReplayError` at the BonsaiTree layer (lines 232-236 of BonsaiTree.ts) before
`TwineWeightEngine.applyWeight` is reached. Test asserting a return value would crash.

**Patch resolution:** Call `TwineWeightEngine.applyWeight` directly for assertions 3
and 4 (and all 4, per the corrected code block).

**Observed in actual TwineWeightEngine.ts (lines 160-170):**
```typescript
static applyWeight(tree: BonsaiTree, branchId: number, weightCount: number): WeightResult {
  const b = branches[branchId];
  if (!b) return { ok: false, reason: 'not-found' };         // guard 1
  if (b.pruned) return { ok: false, reason: 'pruned' };      // guard 2
  if (weightCount < 1 || weightCount > 4)
    return { ok: false, reason: 'weight-cap-exceeded' };      // guard 3  <-- fires for 0 and 5
  // ...
  throw new CareLogReplayError('Phase 1 stub');               // only reached for valid (1-4)
}
```

Guard 3 fires for `weightCount=0` (0 < 1) and `weightCount=5` (5 > 4) and RETURNS
before the throw. The patch's direct-engine-call approach is correct and will pass
with the current Phase 1 stub.

**RESOLUTION CONFIRMED: YES**

**NEW FINDING -- TWE6 branch aliasing (CAVEAT-1, see below).**

---

## BLOCKER-2 VERIFICATION (TWE1)

**Critic finding:** Assertion 2 opened with `tree.applyTwine(0, 10)` after `tree.prune(0)`
then immediately noted trunk cannot be pruned. Implementer following it literally would
get `'not-found'` not `'pruned'`.

**Patch resolution:** Corrected assertion 2 uses:
```javascript
const pruneable = tree.getBranches().find(b => !b.pruned && b.depth >= 1);
assert(pruneable !== undefined, 'found pruneable non-trunk branch');
const pruned = tree.prune(pruneable.id);
assert(pruned === true, 'prune succeeded');
const r = tree.applyTwine(pruneable.id, 10);
assert(r.ok === false && r.reason === 'pruned', ...);
```

**Verified in BonsaiTree.ts (line 292-294):**
```typescript
prune(branchId: number): boolean {
  return PruneEngine.prune(this, branchId);
}
```

**Verified in PruneEngine.ts (lines 29-58):**
- Returns `false` for trunk (depth === 0 guard, line 38)
- Returns `false` for already-pruned branch (line 41)
- Returns `true` after marking branch + descendants pruned (line 49+)

`tree.prune(N)` exists, returns boolean, and behaves exactly as the corrected
assertion expects. A 30-day tree from seed 464497 has depth-1 branches (confirmed
by V3 gate in STATE.md: branch id=1 depth=1 prunable at day 50; at day 30
growth is well underway).

The `assert(pruneable !== undefined, ...)` guard ensures a clear failure rather
than a silent wrong-reason pass if the tree lacks depth-1 branches.

**RESOLUTION CONFIRMED: YES**

---

## HIGH-1 VERIFICATION (twineAngle JSDoc)

**Critic finding:** twineAngle JSDoc says "applied by the twine action" (implies
original immutable delta) but processTwineDegrade decrements it toward 0 (remaining
bend accumulator). Mid-degrade readers get wrong values.

**Patch resolution (Option B):** New JSDoc for both shared/index.ts and
TwineWeightEngine.ts. No new Branch field.

**Observed in patch's proposed JSDoc (shared/index.ts replacement):**

"Current remaining twine bend angle (degrees, signed). At applyTwine time: set to
the applied delta. During natural degradation (processTwineDegrade): decremented by
SPRING_RATE (1 deg/day) toward 0. Represents REMAINING bend, not original applied
delta. [...] The original applied delta is the authoritative historical record stored
in the care log entry (type: 'twine', angleDelta). Do not use this field as the
original delta for any computation that runs after processTwineDegrade has fired."

**Assessment:** Unambiguous. Three-state lifecycle is explicitly documented (apply
time, mid-degrade, cleared). The note that spring-back in removeTwine is CORRECT
to use twineAngle (it IS remaining bend at removal time) pre-empts the natural
question. No new confusion introduced.

The additional TwineWeightEngine.ts JSDoc note is consistent and additive.

**RESOLUTION CONFIRMED: YES**

---

## HIGH-2 VERIFICATION (spring-back model, OQ-3)

**Critic finding:** OQ-3 marked ADVISORY; implementer could proceed without Jeremy's
sign-off. If Jeremy later chose a different model, removeTwine/removeWeight would
require a full rewrite.

**Patch resolution:** OQ-3 is now RESOLVED. Jeremy confirmed 2026-08-14:
`springBack = bendAngle x max(0, 1 - daysElapsed/setDays)`, immediate application,
applies to wire (gate-verified), twine (Phase 2), and weight (Phase 2 Tier A).

**Verified against ARCH doc pseudocode (removeTwine):**
```typescript
const springBackFraction = Math.max(0, Math.min(1, 1 - twineDaysApplied / setDays));
const springBackAmount = round4(b.twineAngle * springBackFraction);
b.angle = round4(clamp(b.angle - springBackAmount, POLAR_MIN_DEG, KENGAI_POLAR_MAX));
```
Matches confirmed formula exactly. `daysElapsed = twineDaysApplied`. ✓

**Verified against ARCH doc pseudocode (removeWeight Tier A):**
```typescript
const springBackFraction = Math.max(0, Math.min(1, 1 - weightDaysApplied / setDays));
const springBackAmount = round4(b.weightAngleDelta * springBackFraction);
b.angle = round4(clamp(b.angle - springBackAmount, POLAR_MIN_DEG, KENGAI_POLAR_MAX));
```
Same formula. `b.weightAngleDelta` is the NEW FIELD (OQ-1 resolved as Option A). ✓

**`computeSetDays(b.diameter)` at removal time:** `computeSetDays` exported from
TwineWeightEngine.ts (line 90-96). `b.diameter` on Branch interface (shared/index.ts
line 31). GrowthEngine.thickeningPass updates diameter every tick. Current at removal.
Both confirmed. ✓

**"Snap is immediate":** Pseudocode applies spring-back within the single removal
function call; no per-tick spreading. Confirmed by patch: "Applied IMMEDIATELY on
removal (same turn as the removal call, no per-tick interpolation)." ✓

**OQ-1 resolution as Option A:** Patch confirms `weightAppliedDay` and `weightAngleDelta`
are approved. DECISIONS.md entries prepared for implementer to append. removeWeight
pseudocode references both fields correctly. ✓

**RESOLUTION CONFIRMED: YES**

---

## LOW-1 VERIFICATION (TWE2 assertion 3 polar clamp)

**Critic finding:** Without `b.angle > 33.73 deg` precondition, a branch with
b.angle <= 33.73 deg would produce applied delta smaller than -28 deg (polar floor
fires first) and the assertion fails.

**Patch resolution:** Corrected assertion 3 finds a branch with `b.angle > 33.73`
and adds an else fallback.

**Observed else fallback:**
```javascript
} else {
  // No branch over 33.73 at day 30 for this seed; apply a positive twine first to
  // raise angle, then remove and re-apply negative.
  assert(true, 'no high-angle branch available -- see LOW-1 advisory');
}
```

**Assessment:** The fix is partially correct. The precondition is correctly specified.
BUT the else branch is `assert(true, ...)` -- a trivially-passing no-op. The comment
describes an approach ("apply a positive twine first to raise angle, then remove and
re-apply negative") but that code is NOT implemented. If no branch with angle > 33.73
exists at day 30, the test always passes without verifying the clamping behavior.

**CAVEAT-2 (see below).**

The precondition itself is correct. For seed 464497 hardwood at day 30, this is
unlikely to fail (the growth engine generates branches at various angles), but the
else path is a silent skip, not a safe fallback.

**RESOLUTION: PARTIAL** -- precondition correct; else path is a test weakness.

---

## LOW-2 VERIFICATION (TWE3 assertion 4 / TWE9 assertion 1)

**Critic finding:** TWE3 doesn't specify how to verify determinism. TWE9 treats
degradeDays=10 as a known RNG constant.

**Patch resolution for TWE3 assertion 4:** Apply live, read degradeDays from
log, replay via CareLogReplay.reconstruct, assert replayed entry has same
degradeDays. No need to predict RNG output. ✓

**Patch resolution for TWE9 assertion 1:** `tree.applyTwine(branch.id, 24, 10)`
forces degradeDays=10 via the `storedDegradeDays` parameter. Bypasses RNG entirely.
Matches the Phase 2 applyTwine signature (`storedDegradeDays?: number`). ✓

**Note on stub compatibility:** Both approaches require Phase 2 applyTwine
implementation (current stub throws before reaching any of this logic). These are
gate tests for Phase 2 -- they are not expected to run against the Phase 1 stub.
The test design is correct for the post-implementation world.

**RESOLUTION CONFIRMED: YES** (for Phase 2 context)

---

## LOW-3 VERIFICATION (TWE5 preamble isolation)

**Critic finding:** Shared 30-day preamble makes TWE5 impossible (requires twine
at day 20).

**Patch resolution:** Fresh BonsaiTree per test. Preamble note added:
"Each gate test (TWE1-TWE9) constructs its own BonsaiTree instance."

**Observed in corrected TWE5:**
```javascript
const tree = new BonsaiTree(seed, species);
for (let i = 0; i < 20; i++) GrowthEngine.growTick(tree);
// tree is now at day 20 -- apply twine here
```

Explicit, concrete, unambiguous. Tree is at the correct day before any action. ✓

The preamble note in the corrected preamble section is also correct:
"Tests with specific day-timing requirements [...] must grow a FRESH tree to the
exact day required by that test."

**RESOLUTION CONFIRMED: YES**

---

## LOW-4 VERIFICATION (OQ-5 replace semantics)

**Critic finding:** Replace semantics for already-weighted branch is unconfirmed.
If stacking or rejection is intended, this is a breaking difference.

**Patch resolution:** Retain "replace" as default. Implementer instructed to flag
OQ-5 in report. If Jeremy changes to "reject" or "stack", paths are described.

**Observed implementer instruction in patch:**
"Implement 'replace' semantics as specified in the ARCH doc. Flag in your implementer
report that OQ-5 is unconfirmed. If Jeremy confirms 'reject', add an already-weighted
guard before the weighted=true assignment and a new entry to WeightRejectReason.
If Jeremy confirms 'stack', additional Branch field discussion is required."

**Assessment:** The risk is correctly documented and the implementer has clear
contingency paths. The "replace" semantics are conservative and safe. OQ-5 is still
unconfirmed, but this is flagged explicitly as a caveat in the patch.

**RESOLUTION: ADEQUATELY DOCUMENTED** (unconfirmed; flagged correctly)

---

## NEW FINDINGS (issues introduced or unresolved by the patch)

### CAVEAT-1 -- TWE6 branch aliasing: assertions 3 and 4 will test pruned-branch rejection, not weight-cap-exceeded

**Severity:** WILL CAUSE GATE TEST FAILURE if tree has only one non-pruned depth-1
branch (unlikely for seed 464497 at day 30, but not guaranteed; more importantly,
the code is silently wrong regardless).

**Root cause:** In the corrected TWE6 block:

```javascript
const validBranch = tree.getBranches().find(b => !b.pruned && b.depth >= 1);
...
const pruneable = tree.getBranches().find(b => !b.pruned && b.depth >= 1);
tree.prune(pruneable.id);
...
const r3 = TwineWeightEngine.applyWeight(tree, validBranch.id, 0);
```

`validBranch` and `pruneable` are found by IDENTICAL predicates from the same
array before any pruning occurs. `Array.find` returns the first matching element.
Therefore `validBranch.id === pruneable.id` in all cases where only one depth-1
non-pruned branch exists -- AND even when multiple exist, both will point to the
same (first) matching branch unless the search for pruneable explicitly excludes
validBranch's id.

After `tree.prune(pruneable.id)`, the branch at `validBranch.id` has `pruned = true`.

When assertions 3 and 4 call `TwineWeightEngine.applyWeight(tree, validBranch.id, 0)`:

```typescript
const b = branches[validBranch.id]; // b exists
if (!b) ...                          // false
if (b.pruned) return { ok: false, reason: 'pruned' };  // TRUE -- returns here
if (weightCount < 1 || weightCount > 4) ...             // NEVER REACHED
```

Assertions 3 and 4 get `{ ok: false, reason: 'pruned' }` not `'weight-cap-exceeded'`.
Both assertions fail.

**Required fix for implementer:** Find a fresh non-pruned branch for assertions 3-4.
Either search AFTER pruning (ensuring `!b.pruned` finds a different branch), or
verify `validBranch.id !== pruneable.id` before proceeding:

```javascript
// After assertion 1 and before assertion 2:
const pruneable = tree.getBranches().find(b => !b.pruned && b.depth >= 1);
tree.prune(pruneable.id);
const r2 = TwineWeightEngine.applyWeight(tree, pruneable.id, 2);
assert(r2.ok === false && r2.reason === 'pruned', ...);

// For assertions 3-4: find a FRESH non-pruned branch (NOT the one just pruned)
const capBranch = tree.getBranches().find(b => !b.pruned && b.depth >= 1);
assert(capBranch !== undefined, 'found non-pruned branch for cap tests');
const r3 = TwineWeightEngine.applyWeight(tree, capBranch.id, 0);
const r4 = TwineWeightEngine.applyWeight(tree, capBranch.id, 5);
```

---

### CAVEAT-2 -- TWE2 assertion 3 else-path tests nothing

**Severity:** SILENT SKIP (always passes, never verifies).

The else path in corrected TWE2 assertion 3:
```javascript
assert(true, 'no high-angle branch available -- see LOW-1 advisory');
```

Always increments `passed`. If no branch with angle > 33.73 deg exists at day 30,
the clamping-to-28-degrees behavior is never verified. The comment describes an
approach (apply positive twine first, remove, re-apply negative) but the code
to implement it is absent.

**Required fix for implementer:** The else path should be implemented, not
`assert(true, ...)`. The simplest approach: grow an additional 30 days
(`growTree(464497, 'hardwood', 60)`) and re-search; branches will have had more
time to develop angular variety. If still not found, use two successive applyTwine
calls (one to raise angle, one to test clamping after removeTwine).

Alternatively, use a seed or tree configuration known to produce a high-angle
branch and document the specific fixture.

---

### CAVEAT-3 -- OQ-5 (replace semantics) remains unconfirmed by Jeremy

The patch explicitly acknowledges this. The implementer is told to flag it in
their report. This is correctly handled as a known open item, not a blocker.

---

### CAVEAT-4 -- TWE6 comment/code mismatch in assertion 1

In corrected TWE6, assertion 1 comment says:
"not-found (via BonsaiTree -- valid input, guard fires in TwineWeightEngine)"

But the code is:
```javascript
const r1 = TwineWeightEngine.applyWeight(tree, 99999, 2);
```

This IS a direct engine call (not via BonsaiTree), contradicting the comment.
The code is CORRECT (branchId=99999 returns `not-found` from TwineWeightEngine
before the throw). The comment is misleading.

Implementer: keep the code, ignore the comment, or correct the comment to
"direct engine call, branchId=99999 returns not-found before throw."

---

## INTENT CHECK

```
INTENT CHECK -- BLOCKER-1 (TWE6 assertions 3 and 4)
  code does:     TwineWeightEngine.applyWeight returns { ok: false, reason: 'weight-cap-exceeded' }
                 for weightCount outside [1,4], before reaching the Phase 1 throw.
  test expects:  { ok: false, reason: 'weight-cap-exceeded' } for count=0 and count=5
  spec says:     Engine should validate and return this reason for out-of-range counts
  verdict:       ALIGNED (with CAVEAT-1: aliasing means validBranch.id may be pruned
                 by assertion 2, causing assertion 3-4 to hit the 'pruned' guard first)

INTENT CHECK -- BLOCKER-2 (TWE1 assertion 2)
  code does:     PruneEngine.prune returns true for non-trunk (depth >= 1) non-pruned branch
  test expects:  pruned === true, then applyTwine returns { ok: false, reason: 'pruned' }
  spec says:     pruned branches cannot be twined; return 'pruned' reason
  verdict:       ALIGNED

INTENT CHECK -- HIGH-1 (twineAngle JSDoc)
  code does:     (per spec) processTwineDegrade decrements b.twineAngle toward 0
  JSDoc says:    (original) "applied by the twine action" (implies immutable)
  patch says:    "remaining bend accumulator, decremented by SPRING_RATE each day"
  verdict:       ALIGNED post-patch

INTENT CHECK -- HIGH-2 (spring-back formula)
  code does:     (ARCH doc removeTwine/removeWeight pseudocode) time-ratio spring-back,
                 immediate application
  spec says:     springBack = bendAngle x max(0, 1 - daysElapsed/setDays), immediate
  Jeremy confirms: 2026-08-14, same formula and semantics
  verdict:       ALIGNED
```

---

## SCOPE

Patch is a documentation-only + test-spec-correction document. No source code is
changed by the patch itself -- all changes are implemented by the implementer.

Scope claims verified:
- No new source files proposed by the patch itself
- Corrected gate test specs cover: TWE1, TWE2, TWE3, TWE5, TWE6, TWE9
- TWE4, TWE7, TWE8, TWE3 assertions 1-3, TWE9 assertions 2-4 explicitly unchanged
- DECISIONS.md entries deferred to implementer stage (correct)
- OQ-1 resolved as Option A: implementer adds weightAppliedDay + weightAngleDelta to
  shared/index.ts Branch interface. This is a @kijo/shared change; importers
  downstream (voxelizer, web app, StatDeriver) must recompile but require no logic
  changes (new fields initialize to 0, non-breaking addition).

---

## FRAUDS HUNTED

```
weakened tests:   NONE introduced in the physics or replay logic. CAVEAT-1 (aliasing)
                  is a test-implementation bug, not a deliberate weakening.
                  CAVEAT-2 (assert(true)) is a stub fallback, not a weakened assertion.

false completion: NONE -- patch explicitly states OQ-5 is still open and requires
                  implementer flagging. No false "all resolved" claim.

intent inversion: NONE -- the spring-back model (time-ratio) is confirmed correct by
                  BonsaiTree.ts comments (lines 81-87) and WireEngine gate-verified
                  behavior. The stress-ratio model in the stub comment is correctly
                  abandoned; the CRITICAL-C fix is internally consistent.

phantom evidence: NONE -- BonsaiTree.ts line references (226-237 for applyWeight
                  guard; 292-294 for prune delegation) match what I read in the
                  actual file. test_wire.mjs W6 direct-engine-call pattern confirmed
                  (WireEngine.wireCostFor() called directly). All citations match
                  observed code.
```

---

## BOTTOM LINE

Both blockers are genuinely resolved. The patch fixes the BonsaiTree-vs-engine
interface mismatch (BLOCKER-1) and the contradictory trunk-prune setup (BLOCKER-2)
at the spec level. HIGH-1 and HIGH-2 are adequately resolved. The patch is safe to
hand to the implementer with the following mandatory notes:

**Implementer MUST fix before considering TWE6 green:**
- CAVEAT-1: Refind a non-pruned branch for assertions 3 and 4 (after pruning
  for assertion 2). The current code aliases validBranch === pruneable and will
  test 'pruned' reason instead of 'weight-cap-exceeded'.

**Implementer SHOULD fix before marking gate green:**
- CAVEAT-2: Implement the described else-path in TWE2 assertion 3 (apply positive
  twine to raise angle, then test negative clamping). Do not leave assert(true).

**Implementer must confirm with Jeremy before finalizing:**
- CAVEAT-3: OQ-5 (replace/stack/reject for already-weighted branch). Flag in
  implementer report.
