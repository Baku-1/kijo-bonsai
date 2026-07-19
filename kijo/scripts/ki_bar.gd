extends Control

@export var target_node_path: NodePath = NodePath()
@export var is_player_one_ki: bool = true

var current_ki: float = 400.0
var target_node: Node = null

@onready var label: Label = $Label
@onready var bar_bg: ColorRect = $BarContainer/BarBg
@onready var bar_fill: ColorRect = $BarContainer/BarFill
@onready var bar_container: Control = $BarContainer

func _ready() -> void:
	# Get target fighter
	if target_node_path:
		target_node = get_node(target_node_path)
	
	# Set bar colors
	bar_bg.color = Color(0.3, 0.3, 0.3, 1.0)
	bar_fill.color = Color(0.0, 0.9, 1.0, 1.0)  # Cyan fill
	
	# Update label
	_update_display()

func _process(_delta: float) -> void:
	# Guard: if target node is freed, freeze bar at 0 and skip label updates
	if not is_instance_valid(target_node):
		var full_width: float = bar_container.size.x
		bar_fill.size.x = 0.0
		if not is_player_one_ki:
			bar_fill.position.x = full_width
		return

	if not target_node and target_node_path:
		target_node = get_node(target_node_path)

	if target_node:
		var fighter_ki = target_node.get("ki")
		var fighter_max_ki = target_node.get("max_ki")
		if fighter_ki != null and fighter_max_ki != null:
			current_ki = fighter_ki
			_update_display()

func _update_display() -> void:
	# Read max_ki from the target fighter at runtime
	var fighter_max_ki: float = 400.0
	if is_instance_valid(target_node):
		var val = target_node.get("max_ki")
		if val != null:
			fighter_max_ki = val
	var ratio: float = max(current_ki / fighter_max_ki, 0.0)
	var full_width: float = bar_container.size.x
	bar_fill.size.x = ratio * full_width

	# For P2 (right-aligned), move the fill so it shrinks from left
	if not is_player_one_ki:
		bar_fill.position.x = full_width - bar_fill.size.x

	# Update label text
	var label_text: String = "Ki: " + str(ceili(current_ki)) + " / " + str(fighter_max_ki)
	if is_player_one_ki:
		label_text = "P1: " + label_text
	else:
		label_text = "P2: " + label_text
	label.text = label_text
