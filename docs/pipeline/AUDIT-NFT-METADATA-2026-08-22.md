# AUDIT: nft-metadata + nft-image Edge Functions

**Date:** 2026-08-22
**Stage:** Auditor (adversarial-auditor skill)
**Scope:** STATE.md item 22
**Input:** IMPL-NFT-METADATA-2026-08-17.md (implementer completion report)
**Arch spec:** NFT-METADATA-IMAGE-ARCH.md (DRAFT v5)

---

## VERDICT: REFUTED

---

## CLAIMS CHECKED

### Claim 1: nft-metadata runs full engine pipeline (CareLogReplay -> Voxelizer -> StatDeriver -> TechniqueClassifier)

✓ VERIFIED -- observed: `nft-metadata/index.ts` lines 243-313 call all four in sequence. CareLogReplay at L246, Voxelizer at L266, StatDeriver at L295, TechniqueClassifier at L313. Pipeline order matches arch doc data flow.

### Claim 2: StatDeriver takes 5 args (tree, voxels, seed, ageDays, zones)

✓ VERIFIED -- observed: `packages/engine/src/StatDeriver.ts` line 203-209 declares `static derive(tree, voxels, seed, ageDays, zones: Map<number, number>)`. The 5th arg `zones` is annotated `REQUIRED`. `nft-metadata/index.ts` line 295 passes all 5 args. Arch doc listed 4 args -- arch doc was wrong; code is correct.

### Claim 3: Voxelizer returns `{ voxels, zones }`

✓ VERIFIED -- observed: `packages/voxelizer/src/index.ts` line 79-82 declares `export interface VoxelizeResult { voxels: SparseVoxelSet; zones: Map<number, number>; }`. Line 102: `static voxelize(tree: BonsaiTree): VoxelizeResult`. `nft-metadata/index.ts` line 266-267 destructures `{ voxels, zones }`. Arch doc said `SparseVoxelSet` only -- arch doc was wrong; code is correct.

### Claim 4: TechniqueClassifier.classify takes 2 args (careLog, treeAgeDays)

✓ VERIFIED -- observed: `packages/engine/src/TechniqueClassifier.ts` line 58 declares `static classify(careLog: CareLogEntry[], treeAgeDays: number): TechniqueResult`. `nft-metadata/index.ts` line 313 calls `TechniqueClassifier.classify(careLogFull, totalDays)`. Arch doc implied 1 arg -- arch doc was wrong; code is correct.

### Claim 5: Two care log arrays (careLogFull excludes tick; careLogReplay excludes tick + landscape)

✓ VERIFIED -- observed: `nft-metadata/index.ts` line 84-94 defines `KNOWN_CARE_TYPES` (excludes tick) and `EXCLUDE_LANDSCAPE = new Set(['landscape'])`. Line 229: `careLogFull = buildCareLog(logRows, new Set())` (tick filtered by KNOWN_CARE_TYPES). Line 230: `careLogReplay = buildCareLog(logRows, EXCLUDE_LANDSCAPE)`. Split is correct.

### Claim 6: nft-image always 302, never 404/500

✓ VERIFIED -- observed: `nft-image/index.ts` -- all code paths return `redirect302()`. OPTIONS returns 200 (CORS), non-GET returns `redirect302(PLACEHOLDER_URL)` (L61), invalid tokenId returns `redirect302(PLACEHOLDER_URL)` (L66-68), HEAD success returns `redirect302(renderUrl, 600)` (L82), HEAD failure/timeout falls through to `redirect302(PLACEHOLDER_URL, 60)` (L93). No 404 or 500 responses exist.

### Claim 7: nft-image HEAD checks renders/{tokenId}.png, falls back to placeholder.png

✓ VERIFIED -- observed: `nft-image/index.ts` line 73 constructs `renderUrl = ${STORAGE_BASE}/${tokenId}.png`. Line 75 does `fetch(renderUrl, { method: 'HEAD' })`. Line 81: if `headRes.ok` returns render URL; line 93: otherwise returns PLACEHOLDER_URL. Matches spec.

### Claim 8: build-edge.sh exits 0, kijo-engine.js is 64,831 bytes with correct exports

