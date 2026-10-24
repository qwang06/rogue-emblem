// Warband Mode's stage rewards: what a run earns for clearing a stage. Every
// win pays gold (more for a flawless one, with nobody lost), then the
// player picks one of a few offered rewards, like Slay the Spire's card
// pick: recovery, gear, a relic (relics.ts), a level or gold. Offers are rolled
// from an Rng (seeded from the run, so a stage always offers the
// same picks) and each one is applied to the run as a pure function.

import { HEALTH_POTION, MAX_INVENTORY_SLOTS } from '../items.ts';
import { getExperienceToNextLevel, MAX_LEVEL, rollLevelUp, type LevelUpResult } from '../experience.ts';
import type { Rng } from '../combatStats.ts';
import { createSeededRng, randomInt, randomItem, shuffle } from '../rng.ts';
import { createUnitOfClass, UNIT_CLASSES, type UnitClass } from '../unitClasses.ts';
import { FIRE, IRON_AXE, IRON_BOW, IRON_SPEAR, canWield, type Weapon } from '../weapons.ts';
import { WARBAND_NAMES } from './names.ts';
import { ALL_STARTING_CLASSES } from './startingClasses.ts';
import {
  BOUNTY_GOLD_PER_KILL,
  BOUNTY_LEDGER,
  CLOVER_REWARD_CHOICES,
  findRelic,
  FOUR_LEAF_CLOVER,
  getUnownedRelics,
  hasRelic,
} from './relics.ts';
import {
  restoreUnit,
  snapshotUnit,
  type ItemSnapshot,
  type PendingReward,
  type RunState,
  type UnitSnapshot,
} from './run.ts';

// Gold for clearing any stage, plus more per stage reached.
export const STAGE_CLEAR_GOLD = 10;
export const STAGE_CLEAR_GOLD_PER_STAGE = 5;
// Extra gold when nobody died in the stage.
export const FLAWLESS_BONUS_GOLD = 10;

// How many rewards a stage offers to pick from.
export const REWARD_CHOICES = 3;
export const ARMS_CACHE_WEAPONS: readonly Weapon[] = Object.freeze([IRON_SPEAR, IRON_AXE, IRON_BOW, FIRE]);

// The most units a warband can hold.
export const MAX_ROSTER_SIZE = 8;

// The classes a recruit can be: every class but the warrior, which is
// only ever a starting pick.
export const RECRUIT_CLASS_IDS: readonly string[] = Object.freeze([
  'soldier',
  'archer',
  'vanguard',
  'guard',
  'acolyte',
]);

// Gold in a purse: a base plus more per stage.
export const PURSE_GOLD = 30;
export const PURSE_GOLD_PER_STAGE = 10;

// Skipping the pick pays a little gold instead: a base plus more per stage.
export const SKIP_GOLD = 10;
export const SKIP_GOLD_PER_STAGE = 5;
// Rerolling the offers costs gold, more for each reroll after a stage.
export const REROLL_COST = 10;
export const REROLL_COST_STEP = 10;

export type RewardKind = 'recruit' | 'rest' | 'supplies' | 'relic' | 'gold' | 'arms' | 'lesson';

export type Reward =
  // A new unit joins the roster.
  | { kind: 'recruit'; unit: UnitSnapshot }
  // Every unit is restored to full HP and mana.
  | { kind: 'rest' }
  // Every unit with room gets one of the item.
  | { kind: 'supplies'; itemId: string; label: string }
  // A relic the warband doesn't hold yet (see relics.ts).
  | { kind: 'relic'; relicId: string }
  // A fresh weapon in the convoy.
  | { kind: 'arms'; itemId: string; label: string; uses: number }
  // Every unit gains exactly the XP to its next level; `seed` rolls the
  // level ups' stat gains, so picking it always gives the same ones.
  | { kind: 'lesson'; seed: number }
  // Gold for the warband.
  | { kind: 'gold'; amount: number };

// The gold a cleared stage pays: STAGE_CLEAR_GOLD, STAGE_CLEAR_GOLD_PER_STAGE
// for each stage, FLAWLESS_BONUS_GOLD when `losses` (units that died in
// it) is 0, and with the Bounty Ledger among `relics`,
// BOUNTY_GOLD_PER_KILL for each of the `kills` enemies it defeated.
export function getStageClearGold(
  stage: number,
  losses: number,
  { kills = 0, relics = [] }: { kills?: number; relics?: readonly string[] } = {},
): { gold: number; flawless: boolean } {
  const flawless = losses === 0;
  const bounty = hasRelic({ relics }, BOUNTY_LEDGER) ? BOUNTY_GOLD_PER_KILL * kills : 0;
  return {
    gold: STAGE_CLEAR_GOLD + STAGE_CLEAR_GOLD_PER_STAGE * stage + (flawless ? FLAWLESS_BONUS_GOLD : 0) + bounty,
    flawless,
  };
}

