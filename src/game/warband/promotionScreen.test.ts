import { describe, expect, it } from 'vitest';
import { Acolyte } from '../Acolyte.ts';
import { MASTER_SEAL } from '../items.ts';
import { PROMOTION_LEVEL } from '../promotions.ts';
import type { Unit } from '../Unit.ts';
import { Villager } from '../Villager.ts';
import {
  cancelPromotion,
  confirmPromotion,
  getPromotionOptions,
  isPromotionScreenDone,
  movePromotionCursor,
  openPromotionScreen,
  pointPromotionCursor,
} from './promotionScreen.ts';
import { createRun, type RunState } from './run.ts';

const SEAL = { itemId: MASTER_SEAL.id, quantity: 1 };

// Ada and Bryn at camp: villagers, whose first promotion is free, or with
// `acolytes`, acolytes, whose promotion to tier 3 needs a seal.
function campRun(seals = 1, acolytes = false): RunState {
  const Class = acolytes ? Acolyte : Villager;
  const run = createRun(
    3,
    new Map<string, Unit>([
      ['ada', new Class({ name: 'Ada', team: 'player' })],
      ['bryn', new Class({ name: 'Bryn', team: 'player' })],
    ]),
  );
  return {
    ...run,
    convoy: Array.from({ length: seals }, () => SEAL),
    roster: run.roster.map((unit) => ({ ...unit, level: PROMOTION_LEVEL })),
  };
}

describe('getPromotionOptions', () => {
  it('lists each unit’s four promotions, in roster order', () => {
    expect(getPromotionOptions(campRun()).map((option) => option.label)).toEqual([
      'Ada: Villager → Archer',
      'Ada: Villager → Soldier',
      'Ada: Villager → Vanguard',
      'Ada: Villager → Sapper',
      'Bryn: Villager → Archer',
      'Bryn: Villager → Soldier',
      'Bryn: Villager → Vanguard',
      'Bryn: Villager → Sapper',
    ]);
  });

  it('leaves a first promotion open without a seal', () => {
    expect(getPromotionOptions(campRun(0)).some((option) => option.disabled)).toBe(false);
  });

  it('disables a second promotion without a seal', () => {
    expect(getPromotionOptions(campRun(0, true)).every((option) => option.disabled)).toBe(true);
    expect(getPromotionOptions(campRun(1, true)).some((option) => option.disabled)).toBe(false);
  });
});

describe('the promotion screen', () => {
  it('moves and points the cursor, wrapping', () => {
    const open = openPromotionScreen(campRun());
    expect(movePromotionCursor(open, -1).menu.selectedIndex).toBe(7);
    expect(pointPromotionCursor(open, 2).menu.selectedIndex).toBe(2);
    expect(pointPromotionCursor(open, 9)).toBe(open);
  });

  it('promotes on confirm and drops that unit’s options', () => {
    const after = confirmPromotion(movePromotionCursor(openPromotionScreen(campRun(2)), 1));
    expect(after.run.roster[0].classId).toBe('soldier');
    expect(after.menu.actions.map((option) => option.promotionId)).toEqual(['archer', 'soldier', 'vanguard', 'sapper']);
    expect(after.menu.selectedIndex).toBe(1);
    expect(isPromotionScreenDone(after)).toBe(false);
  });

  it('is done once nobody is left to promote', () => {
    const once = confirmPromotion(openPromotionScreen(campRun(2)));
    const twice = confirmPromotion(once);
    expect(isPromotionScreenDone(twice)).toBe(true);
    expect(twice.run.roster.map((unit) => unit.classId)).toEqual(['archer', 'archer']);
  });

  it('does nothing on a disabled option', () => {
    const open = openPromotionScreen(campRun(0, true));
    expect(confirmPromotion(open)).toBe(open);
  });

  it('closes on cancel', () => {
    expect(cancelPromotion()).toBeNull();
  });
});
