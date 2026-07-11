class_name AtomicJsonFile
extends RefCounted

static func write(path: String, value: Variant) -> bool:
	var temporary := "%s.%s.tmp" % [path, str(Time.get_ticks_usec())]
	var file := FileAccess.open(temporary, FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(JSON.stringify(value, "  ") + "\n")
	file.flush()
	file.close()
	if FileAccess.file_exists(path):
		DirAccess.remove_absolute(path)
	var error := DirAccess.rename_absolute(temporary, path)
	if error != OK:
		DirAccess.remove_absolute(temporary)
		return false
	return true
