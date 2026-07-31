# Design Decision: Leaf Color Rarity System

**Confirmed by Jeremy:** from GDD (v0.2, July 23 2026)
**Status: AUTHORITATIVE — INTERNAL USE ONLY (DO NOT SURFACE IN PLAYER-FACING DOCUMENTATION)**

---

## Overview

Each kijonsai seed rolls a leaf color from its species class palette at mint. Most seeds produce common colors. A small fraction (~3%) produce a rare color variant. Rare leaf colors are cosmetic only — no stat implications — but they are permanent, visible on both the kijonsai and the kijo's crown, and marketplace-relevant.

**The rarity system is intentionally undisclosed.** It must not appear in player-facing documentation, mint screens, help text, or community posts from the development team. It is an easter egg. Players discover it organically. The surprise is the product.

---

## Color Palettes by Species Class

| Species Class | Common Colors | Rare Color |
|---|---|---|
| Hardwood | Red, Green | **Maroon (blood-red)** |
| Evergreen | Green, Blue | **Cyan** |
| Tropical | Green, Dark Green, Tan/Brown | **Yellow** |

Exact hex values are defined in the art pipeline. These descriptions define the intent — implementation should produce colors that are visually distinct and recognizable as rare variants within their species class.

### Seasonal Behavior

Rare colors modify the seasonal palette — they do not replace it. A Maroon Hardwood does not simply display dark-red in all seasons. Its leaf progression is:
- **Spring:** Lighter wine-red / burgundy (new growth)
- **Summer:** Full deep maroon
- **Autumn:** Deep crimson with warm underlays
- **Winter:** Bare (hardwood seasonal behavior unchanged)

The rare color is always recognizable as distinct from the common colors, but it interacts with the season naturally. A Cyan Evergreen maintains its cyan through all seasons (no leaf drop). A Yellow Tropical shows yellow leaves in summer growth, paler variants in winter stall periods.

---

## Roll Rate

**~3% at mint.** This value is internal. It must not be published.

The roll is seeded deterministically from the mint's `seed` value — the same seed that governs all growth. A given seed either has a rare color or it doesn't; the outcome is fixed at mint and verifiable from the seed. Third-party tools could in principle calculate it.

---

## Kijo Crown Inheritance

The kijo's crown/hair inherits the leaf color directly. A Cyan Evergreen kijo has a cyan crown. A Maroon Hardwood kijo has a crimson-maroon crown. A Yellow Tropical kijo has a vivid yellow crown.

This makes the rare color visible in combat — a recognizable kijo that stands out from her class peers. The crown is prominent in both combat and in community clips and screenshots. Rare-color kijo are naturally recognizable and shareable.

---

## Why Undisclosed

Disclosed rarity creates anticipation and then disappointment when the odds don't go your way. Undisclosed rarity creates **surprise and discovery**. A player grows their tree, the leaves come in an unexpected color, and they post about it. Others ask "what color is that? how did you get it?" The answer is "it just... happened." This spreads through the playerbase as organic discovery, not documented percentages.

Documented rarity becomes a transaction: "I have a 3% chance." Undiscovered rarity becomes a story: "I grew something I've never seen before."

**Do not leak the rate in any public-facing communication.** If players ask devs about the rate, the answer is "we're not saying." Players figuring out ~3% themselves through on-chain data analysis is fine and is expected behavior.

---

## Marketplace Behavior

Rare leaf colors will naturally command a premium on secondary markets. This is player-driven pricing, not an explicitly tiered system. The game does not badge rare leaf colors with a "RARE" label in the marketplace — the NFT visual makes them visible, and the community market does the rest.

The leaf color appears in the kijonsai's visual rendering on marketplace listings. A Cyan Evergreen is instantly visually distinct from a standard Green Evergreen. Buyers can see it; they will price it accordingly.

---

## For Implementers

- Leaf color is determined at mint from the seed: `leaf_color = derive_leaf_color(seed, species_class)`.
- The derivation must be deterministic — the same seed always produces the same color.
- Common vs. rare color assignment: use seed-derived value modulo 100 with the threshold set at 97 for rare (i.e., seeds where `seed_derived_color_roll >= 97` produce the rare color). Exact threshold is calibrated to hit ~3%.
- Leaf color must be stored as a palette index in the NFT metadata (not as a hex value directly) — the palette maps index to hex values for each season.
- The kijo procedural mesh generation reads the leaf color palette and applies it to the crown generation step.
- Leaf color must NOT appear as a named trait or rarity label in the NFT metadata. It should appear as part of the visual asset — visible to the eye, not declared in the metadata fields that marketplace tools read for rarity scoring.
- Seasonal palette shift must be applied relative to the base leaf color — do not hardcode seasonal colors independently per species.

---

## For Auditors

- A tree rendering with a rare leaf color that the owner has not noticed or mentioned is correct behavior — the easter egg works.
- Rare leaf color appearing in any player-facing rarity UI, trait list, or documentation is a **design violation** — remove it.
- Rare leaf color affecting any stat is a **bug** — it is cosmetic only.
- Rare leaf color not inheriting to the kijo's crown is a **bug** — the crown must use the same color.
- Leaf color changing between seasons is correct (seasonal palette shift). Leaf color changing between mints of the same seed is a **bug** — the derivation is deterministic.
