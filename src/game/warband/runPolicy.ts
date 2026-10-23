// The default policy for playing a Warband run by itself (see autoRun.ts):
// how it picks rewards and what it does at camp. Each decision is a small
// rule over the run, with its thresholds as named constants to tune. The
// battles are played by the battle AI (battle/ai.ts). Pure: each function
// reads a session and returns the next command.

import { planPlayerDeployment, planPlayerTurn } from '../battle/playerAI.ts';
import type { BattleState } from '../battle/state.ts';
import { isStaff } from '../healing.ts';
import type { Item } from '../items.ts';
import type { Unit } from '../Unit.ts';
import { createUnitOfClass } from '../unitClasses.ts';
import { canWield, isWeapon } from '../weapons.ts';
import type { RunPolicy } from './autoRun.ts';
import { canRest } from './camp.ts';
import { canGiveFromConvoy, lookUpItem } from './convoy.ts';
import { canBuy, getItemPrice, MERCHANT_STOCK } from './merchant.ts';
import { MAX_ROSTER_SIZE, type Reward } from './rewards.ts';
import { restoreUnit, type RunState, type UnitSnapshot } from './run.ts';
import { getRewardOffers, type RunCommand, type RunSession } from './runCommands.ts';

// A weapon or staff with this many uses or fewer is about to break: the
// unit wants a spare.
export const LOW_USES = 5;
// Rest at once when anyone deploying is under this share of their HP...
export const REST_BELOW_HEALTH = 0.5;
// ...and otherwise when the deploying units are missing this share of
// their HP between them.
export const REST_MISSING_HEALTH = 0.25;

// How much the policy wants each reward (higher is better); see scoreReward.
export const REWARD_SCORES = Object.freeze({
  // A recruit while the roster can't fill the deploy slots.
  recruitNeeded: 100,
  // A recruit otherwise, plus a bonus for a class the roster lacks.
  recruit: 30,
  newClassBonus: 10,
  arms: 32,
  drill: 35,
  lesson: 50,
  // Rest scores this times the share of HP the roster is missing.
  restPerMissing: 100,
  training: 15,
  supplies: 10,
  gold: 20,
});

// The units that deploy next stage: the healthiest deployCap of the
// roster (by share of health), as the player battle AI picks them
// (planPlayerDeployment).
export function getDeployingUnits(run: RunState): readonly UnitSnapshot[] {
  return [...run.roster].sort((a, b) => b.health / b.maxHealth - a.health / a.maxHealth).slice(0, run.deployCap);
}

// How much the policy wants `reward` for `run`.
export function scoreReward(run: RunState, reward: Reward): number {
  switch (reward.kind) {
    case 'recruit': {
      if (run.roster.length >= MAX_ROSTER_SIZE) return 0;
      if (run.roster.length < run.deployCap) return REWARD_SCORES.recruitNeeded;
      const isNew = !run.roster.some((unit) => unit.classId === reward.unit.classId);
      return REWARD_SCORES.recruit + (isNew ? REWARD_SCORES.newClassBonus : 0);
    }
    case 'rest':
      return REWARD_SCORES.restPerMissing * getMissingHealthShare(run.roster);
    case 'arms':
      return REWARD_SCORES.arms;
    case 'drill':
      return REWARD_SCORES.drill;
    case 'lesson':
      return REWARD_SCORES.lesson;
    case 'training':
      return REWARD_SCORES.training;
    case 'supplies':
      return REWARD_SCORES.supplies;
    case 'gold':
      return REWARD_SCORES.gold;
  }
}

// The reward pick: the best-scoring offer (the first of equals), or skip
// when there's none.
export function pickReward(session: RunSession): RunCommand {
  const offers = getRewardOffers(session);
  if (offers.length === 0) return { type: 'skip-reward' };
  let best = 0;
  offers.forEach((reward, index) => {
    if (scoreReward(session.run, reward) > scoreReward(session.run, offers[best])) best = index;
  });
  return { type: 'pick-reward', index: best };
}

// Camp, one command at a time, in this order:
// 1. rest if anyone deploying is badly hurt (REST_BELOW_HEALTH)
// 2. each deploying unit armed: equip its best carried weapon (or staff)
//    if what it holds is about to break, else take one from the convoy,
//    else buy one
// 3. rest if the deploying units are missing enough HP between them
// 4. march
export function planCamp(session: RunSession, stock: readonly string[] = MERCHANT_STOCK): RunCommand {
  const { run } = session;
  const deploying = getDeployingUnits(run);
  if (canRest(run) && deploying.some((unit) => unit.health < unit.maxHealth * REST_BELOW_HEALTH)) {
    return { type: 'rest' };
  }
  for (const snapshot of deploying) {
    const command = armUnit(run, snapshot, stock);
    if (command) return command;
  }
  if (canRest(run) && getMissingHealthShare(deploying) >= REST_MISSING_HEALTH) return { type: 'rest' };
  return { type: 'march' };
}

