// apps/render-worker/src/blender.ts
// Spawns Blender in headless (--background) mode to render a voxel tree to PNG.
// The Python script (scripts/render_tree.py) receives the voxel JSON via --voxel-data arg.

import { spawn } from 'child_process';

export interface BlenderOptions {
  blendFile: string;  // path to Bonsai-Raw.blend (absolute or relative to CWD)
  script:    string;  // path to render_tree.py (absolute or relative to CWD)
  tokenId:   number;
  outPath:   string;  // absolute path for PNG output, e.g. /tmp/render_42.png
  voxelData: string;  // JSON string: { seed, voxels: [...] }
}

export function invokeBlender(opts: BlenderOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '--background', opts.blendFile,
      '--python', opts.script,
      '--',
      '--token-id', String(opts.tokenId),
      '--out', opts.outPath,
      '--voxel-data', opts.voxelData,
    ];

    console.log(
      `[blender] spawning: blender ${args.slice(0, 4).join(' ')} -- --token-id ${opts.tokenId} ...`,
    );

    const proc = spawn('blender', args, { stdio: ['ignore', 'pipe', 'pipe'] });

    proc.stdout.on('data', (d: Buffer) => process.stdout.write(d));
    proc.stderr.on('data', (d: Buffer) => process.stderr.write(d));

    proc.on('error', (err: Error) =>
      reject(new Error(`Blender spawn failed: ${err.message}`)),
    );

    proc.on('close', (code: number | null) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Blender exited with code ${code ?? 'null'} for token ${opts.tokenId}`));
      }
    });
  });
}
