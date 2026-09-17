# Session Start Checklist

Every new session — no exceptions.

1. Read `../docs/GDD.md` (i.e. `kijo/docs/GDD.md`, the parent folder) — understand what we're building and why before touching any code. Note: the authoritative docs are in `kijo/docs/`, NOT `kijo/kijo-bonsai/docs/`.
2. Read `STATE.md` — know what's built, what's not, and the current next task pointer
3. Read `DECISIONS.md` — every architectural decision is here; never contradict or re-litigate without explicit instruction
4. Read the README for the package you'll be working in (shared / engine / voxelizer / etc.)
5. Confirm the invariant: **seed + care_log → identical tree everywhere** — if anything you're about to do could break this, stop and ask
6. Wait for explicit task assignment — do not infer, do not start the "next logical thing", do not dispatch sub-sessions without being told to

## Pipeline

Every implementation task follows: **Architect → Critic → Implementer → Auditor → Linter**

All stages run in Cowork task sessions (`start_task`). Never do implementation work in main context.

If a session hits a limit: `send_message` to resume after reset. Do NOT absorb work into main context.

### Implementer stage — mandatory skill

Read `.claude/skills/disciplined-implementer/SKILL.md` before touching any file.

The 7-step loop: classify → define done as a named check → gather evidence → Intent Gate
→ smallest change → verify by observation → report outcome-first.

End every task with the required report format:
- OUTCOME (first line)
- DONE WHEN — named check and observed result
- WHAT CHANGED — actual files and why
- VERIFIED BY OBSERVATION — the command run and actual output seen
- INTENT CHECK — if any spec/test was involved
- CAVEATS — anything not directly observed

### Auditor stage — mandatory skill

Read `.claude/skills/adversarial-auditor/SKILL.md`. Run when Jeremy says to audit.

The auditor re-runs every gate binary, diffs scope, hunts the four frauds (weakened
tests, false completion, intent inversion, phantom evidence), and emits the forced
INTENT CHECK artifact. VERIFIED = done. CAVEATS = Jeremy's sign-off required. REFUTED
= back to Implementer.

Kijo-specific auditor checks (all mandatory):
- Run determinism twice, diff output — false determinism claim = REFUTED
- Re-run gate binary, count actual passes from stdout + exit code
- Confirm round4() discipline in any growth-math diff
- Confirm DECISIONS.md updated for any resolved R-number
- Confirm STATE.md updated and matches task pointer
- Confirm import boundaries: engine→shared only, voxelizer→shared+engine only

## Mainnet Blockers (do not deploy to mainnet until resolved)

- **A3-1 (CRITICAL):** wallet-auth uses raw `personal_sign` with no chain ID — testnet auth signatures are valid on mainnet. Replace with `signTypedData` + EIP-712 domain separator including `chainId` before mainnet deploy. See `docs/pipeline/AUDIT-WEB3-PURCHASE-SECURITY-2026-08-17.md`.
- **A5-1 / A8-1 (CRITICAL):** Seeds are client-chosen integers — players can precompute optimal seeds offline. Move seed generation to server-side `crypto.getRandomValues` in the Edge Function before mainnet deploy.

## Planned Skills (develop when Jeremy says go)

- **cited-logic-validator**: Goal-driven logic/test validation skill. Every claim about what code does must be grounded in cited spec or known-developer source, with +/-25 lines of surrounding context read before validating any logic. Works for tests AND implementation logic. No assertion without a citation. Scope: any engineering logic gate — not just test coverage.

## Open Tasks

- **#96 — Sculpt UI (twine/weight/jin/landscape):** COMPLETE (2026-08-30). Full pipeline: Architect→Critic→Corrective Patch→Implementer→Auditor VERIFIED→Linter CLEAN WITH FIXES. See LINT-SCULPT-UI-2026-08-29.md.
- **#97 — ThreeCanvas raycaster + branch picking:** Production view has no raycaster. Twine/weight mode buttons are stubs until this ships. Follow main3d.ts raycaster pattern. Unblocks sculpt actions in production view.

## Pipeline Stage Completions (2026-08-14/17)

- TwineWeightEngine Phase 2: COMPLETE. TWE1-TWE9 pass (37/37). Security tests 55/55. OQ-5 STACK semantics documented in DECISIONS.md.
- CareLogReplay wire-remove fix: COMPLETE. CLR-WIRE-1/2/3/4 pass (23 assertions). Auditor + Linter pending.
- Web3 purchase security audit: COMPLETE. CONDITIONALLY SECURE. 0 critical, 6 advisory. See above mainnet blockers.

## Never

- Never call `Math.random()`, `Date.now()`, or any non-deterministic source in engine or voxelizer
- Never call `clearDirty()` except in the Renderer
- Never commit (no git commands in task sessions)
- Never start the next package until the current one is gated and Jeremy says go
- Never deploy to mainnet without resolving A3-1 and A5-1/A8-1 above

## File I/O Rules (prevent truncation)

- **Read tool**: always read the FULL file — never pass a `limit` parameter. A partial Read followed by a rewrite produces a truncated file.
- **Edit/Write tool**: truncates on multi-byte Unicode characters (`→`, `×`, etc.) in matched content. Use bash heredoc for any file over ~10 lines or containing Unicode.
- **Heredoc pattern**: `cat > /path/to/file << 'EOF' ... EOF` — use single-quoted delimiter to prevent shell expansion. After every write, verify with `wc -l` and `tail -5`.
- **Unicode in source files**: keep comments ASCII-only in all engine/voxelizer/shared source. Use `->` not `→`, `x2` not `×`.
