# AUDIT-RENDER-WORKER-RAILWAY-2026-08-22

## ADVERSARIAL AUDITOR REPORT

**Date:** 2026-08-22
**Scope:** GitHub Release asset deployment (upload script + Dockerfile rewrite)
**Files audited:** `scripts/upload-blender-assets.sh`, `apps/render-worker/Dockerfile`

---

## VERDICT: CAVEATS

Jeremy sign-off required on one architectural deviation before this can be accepted.

---

## CLAIMS CHECKED

| # | Claim | Result | Evidence |
|---|-------|--------|----------|
| C1 | upload-blender-assets.sh creates a GitHub Release and uploads 3 files | **TRUE** | Read full file (129 lines). Script creates release tag `blender-assets-v1` on `Baku-1/kijo-bonsai`, uploads Bonsai-Raw.blend, Textures.zip, and Bonsai_LowPoly.glb (conditional). Uses `gh release create` / `gh release upload --clobber`. Preflight checks for gh, zip, file existence all present. |
| C2 | Dockerfile wget's assets from GitHub Release URLs before COPY | **TRUE** | Read full file (76 lines). Lines 47-53: wget Bonsai-Raw.blend + Textures.zip from `https://github.com/Baku-1/kijo-bonsai/releases/download/${ASSET_TAG}/...`, unzip textures to `/app/assets/`. Lines 56-58: separate RUN for pot mesh (non-fatal). Line 65: `COPY . /app/kijo-bonsai/` comes AFTER asset downloads. Layer caching is correct -- asset layer cached across code pushes. |
| C3 | Carmack review caught `\|\|` operator precedence bug, fixed by separate RUN | **TRUE** | Dockerfile line 56-58: pot mesh wget is in its own `RUN` with `\|\| echo "WARNING..."`. If this had been inside the main `RUN ... && wget ... \|\| echo ...` chain, the `\|\|` would have masked the wget failure (echo returns 0, so `&&` chain continues). Splitting into a separate RUN isolates the non-fatal behavior cleanly. |
| C4 | tsc --noEmit passed clean | **TRUE** | Re-ran `npx tsc --noEmit --project apps/render-worker/tsconfig.json`. EXIT:0. No output except npm version notice. |
| C5 | Asset paths match worker.ts lines 30-33 | **TRUE** | worker.ts line 30: `BLEND_FILE = '/app/assets/Bonsai-Raw.blend'` -- Dockerfile produces this at line 48-49. worker.ts line 32: `TEXTURE_DIR = '/app/assets/Textures'` -- Dockerfile unzips `Textures.zip -d /app/assets/` which creates `/app/assets/Textures/` (zip was created with `cd "$ASSET_DIR" && zip -r ... Textures/`). worker.ts line 33: `POT_GLB_PATH = '/app/assets/Bonsai-GLB/Bonsai_LowPoly.glb'` -- Dockerfile line 47 `mkdir -p /app/assets/Bonsai-GLB`, line 56-57 wget to that path. All four paths verified. |

---

## INTENT CHECK

### Architect spec vs Implementation vs worker.ts

| Aspect | Architect (ARCH-RENDER-WORKER-RAILWAY-2026-08-22.md) | Implementation (actual files) | worker.ts expectation | Match? |
|--------|------|------|------|------|
| Asset source | Supabase Storage public bucket `blender-assets` | GitHub Releases tag `blender-assets-v1` | N/A (reads from local paths) | **DEVIATION** |
| Upload mechanism | Supabase CLI / Dashboard upload | `gh` CLI via upload-blender-assets.sh | N/A | **DEVIATION** |
| Download URL pattern | `https://xutjubkaskwchzyzwryk.supabase.co/storage/v1/object/public/blender-assets/...` | `https://github.com/Baku-1/kijo-bonsai/releases/download/blender-assets-v1/...` | N/A | **DEVIATION** |
| Texture download strategy | 16 individual wget calls, one per PNG | Zip all textures into Textures.zip, single wget + unzip | N/A | **DEVIATION** |
| Blend file path | `/app/assets/Bonsai-Raw.blend` | `/app/assets/Bonsai-Raw.blend` | Line 30: `/app/assets/Bonsai-Raw.blend` | MATCH |
| Texture dir path | `/app/assets/Textures/` | `/app/assets/Textures/` (via unzip) | Line 32: `/app/assets/Textures` | MATCH |
| Pot GLB path | `/app/assets/Bonsai-GLB/Bonsai_LowPoly.glb` | `/app/assets/Bonsai-GLB/Bonsai_LowPoly.glb` | Line 33: `/app/assets/Bonsai-GLB/Bonsai_LowPoly.glb` | MATCH |
| COPY target | `COPY . /app/kijo-bonsai/` | `COPY . /app/kijo-bonsai/` | Line 31: `/app/kijo-bonsai/apps/render-worker/scripts/render_tree.py` | MATCH |
| Railway root | `/` (repo root) | `/` (repo root) | N/A | MATCH |
| CMD | `./node_modules/.bin/tsx apps/render-worker/src/worker.ts` | `./node_modules/.bin/tsx apps/render-worker/src/worker.ts` | N/A | MATCH |
| Pot mesh failure mode | Not specified | Non-fatal (`\|\| echo WARNING`) in separate RUN | try/catch around GLB build (line 149-174) | MATCH |
| `unzip` package | Not in arch spec (no zip used) | Added to apt-get install | N/A | NEW (required by implementation) |

