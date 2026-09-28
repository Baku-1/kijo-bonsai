export { MAX_DEPTH } from './tree.js';
export { nextRand } from './rng.js';
// Species grammar retired into @kijo/shared in design step I8: SPECIES_PARAMS is the one live
// table. SpeciesParams stays part of the engine's public surface as a type re-export so
// consumers that imported it from here keep compiling.
export type { SpeciesParams } from '@kijo/shared';
export { BonsaiTree } from './BonsaiTree.js';
export { GrowthEngine } from './GrowthEngine.js';
export type { TaperReport, TaperNode, GrowthStatSnapshot } from './GrowthEngine.js';
export { CareLogReplay, CareLogReplayError, MAX_REPLAY_DAYS } from './CareLogReplay.js';
export { PruneEngine } from './PruneEngine.js';
export { WireEngine, WIRE_MAX_THICKNESS, WIRE_MAX_ANGLE_DELTA } from './WireEngine.js';
export type { WireResult } from './WireEngine.js';
export { StatTerrain } from './StatTerrain.js';
export type { TerrainStat } from './StatTerrain.js';
export { StatDeriver } from './StatDeriver.js';
export type { VoxelSet, StructuralStats, TerrainBonuses } from './StatDeriver.js';
export { TechniqueClassifier } from './TechniqueClassifier.js';
export type { TechniqueResult } from '@kijo/shared';
// Physics engines (2026-08-01)
export { TwineWeightEngine, TWINE_FORCE_PER_DAY, TWINE_MAX_ANGLE_DELTA, WEIGHT_DEGREES_PER_UNIT, STRESS_SET_THRESHOLD, D_MAX } from './TwineWeightEngine.js';
export { JinEngine } from './JinEngine.js';
// Result types re-exported from shared for consumer convenience
export type { TwineResult, TwineRejectReason, WeightResult, WeightRejectReason, JinResult, JinRejectReason } from '@kijo/shared';
// Growth V3 modules
export {
  ceilDivBig, cylinderCostGU, thickeningCostGU, canopyCellCostGU,
  maxDeltaWithinBudget,
  healthBps, moistureBps, computeDailyBudgetGU,
  largestRemainderAllocate, allocateSinks,
  assertBranchConservation, assertDailyBudgetConservation,
  splitSegments,
} from './GrowthLedger.js';
export type { DayStartFactors, AllocationEntry, AllocationResult, SinkAllocationResult } from './GrowthLedger.js';
export {
  canonicalJsonSerialize, canonicalJsonString,
  canonicalHash, sha256Hex, contentAddressedId,
} from './CanonicalHash.js';
export {
  computeBranchWeight, isLeaderBranch, selectSinkDemands,
  scheduleSegmentEvents, sortEventsForOrdinal, createDayPlan,
} from './GrowthPlanner.js';
export type { BranchWeightInput, PlanInput } from './GrowthPlanner.js';
export {
  interpolateQ4, computeEventProgressPpm,
  evaluateEvent, evaluateSegmentEvents,
  findPendingBoundaries,
  evaluateBranchGeometry, q4ToRenderValues,
} from './GrowthMaterializer.js';
export type { EvaluatedEvent, BoundaryKind, BoundaryResult } from './GrowthMaterializer.js';
export {
  compareVoxelOwners, sortVoxelOwners, buildVoxelCell,
  addOwnerToCell, removeOwnersFromCell,
  applyPruneStumpOverlay, packCoordinate, unpackCoordinate,
  computePruneDelta, computeCancelledEventData, computeCancelledEscrow,
  validatePruneReceiptInputs, assemblePruneReceipt,
} from './PruneReceiptEngine.js';
export {
  assignDepthOneRoles, assignRoleByDepth,
  assignAllRolesAtRebaseline, assignNewbornDepthOneRoles,
} from './StableBranchRoles.js';
export type { BranchRoleInput } from './StableBranchRoles.js';
export {
  deriveStructuralV3, deriveTerrainV3, deriveV3,
} from './StatDeriverV3.js';
export type { StructuralStatsV3 } from './StatDeriverV3.js';
export {
  compareCareEvents, compareDecimalStrings, sortCareEvents,
  getInfluenceScope, partitionByInfluence, computeSplice,
  validateCareEventV2,
} from './CareReplayV2.js';
export type { InfluenceScope, SpliceResult } from './CareReplayV2.js';
