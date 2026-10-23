import { describe, expect, it } from 'vitest';
import { scrollCues, scrollTopToReveal } from './listScroll.ts';

describe('scrollTopToReveal', () => {
  it('leaves the scroll alone when the row is already in view', () => {
    expect(scrollTopToReveal(40, 80, 0, 240)).toBe(0);
    expect(scrollTopToReveal(200, 240, 0, 240)).toBe(0);
  });

  it('scrolls down just far enough to show a row below the window', () => {
    expect(scrollTopToReveal(240, 280, 0, 240)).toBe(40);
  });

  it('scrolls up to a row above the window', () => {
    expect(scrollTopToReveal(40, 80, 120, 240)).toBe(40);
  });

  it('jumps to the top when the cursor wraps to the first row', () => {
    expect(scrollTopToReveal(0, 40, 200, 240)).toBe(0);
  });

  it('shows the top of a row taller than the window', () => {
    expect(scrollTopToReveal(100, 400, 0, 240)).toBe(100);
    expect(scrollTopToReveal(100, 400, 300, 240)).toBe(100);
  });
});

describe('scrollCues', () => {
  it('shows neither when everything fits', () => {
    expect(scrollCues(0, 240, 200)).toEqual({ above: false, below: false });
    expect(scrollCues(0, 240, 240)).toEqual({ above: false, below: false });
  });

  it('shows only below at the top of a long list', () => {
    expect(scrollCues(0, 240, 320)).toEqual({ above: false, below: true });
  });

  it('shows both in the middle', () => {
    expect(scrollCues(40, 240, 320)).toEqual({ above: true, below: true });
  });

  it('shows only above at the bottom, with a pixel of slack', () => {
    expect(scrollCues(80, 240, 320)).toEqual({ above: true, below: false });
    expect(scrollCues(79.5, 240, 320)).toEqual({ above: true, below: false });
  });
});
