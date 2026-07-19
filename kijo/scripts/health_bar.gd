extends Control

@export var target_node_path: NodePath = NodePath()
@export var is_player_one_health: bool = true

var current_health: float = 1000.0
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
	bar_fill.color = Color(0.8, 0.1, 0.1, 1.0)  # Red fill
	
	# Update label
	_update_display()

func _process(_delta: float) -> void:
	# Guard: if target node is freed, freeze bar at 0 and skip label updates
	if not is_instance_valid(target_node):
		var full_width: float = bar_container.size.x
		bar_fill.size.x = 0.0
		if not is_player_one_health:
			bar_fill.position.x = full_width
		return

	if not target_node and target_node_path:
		target_node = get_node(target_node_path)

	if target_node and target_node.has_method("take_damage"):
		var fighter_health = target_node.get("health")
		if fighter_health != null:
			current_health = fighter_health
			_update_display()

func _update_display() -> void:
	# Read max_health from the target fighter at runtime
	var fighter_max_health: float = 1000.0
	if is_instance_valid(target_node):
		var val = target_node.get("max_health")
		if val != null:
			fighter_max_health = val
	var ratio: float = max(current_health / fighter_max_health, 0.0)
	var full_width: float = bar_container.size.x
	bar_fill.size.x = ratio * full_width

	# For P2 (right-aligned), move the fill so it shrinks from left
	if not is_player_one_health:
		bar_fill.position.x = full_width - bar_fill.size.x

	# Update label text
	var label_text: String = str(ceili(current_health)) + " / " + str(fighter_max_health)
	if is_player_one_health:
		label_text = "P1: " + label_text
	else:
		label_text = "P2: " + label_text
	label.text = label_text
