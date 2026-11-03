// Level-up boons, Vampire Survivors style: each level a Warband unit gains
// (in battle, from a stage clear or from a Veteran's Lesson) also lets it
// pick one of three boons, on top of the level's growth gains. A boon is
// one of:
// - a stat boon: +2 to a stat (+4 max HP), taken as often as offered;
// - a skill boon: one of the skills its own class can learn this way
//   (CLASS_SKILL_PICKS in skills.ts), never another class's;
// - a passive: a modifier (modifiers.ts) the unit carries into every
//   battle, like a relic for one unit, taken up to its max rank (each
//   rank adds its amount again).
// Every stat and passive offer also rolls a rarity (common, rare, epic,
// legendary), which multiplies its numbers, and grows with the stage it's
// offered at (getStageScalePercent), so a late pick keeps pace with the
// enemies. A taken boon is kept on the unit as an entry string
// (`Unit.boons`, saved on its snapshot) that names the boon, its rarity
// and its stage scale (encodeBoonEntry); restoreUnit in run.ts gives the
// unit the scaled modifiers. Offers are rolled from an Rng (seeded from
// the run, see levelUpPicks.ts). Pure.

import type { Rng } from '../combatStats.ts';
import type { GrowthStat } from '../experience.ts';
import type { Modifier } from '../modifiers.ts';
import { weightedShuffle } from '../rng.ts';
import {
  CLASS_SKILL_PICKS,
  CLEAVE,
  describeSkill,
  getClassSkillPicks,
  getUnitSkills,
  POWER_STRIKE,
  SHIELD_BASH,
  THROW_STONES,
  type Skill,
} from '../skills.ts';
import type { Unit } from '../Unit.ts';
import { getAffinityWeight, getBoonTags, getUnitTagCounts, type BoonTag } from './boonTags.ts';
import { WEAPON_DAMAGE_TYPES } from '../weapons.ts';

export type BoonKind = 'stat' | 'skill' | 'passive';

export const BOON_RARITIES = Object.freeze(['common', 'rare', 'epic', 'legendary'] as const);
export type BoonRarity = (typeof BOON_RARITIES)[number];

// What each rarity multiplies a boon's numbers by, in percent.
export const RARITY_PERCENT: Readonly<Record<BoonRarity, number>> = Object.freeze({
  common: 100,
  rare: 150,
  epic: 250,
  legendary: 400,
});

export const RARITY_LABELS: Readonly<Record<BoonRarity, string>> = Object.freeze({
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
});

export interface Boon {
  // The boon's own id, whatever its rarity, scale or rank.
  id: string;
  kind: BoonKind;
  // With its rank after the first ("Brawler II").
  name: string;
  description: string;
  // A stat boon's stat and how much it raises it.
  stat?: { stat: GrowthStat; amount: number };
  // What the unit carries into battle once it has the boon.
  modifiers: readonly Modifier[];
  rarity: BoonRarity;
  // The stage scale it was rolled at, in percent (100 before it grows).
  stagePercent: number;
  // Which rank of it this is: 1 for the first time it's taken.
  rank: number;
  // How it's kept on the unit once taken (encodeBoonEntry).
  entry: string;
  // The builds it belongs to (boonTags.ts).
  tags: readonly BoonTag[];
}

