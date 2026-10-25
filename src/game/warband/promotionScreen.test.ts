import { describe, expect, it } from 'vitest';
import { Archer } from '../Archer.ts';
import { MASTER_SEAL } from '../items.ts';
import { PROMOTION_LEVEL } from '../promotions.ts';
import type { Unit } from '../Unit.ts';
import { Warrior } from '../Warrior.ts';
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

function campRun(seals = 1): RunState {
  const run = createRun(
    3,
    new Map<string, Unit>([
      ['ada', new Warrior({ name: 'Ada', team: 'player' })],
      ['bryn', new Archer({ name: 'Bryn', team: 'player' })],
    ]),
  );
  return {
    ...run,
    convoy: Array.from({ length: seals }, () => SEAL),
    roster: run.roster.map((unit) => ({ ...unit, level: PROMOTION_LEVEL })),
  };
}

describe('getPromotionOptions', () => {
  it('lists each unit’s two promotions, in roster order', () => {
    expect(getPromotionOptions(campRun()).map((option) => option.label)).toEqual([
      'Ada: Warrior → Hero',
      'Ada: Warrior → Berserker',
      'Bryn: Archer → Sniper',
      'Bryn: Archer → Arbalest',
    ]);
  });

  it('disables every option without a seal', () => {
    expect(getPromotionOptions(campRun(0)).every((option) => option.disabled)).toBe(true);
    expect(getPromotionOptions(campRun(1)).some((option) => option.disabled)).toBe(false);
  });
});

describe('the promotion screen', () => {
  it('moves and points the cursor, wrapping', () => {
    const open = openPromotionScreen(campRun());
    expect(movePromotionCursor(open, -1).menu.selectedIndex).toBe(3);
    expect(pointPromotionCursor(open, 2).menu.selectedIndex).toBe(2);
    expect(pointPromotionCursor(open, 9)).toBe(open);
  });

  it('promotes on confirm and drops that unit’s options', () => {
    const after = confirmPromotion(movePromotionCursor(openPromotionScreen(campRun(2)), 1));
    expect(after.run.roster[0].classId).toBe('berserker');
    expect(after.menu.actions.map((option) => option.promotionId)).toEqual(['sniper', 'arbalest']);
    expect(after.menu.selectedIndex).toBe(1);
    expect(isPromotionScreenDone(after)).toBe(false);
  });

  it('is done once nobody is left to promote', () => {
    const once = confirmPromotion(openPromotionScreen(campRun(2)));
    const twice = confirmPromotion(once);
    expect(isPromotionScreenDone(twice)).toBe(true);
    expect(twice.run.roster.map((unit) => unit.classId)).toEqual(['hero', 'sniper']);
  });

  it('does nothing on a disabled option', () => {
    const open = openPromotionScreen(campRun(0));
    expect(confirmPromotion(open)).toBe(open);
  });

  it('closes on cancel', () => {
    expect(cancelPromotion()).toBeNull();
  });
});
