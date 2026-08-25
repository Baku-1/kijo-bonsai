FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# System deps for Blender headless (--background mode)
# libxi6, libxxf86vm1, libxfixes3, libxrender1, libgl1 required by Blender binary
# even in headless mode. Add libxrandr2 if Blender complains on startup.
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    xz-utils \
    unzip \
    libxi6 \
    libxxf86vm1 \
    libxfixes3 \
    libxrender1 \
    libgl1 \
    ca-certificates \
    curl \
  && rm -rf /var/lib/apt/lists/*

# Blender 4.2.23 LTS (pinned for render reproducibility)
# 4.2.23 is the latest 4.2 LTS patch as of 2026-07-21 (23 months of bugfixes over 4.2.0)
RUN wget -q https://download.blender.org/release/Blender4.2/blender-4.2.23-linux-x64.tar.xz \
  && tar -xf blender-4.2.23-linux-x64.tar.xz -C /opt \
  && ln -s /opt/blender-4.2.23-linux-x64/blender /usr/local/bin/blender \
  && rm blender-4.2.23-linux-x64.tar.xz

# Node.js 20 LTS via NodeSource
# NOTE: Ubuntu 22.04 apt repos ship Node.js 12.x (EOL). Do NOT use
# `apt-get install nodejs` -- it will install an incompatible version.
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
  && apt-get install -y nodejs \
  && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
# Download Blender assets from GitHub Releases (cached Docker layer).
# This layer is invalidated ONLY when ASSET_TAG changes, not on code changes.
# Assets are uploaded via: bash scripts/upload-blender-assets.sh
#
# worker.ts expects:
#   /app/assets/Bonsai-Raw.blend   (blend file for Blender --background)
#   /app/assets/Textures/          (PBR textures for GLB builder)
#   /app/assets/Bonsai-GLB/Bonsai_LowPoly.glb  (pot mesh for GLB merge)
# ---------------------------------------------------------------------------
ARG ASSET_TAG=blender-assets-v1
WORKDIR /app
RUN mkdir -p /app/assets/Bonsai-GLB \
  && wget -q --show-progress -O /app/assets/Bonsai-Raw.blend \
     "https://github.com/Baku-1/kijo-bonsai/releases/download/${ASSET_TAG}/Bonsai-Raw.blend" \
  && wget -q --show-progress -O /tmp/Textures.zip \
     "https://github.com/Baku-1/kijo-bonsai/releases/download/${ASSET_TAG}/Textures.zip" \
  && unzip -q /tmp/Textures.zip -d /app/assets/ \
  && rm /tmp/Textures.zip

# Pot mesh for GLB merge (non-fatal -- GLB build has try/catch in worker.ts)
RUN wget -q -O /app/assets/Bonsai-GLB/Bonsai_LowPoly.glb \
     "https://github.com/Baku-1/kijo-bonsai/releases/download/${ASSET_TAG}/Bonsai_LowPoly.glb" \
     || echo "WARNING: Bonsai_LowPoly.glb not in release -- GLB builds will fail silently"

# ---------------------------------------------------------------------------
# Copy repo source (Railway root = kijo-bonsai/ repo root).
# Build context is kijo-bonsai/, so COPY . . gives the repo contents.
# Place into /app/kijo-bonsai/ to match worker.ts path expectations.
# ---------------------------------------------------------------------------
COPY . /app/kijo-bonsai/

# Install render-worker workspace package and its @kijo/* dependencies
WORKDIR /app/kijo-bonsai
RUN npm install --workspace=apps/render-worker --include-workspace-root

# Environment variables (set in Railway dashboard, not here):
#   SUPABASE_URL
#   SUPABASE_SERVICE_ROLE_KEY

# CMD runs from /app/kijo-bonsai; asset paths use /app/assets/
CMD ["./node_modules/.bin/tsx", "apps/render-worker/src/worker.ts"]
