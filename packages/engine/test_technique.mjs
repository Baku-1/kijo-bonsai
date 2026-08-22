/**
 * Gate tests for TechniqueClassifier (T1-T19).
 * Run after: npm run build --workspace=packages/engine
 * Command: node packages/engine/test_technique.mjs (from repo root)
 *
 * Coverage: primary classification (T1-T7), overlay classification (T8-T12),
 * count fields (T13), adversarial inputs (T14-T18), determinism (T19).
 * Spec: docs/ARCHITECT-CAREACTION-TECHNIQUE-2026-07-30.md §3,
 *       docs/DESIGN-TECHNIQUE-CLASSIFICATION.md (authoritative).
 */
import { TechniqueClassifier } from './dist/TechniqueClassifier.js';

let passed = 0, failed = 0;

function assert(cond, name, detail = '') {
  if (cond) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name}${detail ? ': ' + detail : ''}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Minimal CareLogEntry factory helpers — TechniqueClassifier only reads
// entry.action.type, so required sibling fields are filled with safe defaults.
// ---------------------------------------------------------------------------

function wireEntry(branchId = 0) {
  return { day: 1, action: { type: 'wire', branchId, angleDelta: 10, oldAngle: 0, newAngle: 10, wireCost: 1 } };
}

function wireRemoveEntry(branchId = 0) {
  return { day: 2, action: { type: 'wire-remove', branchId } };
}

function twineEntry(branchId = 0) {
  return { day: 1, action: { type: 'twine', branchId, angleDelta: 5, oldAngle: 0, newAngle: 5, degradeDays: 10 } };
}

function jinEntry(branchId = 0) {
  return { day: 1, action: { type: 'jin', branchId, segmentIndex: 0, jinCost: 1 } };
}

/** Returns n landscape CareLogEntry objects (an array). */
function landscapeEntries(n) {
  return Array.from({ length: n }, (_, i) => ({
    day: i + 1,
    action: { type: 'landscape', elementType: 'rock', position: { x: 0, y: 0, z: 0 } },
  }));
}

/** Returns n prune CareLogEntry objects (an array). */
function pruneEntries(n) {
  return Array.from({ length: n }, (_, i) => ({
    day: i + 1,
    action: { type: 'prune', branchId: i },
  }));
}

// ---------------------------------------------------------------------------
// T1 — Empty care log → Bound-and-Cut, all counts 0
// ---------------------------------------------------------------------------
console.log('\nT1 — Empty care log → Bound-and-Cut, all counts 0');
{
  const r = TechniqueClassifier.classify([], 100);
  assert(r.primary === 'Bound-and-Cut',   'primary is Bound-and-Cut');
  assert(r.overlays.length === 0,         'overlays empty');
  assert(r.wireCount      === 0,          'wireCount=0');
  assert(r.pruneCount     === 0,          'pruneCount=0');
  assert(r.jinCount       === 0,          'jinCount=0');
  assert(r.landscapeCount === 0,          'landscapeCount=0');
}

// ---------------------------------------------------------------------------
// T2 — Wire use + prune≥2 + age≥30 → Bound-and-Cut (wire disqualifies C&G)
// ---------------------------------------------------------------------------
console.log('\nT2 — Wire + prune≥2 + age≥30 → Bound-and-Cut (wire disqualifies)');
{
  const log = [wireEntry(), ...pruneEntries(2)];
  const r = TechniqueClassifier.classify(log, 30);
  assert(r.primary === 'Bound-and-Cut', 'wire disqualifies Clip-and-Grow');
  assert(r.wireCount === 1,             'wireCount=1');
}

// ---------------------------------------------------------------------------
// T3 — Zero wire + prune≥2 + age<30 → Bound-and-Cut (age gate fails)
// ---------------------------------------------------------------------------
console.log('\nT3 — Zero wire + prune≥2 + age<30 → Bound-and-Cut (age gate)');
{
  const r = TechniqueClassifier.classify(pruneEntries(2), 29);
  assert(r.primary === 'Bound-and-Cut', 'age=29 < 30 fails age gate → Bound-and-Cut');
}

