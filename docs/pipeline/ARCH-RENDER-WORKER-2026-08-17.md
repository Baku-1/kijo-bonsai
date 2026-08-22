# ARCH: apps/render-worker — Blender Voxel Render Pipeline

**Date:** 2026-08-17
**Stage:** Architect (verified-architect skill)
**Status:** READY FOR IMPLEMENTER
**Consumes:** NFT-METADATA-IMAGE-ARCH.md (v5), IMPL-NFT-METADATA-2026-08-17.md
**Consumed by:** Implementer

---

## DESIGN TASK

```
DESIGN TASK: Build apps/render-worker — Node.js + Blender headless render service
DELIVERABLE:  Complete implementation-ready spec; Implementer builds from this doc alone
BUILDS ON:    NFT-METADATA-IMAGE-ARCH.md v5; render_queue (already migrated); kijo-engine.js (built)
CONSUMED BY:  Implementer (disciplined-implementer skill)
```

---

## CODEBASE RECONNAISSANCE

All source files touching the render worker were read before this spec was written.

### Files Read

```
packages/engine/src/CareLogReplay.ts
packages/voxelizer/src/index.ts
packages/shared/src/index.ts
packages/engine/src/StatDeriver.ts
packages/engine/src/index.ts
packages/engine/src/TechniqueClassifier.ts   (head + classify signature grep)
apps/server/supabase/migrations/20260806000002_render_queue.sql
apps/server/supabase/migrations/20260807000001_render_queue_updated_at_trigger.sql
kijo/assets/                                 (directory listing)
kijo/assets/images/                          (directory listing)
apps/web/public/textures/                    (directory listing)
package.json (repo root)
STATE.md, DECISIONS.md, SESSION-START.md
docs/NFT-METADATA-IMAGE-ARCH.md
docs/pipeline/IMPL-NFT-METADATA-2026-08-17.md
```

### Symbols Verified

```
VERIFIED:
  CareLogReplay.reconstruct
    file: packages/engine/src/CareLogReplay.ts
    exported: yes (via packages/engine/src/index.ts)
    signature: static reconstruct(seed: number, species: SpeciesClass, careLog: CareLogEntry[], totalDays: number): BonsaiTree
    args: 4 (matches arch doc -- confirmed)
    THROWS: CareLogReplayError when totalDays <= 0, landscape entry encountered, or unknown action type
    Worker implication: must filter 'landscape' from careLog before calling reconstruct

  Voxelizer.voxelize
    file: packages/voxelizer/src/index.ts
    exported: yes
    signature: static voxelize(tree: BonsaiTree): VoxelizeResult
    return: VoxelizeResult { voxels: SparseVoxelSet, zones: Map<number,number> }
    DEVIATION FROM ARCH DOC: arch doc said returns SparseVoxelSet -- WRONG
    Use: const { voxels, zones } = Voxelizer.voxelize(bonsai);

  SparseVoxelSet.serialize()
    file: packages/voxelizer/src/index.ts (line 61)
    signature: serialize(): Array<[number, Material, VoxelRole, number]>
    tuple format: [packed_key, material, role, branchId]
    key unpacking: x = (key >>> 16) & 0xFF, y = (key >>> 8) & 0xFF, z = key & 0xFF
    sorted by key (deterministic)

  spatialHash
    file: packages/shared/src/index.ts (line 364)
    exported: yes (named export)
    signature: export function spatialHash(seed: number, x: number, y: number, z: number): number
    return: raw uint32 (NOT normalized to [0,1))
    The Python spatial_hash DIVIDES by 4294967296.0 to get [0,1) for rotation use

  StatDeriver.derive
    file: packages/engine/src/StatDeriver.ts (line 203)
    exported: yes
    signature: static derive(tree: BonsaiTree, voxels: VoxelSet, seed: number, ageDays: number, zones: Map<number,number>): StatSheet
    args: 5 (arch doc showed 4 -- WRONG; IMPL doc corrected; source VERIFIED)
    zones param: the Map<number,number> from VoxelizeResult.zones

  TechniqueClassifier.classify
    file: packages/engine/src/TechniqueClassifier.ts (line 58)
    exported: yes (via packages/engine/src/index.ts)
    signature: static classify(careLog: CareLogEntry[], treeAgeDays: number): TechniqueResult
    args: 2

  Material constants (packages/voxelizer/src/index.ts, lines 10-17):
    HEARTWOOD=1, BARK=2, BRANCH_WOOD=3, LEAF=4, ROOT=5, PRUNE_SCAR=6

  VoxelRole enum (packages/shared/src/index.ts, lines 335-343):
    TRUNK='trunk', ARM='arm', LEG='leg', DIGIT='digit', CANOPY='canopy', ROOT='root', SCAR='scar'

  CareLogReplay landscape throw (packages/engine/src/CareLogReplay.ts, lines 144-149):
    'landscape' action throws CareLogReplayError -- worker MUST filter landscape from care log

GAPS FOUND:
  kijo/assets/Bonsai-Raw.blend -- NOT FOUND in workspace snapshot
    kijo/assets/ only contains images/ (3 Godot PNG files)
    No Textures/ directory in kijo/assets/
    OQ-10 in arch doc marked CLOSED saying 76MB file is committed -- CANNOT VERIFY
    See Open Questions OQ-A and OQ-B below

  apps/render-worker/ -- does NOT exist; all files to be created

  render_queue migration -- ALREADY APPLIED (critical finding, see Section 4)
```

