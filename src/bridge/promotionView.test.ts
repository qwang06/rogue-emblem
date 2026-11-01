import { describe, expect, it } from 'vitest';
import { Archer } from '../game/Archer.ts';
import { MASTER_SEAL } from '../game/items.ts';
import { PROMOTION_LEVEL } from '../game/promotions.ts';
import type { Unit } from '../game/Unit.ts';
import { Villager } from '../game/Villager.ts';
import { openPromotionScreen, pointPromotionCursor } from '../game/warband/promotionScreen.ts';
import { toPromotionScreenView } from './promotionView.ts';
import { createRun, type RunState } from '../game/warband/run.ts';

const SEAL = { itemId: MASTER_SEAL.id, quantity: 1 };

function campRun(seals = 1): RunState {
  const run = createRun(
    3,
    new Map<string, Unit>([
      ['ada', new Villager({ name: 'Ada', team: 'player' })],
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
    // Bryn the archer has already promoted, so only Ada's four show.
    expect(view.detail).toMatchObject({
      name: 'Ada',
      fromClass: 'Villager',
      toClass: 'Sapper',
      movement: 0,
      weaponTypes: ['physical', 'siege'],
      skill: { label: 'Blast', manaCost: 3, range: 2 },
      passive: { name: 'Demolitions', description: '+5 crit.' },
      gift: 'Powder Keg',
      evolves: false,
    });
    expect(view.detail!.gains).toEqual([{ label: 'STR', value: 1 }]);
  });

  it('flags a promotion that completes an evolution', () => {
    const run = campRun();
    const brawler = { ...run, roster: run.roster.map((u) => (u.id === 'ada' ? { ...u, boons: ['brawler'] } : u)) };
    const view = toPromotionScreenView(pointPromotionCursor(openPromotionScreen(brawler), 2));
    expect(view.detail?.toClass).toBe('Vanguard');
    expect(view.detail?.evolves).toBe(true);
  });
});
