import { describe, expect, it } from 'vitest';
import { changeAutoSpeed, cycleAutoSpeed } from './autoSpeed.ts';

describe('changeAutoSpeed', () => {
  it('moves through the available speeds', () => {
    expect(changeAutoSpeed(1, 1)).toBe(2);
    expect(changeAutoSpeed(2, 1)).toBe(4);
    expect(changeAutoSpeed(8, -1)).toBe(4);
  });

  it('stays at the limits', () => {
    expect(changeAutoSpeed(1, -1)).toBe(1);
    expect(changeAutoSpeed(8, 1)).toBe(8);
  });
});

describe('cycleAutoSpeed', () => {
  it('steps up through every speed and wraps back to 1x', () => {
    expect(cycleAutoSpeed(1)).toBe(2);
    expect(cycleAutoSpeed(2)).toBe(4);
    expect(cycleAutoSpeed(4)).toBe(8);
    expect(cycleAutoSpeed(8)).toBe(1);
  });
});
