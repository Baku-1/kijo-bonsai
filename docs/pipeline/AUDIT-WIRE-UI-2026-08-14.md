# AUDIT-WIRE-UI-2026-08-14

**Pipeline stage:** Auditor (Adversarial Auditor skill)  
**Date:** 2026-08-14  
**Subject:** Wire/Remove UI panel -- Task #160  
**Files audited:** `apps/web/index3d.html` (spec: 113 lines), `apps/web/src/main3d.ts` (spec: 854 lines)  
**Status:** VERIFIED WITH CAVEATS

---

## VERDICT: VERIFIED WITH CAVEATS

All W7-W18 gates pass by direct code observation. `tsc --noEmit` observed to exit 0.
Both critic findings incorporated (round4, angleDelta===0 guard). Line counts exact.
Two caveats require follow-up — neither is a code bug in the Wire UI itself.

---

## STEP 0 — FALSIFIABLE CLAIMS EXTRACTED

From STATE.md and implementer context:

1. `tsc --noEmit` from `apps/web` exits 0
2. `index3d.html` is 113 lines
3. `main3d.ts` is 854 lines
4. Critic finding: `round4(result.newAngle! - result.oldAngle!)` in Apply handler
5. Critic finding: `angleDelta === 0` guard fires before `tree.wire()`
6. `wireAngleInput` input handler does NOT mutate BonsaiTree
7. `selectionIndicator` added to scene directly (IIFE), NOT in `meshes` Map
8. W7–W18 (all except W11) pass by code review

---

## STEP 1 — RE-RUN EVERY NAMED CHECK

### tsc --noEmit

**Observed command:** `cd apps/web && npx tsc --noEmit`  
**Observed exit code:** 0 (no errors, only npm notice noise)  
✓ **VERIFIED**

### Line counts

**Observed:** `wc -l apps/web/index3d.html` → **113**  
**Observed:** `wc -l apps/web/src/main3d.ts` → **854**  
✓ **VERIFIED** — both match implementer's claimed counts exactly.

---

## STEP 2 — DIFF / SCOPE CHECK

`git status` in the repo shows the following files modified beyond the Wire UI spec scope
(`apps/web/index3d.html` + `apps/web/src/main3d.ts` + `DECISIONS.md` + `STATE.md`):

| File | In spec? | Explanation |
|------|----------|-------------|
| `apps/web/index3d.html` | YES | Wire UI spec |
| `apps/web/src/main3d.ts` | YES | Wire UI spec |
| `DECISIONS.md` | YES | Required doc update |
| `STATE.md` | YES | Required doc update |
| `apps/server/supabase/functions/care-action/index.ts` | NO (separate task) | Task #161 fix — verified by separate audit (AUDIT-CARE-ACTION-WIRE-REMOVE-2026-08-14.md) |
| `apps/web/src/persistence.ts` | NO | Adds `saveTreeCache`/`loadTreeCache`/`clearTreeCache` — scope of a different session |
| `apps/web/src/components/ThreeCanvas.tsx` | NO | Adds local cache wiring — scope of a different session |
| `packages/engine/src/CareLogReplay.ts` | NO | Part of TwineWeight task — see CAVEAT-2 below |

The out-of-scope changes are from distinct concurrent tasks; the Wire UI spec itself correctly
touches only the two target files plus docs. No source regression introduced by the Wire UI
implementation was found.

---

## STEP 3 — FOUR FRAUDS HUNTED

**Weakened tests:** No test files touched in this task. N/A.  
**False completion:** tsc observed independently, exit 0. Not false.  
**Intent inversion:** All gate checks align with spec intent (see per-gate below).  
**Phantom evidence:** All cited file:line references verified by direct read. None phantom.

---

## STEP 4 — INTENT CHECK (forced artifact)

```
INTENT CHECK
  code does:     angleDelta===0 returns early with hint before tree.wire(); round4 wraps
                 appliedDelta; selectionIndicator lives outside meshes Map; prune/wire
                 mutual exclusion on both toggle paths; tmpVec.clone() in wire branch.
  check expects: W7 toggle+active, W8 wire->deactivate prune, W9 prune->deactivate wire,
                 W10 enableRotate=false, W12 raycaster select, W13 off-mesh deselect,
                 W14 indicator survives rebuildVoxels, W15 delta=0 guard, W16 round4+log+persist,
                 W17 result.ok=false hint, W18 removeWire+persist+GAP-1-comment.
  spec says:     ARCH-WIRE-UI-2026-08-14.md + CRITIC-WIRE-UI-2026-08-14.md (all 4 findings).
  verdict:       ALIGNED
```

