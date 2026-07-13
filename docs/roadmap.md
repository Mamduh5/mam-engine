# Roadmap

Progress is gated by evidence, not dates. A phase exits only when its contracts, validation, machine-readable inspection, applicable deterministic behavior, runtime-fixture proof, safety behavior, and automated tests are complete. Later phase names describe direction and do not authorize early implementation.

## Production consumer track

ENGINE-GAP-001A is complete in 0.2.0: public install/sync commands, deterministic movement bundle, scene-free Godot addon, shared fixture/production movement core, and packed external-consumer evidence. ENGINE-GAP-001B is complete in 0.3.0: optional project camera entry and creation, a separate deterministic camera bundle, public loader/runtime, explicit game-owned bindings and input, real `ShapeCast3D` collision, lens and movement-basis output, and packed-consumer evidence. ENGINE-GAP-001C production targeting remains deferred; GAME-003 camera integration remains game-owned follow-up work. Controlled targeting fixtures are not production consumers.

## Phase 0 — Repository foundation and contracts (complete)

Establish product scope, dependency boundaries, ownership, runtime protocol, testing approach, initial milestone, and architectural decisions. **Exit condition:** all foundation documents are internally consistent, linked, non-empty, and validated for scope; no feature is claimed as implemented.

## Phase 1 — Movement Editor (complete)

Phase 1A delivers structured movement profiles, deterministic simulation, CLI authoring, safety, snapshots, rollback, and engine-independent tests. Phase 1A.1 hardens persistence. Phase 1B adds the Godot movement adapter/fixture, process-per-run lifecycle, measured reports, comparisons, and headless integration tests. **Exit condition met:** every acceptance criterion in [Movement Editor v0.1](movement-editor-v0.1.md) has automated evidence, including the official pinned Godot 4.7-stable release and its CI integration job.

## Phase 2 — Camera and targeting (complete)

Add camera definitions, camera-relative intent, target acquisition/selection contracts, inspection, simulation where meaningful, and fixture measurements. **Exit condition:** camera and targeting can be authored without engine-code edits and pass deterministic/fixture acceptance tests without combat.

### Phase 2A.1 — Camera editor domain foundation (complete)

Camera profile v1, schema and semantic validation, deterministic camera math/simulations, inspect/validate/simulate/set CLI operations, kind-aware snapshot safety, and Node tests are complete. The follow scenario moves for its first fixed-step half and settles for its second, preserving half-life and repeatability evidence. This phase is engine-independent and does not modify Godot runtime files.

### Phase 2A.2 — Camera runtime fixture (complete)

The controlled Godot `camera/basic-third-person` fixture consumes the complete validated profile, measures all six camera scenarios, applies lens values, uses real collision probing, compares against domain simulations, and runs headlessly in CI. It does not become a second authoring source. **Camera Editor v0.1 is complete.**

### Phase 2B.1 — Targeting domain foundation (complete)

Canonical targeting rules, schema/semantic validation, deterministic candidate eligibility/scoring, stable ties, retention/grace/reacquisition, directional switching/cooldown, safe CLI authoring, and kind-aware snapshots are complete. Candidates remain scenario data rather than authored profile state.

### Phase 2B.2 — Runtime targeting and target-driven camera framing (complete)

The separate controlled targeting fixture proves real LOS, acquisition/scoring, retention/grace/loss/reacquisition, switching/cooldown, and target-driven framing from existing camera fields. **Targeting Editor v0.1 is complete through Phase 2B.2. Defensive, offensive, health, stamina, and targeted-combat primitives now exist with controlled Godot proofs.** This is not a complete combat system.

## Phase 3 — Dodge and defensive actions (complete)

Canonical Phase 3 dodge and defensive-action profiles, state restrictions, stamina use, invulnerability timing, deterministic simulation, and controlled Godot measurements are complete. **Exit condition met:** defensive transitions and timing windows are definition-driven, validated, deterministic, and measured in Godot.

## Phase 4 — Action timeline and animation events (complete)

Canonical Phase 4 timeline authoring and real Godot animation-event synchronization are complete. **Exit condition met:** a definition-driven non-damaging action executes with deterministic event ordering and measured Godot animation-event reports.

## Phase 5 — Hitboxes and hurtboxes (complete)

Canonical Phase 5 spherical hitbox/hurtbox authoring, activation windows, deterministic simulation, and real Godot spatial-contact proof are complete. **Exit condition met:** authored volumes and windows produce deterministic contact reports; no damage, reactions, stagger, weapons, or enemies are claimed complete.

## Phase 6 — Damage, reactions, stagger, and interrupts (complete)

Canonical Phase 6 damage resolution, hit reactions, stagger, interruption, and real Godot runtime measurements are complete. **Exit condition met:** damage, reaction, stagger, and interrupt rules pass deterministic resolution tests and runtime-fixture measurements with stable reports; weapons, enemies, and encounters are not claimed complete.

## Phase 7 — First weapon (complete)

Canonical Phase 7 is complete: the definition-driven training weapon now composes validated references, stamina, a real Godot animation timeline, event-controlled real spatial contact, one-hit damage, and reactions end to end. **Exit condition met:** TypeScript and headless Godot produce matching complete strike reports; enemies and encounters are not claimed complete.

## Phase 8 — First large enemy (complete)

Canonical Phase 8 is complete: the training behemoth's behavior cycle, telegraph timing, target points, targetability, and real Godot hurtbox construction are proven against the TypeScript simulation. **Exit condition met:** behavior and telegraph sequences are authorable, deterministic where specified, measurable, and regression tested; no complete encounter or boss fight is claimed.

## Phase 9 — First complete boss encounter (complete)

Canonical Phase 9 is complete: the training encounter is proven through deterministic TypeScript orchestration, headless Godot execution, non-headless input events, objective success and failure reports, completed-round checkpoint recovery, and invalid-checkpoint rejection. **Exit condition met:** validated definitions drive matching headless and interactive reports with deterministic recovery evidence; production gameplay, polished UI, save games, progression, and a visual editor are not claimed complete.

## Phase 10 — Visual editor client (complete)

Phase 10A provides the loopback-only local editor foundation and read-only definition exploration. Phase 10B completes transactional single-property movement editing with preview, revision protection, snapshots, and undo. Phase 10C adds deterministic persisted movement simulation and preview-versus-saved metric comparison through the canonical domain simulator. Other definition kinds remain read-only and broader visual authoring workflows remain pending. **Exit condition met:** Phase 10 and the canonical roadmap through Phase 10 are complete without a second domain model, while CLI compatibility and headless automation remain intact.
