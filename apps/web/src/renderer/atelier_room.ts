// apps/web/src/renderer/atelier_room.ts
// Ported from grok-workspace/src/components/game/Atelier.tsx (vanilla three.js,
// no React / no @react-three/fiber).
//
// Builds the Bonsai Atelier workshop room around the canonical voxel tree:
// plaster walls, hinoki wood floor, shoji window on the -X side with god rays
// and garden glow, dark wet ceramic pot with soil/moss/stones at the tree base,
// hinoki workbench with copper watering can + shears, dust motes in the light
// shaft, scroll.
//
// SCALE: the grok atelier is authored around a ~2-unit tabletop tree. The
// canonical voxel tree is 8-15+ world units tall with its trunk base at y=0.
// The whole room is wrapped in a group scaled by S (default 8 for the NFT
// viewer) and translated (ROOM_Y) so the grok soil plane (its local y=0.96)
// lands exactly on world y=baseY (default 0) -- the tree base -- so the trunk
// visually emerges from the pot soil. The care scenes pass scale ~110 so the
// room encloses their ~150-200-unit trees (1 voxel = 1 world unit). Room
// pieces contain the orbit camera with overhead ceiling and distant walls.
//
// Determinism: no Math.random / Date.now. God-ray flicker is time-sinusoidal;
// dust motes are placed with a seeded Rng and drift on sine/easing math.

import * as THREE from 'three';
import type { AtelierTextures } from './atelier_textures';
import { lumpIcosahedron, potLathe, Rng } from './atelier_geometry';

export interface AtelierRoomOptions {
  /** grok units -> world units multiplier (default 8 = the NFT viewer scale). */
  scale?: number;
  /** world y of the pot soil plane / tree base (default 0). */
  baseY?: number;
}

export interface AtelierRoom {
  group: THREE.Group;
  tick: (elapsed: number, dt: number) => void;
}

// ---------------------------------------------------------------------------
// Room shell: floor, walls, ceiling, beams, shoji window + window glow
// ---------------------------------------------------------------------------
function buildRoom(tex: AtelierTextures): THREE.Group {
  const g = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({
    map: tex.plaster, normalMap: tex.plasterN, roughness: 0.9, color: 0x1c1814,
  });
  const beamMat = new THREE.MeshStandardMaterial({
    map: tex.wood, normalMap: tex.woodN, roughness: 0.62, color: 0x3a2a1c,
  });

  // Floor -- hinoki planks.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 7),
    new THREE.MeshStandardMaterial({ map: tex.wood, normalMap: tex.woodN, roughness: 0.7, color: 0x2a1e14 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 0.2);
  floor.receiveShadow = true;
  g.add(floor);

  // Walls (planes face into the room).
  const back = new THREE.Mesh(new THREE.PlaneGeometry(8, 3.5), wallMat);
  back.position.set(0, 1.7, -2.35);
  back.receiveShadow = true;
  g.add(back);

  const right = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.5), wallMat);
  right.position.set(2.55, 1.7, 0);
  right.rotation.y = -Math.PI / 2;
  right.receiveShadow = true;
  g.add(right);

  const lu = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.1), wallMat);
  lu.position.set(-2.45, 2.55, 0);
  lu.rotation.y = Math.PI / 2;
  g.add(lu);

  const ll = new THREE.Mesh(new THREE.PlaneGeometry(7, 0.76), wallMat);
  ll.position.set(-2.45, 0.38, 0);
  ll.rotation.y = Math.PI / 2;
  g.add(ll);

  const l1 = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.2), wallMat);
  l1.position.set(-2.45, 1.45, -1.85);
  l1.rotation.y = Math.PI / 2;
  g.add(l1);

  const l2 = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.2), wallMat);
  l2.position.set(-2.45, 1.45, 1.85);
  l2.rotation.y = Math.PI / 2;
  g.add(l2);

  // Ceiling.
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 7),
    new THREE.MeshStandardMaterial({ color: 0x14110e, roughness: 1 }),
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, 3.15, 0);
  g.add(ceil);

  // Ceiling beams.
  for (const x of [-1.4, 0, 1.4]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 4.6), beamMat);
    b.position.set(x, 3.02, -0.2);
    b.castShadow = true;
    g.add(b);
  }

  // Shoji window (left, -X) + warm window glow plane just outside it.
  g.add(buildShoji(tex));
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 2.15), new THREE.MeshBasicMaterial({ color: 0xf3ddb0 }));
  glow.position.set(-2.55, 1.5, 0);
  glow.rotation.y = Math.PI / 2;
  g.add(glow);

  return g;
}

