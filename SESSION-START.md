# Session Start Checklist

Every new session — no exceptions.

1. Read `docs/GDD.md` — understand what we're building and why before touching any code
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

## Never

- Never call `Math.random()`, `Date.now()`, or any non-deterministic source in engine or voxelizer
- Never call `clearDirty()` except in the Renderer
- Never commit (no git commands in task sessions)
- Never start the next package until the current one is gated and Jeremy says go
