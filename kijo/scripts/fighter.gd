extends CharacterBody2D

## Fighter parameters
@export var speed: float = 200.0
@export var jump_velocity: float = -400.0
@export var max_health: float = 1000.0
@export var punch_damage: float = 100.0
@export var punch_range: float = 50.0
@export var ki_regen: float = 40.0
@export var special_ki_cost: float = 50.0
@export var is_player_one: bool = true
@export var base_scale: Vector2 = Vector2(0.4, 0.4)
@export var stats_path: String = ""

## Combat stats from fixture
var endurance: float = 0.0
var wisdom: int = 0
var skill_slots: int = 0

## Internal state
var health: float = 1000.0
var max_ki: float = 400.0
var ki: float = 400.0
var pending_special: bool = false
var is_crouching: bool = false
var is_punching: bool = false
var is_guarding: bool = false
signal defeated

var is_defeated: bool = false
var can_act: bool = true
var can_punch: bool = true
var gravity: float = ProjectSettings.get_setting("physics/2d/default_gravity")
var default_sprite_pos: Vector2

## References
var opponent: Node = null
@onready var character_sprite: Sprite2D = $Sprite2D
@onready var punch_hitbox: Area2D = $PunchHitbox
@onready var punch_collision: CollisionShape2D = $PunchHitbox/PunchCollision
@onready var animation_timer: Timer = $AnimationTimer

## Move system
var equipped_moves: Array = []
var dir_history: Array = []  # String buffer: "left", "right", "down", "up"
var dir_timer: float = 0.0
const DIR_TIMEOUT: float = 0.4

## Status effects
var is_staggered: bool = false
var is_slowed: bool = false
var has_armor: bool = false
var stagger_timer: float = 0.0
var slow_timer: float = 0.0
var armor_timer: float = 0.0

## Pending move effect for hit resolution
var pending_move_effect: int = MoveList.Effect.NONE
var pending_move_duration: float = 0.0

## Guard visual
var guard_tween: Tween = null

func _ready() -> void:
	# Find opponent
	for child in get_parent().get_children():
		if child != self and child is CharacterBody2D:
			opponent = child
			break

	# Apply base scale and store default position
	character_sprite.scale = base_scale
	default_sprite_pos = character_sprite.position

	# Disable punch hitbox initially
	punch_hitbox.monitoring = false
	punch_hitbox.monitorable = false
	
	# Connect signals
	punch_hitbox.body_entered.connect(_on_punch_hit)
	punch_hitbox.area_entered.connect(_on_punch_hit_area)
	animation_timer.timeout.connect(_on_animation_timer_timeout)

	# Load stats from tree-derived JSON if a stats_path is provided
	if not stats_path.is_empty():
		var stats: KijoStats = KijoStats.from_json(stats_path)
		if stats != null:
			max_health = stats.hp
			health = stats.hp
			punch_damage = stats.power * 0.15
			max_ki = stats.ki
			ki = stats.ki
			endurance = stats.endurance
			wisdom = stats.wisdom
			skill_slots = stats.skill_slots
			var prefix_tag: String = "1" if is_player_one else "2"
			print("P" + prefix_tag + " loaded: HP=" + str(stats.hp) + " Power=" + str(stats.power) + \
				" -> punch=" + str(punch_damage) + " Ki=" + str(stats.ki) + \
				" Endurance=" + str(endurance) + " Wisdom=" + str(wisdom) + " Slots=" + str(skill_slots))
		else:
			push_warning("KijoStats: Failed to load stats from " + stats_path + ", using defaults")
			max_health = 1000.0
			punch_damage = 100.0

	# Equip moves based on skill slots
	equipped_moves = MoveList.get_equipped_moves(skill_slots)
	var prefix_tag2: String = "1" if is_player_one else "2"
	print("P" + prefix_tag2 + " equipped " + str(equipped_moves.size()) + " moves")

