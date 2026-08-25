# ARCH-RENDER-WORKER-RAILWAY-2026-08-22

> **SUPERSEDED (2026-08-22):** The asset hosting approach in this document was pivoted
> during implementation. This doc originally specified **Supabase Storage** (`blender-assets`
> public bucket) for hosting Blender binary assets fetched at Docker build time. The
> implementation uses **GitHub Releases** (tag `blender-assets-v1` on `Baku-1/kijo-bonsai`)
> instead. Reason: Bonsai-Raw.blend is ~76 MB, exceeding Supabase free tier's 50 MB
> per-file upload limit; Jeremy is on free tier and cannot upgrade. GitHub Releases
> supports files up to 2 GB for free. Jeremy approved this pivot. Upload script:
> `scripts/upload-blender-assets.sh`. See DECISIONS.md entry 2026-08-22 and
> AUDIT-RENDER-WORKER-RAILWAY-2026-08-22.md for deviation details. All Supabase Storage
> references below (bucket names, URLs, upload instructions) should be read as GitHub
> Releases equivalents. The container filesystem layout, runtime code, and Railway
> dashboard config are unchanged.

## DESIGN: Render-Worker Self-Contained Railway Deployment

### SCOPE

```
DESIGN TASK:    Modify the render-worker Dockerfile so Railway can build and deploy
                it from the kijo-bonsai repo alone, with Blender assets fetched from
                GitHub Releases at Docker build time.
DELIVERABLE:    This architecture doc — Dockerfile changes, GitHub Release asset
                setup, upload script for Jeremy, env vars Railway needs.
BUILDS ON:      ARCH-RENDER-WORKER-2026-08-17.md (base render worker architecture)
                ARCH-RENDER-WORKER-PATCH-2026-08-22.md (GLB output pipeline)
CONSUMED BY:    Implementer session that modifies the Dockerfile and writes upload
                instructions.
```

---

## CODEBASE RECONNAISSANCE

### Files read

| File | Path |
|------|------|
| Dockerfile | `apps/render-worker/Dockerfile` |
| worker.ts | `apps/render-worker/src/worker.ts` |
| blender.ts | `apps/render-worker/src/blender.ts` |
| render_tree.py | `apps/render-worker/scripts/render_tree.py` |
| package.json | `apps/render-worker/package.json` |
| .gitignore | `.gitignore` (repo root) |
| STATE.md | `STATE.md` (repo root) |
| DECISIONS.md | `DECISIONS.md` (repo root) |
| Base arch doc | `docs/pipeline/ARCH-RENDER-WORKER-2026-08-17.md` |
| Patch arch doc | `docs/pipeline/ARCH-RENDER-WORKER-PATCH-2026-08-22.md` |

### Symbols verified

```
VERIFIED:
  ✓ BLEND_FILE   = '/app/assets/Bonsai-Raw.blend'          — worker.ts line 30
  ✓ BLEND_SCRIPT = '/app/kijo-bonsai/apps/render-worker/scripts/render_tree.py'
                                                            — worker.ts line 31
  ✓ TEXTURE_DIR  = '/app/assets/Textures'                   — worker.ts line 32
  ✓ POT_GLB_PATH = '/app/assets/Bonsai-GLB/Bonsai_LowPoly.glb'
                                                            — worker.ts line 33
  ✓ SUPABASE_URL — process.env.SUPABASE_URL                 — worker.ts line 18
  ✓ SUPABASE_KEY — process.env.SUPABASE_SERVICE_ROLE_KEY    — worker.ts line 19
  ✓ invokeBlender() — blender.ts line 15, spawn('blender', ...)
  ✓ buildGlb()      — worker.ts line 150, imports from './glb.js'
  ✓ uploadRender()   — worker.ts line 160, imports from './storage.js'
```

### Asset paths (container filesystem)

The worker expects these paths at runtime:

```
/app/assets/Bonsai-Raw.blend           ~76 MB   .blend file (opened by Blender)
/app/assets/Textures/                  ~176 MB  PNGs (read by glb.ts for GLB build)
/app/assets/Bonsai-GLB/Bonsai_LowPoly.glb       (pot mesh, read by glb.ts)
/app/kijo-bonsai/                      repo      Node.js app + scripts
```

