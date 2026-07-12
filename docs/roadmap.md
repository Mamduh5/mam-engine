# Roadmap

Progress is gated by evidence, not dates. A phase exits only when its contracts, validation, machine-readable inspection, applicable deterministic behavior, runtime-fixture proof, safety behavior, and automated tests are complete. Later phase names describe direction and do not authorize early implementation.

## Phase 0 — Repository foundation and contracts (complete)

Establish product scope, dependency boundaries, ownership, runtime protocol, testing approach, initial milestone, and architectural decisions. **Exit condition:** all foundation documents are internally consistent, linked, non-empty, and validated for scope; no feature is claimed as implemented.

## Phase 1 — Movement Editor (complete)

Phase 1A delivers structured movement profiles, deterministic simulation, CLI authoring, safety, snapshots, rollback, and engine-independent tests. Phase 1A.1 hardens persistence. Phase 1B adds the Godot movement adapter/fixture, process-per-run lifecycle, measured reports, comparisons, and headless integration tests. **Exit condition met:** every acceptance criterion in [Movement Editor v0.1](movement-editor-v0.1.md) has automated evidence, including the official pinned Godot 4.7-stable release and its CI integration job.

## Phase 2 — Camera and targeting

Add camera definitions, camera-relative intent, target acquisition/selection contracts, inspection, simulation where meaningful, and fixture measurements. **Exit condition:** camera and targeting can be authored without engine-code edits and pass deterministic/fixture acceptance tests without combat.

### Phase 2A.1 — Camera editor domain foundation (complete)

Camera profile v1, schema and semantic validation, deterministic camera math/simulations, inspect/validate/simulate/set CLI operations, kind-aware snapshot safety, and Node tests are complete. The follow scenario moves for its first fixed-step half and settles for its second, preserving half-life and repeatability evidence. This phase is engine-independent and does not modify Godot runtime files.

### Phase 2A.2 — Camera runtime fixture (complete)

The controlled Godot `camera/basic-third-person` fixture consumes the complete validated profile, measures all six camera scenarios, applies lens values, uses real collision probing, compares against domain simulations, and runs headlessly in CI. It does not become a second authoring source. **Camera Editor v0.1 is complete.**

### Phase 2B — Targeting (not started)

Add target acquisition and selection contracts only after camera runtime scope is explicitly authorized. No targeting data model, runtime behavior, or combat semantics are included in Phase 2A.1.

## Phase 3 — Dodge and defensive actions

Promote dodge into a complete defensive-action slice with state restrictions, stamina, invulnerability timing, and runtime evidence. **Exit condition:** all defensive transitions and timing windows are definition-driven, validated, deterministic, and measured in Godot.

## Phase 4 — Action timeline and animation events

Define action timelines and animation-event synchronization without damage semantics. **Exit condition:** a definition-driven non-damaging action executes with deterministic event ordering and measured Godot animation-event reports.

## Phase 5 — Hitboxes and hurtboxes

Add spatial contact volumes and activation windows without damage calculation. **Exit condition:** authored volumes and windows produce deterministic contact reports with visualization available only as supplementary evidence.

## Phase 6 — Damage, reactions, stagger, and interrupts

Introduce validated combat resolution and reaction state transitions. **Exit condition:** damage, reaction, stagger, and interrupt rules pass deterministic resolution tests and runtime-fixture measurements with stable reports.

## Phase 7 — First weapon

Compose prior systems into one weapon-specific mechanic and action set. **Exit condition:** the weapon is fully definition-driven, testable end to end, and requires no fixture-private combat truth.

## Phase 8 — First large enemy

Add one large-enemy behavior model, telegraphs, targetable/body-part contracts, and controlled scenarios. **Exit condition:** behavior and telegraph sequences are authorable, deterministic where specified, measurable, and regression tested.

## Phase 9 — First complete boss encounter

Compose player, weapon, enemy, arena, and encounter definitions into one complete hunt. **Exit condition:** the encounter runs from validated definitions through headless and interactive fixtures with objective completion/failure reports and recovery tests.

## Phase 10 — Visual editor client

Build a human-facing client over the established services and protocols. **Exit condition:** the visual editor can complete supported authoring workflows without a second domain model, while CLI compatibility and headless automation remain intact.
