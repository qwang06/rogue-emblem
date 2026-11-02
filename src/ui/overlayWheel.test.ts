import { describe, expect, it } from 'vitest';
import { wheelPixels } from './overlayWheel.ts';

describe('wheelPixels', () => {
  it('keeps a pixel delta as is', () => {
    expect(wheelPixels(120, 0, 500)).toBe(120);
  });

  it('turns lines into pixels', () => {
    expect(wheelPixels(3, 1, 500)).toBe(48);
  });

  it('turns pages into the scroll box height', () => {
    expect(wheelPixels(-1, 2, 500)).toBe(-500);
  });

  it('keeps no scroll as none', () => {
    expect(wheelPixels(0, 1, 500)).toBe(0);
  });
});
