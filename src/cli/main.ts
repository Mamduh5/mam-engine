#!/usr/bin/env node

import { inspectMovement } from "../application/movement/inspectMovement";
import { inspectCamera } from "../application/camera/inspectCamera";
import { setCameraValue } from "../application/camera/setCameraValue";
import { simulateCameraFile } from "../application/camera/simulateCamera";
import { validateCameraFile } from "../application/camera/validateCamera";
import { setMovementValue } from "../application/movement/setMovementValue";
import { simulateMovementFile } from "../application/movement/simulateMovement";
import { validateMovementFile } from "../application/movement/validateMovement";
import { createSnapshot } from "../application/snapshots/createSnapshot";
import { listSnapshots } from "../application/snapshots/listSnapshots";
import { rollbackSnapshot } from "../application/snapshots/rollbackSnapshot";
import { checkRuntime } from "../application/runtime/checkRuntime";
import { runMovementRuntimeTest } from "../application/runtime/runMovementRuntimeTest";
import { runCameraRuntimeTest } from "../application/runtime/runCameraRuntimeTest";
import { runTargetingRuntimeTest } from "../application/runtime/runTargetingRuntimeTest";
import { inspectTargeting } from "../application/targeting/inspectTargeting";
import { setTargetingValue } from "../application/targeting/setTargetingValue";
import { simulateTargetingFile } from "../application/targeting/simulateTargeting";
import { validateTargetingFile } from "../application/targeting/validateTargeting";
import { inspectDefensiveAction } from "../application/defensiveAction/inspectDefensiveAction";
import { setDefensiveActionValue } from "../application/defensiveAction/setDefensiveActionValue";
import { simulateDefensiveActionFile } from "../application/defensiveAction/simulateDefensiveAction";
import { validateDefensiveActionFile } from "../application/defensiveAction/validateDefensiveAction";
import { runDefensiveActionRuntimeTest } from "../application/runtime/runDefensiveActionRuntimeTest";
import { inspectOffensiveAction } from "../application/offensiveAction/inspectOffensiveAction";
import { setOffensiveActionValue } from "../application/offensiveAction/setOffensiveActionValue";
import { simulateOffensiveActionFile } from "../application/offensiveAction/simulateOffensiveAction";
import { validateOffensiveActionFile } from "../application/offensiveAction/validateOffensiveAction";
import { runOffensiveActionRuntimeTest } from "../application/runtime/runOffensiveActionRuntimeTest";
import { inspectHealth } from "../application/health/inspectHealth";
import { setHealthValue } from "../application/health/setHealthValue";
import { simulateHitFiles } from "../application/health/simulateHit";
import { validateHealthFile } from "../application/health/validateHealth";
import { runHealthRuntimeTest } from "../application/runtime/runHealthRuntimeTest";
import { simulateCombatExchangeFiles } from "../application/combat/simulateCombatExchange";
import { simulateStaminaCombatExchangeFiles } from "../application/combat/simulateStaminaCombatExchange";
import { simulateTargetedCombatExchangeFiles } from "../application/combat/simulateTargetedCombatExchange";
import { runCombatRuntimeTest } from "../application/runtime/runCombatRuntimeTest";
import { inspectStamina } from "../application/stamina/inspectStamina";
import { setStaminaValue } from "../application/stamina/setStaminaValue";
import { simulateStaminaActionFiles } from "../application/stamina/simulateStaminaAction";
import { validateStaminaFile } from "../application/stamina/validateStamina";
import { runStaminaRuntimeTest } from "../application/runtime/runStaminaRuntimeTest";
import { runStaminaCombatRuntimeTest } from "../application/runtime/runStaminaCombatRuntimeTest";
import { runTargetedCombatRuntimeTest } from "../application/runtime/runTargetedCombatRuntimeTest";
import { ErrorCodes } from "../shared/errorCodes";
import { operationResult, type OperationResult } from "../shared/operationResult";
import { CliParseError, parseCommand, type ParsedCommand } from "./commandParser";
import { writeResult } from "./output";
import { inspectActionTimeline } from "../application/actionTimeline/inspectActionTimeline";
import { setActionTimelineValue } from "../application/actionTimeline/setActionTimelineValue";
import { simulateActionTimelineFile } from "../application/actionTimeline/simulateActionTimeline";
import { validateActionTimelineFile } from "../application/actionTimeline/validateActionTimeline";
import { runActionTimelineRuntimeTest } from "../application/runtime/runActionTimelineRuntimeTest";
import { inspectContactVolume } from "../application/contactVolume/inspectContactVolume";
import { setContactVolumeValue } from "../application/contactVolume/setContactVolumeValue";
import { simulateContactVolumeFiles } from "../application/contactVolume/simulateContactVolume";
import { validateContactVolumeFile } from "../application/contactVolume/validateContactVolume";
import { runContactVolumeRuntimeTest } from "../application/runtime/runContactVolumeRuntimeTest";
import { inspectDamageReaction } from "../application/damageReaction/inspectDamageReaction";
import { setDamageReactionValue } from "../application/damageReaction/setDamageReactionValue";
import { simulateDamageReactionFiles } from "../application/damageReaction/simulateDamageReaction";
import { validateDamageReactionFile } from "../application/damageReaction/validateDamageReaction";
import { runDamageReactionRuntimeTest } from "../application/runtime/runDamageReactionRuntimeTest";
import { inspectWeapon } from "../application/weapon/inspectWeapon";
import { setWeaponValue } from "../application/weapon/setWeaponValue";
import { simulateWeaponStrikeFiles } from "../application/weapon/simulateWeaponStrike";
import { validateWeaponFile } from "../application/weapon/validateWeapon";
import { runWeaponRuntimeTest } from "../application/runtime/runWeaponRuntimeTest";
import { inspectLargeEnemy } from "../application/largeEnemy/inspectLargeEnemy";
import { setLargeEnemyValue } from "../application/largeEnemy/setLargeEnemyValue";
import { simulateLargeEnemyFile } from "../application/largeEnemy/simulateLargeEnemy";
import { validateLargeEnemyFile } from "../application/largeEnemy/validateLargeEnemy";

