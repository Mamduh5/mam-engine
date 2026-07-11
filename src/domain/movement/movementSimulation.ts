import { roundMetric } from "./movementMetrics";
import type { MovementProfile, MovementScenario } from "./movementTypes";

export const FIXED_TIMESTEP_SECONDS = 1 / 60;

export interface SimulationResult {
  scenario: MovementScenario;
  metrics: Record<string, number | null>;
}

function positiveDuration(value: number | undefined, fallback: number): number {
  return value === undefined ? fallback : value;
}

function stepCount(duration: number): number {
  return Math.max(1, Math.ceil(duration / FIXED_TIMESTEP_SECONDS));
}

export function simulateMovement(
  profile: MovementProfile,
  scenario: MovementScenario,
  requestedSeconds?: number
): SimulationResult {
  switch (scenario) {
    case "accelerate":
      return simulateAccelerate(profile, positiveDuration(requestedSeconds, 3));
    case "stop":
      return simulateStop(profile, positiveDuration(
        requestedSeconds,
        profile.ground.runSpeed / profile.ground.deceleration + FIXED_TIMESTEP_SECONDS
      ));
    case "sprint":
      return simulateSprint(profile, positiveDuration(requestedSeconds, 5));
    case "dodge":
      return simulateDodge(profile);
    case "turn":
      return simulateTurn(profile);
  }
}

function simulateTurn(profile: MovementProfile): SimulationResult {
  const targetYaw = 90;
  const maximumStep = profile.ground.rotationSpeedDegrees * FIXED_TIMESTEP_SECONDS;
  let yaw = 0;
  let steps = 0;
  let maximumAngularSpeed = 0;
  while (yaw < targetYaw && steps < 10_000) {
    const change = Math.min(maximumStep, targetYaw - yaw);
    yaw += change;
    steps += 1;
    maximumAngularSpeed = Math.max(maximumAngularSpeed, change / FIXED_TIMESTEP_SECONDS);
  }
  return {
    scenario: "turn",
    metrics: {
      targetYawDegrees: targetYaw,
      finalYawDegrees: roundMetric(yaw),
      maximumAngularSpeedDegreesPerSecond: roundMetric(maximumAngularSpeed),
      timeToTargetYawSeconds: roundMetric(steps * FIXED_TIMESTEP_SECONDS),
      fixedTimestepSeconds: roundMetric(FIXED_TIMESTEP_SECONDS),
      simulationSteps: steps
    }
  };
}

function simulateAccelerate(profile: MovementProfile, duration: number): SimulationResult {
  const steps = stepCount(duration);
  let speed = 0;
  let distance = 0;
  let maximumSpeed = 0;
  let timeToNinetyFivePercent: number | null = null;

  for (let step = 1; step <= steps; step += 1) {
    speed = Math.min(profile.ground.runSpeed, speed + profile.ground.acceleration * FIXED_TIMESTEP_SECONDS);
    distance += speed * FIXED_TIMESTEP_SECONDS;
    maximumSpeed = Math.max(maximumSpeed, speed);
    if (timeToNinetyFivePercent === null && speed >= profile.ground.runSpeed * 0.95) {
      timeToNinetyFivePercent = step * FIXED_TIMESTEP_SECONDS;
    }
  }

  return {
    scenario: "accelerate",
    metrics: {
      durationSeconds: roundMetric(steps * FIXED_TIMESTEP_SECONDS),
      finalSpeed: roundMetric(speed),
      maximumObservedSpeed: roundMetric(maximumSpeed),
      timeToNinetyFivePercentSeconds: timeToNinetyFivePercent === null ? null : roundMetric(timeToNinetyFivePercent),
      totalDistance: roundMetric(distance),
      fixedTimestepSeconds: roundMetric(FIXED_TIMESTEP_SECONDS),
      simulationSteps: steps
    }
  };
}