---

## VERIFICATION LOG

```
VERIFIED:
  Blender 4.2 LTS download URL
    Confirmed: https://download.blender.org/release/Blender4.2/blender-4.2.0-linux-x64.tar.xz EXISTS
    File size: 352,269,932 bytes (from directory listing at download.blender.org/release/Blender4.2/)
    Latest LTS patch as of 2026-08-17: 4.2.23 (released 2026-07-21)
    Architecture decision: arch doc pinned to 4.2.0; see OQ-C for pin version recommendation

  VoxelizeResult interface
    { voxels: SparseVoxelSet, zones: Map<number,number> }
    VERIFIED in packages/voxelizer/src/index.ts lines 79-82
    zones maps branchId -> zoneIndex [0-7] via float-space trilinear Value Noise

  CareLogReplay throws for landscape -- VERIFIED source line 145-149

  CareLogReplay throws for totalDays <= 0 -- VERIFIED source line 51-55
    Day-0 branch required: if totalDays <= 0, use new BonsaiTree(seed, species) directly
    (same pattern used in nft-metadata per IMPL doc)

  Python spatial_hash algorithm matches TS spatialHash -- VERIFIED step by step:
    TS:   h = (seed ^ packed) >>> 0;               Python: h = (seed ^ packed) & 0xFFFFFFFF
    TS:   h = (h += 0x6D2B79F5) >>> 0;             Python: h = (h + 0x6D2B79F5) & 0xFFFFFFFF
    TS:   h = Math.imul(h^(h>>>15), h|1) >>> 0;    Python: h = ((h^(h>>15)) * (h|1)) & 0xFFFFFFFF
    TS:   h ^= h + (Math.imul(h^(h>>>7), h|61)>>>0) Python: h = (h^(h+((h^(h>>7))*(h|61)&0xFFFFFFFF)))&0xFFFFFFFF
    TS:   return (h ^ (h >>> 14)) >>> 0;            Python: h=(h^(h>>14))&0xFFFFFFFF; return h/4294967296.0
    The /4294967296.0 normalization is CORRECT for leaf rotation (maps uint32 to [0,1))

  render_queue schema -- VERIFIED match between arch doc and actual migration:
    Migration 20260806000002_render_queue.sql matches NFT-METADATA-IMAGE-ARCH.md schema exactly
    Trigger 20260807000001_render_queue_updated_at_trigger.sql applied

  Node.js installation in arch doc Dockerfile -- REFUTED:
    apt-get install -y nodejs npm on Ubuntu 22.04 installs Node.js 12.x (end-of-life)
    Node.js 20 LTS must be installed via NodeSource; see corrected Dockerfile below

UNVERIFIED:
  kijo/assets/Bonsai-Raw.blend existence
    Cannot verify: file not present in workspace snapshot despite OQ-10 marking it committed
    Blocking: Dockerfile COPY and blender CLI path depend on this file existing

  kijo/assets/Textures/ directory
    Cannot verify: directory not present in workspace snapshot
    The arch doc lists 12 texture files at kijo/assets/Textures/*.png
    What IS present: apps/web/public/textures/ contains 12 JPG files (different naming convention)
    These are the Godot-side textures; the Blender .blend likely has textures embedded/packed
    See OQ-B

  VOXEL_SCALE = 0.08
    Reasonable Blender scale for voxel-to-world-unit ratio; cannot verify without .blend
    See ASSUMPTION-1

  Blender coordinate system (voxel Y -> Blender up axis)
    Cannot verify without .blend file
    See OQ-A -- HIGHEST PRIORITY OPEN QUESTION

REFUTED:
  render_queue NOT YET migrated (as stated in task prompt)
    ACTUAL: render_queue was migrated via 20260806000002_render_queue.sql (2026-08-06)
    Trigger also applied via 20260807000001 (2026-08-07)
    Implementer MUST NOT create a new render_queue migration

  StatDeriver.derive takes 4 args (as stated in arch doc v5)
    ACTUAL: 5 args -- zones Map is required (added for zone-jitter fix 2026-07-31)
    Source line 203-209 VERIFIED

  Voxelizer.voxelize returns SparseVoxelSet (as stated in arch doc v5)
    ACTUAL: returns VoxelizeResult { voxels, zones }
    Source line 102, 190 VERIFIED
```

---

## CROSS-REFERENCE CHECK

```
checked against: NFT-METADATA-IMAGE-ARCH.md v5, IMPL-NFT-METADATA-2026-08-17.md, STATE.md, DECISIONS.md
consistent: mostly -- with the following arch doc corrections applied
  1. Voxelizer.voxelize -> VoxelizeResult (not SparseVoxelSet)
  2. StatDeriver.derive -> 5 args (not 4)
  3. render_queue already migrated (not "to be created")
  4. Node.js Dockerfile install needs NodeSource (not apt default)
  5. CareLogReplay landscape filter required in worker (same as nft-metadata)
terminology aligned: yes -- kijonsai, spatialHash, VoxelRole, SparseVoxelSet all consistent
data shapes aligned: yes
boundary violations: none -- render worker imports @kijo/engine and @kijo/voxelizer directly (Node.js, no bundle needed)
```

---

## THE DESIGN

---

### Section 1: Worker Architecture Overview

