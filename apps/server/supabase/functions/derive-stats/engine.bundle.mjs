// kijo-engine:C:\Users\jerem\.gemini\antigravity\playground\kijo\kijo-bonsai\packages\engine\dist\tree.js
function createTree(seed, species) {
  return {
    seed,
    species,
    day: 0,
    moisture: 50,
    health: 60,
    rotation: 0,
    fertilizerDays: 0,
    fertilizerCooldown: 0,
    rngState: seed | 0,
    // v2 (2026-09-09, design 3.2a): explicit 0 default == "the trunk has never forked".
    lastMainForkLength: 0,
    branches: [
      {
        id: 0,
        parent: null,
        depth: 0,
        angle: 0,
        length: 8,
        thickness: 2,
        pruned: false,
        children: [],
        attachmentY: 0,
        // Physics fields (2026-08-01): trunk starts at thickness=2 (radius), so diameter=4.
        // All binding fields default to 0/false (no bindings on creation).
        diameter: 4,
        // round4(2 × thickness=2) = 4.0
        currentStress: 0,
        stressInitial: 0,
        wired: false,
        wireAppliedDay: 0,
        wireAngle: 0,
        wireSet: false,
        wireScarred: false,
        twined: false,
        twineAppliedDay: 0,
        twineAngle: 0,
        twineForcePerDay: 0,
        weighted: false,
        weightCount: 0,
        weightAppliedDay: 0,
        // OQ-1 Option A (2026-08-14)
        weightAngleDelta: 0,
        // OQ-1 Option A (2026-08-14)
        twineDegradesDay: 0,
        bendSet: false,
        // CRITICAL-C fix 2026-08-02
        // Jin / Deadwood State (2026-09-18, JinEngine Phase 2)
        jinned: false,
        jinSegmentStart: -1
      }
    ]
  };
}

// kijo-engine:C:\Users\jerem\.gemini\antigravity\playground\kijo\kijo-bonsai\packages\shared\dist\spiritMorale.js
function percentage(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new RangeError(`${name} must be a finite number from 0 to 100`);
  }
  return value;
}
function booleanFact(value, name) {
  if (typeof value !== "boolean")
    throw new TypeError(`${name} must be boolean`);
  return value;
}
function readMoraleState(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("morale state must be an object");
  }
  const record = input;
  const value = percentage(record.value, "morale value");
  const refusing = booleanFact(record.refusing, "morale refusing");
  return { value, refusing: value < 20 || refusing && value < 50 };
}
function createNewTreeMorale() {
  return { value: 50, refusing: false };
}
function getMoraleAdmission(input) {
  const state = readMoraleState(input);
  if (state.value < 20)
    return { allowed: false, reason: "below-refusal-threshold" };
  if (state.refusing)
    return { allowed: false, reason: "recovering" };
  return { allowed: true };
}
function getMoraleExpression(input) {
  const { value } = readMoraleState(input);
  if (value < 20)
    return "withdrawn";
  if (value < 40)
    return "reluctant";
  if (value <= 70)
    return "composed";
  return "eager";
}
function getMoraleCareView(input) {
  const admission = getMoraleAdmission(input);
  return {
    expression: getMoraleExpression(input),
    willingness: admission.allowed ? "willing" : admission.reason === "recovering" ? "recovering" : "withdrawn"
  };
}
function applyMoraleEvent(input, event) {
  const state = readMoraleState(input);
  if (event === null || typeof event !== "object") {
    throw new TypeError("morale event must be an object");
  }
  let change;
  switch (event.type) {
    case "care-day-completed": {
      const moisture = percentage(event.moisture, "moisture");
      const stable = booleanFact(event.healthStable, "healthStable");
      const rest = booleanFact(event.restDay, "restDay");
      change = (moisture >= 30 && moisture <= 65 && stable ? 2 : 0) + (rest ? 3 : 0) - (moisture < 20 || moisture > 80 ? 3 : 0);
      break;
    }
    case "prune-committed":
      change = 8;
      break;
    case "fertilizer-applied":
      change = 5;
      break;
    case "victory-recorded":
      change = 10;
      break;
    case "consecutive-loss-recorded":
      change = -15;
      break;
    case "battle-fought":
      change = percentage(event.treeHealth, "treeHealth") < 40 ? -5 : 0;
      break;
    case "soothing-potion-consumed":
      change = 100 - state.value;
      break;
    case "ronin-burn-confirmed": {
      const restoration = percentage(event.restoration, "Ronin restoration");
      change = Math.min(restoration, Math.max(0, 65 - state.value));
      break;
    }
    default:
      throw new TypeError("unknown morale event type");
  }
  const value = Math.max(0, Math.min(100, state.value + change));
  return readMoraleState({ value, refusing: state.refusing });
}

// kijo-engine:C:\Users\jerem\.gemini\antigravity\playground\kijo\kijo-bonsai\packages\shared\dist\index.js
var VoxelRole;
(function(VoxelRole2) {
  VoxelRole2["TRUNK"] = "trunk";
  VoxelRole2["ARM"] = "arm";
  VoxelRole2["LEG"] = "leg";
  VoxelRole2["DIGIT"] = "digit";
  VoxelRole2["CANOPY"] = "canopy";
  VoxelRole2["ROOT"] = "root";
  VoxelRole2["SCAR"] = "scar";
})(VoxelRole || (VoxelRole = {}));
var SeededRNG = class {
  seed;
  constructor(seed) {
    this.seed = seed >>> 0;
  }
  next() {
    let t = (this.seed += 1831565813) >>> 0;
    t = Math.imul(t ^ t >>> 15, t | 1) >>> 0;
    t ^= t + (Math.imul(t ^ t >>> 7, t | 61) >>> 0);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
};
function spatialHash(seed, x, y, z) {
  const packed = (x & 255) << 16 | (y & 255) << 8 | z & 255;
  let h = (seed ^ packed) >>> 0;
  h = (h += 1831565813) >>> 0;
  h = Math.imul(h ^ h >>> 15, h | 1) >>> 0;
  h ^= h + (Math.imul(h ^ h >>> 7, h | 61) >>> 0);
  return (h ^ h >>> 14) >>> 0;
}
function round4(x) {
  return Math.round(x * 1e4) / 1e4;
}
var SPECIES_PARAMS = {
  hardwood: { extensionMultiplier: 1, forkSpreadMin: 0.5, forkSpreadMax: 1, secondaryForkChance: 0.45, trunkMaturationRate: 0.05, apicalDominance: 0.65, depthFalloffBase: 0.72, parentExtensionRate: 0.2, branchFloor: 15, branchCap: 26, floorDay: 90, childThicknessFactor: 0.55, trunkContinuedRate: 0.25, forkChance: 0.1, growthRate: 0.6, thickenRate: 0.08, moistureDecay: 4, internodeBase: 9.5, internodeDepthStep: 14, trunkInternode: 19 },
  evergreen: { extensionMultiplier: 0.8, forkSpreadMin: 0.3, forkSpreadMax: 0.7, secondaryForkChance: 0.35, trunkMaturationRate: 0.04, apicalDominance: 0.8, depthFalloffBase: 0.68, parentExtensionRate: 0.15, branchFloor: 15, branchCap: 28, floorDay: 120, childThicknessFactor: 0.5, trunkContinuedRate: 0.2, forkChance: 0.12, growthRate: 0.8, thickenRate: 0.05, moistureDecay: 5, internodeBase: 5, internodeDepthStep: 8, trunkInternode: 7.5 },
  tropical: { extensionMultiplier: 1.3, forkSpreadMin: 0.1, forkSpreadMax: 0.4, secondaryForkChance: 0.25, trunkMaturationRate: 0.06, apicalDominance: 0.45, depthFalloffBase: 0.78, parentExtensionRate: 0.3, branchFloor: 15, branchCap: 30, floorDay: 120, childThicknessFactor: 0.45, trunkContinuedRate: 0.35, forkChance: 0.16, growthRate: 1.2, thickenRate: 0.03, moistureDecay: 7, internodeBase: 15, internodeDepthStep: 27, trunkInternode: 25 }
  // NOTE: tropical forkSpreadMin/Max equals historical evergreen values intentionally.
  // GDD s3.3 "tighter clusters" grounds tropical here; species differentiated further
  // by forkChance (TR:0.16 highest -- in this same table since step I8 retired the engine-local
  // species table), secondaryForkChance (TR:0.25 lowest) and extensionMultiplier (TR:1.3).
};
var LEAF_COLORS = {
  hardwood: ["Red", "Green", "Maroon"],
  // §6.4: Maroon (blood-red) rare
  evergreen: ["Green", "Blue", "Cyan"],
  // §6.4: Cyan rare
  tropical: ["Green", "Dark Green", "Tan", "Yellow"]
  // §6.4: Yellow rare
};
var BARK_COLORS = {
  hardwood: [9136404, 4073251, 10395294],
  // warm brown, dark umber, silver grey (rare)
  evergreen: [7167310, 5131854, 12088115],
  // grey-brown, ashen, copper (rare)
  tropical: [12888194, 11050897, 15261648]
  // tan, pale grey, white (rare)
};
var BARK_COLOR_NAMES = {
  hardwood: ["Warm Brown", "Dark Umber", "Silver Grey"],
  evergreen: ["Grey-Brown", "Ashen", "Copper"],
  tropical: ["Tan", "Pale Grey", "Bleached"]
};
var SPECIES_SUBTYPES = {
  hardwood: ["Straight Trunk", "Twisted Trunk", "Multi-Trunk"],
  evergreen: ["Compact", "Layered", "Cascading"],
  tropical: ["Aerial Roots", "Spreading", "Curved"]
};
var RARE_COLOR_CHANCE = 0.03;
function deriveVisualTraits(seed, species) {
  const rng = new SeededRNG(seed * 7919);
  const subtypes = SPECIES_SUBTYPES[species];
  const subtype = subtypes[Math.floor(rng.next() * subtypes.length)];
  const leafPalette = LEAF_COLORS[species];
  const leafRoll = rng.next();
  const leafIdx = leafRoll < RARE_COLOR_CHANCE ? leafPalette.length - 1 : Math.floor(leafRoll * (leafPalette.length - 1)) % (leafPalette.length - 1);
  const barkPalette = BARK_COLORS[species];
  const barkNames = BARK_COLOR_NAMES[species];
  const barkRoll = rng.next();
  const barkIdx = barkRoll < RARE_COLOR_CHANCE ? barkPalette.length - 1 : Math.floor(barkRoll * (barkPalette.length - 1)) % (barkPalette.length - 1);
  return {
    subtype,
    leafColor: leafPalette[leafIdx],
    barkColor: barkPalette[barkIdx],
    barkColorName: barkNames[barkIdx]
  };
}

// kijo-engine:C:\Users\jerem\.gemini\antigravity\playground\kijo\kijo-bonsai\packages\engine\dist\errors.js
var CareLogReplayError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "CareLogReplayError";
  }
};

// kijo-engine:C:\Users\jerem\.gemini\antigravity\playground\kijo\kijo-bonsai\packages\engine\dist\PruneEngine.js
var PruneEngine = class {
  /**
   * Prune branch `branchId` and all its descendants.
   *
   * Returns false (no-op) when:
   *   • branchId is out of range
   *   • the branch is the trunk (depth === 0)
   *   • the branch is already pruned
   *
   * On success:
   *   1. Marks target + all descendants `pruned = true` via iterative cascade.
   *   2. Logs { day: tree.getAge(), action: { type: 'prune', branchId } }.
   *   3. Calls tree.markDirty().
   *   4. Returns true.
   */
  static prune(tree, branchId) {
    if (!Number.isFinite(branchId) || branchId < 0 || !Number.isInteger(branchId)) {
      throw new CareLogReplayError(`PruneEngine.prune: branchId must be a non-negative integer (got ${branchId}).`);
    }
    const branches = tree.getBranches();
    if (branchId < 0 || branchId >= branches.length)
      return false;
    const target = branches[branchId];
    if (target.depth === 0)
      return false;
    if (target.pruned)
      return false;
    const stack = [branchId];
    while (stack.length > 0) {
      const id = stack.pop();
      const b = tree._getBranchMutable(id);
      if (!b || b.pruned)
        continue;
      b.pruned = true;
      for (const childId of b.children) {
        stack.push(childId);
      }
    }
    const entry = {
      day: tree.getAge(),
      action: { type: "prune", branchId }
    };
    tree._logCare(entry);
    tree.markDirty();
    return true;
  }
};

