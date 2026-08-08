# Corrective Implementer Report — CareAction + TechniqueClassifier
**Date:** 2026-08-07
**Author:** Corrective implementer pass — follows disciplined-implementer skill protocol exactly
**Auditing:** AUDIT-IMPL-CAREACTION-TECHNIQUE-2026-07-31.md
**Status:** DONE

---

## OUTCOME

**DONE.** All seven done-when criteria observed (not assumed). All three previously-failing gate suites now exit 0. One undocumented decision added to DECISIONS.md. Two Carmack-Linus findings applied to production files. tsc exits 0 for shared and engine.

---

## DONE WHEN — named checks and observed results

| # | Named check | Observed result |
|---|-------------|-----------------|
| 1 | `node packages/engine/test_wire.mjs` exits 0 — 20/20 | **EXIT 0 — 20 passed, 0 failed** |
| 2 | `node packages/engine/test_statderiver.mjs` exits 0 | **EXIT 0 — 35 passed, 0 failed (D1–D7)** |
| 3 | `node packages/engine/test_prune.mjs` exits 0 | **EXIT 0 — 17 passed, 0 failed** |
| 4 | W6: two-tier contract (thin=1, mid=thick=2) passes with correct assertion | **`thickB === mid` (2 === 2) — assertion is `===`, not `>` or `>=`** |
| 5 | `TechniqueClassifier.classify(careLog)` returns correct `TechniqueResult` per spec | **5/5 inline checks pass — see VERIFIED BY OBSERVATION** |
| 6 | `DECISIONS.md` updated with zone implementation, seed%7, OQ-1 wire depth removal | **All three entries present under 2026-07-31 — OQ-1 entry added this session** |
| 7 | All new/changed files verified with `wc -l` and `tail -5` | **Observed — see VERIFIED BY OBSERVATION** |

---

## WHAT CHANGED

This corrective pass found that the two prior sessions had already landed most of the required work by 2026-08-07. The corrective pass's actual delta is:

### Files modified this session

| File | Change | Why |
|------|--------|-----|
| `DECISIONS.md` | Added OQ-1 wire depth gate removal entry under 2026-07-31 | Audit required fix #7; done-when #6: OQ-1 was implemented (W1/W2 pass, `'not-depth-1'` absent from WireRejectReason) but undocumented |
| `packages/engine/src/WireEngine.ts` | Removed dead `Math.sign(newAngle) * Math.abs(newAngle)` wrapper (Carmack C-1 fix) | `newAngle` is always positive (clamped to `[POLAR_MIN_DEG=5.73, POLAR_MAX_DEG=150]`); `Math.sign/Math.abs` are no-ops that mislead future readers into thinking negative angles are possible |
| `packages/shared/src/index.ts` | Added `⚠️ ALWAYS read as (b.wireCount ?? 0)` guard comment on `wireCount?` field | Linus L-1 finding: optional field creates silent NaN hazard for any future reader who omits `?? 0`; comment documents the required read convention until the field becomes required |

### What was already in place (prior sessions — verified this session, not re-implemented)

| Item | File | Verification method |
|------|------|---------------------|
| `test_statderiver.mjs` destructures `{voxels, zones}` from `Voxelizer.voxelize()` | `test_statderiver.mjs` | `node packages/engine/test_statderiver.mjs` → EXIT 0 |
| `test_prune.mjs` calls `.count()` on `result.voxels` | `test_prune.mjs` | `node packages/engine/test_prune.mjs` → EXIT 0 |
| `test_wire.mjs` W5: destructures `{voxels}` from `Voxelizer.voxelize()` | `test_wire.mjs` line 128/130 | `node packages/engine/test_wire.mjs` → EXIT 0, W5 ✓ |
| W6: `thickB === mid` with two-tier design comment | `test_wire.mjs` lines 154–155 | Assertion visible in source; output shows `(2 === 2)` |
| `TechniqueClassifier.ts` — full correct implementation | `packages/engine/src/TechniqueClassifier.ts` | 5-case smoke test, all assertions pass, EXIT 0 |
| `TechniqueResult` in `packages/shared/src/index.ts` | `packages/shared/src/index.ts` lines 233–258 | `tsc --noEmit` exits 0; TechniqueClassifier imports and uses it correctly |
| `LandscapeElementType`, full CareAction union w/ new variants | `packages/shared/src/index.ts` | `tsc --noEmit` exits 0 |
| `VoxelRole.SCAR` comment corrected ("NOT a prune byproduct") | `packages/shared/src/index.ts` line 304 | Read from file directly |
| `WireRejectReason` has no `'not-depth-1'` | `packages/engine/src/WireEngine.ts` line 36 | Read from file directly: `'not-found' \| 'pruned' \| 'too-thick'` |
| Depth gate (`b.depth !== 1`) absent from `WireEngine.wire()` | `packages/engine/src/WireEngine.ts` | W1 (trunk wires) and W2 (depth-2+ wires) pass; gate absent by inspection |
| `DECISIONS.md` zone entry (ZONE_WAVELENGTH=32, float-space rationale) | `DECISIONS.md` line 150 | Read from file, entry dated 2026-07-31 |
| `DECISIONS.md` seed%7 entry | `DECISIONS.md` line 152 | Read from file, entry dated 2026-07-31 |
| `DECISIONS.md` water amount fix entry | `DECISIONS.md` line 154 | Read from file, entry dated 2026-07-31 |