The render worker is a Node.js service on Railway that:
1. Polls `render_queue` every 5 seconds using `FOR UPDATE SKIP LOCKED`
2. Fetches tree data from Supabase for each claimed job
3. Runs `CareLogReplay.reconstruct -> Voxelizer.voxelize` to get voxel data
4. Serializes voxels to JSON and spawns `blender --background Bonsai-Raw.blend --python render_tree.py`
5. Uploads the rendered PNG to Supabase Storage at `renders/{tokenId}.png`
6. Marks the job done or retries (max 3 attempts)

The render worker imports `@kijo/engine` and `@kijo/voxelizer` DIRECTLY as npm workspace packages.
No esbuild bundle needed (that is only for the Deno Edge Functions).

---

### Section 2: Complete render_tree.py Spec

**File:** `apps/render-worker/scripts/render_tree.py`

**Invocation by worker:**
```bash
blender --background kijo/assets/Bonsai-Raw.blend \
  --python apps/render-worker/scripts/render_tree.py \
  -- \
  --token-id 42 \
  --out /tmp/render_42.png \
  --voxel-data '{"seed":464497,"voxels":[...]}'
```

The `--` separator tells Blender to stop consuming its own flags; everything after
goes to `sys.argv` for the Python script.

**Full implementation:**

```python
# apps/render-worker/scripts/render_tree.py
# Runs inside Blender's embedded Python (bpy available).
# Opens kijo/assets/Bonsai-Raw.blend, places voxel instances, renders to PNG.

import bpy
import sys
import json
import math
import argparse

# ---------------------------------------------------------------------------
# Template object names in Bonsai-Raw.blend (Jeremy's authoring convention)
# ---------------------------------------------------------------------------
# Jeremy must have these objects in the .blend with their materials pre-assigned.
# Each is a single-voxel-sized mesh primitive (hidden from render) used as a
# copy source. The Python script does obj = template.copy() per voxel position.

MAT_NAMES = {
    1: 'tpl_heartwood',
    2: 'tpl_bark',
    3: 'tpl_branch_wood',
    4: 'tpl_leaf',
    5: 'tpl_root',
    6: 'tpl_prune_scar',   # Phase 1 fallback: if absent, alias to tpl_bark (see get_template_object)
}

LEAF_MAT_ID  = 4
VOXEL_SCALE  = 0.08   # Blender world units per voxel -- MUST match .blend authoring scale
CENTER       = 128    # Voxel grid center for X and Z axes (trunk base at voxel (128, 38, 128))


def parse_args():
    """Extract script args from sys.argv after the '--' separator."""
    argv = sys.argv[sys.argv.index('--') + 1:]
    parser = argparse.ArgumentParser()
    parser.add_argument('--token-id', type=int, required=True)
    parser.add_argument('--out',       type=str, required=True)
    parser.add_argument('--voxel-data',type=str, required=True)
    return parser.parse_args(argv)


def get_template_object(mat_id):
    """
    Fetch the named template object from the loaded .blend scene.
    Phase 1 fallback: tpl_prune_scar may not yet be authored -- use tpl_bark.
    Raises ValueError if the object is not found (misconfigured .blend).
    """
    name = MAT_NAMES.get(mat_id)
    if name is None:
        raise ValueError(f'Unknown mat_id: {mat_id}')
    obj = bpy.data.objects.get(name)
    if obj is None and mat_id == 6:
        obj = bpy.data.objects.get('tpl_bark')   # Phase 1 fallback
    if obj is None:
        raise ValueError(
            f'Template object "{name}" not found in Bonsai-Raw.blend. '
            f'Jeremy must author this object in the .blend file.'
        )
    return obj


def clear_tree_objects():
    """
    Hide all template objects (tpl_*) from the render pass.
    Called at script start before placing any voxel instances.

    Because Blender opens Bonsai-Raw.blend fresh on each invocation, there are
    no lingering voxel instances from prior runs. The only cleanup needed is
    hiding the tpl_* source objects so they don't appear in the output image
    (they are mesh objects that would otherwise be visible).
    """
    for obj in bpy.data.objects:
        if obj.name.startswith('tpl_'):
            obj.hide_render = True


def spatial_hash(seed, x, y, z):
    """
    Deterministic hash for leaf Y-rotation.

    MUST match spatialHash() in packages/shared/src/index.ts exactly.
    TS returns raw uint32; Python divides by 2^32 to normalize to [0, 1).
    Used only for leaf rotation: angle = spatial_hash(...) * 2*pi.

    Verified step-by-step against TS source 2026-08-17.
    """
    packed = ((x & 0xFF) << 16) | ((y & 0xFF) << 8) | (z & 0xFF)
    h = (seed ^ packed) & 0xFFFFFFFF
    h = (h + 0x6D2B79F5) & 0xFFFFFFFF
    h = ((h ^ (h >> 15)) * (h | 1)) & 0xFFFFFFFF
    h = (h ^ (h + ((h ^ (h >> 7)) * (h | 61) & 0xFFFFFFFF))) & 0xFFFFFFFF
    h = (h ^ (h >> 14)) & 0xFFFFFFFF
    return h / 4294967296.0   # normalize uint32 -> [0, 1)


def main():
    args = parse_args()
    payload = json.loads(args.voxel_data)
    seed   = payload['seed']
    voxels = payload['voxels']

    # 1. Hide template objects from render
    clear_tree_objects()

    # 2. Group voxels by material ID for batch instancing
    groups = {}
    for v in voxels:
        groups.setdefault(v['mat'], []).append((v['x'], v['y'], v['z']))

    # 3. Place voxel instances
    #
    # COORDINATE MAPPING (ASSUMPTION -- Jeremy must confirm):
    #   Blender default is Z-up, Y-forward. Voxel grid is Y-up (trunk grows in +Y).
    #   Mapping:
    #     Blender X  = (voxel_x - 128) * VOXEL_SCALE   [horizontal, centered]
    #     Blender Y  = (voxel_z - 128) * VOXEL_SCALE   [depth, centered]
    #     Blender Z  =  voxel_y        * VOXEL_SCALE   [up, NOT centered -- root at y=34]
    #
    #   If Bonsai-Raw.blend uses a Y-up coordinate system instead, swap Y and Z:
    #     Blender Y  =  voxel_y        * VOXEL_SCALE
    #     Blender Z  = (voxel_z - 128) * VOXEL_SCALE
    #   Jeremy must confirm before first render.
    #
    for mat_id, positions in groups.items():
        template = get_template_object(mat_id)
        for (x, y, z) in positions:
            obj          = template.copy()
            obj.data     = template.data   # linked mesh -- saves memory; safe (read-only placement)
            obj.hide_render = False        # instance is visible even though template is hidden
            bpy.context.collection.objects.link(obj)

            # Blender Z-up mapping (default Blender convention):
            obj.location = (
                (x - CENTER) * VOXEL_SCALE,   # Blender X  (left/right)
                (z - CENTER) * VOXEL_SCALE,   # Blender Y  (depth)
                 y            * VOXEL_SCALE,   # Blender Z  (up)
            )

            # Leaf: deterministic Y-rotation for visual variety (no structural meaning)
            if mat_id == LEAF_MAT_ID:
                obj.rotation_euler[2] = spatial_hash(seed, x, y, z) * math.pi * 2

    # 4. Render settings
    scene = bpy.context.scene
    scene.render.engine             = 'CYCLES'
    scene.cycles.samples            = 64           # ~3-8 min on Railway CPU; tune post-deploy
    scene.render.resolution_x       = 1024
    scene.render.resolution_y       = 1024
    scene.render.filepath           = args.out
    scene.render.image_settings.file_format = 'PNG'

    # 5. Render to file
    bpy.ops.render.render(write_still=True)


main()
```

