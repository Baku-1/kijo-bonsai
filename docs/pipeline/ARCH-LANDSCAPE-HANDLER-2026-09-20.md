# ARCH: Landscape Handler for CareLogReplay

**Date:** 2026-09-20
**Pipeline stage:** Architect
**Consumed by:** Critic -> Implementer -> Auditor -> Linter
**Builds on:** ARCH-COST-GUARDS-2026-09-19.md, AUDIT-CARE-REPLAY-GAPS-2026-09-18.md, gate-jin-landscape-server-2026-09-18.md (Second Brain decision)

---

## DESIGN TASK

Replace the `CareLogReplayError('landscape is not yet implemented')` throw in `CareLogReplay.ts` (line 148) with a working handler, harden the server-side landscape validator, and re-add `landscape` + `jin` to the server whitelist.

## DELIVERABLE

Architect spec with replay handler design, state storage decision, server whitelist plan, input validation audit, test gate cases, and implementation order.

---

## CODEBASE RECONNAISSANCE

### Files read

| File | Path |
|------|------|
| CareLogReplay.ts | `packages/engine/src/CareLogReplay.ts` (166 lines) |
| BonsaiTree.ts | `packages/engine/src/BonsaiTree.ts` (lines 302-321: addLandscape) |
| shared/index.ts | `packages/shared/src/index.ts` (full file: CareAction, LandscapeElementType, Coordinate, TechniqueResult, TreeState) |
| TechniqueClassifier.ts | `packages/engine/src/TechniqueClassifier.ts` (89 lines) |
| care-action/index.ts | `apps/server/supabase/functions/care-action/index.ts` (327 lines) |
| KIJO-ENGINE-API.md | `docs/KIJO-ENGINE-API.md` (landscape sections via grep) |
| ARCHITECT-CAREACTION-TECHNIQUE-2026-07-30.md | landscape-remove divergence (lines 1004-1012) |
| STATE.md | Project state (full) |
| DECISIONS.md | Decision log (first 100 lines) |
| SESSION-START.md | Boot checklist (full) |
| Second Brain: gate-jin-landscape-server-2026-09-18.md | Server gating decision |
| Second Brain: technique-classification.md | Classifier rules + landscapeCount |

### Symbols verified

```
VERIFIED:
  V BonsaiTree.addLandscape(elementType: LandscapeElementType, position: Coordinate): void
    -- exists BonsaiTree.ts:309, public method, validates position [0,255] per axis
    -- does NOT validate elementType at runtime (TypeScript union only)
    -- calls this._logCare() + this.markDirty()
    -- does NOT modify TreeState.branches or any Branch field

  V CareAction type 'landscape' -- exists shared/index.ts:293
    -- { type: 'landscape'; elementType: LandscapeElementType; position: Coordinate }

  V LandscapeElementType -- exists shared/index.ts:254-257
    -- 'rock' | 'moss' | 'pot'

  V Coordinate -- exists shared/index.ts:344-348
    -- { x: number; y: number; z: number }

  V TechniqueClassifier.classify() -- exists TechniqueClassifier.ts:58
    -- counts 'landscape' entries at line 69: landscapeCount++
    -- reads from careLog parameter, NOT from TreeState

  V SCHEMAS.landscape -- exists care-action/index.ts:124-127
    -- passes elementType and position through WITHOUT validation

  V ALLOWED_ACTION_TYPES -- exists care-action/index.ts:201
    -- Set(['water', 'prune', 'wire', 'wire-remove', 'fertilize', 'rotate',
       'twine', 'twine-remove', 'weight', 'weight-remove'])
    -- 'landscape' and 'jin' are ABSENT (gated)

  V CareLogReplay landscape throw -- exists CareLogReplay.ts:145-150
    -- else if (a.type === 'landscape') { throw CareLogReplayError(...) }

  V TreeState interface -- exists shared/index.ts:224-243
    -- NO landscape storage field. Only branches[], seed, species, day, moisture,
       health, rotation, fertilizerDays, fertilizerCooldown, rngState, lastMainForkLength

  V CareLogReplayError -- imported from errors.js in CareLogReplay.ts:18

  V CONSUMABLE map -- care-action/index.ts:16-20
    -- landscape has no consumable entry (correct: no per-unit cost in Phase 1)
```

### Call sites found

