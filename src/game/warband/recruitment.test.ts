import { describe, expect, it } from 'vitest';
import { createBattleLevel, runStage } from '../battleSetup.ts';
import { planDeployment, planUnitTurn } from '../battle/ai.ts';
import { applyCommand } from '../battle/commands.ts';
import { createBattleState, getRunBattleUnits } from '../battle/state.ts';
import { findUnit } from '../grid.ts';
import { Soldier } from '../Soldier.ts';
import { findQuirk } from './quirks.ts';
import { GUEST_UNIT_ID, hasGuest, isRecruitmentStage, rollDraft, rollGuest, settleDraft } from './recruitment.ts';
import { DRAFT_CHOICES, MAX_ROSTER_SIZE, RECRUIT_CLASS_IDS, type Reward } from './rewards.ts';
import { advanceStage, createRun, parseRun, restoreRoster, restoreUnit, serializeRun } from './run.ts';
import { applyRunCommand, finishBattle, getRecruitOffers, getRewardOffers, resumeRunSession } from './runCommands.ts';

const startingRun = () => createRun(7, new Map([['starter', new Soldier({ name: 'Alden', team: 'player' })]]));
const stageTwo = () => advanceStage(startingRun());

describe('guest recruitment', () => {
  it('has no guest on stage 1, always one on stage 2, then one in each seeded group', () => {
    for (let seed = 0; seed < 40; seed++) {
      expect(isRecruitmentStage(seed, 1)).toBe(false);
      expect(isRecruitmentStage(seed, 2)).toBe(true);
      for (let first = 3; first < 21; first += 3) {
        expect([first, first + 1, first + 2].filter((stage) => isRecruitmentStage(seed, stage))).toHaveLength(1);
      }
    }
    expect(
      new Set(Array.from({ length: 40 }, (_, seed) => [3, 4, 5].find((stage) => isRecruitmentStage(seed, stage)))).size,
    ).toBeGreaterThan(1);
  });

  it('puts the same guest on stage 2 as an ally outside the roster', () => {
    const run = stageTwo();
    const level = createBattleLevel(runStage(run));
    const guest = level.units.get(GUEST_UNIT_ID)!;
    expect(guest.team).toBe('guest');
    expect(guest.name).toContain('(Guest)');
    expect(level.roster).not.toContain(GUEST_UNIT_ID);
    expect(findUnit(level.grid, GUEST_UNIT_ID)).not.toBeNull();
    expect(rollGuest(run)).toEqual(rollGuest(parseRun(serializeRun(run))!));
    expect(createBattleLevel(runStage(startingRun())).units.has(GUEST_UNIT_ID)).toBe(false);
  });

  it('lets the guest act through the battle AI on its own phase while keeping it outside deployment', () => {
    const level = createBattleLevel(runStage(stageTwo()));
    let state = createBattleState(level, 1);
    for (const command of planDeployment(state)) state = applyCommand(state, command).state;
    expect(state.deployed).not.toContain(GUEST_UNIT_ID);
    // The guest goes first.
    expect(state.turnState).toMatchObject({ turn: 1, team: 'guest' });
    const actions = planUnitTurn(state, GUEST_UNIT_ID);
    expect(actions.map((action) => action.type)).toEqual(['move', expect.stringMatching(/attack|wait/)]);
    for (const command of actions) state = applyCommand(state, command).state;
    // The guest's action ends the guest phase, and the player's begins.
    expect(state.turnState).toMatchObject({ turn: 1, team: 'player', done: [] });
    expect(getRunBattleUnits(state).has(GUEST_UNIT_ID)).toBe(true);
  });

  it('offers a surviving guest after victory and lets the player recruit or decline', () => {
    const run = stageTwo();
    const units = restoreRoster(run);
    const guest = restoreUnit(rollGuest(run)!);
    guest.name = `${guest.name} (Guest)`;
    guest.takeDamage(1);
    units.set(GUEST_UNIT_ID, guest);
    const result = finishBattle(resumeRunSession(run), { units }, 'victory');
    expect(result.phase).toBe('recruit');
    const loaded = resumeRunSession(parseRun(serializeRun(result.run))!);
    expect(getRecruitOffers(loaded)).toEqual(getRecruitOffers(result));
    const recruited = applyRunCommand(loaded, { type: 'pick-recruit', index: 0 }).session;
    expect(recruited.phase).toBe('reward');
    expect(recruited.run.roster).toHaveLength(2);
    expect(recruited.run.roster[1].health).toBe(guest.health);
    expect(recruited.run.roster[1].name).not.toContain('(Guest)');
    expect(recruited.run.pendingGuest).toBeUndefined();
    const declined = applyRunCommand(loaded, { type: 'decline-recruit' }).session;
    expect(declined.phase).toBe('reward');
    expect(declined.run.roster).toHaveLength(1);
    expect(declined.run.pendingGuest).toBeUndefined();
  });

  it('does not offer a guest who falls or when the battle is lost', () => {
    const run = stageTwo();
    const dead = restoreUnit(rollGuest(run)!);
    dead.takeDamage(dead.maxHealth);
    const units = restoreRoster(run);
    units.set(GUEST_UNIT_ID, dead);
    expect(finishBattle(resumeRunSession(run), { units }, 'victory').phase).toBe('reward');
    expect(finishBattle(resumeRunSession(run), { units: restoreRoster(run) }, 'defeat').phase).toBe('over');
  });
});