---

## VERIFIED BY OBSERVATION

### Gate suites

```
node packages/engine/test_wire.mjs
  → 20 passed, 0 failed — EXIT 0

node packages/engine/test_statderiver.mjs
  → D1–D7 result: 35 passed, 0 failed — EXIT 0

node packages/engine/test_prune.mjs
  → 17 passed, 0 failed — EXIT 0
```

### W6 two-tier contract (observed output)

```
W6 — Wire cost tiers
  ✓ thin (1.0) costs 1 (1)
  ✓ mid (2.0) costs 2 (2)
  ✓ thick (3.0) also costs 2 — two tiers only (2)
  ✓ mid and thick share tier-2 cost — monotone confirmed (2 === 2)
```
Assertion is `thickB === mid` (exact equality), not `>` or `>=`. The comment in the test explains the two-tier design rationale. No weakening.

### TechniqueClassifier smoke test (observed output)

```
T1 (empty): {"primary":"Bound-and-Cut","overlays":[],"wireCount":0,"pruneCount":0,"jinCount":0,"landscapeCount":0,"treeAgeDays":100}
T2 (clip-and-grow): {"primary":"Clip-and-Grow","overlays":[],"wireCount":0,"pruneCount":2,"jinCount":0,"landscapeCount":0,"treeAgeDays":30}
T3 (wire disqualifies): {"primary":"Bound-and-Cut","overlays":[],"wireCount":1,"pruneCount":2,"jinCount":0,"landscapeCount":0,"treeAgeDays":30}
T4 (jin + water-and-land): {"primary":"Bound-and-Cut","overlays":["Jin","Water-and-Land"],"wireCount":0,"pruneCount":0,"jinCount":1,"landscapeCount":3,"treeAgeDays":100}
T5 (twine does not count as wire): {"primary":"Clip-and-Grow","overlays":[],"wireCount":0,"pruneCount":2,"jinCount":0,"landscapeCount":0,"treeAgeDays":30}
ALL ASSERTIONS PASSED — EXIT 0
```

Cases covered: empty log, Clip-and-Grow qualifying, wire disqualifying Clip-and-Grow, both overlays simultaneously, twine not incrementing wireCount.

### tsc clean

```
npx tsc --noEmit --project packages/shared/tsconfig.json  → EXIT 0
npx tsc --noEmit --project packages/engine/tsconfig.json  → EXIT 0
```

### wc -l and tail -5 (post-edit, observed)

```
TechniqueClassifier.ts   89 lines  — tail: return { primary, overlays, wireCount, pruneCount, jinCount, landscapeCount, treeAgeDays }; } }
WireEngine.ts           167 lines  — tail: tree._logCare(entry); tree.markDirty(); } }
shared/src/index.ts     406 lines  — tail: export interface JinResult { ok: boolean; reason?: JinRejectReason; scarVoxelCount?: number; }
test_wire.mjs           159 lines  — tail: console.log(`${passed} passed, ${failed} failed`); if (failed > 0) process.exit(1);
DECISIONS.md            178 lines  — tail: StoreModal.tsx evergreen hint revised (2026-08-07, BUG-3b corrective) [...]
```

