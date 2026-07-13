export interface ActionTimelineEvent {
  id: string;
  timeSeconds: number;
  name: string;
}

export interface ActionTimelineProfile {
  schemaVersion: 1;
  kind: "action-timeline-profile";
  id: string;
  displayName: string;
  durationSeconds: number;
  animationName: string;
  events: ActionTimelineEvent[];
}

export interface EmittedActionTimelineEvent {
  id: string;
  name: string;
  authoredTimeSeconds: number;
  emittedStep: number;
}

export interface ActionTimelineSimulation {
  fixedDeltaSeconds: number;
  durationSeconds: number;
  animationName: string;
  totalSteps: number;
  authoredEventCount: number;
  emittedEvents: EmittedActionTimelineEvent[];
  completionStep: number;
  finalActionState: "complete";
}