export interface CliApplicationDependencies {
  setMovementValue: typeof setMovementValue;
  setCameraValue: typeof setCameraValue;
  setTargetingValue: typeof setTargetingValue;
  setDefensiveActionValue: typeof setDefensiveActionValue;
  setOffensiveActionValue: typeof setOffensiveActionValue;
  setHealthValue: typeof setHealthValue;
  setStaminaValue: typeof setStaminaValue;
  setActionTimelineValue: typeof setActionTimelineValue;
  setContactVolumeValue: typeof setContactVolumeValue;
  setDamageReactionValue: typeof setDamageReactionValue;
  setWeaponValue: typeof setWeaponValue;
  setLargeEnemyValue: typeof setLargeEnemyValue;
  rollbackSnapshot: typeof rollbackSnapshot;
}

export interface CliExecution {
  result: OperationResult;
  json: boolean;
  exitCode: number;
}

const productionDependencies: CliApplicationDependencies = { setMovementValue, setCameraValue, setTargetingValue, setDefensiveActionValue, setOffensiveActionValue, setHealthValue, setStaminaValue, setActionTimelineValue, setContactVolumeValue, setDamageReactionValue, setWeaponValue, setLargeEnemyValue, rollbackSnapshot };

export async function executeCli(
  argv: string[],
  workspaceRoot = process.cwd(),
  injectedDependencies: Partial<CliApplicationDependencies> = {}
): Promise<CliExecution> {
  const dependencies = { ...productionDependencies, ...injectedDependencies };
  let command: ParsedCommand;
  try {
    command = parseCommand(argv);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    const result = operationResult({
      command: "cli.parse",
      status: "failed",
      input: { arguments: argv },
      errors: [{
        code: caught instanceof CliParseError ? caught.code : ErrorCodes.CliArgumentInvalid,
        message
      }]
    });
    return { result, json: argv.includes("--json"), exitCode: 2 };
  }

  let result: OperationResult;
  try {
    result = await dispatch(command, workspaceRoot, dependencies);
  } catch (caught) {
    result = operationResult({
      command: command.kind,
      status: "failed",
      errors: [{
        code: ErrorCodes.InternalError,
        message: caught instanceof Error ? caught.message : String(caught)
      }]
    });
  }
  return { result, json: command.json, exitCode: result.status === "failed" ? 1 : 0 };
}

export async function runCli(argv: string[], workspaceRoot = process.cwd()): Promise<number> {
  const execution = await executeCli(argv, workspaceRoot);
  writeResult(execution.result, execution.json);
  return execution.exitCode;
}

