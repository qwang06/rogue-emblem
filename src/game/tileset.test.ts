import { RUN_ITEMS } from './warband/run.ts';
import { WEAPONS } from './weapons.ts';
import { describe, expect, it } from 'vitest';
import { SPRITE_URLS, TERRAIN_SHEET_URLS } from '../assets/sprites.ts';
import { FACINGS } from './facing.ts';
import {
  ARROW_TILES,
  CURSOR_ANIMATION,
  ITEM_SPRITES,
  getItemSprite,
  RANK_BADGES,
  STRUCTURE_SPRITES,
  TERRAIN_SHEET,
  SEASONS,
  SEASON_TERRAIN_SHEETS,
  SEASON_TREES,
  SEASON_PROPS_SHEETS,
  TILE_SIZE,
  TREE_SHADOW,
  TREE_SPRITES,
  UNIT_SHADOW,
  UNIT_ART,
  UNIT_SHEET,
  getAllUnitSheets,
  getImpactFrame,
  getUnitAnimations,
  getUnitSheet,
  getUnitSheetFrameSizes,
  SPIKES_SHEET,
  TRAP_ART,
  hasBakedShadow,
  UNIT_SPRITES,
  FACTION_BODIES,
  getAllUnitArts,
  DEFAULT_UNIT_SPRITE,
  getUnitSprite,
  unitSheetKey,
} from './tileset.ts';
import { UNIT_CLASSES } from './unitClasses.ts';
import { FACTIONS } from './factions.ts';
import { WOODEN_ARMOR, WOODEN_SHIELD } from './items.ts';
import { WOODEN_AXE, WOODEN_SPEAR, WOODEN_SWORD } from './weapons.ts';

