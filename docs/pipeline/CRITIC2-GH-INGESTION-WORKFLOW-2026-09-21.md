# Critic v2 Review — GH Ingestion Workflow

**Date:** 2026-09-21
**Spec reviewed:** `ARCH-GH-INGESTION-WORKFLOW-2026-09-21.md` (688 lines, 15 sections)
**Prior review:** `CRITIC-GH-INGESTION-WORKFLOW-2026-09-21.md` (6 blockers, 5 advisories, 2 warnings — verdict: REJECTED)
**Reviewer role:** Critic v2 (Carmack x Linus lens)
**Skills invoked:** `second-brain` (read_index, search_wiki), `carmack-linus-review`
**Verdict:** PASS WITH CAVEATS

---

## Blocker Resolution Status

### B-1: Full spec file does not exist — RESOLVED

**Evidence:** The file `docs/pipeline/ARCH-GH-INGESTION-WORKFLOW-2026-09-21.md` exists on disk, is 688 lines long, contains 15 numbered sections with a table of contents, and ends with "Probes ready for auditor." This is a complete ARCH doc, not a decision summary. The wiki decision page at `wiki/decisions/github-profile-ingestion-workflow.md` is now correctly a separate summary artifact.

### B-2: No API endpoints specified — RESOLVED

**Evidence:** Section §2 provides an 11-endpoint table (E1–E11) with exact URLs, HTTP method, purpose, pagination strategy, rate cost per call, and response fields used. Section §2.2 specifies pagination algorithm (follow `rel="next"` Link header, regex provided). Section §2.3 provides a request budget estimation formula. This is thorough and implementable.

### B-3: Tier classification has no quantitative thresholds — RESOLVED

**Evidence:** Section §5.1 provides a quantitative threshold table: T1 >= 5000 stars (absolute), T1 >= 1000 (top-repo), T1 >= 500 (trusted + recent), T2 >= 100, T2 >= 20 (recent + README), T3 < 100. Section §5.2 adds override rules for ecosystem-critical repos and trusted developer boost. Section §5.3 provides a determinism guarantee with a 4-step algorithm that guarantees identical tier assignments from identical input data.

### B-4: No error handling or rate limit strategy — RESOLVED

**Evidence:** Section §3 is comprehensive: §3.1 documents rate limit headers, §3.2 defines proactive rate management with a threshold of remaining < 50, §3.3 provides a 7-row error response table with specific actions per HTTP status code, §3.4 defines retry policy with backoff formula and max consecutive failure abort (5), §3.5 provides a checkpoint/resume strategy with a JSON schema for checkpoint files. This exceeds what was requested.

### B-5: No wiki page template defined — RESOLVED

**Evidence:** Section §6 provides two complete templates: §6.1 entity profile page template with full frontmatter schema (10 required fields listed) and org mode variations, §6.2 pattern page template with frontmatter and grouping rules. §6.3 provides a field mapping table from GitHub API response fields to template placeholders (13 mappings). An implementer can generate pages mechanically from this.

### B-6: Org vs user handling not differentiated — RESOLVED

**Evidence:** Section §1.1 explicitly defines two modes (User vs Organization) with different entry points, endpoints, bio sources, fork handling, expected scale, and additional skip criteria. Mode detection is specified: check `type` field from `/users/{name}` response. Section §4.1 separates skip criteria by mode. Section §6.1 documents org mode template variations.

---

## Advisory Resolution Status

### A-1: Overwrite safety — ADDRESSED

Section §7 defines a three-way strategy based on `ingestion_version` frontmatter field: same version = safe overwrite, absent version = manual page (write `.proposed.md`), older version = check for manual edits via timestamp comparison. This is conservative and safe. The decision to NOT auto-merge is correct — content semantics are too complex for reliable automated merging.

### A-2: Cross-reference scoring — ADDRESSED

