import { roundMetric } from "../movement/movementMetrics";
import { validateTargetingContext } from "./targetingValidation";
import type { TargetCandidate, TargetingContext, TargetingProfile, TargetingScenario, TargetingVector3, TargetRejectionCode } from "./targetingTypes";

export const TARGETING_FIXED_DELTA_SECONDS = 1 / 60;
export const TARGETING_SCORE_TIE_EPSILON = 1e-9;
const EPSILON = 1e-12;

export interface TargetEvaluation {
  id: string;
  eligible: boolean;
  rejectionCodes: TargetRejectionCode[];
  distance: number;
  unsignedAngleDegrees: number | null;
  signedHorizontalAngleDegrees: number | null;
  distanceScore: number | null;
  angleScore: number | null;
  priorityScore: number;
  totalScore: number | null;
}
export interface AcquisitionResult { selectedTargetId: string | null; evaluations: TargetEvaluation[]; tieBreakResult: string | null }
export type SwitchDirection = "left" | "right";
export interface SwitchResult { targetId: string | null; switched: boolean; reason: "switched" | "switching_disabled" | "no_current_target" | "cooldown_active" | "no_directional_candidate"; evaluations: TargetEvaluation[] }
export interface RetentionSequenceResult { finalTargetId: string | null; graceStartSeconds: number | null; graceCleared: boolean; releaseTimeSeconds: number | null; reacquiredTargetId: string | null }

export function evaluateCandidate(profile: TargetingProfile, context: TargetingContext, candidate: TargetCandidate, bounds: "acquisition" | "retention" = "acquisition", relativeDirection?: TargetingVector3): TargetEvaluation {
  const delta = subtract(candidate.targetPoint, context.origin); const distance = magnitude(delta); const rejectionCodes: TargetRejectionCode[] = [];
  const maximumDistance = bounds === "retention" ? profile.acquisition.maximumDistance * profile.retention.maximumDistanceMultiplier : profile.acquisition.maximumDistance;
  const maximumAngle = bounds === "retention" ? profile.acquisition.maximumAngleDegrees + profile.retention.additionalAngleDegrees : profile.acquisition.maximumAngleDegrees;
  if (!candidate.targetable) rejectionCodes.push("TARGET_NOT_TARGETABLE");
  if (distance > maximumDistance) rejectionCodes.push("TARGET_OUT_OF_DISTANCE");
  let unsignedAngleDegrees: number | null = null;
  if (distance <= EPSILON) rejectionCodes.push("TARGET_DIRECTION_UNDEFINED");
  else {
    unsignedAngleDegrees = unsignedAngle(context.viewForward, delta);
    if (unsignedAngleDegrees > maximumAngle) rejectionCodes.push("TARGET_OUT_OF_ANGLE");
  }
  if (profile.acquisition.requireLineOfSight && !candidate.lineOfSight) rejectionCodes.push("TARGET_LINE_OF_SIGHT_BLOCKED");
  const eligible = rejectionCodes.length === 0;
  const distanceScore = eligible ? clamp(1 - distance / profile.acquisition.maximumDistance, 0, 1) : null;
  const angleScore = eligible && unsignedAngleDegrees !== null ? clamp(1 - unsignedAngleDegrees / profile.acquisition.maximumAngleDegrees, 0, 1) : null;
  const totalScore = distanceScore !== null && angleScore !== null ? distanceScore * profile.scoring.distanceWeight + angleScore * profile.scoring.angleWeight + candidate.priority * profile.scoring.priorityWeight : null;
  return { id: candidate.id, eligible, rejectionCodes, distance, unsignedAngleDegrees, signedHorizontalAngleDegrees: relativeDirection ? signedHorizontalAngle(relativeDirection, delta) : signedHorizontalAngle(context.viewForward, delta), distanceScore, angleScore, priorityScore: candidate.priority, totalScore };
}

