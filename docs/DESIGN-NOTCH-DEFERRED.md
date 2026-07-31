# Design Decision: Notch Mechanic — Intentionally Deferred

**Confirmed by Jeremy:** from GDD (v0.2, July 23 2026)
**Status: AUTHORITATIVE — NOT FOR IMPLEMENTATION IN CURRENT PHASE**

---

## What Notching Is

Notching is the horticultural inverse of pruning. Where shears **remove** a branch to redirect growth energy, notching **forces** a new branch to sprout at a chosen point on the trunk (or major branch).

In real bonsai practice, a bonsai artist makes a small cut (notch) near a dormant bud. This interrupts the flow of growth hormones, causes the bud to wake, and initiates a new branch at that exact location. Kijo's Notch mechanic is a direct translation of this technique.

**Mechanic:** The caretaker selects a specific coordinate on the trunk (within constraints). The game forces a new branch to begin growing at that coordinate on the next growth tick. All standard branching rules apply from that point forward.

---

## Why This Is the Most Skilled Care Action

Notching is the deepest expression of caretaker skill — terrain mastery. Every other care tool reacts to or redirects existing growth:

- Water/Fertilize → sustain and accelerate existing growth
- Rotate → bias the direction of existing growth
- Prune → remove existing growth to redirect energy
- Wire → redirect an existing branch's future growth direction

Notching is uniquely proactive: the caretaker is not reacting to what grew — they are **creating** a new growth point where none existed, at a coordinate they select deliberately.

A caretaker who has learned their seed's stat terrain through months of observation can use notching to steer the tree toward a high-value stat cluster that the natural growth algorithm would never reach. This is the master move. It requires knowing the terrain, knowing the tree's current structure, and knowing exactly where to place the new branch to maximize the path through valuable voxel zones.

---

## Constraints (from Real Bonsai Practice)

These are not yet implemented, but when Notch ships, the following constraints apply:

- **Cannot notch the lower third of the trunk.** Classical bonsai form requires the lower trunk to remain bare — the exposed trunk conveys maturity. No branches may emerge from this zone, and notching cannot create them there.
- **Cannot notch where a branch already exists** (dead or alive). One branch per notch point.
- **Cannot notch depth-1 branches** (they are too far from the primary growth axis). Notching applies to the trunk and major structural points only.
- **Cannot notch within a fixed distance of an existing branch** — exact distance TBD during implementation.
- **Notching is a premium action.** It requires a premium consumable (Notch Tool, or possibly an extension of the Jin Pliers tool family — TBD).

---

## Why It Is Deferred

Notching is excluded from the current prototype and Phase 1 for two reasons:

**1. Phase ordering:** The bonsai side must ship as a standalone product first. Notching is an advanced care action for players who have already mastered terrain navigation through months of play. Building it before the core loop is validated wastes development resources on content that new players will never reach.

**2. Implementation complexity:** Forcing a branch at an arbitrary trunk coordinate, subject to real structural constraints, requires the growth engine to handle externally-seeded branch origins cleanly. This is distinct from the standard branching rules and needs to integrate correctly with the voxelizer, the morphology mapper, and the stat terrain computation. Building it right requires the rest of the growth pipeline to be stable first.

**Notching must not be accidentally implemented early.** If a feature ticket, prototype, or growth system update enables arbitrary branch placement without the full constraint set and without the notch action economy (premium tool, deliberate player choice), it is violating the design intent.

---

## For Implementers

- **Do not implement notching in Phase 0 or Phase 1.** Phase 2 is the earliest possible target. Confirm with Jeremy before scoping any notch work.
- The notch action, when it ships, must be logged in the care log as a distinct action type with the target coordinate as its parameter: `{ action: "notch", params: { x, y, z }, timestamp }`.
- The growth engine must support externally-seeded branch origins (trunk coordinates from which a new depth-1 or depth-2 branch begins growing on the next tick).
- Constraint validation (lower third, existing branch proximity, trunk-only) must be enforced before the action is accepted. A caretaker should not be able to spend a notch consumable on an invalid coordinate.
- Notching is NOT a free action. It requires a premium consumable that is consumed on use regardless of whether the new branch survives to maturity.
- When implemented, notching should appear in the care log and be visible to fighters and marketplace buyers as part of the tree's provenance — a notched tree demonstrates advanced caretaking.

---

## For Auditors

- Any branch appearing at a coordinate not reached by the standard L-system growth algorithm, without a corresponding notch action in the care log, is a **bug** — it means the growth engine generated unexpected output.
- Any care action with type "notch" appearing in a Phase 0 or Phase 1 care log is a **bug** — notch is not yet implemented.
- When notch IS implemented, branches growing from notched coordinates must obey all standard growth rules from that point forward — they are not exempt from depth limits, fork probability, or species constraints.

---

## Tracking Note

This document exists to ensure notching is not forgotten AND not accidentally built before it is ready. The GDD explicitly flags it as "Deferred — not in the current prototype; tracked for the care-loop feature set." When Phase 2 scoping begins, this document should be the starting point for the feature spec.
