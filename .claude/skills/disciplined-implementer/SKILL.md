---
name: disciplined-implementer
description: >
  Production-side discipline for doing substantive work correctly the first time. Use
  before and during any non-trivial implementation task: writing or changing code,
  resolving a spec/test conflict, building a feature, fixing a bug. Forces the
  implementer to classify the ask, define "done" as a named check, verify by observation
  before claiming completion, and report outcome-first with honest caveats. Pairs with
  adversarial-auditor (the review-side counterpart). Triggers: any task that will change
  files, run more than a few lines of code, or produce a deliverable someone will rely on.
---

# Disciplined Implementer

## Purpose

This is the production half of a two-sided discipline. The auditor verifies finished
work adversarially; this skill makes the work verifiable and honest *before* it reaches
the auditor. The goal is simple: do the smallest correct thing, prove it by observation,
and never claim more than you observed.

The failure this prevents: producing plausible-looking work, appending "done" or "tests
pass," and handing off something that was never actually run. If you follow this skill,
your completion report survives an adversarial audit because every claim in it was
observed before you wrote it.

## The Loop

```
ask ─► 0 classify ─► 1 define done ─► 2 evidence ─► 3 decide ─► 4 act ─► 5 verify ─► 6 report
       shape?          named check     read before    ONE       smallest  observe    outcome
       trivial?        for this ask    changing       choice    diff      the check  first,
                                                                          not the    honest
                                                                          report     caveats
```

### Step 0 — Classify the ask

Before touching anything, name the shape:

- **Trivial** — one file, under ~10 lines, no new behavior, no searching. Do it, run the
  one obvious check, report in two sentences. Skip the rest of this loop.
- **Question / assessment** — they want a diagnosis, not a change. Change nothing. Return
  findings plus one recommendation.
- **Plan-first** — ambiguous scope, irreversible actions, or a plan was explicitly asked
  for. Produce the plan artifact and STOP for approval before executing.
- **Task** — a concrete change with definable done. Run the full loop below.

Misclassifying is the most expensive early error. A "task" that's really "plan-first"
wastes work on the wrong target. When unsure, treat it as plan-first and ask one pointed
question.

### Step 1 — Define "done" as a named check

Before writing anything, state the specific observable that will prove the work done:

```
DONE WHEN: <the exact check — a command, a test, an exit code, a diff property>
```

If you cannot name a verification, you do not yet understand the task. Ask one pointed
question rather than proceeding on a guess. "Done when it works" is not a definition —
"done when `test_growth` prints G1-G6 all ✓ and both determinism runs match" is.

### Step 2 — Gather evidence before changing anything

Read the relevant source, spec, and existing tests FIRST. For Kijo: read STATE.md,
DECISIONS.md, the relevant package README, and the tech-spec section the task points to.

Do not write code from memory of how the system works. Open the actual files. The most
common cause of broken work is acting on a stale mental model.

Two fruitless lookups → stop searching and proceed with what you have, noting the gap.

### Step 3 — The Intent Gate (mandatory when a spec or test is involved)

If the task involves a test, spec, or requirement — and *especially* if a test is failing
and you've been asked to make it pass — emit this artifact before deciding what to change:

```
INTENT CHECK
  code does:     <what the current implementation actually does>
  check expects: <what the test/gate asserts>
  spec says:     <what the requirement/GDD/tech-spec states>
  verdict:       ALIGNED | CONFLICT
```

If any two disagree, verdict is CONFLICT. **Do not silently pick a side.** A failing test
that contradicts the spec is a bug in the test, not a license to break correct code. Surface
the conflict, state which you believe is authoritative and why, and fix that one. Making
correct code wrong to satisfy a wrong test is the single most damaging thing an implementer
can do, because it passes CI and corrupts the spec's intent.

This artifact must physically appear. Do not replace it with prose intent. The point is
that it cannot be skipped at the moment of decision.

### Step 4 — Act: smallest correct change

Make the minimal diff that satisfies "done." Specifically:

- Change the smallest number of lines that correctly solves the problem.
- Do not refactor adjacent code, rename things, or "improve" what you were not asked to
  touch. Scope creep is how one task becomes three bugs.
- Do not add dependencies, modules, or abstractions unless the task requires them.
- Read a file before editing it. Never write a change from memory of the file's contents.
- One recommendation, one path. If you found two viable approaches, pick the one you'd
  defend and note the other in the report — don't implement both.

### Step 5 — Verify by observation (before claiming anything)

Run the named check from Step 1. Read the ACTUAL result.

- Capture the real exit code. Do not infer success from the absence of a visible error.
- If the check has multiple asserts, confirm each — don't extrapolate from the first.
- Diff what you actually changed. Confirm it matches your intended scope. Files you didn't
  mean to touch → investigate before reporting.
- For Kijo determinism claims: actually run the thing twice and diff the output. Never
  report "deterministic" from the existence of a determinism test — from its observed pass.

Hard bound: if the check fails after **three** verify-fix cycles, STOP. Do not keep
grinding. Hand back with what you observed, what you tried, and where it stands. Three
failed cycles means the approach or the understanding is wrong, and more attempts compound
the error.

### Step 6 — Report, outcome first, honest caveats

Structure the completion report so the outcome is the first thing read:

```
OUTCOME: <done | done with caveats | blocked>

DONE WHEN (from step 1): <the named check> — <observed result>

WHAT CHANGED:
  <files touched and why — matches the actual diff>

VERIFIED BY OBSERVATION:
  <the check you ran and the actual output/exit code you saw>

INTENT CHECK: <the artifact from step 3, if applicable>

CAVEATS:
  <anything you could NOT verify, assumptions made, deferred items — named specifically>
```

Every claim in this report must be something you observed in Step 5. If you did not run
it, it does not go in "verified" — it goes in caveats. A report that survives the
adversarial auditor is one where every line is already backed by an observation you made.

## Honesty Rules (non-negotiable)

- Never write "tests pass" without having run them and seen the exit code.
- Never write "done" for work you could not verify. Write "done with caveats" and most name them.
- Never weaken a test to make it green. If a test is wrong, fix the test and say so in the
  report with the reason. If a test is right and the code fails, the code isn't done.
- Never claim scope you didn't hold. If you touched a file you didn't plan to, report it.
- If you're guessing, say you're guessing. A named uncertainty is worth more than a
  confident fabrication.

## Kijo-Specific Discipline

- **round4 after every growth operation.** If you touch growth math, the rounding rule is
  part of "done," not an afterthought. A missing round4 is a determinism landmine.
- **Determinism is verified by running twice.** Any change to engine, voxelizer, or terrain
  must be checked by reconstructing/recomputing twice and diffing. This is in "done."
- **Log decisions to DECISIONS.md.** If you resolved a research question (R-number) or made
  a non-obvious call, it goes in DECISIONS.md in the same task. Undocumented decisions rot.
- **Update STATE.md on completion.** The next session boots from STATE.md. Leave it accurate.
- **Respect import boundaries.** engine imports only shared; voxelizer only shared+engine.
  Never pull rendering, I/O, or network into the deterministic core. If a task seems to
  require it, that's a design conflict — surface it, don't smuggle the import.
- **One package per task.** Don't drift into an adjacent package because it seemed related.
  Finish the scoped package, pass its gate, hand off.

## Why this pairs with the auditor

This skill and adversarial-auditor are two halves of one handoff. The implementer produces
work whose every claim was observed; the auditor independently re-observes those claims.
When both run, a false "done" has to survive being written honestly AND being re-checked
adversarially — which it can't. The forced Intent Gate appears on both sides on purpose:
the implementer emits it to avoid silently picking a side; the auditor emits it to catch
the case where the implementer did anyway.

## Why this is safe

No external code, no network calls, no fetched instructions. This skill directs the
implementing model to use its own tools and its own judgment, in a fixed order, with
forced artifacts at the decision points weak models tend to skip. Read it and you have
read everything it will do.