### Deviation summary

The architect specified **Supabase Storage** as the asset hosting backend. The implementer used **GitHub Releases** instead. This affects:

1. **Storage backend**: GitHub Releases vs Supabase Storage bucket
2. **Upload tooling**: `gh` CLI vs `supabase storage cp` / Dashboard
3. **Texture packaging**: single zip vs 16 individual files
4. **Dockerfile build arg**: `ASSET_TAG` (release tag) vs `SUPABASE_STORAGE_URL`
5. **Dependencies**: adds `unzip` to apt-get, `zip` to upload prerequisites

The deviation does NOT affect:
- Container filesystem layout (all four asset paths match worker.ts)
- Runtime behavior (worker.ts unchanged)
- Railway dashboard config (same env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
- Docker layer caching strategy (assets before COPY, same benefit)

**No DECISIONS.md entry documents this change.** This is a process violation per SESSION-START.md pipeline rules.

### Functional assessment of the deviation

The GitHub Releases approach has some practical advantages over the architect's Supabase Storage approach:

- No Supabase file size limit issue (the arch doc flagged OQ-R2: .blend is 76 MB, default limit is 50 MB)
- No bucket creation/configuration required
- No Supabase plan dependency for asset storage
- Textures as a single zip reduces download count from 16 to 1
- GitHub Releases are immutable per tag (integrity guarantee)

However, the architect explicitly considered and documented the Supabase approach with rationale. Changing the backend without updating the arch doc or DECISIONS.md breaks the pipeline's traceability guarantee.

---

## SCOPE

| What | Expected | Observed | Match? |
|------|----------|----------|--------|
| Modified tracked files | Dockerfile | Dockerfile (31 insertions, 5 deletions) | MATCH |
| New untracked files | upload-blender-assets.sh | `scripts/upload-blender-assets.sh` (129 lines) + `docs/pipeline/ARCH-RENDER-WORKER-RAILWAY-2026-08-22.md` | MATCH (arch doc expected) |
| Test files changed | 0 | 0 | MATCH |
| Runtime code changed | 0 | 0 | MATCH |

`git status` confirms: 1 modified file (Dockerfile), 2 untracked paths (scripts/, docs/pipeline/ARCH-...).
`git diff --stat` confirms: `apps/render-worker/Dockerfile | 36 +++++++++++++++++++++++++++++++-----` (31 ins, 5 del).

---

## FRAUDS HUNTED

### 1. Weakened tests
**CLEAN.** `git diff --name-only HEAD -- '**/*.test.*' '**/*.spec.*'` returned empty. No test files modified or deleted.

### 2. False completion
**CLEAN.** `npx tsc --noEmit --project apps/render-worker/tsconfig.json` re-run by auditor. EXIT:0. No errors.

### 3. Intent inversion
**FOUND.** The architect's design (ARCH-RENDER-WORKER-RAILWAY-2026-08-22.md) specifies Supabase Storage as the asset backend. The implementation uses GitHub Releases. No DECISIONS.md entry documents this deviation. See INTENT CHECK above for full analysis. Functional impact: none (container paths match). Process impact: undocumented architectural deviation.

### 4. Phantom evidence
**CLEAN.** worker.ts lines 30-33 verified by direct Read. All four path constants exist at the claimed line numbers with the claimed values. The Carmack `||` fix is observable in the Dockerfile diff (pot mesh wget split to separate RUN).

---

## SECURITY CHECKS

| Check | Result |
|-------|--------|
| `.gitignore` covers `.env*` | PASS -- lines 6-8: `.env`, `.env.*`, `!.env.example` |
| No tracked `.env` with real values | PASS -- only `packages/contracts/.env.example` tracked |
| No secrets in upload script | PASS -- grep for eyJ/sb_/service_role/secret/password/api.key/token: 0 matches |
| No secrets in Dockerfile | PASS -- grep: 0 matches. Uses public GitHub Release URLs only. |
| Hardcoded repo name `Baku-1/kijo-bonsai` | INFO -- public information, not a secret. Appears in both files. |

---

## BOTTOM LINE

The two files are **functionally correct**: asset paths match worker.ts exactly, tsc is clean, no test weakening, no secrets, scope is tight. The Carmack `||` fix is real and correctly applied.

**One caveat blocks acceptance:** The implementer replaced the architect's Supabase Storage backend with GitHub Releases without a DECISIONS.md entry. The functional outcome is equivalent (possibly better — avoids the 50 MB file size limit issue the architect flagged as OQ-R2), but the pipeline requires architectural deviations to be documented.

**Required for acceptance:**
1. Jeremy confirms GitHub Releases over Supabase Storage is acceptable
2. DECISIONS.md entry added documenting the deviation and rationale

**No code changes required.** The implementation is sound; only documentation is missing.
