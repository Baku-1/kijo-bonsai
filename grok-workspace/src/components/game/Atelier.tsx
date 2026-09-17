import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { lumpIcosahedron, potLathe } from "@/lib/game/geometry";
import { useGame } from "@/lib/game/store";
import type { GameTextures } from "./textures";

export function Atelier({ textures }: { textures: GameTextures }) {
  const watering = useGame((s) => s.watering);
  const potGeo = useMemo(() => potLathe(), []);
  const mossGeos = useMemo(
    () => [
      lumpIcosahedron(0.085, 0.32, 1.2, 2),
      lumpIcosahedron(0.06, 0.3, 4.1, 2),
      lumpIcosahedron(0.05, 0.28, 7.7, 2),
    ],
    [],
  );
  const stoneGeos = useMemo(
    () => [
      lumpIcosahedron(0.038, 0.62, 2.2, 1),
      lumpIcosahedron(0.028, 0.7, 5.5, 1),
      lumpIcosahedron(0.022, 0.65, 9.1, 1),
    ],
    [],
  );

  return (
    <group>
      <Room textures={textures} />
      <Workbench textures={textures} />
      <group position={[0, 0.785, 0]}>
        <mesh geometry={potGeo} scale={[1.32, 1, 1]} castShadow receiveShadow>
          <meshPhysicalMaterial
            map={textures.ceramic}
            normalMap={textures.ceramicN}
            roughness={0.18}
            metalness={0.08}
            clearcoat={0.85}
            clearcoatRoughness={0.2}
            envMapIntensity={0.9}
            color="#1a1614"
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.175, 0]} receiveShadow>
          <circleGeometry args={[0.148, 32]} />
          <meshStandardMaterial map={textures.soil} normalMap={textures.soilN} roughness={0.92} color="#4a3018" />
        </mesh>
        <mesh geometry={mossGeos[0]} position={[0.04, 0.188, 0.03]} castShadow>
          <meshStandardMaterial map={textures.moss} normalMap={textures.mossN} roughness={0.86} color="#3d6a32" />
        </mesh>
        <mesh geometry={mossGeos[1]} position={[-0.06, 0.182, -0.02]} castShadow>
          <meshStandardMaterial map={textures.moss} normalMap={textures.mossN} roughness={0.86} color="#2f5a28" />
        </mesh>
        <mesh geometry={mossGeos[2]} position={[0.02, 0.18, -0.07]} castShadow>
          <meshStandardMaterial map={textures.moss} roughness={0.86} color="#4a7a38" />
        </mesh>
        <mesh geometry={stoneGeos[0]} position={[-0.05, 0.19, 0.05]} castShadow>
          <meshStandardMaterial map={textures.stone} normalMap={textures.stoneN} roughness={0.45} color="#c8c0b0" />
        </mesh>
        <mesh geometry={stoneGeos[1]} position={[0.07, 0.186, -0.04]} castShadow>
          <meshStandardMaterial map={textures.stone} roughness={0.5} color="#d2cbb8" />
        </mesh>
        <mesh geometry={stoneGeos[2]} position={[0.01, 0.185, 0.08]} castShadow>
          <meshStandardMaterial map={textures.stone} roughness={0.48} color="#b8b09e" />
        </mesh>
      </group>
      <Tools watering={watering} />
      <Scroll textures={textures} />
      <Garden />
      <GodRays />
      <Dust />
      <WaterDrops />
    </group>
  );
}

