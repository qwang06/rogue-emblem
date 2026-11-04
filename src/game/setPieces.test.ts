import { describe, expect, it } from 'vitest';
import { createGrid, setTerrain, setUnit } from './grid.ts';
import {
  canPlacePiece,
  checkSetPiece,
  drawSetPieces,
  getPieceArea,
  getPieceCenter,
  getPieceOrigins,
  getPieceTiles,
  getSeasonPieces,
  getSetPieceCount,
  mirrorPiece,
  stampPiece,
  type PieceLimits,
  type SetPiece,
} from './setPieces.ts';
import { createSeededRng } from './rng.ts';

const piece = (rows: string[], extra: Partial<SetPiece> = {}): SetPiece => ({
  name: 'Test',
  role: 'cover',
  rows,
  ...extra,
});

const NONE: PieceLimits = { blocked: new Set(), nearRoutes: new Set(), covered: new Set() };

describe('getPieceTiles', () => {
  it('reads terrain and buildings, leaving out `?`', () => {
    expect(getPieceTiles(piece(['?.', '~h']))).toEqual([
      { x: 1, y: 0, terrain: 'grass' },
      { x: 0, y: 1, terrain: 'water' },
      { x: 1, y: 1, terrain: 'grass', building: 'house' },
    ]);
  });
});

describe('mirrorPiece', () => {
  it('flips the rows west to east, keeping the rest', () => {
    expect(mirrorPiece(piece(['#.?', 'T~h'], { seasons: ['winter'] }))).toEqual(
      piece(['?.#', 'h~T'], { seasons: ['winter'] }),
    );
  });
});

