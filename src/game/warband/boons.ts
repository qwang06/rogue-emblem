// Level-up boons, Vampire Survivors style: each level a Warband unit gains
// (in battle, from a stage clear or from a Veteran's Lesson) also lets it
// pick one of three boons, on top of the level's growth rolls. A boon is
// one of:
// - a stat boon: +2 to a stat (+4 max HP), up to the class's cap;
// - a skill boon: a skill from another class's tree (skills.ts);
// - a passive: a modifier (modifiers.ts) the unit carries into every
//   battle, like a relic for one unit.
// The unit's taken boons are kept by id on it (`Unit.boons`, saved on its
// snapshot); restoreUnit in run.ts gives it their modifiers. Offers are
// rolled from an Rng (seeded from the run, see levelUpPicks.ts). Pure.

import type { Rng } from '../combatStats.ts';
import type { GrowthStat } from '../experience.ts';
import type { Modifier } from '../modifiers.ts';
import { shuffle } from '../rng.ts';
import { CLEAVE, getUnitSkills, POWER_STRIKE, SHIELD_BASH, THROW_STONES, type Skill } from '../skills.ts';
import type { Unit } from '../Unit.ts';
import { WEAPON_DAMAGE_TYPES } from '../weapons.ts';

export type BoonKind = 'stat' | 'skill' | 'passive';

export interface Boon {
  id: string;
  kind: BoonKind;
  name: string;
  description: string;
  // A stat boon's stat and how much it raises it (up to the cap).
  stat?: { stat: GrowthStat; amount: number };
  // What the unit carries into battle once it has the boon.
  modifiers: readonly Modifier[];
}

// How many boons a level up offers.
export const BOON_CHOICES = 3;
// How much a stat boon raises its stat, and max HP.
export const STAT_BOON_AMOUNT = 2;
export const HEALTH_BOON_AMOUNT = 4;

const STAT_LABELS: Readonly<Partial<Record<GrowthStat, string>>> = Object.freeze({
  health: 'HP',
  strength: 'STR',
  magic: 'MAG',
  skill: 'SKL',
  speed: 'SPD',
  luck: 'LCK',
  defense: 'DEF',
  resistance: 'RES',
});

function statBoon(stat: GrowthStat, name: string): Boon {
  const amount = stat === 'health' ? HEALTH_BOON_AMOUNT : STAT_BOON_AMOUNT;
  const label = STAT_LABELS[stat]!;
  return Object.freeze({
    id: `stat-${stat}`,
    kind: 'stat',
    name,
    description: `+${amount} ${stat === 'health' ? 'max HP' : label}, up to the class's cap. Can be taken again.`,
    stat: Object.freeze({ stat, amount }),
    modifiers: Object.freeze([]),
  });
}

function skillBoon(skill: Skill, description: string): Boon {
  return Object.freeze({
    id: `skill-${skill.id}`,
    kind: 'skill',
    name: `Learn ${skill.label}`,
    description: `${description} (${skill.manaCost} MP)`,
    modifiers: Object.freeze([Object.freeze<Modifier>({ kind: 'skill', skill })]),
  });
}

function passive(id: string, name: string, description: string, modifiers: readonly Modifier[]): Boon {
  return Object.freeze({
    id,
    kind: 'passive',
    name,
    description,
    modifiers: Object.freeze(modifiers.map((modifier) => Object.freeze(modifier))),
  });
}

export const BOONS: readonly Boon[] = Object.freeze([
  statBoon('health', 'Vigor'),
  statBoon('strength', 'Might'),
  statBoon('magic', 'Insight'),
  statBoon('skill', 'Precision'),
  statBoon('speed', 'Swiftness'),
  statBoon('luck', 'Fortune'),
  statBoon('defense', 'Toughness'),
  statBoon('resistance', 'Warding'),
  skillBoon(POWER_STRIKE, 'A heavy blow with +3 power against an adjacent foe.'),
  skillBoon(CLEAVE, 'A wild swing with +2 power against an adjacent foe.'),
  skillBoon(SHIELD_BASH, 'A shove with +1 power against an adjacent foe.'),
  skillBoon(THROW_STONES, 'Half damage from up to 4 tiles away.'),
  passive('keen-eye', 'Keen Eye', '+15 hit.', [{ kind: 'combat', term: 'hit', amount: 15 }]),
  passive('deadly', 'Deadly', '+10 crit.', [{ kind: 'combat', term: 'crit', amount: 10 }]),
  passive('nimble', 'Nimble', '+15 avoid.', [{ kind: 'combat', term: 'avoid', amount: 15 }]),
  passive('brawler', 'Brawler', '+3 damage when it attacks.', [
    { kind: 'combat', term: 'damage', amount: 3, when: 'attacking' },
  ]),
  passive('stalwart', 'Stalwart', 'Takes 3 less damage when attacked.', [
    { kind: 'combat', term: 'guard', amount: 3, when: 'defending' },
  ]),
  passive('monster-hunter', 'Monster Hunter', '+3 damage against monsters.', [
    { kind: 'combat', term: 'damage', amount: 3, when: 'vs-monster' },
  ]),
  passive('wrath', 'Wrath', '+4 damage while under half HP.', [
    { kind: 'combat', term: 'damage', amount: 4, when: 'wounded' },
  ]),
  passive('fleet', 'Fleet', '+1 MOV.', [{ kind: 'movement', amount: 1 }]),
  passive('bloodthirst', 'Bloodthirst', 'Heals 4 HP when it defeats a foe.', [{ kind: 'kill-heal', amount: 4 }]),
  passive('regeneration', 'Regeneration', 'Recovers 2 HP at the start of each of your phases.', [
    { kind: 'phase-heal', amount: 2 },
  ]),
  passive('focus', 'Focus', 'Recovers 1 MP at the start of each of your phases.', [{ kind: 'phase-mana', amount: 1 }]),
  passive('quick-study', 'Quick Study', 'Earns 50% more XP.', [{ kind: 'experience', percent: 50 }]),
]);

