import { describe, expect, it } from 'vitest';
import { Archer } from '../game/Archer.ts';
import { MASTER_SEAL } from '../game/items.ts';
import { PROMOTION_LEVEL } from '../game/promotions.ts';
import type { Unit } from '../game/Unit.ts';
import { Warrior } from '../game/Warrior.ts';
import { openPromotionScreen, pointPromotionCursor } from '../game/warband/promotionScreen.ts';
import { toPromotionScreenView } from './promotionView.ts';
import { createRun, type RunState } from '../game/warband/run.ts';

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

describe('toPromotionScreenView', () => {
  it('shows the seals and what the highlighted promotion does', () => {
    const view = toPromotionScreenView(pointPromotionCursor(openPromotionScreen(campRun()), 3));
    expect(view.seals).toBe(1);
    expect(view.options).toHaveLength(4);
    expect(view.detail).toMatchObject({
      name: 'Bryn',
      fromClass: 'Archer',
      toClass: 'Arbalest',
      movement: -1,
      weaponTypes: ['physical', 'siege'],
      skill: { label: 'Bombard', manaCost: 3, range: 3 },
      gift: 'Ballista',
      evolves: false,
    });
    expect(view.detail!.gains).toEqual([
      { label: 'HP', value: 5 },
      { label: 'STR', value: 3 },
      { label: 'DEF', value: 2 },
    ]);
  });

  it('flags a promotion that completes an evolution', () => {
    const run = campRun();
    const brawler = { ...run, roster: run.roster.map((u) => (u.id === 'ada' ? { ...u, boons: ['brawler'] } : u)) };
    const view = toPromotionScreenView(pointPromotionCursor(openPromotionScreen(brawler), 1));
    expect(view.detail?.toClass).toBe('Berserker');
    expect(view.detail?.evolves).toBe(true);
  });
});
