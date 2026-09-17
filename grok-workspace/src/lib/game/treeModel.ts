import * as THREE from "three";
import type { Branch, SeasonIndex, TreeState } from "./types";
import { Rng } from "./noise";

function b(partial: Omit<Branch, "pruned" | "wired" | "wirePitch" | "wireYaw" | "vigor"> & Partial<Branch>): Branch {
  return {
    pruned: false,
    wired: false,
    wirePitch: 0,
    wireYaw: 0,
    vigor: 0.85,
    ...partial,
  };
}

export function maturePine(seed = 7): TreeState {
  const branches: Branch[] = [
    b({ id: "t0", parentId: null, attach: 0, length: 0.22, radius: 0.028, pitch: 0.05, yaw: 0.16, roll: 0, bend: 0.04, dead: false, foliage: null }),
    b({ id: "t1", parentId: "t0", attach: 1, length: 0.24, radius: 0.022, pitch: -0.16, yaw: -0.32, roll: 0.08, bend: 0.045, dead: false, foliage: null }),
    b({ id: "t2", parentId: "t1", attach: 1, length: 0.22, radius: 0.016, pitch: 0.14, yaw: 0.22, roll: -0.06, bend: 0.035, dead: false, foliage: null }),
    b({
      id: "t3",
      parentId: "t2",
      attach: 1,
      length: 0.16,
      radius: 0.011,
      pitch: -0.08,
      yaw: -0.1,
      roll: 0,
      bend: 0.02,
      dead: false,
      foliage: { size: 0.075, flatten: 0.3, hue: 0.02 },
    }),
    b({
      id: "b-low-r",
      parentId: "t0",
      attach: 0.82,
      length: 0.28,
      radius: 0.01,
      pitch: 1.12,
      yaw: 0.55,
      roll: 0.2,
      bend: 0.08,
      dead: false,
      foliage: { size: 0.095, flatten: 0.28, hue: -0.02 },
    }),
    b({
      id: "b-low-r2",
      parentId: "b-low-r",
      attach: 0.72,
      length: 0.18,
      radius: 0.01,
      pitch: 0.4,
      yaw: 0.6,
      roll: 0,
      bend: 0.05,
      dead: false,
      foliage: { size: 0.06, flatten: 0.3, hue: 0.01 },
    }),
    b({
      id: "jin",
      parentId: "t0",
      attach: 0.5,
      length: 0.28,
      radius: 0.012,
      pitch: 1.05,
      yaw: 3.45,
      roll: 0.4,
      bend: 0.1,
      dead: true,
      foliage: null,
    }),
    b({
      id: "b-mid-l",
      parentId: "t1",
      attach: 0.62,
      length: 0.33,
      radius: 0.016,
      pitch: 0.95,
      yaw: 3.05,
      roll: -0.15,
      bend: 0.07,
      dead: false,
      foliage: { size: 0.085, flatten: 0.29, hue: 0 },
    }),
    b({
      id: "b-mid-l2",
      parentId: "b-mid-l",
      attach: 0.7,
      length: 0.16,
      radius: 0.009,
      pitch: 0.35,
      yaw: -0.4,
      roll: 0,
      bend: 0.04,
      dead: false,
      foliage: { size: 0.05, flatten: 0.32, hue: 0.03 },
    }),
    b({
      id: "b-mid-r",
      parentId: "t1",
      attach: 0.92,
      length: 0.3,
      radius: 0.015,
      pitch: 0.78,
      yaw: 0.42,
      roll: 0.1,
      bend: 0.06,
      dead: false,
      foliage: { size: 0.078, flatten: 0.28, hue: -0.01 },
    }),
    b({
      id: "b-back",
      parentId: "t1",
      attach: 0.48,
      length: 0.24,
      radius: 0.013,
      pitch: 0.82,
      yaw: 2.05,
      roll: 0,
      bend: 0.05,
      dead: false,
      foliage: { size: 0.062, flatten: 0.3, hue: 0.04 },
    }),
    b({
      id: "b-up-l",
      parentId: "t2",
      attach: 0.55,
      length: 0.23,
      radius: 0.012,
      pitch: 0.7,
      yaw: 3.25,
      roll: 0,
      bend: 0.05,
      dead: false,
      foliage: { size: 0.07, flatten: 0.3, hue: 0.01 },
    }),
    b({
      id: "b-up-r",
      parentId: "t2",
      attach: 0.82,
      length: 0.2,
      radius: 0.011,
      pitch: 0.62,
      yaw: 0.35,
      roll: 0,
      bend: 0.04,
      dead: false,
      foliage: { size: 0.06, flatten: 0.28, hue: -0.03 },
    }),
    b({
      id: "b-apex-l",
      parentId: "t3",
      attach: 0.45,
      length: 0.14,
      radius: 0.008,
      pitch: 0.55,
      yaw: 2.8,
      roll: 0,
      bend: 0.03,
      dead: false,
      foliage: { size: 0.048, flatten: 0.32, hue: 0.02 },
    }),
  ];

  const tree: TreeState = {
    seed,
    ageYears: 18,
    season: 1,
    moisture: 0.62,
    health: 0.92,
    maturity: 1,
    branches,
    harmony: 0,
    wateredThisSeason: false,
  };
  tree.harmony = scoreHarmony(tree);
  return tree;
}

