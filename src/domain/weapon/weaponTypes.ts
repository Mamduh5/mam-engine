import type { EmittedActionTimelineEvent } from "../actionTimeline/actionTimelineTypes";
import type { StaminaState } from "../stamina/staminaTypes";
import type { DamageReactionType, FinalTargetActionState } from "../damageReaction/damageReactionTypes";

export interface WeaponProfile {
  schemaVersion: 1;
  kind: "weapon-profile";
  id: string;
  displayName: string;
  offensiveActionFile: string;
  actionTimelineFile: string;
  hitboxFile: string;
  hitboxEnableEventId: string;
  hitboxDisableEventId: string;
}

export interface ResolvedWeaponDefinitionPaths {
  offensiveActionFile: string;
  actionTimelineFile: string;
  hitboxFile: string;
}

export interface WeaponStrikeSimulation {
  weaponId: string;
  resolvedDefinitionPaths: ResolvedWeaponDefinitionPaths;
  actionAccepted: boolean;
  sufficientStamina: boolean;
  startingStamina: number;
  requestedStaminaCost: number;
  consumedStamina: number;
  remainingStamina: number;
  finalStaminaState: StaminaState;
  timelineTotalSteps: number;
  emittedEvents: EmittedActionTimelineEvent[];
  offensiveActiveStartStep: number | null;
  offensiveActiveEndStep: number | null;
  hitboxActiveStartStep: number | null;
  hitboxActiveEndStep: number | null;
  contactOccurred: boolean;
  firstContactStep: number | null;
  incomingDamage: number;
  appliedDamage: number;
  remainingHealth: number;
  overkillDamage: number;
  defeated: boolean;
  reactionType: DamageReactionType;
  reactionDurationSeconds: number;
  reactionTotalSteps: number;
  targetActionInterrupted: boolean;
  finalActionState: "rejected" | "ready";
  finalTargetActionState: FinalTargetActionState;
  finalTargetState: "alive" | "defeated";
}
