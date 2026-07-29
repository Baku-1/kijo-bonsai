# Kijonsai NFT Metadata + Voxel Tree Image — Architecture Plan

**Date:** 2026-07-27  
**Author:** Architect pass (v5 — Blender render pipeline)  
**Status:** DRAFT v5 — image strategy replaced; Blender headless + render queue + Railway worker  
**Scope:** Dynamic NFT metadata endpoint + Blender-rendered image pipeline (Phase 1)

---

## Prereading

Before reading this plan, the implementer should read:
- `docs/KIJONSAI-CONTRACT-ARCH.md` — deployed contract spec (tokenURI shape, metadata schema, ERC-4906)
- `docs/PHASE1-RONIN-ARCH.md` §6 — Ronin Market metadata format rules
- `apps/server/supabase/functions/get-tree/index.ts` — DB schema context (trees + care_log_entries tables)
- `apps/server/supabase/functions/seed-claim/index.ts` — tokenURI construction at mint time

---

## Decision Summary

| Decision | Choice | Rationale |
|---|---|---|
| Dynamic vs frozen image | **Dynamic** (always current state) | Game concept requires living tree; images update when tree changes |
| Metadata endpoint location | **Supabase Edge Function `nft-metadata`** | Co-located with DB; consistent with existing function fleet |
| Image format | **PNG (1024×1024)** | Blender pipeline; Ronin Market + all major NFT aggregators accept PNG |
| Image endpoint location | **Supabase Edge Function `nft-image`** | Simple 302 redirect to Supabase Storage public URL; no compute needed at request time |
| Renderer stack | **Blender 4.2 LTS headless CLI + Python render script** | Jeremy purchased Blender source files; Blender renders match the purchased asset quality; Three.js/`gl` rejected — `gl` requires Mesa/OpenGL native libs that AWS Lambda/serverless doesn't ship |
| Blender render engine | **Cycles (Jeremy's call — see tradeoff below)** | CPU-friendly; matches purchased `.blend` file lighting; flag for Jeremy |
| Render dispatch | **Supabase `render_queue` table (simple, no new extensions)** | Low job volume (small player base); pgmq deferred until throughput demands it |
| Render worker | **Node.js service on Railway (~$5/mo)** | Persistent process required for Blender CLI invocation; serverless cannot run Blender |
| Rendered image storage | **Supabase Storage at `/renders/{tokenId}.png`** | Predictable URL; CDN-served; no render cost at request time |
| Image URL stability | **`/nft/image/{tokenId}` NEVER changes** | As renderer is enhanced, existing NFTs improve automatically |
| Placeholder image | **`/renders/placeholder.png` in Supabase Storage** | Shown between mint and first completed render |
| Image update trigger | **Render queue job per structural change** | `mint`, `prune`, `wire` immediately enqueue; `tick` enqueues for grown trees |
| On-chain `MetadataUpdate` emit | **Spirit awakening only** | Significant state change worth gas; routine care actions are not |
| Engine access for image | **Render worker re-runs engine pipeline in Node.js** | Worker fetches tree data, runs `CareLogReplay → Voxelizer`, serializes voxels, passes to Blender Python script |
| Engine access for metadata | **Esbuild bundle in `_shared/`** | Supabase Deno can't resolve workspace paths; bundle approach unchanged for `nft-metadata` |
| tokenURI at mint | **Already correct** — `https://api.kijo.xyz/nft/metadata/{tokenId}` | Set in `seed-claim` at line 280; no change needed |
| Leaf color (Phase 1) | **Single green for all species** | Species color differentiation deferred to Phase 2 |

### Render engine tradeoff: EEVEE vs Cycles

| | EEVEE | Cycles |
|---|---|---|
| Render time (GPU) | ~5–30s | ~1–5 min |
| Render time (CPU only) | Slow — EEVEE is GPU-first | ~2–10 min at 64–128 samples |
| Quality | Real-time PBR; excellent for stylized look | Physically accurate ray-tracing; closest to authoring renders |
| Railway basic tier | No GPU — EEVEE degrades significantly on CPU | Works well; samples control quality/speed |
| Recommendation | Not recommended for CPU-only Railway | **Start with Cycles, 64 samples** — good quality, ~3–8 min per render |

**Flag for Jeremy:** Railway basic tier (~$5/mo) has no GPU. Cycles at 64 samples on CPU gives render times of roughly 3–8 minutes per tree, which is acceptable for a background queue. If render throughput becomes a bottleneck, upgrade to a Railway GPU instance or use a dedicated render box.

### Dynamic image tradeoff (revised)

The image is no longer rendered at request time. Instead it is pre-rendered by the queue worker and stored in Supabase Storage. The `nft-image` Edge Function is a 302 redirect to the stored PNG.

Pros: marketplace always gets a fast CDN-served PNG; no per-request render cost; Blender quality matches purchased assets.  
Cons: there is a lag between a care action (prune/wire) and the image update — the queue worker must complete the render first (typically a few minutes). During this window, the marketplace shows the previous render. Mitigation: the queue is designed to be fast enough that updates are visible within 5–10 minutes of the action.

Availability: if Supabase Storage is down, the 302 redirect fails. If the render worker is down, the image becomes stale. Mitigation: placeholder PNG is always available; Supabase Storage SLO is high (99.9%).

---

## Resolved: tokenId → tree_id Mapping + care_log Consumption Rule

**Decision (Jeremy, 2026-07-27):** Option A confirmed. `seed-claim` creates the `trees` row. `seed-tree` is retired from the mint path.

### The care_log is a one-time birth record

The guest session accumulates care actions in `localStorage`. At mint, that history becomes the tree's permanent record. After mint, all care is tracked server-side. The care_log is consumed exactly once.

**First mint (guest → wallet):**
1. Client passes `care_log` (array of `CareLogEntry`) in the `seed-claim` request body — optional field.
2. `seed-claim` writes the trees row with `token_id` set, then bulk-inserts the care_log entries into `care_log_entries`.
3. On successful mint response, **the client clears `localStorage` care_log**. This is a client-side responsibility; the server does not and cannot enforce it.
4. The NFT image reflects the pre-mint care history once the render worker completes.

**Second mint (same user, fresh seed):**
1. `localStorage` care_log is empty (was cleared after first mint).
2. Client sends `seed-claim` with `care_log: []` or omits the field.
3. `seed-claim` creates a fresh trees row with an empty care log.
4. NFT image shows a seedling placeholder until the worker renders the seedling state.

**Invariant:** The server treats `care_log` as a write-once birth record. It validates that `care_log_entries` for this `tree_id` is empty before inserting (guard against accidental double-submission). If non-empty, return 409.

### Required DB migration

```sql
ALTER TABLE trees ADD COLUMN token_id BIGINT UNIQUE;
CREATE INDEX idx_trees_token_id ON trees(token_id);
```

### `seed-claim` request body additions

The existing `{ txHash, count }` body gains two optional fields:

```typescript
{
  txHash: string;          // existing
  count: number;           // existing (must be 1 for now; care_log is per-token)
  seed: number;            // NEW: uint32 genome for this token
  species: SpeciesClass;   // NEW: 'hardwood' | 'evergreen' | 'tropical'
  has_spirit: boolean;     // NEW: spirit flag
  care_log?: CareLogEntry[]; // NEW: optional guest history (empty = fresh seedling)
}
```

`seed-claim` writes the DB atomically, looping over `count` (1–10):

```
tokenIds = []
for i in 0..count-1:
  tokenId = get_next_kijonsai_token_id()           // one sequence call per token
  INSERT INTO trees (seed, species, has_spirit, token_id, wallet_id, born_at)
  if i == 0 AND care_log non-empty:
    bulk INSERT INTO care_log_entries for this tree_id  // first token only
    guard: 409 if care_log_entries for this tree_id already exists
  tokenIds.push(tokenId)

for each tokenId in tokenIds:
  mintKijonsai(buyerAddress, tokenId, metadataUri)  // existing on-chain mint logic
  INSERT INTO render_queue (token_id, tree_id, trigger='mint', status='pending')
```

**The rule:** `care_log` attaches to `tokenIds[0]` only. Tokens at index 1 through `count-1` are fresh seedlings with empty care logs.

**On-chain mint loop:** Sequential `mintKijonsai` calls (not parallel — each needs a confirmed receipt before the next to avoid nonce collisions).

Return value changes from `{ ok, tokenId, mintTxHash }` to `{ ok, tokens: [{ tokenId, mintTxHash }] }` — an array ordered by index.

### Client-side responsibility

```typescript
// After successful seed-claim response:
const result = await seedClaim({ txHash, count, seed, species, has_spirit, care_log });
if (result.ok) {
  localStorage.removeItem('care_log');   // ← ONE-TIME CONSUMPTION
  // Navigate to tree view using result.tokens[0].tokenId
}
```

---

## Data Flow

### `GET /nft/metadata/{tokenId}`

```
1. Parse tokenId from request path (URL: /nft/metadata/42)
2. Query Supabase: SELECT seed, species, has_spirit, current_day, born_at, id AS tree_id
     FROM trees WHERE token_id = $tokenId LIMIT 1
   → 404 if not found
3. Query Supabase: SELECT game_day, sequence, action_type, action_data
     FROM care_log_entries WHERE tree_id = $tree_id
     ORDER BY game_day ASC, sequence ASC
4. totalDays = tree.current_day   (the number of game ticks elapsed)
5. Run CareLogReplay.reconstruct(seed, species, careLog, totalDays)  → BonsaiTree  ← C1 fixed: 4 args
6. Run Voxelizer.voxelize(tree)                                       → SparseVoxelSet
7. ageDays = Math.floor((Date.now() - born_at_ms) / 86_400_000)
8. Run StatDeriver.derive(tree, voxels, seed, ageDays)               → StatSheet   ← C2 fixed: 4 args
9. Compute derived fields:
     - Flower Guild Rank: from matchPct threshold table (see GDD §7.3)
     - Technique: classify care log (prune/wire pattern → technique label)
     - Age: ageDays (computed in step 7)
     - Total Care Actions, Prune Count, Health Average: aggregate care_log_entries
10. Assemble metadata JSON (schema below)
11. Return JSON with:
      Content-Type: application/json
      Cache-Control: public, max-age=300, s-maxage=300
      Access-Control-Allow-Origin: *
```

### `GET /nft/image/{tokenId}` — Supabase Edge Function (302 redirect)

```
1. Parse tokenId from request path
2. Build storage path: renders/{tokenId}.png
3. Build public URL: https://{project-ref}.supabase.co/storage/v1/object/public/renders/{tokenId}.png
4. Check if the object exists (HEAD request or Supabase Storage API):
     - If exists → 302 redirect to renders/{tokenId}.png public URL
     - If not found → 302 redirect to renders/placeholder.png public URL
   (Never return 404 or 500 to the marketplace — always serve an image)
```

This function has **no** engine, voxelizer, or rendering logic. It is a pure redirect. All rendering is done asynchronously by the render worker.

### Render queue dispatch flow

```
Trigger (mint / prune / wire / tick)
  └─→ INSERT INTO render_queue (token_id, tree_id, trigger, status='pending')

Render worker (polling loop every 5s):
  1. Claim one pending job (atomic UPDATE ... FOR UPDATE SKIP LOCKED)
  2. Fetch tree row: SELECT seed, species, has_spirit, current_day, born_at
       FROM trees WHERE id = $tree_id
  3. Fetch care log: SELECT ... FROM care_log_entries WHERE tree_id = $tree_id
       ORDER BY game_day ASC, sequence ASC
  4. totalDays = tree.current_day
  5. Run CareLogReplay.reconstruct(seed, species, careLog, totalDays)  → BonsaiTree
  6. Run Voxelizer.voxelize(tree)                                       → SparseVoxelSet
  7. Serialize voxels → JSON payload (see Voxel Serialization spec below)
  8. Invoke Blender CLI:
       blender --background kijo/assets/Bonsai-Raw.blend \
         --python apps/render-worker/scripts/render_tree.py \
         -- --token-id {tokenId} --out /tmp/render_{tokenId}.png \
            --voxel-data '{...json...}'
  9. On success: upload /tmp/render_{tokenId}.png to Supabase Storage
       bucket: renders, path: {tokenId}.png (upsert — replaces previous render)
  10. Mark job: UPDATE render_queue SET status='done', updated_at=now() WHERE id=$job_id
  11. On failure: attempts++; if attempts >= 3 → status='failed', log error
                            else → status='pending' (retry)
```

### Engine access — two environments, two strategies

**Render worker (`apps/render-worker/`) — Node.js, no bundle needed:**  
The render worker runs in a standard Node.js environment on Railway with access to the monorepo's `node_modules`. It imports `@kijo/engine` and `@kijo/voxelizer` directly as npm workspace packages.

```typescript
// apps/render-worker/src/worker.ts
import { CareLogReplay } from '@kijo/engine';
import { Voxelizer } from '@kijo/voxelizer';
```

**Supabase Edge Function (`nft-metadata`) — Deno, bundle required:**  
The `get-tree` Edge Function comments document why `@kijo/engine` and `@kijo/voxelizer` cannot be imported via relative paths in deployed Edge Functions.

Solution: pre-bundle into `apps/server/supabase/functions/_shared/`.

```
Build step (runs in CI before `supabase functions deploy`):
  esbuild packages/engine/src/index.ts packages/voxelizer/src/index.ts \
    --bundle --platform=browser --format=esm \
    --outfile=apps/server/supabase/functions/_shared/kijo-engine.js
```

```typescript
// nft-metadata imports:
import { CareLogReplay, StatDeriver } from '../_shared/kijo-engine.js';
import { Voxelizer } from '../_shared/kijo-engine.js';
```

Bundle is committed to repo; regenerate when `packages/engine` or `packages/voxelizer` changes. A pre-commit hook or CI gate enforces this.

---

## Render Queue Spec

### Schema

```sql
-- Migration: apps/server/supabase/migrations/{timestamp}_render_queue.sql

CREATE TABLE render_queue (
  id          BIGSERIAL PRIMARY KEY,
  token_id    BIGINT    NOT NULL,
  tree_id     UUID      NOT NULL REFERENCES trees(id),
  trigger     TEXT      NOT NULL CHECK (trigger IN ('mint', 'prune', 'wire', 'tick')),
  status      TEXT      NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempts    INTEGER   NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  error       TEXT
);

CREATE INDEX idx_render_queue_status_created
  ON render_queue(status, created_at)
  WHERE status = 'pending';
```

**Why `render_queue` table over pgmq:** pgmq requires enabling a Postgres extension (`pg_message_queue`) in Supabase, adding a dependency and a project setting change. For Phase 1 token volumes (tens to hundreds of renders per day), the simple table approach is correct. The `FOR UPDATE SKIP LOCKED` pattern provides the same atomicity guarantee as pgmq for a polling worker. Migrate to pgmq if throughput exceeds ~10,000 jobs/day.

### Job claiming (atomic)

The worker claims jobs with `FOR UPDATE SKIP LOCKED` to prevent double-processing when multiple worker instances run (currently one, but the schema supports horizontal scaling):

```sql
-- Worker executes this to claim one job atomically
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

### Retry policy

- Max 3 attempts (`attempts >= 3` → mark `failed`).
- On transient failure (Blender crash, network timeout): reset `status = 'pending'` immediately.
- On permanent failure (bad data, 3rd attempt): mark `status = 'failed'`, write error message to `error` column, log to Railway logs.
- Failed jobs are not deleted — they are visible for debugging. A periodic cleanup job can delete `done`/`failed` rows older than 30 days (deferred to Phase 2).

### Enqueue from Edge Functions

Insert a row using the **service role client** (bypasses RLS):

```typescript
// Shared helper — call after successful mint or structural care action
async function enqueueRender(
  serviceClient: SupabaseClient,
  tokenId: number,
  treeId: string,
  trigger: 'mint' | 'prune' | 'wire' | 'tick',
): Promise<void> {
  const { error } = await serviceClient.from('render_queue').insert({
    token_id: tokenId,
    tree_id: treeId,
    trigger,
    status: 'pending',
  });
  if (error) {
    // Log but do not fail the parent request — render is best-effort
    console.error('render_queue insert failed:', error.message);
  }
}
```

Do NOT make the render enqueue blocking on the success of the care action response. If the queue insert fails, the care action still succeeds — the render will be retried or queued manually.

---

## Render Worker Spec

### Service: `apps/render-worker/`

```
apps/render-worker/
  Dockerfile                  ← Ubuntu 22.04 + Blender 4.2 LTS + Node.js 20 LTS
  package.json                ← workspace package, depends on @kijo/engine, @kijo/voxelizer
  src/
    worker.ts                 ← main polling loop
    blender.ts                ← Blender CLI invocation + output capture
    storage.ts                ← Supabase Storage upload
    queue.ts                  ← render_queue claim + update helpers
  scripts/
    render_tree.py            ← Blender Python script (runs inside Blender process)
```

### Dockerfile

```dockerfile
FROM ubuntu:22.04

# Blender 4.2 LTS (headless)
RUN apt-get update && apt-get install -y \
    wget xz-utils libxi6 libxxf86vm1 libxfixes3 libxrender1 libgl1 \
  && wget -q https://download.blender.org/release/Blender4.2/blender-4.2.0-linux-x64.tar.xz \
  && tar -xf blender-4.2.0-linux-x64.tar.xz -C /opt \
  && ln -s /opt/blender-4.2.0-linux-x64/blender /usr/local/bin/blender \
  && rm blender-4.2.0-linux-x64.tar.xz

# Node.js 20 LTS
RUN apt-get install -y nodejs npm

# Repo
WORKDIR /app
COPY . .
RUN npm install --workspace=apps/render-worker

CMD ["node", "--loader", "ts-node/esm", "apps/render-worker/src/worker.ts"]
```

**Note:** The Blender binary requires `libGL` and X virtual framebuffer libraries even in `--background` (headless) mode. The packages above (`libxi6`, `libgl1`, etc.) cover this. If the Blender binary complains about missing display, add `libxrandr2` and `Xvfb` as well — though `--background` typically does not need a display server.

**Blender version to pin:** `4.2.0-linux-x64` (4.2 LTS). Do not chase latest releases — pin by exact version in the Dockerfile so the render is reproducible.

### Worker polling loop (`worker.ts`)

```typescript
import { createClient } from '@supabase/supabase-js';
import { CareLogReplay } from '@kijo/engine';
import { Voxelizer } from '@kijo/voxelizer';
import { claimJob, markDone, markFailed, markPending } from './queue.js';
import { invokeBlender } from './blender.js';
import { uploadRender } from './storage.js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function processJob(job: RenderJob): Promise<void> {
  // 1. Fetch tree
  const { data: tree } = await supabase.from('trees')
    .select('seed, species, has_spirit, current_day, born_at')
    .eq('id', job.tree_id).single();

  // 2. Fetch care log
  const { data: logRows } = await supabase.from('care_log_entries')
    .select('game_day, sequence, action_type, action_data')
    .eq('tree_id', job.tree_id)
    .order('game_day', { ascending: true })
    .order('sequence', { ascending: true });

  // 3. Reconstruct tree — 4 args required
  const careLog = buildCareLog(logRows ?? []);
  const totalDays = tree.current_day;
  const bonsai = CareLogReplay.reconstruct(tree.seed, tree.species, careLog, totalDays);

  // 4. Voxelize
  const voxels = Voxelizer.voxelize(bonsai);

  // 5. Serialize for Python script
  const voxelPayload = serializeVoxels(voxels, tree.seed);

  // 6. Invoke Blender
  const outPath = `/tmp/render_${job.token_id}.png`;
  await invokeBlender({
    blendFile: 'kijo/assets/Bonsai-Raw.blend',
    script: 'apps/render-worker/scripts/render_tree.py',
    tokenId: job.token_id,
    outPath,
    voxelData: JSON.stringify(voxelPayload),
  });

  // 7. Upload to Supabase Storage
  await uploadRender(supabase, outPath, `${job.token_id}.png`);
}

