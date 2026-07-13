export interface DamageReactionProfile {
  schemaVersion: 1;
  kind: "damage-reaction-profile";
  id: string;
  displayName: string;
  staggerThreshold: number;
  hitReactionDurationSeconds: number;
  staggerDurationSeconds: number;
}

export type DamageReactionType = "none" | "hit" | "stagger" | "defeat";
export type FinalTargetActionState = "inactive" | "continuing" | "interrupted";

export interface DamageReactionSimulation {
  startingHealth: number;
  incomingDamage: number;
  appliedDamage: number;
  remainingHealth: number;
  defeated: boolean;
  staggerThreshold: number;
  staggered: boolean;
  reactionType: DamageReactionType;
  reactionDurationSeconds: number;
  reactionTotalSteps: number;
  targetActionWasActive: boolean;
  targetActionInterrupted: boolean;
  finalTargetActionState: FinalTargetActionState;
  finalTargetState: "alive" | "defeated";
}
