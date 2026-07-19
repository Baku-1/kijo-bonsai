---
name: kijo-fighter-base
overview: >-
  Minimum playable 2D fighting game base: two fighters, movement, one attack,
  health bars
createdAt: '2026-07-17T01:51:51.792Z'
todos:
  - id: main-scene
    content: 'Create main.tscn with 2D layout: ground, two fighters, camera, HUD canvas'
    status: completed
  - id: fighter-script
    content: >-
      Write fighter.gd: movement (left/right, jump, crouch), punch attack,
      health, hitbox detection
    status: completed
  - id: health-ui
    content: Add health bar UI for both fighters
    status: completed
  - id: input-bindings
    content: 'Create input actions for both players (movement, jump, crouch, punch)'
    status: completed
  - id: run-verify
    content: 'Run and verify the base plays: both fighters visible, can move and attack'
    status: completed
---
## Scene: main.tscn (2D fighting game base)

### Node hierarchy
- Node2D "World" (root)
  - ColorRect "Ground" (visual floor)
  - Fighter (CharacterBody2D) "Player1" - left side
    - CollisionShape2D (body)
    - Area2D "Hitbox" + CollisionShape2D (attack range)
    - Sprite2D (placeholder colored rectangle)
  - Fighter (CharacterBody2D) "Player2" - right side
    - Same structure as P1
  - Camera2D
  - CanvasLayer "HUD"
    - HealthBar "P1HealthBar" (top-left)
    - HealthBar "P2HealthBar" (top-right)

### Fighter mechanics
- Movement: left/right at fixed speed, jump with gravity, crouch
- Attack: punch creates hitbox window, deals damage on overlap
- Health: 1000 HP per fighter, attack does 100 damage
- Facing: always face opponent
- Win condition: health reaches 0

### Controls
- P1: A/D move, W jump, S crouch, F punch
- P2: Arrow keys move, Up jump, Down crouch, Right Ctrl punch

### Visual
- Flat colored rectangles as placeholder art (per GameSoul: Japanese aesthetic assets come later)
- 1920x1080 default resolution
- Dark background with light ground
