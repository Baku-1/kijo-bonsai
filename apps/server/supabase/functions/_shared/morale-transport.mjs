import {
  createNewTreeMorale,
  getMoraleAdmission,
  getMoraleCareView,
  readMoraleState,
} from '../derive-stats/engine.bundle.mjs';

/** Public live-state envelope. Combat and care consume the same server truth. */
export function moraleEnvelope(input) {
  const state = readMoraleState(input);
  return { ...state, ...getMoraleCareView(state) };
}

/** New planting only. Existing trees are initialized once by the migration. */
export function newTreeMorale() {
  return createNewTreeMorale();
}

export function moraleAdmission(input) {
  return getMoraleAdmission(readMoraleState(input));
}