// Poll every 5 seconds
setInterval(async () => {
  const job = await claimJob(supabase);
  if (!job) return;
  try {
    await processJob(job);
    await markDone(supabase, job.id);
  } catch (err) {
    console.error(`render failed for token ${job.token_id}:`, err);
    if (job.attempts >= 3) {
      await markFailed(supabase, job.id, String(err));
    } else {
      await markPending(supabase, job.id);  // retry
    }
  }
}, 5_000);
```

### Voxel serialization format (`serializeVoxels`)

`SparseVoxelSet.serialize()` returns `Array<[key, Material, VoxelRole, number]>` where `key = ((x & 0xFF) << 16) | ((y & 0xFF) << 8) | (z & 0xFF)`. The worker unpacks coordinates before passing to Python:

```typescript
function serializeVoxels(voxels: SparseVoxelSet, seed: number): VoxelPayload {
  const raw = voxels.serialize();
  const entries = raw.map(([key, mat, role, branchId]) => ({
    x:  (key >>> 16) & 0xFF,
    y:  (key >>>  8) & 0xFF,
    z:   key         & 0xFF,
    mat,
    role,
    branchId,
  }));
  return { seed, voxels: entries };
}
```

The Python script receives the JSON string via `--voxel-data` argument:
```json
{
  "seed": 464497,
  "voxels": [
    { "x": 128, "y": 38, "z": 128, "mat": 1, "role": "trunk", "branchId": 0 },
    ...
  ]
}
```

`mat` values: 1=HEARTWOOD, 2=BARK, 3=BRANCH_WOOD, 4=LEAF, 5=ROOT, 6=PRUNE_SCAR  
`role` values: `"trunk"`, `"arm"`, `"leg"`, `"digit"`, `"canopy"`, `"root"`, `"scar"`

### Supabase Storage: upload (`storage.ts`)

```typescript
import { createReadStream } from 'fs';

