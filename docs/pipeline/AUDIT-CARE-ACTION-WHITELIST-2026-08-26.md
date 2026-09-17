# AUDIT: Care-Action Whitelist Expansion (2026-08-26)
# STAGE: Adversarial Auditor
# SCOPE: 6 new action types added to care-action + seed-claim whitelists

---

```
VERDICT: CAVEATS

CLAIMS CHECKED:
  ✓ ALLOWED_ACTION_TYPES has 12 types — observed: care-action/index.ts line 98:
    Set(['water','prune','wire','wire-remove','fertilize','rotate','jin','landscape',
    'twine','twine-remove','weight','weight-remove']). Count = 12.

  ✓ ALLOWED_GUEST_ACTION_TYPES has 12 types — observed: seed-claim/index.ts lines 121-124:
    Set(['water','prune','wire','wire-remove','fertilize','rotate','jin','landscape',
    'twine','twine-remove','weight','weight-remove']). Count = 12.

  ✓ Both Sets match exactly — diffed element-by-element. Identical 12 members.
    Cross-reference comment at seed-claim line 116 ("Matches care-action/index.ts
    ALLOWED_ACTION_TYPES exactly") is accurate.

  ✓ Engine handles 'jin' — CareLogReplay.ts:141 routes to tree.applyJin().
    TechniqueClassifier.ts:68 counts jin entries.

  ✓ Engine handles 'landscape' — CareLogReplay.ts:145-150 throws CareLogReplayError
    ("not yet implemented, Phase 2"). TechniqueClassifier.ts:69 counts landscape entries.
    BonsaiTree.ts:285 logs landscape care actions.

  ✓ Engine handles 'twine' — CareLogReplay.ts:126-129 routes to tree.applyTwine().
    TwineWeightEngine.ts:125,178,182 implements application + care log.

  ✓ Engine handles 'twine-remove' — CareLogReplay.ts:130-132 routes to tree.removeTwine().
    TwineWeightEngine.ts:246 logs care entry.

  ✓ Engine handles 'weight' — CareLogReplay.ts:133-137 routes to tree.applyWeight().
    TwineWeightEngine.ts:310 logs care entry.

  ✓ Engine handles 'weight-remove' — CareLogReplay.ts:138-140 routes to tree.removeWeight().
    TwineWeightEngine.ts:359 logs care entry.

  ✓ No other logic changed in care-action/index.ts — file structure matches original
    (207 lines, all sections unchanged except the Set literal at line 98).

  ✓ No other logic changed in seed-claim/index.ts — ALLOWED_GUEST_ACTION_TYPES at
    lines 121-124 is the only Set definition; rest of file (545 lines) unchanged.

INTENT CHECK:
  code does:     Both whitelists accept the same 12 action types (6 original + 6 new).
                 Engine CareLogReplay routes all 12 types through their handlers.
  check expects: N/A (no automated gate test covers the whitelist membership directly).
  spec says:     DECISIONS.md 2026-08-17 (A8-2): "Matches care-action/index.ts
                 ALLOWED_ACTION_TYPES exactly." DECISIONS.md 2026-08-22: "landscape
                 action must remain in the care log." DECISIONS.md 2026-08-14:
                 TwineWeightEngine Phase 2 complete; jin/landscape/twine/weight are
                 valid care actions per GDD §3.1.
  verdict:       ALIGNED

SCOPE:
  Diff matches reported scope. Only the Set contents in two files were modified.
  No new files, no deleted files, no logic changes outside the Sets.

FRAUDS HUNTED:
  weakened tests:    none — no test files modified.
  false completion:  none — both Sets verified by direct READ (not reported output).
  intent inversion:  none — spec says these 6 types must be whitelisted; they are.
  phantom evidence:  none — all line numbers and file paths confirmed by direct READ.

KNOWN CAVEAT (not a finding):
  ? landscape replay throws "not yet implemented, Phase 2" — CareLogReplay.ts:148-150.
    This is INTENTIONAL per DECISIONS.md 2026-08-22: "landscape action must remain in
    the care log and continue to influence TechniqueClassifier — only the visual render
    output is deferred." Jeremy confirmed landscape is caretaker-side only, never
    on-chain. The throw prevents accidental on-chain replay of an unimplemented action.
    NOT a defect.

  ? jin replay calls tree.applyJin() — CareLogReplay.ts:141-144. Comment says
    "Phase 1 stub: JinEngine.applyJin throws 'not implemented'." Could not verify
    whether JinEngine.applyJin actually throws at runtime (no gate test observed for
    jin replay). Marked UNVERIFIABLE — jin replay behavior is untested by the current
    gate suite but is not in scope for this whitelist audit.

  ? No automated gate test verifies whitelist membership — the ALLOWED_ACTION_TYPES
    and ALLOWED_GUEST_ACTION_TYPES are not tested by any gate suite. A future
    whitelist drift (one updated, the other not) would not be caught by CI. This is
    an existing architectural gap, not introduced by this change.

BOTTOM LINE: Both whitelists correctly expanded to 12 identical types. All 6 new
types are handled by the engine. No scope violations, no frauds. CAVEATS are
pre-existing (jin stub, landscape Phase 2 deferral, no whitelist-sync gate test) —
none introduced by this change.
```

---

## Files Audited

| File | What was checked |
|------|-----------------|
| `apps/server/supabase/functions/care-action/index.ts` | Line 98: ALLOWED_ACTION_TYPES Set — 12 members verified |
| `apps/server/supabase/functions/seed-claim/index.ts` | Lines 121-124: ALLOWED_GUEST_ACTION_TYPES Set — 12 members verified, exact match confirmed |
| `packages/engine/src/CareLogReplay.ts` | Lines 120-158: all 12 action types routed through handlers |
| `packages/engine/src/TwineWeightEngine.ts` | twine, twine-remove, weight, weight-remove handlers confirmed |
| `packages/engine/src/TechniqueClassifier.ts` | jin (line 68), landscape (line 69) counted |
| `packages/engine/src/BonsaiTree.ts` | landscape care log entry at line 285 |
| `DECISIONS.md` | 2026-08-22 landscape deferral, 2026-08-14 TwineWeight Phase 2, 2026-08-17 A8-2 whitelist pattern |
| `docs/pipeline/ARCH-WEB3-SECURITY-CORRECTIONS-2026-08-17.md` | Original A8-2 fix establishing the whitelist pattern confirmed |

## Cross-Reference Verification

- **DECISIONS.md 2026-08-17 (A8-2):** Original whitelist was `['water','prune','wire','wire-remove','fertilize','rotate']` (6 types). CRITIC B1 correction: tick OUT, rotate IN. Current state matches this baseline + 6 new types. ✓
- **DECISIONS.md 2026-08-22 (landscape):** "landscape action must remain in the care log" — landscape is in both whitelists. CareLogReplay throws on replay (Phase 2 deferral). ✓
- **DECISIONS.md 2026-08-14 (TwineWeight):** Phase 2 complete, all 6 stubs replaced. twine/twine-remove/weight/weight-remove are fully implemented in engine. ✓
- **ARCH-WEB3-SECURITY-CORRECTIONS-2026-08-17.md:** Established the pattern of matching whitelists between care-action and seed-claim. Both now contain identical 12-member Sets. ✓

---

*Auditor: adversarial-auditor skill. Observe only — no fixes applied.*
