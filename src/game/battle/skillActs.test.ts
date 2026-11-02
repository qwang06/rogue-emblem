import { describe, expect, it } from 'vitest';
import { setTerrain } from '../grid.ts';
import { HEAL_STAFF, staffEntry } from '../healing.ts';
import { HAZARDS, SPIKES } from '../hazards.ts';
import { LAY_MINE, POWER_STRIKE, SHOVE, type Skill } from '../skills.ts';
import { weaponEntry, IRON_SPEAR } from '../weapons.ts';
import { planUnitTurn } from './ai.ts';
import { getSkillActs, SKILL_ACT_WEIGHTS } from './skillActs.ts';
import { createTestBattle, makeTestUnit } from './testLevel.ts';

// An enemy that knows `skills` (with mana to spare) next to a player unit
// on a 6x1 strip, `terrain` on the tile behind the player unit.
function enemyWith(skills: Skill[], { terrain = 'grass', heroHealth = 20, mana = 5 } = {}) {
  const foe = makeTestUnit({ team: 'enemy', mana, strength: 1 });
  foe.modifiers = skills.map((skill) => ({ kind: 'skill' as const, skill }));
  const start = createTestBattle(
    {
      foe: { unit: foe, at: { x: 1, y: 0 } },
      hero: { unit: makeTestUnit({ team: 'player', health: heroHealth }), at: { x: 2, y: 0 } },
    },
    { width: 6 },
  );
  const state = {
    ...start,
    grid: setTerrain(start.grid, 3, 0, terrain),
    turnState: { ...start.turnState!, team: 'enemy' as const },
  };
  return state;
}

describe('getSkillActs', () => {
  it('scores a shove onto spikes by the damage it deals, less its mana', () => {
    const acts = getSkillActs(enemyWith([SHOVE], { terrain: SPIKES }), 'foe', { x: 1, y: 0 });
    expect(acts).toEqual([
      {
        command: { type: 'skill', unitId: 'foe', skillId: 'shove', target: { x: 2, y: 0 } },
        score: HAZARDS[SPIKES].damage * SKILL_ACT_WEIGHTS.damage - SKILL_ACT_WEIGHTS.mana * SHOVE.manaCost,
      },
    ]);
  });

  it('scores a shove into deep water as a kill', () => {
    const [act] = getSkillActs(enemyWith([SHOVE], { terrain: 'water' }), 'foe', { x: 1, y: 0 });
    expect(act.score).toBeGreaterThanOrEqual(SKILL_ACT_WEIGHTS.kill);
  });

  it('has nothing for a unit that knows no skill it can afford and carries no staff', () => {
    expect(getSkillActs(enemyWith([POWER_STRIKE], { mana: 0 }), 'foe', { x: 1, y: 0 })).toEqual([]);
    expect(getSkillActs(enemyWith([]), 'foe', { x: 1, y: 0 })).toEqual([]);
  });

  it('heals a wounded ally with a staff, more for one under half health', () => {
    const healer = makeTestUnit({ team: 'enemy', intelligence: 3, items: [staffEntry(HEAL_STAFF)] });
    const hurt = (health: number) => {
      const ally = makeTestUnit({ team: 'enemy', health: 20 });
      ally.health = health;
      const start = createTestBattle(
        {
          healer: { unit: healer, at: { x: 0, y: 0 } },
          ally: { unit: ally, at: { x: 1, y: 0 } },
          hero: { unit: makeTestUnit({ team: 'player' }), at: { x: 5, y: 0 } },
        },
        { width: 6 },
      );
      const state = { ...start, turnState: { ...start.turnState!, team: 'enemy' as const } };
      const [act] = getSkillActs(state, 'healer', { x: 0, y: 0 });
      return act;
    };
    expect(hurt(15).command).toMatchObject({ type: 'heal', target: { x: 1, y: 0 } });
    expect(hurt(5).score).toBeGreaterThan(hurt(15).score);
  });

  it("doesn't know about a foe's hidden mine on its way", () => {
    const foe = makeTestUnit({ team: 'enemy', mana: 5 });
    foe.modifiers = [{ kind: 'skill', skill: POWER_STRIKE }];
    const start = createTestBattle(
      {
        foe: { unit: foe, at: { x: 0, y: 0 } },
        hero: { unit: makeTestUnit({ team: 'player' }), at: { x: 4, y: 0 } },
      },
      { width: 6 },
    );
    const state = { ...start, turnState: { ...start.turnState!, team: 'enemy' as const } };
    const mined = { ...state, mines: [{ x: 1, y: 0, team: 'player' as const, damage: 6 }] };
    const acts = getSkillActs(mined, 'foe', { x: 3, y: 0 });
    expect(acts).toHaveLength(1);
    expect(acts).toEqual(getSkillActs(state, 'foe', { x: 3, y: 0 }));
  });
});

