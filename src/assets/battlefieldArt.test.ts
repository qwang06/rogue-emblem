import { describe, expect, it } from 'vitest';
import { BATTLEFIELD_SIZE } from '../game/battlefields.ts';
import { CELL } from '../game/tileset.ts';
import { BATTLEFIELD_PAINTINGS } from './battlefieldArt.ts';

describe('BATTLEFIELD_PAINTINGS', () => {
  it('leaves each painting’s field inside the picture, shaped like a battlefield of cells', () => {
    const floor = { width: BATTLEFIELD_SIZE.width * CELL.width, height: BATTLEFIELD_SIZE.height * CELL.height };
    for (const { size, field } of Object.values(BATTLEFIELD_PAINTINGS)) {
      const [x, y, width, height] = field;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + width).toBeLessThanOrEqual(size[0]);
      expect(y + height).toBeLessThanOrEqual(size[1]);
      // Within a picture pixel of the floor's shape.
      expect(Math.abs(height - (width * floor.height) / floor.width)).toBeLessThanOrEqual(1);
    }
  });
});
