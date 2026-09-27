import { describe, expect, it } from 'vitest';
import { getArrowPieces } from './moveArrow.js';
import { ARROW_SPRITES } from './tileset.js';

// Builds a path from "x,y" strings to keep the cases readable.
function path(...coords) {
  return coords.map((c) => {
    const [x, y] = c.split(',').map(Number);
    return { x, y };
  });
}

function pieces(p) {
  return getArrowPieces(p).map((t) => t.piece);
}

describe('getArrowPieces', () => {
  it('draws nothing for an empty path or one that stays put', () => {
    expect(getArrowPieces([])).toEqual([]);
    expect(getArrowPieces(path('2,2'))).toEqual([]);
  });

  it('skips the origin and puts a head on a single step', () => {
    expect(getArrowPieces(path('2,2', '3,2'))).toEqual([{ x: 3, y: 2, piece: 'head-right' }]);
  });

  it('points the head the way the last step went', () => {
    expect(pieces(path('2,2', '2,1'))).toEqual(['head-up']);
    expect(pieces(path('2,2', '2,3'))).toEqual(['head-down']);
    expect(pieces(path('2,2', '1,2'))).toEqual(['head-left']);
    expect(pieces(path('2,2', '3,2'))).toEqual(['head-right']);
  });

  it('uses straight segments on a straight line', () => {
    expect(pieces(path('0,0', '1,0', '2,0', '3,0'))).toEqual(['left-right', 'left-right', 'head-right']);
    expect(pieces(path('0,3', '0,2', '0,1', '0,0'))).toEqual(['up-down', 'up-down', 'head-up']);
  });

  it('names corners by the two edges they join, whichever way they are walked', () => {
    // Right then down: the corner joins its left edge and its bottom edge.
    expect(pieces(path('0,0', '1,0', '1,1'))).toEqual(['down-left', 'head-down']);
    // The same corner walked the other way: up then left.
    expect(pieces(path('1,1', '1,0', '0,0'))).toEqual(['down-left', 'head-left']);
    expect(pieces(path('0,1', '1,1', '1,0'))).toEqual(['up-left', 'head-up']);
    expect(pieces(path('1,0', '0,0', '0,1'))).toEqual(['down-right', 'head-down']);
    expect(pieces(path('1,1', '0,1', '0,0'))).toEqual(['up-right', 'head-up']);
  });

  it('handles a winding route', () => {
    // Up, right, right, down.
    expect(getArrowPieces(path('0,1', '0,0', '1,0', '2,0', '2,1'))).toEqual([
      { x: 0, y: 0, piece: 'down-right' },
      { x: 1, y: 0, piece: 'left-right' },
      { x: 2, y: 0, piece: 'down-left' },
      { x: 2, y: 1, piece: 'head-down' },
    ]);
  });

  it('only produces pieces that have a frame', () => {
    const winding = path('1,1', '1,0', '2,0', '2,1', '2,2', '1,2', '0,2', '0,1', '0,0');
    for (const { piece } of getArrowPieces(winding)) expect(ARROW_SPRITES).toHaveProperty(piece);
  });
});
