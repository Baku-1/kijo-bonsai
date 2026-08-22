# AUDIT: Render Worker — GLB + animation_url + Looking Glass

**Date:** 2026-08-22
**Stage:** Auditor (adversarial-auditor skill)
**Audits:** docs/pipeline/ARCH-RENDER-WORKER-2026-08-17.md + ARCH-RENDER-WORKER-PATCH-2026-08-22.md
**Implementer report:** STATE.md (2026-08-22 entry)

---

## VERDICT: VERIFIED WITH CAVEATS

Core render-worker pipeline is correct and TypeScript-clean. One file created by this
task (`apps/web/src/viewer.ts`) contains a TS error on line 134 that prevents `apps/web`
from compiling. The error is a one-line fix. All other mandatory checks pass.

---

## CLAIMS CHECKED

```
RENDER-WORKER TSC:
  ✓ npx tsc --noEmit from apps/render-worker/ → EXIT 0
    observed: ran directly, zero output, exit code 0

APPS/WEB TSC:
  ✗ Implementer caveat: "OrbitControls ESM import path needs verification"
    ACTUAL ERROR (different from predicted):
      src/viewer.ts(134,12): error TS2339: Property 'useLegacyLights' does not
      exist on type 'WebGLRenderer'.
    apps/web tsc --noEmit exits 2.
    OrbitControls import IS correct (no error on that import).
    The error is on viewer.ts line 134: `renderer.useLegacyLights = false`
    Three.js r166 removed this property in r155; physically correct lights
    are the default from r155+. The property assignment silently does nothing
    at runtime but fails TypeScript compilation.
    viewer.ts is in-scope (created by this task).
    Pre-existing errors in tree_mesh.ts (LEAF_COLORS, BARK_COLORS,
    RARE_COLOR_CHANCE) predate this task and are not in scope.

MATH.RANDOM():
  ✓ Absent from glb.ts, worker.ts, viewer.ts, render_tree.py
    observed: grep -rn "Math\.random()" returned no matches (exit 1)
    Only appears in code comments (not calls)

SPATIALLY-HASH EQUIVALENCE:
  ✓ Python spatial_hash in render_tree.py is algorithmically identical to
    TypeScript spatialHash in packages/shared/src/index.ts
    Verified step by step:
      TS:   packed = ((x & 0xFF) << 16) | ((y & 0xFF) << 8) | (z & 0xFF)
      Py:   packed = ((x & 0xFF) << 16) | ((y & 0xFF) << 8) | (z & 0xFF)  ✓
      TS:   h = (seed ^ packed) >>> 0
      Py:   h = (seed ^ packed) & 0xFFFFFFFF                               ✓
      TS:   h = (h += 0x6D2B79F5) >>> 0
      Py:   h = (h + 0x6D2B79F5) & 0xFFFFFFFF                             ✓
      TS:   h = Math.imul(h ^ (h >>> 15), h | 1) >>> 0
      Py:   h = ((h ^ (h >> 15)) * (h | 1)) & 0xFFFFFFFF                  ✓
      TS:   h ^= h + (Math.imul(h ^ (h >>> 7), h | 61) >>> 0)
      Py:   h = (h ^ (h + ((h ^ (h >> 7)) * (h | 61) & 0xFFFFFFFF))) & 0xFFFFFFFF ✓
      TS:   return (h ^ (h >>> 14)) >>> 0
      Py:   h = (h ^ (h >> 14)) & 0xFFFFFFFF; return h / 4294967296.0     ✓
      normalization: Python divides by 2^32 for [0,1) leaf rotation — correct ✓

LANDSCAPE FILTER — worker.ts:
  ✓ EXCLUDED_ACTIONS = new Set(['tick', 'landscape']) at line 57
    buildCareLog() filters before CareLogReplay.reconstruct() call
    observed: read file directly

LANDSCAPE FILTER — viewer.ts:
  ✓ EXCLUDED_ACTIONS = new Set<CareAction['type']>(['tick', 'landscape']) at line 80
    reconstructTree() filters before CareLogReplay.reconstruct() call
    observed: read file directly

LANDSCAPE FILTER — get-tree-public/index.ts:
  ✓ .not('action_type', 'in', '("landscape","tick")') at line 76
    server-side filter before returning care_log_entries
    observed: read file directly

GLB PATH UPDATE ORDER:
  ✓ glb_path DB update happens BEFORE PNG step
    worker.ts lines 148-174: GLB try block (build → upload → DB update → cleanup)
    worker.ts line 177: PNG Blender invoke begins AFTER GLB try block
    GLB is inside non-fatal try/catch — PNG continues if GLB fails ✓
    glb_path update at lines 163-167 inside the try (not in finally) ✓
    finally only cleans up temp file ✓

UPLOAD FUNCTION NAME:
  ✓ uploadRender is the function name in storage.ts (line 13)
    observed: read file directly

RENDERER.SETANIMATIONLOOP:
  ✓ renderer.setAnimationLoop(render) used at line 305 in viewer.ts
    Also used at line 338 inside the LKG button click handler
    No bare requestAnimationFrame() call in render loop ✓

VOXEL_SCALE / CENTER / BASE_Y:
  ✓ render_tree.py: VOXEL_SCALE=0.08, CENTER=128, BASE_Y=38 (lines 40-43)
  ✓ glb.ts: VOXEL_SCALE=0.08, CENTER_XZ=128, BASE_Y=38 (lines 20-22)
  ✓ viewer.ts: VOXEL_SCALE=0.08, CENTER=128, BASE_Y=38 (lines 27-29)
  Z-up mapping in render_tree.py: Blender Z = voxel_y * VOXEL_SCALE (not centered) ✓

ALL 14 FILES EXIST:
  ✓ apps/render-worker/Dockerfile
  ✓ apps/render-worker/package.json
  ✓ apps/render-worker/tsconfig.json
  ✓ apps/render-worker/src/queue.ts
  ✓ apps/render-worker/src/storage.ts
  ✓ apps/render-worker/src/blender.ts
  ✓ apps/render-worker/src/glb.ts
  ✓ apps/render-worker/src/worker.ts
  ✓ apps/render-worker/scripts/render_tree.py
  ✓ apps/server/supabase/functions/get-tree-public/index.ts
  ✓ apps/server/supabase/migrations/20260817000001_claim_render_job_fn.sql
  ✓ apps/server/supabase/migrations/20260822000001_render_queue_glb_path.sql
  ✓ apps/web/src/viewer.ts
  ✓ apps/web/index-viewer.html
  All exist on disk. observed: read each file directly.

DECISIONS.MD 2026-08-22:
  ✓ Two entries present at ## 2026-08-22:
    - GLB + KHR_materials_transmission leaf translucency decision
    - Landscape voxel display deferred post-beta decision
  observed: grep -n "2026-08-22" DECISIONS.md

MIGRATION FILES:
  ✓ 20260817000001_claim_render_job_fn.sql: CREATE OR REPLACE FUNCTION
    public.claim_render_job() ... FOR UPDATE SKIP LOCKED ... RETURNING *
    Matches spec exactly.
  ✓ 20260822000001_render_queue_glb_path.sql: ALTER TABLE public.render_queue
    ADD COLUMN IF NOT EXISTS glb_path TEXT
    Matches spec exactly.

KHR_MATERIALS_TRANSMISSION PATTERN:
  ✓ glb.ts imports: KHRMaterialsTransmission, Transmission from @gltf-transform/extensions
    (STATE.md notes post-audit fix: import split to match v4 API)
  ✓ Usage pattern:
    txExt = doc.createExtension(KHRMaterialsTransmission)        // register
    txProp = txExt.createTransmission().setTransmissionFactor(0.3) // property
    leafMat.setExtension('KHR_materials_transmission', txProp)    // attach
    This is the correct gltf-transform v4 setExtension() pattern ✓
  ✓ Registered before io.writeBinary() ✓

GIT COMMANDS:
  ✓ No git commands observed. No commits found.
```

