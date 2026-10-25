import { describe, expect, it } from 'vitest';
import { Acolyte } from '../Acolyte.ts';
import { Archer } from '../Archer.ts';
import { HEAL_STAFF } from '../healing.ts';
import { MASTER_SEAL, WOODEN_SHIELD } from '../items.ts';
import { PROMOTION_LEVEL } from '../promotions.ts';
import { Soldier } from '../Soldier.ts';
import type { Unit } from '../Unit.ts';
import { IRON_BOW, IRON_SPEAR, WOODEN_SPEAR } from '../weapons.ts';
import { REST_COST } from './camp.ts';
import { createRun, type RunState, type UnitSnapshot } from './run.ts';
import {
  applyRunCommand,
  getRecruitOffers,
  getRelicOffers,
  startRunSession,
  type RunCommand,
  type RunSession,
} from './runCommands.ts';
import {
  BOON_SCORES,
  getDeployingUnits,
  LOW_USES,
  pickBoonOffer,
  pickRecruit,
  pickReward,
  pickStartingRelic,
  planCamp,
  RELIC_PREFERENCE,
  REWARD_SCORES,
  scoreReward,
} from './runPolicy.ts';
import { getBoonOffer, queueLevelUpBoons } from './levelUpPicks.ts';
import { MAX_ROSTER_SIZE, RECRUIT_CLASS_IDS, type Reward } from './rewards.ts';

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

  it('wants a draft like a recruit of a new class, and not at all at a full roster', () => {
    const draft: Reward = { kind: 'draft', stage: 2 };
    expect(scoreReward(makeRun({ a: soldier() }), draft)).toBe(REWARD_SCORES.recruitNeeded);
    const filled = makeRun({ a: soldier() }, { deployCap: 1 });
    expect(scoreReward(filled, draft)).toBe(scoreReward(filled, recruit('archer')));
    const full = makeRun({ a: soldier() });
    expect(scoreReward({ ...full, roster: Array(MAX_ROSTER_SIZE).fill(full.roster[0]) }, draft)).toBe(0);
  });

  it('wants a rest as much as the roster is hurt', () => {
    const run = makeRun({ a: soldier() });
    expect(scoreReward(run, { kind: 'rest' })).toBe(0);
    const hurt = withUnit(run, 'a', (unit) => ({ ...unit, health: Math.floor(unit.maxHealth / 2) }));
    expect(scoreReward(hurt, { kind: 'rest' })).toBeGreaterThan(REWARD_SCORES.gold);
  });
});

describe('pickRecruit', () => {
  it('drafts the first recruit of a class the roster lacks', () => {
    const run = { ...makeRun({ a: soldier() }), pendingDraft: 2 };
    const session: RunSession = { run, phase: 'recruit' };
    const offers = getRecruitOffers(session);
    const index = offers.findIndex((offer) => offer.kind === 'recruit' && offer.unit.classId !== 'soldier');
    expect(pickRecruit(session)).toEqual({ type: 'pick-recruit', index });
  });

  it('takes the first recruit when every class is already on the roster, and declines with none', () => {
    const run = { ...makeRun({ a: soldier() }), pendingDraft: 2 };
    const everyClass = {
      ...run,
      roster: RECRUIT_CLASS_IDS.map((classId, i) => ({ ...run.roster[0], id: `u${i}`, classId })),
    };
    expect(pickRecruit({ run: everyClass, phase: 'recruit' })).toEqual({ type: 'pick-recruit', index: 0 });
    expect(pickRecruit(camp(makeRun({ a: soldier() })))).toEqual({ type: 'decline-recruit' });
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

  it('promotes a unit that can, to its first promotion', () => {
    const run = withUnit(
      makeRun({ a: soldier() }, { gold: 0, convoy: [{ itemId: MASTER_SEAL.id, quantity: 1 }] }),
      'a',
      (unit) => ({
        ...unit,
        level: PROMOTION_LEVEL,
      }),
    );
    expect(playCamp(run)).toEqual([{ type: 'promote', unitId: 'a', promotionId: 'general' }, { type: 'march' }]);
  });

  it('buys a seal for a unit that can promote when it has gold to spare', () => {
    const run = withUnit(makeRun({ a: soldier() }, { gold: 200 }), 'a', (unit) => ({
      ...unit,
      level: PROMOTION_LEVEL,
    }));
    expect(playCamp(run).map((command) => command.type)).toEqual(['buy', 'promote', 'march']);
    const poor = withUnit(makeRun({ a: soldier() }, { gold: 60 }), 'a', (unit) => ({
      ...unit,
      level: PROMOTION_LEVEL,
    }));
    expect(playCamp(poor)).toEqual([{ type: 'march' }]);
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

  it('swaps to a one-handed spare over a two-handed one to keep its shield', () => {
    const run = withUnit(makeRun({ a: soldier() }, { gold: 100 }), 'a', (unit) => ({
      ...unit,
      items: [
        { itemId: IRON_SPEAR.id, quantity: LOW_USES },
        { itemId: IRON_BOW.id, quantity: 40 },
        { itemId: WOODEN_SPEAR.id, quantity: LOW_USES + 1 },
        { itemId: WOODEN_SHIELD.id, quantity: 1 },
      ],
    }));
    expect(playCamp(run)[0]).toEqual({ type: 'equip', unitId: 'a', itemIndex: 2 });
    // Without the shield, the spare with the most uses wins.
    const unshielded = withUnit(run, 'a', (unit) => ({ ...unit, items: unit.items.slice(0, 3) }));
    expect(playCamp(unshielded)[0]).toEqual({ type: 'equip', unitId: 'a', itemIndex: 1 });
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

describe('pickStartingRelic and pickBoonOffer', () => {
  it('starts with the preferred relic among the offers', () => {
    for (let seed = 0; seed < 10; seed++) {
      const session = startRunSession(makeRun({ a: soldier() }, { seed }));
      const command = pickStartingRelic(session);
      expect(command.type).toBe('pick-relic');
      const offers = getRelicOffers(session);
      const picked = offers[(command as { index: number }).index].id;
      const rank = (id: string) => (RELIC_PREFERENCE.includes(id) ? RELIC_PREFERENCE.indexOf(id) : 99);
      for (const offer of offers) expect(rank(picked)).toBeLessThanOrEqual(rank(offer.id));
    }
  });

  it('takes the boon of the best-scoring kind', () => {
    const run = makeRun({ a: soldier() });
    const owing = queueLevelUpBoons(run, { ...run, roster: [{ ...run.roster[0], level: 2 }] });
    const boons = getBoonOffer(owing)!.boons;
    const command = pickBoonOffer({ run: owing, phase: 'boon' });
    expect(command.type).toBe('pick-boon');
    const kind = boons[(command as { index: number }).index].kind;
    for (const boon of boons) expect(BOON_SCORES[kind]).toBeGreaterThanOrEqual(BOON_SCORES[boon.kind]);
  });
});
