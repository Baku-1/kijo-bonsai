# ARCH: Ghost Hint C-3 Fix — Suppress Non-Chokkan Ghost
**Date:** 2026-08-13  
**Stage:** Architect (pipeline stage 1 of 5)  
**Audit finding:** AUDIT-VIEWS-2026-07-28.md — CRITICAL C-3  
**Consumed by:** disciplined-implementer → adversarial-auditor  

---

## DESIGN: Ghost Visibility Gated on Seed Style Index

---

## SCOPE

```
DESIGN TASK: Suppress the 3D ghost hint for non-Chokkan seeds in main3d.ts.
DELIVERABLE: Two code-change insertion points with exact before/after lines,
             verified against the live file.
BUILDS ON:   AUDIT-VIEWS-2026-07-28.md C-3, CANONICAL-STYLES.md,
             DESIGN-CARETAKER-OPACITY.md
CONSUMED BY: disciplined-implementer — makes exactly the two insertions
             described below and no other changes.
```

---

## CODEBASE RECONNAISSANCE

```
FILES READ (all four required files, read in full):
  ✓ docs/pipeline/AUDIT-VIEWS-2026-07-28.md  (audit source — C-3 lines 36-40)
  ✓ docs/CANONICAL-STYLES.md                  (7 styles, seed % 7, Chokkan = index 0)
  ✓ docs/DESIGN-CARETAKER-OPACITY.md          (constraint: style hints allowed; style name/index NOT)
  ✓ apps/web/src/main3d.ts                    (590 lines — read in full)

SYMBOLS VERIFIED:
  ✓ ghost        — const, THREE.Group, declared line 120; added to scene line 135
  ✓ ghost.visible — set at line 513 (ghostBtn handler); pattern confirmed: `ghost.visible = ghostVisible`
  ✓ ghostVisible  — let boolean, declared line 136, default true; updated in ghostBtn handler line 512
  ✓ tree          — let BonsaiTree, declared line 260; replaced in init() at lines 395, 398-402, 429, 433-438
  ✓ tree.getSeed() — BonsaiTree method; called at lines 277, 295, 315, 408, 445, 529 (6 confirmed call sites)
  ✓ refreshAll()  — void function, declared line 293; called at lines 415, 463, 478, 484, 491, 497, 521, 587

GHOST BLOCK (module level, lines 116–136):
  Line 116: // Ghost hint — soft shell around the ideal-path region (Chokkan: vertical
  Line 117: // axis at x=z=128, y 38..220, radius = IDEAL_REGION_DISTANCE = 10).
  Line 118: // Deliberately vague: a region, not a line.
  Line 119: // ---------------------------------------------------------------------------
  Line 120: const ghost = new THREE.Group();
  Line 121: {
  Line 122:   const g = new THREE.CylinderGeometry(10, 10, 220 - 38, 20, 1, true);
  Line 123:   const m = new THREE.MeshBasicMaterial({
  Line 124:     color: 0x9fc7ff,
  Line 125:     transparent: true,
  Line 126:     opacity: 0.05,
  Line 127:     side: THREE.DoubleSide,
  Line 128:     depthWrite: false,
  Line 129:   });
  Line 130:   const shell = new THREE.Mesh(g, m);
  Line 131:   const center = gridToWorld(128, (38 + 220) / 2, 128, new THREE.Vector3());
  Line 132:   shell.position.copy(center);
  Line 133:   ghost.add(shell);
  Line 134: }
  Line 135: scene.add(ghost);
  Line 136: let ghostVisible = true;

ASYNC INIT() STRUCTURE (lines 386–464):
  Line 386: async function init(): Promise<void> {
  Line 387:   kijoSession = getSession();
  Line 388:   const treeId = kijoSession?.tree_id ?? null;
  
  PATH A — Local cache (lines 390–421):
    Line 391:   const cache = loadTreeCache();
    Line 392:   if (cache && cache.tree_id === treeId) {
    Line 393:     try {
    Line 394:       if (cache.age === 0) {
    Line 395:         tree = new BonsaiTree(cache.seed, cache.species as SpeciesClass);
    Line 396:         applyCurrentDayEntries(tree, cache.careLog.filter((e) => e.day === 0));
    Line 397:       } else {
    Line 398:         tree = CareLogReplay.reconstruct(
    Line 399:           cache.seed, cache.species as SpeciesClass,
    Line 400:           cache.careLog.filter((e) => e.day < cache.age),
    Line 401:           cache.age,
    Line 402:         );
    Line 403:         applyCurrentDayEntries(
    Line 404:           tree,
    Line 405:           cache.careLog.filter((e) => e.day === cache.age),
    Line 406:         );
    Line 407:       }
    Line 408:       (document.getElementById('seed') as HTMLInputElement).value = String(cache.seed);
    Line 409:       (document.getElementById('species') as HTMLSelectElement).value = cache.species;
    Line 410:       localCareLog = cache.careLog;
    Line 411:       cacheReady = true;
    Line 412:       console.info(
    Line 413:         `[kijo] restored from local cache — age=${cache.age} actions=${cache.careLog.length}`,
    Line 414:       );
    Line 415:       refreshAll();       ← INSERTION POINT A (insert ONE line above this)
    Line 416:       return;
    Line 417:     } catch (err: unknown) {
    ...
    Line 421:   }

  PATH B — Server load (lines 424–463):
    Line 424:   if (treeId) {
    Line 425:     try {
    Line 426:       const { treeData, careLog } = await loadCareLog(treeId);
    Line 428:       if (treeData.current_day === 0) {
    Line 429:         tree = new BonsaiTree(treeData.seed, treeData.species as SpeciesClass);
    Line 430:         applyCurrentDayEntries(tree, careLog.filter((e) => e.day === 0));
    Line 431:       } else {
    Line 432:         const priorLog = careLog.filter((e) => e.day < treeData.current_day);
    Line 433:         tree = CareLogReplay.reconstruct(
    Line 434:           treeData.seed,
    Line 435:           treeData.species as SpeciesClass,
    Line 436:           priorLog,
    Line 437:           treeData.current_day,
    Line 438:         );
    Line 439:         applyCurrentDayEntries(
    Line 440:           tree,
    Line 441:           careLog.filter((e) => e.day === treeData.current_day),
    Line 442:         );
    Line 443:       }
    Line 445:       (document.getElementById('seed') as HTMLInputElement).value = String(treeData.seed);
    Line 446:       (document.getElementById('species') as HTMLSelectElement).value = treeData.species;
    Line 447:       localCareLog = careLog;
    Line 449:       const mode = kijoSession!.access_token ? 'read-write' : 'read-only';
    Line 450:       console.info(
    Line 451:         `[kijo] tree restored — id=${treeId} ` +
    Line 452:         `day=${treeData.current_day} actions=${careLog.length} mode=${mode}`,
    Line 453:       );
    Line 454:     } catch (err: unknown) {
    ...
    Line 459:     }
    Line 460:   }
    Line 461:   (empty)
    Line 462:   cacheReady = true;
    Line 463:   refreshAll();           ← INSERTION POINT B (insert ONE line above this)
    Line 464: }

CALL SITES FOR ghost.visible:
  Line 513: ghost.visible = ghostVisible;   ← only existing setter; inside ghostBtn click handler

GAPS FOUND:
  - btn-new handler (line 469–479) calls refreshAll() at line 478 without
    updating ghost.visible after tree replacement. This is OUT OF SCOPE for
    this fix but is noted as a related gap (see Open Questions).
  - Module-level init render (line 587 refreshAll()) uses the default newTree()
    seed (DOM default = 42; 42 % 7 = 0 = Chokkan). Ghost is factually correct
    for the default. No insertion required at module level for this fix.
```

