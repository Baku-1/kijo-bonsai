import { create } from "zustand";
import type { Phase, Tool, TreeState } from "./types";
import { loadSave, writeSave } from "./save";
import { maturePine, pruneBranch, restSeason, sapling, waterTree, wireBranch } from "./treeModel";
import { playBell, playSnip, playWater, unlockAudio } from "./audio";

interface GameStore {
  phase: Phase;
  tool: Tool;
  tree: TreeState;
  selectedId: string | null;
  hoverId: string | null;
  watering: number;
  toast: string | null;
  help: boolean;
  muted: boolean;
  orbitReady: boolean;
  enter: () => void;
  newSapling: () => void;
  setTool: (t: Tool) => void;
  setHover: (id: string | null) => void;
  prune: (id: string) => void;
  water: () => void;
  rest: () => void;
  wire: (id: string, dp: number, dy: number) => void;
  select: (id: string | null) => void;
  tickWater: (dt: number) => void;
  persist: () => void;
}

const loaded = typeof window !== "undefined" ? loadSave() : { tree: maturePine(), phase: "title" as const };

export const useGame = create<GameStore>((set, get) => ({
  phase: loaded.phase,
  tool: "look",
  tree: loaded.tree,
  selectedId: null,
  hoverId: null,
  watering: 0,
  toast: null,
  help: false,
  muted: false,
  orbitReady: false,
  enter: () => {
    unlockAudio();
    set({ phase: "play", orbitReady: false });
    get().persist();
  },
  newSapling: () => {
    unlockAudio();
    set({ phase: "play", tree: sapling(), tool: "look", selectedId: null, orbitReady: false });
    get().persist();
  },
  setTool: (tool) => {
    unlockAudio();
    set({ tool, selectedId: tool === "wire" ? get().selectedId : null });
    if (tool === "rest") get().rest();
  },
  setHover: (hoverId) => set({ hoverId }),
  prune: (id) => {
    playSnip();
    set({ tree: pruneBranch(get().tree, id), toast: "Pruned" });
    get().persist();
  },
  water: () => {
    playWater();
    set({ tree: waterTree(get().tree), watering: 1, toast: "Watered" });
    get().persist();
  },
  rest: () => {
    playBell();
    set({ tree: restSeason(get().tree), toast: "A season turns", tool: "look" });
    get().persist();
  },
  wire: (id, dp, dy) => {
    set({ tree: wireBranch(get().tree, id, dp, dy), selectedId: id });
  },
  select: (selectedId) => set({ selectedId }),
  tickWater: (dt) => {
    const w = get().watering;
    if (w <= 0) return;
    set({ watering: Math.max(0, w - dt * 0.85) });
  },
  persist: () => {
    const { tree, phase } = get();
    writeSave(tree, phase);
  },
}));
