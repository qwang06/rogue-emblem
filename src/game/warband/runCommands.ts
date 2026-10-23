// Everything a player does in a Warband run between battles, as plain JSON
// commands applied by one dispatcher, the way battle/commands.ts does it for
// a battle: pick, skip or reroll the stage's reward, then at camp rest, buy,
// sell, move items between units and the convoy, and march on. The game's
// screens send these, and so can a script or an AI (see runner.ts), so both
// take the same path. Pure: each command takes a session to a new one and
// leaves the old one alone.

import type { BattleOutcome } from '../turns.ts';
import { canRest, restAtCamp } from './camp.ts';
import {
  canEquipInRoster,
  canGiveFromConvoy,
  canStoreInConvoy,
  equipInRoster,
  giveFromConvoy,
  storeInConvoy,
} from './convoy.ts';
import { buyItem, canBuy, canSell, MERCHANT_STOCK, sellItem } from './merchant.ts';
import {
  addGold,
  applyLessonReward,
  applyReward,
  getPendingRewardOffer,
  getStageClearGold,
  markRewardPending,
  rerollRewards,
  rollStageRewards,
  skipRewards,
  type RewardLevelUp,
  type Reward,
} from './rewards.ts';
import { finishStage, snapshotUnit, type BattleResult, type RunState } from './run.ts';
import { GUEST_UNIT_ID, rollGuest, settleGuest } from './recruitment.ts';
import { MAX_ROSTER_SIZE } from './rewards.ts';
import { applyStageClearExperience } from './stageClearExperience.ts';

// Where a run stands: fighting its stage's battle, picking the reward a won
// stage owes, at camp, or over (the warband fell).
export type RunPhase = 'battle' | 'recruit' | 'reward' | 'camp' | 'over' | 'won';

export interface RunSession {
  readonly run: RunState;
  readonly phase: RunPhase;
}

export type RunCommand =
  | { type: 'pick-recruit'; index: number }
  | { type: 'decline-recruit' }
  // Takes offer `index` of the reward pick.
  | { type: 'pick-reward'; index: number }
  // Skips the reward pick for gold (see getSkipGold).
  | { type: 'skip-reward' }
  // Rolls the reward offers again for gold (see getRerollCost).
  | { type: 'reroll-rewards' }
  // Camp: every unit back to full HP and mana, for gold.
  | { type: 'rest' }
  // Camp: buys a merchant item into the convoy.
  | { type: 'buy'; itemId: string }
  // Camp: sells the convoy entry at `convoyIndex`.
  | { type: 'sell'; convoyIndex: number }
  // Camp: hands the convoy entry at `convoyIndex` to a unit.
  | { type: 'give'; unitId: string; convoyIndex: number }
  // Camp: puts a unit's item at `itemIndex` in the convoy.
  | { type: 'store'; unitId: string; itemIndex: number }
  // Camp: equips (or wears) a unit's item at `itemIndex`.
  | { type: 'equip'; unitId: string; itemIndex: number }
  // Camp: leaves for the next stage's battle.
  | { type: 'march' };

export type RunCommandType = RunCommand['type'];

// What a command did that a screen may want to show beyond the new run.
export type RunEvent =
  // A lesson reward's or a stage clear's level ups, in roster order.
  { type: 'level-ups'; levelUps: readonly RewardLevelUp[] };

export interface RunCommandResult {
  session: RunSession;
  events: readonly RunEvent[];
}

// A command that isn't allowed where the run stands.
export class RunCommandError extends Error {
  constructor(
    readonly command: RunCommand,
    message: string,
  ) {
    super(message);
    this.name = 'RunCommandError';
  }
}

// The commands camp accepts; the reward pick accepts the rest but march.
const CAMP_COMMANDS: ReadonlySet<RunCommandType> = new Set(['rest', 'buy', 'sell', 'give', 'store', 'equip', 'march']);
const REWARD_COMMANDS: ReadonlySet<RunCommandType> = new Set(['pick-reward', 'skip-reward', 'reroll-rewards']);
const RECRUIT_COMMANDS: ReadonlySet<RunCommandType> = new Set(['pick-recruit', 'decline-recruit']);

// A session for `run` as it was saved: on its reward pick if it owes one,
// else about to fight its stage.
export function resumeRunSession(run: RunState): RunSession {
  return freeze({ run, phase: run.pendingRecruitment ? 'recruit' : getPendingRewardOffer(run) ? 'reward' : 'battle' });
}

