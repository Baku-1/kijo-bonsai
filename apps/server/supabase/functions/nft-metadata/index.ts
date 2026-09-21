// nft-metadata -- GET /nft/metadata/{tokenId}
// Returns ERC-721 metadata JSON for a Kijonsai NFT (Ronin Market schema).
//
// Pipeline: DB query -> CareLogReplay -> Voxelizer -> StatDeriver -> TechniqueClassifier
// Engine imported from _shared/kijo-engine.js (esbuild bundle).
// Rebuild bundle: bash apps/server/supabase/functions/_shared/build-edge.sh
//
// Auth: none required -- public endpoint. Ronin Market crawls without auth.
//
// Trust boundary (data from Supabase DB crosses into deterministic engine):
//   - tokenId: must be positive integer string -- reject others with 404
//   - care_log_entries: unknown action_type rows skipped (validated at write-time
//     by care-action whitelist, but defense-in-depth here)
//   - DB errors: return 500 {"error":"internal error"} -- no raw messages exposed
//   - totalDays === 0: CareLogReplay.reconstruct requires > 0; use BonsaiTree() directly
//   - born_at: must parse to a finite timestamp; malformed -> 500 (not silent NaN corruption)

// @ts-ignore -- kijo-engine.js is an esbuild bundle; no .d.ts declarations
import {
  CareLogReplay,
  BonsaiTree,
  StatDeriver,
  TechniqueClassifier,
  Voxelizer,
} from '../_shared/kijo-engine.js';
// @ts-ignore -- Deno HTTPS import resolved at runtime by Supabase Edge Runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Ambient Deno type declaration for IDE/TypeScript compilers outside the Deno runtime
declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
  env: { get(key: string): string | undefined };
};

// @ts-ignore -- kijo-engine.js bundle re-exports @kijo/shared; deriveVisualTraits lives there
import { deriveVisualTraits } from '../_shared/kijo-engine.js';
// @ts-ignore -- kijo-engine.js bundle has no .d.ts; SpeciesClass is a string-union type guard
import type { SpeciesClass } from '../_shared/kijo-engine.js';

// ---------------------------------------------------------------------------
// Flower Guild Rank (GDD s7.3 thresholds; from NFT-METADATA-IMAGE-ARCH.md).
// matchPct from StatDeriver is in [0, 1]; multiply x100 before comparing.
//   0-19  -> Seedling
//   20-39 -> Sapling
//   40-59 -> Pruned
//   60-74 -> Styled
//   75-89 -> Exhibition
//   90-100 -> Master Work
// ---------------------------------------------------------------------------

function flowerGuildRank(matchPct: number): string {
  const p = matchPct * 100;
  if (p < 20) return 'Seedling';
  if (p < 40) return 'Sapling';
  if (p < 60) return 'Pruned';
  if (p < 75) return 'Styled';
  if (p < 90) return 'Exhibition';
  return 'Master Work';
}

// ---------------------------------------------------------------------------
// Technique label: "Primary" or "Primary / Overlay1 / Overlay2"
// TechniqueClassifier.classify() returns { primary, overlays[] }.
// ---------------------------------------------------------------------------

function techniqueLabel(result: { primary: string; overlays: string[] }): string {
  if (!result.overlays || result.overlays.length === 0) return result.primary;
  return [result.primary, ...result.overlays].join(' / ');
}

// ---------------------------------------------------------------------------
// Care log builder -- maps DB rows to typed LocalEntry objects.
//
// Known action types (CareAction union in @kijo/shared):
//   water, rotate, prune, fertilize, wire, wire-remove,
//   twine, twine-remove, weight, weight-remove, jin, landscape
//
// 'tick' is not in KNOWN_CARE_TYPES: it is a server event, not a care action.
//   CareLogReplay has no 'tick' handler (exhaustiveness guard throws).
//   KNOWN_CARE_TYPES already filters it out -- no extra exclude needed.
//
// 'landscape' is excluded for CareLogReplay (EXCLUDE_LANDSCAPE) because
//   CareLogReplay throws CareLogReplayError for landscape (Phase 1 limit).
//   TechniqueClassifier still receives landscape via careLogFull (new Set()).
// ---------------------------------------------------------------------------

