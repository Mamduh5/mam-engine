import type { MovementScenario } from "../domain/movement/movementTypes";
import type { CameraScenario } from "../domain/camera/cameraTypes";
import type { TargetingScenario } from "../domain/targeting/targetingTypes";
import type { TargetingRuntimeScenario } from "../domain/runtime/targetingRuntimePlan";
import type { StaminaCombatRuntimeScenario } from "../domain/runtime/runtimeProtocol";
import type { TargetedCombatExchangeScenario } from "../domain/combat/targetedCombatExchangeSimulation";
import { ErrorCodes } from "../shared/errorCodes";
import type { ErrorCode } from "../shared/errorCodes";

export type ParsedCommand =
  | { kind: "action-timeline.inspect"; file: string; json: boolean }
  | { kind: "action-timeline.validate"; file: string; json: boolean }
  | { kind: "action-timeline.simulate"; file: string; fixedDelta?: number; json: boolean }
  | { kind: "action-timeline.set"; file: string; propertyPath: string; value: unknown; dryRun: boolean; json: boolean }
  | { kind: "stamina.inspect"; file: string; json: boolean }
  | { kind: "stamina.validate"; file: string; json: boolean }
  | { kind: "stamina.simulate-action"; staminaFile: string; actionFile: string; json: boolean }
  | { kind: "stamina.runtime-test"; staminaFile: string; actionFile: string; godot?: string; keepSession: boolean; json: boolean }
  | { kind: "stamina.set"; file: string; propertyPath: string; value: unknown; dryRun: boolean; json: boolean }
  | { kind: "combat.simulate-exchange"; healthFile: string; offensiveActionFile: string; json: boolean }
  | { kind: "combat.simulate-stamina-exchange"; staminaFile: string; healthFile: string; offensiveActionFile: string; json: boolean }
  | { kind: "combat.simulate-targeted-exchange"; targetingFile: string; staminaFile: string; healthFile: string; offensiveActionFile: string; scenario: TargetedCombatExchangeScenario; json: boolean }
  | { kind: "combat.targeted-runtime-test"; targetingFile: string; staminaFile: string; healthFile: string; offensiveActionFile: string; scenario: TargetedCombatExchangeScenario; godot?: string; keepSession: boolean; json: boolean }
  | { kind: "combat.runtime-test"; healthFile: string; offensiveActionFile: string; godot?: string; keepSession: boolean; json: boolean }
  | { kind: "combat.stamina-runtime-test"; staminaFile: string; healthFile: string; offensiveActionFile: string; scenario: StaminaCombatRuntimeScenario; godot?: string; keepSession: boolean; json: boolean }
  | { kind: "health.inspect"; file: string; json: boolean }
  | { kind: "health.validate"; file: string; json: boolean }
  | { kind: "health.simulate-hit"; healthFile: string; offensiveActionFile: string; json: boolean }
  | { kind: "health.runtime-test"; healthFile: string; offensiveActionFile: string; godot?: string; keepSession: boolean; json: boolean }
  | { kind: "health.set"; file: string; propertyPath: string; value: unknown; dryRun: boolean; json: boolean }
  | { kind: "offensive-action.inspect"; file: string; json: boolean }
  | { kind: "offensive-action.validate"; file: string; json: boolean }
  | { kind: "offensive-action.simulate"; file: string; fixedDelta?: number; json: boolean }
  | { kind: "offensive-action.runtime-test"; file: string; fixedDelta?: number; godot?: string; keepSession: boolean; json: boolean }
  | { kind: "offensive-action.set"; file: string; propertyPath: string; value: unknown; dryRun: boolean; json: boolean }
  | { kind: "defensive-action.inspect"; file: string; json: boolean }
  | { kind: "defensive-action.validate"; file: string; json: boolean }
  | { kind: "defensive-action.simulate"; file: string; fixedDelta?: number; json: boolean }
  | { kind: "defensive-action.runtime-test"; file: string; fixedDelta?: number; godot?: string; keepSession: boolean; json: boolean }
  | { kind: "defensive-action.set"; file: string; propertyPath: string; value: unknown; dryRun: boolean; json: boolean }
  | { kind: "camera.inspect"; file: string; json: boolean }
  | { kind: "camera.validate"; file: string; json: boolean }
  | { kind: "camera.simulate"; file: string; scenario: CameraScenario; seconds?: number; fixedDelta?: number; json: boolean }
  | { kind: "camera.runtime-test"; file: string; scenario: CameraScenario; seconds?: number; fixedDelta?: number; godot?: string; keepSession: boolean; json: boolean }
  | { kind: "camera.set"; file: string; propertyPath: string; value: unknown; dryRun: boolean; json: boolean }
  | { kind: "targeting.inspect"; file: string; json: boolean }
  | { kind: "targeting.validate"; file: string; json: boolean }
  | { kind: "targeting.simulate"; file: string; scenario: TargetingScenario; seconds?: number; fixedDelta?: number; json: boolean }
  | { kind: "targeting.runtime-test"; file: string; camera: string; scenario: TargetingRuntimeScenario; seconds?: number; fixedDelta?: number; godot?: string; keepSession: boolean; json: boolean }
  | { kind: "targeting.set"; file: string; propertyPath: string; value: unknown; dryRun: boolean; json: boolean }
  | { kind: "movement.inspect"; file: string; json: boolean }
  | { kind: "movement.validate"; file: string; json: boolean }
  | { kind: "movement.simulate"; file: string; scenario: MovementScenario; seconds?: number; json: boolean }
  | { kind: "movement.runtime-test"; file: string; scenario: MovementScenario; seconds?: number; cameraYawDegrees: number; godot?: string; keepSession: boolean; json: boolean }
  | { kind: "runtime.check"; godot?: string; json: boolean }
  | { kind: "movement.set"; file: string; propertyPath: string; value: unknown; dryRun: boolean; json: boolean }
  | { kind: "snapshot.list"; json: boolean }
  | { kind: "snapshot.create"; file: string; json: boolean }
  | { kind: "snapshot.rollback"; snapshotId: string; json: boolean };

