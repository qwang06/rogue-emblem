import { describe, expect, it } from 'vitest';
import { BATTLEFIELD_KITS, KIT_URLS } from './battlefieldKits.ts';

describe('BATTLEFIELD_KITS', () => {
  it('has an image for every piece of every kit', () => {
    for (const kit of Object.values(BATTLEFIELD_KITS)) {
      const pieces = [kit.ground, kit.horizon, ...kit.patches.map((p) => p.texture), ...kit.decals, ...kit.trees, ...(kit.treesRight ?? []), ...kit.bushes, ...(kit.foreground ? [kit.foreground.left, kit.foreground.right] : [])];
      for (const { key, size } of pieces) {
        expect(KIT_URLS[key], key).toBeTruthy();
        expect(size[0]).toBeGreaterThan(0);
        expect(size[1]).toBeGreaterThan(0);
      }
    }
  });
});
