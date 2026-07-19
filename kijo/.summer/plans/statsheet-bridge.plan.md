---
name: statsheet-bridge
overview: >-
  Build KijoStats Resource class, test fixture JSONs, refactor fighter.gd and
  health_bar.gd to load stats from tree data instead of hardcoded exports
createdAt: '2026-07-17T04:35:05.642Z'
todos:
  - id: create-stats-resource
    content: >-
      Create scripts/kijo_stats.gd Resource class with typed fields and
      from_json() static loader
    status: in_progress
  - id: create-fixtures
    content: >-
      Create fixtures/oak_day200.json (hardwood) and fixtures/ficus_day200.json
      (tropical) test data
    status: pending
  - id: refactor-fighter
    content: >-
      Refactor fighter.gd to load stats from stats_path JSON, deriving
      max_health and punch_damage from StatSheet
    status: pending
  - id: fix-health-bar
    content: >-
      Fix health_bar.gd to read real max_health from target and guard
      is_instance_valid()
    status: pending
  - id: wire-scene
    content: >-
      Set stats_path on both fighters in main.tscn and verify loaded stats print
      correctly
    status: pending
---
## StatSheet Bridge

Connect fighter stats to the deterministic tree engine's StatSheet format.

### Contract (from KIJO-ENGINE-API.md §Core Types)
```
StatSheet: { hp, power, endurance, ki, skillSlots, skillPoints, wisdom, matchPct }
```
JSON keys use camelCase to match the future TS engine output.

### Files to create
- scripts/kijo_stats.gd — Resource class, from_json() loader
- fixtures/oak_day200.json — hardwood: hp 1400, power 600, endurance 900, ki 400, skillSlots 5, skillPoints 120, wisdom 200, matchPct 0.73
- fixtures/ficus_day200.json — tropical: hp 700, power 800, endurance 400, ki 1100, skillSlots 9, skillPoints 90, wisdom 200, matchPct 0.41

### Files to edit
- fighter.gd — add stats_path export, load KijoStats in _ready(), derive max_health and punch_damage
- health_bar.gd — pull max_health from target fighter, guard is_instance_valid(), stop polling on freed node
- main.tscn — set stats_path on Player1 and Player2

### Verification
- Print loaded stats per fighter on _ready()
- Health bars show different max values (1400 vs 700)
- Fallback path: bad JSON path logs fallback and uses defaults
- Damage differs: ficus punches harder (120 vs 90), oak survives longer
