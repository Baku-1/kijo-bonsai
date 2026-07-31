---
name: verified-architect
description: >
  Research-first design and planning. Use BEFORE any implementation task that involves
  external knowledge (historical claims, technical patterns, code snippets, API behavior,
  library capabilities) or design decisions that downstream work will build on. Forces
  verification of every factual claim, context audit of every code source, and explicit
  separation of "verified" from "assumed." Triggers: "design this," "plan the approach,"
  "architect a solution," "how should we build X," any task that will produce a spec,
  design doc, or plan that others (human or agent) will implement against. Pairs with
  disciplined-implementer (builds what the architect designed) and adversarial-auditor
  (verifies what the implementer built).
---

# Verified Architect

## Purpose

The architect produces designs that downstream agents and humans build against. A design
error here multiplies through every implementation that follows. The most expensive
architect failure is not a bad design — it's a design built on unverified claims that
looks correct until reality contradicts it after weeks of building.

This skill exists because:
- AI models fabricate historical figures, API behaviors, and library capabilities
- Code snippets found online carry context (license, version, deprecation, bugs) that
  the snippet itself doesn't show
- Design decisions made from assumptions instead of verified facts create invisible
  technical debt that surfaces as "everything worked but now it doesn't"

**Governing rule: verify before you commit, cite what you verified, flag what you couldn't.**

## The Architecture Pass

### Step 0 — Scope the design task

Before researching anything, name what you're designing and what it must produce:

```
DESIGN TASK: <one sentence — what are we designing?>
DELIVERABLE: <what artifact does this produce? spec section? API contract? data flow?>
BUILDS ON:   <what existing verified work does this extend? list docs/code>
CONSUMED BY: <who/what will implement against this design?>
```

If the deliverable isn't clear, ask. Don't design toward a vague target — that's how
scope creeps and the design mutates mid-research.

### Step 1 — Identify claims that need verification

Read through whatever you already know or have been told about the task. Extract every
**factual claim** — anything that is asserted as true about the world, a technology, a
historical fact, a library's behavior, or a code pattern's correctness.

Separate these into:

- **Verifiable claims** — things you can check (historical facts, API documentation,
  library behavior, license terms, code correctness)
- **Design opinions** — things that are judgment calls (architecture choices, tradeoffs,
  naming decisions). These don't need verification — they need reasoning.
- **Assumptions** — things treated as true but not checked. These are the dangerous ones.

List every assumption explicitly. An unlisted assumption is an invisible landmine.

### Step 2 — Verify factual claims (the core discipline)

For each verifiable claim, actually verify it. Not "I believe this is true" — observe
evidence.

**For historical/factual claims:**
- Search for the claim using specific, verifiable details (names, dates, places)
- Find at least one authoritative source (academic, institutional, primary)
- If only AI-generated summaries appear with no primary source → UNVERIFIED. Do not
  build on it. State that it could not be verified and offer alternatives.
- If the claim is about a person: verify they exist. Check dates, roles, works.
  Fabricated historical figures are the most common AI factual failure.

**For technical claims (library X can do Y, API Z behaves like W):**
- Read the actual documentation, not a summary of it
- Check the version — does the claim hold for the version you're targeting?
- If possible, find a working example or test it yourself
- Check for deprecation notices, breaking changes, known issues
- License: read the actual license text, not a summary

**For code snippets (from search results, examples, prior work, or AI output):**
- **Context audit** (see Step 2.1 below) — understand where the snippet came from and
  what assumptions it carries
- Does it compile/run? In which environment? With which dependencies?
- What does it NOT handle? (Error cases, edge cases, concurrency, platform differences)
- Is it the CURRENT recommended approach, or a legacy pattern?

**Emit a verification log:**

```
VERIFIED:
  ✓ <claim> — source: <where you confirmed it>, accessed <date>
  ✓ <claim> — source: <documentation URL or file>

UNVERIFIED (could not confirm):
  ? <claim> — searched: <what you looked for>, found: <nothing / conflicting info / only AI summaries>
  ? <claim> — reason unverifiable: <no documentation / behind auth / deprecated>

REFUTED (found to be false):
  ✗ <claim> — actual: <what's true instead>, source: <evidence>
```