export class CliParseError extends Error {
  constructor(message: string, public readonly code: ErrorCode = ErrorCodes.CliArgumentInvalid) { super(message); }
}

interface ParsedArguments {
  positional: string[];
  flags: Map<string, string | true>;
}

const movementScenarios = new Set<MovementScenario>(["accelerate", "stop", "sprint", "dodge", "turn"]);
const cameraScenarios = new Set<CameraScenario>(["orbit", "pitch-clamp", "recenter", "follow", "collision", "basis"]);
const targetingScenarios = new Set<TargetingScenario>(["acquire", "eligibility", "tie-break", "retention", "loss", "reacquire", "switch-left", "switch-right", "switch-cooldown"]);
const targetingRuntimeScenarios = new Set<TargetingRuntimeScenario>(["acquire", "eligibility", "tie-break", "retention", "loss", "reacquire", "switch-left", "switch-right", "switch-cooldown", "framing-acquire", "framing-switch", "framing-loss", "framing-reacquire"]);

export function parseCommand(argv: string[]): ParsedCommand {
  const [group, action, ...remaining] = argv;
  if (!group || !action) {
    throw new CliParseError("Expected a command such as 'mam movement inspect <file> --json'");
  }

  if (group === "movement") {
    return parseMovementCommand(action, remaining);
  }
  if (group === "camera") return parseCameraCommand(action, remaining);
  if (group === "targeting") return parseTargetingCommand(action, remaining);
  if (group === "defensive-action") return parseDefensiveActionCommand(action, remaining);
  if (group === "offensive-action") return parseOffensiveActionCommand(action, remaining);
  if (group === "health") return parseHealthCommand(action, remaining);
  if (group === "stamina") return parseStaminaCommand(action, remaining);
  if (group === "action-timeline") return parseActionTimelineCommand(action, remaining);
  if (group === "combat") return parseCombatCommand(action, remaining);
  if (group === "snapshot") {
    return parseSnapshotCommand(action, remaining);
  }
  if (group === "runtime" && action === "check") {
    const parsed = parseArguments(remaining, new Set(["--json", "--godot"]), new Set(["--godot"]));
    requirePositionals(parsed, 0, "runtime check does not accept positional arguments");
    const godot = parsed.flags.get("--godot");
    return { kind: "runtime.check", ...(typeof godot === "string" ? { godot } : {}), json: parsed.flags.has("--json") };
  }
  throw new CliParseError(`Unknown command group '${group}'`);
}

