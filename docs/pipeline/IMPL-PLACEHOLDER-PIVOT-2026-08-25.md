# IMPL-PLACEHOLDER-PIVOT-2026-08-25

**Task:** Pivot `placeholder.png` from Supabase Storage to GitHub Releases.

## Changes Made

### 1. `apps/server/supabase/functions/nft-image/index.ts`

- **Lines 15–18 (comment block):** Updated to reflect that placeholder.png is hosted on GitHub Releases, not Supabase Storage. Removed instructions about uploading to the renders bucket.
- **Lines 23–25 (PLACEHOLDER_URL):** Changed from `` `${STORAGE_BASE}/placeholder.png` `` to the literal GitHub Releases URL: `https://github.com/Baku-1/kijo-bonsai/releases/download/blender-assets-v1/placeholder.png`.

### 2. `scripts/upload-blender-assets.sh`

- **Config section:** Added `PLACEHOLDER_PNG="${ASSET_DIR}/images/placeholder.png"` variable.
- **Preflight checks:** Added existence check for `$PLACEHOLDER_PNG` (exits 1 if missing).
- **Upload files array:** Added `"$PLACEHOLDER_PNG"` to `UPLOAD_FILES` array (unconditional — placeholder is required, not optional like `POT_GLB`).
- **Download URLs output:** Added `placeholder.png` line to the printed URL list.

### 3. `DECISIONS.md`

- Added `## 2026-08-25` section above `## 2026-08-23` with the placeholder.png pivot entry, referencing the 2026-08-22 GitHub Releases precedent and the Supabase free-tier 50 MB limit.

## Files NOT touched

No other files were modified. No new files were created (except this report).

## Verification checklist for auditor

- [ ] `nft-image/index.ts` line 25: PLACEHOLDER_URL is the literal GitHub Releases URL (no template literal, no STORAGE_BASE reference)
- [ ] `nft-image/index.ts` lines 15–18: no mention of "renders bucket" or "Upload it to Supabase Storage"
- [ ] `upload-blender-assets.sh`: `PLACEHOLDER_PNG` variable defined, preflight check present, included in `UPLOAD_FILES` array, printed in download URLs
- [ ] `DECISIONS.md`: 2026-08-25 section exists above 2026-08-23, entry text matches spec
