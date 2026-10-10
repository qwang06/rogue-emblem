// Warband Mode's stage rewards: what a run earns for clearing a stage. Every
// win pays gold (more for a flawless one, with nobody lost), then the
// player picks one of a few offered rewards, like Slay the Spire's card
// pick: a recruit, a rest, supplies, training or a purse of gold. Offers
// are rolled from an Rng (seeded from the run, so a stage always offers the
// same picks) and each one is applied to the run as a pure function. A
// recruit is rolled in full when it's offered, so the screen can show its
// stats before it's picked.

import { HEALTH_POTION, MAX_INVENTORY_SLOTS } from '../items.ts';
import { rollLevelUp } from '../experience.ts';
import type { Rng } from '../combatStats.ts';
import { createSeededRng, randomInt, randomItem, shuffle } from '../rng.ts';
import { createUnitOfClass, UNIT_CLASSES, type UnitClass } from '../unitClasses.ts';
import { WARBAND_NAMES } from './names.ts';
import { STARTING_CLASSES } from './startingClasses.ts';
import { snapshotUnit, type ItemSnapshot, type RunState, type UnitSnapshot } from './run.ts';

// Gold for clearing any stage, plus more per stage reached.
export const STAGE_CLEAR_GOLD = 10;
export const STAGE_CLEAR_GOLD_PER_STAGE = 5;
// Extra gold when nobody died in the stage.
export const FLAWLESS_BONUS_GOLD = 10;

// How many rewards a stage offers to pick from.
export const REWARD_CHOICES = 3;

// The most units a warband can hold; recruits stop being offered at it.
export const MAX_ROSTER_SIZE = 8;

// The classes a recruit can be: every class but the villager, which is
// only ever a starting pick.
export const RECRUIT_CLASS_IDS: readonly string[] = Object.freeze([
  'soldier',
  'archer',
  'vanguard',
  'wizard',
  'guard',
  'acolyte',
]);

// How much max HP Training adds to every unit.
export const TRAINING_MAX_HEALTH = 2;
// Gold in a purse: a base plus more per stage.
export const PURSE_GOLD = 30;
export const PURSE_GOLD_PER_STAGE = 10;

// Skipping the pick pays a little gold instead: a base plus more per stage.
export const SKIP_GOLD = 10;
export const SKIP_GOLD_PER_STAGE = 5;
// Rerolling the offers costs gold, more for each reroll after a stage.
export const REROLL_COST = 10;
export const REROLL_COST_STEP = 10;

export type RewardKind = 'recruit' | 'rest' | 'supplies' | 'training' | 'gold';

export type Reward =
  // A new unit joins the roster.
  | { kind: 'recruit'; unit: UnitSnapshot }
  // Every unit is restored to full HP and mana.
  | { kind: 'rest' }
  // Every unit with room gets one of the item.
  | { kind: 'supplies'; itemId: string; label: string }
  // Every unit gains max HP (and as much current HP).
  | { kind: 'training'; maxHealth: number }
  // Gold for the warband.
  | { kind: 'gold'; amount: number };

// The gold a cleared stage pays: STAGE_CLEAR_GOLD, STAGE_CLEAR_GOLD_PER_STAGE
// for each stage, and FLAWLESS_BONUS_GOLD when `losses` (units that died in
// it) is 0.
export function getStageClearGold(stage: number, losses: number): { gold: number; flawless: boolean } {
  const flawless = losses === 0;
  return {
    gold: STAGE_CLEAR_GOLD + STAGE_CLEAR_GOLD_PER_STAGE * stage + (flawless ? FLAWLESS_BONUS_GOLD : 0),
    flawless,
  };
}

// The seed for the reward offers after `stage` of a run started with
// `runSeed`: fixed per pair, so a reload offers the same picks.
export function getRewardSeed(runSeed: number, stage: number): number {
  const rng = createSeededRng((runSeed ^ Math.imul(stage + 0x51ed, 0x85ebca6b)) >>> 0);
  return Math.floor(rng() * 2 ** 32);
}

// The gold skipping the reward pick after `stage` pays.
export function getSkipGold(stage: number): number {
  return SKIP_GOLD + SKIP_GOLD_PER_STAGE * stage;
}

// What rerolling the offers costs when they've already been rerolled
// `rerolls` times this stage.
export function getRerollCost(rerolls: number): number {
  return REROLL_COST + REROLL_COST_STEP * rerolls;
}

// The offers after `stage`, rerolled `rerolls` times: rollRewards seeded
// from getRewardSeed and the reroll count, so a stage's offers, and each
// reroll of them, are always the same.
export function rollStageRewards(run: RunState, stage: number, rerolls: number = 0): readonly Reward[] {
  return rollRewards(run, stage, createSeededRng((getRewardSeed(run.seed, stage) + rerolls) >>> 0));
}

