// apps/render-worker/src/worker.ts
// Polling render worker: claims jobs from render_queue every 5s, renders each
// tree as a GLB (gltf-transform, fast) and a PNG (Blender Cycles, slow).
//
// Determinism invariant: same seed + care_log -> identical tree everywhere.
// No Math.random() -- all randomness flows from seed.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { CareLogReplay, BonsaiTree } from '@kijo/engine';
import { Voxelizer } from '@kijo/voxelizer';
import type { CareLogEntry, SpeciesClass } from '@kijo/shared';
import * as fs from 'fs/promises';
import { claimJob, markDone, markFailed, markPending, type RenderJob } from './queue.js';
import { invokeBlender } from './blender.js';
import { uploadRender } from './storage.js';
import { buildGlb, type VoxelEntry } from './glb.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------------------------------------------------------------------
// Asset paths (Railway root = kijo/, WORKDIR = /app/kijo-bonsai in container)
// /app = kijo/, so /app/assets/ = kijo/assets/
// ---------------------------------------------------------------------------
const BLEND_FILE   = '/app/assets/Bonsai-Raw.blend';
const BLEND_SCRIPT = '/app/kijo-bonsai/apps/render-worker/scripts/render_tree.py';
const TEXTURE_DIR  = '/app/assets/Textures';
const POT_GLB_PATH = '/app/assets/Bonsai-GLB/Bonsai_LowPoly.glb';

// ---------------------------------------------------------------------------
// DB row types
// ---------------------------------------------------------------------------
interface TreeRow {
  seed: number;
  species: SpeciesClass;
  current_day: number;
}

