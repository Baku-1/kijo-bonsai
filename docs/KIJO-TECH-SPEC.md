# KIJO — Spatial Growth Algorithm Technical Spec

**Version:** 0.2
**Date:** July 14, 2026 (updated July 23, 2026)
**Status:** In Production — Phase 1 active
**Parent Document:** KIJO-GDD.md

---

## 1. Overview

This document specifies the algorithm that drives kijonsai growth, voxelization, stat derivation, and pruning. The parametric L-system tree is the source of truth. The 256³ voxel grid is a derived representation used for stat terrain evaluation, NFT art, and morphology mapping.

**Data flow:**

```
seed (uint32)
  → stat terrain function (lazy, never stored as array)
  → ideal growth path (bonsai style template)

care_log (append-only actions)
  → parametric tree (recursive branch structure)
  → voxelizer (parametric → 256³ sparse voxels)
  → stat sheet (structural stats + terrain bonuses)
  → match % (filled voxels vs ideal path)
  → morphology (voxels → kijo body)
```

---

## 2. Stat Terrain Generation

### 2.1 Core Principle

The stat terrain is a **function**, not a data structure. Given any (x, y, z) coordinate and a seed, you compute the stat assignment deterministically. No storage of 16.7 million entries.

### 2.2 Algorithm

```
function get_terrain_stat(seed, x, y, z):
    // Deterministic hash for this coordinate
    h = spatial_hash(seed, x, y, z)
    
    // Base stat type from hash
    stat_index = h mod 6
    stat_type = [HP, Power, Endurance, Ki, SkillPoint, Neutral][stat_index]
    
    // Base value
    base = 0.001  // 0.1% for stats, or 0.25 for skill points
    if stat_type == SkillPoint: base = 0.25
    if stat_type == Neutral: base = 0  // dead coordinate, no bonus
    
    // Proximity bonus: coordinates near the ideal path get multiplied
    proximity = distance_to_ideal_path(seed, x, y, z)
    multiplier = proximity_curve(proximity)
    
    return { stat_type, value: base * multiplier }
```

### 2.3 Spatial Hash Function

```
function spatial_hash(seed, x, y, z):
    // Must be: deterministic, uniform distribution, no visible patterns
    // Candidate: modified xxHash or MurmurHash3 with coordinate packing
    packed = (x << 16) | (y << 8) | z  // 24-bit coordinate
    return hash32(seed ^ packed)
```

