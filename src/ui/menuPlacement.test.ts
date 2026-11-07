import { describe, expect, it } from 'vitest';
import { pickCornerAwayFromTile, placeMenuBesideTile } from './menuPlacement.ts';

const stage = { width: 600, height: 400 };
const menu = { width: 120, height: 150 };
const tileAt = (left: number, top: number, size = 64) => ({ left, top, right: left + size, bottom: top + size });

describe('placeMenuBesideTile', () => {
  it('opens to the right of the tile when there is room', () => {
    expect(placeMenuBesideTile(tileAt(100, 100), menu, stage)).toEqual({ side: 'right', left: 172, top: 100 });
  });

  it('opens to the left when the right side has no room', () => {
    expect(placeMenuBesideTile(tileAt(450, 100), menu, stage)).toEqual({ side: 'left', left: 322, top: 100 });
  });

  it('opens right when the menu exactly fits, gap included', () => {
    // 408 + 64 + 8 gap = 480; 480 + 120 = 600 would touch the edge, so the
    // last right-opening tile is the one leaving room for the edge gap too.
    expect(placeMenuBesideTile(tileAt(400, 100), menu, stage).side).toBe('right');
    expect(placeMenuBesideTile(tileAt(401, 100), menu, stage).side).toBe('left');
  });

  it('keeps a left-opening menu on the stage', () => {
    const narrow = { width: 200, height: 400 };
    expect(placeMenuBesideTile(tileAt(60, 100), menu, narrow)).toMatchObject({ side: 'left', left: 8 });
  });

  it('lines the top up with the tile, moving it up near the bottom edge', () => {
    expect(placeMenuBesideTile(tileAt(100, 0), menu, stage).top).toBe(8);
    expect(placeMenuBesideTile(tileAt(100, 330), menu, stage).top).toBe(400 - 8 - 150);
  });

  it('keeps the top visible when the menu is taller than the stage', () => {
    expect(placeMenuBesideTile(tileAt(100, 50), { width: 120, height: 500 }, stage).top).toBe(8);
  });

  it('uses the given gap', () => {
    expect(placeMenuBesideTile(tileAt(100, 100), menu, stage, 0)).toEqual({ side: 'right', left: 164, top: 100 });
  });

  it('keeps a top inset clear for a tab hanging off the menu', () => {
    // Near the top the menu drops below the inset; lower down it still lines up with the tile.
    expect(placeMenuBesideTile(tileAt(100, 0), menu, stage, 8, 22).top).toBe(30);
    expect(placeMenuBesideTile(tileAt(100, 100), menu, stage, 8, 22).top).toBe(100);
    // The bottom edge is unaffected.
    expect(placeMenuBesideTile(tileAt(100, 330), menu, stage, 8, 22).top).toBe(400 - 8 - 150);
  });

  describe('keeping off another window', () => {
    const rect = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom });

    it('stays put when the window is elsewhere', () => {
      const panel = rect(400, 0, 600, 200);
      expect(placeMenuBesideTile(tileAt(100, 100), menu, stage, 8, 0, panel)).toEqual({
        side: 'right',
        left: 172,
        top: 100,
      });
    });

    it("opens on the tile's other side when the usual one is covered", () => {
      expect(
        placeMenuBesideTile(tileAt(200, 50), { width: 120, height: 150 }, stage, 8, 0, rect(272, 0, 600, 300)),
      ).toEqual({
        side: 'left',
        left: 72,
        top: 50,
      });
    });

    it('slides below the window when the other side has no room', () => {
      const panel = rect(160, 0, 360, 180);
      expect(placeMenuBesideTile(tileAt(100, 50), menu, stage, 8, 0, panel)).toMatchObject({ side: 'right', top: 188 });
    });

    it('slides above the window when there is no room below', () => {
      const panel = rect(150, 200, 400, 400);
      expect(placeMenuBesideTile(tileAt(100, 300), menu, stage, 8, 0, panel)).toMatchObject({ side: 'right', top: 42 });
    });

    it('falls back to the usual spot when nothing clears the window', () => {
      const panel = rect(0, 0, 600, 400);
      expect(placeMenuBesideTile(tileAt(100, 100), menu, stage, 8, 0, panel)).toEqual({
        side: 'right',
        left: 172,
        top: 100,
      });
    });
  });
});

describe('pickCornerAwayFromTile', () => {
  const tileFrom = (left: number, right: number) => ({ left, top: 0.2, right, bottom: 0.3 });

  it('docks left with no tile', () => {
    expect(pickCornerAwayFromTile(null)).toBe('left');
  });

  it('docks right when the tile is in the left half', () => {
    expect(pickCornerAwayFromTile(tileFrom(0, 0.1))).toBe('right');
    expect(pickCornerAwayFromTile(tileFrom(0.4, 0.5))).toBe('right');
  });

  it('docks left when the tile is in the right half or centered', () => {
    expect(pickCornerAwayFromTile(tileFrom(0.9, 1))).toBe('left');
    expect(pickCornerAwayFromTile(tileFrom(0.45, 0.55))).toBe('left');
  });

  it('handles tiles partly off the canvas', () => {
    expect(pickCornerAwayFromTile(tileFrom(-0.05, 0.05))).toBe('right');
    expect(pickCornerAwayFromTile(tileFrom(0.98, 1.08))).toBe('left');
  });
});
