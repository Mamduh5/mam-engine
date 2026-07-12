# 0007: Targeting runtime and camera framing

Status: accepted for Phase 2B.2.

Targeting runtime proof uses a separate `targeting/basic-lock-on` fixture. Its additive `mam.runtime/v1` request contains the complete normalized targeting profile, the complete normalized camera profile, and a strict ephemeral scenario plan; it contains no canonical source path. Candidates, target transforms, controlled obstructions, and events remain runtime scenario data rather than authored profile fields.

Godot independently measures distance, unsigned 3D angle, signed horizontal angle, and line of sight. The obstruction input only enables a dedicated-mask collision wall; `PhysicsDirectSpaceState3D.intersect_ray` owns the reported LOS result. Marker nodes are diagnostic measurement fixtures, not enemies, and contain no combat semantics.

Lock-on framing reuses only existing orbit initial/pitch-limit, follow boom/look-at/half-life, and lens fields. It frames the midpoint between the player look-at point and selected target, preserves camera state while unlocked, and defines no post-lock recenter policy. Camera and targeting v1 schemas therefore remain unchanged. Camera collision, combat behavior, HUD, audio, VFX, enemies, and defensive actions are outside this decision.
