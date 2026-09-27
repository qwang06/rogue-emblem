import { describe, expect, it } from 'vitest';
import { getPathFacings, getStepFacing } from './facing.js';

describe('getStepFacing', () => {
  it('faces the way each orthogonal step goes', () => {
    expect(getStepFacing({ x: 2, y: 2 }, { x: 3, y: 2 })).toBe('right');
    expect(getStepFacing({ x: 2, y: 2 }, { x: 1, y: 2 })).toBe('left');
    expect(getStepFacing({ x: 2, y: 2 }, { x: 2, y: 3 })).toBe('down');
    expect(getStepFacing({ x: 2, y: 2 }, { x: 2, y: 1 })).toBe('up');
  });

  it('favors the horizontal on a diagonal', () => {
    expect(getStepFacing({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe('right');
    expect(getStepFacing({ x: 1, y: 1 }, { x: 0, y: 0 })).toBe('left');
  });

  it('has no facing for a step in place', () => {
    expect(getStepFacing({ x: 4, y: 4 }, { x: 4, y: 4 })).toBeNull();
  });
});

describe('getPathFacings', () => {
  it('gives one facing per step, turning at corners', () => {
    const path = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
      { x: 0, y: 1 },
    ];
    expect(getPathFacings(path)).toEqual(['right', 'down', 'down', 'left', 'up']);
  });

  it('is empty for a path of zero or one tile', () => {
    expect(getPathFacings([])).toEqual([]);
    expect(getPathFacings([{ x: 3, y: 3 }])).toEqual([]);
  });

  it('keeps the previous facing across a step in place', () => {
    const path = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 1 },
    ];
    expect(getPathFacings(path, 'left')).toEqual(['left', 'down', 'down']);
  });
});
