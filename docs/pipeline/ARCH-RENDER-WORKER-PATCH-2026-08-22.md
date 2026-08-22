# ARCH PATCH: Render Worker — GLB + animation_url + Looking Glass + WebXR

**Date:** 2026-08-22
**Stage:** Architect (verified-architect skill — corrective pass)
**Patches:** `docs/pipeline/ARCH-RENDER-WORKER-2026-08-17.md`
**Status:** READY FOR IMPLEMENTER
**Do NOT rewrite the base arch doc.** Apply these additions alongside it.

---

## DESIGN TASK

```
DESIGN TASK:  Add GLB export and animation_url hosted viewer as new render worker outputs
DELIVERABLE:  Patch doc specifying GLB builder, animation_url viewer extension,
              Looking Glass integration, WebXR export, metadata schema update, DB migration
BUILDS ON:    ARCH-RENDER-WORKER-2026-08-17.md, NFT-METADATA-IMAGE-ARCH.md, main3d.ts
CONSUMED BY:  Implementer (disciplined-implementer skill)
```

---

## CODEBASE RECONNAISSANCE

### Files Read

```
docs/pipeline/ARCH-RENDER-WORKER-2026-08-17.md
docs/NFT-METADATA-IMAGE-ARCH.md
apps/web/src/main3d.ts              (lines 1-220)
STATE.md
DECISIONS.md
SESSION-START.md
```

### Symbols Verified in main3d.ts

```
VERIFIED:
  gridToWorld(x, y, z, out)
    file: apps/web/src/main3d.ts line 71
    signature: (x: number, y: number, z: number, out: THREE.Vector3) => THREE.Vector3
    formula: out.set(x - 128, y - BASE_Y, z - 128) where BASE_Y = 38
    NOTE: this is the world-transform used by the viewer -- GLB builder MUST match

  VOXEL_MATS -- MeshStandardMaterial per Material constant
    file: apps/web/src/main3d.ts lines 160-203
    Bark PBR: barkMat (map=tBase, normalMap=tNormal, roughnessMap=tAMR, aoMap=tAMR)
    Leaf PBR: leafVoxMat (map=lBase, normalMap=lNormal, roughnessMap=lRough, side=DoubleSide)
    Root: flat MeshStandardMaterial(color=0x3d2c1a)
    Scar: flat MeshStandardMaterial(color=0x8c8c74)
    MISSING: Translucency map NOT loaded in current main3d.ts
      -> Required addition for animation_url viewer

  Texture paths loaded in main3d.ts (from /textures/ public dir):
    Bonsai_LowPoly_Bonsai_Trunk_BaseColor.jpg
    Bonsai_LowPoly_Bonsai_Trunk_LowPoly_NormalGL.jpg
    Bonsai_LowPoly_Bonsai_Trunk_AMR.jpg
    Bonsai_LowPoly_Leaves_BaseColor.jpg
    Bonsai_LowPoly_Leaves_NormalGL.jpg
    Bonsai_LowPoly_Leaves_Roughness.jpg
    Bonsai_LowPoly_Pot_BaseColor.jpg
    Bonsai_LowPoly_Pot_NormalGL.jpg
    Bonsai_LowPoly_Pot_Roughness.jpg
    MISSING: Bonsai_LowPoly_Leaves_Translucency.jpg -- NOT loaded

  Imports in main3d.ts:
    THREE (three), OrbitControls, BonsaiTree, GrowthEngine, StatDeriver,
    CareLogReplay (@kijo/engine), SpeciesClass, WATER_AMOUNT, round4 (@kijo/shared),
    Voxelizer, VoxelRole, Material, SparseVoxelSet, VoxelizeResult (@kijo/voxelizer),
    mossMat (./renderer/tree_mesh.js), getSession, loadCareLog, persistCareAction,
    applyCurrentDayEntries, saveTreeCache, loadTreeCache, clearTreeCache,
    KijoSession, CareLogEntry (./persistence.js)

  get-tree Edge Function
    file: STATE.md (apps/server Edge Function table)
    status: Deployed (existing)
    verify_jwt: true
    description: Retrieve tree state
    NOTE: animation_url viewer fetches from this endpoint (with auth token from wallet)
    OPEN QUESTION OQ-P1: Does get-tree return enough data for unauthenticated viewers?
    See OQ section below.

GAPS FOUND:
  Translucency texture not in apps/web/public/textures/ listing (as reported in base arch doc)
    -> kijo/assets/Textures/Leaves_Translucency.png EXISTS (confirmed by base arch doc §OQ-B)
    -> Must be copied to apps/web/public/textures/ with correct naming before viewer can use it

  Grunge textures at kijo/assets/Textures-Raw/ (NOT Textures/):
    Bonsai_Grunge_Alive.png, Bonsai_Grunge_Dead.png
    These are in Textures-Raw/ (Substance Designer source folder per NFT-METADATA-IMAGE-ARCH.md)
    Must be copied to apps/web/public/textures/ for viewer to load them

  nft-metadata does NOT currently emit animation_url or glb_url
    -> Per NFT-METADATA-IMAGE-ARCH.md: "animation_url omitted in Phase 1 until viewer domain
       is Sky Mavis-allowlisted"
    -> Per Jeremy's decisions (2026-08-22): animation_url is NOW IN SCOPE -- add it
```

---

## VERIFICATION LOG

