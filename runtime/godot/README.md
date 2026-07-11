# Godot runtime adapter

This directory is reserved for Movement Editor Phase 1B. It will contain a minimal Godot 4 adapter that consumes the Phase 1A movement v1 definition, runs named fixtures, signals readiness, and returns versioned machine-readable reports.

Godot is the runtime and fixture host, not the canonical editor or definition store. Runtime defaults must not override supplied definitions silently. The adapter must honor correlation IDs, timeouts, controlled shutdown, and headless operation. No Godot project, integration code, or fixture is included in Phase 1A.
