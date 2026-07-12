export interface TargetingProfile {
  schemaVersion: 1;
  kind: "targeting-profile";
  id: string;
  displayName: string;
  acquisition: { maximumDistance: number; maximumAngleDegrees: number; requireLineOfSight: boolean };
  scoring: { distanceWeight: number; angleWeight: number; priorityWeight: number };
  retention: { maximumDistanceMultiplier: number; additionalAngleDegrees: number; lostTargetGraceSeconds: number; autoReacquire: boolean };
  switching: { enabled: boolean; cooldownSeconds: number; maximumAngleDegrees: number; minimumSeparationDegrees: number };
}
export interface TargetingVector3 { x: number; y: number; z: number }
export interface TargetCandidate { id: string; targetPoint: TargetingVector3; targetable: boolean; lineOfSight: boolean; priority: number }
export interface TargetingContext { origin: TargetingVector3; viewForward: TargetingVector3; candidates: TargetCandidate[]; currentTargetId: string | null }
export type TargetingScenario = "acquire" | "eligibility" | "tie-break" | "retention" | "loss" | "reacquire" | "switch-left" | "switch-right" | "switch-cooldown";
export type TargetRejectionCode = "TARGET_NOT_TARGETABLE" | "TARGET_OUT_OF_DISTANCE" | "TARGET_OUT_OF_ANGLE" | "TARGET_LINE_OF_SIGHT_BLOCKED" | "TARGET_DIRECTION_UNDEFINED";
