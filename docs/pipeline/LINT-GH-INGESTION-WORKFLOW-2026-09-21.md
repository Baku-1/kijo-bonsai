# Linter Report — GH Ingestion Workflow

**Date:** 2026-09-21
**Deliverable:** `skills/gh-ingestion/SKILL.md` (612 lines)
**Spec:** `docs/pipeline/ARCH-GH-INGESTION-WORKFLOW-2026-09-21.md` (688 lines)
**Critic:** `docs/pipeline/CRITIC2-GH-INGESTION-WORKFLOW-2026-09-21.md`
**Auditor:** `docs/pipeline/AUDIT-GH-INGESTION-WORKFLOW-2026-09-21.md`
**Skills invoked:** `carmack-linus-review`
**Verdict:** CLEAN

---

## Document Consistency

### Spec reference — CORRECT

- Skill frontmatter line 10: `Spec: docs/pipeline/ARCH-GH-INGESTION-WORKFLOW-2026-09-21.md`
- Skill body line 15: same path repeated. Both resolve to the correct v2 ARCH doc.

### Section names — CONSISTENT (with justified deviation)

The skill defines 6 stages: Discovery → Triage → Deep Analysis (Extraction) → Wiki Generation (Composition) → Cross-Reference → Verification (Quality Review). The spec's §4 defines 5 stages with cross-referencing embedded in Stage 4, but §8 defines cross-referencing as a distinct algorithm. The skill correctly separates it into its own stage. This is internally consistent within the skill and is an improvement over the spec's ambiguous numbering.

### API endpoint URLs — ALL MATCH

All 11 endpoints (E1–E11) in the skill's API Reference table and workflow stages match the spec's §2.1 exactly:

| Endpoint | Spec | Skill | Match |
|---|---|---|---|
| E1 `/users/{username}` | §2.1 | Line 88, line 326 | YES |
| E2 `/orgs/{org}` | §2.1 | Lines 91–93, line 327 | YES |
| E3 `/users/{username}/repos` | §2.1 | Lines 95–98, line 328 | YES |
| E4 `/orgs/{org}/repos` | §2.1 | Line 96, line 329 | YES |
| E5 `/repos/{owner}/{repo}` | §2.1 | Line 339 | YES |
| E6 `/repos/{owner}/{repo}/languages` | §2.1 | Lines 157–159, line 340 | YES |
| E7 `/repos/{owner}/{repo}/readme` | §2.1 | Lines 162–165, line 341 | YES |
| E8 `/repos/{owner}/{repo}/contents/{path}` | §2.1 | Lines 183–187, line 342 | YES |
| E9 `/repos/{owner}/{repo}/commits?author=...` | §2.1 | Lines 121–125, line 343 | YES |
| E10 `/repos/{owner}/{repo}/license` | §2.1 | Lines 167–172, line 344 | YES |
| E11 `/rate_limit` | §2.1 | Lines 74–80, line 345 | YES |

### Tier thresholds — ALL MATCH

| Rule | Spec §5.1 | Skill | Match |
|---|---|---|---|
| T1 absolute | >= 5000 | >= 5000 | YES |
| T1 top-repo | >= 1000 + most-starred | >= 1000 + most-starred | YES |
| T1 trusted | >= 500 + trusted + 6mo | >= 500 + trusted + 6mo | YES |
| T2 standard | >= 100 | >= 100 | YES |
| T2 recent | >= 20 + 12mo + README | >= 20 + 12mo + README | YES |
| T3 | < 100, not skipped | < 100, not skipped | YES |
| Ecosystem override | T2 min for known tools | Present | YES |
| High-utility override | >= 10 forks + 6mo → T2 | Present | YES |
| Trusted dev boost | SOP §7 list | Present with named devs | YES |

### Budget formula — MINOR DECOMPOSITION DIFFERENCE (NOT A DEFECT)

Spec §2.3 formula separates `count_forks` (commits check) and `files_to_extract` as distinct terms. Skill formula (line 136) consolidates T1 to `count_T1 * 9` (3 base + 5 files max + 1 commits). The skill's formula is a conservative upper bound — it overestimates by assuming every T1 repo needs a commits check (which is only for forks in triage). Overestimating a budget is safer than underestimating. Not a defect.

---

## Pipeline Doc Chain