// Rerolling the offers after `stage` for the `rerolls + 1`th time: the run
// with getRerollCost(rerolls) gold spent and the new offers, or null when
// the run can't afford it.
export function rerollRewards(
  run: RunState,
  stage: number,
  rerolls: number,
): { run: RunState; rewards: readonly Reward[] } | null {
  const cost = getRerollCost(rerolls);
  if (run.gold < cost) return null;
  const after = freeze({ ...run, gold: run.gold - cost });
  return { run: after, rewards: rollStageRewards(after, stage, rerolls + 1) };
}

// The run after skipping the reward pick after `stage`: getSkipGold more.
export function skipRewards(run: RunState, stage: number): RunState {
  return addGold(run, getSkipGold(stage));
}

// The rewards offered after clearing `stage`, for `run` as it stands (the
// battle written back). Up to `count` of different kinds, in a random
// order, from the kinds that would do something:
// - recruit, while the roster is under MAX_ROSTER_SIZE; always offered (and
//   first) while the roster is smaller than the deploy cap, so a lone
//   starting unit is never left without a chance at company
// - rest, when anyone is missing HP or mana
// - supplies, when anyone has room for a Health Potion
// - training and gold, always
// Stage 1 is different: its offers are one recruit of each starting class
// (see rollFirstStageRecruits), so the lone unit a run starts with gets to
// pick its first companion.
export function rollRewards(
  run: RunState,
  stage: number,
  rng: Rng,
  count: number = REWARD_CHOICES,
  classes: readonly UnitClass[] = UNIT_CLASSES,
): readonly Reward[] {
  if (stage === 1 && run.roster.length < MAX_ROSTER_SIZE)
    return rollFirstStageRecruits(run, stage, rng, count, classes);
  const needsRecruit = run.roster.length < run.deployCap && run.roster.length < MAX_ROSTER_SIZE;
  const kinds: RewardKind[] = [];
  if (run.roster.length < MAX_ROSTER_SIZE && !needsRecruit) kinds.push('recruit');
  if (run.roster.some((unit) => unit.health < unit.maxHealth || unit.mana < unit.maxMana)) kinds.push('rest');
  if (run.roster.some((unit) => canTakeItem(unit, HEALTH_POTION.id))) kinds.push('supplies');
  kinds.push('training', 'gold');
  const picked = [...(needsRecruit ? ['recruit' as const] : []), ...shuffle(rng, kinds)].slice(0, Math.max(0, count));
  return Object.freeze(picked.map((kind) => Object.freeze(createReward(kind, run, stage, rng, classes))));
}

// The rewards after stage 1: a recruit of each STARTING_CLASSES class, in
// that order, each with a different name, up to `count`.
export function rollFirstStageRecruits(
  run: RunState,
  stage: number,
  rng: Rng,
  count: number = REWARD_CHOICES,
  classes: readonly UnitClass[] = UNIT_CLASSES,
): readonly Reward[] {
  const takenNames: string[] = [];
  const rewards = STARTING_CLASSES.slice(0, Math.max(0, count)).map(({ id }) => {
    const unit = rollRecruit(run, stage, rng, classes, { classId: id, takenNames });
    takenNames.push(unit.name);
    return Object.freeze<Reward>({ kind: 'recruit', unit });
  });
  return Object.freeze(rewards);
}

function createReward(kind: RewardKind, run: RunState, stage: number, rng: Rng, classes: readonly UnitClass[]): Reward {
  switch (kind) {
    case 'recruit':
      return { kind, unit: rollRecruit(run, stage, rng, classes) };
    case 'rest':
      return { kind };
    case 'supplies':
      return { kind, itemId: HEALTH_POTION.id, label: HEALTH_POTION.label };
    case 'training':
      return { kind, maxHealth: TRAINING_MAX_HEALTH };
    case 'gold':
      return { kind, amount: PURSE_GOLD + PURSE_GOLD_PER_STAGE * stage };
  }
}

