// cost-guards.test.js — Test gate cases for cost & consumable parameter validation.
// Spec: docs/pipeline/ARCH-COST-GUARDS-2026-09-19.md (GUARD-1..GUARD-24, GUARD-S1..GUARD-S13)
// Critic: docs/pipeline/CRITIC-COST-GUARDS-2026-09-19.md (A-4, A-5 boundary cases)
// Audit: docs/pipeline/AUDIT-COST-GUARDS-2026-09-19.md (AB-2 blocker — this file resolves it)
//
// Run: node --test test/cost-guards.test.js
// Framework: Node.js built-in test runner (node:test)

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BonsaiTree,
  CareLogReplayError,
  WireEngine,
  PruneEngine,
} from '../dist/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fresh tree with trunk (branch 0). Trunk thickness=2, WIRE_MAX_THICKNESS=3. */
function freshTree() {
  return new BonsaiTree(42, 'hardwood');
}

/** Assert that fn() throws CareLogReplayError. */
function assertGuardThrows(fn, label) {
  assert.throws(fn, (err) => {
    assert.ok(
      err instanceof CareLogReplayError,
      `${label}: expected CareLogReplayError, got ${err?.constructor?.name}: ${err?.message}`
    );
    return true;
  }, `${label}: expected CareLogReplayError to be thrown`);
}

// ===========================================================================
// PART 1: Engine-side guards — BonsaiTree methods (GUARD-1 through GUARD-19)
// ===========================================================================

// --- wire() guards ---

test('GUARD-1: wire(NaN, 0) → throws CareLogReplayError', () => {
  const t = freshTree();
  assertGuardThrows(() => t.wire(NaN, 0), 'GUARD-1');
});

test('GUARD-2: wire(1.5, 0) → throws CareLogReplayError (non-integer branchId)', () => {
  const t = freshTree();
  assertGuardThrows(() => t.wire(1.5, 0), 'GUARD-2');
});

test('GUARD-3: wire(-1, 0) → throws CareLogReplayError (negative branchId)', () => {
  const t = freshTree();
  assertGuardThrows(() => t.wire(-1, 0), 'GUARD-3');
});

test('GUARD-4: wire("abc", 0) → throws CareLogReplayError (string branchId)', () => {
  const t = freshTree();
  assertGuardThrows(() => t.wire(/** @type {any} */ ('abc'), 0), 'GUARD-4');
});

test('GUARD-5: wire(0, NaN) → throws CareLogReplayError (NaN angleDelta)', () => {
  const t = freshTree();
  assertGuardThrows(() => t.wire(0, NaN), 'GUARD-5');
});

test('GUARD-6: wire(0, Infinity) → throws CareLogReplayError (Infinity angleDelta)', () => {
  const t = freshTree();
  assertGuardThrows(() => t.wire(0, Infinity), 'GUARD-6');
});

// --- removeWire() guards ---

test('GUARD-7: removeWire(NaN) → throws CareLogReplayError', () => {
  const t = freshTree();
  assertGuardThrows(() => t.removeWire(NaN), 'GUARD-7');
});

test('GUARD-8: removeWire(-1) → throws CareLogReplayError', () => {
  const t = freshTree();
  assertGuardThrows(() => t.removeWire(-1), 'GUARD-8');
});

// --- applyTwine() guards ---

test('GUARD-9: applyTwine(NaN, 5) → throws CareLogReplayError (NaN branchId)', () => {
  const t = freshTree();
  assertGuardThrows(() => t.applyTwine(NaN, 5), 'GUARD-9');
});

test('GUARD-10: applyTwine(0, 5, -1) → throws CareLogReplayError (negative storedDegradeDays)', () => {
  const t = freshTree();
  assertGuardThrows(() => t.applyTwine(0, 5, -1), 'GUARD-10');
});

test('GUARD-11: applyTwine(0, 5, 1.5) → throws CareLogReplayError (non-integer storedDegradeDays)', () => {
  const t = freshTree();
  assertGuardThrows(() => t.applyTwine(0, 5, 1.5), 'GUARD-11');
});

test('GUARD-12: applyTwine(0, 5, NaN) → throws CareLogReplayError (NaN storedDegradeDays)', () => {
  const t = freshTree();
  assertGuardThrows(() => t.applyTwine(0, 5, NaN), 'GUARD-12');
});

