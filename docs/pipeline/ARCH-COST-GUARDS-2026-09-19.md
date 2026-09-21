# Architect Spec: Cost & Consumable Parameter Validation Guard Sweep
**Date:** 2026-09-19
**Author:** Verified Architect pass — follows skill protocol exactly
**Status:** DESIGN — for implementer use
**Scope:** Input validation guards on ALL public numeric parameters. Single-concern: guards only.
**Security context:** Web3 project with real currency. Unguarded parameters are exploit vectors. Bad data in care_log corrupts on-chain state tied to real asset value.

---

## SCOPE

```
DESIGN TASK:  Add input validation guards to every public numeric parameter
              across all engine entry points AND server-side care-action Edge
              Function. Follows the canonical jinCost guard pattern.

DELIVERABLE:  This spec document. Catalogs every parameter, current guard
              status, recommended fix, and test gate cases.

BUILDS ON:    packages/engine/src/BonsaiTree.ts (applyJin canonical pattern)
              packages/engine/src/WireEngine.ts
              packages/engine/src/PruneEngine.ts
              packages/engine/src/TwineWeightEngine.ts
              packages/engine/src/JinEngine.ts
              packages/engine/src/CareLogReplay.ts
              apps/server/supabase/functions/care-action/index.ts

CONSUMED BY:  Implementer building the guards.
              After: update test suite, run auditor.

NOT IN SCOPE: New features, refactors, game logic changes, performance work.
              ONLY input validation guards.
```

---

## SECURITY FRAMING

This is a **security audit**, not a quality improvement. Kijo is a Web3 project where:

1. **care_log is the sole authoritative state** (KIJO-ARCHITECTURE.md §1). seed + care_log = tree = NFT = real asset value.
2. **CareLogReplay reconstructs from care_log** for NFT verification. Bad data in DB is a time bomb that detonates at verification time.
3. **The care-action Edge Function is the trust boundary** where untrusted client input enters the system. It currently has ZERO field-level validation.
4. A malicious client can POST `{ type: "wire", branchId: "hello", angleDelta: Infinity }` and it goes straight to the DB via `insert_care_log_entry`.

### Trusted Developer Security Patterns (from Second Brain wiki)

**truongnguyenptn Pre-Deployment Checklist** (`wiki/patterns/truongnguyenptn/ronin-security.md`):
> "Input validation on all external functions" — listed as a mandatory pre-deployment check for any Ronin/EVM contract. The care-action Edge Function is our equivalent of an external contract function.

**dwi GiftingContract Guards** (`wiki/patterns/dwi/gifting-guards.md`):
> Every public function that touches state goes through validation first. The `validGift` modifier pattern — validate before ANY state mutation — is the standard dwi follows on Ronin. Our `insert_care_log_entry` RPC call mutates state with zero prior validation.

**dwi updateController Triple-Check** (`wiki/patterns/dwi/gifting-guards.md`):
> Three-layer validation (code-length + ERC-165 interface + zero-address) before updating a critical reference. Belt-and-suspenders. Our branchId parameters have ZERO layers.

**Proof of Play Token Guards** (`wiki/patterns/proof-of-play/token-guards.md`):
> Every transfer, every ownership check, every balance check goes through explicit guards. PoP validates ALL parameters including log-only ones (per `wiki/lessons/compare-jinengine-phase2-2026-09-18.md` GAP-1).

**SageStarCodes Guard Patterns** (`wiki/patterns/SageStarCodes/guards-and-checks.md`):
> Mode-based parameter validation with type checking and descriptive error messages for every input.

**Core principle from all trusted sources:** Validate at the boundary. Never trust caller-provided data. Every public function guards every parameter.

---

## VERIFICATION LOG