interface LocalEntry {
  day:    number;
  action: { type: string; [key: string]: unknown };
}

const KNOWN_CARE_TYPES = new Set([
  'water', 'rotate', 'prune', 'fertilize',
  'wire', 'wire-remove',
  'twine', 'twine-remove',
  'weight', 'weight-remove',
  'jin', 'landscape',
]);

// Only needed for careLogReplay: CareLogReplay cannot handle landscape (Phase 1).
// careLogFull passes new Set() -- KNOWN_CARE_TYPES already excludes tick.
const EXCLUDE_LANDSCAPE = new Set(['landscape']);

function buildCareLog(
  rows: Array<{
    game_day:    number;
    action_type: string;
    action_data: Record<string, unknown> | null;
  }>,
  excludeTypes: Set<string>,
): LocalEntry[] {
  const out: LocalEntry[] = [];
  for (const row of rows) {
    if (!KNOWN_CARE_TYPES.has(row.action_type)) continue; // skip tick + unknown types
    if (excludeTypes.has(row.action_type))       continue; // skip explicitly excluded
    out.push({
      day:    row.game_day,
      action: { type: row.action_type, ...(row.action_data ?? {}) },
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonOk(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      ...CORS,
      'Content-Type':  'application/json',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}

function jsonErr(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      ...CORS,
      'Content-Type':  'application/json',
      // no-store: prevents CDNs from caching error responses (e.g., 404 on a
      // freshly minted token that hasn't propagated to DB yet).
      'Cache-Control': 'no-store',
    },
  });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'GET')     return jsonErr('method not allowed', 405);

  // ---- 1. Parse and validate tokenId ----------------------------------------
  // URL is /functions/v1/nft-metadata/{tokenId} (Supabase direct)
  //   or /nft/metadata/{tokenId} (via Netlify proxy).
  // pop() takes the last path segment regardless of routing prefix.
  const raw = new URL(req.url).pathname.split('/').pop() ?? '';
  if (!/^\d+$/.test(raw))  return jsonErr('token not found', 404);
  if (raw.length > 9)      return jsonErr('token not found', 404); // > 999M tokens = invalid
  const tokenId = parseInt(raw, 10);
  if (tokenId <= 0)        return jsonErr('token not found', 404);

  // ---- 2. Service-role DB client (bypasses RLS) ------------------------------
  // Fail loudly on missing env vars -- deployment misconfiguration should not
  // surface as a cryptic network error on the first DB call.
  const supabaseUrl    = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[nft-metadata] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
    return jsonErr('internal error', 500);
  }
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  // ---- 3. Query trees --------------------------------------------------------
  // token_id column added by migration 20260806000001_trees_token_id.sql.
  type TreeRow = {
    id:          string;
    seed:        number;
    species:     string;
    has_spirit:  boolean;
    current_day: number;
    born_at:     string;
  };
  let treeRow: TreeRow;

  try {
    const { data, error } = await serviceClient
      .from('trees')
      .select('id, seed, species, has_spirit, current_day, born_at')
      .eq('token_id', tokenId)
      .single();
    if (error || !data) return jsonErr('token not found', 404);
    treeRow = data as TreeRow;
  } catch {
    return jsonErr('internal error', 500);
  }

  // ---- 4. Query care_log_entries ---------------------------------------------
  type LogRow = {
    game_day:    number;
    sequence:    number;
    action_type: string;
    action_data: Record<string, unknown> | null;
  };
  let logRows: LogRow[];

  try {
    const { data, error } = await serviceClient
      .from('care_log_entries')
      .select('game_day, sequence, action_type, action_data')
      .eq('tree_id', treeRow.id)
      .order('game_day', { ascending: true })
      .order('sequence',  { ascending: true });
    if (error) return jsonErr('internal error', 500);
    logRows = (data ?? []) as LogRow[];
  } catch {
    return jsonErr('internal error', 500);
  }

  // ---- 5. Build care logs ---------------------------------------------------
  // careLogFull:    all known types (excludes tick via KNOWN_CARE_TYPES); keeps landscape
  //                 -> for TechniqueClassifier (needs landscapeCount)
  // careLogReplay:  excludes landscape additionally -> for CareLogReplay
  //                 (CareLogReplay throws CareLogReplayError for 'landscape' -- Phase 1 limit)
  const careLogFull   = buildCareLog(logRows, new Set());          // tick filtered by KNOWN_CARE_TYPES
  const careLogReplay = buildCareLog(logRows, EXCLUDE_LANDSCAPE);  // additionally exclude landscape

  // ---- 6. Aggregate care log stats ------------------------------------------
  const totalCareActions = careLogFull.length;
  const pruneCount       = careLogFull.filter(e => e.action.type === 'prune').length;

  // ---- 7. Reconstruct tree --------------------------------------------------
  // CareLogReplay.reconstruct requires totalDays > 0 (throws CareLogReplayError otherwise).
  // Day-0 trees (just minted, never ticked): construct BonsaiTree directly.
  const totalDays: number = treeRow.current_day;
  let bonsai: any; // any: kijo-engine.js bundle has no .d.ts

  try {
    if (totalDays <= 0) {
      bonsai = new BonsaiTree(treeRow.seed, treeRow.species);
    } else {
      bonsai = CareLogReplay.reconstruct(
        treeRow.seed,
        treeRow.species,
        careLogReplay,
        totalDays,
      );
    }
  } catch (e) {
    console.error('[nft-metadata] CareLogReplay failed:', (e as Error).message);
    return jsonErr('internal error', 500);
  }

  // ---- 8. Voxelize ----------------------------------------------------------
  // Voxelizer.voxelize() returns VoxelizeResult { voxels, zones }.
  // zones (branchId -> zoneIndex) required by StatDeriver.derive() -- 5th arg.
  // (NFT-METADATA-IMAGE-ARCH.md listed 4 args for derive(); actual impl takes 5.)
  let voxels: any; // any: bundle has no .d.ts
  let zones:  any;

  try {
    const result = Voxelizer.voxelize(bonsai);
    voxels = result.voxels;
    zones  = result.zones;
  } catch (e) {
    console.error('[nft-metadata] Voxelizer failed:', (e as Error).message);
    return jsonErr('internal error', 500);
  }

  // ---- 9. Age (real calendar days since born_at) ----------------------------
  // Used for: Wisdom tier (StatDeriver.wisdomFromAge), Age NFT trait.
  // NOT game days (current_day) -- age is real-time, not game-time.
  // Guard: malformed or null born_at would produce NaN, silently corrupting metadata.
  const bornAtMs = new Date(treeRow.born_at).getTime();
  if (!Number.isFinite(bornAtMs)) {
    console.error('[nft-metadata] born_at is not a valid date:', treeRow.born_at);
    return jsonErr('internal error', 500);
  }
  const ageDays = Math.max(0, Math.floor((Date.now() - bornAtMs) / 86_400_000));

  // ---- 10. Derive stats -----------------------------------------------------
  // StatDeriver.derive(tree, voxels, seed, ageDays, zones) -- 5 args.
  type StatSheet = {
    hp: number; power: number; endurance: number; ki: number;
    skillSlots: number; skillPoints: number; wisdom: number;
    matchPct: number; defense: number; stability: number;
  };
  let stats: StatSheet;

  try {
    stats = StatDeriver.derive(bonsai, voxels, treeRow.seed, ageDays, zones) as StatSheet;
    // Guard: bundle field names could diverge from our StatSheet type annotation.
    // A mismatch produces undefined -> NaN -> null in JSON (silent metadata corruption).
    if (!stats || !Number.isFinite(stats.hp) || !Number.isFinite(stats.matchPct)) {
      console.error('[nft-metadata] StatDeriver returned invalid stats:', JSON.stringify(stats));
      return jsonErr('internal error', 500);
    }
  } catch (e) {
    console.error('[nft-metadata] StatDeriver failed:', (e as Error).message);
    return jsonErr('internal error', 500);
  }

  // ---- 11. Classify technique -----------------------------------------------
  // careLogFull includes landscape so landscapeCount is correctly tallied.
  // TechniqueClassifier.classify(careLog, treeAgeDays) -- treeAgeDays = totalDays
  // (game days, not calendar days -- classifier uses game-day age gates).
  // CAVEAT: verify TechniqueClassifier.classify([], 0) does not divide by treeAgeDays
  // internally before shipping (day-0 trees pass totalDays = 0).
  const techniqueResult = TechniqueClassifier.classify(careLogFull, totalDays);
  const technique       = techniqueLabel(
    techniqueResult as { primary: string; overlays: string[] },
  );

  // ---- 12. Flower Guild Rank ------------------------------------------------
  const guildRank = flowerGuildRank(stats.matchPct);

  // ---- 13. Visual traits (OQ-3 — canonical, from @kijo/shared) ---------------
  const { subtype, leafColor, barkColorName } = deriveVisualTraits(
    treeRow.seed,
    treeRow.species as SpeciesClass,
  );

  // ---- 14. Health (Phase 1: current health at end of replay) ----------------
  // A true historical average requires per-tick health snapshots -- not stored.
  // Phase 1 proxy: bonsai.getHealth() (current health after full reconstruction).
  const healthAverage = Math.round((bonsai as { getHealth(): number }).getHealth());

  // ---- 15. Assemble metadata ------------------------------------------------
  const bornUnixSec    = Math.floor(bornAtMs / 1000);
  const speciesDisplay = (treeRow.species as string).charAt(0).toUpperCase() +
                         (treeRow.species as string).slice(1);

  const metadata = {
    name:        `Kijonsai #${tokenId}`,
    description: 'A living bonsai -- grown through care, shaped by the player.',
    image:       `https://api-kijo.netlify.app/nft/image/${tokenId}`,
    attributes: [
      // Core identity
      { display_type: 'number', trait_type: 'Seed',             value: treeRow.seed },
      { display_type: 'string', trait_type: 'Species',          value: speciesDisplay },
      { display_type: 'string', trait_type: 'Species Sub-type', value: subtype },
      { display_type: 'string', trait_type: 'Leaf Color',       value: leafColor },
      { display_type: 'string', trait_type: 'Bark Color',       value: barkColorName },
      { display_type: 'date',   trait_type: 'Born',             value: bornUnixSec },
      { display_type: 'number', trait_type: 'Age',              value: ageDays },
      { display_type: 'bool',   trait_type: 'Has Spirit',       value: treeRow.has_spirit },

      // Flower Guild Rank (matchPct threshold table, GDD s7.3)
      { trait_type: 'Flower Guild Rank', value: guildRank },

      // Combat stats from StatDeriver (rounded to integers for NFT trait display)
      { display_type: 'number', trait_type: 'HP',        value: Math.round(stats.hp) },
      { display_type: 'number', trait_type: 'Power',     value: Math.round(stats.power) },
      { display_type: 'number', trait_type: 'Endurance', value: Math.round(stats.endurance) },
      { display_type: 'number', trait_type: 'Ki',        value: Math.round(stats.ki) },
      { display_type: 'number', trait_type: 'Match %',   value: Math.round(stats.matchPct * 100) },

      // Skill / wisdom
      { display_type: 'number', trait_type: 'Skill Slots', value: stats.skillSlots },
      { display_type: 'number', trait_type: 'Wisdom',      value: stats.wisdom },

      // Technique (care log pattern -> TechniqueClassifier)
      { display_type: 'string', trait_type: 'Technique', value: technique },

      // Care log summary (aggregated from care_log_entries, excluding tick rows)
      { display_type: 'number', trait_type: 'Total Care Actions', value: totalCareActions },
      { display_type: 'number', trait_type: 'Prune Count',        value: pruneCount },
      { display_type: 'number', trait_type: 'Health Average',     value: healthAverage },
    ],
  };

  return jsonOk(metadata);
});
