# AUDIT-CARELOGREPLAY-WIRE-REMOVE-2026-08-17

**Pipeline stage:** Auditor (adversarial-auditor skill)
**Date:** 2026-08-17
**Subject:** CareLogReplay wire-remove fix gate tests (CLR-WIRE-1 through CLR-WIRE-4)
**Implementer report:** docs/pipeline/IMPL-CARELOGREPLAY-WIRE-REMOVE-2026-08-14.md

---

## VERDICT: VERIFIED

---

## DONE WHEN -- named check and observed result

| Check | Claimed | Observed |
|-------|---------|----------|
| CLR-WIRE-1 | 8 assertions pass | 8 assertions pass (stdout, exit 0) |
| CLR-WIRE-2 | 7 assertions pass | 7 assertions pass (stdout, exit 0) |
| CLR-WIRE-3 | 3 assertions pass | 3 assertions pass (stdout, exit 0) |
| CLR-WIRE-4 | 5 assertions pass | 5 assertions pass (stdout, exit 0) |
| Total | 23 passed, 0 failed | 23 passed, 0 failed, exit 0 -- EXACT MATCH |
| tsc --noEmit | exit 0 | exit 0 -- VERIFIED |

Command run by auditor: `node packages/engine/test_carelogreplay_wire.mjs`
(from repo root /sessions/confident-jolly-euler/mnt/kijo-bonsai)

Full stdout output matched implementer's reported output line-for-line (angle values
42.8635, 58.7858 identical). No discrepancies.

---

## NOTE ON TEST RUNNER DISCREPANCY

The audit prompt specified `npx vitest run packages/engine/src/__tests__/careLogReplay.test.ts`.
That file does not exist. The Kijo engine uses a node-script TAP harness, not vitest.
The actual test file is `packages/engine/test_carelogreplay_wire.mjs`, consistent with
all prior gate tests (test_wire.mjs, test_prune.mjs, etc.).

`npx vitest run packages/engine` fails with "No test suite found" for all 4 engine
test files -- this is a pre-existing condition (these are node scripts, not vitest
suites) and is NOT caused by this change.

The correct gate command (`node packages/engine/test_carelogreplay_wire.mjs`) was run
and observed. This discrepancy does not affect the VERIFIED verdict.

---

## DETERMINISM

```
DETERMINISM: PASS

Command: node packages/engine/test_carelogreplay_wire.mjs (run twice)
diff /tmp/run1.txt /tmp/run2.txt: empty diff
Output: DETERMINISTIC
```

---

## FRAUD CHECKS

### Weakened tests: NONE

Two `assert(true, 'CLR-WIRE-1 setup: found a wirable depth-1 branch at day 50')` and
`assert(true, 'CLR-WIRE-2 setup: found a wirable depth-1 branch at day 50')` calls
exist at test lines 83 and 176. These are trivially-true assertions, but each is
immediately preceded by a `process.exit(1)` hard-fail guard:

```js
if (!b) {
  console.error('FATAL CLR-WIRE-1: no wirable depth-1 branch at day 50 -- cannot proceed');
  process.exit(1);
}
assert(true, 'CLR-WIRE-1 setup: found a wirable depth-1 branch at day 50');
```

The `assert(true, ...)` fires ONLY if `process.exit(1)` was NOT reached. It is a
progress indicator, not a fraud. The real guard is the hard-exit. These 2 assertions
count toward the 23 total and are visible in the actual stdout. Unusual style but not
deceptive.

All other 21 assertions carry meaningful conditions: angle equality within 0.0001,
boolean state (wired, wireSet, bendSet), instanceof checks, and string content checks.

### False completion: NONE

Exit code 0 observed directly. Full stdout matches. No empty test run.

### Intent inversion: NONE

Checked code-spec-gate alignment directly:

```
INTENT CHECK
  code does:     WireEngine.removeWire(tree, a.branchId) in the wire-remove branch
                 of CareLogReplay.reconstruct (lines 122-125). Calls
                 BonsaiTree.removeWire which delegates to WireEngine.removeWire.
                 Spring-back uses round4 at WireEngine.ts lines 149, 151.
  check expects: CLR-WIRE-1: rebuilt angle == postRemoveAngle (partial spring-back,
                   angle 42.8635 reproduced exactly).
                 CLR-WIRE-2: rebuilt angle == wiredAngle (permanent set), wireSet=true,
                   bendSet=true, wired=false.
                 CLR-WIRE-3: unknown type throws CareLogReplayError naming the type.
                 CLR-WIRE-4: orphaned wire-remove is no-op; branch angle unchanged vs
                   reference replay.
  spec says:     CareLogReplay.reconstruct must produce a tree bit-identical to the
                 original. wire-remove entries must be replayed (KIJO-ENGINE-API.md
                 sCareLogReplay; ARCH-CARELOGREPLAY-WIRE-REMOVE-2026-08-14.md sDESIGN).
  verdict:       ALIGNED
```