// How many boons a level up offers.
export const BOON_CHOICES = 3;
// How much a stat boon raises its stat, and max HP, before rarity and
// stage scaling.
export const STAT_BOON_AMOUNT = 2;
export const HEALTH_BOON_AMOUNT = 4;
// How many times a passive can be taken, unless it sets fewer.
export const MAX_BOON_RANK = 5;
// Boons grow by BOON_SCALE_RATE for every stage past BOON_SCALE_FROM_STAGE,
// the same rate as the enemies.
export const BOON_SCALE_FROM_STAGE = 4;
export const BOON_SCALE_RATE = 1.06;
// The chance a level up's passive slot offers a passive the unit already
// has (its next rank), when it has one to rank up, so builds focus.
export const OWNED_PASSIVE_CHANCE = 0.35;
// Ferocity's and Thick Skin's percent per rank, before rarity.
export const FEROCITY_PERCENT = 8;
export const THICK_SKIN_PERCENT = 8;
// Twin Strike's chance and Finisher's HP threshold per rank, in percent,
// before rarity.
export const TWIN_STRIKE_PERCENT = 10;
export const FINISHER_PERCENT = 4;
// Cleave Through's splash and Chain Kill's chance per rank, in percent,
// before rarity.
export const CLEAVE_THROUGH_PERCENT = 25;
export const CHAIN_KILL_PERCENT = 20;
// The tiles a Momentum kill lets a unit move on, per rank.
export const MOMENTUM_MOVEMENT = 2;

const STAT_LABELS: Readonly<Partial<Record<GrowthStat, string>>> = Object.freeze({
  health: 'HP',
  strength: 'STR',
  intelligence: 'INT',
  dexterity: 'DEX',
  speed: 'SPD',
  luck: 'LCK',
  defense: 'DEF',
  resistance: 'RES',
});

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

// How a boon is made at a rarity, stage scale and rank: everything but its
// fields that don't change.
interface BoonDefinition {
  id: string;
  kind: BoonKind;
  name: string;
  // The most ranks a passive can have (MAX_BOON_RANK unless set).
  maxRank: number;
  stat?: { stat: GrowthStat; amount: number };
  modifiers: readonly Modifier[];
  // The description, from the boon's scaled amount (a stat boon's raise,
  // or a passive's first modifier's amount or percent).
  describe: (amount: number) => string;
}

function statBoon(stat: GrowthStat, name: string): BoonDefinition {
  const amount = stat === 'health' ? HEALTH_BOON_AMOUNT : STAT_BOON_AMOUNT;
  const label = stat === 'health' ? 'max HP' : STAT_LABELS[stat]!;
  return {
    id: `stat-${stat}`,
    kind: 'stat',
    name,
    maxRank: Infinity,
    stat: { stat, amount },
    modifiers: [],
    describe: (raise) => `+${raise} ${label}. Can be taken again.`,
  };
}

function skillBoon(skill: Skill): BoonDefinition {
  return {
    id: `skill-${skill.id}`,
    kind: 'skill',
    name: `Learn ${skill.label}`,
    maxRank: 1,
    modifiers: [{ kind: 'skill', skill }],
    describe: () => `${describeSkill(skill)} (${skill.manaCost} MP)`,
  };
}

// Skills boons once taught to any class. They're never offered now (each
// is in no class's picks), but a unit saved with one keeps it.
const RETIRED_SKILLS: readonly Skill[] = [POWER_STRIKE, CLEAVE, SHIELD_BASH, THROW_STONES];

// A skill boon for each skill a class can be offered, then the retired
// ones, each once.
const SKILL_BOON_SKILLS: readonly Skill[] = [...Object.values(CLASS_SKILL_PICKS).flat(), ...RETIRED_SKILLS].filter(
  (skill, i, all) => all.findIndex(({ id }) => id === skill.id) === i,
);

function passive(
  id: string,
  name: string,
  modifier: Modifier,
  describe: (amount: number) => string,
  maxRank = MAX_BOON_RANK,
): BoonDefinition {
  return { id, kind: 'passive', name, maxRank, modifiers: [modifier], describe };
}