// How many rewards a pick offers the run: REWARD_CHOICES, or
// CLOVER_REWARD_CHOICES with the Four-Leaf Clover.
export function getRewardChoices(run: Pick<RunState, 'relics'>): number {
  return hasRelic(run, FOUR_LEAF_CLOVER) ? CLOVER_REWARD_CHOICES : REWARD_CHOICES;
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
  return rollRewards(
    run,
    stage,
    createSeededRng((getRewardSeed(run.seed, stage) + rerolls) >>> 0),
    getRewardChoices(run),
  );
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
  const pending = run.pendingReward && { ...run.pendingReward, rerolls: rerolls + 1 };
  const after = freeze({ ...run, gold: run.gold - cost, ...(pending && { pendingReward: pending }) });
  return { run: after, rewards: rollStageRewards(after, stage, rerolls + 1) };
}

// The run after skipping the reward pick after `stage`: getSkipGold more.
export function skipRewards(run: RunState, stage: number): RunState {
  return clearPendingReward(addGold(run, getSkipGold(stage)));
}

// The run marked as owing the reward pick after a won stage, so a run
// saved before the pick reopens on it (getPendingRewardOffer).
export function markRewardPending(run: RunState, pending: PendingReward): RunState {
  return freeze({ ...run, pendingReward: pending });
}

// The run with no reward pick owed. Taking or skipping a reward clears it.
export function clearPendingReward(run: RunState): RunState {
  if (!run.pendingReward) return run;
  const { pendingReward: _settled, ...rest } = run;
  return freeze(rest);
}

// The reward pick a saved run still owes, with the same offers it had when
// it was saved (rolled again from the stage and its reroll count), or null
// when it owes none.
export function getPendingRewardOffer(run: RunState): (PendingReward & { rewards: readonly Reward[] }) | null {
  const pending = run.pendingReward;
  if (!pending) return null;
  const rewards = rollStageRewards(run, pending.stage, pending.rerolls);
  return rewards.length > 0 ? Object.freeze({ ...pending, rewards }) : null;
}

// The rewards offered after clearing `stage`, for `run` as it stands (the
// battle written back). Up to `count` of different kinds, in a random
// order, from the kinds that would do something:
// - rest, when anyone is missing HP or mana (never after stage 1, whose
//   quick fight leaves the warband near full)
// - supplies, when anyone has room for a Health Potion
// - arms, when anyone can wield an Arms Cache weapon
// - relic, while there's a relic the run doesn't hold
// - lesson, while anyone is below the max level
// - gold, always
export function rollRewards(
  run: RunState,
  stage: number,
  rng: Rng,
  count: number = REWARD_CHOICES,
  classes: readonly UnitClass[] = UNIT_CLASSES,
): readonly Reward[] {
  const kinds: RewardKind[] = [];
  if (stage !== 1 && run.roster.some((unit) => unit.health < unit.maxHealth || unit.mana < unit.maxMana)) {
    kinds.push('rest');
  }
  if (run.roster.some((unit) => canTakeItem(unit, HEALTH_POTION.id))) kinds.push('supplies');
  if (eligibleWeapons(run, classes).length > 0) kinds.push('arms');
  if (getUnownedRelics(run.relics).length > 0) kinds.push('relic');
  if (run.roster.some((unit) => unit.level < MAX_LEVEL)) kinds.push('lesson');
  kinds.push('gold');
  const picked = shuffle(rng, kinds).slice(0, Math.max(0, count));
  return Object.freeze(picked.map((kind) => Object.freeze(createReward(kind, run, stage, rng, classes))));
}

function createReward(kind: RewardKind, run: RunState, stage: number, rng: Rng, classes: readonly UnitClass[]): Reward {
  switch (kind) {
    case 'recruit':
      return { kind, unit: rollRecruit(run, stage, rng, classes) };
    case 'rest':
      return { kind };
    case 'supplies':
      return { kind, itemId: HEALTH_POTION.id, label: HEALTH_POTION.label };
    case 'relic':
      return { kind, relicId: randomItem(rng, getUnownedRelics(run.relics)).id };
    case 'arms': {
      const weapon = randomItem(rng, eligibleWeapons(run, classes));
      return { kind, itemId: weapon.id, label: weapon.label, uses: weapon.uses! };
    }
    case 'lesson':
      return { kind, seed: Math.floor(rng() * 2 ** 32) };
    case 'gold':
      return { kind, amount: PURSE_GOLD + PURSE_GOLD_PER_STAGE * stage };
  }
}

