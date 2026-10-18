export const AUTO_SPEEDS = [1, 2, 4, 8] as const;
export type AutoSpeed = (typeof AUTO_SPEEDS)[number];

export function changeAutoSpeed(speed: AutoSpeed, direction: -1 | 1): AutoSpeed {
  const index = AUTO_SPEEDS.indexOf(speed);
  return AUTO_SPEEDS[Math.max(0, Math.min(AUTO_SPEEDS.length - 1, index + direction))];
}
