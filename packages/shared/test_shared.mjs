// test_shared.mjs
import { SeededRNG, spatialHash, round4 } from './dist/index.js';

let passed = 0, failed = 0;
function assert(cond, name, detail = '') {
  if (cond) { console.log(`  ✓ ${name}`); passed++; }
  else { console.error(`  ✗ ${name}${detail ? ': ' + detail : ''}`); failed++; }
}

// S1 — RNG determinism
console.log('S1 — RNG determinism');
{
  const a = new SeededRNG(464497), b = new SeededRNG(464497);
  let ok = true;
  for (let i = 0; i < 1000; i++) { const av = a.next(), bv = b.next(); if (av !== bv) { ok = false; break; } }
  assert(ok, '1000 values identical across two instances of SeededRNG(464497)');
}

// S2 — RNG distribution
console.log('S2 — RNG distribution');
{
  const rng = new SeededRNG(1);
  let sum = 0, allInRange = true;
  for (let i = 0; i < 10000; i++) { const v = rng.next(); sum += v; if (v < 0 || v >= 1) allInRange = false; }
  const mean = sum / 10000;
  console.log(`  mean: ${mean.toFixed(5)}`);
  assert(allInRange, 'all values in [0, 1)');
  assert(mean >= 0.48 && mean <= 0.52, `mean in [0.48, 0.52]`, `got ${mean.toFixed(5)}`);
}

// S3 — Hash determinism
console.log('S3 — Hash determinism');
{
  const expected = spatialHash(464497, 34, 120, 88);
  let ok = true;
  for (let i = 0; i < 100; i++) { if (spatialHash(464497, 34, 120, 88) !== expected) { ok = false; break; } }
  console.log(`  spatialHash(464497, 34, 120, 88) = ${expected}`);
  assert(ok, '100 calls return identical value');
}

// S4 — Hash uniformity
console.log('S4 — Hash uniformity');
{
  const buckets = new Array(6).fill(0);
  const N = 64;
  const total = N * N * N;
  for (let x = 0; x < N; x++)
    for (let y = 0; y < N; y++)
      for (let z = 0; z < N; z++)
        buckets[spatialHash(1, x, y, z) % 6]++;
  console.log('  histogram (bucket: count / %):', buckets.map((c, i) => `${i}:${c}(${(c/total*100).toFixed(1)}%)`).join(' '));
  const lo = total * 0.10, hi = total * 0.25;
  assert(buckets.every(c => c >= lo && c <= hi), 'all 6 buckets between 10% and 25%');
}

// S5 — round4
console.log('S5 — round4');
{
  assert(round4(1.23456789) === 1.2346, 'round4(1.23456789) === 1.2346');
  const r00004 = round4(0.00004);
  console.log(`  round4(0.00004) = ${r00004}`);
  const r99995 = round4(9.99995);
  console.log(`  round4(9.99995) = ${r99995}`);
  let naiveSum = 0, roundedSum = 0;
  for (let i = 0; i < 1000; i++) { naiveSum += 0.1; roundedSum += round4(0.1); }
  console.log(`  naive sum(0.1 x1000) = ${naiveSum}`);
  console.log(`  rounded sum(round4(0.1) x1000) = ${roundedSum}`);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
