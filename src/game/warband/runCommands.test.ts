import { describe, expect, it } from 'vitest';
import { Soldier } from '../Soldier.ts';
import type { Unit } from '../Unit.ts';
import { Warrior } from '../Warrior.ts';
import { WOODEN_SPEAR, WOODEN_SWORD } from '../weapons.ts';
import { REST_COST } from './camp.ts';
import { getItemPrice } from './merchant.ts';
import { getRerollCost, getSkipGold, getStageClearGold, rollStageRewards } from './rewards.ts';
import { advanceStage, createRun, restoreRoster, type RunState } from './run.ts';
import {
  applyRunCommand,
  finishBattle,
  finishBattleWithEvents,
  getLegalRunCommands,
  getRewardOffers,
  resumeRunSession,
  RunCommandError,
  type RunCommand,
  type RunSession,
} from './runCommands.ts';

function newRun(stage = 2): RunState {
  const run = createRun(
    7,
    new Map<string, Unit>([
      ['alden', new Soldier({ name: 'Alden', team: 'player' })],
      ['cato', new Warrior({ name: 'Cato', team: 'player' })],
    ]),
  );
  let staged = run;
  while (staged.stage < stage) staged = advanceStage(staged);
  return staged;
}

// The run's battle won with Alden hurt by `damage` (killed for 99).
function won(run: RunState, damage = 3): RunSession {
  const units = restoreRoster(run);
  units.get('alden')!.takeDamage(damage);
  return finishBattle(resumeRunSession(run), { units }, 'victory');
}

function campWith(run: RunState): RunSession {
  return { run, phase: 'camp' };
}

function apply(session: RunSession, ...commands: RunCommand[]): RunSession {
  return commands.reduce((current, command) => applyRunCommand(current, command).session, session);
}

describe('resumeRunSession', () => {
  it('opens on the battle, or on the reward pick a saved run still owes', () => {
    expect(resumeRunSession(newRun()).phase).toBe('battle');
    expect(resumeRunSession(won(newRun()).run).phase).toBe('reward');
  });
});

describe('finishBattle', () => {
  it('pays the clear and owes the reward pick after a win', () => {
    const run = newRun();
    const session = won(run);
    expect(session.phase).toBe('reward');
    expect(session.run.gold).toBe(getStageClearGold(2, 0).gold);
    expect(session.run.stage).toBe(3);
    expect(session.run.pendingReward).toMatchObject({ stage: 2, rerolls: 0, flawless: true });
    expect(session.run.roster.find((unit) => unit.id === 'alden')!.health).toBe(run.roster[0].maxHealth - 3);
  });

  it('levels every survivor of stage 1 to level 2, and reports the level ups', () => {
    const run = newRun(1);
    const units = restoreRoster(run);
    units.get('alden')!.takeDamage(3);
    const { session, events } = finishBattleWithEvents(resumeRunSession(run), { units }, 'victory');
    expect(session.run.roster.map((unit) => [unit.id, unit.level, unit.experience])).toEqual([
      ['alden', 2, 0],
      ['cato', 2, 0],
    ]);
    expect(events).toEqual([
      {
        type: 'level-ups',
        levelUps: [expect.objectContaining({ name: 'Alden' }), expect.objectContaining({ name: 'Cato' })],
      },
    ]);
    expect(finishBattle(resumeRunSession(run), { units: restoreRoster(run) }, 'victory').run.roster).toEqual(
      finishBattleWithEvents(resumeRunSession(run), { units: restoreRoster(run) }, 'victory').session.run.roster,
    );
  });

  it('levels nobody after a later stage, or after a loss', () => {
    const run = newRun();
    expect(finishBattleWithEvents(resumeRunSession(run), { units: restoreRoster(run) }, 'victory').events).toEqual([]);
    const first = newRun(1);
    const lost = finishBattleWithEvents(resumeRunSession(first), { units: restoreRoster(first) }, 'defeat');
    expect(lost.events).toEqual([]);
    expect(lost.session.run.roster.every((unit) => unit.level === 1)).toBe(true);
  });

  it('pays less for a stage that cost a unit', () => {
    const session = won(newRun(), 99);
    expect(session.run.fallen.map((unit) => unit.id)).toEqual(['alden']);
    expect(session.run.pendingReward).toMatchObject({ flawless: false, clearGold: getStageClearGold(2, 1).gold });
  });

  it('wins the run on a win on the final stage, owing nothing', () => {
    const run = newRun();
    const session = finishBattle(resumeRunSession(run), { units: restoreRoster(run) }, 'victory', 2);
    expect(session.phase).toBe('won');
    expect(session.run.pendingReward).toBeUndefined();
    expect(() => applyRunCommand(session, { type: 'march' })).toThrow(/won/);
  });

  it('ends the run on a defeat', () => {
    const run = newRun();
    expect(finishBattle(resumeRunSession(run), { units: restoreRoster(run) }, 'defeat').phase).toBe('over');
  });

  it('only finishes a battle that is being fought', () => {
    const run = newRun();
    expect(() => finishBattle(campWith(run), { units: new Map() }, 'victory')).toThrow(/camp/);
  });
});

