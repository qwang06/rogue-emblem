import { describe, expect, it } from 'vitest';
import { LADDER_ARMORS, LADDER_WEAPONS } from '../game/gearLadder.ts';
import { ITEM_SPRITES, getItemSprite } from '../game/tileset.ts';
import { LADDER_ICON_URLS, SPRITE_URLS } from './sprites.ts';

describe('gear ladder icons', () => {
  it('gives every rung of the ladder an icon of its own', () => {
    const items = [...LADDER_WEAPONS, ...LADDER_ARMORS];
    const icons = items.map((item) => getItemSprite(item.id));
    expect(items.filter((_, i) => !icons[i] || !SPRITE_URLS[icons[i]!]).map((item) => item.id)).toEqual([]);
    expect(new Set(icons).size).toBe(items.length);
  });

  it('has no ladder icon without an item that shows it', () => {
    const shown = new Set(Object.values(ITEM_SPRITES));
    expect(Object.keys(LADDER_ICON_URLS).filter((id) => !shown.has(id))).toEqual([]);
  });
});