func _physics_process(delta: float) -> void:
	if is_defeated:
		return

	# Get input prefix
	var prefix: String = "p1_" if is_player_one else "p2_"

	# --- Status effect timers ---
	if is_staggered:
		stagger_timer -= delta
		if stagger_timer <= 0.0:
			is_staggered = false
			can_act = true
	if is_slowed:
		slow_timer -= delta
		if slow_timer <= 0.0:
			is_slowed = false
	if has_armor:
		armor_timer -= delta
		if armor_timer <= 0.0:
			has_armor = false
			_modulate_normal()

	if is_staggered or not can_act:
		move_and_slide()
		return

	# --- Guard check ---
	is_guarding = Input.is_action_pressed(prefix + "guard")
	if is_guarding and is_on_floor():
		# Guarding: stationary, no attacks, no ki regen
		velocity.x = move_toward(velocity.x, 0.0, speed)
		_apply_guard_visual()
		move_and_slide()
		return
	else:
		_remove_guard_visual()

	# Face the opponent automatically
	if opponent:
		if opponent.global_position.x > global_position.x:
			character_sprite.flip_h = false
		else:
			character_sprite.flip_h = true

	# --- Direction history for combo input ---
	dir_timer -= delta
	var dir_entered: String = ""
	if Input.is_action_just_pressed(prefix + "left"):
		dir_entered = "left"
	elif Input.is_action_just_pressed(prefix + "right"):
		dir_entered = "right"
	elif Input.is_action_just_pressed(prefix + "down"):
		dir_entered = "down"
	if dir_entered != "":
		dir_history.append(dir_entered)
		dir_timer = DIR_TIMEOUT
	if dir_timer <= 0.0:
		dir_history.clear()
	# Keep only recent inputs (max 4)
	while dir_history.size() > 4:
		dir_history.pop_front()

	# Ki regeneration (not while guarding)
	ki = min(ki + ki_regen * delta, max_ki)

	# Crouch handling (squash)
	is_crouching = Input.is_action_pressed(prefix + "crouch")
	if is_crouching and is_on_floor():
		character_sprite.scale.y = base_scale.y * 0.5
		$Collision.shape.size.y = 50.0
		$Collision.position.y = -25.0
	else:
		character_sprite.scale.y = base_scale.y
		$Collision.shape.size.y = 90.0
		$Collision.position.y = -45.0
	
	# Gravity
	if not is_on_floor():
		velocity.y += gravity * delta
	
	# Jump
	if Input.is_action_just_pressed(prefix + "jump") and is_on_floor():
		velocity.y = jump_velocity
	
	# Horizontal movement (slowed when crouching or under slow effect)
	var speed_mult: float = 0.5 if is_slowed else 1.0
	var move_speed = speed * 0.5 * speed_mult if is_crouching else speed * speed_mult
	var dir := Input.get_axis(prefix + "left", prefix + "right")
	if dir:
		velocity.x = dir * move_speed
	else:
		velocity.x = move_toward(velocity.x, 0.0, move_speed)
	
	# --- Move execution via directional combos ---
	if can_punch and not is_punching:
		if Input.is_action_just_pressed(prefix + "punch"):
			_try_execute_move(prefix, "punch")
		elif Input.is_action_just_pressed(prefix + "special") and ki >= special_ki_cost:
			_try_execute_move(prefix, "special")
	
	move_and_slide()

	# Step bob while walking
	if abs(velocity.x) > 10.0 and is_on_floor():
		var bob = sin(Time.get_ticks_msec() * 0.01) * 3.0
		character_sprite.position.y = default_sprite_pos.y + bob
	else:
		character_sprite.position.y = default_sprite_pos.y

func _try_execute_move(_prefix: String, action: String) -> void:
	var facing_right: bool = not character_sprite.flip_h
	var move = MoveList.match_combo(dir_history, action, equipped_moves, facing_right)
	
	if move != null:
		# Clear direction history on successful move
		dir_history.clear()
		
		if action == "special":
			ki -= special_ki_cost
		
		# Apply self-effect if armor
		if move.effect == MoveList.Effect.ARMOR:
			_apply_effect_on_self(move.effect, move.effect_duration)
			# Armor moves don't deal damage
			print("P" + ("1" if is_player_one else "2") + " used: " + move.name + " (self-buff)")
			_modulate_armor()
			return
		
		# Execute the move as an attack
		_execute_move_attack(move)
	else:
		# Fallback: normal punch / special
		if action == "punch":
			_start_punch()
		elif action == "special":
			pending_special = true
			_start_special()

