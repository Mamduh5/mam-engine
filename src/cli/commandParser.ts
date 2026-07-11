import type { MovementScenario } from "../domain/movement/movementTypes";
import { ErrorCodes } from "../shared/errorCodes";
import type { ErrorCode } from "../shared/errorCodes";

export type ParsedCommand =
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

export function parseCommand(argv: string[]): ParsedCommand {
  const [group, action, ...remaining] = argv;
  if (!group || !action) {
    throw new CliParseError("Expected a command such as 'mam movement inspect <file> --json'");
  }

  if (group === "movement") {
    return parseMovementCommand(action, remaining);
  }
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
