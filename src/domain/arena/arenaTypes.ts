export interface ArenaPoint { x: number; y: number; z: number }

export interface ArenaProfile {
  schemaVersion: 1;
  kind: "arena-profile";
  id: string;
  displayName: string;
  radius: number;
  playerSpawn: ArenaPoint;
  enemySpawn: ArenaPoint;
}
