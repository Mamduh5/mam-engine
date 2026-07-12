export interface OffensiveActionProfile {
  schemaVersion: 1;
  kind: "offensive-action-profile";
  id: string;
  displayName: string;
  durationSeconds: number;
  staminaCost: number;
  movementDistance: number;
  damage: number;
  activeStartSeconds: number;
  activeEndSeconds: number;
  cooldownSeconds: number;
}

export type OffensiveActionState = "active" | "cooldown" | "ready";

export interface OffensiveActionSimulation {
  fixedDeltaSeconds: number;
  totalSteps: number;
  distanceTravelled: number;
  staminaConsumed: number;
  damageValue: number;
  activeStartStep: number;
  activeEndStep: number;
  cooldownCompletionStep: number;
  finalActionState: OffensiveActionState;
}
