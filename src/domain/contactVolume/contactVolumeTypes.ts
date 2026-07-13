export interface ContactVolumeCenter { x: number; y: number; z: number }

export interface ContactVolumeProfile {
  schemaVersion: 1;
  kind: "contact-volume-profile";
  id: string;
  displayName: string;
  role: "hitbox" | "hurtbox";
  center: ContactVolumeCenter;
  radius: number;
  activeStartSeconds: number;
  activeEndSeconds: number;
}

export interface ContactVolumeSimulation {
  totalSteps: number;
  hitboxActiveStartStep: number;
  hitboxActiveEndStep: number;
  hurtboxActiveStartStep: number;
  hurtboxActiveEndStep: number;
  spatialOverlap: boolean;
  contactOccurred: boolean;
  firstContactStep: number | null;
  lastContactStep: number | null;
  contactStepCount: number;
  finalContactState: "contacted" | "no-contact";
}
