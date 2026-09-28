# AUDIT: Landscape Handler for CareLogReplay

**Date:** 2026-09-21
**Pipeline stage:** Auditor (adversarial)
**Skills invoked:** adversarial-auditor, carmack-linus-review, second-brain
**Spec:** ARCH-LANDSCAPE-HANDLER-2026-09-20.md
**Critic:** CRITIC-LANDSCAPE-HANDLER-2026-09-20.md
**Implementer claim:** Replaced landscape throw in CareLogReplay.ts (lines 145-150) with `tree.addLandscape(a.elementType, a.position)`. No other files changed. Could NOT run npm test or tsc due to sandbox mount issues.

---

## VERDICT: VERIFIED WITH CAVEATS

---

## CLAIMS CHECKED

| # | Claim | Observed | Status |
|---|-------|----------|--------|
| 1 | Throw at CareLogReplay.ts:145-150 replaced with working handler | CareLogReplay.ts L145-146: `} else if (a.type === 'landscape') { tree.addLandscape(a.elementType, a.position); }` — throw is GONE, handler is PRESENT | ✓ VERIFIED |
| 2 | Replacement calls `tree.addLandscape(a.elementType, a.position)` | L146: exact match — `tree.addLandscape(a.elementType, a.position);` | ✓ VERIFIED |
| 3 | No other files changed | BonsaiTree.ts: addLandscape has NO elementType guard (Gap C NOT applied — consistent with "no other files changed"). care-action/index.ts: ALLOWED_ACTION_TYPES still excludes 'jin' and 'landscape' (L201, 10 types only). SCHEMAS.landscape: still raw pass-through (L124-127). No test files created or modified. No `.skip`/`.only` in any test file. | ✓ VERIFIED |
| 4 | Exhaustiveness guard `_exhaustive: never` still present after landscape case | CareLogReplay.ts L147-153: `} else { const _exhaustive: never = a; throw new CareLogReplayError(...)` — immediately follows landscape handler | ✓ VERIFIED |
| 5 | BonsaiTree.addLandscape signature matches call site | BonsaiTree.ts L309: `addLandscape(elementType: LandscapeElementType, position: Coordinate): void`. Call at L146: `tree.addLandscape(a.elementType, a.position)`. CareAction landscape variant (shared/index.ts L294): `{ type: 'landscape'; elementType: LandscapeElementType; position: Coordinate }`. All three align. | ✓ VERIFIED |
| 6 | CareAction 'landscape' has elementType and position fields | shared/index.ts L294: `{ type: 'landscape'; elementType: LandscapeElementType; position: Coordinate }` | ✓ VERIFIED |
| 7 | npm test passes | UNVERIFIABLE: Bash sandbox mount failure (Windows update issue Sep 8). Cannot run `npm test` or any Node.js command. Same environment issue implementer reported. | ? UNVERIFIABLE |
| 8 | tsc --noEmit exits 0 | UNVERIFIABLE: Same sandbox mount failure. Cannot run `npx tsc --noEmit`. | ? UNVERIFIABLE |
| 9 | Import boundaries engine->shared only | CareLogReplay.ts imports: `@kijo/shared` (allowed), `./BonsaiTree.js`, `./GrowthEngine.js`, `./PruneEngine.js`, `./WireEngine.js`, `./errors.js` (all engine-internal, allowed). No imports from server, voxelizer, or any forbidden package. | ✓ VERIFIED |

---

## INTENT CHECK

```
INTENT CHECK
  code does:     CareLogReplay.reconstruct() calls tree.addLandscape(a.elementType, a.position)
                 when it encounters a 'landscape' care action during replay. addLandscape
                 validates position bounds [0,255], logs the care action, and marks dirty.
                 No tree growth, branch physics, or stat impact.

  check expects: (LAND-1 through LAND-9 — NOT YET WRITTEN OR RUN)
                 Test file test_landscape_replay.mjs does NOT exist on disk.
                 No test verifies the handler yet. This is a CAVEAT.

  spec says:     Replace throw with tree.addLandscape(a.elementType, a.position).
                 Pattern mirrors other handlers (water->tree.water, jin->tree.applyJin).
                 addLandscape already validates position bounds and logs care.
                 No additional error handling needed (addLandscape throws CareLogReplayError).

  verdict:       ALIGNED (code matches spec; no test to contradict)
```

---

## SCOPE

**Files the implementer claims changed:** CareLogReplay.ts (1 file)

**Observed:**
- CareLogReplay.ts: CHANGED — landscape throw replaced with handler (verified)
- BonsaiTree.ts: NOT CHANGED — no elementType guard added (Gap C deferred)
- care-action/index.ts: NOT CHANGED — ALLOWED_ACTION_TYPES still 10-element Set, no 'jin'/'landscape'
- SCHEMAS.landscape: NOT CHANGED — still raw pass-through (no server validation hardening)
- No test files created (test_landscape_replay.mjs does NOT exist)
- No test files modified (grepped for `.skip`, `.only`, `landscape` across all test/ files — clean)

