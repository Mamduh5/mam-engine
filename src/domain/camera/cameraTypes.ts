export interface CameraProfile {
  schemaVersion: 1;
  kind: "camera-profile";
  id: string;
  displayName: string;
  orbit: {
    yawSpeedDegreesPerSecond: number;
    pitchSpeedDegreesPerSecond: number;
    invertYaw: boolean;
    invertPitch: boolean;
    minimumPitchDegrees: number;
    maximumPitchDegrees: number;
    initialYawDegrees: number;
    initialPitchDegrees: number;
  };
  follow: {
    distance: number;
    height: number;
    shoulderOffset: number;
    lookAtHeight: number;
    positionHalfLifeSeconds: number;
    rotationHalfLifeSeconds: number;
  };
  recenter: {
    enabled: boolean;
    delaySeconds: number;
    yawSpeedDegreesPerSecond: number;
    movementInputThreshold: number;
  };
  collision: {
    enabled: boolean;
    probeRadius: number;
    minimumDistance: number;
    returnHalfLifeSeconds: number;
  };
  lens: {
    fieldOfViewDegrees: number;
    nearClipDistance: number;
    farClipDistance: number;
  };
}

export type CameraScenario = "orbit" | "pitch-clamp" | "recenter" | "follow" | "collision" | "basis";
export interface CameraVector3 { x: number; y: number; z: number }
