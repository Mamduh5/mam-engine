import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { runEncounterRecoveryTest } from "../../src/application/runtime/runEncounterRecoveryTest";
import { executeCli } from "../../src/cli/main";
import type { EncounterScenario } from "../../src/domain/encounter/encounterTypes";
import { discoverGodot } from "../../src/infrastructure/runtime/godotDiscovery";
import { ErrorCodes } from "../../src/shared/errorCodes";
import { projectRoot } from "../testUtils";

const availability = discoverGodot().then(() => null, (error: Error) => error.message);
const encounterFile = "examples/encounter/training-hunt.json";

test("Phase 9D proves interactive encounter input and deterministic checkpoint recovery", async (context) => {
  const reason = await availability; if (reason) { context.skip(`Godot unavailable: ${reason}`); return; }
  const before = await readFile(`${projectRoot()}/${encounterFile}`, "utf8");
  const interactiveScenarios: Array<{ id: EncounterScenario; outcome: string; failure: string; accepted: number; health: number }> = [
    { id: "successful-hunt", outcome: "victory", failure: "none", accepted: 5, health: 0 },
    { id: "stamina-exhausted", outcome: "failed", failure: "insufficient-stamina", accepted: 4, health: 20 }
  ];
  for (const scenario of interactiveScenarios) {
    const execution = await executeCli(["encounter", "interactive-test", encounterFile, "--scenario", scenario.id, "--fixed-delta", "0.1", "--json"], projectRoot()); const data = execution.result.data as any; const report = data?.finalEncounterReport;
    assert.equal(execution.result.status, "passed", JSON.stringify(execution.result)); assert.equal(data.interactiveModeConfirmed, true); assert.equal(data.inputEventsProcessed, 5); assert.equal(data.restartAvailable, true); assert.equal(data.checkpointCreated, true); assert.equal(data.checkpointPath, null); assert.equal(data.comparison.passed, true); assert.equal(report.outcome, scenario.outcome); assert.equal(report.failureReason, scenario.failure); assert.equal(report.acceptedStrikeCount, scenario.accepted); assert.equal(report.enemyRemainingHealth, scenario.health); assert.equal(report.roundSummaries.length, 5);
  }

  const recovery = await executeCli(["encounter", "recovery-test", encounterFile, "--scenario", "successful-hunt", "--interrupt-after-round", "1", "--fixed-delta", "0.1", "--json"], projectRoot()); const recovered = recovery.result.data as any;
  assert.equal(recovery.result.status, "passed", JSON.stringify(recovery.result)); assert.equal(recovered.checkpointCreated, true); assert.equal(recovered.interruptionRound, 1); assert.equal(recovered.resumedFromRound, 2); assert.deepEqual(recovered.recoveredStateValues, { currentHunterStamina: 90, currentEnemyHealth: 80, roundsCompleted: 1, totalConsumedStamina: 10, totalAppliedDamage: 20 }); assert.equal(recovered.processLaunchCount, 2); assert.equal(recovered.comparison.passed, true); assert.equal(recovered.finalEncounterReport.roundSummaries.length, 5); assert.deepEqual(recovered.finalEncounterReport.roundSummaries.map((round: any) => round.roundNumber), [1, 2, 3, 4, 5]); assert.equal(recovered.finalEncounterReport.hunterConsumedStamina, 50); assert.equal(recovered.finalEncounterReport.totalDamageApplied, 100); assert.equal(recovered.finalEncounterReport.outcome, "victory");

  const invalid = await runEncounterRecoveryTest(projectRoot(), encounterFile, 1, 0.1, { tamperCheckpoint: (checkpoint) => ({ ...checkpoint, encounterId: "tampered" }) }); const rejected = invalid.data as any;
  assert.equal(invalid.status, "failed"); assert.equal(invalid.errors[0]?.code, ErrorCodes.EncounterCheckpointInvalid); assert.equal(rejected.secondProcessLaunched, false); assert.equal(rejected.processLaunchCount, 1); assert.match(rejected.checkpointErrors.join(" "), /encounter ID mismatch/);
  assert.equal(await readFile(`${projectRoot()}/${encounterFile}`, "utf8"), before);
});