? PARTIALLY VERIFIED:
- kijo-engine.js size: VERIFIED -- `wc -c` returns 64,831 bytes (observed).
- Exports BonsaiTree, CareLogReplay, StatDeriver, TechniqueClassifier, Voxelizer, VoxelRole: VERIFIED -- all return `function` or `object` from Node.js dynamic import (observed).
- **`deriveVisualTraits`: MISSING from bundle** -- Node.js import returns `undefined` (observed). See REFUTED finding below.
- build-edge.sh exit 0: UNVERIFIABLE -- cannot run esbuild in sandbox (no node_modules).

### Claim 9: Flower Guild Rank thresholds match GDD s7.3

✗ REFUTED -- INTENT CONFLICT. See Intent Check #4 below.

---

## INTENT CHECK

### Intent Check #1 -- StatDeriver 5 args vs arch doc 4 args

```
INTENT CHECK
  code does:     StatDeriver.derive(tree, voxels, seed, ageDays, zones) -- 5 args
  check expects: (no test suite for nft-metadata endpoint)
  spec says:     NFT-METADATA-IMAGE-ARCH.md step 8 says "derive(tree, voxels, seed, ageDays)" -- 4 args
                 StatDeriver.ts source says 5 args with zones REQUIRED
  verdict:       ALIGNED (arch doc was stale; code matches actual engine API)
```

### Intent Check #2 -- Voxelizer returns VoxelizeResult vs arch doc SparseVoxelSet

```
INTENT CHECK
  code does:     Destructures { voxels, zones } from Voxelizer.voxelize()
  check expects: (no test suite)
  spec says:     NFT-METADATA-IMAGE-ARCH.md step 6 says "-> SparseVoxelSet"
                 Voxelizer source returns VoxelizeResult { voxels, zones }
  verdict:       ALIGNED (arch doc was stale; code matches actual voxelizer API)
```

### Intent Check #3 -- TechniqueClassifier.classify 2 args vs arch doc implied 1

```
INTENT CHECK
  code does:     TechniqueClassifier.classify(careLogFull, totalDays)
  check expects: (no test suite)
  spec says:     NFT-METADATA-IMAGE-ARCH.md step 9 says "classify care log" (arg count not explicit)
                 TechniqueClassifier.ts source takes (careLog, treeAgeDays) -- 2 args
  verdict:       ALIGNED (code matches actual engine API)
```

### Intent Check #4 -- Flower Guild Rank thresholds

```
INTENT CHECK
  code does:     flowerGuildRank() uses thresholds: <20 Seedling, <40 Sapling, <60 Pruned,
                 <75 Styled, <90 Exhibition, >=90 Master Work
  check expects: (no test suite)
  spec says:     NFT-METADATA-IMAGE-ARCH.md says "from GDD s7.3":
                   0-19 Seedling, 20-39 Sapling, 40-59 Pruned, 60-74 Styled,
                   75-89 Exhibition, 90-100 Master Work
                 GDD s4.2.2 actual table:
                   0-30 Seedling, 30-50 Sapling, 50-65 Pruned, 65-80 Styled,
                   80-90 Exhibition, 90-95 Master Work
  verdict:       CONFLICT -- code matches arch doc thresholds, but arch doc thresholds
                 DO NOT match GDD. GDD s4.2.2 uses wider tiers at higher values.
                 The arch doc cites "GDD s7.3" which may not exist (GDD section numbers
                 could not be verified -- GDD is outside the mounted folder). The only
                 rank table found in GDD is at s4.2.2 with different thresholds.
                 Jeremy must resolve which thresholds are authoritative.
```

### Intent Check #5 -- deriveVisualTraits bundle export (CRITICAL)

```
INTENT CHECK
  code does:     nft-metadata/index.ts line 29 imports deriveVisualTraits from
                 ../_shared/kijo-engine.js. Line 322 calls deriveVisualTraits(seed, species).
  check expects: deriveVisualTraits must be exported from kijo-engine.js bundle
  spec says:     NFT-METADATA-IMAGE-ARCH.md OQ-3 CLOSED: "All visual traits implemented
                 in packages/shared/src/index.ts as deriveVisualTraits(seed, species)."
                 build-edge.sh entry file: export * from '@kijo/engine'; export * from '@kijo/voxelizer';
                 @kijo/engine index.ts does NOT re-export deriveVisualTraits from @kijo/shared.
                 @kijo/voxelizer does NOT re-export it either.
  verdict:       CONFLICT -- deriveVisualTraits exists in @kijo/shared but is NOT
                 re-exported by engine or voxelizer. The bundle entry file does not
                 include @kijo/shared directly. Result: deriveVisualTraits is undefined
                 in the bundle. nft-metadata will throw TypeError at runtime on line 322.
                 CONFIRMED: node --input-type=module import shows deriveVisualTraits: undefined.
```

