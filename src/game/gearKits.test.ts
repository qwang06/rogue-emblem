import { describe, expect, it } from 'vitest';
import {
  BLOOD_CROWN,
  equipEnemyMonsters,
  findMonsterGear,
  GEAR_DESCRIPTIONS,
  getMonsterGearChance,
  isCursed,
  KIT_GEAR,
  MONSTER_GEAR,
  MONSTER_GEAR_MAX_PERCENT,
  SIGNATURE_GEAR,
  SPIKED_BUCKLER,
  THORNMAIL,
} from './gearKits.ts';
import { getGearLayout } from './equipment.ts';
import { UNIT_CLASSES } from './unitClasses.ts';
import { RUN_ITEMS } from './warband/run.ts';
import { applyModifiers } from './modifiers.ts';
import { makeTestUnit, createTestBattle } from './battle/testLevel.ts';
import { applyCommand } from './battle/commands.ts';
import { getDeployedCurses } from './curses.ts';
import { resolveExperienceGain } from './experience.ts';

describe('the gear catalog', () => {
  it('has unique ids, a description for each piece, and every piece in RUN_ITEMS', () => {
    const ids = SIGNATURE_GEAR.map((gear) => gear.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(GEAR_DESCRIPTIONS).sort()).toEqual([...ids].sort());
    for (const gear of SIGNATURE_GEAR) expect(RUN_ITEMS).toContain(gear);
    expect(new Set(RUN_ITEMS.map((item) => item.id)).size).toBe(RUN_ITEMS.length);
  });

  it('makes each piece of monster gear for a real monster class, one each', () => {
    const classIds = UNIT_CLASSES.map((unitClass) => unitClass.id);
    for (const gear of MONSTER_GEAR) {
      expect(gear.slot).toBe('special');
      expect(classIds).toContain(gear.forClass);
      expect(getGearLayout(gear.forClass!)).toBe('monster');
    }
    const forClasses = MONSTER_GEAR.map((gear) => gear.forClass);
    expect(new Set(forClasses).size).toBe(forClasses.length);
    expect(findMonsterGear('bat')?.id).toBe('vampire-fang');
    expect(findMonsterGear('villager')).toBeNull();
  });

  it('curses only the cursed pieces, each kit carrying one', () => {
    expect(KIT_GEAR.filter(isCursed).map((gear) => gear.id)).toEqual([
      'blood-crown',
      'warlords-banner',
      'gravebound-plate',
    ]);
    expect(MONSTER_GEAR.some(isCursed)).toBe(false);
  });
});

describe('a unit wearing gear', () => {
  it("adds its gear's modifiers and curses to its own, keeping them apart", () => {
    const unit = makeTestUnit({ team: 'player', equipment: { off: SPIKED_BUCKLER, accessory: BLOOD_CROWN } });
    expect(unit.modifiers).toEqual([...SPIKED_BUCKLER.modifiers!, ...BLOOD_CROWN.modifiers!]);
    expect(unit.curses).toEqual(BLOOD_CROWN.curses);
    applyModifiers(unit, [{ kind: 'sure-hit' }]);
    expect(unit.ownModifiers).toEqual([{ kind: 'sure-hit' }]);
    expect(unit.modifiers).toEqual([{ kind: 'sure-hit' }, ...SPIKED_BUCKLER.modifiers!, ...BLOOD_CROWN.modifiers!]);
    unit.curses = [...unit.curses, { kind: 'enemy-affix', affixId: 'keen' }];
    expect(unit.ownCurses).toEqual([{ kind: 'enemy-affix', affixId: 'keen' }]);
    unit.equipment = {};
    expect(unit.modifiers).toEqual([{ kind: 'sure-hit' }]);
  });

  it('fights with its gear: a thorny shield hurts its attacker', () => {
    const attacker = makeTestUnit({ team: 'player' });
    attacker.modifiers = [{ kind: 'sure-hit' }];
    const tank = makeTestUnit({ team: 'enemy', equipment: { body: THORNMAIL } });
    const start = createTestBattle({
      hero: { unit: attacker, at: { x: 0, y: 0 } },
      tank: { unit: tank, at: { x: 1, y: 0 } },
    });
    const { events } = applyCommand(start, { type: 'attack', unitId: 'hero', target: { x: 1, y: 0 } });
    expect(events.some((event) => event.type === 'recoil' && event.unitId === 'hero')).toBe(true);
  });

  it("brings its cursed gear's curses to the battles it's deployed in", () => {
    const wearer = makeTestUnit({ team: 'player', equipment: { accessory: BLOOD_CROWN } });
    expect(getDeployedCurses(new Map([['wearer', wearer]]), ['wearer'])).toEqual(BLOOD_CROWN.curses);
  });

  it('earns more XP with experience gear', () => {
    const whelp = makeTestUnit({ team: 'player', equipment: { special: findMonsterGear('whelp')! } });
    const plain = makeTestUnit({ team: 'player' });
    expect(resolveExperienceGain(whelp, 20).amount).toBe(30);
    expect(resolveExperienceGain(plain, 20).amount).toBe(20);
  });
});

describe('enemy monster gear', () => {
  it('grows more likely with the stage, up to a cap', () => {
    expect(getMonsterGearChance(0)).toBe(0);
    expect(getMonsterGearChance(1)).toBeLessThan(getMonsterGearChance(5));
    expect(getMonsterGearChance(100)).toBe(MONSTER_GEAR_MAX_PERCENT);
  });

  it('dresses enemy monsters of a class with gear, and nobody else', () => {
    const bat = makeTestUnit({ team: 'enemy', unitClass: 'bat' });
    const playerBat = makeTestUnit({ team: 'player', unitClass: 'bat' });
    const villager = makeTestUnit({ team: 'enemy', unitClass: 'villager' });
    equipEnemyMonsters([bat, playerBat, villager], 10, () => 0);
    expect(bat.equipment.special?.id).toBe('vampire-fang');
    expect(playerBat.equipment.special).toBeUndefined();
    expect(villager.equipment.special).toBeUndefined();
    const lucky = makeTestUnit({ team: 'enemy', unitClass: 'bat' });
    equipEnemyMonsters([lucky], 10, () => 0.999);
    expect(lucky.equipment.special).toBeUndefined();
  });
});
