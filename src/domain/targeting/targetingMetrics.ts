import { roundMetric } from "../movement/movementMetrics";
import type { TargetingProfile } from "./targetingTypes";

export function deriveTargetingMetrics(profile: TargetingProfile) {
  return {
    scoringWeightSum: roundMetric(profile.scoring.distanceWeight + profile.scoring.angleWeight + profile.scoring.priorityWeight),
    retentionMaximumDistance: roundMetric(profile.acquisition.maximumDistance * profile.retention.maximumDistanceMultiplier),
    retentionMaximumAngleDegrees: roundMetric(profile.acquisition.maximumAngleDegrees + profile.retention.additionalAngleDegrees),
    lineOfSightRequired: profile.acquisition.requireLineOfSight,
    automaticReacquisitionEnabled: profile.retention.autoReacquire,
    switchingAngularRangeDegrees: roundMetric(profile.switching.maximumAngleDegrees),
    switchingCooldownSeconds: roundMetric(profile.switching.cooldownSeconds)
  };
}
