extends Resource
class_name KijoStats

## Kijo character stats loaded from JSON (camelCase) into Godot (snake_case).
## Matches KIJO-ENGINE-API.md contract.

@export var hp: float
@export var power: float
@export var endurance: float
@export var ki: float
@export var skill_slots: int
@export var skill_points: float
@export var wisdom: int
@export var match_pct: float

## Load a KijoStats from a JSON file at the given res:// path.
## Maps camelCase JSON keys to snake_case fields.
## Returns null on file-not-found or malformed JSON, with a push_error.
static func from_json(path: String) -> KijoStats:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		push_error("KijoStats: Could not open file at " + path + " (" + error_string(FileAccess.get_open_error()) + ")")
		return null

	var content: String = file.get_as_text()
	if content.is_empty():
		push_error("KijoStats: Empty file at " + path)
		return null

	var json := JSON.new()
	var parse_err := json.parse(content)
	if parse_err != OK:
		push_error("KijoStats: JSON parse error in " + path + ": " + json.get_error_message() + " at line " + str(json.get_error_line()))
		return null

	var data = json.get_data()
	if data == null or typeof(data) != TYPE_DICTIONARY:
		push_error("KijoStats: Invalid JSON structure in " + path + " (expected a dictionary)")
		return null

	# Support nested "stats" key (new engine format) or flat (old format)
	if data.has("stats"):
		data = data["stats"]

	var stats := KijoStats.new()
	stats.hp = float(data.get("hp", 0.0))
	stats.power = float(data.get("power", 0.0))
	stats.endurance = float(data.get("endurance", 0.0))
	stats.ki = float(data.get("ki", 0.0))
	stats.skill_slots = int(data.get("skillSlots", 0))
	stats.skill_points = float(data.get("skillPoints", 0.0))
	stats.wisdom = int(data.get("wisdom", 0))
	stats.match_pct = float(data.get("matchPct", 0.0))
	return stats
