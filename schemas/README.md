# Schemas and definitions

[`movement/v1.schema.json`](movement/v1.schema.json) remains the canonical JSON Schema through Phase 1A.1. It fixes `schemaVersion` to `1`, `kind` to `movement-profile`, rejects unknown fields at every object level, and permits only `camera_relative` orientation and `movement_input` dodge direction.

Ajv performs structural validation. Project-owned semantic validation then enforces speed ordering, positive rates, stamina relationships, dodge limits, and invulnerability-window timing. Ajv diagnostics are normalized into stable `mam-engine` errors rather than exposed as the only public format.

[`camera/v1.schema.json`](camera/v1.schema.json) is the completed Camera Editor v0.1 profile contract. [`targeting/v1.schema.json`](targeting/v1.schema.json) adds Phase 2B.1 acquisition, scoring, retention, and switching rules with the same strict unknown-field policy and project-owned semantic validation. Canonical Phases 0–10 add the remaining schemas listed by the authoritative definition registry. Runtime target candidates and current lock state are deliberately absent from persisted targeting data.

Godot consumes this definition in Phase 1B but may not replace it with scene or resource defaults. [`runtime/v1-request.schema.json`](runtime/v1-request.schema.json) and [`runtime/v1-response.schema.json`](runtime/v1-response.schema.json) publish the canonical file-transport envelopes for `mam.runtime/v1`.
