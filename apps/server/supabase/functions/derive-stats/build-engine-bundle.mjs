#!/usr/bin/env node
/**
 * build-engine-bundle.mjs -- builds engine.bundle.mjs for the derive-stats
 * Supabase Edge Function.
 *
 * WHY A BUNDLE:
 *   Supabase's Deno runtime cannot resolve the monorepo workspace paths
 *   (../../../../packages/*/dist/index.js) at deploy time -- the engine
 *   packages are not published to npm and have no publishConfig. See the
 *   header comment of get-tree/index.ts for the original failure. The fix is
 *   to bundle the engine into ONE self-contained ESM file that the function
 *   imports with a plain relative path.
 *
 * BUILD (from repo root -- run BEFORE `supabase functions deploy`):
 *   npm run build:engine-bundle
 *   # or, without the npm alias:
 *   node apps/server/supabase/functions/derive-stats/build-engine-bundle.mjs
 *
 *   Prerequisite: `npm install` at the repo root (esbuild 0.21 is already in
 *   the lockfile as a transitive dependency of @kijo/web/vite; this script
 *   loads it from node_modules).
 *
 * OUTPUT:
 *   apps/server/supabase/functions/derive-stats/engine.bundle.mjs
 *   -- self-contained ESM with ZERO import statements (verified below).
 *
 * The bundle is committed to the repo (same policy as the nft-metadata engine
 * bundle in docs/NFT-METADATA-IMAGE-ARCH.md). Regenerate it whenever
 * packages/engine, packages/voxelizer, or packages/shared changes.
 *
 * DEPLOY (from apps/server/supabase):
 *   cd apps/server/supabase
 *   supabase functions deploy derive-stats
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

let esbuild;
try {
  esbuild = await import('esbuild');
} catch (err) {
  console.error('[build-engine-bundle] Cannot load esbuild from node_modules.');
  console.error('  Run `npm install` at the repo root first, then retry.');
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
// derive-stats -> functions -> supabase -> server -> apps -> repo root
const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url));

const entryPoint = join(here, 'engine-entry.mjs');
const outfile = join(here, 'engine.bundle.mjs');

const REQUIRED_EXPORTS = ['CareLogReplay', 'StatDeriver', 'BonsaiTree', 'Voxelizer'];

try {
  await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    format: 'esm',
    // Deno target: no node/browser globals are assumed. The engine is pure
    // math (no I/O), so the bundle is runtime-agnostic ESM.
    platform: 'neutral',
    target: 'esnext',
    outfile,
    logLevel: 'info',
    legalComments: 'none',
    sourcemap: false,
  });
} catch (err) {
  console.error('[build-engine-bundle] esbuild failed.');
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

// Verify the output is truly self-contained -- the exact failure mode from
// get-tree/index.ts was relative workspace imports that Deno could not
// resolve at deploy time.
const out = readFileSync(outfile, 'utf8');
if (/(^|\n)\s*import\s/.test(out)) {
  console.error(
    '[build-engine-bundle] FAIL: engine.bundle.mjs still contains import statements - not self-contained.',
  );
  process.exit(1);
}
for (const sym of REQUIRED_EXPORTS) {
  if (!new RegExp(`\\b${sym}\\b`).test(out)) {
    console.error(`[build-engine-bundle] FAIL: engine.bundle.mjs is missing export ${sym}.`);
    process.exit(1);
  }
}

const kb = (out.length / 1024).toFixed(1);
console.log(`[build-engine-bundle] OK: ${outfile} (${kb} KB, self-contained).`);
console.log('[build-engine-bundle] Next: cd apps/server/supabase && supabase functions deploy derive-stats');