// The session after its stage's battle ends with `outcome` (see
// finishBattleWithEvents).
export function finishBattle(
  session: RunSession,
  result: BattleResult,
  outcome: BattleOutcome,
  finalStage?: number,
): RunSession {
  return finishBattleWithEvents(session, result, outcome, finalStage).session;
}

// The session after its stage's battle ends with `outcome`: the battle
// written back (finishStage). A defeat, or a win that leaves nobody, ends
// the run; a win on `finalStage` wins it ('won'); any other win levels up
// the units below the level the stage guarantees (applyStageClearExperience,
// reported as a `level-ups` event), pays the clear's gold and owes the
// reward pick, or goes straight to camp when there's nothing to offer.
export function finishBattleWithEvents(
  session: RunSession,
  result: BattleResult,
  outcome: BattleOutcome,
  finalStage?: number,
): RunCommandResult {
  if (session.phase !== 'battle') throw new Error(`No battle to finish while the run is at ${session.phase}`);
  const before = session.run;
  const finished = finishStage(before, result, outcome, finalStage);
  if (finished.over)
    return { session: freeze({ run: finished.run, phase: finished.won ? 'won' : 'over' }), events: [] };
  const leveled = applyStageClearExperience(finished.run, before.stage);
  const events: RunEvent[] = leveled.levelUps.length > 0 ? [{ type: 'level-ups', levelUps: leveled.levelUps }] : [];
  const clear = getStageClearGold(before.stage, finished.run.fallen.length - before.fallen.length);
  const paid = addGold(leveled.run, clear.gold);
  const guest = result.units.get(GUEST_UNIT_ID);
  const candidate = guest?.isAlive() && paid.roster.length < MAX_ROSTER_SIZE ? rollGuest(before) : null;
  const pending =
    candidate && guest
      ? {
          pendingRecruitment: before.stage,
          pendingGuest: Object.freeze({ ...snapshotUnit(candidate.id, guest), name: candidate.name }),
        }
      : {};
  if (rollStageRewards(paid, before.stage).length === 0) {
    const run = Object.freeze({ ...paid, ...pending });
    return { session: freeze({ run, phase: candidate ? 'recruit' : 'camp' }), events };
  }
  const run = markRewardPending(paid, {
    stage: before.stage,
    rerolls: 0,
    clearGold: clear.gold,
    flawless: clear.flawless,
  });
  const owing = Object.freeze({ ...run, ...pending });
  return { session: freeze({ run: owing, phase: candidate ? 'recruit' : 'reward' }), events };
}

export function getRecruitOffers(session: RunSession): readonly Reward[] {
  return session.phase === 'recruit' && session.run.pendingGuest
    ? [{ kind: 'recruit', unit: session.run.pendingGuest }]
    : [];
}

// The reward offers the session's pick shows, or none when it isn't on one.
export function getRewardOffers(session: RunSession): readonly Reward[] {
  return session.phase === 'reward' ? (getPendingRewardOffer(session.run)?.rewards ?? []) : [];
}

