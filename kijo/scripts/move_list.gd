extends Node
class_name MoveList

## Direction constants for combo matching
enum Dir { NONE, FORWARD, BACK, DOWN, UP }

## Effect types a move can apply
enum Effect { NONE, STAGGER, SLOW, ARMOR, HOLD, DRAIN, BUFF }

## A single move definition
class Move:
	var name: String
	var combo: Array  # Array of Dir enums
	var key_action: String  # "punch" or "special"
	var damage_mult: float
	var effect: int  # Effect enum
	var effect_duration: float
	var description: String
	
	func _init(n: String, c: Array, k: String, d: float, e: int, dur: float, desc: String):
		name = n
		combo = c.duplicate()
		key_action = k
		damage_mult = d
		effect = e
		effect_duration = dur
		description = desc

## Build and return the full 9-move roster at runtime.
static func get_full_roster() -> Array:
	return [
		Move.new("Jab", [Dir.FORWARD], "punch", 1.0, Effect.NONE, 0.0, "Quick forward jab"),
		Move.new("Cross", [Dir.FORWARD, Dir.FORWARD], "punch", 1.4, Effect.NONE, 0.0, "Heavy cross punch"),
		Move.new("Uppercut", [Dir.FORWARD, Dir.DOWN], "punch", 1.2, Effect.STAGGER, 0.5, "Launches foe, staggers"),
		Move.new("Low Kick", [Dir.DOWN], "punch", 0.8, Effect.SLOW, 2.0, "Trips and slows foe"),
		Move.new("Canopy Slam", [Dir.BACK, Dir.FORWARD], "punch", 1.8, Effect.STAGGER, 0.8, "Always staggers"),
		Move.new("Ki Blast", [Dir.BACK], "punch", 1.1, Effect.NONE, 0.0, "Ranged ki strike"),
		Move.new("Heavy Slash", [Dir.FORWARD, Dir.FORWARD], "special", 1.6, Effect.NONE, 0.0, "Powerful special slash"),
		Move.new("Whirlwind", [Dir.BACK, Dir.FORWARD], "special", 1.3, Effect.SLOW, 2.0, "Multi-hit whirlwind"),
		Move.new("Guardian Stance", [Dir.DOWN, Dir.DOWN], "special", 0.0, Effect.ARMOR, 3.0, "Self-buff: 50% DR for 3s"),
	]

## Return the first N moves (by skillSlots count)
static func get_equipped_moves(skill_slots: int) -> Array:
	var roster: Array = get_full_roster()
	var moves: Array = []
	for i in range(min(skill_slots, roster.size())):
		moves.append(roster[i])
	return moves

## Convert a raw input direction string into Dir enum relative to facing
## "left"/"right" inputs are translated to BACK/FORWARD based on facing_right
static func input_dir_to_relative(raw: String, facing_right: bool) -> int:
	match raw:
		"left":
			return Dir.BACK if facing_right else Dir.FORWARD
		"right":
			return Dir.FORWARD if facing_right else Dir.BACK
		"down":
			return Dir.DOWN
		"up":
			return Dir.UP
	return Dir.NONE

## Try to match a sequence of recent dir inputs + attack key against equipped moves.
## Returns the matching Move or null.
static func match_combo(dir_history: Array, action: String, equipped: Array, facing_right: bool) -> Move:
	# Convert dir_history (strings "left"/"right"/"down") to relative Dir enums
	var relative_dirs: Array = []
	for d in dir_history:
		var rel: int = input_dir_to_relative(d, facing_right)
		if rel != Dir.NONE:
			relative_dirs.append(rel)
	
	# Check moves from last equipped to first (prefer longer combos)
	for idx in range(equipped.size() - 1, -1, -1):
		var move: Move = equipped[idx]
		# Must match the action key
		if move.key_action != action:
			continue
		var combo: Array = move.combo
		# Combo must fit at end of history
		if combo.size() > relative_dirs.size():
			continue
		var start_idx: int = relative_dirs.size() - combo.size()
		var match_all: bool = true
		for ci in range(combo.size()):
			if relative_dirs[start_idx + ci] != combo[ci]:
				match_all = false
				break
		if match_all:
			return move
	return null