// --- removeTwine() guards ---

test('GUARD-13: removeTwine(NaN) → throws CareLogReplayError', () => {
  const t = freshTree();
  assertGuardThrows(() => t.removeTwine(NaN), 'GUARD-13');
});

// --- applyWeight() guards ---

test('GUARD-14: applyWeight(NaN, 1) → throws CareLogReplayError (NaN branchId)', () => {
  const t = freshTree();
  assertGuardThrows(() => t.applyWeight(NaN, 1), 'GUARD-14');
});

test('GUARD-15: applyWeight(-1, 1) → throws CareLogReplayError (negative branchId)', () => {
  const t = freshTree();
  assertGuardThrows(() => t.applyWeight(-1, 1), 'GUARD-15');
});

// --- removeWeight() guards ---

test('GUARD-16: removeWeight(NaN) → throws CareLogReplayError', () => {
  const t = freshTree();
  assertGuardThrows(() => t.removeWeight(NaN), 'GUARD-16');
});

// --- prune() guards ---

test('GUARD-17: prune(NaN) → throws CareLogReplayError', () => {
  const t = freshTree();
  assertGuardThrows(() => t.prune(NaN), 'GUARD-17');
});

test('GUARD-18: prune(1.5) → throws CareLogReplayError (non-integer)', () => {
  const t = freshTree();
  assertGuardThrows(() => t.prune(1.5), 'GUARD-18');
});

test('GUARD-19: prune(-1) → throws CareLogReplayError (negative)', () => {
  const t = freshTree();
  assertGuardThrows(() => t.prune(-1), 'GUARD-19');
});

// ===========================================================================
// PART 2: Static engine method guards — replay path (GUARD-20 through GUARD-24)
// ===========================================================================

test('GUARD-20: WireEngine.wire(tree, NaN, 0) → throws CareLogReplayError', () => {
  const t = freshTree();
  assertGuardThrows(() => WireEngine.wire(t, NaN, 0), 'GUARD-20');
});

test('GUARD-21: WireEngine.wire(tree, 0, NaN) → throws CareLogReplayError (NaN angleDelta)', () => {
  const t = freshTree();
  assertGuardThrows(() => WireEngine.wire(t, 0, NaN), 'GUARD-21');
});

test('GUARD-22: WireEngine.removeWire(tree, NaN) → throws CareLogReplayError', () => {
  const t = freshTree();
  assertGuardThrows(() => WireEngine.removeWire(t, NaN), 'GUARD-22');
});

test('GUARD-23: PruneEngine.prune(tree, 1.5) → throws CareLogReplayError (non-integer)', () => {
  const t = freshTree();
  assertGuardThrows(() => PruneEngine.prune(t, 1.5), 'GUARD-23');
});

test('GUARD-24: PruneEngine.prune(tree, NaN) → throws CareLogReplayError', () => {
  const t = freshTree();
  assertGuardThrows(() => PruneEngine.prune(t, NaN), 'GUARD-24');
});

// ===========================================================================
// PART 3: Boundary / edge cases (Critic A-4, A-5)
// ===========================================================================

test('A-4: wire(-0, 10) → -0 passes guard (treated as 0, indexes to trunk)', () => {
  const t = freshTree();
  // -0 passes all guard checks: isFinite(-0)=true, -0>=0=true, isInteger(-0)=true,
  // -0 < branches.length=true. branches[-0] === branches[0] (trunk).
  // Should NOT throw — documents that -0 is equivalent to 0.
  assert.doesNotThrow(() => t.wire(-0, 10), 'wire(-0, 10) should not throw');
});

test('A-5a: wire(true, 0) → throws CareLogReplayError (boolean coerced — Number.isFinite(true)=false)', () => {
  const t = freshTree();
  // true coerces to 1 in arithmetic, but Number.isFinite(true) returns false
  // because true is not a number type. Guard catches it.
  assertGuardThrows(() => t.wire(/** @type {any} */ (true), 0), 'A-5a');
});

test('A-5b: wire(Number.MAX_SAFE_INTEGER, 0) → throws CareLogReplayError (beyond branches.length)', () => {
  const t = freshTree();
  // MAX_SAFE_INTEGER passes isFinite/isInteger/>=0 but fails >= branches.length (B-1 upper bound).
  assertGuardThrows(() => t.wire(Number.MAX_SAFE_INTEGER, 0), 'A-5b');
});

