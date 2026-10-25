// Everything a player does in a Warband run between battles, as plain JSON
// commands applied by one dispatcher, the way battle/commands.ts does it for
// a battle: pick the relic a run starts with, take each level up's boon,
// pick, skip or reroll the stage's reward, then at camp rest, buy,
// sell, move items between units and the convoy, and march on. The game's
// screens send these, and so can a script or an AI (see runner.ts), so both
// take the same path. Pure: each command takes a session to a new one and
// leaves the old one alone.

import type { BattleOutcome } from '../turns.ts';
import { canRest, hasMerchant, restAtCamp } from './camp.ts';
import {
  canEquipInRoster,
  canGiveFromConvoy,
  canStoreInConvoy,
  equipInRoster,
  giveFromConvoy,
  storeInConvoy,
} from './convoy.ts';
import { buyItemFor, canBuy, canBuyFor, canSell, MERCHANT_STOCK, sellItem } from './merchant.ts';
import {
  addGold,
  applyLessonReward,
  applyReward,
  getPendingRewardOffer,
  markRewardPending,
  rerollRewards,
  rollStageRewards,
  skipRewards,
  type RewardLevelUp,
  type Reward,
} from './rewards.ts';
import { getBoonOffer, pickBoon, queueLevelUpBoons } from './levelUpPicks.ts';
import { rollRelics, rollStartingRelics, STARTING_RELIC_CHOICES, type Relic } from './relics.ts';
import { getRelicPicks } from './origins.ts';
import { getRunHeat } from './heat.ts';
import { createSeededRng } from '../rng.ts';
import { finishStage, snapshotUnit, type BattleResult, type RunState } from './run.ts';
import { GUEST_UNIT_ID, rollGuest, settleGuest } from './recruitment.ts';
import { MAX_ROSTER_SIZE } from './rewards.ts';
import { applyStageClearExperience } from './stageClearExperience.ts';
import { getEventChoices, resolveEvent } from './events.ts';
import type { Realm } from './realm/realm.ts';
import { BATTLE_SITES } from './realm/realm.ts';
import {
  canTravel,
  getClearGold,
  getRunSite,
  getTravelChoices,
  isFinalBattle,
  isRealmRun,
  isSiteDone,
  travelTo,
} from './travel.ts';

// Where a run stands: picking the relic it starts with, fighting its
// stage's battle, taking the boons its level ups owe, recruiting a guest,
// picking the reward a won stage owes, at camp, choosing where to travel on
// the realm (travel.ts), choosing at a wayside event (events.ts), or over
// (the warband fell, or won).
export type RunPhase =
  'relic' | 'battle' | 'boon' | 'recruit' | 'reward' | 'camp' | 'travel' | 'event' | 'over' | 'won';

export interface RunSession {
  readonly run: RunState;
  readonly phase: RunPhase;
}

export type RunCommand =
  // Takes starting relic `index` (see rollStartingRelics).
  | { type: 'pick-relic'; index: number }
  // Takes boon `index` of the first level-up pick owed (see getBoonOffer).
  | { type: 'pick-boon'; index: number }
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
  // Camp: buys a merchant item into the convoy, or straight into the
  // inventory of the unit `unitId` when it's given.
  | { type: 'buy'; itemId: string; unitId?: string }
  // Camp: sells the convoy entry at `convoyIndex`.
  | { type: 'sell'; convoyIndex: number }
  // Camp: hands the convoy entry at `convoyIndex` to a unit.
  | { type: 'give'; unitId: string; convoyIndex: number }
  // Camp: puts a unit's item at `itemIndex` in the convoy.
  | { type: 'store'; unitId: string; itemIndex: number }
  // Camp: equips (or wears) a unit's item at `itemIndex`.
  | { type: 'equip'; unitId: string; itemIndex: number }
  // Camp: leaves for the next stage's battle, or on the realm, to choose
  // where to travel.
  | { type: 'march' }
  // Travel: goes to the realm site `siteId`, one the roads lead to.
  | { type: 'travel'; siteId: string }
  // Takes choice `index` of the wayside event the run stands at (events.ts).
  | { type: 'pick-event'; index: number };

