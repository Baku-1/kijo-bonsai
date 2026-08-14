# IMPL: C-3 Ghost Hint Suppression — main3d.ts
**Date:** 2026-08-13
**Stage:** Implementer (pipeline stage 3 of 5)
**Audit finding:** AUDIT-VIEWS-2026-07-28.md C-3 (lines 36-40)
**Spec consumed:** docs/pipeline/ARCH-GHOST-C3-FIX-2026-08-13.md
**Skills invoked:** disciplined-implementer, engineering-craft-standard, carmack-linus-review

---

## OUTCOME

DONE WITH CAVEATS. Both ghost.visible guards are in place and verified by direct read.
TypeScript errors present are pre-existing and not introduced by this change.
Three follow-on gaps noted (see CAVEATS).

---

## DONE WHEN

**Named check:** Read apps/web/src/main3d.ts and confirm the ghost geometry
guard exists at both init() code paths, before refreshAll().

**Observed result:**

- Line 415 (local cache path, after console.info, before refreshAll()):
  `ghost.visible = ghostVisible && (((tree.getSeed() % 7) + 7) % 7 === 0);`
  Confirmed by Read lines 408-421.

- Line 464 (server/guest fallback path, after cacheReady = true, before refreshAll()):
  `ghost.visible = ghostVisible && (((tree.getSeed() % 7) + 7) % 7 === 0);`
  Confirmed by Read lines 456-467.

A non-Chokkan seed (styleIndex 1-6) will have ghost.visible set to false at
both tree-load code paths before the first render call. ghost.visible=false
is Three.js's visibility suppression mechanism; the geometry remains in the
scene graph but is culled from rendering. This is the "or equivalent" case
permitted by the done-when check.

---

## WHAT CHANGED

**File:** apps/web/src/main3d.ts  
**Lines added:** 2 (lines 415 and 464 in the final file)  
**Lines removed:** 0

Insertion A (local cache path) -- between the closing `)` of console.info
and `refreshAll()` at original line 415:
```typescript
      ghost.visible = ghostVisible && (((tree.getSeed() % 7) + 7) % 7 === 0);
```

Insertion B (server load path / guest fallback) -- between `cacheReady = true`
and `refreshAll()` at original line 463:
```typescript
  ghost.visible = ghostVisible && (((tree.getSeed() % 7) + 7) % 7 === 0);
```

No other files were modified. The ghost geometry (CylinderGeometry, lines 121-134),
ghost material, ghostBtn handler (line 511-515), and all of refreshAll() are
unchanged.

**Defensive modulo rationale:** BonsaiTree.getSeed() returns `number`
(BonsaiTree.ts line 306: `getSeed(): number { return this.state.seed; }`).
The DOM input `valueAsNumber || 42` is unconstrained. Per implementer
instructions, the defensive form `((n % 7) + 7) % 7` was used. Note: as
flagged in the Carmack-Linus review below, this is mathematically redundant
for an `=== 0` check -- both forms are equivalent for divisibility testing.
The simple form `tree.getSeed() % 7 === 0` would also be correct.

---

## VERIFIED BY OBSERVATION

**Insertion A -- direct read (lines 408-421):**
```
411:      cacheReady = true;
412:      console.info(
413:        `[kijo] restored from local cache -- age=${cache.age} ...`,
414:      );
415:      ghost.visible = ghostVisible && (((tree.getSeed() % 7) + 7) % 7 === 0);
416:      refreshAll();
417:      return;
418:    } catch (err: unknown) {
```

**Insertion B -- direct read (lines 463-466):**
```
463:  cacheReady = true;
464:  ghost.visible = ghostVisible && (((tree.getSeed() % 7) + 7) % 7 === 0);
465:  refreshAll();
466: }
```

**Line count:** wc -l reports 591. Original file Read showed 590 lines (589
newlines -- no trailing newline on final line). 589 + 2 = 591. Consistent
with exactly 2 lines added.

**TypeScript check (`npx tsc --noEmit` from apps/web):** Exits with 4 errors,
none on the lines I added. All 4 are pre-existing:
  - main3d.ts(18,8): CareLogEntry import error -- pre-existing refactor, line 18
  - ThreeCanvas.tsx(33,8): same CareLogEntry issue in a separate file
  - ThreeCanvas.tsx(263,22): session possibly null -- pre-existing
  - ThreeCanvas.tsx(265,45): session possibly null -- pre-existing
No error references line 415 or 464. Zero new errors introduced.

---

## CARMACK-LINUS REVIEW

Reviewed the two inserted lines in context.

**Finding 1 (cosmetic):** The defensive modulo `(((tree.getSeed() % 7) + 7) % 7 === 0)`
is mathematically equivalent to `tree.getSeed() % 7 === 0` for an `=== 0` divisibility
check. JavaScript's `%` returns 0 for all integer multiples of 7, including negative
multiples (-7 % 7 === 0, -14 % 7 === 0). The defensive form adds no correctness value
here but does add visual noise. The simple form is cleaner. Not a correctness issue.

**Finding 2 (notable bug, out of scope per ARCH):** The existing ghostBtn click handler
(line 511-515) sets `ghost.visible = ghostVisible` without a seed check. After this fix
lands, a user on a non-Chokkan seed can double-toggle the ghost button to restore
ghost.visible=true, re-showing the wrong ghost. This is the "btn-new handler gap" flagged
in ARCH-GHOST-C3-FIX-2026-08-13.md Open Questions item 1. It is NOT introduced by this
change -- it is exposed by it. A follow-on fix is required:
```typescript
// ghostBtn handler fix (separate ticket):
ghost.visible = ghostVisible && (tree.getSeed() % 7 === 0);
```

**Overall verdict (Carmack x Linus):** Two correct lines, right placement, right logic.
Defensive modulo is redundant noise but not wrong. The real issue is the ghostBtn handler
gap which must be closed before shipping. See CAVEATS.

---

## CAVEATS

**C-1. ghostBtn handler violates the ghost invariant on double-toggle.**
After init() suppresses the ghost for a non-Chokkan seed, clicking btn-ghost twice
sets ghost.visible=true again. The ARCH doc flags this as "out of scope" (Open
Questions item 1). It must be addressed in a follow-on ticket before this feature
ships. Until fixed, the C-3 suppression can be bypassed by the user.

**C-2. btn-new handler does not update ghost.visible after tree replacement.**
When the user creates a new tree via btn-new (line 469-479), tree is replaced
with newTree() and refreshAll() is called, but ghost.visible is not updated.
If the prior tree was Chokkan (ghost=visible) and the new tree is non-Chokkan,
the ghost will remain visible. Same pattern as C-1; same follow-on fix applies.
Also flagged in ARCH Open Questions item 1.

**C-3. TypeScript compilation has 4 pre-existing errors.**
The done-when criterion "TypeScript compilation succeeds with zero new errors"
is satisfied in intent -- zero errors were introduced by this change. However,
the baseline itself has 4 errors. These are pre-existing and unrelated to C-3.
Auditor should confirm these errors exist on the baseline (before this task's
2 lines) by checking that none reference line 415 or 464.

**C-4. Ghost geometry remains in Three.js scene graph for non-Chokkan seeds.**
The done-when check says "will not have ghost geometry added to the Three.js
scene." Technically, ghost is always in the scene (added at module level, line 135).
The fix sets ghost.visible=false, which achieves the same effect (Three.js culls
invisible objects from rendering). This is the "or equivalent" case explicitly
permitted by the ARCH spec ("This is a visibility suppression, not a geometry
change.") No player-visible impact; flagged for auditor awareness.