**Notes for Jeremy (Blender authoring):**

- Template objects (`tpl_heartwood`, `tpl_bark`, `tpl_branch_wood`, `tpl_leaf`, `tpl_root`, `tpl_prune_scar`) must exist in `Bonsai-Raw.blend` as single-voxel-sized mesh primitives with materials pre-assigned and hidden from render in the base scene.
- Camera, lights, and pot object are preserved — the script only adds linked copies of template objects.
- `tpl_prune_scar` is optional in Phase 1 — if absent, the script falls back to `tpl_bark`.
- Camera position and lighting are controlled entirely by the .blend file. The Python script does not touch them.
- Textures must be either packed into the .blend or present on disk at paths the .blend references. The Python script does not manage texture paths.

---

### Section 3: Dockerfile

**File:** `apps/render-worker/Dockerfile`

**Build context:** repo root (`kijo-bonsai/`). Run: `docker build -f apps/render-worker/Dockerfile .`

The `COPY . .` at `/app` will include `kijo/assets/Bonsai-Raw.blend` (required — see OQ-B).

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

# Blender 4.2 LTS (pinned by exact version for render reproducibility)
# Pin: 4.2.0 (original arch doc decision). See OQ-C for whether to upgrade to 4.2.23.
# Directory name after tar extract: blender-4.2.0-linux-x64
RUN wget -q https://download.blender.org/release/Blender4.2/blender-4.2.0-linux-x64.tar.xz \
  && tar -xf blender-4.2.0-linux-x64.tar.xz -C /opt \
  && ln -s /opt/blender-4.2.0-linux-x64/blender /usr/local/bin/blender \
  && rm blender-4.2.0-linux-x64.tar.xz

