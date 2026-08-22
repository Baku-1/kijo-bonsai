// apps/render-worker/src/glb.ts
// Builds a GLB (binary glTF 2.0) from voxel data using @gltf-transform/core.
// One merged mesh per material group (wood/leaf/root).
// Leaf mesh uses KHR_materials_transmission for backlit translucency.
// Coordinate system: Y-up, matches gridToWorld() in apps/web/src/main3d.ts.
//
// No Math.random() -- no randomness is needed here; leaf rotation is the
// Blender script's responsibility, not the GLB builder's.

import {
  Document,
  NodeIO,
  Primitive,
} from '@gltf-transform/core';
import { KHRMaterialsTransmission, Transmission } from '@gltf-transform/extensions';
import * as fs from 'fs/promises';
import * as path from 'path';

// Coordinate constants -- must match gridToWorld() in main3d.ts and render_tree.py
export const VOXEL_SCALE = 0.08;
export const CENTER_XZ   = 128;
export const BASE_Y      = 38;

// Material group constants -- match Material enum in packages/voxelizer/src/index.ts
// HEARTWOOD=1, BARK=2, BRANCH_WOOD=3, LEAF=4, ROOT=5, PRUNE_SCAR=6
const WOOD_MATS = new Set([1, 2, 3]); // HEARTWOOD, BARK, BRANCH_WOOD -> wood_pbr
const LEAF_MAT  = 4;                  // LEAF -> leaf_pbr (KHR_materials_transmission)
const ROOT_MATS = new Set([5, 6]);    // ROOT, PRUNE_SCAR -> root_flat

export interface VoxelEntry {
  x: number;
  y: number;
  z: number;
  mat: number;
}

export interface GlbOptions {
  voxels:       VoxelEntry[];
  seed:         number;
  tokenId:      number;
  textureDir:   string;   // absolute path to kijo/assets/Textures/
  baseMeshPath: string;   // absolute path to kijo/assets/Bonsai-GLB/Bonsai_LowPoly.glb
  outPath:      string;   // e.g. /tmp/render_42.glb
}

// ---------------------------------------------------------------------------
// Box geometry helper
// ---------------------------------------------------------------------------
// Appends 36 position floats and 36 normal floats for a box at (cx, cy, cz)
// with half-size h. Unindexed (6 faces x 2 triangles x 3 verts = 36 verts).
// CCW winding viewed from outside, per glTF spec.
function appendBoxVertices(
  pos: number[],
  nor: number[],
  cx: number,
  cy: number,
  cz: number,
  h: number,
): void {
  // Push 3 floats for position and the face normal for one vertex
  const v = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => {
    pos.push(x, y, z);
    nor.push(nx, ny, nz);
  };

  // Each face: two CCW triangles (6 verts per face) viewed from outside.
  // +Y face (top), normal (0, 1, 0)
  v(cx-h, cy+h, cz-h, 0, 1, 0); v(cx-h, cy+h, cz+h, 0, 1, 0); v(cx+h, cy+h, cz+h, 0, 1, 0);
  v(cx-h, cy+h, cz-h, 0, 1, 0); v(cx+h, cy+h, cz+h, 0, 1, 0); v(cx+h, cy+h, cz-h, 0, 1, 0);
  // -Y face (bottom), normal (0, -1, 0)
  v(cx-h, cy-h, cz+h, 0,-1, 0); v(cx-h, cy-h, cz-h, 0,-1, 0); v(cx+h, cy-h, cz-h, 0,-1, 0);
  v(cx-h, cy-h, cz+h, 0,-1, 0); v(cx+h, cy-h, cz-h, 0,-1, 0); v(cx+h, cy-h, cz+h, 0,-1, 0);
  // +X face (right), normal (1, 0, 0)
  v(cx+h, cy-h, cz+h, 1, 0, 0); v(cx+h, cy+h, cz+h, 1, 0, 0); v(cx+h, cy+h, cz-h, 1, 0, 0);
  v(cx+h, cy-h, cz+h, 1, 0, 0); v(cx+h, cy+h, cz-h, 1, 0, 0); v(cx+h, cy-h, cz-h, 1, 0, 0);
  // -X face (left), normal (-1, 0, 0)
  v(cx-h, cy-h, cz-h,-1, 0, 0); v(cx-h, cy+h, cz-h,-1, 0, 0); v(cx-h, cy+h, cz+h,-1, 0, 0);
  v(cx-h, cy-h, cz-h,-1, 0, 0); v(cx-h, cy+h, cz+h,-1, 0, 0); v(cx-h, cy-h, cz+h,-1, 0, 0);
  // +Z face (front), normal (0, 0, 1)
  v(cx+h, cy-h, cz+h, 0, 0, 1); v(cx-h, cy-h, cz+h, 0, 0, 1); v(cx-h, cy+h, cz+h, 0, 0, 1);
  v(cx+h, cy-h, cz+h, 0, 0, 1); v(cx-h, cy+h, cz+h, 0, 0, 1); v(cx+h, cy+h, cz+h, 0, 0, 1);
  // -Z face (back), normal (0, 0, -1)
  v(cx-h, cy-h, cz-h, 0, 0,-1); v(cx+h, cy-h, cz-h, 0, 0,-1); v(cx+h, cy+h, cz-h, 0, 0,-1);
  v(cx-h, cy-h, cz-h, 0, 0,-1); v(cx+h, cy+h, cz-h, 0, 0,-1); v(cx-h, cy+h, cz-h, 0, 0,-1);
}

