import { roundMetric } from "../movement/movementMetrics";
import type { CameraProfile } from "./cameraTypes";

export function deriveCameraMetrics(profile: CameraProfile) {
  const pitchRange = profile.orbit.maximumPitchDegrees - profile.orbit.minimumPitchDegrees;
  return {
    pitchRangeDegrees: roundMetric(pitchRange),
    initialPitchWithinRange: profile.orbit.initialPitchDegrees >= profile.orbit.minimumPitchDegrees && profile.orbit.initialPitchDegrees <= profile.orbit.maximumPitchDegrees,
    orbitYawSecondsForFullRotation: roundMetric(360 / profile.orbit.yawSpeedDegreesPerSecond),
    orbitPitchSecondsAcrossConfiguredRange: roundMetric(pitchRange / profile.orbit.pitchSpeedDegreesPerSecond),
    recenterSecondsFor180Degrees: roundMetric(180 / profile.recenter.yawSpeedDegreesPerSecond),
    nominalCameraHeight: roundMetric(profile.follow.height),
    minimumCollisionCompressionRatio: roundMetric(profile.collision.minimumDistance / profile.follow.distance),
    fieldOfViewRadians: roundMetric(profile.lens.fieldOfViewDegrees * Math.PI / 180),
    nearFarRatio: roundMetric(profile.lens.nearClipDistance / profile.lens.farClipDistance)
  };
}
