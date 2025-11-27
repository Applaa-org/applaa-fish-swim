extends Node

## Godot Loader Script
## This script reads game_spec.json and dynamically constructs the game

var game_spec: Dictionary = {}
var current_scene: Node = null

func _ready():
	print("🎮 Godot Loader: Initializing game from specification...")
	load_game_spec()
	construct_game()

func load_game_spec():
	var file = FileAccess.open("res://game_spec.json", FileAccess.READ)
	if file == null:
		push_error("❌ Failed to load game_spec.json")
		return
	
	var json_string = file.get_as_text()
	file.close()
	
	var json = JSON.new()
	var parse_result = json.parse(json_string)
	
	if parse_result != OK:
		push_error("❌ Failed to parse game_spec.json: " + json.get_error_message())
		return
	
	game_spec = json.get_data()
	print("✅ Game specification loaded: ", game_spec.get("game", {}).get("name", "Unknown"))

func construct_game():
	if game_spec.is_empty():
		push_error("❌ Cannot construct game: game_spec is empty")
		return
	
	var game_info = game_spec.get("game", {})
	var game_type = game_info.get("type", "2D")
	
	print("🎮 Constructing ", game_type, " game: ", game_info.get("name", "Unknown"))
	
	# Load and instantiate the main scene
	var scenes = game_spec.get("scenes", [])
	if scenes.is_empty():
		push_error("❌ No scenes found in game specification")
		return
	
	# Load the first scene as the main scene
	var main_scene_path = scenes[0].get("path", "")
	if main_scene_path.is_empty():
		push_error("❌ Main scene path is empty")
		return
	
	# Try to load the scene
	var scene_resource = load(main_scene_path)
	if scene_resource == null:
		push_error("❌ Failed to load scene: ", main_scene_path)
		# Fallback: construct scene dynamically
		construct_scene_dynamically(scenes[0])
		return
	
	# Instantiate the scene
	current_scene = scene_resource.instantiate()
	if current_scene == null:
		push_error("❌ Failed to instantiate scene: ", main_scene_path)
		return
	
	add_child(current_scene)
	print("✅ Main scene loaded: ", main_scene_path)
	
	# Apply game settings
	apply_game_settings()

func construct_scene_dynamically(scene_spec: Dictionary):
	print("🔧 Constructing scene dynamically from specification...")
	
	var scene_name = scene_spec.get("name", "Main")
	var scene_type = scene_spec.get("type", "2D")
	var root_type = "Node2D" if scene_type == "2D" else "Node3D"
	
	# Create root node
	var root = Node2D.new() if scene_type == "2D" else Node3D.new()
	root.name = scene_name
	add_child(root)
	current_scene = root
	
	# Construct nodes from specification
	var nodes = scene_spec.get("nodes", [])
	for node_spec in nodes:
		construct_node(root, node_spec, scene_type)
	
	print("✅ Scene constructed dynamically: ", scene_name)

func construct_node(parent: Node, node_spec: Dictionary, scene_type: String):
	var node_name = node_spec.get("name", "Node")
	var node_type = node_spec.get("type", "Node")
	
	# Create the node
	var node: Node = null
	
	match node_type:
		"Node2D", "Node3D", "Node":
			node = ClassDB.instantiate(ClassDB.get_class(node_type))
		"Sprite2D":
			node = Sprite2D.new()
		"CharacterBody2D":
			node = CharacterBody2D.new()
		"RigidBody2D":
			node = RigidBody2D.new()
		"StaticBody2D":
			node = StaticBody2D.new()
		"Camera2D":
			node = Camera2D.new()
		"MeshInstance3D":
			node = MeshInstance3D.new()
		"CharacterBody3D":
			node = CharacterBody3D.new()
		"RigidBody3D":
			node = RigidBody3D.new()
		"StaticBody3D":
			node = StaticBody3D.new()
		"Camera3D":
			node = Camera3D.new()
		"DirectionalLight3D":
			node = DirectionalLight3D.new()
		"OmniLight3D":
			node = OmniLight3D.new()
		"SpotLight3D":
			node = SpotLight3D.new()
		_:
			node = Node.new()
			print("⚠️ Unknown node type: ", node_type, ", using Node")
	
	if node == null:
		push_error("❌ Failed to create node: ", node_type)
		return
	
	node.name = node_name
	parent.add_child(node)
	
	# Set position
	var position = node_spec.get("position", {})
	if not position.is_empty():
		if scene_type == "2D":
			node.position = Vector2(position.get("x", 0), position.get("y", 0))
		else:
			node.position = Vector3(position.get("x", 0), position.get("y", 0), position.get("z", 0))
	
	# Set rotation
	var rotation = node_spec.get("rotation", {})
	if not rotation.is_empty():
		if scene_type == "2D":
			node.rotation_degrees = rotation.get("z", 0)
		else:
			node.rotation_degrees = Vector3(rotation.get("x", 0), rotation.get("y", 0), rotation.get("z", 0))
	
	# Set scale
	var scale = node_spec.get("scale", {})
	if not scale.is_empty():
		if scene_type == "2D":
			node.scale = Vector2(scale.get("x", 1), scale.get("y", 1))
		else:
			node.scale = Vector3(scale.get("x", 1), scale.get("y", 1), scale.get("z", 1))
	
	# Add script if specified
	var script_path = node_spec.get("script", "")
	if not script_path.is_empty():
		var full_script_path = script_path if script_path.begins_with("res://") else "res://scripts/" + script_path
		var script_resource = load(full_script_path)
		if script_resource != null:
			node.set_script(script_resource)
	
	# Add to groups
	var groups = node_spec.get("groups", [])
	for group in groups:
		node.add_to_group(group)
	
	# Handle specific node types
	match node_type:
		"Sprite2D":
			configure_sprite2d(node, node_spec)
		"MeshInstance3D":
			configure_mesh_instance3d(node, node_spec)
		"Camera2D", "Camera3D":
			configure_camera(node, node_spec)
	
	# Recursively construct children
	var children = node_spec.get("children", [])
	for child_spec in children:
		construct_node(node, child_spec, scene_type)

