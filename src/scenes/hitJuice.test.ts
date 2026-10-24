import { describe, expect, it } from 'vitest';
import { CRIT_SHAKE, getLungeDistance, getStrikeJuice } from './hitJuice.ts';

describe('getStrikeJuice', () => {
  it('does nothing for a miss', () => {
    expect(getStrikeJuice({ hit: false, crit: false, lethal: false }, false)).toEqual({ hitStopMs: 0, shake: null });
  });

  it('freezes a plain hit briefly, without a shake', () => {
    const juice = getStrikeJuice({ hit: true, crit: false, lethal: false }, false);
    expect(juice.hitStopMs).toBeGreaterThan(0);
    expect(juice.shake).toBeNull();
  });

  it('freezes a crit longer and shakes the camera', () => {
    const hit = getStrikeJuice({ hit: true, crit: false, lethal: false }, false);
    const crit = getStrikeJuice({ hit: true, crit: true, lethal: false }, false);
    expect(crit.hitStopMs).toBeGreaterThan(hit.hitStopMs);
    expect(crit.shake).toEqual(CRIT_SHAKE);
  });

  it('holds a finishing blow longer and bumps the camera', () => {
    const hit = getStrikeJuice({ hit: true, crit: false, lethal: false }, false);
    const lethal = getStrikeJuice({ hit: true, crit: false, lethal: true }, false);
    expect(lethal.hitStopMs).toBeGreaterThan(hit.hitStopMs);
    expect(lethal.shake).not.toBeNull();
    expect(lethal.shake!.intensity).toBeLessThan(CRIT_SHAKE.intensity);
  });

  it('a lethal crit holds longest and shakes like a crit', () => {
    const crit = getStrikeJuice({ hit: true, crit: true, lethal: false }, false);
    const lethalCrit = getStrikeJuice({ hit: true, crit: true, lethal: true }, false);
    expect(lethalCrit.hitStopMs).toBeGreaterThan(crit.hitStopMs);
    expect(lethalCrit.shake).toEqual(CRIT_SHAKE);
  });

  it('never shakes with reduced motion, but keeps the freeze', () => {
    const normal = getStrikeJuice({ hit: true, crit: true, lethal: true }, false);
    const reduced = getStrikeJuice({ hit: true, crit: true, lethal: true }, true);
    expect(reduced.shake).toBeNull();
    expect(reduced.hitStopMs).toBe(normal.hitStopMs);
  });
});

describe('getLungeDistance', () => {
  it('lunges further at an adjacent target than a distant one', () => {
    expect(getLungeDistance(1, false)).toBeGreaterThan(getLungeDistance(2, false));
  });

  it('treats every distance past one tile as ranged', () => {
    expect(getLungeDistance(5, false)).toBe(getLungeDistance(2, false));
  });

  it('only nudges with reduced motion, at any range', () => {
    expect(getLungeDistance(1, true)).toBeLessThan(getLungeDistance(2, false));
    expect(getLungeDistance(1, true)).toBe(getLungeDistance(3, true));
  });
});