async function dispatch(
  command: ParsedCommand,
  workspaceRoot: string,
  dependencies: CliApplicationDependencies
): Promise<OperationResult> {
  switch (command.kind) {
    case "large-enemy.inspect": return inspectLargeEnemy(workspaceRoot, command.file);
    case "large-enemy.validate": return validateLargeEnemyFile(workspaceRoot, command.file);
    case "large-enemy.simulate": return simulateLargeEnemyFile(workspaceRoot, command.file, command.scenario, command.fixedDelta);
    case "large-enemy.set": return dependencies.setLargeEnemyValue(workspaceRoot, command.file, command.propertyPath, command.value, command.dryRun);
    case "weapon.inspect": return inspectWeapon(workspaceRoot, command.file);
    case "weapon.validate": return validateWeaponFile(workspaceRoot, command.file);
    case "weapon.simulate-strike": return simulateWeaponStrikeFiles(workspaceRoot, command.weaponFile, command.staminaFile, command.healthFile, command.hurtboxFile, command.reactionFile, command.fixedDelta);
    case "weapon.runtime-test": return runWeaponRuntimeTest(workspaceRoot, command.weaponFile, command.staminaFile, command.healthFile, command.hurtboxFile, command.reactionFile, command.scenario, command.fixedDelta, { godot: command.godot, keepSession: command.keepSession });
    case "weapon.set": return dependencies.setWeaponValue(workspaceRoot, command.file, command.propertyPath, command.value, command.dryRun);
    case "damage-reaction.inspect": return inspectDamageReaction(workspaceRoot, command.file);
    case "damage-reaction.validate": return validateDamageReactionFile(workspaceRoot, command.file);
    case "damage-reaction.simulate-hit": return simulateDamageReactionFiles(workspaceRoot, command.reactionFile, command.healthFile, command.offensiveActionFile, command.targetActionWasActive);
    case "damage-reaction.runtime-test": return runDamageReactionRuntimeTest(workspaceRoot, command.reactionFile, command.healthFile, command.offensiveActionFile, command.scenario, command.fixedDelta, { godot: command.godot, keepSession: command.keepSession });
    case "damage-reaction.set": return dependencies.setDamageReactionValue(workspaceRoot, command.file, command.propertyPath, command.value, command.dryRun);
    case "contact-volume.inspect": return inspectContactVolume(workspaceRoot, command.file);
    case "contact-volume.validate": return validateContactVolumeFile(workspaceRoot, command.file);
    case "contact-volume.simulate-contact": return simulateContactVolumeFiles(workspaceRoot, command.hitboxFile, command.hurtboxFile, command.fixedDelta);
    case "contact-volume.runtime-test": return runContactVolumeRuntimeTest(workspaceRoot, command.hitboxFile, command.hurtboxFile, command.scenario, command.fixedDelta, { godot: command.godot, keepSession: command.keepSession });
    case "contact-volume.set": return dependencies.setContactVolumeValue(workspaceRoot, command.file, command.propertyPath, command.value, command.dryRun);
    case "action-timeline.inspect": return inspectActionTimeline(workspaceRoot, command.file);
    case "action-timeline.validate": return validateActionTimelineFile(workspaceRoot, command.file);
    case "action-timeline.simulate": return simulateActionTimelineFile(workspaceRoot, command.file, command.fixedDelta);
    case "action-timeline.runtime-test": return runActionTimelineRuntimeTest(workspaceRoot, command.file, command.fixedDelta, { godot: command.godot, keepSession: command.keepSession });
    case "action-timeline.set": return dependencies.setActionTimelineValue(workspaceRoot, command.file, command.propertyPath, command.value, command.dryRun);
    case "stamina.inspect": return inspectStamina(workspaceRoot, command.file);
    case "stamina.validate": return validateStaminaFile(workspaceRoot, command.file);
    case "stamina.simulate-action": return simulateStaminaActionFiles(workspaceRoot, command.staminaFile, command.actionFile);
    case "stamina.runtime-test": return runStaminaRuntimeTest(workspaceRoot, command.staminaFile, command.actionFile, { godot: command.godot, keepSession: command.keepSession });
    case "stamina.set": return dependencies.setStaminaValue(workspaceRoot, command.file, command.propertyPath, command.value, command.dryRun);
    case "combat.simulate-exchange": return simulateCombatExchangeFiles(workspaceRoot, command.healthFile, command.offensiveActionFile);
    case "combat.simulate-stamina-exchange": return simulateStaminaCombatExchangeFiles(workspaceRoot, command.staminaFile, command.healthFile, command.offensiveActionFile);
    case "combat.simulate-targeted-exchange": return simulateTargetedCombatExchangeFiles(workspaceRoot, command.targetingFile, command.staminaFile, command.healthFile, command.offensiveActionFile, command.scenario);
    case "combat.targeted-runtime-test": return runTargetedCombatRuntimeTest(workspaceRoot, command.targetingFile, command.staminaFile, command.healthFile, command.offensiveActionFile, command.scenario, { godot: command.godot, keepSession: command.keepSession });
    case "combat.runtime-test": return runCombatRuntimeTest(workspaceRoot, command.healthFile, command.offensiveActionFile, { godot: command.godot, keepSession: command.keepSession });
    case "combat.stamina-runtime-test": return runStaminaCombatRuntimeTest(workspaceRoot, command.staminaFile, command.healthFile, command.offensiveActionFile, command.scenario, { godot: command.godot, keepSession: command.keepSession });
    case "health.inspect": return inspectHealth(workspaceRoot, command.file);
    case "health.validate": return validateHealthFile(workspaceRoot, command.file);
    case "health.simulate-hit": return simulateHitFiles(workspaceRoot, command.healthFile, command.offensiveActionFile);
    case "health.runtime-test": return runHealthRuntimeTest(workspaceRoot, command.healthFile, command.offensiveActionFile, { godot: command.godot, keepSession: command.keepSession });
    case "health.set": return dependencies.setHealthValue(workspaceRoot, command.file, command.propertyPath, command.value, command.dryRun);
    case "offensive-action.inspect": return inspectOffensiveAction(workspaceRoot, command.file);
    case "offensive-action.validate": return validateOffensiveActionFile(workspaceRoot, command.file);
    case "offensive-action.simulate": return simulateOffensiveActionFile(workspaceRoot, command.file, command.fixedDelta);
    case "offensive-action.runtime-test": return runOffensiveActionRuntimeTest(workspaceRoot, command.file, command.fixedDelta, { godot: command.godot, keepSession: command.keepSession });
    case "offensive-action.set": return dependencies.setOffensiveActionValue(workspaceRoot, command.file, command.propertyPath, command.value, command.dryRun);
    case "defensive-action.inspect": return inspectDefensiveAction(workspaceRoot, command.file);
    case "defensive-action.validate": return validateDefensiveActionFile(workspaceRoot, command.file);
    case "defensive-action.simulate": return simulateDefensiveActionFile(workspaceRoot, command.file, command.fixedDelta);
    case "defensive-action.runtime-test": return runDefensiveActionRuntimeTest(workspaceRoot, command.file, command.fixedDelta, { godot: command.godot, keepSession: command.keepSession });
    case "defensive-action.set": return dependencies.setDefensiveActionValue(workspaceRoot, command.file, command.propertyPath, command.value, command.dryRun);
    case "camera.inspect": return inspectCamera(workspaceRoot, command.file);
    case "camera.validate": return validateCameraFile(workspaceRoot, command.file);
    case "camera.simulate": return simulateCameraFile(workspaceRoot, command.file, command.scenario, command.seconds, command.fixedDelta);
    case "camera.runtime-test": return runCameraRuntimeTest(workspaceRoot, command.file, command.scenario, command.seconds, command.fixedDelta, { godot: command.godot, keepSession: command.keepSession });
    case "camera.set": return dependencies.setCameraValue(workspaceRoot, command.file, command.propertyPath, command.value, command.dryRun);
    case "targeting.inspect": return inspectTargeting(workspaceRoot, command.file);
    case "targeting.validate": return validateTargetingFile(workspaceRoot, command.file);
    case "targeting.simulate": return simulateTargetingFile(workspaceRoot, command.file, command.scenario, command.seconds, command.fixedDelta);
    case "targeting.runtime-test": return runTargetingRuntimeTest(workspaceRoot, command.file, command.camera, command.scenario, command.seconds, command.fixedDelta, { godot: command.godot, keepSession: command.keepSession });
    case "targeting.set": return dependencies.setTargetingValue(workspaceRoot, command.file, command.propertyPath, command.value, command.dryRun);
    case "movement.inspect":
      return inspectMovement(workspaceRoot, command.file);
    case "movement.validate":
      return validateMovementFile(workspaceRoot, command.file);
    case "movement.simulate":
      return simulateMovementFile(workspaceRoot, command.file, command.scenario, command.seconds);
    case "movement.runtime-test":
      return runMovementRuntimeTest(workspaceRoot, command.file, command.scenario, command.seconds, command.cameraYawDegrees, { godot: command.godot, keepSession: command.keepSession });
    case "movement.set":
      return dependencies.setMovementValue(workspaceRoot, command.file, command.propertyPath, command.value, command.dryRun);
    case "snapshot.list":
      return listSnapshots(workspaceRoot);
    case "snapshot.create":
      return createSnapshot(workspaceRoot, command.file);
    case "snapshot.rollback":
      return dependencies.rollbackSnapshot(workspaceRoot, command.snapshotId);
    case "runtime.check":
      return checkRuntime(workspaceRoot, command.godot);
  }
}

if (require.main === module) {
  void runCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