export async function uploadRender(
  supabase: SupabaseClient,
  localPath: string,
  storagePath: string,
): Promise<void> {
  const fileBuffer = await fs.readFile(localPath);
  const { error } = await supabase.storage
    .from('renders')
    .upload(storagePath, fileBuffer, {
      contentType: 'image/png',
      upsert: true,           // replace previous render if it exists
    });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
}
```

**Bucket config:** `renders` bucket must be created in Supabase Storage with **public access** enabled. Public URL pattern:
```
https://{project-ref}.supabase.co/storage/v1/object/public/renders/{tokenId}.png
```

Upload the placeholder before any renders:
```
supabase storage cp placeholder.png supabase://renders/placeholder.png
```

---

## Blender Python Script Spec

**Location:** `apps/render-worker/scripts/render_tree.py`

**Invocation:**
```bash
blender --background kijo/assets/Bonsai-Raw.blend \
  --python apps/render-worker/scripts/render_tree.py \
  -- \
  --token-id 42 \
  --out /tmp/render_42.png \
  --voxel-data '{"seed":464497,"voxels":[...]}'
```

The `--` separator tells Blender to stop processing its own arguments; everything after is passed to the Python script as `sys.argv`.

### Script responsibilities

```python
# render_tree.py (outline — implementer fleshes out)
import bpy, sys, json, math, random, argparse

