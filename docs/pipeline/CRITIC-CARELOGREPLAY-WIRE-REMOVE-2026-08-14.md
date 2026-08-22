# CRITIC-CARELOGREPLAY-WIRE-REMOVE-2026-08-14

**Pipeline stage:** Critic (Adversarial Auditor skill)
**Date:** 2026-08-14
**Spec reviewed:** `docs/pipeline/ARCH-CARELOGREPLAY-WIRE-REMOVE-2026-08-14.md`
**Verdict:** PASS WITH CAVEATS

---

## VERDICT: PASS WITH CAVEATS

The spec is architecturally sound. The proposed fix is the correct call with the correct
signature, correct type narrowing, and correct determinism argument. Three caveats follow.
**The implementer is unblocked on test authorship; CareLogReplay.ts itself requires no
further code change.**

---

## ADVERSARIAL AUDIT LOG

### Step 0 — Claims extracted from spec

| # | Claim |
|---|-------|
| C-1 | "CURRENT CODE — THROWS" — `wire-remove` branch currently has a throw |
| C-2 | `WireEngine` is already imported at `CareLogReplay.ts` line 6 |
| C-3 | `WireEngine.removeWire` signature is `(tree, branchId): void` — no `daysElapsed` |
| C-4 | `a.branchId` is type-safe without a cast in the `wire-remove` branch |
| C-5 | Spring-back is fully deterministic at replay time with no external input |
| C-6 | `WireEngine.removeWire` is a no-op for already-unwired / not-found branches |
| C-7 | The exhaustiveness guard (unknown types still throw) is unaffected by the fix |
| C-8 | `test_carelogreplay_wire.mjs` does not yet exist; must be created by implementer |

---

### Step 1 — Direct observation of source files

**CareLogReplay.ts lines 122–125 (read directly):**

```typescript
} else if (a.type === 'wire-remove') {
  // Phase 2: WireEngine.removeWire is fully implemented (gate-verified W1-W6).
  // Time-ratio spring-back; CRITICAL-C at removal time.
  WireEngine.removeWire(tree, a.branchId);
```

**C-1 REFUTED.** The code on disk does NOT throw. The fix is already applied.
The spec's "CURRENT CODE — THROWS" snapshot is stale.

**CareLogReplay.ts line 6 (read directly):**
```typescript
import { WireEngine } from './WireEngine.js';
```
**C-2 VERIFIED.**

**WireEngine.ts line 128 (read directly):**
```typescript
static removeWire(tree: BonsaiTree, branchId: number): void {
```
**C-3 VERIFIED.** No `daysElapsed` parameter. Spring-back computed from
`tree.getAge() - b.wireAppliedDay` and `computeSetDays(b.diameter)` internally.

**shared/src/index.ts line 231 (read directly):**
```typescript
| { type: 'wire-remove'; branchId: number }
```
TypeScript discriminates on `a.type === 'wire-remove'`; `a.branchId` is narrowed
to `number` with no cast.
**C-4 VERIFIED.**

**WireEngine.ts lines 137–151 (read directly):**
All spring-back inputs (`b.wireAppliedDay`, `b.wireAngle`, `b.diameter`,
`tree.getAge()`) live on tree/branch state set by the replay loop before
`removeWire` is called. No external parameter needed.
**C-5 VERIFIED.**

**WireEngine.ts lines 130–133 (read directly):**
```typescript
if (!b) return;
if (b.pruned) return;
if (!b.wired) return;
```
No-op for not-found, pruned, and already-unwired branches.
**C-6 VERIFIED.**

**CareLogReplay.ts lines 151–157 (read directly):**
```typescript
} else {
  const _exhaustive: never = a;
  throw new CareLogReplayError(
    `Unknown CareAction type: '${(_exhaustive as { type: string }).type}'. ...`
  );
}
```
Exhaustiveness guard is intact and untouched by the fix.
**C-7 VERIFIED.**

**`packages/engine/test_carelogreplay_wire.mjs` — file does not exist.**
Glob of `packages/engine/test_*.mjs` returned:
`test_growth`, `test_attachment`, `test_statderiver`, `test_prune`, `test_wire`,
`test_security`, `test_terrain` — no `test_carelogreplay_wire`.
**C-8 VERIFIED.** Gate tests have not been written.

---

### Step 2 — Scope check

Files the spec says MUST NOT change — verified unchanged by reading their active
wire-handling regions:

- `WireEngine.ts` — untouched, signature confirmed
- `shared/src/index.ts` — CareAction union unchanged
- No `persistence.ts` or `derive-stats` changes found

The only file that changed (`CareLogReplay.ts`) matches the exact change the spec
prescribes. Scope is clean.

---

### Step 3 — Four frauds

| Fraud | Status |
|-------|--------|
| Weakened tests | N/A — no test files existed pre-fix; `test_wire.mjs` W1–W6 unmodified |
| False completion | C-1 is a stale claim (spec written before or after code change, unclear), not fraud — the actual code is correct |
| Intent inversion | None — code, spec, and type definitions all agree |
| Phantom evidence | None — all line references checked and resolved correctly |

---

### Step 4 — Intent Gate

