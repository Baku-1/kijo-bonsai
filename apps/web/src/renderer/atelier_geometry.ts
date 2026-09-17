// apps/web/src/renderer/atelier_geometry.ts
// Ported from grok-workspace/src/lib/game/geometry.ts + noise.ts.
// Deterministic geometry helpers for the Bonsai Atelier room.
// No Math.random / Date.now -- lumpy geometry uses value noise, dust uses a
// seeded LCG (Rng). All randomness flows from a constant seed.

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Deterministic hash / value noise (ported from noise.ts)
// ---------------------------------------------------------------------------
export function hash(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function hash3(x: number, y: number, z: number): number {
  return hash(x * 19.19 + y * 47.7 + z * 13.13);
}

export function valueNoise3(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const w = fz * fz * (3 - 2 * fz);
  const n = (i: number, j: number, k: number) => hash3(i, j, k);
  const x0 =
    n(ix, iy, iz) * (1 - v) * (1 - w) +
    n(ix, iy + 1, iz) * v * (1 - w) +
    n(ix, iy, iz + 1) * (1 - v) * w +
    n(ix, iy + 1, iz + 1) * v * w;
  const x1 =
    n(ix + 1, iy, iz) * (1 - v) * (1 - w) +
    n(ix + 1, iy + 1, iz) * v * (1 - w) +
    n(ix + 1, iy, iz + 1) * (1 - v) * w +
    n(ix + 1, iy + 1, iz + 1) * v * w;
  return x0 * (1 - u) + x1 * u;
}

// Seeded LCG -- deterministic replacement for Math.random (ported from noise.ts).
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 1;
  }
  next(): number {
    this.s = (this.s * 1664525 + 1013904223) >>> 0;
    return this.s / 0xffffffff;
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
}

// ---------------------------------------------------------------------------
// Lumpy icosahedron blob (ported from geometry.ts) -- used for moss/stones.
// ---------------------------------------------------------------------------
export function lumpIcosahedron(
  radius: number,
  flatten: number,
  seed: number,
  detail = 3,
): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = valueNoise3(v.x * 3.4 + seed, v.y * 3.4, v.z * 3.4 + seed * 0.3);
    const n2 = valueNoise3(v.x * 8 + seed, v.y * 8, v.z * 8);
    v.multiplyScalar(1 + n * 0.28 + n2 * 0.08);
    v.y *= flatten;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
// Ceramic pot lathe profile (ported from geometry.ts).
// ---------------------------------------------------------------------------
export function potLathe(): THREE.LatheGeometry {
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.168, 0.0),
    new THREE.Vector2(0.186, 0.012),
    new THREE.Vector2(0.172, 0.026),
    new THREE.Vector2(0.154, 0.04),
    new THREE.Vector2(0.148, 0.12),
    new THREE.Vector2(0.152, 0.155),
    new THREE.Vector2(0.178, 0.168),
    new THREE.Vector2(0.17, 0.184),
    new THREE.Vector2(0.148, 0.184),
  ];
  return new THREE.LatheGeometry(pts, 48);
}