const DEFINITIONS: readonly BoonDefinition[] = [
  statBoon('health', 'Vigor'),
  statBoon('strength', 'Might'),
  statBoon('intelligence', 'Insight'),
  statBoon('dexterity', 'Precision'),
  statBoon('speed', 'Swiftness'),
  statBoon('luck', 'Fortune'),
  statBoon('defense', 'Toughness'),
  statBoon('resistance', 'Warding'),
  ...SKILL_BOON_SKILLS.map(skillBoon),
  passive('keen-eye', 'Keen Eye', { kind: 'combat', term: 'hit', amount: 15 }, (a) => `+${a} hit.`),
  passive('deadly', 'Deadly', { kind: 'combat', term: 'crit', amount: 10 }, (a) => `+${a} crit.`),
  passive('nimble', 'Nimble', { kind: 'combat', term: 'avoid', amount: 15 }, (a) => `+${a} avoid.`),
  passive(
    'brawler',
    'Brawler',
    { kind: 'combat', term: 'damage', amount: 3, when: 'attacking' },
    (a) => `+${a} damage when it attacks.`,
  ),
  passive(
    'stalwart',
    'Stalwart',
    { kind: 'combat', term: 'guard', amount: 3, when: 'defending' },
    (a) => `Takes ${a} less damage when attacked.`,
  ),
  passive(
    'monster-hunter',
    'Monster Hunter',
    { kind: 'combat', term: 'damage', amount: 3, when: 'vs-monster' },
    (a) => `+${a} damage against monsters.`,
  ),
  passive(
    'wrath',
    'Wrath',
    { kind: 'combat', term: 'damage', amount: 4, when: 'wounded' },
    (a) => `+${a} damage while under half HP.`,
  ),
  passive('fleet', 'Fleet', { kind: 'movement', amount: 1 }, (a) => `+${a} MOV.`, 2),
  passive(
    'bloodthirst',
    'Bloodthirst',
    { kind: 'kill-heal', amount: 4 },
    (a) => `Heals ${a} HP when it defeats a foe.`,
  ),
  passive(
    'regeneration',
    'Regeneration',
    { kind: 'phase-heal', amount: 2 },
    (a) => `Recovers ${a} HP at the start of each of your phases.`,
  ),
  passive(
    'focus',
    'Focus',
    { kind: 'phase-mana', amount: 1 },
    (a) => `Recovers ${a} MP at the start of each of your phases.`,
  ),
  passive('quick-study', 'Quick Study', { kind: 'experience', percent: 50 }, (a) => `Earns ${a}% more XP.`, 2),
  passive(
    'ferocity',
    'Ferocity',
    { kind: 'combat', term: 'damage-percent', amount: FEROCITY_PERCENT },
    (a) => `Deals ${a}% more damage, after defense.`,
  ),
  passive(
    'thick-skin',
    'Thick Skin',
    { kind: 'combat', term: 'guard-percent', amount: THICK_SKIN_PERCENT },
    (a) => `Takes ${a}% less damage, after defense.`,
  ),
  passive(
    'twin-strike',
    'Twin Strike',
    { kind: 'twin-strike', percent: TWIN_STRIKE_PERCENT },
    (a) => `${a}% chance for each of its strikes to strike again at once.`,
  ),
  passive(
    'finisher',
    'Finisher',
    { kind: 'finisher', percent: FINISHER_PERCENT },
    (a) => `A hit that leaves a foe at ${a}% of its max HP or less fells it.`,
  ),
  passive(
    'cleave-through',
    'Cleave Through',
    { kind: 'cleave-through', percent: CLEAVE_THROUGH_PERCENT },
    (a) => `Each hit also deals ${a}% of its damage to the target's neighbouring foes.`,
  ),
  passive(
    'chain-kill',
    'Chain Kill',
    { kind: 'chain-kill', percent: CHAIN_KILL_PERCENT },
    (a) => `${a}% chance that defeating a foe earns a free strike on another in reach.`,
  ),
  passive(
    'momentum',
    'Momentum',
    { kind: 'momentum', amount: MOMENTUM_MOVEMENT },
    (a) => `Defeating a foe with an attack lets the unit move ${a} more tiles.`,
    2,
  ),
];

const DEFINITION_BY_ID: ReadonlyMap<string, BoonDefinition> = new Map(DEFINITIONS.map((d) => [d.id, d]));

// What a taken boon's entry says: which boon, its rarity and its stage
// scale.
export interface BoonEntry {
  id: string;
  rarity: BoonRarity;
  stagePercent: number;
}

