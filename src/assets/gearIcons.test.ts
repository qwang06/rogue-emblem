import { describe, expect, it } from 'vitest';
import { SIGNATURE_GEAR } from '../game/gearKits.ts';
import { getItemSprite } from '../game/tileset.ts';
import { GEAR_ICON_URLS } from './sprites.ts';

describe('gear icons', () => {
  it('gives every piece of signature, cursed and monster gear its own icon, and has none left over', () => {
    const ids = SIGNATURE_GEAR.map((gear) => gear.id);
    expect(ids.filter((id) => getItemSprite(id) !== id || !GEAR_ICON_URLS[id])).toEqual([]);
    expect(Object.keys(GEAR_ICON_URLS).filter((id) => !ids.includes(id))).toEqual([]);
  });
});
