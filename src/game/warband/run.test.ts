import { describe, expect, it } from 'vitest';
import { Archer } from '../Archer.ts';
import { HEALTH_POTION, MANA_POTION } from '../items.ts';
import { Soldier } from '../Soldier.ts';
import { Unit } from '../Unit.ts';
import { Villager } from '../Villager.ts';
import { FISTS, IRON_BOW, IRON_SPEAR } from '../weapons.ts';
import {
  advanceStage,
  applyBattleResult,
  createRun,
  getStageSeed,
  isRunOver,
  parseRun,
  restoreRoster,
  restoreUnit,
  serializeRun,
  snapshotUnit,
  STARTING_DEPLOY_CAP,
  type RunState,
} from './run.ts';

function startingRun(): RunState {
  return createRun(
    42,
    new Map<string, Unit>([
      ['alden', new Soldier({ name: 'Alden', team: 'player' })],
      ['bryn', new Archer({ name: 'Bryn', team: 'player' })],
      ['cato', new Villager({ name: 'Cato', team: 'player' })],
    ]),
  );
}

// Rolls of 0 raise every stat with a growth above 0.
const alwaysGrow = () => 0;

describe('createRun', () => {
  it('starts on stage 1 with the roster and nothing else', () => {
    const run = startingRun();
    expect(run.seed).toBe(42);
    expect(run.stage).toBe(1);
    expect(run.roster.map((unit) => [unit.id, unit.name, unit.classId])).toEqual([
      ['alden', 'Alden', 'soldier'],
      ['bryn', 'Bryn', 'archer'],
      ['cato', 'Cato', 'villager'],
    ]);
    expect(run.convoy).toEqual([]);
    expect(run.gold).toBe(0);
    expect(run.relics).toEqual([]);
    expect(run.deployCap).toBe(STARTING_DEPLOY_CAP);
    expect(run.fallen).toEqual([]);
    expect(Object.isFrozen(run)).toBe(true);
    expect(Object.isFrozen(run.roster[0])).toBe(true);
  });
});

describe('snapshotUnit and restoreUnit', () => {
  it('round-trips a fresh unit of each class', () => {
    for (const unit of [
      new Soldier({ team: 'player' }),
      new Archer({ team: 'player' }),
      new Villager({ team: 'player' }),
    ]) {
      const restored = restoreUnit(snapshotUnit('u', unit));
      expect(restored).toEqual(unit);
      expect(restored.constructor).toBe(unit.constructor);
    }
  });

  it('round-trips a leveled, wounded unit with a worn weapon and a used potion', () => {
    const soldier = new Soldier({ name: 'Alden', team: 'player' });
    soldier.gainExperience(250, alwaysGrow);
    soldier.takeDamage(4);
    soldier.spendMana(1);
    soldier.spendWeaponUse();
    soldier.useItem(MANA_POTION.id);

    const snapshot = snapshotUnit('alden', soldier);
    expect(snapshot.level).toBe(3);
    expect(snapshot.experience).toBe(50);
    expect(snapshot.health).toBe(soldier.maxHealth - 4);
    expect(snapshot.items).toEqual([
      { itemId: IRON_SPEAR.id, quantity: IRON_SPEAR.uses! - 1 },
      { itemId: HEALTH_POTION.id, quantity: 1 },
    ]);

    const restored = restoreUnit(snapshot);
    expect(restored).toEqual(soldier);
    expect(restored.weapon).toBe(IRON_SPEAR);
    expect(restored.team).toBe('player');
  });

  it('keeps the class movement and growths, which snapshots do not store', () => {
    const restored = restoreUnit(snapshotUnit('b', new Archer({ team: 'player' })));
    expect(restored.movement).toBe(new Archer({ team: 'player' }).movement);
    expect(restored.growths).toBe(new Archer({ team: 'player' }).growths);
  });

  it('refuses a unit without a class', () => {
    const unit = new Unit({ name: 'Nobody', health: 5, strength: 1, defense: 0, movement: 4, team: 'player' });
    expect(() => snapshotUnit('n', unit)).toThrow(/no class/);
  });

  it('refuses an unknown class or item', () => {
    const snapshot = snapshotUnit('a', new Soldier({ team: 'player' }));
    expect(() => restoreUnit({ ...snapshot, classId: 'dragon' })).toThrow(/Unknown unit class/);
    expect(() => restoreUnit({ ...snapshot, items: [{ itemId: 'excalibur', quantity: 1 }] })).toThrow(/Unknown item/);
  });
});