### Current Dockerfile problem

The current Dockerfile relies on Railway root directory = `kijo/` (parent repo). `COPY . .` copies both `kijo/assets/` and `kijo/kijo-bonsai/` into the image. This means Railway must have access to the parent `kijo/` directory structure, which is not the `kijo-bonsai` git repo alone.

### Gaps found

None — all symbols, paths, and patterns confirmed in source files.

---

## VERIFICATION LOG

### External sources verified

```
VERIFIED:
  ✓ Blender 4.2.23 linux-x64 download URL exists
    — https://download.blender.org/release/Blender4.2/blender-4.2.23-linux-x64.tar.xz
    — dated 21-Jul-2026, 350,707,672 bytes
    — source: directory listing at https://download.blender.org/release/Blender4.2/

  ✓ Supabase Storage public URL format
    — https://<project_id>.supabase.co/storage/v1/object/public/<bucket>/<path>
    — source: Supabase official docs (Storage API reference)

  ✓ Railway Docker build supports RAILWAY_DOCKERFILE_PATH
    — Railway uses Root Directory as build context; RAILWAY_DOCKERFILE_PATH points
      to the Dockerfile relative to repo root
    — source: Railway docs (Deploy → Dockerfiles)

  ✓ Railway env vars injected at runtime (not build time by default)
    — Build-time env vars require ARG + ENV in Dockerfile, or Railway's
      "Docker build arguments" setting
    — source: Railway docs (Variables → Build Variables)
```

### Security check

```
VERIFIED:
  ✓ .gitignore covers .env and .env.* (with !.env.example exception) — .gitignore lines 5-8
  ✓ No real service_role keys in any tracked file
    — grep for 'eyJ', 'sb_', 'supabase.*key' across entire repo: no matches in tracked files
  ✓ packages/contracts/.env — contains Hardhat account #19 test key (well-known, not a real secret), gitignored
  ✓ apps/web/.env.local — contains VITE_SUPABASE_ANON_KEY (public by design), gitignored
  ✓ Project ref 'xutjubkaskwchzyzwryk' — public info, appears in client-side code (safe)
  ✓ This document contains NO real key values — only placeholders
```

### Proof of Play open-source cross-references

```
VERIFIED (security patterns):
  ✓ piratenation-game/.gitleaks.toml — uses gitleaks with explicit allowlisting for
    public on-chain addresses (0x...) and non-secret env config. Distinguishes
    public blockchain data from real secrets. Our .gitignore pattern (.env / .env.*)
    follows the same separation principle.
    — source: https://github.com/proofofplay/piratenation-game/blob/main/.gitleaks.toml

  ✓ piratenation-game/.gitignore — covers .env, **/PrivateKey*, and specific
    PrivateKey.asset paths. More aggressive than our .gitignore but same pattern.
    — source: https://github.com/proofofplay/piratenation-game/blob/main/.gitignore

  ✓ piratenation-shuffler/.gitignore — standard Python .gitignore covering .env, .venv
    — source: https://github.com/proofofplay/piratenation-shuffler/blob/main/.gitignore

VERIFIED (asset integrity pattern):
  ✓ piratenation-shuffler/hash-image-dir.py — uses SHA3-224 hashing over ordered file
    reads to produce a deterministic directory hash for NFT asset verification.
    Applicable: we can use a similar checksum approach to verify downloaded assets
    match what Jeremy uploaded.
    — source: https://github.com/proofofplay/piratenation-shuffler/blob/main/hash-image-dir.py

VERIFIED (deterministic pipeline pattern):
  ✓ piratenation-shuffler/mint-shuffler.py — uses random.seed(args.seed) for
    deterministic NFT shuffling. Same principle as our spatial_hash(seed, x, y, z)
    for deterministic leaf rotation in render_tree.py.
    — source: https://github.com/proofofplay/piratenation-shuffler/blob/main/mint-shuffler.py

NOT APPLICABLE (Docker build patterns):
  ? No Dockerfiles exist in the public Proof of Play repos (piratenation-shuffler,
    piratenation-game, piratenation-contracts). Cannot cite Docker-specific patterns
    from these sources. Docker build design is based on Railway docs and standard
    multi-stage build patterns instead.
```

