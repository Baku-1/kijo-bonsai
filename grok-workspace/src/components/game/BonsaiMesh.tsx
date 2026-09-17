import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { lumpIcosahedron, taperedTube } from "@/lib/game/geometry";
import { foliageColor, solveTree } from "@/lib/game/treeModel";
import type { TreeState } from "@/lib/game/types";
import { useGame } from "@/lib/game/store";
import type { GameTextures } from "./textures";

const _dummy = new THREE.Object3D();
const _n = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);

export function BonsaiMesh({ tree, textures }: { tree: TreeState; textures: GameTextures }) {
  const solved = useMemo(() => solveTree(tree), [tree]);
  const tool = useGame((s) => s.tool);
  const hoverId = useGame((s) => s.hoverId);
  const selectedId = useGame((s) => s.selectedId);
  const setHover = useGame((s) => s.setHover);
  const prune = useGame((s) => s.prune);
  const select = useGame((s) => s.select);
  const wire = useGame((s) => s.wire);

  const geos = useMemo(() => {
    return solved.map((s) => ({
      id: s.branch.id,
      geo: taperedTube(s.start, s.ctrl, s.end, s.radiusStart, s.radiusEnd, 14, 7),
      dead: s.branch.dead,
    }));
  }, [solved]);

  useEffect(() => {
    return () => {
      geos.forEach((g) => g.geo.dispose());
    };
  }, [geos]);

  const pads = useMemo(() => {
    return solved
      .filter((s) => s.branch.foliage && !s.branch.dead)
      .map((s) => {
        const f = s.branch.foliage!;
        const geo = lumpIcosahedron(f.size, f.flatten, hashId(s.branch.id), 2);
        const color = foliageColor(tree.season, f.hue, tree.health);
        return { id: s.branch.id, geo, color, end: s.end, tangent: s.tangent, size: f.size };
      });
  }, [solved, tree.season, tree.health]);

  useEffect(() => {
    return () => pads.forEach((p) => p.geo.dispose());
  }, [pads]);

  const needleRef = useRef<THREE.InstancedMesh>(null);
  const needleCount = pads.length * 22;

  useEffect(() => {
    const mesh = needleRef.current;
    if (!mesh) return;
    let i = 0;
    for (const pad of pads) {
      for (let k = 0; k < 22; k++) {
        const a = (k / 22) * Math.PI * 2;
        const r = pad.size * (0.55 + (k % 3) * 0.12);
        _n.copy(pad.tangent).normalize();
        const side = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
        side.addScaledVector(_n, -0.25).normalize();
        const pos = pad.end.clone().addScaledVector(side, r);
        pos.y += Math.sin(a * 2) * pad.size * 0.08;
        _dummy.position.copy(pos);
        _q.setFromUnitVectors(_up, side);
        _dummy.quaternion.copy(_q);
        _dummy.scale.set(0.008, pad.size * 0.22, 0.008);
        _dummy.updateMatrix();
        mesh.setMatrixAt(i, _dummy.matrix);
        i++;
      }
    }
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
  }, [pads]);

  const drag = useRef<{ id: string; x: number } | null>(null);

  return (
    <group>
      {geos.map((g) => {
        const live = !g.dead;
        const highlight = hoverId === g.id || selectedId === g.id;
        return (
          <mesh
            key={g.id}
            geometry={g.geo}
            castShadow
            receiveShadow
            onPointerOver={(e) => {
              e.stopPropagation();
              if (tool === "prune" || tool === "wire") {
                setHover(g.id);
                document.body.style.cursor = "pointer";
              }
            }}
            onPointerOut={() => {
              setHover(null);
              document.body.style.cursor = "auto";
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (tool === "prune") prune(g.id);
              if (tool === "wire") {
                select(g.id);
                drag.current = { id: g.id, x: e.clientX };
              }
            }}
            onPointerMove={(e) => {
              if (!drag.current || tool !== "wire") return;
              const dx = e.clientX - drag.current.x;
              drag.current.x = e.clientX;
              wire(drag.current.id, 0, dx * 0.008);
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
          >
            <meshStandardMaterial
              map={live ? textures.bark : undefined}
              normalMap={live ? textures.barkN : undefined}
              color={g.dead ? "#c8b79a" : highlight ? "#6a5340" : "#3b2a20"}
              roughness={live ? 0.9 : 0.55}
              metalness={0}
              normalScale={new THREE.Vector2(0.85, 0.85)}
            />
          </mesh>
        );
      })}

      {pads.map((p) => (
        <mesh key={`pad-${p.id}`} geometry={p.geo} position={p.end} castShadow>
          <meshPhysicalMaterial
            color={p.color}
            roughness={0.78}
            metalness={0}
            sheen={0.45}
            sheenColor={new THREE.Color("#6a9a4a")}
            sheenRoughness={0.7}
          />
        </mesh>
      ))}

      <instancedMesh ref={needleRef} args={[undefined, undefined, Math.max(needleCount, 1)]} castShadow>
        <coneGeometry args={[1, 1, 5]} />
        <meshStandardMaterial color={foliageColor(tree.season, 0, tree.health)} roughness={0.72} />
      </instancedMesh>

      {solved
        .filter((s) => s.branch.wired && !s.branch.pruned)
        .map((s) => (
          <mesh key={`wire-${s.branch.id}`} position={s.start.clone().lerp(s.end, 0.4)}>
            <torusGeometry args={[s.radiusStart * 1.35, 0.0028, 6, 12]} />
            <meshStandardMaterial color="#b87333" metalness={1} roughness={0.3} />
          </mesh>
        ))}
    </group>
  );
}

function hashId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h / 0xffffffff * 20;
}

export function WindSway({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.rotation.z = Math.sin(t * 0.35) * 0.012;
    ref.current.rotation.x = Math.sin(t * 0.22) * 0.006;
  });
  return <group ref={ref}>{children}</group>;
}
