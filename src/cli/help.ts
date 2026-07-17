import { SUPPORTED_COMMAND_ACTIONS, isSupportedCommandGroup, type CommandGroup } from "./commandParser";

const commonRuntimeFlags = "[--godot <path>] [--keep-session] [--json]";
const commonSetFlags = "[--dry-run] [--json]";

export const COMMAND_HELP: Record<CommandGroup, readonly string[]> = {
  project: [
    "project init [directory] [--json]",
    "project validate [--json]",
    `project play ${commonRuntimeFlags}`
  ],
  godot: [
    "godot consumer install [--project <directory>] [--json]",
    "godot consumer sync [--project <directory>] [--check] [--json]"
  ],
  movement: [
    "movement create <file> [--json]",
    "movement inspect <file> [--json]",
    "movement validate <file> [--json]",
    "movement simulate <file> --scenario <accelerate|stop|sprint|dodge|turn> [--seconds <number>] [--json]",
    `movement runtime-test <file> --scenario <accelerate|stop|sprint|dodge|turn> [--seconds <number>] [--camera-yaw-degrees <number>] ${commonRuntimeFlags}`,
    `movement set <file> <property-path> <json-value> ${commonSetFlags}`
  ],
  camera: [
    "camera create <file> [--json]",
    "camera inspect <file> [--json]", "camera validate <file> [--json]",
    "camera simulate <file> --scenario <orbit|pitch-clamp|recenter|follow|collision|basis> [--seconds <number>] [--fixed-delta <number>] [--json]",
    `camera runtime-test <file> --scenario <orbit|pitch-clamp|recenter|follow|collision|basis> [--seconds <number>] [--fixed-delta <number>] ${commonRuntimeFlags}`,
    `camera set <file> <property-path> <json-value> ${commonSetFlags}`
  ],
  targeting: [
    "targeting create <file> [--json]", "targeting inspect <file> [--json]", "targeting validate <file> [--json]",
    "targeting simulate <file> --scenario <acquire|eligibility|tie-break|retention|loss|reacquire|switch-left|switch-right|switch-cooldown> [--seconds <number>] [--fixed-delta <number>] [--json]",
    `targeting runtime-test <file> --camera <camera-file> --scenario <id> [--seconds <number>] [--fixed-delta <number>] ${commonRuntimeFlags}`,
    `targeting set <file> <property-path> <json-value> ${commonSetFlags}`
  ],
  "defensive-action": actionProfileHelp("defensive-action"),
  "offensive-action": actionProfileHelp("offensive-action"),
  health: [
    "health inspect <file> [--json]", "health validate <file> [--json]",
    "health simulate-hit <health-file> <offensive-action-file> [--json]",
    `health runtime-test <health-file> <offensive-action-file> ${commonRuntimeFlags}`,
    `health set <file> <property-path> <json-value> ${commonSetFlags}`
  ],
  stamina: [
    "stamina inspect <file> [--json]", "stamina validate <file> [--json]",
    "stamina simulate-action <stamina-file> <action-file> [--json]",
    `stamina runtime-test <stamina-file> <action-file> ${commonRuntimeFlags}`,
    `stamina set <file> <property-path> <json-value> ${commonSetFlags}`
  ],
  "action-timeline": actionProfileHelp("action-timeline"),
  "contact-volume": [
    "contact-volume inspect <file> [--json]", "contact-volume validate <file> [--json]",
    "contact-volume simulate-contact <hitbox-file> <hurtbox-file> [--fixed-delta <number>] [--json]",
    `contact-volume runtime-test <hitbox-file> <hurtbox-file> [--scenario <overlapping-active|window-miss>] [--fixed-delta <number>] ${commonRuntimeFlags}`,
    `contact-volume set <file> <property-path> <json-value> ${commonSetFlags}`
  ],
  "damage-reaction": [
    "damage-reaction inspect <file> [--json]", "damage-reaction validate <file> [--json]",
    "damage-reaction simulate-hit <reaction-file> <health-file> <offensive-action-file> [--target-action-active] [--json]",
    `damage-reaction runtime-test <reaction-file> <health-file> <offensive-action-file> --scenario <hit-continues|stagger-interrupts|defeat-interrupts> [--fixed-delta <number>] ${commonRuntimeFlags}`,
    `damage-reaction set <file> <property-path> <json-value> ${commonSetFlags}`
  ],
  weapon: [
    "weapon inspect <file> [--json]", "weapon validate <file> [--json]",
    "weapon simulate-strike <weapon-file> <stamina-file> <health-file> <hurtbox-file> <reaction-file> [--fixed-delta <number>] [--json]",
    `weapon runtime-test <weapon-file> <stamina-file> <health-file> <hurtbox-file> <reaction-file> --scenario <successful-strike|insufficient-stamina> [--fixed-delta <number>] ${commonRuntimeFlags}`,
    `weapon set <file> <property-path> <json-value> ${commonSetFlags}`
  ],
  "large-enemy": [
    "large-enemy inspect <file> [--json]", "large-enemy validate <file> [--json]",
    "large-enemy simulate <file> --scenario <full-cycle|primary-part-disabled> [--fixed-delta <number>] [--json]",
    `large-enemy runtime-test <file> --scenario <full-cycle|primary-part-disabled> [--fixed-delta <number>] ${commonRuntimeFlags}`,
    `large-enemy set <file> <property-path> <json-value> ${commonSetFlags}`
  ],
  hunter: definitionOnlyHelp("hunter"),
  arena: definitionOnlyHelp("arena"),
  encounter: [
    "encounter inspect <file> [--json]", "encounter validate <file> [--json]",
    "encounter simulate <file> --scenario <successful-hunt|stamina-exhausted> [--fixed-delta <number>] [--json]",
    `encounter runtime-test <file> --scenario <successful-hunt|stamina-exhausted> [--fixed-delta <number>] ${commonRuntimeFlags}`,
    `encounter interactive-test <file> --scenario <successful-hunt|stamina-exhausted> [--fixed-delta <number>] ${commonRuntimeFlags}`,
    `encounter recovery-test <file> --scenario successful-hunt [--interrupt-after-round <number>] [--fixed-delta <number>] ${commonRuntimeFlags}`,
    `encounter set <file> <property-path> <json-value> ${commonSetFlags}`
  ],
  combat: [
    "combat simulate-exchange <health-file> <offensive-action-file> [--json]",
    "combat simulate-stamina-exchange <stamina-file> <health-file> <offensive-action-file> [--json]",
    "combat simulate-targeted-exchange <targeting-file> <stamina-file> <health-file> <offensive-action-file> [--scenario <target-available|no-valid-target>] [--json]",
    `combat runtime-test <health-file> <offensive-action-file> ${commonRuntimeFlags}`,
    `combat stamina-runtime-test <stamina-file> <health-file> <offensive-action-file> [--scenario <accepted|insufficient-stamina>] ${commonRuntimeFlags}`,
    `combat targeted-runtime-test <targeting-file> <stamina-file> <health-file> <offensive-action-file> [--scenario <target-available|no-valid-target>] ${commonRuntimeFlags}`
  ],
  editor: ["editor serve [--host <host>] [--port <number>] [--workspace <path>] [--json]"],
  snapshot: ["snapshot list [--json]", "snapshot create <file> [--json]", "snapshot rollback <snapshot-id> [--json]"],
  runtime: ["runtime check [--godot <path>] [--json]"]
};

