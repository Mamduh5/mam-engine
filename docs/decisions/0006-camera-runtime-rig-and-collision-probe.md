# Decision 0006: Camera runtime rig and collision probe

## Status

Accepted for Camera Editor Phase 2A.2 and extended to the production consumer in `mam-engine` 0.3.0.

## Decision

Use one controlled `camera/basic-third-person` scene under the existing process-per-run `mam.runtime/v1` host. The rig separates target, follow anchor, yaw pivot, pitch pivot, collision probe, and camera responsibilities. Godot receives the complete validated camera profile in the request; the scene contains no authoritative camera defaults.

Collision evidence uses a sphere `ShapeCast3D` from the authored look-at origin toward the desired boom. The controlled wall is placed at the same canonical obstruction distance used by the domain scenario. Contact distance subtracts the authored probe radius, respects the authored minimum, and recovery uses the authored half-life after deterministic wall removal.

For production, keep the orbit, pitch, follow, recenter, collision, lens, and basis math in one reusable camera core. The controlled fixture drives that core rather than serving as its implementation. `MamCameraRuntime` binds game-owned target/rig/pivot/camera nodes and a game-owned `ShapeCast3D` when collision is enabled, accepts explicit per-step input, and creates no scenes or nodes. Runtime ownership is released on `unbind`.

## Consequences

Headless spatial queries prove engine behavior without rendered-frame dependence. Controlled movement and camera fixtures share discovery, process ownership, atomic files, correlation checks, sessions, and file auditing. The installed production addon contains the camera core, loader, and wrapper but excludes the fixture scene and controlled wall. Camera zones, targeting/lock-on framing, combat or cinematic cameras, shake, cutscenes, photo mode, input maps, and visual camera editing remain outside this decision.