---

## INTENT CHECK

```
INTENT CHECK — viewer.ts useLegacyLights
  code does:     renderer.useLegacyLights = false (line 134, apps/web/src/viewer.ts)
  check expects: npx tsc --noEmit (apps/web) exits 0
  spec says:     viewer.ts must use renderer.setAnimationLoop and MeshPhysicalMaterial
                 with transmission=0.3; spec does not mention useLegacyLights
  verdict:       CONFLICT
  analysis:      Three.js r166 is used (package.json: "three": "^0.166.0").
                 useLegacyLights was removed in r155 — physically correct lights
                 are the default from r155+. The property does not exist.
                 Code comment says "required for MeshPhysicalMaterial transmission"
                 but this is incorrect for r155+. Property must be removed.
                 Fix: delete line 134. No runtime behavior change (default is correct).
```

---

## SCOPE

```
In scope (created by this task): 14 files listed above
Pre-existing (not in scope): tree_mesh.ts errors (LEAF_COLORS, BARK_COLORS,
  RARE_COLOR_CHANCE) — these were not introduced by this task

viewer.ts TS error IS in scope. The Implementer acknowledged apps/web tsc was
not run, which is the gap this finding closes.
```

---

## FRAUDS HUNTED

```
weakened tests:    none — no test suite for this pipeline
false completion:  none — STATE.md claims tsc exits 0 for render-worker only (TRUE).
                   apps/web tsc was explicitly disclosed as unchecked (Caveat #1).
intent inversion:  none found in logic; the useLegacyLights line is a wrong-API
                   call, not an inversion of a spec requirement.
phantom evidence:  MINOR — Implementer's Caveat #1 predicted "OrbitControls ESM
                   import path" as the likely issue. Actual issue is useLegacyLights.
                   OrbitControls import IS correct. The predicted bug and actual bug
                   are different. This is not fraud — it's a misprediction in the
                   caveat. Worth noting: the Caveat was honest about the gap, just
                   wrong about the cause.
```

