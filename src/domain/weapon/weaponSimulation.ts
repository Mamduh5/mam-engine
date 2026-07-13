import type { ActionTimelineProfile } from "../actionTimeline/actionTimelineTypes";
import { simulateActionTimeline } from "../actionTimeline/actionTimelineSimulation";
import type { ContactVolumeProfile } from "../contactVolume/contactVolumeTypes";
import { simulateContact } from "../contactVolume/contactVolumeSimulation";
import type { DamageReactionProfile } from "../damageReaction/damageReactionTypes";
import { simulateDamageReaction } from "../damageReaction/damageReactionSimulation";
import type { HealthProfile } from "../health/healthTypes";
import type { OffensiveActionProfile } from "../offensiveAction/offensiveActionTypes";
import { simulateOffensiveAction } from "../offensiveAction/offensiveActionSimulation";
import type { StaminaProfile } from "../stamina/staminaTypes";
import { simulateStaminaAction } from "../stamina/staminaSimulation";
import type { ResolvedWeaponDefinitionPaths, WeaponProfile, WeaponStrikeSimulation } from "./weaponTypes";

export const WEAPON_FIXED_DELTA_SECONDS = 1 / 60;

export function simulateWeaponStrike(weapon: WeaponProfile, resolvedDefinitionPaths: ResolvedWeaponDefinitionPaths, stamina: StaminaProfile, health: HealthProfile, hurtbox: ContactVolumeProfile, reaction: DamageReactionProfile, action: OffensiveActionProfile, timeline: ActionTimelineProfile, hitbox: ContactVolumeProfile, fixedDeltaSeconds = WEAPON_FIXED_DELTA_SECONDS): WeaponStrikeSimulation {
  if (!Number.isFinite(fixedDeltaSeconds) || fixedDeltaSeconds <= 0) throw new Error("fixedDeltaSeconds must be finite and greater than 0");
  const staminaResult = simulateStaminaAction(stamina, action);
  const base = { weaponId: weapon.id, resolvedDefinitionPaths, actionAccepted: staminaResult.actionAccepted, sufficientStamina: staminaResult.sufficientStamina, startingStamina: staminaResult.startingStamina, requestedStaminaCost: staminaResult.requestedStaminaCost, consumedStamina: staminaResult.consumedStamina, remainingStamina: staminaResult.remainingStamina, finalStaminaState: staminaResult.finalStaminaState };
  if (!staminaResult.actionAccepted) {
    const damage = simulateDamageReaction(reaction, health, 0, true, fixedDeltaSeconds);
    return { ...base, timelineTotalSteps: 0, emittedEvents: [], offensiveActiveStartStep: null, offensiveActiveEndStep: null, hitboxActiveStartStep: null, hitboxActiveEndStep: null, contactOccurred: false, firstContactStep: null, incomingDamage: damage.incomingDamage, appliedDamage: damage.appliedDamage, remainingHealth: damage.remainingHealth, overkillDamage: damage.overkillDamage, defeated: damage.defeated, reactionType: damage.reactionType, reactionDurationSeconds: damage.reactionDurationSeconds, reactionTotalSteps: damage.reactionTotalSteps, targetActionInterrupted: damage.targetActionInterrupted, finalActionState: "rejected", finalTargetActionState: damage.finalTargetActionState, finalTargetState: damage.finalTargetState };
  }
  const timelineResult = simulateActionTimeline(timeline, fixedDeltaSeconds); const actionResult = simulateOffensiveAction(action, fixedDeltaSeconds); const contact = simulateContact(hitbox, hurtbox, fixedDeltaSeconds);
  const damage = simulateDamageReaction(reaction, health, contact.contactOccurred ? action.damage : 0, true, fixedDeltaSeconds);
  return { ...base, timelineTotalSteps: timelineResult.totalSteps, emittedEvents: timelineResult.emittedEvents, offensiveActiveStartStep: actionResult.activeStartStep, offensiveActiveEndStep: actionResult.activeEndStep, hitboxActiveStartStep: contact.hitboxActiveStartStep, hitboxActiveEndStep: contact.hitboxActiveEndStep, contactOccurred: contact.contactOccurred, firstContactStep: contact.firstContactStep, incomingDamage: damage.incomingDamage, appliedDamage: damage.appliedDamage, remainingHealth: damage.remainingHealth, overkillDamage: damage.overkillDamage, defeated: damage.defeated, reactionType: damage.reactionType, reactionDurationSeconds: damage.reactionDurationSeconds, reactionTotalSteps: damage.reactionTotalSteps, targetActionInterrupted: damage.targetActionInterrupted, finalActionState: "ready", finalTargetActionState: damage.finalTargetActionState, finalTargetState: damage.finalTargetState };
}