// The boon with `id`, or null.
export function findBoon(id: string): Boon | null {
  return BOONS.find((boon) => boon.id === id) ?? null;
}

// Every modifier the boons `boonIds` give, in order. Unknown ids give none.
export function getBoonModifiers(boonIds: readonly string[]): Modifier[] {
  return boonIds.flatMap((id) => findBoon(id)?.modifiers ?? []);
}

// How much a stat boon would raise `unit`'s stat: its amount, cut to what
// the class's cap leaves (health and mana read their maximums). 0 for
// other boons.
export function getStatBoonGain(unit: Unit, boon: Boon): number {
  if (!boon.stat) return 0;
  const { stat, amount } = boon.stat;
  const value = stat === 'health' ? unit.maxHealth : stat === 'mana' ? unit.maxMana : unit[stat];
  return Math.max(0, Math.min(amount, (unit.caps[stat] ?? Infinity) - value));
}

// Whether `unit` could take `boon`: a stat boon that would raise something
// (STR only for a unit with physical weapons, MAG only for one with
// magical ones), a skill it doesn't know, or a passive it hasn't taken.
export function isBoonEligible(unit: Unit, boon: Boon): boolean {
  switch (boon.kind) {
    case 'stat': {
      const stat = boon.stat!.stat;
      if (stat === 'strength' && !dealsDamage(unit, 'physical')) return false;
      if (stat === 'magic' && !dealsDamage(unit, 'magical')) return false;
      return getStatBoonGain(unit, boon) > 0;
    }
    case 'skill':
      return boon.modifiers.every(
        (modifier) => modifier.kind !== 'skill' || !getUnitSkills(unit).some(({ id }) => id === modifier.skill.id),
      );
    case 'passive':
      return !unit.boons.includes(boon.id);
  }
}

function dealsDamage(unit: Unit, damageType: 'physical' | 'magical'): boolean {
  return unit.weaponTypes.some((type) => WEAPON_DAMAGE_TYPES[type] === damageType);
}

// The boons a level up offers `unit`, rolled from `rng`: a stat boon, a
// skill (a second passive when it has none to learn) and a passive, each
// drawn at random from the ones it could take, topped up from whatever is
// left when a kind runs dry. Up to BOON_CHOICES, all different.
export function rollBoons(unit: Unit, rng: Rng): Boon[] {
  const eligible = BOONS.filter((boon) => isBoonEligible(unit, boon));
  const pool = (kind: BoonKind) =>
    shuffle(
      rng,
      eligible.filter((boon) => boon.kind === kind),
    );
  const stats = pool('stat');
  const skills = pool('skill');
  const passives = pool('passive');
  const picks = [stats[0], skills[0] ?? passives[1], passives[0]].filter((boon): boon is Boon => boon !== undefined);
  for (const boon of [...stats, ...passives, ...skills]) {
    if (picks.length >= BOON_CHOICES) break;
    if (!picks.includes(boon)) picks.push(boon);
  }
  return picks.slice(0, BOON_CHOICES);
}

// Gives `unit` `boon`: a stat boon raises its stat (getStatBoonGain; a max
// HP or MP gain raises the current value too), and the boon joins its
// boons. Changes `unit` itself, like levelUp: use it on a unit restored to
// be snapshotted again. The modifiers come with the unit's next restore.
export function takeBoon(unit: Unit, boon: Boon): Unit {
  const gain = getStatBoonGain(unit, boon);
  if (boon.stat && gain > 0) {
    const { stat } = boon.stat;
    if (stat === 'health') {
      unit.maxHealth += gain;
      unit.health += gain;
    } else if (stat === 'mana') {
      unit.maxMana += gain;
      unit.mana += gain;
    } else {
      unit[stat] += gain;
    }
  }
  unit.boons = Object.freeze([...unit.boons, boon.id]);
  return unit;
}
