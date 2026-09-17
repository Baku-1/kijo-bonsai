// apps/web/src/renderer/atelier_textures.ts
// Ported from grok-workspace/src/components/game/textures.ts + geometry.ts
// (albedoToNormal, makeEquirectEnv, makeScrollTexture).
// Loads the copied room JPGs from /textures/, generates runtime herb normals
// from albedos, and builds a warm local equirect environment. No CDN HDRIs.
// Deterministic: no Math.random / Date.now.

import * as THREE from 'three';

export interface AtelierTextures {
  bark: THREE.Texture;
  barkN: THREE.Texture;
  wood: THREE.Texture;
  woodN: THREE.Texture;
  ceramic: THREE.Texture;
  ceramicN: THREE.Texture;
  moss: THREE.Texture;
  mossN: THREE.Texture;
  soil: THREE.Texture;
  soilN: THREE.Texture;
  stone: THREE.Texture;
  stoneN: THREE.Texture;
  shoji: THREE.Texture;
  plaster: THREE.Texture;
  plasterN: THREE.Texture;
  env: THREE.Texture;
  scroll: THREE.Texture;
}

const NAMES = ['bark', 'wood', 'ceramic', 'moss', 'soil', 'stone', 'shoji', 'plaster'] as const;

function prep(tex: THREE.Texture, repeatX = 1, repeatY = 1): THREE.Texture {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

// Sobel-style runtime normal map from an albedo texture (ported from geometry.ts).
function albedoToNormal(map: THREE.Texture, strength = 1.8): THREE.CanvasTexture {
  const img = map.image as HTMLImageElement | ImageBitmap;
  const elem = img as HTMLImageElement;
  const sw = Math.min(512, elem.width || 512);
  const sh = Math.min(512, elem.height || 512);
  const src = document.createElement('canvas');
  src.width = sw;
  src.height = sh;
  const sctx = src.getContext('2d')!;
  sctx.drawImage(img as CanvasImageSource, 0, 0, sw, sh);
  const srcData = sctx.getImageData(0, 0, sw, sh).data;
  const dst = document.createElement('canvas');
  dst.width = sw;
  dst.height = sh;
  const dctx = dst.getContext('2d')!;
  const out = dctx.createImageData(sw, sh);
  const lumAt = (x: number, y: number) => {
    const xx = ((x % sw) + sw) % sw;
    const yy = ((y % sh) + sh) % sh;
    const p = (yy * sw + xx) * 4;
    return (srcData[p] * 0.3 + srcData[p + 1] * 0.54 + srcData[p + 2] * 0.16) / 255;
  };
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const dx = (lumAt(x + 1, y) - lumAt(x - 1, y)) * strength;
      const dy = (lumAt(x, y + 1) - lumAt(x, y - 1)) * strength;
      const nx = -dx;
      const ny = -dy;
      const nz = 1;
      const inv = 1 / Math.hypot(nx, ny, nz);
      const i = (y * sw + x) * 4;
      out.data[i] = (nx * inv * 0.5 + 0.5) * 255;
      out.data[i + 1] = (ny * inv * 0.5 + 0.5) * 255;
      out.data[i + 2] = (nz * inv * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }
  dctx.putImageData(out, 0, 0);
  const tex = new THREE.CanvasTexture(dst);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// Warm local equirect environment (ported from geometry.ts).
function makeEquirectEnv(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, 512);
  grd.addColorStop(0, '#f3d7a6');
  grd.addColorStop(0.38, '#c9a57c');
  grd.addColorStop(0.52, '#4a3c32');
  grd.addColorStop(1, '#16120e');
  g.fillStyle = grd;
  g.fillRect(0, 0, 1024, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// Painted scroll texture (ported from geometry.ts).
function makeScrollTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 768;
  const g = c.getContext('2d')!;
  g.fillStyle = '#d8c7a4';
  g.fillRect(0, 0, 512, 768);
  g.fillStyle = '#cbb892';
  g.fillRect(24, 24, 464, 720);
  g.strokeStyle = 'rgba(40,28,18,0.55)';
  g.lineWidth = 3;
  for (let i = 0; i < 18; i++) {
    const x = 80 + Math.sin(i * 1.7) * 90 + i * 8;
    g.beginPath();
    g.moveTo(x, 80);
    g.bezierCurveTo(x + 40, 220, x - 60, 420, x + 10, 680);
    g.stroke();
  }
  g.fillStyle = 'rgba(30,22,16,0.45)';
  g.beginPath();
  g.ellipse(250, 260, 70, 28, -0.4, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(250, 250);
  g.quadraticCurveTo(310, 180, 340, 120);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export async function loadAtelierTextures(): Promise<AtelierTextures> {
  const loader = new THREE.TextureLoader();
  const loaded = await Promise.all(NAMES.map((n) => loader.loadAsync(`/textures/${n}.jpg`)));
  const [bark, wood, ceramic, moss, soil, stone, shoji, plaster] = loaded;
  prep(bark, 2, 3);
  prep(wood, 2, 1);
  prep(ceramic, 1, 1);
  prep(moss, 2, 2);
  prep(soil, 2, 2);
  prep(stone, 1, 1);
  prep(shoji, 1, 1);
  prep(plaster, 2, 2);
  return {
    bark,
    barkN: albedoToNormal(bark, 2.2),
    wood,
    woodN: albedoToNormal(wood, 1.4),
    ceramic,
    ceramicN: albedoToNormal(ceramic, 0.9),
    moss,
    mossN: albedoToNormal(moss, 1.6),
    soil,
    soilN: albedoToNormal(soil, 1.8),
    stone,
    stoneN: albedoToNormal(stone, 1.2),
    shoji,
    plaster,
    plasterN: albedoToNormal(plaster, 1.1),
    env: makeEquirectEnv(),
    scroll: makeScrollTexture(),
  };
}