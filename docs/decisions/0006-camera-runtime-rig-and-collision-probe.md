# Decision 0006: Camera runtime rig and collision probe

## Status

Accepted for Camera Editor Phase 2A.2.

## Decision

Use one controlled `camera/basic-third-person` scene under the existing process-per-run `mam.runtime/v1` host. The rig separates target, follow anchor, yaw pivot, pitch pivot, collision probe, and camera responsibilities. Godot receives the complete validated camera profile in the request; the scene contains no authoritative camera defaults.

Collision evidence uses a sphere `ShapeCast3D` from the authored look-at origin toward the desired boom. The controlled wall is placed at the same canonical obstruction distance used by the domain scenario. Contact distance subtracts the authored probe radius, respects the authored minimum, and recovery uses the authored half-life after deterministic wall removal.

## Consequences

Headless spatial queries prove engine behavior without rendered-frame dependence. Movement and camera share discovery, process ownership, atomic files, correlation/fixture checks, sessions, and file auditing. The fixture remains deliberately non-general: camera zones, arbitrary project adapters, targeting, combat cameras, and visual editing require later decisions.
