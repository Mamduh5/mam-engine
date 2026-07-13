import { readFileSync } from "node:fs";
import path from "node:path";

function packageRoot(): string {
  return path.resolve(__dirname, "../../../..");
}

export function loadMovementV1Schema(): object {
  const schemaPath = path.join(packageRoot(), "schemas", "movement", "v1.schema.json");
  return JSON.parse(readFileSync(schemaPath, "utf8")) as object;
}

export function loadCameraV1Schema(): object {
  const schemaPath = path.join(packageRoot(), "schemas", "camera", "v1.schema.json");
  return JSON.parse(readFileSync(schemaPath, "utf8")) as object;
}

export function loadTargetingV1Schema(): object {
  const schemaPath = path.join(packageRoot(), "schemas", "targeting", "v1.schema.json");
  return JSON.parse(readFileSync(schemaPath, "utf8")) as object;
}

export function loadDefensiveActionV1Schema(): object {
  const schemaPath = path.join(packageRoot(), "schemas", "defensive-action", "v1.schema.json");
  return JSON.parse(readFileSync(schemaPath, "utf8")) as object;
}

export function loadOffensiveActionV1Schema(): object {
  const schemaPath = path.join(packageRoot(), "schemas", "offensive-action", "v1.schema.json");
  return JSON.parse(readFileSync(schemaPath, "utf8")) as object;
}

export function loadHealthV1Schema(): object {
  const schemaPath = path.join(packageRoot(), "schemas", "health", "v1.schema.json");
  return JSON.parse(readFileSync(schemaPath, "utf8")) as object;
}

export function loadStaminaV1Schema(): object {
  const schemaPath = path.join(packageRoot(), "schemas", "stamina", "v1.schema.json");
  return JSON.parse(readFileSync(schemaPath, "utf8")) as object;
}

export function loadActionTimelineV1Schema(): object {
  const schemaPath = path.join(packageRoot(), "schemas", "action-timeline", "v1.schema.json");
  return JSON.parse(readFileSync(schemaPath, "utf8")) as object;
}

export function loadContactVolumeV1Schema(): object {
  const schemaPath = path.join(packageRoot(), "schemas", "contact-volume", "v1.schema.json");
  return JSON.parse(readFileSync(schemaPath, "utf8")) as object;
}

export function loadDamageReactionV1Schema(): object {
  const schemaPath = path.join(packageRoot(), "schemas", "damage-reaction", "v1.schema.json");
  return JSON.parse(readFileSync(schemaPath, "utf8")) as object;
}

export function loadWeaponV1Schema(): object {
  const schemaPath = path.join(packageRoot(), "schemas", "weapon", "v1.schema.json");
  return JSON.parse(readFileSync(schemaPath, "utf8")) as object;
}

export function loadLargeEnemyV1Schema(): object {
  const schemaPath = path.join(packageRoot(), "schemas", "large-enemy", "v1.schema.json");
  return JSON.parse(readFileSync(schemaPath, "utf8")) as object;
}

export function loadHunterV1Schema(): object {
  const schemaPath = path.join(packageRoot(), "schemas", "hunter", "v1.schema.json");
  return JSON.parse(readFileSync(schemaPath, "utf8")) as object;
}

export function loadArenaV1Schema(): object {
  const schemaPath = path.join(packageRoot(), "schemas", "arena", "v1.schema.json");
  return JSON.parse(readFileSync(schemaPath, "utf8")) as object;
}