---

## STEP 5 — PER-GATE VERIFICATION

### W7 — wireMode toggle + `.active` CSS class on wireBtn

**Code observed:**
```
main3d.ts:623  wireBtn.addEventListener('click', () => {
main3d.ts:624    wireMode = !wireMode;
main3d.ts:625    wireBtn.classList.toggle('active', wireMode);
```
✓ **VERIFIED** — toggle and CSS class on every click.

---

### W8 — activating wire deactivates pruneMode

**Code observed:**
```
main3d.ts:627  if (wireMode) {
main3d.ts:629    if (pruneMode) {
main3d.ts:630      pruneMode = false;
main3d.ts:631      pruneBtn.classList.remove('active');
main3d.ts:632    }
```
✓ **VERIFIED** — prune is cleared when wire activates.

---

### W9 — activating prune deactivates wireMode

**Code observed:**
```
main3d.ts:650  if (pruneMode && wireMode) {
main3d.ts:652    wireMode = false;
main3d.ts:653    wireBtn.classList.remove('active');
main3d.ts:654    deselectWireBranch();
main3d.ts:655  }
```
✓ **VERIFIED** — wire is cleared when prune activates.

---

### W10 — `controls.enableRotate = false` while wire or prune active

**Code observed:**
```
main3d.ts:633    controls.enableRotate = false;   // wire mode on
main3d.ts:657    controls.enableRotate = !(pruneMode || wireMode);  // prune toggle
```
✓ **VERIFIED** — orbit disabled for both sculpt modes.

---

### W11 — MANUAL-ONLY (deferred)

Gate requires branch.thickness > 3.0, which needs 30+ growth days. Code comment at
main3d.ts:731-732 documents this explicitly. Marked manual-only in STATE.md.  
**SKIPPED per audit instructions. Status: DEFERRED.**

---

### W12 — raycaster click selects branch; indicator becomes visible

**Code observed:**
```
main3d.ts:391  if (wireMode) {
main3d.ts:393    hitBranch = true;
main3d.ts:395    if (selectedBranchId === clickedId) {
main3d.ts:397      deselectWireBranch();
main3d.ts:399    } else {
main3d.ts:401      selectWireBranch(clickedId, tmpVec.clone());
main3d.ts:402    }
```

`selectWireBranch` (main3d.ts:573-587):
```
main3d.ts:575  selectionIndicator.position.copy(worldPos);
main3d.ts:576  selectionIndicator.visible = true;
main3d.ts:584  wireControls.style.display = '';
```
✓ **VERIFIED** — indicator made visible, controls shown on branch click.

---

### W13 — click off-mesh deselects; indicator hidden

**Code observed:**
```
main3d.ts:408  if (wireMode && !hitBranch) deselectWireBranch();
```

`deselectWireBranch` (main3d.ts:561-567):
```
main3d.ts:563  selectionIndicator.visible = false;
main3d.ts:564  wireControls.style.display = 'none';
```
✓ **VERIFIED** — deselect fires when no voxel hit in wire mode.

---

### W14 — selectionIndicator survives `rebuildVoxels()`

**Code observed (IIFE, main3d.ts:150-157):**
```
main3d.ts:150  const selectionIndicator = (() => {
main3d.ts:151    const g = new THREE.SphereGeometry(2.5, 8, 6);
main3d.ts:152    const m = new THREE.MeshBasicMaterial({ color: 0xffdd00, wireframe: true });
main3d.ts:153    const mesh = new THREE.Mesh(g, m);
main3d.ts:154    mesh.visible = false;
main3d.ts:155    scene.add(mesh);           // <-- added directly to scene
main3d.ts:156    return mesh;
main3d.ts:157  })();
```