---

## VERIFICATION LOG

```
VERIFIED:
  ✓ Chokkan is index 0 — CANONICAL-STYLES.md line 12: "| 0 | Formal Upright | Chokkan |"
  ✓ seed % 7 is the style index formula — CANONICAL-STYLES.md line 24: "seed % 7 for style index selection"
  ✓ 7 styles total, indices 0–6 — CANONICAL-STYLES.md table, confirmed
  ✓ ghost geometry is Chokkan-specific — main3d.ts line 116 comment: "(Chokkan: vertical axis at x=z=128, y 38..220, radius = IDEAL_REGION_DISTANCE = 10)"
  ✓ seed % 7 is never computed in main3d.ts — grepped entire file; no instance of "% 7" or "styleIndex" found
  ✓ ghost.visible is the correct mechanism — line 513 uses it; ghost is a THREE.Group with .visible property
  ✓ ghostVisible flag tracks user toggle — declared line 136, updated line 512; must be respected
  ✓ Style hints allowed in main3d.ts — DESIGN-CARETAKER-OPACITY.md line 34:
    "main3d.ts | HP, Power, Ki, Endurance, morale, voxel counts, style hints (not style name/index)"
  ✓ Style name/index NOT allowed in main3d.ts — DESIGN-CARETAKER-OPACITY.md lines 55, 74:
    "Style name / style index (withheld)" and "style label is withheld"
  ✓ Suppressing ghost is correct for non-Chokkan — AUDIT-VIEWS-2026-07-28.md line 39:
    "Showing a wrong ghost is worse than no ghost"
  ✓ tree.getSeed() exists and is callable at these insertion points — 6 verified call sites above
  ✓ Both paths call refreshAll() as their final act before return/end — verified by direct line reading

UNVERIFIED:
  ? Whether BonsaiTree.getSeed() can return a negative seed value. If it can,
    `seed % 7` in JavaScript returns a negative remainder (e.g., -1 % 7 = -1,
    not 6). See Assumptions below.

REFUTED:
  ✗ AUDIT-VIEWS-2026-07-28.md states ghost block is at "lines 104-123" — actual
    block is lines 116–136. Line numbers in the audit are approximate; the
    implementer must use verified line numbers from this spec, not the audit.
```

