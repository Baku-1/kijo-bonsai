# Design Decision: Species × Technique Archetypes

**Confirmed by Jeremy:** from GDD (v0.2, July 23 2026)
**Status: AUTHORITATIVE**

---

## Overview

A kijonsai's combat identity emerges from two independent axes: **Species** (what the tree is) and **Technique** (how it was raised). The cross-product of 3 species × 4 techniques produces **12 distinct combat archetypes**. These archetypes are discovered through care choices — no character creation screen, no menu selection. The player grows a tree, the archetype emerges, and the kijo fights as what she became.

For species details see `DESIGN-SPECIES.md`. For technique classification rules see `DESIGN-TECHNIQUE-CLASSIFICATION.md`.

---

## The 12-Archetype Grid

Water-and-Land is an overlay with no combat archetype contribution, so all three species × Water-and-Land produce the same result: the base species archetype, unchanged. The meaningful grid is 3 × 3 (primary techniques only) plus the Jin overlay modifier.

### Primary 3 × 3 Grid

| | **Bound-and-Cut** (Balanced) | **Clip-and-Grow** (High-Crit) | **Jin** (Defensive overlay) |
|---|---|---|---|
| **Hardwood** | The Wall — equal durability across all stats, no gap to exploit. Absorbs hits, counters steadily, wins by not losing. | **The Spike Tank** — brawler with crit spikes. Tanky AND explosive on the right hit. Opponents can't afford to let hits land while also trying to break through the defense. | Ironwood — the wall that hits back harder when wounded. Exposed heartwood absorbs enormous damage and scars over time strengthen the defense cap. |
| **Evergreen** | The Siege — moderate stats everywhere, relentless pressure tempo. Not flashy, but never lets up. Consistently winning every exchange compounds. | The Saw — steady pressure with sudden crit explosions. The opponent must respect both the consistent damage and the spike windows, creating mental overload. | The Evergreen Fortress — pressure fighter who cannot be killed. Defensive overlay on an already-relentless attacker. Must be worn down; not possible to burst. |
| **Tropical** | The Duelist — balanced stats on a glass cannon frame. Faster than most balanced archetypes, but the glass cannon fragility is still there beneath the all-rounder surface. Hardest archetype to play at low skill; rewarding at high. | **The Glass Crit Cannon** — pure explosive burst with devastatingly spiked crits. If the hit lands, fights end. If it doesn't, the Tropical recovery penalty opens the kijo to punishment. Maximum risk/reward in the game. | **The Armored Glass Cannon** — glass cannon with hardened deadwood armor. Fragile on the outside but the exposed heartwood absorbs key blows. The Jin layer means burst fighters can survive one or two exchanges they should have lost, then capitalize on the next opening. |

*Bold = explicitly named in GDD. Others are derived from the species and technique design principles.*

---

## Detailed Archetype Descriptions

### Hardwood × Bound-and-Cut — "The Wall"
- **Core identity:** The default hardwood experience. Moderate stats across the board, slow tempo, super armor on specials. No exploitable weakness.
- **Win condition:** Outlast. Root stance healing and high Endurance mean the opponent runs out of resources before the hardwood runs out of health.
- **Weakness:** Cannot burst-kill. Slow tempo means fast opponents get first strike.
- **Style for the player:** Patient, defensive-minded. Rewards stance reading and resource conservation.

### Hardwood × Clip-and-Grow — "The Spike Tank"
*Named explicitly in GDD: "a brawler with crit spikes"*
- **Core identity:** The hardwood durability foundation with Clip-and-Grow's crit damage explosive layer. The combination the GDD calls out by name.
- **Win condition:** Survive long enough for a crit spike to land, then capitalize. Opponents cannot play safely — they must attack into the tank, but attacking creates crit opportunities.
- **Uniqueness:** The only archetype that offers genuine durability AND genuine burst potential. Not as defensively pure as the Wall, not as crit-consistent as the Glass Crit Cannon, but more dangerous than either when the crit window opens on a thick-trunked kijo.
- **Weakness:** Crits are probabilistic. A run of no crits against a pressure fighter can still lose.

### Hardwood × Jin — "Ironwood"
- **Core identity:** Defensive overlay amplifies the hardwood's already-high durability. Exposed deadwood raises the Defense cap; the wall gets thicker as the fight progresses (each jin use during growth added permanent Defense).
- **Win condition:** Absolute attrition. Cannot be burst or out-sustained. The fight ends when the opponent exhausts their offense.
- **Weakness:** Minimal offensive output. This archetype wins by not dying, not by dealing damage.
- **Style for the player:** Defensive specialist. High ceiling for players who enjoy outlasting opponents across extended sets.

### Evergreen × Bound-and-Cut — "The Siege"
- **Core identity:** Relentless pressure with no gaps. Reliable frame data, chaining specials, consistent damage. Never allows the opponent to reset or breathe.
- **Win condition:** Accumulate. The siege wins by winning every small exchange. No single hit ends fights — every hit together does.
- **Weakness:** Predictable. A patient opponent who reads the pressure patterns can Guard effectively.
- **Style for the player:** Fundamentals-heavy. Rewards players who execute reliably rather than gambling on high-variance plays.

### Evergreen × Clip-and-Grow — "The Saw"
- **Core identity:** The evergreen's relentless pressure with sudden, unpredictable crit spikes. Opponents must respect the sustained pressure and the spike windows simultaneously — mental overload.
- **Win condition:** Create situations where the opponent must choose between respecting the crit and respecting the pressure. Either choice opens a window.
- **Weakness:** Slightly lower sustained damage than Bound-and-Cut (same species, but crit-dependent scaling means some windows produce low damage).
- **Style for the player:** Mix-up oriented. Rewards unpredictability.

