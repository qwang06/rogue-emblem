// Keeps UNITS.md honest: its per-class stat and skill tables, and the
// level-1 matchup table, must match the code. If this fails, update
// UNITS.md along with the numbers you changed.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { calculateDamage, getCombatForecast } from './combat.js';
import { getCritChance, getHitChance } from './combatStats.js';
import { calculateSkillDamage, POWER_STRIKE, SKILL_TREES, THROW_STONES } from './skills.js';
import { createUnitOfClass, UNIT_CLASSES } from './unitClasses.js';

const doc = readFileSync(new URL('../../UNITS.md', import.meta.url), 'utf8');

// The body of the `## heading` section, up to the next `## `.
function section(heading) {
  const start = doc.indexOf(`\n## ${heading}\n`);
  if (start === -1) throw new Error(`UNITS.md has no "## ${heading}" section`);
  const end = doc.indexOf('\n## ', start + 1);
  return doc.slice(start, end === -1 ? undefined : end);
}

// Every markdown table in `text`, as arrays of row cells (header row
// first, the |---| divider dropped).
function tables(text) {
  const result = [];
  let current = null;
  for (const line of text.split('\n')) {
    if (!line.startsWith('|')) {
      current = null;
      continue;
    }
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.every((cell) => /^-+$/.test(cell))) continue;
    if (!current) result.push((current = []));
    current.push(cells);
  }
  return result;
}

function tableWithHeader(text, firstHeader) {
  const table = tables(text).find((t) => t[0][0] === firstHeader);
  if (!table) throw new Error(`No table starting with "${firstHeader}"`);
  return table.slice(1);
}

const STAT_ROWS = {
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
  RNG: (unit) => unit.range,
};
const GROWTH_KEYS = {
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

  it('has the right level-1 matchup numbers', () => {
    const villager = createUnitOfClass('villager', { team: 'player' });
    const soldier = createUnitOfClass('soldier', { team: 'enemy' });
    const rows = Object.fromEntries(tableWithHeader(section('Matchups at level 1'), 'Action').map((r) => [r[0], r]));
    const forecast = getCombatForecast(villager, soldier, { distance: 1 });

    const [, damage, hit, crit] = rows['Regular attack'];
    expect(Number(damage)).toBe(calculateDamage(villager, soldier));
    expect(hit).toBe(`${getHitChance(villager, soldier)}%`);
    expect(crit).toBe(`${getCritChance(villager, soldier)}%`);
    expect(forecast.attacker.strikes).toBe(1);
    expect(forecast.defender.strikes).toBe(1);

    expect(Number(rows['Throw Stones'][1])).toBe(calculateSkillDamage(THROW_STONES, villager, soldier));
    expect(Number(rows['Power Strike'][1])).toBe(calculateSkillDamage(POWER_STRIKE, soldier, villager));
  });
});