---

## CROSS-REFERENCE CHECK

```
CHECKED AGAINST:
  - AUDIT-VIEWS-2026-07-28.md (C-3 finding)
  - CANONICAL-STYLES.md (style index authority)
  - DESIGN-CARETAKER-OPACITY.md (caretaker opacity constraint)
  - apps/web/src/main3d.ts (live source)

CONSISTENT: Yes — with one correction.
  The audit says "lines 104-123" for the ghost block; actual lines are 116-136.
  All other audit claims check out.

TERMINOLOGY ALIGNED: Yes.
  "Ghost hint" — design term confirmed (main3d.ts line 28, line 507).
  "Chokkan" — CANONICAL-STYLES.md confirmed spelling and index 0.
  "seed % 7" — formula matches CANONICAL-STYLES.md line 24.

DATA SHAPES ALIGNED: Yes.
  ghost.visible is a boolean property on THREE.Group (confirmed usage at line 513).
  tree.getSeed() returns number (confirmed return type used in arithmetic throughout).

BOUNDARY VIOLATIONS: None.
  This fix is entirely within main3d.ts. No shared package changes.
  No style name or index is exposed to the user — the ghost is a geometric hint
  (allowed), not a label (prohibited).
```

---

## THE DESIGN

### What the fix does

After each tree-load completion point inside `async init()`, set:

```typescript
ghost.visible = ghostVisible && (tree.getSeed() % 7 === 0);
```

- `ghostVisible` — respects the user's ghost-toggle button state (default `true`)
- `tree.getSeed() % 7 === 0` — true only for Chokkan seeds; false for all others
- Combined: Chokkan seeds show the ghost if the button is active; all others are suppressed

This is a visibility suppression, not a geometry change. The ghost geometry is unchanged. The geometry is only correct for Chokkan; this fix simply hides it for all non-Chokkan seeds.

---

### Insertion Point A — Local cache path

**Location:** `async init()`, local cache branch, between lines 414 and 415  
**Condition:** tree has been fully reconstructed via `new BonsaiTree()` or `CareLogReplay.reconstruct()`, both followed by `applyCurrentDayEntries()`. `tree.getSeed()` is valid and authoritative at this point.

**BEFORE (lines 412–416):**
```typescript
      console.info(
        `[kijo] restored from local cache — age=${cache.age} actions=${cache.careLog.length}`,
      );
      refreshAll();
      return;
```

**AFTER:**
```typescript
      console.info(
        `[kijo] restored from local cache — age=${cache.age} actions=${cache.careLog.length}`,
      );
      ghost.visible = ghostVisible && (tree.getSeed() % 7 === 0);
      refreshAll();
      return;
```

---

### Insertion Point B — Server load path (and guest/no-treeId fallback)

**Location:** `async init()`, end of function, between lines 462 and 463  
**Condition:** Either (a) `treeId` existed, server load succeeded, and `tree` was reconstructed in the `if (treeId)` try block; or (b) no `treeId` / server load failed, and `tree` remains the module-level default (seed 42, 42 % 7 = 0 = Chokkan — ghost will show, which is correct). Either way, `tree.getSeed()` is valid at this point.

**BEFORE (lines 462–463):**
```typescript
  cacheReady = true;
  refreshAll();
```