func _execute_move_attack(move) -> void:
	is_punching = true
	can_punch = false

	# Position hitbox in front of fighter
	var facing_right: bool = not character_sprite.flip_h
	if facing_right:
		punch_hitbox.position.x = 55.0
	else:
		punch_hitbox.position.x = -55.0

	punch_hitbox.monitoring = true
	punch_hitbox.monitorable = true
	punch_collision.disabled = false

	# Store pending move info for hit resolution
	pending_special = false
	pending_move_effect = move.effect
	pending_move_duration = move.effect_duration
	
	print("P" + ("1" if is_player_one else "2") + " used: " + move.name + " (dmg x" + str(move.damage_mult) + ")")

	# Visual feedback - lunge forward briefly
	if facing_right:
		character_sprite.position.x = default_sprite_pos.x + 20.0
	else:
		character_sprite.position.x = default_sprite_pos.x - 20.0

	# Reset after brief delay
	animation_timer.start(0.18)

func _start_punch() -> void:
	is_punching = true
	can_punch = false

	var facing_right: bool = not character_sprite.flip_h
	if facing_right:
		punch_hitbox.position.x = 50.0
	else:
		punch_hitbox.position.x = -50.0

	punch_hitbox.monitoring = true
	punch_hitbox.monitorable = true
	punch_collision.disabled = false

	if facing_right:
		character_sprite.position.x = default_sprite_pos.x + 20.0
	else:
		character_sprite.position.x = default_sprite_pos.x - 20.0

	animation_timer.start(0.15)

func _start_special() -> void:
	is_punching = true
	can_punch = false

	var facing_right: bool = not character_sprite.flip_h
	if facing_right:
		punch_hitbox.position.x = 65.0
	else:
		punch_hitbox.position.x = -65.0

	punch_hitbox.monitoring = true
	punch_hitbox.monitorable = true
	punch_collision.disabled = false

	if facing_right:
		character_sprite.position.x = default_sprite_pos.x + 20.0
	else:
		character_sprite.position.x = default_sprite_pos.x - 20.0

	animation_timer.start(0.22)

func _denial_blip() -> void:
	modulate = Color(0.0, 1.0, 1.0, 1.0)
	await get_tree().create_timer(0.15).timeout
	modulate = Color(1.0, 1.0, 1.0, 1.0)

func _on_animation_timer_timeout() -> void:
	is_punching = false
	can_punch = true
	pending_special = false
	pending_move_effect = MoveList.Effect.NONE
	pending_move_duration = 0.0
	punch_hitbox.monitoring = false
	punch_hitbox.monitorable = false
	punch_collision.disabled = true
	character_sprite.position = default_sprite_pos

func _on_punch_hit(body: Node) -> void:
	if body == opponent and is_punching:
		_apply_damage_to_opponent()

func _on_punch_hit_area(area: Area2D) -> void:
	if area.get_parent() == opponent and is_punching:
		_apply_damage_to_opponent()

var last_pending_move_effect: int = MoveList.Effect.NONE

func _apply_damage_to_opponent() -> void:
	if opponent and opponent.has_method("take_damage"):
		var damage: float = punch_damage * 2.0 if pending_special else punch_damage
		pending_special = false
		# Pass pending effect info to the opponent
		var effect_type: int = pending_move_effect
		var effect_dur: float = pending_move_duration
		pending_move_effect = MoveList.Effect.NONE
		pending_move_duration = 0.0
		# Hit freeze: brief time slowdown
		Engine.time_scale = 0.3
		await get_tree().create_timer(0.05, true, false, true).timeout
		Engine.time_scale = 1.0
		opponent.take_damage(damage, effect_type, effect_dur)

