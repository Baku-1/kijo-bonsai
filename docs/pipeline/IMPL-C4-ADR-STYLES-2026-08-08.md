# IMPL: C-4 — ADR Style Spline Alignment Table Fix

**Stage:** IMPLEMENTER (pipeline stage 3 of 5)
**Date:** 2026-08-08
**Closes:** Critical #4 from `docs/pipeline/AUDIT-VIEWS-2026-07-28.md`
**ADR:** `docs/ADR-STATSHEET-DEFENSE-STABILITY.md`

---

## OUTCOME

DONE WITH CAVEATS — The §Style Spline Alignment table in the ADR is correct: 7 rows, no Sekijoju
row, Kengai mapped to "skill_point". These fixes were already applied by a prior session.
No code changes were made. The ARCHITECT doc has no Style Spline Alignment table (verified by
full read). The done-when "grep Sekijoju = zero hits" is NOT fully met because Sekijoju appears in
4 other places in the ADR and 2 places in the ARCHITECT doc — all in sections the task constraint
explicitly prohibits modifying. See CAVEATS.

---

## DONE WHEN — named check and observed result

**Named check:** Read `docs/ADR-STATSHEET-DEFENSE-STABILITY.md` §Style Spline Alignment table.
Count rows. Exactly 7. No Sekijoju. Kengai shows "skill_point".
Grep for "Sekijoju" in both docs — zero hits.

**Observed result:**

| Sub-check | Result |
|---|---|
| Table row count | 7 rows CONFIRMED |
| Sekijoju row absent from table | CONFIRMED |
| Kengai → "skill_point" | CONFIRMED |
| Grep "Sekijoju" in ADR — zero hits | NOT MET — 4 hits (see CAVEATS) |
| Grep "Sekijoju" in ARCHITECT — zero hits | NOT MET — 2 hits (see CAVEATS) |
| ARCHITECT doc has no Style Spline Alignment table | CONFIRMED — no changes needed |

The table-specific sub-checks all pass. The zero-hit sub-check fails due to Sekijoju references
in sections outside the §Style Spline Alignment section, which the task constraint prohibits
modifying.

---

## WHAT CHANGED

**No changes were made.** Both fixes (remove Sekijoju row, correct Kengai mapping) had already
been applied to `docs/ADR-STATSHEET-DEFENSE-STABILITY.md` by a prior pipeline session. The
§Style Spline Alignment table was found in its correct state. The ARCHITECT doc has no Style
Spline Alignment table; no changes were needed there.

---

## VERIFIED BY OBSERVATION

**ADR §Style Spline Alignment table — current state (observed by direct read and awk extraction):**

```
| Style       | Primary stat clusters                                      | Source           |
|-------------|-------------------------------------------------------------|------------------|
| Chokkan     | balanced (all stats)                                        | CANONICAL-STYLES.md |
| Moyogi      | ki                                                          | CANONICAL-STYLES.md |
| Shakan      | power, stability                                            | CANONICAL-STYLES.md |
| Kengai      | skill_point   (cascade -> digit voxels -> ability slots)    | CANONICAL-STYLES.md |
| Fukinagashi | defense, stability                                          | CANONICAL-STYLES.md |
| Bunjin      | ki, skill_point                                             | CANONICAL-STYLES.md |
| Hokidachi   | hp, defense                                                 | CANONICAL-STYLES.md |
```

Row count: 7. No Sekijoju row. Kengai = "skill_point". Table matches the fix specification.

**ADR NOTE at end of §Style Spline Alignment (line 131 — also observed):**

```
**NOTE: Sekijoju removed.** Sekijoju ("Root Over Rock") is NEVER part of the design. GDD §4.2.1
was wrong to include it. See CANONICAL-STYLES.md (confirmed authoritative 2026-07-28). Any
implementer following a prior draft of this table that listed 8 styles must use only 7.
`seed % 7`, not `seed % 8`.
```

This NOTE is in the §Style Spline Alignment section and is retained as implementer guidance.

**ARCHITECT doc — full read confirms no Style Spline Alignment table is present.**
The doc specifies implementation changes to StatSheet, StatType, StatTerrain, and StatDeriver.
Its §DO NOT CHANGE list references `STYLE_SPLINES` but the doc itself has no Style Spline
Alignment table that could reproduce the C-4 error.

**Grep results (observed):**

ADR:    `grep -n "Sekijoju" docs/ADR-STATSHEET-DEFENSE-STABILITY.md` → 4 hits (lines 49, 51, 91, 131)
ARCH:   `grep -n "Sekijoju" docs/ARCHITECT-STATSHEET-DEFENSE-STABILITY.md` → 2 hits (lines 43, 437)

---

## INTENT CHECK