Section §8 defines when cross-referencing happens (Stage 4, after drafting), the algorithm (search_wiki with title keywords, cosine similarity threshold of 0.65), calibration basis (3 known-related pairs tested), and output format (wikilinks in `related` frontmatter). The threshold was lowered from 0.70 to 0.65 with rationale.

### A-3: Trusted source citations — ADDRESSED

Section §11 documents all 8 trusted sources searched with specific findings per source. dwi's `atia-shrine-automated` is substantively cited with 3 specific patterns applied to the spec (error extraction, checkpoint persistence, single-concern iteration). Sources with no applicable patterns are documented as such. This satisfies the SOP §7 requirement.

### A-4: Content trust model — ADDRESSED

Section §9 covers: code is reference material not endorsed as safe, token never persisted, license attribution mandatory with a 4-tier license filtering table (permissive/weak copyleft/strong copyleft/unlicensed), security considerations including no execution of fetched code, no trusting README claims, and version pinning via `pushed_at` date.

### A-5: Exit criteria — ADDRESSED

Section §10 defines single-run success criteria (6 conditions), graduation requirements for Cowork skill (3 successful runs with specific diversity requirements), and recommended initial targets with rationale for each. The exit criteria are measurable and falsifiable.

---

## New Findings

### A-6 (Advisory): Unauthenticated rate limit makes org ingestion impractical

The spec correctly notes both rate tiers (60 unauth, 5000 auth) in §3.1 and mentions "requires authenticated token for orgs with >60 public repos" in §1.1. However, the request budget formula in §2.3 shows even a modest user profile (50 repos, 5 T1, 10 T2) would consume ~80 API calls. An org like `skymavis` with 100+ repos would need 200–500+ calls — impossible within the 60/hr unauthenticated limit.

The spec says `Authorization: Bearer {token}` is optional ("omit for unauth"), but in practice **all non-trivial ingestion runs require authentication**. The spec should state this explicitly as a prerequisite, not just an option. The implementer needs to know: "have a GitHub PAT ready or you can only ingest very small profiles."

**Severity:** Advisory. The spec handles it implicitly (budget estimation warns before exceeding limits), but the prerequisite should be stated upfront in a "Prerequisites" section.

### A-7 (Advisory): `ingest_source` tool is not used in the workflow — clarify intent

The Second Brain MCP server provides an `ingest_source` tool (verified in `server/main.py` line 340) that indexes raw source documents in ChromaDB. The spec's workflow exclusively uses `write_page` for wiki generation (Stage 4) and `search_wiki` / `read_page` for cross-referencing and quality review. This is correct — `ingest_source` is for indexing external docs in `raw/`, not for wiki page creation.

However, the spec never mentions whether raw GitHub API responses or README contents should be preserved in `raw/` for future reference. For reproducibility: if a README contained patterns that were extracted, having the original in `raw/` would allow re-extraction without re-fetching from GitHub.

**Severity:** Advisory. Not a blocker — the current design works. But a `raw/{entity}/` archive step would improve auditability.

### W-3 (Warning): Checkpoint file location assumes filesystem access

The checkpoint file (§3.5) is stored at `checkpoints/{entity}-ingestion.json`, described as "outside wiki/ to avoid ChromaDB indexing." This is fine for manual workflow, but when the implementer runs this, the checkpoint path needs to be relative to a known base directory. The spec should specify: relative to the Second Brain vault root (`second-brain/checkpoints/`) or relative to the working directory.

### W-4 (Warning): `pushed_at` recency check has a timezone assumption

§5.1 uses "`pushed_at` within 6 months" and "within 12 months" for tier classification. The GitHub API returns `pushed_at` in ISO 8601 UTC format. The spec should specify that the comparison is against the current UTC date, not local time. This is a minor detail but affects determinism across timezones.

### W-5 (Warning): Pattern page file limit of 5 files per T1 repo may undercount

