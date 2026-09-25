import { describe, expect, it } from 'vitest';
import { getFramePosition, TILESET_COLUMNS, UNIT_FRAMES } from './tileset.js';

describe('getFramePosition', () => {
  it('puts frame 0 at the top-left', () => {
    expect(getFramePosition(0)).toEqual({ col: 0, row: 0 });
  });

  it('wraps to the next row after the last column', () => {
    expect(getFramePosition(TILESET_COLUMNS - 1)).toEqual({ col: TILESET_COLUMNS - 1, row: 0 });
    expect(getFramePosition(TILESET_COLUMNS)).toEqual({ col: 0, row: 1 });
  });

  it('locates unit frames on the sheet', () => {
    expect(getFramePosition(UNIT_FRAMES.player)).toEqual({ col: 16, row: 6 });
  });

  it('accepts a custom column count', () => {
    expect(getFramePosition(7, 4)).toEqual({ col: 3, row: 1 });
  });
});