Existing gate suites (test_wire.mjs, carelog-determinism.test.js, WireEngine.test.js)
all pass with exit 0 -- no regressions introduced.

### Phantom evidence: NONE

Specific values cited in the implementer report verified against actual output:
- `orig=38.79, wired=58.79, post=42.86` -- matches stdout.
- `rebuilt angle (42.8635) === postRemoveAngle (42.8635)` -- matches stdout.
- `rebuilt angle (58.7858) === postRemoveAngle (58.7858)` -- matches stdout.
- `branch 1 angle unchanged (rebuilt=38.7858, ref=38.7858)` -- matches stdout.

---

## MANDATORY CHECKS

### DECISIONS.md updated: N/A

This task was test-only (the CareLogReplay.ts fix was already applied before the
Implementer stage ran -- sequencing anomaly F-1 acknowledged by implementer). No new
architectural decision was made. The wire-remove routing to WireEngine.removeWire is
already documented in DECISIONS.md under the TwineWeightEngine Phase 2 entry (line 202):
"CareLogReplay wired: wire-remove routes to WireEngine.removeWire."
No dedicated R-number was resolved; no new DECISIONS.md entry required.

### STATE.md updated: YES

STATE.md item 18: "COMPLETE (2026-08-14): CareLogReplay wire-remove fix. wire-remove
now calls WireEngine.removeWire() instead of throwing CareLogReplayError.
CLR-WIRE-1/2/3/4 gate tests (23 assertions) pass."

### Import boundaries: CLEAN

careLogReplay.ts imports:
  - '@kijo/shared' (SpeciesClass, CareLogEntry, SPECIES_PARAMS) -- PERMITTED
  - './BonsaiTree.js', './GrowthEngine.js', './PruneEngine.js', './WireEngine.js',
    './errors.js' -- all intra-engine -- PERMITTED
  - No voxelizer imports -- CLEAN
  - No apps/ imports -- CLEAN

WireEngine.ts imports:
  - '@kijo/shared' (round4, CareLogEntry) -- PERMITTED
  - './BonsaiTree.js', './TwineWeightEngine.js' -- intra-engine -- PERMITTED

### round4() discipline: OBSERVED

No new math in careLogReplay.ts (test-only change). The math lives in
WireEngine.removeWire, which uses round4 at lines 149 and 151:
  - `round4(b.wireAngle * springBackFraction)` -- spring-back amount
  - `round4(clamp(b.angle - springBackAmount, POLAR_MIN_DEG, POLAR_MAX_DEG))` -- final angle
Both match DECISIONS.md round4 discipline (every growth math operation that writes
into TreeState is wrapped). CLEAN.

---

## OPEN CAVEATS (from implementer, accepted by auditor)

1. **CLR-WIRE-1 spring-back magnitude not precisely asserted.** Directional spring-back
   is verified; exact fraction (~0.79 for 10/47.18 days) is not. Low risk -- angle
   equality between live and rebuilt tree is verified exactly (0.0001 tolerance).
   The directional check is sufficient for the determinism invariant.

2. **GAP-4 still open.** applyCurrentDayEntries in persistence.ts and derive-stats
   silently skips wire-remove. Not in scope here; tracked as a separate follow-up.

3. **CAVEAT from IMPL report item 3 (b.diameter vs b.thickness):** diameter ~= 2x
   thickness for this species/seed. WireEngine.removeWire uses b.diameter for
   computeSetDays; CLR-WIRE-2 buffer (STRESS_DECAY_MAX_DAYS + 10 = 66 days) was
   set high enough to guarantee permanent set regardless of diameter growth. Accepted.

---

## BOTTOM LINE

All 23 assertions pass with exit 0. Determinism confirmed (two runs, zero diff).
tsc --noEmit exits 0. Import boundaries clean. round4 discipline observed in
WireEngine where the math occurs. No weakened tests, no false completion, no intent
inversion, no phantom evidence. DECISIONS.md and STATE.md correctly reflect the state
of the work.

VERDICT: VERIFIED
