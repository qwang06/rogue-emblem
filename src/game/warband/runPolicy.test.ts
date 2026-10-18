import { describe, expect, it } from 'vitest';
import { Acolyte } from '../Acolyte.ts';
import { Archer } from '../Archer.ts';
import { HEAL_STAFF } from '../healing.ts';
import { Soldier } from '../Soldier.ts';
import type { Unit } from '../Unit.ts';
import { IRON_BOW, IRON_SPEAR, WOODEN_SPEAR } from '../weapons.ts';
import { REST_COST } from './camp.ts';
import { createRun, type RunState, type UnitSnapshot } from './run.ts';
import { applyRunCommand, type RunCommand, type RunSession } from './runCommands.ts';
import { getDeployingUnits, LOW_USES, pickReward, planCamp, REWARD_SCORES, scoreReward } from './runPolicy.ts';
import type { Reward } from './rewards.ts';

function makeRun(units: Record<string, Unit>, extra: Partial<RunState> = {}): RunState {
  return { ...createRun(3, new Map(Object.entries(units))), ...extra };
}

const soldier = () => new Soldier({ name: 'Alden', team: 'player' });
const camp = (run: RunState): RunSession => ({ run, phase: 'camp' });
const withUnit = (run: RunState, id: string, change: (unit: UnitSnapshot) => UnitSnapshot): RunState => ({
  ...run,
  roster: run.roster.map((unit) => (unit.id === id ? change(unit) : unit)),
});

// Plays planCamp until it marches, returning every command it gave.
function playCamp(run: RunState): RunCommand[] {
  let session = camp(run);
  const commands: RunCommand[] = [];
  for (let i = 0; i < 20; i++) {
    const command = planCamp(session);
    commands.push(command);
    if (command.type === 'march') return commands;
    session = applyRunCommand(session, command).session;
  }
  throw new Error(`camp never marched: ${JSON.stringify(commands)}`);
}

describe('scoreReward', () => {
  const recruit = (classId: string): Reward => ({
    kind: 'recruit',
    unit: { ...makeRun({ a: soldier() }).roster[0], classId },
  });

  it('wants a recruit most while the deploy slots are unfilled', () => {
    expect(scoreReward(makeRun({ a: soldier() }), recruit('archer'))).toBe(REWARD_SCORES.recruitNeeded);
  });

  it('prefers a recruit of a class the roster lacks once the slots are filled', () => {
    const run = makeRun({ a: soldier() }, { deployCap: 1 });
    expect(scoreReward(run, recruit('archer'))).toBeGreaterThan(scoreReward(run, recruit('soldier')));
  });

  it('wants a rest as much as the roster is hurt', () => {
    const run = makeRun({ a: soldier() });
    expect(scoreReward(run, { kind: 'rest' })).toBe(0);
    const hurt = withUnit(run, 'a', (unit) => ({ ...unit, health: Math.floor(unit.maxHealth / 2) }));
    expect(scoreReward(hurt, { kind: 'rest' })).toBeGreaterThan(REWARD_SCORES.gold);
  });
});

describe('pickReward', () => {
  it('takes the best-scoring offer', () => {
    const run = makeRun({ a: soldier() }, { deployCap: 1 });
    const session = { run: { ...run, pendingReward: { stage: 2, rerolls: 0, clearGold: 0, flawless: true } } };
    const command = pickReward({ ...session, phase: 'reward' });
    expect(command.type).toBe('pick-reward');
  });

  it('skips when nothing is offered', () => {
    expect(pickReward(camp(makeRun({ a: soldier() })))).toEqual({ type: 'skip-reward' });
  });
});

describe('getDeployingUnits', () => {
  it('fields the healthiest units up to the deploy cap', () => {
    const run = withUnit(makeRun({ a: soldier(), b: soldier(), c: soldier() }, { deployCap: 2 }), 'a', (unit) => ({
      ...unit,
      health: 1,
    }));
    expect(getDeployingUnits(run).map((unit) => unit.id)).toEqual(['b', 'c']);
  });
});

describe('planCamp', () => {
  it('marches when everyone is armed and well', () => {
    expect(playCamp(makeRun({ a: soldier() }, { gold: 100 }))).toEqual([{ type: 'march' }]);
  });

  it('rests at once when someone deploying is badly hurt', () => {
    const run = withUnit(makeRun({ a: soldier() }, { gold: REST_COST }), 'a', (unit) => ({ ...unit, health: 1 }));
    expect(playCamp(run)).toEqual([{ type: 'rest' }, { type: 'march' }]);
  });

  it('buys, hands over and equips a spare for a weapon about to break', () => {
    const run = withUnit(makeRun({ a: soldier() }, { gold: 100 }), 'a', (unit) => ({
      ...unit,
      items: [{ itemId: IRON_SPEAR.id, quantity: LOW_USES }],
    }));
    const commands = playCamp(run);
    expect(commands.map((command) => command.type)).toEqual(['buy', 'give', 'equip', 'march']);
  });

  it('takes a spare from the convoy before buying one', () => {
    const run = withUnit(
      makeRun({ a: soldier() }, { gold: 100, convoy: [{ itemId: WOODEN_SPEAR.id, quantity: 20 }] }),
      'a',
      (unit) => ({ ...unit, items: [] }),
    );
    expect(playCamp(run).map((command) => command.type)).toEqual(['give', 'march']);
  });

  it('buys an archer a bow, and a healer a staff', () => {
    const archer = withUnit(
      makeRun({ a: new Archer({ name: 'Bryn', team: 'player' }) }, { gold: 100 }),
      'a',
      (unit) => ({
        ...unit,
        items: [],
      }),
    );
    expect(playCamp(archer)[0]).toEqual({ type: 'buy', itemId: IRON_BOW.id });
    const healer = withUnit(
      makeRun({ a: new Acolyte({ name: 'Cass', team: 'player' }) }, { gold: 100 }),
      'a',
      (unit) => ({
        ...unit,
        items: [],
      }),
    );
    expect(playCamp(healer).map((command) => command.type)).toEqual(['buy', 'give', 'march']);
    expect(playCamp(healer)[0]).toEqual({ type: 'buy', itemId: HEAL_STAFF.id });
  });

  it("marches without what it can't afford", () => {
    const run = withUnit(makeRun({ a: soldier() }, { gold: 0 }), 'a', (unit) => ({ ...unit, items: [] }));
    expect(playCamp(run)).toEqual([{ type: 'march' }]);
  });
});
