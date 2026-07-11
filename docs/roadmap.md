# Roadmap

Progress is gated by evidence, not dates. A phase exits only when its contracts, validation, machine-readable inspection, applicable deterministic behavior, runtime-fixture proof, safety behavior, and automated tests are complete. Later phase names describe direction and do not authorize early implementation.

## Phase 0 — Repository foundation and contracts

Establish product scope, dependency boundaries, ownership, runtime protocol, testing approach, initial milestone, and architectural decisions. **Exit condition:** all foundation documents are internally consistent, linked, non-empty, and validated for scope; no feature is claimed as implemented.

## Phase 1 — Movement Editor

Deliver structured third-person movement profiles, validation, deterministic simulation, CLI authoring, the Godot movement fixture, measured reports, file auditing, snapshots, and rollback. **Exit condition:** every acceptance criterion in [Movement Editor v0.1](movement-editor-v0.1.md) has automated evidence or an explicit Godot environment limitation.

## Phase 2 — Camera and targeting

Add camera definitions, camera-relative intent, target acquisition/selection contracts, inspection, simulation where meaningful, and fixture measurements. **Exit condition:** camera and targeting can be authored without engine-code edits and pass deterministic/fixture acceptance tests without combat.

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
