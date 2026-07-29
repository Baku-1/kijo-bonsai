# COMBAT ENGINE — METADATA REQUIREMENTS RESEARCH

**Date:** 2026-07-27  
**Author:** Claude (research extraction — not implementation)  
**Sources:** All files in `kijo/kijo-bonsai/docs/`, all files in `kijo/kijo-bonsai/kijo/docs/`, and `packages/shared/src/index.ts`  
**Status:** Research complete. No code changed.

**Last corrective pass: 2026-07-28. Errors fixed: 3 CRITICAL, 5 MAJOR, 8 MINOR per COMBAT-METADATA-AUDIT.md.**

---

## Table of Contents

1. [Combat System Overview](#1-combat-system-overview)
2. [How Combat Reads NFT Data](#2-how-combat-reads-nft-data)
3. [Complete Stat List — Sources and Derivation](#3-complete-stat-list--sources-and-derivation)
4. [Current NFT Metadata Schema](#4-current-nft-metadata-schema)
5. [Gap Analysis — Missing from Metadata](#5-gap-analysis--missing-from-metadata)
6. [Species and Sub-type Tables](#6-species-and-sub-type-tables)
7. [Skill Slots vs Skill Points](#7-skill-slots-vs-skill-points)
8. [Spirit Affinity / Elemental Alignment](#8-spirit-affinity--elemental-alignment)
9. [Flower Guild Rank Threshold Discrepancy](#9-flower-guild-rank-threshold-discrepancy)
10. [Document Version Conflicts](#10-document-version-conflicts)
11. [Open Questions for Jeremy](#11-open-questions-for-jeremy)

---

## 1. Combat System Overview

### 1.1 Two Models — Both Preserved in Docs

The GDD (v0.2, `kijo-bonsai/docs/GDD.md`) explicitly maintains two combat models. The fighting game model is the **leading candidate**; the turn-based model is **preserved for review**.

#### Model A — Fighting Game (Leading Candidate, GDD §4.3)

Real-time 2D fighting game in the vein of Street Fighter / Mortal Kombat. Matchmaking infrastructure modeled on Axie. The fighter executes directional combos during live combat.

**Controls:** Directional pad (left/right/up/down) + action buttons (strike, kick, guard, grab). Special moves triggered by directional input combinations + action button.

**Core mechanic — depth-2 branches = special move slots:**
- Each depth-2+ sub-branch in the kijo's morphology is one programmable special move slot.
- The fighter defines the input combination for each slot before battle.
- Move power = voxel count in that branch (a 45-voxel claw produces a stronger move than a 12-voxel twig).
- Longer input sequences = bonus damage multiplier but higher execution risk (3-input = base; 5-input = 1.5× but longer wind-up, can be interrupted).

**Skill point economy in fighting game model:**
- Skill Points (from voxel terrain — see §3) = the budget the fighter distributes across their available slots.
- Skill point investment per slot modifies: damage scaling, effect duration, cooldown reduction, or combo extension.
- Pruning removes slots (fewer moves) but does NOT reduce the skill point budget — remaining slots get more points per slot. This is the specialist vs. generalist trade-off.

**Species behavior in fighting game:**
- Hardwood: slow walk, heavy hits, super armor on special startup (can take a hit while executing). Grappler/brawler archetype.
- Evergreen: medium speed, reliable frame data, short recovery on moves, chains naturally. Pressure archetype.
- Tropical: fast walk, explosive damage, but long recovery on whiff — missing a special leaves them wide open. Rushdown/glass cannon.

**Wisdom in fighting game context:**
- Wisdom = auto-block rate for ambiguous mixups, proportional to age.
- 100 days → 10% auto-block. 365 days → 35%. 500 days → 50%.
- Wisdom also controls recovery speed after knockdown (older spirits get up faster).

**Tag team (future):**
- Tag moves become special combo inputs (`← ←` + tag = swap with recovery; `→ →` + tag = partner rushes in with assist).
- 2v2 and 3v3: bench kijo recover Ki/morale passively.

#### Model B — Turn-Based Tactical (Preserved for Review, GDD §4.4)

Round-based. Each round both kijo commit to a stance simultaneously, then resolve.

**Stances:**
- **Root** (defensive): reduces incoming damage by Defense%, heals HP from Stability. Cannot attack.
- **Strike** (offensive): commits an ability. Damage = Attack × ability potency × skill point investment. Exposed to counters.
- **Guard** (reactive): auto-counter if opponent strikes. Neutral otherwise.
- **Reach** (aggressive): longer-range attack, higher damage but skips next turn on miss. Ki-intensive.

**Stance interaction matrix:**

| Attacker \ Defender | Root | Strike | Guard | Reach |
|---|---|---|---|---|
| Root | Both heal | Defender hits, attacker heals | Both neutral | Defender hits, attacker heals |
| Strike | Attacker hits reduced | Both trade | Defender counters | Both trade, attacker faster |
| Guard | Both neutral | Attacker counters | Both neutral | Attacker counters |
| Reach | Attacker hits hard | Both trade, defender faster | Defender counters hard | Both trade heavy |

**Damage formula:**
```
Raw Damage = Attack × (ability_base + skill_points × 0.05) × species_modifier
Reduction  = Defender's Defense% × stance_modifier
Final HP loss = Raw Damage − Reduction (minimum 1)
```

> **NOTE:** 'Defense%' and 'Stability' referenced in this formula are NOT fields in the canonical TypeScript StatSheet (hp, power, endurance, ki, skillSlots, skillPoints, wisdom, matchPct). If the turn-based model is implemented, these must be either derived from existing stats or added as new StatSheet fields. Open design gap — see ADR-STATSHEET-DEFENSE-STABILITY.md.

**Resolution order:** determined by Tempo (species class). Tropicals resolve first, Evergreens second, Hardwoods last. Ties broken by Wisdom.

**Ki resource:** abilities cost Ki. Ki regenerates +5% of max Ki per turn. Running out forces basic strikes with no ability modifiers.

**Endurance check:** when a single hit exceeds 15% of max HP, Endurance check occurs. Fail = stagger (lose next turn). High-branch kijo rarely stagger.

**Wisdom effects (turn-based, passive):**
- 100+ days: reveals opponent's LAST chosen stance before you commit.
- 200+ days: reveals opponent's chosen stance 30% of the time BEFORE commit.
- 365+ days: reveals stance 50% of the time.
- 500+ days: can change stance AFTER seeing opponent's choice once per fight.

**Species triangle advantage:** ~15% effective modifier on damage dealt. Meaningful but beatable.
- Hardwood > Evergreen (Root heals faster than pressure damages)
- Evergreen > Tropical (pressure denies Tropical Reach windows)
- Tropical > Hardwood (Reach resolves before Hardwood's slow Tempo; burst kills before patterns can be read)

**Win condition:** HP to 0. Best-of-3 in ranked. Single elimination in tournaments.

### 1.2 Morale System

Morale is a server-side float (0–100) that gates combat access.

**Morale decreases:**
- Each loss: −15
- Battle while tree health < 40: −5 per battle
- Drought/overwatering stress: −3 per day of stress

**Morale increases:**
- Victory: +10
- Optimal care day (moisture in range): +2/day
- Fertilizer application: +5 (one-time)
- Rest day (no battles): +3/day
- Prune event: +8 ("the spirit feels your attention")

**Morale gates:**
- Below 20: kijo refuses to fight. Must restore above 50 before next battle (typically 5–10 days of care).
- Fighter's SLP (Smooth Love Potion): +20–30% morale per use, diminishing returns (2nd use ~15%, 3rd ~8%). CANNOT raise above 65%.
- Caretaker's SLP (Soothing Leaf Potion): full morale restoration over time. Account-locked, non-tradeable. Free to produce from care byproducts.

### 1.3 Awakening Gate

A kijo cannot be awakened until the tree reaches minimum maturity (60 game-days). Awakening is not permanent — a kijo that loses too many consecutive battles becomes reluctant and the caretaker must restore the tree before she will fight again.

### 1.4 Combat Authorization Flow

```
Fighter selects moves / inputs combos (web client or Godot client)
  → client sends inputs to server
  → server (authoritative) resolves each exchange using both kijo StatSheets + technique archetypes
  → server calculates SLP burn if morale recovery needed
  → server updates morale, records result
  → server batches ranked results → contracts (on-chain)
  → clients render the resolved fight
```

---

## 2. How Combat Reads NFT Data

### 2.1 Data Flow from NFT to Combat

Combat does NOT read NFT JSON directly. The full pipeline:

```
seed (from NFT on-chain) + care_log (from Supabase / Merkle-verified)
  → CareLogReplay.reconstruct() → parametric BonsaiTree
  → Voxelizer.voxelize() → SparseVoxelSet (256³ sparse voxels with VoxelRole labels)
  → StatDeriver.derive(tree, voxels, seed, ageDays) → StatSheet
  → TechniqueClassifier.classify(careLog) → Technique enum
  → StatTerrain.calculateMatch(voxels, seed) → matchPct → Flower Guild Rank
```

The NFT metadata JSON (from `tokenURI`) contains the **pre-computed result** of this pipeline — it is a snapshot, not the source of truth. The source of truth is always `seed + care_log`.

### 2.2 What Is Immutable On-Chain (Phase 1 — URI-only design)

Per `KIJONSAI-CONTRACT-ARCH.md` (v0.3, 2026-07-22), currently deployed at `0x4447F631F5868bFA03A6e6ae2D2da9f22c787E44` on Saigon testnet:

- Only `tokenURI` pointer is stored on-chain.
- No on-chain struct in Phase 1. `care_log_hash` (Merkle root) is deferred to Phase 2.
- All state (care log, tree state, combat history, morale) lives in Supabase.

**Phase 2 additions (not yet built):** `care_log_hash` Merkle root on-chain, token locking, ERC-2981.

### 2.3 Metadata Freshness

Metadata is **computed on each request** by running the full engine pipeline. It is NOT stored statically. This means metadata changes after every prune, every wire, every growth tick, and every day advance.

**Render triggers that invalidate the image:** mint, prune, wire, tick. The image is re-queued to Blender when these events fire. Stats update on every request without a Blender re-render (stats are computed in real-time from the engine).

### 2.4 Scouting Implications (from GDD §4.2)

> A competitor can see an opponent's Kijonsai NFT and verify its voxel coordinates. With the seed (visible on the NFT), they can calculate exact stats (both layers). They can also see which UNFILLED coordinates near the tree's growth frontier contain valuable terrain bonuses — predicting how the kijo might strengthen next.

This means the NFT metadata is intentionally a public scouting surface. The `Match %` trait directly signals how well a tree has been shaped toward its ideal form.

---

## 3. Complete Stat List — Sources and Derivation

### 3.1 StatSheet — Canonical Definition

From `packages/shared/src/index.ts` (the actual TypeScript implementation — ground truth over spec docs):

```typescript
export interface StatSheet {
  hp: number;           // structural + terrain HP bonuses
  power: number;        // structural + terrain Power bonuses
  endurance: number;    // structural + terrain Endurance bonuses
  ki: number;           // structural + terrain Ki bonuses
  skillSlots: number;   // depth-2+ branch COUNT (integer)
  skillPoints: number;  // terrain SKILL_POINT coordinate budget (float)
  wisdom: number;       // age in days → fight IQ (integer)
  matchPct: number;     // 0.0–1.0 overlap with ideal form
}
```

**Important discrepancy:** The C++ engine API spec (`KIJO-ENGINE-API.md` v0.2) includes `Technique technique` in `StatSheet`. The actual TypeScript `shared/src/index.ts` does NOT include `technique` in `StatSheet`. Technique is classified separately by `TechniqueClassifier` and appended to the metadata as its own trait.

### 3.2 Dual-Layer Stat System

Every stat except Wisdom and Technique is composed of TWO stacking layers:

**Layer 1 — Structural Stats (from tree morphology, visible from silhouette)**

| Body Region | Measurement Used | Stat | Combat Role |
|---|---|---|---|
| Trunk (VoxelRole.TRUNK voxels) | Voxel count × `TRUNK_HP_MULTIPLIER` | HP | Total damage absorption |
| Upper depth-1 branches (ARM role) | Voxel count × `ARM_POWER_MULTIPLIER` | Power | Raw striking damage |
| Lower depth-1 branches (LEG role) | Voxel count × `LEG_ENDURANCE_MULTIPLIER` | Endurance | Stagger resistance, movement stamina |
| Leaf clusters (CANOPY role) | Voxel count × `LEAF_KI_MULTIPLIER` | Ki | Energy pool for specials; regenerates +5%/turn in combat |
| Depth-2+ branches (DIGIT role) | **COUNT** of branches (not voxel count) | Skill Slots | Number of programmable special move slots |

The ARM/LEG split for depth-1 branches is determined by `attachmentY`. Per `shared/src/index.ts`:
- Primary depth-1 branch: `attachmentY = round4(trunk.length * 0.33)` → lower attachment → **LEG**
- Secondary depth-1 branch: `attachmentY = round4(trunk.length)` → higher attachment → **ARM**
- Depth-2+: `attachmentY = round4(parent.length)` at fork time

**Layer 2 — Terrain Bonuses (hidden, seed-determined, stacks on top of structural)**

Each coordinate in the 256³ grid has a pre-assigned bonus type determined by the seed via `spatialHash(seed, x, y, z)`. When a voxel grows into that coordinate, the kijo gains the bonus regardless of voxel material.

Terrain stat type assignment (from `KIJO-TECH-SPEC.md §2.2`):
```
stat_index = spatialHash(seed, x, y, z) mod 6
stat_type  = [HP, Power, Endurance, Ki, SkillPoint, Neutral][stat_index]
```

Terrain base values:
- HP, Power, Endurance, Ki: `0.001` per coordinate (= 0.1% bonus stacked on structural base)
- SkillPoint: `0.25` per coordinate
- Neutral: `0.0` (dead coordinate, no bonus — ~1/6 of all coordinates via the mod-6 distribution)

Proximity multiplier (coordinates near the seed's ideal bonsai style path get a bonus):
```
distance == 0  → 3.0×
distance < 5   → 2.0×
distance < 15  → 1.5×
distance < 30  → 1.0×
else           → 0.8× (slight penalty for growing far from ideal path)
```

The canonical hash implementation (from `shared/src/index.ts` — Mulberry32 variant):
```typescript
export function spatialHash(seed: number, x: number, y: number, z: number): number {
  const packed = ((x & 0xFF) << 16) | ((y & 0xFF) << 8) | (z & 0xFF);
  let h = (seed ^ packed) >>> 0;
  h = (h += 0x6D2B79F5) >>> 0;
  h = Math.imul(h ^ (h >>> 15), h | 1) >>> 0;
  h ^= h + (Math.imul(h ^ (h >>> 7), h | 61) >>> 0);
  return (h ^ (h >>> 14)) >>> 0;
}
```

### 3.3 Every Stat — Complete Reference Table

| Stat | Type | Source | Layer | In Metadata? | Notes |
|---|---|---|---|---|---|
| **HP** | float | Trunk voxel count × TRUNK_HP_MULTIPLIER + terrain HP bonuses | Structural + Terrain | ✅ Yes | Multiplier value is open research (R14) |
| **Power** | float | Upper depth-1 arm voxels × ARM_POWER_MULTIPLIER + terrain Power bonuses | Structural + Terrain | ✅ Yes | ARM = higher attachmentY branch |
| **Endurance** | float | Lower depth-1 leg voxels × LEG_ENDURANCE_MULTIPLIER + terrain Endurance bonuses | Structural + Terrain | ✅ Yes | LEG = lower attachmentY branch |
| **Ki** | float | Leaf voxels × LEAF_KI_MULTIPLIER + terrain Ki bonuses | Structural + Terrain | ✅ Yes | Ki regenerates in combat; large canopy = sustained specials |
| **Skill Slots** | uint | Count of depth-2+ branches (DIGIT role) | Structural | ✅ Yes | Integer count of special move slots |
| **Skill Points** | float | Sum of terrain SKILL_POINT coordinate bonuses from all filled voxels | Terrain only | ❌ **MISSING** | Most important gap. Fighter distributes this budget across slots. |
| **Wisdom** | uint | `wisdomFromAge(ageDays)` — age in days ONLY | Time | ✅ Yes | NOT voxel-derived. Time cannot be manufactured. |
| **Match %** | float | Overlap of filled voxels with seed's ideal-form region ÷ ideal region size (0.0–1.0) | Computed | ✅ Yes (as integer 0–100) | Drives Flower Guild Rank. Stored as int in metadata. |
| **Technique** | enum | TechniqueClassifier reads care log action ratios | Care log | ✅ Yes | 4 types: Bound-and-Cut / Clip-and-Grow / Jin / Water-and-Land |
| **Morale** | float | Server-side state; decremented by losses/neglect | Server state | ❌ Not in metadata | By design — it's dynamic combat state, not an NFT attribute |
| **Leaf Color** | string | Seed-determined at mint from species palette | Seed RNG | ✅ Yes | Derivation function not documented (OQ-3) |
| **Species Sub-type** | string | Seed-determined at mint from class sub-type table | Seed RNG | ✅ Yes | Possible values not documented (OQ-3) |
| **Bonsai Style** | string | Seed's favored style template (Chokkan, Moyogi, etc.) | Seed | ❌ **MISSING** | Not in metadata; underlies terrain bonus distribution |
| **Age** | uint | Days since planting | Time | ✅ Yes | Maps directly to Wisdom thresholds |
| **Has Spirit** | bool | Tree age ≥ 60 days AND awakened | Server state | ✅ Yes | Awakening gate |

### 3.4 Wisdom Thresholds (Combat Implications)

| Age (Days) | Wisdom Tier | Fighting Game Effect | Turn-Based Effect |
|---|---|---|---|
| 0–99 | None | No auto-block | No stance reveals |
| 100–199 | Level 1 | Auto-blocks 10% of ambiguous mixups | Reveals opponent's LAST stance |
| 200–364 | Level 2 | Auto-blocks: rate TBD — GDD defines only 10% (100 days), 35% (365 days), 50% (500 days). Intermediate values not specified.; faster knockdown recovery | Reveals opponent's stance 30% BEFORE commit |
| 365–499 | Level 3 | Auto-blocks 35%; faster knockdown recovery | Reveals stance 50% BEFORE commit |
| 500+ | Level 4 | Auto-blocks 50%; fastest recovery | Can change stance AFTER seeing opponent's choice (1×/fight) |

> **Note:** Effects are cumulative — a 500-day kijo has all four Wisdom effects simultaneously. The table shows when each unlocks, not exclusive tier behavior.

### 3.5 Technique Classification

`TechniqueClassifier.classify(careLog)` reads the ratio of action types in the care log. From `KIJO-ENGINE-API.md` v0.2 and `KIJO-TECH-SPEC.md` v0.2:

**PRIMARY TECHNIQUES** (mutually exclusive; one is always active):

| Technique | Care Pattern | Combat Archetype |
|---|---|---|
| Bound-and-Cut | wire > 0 AND prune > 0 | Balanced — moderate stats across the board, no exploitable weakness |
| Clip-and-Grow | prune ≥ 2, wire == 0 ever, age ≥ 30 days | High-Crit — low sustained damage but devastating critical hits |

**OVERLAY TECHNIQUES** (stack on top of primary; independent of each other):

| Technique | Care Pattern | Combat Archetype |
|---|---|---|
| Jin | jin strip actions ≥ 1 | Defensive — high Defense and Endurance, fights by absorbing punishment |
| Water-and-Land | landscape element count ≥ 3 | None — care-loop only. Landscape elements are display-only. No combat stat or move. |

> **Note:** Twine and Weights do NOT count as wire for technique classification. A player using only twine/weights/shears is still Clip-and-Grow eligible.

Default technique: BOUND_AND_CUT (tree has been pruned and wired at least once). The first time a tree qualifies for a non-default technique, a "spirit resonance" notification fires server-side.

### 3.6 VoxelRole Enum (from `shared/src/index.ts`)

```typescript
export enum VoxelRole {
  TRUNK   = 'trunk',    // torso / HP source
  ARM     = 'arm',      // upper depth-1 branches / Power
  LEG     = 'leg',      // lower depth-1 branches / Endurance
  DIGIT   = 'digit',    // depth-2+ branches / skill slots
  CANOPY  = 'canopy',   // leaf clusters / Ki
  ROOT    = 'root',     // root cone
  SCAR    = 'scar',     // prune scar (reserved; small Defense bonus per KIJO-ENGINE-API — model applicability TBD)
}
```

Material (render) and Role (combat) are orthogonal. A BARK voxel can carry ARM role. Do not conflate them.

---

## 4. Current NFT Metadata Schema

From `NFT-METADATA-IMAGE-ARCH.md` (Architecture Plan v5, 2026-07-27) — the current canonical schema:

```json
{
  "name": "Kijonsai #42",
  "description": "A living bonsai — grown through care, shaped by the player.",
  "image": "https://api.kijo.xyz/nft/image/42",
  "attributes": [
    { "display_type": "number",  "trait_type": "Seed",             "value": 464497 },
    { "display_type": "string",  "trait_type": "Species",          "value": "Hardwood" },
    { "display_type": "string",  "trait_type": "Species Sub-type", "value": "Twisted Trunk" },
    { "display_type": "string",  "trait_type": "Leaf Color",       "value": "Deep Green" },
    { "display_type": "date",    "trait_type": "Born",             "value": 1721520000 },
    { "display_type": "number",  "trait_type": "Age",              "value": 47 },
    { "display_type": "bool",    "trait_type": "Has Spirit",       "value": false },
    { "trait_type": "Flower Guild Rank", "value": "Sapling" },
    { "display_type": "number",  "trait_type": "HP",          "value": 959 },
    { "display_type": "number",  "trait_type": "Power",       "value": 390 },
    { "display_type": "number",  "trait_type": "Endurance",   "value": 170 },
    { "display_type": "number",  "trait_type": "Ki",          "value": 294 },
    { "display_type": "number",  "trait_type": "Match %",     "value": 73 },
    { "display_type": "number",  "trait_type": "Skill Slots", "value": 2 },
    { "display_type": "number",  "trait_type": "Wisdom",      "value": 35 },
    { "display_type": "string",  "trait_type": "Technique",   "value": "Bound-and-Cut" },
    { "display_type": "number",  "trait_type": "Total Care Actions", "value": 42 },
    { "display_type": "number",  "trait_type": "Prune Count",        "value": 7 },
    { "display_type": "number",  "trait_type": "Health Average",     "value": 84 }
  ]
}
```

**Total traits:** 19

**Trait categories:**
- Core identity: Seed, Species, Species Sub-type, Leaf Color, Born, Age, Has Spirit
- Guild: Flower Guild Rank
- Combat stats: HP, Power, Endurance, Ki, Match %, Skill Slots, Wisdom, Technique
- Care log summary: Total Care Actions, Prune Count, Health Average

---

## 5. Gap Analysis — Missing from Metadata

### 5.1 Critical Gap — Skill Points

`skillPoints` (float) is in the `StatSheet` interface and is the **fighter's upgrade budget** for distributing power across skill slots. It is a core combat resource, yet it is completely absent from the current metadata schema.

In the fighting game model: skill points determine how powerful each special move can be. A kijo with 3 slots and 24 skill points can create three devastating moves. A kijo with 8 slots and 24 skill points has thin coverage per slot.

In the turn-based model: skill points scale ability damage via `ability_base + skill_points × 0.05`. More skill points = substantially higher damage ceiling.

Without this attribute, a fighter browsing the marketplace cannot evaluate a kijo's combat offense capability — Skill Slots alone (how many moves) tells you nothing about move power.

**Recommendation:** Add `Skill Points` as `{ "display_type": "number", "trait_type": "Skill Points", "value": <float> }` after `Skill Slots`.

### 5.2 Bonsai Style (Seed's Favored Form)

The seed's favored bonsai style (Chokkan, Moyogi, Shakan, Kengai, Fukinagashi, Bunjin, Hokidachi, Sekijoju) determines where the highest terrain stat bonuses cluster in the 256³ grid. This is the primary factor in whether a tree has coherent vs. scattered stats.

Two trees with identical voxel counts in the same species can have radically different stat quality based solely on whether they grew into their favored style's terrain zones. `Match %` is the quantitative proxy for this, but the style name tells you WHAT you're matching toward.

This is a design question as much as a gap — GDD §4.2.1 says "knowing real bonsai culture makes you a better player," implying the style is a learnable advantage. Whether to reveal it on the NFT (removing the discovery game) or keep it off-chain is Jeremy's call.

### 5.3 Wire Count

The care log now includes `wire` actions (added 2026-07-19, per `shared/src/index.ts`). Wire count feeds directly into Technique classification (Bound-and-Cut requires wire actions). The metadata exposes Prune Count but not Wire Count — an asymmetry.

A fighter evaluating Technique can infer wire was used from the "Bound-and-Cut" label, but they cannot see the degree or frequency of wiring.

### 5.4 Complete Gap Table

| Item | In StatSheet? | In Metadata? | Priority | Notes |
|---|---|---|---|---|
| Skill Points | ✅ Yes | ❌ No | **CRITICAL** | Fighter upgrade budget; core combat resource |
| Bonsai Style | Derived from seed | ❌ No | High | Determines terrain clustering; Match % is the proxy |
| Wire Count | From care log | ❌ No | Medium | Feeds Technique; asymmetric vs Prune Count |
| Morale | Server-side | ❌ No | Low (by design) | Dynamic state; not an NFT attribute |
| SLP Balance | Server-side | ❌ No | Low (by design) | Fighter economy, not NFT state |

---

## 6. Species and Sub-type Tables

### 6.1 Species Classes

| Class | Growth Profile | Combat Archetype | Example Species (from GDD) |
|---|---|---|---|
| Hardwood | Slow, thick, dense branching | Brawler — absorbs hits, counters | Oak, Maple, Walnut, Elm |
| Evergreen | Steady year-round, no seasonal leaf loss | Pressure — relentless advance | Pine, Cedar, Juniper, Spruce |
| Tropical | Explosive bursts, fragile if neglected | Burst — fast damage, glass cannon | Ficus, Jade, Bougainvillea, Banyan |

Species is chosen at mint and **permanent**. It determines growth curve, seasonal behavior, bark/leaf aesthetics, and base fighting style. It does not cap power.

### 6.2 Species Parameters (from `shared/src/index.ts` — actual production values)

```typescript
export const SPECIES_PARAMS: Record<SpeciesClass, SpeciesParams> = {
  hardwood:  { extensionMultiplier: 1.0, forkSpreadMin: 0.3, forkSpreadMax: 0.8, secondaryForkChance: 0.45, trunkMaturationRate: 0.05 },
  evergreen: { extensionMultiplier: 0.8, forkSpreadMin: 0.1, forkSpreadMax: 0.4, secondaryForkChance: 0.35, trunkMaturationRate: 0.04 },
  tropical:  { extensionMultiplier: 1.3, forkSpreadMin: 0.5, forkSpreadMax: 1.2, secondaryForkChance: 0.25, trunkMaturationRate: 0.06 },
};
```

Tropical grows fastest (1.3× extension), hardwood forks widest (0.3–0.8 rad spread → broader canopy → more Ki), evergreen grows most upright (0.1–0.4 rad spread → compact, columnar).

### 6.3 Bonsai Styles as Stat Templates (8 Styles)

Each seed has one or more favored styles. High-value terrain zones cluster around these styles' spatial regions. From GDD §4.2.1:

| Style | Japanese Name | Stat Profile When Matched |
|---|---|---|
| Formal Upright | Chokkan | Balanced across all stats — the "all-rounder" |
| Informal Upright | Moyogi | High Ki + moderate Power — fluid ability-focused |
| Slant | Shakan | High Power + moderate Endurance — aggressive but grounded |
| Cascade | Kengai | High Power + high Ki, low Endurance — maximum offense, precarious |
| Windswept | Fukinagashi | High Endurance + high [defense — see ADR-STATSHEET-DEFENSE-STABILITY.md] — the survivor, built to endure |
| Literati | Bunjin | Extreme Ki + high Skill Points, low HP — glass cannon specialist |
| Broom | Hokidachi | High HP + high [defense — see ADR-STATSHEET-DEFENSE-STABILITY.md] — the wall, dense and balanced |
| Root Over Rock | Sekijoju | Extreme Endurance + moderate HP — immovable anchor |

**Natural species-style alignments:**
- Hardwoods → Chokkan / Hokidachi (upright, dense — double-stacks durability)
- Evergreens → Moyogi / Fukinagashi (flowing, windswept — relentless and unkillable)
- Tropicals → Kengai / Bunjin (dramatic, sparse — glass cannon squared)

Cross-style builds produce unusual fighters. A hardwood in Literati style fights nothing like a standard hardwood.

Partial parametric curve definitions exist in KIJO-TECH-SPEC.md §3.2 for Chokkan, Kengai, Moyogi, and Bunjin only. Shakan, Fukinagashi, Hokidachi, and Sekijoju are **undefined** (open research R4 — HIGH priority).

### 6.4 Sub-type and Leaf Color Tables — Status

**UNRESOLVED — OQ-3 in NFT-METADATA-IMAGE-ARCH.md:**

> "Species Sub-type + Leaf Color trait tables: Who defines the possible values and the seed-derivation function?"

**Leaf Color palettes (from GDD — cosmetic only, does not affect stats):**

| Species Class | Common Colors | Rare Color (~3% roll rate) |
|---|---|---|
| Hardwood | Red, Green | Maroon (blood-red) |
| Evergreen | Green, Blue | Cyan |
| Tropical | Green, Dark Green, Tan/Brown | Yellow |

Rare colors are **undocumented by design** — not advertised on mint screen. Community discovers them organically. The leaf color modifies the seasonal palette (it doesn't replace it) and is visible on both the Kijonsai NFT and the kijo's crown in combat.

**Sub-type values:** GDD examples mention "Twisted Trunk" for Hardwood. No complete table exists in any document. The function that maps seed → sub-type within a species class is not defined.

---

## 7. Skill Slots vs Skill Points

This distinction is critical and is frequently conflated in the design docs.

### 7.1 Skill Slots

- **Source:** Count of depth-2+ branches (DIGIT VoxelRole) in the voxelized tree.
- **What it determines:** How many programmable special moves the kijo can equip.
- **Is it in metadata?** ✅ Yes — `Skill Slots` trait.
- **How to increase:** Let branches grow deeper (more branching generations). Wild unpruned trees have many slots.
- **How to decrease:** Prune depth-2+ branches. Concentrates power in fewer slots.
- **Measured as:** Integer count of qualifying branches.

### 7.2 Skill Points

- **Source:** Sum of `SKILL_POINT` terrain bonuses from all filled voxels. Each voxel on a SKILL_POINT-typed coordinate contributes `0.25 × proximity_multiplier` skill points.
- **What it determines:** The total upgrade budget distributed across skill slots. Options per slot: damage scaling, effect duration, cooldown reduction, combo extension.
- **Is it in metadata?** ❌ **No** — this is the critical gap.
- **How to increase:** Grow voxels into coordinates the seed assigned as SKILL_POINT terrain (requires either luck or knowing your seed's terrain map via third-party tools or experimentation).
- **Measured as:** Float.

### 7.3 The Specialist vs Generalist Trade-off

Pruning depth-2+ branches removes skill SLOTS but does NOT change skill POINTS. Points come from terrain, not branches. Therefore:

- **Aggressive pruner** → fewer slots → same skill point budget concentrated in fewer moves → each move gets more investment → specialist / power fighter
- **Unpruned wild growth** → many slots → same budget spread thin → many weak moves → generalist / versatile fighter

Evaluating this trade-off from the current metadata is impossible without `Skill Points`. A marketplace buyer seeing "Skill Slots: 3" doesn't know if those 3 slots have 30 skill points worth of power (devastating specialist) or 0.5 skill points (nearly underpowered).

---

## 8. Spirit Affinity / Elemental Alignment

### 8.1 Current Documentation Status

There is NO dedicated spirit affinity or elemental alignment system documented in any document. The phrase "Has Spirit" in the metadata is a boolean awakening gate (tree age ≥ 60 days), not a stat or alignment type.

### 8.2 De Facto Elemental Analogs

The closest thing to elemental alignment is the **Species Triangle**, which functions as the rock-paper-scissors balance mechanism:

- Hardwood ≈ Earth/Stone (slow, immovable, absorbs damage)
- Evergreen ≈ Wind/Time (relentless, consistent, pressuring)
- Tropical ≈ Fire/Storm (explosive, fragile, burst)

This is expressed as the species class attribute already in the metadata.

### 8.3 What "Has Spirit" Actually Means

- `false`: either (a) age < 60 days — awakening not yet unlocked, OR (b) age ≥ 60 days but player has not yet performed the awakening action.
- `true`: tree age ≥ 60 days AND kijo has been awakened. Combat access unlocked.
- A kijo that becomes "reluctant" (morale-gated) remains `Has Spirit = true` — she just refuses to fight until morale recovers above 50.

### 8.4 Spirit Resonance Notification

When a tree first qualifies for a non-default technique (e.g., the first time Bound-and-Cut classification triggers), a "spirit resonance" notification fires server-side. This is noted in `KIJO-ARCHITECTURE.md` v0.2 §3.1 as a flag set by `TechniqueClassifier`. It is not a persistent NFT attribute.

---

## 9. Flower Guild Rank Threshold Discrepancy

**CONFLICT between documents — Jeremy must resolve this.**

| Source | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 | Tier 6 | Tier 7 |
|---|---|---|---|---|---|---|---|
| **NFT-METADATA-IMAGE-ARCH.md** (v5, current) | Seedling (0–19%) | Sapling (20–39%) | Pruned (40–59%) | Styled (60–74%) | Exhibition (75–89%) | Master Work (90–100%) | *(missing)* |
| **GDD v0.2** (`kijo-bonsai/docs/`) | Seedling (0–30%) | Sapling (30–50%) | Pruned (50–65%) | Styled (65–80%) | Exhibition (80–90%) | Master Work (90–95%) | **Living Painting (95–100%)** |
| **GDD v0.1** (`kijo/docs/`) | Common (0–30%) | Uncommon (30–50%) | Rare (50–65%) | Very Rare (65–80%) | Exceptional (80–90%) | Legendary (90–95%) | Theoretical (95–100%) |

**Problems with the current metadata doc:**
1. Numeric thresholds (0–19, 20–39, etc.) are different from GDD v0.2 (0–30, 30–50, etc.) — they're more aggressive, placing a 30% tree in "Sapling" vs "Seedling."
2. The metadata doc is missing the 7th tier "Living Painting" (95–100%), which exists in both GDD versions.
3. GDD v0.1 used rarity-language names (Common, Legendary) which v0.2 replaced with bonsai-culture names — the names are NOT in conflict, only the numbers and tier count.

**Recommendation:** The GDD v0.2 thresholds are the authoritative design intent. Update `NFT-METADATA-IMAGE-ARCH.md` to match: add "Living Painting" tier (95–100%) and align the numeric thresholds to GDD v0.2.

---

## 10. Document Version Conflicts

### 10.1 Old vs New GDD

Two GDD files exist:
- `kijo/kijo-bonsai/kijo/docs/GDD.md` — **v0.1, July 13 2026** — Pre-implementation, Godot-era design. Chain strategy "TBD." Status: superseded.
- `kijo/kijo-bonsai/docs/GDD.md` — **v0.2, July 23 2026** — Current web-era design. Ronin mainnet target. Status: authoritative.

**Old stat names (v0.1) → new stat names (v0.2):**
The v0.1 Phase 2 roadmap states: "Stat derivation engine (care history → Wisdom, Endurance, **Vitality, Specialization, Tempo**)". These terms were redesigned:
- Vitality → HP
- Specialization → Skill Points (the terrain budget for move power)
- Tempo (v0.1) → became species class combat-order property (SpeciesClass enum). NOT a StatSheet field. Tropicals resolve first, Evergreens second, Hardwoods last.
- Ki is NEW in v0.2 — leaf-voxel energy pool for special moves. No v0.1 predecessor.

> **Note:** GDD v0.2 §7.4 (Economy section) also contains remnant v0.1 stat names: Vitality = HP, Specialization = Skill Points in that context.

Do NOT use v0.1 stat names in any new code or documentation.

### 10.2 Engine API Version Discrepancy — `technique` Field

| Document | `StatSheet` includes `technique`? | Version |
|---|---|---|
| `kijo/docs/KIJO-ENGINE-API.md` | ❌ No | v0.1, July 15 |
| `kijo-bonsai/docs/KIJO-ENGINE-API.md` | ✅ Yes | v0.2, July 23 |
| `packages/shared/src/index.ts` | ❌ **No** | Production, July 26 |

The TypeScript implementation did NOT add `technique` to `StatSheet`. The metadata has a Technique trait. This means either:
1. `TechniqueClassifier.classify()` runs separately and is merged at the metadata layer (likely), OR
2. The TypeScript `StatSheet` needs to be updated to include `technique`.

This needs resolution before the metadata endpoint is built.

### 10.3 CareAction Types Added Since v0.1

The `wire` CareAction was added 2026-07-19. It appears in `shared/src/index.ts` but not in the v0.1 docs. The v0.2 architecture doc adds:
- `WireManager` to the engine package
- `wire / twine / weight / jin / landscape` as care action types
- Wire timing windows: 6–12 months to set, >12 months creates a scar
- `TechniqueClassifier` is new in v0.2 (not in v0.1)

> **Important:** twine, weight, jin, and landscape are defined in the C++ ENGINE-API spec but are NOT present in `packages/shared/src/index.ts` CareAction union. Technique classification and CareLogEntry replay must use only the 5 TypeScript-implemented types: water, rotate, prune, fertilize, wire.

### 10.4 attachmentY — R-ATTACHY Resolved

KIJO-TECH-SPEC.md v0.1 flagged "R-ATTACHY" as an open research question (how to correctly split depth-1 branches into ARM vs LEG for stat purposes). KIJO-TECH-SPEC.md v0.2 §4.6 documents the resolution via the **one-third rule** from real bonsai aesthetics. `shared/src/index.ts` implements it:

```typescript
// attachmentY: depth-1 primary = round4(trunk.length * 0.33) → LEG
//              depth-1 secondary = round4(trunk.length) → ARM
```

R-ATTACHY is closed in the production TypeScript. The proxy (branch ID order) is no longer needed.

---

## 11. Open Questions for Jeremy

**Q1 — Skill Points in metadata (CRITICAL)**  
`skillPoints` from StatSheet is not in the current metadata schema. It's the fighter's damage upgrade budget — arguably the second-most-important combat stat after HP. Should it be added? Suggested: `{ "display_type": "number", "trait_type": "Skill Points", "value": <float> }` placed after `Skill Slots`.

**Q2 — Technique in StatSheet vs separate (ACTIVE CODE CONFLICT)**  
The TypeScript `StatSheet` in `shared/src/index.ts` does NOT include `technique`, but the C++ engine API spec (v0.2) does, and the metadata has a Technique trait. How does Technique flow from TechniqueClassifier into the metadata endpoint? Added separately by the metadata builder, or should it be added to the TypeScript StatSheet?

**Q3 — Flower Guild Rank thresholds (CONFLICT)**  
NFT-METADATA-IMAGE-ARCH.md has different numeric thresholds than GDD v0.2 and is missing the 7th tier "Living Painting" (95–100%). Which thresholds are authoritative? The metadata doc or the GDD v0.2? Recommend aligning to GDD v0.2.

**Q4 — Species Sub-type values (OQ-3 — unresolved)**  
The possible values for `Species Sub-type` (e.g., "Twisted Trunk") and the function that maps seed → sub-type within a species class are not documented anywhere. The same gap exists for the seed → exact leaf color function. Who defines these tables and writes the derivation?

**Q5 — Bonsai Style in metadata?**  
The seed's favored bonsai style is not in the NFT metadata. GDD §4.2.1 says knowing real bonsai styles is a player skill advantage — implying the style should be discoverable (not freely given). Should it appear on the NFT (easier scouting) or stay off-chain (requires player discovery / third-party tools)?

**Q6 — Wire Count in metadata?**  
`Prune Count` is in the metadata. `Wire Count` is not, even though wire is now a care action and directly drives Technique classification. Should wire count be added for symmetry?

**Q7 — Fighting Game vs Turn-Based (UNRESOLVED IN DESIGN)**  
GDD v0.2 explicitly flags the fighting game model as the "leading candidate" and the turn-based model as "preserved for review." The choice significantly affects what metadata matters:
- Fighting game: Skill Slots + Skill Points are paramount (combo count and power budget per slot)
- Turn-based: species triangle and Ki regen rate dominate; ability base values matter more

This decision gates the combat engine implementation.

**Q8 — Structural stat multipliers (R14 — open research)**  
`TRUNK_HP_MULTIPLIER`, `ARM_POWER_MULTIPLIER`, `LEG_ENDURANCE_MULTIPLIER`, `LEAF_KI_MULTIPLIER` are explicitly unresolved in KIJO-TECH-SPEC.md. The example metadata (HP=959, Power=390, Endurance=170, Ki=294 for a 47-day Hardwood) provides calibration data, but the actual multiplier values are not committed anywhere. This must be resolved before combat balance can be tested.

**Q9 — Bonsai style parametric curves (R4 — HIGH priority)**  
Only 4 of 8 bonsai styles have partial parametric curve definitions (Chokkan, Kengai, Moyogi, Bunjin). Shakan, Fukinagashi, Hokidachi, and Sekijoju are undefined. The terrain bonus system — and therefore ALL stat derivation for those style regions — cannot be fully implemented until all 8 are specified.

**Q10 — How does seed → favored bonsai style?**  
KIJO-TECH-SPEC.md §3.2 flags this as open: "Hash of seed → style index? Or seed → blend weights?" A single discrete style vs a weighted blend (e.g., 70% Moyogi + 30% Shakan) has significant implications for how learnable terrain scouting is and how the Match % calculation works.

**Q11 — Technique trait in Phase 1 — TechniqueClassifier export gap**  
TechniqueClassifier does not exist in `packages/engine/src/index.ts` (zero TypeScript references). Phase 1 NFTs cannot emit a Technique trait without building TechniqueClassifier from scratch. Additionally, jin/twine/weight/landscape CareAction types needed as input are missing from `shared/src/index.ts`. Full architect pass required before implementation.

**Q12 — Image URL format conflict**  
Image URL conflict — `NFT-METADATA-IMAGE-ARCH.md` uses no extension (`https://api.kijo.xyz/nft/image/42`). `KIJONSAI-CONTRACT-ARCH.md` §12.1 uses `.png` extension. Resolve before building nft-metadata Edge Function. `NFT-METADATA-IMAGE-ARCH.md` description ('format-agnostic, permanent') suggests no extension is correct.

---

## Source Files Read

| File | Version | Date | Status |
|---|---|---|---|
| `kijo-bonsai/docs/GDD.md` | v0.2 | 2026-07-23 | Authoritative |
| `kijo-bonsai/docs/KIJO-ENGINE-API.md` | v0.2 | 2026-07-23 | Authoritative |
| `kijo-bonsai/docs/KIJO-TECH-SPEC.md` | v0.2 | 2026-07-23 | Authoritative |
| `kijo-bonsai/docs/KIJO-ARCHITECTURE.md` | v0.2 | 2026-07-23 | Authoritative |
| `kijo-bonsai/docs/NFT-METADATA-IMAGE-ARCH.md` | v5 | 2026-07-27 | Current schema |
| `kijo-bonsai/docs/KIJONSAI-CONTRACT-ARCH.md` | v0.3 | 2026-07-22 | Authoritative |
| `kijo-bonsai/docs/KIJO-PRD.md` | v0.2 | 2026-07-23 | Authoritative |
| `kijo-bonsai/docs/PHASE1-RONIN-ARCH.md` | — | 2026-07-22 | Superseded |
| `kijo-bonsai/docs/ARCH-GUEST-MODE.md` | v0.1 | 2026-07-22 | Phase 1 feature |
| `kijo-bonsai/kijo/docs/GDD.md` | v0.1 | 2026-07-13 | Superseded |
| `kijo-bonsai/kijo/docs/KIJO-ENGINE-API.md` | v0.1 | 2026-07-15 | Superseded |
| `kijo-bonsai/kijo/docs/KIJO-TECH-SPEC.md` | v0.1 | 2026-07-14 | Superseded |
| `kijo-bonsai/kijo/docs/KIJO-ARCHITECTURE.md` | v0.1 | 2026-07-15 | Superseded |
| `packages/shared/src/index.ts` | production | 2026-07-26 | Ground truth |

---

*This document is research output only. No code was changed during this session.*
