# RE-AUDIT: nft-metadata + nft-image Edge Functions (FIX-1 + FIX-2)

**Date:** 2026-08-23
**Stage:** Auditor re-audit (adversarial-auditor skill)
**Scope:** FIX-1 and FIX-2 from AUDIT-NFT-METADATA-2026-08-22.md only
**Prior verdict:** REFUTED (two findings)
**All other claims from the first audit stand as previously verified.**

---

## VERDICT: VERIFIED

---

## CLAIMS CHECKED

### FIX-1: deriveVisualTraits now exported from kijo-engine.js bundle

✓ **build-edge.sh updated** — observed: `git diff HEAD -- build-edge.sh` shows exactly one line added at line 37: `export * from '@kijo/shared';` inside the synthetic entry heredoc. No other changes to the file.

✓ **deriveVisualTraits is a function** — observed: `node --input-type=module -e "import { deriveVisualTraits } from './apps/server/supabase/functions/_shared/kijo-engine.js'; console.log(typeof deriveVisualTraits)"` prints `function`. Previously printed `undefined`.

✓ **Bundle size reasonable** — observed: `wc -c` returns 66,727 bytes (was 64,831). Delta of +1,896 bytes is consistent with adding @kijo/shared named exports to the bundle. No suspicious size jump.

✓ **Other exports still work** — observed via Node.js import:
- BonsaiTree: function ✓
- CareLogReplay: function ✓
- StatDeriver: function ✓
- TechniqueClassifier: function ✓
- Voxelizer: function ✓
- VoxelRole: object ✓

### FIX-2: DECISIONS.md entry for Flower Guild Rank threshold conflict

✓ **Entry present and dated 2026-08-23** — observed: `git diff HEAD -- DECISIONS.md` shows a new `## 2026-08-23` section appended with one entry.

✓ **Documents the conflict** — entry states: arch doc thresholds (0-19 Seedling ... 90-100 Master Work) vs GDD §4.2.2 table (0-30 Seedling ... 90-95 Master Work). Both threshold sets reproduced in full.

✓ **Jeremy's ruling recorded** — entry states: "Jeremy ruled (2026-08-23): the arch doc thresholds are authoritative."

✓ **GDD described as estimated** — entry states: "The GDD §4.2.2 values were early estimates that the arch doc intentionally refined."

✓ **No code change required** — entry states: "No code change required — `flowerGuildRank()` in `nft-metadata/index.ts` already uses the arch doc thresholds." Confirmed by observation: `flowerGuildRank()` at lines 43-51 uses <20/<40/<60/<75/<90 thresholds, matching the arch doc exactly.

✓ **Stale citation noted** — entry notes: "The citation 'GDD §7.3' in the arch doc is incorrect (should reference §4.2.2) but the threshold values themselves are the intended design."

---

## INTENT CHECK

### Intent Check #1 — FIX-1: bundle export vs nft-metadata import

```
INTENT CHECK
  code does:     build-edge.sh synthetic entry now includes `export * from '@kijo/shared';`.
                 kijo-engine.js (66,727 bytes) exports deriveVisualTraits as a function.
  check expects: nft-metadata/index.ts line 29 imports { deriveVisualTraits } from
                 '../_shared/kijo-engine.js'. Line 322 calls deriveVisualTraits(seed, species).
  spec says:     NFT-METADATA-IMAGE-ARCH.md OQ-3 CLOSED: deriveVisualTraits implemented in
                 packages/shared/src/index.ts. Must be accessible from the bundle.
  verdict:       ALIGNED
```

### Intent Check #2 — FIX-2: Flower Guild Rank thresholds

```
INTENT CHECK
  code does:     flowerGuildRank() uses <20/<40/<60/<75/<90 thresholds (arch doc values).
                 No code change made. DECISIONS.md entry records Jeremy's ruling.
  check expects: (no test suite for nft-metadata)
  spec says:     NFT-METADATA-IMAGE-ARCH.md: 0-19/20-39/40-59/60-74/75-89/90-100.
                 GDD §4.2.2: 0-30/30-50/50-65/65-80/80-90/90-95 (SUPERSEDED per Jeremy).
                 DECISIONS.md 2026-08-23: arch doc thresholds authoritative.
  verdict:       ALIGNED (owner resolved the conflict; code matches ruling)
```

---

## SCOPE

Expected changes (FIX-1 + FIX-2 only):

| File | Expected | Observed |
|------|----------|----------|
| `_shared/build-edge.sh` | +1 line (`export * from '@kijo/shared'`) | ✓ Exactly one line added |
| `_shared/kijo-engine.js` | Rebuilt, slightly larger | ✓ 66,727 bytes (+1,896 from 64,831) |
| `DECISIONS.md` | New 2026-08-23 section | ✓ One entry appended |

### Additional uncommitted changes (NOT related to FIX-1/FIX-2):

| File | Assessment |
|------|------------|
| `STATE.md` | Dockerfile description updated (render-worker, prior session) |
| `apps/render-worker/Dockerfile` | GitHub Releases asset fetch (render-worker, prior session) |
| `kijo/docs/research/HOLOGRAM-BONSAI-PARTNERSHIP-2026-08-03.md` | Unrelated research doc |

These are pre-existing uncommitted changes from prior pipeline stages, not related to FIX-1 or FIX-2. No scope violation.

### Test files modified: NONE ✓

---

## FRAUDS HUNTED

- **Weakened tests:** No test files modified (confirmed: `git diff HEAD --name-only | grep -i test` returns empty). No test suite exists for nft-metadata/nft-image (unchanged from first audit).
- **False completion:** NONE — deriveVisualTraits confirmed `function` by direct Node.js import (the exact check the first audit used to REFUTE the claim). DECISIONS.md entry confirmed present with all required content.
- **Intent inversion:** NONE — both fixes align code, spec, and owner ruling. The threshold conflict is resolved by Jeremy's explicit decision, properly documented.
- **Phantom evidence:** NONE — bundle size (66,727), diff content, and DECISIONS.md entry all verified by direct observation.

---

## BOTTOM LINE

**VERIFIED.** Both REFUTED findings from the first audit are resolved. FIX-1: `deriveVisualTraits` is now exported from the kijo-engine.js bundle (confirmed: `typeof === 'function'`; all other exports intact). FIX-2: Flower Guild Rank threshold conflict resolved via DECISIONS.md entry documenting Jeremy's ruling that arch doc thresholds are authoritative. No code changes, no test modifications, scope clean.
