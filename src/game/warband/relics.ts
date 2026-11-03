// Warband Mode's relics: run-long trinkets that bend a rule for the whole
// warband, like Slay the Spire's. A run starts with a pick of one of
// three (rollStartingRelics) and wins more from reward cards (rewards.ts).
// Most relics are plain modifiers (modifiers.ts) every unit of the
// warband carries into battle (getRelicModifiers); a few change a run
// rule instead, and the rule that reads them checks for them by id:
// Bounty Ledger (rewards.ts, the clear's gold), Phoenix Feather (run.ts,
// after a battle), Four-Leaf Clover (rewards.ts, the offer count) and
// Field Kitchen (camp.ts, the rest's cost). A modifier relic's flat
// damage, guard and healing grow with the stage like boons do (see
// getStageScalePercent in boons.ts), and the warband can hold up to
// MAX_RELIC_COPIES of one, each copy adding its modifiers again. Pure data
// and lookups.

import type { Modifier } from '../modifiers.ts';
import type { Rng } from '../combatStats.ts';
import { createSeededRng, shuffle } from '../rng.ts';
import { getStageScalePercent, scaleModifier } from './boons.ts';

export interface Relic {
  id: string;
  name: string;
  description: string;
  // What every unit of the warband carries into battle; empty for a
  // relic that changes a run rule instead.
  modifiers: readonly Modifier[];
  // The description with `{n}` where its first modifier's amount goes, for
  // a relic whose number changes with the stage or its copies.
  template?: string;
}

function relic(id: string, name: string, template: string, modifiers: readonly Modifier[] = []): Relic {
  const amount =
    modifiers[0] && 'amount' in modifiers[0]
      ? modifiers[0].amount
      : modifiers[0] && 'percent' in modifiers[0]
        ? modifiers[0].percent
        : null;
  const templated = template.includes('{n}') && amount !== null;
  return Object.freeze({
    id,
    name,
    description: templated ? template.replace('{n}', String(amount)) : template,
    modifiers: Object.freeze(modifiers.map((m) => Object.freeze(m))),
    ...(templated && { template }),
  });
}

// Gold Bounty Ledger pays for each enemy the warband defeats.
export const BOUNTY_GOLD_PER_KILL = 4;
// How many rewards a pick offers with the Four-Leaf Clover.
export const CLOVER_REWARD_CHOICES = 4;

export const BOUNTY_LEDGER = relic(
  'bounty-ledger',
  'Bounty Ledger',
  `Each enemy defeated pays ${BOUNTY_GOLD_PER_KILL} more gold when the stage is cleared.`,
);
export const PHOENIX_FEATHER = relic(
  'phoenix-feather',
  'Phoenix Feather',
  'The first ally to fall rises again at 1 HP after the battle. Then the feather burns away.',
);
export const FOUR_LEAF_CLOVER = relic(
  'four-leaf-clover',
  'Four-Leaf Clover',
  `Reward picks offer ${CLOVER_REWARD_CHOICES} choices instead of 3.`,
);
export const FIELD_KITCHEN = relic('field-kitchen', 'Field Kitchen', 'Resting at camp costs no gold.');
// How much the Lone Wolf relic raises a unit deployed alone, in percent.
export const LONE_WOLF_PERCENT = 60;

// Every relic, in the order the relic book lists them.
export const RELICS: readonly Relic[] = Object.freeze([
  relic('hawk-lens', "Hawk's Lens", 'Every unit has +{n} hit.', [{ kind: 'combat', term: 'hit', amount: 15 }]),
  relic('gamblers-coin', "Gambler's Coin", 'Every unit has +15 crit but −10 hit.', [
    { kind: 'combat', term: 'crit', amount: 15 },
    { kind: 'combat', term: 'hit', amount: -10 },
  ]),
  relic('feather-cloak', 'Feather Cloak', 'Every unit has +{n} avoid.', [
    { kind: 'combat', term: 'avoid', amount: 15 },
  ]),
  relic('duelists-gauntlet', "Duelist's Gauntlet", 'Units deal +{n} damage when they attack.', [
    { kind: 'combat', term: 'damage', amount: 2, when: 'attacking' },
  ]),
  relic('bulwark-crest', 'Bulwark Crest', 'Units take {n} less damage when attacked.', [
    { kind: 'combat', term: 'guard', amount: 2, when: 'defending' },
  ]),
  relic('berserkers-brand', "Berserker's Brand", 'Units under half HP deal +{n} damage.', [
    { kind: 'combat', term: 'damage', amount: 3, when: 'wounded' },
  ]),
  relic('hunters-charm', "Hunter's Charm", 'Units deal +{n} damage to monsters.', [
    { kind: 'combat', term: 'damage', amount: 2, when: 'vs-monster' },
  ]),
  relic('winged-boots', 'Winged Boots', 'Every unit has +{n} MOV.', [{ kind: 'movement', amount: 1 }]),
  relic('bloodpact', 'Bloodpact', 'A unit that defeats a foe heals {n} HP.', [{ kind: 'kill-heal', amount: 4 }]),
  relic('mending-charm', 'Mending Charm', 'Units recover {n} HP at the start of each of your phases.', [
    { kind: 'phase-heal', amount: 2 },
  ]),
  relic('mana-spring', 'Mana Spring', 'Units recover {n} MP at the start of each of your phases.', [
    { kind: 'phase-mana', amount: 1 },
  ]),
  relic('whetstone', 'Whetstone', 'A killing blow doesn’t wear the weapon.', [{ kind: 'spare-weapon-on-kill' }]),
  relic('lone-wolf', 'Lone Wolf', `A unit deployed alone has ${LONE_WOLF_PERCENT}% higher stats for the battle.`, [
    { kind: 'lone-wolf', percent: LONE_WOLF_PERCENT },
  ]),
  relic('scholars-quill', "Scholar's Quill", 'Every unit earns {n}% more XP.', [{ kind: 'experience', percent: 50 }]),
  BOUNTY_LEDGER,
  PHOENIX_FEATHER,
  FOUR_LEAF_CLOVER,
  FIELD_KITCHEN,
]);

