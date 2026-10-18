import { describe, expect, it } from 'vitest';
import { changeAutoSpeed } from './autoSpeed.ts';

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