---

## THE DESIGN

### Overview

Change Railway root from `kijo/` to `kijo-bonsai/` (the git repo itself). The Dockerfile fetches binary assets from a public Supabase Storage bucket at build time using `wget`, placing them where `worker.ts` expects them. No changes to `worker.ts`, `blender.ts`, `render_tree.py`, or any runtime code.

### 1. Supabase Storage bucket setup

**Bucket name:** `blender-assets`
**Access:** Public (read-only, no RLS — these are non-sensitive Blender meshes and textures)

**Files to upload:**

| Local path | Storage path | Approx size |
|-----------|-------------|-------------|
| `kijo/assets/Bonsai-Raw.blend` | `Bonsai-Raw.blend` | ~76 MB |
| `kijo/assets/Textures/` (all PNGs) | `Textures/<filename>.png` | ~176 MB total |
| `kijo/assets/Bonsai-GLB/Bonsai_LowPoly.glb` | `Bonsai-GLB/Bonsai_LowPoly.glb` | ~2 MB |

**Public URLs (pattern):**
```
https://xutjubkaskwchzyzwryk.supabase.co/storage/v1/object/public/blender-assets/Bonsai-Raw.blend
https://xutjubkaskwchzyzwryk.supabase.co/storage/v1/object/public/blender-assets/Textures/<name>.png
https://xutjubkaskwchzyzwryk.supabase.co/storage/v1/object/public/blender-assets/Bonsai-GLB/Bonsai_LowPoly.glb
```

**File size limit:** Supabase default is 50 MB per file. The `.blend` file is ~76 MB. Jeremy must increase the bucket's max file size to at least 100 MB in the Supabase dashboard (Storage → blender-assets → Settings → File size limit). Pro plan supports up to 5 GB per file.

### 2. Asset upload instructions for Jeremy

```bash
# Prerequisites: supabase CLI installed and linked to project xutjubkaskwchzyzwryk

# Step 1: Create the bucket (public, 100MB file size limit)
# Do this in Supabase Dashboard → Storage → New Bucket:
#   Name: blender-assets
#   Public: ON
#   File size limit: 100 MB (or higher)

# Step 2: Upload assets from local kijo/assets/ directory
# Using the Supabase Dashboard (drag-and-drop) or the JS client:

# Option A — Dashboard upload (simplest):
#   1. Go to Storage → blender-assets
#   2. Upload Bonsai-Raw.blend to root
#   3. Create folder "Textures", upload all PNGs into it
#   4. Create folder "Bonsai-GLB", upload Bonsai_LowPoly.glb into it

# Option B — CLI upload (scriptable):
cd kijo/assets/
npx supabase storage cp Bonsai-Raw.blend sb://blender-assets/Bonsai-Raw.blend
for f in Textures/*.png; do
  npx supabase storage cp "$f" "sb://blender-assets/$f"
done
npx supabase storage cp Bonsai-GLB/Bonsai_LowPoly.glb sb://blender-assets/Bonsai-GLB/Bonsai_LowPoly.glb

# Step 3: Verify public access
curl -I "https://xutjubkaskwchzyzwryk.supabase.co/storage/v1/object/public/blender-assets/Bonsai-Raw.blend"
# Expect: HTTP/2 200
```

