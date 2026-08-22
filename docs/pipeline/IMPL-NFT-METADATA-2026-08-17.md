# IMPL: nft-metadata + nft-image Edge Functions

**Date:** 2026-08-17
**Stage:** Implementer
**Pipeline stage prior:** Architect (NFT-METADATA-IMAGE-ARCH.md, DRAFT v5)
**Auditor:** Pending

---

## Scope

Two new Supabase Edge Functions:

| Function | Path | Purpose |
|----------|------|---------|
| `nft-metadata` | `GET /nft/metadata/{tokenId}` | ERC-721 metadata JSON (Ronin Market schema) |
| `nft-image` | `GET /nft/image/{tokenId}` | 302 redirect to Supabase Storage render |

Plus supporting infrastructure:

| File | Purpose |
|------|---------|
| `apps/server/supabase/functions/_shared/build-edge.sh` | esbuild bundle script |
| `apps/server/supabase/functions/_shared/kijo-engine.js` | Committed ESM bundle (64,831 bytes) |

---

## OQ Closures (Inputs from Jeremy)

| OQ | Status | Resolution |
|----|--------|------------|
| OQ-1 | CLOSED | Bonsai-Raw.blend template objects already set up by Jeremy |
| OQ-6 | KNOWN | Project ref = `xutjubkaskwchzyzwryk`; storage URL = `https://xutjubkaskwchzyzwryk.supabase.co/storage/v1/object/public/renders/{tokenId}.png` |
| OQ-7 | CLOSED | NFT images exist at `kijo/assets/images/` -- use as placeholder source. Upload to renders bucket as `placeholder.png` before first deploy. |
| OQ-3 | PARTIAL | Species Sub-type and Leaf Color are seed-deterministic placeholder values (see CAVEATS). |
| OQ-4 | CLOSED | TechniqueClassifier is built and exported from `@kijo/engine`. |

---

## Files Changed

### NEW: `apps/server/supabase/functions/_shared/build-edge.sh`

esbuild script that bundles `@kijo/engine` + `@kijo/voxelizer` into a single ESM file.

**Why a temp entry file at repo root:**
- esbuild 0.21.5 does not support `--stdin-resolve-dir` (removed; CLI flag invalid)
- `@kijo/engine` resolves via `node_modules/@kijo` symlinks at repo root
- Entry file must be at repo root for package resolution to work
- Script writes `_kijo_bundle_entry_tmp.js` at repo root, uses `trap EXIT` for cleanup

**Re-run when:** any `@kijo/engine` or `@kijo/voxelizer` source changes.

### NEW: `apps/server/supabase/functions/_shared/kijo-engine.js`

esbuild ESM bundle. 64,831 bytes. Verified exports:
`BonsaiTree, CareLogReplay, CareLogReplayError, StatDeriver, TechniqueClassifier, Voxelizer, VoxelRole`
(plus all supporting symbols from engine and voxelizer).

Committed to the repo so Deno can import it at cold-start with no npm install step.

### NEW: `apps/server/supabase/functions/nft-metadata/index.ts` (362 lines)

Full GET /nft/metadata/{tokenId} implementation.

**Request pipeline:**
1. tokenId validation: `/^\d+$/.test(raw)` + `parseInt > 0` -> 404 if invalid
2. Service-role Supabase client (bypasses RLS)
3. Query `trees WHERE token_id = $tokenId` -> 404 if no row
4. Query `care_log_entries WHERE tree_id = $treeId ORDER BY game_day, sequence`
5. Build two care log arrays:
   - `careLogFull`: excludes `tick` only -- for TechniqueClassifier (needs landscape count)
   - `careLogReplay`: excludes `tick` + `landscape` -- for CareLogReplay (Phase 1 limit)
6. Day-0 branch: `totalDays <= 0` -> `new BonsaiTree(seed, species)` (CareLogReplay throws for 0)
7. `Voxelizer.voxelize(bonsai)` -> destructure `{ voxels, zones }`
8. `StatDeriver.derive(bonsai, voxels, seed, ageDays, zones)` -- 5 args (arch doc showed 4; actual impl requires `zones` for zone-jitter fix)
9. `TechniqueClassifier.classify(careLogFull, totalDays)` -> technique label
10. Assemble ERC-721 metadata JSON

**Key design decisions:**

| Decision | Rationale |
|----------|-----------|
| Service role client | Public endpoint -- no user JWT; service role bypasses RLS for DB reads |
| Two care log arrays | CareLogReplay throws `CareLogReplayError` for `landscape` (Phase 1 limit). TechniqueClassifier needs landscape for `landscapeCount`. Split at filter time. |
| `ageDays` = calendar days since `born_at` | Not game days (`current_day`). StatDeriver.wisdom uses real-time age gates, not game-day gates. |
| `totalDays` = `current_day` (game days) | TechniqueClassifier age-gates use game days for action frequency ratios. |
| Health Average = `bonsai.getHealth()` | Phase 1 proxy. No per-tick health history stored in DB. Noted as caveat. |
| Trust boundary: DB errors -> `{"error":"internal error"}` | Never expose raw Supabase error messages to Ronin Market crawlers. |
| `Cache-Control: public, max-age=300` | 5-minute edge cache. Metadata changes only on care actions; short TTL prevents staleness while reducing cold-start load. |

