/**
 * derive-stats bundle entry point.
 *
 * BUILD-TIME INPUT ONLY. Re-exports the exact engine symbols derive-stats
 * needs from the monorepo dist output -- the SAME files
 * fixtures/exportFixture.mjs imports (packages/engine/dist/*.js,
 * packages/voxelizer/dist/index.js, and transitively packages/shared/dist).
 *
 * build-engine-bundle.mjs bundles this entry and its whole import graph into a
 * single self-contained ESM file, engine.bundle.mjs, which the deployed Edge
 * Function imports with a plain relative path (see index.ts header for the
 * build + deploy commands).
 *
 * Never add stat math here. This file only re-exports existing engine code so
 * seed + care_log produce identical stats everywhere (determinism invariant).
 */

export {
  CareLogReplay,
  CareLogReplayError,
  StatDeriver,
  BonsaiTree,
} from '../../../../../packages/engine/dist/index.js';

export { Voxelizer, buildCombatSnapshot } from '../../../../../packages/voxelizer/dist/index.js';
