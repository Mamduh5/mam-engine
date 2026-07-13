import type { OperationResult } from "../../shared/operationResult";
import { inspectActionTimeline } from "../actionTimeline/inspectActionTimeline";
import { inspectArena } from "../arena/inspectArena";
import { inspectCamera } from "../camera/inspectCamera";
import { inspectContactVolume } from "../contactVolume/inspectContactVolume";
import { inspectDamageReaction } from "../damageReaction/inspectDamageReaction";
import { inspectDefensiveAction } from "../defensiveAction/inspectDefensiveAction";
import { inspectEncounter } from "../encounter/inspectEncounter";
import { inspectHealth } from "../health/inspectHealth";
import { inspectHunter } from "../hunter/inspectHunter";
import { inspectLargeEnemy } from "../largeEnemy/inspectLargeEnemy";
import { inspectMovement } from "../movement/inspectMovement";
import { inspectOffensiveAction } from "../offensiveAction/inspectOffensiveAction";
import { inspectStamina } from "../stamina/inspectStamina";
import { inspectTargeting } from "../targeting/inspectTargeting";
import { inspectWeapon } from "../weapon/inspectWeapon";
import type { DefinitionKind } from "./definitionValidationRegistry";

type DefinitionInspector = (workspaceRoot: string, inputFile: string) => Promise<OperationResult>;

const inspectors: Record<DefinitionKind, DefinitionInspector> = {
  "movement-profile": inspectMovement,
  "camera-profile": inspectCamera,
  "targeting-profile": inspectTargeting,
  "defensive-action-profile": inspectDefensiveAction,
  "offensive-action-profile": inspectOffensiveAction,
  "health-profile": inspectHealth,
  "stamina-profile": inspectStamina,
  "action-timeline-profile": inspectActionTimeline,
  "contact-volume-profile": inspectContactVolume,
  "damage-reaction-profile": inspectDamageReaction,
  "weapon-profile": inspectWeapon,
  "large-enemy-profile": inspectLargeEnemy,
  "hunter-profile": inspectHunter,
  "arena-profile": inspectArena,
  "encounter-profile": inspectEncounter
};

export function inspectRegisteredDefinition(workspaceRoot: string, inputFile: string, kind: DefinitionKind): Promise<OperationResult> {
  return inspectors[kind](workspaceRoot, inputFile);
}