function Room({ textures }: { textures: GameTextures }) {
  const wall = (
    <meshStandardMaterial
      map={textures.plaster}
      normalMap={textures.plasterN}
      roughness={0.9}
      color="#1c1814"
    />
  );
  const woodMat = (
    <meshStandardMaterial
      map={textures.wood}
      normalMap={textures.woodN}
      roughness={0.62}
      color="#3a2a1c"
    />
  );

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.2]} receiveShadow>
        <planeGeometry args={[8, 7]} />
        <meshStandardMaterial map={textures.wood} normalMap={textures.woodN} roughness={0.7} color="#2a1e14" />
      </mesh>
      <mesh position={[0, 1.7, -2.35]} receiveShadow>
        <planeGeometry args={[8, 3.5]} />
        {wall}
      </mesh>
      <mesh position={[2.55, 1.7, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[7, 3.5]} />
        {wall}
      </mesh>
      {/* left wall around window */}
      <mesh position={[-2.45, 2.55, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[7, 1.1]} />
        {wall}
      </mesh>
      <mesh position={[-2.45, 0.38, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[7, 0.76]} />
        {wall}
      </mesh>
      <mesh position={[-2.45, 1.45, -1.85]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.3, 2.2]} />
        {wall}
      </mesh>
      <mesh position={[-2.45, 1.45, 1.85]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.3, 2.2]} />
        {wall}
      </mesh>
      <mesh position={[0, 3.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8, 7]} />
        <meshStandardMaterial color="#14110e" roughness={1} />
      </mesh>
      {[-1.4, 0, 1.4].map((x) => (
        <mesh key={x} position={[x, 3.02, -0.2]} castShadow>
          <boxGeometry args={[0.12, 0.16, 4.6]} />
          {woodMat}
        </mesh>
      ))}
      <Shoji textures={textures} />
      <mesh position={[-2.55, 1.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[2.35, 2.15]} />
        <meshBasicMaterial color="#f3ddb0" />
      </mesh>
    </group>
  );
}

function Shoji({ textures }: { textures: GameTextures }) {
  const posts = [-1.15, -0.38, 0.38, 1.15];
  return (
    <group position={[-2.42, 1.48, 0]} rotation={[0, Math.PI / 2, 0]}>
      {posts.map((x) => (
        <mesh key={x} position={[x, 0, 0]}>
          <boxGeometry args={[0.045, 2.15, 0.05]} />
          <meshStandardMaterial map={textures.wood} roughness={0.55} color="#4a3828" />
        </mesh>
      ))}
      {[-0.95, 0, 0.95].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[2.4, 0.04, 0.045]} />
          <meshStandardMaterial map={textures.wood} roughness={0.55} color="#4a3828" />
        </mesh>
      ))}
      {[-0.76, 0, 0.76].map((x, i) => (
        <mesh key={x} position={[x, 0.08, -0.01]}>
          <planeGeometry args={[0.68, 1.72]} />
          <meshPhysicalMaterial
            map={textures.shoji}
            color="#f0e4cc"
            roughness={0.78}
            transparent
            opacity={i === 1 ? 0.42 : 0.88}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

function Workbench({ textures }: { textures: GameTextures }) {
  const mat = (
    <meshStandardMaterial
      map={textures.wood}
      normalMap={textures.woodN}
      roughness={0.48}
      metalness={0.02}
      color="#c4a06a"
    />
  );
  return (
    <group>
      <mesh position={[0.08, 0.74, 0.04]} castShadow receiveShadow>
        <boxGeometry args={[2.35, 0.09, 1.05]} />
        {mat}
      </mesh>
      {[
        [-0.95, -0.38],
        [1.05, -0.38],
        [-0.95, 0.42],
        [1.05, 0.42],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.36, z]} castShadow>
          <boxGeometry args={[0.08, 0.72, 0.08]} />
          {mat}
        </mesh>
      ))}
      <mesh position={[0.08, 0.38, -0.46]}>
        <boxGeometry args={[2.2, 0.04, 0.06]} />
        {mat}
      </mesh>
    </group>
  );
}

function Tools({ watering }: { watering: number }) {
  const can = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!can.current) return;
    const t = watering;
    can.current.position.y = 0.82 + t * 0.18;
    can.current.position.x = 0.72 - t * 0.55;
    can.current.rotation.z = t * 0.7;
  });
  const copper = (
    <meshStandardMaterial color="#b87333" metalness={1} roughness={0.32} envMapIntensity={1.1} />
  );
  return (
    <group>
      <group ref={can} position={[0.72, 0.82, 0.28]}>
        <mesh rotation={[0, 0, 0]} castShadow>
          <cylinderGeometry args={[0.045, 0.05, 0.09, 20]} />
          {copper}
        </mesh>
        <mesh position={[0.07, 0.02, 0]} rotation={[0, 0, -0.7]} castShadow>
          <cylinderGeometry args={[0.008, 0.012, 0.09, 8]} />
          {copper}
        </mesh>
        <mesh position={[-0.05, 0.03, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.035, 0.006, 8, 16, Math.PI]} />
          {copper}
        </mesh>
      </group>
      <group position={[0.92, 0.8, 0.08]} rotation={[0, 0.4, 0.15]}>
        <mesh rotation={[0, 0, 0.5]} position={[-0.02, 0, 0]} castShadow>
          <boxGeometry args={[0.11, 0.012, 0.018]} />
          <meshStandardMaterial color="#8a9399" metalness={1} roughness={0.25} />
        </mesh>
        <mesh rotation={[0, 0, -0.5]} position={[0.02, 0, 0]} castShadow>
          <boxGeometry args={[0.11, 0.012, 0.018]} />
          <meshStandardMaterial color="#8a9399" metalness={1} roughness={0.25} />
        </mesh>
        <mesh position={[-0.07, -0.015, 0]}>
          <cylinderGeometry args={[0.007, 0.007, 0.08, 8]} />
          {copper}
        </mesh>
        <mesh position={[0.07, -0.015, 0]}>
          <cylinderGeometry args={[0.007, 0.007, 0.08, 8]} />
          {copper}
        </mesh>
      </group>
    </group>
  );
}

