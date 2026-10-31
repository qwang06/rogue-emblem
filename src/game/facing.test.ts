import { describe, expect, it } from 'vitest';
import { getFacingToward, getPathFacings, getStartFacing, getStepFacing } from './facing.ts';

describe('getStepFacing', () => {
  it('faces the way a sideways step goes', () => {
    expect(getStepFacing({ x: 2, y: 2 }, { x: 3, y: 2 })).toBe('right');
    expect(getStepFacing({ x: 2, y: 2 }, { x: 1, y: 2 })).toBe('left');
  });

  it('has no facing for a step toward or away from the camera', () => {
    expect(getStepFacing({ x: 2, y: 2 }, { x: 2, y: 3 })).toBeNull();
    expect(getStepFacing({ x: 2, y: 2 }, { x: 2, y: 1 })).toBeNull();
  });

  it('favors the horizontal on a diagonal', () => {
    expect(getStepFacing({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe('right');
    expect(getStepFacing({ x: 1, y: 1 }, { x: 0, y: 0 })).toBe('left');
  });

  it('has no facing for a step in place', () => {
    expect(getStepFacing({ x: 4, y: 4 }, { x: 4, y: 4 })).toBeNull();
  });
});

describe('getFacingToward', () => {
  it('faces the side a far target lies on', () => {
    expect(getFacingToward({ x: 5, y: 0 }, { x: 1, y: 7 })).toBe('left');
    expect(getFacingToward({ x: 1, y: 7 }, { x: 5, y: 0 })).toBe('right');
  });

  it('has no facing for a target in the same column', () => {
    expect(getFacingToward({ x: 3, y: 0 }, { x: 3, y: 5 })).toBeNull();
  });
});

describe('getStartFacing', () => {
  it('turns the player and guests right and enemies left', () => {
    expect(getStartFacing('player')).toBe('right');
    expect(getStartFacing('guest')).toBe('right');
    expect(getStartFacing('enemy')).toBe('left');
  });
});

describe('getPathFacings', () => {
  it('gives one facing per step, keeping it through vertical steps', () => {
    const path = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
      { x: 0, y: 1 },
    ];
    expect(getPathFacings(path)).toEqual(['right', 'right', 'right', 'left', 'left']);
  });

  it('starts from the initial facing until the first sideways step', () => {
    const path = [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ];
    expect(getPathFacings(path, 'left')).toEqual(['left', 'right']);
  });

  it('is empty for a path of zero or one tile', () => {
    expect(getPathFacings([])).toEqual([]);
    expect(getPathFacings([{ x: 3, y: 3 }])).toEqual([]);
  });
});
