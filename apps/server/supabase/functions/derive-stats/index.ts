/**
 * derive-stats -- GET ?tree_id=<uuid>
 * Returns the deterministic 10-stat sheet for a grown bonsai tree, derived
 * server-side from the tree's seed + care log.
 *
 * RESPONSE ENVELOPE -- identical to the fixture files written by
 * fixtures/exportFixture.mjs (authority: fixtures/exportFixture.mjs object
 * literal + fixtures/hardwood_real.json):
 *   {
 *     seed, species, ageDays, generatedAt,
 *     stats: { hp, power, endurance, ki, skillSlots, skillPoints, wisdom,
 *              matchPct, defense, stability }
 *   }
 * The 10 camelCase stat keys are the Godot KijoStats resource contract.
 * ageDays = tree.getAge() after replay = the number of game days elapsed
 * (this is the replay bound that exportFixture receives as totalDays).
 *
 * PIPELINE -- single-source TypeScript, NEVER reimplemented:
 *   CareLogReplay.reconstruct(seed, species, priorLog, current_day)
 *     -> Voxelizer.voxelize(tree)
 *     -> StatDeriver.derive(tree, voxels, seed, tree.getAge(), zones)
 * This is the same chain fixtures/exportFixture.mjs and the web client
 * (apps/web/src/main2d.ts / main3d.ts) run, so seed + care_log produce
 * identical stats everywhere (determinism invariant).
 *
 * WHY A BUNDLE (prior failure -- see the header comment in get-tree/index.ts):
 *   The previous server-side derivation attempt failed because Supabase's Deno
 *   runtime cannot resolve the monorepo workspace paths
 *   (workspace package dist/index.js files) at deploy time; the engine packages
 *   are not published to npm and have no publishConfig. Reconstruction was
 *   therefore moved client-side.
 *   THE FIX: engine.bundle.mjs is a SINGLE self-contained ESM file produced by
 *   build-engine-bundle.mjs (esbuild over engine-entry.mjs, which re-exports
 *   the real packages/engine/dist + packages/voxelizer/dist +
 *   packages/shared/dist code). This function imports that one file with a
 *   plain relative path -- no workspace resolution at deploy time.
 *
 * BUILD (from repo root -- run BEFORE deploying; generates
 *   apps/server/supabase/functions/derive-stats/engine.bundle.mjs):
 *   npm run build:engine-bundle
 *   # or, without the npm alias:
 *   node apps/server/supabase/functions/derive-stats/build-engine-bundle.mjs
 *
 * DEPLOY (from apps/server/supabase; verify_jwt is false via config.toml):
 *   cd apps/server/supabase
 *   supabase functions deploy derive-stats
 *   # if config.toml is not in sync, pass the flag instead:
 *   supabase functions deploy derive-stats --no-verify-jwt
 *
 * AUTH: intentionally unauthenticated, mirroring get-tree. Ownership is
 * enforced upstream at discovery/list-trees, and the underlying care log is
 * already public via get-tree.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createCombatPayload } from './combat-payload.mjs';
import {
  CareLogReplay,
  CareLogReplayError,
  StatDeriver,
  BonsaiTree,
  Voxelizer,
} from './engine.bundle.mjs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// CareAction['type'] discriminants -- mirrors CARE_ACTION_TYPES in
// apps/web/src/persistence.ts. Used to validate DB rows the same way the web
// client's loadCareLog does. This is data validation, not stat math.
const CARE_ACTION_TYPES = [
  'water', 'rotate', 'prune', 'fertilize',
  'wire', 'wire-remove', 'twine', 'twine-remove',
  'weight', 'weight-remove', 'jin', 'landscape',
];

/** Raw care_log_entries row shape (same columns get-tree selects). */
interface CareLogRow {
  game_day: number;
  sequence: number;
  action_type: string;
  action_data: Record<string, unknown>;
}

/** CareLogEntry shape the engine replay expects: { day, action }. */
interface CareLogEntryInput {
  day: number;
  action: Record<string, unknown> & { type: string };
}

/**
 * Mirror of loadCareLog() in apps/web/src/persistence.ts:
 * sort by (game_day, sequence), drop 'tick' rows, map to { day, action }.
 *
 * 'tick' rows only record elapsed game days -- CareLogReplay.reconstruct()
 * applies growth ticks itself (one growTick per loop iteration), so including
 * them would break the replay dispatcher.
 */
function buildCareLog(rows: CareLogRow[]): CareLogEntryInput[] {
  return rows
    .filter((row) => row.action_type !== 'tick')
    .sort((a, b) => a.game_day - b.game_day || a.sequence - b.sequence)
    .flatMap((row) => {
      const candidate = { type: row.action_type, ...row.action_data };
      if (typeof candidate.type !== 'string' || !CARE_ACTION_TYPES.includes(candidate.type)) {
        console.warn('[derive-stats] skipping invalid care_log row', row);
        return [];
      }
      return [{ day: row.game_day, action: candidate }];
    });
}