`clearVoxels` (main3d.ts:213-219) iterates only `meshes.values()`. `selectionIndicator`
is not in `meshes` — confirmed by exhaustive grep: only `meshes.set(mat, mesh)` at
line 242 adds to the Map, and `selectionIndicator` is never passed to `meshes.set`.
✓ **VERIFIED** — indicator is scene-resident, not Map-resident; survives rebuild.

---

### W15 — angleDelta === 0 guard fires, no `tree.wire()` call

**Code observed:**
```
main3d.ts:722  if (angleDelta === 0) {
main3d.ts:723    hintEl.textContent = 'No angle change -- adjust the slider before applying wire.';
main3d.ts:724    return;
main3d.ts:725  }
main3d.ts:727  const result = tree.wire(selectedBranchId, angleDelta);
```

Guard at line 722 is unconditional `return` before line 727.  
✓ **VERIFIED** — `tree.wire()` is unreachable when delta is zero.

---

### W16 — Apply: round4 on delta, `localCareLog.push(...)`, `persistAsync(...)` called

**round4 on delta (critic finding incorporated):**
```
main3d.ts:742  const appliedDelta = round4(result.newAngle! - result.oldAngle!);
```
`round4` imported at main3d.ts:5: `import { WATER_AMOUNT, round4 } from '@kijo/shared';`

**localCareLog.push:**
```
main3d.ts:746-756  localCareLog.push({ day: tree.getAge(), action: { type: 'wire',
                     branchId: selectedBranchId, angleDelta: appliedDelta,
                     oldAngle: result.oldAngle!, newAngle: result.newAngle!,
                     wireCost: result.wireCost! } });
```

**persistAsync:**
```
main3d.ts:760-767  persistAsync({ type: 'wire', branchId: selectedBranchId,
                     angleDelta: appliedDelta, oldAngle: result.oldAngle!,
                     newAngle: result.newAngle!, wireCost: result.wireCost! });
```
✓ **VERIFIED** — all three checks pass. round4 discipline confirmed.

---

### W17 — `result.ok = false` → failure hint shown, no persistAsync

**Code observed:**
```
main3d.ts:729  if (!result.ok) {
main3d.ts:733    hintEl.textContent = `Wire failed: ${result.reason}`;
main3d.ts:734    return;
```
`persistAsync` is unreachable when `!result.ok` (return at line 734 precedes it).  
✓ **VERIFIED**

---

### W18 — Remove calls `tree.removeWire()`, `persistAsync()` called; GAP-1 comment present

**Code observed:**
```
main3d.ts:795  tree.removeWire(branchIdToRemove);
main3d.ts:797-801  localCareLog.push({ day: tree.getAge(),
                     action: { type: 'wire-remove', branchId: branchIdToRemove } });
main3d.ts:805  persistAsync({ type: 'wire-remove', branchId: branchIdToRemove });
```

**GAP-1 comment:**
```
main3d.ts:779  // NOTE (GAP-1 / OQ-WIRE-1): 'wire-remove' is NOT in care-action ALLOWED_ACTION_TYPES.
main3d.ts:780  // persistAsync below will produce a 400 from the server; error logged to console only.
main3d.ts:781  // Local state IS updated; server state is NOT until task #161 deploys the server fix.
main3d.ts:782  // Wire-remove IS a debug tool until OQ-WIRE-1 is resolved.
```
✓ **VERIFIED** — code is correct. GAP-1 comment is present.  
⚠️ **CAVEAT-1:** The comment content is now factually stale — see below.

---

### Bend preview non-mutation (W14 corollary)

Checked the entire `wireAngleInput.addEventListener('input', ...)` handler
(main3d.ts:594-621). It:
- reads `branch.angle`, `branch.wireCount`, `branch.wired`, `branch.wireAppliedDay` (all reads)
- writes to `wireAngleLabel.textContent` and `wireBranchInfo.textContent` (DOM only)
- calls NO `tree.wire()`, `tree.removeWire()`, `tree.prune()`, or any BonsaiTree mutator

Confirmed by grep: zero occurrences of `tree.wire\|tree.removeWire` within the handler block.  
✓ **VERIFIED** — bend preview is purely presentational.

---

### tmpVec.clone() in wire branch selection path