---

## IMPLEMENTER CAVEATS — VERIFIED OR REFUTED

```
1. apps/web tsc --noEmit not run (OrbitControls ESM import path needs verification)
   STATUS: PARTIALLY CORRECT — tsc WAS not run (confirmed). But the actual TS error
   found is useLegacyLights (line 134), not OrbitControls. OrbitControls import
   ('three/examples/jsm/controls/OrbitControls.js') is correct for r166.

2. Pot mesh GLB merge deferred (Document.merge() absent in gltf-transform v4)
   STATUS: CONFIRMED — glb.ts reads potDoc and logs presence of nodes but explicitly
   defers deep merge: "Full node/mesh/material copy requires deep traversal; for Phase 1
   we log the pot's presence and skip deep merge." Consistent with spec OQ-P3 fallback.

3. No SRI on @lookingglass/webxr CDN script in index-viewer.html
   STATUS: CONFIRMED — index-viewer.html line 27:
   <script src="https://unpkg.com/@lookingglass/webxr@0.6.0/dist/bundle/lookingglass-webxr.min.js">
   No integrity= attribute. Security advisory — low risk for a developer preview.

4. No exponential backoff on markPending retry path in worker.ts
   STATUS: CONFIRMED — markPending in queue.ts is a plain UPDATE, no backoff.
   Job is immediately re-eligible for claim on next 5s poll. Advisory.

5. Blender integration untested end-to-end (requires binary)
   STATUS: UNVERIFIABLE — no Blender binary in audit environment. Python script
   is syntactically correct and logic matches spec. Cannot verify render output.
```

---

## REQUIRED FIX (blocks apps/web compilation)

**File:** `apps/web/src/viewer.ts`
**Line:** 134
**Issue:** `renderer.useLegacyLights = false;`
**Fix:** Delete this line. Three.js r166 does not have this property; physically
correct lights are the default since r155. MeshPhysicalMaterial transmission works
correctly without it.

This is the ONLY change needed to bring apps/web tsc --noEmit to exit 0 for files
in scope of this task. (Pre-existing tree_mesh.ts errors remain and must be tracked
separately.)

---

## BOTTOM LINE

Render-worker pipeline is solid: tsc clean, all 14 files present, spatialHash
verified, landscape filters correct in all three layers, GLB/PNG ordering correct,
all constants match spec. One line in viewer.ts (`useLegacyLights`) uses a
Three.js API removed in r155 — Implementer must delete it. After that fix, the
full pipeline is ready for Linter stage.
