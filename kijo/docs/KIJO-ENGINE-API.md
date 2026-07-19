# KIJO — Engine API Reference

**Version:** 0.1 (Draft)
**Date:** July 15, 2026
**Status:** Pre-Implementation
**Parent Documents:** KIJO-TECH-SPEC.md, KIJO-ARCHITECTURE.md

> Public API for the `engine` package derived from the technical spec. Signatures are the intended contract; reconcile against actual code. The engine is pure and deterministic — no I/O, no rendering, no network, no wall-clock time.

---

## Core Types (from `shared`)

```cpp
enum class SpeciesClass : uint8_t { HARDWOOD, EVERGREEN, TROPICAL };

struct Coordinate { uint8_t x, y, z; };   // 0-255 each, 256³ grid

enum class StatType : uint8_t { HP, POWER, ENDURANCE, KI, SKILL_POINT, NEUTRAL };

struct CareAction {
    enum Type : uint8_t { WATER, PRUNE, FERTILIZE, ROTATE, GROW_TICK };
    Type type;
    uint32_t day;
    float value;          // water amount, or branch_id for prune
};

struct Branch {
    uint32_t id;
    float angle;          // radians, relative to parent
    float length;         // voxel units
    float thickness;      // radius, voxel units
    float curve;          // bezier control offset
    uint8_t depth;        // 0 = trunk
    uint32_t bornDay;
    bool pruned;
    float growthBoost;    // post-prune energy, decays
    std::vector<Branch> children;
};

struct StatSheet {
    float hp;
    float power;
    float endurance;
    float ki;
    uint32_t skillSlots;    // from depth-2+ branch COUNT
    float skillPoints;      // from terrain SKILL_POINT coordinates
    uint32_t wisdom;        // from age in days
    float matchPct;         // 0.0 - 1.0
};
```

---

## `BonsaiTree`

Holds the parametric tree, care state, care log, and dirty flag. The only class that mutates tree state.

### Construction

```cpp
BonsaiTree(uint32_t seed, SpeciesClass species);
```
Creates a Day-0 sapling. Initializes root branch (trunk), moisture 55, health 85, age 0. `nextBranchId` starts at 1 (root is id 0... or 1 — pin this in impl and document).

### State Mutation

```cpp
void applyDailyUpdate();
```
Advances one day of care state (NOT growth — growth is `GrowthEngine`). Decays moisture 5.0–9.0 (seeded by `seed + day`). Adjusts health: +0.8 if moisture ∈ [30,65]; −1.5 if moisture <15 or >80; −0.3 otherwise. Clamps health to [10,100]. Increments age. Appends implicit day advance.

```cpp
void water(float amount);
```
Increases moisture (clamped ≤100). Logs `WATER`. Marks dirty is NOT required (watering changes stats indirectly via future growth, not geometry) — but logs the action for reconstruction.

```cpp
bool prune(uint32_t branchId);
```
Marks the target branch and its subtree pruned (permanent). Returns `false` if the branch doesn't exist, is the trunk (depth 0), or is already pruned. On success: places scar, triggers growth-energy redistribution to surviving tips, logs `PRUNE`, marks dirty. See `PruneEngine`.

```cpp
void fertilize();
```
Sets fertilizer-active window (current day + 5). 8-day cooldown enforced (no-op if within cooldown). Logs `FERTILIZE`.

```cpp
void rotate();
```
Advances rotation state (0→1→2→3→0). Biases future growth toward the "sun" side. Logs `ROTATE`.

### Read-Only Access

```cpp
const Branch& getRoot() const;
Branch&       getRootMutable();        // GrowthEngine / PruneEngine only
float         getMoisture() const;     // 0-100
float         getHealth() const;       // 0-100
uint32_t      getAge() const;          // days
uint32_t      getSeed() const;
SpeciesClass  getSpecies() const;
uint8_t       getRotationState() const;
bool          isFertilizerActive() const;
const std::vector<CareAction>& getCareLog() const;
```

### Dirty-Flag Handshake

