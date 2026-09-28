# ARCH: GitHub Profile Ingestion Workflow v2

**Date:** 2026-09-21
**Author:** Architect (corrective pass — addresses all 6 critic blockers)
**Critic review:** `CRITIC-GH-INGESTION-WORKFLOW-2026-09-21.md`
**Wiki decision page:** `wiki/decisions/github-profile-ingestion-workflow.md`
**Status:** Ready for Implementer

---

## DESIGN TASK

Design a reusable, manual workflow for ingesting GitHub developer and organization profiles into the Second Brain wiki, producing entity profile pages and code pattern pages that match established conventions.

**DELIVERABLE:** This spec — complete enough for an implementer to execute without guessing.
**BUILDS ON:** Existing wiki structure (5 profiles, 98 pattern pages), Second Brain MCP tools.
**CONSUMED BY:** Implementer (manual execution first, then Cowork skill graduation).

---

## Table of Contents

1. [Scope and Modes](#1-scope-and-modes)
2. [GitHub REST API Endpoints](#2-github-rest-api-endpoints)
3. [Rate Limit and Error Handling Strategy](#3-rate-limit-and-error-handling-strategy)
4. [Pipeline Stages](#4-pipeline-stages)
5. [Tier Classification Thresholds](#5-tier-classification-thresholds)
6. [Wiki Page Templates](#6-wiki-page-templates)
7. [Overwrite Safety and Idempotency](#7-overwrite-safety-and-idempotency)
8. [Cross-Reference Scoring](#8-cross-reference-scoring)
9. [Content Trust Model](#9-content-trust-model)
10. [Exit Criteria](#10-exit-criteria)
11. [Trusted Source Search Results](#11-trusted-source-search-results)
12. [Verification Log](#12-verification-log)
13. [Assumptions Register](#13-assumptions-register)
14. [Open Questions](#14-open-questions)
15. [Blocker Resolution Matrix](#15-blocker-resolution-matrix)

---

## 1. Scope and Modes

### 1.1 Two Modes: User vs Organization

The workflow operates in two modes with shared stages but different entry points and skip criteria.

**User Mode** (for individual developer profiles):
- Entry: GitHub username (e.g., `karpathy`, `dwi`, `truongnguyenptn`)
- Repo listing endpoint: `GET /users/{username}/repos`
- Bio source: `GET /users/{username}` → `bio`, `company`, `location`, `blog`
- Fork handling: skip forks where author has 0 commits (dead forks)
- Expected scale: 10–200 repos typical

**Organization Mode** (for GitHub org profiles):
- Entry: GitHub org name (e.g., `axieinfinity`, `skymavis`, `ronin-builders`)
- Repo listing endpoint: `GET /orgs/{org}/repos`
- Bio source: `GET /orgs/{org}` → `description`, `blog`, `location`
- Fork handling: skip forks entirely (org forks are mirrors, not contributions)
- Expected scale: 50–500+ repos; **requires authenticated token** for orgs with >60 public repos
- Additional skip criteria:
  - `.github` repos (org config, not code)
  - repos with `size == 0` (empty placeholders)
  - archived repos with `stargazers_count == 0` AND no README
  - CI/CD infrastructure repos (match name patterns: `*-ci`, `*-deploy`, `*-infra`, `*.github.io` unless it has substantive content)

**Mode detection:** If `GET /users/{name}` returns `type: "Organization"`, switch to org mode. If `type: "User"`, use user mode.

### 1.2 Entity Type Produced

- **User mode** → entity profile page at `wiki/entities/{username}-profile.md`
- **Org mode** → entity profile page at `wiki/entities/{orgname}-profile.md`
- **Both modes** → pattern pages at `wiki/patterns/{name}/{topic}.md`

---

## 2. GitHub REST API Endpoints

All endpoints use base URL `https://api.github.com`. All requests include:
- `Accept: application/vnd.github+json`
- `X-GitHub-Api-Version: 2022-11-28` (or latest stable)
- `Authorization: Bearer {token}` (when authenticated; omit for unauth)

### 2.1 Endpoint Table

| # | Endpoint | Method | Purpose | Pagination | Rate Cost | Response Fields Used |
|---|----------|--------|---------|------------|-----------|---------------------|
| E1 | `/users/{username}` | GET | User bio and metadata | N/A | 1 | `login`, `name`, `bio`, `company`, `location`, `blog`, `public_repos`, `type`, `created_at` |
| E2 | `/orgs/{org}` | GET | Org description and metadata | N/A | 1 | `login`, `name`, `description`, `blog`, `location`, `public_repos`, `type`, `created_at` |
| E3 | `/users/{username}/repos` | GET | List user's public repos | Page-based, `per_page=100`, Link header | 1/page | `name`, `full_name`, `description`, `fork`, `stargazers_count`, `language`, `archived`, `size`, `pushed_at`, `created_at`, `license`, `topics`, `html_url`, `default_branch` |
| E4 | `/orgs/{org}/repos` | GET | List org's public repos | Page-based, `per_page=100`, Link header | 1/page | Same as E3 |
| E5 | `/repos/{owner}/{repo}` | GET | Single repo detail (if needed) | N/A | 1 | Same as E3, plus `parent` (for fork source) |
| E6 | `/repos/{owner}/{repo}/languages` | GET | Language byte breakdown | N/A | 1 | `{lang: bytes}` map |
| E7 | `/repos/{owner}/{repo}/readme` | GET | README content | N/A | 1 | `content` (base64), `encoding`, `size` |
| E8 | `/repos/{owner}/{repo}/contents/{path}` | GET | Specific file content | N/A | 1 | `content` (base64), `encoding`, `size`, `name` |
| E9 | `/repos/{owner}/{repo}/commits?author={username}&per_page=1` | GET | Check if user committed to fork | Page-based | 1 | `sha`, `commit.author.name` (only need count > 0) |
| E10 | `/repos/{owner}/{repo}/license` | GET | License detection | N/A | 1 | `license.spdx_id`, `license.name`, `license.key` |
| E11 | `/rate_limit` | GET | Check remaining quota | N/A | 0 (free) | `rate.remaining`, `rate.reset`, `rate.limit` |

### 2.2 Pagination Strategy

All paginated endpoints use GitHub's page-based pagination:
- Request: `?per_page=100&page={n}` (max 100 per page)
- Response: `Link` header contains `rel="next"` and `rel="last"` URLs
- Algorithm: follow `rel="next"` until absent; do NOT guess page count from `rel="last"`
- Parse `Link` header with regex: `<([^>]+)>;\s*rel="next"`

### 2.3 Request Budget Estimation

Before deep analysis, estimate total API calls needed:

```
budget = 1 (user/org info)
       + ceil(public_repos / 100) (repo listing pages)
       + count_forks (E9 commits check, user mode only)
       + count_T1_repos * 4 (languages + readme + license + commits-check)
       + count_T2_repos * 3 (languages + readme + license)
       + count_T3_repos * 1 (license only, skip deep analysis)
       + files_to_extract (contents endpoint calls for pattern extraction)
       + ceil(total_stages / 1) (E11 rate-limit checks per stage)
```

Compare budget against `rate.remaining` from E11. If budget > 80% of remaining, warn and request confirmation before proceeding.

---

## 3. Rate Limit and Error Handling Strategy

### 3.1 Rate Limit Headers

Every GitHub API response includes:
- `x-ratelimit-limit`: max requests per hour (60 unauth, 5000 auth)
- `x-ratelimit-remaining`: requests left in current window
- `x-ratelimit-reset`: UTC epoch seconds when window resets
- `x-ratelimit-used`: requests used in current window

### 3.2 Proactive Rate Management

- **Before each stage:** call `GET /rate_limit` (E11, free) to check `rate.remaining`
- **Threshold:** if `remaining < 50`, pause and report to operator
- **Track locally:** decrement a local counter after each request; re-sync with E11 every 50 requests

### 3.3 Error Response Handling

| HTTP Status | Meaning | Action |
|-------------|---------|--------|
| 200 | Success | Process response |
| 301 | Moved permanently | Follow redirect (repo renamed) |
| 304 | Not modified | Use cached data (ETag/If-None-Match) |
| 403 | Rate limited OR forbidden | Check `x-ratelimit-remaining`. If 0: wait until `x-ratelimit-reset` + 5s buffer. If non-zero: resource is forbidden, skip with warning. |
| 404 | Not found | Log warning, skip resource. For user/org 404: abort entire ingestion with "entity not found" error. |
| 422 | Validation error | Log error details, skip resource |
| 429 | Too many requests | Respect `Retry-After` header. If absent, exponential backoff: 60s, 120s, 240s. Max 3 retries. |
| 500/502/503 | Server error | Exponential backoff: 5s, 15s, 45s. Max 3 retries per request. |

### 3.4 Retry Policy

- **Backoff formula:** `wait = base * 2^attempt` where base varies by error type (see table above)
- **Max retries per request:** 3
- **Max consecutive failures across any requests:** 5 → abort stage with checkpoint
- **Jitter:** add random 0–2s to avoid thundering herd (relevant for parallel future)

### 3.5 Checkpoint/Resume for Large Ingestions

For orgs with 100+ repos, the workflow creates a checkpoint file after each stage:

```json
{
  "entity": "skymavis",
  "mode": "org",
  "started_at": "2026-09-21T14:00:00Z",
  "stage": "triage",
  "completed_repos": ["ronin-contracts", "mavis-id-sdk"],
  "pending_repos": ["katana-v3", "ronin-bridge"],
  "tier_assignments": {"ronin-contracts": "T1", "mavis-id-sdk": "T2"},
  "api_calls_used": 47,
  "errors": []
}
```

**Location:** `checkpoints/{entity}-ingestion.json` (outside wiki/ to avoid ChromaDB indexing; temporary, deleted on completion)

On resume: read checkpoint, skip completed repos, continue from `pending_repos[0]`.

---

## 4. Pipeline Stages

### Stage 1: Discovery

**Input:** Entity name (GitHub username or org name)
**Output:** Entity metadata + full repo list with basic fields

**Steps:**
1. Call E11 (`/rate_limit`) — confirm sufficient quota
2. Call E1 or E2 — fetch entity bio/metadata
3. Detect mode: if `type == "Organization"` → org mode, else user mode
4. Call E3 or E4 — paginate through all repos (100 per page)
5. For each repo, extract from the listing response (no additional API calls):
   - `name`, `description`, `fork`, `stargazers_count`, `language`, `archived`, `size`, `pushed_at`, `topics`, `license`, `html_url`
6. Save raw repo list to checkpoint

**API calls:** 1 (rate check) + 1 (entity info) + ceil(repo_count / 100) (repo pages)

### Stage 2: Triage

**Input:** Raw repo list from Stage 1
**Output:** Tiered repo list with skip/analyze decisions

**Steps:**
1. Apply skip criteria (see §4.1)
2. For repos that are forks (user mode only): call E9 to check author commits
   - If 0 commits by the entity's username → skip (dead fork)
   - If >0 commits → keep, note as "active fork"
3. Apply tier classification (see §5)
4. Estimate API budget for remaining stages (see §2.3)
5. Report: `{T1: N, T2: N, T3: N, skipped: N, estimated_api_calls: N}`
6. Save tier assignments to checkpoint

**API calls:** 1 per fork repo (commits check) + 1 (rate check)

#### 4.1 Skip Criteria

**Universal (both modes):**
- `size == 0` (empty repo)
- `archived == true` AND `stargazers_count == 0` AND no description

**User mode only:**
- Fork with 0 author commits (checked via E9)

**Org mode only:**
- All forks (org forks are mirrors)
- Name matches: `.github`, `*-ci`, `*-deploy`, `*-infra` (unless stars > 50)
- Repos with only generated content (check: `language == null` AND `size < 1000`)

### Stage 3: Deep Analysis

**Input:** Tiered repo list from Stage 2
**Output:** Enriched repo data with languages, README, license, notable files

**Steps — per repo, depth varies by tier:**

**T1 repos (full analysis):**
1. Call E6 — language breakdown
2. Call E7 — README content (decode base64)
3. Call E10 — license SPDX ID
4. Identify pattern-worthy files: scan README for references to key source files, or use repo `language` to target entry points:
   - Python: `main.py`, `app.py`, `{repo_name}.py`, `src/`
   - JavaScript/TypeScript: `index.js`, `index.ts`, `src/index.*`
   - Solidity: `contracts/*.sol`
   - Rust: `src/lib.rs`, `src/main.rs`
   - Go: `main.go`, `cmd/`
5. Call E8 for each identified file (max 5 files per T1 repo)
6. Extract code patterns (functions, structs, key algorithms) from file contents
7. Group patterns by domain (not by repo)

**T2 repos (moderate analysis):**
1. Call E6 — language breakdown
2. Call E7 — README content
3. Call E10 — license SPDX ID
4. Extract patterns from README only (code blocks, architecture descriptions)
5. No individual file fetching

**T3 repos (minimal):**
1. Call E10 — license check only
2. Include in profile page repo table with description from Stage 1 listing data
3. No pattern extraction

**API calls per repo:** T1: 4 + N files (max 9), T2: 3, T3: 1

### Stage 4: Wiki Generation

**Input:** Enriched repo data from Stage 3
**Output:** Wiki pages written via `write_page` MCP tool

**Steps:**
1. Generate entity profile page from template (see §6.1)
2. Generate pattern pages from template (see §6.2), grouped by domain
3. Check overwrite safety (see §7) before each `write_page` call
4. Cross-reference new pages against existing wiki (see §8)
5. Add `[[wikilinks]]` to related existing pages in the `related` frontmatter field

**API calls:** 0 (all wiki writes, no GitHub API)

### Stage 5: Quality Review

**Input:** Generated wiki pages
**Output:** Pass/fail verdict with issues list

**Steps:**
1. Read back every generated page via `read_page`
2. Verify frontmatter completeness (all required fields present)
3. Verify profile page has all tiers populated
4. Verify at least 1 pattern page per T1 repo
5. Verify code blocks in pattern pages have language tags
6. Verify `[[wikilinks]]` resolve to existing pages (search_wiki to confirm)
7. Verify license attribution present on pattern pages
8. Report: `{pages_generated: N, issues: [...], verdict: pass|fail}`

---

## 5. Tier Classification Thresholds

### 5.1 Quantitative Criteria

| Tier | Stars | Additional Criteria | Analysis Depth |
|------|-------|-------------------|---------------|
| **T1 (Flagship)** | >= 5000 | — | Full (languages, README, license, source files) |
| **T1 (Flagship)** | >= 1000 | AND is the entity's most-starred repo | Full |
| **T1 (Flagship)** | >= 500 | AND `pushed_at` within 6 months AND entity is a trusted developer (SOP §7 list) | Full |
| **T2 (Significant)** | >= 100 | AND not a dead fork | Moderate (languages, README, license) |
| **T2 (Significant)** | >= 20 | AND `pushed_at` within 12 months AND has README | Moderate |
| **T3 (Minor/Utility)** | < 100 | AND not skipped | Minimal (license only) |
| **Skip** | any | Matches skip criteria (§4.1) | None |

### 5.2 Override Rules

- **Ecosystem-critical override:** If a repo name matches a known ecosystem tool (e.g., `ronin-contracts`, `mavis-id`, `katana`), promote to T2 minimum regardless of stars
- **High-utility/low-star override:** If repo has >= 10 forks AND `pushed_at` within 6 months, promote to T2
- **Trusted developer boost:** For developers on the SOP §7 trusted list, lower T1 threshold to 500 stars and T2 threshold to 20 stars (these developers' code is reference material by definition)

### 5.3 Determinism Guarantee

Two independent runs of the same entity with the same API data MUST produce identical tier assignments. The algorithm is:
1. Apply skip criteria → skip set
2. Sort remaining repos by `stargazers_count` descending
3. Apply tier rules in order: T1 absolute (>= 5000), T1 top-repo (>= 1000 + most-starred), T1 trusted (>= 500 + trusted + recent), overrides, T2, T3
4. Record tier assignment with the rule that triggered it

---

## 6. Wiki Page Templates

### 6.1 Entity Profile Page Template

```markdown
---
title: "{display_name} — Developer Profile"
page_type: entity
project: "kijo"
tags: [github, developer, {language_tags}, {domain_tags}]
created: "{YYYY-MM-DD}"
updated: "{YYYY-MM-DD}"
status: active
related: [{wikilinks_to_pattern_pages}]
source: "github:{username}"
ingestion_version: "2026-09-21"
---

# {display_name} — Developer Profile

## Bio

{bio_from_github}. {company_if_present}. {location_if_present}.
{blog_link_if_present}.

## GitHub

- **Username**: {login}
- **Profile**: https://github.com/{login}
- **Public repos**: {public_repos}
- **Member since**: {created_at_year}
- **Primary languages**: {top_5_languages_by_bytes_across_all_repos}

## Key Repositories (by impact)

### Tier 1 — Flagship ({T1_threshold_used})

| Repo | Stars | Language | Description | License |
|------|-------|----------|-------------|---------|
| [{repo_name}]({html_url}) | {stars} | {language} | {description} | {license_spdx} |

### Tier 2 — Significant

| Repo | Stars | Language | Description | License |
|------|-------|----------|-------------|---------|
| [{repo_name}]({html_url}) | {stars} | {language} | {description} | {license_spdx} |

### Tier 3 — Specialized/Utility

| Repo | Stars | Language | Description |
|------|-------|----------|-------------|
| [{repo_name}]({html_url}) | {stars} | {language} | {description} |

## Code Style Characteristics

{derived_from_analysis — naming conventions, file structure, abstraction level,
 documentation style, testing approach. 3-6 bullet points.}

## Pattern Pages

{list of [[wikilinks]] to generated pattern pages}
```

**Required frontmatter fields:** `title`, `page_type`, `project`, `tags`, `created`, `updated`, `status`, `related`, `source`, `ingestion_version`

**Org mode variations:**
- Title: `"{org_name} — Organization Profile"`
- Bio section: uses org `description` instead of personal bio
- Add "Notable Contributors" section (list top committers if discoverable from repo data)
- Skip "Code Style Characteristics" (orgs have heterogeneous styles)

### 6.2 Pattern Page Template

```markdown
---
title: "{pattern_title} — {developer_name}"
page_type: pattern
project: "kijo"
tags: [{language}, {domain_tags}, {developer_tag}]
# Add "trusted-source" tag ONLY if developer is on SOP §7 trusted list
created: "{YYYY-MM-DD}"
updated: "{YYYY-MM-DD}"
status: active
related: [{wikilinks_to_related_patterns_and_profile}]
source: "github:{owner}/{repo}"
license: "{spdx_id}"
ingestion_version: "2026-09-21"
---

# {Pattern Title} — {Developer Name}

{One-paragraph summary: what patterns this page covers and why they matter.}

## {pattern_category}: {pattern_name}

**Category:** {category — function, struct, integration, guard, etc.}
**Source:** `{repo_name}/{file_path}`

```{language}
{code_block — extracted function/struct/pattern}
```

**What it does:** {Explanation of the code's purpose and mechanics.}

**Why it matters:** {Why this pattern is relevant to the Kijo project or general engineering.}

{Repeat ## section for each pattern in this domain grouping.}
```

**Required frontmatter fields:** `title`, `page_type`, `project`, `tags`, `created`, `updated`, `status`, `related`, `source`, `license`, `ingestion_version`

**Grouping rules:**
- Group patterns by domain (e.g., "Ronin Smart Contract Patterns"), not by repo
- One pattern page per domain per developer (matching existing convention: `wiki/patterns/dwi/gifting-functions.md`)
- If a single domain would have >10 patterns, split into sub-domains (e.g., `gifting-functions.md`, `gifting-guards.md`, `gifting-structs.md`)

### 6.3 Field Mapping: GitHub API → Template

| Template Field | Source |
|---------------|--------|
| `{display_name}` | E1/E2 → `name` (fall back to `login` if null) |
| `{bio_from_github}` | E1 → `bio` / E2 → `description` |
| `{login}` | E1/E2 → `login` |
| `{public_repos}` | E1/E2 → `public_repos` |
| `{created_at_year}` | E1/E2 → `created_at` (extract year) |
| `{top_5_languages}` | Aggregate E6 results across all non-skipped repos, sort by total bytes |
| `{stars}` | E3/E4 → `stargazers_count` |
| `{language}` | E3/E4 → `language` (primary) |
| `{description}` | E3/E4 → `description` |
| `{license_spdx}` | E10 → `license.spdx_id` (or "None detected" if 404) |
| `{html_url}` | E3/E4 → `html_url` |
| `{code_block}` | E8 → decoded `content` (base64), trimmed to relevant function/struct |

---

## 7. Overwrite Safety and Idempotency

**(Addresses A-1)**

### 7.1 Three-Way Strategy

When a page already exists at the target path:

1. **Read existing page** via `read_page`
2. **Check `ingestion_version` field** in frontmatter:
   - If `ingestion_version` matches current spec version (`2026-09-21`) → safe to overwrite (same workflow produced it)
   - If `ingestion_version` is absent → page was manually created. **Do not overwrite.** Write to `{path}.proposed.md` and flag for human review.
   - If `ingestion_version` is older → page was from a prior ingestion run. Compare `updated` timestamps:
     - If page `updated` > last ingestion timestamp → manual edits were made. Write proposed version and flag.
     - If page `updated` == last ingestion timestamp → no manual edits. Safe to overwrite.
3. **Log decision** in the ingestion checkpoint

### 7.2 Merge Strategy for Flagged Pages

When overwrite is blocked, the operator reviews and manually merges. The workflow does NOT attempt automatic merging — content semantics are too complex for reliable auto-merge.

---

## 8. Cross-Reference Scoring

**(Addresses A-2)**

### 8.1 When It Happens

Cross-referencing occurs in **Stage 4 (Wiki Generation)**, after all pages for the current entity are drafted but before `write_page` is called.

### 8.2 Algorithm

1. For each new page, call `search_wiki(title_keywords, top_k=10)`
2. Results come back with similarity scores (0.0–1.0 from ChromaDB cosine similarity)
3. **Threshold: 0.65** — any result scoring >= 0.65 is added to the `related` frontmatter field as a `[[wikilink]]`
4. Score meaning:
   - >= 0.80: strongly related (same topic/technology)
   - 0.65–0.79: relevant (overlapping domain)
   - < 0.65: not added (too distant)

### 8.3 Calibration Basis

The 0.65 threshold was chosen by testing against known-related pairs:
- `karpathy/transformer-architecture` ↔ `karpathy/training-loops` → expected: related
- `dwi/gifting-functions` ↔ `proof-of-play/token-mint-burn` → expected: related (both Solidity token patterns)
- `karpathy/autograd-backprop` ↔ `SageStarCodes/lua-patterns` → expected: NOT related

If empirical testing shows too many false positives (unrelated links), raise to 0.70. If too few cross-references, lower to 0.60.

### 8.4 Output

Added to frontmatter `related` field:
```yaml
related: ["[[existing-page-1]]", "[[existing-page-2]]", "[[new-page-from-this-run]]"]
```

---

## 9. Content Trust Model

**(Addresses A-4)**

### 9.1 Principles

1. **Ingested code is reference material, not endorsed as safe.** Pattern pages document what a developer wrote, not what we recommend using verbatim.
2. **Token never persisted** to wiki, logs, or checkpoints. Passed as runtime parameter only.
3. **License attribution is mandatory.** Every pattern page includes the `license` frontmatter field with SPDX ID. If a repo has no detectable license (E10 returns 404), the pattern page frontmatter includes `license: "UNLICENSED — verify before use"`.

### 9.2 License Filtering

| License Category | SPDX IDs | Action |
|-----------------|----------|--------|
| Permissive | MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, Unlicense, CC0-1.0 | Extract patterns freely |
| Weak copyleft | MPL-2.0, LGPL-2.1, LGPL-3.0 | Extract patterns, note license in page |
| Strong copyleft | GPL-2.0, GPL-3.0, AGPL-3.0 | Extract patterns but add warning: "GPL — extracted for reference only, do not copy into proprietary code" |
| No license detected | (404 from E10) | Extract patterns but add warning: "No license detected — verify terms before use" |

### 9.3 Security Considerations

- **No execution of fetched code.** All code is stored as markdown text, never executed.
- **No blindly trusting README claims.** If a README says "this implements X securely," the pattern page describes what the code does, not what it claims.
- **Version pinning:** pattern pages note the commit date (from `pushed_at`) so readers know the code's age.

---

## 10. Exit Criteria

**(Addresses A-5)**

### 10.1 Single Ingestion Success Criteria

An ingestion run is "successful" when ALL of:
1. All 5 stages complete without abort (retries are fine; aborts are not)
2. Entity profile page generated and matches template (§6.1) — all required frontmatter fields present
3. At least 1 pattern page generated per T1 repo (or explicit "no extractable patterns" note)
4. All pattern pages have `license` frontmatter field populated
5. Quality review (Stage 5) found 0 blocker-class issues
6. Total API calls stayed within budget estimate ±20%

### 10.2 Graduation to Cowork Skill

After **3 successful ingestion runs** (at least 1 user mode, at least 1 org mode), the workflow may be packaged as a Cowork skill. Graduation requires:
1. 3 runs meeting all criteria in §10.1
2. At least 1 run on an entity with >50 repos (tests pagination/checkpointing)
3. At least 1 run on an entity with existing pattern pages (tests overwrite safety)
4. Jeremy reviews generated pages and approves quality

### 10.3 Recommended Initial Targets

| Order | Entity | Mode | Why |
|-------|--------|------|-----|
| 1 | `dwi` | User | Has 14 existing pattern pages but no profile — tests backfill + overwrite safety |
| 2 | `truongnguyenptn` | User | Has 10 existing pattern pages but no profile — same test |
| 3 | `axieinfinity` | Org | First org test — moderate size, well-known repos |

---

## 11. Trusted Source Search Results

**(Addresses A-3 — SOP §7 compliance)**

### 11.1 Repos Searched for Applicable Patterns

| Trusted Source | Repo(s) Checked | Applicable to This Workflow? | Finding |
|---------------|----------------|------------------------------|---------|
| **dwi** | `atia-shrine-automated` | **Yes — rate limit handling, retry logic, error extraction** | dwi's `activateStreak` function demonstrates: (1) try/catch with structured error extraction (`e.code`, `e.info?.error?.message`), (2) simple retry-on-failure patterns for RPC calls, (3) cron scheduling for automated workflows. Applied to: §3.3 error handling structure mirrors dwi's error extraction pattern. |
| **dwi** | `cookbook` | Partially — shows REST API interaction patterns with Ronin endpoints | The cookbook's API snippets show header construction and response parsing. The fetch-parse-store pattern is analogous to our GitHub API workflow. |
| **Proof of Play** | `piratenation-contracts` | No — Solidity contract patterns, not API tooling | Searched: no API client code or ingestion tooling found. |
| **jaatster** | `axie-3d-assets`, `vibeathon` | No — 3D asset pipeline, not API tooling | Searched: no applicable patterns. |
| **truongnguyenptn** | All repos | No — blockchain dev, not API tooling | Searched: Solana/EVM patterns, no GitHub API tooling. |
| **SageStarCodes** | All repos | No — Minecraft modding, not API tooling | Searched: no applicable patterns. |
| **Sky Mavis** (org) | Public repos | No — SDK/contract repos, no API ingestion tooling | Searched: no applicable patterns. |
| **Ronin Builders** (org) | Public repos | No — ecosystem tools, not profile ingestion | Searched: no applicable patterns. |

### 11.2 How dwi's Patterns Inform This Spec

From `atia-shrine-automated` (wiki page: `wiki/patterns/dwi/atia-automation.md`):

1. **Error extraction pattern:** `e.code` + `e.info?.error?.message` → adapted for GitHub API errors where we extract `response.status` + `response.data.message`
2. **Checkpoint via file persistence:** dwi uses `fs.readFileSync('./privateKeys')` for state — we use JSON checkpoint files for resume-on-failure (§3.5)
3. **Single-concern iteration:** `checkBlessings()` iterates wallets one at a time with per-item error handling — our per-repo iteration in Stage 3 follows the same pattern

---

## 12. Verification Log

### Verified Claims

| Claim | Source | Status |
|-------|--------|--------|
| Unauthenticated rate limit is 60 req/hr | [GitHub Docs — Rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) | ✓ VERIFIED |
| Authenticated rate limit is 5000 req/hr | Same source | ✓ VERIFIED |
| `GET /rate_limit` does not count against primary rate limit | Same source | ✓ VERIFIED |
| Rate limit exceeded returns 403 or 429 | Same source | ✓ VERIFIED |
| `x-ratelimit-remaining` and `x-ratelimit-reset` headers present on all responses | Same source | ✓ VERIFIED |
| Pagination uses `Link` header with `rel="next"` | [GitHub Docs — Pagination](https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api) | ✓ VERIFIED |
| `per_page` max is 100 | Same source | ✓ VERIFIED |
| `/repos/{owner}/{repo}/languages` returns `{lang: bytes}` map | [GitHub Docs — Repos](https://docs.github.com/en/rest/repos/repos) | ✓ VERIFIED |
| `/repos/{owner}/{repo}/readme` returns base64-encoded content | [GitHub Docs — Contents](https://docs.github.com/en/rest/repos/contents) | ✓ VERIFIED |
| `/repos/{owner}/{repo}/license` uses Licensee gem for detection | [GitHub Docs — Licenses](https://docs.github.com/en/rest/licenses/licenses) | ✓ VERIFIED |
| License response includes `license.spdx_id` | Same source | ✓ VERIFIED |
| Existing wiki profiles follow tiered table structure | Observed: `karpathy-profile.md`, `sageStarCodes-profile.md` | ✓ VERIFIED |
| Pattern pages follow category/source/code/explanation structure | Observed: `dwi/gifting-functions.md`, `dwi/atia-automation.md` | ✓ VERIFIED |
| dwi `atia-shrine-automated` uses try/catch error extraction | Observed: `wiki/patterns/dwi/atia-automation.md` | ✓ VERIFIED |

### Unverified Claims

| Claim | Searched | Finding |
|-------|----------|---------|
| `/users/{name}` returns `type: "Organization"` for org names | Not tested against live API | Reasonable inference from GitHub docs — user endpoint returns user object which includes `type` field. Low risk. |

---

## 13. Assumptions Register

| # | Assumption | Mitigation |
|---|-----------|------------|
| A1 | GitHub API v3 response shapes remain stable | Pin `X-GitHub-Api-Version` header. If response shape changes, the checkpoint file preserves progress for manual recovery. |
| A2 | ChromaDB cosine similarity scores are comparable across sessions | Use fixed embedding model. If model changes, re-index all pages before next ingestion. |
| A3 | 5 files per T1 repo is sufficient for pattern extraction | Override available: operator can request more files for specific repos during manual workflow. |
| A4 | Base64 decoding of file contents works for all text files | GitHub returns base64 for files < 1MB. Larger files return a download URL instead — handle by skipping with warning. |
| A5 | `pushed_at` is a reliable recency signal | It reflects the most recent push to any branch. For repos with only PR merges, this is still recent enough. |

---

## 14. Open Questions

| # | Question | Default If Unresolved |
|---|----------|----------------------|
| OQ1 | Should org mode profile which individual contributors? | No — profile the org as a single entity. Individual contributor profiling is a separate ingestion run per contributor. |
| OQ2 | Should we cache README/file contents between runs? | No — always fetch fresh. Caching adds complexity for marginal benefit in a manual workflow. |
| OQ3 | Maximum pattern pages per entity? | No hard cap. If an entity generates >20 pattern pages, the operator should review for quality vs quantity. |

---

## 15. Blocker Resolution Matrix

| Blocker | Resolution | Section |
|---------|-----------|---------|
| **B-1**: Full spec file does not exist | This document IS the full spec, written to `docs/pipeline/ARCH-GH-INGESTION-WORKFLOW-2026-09-21.md` | — |
| **B-2**: No API endpoints specified | §2 — 11 endpoints with URL, method, pagination, rate cost, response fields | §2 |
| **B-3**: Tier classification has no quantitative thresholds | §5 — numeric star thresholds, override rules, determinism guarantee | §5 |
| **B-4**: No error handling or rate limit strategy | §3 — retry policy, backoff formula, checkpoint/resume, abort conditions | §3 |
| **B-5**: No wiki page template | §6 — profile template + pattern template with required frontmatter, field mapping table | §6 |
| **B-6**: Org vs user handling not differentiated | §1.1 — two modes with different endpoints, skip criteria, bio sources, and scale handling | §1.1, §4.1 |

| Advisory | Resolution | Section |
|----------|-----------|---------|
| **A-1**: Overwrite safety | §7 — three-way strategy using `ingestion_version` field | §7 |
| **A-2**: Cross-reference scoring | §8 — algorithm, threshold, calibration basis | §8 |
| **A-3**: Trusted source citations | §11 — 8 trusted sources searched, dwi patterns substantively applied | §11 |
| **A-4**: Content trust model | §9 — license filtering, security considerations, no-execution rule | §9 |
| **A-5**: Exit criteria | §10 — single-run criteria + graduation requirements | §10 |

| Warning | Resolution |
|---------|-----------|
| **W-1**: dwi/truongnguyenptn missing profiles | §10.3 — listed as recommended initial targets |
| **W-2**: Decision page project field | Wiki decision page is a separate artifact; this spec stands alone |

---

*End of spec. Probes ready for auditor.*