export function acquireTarget(profile: TargetingProfile, context: TargetingContext): AcquisitionResult {
  assertContext(context); const evaluations = context.candidates.map((candidate) => evaluateCandidate(profile, context, candidate)); const eligible = evaluations.filter((item) => item.eligible);
  eligible.sort((left, right) => {
    const scoreDifference = Number(right.totalScore) - Number(left.totalScore); if (Math.abs(scoreDifference) > TARGETING_SCORE_TIE_EPSILON) return scoreDifference;
    const angleDifference = Number(left.unsignedAngleDegrees) - Number(right.unsignedAngleDegrees); if (Math.abs(angleDifference) > TARGETING_SCORE_TIE_EPSILON) return angleDifference;
    const distanceDifference = left.distance - right.distance; if (Math.abs(distanceDifference) > TARGETING_SCORE_TIE_EPSILON) return distanceDifference;
    return ordinalCompare(left.id, right.id);
  });
  const tieBreakResult = eligible.length >= 2 ? describeTieBreak(eligible[0] as TargetEvaluation, eligible[1] as TargetEvaluation) : null;
  return { selectedTargetId: eligible[0]?.id ?? null, evaluations, tieBreakResult };
}

export function switchTarget(profile: TargetingProfile, context: TargetingContext, direction: SwitchDirection, cooldownRemainingSeconds = 0): SwitchResult {
  assertContext(context);
  if (!profile.switching.enabled) return { targetId: context.currentTargetId, switched: false, reason: "switching_disabled", evaluations: [] };
  if (context.currentTargetId === null) return { targetId: null, switched: false, reason: "no_current_target", evaluations: [] };
  if (cooldownRemainingSeconds > EPSILON) return { targetId: context.currentTargetId, switched: false, reason: "cooldown_active", evaluations: [] };
  const current = context.candidates.find((candidate) => candidate.id === context.currentTargetId);
  if (!current) return { targetId: context.currentTargetId, switched: false, reason: "no_current_target", evaluations: [] };
  const currentDirection = subtract(current.targetPoint, context.origin);
  const evaluations = context.candidates.filter((candidate) => candidate.id !== current.id).map((candidate) => evaluateCandidate(profile, context, candidate, "acquisition", currentDirection));
  const valid = evaluations.filter((item) => item.eligible && item.signedHorizontalAngleDegrees !== null && (direction === "left" ? item.signedHorizontalAngleDegrees > 0 && item.signedHorizontalAngleDegrees >= profile.switching.minimumSeparationDegrees && item.signedHorizontalAngleDegrees <= profile.switching.maximumAngleDegrees : item.signedHorizontalAngleDegrees < 0 && item.signedHorizontalAngleDegrees <= -profile.switching.minimumSeparationDegrees && Math.abs(item.signedHorizontalAngleDegrees) <= profile.switching.maximumAngleDegrees));
  valid.sort((left, right) => {
    const directional = direction === "left" ? Number(left.signedHorizontalAngleDegrees) - Number(right.signedHorizontalAngleDegrees) : Number(right.signedHorizontalAngleDegrees) - Number(left.signedHorizontalAngleDegrees);
    if (Math.abs(directional) > TARGETING_SCORE_TIE_EPSILON) return directional;
    const score = Number(right.totalScore) - Number(left.totalScore); if (Math.abs(score) > TARGETING_SCORE_TIE_EPSILON) return score;
    const distance = left.distance - right.distance; if (Math.abs(distance) > TARGETING_SCORE_TIE_EPSILON) return distance;
    return ordinalCompare(left.id, right.id);
  });
  const selected = valid[0]; return selected ? { targetId: selected.id, switched: true, reason: "switched", evaluations } : { targetId: context.currentTargetId, switched: false, reason: "no_directional_candidate", evaluations };
}