describe('planUnitTurn with skills', () => {
  it('shoves a foe into deep water rather than poke it', () => {
    const [, act] = planUnitTurn(enemyWith([SHOVE], { terrain: 'water' }), 'foe');
    expect(act).toEqual({ type: 'skill', unitId: 'foe', skillId: 'shove', target: { x: 2, y: 0 } });
  });

  it('attacks when that beats every skill', () => {
    const state = enemyWith([SHOVE]);
    state.units.get('foe')!.strength = 10;
    const [, act] = planUnitTurn(state, 'foe');
    expect(act).toEqual({ type: 'attack', unitId: 'foe', target: { x: 2, y: 0 } });
  });

  it('heals a badly hurt ally instead of marching when no foe is in reach', () => {
    const healer = makeTestUnit({ team: 'enemy', intelligence: 3, items: [staffEntry(HEAL_STAFF)] });
    const ally = makeTestUnit({ team: 'enemy' });
    ally.health = 4;
    const start = createTestBattle(
      {
        healer: { unit: healer, at: { x: 0, y: 0 } },
        ally: { unit: ally, at: { x: 2, y: 0 } },
        hero: { unit: makeTestUnit({ team: 'player' }), at: { x: 9, y: 0 } },
      },
      { width: 10 },
    );
    const state = { ...start, turnState: { ...start.turnState!, team: 'enemy' as const } };
    const [, act] = planUnitTurn(state, 'healer');
    expect(act).toMatchObject({ type: 'heal', unitId: 'healer', target: { x: 2, y: 0 } });
  });

  it('lays a mine near a foe it can’t reach yet', () => {
    const sapper = makeTestUnit({ team: 'enemy', mana: 4, movement: 1, items: [weaponEntry(IRON_SPEAR)] });
    sapper.modifiers = [{ kind: 'skill', skill: LAY_MINE }];
    const start = createTestBattle(
      {
        sapper: { unit: sapper, at: { x: 0, y: 0 } },
        hero: { unit: makeTestUnit({ team: 'player' }), at: { x: 5, y: 0 } },
      },
      { width: 8 },
    );
    const state = { ...start, turnState: { ...start.turnState!, team: 'enemy' as const } };
    const [, act] = planUnitTurn(state, 'sapper');
    expect(act).toMatchObject({ type: 'skill', skillId: 'lay-mine' });
  });
});

describe('planUnitTurn for a unit whose attacks shove', () => {
  it('goes for the foe it can bounce into deep water', () => {
    const slime = makeTestUnit({ team: 'enemy', strength: 1 });
    slime.modifiers = [{ kind: 'shove-on-attack' }];
    // (Without the shove, the two foes tie and it takes the one on the left.)
    const start = createTestBattle(
      {
        left: { unit: makeTestUnit({ team: 'player' }), at: { x: 1, y: 0 } },
        slime: { unit: slime, at: { x: 2, y: 0 } },
        right: { unit: makeTestUnit({ team: 'player' }), at: { x: 3, y: 0 } },
      },
      { width: 6 },
    );
    const state = {
      ...start,
      grid: setTerrain(start.grid, 4, 0, 'water'),
      turnState: { ...start.turnState!, team: 'enemy' as const },
    };
    expect(planUnitTurn(state, 'slime')[1]).toEqual({ type: 'attack', unitId: 'slime', target: { x: 3, y: 0 } });
    slime.modifiers = [];
    expect(planUnitTurn(state, 'slime')[1]).toEqual({ type: 'attack', unitId: 'slime', target: { x: 1, y: 0 } });
  });
});