function buildShoji(tex: AtelierTextures): THREE.Group {
  const g = new THREE.Group();
  g.position.set(-2.42, 1.48, 0);
  g.rotation.y = Math.PI / 2;
  const wood = new THREE.MeshStandardMaterial({ map: tex.wood, roughness: 0.55, color: 0x4a3828 });
  for (const x of [-1.15, -0.38, 0.38, 1.15]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.045, 2.15, 0.05), wood);
    post.position.set(x, 0, 0);
    g.add(post);
  }
  for (const y of [-0.95, 0, 0.95]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.04, 0.045), wood);
    rail.position.set(0, y, 0);
    g.add(rail);
  }
  [-0.76, 0, 0.76].forEach((x, i) => {
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(0.68, 1.72),
      new THREE.MeshPhysicalMaterial({
        map: tex.shoji, color: 0xf0e4cc, roughness: 0.78,
        transparent: true, opacity: i === 1 ? 0.42 : 0.88, side: THREE.DoubleSide,
      }),
    );
    panel.position.set(x, 0.08, -0.01);
    g.add(panel);
  });
  return g;
}

// ---------------------------------------------------------------------------
// Workbench
// ---------------------------------------------------------------------------
function buildWorkbench(tex: AtelierTextures): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    map: tex.wood, normalMap: tex.woodN, roughness: 0.48, metalness: 0.02, color: 0xc4a06a,
  });
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.09, 1.05), mat);
  top.position.set(0.08, 0.74, 0.04);
  top.castShadow = top.receiveShadow = true;
  g.add(top);
  for (const [x, z] of [[-0.95, -0.38], [1.05, -0.38], [-0.95, 0.42], [1.05, 0.42]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.72, 0.08), mat);
    leg.position.set(x, 0.36, z);
    leg.castShadow = true;
    g.add(leg);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.04, 0.06), mat);
  rail.position.set(0.08, 0.38, -0.46);
  g.add(rail);
  return g;
}

// ---------------------------------------------------------------------------
// Pot + soil + moss + stones at the tree base
// ---------------------------------------------------------------------------
function buildPot(tex: AtelierTextures): THREE.Group {
  const g = new THREE.Group();
  g.position.set(0, 0.785, 0);

  const pot = new THREE.Mesh(
    potLathe(),
    new THREE.MeshPhysicalMaterial({
      map: tex.ceramic, normalMap: tex.ceramicN, roughness: 0.18, metalness: 0.08,
      clearcoat: 0.85, clearcoatRoughness: 0.2, envMapIntensity: 0.9, color: 0x1a1614,
    }),
  );
  pot.scale.set(1.32, 1, 1);
  pot.castShadow = pot.receiveShadow = true;
  g.add(pot);

  const soil = new THREE.Mesh(
    new THREE.CircleGeometry(0.148, 32),
    new THREE.MeshStandardMaterial({ map: tex.soil, normalMap: tex.soilN, roughness: 0.92, color: 0x4a3018 }),
  );
  soil.rotation.x = -Math.PI / 2;
  soil.position.set(0, 0.175, 0);
  soil.receiveShadow = true;
  g.add(soil);

  const mossGeos = [
    lumpIcosahedron(0.085, 0.32, 1.2, 2),
    lumpIcosahedron(0.06, 0.3, 4.1, 2),
    lumpIcosahedron(0.05, 0.28, 7.7, 2),
  ];
  const mossMats = [
    new THREE.MeshStandardMaterial({ map: tex.moss, normalMap: tex.mossN, roughness: 0.86, color: 0x3d6a32 }),
    new THREE.MeshStandardMaterial({ map: tex.moss, normalMap: tex.mossN, roughness: 0.86, color: 0x2f5a28 }),
    new THREE.MeshStandardMaterial({ map: tex.moss, roughness: 0.86, color: 0x4a7a38 }),
  ];
  const mossPos: Array<[number, number, number]> = [
    [0.04, 0.188, 0.03],
    [-0.06, 0.182, -0.02],
    [0.02, 0.18, -0.07],
  ];
  mossPos.forEach((p, i) => {
    const m = new THREE.Mesh(mossGeos[i], mossMats[i]);
    m.position.set(p[0], p[1], p[2]);
    m.castShadow = true;
    g.add(m);
  });

  const stoneGeos = [
    lumpIcosahedron(0.038, 0.62, 2.2, 1),
    lumpIcosahedron(0.028, 0.7, 5.5, 1),
    lumpIcosahedron(0.022, 0.65, 9.1, 1),
  ];
  const stoneMats = [
    new THREE.MeshStandardMaterial({ map: tex.stone, normalMap: tex.stoneN, roughness: 0.45, color: 0xc8c0b0 }),
    new THREE.MeshStandardMaterial({ map: tex.stone, roughness: 0.5, color: 0xd2cbb8 }),
    new THREE.MeshStandardMaterial({ map: tex.stone, roughness: 0.48, color: 0xb8b09e }),
  ];
  const stonePos: Array<[number, number, number]> = [
    [-0.05, 0.19, 0.05],
    [0.07, 0.186, -0.04],
    [0.01, 0.185, 0.08],
  ];
  stonePos.forEach((p, i) => {
    const m = new THREE.Mesh(stoneGeos[i], stoneMats[i]);
    m.position.set(p[0], p[1], p[2]);
    m.castShadow = true;
    g.add(m);
  });

  return g;
}

