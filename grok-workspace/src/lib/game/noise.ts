export function hash(n: number) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

export function hash3(x: number, y: number, z: number) {
  return hash(x * 19.19 + y * 47.7 + z * 13.13);
}

export function valueNoise3(x: number, y: number, z: number) {
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

export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 1;
  }
  next() {
    this.s = (this.s * 1664525 + 1013904223) >>> 0;
    return this.s / 0xffffffff;
  }
  range(a: number, b: number) {
    return a + (b - a) * this.next();
  }
}
