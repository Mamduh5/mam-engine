import { roundMetric } from "../../domain/movement/movementMetrics";
import { simulateMovement, type SimulationResult } from "../../domain/movement/movementSimulation";
import { MOVEMENT_SCENARIOS, type MovementScenario } from "../../domain/movement/movementTypes";
import type { MovementProfile } from "../../domain/movement/movementTypes";
import { simulateMovementFile } from "../movement/simulateMovement";
import { setMovementValue } from "../movement/setMovementValue";
import { assertEditorRevision, assertMovementEditableValue, EditorEditError, getMovementEditModel, type MovementEditModel } from "./movementEditor";

const scenariosWithCustomSeconds = new Set<MovementScenario>(["accelerate", "stop", "sprint"]);
const scenarios = new Set<string>(MOVEMENT_SCENARIOS);

export interface MovementSimulationScenarioOption { id: MovementScenario; acceptsCustomSeconds: boolean }
export interface MovementSimulationModel {
  relativePath: string;
  kind: "movement-profile";
  id: string;
  displayName: string;
  currentRevision: string;
  availableScenarios: MovementSimulationScenarioOption[];
}
export interface MovementMetricComparison { metric: string; persisted: unknown; candidate: unknown; delta: number | null; changed: boolean }

export async function getMovementSimulationModel(workspaceRoot: string, inputFile: string): Promise<MovementSimulationModel> {
  return simulationModelFrom(await getMovementEditModel(workspaceRoot, inputFile));
}

function simulationModelFrom(editModel: MovementEditModel): MovementSimulationModel {
  return {
    relativePath: editModel.relativePath,
    kind: "movement-profile",
    id: editModel.id,
    displayName: editModel.displayName,
    currentRevision: editModel.revision,
    availableScenarios: MOVEMENT_SCENARIOS.map((id) => ({ id, acceptsCustomSeconds: scenariosWithCustomSeconds.has(id) }))
  };
}

export async function runMovementEditorSimulation(workspaceRoot: string, body: unknown): Promise<Record<string, unknown>> {
  const request = parseRunRequest(body);
  const editModel = await getMovementEditModel(workspaceRoot, request.file);
  const model = simulationModelFrom(editModel);
  assertEditorRevision(model.currentRevision, request.expectedRevision);
  const scenario = validateScenario(request.scenario);
  const seconds = validateSeconds(scenario, request.seconds, request.secondsProvided);
  const persistedResult = await simulateMovementFile(workspaceRoot, model.relativePath, scenario, seconds);
  if (persistedResult.status !== "passed" || !isSimulationResult(persistedResult.data)) throw new EditorEditError("EDITOR_SIMULATION_FAILED", "Persisted movement simulation failed", 422, persistedResult.errors);
  const persistedSimulation = persistedResult.data;
  const base = { relativePath: model.relativePath, sourceRevision: model.currentRevision, scenario, requestedSeconds: seconds ?? null, persistedSimulation };
  if (request.candidate === undefined) return { ...base, candidatePropertyPath: null, candidateValue: null, candidateSimulation: null, validationFindings: [], metricComparison: [] };

  assertMovementEditableValue(editModel, request.candidate.path, request.candidate.value);
  const candidateResult = await setMovementValue(workspaceRoot, model.relativePath, request.candidate.path, request.candidate.value, true);
  const candidateBase = { ...base, candidatePropertyPath: request.candidate.path, candidateValue: request.candidate.value };
  if (candidateResult.status !== "dry_run") return { ...candidateBase, candidateSimulation: null, validationFindings: candidateResult.errors, metricComparison: [] };
  const candidateProfile = candidateProfileFrom(candidateResult.data);
  if (candidateProfile === null) throw new EditorEditError("EDITOR_SIMULATION_FAILED", "Validated movement candidate was unavailable", 500);
  const candidateSimulation = simulateMovement(candidateProfile, scenario, seconds);
  return { ...candidateBase, candidateSimulation, validationFindings: [], metricComparison: compareMovementMetrics(persistedSimulation.metrics, candidateSimulation.metrics) };
}

export function compareMovementMetrics(persisted: Record<string, unknown>, candidate: Record<string, unknown>): MovementMetricComparison[] {
  return [...new Set([...Object.keys(persisted), ...Object.keys(candidate)])].sort().map((metric) => {
    const savedValue = persisted[metric];
    const candidateValue = candidate[metric];
    const bothFinite = typeof savedValue === "number" && Number.isFinite(savedValue) && typeof candidateValue === "number" && Number.isFinite(candidateValue);
    return { metric, persisted: savedValue ?? null, candidate: candidateValue ?? null, delta: bothFinite ? roundMetric(candidateValue - savedValue) : null, changed: !Object.is(savedValue, candidateValue) };
  });
}

interface ParsedRunRequest { file: string; expectedRevision: string; scenario: unknown; seconds?: unknown; secondsProvided: boolean; candidate?: { path: string; value: unknown } }
function parseRunRequest(value: unknown): ParsedRunRequest {
  if (!isRecord(value) || typeof value.file !== "string" || typeof value.expectedRevision !== "string" || !("scenario" in value)) throw new EditorEditError("EDITOR_REQUEST_INVALID", "Simulation request must include file, expectedRevision, and scenario", 400);
  let candidate: ParsedRunRequest["candidate"];
  if ("candidate" in value) {
    if (!isRecord(value.candidate) || typeof value.candidate.path !== "string" || !("value" in value.candidate)) throw new EditorEditError("EDITOR_REQUEST_INVALID", "Simulation candidate must include path and value", 400);
    candidate = { path: value.candidate.path, value: value.candidate.value };
  }
  return { file: value.file, expectedRevision: value.expectedRevision, scenario: value.scenario, ...(candidate === undefined ? {} : { candidate }), ...(value.seconds === undefined ? {} : { seconds: value.seconds }), secondsProvided: "seconds" in value };
}

function validateScenario(value: unknown): MovementScenario {
  if (typeof value !== "string" || !scenarios.has(value)) throw new EditorEditError("EDITOR_SIMULATION_SCENARIO_INVALID", "Scenario must be accelerate, stop, sprint, dodge, or turn", 400);
  return value as MovementScenario;
}

function validateSeconds(scenario: MovementScenario, value: unknown, provided: boolean): number | undefined {
  if (!provided) return undefined;
  if (!scenariosWithCustomSeconds.has(scenario)) throw new EditorEditError("EDITOR_SIMULATION_SECONDS_UNSUPPORTED", `Scenario '${scenario}' does not accept custom seconds`, 400);
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 60) throw new EditorEditError("EDITOR_SIMULATION_SECONDS_INVALID", "Seconds must be a finite number greater than 0 and at most 60", 400);
  return value;
}

function candidateProfileFrom(value: unknown): MovementProfile | null { if (!isRecord(value) || !isRecord(value.profile) || value.profile.kind !== "movement-profile") return null; return value.profile as unknown as MovementProfile; }
function isSimulationResult(value: unknown): value is SimulationResult { return isRecord(value) && typeof value.scenario === "string" && isRecord(value.metrics); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
