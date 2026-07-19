---
name: match-resolution
overview: >-
  Add win/lose state, match manager, round intro, and restart — replace
  queue_free() death with a proper conclusion loop
createdAt: '2026-07-17T04:59:58.927Z'
todos:
  - id: refactor-fighter-death
    content: >-
      Refactor fighter.gd: replace queue_free() with defeated state, add signal,
      guard input when defeated
    status: completed
  - id: create-match-manager
    content: >-
      Create match_manager.gd: connect defeated signals, show win banner,
      restart on R
    status: completed
  - id: add-round-intro
    content: 'Add FIGHT! intro flash: freeze fighters, show label, unlock after timer'
    status: completed
  - id: wire-scene
    content: >-
      Wire main.tscn: attach match_manager, add UI labels, bind ui_rematch
      action
    status: completed
  - id: verify-match-loop
    content: >-
      Run and verify: defeat sequence, banner, restart, defeated fighter can't
      act
    status: completed
---
## Match Resolution

Replace the naive `queue_free()` death with a proper match loop: fight, conclude, restart.

### fighter.gd changes (smallest possible)
- Add `signal defeated` and `var is_defeated: bool = false`
- In `take_damage`: when health <= 0, set `is_defeated = true`, emit `defeated`, set modulate to dim gray (0.4, 0.4, 0.4), stop accepting input
- Guard `_physics_process`: if `is_defeated`, return immediately (no movement, no punch)
- Remove `queue_free()`

### match_manager.gd (new, attached to Main)
- `_ready`: find both fighters via get_children(), connect each `defeated` signal
- On defeated: if already resolved, ignore. Otherwise declare the OTHER fighter winner
- Show "PLAYER 1 WINS" or "PLAYER 2 WINS" Label (centered, large font)
- Show "Press R to rematch" prompt
- On R press: `get_tree().reload_current_scene()`

### Round intro
- On match start, show "FIGHT!" label for 0.5s
- Freeze both fighters during the flash (they ignore input until it clears)
- After timer: hide label, enable control

### Scene wiring
- Main node gets match_manager.gd script
- ui_rematch action mapped to R key
- CanvasLayer labels for win banner and FIGHT flash