**Code observed:**
```
main3d.ts:399  // tmpVec.clone() is required: tmpVec is a reused scratch vector and will be
main3d.ts:400  // mutated on the next raycaster call. Clone captures the current position.
main3d.ts:401  selectWireBranch(clickedId, tmpVec.clone());
```
The prune path at main3d.ts:381-388 uses `tmpVec` without clone (returns immediately —
correct). The wire path clones before storing in the indicator.  
✓ **VERIFIED**

---

### Critic findings all incorporated

| Finding | Required change | Status |
|---------|----------------|--------|
| §3: round4 on appliedDelta | `round4(result.newAngle! - result.oldAngle!)` | ✓ main3d.ts:742 |
| §4 FINDING-2: angleDelta===0 guard | return early with hint | ✓ main3d.ts:722-725 |
| §4 FINDING-3: W11 untestable on fresh tree | comment in code, mark manual-only | ✓ main3d.ts:731-732 |
| §4 FINDING-4: wireControls after prune-in-wire | unreachable in spec; no code needed | N/A — noted, no action |

---

### DECISIONS.md updated

Observed: DECISIONS.md entries for 2026-08-14 include (lines 180-194):
- Wire UI panel additions
- Wire/prune mutual exclusion
- angleDelta===0 guard
- round4 discipline
- GAP-1 comment
- Bend preview non-mutation
- W11 manual-only marking

✓ **VERIFIED** — all architectural decisions documented.

### STATE.md updated

Observed: STATE.md line 3 declares task #160 COMPLETE with correct gate list.
W7-W10, W12-W18 verified; W11 manual-only; W19 (tsc) passed.  
✓ **VERIFIED**

---

## STEP 5 — NEW FINDINGS (not in implementer's report)

### CAVEAT-1: GAP-1 comment in main3d.ts is now STALE (not a code bug)

**Severity: LOW** (documentation error, not runtime defect)