// How many relics a run starts by choosing from.
export const STARTING_RELIC_CHOICES = 3;

// The relic with `id`, or null.
export function findRelic(id: string): Relic | null {
  return RELICS.find((candidate) => candidate.id === id) ?? null;
}

// Whether the run holds the relic `relic`.
export function hasRelic(run: { relics: readonly string[] }, relic: Pick<Relic, 'id'>): boolean {
  return run.relics.includes(relic.id);
}

// How many copies of one relic the warband can hold.
export const MAX_RELIC_COPIES = 2;

// The modifier kinds whose amounts add up, so a second copy of a relic
// made of them means something.
const STACKING_KINDS: ReadonlySet<Modifier['kind']> = new Set([
  'combat',
  'movement',
  'experience',
  'kill-heal',
  'phase-heal',
  'phase-mana',
]);

// Whether a second copy of `relic` adds anything: it's made only of
// modifiers that add up.
export function isStackingRelic(relic: Relic): boolean {
  return relic.modifiers.length > 0 && relic.modifiers.every((modifier) => STACKING_KINDS.has(modifier.kind));
}

// How many copies of relic `id` the warband holds.
export function countRelic(relicIds: readonly string[], id: string): number {
  return relicIds.filter((held) => held === id).length;
}

// `relic`'s modifiers at `stage`: flat damage, guard and healing grown by
// getStageScalePercent (rates, MOV, MP and XP stay as they are).
export function getScaledRelicModifiers(relic: Relic, stage = 1): Modifier[] {
  const percent = getStageScalePercent(stage);
  return relic.modifiers.map((modifier) => scaleModifier(modifier, 100, percent));
}

// Every modifier the relics `relicIds` give each unit at `stage`, in order
// (a second copy adds its modifiers again). Unknown ids give none.
export function getRelicModifiers(relicIds: readonly string[], stage = 1): Modifier[] {
  return relicIds.flatMap((id) => {
    const found = findRelic(id);
    return found ? getScaledRelicModifiers(found, stage) : [];
  });
}

// `relic`'s description at `stage` with `copies` held: its number as it
// stands then, all copies added up; one without a number notes the copies.
export function getRelicDescription(relic: Relic, stage = 1, copies = 1): string {
  const first = getScaledRelicModifiers(relic, stage)[0];
  const amount = first && 'amount' in first ? first.amount : first && 'percent' in first ? first.percent : 0;
  if (relic.template) return relic.template.replace('{n}', String(amount * Math.max(1, copies)));
  return copies > 1 ? `${relic.description} (×${copies})` : relic.description;
}

// The relics a run doesn't hold yet, in RELICS order.
export function getUnownedRelics(relicIds: readonly string[]): Relic[] {
  return RELICS.filter((candidate) => !relicIds.includes(candidate.id));
}

// The relics a reward can offer a run holding `relicIds`: the ones it
// doesn't hold, and another copy of a stacking one it holds fewer than
// MAX_RELIC_COPIES of, in RELICS order.
export function getOfferableRelics(relicIds: readonly string[]): Relic[] {
  return RELICS.filter((candidate) => {
    const copies = countRelic(relicIds, candidate.id);
    return copies === 0 || (copies < MAX_RELIC_COPIES && isStackingRelic(candidate));
  });
}

// Up to `count` different relics the run doesn't hold, in a random order
// from `rng`.
export function rollRelics(rng: Rng, relicIds: readonly string[], count: number): Relic[] {
  return shuffle(rng, getUnownedRelics(relicIds)).slice(0, Math.max(0, count));
}

// Up to `count` different relics a reward can offer the run holding
// `relicIds` (getOfferableRelics), in a random order from `rng`.
export function rollOfferableRelics(rng: Rng, relicIds: readonly string[], count: number): Relic[] {
  return shuffle(rng, getOfferableRelics(relicIds)).slice(0, Math.max(0, count));
}

// Whether the run holding `relicIds` can take another copy of relic `id`.
export function canTakeRelic(relicIds: readonly string[], id: string): boolean {
  return getOfferableRelics(relicIds).some((candidate) => candidate.id === id);
}

// The relics a run started with `runSeed` offers to start with: always
// the same for the same seed.
export function rollStartingRelics(runSeed: number): Relic[] {
  return shuffle(
    createSeededRng((runSeed ^ 0x7f4a7c15) >>> 0),
    getUnownedRelics([]).filter(({ id }) => !NOT_STARTING_RELICS.has(id)),
  ).slice(0, STARTING_RELIC_CHOICES);
}

// Relics a run never starts with: the Lone Wolf, since every run starts
// with a lone unit and no run should start strong.
const NOT_STARTING_RELICS: ReadonlySet<string> = new Set(['lone-wolf']);