```
addLandscape: 4 call sites
  - BonsaiTree.ts:309           -- definition
  - main3d.ts:1161              -- 3D debug UI: tree.addLandscape(elementType, position)
  - main2d.ts:365               -- 2D debug UI: tree.addLandscape(elementType as LandscapeElementType, {x,y,z})
  - kijo-engine.js:779          -- server esbuild bundle (copy of BonsaiTree)
  - engine.bundle.mjs:765       -- derive-stats bundle (copy of BonsaiTree)

CareLogReplay.reconstruct: call sites NOT enumerated (not changing its signature)

'landscape' in CareAction switch: 1 site
  - TechniqueClassifier.ts:69   -- case 'landscape': landscapeCount++; break;
```

### Data structure usage

```
TreeState: constructed at BonsaiTree constructor (BonsaiTree.ts), serialized nowhere
           currently (SparseVoxelSet handles voxel serialization, TreeState is in-memory).
           No landscape field exists.

CareLogEntry: constructed by _logCare() in BonsaiTree.ts, consumed by CareLogReplay.reconstruct(),
              TechniqueClassifier.classify(), and care-action/index.ts (insert_care_log_entry RPC).
```

### Gaps found

1. **SCHEMAS.landscape (server) passes elementType without validation.** No runtime check that elementType is one of 'rock' | 'moss' | 'pot'. A malicious client could inject any string. Flagged in AUDIT-COST-GUARDS-2026-09-19.md (row 16) and LINT-COST-GUARDS-2026-09-19.md as F-1.

2. **SCHEMAS.landscape (server) passes position without validation.** No integer range check at server layer. BonsaiTree.addLandscape has the guard, but defense-in-depth requires server-side validation too. Flagged in AUDIT-COST-GUARDS-2026-09-19.md line 335.

3. **BonsaiTree.addLandscape does NOT validate elementType at runtime.** TypeScript union is compile-time only. A crafted care log (from DB or network) can contain any string for elementType and it will be logged without rejection.

---

## VERIFICATION LOG

```
VERIFIED:
  V "addLandscape() logs and marks dirty but has NO effect on tree growth,
     branch physics, or stats"
    -- confirmed: BonsaiTree.ts:309-321 calls only _logCare() and markDirty()
    -- no Branch field mutation, no TreeState field mutation beyond care log

  V "TechniqueClassifier counts landscape from care log, not from TreeState"
    -- confirmed: TechniqueClassifier.ts:64-74 iterates careLog parameter
    -- no import of TreeState or BonsaiTree in TechniqueClassifier.ts

  V "landscape-remove does not exist in CareAction union"
    -- confirmed: shared/index.ts CareAction union has no 'landscape-remove' variant
    -- ARCHITECT-CAREACTION-TECHNIQUE-2026-07-30.md lines 1004-1012: explicit Phase 1
       divergence from C++ spec. Landscape elements are permanent in Phase 1.

  V "jin replay handler is already implemented"
    -- confirmed: CareLogReplay.ts:141-144: tree.applyJin(a.branchId, a.segmentIndex, a.jinCost)
    -- JinEngine Phase 2 complete (STATE.md item 26, 46/46 tests pass)

  V "jin is also absent from ALLOWED_ACTION_TYPES"
    -- confirmed: care-action/index.ts:201 does not include 'jin'
    -- gated together with landscape per gate-jin-landscape-server-2026-09-18.md

  V "landscapeCount >= 3 triggers Water-and-Land overlay"
    -- confirmed: TechniqueClassifier.ts:38 LAND_MIN_ELEMENTS = 3
    -- confirmed: technique-classification.md wiki page

  V "Water-and-Land has NO combat archetype"
    -- confirmed: technique-classification.md: "Combat archetype: None."
    -- care-loop display only

  V "landscape has no consumable cost in Phase 1"
    -- confirmed: CONSUMABLE map in care-action/index.ts has no 'landscape' entry
    -- ARCH-SCULPT-UI-2026-08-29.md line 150: "Landscape is premium (no per-unit cost
       in Phase 1 -- addLandscape just logs + markDirty)"

UNVERIFIED:
  ? Whether landscape elements need to be RENDERED (visually placed in the pot).
    -- No rendering code for landscape elements found in main3d.ts or main2d.ts
       (the UI logs the action but does not visualize placed elements).
    -- This is a display concern, not a replay concern. Out of scope for this spec.
```

---

## CROSS-REFERENCE CHECK