---

## INTENT CHECK

```
INTENT CHECK (W6 — the audit's central fraud finding)
  code does:     WireEngine.wireCostFor(thickness) returns 1 if thickness ≤ WIRE_COST_T1_MAX (1.5),
                 else 2. Exactly two cost tiers.
  check expects: thin(1.0)=1, mid(2.0)=2, thick(3.0)=2, thickB===mid (exact equality)
  spec says:     GDD s3.2 two-tier wire cost. WireEngine comment confirms two tiers only.
                 The prior `thickB > mid` was broken (2 > 2 = false). The `>= mid` was a
                 weakening to hide the conflict. `=== mid` asserts the actual design.
  verdict:       ALIGNED — two-tier cost is correct spec behavior; assertion now matches it.

INTENT CHECK (OQ-1 — wire depth gate removal)
  code does:     WireEngine.wire() has no depth check. WireRejectReason = 'not-found' | 'pruned' | 'too-thick'.
                 W1 asserts trunk (depth=0) wires OK. W2 asserts depth-2+ wires OK.
  check expects: Any branch at any depth can be wired (OQ-1 resolution, architect spec Part 6).
  spec says:     OQ-1 resolved 2026-07-31: trunk wiring required for Kengai (Cascade) style.
                 No depth restriction on wire or twine.
  verdict:       ALIGNED — implementation matches spec; DECISIONS.md now documents it.

INTENT CHECK (TechniqueClassifier)
  code does:     Single O(n) pass. wireCount = wire actions only (twine excluded).
                 primary = Clip-and-Grow iff wireCount===0 && pruneCount>=2 && treeAgeDays>=30.
                 overlays: Jin if jinCount>=1, Water-and-Land if landscapeCount>=3.
  check expects: TechniqueResult with primary, overlays, all four count fields, treeAgeDays.
  spec says:     Architect spec Part 3. CareLogEntry[] input (not CareAction[]).
                 treeAgeDays explicit (cannot derive from log alone).
  verdict:       ALIGNED — every clause of the spec classification rule is implemented correctly.
```

---

## CAVEATS (Carmack-Linus findings)

The following were found during the mandatory post-completion Carmack-Linus review. Two were applied; one is deferred.

### Applied this session

**C-1 (applied) — Dead `Math.sign/Math.abs` wrapper in `WireEngine.wire()`**
`newAngle` is clamped to `[POLAR_MIN_DEG=5.73°, POLAR_MAX_DEG=150°]` before the cascade gate — always positive. `Math.sign(newAngle)` is always 1; `Math.abs(newAngle)` is always `newAngle`. Removed: `round4(Math.sign(newAngle) * Math.max(POLAR_MIN_DEG, Math.min(cascadeGate, Math.abs(newAngle))))` → `round4(Math.max(POLAR_MIN_DEG, Math.min(cascadeGate, newAngle)))`. Comment added explaining why. Gate suites still exit 0 after the edit.

**L-1 (applied) — `wireCount?: number` guard comment**
`wireCount?` is optional for backward-compat; every read without `?? 0` would silently return `undefined` and yield `NaN` in arithmetic. Guard comment added: `⚠️ ALWAYS read as (b.wireCount ?? 0)`. The existing `WireEngine.ts` usage was already correct. Comment prevents future violations.

### Deferred (not introduced by this pass)

**C-2 (deferred) — Two care-log write paths in WireEngine**
`WireEngine.wire()` uses `tree.getCareLog().push(entry)` directly; `WireEngine.removeWire()` uses `tree._logCare(entry)`. If `_logCare` acquires logic (validation, event emission), `wire()` silently misses it. Deferred: `_logCare` is currently a thin wrapper; the inconsistency is pre-existing and not introduced by this pass. Fix in a dedicated WireEngine cleanup task.

**L-2 (deferred) — W3 always-green fallback**
`assert(true, 'boundary probe only — no natural over-cap branch available')` is a dead assertion when no over-cap branch exists at day 200 for seed 42 (which is always). The `'too-thick'` rejection path has no actual live gate test. Pre-existing. Fix: construct a branch stub directly in the test or use a seed/day that produces a naturally over-cap branch. Deferred to a test-coverage task.