// ---------------------------------------------------------------------------
// T4 — Zero wire + prune<2 + age≥30 → Bound-and-Cut (prune count fails)
// ---------------------------------------------------------------------------
console.log('\nT4 — Zero wire + prune<2 + age≥30 → Bound-and-Cut (prune gate)');
{
  const r = TechniqueClassifier.classify(pruneEntries(1), 30);
  assert(r.primary === 'Bound-and-Cut', 'pruneCount=1 < 2 fails prune gate → Bound-and-Cut');
}

// ---------------------------------------------------------------------------
// T5 — Zero wire + prune≥2 + age≥30 → Clip-and-Grow (all gates pass)
// ---------------------------------------------------------------------------
console.log('\nT5 — Zero wire + prune≥2 + age≥30 → Clip-and-Grow');
{
  const r = TechniqueClassifier.classify(pruneEntries(2), 30);
  assert(r.primary === 'Clip-and-Grow', 'all three gates pass → Clip-and-Grow');
}

// ---------------------------------------------------------------------------
// T6 — Twine-only (no wire) + prune≥2 + age≥30 → Clip-and-Grow
//      CRITICAL: twine does NOT increment wireCount (spec-authoritative rule)
// ---------------------------------------------------------------------------
console.log('\nT6 — Twine-only + prune≥2 + age≥30 → Clip-and-Grow (twine ≠ wire)');
{
  const log = [twineEntry(), ...pruneEntries(2)];
  const r = TechniqueClassifier.classify(log, 30);
  assert(r.primary === 'Clip-and-Grow', 'twine does not disqualify Clip-and-Grow');
  assert(r.wireCount === 0,             'wireCount=0 — twine NOT counted as wire');
}

// ---------------------------------------------------------------------------
// T7 — Wire-remove only (no wire-apply) + prune≥2 + age≥30 → Clip-and-Grow
//      wire-remove does NOT count toward wireCount
// ---------------------------------------------------------------------------
console.log('\nT7 — Wire-remove only + prune≥2 + age≥30 → Clip-and-Grow');
{
  const log = [wireRemoveEntry(), ...pruneEntries(2)];
  const r = TechniqueClassifier.classify(log, 30);
  assert(r.primary === 'Clip-and-Grow', 'wire-remove does not count as a wire use');
  assert(r.wireCount === 0,             'wireCount=0 — wire-remove NOT counted');
}

// ---------------------------------------------------------------------------
// T8 — jin=1 → overlays includes 'Jin'
// ---------------------------------------------------------------------------
console.log('\nT8 — jin=1 → overlays includes Jin');
{
  const r = TechniqueClassifier.classify([jinEntry()], 100);
  assert(r.overlays.includes('Jin'), "overlays includes 'Jin'");
  assert(r.jinCount === 1,           'jinCount=1');
}

// ---------------------------------------------------------------------------
// T9 — jin=0 → overlays does NOT include 'Jin'
// ---------------------------------------------------------------------------
console.log("\nT9 — jin=0 → overlays does NOT include Jin");
{
  const r = TechniqueClassifier.classify([], 100);
  assert(!r.overlays.includes('Jin'), "overlays does not include 'Jin'");
}

// ---------------------------------------------------------------------------
// T10 — landscape=3 → overlays includes 'Water-and-Land'
// ---------------------------------------------------------------------------
console.log('\nT10 — landscape=3 → overlays includes Water-and-Land');
{
  const r = TechniqueClassifier.classify(landscapeEntries(3), 100);
  assert(r.overlays.includes('Water-and-Land'), "overlays includes 'Water-and-Land'");
  assert(r.landscapeCount === 3,               'landscapeCount=3');
}

