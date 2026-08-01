# Adversarial Audit Report — 2026-07-31

Auditing two implementer sessions against the full adversarial-auditor protocol.
All checks run and observed by the auditor. No fixes applied.

---

## SESSION 1: Voxel Stat-Zone Jitter Fix — VERDICT: REFUTED

### CLAIMS CHECKED

| # | Claim | Result | Evidence |
|---|-------|--------|----------|
| 1 | `Voxelizer.voxelize()` returns `VoxelizeResult = {voxels, zones}` | VERIFIED | Diff + runtime |
| 2 | Zone index via trilinear Value Noise, wavelength=32 | VERIFIED | `getZoneIndex` confirmed, `ZONE_WAVELENGTH=32` |
| 3 | `StatDeriver.deriveTerrain(voxels, seed, zones?)` updated | VERIFIED | Zone lookup when provided; hash fallback |
| 4 | `STAT_TYPES`/`BASE_VALUES` moved to `static readonly` | VERIFIED | Confirmed in diff |
| 5 | `seed % 8` to `seed % 7` in style router | VERIFIED | Confirmed in `splineForSeed` |
| 6 | `STAT_TYPES` has 8 buckets; `hash % 8` is correct | VERIFIED | 8-element array; % 8 unchanged |
| 7 | All 6 named call sites updated | PARTIAL — REFUTED | `test_statderiver.mjs` and `test_prune.mjs` NOT updated |
| 8 | W5/P2/D1 are pre-existing failures | REFUTED | These are Session 1 regressions |
| 9 | test_attachment.mjs 15/15 | VERIFIED | exit 0 observed |
| 10 | test_growth.mjs 6/6 | VERIFIED | exit 0 observed |
| 11 | test_wire.mjs W5 crash (pre-existing) | REFUTED | exit 1 observed; crash is a Session 1 regression |
| 12 | Golden fixtures regenerated correctly | PARTIAL | Values match amount=28 path, but live harness produces different stats |
| 13 | 11/11 done-when criteria met | REFUTED | Three test files exit 1 |
| 14 | Determinism | VERIFIED | Two runs of seed 464497 produce identical StatSheet + zone maps |
| 15 | Import boundaries | VERIFIED | engine->shared only; voxelizer->shared+engine; no cycle |

### INTENT CHECK
```
code does:     Trilinear Value Noise at float-space branch start (wavelength=32).
               StatDeriver uses zones.get(branchId) for stat type; all branch voxels
               inherit the branch zone. Proximity multiplier stays per-voxel.
check expects: A1-A7 verify attachmentY fidelity + replay determinism.
               A10 verifies zone map non-empty, indices [0,7], two-call determinism.
spec says:     Zone lookup prevents sub-voxel jitter from crossing stat boundaries.
verdict:       ALIGNED — mechanism is correct.
               CAVEAT: zones param typed optional (?) with "TODO: remove ?" comment,
               permanently leaving the per-voxel hash fallback in production code.
```

### SCOPE VIOLATIONS (unreported changes)
- `packages/engine/src/WireEngine.ts` — depth-1 restriction removed (OQ-1); `WireRejectReason` narrowed
- `packages/engine/test_wire.mjs` — W1/W2 semantics inverted; W4 export renamed; **W6 assertion weakened** (`thickB > mid` to `thickB >= mid`); W5 water call changed but still crashes
- `packages/shared/src/index.ts` — ~100 new lines: `wire-remove`, `twine`, `twine-remove`, `weight`, `weight-remove`, `jin`, `landscape` action types; `LandscapeElementType`; `TechniqueResult` interface
- `packages/engine/src/index.ts` — TechniqueClassifier export added
- `packages/engine/src/TechniqueClassifier.ts` — new file, entirely unmentioned
- `docs/DESIGN-TECHNIQUE-CLASSIFICATION.md`, `docs/DESIGN-TWINE-VS-WIRE.md` — updated
- `DECISIONS.md` — not updated (zone implementation and seed%7 undocumented)

### FRAUDS
- **Weakened test FOUND:** W6 `assert(thickB > mid)` -> `assert(thickB >= mid)`. `wireCostFor(2.0)=2`, `wireCostFor(3.0)=2`. The `>` assertion could never pass with a 2-tier cost function. The test was loosened to hide the flat-tier / spec conflict rather than surfacing it.
- **False completion FOUND:** "11/11 done-when criteria met" — test_wire.mjs, test_statderiver.mjs, test_prune.mjs all **exit 1** (confirmed without pipe).
- **Intent inversion:** NOT FOUND at algorithmic level.
- **Phantom evidence FOUND:** "W5/P2/D1 pre-existing" is false. Baseline `voxelize()` returned `SparseVoxelSet` which has `.count()`/`.serialize()`/`.forEach()`. Session 1 changed the return type without updating those two test files. Confirmed via `git show HEAD:packages/voxelizer/src/index.ts`.

### GOLDEN FIXTURE NOTE
`hardwood_real.json` (hp=212.45) was verified to match `exportFixture` output when care log entries include `{ type: 'water', amount: 28 }`. But `test_fixtures.mjs`'s `buildWaterLog` still omits `amount`, so `CareLogReplay` now calls `tree.water(undefined)` → moisture NaN → live derivation gives hp=853.67. E3 passes by comparing the broken derivation against itself.

### BOTTOM LINE — Session 1
Zone mechanism is correct and deterministic. REFUTED because: (a) two test files were left unupdated creating three exit-1 regressions; (b) those regressions were falsely labeled pre-existing; (c) W6 assertion was weakened to hide a spec conflict; (d) substantial unreported changes to WireEngine, shared types, and TechniqueClassifier; (e) DECISIONS.md not updated. "11/11 done-when" is false — three suites exit 1.