```cpp
bool isDirty() const;
void markDirty();
void clearDirty();      // Renderer ONLY — see architecture §4
```
The tree marks itself dirty on geometry change. Only the orchestrating Renderer clears it. Never clear from within a component that observes the tree.

### Verification Helpers

```cpp
uint32_t countLivingBranches() const;  // non-pruned count
uint32_t getPrunedCount() const;
uint32_t getNextBranchId() const;
float    getTotalMass() const;         // Σ (thickness² × length) over living branches
```
Used by test asserts (tech spec Gate 2): ID integrity is `nextBranchId == livingBranches + prunedCount + 1`.

---

## `GrowthEngine`

Stateless. No member variables. Pure functions operating on tree data.

```cpp
static void growTick(BonsaiTree& tree);
```
Advances one full day of growth. Sequence (order is load-bearing):
1. `tree.applyDailyUpdate()` — care state
2. compute growth rate from moisture/health/fertilizer
3. extension + fork pass (pre-order): tips extend, may fork per species rules
4. thickening pass (post-order): Leonardo's Rule
5. `tree.markDirty()`
6. append `GROW_TICK` to log

```cpp
private:
static float calculateGrowthRate(const BonsaiTree& tree);
```
Moisture factor (<15:×0.15, <30:×0.55, >80:×0.40, >65:×0.75, else ×1.0) × fertilizer (×1.7 if active) × health factor (×(0.4 + health×0.006)) × species extension multiplier.

```cpp
private:
static void extendAndFork(Branch& b, uint32_t seed, uint32_t day,
                          float rate, SpeciesClass sp, uint32_t& nextId);
```
Tip branches extend by `(1.2 + rng()×2.8) × rate × depthFalloff(depth)`. Fork if `length > 16 + depth×7` AND `depth < 6` AND `rng() < (0.38 − depth×0.05) × rate`. Spawns 1 primary child always, 1 secondary by species chance (HW 0.45 / EG 0.35 / TR 0.25). RNG seeded `seed + b.id*7919 + day*37`.

```cpp
private:
static float thickeningPass(Branch& b, float maturationRate);
```
Post-order. Returns subtree mass. Sets `b.thickness = max(b.thickness, sqrt(Σ child_thickness²)) + maturation`, where maturation is `0.05×rate` for trunk (depth 0) and `0.02×rate` otherwise. Trunk thickens even with zero children (root mass). Round to 4 decimals after assignment.

```cpp
private:
static float depthFalloff(uint8_t depth);
```
`max(0.1, 1.0 − depth×0.15)`. (Open question R9: linear vs exponential — see tech spec.)

---

## `StatDeriver`

Turns a voxelized tree into a `StatSheet`. Combines structural stats (morphology) and terrain bonuses (seed coordinate map).

```cpp
static StatSheet derive(const BonsaiTree& tree,
                        const SparseVoxelSet& voxels,
                        uint32_t seed,
                        uint32_t ageDays);
```

```cpp
private:
static StructuralStats deriveStructural(const SparseVoxelSet& voxels,
                                        const BonsaiTree& tree);
```
Trunk voxels → HP. Upper depth-1 (arm) voxels → Power. Lower depth-1 (leg) voxels → Endurance. Leaf voxels → Ki. Depth-2+ branch COUNT → skill slots. (Multiplier values open: tech spec R14.)

```cpp
private:
static TerrainBonuses deriveTerrain(const SparseVoxelSet& voxels, uint32_t seed);
```
For each filled voxel, evaluate `StatTerrain::getStatAt(seed, x, y, z)` and accumulate the bonus into its stat category. Terrain bonuses stack ON TOP of structural stats.

```cpp
static uint32_t wisdomFromAge(uint32_t ageDays);
```
Age-driven Fight IQ. Thresholds: 100/200/365/500 days unlock progressive opponent-read abilities (see GDD §4.3). Wisdom is NOT voxel-derived — time cannot be manufactured.

---

## `StatTerrain`

The seed's hidden stat map. A lazy function, never a stored array.