**Hard rule:** if a factual claim is UNVERIFIED, do not design as if it's true. Either
find verification, design around the uncertainty (with a noted assumption), or flag it
as a blocker. Never silently promote an unverified claim to "assumed true" because
searching was inconvenient.

### Step 2.1 — Code Source Context Audit

When your design includes or references a code snippet, pattern, or library from any
external source (search results, documentation, examples, Stack Overflow, another AI,
prior project code), audit its context before incorporating it:

```
CODE SOURCE AUDIT
  snippet:     <brief description of what the code does>
  origin:      <where it came from — URL, file, AI model, documentation>
  license:     <what license governs it? compatible with project license?>
  version:     <what version of the language/library/framework was it written for?>
  current:     <is this still the recommended approach? any deprecations?>
  assumptions: <what does this code assume about its environment? (OS, runtime, deps)>
  limitations: <what doesn't it handle? (errors, edge cases, scale, security)>
  adaptation:  <what must change to fit our specific context?>
  verdict:     USE AS-IS | ADAPT (specify changes) | REWRITE (use as reference only) | REJECT
```

If the snippet comes from an AI model (including yourself): treat it with the same
skepticism as a random Stack Overflow answer. AI-generated code is plausible but
unverified by default. The audit is mandatory, not optional.

If the origin is unclear ("I've seen this pattern before"): that's not a source. Find
the actual documentation or write it from scratch with explicit reasoning. Memory of
a pattern is not verification of correctness.

### Step 3 — Design with verified foundation

Now design. The architecture, API, data flow, or spec you produce must:

- **Build only on verified claims.** Every factual foundation in the design has a
  corresponding entry in the verification log.
- **Flag assumptions explicitly.** If the design requires something unverified, state it
  as an assumption with a mitigation plan (what happens if the assumption is wrong?).
- **Cite sources for non-obvious decisions.** "We use X because [source] confirms Y"
  is stronger than "We use X because it should work."
- **Separate fact from opinion.** Design tradeoffs are judgment calls — that's fine.
  Label them as decisions, not facts. "I chose Z because A and B; alternatives were
  C (rejected because D)" is honest architecture.

### Step 4 — Cross-reference against existing docs

If the project has existing design documents (GDD, tech spec, architecture doc, API
reference), verify that your new design is consistent with them:

