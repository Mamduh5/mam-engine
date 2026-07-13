import type { HealthProfile } from "../health/healthTypes";
import { simulateDamage } from "../health/hitSimulation";
import type { OffensiveActionProfile } from "../offensiveAction/offensiveActionTypes";
import type { DamageReactionProfile, DamageReactionSimulation, DamageReactionType } from "./damageReactionTypes";

export const DAMAGE_REACTION_FIXED_DELTA_SECONDS = 1 / 60;
const EPSILON = 1e-12;

export function simulateDamageReactionHit(reaction: DamageReactionProfile, health: HealthProfile, action: OffensiveActionProfile, targetActionWasActive = false, fixedDeltaSeconds = DAMAGE_REACTION_FIXED_DELTA_SECONDS): DamageReactionSimulation {
  const { overkillDamage: _overkillDamage, ...simulation } = simulateDamageReaction(reaction, health, action.damage, targetActionWasActive, fixedDeltaSeconds);
  return simulation;
}

export function simulateDamageReaction(reaction: DamageReactionProfile, health: HealthProfile, damage: number, targetActionWasActive = false, fixedDeltaSeconds = DAMAGE_REACTION_FIXED_DELTA_SECONDS): DamageReactionSimulation & { overkillDamage: number } {
  if (!Number.isFinite(fixedDeltaSeconds) || fixedDeltaSeconds <= 0) throw new Error("fixedDeltaSeconds must be finite and greater than 0");
  const hit = simulateDamage(health, damage);
  const reactionType: DamageReactionType = hit.appliedDamage === 0 ? "none" : hit.defeated ? "defeat" : hit.appliedDamage >= reaction.staggerThreshold ? "stagger" : "hit";
  const reactionDurationSeconds = reactionType === "hit" ? reaction.hitReactionDurationSeconds : reactionType === "stagger" ? reaction.staggerDurationSeconds : 0;
  const reactionTotalSteps = reactionDurationSeconds === 0 ? 0 : Math.max(1, Math.ceil(reactionDurationSeconds / fixedDeltaSeconds - EPSILON));
  const targetActionInterrupted = targetActionWasActive && (reactionType === "stagger" || reactionType === "defeat");
  return { startingHealth: hit.startingHealth, incomingDamage: hit.incomingDamage, appliedDamage: hit.appliedDamage, remainingHealth: hit.remainingHealth, overkillDamage: hit.overkillDamage, defeated: hit.defeated, staggerThreshold: reaction.staggerThreshold, staggered: reactionType === "stagger", reactionType, reactionDurationSeconds, reactionTotalSteps, targetActionWasActive, targetActionInterrupted, finalTargetActionState: targetActionWasActive ? targetActionInterrupted ? "interrupted" : "continuing" : "inactive", finalTargetState: hit.finalTargetState };
}
