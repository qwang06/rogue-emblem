import { describe, expect, it } from 'vitest';
import { createGrid } from './grid.ts';
import { createCursor, moveCursor } from './cursor.ts';

describe('createCursor', () => {
  it('defaults to (0, 0)', () => {
    expect(createCursor()).toEqual({ x: 0, y: 0 });
  });

  it('accepts a starting position', () => {
    expect(createCursor(2, 3)).toEqual({ x: 2, y: 3 });
  });
});

describe('moveCursor', () => {
  const grid = createGrid(4, 3);

  it('moves by the given delta', () => {
    expect(moveCursor(grid, createCursor(1, 1), 1, 0)).toEqual({ x: 2, y: 1 });
    expect(moveCursor(grid, createCursor(1, 1), 0, 1)).toEqual({ x: 1, y: 2 });
  });

  it('does not move when the delta is zero', () => {
    expect(moveCursor(grid, createCursor(1, 1), 0, 0)).toEqual({ x: 1, y: 1 });
  });

  it('clamps at the left/top edge of the grid', () => {
    expect(moveCursor(grid, createCursor(0, 0), -1, 0)).toEqual({ x: 0, y: 0 });
    expect(moveCursor(grid, createCursor(0, 0), 0, -1)).toEqual({ x: 0, y: 0 });
  });

  it('clamps at the right/bottom edge of the grid', () => {
    expect(moveCursor(grid, createCursor(3, 2), 1, 0)).toEqual({ x: 3, y: 2 });
    expect(moveCursor(grid, createCursor(3, 2), 0, 1)).toEqual({ x: 3, y: 2 });
  });

  it('does not mutate the cursor it was given', () => {
    const cursor = createCursor(1, 1);
    moveCursor(grid, cursor, 1, 1);
    expect(cursor).toEqual({ x: 1, y: 1 });
  });
});
