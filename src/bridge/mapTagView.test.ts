import { describe, expect, it } from 'vitest';
import type { PushResult } from '../game/push.ts';
import { HAZARDS, SPIKES } from '../game/hazards.ts';
import { describePush, toIntentTagView, toPushTagView } from './mapTagView.ts';

const anchor = { left: 0.2, top: 0.4, right: 0.3, bottom: 0.5 };

const slide: PushResult = {
  unitId: 'foe',
  from: { x: 1, y: 1 },
  direction: { x: 1, y: 0 },
  to: { x: 2, y: 1 },
  moved: true,
  blocked: null,
  damage: 0,
  collidedId: null,
  collisionDamage: 0,
  hazard: null,
  drowned: false,
};

describe('toIntentTagView', () => {
  it("pins the threatened HP on the tile's top edge", () => {
    const tag = toIntentTagView({ unitId: 'hero', at: { x: 0, y: 0 }, damage: 6, attackers: 1, lethal: false }, anchor);
    expect(tag).toEqual({ id: 'intent-hero', x: 0.25, y: 0.4, text: '-6', tone: 'threat' });
  });

  it('calls out a threat that would fell the unit', () => {
    const tag = toIntentTagView({ unitId: 'hero', at: { x: 0, y: 0 }, damage: 12, attackers: 2, lethal: true }, anchor);
    expect(tag).toMatchObject({ text: '-12 KO', tone: 'lethal' });
  });
});

describe('describePush', () => {
  it('reads a plain slide as a shove', () => {
    expect(describePush(slide, 20)).toEqual({ text: 'Shove', tone: 'push' });
  });

  it('reads drowning as lethal', () => {
    expect(describePush({ ...slide, hazard: HAZARDS.water, drowned: true }, 20)).toEqual({
      text: 'Drowns!',
      tone: 'lethal',
    });
  });

  it('names spikes and bumps with their damage, KO when it fells the unit', () => {
    expect(describePush({ ...slide, hazard: HAZARDS[SPIKES], damage: 5 }, 20)).toEqual({
      text: 'Spikes -5',
      tone: 'hazard',
    });
    expect(describePush({ ...slide, moved: false, blocked: 'edge', damage: 2 }, 2)).toEqual({
      text: 'Bump -2 KO',
      tone: 'lethal',
    });
    expect(describePush({ ...slide, blocked: 'unit', damage: 2, collidedId: 'other' }, 9).text).toBe('Bump both -2');
  });

  it("says when the unit won't budge", () => {
    expect(describePush({ ...slide, moved: false, blocked: 'steadfast' }, 20).text).toBe("Won't budge");
  });
});

describe('toPushTagView', () => {
  it('pins the description over the tile', () => {
    expect(toPushTagView(slide, 20, anchor)).toEqual({ id: 'push', x: 0.25, y: 0.4, text: 'Shove', tone: 'push' });
  });
});
