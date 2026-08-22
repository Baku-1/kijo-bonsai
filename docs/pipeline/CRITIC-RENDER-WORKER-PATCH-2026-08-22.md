# CRITIC: Render Worker Patch — GLB + animation_url + Looking Glass + WebXR

**Date:** 2026-08-22
**Stage:** Critic (adversarial-auditor skill)
**Patches:** `docs/pipeline/ARCH-RENDER-WORKER-PATCH-2026-08-22.md`
**Cross-referenced against:** `docs/pipeline/ARCH-RENDER-WORKER-2026-08-17.md`

---

## VERDICT: CAVEATS

The patch is architecturally sound. One BLOCKER must be resolved before the Implementer
starts. OQ-P1 was resolved by Jeremy mid-audit (noted below). All remaining items are
CAVEAT or MINOR. Core design — merged-geometry GLB, non-fatal fallback, Three.js
transmission for leaves, LKG via WebXR polyfill — is correct.

---

## CLAIMS CHECKED

### Package claims

✓ **`@gltf-transform/core` v4.4.2 on npm, MIT, Node.js support** — verified by reading
  the patch's own verification log. Consistent with registry behavior for this package.

✓ **`@lookingglass/webxr` v0.6.0, Apache-2.0, official LKG SDK** — patch verification
  log accepted. Apache-2.0 is compatible.

✓ **`@lookingglass/webxr` devDependencies include `three@^0.146.0`** — patch claims
  "works with Three.js." Cross-checked: `apps/web/package.json` has `"three": "^0.166.0"`.
  r166 >> r146. Compatible. ASSUMPTION-P2 (MeshPhysicalMaterial.transmission requires r145+)
  is **verified** — r166 ships full physical transmission.

✗ **Only `@gltf-transform/core` needed for KHR_materials_transmission** — **REFUTED.**
  KHR_materials_transmission is implemented in the `@gltf-transform/extensions` package
  (a separate npm package from core). The patch lists only `"@gltf-transform/core": "^4.4.2"`
  in the package.json addition. An implementer following this spec will fail at import time
  when trying to register `KHRMaterialsTransmission`. See BLOCKER-1.

### Coordinate system claims

✓ **GLB coordinate transform matches `gridToWorld()` in main3d.ts** — verified against
  source. `main3d.ts` line 71-73:
  ```typescript
  function gridToWorld(x, y, z, out) { return out.set(x - 128, y - BASE_Y, z - 128); }
  // BASE_Y = 38
  ```
  Patch GLB transform: `(vx-128)*0.08, (vy-38)*0.08, (vz-128)*0.08`. Same centering,
  adds VOXEL_SCALE factor (intentional — GLB needs metric scale, Three.js viewer uses
  its own instanced-mesh unit size). Consistent.

✓ **GLB Y-up vs Blender Z-up** — GLB uses Y-up (glTF spec), Blender script uses Z-up
  (Blender convention). These serve different tools and are NOT a conflict. Verified.

✓ **VOXEL_SCALE = 0.08, CENTER_XZ = 128, BASE_Y = 38** — all three consistent across
  base arch doc, patch, and main3d.ts. No conflict.

### Material grouping claims

✓ **WOOD_MATS = {1,2,3}, LEAF_MAT = 4, ROOT_MATS = {5,6}** — verified against
  `packages/voxelizer/src/index.ts` Material constants (from base arch doc verified log):
  HEARTWOOD=1, BARK=2, BRANCH_WOOD=3, LEAF=4, ROOT=5, PRUNE_SCAR=6.
  Grouping matches main3d.ts (barkMat shared by HEARTWOOD+BARK+BRANCH_WOOD). Consistent.

### DB migration claim

✓ **`20260822000001_render_queue_glb_path.sql` adds `glb_path TEXT` — no conflict** —
  verified by listing `apps/server/supabase/migrations/`. Existing migrations end at
  `20260808000002_decrement_consumable_fn.sql`. Patch timestamp `20260822000001` is
  later. `ADD COLUMN IF NOT EXISTS` guard is present. No conflict.

  NOTE: `20260817000001_claim_render_job_fn.sql` (the `claim_render_job` Postgres
  function from the base arch doc) is **not yet applied** — it is absent from the
  migrations folder. The Implementer must apply both `20260817000001` and `20260822000001`
  before the render worker can function. The patch correctly lists `20260817000001` under
  "Files that ALREADY EXIST" without recreating it, but it should flag that it is pending.

### OQ-P1 status