```
VERIFIED:
  V BonsaiTree.ts water(amount) L144-159: guarded (!isFinite + <= 0).
    Source: read packages/engine/src/BonsaiTree.ts L144-159.

  V BonsaiTree.ts wire(branchId, angleDelta) L173-175: NO guards.
    Raw delegation to WireEngine.wire(). branchId and angleDelta unchecked.
    Source: read packages/engine/src/BonsaiTree.ts L173-175.

  V BonsaiTree.ts removeWire(branchId) L193-195: NO guards.
    Raw delegation to WireEngine.removeWire().
    Source: read packages/engine/src/BonsaiTree.ts L193-195.

  V BonsaiTree.ts applyTwine(branchId, angleDelta, storedDegradeDays?) L203-209:
    PARTIAL — angleDelta has isFinite check at L204. branchId has NO type/integer
    check. storedDegradeDays has NO validation at all.
    Source: read packages/engine/src/BonsaiTree.ts L203-209.

  V BonsaiTree.ts removeTwine(branchId) L217-219: NO guards.
    Source: read packages/engine/src/BonsaiTree.ts L217-219.

  V BonsaiTree.ts applyWeight(branchId, weightCount) L226-238: PARTIAL —
    weightCount fully guarded (isFinite + isInteger + range 1-4). branchId
    has NO type/integer check.
    Source: read packages/engine/src/BonsaiTree.ts L226-238.

  V BonsaiTree.ts removeWeight(branchId) L245-247: NO guards.
    Source: read packages/engine/src/BonsaiTree.ts L245-247.

  V BonsaiTree.ts applyJin(branchId, segmentIndex, jinCost) L254-266:
    ALL THREE params fully guarded with canonical pattern.
    Source: read packages/engine/src/BonsaiTree.ts L254-266.

  V BonsaiTree.ts addLandscape(elementType, position) L275-287:
    position guarded (integer + [0,255]). elementType NOT validated.
    Source: read packages/engine/src/BonsaiTree.ts L275-287.

  V BonsaiTree.ts prune(branchId) L292: NO type guard at BonsaiTree level.
    Source: read packages/engine/src/BonsaiTree.ts L292.

  V WireEngine.ts wire() L66-105: branches[branchId] array access — string/NaN
    branchId produces undefined (caught by !b check L69). BUT angleDelta goes
    through clamp() which passes NaN through silently (Math.min/max with NaN → NaN).
    NaN angleDelta propagates → stored as NaN angle on branch → CORRUPTS TREE STATE.
    Source: read packages/engine/src/WireEngine.ts L66-105.

  V PruneEngine.ts prune() L29-64: Has range check branchId < 0 || >= length (L33).
    Does NOT check non-integer (1.5 passes, indexes as undefined). NaN fails both
    comparisons → passes through → branches[NaN] = undefined → no depth/pruned check
    → returns false. Accidentally safe but NOT explicitly guarded.
    Source: read packages/engine/src/PruneEngine.ts L29-64.

  V TwineWeightEngine.ts applyTwine() L130-194: !b check only for branchId.
    angleDelta clamped (NaN passes through). storedDegradeDays used directly at L154
    with NO validation — a NaN or negative value corrupts degradation timing.
    Source: read packages/engine/src/TwineWeightEngine.ts L130-194.

  V TwineWeightEngine.ts applyWeight() L268-316: Comment at L276-278 explicitly
    states "BonsaiTree.applyWeight validates !isFinite and !isInteger before calling
    here. The engine assumes valid inputs." — confirms two-layer strategy.
    Source: read packages/engine/src/TwineWeightEngine.ts L268-316.

  V care-action/index.ts: ZERO field-level validation. L174 destructures action,
    L181-186 passes raw actionData to insert_care_log_entry RPC. A malicious client
    can inject NaN, Infinity, strings, negative values, or entirely fabricated fields.
    Source: read apps/server/supabase/functions/care-action/index.ts.

  V CareLogReplay.ts: CRITICAL FINDING — three action types bypass BonsaiTree:
    - L119: PruneEngine.prune(tree, a.branchId) — direct static call
    - L121: WireEngine.wire(tree, a.branchId, a.angleDelta) — direct static call
    - L125: WireEngine.removeWire(tree, a.branchId) — direct static call
    All other types go through tree.applyXxx() and hit BonsaiTree guards.
    This means guards added ONLY to BonsaiTree.wire/removeWire/prune will NOT
    protect the replay path. Guards must go in the engine static methods too,
    or CareLogReplay must be updated to route through BonsaiTree.
    Source: read packages/engine/src/CareLogReplay.ts L101-158.

ASSUMED:
  ~ addLandscape elementType validation may not be needed if TypeScript union
    prevents invalid values at compile time. Verify at implementation time.
```

---

## CRITICAL FINDING: CareLogReplay Bypass

CareLogReplay.ts routes three action types directly to static engine methods, bypassing BonsaiTree:

