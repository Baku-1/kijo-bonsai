# Design Decision: Twine vs Wire — Free Tier vs Premium Tier Binding

**Confirmed by Jeremy: 2026-07-28**  
**Status: AUTHORITATIVE**

---

## The Core Design

Twine and wire are NOT the same tool at different price points. They are two different philosophies with different accessibility, different power, and different consequences.

**Twine = free tier.** Available to everyone, including guests and non-paying players. Weaker shaping, impermanent, forgiving.

**Wire = premium.** Costs money (purchased from Gu Ahao). Stronger shaping, permanent when used correctly, but carries a real downside if neglected.

---

## Twine (Free / All Players)

- Bends a branch ±15–20° from its natural direction
- **Temporary** — degrades over 10–15 game days, then the branch slowly springs back toward its original angle
- Must be re-applied regularly to maintain the bend
- **No negative consequence** — if you forget to re-apply, the branch just returns to its natural angle. No penalty, no scarring.
- Available to ALL players including guests
- Visually: thin natural fiber wrapping (distinct from metal wire marks)
- Does NOT penalize Flower Guild Rank (natural material, consistent with traditional penjing)
- **For technique classification:** twine counts as "binding" — twine + shears = Bound-and-Cut. A player using ONLY twine (no wire) + shears is Bound-and-Cut, NOT Clip-and-Grow.
- A player using ONLY shears + twine + weights (no metal wire ever) is still Clip-and-Grow eligible. Twine ≠ wire for disqualification purposes.

**The accessibility path:** a free player using twine can meaningfully shape their tree. They have to work harder — re-applying every 10-15 days, planning ahead, accepting less bend angle — but they are not locked out of shaping.

---

## Wire (Premium — Paid Players)

- Bends a branch ±45° from its natural direction (more than double twine's arc)
- **Permanent when removed at the right time** — the branch "sets" and grows in the new direction permanently with no scarring
- Wire removal is FREE (no consumable cost — just unwinding what was applied). The cost is attention and timing, not additional money.

**Wire timing — the risk mechanic:**

| Removal timing | Result | Consequence |
|---|---|---|
| Too early (<6 months) | Branch springs back partially or fully | Wire wasted. Bend didn't set. |
| Right time (6–12 months) | Branch sets permanently | Clean. No scarring. Wire marks fade. |
| Too late (>12 months) | Wire cuts into growing bark | **Permanent wire scarring.** Flower Guild Rank penalty. Bend IS permanent, but at cosmetic cost. |
| Never removed | Wire embedded in bark | Heavy scarring. Significant rank penalty. The kijo carries the wire marks as visible scars on her body. |

**The downside is neglect, not use.** Wire is more powerful than twine precisely because it demands attention. A player who buys wire and ignores it gets punished. A player who monitors their wired branches and removes wire at the right window gets the full benefit with no penalty.

This is intentional design: premium tools reward players who PAY AND TEND. Money alone is not enough.

---

## Weights (Free / Cheap Tier Complement to Twine)

- Small stones or weight bags attached to a branch via twine
- **Gravity-only** — can only bend downward (you cannot hang a weight upward)
- Achieves up to ~35% of wire's maximum bend arc (~15–16° downward)
- The weight stays attached until the caretaker removes it
- Over time the downward bend gradually sets (slower than wire, but permanent eventually)
- Combined with twine: twine attaches the weight, weight provides sustained downward pull
- **Free player cascade path:** a free player with twine + weights can create a classic cascading Kengai branch, slowly and cheaply
- Does NOT count as wire for technique classification (natural force / gravity, not metal shaping)
- A player using only shears + twine + weights is Clip-and-Grow eligible

---

## Summary: The Accessibility Stack

| Tool | Cost | Bend | Permanence | Downside | Classification |
|---|---|---|---|---|---|
| Twine | Free | ±15-20° | Temporary (10-15 days, must re-apply) | None | Counts as binding (not wire) |
| Weights + Twine | Free/cheap | ~16° downward only | Slow-set, eventually permanent | None | Natural force, not wire |
| Wire | Premium | ±45° | Permanent (sets in 6-12 months) | Scars + rank penalty if left >12 months | Metal wire — disqualifies Clip-and-Grow |

---

## What This Means for Implementers

- Twine and wire MUST be separate CareAction types with different parameters
- Wire requires a removal action (free, but timed) — the timing mechanic must be tracked in the care log
- Flower Guild Rank (matchPct) must apply a penalty when wire is left past the 12-month window
- The technique classifier must count twine separately from wire — twine use ≠ wire use
- A care log with zero wire ever AND twine uses = still Clip-and-Grow eligible
- A care log with even one wire use = Clip-and-Grow permanently disqualified

---

## What This Means for Auditors

- Finding that wire has a downside/penalty is NOT a bug — it is intentional design
- Finding that twine "doesn't do as much" as wire is NOT a balance problem — it is the deliberate free-tier trade-off
- Weights being "gravity-only" is NOT a limitation bug — it is realistic simulation of how physical weights work