function parseActionTimelineCommand(action: string, args: string[]): ParsedCommand {
  if (action === "inspect" || action === "validate") { const parsed = parseArguments(args, new Set(["--json"])); requirePositionals(parsed, 1, `action-timeline ${action} requires exactly one file argument`); return { kind: `action-timeline.${action}`, file: parsed.positional[0] as string, json: parsed.flags.has("--json") }; }
  if (action === "simulate") { const parsed = parseArguments(args, new Set(["--json", "--fixed-delta"]), new Set(["--fixed-delta"])); requirePositionals(parsed, 1, "action-timeline simulate requires exactly one file argument"); const fixedDelta = optionalPositiveNumber(parsed.flags.get("--fixed-delta"), "--fixed-delta"); return { kind: "action-timeline.simulate", file: parsed.positional[0] as string, ...(fixedDelta === undefined ? {} : { fixedDelta }), json: parsed.flags.has("--json") }; }
  if (action === "set") { const parsed = parseArguments(args, new Set(["--json", "--dry-run"])); requirePositionals(parsed, 3, "action-timeline set requires <file> <property-path> <json-value>"); let value: unknown; try { value = JSON.parse(parsed.positional[2] as string) as unknown; } catch { throw new CliParseError("action-timeline set <json-value> must be valid JSON"); } return { kind: "action-timeline.set", file: parsed.positional[0] as string, propertyPath: parsed.positional[1] as string, value, dryRun: parsed.flags.has("--dry-run"), json: parsed.flags.has("--json") }; }
  throw new CliParseError(`Unknown action-timeline command '${action}'`);
}

function parseStaminaCommand(action: string, args: string[]): ParsedCommand {
  if (action === "inspect" || action === "validate") { const parsed = parseArguments(args, new Set(["--json"])); requirePositionals(parsed, 1, `stamina ${action} requires exactly one file argument`); return { kind: `stamina.${action}`, file: parsed.positional[0] as string, json: parsed.flags.has("--json") }; }
  if (action === "simulate-action") { const parsed = parseArguments(args, new Set(["--json"])); requirePositionals(parsed, 2, "stamina simulate-action requires <stamina-file> <action-file>"); return { kind: "stamina.simulate-action", staminaFile: parsed.positional[0] as string, actionFile: parsed.positional[1] as string, json: parsed.flags.has("--json") }; }
  if (action === "runtime-test") { const parsed = parseArguments(args, new Set(["--json", "--godot", "--keep-session"]), new Set(["--godot"])); requirePositionals(parsed, 2, "stamina runtime-test requires <stamina-file> <action-file>"); const godot = parsed.flags.get("--godot"); return { kind: "stamina.runtime-test", staminaFile: parsed.positional[0] as string, actionFile: parsed.positional[1] as string, ...(typeof godot === "string" ? { godot } : {}), keepSession: parsed.flags.has("--keep-session"), json: parsed.flags.has("--json") }; }
  if (action === "set") { const parsed = parseArguments(args, new Set(["--json", "--dry-run"])); requirePositionals(parsed, 3, "stamina set requires <file> <property-path> <json-value>"); let value: unknown; try { value = JSON.parse(parsed.positional[2] as string) as unknown; } catch { throw new CliParseError("stamina set <json-value> must be valid JSON"); } return { kind: "stamina.set", file: parsed.positional[0] as string, propertyPath: parsed.positional[1] as string, value, dryRun: parsed.flags.has("--dry-run"), json: parsed.flags.has("--json") }; }
  throw new CliParseError(`Unknown stamina command '${action}'`);
}