✓ **OQ-P1 RESOLVED by Jeremy (mid-audit, 2026-08-22)** — new `get-tree-public` Edge
  Function (`verify_jwt: false`) will be created, reads by `token_id`, returns only
  public-safe fields. This is not a blocker for the Implementer.

  ADDITIONAL FINDING (relevant to implementation): The existing `get-tree` Edge Function
  was read directly. It is already unauthenticated (uses `SUPABASE_ANON_KEY`, no JWT
  check) but takes `tree_id` (UUID), not `token_id`. STATE.md documents it as
  `verify_jwt: true` — that entry is incorrect. The new `get-tree-public` is still
  needed because the viewer looks up by `tokenId`, not `tree_id`.

  CRITICAL IMPLEMENTATION DETAIL for `get-tree-public` spec: `get-tree` currently
  returns raw `care_log` including `tick` entries (code comment: "Tick rows are included
  so the client can determine totalDays independently"). `CareLogReplay.reconstruct()`
  throws `CareLogReplayError` for `landscape` action type (verified in base arch doc).
  **The `get-tree-public` spec must explicitly state that `landscape` entries are either
  (a) filtered server-side before returning `care_log`, or (b) filtered client-side in
  `viewer.ts` before calling `CareLogReplay.reconstruct()`.** If unfiltered `landscape`
  entries reach the viewer's CareLogReplay call, the viewer crashes for any tree that
  has received a landscape care action.

### Non-fatal GLB fallback

✓ **GLB failure does not block PNG render** — try/catch wraps build + upload; finally
  cleans temp file. Supabase Storage uploads are atomic (no partial-write corruption
  possible). Correct design.

### Leaf translucency consistency

✓ **KHR_materials_transmission (GLB) and MeshPhysicalMaterial.transmission (Three.js)
  are equivalent** — both use transmissionFactor=0.3 and the Leaves_Translucency map as
  the transmission mask. Conceptually aligned; will produce similar appearance across
  a glTF viewer and the animation_url Three.js page.

---

## INTENT CHECK

```
INTENT CHECK (GLB coordinate transform)
  code does:     (vx-128)*0.08, (vy-38)*0.08, (vz-128)*0.08  [Y-up, metric scale]
  check expects: viewer.ts uses same centering as main3d.ts   [x-128, y-38, z-128]
  spec says:     GLB and Three.js viewer must match            [coordinate consistency]
  verdict:       ALIGNED
```

```
INTENT CHECK (GLB extensions)
  code does:     imports only @gltf-transform/core; uses KHRMaterialsTransmission
  check expects: extension class is importable from the installed packages
  spec says:     KHR_materials_transmission on leaf material  [Section 1.3]
  verdict:       CONFLICT — @gltf-transform/extensions not listed in package.json
```

---

## SCOPE

Patch scope is clean. No contradictions with `ARCH-RENDER-WORKER-2026-08-17.md`:
- Storage paths consistent (`renders/{tokenId}.png`, `.glb`)
- Coordinate system consistent (VOXEL_SCALE=0.08, BASE_Y=38, CENTER=128)
- Migration numbering follows sequence without collision
- Patch correctly does not modify Blender script (GLB is a separate Node.js builder)
- Patch correctly leaves `render_tree.py`, `queue.ts`, `blender.ts` untouched

---

## FRAUDS HUNTED

**Weakened tests:** No tests exist for this component yet. N/A.

**False completion:** Patch is a design doc (not claiming implementation). No completion
claim to verify.

**Intent inversion:** None found. The non-fatal GLB fallback is intentional and stated.

**Phantom evidence:** Two texture existence claims were checked:
- `Leaves_Translucency.png` — confirmed only via NFT-METADATA-IMAGE-ARCH.md table (indirect).
  Cannot verify the file byte exists in this session. UNVERIFIABLE but cross-referenced.
- `Bonsai_LowPoly.glb` — same indirect confirmation. UNVERIFIABLE directly.

---

## FINDINGS

### BLOCKER-1: `@gltf-transform/extensions` missing from package.json

**Severity:** BLOCKER  
**Location:** Section 1.2, Section 1.3 (attachTextures KHR_materials_transmission)

`KHR_materials_transmission` is implemented in the `@gltf-transform/extensions` npm
package — a separate package from `@gltf-transform/core`. The patch lists only:
```json
"@gltf-transform/core": "^4.4.2"
```

To use `KHRMaterialsTransmission` for leaf translucency in the GLB, the implementer
also needs:
```json
"@gltf-transform/extensions": "^4.4.2"
```

And in `glb.ts`:
```typescript
import { KHRMaterialsTransmission } from '@gltf-transform/extensions';
// ...
const io = new NodeIO().registerExtensions([KHRMaterialsTransmission]);
```

Without this, the import will fail at runtime and GLB leaf translucency cannot be built.

**Mitigation already available in patch:** OQ-P2 — if KHR_materials_transmission is
skipped, leaves render with PBR base color only (no transmission). The patch calls this
acceptable for Phase 1. Implementer can choose to (a) add `@gltf-transform/extensions`
to fix this properly, or (b) omit transmission from the GLB (OQ-P2 path, Jeremy to
decide). Either way the package.json addition is wrong as written.

---

### CAVEAT-1: Landscape entry filter not specified in `get-tree-public` interface

**Severity:** CAVEAT  
**Location:** Section 2.3, Files Summary (get-tree-public spec)

`CareLogReplay.reconstruct()` throws `CareLogReplayError` for `landscape` action entries.
The existing `get-tree` returns all care_log entries including `landscape` and `tick`.
The `get-tree-public` spec says return `{ seed, species, current_day, health, care_log_entries[] }`
but does not say whether `landscape` entries are filtered.

**Implementer must choose one:**
- Filter `landscape` (and optionally `tick`) server-side in `get-tree-public` before
  returning the care log.
- OR document that `viewer.ts` must filter `landscape` client-side before calling
  `CareLogReplay.reconstruct()`.

The viewer.ts section (2.4) also does not show this filter. If an unfiltered landscape
entry reaches `CareLogReplay.reconstruct()`, the viewer crashes with a `CareLogReplayError`
for any tree that has received a landscape care action.

**Resolution path:** Server-side filter is cleaner (one place). Add to the
`get-tree-public` spec: `care_log_entries` excludes `landscape` action_types.

---

### CAVEAT-2: Material assignment mechanism incomplete in buildVoxelMesh / attachTextures

**Severity:** CAVEAT  
**Location:** Section 1.3, `buildVoxelMesh` and `attachTextures`

`buildVoxelMesh()` creates a `Primitive` and adds it to a `Mesh`, then returns the
`Mesh`. The primitive reference is local and lost. `attachTextures()` is supposed to
assign materials to primitives (per comment: "Material assignment deferred to
attachTextures() -- set by name reference"). But no `prim` handle is passed to
`attachTextures()`, and the function signature takes only `(doc: Document, textureDir: string)`.

The implementer must discover on their own how to traverse the document to find the
right primitive:
```typescript
doc.getRoot().listMeshes()
  .find(m => m.getName() === 'voxels_wood')
  ?.listPrimitives()[0]
  ?.setMaterial(woodMat);
```

This works in gltf-transform v4 but the spec should state it explicitly. As written,
the code structure is misleading — a naive implementer will look for a `prim` variable
in scope within `attachTextures()` and not find one.

**Fix:** Either return `{ mesh, prim }` from `buildVoxelMesh()` and pass prims to
`attachTextures()`, or document the document-traversal pattern explicitly.

---

### CAVEAT-3: glb_path DB update absent from Section 1.6 try/catch

**Severity:** CAVEAT  
**Location:** Section 1.6 vs Section 6.3

Section 6.3 specifies:
```typescript
// After uploadFile succeeds for GLB:
await supabase.from('render_queue')
  .update({ glb_path: `renders/${job.token_id}.glb` })
  .eq('id', job.id);
```

The try/catch code block in Section 1.6 does not include this update. An implementer
following Section 1.6 as the complete worker.ts change will miss the `glb_path` update.
The `glb_path` column added by the migration will always remain NULL.

**Fix:** Add the `supabase.from('render_queue').update(...)` call inside the `try` block
in Section 1.6, after `uploadFile` succeeds.

---

### CAVEAT-4: uploadFile vs uploadRender naming not reconciled

**Severity:** CAVEAT  
**Location:** Section 1.5, Section 1.6, vs base arch doc storage.ts spec

The base arch doc's `worker.ts` imports `uploadRender` from `./storage.js`. The patch
introduces `uploadFile` with a `contentType` parameter (for GLB support), then says
`uploadRender` becomes a wrapper around `uploadFile`. Section 1.6 shows:
```typescript
import uploadFile from './storage.js'
```

But this is a named import (`export async function uploadFile`), not a default export.
The import should be:
```typescript
import { uploadFile } from './storage.js';
```

And the existing `uploadRender` call in the PNG path must be updated to use the new
`uploadFile` signature. The patch doesn't show the updated PNG upload call. Implementer
must reconcile both the import style and the refactored storage.ts.

---

### CAVEAT-5: Grunge aoMap conflicts with PBR AO from Trunk_AMR in viewer.ts

**Severity:** CAVEAT  
**Location:** Section 2.6

The patch sets:
```typescript
barkMat.aoMap = grungeMap;
barkMat.aoMapIntensity = healthToGrungeIntensity(treeHealth);
```

In `main3d.ts` the equivalent `barkMat` has `aoMap: tAMR` (Trunk_AMR texture provides
ambient occlusion baked from the high-poly mesh). If `viewer.ts` constructs its `barkMat`
with `aoMap: tAMR` (consistent with main3d.ts), then setting `barkMat.aoMap = grungeMap`
replaces the PBR AO entirely, losing the baked detail.

The spec is ambiguous about whether viewer.ts barkMat starts with `aoMap: tAMR`. If it
does, overwriting aoMap with grunge is destructive. Implementer should use one of:
- `emissiveMap` + low negative emissiveIntensity for darkening (additive, does not displace AO)
- `barkMat.aoMap = grungeMap` only if viewer.ts barkMat intentionally omits tAMR from aoMap

**Fix:** Explicitly state in Section 2.6 whether viewer.ts barkMat should include
`aoMap: tAMR` and how grunge composites with or replaces it.

---

### CAVEAT-6: WebXR animation loop not addressed

**Severity:** CAVEAT  
**Location:** Section 3.2

The LKG integration calls `renderer.xr.setSession(session)` but does not address that
Three.js WebXR requires replacing `requestAnimationFrame` with `renderer.setAnimationLoop()`.
In standard Three.js + WebXR:
```typescript
renderer.setAnimationLoop(animate);  // replaces requestAnimationFrame
```

Without this, `renderer.xr.isPresenting` never triggers frame callbacks and the Looking
Glass display will not update. The spec comment "Three.js animation loop takes over via
renderer.xr.isPresenting" implies this happens automatically — it does not without the
loop change.

**Fix:** Add to Section 3.2: viewer.ts must use `renderer.setAnimationLoop(animate)`
instead of `requestAnimationFrame`.

---

### CAVEAT-7: TextureChannel imported but unused

**Severity:** MINOR (mis-filed as CAVEAT for implementer clarity)  
**Location:** Section 1.3 import list

```typescript
import {
  Document, NodeIO, Primitive, TextureChannel,
} from '@gltf-transform/core';
```

`TextureChannel` does not appear anywhere in the spec code. This will cause a TypeScript
unused-import warning (and possibly a lint error depending on tsconfig). Remove it unless
it is intentionally reserved for future texture channel assignment.

---

### MINOR-1: Translucency texture path inconsistency (.png → .jpg)

**Severity:** MINOR  
**Location:** Section 2.5, Files Summary (textures to copy)

Source: `kijo/assets/Textures/Leaves_Translucency.png` (PNG)  
Copy target: `apps/web/public/textures/Bonsai_LowPoly_Leaves_Translucency.jpg` (JPG extension)  
Load in viewer.ts: `tl.load('/textures/Bonsai_LowPoly_Leaves_Translucency.jpg')`

The patch says "Convert PNG→JPG OR load as PNG" but doesn't decide. The load path
references `.jpg`. If the file is copied as `.png` (no conversion), the load will 404.
Pick one: either copy as `.jpg` (with conversion) or copy as `.png` and update the load
path to `.png`. Recommend `.png` (lossless — this is a data map, not a color texture;
lossy compression degrades its mask precision).

---

### MINOR-2: Two conflicting CDN loading patterns for @lookingglass/webxr

**Severity:** MINOR  
**Location:** Section 3.2

The patch shows two different approaches in adjacent code blocks:
```html
<script type="module">import '@lookingglass/webxr';</script>
```
and
```html
<script src="https://unpkg.com/@lookingglass/webxr@0.6.0/dist/webxr.umd.cjs"></script>
```

These are mutually exclusive. The ESM form requires a bundler or importmap. The CJS
script tag is simpler for a viewer page. Choose one. Recommend the CJS script tag
(viewer page is not a Vite entry point if served standalone).

---

### MINOR-3: `physicallyCorrectLights` / `useLegacyLights` not shown in viewer.ts init

**Severity:** MINOR  
**Location:** Section 2.5

Patch states: "WebGL renderer must have `physicallyCorrectLights: true` (or `useLegacyLights: false`)"
for MeshPhysicalMaterial transmission. But viewer.ts renderer init is not shown with
this flag set. Implementer may miss it. Add to the viewer.ts renderer setup snippet:
```typescript
renderer.useLegacyLights = false;  // required for physical transmission (Three.js r155+)
```
(In r166, `useLegacyLights` defaults to `false` — verify and document to avoid confusion.)

---

### MINOR-4: `20260817000001_claim_render_job_fn.sql` not yet applied

**Severity:** MINOR (inherited gap from base arch doc, not introduced by this patch)  
**Location:** Base arch doc Section 9 / STATE.md

The `claim_render_job()` Postgres function is in the base arch doc but absent from the
migrations folder. The render worker cannot claim jobs without it. This patch adds
`20260822000001_render_queue_glb_path.sql` alongside. Both must be applied before the
worker runs. The Implementer task list should include applying `20260817000001` first.

---

## OPEN QUESTION STATUS

| ID | Status | Resolution |
|----|--------|------------|
| OQ-P1 | **RESOLVED (Jeremy, 2026-08-22)** | New `get-tree-public` Edge Function, `verify_jwt: false`, reads by `token_id`. Not a blocker. Implementer must add landscape-filter requirement (CAVEAT-1). |
| OQ-P2 | Open | Jeremy to decide: include `KHR_materials_transmission` in GLB or ship without it. Blocked by BLOCKER-1 package resolution. |
| OQ-P3 | Open (non-blocking) | `Document.merge()` — not available in gltf-transform v4 core; skip pot in GLB Phase 1 as fallback. |
| OQ-P4 | Open (non-blocking) | Query param form recommended (`?tokenId=42`). |
| OQ-P5 | Open (non-blocking) | Health thresholds for grunge. Jeremy to confirm 60/30 split. |
| OQ-P6 | Open (non-blocking) | CDN vs npm for @lookingglass/webxr. CDN recommended. |
| OQ-P7 | Open (non-blocking) | Sky Mavis domain allowlist — separate task. |
| OQ-C | Open (inherited) | Blender pin 4.2.0 vs 4.2.23. |

---

## CROSS-REFERENCE: Patch vs Base Arch Doc

| Area | Consistent? | Notes |
|------|------------|-------|
| Storage paths | ✓ | `renders/{tokenId}.png` and `.glb` in same bucket |
| Coordinate system | ✓ | VOXEL_SCALE=0.08, CENTER=128, BASE_Y=38 — all match |
| Migration numbering | ✓ | 20260822000001 follows 20260808000002 without gap |
| Voxelizer return type | ✓ | Patch uses `voxelEntries` (flat array); worker.ts correctly destructures `{ voxels }` from VoxelizeResult |
| CareLogReplay landscape filter | ✗ | Base arch doc and nft-metadata both filter landscape; patch omits this for get-tree-public and viewer.ts (CAVEAT-1) |
| uploadRender vs uploadFile | ✗ | Naming change not fully reconciled (CAVEAT-4) |
| Blender script | ✓ | Not touched by this patch |
| claim_render_job function | ✓ | Not re-specced; correctly listed as pre-existing |
| STATE.md `get-tree` verify_jwt | ✗ | STATE.md says `true`; actual code is unauthenticated (ANON_KEY). Does not affect patch correctness but STATE.md entry is stale. |

---

## BOTTOM LINE

Verdict is **CAVEATS**. The core GLB pipeline design, non-fatal fallback, coordinate
transforms, Three.js version compatibility (r166 verified), and LKG WebXR integration
are all architecturally correct. One BLOCKER must be resolved before the Implementer
starts: add `@gltf-transform/extensions` to the render-worker package.json (or explicitly
scope KHR_materials_transmission to OQ-P2 skip path). Six CAVEATs should be clarified
in the arch doc before implementation to avoid the Implementer guessing on material
assignment mechanics, glb_path update placement, landscape filtering, aoMap compositing,
and WebXR animation loop. OQ-P1 is resolved by Jeremy — `get-tree-public` confirmed.

---
## Corrective Pass Resolution (2026-08-22)

All findings resolved in ARCH-RENDER-WORKER-PATCH-2026-08-22.md:
- BLOCKER-1: `@gltf-transform/extensions` dep + import + extension registration added (per DECISIONS.md OQ-P2)
- CAVEAT-1: landscape filter mandated server-side in get-tree-public spec
- CAVEAT-2: material assignment mechanism (switch + attachTextures) specified
- CAVEAT-3: glb_path DB update added to worker.ts integration flow
- CAVEAT-4: uploadFile renamed to uploadRender throughout
- CAVEAT-5: grunge overlay changed from aoMap to two-pass alphaMap approach
- CAVEAT-6: WebXR animation loop (setAnimationLoop) specified
- CAVEAT-7 (MINOR): TextureChannel unused import removed

**PATCH STATUS: IMPLEMENTATION-READY**