export type RunCommandType = RunCommand['type'];

// What a command did that a screen may want to show beyond the new run.
export type RunEvent =
  // A lesson reward's or a stage clear's level ups, in roster order.
  | { type: 'level-ups'; levelUps: readonly RewardLevelUp[] }
  // What came of a wayside event's choice.
  | { type: 'event-outcome'; text: string };

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

// What a command may need beyond the session: the run's realm, for
// travel (see travel.ts).
export interface RunCommandContext {
  realm?: Realm;
}

// A new run's session, about to pick the relic (or relics, see
// getRelicPicks) it starts with.
export function startRunSession(run: RunState): RunSession {
  return freeze({ run, phase: 'relic' });
}

// A session for `run` as it was saved: on the boon, recruit or reward pick
// it owes, in that order; else on the realm, choosing where to travel once
// its site is done, at camp in a town, or about to fight its site; on a
// linear run, about to fight its stage.
export function resumeRunSession(run: RunState): RunSession {
  const phase = getPickPhase(run);
  if (phase !== 'camp') return freeze({ run, phase });
  if (run.pendingEvent) return freeze({ run, phase: 'event' });
  if (!isRealmRun(run)) return freeze({ run, phase: 'battle' });
  if (getRunSite(run)?.kind === 'town') return freeze({ run, phase: 'camp' });
  return freeze({ run, phase: isSiteDone(run) ? 'travel' : 'battle' });
}