function parseCombatCommand(action: string, args: string[]): ParsedCommand {
  if (action === "simulate-exchange") {
    const parsed = parseArguments(args, new Set(["--json"]));
    requirePositionals(parsed, 2, "combat simulate-exchange requires <health-file> <offensive-action-file>");
    return { kind: "combat.simulate-exchange", healthFile: parsed.positional[0] as string, offensiveActionFile: parsed.positional[1] as string, json: parsed.flags.has("--json") };
  }
  if (action === "simulate-stamina-exchange") {
    const parsed = parseArguments(args, new Set(["--json"]));
    requirePositionals(parsed, 3, "combat simulate-stamina-exchange requires <stamina-file> <health-file> <offensive-action-file>");
    return { kind: "combat.simulate-stamina-exchange", staminaFile: parsed.positional[0] as string, healthFile: parsed.positional[1] as string, offensiveActionFile: parsed.positional[2] as string, json: parsed.flags.has("--json") };
  }
  if (action === "simulate-targeted-exchange") {
    const parsed = parseArguments(args, new Set(["--json", "--scenario"]), new Set(["--scenario"]));
    requirePositionals(parsed, 4, "combat simulate-targeted-exchange requires <targeting-file> <stamina-file> <health-file> <offensive-action-file>");
    const scenarioValue = parsed.flags.get("--scenario"); const scenario = scenarioValue === undefined ? "target-available" : scenarioValue;
    if (scenario !== "target-available" && scenario !== "no-valid-target") throw new CliParseError("--scenario must be one of: target-available, no-valid-target");
    return { kind: "combat.simulate-targeted-exchange", targetingFile: parsed.positional[0] as string, staminaFile: parsed.positional[1] as string, healthFile: parsed.positional[2] as string, offensiveActionFile: parsed.positional[3] as string, scenario, json: parsed.flags.has("--json") };
  }
  if (action === "targeted-runtime-test") {
    const parsed = parseArguments(args, new Set(["--json", "--scenario", "--godot", "--keep-session"]), new Set(["--scenario", "--godot"]));
    requirePositionals(parsed, 4, "combat targeted-runtime-test requires <targeting-file> <stamina-file> <health-file> <offensive-action-file>");
    const scenarioValue = parsed.flags.get("--scenario"); const scenario = scenarioValue === undefined ? "target-available" : scenarioValue;
    if (scenario !== "target-available" && scenario !== "no-valid-target") throw new CliParseError("--scenario must be one of: target-available, no-valid-target");
    const godot = parsed.flags.get("--godot");
    return { kind: "combat.targeted-runtime-test", targetingFile: parsed.positional[0] as string, staminaFile: parsed.positional[1] as string, healthFile: parsed.positional[2] as string, offensiveActionFile: parsed.positional[3] as string, scenario, ...(typeof godot === "string" ? { godot } : {}), keepSession: parsed.flags.has("--keep-session"), json: parsed.flags.has("--json") };
  }
  if (action === "stamina-runtime-test") {
    const parsed = parseArguments(args, new Set(["--json", "--scenario", "--godot", "--keep-session"]), new Set(["--scenario", "--godot"]));
    requirePositionals(parsed, 3, "combat stamina-runtime-test requires <stamina-file> <health-file> <offensive-action-file>");
    const scenarioValue = parsed.flags.get("--scenario"); const scenario = scenarioValue === undefined ? "accepted" : scenarioValue;
    if (scenario !== "accepted" && scenario !== "insufficient-stamina") throw new CliParseError("--scenario must be one of: accepted, insufficient-stamina");
    const godot = parsed.flags.get("--godot");
    return { kind: "combat.stamina-runtime-test", staminaFile: parsed.positional[0] as string, healthFile: parsed.positional[1] as string, offensiveActionFile: parsed.positional[2] as string, scenario, ...(typeof godot === "string" ? { godot } : {}), keepSession: parsed.flags.has("--keep-session"), json: parsed.flags.has("--json") };
  }
  if (action === "runtime-test") {
    const parsed = parseArguments(args, new Set(["--json", "--godot", "--keep-session"]), new Set(["--godot"]));
    requirePositionals(parsed, 2, "combat runtime-test requires <health-file> <offensive-action-file>");
    const godot = parsed.flags.get("--godot");
    return { kind: "combat.runtime-test", healthFile: parsed.positional[0] as string, offensiveActionFile: parsed.positional[1] as string, ...(typeof godot === "string" ? { godot } : {}), keepSession: parsed.flags.has("--keep-session"), json: parsed.flags.has("--json") };
  }
  throw new CliParseError(`Unknown combat command '${action}'`);
}

function parseHealthCommand(action: string, args: string[]): ParsedCommand {
  if (action === "inspect" || action === "validate") { const parsed = parseArguments(args, new Set(["--json"])); requirePositionals(parsed, 1, `health ${action} requires exactly one file argument`); return { kind: `health.${action}`, file: parsed.positional[0] as string, json: parsed.flags.has("--json") }; }
  if (action === "simulate-hit") { const parsed = parseArguments(args, new Set(["--json"])); requirePositionals(parsed, 2, "health simulate-hit requires <health-file> <offensive-action-file>"); return { kind: "health.simulate-hit", healthFile: parsed.positional[0] as string, offensiveActionFile: parsed.positional[1] as string, json: parsed.flags.has("--json") }; }
  if (action === "runtime-test") { const parsed = parseArguments(args, new Set(["--json", "--godot", "--keep-session"]), new Set(["--godot"])); requirePositionals(parsed, 2, "health runtime-test requires <health-file> <offensive-action-file>"); const godot = parsed.flags.get("--godot"); return { kind: "health.runtime-test", healthFile: parsed.positional[0] as string, offensiveActionFile: parsed.positional[1] as string, ...(typeof godot === "string" ? { godot } : {}), keepSession: parsed.flags.has("--keep-session"), json: parsed.flags.has("--json") }; }
  if (action === "set") { const parsed = parseArguments(args, new Set(["--json", "--dry-run"])); requirePositionals(parsed, 3, "health set requires <file> <property-path> <json-value>"); let value: unknown; try { value = JSON.parse(parsed.positional[2] as string) as unknown; } catch { throw new CliParseError("health set <json-value> must be valid JSON"); } return { kind: "health.set", file: parsed.positional[0] as string, propertyPath: parsed.positional[1] as string, value, dryRun: parsed.flags.has("--dry-run"), json: parsed.flags.has("--json") }; }
  throw new CliParseError(`Unknown health command '${action}'`);
}