```
VERIFIED:
  @gltf-transform/core package exists on npm
    version: 4.4.2 (latest as of 2026-08-22)
    license: MIT -- compatible with project
    source: registry.npmjs.org/@gltf-transform/core/latest
    description: glTF 2.0 SDK for JavaScript and TypeScript, on Web and Node.js
    ESM + CJS exports, Node.js support confirmed

  @lookingglass/webxr package exists on npm
    version: 0.6.0 (latest as of 2026-08-22)
    license: Apache-2.0 -- compatible with project
    source: registry.npmjs.org/@lookingglass/webxr/latest
    author: Looking Glass Factory (official SDK)
    devDependencies include three@^0.146.0 -- works with Three.js
    exports: ESM (webxr.js) + CJS (webxr.umd.cjs)
    description: Official WebXR implementation for Looking Glass Holographic Displays

  kijo/assets/Bonsai-GLB/Bonsai_LowPoly.glb existence
    Confirmed via base arch doc OQ-B resolution: kijo/assets/ contains Bonsai-GLB/
    (verified via bash ls 2026-08-17 alongside Textures/, Bonsai-OBJ/, assets/images/)

  kijo/assets/Textures/Leaves_Translucency.png existence
    Confirmed by NFT-METADATA-IMAGE-ARCH.md texture inventory table
    "Leaves_Translucency.png -- Transmission mask -- SSS through leaf"

  Grunge textures existence
    Confirmed by NFT-METADATA-IMAGE-ARCH.md: "kijo/assets/Textures-Raw/
    Bonsai_Grunge_Alive.png / Bonsai_Grunge_Dead.png"

  VOXEL coordinate transform matches main3d.ts
    gridToWorld: (x-128, y-38, z-128) -- this is the centering convention
    GLB builder MUST use same centering: x_world = (vx-128)*scale, y_world = (vy-38)*scale,
    z_world = (vz-128)*scale where scale = VOXEL_SCALE = 0.08

UNVERIFIED:
  @gltf-transform/functions package capabilities (instancing)
    npm fetch blocked by workspace policy for this URL
    KNOWN from gltf-transform documentation and community: @gltf-transform/functions v4.x
    includes instance() function for EXT_mesh_gpu_instancing. However,
    for the GLB builder we do NOT need instancing -- we build per-material meshes
    from merged geometry (one merged BoxGeometry mesh per material type).
    Using @gltf-transform/core alone is sufficient for this approach (see Section 1).
    ASSUMPTION-P1: @gltf-transform/functions is NOT required for this implementation.

  get-tree Edge Function response shape (full schema not read)
    STATE.md says: "Retrieve tree state" -- shape not fully documented there
    OPEN QUESTION OQ-P1: See below.

  Three.js version in apps/web (relevant for MeshPhysicalMaterial.transmissionMap)
    MeshPhysicalMaterial with transmissionMap available since Three.js r145+
    Current three.js version in apps/web not checked (not blocking -- will use feature detect)
    ASSUMPTION-P2: Three.js version in apps/web >= r145. If not, leaf translucency
    can be approximated via alphaMap on MeshStandardMaterial (opacity mask) as fallback.

REFUTED:
  animation_url is deferred to Phase 2 (as stated in NFT-METADATA-IMAGE-ARCH.md Phase 2 section)
    ACTUAL: Jeremy confirmed 2026-08-22 -- animation_url is NOW IN SCOPE for this task.
    NFT-METADATA-IMAGE-ARCH.md Phase 2 entry is superseded by this decision.
```

---

## CODE SOURCE AUDITS

```
CODE SOURCE AUDIT
  snippet:     gltf-transform document/mesh building approach
  origin:      gltf-transform.dev documentation + npm package (v4.4.2)
  license:     MIT -- compatible
  version:     4.4.2 (verified on npm)
  current:     Yes -- active project, latest stable
  assumptions: Node.js environment with ESM module support
  limitations: No GPU on Railway worker -- GLB builder is pure CPU geometry, no rendering
  adaptation:  Build flat merged geometry per material type (no GPU instancing needed)
  verdict:     USE -- @gltf-transform/core only; no functions package needed

CODE SOURCE AUDIT
  snippet:     @lookingglass/webxr SDK integration pattern
  origin:      Looking Glass Factory official npm package (v0.6.0)
  license:     Apache-2.0 -- compatible
  version:     0.6.0 (verified on npm)
  current:     Yes -- official package from Looking Glass Factory
  assumptions: Browser environment (not Node.js); works with Three.js WebXRRenderer
  limitations: Requires Looking Glass Bridge desktop app OR physical LKG display
               Browser must support WebXR or use the LKG polyfill (included in package deps)
  adaptation:  Import in the animation_url viewer page; wrap Three.js renderer with LKG
  verdict:     USE AS-IS -- add <script> import or npm dep in web app
```

---

## CROSS-REFERENCE CHECK

```
checked against: ARCH-RENDER-WORKER-2026-08-17.md, NFT-METADATA-IMAGE-ARCH.md,
                 STATE.md (nft-metadata Edge Function status), DECISIONS.md
consistent:
  - Coordinate transform: VOXEL_SCALE=0.08, CENTER=128, BASE_Y=38 -- consistent
    across base arch, main3d.ts, and this patch
  - Supabase Storage bucket 'renders': GLB stored at renders/{tokenId}.glb (alongside
    renders/{tokenId}.png) -- consistent naming convention
  - render_queue table schema: base arch doc -- no image_path or glb_path columns;
    both paths are derived from token_id; patch adds glb_path column for
    independent status tracking (see Section 6)
  - NFT metadata schema: animation_url field present in ERC-721 spec but marked
    "omitted in Phase 1" -- this patch moves it to active scope
terminology aligned: yes
  kijonsai, renders bucket, get-tree, nft-metadata, VoxelRole, Material -- all consistent
boundary violations: none
  GLB builder runs inside apps/render-worker (Node.js) -- same boundary as Blender invoke
  animation_url viewer is an extension of apps/web/src/main3d.ts (browser)
```

---

## THE PATCH

---

### PATCH Section 1: GLB Output Pipeline

#### 1.1 Overview

The render worker now produces TWO output artifacts per job (plus the existing PNG):

| Output | Format | Tool | Storage Path | Purpose |
|--------|--------|------|--------------|---------|
| PNG | 1024x1024 Blender Cycles | Blender CLI | `renders/{tokenId}.png` | NFT `image` field, marketplace thumbnail. UNCHANGED. |
| GLB | Binary glTF 2.0, voxel mesh | Node.js + gltf-transform | `renders/{tokenId}.glb` | Looking Glass display, WebXR export |

The GLB builder runs inside `apps/render-worker/src/glb.ts` -- a new file. It is called from `worker.ts` BEFORE Blender (it is pure CPU Node.js -- fast, no external process). Both outputs are uploaded to Supabase Storage `renders/` bucket.

#### 1.2 Package Addition

Add to `apps/render-worker/package.json` dependencies:

```json
"@gltf-transform/core": "^4.4.2",
"@gltf-transform/extensions": "^4.4.2"
```

`@gltf-transform/extensions` is required for `KHR_materials_transmission` (leaf translucency). Resolved per DECISIONS.md 2026-08-22 (OQ-P2).

#### 1.3 GLB Builder: apps/render-worker/src/glb.ts

**Design principle:** One merged `Mesh` per material type (HEARTWOOD/BARK/BRANCH_WOOD share one mesh; LEAF gets its own; ROOT and PRUNE_SCAR get one). This matches the InstancedMesh-per-material approach in main3d.ts and produces a compact GLB. No EXT_mesh_gpu_instancing (not needed at the voxel counts involved, and maximises viewer compatibility).

**Coordinate system:**
```
GLB world position per voxel:
  x_glb = (voxel_x - 128) * VOXEL_SCALE    // centered on trunk axis
  y_glb = (voxel_y -  38) * VOXEL_SCALE    // y=0 at pot rim / trunk base
  z_glb = (voxel_z - 128) * VOXEL_SCALE    // centered on trunk axis

VOXEL_SCALE = 0.08 (Blender world units -- matches base arch doc and main3d.ts)
CENTER_XZ   = 128
BASE_Y      = 38
```

This matches `gridToWorld()` in `apps/web/src/main3d.ts` line 71 exactly.

**glTF-transform document structure:**