func take_damage(amount: float, effect_type: int = MoveList.Effect.NONE, effect_duration: float = 0.0) -> void:
	if is_defeated:
		return

	# --- Wisdom auto-block check ---
	var wisdom_chance: float = 0.0
	match wisdom:
		0: wisdom_chance = 0.0
		1: wisdom_chance = 0.08
		2: wisdom_chance = 0.15
		3: wisdom_chance = 0.25
		4: wisdom_chance = 0.40

	if wisdom_chance > 0.0 and randf() < wisdom_chance:
		print("Wisdom block!")
		amount *= 0.5
		_modulate_wisdom_block()

	# --- Guard damage reduction ---
	if is_guarding:
		amount *= 0.3
		print("Guarded! Damage reduced to " + str(amount))

	# --- Armor damage reduction ---
	if has_armor:
		amount *= 0.5
		print("Armor absorbed! Damage reduced to " + str(amount))

	health = max(health - amount, 0.0)

	# --- Endurance stagger ---
	var stagger_threshold: float = endurance * 0.5
	var should_stagger: bool = false

	# Canopy Slam always staggers (effect is STAGGER).
	# Also stagger when damage exceeds endurance threshold.
	if effect_type == MoveList.Effect.STAGGER:
		should_stagger = true
	elif amount > stagger_threshold:
		should_stagger = true

	if should_stagger:
		_stagger()

	# --- Apply received effect (slow etc.) ---
	if effect_type != MoveList.Effect.NONE and effect_type != MoveList.Effect.STAGGER:
		_receive_effect(effect_type, effect_duration)

	# Flash red briefly (but not if wisdom blocked or guarding)
	if not is_guarding:
		modulate = Color(1.0, 0.3, 0.3, 1.0)

	await get_tree().create_timer(0.1).timeout

	if not is_guarding and not has_armor:
		modulate = Color(1.0, 1.0, 1.0, 1.0)

	# Knockback away from attacker (reduced when guarding)
	if opponent:
		var knock_dir = sign(global_position.x - opponent.global_position.x)
		var knock_strength: float = 150.0 if is_guarding else 300.0
		velocity.x = knock_dir * knock_strength

	# Brief stun (reduced when guarding)
	var stun_time: float = 0.15 if is_guarding else 0.3
	if not is_staggered:
		can_act = false
		can_punch = false
		await get_tree().create_timer(stun_time).timeout
		can_act = true
		can_punch = true

	if health <= 0.0 and not is_defeated:
		is_defeated = true
		character_sprite.rotation_degrees = 90
		character_sprite.position.y = 20
		modulate = Color(0.35, 0.35, 0.35, 1)
		defeated.emit()

func _stagger() -> void:
	is_staggered = true
	can_act = false
	stagger_timer = 0.5
	velocity.x = 0.0
	modulate = Color(1.0, 0.8, 0.0, 1.0)  # Yellow flash for stagger
	print("P" + ("1" if is_player_one else "2") + " staggered!")

## Apply an effect to the opponent when we hit them (moved to opponent's take_damage context is tricky)
## Effects are applied by the attacker through the damage system
func _apply_effect_on_target(effect_type: int, duration: float) -> void:
	if opponent and opponent.has_method("_receive_effect"):
		opponent._receive_effect(effect_type, duration)

func _receive_effect(effect_type: int, duration: float) -> void:
	match effect_type:
		MoveList.Effect.STAGGER:
			_stagger()
		MoveList.Effect.SLOW:
			is_slowed = true
			slow_timer = duration
			print("P" + ("1" if is_player_one else "2") + " slowed for " + str(duration) + "s!")
		_:
			pass # Other effects stubbed

func _apply_effect_on_self(effect_type: int, duration: float) -> void:
	match effect_type:
		MoveList.Effect.ARMOR:
			has_armor = true
			armor_timer = duration
			print("P" + ("1" if is_player_one else "2") + " armored for " + str(duration) + "s!")
		MoveList.Effect.HOLD, MoveList.Effect.DRAIN, MoveList.Effect.BUFF:
			print("Effect stubbed: " + str(effect_type))
		_:
			pass

## Visual helpers
func _apply_guard_visual() -> void:
	modulate = Color(0.3, 0.5, 1.0, 1.0)

func _remove_guard_visual() -> void:
	if not is_staggered and not has_armor:
		modulate = Color(1.0, 1.0, 1.0, 1.0)

func _modulate_armor() -> void:
	modulate = Color(0.5, 0.5, 1.0, 1.0)
	await get_tree().create_timer(0.3).timeout
	if has_armor:
		modulate = Color(0.7, 0.7, 1.0, 0.8)
	else:
		modulate = Color(1.0, 1.0, 1.0, 1.0)

func _modulate_wisdom_block() -> void:
	modulate = Color(1.0, 0.84, 0.0, 1.0)
	await get_tree().create_timer(0.2).timeout
	if not is_guarding and not has_armor:
		modulate = Color(1.0, 1.0, 1.0, 1.0)

func _modulate_normal() -> void:
	if not is_guarding:
		modulate = Color(1.0, 1.0, 1.0, 1.0)

## HUD query
func get_equipped_move_names() -> Array:
	var names: Array = []
	for move in equipped_moves:
		names.append(move.name)
	return names