| Check | Finding |
|---|---|
| ARCH doc exists and is v2 | **PASS** — Line 1: `# ARCH: GitHub Profile Ingestion Workflow v2`, line 4: `Author: Architect (corrective pass — addresses all 6 critic blockers)` |
| CRITIC2 references correct ARCH | **PASS** — Line 4: `Spec reviewed: ARCH-GH-INGESTION-WORKFLOW-2026-09-21.md (688 lines, 15 sections)` |
| CRITIC2 references prior review | **PASS** — Line 5: `Prior review: CRITIC-GH-INGESTION-WORKFLOW-2026-09-21.md (6 blockers, 5 advisories, 2 warnings — verdict: REJECTED)` |
| AUDIT references correct deliverable | **PASS** — Line 4: `Deliverable: skills/gh-ingestion/SKILL.md` |
| AUDIT references correct spec | **PASS** — Line 5: `Spec: docs/pipeline/ARCH-GH-INGESTION-WORKFLOW-2026-09-21.md` |
| AUDIT references correct critic | **PASS** — Line 6: `Critic: docs/pipeline/CRITIC2-GH-INGESTION-WORKFLOW-2026-09-21.md` |
| No orphaned cross-references | **PASS** — ARCH references v1 critic (correct — v2 was written in response to v1 rejection). All internal `§` references within each doc resolve. |

Chain: ARCH v2 ← CRITIC2 ← AUDIT ← LINT. Complete and consistent.

---

## Skill Quality

| Check | Finding |
|---|---|
| YAML frontmatter valid | **PASS** — `---` delimiters present, `name: gh-ingestion`, multi-line `description` using `>` scalar, trigger phrases present, spec reference present |
| Headers properly formatted | **PASS** — Consistent `##` and `###` hierarchy throughout |
| Code blocks closed | **PASS** — All fenced code blocks (```` ``` ````) properly opened and closed |
| Tables properly formatted | **PASS** — All tables have header rows, separator rows, and aligned pipes |
| Language tags on code blocks | **PASS** — JSON blocks tagged, markdown template blocks tagged |
| No TODO/FIXME/PLACEHOLDER markers | **PASS** — Grepped file; zero matches (false positives from "template" containing "temp" only) |
| No contradictory instructions | **PASS** — The skill is internally consistent. It defines 6 stages and references 6 stages in its exit criteria. No instruction in one section contradicts another. |

---

## Auditor Caveat Assessment

### Caveat 1: Stage count cosmetic inconsistency (6 in skill vs 5 in spec §4/§10.1)

**Verdict: NOT A BLOCKER.**

The spec defines cross-referencing as a distinct algorithm in §8 with its own subsections (8.1–8.4), but only counts 5 stages in §4 and §10.1. The spec is internally inconsistent — the skill resolves this inconsistency by making cross-referencing a first-class stage. The skill is self-consistent (defines 6 stages, references 6 in exit criteria). This is a spec-side cosmetic issue, not a skill defect. Future spec revisions should align the count to 6.

### Caveat 2: No live API verification possible

**Verdict: NOT A BLOCKER.**

Environmental limitation. The spec's §12 Verification Log documents live verification of all 14 GitHub API claims with source links. The skill's API references were verified against this log by the auditor. The linter has no additional verification to add.

### Caveat 3: Existing wiki pages lack `source`, `license`, `ingestion_version` fields

**Verdict: NOT A BLOCKER.**

The overwrite safety mechanism (skill lines 228–237) explicitly handles this: pages missing `ingestion_version` are treated as manually created and get `.proposed.md` treatment — never silently overwritten. This is the correct conservative behavior. The first ingestion runs will produce `.proposed.md` files for existing pages, which the operator reviews. Working as designed.

---

## Carmack × Linus Assessment

### What This Deliverable Gets Right

The skill is a faithful, complete translation of a 688-line spec into a 612-line operational workflow. It preserves every quantitative threshold, every API endpoint, and every safety mechanism. The data structure choice for `completed_repos` (object for O(1) lookup, per Critic W-3/Linus note) is correct — this matters for orgs with 500+ repos. The content trust model prominently warns against executing fetched code or following README instructions, which is the right security posture for a tool that ingests untrusted external content. The determinism guarantee (sort by stars descending, apply rules in fixed order) means two runs on identical data produce identical output — this is testable, debuggable, and the mark of systems thinking.

### Linus Notes

The error handling table covers all the cases that matter and correctly disambiguates 403 (rate limited vs forbidden) by checking `x-ratelimit-remaining`. Most specs miss this. The retry policy has jitter, max consecutive failure abort, and checkpoint-on-abort — all the things you need for a workflow that touches a rate-limited external API. The input validation (regex + length check) was added by the implementer and is a defensive improvement over the spec.

No issues found.

---

## Fixes Applied

None. No fixes were necessary.

---

## Final Verdict

**CLEAN**

The skill file is a complete, internally consistent, correctly structured implementation of the ARCH spec. All document cross-references resolve. All API endpoints, tier thresholds, and safety mechanisms match between spec and skill. The pipeline doc chain (ARCH v2 → CRITIC2 → AUDIT → LINT) is intact with no orphaned references. The three auditor caveats are all non-blocking (one is an improvement, one is environmental, one is handled by design). No TODO markers, no broken markdown, no contradictions.

The deliverable is ready for its first ingestion run against `dwi` (recommended initial target per spec §10.3).

---

*Linter: carmack-linus-review persona applied. Verdict issued.*
