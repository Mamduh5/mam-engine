# Godot runtime adapter

This directory will eventually contain a minimal Godot 4 project that consumes validated definitions, runs named fixtures, signals readiness, and returns versioned machine-readable reports.

Godot is the runtime and fixture host, not the canonical editor or definition store. Runtime defaults must not override supplied definitions silently. The adapter must honor correlation IDs, timeouts, controlled shutdown, and headless operation. No Godot project or gameplay implementation is included in Phase 0.