```cpp
static TerrainStat getStatAt(uint32_t seed, uint8_t x, uint8_t y, uint8_t z);
```
Returns `{ StatType, float value }`. Computes: spatial hash of `(seed, packed_coord)` → stat type; base value (0.001 for %-stats, 0.25 for skill points, 0 for NEUTRAL) × proximity multiplier from ideal path. Deterministic and identical across platforms — this is a critical determinism surface.

```cpp
static float distanceToIdealPath(uint32_t seed, uint8_t x, uint8_t y, uint8_t z);
```
Distance from coordinate to nearest point on the seed's favored bonsai-style spline (GDD §4.2.1). Drives the proximity multiplier.

```cpp
static float proximityCurve(float distance);
```
`dist 0 → 3.0`, `<5 → 2.0`, `<15 → 1.5`, `<30 → 1.0`, else `0.8`. (Open question R6: tuning.)

```cpp
static float calculateMatch(const SparseVoxelSet& voxels, uint32_t seed);
```
Overlap between filled voxels and the seed's ideal-path region, ÷ ideal region size. Returns 0.0–1.0. The public "match %" (GDD §4.2.2). (Open questions R7, R17: region size and compute efficiency.)

---

## `PruneEngine`

```cpp
static PruneResult prune(BonsaiTree& tree, uint32_t branchId, uint32_t day);
```
Validates target (exists, not trunk, not already pruned). Marks subtree pruned, clears its voxels from stat accounting, places scar (scar voxels → small structural Defense/HP), redistributes growth energy to surviving tips (temporary `growthBoost`, decays ~15%/day), recomputes stats + match. Returns `{ removedVoxelCount, newStats, newMatch }` or an error. (Open question R15: redistribution balance.)

```cpp
private:
static void redistributeGrowthEnergy(BonsaiTree& tree, float totalEnergy);
```
Splits a post-prune growth bonus across surviving tips. Each affected tip's `growthBoost` decays multiplicatively each subsequent `growTick`.

---

## `CareLogReplay`

Reconstructs a tree from authoritative state.

```cpp
static BonsaiTree reconstruct(uint32_t seed,
                              SpeciesClass species,
                              const std::vector<CareAction>& careLog);
```
Replays the care log from Day 0, applying each action in order (water, prune, fertilize, rotate) and running `growTick` per day. Produces a tree bit-identical to the original. This is the backbone of NFT verification: reconstruct from the Merkle-verified log, compare to claimed state.

**Performance:** ~440 ticks for a Day-440 tree at ~1ms each → under 0.5s. Acceptable for on-demand reconstruction. (Open question R19: care-log format — explicit vs derived vs checkpointed.)

---

## Determinism Requirements (apply to ALL functions above)

- All randomness from `SeededRNG` (in `shared`), seeded `seed + branch.id*7919 + day*37`. Never `rand()` or time-based seeding.
- No wall-clock time anywhere in the engine.
- Round to 4 decimals after every growth math operation (or adopt fixed-point Q16.16 — tech spec R18, still open and CRITICAL).
- The spatial hash and reconstruction algorithm must match `contracts` (Solidity) bit-for-bit, or Merkle verification fails.

**Invariant:** `reconstruct(seed, species, careLog)` run on any platform, any number of times, yields an identical `StatSheet`. This is the foundation of NFT trust and combat fairness. Guard it with cross-run and (eventually) cross-platform equality tests.

---

## Open Research Questions Affecting This API

| # | Affects | Question |
|---|---|---|
| R6 | `StatTerrain::proximityCurve` | Curve steepness tuning |
| R7 | `StatTerrain::calculateMatch` | Ideal region size (match denominator) |
| R9 | `GrowthEngine::depthFalloff` | Linear vs exponential |
| R14 | `StatDeriver::deriveStructural` | Structural stat multiplier values |
| R15 | `PruneEngine` | Growth-energy redistribution balance |
| R17 | `StatTerrain::calculateMatch` | Compute efficiency |
| R18 | ALL | Fixed-point vs float determinism (CRITICAL) |
| R19 | `CareLogReplay` | Care-log format and reconstruction strategy |

See KIJO-TECH-SPEC.md §10 for the full research register.

---

*Update signatures here whenever the engine's public surface changes in code.*
