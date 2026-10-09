// Keeps UNITS.md honest: its per-class stat and skill tables, and the
// level-1 matchup table, must match the code. If this fails, update
// UNITS.md along with the numbers you changed.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { calculateDamage, getCombatForecast } from './combat.ts';
import { getCritChance, getHitChance } from './combatStats.ts';
import type { GrowthStat } from './experience.ts';
import {
  calculateSkillDamage,
  CLEAVE,
  FIREBALL,
  LONG_SHOT,
  POWER_STRIKE,
  SHIELD_BASH,
  SKILL_TREES,
  THROW_STONES,
  type Skill,
} from './skills.ts';
import { createUnitOfClass, UNIT_CLASSES } from './unitClasses.ts';
import type { Unit } from './Unit.ts';
import { formatWeaponRange, WEAPONS } from './weapons.ts';

// Line endings normalized, so a Windows checkout (CRLF) parses the same.
const doc = readFileSync(new URL('../../UNITS.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

// The body of the `## heading` section, up to the next `## `.
function section(heading: string): string {
  const start = doc.indexOf(`\n## ${heading}\n`);
  if (start === -1) throw new Error(`UNITS.md has no "## ${heading}" section`);
  const end = doc.indexOf('\n## ', start + 1);
  return doc.slice(start, end === -1 ? undefined : end);
}

// Every markdown table in `text`, as arrays of row cells (header row
// first, the |---| divider dropped).
function tables(text: string): string[][][] {
  const result: string[][][] = [];
  let current: string[][] | null = null;
  for (const line of text.split('\n')) {
    if (!line.startsWith('|')) {
      current = null;
      continue;
    }
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.every((cell) => /^-+$/.test(cell))) continue;
    if (!current) result.push((current = []));
    current.push(cells);
  }
  return result;
}

function tableWithHeader(text: string, firstHeader: string): string[][] {
  const table = tables(text).find((t) => t[0][0] === firstHeader);
  if (!table) throw new Error(`No table starting with "${firstHeader}"`);
  return table.slice(1);
}

const STAT_ROWS: Record<string, (unit: Unit) => number> = {
  HP: (unit) => unit.maxHealth,
  MP: (unit) => unit.maxMana,
  STR: (unit) => unit.strength,
  MAG: (unit) => unit.magic,
  SKL: (unit) => unit.skill,
  SPD: (unit) => unit.speed,
  LCK: (unit) => unit.luck,
  DEF: (unit) => unit.defense,
  RES: (unit) => unit.resistance,
  MOV: (unit) => unit.movement,
};
const GROWTH_KEYS: Record<string, GrowthStat> = {
  HP: 'health',
  MP: 'mana',
  STR: 'strength',
  MAG: 'magic',
  SKL: 'skill',
  SPD: 'speed',
  LCK: 'luck',
  DEF: 'defense',
  RES: 'resistance',
};

describe('UNITS.md', () => {
  for (const { id, label } of UNIT_CLASSES) {
    describe(label, () => {
      const unit = createUnitOfClass(id, { team: 'player' });
      const text = section(label);

      it('lists the base stats, growths and caps', () => {
        const rows = tableWithHeader(text, 'Stat');
        expect(rows.map(([stat]) => stat)).toEqual(Object.keys(STAT_ROWS));
        for (const [stat, base, growth, cap] of rows) {
          expect(Number(base), `${label} ${stat} base`).toBe(STAT_ROWS[stat](unit));
          const key = GROWTH_KEYS[stat];
          if (!key) continue;
          expect(growth, `${label} ${stat} growth`).toBe(`${unit.growths[key] ?? 0}%`);
          expect(cap, `${label} ${stat} cap`).toBe(String(unit.caps[key] ?? '–'));
        }
      });

      it('lists the weapon types it wields and the weapon it starts with', () => {
        const [[types, weapon]] = tableWithHeader(text, 'Weapon types');
        expect(types).toBe(unit.weaponTypes.join(', '));
        expect(weapon).toBe(unit.weapon?.label ?? '–');
      });

      it('lists every skill the class learns', () => {
        const rows = tableWithHeader(text, 'Skill');
        const tree = SKILL_TREES[id] ?? [];
        expect(rows.map(([name]) => name)).toEqual(tree.map(({ skill }) => skill.label));
        rows.forEach(([, learnedAt, mana, range], i) => {
          const { level, skill } = tree[i];
          expect(Number(learnedAt), `${skill.label} level`).toBe(level);
          expect(Number(mana), `${skill.label} mana`).toBe(skill.manaCost);
          expect(range, `${skill.label} range`).toBe(skill.range === 1 ? '1' : `1–${skill.range}`);
        });
      });
    });
  }

  it('lists every weapon with its numbers', () => {
    const rows = tableWithHeader(section('Weapons'), 'Weapon');
    expect(rows.map(([label]) => label)).toEqual(WEAPONS.map((w) => w.label));
    rows.forEach(([, type, might, hit, crit, weight, range, uses], i) => {
      const weapon = WEAPONS[i];
      expect([type, might, hit, crit, weight, range, uses], weapon.label).toEqual([
        weapon.type,
        String(weapon.might),
        String(weapon.hit),
        String(weapon.crit),
        String(weapon.weight),
        formatWeaponRange(weapon),
        weapon.uses === null ? '∞' : String(weapon.uses),
      ]);
    });
  });

  it('has the right level-1 matchup numbers', () => {
    const units: Record<string, Unit> = {
      Villager: createUnitOfClass('villager', { team: 'player' }),
      Soldier: createUnitOfClass('soldier', { team: 'enemy' }),
      Archer: createUnitOfClass('archer', { team: 'player' }),
      Vanguard: createUnitOfClass('vanguard', { team: 'player' }),
      Wizard: createUnitOfClass('wizard', { team: 'player' }),
      Guard: createUnitOfClass('guard', { team: 'player' }),
    };
    const text = section('Matchups at level 1');
    const attacks = tableWithHeader(text, 'Attacker');
    expect(attacks.map(([attacker]) => attacker)).toEqual([
      'Villager',
      'Soldier',
      'Archer',
      'Vanguard',
      'Wizard',
      'Guard',
      'Soldier',
    ]);
    for (const [attackerName, targetName, weapon, damage, hit, crit, strikes] of attacks) {
      const attacker = units[attackerName];
      const defender = units[targetName];
      // From as close as the attacker's weapon reaches.
      const forecast = getCombatForecast(attacker, defender, { distance: attacker.weapon!.minRange });
      expect(weapon).toBe(attacker.weapon!.label);
      expect(Number(damage), `${attackerName} damage`).toBe(calculateDamage(attacker, defender));
      expect(hit, `${attackerName} hit`).toBe(`${getHitChance(attacker, defender)}%`);
      expect(crit, `${attackerName} crit`).toBe(`${getCritChance(attacker, defender)}%`);
      expect(Number(strikes), `${attackerName} strikes`).toBe(forecast.attacker.strikes);
    }

    const skills = tableWithHeader(text, 'Skill');
    const SKILLS: Record<string, Skill> = {
      'Throw Stones': THROW_STONES,
      'Power Strike': POWER_STRIKE,
      'Long Shot': LONG_SHOT,
      Cleave: CLEAVE,
      Fireball: FIREBALL,
      'Shield Bash': SHIELD_BASH,
    };
    expect(skills.map(([name]) => name)).toEqual(Object.keys(SKILLS));
    for (const [name, user, target, damage] of skills) {
      expect(Number(damage), `${name} damage`).toBe(calculateSkillDamage(SKILLS[name], units[user], units[target]));
    }
  });
});
