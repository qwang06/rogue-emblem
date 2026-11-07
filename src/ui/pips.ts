// HP as a row of blocks, Into the Breach style: one block per point up to
// PIP_LIMIT, then one per two points (an odd maximum rounds up), so a row
// never outgrows its column. Each block is lit, lost (the preview of a hit
// still to land, drawn red) or dark.

export type PipState = 'on' | 'lost' | 'off';

export const PIP_LIMIT = 12;

// How many points one block stands for at this maximum.
export function pointsPerPip(max: number): number {
  return max > PIP_LIMIT ? 2 : 1;
}

// The blocks for `value` of `max` points, the last `lost` of the lit ones
// marked lost. A block is lit when any of its points is.
export function getPips(value: number, max: number, lost = 0): readonly PipState[] {
  const per = pointsPerPip(max);
  const count = Math.max(0, Math.ceil(max / per));
  const kept = Math.max(0, value - lost);
  const pips: PipState[] = [];
  for (let i = 0; i < count; i++) {
    const point = i * per;
    pips.push(point < kept ? 'on' : point < value ? 'lost' : 'off');
  }
  return pips;
}