describe('the reward pick', () => {
  it("offers the stage's rewards", () => {
    const session = won(newRun());
    expect(getRewardOffers(session)).toEqual(rollStageRewards(session.run, 2));
    expect(getRewardOffers(campWith(session.run))).toEqual([]);
  });

  it('takes an offer and goes to camp', () => {
    const session = won(newRun());
    const after = apply(session, { type: 'pick-reward', index: 0 });
    expect(after.phase).toBe('camp');
    expect(after.run.pendingReward).toBeUndefined();
  });

  it("shows a veteran's lesson's level up for every unit and settles its reward", () => {
    const first = won(newRun());
    const session = Array.from({ length: 40 }, (_, rerolls) => ({
      ...first,
      run: { ...first.run, pendingReward: { ...first.run.pendingReward!, rerolls } },
    })).find((candidate) => getRewardOffers(candidate).some((reward) => reward.kind === 'lesson'))!;
    const index = getRewardOffers(session).findIndex((reward) => reward.kind === 'lesson');
    const { session: after, events } = applyRunCommand(session, { type: 'pick-reward', index });
    expect(events).toEqual([
      {
        type: 'level-ups',
        levelUps: [expect.objectContaining({ name: 'Alden' }), expect.objectContaining({ name: 'Cato' })],
      },
    ]);
    expect(after.run.roster.map((unit) => unit.level)).toEqual([2, 2]);
    expect(after.run.pendingReward).toBeUndefined();
  });

  it('skips for gold', () => {
    const session = won(newRun());
    const after = apply(session, { type: 'skip-reward' });
    expect(after).toMatchObject({ phase: 'camp', run: { gold: session.run.gold + getSkipGold(2) } });
  });

  it('rerolls for gold, staying on the pick, and not without it', () => {
    const session = won(newRun());
    const rich = { ...session, run: { ...session.run, gold: 100 } };
    const after = apply(rich, { type: 'reroll-rewards' });
    expect(after.phase).toBe('reward');
    expect(after.run.gold).toBe(100 - getRerollCost(0));
    expect(getRewardOffers(after)).toEqual(rollStageRewards(after.run, 2, 1));
    const broke = { ...session, run: { ...session.run, gold: 0 } };
    expect(() => apply(broke, { type: 'reroll-rewards' })).toThrow(/gold/);
  });

  it("doesn't take an offer that isn't there, or a camp command", () => {
    const session = won(newRun());
    expect(() => apply(session, { type: 'pick-reward', index: 9 })).toThrow(RunCommandError);
    expect(() => apply(session, { type: 'march' })).toThrow(/reward pick/);
  });
});

