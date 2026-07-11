# Movement fixture

[`basic-ground.fixture.json`](basic-ground.fixture.json) registers the controlled third-person movement fixture implemented in Phase 1B. It names the Godot scene, 1/60-second timestep, and exactly five scenarios: accelerate, stop, sprint, dodge, and turn.

The fixture consumes the same complete validated profile used by deterministic simulation. It is acceptance infrastructure, not a product, game prototype, or alternate movement source. Camera yaw is supplied per request and displacement is measured headlessly.
