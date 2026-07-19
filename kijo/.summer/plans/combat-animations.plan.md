---
name: combat-animations
overview: >-
  Add knockback on hit, knockdown on defeat, step bob while walking, and
  improved hit feedback
createdAt: '2026-07-17T05:58:26.507Z'
todos:
  - id: knockback-on-hit
    content: Add knockback velocity when fighter takes damage — push away from attacker
    status: in_progress
  - id: knockdown-on-defeat
    content: Defeated fighter rotates 90 degrees and drops instead of just dimming
    status: pending
  - id: step-bob
    content: Vertical bob animation while walking horizontally
    status: pending
  - id: hit-feedback
    content: Screen shake or brief freeze-frame on hit for impact feel
    status: pending
  - id: verify-feel
    content: 'Run and confirm knockback, knockdown, step bob all work in play'
    status: pending
---
## Combat Animations

Code-driven visual feedback, no new sprite assets:

- Knockback: take_damage applies velocity away from attacker, brief stun
- Knockdown: defeated = rotate 90deg + drop to ground y-level
- Step bob: sin-wave y-offset while velocity.x != 0
- Hit freeze: brief time slowdown on impact (0.05s at 0.3 scale)
