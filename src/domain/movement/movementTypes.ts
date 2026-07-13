export interface GroundMovementDefinition {
  walkSpeed: number;
  runSpeed: number;
  sprintSpeed: number;
  acceleration: number;
  deceleration: number;
  rotationSpeedDegrees: number;
  orientationMode: "camera_relative";
}

export interface StaminaDefinition {
  maximum: number;
  sprintCostPerSecond: number;
  regenerationPerSecond: number;
  regenerationDelaySeconds: number;
  minimumToStartSprint: number;
}

export interface DodgeDefinition {
  distance: number;
  durationSeconds: number;
  staminaCost: number;
  invulnerabilityStartSeconds: number;
  invulnerabilityEndSeconds: number;
  directionMode: "movement_input";
  steeringMultiplier: number;
}

export interface MovementProfile {
  schemaVersion: 1;
  kind: "movement-profile";
  id: string;
  displayName: string;
  ground: GroundMovementDefinition;
  stamina: StaminaDefinition;
  dodge: DodgeDefinition;
}

export const MOVEMENT_SCENARIOS = ["accelerate", "stop", "sprint", "dodge", "turn"] as const;
export type MovementScenario = (typeof MOVEMENT_SCENARIOS)[number];

export interface MovementDerivedMetrics {
  speedOrdering: {
    valid: boolean;
    walkSpeed: number;
    runSpeed: number;
    sprintSpeed: number;
  };
  estimatedTimeToRunSpeedSeconds: number;
  estimatedStoppingTimeFromRunSpeedSeconds: number;
  sprintDurationFromFullStaminaSeconds: number | null;
  dodgeInvulnerabilityDurationSeconds: number;
  dodgeAverageTravelSpeed: number;
}
