import { describe, expect, it } from 'vitest';
import { createGrid } from '../../grid.ts';
import { TILE_SIZE } from '../../tileset.ts';
import { INK_COLORS, paintRealmInk, type RgbaImage } from './inkRaster.ts';
import { INK_STAMPS, type InkStamp, type RealmInk } from './realmInk.ts';

// Every stamp a 2x2 block of solid red in its top-left corner.
const RED: RgbaImage = { width: 2, height: 2, data: new Uint8ClampedArray(Array(4).fill([255, 0, 0, 255]).flat()) };
const STAMPS = Object.fromEntries(INK_STAMPS.map((id) => [id, RED])) as Record<InkStamp, RgbaImage>;

// A map of `columns` x `rows` tiles, the cells listed in `water` wet.
function inkOf(columns: number, rows: number, water: number[] = [], extra: Partial<RealmInk> = {}): RealmInk {
  const grid = createGrid(columns, rows);
  return {
    width: columns * TILE_SIZE,
    height: rows * TILE_SIZE,
    water: grid.cells.map((_, i) => water.includes(i)),
    placements: [],
    roads: [],
    rivers: [],
    bands: [{ season: 'summer', from: 0, to: columns }],
    labels: [],
    ...extra,
  };
}

const pixel = (image: RgbaImage, x: number, y: number) => [
  ...image.data.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4),
];
const near = (a: number[], b: readonly number[], by: number) => b.every((c, i) => Math.abs(a[i] - c) <= by);

describe('paintRealmInk', () => {
  it('paints every pixel of the map, opaque, the same way every time', () => {
    const ink = inkOf(3, 2);
    const image = paintRealmInk(ink, 4, STAMPS);
    expect(image.width).toBe(96);
    expect(image.height).toBe(64);
    expect(image.data.length).toBe(96 * 64 * 4);
    for (let i = 3; i < image.data.length; i += 4) expect(image.data[i]).toBe(255);
    expect(paintRealmInk(ink, 4, STAMPS)).toBe(image);
  });

  it('paints dry land as parchment', () => {
    const image = paintRealmInk(inkOf(2, 2), 1, STAMPS);
    const { paperLight, paperDark } = INK_COLORS;
    for (const [x, y] of [
      [0, 0],
      [40, 20],
      [63, 63],
    ]) {
      const [r, g, b] = pixel(image, x, y);
      expect(r).toBeGreaterThanOrEqual(paperDark[0] - 5);
      expect(r).toBeLessThanOrEqual(paperLight[0] + 5);
      expect(g).toBeGreaterThanOrEqual(paperDark[1] - 5);
      expect(b).toBeLessThanOrEqual(paperLight[2] + 5);
    }
  });

  it('washes a lake darker in its middle and inks its coast', () => {
    // A 5x5 map with the middle 3x3 wet.
    const wet = [6, 7, 8, 11, 12, 13, 16, 17, 18];
    const image = paintRealmInk(inkOf(5, 5, wet), 1, STAMPS);
    const middle = pixel(image, 80, 80);
    expect(near(middle, INK_COLORS.waterDeep, 20)).toBe(true);
    // Somewhere on the row from the dry corner to the lake's middle is the
    // coast's ink.
    const row = Array.from({ length: 80 }, (_, x) => pixel(image, x, 80));
    expect(row.some((p) => near(p, INK_COLORS.ink, 2))).toBe(true);
    expect(near(pixel(image, 2, 80), INK_COLORS.ink, 2)).toBe(false);
  });

  it('paints roads pale with an ink edge, along their line', () => {
    const line = [
      { x: 10, y: 32 },
      { x: 86, y: 32 },
    ];
    const image = paintRealmInk(inkOf(3, 2, [], { roads: [{ tiles: [], line }] }), 1, STAMPS);
    expect(pixel(image, 48, 32).slice(0, 3)).toEqual([...INK_COLORS.road]);
    expect(pixel(image, 48, 35).slice(0, 3)).toEqual([...INK_COLORS.roadEdge]);
    expect(pixel(image, 48, 40).slice(0, 3)).not.toEqual([...INK_COLORS.roadEdge]);
  });

  it('stamps symbols at their place, clipped to the map', () => {
    const placements = [
      { stamp: 'tree-pine-1' as const, x: 5, y: 6 },
      { stamp: 'grass-1' as const, x: -1, y: -1 },
    ];
    const image = paintRealmInk(inkOf(2, 2, [], { placements }), 1, STAMPS);
    expect(pixel(image, 5, 6)).toEqual([255, 0, 0, 255]);
    expect(pixel(image, 6, 7)).toEqual([255, 0, 0, 255]);
    expect(pixel(image, 7, 8)).not.toEqual([255, 0, 0, 255]);
    expect(pixel(image, 0, 0)).toEqual([255, 0, 0, 255]);
  });
});

describe('seasons on the paper', () => {
  it('paints each band in its season’s paper, blending across their edge', () => {
    const bands = [
      { season: 'summer' as const, from: 0, to: 8 },
      { season: 'winter' as const, from: 8, to: 16 },
    ];
    const image = paintRealmInk(inkOf(16, 2, [], { bands }), 9, STAMPS);
    const summer = pixel(image, 2 * TILE_SIZE, 20);
    const winter = pixel(image, 14 * TILE_SIZE, 20);
    // Winter's paper is paler and less yellow than summer's.
    expect(winter[2]).toBeGreaterThan(summer[2] + 20);
    const edge = pixel(image, 8 * TILE_SIZE, 20);
    expect(edge[2]).toBeGreaterThan(summer[2]);
    expect(edge[2]).toBeLessThan(winter[2]);
  });

  it('draws a river as ink with water inside, and the border inside the edge', () => {
    const ink = inkOf(4, 4, [], {
      rivers: [
        {
          tiles: [],
          line: [
            { x: 64, y: 16 },
            { x: 64, y: 112 },
          ],
        },
      ],
    });
    const image = paintRealmInk(ink, 5, STAMPS);
    expect(near(pixel(image, 64, 64), INK_COLORS.water, 2)).toBe(true);
    expect(near(pixel(image, 66, 64), INK_COLORS.ink, 2)).toBe(true);
    expect(near(pixel(image, 6, 64), INK_COLORS.ink, 30)).toBe(true);
    expect(near(pixel(image, 9, 64), INK_COLORS.ink, 30)).toBe(false);
  });
});
