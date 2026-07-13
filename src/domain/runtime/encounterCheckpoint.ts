import type { EncounterRoundSummary, EncounterScenario } from "../encounter/encounterTypes";
import type { DamageReactionType } from "../damageReaction/damageReactionTypes";

export const ENCOUNTER_CHECKPOINT_SCHEMA_VERSION = "mam.encounter-checkpoint/v1" as const;

export interface EncounterRuntimeCheckpoint {
  schemaVersion: typeof ENCOUNTER_CHECKPOINT_SCHEMA_VERSION;
  encounterId: string;
  scenarioId: EncounterScenario;
  selectedBodyPartId: string;
  nextRoundNumber: number;
  roundsCompleted: number;
  enemyBehaviorCyclesCompleted: number;
  currentHunterStamina: number;
  currentEnemyHealth: number;
  totalConsumedStamina: number;
  totalAppliedDamage: number;
  strikeCount: number;
  acceptedStrikeCount: number;
  contactCount: number;
  lastReactionType: DamageReactionType;
  roundSummaries: EncounterRoundSummary[];
  encounterState: "in-progress" | "completed" | "failed";
}

export interface EncounterCheckpointExpectations {
  encounterId: string;
  scenarioId: EncounterScenario;
  selectedBodyPartId: string;
  maximumRounds: number;
  startingStamina: number;
  maximumStamina: number;
  startingEnemyHealth: number;
  maximumEnemyHealth: number;
  requireResumable?: boolean;
}

export function validateEncounterCheckpoint(value: unknown, expected: EncounterCheckpointExpectations): { valid: boolean; checkpoint?: EncounterRuntimeCheckpoint; errors: string[] } {
  const errors: string[] = []; if (!record(value)) return { valid: false, errors: ["checkpoint must be an object"] };
  const required = ["schemaVersion", "encounterId", "scenarioId", "selectedBodyPartId", "nextRoundNumber", "roundsCompleted", "enemyBehaviorCyclesCompleted", "currentHunterStamina", "currentEnemyHealth", "totalConsumedStamina", "totalAppliedDamage", "strikeCount", "acceptedStrikeCount", "contactCount", "lastReactionType", "roundSummaries", "encounterState"];
  if (Object.keys(value).length !== required.length || required.some((key) => !(key in value))) errors.push("checkpoint fields do not match schema");
  if (value.schemaVersion !== ENCOUNTER_CHECKPOINT_SCHEMA_VERSION) errors.push("unsupported checkpoint schema version");
  if (value.encounterId !== expected.encounterId) errors.push("checkpoint encounter ID mismatch");
  if (value.scenarioId !== expected.scenarioId) errors.push("checkpoint scenario ID mismatch");
  if (value.selectedBodyPartId !== expected.selectedBodyPartId) errors.push("checkpoint selected body part mismatch");
  for (const key of ["nextRoundNumber", "roundsCompleted", "enemyBehaviorCyclesCompleted", "strikeCount", "acceptedStrikeCount", "contactCount"] as const) if (!integer(value[key]) || value[key] < 0) errors.push(`checkpoint ${key} must be a non-negative integer`);
  for (const key of ["currentHunterStamina", "currentEnemyHealth", "totalConsumedStamina", "totalAppliedDamage"] as const) if (!finite(value[key]) || value[key] < 0) errors.push(`checkpoint ${key} must be finite and non-negative`);
  const rounds = integer(value.roundsCompleted) ? value.roundsCompleted : -1; const nextRound = integer(value.nextRoundNumber) ? value.nextRoundNumber : -1;
  if (nextRound !== rounds + 1 || nextRound > expected.maximumRounds + 1) errors.push("checkpoint next round is inconsistent");
  if (value.enemyBehaviorCyclesCompleted !== rounds || value.strikeCount !== rounds) errors.push("checkpoint accumulated round counts are inconsistent");
  if (!Array.isArray(value.roundSummaries) || value.roundSummaries.length !== rounds) errors.push("checkpoint round summaries are inconsistent");
  if (value.acceptedStrikeCount > value.strikeCount || value.contactCount > value.acceptedStrikeCount) errors.push("checkpoint strike counters are inconsistent");
  if (finite(value.currentHunterStamina) && value.currentHunterStamina > expected.maximumStamina) errors.push("checkpoint stamina exceeds authored maximum");
  if (finite(value.currentEnemyHealth) && value.currentEnemyHealth > expected.maximumEnemyHealth) errors.push("checkpoint enemy health exceeds authored maximum");
  if (finite(value.currentHunterStamina) && finite(value.totalConsumedStamina) && Math.abs(expected.startingStamina - value.currentHunterStamina - value.totalConsumedStamina) > 1e-6) errors.push("checkpoint stamina totals are inconsistent");
  if (finite(value.currentEnemyHealth) && finite(value.totalAppliedDamage) && Math.abs(expected.startingEnemyHealth - value.currentEnemyHealth - value.totalAppliedDamage) > 1e-6) errors.push("checkpoint damage totals are inconsistent");
  if (!["none", "hit", "stagger", "defeat"].includes(String(value.lastReactionType))) errors.push("checkpoint reaction type is invalid");
  if (!Array.isArray(value.roundSummaries) || !value.roundSummaries.every((summary, index) => validSummary(summary, index + 1))) errors.push("checkpoint round summary sequence is invalid");
  if (Array.isArray(value.roundSummaries) && value.roundSummaries.length > 0) { const last = value.roundSummaries.at(-1); if (record(last) && (last.remainingStamina !== value.currentHunterStamina || last.remainingEnemyHealth !== value.currentEnemyHealth || last.reactionType !== value.lastReactionType)) errors.push("checkpoint terminal round values are inconsistent"); }
  if (!["in-progress", "completed", "failed"].includes(String(value.encounterState))) errors.push("checkpoint encounter state is invalid");
  if (expected.requireResumable === true && value.encounterState !== "in-progress") errors.push("checkpoint is not resumable");
  return errors.length === 0 ? { valid: true, checkpoint: structuredClone(value) as unknown as EncounterRuntimeCheckpoint, errors } : { valid: false, errors };
}

function validSummary(value: unknown, round: number): boolean { return record(value) && value.roundNumber === round && value.enemyCycleCompleted === true && typeof value.actionAccepted === "boolean" && finite(value.startingStamina) && finite(value.consumedStamina) && finite(value.remainingStamina) && finite(value.startingEnemyHealth) && typeof value.contactOccurred === "boolean" && finite(value.damageApplied) && finite(value.remainingEnemyHealth) && typeof value.reactionType === "string" && typeof value.enemyDefeated === "boolean" && typeof value.roundOutcome === "string" && typeof value.failureReason === "string"; }
function record(value: unknown): value is Record<string, any> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function integer(value: unknown): value is number { return Number.isInteger(value); }