function parseOffensiveActionCommand(action: string, args: string[]): ParsedCommand {
  if (action === "inspect" || action === "validate") { const parsed = parseArguments(args, new Set(["--json"])); requirePositionals(parsed, 1, `offensive-action ${action} requires exactly one file argument`); return { kind: `offensive-action.${action}`, file: parsed.positional[0] as string, json: parsed.flags.has("--json") }; }
  if (action === "simulate") { const parsed = parseArguments(args, new Set(["--json", "--fixed-delta"]), new Set(["--fixed-delta"])); requirePositionals(parsed, 1, "offensive-action simulate requires exactly one file argument"); const fixedDelta = optionalPositiveNumber(parsed.flags.get("--fixed-delta"), "--fixed-delta"); return { kind: "offensive-action.simulate", file: parsed.positional[0] as string, ...(fixedDelta === undefined ? {} : { fixedDelta }), json: parsed.flags.has("--json") }; }
  if (action === "runtime-test") { const parsed = parseArguments(args, new Set(["--json", "--fixed-delta", "--godot", "--keep-session"]), new Set(["--fixed-delta", "--godot"])); requirePositionals(parsed, 1, "offensive-action runtime-test requires exactly one file argument"); const fixedDelta = optionalPositiveNumber(parsed.flags.get("--fixed-delta"), "--fixed-delta"); const godot = parsed.flags.get("--godot"); return { kind: "offensive-action.runtime-test", file: parsed.positional[0] as string, ...(fixedDelta === undefined ? {} : { fixedDelta }), ...(typeof godot === "string" ? { godot } : {}), keepSession: parsed.flags.has("--keep-session"), json: parsed.flags.has("--json") }; }
  if (action === "set") { const parsed = parseArguments(args, new Set(["--json", "--dry-run"])); requirePositionals(parsed, 3, "offensive-action set requires <file> <property-path> <json-value>"); let value: unknown; try { value = JSON.parse(parsed.positional[2] as string) as unknown; } catch { throw new CliParseError("offensive-action set <json-value> must be valid JSON"); } return { kind: "offensive-action.set", file: parsed.positional[0] as string, propertyPath: parsed.positional[1] as string, value, dryRun: parsed.flags.has("--dry-run"), json: parsed.flags.has("--json") }; }
  throw new CliParseError(`Unknown offensive-action command '${action}'`);
}

function parseDefensiveActionCommand(action: string, args: string[]): ParsedCommand {
  if (action === "inspect" || action === "validate") { const parsed = parseArguments(args, new Set(["--json"])); requirePositionals(parsed, 1, `defensive-action ${action} requires exactly one file argument`); return { kind: `defensive-action.${action}`, file: parsed.positional[0] as string, json: parsed.flags.has("--json") }; }
  if (action === "simulate") { const parsed = parseArguments(args, new Set(["--json", "--fixed-delta"]), new Set(["--fixed-delta"])); requirePositionals(parsed, 1, "defensive-action simulate requires exactly one file argument"); const fixedDelta = optionalPositiveNumber(parsed.flags.get("--fixed-delta"), "--fixed-delta"); return { kind: "defensive-action.simulate", file: parsed.positional[0] as string, ...(fixedDelta === undefined ? {} : { fixedDelta }), json: parsed.flags.has("--json") }; }
  if (action === "runtime-test") { const parsed = parseArguments(args, new Set(["--json", "--fixed-delta", "--godot", "--keep-session"]), new Set(["--fixed-delta", "--godot"])); requirePositionals(parsed, 1, "defensive-action runtime-test requires exactly one file argument"); const fixedDelta = optionalPositiveNumber(parsed.flags.get("--fixed-delta"), "--fixed-delta"); const godot = parsed.flags.get("--godot"); return { kind: "defensive-action.runtime-test", file: parsed.positional[0] as string, ...(fixedDelta === undefined ? {} : { fixedDelta }), ...(typeof godot === "string" ? { godot } : {}), keepSession: parsed.flags.has("--keep-session"), json: parsed.flags.has("--json") }; }
  if (action === "set") { const parsed = parseArguments(args, new Set(["--json", "--dry-run"])); requirePositionals(parsed, 3, "defensive-action set requires <file> <property-path> <json-value>"); let value: unknown; try { value = JSON.parse(parsed.positional[2] as string) as unknown; } catch { throw new CliParseError("defensive-action set <json-value> must be valid JSON"); } return { kind: "defensive-action.set", file: parsed.positional[0] as string, propertyPath: parsed.positional[1] as string, value, dryRun: parsed.flags.has("--dry-run"), json: parsed.flags.has("--json") }; }
  throw new CliParseError(`Unknown defensive-action command '${action}'`);
}