// ---------------------------------------------------------------------------
// Copper watering can + shears (workshop tools, right side of the bench)
// ---------------------------------------------------------------------------
function buildTools(): THREE.Group {
  const g = new THREE.Group();
  const copper = new THREE.MeshStandardMaterial({
    color: 0xb87333, metalness: 1, roughness: 0.32, envMapIntensity: 1.1,
  });

  // Watering can.
  const can = new THREE.Group();
  can.position.set(0.72, 0.82, 0.28);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.09, 20), copper);
  body.castShadow = true;
  can.add(body);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.09, 8), copper);
  spout.position.set(0.07, 0.02, 0);
  spout.rotation.z = -0.7;
  spout.castShadow = true;
  can.add(spout);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.006, 8, 16, Math.PI), copper);
  handle.position.set(-0.05, 0.03, 0);
  handle.rotation.z = Math.PI / 2;
  can.add(handle);
  g.add(can);

  // Shears.
  const shears = new THREE.Group();
  shears.position.set(0.92, 0.8, 0.08);
  shears.rotation.set(0, 0.4, 0.15);
  const steel = new THREE.MeshStandardMaterial({ color: 0x8a9399, metalness: 1, roughness: 0.25 });
  const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.012, 0.018), steel);
  b1.rotation.z = 0.5;
  b1.position.set(-0.02, 0, 0);
  b1.castShadow = true;
  shears.add(b1);
  const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.012, 0.018), steel);
  b2.rotation.z = -0.5;
  b2.position.set(0.02, 0, 0);
  b2.castShadow = true;
  shears.add(b2);
  const c1 = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.08, 8), copper);
  c1.position.set(-0.07, -0.015, 0);
  shears.add(c1);
  const c2 = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.08, 8), copper);
  c2.position.set(0.07, -0.015, 0);
  shears.add(c2);
  g.add(shears);

  return g;
}

// ---------------------------------------------------------------------------
// Scroll on the right wall
// ---------------------------------------------------------------------------
function buildScroll(tex: AtelierTextures): THREE.Group {
  const g = new THREE.Group();
  g.position.set(1.55, 1.85, -2.28);
  const paper = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.72),
    new THREE.MeshStandardMaterial({ map: tex.scroll, roughness: 0.8 }),
  );
  g.add(paper);
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.46, 10),
    new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.5 }),
  );
  rod.position.set(0, 0.38, 0.01);
  g.add(rod);
  return g;
}

// ---------------------------------------------------------------------------
// Small garden visible through the shoji window (outside, -X)
// ---------------------------------------------------------------------------
function buildGarden(): THREE.Group {
  const g = new THREE.Group();
  g.position.set(-4.4, 0, 0);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8),
    new THREE.MeshStandardMaterial({ color: 0x6a6a58, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0.02, 0);
  g.add(ground);

  const trees: Array<[number, number, number]> = [
    [-0.8, 0.6, 0.55],
    [0.4, -0.8, 0.7],
    [-0.2, 1.4, 0.4],
    [0.9, 0.3, 0.85],
  ];
  for (const [z, x, s] of trees) {
    const t = new THREE.Group();
    t.position.set(x, 0, z);
    t.scale.setScalar(s);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 1, 6), new THREE.MeshStandardMaterial({ color: 0x2a1c12 }));
    trunk.position.set(0, 0.5, 0);
    t.add(trunk);
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 7), new THREE.MeshStandardMaterial({ color: 0x1c3320 }));
    c1.position.set(0, 1.15, 0);
    t.add(c1);
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 7), new THREE.MeshStandardMaterial({ color: 0x243e28 }));
    c2.position.set(0, 1.55, 0);
    t.add(c2);
    g.add(t);
  }

  const sun = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshBasicMaterial({ color: 0xf0d8b0 }));
  sun.position.set(0, 1.6, 0);
  g.add(sun);
  return g;
}

