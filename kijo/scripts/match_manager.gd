extends Node

var fighter1: CharacterBody2D = null
var fighter2: CharacterBody2D = null
var resolved: bool = false

var fight_label: Label = null
var intro_timer: Timer = null
var winner_label: Label = null
var rematch_label: Label = null


func _ready() -> void:
	# Find both fighters
	for child in get_children():
		if child is CharacterBody2D:
			if fighter1 == null:
				fighter1 = child
			elif fighter2 == null:
				fighter2 = child

	if fighter1 == null or fighter2 == null:
		push_error("MatchManager: Could not find both fighters")
		return

	# Connect defeated signals
	fighter1.defeated.connect(_on_fighter_defeated.bind(fighter1, fighter2))
	fighter2.defeated.connect(_on_fighter_defeated.bind(fighter2, fighter1))

	# Lock both fighters initially
	fighter1.can_act = false
	fighter2.can_act = false

	# Create FIGHT! intro label
	fight_label = Label.new()
	fight_label.name = "FightLabel"
	fight_label.text = "FIGHT!"
	fight_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	fight_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	fight_label.position = Vector2(340, 180)
	fight_label.size = Vector2(600, 200)
	fight_label.add_theme_color_override("font_color", Color(1.0, 0.84, 0.0, 1))
	fight_label.add_theme_font_size_override("font_size", 64)

	# Add label to CanvasLayer
	var canvas_layer: CanvasLayer = get_node_or_null("CanvasLayer")
	if canvas_layer != null:
		canvas_layer.add_child(fight_label)
	else:
		add_child(fight_label)

	# Create timer for intro
	intro_timer = Timer.new()
	intro_timer.name = "IntroTimer"
	intro_timer.one_shot = true
	intro_timer.wait_time = 0.5
	intro_timer.timeout.connect(_on_intro_timer_timeout)
	add_child(intro_timer)
	intro_timer.start()


func _on_intro_timer_timeout() -> void:
	if fight_label != null:
		fight_label.visible = false

	# Unlock fighters
	if fighter1 != null:
		fighter1.can_act = true
	if fighter2 != null:
		fighter2.can_act = true


func _on_fighter_defeated(_loser: CharacterBody2D, winner: CharacterBody2D) -> void:
	if resolved:
		return
	resolved = true

	# Determine winner name
	var winner_name: String = "PLAYER 1" if winner.is_player_one else "PLAYER 2"

	# Create winner label
	winner_label = Label.new()
	winner_label.name = "WinnerLabel"
	winner_label.text = winner_name + " WINS"
	winner_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	winner_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	winner_label.position = Vector2(340, 250)
	winner_label.size = Vector2(600, 100)
	winner_label.add_theme_color_override("font_color", Color(1.0, 0.84, 0.0, 1))
	winner_label.add_theme_font_size_override("font_size", 48)

	# Create rematch label
	rematch_label = Label.new()
	rematch_label.name = "RematchLabel"
	rematch_label.text = "Press R to rematch"
	rematch_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	rematch_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	rematch_label.position = Vector2(340, 360)
	rematch_label.size = Vector2(600, 60)
	rematch_label.add_theme_color_override("font_color", Color(1.0, 1.0, 1.0, 1))
	rematch_label.add_theme_font_size_override("font_size", 28)

	# Add to CanvasLayer
	var canvas_layer: CanvasLayer = get_node_or_null("CanvasLayer")
	if canvas_layer != null:
		canvas_layer.add_child(winner_label)
		canvas_layer.add_child(rematch_label)
	else:
		add_child(winner_label)
		add_child(rematch_label)


func _input(event: InputEvent) -> void:
	if resolved and event.is_action_pressed("ui_rematch"):
		get_tree().reload_current_scene()