// kijo-engine:C:\Users\jerem\.gemini\antigravity\playground\kijo\kijo-bonsai\packages\engine\dist\TwineWeightEngine.js
var TWINE_MAX_ANGLE_DELTA = 28;
var WEIGHT_DEGREES_PER_UNIT = 7;
var KENGAI_POLAR_MAX = 150;
var STRESS_DECAY_MIN_DAYS = 28;
var STRESS_DECAY_MAX_DAYS = 56;
var D_MAX = 6;
var TWINE_FORCE_PER_DAY = 0.02;
var WEIGHT_MASS_PER_UNIT = 0.05;
var GRAVITY_CONSTANT = 9.81;
var POLAR_MIN_DEG = 5.7296;
var SPRING_RATE = 1;
var clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
function toRad(degrees) {
  return degrees * Math.PI / 180;
}
function computeSetDays(diameter) {
  const d = Math.min(D_MAX, diameter);
  return STRESS_DECAY_MIN_DAYS + (STRESS_DECAY_MAX_DAYS - STRESS_DECAY_MIN_DAYS) * (d / D_MAX);
}
var TwineWeightEngine = class {
  /**
   * Apply natural-fiber twine to a branch, bending it by angleDelta degrees.
   *
   * @param tree            The BonsaiTree instance.
   * @param branchId        Index into TreeState.branches.
   * @param angleDelta      Signed degrees. Clamped to ±TWINE_MAX_ANGLE_DELTA (28°).
   * @param storedDegradeDays  Optional: on replay path, the stored RNG draw from
   *                           the original care log. Absent on live path (new draw).
   *
   * NOTE on b.twineAngle semantics: set to the applied delta at applyTwine time.
   * processTwineDegrade decrements this field toward 0 (remaining bend accumulator).
   * At any mid-degrade snapshot, twineAngle is REMAINING bend, not original delta.
   * The care log entry (type: 'twine', angleDelta) is the original applied delta.
   *
   * Returns { ok: false, reason } when: branch not found, already pruned, already twined.
   * Returns { ok: true, oldAngle, newAngle } on success.
   */
  static applyTwine(tree, branchId, angleDelta, storedDegradeDays) {
    const branches = tree.getBranches();
    const b = branches[branchId];
    if (!b)
      return { ok: false, reason: "not-found" };
    if (b.pruned)
      return { ok: false, reason: "pruned" };
    if (b.twined)
      return { ok: false, reason: "already-twined" };
    const clampedInput = round4(clamp(angleDelta, -TWINE_MAX_ANGLE_DELTA, TWINE_MAX_ANGLE_DELTA));
    const oldAngle = b.angle;
    const newAngle = round4(clamp(oldAngle + clampedInput, POLAR_MIN_DEG, KENGAI_POLAR_MAX));
    const appliedDelta = round4(newAngle - oldAngle);
    let degradeDays;
    if (storedDegradeDays !== void 0) {
      degradeDays = storedDegradeDays;
    } else {
      const rng = new SeededRNG(tree.getSeed() + branchId * 31337 + tree.getAge() * 997);
      degradeDays = Math.floor(10 + rng.next() * 6);
    }
    b.angle = newAngle;
    b.twined = true;
    b.twineAppliedDay = tree.getAge();
    b.twineAngle = appliedDelta;
    b.twineForcePerDay = TWINE_FORCE_PER_DAY;
    b.twineDegradesDay = tree.getAge() + degradeDays;
    b.stressInitial = 0;
    b.currentStress = 0;
    const entry = {
      day: tree.getAge(),
      action: {
        type: "twine",
        branchId,
        angleDelta: appliedDelta,
        // APPLIED delta (post-clamp), not raw input
        oldAngle,
        newAngle,
        degradeDays
      }
    };
    tree._logCare(entry);
    tree.markDirty();
    return { ok: true, oldAngle, newAngle };
  }
  /**
   * Remove twine from a branch before natural degradation.
   * Applies time-ratio spring-back: springBack = twineAngle × max(0, 1 - daysApplied/setDays).
   * No-op if branchId not found, branch pruned, or branch not twined.
   *
   * OQ-3 RESOLVED (Jeremy, 2026-08-14): time-ratio spring-back confirmed for all bindings.
   */
  static removeTwine(tree, branchId) {
    const branches = tree.getBranches();
    const b = branches[branchId];
    if (!b)
      return;
    if (b.pruned)
      return;
    if (!b.twined)
      return;
    const twineDaysApplied = tree.getAge() - b.twineAppliedDay;
    const setDays = computeSetDays(b.diameter);
    if (twineDaysApplied >= setDays) {
      b.bendSet = true;
    } else {
      const springBackFraction = Math.max(0, Math.min(1, 1 - twineDaysApplied / setDays));
      const springBackAmount = round4(b.twineAngle * springBackFraction);
      b.angle = round4(clamp(b.angle - springBackAmount, POLAR_MIN_DEG, KENGAI_POLAR_MAX));
    }
    b.twined = false;
    b.twineAngle = 0;
    b.twineAppliedDay = 0;
    b.twineForcePerDay = 0;
    b.twineDegradesDay = 0;
    if (!b.weighted) {
      b.stressInitial = 0;
      b.currentStress = 0;
    }
    const entry = {
      day: tree.getAge(),
      action: { type: "twine-remove", branchId }
    };
    tree._logCare(entry);
    tree.markDirty();
  }
  /**
   * Attach weight bags to a branch.
   *
   * OQ-5 STACK semantics (confirmed by Jeremy Gordon, 2026-08-14):
   *   Calling applyWeight on an already-weighted branch ACCUMULATES weightAngleDelta.
   *   New delta is added to existing weightAngleDelta, capped at TWINE_MAX_ANGLE_DELTA (28°).
   *   Angle change is applied IMMEDIATELY to branch.angle at call time.
   *   Does not replace or reject — no already-weighted guard.
   *
   * @param tree        The BonsaiTree instance.
   * @param branchId    Index into TreeState.branches.
   * @param weightCount Integer 1–4.
   *
   * Returns { ok: false, reason } when: not-found, pruned, weight-cap-exceeded.
   * Returns { ok: true, torqueContribution } on success.
   */
  static applyWeight(tree, branchId, weightCount) {
    const branches = tree.getBranches();
    const b = branches[branchId];
    if (!b)
      return { ok: false, reason: "not-found" };
    if (b.pruned)
      return { ok: false, reason: "pruned" };
    if (weightCount < 1 || weightCount > 4)
      return { ok: false, reason: "weight-cap-exceeded" };
    const newDelta = round4(weightCount * WEIGHT_DEGREES_PER_UNIT);
    const oldAngle = b.angle;
    b.angle = round4(clamp(b.angle + newDelta, POLAR_MIN_DEG, KENGAI_POLAR_MAX));
    const actualDelta = round4(b.angle - oldAngle);
    b.weightAngleDelta = round4(Math.min(TWINE_MAX_ANGLE_DELTA, b.weightAngleDelta + actualDelta));
    b.weightAppliedDay = tree.getAge();
    b.weighted = true;
    b.weightCount = weightCount;
    if (!b.twined) {
      b.stressInitial = 0;
      b.currentStress = 0;
    }
    const torqueContribution = round4(weightCount * WEIGHT_MASS_PER_UNIT * GRAVITY_CONSTANT * b.length * Math.sin(toRad(b.angle)));
    const entry = {
      day: tree.getAge(),
      action: { type: "weight", branchId, weightCount, torqueContribution }
    };
    tree._logCare(entry);
    tree.markDirty();
    return { ok: true, torqueContribution };
  }
  /**
   * Remove weight bags from a branch.
   * Applies time-ratio spring-back using weightAngleDelta as the accumulated applied angle.
   * No-op if branchId not found, branch pruned, or branch not weighted.
   *
   * OQ-3 RESOLVED (Jeremy, 2026-08-14): same spring-back formula as removeTwine.
   * OQ-1 RESOLVED (Jeremy, 2026-08-14): uses weightAppliedDay and weightAngleDelta fields.
   */
  static removeWeight(tree, branchId) {
    const branches = tree.getBranches();
    const b = branches[branchId];
    if (!b)
      return;
    if (b.pruned)
      return;
    if (!b.weighted)
      return;
    const weightDaysApplied = tree.getAge() - b.weightAppliedDay;
    const setDays = computeSetDays(b.diameter);
    if (weightDaysApplied >= setDays) {
      b.bendSet = true;
    } else {
      const springBackFraction = Math.max(0, Math.min(1, 1 - weightDaysApplied / setDays));
      const springBackAmount = round4(b.weightAngleDelta * springBackFraction);
      b.angle = round4(clamp(b.angle - springBackAmount, POLAR_MIN_DEG, KENGAI_POLAR_MAX));
    }
    b.weighted = false;
    b.weightCount = 0;
    b.weightAppliedDay = 0;
    b.weightAngleDelta = 0;
    if (!b.twined) {
      b.stressInitial = 0;
      b.currentStress = 0;
    }
    const entry = {
      day: tree.getAge(),
      action: { type: "weight-remove", branchId }
    };
    tree._logCare(entry);
    tree.markDirty();
  }
  /**
   * Process per-tick angle change for weight.
   * Called from BonsaiTree.applyDailyUpdate step 4e when b.weighted === true.
   *
   * No-op: Under OQ-5 STACK model (Jeremy confirmed 2026-08-14), weight angle is
   * applied IMMEDIATELY at applyWeight time. No incremental tick accumulation needed.
   * This method exists for structural symmetry with processTwineDegrade and to
   * satisfy the BonsaiTree step-4e call contract.
   *
   * @param _b The branch (unused — angle already applied).
   */
  static processWeightTick(_b) {
  }
  /**
   * Process twine degradation when twineDegradesDay has been reached.
   * Called from BonsaiTree.applyDailyUpdate step 4d when:
   *   b.twined === true && b.twineDegradesDay > 0 && currentDay >= b.twineDegradesDay.
   *
   * Applies 1°/day (SPRING_RATE) spring-back in the direction that reduces b.twineAngle
   * toward 0. On the final step (|b.twineAngle| <= SPRING_RATE), reverses the remaining
   * angle and clears all twine state.
   *
   * NOTE: bendSet is NOT set during natural degrade — natural degradation period [10, 15] days
   * is always shorter than setDays [28, 56], so the bend cannot permanently set via degrade.
   *
   * NOTE: markDirty() is NOT called here — GrowthEngine.growTick calls markDirty() after
   * applyDailyUpdate. Adding another markDirty here would be redundant.
   *
   * @param b The branch (mutable).
   */
  static processTwineDegrade(b) {
    if (b.twineAngle === 0)
      return;
    if (Math.abs(b.twineAngle) <= SPRING_RATE) {
      const remainingAngle = b.twineAngle;
      b.angle = round4(clamp(b.angle - remainingAngle, POLAR_MIN_DEG, KENGAI_POLAR_MAX));
      b.twined = false;
      b.twineAngle = 0;
      b.twineAppliedDay = 0;
      b.twineForcePerDay = 0;
      b.twineDegradesDay = 0;
      if (!b.weighted) {
        b.stressInitial = 0;
        b.currentStress = 0;
      }
    } else {
      const step = Math.sign(b.twineAngle) * SPRING_RATE;
      b.angle = round4(clamp(b.angle - step, POLAR_MIN_DEG, KENGAI_POLAR_MAX));
      b.twineAngle = round4(b.twineAngle - step);
    }
  }
};