describe('checkSetPiece', () => {
  it('accepts a well-formed piece', () => {
    expect(() => checkSetPiece(piece(['.p.', '...', 'Th~']))).not.toThrow();
  });

  it('names what is wrong', () => {
    expect(() => checkSetPiece(piece(['..'], { name: '' }))).toThrow(/needs a name/);
    expect(() => checkSetPiece(piece(['..'], { role: 'lair' as SetPiece['role'] }))).toThrow(/unknown role "lair"/);
    expect(() => checkSetPiece(piece([]))).toThrow(/no rows/);
    expect(() => checkSetPiece(piece(['..', '.']))).toThrow(/row 1 is 1 wide, expected 2/);
    expect(() => checkSetPiece(piece(['.Q']))).toThrow(/"Q", which isn't in the legend/);
    expect(() => checkSetPiece(piece(['??']))).toThrow(/only has "\?" tiles/);
  });

  it('needs open ground north of a building for its flag, and two rows for a tall one', () => {
    expect(() => checkSetPiece(piece(['#', 'h']))).toThrow(/building at \(0, 1\) needs open ground/);
    expect(() => checkSetPiece(piece(['"', 'h']))).not.toThrow();
    expect(() => checkSetPiece(piece(['h']))).not.toThrow();
    expect(() => checkSetPiece(piece(['#', '.', 'p']))).toThrow(/building at \(0, 2\)/);
    expect(() => checkSetPiece(piece(['?', '.', 'p']))).not.toThrow();
  });
});

describe('getSeasonPieces', () => {
  it('keeps the pieces for the season, and those for every season', () => {
    const any = piece(['.'], { name: 'Any' });
    const snowy = piece(['.'], { name: 'Snowy', seasons: ['winter'] });
    expect(getSeasonPieces([any, snowy], 'winter')).toEqual([any, snowy]);
    expect(getSeasonPieces([any, snowy], 'summer')).toEqual([any]);
  });
});

describe('getSetPieceCount', () => {
  it('gives one piece per 45 tiles or so, at least one', () => {
    expect(getSetPieceCount(4, 4)).toBe(1);
    expect(getSetPieceCount(8, 8)).toBe(1);
    expect(getSetPieceCount(12, 9)).toBe(2);
    expect(getSetPieceCount(14, 10)).toBe(3);
  });
});

describe('canPlacePiece', () => {
  const grid = createGrid(6, 5, 'grass');

  it('fits on open grass inside the map', () => {
    expect(canPlacePiece(grid, piece(['T~', '..']), { x: 1, y: 1 }, NONE)).toBe(true);
    expect(canPlacePiece(grid, piece(['T~', '..']), { x: 5, y: 1 }, NONE)).toBe(false);
    expect(canPlacePiece(grid, piece(['T~', '..']), { x: 1, y: 4 }, NONE)).toBe(false);
  });

  it('stays off blocked tiles, units and other terrain, but `?` tiles can go anywhere', () => {
    const blocked = { ...NONE, blocked: new Set(['2,1']) };
    expect(canPlacePiece(grid, piece(['T~']), { x: 1, y: 1 }, blocked)).toBe(false);
    expect(canPlacePiece(grid, piece(['T?']), { x: 1, y: 1 }, blocked)).toBe(true);
    expect(canPlacePiece(setUnit(grid, 1, 1, 'hero'), piece(['T']), { x: 1, y: 1 }, NONE)).toBe(false);
    expect(canPlacePiece(setTerrain(grid, 1, 1, 'water'), piece(['T']), { x: 1, y: 1 }, NONE)).toBe(false);
  });

  it('lets open ground run over the road, but not walls, water or buildings', () => {
    const road = setTerrain(grid, 2, 2, 'dirt');
    expect(canPlacePiece(road, piece(['T']), { x: 2, y: 2 }, NONE)).toBe(true);
    expect(canPlacePiece(road, piece(['#']), { x: 2, y: 2 }, NONE)).toBe(false);
    expect(canPlacePiece(road, piece(['h']), { x: 2, y: 2 }, NONE)).toBe(false);
  });

  it('keeps impassable tiles off the road’s margin', () => {
    const near = { ...NONE, nearRoutes: new Set(['2,2']) };
    expect(canPlacePiece(grid, piece(['^']), { x: 2, y: 2 }, near)).toBe(false);
    expect(canPlacePiece(grid, piece(['T']), { x: 2, y: 2 }, near)).toBe(true);
  });

  it('keeps walls off the west and east columns', () => {
    expect(canPlacePiece(grid, piece(['#']), { x: 0, y: 2 }, NONE)).toBe(false);
    expect(canPlacePiece(grid, piece(['#']), { x: 5, y: 2 }, NONE)).toBe(false);
    expect(canPlacePiece(grid, piece(['#']), { x: 3, y: 2 }, NONE)).toBe(true);
  });

  it('needs room on the map, out of other art, for a building’s flag and a tall top', () => {
    expect(canPlacePiece(grid, piece(['h']), { x: 2, y: 0 }, NONE)).toBe(false);
    expect(canPlacePiece(grid, piece(['h']), { x: 2, y: 1 }, NONE)).toBe(true);
    expect(canPlacePiece(grid, piece(['p']), { x: 2, y: 1 }, NONE)).toBe(false);
    expect(canPlacePiece(grid, piece(['p']), { x: 2, y: 2 }, NONE)).toBe(true);
    const covered = { ...NONE, covered: new Set(['2,0']) };
    expect(canPlacePiece(grid, piece(['p']), { x: 2, y: 2 }, covered)).toBe(false);
  });
});

describe('getPieceOrigins', () => {
  it('lists every corner the piece fits at, west to east, north to south', () => {
    const grid = setTerrain(createGrid(3, 2, 'grass'), 0, 0, 'water');
    expect(getPieceOrigins(grid, piece(['TT']), NONE)).toEqual([
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ]);
  });
});

describe('getPieceCenter', () => {
  it('is the middle tile, rounding toward the corner', () => {
    expect(getPieceCenter(piece(['...', '...', '...']), { x: 2, y: 3 })).toEqual({ x: 3, y: 4 });
    expect(getPieceCenter(piece(['....', '....']), { x: 0, y: 0 })).toEqual({ x: 1, y: 0 });
  });
});

describe('stampPiece', () => {
  it('places the tiles and buildings on the map, leaving the road as it is', () => {
    const grid = setTerrain(createGrid(4, 4, 'grass'), 2, 2, 'dirt');
    expect(stampPiece(grid, piece(['T?', 'hT']), { x: 1, y: 1 })).toEqual({
      tiles: [
        { x: 1, y: 1, terrain: 'forest' },
        { x: 1, y: 2, terrain: 'grass', building: 'house' },
      ],
      buildings: [{ x: 1, y: 2, building: 'house' }],
    });
  });
});

describe('drawSetPieces', () => {
  const pieces = ['.', '..', '...', '....'].map((row, i) => piece([row], { name: `P${i}` }));

  it('draws different pieces, biggest first, up to the count', () => {
    const drawn = drawSetPieces(pieces, 3, createSeededRng(4));
    expect(drawn).toHaveLength(3);
    expect(new Set(drawn.map((p) => p.name)).size).toBe(3);
    const areas = drawn.map(getPieceArea);
    expect(areas).toEqual([...areas].sort((a, b) => b - a));
    expect(drawSetPieces(pieces, 10, createSeededRng(4))).toHaveLength(4);
  });

  it('mirrors some pieces and not others', () => {
    const lopsided = piece(['#..'], { name: 'L' });
    const rows = new Set(
      Array.from({ length: 20 }, (_, seed) => drawSetPieces([lopsided], 1, createSeededRng(seed))[0].rows[0]),
    );
    expect(rows).toEqual(new Set(['#..', '..#']));
  });
});