```
INTENT CHECK
  code does:     WireEngine.removeWire(tree, a.branchId) in the wire-remove branch of
                 CareLogReplay.reconstruct — computes spring-back, clears wired state,
                 logs the care entry, marks tree dirty.
  check expects: CLR-WIRE-1: rebuilt branch angle equals postRemoveAngle (partial spring-back).
                 CLR-WIRE-2: rebuilt branch angle equals wiredAngle (permanent set).
                 CLR-WIRE-3: unknown action type still throws CareLogReplayError.
                 (Tests not yet written — intent is from spec, not running code.)
  spec says:     CareLogReplay.reconstruct must produce a tree bit-identical to the
                 original. wire-remove entries in the log must be replayed.
                 (KIJO-ENGINE-API.md §CareLogReplay; ARCH spec §DESIGN.)
  verdict:       ALIGNED
```

---

## FINDINGS

### F-1 — PIPELINE SEQUENCING ANOMALY (MUST ACKNOWLEDGE, no code action needed)

**What:** Spec claim C-1 ("CURRENT CODE — THROWS") is false. `CareLogReplay.ts` already
contains `WireEngine.removeWire(tree, a.branchId)` with Phase 2 comments. The code
change the implementer was supposed to make has already been made.

**Where:** `packages/engine/src/CareLogReplay.ts` lines 122–125.

**What the implementer must do:** No code change to `CareLogReplay.ts` is needed.
The implementer must acknowledge the sequencing anomaly (someone applied the fix
before the CRITIC reviewed the spec) and proceed directly to writing the gate tests.
If the project tracks pipeline order, log this as an out-of-order implementation.

---

### F-2 — SPEC BUG IN TEST PSEUDOCODE: `rebuilt` referenced before it exists (MUST FIX)

**What:** In both CLR-WIRE-1 (Revised setup, step 2) and CLR-WIRE-2 (Setup, step 2),
the spec references `rebuilt.getBranches()[b.id].angle` to record `wiredAngle`. At
that point in the setup, `rebuilt` does not exist — it is only created in steps 6–7.
This is a copy-paste error in the spec pseudocode.

**Where:**
- ARCH spec §CLR-WIRE-1, revised setup step 2:
  `Record wiredAngle = rebuilt.getBranches()[b.id].angle`
- ARCH spec §CLR-WIRE-2, setup step 2:
  `Record wiredAngle = rebuilt.getBranches()[b.id].angle`

**What the implementer must do:** Use `tree.getBranches()[b.id].angle` (the live tree,
before replay) or capture from the return value of `tree.wire(b.id, 20)` as
`r.newAngle`. Both are correct. Do NOT reference `rebuilt` in setup steps before it
is constructed.

---

### F-3 — MISSING ADVERSARIAL GATE TEST: orphaned wire-remove (SHOULD ADD)

**What:** CLR-WIRE-1/2/3 do not include a test for a care log that contains a
`wire-remove` entry with no preceding `wire` entry for the same `branchId`. Spec
assumption A3 documents this as a safe no-op (guarded by `if (!b.wired) return`),
but no gate test verifies it.

**Where:** `packages/engine/test_carelogreplay_wire.mjs` (to be created).

**What the implementer must do:** Add CLR-WIRE-4:

```
CLR-WIRE-4 — Orphaned wire-remove is a no-op, does not throw

Setup:
  1. Build careLog with a single wire-remove entry for branchId 1, no prior wire entry.
  2. CareLogReplay.reconstruct(42, 'hardwood', careLog, 1).

Assertions:
  - Does not throw.
  - Branch 1 wired === false (unchanged from initial state).
  - Branch 1 angle unchanged from what growTick would produce without wire.
```

This makes A3 a tested invariant, not just a documented assumption.

---

## CAVEATS THE IMPLEMENTER MUST ADDRESS BEFORE MARKING DONE

1. **F-1**: Acknowledge the sequencing anomaly. No code change to `CareLogReplay.ts`.
2. **F-2**: Fix `rebuilt` reference in CLR-WIRE-1/2 pseudocode when implementing the
   tests. Use `tree.getBranches()[b.id].angle` or `r.newAngle`.
3. **F-3**: Add CLR-WIRE-4 (orphaned wire-remove no-op) to `test_carelogreplay_wire.mjs`.

---

## OPEN QUESTIONS FROM SPEC — STATUS

| OQ | Status |
|----|--------|
| OQ-CLR-1 (test file location) | RESOLVED. Pattern confirmed from test_wire.mjs: `.mjs` at `packages/engine/`, import from `./dist/`. |
| OQ-CLR-2 (GAP-4 — applyCurrentDayEntries) | Confirmed deferred. Out of scope here. Track as follow-up task. |
| OQ-CLR-3 (CLR-WIRE-2 diameter at remove-time) | Valid open question. If `b.diameter` changes between wire and remove, `computeSetDays` at remove-time might differ from the original run. The replay loop uses the same seed + same actions + same growTick sequence, so diameter evolution is deterministic — the comparison WILL be identical. Not a blocking issue, but CLR-WIRE-2 will surface it if there is a bug. |

---

## BOTTOM LINE

The spec is correct; the fix is correct; the fix is already in place in `CareLogReplay.ts`.
The implementer's only remaining work is writing `packages/engine/test_carelogreplay_wire.mjs`
with CLR-WIRE-1 through CLR-WIRE-3 (per spec) plus CLR-WIRE-4 (per F-3), fixing the
`rebuilt` reference error in the test setup (F-2).

---

*Sources verified by direct file read: `packages/engine/src/CareLogReplay.ts` (all 165 lines),
`packages/engine/src/WireEngine.ts` (all 167 lines), `packages/shared/src/index.ts` (lines 218–258),
`packages/engine/test_wire.mjs` (lines 1–80), glob of `packages/engine/test_*.mjs`.*