describe('sprite keys', () => {
  it('names an image for every unit animation and viewer sheet', () => {
    for (const sprite of getAllUnitArts()) {
      for (const { key } of getAllUnitSheets(sprite)) expect(SPRITE_URLS).toHaveProperty([key]);
    }
  });

  it('names an image for every item icon, and none for an item without one', () => {
    for (const [itemId, key] of Object.entries(ITEM_SPRITES)) {
      expect(SPRITE_URLS).toHaveProperty([key]);
      expect(getItemSprite(itemId)).toBe(key);
    }
    expect(getItemSprite('no-such-item')).toBeNull();
  });

  it('has an icon for every item a run can hold, and every weapon', () => {
    for (const item of [...RUN_ITEMS, ...WEAPONS]) expect(getItemSprite(item.id), item.id).not.toBeNull();
  });

  it('has an icon for the whole wooden set', () => {
    for (const item of [WOODEN_SWORD, WOODEN_SPEAR, WOODEN_AXE, WOODEN_SHIELD, WOODEN_ARMOR]) {
      expect(getItemSprite(item.id), item.id).not.toBeNull();
    }
  });

  it('names a terrain sheet with the summer layout, and a tree that has art, for every season', () => {
    for (const season of SEASONS) {
      const sheet = SEASON_TERRAIN_SHEETS[season];
      expect(TERRAIN_SHEET_URLS).toHaveProperty([sheet.key]);
      expect(sheet).toMatchObject({ columns: TERRAIN_SHEET.columns, rows: TERRAIN_SHEET.rows });
      expect(SPRITE_URLS).toHaveProperty([SEASON_PROPS_SHEETS[season].key]);
      const tree = SEASON_TREES[season];
      if (tree) expect(TREE_SPRITES).toHaveProperty([tree]);
    }
    expect(SEASON_TERRAIN_SHEETS.summer).toBe(TERRAIN_SHEET);
    expect(new Set(SEASONS.map((season) => SEASON_TERRAIN_SHEETS[season].key)).size).toBe(SEASONS.length);
  });

  it('loads every trap strip at its own frame size, with its frames on the strip', () => {
    const sizes = getUnitSheetFrameSizes();
    for (const { key, frameWidth, frameHeight, rest, trigger } of Object.values(TRAP_ART)) {
      expect(SPRITE_URLS).toHaveProperty([key]);
      expect(sizes[key]).toEqual({ frameWidth, frameHeight });
      for (const frame of [rest, ...trigger]) expect(frame, key).toBeLessThan(6);
    }
    expect(SPIKES_SHEET.key).toBe(TRAP_ART.spikes.key);
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

  it("gives every unit class art of its own (the whelp borrows the Beast's), a faction class one per faction", () => {
    for (const { id } of UNIT_CLASSES) expect(FACTION_BODIES[id] ?? UNIT_SPRITES[id], id).toBeTruthy();
    const classes = UNIT_CLASSES.filter(({ id }) => id !== 'whelp');
    const arts = classes.flatMap(({ id }) => FACTIONS.map((faction) => getUnitSprite(id, faction.id)));
    expect(new Set(arts).size).toBe(
      classes.filter(({ id }) => FACTION_BODIES[id]).length * FACTIONS.length +
        classes.filter(({ id }) => !FACTION_BODIES[id]).length,
    );
    expect(getUnitSprite('whelp', 'rose')).toBe(getUnitSprite('beast', 'rose'));
  });
});

describe('getUnitSprite', () => {
  it("picks a faction class's art by faction, the player's by default", () => {
    expect(getUnitSprite('villager')).toBe('Villager_01');
    expect(getUnitSprite('soldier', 'azure')).toBe('Soldier_01');
    expect(getUnitSprite('archer', 'rose')).toBe('Archer_03');
    expect(getUnitSprite('vanguard', 'ironhold')).toBe('Vanguard_04');
    expect(getUnitSprite('beast-rider', 'verdant')).toBe('BeastRider_05');
    expect(getUnitSprite('siege', 'crimson')).toBe('Siege_06');
    expect(getUnitSprite('acolyte', null)).toBe('Acolyte_01');
  });

  it('picks the same art for a faction-free class whatever the faction', () => {
    expect(getUnitSprite('fire-elemental', 'azure')).toBe('Elemental_02');
    expect(getUnitSprite('slime', 'crimson')).toBe('Slime');
    expect(getUnitSprite('orc')).toBe('Orc');
    expect(getUnitSprite('dragon')).toBe('Red_Dragon');
  });

  it('falls back to the default art for an unknown or missing class', () => {
    expect(getUnitSprite('kraken')).toBe(DEFAULT_UNIT_SPRITE);
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

describe('RANK_BADGES', () => {
  it('are rectangles of named colors that fit inside one tile', () => {
    for (const { x, y, rows, palette } of Object.values(RANK_BADGES)) {
      const width = rows[0].length;
      expect(rows.every((row) => row.length === width)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + width).toBeLessThanOrEqual(TILE_SIZE);
      expect(y + rows.length).toBeLessThanOrEqual(TILE_SIZE);
      for (const char of rows.join('')) expect(char === '.' || char in palette).toBe(true);
    }
  });

  it('look different for a boss and an elite', () => {
    expect(RANK_BADGES.boss.rows).not.toEqual(RANK_BADGES.elite.rows);
  });
});

describe('CURSOR_ANIMATION', () => {
  it('pulses between the two frames of its own sheet', () => {
    expect(CURSOR_ANIMATION.sheet).not.toBe(TERRAIN_SHEET.key);
    expect(CURSOR_ANIMATION.frames).toEqual([0, 1]);
    expect(CURSOR_ANIMATION.frameMs).toBeGreaterThan(0);
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
    expect(unitSheetKey('Warrior_01', 'idle')).toBe('Warrior_01_Idle');
    expect(unitSheetKey('Warrior_01', 'move')).toBe('Warrior_01_Move');
  });
});

describe('unit sheets', () => {
  it('gives the pack art idle and move in one-tile frames, four per facing', () => {
    expect(getUnitAnimations('Soldier_03')).toEqual(['idle', 'move']);
    expect(getUnitSheet('Soldier_03', 'move')).toMatchObject({
      key: 'Soldier_03_Move',
      frameWidth: TILE_SIZE,
      frameHeight: TILE_SIZE,
      frames: 4,
      tileX: 0,
      tileY: 0,
      loop: true,
    });
    expect(getUnitSheet('Soldier_03', 'attack')).toBeNull();
    expect(hasBakedShadow('Soldier_03')).toBe(false);
  });

  it('gives the red dragon every animation, its bigger frames pinned by its tile', () => {
    expect(getUnitSprite('dragon')).toBe('Red_Dragon');
    expect(getUnitAnimations('Red_Dragon')).toEqual(['idle', 'move', 'attack', 'hit', 'die']);
    expect(getUnitSheet('Red_Dragon', 'idle')).toMatchObject({ frameWidth: 32, frameHeight: 32, frames: 4 });
    expect(getUnitSheet('Red_Dragon', 'move')).toMatchObject({ frameWidth: 48, tileX: 8, tileY: 0 });
    expect(getUnitSheet('Red_Dragon', 'attack')).toMatchObject({
      key: 'Red_Dragon_Attack',
      frameWidth: 112,
      frameHeight: 96,
      frames: 6,
      tileX: 40,
      tileY: 32,
      loop: false,
    });
    expect(getAllUnitSheets('Red_Dragon').map(({ key }) => key)).toEqual([
      'Red_Dragon_Idle',
      'Red_Dragon_Move',
      'Red_Dragon_Attack',
      'Red_Dragon_Hit',
      'Red_Dragon_Die',
      'Red_Dragon_AttackBody',
      'Red_Dragon_AttackFire',
    ]);
    expect(getImpactFrame('Red_Dragon')).toBe(2);
    expect(hasBakedShadow('Red_Dragon')).toBe(true);
  });

  it("keeps every frame's tile inside the frame", () => {
    for (const art of Object.keys(UNIT_ART)) {
      for (const sheet of getAllUnitSheets(art)) {
        expect(sheet.tileX + TILE_SIZE, sheet.key).toBeLessThanOrEqual(sheet.frameWidth);
        expect(sheet.tileY + TILE_SIZE, sheet.key).toBeLessThanOrEqual(sheet.frameHeight);
      }
    }
  });

  it('loads only the bigger sheets at their own frame size', () => {
    const sizes = getUnitSheetFrameSizes();
    expect(sizes.Red_Dragon_Attack).toEqual({ frameWidth: 112, frameHeight: 96 });
    expect(sizes).not.toHaveProperty('Soldier_03_Idle');
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