// kijo-engine:C:\Users\jerem\.gemini\antigravity\playground\kijo\kijo-bonsai\packages\engine\dist\WireEngine.js
var WIRE_MAX_ANGLE_DELTA = 45;
var WIRE_MAX_THICKNESS = 3;
var WIRE_COST_T1_MAX = 1.5;
var POLAR_MIN_DEG2 = 5.7296;
var POLAR_MAX_DEG = 150;
var clamp2 = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
var WireEngine = class _WireEngine {
  /** Wire cost for a branch of the given thickness. Thickness-tiered. */
  static wireCostFor(thickness) {
    return thickness <= WIRE_COST_T1_MAX ? 1 : 2;
  }
  /**
   * Bend a branch by angleDelta degrees (signed, caregiver-chosen).
   * Any branch at any depth, including the trunk, can be wired (OQ-1, 2026-07-31).
   *
   * Returns { ok: false, reason } (no-op) when:
   *   - branchId out of range
   *   - branch is pruned
   *   - branch thickness > WIRE_MAX_THICKNESS
   *
   * On success: clamps delta to +/-45 and the result to the polar range,
   * applies round4, pushes the care-log entry, marks the tree dirty.
   */
  static wire(tree, branchId, angleDelta) {
    if (!Number.isFinite(branchId) || branchId < 0 || !Number.isInteger(branchId)) {
      throw new CareLogReplayError(`WireEngine.wire: branchId must be a non-negative integer (got ${branchId}).`);
    }
    if (!Number.isFinite(angleDelta)) {
      throw new CareLogReplayError(`WireEngine.wire: angleDelta must be a finite number (got ${angleDelta}).`);
    }
    const branches = tree.getBranches();
    const b = branches[branchId];
    if (!b)
      return { ok: false, reason: "not-found" };
    if (b.pruned)
      return { ok: false, reason: "pruned" };
    if (b.thickness > WIRE_MAX_THICKNESS)
      return { ok: false, reason: "too-thick" };
    const oldAngle = b.angle;
    const delta = round4(clamp2(angleDelta, -WIRE_MAX_ANGLE_DELTA, WIRE_MAX_ANGLE_DELTA));
    const newAngle = round4(clamp2(oldAngle + delta, POLAR_MIN_DEG2, POLAR_MAX_DEG));
    b.wireCount = (b.wireCount ?? 0) + 1;
    const HAN_KENGAI_GATE_DEG = 120;
    const cascadeGate = b.wireCount >= 3 ? POLAR_MAX_DEG : Math.min(HAN_KENGAI_GATE_DEG, POLAR_MAX_DEG);
    const clampedAngle = round4(Math.max(POLAR_MIN_DEG2, Math.min(cascadeGate, newAngle)));
    const appliedDelta = round4(clampedAngle - oldAngle);
    const wireCost = _WireEngine.wireCostFor(b.thickness);
    b.angle = clampedAngle;
    b.wired = true;
    b.wireAppliedDay = tree.getAge();
    b.wireAngle = appliedDelta;
    b.wireSet = false;
    const entry = {
      day: tree.getAge(),
      action: { type: "wire", branchId, angleDelta: appliedDelta, oldAngle, newAngle: clampedAngle, wireCost }
    };
    tree.getCareLog().push(entry);
    tree.markDirty();
    return { ok: true, wireCost, oldAngle, newAngle: clampedAngle };
  }
  /**
   * Remove wire from a branch. Free action — no consumable cost.
   *
   * Timing determines outcome (time-ratio model — CRITICAL-A fix 2026-08-02):
   *   Wire does NOT contribute to τ/currentStress, so the stress-based model cannot
   *   distinguish early vs. late removal for wire-only branches. Instead, timing is
   *   determined by wireDaysApplied relative to computeSetDays(diameter).
   *
   *   - wireDaysApplied >= setDays (wire removed after set window):
   *       wireSet = true, bendSet = true. No spring-back. Bend is permanent.
   *   - wireDaysApplied < setDays (wire removed early):
   *       springBackFraction = 1 - wireDaysApplied/setDays, clamped [0, 1].
   *       springBackAmount = wireAngle × fraction.
   *       angle springs back by springBackAmount, clamped to polar range.
   *
   *   wireScarred branches: bend permanent; wire-remove stops further SCAR accumulation
   *   (the step-4c SCAR timer is gated on b.wired, cleared below).
   *
   * No-op (silent) if branchId out of range, branch pruned, or !branch.wired.
   * Uses tree._logCare() (established pattern from PruneEngine).
   */
  static removeWire(tree, branchId) {
    if (!Number.isFinite(branchId) || branchId < 0 || !Number.isInteger(branchId)) {
      throw new CareLogReplayError(`WireEngine.removeWire: branchId must be a non-negative integer (got ${branchId}).`);
    }
    const branches = tree.getBranches();
    const b = branches[branchId];
    if (!b)
      return;
    if (b.pruned)
      return;
    if (!b.wired)
      return;
    const wireDaysApplied = tree.getAge() - b.wireAppliedDay;
    const setDays = computeSetDays(b.diameter);
    if (wireDaysApplied >= setDays) {
      b.wireSet = true;
      b.bendSet = true;
    } else {
      const springBackFraction = Math.max(0, Math.min(1, 1 - wireDaysApplied / setDays));
      const springBackAmount = round4(b.wireAngle * springBackFraction);
      b.angle = round4(clamp2(b.angle - springBackAmount, POLAR_MIN_DEG2, POLAR_MAX_DEG));
    }
    b.wired = false;
    b.wireAngle = 0;
    b.wireAppliedDay = 0;
    const entry = {
      day: tree.getAge(),
      action: { type: "wire-remove", branchId }
    };
    tree._logCare(entry);
    tree.markDirty();
  }
};

// kijo-engine:C:\Users\jerem\.gemini\antigravity\playground\kijo\kijo-bonsai\packages\engine\dist\JinEngine.js
var JinEngine = class {
  /**
   * Strip bark from a branch section using jin pliers -> SCAR voxels.
   *
   * Steps:
   *   1. Validate branchId, pruned, segmentIndex (existing Phase 1 logic)
   *   2. Check already-jin: if jinned && segmentIndex >= jinSegmentStart
   *   3. Mark branch jinned, set jinSegmentStart
   *   4. Cascade: mark all child branches fully jinned
   *   5. Freeze is implicit (GrowthEngine/physics skip b.jinned)
   *   6. Log care entry via tree._logCare
   *   7. tree.markDirty()
   *   8. Return { ok: true }
   *
   * @param tree         The BonsaiTree instance.
   * @param branchId     Index into TreeState.branches.
   * @param segmentIndex 0-based position from trunk junction.
   * @param jinCost      jin-pliers consumables spent (>= 1). Logged only.
   */
  static applyJin(tree, branchId, segmentIndex, jinCost) {
    const branches = tree.getBranches();
    const b = branches[branchId];
    if (!b)
      return { ok: false, reason: "not-found" };
    if (b.pruned)
      return { ok: false, reason: "pruned" };
    if (segmentIndex < 0 || segmentIndex >= b.length) {
      return { ok: false, reason: "segment-out-of-range" };
    }
    if (b.jinned && segmentIndex >= b.jinSegmentStart) {
      return { ok: false, reason: "already-jin" };
    }
    if (b.jinned) {
      b.jinSegmentStart = segmentIndex;
    } else {
      b.jinned = true;
      b.jinSegmentStart = segmentIndex;
    }
    const stack = [...b.children];
    while (stack.length > 0) {
      const childId = stack.pop();
      const child = branches[childId];
      if (!child || child.pruned)
        continue;
      if (child.jinned && child.jinSegmentStart === 0)
        continue;
      child.jinned = true;
      child.jinSegmentStart = 0;
      stack.push(...child.children);
    }
    tree._logCare({
      day: tree.getAge(),
      action: { type: "jin", branchId, segmentIndex, jinCost }
    });
    tree.markDirty();
    return { ok: true };
  }
};