describe('applyBattleResult', () => {
  it('writes XP, level ups, HP and weapon uses back to the units that fought', () => {
    const run = startingRun();
    const units = restoreRoster(run);
    const alden = units.get('alden')!;
    alden.gainExperience(130, alwaysGrow);
    alden.takeDamage(3);
    alden.spendWeaponUse();
    const bryn = units.get('bryn')!;
    bryn.useItem(HEALTH_POTION.id);

    const after = applyBattleResult(run, { units });
    const [aldenAfter, brynAfter] = after.roster;
    expect(aldenAfter).toEqual(snapshotUnit('alden', alden));
    expect(aldenAfter.level).toBe(2);
    expect(aldenAfter.experience).toBe(30);
    expect(aldenAfter.health).toBe(alden.maxHealth - 3);
    expect(aldenAfter.items[0]).toEqual({ itemId: IRON_SPEAR.id, quantity: IRON_SPEAR.uses! - 1 });
    expect(brynAfter.items.map((item) => item.itemId)).toEqual([IRON_BOW.id, MANA_POTION.id]);
  });

  it('drops a weapon that broke', () => {
    const run = startingRun();
    const units = restoreRoster(run);
    const bryn = units.get('bryn')!;
    for (let i = 0; i < IRON_BOW.uses!; i++) bryn.spendWeaponUse();

    const after = applyBattleResult(run, { units });
    expect(after.roster[1].items.map((item) => item.itemId)).not.toContain(IRON_BOW.id);
  });

  it('moves the dead to fallen for good and keeps roster order', () => {
    const run = startingRun();
    const units = restoreRoster(run);
    units.get('bryn')!.takeDamage(99);

    const after = applyBattleResult(run, { units });
    expect(after.roster.map((unit) => unit.id)).toEqual(['alden', 'cato']);
    expect(after.fallen.map((unit) => [unit.id, unit.health])).toEqual([['bryn', 0]]);

    // A later battle can't bring them back.
    const again = applyBattleResult(after, { units });
    expect(again.roster.map((unit) => unit.id)).toEqual(['alden', 'cato']);
    expect(again.fallen.map((unit) => unit.id)).toEqual(['bryn']);
  });

  it('leaves undeployed units as they were and ignores enemies', () => {
    const run = startingRun();
    const alden = restoreUnit(run.roster[0]);
    alden.takeDamage(2);
    const units = new Map<string, Unit>([
      ['alden', alden],
      ['enemy-1', new Soldier({ team: 'enemy' })],
    ]);

    const after = applyBattleResult(run, { units });
    expect(after.roster[0].health).toBe(alden.health);
    expect(after.roster[1]).toEqual(run.roster[1]);
    expect(after.roster[2]).toEqual(run.roster[2]);
    expect(after.roster).toHaveLength(3);
  });

  it('leaves the stage and the input run alone', () => {
    const run = startingRun();
    const units = restoreRoster(run);
    units.get('alden')!.takeDamage(99);
    const after = applyBattleResult(run, { units });
    expect(after.stage).toBe(1);
    expect(run.roster).toHaveLength(3);
    expect(run.fallen).toEqual([]);
  });
});

describe('isRunOver', () => {
  it('is over only once the roster is empty', () => {
    const run = startingRun();
    expect(isRunOver(run)).toBe(false);
    const units = restoreRoster(run);
    units.get('alden')!.takeDamage(99);
    units.get('bryn')!.takeDamage(99);
    const oneLeft = applyBattleResult(run, { units });
    expect(isRunOver(oneLeft)).toBe(false);
    units.get('cato')!.takeDamage(99);
    expect(isRunOver(applyBattleResult(oneLeft, { units }))).toBe(true);
  });
});

describe('advanceStage', () => {
  it('moves on one stage', () => {
    const run = startingRun();
    expect(advanceStage(run).stage).toBe(2);
    expect(advanceStage(advanceStage(run)).stage).toBe(3);
    expect(run.stage).toBe(1);
  });
});

describe('getStageSeed', () => {
  it('gives the same seed for the same run seed and stage', () => {
    expect(getStageSeed(42, 3)).toBe(getStageSeed(42, 3));
  });

  it('differs between stages and between runs', () => {
    const seeds = new Set([1, 2, 3, 4, 5].map((stage) => getStageSeed(42, stage)));
    expect(seeds.size).toBe(5);
    expect(getStageSeed(42, 1)).not.toBe(getStageSeed(43, 1));
  });

  it('is a 32-bit whole number', () => {
    for (const seed of [0, 1, 2 ** 32 - 1]) {
      const stageSeed = getStageSeed(seed, 7);
      expect(Number.isInteger(stageSeed)).toBe(true);
      expect(stageSeed).toBeGreaterThanOrEqual(0);
      expect(stageSeed).toBeLessThan(2 ** 32);
    }
  });
});

describe('serializeRun and parseRun', () => {
  it('round-trips a run mid-way through', () => {
    const run = startingRun();
    const units = restoreRoster(run);
    units.get('alden')!.gainExperience(150, alwaysGrow);
    units.get('cato')!.takeDamage(99);
    const played = advanceStage(applyBattleResult(run, { units }));
    const withExtras: RunState = {
      ...played,
      gold: 120,
      relics: ['lucky-coin'],
      convoy: [{ itemId: FISTS.id, quantity: 1 }],
    };

    const parsed = parseRun(serializeRun(withExtras));
    expect(parsed).toEqual(withExtras);
    expect(restoreRoster(parsed!)).toEqual(restoreRoster(withExtras));
  });

  it.each([
    ['not JSON', '{oops'],
    ['not an object', '[1, 2]'],
    ['null', 'null'],
    ['an empty object', '{}'],
  ])('rejects %s', (_, text) => {
    expect(parseRun(text)).toBeNull();
  });

  it('rejects bad fields', () => {
    const run = JSON.parse(serializeRun(startingRun()));
    const unit = run.roster[0];
    const cases = [
      { ...run, stage: 0 },
      { ...run, seed: -1 },
      { ...run, gold: 1.5 },
      { ...run, deployCap: 0 },
      { ...run, relics: [3] },
      { ...run, convoy: [{ itemId: 'excalibur', quantity: 1 }] },
      { ...run, convoy: [{ itemId: FISTS.id, quantity: 0 }] },
      { ...run, roster: [{ ...unit, classId: 'dragon' }] },
      { ...run, roster: [{ ...unit, level: 0 }] },
      { ...run, roster: [{ ...unit, health: unit.maxHealth + 1 }] },
      { ...run, roster: [{ ...unit, strength: 'lots' }] },
      { ...run, roster: [unit, unit] },
      { ...run, fallen: 'none' },
    ];
    for (const bad of cases) expect(parseRun(JSON.stringify(bad))).toBeNull();
  });
});
