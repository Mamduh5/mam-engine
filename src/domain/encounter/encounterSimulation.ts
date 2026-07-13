import type { ArenaProfile } from "../arena/arenaTypes";
import type { ContactVolumeProfile } from "../contactVolume/contactVolumeTypes";
import type { HealthProfile } from "../health/healthTypes";
import { simulateLargeEnemyBehavior } from "../largeEnemy/largeEnemySimulation";
import type { LargeEnemyProfile, ResolvedLargeEnemyDefinitionPaths } from "../largeEnemy/largeEnemyTypes";
import { roundMetric } from "../movement/movementMetrics";
import type { StaminaProfile } from "../stamina/staminaTypes";
import { simulateWeaponStrike } from "../weapon/weaponSimulation";
import type { WeaponProfile, ResolvedWeaponDefinitionPaths } from "../weapon/weaponTypes";
import type { OffensiveActionProfile } from "../offensiveAction/offensiveActionTypes";
import type { ActionTimelineProfile } from "../actionTimeline/actionTimelineTypes";
import type { DamageReactionProfile } from "../damageReaction/damageReactionTypes";
import type { EncounterFailureReason, EncounterProfile, EncounterRoundSummary, EncounterScenario, EncounterSimulation, ResolvedEncounterDefinitionPaths } from "./encounterTypes";

export interface EncounterSimulationInputs {
  profile: EncounterProfile;
  resolvedDefinitionPaths: ResolvedEncounterDefinitionPaths;
  arena: ArenaProfile;
  hunterHealth: HealthProfile;
  hunterStamina: StaminaProfile;
  weapon: { profile: WeaponProfile; resolvedDefinitionPaths: ResolvedWeaponDefinitionPaths; offensiveAction: OffensiveActionProfile; actionTimeline: ActionTimelineProfile; hitbox: ContactVolumeProfile };
  enemy: LargeEnemyProfile;
  enemyResolvedDefinitionPaths: ResolvedLargeEnemyDefinitionPaths;
  enemyHealth: HealthProfile;
  enemyReaction: DamageReactionProfile;
  selectedBodyPartId: string;
  selectedHurtbox: ContactVolumeProfile;
  scenario: EncounterScenario;
  fixedDeltaSeconds?: number;
}