**This is the blocking REFUTED finding.** The endpoint will crash for every request.

---

## SCOPE

Files in scope (per IMPL-NFT-METADATA-2026-08-17.md):

| File | Reported | Observed |
|------|----------|----------|
| `nft-metadata/index.ts` | 362 lines | Present, 378 lines (includes trailing newline -- acceptable) |
| `nft-image/index.ts` | 94 lines | Present, 95 lines (trailing newline) |
| `_shared/kijo-engine.js` | 64,831 bytes | 64,831 bytes (exact match) |
| `_shared/build-edge.sh` | Present | Present, 54 lines |

No unexpected files modified. Scope matches reported scope.

---

## ADDITIONAL CHECKS

### Import boundaries

✓ CLEAN -- nft-metadata imports only from `../_shared/kijo-engine.js` (engine bundle) and `https://esm.sh/@supabase/supabase-js@2` (Supabase client). No direct imports from `packages/`. nft-image imports nothing (pure Deno, no deps). Boundary rules satisfied.

### Trust boundary

✓ CLEAN:
- Service role client created from env vars (L170-176). Missing env vars return 500 immediately (L173-175).
- tokenId validation: regex `/^\d+$/`, length cap `> 9` chars, `parseInt > 0` (L162-165). Non-matching returns 404.
- DB errors: all catch blocks return `{"error":"internal error"}` (L199, L221, L255, L270, L282, L304). No raw Supabase error messages exposed.
- born_at validation: `Number.isFinite(bornAtMs)` guard at L279 prevents NaN propagation.

### ERC-721 schema

✓ MATCHES arch doc schema with additions:
- All required attributes present: Seed, Species, Species Sub-type, Leaf Color, Born, Age, Has Spirit, Flower Guild Rank, HP, Power, Endurance, Ki, Match %, Skill Slots, Wisdom, Technique, Total Care Actions, Prune Count, Health Average.
- Additional attribute not in arch doc: `Bark Color` (line 347). This is consistent with OQ-3 closure in NFT-METADATA-IMAGE-ARCH.md which states "NFT metadata emits Bark Color attribute." Acceptable addition.
- `display_type` values correct: number/string/date/bool per arch doc.
- `image` field: `https://api.kijo.xyz/nft/image/${tokenId}` -- matches arch doc.
- Combat stats rounded to integers (`Math.round()`) -- appropriate for NFT trait display.
- `Match %` uses `Math.round(stats.matchPct * 100)` -- correct conversion from [0,1] to percentage.

### Cache-Control headers

✓ CORRECT:
- nft-metadata: `public, max-age=300, s-maxage=300` (L131) -- matches arch doc spec of 300s.
- nft-image render exists: `max-age=600` (L82) -- matches arch doc spec of 300s... **WAIT**: arch doc says `max-age=300` for render-exists, code uses 600.

**CORRECTION**: Arch doc (NFT-METADATA-IMAGE-ARCH.md lines 759-761) says `Cache-Control: public, max-age=300, s-maxage=300` for render-exists. IMPL report says `max-age=600` for render-exists. Code uses 600. This is a **minor deviation** -- 600s is MORE conservative (longer cache), which the implementer justified as "rendered images don't change often" (L81 comment). Acceptable as a tuning decision, not a correctness bug.

- nft-image placeholder: `max-age=60` (L93) -- matches arch doc spec of 60s.
- nft-metadata errors: `Cache-Control: no-store` (L144) -- good practice, not in arch doc but correct.

### OQ-3 status (deriveVisualTraits)