```
Document
  Scene
    Node("tree")
      Mesh("voxels_wood")    -- HEARTWOOD + BARK + BRANCH_WOOD merged
        Primitive (mode=TRIANGLES)
          Accessor: POSITION  float32[n_wood_voxels * 24 * 3]
          Accessor: NORMAL    float32[n_wood_voxels * 24 * 3]
          Material: wood_pbr (baseColorTexture=Trunk_BaseColor, normalTexture=Trunk_NormalGL,
                               metallicRoughnessTexture=Trunk_AMR, extras.aoMap=Trunk_AMR)
      Mesh("voxels_leaf")    -- LEAF voxels merged
        Primitive (mode=TRIANGLES)
          Material: leaf_pbr (baseColorTexture=Leaves_BaseColor, normalTexture=Leaves_NormalGL,
                               metallicRoughnessTexture=Leaves_Roughness,
                               KHR_materials_transmission extension: transmissionFactor=0.3,
                               transmissionTexture=Leaves_Translucency)
          doubleSided: true
      Mesh("voxels_root")    -- ROOT + PRUNE_SCAR merged
        Primitive (mode=TRIANGLES)
          Material: root_pbr (flat, color=[0.24, 0.17, 0.10, 1.0])
    Node("pot")
      -- Bonsai_LowPoly.glb sub-scene appended here (pot + base mesh from GLB)
      -- See 1.4 below

Extensions used:
  KHR_materials_transmission (for leaf translucency) -- supported by Three.js r145+, Babylon.js, etc.
  NOTE: If viewer compatibility is a concern, transmission can be omitted -- leaf still renders
        with PBR base color, just without light-through effect. Flag for Jeremy (OQ-P2).
```

**Box geometry per voxel (unindexed, 6 faces x 2 triangles x 3 verts = 36 verts per cube):**

Each voxel contributes 36 position floats and 36 normal floats to the merged primitive.
Use the standard unit cube centered at (0,0,0) scaled to VOXEL_SCALE, then translated.

```typescript
// apps/render-worker/src/glb.ts (full spec -- implementer writes this)

import {
  Document, NodeIO, Primitive,
} from '@gltf-transform/core';
import { KHRMaterialsTransmission, KHRMaterialsTransmissionExtension } from '@gltf-transform/extensions';
import * as fs from 'fs/promises';
import * as path from 'path';

export const VOXEL_SCALE = 0.08;
export const CENTER_XZ   = 128;
export const BASE_Y      = 38;

// Material group IDs -- match Material constants in packages/voxelizer/src/index.ts
const WOOD_MATS  = new Set([1, 2, 3]);  // HEARTWOOD, BARK, BRANCH_WOOD
const LEAF_MAT   = 4;
const ROOT_MATS  = new Set([5, 6]);     // ROOT, PRUNE_SCAR

interface VoxelEntry { x: number; y: number; z: number; mat: number; }
interface GlbOptions {
  voxels:     VoxelEntry[];
  seed:       number;
  tokenId:    number;
  textureDir: string;   // absolute path to kijo/assets/Textures/
  baseMeshPath: string; // absolute path to kijo/assets/Bonsai-GLB/Bonsai_LowPoly.glb
  outPath:    string;   // e.g. /tmp/render_42.glb
}

export async function buildGlb(opts: GlbOptions): Promise<void> {
  const doc = new Document();
  const scene = doc.createScene('kijonsai');
  const treeNode = doc.createNode('tree');
  scene.addChild(treeNode);

  // Partition voxels by group
  const woodVoxels  = opts.voxels.filter(v => WOOD_MATS.has(v.mat));
  const leafVoxels  = opts.voxels.filter(v => v.mat === LEAF_MAT);
  const rootVoxels  = opts.voxels.filter(v => ROOT_MATS.has(v.mat));

  // Build merged mesh for each group
  if (woodVoxels.length > 0) {
    const mesh = buildVoxelMesh(doc, 'voxels_wood', woodVoxels, 'wood');
    treeNode.setMesh(mesh);
  }
  if (leafVoxels.length > 0) {
    const leafNode = doc.createNode('leaf_node').setMesh(
      buildVoxelMesh(doc, 'voxels_leaf', leafVoxels, 'leaf')
    );
    treeNode.addChild(leafNode);
  }
  if (rootVoxels.length > 0) {
    const rootNode = doc.createNode('root_node').setMesh(
      buildVoxelMesh(doc, 'voxels_root', rootVoxels, 'root')
    );
    treeNode.addChild(rootNode);
  }

  // Register KHR_materials_transmission extension before material creation
  doc.createExtension(KHRMaterialsTransmissionExtension);
  // Attach textures (load from textureDir -- PNG files)
  await attachTextures(doc, opts.textureDir);

  // Write GLB
  const io = new NodeIO().registerExtensions([KHRMaterialsTransmission]);
  const glbBuffer = await io.writeBinary(doc);
  await fs.writeFile(opts.outPath, glbBuffer);
}

// --- Internal helpers (implementer expands these) ---

function voxelToWorld(vx: number, vy: number, vz: number): [number, number, number] {
  return [
    (vx - CENTER_XZ) * VOXEL_SCALE,
    (vy - BASE_Y)    * VOXEL_SCALE,
    (vz - CENTER_XZ) * VOXEL_SCALE,
  ];
}

function buildVoxelMesh(
  doc: Document,
  name: string,
  voxels: VoxelEntry[],
  group: 'wood' | 'leaf' | 'root',
): ReturnType<Document['createMesh']> {
  // Build flat float32 arrays for POSITION and NORMAL
  // 36 vertices per cube (6 faces * 2 triangles * 3 vertices, unindexed)
  const S = VOXEL_SCALE;
  const half = S / 2;

  // Unit cube face definitions [6 faces, 6 verts each (2 tris)]:
  // FACE_VERTS[face] = [[dx,dy,dz], ...] relative to center, normal direction
  // (implementer generates from standard box -- top/bottom/+x/-x/+z/-z)
  // Standard glTF winding: CCW looking from outside

  const positions: number[] = [];
  const normals:   number[] = [];

  for (const { x, y, z } of voxels) {
    const [wx, wy, wz] = voxelToWorld(x, y, z);
    appendBoxVertices(positions, normals, wx, wy, wz, half);
  }

  const buffer = doc.createBuffer();
  const posBuf = new Float32Array(positions);
  const norBuf = new Float32Array(normals);

  const posAcc = doc.createAccessor()
    .setType('VEC3').setArray(posBuf).setBuffer(buffer);
  const norAcc = doc.createAccessor()
    .setType('VEC3').setArray(norBuf).setBuffer(buffer);

  const prim = doc.createPrimitive()
    .setMode(Primitive.Mode.TRIANGLES)
    .setAttribute('POSITION', posAcc)
    .setAttribute('NORMAL',   norAcc);

  // Material assignment deferred to attachTextures() -- set by name reference
  // prim.setMaterial(...)  -- called in attachTextures
  //
  // MATERIAL ASSIGNMENT MECHANISM: Material is assigned per merged mesh group (one mesh per
  // mat type). attachTextures(doc, textureDir) traverses the document via:
  //   doc.getRoot().listMeshes().find(m => m.getName() === 'voxels_wood')?.listPrimitives()[0]?.setMaterial(woodMat);
  // A switch(matType) block maps Material enum values to Textures/ filenames.
  // attachTextures sets material.baseColorTexture, material.normalTexture,
  // material.roughnessTexture, and (for LEAF only) material.occlusionTexture pointing to
  // Leaves_Translucency.png via the KHR_materials_transmission extension.

  return doc.createMesh(name).addPrimitive(prim);
}

// appendBoxVertices: appends 36 position + 36 normal floats for a box at (cx,cy,cz)
// with half-size `h`. Standard CCW winding per glTF spec.
// Implementer fills this in -- standard unit cube, well-documented.
function appendBoxVertices(
  pos: number[], nor: number[],
  cx: number, cy: number, cz: number,
  h: number,
): void {
  // 6 faces * 6 vertices * 3 floats
  // Face +Y (top):    normal (0,1,0)
  // Face -Y (bottom): normal (0,-1,0)
  // Face +X:          normal (1,0,0)
  // Face -X:          normal (-1,0,0)
  // Face +Z:          normal (0,0,1)
  // Face -Z:          normal (0,0,-1)
  // Implementer generates from these -- standard box geometry
}

async function attachTextures(doc: Document, textureDir: string): Promise<void> {
  // Load PBR textures from kijo/assets/Textures/ and attach to materials
  // Texture names (PNG format, confirmed present):
  //   Trunk_BaseColor.png, Trunk_NormalGL.png, Trunk_LowPoly_NormalGL.png, Trunk_AMR.png
  //   Leaves_BaseColor.png, Leaves_NormalGL.png, Leaves_Roughness.png, Leaves_Translucency.png
  //   Moss_BaseColor.png, Moss_NormalGL.png, Moss_Roughness.png
  //   Pot_BaseColor.png, Pot_NormalGL.png, Pot_Roughness.png
  //   Vegetation_BaseColor.png, Vegetation_NormalGL.png, Vegetation_Roughness.png
  //
  // Use Trunk_LowPoly_NormalGL.png (not HighPoly) for wood material normal map.
  // Implementer creates Material objects and wires texture accessors.
  // KHR_materials_transmission for leaf: transmissionFactor=0.3, transmissionTexture=Leaves_Translucency
}
```