// Applies `command`, or throws a RunCommandError when it isn't allowed: a
// camp command away from camp, a reward command away from the pick, or
// one the run can't do (no gold, no such item, no room).
export function applyRunCommand(session: RunSession, command: RunCommand): RunCommandResult {
  const fail = (message: string): never => {
    throw new RunCommandError(command, message);
  };
  if (session.phase === 'camp' && !CAMP_COMMANDS.has(command.type)) fail(`${command.type} isn't done at camp`);
  if (session.phase === 'reward' && !REWARD_COMMANDS.has(command.type)) fail(`${command.type} isn't a reward pick`);
  if (session.phase === 'recruit' && !RECRUIT_COMMANDS.has(command.type)) fail(`${command.type} isn't a recruit pick`);
  if (session.phase === 'battle' || session.phase === 'over' || session.phase === 'won')
    fail(`${command.type} isn't done during ${session.phase}`);
  const { run } = session;
  const camp = (next: RunState): RunCommandResult => ({ session: freeze({ run: next, phase: 'camp' }), events: [] });

  switch (command.type) {
    case 'pick-recruit': {
      const offer = getRecruitOffers(session)[command.index];
      if (!offer || offer.kind !== 'recruit') return fail(`No recruit offer ${command.index}`);
      const next = settleGuest(run, true);
      return { session: freeze({ run: next, phase: next.pendingReward ? 'reward' : 'camp' }), events: [] };
    }
    case 'decline-recruit': {
      const next = settleGuest(run, false);
      return { session: freeze({ run: next, phase: next.pendingReward ? 'reward' : 'camp' }), events: [] };
    }
    case 'pick-reward': {
      const reward = getRewardOffers(session)[command.index];
      if (!reward) return fail(`No reward offer ${command.index}`);
      if (reward.kind !== 'lesson') return camp(applyReward(run, reward));
      const { run: next, levelUps } = applyLessonReward(run, reward);
      return { session: freeze({ run: next, phase: 'camp' }), events: [{ type: 'level-ups', levelUps }] };
    }
    case 'skip-reward':
      return camp(skipRewards(run, run.pendingReward!.stage));
    case 'reroll-rewards': {
      const pending = run.pendingReward!;
      const rerolled = rerollRewards(run, pending.stage, pending.rerolls);
      if (!rerolled) return fail('Not enough gold to reroll');
      return { session: freeze({ run: rerolled.run, phase: 'reward' }), events: [] };
    }
    case 'rest':
      if (!canRest(run)) return fail('Resting needs someone hurt and the gold for it');
      return camp(restAtCamp(run));
    case 'buy':
      if (!canBuy(run, command.itemId)) return fail(`Can't buy ${command.itemId}`);
      return camp(buyItem(run, command.itemId));
    case 'sell':
      if (!canSell(run, command.convoyIndex)) return fail(`Can't sell convoy item ${command.convoyIndex}`);
      return camp(sellItem(run, command.convoyIndex));
    case 'give':
      if (!canGiveFromConvoy(run, command.unitId, command.convoyIndex)) {
        return fail(`Can't give convoy item ${command.convoyIndex} to ${command.unitId}`);
      }
      return camp(giveFromConvoy(run, command.unitId, command.convoyIndex));
    case 'store':
      if (!canStoreInConvoy(run, command.unitId, command.itemIndex)) {
        return fail(`Can't store ${command.unitId}'s item ${command.itemIndex}`);
      }
      return camp(storeInConvoy(run, command.unitId, command.itemIndex));
    case 'equip':
      if (!canEquipInRoster(run, command.unitId, command.itemIndex)) {
        return fail(`Can't equip ${command.unitId}'s item ${command.itemIndex}`);
      }
      return camp(equipInRoster(run, command.unitId, command.itemIndex));
    case 'march':
      return { session: freeze({ run, phase: 'battle' }), events: [] };
  }
}

// Every command the session accepts as it stands, for an AI to choose
// from: each reward offer, skip, and reroll when affordable on the pick;
// at camp, rest when it can, each affordable stock item, each sellable
// convoy entry, each give, store and equip that's allowed, and march.
export function getLegalRunCommands(session: RunSession, stock: readonly string[] = MERCHANT_STOCK): RunCommand[] {
  const commands: RunCommand[] = [];
  if (session.phase === 'recruit') {
    getRecruitOffers(session).forEach((_, index) => commands.push({ type: 'pick-recruit', index }));
    commands.push({ type: 'decline-recruit' });
    return commands;
  }
  if (session.phase === 'reward') {
    getRewardOffers(session).forEach((_, index) => commands.push({ type: 'pick-reward', index }));
    commands.push({ type: 'skip-reward' });
    const pending = session.run.pendingReward!;
    if (rerollRewards(session.run, pending.stage, pending.rerolls)) commands.push({ type: 'reroll-rewards' });
    return commands;
  }
  if (session.phase !== 'camp') return commands;
  const { run } = session;
  if (canRest(run)) commands.push({ type: 'rest' });
  for (const itemId of stock) if (canBuy(run, itemId, stock)) commands.push({ type: 'buy', itemId });
  run.convoy.forEach((_, convoyIndex) => {
    if (canSell(run, convoyIndex)) commands.push({ type: 'sell', convoyIndex });
  });
  for (const unit of run.roster) {
    const unitId = unit.id;
    run.convoy.forEach((_, convoyIndex) => {
      if (canGiveFromConvoy(run, unitId, convoyIndex)) commands.push({ type: 'give', unitId, convoyIndex });
    });
    unit.items.forEach((_, itemIndex) => {
      if (canStoreInConvoy(run, unitId, itemIndex)) commands.push({ type: 'store', unitId, itemIndex });
      if (canEquipInRoster(run, unitId, itemIndex)) commands.push({ type: 'equip', unitId, itemIndex });
    });
  }
  commands.push({ type: 'march' });
  return commands;
}

function freeze(session: RunSession): RunSession {
  return Object.freeze(session);
}