// kijo-engine:C:\Users\jerem\.gemini\antigravity\playground\kijo\kijo-bonsai\packages\engine\dist\BonsaiTree.js
var BonsaiTree = class {
  state;
  dirty = false;
  careLog = [];
  nextId;
  constructor(seed, species) {
    this.state = createTree(seed, species);
    this.state.moisture = 55;
    this.state.health = 85;
    this.nextId = 1;
  }
  // -------------------------------------------------------------------------
  // Canonical branchId guard (B-1: includes upper bound check)
  // -------------------------------------------------------------------------
  /** Throws CareLogReplayError if branchId is not a valid non-negative integer
   *  within the current branches array bounds. */
  _guardBranchId(method, branchId) {
    if (!Number.isFinite(branchId) || branchId < 0 || !Number.isInteger(branchId) || branchId >= this.state.branches.length) {
      throw new CareLogReplayError(`${method}: branchId must be a non-negative integer < ${this.state.branches.length} (got ${branchId}).`);
    }
  }
  // -------------------------------------------------------------------------
  // State mutation
  // -------------------------------------------------------------------------
  /**
   * Advance daily moisture decay and health update.
   * Decay: 5.0–9.0, seeded by seed + day*1000 (uses day BEFORE increment).
   * Health: +0.8 if moisture ∈ [30,65]; −1.5 if moisture <15 or >80; −0.3 otherwise.
   */
  applyDailyUpdate() {
    const rng = new SeededRNG(this.state.seed + this.state.day * 1e3);
    const decay = round4(5 + rng.next() * 4);
    this.state.moisture = Math.max(0, round4(this.state.moisture - decay));
    const m = this.state.moisture;
    if (m >= 30 && m <= 65) {
      this.state.health = round4(Math.min(100, this.state.health + 0.8));
    } else if (m < 15 || m > 80) {
      this.state.health = round4(Math.max(10, this.state.health - 1.5));
    } else {
      this.state.health = round4(Math.max(10, this.state.health - 0.3));
    }
    this.state.day += 1;
    for (const b of this.state.branches) {
      if (b.pruned || b.jinned)
        continue;
      if ((b.twined || b.weighted) && !b.bendSet) {
        const tauTwine = b.twined ? b.twineForcePerDay * (this.state.day - b.twineAppliedDay) * b.length * Math.sin(toRad(b.twineAngle)) : 0;
        const tauWeight = b.weighted ? b.weightCount * WEIGHT_MASS_PER_UNIT * GRAVITY_CONSTANT * b.length * Math.sin(toRad(b.angle)) : 0;
        const dCubed = Math.max(Math.pow(b.diameter, 3), 1e-6);
        b.currentStress = round4((tauTwine + tauWeight) / dCubed);
        if (b.stressInitial === 0 && b.currentStress > 0) {
          b.stressInitial = b.currentStress;
        }
      }
      if (b.wired && !b.wireScarred) {
        const wireDaysApplied = this.state.day - b.wireAppliedDay;
        if (wireDaysApplied > 0) {
          const setDays = computeSetDays(b.diameter);
          if (wireDaysApplied >= setDays) {
            b.wireScarred = true;
          }
        }
      }
      if (b.twined && b.twineDegradesDay > 0 && this.state.day >= b.twineDegradesDay) {
        TwineWeightEngine.processTwineDegrade(b);
      }
      if (b.weighted) {
        TwineWeightEngine.processWeightTick(b);
      }
    }
  }
  water(amount) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new CareLogReplayError(`water: amount must be a positive finite number (got ${amount}).`);
    }
    this.state.moisture = Math.min(100, round4(this.state.moisture + amount));
    this.careLog.push({ day: this.state.day, action: { type: "water", amount } });
  }
  fertilize() {
    if (this.state.fertilizerCooldown > 0)
      return;
    this.state.fertilizerDays = 5;
    this.state.fertilizerCooldown = 8;
    this.careLog.push({ day: this.state.day, action: { type: "fertilize" } });
  }
  /**
   * Wire-bend a depth-1 branch (Gu Ahao's Tied and Cut Toolkit).
   * Delegates to WireEngine (stateless, same pattern as prune).
   * angleDelta is caregiver-chosen, clamped to +/-45 per action.
   */
  wire(branchId, angleDelta) {
    this._guardBranchId("wire", branchId);
    if (!Number.isFinite(angleDelta)) {
      throw new CareLogReplayError(`wire: angleDelta must be a finite number (got ${angleDelta}).`);
    }
    return WireEngine.wire(this, branchId, angleDelta);
  }
  rotate() {
    this.state.rotation = (this.state.rotation + 90) % 360;
    this.careLog.push({ day: this.state.day, action: { type: "rotate" } });
  }
  // ── Branch physics methods (2026-08-01) ──────────────────────────────────────
  // Specification: ARCHITECT-BRANCH-PHYSICS-2026-08-01.md Part B.
  // All delegate to stateless engine classes (same pattern as wire → WireEngine,
  // prune → PruneEngine). Input validation for adversarial paths happens here
  // or in the engine before the "not yet implemented" throw.
  /**
   * Remove wire from a branch. Free action — no consumable cost.
   * Timing determines outcome: see WireEngine.removeWire for full semantics.
   * No-op if branchId is out of range, pruned, or !branch.wired.
   */
  removeWire(branchId) {
    this._guardBranchId("removeWire", branchId);
    return WireEngine.removeWire(this, branchId);
  }
  /**
   * Apply natural-fiber twine to a branch, bending it by angleDelta degrees.
   * angleDelta clamped to ±28° (TWINE_MAX_ANGLE_DELTA).
   * Throws if inputs are non-finite or would be rejected by validation guards.
   * Phase 1 stub: delegates to TwineWeightEngine.applyTwine (throws "not implemented").
   */
  applyTwine(branchId, angleDelta, storedDegradeDays) {
    this._guardBranchId("applyTwine", branchId);
    if (!Number.isFinite(angleDelta)) {
      throw new CareLogReplayError(`applyTwine: angleDelta must be finite (got ${angleDelta}).`);
    }
    if (storedDegradeDays !== void 0) {
      if (!Number.isFinite(storedDegradeDays) || storedDegradeDays < 0 || !Number.isInteger(storedDegradeDays) || storedDegradeDays > 20) {
        throw new CareLogReplayError(`applyTwine: storedDegradeDays must be a non-negative integer <= 20 (got ${storedDegradeDays}).`);
      }
    }
    return TwineWeightEngine.applyTwine(this, branchId, angleDelta, storedDegradeDays);
  }
  /**
   * Remove twine from a branch before natural degradation.
   * No-op if branchId out of range, pruned, or !branch.twined.
   * Phase 1 stub.
   */
  removeTwine(branchId) {
    this._guardBranchId("removeTwine", branchId);
    return TwineWeightEngine.removeTwine(this, branchId);
  }
  /**
   * Attach weight bags to a branch. weightCount must be integer 1–4.
   * Throws CareLogReplayError for invalid (NaN, negative, infinite, non-integer, out-of-range) weightCount.
   * Phase 1 stub: delegates to TwineWeightEngine.applyWeight.
   */
  applyWeight(branchId, weightCount) {
    this._guardBranchId("applyWeight", branchId);
    if (!Number.isFinite(weightCount)) {
      throw new CareLogReplayError(`applyWeight: weightCount must be finite (got ${weightCount}). NaN or Infinity are not valid.`);
    }
    if (!Number.isInteger(weightCount) || weightCount < 1 || weightCount > 4) {
      throw new CareLogReplayError(`applyWeight: weightCount must be an integer 1\u20134 (got ${weightCount}).`);
    }
    return TwineWeightEngine.applyWeight(this, branchId, weightCount);
  }
  /**
   * Remove weight bags from a branch.
   * No-op if branchId out of range, pruned, or !branch.weighted.
   * Phase 1 stub.
   */
  removeWeight(branchId) {
    this._guardBranchId("removeWeight", branchId);
    return TwineWeightEngine.removeWeight(this, branchId);
  }
  /**
   * Apply jin pliers to a branch section → SCAR voxels. Irreversible. Premium action.
   * Throws CareLogReplayError for invalid segmentIndex or jinCost.
   * Phase 1 stub: delegates to JinEngine.applyJin.
   */
  applyJin(branchId, segmentIndex, jinCost) {
    this._guardBranchId("applyJin", branchId);
    if (!Number.isFinite(segmentIndex) || segmentIndex < 0 || !Number.isInteger(segmentIndex)) {
      throw new CareLogReplayError(`applyJin: segmentIndex must be a non-negative integer (got ${segmentIndex}).`);
    }
    if (!Number.isFinite(jinCost) || jinCost < 1 || !Number.isInteger(jinCost)) {
      throw new CareLogReplayError(`applyJin: jinCost must be a positive integer (got ${jinCost}).`);
    }
    return JinEngine.applyJin(this, branchId, segmentIndex, jinCost);
  }
  /**
   * Place a landscape element in the pot. Phase 1: logs and marks dirty.
   * Throws CareLogReplayError if position is out of 0-255 bounds (each axis).
   * See ARCHITECT-BRANCH-PHYSICS-2026-08-01.md Part B addLandscape stub.
   * Note: addLandscape signature uses (elementType, position) per ARCHITECT spec,
   * not (position) alone as in the task prompt (which omits elementType).
   */
  addLandscape(elementType, position) {
    if (!Number.isInteger(position.x) || position.x < 0 || position.x > 255 || !Number.isInteger(position.y) || position.y < 0 || position.y > 255 || !Number.isInteger(position.z) || position.z < 0 || position.z > 255) {
      throw new CareLogReplayError(`addLandscape: position must be integers in [0, 255] on each axis (got ${JSON.stringify(position)}).`);
    }
    this._logCare({ day: this.state.day, action: { type: "landscape", elementType, position } });
    this.markDirty();
  }
  // Expose TWINE_FORCE_PER_DAY for test/verification without engine internals.
  static TWINE_FORCE_PER_DAY = TWINE_FORCE_PER_DAY;
  prune(branchId) {
    this._guardBranchId("prune", branchId);
    return PruneEngine.prune(this, branchId);
  }
  // -------------------------------------------------------------------------
  // Accessors
  // -------------------------------------------------------------------------
  getRoot() {
    return this.state.branches[0];
  }
  getRootMutable() {
    return this.state.branches[0];
  }
  getMoisture() {
    return this.state.moisture;
  }
  getHealth() {
    return this.state.health;
  }
  /** Returns current day counter (incremented by applyDailyUpdate). */
  getAge() {
    return this.state.day;
  }
  getSeed() {
    return this.state.seed;
  }
  getSpecies() {
    return this.state.species;
  }
  getRotationState() {
    return this.state.rotation;
  }
  isFertilizerActive() {
    return this.state.fertilizerDays > 0;
  }
  getCareLog() {
    return this.careLog;
  }
  getBranches() {
    return this.state.branches;
  }
  getNextBranchId() {
    return this.nextId;
  }
  // -------------------------------------------------------------------------
  // Dirty flag — Renderer ONLY clears (see KIJO-ARCHITECTURE.md §4)
  // -------------------------------------------------------------------------
  isDirty() {
    return this.dirty;
  }
  markDirty() {
    this.dirty = true;
  }
  clearDirty() {
    this.dirty = false;
  }
  // -------------------------------------------------------------------------
  // Verification helpers
  // -------------------------------------------------------------------------
  /**
   * Counts living (non-pruned) non-trunk branches.
   * Excludes trunk so that: nextId === countLivingBranches() + getPrunedCount() + 1 (G2 invariant).
   */
  countLivingBranches() {
    return this.state.branches.filter((b) => !b.pruned && b.parent !== null).length;
  }
  getPrunedCount() {
    return this.state.branches.filter((b) => b.pruned).length;
  }
  getTotalMass() {
    return round4(this.state.branches.filter((b) => !b.pruned).reduce((sum, b) => sum + b.thickness * b.thickness * b.length, 0));
  }
  // -------------------------------------------------------------------------
  // Internal — for GrowthEngine / PruneEngine use only
  // -------------------------------------------------------------------------
  _getState() {
    return this.state;
  }
  /** Allocate and return the next branch id, advancing the counter. */
  _allocBranchId() {
    return this.nextId++;
  }
  _pushBranch(b) {
    this.state.branches.push(b);
  }
  /** Append a care-log entry (used by PruneEngine). */
  _logCare(entry) {
    this.careLog.push(entry);
  }
  /** Return the mutable Branch at index id (used by PruneEngine to set pruned). */
  _getBranchMutable(id) {
    return this.state.branches[id];
  }
  _tickFertilizer() {
    if (this.state.fertilizerDays > 0)
      this.state.fertilizerDays--;
    if (this.state.fertilizerCooldown > 0)
      this.state.fertilizerCooldown--;
  }
};