```
checked against: KIJO-ENGINE-API.md, technique-classification.md (wiki),
                 ARCHITECT-CAREACTION-TECHNIQUE-2026-07-30.md, DECISIONS.md,
                 ARCH-COST-GUARDS-2026-09-19.md

consistent: YES -- with one known divergence:
  KIJO-ENGINE-API.md has LANDSCAPE_REMOVE + removeLandscape(elementId).
  Phase 1 TS explicitly diverged (documented in ARCHITECT-CAREACTION-TECHNIQUE-2026-07-30.md
  lines 1004-1012). This spec maintains that divergence.

terminology aligned: YES
  -- LandscapeElementType: 'rock' | 'moss' | 'pot' (shared/index.ts)
  -- landscapeCount (TechniqueClassifier + TechniqueResult)
  -- Water-and-Land (TechniqueResult overlay name)

data shapes aligned: YES
  -- CareAction 'landscape' variant matches BonsaiTree.addLandscape signature

boundary violations: NONE
  -- CareLogReplay imports from BonsaiTree (engine-internal), which is allowed
  -- No new cross-package imports needed
```

---

## THE DESIGN

### 1. Replay Handler (CareLogReplay.ts)

Replace the throw at lines 145-150 with a call to `tree.addLandscape()`:

```typescript
// BEFORE (lines 145-150):
} else if (a.type === 'landscape') {
  throw new CareLogReplayError(
    `'landscape' is not yet implemented and cannot be replayed (Phase 2).`
  );
}

// AFTER:
} else if (a.type === 'landscape') {
  tree.addLandscape(a.elementType, a.position);
}
```

**Rationale:** `addLandscape` already does everything needed:
- Validates position bounds (integer, [0,255] per axis) -- throws CareLogReplayError on failure
- Logs the care action via `_logCare()`
- Marks the tree dirty via `markDirty()`
- Has NO effect on tree structure, growth, or stats

This is a 3-line change (remove 3 lines, add 1 line). The pattern mirrors every other handler in CareLogReplay (water calls tree.water, prune calls PruneEngine.prune, jin calls tree.applyJin, etc.).

**Error handling:** `addLandscape` throws `CareLogReplayError` on invalid position. This is already wrapped in the correct error type (unlike `water`, which needed a try/catch re-wrap). No additional error handling needed.

### 2. State Storage Decision: Care-Log-Only (No Change)

**Decision: Do NOT add landscape storage to TreeState.**

Rationale:
- Landscape elements have zero mechanical effect on tree growth, branch physics, or stats
- TechniqueClassifier already counts landscape actions from the care log (not from state)
- The care log is the single source of truth for landscape placement history
- Adding a `landscapeElements: Array<{elementType, position}>` to TreeState would:
  - Change the serialization format (breaking change for any existing serialized state)
  - Add complexity with no mechanical benefit
  - Violate the "smallest change" principle
- Future rendering of landscape elements (placing rocks/moss visually in the pot) can reconstruct positions by scanning the care log -- same pattern TechniqueClassifier uses

**When to revisit:** If landscape-remove ships (Phase 2+), the care log still suffices -- net count = placements minus removals. If landscape elements gain mechanical effects (stat bonuses, growth modifiers), then state storage becomes necessary.

### 3. landscape-remove: Defer (No Change)

**Decision: Do NOT add landscape-remove in this pipeline.**

Rationale:
- Phase 1 divergence from C++ spec is documented and intentional (ARCHITECT-CAREACTION-TECHNIQUE-2026-07-30.md lines 1004-1012)
- No `landscape-remove` variant exists in the CareAction union type
- Adding it requires: new CareAction variant, new BonsaiTree method, CareLogReplay handler, TechniqueClassifier net-count logic, server SCHEMAS entry, and test gates -- a full pipeline of its own
- The exhaustiveness guard in CareLogReplay (line 154) handles unknown action types safely
- Owner has not requested landscape removal

**Cross-engine interop note:** If a C++ care log containing LANDSCAPE_REMOVE entries is ever replayed in TS, the exhaustiveness guard will throw CareLogReplayError. This is the correct behavior -- the TS engine does not support this action type, and silently skipping it would corrupt the landscape count.

### 4. Server Whitelist Re-addition Plan

**Decision: Re-add both `landscape` AND `jin` to ALLOWED_ACTION_TYPES simultaneously.**

Why both together:
- They were gated together (gate-jin-landscape-server-2026-09-18.md decision)
- Jin's replay handler is already implemented and tested (46/46 JIN gates pass)
- Landscape's replay handler is the subject of this pipeline
- The gating decision explicitly says: "Re-add the strings to the Set once Phase 2 engines are built and pass their gate suites"

