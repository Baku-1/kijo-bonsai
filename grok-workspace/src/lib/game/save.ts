import type { SaveBlob, TreeState } from "./types";
import { SAVE_VERSION } from "./types";
import { maturePine } from "./treeModel";

const KEY = "bonsai-atelier-save-v1";
const BACKUP = "bonsai-atelier-save-v1-bak";

const defaults: SaveBlob = {
  version: SAVE_VERSION,
  tree: maturePine(),
  phase: "title",
};

function migrate(raw: SaveBlob): SaveBlob {
  const s = { ...defaults, ...raw };
  if (!s.version || s.version < 2) {
    return structuredClone(defaults);
  }
  s.version = SAVE_VERSION;
  s.tree = { ...defaults.tree, ...s.tree };
  return s;
}

export function loadSave(): SaveBlob {
  try {
    const text = localStorage.getItem(KEY);
    if (!text) return structuredClone(defaults);
    const parsed = JSON.parse(text) as SaveBlob;
    return migrate(parsed);
  } catch {
    try {
      const bak = localStorage.getItem(BACKUP);
      if (bak) return migrate(JSON.parse(bak) as SaveBlob);
    } catch {
      /* ignore */
    }
    return structuredClone(defaults);
  }
}

export function writeSave(tree: TreeState, phase: SaveBlob["phase"]) {
  const blob: SaveBlob = { version: SAVE_VERSION, tree, phase };
  try {
    const prev = localStorage.getItem(KEY);
    if (prev) localStorage.setItem(BACKUP, prev);
    localStorage.setItem(KEY, JSON.stringify(blob));
  } catch {
    /* private mode */
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