// kijo-engine:C:\Users\jerem\.gemini\antigravity\playground\kijo\kijo-bonsai\packages\engine\dist\GrowthEngine.js
var MIN_TRUNK_FOR_FIRST_BRANCH = 20;
var NEWBORN_BRANCH_LENGTH = 1;
var ROTATION_BIAS_STRENGTH = 0.15;
var TAPER_CLAMP_FACTOR = 0.95;
var MIN_BRANCH_THICKNESS = 0.3;
var GrowthEngine = class _GrowthEngine {
  /**
   * Advance tree one full day.
   * Order is load-bearing per spec:
   *   1. applyDailyUpdate + _tickFertilizer
   *   2. calculateGrowthRate
   *   3. extendAndFork (pre-order)
   *   4. thickeningPass (post-order, Leonardo's Rule)
   *   5. markDirty
   */
  static growTick(tree) {
    tree.applyDailyUpdate();
    tree._tickFertilizer();
    const rate = _GrowthEngine.calculateGrowthRate(tree);
    const livingCount0 = tree.countLivingBranches();
    const floorTipId = _GrowthEngine.selectFloorTipId(tree, rate, livingCount0);
    _GrowthEngine.extendAndFork(tree.getRoot(), tree, rate, livingCount0, floorTipId);
    _GrowthEngine.thickeningPass(tree.getRoot(), tree, rate);
    _GrowthEngine.enforceTaper(tree);
    tree.markDirty();
  }
  static calculateGrowthRate(tree) {
    const m = tree.getMoisture();
    const moistureFactor = m < 15 ? 0.15 : m < 30 ? 0.55 : m > 80 ? 0.4 : m > 65 ? 0.75 : 1;
    const fertFactor = tree.isFertilizerActive() ? 1.7 : 1;
    const healthFactor = 0.4 + tree.getHealth() * 6e-3;
    const sp = SPECIES_PARAMS[tree.getSpecies()];
    return round4(moistureFactor * fertFactor * healthFactor * sp.extensionMultiplier);
  }
  /**
   * Determine if branch `b` is the "leader" child among its parent's living children.
   * Leader = longest living sibling. Trunk (depth 0) is always leader.
   * Tiebreaker: lowest array index wins on equal length (deterministic by insertion order;
   * primary child i=0 is pushed first during fork — FINDING-3 from critic doc).
   */
  static isLeaderChild(b, branches) {
    if (b.depth === 0)
      return true;
    const parent = branches[b.parent];
    const siblings = parent.children.filter((id) => !branches[id].pruned);
    if (siblings.length <= 1)
      return true;
    let maxLen = -1;
    let leaderId = siblings[0];
    for (const id of siblings) {
      if (branches[id].length > maxLen) {
        maxLen = branches[id].length;
        leaderId = id;
      }
    }
    return leaderId === b.id;
  }
  /**
   * v2 internode schedule (design 3.2b; values from design 3.4 as calibrated in step I4):
   * the voxel extension a tip at `depth` must accumulate after birth before it may fork.
   * Replaces the pre-v2 linear threshold `b.length > 8 + depth * 5`. Every returned value
   * goes through round4 so the gate only ever compares deterministic numbers.
   */
  static internode(spE, depth) {
    return round4(spE.internodeBase + spE.internodeDepthStep * depth);
  }
  /**
   * v2 fork-gate eligibility (design 3.2b), shared by the traversal and the floor pre-scan so
   * both apply exactly the same test. Replaces the pre-v2 threshold
   * `b.length > 8 + depth * 5`, which every tip cleared within a few days and which deep tips
   * could never clear again once their extension had decayed.
   *   tip   (depth > 0): must have EXTENDED internode(spE, depth) voxels since birth
   *   trunk (depth 0)  : must have extended trunkInternode(spE) voxels since its last fork
   * The trunk's length at its last forking is the tree-level scalar
   * TreeState.lastMainForkLength (0 == never forked). round4 on both sides keeps the
   * comparison deterministic and free of float drift (DECISIONS.md:10).
   */
  static internodeCleared(b, tree) {
    const state = tree._getState();
    const spE = SPECIES_PARAMS[tree.getSpecies()];
    return b.depth === 0 ? round4(b.length - state.lastMainForkLength) >= round4(spE.trunkInternode) : round4(b.length - NEWBORN_BRANCH_LENGTH) >= _GrowthEngine.internode(spE, b.depth);
  }
  /**
   * One-third rule gate (KIJO-TECH-SPEC s4.6, R-ATTACHY): the bare lower third of the trunk
   * must stay branchless. The FIRST main is additionally gated on trunk length; later mains
   * attach at the then-current trunk tip, so the bare zone never moves downward.
   */
  static isFirstMainBlocked(b, branches) {
    if (b.depth !== 0)
      return false;
    if (b.length >= MIN_TRUNK_FOR_FIRST_BRANCH)
      return false;
    return !branches.some((br) => br.depth === 1 && !br.pruned);
  }
  /**
   * v2 floor state (design 3.2c, step I5). True while the living count is under floor(sp), the
   * tree is alive, and the floor day has arrived:
   *   rate > 0                   -- the floor is a guarantee about a LIVING tree (3.2c
   *                                 "conditioning"): a starved tree is not promised growth.
   *   livingCount0 < branchFloor -- below the low end of the R1 band.
   *   day >= floorDay            -- design 3.4: the floor is a catch-up rule, not a head start.
   * Always evaluated against the day-start snapshot, never a fresh mid-walk count.
   */
  static isFloorActive(tree, rate, livingCount0) {
    if (rate <= 0)
      return false;
    const spCtl = SPECIES_PARAMS[tree.getSpecies()];
    if (livingCount0 >= spCtl.branchFloor)
      return false;
    return tree.getAge() >= spCtl.floorDay;
  }
  /**
   * v2 floor selection (design 3.2c, step I5): the ONE branch id allowed to fork today while
   * the floor is active, or -1 when it is not.
   *
   * The candidate is the LOWEST branch id whose internode has cleared, evaluated in flat-array
   * id order -- in this engine branches[i].id === i, so array order IS id order. That is what
   * makes the floor deterministic (design :180) instead of a Bernoulli streak. The trunk
   * (id 0) is a candidate because v2 lets it re-fork (3.2a); it still has to clear
   * trunkInternode and the one-third first-main gate.
   */
  static selectFloorTipId(tree, rate, livingCount0) {
    if (!_GrowthEngine.isFloorActive(tree, rate, livingCount0))
      return -1;
    const branches = tree.getBranches();
    for (const b of branches) {
      if (b.pruned || b.jinned)
        continue;
      if (b.depth >= 6)
        continue;
      const hasLivingChild = b.children.some((id) => !branches[id].pruned);
      if (hasLivingChild && b.depth !== 0)
        continue;
      if (!_GrowthEngine.internodeCleared(b, tree))
        continue;
      if (_GrowthEngine.isFirstMainBlocked(b, branches))
        continue;
      return b.id;
    }
    return -1;
  }
  /**
   * apply_rotation_bias (design 3.2d, KIJO-TECH-SPEC.md:316-327) -- step I6.
   *
   *   sun_angle = rotation_state * (PI / 2)         -- rotation_state is the quarter index
   *   alignment = cos(worldAngle(b) - sun_angle)    -- +1 facing the sun, -1 facing away
   *   bias      = 1.0 + alignment * 0.15            -- 0.85 .. 1.15
   *
   * The engine stores rotation in DEGREES (0 | 90 | 180 | 270; rotate() adds one quarter turn,
   * BonsaiTree.ts:178) while b.angle is stored in degrees relative to the parent branch
   * (GrowthEngine.ts fork), so both are converted with * (PI / 180). That reproduces the spec's
   * quarter-turn sun angle exactly for every reachable rotation state, and stays correct if
   * rotation ever lands off a quarter.
   *
   * worldAngle(b) = worldAngle(parent) + b.angle: a walk up the parent chain over state that was
   * fixed at fork time. No new state, no wall clock, no unordered iteration (design 3.6).
   *
   * The caller must use this on the FORK PROBABILITY term only. This function never touches
   * length or extension, which is the R-6 guarantee that keeps the extension invariants and the
   * G-gates untouched.
   */
  static applyRotationBias(b, branches, rotationDegrees) {
    let worldAngleDeg = 0;
    let cursor = b;
    while (cursor !== null) {
      worldAngleDeg += cursor.angle;
      const parentId = cursor.parent;
      cursor = parentId === null ? null : branches[parentId];
    }
    const worldAngleRad = worldAngleDeg * (Math.PI / 180);
    const sunAngleRad = rotationDegrees * (Math.PI / 180);
    const alignment = Math.cos(worldAngleRad - sunAngleRad);
    return round4(1 + alignment * ROTATION_BIAS_STRENGTH);
  }
  /**
   * v2 fork probability (design 3.2c / 3.3, step I5).
   *
   *   ceiling: livingCount0 >= cap(sp) -> 0.0. Because that test uses the DAY-START snapshot,
   *            the branch that arrives at the ceiling may still roll its two-child secondary
   *            fork, so the provable living bound is cap + 1.
   *   floor:   the day's fork is deterministic: the preselected id forks and every other
   *            branch is suppressed, so exactly ONE new branch appears that day (design :180).
   *            (The pseudocode at design :226 gives forkP = 1.0 to every branch, which would
   *            fork on every eligible tip in one day; the prose is the stricter, intended
   *            reading and is what is implemented here.)
   *   in band: the unchanged probabilistic roll, forkChance * depth term * rate, with round4()
   *            as every growth number gets (design 3.6, DECISIONS.md:10).
   *
   * `depthFalloffCap` from design :227 is NOT used: the design never defines that term, so the
   * live pre-v2 depth term (1.0 - depth * 0.1) is kept rather than inventing a value for it.
   */
  static forkProbability(b, tree, rate, livingCount0, floorTipId) {
    const spCtl = SPECIES_PARAMS[tree.getSpecies()];
    if (livingCount0 >= spCtl.branchCap)
      return 0;
    if (_GrowthEngine.isFloorActive(tree, rate, livingCount0)) {
      return b.id === floorTipId ? 1 : 0;
    }
    const spE = SPECIES_PARAMS[tree.getSpecies()];
    const bias = _GrowthEngine.applyRotationBias(b, tree.getBranches(), tree.getRotationState());
    return round4(spE.forkChance * (1 - b.depth * 0.1) * rate * bias);
  }
  /**
   * Id-ordered pre-order walk: extend one branch, then decide whether it forks.
   * livingCount0 and floorTipId are the DAY-START controller inputs (design 3.2c, step I5):
   * the living-branch snapshot taken once in growTick and the floor's preselected tip id.
   * Neither is recomputed here, so the walk cannot depend on its own progress.
   */
  static extendAndFork(b, tree, rate, livingCount0, floorTipId) {
    if (b.pruned || b.jinned)
      return;
    const branches = tree.getBranches();
    const state = tree._getState();
    const living = b.children.filter((id) => !branches[id].pruned);
    const day = tree.getAge();
    const sp = SPECIES_PARAMS[tree.getSpecies()];
    const depthFalloff = round4(sp.depthFalloffBase ** b.depth);
    const rng = new SeededRNG(tree.getSeed() + b.id * 7919 + day * 37);
    const canFork = living.length === 0 || b.depth === 0;
    if (canFork) {
      const isLeader = _GrowthEngine.isLeaderChild(b, branches);
      const tipMultiplier = isLeader ? 1 : round4(1 - sp.apicalDominance * 0.5);
      const isTrunkContinuation = b.depth === 0 && living.length > 0;
      const ext = isTrunkContinuation ? round4((0.8 + rng.next() * 0.4) * rate * depthFalloff * sp.trunkContinuedRate) : round4((1.2 + rng.next() * 2.8) * rate * depthFalloff * tipMultiplier);
      b.length = round4(b.length + ext);
      const cleared = _GrowthEngine.internodeCleared(b, tree);
      const firstMainBlocked = _GrowthEngine.isFirstMainBlocked(b, branches);
      if (cleared && !firstMainBlocked && b.depth < 6) {
        const forkRng = new SeededRNG(tree.getSeed() + b.id * 7919 + day * 37 + 1);
        const forkP = _GrowthEngine.forkProbability(b, tree, rate, livingCount0, floorTipId);
        if (forkRng.next() < forkP) {
          if (b.depth === 0) {
            state.lastMainForkLength = round4(b.length);
          }
          const secRng = new SeededRNG(tree.getSeed() + b.id * 7919 + day * 37 + 2);
          const nChildren = secRng.next() < sp.secondaryForkChance ? 2 : 1;
          for (let i = 0; i < nChildren; i++) {
            const angleRng = new SeededRNG(tree.getSeed() + b.id * 7919 + day * 37 + 3 + i);
            const side = i === 0 ? 1 : -1;
            const spread = sp.forkSpreadMin + angleRng.next() * (sp.forkSpreadMax - sp.forkSpreadMin);
            const childId = tree._allocBranchId();
            let attachmentY;
            if (b.depth === 0 && i === 0) {
              attachmentY = round4(b.length * 0.33);
            } else {
              attachmentY = round4(b.length);
            }
            const childThickness = round4(Math.max(MIN_BRANCH_THICKNESS, b.thickness * sp.childThicknessFactor));
            const child = {
              id: childId,
              parent: b.id,
              depth: b.depth + 1,
              angle: round4(side * spread * (180 / Math.PI)),
              // SPECIES_PARAMS forkSpread is in radians; branch.angle is stored in degrees
              length: round4(NEWBORN_BRANCH_LENGTH),
              thickness: childThickness,
              pruned: false,
              children: [],
              attachmentY,
              growthBoost: 0,
              bornDay: tree.getAge(),
              // ── Physics fields (2026-08-01) ────────────────────────────────
              diameter: round4(2 * childThickness),
              currentStress: 0,
              stressInitial: 0,
              wired: false,
              wireAppliedDay: 0,
              wireAngle: 0,
              wireSet: false,
              wireScarred: false,
              twined: false,
              twineAppliedDay: 0,
              twineAngle: 0,
              twineForcePerDay: 0,
              weighted: false,
              weightCount: 0,
              weightAppliedDay: 0,
              // OQ-1 Option A (2026-08-14)
              weightAngleDelta: 0,
              // OQ-1 Option A (2026-08-14)
              twineDegradesDay: 0,
              bendSet: false,
              // CRITICAL-C fix 2026-08-02
              // Jin / Deadwood State (2026-09-18, JinEngine Phase 2)
              jinned: false,
              jinSegmentStart: -1
            };
            tree._pushBranch(child);
            b.children.push(childId);
          }
        }
      }
    } else {
      const isLeader = _GrowthEngine.isLeaderChild(b, branches);
      let innerRate;
      if (b.depth === 0) {
        innerRate = sp.trunkContinuedRate;
      } else if (isLeader) {
        innerRate = sp.parentExtensionRate;
      } else {
        innerRate = round4(sp.parentExtensionRate * (1 - sp.apicalDominance * 0.5));
      }
      const innerExt = round4((0.8 + rng.next() * 0.4) * rate * depthFalloff * innerRate);
      b.length = round4(b.length + innerExt);
    }
    for (const id of b.children) {
      _GrowthEngine.extendAndFork(branches[id], tree, rate, livingCount0, floorTipId);
    }
  }
  /**
   * Post-order thickening pass implementing Leonardo's Rule:
   *   parent.thickness^2 >= sum(child.thickness^2)
   * Returns the branch's resulting thickness (used by parent to accumulate child mass).
   */
  static thickeningPass(b, tree, rate) {
    if (b.pruned || b.jinned)
      return 0;
    const branches = tree.getBranches();
    let childMassSum = 0;
    for (const id of b.children) {
      const childT = _GrowthEngine.thickeningPass(branches[id], tree, rate);
      childMassSum += childT * childT;
    }
    const maturation = b.depth === 0 ? 0.05 * rate : 0.02 * rate;
    if (b.children.length > 0) {
      const leonardoMin = round4(Math.sqrt(childMassSum));
      b.thickness = round4(Math.max(b.thickness, leonardoMin) + maturation);
    } else {
      b.thickness = round4(b.thickness + maturation);
    }
    b.diameter = round4(2 * b.thickness);
    return b.thickness;
  }
  // ---------------------------------------------------------------------------
  // Taper clamp and assertion (design 3.2e, step I7)
  // ---------------------------------------------------------------------------
  /**
   * End-of-day taper normalisation (design 3.2e). Deterministic, O(n), round4-clean, and it
   * only ever LOWERS a thickness, so it cannot break Leonardo's rule (G3) and cannot add mass.
   * Pruned branches are exempt, as the design requires.
   */
  static enforceTaper(tree) {
    const branches = tree.getBranches();
    _GrowthEngine.clampChildrenToParents(branches);
    _GrowthEngine.clampMainsByAttachment(branches);
    _GrowthEngine.clampChildrenToParents(branches);
  }
  static clampChildrenToParents(branches) {
    for (const b of branches) {
      if (b.pruned)
        continue;
      const parentId = b.parent;
      if (parentId === null)
        continue;
      const parent = branches[parentId];
      if (parent.pruned)
        continue;
      const bound = round4(parent.thickness * TAPER_CLAMP_FACTOR);
      if (b.thickness > bound) {
        b.thickness = round4(Math.max(MIN_BRANCH_THICKNESS, bound));
        b.diameter = round4(2 * b.thickness);
      }
    }
  }
  static clampMainsByAttachment(branches) {
    const mains = branches.filter((b) => b.depth === 1 && !b.pruned && b.parent === 0);
    mains.sort((a, b) => a.attachmentY - b.attachmentY || a.id - b.id);
    let cap = Infinity;
    for (const m of mains) {
      if (m.thickness > cap) {
        m.thickness = round4(Math.max(MIN_BRANCH_THICKNESS, cap));
        m.diameter = round4(2 * m.thickness);
      }
      cap = m.thickness;
    }
  }
  /**
   * 3.2e assertion: trunk thickness strictly decreasing base to apex, and living depth-1
   * thickness non-increasing with attachmentY. Read-only; nothing here writes tree state.
   *
   * "Base to apex" is the SPINE: start at the trunk and, at each level, continue into the living
   * child with the greatest attachmentY (ties broken by highest id). That is the chain of tube
   * segments a renderer draws along the trunk axis, and it is the chain the clamp keeps strictly
   * decreasing. NOTE: TreeState stores ONE thickness scalar per branch (the voxelizer turns it
   * into a single tube radius), so this spine is the only machine-checkable reading of "trunk
   * taper" in this engine; see the I7 report note.
   */
  static taperReport(tree) {
    const branches = tree.getBranches();
    const violations = [];
    const spine = [];
    const trunk = tree.getRoot();
    let cursor = trunk.pruned ? null : trunk;
    while (cursor !== null) {
      spine.push({
        id: cursor.id,
        depth: cursor.depth,
        attachmentY: cursor.attachmentY,
        thickness: cursor.thickness
      });
      let next = null;
      for (const id of cursor.children) {
        const child = branches[id];
        if (child.pruned)
          continue;
        if (next === null || child.attachmentY > next.attachmentY || child.attachmentY === next.attachmentY && child.id > next.id) {
          next = child;
        }
      }
      cursor = next;
    }
    for (let i = 1; i < spine.length; i++) {
      if (!(spine[i].thickness < spine[i - 1].thickness)) {
        violations.push("spine thickness not strictly decreasing base to apex: branch " + spine[i].id + " (depth " + spine[i].depth + ") has thickness " + spine[i].thickness + ", which is not below branch " + spine[i - 1].id + " thickness " + spine[i - 1].thickness);
      }
    }
    const mains = branches.filter((b) => b.depth === 1 && !b.pruned && b.parent === 0).sort((a, b) => a.attachmentY - b.attachmentY || a.id - b.id).map((b) => ({
      id: b.id,
      depth: b.depth,
      attachmentY: b.attachmentY,
      thickness: b.thickness
    }));
    for (let i = 1; i < mains.length; i++) {
      if (mains[i].thickness > mains[i - 1].thickness) {
        violations.push("depth-1 thickness increases with attachmentY: branch " + mains[i].id + " (attachmentY " + mains[i].attachmentY + ") thickness " + mains[i].thickness + " > branch " + mains[i - 1].id + " (attachmentY " + mains[i - 1].attachmentY + ") thickness " + mains[i - 1].thickness);
      }
    }
    return { ok: violations.length === 0, violations, spine, mains };
  }
  /**
   * Combat-stat delta surface for step I7. This is the part of the StatSheet that does NOT need
   * the voxelizer: StatDeriver derives skillSlots as the non-pruned depth-2+ branch COUNT
   * (StatDeriver.ts:111-112, KIJO-ENGINE-API.md:79), so it moves the moment the branch scheme
   * moves. hp / power / endurance / ki are voxel ROLE sums and need Voxelizer + StatDeriver:
   * that full regression pass is `node packages/engine/test_statderiver.mjs` (D1-D7), which this
   * function deliberately does not duplicate.
   */
  static statSnapshot(tree) {
    const branches = tree.getBranches();
    const living = branches.filter((b) => !b.pruned && b.parent !== null);
    return {
      day: tree.getAge(),
      livingBranches: living.length,
      depth1Mains: living.filter((b) => b.depth === 1).length,
      depth2Plus: living.filter((b) => b.depth >= 2).length,
      trunkThickness: round4(tree.getRoot().thickness),
      totalMass: tree.getTotalMass()
    };
  }
};