**IMPLEMENTER NOTE on appendBoxVertices:** This is standard box geometry. Use the same vertex layout as Three.js `BoxGeometry(1,1,1)`, scaled by VOXEL_SCALE. There are many correct implementations -- any that produces CCW winding per the glTF spec is acceptable.

#### 1.4 Pot mesh: Bonsai_LowPoly.glb integration

The `Bonsai_LowPoly.glb` at `kijo/assets/Bonsai-GLB/Bonsai_LowPoly.glb` contains the pot + trunk reference mesh (commercial license, confirmed present).

**Approach:** Load the GLB with NodeIO, extract the scene graph, and merge into the output document as a sibling node of the voxel tree node.

```typescript
// In buildGlb(), after voxel meshes are built:
const io = new NodeIO();
const potDoc = await io.read(opts.baseMeshPath);   // Bonsai_LowPoly.glb
// Merge potDoc into doc -- gltf-transform Document.merge() if available in v4.4.x,
// OR manually copy nodes/meshes/materials/textures from potDoc into doc.
// OPEN QUESTION OQ-P3: Document.merge() -- verify it exists in @gltf-transform/core v4.4.x
// If absent, use io.writeBinary(potDoc) and embed as a Buffer; or include pot as a
// separate referenced GLB (less clean for WebXR). See OQ-P3.
```

**FALLBACK (OQ-P3 unresolved):** Skip pot mesh in GLB Phase 1. Include only the voxel tree mesh. Pot can be added in Phase 2 once Document.merge() is confirmed. Mark as OQ-P3.

#### 1.5 File naming and storage

| Artifact | Local temp path | Supabase Storage path |
|----------|----------------|----------------------|
| PNG (existing) | `/tmp/render_{tokenId}.png` | `renders/{tokenId}.png` |
| GLB (NEW) | `/tmp/render_{tokenId}.glb` | `renders/{tokenId}.glb` |

The GLB storage upload uses `contentType: 'model/gltf-binary'`. Use the same `uploadRender` helper from `storage.ts` with the correct content type:

```typescript
// New overload / option in storage.ts:
export async function uploadRender(
  supabase: SupabaseClient,
  localPath: string,
  storagePath: string,
  contentType: string,
): Promise<void> {
  const fileBuffer = await fs.readFile(localPath);
  const { error } = await supabase.storage
    .from('renders')
    .upload(storagePath, fileBuffer, { contentType, upsert: true });
  if (error) throw new Error(`Storage upload failed for ${storagePath}: ${error.message}`);
}
```

#### 1.6 Worker.ts additions

Add to `processJob()` in `apps/render-worker/src/worker.ts` AFTER voxelization and BEFORE Blender:

```typescript
// 5a. Build GLB (fast -- pure Node.js, no external process)
const glbOutPath = `/tmp/render_${job.token_id}.glb`;
await buildGlb({
  voxels:       voxelEntries,    // same flat array used for Blender payload
  seed:         tree.seed,
  tokenId:      job.token_id,
  textureDir:   '/app/assets/Textures',       // kijo/assets/Textures/ in container
  baseMeshPath: '/app/assets/Bonsai-GLB/Bonsai_LowPoly.glb',
  outPath:      glbOutPath,
});
await uploadRender(supabase, glbOutPath, `${job.token_id}.glb`, 'model/gltf-binary');
await fs.unlink(glbOutPath).catch(() => {});
```

The GLB build runs before Blender because it is fast (seconds, not minutes) and if it fails, we still want the PNG render to proceed. GLB failure should NOT fail the overall render job -- log the error and continue:

```typescript
try {
  await buildGlb({...});
  const glbStoragePath = `renders/${job.token_id}.glb`;
  await uploadRender(supabase, glbOutPath, glbStoragePath, 'model/gltf-binary');
  // Record glb_path in render_queue so GLB build status is independently observable.
  // If GLB fails (caught below), glb_path remains NULL -- this is intentional.
  await supabase.from('render_queue').update({ glb_path: glbStoragePath }).eq('id', job.id);
} catch (glbErr) {
  console.error(`[render-worker] GLB build failed for token ${job.token_id}:`, glbErr);
  // Do NOT rethrow -- PNG render continues
} finally {
  await fs.unlink(glbOutPath).catch(() => {});
}
```

---

### PATCH Section 2: animation_url Viewer

#### 2.1 What it is

The `animation_url` NFT metadata field points to:
```
https://app.kijo.xyz/viewer/{tokenId}
```
(or whatever the Netlify-deployed domain becomes -- see OQ-P4 on domain)

