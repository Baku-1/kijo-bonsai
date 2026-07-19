/**
 * Generate canonical stat fixtures for hardwood and tropical kijo.
 * Run from repo root: node fixtures/generate.mjs
 *
 * These are REAL derived numbers produced by the engine pipeline.
 * NOT authored values.  Two species x one seed each.
 *
 * Care pattern: water every 5 days (days 0, 5, 10, ..., 195).  No pruning.
 * Growth: 200 days each.
 *
 * Outputs:
 *   fixtures/hardwood_real.json  -- hardwood, seed 464497
 *   fixtures/tropical_real.json  -- tropical,  seed 777001
 */

import { exportFixture } from './exportFixture.mjs';
import { readFileSync }  from 'node:fs';

// ---------------------------------------------------------------------------
// Build a well-watered care log: water every `interval` days for `totalDays`.
// No pruning.  Care log entries: { day, action: { type: 'water' } }.
// ---------------------------------------------------------------------------

function buildWaterLog(totalDays, interval = 5) {
  const log = [];
  for (let d = 0; d < totalDays; d += interval) {
    log.push({ day: d, action: { type: 'water' } });
  }
  return log;
}

const TOTAL_DAYS = 200;
const careLog    = buildWaterLog(TOTAL_DAYS);
const ts         = new Date().toISOString();  // same timestamp for both -- metadata only

// ---------------------------------------------------------------------------
// hardwood -- seed 464497
// ---------------------------------------------------------------------------

console.log('Generating fixtures/hardwood_real.json ...');
exportFixture(464497, 'hardwood', careLog, TOTAL_DAYS, 'fixtures/hardwood_real.json', ts);
const hw = JSON.parse(readFileSync('fixtures/hardwood_real.json', 'utf8'));
console.log('hardwood_real stats:');
console.log(JSON.stringify(hw.stats, null, 2));

// ---------------------------------------------------------------------------
// tropical -- seed 777001
// ---------------------------------------------------------------------------

console.log('\nGenerating fixtures/tropical_real.json ...');
exportFixture(777001, 'tropical', careLog, TOTAL_DAYS, 'fixtures/tropical_real.json', ts);
const tr = JSON.parse(readFileSync('fixtures/tropical_real.json', 'utf8'));
console.log('tropical_real stats:');
console.log(JSON.stringify(tr.stats, null, 2));

console.log('\nDone. Both fixture files written to fixtures/.');