§4 Stage 3 limits T1 repos to "max 5 files." For repos like `karpathy/nanoGPT` (which has ~20 significant source files), 5 files may miss important patterns. The spec acknowledges this in Assumption A3 with an operator override, which is adequate. Noting for awareness.

---

## Carmack x Linus Assessment

### What This Spec Gets Right

This is a well-structured architect document. The endpoint table (§2) is the kind of precise enumeration Carmack would demand — every URL, every response field, every rate cost. The determinism guarantee (§5.3) shows systems thinking: two runs on the same data produce the same output, which means the workflow is testable and debuggable. The checkpoint/resume strategy (§3.5) is practical engineering — it handles the 80% case (abort at repo N, resume at repo N+1) without overengineering a full transaction log. The overwrite safety strategy (§7) using `ingestion_version` as a sentinel is clean and minimal. The field mapping table (§6.3) eliminates ambiguity about data flow. The verification log (§12) with 14 verified claims and 1 explicitly unverified claim is exactly the level of intellectual honesty that prevents "the spec says X but the API actually does Y" failures downstream.

### Linus Notes

The spec is long (688 lines) but not bloated — each section earns its length. The error handling table (§3.3) correctly separates "rate limited" (wait) from "forbidden" (skip) on 403 by checking `x-ratelimit-remaining`, which is a detail most specs miss. The license filtering table (§9.2) is practical: it doesn't refuse GPL code, it flags it. That's the right trade-off for a reference wiki.

One data structure concern: the checkpoint JSON (§3.5) stores `completed_repos` and `pending_repos` as arrays. For large orgs (500+ repos), searching `completed_repos` for "has this repo been processed?" is O(n). A set or object with repo names as keys would be O(1). This matters for implementer efficiency, not performance — but Linus would note it.

---

## Verdict Rationale

All 6 original blockers are **fully resolved** with thorough, implementable detail. All 5 advisories are **substantively addressed**. The new findings are 2 advisories and 3 warnings — none are blockers. The spec is ready for implementation.

The two advisories (A-6: auth prerequisite, A-7: raw archive) are quality-of-life improvements that the implementer can handle inline without architectural changes. The warnings are minor specification gaps that don't affect correctness.

**Verdict: PASS WITH CAVEATS**

Caveats:
1. **A-6:** Add a "Prerequisites" section stating that a GitHub PAT is effectively required for any non-trivial ingestion. The implementer should not discover this at runtime.
2. **A-7:** Consider adding an optional `raw/{entity}/` archive step for reproducibility. Not required for v1.

The spec may proceed to the implementer stage.

---

## Summary Table

| ID | Class | Summary | Status |
|----|-------|---------|--------|
| B-1 | Blocker | Full spec file exists | RESOLVED |
| B-2 | Blocker | API endpoints fully specified (11 endpoints, field mappings) | RESOLVED |
| B-3 | Blocker | Tier thresholds quantitative and deterministic | RESOLVED |
| B-4 | Blocker | Error handling + rate limits + checkpoint/resume | RESOLVED |
| B-5 | Blocker | Wiki page templates with frontmatter and field mapping | RESOLVED |
| B-6 | Blocker | Org vs user modes explicitly differentiated | RESOLVED |
| A-1 | Advisory | Overwrite safety via ingestion_version sentinel | ADDRESSED |
| A-2 | Advisory | Cross-reference scoring with threshold and calibration | ADDRESSED |
| A-3 | Advisory | Trusted source citations with substantive findings | ADDRESSED |
| A-4 | Advisory | Content trust model with license filtering | ADDRESSED |
| A-5 | Advisory | Exit criteria with graduation requirements | ADDRESSED |
| A-6 | Advisory | Auth token should be stated as prerequisite | NEW |
| A-7 | Advisory | Consider raw/ archive for reproducibility | NEW |
| W-3 | Warning | Checkpoint path needs base directory specified | NEW |
| W-4 | Warning | pushed_at comparison should specify UTC | NEW |
| W-5 | Warning | 5-file limit may undercount for large repos | NEW |
