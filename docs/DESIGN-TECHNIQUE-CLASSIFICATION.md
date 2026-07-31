# Design Decision: Technique Classification

**Confirmed by Jeremy:** from GDD (v0.2, July 23 2026)
**Status: AUTHORITATIVE**

---

## Overview

A kijonsai's technique is the second axis of its combat identity (Species is the first). Technique is **never chosen by the player** — it emerges from the care log. The classifier reads what the caretaker actually did and names what the tree became. This is a descriptive system, not a prescriptive one.

Technique × Species = the kijo's full combat archetype. See `DESIGN-SPECIES-TECHNIQUE-ARCHETYPES.md` for the 12-archetype grid.

---

## The Four Techniques

### Primary Techniques (mutually exclusive)

A tree has exactly one primary technique at any time.

#### Bound-and-Cut
- **Historical origin:** Traditional combined penjing method — the "tied and cut" tradition that Gu Ahao synthesized from all three schools.
- **Care pattern:** Wire uses > 0 AND prune uses > 0. The caretaker used both precision tools.
- **Combat archetype:** **Balanced** — moderate stats across the board, no exploitable weakness. Adaptable, well-rounded. The jack-of-all-trades.
- **Default:** Bound-and-Cut is the default technique. Any tree that uses both tools and does not qualify for Clip-and-Grow lands here. A tree with no qualifying actions at all also defaults to Bound-and-Cut.
- **Discovery notification:** NONE. Bound-and-Cut never triggers a spirit message. Most players arrive here naturally without realizing technique classification exists.

#### Clip-and-Grow (Absolute Clip-and-Grow)
- **Historical origin:** Lingnan School — the strict clip-and-grow method that rejected wire entirely as a philosophical commitment, not just a technique preference.
- **Care pattern:** prune uses ≥ 2 AND wire uses == 0 (ever) AND tree age ≥ 30 game days.
- **Combat archetype:** **High-Crit** — low sustained damage but devastating critical hits. Jagged, explosive power spikes from regrowth patterns. Wild, aggressive silhouette.
- **The wire disqualification rule:** A single wire use at any point in the tree's lifetime permanently disqualifies Clip-and-Grow. No exceptions. No recovery. The disqualification is tracked in the care log forever. This is intentional — it mirrors the Lingnan School's philosophical rejection of metal shaping. A caretaker who touches wire, even once, chose a different path.
- **Discovery notification fires once when:** age ≥ 30 game days AND prune count ≥ 2 AND wire count == 0. Message: *"Your kijo's spirit resonates with divine power. Your kijonsai has never known wire."* Fires only once, never again.

---

### Overlay Techniques (additive, not exclusive)

A tree can carry one or both overlay techniques simultaneously with its primary technique. Overlays are stored separately from the primary; the classifier returns both. A tree's full technique state might be: `primary: CLIP_AND_GROW, overlays: [JIN, WATER_AND_LAND]`.

#### Jin (Trunk Splitting / Deadwood)
- **Historical origin:** The jin and shari deadwood techniques — stripping bark to create exposed, hardened deadwood. Deliberate structural damage that hardens the interior.
- **Care pattern:** jin/bark-stripping actions ≥ 1. Just one jin pliers use qualifies. The threshold is low because each use is a meaningful, deliberate, irreversible act.
- **Combat archetype:** **Defensive** — high Defense and Endurance. Fights by absorbing punishment and outlasting. Exposed heartwood = hardened interior. Scarred, weathered, unkillable.
- **Jin is an OVERLAY.** A tree can be Jin AND Bound-and-Cut, or Jin AND Clip-and-Grow, simultaneously. Jin stacks on top of the primary — it does not replace or compete with it. The primary classification determines the base archetype; Jin adds a defensive layer on top.
- **Tool:** jin pliers (premium consumable). Strips bark from a branch section, converting bark voxels to hardened deadwood voxels with a Defense bonus.
- **Discovery notification fires once when:** first jin pliers use. Message: *"Your kijo's heart hardens where the bark was stripped. Strength grows from the wound."* Fires only once.

#### Water-and-Land
- **Historical origin:** Shanshui penjing — landscape composition tradition placing rocks, water features, and decorations around the tree to create a living scene.
- **Care pattern:** landscape element count ≥ 3. Rocks, water features, moss, ceramic decorations placed around the tree.
- **Combat archetype:** **None.** Water-and-Land is a care-loop and display technique only. A kijo grown with Water-and-Land still awakens and can fight, but the landscape elements do not modify combat stats or fighting style. This is the pure aesthetic/collector path — the Exhibition feature.
- **Water-and-Land is an OVERLAY.** Any tree can have landscape elements regardless of its primary technique. A Clip-and-Grow + Water-and-Land tree is a philosophical purist who also creates beautiful scenes. The landscape and the fighting technique coexist.
- **Discovery notification fires once when:** first landscape element placed. Message: *"Your kijo's body settles into the landscape. She is no longer just a tree — she is a world."* Fires only once.

---

## Critical Classification Rules

### Twine ≠ Wire (for technique classification)

Twine is NOT wire for the purposes of Clip-and-Grow disqualification. The distinction is rooted in the Lingnan School's actual philosophy: they rejected **metal shaping** (wire), not natural binding (twine, raffia). Accordingly:

- Twine (natural fiber, free tier) → does NOT count as a wire use
- Weights attached via twine → do NOT count as wire uses
- Wire (metal, premium consumable) → counts as a wire use, permanently