| Action Type | CareLogReplay Route | BonsaiTree Guards Applied? |
|---|---|---|
| `prune` | `PruneEngine.prune(tree, a.branchId)` | **NO** — bypassed |
| `wire` | `WireEngine.wire(tree, a.branchId, a.angleDelta)` | **NO** — bypassed |
| `wire-remove` | `WireEngine.removeWire(tree, a.branchId)` | **NO** — bypassed |
| `twine` | `tree.applyTwine(...)` | Yes |
| `twine-remove` | `tree.removeTwine(...)` | Yes |
| `weight` | `tree.applyWeight(...)` | Yes |
| `weight-remove` | `tree.removeWeight(...)` | Yes |
| `jin` | `tree.applyJin(...)` | Yes |
| `water` | `tree.water(...)` | Yes |

**Recommendation:** The implementer MUST choose one of:
1. **Option A (preferred):** Add guards to the static engine methods (WireEngine.wire, WireEngine.removeWire, PruneEngine.prune) so both call paths are protected.
2. **Option B:** Change CareLogReplay to route through BonsaiTree methods instead of calling engines directly.

Option A is preferred because it follows the defense-in-depth principle (dwi triple-check pattern) — guard at every layer, not just one.

---

## CANONICAL GUARD PATTERN

From `BonsaiTree.applyJin` L260-264 (the gold standard in this codebase):

```typescript
if (!Number.isFinite(jinCost) || jinCost < 1 || !Number.isInteger(jinCost)) {
  throw new CareLogReplayError(
    `applyJin: jinCost must be a positive integer (got ${jinCost}).`
  );
}
```

**Pattern components:**
1. `!Number.isFinite(x)` — catches NaN, Infinity, -Infinity, non-number types
2. `x < bound` — catches out-of-range (bound varies: 0 for branchId, 1 for costs)
3. `!Number.isInteger(x)` — catches fractional values
4. `throw CareLogReplayError(descriptive message)` — structured error with value echo

**For branchId parameters specifically:**
```typescript
if (!Number.isFinite(branchId) || branchId < 0 || !Number.isInteger(branchId)) {
  throw new CareLogReplayError(
    `methodName: branchId must be a non-negative integer (got ${branchId}).`
  );
}
```

**For optional parameters (storedDegradeDays):**
```typescript
if (storedDegradeDays !== undefined) {
  if (!Number.isFinite(storedDegradeDays) || storedDegradeDays < 0 || !Number.isInteger(storedDegradeDays)) {
    throw new CareLogReplayError(
      `applyTwine: storedDegradeDays must be a non-negative integer (got ${storedDegradeDays}).`
    );
  }
}
```

---

## COMPLETE PARAMETER CATALOG

### Layer 1: Engine Entry Points (BonsaiTree.ts)

| # | Entry Point | Parameter | Type | Current Guard | Status | Fix |
|---|---|---|---|---|---|---|
| 1 | `water(amount)` | amount | number | `!isFinite \|\| <= 0` | GUARDED | None |
| 2 | `wire(branchId, angleDelta)` | branchId | number | NONE | **VULNERABLE** | Add canonical guard (>= 0, integer) |
| 3 | `wire(branchId, angleDelta)` | angleDelta | number | NONE | **VULNERABLE** | Add isFinite guard |
| 4 | `removeWire(branchId)` | branchId | number | NONE | **VULNERABLE** | Add canonical guard (>= 0, integer) |
| 5 | `applyTwine(branchId, angleDelta, storedDegradeDays?)` | branchId | number | NONE | **VULNERABLE** | Add canonical guard (>= 0, integer) |
| 6 | `applyTwine(...)` | angleDelta | number | `!isFinite` at L204 | GUARDED | None |
| 7 | `applyTwine(...)` | storedDegradeDays | number? | NONE | **VULNERABLE** | Add optional canonical guard (>= 0, integer) |
| 8 | `removeTwine(branchId)` | branchId | number | NONE | **VULNERABLE** | Add canonical guard (>= 0, integer) |
| 9 | `applyWeight(branchId, weightCount)` | branchId | number | NONE | **VULNERABLE** | Add canonical guard (>= 0, integer) |
| 10 | `applyWeight(...)` | weightCount | number | `isFinite + isInteger + 1-4` | GUARDED | None |
| 11 | `removeWeight(branchId)` | branchId | number | NONE | **VULNERABLE** | Add canonical guard (>= 0, integer) |
| 12 | `applyJin(branchId, segmentIndex, jinCost)` | branchId | number | `isFinite + >= 0 + isInteger` | GUARDED | None |
| 13 | `applyJin(...)` | segmentIndex | number | `isFinite + >= 0 + isInteger` | GUARDED | None |
| 14 | `applyJin(...)` | jinCost | number | `isFinite + >= 1 + isInteger` | GUARDED | None |
| 15 | `addLandscape(elementType, position)` | position | Coordinate | `isInteger + [0,255]` | GUARDED | None |
| 16 | `addLandscape(elementType, position)` | elementType | string | NONE | **ASSESS** | See note below |
| 17 | `prune(branchId)` | branchId | number | NONE at BonsaiTree | **VULNERABLE** | Add canonical guard (>= 0, integer) |

