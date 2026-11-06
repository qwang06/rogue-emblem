import { describe, expect, it } from 'vitest';
import { GEAR_SOUNDS } from './soundKinds.ts';
import { SAMPLE_URLS } from './samples.ts';

describe('SAMPLE_URLS', () => {
  it('records every menu click and every gear sound, on and off', () => {
    expect(SAMPLE_URLS.button).toBeTruthy();
    for (const gear of GEAR_SOUNDS) {
      expect(SAMPLE_URLS[`equip-${gear}`], gear).toBeTruthy();
      expect(SAMPLE_URLS[`unequip-${gear}`], gear).toBeTruthy();
    }
  });
});
