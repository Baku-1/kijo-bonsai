# Design Decision: Flower Guild Rank

**Confirmed by Jeremy:** from GDD (v0.2; Guild lore reconciled September 24, 2026)
**Status: AUTHORITATIVE**

---

## Overview

Every kijonsai has a **Flower Guild Rank** — a publicly visible, algorithmically computed quality grade displayed on the NFT. It measures how closely the tree's actual growth matches the seed's **ideal form**: the theoretical perfect set of voxel coordinates that would maximize every stat cluster for that seed's favored bonsai style. Rank is the primary metric of caretaker skill and the main driver of NFT secondary market value.

The institution's formal in-world name is the **Decorative Tree Guild**; characters and players commonly call it the **Flower Guild**, so the public quality grade remains **Flower Guild Rank**. The exact organization, threshold ladder, and on-chain grading system are original Kijonsai fiction informed by real penjing and bonsai display and appraisal culture.

> **Reason for the 2026-09-24 revision:** Earlier text called the game's Guild and grading system historical and tied its standard to the unapproved name Gu Ahao. Evidence did not support that exact historical claim, and the owner approved a fictional Guild seller instead. This wording preserves the familiar product term without inventing history or attaching the design to a living practitioner.

---

## The Ideal Form

Each seed contains a deterministic voxel grid (the stat terrain) whose richest stat clusters are spatially organized around **traditional bonsai growth forms** (see `CANONICAL-STYLES.md`). The seed's **favored style** is the style whose corresponding spatial zone holds the densest bonuses for that particular seed.

The **ideal form** is the theoretical perfect growth pattern for that seed: the exact set of coordinates that, if filled, would overlap maximally with the seed's richest stat terrain. It is defined mathematically and is deterministically verifiable from the seed.

**The ideal form is nearly impossible to achieve by design.** This mirrors the real bonsai mastery principle: the ideal exists in the practitioner's mind, but living wood, seasonal variance, and the permanence of every cut ensure that perfection is approached but never reached.

Why perfection is unreachable:
- **Growth is organic.** The L-system growth algorithm fills voxels based on branching rules, not manual placement. Caretakers influence direction but cannot place individual voxels.
- **Pruning is permanent.** One cut at Day 50 that sends growth 3° off the ideal angle compounds over 300 days into significant deviation. There is no undo.
- **Conditions introduce variance.** Moisture fluctuations, health dips, seasonal timing shifts, missed watering days — all introduce micro-deviations that accumulate.
- **The terrain is hidden.** The stat terrain is never revealed directly. Caretakers learn their seed's ideal through observation and experimentation. Discovery takes time and carries risk.

---

## Match Percentage (matchPct)

The match percentage is the core metric: the spatial overlap between the tree's actual filled voxel coordinates and the seed's ideal form coordinates.

```
matchPct = (filled_voxels ∩ ideal_form_voxels) / ideal_form_voxels
```

A tree that has grown exactly into the ideal form scores 100%. A randomly grown tree with no deliberate shaping might score 10–20%. A tree shaped by a master caretaker over 300 days toward the seed's favored style might reach 80–90%.

**matchPct is a public field on the NFT.** Anyone can see it. It is calculable from the seed + care log by any third-party tool. It cannot be faked or manipulated.

**Important:** matchPct is NOT displayed to the caretaker in the live care interface. The caretaker sees only their tree growing. They do not receive real-time feedback on match percentage. They must infer it from growth direction and their knowledge of the seed's behavior. This is intentional — see `DESIGN-CARETAKER-OPACITY.md`.

---

## Rank Tiers

| Match % | Flower Guild Rank | What It Means |
|---|---|---|
| 0–30% | **Seedling** | Minimal care, random growth. The guild wouldn't display it. |
| 30–50% | **Sapling** | Decent care but no style awareness. A student's first attempt. |
| 50–65% | **Pruned** | Good caretaker who recognized the seed's style. Intentional cuts visible. |
| 65–80% | **Styled** | Skilled deliberate pruning toward the ideal. The guild would notice. |
| 80–90% | **Exhibition** | Master-level care over extended time. Worthy of display at a guild fair. |
| 90–95% | **Master Work** | Near-perfect execution, hundreds of days of precise care. The Guild recognizes mastery. |
| 95–100% | **Living Painting** | The asymptote: living wood that evokes the brushstrokes of classical landscape painting. Effectively impossible by design. |

The rank names trace the journey from raw beginner toward the Guild's ideal. "Living Painting" at the top is deliberately unreachable: an artistic horizon rather than a claim that one master achieved mathematical perfection.

---

## Wire Scarring and Rank

Wire management directly affects matchPct through aesthetic penalties. When wire is left on a branch past the ideal removal window, it cuts into the growing bark, creating **wire scars** — permanently visible marks on the kijonsai and on the kijo's body at the mapped location.

Wire scarring reduces matchPct because the scarred voxels represent imperfect aesthetic execution: the ideal form assumes clean, unscarred bark. Scarring means the filled coordinates deviate from the ideal surface form.

| Wire Removal Timing | Rank Impact |
|---|---|
| Too early (<6 months) | No scarring, but wasted wire — the bend didn't set. No rank penalty from scarring but the branch returned to its original angle, potentially missing stat terrain. |
| Right time (6–12 months) | No scarring. Bend set permanently. Clean result. No rank penalty. |
| Too late (>12 months) | Wire marks cut into bark. Permanent scar. **Rank penalty — matchPct reduced.** |
| Never removed | Wire embedded in bark. Heavy scarring. **Significant rank penalty.** |

