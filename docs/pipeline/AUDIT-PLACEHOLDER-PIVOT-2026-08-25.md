# AUDIT-PLACEHOLDER-PIVOT-2026-08-25

**Auditor:** Adversarial Auditor (pipeline stage 4)
**Implementer report:** `docs/pipeline/IMPL-PLACEHOLDER-PIVOT-2026-08-25.md`
**Date:** 2026-08-25

---

VERDICT: **CAVEATS**

---

## CLAIMS CHECKED

✓ **`nft-image/index.ts` PLACEHOLDER_URL is literal GitHub Releases URL** — observed: line 24 is `const PLACEHOLDER_URL = 'https://github.com/Baku-1/kijo-bonsai/releases/download/blender-assets-v1/placeholder.png';` — single-quoted string literal, no template literal, no STORAGE_BASE reference.

✓ **`nft-image/index.ts` lines 15–17 updated, no "renders bucket" mention** — observed: line 15 says "hosted on GitHub Releases (blender-assets-v1 tag)", line 16 cites "50 MB per-file upload limit", line 17 says "Upload via scripts/upload-blender-assets.sh". Zero mentions of "renders bucket" or "Upload it to Supabase Storage" in the comment block.

✓ **`upload-blender-assets.sh` PLACEHOLDER_PNG variable** — observed: line 25 `PLACEHOLDER_PNG="${ASSET_DIR}/images/placeholder.png"`.

✓ **`upload-blender-assets.sh` preflight check** — observed: lines 66–69 check `[ ! -f "$PLACEHOLDER_PNG" ]` and `exit 1` if missing.

✓ **`upload-blender-assets.sh` UPLOAD_FILES array includes placeholder** — observed: line 82 `UPLOAD_FILES=("$BLEND_FILE" "$TEXTURES_ZIP" "$PLACEHOLDER_PNG")` — unconditional (not inside the optional POT_GLB conditional block).

✓ **`upload-blender-assets.sh` download URLs output includes placeholder** — observed: line 132 `echo "  placeholder.png:     ${BASE_URL}/placeholder.png"`.

✓ **`DECISIONS.md` 2026-08-25 section exists above 2026-08-23** — observed: `## 2026-08-25` at line 224, `## 2026-08-23` at line 228. Correct chronological ordering.

✓ **`DECISIONS.md` 2026-08-25 entry references 2026-08-22 precedent** — observed: entry text says "Per the existing GitHub Releases pivot (2026-08-22)" and cites "50 MB per-file upload limit" — matches the 2026-08-22 entry rationale (same tag `blender-assets-v1`, same free-tier constraint).

✓ **`DECISIONS.md` 2026-08-25 entry documents departure from arch doc** — observed: NFT-METADATA-IMAGE-ARCH.md line 34 specifies placeholder at `/renders/placeholder.png` in Supabase Storage. The DECISIONS.md entry explicitly states the pivot away from this: "PLACEHOLDER_URL updated from `${STORAGE_BASE}/placeholder.png` to the GitHub Release download URL."

---

## INTENT CHECK

```
code does:     PLACEHOLDER_URL points to GitHub Releases URL; nft-image 302-redirects
               to this URL when no render exists for the requested tokenId.
check expects: N/A — no automated tests for this endpoint (manual verification only).
spec says:     NFT-METADATA-IMAGE-ARCH.md line 34 specifies /renders/placeholder.png
               in Supabase Storage. DECISIONS.md 2026-08-25 documents the deliberate
               departure, citing Supabase free-tier 50 MB limit and the 2026-08-22
               GitHub Releases precedent.
verdict:       ALIGNED (spec departure documented and justified per existing precedent)
```

---

## SCOPE

**Claimed:** Only 3 files modified (`nft-image/index.ts`, `scripts/upload-blender-assets.sh`, `DECISIONS.md`).

**Observed via `git diff --name-only HEAD`:** Only `DECISIONS.md` and `apps/server/supabase/functions/nft-image/index.ts` appear in tracked diff. `scripts/upload-blender-assets.sh` is under `?? scripts/` (entire directory untracked) — cannot diff against HEAD, but file content matches spec.

**Other modified files in `git status`:** `STATE.md`, `apps/render-worker/Dockerfile`, `apps/server/supabase/functions/_shared/build-edge.sh`, `apps/server/supabase/functions/_shared/kijo-engine.js`, `apps/server/supabase/functions/nft-metadata/index.ts`, `kijo/docs/research/HOLOGRAM-BONSAI-PARTNERSHIP-2026-08-03.md` — these are all pre-existing uncommitted changes from prior pipeline passes (not attributable to this task based on content inspection).

**Scope assessment:** Clean — no undisclosed modifications from this task.

---

## FRAUDS HUNTED

- **weakened tests:** none — no test files exist for `nft-image` endpoint; no tests were weakened or removed.
- **false completion:** none — all claimed changes observed on disk exactly as described.
- **intent inversion:** none — code, spec departure, and DECISIONS.md entry are all aligned. The pivot is documented and justified.
- **phantom evidence:** none — every file path cited in the implementer report corresponds to actual content on disk. Minor: implementer cited "Lines 23–25" for PLACEHOLDER_URL but it is at lines 22–24 on disk (off-by-one). Content is correct. Not phantom evidence.

---

## KIJO-SPECIFIC CHECKS

- **DECISIONS.md sync:** ✓ — 2026-08-25 entry present, consistent with 2026-08-22 precedent.
- **STATE.md update:** ✗ — STATE.md last-updated line reads "2026-08-23". It was NOT updated for this 2026-08-25 task. **CAVEAT-A.**

---

## CAVEATS

**CAVEAT-A — STATE.md not updated:** STATE.md `Last updated` line still reads `2026-08-23`. Per Kijo pipeline discipline, STATE.md should be updated on task completion to reflect the current state. The implementer report does not mention STATE.md as a file that was or should be modified.

---

## BOTTOM LINE

All three file changes are correct and match spec exactly. The placeholder pivot is properly documented in DECISIONS.md with the right rationale and precedent reference. One caveat: STATE.md was not updated for this task.
