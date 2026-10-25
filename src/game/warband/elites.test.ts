import { describe, expect, it } from 'vitest';
import { getCombatBonus } from '../modifiers.ts';
import { Soldier } from '../Soldier.ts';
import type { Unit } from '../Unit.ts';
import { applyEliteAffixes, ELITE_AFFIX_COUNT, ELITE_AFFIXES, findEliteAffix, rollEliteAffixes } from './elites.ts';

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
    const context = { attacking: false, wounded: false, vsMonster: false };
    expect(getCombatBonus(units.get('enemy-1')!.modifiers, context).guard).toBe(3);
    expect(units.get('enemy-2')!.movement).toBe(plainMove + 1);
  });

  it('gives the boss every affix and keeps its name', () => {
    const units = enemies(2);
    units.get('enemy-2')!.name = 'Orc Warlord';
    applyEliteAffixes(units, [armored, swift], 'enemy-2');
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
