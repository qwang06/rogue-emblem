import { describe, expect, it } from 'vitest';
import { SPRITE_URLS } from '../assets/sprites.ts';
import { FACINGS } from './facing.ts';
import {
  ARROW_TILES,
  CURSOR_ANIMATION,
  STRUCTURE_SPRITES,
  TERRAIN_SHEET,
  TILE_SIZE,
  TREE_SHADOW,
  TREE_SPRITES,
  UNIT_SHADOW,
  UNIT_ANIMATIONS,
  UNIT_SHEET,
  UNIT_SPRITES,
  DEFAULT_UNIT_SPRITE,
  getUnitSprite,
  unitSheetKey,
  type UnitAnimation,
} from './tileset.ts';
import { UNIT_CLASSES } from './unitClasses.ts';

describe('sprite keys', () => {
  it('names an image for every unit animation', () => {
    for (const sprite of Object.values(UNIT_SPRITES)) {
      for (const animation of Object.keys(UNIT_ANIMATIONS) as UnitAnimation[]) {
        expect(SPRITE_URLS).toHaveProperty([unitSheetKey(sprite, animation)]);
      }
    }
  });

  it('names an image for every tree', () => {
    for (const key of Object.values(TREE_SPRITES)) expect(SPRITE_URLS).toHaveProperty([key]);
  });

  it('names an image for every structure, at least one tile in each direction', () => {
    for (const { key, width, height } of Object.values(STRUCTURE_SPRITES)) {
      expect(SPRITE_URLS).toHaveProperty([key]);
      expect(width).toBeGreaterThanOrEqual(1);
      expect(height).toBeGreaterThanOrEqual(1);
    }
  });

  it('gives every unit class its own sprite', () => {
    const sprites = UNIT_CLASSES.map(({ id }) => UNIT_SPRITES[id]);
    expect(sprites.every(Boolean)).toBe(true);
    expect(new Set(sprites).size).toBe(sprites.length);
  });
});

describe('getUnitSprite', () => {
  it('picks the art by unit class', () => {
    expect(getUnitSprite('villager')).toBe('Villager_01');
    expect(getUnitSprite('soldier')).toBe('Soldier_03');
    expect(getUnitSprite('archer')).toBe('Archer_02');
    expect(getUnitSprite('vanguard')).toBe('Vanguard_04');
    expect(getUnitSprite('guard')).toBe('Soldier_04');
    expect(getUnitSprite('acolyte')).toBe('Acolyte_02');
    expect(getUnitSprite('slime')).toBe('Slime_01');
    expect(getUnitSprite('goblin')).toBe('Goblin_01');
    expect(getUnitSprite('skeleton')).toBe('Skeleton_01');
  });

  it('falls back to the default art for an unknown or missing class', () => {
    expect(getUnitSprite('dragon')).toBe(DEFAULT_UNIT_SPRITE);
    expect(getUnitSprite(null)).toBe(DEFAULT_UNIT_SPRITE);
  });
});

describe('shadows', () => {
  it('fit inside one tile and are translucent', () => {
    for (const { width, height, centerX, centerY, alpha } of [UNIT_SHADOW, TREE_SHADOW]) {
      expect(centerX - width / 2).toBeGreaterThanOrEqual(0);
      expect(centerX + width / 2).toBeLessThanOrEqual(TILE_SIZE);
      expect(centerY - height / 2).toBeGreaterThanOrEqual(0);
      expect(centerY + height / 2).toBeLessThanOrEqual(TILE_SIZE);
      expect(alpha).toBeGreaterThan(0);
      expect(alpha).toBeLessThan(1);
      // Whole-pixel corners, so the pixel art stays crisp.
      expect(Number.isInteger(centerX - width / 2)).toBe(true);
      expect(Number.isInteger(centerY - height / 2)).toBe(true);
    }
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

describe('unitSheetKey', () => {
  it('names the sheet for each animation', () => {
    expect(unitSheetKey('Villager_01', 'idle')).toBe('Villager_01_Idle');
    expect(unitSheetKey('Villager_01', 'move')).toBe('Villager_01_Move');
  });
});

describe('UNIT_SHEET', () => {
  it('has a distinct sheet row for every facing', () => {
    const { rows, defaultFacing } = UNIT_SHEET;
    expect(Object.keys(rows).sort()).toEqual([...FACINGS].sort());
    expect(new Set(Object.values(rows)).size).toBe(FACINGS.length);
    expect(rows).toHaveProperty([defaultFacing]);
  });
});