interface LogRow {
  game_day: number;
  sequence: number;
  action_type: string;
  action_data: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Build CareLogEntry[] from DB rows.
// FILTER: exclude 'landscape' -- CareLogReplay throws CareLogReplayError on it.
//         Landscape actions are deferred to post-beta (DECISIONS.md 2026-08-22).
// FILTER: exclude 'tick'      -- server-internal; never a valid user care action.
// ---------------------------------------------------------------------------
const EXCLUDED_ACTIONS = new Set(['tick', 'landscape']);

function buildCareLog(rows: LogRow[]): CareLogEntry[] {
  return rows
    .filter(r => !EXCLUDED_ACTIONS.has(r.action_type))
    .map(r => ({
      day:    r.game_day,
      action: { type: r.action_type, ...r.action_data } as CareLogEntry['action'],
    }));
}

// ---------------------------------------------------------------------------
// Unpack voxel keys and build the flat VoxelEntry array used by both GLB
// builder and Blender payload.
// SparseVoxelSet.serialize() -> Array<[packed_key, material, role, branchId]>
// key = ((x & 0xFF) << 16) | ((y & 0xFF) << 8) | (z & 0xFF)
// ---------------------------------------------------------------------------
function unpackVoxels(
  voxelSet: ReturnType<typeof Voxelizer.voxelize>['voxels'],
): VoxelEntry[] {
  const raw = voxelSet.serialize();
  return raw.map(([key, mat, _role, _branchId]) => ({
    x:   (key >>> 16) & 0xFF,
    y:   (key >>>  8) & 0xFF,
    z:    key         & 0xFF,
    mat,
  }));
}

// Build JSON payload for Blender --voxel-data arg.
// Includes role and branchId for future Phase 2 use (health-based colour etc.)
function serializeVoxelsForBlender(
  voxelSet: ReturnType<typeof Voxelizer.voxelize>['voxels'],
  seed: number,
): string {
  const raw = voxelSet.serialize();
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

// ---------------------------------------------------------------------------
// Core job processing
// ---------------------------------------------------------------------------
async function processJob(job: RenderJob): Promise<void> {
  // 1. Fetch tree row
  const { data: tree, error: treeErr } = await supabase
    .from('trees')
    .select('seed, species, current_day')
    .eq('id', job.tree_id)
    .single<TreeRow>();
  if (treeErr || !tree) {
    throw new Error(`Tree fetch failed: ${treeErr?.message ?? 'no data'}`);
  }

  // 2. Fetch care log entries
  const { data: logRows, error: logErr } = await supabase
    .from('care_log_entries')
    .select('game_day, sequence, action_type, action_data')
    .eq('tree_id', job.tree_id)
    .order('game_day',  { ascending: true })
    .order('sequence',  { ascending: true });
  if (logErr) {
    throw new Error(`Care log fetch failed: ${logErr.message}`);
  }

  // 3. Reconstruct tree state via CareLogReplay
  const careLog   = buildCareLog(logRows ?? []);
  const totalDays = tree.current_day;

  // Day-0 branch: CareLogReplay.reconstruct throws for totalDays <= 0
  const bonsai: BonsaiTree =
    totalDays <= 0
      ? new BonsaiTree(tree.seed, tree.species)
      : CareLogReplay.reconstruct(tree.seed, tree.species, careLog, totalDays);

  // 4. Voxelize -- VoxelizeResult { voxels, zones }
  // zones is required by StatDeriver but not needed for rendering
  const { voxels } = Voxelizer.voxelize(bonsai);

  // 5. Build flat voxel array (shared by GLB builder and Blender payload)
  const voxelEntries = unpackVoxels(voxels);

  // 5a. Build GLB (fast, pure Node.js -- non-fatal)
  // GLB failure must NOT abort the PNG render job.
  const glbOutPath = `/tmp/render_${job.token_id}.glb`;
  try {
    await buildGlb({
      voxels:       voxelEntries,
      seed:         tree.seed,
      tokenId:      job.token_id,
      textureDir:   TEXTURE_DIR,
      baseMeshPath: POT_GLB_PATH,
      outPath:      glbOutPath,
    });

    const glbStoragePath = `renders/${job.token_id}.glb`;
    await uploadRender(supabase, glbOutPath, glbStoragePath, 'model/gltf-binary');

    // Record glb_path in render_queue -- NULL until this succeeds (intentional)
    await supabase
      .from('render_queue')
      .update({ glb_path: glbStoragePath })
      .eq('id', job.id);

    console.log(`[render-worker] GLB uploaded: ${glbStoragePath}`);
  } catch (glbErr) {
    console.error(`[render-worker] GLB build failed for token ${job.token_id}:`, glbErr);
    // glb_path remains NULL in render_queue -- this is intentional and observable
  } finally {
    await fs.unlink(glbOutPath).catch(() => {});
  }

  // 6. Invoke Blender for PNG render (slow -- Cycles CPU, ~3-8 min on Railway)
  const pngOutPath = `/tmp/render_${job.token_id}.png`;
  await invokeBlender({
    blendFile: BLEND_FILE,
    script:    BLEND_SCRIPT,
    tokenId:   job.token_id,
    outPath:   pngOutPath,
    voxelData: serializeVoxelsForBlender(voxels, tree.seed),
  });

  // 7. Upload PNG to Supabase Storage (upsert -- replaces any previous render)
  await uploadRender(supabase, pngOutPath, `${job.token_id}.png`, 'image/png');

  // 8. Clean up temp file (best-effort)
  await fs.unlink(pngOutPath).catch(() => {});
}

// ---------------------------------------------------------------------------
// Polling loop -- every 5 seconds
// ---------------------------------------------------------------------------
setInterval(async () => {
  const job = await claimJob(supabase);
  if (!job) return;

  console.log(
    `[render-worker] claimed job ${job.id} for token ${job.token_id} (attempt ${job.attempts})`,
  );

  try {
    await processJob(job);
    await markDone(supabase, job.id);
    console.log(`[render-worker] job ${job.id} done`);
  } catch (err) {
    console.error(`[render-worker] job ${job.id} failed:`, err);
    // attempts is already incremented by claim SQL; check post-claim value
    if (job.attempts >= 3) {
      await markFailed(supabase, job.id, String(err));
      console.error(
        `[render-worker] job ${job.id} permanently failed after ${job.attempts} attempts`,
      );
    } else {
      await markPending(supabase, job.id);
    }
  }
}, 5_000);

console.log('[render-worker] started, polling render_queue every 5s');