export function simulateEncounter(inputs: EncounterSimulationInputs): EncounterSimulation {
  const { profile, arena, weapon, enemy, selectedHurtbox } = inputs;
  const fixedDelta = inputs.fixedDeltaSeconds;
  if (fixedDelta !== undefined && (!Number.isFinite(fixedDelta) || fixedDelta <= 0)) throw new Error("fixedDeltaSeconds must be finite and greater than 0");
  let stamina = inputs.scenario === "stamina-exhausted" ? exhaustedStartingStamina(inputs) : inputs.hunterStamina.startingStamina;
  const hunterStartingStamina = stamina;
  let enemyHealth = inputs.enemyHealth.startingHealth;
  let failureReason: EncounterFailureReason = "round-limit";
  let roundsCompleted = 0; let cycles = 0; let accepted = 0; let contacts = 0; let damage = 0;
  const summaries: EncounterRoundSummary[] = [];

  for (let round = 1; round <= profile.maxRounds && enemyHealth > 0; round += 1) {
    simulateLargeEnemyBehavior(enemy, inputs.enemyResolvedDefinitionPaths, "full-cycle", fixedDelta); cycles += 1;
    const startingStamina = stamina; const startingEnemyHealth = enemyHealth;
    const strike = simulateWeaponStrike(weapon.profile, weapon.resolvedDefinitionPaths, withStamina(inputs.hunterStamina, stamina), withHealth(inputs.enemyHealth, enemyHealth), selectedHurtbox, inputs.enemyReaction, weapon.offensiveAction, weapon.actionTimeline, weapon.hitbox, fixedDelta);
    stamina = strike.remainingStamina; enemyHealth = strike.remainingHealth;
    roundsCompleted += 1; if (strike.actionAccepted) accepted += 1;
    if (strike.contactOccurred) contacts += 1;
    damage += strike.appliedDamage;
    const reason: EncounterFailureReason = strike.defeated ? "none" : !strike.actionAccepted ? "insufficient-stamina" : !strike.contactOccurred ? "no-contact" : round === profile.maxRounds ? "round-limit" : "none";
    const outcome = strike.defeated ? "victory" : reason === "none" ? "continued" : "failed";
    summaries.push({ roundNumber: round, enemyCycleCompleted: true, startingStamina, actionAccepted: strike.actionAccepted, consumedStamina: strike.consumedStamina, remainingStamina: stamina, startingEnemyHealth, contactOccurred: strike.contactOccurred, damageApplied: strike.appliedDamage, remainingEnemyHealth: enemyHealth, reactionType: strike.reactionType, enemyDefeated: strike.defeated, roundOutcome: outcome, failureReason: reason });
    failureReason = reason;
    if (outcome !== "continued") break;
  }

  const enemyDefeated = enemyHealth === 0; if (enemyDefeated) failureReason = "none";
  return {
    encounterId: profile.id, resolvedDefinitionPaths: inputs.resolvedDefinitionPaths, arenaRadius: arena.radius,
    hunterSpawn: arena.playerSpawn, enemySpawn: arena.enemySpawn, spawnSeparation: roundMetric(distance(arena.playerSpawn, arena.enemySpawn)),
    selectedBodyPartId: inputs.selectedBodyPartId, maximumRounds: profile.maxRounds, roundsStarted: summaries.length, roundsCompleted,
    enemyBehaviorCyclesCompleted: cycles, hunterStartingHealth: inputs.hunterHealth.startingHealth, hunterFinalHealth: inputs.hunterHealth.startingHealth,
    hunterStartingStamina, hunterConsumedStamina: hunterStartingStamina - stamina, hunterRemainingStamina: stamina,
    enemyStartingHealth: inputs.enemyHealth.startingHealth, enemyRemainingHealth: enemyHealth, totalDamageApplied: damage,
    strikeCount: summaries.length, acceptedStrikeCount: accepted, contactCount: contacts, lastReactionType: summaries.at(-1)?.reactionType ?? "none",
    enemyDefeated, objectiveCompleted: enemyDefeated, outcome: enemyDefeated ? "victory" : "failed", failureReason,
    finalHunterState: "alive", finalEnemyState: enemyDefeated ? "defeated" : "alive", finalEncounterState: enemyDefeated ? "completed" : "failed", roundSummaries: summaries
  };
}

function exhaustedStartingStamina(inputs: EncounterSimulationInputs): number {
  let health = inputs.enemyHealth.startingHealth; let required = 0; let strikes = 0;
  for (; strikes < inputs.profile.maxRounds && health > 0; strikes += 1) {
    const strike = simulateWeaponStrike(inputs.weapon.profile, inputs.weapon.resolvedDefinitionPaths, withStamina(inputs.hunterStamina, inputs.weapon.offensiveAction.staminaCost), withHealth(inputs.enemyHealth, health), inputs.selectedHurtbox, inputs.enemyReaction, inputs.weapon.offensiveAction, inputs.weapon.actionTimeline, inputs.weapon.hitbox, inputs.fixedDeltaSeconds);
    if (!strike.actionAccepted || !strike.contactOccurred) throw new Error("stamina-exhausted requires an accepted contacting strike");
    required += strike.consumedStamina; health = strike.remainingHealth;
  }
  const cost = inputs.weapon.offensiveAction.staminaCost;
  if (health > 0 || strikes < 2 || cost <= 0) throw new Error("stamina-exhausted requires at least two positive-cost strikes within maxRounds");
  return Math.min(inputs.hunterStamina.startingStamina, required - cost);
}

function withStamina(profile: StaminaProfile, startingStamina: number): StaminaProfile { return { ...profile, maxStamina: Math.max(profile.maxStamina, startingStamina), startingStamina }; }
function withHealth(profile: HealthProfile, startingHealth: number): HealthProfile { return { ...profile, startingHealth }; }
function distance(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number { return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z); }
