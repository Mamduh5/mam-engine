export interface DefensiveActionProfile {
  schemaVersion: 1;
  kind: "defensive-action-profile";
  id: string;
  displayName: string;
  durationSeconds: number;
  staminaCost: number;
  movementDistance: number;
  invulnerabilityStartSeconds: number;
  invulnerabilityEndSeconds: number;
  cooldownSeconds: number;
}

export type DefensiveActionState = "active" | "cooldown" | "ready";

export interface DefensiveActionSimulation {
  fixedDeltaSeconds: number;
  totalSteps: number;
  distanceTravelled: number;
  staminaConsumed: number;
  invulnerabilityStartStep: number;
  invulnerabilityEndStep: number;
  cooldownCompletionStep: number;
  finalActionState: DefensiveActionState;
}