**Note on #16 (elementType):** If TypeScript enforces the union type at compile time AND the server-side whitelist prevents invalid types from entering the DB, runtime validation may be unnecessary. The implementer should assess whether a runtime check adds value given the existing type system. This is lower priority than the numeric parameter guards.

### Layer 1b: Static Engine Methods (replay path protection)

These need guards because CareLogReplay bypasses BonsaiTree for prune/wire/wire-remove:

| # | Engine Method | Parameter | Current Guard | Fix |
|---|---|---|---|---|
| 18 | `WireEngine.wire(tree, branchId, angleDelta)` | branchId | Implicit `!b` only | Add canonical guard before `!b` check |
| 19 | `WireEngine.wire(...)` | angleDelta | NONE (NaN passes through clamp) | Add isFinite guard |
| 20 | `WireEngine.removeWire(tree, branchId)` | branchId | Implicit `!b` only | Add canonical guard |
| 21 | `PruneEngine.prune(tree, branchId)` | branchId | Range check only (no integer) | Add isInteger guard |

### Layer 2: Server-Side (care-action Edge Function)

**Current state:** ZERO field-level validation. `actionData` passes raw to DB.

**Recommended per-type validation schemas:**

```typescript
// Validation schemas for each action type's actionData fields.
// Applied BEFORE insert_care_log_entry — at the trust boundary.

const SCHEMAS: Record<string, (data: Record<string, unknown>) => void> = {
  water:          (d) => { requirePositiveFinite(d.amount, 'amount'); },
  prune:          (d) => { requireNonNegInt(d.branchId, 'branchId'); },
  wire:           (d) => { requireNonNegInt(d.branchId, 'branchId');
                           requireFinite(d.angleDelta, 'angleDelta'); },
  'wire-remove':  (d) => { requireNonNegInt(d.branchId, 'branchId'); },
  twine:          (d) => { requireNonNegInt(d.branchId, 'branchId');
                           requireFinite(d.angleDelta, 'angleDelta');
                           if (d.degradeDays !== undefined)
                             requireNonNegInt(d.degradeDays, 'degradeDays'); },
  'twine-remove': (d) => { requireNonNegInt(d.branchId, 'branchId'); },
  weight:         (d) => { requireNonNegInt(d.branchId, 'branchId');
                           requireIntRange(d.weightCount, 1, 4, 'weightCount'); },
  'weight-remove':(d) => { requireNonNegInt(d.branchId, 'branchId'); },
  jin:            (d) => { requireNonNegInt(d.branchId, 'branchId');
                           requireNonNegInt(d.segmentIndex, 'segmentIndex');
                           requirePositiveInt(d.jinCost, 'jinCost'); },
  fertilize:      (_) => { /* no numeric fields */ },
  rotate:         (_) => { /* no numeric fields */ },
};

// Helper signatures (implementer writes these):
// requireFinite(val, name)          — !Number.isFinite → 400
// requireNonNegInt(val, name)       — !isFinite || < 0 || !isInteger → 400
// requirePositiveFinite(val, name)  — !isFinite || <= 0 → 400
// requirePositiveInt(val, name)     — !isFinite || < 1 || !isInteger → 400
// requireIntRange(val, lo, hi, name)— !isFinite || < lo || > hi || !isInteger → 400
```

**Insertion point:** Between L100 (ALLOWED_ACTION_TYPES check) and L106 (lazy tick), add:

```typescript
// -- Field-level validation (trust boundary) --
const validator = SCHEMAS[actionType];
if (validator) {
  try { validator(actionData); }
  catch (e) { return json({ error: (e as Error).message }, 400); }
}
```