This page is the existing Three.js voxel viewer (`apps/web/src/main3d.ts`) extended to:
1. Read `tokenId` from the URL path/query param
2. Fetch the current tree state via the `get-tree` Edge Function
3. Reconstruct and voxelize the tree using the engine
4. Render with PBR textures including Translucency (leaf light-through effect)
5. Apply Grunge overlay based on tree health state
6. Optionally: enable Looking Glass mode if LKG hardware is detected

**This is a live view** -- it fetches the tree's CURRENT state on every load, not a snapshot. The PNG thumbnail is the only frozen artifact.

#### 2.2 New viewer entry point

Create `apps/web/index-viewer.html` and `apps/web/src/viewer.ts` (or extend the existing index3d.html routing).

**Recommended approach:** Add a new Vite entry point `viewer.html` + `viewer.ts` that is nearly identical to `main3d.ts` but:
- Does NOT have care UI (no water/prune/wire buttons) -- read-only display
- Does NOT use `getSession()` or `loadCareLog()` from persistence.js
- DOES fetch from the `get-tree` Edge Function using `tokenId` from URL
- DOES enable LKG WebXR if present

The viewer receives `tokenId` from the URL:
```
https://app.kijo.xyz/viewer/42          (path param)
OR
https://app.kijo.xyz/viewer?tokenId=42  (query param -- simpler for Vite routing)
```
OPEN QUESTION OQ-P4: Which URL form to use? Path params require Netlify redirect rules.
Query params work with SPA routing without extra config. Recommend query params.

#### 2.3 get-tree call from viewer

The `get-tree` Edge Function has `verify_jwt: true`. The viewer page is public (no wallet auth).

OPEN QUESTION OQ-P1 (BLOCKING): Does `get-tree` support unauthenticated reads for public NFT data?

Options:
- **Option A (RECOMMENDED):** Create a new Edge Function `get-tree-public` with `verify_jwt: false` that returns the minimum fields needed for the viewer: `{ seed, species, current_day, care_log_entries: [] }` filtered by token_id (public lookup -- no private data). Alternatively, extend `get-tree` with a public path.

  **LANDSCAPE FILTER REQUIRED:** The response `care_log_entries` array MUST exclude entries where `type === 'landscape'` before returning. `CareLogReplay.reconstruct` throws `CareLogReplayError` on landscape entries. Filter server-side in the Edge Function, not client-side — any unfiltered landscape entry reaching the viewer's `CareLogReplay.reconstruct()` call will crash the viewer for any tree that has received a landscape care action.
- **Option B:** Change `get-tree` verify_jwt to false (too broad -- exposes private data).
- **Option C:** Viewer uses the GLB directly from `renders/{tokenId}.glb` storage URL (no engine pipeline in browser). Simpler but loses the "live current state" property.

Jeremy must decide OQ-P1 before viewer implementation. **Option A is the architect recommendation.**

#### 2.4 Engine pipeline in viewer

The viewer re-runs `CareLogReplay -> Voxelizer` in the browser (same as the existing `main3d.ts` which already imports these packages). No server round-trip for tree reconstruction -- the viewer gets the raw tree data and runs the engine client-side.

Existing engine imports in `main3d.ts` (VERIFIED):
```typescript
import { BonsaiTree, GrowthEngine, StatDeriver, CareLogReplay } from '@kijo/engine';
import { Voxelizer, VoxelRole, Material } from '@kijo/voxelizer';
```
The viewer.ts uses the same imports.

#### 2.5 Translucency map addition to leaf material

Current `main3d.ts` leaf material (line 189):
```typescript
const leafVoxMat = new THREE.MeshStandardMaterial({
  map: lBase, normalMap: lNormal, roughnessMap: lRough,
  roughness: 0.75, metalness: 0.0,
  color: 0x5a8f3c, side: THREE.DoubleSide,
});
```

**Extended for viewer.ts** -- upgrade to `MeshPhysicalMaterial` to enable transmission:
```typescript
// viewer.ts leaf material -- MeshPhysicalMaterial for translucency
const lTranslucency = tl.load('/textures/Bonsai_LowPoly_Leaves_Translucency.jpg');
lTranslucency.colorSpace = THREE.LinearSRGBColorSpace;  // data map

const leafVoxMat = new THREE.MeshPhysicalMaterial({
  map:            lBase,
  normalMap:      lNormal,
  normalScale:    new THREE.Vector2(0.5, 0.5),
  roughnessMap:   lRough,
  roughness:      0.75,
  metalness:      0.0,
  color:          0x5a8f3c,
  side:           THREE.DoubleSide,
  // Translucency via physical transmission:
  transmission:       0.3,              // 30% base light-through
  transmissionMap:    lTranslucency,    // mask: white=transmit, black=opaque
  thickness:          0.05,             // thin leaf approximation
});
```

**IMPORTANT:** `MeshPhysicalMaterial` with `transmission` requires Three.js r145+ and the WebGL renderer must have `physicallyCorrectLights: true` (or use the newer `useLegacyLights: false`). Verify Three.js version in apps/web before implementing. If < r145, fall back to using `MeshStandardMaterial` with `alphaMap: lTranslucency` + `transparent: true` (opacity mask, not true transmission but visual approximation).

**Texture file to add to `apps/web/public/textures/`:**
```
kijo/assets/Textures/Leaves_Translucency.png
  -> apps/web/public/textures/Bonsai_LowPoly_Leaves_Translucency.jpg
```
(Convert PNG->JPG OR load as PNG -- check which format the other textures use; existing ones are JPG so convert for consistency, OR use PNG and update the load path.)

#### 2.6 Grunge overlay for health state

The tree health state (float 0-100) comes from the `get-tree` response. Apply grunge as an overlay material property based on health:

```typescript
// Health thresholds (OPEN QUESTION OQ-P5 -- Jeremy to confirm values)
// Proposed: healthy >= 60, stressed 30-59, wilting < 30
// Grunge selection: healthy/stressed -> Bonsai_Grunge_Alive.png; wilting -> Bonsai_Grunge_Dead.png

const HEALTH_WILTING_THRESHOLD = 30;  // flag for tuning

const grungeAlive = tl.load('/textures/Bonsai_Grunge_Alive.png');
const grungeDead  = tl.load('/textures/Bonsai_Grunge_Dead.png');
grungeAlive.colorSpace = THREE.LinearSRGBColorSpace;
grungeDead.colorSpace  = THREE.LinearSRGBColorSpace;

// Select grunge map based on health
const isWilting = treeHealth < HEALTH_WILTING_THRESHOLD;
const grungeMap = isWilting ? grungeDead : grungeAlive;

// TWO-PASS GRUNGE APPROACH (avoids clobbering Trunk_AMR's baked AO channel on barkMat):
// barkMat already uses aoMap: tAMR (Trunk_AMR provides baked PBR ambient occlusion).
// Setting barkMat.aoMap = grungeMap would replace that baked AO entirely -- destructive.
// Instead, render a second transparent mesh (same geometry, same world transform) with
// an alphaMap-based overlay material:

const grungeMesh = new THREE.Mesh(
  barkMesh.geometry,   // shared geometry -- same voxel geometry as base bark mesh
  new THREE.MeshStandardMaterial({
    alphaMap:        grungeMap,
    transparent:     true,
    opacity:         healthToGrungeOpacity(treeHealth),
    color:           0x1a1008,   // dark grunge tint
    depthWrite:      false,
  }),
);
grungeMesh.position.copy(barkMesh.position);
grungeMesh.renderOrder = 1;    // render after opaque base pass
scene.add(grungeMesh);

// healthToGrungeOpacity(h): opacity 0.0 (healthy, invisible) -> 0.85 (wilting, max grunge)
// Alive texture (stressed): opacity 0.4 at health=30. Dead texture (wilting): opacity 0.7-0.85.
function healthToGrungeOpacity(h: number): number {
  if (h >= 60) return 0.0;                          // healthy -- grunge invisible
  if (h < HEALTH_WILTING_THRESHOLD) return 0.7;    // wilting -- Dead texture at 0.7
  return 0.4 * (1.0 - (h - HEALTH_WILTING_THRESHOLD) / (60 - HEALTH_WILTING_THRESHOLD));
  // stressed: linear 0.4 -> 0.0 as health goes from 30 -> 60
}
```