// How a taken boon is kept on a unit: its id alone for a common one at
// the base scale (so older saves read as that), else `id|rarity|percent`.
export function encodeBoonEntry({ id, rarity, stagePercent }: BoonEntry): string {
  return rarity === 'common' && stagePercent === 100 ? id : `${id}|${rarity}|${stagePercent}`;
}

// The boon, rarity and stage scale an entry names (see encodeBoonEntry);
// anything unreadable after the id counts as common at the base scale.
export function parseBoonEntry(entry: string): BoonEntry {
  const [id, rarity, percent] = entry.split('|');
  const stagePercent = Number(percent);
  return {
    id,
    rarity: (BOON_RARITIES as readonly string[]).includes(rarity) ? (rarity as BoonRarity) : 'common',
    stagePercent: Number.isInteger(stagePercent) && stagePercent >= 100 ? stagePercent : 100,
  };
}

// The boon ids in `entries`, in order (repeats kept).
export function getBoonIds(entries: readonly string[]): string[] {
  return entries.map((entry) => parseBoonEntry(entry).id);
}

// How many times a unit with `entries` has taken boon `id`: its rank.
export function getBoonRank(entries: readonly string[], id: string): number {
  return getBoonIds(entries).filter((taken) => taken === id).length;
}

// How much boons offered at `stage` grow, in percent: 100 up to
// BOON_SCALE_FROM_STAGE, then BOON_SCALE_RATE more for each stage past it.
export function getStageScalePercent(stage: number): number {
  return Math.round(100 * BOON_SCALE_RATE ** Math.max(0, stage - BOON_SCALE_FROM_STAGE));
}

// `amount` multiplied by `percent`, rounded, but never below `amount`.
function scaleAmount(amount: number, percent: number): number {
  return amount <= 0 ? amount : Math.max(amount, Math.round((amount * percent) / 100));
}

// A modifier at a rarity and stage scale: flat damage, guard and healing
// grow with both; rates (hit, avoid, crit), the percent terms and MP grow
// with rarity only; MOV, XP and skills don't change.
export function scaleModifier(modifier: Modifier, rarityPercent: number, stagePercent: number): Modifier {
  const both = Math.round((rarityPercent * stagePercent) / 100);
  switch (modifier.kind) {
    case 'combat': {
      const flat = modifier.term === 'damage' || modifier.term === 'guard';
      return { ...modifier, amount: scaleAmount(modifier.amount, flat ? both : rarityPercent) };
    }
    case 'kill-heal':
    case 'phase-heal':
      return { ...modifier, amount: scaleAmount(modifier.amount, both) };
    case 'phase-mana':
      return { ...modifier, amount: scaleAmount(modifier.amount, rarityPercent) };
    case 'twin-strike':
    case 'finisher':
    case 'cleave-through':
    case 'chain-kill':
    case 'lifesteal':
      return { ...modifier, percent: scaleAmount(modifier.percent, rarityPercent) };
    default:
      return modifier;
  }
}

function modifierAmount(modifier: Modifier | undefined): number {
  if (!modifier) return 0;
  if ('amount' in modifier) return modifier.amount;
  if ('percent' in modifier) return modifier.percent;
  return 0;
}

function makeBoon(definition: BoonDefinition, entry: BoonEntry, rank: number): Boon {
  const { rarity, stagePercent } =
    definition.kind === 'skill' ? { rarity: 'common' as const, stagePercent: 100 } : entry;
  const rarityPercent = RARITY_PERCENT[rarity];
  const stat = definition.stat && {
    stat: definition.stat.stat,
    amount: scaleAmount(definition.stat.amount, Math.round((rarityPercent * stagePercent) / 100)),
  };
  const modifiers = definition.modifiers.map((modifier) => scaleModifier(modifier, rarityPercent, stagePercent));
  const shownRank = definition.kind === 'passive' ? rank : 1;
  return Object.freeze({
    id: definition.id,
    kind: definition.kind,
    name: shownRank > 1 ? `${definition.name} ${ROMAN[shownRank] ?? shownRank}` : definition.name,
    description: definition.describe(stat ? stat.amount : modifierAmount(modifiers[0])),
    ...(stat && { stat: Object.freeze(stat) }),
    modifiers: Object.freeze(modifiers.map((modifier) => Object.freeze(modifier))),
    rarity,
    stagePercent,
    rank: shownRank,
    entry: encodeBoonEntry({ id: definition.id, rarity, stagePercent }),
    tags: getBoonTags(definition.id),
  });
}