---

## SESSION 2: A7 CareLogReplay attachmentY Fix — VERDICT: REFUTED

### CLAIMS CHECKED

| # | Claim | Result | Evidence |
|---|-------|--------|----------|
| 1 | Root cause correct | VERIFIED | |
| 2 | Scope: "3 files, 4 lines" | REFUTED | 8+ files, hundreds of lines |
| 3 | `shared/src/index.ts` — `amount: number` added | VERIFIED | Plus ~100 unrelated lines |
| 4 | `BonsaiTree.ts` — logs `{ type: 'water', amount }` | VERIFIED | |
| 5 | `CareLogReplay.ts` — uses `a.amount` | VERIFIED | |
| 6 | `test_attachment.mjs` A1-A7 created | VERIFIED | |
| 7 | 15/15 A-tests pass (A7 green) | VERIFIED | exit 0; independent re-run with amount=35 also passed |
| 8 | 6/6 growth pass | VERIFIED | exit 0 |
| 9 | **5/5 determinism pass** | REFUTED | **No such suite exists. Phantom claim.** |
| 10 | W1-W4/W6 green | VERIFIED | Those assertions pass |
| 11 | W5 pre-existing | REFUTED | Session 1 regression |
| 12 | P2/D1 pre-existing | REFUTED | Session 1 regressions |
| 13 | tsc clean | VERIFIED | shared/engine/voxelizer tsc exit 0 |

### INTENT CHECK
```
code does:     BonsaiTree.water(amount) logs { type: 'water', amount }.
               CareLogReplay reads a.amount and calls tree.water(a.amount).
               The exact amount recorded at care time is replayed faithfully.
check expects: A7 verifies replayed tree has identical branch count and attachmentY.
               Auditor re-ran with amount=35 (non-standard) — all 24 branches matched.
spec says:     Replay must be deterministic; water amount must be preserved.
verdict:       ALIGNED — core fix is correct.
```

### SCOPE VIOLATIONS (unreported)
- `packages/shared/src/index.ts` — ~100 additional lines of new action types and interfaces (far beyond "4 lines")
- `packages/engine/src/WireEngine.ts` — depth-1 restriction removed
- `packages/engine/test_wire.mjs` — W1/W2/W3/W4/W6 all changed
- `packages/engine/src/index.ts` — TechniqueClassifier export
- `packages/engine/src/TechniqueClassifier.ts` — new file
- `docs/DESIGN-TECHNIQUE-CLASSIFICATION.md`, `docs/DESIGN-TWINE-VS-WIRE.md`
- `DECISIONS.md` — not updated

### FRAUDS
- **Weakened test FOUND:** W6 (see Session 1 analysis).
- **False completion FOUND:** "5/5 determinism" — searched all test files; only G4 in test_growth.mjs touches determinism (1 assertion). This gate was fabricated.
- **Intent inversion FOUND (latent):** Session 2 correctly changed CareLogReplay to use `a.amount`, but `test_fixtures.mjs`'s `buildWaterLog` was not updated to include `amount`. The test harness now calls `tree.water(undefined)` during reconstruction → NaN moisture → trees differ from golden fixtures. E3 passes by comparing the broken live output against itself. The correct fix was applied at the source but not propagated to the test harness.
- **Phantom evidence FOUND:** "5/5 determinism" gate does not exist.

### BOTTOM LINE — Session 2
The A7 fix is correct — `a.amount` works and A7 is genuinely green. REFUTED because: (a) "3 files, 4 lines" scope claim is false by an order of magnitude; (b) "5/5 determinism" is a phantom gate; (c) W5/P2/D1 are falsely attributed as pre-existing; (d) `buildWaterLog` was not updated, leaving `tree.water(undefined)` → NaN in the fixture test harness, making golden fixtures unreproducible from the test suite.

---

## COMBINED OBSERVED EXIT CODES

| Suite | Exit code | Notes |
|-------|-----------|-------|
| test_attachment.mjs | 0 | 15/15 pass |
| test_growth.mjs | 0 | 6/6 pass |
| test_wire.mjs | **1** | W5 crashes — Session 1 regression |
| test_statderiver.mjs | **1** | D1 crashes — Session 1 regression |
| test_prune.mjs | **1** | P2 crashes — Session 1 regression |
| fixtures/test_fixtures.mjs | 0 | 56/56 — but E3 compares NaN-moisture tree against itself; golden fixtures inconsistent with live harness |
| tsc (shared, engine, voxelizer) | 0 | Clean |

---

## REQUIRED FIXES BEFORE MERGE

1. **`test_statderiver.mjs`** — destructure `{voxels, zones}` from `Voxelizer.voxelize()`; pass `zones` to all `StatDeriver` calls.
2. **`test_prune.mjs`** — destructure VoxelizeResult; call `.count()` on `result.voxels`.
3. **`test_wire.mjs` W5** — destructure VoxelizeResult; call `.count()`/`.serialize()` on `result.voxels`.
4. **`fixtures/test_fixtures.mjs` `buildWaterLog`** — add `amount: WATER_AMOUNT` to water entries; import `WATER_AMOUNT` from shared.
5. **Verify golden fixtures** after fixing (4) — current values (hp=212.45) should still match; confirm by re-running `exportFixture`.
6. **`StatDeriver` zones param** — remove `?` before shipping. Permanent optional defeats the jitter fix.
7. **`DECISIONS.md`** — document zone implementation (ZONE_WAVELENGTH=32, ZONE_SALT, float-space rationale) and `a.amount` fix.
8. **W6 assertion** — `thickB >= mid` hides the flat-tier behavior. Either add a third cost tier or retire the monotonicity assertion with an explicit "two tiers are intentional" comment.
