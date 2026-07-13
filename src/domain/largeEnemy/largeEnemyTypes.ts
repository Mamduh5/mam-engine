export interface LargeEnemyTargetPoint { x: number; y: number; z: number }

export interface LargeEnemyBodyPart {
  id: string;
  displayName: string;
  hurtboxFile: string;
  targetPoint: LargeEnemyTargetPoint;
  targetable: boolean;
}

export interface LargeEnemyProfile {
  schemaVersion: 1;
  kind: "large-enemy-profile";
  id: string;
  displayName: string;
  healthFile: string;
  reactionFile: string;
  telegraphName: string;
  idleDurationSeconds: number;
  telegraphDurationSeconds: number;
  attackDurationSeconds: number;
  recoveryDurationSeconds: number;
  bodyParts: LargeEnemyBodyPart[];
}

export type LargeEnemyScenario = "full-cycle" | "primary-part-disabled";

export interface ResolvedLargeEnemyDefinitionPaths {
  healthFile: string;
  reactionFile: string;
  bodyParts: Array<{ id: string; hurtboxFile: string }>;
}

export interface LargeEnemyBehaviorSimulation {
  enemyId: string;
  resolvedDefinitionPaths: ResolvedLargeEnemyDefinitionPaths;
  totalCycleDurationSeconds: number;
  totalSteps: number;
  idleStartStep: number;
  idleEndStep: number;
  telegraphName: string;
  telegraphStartStep: number;
  telegraphEndStep: number;
  attackStartStep: number;
  attackEndStep: number;
  recoveryStartStep: number;
  recoveryCompletionStep: number;
  bodyPartIds: string[];
  targetableBodyPartIds: string[];
  selectedBodyPartId: string;
  finalBehaviorState: "complete";
}