/**
 * Mirror of applyCurrentDayEntries() in apps/web/src/persistence.ts.
 * Applies "tail" care actions (game_day === current_day) without another
 * growTick. Only the 2D/3D UI subset is applied; physics-only actions
 * (wire/twine/weight/jin/landscape) are skipped with a warning, matching the
 * web client exactly so derived stats stay identical everywhere. All methods
 * called here are BonsaiTree engine methods -- no stat math is reimplemented.
 */
function applyCurrentDayEntries(
  tree: {
    water(amount?: number): void;
    fertilize(): void;
    rotate(): void;
    prune(branchId?: number): void;
  },
  entries: CareLogEntryInput[],
): void {
  for (const { action: a } of entries) {
    if (a.type === 'water') {
      tree.water(a.amount as number | undefined);
    } else if (a.type === 'fertilize') {
      tree.fertilize();
    } else if (a.type === 'rotate') {
      tree.rotate();
    } else if (a.type === 'prune') {
      tree.prune(a.branchId as number | undefined);
    } else {
      console.warn(
        `[derive-stats] applyCurrentDayEntries: skipping action '${a.type}' - not in 2D/3D UI subset`,
      );
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405);

  const url = new URL(req.url);
  const tree_id = url.searchParams.get('tree_id');
  if (!tree_id) return json({ error: 'missing tree_id query param' }, 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  );

  // -------------------------------------------------------------------------
  // 1. Load the tree row (same table/columns pattern as get-tree).
  // -------------------------------------------------------------------------
  const { data: tree, error: treeErr } = await supabase
    .from('trees')
    .select('id, seed, species, current_day')
    .eq('id', tree_id)
    .single();

  if (treeErr || !tree) {
    return json({ error: 'tree not found' }, 404);
  }

  // -------------------------------------------------------------------------
  // 2. Load the full care log ordered by (game_day, sequence) -- same query
  //    as get-tree.
  // -------------------------------------------------------------------------
  const { data: logRows, error: logErr } = await supabase
    .from('care_log_entries')
    .select('game_day, sequence, action_type, action_data')
    .eq('tree_id', tree_id)
    .order('game_day', { ascending: true })
    .order('sequence', { ascending: true });

  if (logErr) return json({ error: logErr.message }, 500);

  // -------------------------------------------------------------------------
  // 3. Deterministic reconstruction + stat derivation via the bundled engine.
  // -------------------------------------------------------------------------
  try {
    const careLog = buildCareLog(logRows ?? []);
    const currentDay = Number(tree.current_day);

    // Actions at game_day < current_day were each followed by a tick (replay
    // them). Actions at game_day === current_day happened after the last tick
    // (apply them directly, no extra growTick). For current_day === 0,
    // reconstruct would throw (totalDays <= 0), so start from a fresh
    // BonsaiTree -- mirrors apps/web/src/main2d.ts init().
    const priorLog = careLog.filter((entry) => entry.day < currentDay);
    const currentEntries = careLog.filter((entry) => entry.day === currentDay);

    const bonsai =
      currentDay > 0
        ? CareLogReplay.reconstruct(tree.seed, tree.species, priorLog, currentDay)
        : new BonsaiTree(tree.seed, tree.species);

    applyCurrentDayEntries(bonsai, currentEntries);

    const voxelization = Voxelizer.voxelize(bonsai);
    if (url.searchParams.get('include_morphology') === '1') {
      return json({ ...(await createCombatPayload(bonsai, voxelization)), treeId: tree_id });
    }
    const { voxels, zones } = voxelization;
    const sheet = StatDeriver.derive(bonsai, voxels, tree.seed, bonsai.getAge(), zones);

    // -----------------------------------------------------------------------
    // 4. Fixture envelope -- replicate exportFixture's exact object literal
    //    (fixtures/exportFixture.mjs + fixtures/hardwood_real.json).
    // -----------------------------------------------------------------------
    return json({
      seed: tree.seed,
      species: tree.species,
      ageDays: bonsai.getAge(),
      generatedAt: new Date().toISOString(),
      stats: {
        hp: sheet.hp,
        power: sheet.power,
        endurance: sheet.endurance,
        ki: sheet.ki,
        skillSlots: sheet.skillSlots,
        skillPoints: sheet.skillPoints,
        wisdom: sheet.wisdom,
        matchPct: sheet.matchPct,
        defense: sheet.defense,
        stability: sheet.stability,
      },
    });
  } catch (err) {
    const kind = err instanceof CareLogReplayError ? 'replay error' : 'pipeline error';
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[derive-stats] ${kind}`, err);
    return json({ error: msg }, 500);
  }
});
