import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createNewTreeMorale, readMoraleState, getMoraleAdmission,
  getMoraleExpression, getMoraleCareView, applyMoraleEvent,
} from './dist/index.js';

const state = (value, refusing = false) => ({ value, refusing });
const event = type => ({ type });
const careDay = (moisture = 50, healthStable = true, restDay = true) =>
  ({ type: 'care-day-completed', moisture, healthStable, restDay });
const ronin = restoration => ({ type: 'ronin-burn-confirmed', restoration });

test('M1: newly planted spirits start at approved 50; existing state is never defaulted', () => {
  const a = createNewTreeMorale(), b = createNewTreeMorale();
  assert.deepEqual(a, state(50));
  assert.notEqual(a, b);
  for (const missing of [undefined, null, {}, []]) assert.throws(() => readMoraleState(missing));
});

test('M2: exact admission boundaries and persisted refusal latch', () => {
  assert.deepEqual(getMoraleAdmission(state(20)), { allowed: true });
  assert.deepEqual(getMoraleAdmission(state(19.999)), { allowed: false, reason: 'below-refusal-threshold' });
  for (const value of [20, 40, 49.999]) {
    const restored = readMoraleState(JSON.parse(JSON.stringify(state(value, true))));
    assert.equal(restored.refusing, true);
    assert.deepEqual(getMoraleAdmission(restored), { allowed: false, reason: 'recovering' });
  }
  assert.deepEqual(readMoraleState(state(50, true)), state(50));
  assert.equal(getMoraleAdmission(state(50, true)).allowed, true);
});

test('M3: three confirmed losses from 50 cross refusal only on the third', () => {
  let spirit = createNewTreeMorale();
  for (const [value, allowed] of [[35, true], [20, true], [5, false]]) {
    spirit = applyMoraleEvent(spirit, event('consecutive-loss-recorded'));
    assert.equal(spirit.value, value);
    assert.equal(getMoraleAdmission(spirit).allowed, allowed);
  }
  for (let day = 0; day < 8; day++) spirit = applyMoraleEvent(spirit, careDay());
  assert.deepEqual(spirit, state(45, true));
  spirit = applyMoraleEvent(spirit, careDay(50, true, false));
  spirit = applyMoraleEvent(spirit, careDay(50, true, false));
  assert.deepEqual(spirit, state(49, true));
  assert.equal(getMoraleAdmission(spirit).allowed, false);
  spirit = applyMoraleEvent(spirit, ronin(1));
  assert.deepEqual(spirit, state(50));
  assert.equal(getMoraleAdmission(spirit).allowed, true);
});

test('M4: sustained care recovers gradually all the way to 100', () => {
  let spirit = state(0, true);
  for (let day = 1; day <= 20; day++) {
    spirit = applyMoraleEvent(spirit, careDay());
    assert.equal(spirit.value, day * 5);
    assert.equal(spirit.refusing, day < 10);
  }
  assert.deepEqual(applyMoraleEvent(spirit, careDay()), state(100));
});

test('M5: daily moisture edges, stable-health condition and net rest/stress', () => {
  for (const moisture of [30, 65]) assert.equal(applyMoraleEvent(state(50), careDay(moisture, true, false)).value, 52);
  for (const moisture of [20, 29.999, 65.001, 80]) assert.equal(applyMoraleEvent(state(50), careDay(moisture, true, false)).value, 50);
  for (const moisture of [0, 19.999, 80.001, 100]) {
    assert.equal(applyMoraleEvent(state(50), careDay(moisture, true, false)).value, 47);
    assert.equal(applyMoraleEvent(state(20), careDay(moisture, true, true)).value, 20);
    assert.equal(applyMoraleEvent(state(20), careDay(moisture, true, true)).refusing, false);
  }
  assert.equal(applyMoraleEvent(state(50), careDay(50, false, false)).value, 50);
  assert.equal(applyMoraleEvent(state(50), careDay(50, false, true)).value, 53);
});

test('M6: confirmed care remains available while withdrawn and applies known gains', () => {
  assert.deepEqual(applyMoraleEvent(state(0, true), event('prune-committed')), state(8, true));
  assert.deepEqual(applyMoraleEvent(state(0, true), event('fertilizer-applied')), state(5, true));
  assert.deepEqual(applyMoraleEvent(state(98), event('prune-committed')), state(100));
  assert.deepEqual(applyMoraleEvent(state(98), event('fertilizer-applied')), state(100));
});

