export const SEASONS = ["Spring", "Summer", "Autumn", "Winter"] as const;
export type SeasonIndex = 0 | 1 | 2 | 3;
export type Tool = "look" | "water" | "prune" | "wire" | "rest";
export type Phase = "title" | "play";

export interface FoliagePad {
  size: number;
  flatten: number;
  hue: number;
}

export interface Branch {
  id: string;
  parentId: string | null;
  attach: number;
  length: number;
  radius: number;
  pitch: number;
  yaw: number;
  roll: number;
  bend: number;
  dead: boolean;
  pruned: boolean;
  vigor: number;
  wired: boolean;
  wirePitch: number;
  wireYaw: number;
  foliage: FoliagePad | null;
}

export interface TreeState {
  seed: number;
  ageYears: number;
  season: SeasonIndex;
  moisture: number;
  health: number;
  maturity: number;
  branches: Branch[];
  harmony: number;
  wateredThisSeason: boolean;
}

export const SAVE_VERSION = 2;

export interface SaveBlob {
  version: number;
  tree: TreeState;
  phase: Phase;
}