> **TODO — RESEARCH:** Evaluate hash functions for spatial uniformity. Requirements:
> - No visible spatial patterns (players shouldn't see "stripes" of HP in the terrain)
> - Fast evaluation (called per voxel during growth ticks, potentially 1000+ per tick)
> - Deterministic across platforms (JS, Rust, Solidity — same seed must produce same result everywhere)
> - Candidates: xxHash32, MurmurHash3_x86_32, FNV-1a, custom LCG
> - Test: render a 2D slice of the terrain colored by stat type. Should look like smooth noise, not grid artifacts.

### 2.4 Neutral Coordinates

Not every coordinate should yield a stat bonus. The "Neutral" type (no bonus) prevents the stat terrain from being uniformly rewarding. Growing into dead space is a real possibility — exploration has risk.

> **TODO — RESEARCH:** What percentage of coordinates should be Neutral?
> - Too few (10%) → every growth direction is rewarded, no meaningful exploration
> - Too many (60%) → growth feels unrewarding, small trees are too weak
> - Hypothesis: ~25-35% Neutral feels right — roughly 1 in 4 voxels gives nothing
> - Needs playtesting with actual growth patterns to validate

### 2.5 Stat Distribution Balance

The remaining non-Neutral coordinates are distributed across HP, Power, Endurance, Ki, and SkillPoints.

> **TODO — RESEARCH:** Should all stats be equally likely, or weighted?
> - Equal (20% each of non-Neutral) → pure seed RNG determines build
> - Weighted (e.g., HP 25%, Power 20%, Endurance 20%, Ki 20%, Skill 15%) → slight bias toward survivability
> - Should weighting vary by bonsai style template? (Kengai coordinates biased toward Power?)
> - Needs simulation: generate 1000 trees across 100 seeds, check stat variance

---

## 3. Ideal Growth Path (Style Templates)

### 3.1 Core Principle

Each seed has a favored bonsai style. The style defines a parametric 3D curve (the "ideal path") through the 256³ grid. Coordinates near this path have higher terrain multipliers. Growing the tree to follow the ideal path produces the highest stat concentration.

### 3.2 Style Definitions

Each style is a set of parametric curves defining trunk path, primary branch regions, and canopy target zones.

**Chokkan (Formal Upright):**
```
trunk: straight vertical line, center of grid
    start: (128, 0, 128), end: (128, 200, 128)
    taper: linear from radius 12 at base to radius 3 at top
branches: radial from trunk at 5-7 height intervals
    angle: 50-70° from vertical, alternating sides
    length: decreasing with height
canopy: dome centered on trunk top
    radius: ~40 voxels
```

**Kengai (Cascade):**
```
trunk: curves from base, sweeps downward past origin
    start: (128, 0, 128)
    control: (100, 80, 128)
    end: (60, -20, 128)  // below pot line
branches: follow cascade curve on outer edge
canopy: concentrated at cascade tip
```

**Moyogi (Informal Upright):**
```
trunk: S-curve vertical
    3-4 control points creating gentle bends
branches: emerge from outer curves (where real trees push growth)
canopy: asymmetric, heavier on final curve direction
```

**Bunjin (Literati):**
```
trunk: tall thin vertical with slight lean
    minimal branching below 70% height
branches: sparse, only near crown
canopy: small concentrated cluster at top
```

> **TODO — RESEARCH:** Define parametric curves for all 8 styles:
> - Chokkan, Moyogi, Shakan, Kengai, Han-kengai, Fukinagashi, Bunjin, Hokidachi
> - Each needs: trunk spline (control points), branch region volumes, canopy target zone
> - Reference real bonsai photography for proportions
> - Should styles be pure templates or blended? (e.g., seed could be 70% Moyogi + 30% Shakan)
> - How is the seed's style determined? Hash of seed → style index? Or seed → blend weights?

### 3.3 Proximity Curve

The proximity multiplier determines how much extra value coordinates near the ideal path receive.

```
function proximity_curve(distance):
    // distance in voxel units from nearest point on ideal path
    if distance == 0: return 3.0   // on the path: 3x bonus
    if distance < 5:  return 2.0   // very close: 2x
    if distance < 15: return 1.5   // near: 1.5x
    if distance < 30: return 1.0   // moderate: no bonus
    return 0.8                      // far from path: slight penalty
```

> **TODO — RESEARCH:** Tune the proximity curve.
> - How steep should the falloff be? Sharp (only exact path matters) vs gradual (wide reward zone)?
> - Sharp falloff → only masters benefit, casuals see no difference → might be frustrating
> - Gradual falloff → easy to accidentally grow near the path → reduces skill expression
> - Needs simulation: plot stat distributions for trees grown at various match percentages
> - Does the curve shape affect the 70%/90%/95% rarity tiers meaningfully?

### 3.4 Match Percentage Calculation

```
function calculate_match(filled_voxels, seed):
    ideal_region = get_ideal_path_region(seed)  // set of coordinates within proximity threshold
    overlap = count(filled_voxels ∩ ideal_region)
    total_ideal = count(ideal_region)
    match = overlap / total_ideal
    return match  // 0.0 to 1.0
```

> **TODO — RESEARCH:** Define "ideal_region" precisely.
> - Is it all coordinates within proximity < 5 of the ideal path? < 10? < 15?
> - How many voxels does this region contain? (determines the denominator)
> - A too-large region → easy to hit high match % → devalues mastery
> - A too-small region → nearly impossible to hit → frustrating
> - Target: a perfect tree (if somehow achieved) would fill 8,000-15,000 voxels in the ideal region
> - At Day 440 with 30,000 total voxels, ~50-70% might be in the ideal region for a skilled caretaker

---

## 4. Parametric Tree Structure

### 4.1 Data Model

```
Branch {
    id:        uint32       // unique identifier
    angle:     float        // radians relative to parent direction
    length:    float        // in voxel units
    thickness: float        // radius in voxel units
    curve:     float        // bezier control point offset
    depth:     uint8        // 0 = trunk, 1+ = branches
    born:      uint32       // day this branch was created
    pruned:    bool         // permanently removed
    children:  Branch[]     // sub-branches
}
```

Total tree at Day 440 with 36 living branches: ~2KB serialized.

### 4.2 Growth Algorithm (Per-Day Tick)

```
function grow_tick(tree, day, seed, conditions):
    rate = calculate_growth_rate(conditions)
    
    function extend_and_fork(branch):
        if branch.pruned: return
        
        living_children = branch.children.filter(c => !c.pruned)
        sp = SPECIES_PARAMS[tree.species]
        depth_falloff = sp.depthFalloffBase ** branch.depth   // §4.4 exponential
        rng = seeded_rng(seed + branch.id * 7919 + day * 37)  // per-branch RNG
        
        is_leader = is_leader_child(branch)
        // Leader = longest living sibling; lowest array index wins ties.
        // Trunk (depth 0) is always leader.
        
        if living_children.length == 0:
            // TIP BRANCH — extend at full or suppressed rate
            tip_mult = is_leader ? 1.0 : (1.0 - sp.apicalDominance * 0.5)
            extension = (1.2 + rng() * 2.8) * rate * depth_falloff * tip_mult
            branch.length += extension
            
            // FORK CHECK (unchanged)
            fork_thresh = 8 + branch.depth * 5
            fork_chance = species.forkChance * (1.0 - branch.depth * 0.1) * rate
            
            if branch.length > fork_thresh AND branch.depth < MAX_DEPTH AND rng() < fork_chance:
                spawn_children(branch, day, rng)
        
        else:
            // INNER BRANCH — continued extension at reduced rate
            if branch.depth == 0:
                inner_rate = sp.trunkContinuedRate          // e.g. 0.25 for hardwood
            else if is_leader:
                inner_rate = sp.parentExtensionRate          // e.g. 0.20 for hardwood
            else:
                inner_rate = sp.parentExtensionRate * (1.0 - sp.apicalDominance * 0.5)
            
            inner_ext = (0.8 + rng() * 0.4) * rate * depth_falloff * inner_rate
            branch.length += inner_ext
            // Inner branches do NOT fork — only tips fork (meristems at tips).
        
        // Pre-order recursion (children iterated after extension)
        for child in branch.children:
            extend_and_fork(child)
    
    // Thickening pass (post-order, Leonardo's Rule) runs separately — unchanged.
    // Trunk maturation: thickness += 0.05 * rate; branches: += 0.02 * rate.
    
    extend_and_fork(tree)
    thickening_pass(tree)
```

### 4.3 Fork/Branching Rules

```
function spawn_children(parent, day, rng):
    spread = species_spread(parent.species) + rng() * 0.2
    // spread: hardwood 0.4-0.7, evergreen 0.3-0.5, tropical 0.2-0.45
    
    side = rng() < 0.5 ? 1 : -1
    
    // Primary child (always)
    child1 = Branch {
        angle: spread * side + (rng() - 0.5) * 0.15,
        length: 3 + rng() * 5,
        thickness: 1.1 + rng() * 0.7,
        depth: parent.depth + 1,
        born: day,
        curve: (rng() - 0.5) * 7
    }
    parent.children.push(child1)
    
    // Secondary child (probability varies by species)
    // hardwood: 45%, evergreen: 35%, tropical: 25%
    if rng() < secondary_fork_chance(parent.species):
        child2 = Branch {
            angle: -spread * side + (rng() - 0.5) * 0.2,
            length: 2 + rng() * 4,
            thickness: 1 + rng() * 0.5,
            depth: parent.depth + 1,
            born: day,
            curve: (rng() - 0.5) * 5
        }
        parent.children.push(child2)
```

> **RESOLVED (2026-08-26):** Species-specific growth curves implemented via `SPECIES_PARAMS`.
> Four new fields per species: `apicalDominance` (HW 0.65, EG 0.80, TR 0.45),
> `depthFalloffBase` (HW 0.72, EG 0.68, TR 0.78), `parentExtensionRate` (HW 0.20, EG 0.15, TR 0.30),
> `trunkContinuedRate` (HW 0.25, EG 0.20, TR 0.35). Combined with existing `extensionMultiplier`,
> `forkSpreadMin/Max`, `secondaryForkChance`. Sub-species within a class differ only in visuals
> (bark/leaf color) — growth params are per-class. Values flagged for playtest tuning.

### 4.4 Depth Falloff

```
function depth_falloff(depth, species):
    // Exponential falloff — species-specific base.
    // Replaces linear max(0.1, 1.0 - depth * 0.15).
    return sp.depthFalloffBase ** depth
```

Species-specific values per depth:

| Depth | Hardwood (0.72) | Evergreen (0.68) | Tropical (0.78) |
|-------|-----------------|------------------|-----------------|
| 0     | 1.0000          | 1.0000           | 1.0000          |
| 1     | 0.7200          | 0.6800           | 0.7800          |
| 2     | 0.5184          | 0.4624           | 0.6084          |
| 3     | 0.3732          | 0.3144           | 0.4746          |
| 4     | 0.2687          | 0.2138           | 0.3702          |
| 5     | 0.1935          | 0.1454           | 0.2887          |
| 6     | 0.1393          | 0.0989           | 0.2252          |

> **R9 — RESOLVED (2026-08-26):** Exponential depth falloff implemented.
> Species-specific base: Hardwood 0.72, Evergreen 0.68, Tropical 0.78.
> Exponential produces more natural shapes than linear — deeper branches get
> progressively weaker without the hard floor at 0.10. Combined with apical
> dominance (§4.2), this gives species-distinct silhouettes: evergreen tapers
> aggressively (excurrent), tropical stays bushier (decurrent).

### 4.5 Rotation Influence

```
function apply_rotation_bias(branch, rotation_state):
    // rotation_state: 0-3 (which quarter the "sun" is in)
    // Branches on the sun-facing side grow slightly faster
    sun_angle = rotation_state * (PI / 2)
    alignment = cos(branch.world_angle - sun_angle)
    // alignment: 1.0 = facing sun, -1.0 = facing away
    
    growth_bias = 1.0 + alignment * 0.15  // up to ±15% growth rate
    return growth_bias
```

> **TODO — RESEARCH:** How much should rotation affect growth direction?
> - Too strong → rotation becomes mandatory optimization → tedious
> - Too weak → rotation is meaningless → remove the mechanic
> - Real bonsai: rotation matters significantly. Trees lean toward light.
> - Should rotation also affect FORK DIRECTION (branches biased toward sun side)?

### 4.6 Bonsai Structural Rules (Horticultural Grounding)

Real bonsai follows established structural aesthetics that should govern the growth
engine — not as flavor, but as the geometry that makes attachment height real and gives
the taper/thickness system correctness constraints. These rules also resolve R-ATTACHY
(the attachment-height problem) at the source.

**Attachment Height — the One-Third Rule:**

In classical bonsai, the lowest main branch emerges at roughly **one-third of the way up
the total trunk height**, and the lower **33–50% of the trunk is bare** (no branches).
This is intentional — the exposed lower trunk creates the impression of a mature tree.

Implication for the growth engine: depth-1 branches must NOT all fork at the growing tip
at the same Y. The first (lowest) main branch belongs at ~1/3 height, with subsequent
main branches distributed up the remaining upper trunk. The lower third stays bare.

```
function eligible_fork_height(trunk_height, existing_branches):
    bare_zone = trunk_height * 0.33          // lower third: no branches
    if existing_branches == 0:
        return trunk_height * 0.33            // first branch at 1/3 height
    // subsequent branches distribute through upper 2/3
    return bare_zone + (trunk_height - bare_zone) * distribution_factor
```

This gives each depth-1 branch a genuine, varied `attachmentY` — which makes the ARM/LEG
split by attachment height REAL rather than a fork-order proxy. Lower attachments (nearer
the 1/3 line) → LEG; higher attachments (up the trunk) → ARM. R-ATTACHY closes when the
engine records true attachmentY per branch instead of forking all at the tip.

> **R-ATTACHY (resolution path):** Add explicit `attachmentY: float` to the Branch struct,
> set at fork time from `eligible_fork_height`. The voxelizer and StatDeriver then read real
> attachment height. Until this lands, branchId-order proxy is the interim (see DECISIONS.md).

**Taper Rule:**

The trunk must be thickest at the base and taper progressively thinner toward the apex.
Branches follow the same rule: the **lowest branch is the thickest, the highest is the
thinnest**. This is stricter and more directional than raw Leonardo's Rule thickening.

Implications:
- A well-grown tree exhibits monotonic trunk taper (base → apex decreasing). This is a
  **correctness constraint** — the growth engine can assert it, and a tree that violates it
  is malformed.
- Lower branches thicker than upper branches. In bonsai, the first (lowest) main branch is
  often deliberately very thick — thicker than wild-forestry rules would allow — to convey
  immense age. This means the lowest branch accumulates the most voxels → the most ARM or
  LEG stat contribution. Thick low branches correlate with the age/Wisdom the design already
  rewards. The taper rule and the stat system reinforce each other.

> **TODO — RESEARCH:** Taper as a match% factor. Should adherence to proper taper (thick
> base, thin apex, graded branch thickness) contribute to the ideal-form match percentage?
> A tree with correct taper is "more properly grown" — this could be part of what match%
> measures, beyond spatial overlap with the style spline.

**Forced Sprouting (Notching) — future caretaker action:**

Bonsai artists force buds to sprout where a branch is missing, using hard pruning, trunk
chopping, or notching the bark above/below a dormant bud. This is the INVERSE of pruning:
pruning removes growth, notching FORCES growth at a chosen point.

This is a future premium caretaker action (see GDD monetization). Where pruning lets a
caretaker remove voxels to redirect growth, notching would let a caretaker FORCE a new
branch at a specific coordinate — deliberately steering toward high-value stat terrain
instead of hoping growth wanders there. It is the "sculpting toward ideal form" mechanic
made literal, and the deepest expression of caretaker skill: a master who knows their
seed's terrain notches exactly where the high-value clusters sit.

> **DEFERRED:** Notching is a future caretaker action, not in the current growth engine.
> Tracked for the care-loop feature set. Requires: a notch action, bud-eligibility rules
> (can't notch the bare lower third, can't notch where a branch already exists), and a
> premium-item gate consistent with shears/fertilizer.



### 5.1 Core Algorithm

Walk the parametric tree and fill all voxel cells that the branch geometry occupies.

```
function voxelize(tree, grid_size=256):
    filled = {}  // sparse map: "x,y,z" → material_type
    
    function voxelize_branch(branch, start_x, start_y, start_z, parent_angle):
        if branch.pruned: return
        
        angle = parent_angle + branch.angle
        end_x = start_x + sin(angle) * branch.length
        end_y = start_y + cos(angle) * branch.length  // Y = up
        end_z = start_z + branch.curve * cos(angle + PI/2)  // Z from curve
        
        // Fill thick bezier tube along branch
        steps = ceil(branch.length)
        for i in 0..steps:
            t = i / steps
            // Interpolate position along branch
            px = lerp(start_x, end_x, t)
            py = lerp(start_y, end_y, t)
            pz = lerp(start_z, end_z, t)
            
            // Tapered radius: thicker at base, thinner at tip
            r = lerp(branch.thickness, branch.thickness * 0.6, t)
            
            // Fill sphere of radius r at this point
            fill_sphere(filled, px, py, pz, r, get_material(branch))
        
        // Prune scar at cut points
        for child in branch.children:
            if child.pruned:
                scar_pos = get_branch_tip(branch, parent_angle)
                fill_sphere(filled, scar_pos.x, scar_pos.y, scar_pos.z, 1.5, PRUNE_SCAR)
        
        // Leaves at tips (no living children)
        living = branch.children.filter(c => !c.pruned)
        if living.length == 0 AND branch.length > 4:
            fill_leaf_cluster(filled, end_x, end_y, end_z, branch)
        
        // Recurse into children
        for child in living:
            voxelize_branch(child, end_x, end_y, end_z, angle)
    
    // Start: trunk base at grid center-bottom
    base_x = grid_size / 2
    base_y = grid_size * 0.15  // pot/soil line
    base_z = grid_size / 2
    voxelize_branch(tree, base_x, base_y, base_z, 0)
    
    // Fill root zone below trunk
    fill_roots(filled, base_x, base_y, base_z, tree.thickness)
    
    return filled
```

### 5.2 Material Types

```
HEARTWOOD = 0   // inner trunk (structural: HP)
BARK = 1        // outer trunk surface (structural: HP — same as heartwood for structural)
BRANCH_WOOD = 2 // limb material (structural: Power for arms, Endurance for legs)
LEAF = 3        // canopy (structural: Ki)
ROOT = 4        // below-ground (structural: Endurance)
PRUNE_SCAR = 5  // hardened cut point (structural: small Defense bonus)

function get_material(branch):
    if branch.depth == 0: return HEARTWOOD  // inner cells BARK for outer
    if branch.depth <= 1: return BRANCH_WOOD
    return BRANCH_WOOD  // depth 2+ still wood — digits/claws
```

> **TODO — RESEARCH:** How to distinguish heartwood vs bark voxels in the trunk?
> - Option A: trunk voxels within 70% of radius = heartwood, outer 30% = bark
> - Option B: all trunk voxels are one type, no heartwood/bark distinction
> - Does the distinction matter for stats? Currently both map to HP structurally.
> - If heartwood and bark both → HP, simplify to one type. Differentiate only for visual rendering.

### 5.3 Leaf Cluster Generation

```
function fill_leaf_cluster(filled, x, y, z, branch):
    rng = seeded_rng(branch.id * 997)
    // Cluster size proportional to branch length and species
    cluster_radius = 4 + branch.length * 0.3
    count = 8 + floor(branch.length / 3)
    
    for i in 0..count:
        angle_h = rng() * 2 * PI
        angle_v = rng() * PI - PI/2
        r = cluster_radius * (0.3 + rng() * 0.7)
        lx = x + cos(angle_h) * cos(angle_v) * r
        ly = y + sin(angle_v) * r
        lz = z + sin(angle_h) * cos(angle_v) * r
        
        leaf_size = 1 + rng() * 2
        fill_sphere(filled, lx, ly, lz, leaf_size, LEAF)
```

> **TODO — RESEARCH:** Leaf cluster shape by species.
> - Hardwood: broad rounded clusters (oak) vs flat layered planes (maple)
> - Evergreen: needle sprays (pine) vs scale clusters (juniper)
> - Tropical: large individual leaves (ficus) vs succulent pads (jade)
> - Should leaf shape affect voxel fill pattern? Or is all leaf matter equivalent?

### 5.4 Root Generation

```
function fill_roots(filled, base_x, base_y, base_z, trunk_thickness):
    rng = seeded_rng(trunk_thickness * 31337)
    root_count = 3 + floor(trunk_thickness / 2)
    
    for i in 0..root_count:
        angle = (i / root_count) * 2 * PI + rng() * 0.5
        length = trunk_thickness * 2 + rng() * 8
        // Roots grow outward and slightly downward
        for step in 0..ceil(length):
            t = step / length
            rx = base_x + cos(angle) * step * 1.2
            ry = base_y - step * 0.4  // downward
            rz = base_z + sin(angle) * step * 1.2
            r = max(0.5, trunk_thickness * 0.3 * (1 - t))
            fill_sphere(filled, rx, ry, rz, r, ROOT)
```

> **TODO — RESEARCH:** Root system complexity.
> - Roots are mostly invisible (below pot line) but affect Stability/Endurance stats
> - Sekijoju (root over rock) style needs exposed root rendering above pot line
> - Should root growth be influenced by care actions? (e.g., repotting expands root zone)
> - How do roots voxelize for species? (deep taproot vs surface spreading vs aerial roots)

---

## 6. Stat Derivation

### 6.1 Structural Stats (from voxel positions in morphology)

```
function derive_structural_stats(filled_voxels, tree):
    stats = { HP: 0, Power: 0, Endurance: 0, Ki: 0, SkillSlots: 0 }
    
    // HP from trunk thickness
    trunk_voxels = count_voxels_in_region(filled, trunk_region(tree))
    stats.HP = trunk_voxels * TRUNK_HP_MULTIPLIER
    
    // Power from upper depth-1 branch thickness
    arm_branches = get_upper_depth1(tree)
    for b in arm_branches:
        arm_voxels = count_voxels_in_branch(filled, b)
        stats.Power += arm_voxels * ARM_POWER_MULTIPLIER
    
    // Endurance from lower depth-1 branch thickness
    leg_branches = get_lower_depth1(tree)
    for b in leg_branches:
        leg_voxels = count_voxels_in_branch(filled, b)
        stats.Endurance += leg_voxels * LEG_ENDURANCE_MULTIPLIER
    
    // Ki from leaf voxels
    leaf_voxels = count_voxels_by_material(filled, LEAF)
    stats.Ki = leaf_voxels * LEAF_KI_MULTIPLIER
    
    // Skill slots from depth-2+ branch count
    stats.SkillSlots = count_depth2_plus_branches(tree)
    
    return stats
```

> **TODO — RESEARCH:** Multiplier values for each structural stat.
> - What's the baseline? If a Day 1 sapling has 100 trunk voxels, what HP does that give?
> - How does stat scaling feel at Day 30 vs Day 100 vs Day 400?
> - Run simulation: plot stat growth curves over 500 days for each species
> - Stats should grow sub-linearly? Linearly? Log? (affects late-game power creep)

### 6.2 Terrain Bonuses (from coordinate stat map)

```
function derive_terrain_bonuses(filled_voxels, seed):
    bonuses = { HP: 0, Power: 0, Endurance: 0, Ki: 0, SkillPoints: 0 }
    
    for (x, y, z) in filled_voxels:
        terrain = get_terrain_stat(seed, x, y, z)
        bonuses[terrain.stat_type] += terrain.value
    
    return bonuses
```

### 6.3 Combined Stat Sheet

```
function full_stat_sheet(tree, filled_voxels, seed, age_days):
    structural = derive_structural_stats(filled_voxels, tree)
    terrain = derive_terrain_bonuses(filled_voxels, seed)
    
    return {
        HP:         structural.HP + terrain.HP,
        Power:      structural.Power + terrain.Power,
        Endurance:  structural.Endurance + terrain.Endurance,
        Ki:         structural.Ki + terrain.Ki,
        SkillSlots: structural.SkillSlots,
        SkillPoints: terrain.SkillPoints,
        Wisdom:     wisdom_from_age(age_days),
        MatchPct:   calculate_match(filled_voxels, seed),
    }
```

---

## 7. Pruning Algorithm

### 7.1 Prune Execution

```
function prune(tree, branch_id, day):
    branch = find_branch(tree, branch_id)
    if branch == null: return ERROR
    if branch.depth == 0: return ERROR  // can't prune trunk
    if branch.pruned: return ERROR
    
    // Count voxels being removed (for stat recalculation)
    removed_voxels = get_all_voxels_in_subtree(branch)
    
    // Mark as pruned
    branch.pruned = true
    branch.children = []  // descendants gone forever
    
    // Place scar
    branch.has_scar = true
    
    // Growth energy redistribution
    // Remaining tip branches get a temporary boost
    surviving_tips = get_all_tips(tree)
    boost_per_tip = PRUNE_ENERGY_BONUS / len(surviving_tips)
    for tip in surviving_tips:
        tip.growth_boost += boost_per_tip  // decays over 5-10 days
    
    // Recalculate everything
    new_voxels = voxelize(tree)
    new_stats = full_stat_sheet(tree, new_voxels, seed, day)
    new_match = calculate_match(new_voxels, seed)
    
    // Log the action
    care_log.append({ action: PRUNE, day: day, branch_id: branch_id })
    
    return { removed_voxels, new_stats, new_match }
```

### 7.2 Growth Energy Redistribution

```
function apply_growth_boost(branch, rng, conditions):
    base_extension = (1.2 + rng() * 2.8) * growth_rate(conditions)
    boosted = base_extension * (1.0 + branch.growth_boost)
    branch.growth_boost *= 0.85  // decay 15% per day
    if branch.growth_boost < 0.01: branch.growth_boost = 0
    return boosted
```

> **TODO — RESEARCH:** Prune energy redistribution model.
> - How much extra growth should surviving branches get after a prune?
> - Real bonsai: pruning causes vigorous regrowth at remaining tips
> - Too much boost → pruning is "free power" (lose voxels but gain faster regrowth)
> - Too little → pruning is always pure loss → nobody prunes
> - The balance: pruning should feel like a TRADE — short-term loss for long-term directional control
> - Simulate: prune at Day 100, compare total voxels at Day 200 vs un-pruned tree

---

## 7.3 Wire, Twine, and Weight Mechanics

### Wire Lifecycle

```
function applyWire(tree, branchId, angle, day):
    branch = find(tree, branchId)
    if branch.depth != 1: return ERROR  // depth-1 only
    if abs(angle) > 0.785: return ERROR  // ±45° = π/4 radians max
    branch.wired = true
    branch.wireAppliedDay = day
    branch.wireAngle = angle
    branch.angle += angle  // immediate bend
    log(WIRE_APPLY, day, branchId, angle)

function removeWire(tree, branchId, day):
    branch = find(tree, branchId)
    monthsWired = (day - branch.wireAppliedDay) / 30  // game months
    if monthsWired < 6:
        // Too early — branch springs back
        springBackRate = 1.0 - (monthsWired / 6)  // 100% at day 0, 0% at month 6
        branch.angle -= branch.wireAngle * springBackRate
    else if monthsWired <= 12:
        // Perfect window — bend sets permanently
        branch.wireSet = true
    // >12 months: already scarred by processWireTick
    branch.wired = false
    log(WIRE_REMOVE, day, branchId)

function processWireTick(tree, currentDay):
    for each wired branch:
        monthsWired = (currentDay - branch.wireAppliedDay) / 30
        if monthsWired > 12 AND NOT branch.wireScarred:
            branch.wireScarred = true
            // Wire cuts into bark — permanent cosmetic damage
            // Flower Guild Rank penalty applied during match% calculation
```

### Twine Lifecycle

```
function applyTwine(tree, branchId, angle, day):
    if abs(angle) > 0.35: return ERROR  // ±15-20° max
    branch.twined = true
    branch.twineAppliedDay = day
    branch.twineAngle = angle
    branch.angle += angle
    log(TWINE_APPLY, day, branchId, angle)

function processTwineTick(tree, currentDay):
    for each twined branch:
        daysApplied = currentDay - branch.twineAppliedDay
        degradeWindow = 10 + seededRandom(branch.id, 0, 5)  // 10-15 days
        if daysApplied > degradeWindow:
            // Twine degrading — branch springs back ~1° per day
            springBack = min(abs(branch.twineAngle), 0.017)  // ~1° in radians
            branch.angle -= sign(branch.twineAngle) * springBack
            branch.twineAngle -= sign(branch.twineAngle) * springBack
            if abs(branch.twineAngle) < 0.01:
                branch.twined = false  // fully sprung back
```

### Weight Mechanics

```
function applyWeight(tree, branchId, day):
    branch = find(tree, branchId)
    branch.weighted = true
    // Weight pulls downward only — modifies angle toward vertical (π/2 or -π/2)
    // Max pull: 35% of wire's max arc ≈ 0.275 radians (~15.75°)
    maxPull = 0.275
    // Gradual: weight effect increases over time during growth ticks
    log(WEIGHT_APPLY, day, branchId)

function processWeightGrowth(branch, growthTick):
    if branch.weighted:
        // Each growth tick, branch angle shifts slightly downward
        downwardShift = 0.005  // ~0.3° per tick, gradual
        // Clamp to max pull
        totalPull = accumulated downward shift
        if totalPull < maxPull:
            branch.angle += downwardShift toward vertical
```

> **TODO — RESEARCH:** Weight set timing.
> - Does a weight eventually "set" the branch like wire does? After how long?
> - Real bonsai: weights can be left indefinitely (gravity doesn't scar)
> - Suggest: weights set after ~60 game days (2 months), no scarring ever

---

## 7.4 Technique Classification

```
function classifyTechnique(careLog):
    wireCount = count(careLog, type == WIRE_APPLY)
    pruneCount = count(careLog, type == PRUNE)
    jinCount = count(careLog, type == JIN_STRIP)
    landscapeCount = count(careLog, type == LANDSCAPE_PLACE)
    // Note: TWINE_APPLY and WEIGHT_APPLY do NOT count as wire

    // Primary technique
    if wireCount == 0 AND pruneCount > 0:
        primary = CLIP_AND_GROW
    else if wireCount > 0 AND pruneCount > 0:
        primary = BOUND_AND_CUT
    else:
        primary = BOUND_AND_CUT  // default

    // Overlays
    overlays = []
    if jinCount >= 1:
        overlays.push(JIN)
    if landscapeCount >= 3:  // threshold: at least 3 elements
        overlays.push(WATER_AND_LAND)

    return { primary, overlays }

function isFirstQualification(careLog, technique):
    // Check if the MOST RECENT action caused first qualification
    // Used to trigger the spirit resonance notification once
    logWithoutLast = careLog[0..length-2]
    prevClassification = classifyTechnique(logWithoutLast)
    currClassification = classifyTechnique(careLog)
    return technique NOT in prev AND technique IN curr
```

> **R22 — Clip-and-Grow qualification thresholds:**
> First-pass values (lock after simulation confirms they feel right):
> - Age ≥ 30 game days AND prune count ≥ 2 AND wire count == 0
> - This ensures the commitment is real (30 days of no wire + at least 2 deliberate cuts), not accidental (a Day-3 tree with 1 prune and 0 wire is just new, not Lingnan)
> - Run simulation: grow 100 trees to Day 60, apply random care patterns, confirm Clip-and-Grow fires for ~15-25% of trees that happen to never wire — if it's much higher, the threshold is too loose; if near 0%, too strict

---

## 8. Performance Considerations

### 8.1 Voxelization Cost

Full voxelization of a 30,000-voxel tree involves:
- Walking ~36 branches
- Filling ~500 sphere operations (steps along each branch)
- Each sphere fill: ~20-100 voxel writes depending on radius

Total: ~5,000-15,000 voxel write operations per full voxelize.

> **TODO — RESEARCH:** Is full re-voxelization per growth tick feasible on mobile?
> - Option A: full re-voxelize every tick (~5-15ms on modern mobile? needs benchmarking)
> - Option B: incremental voxelization (only voxelize newly grown portions, keep existing)
> - Option C: voxelize lazily (only on stat query or NFT render, not every tick)
> - The care loop display is 2D canvas (parametric rendering). Voxelization only needed for stats and 3D view.
> - Recommendation: Option C — voxelize on demand, not per tick. Keep parametric tree as live state.

### 8.2 Stat Terrain Evaluation Cost

Each filled voxel requires one hash evaluation for terrain bonus. At 30,000 voxels:
- 30,000 hash operations
- Each hash: ~10-50 nanoseconds (varies by function)
- Total: < 1ms

No performance concern. Can run per-tick if needed.

### 8.3 Match Percentage Cost

Requires computing distance from each filled voxel to the nearest point on the ideal path spline. Naively this is O(voxels × spline_segments).

> **TODO — RESEARCH:** Efficient match % calculation.
> - Pre-compute the ideal region as a sparse set and do set intersection? (Memory cost vs computation)
> - Spatial indexing (octree) for the ideal path region?
> - Only recalculate on prune events and significant growth milestones, not every tick?
> - Acceptable latency: < 100ms (runs when viewing stats, not in real-time loop)

---

## 9. Determinism Requirements

### 9.1 Cross-Platform Reproducibility

The same seed + care_log MUST produce the same tree state on:
- JavaScript (client, browser)
- Rust/WASM (if used for game server)
- Solidity (if on-chain verification needed)
- Python (for analytics/tooling)

This requires:
- No floating-point dependency in core algorithms (use fixed-point or integer math)
- Deterministic RNG (seeded, no platform-specific entropy)
- Consistent hash function implementation across languages

> **TODO — RESEARCH (CRITICAL):** Fixed-point vs floating-point for growth math.
> - Floating-point has platform-dependent rounding behavior
> - Fixed-point (e.g., Q16.16) guarantees identical results everywhere
> - Trade-off: fixed-point is harder to write and debug
> - Alternative: use float BUT round to 4 decimal places after every operation (lossy but deterministic?)
> - This MUST be resolved before any real implementation. A tree that reconstructs differently on two platforms breaks the entire verification model.

### 9.2 Care Log as Source of Truth

The care log must contain EVERY input needed to reconstruct the tree:
- Day number for each growth tick
- Exact moisture/health/fertilizer state at each tick (or enough to recompute)
- Prune actions with branch IDs
- Rotation changes

> **TODO — RESEARCH:** Minimal care log format.
> - Option A: store every action explicitly → simple but verbose
> - Option B: store only player actions (water, prune, fertilize, rotate), derive moisture/health/growth from the sequence → compact but requires replaying from Day 0
> - Option C: checkpoint system — store full state every N days, log only actions between checkpoints → balance of size and reconstruction speed
> - At Day 440 with 600 actions: Option A ≈ 15KB, Option B ≈ 3KB, Option C ≈ 5KB
> - Reconstruction time from Day 0 (Option B): 440 growth ticks × ~1ms = < 0.5 seconds. Acceptable.

---

## 10. Open Research Questions (Consolidated)

| # | Question | Priority | Section |
|---|---|---|---|
| R1 | Spatial hash function selection and uniformity testing | ✓ RESOLVED | 2.3 |
| R2 | Neutral coordinate percentage (1/6 natural, accepted) | ✓ RESOLVED | 2.4 |
| R3 | Stat distribution weighting across terrain | MEDIUM | 2.5 |
| R4 | Parametric curves for all 8 bonsai styles (Chokkan only implemented) | HIGH | 3.2 |
| R5 | Style blending (single style vs weighted blend per seed) | MEDIUM | 3.2 |
| R6 | Proximity curve steepness tuning (first-pass values shipped) | ✓ RESOLVED (tuning deferred) | 3.3 |
| R7 | Ideal region size for match % denominator (dist<10 shipped) | ✓ RESOLVED (tuning deferred) | 3.4 |
| R8 | Species-specific growth parameter tables | HIGH | 4.3 |
| R9 | Depth falloff curve shape (linear shipped, exponential candidate) | MEDIUM | 4.4 |
| R10 | Rotation influence strength | LOW | 4.5 |
| R11 | Heartwood vs bark voxel distinction (decoupled — material=render, role=morphology) | ✓ RESOLVED | 5.2 |
| R12 | Leaf cluster shape per species | MEDIUM | 5.3 |
| R13 | Root system complexity and style interaction | LOW | 5.4 |
| R14 | Structural stat multiplier values and scaling curves (first-pass shipped, tuning needed) | HIGH | 6.1 |
| R15 | Prune energy redistribution balance | HIGH | 7.2 |
| R16 | Voxelization: per-tick vs on-demand | MEDIUM | 8.1 |
| R17 | Match % computation efficiency | MEDIUM | 8.3 |
| R18 | Fixed-point vs floating-point determinism | CRITICAL | 9.1 |
| R19 | Care log format and reconstruction strategy | HIGH | 9.2 |
| R20 | Wire scar Flower Guild Rank penalty magnitude | MEDIUM | 7.3 |
| R21 | Weight set timing (how long before gravity sets the branch?) | MEDIUM | 7.3 |
| R22 | Clip-and-Grow qualification thresholds (min age + prune count) | MEDIUM | 7.4 |
| R23 | Twine degradation window variability (10-15 days, seeded?) | LOW | 7.3 |
| R-ATTACHY | Add explicit attachmentY to Branch via one-third bonsai rule | ✓ RESOLVED (2026-07-20) | 4.6 |
| R-VOXMEM | Per-voxel branchId footprint (included, ~3 bytes/voxel cost) | ✓ RESOLVED | 5.2 |

---

*This spec will be updated as research questions are resolved. Implementation should not begin on any section with unresolved CRITICAL or HIGH priority TODOs.*