// ---------------------------------------------------------------------------
// World position for a voxel -- matches gridToWorld() in main3d.ts
// ---------------------------------------------------------------------------
function voxelToWorld(vx: number, vy: number, vz: number): [number, number, number] {
  return [
    (vx - CENTER_XZ) * VOXEL_SCALE,
    (vy - BASE_Y)    * VOXEL_SCALE,
    (vz - CENTER_XZ) * VOXEL_SCALE,
  ];
}

// ---------------------------------------------------------------------------
// Build a merged mesh from a list of voxels
// ---------------------------------------------------------------------------
function buildMergedMesh(
  doc: Document,
  name: string,
  voxels: VoxelEntry[],
): ReturnType<Document['createMesh']> {
  const half = VOXEL_SCALE / 2;
  const positions: number[] = [];
  const normals:   number[] = [];

  for (const { x, y, z } of voxels) {
    const [wx, wy, wz] = voxelToWorld(x, y, z);
    appendBoxVertices(positions, normals, wx, wy, wz, half);
  }

  const buffer = doc.createBuffer();
  const posAcc = doc.createAccessor()
    .setType('VEC3')
    .setArray(new Float32Array(positions))
    .setBuffer(buffer);
  const norAcc = doc.createAccessor()
    .setType('VEC3')
    .setArray(new Float32Array(normals))
    .setBuffer(buffer);

  const prim = doc.createPrimitive()
    .setMode(Primitive.Mode.TRIANGLES)
    .setAttribute('POSITION', posAcc)
    .setAttribute('NORMAL', norAcc);

  return doc.createMesh(name).addPrimitive(prim);
}

// ---------------------------------------------------------------------------
// Load a PNG texture file from disk
// ---------------------------------------------------------------------------
async function loadTexture(doc: Document, filePath: string, mimeType: string) {
  const image = await fs.readFile(filePath);
  return doc.createTexture(path.basename(filePath))
    .setImage(image)
    .setMimeType(mimeType);
}

