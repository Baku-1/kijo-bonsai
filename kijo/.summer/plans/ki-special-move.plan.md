---
name: ki-special-move
overview: >-
  Add Ki resource pool, Ki regeneration, one Ki-powered special move (Kiai
  Strike), and Ki bar UI
createdAt: '2026-07-17T05:16:36.103Z'
todos:
  - id: ki-resource-fighter
    content: >-
      Add max_ki, ki, ki_regen, special_ki_cost to fighter.gd; load ki from
      stats; regen in _physics_process
    status: in_progress
  - id: special-move
    content: >-
      Add Kiai Strike: p1_special/p2_special input, pending_special flag, 2x
      damage, longer reach/window, denial blip
    status: pending
  - id: ki-bar-ui
    content: >-
      Create ki_bar.gd mirrored from health_bar pattern, cyan fill under each
      health bar
    status: pending
  - id: wire-inputs-scene
    content: 'Bind p1_special (G) and p2_special (comma), wire ki bars into CanvasLayer'
    status: pending
  - id: verify-ki-loop
    content: >-
      Run and verify: ki regen, special hits harder, denial blip, ficus throws
      more specials than oak
    status: pending
---
## Ki Resource and Kiai Strike

One resource (Ki), one special move (Kiai Strike), no other combat additions.

### fighter.gd additions
- `max_ki: float`, `ki: float`, `ki_regen: float = 40.0`, `special_ki_cost: float = 50.0`, `pending_special: bool`
- Stats load: set max_ki/ki from stats.ki, log it
- `_physics_process`: regen ki when not defeated and can_act
- Special input: check ki cost, set pending_special flag, reuse punch hitbox
- Denial blip: brief cyan modulate (0.15s)

### ki_bar.gd
- Mirrors health_bar.gd pattern
- Reads `ki` and `max_ki` from target fighter
- Cyan fill color, positioned under health bar
- Guarded with is_instance_valid

### Inputs
- p1_special → G key
- p2_special → comma key
