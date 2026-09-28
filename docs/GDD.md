# KIJO — Game Design Document

**Version:** 0.2
**Date:** July 13, 2026 (lore updated September 24, 2026)
**Author:** Jeremy Gordon / Kingdom Koders
**Status:** In Production — Phase 1 active (Saigon testnet)

---

## 1. Vision

### The Premise

A kijonsai is not a tree that produces a fighter. **The kijonsai IS the kijo.** A divine spirit sleeps inside every imbued seed, waiting to be released. The tree is her body before she awakens. Every drop of water nourishes the sleeping spirit. Every cut of the shears sculpts the body she'll fight in. Every day of patience deepens her wisdom. The way the kijonsai is cared for determines the kijo's spirit — her strength, her form, her fighting style, and her will.

When she finally awakens, she is exactly what her caretaker made her. Not randomly generated. Not stat-rolled. Grown.

### The Game

Kijo is a dual-loop blockchain game where players tend kijonsai over real time, shaping the divine spirits within them through daily care, then awaken those spirits for combat. The kijo's stats, appearance, combat archetype, and fighting style are deterministically derived from the care history — the same parametric tree, the same voxel grid, the same stat terrain. No two kijo are alike because no two trees are cared for the same way.

The core thesis: **patience is power.** A kijonsai tended with intention over months produces a fundamentally stronger spirit than one speed-grown with fertilizer. The art, the stats, and the provenance are the same object.

**Target Audience:** Intersection of idle/casual sim players (care loop) and competitive PvP players (combat loop). Delegation bridges these into a single economy.

**Chain:** Ronin mainnet (L2 EVM). SLP integration approved by Sky Mavis as a burn sink for combat morale recovery.

---

## 2. World & Lore

### 2.1 Origin — The Scattered Seeds

Yama-no-Kami, the mountain god of forests and harvests, rode through the glades between the mortal world and the spirit realm. In his passing, seeds fell from his satchel — divine seeds carrying the potential for spirits within them. Each seed holds a fragment of the mountain god's domain: the patience of stone, the fury of storms, the quiet growth of roots through rock.

A fictional seller from the **Decorative Tree Guild**, commonly called the **Flower Guild**, finds the seeds scattered across the Glade floor. Trained in the living arts of penjing and bonsai, the seller recognizes that the seeds are no ordinary stock and entrusts them to mortals willing to cultivate them. The seller did not create their divinity; Yama-no-Kami is their source.

**The Guild seller** is the game's storefront and tutorial guide. The character teaches care and documented shaping traditions, provides the first shear, and later offers imbued seeds, tools, and consumables. The seller's personal name, appearance, exact Guild title, and full knowledge of the sleeping spirits remain pending until the character is approved.

**Flower Guild Rank** is the common in-world name for the Decorative Tree Guild's algorithmic quality grade. The exact Guild, rank ladder, and on-chain grading system are original Kijonsai fiction informed by real penjing and bonsai culture; they are not presented as a recovered historical institution.

> **Canon revision — 2026-09-24:** Earlier drafts used Tanaka Shōsuke and later Gu Ahao. Both names were removed because the first direction risked borrowing a living bonsai professional and the replacement name was never owner-approved. A fictional Guild seller preserves the intended cultural role without assigning invented history to a real person. The formal/common Guild distinction also preserves the established **Flower Guild Rank** label while avoiding an unsupported claim that the game's exact grading system existed historically.

### 2.2 The Kijo

When a mortal tends a divine seed with patience and intention, the tree grows as a **shinboku**: a sacred individual tree in which divine presence dwells. In Kijonsai, the tree and the Kijo are one persistent living identity. She is not a separate creature installed in a vessel. The tree is her body, source, sanctuary, and memory. Her strength is the tree's strength. Her scars are the tree's located wounds. Her crown is the canopy the caretaker shaped.

A kijo does not serve her caretaker — she partners with them. Neglect the tree and she withdraws. Send her into battle recklessly and she grows reluctant. Tend the tree with devotion and she fights with everything the tree has grown.

### 2.3 The Two Potions (SLP)

When a Kijo loses battles or suffers from neglect, her morale and will to fight decline. Two potions share the SLP name but serve different roles, different users, and different economies.

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

### 3.1.1 Care Technique — the Second Axis

Species determines WHAT the tree is. Technique determines HOW it was raised. Together they define the kijo's full combat identity: **Species × Technique = Archetype.**

Technique is NOT selected at planting — it **emerges from the caretaker's actions over time.** The system classifies a tree's technique from its care log: did the caretaker use both wire and shears? Only shears? Did they strip bark? Did they add landscape elements? The technique is descriptive, not prescriptive — it reads what the caretaker actually did, not what they declared.

Each technique is grounded in a real historical penjing/bonsai tradition:

| Technique | Historical Origin | Care Pattern | Combat Archetype | Kijo Fighting Style |
|---|---|---|---|---|
| **Bound-and-Cut** | Traditional combined method | Uses BOTH wire and shears. Balanced shaping. | **Balanced** | Moderate stats across the board, no exploitable weakness. Adaptable, well-rounded. The jack-of-all-trades. |
| **Absolute Clip-and-Grow** | Lingnan School | Uses ONLY shears, NEVER wire. Hard prune, let it burst back. | **High-Crit** | Low sustained damage but devastating critical hits. Jagged, explosive power spikes from regrowth patterns. Wild, aggressive silhouette. |
| **Trunk Splitting / Jin** | Deadwood technique (jin/shari) | Strips bark to create exposed deadwood. Deliberate structural damage that hardens. | **Defensive** | High Defense and Endurance. Fights by absorbing punishment and outlasting. Exposed heartwood = hardened interior. Scarred, weathered, unkillable. |
| **Water-and-Land Landscape** | Shanshui penjing (landscape composition) | Adds rocks, water features, moss, ceramic decorations around the tree. | **None (care-loop only)** | The tree can still awaken a kijo, but the landscape elements are display-only. This is the pure aesthetic/collector path — the Exhibition feature. |

**How technique classification works:**

The system reads the care log and classifies based on action ratios:

- **Bound-and-Cut:** wire uses > 0 AND prune uses > 0, with a roughly balanced ratio. The caretaker used both tools.
- **Clip-and-Grow:** prune uses ≥ 2 AND wire uses == 0 AND age ≥ 30 game days. The caretaker NEVER used wire — a philosophical commitment, not just an oversight. A single wire use at any point permanently disqualifies Clip-and-Grow classification. The technique rewards conviction. The minimum thresholds (2 prunes, 30 days) ensure this is a real commitment, not a Day-3 tree that simply hasn't encountered wire yet. Twine and weights do NOT count as wire — they use natural force, consistent with the Lingnan School's rejection of metal shaping.
- **Jin:** jin/bark-stripping actions > threshold. Requires a new premium tool: **jin pliers** (strips bark from a branch section, converts bark voxels to hardened deadwood voxels with a Defense bonus). A tree can be both Jin AND Bound-and-Cut or Clip-and-Grow — Jin is an overlay technique, not exclusive.
- **Water-and-Land:** landscape element count > threshold. Rocks, water features, or decorations placed around the tree. This is additive — any tree can have landscape elements regardless of its other technique.

**Why technique emerges rather than being chosen:**

A player who buys shears and wire and uses both discovers they're Bound-and-Cut. A player who refuses to ever buy wire and only prunes discovers they're Clip-and-Grow. The game doesn't ask "which technique do you want?" — it watches what you do and names what you became. This rewards informed players who research the traditions and make deliberate choices, while casual players naturally land in Bound-and-Cut (the default when you use both tools).

**Technique Discovery Notification:**

When a player first qualifies for a non-default technique, the kijo's spirit stirs — a one-time notification, voiced as the spirit responding to how she was raised:

- **Clip-and-Grow** (at age ≥ 30 days with ≥ 2 prunes and zero wire uses): *"Your kijo's spirit resonates with divine power. Your kijonsai has never known wire."*
- **Jin** (on first jin pliers use): *"Your kijo's heart hardens where the bark was stripped. Strength grows from the wound."*
- **Water-and-Land** (on first landscape element placed): *"Your kijo's body settles into the landscape. She is no longer just a tree — she is a world."*

The notification isn't the game announcing a classification. It's the spirit FEELING the caretaker's approach and responding. The kijo is divine — her heart, body, and strength resonate differently based on how she was tended. A kijo who has never known wire grew free; her spirit burns hotter for it. A kijo whose bark was stripped hardened where she was wounded; her body carries that toughness into combat. A kijo surrounded by rocks and water found peace; her spirit is rooted in something larger than herself.

Bound-and-Cut is the default — it never triggers a notification because most players arrive there naturally. The discovery notifications only fire for non-default techniques, and they only fire ONCE. No prior hint that technique classification exists. The player was just caring for their tree, and the spirit stirred.

This also functions as organic community content. A player who sees the spirit resonance message posts it. Others ask "how did you get that?" The answer — "never use wire" — spreads through the playerbase as discovered knowledge, not documented rules.

**Technique × Species grid (12 combat archetypes from 3 species × 4 techniques):**

A Hardwood raised Clip-and-Grow is a brawler with crit spikes — tanky AND explosive on the right hit. A Tropical raised Jin is a glass cannon with hardened deadwood armor — fragile on the outside but the exposed heartwood absorbs key blows. These cross-combinations create build diversity that players discover through care choices, not character creation menus.

### 3.2 Daily Care Actions

Care operates on a **real-time day cycle** (1 game day = 8 real hours, adjustable via subscription — see Section 7). Each day the tree ticks forward, moisture decays, and growth occurs based on current conditions.

**Free Actions (unlimited):**

- **Water** — Increases moisture by a fixed amount. Moisture decays naturally each day. Optimal range: 30–65%. Below 20%: drought stress (growth rate drops to ~15%, health declines). Above 80%: overwatered (growth rate drops to ~40%, health declines). The skill is maintaining the sweet spot without obsessive attention.

- **Rotate** — Rotates the tree 90°. Simulates light exposure. Affects directional growth bias (branches on the "sun side" grow slightly faster). Regular rotation produces balanced canopy. Neglecting rotation produces asymmetric growth — which is not necessarily bad. Some bonsai styles (slant, windswept) deliberately grow asymmetric.