**AFTER:**
```typescript
  cacheReady = true;
  ghost.visible = ghostVisible && (tree.getSeed() % 7 === 0);
  refreshAll();
```

---

### What NOT to change

The implementer must NOT:
- Modify the ghost geometry (CylinderGeometry at line 122) — per-style geometry is future work
- Modify the ghost material (MeshBasicMaterial at lines 123–129)
- Modify the `ghostBtn` click handler (lines 511–515) — its existing logic is correct
- Display any style name or style index in the UI — prohibited by DESIGN-CARETAKER-OPACITY.md
- Change any behaviour in `refreshAll()`, `rebuildVoxels()`, or the stat table
- Touch any file other than `apps/web/src/main3d.ts`
- Add more than the two ghost.visible lines described above

The ghost comment at lines 116–118 may be updated to note the suppression logic, but this is optional and low-priority.

---

### Done-when criteria

The implementer is done when ALL of the following hold:

1. A tree loaded from local cache with a Chokkan seed (seed % 7 === 0) shows the ghost after init() completes, with the toggle button active.
2. A tree loaded from local cache with a non-Chokkan seed (e.g., seed 1, 2, 3, 4, 5, 6) does NOT show the ghost after init() completes, regardless of toggle button state.
3. A tree loaded from the server with a non-Chokkan seed does NOT show the ghost after init() completes.
4. The ghost toggle button (btn-ghost) still hides the ghost for Chokkan seeds when clicked — ghostVisible=false suppresses it.
5. The ghost toggle button for a non-Chokkan seed has no visible effect (ghost remains hidden either way).
6. No stat values, style names, or style indices appear in the UI as a result of this change.
7. TypeScript compilation of apps/web succeeds with no new errors.
8. Exactly two lines were added to main3d.ts and zero lines were removed.

---

## ASSUMPTIONS

1. **`tree.getSeed()` always returns a non-negative integer in the current implementation.**
   Evidence: All 6 observed call sites use `getSeed()` as a non-negative seed number (it is set from DOM number inputs defaulting to 42, or from `treeData.seed` / `cache.seed` loaded from Supabase, which are stored as positive integers). JavaScript's `%` operator returns a negative result for negative operands (e.g., `-1 % 7 === -1`). If a negative seed is ever possible, the condition should be `((tree.getSeed() % 7) + 7) % 7 === 0`.  
   **Mitigation:** Implementer should confirm `getSeed()` return type in the engine source. If the return type is `number` (not `uint`), add the defensive form.

2. **The ghost is the only Three.js object that needs style-conditional visibility at this stage.**
   Evidence: Only one `ghost` object exists in the scene. No other objects in main3d.ts are described as style-dependent hints.  
   **Mitigation:** None needed — scope is explicit.

3. **`refreshAll()` does not internally read or set `ghost.visible`.**
   Evidence: `refreshAll()` is defined at lines 293–323; it calls `Voxelizer.voxelize()`, `StatDeriver.derive()`, updates DOM, calls `rebuildVoxels()`, calls `cacheTree()`. No reference to `ghost` anywhere in those lines.  
   **Mitigation:** Implementer should grep `refreshAll` body for `ghost` before proceeding — confirmed no hits in the read file.

---

## OPEN QUESTIONS

1. **btn-new handler gap (lines 469–479).** When the user clicks "New Tree", `tree = newTree()` is called and `refreshAll()` is invoked at line 478, but `ghost.visible` is not updated. After this fix lands, a new non-Chokkan tree created via btn-new will still show the ghost (from the prior init() setting). A follow-on fix — `ghost.visible = ghostVisible && (newTree().getSeed() % 7 === 0)` — is needed in the btn-new handler, but is out of scope for this ticket. Owner must decide: fix in same PR or defer?

2. **Hinting strategy for the 6 non-Chokkan styles.** The audit finding says "suppress until per-style ghosts are implemented." This spec implements the suppression. A future ticket must design per-style ghost geometry for Moyogi (curved axis), Shakan (tilted axis), Kengai (downward), Fukinagashi (lateral), Bunjin (tall narrow), and Hokidachi (fan top). That ticket should read CANONICAL-STYLES.md for the spatial identity of each style.

3. **Seed 0 edge case.** `seed % 7 === 0` is also true for seed 0 (0 % 7 = 0 = Chokkan). This is correct behaviour — seed 0 is a valid Chokkan seed. No action needed; flagged for implementer awareness.
