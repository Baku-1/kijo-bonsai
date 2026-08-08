# AUDIT-WIREANGLE-CASCADE-2026-08-07

**Auditor:** Adversarial Auditor (Claude agent, adversarial-auditor skill)  
**Date:** 2026-08-07  
**Subject:** WireEngine Cascade fix — POLAR_MAX_DEG + cascadeGate implementation  
**Governing invariant:** Every claim is a hypothesis until directly observed. No trust is extended to completion reports.

---

## VERDICT: VERIFIED

All 11 falsifiable claims observed true. No frauds found. All 8 tests pass with exit code 0. Intent is aligned across code, tests, and spec.

---

## CLAIMS CHECKED

| # | Claim | Status | Observed |
|---|-------|--------|----------|
| 1 | `POLAR_MAX_DEG === 150` in WireEngine.ts | ✓ VERIFIED | `const POLAR_MAX_DEG = 150;` at line 34 |
| 2 | `wireCount` increment is BEFORE cascadeGate check | ✓ VERIFIED | line 79 increments; line 81 reads — confirmed ordering |
| 3 | Gate threshold is 120° (`HAN_KENGAI_GATE_DEG`) | ✓ VERIFIED | `const HAN_KENGAI_GATE_DEG = 120;` at line 80 |
| 4 | Voxelizer clamp uses `150 * Math.PI / 180` (not 1.4) | ✓ VERIFIED | `Math.min(150 * Math.PI / 180, ...)` at index.ts:221 |
| 5 | `Branch.wireCount?: number` in shared/src/index.ts | ✓ VERIFIED | `wireCount?: number;` at line 150 of shared/src/index.ts |
| 6 | `TechniqueResult.wireCount` is separate and unchanged | ✓ VERIFIED | Required `wireCount: number` at line 245; separate type, no conflict |
| 7 | All 8 engine tests pass | ✓ VERIFIED | TAP output: `pass 8 / fail 0`; exit code 0 (directly run) |
| 8 | `TwineWeightEngine.KENGAI_POLAR_MAX === 150` | ✓ VERIFIED | `export const KENGAI_POLAR_MAX = 150;` at TwineWeightEngine.ts:28 |
| 9 | CareLogReplay calls `WireEngine.wire()` (not inline) | ✓ VERIFIED | CareLogReplay.ts line 121: `WireEngine.wire(tree, a.branchId, a.angleDelta)` |
| 10 | `removeWire` uses named constants (not hardcoded 1.4) | ✓ VERIFIED | WireEngine.ts line 149: `clamp(…, POLAR_MIN_DEG, POLAR_MAX_DEG)` |
| 11 | Arch doc at both `kijo-bonsai/docs/pipeline/` and `kijo/docs/pipeline/` | ✓ VERIFIED | Both paths confirmed by filesystem glob |

---

## INTENT CHECK

```
INTENT CHECK — cascadeGate logic
  code does:     wireCount incremented on line 79 (pre-gate); gate reads post-increment
                 value: wireCount >= 3 → cascadeGate = 150; else cascadeGate = 120
  check expects: wire 1 → 120°, wire 2 → 120°, wire 3 → 135° (>120°, ≤150°), wire 4+ → 150°
  spec says:     "wireCount < 3 → max 120°; wireCount ≥ 3 → max 150°;
                  3rd wire application itself opens Cascade" (owner directive 2026-08-07)
  verdict:       ALIGNED

INTENT CHECK — voxelizer polar ceiling
  code does:     Math.min(150 * Math.PI / 180, ...) at index.ts:221 — ceiling = 2.6180 rad = 150°
  check expects: (no voxelizer-specific test, but clamp value directly readable in source)
  spec says:     KENGAI_POLAR_MAX = 150° (TwineWeightEngine.ts:28); WireEngine POLAR_MAX_DEG = 150
  verdict:       ALIGNED

INTENT CHECK — Branch.wireCount vs TechniqueResult.wireCount
  code does:     Branch.wireCount?: number (per-branch, optional); TechniqueResult.wireCount: number
                 (tree-level, required, counts total wire CareLog entries)
  check expects: no test conflates them; WireEngine.wire() reads b.wireCount; TechniqueClassifier
                 reads log entries for its wireCount
  spec says:     "Branch.wireCount is per-branch (optional, defaults to 0 via ?? 0).
                  TechniqueResult.wireCount is tree-level. Must NOT be conflated."
  verdict:       ALIGNED
```

