export interface HunterProfile {
  schemaVersion: 1;
  kind: "hunter-profile";
  id: string;
  displayName: string;
  healthFile: string;
  staminaFile: string;
}

export interface ResolvedHunterDefinitionPaths { healthFile: string; staminaFile: string }
