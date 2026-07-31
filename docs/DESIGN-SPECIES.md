# Design Decision: Species System

**Confirmed by Jeremy:** from GDD (v0.2, July 23 2026)
**Status: AUTHORITATIVE**

---

## Overview

Species is the first and most permanent axis of a kijonsai's identity. It is chosen at planting and cannot be changed. It governs the tree's growth curve, seasonal behavior, bark and leaf aesthetics, and the kijo's base fighting style. It does **not** determine the kijo's power ceiling — that comes entirely from care quality and duration.

---

## The Three Species Classes

Kijonsai species are organized into three classes forming a strategic triangle. Within each class, specific species exist (Oak, Pine, Ficus, etc.) but all members of a class share the same growth profile and combat identity.

| Species Class | Growth Profile | Seasonal Behavior | Combat Style | Example Species |
|---|---|---|---|---|
| **Hardwood** | Slow and dense — thick trunk growth, wide branching angles, deliberate pace | Loses leaves in winter, dramatic autumn foliage (red/orange/gold), bare in winter months | **Brawler** — absorbs hits, counters, outlasts | Oak, Maple, Walnut, Elm |
| **Evergreen** | Steady year-round — no seasonal leaf loss, consistent growth rate across all seasons | Maintains full foliage through all seasons; no dramatic seasonal shift | **Pressure** — relentless advance, reliable frame data, chaining attacks | Pine, Cedar, Juniper, Spruce |
| **Tropical** | Explosive bursts — fastest class in summer, stalls in winter when not in native climate | Grows explosively in summer, significantly slowed in winter; fragile if neglected through off-seasons | **Burst** — fast damage, glass cannon, high risk/high reward | Ficus, Jade, Bougainvillea, Banyan |

---

## Growth Profiles in Detail

### Hardwood
- Trunk thickens slowly but steadily — produces the widest trunks at maturity
- Branching angles are wide; lower branches spread outward, naturally working toward Chokkan (Formal Upright) and Hokidachi (Broom) style zones
- Autumn foliage is a visual event — the kijonsai visually peaks in autumn with full seasonal color
- Winter bare state reveals branch structure in full, making pruning judgment clearest in this season
- In winter, the kijo's crown loses leaves and renders as a bare antlered/horned silhouette

### Evergreen
- Growth is the most predictable — no seasonal bonuses or penalties to account for
- Naturally tends toward Moyogi (Informal Upright) and Fukinagashi (Windswept) style zones — flowing forms that suggest perpetual movement
- The caretaker can plan care around a steady, uninterrupted schedule; there is no "rush before winter" dynamic
- Best class for new caretakers learning terrain navigation — fewer seasonal variables to juggle

### Tropical
- The fastest class but the most demanding — neglect during winter stall periods causes disproportionate health penalties
- Naturally pushes toward Kengai (Cascade) and Bunjin (Literati) style zones — dramatic, sparse, vertically extreme forms
- Explosive summer growth makes the care window critical: a well-tended tropical in summer grows more in those 30 game-days than a hardwood grows in a full season
- Fragile when neglected: health degrades faster than the other classes under drought or overwatering stress
- The highest-risk, highest-reward species class

---

## Species × Bonsai Style Affinity

Each species class has natural growth tendencies that align with certain bonsai styles. Because the stat terrain maps its richest clusters to the spatial zones of traditional bonsai growth forms (see `CANONICAL-STYLES.md` and `DESIGN-FLOWER-GUILD-RANK.md`), species and style affinity interact directly with stat optimization.

| Species Class | Naturally Aligned Styles | Effect When Doubled (Species + Style Match) |
|---|---|---|
| Hardwood | Chokkan (Formal Upright), Hokidachi (Broom) | Stacked durability — maximizes HP and Endurance from both structural and terrain sources |
| Evergreen | Moyogi (Informal Upright), Fukinagashi (Windswept) | Ultimate pressure fighter — relentless advance, unkillable endurance |
| Tropical | Kengai (Cascade), Bunjin (Literati) | Glass cannon extreme — devastating burst, maximal Ki and Skill Points, minimal safety net |

