import * as THREE from "three";
import { valueNoise3 } from "./noise";

export function taperedTube(
  start: THREE.Vector3,
  ctrl: THREE.Vector3,
  end: THREE.Vector3,
  radiusStart: number,
  radiusEnd: number,
  tubular = 16,
  radial = 8,
): THREE.BufferGeometry {
  const curve = new THREE.QuadraticBezierCurve3(start, ctrl, end);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const len = Math.max(0.08, start.distanceTo(end));
  const tan = new THREE.Vector3();
  const N = new THREE.Vector3(1, 0, 0);
  const B = new THREE.Vector3();
  const p = new THREE.Vector3();

  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    const r = THREE.MathUtils.lerp(radiusStart, radiusEnd, t);
    curve.getPoint(t, p);
    curve.getTangent(t, tan);
    if (tan.lengthSq() < 1e-8) tan.set(0, 1, 0);
    tan.normalize();
    N.addScaledVector(tan, -N.dot(tan));
    if (N.lengthSq() < 1e-6) {
      N.set(0, 0, 1).addScaledVector(tan, -tan.z);
      if (N.lengthSq() < 1e-6) N.set(1, 0, 0);
    }
    N.normalize();
    B.crossVectors(tan, N).normalize();
    N.crossVectors(B, tan).normalize();
    for (let j = 0; j <= radial; j++) {
      const u = j / radial;
      const angle = u * Math.PI * 2;
      const cx = Math.cos(angle);
      const sx = Math.sin(angle);
      const nx = N.x * cx + B.x * sx;
      const ny = N.y * cx + B.y * sx;
      const nz = N.z * cx + B.z * sx;
      positions.push(p.x + nx * r, p.y + ny * r, p.z + nz * r);
      normals.push(nx, ny, nz);
      uvs.push(u * 2.2, t * len * 6);
    }
  }
  for (let i = 0; i < tubular; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

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

export function makeEquirectEnv(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 512;
  const g = c.getContext("2d")!;
  const grd = g.createLinearGradient(0, 0, 0, 512);
  grd.addColorStop(0, "#f3d7a6");
  grd.addColorStop(0.38, "#c9a57c");
  grd.addColorStop(0.52, "#4a3c32");
  grd.addColorStop(1, "#16120e");
  g.fillStyle = grd;
  g.fillRect(0, 0, 1024, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function albedoToNormal(map: THREE.Texture, strength = 1.8): THREE.CanvasTexture {
  const img = map.image as HTMLImageElement | ImageBitmap;
  const sw = Math.min(512, (img as HTMLImageElement).width || 512);
  const sh = Math.min(512, (img as HTMLImageElement).height || 512);
  const src = document.createElement("canvas");
  src.width = sw;
  src.height = sh;
  const sctx = src.getContext("2d")!;
  sctx.drawImage(img as CanvasImageSource, 0, 0, sw, sh);
  const srcData = sctx.getImageData(0, 0, sw, sh).data;
  const dst = document.createElement("canvas");
  dst.width = sw;
  dst.height = sh;
  const dctx = dst.getContext("2d")!;
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

export function makeScrollTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 768;
  const g = c.getContext("2d")!;
  g.fillStyle = "#d8c7a4";
  g.fillRect(0, 0, 512, 768);
  g.fillStyle = "#cbb892";
  g.fillRect(24, 24, 464, 720);
  g.strokeStyle = "rgba(40,28,18,0.55)";
  g.lineWidth = 3;
  for (let i = 0; i < 18; i++) {
    const x = 80 + Math.sin(i * 1.7) * 90 + i * 8;
    g.beginPath();
    g.moveTo(x, 80);
    g.bezierCurveTo(x + 40, 220, x - 60, 420, x + 10, 680);
    g.stroke();
  }
  g.fillStyle = "rgba(30,22,16,0.45)";
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