// kijo-engine:C:\Users\jerem\.gemini\antigravity\playground\kijo\kijo-bonsai\packages\engine\dist\CareLogReplay.js
var MAX_REPLAY_DAYS = 36500;
var CareLogReplay = class {
  /**
   * Reconstruct a BonsaiTree from seed + species + care log.
   * Replays day-by-day: apply care actions logged for that day, then growTick.
   * Produces a tree bit-identical to the original if the log is complete.
   * This is the backbone of NFT verification: reconstruct from Merkle-verified log,
   * compare to claimed state.
   *
   * Throws CareLogReplayError on:
   *   - Invalid totalDays (non-finite, ≤ 0, > MAX_REPLAY_DAYS)
   *   - Invalid species
   *   - careLog is not an array
   *   - Care log entry with an unimplemented or unknown action type
   */
  static reconstruct(seed, species, careLog, totalDays) {
    if (!Number.isFinite(totalDays)) {
      throw new CareLogReplayError(`totalDays must be finite (got ${totalDays}). Infinite or NaN totalDays would cause an infinite loop.`);
    }
    if (!Number.isInteger(totalDays)) {
      throw new CareLogReplayError(`totalDays must be an integer (got ${totalDays}). Non-integer values cause silent care-action skipping when entry.day falls above the fractional floor.`);
    }
    if (totalDays <= 0) {
      throw new CareLogReplayError(`totalDays must be positive (got ${totalDays}).`);
    }
    if (totalDays > MAX_REPLAY_DAYS) {
      throw new CareLogReplayError(`totalDays exceeds maximum allowed replay length (${totalDays} > ${MAX_REPLAY_DAYS}).`);
    }
    if (!Object.prototype.hasOwnProperty.call(SPECIES_PARAMS, species)) {
      throw new CareLogReplayError(`Invalid species: ${String(species)}. Must be one of: ${Object.keys(SPECIES_PARAMS).join(", ")}.`);
    }
    if (!Array.isArray(careLog)) {
      throw new CareLogReplayError(`careLog must be an array (got ${typeof careLog}).`);
    }
    if (careLog.length > MAX_REPLAY_DAYS) {
      throw new CareLogReplayError(`careLog.length (${careLog.length}) exceeds MAX_REPLAY_DAYS (${MAX_REPLAY_DAYS}). Cannot replay.`);
    }
    const byDay = /* @__PURE__ */ new Map();
    for (const entry of careLog) {
      if (!byDay.has(entry.day))
        byDay.set(entry.day, []);
      byDay.get(entry.day).push(entry);
    }
    const tree = new BonsaiTree(seed, species);
    for (let day = 0; day < totalDays; day++) {
      const dayEntries = byDay.get(day) ?? [];
      for (const entry of dayEntries) {
        {
          const a = entry.action;
          if (a.type === "water") {
            try {
              tree.water(a.amount);
            } catch (e) {
              throw new CareLogReplayError(`Invalid 'water' action on day ${day}: ${e.message}`);
            }
          } else if (a.type === "fertilize") {
            tree.fertilize();
          } else if (a.type === "rotate") {
            tree.rotate();
          } else if (a.type === "prune") {
            PruneEngine.prune(tree, a.branchId);
          } else if (a.type === "wire") {
            WireEngine.wire(tree, a.branchId, a.angleDelta);
          } else if (a.type === "wire-remove") {
            WireEngine.removeWire(tree, a.branchId);
          } else if (a.type === "twine") {
            tree.applyTwine(a.branchId, a.angleDelta, a.degradeDays);
          } else if (a.type === "twine-remove") {
            tree.removeTwine(a.branchId);
          } else if (a.type === "weight") {
            tree.applyWeight(a.branchId, a.weightCount);
          } else if (a.type === "weight-remove") {
            tree.removeWeight(a.branchId);
          } else if (a.type === "jin") {
            tree.applyJin(a.branchId, a.segmentIndex, a.jinCost);
          } else if (a.type === "landscape") {
            tree.addLandscape(a.elementType, a.position);
          } else {
            const _exhaustive = a;
            throw new CareLogReplayError(`Unknown CareAction type: '${_exhaustive.type}'. This action cannot be replayed.`);
          }
        }
      }
      GrowthEngine.growTick(tree);
    }
    return tree;
  }
};