function parseTargetingCommand(action: string, args: string[]): ParsedCommand {
  if (action === "inspect" || action === "validate") { const parsed = parseArguments(args, new Set(["--json"])); requirePositionals(parsed, 1, `targeting ${action} requires exactly one file argument`); return { kind: `targeting.${action}`, file: parsed.positional[0] as string, json: parsed.flags.has("--json") }; }
  if (action === "simulate") { const parsed = parseArguments(args, new Set(["--json", "--scenario", "--seconds", "--fixed-delta"]), new Set(["--scenario", "--seconds", "--fixed-delta"])); requirePositionals(parsed, 1, "targeting simulate requires exactly one file argument"); const scenario = parsed.flags.get("--scenario"); if (typeof scenario !== "string" || !targetingScenarios.has(scenario as TargetingScenario)) throw new CliParseError("--scenario must be one of: acquire, eligibility, tie-break, retention, loss, reacquire, switch-left, switch-right, switch-cooldown", ErrorCodes.TargetingScenarioUnsupported); const seconds = optionalPositiveNumber(parsed.flags.get("--seconds"), "--seconds"); const fixedDelta = optionalPositiveNumber(parsed.flags.get("--fixed-delta"), "--fixed-delta"); return { kind: "targeting.simulate", file: parsed.positional[0] as string, scenario: scenario as TargetingScenario, ...(seconds === undefined ? {} : { seconds }), ...(fixedDelta === undefined ? {} : { fixedDelta }), json: parsed.flags.has("--json") }; }
  if (action === "runtime-test") {
    const parsed = parseArguments(args, new Set(["--json", "--camera", "--scenario", "--seconds", "--fixed-delta", "--godot", "--keep-session"]), new Set(["--camera", "--scenario", "--seconds", "--fixed-delta", "--godot"]));
    requirePositionals(parsed, 1, "targeting runtime-test requires exactly one targeting file argument");
    const camera = parsed.flags.get("--camera"); if (typeof camera !== "string") throw new CliParseError("--camera is required");
    const scenario = parsed.flags.get("--scenario"); if (typeof scenario !== "string" || !targetingRuntimeScenarios.has(scenario as TargetingRuntimeScenario)) throw new CliParseError("--scenario must be one of: acquire, eligibility, tie-break, retention, loss, reacquire, switch-left, switch-right, switch-cooldown, framing-acquire, framing-switch, framing-loss, framing-reacquire", ErrorCodes.TargetingRuntimeScenarioUnsupported);
    const seconds = optionalPositiveNumber(parsed.flags.get("--seconds"), "--seconds"); const fixedDelta = optionalPositiveNumber(parsed.flags.get("--fixed-delta"), "--fixed-delta"); const godot = parsed.flags.get("--godot");
    return { kind: "targeting.runtime-test", file: parsed.positional[0] as string, camera, scenario: scenario as TargetingRuntimeScenario, ...(seconds === undefined ? {} : { seconds }), ...(fixedDelta === undefined ? {} : { fixedDelta }), ...(typeof godot === "string" ? { godot } : {}), keepSession: parsed.flags.has("--keep-session"), json: parsed.flags.has("--json") };
  }
  if (action === "set") { const parsed = parseArguments(args, new Set(["--json", "--dry-run"])); requirePositionals(parsed, 3, "targeting set requires <file> <property-path> <json-value>"); let value: unknown; try { value = JSON.parse(parsed.positional[2] as string) as unknown; } catch { throw new CliParseError("targeting set <json-value> must be valid JSON"); } return { kind: "targeting.set", file: parsed.positional[0] as string, propertyPath: parsed.positional[1] as string, value, dryRun: parsed.flags.has("--dry-run"), json: parsed.flags.has("--json") }; }
  throw new CliParseError(`Unknown targeting command '${action}'`);
}