function eligibleWeapons(run: RunState, classes: readonly UnitClass[]): Weapon[] {
  return ARMS_CACHE_WEAPONS.filter((weapon) =>
    run.roster.some((snapshot) => canWield(restoreUnit(snapshot, classes).weaponTypes, weapon)),
  );
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

// The run with `reward` applied, and no reward pick owed. Rewards that
// can't do anything (a recruit when the roster is full, supplies nobody has
// room for) leave units as they are.
export function applyReward(run: RunState, reward: Reward, classes: readonly UnitClass[] = UNIT_CLASSES): RunState {
  return clearPendingReward(applyRewardEffect(run, reward, classes));
}

function applyRewardEffect(run: RunState, reward: Reward, classes: readonly UnitClass[]): RunState {
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
    case 'relic':
      return hasRelic(run, { id: reward.relicId }) ? run : freeze({ ...run, relics: [...run.relics, reward.relicId] });
    case 'arms':
      return freeze({ ...run, convoy: [...run.convoy, { itemId: reward.itemId, quantity: reward.uses }] });
    case 'lesson':
      return applyLessonReward(run, reward, classes).run;
    case 'gold':
      return addGold(run, reward.amount);
  }
}

// Each roster unit's HP and max HP (in roster order) after `reward`, for
// previewing a heal on the reward screen; null for a reward that doesn't
// restore HP. A Veteran's Lesson's max HP gains aren't previewed, so its
// level ups stay a surprise.
export function previewRewardHealth(
  run: RunState,
  reward: Reward,
  classes: readonly UnitClass[] = UNIT_CLASSES,
): readonly { health: number; maxHealth: number }[] | null {
  if (reward.kind !== 'rest') return null;
  return Object.freeze(
    applyRewardEffect(run, reward, classes).roster.map(({ health, maxHealth }) => Object.freeze({ health, maxHealth })),
  );
}

// A unit's level up from a lesson reward or a stage clear, for showing it.
export interface RewardLevelUp {
  name: string;
  unitClass: string | null;
  levelUp: LevelUpResult;
}

// The run after a lesson reward (with no reward pick owed): every unit given exactly the XP to
// its next level (unscaled, so each lands on it with 0 XP; nothing for a
// unit at the max level), its stat gains rolled from the reward's seed. Also
// returns each level up, in roster order, so it can be shown.
export function applyLessonReward(
  run: RunState,
  reward: Extract<Reward, { kind: 'lesson' }>,
  classes: readonly UnitClass[] = UNIT_CLASSES,
): { run: RunState; levelUps: readonly RewardLevelUp[] } {
  const rng = createSeededRng(reward.seed);
  const levelUps: RewardLevelUp[] = [];
  const roster = run.roster.map((snapshot) => {
    const unit = restoreUnit(snapshot, classes);
    const result = unit.gainExperience(getExperienceToNextLevel(unit.level, unit.experience), rng, false);
    levelUps.push(...result.levelUps.map((levelUp) => ({ name: unit.name, unitClass: unit.unitClass, levelUp })));
    return snapshotUnit(snapshot.id, unit);
  });
  return { run: clearPendingReward(freeze({ ...run, roster })), levelUps: Object.freeze(levelUps) };
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
      const pitch = ALL_STARTING_CLASSES.find((starting) => starting.id === unit.classId)?.description;
      return {
        label: `Recruit ${unit.name}`,
        description: `A level ${unit.level} ${className} joins the warband.${pitch ? ` ${pitch}` : ''}`,
      };
    }
    case 'rest':
      return { label: 'Rest', description: 'The whole warband recovers to full HP and mana.' };
    case 'supplies':
      return { label: 'Supplies', description: `Every unit with room gets a ${reward.label}.` };
    case 'relic': {
      const relic = findRelic(reward.relicId);
      return { label: relic?.name ?? reward.relicId, description: relic?.description ?? '' };
    }
    case 'arms':
      return { label: 'Arms Cache', description: `A fresh ${reward.label} goes to the convoy (${reward.uses} uses).` };
    case 'lesson':
      return { label: "Veteran's Lesson", description: 'Every unit gains enough XP to reach its next level.' };
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
    relics: Object.freeze([...run.relics]),
    ...(run.pendingReward && { pendingReward: Object.freeze({ ...run.pendingReward }) }),
  });
}
