export interface HealthProfile {
  schemaVersion: 1;
  kind: "health-profile";
  id: string;
  displayName: string;
  maxHealth: number;
  startingHealth: number;
}

export type TargetState = "alive" | "defeated";

export interface HitSimulation {
  startingHealth: number;
  incomingDamage: number;
  appliedDamage: number;
  remainingHealth: number;
  overkillDamage: number;
  defeated: boolean;
  finalTargetState: TargetState;
}