test('M7: victory, low-health battle and loss floors', () => {
  assert.deepEqual(applyMoraleEvent(state(95), event('victory-recorded')), state(100));
  assert.deepEqual(applyMoraleEvent(state(5, true), event('consecutive-loss-recorded')), state(0, true));
  assert.deepEqual(applyMoraleEvent(state(24), { type: 'battle-fought', treeHealth: 39.999 }), state(19, true));
  assert.deepEqual(applyMoraleEvent(state(24), { type: 'battle-fought', treeHealth: 40 }), state(24));
});

test('M8: Soothing Leaf Potion immediately restores 100 and clears refusal', () => {
  for (const value of [0, 19, 49, 65, 100]) {
    assert.deepEqual(applyMoraleEvent(state(value, value < 50), event('soothing-potion-consumed')), state(100));
  }
});

test('M9: explicit Ronin amount is capped at 65 without reducing higher care-earned morale', () => {
  assert.deepEqual(applyMoraleEvent(state(40, true), ronin(25)), state(65));
  assert.deepEqual(applyMoraleEvent(state(10, true), ronin(25)), state(35, true));
  for (const value of [65, 70, 100]) assert.deepEqual(applyMoraleEvent(state(value), ronin(25)), state(value));
  assert.deepEqual(applyMoraleEvent(state(64.5), ronin(25)), state(65));
  assert.deepEqual(applyMoraleEvent(state(35, true), ronin(0)), state(35, true));
});

test('M10: expression boundaries and qualitative care transport preserve recovery distinction', () => {
  for (const [value, expected] of [[0, 'withdrawn'], [19.999, 'withdrawn'], [20, 'reluctant'],
    [39.999, 'reluctant'], [40, 'composed'], [70, 'composed'], [70.001, 'eager'], [100, 'eager']]) {
    assert.equal(getMoraleExpression(state(value)), expected);
  }
  assert.deepEqual(getMoraleCareView(state(40, true)), { expression: 'composed', willingness: 'recovering' });
  assert.deepEqual(getMoraleCareView(state(40)), { expression: 'composed', willingness: 'willing' });
  assert.deepEqual(getMoraleCareView(state(0, true)), { expression: 'withdrawn', willingness: 'withdrawn' });
});

test('M11: nonfinite/out-of-range values and malformed runtime facts are rejected', () => {
  const invalid = [NaN, Infinity, -Infinity, -0.001, 100.001, '50', null, undefined];
  for (const value of invalid) {
    assert.throws(() => readMoraleState(state(value)));
    assert.throws(() => applyMoraleEvent(state(50), { ...careDay(), moisture: value }));
    assert.throws(() => applyMoraleEvent(state(50), ronin(value)));
    assert.throws(() => applyMoraleEvent(state(50), { type: 'battle-fought', treeHealth: value }));
  }
  for (const flag of [undefined, null, 0, 1, 'true']) {
    assert.throws(() => readMoraleState({ value: 30, refusing: flag }));
    assert.throws(() => applyMoraleEvent(state(50), { ...careDay(), healthStable: flag }));
    assert.throws(() => applyMoraleEvent(state(50), { ...careDay(), restDay: flag }));
  }
  for (const bad of [null, undefined, {}, [], { type: 'water-request' }]) {
    assert.throws(() => applyMoraleEvent(state(50), bad));
  }
});

test('M12: input and event remain immutable; outputs contain no stats or morphology', () => {
  const input = Object.freeze(state(19, true));
  const fact = Object.freeze(careDay());
  assert.deepEqual(applyMoraleEvent(input, fact), state(24, true));
  assert.deepEqual(input, state(19, true));
  assert.deepEqual(fact, careDay());
  assert.deepEqual(Object.keys(applyMoraleEvent(input, fact)).sort(), ['refusing', 'value']);
});

test('M13: repeatable pure replay; duplicate facts are deliberately NOT deduplicated here', () => {
  const facts = [event('consecutive-loss-recorded'), event('consecutive-loss-recorded'),
    event('consecutive-loss-recorded'), careDay(), event('prune-committed'),
    event('soothing-potion-consumed'), event('consecutive-loss-recorded')];
  const replay = () => facts.reduce(applyMoraleEvent, createNewTreeMorale());
  assert.equal(JSON.stringify(replay()), JSON.stringify(replay()));
  const once = applyMoraleEvent(state(50), event('prune-committed'));
  assert.equal(once.value, 58);
  assert.equal(applyMoraleEvent(once, event('prune-committed')).value, 66);
});