**Why before lazy tick:** Reject bad input before any DB mutation. CEI ordering (truongnguyenptn pattern): Checks first, Effects (tick/insert) second, Interactions (consumable decrement) last.

### Layer 2 Gap Summary

| Field | Affected Action Types | Current Validation | Risk |
|---|---|---|---|
| branchId | wire, wire-remove, prune, twine, twine-remove, weight, weight-remove, jin | NONE | NaN/string/float stored in DB → replay corruption |
| angleDelta | wire, twine | NONE | NaN/Infinity stored → NaN propagation in angles |
| amount | water | NONE | NaN/Infinity/negative stored → impossible moisture |
| weightCount | weight | NONE | Fractional/negative stored → impossible weight state |
| segmentIndex | jin | NONE | Negative/float stored → impossible jin |
| jinCost | jin | NONE | Zero/negative/float stored → free jin exploit |
| degradeDays | twine | NONE | NaN/negative stored → broken degradation timing |

**Every single numeric field is currently writable with arbitrary values from any HTTP client.** This is the highest-priority fix in this spec.

---

## TEST GATE CASES

Each guard must have corresponding test cases. Format: `GUARD-N: description`.

### Engine-side guards (BonsaiTree + static engines)

| Gate | Method | Input | Expected |
|---|---|---|---|
| GUARD-1 | `wire(NaN, 0)` | branchId = NaN | throw CareLogReplayError |
| GUARD-2 | `wire(1.5, 0)` | branchId = 1.5 | throw CareLogReplayError |
| GUARD-3 | `wire(-1, 0)` | branchId = -1 | throw CareLogReplayError |
| GUARD-4 | `wire("abc" as any, 0)` | branchId = string | throw CareLogReplayError |
| GUARD-5 | `wire(0, NaN)` | angleDelta = NaN | throw CareLogReplayError |
| GUARD-6 | `wire(0, Infinity)` | angleDelta = Infinity | throw CareLogReplayError |
| GUARD-7 | `removeWire(NaN)` | branchId = NaN | throw CareLogReplayError |
| GUARD-8 | `removeWire(-1)` | branchId = -1 | throw CareLogReplayError |
| GUARD-9 | `applyTwine(NaN, 5)` | branchId = NaN | throw CareLogReplayError |
| GUARD-10 | `applyTwine(0, 5, -1)` | storedDegradeDays = -1 | throw CareLogReplayError |
| GUARD-11 | `applyTwine(0, 5, 1.5)` | storedDegradeDays = 1.5 | throw CareLogReplayError |
| GUARD-12 | `applyTwine(0, 5, NaN)` | storedDegradeDays = NaN | throw CareLogReplayError |
| GUARD-13 | `removeTwine(NaN)` | branchId = NaN | throw CareLogReplayError |
| GUARD-14 | `applyWeight(NaN, 1)` | branchId = NaN | throw CareLogReplayError |
| GUARD-15 | `applyWeight(-1, 1)` | branchId = -1 | throw CareLogReplayError |
| GUARD-16 | `removeWeight(NaN)` | branchId = NaN | throw CareLogReplayError |
| GUARD-17 | `prune(NaN)` | branchId = NaN | throw CareLogReplayError |
| GUARD-18 | `prune(1.5)` | branchId = 1.5 | throw CareLogReplayError |
| GUARD-19 | `prune(-1)` | branchId = -1 | throw CareLogReplayError |

### Engine-side guards (static methods — replay path)

| Gate | Method | Input | Expected |
|---|---|---|---|
| GUARD-20 | `WireEngine.wire(tree, NaN, 0)` | branchId = NaN | throw CareLogReplayError |
| GUARD-21 | `WireEngine.wire(tree, 0, NaN)` | angleDelta = NaN | throw CareLogReplayError |
| GUARD-22 | `WireEngine.removeWire(tree, NaN)` | branchId = NaN | throw CareLogReplayError |
| GUARD-23 | `PruneEngine.prune(tree, 1.5)` | branchId = 1.5 | throw CareLogReplayError |
| GUARD-24 | `PruneEngine.prune(tree, NaN)` | branchId = NaN | throw CareLogReplayError |

### Server-side guards (care-action Edge Function)