func configure_sprite2d(sprite: Sprite2D, node_spec: Dictionary):
	var texture_path = node_spec.get("properties", {}).get("texture", "")
	if not texture_path.is_empty():
		var full_path = texture_path if texture_path.begins_with("res://") else "res://assets/sprites/" + texture_path
		var texture = load(full_path)
		if texture != null:
			sprite.texture = texture
		else:
			# Create a placeholder texture
			sprite.texture = create_placeholder_texture()

func configure_mesh_instance3d(mesh_instance: MeshInstance3D, node_spec: Dictionary):
	var mesh_path = node_spec.get("properties", {}).get("mesh", "")
	if not mesh_path.is_empty():
		var full_path = mesh_path if mesh_path.begins_with("res://") else "res://assets/models/" + mesh_path
		var mesh = load(full_path)
		if mesh != null:
			mesh_instance.mesh = mesh
		else:
			# Create a placeholder mesh (box)
			var box_mesh = BoxMesh.new()
			box_mesh.size = Vector3(1, 1, 1)
			mesh_instance.mesh = box_mesh

func configure_camera(camera: Node, node_spec: Dictionary):
	if camera is Camera3D:
		var cam3d = camera as Camera3D
		var projection = node_spec.get("properties", {}).get("projection", "perspective")
		cam3d.projection = Camera3D.PROJECTION_PERSPECTIVE if projection == "perspective" else Camera3D.PROJECTION_ORTHOGONAL
		var fov = node_spec.get("properties", {}).get("fov", 75)
		cam3d.fov = fov

func create_placeholder_texture() -> ImageTexture:
	var image = Image.create(64, 64, false, Image.FORMAT_RGBA8)
	image.fill(Color(0.29, 0.62, 1.0, 1.0))  # Blue color
	var texture = ImageTexture.create_from_image(image)
	return texture

func apply_game_settings():
	var settings = game_spec.get("settings", {})
	
	# Apply window settings
	var window_settings = settings.get("window", {})
	if not window_settings.is_empty():
		var size = Vector2i(window_settings.get("width", 1280), window_settings.get("height", 720))
		get_window().size = size
		get_window().mode = Window.MODE_WINDOWED
	
	# Apply physics settings
	var physics_settings = settings.get("physics", {})
	if not physics_settings.is_empty():
		var gravity = physics_settings.get("gravity", {})
		if not gravity.is_empty():
			var game_type = game_spec.get("game", {}).get("type", "2D")
			if game_type == "2D":
				PhysicsServer2D.area_set_param(get_viewport().find_world_2d().space, PhysicsServer2D.AREA_PARAM_GRAVITY_VECTOR, Vector2(gravity.get("x", 0), gravity.get("y", 980)))
			else:
				PhysicsServer3D.area_set_param(get_viewport().find_world_3d().space, PhysicsServer3D.AREA_PARAM_GRAVITY_VECTOR, Vector3(gravity.get("x", 0), gravity.get("y", -9.8), gravity.get("z", 0)))
	
	print("✅ Game settings applied")

func reload_game():
	print("🔄 Reloading game...")
	if current_scene != null:
		current_scene.queue_free()
		current_scene = null
	
	load_game_spec()
	construct_game()