function parseCameraCommand(action: string, args: string[]): ParsedCommand {
  if (action === "inspect" || action === "validate") {
    const parsed = parseArguments(args, new Set(["--json"])); requirePositionals(parsed, 1, `camera ${action} requires exactly one file argument`);
    return { kind: `camera.${action}`, file: parsed.positional[0] as string, json: parsed.flags.has("--json") };
  }
  if (action === "simulate") {
    const parsed = parseArguments(args, new Set(["--json", "--scenario", "--seconds", "--fixed-delta"]), new Set(["--scenario", "--seconds", "--fixed-delta"]));
    requirePositionals(parsed, 1, "camera simulate requires exactly one file argument");
    const scenario = parsed.flags.get("--scenario");
    if (typeof scenario !== "string" || !cameraScenarios.has(scenario as CameraScenario)) throw new CliParseError("--scenario must be one of: orbit, pitch-clamp, recenter, follow, collision, basis", ErrorCodes.CameraScenarioUnsupported);
    const seconds = optionalPositiveNumber(parsed.flags.get("--seconds"), "--seconds");
    const fixedDelta = optionalPositiveNumber(parsed.flags.get("--fixed-delta"), "--fixed-delta");
    return { kind: "camera.simulate", file: parsed.positional[0] as string, scenario: scenario as CameraScenario, ...(seconds === undefined ? {} : { seconds }), ...(fixedDelta === undefined ? {} : { fixedDelta }), json: parsed.flags.has("--json") };
  }
  if (action === "runtime-test") {
    const parsed = parseArguments(args, new Set(["--json", "--scenario", "--seconds", "--fixed-delta", "--godot", "--keep-session"]), new Set(["--scenario", "--seconds", "--fixed-delta", "--godot"]));
    requirePositionals(parsed, 1, "camera runtime-test requires exactly one file argument");
    const scenario = parsed.flags.get("--scenario");
    if (typeof scenario !== "string" || !cameraScenarios.has(scenario as CameraScenario)) throw new CliParseError("--scenario must be one of: orbit, pitch-clamp, recenter, follow, collision, basis", ErrorCodes.CameraRuntimeScenarioUnsupported);
    const seconds = optionalPositiveNumber(parsed.flags.get("--seconds"), "--seconds"); const fixedDelta = optionalPositiveNumber(parsed.flags.get("--fixed-delta"), "--fixed-delta"); const godot = parsed.flags.get("--godot");
    return { kind: "camera.runtime-test", file: parsed.positional[0] as string, scenario: scenario as CameraScenario, ...(seconds === undefined ? {} : { seconds }), ...(fixedDelta === undefined ? {} : { fixedDelta }), ...(typeof godot === "string" ? { godot } : {}), keepSession: parsed.flags.has("--keep-session"), json: parsed.flags.has("--json") };
  }
  if (action === "set") {
    const parsed = parseArguments(args, new Set(["--json", "--dry-run"])); requirePositionals(parsed, 3, "camera set requires <file> <property-path> <json-value>");
    let value: unknown; try { value = JSON.parse(parsed.positional[2] as string) as unknown; } catch { throw new CliParseError("camera set <json-value> must be valid JSON"); }
    return { kind: "camera.set", file: parsed.positional[0] as string, propertyPath: parsed.positional[1] as string, value, dryRun: parsed.flags.has("--dry-run"), json: parsed.flags.has("--json") };
  }
  throw new CliParseError(`Unknown camera command '${action}'`);
}

