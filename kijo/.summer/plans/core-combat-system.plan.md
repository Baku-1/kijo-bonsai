---
name: core-combat-system
overview: >-
  Guard mechanic, skill-slot driven move list with 3 working effects, endurance
  stagger, wisdom auto-block, move HUD
createdAt: '2026-07-18T01:57:53.423Z'
todos:
  - id: guard-mechanic
    content: >-
      Add guard input (p1_guard=S, p2_guard=down-arrow): 70% damage reduction,
      no movement/attack/ki regen, blue tint
    status: in_progress
  - id: move-list-system
    content: >-
      Create move_list.gd with 9-move roster. Fighter equips first N=skillSlots
      moves. Input parsing for directional combos.
    status: pending
  - id: move-effects
    content: >-
      Implement stagger (0.5s freeze), slow (2s halved speed), armor (50% DR
      3s). Stub hold/drain/buff.
    status: pending
  - id: endurance-wisdom
    content: >-
      Endurance stagger threshold (0.5*endurance). Wisdom auto-block tiered by
      age (15% at 200 days).
    status: pending
  - id: move-hud
    content: 'Move list panel per player showing equipped moves. Hardwood 7, tropical 4.'
    status: pending
---
## Core Combat System

### Guard (new inputs: p1_guard=S, p2_guard=down-arrow)
- Active while held, not toggle
- Damage * 0.3, no movement/jump/attack, no ki regen
- Blue tint visual cue

### Move List (scripts/move_list.gd + fighter.gd integration)
- 9-move roster with name, input combo, ki_cost, damage_mult, range, effect
- Directional combos: back/forward/up/down + special/punch
- skillSlots determines how many are equipped (auto-equip in order)
- 3 working effects: stagger, slow, armor

### Endurance & Wisdom
- Stagger when damage > endurance*0.5
- Wisdom auto-block: tier 0=0%, 1=8%, 2=15%, 3=25%, 4=40%
- Gold shimmer visual on auto-block
