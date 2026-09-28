# CRITIC: GitHub Profile Ingestion Workflow

**Spec reviewed:** `wiki/decisions/github-profile-ingestion-workflow.md` (Second Brain)
**Referenced full spec:** `docs/pipeline/ARCH-GH-INGESTION-WORKFLOW-2026-09-21.md` — FILE DOES NOT EXIST
**Date:** 2026-09-21
**Reviewer role:** Critic (Carmack x Linus lens)
**Skills invoked:** `carmack-linus-review`, `second-brain`

---

## Verdict: REJECTED

The architect produced a decision summary, not a spec. The wiki page at `wiki/decisions/github-profile-ingestion-workflow.md` is ~50 lines of high-level bullet points that describe *what* the pipeline should do but not *how*. It references a "Full Spec" at `docs/pipeline/ARCH-GH-INGESTION-WORKFLOW-2026-09-21.md` that does not exist on disk. An implementer cannot build from this. The spec needs to be written before the pipeline can advance.

---

## Findings

### B-1 (Blocker): Full spec file does not exist

The decision page footer says:

> Full Spec: `docs/pipeline/ARCH-GH-INGESTION-WORKFLOW-2026-09-21.md`

This file does not exist anywhere in the repository. The only artifact is the wiki decision page, which is a summary — not a pipeline-stage ARCH doc. Every prior pipeline task in this project (ARCH-WIRE-UI, ARCH-JINENGINE-PHASE2, ARCH-COST-GUARDS, etc.) produced a detailed spec in `docs/pipeline/`. This one didn't.

**Recommendation:** Write the actual ARCH doc. The decision page is a valid wiki entry, but it is not the spec the implementer reads. The pipeline doc must contain all the detail missing in B-2 through B-6 below.

### B-2 (Blocker): No API endpoints specified

The spec says "GitHub REST API only (no GraphQL)" but never lists which endpoints to call. An implementer must guess.

At minimum, the spec must enumerate:
- `/users/{username}/repos` vs `/orgs/{org}/repos` — these are different endpoints with different response shapes and pagination behavior
- `/repos/{owner}/{repo}` for repo detail
- `/repos/{owner}/{repo}/languages` for language breakdown
- `/repos/{owner}/{repo}/commits?author={username}` for fork contribution detection
- `/repos/{owner}/{repo}/contents/{path}` or raw content URLs for file extraction
- `/repos/{owner}/{repo}/readme` for README fetching

Each endpoint needs: expected response fields used, pagination strategy (Link header parsing), and error codes handled.

**Recommendation:** Table of endpoints with method, URL, params, pagination strategy, and rate-limit cost per call.

### B-3 (Blocker): Tier classification has no quantitative thresholds

The spec says "T1 flagship / T2 significant / T3 minor" and "calibrated against existing profiles" but never defines the actual criteria. "Tier thresholds are initial heuristics" is not implementable. Two independent runs would produce different tier assignments.

The existing karpathy profile uses star count as the primary tier signal (T1: 10k+, T2: 1k-10k, T3: <1k). But this is inferred from the page — the spec doesn't state it.

**Recommendation:** Define thresholds explicitly. Example:
- T1 (flagship): stars >= 5000, OR stars >= 1000 AND is the developer's most-starred repo
- T2 (significant): stars >= 100 AND stars < 5000
- T3 (minor/utility): stars < 100 AND not a dead fork
- Skip: forks with 0 author commits, archived with 0 stars, empty repos

These are examples — the architect must choose concrete numbers and document them. Include override logic for ecosystem-critical repos with low stars (the "high-utility/low-star" gap the spec itself acknowledges).

### B-4 (Blocker): No error handling or rate limit strategy

The spec mentions "unauthenticated gives 60 req/hr, authenticated gives 5000/hr" but doesn't define what happens when limits are hit.

Missing:
- What does the workflow do on HTTP 403 (rate limited)? Wait? Abort? How long?
- What about HTTP 404 (user/org not found)?
- What about HTTP 422 (validation error)?
- What about network timeouts?
- How is partial progress preserved? If ingestion of a 200-repo org fails at repo #150, does it restart from scratch?
- Is there a request budget per ingestion run?

**Recommendation:** Define: (1) retry policy (exponential backoff on 429/403, max retries), (2) abort conditions (e.g., 3 consecutive failures), (3) checkpoint/resume strategy for large orgs, (4) rate budget estimation before starting (list repos first, count, estimate API calls needed, compare against remaining quota via `/rate_limit` endpoint).

### B-5 (Blocker): No wiki page template defined

The spec says pages should "follow the established entity profile + pattern page conventions" but doesn't define a template. The existing profiles (karpathy, SageStarCodes, HelgeSverre, martindevans) all follow a structure but it's implicit:

Profile pages have: Bio, GitHub metadata, Key Repositories (tiered table), Code Style Characteristics, Pattern Pages (wikilinks).

Pattern pages have: title, category, source file, code block, explanation, "Why it matters."

The spec must provide explicit templates for generated pages so the implementer doesn't have to reverse-engineer the format from existing examples.

**Recommendation:** Include a template for (1) entity profile page (with frontmatter fields), (2) pattern page (with frontmatter fields), specifying which fields are required vs optional, and how they map to GitHub API response data.

### B-6 (Blocker): Org vs user handling not differentiated

The spec mentions "3 pending GitHub orgs (Ronin Builders, Sky Mavis, Axie Infinity)" as targets but doesn't distinguish org ingestion from user ingestion. Differences:

