import { describe, expect, it } from 'vitest';
import { getAccentWeight, recolorAccents } from './teamAccents.ts';

const pixel = (r: number, g: number, b: number, a = 255) => new Uint8ClampedArray([r, g, b, a]);

describe('getAccentWeight', () => {
  it('fully moves a saturated blue', () => {
    expect(getAccentWeight(220, 0.6)).toBe(1);
  });

  it('leaves grays, warm colors and greens alone', () => {
    expect(getAccentWeight(220, 0.05)).toBe(0);
    expect(getAccentWeight(20, 0.7)).toBe(0);
    expect(getAccentWeight(120, 0.7)).toBe(0);
  });

  it('fades in at the edges of the blue band', () => {
    const edge = getAccentWeight(192, 0.6);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(1);
  });
});

describe('recolorAccents', () => {
  it('turns blue red, keeping its brightness and alpha', () => {
    const [r, g, b, a] = recolorAccents(pixel(40, 80, 160, 200), 0);
    expect(r).toBe(160);
    expect(g).toBeLessThan(r);
    expect(b).toBeLessThan(r);
    expect(a).toBe(200);
  });

  it('turns blue green for a guest hue', () => {
    const [r, g, b] = recolorAccents(pixel(40, 80, 160), 130);
    expect(g).toBe(160);
    expect(r).toBeLessThan(g);
    expect(b).toBeLessThan(g);
  });

  it('leaves skin, leather, gray metal and transparent pixels as they are', () => {
    const pixels = new Uint8ClampedArray([
      ...[230, 190, 160, 255],
      ...[120, 80, 40, 255],
      ...[128, 130, 135, 255],
      ...[40, 80, 160, 0],
    ]);
    expect([...recolorAccents(pixels, 0)]).toEqual([...pixels]);
  });

  it('does not change the pixels it was given', () => {
    const pixels = pixel(40, 80, 160);
    recolorAccents(pixels, 0);
    expect([...pixels]).toEqual([40, 80, 160, 255]);
  });
});
