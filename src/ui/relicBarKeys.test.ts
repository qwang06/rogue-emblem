import { describe, expect, it } from 'vitest';
import { stepRelicBar } from './relicBarKeys.ts';

describe('stepRelicBar', () => {
  it('opens on Q, either case, on the relic it last showed', () => {
    expect(stepRelicBar(false, 2, 4, 'q')).toEqual({ open: true, index: 2 });
    expect(stepRelicBar(false, 0, 4, 'Q')).toEqual({ open: true, index: 0 });
  });

  it('lets other keys through while closed', () => {
    expect(stepRelicBar(false, 0, 4, 'ArrowLeft')).toBeNull();
    expect(stepRelicBar(false, 0, 4, 'Escape')).toBeNull();
  });

  it('steps through the relics, wrapping at the ends', () => {
    expect(stepRelicBar(true, 0, 3, 'ArrowRight')).toEqual({ open: true, index: 1 });
    expect(stepRelicBar(true, 2, 3, 'ArrowRight')).toEqual({ open: true, index: 0 });
    expect(stepRelicBar(true, 0, 3, 'ArrowLeft')).toEqual({ open: true, index: 2 });
    expect(stepRelicBar(true, 1, 3, 'ArrowUp')).toEqual({ open: true, index: 0 });
    expect(stepRelicBar(true, 1, 3, 'ArrowDown')).toEqual({ open: true, index: 2 });
    expect(stepRelicBar(true, 1, 3, 'Home')).toEqual({ open: true, index: 0 });
    expect(stepRelicBar(true, 1, 3, 'End')).toEqual({ open: true, index: 2 });
  });

  it('closes on Q, Esc, X, Enter or Z', () => {
    for (const key of ['q', 'Q', 'Escape', 'x', 'X', 'Enter', 'z']) {
      expect(stepRelicBar(true, 1, 3, key)).toEqual({ open: false });
    }
  });

  it('swallows any other key while open, staying put', () => {
    expect(stepRelicBar(true, 1, 3, 'a')).toEqual({ open: true, index: 1 });
  });

  it('keeps the index on the bar when the relics shrank', () => {
    expect(stepRelicBar(false, 5, 2, 'q')).toEqual({ open: true, index: 1 });
    expect(stepRelicBar(true, 5, 2, 'ArrowRight')).toEqual({ open: true, index: 0 });
  });

  it('never opens on no relics, and closes if they ran out', () => {
    expect(stepRelicBar(false, 0, 0, 'q')).toBeNull();
    expect(stepRelicBar(true, 0, 0, 'ArrowRight')).toEqual({ open: false });
  });
});
