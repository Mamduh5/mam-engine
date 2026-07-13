import type { ContactVolumeProfile, ContactVolumeSimulation } from "./contactVolumeTypes";

export const CONTACT_VOLUME_FIXED_DELTA_SECONDS = 1 / 60;
const EPSILON = 1e-12;

export function simulateContact(hitbox: ContactVolumeProfile, hurtbox: ContactVolumeProfile, fixedDeltaSeconds = CONTACT_VOLUME_FIXED_DELTA_SECONDS): ContactVolumeSimulation {
  if (!Number.isFinite(fixedDeltaSeconds) || fixedDeltaSeconds <= 0) throw new Error("fixedDeltaSeconds must be finite and greater than 0");
  if (hitbox.role !== "hitbox") throw new Error("First contact volume must have role hitbox");
  if (hurtbox.role !== "hurtbox") throw new Error("Second contact volume must have role hurtbox");
  const hitboxActiveStartStep = authoredStep(hitbox.activeStartSeconds, fixedDeltaSeconds); const hitboxActiveEndStep = authoredStep(hitbox.activeEndSeconds, fixedDeltaSeconds);
  const hurtboxActiveStartStep = authoredStep(hurtbox.activeStartSeconds, fixedDeltaSeconds); const hurtboxActiveEndStep = authoredStep(hurtbox.activeEndSeconds, fixedDeltaSeconds);
  const totalSteps = Math.max(hitboxActiveEndStep, hurtboxActiveEndStep); const spatialOverlap = centerDistance(hitbox, hurtbox) <= hitbox.radius + hurtbox.radius;
  const contactSteps: number[] = [];
  for (let step = 1; step <= totalSteps; step += 1) { const hitboxActive = step >= hitboxActiveStartStep && step <= hitboxActiveEndStep; const hurtboxActive = step >= hurtboxActiveStartStep && step <= hurtboxActiveEndStep; if (spatialOverlap && hitboxActive && hurtboxActive) contactSteps.push(step); }
  const contactOccurred = contactSteps.length > 0;
  return { totalSteps, hitboxActiveStartStep, hitboxActiveEndStep, hurtboxActiveStartStep, hurtboxActiveEndStep, spatialOverlap, contactOccurred, firstContactStep: contactSteps[0] ?? null, lastContactStep: contactSteps.at(-1) ?? null, contactStepCount: contactSteps.length, finalContactState: contactOccurred ? "contacted" : "no-contact" };
}

function authoredStep(seconds: number, delta: number): number { return Math.max(1, Math.ceil(seconds / delta - EPSILON)); }
function centerDistance(left: ContactVolumeProfile, right: ContactVolumeProfile): number { return Math.hypot(left.center.x - right.center.x, left.center.y - right.center.y, left.center.z - right.center.z); }