// ---------------------------------------------------------------------------
// Attach PBR textures and materials to the named meshes in the document.
// Traverses doc via listMeshes() -- material set by mesh name.
// ---------------------------------------------------------------------------
async function attachTextures(doc: Document, textureDir: string): Promise<void> {
  // Helper to build a path under textureDir
  const tex = (name: string) => path.join(textureDir, name);

  // -- Wood material (HEARTWOOD + BARK + BRANCH_WOOD) --
  let trunkBase:   ReturnType<typeof doc.createTexture> | null = null;
  let trunkNormal: ReturnType<typeof doc.createTexture> | null = null;
  let trunkAMR:    ReturnType<typeof doc.createTexture> | null = null;
  try {
    trunkBase   = await loadTexture(doc, tex('Bonsai_LowPoly_Bonsai_Trunk_BaseColor.png'),       'image/png');
    trunkNormal = await loadTexture(doc, tex('Bonsai_LowPoly_Bonsai_Trunk_LowPoly_NormalGL.png'), 'image/png');
    trunkAMR    = await loadTexture(doc, tex('Bonsai_LowPoly_Bonsai_Trunk_AMR.png'),              'image/png');
  } catch {
    // Texture files may not be PNG -- try the JPG variants used in apps/web/public/textures/
    try {
      trunkBase   = await loadTexture(doc, tex('Bonsai_LowPoly_Bonsai_Trunk_BaseColor.jpg'),       'image/jpeg');
      trunkNormal = await loadTexture(doc, tex('Bonsai_LowPoly_Bonsai_Trunk_LowPoly_NormalGL.jpg'), 'image/jpeg');
      trunkAMR    = await loadTexture(doc, tex('Bonsai_LowPoly_Bonsai_Trunk_AMR.jpg'),              'image/jpeg');
    } catch (e) {
      console.warn('[glb] wood textures not found; using flat material:', e);
    }
  }

  const woodMat = doc.createMaterial('wood_pbr')
    .setMetallicFactor(0.0)
    .setRoughnessFactor(0.8)
    .setDoubleSided(false);
  if (trunkBase)   woodMat.setBaseColorTexture(trunkBase);
  if (trunkNormal) woodMat.setNormalTexture(trunkNormal);
  if (trunkAMR)    woodMat.setMetallicRoughnessTexture(trunkAMR);

  // -- Leaf material (LEAF) with KHR_materials_transmission --
  let leavesBase:         ReturnType<typeof doc.createTexture> | null = null;
  let leavesNormal:       ReturnType<typeof doc.createTexture> | null = null;
  let leavesRoughness:    ReturnType<typeof doc.createTexture> | null = null;
  let leavesTranslucency: ReturnType<typeof doc.createTexture> | null = null;
  try {
    leavesBase         = await loadTexture(doc, tex('Bonsai_LowPoly_Leaves_BaseColor.png'),   'image/png');
    leavesNormal       = await loadTexture(doc, tex('Bonsai_LowPoly_Leaves_NormalGL.png'),    'image/png');
    leavesRoughness    = await loadTexture(doc, tex('Bonsai_LowPoly_Leaves_Roughness.png'),   'image/png');
    leavesTranslucency = await loadTexture(doc, tex('Leaves_Translucency.png'),               'image/png');
  } catch {
    try {
      leavesBase         = await loadTexture(doc, tex('Bonsai_LowPoly_Leaves_BaseColor.jpg'),  'image/jpeg');
      leavesNormal       = await loadTexture(doc, tex('Bonsai_LowPoly_Leaves_NormalGL.jpg'),   'image/jpeg');
      leavesRoughness    = await loadTexture(doc, tex('Bonsai_LowPoly_Leaves_Roughness.jpg'),  'image/jpeg');
      // Translucency stays PNG (data map -- lossless required)
      leavesTranslucency = await loadTexture(doc, tex('Leaves_Translucency.png'),              'image/png').catch(() => null as never);
    } catch (e) {
      console.warn('[glb] leaf textures not found; using flat material:', e);
    }
  }

  const leafMat = doc.createMaterial('leaf_pbr')
    .setMetallicFactor(0.0)
    .setRoughnessFactor(0.75)
    .setDoubleSided(true);
  if (leavesBase)      leafMat.setBaseColorTexture(leavesBase);
  if (leavesNormal)    leafMat.setNormalTexture(leavesNormal);
  if (leavesRoughness) leafMat.setMetallicRoughnessTexture(leavesRoughness);

  // KHR_materials_transmission for backlit leaf translucency.
  // doc.createExtension is idempotent -- returns the same instance if already registered.
  // We create a Transmission property, configure it, then attach it to the leaf material.
  const txExt = doc.createExtension(KHRMaterialsTransmission);
  const txProp: Transmission = txExt.createTransmission().setTransmissionFactor(0.3);
  if (leavesTranslucency) txProp.setTransmissionTexture(leavesTranslucency);
  leafMat.setExtension('KHR_materials_transmission', txProp);

  // -- Root material (ROOT + PRUNE_SCAR) -- flat dark brown, no textures needed --
  const rootMat = doc.createMaterial('root_flat')
    .setBaseColorFactor([0.239, 0.173, 0.102, 1.0]) // #3d2c1a
    .setMetallicFactor(0.0)
    .setRoughnessFactor(1.0);

  // Assign materials to primitives by traversing named meshes
  for (const mesh of doc.getRoot().listMeshes()) {
    const meshName = mesh.getName();
    for (const prim of mesh.listPrimitives()) {
      if (meshName === 'voxels_wood') {
        prim.setMaterial(woodMat);
      } else if (meshName === 'voxels_leaf') {
        prim.setMaterial(leafMat);
      } else if (meshName === 'voxels_root') {
        prim.setMaterial(rootMat);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main GLB builder entry point
// ---------------------------------------------------------------------------
export async function buildGlb(opts: GlbOptions): Promise<void> {
  const doc = new Document();

  // Register KHR_materials_transmission BEFORE creating any materials
  const transmissionExt = doc.createExtension(KHRMaterialsTransmission);

  const scene   = doc.createScene('kijonsai');
  const treeNode = doc.createNode('tree');
  scene.addChild(treeNode);

  // Partition voxels by material group
  const woodVoxels = opts.voxels.filter(v => WOOD_MATS.has(v.mat));
  const leafVoxels = opts.voxels.filter(v => v.mat === LEAF_MAT);
  const rootVoxels = opts.voxels.filter(v => ROOT_MATS.has(v.mat));

  // Build one merged mesh per material group and attach to scene tree
  if (woodVoxels.length > 0) {
    const mesh = buildMergedMesh(doc, 'voxels_wood', woodVoxels);
    treeNode.setMesh(mesh);
  }

  if (leafVoxels.length > 0) {
    const leafMesh = buildMergedMesh(doc, 'voxels_leaf', leafVoxels);
    const leafNode = doc.createNode('leaf_node').setMesh(leafMesh);
    treeNode.addChild(leafNode);
  }

  if (rootVoxels.length > 0) {
    const rootMesh = buildMergedMesh(doc, 'voxels_root', rootVoxels);
    const rootNode = doc.createNode('root_node').setMesh(rootMesh);
    treeNode.addChild(rootNode);
  }

  // Attach PBR textures and KHR_materials_transmission to named meshes
  await attachTextures(doc, opts.textureDir);

  // Pot mesh integration (OQ-P3): attempt to merge Bonsai_LowPoly.glb.
  // gltf-transform v4 does not expose Document.merge() -- we read the pot doc
  // and manually copy its root nodes as siblings of the voxel tree node.
  // If this fails for any reason, continue without the pot (non-fatal).
  try {
    const io = new NodeIO().registerExtensions([KHRMaterialsTransmission]);
    const potDoc = await io.read(opts.baseMeshPath);
    // Extract top-level nodes from the pot doc's default scene
    const potScene = potDoc.getRoot().listScenes()[0];
    if (potScene) {
      for (const potNode of potScene.listChildren()) {
        // Clone by serializing position/rotation/scale only (mesh data stays in potDoc)
        // Simplified: just record that the pot is a separate scene element.
        // Full node/mesh/material copy requires deep traversal; for Phase 1 we
        // log the pot's presence and skip deep merge to avoid cross-doc reference bugs.
        console.log(`[glb] pot GLB found (${potNode.getName()}); deep merge deferred to Phase 2`);
      }
    }
  } catch (potErr) {
    console.warn('[glb] pot mesh integration skipped (OQ-P3 Phase 1):', potErr);
  }

  // Write GLB binary
  const io = new NodeIO().registerExtensions([KHRMaterialsTransmission]);
  const glbBuffer = await io.writeBinary(doc);
  await fs.writeFile(opts.outPath, glbBuffer);

  // Suppress unused variable warning (extension registered for side-effect)
  void transmissionExt;
}
