import { describe, expect, it } from 'vitest';
import { calculateDamage, getCombatForecast, getDamageType } from './combat.ts';
import { HEALTH_POTION, MANA_POTION } from './items.ts';
import { calculateSkillDamage, FIREBALL, getLearnedSkills } from './skills.ts';
import { Soldier } from './Soldier.ts';
import { Unit } from './Unit.ts';
import { FIRE, IRON_SPEAR, weaponEntry } from './weapons.ts';
import { WIZARD_CAPS, WIZARD_GROWTHS, WIZARD_ITEMS, WIZARD_STATS, Wizard } from './Wizard.ts';

describe('Wizard', () => {
  it('is a Unit of the wizard class', () => {
    const wizard = new Wizard({ team: 'player' });
    expect(wizard).toBeInstanceOf(Unit);
    expect(wizard.unitClass).toBe('wizard');
    expect(wizard.name).toBe('Wizard');
    expect(wizard.team).toBe('player');
    expect(wizard.level).toBe(1);
  });

  it('uses the wizard stat line', () => {
    const wizard = new Wizard({ team: 'enemy' });
    expect(wizard.maxHealth).toBe(WIZARD_STATS.health);
    expect(wizard.maxMana).toBe(WIZARD_STATS.mana);
    expect(wizard.strength).toBe(WIZARD_STATS.strength);
    expect(wizard.magic).toBe(WIZARD_STATS.magic);
    expect(wizard.skill).toBe(WIZARD_STATS.skill);
    expect(wizard.speed).toBe(WIZARD_STATS.speed);
    expect(wizard.luck).toBe(WIZARD_STATS.luck);
    expect(wizard.defense).toBe(WIZARD_STATS.defense);
    expect(wizard.resistance).toBe(WIZARD_STATS.resistance);
    expect(wizard.movement).toBe(WIZARD_STATS.movement);
  });

  it('levels up with the wizard growth rates and caps', () => {
    const wizard = new Wizard({ team: 'player' });
    expect(wizard.growths).toBe(WIZARD_GROWTHS);
    expect(wizard.caps).toBe(WIZARD_CAPS);
  });

  it('wields magical weapons only', () => {
    const wizard = new Wizard({ team: 'player', items: [weaponEntry(IRON_SPEAR)] });
    expect(wizard.weaponTypes).toEqual(['magical']);
    expect(wizard.weapon).toBeNull();
  });

  it('carries Fire, a health potion and a mana potion', () => {
    const wizard = new Wizard({ team: 'player' });
    expect(wizard.items).toEqual(WIZARD_ITEMS);
    expect(wizard.items.map((entry) => entry.item)).toEqual([FIRE, HEALTH_POTION, MANA_POTION]);
    expect(wizard.weapon).toBe(FIRE);
    expect(wizard.weaponUses).toBe(FIRE.uses);
  });

  it('knows Fireball from level 1', () => {
    expect(getLearnedSkills('wizard', 1)).toEqual([FIREBALL]);
  });

  it('accepts a custom name and level', () => {
    const wizard = new Wizard({ name: 'Enemy Wizard', team: 'enemy', level: 4 });
    expect(wizard.name).toBe('Enemy Wizard');
    expect(wizard.level).toBe(4);
  });

  it('deals magic damage against resistance', () => {
    const wizard = new Wizard({ team: 'player' });
    const soldier = new Soldier({ team: 'enemy' });
    expect(getDamageType(wizard)).toBe('magical');
    // MAG + Fire's might − the soldier's 0 RES; its 2 DEF doesn't count.
    expect(calculateDamage(wizard, soldier)).toBe(WIZARD_STATS.magic + FIRE.might);
  });

  it("shrugs off magic but not a soldier's spear", () => {
    const wizard = new Wizard({ team: 'player' });
    const caster = new Wizard({ team: 'enemy' });
    const soldier = new Soldier({ team: 'enemy' });
    expect(calculateDamage(caster, wizard)).toBeLessThan(calculateDamage(caster, soldier));
    // A soldier's 4 STR + the spear's 1 might against the wizard's 0 DEF.
    expect(calculateDamage(soldier, wizard)).toBe(5);
  });

  it('casts from one or two tiles away, and a soldier only counters up close', () => {
    const near = getCombatForecast(new Wizard({ team: 'player' }), new Soldier({ team: 'enemy' }), { distance: 1 });
    const far = getCombatForecast(new Wizard({ team: 'player' }), new Soldier({ team: 'enemy' }), { distance: 2 });
    expect(near.attacker.strikes).toBe(1);
    expect(near.defender.counters).toBe(true);
    expect(far.attacker.strikes).toBe(1);
    expect(far.defender.counters).toBe(false);
  });

  it('Fireball adds its might to magic', () => {
    const wizard = new Wizard({ team: 'player' });
    const soldier = new Soldier({ team: 'enemy' });
    expect(calculateSkillDamage(FIREBALL, wizard, soldier)).toBe(calculateDamage(wizard, soldier) + FIREBALL.might!);
  });
});