---

## SCOPE

No stale `1.4` literals found in `packages/engine/src/` or `packages/voxelizer/src/` (grep confirmed). The three named-constant references (`POLAR_MIN_DEG`, `POLAR_MAX_DEG`) in `removeWire` spring-back path all use the named constants — no hardcoded radians anywhere.

---

## FRAUDS HUNTED

**Weakened tests:** None. The three new cascade gate tests (`WireEngine.test.js`) carry tight `assert.equal` assertions at specific angle values (120, 135, 150). No `skip`, `todo`, `only`, or loosened bounds were found. Test assertions were not changed to match broken code.

**False completion:** None. Tests were run directly (`node --test test/*.test.js`). TAP output observed line-by-line. Exit code 0 confirmed. "All pass" in report matches reality.

**Intent inversion:** None. The gate increments wireCount BEFORE the gate check (line 79 → 81). The 3rd wire's post-increment wireCount is 3, which satisfies `>= 3`, opening the gate on that same application. This matches the owner directive exactly.

**Phantom evidence:** None. Every cited line number was read and matched the reported content:
- `TwineWeightEngine.ts:28` → `KENGAI_POLAR_MAX = 150` ✓
- `WireEngine.ts:34` → `POLAR_MAX_DEG = 150` ✓
- `shared/src/index.ts:150` → `wireCount?: number` ✓
- `CareLogReplay.ts:121` → `WireEngine.wire(tree, a.branchId, a.angleDelta)` ✓

---

## MINOR FINDING (not a bug — CAVEAT)

**Line 82 of WireEngine.ts uses a redundant `Math.sign/Math.abs` pattern:**

```typescript
const clampedAngle = round4(
  Math.sign(newAngle) * Math.max(POLAR_MIN_DEG, Math.min(cascadeGate, Math.abs(newAngle)))
);
```

Since `newAngle` is always in `[POLAR_MIN_DEG, POLAR_MAX_DEG]` = `[5.7296, 150]` (enforced by the `clamp()` on line 75), it is always positive. `Math.sign(newAngle)` is always 1, `Math.abs(newAngle)` is always `newAngle`. The expression is logically equivalent to:

```typescript
const clampedAngle = round4(Math.max(POLAR_MIN_DEG, Math.min(cascadeGate, newAngle)));
```

This is **not a bug** — the output is identical. It appears to be a defensive pattern left from an earlier design where negative angles were possible. Recommend simplifying in a follow-up cleanup pass to reduce cognitive overhead. **Does not affect test results or correctness.**

---

## KIJO-SPECIFIC CHECKS

| Check | Result |
|-------|--------|
| Determinism (seed+log → identical tree) | ✓ Covered by `determinism.test.js`, which passes (test 4 of 8) |
| round4 discipline in wire path | ✓ Applied on delta (line 74), newAngle (line 75), springBackAmount (line 147), clampedAngle (line 82), appliedDelta (line 83), spring-back result (line 149) |
| Import boundaries (engine→shared only) | ✓ WireEngine imports from `@kijo/shared` only |
| CareLogReplay uses WireEngine.wire() | ✓ Direct delegation at CareLogReplay.ts:121 |
| KENGAI_POLAR_MAX matches POLAR_MAX_DEG | ✓ Both are 150° |
| No stale 1.4 radians anywhere | ✓ grep found zero matches in both packages |

---

## TEST RUN (direct observation)

```
TAP version 13
ok 1 - wireCount < 3 → angle capped at 120° when delta would exceed it
ok 2 - 3rd wire application opens Cascade gate (wireCount incremented before gate check)
ok 3 - branch CAN reach 150° with sufficient wire applications (Cascade achievable)
ok 4 - same seed + species + care log ⇒ identical tree (core invariant)
ok 5 - different seeds diverge
ok 6 - tree grows branches over 150 days
ok 7 - prune is permanent and cascades to descendants
ok 8 - drought stress degrades health
1..8
# tests 8  # pass 8  # fail 0  # duration_ms 977.9411
```

---

## BOTTOM LINE

The WireEngine Cascade fix is fully implemented and correct. All 8 tests pass (directly observed, exit code 0). The gate logic, constant values, voxelizer clamp, shared interface field, and replay path all match the owner directive and design invariants. The one minor finding (redundant Math.sign/Math.abs on line 82) is style noise, not a defect.