# Node.js 20 LTS via NodeSource
# NOTE: Ubuntu 22.04 apt repos ship Node.js 12.x (EOL). Do NOT use
# `apt-get install nodejs` -- it will install an incompatible version.
# NodeSource script installs the correct 20.x package and configures the repo.
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
  && apt-get install -y nodejs \
  && rm -rf /var/lib/apt/lists/*

# Repo (build context = repo root)
WORKDIR /app
COPY . .

# Install render-worker workspace package and its @kijo/* dependencies
RUN npm install --workspace=apps/render-worker --include-workspace-root

# Environment variables (set in Railway dashboard, not here):
#   SUPABASE_URL
#   SUPABASE_SERVICE_ROLE_KEY

# CMD runs from /app so kijo/assets/Bonsai-Raw.blend is a valid relative path
CMD ["node", "--loader", "ts-node/esm", "apps/render-worker/src/worker.ts"]
```

**Verifications required after Docker build:**
- `blender --version` exits 0 and prints `Blender 4.2.0`
- `node --version` exits 0 and prints `v20.x.x`
- `ls kijo/assets/Bonsai-Raw.blend` exits 0 (file present in image)

---

### Section 4: render_queue Migration Status

**CRITICAL: The render_queue table is ALREADY MIGRATED. Do NOT create a new migration.**

Applied migrations (verified by reading files):

```
apps/server/supabase/migrations/20260806000002_render_queue.sql
  -- CREATE TABLE render_queue (id, token_id, tree_id, trigger, status, attempts, created_at, updated_at, error)
  -- CREATE INDEX idx_render_queue_status_created ON render_queue(status, created_at) WHERE status='pending'

apps/server/supabase/migrations/20260807000001_render_queue_updated_at_trigger.sql
  -- CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER ...
  -- CREATE TRIGGER render_queue_set_updated_at BEFORE UPDATE ON render_queue ...
```

The schema matches the arch doc exactly. The trigger auto-updates `updated_at` on every row UPDATE.

**Job claiming SQL** (already specified in arch doc, reproduced here for implementer):

```sql
UPDATE render_queue
SET    status = 'processing',
       updated_at = now(),
       attempts = attempts + 1
WHERE  id = (
  SELECT id FROM render_queue
  WHERE  status = 'pending'
  ORDER  BY created_at ASC
  LIMIT  1
  FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

This is the atomic claim pattern. `FOR UPDATE SKIP LOCKED` prevents double-processing
if multiple worker instances are running.

---

### Section 5: File List (CREATE)

All files below must be created. None exist yet.

```
apps/render-worker/
  Dockerfile
    -- Ubuntu 22.04 + Blender 4.2.0 LTS + Node.js 20 (NodeSource) -- spec above

  package.json
    -- workspace package for apps/render-worker
    -- content: see below

  src/
    worker.ts
      -- main polling loop (setInterval every 5s)
      -- imports: CareLogReplay (@kijo/engine), Voxelizer (@kijo/voxelizer),
                  createClient (@supabase/supabase-js)
      -- calls claimJob -> processJob -> markDone/markFailed/markPending
      -- buildCareLog helper: filter 'landscape' and 'tick' from logRows
      -- day-0 branch: if tree.current_day <= 0, use new BonsaiTree(seed, species)
      -- serializeVoxels: unpack key, build { seed, voxels: [...] } JSON

    queue.ts
      -- claimJob(supabase): executes FOR UPDATE SKIP LOCKED claim SQL
                             returns RenderJob | null
      -- markDone(supabase, jobId): UPDATE status='done'
      -- markFailed(supabase, jobId, errorMsg): UPDATE status='failed', error=errorMsg
      -- markPending(supabase, jobId): UPDATE status='pending' (retry)

    blender.ts
      -- invokeBlender({ blendFile, script, tokenId, outPath, voxelData }): Promise<void>
      -- spawns child_process.spawn('blender', ['--background', blendFile, '--python', script,
                                                '--', '--token-id', tokenId, '--out', outPath,
                                                '--voxel-data', voxelData])
      -- streams stdout/stderr to console.log/console.error
      -- resolves on exit code 0; rejects with Error on non-zero exit or spawn error

    storage.ts
      -- uploadRender(supabase, localPath, storagePath): Promise<void>
      -- reads file with fs.readFile
      -- uploads to bucket 'renders' with upsert: true, contentType: 'image/png'
      -- throws on Supabase error

  scripts/
    render_tree.py
      -- Blender Python script; full implementation above (Section 2)
```

**package.json content:**

```json
{
  "name": "@kijo/render-worker",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "start": "node --loader ts-node/esm src/worker.ts"
  },
  "dependencies": {
    "@kijo/engine": "*",
    "@kijo/voxelizer": "*",
    "@supabase/supabase-js": "^2.45.0"
  },
  "devDependencies": {
    "ts-node": "^10.9.2",
    "typescript": "^5.5.4",
    "@types/node": "^20.14.0"
  }
}
```

Note: `@kijo/engine` and `@kijo/voxelizer` resolve as npm workspace packages (root `package.json`
has `"workspaces": ["packages/*", "apps/*"]`). No special install step needed -- `npm install`
from repo root handles them.

---

### Section 6: worker.ts Implementation Spec

Complete enough for the Implementer to write without guessing.

```typescript
// apps/render-worker/src/worker.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { CareLogReplay, CareLogReplayError } from '@kijo/engine';
import { BonsaiTree } from '@kijo/engine';
import { Voxelizer } from '@kijo/voxelizer';
import type { CareLogEntry } from '@kijo/shared';
import { claimJob, markDone, markFailed, markPending } from './queue.js';
import { invokeBlender } from './blender.js';
import { uploadRender } from './storage.js';
import * as fs from 'fs/promises';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Types for DB rows
interface TreeRow {
  seed: number;
  species: 'hardwood' | 'evergreen' | 'tropical';
  current_day: number;
  born_at: string;
}
interface LogRow {
  game_day: number;
  sequence: number;
  action_type: string;
  action_data: Record<string, unknown>;
}
interface RenderJob {
  id: number;
  token_id: number;
  tree_id: string;
  trigger: string;
  attempts: number;
}

// Build CareLogEntry[] from DB rows.
// FILTER: exclude 'landscape' (CareLogReplay throws -- Phase 1 limit)
// FILTER: exclude 'tick' (server-internal; never a valid user care action)
// Same pattern as nft-metadata/index.ts careLogReplay filter.
function buildCareLog(rows: LogRow[]): CareLogEntry[] {
  const EXCLUDE = new Set(['tick', 'landscape']);
  return rows
    .filter(r => !EXCLUDE.has(r.action_type))
    .map(r => ({
      day: r.game_day,
      action: { type: r.action_type, ...r.action_data } as CareLogEntry['action'],
    }));
}

// Unpack packed key -> {x,y,z} and build voxel payload JSON string.
// SparseVoxelSet.serialize() returns Array<[key, Material, VoxelRole, branchId]>
// key = ((x & 0xFF) << 16) | ((y & 0xFF) << 8) | (z & 0xFF)
function serializeVoxels(voxels: InstanceType<typeof import('@kijo/voxelizer').SparseVoxelSet>, seed: number): string {
  const raw = voxels.serialize();
  const entries = raw.map(([key, mat, role, branchId]) => ({
    x:       (key >>> 16) & 0xFF,
    y:       (key >>>  8) & 0xFF,
    z:        key         & 0xFF,
    mat,
    role,
    branchId,
  }));
  return JSON.stringify({ seed, voxels: entries });
}

async function processJob(job: RenderJob): Promise<void> {
  // 1. Fetch tree row
  const { data: tree, error: treeErr } = await supabase
    .from('trees')
    .select('seed, species, current_day, born_at')
    .eq('id', job.tree_id)
    .single<TreeRow>();
  if (treeErr || !tree) throw new Error(`Tree fetch failed: ${treeErr?.message}`);

  // 2. Fetch care log
  const { data: logRows, error: logErr } = await supabase
    .from('care_log_entries')
    .select('game_day, sequence, action_type, action_data')
    .eq('tree_id', job.tree_id)
    .order('game_day',  { ascending: true })
    .order('sequence', { ascending: true });
  if (logErr) throw new Error(`Care log fetch failed: ${logErr.message}`);

  // 3. Reconstruct tree
  const careLog   = buildCareLog(logRows ?? []);
  const totalDays = tree.current_day;

  let bonsai: InstanceType<typeof BonsaiTree>;
  if (totalDays <= 0) {
    // Day-0: CareLogReplay throws for totalDays <= 0
    bonsai = new BonsaiTree(tree.seed, tree.species);
  } else {
    bonsai = CareLogReplay.reconstruct(tree.seed, tree.species, careLog, totalDays);
  }

  // 4. Voxelize -- returns VoxelizeResult { voxels, zones }
  // zones is required by StatDeriver but NOT used by the render worker (render only needs voxels)
  const { voxels } = Voxelizer.voxelize(bonsai);

  // 5. Serialize voxels for Python script
  const voxelData = serializeVoxels(voxels, tree.seed);

  // 6. Invoke Blender
  const outPath = `/tmp/render_${job.token_id}.png`;
  await invokeBlender({
    blendFile: 'kijo/assets/Bonsai-Raw.blend',
    script:    'apps/render-worker/scripts/render_tree.py',
    tokenId:   job.token_id,
    outPath,
    voxelData,
  });

  // 7. Upload to Supabase Storage (upsert -- replaces previous render)
  await uploadRender(supabase, outPath, `${job.token_id}.png`);

  // 8. Clean up temp file (best-effort)
  await fs.unlink(outPath).catch(() => {});
}

// Poll every 5 seconds
setInterval(async () => {
  const job = await claimJob(supabase);
  if (!job) return;

  console.log(`[render-worker] claimed job ${job.id} for token ${job.token_id} (attempt ${job.attempts})`);

  try {
    await processJob(job);
    await markDone(supabase, job.id);
    console.log(`[render-worker] job ${job.id} done`);
  } catch (err) {
    console.error(`[render-worker] job ${job.id} failed:`, err);
    if (job.attempts >= 3) {
      await markFailed(supabase, job.id, String(err));
      console.error(`[render-worker] job ${job.id} permanently failed after ${job.attempts} attempts`);
    } else {
      await markPending(supabase, job.id);
    }
  }
}, 5_000);

console.log('[render-worker] started, polling render_queue every 5s');
```

**Notes:**
- `Voxelizer.voxelize` returns `{ voxels, zones }`. The render worker only uses `voxels` (zones are for StatDeriver which the render worker does NOT call).
- `SparseVoxelSet` is imported implicitly through `Voxelizer.voxelize` return type. The worker does not need to import it separately.
- attempts check: `job.attempts >= 3` uses the post-claim value (claimJob increments attempts via the claim SQL).

---

### Section 7: queue.ts, blender.ts, storage.ts Specs

**queue.ts:**

```typescript
// apps/render-worker/src/queue.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export interface RenderJob {
  id: number;
  token_id: number;
  tree_id: string;
  trigger: string;
  attempts: number;
}

// Atomic claim using FOR UPDATE SKIP LOCKED
// Increments attempts at claim time (so attempts reflects current attempt count in processJob)
export async function claimJob(supabase: SupabaseClient): Promise<RenderJob | null> {
  const { data, error } = await supabase.rpc('claim_render_job');
  // If supabase.rpc is not available, use raw SQL via execute:
  // The claim SQL is in the arch doc -- wrap it as a Postgres function or use execute_sql
  if (error) {
    console.error('[queue] claimJob error:', error.message);
    return null;
  }
  return data?.[0] ?? null;
}

export async function markDone(supabase: SupabaseClient, jobId: number): Promise<void> {
  await supabase.from('render_queue')
    .update({ status: 'done' })
    .eq('id', jobId);
}

export async function markFailed(supabase: SupabaseClient, jobId: number, error: string): Promise<void> {
  await supabase.from('render_queue')
    .update({ status: 'failed', error })
    .eq('id', jobId);
}

export async function markPending(supabase: SupabaseClient, jobId: number): Promise<void> {
  await supabase.from('render_queue')
    .update({ status: 'pending' })
    .eq('id', jobId);
}
```

**IMPLEMENTER NOTE on claimJob:** The `FOR UPDATE SKIP LOCKED` claim cannot be expressed
as a Supabase JS client query (the JS client does not expose `FOR UPDATE SKIP LOCKED`
through its query builder). Options:
- Option A (RECOMMENDED): Create a Postgres function `claim_render_job()` that runs the claim SQL
  and RETURNING * as a migration. Call via `supabase.rpc('claim_render_job')`.
- Option B: Use `supabase.from('render_queue').rpc(...)` raw SQL -- not supported in JS client.
- Option C: Use the Supabase Management API to execute raw SQL -- overly complex.

**Create a new migration for the claim function:**
```
File: apps/server/supabase/migrations/20260817000001_claim_render_job_fn.sql
```

```sql
-- Atomic render job claim: selects oldest pending job, marks it processing,
-- increments attempts, returns the row. FOR UPDATE SKIP LOCKED prevents
-- double-claim when multiple worker instances run.

CREATE OR REPLACE FUNCTION public.claim_render_job()
RETURNS SETOF public.render_queue
LANGUAGE sql
AS $$
  UPDATE public.render_queue
  SET    status    = 'processing',
         updated_at = now(),
         attempts  = attempts + 1
  WHERE  id = (
    SELECT id
    FROM   public.render_queue
    WHERE  status = 'pending'
    ORDER  BY created_at ASC
    LIMIT  1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;
```

**blender.ts:**

```typescript
// apps/render-worker/src/blender.ts
import { spawn } from 'child_process';

interface BlenderOptions {
  blendFile: string;  // relative to /app (repo root in container)
  script:    string;  // relative to /app
  tokenId:   number;
  outPath:   string;  // absolute path, e.g. /tmp/render_42.png
  voxelData: string;  // JSON string
}

export function invokeBlender(opts: BlenderOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '--background', opts.blendFile,
      '--python', opts.script,
      '--',
      '--token-id', String(opts.tokenId),
      '--out', opts.outPath,
      '--voxel-data', opts.voxelData,
    ];

    console.log(`[blender] spawning: blender ${args.slice(0, 4).join(' ')} ...`);
    const proc = spawn('blender', args, { stdio: ['ignore', 'pipe', 'pipe'] });

    proc.stdout.on('data', (d: Buffer) => process.stdout.write(d));
    proc.stderr.on('data', (d: Buffer) => process.stderr.write(d));

    proc.on('error', (err) => reject(new Error(`Blender spawn failed: ${err.message}`)));
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Blender exited with code ${code} for token ${opts.tokenId}`));
      }
    });
  });
}
```

**storage.ts:**

```typescript
// apps/render-worker/src/storage.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs/promises';

const BUCKET = 'renders';

export async function uploadRender(
  supabase: SupabaseClient,
  localPath: string,
  storagePath: string,   // e.g. "42.png"
): Promise<void> {
  const fileBuffer = await fs.readFile(localPath);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: 'image/png',
      upsert: true,   // replace previous render if it exists
    });
  if (error) throw new Error(`Storage upload failed for ${storagePath}: ${error.message}`);
}
```

---

### Section 8: Voxel JSON Payload Format

The JSON string passed to `--voxel-data` follows this exact shape:

```json
{
  "seed": 464497,
  "voxels": [
    { "x": 128, "y": 38, "z": 128, "mat": 1, "role": "trunk", "branchId": 0 },
    { "x": 128, "y": 39, "z": 128, "mat": 1, "role": "trunk", "branchId": 0 },
    ...
  ]
}
```

`mat` values match `Material` constants from `packages/voxelizer/src/index.ts`:
`1=HEARTWOOD, 2=BARK, 3=BRANCH_WOOD, 4=LEAF, 5=ROOT, 6=PRUNE_SCAR`

`role` values are the string form of `VoxelRole` enum:
`"trunk", "arm", "leg", "digit", "canopy", "root", "scar"`

The Python script uses `mat` to select the template object. `role` and `branchId`
are included in the payload but unused by the Phase 1 Python script (available for
Phase 2 enhancements such as health-based color variation by role).

A Day-200 hardwood tree (seed 464497) produces approximately 8,797 voxels.
JSON payload size at ~80 bytes/entry: ~700KB. Passed as a command-line argument.
If shell argument length becomes a concern (>2MB payload), write to a temp JSON file
and pass `--voxel-file /tmp/voxels_42.json` instead -- flag this for Phase 2.

---

### Section 9: Required Migration (NEW)

Only one new migration is required (the claim function). render_queue itself is already applied.

**File:** `apps/server/supabase/migrations/20260817000001_claim_render_job_fn.sql`

```sql
-- Postgres function for atomic render job claim.
-- Called by the render worker via supabase.rpc('claim_render_job').
-- Uses FOR UPDATE SKIP LOCKED for multi-instance safety.
-- Returns the claimed row (after status update) so worker has all job fields.

CREATE OR REPLACE FUNCTION public.claim_render_job()
RETURNS SETOF public.render_queue
LANGUAGE sql
AS $$
  UPDATE public.render_queue
  SET    status     = 'processing',
         updated_at = now(),
         attempts   = attempts + 1
  WHERE  id = (
    SELECT id
    FROM   public.render_queue
    WHERE  status = 'pending'
    ORDER  BY created_at ASC
    LIMIT  1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;
```

Apply: `supabase db push` or `supabase migration up`.

---

## ASSUMPTIONS REGISTER

1. **ASSUMPTION-1: VOXEL_SCALE = 0.08 is correct**
   Value from arch doc; cannot verify without .blend file.
   Mitigation: first render will immediately reveal if scale is wrong (tree will be tiny or enormous relative to pot). Tune iteratively.

2. **ASSUMPTION-2: Blender opens .blend and initializes GPU/CPU Cycles correctly in --background**
   Ubuntu 22.04 + apt packages listed should be sufficient for headless Cycles CPU rendering.
   Mitigation: add `libxrandr2` to Dockerfile if Blender prints display/GL errors at startup.

3. **ASSUMPTION-3: Template objects are pre-configured in Bonsai-Raw.blend by Jeremy**
   Objects named `tpl_heartwood`, `tpl_bark`, `tpl_branch_wood`, `tpl_leaf`, `tpl_root` must exist with materials assigned and hide_render=True in the base scene.
   Mitigation: if absent, Python script raises ValueError with clear message identifying the missing object name.

4. **ASSUMPTION-4: The renders bucket exists in Supabase Storage and is public**
   `uploadRender` will fail if bucket does not exist.
   Mitigation: create bucket in Supabase dashboard before first deploy.

5. **ASSUMPTION-5: cmd `node --loader ts-node/esm` is compatible with all @kijo/* imports**
   @kijo/engine uses `.js` extensions in import paths (ESM-compliant). ts-node/esm should resolve them.
   Mitigation: if ts-node/esm resolution fails, compile worker to JS first (`tsc`) and run compiled output: change CMD to `["node", "dist/worker.js"]`.

---

## OPEN QUESTIONS

Only questions that CANNOT be answered by reading existing docs and source files.

### OQ-A: Blender Coordinate System Mapping -- CLOSED 2026-08-17

**Jeremy confirmed (2026-08-17):** The purchased .blend files are proportionate. Use VOXEL_SCALE=0.08 and Z-up convention as specced. Adapt scale after first test render if needed.

Implementer: proceed with Z-up mapping as written in the Python script spec:
```
Blender X = (voxel_x - 128) * VOXEL_SCALE
Blender Y = (voxel_z - 128) * VOXEL_SCALE
Blender Z =  voxel_y        * VOXEL_SCALE
```
Run one test render with a seedling tree and visually verify pot/tree alignment. Adjust VOXEL_SCALE constant if tree is too large or too small -- no spec change required.

### OQ-B: Docker Build Context -- CLOSED 2026-08-17

**Jeremy confirmed (2026-08-17):** Use `kijo/` (parent directory) as the Railway root directory / Docker build context.

**Decision:** Set Railway service "Root Directory" to `kijo/`. The Dockerfile (at `kijo/kijo-bonsai/apps/render-worker/Dockerfile`) can then COPY both:
```
COPY kijo-bonsai/ /app/kijo-bonsai/
COPY assets/ /app/assets/
```
Blender is invoked with: `blender --background /app/assets/Bonsai-Raw.blend ...`

**Why not symlink:** Docker COPY does not follow symlinks by default. Symlinks would silently produce an empty file in the image.

**`kijo/assets/Bonsai-Raw.blend` confirmed present** (verified via bash ls 2026-08-17 -- file exists at kijo/assets/ alongside Textures/, Bonsai-GLB/, Bonsai-OBJ/, etc.). The Architect session's workspace mount did not include the parent kijo/ directory, causing the false "not found" result. File IS committed and IS accessible at that path.

### OQ-C: Blender Version Pin (Non-blocking, decide before first deploy)

The arch doc pinned Blender to 4.2.0 (July 2024).
As of 2026-08-17, the latest 4.2 LTS patch is **4.2.23** (released 2026-07-21).
4.2.0 is 2+ years old; 4.2.23 includes 23 months of bugfixes and security patches.

Recommendation: pin to 4.2.23 unless render reproducibility testing shows a regression.

If upgrading from 4.2.0 to 4.2.23, change the Dockerfile wget URL to:
```
https://download.blender.org/release/Blender4.2/blender-4.2.23-linux-x64.tar.xz
```
AND update the symlink path: `/opt/blender-4.2.23-linux-x64/blender`.

**Jeremy: pin 4.2.0 or upgrade to 4.2.23?**

---

## FILE SUMMARY

### Files to CREATE

```
apps/render-worker/Dockerfile
apps/render-worker/package.json
apps/render-worker/src/worker.ts
apps/render-worker/src/queue.ts
apps/render-worker/src/blender.ts
apps/render-worker/src/storage.ts
apps/render-worker/scripts/render_tree.py
apps/server/supabase/migrations/20260817000001_claim_render_job_fn.sql
```

### Files that ALREADY EXIST (do not recreate)

```
apps/server/supabase/migrations/20260806000002_render_queue.sql    -- already applied
apps/server/supabase/migrations/20260807000001_render_queue_updated_at_trigger.sql  -- already applied
apps/server/supabase/functions/_shared/kijo-engine.js              -- built, 64,831 bytes
apps/server/supabase/functions/nft-metadata/index.ts               -- built
apps/server/supabase/functions/nft-image/index.ts                  -- built
```

### Files to CONFIRM EXIST before implementation

```
kijo/assets/Bonsai-Raw.blend    -- CONFIRMED present 2026-08-17; Railway root = kijo/ so COPY assets/ works
kijo/assets/Textures/*.png      -- CONFIRMED present 2026-08-17 (Bonsai_Trunk_AMR, BaseColor, NormalGL, Leaves_*, Moss_*, Pot_*, Vegetation_*)
```

