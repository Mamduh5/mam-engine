import type { DefensiveActionProfile } from "../defensiveAction/defensiveActionTypes";
import type { OffensiveActionProfile } from "../offensiveAction/offensiveActionTypes";

export interface StaminaProfile {
  schemaVersion: 1;
  kind: "stamina-profile";
  id: string;
  displayName: string;
  maxStamina: number;
  startingStamina: number;
}

export type StaminaActionProfile = OffensiveActionProfile | DefensiveActionProfile;
export type StaminaState = "available" | "depleted" | "insufficient";

export interface StaminaActionSimulation {
  actionKind: StaminaActionProfile["kind"];
  startingStamina: number;
  requestedStaminaCost: number;
  consumedStamina: number;
  remainingStamina: number;
  sufficientStamina: boolean;
  actionAccepted: boolean;
  finalStaminaState: StaminaState;
}