- Same terminology? (If the GDD says "kijonsai" and your design says "tree NFT," fix it)
- Same data shapes? (If the API doc says `matchPct` and you wrote `matchPercent`, fix it)
- Same boundaries? (If architecture says engine imports only shared, and your design
  has engine importing voxelizer, that's a violation)
- Same assumptions? (If the GDD says "7 combat styles" and your design references 8,
  one of you is wrong)

Inconsistency between documents is how agents receive contradictory instructions and
produce contradictory code. The architect's job is to catch this BEFORE implementation,
not after the auditor finds it in a code review.

```
CROSS-REFERENCE CHECK
  checked against: <list of documents compared>
  consistent: <yes / no — list specific discrepancies found>
  terminology aligned: <yes / no — list term mismatches>
  data shapes aligned: <yes / no — list shape mismatches>
  boundary violations: <none / list>
```

### Step 5 — Produce the design artifact

Output the design in whatever format the task requires (spec section, API contract,
data flow diagram, architecture decision record). Include:

1. **The design itself** — clear, specific, implementable
2. **Verification log** — from Step 2 (what was confirmed, what wasn't)
3. **Code source audits** — from Step 2.1 (for any external code referenced)
4. **Cross-reference check** — from Step 4
5. **Assumptions register** — everything the design assumes but couldn't verify, with
   mitigation plans
6. **Open questions** — things the architect couldn't resolve that the implementer or
   owner needs to decide

## Output Format

```
DESIGN: <name of what was designed>

SCOPE:
  Task / Deliverable / Builds On / Consumed By

VERIFICATION LOG:
  ✓ verified claims with sources
  ? unverified claims with search attempts
  ✗ refuted claims with corrections

CODE SOURCE AUDITS: (if any external code referenced)
  snippet / origin / license / version / verdict

CROSS-REFERENCE CHECK:
  documents compared / consistency status / term alignment / boundary check

THE DESIGN:
  <the actual architecture / spec / API / plan>

ASSUMPTIONS:
  <numbered list, each with mitigation>

OPEN QUESTIONS:
  <things the implementer or owner needs to decide>
```

## Hard Bounds

- **Do not design past the scope.** If you were asked to design the wire timing system,
  don't redesign the stat derivation pipeline. Scope creep in design is scope creep in
  every downstream implementation.
- **Do not research indefinitely.** Two failed verification attempts for a single claim →
  mark it UNVERIFIED and move on. Flag it, don't block on it.
- **Do not present unverified claims as verified.** The verification log exists to make
  the boundary explicit. Crossing it silently is the single most damaging thing an
  architect can do — it was exactly this failure (presenting a fabricated historical
  figure as verified) that cost this project weeks of rework.
- **Do not design against stale docs.** Read the current version of every document you
  reference. If you last read the GDD three sessions ago, read it again — it may have
  changed. Stale references produce stale designs.

## Kijo-Specific Checks

- **GDD is the authority.** Every design must be consistent with the finalized GDD.
  If a design conflicts with the GDD, the GDD wins unless the owner explicitly approves
  the change. Do not silently override GDD decisions in a tech spec.
- **Terminology canon:**
  - The game: **Kijo**
  - The tree NFT: **kijonsai** (lowercase)
  - The spirit: **kijo** (lowercase)
  - The merchant/master: **Gu Ahao** (fictional, noted as such)
  - The deity: **Yama-no-Kami**
  - The ranking system: **Flower Guild Rank** (Seedling/Sapling/Pruned/Styled/Exhibition/Master Work/Living Painting)
  - The stat terrain's ideal form measurement: **match percentage** (displayed as Flower Guild Rank)
  - Species: **Hardwood / Evergreen / Tropical** (capitalized as class names)
  - Techniques: **Bound-and-Cut / Clip-and-Grow / Jin / Water-and-Land** (hyphenated as shown)
  - Combat styles: 7 (not 8 — Sekijoju is landscape-only)
  - Tools: water, rotate, twine, weights (free) / wire, guy-wire, dual-branch tie, raffia, jin pliers, shears, fertilize (premium) / notch (future)
  - Day cycle: **1 game day = 8 real hours** (3 game days per real day)
  - SLP: **Soothing Leaf Potion** (caretaker, in-game, account-locked) and **Smooth Love Potion** (fighter, Ronin SLP token, burned on use)
  - Stat fields: `hp, power, endurance, ki, skillSlots, skillPoints, wisdom, matchPct` (camelCase, this is the cross-boundary contract)
  - Voxel roles: `TRUNK, ARM, LEG, DIGIT, CANOPY, ROOT, SCAR` (the morphology layer, separate from material)
- **Use these terms exactly.** Not "tree NFT" for kijonsai. Not "match percent" for matchPct.
  Not "Attack" for Power. Not 8 combat styles when the GDD says 7. Terminology drift is
  how documents contradict each other and agents build against conflicting specs.
- **Cross-reference all five docs:** GDD, Tech Spec, Architecture, Engine API, PRD. If
  your design touches any of them, check against all of them. Inconsistency between
  docs is the specific failure this project has experienced repeatedly.

## Why this completes the pipeline

```
Architect (this skill) → designs with verified foundations
Implementer (disciplined-implementer) → builds the smallest correct change, verifies by observation
Auditor (adversarial-auditor) → re-verifies adversarially, hunts for the gaps both above missed
```

Each stage catches a different class of failure:
- The architect catches factual errors, context gaps, and doc inconsistencies BEFORE code
- The implementer catches logic errors and spec mismatches DURING code
- The auditor catches false completion claims and overlooked gaps AFTER code

A fabricated historical figure gets caught at Step 2 (UNVERIFIED — no primary source).
A code snippet with a wrong license gets caught at Step 2.1 (license incompatible). A
design that contradicts the GDD gets caught at Step 4 (cross-reference check fails).
None of these reach the implementer. The damage stops at the design phase, which is the
cheapest place to be wrong.

## Why this is safe

No external code, no network calls, no fetched instructions beyond what the architect
explicitly searches for and audits. The verification steps use the model's own search
and reading tools. Every external source is logged and auditable. Read this skill and
you have read everything it will do.