describe('guests on the realm', () => {
  const at = (kind: 'village' | 'battle') => ({
    ...stageTwo(),
    route: {
      visited: ['0-0', '2-0'],
      at: { id: '2-0', name: 'Elderfield', kind, depth: 2, region: 1, levelOffset: 0 },
    },
  });

  it('fights beside the warband at a village, and nowhere else', () => {
    expect(hasGuest(at('village'))).toBe(true);
    expect(rollGuest(at('village'))).not.toBeNull();
    expect(hasGuest(at('battle'))).toBe(false);
    expect(rollGuest(at('battle'))).toBeNull();
  });
});

describe('recruit drafts', () => {
  const owing = (stage = 2) => ({ ...stageTwo(), pendingDraft: stage });

  it('offers DRAFT_CHOICES recruits of different classes, names, ids and quirks', () => {
    for (let seed = 0; seed < 20; seed++) {
      const draft = rollDraft({ ...stageTwo(), seed }, 2);
      expect(draft).toHaveLength(DRAFT_CHOICES);
      for (const key of ['classId', 'name', 'id', 'quirk'] as const) {
        expect(new Set(draft.map((unit) => unit[key])).size).toBe(DRAFT_CHOICES);
      }
      for (const unit of draft) {
        expect(RECRUIT_CLASS_IDS).toContain(unit.classId);
        expect(findQuirk(unit.quirk!)).not.toBeNull();
        expect(unit.name).not.toBe('Alden');
        expect(unit.id).not.toBe('starter');
      }
    }
  });

  it('rolls the same draft for the same run and stage, and a saved one reloads it', () => {
    expect(rollDraft(stageTwo(), 2)).toEqual(rollDraft(stageTwo(), 2));
    expect(rollDraft(stageTwo(), 2)).not.toEqual(rollDraft(stageTwo(), 3));
    const loaded = parseRun(serializeRun(owing()))!;
    expect(loaded.pendingDraft).toBe(2);
    expect(rollDraft(loaded, 2)).toEqual(rollDraft(owing(), 2));
    expect(parseRun(JSON.stringify({ ...owing(), pendingDraft: 0 }))).toBeNull();
    expect(parseRun(JSON.stringify({ ...owing(), pendingDraft: 'x' }))).toBeNull();
  });

  it('adds the picked recruit to the roster and clears the draft', () => {
    const run = owing();
    const picked = settleDraft(run, 1);
    expect(picked.pendingDraft).toBeUndefined();
    expect(picked.roster).toEqual([...run.roster, rollDraft(run, 2)[1]]);
    expect(Object.isFrozen(picked)).toBe(true);
  });

  it('adds nobody when declined, or when the roster is full', () => {
    const run = owing();
    const declined = settleDraft(run, null);
    expect(declined.pendingDraft).toBeUndefined();
    expect(declined.roster).toEqual(run.roster);
    const full = {
      ...run,
      roster: Array.from({ length: MAX_ROSTER_SIZE }, (_, i) => ({ ...run.roster[0], id: `u${i}` })),
    };
    expect(settleDraft(full, 0).roster).toEqual(full.roster);
  });

  it("leaves a run with no draft alone, and refuses an offer that isn't there", () => {
    const run = stageTwo();
    expect(settleDraft(run, 0)).toBe(run);
    expect(() => settleDraft(owing(), DRAFT_CHOICES)).toThrow(RangeError);
  });

  it('goes from the Recruit reward to the draft pick, then to camp', () => {
    const offers = getRecruitOffers({ run: owing(), phase: 'recruit' });
    expect(offers.map((offer) => offer.kind === 'recruit' && offer.unit)).toEqual(rollDraft(owing(), 2));
    const reward = { ...stageTwo(), pendingReward: { stage: 2, rerolls: 0, clearGold: 0, flawless: false } };
    const opened = applyRunCommand(
      { run: reward, phase: 'reward' },
      { type: 'pick-reward', index: getRewardOffers({ run: reward, phase: 'reward' }).findIndex(isDraft) },
    ).session;
    expect(opened.phase).toBe('recruit');
    expect(opened.run.pendingDraft).toBe(2);
    expect(resumeRunSession(parseRun(serializeRun(opened.run))!).phase).toBe('recruit');
    const picked = applyRunCommand(opened, { type: 'pick-recruit', index: 2 }).session;
    expect(picked.phase).toBe('camp');
    expect(picked.run.roster).toHaveLength(2);
    expect(picked.run.roster[1]).toEqual(rollDraft(opened.run, 2)[2]);
    const declined = applyRunCommand(opened, { type: 'decline-recruit' }).session;
    expect(declined.phase).toBe('camp');
    expect(declined.run.roster).toHaveLength(1);
    expect(() => applyRunCommand(opened, { type: 'pick-recruit', index: 3 })).toThrow();
  });

  it('fields a drafted recruit with its quirk', () => {
    const run = settleDraft(owing(), 0);
    const recruit = run.roster[1];
    const unit = restoreRoster(run).get(recruit.id)!;
    expect(unit.quirk).toBe(recruit.quirk);
    expect(unit.modifiers).toEqual(findQuirk(recruit.quirk!)!.modifiers);
  });
});

const isDraft = (reward: Reward) => reward.kind === 'draft';