describe('camp', () => {
  it('rests for gold', () => {
    const run = won(newRun()).run;
    const after = apply(campWith({ ...run, gold: 100 }), { type: 'rest' });
    expect(after.run.gold).toBe(100 - REST_COST);
    expect(after.run.roster.every((unit) => unit.health === unit.maxHealth)).toBe(true);
    expect(() => apply(after, { type: 'rest' })).toThrow(/rest/i);
  });

  it('buys and sells through the convoy', () => {
    const run = { ...newRun(), gold: 100 };
    const bought = apply(campWith(run), { type: 'buy', itemId: WOODEN_SWORD.id });
    expect(bought.run.gold).toBe(100 - getItemPrice(WOODEN_SWORD));
    expect(bought.run.convoy).toEqual([{ itemId: WOODEN_SWORD.id, quantity: WOODEN_SWORD.uses }]);
    const sold = apply(bought, { type: 'sell', convoyIndex: 0 });
    expect(sold.run.convoy).toEqual([]);
    expect(() => apply(campWith({ ...run, gold: 0 }), { type: 'buy', itemId: WOODEN_SWORD.id })).toThrow(/buy/);
    expect(() => apply(campWith(run), { type: 'buy', itemId: 'excalibur' })).toThrow(RunCommandError);
  });

  it('gives, equips and stores items', () => {
    const run = { ...newRun(), convoy: [{ itemId: WOODEN_SPEAR.id, quantity: 20 }] };
    const given = apply(campWith(run), { type: 'give', unitId: 'alden', convoyIndex: 0 });
    const alden = given.run.roster.find((unit) => unit.id === 'alden')!;
    const index = alden.items.findIndex((item) => item.itemId === WOODEN_SPEAR.id);
    expect(index).toBeGreaterThan(0);
    const equipped = apply(given, { type: 'equip', unitId: 'alden', itemIndex: index });
    expect(equipped.run.roster.find((unit) => unit.id === 'alden')!.items[0].itemId).toBe(WOODEN_SPEAR.id);
    const stored = apply(equipped, { type: 'store', unitId: 'alden', itemIndex: 0 });
    expect(stored.run.convoy.map((entry) => entry.itemId)).toContain(WOODEN_SPEAR.id);
    expect(() => apply(campWith(run), { type: 'give', unitId: 'nobody', convoyIndex: 0 })).toThrow(RunCommandError);
  });

  it('marches on to the battle', () => {
    expect(apply(campWith(newRun()), { type: 'march' }).phase).toBe('battle');
  });

  it("doesn't take a reward command", () => {
    expect(() => apply(campWith(newRun()), { type: 'skip-reward' })).toThrow(/camp/);
  });
});

it('takes no command during a battle or once the run is over', () => {
  const run = newRun();
  expect(() => apply(resumeRunSession(run), { type: 'march' })).toThrow(/battle/);
  expect(() => apply({ run, phase: 'over' }, { type: 'march' })).toThrow(/over/);
});

describe('getLegalRunCommands', () => {
  it('lists every offer, skip and an affordable reroll on the pick', () => {
    const session = won(newRun());
    const commands = getLegalRunCommands({ ...session, run: { ...session.run, gold: 100 } });
    expect(commands).toEqual([
      ...getRewardOffers(session).map((_, index) => ({ type: 'pick-reward', index })),
      { type: 'skip-reward' },
      { type: 'reroll-rewards' },
    ]);
  });

  it('lists camp commands that all apply, ending with march', () => {
    const run = won(newRun()).run;
    const session = campWith({ ...run, gold: 100, convoy: [{ itemId: WOODEN_SPEAR.id, quantity: 20 }] });
    const commands = getLegalRunCommands(session);
    expect(commands.at(-1)).toEqual({ type: 'march' });
    expect(new Set(commands.map((command) => command.type))).toEqual(
      new Set(['rest', 'buy', 'sell', 'give', 'store', 'equip', 'march']),
    );
    for (const command of commands) expect(() => applyRunCommand(session, command)).not.toThrow();
  });

  it('lists nothing during a battle', () => {
    expect(getLegalRunCommands(resumeRunSession(newRun()))).toEqual([]);
  });
});
