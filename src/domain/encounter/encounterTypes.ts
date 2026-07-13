import type { ArenaPoint } from "../arena/arenaTypes";
import type { DamageReactionType } from "../damageReaction/damageReactionTypes";

export interface EncounterProfile {
  schemaVersion: 1;
  kind: "encounter-profile";
  id: string;
  displayName: string;
  hunterFile: string;
  weaponFile: string;
  enemyFile: string;
  arenaFile: string;
  maxRounds: number;
}

export type EncounterScenario = "successful-hunt" | "stamina-exhausted";
export type EncounterFailureReason = "none" | "insufficient-stamina" | "no-contact" | "round-limit";

export interface ResolvedEncounterDefinitionPaths { hunterFile: string; weaponFile: string; enemyFile: string; arenaFile: string }

export interface EncounterRoundSummary {
  roundNumber: number;
  enemyCycleCompleted: boolean;
  startingStamina: number;
  actionAccepted: boolean;
  consumedStamina: number;
  remainingStamina: number;
  startingEnemyHealth: number;
  contactOccurred: boolean;
  damageApplied: number;
  remainingEnemyHealth: number;
  reactionType: DamageReactionType;
  enemyDefeated: boolean;
  roundOutcome: "continued" | "victory" | "failed";
  failureReason: EncounterFailureReason;
}

export interface EncounterSimulation {
  encounterId: string;
  resolvedDefinitionPaths: ResolvedEncounterDefinitionPaths;
  arenaRadius: number;
  hunterSpawn: ArenaPoint;
  enemySpawn: ArenaPoint;
  spawnSeparation: number;
  selectedBodyPartId: string;
  maximumRounds: number;
  roundsStarted: number;
  roundsCompleted: number;
  enemyBehaviorCyclesCompleted: number;
  hunterStartingHealth: number;
  hunterFinalHealth: number;
  hunterStartingStamina: number;
  hunterConsumedStamina: number;
  hunterRemainingStamina: number;
  enemyStartingHealth: number;
  enemyRemainingHealth: number;
  totalDamageApplied: number;
  strikeCount: number;
  acceptedStrikeCount: number;
  contactCount: number;
  lastReactionType: DamageReactionType;
  enemyDefeated: boolean;
  objectiveCompleted: boolean;
  outcome: "victory" | "failed";
  failureReason: EncounterFailureReason;
  finalHunterState: "alive";
  finalEnemyState: "alive" | "defeated";
  finalEncounterState: "completed" | "failed";
  roundSummaries: EncounterRoundSummary[];
}