| Gate | Payload | Expected |
|---|---|---|
| GUARD-S1 | `{ type: "water", amount: NaN }` | 400 + error message |
| GUARD-S2 | `{ type: "water", amount: -5 }` | 400 |
| GUARD-S3 | `{ type: "water", amount: "hello" }` | 400 |
| GUARD-S4 | `{ type: "wire", branchId: "abc", angleDelta: 10 }` | 400 |
| GUARD-S5 | `{ type: "wire", branchId: 0, angleDelta: Infinity }` | 400 |
| GUARD-S6 | `{ type: "prune", branchId: -1 }` | 400 |
| GUARD-S7 | `{ type: "weight", branchId: 0, weightCount: 0 }` | 400 |
| GUARD-S8 | `{ type: "weight", branchId: 0, weightCount: 5 }` | 400 |
| GUARD-S9 | `{ type: "jin", branchId: 0, segmentIndex: -1, jinCost: 1 }` | 400 |
| GUARD-S10 | `{ type: "jin", branchId: 0, segmentIndex: 0, jinCost: 0 }` | 400 |
| GUARD-S11 | `{ type: "twine", branchId: 0, angleDelta: 5, degradeDays: -1 }` | 400 |
| GUARD-S12 | `{ type: "wire", branchId: 1.5, angleDelta: 10 }` | 400 |
| GUARD-S13 | Extra fields: `{ type: "water", amount: 5, exploit: "payload" }` | Assess: strip or reject unknown fields |

---

## IMPLEMENTATION ORDER (for implementer)

1. **Server-side first** (care-action/index.ts) — this is the trust boundary. Blocks bad data from entering DB immediately. Highest security impact.
2. **BonsaiTree guards** — all branchId parameters that currently lack guards. Standard canonical pattern.
3. **Static engine method guards** (WireEngine.wire, WireEngine.removeWire, PruneEngine.prune) — defense-in-depth for replay path.
4. **applyTwine storedDegradeDays** — optional parameter guard.
5. **Test suite** — GUARD-1 through GUARD-S13.

---

## DECISION RECORD

```
DECISION: ARCH-COST-GUARDS-2026-09-19
DATE:     2026-09-19
CONTEXT:  Web3 project with real currency. care_log is sole authoritative state.
          CareLogReplay reconstructs trees for NFT verification. Server Edge
          Function accepts raw unvalidated user input and writes to DB.

DECISION: Add validation guards to ALL public numeric parameters at both layers
          (engine + server). Follow canonical jinCost pattern. Guards go in static
          engine methods too (not just BonsaiTree) because CareLogReplay bypasses
          BonsaiTree for prune/wire/wire-remove.

PATTERN:  !Number.isFinite(x) || x < bound || !Number.isInteger(x)
          → throw CareLogReplayError(descriptive message with value echo)

RATIONALE:
  - truongnguyenptn: "Input validation on all external functions" (pre-deploy)
  - dwi: validGift modifier — validate before ANY state mutation
  - PoP: validate ALL parameters including log-only ones (GAP-1 lesson)
  - Defense-in-depth: guard at every layer, not just one boundary

TRADE-OFFS:
  + Prevents DB corruption from malicious clients (security)
  + Prevents NaN propagation through clamp/round4 (correctness)
  + Catches bugs earlier with descriptive errors (debuggability)
  - Small runtime cost per call (negligible — integer/finite checks are O(1))
  - Guard duplication between layers (intentional — defense-in-depth)
```

---

## FILES TO MODIFY (implementer reference)

| File | Changes |
|---|---|
| `apps/server/supabase/functions/care-action/index.ts` | Add per-type validation schemas between L100 and L106 |
| `packages/engine/src/BonsaiTree.ts` | Add branchId guards to wire, removeWire, removeTwine, applyWeight (branchId only), removeWeight, prune. Add storedDegradeDays guard to applyTwine |
| `packages/engine/src/WireEngine.ts` | Add branchId + angleDelta guards to wire(). Add branchId guard to removeWire() |
| `packages/engine/src/PruneEngine.ts` | Add isInteger guard to prune() (has range check, missing integer check) |
| `packages/engine/src/BonsaiTree.test.ts` (or equivalent) | GUARD-1 through GUARD-24 |
| `apps/server/supabase/functions/care-action/index.test.ts` (or equivalent) | GUARD-S1 through GUARD-S13 |
| `DECISIONS.md` | Append decision record above |
