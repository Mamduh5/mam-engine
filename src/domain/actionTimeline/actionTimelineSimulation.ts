import { roundMetric } from "../movement/movementMetrics";
import type { ActionTimelineProfile, ActionTimelineSimulation } from "./actionTimelineTypes";

export const ACTION_TIMELINE_FIXED_DELTA_SECONDS = 1 / 60;
const EPSILON = 1e-12;

export function simulateActionTimeline(profile: ActionTimelineProfile, fixedDeltaSeconds = ACTION_TIMELINE_FIXED_DELTA_SECONDS): ActionTimelineSimulation {
  if (!Number.isFinite(fixedDeltaSeconds) || fixedDeltaSeconds <= 0) throw new Error("fixedDeltaSeconds must be finite and greater than 0");
  const totalSteps = completionStep(profile.durationSeconds, fixedDeltaSeconds);
  const emittedEvents = profile.events
    .map((event, declarationOrder) => ({ event, declarationOrder }))
    .sort((left, right) => left.event.timeSeconds - right.event.timeSeconds || left.declarationOrder - right.declarationOrder)
    .map(({ event }) => ({ id: event.id, name: event.name, authoredTimeSeconds: roundMetric(event.timeSeconds), emittedStep: Math.max(1, completionStep(event.timeSeconds, fixedDeltaSeconds)) }));
  return { fixedDeltaSeconds: roundMetric(fixedDeltaSeconds), durationSeconds: roundMetric(profile.durationSeconds), animationName: profile.animationName, totalSteps, authoredEventCount: profile.events.length, emittedEvents, completionStep: totalSteps, finalActionState: "complete" };
}

function completionStep(seconds: number, delta: number): number { return Math.max(1, Math.ceil(seconds / delta - EPSILON)); }
