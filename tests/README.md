# Automated tests

This directory will organize schema, validator, CLI, simulation, protocol, safety, snapshot, rollback, regression, and Godot integration tests. Fast tests must run without Godot; runtime integration and smoke tests may require Godot 4 in headless mode.

Tests will assert structured values and stable error codes. Visual observation can supplement these checks but cannot replace measurable assertions. See the [testing strategy](../docs/testing-strategy.md).
