# Design Decision: Combat System Direction — Status Document

**Confirmed by Jeremy:** from GDD (v0.2, July 23 2026)
**Status: UNDER REVIEW — DO NOT IMPLEMENT EITHER SYSTEM WITHOUT EXPLICIT SIGN-OFF**

---

## The Problem This Document Addresses

The GDD contains **two distinct combat system designs** that are not reconciled:

- **Section 4.3** — Fighting Game Model (real-time 2D fighter, directional combo inputs, Street Fighter/Mortal Kombat feel)
- **Section 4.4** — Turn-Based Stance System (Rock-Paper-Scissors style stance resolution, similar to Axie)

The GDD explicitly flags this conflict with a warning at the top of Section 4.3:

> *"⚠️ DIRECTION SHIFT: The following reframes skill points as fighting game combo slots. This likely supersedes the turn-based stance system in Section 4.4. Both are preserved during review. The fighting game direction is the current leading candidate."*

The combat engine has not yet been implemented. This document exists to prevent the wrong system from being built, and to prevent the two conflicting specs from creating ambiguity in other documents.

---

## System A: Fighting Game Model (Section 4.3) — LEADING CANDIDATE

**Summary:** Real-time 2D fighter. Directional pad + action button inputs. Specials triggered by combo inputs. The player's manual execution during real-time combat is the primary skill expression.

Key properties:
- **Real-time input** — mechanical execution skill from the fighter. A moveset is useless if the fighter can't execute under pressure.
- **Depth-2 branches = combo slots** — each sub-branch is one programmable special move. Fewer branches = fewer moves. More branches = more options.
- **Combos are fighter-programmed** — the input sequence for each special is set by the fighter before battle. Grappler clusters around ← ← sequences. Rushdown player favors → → chains.
- **Voxel count = move power** — thicker sub-branches produce stronger specials. Pruning concentrates voxels into fewer, devastating moves.
- **Species affects movement** — Hardwood: slow/heavy/super armor. Evergreen: medium/reliable chain. Tropical: fast/punishable on whiff.
- **Wisdom:** auto-blocks at rates proportional to tree age. 100 days = 10% auto-block. 365 days = 35%. 500 days = 50%.
- **Tag team:** tag moves are directional inputs (← ← + tag, → → + tag for partner assist).

**Skill points in this model:** Come from voxel terrain coordinates (stat layer). Distributed across depth-2 branch combo slots. More slots = thinner spread per slot. Fewer slots = concentrated power.

**GDD status:** "Current leading candidate."

---

## System B: Turn-Based Stance System (Section 4.4) — FIRST DRAFT, POSSIBLY SUPERSEDED

**Summary:** Turn-based tactical combat. Each round both kijo commit to a stance simultaneously. Stances resolve against each other by a matrix.

Key properties:
- **Four stances:** Root (defensive/heal), Strike (commit ability), Guard (auto-counter), Reach (long-range, high risk)
- **Stance matrix resolution** — known matchups: Strike beats Root partially, Guard counters Strike, etc.
- **Resolution order** — Tropicals first, Evergreens second, Hardwoods last. Ties by Wisdom.
- **Wisdom:** reveals opponent's last-chosen stance (100+ days), opponent's current stance 30% of time (200+ days), 50% reveal (365+ days), can change stance after seeing opponent's once per fight (500+ days).
- **Ki resource** — abilities cost Ki. Ki regenerates +5%/turn. Leaf-heavy kijo regenerate faster.
- **Endurance check** — taking >15% HP in one hit triggers a stagger check. More branches = less stagger vulnerability.
- **Damage formula** defined in GDD (specific values are placeholder tuning).

**GDD status:** "First-draft. The stance interactions, damage formulas, Wisdom scaling thresholds, skill point economy, and Ki resource pacing all require playtesting and balance iteration before locking. The fighting game direction is the current leading candidate."

---

## What This Means for Other Systems

Several GDD systems are described without specifying which combat model they apply to. Until the combat system is resolved, these must be treated as directional but not implementation-ready:

| System | Fighting Game interpretation | Turn-Based interpretation |
|---|---|---|
| **Wisdom stat** | Auto-block rate proportional to age | Stance reveal probability by age thresholds |
| **Skill Points** | Distributed across depth-2 branch combo slots; buff damage scaling, effect duration, cooldown reduction | Invested in abilities per turn; modify stance-based ability potency |
| **Ki resource** | Not explicitly defined for fighting game | Regenerates +5%/turn; depletes on ability use; leaf-heavy kijo have larger pool |
| **Endurance** | Not explicitly defined for fighting game | Stagger check when hit >15% HP; branch count reduces vulnerability |
| **Species tempo** | Resolution order / startup/recovery frames | Turn resolution order |
| **Tag mechanic** | Directional input combo | Not defined in turn-based spec |

---

## Current Direction

**Fighting game is the leading candidate.** Per GDD notation, Section 4.4 was the first draft; Section 4.3 represents the current design direction.

However, no combat engine has been implemented. The systems share enough conceptual overlap (voxel → stats, species → tempo, Wisdom → strategic edge, Ki → resource management) that the stat derivation pipeline (voxels → HP, Power, Endurance, Ki) can be built without resolving the combat question.

**What CAN be built without this decision:**
- Stat derivation from tree morphology (structural stats)
- Terrain bonus calculation from seed (Layer 2 stats)
- Kijo morphology generation (tree → body)
- Morale system (independent of combat model)

**What CANNOT be built without this decision:**
- Combat resolution engine
- Ability/skill point system
- Wisdom effects in combat
- Ki resource system
- Matchmaking (needs to know what "a match" is)

---

## Resolution Process

Before Phase 2 combat implementation begins:
1. Jeremy decides between fighting game and turn-based — or designs a hybrid.
2. The chosen system replaces Section 4.4 or Section 4.3 as the sole authoritative combat spec.
3. This document is updated with the decision and the superseded section is clearly marked obsolete.
4. All dependent system specs (Wisdom, Ki, Endurance, Skill Points in combat) are updated to match the chosen model.

Until that decision is recorded here:
- **Do not implement either combat model.**
- **Do not write system specs that assume either model without explicitly noting the assumption.**
- **Stat derivation work is safe to proceed** (the stat values are model-agnostic).

---

## For Implementers

- Phase 1 does not include combat. Do not implement any combat system in Phase 1.
- Stat derivation and kijo morphology work should proceed without referencing combat resolution details.
- If a feature ticket references Section 4.4 combat mechanics (stance matrix, turn resolution), note this document and flag for Jeremy before proceeding.
- If a feature ticket references Section 4.3 fighting game mechanics (combo inputs, directional inputs, real-time resolution), same flag applies.

---

## For Auditors

- Any combat code written during Phase 1 is out-of-scope and should be flagged.
- Any spec document that presents either combat model as finalized without citing Jeremy's explicit sign-off is premature and should be flagged.
- The stat derivation pipeline (voxels → HP/Power/Endurance/Ki) is NOT affected by this uncertainty — those values exist regardless of how combat resolves them.