export function sapling(seed = Date.now() % 99991): TreeState {
  const tree = maturePine(seed);
  tree.ageYears = 3;
  tree.maturity = 0.38;
  tree.moisture = 0.55;
  tree.health = 0.88;
  tree.season = 0;
  tree.wateredThisSeason = false;
  for (const br of tree.branches) {
    br.length *= 0.42;
    br.radius *= 0.55;
    if (br.foliage) br.foliage.size *= 0.45;
    if (br.id.startsWith("b-") && br.id.endsWith("2")) br.pruned = true;
    if (br.id === "b-apex-l") br.pruned = true;
  }
  tree.harmony = scoreHarmony(tree);
  return tree;
}

export interface SolvedBranch {
  branch: Branch;
  start: THREE.Vector3;
  ctrl: THREE.Vector3;
  end: THREE.Vector3;
  radiusStart: number;
  radiusEnd: number;
  tipQuat: THREE.Quaternion;
  tangent: THREE.Vector3;
}

const _up = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _side = new THREE.Vector3();

export function solveTree(tree: TreeState): SolvedBranch[] {
  const byId = new Map(tree.branches.map((br) => [br.id, br]));
  const solved = new Map<string, SolvedBranch>();
  const mat = THREE.MathUtils.lerp(0.55, 1, tree.maturity);

  const order: Branch[] = [];
  const visit = (id: string) => {
    const br = byId.get(id);
    if (!br) return;
    order.push(br);
    for (const child of tree.branches) if (child.parentId === id) visit(child.id);
  };
  for (const br of tree.branches) if (!br.parentId) visit(br.id);

  for (const br of order) {
    if (br.pruned) continue;
    let origin = new THREE.Vector3(0, 0, 0);
    let parentQuat = new THREE.Quaternion();
    let parentTan = new THREE.Vector3(0, 1, 0);
    let parentRadius = br.radius * mat;

    if (br.parentId) {
      const ps = solved.get(br.parentId);
      const parent = byId.get(br.parentId);
      if (!ps || !parent || parent.pruned) continue;
      const curve = new THREE.QuadraticBezierCurve3(ps.start, ps.ctrl, ps.end);
      origin = curve.getPoint(br.attach);
      parentTan = curve.getTangent(br.attach).normalize();
      parentQuat = ps.tipQuat.clone();
      parentRadius = THREE.MathUtils.lerp(ps.radiusStart, ps.radiusEnd, br.attach);
    }

    const e = new THREE.Euler(br.pitch + br.wirePitch, br.yaw + br.wireYaw, br.roll, "YXZ");
    const local = new THREE.Quaternion().setFromEuler(e);
    const worldQ = parentQuat.clone().multiply(local);
    const tangent = _up.clone().applyQuaternion(worldQ).normalize();
    if (tangent.dot(parentTan) < 0.15 && br.parentId) {
      tangent.addScaledVector(parentTan, 0.35).normalize();
    }

    const length = br.length * mat;
    const start = origin;
    const end = origin.clone().addScaledVector(tangent, length);
    _side.set(tangent.z, 0, -tangent.x);
    if (_side.lengthSq() < 1e-6) _side.set(1, 0, 0);
    _side.normalize();
    const ctrl = start
      .clone()
      .lerp(end, 0.48)
      .addScaledVector(_side, br.bend * length)
      .addScaledVector(_v.set(0, 1, 0), br.bend * length * 0.15);

    const radiusStart = br.parentId ? parentRadius * 0.86 : br.radius * mat;
    const radiusEnd = Math.max(0.0035, br.radius * mat * 0.42);

    const tipQuat = new THREE.Quaternion().setFromUnitVectors(_up, tangent);

    solved.set(br.id, {
      branch: br,
      start,
      ctrl,
      end,
      radiusStart,
      radiusEnd,
      tipQuat,
      tangent,
    });
  }

  return [...solved.values()];
}

export function scoreHarmony(tree: TreeState): number {
  const living = tree.branches.filter((br) => !br.pruned && !br.dead);
  const pads = living.filter((br) => br.foliage);
  if (pads.length === 0) return 0.12;
  let taper = 0;
  let nTaper = 0;
  const byId = new Map(tree.branches.map((br) => [br.id, br]));
  for (const br of living) {
    if (!br.parentId) continue;
    const p = byId.get(br.parentId);
    if (!p || p.pruned) continue;
    taper += p.radius > br.radius ? 1 : 0.2;
    nTaper++;
  }
  const taperScore = nTaper ? taper / nTaper : 0.5;
  const padCount = THREE.MathUtils.clamp(pads.length / 8, 0, 1);
  const moistureScore = 1 - Math.abs(tree.moisture - 0.55) * 1.2;
  const ageScore = THREE.MathUtils.clamp(tree.ageYears / 24, 0, 1);
  const health = tree.health;
  const jin = tree.branches.some((br) => br.dead && !br.pruned) ? 0.08 : 0;
  const raw =
    taperScore * 0.28 + padCount * 0.22 + moistureScore * 0.18 + ageScore * 0.18 + health * 0.14 + jin;
  return THREE.MathUtils.clamp(raw, 0.08, 0.99);
}