export function renderHelpRequest(argv: readonly string[]): string | null {
  if (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h")) return renderTopLevelHelp();
  if (argv.length === 2 && isSupportedCommandGroup(argv[0] ?? "") && (argv[1] === "--help" || argv[1] === "-h")) return renderGroupHelp(argv[0] as CommandGroup);
  if (argv.length === 2 && argv[0] === "help" && isSupportedCommandGroup(argv[1] ?? "")) return renderGroupHelp(argv[1] as CommandGroup);
  return null;
}

export function renderTopLevelHelp(): string {
  const groups = Object.keys(SUPPORTED_COMMAND_ACTIONS);
  return ["mam <command-group> <action> [arguments] [--json]", "", "Command groups:", ...groups.map((group) => `  ${group}`), "", "Run 'mam <command-group> --help' for supported commands.", ""].join("\n");
}

export function renderGroupHelp(group: CommandGroup): string {
  return [`mam ${group} commands:`, "", ...COMMAND_HELP[group].map((syntax) => `  mam ${syntax}`), ""].join("\n");
}

export function helpGuidance(group: string): string | null {
  return isSupportedCommandGroup(group) ? `Run 'mam ${group} --help' for supported ${group} commands.` : null;
}

function definitionOnlyHelp(group: "hunter" | "arena"): readonly string[] {
  return [`${group} inspect <file> [--json]`, `${group} validate <file> [--json]`, `${group} set <file> <property-path> <json-value> ${commonSetFlags}`];
}

function actionProfileHelp(group: "defensive-action" | "offensive-action" | "action-timeline"): readonly string[] {
  return [
    `${group} inspect <file> [--json]`, `${group} validate <file> [--json]`,
    `${group} simulate <file> [--fixed-delta <number>] [--json]`,
    `${group} runtime-test <file> [--fixed-delta <number>] ${commonRuntimeFlags}`,
    `${group} set <file> <property-path> <json-value> ${commonSetFlags}`
  ];
}
