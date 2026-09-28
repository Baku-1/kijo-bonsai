import { BonsaiTree, CareLogReplay, GrowthEngine, applyMoraleEvent, readMoraleState } from '../derive-stats/engine.bundle.mjs';

export const GAME_DAY_MS = 8 * 60 * 60 * 1000;
export const MAX_LAZY_TICKS = 90;
const TYPES = new Set(['water', 'rotate', 'prune', 'fertilize', 'wire', 'wire-remove',
  'twine', 'twine-remove', 'weight', 'weight-remove', 'jin', 'landscape']);

function finite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(label + ' must be finite');
  return value;
}
function branch(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('branchId must be a non-negative integer');
  return value;
}

/** Run the canonical engine operation. Its own accepted log is the persisted action. */
export function applyCanonicalAction(tree, action, requireEffect = false) {
  if (!action || typeof action !== 'object' || !TYPES.has(action.type)) throw new Error('Invalid action type');
  const before = tree.getCareLog().length;
  let result;
  switch (action.type) {
    case 'water': tree.water(finite(action.amount, 'amount')); break;
    case 'rotate': tree.rotate(); break;
    case 'prune': result = tree.prune(branch(action.branchId)); break;
    case 'fertilize': tree.fertilize(); break;
    case 'wire': result = tree.wire(branch(action.branchId), finite(action.angleDelta, 'angleDelta')); break;
    case 'wire-remove': tree.removeWire(branch(action.branchId)); break;
    case 'twine': result = tree.applyTwine(branch(action.branchId), finite(action.angleDelta, 'angleDelta'), action.degradeDays); break;
    case 'twine-remove': tree.removeTwine(branch(action.branchId)); break;
    case 'weight': result = tree.applyWeight(branch(action.branchId), action.weightCount); break;
    case 'weight-remove': tree.removeWeight(branch(action.branchId)); break;
    case 'jin': result = tree.applyJin(branch(action.branchId), action.segmentIndex, action.jinCost); break;
    case 'landscape':
      if (!['rock', 'moss', 'pot'].includes(action.elementType)) throw new Error('Invalid landscape element');
      tree.addLandscape(action.elementType, action.position); break;
  }
  const accepted = tree.getCareLog().slice(before);
  if (requireEffect && (result === false || result?.ok === false || accepted.length !== 1)) {
    throw new Error(result?.reason ?? 'Care action had no effect (invalid branch or cooldown)');
  }
  return accepted.at(-1)?.action ?? null;
}

export function reconstructCareTree(treeRow, rows) {
  const day = treeRow.current_day;
  if (!Number.isSafeInteger(day) || day < 0 || day > 36500) throw new Error('Invalid current_day');
  const entries = [...rows].sort((a, b) => a.game_day - b.game_day || a.sequence - b.sequence)
    .filter(row => row.action_type !== 'tick')
    .map(row => ({ day: row.game_day, action: { ...row.action_data, type: row.action_type } }));
  const tree = day > 0
    ? CareLogReplay.reconstruct(treeRow.seed, treeRow.species, entries.filter(e => e.day < day), day)
    : new BonsaiTree(treeRow.seed, treeRow.species);
  for (const entry of entries.filter(e => e.day === day)) applyCanonicalAction(tree, entry.action);
  return tree;
}

/**
 * Pure preparation. The RPC performs the compare-and-swap commit under row lock.
 * No plan/after-state submitted by a client is accepted by the HTTP handler.
 */
export function prepareCareCommit(context, action, requestId, nowMs) {
  const row = context.tree;
  const tree = reconstructCareTree(row, context.care_log);
  const last = Date.parse(row.last_ticked_at ?? row.born_at);
  if (!Number.isFinite(last) || !Number.isFinite(nowMs)) throw new Error('Invalid tree clock');
  const elapsed = Math.max(0, Math.floor((nowMs - last) / GAME_DAY_MS));
  const ticks = Math.min(elapsed, MAX_LAZY_TICKS);
  if (row.current_day + ticks > 36500) throw new Error('Tree exceeds replay bound');
  let morale = readMoraleState(row.spirit_morale);
  const events = [];
  const battleDays = new Set(context.battle_days ?? []);
  for (let i = 0; i < ticks; i++) {
    const day = tree.getAge();
    const preHealth = tree.getHealth();
    GrowthEngine.growTick(tree);
    const fact = { type: 'care-day-completed', moisture: tree.getMoisture(),
      healthStable: tree.getHealth() >= preHealth, restDay: !battleDays.has(day) };
    morale = applyMoraleEvent(morale, fact);
    events.push({ event_key: 'day:' + day, game_day: day, fact, after: morale });
  }
  // Live twine gets its random duration from the canonical engine, not the client.
  const requested = { ...action };
  if (requested.type === 'twine') delete requested.degradeDays;
  const canonical = applyCanonicalAction(tree, requested, true);
  let fact = null;
  if (canonical.type === 'prune') fact = { type: 'prune-committed' };
  if (canonical.type === 'fertilize') fact = { type: 'fertilizer-applied' };
  if (fact) {
    morale = applyMoraleEvent(morale, fact);
    events.push({ event_key: 'care:' + requestId, game_day: tree.getAge(), fact, after: morale });
  }
  const item = { prune: 'shears', wire: 'wire', fertilize: 'fertilizer' }[canonical.type] ?? null;
  const quantity = canonical.type === 'wire' ? canonical.wireCost
    : item ? 1 : 0;
  if (!Number.isSafeInteger(quantity) || quantity < 0) throw new Error('Invalid canonical consumable cost');
  const { type, ...data } = canonical;
  return {
    ticks, elapsed_days: elapsed, current_day: tree.getAge(),
    last_ticked_at: new Date(last + ticks * GAME_DAY_MS).toISOString(),
    action_type: type, action_data: data, consumable_type: item, consumable_quantity: quantity,
    morale, events,
  };
}
