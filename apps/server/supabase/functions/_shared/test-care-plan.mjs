import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareCareCommit } from './care-plan.mjs';
import { moraleEnvelope, newTreeMorale } from './morale-transport.mjs';

const plantedAt = Date.parse('2026-09-22T00:00:00.000Z');

function context(overrides = {}) {
  return {
    tree: {
      id: '00000000-0000-4000-8000-000000000001',
      wallet_id: '00000000-0000-4000-8000-000000000002',
      seed: 17,
      species: 'evergreen',
      has_spirit: true,
      current_day: 0,
      born_at: new Date(plantedAt).toISOString(),
      last_ticked_at: new Date(plantedAt).toISOString(),
      spirit_morale: newTreeMorale(),
      care_revision: 0,
      ...overrides,
    },
    care_log: [],
    battle_days: [],
  };
}

test('new planting uses shared 50 morale and a qualitative transport', () => {
  assert.deepEqual(moraleEnvelope(newTreeMorale()), {
    value: 50,
    refusing: false,
    expression: 'composed',
    willingness: 'willing',
  });
});

test('fertilizer is canonically accepted, costs one item, and grants morale once', () => {
  const plan = prepareCareCommit(
    context(),
    { type: 'fertilize' },
    '00000000-0000-4000-8000-000000000003',
    plantedAt,
  );
  assert.equal(plan.action_type, 'fertilize');
  assert.equal(plan.consumable_type, 'fertilizer');
  assert.equal(plan.consumable_quantity, 1);
  assert.deepEqual(plan.morale, { value: 55, refusing: false });
  assert.equal(plan.events.length, 1);
});

test('one optimal rest day is assessed once before the requested action', () => {
  const plan = prepareCareCommit(
    context(),
    { type: 'water', amount: 8 },
    '00000000-0000-4000-8000-000000000004',
    plantedAt + 8 * 60 * 60 * 1000,
  );
  assert.equal(plan.ticks, 1);
  assert.equal(plan.current_day, 1);
  assert.equal(plan.events[0].event_key, 'day:0');
  assert.equal(plan.events[0].fact.restDay, true);
  assert.equal(plan.events[0].fact.healthStable, true);
  assert.deepEqual(plan.morale, { value: 55, refusing: false });
});

test('battle-marked day does not receive the rest bonus', () => {
  const c = context();
  c.battle_days = [0];
  const plan = prepareCareCommit(
    c,
    { type: 'water', amount: 8 },
    '00000000-0000-4000-8000-000000000005',
    plantedAt + 8 * 60 * 60 * 1000,
  );
  assert.equal(plan.events[0].fact.restDay, false);
  assert.deepEqual(plan.morale, { value: 52, refusing: false });
});

test('same state, request and time produce the same commit plan', () => {
  const args = [context(), { type: 'water', amount: 8 },
    '00000000-0000-4000-8000-000000000006', plantedAt];
  assert.deepEqual(prepareCareCommit(...args), prepareCareCommit(...args));
});

test('landscape remains a valid replayable care action with no invented consumable', () => {
  const plan = prepareCareCommit(
    context(),
    { type: 'landscape', elementType: 'rock', position: { x: 2, y: 0, z: 3 } },
    '00000000-0000-4000-8000-000000000009',
    plantedAt,
  );
  assert.equal(plan.action_type, 'landscape');
  assert.equal(plan.consumable_type, null);
  assert.equal(plan.consumable_quantity, 0);
});

test('invalid or effectless actions are rejected before SQL mutation', () => {
  assert.throws(() => prepareCareCommit(context(), { type: 'prune', branchId: 999 },
    '00000000-0000-4000-8000-000000000007', plantedAt), /no effect|invalid|not found|must be/i);
  assert.throws(() => prepareCareCommit(context(), { type: 'battle-win' },
    '00000000-0000-4000-8000-000000000008', plantedAt), /Invalid action type/);
});
