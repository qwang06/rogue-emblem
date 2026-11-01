import { describe, expect, it } from 'vitest';
import { getCombatBonus } from '../modifiers.ts';
import { Soldier } from '../Soldier.ts';
import type { Unit } from '../Unit.ts';
import {
  applyEliteAffixes,
  applyEliteCreep,
  ELITE_AFFIX_COUNT,
  ELITE_AFFIXES,
  findEliteAffix,
  getBossAffixCount,
  getEliteCreepChance,
  rollEliteAffixes,
} from './elites.ts';

const enemies = (count: number) =>
  new Map<string, Unit>(
    Array.from({ length: count }, (_, i) => [`enemy-${i + 1}`, new Soldier({ name: 'Enemy Soldier', team: 'enemy' })]),
  );

describe('rollEliteAffixes', () => {
  it('rolls two different affixes, the same for the same seed and depth', () => {
    for (let seed = 1; seed < 30; seed++) {
      const affixes = rollEliteAffixes(seed, 5);
      expect(affixes).toHaveLength(ELITE_AFFIX_COUNT);
      expect(new Set(affixes.map((a) => a.id)).size).toBe(ELITE_AFFIX_COUNT);
      expect(rollEliteAffixes(seed, 5)).toEqual(affixes);
    }
    const spread = new Set(Array.from({ length: 30 }, (_, seed) => rollEliteAffixes(seed, 4)[0].id));
    expect(spread.size).toBeGreaterThan(2);
  });
});

describe('applyEliteAffixes', () => {
  const [armored, swift] = [findEliteAffix('armored')!, findEliteAffix('swift')!];

  it('gives each enemy one affix in turn, named before it, with its modifiers', () => {
    const units = enemies(3);
    const plainMove = units.get('enemy-1')!.movement;
    applyEliteAffixes(units, [armored, swift]);
    expect([...units.values()].map((u) => u.name)).toEqual(['Armored Soldier', 'Swift Soldier', 'Armored Soldier']);
    expect(units.get('enemy-1')!.eliteAffixes).toEqual(['armored']);
    expect([...units.values()].map((u) => u.rank)).toEqual(['elite', 'elite', 'elite']);
    const context = { attacking: false, wounded: false, vsMonster: false };
    // Armored's 3, on top of the soldier's own Shield Wall.
    expect(getCombatBonus(units.get('enemy-1')!.modifiers, context).guard).toBe(3 + 1);
    expect(units.get('enemy-2')!.movement).toBe(plainMove + 1);
  });

  it('gives the boss every affix and keeps its name', () => {
    const units = enemies(2);
    units.get('enemy-2')!.name = 'Orc Warlord';
    units.get('enemy-2')!.rank = 'boss';
    applyEliteAffixes(units, [armored, swift], 'enemy-2');
    expect(units.get('enemy-2')!.rank).toBe('boss');
    expect(units.get('enemy-1')!.rank).toBe('elite');
    expect(units.get('enemy-2')!.eliteAffixes).toEqual(['armored', 'swift']);
    expect(units.get('enemy-2')!.name).toBe('Orc Warlord');
  });

  it('leaves the player and guests alone, and does nothing without affixes', () => {
    const units = enemies(1);
    units.set('ally', new Soldier({ name: 'Alden', team: 'player' }));
    applyEliteAffixes(units, [armored]);
    expect(units.get('ally')!.eliteAffixes).toEqual([]);
    const untouched = enemies(1);
    applyEliteAffixes(untouched, []);
    expect(untouched.get('enemy-1')!.name).toBe('Enemy Soldier');
  });

  it('has a description for every affix', () => {
    for (const affix of ELITE_AFFIXES) {
      expect(affix.description.length).toBeGreaterThan(0);
      expect(affix.modifiers.length).toBeGreaterThan(0);
    }
  });
});

describe('elite creep', () => {
  const foes = (count: number) =>
    new Map<string, Unit>(
      Array.from({ length: count }, (_, i) => [
        `enemy-${i + 1}`,
        new Soldier({ name: 'Enemy Soldier', team: 'enemy' }),
      ]),
    );

  it('starts at stage 5 and grows 3% a stage, up to every enemy', () => {
    expect(getEliteCreepChance(4)).toBe(0);
    expect(getEliteCreepChance(5)).toBe(15);
    expect(getEliteCreepChance(30)).toBe(90);
    expect(getEliteCreepChance(60)).toBe(100);
  });

  it('gives a boss one affix every 6 stages', () => {
    expect([4, 5, 6, 12, 30].map(getBossAffixCount)).toEqual([0, 0, 1, 2, 5]);
  });

  it('leaves stages before it alone', () => {
    const units = foes(4);
    applyEliteCreep(units, 1, 4);
    expect([...units.values()].every((unit) => unit.eliteAffixes.length === 0)).toBe(true);
  });

  it('gives about its share of enemies one affix each, the boss its count, the same for a seed', () => {
    const units = foes(200);
    applyEliteCreep(units, 7, 20, 'enemy-1');
    const boss = units.get('enemy-1')!;
    expect(new Set(boss.eliteAffixes).size).toBe(getBossAffixCount(20));
    expect(boss.rank).not.toBe('elite');
    const rest = [...units.values()].slice(1);
    const elites = rest.filter((unit) => unit.eliteAffixes.length > 0);
    expect(elites.every((unit) => unit.eliteAffixes.length === 1 && unit.rank === 'elite')).toBe(true);
    expect(elites.length / rest.length).toBeGreaterThan(0.45);
    expect(elites.length / rest.length).toBeLessThan(0.75);
    const again = foes(200);
    applyEliteCreep(again, 7, 20, 'enemy-1');
    expect([...again.values()].map((unit) => unit.eliteAffixes)).toEqual(
      [...units.values()].map((unit) => unit.eliteAffixes),
    );
  });
});