Cross-style builds (e.g., a Hardwood forced into Literati form) produce unusual fighters that break the expected archetype. A Hardwood Literati fights nothing like a standard hardwood brawler. These cross-combinations are harder to achieve (fighting species-natural growth tendencies requires deliberate, sustained pruning) but can produce hard-to-read opponents.

---

## Combat Identity by Species

Species determines tempo (resolution order in the turn-based system) and base behavior of special moves:

- **Hardwood:** Slowest tempo, resolves last in turn order. Super armor on special move startup — can take a light hit while executing. Specials have long wind-ups but deal massive damage and cannot be interrupted by light attacks. Grapplers and brawlers.
- **Evergreen:** Middle tempo. Reliable frame data — specials come out fast with short recovery. Moves chain naturally, one combo flowing into the next. Relentless pressure characters.
- **Tropical:** Fastest tempo, resolves first. Fast explosive specials, but long recovery on whiff — missing leaves the kijo wide open. High risk, high reward rushdown.

The species triangle advantage in combat is approximately 15%:
- **Hardwood > Evergreen:** The wall outlasts the siege. Root stance healing exceeds Evergreen pressure damage.
- **Evergreen > Tropical:** Consistent Guard/Strike cycling denies Tropical's Reach windows.
- **Tropical > Hardwood:** Burst speed resolves before Hardwood's slow Tempo can activate Wisdom reads.

The triangle is meaningful but beatable through superior care quality, Wisdom (age), skill point allocation, and stance reads.

---

## Species and Kijo Appearance

Species shapes the kijo's visual identity beyond combat stats:

| Species Class | Eye Color | Bark Texture | Crown Character |
|---|---|---|---|
| Hardwood | Steady amber | Rough, deep-grained, dark | Deciduous — lush in spring/summer, brilliant in autumn, bare in winter |
| Evergreen | Cool silver | Fine-grained, reddish-brown to grey-green | Always present — needle-like, dense, consistent |
| Tropical | Vibrant green | Smooth, pale-to-green | Dense tropical growth in summer, sparse in winter stall periods |

Leaf color within each species class is a rare cosmetic variant determined at mint. See `DESIGN-LEAF-COLOR-RARITY.md` for the rarity system.

---

## What Species Does NOT Determine

- **Power ceiling** — a neglected Hardwood is weaker than a well-tended Tropical. Species governs identity, not outcome.
- **Technique** — technique emerges from care actions, not species. Any species can become any technique. See `DESIGN-TECHNIQUE-CLASSIFICATION.md`.
- **Bonsai style** — the seed's favored style is seed-determined, not species-determined. A Tropical can grow Chokkan; it just grows there against its natural tendency.
- **Flower Guild Rank** — rank is determined by match percentage to the seed's ideal form. Species affects natural growth tendencies but a skilled caretaker can overcome them.

---

## For Implementers

- Species is stored as a `uint8` on-chain at mint — two fields: species class (Hardwood/Evergreen/Tropical) and specific species within that class.
- Species cannot be changed after minting. Any action that would modify the species field should be rejected.
- Growth rate modifiers are applied per growth tick based on `species_class × season` matrix. Tropical receives a multiplier in summer, penalty in winter. Hardwood and Evergreen are affected less dramatically.
- Tempo in combat resolves in order: Tropical first, Evergreen second, Hardwood last. Ties broken by Wisdom (tree age in days).
- The "species combat style" (brawler/pressure/burst) affects special move properties — startup frames, recovery, and interruption rules — not raw damage scaling.

---

## For Auditors

- A Hardwood that appears to grow faster than a Tropical in summer is NOT a bug — condition modifiers (moisture, health, fertilizer) can temporarily overcome species base rates. Flag only if Hardwood consistently outpaces Tropical across multiple seasons under identical conditions.
- A Tropical that performs well in winter is NOT a bug if the caretaker maintained excellent health and moisture. The winter penalty applies to base growth rate, not to stat quality of existing voxels.
- Species does NOT give a combat stat advantage. A Hardwood does not inherently have more HP than a Tropical. HP comes from trunk thickness (structural stat) which comes from growth quality, not species class.
- The 15% triangle modifier in combat is intentional and not a balance bug.
- Eye color is species-locked and cosmetic only — no stat implications.