// kijo-engine:C:\Users\jerem\.gemini\antigravity\playground\kijo\kijo-bonsai\packages\engine\dist\StatTerrain.js
function chokkanSpline() {
  return {
    distanceTo(x, y, z) {
      const clampedY = Math.max(38, Math.min(220, y));
      const dx = x - 128;
      const dy = y - clampedY;
      const dz = z - 128;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
  };
}
var STYLE_SPLINES = [
  chokkanSpline()
  // 0 — Chokkan  (formal upright)
  // TODO: 1 — Moyogi     (informal upright)
  // TODO: 2 — Shakan     (slant)
  // TODO: 3 — Kengai     (cascade)
  // TODO: 4 — Fukinagashi (windswept)
  // TODO: 5 — Bunjin     (literati)
  // TODO: 6 — Hokidachi  (broom)
];
function splineForSeed(_seed) {
  return STYLE_SPLINES[0];
}
var IDEAL_REGION_DISTANCE = 10;
var StatTerrain = class _StatTerrain {
  // -------------------------------------------------------------------------
  // Zone-noise constants (Decision 2, corrective addendum MAJOR-1)
  // -------------------------------------------------------------------------
  static ZONE_WAVELENGTH = 32;
  static ZONE_SALT = 1798974493;
  // STAT_TYPES — eight-bucket ordered list; index must be stable (hash % 8)
  //
  // R2 decision (2026-07-16): NEUTRAL is naturally ~12.5 % (1/8 of buckets).
  // defense and stability added 2026-07-28 (ADR-STATSHEET-DEFENSE-STABILITY).
  // Flag for playtest tuning.
  static STAT_TYPES = [
    "hp",
    "power",
    "endurance",
    "ki",
    "skill_point",
    "defense",
    "stability",
    "neutral"
  ];
  // Base value emitted when a coordinate maps to a given stat type.
  static BASE_VALUES = {
    hp: 1e-3,
    power: 1e-3,
    endurance: 1e-3,
    ki: 1e-3,
    skill_point: 0.25,
    defense: 1e-3,
    // FLAG FOR PLAYTEST TUNING
    stability: 1e-3,
    // FLAG FOR PLAYTEST TUNING
    neutral: 0
  };
  // -------------------------------------------------------------------------
  // proximityCurve(distance) → multiplier
  //
  // R6 decision (2026-07-16): First-pass values, untuned.  Flag for playtest.
  //   dist === 0 → 3.0
  //   dist  < 5  → 2.0
  //   dist  < 15 → 1.5
  //   dist  < 30 → 1.0
  //   else       → 0.8
  // -------------------------------------------------------------------------
  static proximityCurve(distance) {
    if (distance === 0)
      return 3;
    if (distance < 5)
      return 2;
    if (distance < 15)
      return 1.5;
    if (distance < 30)
      return 1;
    return 0.8;
  }
  // -------------------------------------------------------------------------
  // distanceToIdealPath(seed, x, y, z) → float
  //
  // Euclidean distance from (x,y,z) to the nearest point on the seed's
  // favoured bonsai-style spline.  Pure and deterministic.
  // -------------------------------------------------------------------------
  static distanceToIdealPath(seed, x, y, z) {
    return splineForSeed(seed).distanceTo(x, y, z);
  }
  // -------------------------------------------------------------------------
  // getStatAt(seed, x, y, z) → TerrainStat
  //
  // Core lazy function.  No storage, no wall-clock time.
  //
  // Algorithm:
  //   1. spatialHash(seed, x, y, z) → uint32 h
  //   2. bucket = h % 8 → StatType
  //   3. base  = BASE_VALUES[type]
  //   4. value = base × proximityCurve(distanceToIdealPath(seed, x, y, z))
  //   5. round4(value)
  // -------------------------------------------------------------------------
  static getStatAt(seed, x, y, z) {
    const hash = spatialHash(seed, x, y, z);
    const bucket = hash % 8;
    const type = _StatTerrain.STAT_TYPES[bucket];
    const base = _StatTerrain.BASE_VALUES[type];
    const dist = _StatTerrain.distanceToIdealPath(seed, x, y, z);
    const multiplier = _StatTerrain.proximityCurve(dist);
    const value = round4(base * multiplier);
    return { type, value };
  }
  // -------------------------------------------------------------------------
  // getZoneIndex(seed, px, py, pz) → [0, 7]
  //
  // Low-frequency zone assignment from a float-space position.
  // Uses trilinear Value Noise with wavelength ZONE_WAVELENGTH to produce a
  // spatially coherent zone index in [0, N_ZONES-1].  Evaluated at continuous
  // float coordinates — NOT at integer voxel coords — so sub-voxel branch
  // jitter from angle changes does not cross zone boundaries.
  //
  // ZONE_SALT decorrelates this from the spatialHash used in getStatAt.
  // Must be: deterministic (same seed+pos → same index), pure, platform-identical.
  // -------------------------------------------------------------------------
  static getZoneIndex(seed, px, py, pz) {
    const W = _StatTerrain.ZONE_WAVELENGTH;
    const zoneSeed = (seed ^ _StatTerrain.ZONE_SALT) >>> 0;
    const cpx = Math.max(0, Math.min(255, px));
    const cpy = Math.max(0, Math.min(255, py));
    const cpz = Math.max(0, Math.min(255, pz));
    const sx = cpx / W, sy = cpy / W, sz = cpz / W;
    const ix = Math.floor(sx), iy = Math.floor(sy), iz = Math.floor(sz);
    const fx = sx - ix, fy = sy - iy, fz = sz - iz;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const uz = fz * fz * (3 - 2 * fz);
    const s = zoneSeed;
    const h000 = spatialHash(s, ix, iy, iz) / 4294967296;
    const h100 = spatialHash(s, ix + 1, iy, iz) / 4294967296;
    const h010 = spatialHash(s, ix, iy + 1, iz) / 4294967296;
    const h110 = spatialHash(s, ix + 1, iy + 1, iz) / 4294967296;
    const h001 = spatialHash(s, ix, iy, iz + 1) / 4294967296;
    const h101 = spatialHash(s, ix + 1, iy, iz + 1) / 4294967296;
    const h011 = spatialHash(s, ix, iy + 1, iz + 1) / 4294967296;
    const h111 = spatialHash(s, ix + 1, iy + 1, iz + 1) / 4294967296;
    const h00 = h000 + ux * (h100 - h000);
    const h01 = h001 + ux * (h101 - h001);
    const h10 = h010 + ux * (h110 - h010);
    const h11 = h011 + ux * (h111 - h011);
    const h0 = h00 + uy * (h10 - h00);
    const h1 = h01 + uy * (h11 - h01);
    const v = h0 + uz * (h1 - h0);
    return Math.floor(v * 8) % 8;
  }
  // -------------------------------------------------------------------------
  // calculateMatch(voxels, seed) → float  [0.0, 1.0]
  //
  // Overlap of filled voxels with the seed's ideal-path region ÷ region size.
  //
  // R7: ideal region = coords where distanceToIdealPath < IDEAL_REGION_DISTANCE (10).
  // R17: efficiency — we walk only the tight bounding box of the Chokkan spline's
  // neighbourhood instead of the full 256³ grid.  For the straight-vertical
  // Chokkan spline (x=128, z=128, y=[38,220]) the bounding box is:
  //   x ∈ [118, 138], z ∈ [118, 138], y ∈ [28, 230]
  // This is exact: no Chokkan-region coordinate lies outside this box.
  // -------------------------------------------------------------------------
  static calculateMatch(voxels, seed) {
    const spline = splineForSeed(seed);
    const D = IDEAL_REGION_DISTANCE;
    const xLo = Math.max(0, 128 - D), xHi = Math.min(255, 128 + D);
    const zLo = Math.max(0, 128 - D), zHi = Math.min(255, 128 + D);
    const yLo = Math.max(0, 38 - D), yHi = Math.min(255, 220 + D);
    let idealCount = 0;
    let overlapCount = 0;
    for (let cx = xLo; cx <= xHi; cx++) {
      for (let cy = yLo; cy <= yHi; cy++) {
        for (let cz = zLo; cz <= zHi; cz++) {
          if (spline.distanceTo(cx, cy, cz) < D) {
            idealCount++;
            if (voxels.has(cx, cy, cz))
              overlapCount++;
          }
        }
      }
    }
    if (idealCount === 0)
      return 0;
    return round4(overlapCount / idealCount);
  }
};

// kijo-engine:C:\Users\jerem\.gemini\antigravity\playground\kijo\kijo-bonsai\packages\engine\dist\StatDeriver.js
var HP_MULT = 0.35;
var POWER_MULT = 0.5;
var ENDURANCE_MULT = 0.5;
var KI_MULT = 3;
var SCAR_DEFENSE_MULT = 0.1;
var StatDeriver = class _StatDeriver {
  // -------------------------------------------------------------------------
  // deriveStructural(voxels, tree) → StructuralStats          Layer 1
  //
  // Counts voxels by ROLE (not material — GDD §4.2):
  //   VoxelRole.TRUNK  → HP          (main trunk tube voxels)
  //   VoxelRole.ARM    → Power       (upper depth-1 branch tubes)
  //   VoxelRole.LEG    → Endurance   (lower depth-1 branch tubes)
  //   VoxelRole.CANOPY → Ki          (leaf cluster voxels)
  //   DIGIT, ROOT → no structural stat
  //   SCAR  → Defense (small bonus per C++ spec: "scar voxels → small structural Defense/HP")
  //   NOTE: stability is terrain-only — ROOT voxels do not contribute structurally
  //
  // ARM/LEG assignment is done at voxelization time (packages/voxelizer/src/index.ts).
  // StatDeriver reads role directly — no mass-ratio approximation needed.
  //
  // skillSlots = count of non-pruned depth-2+ branches from the BonsaiTree
  // (branch COUNT, not voxel count — per GDD §4.2 / §4.3).
  // -------------------------------------------------------------------------
  static deriveStructural(voxels, tree) {
    let trunkVoxels = 0;
    let armVoxels = 0;
    let legVoxels = 0;
    let canopyVoxels = 0;
    let scarVoxels = 0;
    voxels.forEach((_x, _y, _z, _mat, role, _branchId) => {
      switch (role) {
        case VoxelRole.TRUNK:
          trunkVoxels++;
          break;
        case VoxelRole.ARM:
          armVoxels++;
          break;
        case VoxelRole.LEG:
          legVoxels++;
          break;
        case VoxelRole.CANOPY:
          canopyVoxels++;
          break;
        case VoxelRole.SCAR:
          scarVoxels++;
          break;
      }
    });
    const skillSlots = tree.getBranches().filter((b) => !b.pruned && b.depth >= 2).length;
    return {
      hp: round4(trunkVoxels * HP_MULT),
      power: round4(armVoxels * POWER_MULT),
      endurance: round4(legVoxels * ENDURANCE_MULT),
      ki: round4(canopyVoxels * KI_MULT),
      skillSlots,
      defense: round4(scarVoxels * SCAR_DEFENSE_MULT)
      // stability is NOT returned from deriveStructural — terrain-only stat (no Layer 1 source)
    };
  }
  // -------------------------------------------------------------------------
  // deriveTerrain(voxels, seed) → TerrainBonuses              Layer 2
  //
  // For every filled voxel, call StatTerrain.getStatAt and accumulate the
  // bonus into its stat category.  Terrain bonuses stack ADDITIVELY on top
  // of structural stats (GDD §4.2 — "the two layers stack").
  // round4() applied per accumulated total.
  // -------------------------------------------------------------------------
  static deriveTerrain(voxels, seed, zones) {
    let hp = 0, power = 0, endurance = 0, ki = 0, skillPoints = 0, defense = 0, stability = 0;
    voxels.forEach((x, y, z, _mat, _role, branchId) => {
      const statType = zones.has(branchId) ? StatTerrain.STAT_TYPES[zones.get(branchId)] : StatTerrain.getStatAt(seed, x, y, z).type;
      const dist = StatTerrain.distanceToIdealPath(seed, x, y, z);
      const mult = StatTerrain.proximityCurve(dist);
      const value = round4(StatTerrain.BASE_VALUES[statType] * mult);
      switch (statType) {
        case "hp":
          hp += value;
          break;
        case "power":
          power += value;
          break;
        case "endurance":
          endurance += value;
          break;
        case "ki":
          ki += value;
          break;
        case "skill_point":
          skillPoints += value;
          break;
        case "defense":
          defense += value;
          break;
        case "stability":
          stability += value;
          break;
      }
    });
    return {
      hp: round4(hp),
      power: round4(power),
      endurance: round4(endurance),
      ki: round4(ki),
      skillPoints: round4(skillPoints),
      defense: round4(defense),
      stability: round4(stability)
    };
  }
  // -------------------------------------------------------------------------
  // wisdomFromAge(ageDays) → tier 0-4                         age-driven
  //
  // GDD §4.3: Wisdom is NOT voxel-derived — time cannot be manufactured.
  //   < 100  → 0
  //   100-199 → 1
  //   200-364 → 2
  //   365-499 → 3
  //   >= 500  → 4
  // -------------------------------------------------------------------------
  static wisdomFromAge(ageDays) {
    if (ageDays < 100)
      return 0;
    if (ageDays < 200)
      return 1;
    if (ageDays < 365)
      return 2;
    if (ageDays < 500)
      return 3;
    return 4;
  }
  // -------------------------------------------------------------------------
  // derive(tree, voxels, seed, ageDays) → StatSheet           public entry
  //
  // Full dual-layer stat derivation (GDD §4.2):
  //   StatSheet = structural + terrain + wisdom + matchPct
  // All values round4()'d.  matchPct is raw [0,1] from StatTerrain.
  // -------------------------------------------------------------------------
  static derive(tree, voxels, seed, ageDays, zones) {
    const structural = _StatDeriver.deriveStructural(voxels, tree);
    const terrain = _StatDeriver.deriveTerrain(voxels, seed, zones);
    const wisdom = _StatDeriver.wisdomFromAge(ageDays);
    const matchPct = StatTerrain.calculateMatch(voxels, seed);
    const sheet = {
      hp: round4(structural.hp + terrain.hp),
      power: round4(structural.power + terrain.power),
      endurance: round4(structural.endurance + terrain.endurance),
      ki: round4(structural.ki + terrain.ki),
      skillSlots: structural.skillSlots,
      skillPoints: round4(terrain.skillPoints),
      wisdom,
      matchPct,
      defense: round4(structural.defense + terrain.defense),
      stability: round4(terrain.stability)
      // terrain-only — no structural source (same pattern as skillPoints)
    };
    for (const [key, value] of Object.entries(sheet)) {
      if (!Number.isFinite(value)) {
        throw new Error(`StatDeriver.derive(): stat field '${key}' is not finite (${value}). The stat pipeline has been corrupted \u2014 inspect the care log for invalid inputs.`);
      }
    }
    return sheet;
  }
};

// kijo-engine:C:\Users\jerem\.gemini\antigravity\playground\kijo\kijo-bonsai\packages\voxelizer\dist\CombatSnapshot.js
var tuple = (v) => [v.x, v.y, v.z];
function buildCombatSnapshot(tree, result) {
  const seed = tree.getSeed();
  const species = tree.getSpecies();
  const ageDays = tree.getAge();
  return {
    seed,
    species,
    ageDays,
    stats: StatDeriver.derive(tree, result.voxels, seed, ageDays, result.zones),
    morphology: {
      schemaVersion: 1,
      gridSize: 256,
      coordinateEncoding: "x16-y8-z0",
      source: { seed, species, ageDays },
      visualTraits: deriveVisualTraits(seed, species),
      availability: { seasonalLeaves: false, locatedScars: false, morale: false },
      // Preserve canonical order, including equal-attachment-height tie order.
      branches: tree.getBranches().map((b) => {
        const placement = result.placements.get(b.id);
        return {
          id: b.id,
          parent: b.parent,
          depth: b.depth,
          angle: b.angle,
          length: b.length,
          thickness: b.thickness,
          attachmentY: b.attachmentY,
          children: [...b.children],
          pruned: b.pruned,
          role: result.branchRoles.get(b.id) ?? null,
          placement: placement ? {
            start: tuple(placement.start),
            end: tuple(placement.end),
            direction: tuple(placement.dir)
          } : null
        };
      }),
      voxels: result.voxels.serialize()
    }
  };
}

// kijo-engine:C:\Users\jerem\.gemini\antigravity\playground\kijo\kijo-bonsai\packages\voxelizer\dist\index.js
var Material = {
  HEARTWOOD: 1,
  BARK: 2,
  BRANCH_WOOD: 3,
  LEAF: 4,
  ROOT: 5,
  PRUNE_SCAR: 6
};
var SparseVoxelSet = class {
  cells = /* @__PURE__ */ new Map();
  key(x, y, z) {
    return (x & 255) << 16 | (y & 255) << 8 | z & 255;
  }
  set(x, y, z, mat, role, branchId) {
    x = Math.max(0, Math.min(255, Math.round(x)));
    y = Math.max(0, Math.min(255, Math.round(y)));
    z = Math.max(0, Math.min(255, Math.round(z)));
    this.cells.set(this.key(x, y, z), { material: mat, role, branchId });
  }
  get(x, y, z) {
    return this.cells.get(this.key(x, y, z));
  }
  has(x, y, z) {
    return this.cells.has(this.key(x, y, z));
  }
  count() {
    return this.cells.size;
  }
  forEach(cb) {
    for (const [k, cell] of this.cells) {
      cb(k >>> 16 & 255, k >>> 8 & 255, k & 255, cell.material, cell.role, cell.branchId);
    }
  }
  // Sorted by key for deterministic comparison. Format: [key, material, role, branchId].
  serialize() {
    const out = [];
    for (const [k, c] of this.cells) {
      out.push([k, c.material, c.role, c.branchId]);
    }
    out.sort((a, b) => a[0] - b[0]);
    return out;
  }
};
function rotateDirection(parent, polar, azimuthal) {
  const len = Math.sqrt(parent.x ** 2 + parent.y ** 2 + parent.z ** 2);
  const p = { x: parent.x / len, y: parent.y / len, z: parent.z / len };
  const perp = Math.abs(p.y) < 0.9 ? { x: -p.z, y: 0, z: p.x } : { x: 1, y: 0, z: 0 };
  const pLen = Math.sqrt(perp.x ** 2 + perp.y ** 2 + perp.z ** 2);
  const u = { x: perp.x / pLen, y: perp.y / pLen, z: perp.z / pLen };
  const v = { x: p.y * u.z - p.z * u.y, y: p.z * u.x - p.x * u.z, z: p.x * u.y - p.y * u.x };
  const cosA = Math.cos(azimuthal), sinA = Math.sin(azimuthal);
  const rotU = { x: cosA * u.x + sinA * v.x, y: cosA * u.y + sinA * v.y, z: cosA * u.z + sinA * v.z };
  const cosP = Math.cos(polar), sinP = Math.sin(polar);
  return { x: cosP * p.x + sinP * rotU.x, y: cosP * p.y + sinP * rotU.y, z: cosP * p.z + sinP * rotU.z };
}
var Voxelizer = class _Voxelizer {
  static BASE = { x: 128, y: 38, z: 128 };
  static voxelize(tree) {
    const voxels = new SparseVoxelSet();
    const branches = tree.getBranches();
    const BASE = _Voxelizer.BASE;
    for (let y = 34; y < 38; y++) {
      const r = (38 - y) * 1.5;
      const ri = Math.ceil(r);
      for (let dx = -ri; dx <= ri; dx++) {
        for (let dz = -ri; dz <= ri; dz++) {
          if (dx * dx + dz * dz <= r * r) {
            voxels.set(BASE.x + dx, y, BASE.z + dz, Material.ROOT, VoxelRole.ROOT, 0);
          }
        }
      }
    }
    const positions = /* @__PURE__ */ new Map();
    _Voxelizer.computePositions(0, BASE, { x: 0, y: 1, z: 0 }, branches, positions);
    const seed = tree.getSeed();
    const zones = /* @__PURE__ */ new Map();
    for (const [branchId, pos] of positions) {
      zones.set(branchId, StatTerrain.getZoneIndex(seed, pos.start.x, pos.start.y, pos.start.z));
    }
    const depth1Live = branches.filter((b) => b.depth === 1 && !b.pruned);
    const sorted1 = [...depth1Live].sort((a, b) => a.attachmentY - b.attachmentY);
    const n1 = sorted1.length;
    const armIds = /* @__PURE__ */ new Set();
    if (n1 === 1) {
      armIds.add(sorted1[0].id);
    } else if (n1 > 1) {
      const nArms = Math.floor(n1 / 2);
      for (let i = n1 - nArms; i < n1; i++) {
        armIds.add(sorted1[i].id);
      }
    }
    const branchRole = /* @__PURE__ */ new Map();
    for (const b of branches) {
      if (b.pruned)
        continue;
      if (b.depth === 0) {
        branchRole.set(b.id, VoxelRole.TRUNK);
      } else if (b.depth === 1) {
        branchRole.set(b.id, armIds.has(b.id) ? VoxelRole.ARM : VoxelRole.LEG);
      } else {
        branchRole.set(b.id, VoxelRole.DIGIT);
      }
    }
    for (const b of branches) {
      if (b.pruned)
        continue;
      const pos = positions.get(b.id);
      if (!pos)
        continue;
      const mat = b.depth === 0 ? Material.HEARTWOOD : b.depth === 1 ? Material.BARK : Material.BRANCH_WOOD;
      const role = branchRole.get(b.id) ?? VoxelRole.TRUNK;
      const jinThreshold = b.jinned && b.jinSegmentStart >= 0 ? b.jinSegmentStart / Math.max(b.length, 1) : 1;
      _Voxelizer.fillTube(pos.start, pos.end, b.thickness, mat, role, b.id, voxels, jinThreshold);
      const hasLivingChildren = b.children.some((id) => branches[id] && !branches[id].pruned);
      if (!hasLivingChildren && !b.jinned) {
        _Voxelizer.fillSphere(pos.end, 2, Material.LEAF, VoxelRole.CANOPY, b.id, voxels);
      }
    }
    return { voxels, zones, placements: positions, branchRoles: branchRole };
  }
  /**
   * Recursively compute 3D start/end/dir for each branch.
   *
   * parentStart: the world-space START of the parent branch.
   * parentDir:   the unit direction vector of the parent branch.
   *
   * Each branch's actual start = parentStart + parentDir * branch.attachmentY.
   * For depth-2+ branches attachmentY equals the parent's full length, so
   *   actualStart = parentEnd (same as old behaviour).
   * For depth-1 primary branches attachmentY = trunk.length * 0.33, so the tube
   *   begins one-third up the trunk rather than at the trunk tip (R-ATTACHY).
   */
  static computePositions(id, parentStart, parentDir, branches, out) {
    const b = branches[id];
    if (!b || b.pruned)
      return;
    const attachY = b.attachmentY ?? 0;
    const start = attachY > 0 ? {
      x: parentStart.x + parentDir.x * attachY,
      y: parentStart.y + parentDir.y * attachY,
      z: parentStart.z + parentDir.z * attachY
    } : parentStart;
    const polar = Math.max(0.1, Math.min(150 * Math.PI / 180, Math.abs(b.angle) * Math.PI / 180));
    const azimuthal = b.id * 137.508 * Math.PI / 180 % (2 * Math.PI);
    const dir = rotateDirection(parentDir, polar, azimuthal);
    const end = {
      x: start.x + dir.x * b.length,
      y: start.y + dir.y * b.length,
      z: start.z + dir.z * b.length
    };
    out.set(id, { start, end, dir });
    for (const childId of b.children) {
      _Voxelizer.computePositions(childId, start, dir, branches, out);
    }
  }
  static fillTube(start, end, thickness, mat, role, branchId, voxels, jinThreshold = 1) {
    const dx = end.x - start.x, dy = end.y - start.y, dz = end.z - start.z;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 1e-3)
      return;
    const steps = Math.ceil(len / 0.5);
    const radius = Math.max(0.5, thickness * 0.5);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const effectiveRole = t >= jinThreshold ? VoxelRole.SCAR : role;
      _Voxelizer.fillSphere({ x: start.x + dx * t, y: start.y + dy * t, z: start.z + dz * t }, radius, mat, effectiveRole, branchId, voxels);
    }
  }
  static fillSphere(center, radius, mat, role, branchId, voxels) {
    const r = Math.ceil(radius);
    const cx = Math.round(center.x), cy = Math.round(center.y), cz = Math.round(center.z);
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dz = -r; dz <= r; dz++) {
          if (dx * dx + dy * dy + dz * dz <= radius * radius) {
            voxels.set(cx + dx, cy + dy, cz + dz, mat, role, branchId);
          }
        }
      }
    }
  }
};
export {
  BonsaiTree,
  CareLogReplay,
  CareLogReplayError,
  GrowthEngine,
  StatDeriver,
  Voxelizer,
  applyMoraleEvent,
  buildCombatSnapshot,
  createNewTreeMorale,
  getMoraleAdmission,
  getMoraleCareView,
  readMoraleState
};