// Every boon as a first-rank common one at the base scale.
export const BOONS: readonly Boon[] = Object.freeze(
  DEFINITIONS.map((definition) => makeBoon(definition, { id: definition.id, rarity: 'common', stagePercent: 100 }, 1)),
);

// The boon with `id` (or the one an entry names) as a first-rank common one
// at the base scale, or null.
export function findBoon(id: string): Boon | null {
  const baseId = parseBoonEntry(id).id;
  return BOONS.find((boon) => boon.id === baseId) ?? null;
}

// The boon a taken `entry` gives, at its rarity and scale, as rank `rank`;
// null for an unknown boon.
export function findTakenBoon(entry: string, rank = 1): Boon | null {
  const parsed = parseBoonEntry(entry);
  const definition = DEFINITION_BY_ID.get(parsed.id);
  return definition ? makeBoon(definition, parsed, rank) : null;
}

// The boons a unit with `entries` has taken, in order, each with the rank
// it was taken at.
export function getTakenBoonList(entries: readonly string[]): Boon[] {
  const seen = new Map<string, number>();
  return entries.flatMap((entry) => {
    const id = parseBoonEntry(entry).id;
    const rank = (seen.get(id) ?? 0) + 1;
    seen.set(id, rank);
    const boon = findTakenBoon(entry, rank);
    return boon ? [boon] : [];
  });
}

// Every modifier the taken boons `entries` give, in order. Unknown ids
// give none; repeats stack.
export function getBoonModifiers(entries: readonly string[]): Modifier[] {
  return entries.flatMap((entry) => findTakenBoon(entry)?.modifiers ?? []);
}

// How much a stat boon raises a unit's stat: its full scaled amount,
// since stats have no caps. 0 for other boons.
export function getStatBoonGain(boon: Boon): number {
  return boon.stat?.amount ?? 0;
}

// Whether `unit` could take `boon`: a stat boon (STR only for a unit with
// physical weapons, INT only for one with magical ones), a skill its class
// can be offered (getClassSkillPicks) that it doesn't know yet, or a
// passive below its max rank.
export function isBoonEligible(unit: Unit, boon: Boon): boolean {
  switch (boon.kind) {
    case 'stat': {
      const stat = boon.stat!.stat;
      if (stat === 'strength' && !dealsDamage(unit, 'physical')) return false;
      if (stat === 'intelligence' && !dealsDamage(unit, 'magical')) return false;
      return true;
    }
    case 'skill': {
      const picks = getClassSkillPicks(unit.unitClass);
      const known = getUnitSkills(unit);
      return boon.modifiers.every(
        (modifier) =>
          modifier.kind !== 'skill' ||
          (picks.some(({ id }) => id === modifier.skill.id) && !known.some(({ id }) => id === modifier.skill.id)),
      );
    }
    case 'passive': {
      const maxRank = DEFINITION_BY_ID.get(boon.id)?.maxRank ?? MAX_BOON_RANK;
      return getBoonRank(unit.boons, boon.id) < maxRank;
    }
  }
}

function dealsDamage(unit: Unit, damageType: 'physical' | 'magical'): boolean {
  return unit.weaponTypes.some((type) => WEAPON_DAMAGE_TYPES[type] === damageType);
}

