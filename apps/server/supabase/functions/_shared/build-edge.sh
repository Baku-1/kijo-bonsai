#!/usr/bin/env bash
# build-edge.sh -- Bundles @kijo/engine + @kijo/voxelizer into a single ESM file
# for deployment with Supabase Edge Functions (Deno runtime).
#
# Usage (from monorepo root):
#   bash apps/server/supabase/functions/_shared/build-edge.sh
#
# Regenerate whenever packages/engine, packages/voxelizer, or packages/shared change.
# The output file (kijo-engine.js) is committed to the repo so supabase deploy
# has no CI dependency on npm workspace packages.
#
# Strategy: write a synthetic entry file at the repo root (where node_modules/@kijo
# symlinks live) so esbuild resolves workspace packages correctly. The entry file is
# removed after bundling. Multiple workspace packages are merged into one --outfile.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../../.." && pwd)"
OUT="$REPO_ROOT/apps/server/supabase/functions/_shared/kijo-engine.js"
ESBUILD="$REPO_ROOT/node_modules/.bin/esbuild"
ENTRY="$REPO_ROOT/_kijo_bundle_entry_tmp.js"

if [[ ! -x "$ESBUILD" ]]; then
  echo "[build-edge] ERROR: esbuild not found at $ESBUILD" >&2
  echo "[build-edge] Run: npm install from $REPO_ROOT" >&2
  exit 1
fi

echo "[build-edge] bundling kijo engine packages..."
echo "[build-edge] repo root: $REPO_ROOT"
echo "[build-edge] output:    $OUT"

# Write synthetic entry at repo root so node_modules/@kijo resolves correctly.
cat > "$ENTRY" << 'ENTRY_EOF'
export * from '@kijo/engine';
export * from '@kijo/voxelizer';
export * from '@kijo/shared';
ENTRY_EOF

trap "rm -f '$ENTRY'" EXIT

# Bundle: @kijo/shared is included transitively (engine + voxelizer both import it).
# --platform=browser: avoids Node.js shims; engine is pure computation.
# --format=esm: required by Deno runtime.
"$ESBUILD" \
  "$ENTRY" \
  --bundle \
  --platform=browser \
  --format=esm \
  --outfile="$OUT" \
  --log-level=warning

SIZE=$(wc -c < "$OUT")
echo "[build-edge] bundle complete: $OUT ($SIZE bytes)"
