# Schemas and definitions

[`movement/v1.schema.json`](movement/v1.schema.json) remains the canonical JSON Schema through Phase 1A.1. It fixes `schemaVersion` to `1`, `kind` to `movement-profile`, rejects unknown fields at every object level, and permits only `camera_relative` orientation and `movement_input` dodge direction.

Ajv performs structural validation. Project-owned semantic validation then enforces speed ordering, positive rates, stamina relationships, dodge limits, and invulnerability-window timing. Ajv diagnostics are normalized into stable `mam-engine` errors rather than exposed as the only public format.

Godot may consume this definition in Phase 1B, but it may not replace it with scene or resource defaults.
