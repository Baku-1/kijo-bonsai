// canopy-grammar.test.js — Test probes for CanopyGrammar (V3 §10.1).
// Run: node --test test/canopy-grammar.test.js
// Framework: Node.js built-in test runner (node:test)

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isInsideEllipsoid,
  enumerateCanopyCandidates,
  sortCanopyCandidates,
  getCanopyCandidates,
  isCanopyEligible,
} from '../dist/CanopyGrammar.js';
import { CANOPY_ELLIPSOID } from '@kijo/shared';

// ===========================================================================
// V3-V02: Integer ellipsoid predicate
// ===========================================================================

test('V3-V02a: origin is inside all species', () => {
  assert.ok(isInsideEllipsoid(0, 0, 0, CANOPY_ELLIPSOID.hardwood));
  assert.ok(isInsideEllipsoid(0, 0, 0, CANOPY_ELLIPSOID.evergreen));
  assert.ok(isInsideEllipsoid(0, 0, 0, CANOPY_ELLIPSOID.tropical));
});

test('V3-V02b: boundary cell included (cross-product exact)', () => {
  // Hardwood: (3,0,0) → (3/3)^2 + 0 + 0 = 1 → should be included
  assert.ok(isInsideEllipsoid(3, 0, 0, CANOPY_ELLIPSOID.hardwood));
});

test('V3-V02c: outside cell excluded', () => {
  // Hardwood: (4,0,0) → (4/3)^2 > 1 → should be excluded
  assert.ok(!isInsideEllipsoid(4, 0, 0, CANOPY_ELLIPSOID.hardwood));
});

test('V3-V02d: tropical minY constraint', () => {
  // Tropical: y = -2 should be excluded (minY = -1)
  assert.ok(!isInsideEllipsoid(0, -2, 0, CANOPY_ELLIPSOID.tropical));
  // Tropical: y = -1 should be included
  assert.ok(isInsideEllipsoid(0, -1, 0, CANOPY_ELLIPSOID.tropical));
});

test('V3-V02e: evergreen vertical radius is 1', () => {
  // Evergreen: (0, 1, 0) → 0 + (1/1)^2 + 0 = 1 → included
  assert.ok(isInsideEllipsoid(0, 1, 0, CANOPY_ELLIPSOID.evergreen));
  // Evergreen: (0, 2, 0) → 0 + (2/1)^2 + 0 = 4 > 1 → excluded
  assert.ok(!isInsideEllipsoid(0, 2, 0, CANOPY_ELLIPSOID.evergreen));
});

// ===========================================================================
// V3-V03: Candidate enumeration and ordering
// ===========================================================================

test('V3-V03a: hardwood candidate count > 0', () => {
  const candidates = enumerateCanopyCandidates('hardwood', 42, 1);
  assert.ok(candidates.length > 0, `hardwood should have canopy cells, got ${candidates.length}`);
});

test('V3-V03b: sorted candidates are deterministic', () => {
  const a = getCanopyCandidates('hardwood', 42, 1);
  const b = getCanopyCandidates('hardwood', 42, 1);
  assert.deepEqual(a, b);
});

test('V3-V03c: different seeds produce different ordering', () => {
  const a = getCanopyCandidates('hardwood', 42, 1);
  const b = getCanopyCandidates('hardwood', 99, 1);
  // Same cells, but different hash order
  assert.equal(a.length, b.length, 'same shape, same count');
  // At least one pair should differ in position
  let anyDifferent = false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].localX !== b[i].localX || a[i].localY !== b[i].localY || a[i].localZ !== b[i].localZ) {
      anyDifferent = true;
      break;
    }
  }
  assert.ok(anyDifferent, 'different seeds should produce different orderings');
});

test('V3-V03d: all candidates pass the ellipsoid predicate', () => {
  for (const species of ['hardwood', 'evergreen', 'tropical']) {
    const candidates = enumerateCanopyCandidates(species, 42, 1);
    for (const c of candidates) {
      assert.ok(
        isInsideEllipsoid(c.localX, c.localY, c.localZ, CANOPY_ELLIPSOID[species]),
        `${species} candidate (${c.localX},${c.localY},${c.localZ}) should be inside ellipsoid`
      );
    }
  }
});

// ===========================================================================
// V3-E01: Canopy eligibility
// ===========================================================================

test('V3-E01a: eligible branch passes', () => {
  assert.ok(isCanopyEligible({
    isTerminal: true, isLive: true, isJinned: false,
    completedDays: 5, health: 80, moistureBps: 10000,
  }));
});

test('V3-E01b: non-terminal fails', () => {
  assert.ok(!isCanopyEligible({
    isTerminal: false, isLive: true, isJinned: false,
    completedDays: 5, health: 80, moistureBps: 10000,
  }));
});

test('V3-E01c: jinned fails', () => {
  assert.ok(!isCanopyEligible({
    isTerminal: true, isLive: true, isJinned: true,
    completedDays: 5, health: 80, moistureBps: 10000,
  }));
});

test('V3-E01d: too young (< 2 days) fails', () => {
  assert.ok(!isCanopyEligible({
    isTerminal: true, isLive: true, isJinned: false,
    completedDays: 1, health: 80, moistureBps: 10000,
  }));
});

test('V3-E01e: low health (< 40) fails', () => {
  assert.ok(!isCanopyEligible({
    isTerminal: true, isLive: true, isJinned: false,
    completedDays: 5, health: 39, moistureBps: 10000,
  }));
});

test('V3-E01f: zero moisture fails', () => {
  assert.ok(!isCanopyEligible({
    isTerminal: true, isLive: true, isJinned: false,
    completedDays: 5, health: 80, moistureBps: 0,
  }));
});