**Change in care-action/index.ts line 201:**

```typescript
// BEFORE:
const ALLOWED_ACTION_TYPES = new Set([
  'water', 'prune', 'wire', 'wire-remove', 'fertilize', 'rotate',
  'twine', 'twine-remove', 'weight', 'weight-remove'
]);

// AFTER:
const ALLOWED_ACTION_TYPES = new Set([
  'water', 'prune', 'wire', 'wire-remove', 'fertilize', 'rotate',
  'twine', 'twine-remove', 'weight', 'weight-remove',
  'jin', 'landscape'
]);
```

**Deployment note:** This change requires `supabase functions deploy care-action` to go live.

### 5. Input Validation Audit: Three Gaps to Close

#### Gap A: Server SCHEMAS.landscape -- elementType validation (REQUIRED)

The current validator passes `elementType` through without checking it against the allowed values. A malicious client can inject any string (e.g., `"__proto__"`, `"constructor"`, or an arbitrarily long string) as elementType.

**Fix:** Add a runtime allowlist check in SCHEMAS.landscape:

```typescript
const ALLOWED_ELEMENT_TYPES = new Set(['rock', 'moss', 'pot']);

landscape: (d) => {
  const et = d.elementType;
  if (typeof et !== 'string' || !ALLOWED_ELEMENT_TYPES.has(et)) {
    throw new Error(`elementType must be one of: rock, moss, pot (got ${et}).`);
  }
  return {
    elementType: et,
    position: {
      x: requireIntRange(d.position?.x, 0, 255, 'position.x'),
      y: requireIntRange(d.position?.y, 0, 255, 'position.y'),
      z: requireIntRange(d.position?.z, 0, 255, 'position.z'),
    },
  };
},
```

#### Gap B: Server SCHEMAS.landscape -- position validation (REQUIRED)

Position is passed through without validation. Defense-in-depth: the server must not rely solely on BonsaiTree.addLandscape's engine-side guard. The fix above (Gap A) covers this.

#### Gap C: BonsaiTree.addLandscape -- elementType runtime guard (RECOMMENDED)

The engine-side method validates position but not elementType. While TypeScript prevents invalid types at compile time, care log entries from the database are untyped at runtime. A corrupted or malicious care log entry could have any string for elementType.

**Fix:** Add a runtime check in BonsaiTree.addLandscape, before the position check:

```typescript
const VALID_ELEMENT_TYPES: ReadonlySet<string> = new Set(['rock', 'moss', 'pot']);

addLandscape(elementType: LandscapeElementType, position: Coordinate): void {
  if (!VALID_ELEMENT_TYPES.has(elementType)) {
    throw new CareLogReplayError(
      `addLandscape: elementType must be one of: rock, moss, pot (got ${JSON.stringify(elementType)}).`
    );
  }
  // ... existing position validation ...
}
```

**Priority:** Gap A and B are REQUIRED (trust boundary). Gap C is RECOMMENDED (defense-in-depth).

### 6. Test Gate Cases

All tests run via `node packages/engine/test_landscape_replay.mjs` from repo root.

| # | Gate | Test | Expected |
|---|------|------|----------|
| LAND-1 | Basic replay | Reconstruct tree with 1 landscape action (rock at {128,38,128}) on day 10 over 50 days. Verify NO throw, tree.getAge() === 50. | PASS (no CareLogReplayError) |
| LAND-2 | Water-and-Land threshold | Reconstruct with 3 landscape actions (rock day 5, moss day 10, pot day 15) over 50 days. Run TechniqueClassifier.classify(). Verify landscapeCount === 3, overlays includes 'Water-and-Land'. | PASS |
| LAND-3 | Below threshold | Reconstruct with 2 landscape actions over 50 days. TechniqueClassifier.classify(). Verify landscapeCount === 2, overlays does NOT include 'Water-and-Land'. | PASS |
| LAND-4 | Position boundary -- valid edge | addLandscape('rock', {x:0, y:0, z:0}) and addLandscape('moss', {x:255, y:255, z:255}). Both succeed without throw. | PASS |
| LAND-5 | Position boundary -- invalid | addLandscape('rock', {x:-1, y:0, z:0}) throws CareLogReplayError. addLandscape('rock', {x:256, y:0, z:0}) throws. addLandscape('rock', {x:0.5, y:0, z:0}) throws. | PASS (3 assertions) |
| LAND-6 | Determinism | Reconstruct same seed + species + care_log (including landscape) twice. Compare tree.getCareLog() length and final tree.getAge(). Both identical. | PASS |
| LAND-7 | Interleaved actions | Care log: water day 1, landscape day 5, prune day 10, landscape day 15, wire day 20, landscape day 25. Reconstruct over 30 days. No throw. TechniqueClassifier: landscapeCount === 3, wireCount === 1, pruneCount === 1. | PASS |
| LAND-8 | elementType guard (Gap C) | tree.addLandscape('invalid_type' as any, {x:128, y:38, z:128}) throws CareLogReplayError containing 'elementType'. | PASS |
| LAND-9 | Full pipeline round-trip | Reconstruct with landscape actions, voxelize, run StatDeriver. Verify stats are identical to a tree grown without landscape actions (same seed, same non-landscape care log). Landscape has NO stat impact. | PASS |