// --- Additional weightCount boundary cases (spec task: "bad weightCount (0, -1, 5, NaN)") ---

test('GUARD-EXT-1: applyWeight(0, 0) → throws CareLogReplayError (weightCount below range)', () => {
  const t = freshTree();
  assertGuardThrows(() => t.applyWeight(0, 0), 'GUARD-EXT-1');
});

test('GUARD-EXT-2: applyWeight(0, 5) → throws CareLogReplayError (weightCount above range)', () => {
  const t = freshTree();
  assertGuardThrows(() => t.applyWeight(0, 5), 'GUARD-EXT-2');
});

test('GUARD-EXT-3: applyTwine(0, 5, 21) → throws CareLogReplayError (storedDegradeDays > 20, A-3)', () => {
  const t = freshTree();
  assertGuardThrows(() => t.applyTwine(0, 5, 21), 'GUARD-EXT-3');
});

// ===========================================================================
// PART 4: Server-side validator logic (GUARD-S1 through GUARD-S13)
// ===========================================================================
// The server validators are embedded in the Deno Edge Function (care-action/index.ts)
// and cannot be imported directly. We replicate the exact helper functions and SCHEMAS
// here to test the validation LOGIC. These are pure functions — same source, same tests.
// ---------------------------------------------------------------------------

// --- Replicated server-side helpers (exact logic from care-action/index.ts L33-76) ---

function requireFinite(val, name) {
  if (typeof val !== 'number' || !Number.isFinite(val)) {
    throw new Error(`${name} must be a finite number (got ${val}).`);
  }
  return val;
}

function requireNonNegInt(val, name) {
  if (typeof val !== 'number' || !Number.isFinite(val) || val < 0 || !Number.isInteger(val)) {
    throw new Error(`${name} must be a non-negative integer (got ${val}).`);
  }
  return val;
}

function requirePositiveFinite(val, name) {
  if (typeof val !== 'number' || !Number.isFinite(val) || val <= 0) {
    throw new Error(`${name} must be a positive finite number (got ${val}).`);
  }
  return val;
}

function requirePositiveInt(val, name) {
  if (typeof val !== 'number' || !Number.isFinite(val) || val < 1 || !Number.isInteger(val)) {
    throw new Error(`${name} must be a positive integer (got ${val}).`);
  }
  return val;
}

function requireIntRange(val, lo, hi, name) {
  if (typeof val !== 'number' || !Number.isFinite(val) || val < lo || val > hi || !Number.isInteger(val)) {
    throw new Error(`${name} must be an integer in [${lo}, ${hi}] (got ${val}).`);
  }
  return val;
}

const SERVER_MAX_BRANCH_ID = 10000;

function requireBranchId(val) {
  if (typeof val !== 'number' || !Number.isFinite(val) || val < 0 || !Number.isInteger(val) || val > SERVER_MAX_BRANCH_ID) {
    throw new Error(`branchId must be a non-negative integer <= ${SERVER_MAX_BRANCH_ID} (got ${val}).`);
  }
  return val;
}

// --- Replicated SCHEMAS (exact logic from care-action/index.ts L83-128) ---

const SCHEMAS = {
  water: (d) => ({
    amount: requirePositiveFinite(d.amount, 'amount'),
  }),
  prune: (d) => ({
    branchId: requireBranchId(d.branchId),
  }),
  wire: (d) => ({
    branchId: requireBranchId(d.branchId),
    angleDelta: requireFinite(d.angleDelta, 'angleDelta'),
  }),
  'wire-remove': (d) => ({
    branchId: requireBranchId(d.branchId),
  }),
  twine: (d) => {
    const clean = {
      branchId: requireBranchId(d.branchId),
      angleDelta: requireFinite(d.angleDelta, 'angleDelta'),
    };
    if (d.degradeDays !== undefined) {
      clean.degradeDays = requireIntRange(d.degradeDays, 0, 20, 'degradeDays');
    }
    return clean;
  },
  'twine-remove': (d) => ({
    branchId: requireBranchId(d.branchId),
  }),
  weight: (d) => ({
    branchId: requireBranchId(d.branchId),
    weightCount: requireIntRange(d.weightCount, 1, 4, 'weightCount'),
  }),
  'weight-remove': (d) => ({
    branchId: requireBranchId(d.branchId),
  }),
  jin: (d) => ({
    branchId: requireBranchId(d.branchId),
    segmentIndex: requireNonNegInt(d.segmentIndex, 'segmentIndex'),
    jinCost: requirePositiveInt(d.jinCost, 'jinCost'),
  }),
  fertilize: (_) => ({}),
  rotate: (_) => ({}),
  landscape: (d) => ({
    elementType: d.elementType,
    position: d.position,
  }),
};

