# AUDIT-CARE-ACTION-WIRE-REMOVE-2026-08-14

**Pipeline stage:** Auditor (Adversarial Auditor skill)
**Date:** 2026-08-14
**Auditor:** Adversarial pass — wire-remove whitelist fix in care-action Edge Function
**Subject:** Adding `'wire-remove'` to `ALLOWED_ACTION_TYPES` in `care-action/index.ts`, deployed as version 7

---

## VERDICT: VERIFIED (with documented caveats — GAP-4, not a regression)

---

## CLAIMS CHECKED

Every falsifiable claim extracted from the implementer's report and verified by direct observation.

  CHECK 1: 'wire-remove' IS in ALLOWED_ACTION_TYPES
    ✓ VERIFIED (local file, line 98):
      const ALLOWED_ACTION_TYPES = new Set(['water', 'prune', 'wire', 'wire-remove', 'fertilize', 'rotate']);
    ✓ VERIFIED (deployed source, Supabase MCP get_edge_function, version 7):
      const ALLOWED_ACTION_TYPES = new Set(['water', 'prune', 'wire', 'wire-remove', 'fertilize', 'rotate']);
    Both local file and deployed artifact agree.

  CHECK 2: 'wire' is still present — no accidental removal
    ✓ VERIFIED — 'wire' appears at the third position in the Set in both local and deployed source.
      No accidental removal of any pre-existing member.

  CHECK 3: Deployed as version 7
    ✓ VERIFIED — Supabase MCP returns: { slug: "care-action", version: 7, status: "ACTIVE" }
      Updated timestamp: 1786696660149 (today).

  CHECK 4: Scope — exactly one line changed
    ✓ VERIFIED by git diff (HEAD vs. working tree):
      -  const ALLOWED_ACTION_TYPES = new Set(['water', 'prune', 'wire', 'fertilize', 'rotate']);
      +  const ALLOWED_ACTION_TYPES = new Set(['water', 'prune', 'wire', 'wire-remove', 'fertilize', 'rotate']);
      One line. No other lines in this file were touched.

  CHECK 5: Downstream handler — does wire-remove reach insert_care_log_entry?
    ✓ VERIFIED — The function has NO switch/if-else routing on action type after the whitelist check.
      The path for every allowed action type is identical (sections 2-6):
        2. Lazy tick (action-type-agnostic)
        3. insert_care_log_entry for tick rows (if days elapsed)
        4. Consumable check: CONSUMABLE['wire-remove'] === undefined → skipped
        5. insert_care_log_entry for the action itself — wire-remove reaches this
        6. Consumable decrement: consumableRow === null → skipped
      wire-remove lands in insert_care_log_entry correctly with no dead code or fall-through gaps.

  CHECK 6: wire-remove absent from CONSUMABLE map
    ✓ VERIFIED — CONSUMABLE map (lines 16-21, both local and deployed):
        { prune: 'shears', wire: 'wire', fertilize: 'fertilizer' }
      wire-remove has no entry. CONSUMABLE['wire-remove'] returns undefined.
      This causes consumableType === undefined, consumableRow stays null, and no
      consumable is deducted. Correct: wire removal is a free action per GDD §3.2.

  CHECK 7: verify_jwt: true is set for care-action
    ✓ VERIFIED — Supabase MCP list_edge_functions confirms:
        { slug: "care-action", verify_jwt: true, version: 7, status: "ACTIVE" }
      JWT is verified at the Supabase gateway level (before the function runs) AND
      again at the application level via anonClient.auth.getUser(token) (lines 40-53).
      Double-checked: the wire-remove fix did not touch lines 40-53.

    NOTE (pre-existing documentation error, not a regression):
      apps/web/src/persistence.ts line 21 contains an inaccurate comment:
        "care-action — requires JWT (verify_jwt: false at the Supabase level, but
         the function itself checks Authorization header explicitly)"
      The comment says verify_jwt: false, but the live Supabase config confirms verify_jwt: true.
      This means care-action is MORE secure than the comment describes, not less.
      This is a pre-existing documentation error predating the wire-remove fix.
      Flagged as CAVEAT — update the comment in a follow-up.

  CHECK 8: wallet-auth's verify_jwt: false was NOT touched
    ✓ VERIFIED — Supabase MCP confirms:
        { slug: "wallet-auth", verify_jwt: false, version: 3 }
      Version 3 (updated 1786218530531 — prior to this fix). Not version 7.
      git diff HEAD -- apps/server/supabase/functions/wallet-auth/ → empty (no changes).
      wallet-auth verify_jwt setting is unchanged.

  CHECK 9: GAP-4 — applyCurrentDayEntries skips wire-remove
    ✓ CONFIRMED (gap exists, as documented in ARCH-WIRE-UI-2026-08-14.md §GAP-4)
      persistence.ts lines 289-309: wire and wire-remove both fall to the else branch:
        } else {
          // wire, wire-remove, twine, twine-remove, weight, weight-remove, jin, landscape
          console.warn(`[kijo] applyCurrentDayEntries: skipping action '...' ...`);
        }
      If a wire-remove action is applied within the current game day, reloading the page
      will restore from cache but NOT re-apply the removal. The branch will appear wired
      (pre-removal state) after reload until the server's care log is replayed.
      This is a pre-existing limitation documented by the Architect, not introduced by
      the whitelist fix. Resolution requires expanding applyCurrentDayEntries to call
      tree.removeWire() — separate task.