**Textures to add to `apps/web/public/textures/`:**
```
kijo/assets/Textures-Raw/Bonsai_Grunge_Alive.png -> apps/web/public/textures/Bonsai_Grunge_Alive.png
kijo/assets/Textures-Raw/Bonsai_Grunge_Dead.png  -> apps/web/public/textures/Bonsai_Grunge_Dead.png
```

---

### PATCH Section 3: Looking Glass Integration

#### 3.1 What it is

The Looking Glass Portrait/Go is a holographic display that renders a light field from a WebGL scene. The `@lookingglass/webxr` package (v0.6.0, Apache-2.0, VERIFIED on npm) is the official Looking Glass Factory SDK.

**How it works:** When Looking Glass Bridge (desktop app) is running and a LKG display is connected, the `@lookingglass/webxr` package polyfills the browser's WebXR API so that `navigator.xr.requestSession('immersive-vr')` initiates a LKG light field session. The Three.js renderer hooks into this via `WebXRManager`.

**No special file format needed.** The LKG SDK captures the Three.js scene (live voxel render) and converts it to a light field automatically. The existing Three.js scene in the viewer works as-is.

#### 3.2 Integration in viewer.ts

Add to `apps/web/src/viewer.ts` (the new animation_url page):

```typescript
// Looking Glass WebXR integration
// Import: add to package.json devDependencies OR use a CDN script tag
// (CDN is simpler for a viewer page -- no build-time dependency)

// In viewer.ts:
async function initLookingGlass(): Promise<void> {
  // Check if WebXR is available and LKG display is connected
  if (!navigator.xr) return;
  const supported = await navigator.xr.isSessionSupported('immersive-vr').catch(() => false);
  if (!supported) return;

  // @lookingglass/webxr polyfill is loaded (via CDN script or npm import)
  // It automatically intercepts navigator.xr when Looking Glass Bridge is running.
  // Simply enable WebXR on the Three.js renderer:
  renderer.xr.enabled = true;

  // Add an "Enter Looking Glass" button to the viewer UI
  const btn = document.createElement('button');
  btn.textContent = 'View on Looking Glass';
  btn.style.cssText = 'position:absolute;bottom:20px;right:20px;padding:10px 20px;';
  document.body.appendChild(btn);
  btn.addEventListener('click', async () => {
    const session = await navigator.xr!.requestSession('immersive-vr', {
      optionalFeatures: ['local-floor', 'bounded-floor'],
    });
    await renderer.xr.setSession(session);
    // Switch to setAnimationLoop for WebXR -- requestAnimationFrame does not fire during XR.
    // The Looking Glass SDK hooks into this loop automatically when @lookingglass/webxr is initialised.
    renderer.setAnimationLoop(render);
  });
}
```

**ANIMATION LOOP REQUIREMENT:** `viewer.ts` must use `renderer.setAnimationLoop(render)` instead of `requestAnimationFrame` when WebXR is active. Add the following in the render loop setup:

```typescript
// Render loop -- use setAnimationLoop for WebXR compatibility
if (renderer.xr.isPresenting) {
  renderer.setAnimationLoop(render);
} else {
  requestAnimationFrame(render);
}
```

Without `renderer.setAnimationLoop`, `renderer.xr.isPresenting` never triggers frame callbacks and the Looking Glass display will not update. The `@lookingglass/webxr` SDK hooks into this loop automatically once initialised.

**CDN approach (no npm dep):**

Add to `apps/web/index-viewer.html`:
```html
<!-- Looking Glass WebXR SDK -- loads polyfill if LKG Bridge is running -->
<script type="module">
  import '@lookingglass/webxr';
</script>
```
OR use the CDN (jsDelivr/unpkg):
```html
<script src="https://unpkg.com/@lookingglass/webxr@0.6.0/dist/webxr.umd.cjs"></script>
```

**OPEN QUESTION OQ-P6:** Should `@lookingglass/webxr` be added as a devDependency to `apps/web/package.json` (Vite bundle) or imported via CDN in the viewer HTML? CDN is simpler and avoids adding it to the web app bundle for non-viewer pages. **Recommend CDN for the viewer page.**

#### 3.3 No extra infrastructure

The Looking Glass integration adds:
- One `<script>` tag in `index-viewer.html` (CDN)
- ~20 lines of init code in `viewer.ts`
- Zero new server-side infrastructure

The `animation_url` page **is** the Looking Glass viewer. No additional URL or endpoint.

---

### PATCH Section 4: WebXR Export

#### 4.1 What it is

NFT owners who want to use their kijonsai tree in their own XR world load or download the GLB file directly. This is a standard glTF binary -- any WebXR engine (Three.js, Babylon.js, Unity, Godot) can consume it.

#### 4.2 GLB URL

The GLB is stored in Supabase Storage at:
```
https://xutjubkaskwchzyzwryk.supabase.co/storage/v1/object/public/renders/{tokenId}.glb
```

The `renders` bucket is already public (required for the PNG). The GLB lives in the same bucket -- no additional storage config needed.

#### 4.3 NFT metadata attribute

The GLB URL is added as a custom attribute in the NFT metadata (see Section 5). Ronin Market does not render `glb_url` specially, but any dApp or third-party viewer can read it from the attribute list. Standard ERC-721 metadata extension pattern.

#### 4.4 Download button in viewer

