/**
 * Live spirit state, separate from TreeState, StatSheet and morphology hashes.
 * Pure rules only: the authoritative server must validate, persist and deduplicate
 * facts in the same transaction as the relevant care/result/inventory changes.
 */
export interface MoraleState {
  readonly value: number;
  /** Persist this latch: value alone cannot distinguish recovery from low morale. */
  readonly refusing: boolean;
}

export type MoraleExpression = 'eager' | 'composed' | 'reluctant' | 'withdrawn';
export type MoraleAdmission =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: 'below-refusal-threshold' | 'recovering' };

/** Qualitative caretaker transport; intentionally no numeric morale. */
export interface MoraleCareView {
  readonly expression: MoraleExpression;
  readonly willingness: 'willing' | 'recovering' | 'withdrawn';
}

/**
 * Server-assessed facts, never raw client requests. These names do not prove
 * authorization or successful execution. No replay protection exists here.
 */
export type MoraleEvent =
  | { readonly type: 'care-day-completed'; readonly moisture: number;
      readonly healthStable: boolean; readonly restDay: boolean }
  | { readonly type: 'prune-committed' }
  | { readonly type: 'fertilizer-applied' }
  | { readonly type: 'victory-recorded' }
  | { readonly type: 'consecutive-loss-recorded' }
  | { readonly type: 'battle-fought'; readonly treeHealth: number }
  | { readonly type: 'soothing-potion-consumed' }
  | { readonly type: 'ronin-burn-confirmed'; readonly restoration: number };

function percentage(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new RangeError(`${name} must be a finite number from 0 to 100`);
  }
  return value;
}

function booleanFact(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw new TypeError(`${name} must be boolean`);
  return value;
}

/** Validate JSON and canonicalize the latch at the absolute thresholds. */
export function readMoraleState(input: unknown): MoraleState {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('morale state must be an object');
  }
  const record = input as Record<string, unknown>;
  const value = percentage(record.value, 'morale value');
  const refusing = booleanFact(record.refusing, 'morale refusing');
  return { value, refusing: value < 20 || (refusing && value < 50) };
}

/** New planting only. Never a fallback, claim/reset or existing-tree backfill. */
export function createNewTreeMorale(): MoraleState {
  return { value: 50, refusing: false };
}

export function getMoraleAdmission(input: MoraleState): MoraleAdmission {
  const state = readMoraleState(input);
  if (state.value < 20) return { allowed: false, reason: 'below-refusal-threshold' };
  if (state.refusing) return { allowed: false, reason: 'recovering' };
  return { allowed: true };
}

export function getMoraleExpression(input: MoraleState): MoraleExpression {
  const { value } = readMoraleState(input);
  if (value < 20) return 'withdrawn';
  if (value < 40) return 'reluctant';
  if (value <= 70) return 'composed';
  return 'eager';
}

export function getMoraleCareView(input: MoraleState): MoraleCareView {
  const admission = getMoraleAdmission(input);
  return {
    expression: getMoraleExpression(input),
    willingness: admission.allowed ? 'willing'
      : admission.reason === 'recovering' ? 'recovering' : 'withdrawn',
  };
}

/**
 * Apply one validated fact. Care is never gated by morale. Daily changes are
 * netted once: server-assessed healthStable/restDay avoid inventing thresholds
 * or a clock here. Fertilizer requires accepted growth effect under its existing
 * cooldown. Ronin amount must come from an approved server policy after burn
 * confirmation; window, diminishing returns and chain verification are external.
 */
export function applyMoraleEvent(input: MoraleState, event: MoraleEvent): MoraleState {
  const state = readMoraleState(input);
  if (event === null || typeof event !== 'object') {
    throw new TypeError('morale event must be an object');
  }
  let change: number;
  switch (event.type) {
    case 'care-day-completed': {
      const moisture = percentage(event.moisture, 'moisture');
      const stable = booleanFact(event.healthStable, 'healthStable');
      const rest = booleanFact(event.restDay, 'restDay');
      change = (moisture >= 30 && moisture <= 65 && stable ? 2 : 0)
        + (rest ? 3 : 0) - (moisture < 20 || moisture > 80 ? 3 : 0);
      break;
    }
    case 'prune-committed': change = 8; break;
    case 'fertilizer-applied': change = 5; break;
    case 'victory-recorded': change = 10; break;
    case 'consecutive-loss-recorded': change = -15; break;
    case 'battle-fought': change = percentage(event.treeHealth, 'treeHealth') < 40 ? -5 : 0; break;
    case 'soothing-potion-consumed': change = 100 - state.value; break;
    case 'ronin-burn-confirmed': {
      const restoration = percentage(event.restoration, 'Ronin restoration');
      change = Math.min(restoration, Math.max(0, 65 - state.value));
      break;
    }
    default: throw new TypeError('unknown morale event type');
  }
  const value = Math.max(0, Math.min(100, state.value + change));
  return readMoraleState({ value, refusing: state.refusing });
}