export function runRetentionSequence(profile: TargetingProfile, contexts: TargetingContext[], fixedDelta = TARGETING_FIXED_DELTA_SECONDS): RetentionSequenceResult {
  let targetId = contexts[0]?.currentTargetId ?? null; let invalidElapsed = 0; let graceStart: number | null = null; let graceCleared = false; let releaseTime: number | null = null; let reacquiredTargetId: string | null = null;
  contexts.forEach((context, index) => {
    if (targetId === null || releaseTime !== null) return; assertContext(context); const current = context.candidates.find((candidate) => candidate.id === targetId); const valid = current ? evaluateCandidate(profile, context, current, "retention").eligible : false;
    if (valid) { if (graceStart !== null) graceCleared = true; invalidElapsed = 0; graceStart = null; return; }
    if (graceStart === null) graceStart = (index + 1) * fixedDelta; invalidElapsed += fixedDelta;
    if (profile.retention.lostTargetGraceSeconds === 0 || invalidElapsed + EPSILON >= profile.retention.lostTargetGraceSeconds) { releaseTime = (index + 1) * fixedDelta; targetId = null; if (profile.retention.autoReacquire) { reacquiredTargetId = acquireTarget(profile, { ...context, currentTargetId: null }).selectedTargetId; targetId = reacquiredTargetId; } }
  });
  return { finalTargetId: targetId, graceStartSeconds: graceStart, graceCleared, releaseTimeSeconds: releaseTime, reacquiredTargetId };
}

export function simulateTargeting(profile: TargetingProfile, scenario: TargetingScenario, seconds?: number, fixedDelta = TARGETING_FIXED_DELTA_SECONDS): { scenario: TargetingScenario; metrics: Record<string, unknown> } {
  if (!Number.isFinite(fixedDelta) || fixedDelta <= 0) throw new Error("fixedDelta must be finite and greater than zero");
  const duration = seconds ?? defaultDuration(profile, scenario, fixedDelta); const steps = Math.max(1, Math.ceil(duration / fixedDelta - EPSILON));
  switch (scenario) {
    case "acquire": return result(scenario, acquisitionScenario(profile, steps, fixedDelta));
    case "eligibility": return result(scenario, eligibilityScenario(profile, steps, fixedDelta));
    case "tie-break": return result(scenario, tieBreakScenario(profile, steps, fixedDelta));
    case "retention": return result(scenario, retentionScenario(profile, steps, fixedDelta));
    case "loss": return result(scenario, lossScenario(profile, steps, fixedDelta, false));
    case "reacquire": return result(scenario, lossScenario(profile, steps, fixedDelta, true));
    case "switch-left": return result(scenario, switchScenario(profile, steps, fixedDelta, "left"));
    case "switch-right": return result(scenario, switchScenario(profile, steps, fixedDelta, "right"));
    case "switch-cooldown": return result(scenario, cooldownScenario(profile, steps, fixedDelta));
  }
}