- **Twine (tie — free tier)** — natural fiber binding. Bends a branch's growth angle up to **±15-20°** from its natural direction. Degrades over time — the bend holds for 10-15 game days, then the branch slowly springs back toward its original angle unless twine is re-applied. Available to ALL players including guests. This is the beginner's directional tool: some control, impermanent, needs maintenance. A free player using twine can meaningfully shape their tree — they just can't bend as far as wire, and they have to keep re-applying. Twine marks appear as thin natural fiber wrapping (visually distinct from metal wire marks). Twine does NOT penalize Flower Guild Rank (it's natural material, consistent with traditional technique). Twine counts as "binding" for technique classification — a player who uses twine + shears is Bound-and-Cut, same as wire + shears.

- **Weights (free/cheap tier)** — small stones or weight bags attached to a branch via twine, using gravity to pull the branch downward. Cheaper than wire, simpler to use, but **only bends downward** (gravity-dependent — you can't hang a weight upward). Allows twine to achieve up to **35% of wire's maximum bend arc** (~15-16° downward, compared to wire's full ±45° in any direction). The weight stays attached until the caretaker removes it. Over time, the downward bend gradually sets (similar to wire timing but slower — the branch adapts to the pull). Combined with twine: twine attaches the weight to the branch, the weight provides the sustained downward force. A free player with twine + weights can create the classic cascading branch (Kengai style) slowly and cheaply. Weights do NOT count as "wire" for technique classification — a player using only twine, weights, and shears is still Clip-and-Grow eligible, since weights use natural force (gravity), not metal shaping.

**Premium Actions (consumable, purchased) — the Guild seller's "Tied and Cut" toolkit:**

The master's two techniques are the caretaker's two precision tools. Cut removes. Tie redirects. Together they are how a kijonsai is sculpted from raw growth into deliberate form.

- **Prune / Shears (cut)** — 3–5 uses per shears item. Permanently removes a branch and all sub-branches. A prune scar remains visible on the trunk. Pruned branches never regrow. Pruning redirects growth energy to surviving branches (they grow faster/thicker after a cut). This is destructive precision — you lose voxels (lose raw stats) but gain focused growth in the surviving structure. Premium because every cut is permanent and reshapes all future growth. The "cut" in tied-and-cut.

- **Wire (tie)** — 3–5 uses per wire item. Bends a branch's growth angle up to ±45° from its natural direction. The branch keeps all its voxels (no stat loss) but its future growth direction changes — it now grows into a different region of the 256³ stat terrain, picking up different terrain bonuses. This is constructive precision — you sacrifice nothing but change where the tree aims. A caretaker who knows their seed's terrain uses wire to steer a promising branch toward a high-value stat cluster it would have missed naturally. The "tied" in tied-and-cut.

  **Wire timing (matches real bonsai practice):**

  Wire is NOT permanent on application — it's applied, monitored, and removed at the right time:

  | Removal Timing | Result | Consequence |
  |---|---|---|
  | **Too early (<6 months)** | Branch springs back partially or fully | Wire wasted — the bend didn't set. Branch returns toward its original angle over subsequent growth ticks. |
  | **Right time (6–12 months)** | Branch has "set" — bend is permanent | Clean result. No scarring. Wire marks fade. The branch grows in the new direction permanently. |
  | **Too late (>12 months)** | Wire cuts into growing bark | Permanent wire scarring at the contact points. Flower Guild Rank penalty (aesthetic damage). The bend IS permanent, but at a cosmetic cost. |
  | **Never removed** | Wire embedded in bark | Heavy scarring, significant rank penalty. The kijo carries the wire marks as visible scars on her body. |

  This adds a tending dimension to wire: it's not set-and-forget, it's set-and-monitor. The caretaker must remember to check their wired branches and remove wire at the right window. This creates another reason to check on the tree regularly — is the wire ready to come off? Did I miss the window?

  Wire removal is a free action (no consumable cost — you're just unwinding what you applied). The cost is attention and timing, not money.

  Wire constraints: can only bend branches up to ~45° from their natural angle (more extreme bends would snap a real branch). Cannot wire the trunk (too thick). Cannot wire depth-2+ branches (too thin — they'd break). Depth-1 branches only. Wire thickness should be ~1/3 of the branch diameter being wired (thinner wire on thinner branches — enforced automatically).

  Stat implications: wire doesn't change total voxel count (same raw power), but it changes WHICH coordinates future voxels fill. A wired branch might move from a NEUTRAL-heavy terrain region into an HP-heavy one — or vice versa. The caretaker is navigating the stat terrain by steering the tree's growth direction. Shears navigate by removing obstacles. Wire navigates by changing course.

  **Guild Wire Techniques** (advanced wire variants, higher skill/cost tiers):

  - **Guy-Wire** — instead of bending a branch at its midpoint, a guy-wire PULLS a branch toward an anchor point. The caretaker selects a branch and then selects a target coordinate — the branch gradually curves toward that point over subsequent growth ticks. This is directional precision: "pull this branch toward (x, y, z)" rather than "rotate 30°." A caretaker who has mapped their seed's stat terrain can anchor a branch directly toward a high-value cluster. Higher cost per use than standard wire. Produces a gradual arc rather than a sharp bend — visually distinct and aesthetically valued by the Flower Guild Rank system.

  - **Dual-Branch Tie** — one wire use, two branches shaped simultaneously. The caretaker selects two alternating depth-1 branches (one left, one right of the trunk — cannot pair two branches on the same side) and a single continuous wire shapes both. More efficient (one consumable, two results) but requires structural understanding: the two branches' new angles must be complementary. If both are pulled toward the same region, they compete for the same stat terrain. A skilled caretaker pairs them to cover two different high-value zones. Reduces wire cost for experienced players who think in branch pairs.

  - **Bark Protection (Raffia Wrap)** — standard wire leaves visible wire marks at the bend point (thin line wrapping the branch). These marks are cosmetic — they don't reduce stats — but they DO reduce **Flower Guild Rank**. Wire scarring counts as imperfect aesthetic execution, lowering match %. Bark Protection is a modifier applied BEFORE wiring: the caretaker wraps the branch in protective raffia fiber, then applies the wire. The bend still happens, the growth still redirects, but NO wire mark remains — the bark heals cleanly. Cost: an additional consumable (raffia wraps, sold alongside wire). A master caretaker chasing Exhibition or Master Work rank uses protection on every wire to keep the aesthetic score clean. A player who doesn't care about rank skips it and saves money. This creates a meaningful economic choice between cheap wire (bend + scar + rank penalty) and protected wire (bend + clean bark + rank preserved, costs more).

- **Fertilize (Fertilizer)** — 1–3 uses per fertilizer item. Provides a multi-day growth multiplier (~1.7x for 5 days). Cooldown of 8 days prevents stacking. Fertilizer accelerates growth without changing its character — the tree grows faster but in the same pattern it would have grown anyway. Over-fertilizing (if cooldown is bypassed via multiple items) causes "burn" — health penalty.

- **Notch (future action)** — the horticultural inverse of pruning. Where shears remove a branch to redirect growth, notching *forces* a new branch to sprout at a chosen point on the trunk (real bonsai artists notch the bark near a dormant bud to wake it). Mechanically: the caretaker selects a coordinate and forces growth there, letting a master deliberately steer the tree toward high-value regions of the seed's stat terrain instead of hoping growth wanders there. This is the deepest expression of caretaker skill — a caretaker who has learned their seed's terrain notches exactly where the valuable clusters sit. Constrained by real bonsai rules: cannot notch the bare lower third of the trunk, cannot notch where a branch already exists. A premium precision action. **Deferred — not in the current prototype; tracked for the care-loop feature set.**

**The full toolkit spectrum:**

| Tool | Action | Voxels | Growth Direction | Cost | Skill Ceiling |
|---|---|---|---|---|---|
| Water | Sustain | Indirectly (enables growth) | No control | Free | Low — just stay in the sweet spot |
| Rotate | Bias | No change | Slight light-side bias | Free | Low-medium |
| Twine (tie — free) | Redirect (temp) | No change | Bend ±15-20°, degrades in 10-15 days | Free | Medium — must re-apply, plan ahead |
| Weights (+ twine) | Pull down (slow) | No change | Downward only, 35% of wire's max arc | Free/cheap | Medium — gravity only, patience required |
| Fertilize | Accelerate | More (faster growth) | Same direction | Premium | Low — timing only |
| Wire (tie — premium) | Redirect (timed) | No change | Bend ±45°; sets permanently at 6-12mo; scars if left >12mo | Premium | High — requires terrain knowledge + timing discipline |
| Guy-Wire | Pull toward anchor | No change | Gradual arc toward target coordinate | Premium (higher) | Very high — requires terrain mapping |
| Dual-Branch Tie | Redirect ×2 | No change | Two branches shaped per use | Premium | High — requires structural pairing |
| Raffia Wrap | Protect bark | No change | N/A (modifier on wire) | Premium (add-on) | Low — just buy it. The skill is knowing it matters for rank |
| Jin Pliers | Strip bark | Convert bark→deadwood | N/A | Premium | High — deliberate damage for Defense bonus |
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

When a tree reaches minimum maturity (e.g., 60 game-days), the player can **awaken** its Kijo combat form. This fighter is the shinboku's embodied manifestation, generated from the same canonical tree state rather than treated as a second creature or generic avatar. The caretaker view retains the planted presentation while combat renders the same identity through voxel-derived trunk, intertwined branches, canopy crown, scars, age, and current condition.

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

Each tree has a calculable **match percentage**: the overlap between its actual filled voxels and its seed's ideal form. This is a publicly visible metric on the NFT, displayed as a **Flower Guild Rank** — the fictional Decorative Tree Guild's common quality label, applied algorithmically to the deterministic seed standard.

| Match % | Flower Guild Rank | What It Means |
|---|---|---|
| 0–30% | **Seedling** | Minimal care, random growth. The guild wouldn't display it. |
| 30–50% | **Sapling** | Decent care but no style awareness. A student's first attempt. |
| 50–65% | **Pruned** | Good caretaker who recognized the seed's style. Intentional cuts visible. |
| 65–80% | **Styled** | Skilled deliberate pruning toward the ideal. The guild would notice. |
| 80–90% | **Exhibition** | Master-level care over extended time. Worthy of display at a guild fair. |
| 90–95% | **Master Work** | Near-perfect execution, hundreds of days of precise care. The Guild recognizes mastery. |
| 95–100% | **Living Painting** | The asymptote: living wood that evokes the brushstrokes of classical landscape painting. Effectively impossible by design. |

The rank names trace the journey from raw beginner toward the Guild's ideal. "Living Painting" at the top is deliberately unreachable: an artistic horizon rather than a claim that one fictional or historical master achieved mathematical perfection. A player who reaches "Exhibition" has accomplished something genuinely rare. "Master Work" is the stuff of legends. Nobody reaches "Living Painting," and that's the point — the ideal remains the horizon you chase.

**Economic implications:**

Flower Guild Rank creates a natural rarity gradient that the market prices automatically. A **Styled** Day 300 oak is objectively, verifiably superior to a **Sapling** Day 300 oak — and the difference is entirely the caretaker's skill, not RNG. Higher-ranked trees command premium prices because the skill required to earn the rank is rare and the time invested is irreplaceable. The rank displays on the NFT alongside the tree visual — buyers read it instantly.

**Competitive implications:**

Two kijo with identical voxel counts but different Flower Guild Ranks have different stat profiles. The higher-ranked kijo has its stats concentrated in the seed's optimal zones. The lower-ranked kijo has stats scattered across suboptimal coordinates. Same total power, but the ranked kijo's stats align with its style — coherent and synergistic. An **Exhibition** kijo fights like a composed master. A **Sapling** kijo fights sloppy, its power wasted on unfocused growth.

**The mastery fantasy:**

This system creates the long-term engagement loop that bonsai culture itself runs on: the pursuit of an ideal that recedes as you approach it. A caretaker who hits **Pruned** and sees how much stronger their kijo could be at **Styled** has a clear, self-motivated goal that no content update needs to provide. The game generates its own endgame from the gap between real and ideal — the same pursuit that gives long-term penjing and bonsai practice its depth.

**Exhibition Events (future feature):**

Periodic events where trees are judged purely on Flower Guild Rank — no combat. Caretakers compete on craftsmanship: highest match %, best taper adherence, most faithful style execution. Prizes for rank thresholds. These fictional Guild exhibitions are informed by real penjing and bonsai display, appraisal, and exhibition culture. It gives pure caretakers (who never fight) their own competitive outlet, validating the care loop as a standalone game. The grading is algorithmic, verifiable, and tied to the deterministic seed standard rather than subjective jury opinion.

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

### 7.4 Abandoned Tree Value

Trees that were neglected and abandoned still have value in specific cases:

- A neglected 200-day tree with poor health history has low Vitality but high Wisdom (age still counts). A skilled caretaker who buys it cheaply on secondary could nurse it back to health over 60–90 days, recovering a kijo with excellent Fight IQ and improving Vitality. This creates a **tree rehabilitation market** — a secondary skill expression for caretakers.

- A wild unpruned tree (no shears ever used) has maximum branch count and maximum ability diversity but zero Specialization. For certain combat styles (generalist builds), this is optimal. "Untouched old growth" becomes its own market category.

- A heavily pruned tree with only 3–4 branches remaining but extreme thickness in those branches produces a hyper-specialized kijo with massive power in a narrow ability set. This is the "glass cannon sculptor" archetype — high risk, high reward caretaking.

---

## 9. Technical Architecture

### 8.1 Client

- **Mobile-first** (iOS + Android) — primary platform
- **Web client** — secondary, for caretakers who prefer desktop
- **Engine:** React Native (mobile) or progressive web app. Canvas/WebGL rendering for tree visualization. Three.js for 3D voxel viewer.

### 8.2 Backend

- **Game server** — Handles day ticks, validates care actions, processes combat resolution. Combat is server-authoritative to prevent manipulation.
- **Care log service** — Append-only log with Merkle root updates pushed to chain.
- **Matchmaking** — ELO-based, server-side.
- **Indexer** — Reads on-chain NFT data, reconstructs tree state, generates voxel previews for marketplace display.

### 8.3 Blockchain

- **Smart contracts:** ERC-721 for Kijonsai NFTs, delegation contract, marketplace contract, tournament escrow.
- **Chain interaction is minimal:** Mint, transfer, update care log hash, delegation create/modify/terminate, battle result recording (for ranked), marketplace listing/sale.
- **Gas strategy:** Batch care log hash updates (daily or on-demand rather than per-action).

### 8.4 Data Flow

```
Player Action (water/prune/fertilize)
  → Client validates locally
  → Sends to game server
  → Server validates, appends to care log
  → Server computes new tree state
  → Client renders updated tree
  → Periodically: server updates Merkle root on-chain
```

```
Combat
  → Fighter selects abilities (client)
  → Server resolves combat (authoritative)
  → Server records result
  → Server updates morale
  → Periodically: batch-write results on-chain for ranked
```

---

## 10. Art Pipeline — Fully Procedural

> **No sprite atlases. No character artist. No art bottleneck.** The tree metadata IS the art asset. Kijo characters are computed, not drawn. Adding a new species requires growth curve parameters and a color palette — not a single illustration.

### 10.1 The Pipeline

```
seed + care_log
  → tree structure (parametric branches, ~2KB)
  → voxelizer (256³ sparse, ~30-60KB)
  → morphology mapper (tree → skeleton)
  → procedural mesh (skeleton → body)
  → universal animation clips (generic bone-driven)
  → rendered kijo (unique character, zero hand-drawn assets)
```

### 10.2 Tree Rendering (Care Loop)

**2D (in-game care view):**
Parametric data → L-system bezier curves → canvas renderer. Real-time, runs on mobile. Current prototype demonstrates this.

**3D (NFT display, marketplace):**
Parametric data → voxelizer (256³ sparse) → Three.js/WebGL renderer or exported .vox file for MagicaVoxel. Pre-rendered for marketplace thumbnails.

### 10.3 Kijo Rendering (Procedural Character Generation)

The kijo's body is fully defined by the tree's metadata. No sprite atlas, no hand-drawn character art, no artist dependency.

**Skeleton generation:**
- Trunk length + curve → spine bone chain (torso)
- Lower depth-1 branch positions → leg joint locations
- Upper depth-1 branch positions → arm joint locations
- Branch angles at each depth → joint angles
- Depth-2+ branches → digit/claw bone chains
- The tree structure IS a bone hierarchy. No rigging step needed — the tree was always a skeleton.

**Procedural mesh:**
- Thickness at each bone → limb width (cylinder/tapered tube geometry)
- Fill between bones with smooth procedural geometry
- Bark texture from species palette (generated, not painted)
- Prune scars → surface detail at mapped locations (hardened knot texture)

**Face generation:**
- Upper trunk section + crown base → head shape
- Eye placement from species template (3 templates: hardwood amber, evergreen silver, tropical green)
- Expression driven by morale state (high morale = fierce, low = reluctant, mid = neutral)
- Trunk knot positions → facial feature variation

**Extremities:**
- Depth-2 branch count → finger/toe count per limb
- Depth-2 branch length → claw/digit length
- Depth-2 branch thickness → digit thickness
- All already mapped in morphology spec (Section 6.4)

**Crown/hair:**
- Canopy shape renders directly as crown volume
- Leaf color from species + season
- Pruned canopy → angular spiked crown. Full canopy → flowing mane.

**Animation — universal clips, infinite bodies:**

Because every kijo skeleton uses the same semantic bone names (`torso`, `left_leg`, `right_leg`, `left_arm`, `right_arm`, `digits_L1`–`digits_LN`, `digits_R1`–`digits_RN`, `crown`), a single set of animation clips works on ALL body shapes:

- Idle, walk, run (species-specific speed curves: hardwood slow, tropical fast)
- Strike, kick, guard, grab (basic attacks)
- Special move wind-up + execute (generic, intensity scales with skill point investment)
- Hit reaction, knockdown, recovery
- Tag in, tag out (team matches)
- Taunt, victory, defeat

A thin tropical ficus kijo and a massive hardwood oak kijo play the same animation clips. The bones just have different lengths and thicknesses. The visual output looks completely different — same motion, different body, unique character.

**Silhouette preview (care loop — zero assets):**

During the care loop, the player sees a real-time kijo silhouette preview:
1. Run morphology mapper on current tree state
2. Generate 2D filled outline from the skeleton + mesh
3. Render as a translucent overlay or side panel
4. Updates every growth tick — the player watches their kijo take shape as they grow

This costs nothing to produce. No art request, no rendering queue. The preview is computed on-the-spot from the tree the player is actively tending. Day 1: vague humanoid outline. Day 100: recognizable fighter with visible limbs. Day 300: detailed character with claws, crown, and stance.

### 10.4 Species Art Requirements (Minimal)

Because characters are procedurally generated, new species only require:

- **Growth curve parameters** — branching probability, fork angles, thickness rates, max depth (numbers, not art)
- **Color palette** — bark color gradient, leaf colors per season, eye color (6 hex values)
- **Leaf shape template** — one basic leaf polygon per species (triangle for pine needles, round for oak, pointed for maple, succulent for jade)
- **Species animation speed curve** — walk/run/attack timing multipliers

**Leaf Color Palettes (rolled at mint, seed-determined):**

Each seed rolls a leaf color from its species class palette. Rare colors are cosmetic rarity — they do not affect stats, but they are permanent, visible on both the kijonsai and the kijo's crown, and marketplace-relevant.

| Species Class | Common Colors | RARE Color |
|---|---|---|
| Hardwood | Red, Green | Maroon (blood-red) |
| Evergreen | Green, Blue | Cyan |
| Tropical | Green, Dark Green, Tan/Brown | Yellow |

- The leaf color modifies the seasonal palette, not replaces it. A blood-red maroon hardwood still shifts tone across seasons — its autumn is deep crimson, its spring a lighter wine red.
- The kijo's crown/hair inherits the leaf color. A cyan evergreen kijo is instantly recognizable in combat and in clips.
- Rare roll rate: ~3%. **Undocumented by design** — rare colors are NOT advertised on the mint screen or in player-facing materials. They're an easter egg. A player grows their tree, the leaves come in an unexpected color, and discovery spreads organically through the community. Players figure out the rates themselves. Discovered rarity generates more engagement than disclosed rarity — it turns the playerbase into the ones spreading the lore.

That's it. No character sheets. No sprite work. No skeletal rigging per species. One afternoon of parameter tuning adds a fully functional new species with infinite unique characters.

### 10.5 Hand-Crafted Art (What Still Needs an Artist)

The only hand-crafted assets in the game:

- **UI/UX** — menus, HUD, buttons, care interface
- **VFX** — hit sparks, root eruption particles, leaf storm effects, Ki energy glow, SLP brewing animation
- **The Guild seller (personal name pending)** — the storefront and tutorial character, and a fictional member of the Decorative Tree Guild. The design should communicate long practice with living wood while drawing respectfully from documented penjing and bonsai culture rather than copying a living practitioner.
- **Yama-no-Kami** — lore splash art (optional, for story moments)

Everything else is computed from the tree.

### 10.6 Acquired Assets

**Chinese Juniper Bonsai 3D Model** — by Masoud Rezaei (Blender Market). Commercial license purchased, unlimited usage per terms. High poly (2.4M tris), low poly (586K tris), GLB/FBX/OBJ/STL exports, 4K semi-procedural textures with .sbs source files.

Four uses in the pipeline:

| Use | What | Where |
|---|---|---|
| **Pot & soil mesh** | Extract the pot geometry and soil surface. Every kijonsai sits in the same base pot (or cosmetic variants derived from it). One purchase, infinite reuse. | Three.js care scene, voxel NFT viewer, marketplace preview |
| **Bark & leaf materials** | 4K channel-packed PNGs + Substance .sbs source files. Real bark grain, real leaf surfaces. Tune per species via .sbs (rougher for hardwood, smoother for tropical, needle-like for evergreen). | Procedural branch/leaf texturing in Three.js — replaces placeholder brown cylinders with production-quality surfaces |
| **Art direction target** | Screenshot the current Three.js tree next to this model. The visual gap = the quality roadmap. Match the lighting, bark detail, leaf density, and feel. | Internal art reference — not shipped directly, used to benchmark procedural output quality |
| **The Guild exemplar** | The seller's shop displays one exceptional static bonsai used to teach the Guild's ideal. This is the ONE tree in the game not grown by a player. A pre-made model is correct here because it is a singular teaching specimen rather than a player-owned procedural tree. | Storefront scene / lore moment |

---

## 11. Development Strategy

### 10.1 Build Order

**Bonsai side first, fight engine second.** The care loop must stand alone as a compelling product before combat is layered on. This de-risks development: if the care loop retains players, combat amplifies it. If it doesn't, combat won't save it.

The voxelizer is the bridge — it serves the NFT art pipeline (Phase 1 value) AND becomes the morphology input for kijo body generation (Phase 2 value). Building it early pays dividends in both phases.

### 10.2 Milestone Roadmap

### Phase 0 — Prototype (Current)
- [x] Core bonsai growth engine (L-system, seeded RNG)
- [x] Care actions (water, prune, fertilize, rotate)
- [x] Persistent storage proof-of-concept
- [x] Canvas renderer (2D bezier branches, leaves, pot)
- [ ] Species differentiation (growth curves for hardwood/evergreen/tropical)
- [ ] Voxelizer proof-of-concept (parametric → 256³ sparse voxels)
- [ ] 3D voxel viewer (Three.js)
- [ ] Morphology proof-of-concept (tree voxels → kijo body plan preview)

### Phase 1 — Bonsai Product (Ship this standalone)
- [ ] Mobile client (React Native or PWA)
- [ ] Real-time day cycle with server authority
- [ ] Multi-tree management (up to 5)
- [ ] Species selection at mint (6 species: 2 per class)
- [ ] Care log with Merkle root integrity (deferred to Phase 2 — see KIJONSAI-CONTRACT-ARCH.md §1.1)
- [x] NFT minting (ERC-721, Ronin — Kijonsai deployed Saigon testnet 2026-07-26)
- [ ] 256³ voxel NFT art generation pipeline
- [ ] Consumable shop (shears, fertilizer)
- [ ] Basic marketplace
- [ ] Kijo preview (show what your kijo WOULD look like — morphology preview as motivation to grow)

### Phase 2 — Combat Engine
- [ ] Kijo awakening (full morphology generation from tree voxels)
- [ ] Trunk→torso, lower branches→legs, upper branches→arms, sub-branches→digits/claws pipeline
- [ ] Stat derivation engine (care history → Wisdom, Endurance, Vitality, Specialization, Tempo)
- [ ] Ability generation from branch topology
- [ ] Weapon generation from prune stumps
- [ ] Turn-based combat system
- [ ] Morale system (spirit reluctance, care recovery)
- [ ] Ranked matchmaking (ELO)

### Phase 3 — Delegation & Economy
- [ ] On-chain delegation contracts
- [ ] Caretaker/fighter role split
- [ ] Revenue split automation
- [ ] Prune authority controls
- [ ] Reputation system (public care/battle records)
- [ ] Stake battles and tournaments
- [ ] Time subscription feature

### Phase 4 — Polish & Scale
- [ ] 3D kijo models (generated from tree data)
- [ ] Combat animations
- [ ] Additional species (4–5 per class)
- [ ] Cosmetic shop expansion
- [ ] Social features (grove viewing, tree gifting)
- [ ] Cross-chain deployment
- [ ] Marketing and community building

---

## 12. Competitive Analysis

**What exists:** Axie Infinity (breed-and-battle), Plant vs Undead (plant-themed but standard tower defense), idle tree apps (no combat, no blockchain).

**What Kijo does differently:**
1. Stats are grown, not rolled. No RNG stat sheets. The care history IS the stat sheet.
2. Two genuinely different player roles (caretaker vs. fighter) vs. scholarship grinding.
3. Patience has real value. There is no substitute for age.
4. The NFT visual is deterministic from the history. Two different trees with different care produce visibly different art. Provenance is visual.
5. Pruning as a permanent, premium-gated mechanic creates meaningful scarcity of precision. Free players grow wild trees; paying players sculpt.

---

## 13. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Bonsai care loop isn't engaging enough long-term | Medium | High | Auto-grow option, seasonal events, community features, kijo combat as secondary engagement |
| Combat balance issues from continuous stat space | High | Medium | Extensive playtesting, ELO system handles skill variance, triangle advantage kept moderate (~15%) |
| Chain gas costs make frequent updates prohibitive | Medium | Medium | Batch Merkle root updates, off-chain care log with on-chain verification |
| Bot automation of care loop | Medium | Low | Care actions have diminishing returns (overwatering hurts), pruning requires aesthetic judgment, morale system requires varied care |
| Market saturation of Kijonsai NFTs | Low | Medium | Each tree is genuinely unique (care history), old trees are irreplaceable (age cannot be manufactured), scarcity from time investment |

---

## 14. External Review — Actionable Recommendations

*Source: Independent design review, July 2026*

### 14.1 Onboarding & Retention Risk — HIGH PRIORITY

The 24-hour real-time day cycle will feel slow for new players. First session must deliver satisfaction before the player closes the app.

**Mitigations to implement:**

- **Accelerated tutorial mode** — first 7 game days run at 4x speed for all players (including guests). The tutorial teaches in sequence: basic care (Days 1–2), the three penjing schools and their technique bonuses (Days 3–5), then awards **1 free shear use** for the player's first permanent cut (Days 6–7). The player learns that their care choices determine their kijo's combat archetype BEFORE they make their first irreversible decision. After the tutorial, speed drops to real-time (8 hours/day). The free shear is spent — purchasing more requires an imbued seed. This converts the tutorial from "here's how buttons work" into "here's what your choices mean."
- **Early awakening preview** — from Day 1, show a translucent "preview kijo" overlaid on the tree. As the tree grows, the preview evolves. Player can see what their kijo WILL look like before awakening unlocks. This is the "progress porn" — visual proof that care is building toward something.
- **Starter kijo at Day 14–30** — weak combat-capable kijo available much earlier than the full 60-day maturity threshold. Lets players taste combat early, lose, understand why age and care matter, then invest in growing stronger. The starter kijo should be clearly outclassed in ranked — it's a tutorial tool, not a competitive entry point.
- **Dramatic growth animations** — each day tick should feel visually rewarding. Branch extension, leaf unfurling, trunk thickening should animate smoothly, not pop in.

### 14.2 Combat Depth vs. Accessibility

The stance system + Wisdom reads + species triangle + Ki resource + skill point allocation is a lot of systems for a casual audience to absorb simultaneously.

**Mitigations to implement:**

- **PvE missions first** — introduce combat through scripted encounters against AI kijo with predictable patterns. Teach one mechanic at a time: first stances, then Ki, then skill points, then Wisdom reads. Ranked PvP unlocks after completing the PvE tutorial arc.
- **Auto-battle mode** — caretakers who delegate to fighters should still be able to watch battles. But solo players who just want to care for trees should have an auto-battle option for casual PvE. The kijo fights on her own instincts (Wisdom-weighted random stance selection). Results are worse than manual play but functional.
- **Training mode** — no-stakes practice arena where players can test ability loadouts and skill point distributions against sparring partners (AI or friendly) without morale consequences.

### 14.3 Scope Creep — CRITICAL

The voxel-to-3D-kijo morphology pipeline with full rigged animation is the single highest technical risk in the project. It is also not needed for Phase 1.

**Hard rule:** Ship the bonsai care sim as a standalone product FIRST. Kijo previews (2D silhouette generated from tree structure) are sufficient for Phase 1. Validate that the care loop retains players before investing in the combat engine, 3D morphology, or animation pipeline.

Phase 1 success criteria: daily active users returning to water their trees without combat existing. If that metric fails, combat won't save it. If it succeeds, combat amplifies it.

### 14.4 Blockchain Balance

Care log reconstruction must be fast and cheap for marketplace browsing. A buyer browsing 50 tree listings should not wait for 50 independent reconstructions.

**Mitigations:**

- **Indexer-generated snapshots** — the indexer pre-computes tree state and voxel preview for every NFT. Marketplace displays cached snapshots, not live reconstructions.
- **Lazy verification** — buyers can independently verify (reconstruct from log and compare) but don't HAVE to. Trust the indexer for browsing, verify on purchase.
- **Log compression** — care logs use run-length encoding for repetitive sequences (e.g., "water, grow, water, grow" for 30 consecutive days compresses to a single entry with a repeat count).

### 14.5 Monetization Validation

Externally assessed as solid. Shears and fertilizer as precision tools feels fair. Subscription for time control is standard idle game monetization. No pay-to-win flags raised.

**One addition worth considering:** cosmetic pots and soil decorations as low-cost vanity items. These don't affect stats, don't affect combat, but let players personalize their grove. Low-risk revenue with high emotional attachment.

---

*This document is a living specification. Sections will be expanded as prototyping validates assumptions and playtesting reveals tuning needs.*