- Orgs use `/orgs/{org}/repos` (different endpoint, different pagination limits)
- Orgs can have hundreds of repos vs individual devs with tens
- Orgs don't have a single "author" for fork-contribution checks — need to decide: do we profile the org as an entity, or individual contributors?
- Org profiles need different Bio sections (org description, not personal bio)
- Org repos may include internal tools, CI configs, .github repos — different skip criteria needed

**Recommendation:** Separate the workflow into two modes (user vs org) with explicit handling for each, or define a single abstracted flow that handles both with documented branch points.

### A-1 (Advisory): Idempotent re-runs may destroy manual edits

The spec says "overwrite existing pages with fresh data, track via `updated` timestamp." This is destructive. If someone manually edits a wiki page after ingestion (adds notes, corrects a pattern explanation, adds cross-references), a re-run will obliterate those edits.

**Recommendation:** Either (a) skip pages that have been manually modified (check `updated` timestamp vs last ingestion timestamp), or (b) use a merge strategy that preserves manual additions, or (c) document this as accepted behavior and warn before overwrite.

### A-2 (Advisory): Cross-reference threshold (0.7) is unvalidated

The spec acknowledges "Cross-reference score threshold (0.7) is embedding-model-dependent — needs empirical tuning" but doesn't define what cross-referencing does or how it fits into the workflow stages.

**Recommendation:** Define when cross-referencing happens (which stage), what it produces (wikilinks? related fields?), and what the 0.7 threshold means operationally (similarity score above 0.7 = add as related page?).

### A-3 (Advisory): No trusted developer citations for the workflow itself

SOP §7 requires specs to cite patterns from trusted developer repos. This spec is about GitHub API ingestion tooling — not game/blockchain patterns — so the trusted dev list (Proof of Play, dwi, etc.) doesn't directly apply. However, dwi's automation patterns (atia-shrine-automated) show relevant API interaction patterns: rate limit handling, error extraction from RPC responses, retry logic. The spec should either cite these as analogous or document "searched X, no applicable pattern found."

**Recommendation:** Add a "Trusted Source Search" section documenting which repos were checked and what was/wasn't applicable. Even a negative search result satisfies the SOP.

### A-4 (Advisory): Security — content trust model for ingested code

The spec says "Token never persisted to wiki/logs" (good) but doesn't address content trust for ingested source code. When extracting patterns from GitHub repos, the code is being stored in the wiki as trusted reference material. What if a repo contains:
- Intentionally misleading code (supply chain attack patterns)
- Outdated/vulnerable patterns (old OpenZeppelin versions)
- License-incompatible code (GPL in a pattern page without attribution)

**Recommendation:** Add: (1) license check — skip or flag repos without permissive licenses, (2) note that pattern pages should include license attribution, (3) define that ingested patterns are reference material, not endorsed as safe — implementers still verify.

### A-5 (Advisory): "Manual workflow first" needs exit criteria

The spec says "graduate to Cowork skill after 3 successful ingestions" but doesn't define what constitutes "successful." Is it: all stages complete? Wiki pages pass quality review? Generated pages match existing format?

**Recommendation:** Define success criteria: (1) all 5 stages complete without error, (2) generated profile page matches template, (3) at least 1 pattern page generated per T1 repo, (4) quality review found no B-class issues. After 3 runs meeting all criteria, proceed to skill automation.

### W-1 (Warning): dwi and truongnguyenptn missing entity profiles

The spec acknowledges these two devs have pattern pages but no entity profiles. This is a pre-existing gap, not a spec issue, but the workflow should be tested against these as backfill targets (they have existing pattern pages to validate against).

### W-2 (Warning): Decision page project field is "second-brain" not "kijo"

The wiki decision page has `project: "second-brain"`. The Second Brain is infrastructure for the Kijo project. This is fine taxonomically but means a `project: "kijo"` filter won't find this decision.

---

## Implementability Assessment

**Can an implementer build this from the spec alone without guessing?** No.

The decision page is a well-written summary of architectural choices but lacks the operational detail needed for implementation. Every prior ARCH doc in this project's pipeline (88 files in `docs/pipeline/`) contained specific file changes, API details, test criteria, and done-when checks. This one has none of that.

The architect needs to produce the actual ARCH doc at `docs/pipeline/ARCH-GH-INGESTION-WORKFLOW-2026-09-21.md` with:
1. Endpoint table with pagination and error handling
2. Concrete tier thresholds
3. Wiki page templates (profile + pattern)
4. Org vs user mode handling
5. Rate limit strategy
6. Checkpoint/resume for large ingestions
7. Done-when criteria per stage
8. Trusted source search results

---

## Verdict Summary

| ID | Class | Summary |
|----|-------|---------|
| B-1 | Blocker | Full spec file does not exist on disk |
| B-2 | Blocker | No API endpoints specified |
| B-3 | Blocker | Tier classification has no quantitative thresholds |
| B-4 | Blocker | No error handling or rate limit strategy |
| B-5 | Blocker | No wiki page template defined |
| B-6 | Blocker | Org vs user handling not differentiated |
| A-1 | Advisory | Idempotent re-runs may destroy manual edits |
| A-2 | Advisory | Cross-reference threshold unvalidated |
| A-3 | Advisory | No trusted developer citations for workflow |
| A-4 | Advisory | Content trust model for ingested code missing |
| A-5 | Advisory | "Manual workflow first" needs exit criteria |
| W-1 | Warning | Pre-existing: dwi/truongnguyenptn missing profiles |
| W-2 | Warning | Decision page project field is "second-brain" |

**Verdict: REJECTED — 6 blockers. Architect must produce the full spec before implementation can proceed.**
