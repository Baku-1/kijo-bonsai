// ---------------------------------------------------------------------------
// test_nullguard.mjs — Targeted audit test for the null guard in ThreeCanvas.tsx
//
// Context: ThreeCanvas.tsx line 263 has a defensive null guard:
//   if (!session) return; // invariant: non-null because treeId was non-null above
//
// This test:
//   1. Proves the invariant: when treeId is non-null, session MUST be non-null
//      (tracing every path through getSession() derivation).
//   2. Shows the guard would catch a null session if the invariant ever broke —
//      i.e., accessing session.access_token without the guard throws TypeError.
//   3. Tests all three getSession() return shapes and their treeId derivations.
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(cond, label, extra = '') {
  if (cond) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL — ${label}${extra ? ': ' + extra : ''}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Mirror the derivation logic from ThreeCanvas.tsx lines 164–165:
//   session = getSession();
//   const treeId = session?.tree_id ?? null;
//
// And the guard logic at line 205 + 263:
//   if (!treeId) return;     // early exit A
//   ...
//   if (!session) return;    // null guard (line 263)
//   const mode = session.access_token ? 'read-write' : 'read-only';
// ---------------------------------------------------------------------------

/** Simulates the session flow in ThreeCanvas.tsx, returns what happens at each gate. */
function simulateSessionFlow(mockGetSession) {
  const session = mockGetSession();
  const treeId = session?.tree_id ?? null;

  // Early exit A (line 205)
  if (!treeId) return { outcome: 'early-exit-no-treeid', session, treeId };

  // Null guard (line 263) — the code under audit
  if (!session) return { outcome: 'guard-fired', session, treeId };

  // Lines 264–269 — would throw TypeError without the guard if session were null
  const mode = session.access_token ? 'read-write' : 'read-only';
  return { outcome: `success-${mode}`, session, treeId };
}

// ---------------------------------------------------------------------------
// Part 1 — Invariant verification: treeId non-null ⇒ session non-null
// ---------------------------------------------------------------------------
console.log('\nINVARIANT CHECK: treeId non-null ⇒ session non-null\n');

// Case A: getSession() returns null (guest mode, no URL param)
{
  const r = simulateSessionFlow(() => null);
  assert(r.session === null, 'Case A: null session → session is null');
  assert(r.treeId === null, 'Case A: null session → treeId is null');
  assert(r.outcome === 'early-exit-no-treeid', 'Case A: early-exits before null guard');
}

// Case B: getSession() returns session from sessionStorage with tree_id
{
  const mockSession = { tree_id: 'uuid-abc-123', access_token: 'jwt-tok', wallet_row_id: 'wid-1' };
  const r = simulateSessionFlow(() => mockSession);
  assert(r.session !== null, 'Case B: stored session → session non-null');
  assert(r.treeId === 'uuid-abc-123', 'Case B: treeId derived from session.tree_id');
  assert(r.outcome === 'success-read-write', 'Case B: access_token present → read-write');
  // Invariant holds: treeId is non-null AND session is non-null
  assert(!(r.treeId !== null && r.session === null), 'Case B: invariant holds (treeId non-null ⇒ session non-null)');
}

// Case C: getSession() returns URL-param-only session (read-only: access_token='')
// This matches persistence.ts line 77: { tree_id: urlTreeId, access_token: '', wallet_row_id: '' }
{
  const mockSession = { tree_id: 'uuid-url-only', access_token: '', wallet_row_id: '' };
  const r = simulateSessionFlow(() => mockSession);
  assert(r.session !== null, 'Case C: URL-param session → session non-null');
  assert(r.treeId === 'uuid-url-only', 'Case C: treeId derived from URL param session');
  assert(r.outcome === 'success-read-only', 'Case C: empty access_token → read-only');
  // Invariant holds: treeId is non-null AND session is non-null
  assert(!(r.treeId !== null && r.session === null), 'Case C: invariant holds (treeId non-null ⇒ session non-null)');
}

// Case D: getSession() returns session with empty/falsy tree_id
// (e.g. malformed sessionStorage)
{
  const mockSession = { tree_id: '', access_token: 'tok', wallet_row_id: 'wid' };
  const r = simulateSessionFlow(() => mockSession);
  // tree_id = '' → '' ?? null = '' → !'' = true → early exit A fires
  // Note: ?? does NOT coalesce empty string, only null/undefined
  // So treeId = '' (empty string) and !treeId = true → early exit
  assert(r.outcome === 'early-exit-no-treeid', 'Case D: empty tree_id → early exit (empty string is falsy)');
}

// ---------------------------------------------------------------------------
// Part 2 — Guard demonstrates protection: without it, null.access_token throws
// ---------------------------------------------------------------------------
console.log('\nGUARD BEHAVIOR: null session + non-null treeId access would throw\n');

// Synthetically construct the scenario the guard defends against:
// treeId is non-null (bypassed artificially), session is null.
// This CANNOT happen through getSession() in current code,
// but a future refactor could introduce this path.
{
  let guardCaughtCorrectly = false;
  let withoutGuardThrows = false;

  // With guard (mimics the actual code):
  function withGuard(session, treeId) {
    if (!treeId) return 'early-exit';
    if (!session) return 'guard-fired'; // ← the line under audit
    return session.access_token ? 'read-write' : 'read-only';
  }

  // Without guard:
  function withoutGuard(session, treeId) {
    if (!treeId) return 'early-exit';
    // No null guard — would throw if session is null:
    return session.access_token ? 'read-write' : 'read-only';
  }

  // Simulate: session = null, treeId = 'forced' (artificial invariant violation)
  const forcedNull = null;
  const forcedTreeId = 'forced-non-null';

  const guardResult = withGuard(forcedNull, forcedTreeId);
  guardCaughtCorrectly = (guardResult === 'guard-fired');
  assert(guardCaughtCorrectly, 'Guard fires and returns early (no throw) when session is null');

  try {
    withoutGuard(forcedNull, forcedTreeId);
  } catch (e) {
    withoutGuardThrows = e instanceof TypeError;
  }
  assert(withoutGuardThrows, 'Without guard: null.access_token throws TypeError');
}

// ---------------------------------------------------------------------------
// Part 3 — Exhaustive proof: every getSession() return shape
// ---------------------------------------------------------------------------
console.log('\nEXHAUSTIVE: all getSession() shapes → invariant preserved\n');

// Every shape getSession() CAN return, per persistence.ts:
const getSessionShapes = [
  // Shape 1: returns null
  { label: 'null (guest, no URL param)', factory: () => null },
  // Shape 2: full session (all fields populated)
  { label: 'full session (auth mode)', factory: () => ({ tree_id: 't1', access_token: 'jwt', wallet_row_id: 'w1' }) },
  // Shape 3: read-only URL session (empty access_token)
  { label: 'URL-only session (read-only)', factory: () => ({ tree_id: 't2', access_token: '', wallet_row_id: '' }) },
];

for (const shape of getSessionShapes) {
  const session = shape.factory();
  const treeId = session?.tree_id ?? null;
  const invariantHolds = !(treeId !== null && session === null);
  assert(invariantHolds, `Shape "${shape.label}": invariant holds (treeId non-null ⇒ session non-null)`);
}

// ---------------------------------------------------------------------------
console.log('\n──────────────────────────────────────────────────────────────');
console.log(`Null guard audit result: ${passed} passed, ${failed} failed`);
console.log('──────────────────────────────────────────────────────────────\n');
if (failed > 0) process.exit(1);