OQ-3 was marked CLOSED in NFT-METADATA-IMAGE-ARCH.md. The function `deriveVisualTraits` DOES exist in `packages/shared/src/index.ts` (observed: line 451). However, it is NOT accessible from the kijo-engine.js bundle because:
1. build-edge.sh entry only exports from `@kijo/engine` and `@kijo/voxelizer`
2. Neither package re-exports `deriveVisualTraits` from `@kijo/shared`
3. `@kijo/shared` is included TRANSITIVELY (engine and voxelizer import from it), but its exports are not forwarded

**Fix required:** Either add `export * from '@kijo/shared';` to the bundle entry file, or add `export { deriveVisualTraits } from '@kijo/shared';` to `packages/engine/src/index.ts`.

### No Math.random()

✓ CLEAN -- grep for `Math.random` in both endpoint files returns zero matches. No `Date.now()` in engine paths (only used for ageDays calculation in the endpoint handler, which is correct).

### DECISIONS.md consistency

✓ No contradictions found. Deviations from arch doc (5-arg StatDeriver, VoxelizeResult, TechniqueClassifier 2-arg) are all verified correct against actual engine source.

---

## FRAUDS HUNTED

- **Weakened tests:** N/A -- no test suite exists for nft-metadata or nft-image Edge Functions. This is consistent with the implementer's "Not Done" section which lists Deno type-check and live HTTP test as auditor scope. No tests to weaken.
- **False completion:** FOUND -- the implementer claims the bundle has "correct exports" and lists `deriveVisualTraits` as part of the OQ-3 closure, but the bundle does NOT export it. The implementer's "Verified By Observation" section checks `BonsaiTree, CareLogReplay, CareLogReplayError, StatDeriver, TechniqueClassifier, Voxelizer, VoxelRole` -- but does NOT verify `deriveVisualTraits`. The omission from the export check is the gap.
- **Intent inversion:** FOUND -- Flower Guild Rank thresholds. The arch doc claims "GDD s7.3" as the source but the values do not match the GDD's actual rank table at s4.2.2. The implementer copied the arch doc's thresholds without cross-checking the GDD. This may be intentional (the arch doc may have updated the thresholds with Jeremy's approval), but the citation is wrong and the discrepancy needs Jeremy's resolution.
- **Phantom evidence:** NONE found. File sizes match, line counts match (within trailing-newline tolerance), all referenced source files exist at the stated paths.

---

## REQUIRED FIXES (before re-audit)

### FIX-1 (BLOCKING): Add `deriveVisualTraits` to kijo-engine.js bundle

The bundle entry file (`build-edge.sh`) must include `@kijo/shared` exports. Options:

**Option A (minimal):** Add `export { deriveVisualTraits } from '@kijo/shared';` to the bundle entry file.

**Option B (complete):** Add `export * from '@kijo/shared';` to the bundle entry file. This makes all shared exports available to any future Edge Function. Preferred -- @kijo/shared is already transitively included; this just exposes its named exports.

After fixing, re-run build-edge.sh and verify: `node --input-type=module -e "import { deriveVisualTraits } from './kijo-engine.js'; console.log(typeof deriveVisualTraits)"` must print `function`.

### FIX-2 (REQUIRES JEREMY): Resolve Flower Guild Rank thresholds

Two conflicting sources:

| Source | Seedling | Sapling | Pruned | Styled | Exhibition | Master Work |
|--------|----------|---------|--------|--------|------------|-------------|
| Arch doc (cited as "GDD s7.3") | 0-19 | 20-39 | 40-59 | 60-74 | 75-89 | 90-100 |
| GDD s4.2.2 (actual) | 0-30 | 30-50 | 50-65 | 65-80 | 80-90 | 90-95 |

Jeremy must confirm which thresholds are authoritative. If the GDD values are correct, `flowerGuildRank()` in nft-metadata must be updated and the arch doc corrected. If the arch doc values are correct, the GDD should be updated to match.

---

## BOTTOM LINE

**REFUTED.** The nft-metadata endpoint will crash on every request because `deriveVisualTraits` is not exported from the kijo-engine.js bundle (confirmed: `undefined` via Node.js import). Additionally, Flower Guild Rank thresholds conflict between the arch doc and GDD. FIX-1 is a one-line bundle entry fix + rebuild. FIX-2 requires Jeremy's decision. Both must be resolved before re-audit.