### Raffia Wrap (Bark Protection)

Raffia wrap is a premium consumable applied to a branch **before** wiring. It protects the bark during the wire period so that even if the wire is left too long, no scar forms. The bend still happens, the growth still redirects, but the bark heals cleanly.

- Eliminates the wire-scar rank penalty for that wire use
- Cost: an additional consumable purchased alongside wire
- A caretaker chasing Exhibition or Master Work rank uses bark protection on every wire to preserve matchPct
- A caretaker who doesn't care about rank skips it and saves money

This creates a meaningful economic choice: cheap wire (bend + potential scar + potential rank penalty) vs. protected wire (bend + clean bark + rank preserved, higher cost).

---

## Competitive Implications

Two kijo with identical voxel counts but different Flower Guild Ranks fight differently:
- The higher-ranked kijo has stats concentrated in the seed's optimal zones — coherent and synergistic with its bonsai style.
- The lower-ranked kijo has stats scattered across suboptimal coordinates — same total power, but unfocused.

An **Exhibition** kijo fights as a composed specialist. A **Sapling** kijo fights with its power wasted on growth that missed the best terrain. Same day count, same species, same technique — but the care quality produces a fundamentally different fighter.

---

## Economic Implications

Flower Guild Rank creates a natural rarity gradient that the secondary market prices automatically:
- Higher-ranked trees command premium prices because the skill required to earn the rank is rare and the time invested is irreplaceable.
- The rank is visible on the NFT alongside the tree visual — buyers read it instantly.
- A **Styled** Day 300 oak is objectively, verifiably superior to a **Sapling** Day 300 oak. The difference is the caretaker's skill, not RNG.

The rank creates the care market's scarcity. You cannot buy Exhibition rank. You cannot roll for it. You can only grow it, one patient day at a time, with the knowledge to steer the tree toward its ideal.

---

## Exhibition Events (Future Feature)

Periodic in-game events where trees are judged purely on Flower Guild Rank — no combat. Caretakers compete on craftsmanship:
- Highest matchPct
- Best taper adherence
- Most faithful style execution

Prizes for rank thresholds. This gives pure caretakers (who never fight) their own competitive outlet, validating the care loop as a standalone game. The grading is algorithmic, verifiable, and tied to the deterministic seed standard rather than subjective jury opinion.

Exhibition Events are fictional Guild competitions informed by real penjing and bonsai display and appraisal culture. They are a **future feature, not yet implemented** in Phase 1.

---

## Wisdom vs. matchPct

These are two independent metrics that do not interact:
- **Wisdom** = tree age in days. Cannot be faked. Determines Fight IQ in combat.
- **matchPct / Flower Guild Rank** = care quality, measured by growth alignment to the ideal form.

A 400-day tree with low matchPct has high Wisdom (good Fight IQ) but unfocused stats (weak for its age). A 60-day tree with high matchPct is aesthetically excellent but has low Wisdom (poor Fight IQ). The best kijo have both: old AND well-shaped.

---

## For Implementers

- matchPct is computed from `(filled_voxels ∩ ideal_form_voxels) / ideal_form_voxels` where ideal_form_voxels is deterministically generated from the seed's stat terrain distribution.
- matchPct is stored as a uint8 (0–100) or uint16 (0–10000 for two decimal precision) on the NFT or in the indexer cache.
- matchPct is updated whenever a growth tick fills new voxels or when a prune removes voxels. It is NOT updated in real-time — it updates on growth ticks.
- Wire scar voxels reduce matchPct by replacing clean bark voxels with scarred variants that do not match the ideal form's clean surface assumption.
- Raffia wrap prevents the scar voxel from being written — the bark heals as if wire was removed on time regardless of actual removal timing.
- The Flower Guild Rank tier boundaries (0–30, 30–50, etc.) are computed from matchPct as a simple threshold lookup. The rank string is derived, not stored separately.
- matchPct is publicly readable — it must appear in NFT metadata and be queryable by third-party tools.
- **matchPct must NOT be shown in the caretaker's live care interface.** Fighters and marketplace viewers see it. Caretakers do not. See `DESIGN-CARETAKER-OPACITY.md`.

---

## For Auditors

- A tree at Day 400 with matchPct 35% (Sapling rank) is NOT a bug — it means the caretaker made poor shaping decisions or let the tree grow wild. Low rank after long age is a valid care outcome.
- matchPct decreasing after a prune is NOT a bug — if the pruned branch contained voxels that overlapped with the ideal form, removing them reduces the match count. Skilled caretakers prune branches outside the ideal form, which can increase matchPct.
- matchPct not changing between growth ticks when no new voxels were added is correct.
- A tree with wire scars showing lower matchPct than the same tree without scars is correct behavior — this is the rank penalty mechanism.
- Raffia wrap preventing the matchPct penalty for a late-removed wire is correct behavior.
- matchPct appearing in the caretaker's live care UI in any form is a **bug** (see `DESIGN-CARETAKER-OPACITY.md`).
- Living Painting (95–100%) being achievable by any normal growth process is a **design violation** — if test trees are reaching 95%+ without hundreds of days of precision care, the ideal form generation is misconfigured.
