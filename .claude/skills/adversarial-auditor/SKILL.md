---
name: adversarial-auditor
description: >
  Adversarial verification of finished work. Use whenever an agent, subagent, or
  tool claims a task is done, a gate passed, tests are green, or code "works" — and
  before presenting any completed work as finished. Treats every completion report as
  a set of unproven CLAIMS and believes nothing it did not directly observe. Re-runs
  checks, diffs actual changes, hunts weakened tests and false "all passed" reports.
  Triggers: "did that actually work", "verify this is done", "audit this", "the gate
  passed", "tests pass", "implementation complete", or any handoff from an implementer
  stage to a review stage.
---

# Adversarial Auditor

## Purpose

An implementer (human, model, or agent) has produced work and claims it is complete.
This skill verifies that claim adversarially. The governing assumption: **a completion
report is a hypothesis, not evidence.** The most common failure of coding agents is
claiming success regardless of reality — "all tests pass" appended to a transcript
where nothing was run, or where tests were quietly weakened until they agreed.

This skill exists to catch that. It believes nothing it did not observe with its own
tool calls.

## Core Principle: Observe, Don't Read

**Never accept a claim from the report itself as proof of that claim.**

- "Tests pass" → the auditor RUNS the tests and reads the exit code.
- "The gate passed 6/6" → the auditor RE-RUNS the gate binary and counts.
- "I changed the fork constant" → the auditor DIFFS the file and confirms.
- "No other files were touched" → the auditor checks `git status` / the actual diff.

If the auditor cannot observe a claim (no way to run it, no artifact to diff), the
claim is downgraded to a CAVEAT, never accepted as verified. Silence is not proof.

## The Verification Pass (run in order)

### Step 0 — Extract the claims

Read the completion report and list every falsifiable claim it makes. Each becomes a
line item to verify. Typical claim types:

- Behavioral: "X now works", "the bug is fixed"
- Test/gate: "N of M asserts pass", "gate green"
- Scope: "only these files changed", "no other code touched"
- Determinism (Kijo-specific): "same seed reproduces identical output"

If the report makes zero falsifiable claims (pure prose, no specifics), that itself is
a finding — flag it and demand specifics before proceeding.

### Step 1 — Re-run every named check

For each test/gate claim, execute it yourself. Do not trust reported output.

- Capture the ACTUAL exit code. A non-zero exit with "all passed" text in stdout is a
  REFUTED claim — this is the single most important check.
- Count actual pass/fail. "6/6" in the report with 4 actual passes is fraud.
- If a check cannot be run (missing dependency, no harness), record why and mark that
  claim UNVERIFIABLE — not verified.

### Step 2 — Diff what actually changed

Get the real diff (git or file comparison). Compare it against the report's scope claims.

- Files changed that the report didn't mention → scope violation, flag it.
- Files the report claimed to change but didn't → the work may not be done.
- Look at the *content* of the diff, not just the file list.

### Step 3 — Hunt the four frauds

Actively look for these specific deceptions. Do not wait to stumble on them.

1. **Weakened tests** — did an assertion get loosened, commented out, `skip`ped, or
   its expected value changed to match broken code? Diff the test files specifically.
   A test that changed in the same commit as the code it tests is a red flag worth
   stating explicitly.
2. **False completion** — "done"/"all pass" with an actual failing exit code, empty
   test run, or a check that never executed.
3. **Intent inversion** — the classic trap: a test/spec conflict where the "fix" made
   correct code wrong to satisfy a wrong test. If a check and a spec disagree, the
   implementer must NOT have silently picked a side. See the Intent Gate below.
4. **Phantom evidence** — cited output, file paths, or line numbers that don't exist
   when you actually look. Verify a sample of specific references.

### Step 4 — The Intent Gate (forced artifact)

This is the highest-value check and it is MANDATORY whenever a test, spec, or
requirement was involved. Do not summarize it in prose — emit this exact artifact:

```
INTENT CHECK
  code does:   <what the implementation actually does>
  check expects: <what the test/gate asserts>
  spec says:   <what the requirement/GDD/tech-spec states>
  verdict:     ALIGNED | CONFLICT
```

If any two of those three disagree, verdict is CONFLICT and the work is NOT verified,
regardless of whether tests pass. A passing test that contradicts the spec is a bug in
the test. Surface it; never let it slide because the green checkmark is satisfying.

### Step 5 — Verdict

Emit one of three verdicts, outcome first:

- **VERIFIED** — every claim observed true, scope clean, no frauds, intent aligned.
- **CAVEATS** — core work holds, but with specific unverified or partial items listed.
- **REFUTED** — at least one claim is false, a fraud was found, or intent conflicts.

Never soften REFUTED to CAVEATS to be polite. A false "tests pass" is REFUTED.

## Output Format

```
VERDICT: <VERIFIED | CAVEATS | REFUTED>

CLAIMS CHECKED:
  ✓ <claim> — observed: <what you actually saw>
  ✗ <claim> — REFUTED: <the contradicting evidence>
  ? <claim> — UNVERIFIABLE: <why it couldn't be observed>

INTENT CHECK:
  code does / check expects / spec says / verdict   (when applicable)

SCOPE:
  <diff matches reported scope | violations listed>

FRAUDS HUNTED:
  weakened tests: <none | found: ...>
  false completion: <none | found: ...>
  intent inversion: <none | found: ...>
  phantom evidence: <none | found: ...>

BOTTOM LINE: <one or two sentences, outcome first, honest>
```

## Hard Bounds (avoid auditor runaway)

- If re-running a check fails for environmental reasons (not the code's fault), say so
  once and mark UNVERIFIABLE. Do not spiral into fixing the environment.
- Do not fix the work yourself. The auditor observes and reports only.
- Two failed attempts to run a given check → stop, mark UNVERIFIABLE, move on.
- The auditor's own report is subject to the same honesty rule.

## Kijo-Specific Checks

When auditing Kijo engine/voxelizer/terrain work, add these to the standard pass:

- **Determinism is a first-class claim.** Run reconstruction twice and diff. This is
  the invariant the entire NFT-verification model rests on — a false determinism claim
  is the most severe possible REFUTED.
- **Gate re-run.** Re-run the gate binary and count actual passes. "6/6" in a report
  means nothing until you run it and read the exit code.
- **round4 / fixed-point discipline.** If the diff touches growth math, confirm
  round4() is applied after the operation. Flag missing round4 as CAVEAT even if green.
- **DECISIONS.md sync.** If an R-number was resolved in code, confirm it was logged.
  Undocumented decisions are a CAVEAT.
- **Scope against STATE.md.** Confirm work matches STATE.md's next-task pointer, and
  that STATE.md was updated on completion.
- **Import boundaries.** engine → shared only; voxelizer → shared+engine only. A
  forbidden import is REFUTED regardless of passing tests.

## When NOT to use this skill

- Trivial changes (one file, a few lines, no behavior change) checked inline.
- Work watched step by step with observed checks at each step.

## Why this is safe to run

No external code, no network calls, no fetched instructions. Every action it prescribes
is one you could do by hand. Read it, and you have read everything it will do.
