import { describe, expect, it } from 'vitest';
import { Archer } from '../game/Archer.ts';
import { Soldier } from '../game/Soldier.ts';
import { findBoon } from '../game/warband/boons.ts';
import { getBoonOffer, queueLevelUpBoons } from '../game/warband/levelUpPicks.ts';
import { createRun } from '../game/warband/run.ts';
import { toBoonPickView } from './boonPickView.ts';

function soldierRun() {
  return createRun(1, new Map([['alden', new Soldier({ name: 'Alden', team: 'player' })]]));
}

describe('toBoonPickView', () => {
  it('names whose level up it is, with their sprite and stats', () => {
    const run = soldierRun();
    const owing = queueLevelUpBoons(run, { ...run, roster: [{ ...run.roster[0], level: 2 }] });
    const view = toBoonPickView(getBoonOffer(owing)!);
    const unit = owing.roster[0];
    expect(view).toMatchObject({
      key: 'alden-2',
      name: 'Alden',
      classLabel: 'Soldier',
      sprite: 'Soldier_03',
      level: 2,
    });
    expect(view.stats.map((stat) => [stat.label, stat.value])).toEqual([
      ['HP', unit.maxHealth],
      ['STR', unit.strength],
      ['MAG', unit.magic],
      ['SKL', unit.skill],
      ['SPD', unit.speed],
      ['LCK', unit.luck],
      ['DEF', unit.defense],
      ['RES', unit.resistance],
    ]);
    expect(Object.isFrozen(view)).toBe(true);
  });

  it('lists each boon in the offer, in order, with what a stat boon raises', () => {
    const unit = soldierRun().roster[0];
    const offer = { unit, level: 2, boons: [findBoon('stat-health')!, findBoon('skill-cleave')!, findBoon('fleet')!] };
    const view = toBoonPickView(offer);
    expect(view.boons.map((boon) => [boon.id, boon.kind, boon.name])).toEqual([
      ['stat-health', 'stat', 'Vigor'],
      ['skill-cleave', 'skill', 'Learn Cleave'],
      ['fleet', 'passive', 'Fleet'],
    ]);
    expect(view.boons.map((boon) => boon.gain)).toEqual([{ stat: 'health', amount: 4 }, null, null]);
  });

  it("cuts a stat boon's raise to the class's cap", () => {
    const unit = { ...soldierRun().roster[0], speed: 1000 };
    const view = toBoonPickView({ unit, level: 2, boons: [findBoon('stat-speed')!, findBoon('stat-defense')!] });
    expect(view.boons.map((boon) => boon.gain)).toEqual([null, { stat: 'defense', amount: 2 }]);
  });

  it('marks a boon that would complete an evolution', () => {
    const run = createRun(1, new Map([['bryn', new Archer({ name: 'Bryn', team: 'player' })]]));
    const unit = { ...run.roster[0], boons: ['keen-eye'] };
    const view = toBoonPickView({ unit, level: 3, boons: [findBoon('deadly')!, findBoon('nimble')!] });
    expect(view.boons.map((boon) => boon.evolves)).toEqual([true, false]);
  });
});