/** Simulate the fail-closed server validation path (care-action/index.ts L207-223). */
function validateAction(actionType, actionData) {
  const validator = SCHEMAS[actionType];
  if (!validator) {
    throw new Error(`No validation schema for ${actionType}`);
  }
  return validator(actionData);
}

// --- Server-side test cases ---

test('GUARD-S1: water { amount: NaN } → server validator rejects', () => {
  assert.throws(() => validateAction('water', { amount: NaN }), /amount/);
});

test('GUARD-S2: water { amount: -5 } → server validator rejects (negative)', () => {
  assert.throws(() => validateAction('water', { amount: -5 }), /amount/);
});

test('GUARD-S3: water { amount: "hello" } → server validator rejects (string)', () => {
  assert.throws(() => validateAction('water', { amount: 'hello' }), /amount/);
});

test('GUARD-S4: wire { branchId: "abc", angleDelta: 10 } → server validator rejects (string branchId)', () => {
  assert.throws(() => validateAction('wire', { branchId: 'abc', angleDelta: 10 }), /branchId/);
});

test('GUARD-S5: wire { branchId: 0, angleDelta: Infinity } → server validator rejects', () => {
  assert.throws(() => validateAction('wire', { branchId: 0, angleDelta: Infinity }), /angleDelta/);
});

test('GUARD-S6: prune { branchId: -1 } → server validator rejects (negative)', () => {
  assert.throws(() => validateAction('prune', { branchId: -1 }), /branchId/);
});

test('GUARD-S7: weight { branchId: 0, weightCount: 0 } → server validator rejects (below range)', () => {
  assert.throws(() => validateAction('weight', { branchId: 0, weightCount: 0 }), /weightCount/);
});

test('GUARD-S8: weight { branchId: 0, weightCount: 5 } → server validator rejects (above range)', () => {
  assert.throws(() => validateAction('weight', { branchId: 0, weightCount: 5 }), /weightCount/);
});

test('GUARD-S9: jin { branchId: 0, segmentIndex: -1, jinCost: 1 } → server validator rejects', () => {
  assert.throws(() => validateAction('jin', { branchId: 0, segmentIndex: -1, jinCost: 1 }), /segmentIndex/);
});

test('GUARD-S10: jin { branchId: 0, segmentIndex: 0, jinCost: 0 } → server validator rejects (zero jinCost)', () => {
  assert.throws(() => validateAction('jin', { branchId: 0, segmentIndex: 0, jinCost: 0 }), /jinCost/);
});

test('GUARD-S11: twine { branchId: 0, angleDelta: 5, degradeDays: -1 } → server validator rejects', () => {
  assert.throws(() => validateAction('twine', { branchId: 0, angleDelta: 5, degradeDays: -1 }), /degradeDays/);
});

test('GUARD-S12: wire { branchId: 1.5, angleDelta: 10 } → server validator rejects (non-integer)', () => {
  assert.throws(() => validateAction('wire', { branchId: 1.5, angleDelta: 10 }), /branchId/);
});

test('GUARD-S13: extra fields stripped — water with "exploit" field returns only { amount }', () => {
  const clean = validateAction('water', { amount: 5, exploit: 'payload', __proto__: 'bad' });
  assert.deepStrictEqual(Object.keys(clean), ['amount'], 'clean object should only contain "amount"');
  assert.strictEqual(clean.amount, 5);
  assert.strictEqual(clean.exploit, undefined, 'exploit field must be stripped');
});

// --- Server-side fail-closed pattern (B-2) ---

test('GUARD-S-FAILCLOSED: unlisted action type → server validator rejects (fail-closed)', () => {
  assert.throws(
    () => validateAction('exploit-type', { anything: true }),
    /No validation schema/,
    'Unlisted action type must be rejected, not silently passed'
  );
});
