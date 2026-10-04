import { describe, expect, it } from 'vitest';
import { BUILDING_KINDS, type BuildingPlacement } from './buildings.ts';
import { getBuildingSprites, getFeatureSprites, getWallAutotile, pickVariant, type MapSprite } from './mapArt.ts';
import { parseTerrainMap } from './terrainMap.ts';
import {
  BUILDING_ART,
  BUILDING_PALETTES,
  DEFAULT_BUILDING_PALETTE,
  FOREST_ART,
  MOUNTAIN_ART,
  TERRAIN_SHEET,
  type BuildingPaletteName,
} from './tileset.ts';

const features = (rows: string[]) => getFeatureSprites(parseTerrainMap(rows), FOREST_ART, MOUNTAIN_ART);
const at = (sprites: readonly MapSprite[], x: number, y: number) => sprites.filter((s) => s.x === x && s.y === y);
const PALETTES = Object.keys(BUILDING_PALETTES) as BuildingPaletteName[];

describe('pickVariant', () => {
  it('is always the same in-range pick for a cell', () => {
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        const variant = pickVariant(x, y, 3);
        expect(variant).toBeGreaterThanOrEqual(0);
        expect(variant).toBeLessThan(3);
        expect(pickVariant(x, y, 3)).toBe(variant);
      }
    }
  });

  it('picks more than one variant across a map', () => {
    const picks = new Set(Array.from({ length: 64 }, (_, i) => pickVariant(i % 8, Math.floor(i / 8), 3)));
    expect(picks.size).toBe(3);
  });
});

describe('getFeatureSprites', () => {
  it('draws nothing on plain terrain', () => {
    expect(features(['.,~', '#".'])).toEqual([]);
  });

  it('draws a forest variant on each forest cell', () => {
    const sprites = features(['T.', '.T']);
    expect(sprites).toHaveLength(2);
    for (const { tile, layer } of sprites) {
      expect(FOREST_ART.tiles).toContainEqual(tile);
      expect(layer).toBe('ground');
    }
  });

  it('caps a lone mountain with a peak in the cell north of it', () => {
    const sprites = features(['.', '^']);
    expect(MOUNTAIN_ART.body).toContainEqual(at(sprites, 0, 1)[0].tile);
    expect(at(sprites, 0, 0)).toEqual([{ x: 0, y: 0, tile: expect.anything(), layer: 'cap' }]);
    expect(MOUNTAIN_ART.cap).toContainEqual(at(sprites, 0, 0)[0].tile);
  });

  it('stacks a column of mountains: peak-below bodies over the bottom one, one cap on top', () => {
    const sprites = features(['.', '^', '^', '^']);
    expect(MOUNTAIN_ART.peakBelow).toContainEqual(at(sprites, 0, 1)[0].tile);
    expect(MOUNTAIN_ART.peakBelow).toContainEqual(at(sprites, 0, 2)[0].tile);
    expect(MOUNTAIN_ART.body).toContainEqual(at(sprites, 0, 3)[0].tile);
    expect(sprites.filter((s) => s.layer === 'cap')).toEqual([expect.objectContaining({ x: 0, y: 0 })]);
  });

  it('bakes the peak into a forest north of a mountain instead of capping it', () => {
    const sprites = features(['T', '^']);
    expect(at(sprites, 0, 0)).toHaveLength(1);
    const forest = at(sprites, 0, 0)[0];
    expect(forest.layer).toBe('ground');
    expect(forest.tile).toEqual(FOREST_ART.peakBelow[pickVariant(0, 0, FOREST_ART.tiles.length)]);
  });

  it('leaves out the cap of a mountain on the top row', () => {
    const sprites = features(['^']);
    expect(sprites).toHaveLength(1);
    expect(sprites[0].layer).toBe('ground');
  });

  it('pins the sheet tiles of a small range under a forest', () => {
    expect(features(['T.', '^.', '^^'])).toEqual([
      { x: 0, y: 0, tile: [8, 1], layer: 'ground' },
      { x: 0, y: 1, tile: [7, 1], layer: 'ground' },
      { x: 0, y: 2, tile: [4, 1], layer: 'ground' },
      { x: 1, y: 2, tile: [8, 2], layer: 'ground' },
      { x: 1, y: 1, tile: [5, 0], layer: 'cap' },
    ]);
  });
});

