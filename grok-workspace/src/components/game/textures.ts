import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { albedoToNormal, makeEquirectEnv, makeScrollTexture } from "@/lib/game/geometry";

export type GameTextures = {
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
};

function prep(tex: THREE.Texture, repeatX = 1, repeatY = 1) {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

export function useGameTextures() {
  const [maps, setMaps] = useState<GameTextures | null>(null);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    const names = ["bark", "wood", "ceramic", "moss", "soil", "stone", "shoji", "plaster"] as const;
    let cancelled = false;
    Promise.all(names.map((n) => loader.loadAsync(`/textures/${n}.jpg`))).then((loaded) => {
      if (cancelled) {
        loaded.forEach((t) => t.dispose());
        return;
      }
      const [bark, wood, ceramic, moss, soil, stone, shoji, plaster] = loaded;
      prep(bark, 2, 3);
      prep(wood, 2, 1);
      prep(ceramic, 1, 1);
      prep(moss, 2, 2);
      prep(soil, 2, 2);
      prep(stone, 1, 1);
      prep(shoji, 1, 1);
      prep(plaster, 2, 2);
      const kit: GameTextures = {
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
      setMaps(kit);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return maps;
}

export function useSeasonLight(season: number) {
  return useMemo(() => {
    const keys = [
      { dir: "#ffe6c2", amb: "#6a7a88", fill: 2.6, hemi: 0.38 },
      { dir: "#ffd7a0", amb: "#5a6a62", fill: 3.2, hemi: 0.42 },
      { dir: "#ffc078", amb: "#6a5a4a", fill: 2.4, hemi: 0.34 },
      { dir: "#d8e2ee", amb: "#4a5560", fill: 1.7, hemi: 0.28 },
    ];
    return keys[season] ?? keys[1];
  }, [season]);
}