function Scroll({ textures }: { textures: GameTextures }) {
  return (
    <group position={[1.55, 1.85, -2.28]}>
      <mesh>
        <planeGeometry args={[0.42, 0.72]} />
        <meshStandardMaterial map={textures.scroll} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.38, 0.01]}>
        <cylinderGeometry args={[0.02, 0.02, 0.46, 10]} />
        <meshStandardMaterial color="#2a1c12" roughness={0.5} />
      </mesh>
    </group>
  );
}

function Garden() {
  return (
    <group position={[-4.4, 0, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial color="#6a6a58" roughness={1} />
      </mesh>
      {[
        [-0.8, 0.6, 0.55],
        [0.4, -0.8, 0.7],
        [-0.2, 1.4, 0.4],
        [0.9, 0.3, 0.85],
      ].map(([z, x, s], i) => (
        <group key={i} position={[x, 0, z]} scale={s}>
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.05, 0.08, 1, 6]} />
            <meshStandardMaterial color="#2a1c12" />
          </mesh>
          <mesh position={[0, 1.15, 0]}>
            <coneGeometry args={[0.42, 0.9, 7]} />
            <meshStandardMaterial color="#1c3320" />
          </mesh>
          <mesh position={[0, 1.55, 0]}>
            <coneGeometry args={[0.28, 0.7, 7]} />
            <meshStandardMaterial color="#243e28" />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 1.6, 0]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color="#f0d8b0" />
      </mesh>
    </group>
  );
}

function GodRays() {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.children.forEach((ch, i) => {
      const m = (ch as THREE.Mesh).material as THREE.MeshBasicMaterial;
      m.opacity = 0.045 + Math.sin(t * 0.4 + i) * 0.015;
    });
  });
  return (
    <group ref={ref} position={[-1.6, 1.55, 0.05]} rotation={[0, 0, -0.55]}>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[i * 0.18, 0, (i - 2) * 0.08]} rotation={[0.1, 0, 0.02 * i]}>
          <planeGeometry args={[0.35, 3.4]} />
          <meshBasicMaterial
            color="#f6e4c4"
            transparent
            opacity={0.09}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

function Dust() {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = 90;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = -2.1 + Math.random() * 1.8;
      pos[i * 3 + 1] = 0.9 + Math.random() * 1.6;
      pos[i * 3 + 2] = -0.9 + Math.random() * 1.8;
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  useFrame((_, dt) => {
    const pts = ref.current;
    if (!pts) return;
    const arr = pts.geometry.attributes.position.array as Float32Array;
    const d = Math.min(dt, 0.1);
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] += d * 0.04;
      arr[i] += Math.sin(arr[i + 1] * 2) * d * 0.02;
      if (arr[i + 1] > 2.6) arr[i + 1] = 0.85;
    }
    pts.geometry.attributes.position.needsUpdate = true;
  });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial color="#f2e2c4" size={0.012} transparent opacity={0.45} depthWrite={false} />
    </points>
  );
}

function WaterDrops() {
  const watering = useGame((s) => s.watering);
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    mesh.visible = watering > 0.05;
    if (!mesh.visible) return;
    for (let i = 0; i < 24; i++) {
      const t = (state.clock.elapsedTime * 2 + i * 0.17) % 1;
      dummy.position.set((i % 5) * 0.02 - 0.04, 1.05 - t * 0.28, (Math.floor(i / 5) % 4) * 0.02 - 0.03);
      dummy.scale.setScalar(0.008 * watering);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 24]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshPhysicalMaterial color="#9ec4d4" roughness={0.1} transmission={0.6} thickness={0.4} transparent opacity={0.7} />
    </instancedMesh>
  );
}
