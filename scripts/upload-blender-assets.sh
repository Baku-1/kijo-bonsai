#!/usr/bin/env bash
# scripts/upload-blender-assets.sh
# Creates a GitHub Release and uploads Blender assets for the render worker.
#
# Run from the kijo-bonsai repo root:
#   bash scripts/upload-blender-assets.sh
#
# Prerequisites:
#   - GitHub CLI (gh) installed and authenticated: https://cli.github.com/
#   - zip utility installed
#   - Assets exist at ../assets/ (the kijo/assets/ directory alongside kijo-bonsai/)

set -euo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
TAG="blender-assets-v1"
REPO="Baku-1/kijo-bonsai"
ASSET_DIR="../assets"

BLEND_FILE="${ASSET_DIR}/Bonsai-Raw.blend"
TEXTURE_DIR="${ASSET_DIR}/Textures"
POT_GLB="${ASSET_DIR}/Bonsai-GLB/Bonsai_LowPoly.glb"
PLACEHOLDER_PNG="${ASSET_DIR}/images/placeholder.png"

# ---------------------------------------------------------------------------
# Preflight checks
# ---------------------------------------------------------------------------
if ! command -v gh &> /dev/null; then
  echo "ERROR: GitHub CLI (gh) is not installed."
  echo ""
  echo "Install it:"
  echo "  Windows:  winget install --id GitHub.cli"
  echo "  macOS:    brew install gh"
  echo "  Linux:    https://github.com/cli/cli/blob/trunk/docs/install_linux.md"
  echo ""
  echo "Then authenticate:  gh auth login"
  exit 1
fi

if ! gh auth status &> /dev/null; then
  echo "ERROR: gh is not authenticated. Run:  gh auth login"
  exit 1
fi

if ! command -v zip &> /dev/null; then
  echo "ERROR: zip is not installed."
  echo "  Windows:  Install via Git Bash (ships with it) or choco install zip"
  echo "  macOS:    brew install zip  (usually pre-installed)"
  echo "  Linux:    sudo apt-get install zip"
  exit 1
fi

if [ ! -f "$BLEND_FILE" ]; then
  echo "ERROR: Bonsai-Raw.blend not found at: $BLEND_FILE"
  echo "Run this script from the kijo-bonsai repo root."
  exit 1
fi

if [ ! -d "$TEXTURE_DIR" ]; then
  echo "ERROR: Textures directory not found at: $TEXTURE_DIR"
  exit 1
fi

if [ ! -f "$PLACEHOLDER_PNG" ]; then
  echo "ERROR: placeholder.png not found at: $PLACEHOLDER_PNG"
  exit 1
fi

# ---------------------------------------------------------------------------
# Create Textures.zip
# ---------------------------------------------------------------------------
TEXTURES_ZIP="$(mktemp -d)/Textures.zip"
echo "Zipping Textures directory..."
(cd "$ASSET_DIR" && zip -r "$TEXTURES_ZIP" Textures/)
echo "Created: $TEXTURES_ZIP ($(du -h "$TEXTURES_ZIP" | cut -f1))"

# ---------------------------------------------------------------------------
# Collect upload files
# ---------------------------------------------------------------------------
UPLOAD_FILES=("$BLEND_FILE" "$TEXTURES_ZIP" "$PLACEHOLDER_PNG")
echo "Including placeholder: $PLACEHOLDER_PNG"

if [ -f "$POT_GLB" ]; then
  UPLOAD_FILES+=("$POT_GLB")
  echo "Including pot mesh: $POT_GLB"
else
  echo "WARNING: Bonsai_LowPoly.glb not found at $POT_GLB -- skipping (GLB builds will fail silently)"
fi

# ---------------------------------------------------------------------------
# Create release (or upload to existing)
# ---------------------------------------------------------------------------
if gh release view "$TAG" --repo "$REPO" &> /dev/null; then
  echo ""
  echo "Release '$TAG' already exists. Uploading assets with --clobber..."
  gh release upload "$TAG" "${UPLOAD_FILES[@]}" \
    --repo "$REPO" \
    --clobber
else
  echo ""
  echo "Creating release '$TAG'..."
  gh release create "$TAG" "${UPLOAD_FILES[@]}" \
    --repo "$REPO" \
    --title "Blender Render Assets v1" \
    --notes "Blender assets for the kijo render worker (Railway Docker build).
- Bonsai-Raw.blend: base scene with template objects and lighting
- Textures.zip: PBR texture maps for GLB builder
- Bonsai_LowPoly.glb: pot base mesh (if included)

These files are downloaded at Docker build time by apps/render-worker/Dockerfile."
fi

# ---------------------------------------------------------------------------
# Clean up temp zip
# ---------------------------------------------------------------------------
rm -f "$TEXTURES_ZIP"

# ---------------------------------------------------------------------------
# Print download URLs
# ---------------------------------------------------------------------------
BASE_URL="https://github.com/${REPO}/releases/download/${TAG}"
echo ""
echo "========================================="
echo "  Upload complete!"
echo "========================================="
echo ""
echo "Download URLs (used by Dockerfile and nft-image):"
echo "  Bonsai-Raw.blend:    ${BASE_URL}/Bonsai-Raw.blend"
echo "  Textures.zip:        ${BASE_URL}/Textures.zip"
echo "  placeholder.png:     ${BASE_URL}/placeholder.png"
if [ -f "$POT_GLB" ]; then
  echo "  Bonsai_LowPoly.glb: ${BASE_URL}/Bonsai_LowPoly.glb"
fi
echo ""
echo "Release page: https://github.com/${REPO}/releases/tag/${TAG}"
