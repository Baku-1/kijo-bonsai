# apps/render-worker/scripts/render_tree.py
# Runs inside Blender's embedded Python (bpy available).
# Opens kijo/assets/Bonsai-Raw.blend (loaded by Blender before script runs),
# places voxel instances from template objects, and renders to PNG.
#
# Invocation (from worker.ts via invokeBlender):
#   blender --background kijo/assets/Bonsai-Raw.blend \
#     --python apps/render-worker/scripts/render_tree.py \
#     -- \
#     --token-id 42 \
#     --out /tmp/render_42.png \
#     --voxel-data '{"seed":464497,"voxels":[...]}'
#
# No random() calls -- spatial_hash provides deterministic leaf rotation.

import bpy
import sys
import json
import math
import argparse

# ---------------------------------------------------------------------------
# Template object names in Bonsai-Raw.blend.
# Jeremy must have these objects in the .blend with their materials pre-assigned,
# hidden from render in the base scene (hide_render=True).
# Each is a single-voxel-sized mesh primitive used as a copy source.
# ---------------------------------------------------------------------------
MAT_NAMES = {
    1: 'tpl_heartwood',
    2: 'tpl_bark',
    3: 'tpl_branch_wood',
    4: 'tpl_leaf',
    5: 'tpl_root',
    6: 'tpl_prune_scar',   # Phase 1 fallback: if absent, alias to tpl_bark
}

LEAF_MAT_ID = 4

# Coordinate mapping constants -- must match glb.ts and packages/shared/src/index.ts
VOXEL_SCALE = 0.08   # Blender world units per voxel
CENTER      = 128    # Voxel grid center for X and Z (trunk base at voxel (128, 38, 128))
BASE_Y      = 38     # Voxel y=38 maps to Blender Z=0 (pot rim / trunk base)


def parse_args():
    """Extract script args from sys.argv after the '--' separator."""
    argv = sys.argv[sys.argv.index('--') + 1:]
    parser = argparse.ArgumentParser()
    parser.add_argument('--token-id',   type=int, required=True)
    parser.add_argument('--out',        type=str, required=True)
    parser.add_argument('--voxel-data', type=str, required=True)
    return parser.parse_args(argv)


def get_template_object(mat_id):
    """
    Fetch the named template object from the loaded .blend scene.
    Phase 1 fallback: tpl_prune_scar may not yet be authored -- use tpl_bark.
    Raises ValueError if the required object is missing (misconfigured .blend).
    """
    name = MAT_NAMES.get(mat_id)
    if name is None:
        raise ValueError(f'Unknown mat_id: {mat_id}')
    obj = bpy.data.objects.get(name)
    if obj is None and mat_id == 6:
        obj = bpy.data.objects.get('tpl_bark')   # Phase 1 fallback
    if obj is None:
        raise ValueError(
            f'Template object "{name}" not found in Bonsai-Raw.blend. '
            f'Jeremy must author this object in the .blend file.'
        )
    return obj


def hide_template_objects():
    """
    Hide all template objects (tpl_*) from the render pass.
    Called before placing any voxel instances so source meshes don't appear
    in the output image.
    """
    for obj in bpy.data.objects:
        if obj.name.startswith('tpl_'):
            obj.hide_render = True


def spatial_hash(seed, x, y, z):
    """
    Deterministic hash for leaf Y-rotation.

    MUST match spatialHash() in packages/shared/src/index.ts exactly.
    Verified step-by-step 2026-08-17.

    TS returns raw uint32; Python divides by 2^32 to normalize to [0, 1).
    Used only for leaf rotation: angle_radians = spatial_hash(...) * 2 * pi.

    TS source (packages/shared/src/index.ts line 364-371):
      const packed = ((x & 0xFF) << 16) | ((y & 0xFF) << 8) | (z & 0xFF);
      let h = (seed ^ packed) >>> 0;
      h = (h += 0x6D2B79F5) >>> 0;
      h = Math.imul(h ^ (h >>> 15), h | 1) >>> 0;
      h ^= h + (Math.imul(h ^ (h >>> 7), h | 61) >>> 0);
      return (h ^ (h >>> 14)) >>> 0;

    Python equivalent (>>> 0 = & 0xFFFFFFFF for uint32 truncation):
    """
    packed = ((x & 0xFF) << 16) | ((y & 0xFF) << 8) | (z & 0xFF)
    h = (seed ^ packed) & 0xFFFFFFFF
    h = (h + 0x6D2B79F5) & 0xFFFFFFFF
    h = ((h ^ (h >> 15)) * (h | 1)) & 0xFFFFFFFF
    h = (h ^ (h + ((h ^ (h >> 7)) * (h | 61) & 0xFFFFFFFF))) & 0xFFFFFFFF
    h = (h ^ (h >> 14)) & 0xFFFFFFFF
    return h / 4294967296.0   # normalize uint32 -> [0, 1)


def main():
    args = parse_args()
    payload = json.loads(args.voxel_data)
    seed    = payload['seed']
    voxels  = payload['voxels']

    # 1. Hide template source objects from the render
    hide_template_objects()

    # 2. Group voxels by material ID for batch instancing
    groups = {}
    for v in voxels:
        groups.setdefault(v['mat'], []).append((v['x'], v['y'], v['z']))

    # 3. Place voxel instances
    #
    # COORDINATE MAPPING (Z-up -- Blender default convention):
    #   Voxel grid is Y-up (trunk grows in +Y direction).
    #   Blender uses Z-up (Z is world "up").
    #   Mapping (confirmed by Jeremy 2026-08-17):
    #     Blender X = (voxel_x - CENTER) * VOXEL_SCALE   [left/right, centered on trunk]
    #     Blender Y = (voxel_z - CENTER) * VOXEL_SCALE   [depth, centered]
    #     Blender Z =  voxel_y           * VOXEL_SCALE   [up, NOT centered -- root at y=34]
    #
    for mat_id, positions in groups.items():
        template = get_template_object(mat_id)
        for (x, y, z) in positions:
            obj          = template.copy()
            obj.data     = template.data   # linked mesh -- saves memory (read-only placement)
            obj.hide_render = False        # instance is visible even though template is hidden
            bpy.context.collection.objects.link(obj)

            obj.location = (
                (x - CENTER) * VOXEL_SCALE,   # Blender X  (left/right)
                (z - CENTER) * VOXEL_SCALE,   # Blender Y  (depth)
                 y            * VOXEL_SCALE,   # Blender Z  (up)
            )

            # Leaf: deterministic Y-axis rotation for visual variety.
            # spatial_hash returns [0, 1) -- multiply by 2*pi for full rotation.
            # No Math.random() -- determinism invariant preserved.
            if mat_id == LEAF_MAT_ID:
                obj.rotation_euler[2] = spatial_hash(seed, x, y, z) * math.pi * 2

    # 4. Render settings
    scene = bpy.context.scene
    scene.render.engine                      = 'CYCLES'
    scene.cycles.samples                     = 64      # ~3-8 min on Railway CPU; tune post-deploy
    scene.render.resolution_x               = 1024
    scene.render.resolution_y               = 1024
    scene.render.filepath                   = args.out
    scene.render.image_settings.file_format = 'PNG'

    # 5. Render to file
    bpy.ops.render.render(write_still=True)
    print(f'[render_tree.py] render complete -> {args.out}')


main()