The viewer page also shows a "Download GLB" link for the owner:
```typescript
// In viewer.ts -- add after tree loads:
const glbUrl = `https://xutjubkaskwchzyzwryk.supabase.co/storage/v1/object/public/renders/${tokenId}.glb`;
const link = document.createElement('a');
link.href = glbUrl;
link.download = `kijonsai-${tokenId}.glb`;
link.textContent = 'Download GLB for WebXR';
link.style.cssText = 'position:absolute;bottom:20px;left:20px;color:#9fc7ff;';
document.body.appendChild(link);
```

---

### PATCH Section 5: NFT Metadata Schema Update

#### 5.1 New fields to add to nft-metadata Edge Function

**File:** `apps/server/supabase/functions/nft-metadata/index.ts`

Add two new fields to the JSON response:

**Top-level field `animation_url`:**
```json
"animation_url": "https://app.kijo.xyz/viewer?tokenId=42"
```
This is a standard ERC-721 metadata field. Ronin Market displays it as an interactive 3D embed if the domain is allowlisted. See OQ-P4 for domain and OQ-P7 for Sky Mavis allowlist requirement.

**Attribute `glb_url`:**
```json
{ "display_type": "string", "trait_type": "GLB URL",
  "value": "https://xutjubkaskwchzyzwryk.supabase.co/storage/v1/object/public/renders/42.glb" }
```

#### 5.2 Updated metadata JSON schema (diff from base arch doc)

```json
{
  "name": "Kijonsai #42",
  "description": "A living bonsai — grown through care, shaped by the player.",
  "image": "https://api.kijo.xyz/nft/image/42",
  "animation_url": "https://app.kijo.xyz/viewer?tokenId=42",   // NEW
  "attributes": [
    // ... all existing attributes unchanged ...
    // NEW attribute at end of attributes array:
    { "display_type": "string", "trait_type": "GLB URL",
      "value": "https://xutjubkaskwchzyzwryk.supabase.co/storage/v1/object/public/renders/42.glb" }
  ]
}
```

#### 5.3 Implementation in nft-metadata/index.ts

The `animation_url` value can be constructed from a constant (viewer base URL). The `glb_url` is constructed from the Supabase project ref (already known: `xutjubkaskwchzyzwryk`).

Add env var `VIEWER_BASE_URL` to the Edge Function (set in Supabase dashboard):
```
VIEWER_BASE_URL = https://app.kijo.xyz/viewer
```

In the response assembly:
```typescript
const animationUrl = `${Deno.env.get('VIEWER_BASE_URL')}?tokenId=${tokenId}`;
const glbUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/renders/${tokenId}.glb`;
// Note: SUPABASE_URL is already available in Edge Functions

return new Response(JSON.stringify({
  name: `Kijonsai #${tokenId}`,
  description: '...',
  image: `${API_BASE}/nft/image/${tokenId}`,
  animation_url: animationUrl,   // NEW
  attributes: [
    // ... existing ...
    { display_type: 'string', trait_type: 'GLB URL', value: glbUrl },  // NEW
  ],
}), { headers: { 'Content-Type': 'application/json', ... } });
```

**OPEN QUESTION OQ-P7 (non-blocking):** Sky Mavis must allowlist the viewer domain (`app.kijo.xyz`) before Ronin Market renders `animation_url` as an embed. The field can be emitted before allowlisting -- it will appear as a non-interactive link. Submit allowlist request to Sky Mavis as a separate task.

---

### PATCH Section 6: render_queue Schema Update

#### 6.1 Do we need new columns?

The existing `render_queue` schema tracks PNG render jobs. With GLB output added to the same job, we have two outputs per job. Both succeed or both are attempted within the same job execution.

**Decision:** Add `glb_path TEXT` column to `render_queue` to record the storage path of the built GLB (null until successfully uploaded). This enables:
- Debugging which jobs produced a GLB
- Future: independent retry of just the GLB build
- Querying for tokens that have/don't have a GLB yet

`image_path` is NOT needed (it is always derivable as `{token_id}.png`). Only `glb_path` needs tracking because GLB build can fail independently (while PNG still succeeds).

#### 6.2 New migration

**File:** `apps/server/supabase/migrations/20260822000001_render_queue_glb_path.sql`

```sql
-- Add glb_path to render_queue to track GLB output status.
-- NULL = GLB not yet built or build failed.
-- Populated by render worker after successful GLB upload to Supabase Storage.
-- PNG path is not stored (always derivable as renders/{token_id}.png).

ALTER TABLE public.render_queue
  ADD COLUMN IF NOT EXISTS glb_path TEXT;

COMMENT ON COLUMN public.render_queue.glb_path IS
  'Supabase Storage path of the built GLB, e.g. renders/42.glb. NULL if not yet built.';
```

Apply with: `supabase db push` or `supabase migration up`

#### 6.3 Worker update for glb_path

In `worker.ts`, after successful GLB upload:

```typescript
// After uploadRender succeeds for GLB:
await supabase.from('render_queue')
  .update({ glb_path: `renders/${job.token_id}.glb` })
  .eq('id', job.id);
```

---

## ASSUMPTIONS REGISTER

```
ASSUMPTION-P1: @gltf-transform/functions is NOT required for the GLB builder
  We use @gltf-transform/core v4.4.2 directly with merged flat geometry per material group.
  No GPU instancing (EXT_mesh_gpu_instancing) needed.
  Mitigation: if future optimization requires instancing, add @gltf-transform/functions then.

ASSUMPTION-P2: Three.js version in apps/web is >= r145
  MeshPhysicalMaterial.transmission and transmissionMap available since r145.
  Mitigation: check package.json of apps/web before implementing viewer.ts leaf material.
  If < r145: use MeshStandardMaterial + alphaMap for leaf transparency (no true transmission).
  Fallback is visually acceptable for Phase 1.

ASSUMPTION-P3: renders bucket in Supabase Storage supports GLB content type
  The bucket already exists and is public (PNG renders confirmed working).
  GLB files are binary -- contentType: 'model/gltf-binary'.
  No bucket policy change expected. Mitigation: test upload before first deploy.

ASSUMPTION-P4: Grunge textures in Textures-Raw/ are final production assets
  NFT-METADATA-IMAGE-ARCH.md labels them "health-state grunge mask" -- confirmed production intent.
  They are PNG (not JPG). Load as PNG in viewer.
  Mitigation: confirm with Jeremy if these are the final textures or Substance source intermediaries.

ASSUMPTION-P5: get-tree response includes current tree health value
  STATE.md says "Retrieve tree state" -- health should be in the response.
  Mitigation: if health is absent from get-tree, use a default (health=100, no grunge).
  Resolve via OQ-P1 (need public tree data endpoint anyway).
