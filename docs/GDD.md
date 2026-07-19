# KIJO — Game Design Document

**Version:** 0.1 (Draft)
**Date:** July 13, 2026
**Author:** Jeremy Gordon / Kingdom Koders
**Status:** Pre-Production

---

## 1. Vision

Kijo is a dual-loop blockchain game where players grow bonsai trees over real time, then awaken the tree spirits (kijo) within them for tactical combat. The bonsai's care history deterministically generates the kijo's stats, appearance, and fighting style. No two kijo are alike because no two trees are cared for the same way.

The core thesis: **patience is power.** A tree grown with intention over months produces a fundamentally stronger spirit than one speed-grown with fertilizer. The art, the stats, and the provenance are the same object.

**Target Audience:** Intersection of idle/casual sim players (care loop) and tactical PvP players (combat loop). Delegation bridges these into a single economy.

**Chain Strategy:** Chain-portable from day one. Initial deployment TBD. Smart contracts designed for EVM compatibility with no chain-specific dependencies.

---

## 2. World & Lore

### 2.1 Origin — The Scattered Seeds

Yama-no-Kami, the mountain god of forests and harvests, rode through the glades between the mortal world and the spirit realm. In his passing, seeds fell from his satchel — divine seeds carrying the potential for spirits within them. Each seed holds a fragment of the mountain god's domain: the patience of stone, the fury of storms, the quiet growth of roots through rock.

A penjing master named **Gu Ahao** found the seeds scattered across the glade floor. Where any other mortal would have seen ordinary seeds, Gu Ahao recognized their divine origin — because he had spent his life reading the language of bark and branch. A revolutionary figure from Suzhou, he had invented the "tied and cut" technique: using iron wire and precise pruning to recreate the brushstrokes of classical landscape paintings on living trees. The Flower Guild adopted his methods as the ultimate standard for grading luxury trees. He was the greatest living authority on how a tree should grow.

**Gu Ahao** is the game's storefront. He does not sell seeds as a merchant — he offers them as a master seeking students. He knows exactly what these seeds are and what sleeps inside them. He recognized the divine nature because his entire craft was the art of shaping living wood into its ideal form. The seeds are his test: can mortal hands grow what a god planted? His "tied and cut" technique — iron wire and precise pruning — IS the game's pruning mechanic. Players are literally learning the master's own methods.

The ideal growth path in the stat terrain is not arbitrary math — it is the brushstroke pattern Gu Ahao established as the definition of mastery. When the match percentage system measures how closely a tree matches its ideal form, it is asking: how close did this caretaker come to the standard the master set? The Flower Guild graded luxury trees against his techniques. The game grades kijonsai the same way, algorithmically, verifiably, on-chain.

### 2.2 The Kijo

When a mortal tends a divine seed with patience and intention, the tree that grows becomes home to a kijo — a fierce feminine tree spirit. She is not summoned or created. She emerges. The tree is her body, her source, her sanctuary. Her strength is the tree's strength. Her scars are where the caretaker's shears cut. Her crown is the canopy the caretaker shaped.

A kijo does not serve her caretaker — she partners with them. Neglect the tree and she withdraws. Send her into battle recklessly and she grows reluctant. Tend the tree with devotion and she fights with everything the tree has grown.

### 2.3 The Two Potions (SLP)

When a kijo loses battles or suffers from neglect, her spirit becomes wrathful — she is, after all, a kijo. Two potions share the SLP name but serve different roles, different users, and different economies.

#### Soothing Leaf Potion (Caretaker's SLP)

Brewed by caretakers from the byproducts of tree maintenance:

- **Bark shavings** from pruning (pruned branch material)
- **Dried petals** from seasonal leaf-fall (collected passively each autumn)
- **Root clippings** from repotting (periodic maintenance action)
- **Spring dew** collected during the first days of each spring cycle

**Account-locked. Non-tradeable. Non-transferable.** The caretaker brews it, the caretaker uses it, exclusively on trees they tend. It is free to produce (the ingredients come from care activity) and cannot be sold, speculated on, or hoarded for market manipulation.

Soothing Leaf Potion provides **full morale restoration** over time. Applied to the tree, it calms the kijo's spirit through the care bond. This is the real cure — a kijo soothed by her caretaker's potion returns to full fighting willingness.

#### Smooth Love Potion (Fighter's SLP — the Ronin Token)

**Smooth Love Potion IS the Ronin SLP token.** Fighters spend real SLP to partially recover morale — enough to squeeze out a few more battles before the kijo demands real care. It does NOT fully restore morale. It is a band-aid, not a cure. **Approved by Sky Mavis and the Ronin team.**