// A recruit for `run`: a `classId` unit (a random RECRUIT_CLASS_IDS class
// when none is given) at the roster's average level (rounded down, at least
// 1), its level ups rolled from its growths, named from WARBAND_NAMES (one
// nobody in the run has and that isn't in `takenNames`; "Recruit" once
// they've all been used), with an id no unit in the run has.
export function rollRecruit(
  run: RunState,
  stage: number,
  rng: Rng,
  classes: readonly UnitClass[] = UNIT_CLASSES,
  { classId, takenNames = [] }: { classId?: string; takenNames?: readonly string[] } = {},
): UnitSnapshot {
  const everyone = [...run.roster, ...run.fallen];
  const usedNames = new Set([...everyone.map((unit) => unit.name), ...takenNames]);
  const names = WARBAND_NAMES.filter((name) => !usedNames.has(name));
  const name = names.length > 0 ? randomItem(rng, names) : 'Recruit';
  classId ??= randomItem(rng, RECRUIT_CLASS_IDS);
  const totalLevel = run.roster.reduce((sum, unit) => sum + unit.level, 0);
  const level = Math.max(1, Math.floor(totalLevel / Math.max(1, run.roster.length)));
  const unit = createUnitOfClass(classId, { name, team: 'player' }, classes);
  while (unit.level < level) unit.levelUp(rollLevelUp(unit, unit.growths, rng, unit.caps));
  const usedIds = new Set(everyone.map((snapshot) => snapshot.id));
  let id = `recruit-${stage}`;
  while (usedIds.has(id)) id = `recruit-${stage}-${randomInt(rng, 0, 9999)}`;
  return snapshotUnit(id, unit);
}

// The run with `reward` applied. Rewards that can't do anything (a recruit
// when the roster is full, supplies nobody has room for) leave units as
// they are.
export function applyReward(run: RunState, reward: Reward, classes: readonly UnitClass[] = UNIT_CLASSES): RunState {
  switch (reward.kind) {
    case 'recruit':
      if (run.roster.length >= MAX_ROSTER_SIZE) return run;
      return freeze({ ...run, roster: [...run.roster, reward.unit] });
    case 'rest':
      return mapRoster(run, (unit) => ({ ...unit, health: unit.maxHealth, mana: unit.maxMana }));
    case 'supplies':
      return mapRoster(run, (unit) =>
        canTakeItem(unit, reward.itemId) ? { ...unit, items: addItem(unit.items, reward.itemId) } : unit,
      );
    case 'training':
      return mapRoster(run, (unit) => {
        const cap = getHealthCap(unit.classId, classes);
        const gain = Math.max(0, Math.min(reward.maxHealth, cap - unit.maxHealth));
        return { ...unit, maxHealth: unit.maxHealth + gain, health: unit.health + gain };
      });
    case 'gold':
      return addGold(run, reward.amount);
  }
}

// The run with `amount` more gold.
export function addGold(run: RunState, amount: number): RunState {
  return freeze({ ...run, gold: run.gold + Math.max(0, amount) });
}

// A short label and one-line description of `reward`, for the reward
// screen.
export function describeReward(
  reward: Reward,
  classes: readonly UnitClass[] = UNIT_CLASSES,
): { label: string; description: string } {
  switch (reward.kind) {
    case 'recruit': {
      const { unit } = reward;
      const className = classes.find((unitClass) => unitClass.id === unit.classId)?.label ?? unit.classId;
      const pitch = STARTING_CLASSES.find((starting) => starting.id === unit.classId)?.description;
      return {
        label: `Recruit ${unit.name}`,
        description: `A level ${unit.level} ${className} joins the warband.${pitch ? ` ${pitch}` : ''}`,
      };
    }
    case 'rest':
      return { label: 'Rest', description: 'The whole warband recovers to full HP and mana.' };
    case 'supplies':
      return { label: 'Supplies', description: `Every unit with room gets a ${reward.label}.` };
    case 'training':
      return { label: 'Training', description: `Every unit gains +${reward.maxHealth} max HP.` };
    case 'gold':
      return { label: `${reward.amount} Gold`, description: 'A purse of coin, for the camp to come.' };
  }
}

// Whether `unit` can take one more `itemId`: it already carries some (and
// they stack), or has a free inventory slot.
function canTakeItem(unit: UnitSnapshot, itemId: string): boolean {
  return unit.items.some((entry) => entry.itemId === itemId) || unit.items.length < MAX_INVENTORY_SLOTS;
}

function addItem(items: readonly ItemSnapshot[], itemId: string): ItemSnapshot[] {
  if (items.some((entry) => entry.itemId === itemId)) {
    return items.map((entry) => (entry.itemId === itemId ? { ...entry, quantity: entry.quantity + 1 } : entry));
  }
  return [...items, { itemId, quantity: 1 }];
}

function getHealthCap(classId: string, classes: readonly UnitClass[]): number {
  return createUnitOfClass(classId, { name: '', team: 'player' }, classes).caps.health ?? Infinity;
}

function mapRoster(run: RunState, update: (unit: UnitSnapshot) => UnitSnapshot): RunState {
  return freeze({ ...run, roster: run.roster.map(update) });
}

function freeze(run: RunState): RunState {
  return Object.freeze({
    ...run,
    roster: Object.freeze(
      run.roster.map((unit) =>
        Object.freeze({ ...unit, items: Object.freeze(unit.items.map((item) => Object.freeze({ ...item }))) }),
      ),
    ),
  });
}
