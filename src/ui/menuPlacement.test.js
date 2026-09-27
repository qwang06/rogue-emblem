import { describe, expect, it } from 'vitest';
import { placeMenuBesideTile } from './menuPlacement.js';

const stage = { width: 600, height: 400 };
const menu = { width: 120, height: 150 };
const tileAt = (left, top, size = 64) => ({ left, top, right: left + size, bottom: top + size });

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
});
