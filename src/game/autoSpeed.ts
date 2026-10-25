export const AUTO_SPEEDS = [1, 2, 4, 8] as const;
export type AutoSpeed = (typeof AUTO_SPEEDS)[number];

export function changeAutoSpeed(speed: AutoSpeed, direction: -1 | 1): AutoSpeed {
  const index = AUTO_SPEEDS.indexOf(speed);
  return AUTO_SPEEDS[Math.max(0, Math.min(AUTO_SPEEDS.length - 1, index + direction))];
}

// The next speed up, wrapping from the fastest back to 1x: one button
// stepping through every speed (the header's speed readout on phones).
export function cycleAutoSpeed(speed: AutoSpeed): AutoSpeed {
  return AUTO_SPEEDS[(AUTO_SPEEDS.indexOf(speed) + 1) % AUTO_SPEEDS.length];
}