```
INTENT CHECK
  code does:     ADR §Style Spline Alignment table: 7 rows, no Sekijoju row, Kengai = "skill_point"
                 (prior session applied the fixes). Sekijoju appears in 4 other ADR sections and 2
                 ARCHITECT sections — all outside §Style Spline Alignment.
  check expects: exactly 7 rows, Kengai = "skill_point", grep "Sekijoju" = zero hits in both docs
  spec says:     "Do NOT change any other section of the ADR beyond the Style Spline Alignment table"
  verdict:       CONFLICT — zero-hit done-when cannot be achieved without violating the constraint.
                 Resolution: table fixes are the authoritative deliverable. Remaining references are
                 in out-of-scope sections. Report DONE WITH CAVEATS.
```

---

## CAVEATS

**1. Sekijoju — 4 remaining hits in ADR (out of scope)**

The constraint prohibits changing sections other than §Style Spline Alignment. Sekijoju appears
at the following locations that cannot be touched:

- ADR line 49: `| Sekijoju | — | extreme |` — in §Why They Cannot Be Derived from Endurance.
  This is a MOTIVATION table explaining why defense/stability are independent stats. It reflects
  GDD §4.2.1 as historical record. Removing this row would harm the reasoning chain.
- ADR line 51: "Sekijoju/Shakan" — inline text in the same motivation section.
- ADR line 91: "root over rock (Sekijoju) → ROOT→Stability" — in §Impact on StatDeriver,
  explicitly calling out the REJECTED reasoning. This mention is architecturally important:
  it prevents a future implementer from reintroducing ROOT→Stability.
- ADR line 131: the NOTE in §Style Spline Alignment that says "NOTE: Sekijoju removed."
  This is IN the constrained section and could be reworded — but doing so would remove
  implementer guidance without benefit. Retained as-is.

**2. Sekijoju — 2 remaining hits in ARCHITECT (out of scope)**

- ARCHITECT line 43: historical reasoning for why ROOT→Stability was rejected. Architecturally
  necessary context; removing it would obscure the design decision.
- ARCHITECT line 437: DO NOT CHANGE list entry referencing `// TODO: 7 — Sekijoju (root over rock)`
  comment in StatTerrain.ts. The ARCHITECT doc instructs the Implementer to remove this TODO
  comment from the source file as part of the defense/stability PR. Not a doc error.

**3. Three style terrain mappings diverge from CANONICAL primary stats**

Verified all 7 style rows against CANONICAL-STYLES.md. The following have secondary terrain
clusters not explicitly listed in CANONICAL:

- **Shakan**: ADR lists "power, stability". CANONICAL primary stat is "Power" only.
  The "Why They Cannot Be Derived" table in the ADR shows Shakan → moderate stability,
  suggesting the architect intentionally adds stability terrain bonuses to reinforce this.
  Not a conflict — CANONICAL lists the dominant stat; the ADR maps ALL terrain clusters.

- **Bunjin**: ADR lists "ki, skill_point". CANONICAL primary stat is "skillPoints" only.
  Ki addition is an architect choice to blend energy-focus with Bunjin's glass-cannon identity.
  Not an explicit contradiction of CANONICAL, but CANONICAL does not list ki for Bunjin.
  Flag for Jeremy's review if the terrain cluster should be "skill_point" only.

- **Hokidachi**: ADR lists "hp, defense". CANONICAL primary stat is "HP + Endurance".
  The ADR substitutes defense for endurance. The "Why They Cannot Be Derived" table shows
  Hokidachi with high Defense. This is an architect decision to use the new defense stat as
  Hokidachi's terrain reinforcement rather than endurance. However, CANONICAL explicitly
  lists Endurance as a primary stat. Flag for Jeremy's review — this may be intentional
  (terrain clusters reinforce defense specifically) or it may be that "endurance" should
  also appear in the cluster.

None of these three rises to the level of the Kengai error (which was directly contradictory
— "power, ki" vs. the canonical "skillSlots" direction). They are extensions or substitutions
that may reflect architect intent. No changes made; flagged here for awareness.

**4. Prior work applied the primary fixes**

This task was dispatched expecting the ADR to contain an 8-row table with Sekijoju and
Kengai → "power, ki". Both defects had been corrected before this implementer pass ran.
The implementer verified the current state and confirmed the fixes are in place. No code
was changed; no documentation beyond this pipeline report was written.

---

## Sources Read (in order per session protocol)

1. `SESSION-START.md` — File I/O Rules confirmed (heredoc for files > 10 lines)
2. `docs/CANONICAL-STYLES.md` — 7-style authoritative list; Sekijoju explicitly banned
3. `docs/pipeline/AUDIT-VIEWS-2026-07-28.md` — C-4 critical at lines 44-50
4. `docs/ADR-STATSHEET-DEFENSE-STABILITY.md` — full read; found table already correct
5. `docs/ARCHITECT-STATSHEET-DEFENSE-STABILITY.md` — full read; no Style Spline Alignment table