**A player using only twine + shears + weights remains Clip-and-Grow eligible.** Their wire count is 0. The classifier checks `wireCount` (metal wire uses), not "any binding action."

Twine + weights + shears (no wire ever) = Clip-and-Grow eligible. The difference is whether the caretaker also used shears — Clip-and-Grow requires shears (prune ≥ 2) and no wire; twine and weights are neutral.

### Wire Disqualification Is Permanent

The Clip-and-Grow wire disqualification persists in the care log forever. It cannot be:
- Reversed by any action
- Reset by a new season
- Overridden by a subscription feature
- Forgiven by the guild

A care log entry for a wire use, once written, marks the tree permanently ineligible for Clip-and-Grow. Even if the wire was applied accidentally, refunded, or removed immediately, the disqualification stands. The care log is append-only.

### The Minimum Thresholds Ensure Real Commitment

For Clip-and-Grow:
- **Prune ≥ 2:** One prune is an experiment. Two is a choice.
- **Age ≥ 30 game days:** A Day-3 tree that simply hasn't encountered wire isn't Clip-and-Grow. It's just new. 30 days establishes that the caretaker had meaningful opportunity to use wire and chose not to.

These thresholds prevent false classification of young or minimally-tended trees. The technique rewards conviction, not accident.

For Water-and-Land:
- **Landscape elements ≥ 3:** One rock is decoration. Three elements is a landscape composition.

For Jin:
- **Jin actions ≥ 1:** Each jin pliers use is deliberate and costly enough that even one qualifies. (Jin pliers are premium consumables — an accidental use isn't realistic.)

---

## Why Technique Emerges Rather Than Being Chosen

The system does not ask "which technique do you want?" — it watches what you do and names what you became.

A player who buys shears and wire and uses both discovers they're Bound-and-Cut. A player who refuses to ever buy wire and only prunes discovers they're Clip-and-Grow. The reward for deliberate research is arriving at a non-default technique without the game telling you how. The discovery notifications function as organic community content — a player who sees the spirit resonance message posts it, and others ask "how did you get that?" The answer spreads as player-discovered knowledge, not documented rules.

This also means **informed players have a strategic advantage** they earned by learning real penjing/bonsai traditions and applying that knowledge deliberately.

---

## Notification Design Rules

- Notifications only fire for **non-default** techniques: Clip-and-Grow, Jin, Water-and-Land.
- Each notification fires **exactly once** per tree, on first qualification.
- Notifications are framed as the **kijo's spirit responding** to how she was raised — not the game announcing a classification. The spirit feels it. The caretaker witnesses it.
- There is **no prior hint** that technique classification exists. No UI element reveals technique until the spirit stirs. The player was just caring for their tree.
- **Bound-and-Cut never notifies.** It's the default, and most players arrive there naturally. No announcement needed.

---

## Classifier Logic Summary

```
wireCount   = count of metal wire uses in care log (twine does NOT count)
pruneCount  = count of shear uses in care log
jinCount    = count of jin pliers uses in care log
landscapeCount = count of landscape elements placed

// Primary technique (mutually exclusive)
if wireCount == 0 AND pruneCount >= 2 AND treeAgeDays >= 30:
    primary = CLIP_AND_GROW
else:
    primary = BOUND_AND_CUT  // default for all other cases

// Overlays (independent, additive)
overlays = []
if jinCount >= 1:
    overlays.push(JIN)
if landscapeCount >= 3:
    overlays.push(WATER_AND_LAND)

// Full classification
technique = { primary, overlays }
```

Note: The `prune ≥ 2` and `age ≥ 30` thresholds in KIJO-TECH-SPEC.md §7.4 are marked as "R22 first-pass values" — subject to playtesting tuning. The logic structure (not the specific values) is authoritative.

---

## For Implementers

- The care log must track `wireCount` (metal wire only), `pruneCount`, `jinCount`, and `landscapeCount` as queryable running totals for efficient classification.
- Twine uses and weight uses are stored in the care log for history/audit purposes but do NOT increment `wireCount`.
- Classification is re-evaluated on every care action that could change the result. Results are cached and only recomputed when relevant action types occur.
- Discovery notifications are one-time events stored as flags on the tree record: `notified_clip_and_grow`, `notified_jin`, `notified_water_and_land`. Once set true, they are never cleared.
- The classifier must return the full state: `{ primary: "BOUND_AND_CUT"|"CLIP_AND_GROW", overlays: ["JIN"?, "WATER_AND_LAND"?] }`.
- Caretaker UI intentionally does not display technique classification. See `DESIGN-CARETAKER-OPACITY.md`. The technique is visible to fighters and in the NFT metadata, not in the live care interface.

---

## For Auditors

- A tree with zero wire AND only one prune AND age 40 days returning BOUND_AND_CUT is **correct** — prune count must be ≥ 2 for Clip-and-Grow. Do not flag this as a misclassification.
- A tree with one historical wire use returning BOUND_AND_CUT even if subsequent wire count is zero is **correct** — the disqualification is based on any-wire-ever, not current state.
- A tree classified as both CLIP_AND_GROW + JIN is **correct** — Jin is an overlay and can stack on Clip-and-Grow.
- A tree classified as both BOUND_AND_CUT + WATER_AND_LAND is **correct** — Water-and-Land is always additive.
- Water-and-Land triggering a combat archetype change is a **bug** — the technique has no combat archetype.
- Bound-and-Cut triggering a discovery notification is a **bug** — it must never notify.
- A notification firing more than once per tree per technique is a **bug** — each fires exactly once on first qualification.