function simulateStop(profile: MovementProfile, duration: number): SimulationResult {
  const maximumSteps = stepCount(duration);
  let speed = profile.ground.runSpeed;
  let distance = 0;
  let stoppingTime: number | null = null;
  let steps = 0;

  for (let step = 1; step <= maximumSteps; step += 1) {
    speed = Math.max(0, speed - profile.ground.deceleration * FIXED_TIMESTEP_SECONDS);
    distance += speed * FIXED_TIMESTEP_SECONDS;
    steps = step;
    if (speed === 0) {
      stoppingTime = step * FIXED_TIMESTEP_SECONDS;
      break;
    }
  }

  return {
    scenario: "stop",
    metrics: {
      stoppingTimeSeconds: stoppingTime === null ? null : roundMetric(stoppingTime),
      stoppingDistance: roundMetric(distance),
      finalSpeed: roundMetric(speed),
      fixedTimestepSeconds: roundMetric(FIXED_TIMESTEP_SECONDS),
      simulationSteps: steps
    }
  };
}

function simulateSprint(profile: MovementProfile, duration: number): SimulationResult {
  const steps = stepCount(duration);
  let speed = profile.ground.runSpeed;
  let stamina = profile.stamina.maximum;
  let distance = 0;
  let staminaConsumed = 0;
  let timeUntilUnavailable: number | null = null;
  let sprinting = stamina >= profile.stamina.minimumToStartSprint;
  let timeSinceSprint = 0;

  for (let step = 1; step <= steps; step += 1) {
    if (sprinting) {
      const cost = Math.min(stamina, profile.stamina.sprintCostPerSecond * FIXED_TIMESTEP_SECONDS);
      stamina -= cost;
      staminaConsumed += cost;
      timeSinceSprint = 0;
      if (stamina <= 1e-12 && profile.stamina.sprintCostPerSecond > 0) {
        stamina = 0;
        sprinting = false;
        timeUntilUnavailable ??= step * FIXED_TIMESTEP_SECONDS;
      }
    } else {
      timeSinceSprint += FIXED_TIMESTEP_SECONDS;
      if (timeSinceSprint >= profile.stamina.regenerationDelaySeconds) {
        stamina = Math.min(
          profile.stamina.maximum,
          stamina + profile.stamina.regenerationPerSecond * FIXED_TIMESTEP_SECONDS
        );
      }
      if (stamina >= profile.stamina.minimumToStartSprint) {
        sprinting = true;
      }
    }

    const targetSpeed = sprinting ? profile.ground.sprintSpeed : profile.ground.runSpeed;
    const rate = targetSpeed >= speed ? profile.ground.acceleration : profile.ground.deceleration;
    const delta = rate * FIXED_TIMESTEP_SECONDS;
    speed = targetSpeed >= speed ? Math.min(targetSpeed, speed + delta) : Math.max(targetSpeed, speed - delta);
    distance += speed * FIXED_TIMESTEP_SECONDS;
  }

  return {
    scenario: "sprint",
    metrics: {
      durationSeconds: roundMetric(steps * FIXED_TIMESTEP_SECONDS),
      totalDistance: roundMetric(distance),
      finalSpeed: roundMetric(speed),
      staminaConsumed: roundMetric(staminaConsumed),
      finalStamina: roundMetric(stamina),
      timeUntilSprintUnavailableSeconds: timeUntilUnavailable === null ? null : roundMetric(timeUntilUnavailable),
      fixedTimestepSeconds: roundMetric(FIXED_TIMESTEP_SECONDS),
      simulationSteps: steps
    }
  };
}

function simulateDodge(profile: MovementProfile): SimulationResult {
  const steps = stepCount(profile.dodge.durationSeconds);
  const averageSpeed = profile.dodge.distance / profile.dodge.durationSeconds;
  let elapsed = 0;
  let distance = 0;

  for (let step = 0; step < steps; step += 1) {
    const delta = Math.min(FIXED_TIMESTEP_SECONDS, profile.dodge.durationSeconds - elapsed);
    distance += averageSpeed * delta;
    elapsed += delta;
  }

  return {
    scenario: "dodge",
    metrics: {
      configuredDistance: profile.dodge.distance,
      simulatedDistance: roundMetric(distance),
      durationSeconds: profile.dodge.durationSeconds,
      invulnerabilityStartSeconds: profile.dodge.invulnerabilityStartSeconds,
      invulnerabilityEndSeconds: profile.dodge.invulnerabilityEndSeconds,
      invulnerabilityDurationSeconds: roundMetric(
        profile.dodge.invulnerabilityEndSeconds - profile.dodge.invulnerabilityStartSeconds
      ),
      staminaConsumed: profile.dodge.staminaCost,
      fixedTimestepSeconds: roundMetric(FIXED_TIMESTEP_SECONDS),
      simulationSteps: steps
    }
  };
}