---

## INTENT CHECK

  code does:     Adds 'wire-remove' to ALLOWED_ACTION_TYPES Set at care-action/index.ts:98.
                 wire-remove now passes the whitelist check and flows to insert_care_log_entry
                 with no consumable deduction (CONSUMABLE['wire-remove'] === undefined).

  check expects: wire-remove persistAsync calls succeed with HTTP 200 instead of 400
                 ("Invalid action type"). The server records the removal in care_log_entries.

  spec says:     ARCH-WIRE-UI-2026-08-14.md, OQ-WIRE-1 (BLOCKER):
                 "Required change: new Set(['water', 'prune', 'wire', 'wire-remove', 'fertilize', 'rotate'])"
                 "'wire-remove' carries no consumable cost (CONSUMABLE map does not need
                 updating — it already has no entry for wire-remove)."
                 GDD §3.2: wire removal is a free action.

  verdict:       ALIGNED — change matches spec exactly. No inversion, no deviation.

---

## SCOPE

  git diff confirms: exactly one line changed in care-action/index.ts.
  No other source files were touched by this fix.
  The broader working-tree diff (git status) shows other files modified — those belong to
  the parallel wire UI implementation (main3d.ts, index3d.html, persistence.ts) and are
  NOT part of this fix's scope. Scope of the wire-remove whitelist fix is clean.

---

## FRAUDS HUNTED

  weakened tests:    NONE — no test files exist for care-action; no test files were changed
                     in the diff. Not applicable.

  false completion:  NONE — deployment is live and confirmed via Supabase MCP.
                     Version 7, status ACTIVE, deployed source matches local file.

  intent inversion:  NONE — the change adds a permissive entry, which is the stated goal.
                     No guard removed, no existing behavior changed, no spec contradiction.

  phantom evidence:  NONE — all cited facts verified by direct observation:
                     - Line 98 exists and contains the new Set literal
                     - Deployed source (Supabase MCP) matches local file byte-for-byte on the Set
                     - git diff is exactly one line
                     - Version 7 is live and ACTIVE
                     - GAP-4 line reference (persistence.ts ~303) verified by reading the file

---

## CAVEATS (follow-up required; not regressions)

  C-1: GAP-4 (pre-existing, flagged by Architect)
    applyCurrentDayEntries skips wire-remove (falls to else/console.warn).
    Effect: within-current-day wire-remove is not re-applied after page reload.
    Fix: add wire-remove branch to applyCurrentDayEntries calling tree.removeWire(branchId).
    Scope: separate task; not part of this fix.

  C-2: persistence.ts comment inaccuracy (pre-existing)
    Line 21 says care-action has "verify_jwt: false at the Supabase level."
    Actual: verify_jwt: true (confirmed by Supabase MCP).
    The function is MORE secure than the comment claims.
    Fix: update the comment to reflect the actual gateway config.
    Scope: one-line doc fix; not blocking.

  C-3: config.toml does not enumerate care-action or wallet-auth
    apps/server/supabase/config.toml only declares [functions.derive-stats].
    care-action and wallet-auth verify_jwt settings are managed via the Supabase dashboard only,
    not tracked in version control. This means a `supabase functions deploy` from CLI
    without the correct config.toml could silently change verify_jwt behavior.
    Recommendation: add explicit entries to config.toml to lock verify_jwt in VCS.
    Scope: configuration hygiene task; not urgent while dashboard is source of truth.

---

## BOTTOM LINE

The wire-remove whitelist fix is correct, deployed, and confirmed live. Exactly one line changed,
the CONSUMABLE map is untouched, JWT security is intact (double-layered), and wallet-auth was not
touched. GAP-4 is a pre-existing limitation documented by the Architect — not a regression from
this fix — and requires a separate task to resolve.

*Adversarial Auditor — no frauds found, no regressions, three documentation/configuration caveats
for follow-up. Fix is ready for Linter stage.*
