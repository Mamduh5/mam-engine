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