**Scope assessment:** CLEAN — only CareLogReplay.ts was modified. The single-file claim is true.

**However:** The architect spec (§7) prescribed 7 implementation steps. The implementer completed only step 2 (the core replay handler fix). Steps 1, 3, 4, 5, 6 are NOT done:
- Step 1: BonsaiTree.addLandscape elementType guard (Gap C) — NOT done
- Step 3: Test file test_landscape_replay.mjs (LAND-1 through LAND-9) — NOT done
- Step 4: Server SCHEMAS.landscape hardening (Gap A + B) — NOT done
- Step 5: Re-add 'jin' and 'landscape' to ALLOWED_ACTION_TYPES — NOT done
- Step 6: Rebuild kijo-engine.js and engine.bundle.mjs bundles — NOT done

This is NOT a scope violation — it appears the implementer was tasked with only the CareLogReplay fix, with remaining steps deferred to later pipeline stages.

---

## FRAUDS HUNTED

### 1. Weakened tests
**NONE FOUND.** No test files were created, modified, or deleted. Grepped all files under `packages/engine/test/` for `.skip`, `.only`, and `landscape` — only hit is `cost-guards.test.js:319` which is a pre-existing server schema copy, not a test modification. No assertions were loosened, commented out, or removed.

### 2. False completion
**PARTIALLY APPLICABLE.** The implementer correctly stated they could NOT run npm test or tsc. They did NOT claim "tests pass" — they honestly reported the sandbox limitation. The code change itself is verifiable from disk. However, the absence of runtime verification (no test run, no type check) means correctness is verified only by static analysis of the code, not by execution. This is an honest CAVEAT, not a fraud.

### 3. Intent inversion
**NONE FOUND.** The spec says "replace throw with tree.addLandscape(a.elementType, a.position)". The code does exactly that. No spec/test conflict exists because no test was written. The CareAction type, the BonsaiTree.addLandscape signature, and the replay handler call all align. The exhaustiveness guard is preserved. The pattern matches every other handler in the file (water, fertilize, rotate, prune, wire, etc.).

### 4. Phantom evidence
**NONE FOUND.** The implementer's claim references CareLogReplay.ts lines 145-150. I read the actual file — the line numbers are accurate (L145-146 is the landscape handler, L147 starts the else/exhaustiveness guard). No fabricated line numbers, no phantom file paths, no invented output.

---

## Carmack-Linus Review: The Edit Itself

### ⚡ Code Review: CareLogReplay landscape handler (1-line fix)

### The Verdict
This is a correct, minimal fix. One line of code that follows the exact pattern of every other handler in the file. No abstraction, no over-engineering, no side effects. Carmack would nod. Linus would say "obvious patch, should have shipped sooner."

### ⚠️ Logic & Security Context
- **Invariant preserved:** `seed + care_log -> identical tree` holds because addLandscape is deterministic (no RNG, no Date.now()). Same elementType + position -> same care log entry.
- **Trust model:** CareLogReplay consumes care logs that originate from the server. The server currently REJECTS landscape actions (not in ALLOWED_ACTION_TYPES). Once landscape is re-added to the whitelist, the server SCHEMAS.landscape validator still passes elementType without validation — this is a pre-existing gap (flagged in spec as Gap A), NOT introduced by this change.
- **State ordering:** addLandscape validates position BEFORE logging — correct (check-then-act).
- **No reentrancy risk:** addLandscape is synchronous, modifies only the care log array and dirty flag.

### 🕹️ Carmack's Notes
Nothing to flag. The change is a single function call with no performance implications. addLandscape does O(1) work (push to array, set dirty flag). No allocations in hot paths beyond the care log entry itself, which is inherent to the operation.

### 🐧 Linus's Notes
The pattern is consistent:
```
} else if (a.type === 'jin') {
  tree.applyJin(a.branchId, a.segmentIndex, a.jinCost);
} else if (a.type === 'landscape') {
  tree.addLandscape(a.elementType, a.position);
} else {
  const _exhaustive: never = a;
```
Each handler delegates to the tree method and lets that method handle validation. Landscape follows this pattern exactly. The exhaustiveness guard closes the chain. Clean.

One note: addLandscape does NOT validate elementType at runtime (Gap C). A crafted care log with `elementType: "__proto__"` would be logged without rejection by the engine. The server should reject this first (Gap A), but defense-in-depth says the engine should too. This is a pre-existing gap, not introduced by this change, but it should be addressed in a follow-up step.

### What This Code Gets Right
- Minimal diff (remove 3 lines, add 1 line)
- Exact pattern match with every other handler
- No new imports needed
- No new error handling needed (addLandscape already throws CareLogReplayError)
- Exhaustiveness guard preserved
- Deterministic (no RNG, no wall-clock)

### Critical Fixes
None required for this edit. The edit is correct as-is.

---

## Kijo-Specific Checks

