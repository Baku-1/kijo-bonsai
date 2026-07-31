# Design Decision: Wisdom Stat — Age-Based Fight IQ

**Confirmed by Jeremy:** from GDD (v0.2, July 23 2026)
**Status: AUTHORITATIVE**

---

## Overview

Wisdom is the kijo's Fight IQ: pattern recognition, counter timing, the ability to read an opponent's next move. It is derived entirely from tree age (days since planting). Wisdom cannot be manufactured, purchased, accelerated beyond the time subscription modifier, or substituted by any other stat.

**The design thesis for Wisdom:** there is no shortcut to age. A 400-day tree has higher Wisdom than a 100-day tree regardless of voxel count, species, or technique. An old tree spirit has "seen everything." The passage of real time is the only input.

---

## Wisdom Source: Tree Age in Days

```
wisdom = tree_age_days
```

That's it. No formula beyond this. Wisdom is not voxel-derived (unlike HP, Power, Endurance, Ki, and Skill Points). It is not terrain-dependent (unlike stat bonuses). It is a direct linear function of time.

**This means:**
- A neglected 400-day tree with terrible health history has high Wisdom despite low Vitality.
- A perfectly tended 60-day tree is a combat novice despite optimal stat distribution.
- Older trees naturally appreciate in the secondary market partly because their Wisdom cannot be replicated.
- The time subscription (which adjusts game day speed) affects how quickly Wisdom accumulates.

---

## Wisdom Effects in Combat

### Turn-Based Model Scaling Thresholds
*(Per GDD §4.4 — see `DESIGN-COMBAT-SYSTEM-STATUS.md` for model status)*

| Tree Age | Wisdom Effect |
|---|---|
| < 100 days | No special Wisdom effects |
| 100+ days | Reveals opponent's LAST chosen stance before you commit (retrospective read) |
| 200+ days | Reveals opponent's CURRENT chosen stance 30% of the time BEFORE commitment |
| 365+ days | Reveals opponent's CURRENT chosen stance 50% of the time |
| 500+ days | Can change your own stance AFTER seeing the opponent's choice — once per fight |

The 500-day ability is the "old master" culmination — the ancient tree spirit who has seen every move, read every fighter, and can adapt in the moment.

### Fighting Game Model Scaling
*(Per GDD §4.3 — see `DESIGN-COMBAT-SYSTEM-STATUS.md` for model status)*

| Tree Age | Wisdom Effect |
|---|---|
| 100 days | Auto-blocks 10% of ambiguous/mix-up attacks |
| 365 days | Auto-blocks 35% of ambiguous/mix-up attacks |
| 500 days | Auto-blocks 50% of ambiguous/mix-up attacks |
| All ages | Faster knockdown recovery — older spirits get up faster |

In both models, Wisdom is passive. It does not require the fighter to activate or spend resources. It is always working in the background, with the edge compounding over a long set.

### Tie-Breaking

Wisdom is the tie-breaker when resolution order is otherwise equal (same species class). Higher Wisdom resolves first.

---

## Design Intent: Why Wisdom Works This Way

**Rewarding patience at the ecosystem level.** A 500-day tree owner made a commitment that cannot be rushed. Their Wisdom advantage in combat is the return on that patience — and nobody can catch up through spending or grinding. The timeline is fixed by the real clock.

**Creating the "old master" fantasy.** The Wisdom effects lean into a culturally resonant archetype: the ancient, weathered master who has seen everything. The mechanical translation — auto-blocking mix-ups, reading opponent stances, getting up faster — maps naturally to that fantasy without requiring complex AI.

**Maintaining the care loop's long-term value.** Without Wisdom, a player who grew an excellent 60-day tree and a player who grew a mediocre 365-day tree might fight at similar power levels (if the 60-day tree had perfect stat distribution). Wisdom ensures age always contributes meaningfully. The old tree is never obsolete.

---

## What Wisdom Does NOT Do

- **Does not increase combat stats** (HP, Power, Endurance, Ki). Those come from voxels and terrain.
- **Does not compensate for poor care quality.** A 400-day tree with poor health history has high Wisdom but low structural stats — it reads opponents well but hits weakly.
- **Does not override species tempo.** A 500-day Hardwood still resolves last; Wisdom only breaks ties within the same species class.
- **Does not affect morale.** The kijo's willingness to fight is governed by the morale system, not by Wisdom.

---

## Wisdom and the Abandoned Tree Market

Abandoned trees — trees that were neglected, have poor health history, but are old — have a specific secondary market value profile:

- **High Wisdom, low Vitality** — the tree reads opponents well but fights weakly
- A skilled caretaker who buys a cheap neglected 200-day tree and nurses it back to health over 60–90 days recovers a kijo with excellent Fight IQ and improving Vitality
- This creates the **tree rehabilitation market** — a secondary skill expression for caretakers who specialize in recovery

This market exists specifically because Wisdom persists through neglect — the spirit gained insight even while the tree suffered. The body can recover; the wisdom remains.

---

## For Implementers

- Wisdom is computed as `tree_age_days = floor((current_timestamp - born_timestamp) / game_day_length_seconds)`.
- Game day length is configurable via subscription: 8 real hours for free players, adjustable (2x, 4x, 8x speed) for subscribers.
- Wisdom is not stored separately — it is derived on-demand from born timestamp and current time.
- In combat, Wisdom effects are server-authoritative. The server computes the auto-block or stance reveal chance and applies it. The client does not control this.
- The specific thresholds (100, 200, 365, 500 days) are design values from the GDD — these are the current canonical thresholds unless Jeremy updates them after playtesting.
- Tie-breaking by Wisdom uses raw age in days, not a threshold bucket. 367 days beats 362 days.
- Wisdom must be recalculated at the start of each battle from the current timestamp, not cached from a previous calculation. A tree grows older between battles.

---

## For Auditors

- A newly-tended 40-day tree with no Wisdom effects is correct behavior.
- A 100-day tree with Wisdom effects (retrospective stance reveal in turn-based, auto-block in fighting game) is correct behavior.
- Wisdom being affected by pruning, fertilizing, or any care action is a **bug** — only born timestamp and current time determine Wisdom.
- Wisdom exceeding the maximum defined effects (e.g., auto-block above 50%) at any age is a **bug** — the cap at 500-day effects applies regardless of tree age beyond 500 days.
- A 500-day tree NOT having the maximum Wisdom effects is a **bug** (assuming correct born timestamp).
- Wisdom affecting HP, Power, Endurance, or Ki stats is a **bug** — it is a combat-intelligence effect only.