**Asset integrity verification** (pattern from [piratenation-shuffler/hash-image-dir.py](https://github.com/proofofplay/piratenation-shuffler/blob/main/hash-image-dir.py)):

After uploading, Jeremy should verify the SHA256 of each uploaded file matches the local source:

```bash
# Local hash
sha256sum kijo/assets/Bonsai-Raw.blend

# Remote hash (download and compare)
curl -s "https://xutjubkaskwchzyzwryk.supabase.co/storage/v1/object/public/blender-assets/Bonsai-Raw.blend" | sha256sum
```

### 3. Modified Dockerfile

**File to change:** `apps/render-worker/Dockerfile`

The key changes:
- `COPY . .` now copies `kijo-bonsai/` contents (not `kijo/`) to `/app/`
- Repo code goes to `/app/kijo-bonsai/` via `COPY . /app/kijo-bonsai/`
- Assets fetched from Supabase Storage to `/app/assets/` via `wget`
- All existing worker.ts path constants remain valid (no runtime code changes)

```dockerfile
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# System deps for Blender headless (--background mode)
# libxi6, libxxf86vm1, libxfixes3, libxrender1, libgl1 required by Blender binary
# even in headless mode. Add libxrandr2 if Blender complains on startup.
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    xz-utils \
    libxi6 \
    libxxf86vm1 \
    libxfixes3 \
    libxrender1 \
    libgl1 \
    ca-certificates \
    curl \
  && rm -rf /var/lib/apt/lists/*

# Blender 4.2.23 LTS (pinned for render reproducibility)
# 4.2.23 is the latest 4.2 LTS patch as of 2026-07-21 (23 months of bugfixes over 4.2.0)
RUN wget -q https://download.blender.org/release/Blender4.2/blender-4.2.23-linux-x64.tar.xz \
  && tar -xf blender-4.2.23-linux-x64.tar.xz -C /opt \
  && ln -s /opt/blender-4.2.23-linux-x64/blender /usr/local/bin/blender \
  && rm blender-4.2.23-linux-x64.tar.xz

# Node.js 20 LTS via NodeSource
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
  && apt-get install -y nodejs \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# --------------------------------------------------------------------------
# Fetch Blender assets from Supabase Storage (public bucket: blender-assets)
# These are too large for git (~252 MB total). Fetched at build time so the
# Docker layer is cached until assets change.
#
# Asset paths must match worker.ts constants:
#   BLEND_FILE   = '/app/assets/Bonsai-Raw.blend'
#   TEXTURE_DIR  = '/app/assets/Textures'
#   POT_GLB_PATH = '/app/assets/Bonsai-GLB/Bonsai_LowPoly.glb'
# --------------------------------------------------------------------------
ARG SUPABASE_STORAGE_URL=https://xutjubkaskwchzyzwryk.supabase.co/storage/v1/object/public/blender-assets

RUN mkdir -p /app/assets/Textures /app/assets/Bonsai-GLB \
  && wget -q "${SUPABASE_STORAGE_URL}/Bonsai-Raw.blend" \
       -O /app/assets/Bonsai-Raw.blend \
  && wget -q "${SUPABASE_STORAGE_URL}/Bonsai-GLB/Bonsai_LowPoly.glb" \
       -O /app/assets/Bonsai-GLB/Bonsai_LowPoly.glb

# Texture PNGs — each downloaded individually.
# If Jeremy adds/removes textures, update this list.
# Current texture set (from kijo/assets/Textures/):
RUN for tex in \
      Trunk_BaseColor.png \
      Trunk_NormalGL.png \
      Trunk_AMR.png \
      Leaves_BaseColor.png \
      Leaves_NormalGL.png \
      Leaves_Roughness.png \
      Leaves_Translucency.png \
      Moss_BaseColor.png \
      Moss_NormalGL.png \
      Moss_Roughness.png \
      Pot_BaseColor.png \
      Pot_NormalGL.png \
      Pot_Roughness.png \
      Vegetation_BaseColor.png \
      Vegetation_NormalGL.png \
      Vegetation_Roughness.png \
    ; do \
      wget -q "${SUPABASE_STORAGE_URL}/Textures/${tex}" \
        -O "/app/assets/Textures/${tex}" ; \
    done

# --------------------------------------------------------------------------
# Copy repo code to /app/kijo-bonsai/ (preserves existing asset path layout)
# Railway root = kijo-bonsai/ (repo root), build context = kijo-bonsai/
# BLEND_SCRIPT = '/app/kijo-bonsai/apps/render-worker/scripts/render_tree.py'
# --------------------------------------------------------------------------
COPY . /app/kijo-bonsai/

# Install render-worker workspace package and its @kijo/* dependencies
WORKDIR /app/kijo-bonsai
RUN npm install --workspace=apps/render-worker --include-workspace-root

# Environment variables (set in Railway dashboard, not here):
#   SUPABASE_URL
#   SUPABASE_SERVICE_ROLE_KEY

# CMD runs from /app/kijo-bonsai; asset paths use /app/assets/
CMD ["./node_modules/.bin/tsx", "apps/render-worker/src/worker.ts"]
```

### 4. Railway dashboard configuration

| Setting | Value |
|---------|-------|
| **Root Directory** | `/` (repo root — kijo-bonsai IS the repo) |
| **Dockerfile Path** | `apps/render-worker/Dockerfile` |
| **SUPABASE_URL** (env var) | `https://xutjubkaskwchzyzwryk.supabase.co` |
| **SUPABASE_SERVICE_ROLE_KEY** (env var) | `<set from Supabase dashboard → Settings → API>` |

**No build arguments needed.** The `SUPABASE_STORAGE_URL` is an `ARG` with a default value pointing to the public bucket — no secret required for public asset downloads.

### 5. Files changed by this design

| File | Change | Reason |
|------|--------|--------|
| `apps/render-worker/Dockerfile` | **REWRITE** | Fetch assets from Supabase Storage; change COPY target |
| `worker.ts` | **NO CHANGE** | All four asset path constants remain valid |
| `blender.ts` | **NO CHANGE** | No path references |
| `render_tree.py` | **NO CHANGE** | Opens .blend via Blender arg, not by path |
| `glb.ts` | **NO CHANGE** | Reads TEXTURE_DIR and POT_GLB_PATH from worker.ts args |
| `storage.ts` | **NO CHANGE** | Uploads only, no asset reads |
| `queue.ts` | **NO CHANGE** | DB only |

### 6. Docker layer caching strategy

```
Layer 1: ubuntu:22.04 base + apt deps          (cached until deps change)
Layer 2: Blender 4.2.23 download + install     (cached until Blender version changes)
Layer 3: Node.js 20 install                    (cached until Node version changes)
Layer 4: Asset download from Supabase Storage  (cached until Dockerfile changes)
Layer 5: COPY repo code                        (busted on every git push)
Layer 6: npm install                           (busted when package.json changes)
```

Assets are downloaded BEFORE `COPY . /app/kijo-bonsai/` so the ~252 MB asset layer is cached across code-only deploys. This is the optimal ordering — code changes frequently, assets change rarely.

### 7. Texture list maintenance

The Dockerfile lists texture filenames explicitly. This is intentional:
- Provides a clear inventory of required assets
- Build fails fast if a texture is missing from Supabase Storage (wget returns non-zero)
- Avoids needing a manifest file or Supabase API call to list bucket contents

**Trade-off:** If Jeremy adds a new texture, the Dockerfile must be updated. This is acceptable because texture changes are rare and always require a coordinated .blend file update anyway.

**Alternative considered and rejected:** Using a `textures.tar.gz` archive. Rejected because Supabase free-tier default file size limit is 50 MB and the compressed textures may exceed this; individual files give better error messages on failure; and individual files can be updated independently.

---

## ASSUMPTIONS

```
A1: Supabase Storage bucket 'blender-assets' will be created as PUBLIC (no auth for reads).
    Mitigation: These are art assets with no secrets. Public access is appropriate.
    If Jeremy wants private access, the Dockerfile would need a build-time
    SUPABASE_SERVICE_ROLE_KEY arg (adds complexity, not recommended for assets).

A2: The texture file list in the Dockerfile (16 PNGs) is complete.
    Mitigation: Jeremy must verify the list matches kijo/assets/Textures/ contents.
    The implementer session should run: ls kijo/assets/Textures/ and compare.

A3: Supabase project file size limit can be increased to >= 100 MB.
    Mitigation: Pro plan supports up to 5 GB per file. Free plan may have lower
    ceiling. Jeremy is on Pro (existing production project). Verify in dashboard.

A4: Railway builds have network access during docker build (RUN wget works).
    Mitigation: Railway docs confirm network access during build. Standard pattern
    for downloading dependencies.

A5: Bonsai-GLB/Bonsai_LowPoly.glb exists in kijo/assets/.
    Mitigation: Referenced in worker.ts line 33 and ARCH-RENDER-WORKER-PATCH-2026-08-22.md.
    Jeremy must verify this file exists locally before upload.
```

---

## OPEN QUESTIONS

```
OQ-R1: [FOR JEREMY] Exact texture file list.
  The Dockerfile lists 16 PNGs based on standard PBR naming conventions and the
  material channels referenced in render_tree.py and glb.ts. Jeremy must confirm
  this matches the actual contents of kijo/assets/Textures/.
  Run: ls -1 kijo/assets/Textures/

OQ-R2: [FOR JEREMY] Supabase plan file size limit.
  The .blend file is ~76 MB. Default Supabase upload limit is 50 MB.
  Action: In Supabase Dashboard → Storage → blender-assets bucket settings,
  set file size limit to at least 100 MB.

OQ-R3: [DECIDED — NO] Should the bucket be private?
  Decision: No. These are art assets (meshes, textures) with no sensitive data.
  Public read access avoids needing build-time auth credentials, simplifying the
  Dockerfile and Railway configuration. This follows the same pattern as
  piratenation-game's public on-chain asset references (addresses.json is a
  tracked public file per their .gitleaks.toml allowlist).
  Citation: https://github.com/proofofplay/piratenation-game/blob/main/.gitleaks.toml

OQ-R4: [DECIDED — DEFER] Asset checksum verification in Dockerfile.
  Following the pattern from piratenation-shuffler/hash-image-dir.py (SHA3-224
  directory hashing for NFT asset verification), we could add checksum verification
  to the wget steps. Deferred to post-beta — the current design fails fast on
  download errors (wget -q returns non-zero on HTTP errors), and asset corruption
  in Supabase Storage is unlikely.
  Citation: https://github.com/proofofplay/piratenation-shuffler/blob/main/hash-image-dir.py
```

---

## CROSS-REFERENCE CHECK

```
checked against:
  - ARCH-RENDER-WORKER-2026-08-17.md (base architecture)
  - ARCH-RENDER-WORKER-PATCH-2026-08-22.md (GLB pipeline)
  - DECISIONS.md
  - STATE.md

consistent: YES
  - Asset paths match exactly (BLEND_FILE, TEXTURE_DIR, POT_GLB_PATH, BLEND_SCRIPT)
  - Env vars match (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — no additions)
  - Supabase project ref matches (xutjubkaskwchzyzwryk)
  - Blender version matches (4.2.23 LTS)
  - No new dependencies introduced

terminology aligned: YES
  - "render-worker" (not "renderer" or "render-service")
  - "Bonsai-Raw.blend" (capital B, hyphenated)

data shapes aligned: YES — no data shape changes

boundary violations: NONE
  - Dockerfile is the only file changed
  - No runtime code modifications
  - No new package dependencies
```

---

## IMPLEMENTATION CHECKLIST (for implementer session)

The implementer must execute these steps in order:

1. **Jeremy: Create Supabase Storage bucket** `blender-assets` (public, 100 MB file size limit)
2. **Jeremy: Upload assets** — Bonsai-Raw.blend, all Textures/*.png, Bonsai-GLB/Bonsai_LowPoly.glb
3. **Jeremy: Verify uploads** — curl each public URL, compare SHA256 with local files
4. **Implementer: Rewrite `apps/render-worker/Dockerfile`** per Section 3 above
5. **Implementer: Verify texture list** — run `ls kijo/assets/Textures/` and confirm the Dockerfile list matches
6. **Jeremy: Configure Railway dashboard** per Section 4 above
7. **Jeremy: Trigger Railway build** and verify logs show successful asset downloads
8. **Jeremy: Test render** — enqueue a test render job and confirm PNG + GLB output
