import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  getOutlineWidth,
  isSingleImageUnit,
  SINGLE_IMAGE_UNITS,
  STRUCTURE_SPRITES,
  TERRAIN_SHEET,
  UNIT_SHEET,
  UNIT_SPRITES,
  unitSheetKey,
} from '../game/tileset.ts';
import { SPRITES, SPRITE_URLS } from './sprites.ts';
import terrainSheetUrl from './overworld.png';

// An imported image's [width, height], read from its PNG header. Vitest
// imports an image as its path from the repo root.
function pngSize(url: string): [number, number] {
  const png = readFileSync(new URL(`../..${url}`, import.meta.url));
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

describe('SPRITES', () => {
  it('cuts every image into whole frames of the size it declares', () => {
    for (const [key, { url, frame }] of Object.entries(SPRITES)) {
      const [width, height] = pngSize(url);
      expect([width % frame, height % frame], key).toEqual([0, 0]);
    }
  });

  it('makes every unit sheet wide enough for its frames and tall enough for every facing row', () => {
    const { columns, rows } = UNIT_SHEET;
    const rowCount = Math.max(...Object.values(rows)) + 1;
    for (const key of Object.keys(SPRITES).filter((key) => /_(Idle|Move)$/.test(key))) {
      const { url, frame } = SPRITES[key];
      const [width, height] = pngSize(url);
      expect(width, key).toBe(columns * frame);
      expect(height, key).toBeGreaterThanOrEqual(rowCount * frame);
    }
  });

  it('gives both of a unit art’s sheets the same frame size', () => {
    for (const art of Object.values(UNIT_SPRITES).filter((art) => !isSingleImageUnit(art))) {
      expect(SPRITES[unitSheetKey(art, 'move')].frame, art).toBe(SPRITES[unitSheetKey(art, 'idle')].frame);
    }
  });

  it('makes every single-image unit one square frame', () => {
    for (const art of SINGLE_IMAGE_UNITS) {
      const { url, frame } = SPRITES[art];
      expect(pngSize(url), art).toEqual([frame, frame]);
    }
  });

  it('cuts each structure into one frame per tile', () => {
    for (const { key, width, height } of Object.values(STRUCTURE_SPRITES)) {
      const { url, frame } = SPRITES[key];
      expect(pngSize(url), key).toEqual([width * frame, height * frame]);
    }
  });

  it('lists the same keys as SPRITE_URLS', () => {
    expect(Object.keys(SPRITE_URLS)).toEqual(Object.keys(SPRITES));
  });
});

describe('TERRAIN_SHEET', () => {
  it('matches the terrain image', () => {
    const { columns, rows, tileSize } = TERRAIN_SHEET;
    expect(pngSize(terrainSheetUrl)).toEqual([columns * tileSize, rows * tileSize]);
  });
});

describe('getOutlineWidth', () => {
  it('keeps the outline the same share of a tile at any art size', () => {
    expect(getOutlineWidth(32)).toBe(1);
    expect(getOutlineWidth(64)).toBe(2);
  });

  it('is never thinner than one pixel', () => {
    expect(getOutlineWidth(16)).toBe(1);
  });
});