// ---------------------------------------------------------------------------
// God rays through the window (pulse with time)
// ---------------------------------------------------------------------------
function buildGodRays(): { group: THREE.Group; mats: THREE.MeshBasicMaterial[] } {
  const g = new THREE.Group();
  g.position.set(-1.6, 1.55, 0.05);
  g.rotation.z = -0.55;
  const mats: THREE.MeshBasicMaterial[] = [];
  for (let i = 0; i < 5; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xf6e4c4, transparent: true, opacity: 0.09,
      depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 3.4), mat);
    mesh.position.set(i * 0.18, 0, (i - 2) * 0.08);
    mesh.rotation.set(0.1, 0, 0.02 * i);
    mats.push(mat);
    g.add(mesh);
  }
  return { group: g, mats };
}

// ---------------------------------------------------------------------------
// Dust motes -- seeded positions, drift via ease/sine on time
// ---------------------------------------------------------------------------
function buildDust(): { points: THREE.Points; basePos: Float32Array } {
  const rng = new Rng(20240617);
  const n = 90;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = -2.1 + rng.range(0, 1.8);
    pos[i * 3 + 1] = 0.9 + rng.range(0, 1.6);
    pos[i * 3 + 2] = -0.9 + rng.range(0, 1.8);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ color: 0xf2e2c4, size: 0.012, transparent: true, opacity: 0.45, depthWrite: false }),
  );
  return { points, basePos: pos.slice() };
}

function tickDust(points: THREE.Points, basePos: Float32Array, dt: number): void {
  const arr = points.geometry.attributes.position.array as Float32Array;
  const d = Math.min(dt, 0.1);
  for (let i = 0; i < arr.length; i += 3) {
    // Loop motes on a phase derived from their seeded position + elapsed dt
    // (deterministic in dt): vertical bob on a triangle wave, gentle sine
    // sway sideways, mirroring the grok drift behavior without accumulation.
    const phase = (basePos[i + 2] * 40 + d) % 1.0;
    const bob = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
    arr[i + 1] = basePos[i + 1] + bob * 1.4;
    arr[i] = basePos[i] + Math.sin(phase * Math.PI * 2) * d * 0.6;
    arr[i + 2] = basePos[i + 2] + Math.cos(phase * Math.PI * 2) * d * 0.4;
  }
  points.geometry.attributes.position.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// Room assembly
// ---------------------------------------------------------------------------
export function createAtelierRoom(tex: AtelierTextures, opts: AtelierRoomOptions = {}): AtelierRoom {
  // Room scale (grok units -> world units): 8 for the small NFT viewer tree;
  // ~110 for the care scenes whose trees map 1 voxel = 1 world unit and can
  // reach y~150-200 (interior ceiling lands ~241 world units above the base).
  const S = opts.scale ?? 8;
  const baseY = opts.baseY ?? 0;
  // Align the grok soil plane (local y=0.96) to world y=baseY, with a small
  // sink so the pot bottom sits slightly INTO the bench top (avoids coplanar
  // z-fighting).
  const ROOM_Y = baseY - (0.96 * S + 0.03);
  const group = new THREE.Group();
  group.scale.setScalar(S);
  group.position.y = ROOM_Y;

  group.add(buildRoom(tex));
  group.add(buildWorkbench(tex));
  group.add(buildPot(tex));
  group.add(buildTools());
  group.add(buildScroll(tex));
  group.add(buildGarden());

  const rays = buildGodRays();
  const dust = buildDust();
  group.add(rays.group);
  group.add(dust.points);

  const tick = (elapsed: number, dt: number): void => {
    // God-ray opacity pulse.
    rays.mats.forEach((m, i) => {
      m.opacity = 0.045 + Math.sin(elapsed * 0.4 + i) * 0.015;
    });
    // Dust motes.
    tickDust(dust.points, dust.basePos, dt);
  };

  return { group, tick };
}