// Where a won stage goes next: the boon picks its level ups owe, then the
// guest's recruitment, then the reward pick, then camp.
function getPickPhase(run: RunState): RunPhase {
  if (getBoonOffer(run)) return 'boon';
  if (run.pendingRecruitment) return 'recruit';
  if (getPendingRewardOffer(run)) return 'reward';
  return 'camp';
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
// reported as a `level-ups` event), owes a boon pick for every level the
// stage gained (queueLevelUpBoons), pays the clear's gold (with the
// Bounty Ledger's for the warband's kills) and owes the reward pick, or goes
// straight to camp when there's nothing to offer.
// How many foes the warband's own units felled in `result` (a guest's
// kills don't count), for the Bounty Ledger.
export function countWarbandKills(run: RunState, result: BattleResult): number {
  return run.roster.reduce((total, { id }) => total + (result.kills?.get(id) ?? 0), 0);
}

export function finishBattleWithEvents(
  session: RunSession,
  result: BattleResult,
  outcome: BattleOutcome,
  finalStage?: number,
): RunCommandResult {
  if (session.phase !== 'battle') throw new Error(`No battle to finish while the run is at ${session.phase}`);
  const before = session.run;
  const finished = finishStage(before, result, outcome, isFinalBattle(before, finalStage) ? before.stage : undefined);
  if (finished.over)
    return { session: freeze({ run: finished.run, phase: finished.won ? 'won' : 'over' }), events: [] };
  const leveled = applyStageClearExperience(finished.run, before.stage);
  const events: RunEvent[] = leveled.levelUps.length > 0 ? [{ type: 'level-ups', levelUps: leveled.levelUps }] : [];
  const clear = getClearGold(before, finished.run.fallen.length - before.fallen.length, {
    kills: countWarbandKills(before, result),
    relics: before.relics,
    heat: getRunHeat(before),
  });
  const paid = addGold(queueLevelUpBoons(before, leveled.run), clear.gold);
  const guest = result.units.get(GUEST_UNIT_ID);
  const candidate = guest?.isAlive() && paid.roster.length < MAX_ROSTER_SIZE ? rollGuest(before) : null;
  const pending =
    candidate && guest
      ? {
          pendingRecruitment: before.stage,
          pendingGuest: Object.freeze({ ...snapshotUnit(candidate.id, guest), name: candidate.name }),
        }
      : {};
  const rewarded =
    rollStageRewards(paid, before.stage).length === 0
      ? paid
      : markRewardPending(paid, { stage: before.stage, rerolls: 0, clearGold: clear.gold, flawless: clear.flawless });
  const run = Object.freeze({ ...rewarded, ...pending });
  return { session: freeze({ run, phase: getPickPhase(run) }), events };
}

// The relics a new run's session offers to start with, or none once it's
// past that pick: rollStartingRelics' for the first pick, and for each
// further one its origin gives (getRelicPicks), three it doesn't hold yet,
// drawn from the seed and the pick.
export function getRelicOffers(session: RunSession): readonly Relic[] {
  if (session.phase !== 'relic') return [];
  const { run } = session;
  if (run.relics.length === 0) return rollStartingRelics(run.seed);
  const rng = createSeededRng((run.seed ^ Math.imul(run.relics.length, 0x27d4eb2f) ^ 0x7f4a7c15) >>> 0);
  return rollRelics(rng, run.relics, STARTING_RELIC_CHOICES);
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
// one the run can't do (no gold, no such item, no room, no merchant, no
// road there). Travel needs the run's realm in `context`.
export function applyRunCommand(
  session: RunSession,
  command: RunCommand,
  context: RunCommandContext = {},
): RunCommandResult {
  const fail = (message: string): never => {
    throw new RunCommandError(command, message);
  };
  if (session.phase === 'camp' && !CAMP_COMMANDS.has(command.type)) fail(`${command.type} isn't done at camp`);
  if (session.phase === 'reward' && !REWARD_COMMANDS.has(command.type)) fail(`${command.type} isn't a reward pick`);
  if (session.phase === 'recruit' && !RECRUIT_COMMANDS.has(command.type)) fail(`${command.type} isn't a recruit pick`);
  if (session.phase === 'relic' && command.type !== 'pick-relic') fail(`${command.type} isn't a relic pick`);
  if (session.phase === 'boon' && command.type !== 'pick-boon') fail(`${command.type} isn't a boon pick`);
  if (session.phase !== 'relic' && command.type === 'pick-relic') fail('The starting relic is already picked');
  if (session.phase !== 'boon' && command.type === 'pick-boon') fail('No boon pick is owed');
  if (session.phase === 'travel' && command.type !== 'travel') fail(`${command.type} isn't done while travelling`);
  if (session.phase === 'event' && command.type !== 'pick-event') fail(`${command.type} isn't an event choice`);
  if (session.phase !== 'event' && command.type === 'pick-event') fail('No event is owed');
  if (session.phase !== 'travel' && command.type === 'travel')
    fail(`Travel is chosen from the realm, not ${session.phase}`);
  if (session.phase === 'battle' || session.phase === 'over' || session.phase === 'won')
    fail(`${command.type} isn't done during ${session.phase}`);
  const { run } = session;
  const camp = (next: RunState): RunCommandResult => ({ session: freeze({ run: next, phase: 'camp' }), events: [] });

  const onward = (next: RunState, events: readonly RunEvent[] = []): RunCommandResult => ({
    session: freeze({ run: next, phase: getPickPhase(next) }),
    events,
  });

  switch (command.type) {
    case 'pick-relic': {
      const relic = getRelicOffers(session)[command.index];
      if (!relic) return fail(`No relic offer ${command.index}`);
      const next = Object.freeze({ ...run, relics: [...run.relics, relic.id] });
      const more = next.relics.length < getRelicPicks(next);
      return {
        session: freeze({ run: next, phase: more ? 'relic' : isRealmRun(run) ? 'travel' : 'battle' }),
        events: [],
      };
    }
    case 'pick-boon': {
      const offer = getBoonOffer(run);
      if (!offer?.boons[command.index]) return fail(`No boon offer ${command.index}`);
      return onward(pickBoon(run, command.index));
    }
    case 'pick-recruit': {
      const offer = getRecruitOffers(session)[command.index];
      if (!offer || offer.kind !== 'recruit') return fail(`No recruit offer ${command.index}`);
      return onward(settleGuest(run, true));
    }
    case 'decline-recruit':
      return onward(settleGuest(run, false));
    case 'pick-reward': {
      const reward = getRewardOffers(session)[command.index];
      if (!reward) return fail(`No reward offer ${command.index}`);
      if (reward.kind !== 'lesson') return camp(applyReward(run, reward));
      const { run: next, levelUps } = applyLessonReward(run, reward);
      return onward(queueLevelUpBoons(run, next), [{ type: 'level-ups', levelUps }]);
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
    case 'buy': {
      if (!hasMerchant(run)) return fail('No merchant here');
      const unitId = command.unitId ?? null;
      if (!canBuyFor(run, command.itemId, unitId)) return fail(`Can't buy ${command.itemId}`);
      return camp(buyItemFor(run, command.itemId, unitId));
    }
    case 'sell':
      if (!hasMerchant(run)) return fail('No merchant here');
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
      return { session: freeze({ run, phase: isRealmRun(run) ? 'travel' : 'battle' }), events: [] };
    case 'travel': {
      const { realm } = context;
      if (!realm) return fail('Travel needs the realm');
      if (!canTravel(run, realm, command.siteId)) return fail(`No road to ${command.siteId}`);
      const next = travelTo(run, realm, command.siteId);
      const kind = getRunSite(next)!.kind;
      const phase: RunPhase = BATTLE_SITES.has(kind) ? 'battle' : next.pendingEvent ? 'event' : getPickPhase(next);
      return { session: freeze({ run: next, phase }), events: [] };
    }
    case 'pick-event': {
      const choice = getEventChoices(run)[command.index];
      if (!choice) return fail(`No event choice ${command.index}`);
      if (choice.blocked) return fail(choice.blocked);
      const { run: next, text } = resolveEvent(run, command.index);
      return { session: resumeRunSession(next), events: [{ type: 'event-outcome', text }] };
    }
  }
}

// Every command the session accepts as it stands, for an AI to choose
// from: each starting relic or boon offered on those picks; each reward offer, skip, and reroll when affordable on the pick;
// at camp, rest when it can, each affordable stock item, each sellable
// convoy entry, each give, store and equip that's allowed, and march; while
// travelling, a trip to each site the roads lead to (given the realm).
export function getLegalRunCommands(
  session: RunSession,
  stock: readonly string[] = MERCHANT_STOCK,
  context: RunCommandContext = {},
): RunCommand[] {
  const commands: RunCommand[] = [];
  if (session.phase === 'relic') {
    getRelicOffers(session).forEach((_, index) => commands.push({ type: 'pick-relic', index }));
    return commands;
  }
  if (session.phase === 'boon') {
    getBoonOffer(session.run)?.boons.forEach((_, index) => commands.push({ type: 'pick-boon', index }));
    return commands;
  }
  if (session.phase === 'event') {
    getEventChoices(session.run).forEach((choice, index) => {
      if (!choice.blocked) commands.push({ type: 'pick-event', index });
    });
    return commands;
  }
  if (session.phase === 'travel') {
    if (!context.realm) return commands;
    return getTravelChoices(session.run, context.realm).map((site) => ({ type: 'travel', siteId: site.id }));
  }
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
  if (hasMerchant(run)) {
    for (const itemId of stock) if (canBuy(run, itemId, stock)) commands.push({ type: 'buy', itemId });
    run.convoy.forEach((_, convoyIndex) => {
      if (canSell(run, convoyIndex)) commands.push({ type: 'sell', convoyIndex });
    });
  }
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
