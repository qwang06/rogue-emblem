// How a battlefield's cells read as worn ground rather than lines on a
// board: each cell gets its own slight tone, a touch lighter or darker
// than its neighbours, like flagstones or trodden patches. Pure: the same
// grid and seed always give the same tones.

import { createSeededRng } from './rng.ts';

export interface CellTone {
  x: number;
  y: number;
  // White (lighter) or black (darker), laid over the cell at `alpha`.
  light: boolean;
  alpha: number;
}

// The strongest tint a cell gets, lighter or darker.
export const MAX_CELL_TONE = { dark: 0.07, light: 0.05 };

// Every cell's tone on a `width` by `height` grid from `seed`: random, with
// a faint checker so side-by-side cells tend to differ.
export function getCellTones(width: number, height: number, seed: number): CellTone[] {
  const rng = createSeededRng(seed);
  const tones: CellTone[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const checker = (x + y) % 2 === 0 ? 0.35 : -0.35;
      const t = Math.max(-1, Math.min(1, (rng() * 2 - 1) * 0.75 + checker));
      const light = t > 0;
      tones.push({ x, y, light, alpha: Math.abs(t) * (light ? MAX_CELL_TONE.light : MAX_CELL_TONE.dark) });
    }
  }
  return tones;
}