// ---------------------------------------------------------------------------
// T11 — landscape=2 → overlays does NOT include 'Water-and-Land'
// ---------------------------------------------------------------------------
console.log('\nT11 — landscape=2 → overlays does NOT include Water-and-Land');
{
  const r = TechniqueClassifier.classify(landscapeEntries(2), 100);
  assert(!r.overlays.includes('Water-and-Land'), "overlays does not include 'Water-and-Land'");
  assert(r.landscapeCount === 2,                'landscapeCount=2');
}

// ---------------------------------------------------------------------------
// T12 — jin≥1 AND landscape≥3 → both overlays present simultaneously
// ---------------------------------------------------------------------------
console.log('\nT12 — jin≥1 AND landscape≥3 → both overlays present');
{
  const log = [jinEntry(), ...landscapeEntries(3)];
  const r = TechniqueClassifier.classify(log, 100);
  assert(r.overlays.includes('Jin'),             "overlays includes 'Jin'");
  assert(r.overlays.includes('Water-and-Land'),  "overlays includes 'Water-and-Land'");
  assert(r.overlays.length === 2,                'exactly 2 overlays');
}

// ---------------------------------------------------------------------------
// T13 — All count fields returned correctly
// ---------------------------------------------------------------------------
console.log('\nT13 — Count fields correct');
{
  const log = [
    wireEntry(), wireEntry(),                        // wireCount = 2
    ...pruneEntries(3),                              // pruneCount = 3
    jinEntry(), jinEntry(), jinEntry(),              // jinCount = 3
    ...landscapeEntries(4),                          // landscapeCount = 4
  ];
  const r = TechniqueClassifier.classify(log, 55);
  assert(r.wireCount      === 2,  `wireCount=2 (got ${r.wireCount})`);
  assert(r.pruneCount     === 3,  `pruneCount=3 (got ${r.pruneCount})`);
  assert(r.jinCount       === 3,  `jinCount=3 (got ${r.jinCount})`);
  assert(r.landscapeCount === 4,  `landscapeCount=4 (got ${r.landscapeCount})`);
  assert(r.treeAgeDays    === 55, `treeAgeDays=55 (got ${r.treeAgeDays})`);
}

// ---------------------------------------------------------------------------
// T14 — treeAgeDays=0 → Bound-and-Cut (age gate: 0 >= 30 is false)
// ---------------------------------------------------------------------------
console.log('\nT14 — treeAgeDays=0 → Bound-and-Cut');
{
  const r = TechniqueClassifier.classify(pruneEntries(2), 0);
  assert(r.primary === 'Bound-and-Cut', 'age=0 fails age gate → Bound-and-Cut');
  assert(r.treeAgeDays === 0,           'treeAgeDays=0 passed through');
}

// ---------------------------------------------------------------------------
// T15 — treeAgeDays=NaN → Bound-and-Cut, no throw
//        NaN >= 30 is false (JS NaN comparison semantics). No exception expected.
// ---------------------------------------------------------------------------
console.log('\nT15 — treeAgeDays=NaN → Bound-and-Cut, no throw');
{
  let r = null, threw = false;
  try {
    r = TechniqueClassifier.classify(pruneEntries(2), NaN);
  } catch (e) {
    threw = true;
  }
  assert(!threw,                                              'no exception thrown for NaN treeAgeDays');
  // Guard: if threw===true, r is null; access r.primary only when it is safe.
  assert(r != null && r.primary === 'Bound-and-Cut', 'NaN age fails age gate (NaN>=30 is false) → Bound-and-Cut');
}

// ---------------------------------------------------------------------------
// T16 — treeAgeDays=Infinity → Clip-and-Grow (Infinity >= 30 is true)
// ---------------------------------------------------------------------------
console.log('\nT16 — treeAgeDays=Infinity → Clip-and-Grow');
{
  const r = TechniqueClassifier.classify(pruneEntries(2), Infinity);
  assert(r.primary === 'Clip-and-Grow', 'Infinity >= 30 is true → Clip-and-Grow');
  assert(r.treeAgeDays === Infinity,    'treeAgeDays=Infinity passed through');
}

