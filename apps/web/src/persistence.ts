// ---------------------------------------------------------------------------
// persistence.ts — Supabase wiring shared by the 2D and 3D care-loop pages.
//
// Responsibilities:
//   1. Read session (tree_id + JWT) from sessionStorage / URL params.
//   2. loadCareLog(treeId) — GET get-tree, map DB rows → CareLogEntry[].
//   3. persistCareAction(session, action) — POST care-action with JWT.
//   4. applyCurrentDayEntries(tree, entries) — apply "tail" actions that
//      occurred after the last tick without calling growTick again.
//      Used by both main2d.ts and main3d.ts after CareLogReplay.reconstruct.
//
// Auth model:
//   The React app (WalletBar → useWalletAuth) writes a KijoSession object to
//   sessionStorage under SESSION_KEY after a successful wallet sign-in.
//   Both debug pages read it on mount.  The URL param ?tree_id=<uuid> lets
//   you override / specify the tree without exposing the JWT in the URL.
//
// Edge function URLs:
//   get-tree    — public (verify_jwt: false) — safe to call without token
//   care-action — requires JWT (verify_jwt: false at the Supabase level, but
//                 the function itself checks Authorization header explicitly)
//
// Project ref: xutjubkaskwchzyzwryk
// ---------------------------------------------------------------------------

import type { CareAction, CareLogEntry } from '@kijo/shared';
export type { CareLogEntry } from '@kijo/shared';
import { BonsaiTree } from '@kijo/engine';

const BASE = 'https://xutjubkaskwchzyzwryk.supabase.co/functions/v1';
const GET_TREE_URL  = `${BASE}/get-tree`;
const CARE_ACTION_URL = `${BASE}/care-action`;

// ---------------------------------------------------------------------------
// Session shape — mirrors what the React app writes after useWalletAuth.signIn
// ---------------------------------------------------------------------------
export const SESSION_KEY = 'kijo_session';

export interface KijoSession {
  tree_id: string;
  /** Supabase JWT returned by wallet-auth Edge Function. Empty → read-only mode. */
  access_token: string;
  /** UUID of the wallet row in the `wallets` table (user.id or user_metadata.wallet_row_id). */
  wallet_row_id: string;
}

/**
 * Read session from sessionStorage, with ?tree_id URL param taking precedence
 * for the tree identity (so you can deep-link to a tree without exposing the JWT
 * in the URL).
 *
 * Returns null when neither sessionStorage nor URL param is present — the page
 * then operates in guest / local-only mode.
 *
 * Returns a session with empty access_token / wallet_row_id when only tree_id
 * is available — the page can load (read-only) but cannot persist care actions.
 */