**Flower Guild Rank thresholds (GDD s7.3):**

| matchPct x100 | Rank |
|---|---|
| 0-19 | Seedling |
| 20-39 | Sapling |
| 40-59 | Pruned |
| 60-74 | Styled |
| 75-89 | Exhibition |
| 90-100 | Master Work |

### NEW: `apps/server/supabase/functions/nft-image/index.ts` (94 lines)

GET /nft/image/{tokenId} -- always 302, never 404/500.

**Design:**
- Validates tokenId; invalid -> 302 to placeholder (never 404)
- HEAD checks `renders/{tokenId}.png` in Supabase Storage (public bucket, no auth needed)
- If exists (2xx): 302 to render URL with `max-age=600` (render doesn't change often)
- If not: 302 to `renders/placeholder.png` with `max-age=60` (retry soon)
- `AbortSignal.timeout(3_000)`: HEAD check never blocks Ronin Market crawlers more than 3s

**Pre-deploy requirement (BLOCKER):**
Upload `kijo/assets/images/<chosen .png>` to Supabase Storage as `renders/placeholder.png`
before enabling `nft-image`. Until uploaded, the placeholder redirect returns 404 from Supabase CDN.

---

## Known API Deviations from Arch Doc

| Arch Doc Claim | Actual Implementation | Source Verified |
|---|---|---|
| `StatDeriver.derive(tree, voxels, seed, ageDays)` -- 4 args | `StatDeriver.derive(tree, voxels, seed, ageDays, zones)` -- 5 args | Read `packages/engine/src/StatDeriver.ts` |
| `Voxelizer.voxelize(tree)` returns `SparseVoxelSet` | Returns `VoxelizeResult { voxels, zones }` | Read `packages/voxelizer/src/index.ts` |
| `TechniqueClassifier.classify(log)` -- 1 arg (implied) | `TechniqueClassifier.classify(careLog, treeAgeDays)` -- 2 args | Read `packages/engine/src/TechniqueClassifier.ts` |

---

## Caveats (Jeremy Sign-off Required)

### CAVEAT-1: OQ-3 -- Species Sub-type and Leaf Color are placeholder values

The arch doc specifies these as NFT traits but does not define lookup tables or generation logic.

Current implementation uses seed-deterministic values:
- `subtype = SPECIES_SUBTYPES[species][seed % 4]`
- `leafColor = LEAF_COLORS[seed % 5]`

Invented values per species (not GDD-specified). Jeremy must confirm or replace before mainnet.

### CAVEAT-2: Health Average is current health, not historical average

A true historical average requires per-tick health snapshots in the DB -- not stored in Phase 1.
Proxy: `Math.round(bonsai.getHealth())` (current health after full reconstruction).
Acceptable for Phase 1; revisit when tick-snapshot table is added.

### CAVEAT-3: `renders/placeholder.png` must be uploaded before nft-image is live

The placeholder fallback redirects to `renders/placeholder.png` in Supabase Storage.
This object does not yet exist in the bucket. Deploy blocker for nft-image.
Source file: any PNG in `kijo/assets/images/`.

### CAVEAT-4: nft-metadata and nft-image not yet deployed

Both functions are written but not yet deployed via `supabase functions deploy`.
Netlify proxy routing (`/nft/metadata/*` -> nft-metadata, `/nft/image/*` -> nft-image)
has not been configured. Both are required before Ronin Market can crawl metadata.

### CAVEAT-5: cache-control on metadata

`max-age=300` (5 min). If a player performs a care action, their NFT metadata on Ronin Market
may lag by up to 5 minutes. Acceptable for Phase 1.

---

## Verified By Observation

| Check | Command | Result |
|-------|---------|--------|
| build-edge.sh exit | `bash build-edge.sh` | exit 0 |
| kijo-engine.js size | `wc -c kijo-engine.js` | 64,831 bytes |
| kijo-engine.js exports | `node --input-type=module < check.mjs` | BonsaiTree, CareLogReplay, CareLogReplayError, StatDeriver, TechniqueClassifier, Voxelizer, VoxelRole all present |
| nft-metadata line count | `wc -l nft-metadata/index.ts` | 362 |
| nft-metadata tail | `tail -5 nft-metadata/index.ts` | `return jsonOk(metadata); });` |
| nft-image line count | `wc -l nft-image/index.ts` | 94 |
| nft-image tail | `tail -5 nft-image/index.ts` | `return redirect302(PLACEHOLDER_URL, 60); });` |

---

## Not Done (Auditor Scope)

- Deno type-check (`deno check nft-metadata/index.ts`) -- requires Deno install
- Live HTTP test against deployed function
- Ronin Market metadata schema validation
- Confirm `renders` bucket exists and is public in Supabase project
- Upload `placeholder.png` to renders bucket

---

## Next Steps (Post-Audit)

1. Jeremy uploads `placeholder.png` to `renders` bucket (CAVEAT-3)
2. `supabase functions deploy nft-metadata` + `supabase functions deploy nft-image`
3. Add Netlify proxy routes: `/nft/metadata/*` and `/nft/image/*`
4. Confirm Ronin Market test: `curl https://api.kijo.xyz/nft/metadata/1`
5. OQ-3 resolution: Jeremy confirms or replaces Species Sub-type / Leaf Color lookup tables