// ---------------------------------------------------------------------------
// T17 — Unknown action types ignored, no throw
// ---------------------------------------------------------------------------
console.log('\nT17 — Unknown action types ignored, no throw');
{
  const log = [
    { day: 1, action: { type: 'tick' } },
    { day: 2, action: { type: 'foo', value: 99 } },
    ...pruneEntries(2),
  ];
  let r = null, threw = false;
  try {
    r = TechniqueClassifier.classify(log, 30);
  } catch (e) {
    threw = true;
  }
  // Guard: if threw===true, r is null; access r.* only when it is safe.
  assert(!threw,                                              'no exception for unknown action types');
  assert(r != null && r.primary === 'Clip-and-Grow', 'unknown types ignored; prune+age gates pass → Clip-and-Grow');
  assert(r != null && r.wireCount === 0,             'wireCount unaffected by unknown types');
}

// ---------------------------------------------------------------------------
// T17b — Spec-named ignored types: weight, weight-remove, twine-remove
//         These are explicitly excluded from wireCount by the spec (not just unknown).
//         A future switch-case that accidentally increments wireCount for 'weight'
//         would not be caught by T17 (which uses unknown types only).
// ---------------------------------------------------------------------------
console.log('\nT17b — weight/weight-remove/twine-remove ignored, wireCount unaffected');
{
  const log = [
    { day: 1, action: { type: 'weight',       branchId: 0, weightCount: 2, torqueContribution: 1.5 } },
    { day: 2, action: { type: 'weight-remove', branchId: 0 } },
    { day: 3, action: { type: 'twine-remove',  branchId: 0 } },
    ...pruneEntries(2),
  ];
  const r = TechniqueClassifier.classify(log, 30);
  assert(r.wireCount === 0,             'wireCount=0 — weight/weight-remove/twine-remove NOT counted');
  assert(r.primary === 'Clip-and-Grow', 'spec-named ignored types do not disqualify Clip-and-Grow');
}

// ---------------------------------------------------------------------------
// T18 — Log with only water/fertilize/rotate → Bound-and-Cut, all counts 0
// ---------------------------------------------------------------------------
console.log('\nT18 — water/fertilize/rotate only → Bound-and-Cut, all counts 0');
{
  const log = [
    { day: 1, action: { type: 'water', amount: 28 } },
    { day: 2, action: { type: 'fertilize' } },
    { day: 3, action: { type: 'rotate' } },
    { day: 4, action: { type: 'water', amount: 28 } },
  ];
  const r = TechniqueClassifier.classify(log, 100);
  assert(r.primary === 'Bound-and-Cut', 'no qualifying actions → Bound-and-Cut');
  assert(
    r.wireCount === 0 && r.pruneCount === 0 && r.jinCount === 0 && r.landscapeCount === 0,
    'all counts=0',
  );
}

// ---------------------------------------------------------------------------
// T19 — Determinism: same inputs → identical outputs (referential transparency)
// ---------------------------------------------------------------------------
console.log('\nT19 — Determinism: same inputs → identical outputs');
{
  const log = [twineEntry(), ...pruneEntries(2), jinEntry(), ...landscapeEntries(3)];
  const age = 45;
  const r1 = TechniqueClassifier.classify(log, age);
  const r2 = TechniqueClassifier.classify(log, age);
  assert(r1.primary === r2.primary,                                   'primary identical across two calls');
  assert(JSON.stringify(r1.overlays) === JSON.stringify(r2.overlays), 'overlays identical (same order)');
  assert(r1.overlays !== r2.overlays,                                 'overlays are distinct array objects (no shared ref)');
  assert(
    r1.wireCount      === r2.wireCount   &&
    r1.pruneCount     === r2.pruneCount  &&
    r1.jinCount       === r2.jinCount    &&
    r1.landscapeCount === r2.landscapeCount,
    'all counts identical',
  );
  assert(r1.treeAgeDays === r2.treeAgeDays, 'treeAgeDays identical');
}

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
