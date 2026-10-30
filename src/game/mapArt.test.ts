import { describe, expect, it } from 'vitest';
import { BUILDING_KINDS, type BuildingPlacement } from './buildings.ts';
import {
  getBuildingSprites,
  getCrossingSprites,
  getFeatureSprites,
  getHazardSprites,
  getWallAutotile,
  pickVariant,
  type MapSprite,
} from './mapArt.ts';
import { parseTerrainMap } from './terrainMap.ts';
import { createGrid, setTerrain } from './grid.ts';
import {
  BRIDGE_ART,
  BUILDING_ART,
  BUILDING_PALETTES,
  FORD_ART,
  GATE_ART,
  MAP_PROPS_SHEET,
  DEFAULT_BUILDING_PALETTE,
  FOREST_ART,
  MOUNTAIN_ART,
  SPIKES_ART,
  TERRAIN64_PROPS_SHEET,
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

  it('draws a mountain variant on each mountain cell, with nothing spilling north', () => {
    const sprites = features(['.', '^', '^']);
    expect(sprites.map(({ x, y }) => [x, y])).toEqual([
      [0, 1],
      [0, 2],
    ]);
    for (const { tile } of sprites) expect(MOUNTAIN_ART.tiles).toContainEqual(tile);
  });

  it('pins the prop sheet tiles', () => {
    const sheet = TERRAIN64_PROPS_SHEET;
    expect(features(['T^'])).toEqual([
      { x: 0, y: 0, tile: FOREST_ART.tiles[pickVariant(0, 0, 3)], layer: 'ground', sheet },
      { x: 1, y: 0, tile: MOUNTAIN_ART.tiles[pickVariant(1, 0, 2)], layer: 'ground', sheet },
    ]);
    expect(FOREST_ART.tiles).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
    ]);
    expect(MOUNTAIN_ART.tiles).toEqual([
      [3, 0],
      [4, 0],
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
  it('takes the notched 3x3 of the palette’s rampart group, running on through gates', () => {
    expect(getWallAutotile(BUILDING_PALETTES['a-stone'])).toEqual({ block: [1, 33], inner: [2, 34], joins: ['gate'] });
    expect(getWallAutotile(BUILDING_PALETTES['b-red'])).toEqual({ block: [19, 41], inner: [20, 42], joins: ['gate'] });
  });
});

describe('getHazardSprites', () => {
  it('lays a spike trap on each spikes cell, off the props sheet', () => {
    let grid = createGrid(3, 2, 'grass');
    grid = setTerrain(grid, 2, 1, 'spikes');
    expect(getHazardSprites(grid, SPIKES_ART, MAP_PROPS_SHEET)).toEqual([
      { x: 2, y: 1, tile: SPIKES_ART, layer: 'ground', sheet: MAP_PROPS_SHEET },
    ]);
    expect(getHazardSprites(createGrid(2, 2, 'grass'), SPIKES_ART, MAP_PROPS_SHEET)).toEqual([]);
  });
});

describe('getCrossingSprites', () => {
  const sprites = (rows: string[], palette: BuildingPaletteName = 'a-stone') =>
    getCrossingSprites(parseTerrainMap(rows), BRIDGE_ART, GATE_ART[palette], FORD_ART, MAP_PROPS_SHEET);

  it('runs a bridge north–south across a river running west–east, and west–east across a channel', () => {
    expect(sprites(['~=~', '~=~'])).toEqual([
      { x: 1, y: 0, tile: BRIDGE_ART.vertical, layer: 'ground', sheet: BRIDGE_ART.sheet },
      { x: 1, y: 1, tile: BRIDGE_ART.vertical, layer: 'ground', sheet: BRIDGE_ART.sheet },
    ]);
    expect(sprites(['.~.', '.=.', '.~.'])).toEqual([
      { x: 1, y: 1, tile: BRIDGE_ART.horizontal, layer: 'ground', sheet: BRIDGE_ART.sheet },
    ]);
    // Bridge beside bridge (a two-wide channel's) isn't water either side.
    expect(sprites(['.~~.', '.==.']).map((s) => s.tile)).toEqual([BRIDGE_ART.horizontal, BRIDGE_ART.horizontal]);
  });

  it('lays stepping stones on a ford, off the props sheet', () => {
    expect(sprites(['~_~'])).toEqual([{ x: 1, y: 0, tile: FORD_ART, layer: 'ground', sheet: MAP_PROPS_SHEET }]);
  });

  it('draws a gate’s posts under units and its lintel over them, in the palette’s colors', () => {
    expect(sprites(['.#+#.'], 'b-red')).toEqual([
      { x: 2, y: 0, tile: GATE_ART['b-red'].posts, layer: 'ground', sheet: MAP_PROPS_SHEET },
      { x: 2, y: 0, tile: GATE_ART['b-red'].lintel, layer: 'roof', sheet: MAP_PROPS_SHEET },
    ]);
  });

  it('draws nothing on a map without crossings', () => {
    expect(sprites(['.~#', 'T^,'])).toEqual([]);
  });
});

describe('GATE_ART', () => {
  it('has a gateway for every palette, each its own column of the props sheet', () => {
    const columns = Object.keys(BUILDING_PALETTES).map((name) => GATE_ART[name as BuildingPaletteName].posts[0]);
    expect(new Set(columns).size).toBe(columns.length);
    for (const { posts, lintel } of Object.values(GATE_ART)) {
      expect(lintel).toEqual([posts[0], 1]);
      expect(posts[0]).toBeLessThan(MAP_PROPS_SHEET.columns);
    }
    expect(FORD_ART[0]).toBeLessThan(MAP_PROPS_SHEET.columns);
  });
});
