/**
 * Gate suite: E1 through E5.
 * Tests the exportFixture I/O bridge and the care->combat JSON contract.
 * Run from repo root: node fixtures/test_fixtures.mjs
 * Exit 0 = all gates pass.  Exit 1 = any gate failed.
 */

import { tmpdir } from 'os';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { createHash }               from 'node:crypto';
import { exportFixture }            from './exportFixture.mjs';
import { CareLogReplay }            from '../packages/engine/dist/CareLogReplay.js';
import { StatDeriver }              from '../packages/engine/dist/StatDeriver.js';
import { Voxelizer }                from '../packages/voxelizer/dist/index.js';
import { WATER_AMOUNT }             from '../packages/shared/dist/index.js';

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(cond, name, detail = '') {
  if (cond) {
    console.log(`  pass -- ${name}`);
    passed++;
  } else {
    console.error(`  FAIL -- ${name}${detail ? ': ' + detail : ''}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

function buildWaterLog(totalDays, interval = 5) {
  const log = [];
  for (let d = 0; d < totalDays; d += interval) {
    log.push({ day: d, action: { type: 'water', amount: WATER_AMOUNT } });
  }
  return log;
}

const TOTAL_DAYS = 200;
const SEED_HW    = 464497;
const SEED_TR    = 777001;
const careLog    = buildWaterLog(TOTAL_DAYS);
// Fixed timestamp ensures byte-identical output in E2 -- wall-clock excluded from stat logic.
const FIXED_TS   = '2026-07-17T00:00:00.000Z';

const _tmpDir    = mkdtempSync(tmpdir() + '/kijo_test_');
const TMP_E1_E3  = _tmpDir + '/e1_e3.json';
const TMP_E2_A   = _tmpDir + '/e2_a.json';
const TMP_E2_B   = _tmpDir + '/e2_b.json';

// Pre-export E1/E3 fixture and canonical fixtures must already exist (run generate.mjs first).
exportFixture(SEED_HW, 'hardwood', careLog, TOTAL_DAYS, TMP_E1_E3, FIXED_TS);

// ---------------------------------------------------------------------------
// E1 -- shape: exported JSON has all 8 stat keys, camelCase, correct types.
//             Print file contents.
// ---------------------------------------------------------------------------

console.log('\nE1 -- shape: all 8 stat keys present, camelCase, correct types');
{
  const fixture = JSON.parse(readFileSync(TMP_E1_E3, 'utf8'));

  console.log('\n  File contents:');
  console.log(JSON.stringify(fixture, null, 2));

  const REQUIRED_STATS = ['hp','power','endurance','ki','skillSlots','skillPoints','wisdom','matchPct'];
  for (const k of REQUIRED_STATS) {
    assert(k in fixture.stats,                  `stats.${k} present`);
    assert(typeof fixture.stats[k] === 'number', `stats.${k} is number`, `got ${typeof fixture.stats[k]}`);
  }
  // Envelope fields
  assert(typeof fixture.seed        === 'number', 'fixture.seed is number');
  assert(typeof fixture.species     === 'string', 'fixture.species is string');
  assert(typeof fixture.ageDays     === 'number', 'fixture.ageDays is number');
  assert(typeof fixture.generatedAt === 'string', 'fixture.generatedAt is string');
  // Exact key count in .stats (no extra keys)
  const statKeyCount = Object.keys(fixture.stats).length;
  assert(statKeyCount === 8, 'exactly 8 keys in .stats', `got ${statKeyCount}`);
}

// ---------------------------------------------------------------------------
// E2 -- determinism: same seed+careLog twice -> byte-identical files.
//             Compare with SHA-256 hash.
// ---------------------------------------------------------------------------

console.log('\nE2 -- determinism: same inputs -> byte-identical output files');
{
  exportFixture(SEED_HW, 'hardwood', careLog, TOTAL_DAYS, TMP_E2_A, FIXED_TS);
  exportFixture(SEED_HW, 'hardwood', careLog, TOTAL_DAYS, TMP_E2_B, FIXED_TS);

  const a = readFileSync(TMP_E2_A, 'utf8');
  const b = readFileSync(TMP_E2_B, 'utf8');
  const hashA = createHash('sha256').update(a).digest('hex');
  const hashB = createHash('sha256').update(b).digest('hex');

  console.log(`  hash(run1): ${hashA}`);
  console.log(`  hash(run2): ${hashB}`);
  assert(hashA === hashB, 'hash(run1) === hash(run2) -- byte-identical');
}

// ---------------------------------------------------------------------------
// E3 -- round-trip: read exported JSON back, confirm stats match derive().
// ---------------------------------------------------------------------------

console.log('\nE3 -- round-trip: file stats match in-memory derive()');
{
  const fixture = JSON.parse(readFileSync(TMP_E1_E3, 'utf8'));
  const tree    = CareLogReplay.reconstruct(SEED_HW, 'hardwood', careLog, TOTAL_DAYS);
  const { voxels, zones } = Voxelizer.voxelize(tree);
  const sheet   = StatDeriver.derive(tree, voxels, SEED_HW, tree.getAge(), zones);

  const KEYS = ['hp','power','endurance','ki','skillSlots','skillPoints','wisdom','matchPct'];
  for (const k of KEYS) {
    assert(
      fixture.stats[k] === sheet[k],
      `stats.${k} round-trips`,
      `file=${fixture.stats[k]}  mem=${sheet[k]}`
    );
  }
}

// ---------------------------------------------------------------------------
// E4 -- two distinct trees: hardwood and tropical have meaningfully different
//             stat profiles (different hp/power/ki ratios).  Print both.
// ---------------------------------------------------------------------------

console.log('\nE4 -- two distinct trees: hardwood vs tropical stat profiles');
{
  const hwPath = 'fixtures/hardwood_real.json';
  const trPath = 'fixtures/tropical_real.json';
  assert(existsSync(hwPath), 'hardwood_real.json exists');
  assert(existsSync(trPath), 'tropical_real.json exists');

  const hw = JSON.parse(readFileSync(hwPath, 'utf8'));
  const tr = JSON.parse(readFileSync(trPath, 'utf8'));

  console.log('\n  hardwood stats:', JSON.stringify(hw.stats));
  console.log('  tropical stats:', JSON.stringify(tr.stats));

  // Verify all core stats are positive for both species
  for (const k of ['hp','power','ki']) {
    assert(hw.stats[k] > 0, `hardwood.${k} > 0`,  `got ${hw.stats[k]}`);
    assert(tr.stats[k] > 0, `tropical.${k} > 0`,   `got ${tr.stats[k]}`);
  }

  // At least one core stat meaningfully differs between species
  const coreKeys = ['hp','power','endurance','ki'];
  const anyDiffers = coreKeys.some(k => hw.stats[k] !== tr.stats[k]);
  assert(anyDiffers, 'hardwood and tropical have different stat profiles');

  // Profiles differ meaningfully (not just floating-point noise):
  // Check that at least one stat ratio differs.  Both species have different seeds
  // and species params -> growth curves diverge -> structural voxel counts diverge.
  const hwPowerHpRatio = hw.stats.power / hw.stats.hp;
  const trPowerHpRatio = tr.stats.power / tr.stats.hp;
  console.log(`  hardwood power/hp ratio: ${hwPowerHpRatio.toFixed(4)}`);
  console.log(`  tropical power/hp ratio: ${trPowerHpRatio.toFixed(4)}`);
  assert(
    Math.abs(hwPowerHpRatio - trPowerHpRatio) > 0.01,
    'power/hp ratio differs meaningfully between species',
    `hw=${hwPowerHpRatio.toFixed(4)}  tr=${trPowerHpRatio.toFixed(4)}`
  );
}

// ---------------------------------------------------------------------------
// E5 -- Godot-contract check: .stats keys exactly match KijoStats fields.
//             See kijo/scripts/kijo_stats.gd (maps camelCase JSON -> snake_case).
// ---------------------------------------------------------------------------

console.log('\nE5 -- Godot-contract: .stats keys match KijoStats resource fields');
{
  const fixture  = JSON.parse(readFileSync('fixtures/hardwood_real.json', 'utf8'));
  const EXPECTED = new Set(['hp','power','endurance','ki','skillSlots','skillPoints','wisdom','matchPct']);
  const actual   = Object.keys(fixture.stats);
  const actualSet = new Set(actual);

  // Every expected key is present
  for (const k of EXPECTED) {
    assert(actualSet.has(k), `KijoStats key '${k}' present in .stats`);
  }
  // No extra keys
  for (const k of actual) {
    assert(EXPECTED.has(k), `no unexpected key '${k}' in .stats`);
  }
  // Exact count
  const match = actual.length === EXPECTED.size && actual.every(k => EXPECTED.has(k));
  if (match) {
    const sorted = [...actual].sort();
    console.log(`\n  E5 PASS -- .stats keys: [${sorted.join(', ')}]`);
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${'='.repeat(50)}`);
console.log(`E1-E5 result: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
