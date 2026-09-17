import { useEffect, useLayoutEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, SMAA } from "@react-three/postprocessing";
import * as THREE from "three";
import { useGame } from "@/lib/game/store";
import { Atelier } from "./Atelier";
import { BonsaiMesh, WindSway } from "./BonsaiMesh";
import { useGameTextures, useSeasonLight } from "./textures";

function Lights({ env }: { env: THREE.Texture }) {
  const season = useGame((s) => s.tree.season);
  const light = useSeasonLight(season);
  const { scene } = useThree();

  useEffect(() => {
    scene.background = new THREE.Color("#16120e");
    scene.fog = new THREE.FogExp2("#16120e", 0.032);
    scene.environment = env;
    scene.environmentIntensity = 0.32;
  }, [scene, env]);

  return (
    <>
      <hemisphereLight args={[light.dir, "#1a1410", light.hemi * 1.25]} />
      <ambientLight intensity={0.14} color="#3a322c" />
      <directionalLight
        position={[-4.4, 3.6, 1.1]}
        intensity={light.fill * 1.45}
        color={light.dir}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={16}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-bias={-0.0004}
      />
      <spotLight
        position={[-3.4, 2.9, 0.3]}
        angle={0.55}
        penumbra={0.7}
        intensity={10}
        color="#ffe6bf"
        castShadow
        distance={10}
      />
      <pointLight position={[1.4, 1.5, 0.8]} intensity={0.35} color="#c9a07a" />
    </>
  );
}

function CameraRig() {
  const { camera, controls } = useThree();
  const phase = useGame((s) => s.phase);
  const tool = useGame((s) => s.tool);
  const orbitReady = useGame((s) => s.orbitReady);

  useLayoutEffect(() => {
    camera.position.set(1.92, 1.46, 3.55);
    camera.lookAt(0.02, 1.12, 0.02);
    const c = controls as { target?: THREE.Vector3; update?: () => void } | null;
    if (c?.target) {
      c.target.set(0.02, 1.12, 0.02);
      c.update?.();
    }
  }, [camera, controls, phase]);

  useEffect(() => {
    if (phase !== "play") return;
    const arm = () => useGame.setState({ orbitReady: true });
    window.addEventListener("pointerup", arm, { once: true });
    const t = window.setTimeout(arm, 700);
    return () => {
      window.removeEventListener("pointerup", arm);
      window.clearTimeout(t);
    };
  }, [phase]);

  return (
    <OrbitControls
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      minPolarAngle={0.85}
      maxPolarAngle={1.42}
      minDistance={1.8}
      maxDistance={4.6}
      target={[0.02, 1.12, 0.02]}
      enabled={orbitReady && (tool === "look" || tool === "water")}
      makeDefault
    />
  );
}

function World() {
  const textures = useGameTextures();
  const tree = useGame((s) => s.tree);
  const tickWater = useGame((s) => s.tickWater);
  const persist = useGame((s) => s.persist);

  useFrame((_, delta) => {
    tickWater(Math.min(delta, 0.1));
  });

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") persist();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", persist);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", persist);
    };
  }, [persist]);

  if (!textures) return null;

  return (
    <>
      <Lights env={textures.env} />
      <Atelier textures={textures} />
      <group position={[0, 0.97, 0]}>
        <WindSway>
          <BonsaiMesh tree={tree} textures={textures} />
        </WindSway>
      </group>
      <ContactShadows position={[0, 0.786, 0]} opacity={0.45} scale={2.4} blur={2.2} far={0.6} color="#1a120c" />
      <CameraRig />
      <EffectComposer enableNormalPass={false} multisampling={0}>
        <SMAA />
        <Bloom intensity={0.18} luminanceThreshold={0.82} mipmapBlur />
        <Vignette darkness={0.45} offset={0.3} />
      </EffectComposer>
    </>
  );
}

export function GameCanvas() {
  return (
    <Canvas
      className="game-canvas"
      shadows
      dpr={[1, 1.75]}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.18,
        powerPreference: "high-performance",
      }}
      camera={{ position: [1.92, 1.46, 3.55], fov: 42, near: 0.08, far: 40 }}
      onCreated={({ gl }) => {
        gl.shadowMap.enabled = true;
        gl.shadowMap.type = THREE.PCFShadowMap;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
    >
      <World />
    </Canvas>
  );
}