describe('getBuildingSprites', () => {
  const sprites = (buildings: BuildingPlacement[], palette: BuildingPaletteName) =>
    getBuildingSprites(buildings, BUILDING_PALETTES[palette], BUILDING_ART);

  it('draws a stone house as one tile with no flag', () => {
    expect(sprites([{ x: 3, y: 4, building: 'house' }], 'a-stone')).toEqual([
      { x: 3, y: 4, tile: [0, 50], layer: 'ground' },
    ]);
  });

  it('flags a colored building from the cell north of it', () => {
    expect(sprites([{ x: 3, y: 4, building: 'farm' }], 'b-red')).toEqual([
      { x: 3, y: 4, tile: [19, 50], layer: 'ground' },
      { x: 3, y: 3, tile: [19, 49], layer: 'cap' },
    ]);
  });

  it('draws a tall building with its top over units and its flag above that', () => {
    expect(sprites([{ x: 3, y: 4, building: 'castle' }], 'a-teal')).toEqual([
      { x: 3, y: 4, tile: [14, 62], layer: 'ground' },
      { x: 3, y: 3, tile: [14, 61], layer: 'roof' },
      { x: 3, y: 2, tile: [14, 60], layer: 'cap' },
    ]);
  });

  it('leaves out pieces that would fall off the top of the map', () => {
    expect(sprites([{ x: 0, y: 0, building: 'tower' }], 'a-orange')).toEqual([
      { x: 0, y: 0, tile: [13, 59], layer: 'ground' },
    ]);
    expect(sprites([{ x: 0, y: 1, building: 'tower' }], 'a-orange')).toHaveLength(2);
  });

  it('draws every building of a palette in that palette, never another color', () => {
    for (const name of PALETTES) {
      const palette = BUILDING_PALETTES[name];
      const buildings = BUILDING_KINDS.map((building, i) => ({ x: i, y: 5, building }));
      for (const { tile } of getBuildingSprites(buildings, palette, BUILDING_ART)) {
        const [column, row] = tile;
        expect([0, 12].map((block) => block + palette.buildingColumn)).toContain(column);
        expect(row).toBeGreaterThanOrEqual(49);
        expect(row).toBeLessThan(TERRAIN_SHEET.rows);
      }
    }
  });
});

describe('building palettes', () => {
  it('has the five colors of each set, set A in columns 0–4 and set B in 6–10', () => {
    const columns = PALETTES.map((name) => BUILDING_PALETTES[name].buildingColumn).sort((a, b) => a - b);
    expect(columns).toEqual([0, 1, 2, 3, 4, 6, 7, 8, 9, 10]);
    for (const name of PALETTES) {
      const { buildingColumn, wall } = BUILDING_PALETTES[name];
      expect(name.startsWith('a-')).toBe(buildingColumn < 5);
      expect(wall[1]).toBe(name.startsWith('a-') ? 33 : 41);
    }
  });

  it('gives every palette its own wall group', () => {
    const walls = new Set(PALETTES.map((name) => BUILDING_PALETTES[name].wall.join(',')));
    expect(walls.size).toBe(PALETTES.length);
  });

  it('flags only the colored palettes', () => {
    for (const name of PALETTES) {
      expect(BUILDING_PALETTES[name].flags).toBe(name !== 'a-stone' && name !== 'b-white');
    }
  });

  it('defaults to set A stone', () => {
    expect(DEFAULT_BUILDING_PALETTE).toBe('a-stone');
  });
});

describe('getWallAutotile', () => {
  it('takes the notched 3x3 of the palette’s rampart group', () => {
    expect(getWallAutotile(BUILDING_PALETTES['a-stone'])).toEqual({ block: [1, 33], inner: [2, 34] });
    expect(getWallAutotile(BUILDING_PALETTES['b-red'])).toEqual({ block: [19, 41], inner: [20, 42] });
  });
});