// The policy autoRun plays with by default: the player battle AI
// (playerAI.ts) in battle, and pickReward and planCamp between battles.
export const DEFAULT_POLICY: RunPolicy = Object.freeze({
  battle: (state: BattleState) => (state.stage === 'deployment' ? planPlayerDeployment(state) : planPlayerTurn(state)),
  reward: pickReward,
  camp: (session: RunSession) => planCamp(session),
});

// The share of max HP `units` are missing between them, 0 to 1.
function getMissingHealthShare(units: readonly UnitSnapshot[]): number {
  const max = units.reduce((sum, unit) => sum + unit.maxHealth, 0);
  const missing = units.reduce((sum, unit) => sum + unit.maxHealth - unit.health, 0);
  return max > 0 ? missing / max : 0;
}

// What arms `snapshot` for the next stage, or null when it already is (or
// nothing can). A healer (isHealer) is armed with a staff, anyone else
// with a weapon it can wield.
function armUnit(run: RunState, snapshot: UnitSnapshot, stock: readonly string[]): RunCommand | null {
  const unit = restoreUnit(snapshot);
  const heals = isHealer(snapshot.classId);
  const fits = (item: Item) => (heals ? isStaff(item) : isWeapon(item) && canWield(unit.weaponTypes, item));
  const carried = unit.items
    .map((entry, index) => ({ index, uses: usesOf(entry.item, entry.quantity), fits: fits(entry.item) }))
    .filter((entry) => entry.fits);
  const held = carried.find((entry) => entry.index === getHeldIndex(unit, heals));
  if (held && held.uses > LOW_USES) return null;
  const best = carried.reduce<(typeof carried)[number] | null>(
    (top, entry) => (!top || entry.uses > top.uses ? entry : top),
    null,
  );
  if (best && best.uses > LOW_USES) {
    // A staff is used from anywhere in the inventory; only weapons equip.
    return heals ? null : { type: 'equip', unitId: snapshot.id, itemIndex: best.index };
  }
  const convoyIndex = run.convoy.findIndex(
    (entry, index) =>
      fits(lookUpItem(entry.itemId)) &&
      usesOf(lookUpItem(entry.itemId), entry.quantity) > LOW_USES &&
      canGiveFromConvoy(run, snapshot.id, index),
  );
  if (convoyIndex >= 0) return { type: 'give', unitId: snapshot.id, convoyIndex };
  // Only buy what the unit has room to take, or it would sit in the
  // convoy and be bought again.
  if (!canTakeOneMore(run, snapshot)) return null;
  const [buy] = stock
    .filter((itemId) => fits(lookUpItem(itemId)) && canBuy(run, itemId, stock))
    .sort(
      (a, b) =>
        preference(snapshot.classId, b) - preference(snapshot.classId, a) ||
        getItemPrice(lookUpItem(a)) - getItemPrice(lookUpItem(b)),
    );
  return buy ? { type: 'buy', itemId: buy } : null;
}

// Whether units of `classId` heal rather than fight: their class starts
// with a staff.
function isHealer(classId: string): boolean {
  return createUnitOfClass(classId, { name: '', team: 'player' }).items.some((entry) => isStaff(entry.item));
}

// The inventory slot of what the unit fights or heals with: its equipped
// weapon, or for a healer its first staff.
function getHeldIndex(unit: Unit, heals: boolean): number | null {
  if (!heals) return unit.equippedWeapon?.index ?? null;
  const index = unit.items.findIndex((entry) => isStaff(entry.item));
  return index >= 0 ? index : null;
}

// Uses left of a carried item; a weapon that never breaks counts as endless.
function usesOf(item: Item, quantity: number): number {
  if (isWeapon(item)) return item.uses === null ? Infinity : quantity;
  return isStaff(item) ? quantity : 0;
}

// How much a unit of `classId` would rather buy `itemId`: what its class
// starts with first (an archer's bow), then a weapon that strikes from as
// far as its class's first weapon.
function preference(classId: string, itemId: string): number {
  const starter = createUnitOfClass(classId, { name: '', team: 'player' });
  const item = lookUpItem(itemId);
  const own = starter.items.some((entry) => entry.item.id === itemId);
  const ranged = isWeapon(item) && item.maxRange > 1;
  const startsRanged = (starter.weapon?.maxRange ?? 1) > 1;
  return (own ? 2 : 0) + (ranged === startsRanged ? 1 : 0);
}

// Whether the unit has room for one more item from the convoy (a bought
// one arrives at the convoy's end).
function canTakeOneMore(run: RunState, snapshot: UnitSnapshot): boolean {
  const probe = { ...run, convoy: [...run.convoy, { itemId: MERCHANT_STOCK[0], quantity: 1 }] };
  return canGiveFromConvoy(probe, snapshot.id, probe.convoy.length - 1);
}
