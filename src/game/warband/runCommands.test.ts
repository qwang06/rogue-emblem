import { describe, expect, it } from 'vitest';
import { Soldier } from '../Soldier.ts';
import type { Unit } from '../Unit.ts';
import { Warrior } from '../Warrior.ts';
import { WOODEN_SPEAR, WOODEN_SWORD } from '../weapons.ts';
import { DEFAULT_CONTENT } from '../battleSetup.ts';
import { MASTER_SEAL } from '../items.ts';
import { PROMOTION_LEVEL } from '../promotions.ts';
import { REST_COST } from './camp.ts';
import { generateRealm, getNextSites, type Realm } from './realm/realm.ts';
import { getItemPrice } from './merchant.ts';
import { getRerollCost, getSkipGold, getStageClearGold, rollStageRewards } from './rewards.ts';
import { advanceStage, createRun, restoreRoster, type RunState } from './run.ts';
import {
  applyRunCommand,
  finishBattle,
  finishBattleWithEvents,
  getLegalRunCommands,
  getRelicOffers,
  getRewardOffers,
  resumeRunSession,
  startRunSession,
  RunCommandError,
  type RunCommand,
  type RunSession,
} from './runCommands.ts';
import { getCurrentSiteId, startRoute, travelTo } from './travel.ts';

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

  it("buys straight into a unit's inventory when one is named", () => {
    const run = { ...newRun(), gold: 100 };
    const bought = apply(campWith(run), { type: 'buy', itemId: WOODEN_SWORD.id, unitId: 'alden' });
    expect(bought.run.convoy).toEqual([]);
    const alden = bought.run.roster.find((unit) => unit.id === 'alden')!;
    expect(alden.items.at(-1)).toEqual({ itemId: WOODEN_SWORD.id, quantity: WOODEN_SWORD.uses });
    expect(() => apply(campWith(run), { type: 'buy', itemId: WOODEN_SWORD.id, unitId: 'nobody' })).toThrow(/buy/);
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

describe('travel', () => {
  const realm: Realm = generateRealm(3, DEFAULT_CONTENT.regions);
  const home = (): RunSession => ({ run: startRoute(newRun(1)), phase: 'travel' });
  // A run on the realm that has walked to a site of `kind`, its battle won.
  function arrivedBefore(kind: string): RunState | null {
    for (const site of realm.sites) {
      const next = getNextSites(realm, site.id).find((other) => other.kind === kind);
      if (!next || site.kind === 'home') continue;
      const at = {
        id: site.id,
        name: site.name,
        kind: site.kind,
        depth: site.depth,
        region: site.region,
        levelOffset: 0,
      };
      return { ...startRoute(newRun(1)), stage: site.depth + 1, route: { visited: ['0-0', site.id], at } };
    }
    return null;
  }

  it('travels to a battle and fights it', () => {
    const [first] = getNextSites(realm, '0-0');
    const session = applyRunCommand(home(), { type: 'travel', siteId: first.id }, { realm }).session;
    expect(session.phase).toBe('battle');
    expect(getCurrentSiteId(session.run)).toBe(first.id);
  });

  it('opens camp in a town, and the reward pick at a shrine', () => {
    for (const [kind, phase] of [
      ['town', 'camp'],
      ['shrine', 'reward'],
    ] as const) {
      const run = arrivedBefore(kind);
      if (!run) continue;
      const target = getNextSites(realm, getCurrentSiteId(run)).find((site) => site.kind === kind)!;
      const session = applyRunCommand(
        { run, phase: 'travel' },
        { type: 'travel', siteId: target.id },
        { realm },
      ).session;
      expect(session.phase).toBe(phase);
    }
  });

  it('refuses a road that is not there, or travel without the realm', () => {
    const far = realm.sites.find((site) => site.depth === 4)!;
    expect(() => applyRunCommand(home(), { type: 'travel', siteId: far.id }, { realm })).toThrow(RunCommandError);
    const [first] = getNextSites(realm, '0-0');
    expect(() => applyRunCommand(home(), { type: 'travel', siteId: first.id })).toThrow(RunCommandError);
  });

  it('marches from camp to the overworld on the realm', () => {
    const [first] = getNextSites(realm, '0-0');
    const run = { ...travelTo(startRoute(newRun(1)), realm, first.id), stage: 2 };
    expect(applyRunCommand(campWith(run), { type: 'march' }, { realm }).session.phase).toBe('travel');
  });

  it('resumes a saved realm run where it stands', () => {
    expect(resumeRunSession(startRoute(newRun(1))).phase).toBe('travel');
    const [first] = getNextSites(realm, '0-0');
    const there = travelTo(startRoute(newRun(1)), realm, first.id);
    expect(resumeRunSession(there).phase).toBe('battle');
    expect(resumeRunSession({ ...there, stage: 2 }).phase).toBe('travel');
  });

  it('lists a travel command for every road on', () => {
    const commands = getLegalRunCommands(home(), [], { realm });
    expect(commands).toEqual(getNextSites(realm, '0-0').map((site) => ({ type: 'travel', siteId: site.id })));
  });
});

describe('starting relic pick', () => {
  it('starts a new run on the relic pick, and takes the relic into the battle', () => {
    const session = startRunSession(newRun(1));
    expect(session.phase).toBe('relic');
    const offers = getRelicOffers(session);
    expect(offers).toHaveLength(3);
    expect(getLegalRunCommands(session)).toEqual(offers.map((_, index) => ({ type: 'pick-relic', index })));
    const picked = apply(session, { type: 'pick-relic', index: 1 });
    expect(picked.phase).toBe('battle');
    expect(picked.run.relics).toEqual([offers[1].id]);
    expect(getRelicOffers(picked)).toEqual([]);
  });

  it('refuses anything else on the pick, and a second pick', () => {
    const session = startRunSession(newRun(1));
    expect(() => applyRunCommand(session, { type: 'march' })).toThrow(RunCommandError);
    expect(() => applyRunCommand(session, { type: 'pick-relic', index: 3 })).toThrow(/3/);
    const picked = apply(session, { type: 'pick-relic', index: 0 });
    expect(() => applyRunCommand({ ...picked, phase: 'camp' }, { type: 'pick-relic', index: 0 })).toThrow(
      RunCommandError,
    );
  });
});

describe('level-up boon picks', () => {
  // Stage 1's clear levels both units to 2, so each owes a boon.
  const cleared = () => {
    const run = newRun(1);
    return finishBattle(resumeRunSession(run), { units: restoreRoster(run) }, 'victory');
  };

  it('owes a boon per level the stage gained before the reward pick', () => {
    const session = cleared();
    expect(session.phase).toBe('boon');
    expect(session.run.pendingBoons).toEqual([
      { unitId: 'alden', level: 2 },
      { unitId: 'cato', level: 2 },
    ]);
    expect(session.run.pendingReward).toBeDefined();
    expect(resumeRunSession(session.run).phase).toBe('boon');
    expect(getLegalRunCommands(session)).toHaveLength(3);
  });

  it('takes the boons one by one, then goes on to the reward pick', () => {
    const first = apply(cleared(), { type: 'pick-boon', index: 0 });
    expect(first.phase).toBe('boon');
    expect(first.run.roster[0].boons).toHaveLength(1);
    const second = apply(first, { type: 'pick-boon', index: 2 });
    expect(second.phase).toBe('reward');
    expect(second.run.roster[1].boons).toHaveLength(1);
    expect(second.run.pendingBoons).toBeUndefined();
    expect(() => applyRunCommand(second, { type: 'pick-boon', index: 0 })).toThrow(RunCommandError);
  });

  it('refuses other commands while a boon is owed', () => {
    expect(() => applyRunCommand(cleared(), { type: 'pick-reward', index: 0 })).toThrow(/boon/);
    expect(() => applyRunCommand(cleared(), { type: 'pick-boon', index: 7 })).toThrow(/7/);
  });

  it("owes boons for a Veteran's Lesson's level ups, then goes to camp", () => {
    let session = won(newRun());
    let tries = 0;
    while (!getRewardOffers(session).some((reward) => reward.kind === 'lesson') && tries++ < 20) {
      session = apply({ ...session, run: { ...session.run, gold: 1000 } }, { type: 'reroll-rewards' });
    }
    const index = getRewardOffers(session).findIndex((reward) => reward.kind === 'lesson');
    const { session: after, events } = applyRunCommand(session, { type: 'pick-reward', index });
    expect(events[0].type).toBe('level-ups');
    expect(after.phase).toBe('boon');
    const done = apply(after, { type: 'pick-boon', index: 0 }, { type: 'pick-boon', index: 0 });
    expect(done.phase).toBe('camp');
  });
});

describe('relics in the run rules', () => {
  it("pays the Bounty Ledger's gold for kills with the clear", () => {
    const run = { ...newRun(), relics: ['bounty-ledger'] };
    const session = finishBattle(
      resumeRunSession(run),
      {
        units: restoreRoster(run),
        kills: new Map([
          [run.roster[0].id, 3],
          ['guest', 2],
        ]),
      },
      'victory',
    );
    expect(session.run.gold).toBe(getStageClearGold(2, 0, { kills: 3, relics: ['bounty-ledger'] }).gold);
    expect(session.run.pendingReward!.clearGold).toBe(session.run.gold);
  });

  it('offers four rewards with the Four-Leaf Clover', () => {
    const run = { ...newRun(), relics: ['four-leaf-clover'] };
    expect(getRewardOffers(won(run))).toHaveLength(4);
  });
});

describe('promote', () => {
  const sealed = (run: RunState): RunState => ({
    ...run,
    convoy: [{ itemId: MASTER_SEAL.id, quantity: 1 }],
    roster: run.roster.map((unit) => ({ ...unit, level: PROMOTION_LEVEL })),
  });

  it('promotes a unit at camp, spending the seal', () => {
    const session = apply(campWith(sealed(newRun())), { type: 'promote', unitId: 'cato', promotionId: 'hero' });
    expect(session.phase).toBe('camp');
    expect(session.run.roster.find((unit) => unit.id === 'cato')!.classId).toBe('hero');
    expect(session.run.convoy).toEqual([]);
  });

  it("refuses a promotion the unit can't make", () => {
    const camp = campWith(sealed(newRun()));
    expect(() => applyRunCommand(camp, { type: 'promote', unitId: 'cato', promotionId: 'general' })).toThrow(
      RunCommandError,
    );
    expect(() =>
      applyRunCommand(campWith({ ...sealed(newRun()), convoy: [] }), {
        type: 'promote',
        unitId: 'cato',
        promotionId: 'hero',
      }),
    ).toThrow(RunCommandError);
  });

  it('is legal at camp for each promotion the warband has a seal for', () => {
    const promotions = getLegalRunCommands(campWith(sealed(newRun()))).filter((c) => c.type === 'promote');
    expect(promotions).toEqual([
      { type: 'promote', unitId: 'alden', promotionId: 'general' },
      { type: 'promote', unitId: 'alden', promotionId: 'halberdier' },
      { type: 'promote', unitId: 'cato', promotionId: 'hero' },
      { type: 'promote', unitId: 'cato', promotionId: 'berserker' },
    ]);
    const unsealed = getLegalRunCommands(campWith({ ...sealed(newRun()), convoy: [] }));
    expect(unsealed.some((c) => c.type === 'promote')).toBe(false);
  });
});