function parseMovementCommand(action: string, args: string[]): ParsedCommand {
  if (action === "inspect" || action === "validate") {
    const parsed = parseArguments(args, new Set(["--json"]));
    requirePositionals(parsed, 1, `movement ${action} requires exactly one file argument`);
    return { kind: `movement.${action}`, file: parsed.positional[0] as string, json: parsed.flags.has("--json") };
  }

  if (action === "simulate") {
    const parsed = parseArguments(args, new Set(["--json", "--scenario", "--seconds"]), new Set(["--scenario", "--seconds"]));
    requirePositionals(parsed, 1, "movement simulate requires exactly one file argument");
    const scenarioValue = parsed.flags.get("--scenario");
    if (typeof scenarioValue !== "string" || !movementScenarios.has(scenarioValue as MovementScenario)) {
      throw new CliParseError("--scenario must be one of: accelerate, stop, sprint, dodge, turn");
    }
    const secondsValue = parsed.flags.get("--seconds");
    let seconds: number | undefined;
    if (typeof secondsValue === "string") {
      seconds = Number(secondsValue);
      if (!Number.isFinite(seconds) || seconds <= 0) {
        throw new CliParseError("--seconds must be a finite number greater than 0");
      }
    }
    return {
      kind: "movement.simulate",
      file: parsed.positional[0] as string,
      scenario: scenarioValue as MovementScenario,
      ...(seconds === undefined ? {} : { seconds }),
      json: parsed.flags.has("--json")
    };
  }

  if (action === "runtime-test") {
    const parsed = parseArguments(args, new Set(["--json", "--scenario", "--seconds", "--camera-yaw-degrees", "--godot", "--keep-session"]), new Set(["--scenario", "--seconds", "--camera-yaw-degrees", "--godot"]));
    requirePositionals(parsed, 1, "movement runtime-test requires exactly one file argument");
    const scenarioValue = parsed.flags.get("--scenario");
    if (typeof scenarioValue !== "string" || !movementScenarios.has(scenarioValue as MovementScenario)) {
      throw new CliParseError("--scenario must be one of: accelerate, stop, sprint, dodge, turn", ErrorCodes.RuntimeScenarioUnsupported);
    }
    const seconds = optionalPositiveNumber(parsed.flags.get("--seconds"), "--seconds");
    const yawValue = parsed.flags.get("--camera-yaw-degrees");
    const cameraYawDegrees = yawValue === undefined ? 0 : Number(yawValue);
    if (!Number.isFinite(cameraYawDegrees)) {
      throw new CliParseError("--camera-yaw-degrees must be a finite number");
    }
    const godot = parsed.flags.get("--godot");
    return {
      kind: "movement.runtime-test",
      file: parsed.positional[0] as string,
      scenario: scenarioValue as MovementScenario,
      ...(seconds === undefined ? {} : { seconds }),
      cameraYawDegrees,
      ...(typeof godot === "string" ? { godot } : {}),
      keepSession: parsed.flags.has("--keep-session"),
      json: parsed.flags.has("--json")
    };
  }

  if (action === "set") {
    const parsed = parseArguments(args, new Set(["--json", "--dry-run"]));
    requirePositionals(parsed, 3, "movement set requires <file> <property-path> <json-value>");
    let value: unknown;
    try {
      value = JSON.parse(parsed.positional[2] as string) as unknown;
    } catch {
      throw new CliParseError("movement set <json-value> must be valid JSON");
    }
    return {
      kind: "movement.set",
      file: parsed.positional[0] as string,
      propertyPath: parsed.positional[1] as string,
      value,
      dryRun: parsed.flags.has("--dry-run"),
      json: parsed.flags.has("--json")
    };
  }
  throw new CliParseError(`Unknown movement command '${action}'`);
}

function optionalPositiveNumber(value: string | true | undefined, flag: string): number | undefined {
  if (typeof value !== "string") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new CliParseError(`${flag} must be a finite number greater than 0`);
  return parsed;
}

function parseSnapshotCommand(action: string, args: string[]): ParsedCommand {
  const parsed = parseArguments(args, new Set(["--json"]));
  if (action === "list") {
    requirePositionals(parsed, 0, "snapshot list does not accept positional arguments");
    return { kind: "snapshot.list", json: parsed.flags.has("--json") };
  }
  if (action === "create") {
    requirePositionals(parsed, 1, "snapshot create requires exactly one file argument");
    return { kind: "snapshot.create", file: parsed.positional[0] as string, json: parsed.flags.has("--json") };
  }
  if (action === "rollback") {
    requirePositionals(parsed, 1, "snapshot rollback requires exactly one snapshot ID");
    return { kind: "snapshot.rollback", snapshotId: parsed.positional[0] as string, json: parsed.flags.has("--json") };
  }
  throw new CliParseError(`Unknown snapshot command '${action}'`);
}

function parseArguments(args: string[], allowedFlags: Set<string>, valueFlags = new Set<string>()): ParsedArguments {
  const positional: string[] = [];
  const flags = new Map<string, string | true>();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index] as string;
    if (!argument.startsWith("--")) {
      positional.push(argument);
      continue;
    }
    if (!allowedFlags.has(argument)) {
      throw new CliParseError(`Unknown flag '${argument}'`);
    }
    if (flags.has(argument)) {
      throw new CliParseError(`Flag '${argument}' was provided more than once`);
    }
    if (valueFlags.has(argument)) {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new CliParseError(`Flag '${argument}' requires a value`);
      }
      flags.set(argument, value);
      index += 1;
    } else {
      flags.set(argument, true);
    }
  }
  return { positional, flags };
}

function requirePositionals(parsed: ParsedArguments, count: number, message: string): void {
  if (parsed.positional.length !== count) {
    throw new CliParseError(message);
  }
}