| Check | Result |
|-------|--------|
| round4() discipline in growth-math diff | N/A — no growth math changed. addLandscape has zero effect on tree growth. |
| DECISIONS.md updated for resolved R-number | N/A — no R-number resolved in this change. |
| Import boundaries: engine->shared only | ✓ PASS — CareLogReplay.ts imports only from @kijo/shared and engine-internal modules. |
| Determinism preserved | ✓ PASS (static analysis) — addLandscape is deterministic. Same elementType + position -> same care log entry. No RNG, no Date.now(), no Math.random(). |
| STATE.md updated | NOT YET — should be updated when full pipeline completes (remaining steps 1,3-6 still outstanding). |

---

## Diff Against Spec

| Spec Step | Spec Says | Implemented? | Notes |
|-----------|-----------|-------------|-------|
| §1: Replay Handler | Replace throw with `tree.addLandscape(a.elementType, a.position)` | ✓ YES | Exact match |
| §2: State Storage | No TreeState change (care-log-only) | ✓ YES | No TreeState modification |
| §3: landscape-remove | Defer (no change) | ✓ YES | No landscape-remove added |
| §5 Gap A: Server elementType validation | Add ALLOWED_ELEMENT_TYPES Set check | ✗ NOT DONE | Deferred to later step |
| §5 Gap B: Server position validation | Add requireIntRange for position | ✗ NOT DONE | Deferred to later step |
| §5 Gap C: Engine elementType guard | Add runtime check in addLandscape | ✗ NOT DONE | Deferred to later step |
| §6: Test gates LAND-1 through LAND-9 | Write test_landscape_replay.mjs | ✗ NOT DONE | No test file created |
| §7 Step 4: Server whitelist | Re-add jin + landscape to ALLOWED_ACTION_TYPES | ✗ NOT DONE | Correct — gated behind test pass |
| §7 Step 6: Bundle rebuild | Re-run esbuild for kijo-engine.js | ✗ NOT DONE | Deferred |

The core fix (the replay handler) matches the spec exactly. The remaining steps are deferred — this appears to be a partial implementation of the full 7-step spec.

---

## Trusted Developer Sources Compared

Per the critic's B-1 blocker and project SOP, the following wiki patterns were consulted:

| Collection | Wiki Pages Checked | Finding |
|---|---|---|
| Proof of Play | token-guards.md, game-guards.md, game-actions.md | PoP equipment allowlist guard (token-guards.md) is comparable to ALLOWED_ELEMENT_TYPES pattern. No slot/burn mechanic applicable. |
| dwi | (via critic table) | No applicable landscape/item-placement pattern. |
| jaatster | (via critic table) | Catalog validation pipeline structurally similar to server validation. |
| SageStarCodes | (via critic table) | TileEntity/IInventory is fixed-slot storage. Not applicable. |
| HelgeSverre | (via critic table) | No applicable pattern. |
| martindevans | (via critic table) | No applicable pattern. |
| karpathy | (via critic table) | No applicable pattern. |
| Ronin Builders | Not cataloged in wiki | Cannot search. |
| Sky Mavis | Indirect via dwi/truongnguyenptn | No applicable landscape pattern. |
| Axie Infinity | Indirect via jaatster/dwi | No applicable landscape pattern. |

The critic's full comparison table (B-1) was reviewed. The citations are adequate for a 1-line cosmetic handler fix with no combat or financial impact.

---

## CAVEATS

1. **npm test / tsc --noEmit NOT RUN.** The Linux sandbox cannot mount due to a Windows update issue (September 8). This is an environment failure, not a code failure. The implementer reported the same limitation honestly. Both `npm test` (93/93 expected) and `npx tsc --noEmit` (expected exit 0) are UNVERIFIABLE in this session. **Recommendation:** Jeremy should run `cd packages/engine && npm test` and `npx tsc --noEmit` locally before accepting. The change is a 1-line handler addition in an if/else chain — static analysis shows it is type-correct and follows the established pattern — but runtime verification is the gold standard.

2. **No test file created.** The spec prescribes LAND-1 through LAND-9 test gates (test_landscape_replay.mjs). This file does not exist. The handler is untested at runtime. This is a significant gap for a Web3 project where the replay path is the backbone of NFT verification. **Recommendation:** The test file should be written and run as the next pipeline step before the server whitelist is re-opened.

3. **Remaining spec steps 1, 3-6 not implemented.** The elementType runtime guard (Gap C), server validation hardening (Gaps A, B), server whitelist re-addition, and bundle rebuild are all outstanding. These are correctly deferred (the implementer was tasked with only the CareLogReplay fix), but they must be completed before landscape actions can reach production.

---

## BOTTOM LINE

The CareLogReplay landscape handler fix is **correct** — the 1-line change exactly matches the architect spec, follows the established handler pattern, preserves the exhaustiveness guard, maintains determinism, respects import boundaries, and introduces no new risks. The edit is clean. The CAVEATS are all environmental (can't run tests) or scope-related (remaining spec steps deferred). No frauds detected. **VERIFIED WITH CAVEATS** — the caveats are: (1) no runtime test execution possible, (2) no test file written yet, (3) remaining pipeline steps outstanding. Once tests pass and the full spec is implemented, this should be VERIFIED outright.
