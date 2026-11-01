// Turns a unit's blue accents (cloaks, tabards, shield faces) to its team's
// hue, so an enemy soldier painted in the player's blue reads as an enemy.
// Only clearly blue, clearly colored pixels move: grays, skin, leather and
// metal stay as painted, and the edges of the blue band fade in so a
// blue-green or violet shade blends rather than snaps.

// The blue band, in degrees of hue: fully moved inside [CORE_FROM, CORE_TO],
// fading to untouched at [EDGE_FROM, EDGE_TO].
const EDGE_FROM = 185;
const CORE_FROM = 200;
const CORE_TO = 240;
const EDGE_TO = 255;
// Saturation below which a pixel counts as gray (untouched), fading in up to
// FULL_SATURATION.
const MIN_SATURATION = 0.12;
const FULL_SATURATION = 0.22;

function ramp(value: number, from: number, to: number): number {
  return Math.min(1, Math.max(0, (value - from) / (to - from)));
}

// How much of a pixel's color (hue in degrees, saturation 0..1) counts as a
// blue accent: 0 (untouched) to 1 (fully recolored).
export function getAccentWeight(hue: number, saturation: number): number {
  const band = Math.min(ramp(hue, EDGE_FROM, CORE_FROM), 1 - ramp(hue, CORE_TO, EDGE_TO));
  return band * ramp(saturation, MIN_SATURATION, FULL_SATURATION);
}

function toHsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  let hue = 0;
  if (delta > 0) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
  }
  return [(hue * 60 + 360) % 360, max === 0 ? 0 : delta / max, max];
}

function fromHsv(hue: number, saturation: number, value: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + hue / 60) % 6;
    return value - value * saturation * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

// A copy of RGBA pixels (as ImageData holds them) with the blue accents
// turned to `hue` (degrees), keeping each pixel's saturation, brightness
// and alpha.
export function recolorAccents(pixels: Uint8ClampedArray, hue: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(pixels);
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] === 0) continue;
    const [r, g, b] = [out[i], out[i + 1], out[i + 2]];
    const [h, s, v] = toHsv(r, g, b);
    const weight = getAccentWeight(h, s);
    if (weight === 0) continue;
    const [nr, ng, nb] = fromHsv(hue, s, v);
    out[i] = Math.round(r + (nr - r) * weight);
    out[i + 1] = Math.round(g + (ng - g) * weight);
    out[i + 2] = Math.round(b + (nb - b) * weight);
  }
  return out;
}
