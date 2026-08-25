# ⚡ Code Review: Placeholder PNG pivot from Supabase Storage to GitHub Releases

## The Verdict

This is a clean, minimal pivot. Three files changed, all doing exactly what the decision requires, no scope creep. The code quality of `nft-image/index.ts` is high — the never-404 contract is enforced at every branch, the HEAD check has a timeout, and the fallback behavior is correct. The upload script integration is solid. But there is one architectural concern that matters: **GitHub Releases URLs are not direct-serve — they issue a 302 to `objects.githubusercontent.com`**, meaning Ronin Market crawlers following your 302 will hit a *second* 302 before reaching the actual PNG. Most HTTP clients follow redirect chains, but this is an NFT marketplace crawler whose behavior you don't control. The risk is low but the blast radius is high (every unminted token shows broken image).

## ⚠️ Logic & Security Context

- **Invariant: never 404/500.** The Edge Function upholds this — every code path returns a 302. But the *target* of that 302 can itself fail. Previously the target was Supabase CDN (same infrastructure, high availability). Now the placeholder target is GitHub's CDN (different infrastructure, no SLA to you). The function itself is correct; the availability guarantee now extends to a third-party dependency.

- **Trust model:** Public endpoint, no auth, no mutation. Correct. The PLACEHOLDER_URL is a hardcoded constant (not user-controllable) — no SSRF vector. GitHub Release URLs for public repos require no authentication.

- **State ordering:** N/A — this is a stateless redirect function. No check-then-act concerns.

- **Security posture of GitHub URL vs Supabase Storage:** No meaningful difference. Both are unauthenticated CDN URLs. The GitHub URL is slightly more exposure (reveals the repo name and tag in the URL visible in marketplace HTML source), but the repo is already public. Non-issue.

## 🕹️ Carmack's Notes

**The double-redirect problem.** `https://github.com/{owner}/{repo}/releases/download/{tag}/{file}` does NOT serve the file directly. GitHub returns a 302 to `https://objects.githubusercontent.com/github-production-release-asset-...?X-Amz-...` with a time-limited signed URL. Your Edge Function emits:

```
Client → 302 → github.com/...placeholder.png → 302 → objects.githubusercontent.com/...?sig=...
```

This is a two-hop redirect chain. The `Cache-Control: public, max-age=60` on your 302 caches the *redirect*, not the image. The second GitHub 302 has its own short-lived signed URL (typically 5–10 minutes). If a CDN or reverse proxy caches your 302 and then a client follows the cached redirect to GitHub, GitHub may re-issue a fresh signed URL — or it may serve from CDN cache. The behavior is not documented by GitHub and not guaranteed.

**Concrete risk:** If Ronin Market's crawler does not follow 302 chains (some scrapers only follow one hop, treating the Location header as the final URL and then doing a separate fetch), it would try to render `github.com/.../placeholder.png` as an image — which is an HTML page, not a PNG. This would show as a broken image.

**Mitigation (not a blocker for merge, but do before mainnet):** Test the actual Ronin Market indexer behavior. Mint a token with no render, wait for the crawler, check if the placeholder appears. If it doesn't, the fix is to download `placeholder.png` from GitHub Releases at Edge Function cold-start time (or at deploy time) and serve it from Supabase Storage `renders/placeholder.png` — effectively using GitHub Releases as the *source of truth* but Supabase as the *serving layer*. This is a 10-line change.

**Performance note:** The HEAD check to Supabase Storage has a 3-second timeout. Good. But on the placeholder path, there's no prefetch or caching of the placeholder URL validity. If GitHub is down, every unminted token's image breaks simultaneously. With Supabase Storage, at least the placeholder was co-located with the render infrastructure — one dependency, not two. This is an accepted tradeoff given the free-tier constraint, but it should be documented as a known risk.