export function pruneBranch(tree: TreeState, id: string): TreeState {
  const kill = new Set<string>();
  const walk = (pid: string) => {
    kill.add(pid);
    for (const br of tree.branches) if (br.parentId === pid) walk(br.id);
  };
  const target = tree.branches.find((br) => br.id === id);
  if (!target || !target.parentId) return tree;
  walk(id);
  const branches = tree.branches.map((br) => {
    if (kill.has(br.id)) return { ...br, pruned: true };
    if (br.id === target.parentId) return { ...br, vigor: Math.min(1, br.vigor + 0.12) };
    return br;
  });
  const next = { ...tree, branches, health: Math.min(1, tree.health + 0.03) };
  next.harmony = scoreHarmony(next);
  return next;
}

export function waterTree(tree: TreeState): TreeState {
  const moisture = Math.min(1, tree.moisture + 0.34);
  const health = Math.min(1, tree.health + (moisture > 0.92 ? -0.04 : 0.06));
  const next = { ...tree, moisture, health, wateredThisSeason: true };
  next.harmony = scoreHarmony(next);
  return next;
}

export function restSeason(tree: TreeState): TreeState {
  const rng = new Rng(tree.seed + Math.floor(tree.ageYears * 8) + tree.season + 3);
  const wet = tree.moisture;
  const canGrow = wet > 0.28 && tree.health > 0.35;
  const season = ((tree.season + 1) % 4) as SeasonIndex;
  const maturity = Math.min(1, tree.maturity + (canGrow ? 0.045 : 0.01));
  const moisture = Math.max(0.08, tree.moisture * 0.52);
  const health = THREE.MathUtils.clamp(tree.health + (canGrow ? 0.02 : -0.08) + (wet < 0.2 ? -0.1 : 0), 0.15, 1);

  const branches = tree.branches.map((br) => {
    if (br.pruned) return br;
    const grow = canGrow ? 1 + 0.028 * br.vigor * (0.6 + wet) : 1;
    const foliage = br.foliage
      ? {
          ...br.foliage,
          size: br.foliage.size * (canGrow ? 1.02 : 0.985),
        }
      : null;
    return {
      ...br,
      length: br.length * grow,
      radius: br.radius * (canGrow ? 1.01 : 1),
      foliage,
      vigor: THREE.MathUtils.clamp(br.vigor * 0.98 + (canGrow ? 0.03 : -0.04), 0.2, 1),
    };
  });

  if (canGrow && maturity > 0.55 && rng.next() > 0.55) {
    const hosts = branches.filter((br) => !br.pruned && !br.dead && br.parentId && !br.foliage);
    const host = hosts[Math.floor(rng.next() * hosts.length)];
    if (host) {
      const id = `sprout-${tree.ageYears.toFixed(2)}-${Math.floor(rng.next() * 999)}`;
      branches.push(
        b({
          id,
          parentId: host.id,
          attach: 0.7 + rng.range(0, 0.2),
          length: host.length * 0.45,
          radius: host.radius * 0.45,
          pitch: rng.range(0.4, 0.9),
          yaw: rng.range(0, Math.PI * 2),
          roll: 0,
          bend: rng.range(0.02, 0.07),
          dead: false,
          foliage: { size: 0.08 * maturity, flatten: 0.38, hue: rng.range(-0.04, 0.04) },
        }),
      );
    }
  }

  const next: TreeState = {
    ...tree,
    season,
    maturity,
    moisture,
    health,
    ageYears: tree.ageYears + 0.25,
    wateredThisSeason: false,
    branches,
  };
  next.harmony = scoreHarmony(next);
  return next;
}

export function wireBranch(tree: TreeState, id: string, dPitch: number, dYaw: number): TreeState {
  const branches = tree.branches.map((br) => {
    if (br.id !== id || br.pruned || !br.parentId) return br;
    return {
      ...br,
      wired: true,
      wirePitch: THREE.MathUtils.clamp(br.wirePitch + dPitch, -0.7, 0.7),
      wireYaw: br.wireYaw + dYaw,
    };
  });
  const next = { ...tree, branches };
  next.harmony = scoreHarmony(next);
  return next;
}

export function foliageColor(season: SeasonIndex, hue: number, health: number): THREE.Color {
  const bases = [
    new THREE.Color("#1a3520"),
    new THREE.Color("#152818"),
    new THREE.Color("#3d4220"),
    new THREE.Color("#1a241c"),
  ];
  const c = bases[season].clone();
  c.offsetHSL(hue * 0.08, (health - 0.5) * 0.15, (health - 0.6) * 0.12);
  return c;
}
