import { describe, expect, it } from 'vitest';
import { createBattleLevel, runStage } from '../battleSetup.ts';
import { planDeployment, planUnitTurn } from '../battle/ai.ts';
import { applyCommand } from '../battle/commands.ts';
import { createBattleState, getRunBattleUnits } from '../battle/state.ts';
import { findUnit } from '../grid.ts';
import { Soldier } from '../Soldier.ts';
import { GUEST_UNIT_ID, isRecruitmentStage, rollGuest } from './recruitment.ts';
import { advanceStage, createRun, parseRun, restoreRoster, restoreUnit, serializeRun } from './run.ts';
import { applyRunCommand, finishBattle, getRecruitOffers, resumeRunSession } from './runCommands.ts';

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