function acquisitionScenario(profile: TargetingProfile, steps: number, delta: number): Record<string, unknown> { const context = baseContext([candidate("near", 0, 10, 0.2), candidate("angled", 30, 12, 0.9), candidate("far", 0, 25, 1)]); return acquisitionMetrics(acquireTarget(profile, context), steps, delta); }
function eligibilityScenario(profile: TargetingProfile, steps: number, delta: number): Record<string, unknown> { const blocked = candidate("blocked", 0, 10, 0.5); blocked.lineOfSight = false; const untargetable = candidate("untargetable", 0, 10, 0.5); untargetable.targetable = false; const context = baseContext([candidate("eligible", 0, 10, 0.5), candidate("too-far", 0, profile.acquisition.maximumDistance + 1, 0.5), candidate("too-wide", Math.min(179, profile.acquisition.maximumAngleDegrees + 10), 10, 0.5), blocked, untargetable, { ...candidate("overlap", 0, 1, 0.5), targetPoint: { x: 0, y: 0, z: 0 } }]); return acquisitionMetrics(acquireTarget(profile, context), steps, delta); }
function tieBreakScenario(profile: TargetingProfile, steps: number, delta: number): Record<string, unknown> { const context = baseContext([candidate("zeta", 10, 12, 0.5), candidate("alpha", 10, 12, 0.5)]); return acquisitionMetrics(acquireTarget(profile, context), steps, delta); }
function retentionScenario(profile: TargetingProfile, steps: number, delta: number): Record<string, unknown> { const distance = profile.acquisition.maximumDistance * Math.min(profile.retention.maximumDistanceMultiplier, 1.1); const target = candidate("current", Math.min(profile.acquisition.maximumAngleDegrees + profile.retention.additionalAngleDegrees / 2, 179), distance, 0.5); const context = { ...baseContext([target]), currentTargetId: target.id }; const evaluation = evaluateCandidate(profile, context, target, "retention"); return { initialTargetId: target.id, finalTargetId: evaluation.eligible ? target.id : null, lockState: evaluation.eligible ? "retained" : "released", evaluation, graceStartSeconds: null, graceExpirySeconds: null, releaseTimeSeconds: null, physicsSteps: steps, fixedDeltaSeconds: delta }; }
function lossScenario(profile: TargetingProfile, steps: number, delta: number, reacquire: boolean): Record<string, unknown> { const current = candidate("current", 0, 10, 0.5); current.lineOfSight = false; const alternative = candidate("replacement", 10, 8, 0.7); const candidates = reacquire ? [current, alternative] : [current]; const context = { ...baseContext(candidates), currentTargetId: current.id }; let targetId: string | null = current.id; let invalidElapsed = 0; let graceStart: number | null = null; let expiry: number | null = null; let release: number | null = null; let reacquired: string | null = null;
  for (let step = 1; step <= steps; step += 1) { if (targetId !== current.id) continue; const valid = evaluateCandidate(profile, context, current, "retention").eligible; if (valid) { invalidElapsed = 0; graceStart = null; continue; } if (graceStart === null) graceStart = step * delta; invalidElapsed += delta; if (profile.retention.lostTargetGraceSeconds === 0 || invalidElapsed + EPSILON >= profile.retention.lostTargetGraceSeconds) { expiry = step * delta; release = step * delta; targetId = null; if (profile.retention.autoReacquire) { reacquired = acquireTarget(profile, { ...context, currentTargetId: null }).selectedTargetId; targetId = reacquired; } } }
  return { initialTargetId: current.id, finalTargetId: targetId, lockState: targetId === null ? "unlocked" : targetId === current.id ? "grace" : "reacquired", graceStartSeconds: graceStart, graceExpirySeconds: expiry, releaseTimeSeconds: release, reacquiredTargetId: reacquired, autoReacquire: profile.retention.autoReacquire, alternativeCandidateProvided: reacquire, physicsSteps: steps, fixedDeltaSeconds: delta }; }
function switchScenario(profile: TargetingProfile, steps: number, delta: number, direction: SwitchDirection): Record<string, unknown> { const current = candidate("current", 0, 10, 0.5); const context = { ...baseContext([current, candidate("left-near", 20, 10, 0.5), candidate("left-far", 50, 10, 1), candidate("right-near", -20, 10, 0.5), candidate("right-far", -50, 10, 1)]), currentTargetId: current.id }; const switched = switchTarget(profile, context, direction); return { initialTargetId: current.id, finalTargetId: switched.targetId, requestedSwitchDirection: direction, switchingOccurred: switched.switched, switchReason: switched.reason, cooldownActive: false, evaluations: switched.evaluations, physicsSteps: steps, fixedDeltaSeconds: delta }; }
function cooldownScenario(profile: TargetingProfile, steps: number, delta: number): Record<string, unknown> { const current = candidate("current", 0, 10, 0.5); const next = candidate("left", 20, 10, 0.5); const context = { ...baseContext([current, next]), currentTargetId: current.id }; let cooldown = profile.switching.cooldownSeconds; const initial = switchTarget(profile, context, "left", cooldown); let elapsed = 0; let final = initial; let successTime: number | null = null; for (let step = 1; step <= steps; step += 1) { elapsed += delta; cooldown = Math.max(0, profile.switching.cooldownSeconds - elapsed); final = switchTarget(profile, context, "left", cooldown); if (final.switched) { successTime = step * delta; break; } } return { initialTargetId: current.id, finalTargetId: final.targetId, requestedSwitchDirection: "left", initialCooldownRejected: initial.reason === "cooldown_active", switchingOccurred: final.switched, switchReason: final.reason, cooldownActive: !final.switched, switchAvailableTimeSeconds: successTime, physicsSteps: steps, fixedDeltaSeconds: delta }; }