export function getSession(): KijoSession | null {
  const params = new URLSearchParams(window.location.search);
  const urlTreeId = params.get('tree_id');

  const raw = sessionStorage.getItem(SESSION_KEY);
  if (raw) {
    try {
      const s = JSON.parse(raw) as KijoSession;
      // URL param overrides stored tree_id so a link like ?tree_id=<uuid>
      // opens the right tree even if the session has a different one.
      if (urlTreeId) s.tree_id = urlTreeId;
      return s;
    } catch {
      // Malformed JSON in sessionStorage — ignore and fall through.
    }
  }

  // No session stored — can still load a tree read-only if tree_id is in URL.
  if (urlTreeId) {
    return { tree_id: urlTreeId, access_token: '', wallet_row_id: '' };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Raw shape returned by the get-tree Edge Function.
// ---------------------------------------------------------------------------
export interface GetTreeRow {
  game_day: number;
  sequence: number;
  action_type: string;
  action_data: Record<string, unknown>;
}

export interface GetTreeResponse {
  tree_id: string;
  seed: number;
  species: string;
  current_day: number;
  has_spirit: boolean;
  born_at: string;
  care_log: GetTreeRow[];
}

// ---------------------------------------------------------------------------
// CareAction validation — type guard used by loadCareLog to reject corrupted
// or unexpected DB rows before they reach the replay engine.
//
// CARE_ACTION_TYPES is type-checked against CareAction['type'] via `satisfies`;
// TypeScript will error at build time if any element in the list is not a valid
// discriminant from the union defined in @kijo/shared.
//
// Note: the guard only checks the discriminant ('type' field). Full payload
// validation (e.g., required numeric fields per variant) is deferred to Phase 2.
// ---------------------------------------------------------------------------
const CARE_ACTION_TYPES = [
  'water', 'rotate', 'prune', 'fertilize',
  'wire', 'wire-remove', 'twine', 'twine-remove',
  'weight', 'weight-remove', 'jin', 'landscape',
] as const satisfies ReadonlyArray<CareAction['type']>;

// PHASE-2 TODO (exhaustiveness): `satisfies` above only proves list elements are
// valid CareAction types — it does NOT prove every variant is covered.  If a new
// CareAction variant is added to @kijo/shared but forgotten here, valid DB rows
// are silently skipped at load time.  Add the following type alias before Phase 2
// extends the CareAction union:
//
//   type _CareActionTypesExhaustive =
//     CareAction['type'] extends typeof CARE_ACTION_TYPES[number] ? true : never;
//
// That makes tsc error on any missing variant.

function validateCareAction(obj: unknown): obj is CareAction {
  if (typeof obj !== 'object' || obj === null) return false;
  const type = (obj as Record<string, unknown>)['type'];
  return (
    typeof type === 'string' &&
    (CARE_ACTION_TYPES as ReadonlyArray<string>).includes(type)
  );
}

/**
 * Fetch a tree's state and care log from the get-tree Edge Function.
 *
 * Returns:
 *   treeData  — raw server response (seed, species, current_day, etc.)
 *   careLog   — CareLogEntry[] with 'tick' rows filtered out.
 *
 * 'tick' rows (action_type === 'tick') are inserted by the server's lazy-tick
 * logic to record elapsed game days.  They are NOT player-initiated CareActions;
 * CareLogReplay.reconstruct() handles growth ticks itself (one growTick() call
 * per loop iteration).  Including them in careLog would cause an exhaustiveness
 * error in the replay dispatcher.
 *
 * Semantic invariant: actions at game_day < current_day have had a tick applied
 * after them; actions at game_day === current_day are "current" — applied after
 * the most recent tick but before the next one.  The caller is responsible for
 * splitting on current_day (see init() in main2d.ts).
 */
export async function loadCareLog(treeId: string): Promise<{
  treeData: GetTreeResponse;
  careLog: CareLogEntry[];
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(
      `${GET_TREE_URL}?tree_id=${encodeURIComponent(treeId)}`,
      { signal: controller.signal },
    );
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error ?? `get-tree failed: ${res.status}`);
    }
    const data = (await res.json()) as GetTreeResponse;

    const careLog: CareLogEntry[] = data.care_log
      .filter((row) => row.action_type !== 'tick')
      // Sort by (game_day, sequence) so actions within a day replay in insertion
      // order.  The server should return rows ordered, but an explicit sort here
      // makes correctness independent of server return order — important because
      // CareLogReplay.reconstruct applies per-day entries in array order.
      .sort((a, b) => a.game_day - b.game_day || a.sequence - b.sequence)
      .flatMap((row) => {
        // Reconstruct the discriminated union: type from action_type, rest from
        // action_data.  Validate before including — a corrupted or unrecognised
        // DB row is skipped with a warning rather than crashing at replay time.
        // PHASE-2 TODO (spread ordering): type must come LAST so it always wins
        // even if action_data ever contains a stale 'type' key (e.g. schema
        // migration bug).  Change to: { ...row.action_data, type: row.action_type }
        // Not a current risk (Edge Function strips 'type' from action_data), but
        // safe to fix before any external writers touch the care_log table.
        const candidate = { type: row.action_type, ...row.action_data };
        if (!validateCareAction(candidate)) {
          console.warn('[kijo] loadCareLog: skipping invalid DB row', row);
          return [];
        }
        return [{ day: row.game_day, action: candidate }];
      });

    return { treeData: data, careLog };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POST a care action to the care-action Edge Function.
 *
 * Requires session.access_token and session.wallet_row_id to be non-empty —
 * throws immediately if either is missing so the caller can treat this as a
 * hard guard rather than silently dropping the action.
 *
 * On success the server may have advanced current_day (lazy tick).  The caller
 * can use elapsed_days to decide whether to show a "tree grew N days" notice,
 * but for the 2D debug page this is informational only.
 */
export async function persistCareAction(
  session: KijoSession,
  action: CareAction,
): Promise<{ current_day: number; elapsed_days: number }> {
  if (!session.access_token || !session.wallet_row_id) {
    throw new Error(
      'persistCareAction: no access_token or wallet_row_id — session is read-only',
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch(CARE_ACTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        tree_id: session.tree_id,
        wallet_row_id: session.wallet_row_id,
        action,
      }),
      signal: controller.signal,
    });

    const data = (await res.json()) as {
      ok?: boolean;
      current_day?: number;
      elapsed_days?: number;
      error?: string;
    };

    if (!res.ok || !data.ok) {
      throw new Error(data.error ?? `care-action failed: ${res.status}`);
    }

    return {
      current_day: data.current_day ?? 0,
      elapsed_days: data.elapsed_days ?? 0,
    };
  } catch (err) {
    // Timeout: fire-and-forget callers should not see this as an error.
    // The action was not persisted; local tree state is still consistent.
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.warn('[kijo] persistCareAction: timed out after 5s — action not persisted');
      return { current_day: 0, elapsed_days: 0 };
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// applyCurrentDayEntries — apply "tail" care actions without a growTick.
//
// Used by both main2d.ts and main3d.ts after CareLogReplay.reconstruct().
// CareLogReplay handles past-day entries (game_day < current_day, each
// followed by a tick on the server).  Actions at game_day === current_day
// happened AFTER the last tick and must be applied directly to the returned
// tree — no extra growTick, or the tree advances one day beyond the server.
//
// When current_day === 0 (no ticks yet) this is also used for day-0 actions
// instead of reconstruct (which throws on totalDays <= 0).
//
// Scope: only the subset of CareActions available in the 2D/3D UI.  Other
// types (wire, twine, weight, jin, landscape) are logged as warnings — they
// cannot originate from these pages, but may appear if another client used
// the same tree.  Skipping them is safe because the 2D/3D renderer does not
// display the physics-only state they modify.
// ---------------------------------------------------------------------------
export function applyCurrentDayEntries(
  tree: BonsaiTree,
  entries: CareLogEntry[],
): void {
  for (const { action: a } of entries) {
    if (a.type === 'water') {
      tree.water(a.amount);
    } else if (a.type === 'fertilize') {
      tree.fertilize();
    } else if (a.type === 'rotate') {
      tree.rotate();
    } else if (a.type === 'prune') {
      tree.prune(a.branchId);
    } else {
      // wire, wire-remove, twine, twine-remove, weight, weight-remove, jin, landscape
      console.warn(
        `[kijo] applyCurrentDayEntries: skipping action '${(a as { type: string }).type}' ` +
        `— not available in 2D/3D debug view`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Local tree cache — survives full-page navigation via sessionStorage.
//
// The server drives current_day by wall-clock time.  Local "Next Day" button
// advances are intentionally NOT persisted to Supabase.  Without this cache
// navigating to index3d.html and back rebuilds from the server's current_day
// which discards all local growth — the tree appears reset.
//
// On every mutation we snapshot {seed, species, age, careLog} into
// sessionStorage.  On page load, if a matching cache exists we reconstruct
// from it instead of hitting the server, preserving the full local state.
// sessionStorage is tab-scoped so this only applies to in-tab navigations.
// ---------------------------------------------------------------------------
const LOCAL_CACHE_KEY = 'kijo_tree_cache';

export interface LocalTreeCache {
  tree_id: string | null;
  seed: number;
  species: string;
  /** tree.getAge() — includes local day advances beyond server current_day. */
  age: number;
  /** All care actions applied (server-loaded + locally-applied). */
  careLog: CareLogEntry[];
}

export function saveTreeCache(
  treeId: string | null,
  seed: number,
  species: string,
  age: number,
  careLog: CareLogEntry[],
): void {
  try {
    sessionStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify({
      tree_id: treeId, seed, species, age, careLog,
    } satisfies LocalTreeCache));
  } catch { /* sessionStorage quota exceeded — non-fatal */ }
}

export function loadTreeCache(): LocalTreeCache | null {
  try {
    const raw = sessionStorage.getItem(LOCAL_CACHE_KEY);
    return raw ? JSON.parse(raw) as LocalTreeCache : null;
  } catch { return null; }
}

export function clearTreeCache(): void {
  sessionStorage.removeItem(LOCAL_CACHE_KEY);
}