The comment at main3d.ts:779-782 states that `'wire-remove'` is absent from
`ALLOWED_ACTION_TYPES` and `persistAsync` will produce a 400. This was true at
implementation time. However, a separate concurrent task (Task #161) has since
added `'wire-remove'` to the whitelist and **deployed care-action version 7 to
Supabase** — independently verified in `AUDIT-CARE-ACTION-WIRE-REMOVE-2026-08-14.md`.

Observed from git diff:
```diff
- const ALLOWED_ACTION_TYPES = new Set(['water', 'prune', 'wire', 'fertilize', 'rotate']);
+ const ALLOWED_ACTION_TYPES = new Set(['water', 'prune', 'wire', 'wire-remove', 'fertilize', 'rotate']);
```

**Impact:** The comment misleads future readers. `persistAsync({ type: 'wire-remove', ... })`
will now reach `insert_care_log_entry` on the server (confirmed in the care-action audit).
The code behavior (calling `persistAsync`) is correct. Only the comment is wrong.

**STATE.md is also stale:** Line 223 still shows Task #161 as an "open blocker".
It should be updated to COMPLETE.

**Required follow-up:** Update the GAP-1 comment in main3d.ts:779-782 and the STATE.md
task pointer to reflect that Task #161 is resolved and wire-remove IS server-persisted.

---

### CAVEAT-2 / NEW BLOCKER: CareLogReplay.ts throws on `wire-remove` — breaks reconstruction

**Severity: HIGH** (core invariant violation — separate task introduced this regression)

`packages/engine/src/CareLogReplay.ts` was modified (by the TwineWeight task, not
the Wire UI task) to change the `wire-remove` branch from:

```typescript
// BEFORE:
tree.removeWire(a.branchId);
```

to:

```typescript
// AFTER (throws):
throw new CareLogReplayError(
  `'wire-remove' is not yet implemented and cannot be replayed (Phase 2).`
);
```

**Why this is critical now:** Task #161 has deployed `'wire-remove'` to the server
whitelist. A user who applies wire-remove via the Wire UI will have that action
persisted in the server care log. On cold page reload (cache miss), `loadCareLog()`
fetches the server log and `CareLogReplay.reconstruct()` attempts to replay it.
When it encounters the `wire-remove` entry, it **throws**, breaking tree reconstruction
entirely and violating the core invariant (`seed + care_log → identical tree, everywhere`).

**This regression was not present before the TwineWeight task modified CareLogReplay.ts.**
The original code correctly delegated to `tree.removeWire(a.branchId)`.

**This is not a defect in the Wire UI implementation (Task #160) itself.** The Wire UI
is correct. The regression was introduced by a different pipeline task that touched
an engine file outside the Wire UI scope. It must be fixed before wire-remove can be
used in production.

**Required action:** A new task is needed to restore `tree.removeWire(a.branchId)` in
`CareLogReplay.ts` — or at minimum to change the throw to a no-op / console.warn until
Phase 2 implementation lands, so reconstruction does not crash.

---

## VERDICT

```
VERDICT: VERIFIED WITH CAVEATS

CLAIMS CHECKED:
  ✓ tsc --noEmit exits 0               — observed: exit code 0
  ✓ index3d.html is 113 lines          — observed: 113 (wc -l)
  ✓ main3d.ts is 854 lines             — observed: 854 (wc -l)
  ✓ round4 on appliedDelta             — main3d.ts:742
  ✓ angleDelta===0 guard before wire() — main3d.ts:722-725 before :727
  ✓ input handler: no BonsaiTree mutation — grep confirms zero tree.wire/removeWire in handler
  ✓ selectionIndicator IIFE scene.add  — main3d.ts:150-157; not in meshes Map
  ✓ W7: toggle + .active class         — main3d.ts:624-625
  ✓ W8: wire activates → prune off     — main3d.ts:629-631
  ✓ W9: prune activates → wire off     — main3d.ts:650-655
  ✓ W10: enableRotate=false            — main3d.ts:633, :657
  ✓ W12: click selects, indicator vis  — main3d.ts:391-401 + :575-576
  ✓ W13: off-mesh deselects            — main3d.ts:408
  ✓ W14: indicator not in meshes Map   — main3d.ts:155 vs :242
  ✓ W15: delta=0 guard, no tree.wire() — main3d.ts:722-725
  ✓ W16: round4 + log + persist        — main3d.ts:742, :746-756, :760-767
  ✓ W17: ok=false → hint, no persist   — main3d.ts:729-734
  ✓ W18: removeWire + persist + GAP-1  — main3d.ts:795, :805, :779-782
  ✓ tmpVec.clone() in wire path        — main3d.ts:401
  ✓ Critic finding §3 (round4)         — main3d.ts:742
  ✓ Critic finding §4/FINDING-2 (delta=0) — main3d.ts:722-725
  ✓ Critic finding §4/FINDING-3 (W11 comment) — main3d.ts:731-732
  ✓ DECISIONS.md updated               — 2026-08-14 entries present
  ✓ STATE.md updated                   — Task #160 COMPLETE

CAVEATS:
  ⚠ GAP-1 comment in main3d.ts:779-782 is stale — server fix (Task #161) already
    deployed as care-action v7. Wire-remove IS now server-persisted. Comment says
    it will return 400; it will not. Update comment + STATE.md.

  ⛔ NEW BLOCKER (separate task regression): CareLogReplay.ts now throws on
    'wire-remove' instead of calling tree.removeWire(). With wire-remove now
    server-persisted, cold-reload reconstruction of trees with wire-remove actions
    will crash. Core invariant violated. Must be fixed before wire-remove is
    production-safe. New task required.

INTENT CHECK:
  code does / check expects / spec says: ALIGNED (see Step 4)

SCOPE:
  Wire UI changes (2 files) are exactly as specified. Other modified files
  (care-action, persistence.ts, ThreeCanvas.tsx, CareLogReplay.ts) are from
  concurrent tasks and have their own pipeline docs.

FRAUDS HUNTED:
  weakened tests: none (no test files in scope)
  false completion: none (tsc 0 independently confirmed)
  intent inversion: none (all gates aligned with spec)
  phantom evidence: none (all cited line:file verified by direct read)

BOTTOM LINE: Wire UI (Task #160) is correctly implemented — all 12 W-series gates
pass, both critic findings incorporated, tsc clean. Two caveats require follow-up
tasks: (1) update stale GAP-1 comment, (2) fix CareLogReplay.ts regression that
makes wire-remove crash reconstruction.
```

---

*Audit complete. No source files changed — audit doc only.*  
*Pipeline: Architect → Critic → Implementer → **Auditor** → Linter*
