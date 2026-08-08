// WireEngine.test.js — cascade gate tests (GDD §3.2, owner decision 2026-08-07).
// Gate rule: wireCount < 3 → capped at 120° (Han-Kengai); wireCount >= 3 → 150° (Kengai).
// wireCount is incremented BEFORE the gate check — so the 3rd wire application itself
// opens the Cascade gate (post-increment wireCount === 3).
import test from 'node:test';
import assert from 'node:assert/strict';
import { BonsaiTree, GrowthEngine } from '../dist/index.js';

/** Grow a minimal tree with a trunk (branch 0) wirable on day 0. */
function freshTree() {
  const t = new BonsaiTree(42, 'hardwood');
  // Trunk starts at thickness=2, WIRE_MAX_THICKNESS=3 — safe without growing.
  return t;
}

/**
 * Pre-position the trunk to a given angle by directly mutating the branch.
 * This bypasses wire mechanics to set up a known starting state for gate tests.
 */
function setTrunkAngle(tree, angle) {
  tree.getBranches()[0].angle = angle;
}

test('wireCount < 3 → angle capped at 120° when delta would exceed it', () => {
  const t = freshTree();
  // Pre-set trunk to 80° so that a single wire of +45° would push to 125°.
  setTrunkAngle(t, 80);
  // Wire 1: wireCount becomes 1 (< 3 → gate = 120°). 80 + 45 = 125 → capped to 120°.
  t.wire(0, 45);
  const angleAfterWire1 = t.getBranches()[0].angle;
  assert.equal(
    angleAfterWire1,
    120,
    `expected angle === 120° with wireCount=1 (gate active), got ${angleAfterWire1}°`
  );

  // Wire 2: wireCount becomes 2 (< 3 → gate = 120°). 120 + 45 = 165 → capped to 120°.
  t.wire(0, 45);
  const angleAfterWire2 = t.getBranches()[0].angle;
  assert.equal(
    angleAfterWire2,
    120,
    `expected angle === 120° with wireCount=2 (gate still active), got ${angleAfterWire2}°`
  );
});

test('3rd wire application opens Cascade gate (wireCount incremented before gate check)', () => {
  const t = freshTree();
  // Starting at 0°, each wire of 45° advances the angle.
  // Wire 1: wireCount=1, gate=120°. 0 + 45 = 45°.
  t.wire(0, 45);
  // Wire 2: wireCount=2, gate=120°. 45 + 45 = 90°.
  t.wire(0, 45);
  // Wire 3: wireCount incremented to 3 BEFORE gate check → gate = 150°.
  // 90 + 45 = 135° — which exceeds 120° (proving gate is open, not the old 120° cap).
  t.wire(0, 45);
  const angle = t.getBranches()[0].angle;
  assert.ok(
    angle > 120,
    `expected angle > 120° — wire 3 should open Cascade gate, got ${angle}°`
  );
  assert.ok(
    angle <= 150,
    `expected angle ≤ 150° (KENGAI_POLAR_MAX ceiling), got ${angle}°`
  );
  assert.equal(
    angle,
    135,
    `expected angle === 135° exactly (90° + 45° with gate open), got ${angle}°`
  );
});

test('branch CAN reach 150° with sufficient wire applications (Cascade achievable)', () => {
  const t = freshTree();
  // Wire 1: 0→45°,  wireCount=1
  // Wire 2: 45→90°, wireCount=2
  // Wire 3: 90→135°, wireCount=3 (gate unlocked on THIS wire)
  // Wire 4: 135→180° → clamped to 150° (KENGAI ceiling), wireCount=4
  // Wire 5: already at ceiling, no change, wireCount=5
  for (let i = 0; i < 5; i++) t.wire(0, 45);
  const angle = t.getBranches()[0].angle;
  assert.equal(
    angle,
    150,
    `expected angle === 150° (Cascade ceiling), got ${angle}°`
  );
});