// The odds of each rarity at `stage` for a unit with `luck`, in percent
// (summing to 100): from 80 / 17 / 3 / 0 at stage 1 to 35 / 35 / 22 / 8 by
// stage 30, with half a point of luck moved off common for each point of
// LCK (half to rare, 30% to epic, 20% to legendary).
export function getRarityOdds(stage: number, luck = 0): Record<BoonRarity, number> {
  const t = Math.min(1, Math.max(0, (stage - 1) / 29));
  const odds = { common: 80 - 45 * t, rare: 17 + 18 * t, epic: 3 + 19 * t, legendary: 8 * t };
  const shift = Math.min(odds.common, Math.max(0, luck) * 0.5);
  return {
    common: odds.common - shift,
    rare: odds.rare + shift * 0.5,
    epic: odds.epic + shift * 0.3,
    legendary: odds.legendary + shift * 0.2,
  };
}

// A rarity rolled from `rng` with getRarityOdds(stage, luck).
export function rollBoonRarity(rng: Rng, stage: number, luck = 0): BoonRarity {
  const odds = getRarityOdds(stage, luck);
  let roll = rng() * 100;
  for (const rarity of BOON_RARITIES) {
    roll -= odds[rarity];
    if (roll < 0) return rarity;
  }
  return 'common';
}

// The boons a level up at `stage` offers `unit`, rolled from `rng`: a stat
// boon, a skill (a second passive when it has none to learn) and a
// passive, each drawn at random from the ones it could take, topped up
// from whatever is left when a kind runs dry. Each draw leans toward the
// boons sharing tags with the unit's class and the passives and skills it
// has taken (getAffinityWeight in boonTags.ts), so builds form. The passive slot offers the
// next rank of one the unit has OWNED_PASSIVE_CHANCE of the time. Each
// stat and passive offer then rolls its rarity and grows with the stage.
// Up to BOON_CHOICES, all different, never one of the `banished` ids.
export function rollBoons(unit: Unit, rng: Rng, stage = 1, banished: readonly string[] = []): Boon[] {
  const eligible = BOONS.filter((boon) => !banished.includes(boon.id) && isBoonEligible(unit, boon));
  const tagCounts = getUnitTagCounts(unit.unitClass, unit.boons);
  const pool = (kind: BoonKind) =>
    weightedShuffle(
      rng,
      eligible.filter((boon) => boon.kind === kind),
      (boon) => getAffinityWeight(boon.id, tagCounts),
    );
  const stats = pool('stat');
  const skills = pool('skill');
  const passives = pool('passive');
  const owned = passives.filter((boon) => getBoonRank(unit.boons, boon.id) > 0);
  if (owned.length > 0 && rng() < OWNED_PASSIVE_CHANCE) {
    passives.splice(passives.indexOf(owned[0]), 1);
    passives.unshift(owned[0]);
  }
  const picks = [stats[0], skills[0] ?? passives[1], passives[0]].filter((boon): boon is Boon => boon !== undefined);
  for (const boon of [...stats, ...passives, ...skills]) {
    if (picks.length >= BOON_CHOICES) break;
    if (!picks.includes(boon)) picks.push(boon);
  }
  const stagePercent = getStageScalePercent(stage);
  return picks.slice(0, BOON_CHOICES).map((boon) => {
    const rarity = boon.kind === 'skill' ? 'common' : rollBoonRarity(rng, stage, unit.luck);
    return makeBoon(
      DEFINITION_BY_ID.get(boon.id)!,
      { id: boon.id, rarity, stagePercent },
      getBoonRank(unit.boons, boon.id) + 1,
    );
  });
}

// Gives `unit` `boon`: a stat boon raises its stat (getStatBoonGain; a max
// HP or MP gain raises the current value too), and the boon's entry joins
// its boons. Changes `unit` itself, like levelUp: use it on a unit restored
// to be snapshotted again. The modifiers come with the unit's next restore.
export function takeBoon(unit: Unit, boon: Boon): Unit {
  const gain = getStatBoonGain(boon);
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
  unit.boons = Object.freeze([...unit.boons, boon.entry]);
  return unit;
}
