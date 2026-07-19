extends Control
class_name MoveHUD

@export var target_node_path: NodePath
@export var is_player_one_hud: bool = true

var target: Node = null
var equipped_moves: Array = []
var labels: Array = []

func _ready() -> void:
	if target_node_path:
		target = get_node(target_node_path)
	if target == null and get_parent():
		target = get_node_or_null("../../" + ("Player1" if is_player_one_hud else "Player2"))
	
	if target == null:
		push_warning("MoveHUD: target not found")
		return
	
	# Wait a frame for target to load stats
	await get_tree().process_frame
	
	if target.has_method("get_equipped_move_names"):
		equipped_moves = target.get_equipped_move_names()
	else:
		equipped_moves = []
	
	_build_hud()

func _build_hud() -> void:
	# Clear old labels
	for label in labels:
		if is_instance_valid(label):
			label.queue_free()
	labels.clear()
	
	var count: int = equipped_moves.size()
	var title_text: String = "P1 Moves (" + str(count) + ")" if is_player_one_hud else "P2 Moves (" + str(count) + ")"
	
	var title_label := Label.new()
	title_label.name = "TitleLabel"
	title_label.text = title_text
	title_label.add_theme_color_override("font_color", Color(1, 1, 1, 1))
	title_label.add_theme_font_size_override("font_size", 12)
	title_label.position = Vector2(0, 0)
	title_label.size = Vector2(300, 18)
	add_child(title_label)
	labels.append(title_label)
	
	var y_offset: float = 20.0
	for i in range(count):
		var move_name: String = str(equipped_moves[i])
		var entry := Label.new()
		entry.name = "Move" + str(i + 1)
		entry.text = str(i + 1) + ". " + move_name
		entry.add_theme_color_override("font_color", Color(0.8, 0.8, 0.8, 1))
		entry.add_theme_font_size_override("font_size", 10)
		entry.position = Vector2(5, y_offset)
		entry.size = Vector2(280, 16)
		add_child(entry)
		labels.append(entry)
		y_offset += 16.0
