import { describe, expect, it } from 'vitest';
import { SPRITE_URLS } from '../assets/sprites.js';
import { ARROW_SPRITES, UI_SPRITES, UNIT_SPRITES } from './tileset.js';

describe('sprite keys', () => {
  it('names an image for every unit, UI element, and arrow piece', () => {
    const keys = [
      ...Object.values(UNIT_SPRITES),
      ...Object.values(UI_SPRITES),
      ...Object.values(ARROW_SPRITES),
    ];
    for (const key of keys) expect(SPRITE_URLS).toHaveProperty([key]);
  });

  it('gives each team its own sprite', () => {
    expect(UNIT_SPRITES.player).not.toBe(UNIT_SPRITES.enemy);
  });
});
