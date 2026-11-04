import { describe, expect, it } from 'vitest';
import { SET_PIECES } from './setPieces.ts';
import { REGION_CONFIGS } from './regions.ts';
import { getSeasonPieces, SET_PIECE_ROLES } from '../game/setPieces.ts';
import { DEFAULT_SEASON } from '../game/tileset.ts';

describe('the built-in set pieces', () => {
  it('load (each keeps the format, see checkSetPiece) with names of their own', () => {
    expect(SET_PIECES.length).toBeGreaterThanOrEqual(10);
    expect(new Set(SET_PIECES.map((piece) => piece.name)).size).toBe(SET_PIECES.length);
  });

  it('cover every role', () => {
    expect(new Set(SET_PIECES.map((piece) => piece.role))).toEqual(new Set(SET_PIECE_ROLES));
  });

  it('give every season a region is drawn in a handful to pick from', () => {
    for (const region of REGION_CONFIGS) {
      expect(getSeasonPieces(SET_PIECES, region.season ?? DEFAULT_SEASON).length).toBeGreaterThanOrEqual(6);
    }
  });
});
