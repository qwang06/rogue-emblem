import { describe, expect, it } from 'vitest';
import { SPRITE_URLS } from '../assets/sprites.js';
import { ARROW_TILES, CURSOR_ANIMATION, TERRAIN_SHEET, UNIT_SPRITES } from './tileset.js';

describe('sprite keys', () => {
  it('names an image for every unit', () => {
    for (const key of Object.values(UNIT_SPRITES)) expect(SPRITE_URLS).toHaveProperty([key]);
  });

  it('gives each team its own sprite', () => {
    expect(UNIT_SPRITES.player).not.toBe(UNIT_SPRITES.enemy);
  });
});

describe('CURSOR_ANIMATION', () => {
  it('pulses between two different tiles on the terrain sheet', () => {
    const { tiles } = CURSOR_ANIMATION;
    expect(tiles).toHaveLength(2);
    expect(tiles[0]).not.toEqual(tiles[1]);
    for (const [column, row] of tiles) {
      expect(column).toBeGreaterThanOrEqual(0);
      expect(column).toBeLessThan(TERRAIN_SHEET.columns);
      expect(row).toBeGreaterThanOrEqual(0);
      expect(row).toBeLessThan(TERRAIN_SHEET.rows);
    }
  });
});

describe('ARROW_TILES', () => {
  it('gives every arrow piece its own tile on the terrain sheet', () => {
    const tiles = Object.values(ARROW_TILES);
    expect(new Set(tiles.map(String)).size).toBe(tiles.length);
    for (const [column, row] of tiles) {
      expect(column).toBeLessThan(TERRAIN_SHEET.columns);
      expect(row).toBeLessThan(TERRAIN_SHEET.rows);
    }
  });
});
