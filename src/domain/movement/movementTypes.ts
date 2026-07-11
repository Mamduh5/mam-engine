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

export type MovementScenario = "accelerate" | "stop" | "sprint" | "dodge" | "turn";

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