function acquisitionMetrics(acquisition: AcquisitionResult, steps: number, delta: number): Record<string, unknown> { return { selectedTargetId: acquisition.selectedTargetId, eligibleCandidateIds: acquisition.evaluations.filter((item) => item.eligible).map((item) => item.id).sort(ordinalCompare), rejectedCandidates: acquisition.evaluations.filter((item) => !item.eligible).map((item) => ({ id: item.id, rejectionCodes: item.rejectionCodes })), evaluations: acquisition.evaluations, tieBreakResult: acquisition.tieBreakResult, lockState: acquisition.selectedTargetId ? "locked" : "unlocked", physicsSteps: steps, fixedDeltaSeconds: delta }; }
function baseContext(candidates: TargetCandidate[]): TargetingContext { return { origin: { x: 0, y: 0, z: 0 }, viewForward: { x: 0, y: 0, z: -1 }, candidates, currentTargetId: null }; }
function candidate(id: string, yawDegrees: number, distance: number, priority: number): TargetCandidate { const radians = yawDegrees * Math.PI / 180; return { id, targetPoint: { x: -Math.sin(radians) * distance, y: 0, z: -Math.cos(radians) * distance }, targetable: true, lineOfSight: true, priority }; }
function defaultDuration(profile: TargetingProfile, scenario: TargetingScenario, delta: number): number { if (scenario === "loss" || scenario === "reacquire") return Math.max(delta, profile.retention.lostTargetGraceSeconds + delta); if (scenario === "switch-cooldown") return Math.max(delta, profile.switching.cooldownSeconds + delta); return delta; }
function result(scenario: TargetingScenario, metrics: Record<string, unknown>) { return { scenario, metrics: deepRound(metrics) as Record<string, unknown> }; }
function assertContext(context: TargetingContext): void { const errors = validateTargetingContext(context); if (errors.length > 0) throw new Error(`Invalid targeting context: ${errors.map((item) => item.path).join(", ")}`); }
function unsignedAngle(left: TargetingVector3, right: TargetingVector3): number { return Math.acos(clamp(dot(left, right) / (magnitude(left) * magnitude(right)), -1, 1)) * 180 / Math.PI; }
function signedHorizontalAngle(from: TargetingVector3, to: TargetingVector3): number | null { const fromLength = Math.hypot(from.x, from.z); const toLength = Math.hypot(to.x, to.z); if (fromLength <= EPSILON || toLength <= EPSILON) return null; const fromYaw = Math.atan2(-from.x, -from.z) * 180 / Math.PI; const toYaw = Math.atan2(-to.x, -to.z) * 180 / Math.PI; return normalizeAngle(toYaw - fromYaw); }
function normalizeAngle(value: number): number { return ((value + 180) % 360 + 360) % 360 - 180; }
function subtract(left: TargetingVector3, right: TargetingVector3): TargetingVector3 { return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z }; }
function magnitude(value: TargetingVector3): number { return Math.hypot(value.x, value.y, value.z); }
function dot(left: TargetingVector3, right: TargetingVector3): number { return left.x * right.x + left.y * right.y + left.z * right.z; }
function clamp(value: number, minimum: number, maximum: number): number { return Math.min(maximum, Math.max(minimum, value)); }
function ordinalCompare(left: string, right: string): number { return left < right ? -1 : left > right ? 1 : 0; }
function describeTieBreak(left: TargetEvaluation, right: TargetEvaluation): string | null { if (Math.abs(Number(left.totalScore) - Number(right.totalScore)) > TARGETING_SCORE_TIE_EPSILON) return null; if (Math.abs(Number(left.unsignedAngleDegrees) - Number(right.unsignedAngleDegrees)) > TARGETING_SCORE_TIE_EPSILON) return "smaller_unsigned_angle"; if (Math.abs(left.distance - right.distance) > TARGETING_SCORE_TIE_EPSILON) return "smaller_distance"; return "ordinal_target_id"; }
function deepRound(value: unknown): unknown { if (typeof value === "number") return roundMetric(value); if (Array.isArray(value)) return value.map(deepRound); if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, deepRound(item)])); return value; }