- Restores ~20–30% morale per use
- Diminishing returns: second use in the same recovery window restores less (~15%), third even less (~8%)
- Cannot raise morale above 65% (full cap requires caretaker's Soothing Leaf Potion)
- **Burned on use** — SLP is permanently removed from the Ronin supply
- Acquired by fighters through normal Ronin market channels (DEX, marketplace, tournament prizes)

**Economic design — Kijo as an SLP sink:**

Kijo does not mint SLP. It only burns it. Every battle loss across the entire playerbase that triggers a morale recovery burns real SLP from the Ronin token supply. This is deflationary pressure on a token that has historically suffered from oversupply and inflation.

- Demand scales directly with Kijo combat activity — more fights = more losses = more SLP burned
- Diminishing returns prevent brute-force morale farming — eventually you MUST wait for your caretaker
- The caretaker remains essential: SLP caps morale at 65%, only the caretaker's Soothing Leaf Potion reaches 100%
- Sky Mavis benefits because Kijo adds real utility demand to SLP without minting new supply
- Kijo benefits because SLP has existing liquidity, exchange listings, and recognition from day one — no cold-start token problem

**Why this works where Axie's SLP failed:**

In Axie, SLP was both the faucet (earned by grinding) AND the sink (spent on breeding). When breeding demand dropped, the faucet kept running and SLP inflated to near-zero. In Kijo, SLP is ONLY a sink — Kijo never emits SLP, only consumes it. The token's supply-side economics are entirely outside Kijo's control (they belong to the Ronin ecosystem). Kijo contributes pure demand. That's the cleanest possible relationship with an existing token.

**Implementation:** Soothing Leaf Potion (caretaker's version) remains a **server-side in-game item** — non-tradeable, account-locked, never touches the chain. The two potions share a name but live in completely separate systems. Only Smooth Love Potion is on-chain (as the existing Ronin SLP ERC-20 token, burned via a standard transfer-to-dead-address or approved burn mechanism).

### 2.4 The Glades

The world of Kijo is the glade — the liminal space between mountain and forest where Yama-no-Kami's seeds fell. Players' groves exist within the glade. Combat takes place at glade crossings where kijo territorial boundaries overlap. The glade is not a map to explore — it is the ambient setting that frames every interaction.

---

## 3. Core Loop 1 — Bonsai Care

### 3.1 Planting

Players begin by selecting a **species** and **seed**. The seed is a deterministic random number that governs all future growth patterns. Two players with the same species and seed who make identical care decisions will produce identical trees. The seed is assigned at mint.

**Species Triangle:**

| Species Class | Growth Profile | Combat Style | Example Species |
|---|---|---|---|
| Hardwood | Slow, thick, dense branching | Brawler — absorbs hits, counters | Oak, Maple, Walnut, Elm |
| Evergreen | Steady year-round, no seasonal loss | Pressure — relentless advance | Pine, Cedar, Juniper, Spruce |
| Tropical | Explosive bursts, fragile if neglected | Burst — fast damage, glass cannon | Ficus, Jade, Bougainvillea, Banyan |

Species is a permanent choice. It determines the growth curve, seasonal behavior, bark and leaf aesthetics, and the kijo's base fighting style. It does not determine power ceiling — that comes from care.

### 3.2 Daily Care Actions

Care operates on a **real-time day cycle** (24-hour clock, adjustable via subscription — see Section 7). Each day the tree ticks forward, moisture decays, and growth occurs based on current conditions.

**Free Actions (unlimited):**

- **Water** — Increases moisture by a fixed amount. Moisture decays naturally each day. Optimal range: 30–65%. Below 20%: drought stress (growth rate drops to ~15%, health declines). Above 80%: overwatered (growth rate drops to ~40%, health declines). The skill is maintaining the sweet spot without obsessive attention.

- **Rotate** — Rotates the tree 90°. Simulates light exposure. Affects directional growth bias (branches on the "sun side" grow slightly faster). Regular rotation produces balanced canopy. Neglecting rotation produces asymmetric growth — which is not necessarily bad. Some bonsai styles (slant, windswept) deliberately grow asymmetric.

**Premium Actions (consumable, purchased) — Gu Ahao's "Tied and Cut" Toolkit:**

The master's two techniques are the caretaker's two precision tools. Cut removes. Tie redirects. Together they are how a kijonsai is sculpted from raw growth into deliberate form.

- **Prune / Shears (cut)** — 3–5 uses per shears item. Permanently removes a branch and all sub-branches. A prune scar remains visible on the trunk. Pruned branches never regrow. Pruning redirects growth energy to surviving branches (they grow faster/thicker after a cut). This is destructive precision — you lose voxels (lose raw stats) but gain focused growth in the surviving structure. Premium because every cut is permanent and reshapes all future growth. The "cut" in tied-and-cut.

- **Wire (tie)** — 3–5 uses per wire item. Permanently bends a branch's growth angle without removing it. The branch keeps all its voxels (no stat loss) but its future growth direction changes — it now grows into a different region of the 256³ stat terrain, picking up different terrain bonuses. This is constructive precision — you sacrifice nothing but change where the tree aims. A caretaker who knows their seed's terrain uses wire to steer a promising branch toward a high-value stat cluster it would have missed naturally. The "tied" in tied-and-cut.

  Wire constraints: can only bend branches up to ~45° from their natural angle (more extreme bends would snap a real branch). The bend is permanent — the branch grows in the new direction from that point forward. Wire marks remain visible on the branch (thin line wrapping the bend point, like real bonsai wire). Cannot wire the trunk (too thick). Cannot wire depth-2+ branches (too thin — they'd break). Depth-1 branches only.

  Stat implications: wire doesn't change total voxel count (same raw power), but it changes WHICH coordinates future voxels fill. A wired branch might move from a NEUTRAL-heavy terrain region into an HP-heavy one — or vice versa. The caretaker is navigating the stat terrain by steering the tree's growth direction. Shears navigate by removing obstacles. Wire navigates by changing course.

- **Fertilize (Fertilizer)** — 1–3 uses per fertilizer item. Provides a multi-day growth multiplier (~1.7x for 5 days). Cooldown of 8 days prevents stacking. Fertilizer accelerates growth without changing its character — the tree grows faster but in the same pattern it would have grown anyway. Over-fertilizing (if cooldown is bypassed via multiple items) causes "burn" — health penalty.

- **Notch (future action)** — the horticultural inverse of pruning. Where shears remove a branch to redirect growth, notching *forces* a new branch to sprout at a chosen point on the trunk (real bonsai artists notch the bark near a dormant bud to wake it). Mechanically: the caretaker selects a coordinate and forces growth there, letting a master deliberately steer the tree toward high-value regions of the seed's stat terrain instead of hoping growth wanders there. This is the deepest expression of caretaker skill — a caretaker who has learned their seed's terrain notches exactly where the valuable clusters sit. Constrained by real bonsai rules: cannot notch the bare lower third of the trunk, cannot notch where a branch already exists. A premium precision action. **Deferred — not in the current prototype; tracked for the care-loop feature set.**

**The full toolkit spectrum:**

| Tool | Action | Voxels | Growth Direction | Cost | Skill Ceiling |
|---|---|---|---|---|---|
| Water | Sustain | Indirectly (enables growth) | No control | Free | Low — just stay in the sweet spot |
| Rotate | Bias | No change | Slight light-side bias | Free | Low-medium |
| Fertilize | Accelerate | More (faster growth) | Same direction | Premium | Low — timing only |
| Wire (tie) | Redirect | No change | Bend up to 45° | Premium | High — requires terrain knowledge |
| Shears (cut) | Remove | Lose (branch deleted) | Redistribute to survivors | Premium | Very high — permanent, irreversible |
| Notch (future) | Force | New branch | Chosen point | Premium | Highest — terrain mastery required |

**Passive Systems:**

- **Seasonal Cycle** — 30 game-days per season (Spring → Summer → Autumn → Winter). Hardwoods lose leaves in winter and produce dramatic autumn foliage. Evergreens maintain year-round foliage. Tropicals grow fastest in summer, stall in winter. Season affects growth rate, leaf color, and visual presentation.

- **Structural Aesthetics** — growth follows classical bonsai form. The lowest main branch emerges around one-third up the trunk, leaving the lower third bare (the "exposed trunk" that conveys maturity). The trunk tapers thickest-at-base to thinnest-at-apex, and lower branches are thicker than upper ones. These rules aren't cosmetic: attachment height determines the arm/leg morphology split (lower branches → legs, upper → arms), and the deliberately thick low branches accumulate more voxels, concentrating stat contribution where classical bonsai places visual weight. See KIJO-TECH-SPEC.md §4.6.

- **Health** — 0–100 scale. Tracks cumulative care quality. Good moisture maintenance and regular attention increase health slowly (+0.8/day). Poor conditions degrade health (-1.5/day). Health directly maps to the kijo's HP pool (see Section 4). Health recovers slowly, so sustained neglect creates a real deficit that takes time to repair.

- **Age** — Real-time counter from planting. Age drives trunk thickening, bark texture maturation, and the kijo's Wisdom/Fight IQ stat. There is no shortcut to age. A 365-day tree is fundamentally more experienced than a 30-day tree regardless of all other factors.

### 3.3 Growth Algorithm

Growth is deterministic from: `seed + species + care_log`. The care log is a timestamped sequence of every action taken. Given the same inputs, the tree reconstructs identically.

Per-day growth tick:

1. Compute growth rate from moisture, health, fertilizer state, and species modifiers.
2. All non-pruned tip branches (branches with zero living children) extend in length.
3. Extension amount = base_rate × species_modifier × condition_modifier × depth_falloff.
4. Fork probability evaluated per tip: decreases with depth (deeper branches fork less), increases with branch length past threshold, modified by conditions.
5. Fork creates 1–2 child branches at angles influenced by species (hardwoods: wider angles, tropicals: tighter clusters) and rotation state (light-side bias).
6. Inner branches (non-tips) thicken proportionally to the number of living descendants.
7. Trunk thickens every tick regardless (representing root mass accumulation).

Max branching depth: 6 (prevents infinite bushiness; pruning resets local depth, allowing controlled regrowth).

### 3.4 Multi-Tree Management

Players may own and care for up to **5 trees simultaneously** (expandable via subscription). Each tree has independent state, species, and care history. This enables:

- Diverse stable composition for combat (one hardwood brawler, one tropical burst, one evergreen pressure)
- Risk distribution (one tree can be in poor health without losing everything)
- Specialization through different pruning philosophies across trees

---

## 4. Core Loop 2 — Kijo Combat

> ⚠️ **REVIEW NEEDED:** Combat system is first-draft. Stance interactions, damage formulas, Wisdom scaling thresholds, skill point economy, and Ki resource pacing all require playtesting and balance iteration before locking. The voxel-to-stat mapping (Section 4.2) and skill point distribution model (Section 4.3) are directionally correct but specific values (0.1% per voxel, 4 voxels per skill point) are placeholder tuning numbers.

### 3.1 Awakening

When a tree reaches minimum maturity (e.g., 60 game-days), the player can **awaken** its kijo — a tree spirit that manifests for combat. The kijo's form is generated from the tree's current state. The tree remains planted; the kijo emerges to fight and returns to its tree between battles.

Awakening is not permanent unlocking — it's a capability that can be *lost*. A kijo that loses too many consecutive battles becomes reluctant (see Section 4.5). The caretaker must restore the tree's health and provide extra care to re-motivate the spirit.

### 4.2 Stats — Dual-Layer System

Kijo stats come from two layers that stack: **structural stats** from the tree's physical morphology, and **terrain bonuses** from the seed's hidden voxel coordinate map.

#### Layer 1: Structural Stats (Readable from Silhouette)

These are directly determined by the tree's physical shape. You can read the broad matchup by looking at the kijo.

| Body Region | Measurement | Stat | Combat Role |
|---|---|---|---|
| Trunk | Thickness | **HP** | How much damage she can take |
| Lower depth-1 branches (legs) | Thickness | **Endurance** | Absorb hits without staggering, movement stamina |
| Upper depth-1 branches (arms) | Thickness | **Power** | Raw striking damage |
| Depth-2+ branches | Count | **Skill Slots** | Number of programmable special moves |
| Canopy (all leaf matter) | Total volume | **Ki** | Energy pool for executing special moves |

**Ki is the canopy stat.** Every leaf voxel contributes to the Ki pool. Massive canopy = deep energy reserves = more specials per fight. Pruned canopy = limited Ki = must choose carefully when to spend. Ki regenerates slowly during combat, so a large pool means sustained pressure while a small pool means burst-then-conserve.

These structural stats are always visible. A thick-trunked, heavy-armed kijo with sparse canopy reads as: high HP, high Power, low Ki — she hits hard but runs out of special move energy fast. A thin-trunked kijo with enormous canopy reads as: low HP, massive Ki — glass cannon who throws specials all day but folds to pressure.

#### Layer 2: Terrain Bonuses (Hidden, Seed-Determined)

Every coordinate in the 256³ grid has a **pre-assigned bonus** determined by the tree's seed. When a voxel is filled at that coordinate — regardless of whether it's trunk, branch, or leaf — the kijo gains that coordinate's bonus ON TOP of the structural stat.

Terrain bonuses include: `+0.1% HP`, `+0.1% Power`, `+0.1% Endurance`, `+0.1% Ki`, `+0.25 skill points`.

**This means a leaf voxel always contributes Ki (structural), AND might also contribute +0.1% HP if its coordinate was assigned that bonus by the seed.** The two layers stack. A canopy that happens to grow into an HP-rich terrain region produces a kijo with high Ki AND unexpectedly high HP — the "tanky caster" that nobody saw coming.

Similarly, trunk voxels always contribute HP (structural), but a trunk growing through a Power-rich terrain region stacks bonus Power on top. The seed makes every kijonsai's stat profile unique even when the shapes are similar.

**How it works:**

1. At mint, the seed generates a deterministic stat map across all 16.7 million coordinates.
2. As the tree grows and fills voxels, each coordinate contributes its terrain bonus to the kijo's stat sheet — layered on top of whatever structural stat that voxel type already provides.
3. The terrain map is never revealed directly to the player but IS deterministic and verifiable from the seed. Third-party tools could map it. Skilled caretakers learn their terrain through experimentation.

**What each layer provides:**

| | Structural Stats | Terrain Bonuses |
|---|---|---|
| **Source** | Tree morphology (thickness, volume, count) | Seed's coordinate map |
| **Visible?** | Yes — readable from silhouette | No — requires seed data to calculate |
| **Controllable?** | Yes — through pruning, care, growth direction | Partially — growth direction explores terrain, but assignments are hidden |
| **Purpose** | Establishes the kijo's archetype (tank, glass cannon, bruiser) | Adds depth and surprise — the hidden edge that rewards exploration |

**Scouting implications:**

A competitor can see an opponent's Kijonsai NFT and verify its voxel coordinates. With the seed, they can calculate exact stats (both layers). They can also see which UNFILLED coordinates near the tree's growth frontier contain valuable terrain bonuses — predicting how the kijo might strengthen next. Deep scouting rewards analysis.

**Caretaker skill expression:**

The caretaker plays two games simultaneously:
- **Shape the tree** for structural stats — visible craftsmanship. Grow thick trunk for HP, let canopy flourish for Ki.
- **Explore the terrain** for hidden bonuses — blind discovery. Steer growth toward regions where the seed placed high-value bonuses.

The casual player does the first. The master does both. Both produce real combat value.

### 4.2.1 Bonsai Styles as Stat Templates

The high-value zones in the stat terrain are not randomly scattered — they are clustered around **traditional bonsai growth forms**. Real-world bonsai culture has defined growth styles developed over centuries. Each style fills a distinct region of 3D space. The stat terrain maps its richest clusters to these regions.

Each seed has one or more **favored styles** — styles whose corresponding spatial zones contain the densest stat bonuses. A caretaker who recognizes which style their seed favors and prunes toward it is rewarded with superior stat efficiency. **Knowing real bonsai culture makes you a better player.**

| Bonsai Style | Japanese Name | Growth Pattern | Stat Profile When Matched |
|---|---|---|---|
| Formal Upright | Chokkan | Straight trunk, symmetrical taper, balanced branches | Balanced across all stats — the "all-rounder" |
| Informal Upright | Moyogi | Curved trunk, natural asymmetry, flowing movement | High Ki + moderate Attack — fluid ability-focused |
| Slant | Shakan | Trunk grows at 60–80° angle, offset canopy | High Attack + moderate Stability — aggressive but grounded |
| Cascade | Kengai | Trunk sweeps downward past the pot rim | High Attack + high Ki, low Stability — maximum offense, precarious |
| Windswept | Fukinagashi | All branches pushed to one side, weathered appearance | High Stability + high Defense — the survivor, built to endure |
| Literati | Bunjin | Minimal branches, thin elegant trunk, sparse canopy | Extreme Ki + high Skill Points, low HP — glass cannon specialist |
| Broom | Hokidachi | Straight trunk, dense dome-shaped canopy | High HP + high Defense — the wall, dense and balanced |
| Root Over Rock | Sekijoju | Exposed roots gripping a rock, dramatic base | Extreme Stability + moderate HP — immovable anchor |

**How this interacts with species:**

Each species class has natural growth tendencies that align with certain styles:

- **Hardwoods** naturally grow toward Chokkan/Hokidachi forms (upright, dense). A hardwood seed that favors Broom style is playing to species strengths — double stacking durability.
- **Evergreens** naturally tend toward Moyogi/Fukinagashi (flowing, windswept). An evergreen seed favoring Windswept is the ultimate pressure fighter — relentless and unkillable.
- **Tropicals** naturally push toward Kengai/Bunjin (dramatic, sparse). A tropical seed favoring Cascade is a glass cannon's glass cannon — devastating burst with no safety net.

But cross-style builds are possible and create unique fighters. A hardwood grown in Literati style fights nothing like a standard hardwood. A tropical forced into Broom form is a burst fighter trapped in a tank's body — unusual and hard to read.

**Caretaker skill expression:**

The deepest caretakers will:
1. Identify their seed's favored style(s) through early growth observation
2. Prune deliberately to steer the tree toward the richest stat zones
3. Recognize when a seed favors an unexpected style for its species and adapt
4. Understand that fighting the seed's natural preference produces a weaker but potentially more surprising kijo

This rewards knowledge of real bonsai aesthetics. Players who study Chokkan, Moyogi, Kengai — who understand why a slant style looks and feels different from a formal upright — have a genuine competitive advantage. The game teaches real bonsai culture as a side effect of competitive optimization.

### 4.2.2 The Ideal Form — Asymptotic Mastery

Each seed's voxel grid contains a **theoretical perfect growth pattern** — the exact set of coordinates that, if filled, would maximize every stat cluster for that seed's favored style. This ideal form exists mathematically and is deterministically verifiable from the seed.

**It is nearly impossible to achieve by design.**

This mirrors real bonsai mastery. The ideal form exists in the practitioner's mind, but living wood, seasonal variance, and the permanence of every cut ensure that perfection is approached but never reached. A bonsai master spends decades closing the gap. A Kijo caretaker does the same over months.

**Why perfection is unreachable:**

- **Growth is organic.** The L-system growth algorithm fills voxels based on branching rules, not manual placement. The caretaker influences direction through pruning and rotation but cannot place individual voxels.
- **Pruning is permanent.** One cut at Day 50 that sends growth 3° off the ideal angle compounds over 300 days into significant deviation. There is no undo.
- **Conditions introduce variance.** Moisture fluctuations, health dips, seasonal timing shifts, missed watering days — all introduce micro-deviations in growth direction that accumulate.
- **Knowledge is incomplete.** The stat terrain is hidden. Caretakers learn their seed's ideal through observation and experimentation, not from a revealed blueprint. Discovery takes time and carries risk.

**The Flower Guild Rank — the quality metric:**

Each tree has a calculable **match percentage**: the overlap between its actual filled voxels and its seed's ideal form. This is a publicly visible metric on the NFT, displayed as a **Flower Guild Rank** — the same grading system the historical Flower Guild used to judge luxury penjing, now applied algorithmically by Gu Ahao's standard.

| Match % | Flower Guild Rank | What It Means |
|---|---|---|
| 0–30% | **Seedling** | Minimal care, random growth. The guild wouldn't display it. |
| 30–50% | **Sapling** | Decent care but no style awareness. A student's first attempt. |
| 50–65% | **Pruned** | Good caretaker who recognized the seed's style. Intentional cuts visible. |
| 65–80% | **Styled** | Skilled deliberate pruning toward the ideal. The guild would notice. |
| 80–90% | **Exhibition** | Master-level care over extended time. Worthy of display at a guild fair. |
| 90–95% | **Master Work** | Near-perfect execution, hundreds of days of precise care. Gu Ahao would approve. |
| 95–100% | **Living Painting** | The asymptote. A tree that recreates the brushstrokes of classical landscape painting on living wood — the very thing Gu Ahao invented. Effectively impossible by design. |

The rank names trace the journey from raw beginner to the master's own standard. "Living Painting" at the top is deliberately unreachable — it's what Gu Ahao himself achieved, the thing the Flower Guild held as the ultimate. A player who reaches "Exhibition" has accomplished something genuinely rare. "Master Work" is the stuff of legends. Nobody reaches "Living Painting," and that's the point — the master's standard is the horizon you chase.

**Economic implications:**

Flower Guild Rank creates a natural rarity gradient that the market prices automatically. A **Styled** Day 300 oak is objectively, verifiably superior to a **Sapling** Day 300 oak — and the difference is entirely the caretaker's skill, not RNG. Higher-ranked trees command premium prices because the skill required to earn the rank is rare and the time invested is irreplaceable. The rank displays on the NFT alongside the tree visual — buyers read it instantly.

**Competitive implications:**

Two kijo with identical voxel counts but different Flower Guild Ranks have different stat profiles. The higher-ranked kijo has its stats concentrated in the seed's optimal zones. The lower-ranked kijo has stats scattered across suboptimal coordinates. Same total power, but the ranked kijo's stats align with its style — coherent and synergistic. An **Exhibition** kijo fights like a composed master. A **Sapling** kijo fights sloppy, its power wasted on unfocused growth.

**The mastery fantasy:**

This system creates the long-term engagement loop that bonsai culture itself runs on: the pursuit of an ideal that recedes as you approach it. A caretaker who hits **Pruned** and sees how much stronger their kijo could be at **Styled** has a clear, self-motivated goal that no content update needs to provide. The game generates its own endgame from the gap between real and ideal — the same gap Gu Ahao spent his life closing.

**Exhibition Events (future feature):**

Periodic events where trees are judged purely on Flower Guild Rank — no combat. Caretakers compete on craftsmanship: highest match %, best taper adherence, most faithful style execution. Prizes for rank thresholds. This is the direct descendant of the historical Flower Guild fairs where guild masters judged trees and awarded recognition. It gives pure caretakers (who never fight) their own competitive outlet, validating the care loop as a standalone game. The grading is algorithmic, verifiable, and tied to the standard Gu Ahao established — not subjective jury opinion.

**Wisdom (unchanged):**

Wisdom remains derived from tree age in days, NOT from voxels. Time cannot be manufactured. A 400-day tree with 20,000 voxels has higher Wisdom than a 100-day tree with 40,000 voxels. Wisdom governs Fight IQ: pattern recognition, counter timing, ability to read the opponent's next move.

### 4.3 Skill Points — Special Move Combos

> ⚠️ **DIRECTION SHIFT:** The following reframes skill points as fighting game combo slots. This likely supersedes the turn-based stance system in Section 4.4. Both are preserved during review. The fighting game direction is the current leading candidate.

**Fighting Game Model:**

Combat plays like a 2D fighting game (Street Fighter / Mortal Kombat feel) with matchmaking infrastructure similar to Axie. Real-time input, directional combos, mechanical execution skill.

**Controls:**
- Directional pad (left, right, up, down)
- Action buttons (strike, kick, guard, grab)
- Special moves triggered by directional input combinations + action button

**Depth-2 branches = special move slots.**

Each depth-2+ sub-branch (finger, toe, claw) in the kijo's morphology represents one programmable special move. The fighter defines the input combination for each slot before battle.

Example moveset for a kijo with 6 depth-2 branches:

| Move Slot | Input Combo | Effect | Voxel Count | Power |
|---|---|---|---|---|
| Root Strike | ← ← ↓ ↑ + kick | Roots erupt from ground under opponent | 45 voxels | High |
| Vine Grapple | ← ← ↑ ↓ + grab | Roots bind opponent's feet, 2-sec hold | 38 voxels | Medium-High |
| Canopy Slam | ↓ ↓ → + strike | Overhead branch smash | 28 voxels | Medium |
| Bark Shield | ← ↓ ← + guard | Temporary armor boost | 22 voxels | Low-Medium |
| Thorn Burst | → → → + kick | Rapid thorn projectile spray | 15 voxels | Low |
| Leaf Storm | ↑ ↓ ↑ + strike | Area-of-effect leaf slash | 12 voxels | Low |

**Key design points:**

- **More depth-2 branches = more special move slots.** A wild unpruned kijo might have 10+ moves. A heavily pruned specialist might have 3 devastating ones.
- **Voxel count per branch = move power.** A thick long claw (45 voxels) produces a move far stronger than a thin twig (12 voxels). Pruning concentrates voxels into fewer, stronger remaining branches.
- **Fighters program their own combos.** The input sequence for each special move is set by the fighter, not generated. Fighters can design inputs that flow naturally from their playstyle. A grappler might cluster their combos around ← ← sequences. A rushdown player might favor → → chains.
- **Combo complexity = risk/reward.** Longer input sequences could unlock bonus damage multipliers. A 3-input combo does base damage. A 5-input combo does 1.5x but is harder to execute and has a longer wind-up (opponent can interrupt).
- **Execution matters.** The move exists in the moveset but the fighter has to actually INPUT the combo during real-time combat. A deep moveset is useless if the fighter can't execute under pressure. This is where fighter skill expression lives — it's not menu selection, it's hands.

**Skill points in this model:**

- Skill points come from the **voxel stat terrain** (Section 4.2). When a filled voxel lands on a coordinate the seed assigned as "+0.25 skill points," the kijo earns skill points. Skill points are part of the same stat pool as HP, Attack, Defense — determined by which coordinates the tree grows into, not by branch structure.
- **Depth-2 branch count determines skill SLOTS** — how many special moves the kijo can equip. Each depth-2 branch = one programmable combo slot. A kijo with 8 depth-2 branches has 8 move slots. One with 3 has 3.
- The fighter distributes the total skill point budget across available slots. More slots = thinner spread. Fewer slots = concentrated power per move.
- A kijo with 8 slots but a small skill point budget has many weak moves (versatile but shallow). A kijo with 3 slots and a large budget has few devastating moves (specialist).
- Each skill point invested in a slot can modify: damage scaling, effect duration, cooldown reduction, or unlock combo extensions (follow-up chains from the base input).
- Pruning depth-2 branches removes slots (fewer moves) but does NOT change the skill point budget (those come from voxel terrain, not branches). The remaining slots get more points available per slot.

**How this maps to the species triangle:**

- **Hardwoods** — slow walk speed, heavy hits, super armor on startup of specials (can take a hit while executing). Grapplers and brawlers. Their specials have long wind-ups but deal massive damage and can't be interrupted by light attacks.
- **Evergreens** — medium speed, reliable frame data, moves come out fast with short recovery. Pressure characters. Their specials chain naturally into each other — one combo flows into the next. Relentless.
- **Tropicals** — fast walk speed, explosive damage, but moves have long recovery on whiff. Rushdown and glass cannon. Their specials are fast and devastating but missing leaves them wide open. High risk, high reward.

**Wisdom in fighting game context:**

- High Wisdom = the kijo auto-blocks mixups at a rate proportional to age. At 100 days, she auto-blocks 10% of ambiguous attacks. At 365 days, 35%. At 500 days, 50%. This represents the old master who has "seen everything" — not a guaranteed defense, but a statistical edge that compounds over a long set.
- Wisdom also affects kijo recovery speed after being knocked down. Older spirits get up faster — they've been hit before.

**Tag team integration:**

- Tag moves become special combo inputs. ← ← + tag = swap with recovery. → → + tag = partner rushes in with an attack (assist). The tag system uses fighting game conventions naturally.
- 2v2 and 3v3 enable team combos where one kijo's special sets up a tag partner's follow-up. A root grapple from the anchor kijo into a canopy slam from the tagged-in partner. Team synergy comes from complementary movesets.

### 4.4 Combat System

Turn-based tactical combat. Each round:

1. **Stance selection** — each kijo commits to a stance:
   - **Root** (defensive) — reduces incoming damage by Defense%, heals HP based on Stability. Cannot attack.
   - **Strike** (offensive) — commits an ability from the skill set. Damage = Attack × ability potency × skill point investment. Exposed to counters.
   - **Guard** (reactive) — if opponent strikes, auto-counter with reduced damage. If opponent roots or guards, nothing happens.
   - **Reach** (aggressive) — extends a limb for a longer-range attack. Higher damage than Strike but longer recovery (skips next turn if it misses). Ki-intensive.

2. **Resolution order** — determined by Tempo (species class). Tropicals resolve first, Evergreens second, Hardwoods last. Ties broken by Wisdom.

3. **Stance interactions:**

| Attacker | Defender: Root | Defender: Strike | Defender: Guard | Defender: Reach |
|---|---|---|---|---|
| **Root** | Both heal | Defender hits, attacker heals | Both neutral | Defender hits, attacker heals |
| **Strike** | Attacker hits reduced | Both trade hits | Defender counters | Both trade, attacker faster |
| **Guard** | Both neutral | Attacker counters | Both neutral | Attacker counters |
| **Reach** | Attacker hits hard | Both trade, defender faster | Defender counters hard | Both trade heavy |

4. **Damage formula:**
   ```
   Raw Damage = Attack × (ability_base + skill_points × 0.05) × species_modifier
   Reduced by = Defender's Defense% × stance_modifier
   Final HP loss = Raw Damage - Reduction (minimum 1)
   ```

5. **Ki resource** — abilities cost Ki to use. Ki regenerates slowly each turn (+5% of max Ki). Leaf-heavy kijo have larger Ki pools and regenerate faster. Running out of Ki forces basic strikes with no ability modifiers.

6. **Endurance check** — when a kijo takes damage exceeding 15% of max HP in a single hit, an Endurance check occurs. Branch count × average thickness determines the threshold. Failing the check causes stagger (lose next turn). High-branch kijo almost never stagger. Low-branch specialist kijo are more vulnerable to being staggered by heavy hits.

7. **Wisdom effects (passive, scales with age):**
   - At 100+ days: kijo reveals opponent's LAST chosen stance before you commit
   - At 200+ days: kijo reveals opponent's chosen stance 30% of the time BEFORE you commit
   - At 365+ days: kijo reveals opponent's chosen stance 50% of the time
   - At 500+ days: kijo can change stance AFTER seeing opponent's choice once per fight
   - Wisdom creates the "old master" fantasy — the ancient tree spirit that reads you like a book

8. **Win condition:** HP reaches 0. Best of 3 rounds in ranked. Single elimination in tournaments.

**Species Triangle (Combat Application):**

- **Hardwood > Evergreen**: Hardwood's Root stance heals more than Evergreen's pressure can damage. The wall outlasts the siege.
- **Evergreen > Tropical**: Evergreen's consistent Guard/Strike cycling denies Tropical's Reach windows. Pressure prevents setup.
- **Tropical > Hardwood**: Tropical's Reach resolves before Hardwood's slow Tempo. Burst kills before the old master can read patterns.

Triangle advantage: ~15% effective modifier on damage dealt. Meaningful but beatable through superior Wisdom, skill point allocation, and stance reads.

### 3.4 Battle Arenas

- **Ranked** — ELO-based matchmaking. Seasonal ladders. Rewards for placement.
- **Friendly** — No stakes. Practice and testing.
- **Stake Battles** — Both players wager tokens. Winner takes pot minus house fee.
- **Tournament** — Bracket format. Entry fee. Prize pool distribution.

**Future Feature — Tag Team Matches:**

- **2v2** — each player fields two kijo. Active kijo fights while the partner rests (passive morale/Ki recovery on the bench). Players can tag mid-round, swapping their active fighter. Tagging costs one turn. Team composition matters — a hardwood anchor + tropical burst is a different strategy than double evergreen pressure.
- **3v3** — full stable warfare. Three kijo per side, one active at a time. Tag mechanic same as 2v2. Bench recovery is slower (split across two resting kijo). The 5-tree roster limit means fielding a 3v3 team locks over half your stable into one fight. Losing a 3v3 with all three kijo at low morale is devastating — and sends you straight back to the care loop.
- **Delegation synergy** — tag team matches create demand for diverse stables, which creates demand for specialized caretakers. A fighter running 3v3 needs three well-maintained trees across different species and styles. That's potentially three different caretakers coordinating.

### 3.5 Spirit Morale (The Convincing Mechanic)

A kijo is not a tool — it's a spirit with will. The morale system creates the retention bridge between combat and care.

**Morale decreases from:**
- Consecutive losses (each loss -15 morale)
- Low tree health during the battle period (-5 per battle if tree health < 40)
- Drought or overwatering stress (-3 per day of stress)

**Morale increases from:**
- Victories (+10)
- Optimal care days (+2 per day in healthy range)
- Fertilizer application (+5 one-time)
- Rest days (no battles, +3/day)
- Pruning care (each prune +8 — "the spirit feels your attention")

**When morale drops below 20:** the kijo refuses to fight. The caretaker must restore morale above 50 before the next battle. This typically takes 5–10 days of attentive care with no combat.

This mechanic prevents battle grinding, forces engagement with the care loop, and creates real dependency on caretakers in the delegation model.

---

## 5. Delegation System

### 4.1 Roles

**Caretaker** — Manages tree care. Waters, prunes, fertilizes, monitors health. Can manage many trees across multiple delegation contracts. Earns a percentage of battle rewards. Skill expression: efficient care routing, aesthetic pruning, health optimization.

**Fighter** — Commands the kijo in combat. Selects abilities, reads opponents, manages team composition across their stable. Does not interact with tree care directly. Earns a percentage of battle rewards. Skill expression: tactical play, matchup knowledge, team building.

A single player can be both (solo mode). Delegation is opt-in.

### 4.2 Delegation Contract

On-chain agreement between tree owner, caretaker, and fighter. Terms:

- **Revenue split** — Default 40/30/30 (owner/caretaker/fighter), customizable.
- **Care requirements** — Minimum moisture range, maximum days without watering, prune approval (owner can require approval before any cut).
- **Battle limits** — Maximum battles per day/week to prevent morale farming.
- **Duration** — Fixed term or open-ended with notice period for termination.
- **Prune authority** — Critical. Owner can set prune policy: "caretaker may prune freely," "caretaker must request approval," or "no pruning." Since prune shears are premium items, this controls who bears the cost.

### 4.3 Economic Dynamics

Caretakers who build a reputation for healthy, well-shaped trees attract fighters willing to offer better revenue splits. Fighters who win consistently attract owners willing to delegate high-value trees. This creates a **skill marketplace** where reputation is earned through verifiable on-chain performance (care logs are public, battle records are public).

Unlike Axie scholarships where the scholar grinds the same loop as the owner, here the caretaker and fighter are playing genuinely different games with different skill sets. A great caretaker may have zero combat ability. A great fighter may kill every tree they touch. They need each other.

---

## 6. NFT Structure

### 5.1 On-Chain Data (Immutable Source of Truth)

Each Kijonsai NFT stores:

```
{
  seed: uint32,           // Deterministic growth seed
  species: uint8,         // Species class + specific species
  born: uint64,           // Block timestamp of planting
  care_log_hash: bytes32, // Merkle root of care log
  owner: address,
  delegation: {
	caretaker: address,
	fighter: address,
	terms_hash: bytes32
  }
}
```

Total on-chain footprint: ~160 bytes per NFT.

### 5.2 Off-Chain Data (Reconstructable)

The full care log is stored off-chain (IPFS or dedicated service) but its integrity is verified by the on-chain Merkle root. Any action appended to the log updates the root. Anyone can independently verify the log's integrity and reconstruct the tree.

Care log entry format:
```
{ action: string, timestamp: uint64, params: bytes }
```

Typical tree at Day 440 with 600 actions: ~12KB of log data.

### 5.3 Visual Representation

**Parametric rendering pipeline:**

1. `seed + species + care_log` → deterministic tree structure (recursive branch data, ~2KB)
2. Tree structure → client-side L-system renderer → 2D canvas or 3D view
3. Tree structure → 256³ sparse voxelizer → NFT art asset

**Voxel NFT specs:**
- Grid: 256³ (2mm resolution on a ~50cm bonsai)
- Storage: sparse (only filled voxels stored)
- Typical fill: 20,000–40,000 voxels
- Per-voxel: 4 bytes (x, y, z as uint8 + material palette index)
- Material palette: 12–16 entries (young bark, old bark, heartwood, spring/summer/autumn leaf, terracotta, glaze, soil, moss, root, prune scar)
- Raw size: 80–160KB; compressed: 30–60KB
- Rendering: any voxel engine (MagicaVoxel, Three.js, custom WebGL)

The voxel representation is derived deterministically from the parametric data. It is NOT stored on-chain. It is generated client-side or by an indexer for marketplace display.

### 5.4 Kijo Morphology (Tree → Body Mapping)

The kijo's body is built deterministically from the tree's voxel structure using a direct anatomical mapping. The same 256³ grid that represents the tree is re-interpreted as a body plan. No random generation, no separate character creator — the tree IS the body.

**Primary Mapping (Trunk → Torso):**

The trunk is the torso. Trunk thickness determines body build directly:

| Trunk Thickness | Kijo Build | Combat Implication |
|---|---|---|
| Thin (< 4 voxels wide) | Lithe, narrow frame | Low mass, high speed |
| Medium (4–7 voxels) | Athletic, balanced | Standard |
| Thick (8+ voxels) | Broad, heavy frame | High mass, damage absorption |

Trunk curvature maps to posture. A straight trunk = upright stance. A curved trunk = dynamic/leaning pose. Trunk length maps to torso height — a tall trunk produces a taller kijo.

**Limb Mapping (Branches → Legs, Arms):**

Depth-1 branches are sorted by their vertical position on the trunk (Y-axis in the voxel grid):

- **Lower depth-1 branches → Legs.** The first/lowest set of major branches become the kijo's legs. Branch thickness = leg thickness. Branch angle = stance width. Two lower branches = standard bipedal. Three = tripod/tailed stance. One = rooted pillar stance (slow but immovable).

- **Upper depth-1 branches → Arms.** The second/upper set of major branches become arms. Same thickness mapping. Branch angle determines reach arc. Two upper branches = standard dual arms. Three+ = multi-armed (rare, requires specific growth patterns). One = single dominant arm (power style).

Branch length directly maps to limb length. A long depth-1 branch = long arm/leg reach. A short thick one = compact powerful limb.

**Extremity Mapping (Sub-branches → Fingers, Toes, Claws):**

Depth-2+ branches extending from limb branches become digits:

- Each depth-2 sub-branch off a leg branch → a toe/foot structure
- Each depth-2 sub-branch off an arm branch → a finger/hand structure
- **Branch length at depth 2+ determines claw length.** Long thin sub-branches = long claws (slashing attack style). Short thick sub-branches = stubby powerful digits (grappling/crushing style).
- Pruned sub-branches = missing digits (reduced grip but scar hardens the stump — focused power in remaining digits)
- Depth-3+ branches off digits = claw tips, nail detail, joint articulation

**Canopy Mapping (Leaves → Hair/Crown/Aura):**

- Leaf density at branch tips → hair/foliage crown volume
- Seasonal color → crown color (autumn kijo has red/gold crown, spring has vibrant green)
- Heavy foliage = lush flowing crown
- Heavily pruned canopy = spiked/angular crown (the "battle-hardened" look)
- Winter state (no leaves) = bare horned/antlered silhouette

**Scar Mapping (Prune Points → Battle Marks):**

- Every prune scar on the tree corresponds to a visible scar on the kijo's body at the mapped location
- Trunk prune scars = torso scars
- Limb prune scars = limb scars (and missing digits if sub-branches were pruned)
- Scars are badge-of-honor visual markers — a heavily-scarred kijo tells a story of deliberate shaping

**Eye and Face Generation:**

- Species determines eye color (hardwood: steady amber, evergreen: cool silver, tropical: vibrant green)
- Face structure emerges from the trunk's upper section and the crown base
- Trunk knots/texture variations map to facial features
- A gnarled old trunk = weathered face with character
- A smooth young trunk = youthful/fierce expression

**Weapon Generation:**

- Pruned branch stumps that were thick at the time of cutting become weapons
- Stump angle determines weapon type: downward-angled stump = blade/sword, horizontal stump = shield/guard, upward stump = horn/spike
- Stump thickness determines weapon weight class
- The kijo doesn't carry separate weapons — her weapons grow FROM her body at the prune points. The caretaker literally forged the weapons by choosing what to cut.

**Morphology Implications for Gameplay:**

This mapping means pruning decisions have direct combat anatomy consequences:

- Pruning a lower branch = removing structural support from a leg (less endurance for movement-based abilities)
- Pruning an upper branch = removing an arm's capability (less attack diversity from that side)
- Pruning sub-branches = fewer but stronger digits (specialist grip vs. versatile hands)
- Pruning early vs. late matters: early prunes redirect growth to remaining limbs (they grow thicker/longer). Late prunes remove established capability.

A caretaker who understands the morphology mapping can deliberately sculpt a kijo's combat body through their pruning pattern. This is the deepest skill expression in the care loop — growing a fighter, not just growing a tree.

---

## 7. Monetization

### 6.1 Philosophy

Free players access the full care loop and combat system. Premium items provide precision and acceleration, never power that free players cannot eventually match through patience.

### 6.2 Revenue Streams

| Item | Price Range | Uses | Purpose |
|---|---|---|---|
| Pruning Shears | $1–3 | 3–5 cuts | Precision tool for permanent decisions |
| Fertilizer Pack | $0.50–1 | 1–3 applications | Growth acceleration |
| Species Seed | $2–5 | 1 tree | Specific species selection (free players get random) |
| Extra Tree Slot | $3 | Permanent | Expand beyond 5-tree limit |
| Cosmetic Pot | $1–5 | Permanent per tree | Visual customization (pot style, soil decoration) |
| Time Subscription | $5–10/month | Duration | Adjustable day cycle speed (2x, 4x, 8x). Free players run at real-time. |

### 6.3 Marketplace Fee

5% fee on all NFT secondary sales (standard). The care log transfers with the NFT, so provenance and stat history are preserved.

### 6.4 Battle Entry Fees

Stake battles and tournaments take a 5% house fee from prize pools.

---

## 8. Economy Design

### 7.1 Token (If Applicable)

TBD. The game can function entirely with native chain currency + direct fiat purchases. A game token introduces liquidity and speculation risk. Decision deferred to post-prototype validation.

### 7.2 Sink/Faucet Balance

**Faucets (value enters player economy):**
- Battle rewards (ranked seasons, tournaments)
- Delegation revenue
- NFT sales

**Sinks (value exits player economy):**
- Consumable purchases (shears, fertilizer)
- Subscription fees
- Marketplace fees
- Battle entry fees
- Cosmetics

**Self-Regulating Mechanism:** Battle rewards scale with active player count. More players = more battles = more sink consumption (entry fees, morale recovery costs via shears/fertilizer). Growth in player base naturally increases both faucets and sinks.

### 7.3 The Seed Churn Economy

Players who neglect their trees or make poor pruning decisions produce weak kijo. Rather than grind a suboptimal tree back to health (which is slow and may not fully recover), many will abandon and mint a new seed. This is economically desirable behavior:

**Impatient players self-select as recurring spenders.** The player who churns through 10 seeds at $2–5 each trying to speed-run a strong kijo is spending $20–50 without ever threatening the competitive balance — because every new seed starts at Day 0 with zero age, zero Wisdom, zero combat viability. They are paying to restart, not to advance.

**Patient players become the scarcity.** A 400-day well-cared-for tree cannot be purchased, replicated, or accelerated into existence. The only input that produces it is 400 real days of care. This means old trees naturally appreciate on the secondary market because supply is hard-capped by time. No amount of seed re-rolling produces what patience produces.

**The resulting marketplace structure:**

| Tree Age | Supply | Typical Value | Buyer Profile |
|---|---|---|---|
| 0–30 days | Abundant (constant minting) | Floor price | New players, experimenters |
| 30–90 days | Moderate | Low-mid | Fighters looking for ready-to-awaken kijo |
| 90–365 days | Scarce | Mid-high | Competitive fighters, collectors |
| 365+ days | Rare | Premium | Serious competitors, prestige collectors |

**Key insight:** the seed price ($2–5) is the cost of impatience. The tree price on secondary is the cost of time someone else already invested. Both are valid transactions. The game doesn't punish either behavior — it simply makes patience the only path to the highest tier, and charges convenience fees to those who won't walk it.