**tokenId parsing edge case:** `parseInt("00000001", 10)` returns `1` — correct. `parseInt("9007199254740993", 10)` returns `9007199254740992` (precision loss past `Number.MAX_SAFE_INTEGER`). Academic for now (you won't mint 2^53 tokens), but if you ever care, `BigInt(raw)` is the correct parse.

## 🐧 Linus's Notes

**The upload script is well-structured.** Preflight checks are thorough, `set -euo pipefail` is correct, `placeholder.png` is unconditional (not optional like `POT_GLB`). The `--clobber` flag on re-upload is the right choice. Good.

**Release notes don't mention placeholder.png.** Lines 107–112 of `upload-blender-assets.sh` list the release notes for `gh release create`:
```
- Bonsai-Raw.blend: base scene...
- Textures.zip: PBR texture maps...
- Bonsai_LowPoly.glb: pot base mesh (if included)
```
No mention of `placeholder.png`. Anyone looking at the release page won't know why it's there or what depends on it. Minor, but Linus would call this lazy documentation — if an asset is load-bearing for a production endpoint, say so in the release notes.

**Arch doc divergence not updated.** `NFT-METADATA-IMAGE-ARCH.md` line 34 still says: `Placeholder image | /renders/placeholder.png in Supabase Storage`. Lines 766–769 still specify placeholder as a Supabase Storage path. The DECISIONS.md entry documents the departure, but the arch doc itself is stale. This means the next implementer who reads the arch doc without reading every DECISIONS.md entry will build against the wrong spec. DECISIONS.md is an append-only log, not a living spec — it records *that* a decision was made, not what the current state *is*. The arch doc should be updated or at minimum cross-referenced.

**The `nft-image/index.ts` code is clean.** Comments are precise and useful (especially the "Spec: never 404/500" note at line 59). The CORS preflight handling is correct. The redirect helper with configurable TTL is good API design. The error logging on HEAD failure (line 87) is the right call — log for debugging but never surface to the caller.

**One readability nit:** The comment at line 15 says "placeholder.png is hosted on GitHub Releases (blender-assets-v1 tag) because it exceeds Supabase free-tier's 50 MB per-file upload limit." This is factually precise and exactly the right information density. Good.

## What This Code Gets Right

1. **The never-404 contract is airtight.** Every branch — invalid tokenId, non-GET method, HEAD check failure, network timeout — returns a 302 to placeholder. No path reaches a 4xx or 5xx. This is the most important invariant and it's preserved.

2. **Minimal diff.** Three files, no unnecessary refactoring, no new dependencies. The PLACEHOLDER_URL change is a single line. The upload script changes are additive and don't disturb existing asset handling. This is how infrastructure pivots should look.

3. **Consistent with precedent.** The 2026-08-22 Blender assets pivot established GitHub Releases as the hosting layer for oversized assets. This change extends that decision to one more file. The DECISIONS.md entry correctly references the precedent.

4. **Upload script makes placeholder mandatory.** `PLACEHOLDER_PNG` is in the unconditional section of `UPLOAD_FILES`, not behind the `if [ -f "$POT_GLB" ]` conditional. The preflight check exits 1 if it's missing. This means you can't accidentally upload a release without the placeholder — which would silently break every unminted token's image.

5. **Short TTL on placeholder redirect (60s).** Once a render completes, the marketplace re-fetches within a minute. The 600s TTL on rendered images is also correct — rendered images are stable.

## Critical Fixes (Priority Order)

### 1. Verify Ronin Market crawler follows 302 chains

**What:** Before mainnet, confirm that Ronin Market's indexer correctly resolves the double-redirect (your Edge Function → GitHub → `objects.githubusercontent.com`).

**Why:** If the crawler doesn't follow the chain, every unminted token shows a broken image. This is a silent failure — no error in your logs, no 500, just a marketplace rendering an HTML page as an image.

**How:** Mint a test token on Saigon testnet (no render in Storage), wait for the Ronin Market indexer to crawl, check if the placeholder image renders. If it doesn't:

```typescript
// Alternative: download placeholder at deploy time, serve from Storage
// Add to a setup script or migration:
// 1. curl -L -o /tmp/placeholder.png $GITHUB_RELEASE_URL
// 2. supabase storage upload renders/placeholder.png /tmp/placeholder.png
// Then PLACEHOLDER_URL stays as STORAGE_BASE + '/placeholder.png'
```

This would use GitHub Releases as the source but Supabase Storage as the serving layer, eliminating the double-redirect.

### 2. Update release notes in upload script

**What:** Add `placeholder.png` to the `gh release create --notes` text.

**Why:** The release page is the human-readable manifest of what's in the release and why. A production-critical asset should be documented there.

**How:**
```bash
# In the --notes block, add after "Bonsai_LowPoly.glb" line:
--notes "Blender assets for the kijo render worker (Railway Docker build).
- Bonsai-Raw.blend: base scene with template objects and lighting
- Textures.zip: PBR texture maps for GLB builder
- Bonsai_LowPoly.glb: pot base mesh (if included)
- placeholder.png: NFT image fallback (nft-image Edge Function redirects here)

These files are downloaded at Docker build time by apps/render-worker/Dockerfile."
```

### 3. Update or cross-reference the arch doc

**What:** Add a note to `NFT-METADATA-IMAGE-ARCH.md` line 34 and/or lines 766–769 indicating the placeholder location has been pivoted to GitHub Releases per DECISIONS.md 2026-08-25.

**Why:** The arch doc is the primary spec document. A stale spec is a latent bug generator. The next implementer who reads the arch doc will assume Supabase Storage.

**How:** In the decision summary table (line 34), change:
```
| Placeholder image | `/renders/placeholder.png` in Supabase Storage | → GitHub Releases (DECISIONS.md 2026-08-25) |
```

### 4. Update STATE.md (auditor CAVEAT-A)

**What:** Update `STATE.md` last-updated date to 2026-08-25.

**Why:** Pipeline discipline. Auditor flagged this.

**How:** One-line date change.