def parse_args():
    # sys.argv after '--'
    argv = sys.argv[sys.argv.index('--') + 1:]
    parser = argparse.ArgumentParser()
    parser.add_argument('--token-id', type=int, required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--voxel-data', required=True)
    return parser.parse_args(argv)

def main():
    args = parse_args()
    payload = json.loads(args.voxel_data)
    seed = payload['seed']
    voxels = payload['voxels']

    # 1. Clear existing voxel instance collections from the .blend scene
    #    (keep pot, lighting, camera — only clear tree geometry placeholders)
    clear_tree_objects()

    # 2. Group voxels by mat
    groups = {}  # mat → list of (x, y, z)
    for v in voxels:
        groups.setdefault(v['mat'], []).append((v['x'], v['y'], v['z']))

    # 3. For each material group, retrieve the template mesh from the .blend
    #    (Jeremy authors one mesh object per voxel material type in Bonsai-Raw.blend)
    #    then create instances at each voxel position.
    VOXEL_SCALE = 0.08  # world units per voxel
    CENTER = 128

    for mat_id, positions in groups.items():
        template = get_template_object(mat_id)  # looks up by object name in .blend
        for (x, y, z) in positions:
            obj = template.copy()
            obj.data = template.data  # linked mesh (not deep copy — saves memory)
            bpy.context.collection.objects.link(obj)
            obj.location = (
                (x - CENTER) * VOXEL_SCALE,
                 y            * VOXEL_SCALE,
                (z - CENTER) * VOXEL_SCALE,
            )
            # LEAF instances: deterministic random Y rotation (spatial hash)
            if mat_id == 4:  # LEAF
                obj.rotation_euler[2] = spatial_hash(seed, x, y, z) * math.pi * 2

    # 4. Set render settings
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 64           # tune: quality vs render time
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 1024
    scene.render.filepath = args.out
    scene.render.image_settings.file_format = 'PNG'

    # 5. Render
    bpy.ops.render.render(write_still=True)

main()
```

### Template object naming convention in `Bonsai-Raw.blend`

Jeremy must name the template objects in the Blender file following this convention so the Python script can look them up:

| Material ID | mat value | Template object name in .blend |
|---|---|---|
| HEARTWOOD | 1 | `tpl_heartwood` |
| BARK | 2 | `tpl_bark` |
| BRANCH_WOOD | 3 | `tpl_branch_wood` |
| LEAF | 4 | `tpl_leaf` |
| ROOT | 5 | `tpl_root` |
| PRUNE_SCAR | 6 | `tpl_prune_scar` (or reuse `tpl_bark` for Phase 1) |

The `get_template_object(mat_id)` helper does: `bpy.data.objects[MAT_NAMES[mat_id]]`.

**These objects must exist in `Bonsai-Raw.blend` before the render worker can function.** Jeremy sets them up as Blender authoring work. They are single-voxel-sized mesh primitives with their materials pre-assigned in Blender. The Python script instantiates them by position.

### Spatial hash (Python, must match TypeScript)

The deterministic leaf rotation must produce the same result as the TypeScript `spatialHash` function in `@kijo/shared`:

```python
def spatial_hash(seed: int, x: int, y: int, z: int) -> float:
    """Matches spatialHash() in packages/shared/src/index.ts — Mulberry32 variant."""
    packed = ((x & 0xFF) << 16) | ((y & 0xFF) << 8) | (z & 0xFF)
    h = (seed ^ packed) & 0xFFFFFFFF
    h = (h + 0x6D2B79F5) & 0xFFFFFFFF
    h = (h ^ (h >> 15)) * (h | 1) & 0xFFFFFFFF
    h = (h ^ (h + ((h ^ (h >> 7)) * (h | 61) & 0xFFFFFFFF))) & 0xFFFFFFFF
    h = (h ^ (h >> 14)) & 0xFFFFFFFF
    return h / 4294967296.0  # → [0, 1)
```

### Asset inventory (Blender render context)

**Source of truth:** `kijo/assets/Bonsai-Raw.blend` — Blender source file, commercial license. This is the file Blender opens for rendering.

Jeremy has confirmed the following texture files exist (used by materials inside the .blend):

| Texture file | Type | Notes |
|---|---|---|
| `kijo/assets/Textures/Trunk_BaseColor.png` | Albedo | Trunk / Bark / Branch |
| `kijo/assets/Textures/Trunk_AMR.png` | AO+Metalness+Roughness packed | R=AO, G=Metalness, B=Roughness |
| `kijo/assets/Textures/Trunk_NormalGL.png` | Normal (OpenGL) | HighPoly — use LowPoly variant |
| `kijo/assets/Textures/Trunk_LowPoly_NormalGL.png` | Normal (OpenGL) | Use this for renders |
| `kijo/assets/Textures/Leaves_BaseColor.png` | Albedo | Leaf instances |
| `kijo/assets/Textures/Leaves_NormalGL.png` | Normal | Leaf instances |
| `kijo/assets/Textures/Leaves_Roughness.png` | Roughness | Leaf instances |
| `kijo/assets/Textures/Leaves_Translucency.png` | Transmission mask | SSS through leaf |
| `kijo/assets/Textures/Moss_BaseColor.png` | Albedo | Pot moss |
| `kijo/assets/Textures/Pot_BaseColor.png` | Albedo | Pot ceramic |
| `kijo/assets/Textures/Pot_NormalGL.png` | Normal | Pot |
| `kijo/assets/Textures/Pot_Roughness.png` | Roughness | Pot |

**Textures-Raw/ (Substance Designer source — not shipped in Dockerfile):**
```
kijo/assets/Textures-Raw/
  Bonsai_Grunge_Alive.png    ← health-state grunge mask (Phase 2)
  Bonsai_Grunge_Dead.png     ← health-state grunge mask (Phase 2)
  *.sbs                      ← Substance Designer source files
```

**Authoring responsibility:** Materials, textures, and lighting are set up inside `Bonsai-Raw.blend` by Jeremy. The Python script controls **geometry placement only** (voxel positions → object instances). It does not touch materials or lighting. This is the clean separation: Blender handles visual quality, the pipeline handles geometry.

### Asset pipeline for future species and penjing

When adding new species leaf colors or penjing decor:
1. Author in `Bonsai-Raw.blend` — add new template objects (e.g., `tpl_leaf_tropical`) or pot meshes
2. Update the Python script's `MAT_NAMES` lookup if new material IDs are introduced
3. No changes needed to the render worker Node.js code

---

## Trigger Integration Points

### `seed-claim` — enqueue on mint

After the on-chain `mintKijonsai` call succeeds and the `trees` row is created, insert a render job:

```typescript
// After: INSERT INTO trees (...) + bulk INSERT INTO care_log_entries
// After: mintKijonsai on-chain confirmed
await enqueueRender(serviceClient, Number(tokenId), treeRow.id, 'mint');
```

The render job shows a seedling (possibly with pre-mint guest care actions applied). The placeholder image is shown until the render worker completes.

### `care-action` — enqueue for prune and wire only

After a successful `prune` or `wire` action is inserted into `care_log_entries`:

```typescript
// Append after step 6 (INSERT care_log_entries succeeds):
if (actionType === 'prune' || actionType === 'wire') {
  // Fetch token_id for this tree (trees row has token_id column post-migration)
  const { data: treeRow } = await serviceClient
    .from('trees')
    .select('token_id')
    .eq('id', tree_id)
    .single();

  if (treeRow?.token_id != null) {
    await enqueueRender(serviceClient, treeRow.token_id, tree_id, actionType);
  }
}
// water and fertilize do NOT enqueue renders — they affect growth at tick time, not shape now
```

**Why only prune and wire?** These are the only care actions that immediately change tree structure. `water` and `fertilize` influence the next growth tick but do not change the current voxel state. `tick` renders are handled separately.

### `tick` Edge Function — (deferred, but queue accepts it)

When the tick Edge Function is built, it will insert render jobs for every tree that grew during the tick:

```typescript
// Inside the future tick function, for each tree_id that was ticked:
await enqueueRender(serviceClient, tree.token_id, tree.id, 'tick');
```

The render worker handles `trigger='tick'` identically to `trigger='prune'` — no code change in the worker is needed when the tick function is built. The `render_queue` schema already accepts it.

---

## Endpoint Spec

### `GET /nft/metadata/{tokenId}`

**Routing:** `api.kijo.xyz/nft/metadata/:tokenId` → Netlify proxy → `{supabase-project}.supabase.co/functions/v1/nft-metadata` with path preserved.

**Request:**
```
GET /nft/metadata/42
Headers: (none required — public endpoint, no auth)
```

**Response 200:**
```json
Content-Type: application/json
Cache-Control: public, max-age=300, s-maxage=300

{ /* see Metadata JSON Schema below */ }
```

**Response 404:** `{ "error": "token not found" }`  
**Response 500:** `{ "error": "internal error" }`

**Auth:** None — public endpoint. Ronin Market crawls without auth.

---

### `GET /nft/image/{tokenId}`

**Location:** Supabase Edge Function `nft-image` — NOT a Netlify function. Simple redirect, no compute.

**Routing:** `api.kijo.xyz/nft/image/:tokenId` → Netlify proxy → Supabase Edge Function `nft-image`.

**Request:**
```
GET /nft/image/42
Headers: (none required — public endpoint)
```

**Response 302 (render exists):**
```
Location: https://{project-ref}.supabase.co/storage/v1/object/public/renders/42.png
Cache-Control: public, max-age=300, s-maxage=300
```

**Response 302 (render not yet ready):**
```
Location: https://{project-ref}.supabase.co/storage/v1/object/public/renders/placeholder.png
Cache-Control: public, max-age=60, s-maxage=60
```
(Shorter TTL on placeholder so marketplaces pick up the real render sooner.)

**Never return a 404 or 500** — always redirect to something. A broken image icon in the marketplace is worse than a seedling placeholder.

**Edge Function implementation:**
```typescript
// apps/server/supabase/functions/nft-image/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BUCKET = 'renders';
const PLACEHOLDER = 'placeholder.png';

Deno.serve(async (req) => {
  const tokenId = new URL(req.url).pathname.split('/').pop();
  if (!tokenId || !/^\d+$/.test(tokenId)) {
    return Response.redirect(publicUrl(PLACEHOLDER), 302);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Check if render exists
  const path = `${tokenId}.png`;
  const { data } = await supabase.storage.from(BUCKET).list('', {
    search: path, limit: 1,
  });
  const exists = data?.some(f => f.name === path) ?? false;

  const target = exists ? path : PLACEHOLDER;
  const maxAge = exists ? 300 : 60;

  return new Response(null, {
    status: 302,
    headers: {
      'Location': publicUrl(target),
      'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}`,
      'Access-Control-Allow-Origin': '*',
    },
  });
});

function publicUrl(path: string): string {
  const base = Deno.env.get('SUPABASE_URL')!;
  const project = new URL(base).hostname.split('.')[0];
  return `https://${project}.supabase.co/storage/v1/object/public/${BUCKET}/${path}`;
}
```

---

## Metadata JSON Schema

Full schema per `KIJONSAI-CONTRACT-ARCH.md §12`. The `image` field points to the `nft-image` Edge Function redirect (which in turn redirects to the Supabase Storage PNG). The URL has no extension — it is permanent and format-agnostic.

```json
{
  "name": "Kijonsai #42",
  "description": "A living bonsai — grown through care, shaped by the player.",
  "image": "https://api.kijo.xyz/nft/image/42",
  "attributes": [

    // Core identity
    { "display_type": "number",  "trait_type": "Seed",             "value": 464497 },
    { "display_type": "string",  "trait_type": "Species",          "value": "Hardwood" },
    { "display_type": "string",  "trait_type": "Species Sub-type", "value": "Twisted Trunk" },
    { "display_type": "string",  "trait_type": "Leaf Color",       "value": "Deep Green" },
    { "display_type": "date",    "trait_type": "Born",             "value": 1721520000 },
    { "display_type": "number",  "trait_type": "Age",              "value": 47 },
    { "display_type": "bool",    "trait_type": "Has Spirit",       "value": false },

    // Flower Guild Rank (matchPct → rank string)
    { "trait_type": "Flower Guild Rank", "value": "Sapling" },

    // Combat stats from StatDeriver
    { "display_type": "number",  "trait_type": "HP",          "value": 959 },
    { "display_type": "number",  "trait_type": "Power",       "value": 390 },
    { "display_type": "number",  "trait_type": "Endurance",   "value": 170 },
    { "display_type": "number",  "trait_type": "Ki",          "value": 294 },
    { "display_type": "number",  "trait_type": "Match %",     "value": 73 },

    // Skill / wisdom
    { "display_type": "number",  "trait_type": "Skill Slots", "value": 2 },
    { "display_type": "number",  "trait_type": "Wisdom",      "value": 35 },

    // Technique (classified from care log pattern)
    { "display_type": "string",  "trait_type": "Technique",   "value": "Bound-and-Cut" },

    // Care log summary (aggregated from care_log_entries)
    { "display_type": "number",  "trait_type": "Total Care Actions", "value": 42 },
    { "display_type": "number",  "trait_type": "Prune Count",        "value": 7 },
    { "display_type": "number",  "trait_type": "Health Average",     "value": 84 }
  ]
}
```

**Rules:**
- `name` and `image` are required; all other fields should be present per PRD §7.3
- `display_type: "date"` values are Unix timestamps in **seconds** (not ms)
- `display_type: "bool"` uses native JSON `true`/`false`
- No nested attributes — all traits flat in `attributes` array
- `animation_url` omitted in Phase 1 until viewer domain is Sky Mavis-allowlisted

**Flower Guild Rank thresholds** (from GDD §7.3 — implementer must verify against GDD):

| matchPct range | Rank |
|---|---|
| 0–19 | Seedling |
| 20–39 | Sapling |
| 40–59 | Pruned |
| 60–74 | Styled |
| 75–89 | Exhibition |
| 90–100 | Master Work |

**Species Sub-type and Leaf Color:** Seed-deterministic traits. Implementer defines `deriveVisualTraits(seed, species) → { subtype, leafColor }` — a lookup table indexed by `seed % N`. Not specified in GDD; Jeremy must define the trait tables or confirm they can be invented for Phase 1.

---

## Open Questions

| # | Question | Blocking? | Owner |
|---|---|---|---|
| **OQ-1** | **Bonsai-Raw.blend template objects**: Jeremy must set up one named mesh object per voxel material type in the .blend file (`tpl_heartwood`, `tpl_bark`, `tpl_branch_wood`, `tpl_leaf`, `tpl_root`). Are these already modeled, or does this require Blender authoring work? | ✅ YES — render worker cannot function without these | Jeremy |
| **OQ-2** | **Routing config**: How does `api.kijo.xyz/nft/*` route to Supabase Edge Functions — Netlify proxy rule, custom domain on Supabase, or something else? Must be confirmed before deploying `nft-image` Edge Function. | ✅ YES | Jeremy / check Netlify `_redirects` or `netlify.toml` |
| **OQ-3** | **Species Sub-type + Leaf Color trait tables**: Who defines the possible values and the seed-derivation function? Referenced in metadata schema. | Yes for metadata completeness | Jeremy |
| **OQ-4** | **Technique classifier**: `TechniqueClassifier.classify(care_log)` not exported from `packages/engine/src/index.ts`. Ship Phase 1 metadata with `"Unclassified"` placeholder or build it? | Partial — can ship `"Unclassified"` | Implementer |
| **OQ-5** | **Cycles samples vs render time**: 64 samples targets ~3–8 min/render on Railway CPU. Is this acceptable, or should Jeremy upgrade to a Railway GPU box for faster EEVEE renders? | No — can tune post-deploy | Jeremy |
| **OQ-6** | **Supabase Storage bucket name and public URL pattern**: confirm project ref and whether a custom storage domain (`storage.kijo.xyz`) is set up, which changes the redirect URL in `nft-image`. | Yes — needed before `nft-image` goes live | Jeremy / Supabase project settings |
| **OQ-7** | **Placeholder PNG**: A seedling placeholder PNG must be authored and pre-uploaded to Supabase Storage as `renders/placeholder.png` before the first mint. Does Jeremy author this in Blender (a static seedling render) or is it an existing asset? | YES — must exist before launch | Jeremy |
| **OQ-8** | **Esbuild bundle versioning**: `_shared/kijo-engine.js` must be regenerated when engine packages change. CI gate or pre-commit hook needed. | No — must be planned before first deploy | Implementer |
| **OQ-9** | **`updateMetadata` on spirit awakening**: When spirit is set, should `care-action` emit an on-chain `MetadataUpdate` event? Gas cost ~30–50k on Saigon. | No — defer to Phase 2 | Jeremy |
| **OQ-10** | **Blender file location in Docker image**: The Dockerfile `COPY . .` copies the full repo; confirm `kijo/assets/Bonsai-Raw.blend` is committed to the repo (not gitignored for file size reasons). If gitignored, needs a separate asset delivery strategy (LFS, download step in Dockerfile). | ✅ YES | Implementer (check `.gitignore`) |

---

## Implementation Scope

### Files to **create**

```
apps/server/supabase/functions/nft-metadata/index.ts
  ← GET /nft/metadata/{tokenId}  (Supabase Edge Function / Deno)
  ← Queries trees + care_log_entries, runs engine pipeline (via _shared bundle), returns JSON
  ← image field: "https://api.kijo.xyz/nft/image/{tokenId}"
  ← Uses CareLogReplay.reconstruct(seed, species, careLog, totalDays)  [4 args]
  ← Uses StatDeriver.derive(tree, voxels, seed, ageDays)              [4 args]

apps/server/supabase/functions/nft-image/index.ts
  ← GET /nft/image/{tokenId}  (Supabase Edge Function / Deno)
  ← Simple 302 redirect to Supabase Storage public URL
  ← Checks if renders/{tokenId}.png exists; falls back to placeholder.png
  ← No engine, no render logic — pure redirect

apps/server/supabase/functions/_shared/kijo-engine.js
  ← Esbuild bundle of packages/engine + packages/voxelizer + packages/shared
  ← Built by build script; committed to repo; deployed with nft-metadata

packages/engine/scripts/bundle-for-edge.ts   (or build-edge.sh)
  ← Esbuild invocation producing _shared/kijo-engine.js
  ← Run in CI before `supabase functions deploy`

apps/render-worker/
  Dockerfile                        ← Ubuntu 22.04 + Blender 4.2.0 + Node.js 20
  package.json                      ← workspace package
  src/worker.ts                     ← polling loop (every 5s)
  src/queue.ts                      ← claimJob, markDone, markFailed, markPending
  src/blender.ts                    ← spawn Blender CLI, capture stdout/stderr
  src/storage.ts                    ← upload PNG to Supabase Storage (renders bucket)
  scripts/render_tree.py            ← Blender Python script (positions voxel instances + renders)

apps/server/supabase/migrations/{timestamp}_render_queue.sql
  ← CREATE TABLE render_queue with status/attempts/trigger/error columns
  ← CREATE INDEX on (status, created_at)

apps/server/supabase/migrations/{timestamp}_trees_token_id.sql
  ← ALTER TABLE trees ADD COLUMN token_id BIGINT UNIQUE
  ← CREATE INDEX idx_trees_token_id ON trees(token_id)
```

### Files to **modify**

```
apps/server/supabase/functions/seed-claim/index.ts
  ← Accept seed, species, has_spirit, care_log in request body
  ← Loop count: INSERT INTO trees per token; care_log → first token only; 409 guard
  ← After on-chain mint confirmed: INSERT INTO render_queue (trigger='mint')
  ← Response changes to { ok, tokens: [{ tokenId, mintTxHash }] }

apps/server/supabase/functions/care-action/index.ts
  ← After successful prune or wire INSERT:
      fetch trees.token_id for this tree_id
      INSERT INTO render_queue (trigger=actionType) if token_id is non-null
  ← water and fertilize: NO render enqueue

netlify.toml (or _redirects)
  ← Add proxy: /nft/metadata/:tokenId → Supabase Edge Function nft-metadata
  ← Add proxy: /nft/image/:tokenId    → Supabase Edge Function nft-image
  ← Confirm no conflicts with existing api.kijo.xyz routes
```

### Files **not** needed (previously planned, now removed)

```
netlify/functions/nft-image.ts        ← REMOVED: Three.js/gl render-on-request rejected
netlify/functions/assets/             ← REMOVED: no GLB/texture bundle for Netlify
gl, canvas npm dependencies           ← REMOVED: headless WebGL not used
three.js server-side render code      ← REMOVED
```

### Files to **confirm exist** (not modified, required inputs)

```
kijo/assets/Bonsai-Raw.blend          ← Blender source; must be in repo (see OQ-10)
kijo/assets/Textures/*.png            ← Texture files used by Blender materials
packages/engine/src/CareLogReplay.ts  ← reconstruct(seed, species, log, totalDays) — 4 args
packages/engine/src/StatDeriver.ts    ← derive(tree, voxels, seed, ageDays) — 4 args
packages/voxelizer/src/index.ts       ← Voxelizer.voxelize(tree) → SparseVoxelSet
```

---

## Phase 2 additions (out of scope, flag for later)

- **Species leaf color in Blender**: Different leaf colors per species authored as material variants in `Bonsai-Raw.blend`. Python script checks `species` field and switches the active material on `tpl_leaf`. No engine change — purely a Blender authoring + Python script update.
- **Health-state grunge**: `Bonsai_Grunge_Alive.png` / `Bonsai_Grunge_Dead.png` assets exist in `Textures-Raw/`. Python script drives a blend factor on the tree material based on `trees.health` value passed in the voxel payload.
- **Pot and penjing decor**: Additional template objects in `Bonsai-Raw.blend` driven by tree attributes (pot style from seed, moss density from health). Python script checks attributes and includes the right objects.
- **`animation_url`**: Three.js 3D interactive viewer at `/nft/viewer/{tokenId}` — requires Sky Mavis domain allowlist before it appears on Ronin Market.
- **On-chain `MetadataUpdate` per care action**: Emit ERC-4906 event to trigger Ronin Market re-index after each care action. Currently deferred (gas cost; done on spirit awakening only).
- **pgmq migration**: If render job volume grows above ~10,000/day, migrate `render_queue` table to Supabase pgmq extension for better throughput and built-in dead-letter queue.
- **Render cache invalidation webhook**: Purge CDN/marketplace cache for `/nft/image/{tokenId}` when a new render is uploaded to Storage. Requires marketplace webhook support (Sky Mavis).
- **`TechniqueClassifier`**: Full care log pattern → technique name derivation. Ships as `"Unclassified"` in Phase 1.
- **Guest tree metadata endpoint**: Token-less metadata for in-game use (not marketplace). Separate from the NFT endpoint.
- **Failed render alerting**: Monitor `render_queue WHERE status='failed'` and alert via Discord webhook or email. Deferred from Phase 1 operational work.