```

---

## OPEN QUESTIONS

| ID | Question | Blocks? | Recommended resolution |
|----|----------|---------|------------------------|
| **OQ-P1** | Does `get-tree` support unauthenticated reads? The viewer page is public -- it needs tree data without a wallet JWT. | YES -- blocks viewer.ts implementation | Create `get-tree-public` Edge Function (verify_jwt=false) returning: `{ seed, species, current_day, health, care_log_entries[] }` for a given tokenId. Jeremy must confirm what fields the public endpoint should expose. |
| **OQ-P2** | ~~Include KHR_materials_transmission in GLB for leaf translucency? Or keep GLB PBR-standard only?~~ | ~~No~~ | **RESOLVED 2026-08-22 by Jeremy:** Include full translucency. Add `@gltf-transform/extensions`, apply `KHR_materials_transmission` + `Leaves_Translucency.png`. See DECISIONS.md 2026-08-22. |
| **OQ-P3** | Does `@gltf-transform/core` v4.4.x support `Document.merge()` or equivalent for merging the pot GLB into the output? | No (pot in GLB is Phase 1 nice-to-have) | Implementer to check gltf-transform v4 API for document merging. If absent, omit pot mesh from GLB Phase 1 (voxel tree only). |
| **OQ-P4** | What URL form for the viewer? `app.kijo.xyz/viewer?tokenId=42` vs `app.kijo.xyz/viewer/42`? | No | Recommend query param form -- no Netlify redirect rules needed for SPA routing. |
| **OQ-P5** | Health thresholds for grunge overlay: what values define "healthy" vs "stressed" vs "wilting"? | No | Proposed: healthy >= 60, stressed 30-59, wilting < 30. Jeremy to confirm or adjust. |
| **OQ-P6** | Looking Glass SDK: add to apps/web package.json or use CDN script in viewer HTML? | No | Recommend CDN (unpkg) in index-viewer.html -- avoids bundling it into all other pages. |
| **OQ-P7** | Sky Mavis domain allowlist for animation_url -- when to submit? | No (field can be emitted before allowlist) | Submit as a separate Sky Mavis developer portal request. Non-blocking for implementation. |
| **OQ-C (inherited)** | Blender version pin: 4.2.0 vs 4.2.23? | No | Inherited open question from base arch doc. Decide before first Railway deploy. |
| **OQ-P2** | ~~Leaf translucency in GLB?~~ | **RESOLVED** | Include. Add `@gltf-transform/extensions`. See DECISIONS.md 2026-08-22. |
| **OQ-LANDSCAPE** | Landscape voxel display in render? | **DEFERRED POST-BETA** | `landscape` care actions affect TechniqueClassifier only (no voxel output). Visual landscape elements (rocks, moss, water, soil) will be designed post-beta after community input. **Implementation constraint:** reserve voxel y < 38 zone for future landscape voxels. Do not hardcode "tree-only" assumptions in render worker, GLB builder, or Voxelizer. See DECISIONS.md 2026-08-22. |

---

## FILES SUMMARY

### Files to CREATE (NEW -- not in base arch doc)

```
apps/render-worker/src/glb.ts
  -- GLB builder using @gltf-transform/core
  -- buildGlb(opts: GlbOptions): Promise<void>
  -- Merges voxel geometry per material group, attaches PBR textures, writes .glb

apps/web/index-viewer.html
  -- animation_url viewer HTML page
  -- Includes @lookingglass/webxr CDN script
  -- Vite entry point

apps/web/src/viewer.ts
  -- animation_url viewer logic (read-only, no care UI)
  -- Fetches from get-tree-public Edge Function
  -- MeshPhysicalMaterial for leaf translucency
  -- Grunge overlay based on health
  -- Looking Glass initLookingGlass() helper
  -- Download GLB link

apps/server/supabase/functions/get-tree-public/index.ts
  -- verify_jwt: false
  -- GET /get-tree-public?tokenId={n}
  -- Returns: { seed, species, current_day, health, care_log_entries[] }
  -- PENDING OQ-P1 resolution

apps/server/supabase/migrations/20260822000001_render_queue_glb_path.sql
  -- ALTER TABLE render_queue ADD COLUMN IF NOT EXISTS glb_path TEXT
```

### Files to MODIFY (changes to existing files)

```
apps/render-worker/package.json
  -- Add "@gltf-transform/core": "^4.4.2" to dependencies

apps/render-worker/src/worker.ts
  -- Import buildGlb from './glb.js'
  -- Import uploadRender from './storage.js' (rename/extend uploadRender)
  -- Add GLB build + upload step in processJob() between voxelization and Blender
  -- Add glb_path update to render_queue after successful GLB upload

apps/render-worker/src/storage.ts
  -- Add uploadRender(supabase, localPath, storagePath, contentType) helper
  -- (Existing uploadRender can be a wrapper around uploadRender with contentType='image/png')

apps/server/supabase/functions/nft-metadata/index.ts
  -- Add animation_url top-level field
  -- Add GLB URL attribute to attributes array
  -- Add VIEWER_BASE_URL env var read
```

### Textures to COPY (asset pipeline)

```
kijo/assets/Textures/Leaves_Translucency.png
  -> apps/web/public/textures/Bonsai_LowPoly_Leaves_Translucency.jpg  (or .png)

kijo/assets/Textures-Raw/Bonsai_Grunge_Alive.png
  -> apps/web/public/textures/Bonsai_Grunge_Alive.png

kijo/assets/Textures-Raw/Bonsai_Grunge_Dead.png
  -> apps/web/public/textures/Bonsai_Grunge_Dead.png
```

### Files that ALREADY EXIST (do not recreate)

```
apps/render-worker/src/blender.ts        -- unchanged
apps/render-worker/src/queue.ts          -- unchanged
apps/render-worker/scripts/render_tree.py -- unchanged
apps/server/supabase/migrations/20260817000001_claim_render_job_fn.sql -- already spec'd in base doc
apps/server/supabase/functions/nft-image/index.ts -- unchanged (PNG only, no GLB redirect needed)
```

---

## VERIFICATION SUMMARY

```
VERIFIED:
  @gltf-transform/core v4.4.2 -- npm, MIT, Node.js support confirmed
  @lookingglass/webxr v0.6.0  -- npm, Apache-2.0, Three.js compatible, official LKG SDK
  Bonsai_LowPoly.glb           -- kijo/assets/Bonsai-GLB/ confirmed present
  Leaves_Translucency.png      -- kijo/assets/Textures/ confirmed present (NFT arch doc)
  Grunge textures              -- kijo/assets/Textures-Raw/ confirmed present
  GLB coordinate transform     -- matches gridToWorld() in main3d.ts line 71 (VOXEL_SCALE=0.08,
                                  CENTER_XZ=128, BASE_Y=38)
  renders bucket               -- xutjubkaskwchzyzwryk.supabase.co, public, already in use

UNVERIFIED:
  @gltf-transform/functions instancing API  -- not needed; using core only
  get-tree response schema                  -- blocked by OQ-P1
  Three.js version in apps/web             -- must check before MeshPhysicalMaterial
  Document.merge() in gltf-transform v4    -- must check before pot mesh integration (OQ-P3)

DESIGN OPINIONS (no verification needed):
  GLB before Blender in processJob()       -- GLB is fast (<5s); PNG takes minutes; fail-safe ordering
  Non-fatal GLB errors                     -- GLB failure should not block PNG render
  CDN for @lookingglass/webxr             -- keeps viewer bundle lean
  Query param for tokenId in viewer URL   -- simpler Netlify routing
```