### 7. Implementation Order

1. **Engine: BonsaiTree.addLandscape elementType guard** (Gap C)
   - Add runtime elementType validation in addLandscape()
   - 3-line change

2. **Engine: CareLogReplay landscape handler** (the core fix)
   - Replace throw with `tree.addLandscape(a.elementType, a.position)`
   - 3-line change (remove 3, add 1)

3. **Test: Write test_landscape_replay.mjs**
   - LAND-1 through LAND-9 (9 gates)
   - Run and verify all pass

4. **Server: Harden SCHEMAS.landscape validator** (Gap A + B)
   - elementType allowlist + position integer range validation
   - ~10-line change in care-action/index.ts

5. **Server: Re-add 'jin' and 'landscape' to ALLOWED_ACTION_TYPES**
   - 1-line change (add to Set constructor)
   - ONLY after gates LAND-1 through LAND-9 pass

6. **Server: Rebuild kijo-engine.js bundle**
   - esbuild must be re-run to include the CareLogReplay fix in the server bundle
   - Affects: `apps/server/supabase/functions/_shared/kijo-engine.js`
   - Also: `apps/server/supabase/functions/derive-stats/engine.bundle.mjs`

7. **Deployment** (separate step, not in this pipeline)
   - `supabase functions deploy care-action`
   - Verify with a test landscape action on Saigon testnet

### 8. Open Questions

| # | Question | Impact | Default |
|---|----------|--------|---------|
| OQ-1 | Should landscape have a consumable cost? Currently free (no CONSUMABLE entry). The KIJO-ENGINE-API.md and ARCH-SCULPT-UI-2026-08-29.md both say "premium" but no per-unit cost mechanism exists. | Low (game balance, not correctness) | Keep free for Phase 1. Add consumable when the fictional Guild seller's shop ships. <!-- Lore terminology revised 2026-09-24; personal name pending. --> |
| OQ-2 | Should landscape elementType be extensible (Phase 2 types: water_feature, figurine, ceramic)? The LandscapeElementType union and the server ALLOWED_ELEMENT_TYPES Set would both need updating. | Low (forward-compat) | Keep 3-literal union per OQ-7 (2026-07-31). Extend when Phase 2 types ship. |
| OQ-3 | Should landscape elements be visually rendered in the pot? Currently the UI logs the action but shows nothing. | Medium (UX) | Out of scope for this pipeline. Rendering is a separate task. |

---

## ASSUMPTIONS

1. **A-1:** No existing care logs in the database contain landscape actions (because the server has been rejecting them since 2026-09-18). If any pre-gating logs exist, they will now replay successfully instead of throwing. This is the correct behavior.

2. **A-2:** The esbuild bundle rebuild step (item 6) is a manual step the implementer knows how to perform. The bundle paths are documented in STATE.md.

3. **A-3:** landscape-remove remains a Phase 2+ feature. If the owner requests it during this pipeline, it becomes a separate architect spec.

---

## Kijo-Specific Checks

- [x] Consistent with GDD (landscape is care-loop display only, no combat archetype)
- [x] Terminology: Water-and-Land (not "water and land" or "Saikei")
- [x] LandscapeElementType: rock, moss, pot (3-literal Phase 1)
- [x] Core invariant preserved: landscape actions are deterministic (same elementType + position -> same care log entry, no RNG, no Date.now())
- [x] No Math.random(), Date.now(), or crypto in any engine path
- [x] round4() not needed (landscape involves no growth math)
- [x] Import boundaries respected: CareLogReplay -> BonsaiTree (engine-internal, allowed)
- [x] DECISIONS.md: no contradictions found