### Evergreen × Jin — "The Evergreen Fortress"
- **Core identity:** Pressure fighter who cannot be burst down. The Jin layer converts what was a relentless-but-killable archetype into one that simply cannot be stopped by any short sequence.
- **Win condition:** The opponent must commit to a long fight against relentless pressure. Eventually the defense differential closes every path.
- **Weakness:** The weakest offensive output of the evergreen archetypes. Winning takes time.

### Tropical × Bound-and-Cut — "The Duelist"
- **Core identity:** All-rounder stats on a fast frame. Faster than most balanced archetypes, but the glass cannon fragility is still present beneath the surface.
- **Win condition:** Outplay. This archetype has the tools for every situation; the player must use them correctly.
- **Uniqueness:** The hardest archetype to play at low skill — the glass cannon base means mistakes are punished hard despite the balanced stats. High ceiling because of the speed + versatility combination.
- **Weakness:** Fragile. Less forgiving of mistakes than the Hardwood Wall with similar stat distribution.

### Tropical × Clip-and-Grow — "The Glass Crit Cannon"
- **Core identity:** Pure explosive burst with devastatingly spiked crits. Highest potential single-hit damage in the game. If the hit lands, fights end.
- **Win condition:** Land the crit. Setup, bait, create the opening, execute.
- **Uniqueness:** Maximum risk/reward in the entire grid. A hit at the right moment is unrecoverable for the opponent. A miss with the long Tropical recovery penalty is unrecoverable for the Glass Crit Cannon.
- **Weakness:** The most unforgiving archetype in the game. Zero margin for error on execution.
- **Style for the player:** High-skill, high-stakes. Beloved by players who want to win by making the perfect play.

### Tropical × Jin — "The Armored Glass Cannon"
*Named explicitly in GDD: "glass cannon with hardened deadwood armor"*
- **Core identity:** The glass cannon paradox — fragile on the outside, but the exposed heartwood (Jin deadwood) absorbs key blows that should end fights. The Jin layer gives the glass cannon a safety net it has no right to have.
- **Win condition:** Survive the first exchange that should have ended the fight, then counter with the glass cannon's burst damage.
- **Uniqueness:** The combination the GDD calls out by name as an example of unexpected cross-archetype power. The Jin defensive layer on the most fragile species creates a fighter that plays completely differently from expectations — appearing killable, absorbing the kill shot, then punishing the overcommit.
- **Weakness:** The safety net has limits. Sustained punishment eventually exceeds what the deadwood can absorb.

---

## Water-and-Land Overlay: No Combat Modification

When a tree carries the Water-and-Land overlay (landscape elements ≥ 3), the kijo's combat archetype is unchanged. The landscape elements are display-only. A Tropical Clip-and-Grow with Water-and-Land is still a Glass Crit Cannon — the rocks and water features around the tree do not fight.

Water-and-Land gives the caretaker access to the **Exhibition** path — competing on Flower Guild Rank rather than combat performance. See `DESIGN-FLOWER-GUILD-RANK.md`.

---

## Compound Overlays

Jin and Water-and-Land can combine with each other and with any primary. All combinations are valid:

- BOUND_AND_CUT + JIN + WATER_AND_LAND: A balanced wall that is also Jin-defended and displays a landscape. Rare because achieving Jin AND landscape AND both tool types requires significant investment.
- CLIP_AND_GROW + JIN: The philosophical purist who also stripped bark — arguably the most deliberately cultivated technique state possible.
- CLIP_AND_GROW + WATER_AND_LAND: The Lingnan School aesthetic path — pure shears, no wire, surrounded by a composed landscape scene.

No combination is invalid. No combination is more correct than another. Each represents a different caretaking philosophy.

---

## Why Build Diversity Matters

These archetypes emerge from care choices, not character creation. A fighter who wants to run a 3v3 team of Hardwood Spike Tank + Tropical Armored Glass Cannon + Evergreen Fortress needs three caretakers who each committed to specific, sustained care philosophies over 30-90+ game days. The archetype diversity isn't cosmetic — it creates team composition meta, delegation demand, and secondary market pricing for specific archetype × species combinations.

Rare archetypes (anything requiring Jin pliers or extended Clip-and-Grow commitment) command secondary market premiums because the caretaking philosophy that produces them is uncommon and takes time.

---

## For Implementers

- The combat archetype is derived at awakening from `{ species_class, primary_technique, overlays }` — these three fields fully determine the archetype.
- Jin overlay stacks its Defensive bonuses ON TOP of whatever the primary technique provides. The bonus is additive, not overriding.
- Water-and-Land overlay produces no combat stat changes. Any logic that reads the technique state for combat should explicitly ignore WATER_AND_LAND entries in the overlays array.
- Species-specific combat behavior (tempo, super armor, recovery) is determined by species_class alone and is independent of technique.
- The 12-archetype grid implies 9 distinct base stat distributions (3 species × 3 primary techniques) plus Jin overlay modifier values. Water-and-Land requires no additional stat paths.

---

## For Auditors

- A Hardwood × Clip-and-Grow kijo performing well defensively (not just offensively) is NOT a bug — the Spike Tank archetype retains full hardwood durability. The crit layer adds offense without removing defense.
- A Tropical × Jin kijo surviving more hits than expected is NOT a bug — the Armored Glass Cannon design explicitly gives the glass cannon a defensive layer. The apparent survivability is the intended behavior.
- Water-and-Land affecting any combat stat is a **bug**.
- An archetype returning anything other than its species-and-primary-derived value is a **bug** unless the Jin overlay Defense bonus is the source of the discrepancy.
- A tree with both Jin AND Water-and-Land overlays is valid and should not be flagged as an error state.
