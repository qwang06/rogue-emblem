import { describe, expect, it } from 'vitest';
import { createBattleLevel, FIRST_STORY_CHAPTER } from '../battleSetup.ts';
import { findUnit } from '../grid.ts';
import { HEAL_STAFF, staffEntry } from '../healing.ts';
import { HEALTH_POTION } from '../items.ts';
import { TURN_LIMIT } from '../objectives.ts';
import { getMovementRange } from '../movement.ts';
import { IRON_SPEAR, weaponEntry, FISTS } from '../weapons.ts';
import {
  applyCommand,
  BattleCommandError,
  findEvent,
  getSkillTargets,
  getMovementOptions,
  getSkillVictims,
  type BattleCommand,
  type BattleEvent,
} from './commands.ts';
import { createBattleState, getDeployedUnits, getRunBattleResult, type BattleState } from './state.ts';
import { createTestBattle, makeTestUnit } from './testLevel.ts';
import type { Modifier } from '../modifiers.ts';
import {
  AIRLIFT,
  TAUNT,
  BREACH,
  BREACHING_SHOT,
  LAY_MINE,
  BATTERING_CHARGE,
  CHARGE,
  HIT_AND_RUN,
  JUMP_SWING,
  LEND_A_HAND,
  STRAFING_RUN,
  CLEAVE,
  MARK,
  MEND,
  PHALANX,
  RECKLESS_SWING,
  SAVAGE_BITE,
  SMITE,
  TAILWIND,
  WARD,
  PINNING_SHOT,
  POWER_STRIKE,
  PRAYER,
  SANCTUARY,
  ROAR,
  SHOVE,
  SHRAPNEL,
  SUNDER,
  TANDEM_STRIKE,
  type Skill,
} from '../skills.ts';
import { isDone } from '../turns.ts';
import { setTerrain } from '../grid.ts';
import { BUMP_DAMAGE } from '../push.ts';
import { HAZARDS, SPIKES } from '../hazards.ts';

function run(state: BattleState, ...commands: BattleCommand[]) {
  const events: BattleEvent[] = [];
  for (const command of commands) {
    const result = applyCommand(state, command);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

const types = (events: readonly BattleEvent[]) => events.map((event) => event.type);

// A hero at the west end and a foe four tiles east on an 8x1 strip.
function duel(heroOptions = {}, foeOptions = {}) {
  return createTestBattle({
    hero: { unit: makeTestUnit({ team: 'player', ...heroOptions }), at: { x: 0, y: 0 } },
    foe: { unit: makeTestUnit({ team: 'enemy', ...foeOptions }), at: { x: 4, y: 0 } },
  });
}

describe('deployment', () => {
  const demo = () => createBattleState(createBattleLevel(FIRST_STORY_CHAPTER), 1);

  it('places roster units on the zone and starts with them, benching the rest', () => {
    const start = demo();
    const [first, second, third] = start.roster;
    const zone = start.deploymentZone;
    const { state, events } = run(
      start,
      { type: 'place', unitId: first, to: zone[0] },
      { type: 'place', unitId: second, to: zone[1] },
      { type: 'start-battle' },
    );
    expect(state.stage).toBe('battle');
    expect(state.turnState).toMatchObject({ turn: 1, team: 'player' });
    expect(state.deployed).toEqual([first, second]);
    expect(state.units.has(third)).toBe(false);
    expect(types(events)).toEqual(['placed', 'placed', 'battle-started', 'phase-started']);
  });

  it('swaps two placed units when one is placed on the other', () => {
    const start = demo();
    const [first, second] = start.roster;
    const zone = start.deploymentZone;
    const { state } = run(
      start,
      { type: 'place', unitId: first, to: zone[0] },
      { type: 'place', unitId: second, to: zone[1] },
      { type: 'place', unitId: first, to: zone[1] },
    );
    expect(findUnit(state.grid, first)).toEqual(zone[1]);
    expect(findUnit(state.grid, second)).toEqual(zone[0]);
  });

  it("lets a benched unit take a placed one's tile once every slot is taken", () => {
    const start = { ...demo(), deploymentLimit: 2 };
    const zone = start.deploymentZone;
    const [benched, ...fielded] = [start.roster[2], start.roster[0], start.roster[1]];
    const full = run(start, ...fielded.map((unitId, i) => ({ type: 'place' as const, unitId, to: zone[i] }))).state;
    const { state } = run(full, { type: 'place', unitId: benched, to: zone[0] });
    expect(findUnit(state.grid, benched)).toEqual(zone[0]);
    expect(findUnit(state.grid, fielded[0])).toBeNull();
  });

  it('refuses a tile outside the zone, and starting with nobody placed', () => {
    const start = demo();
    expect(() => applyCommand(start, { type: 'place', unitId: start.roster[0], to: { x: 0, y: 0 } })).toThrow(
      BattleCommandError,
    );
    expect(() => applyCommand(start, { type: 'start-battle' })).toThrow(/no unit is placed/);
  });

  it('refuses orders before the battle starts', () => {
    const start = demo();
    expect(() => applyCommand(start, { type: 'wait', unitId: start.roster[0] })).toThrow(/not started/);
  });
});

describe('move', () => {
  it('moves a unit along the cheapest path and marks it moved', () => {
    const { state, events } = run(duel(), { type: 'move', unitId: 'hero', to: { x: 2, y: 0 } });
    expect(state.grid.cells.find((cell) => cell.unitId === 'hero')).toMatchObject({ x: 2, y: 0 });
    expect(state.turnState!.moved).toEqual(['hero']);
    expect(events).toEqual([
      {
        type: 'moved',
        unitId: 'hero',
        from: { x: 0, y: 0 },
        to: { x: 2, y: 0 },
        path: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 2, y: 0 },
        ],
      },
    ]);
  });

  it('refuses a tile out of reach, a second move, and a unit out of its phase', () => {
    const start = duel();
    expect(() => applyCommand(start, { type: 'move', unitId: 'hero', to: { x: 4, y: 0 } })).toThrow(/reach/);
    const moved = applyCommand(start, { type: 'move', unitId: 'hero', to: { x: 1, y: 0 } }).state;
    expect(() => applyCommand(moved, { type: 'move', unitId: 'hero', to: { x: 2, y: 0 } })).toThrow(/already moved/);
    expect(() => applyCommand(start, { type: 'move', unitId: 'foe', to: { x: 3, y: 0 } })).toThrow(/player phase/);
  });

  it('refuses a path that does not end on the tile', () => {
    const command: BattleCommand = {
      type: 'move',
      unitId: 'hero',
      to: { x: 2, y: 0 },
      path: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    };
    expect(() => applyCommand(duel(), command)).toThrow(/path/);
  });
});

describe('attack', () => {
  it('plays out the exchange, dealing damage both ways', () => {
    const { state, events } = run(
      duel(),
      { type: 'move', unitId: 'hero', to: { x: 3, y: 0 } },
      { type: 'attack', unitId: 'hero', target: { x: 4, y: 0 } },
    );
    const strikes = events.filter((event) => event.type === 'strike');
    expect(strikes).toEqual([
      expect.objectContaining({ strikerId: 'hero', targetId: 'foe', hit: true, damage: 6, health: 14 }),
      expect.objectContaining({ strikerId: 'foe', targetId: 'hero', hit: true, damage: 6, health: 14 }),
    ]);
    expect(state.units.get('hero')!.health).toBe(14);
    expect(state.units.get('foe')!.weapon).toBe(IRON_SPEAR);
    expect(types(events)).toContain('experience');
  });

  it('leaves the state it was given alone', () => {
    const start = duel();
    const hero = start.units.get('hero')!;
    run(
      start,
      { type: 'move', unitId: 'hero', to: { x: 3, y: 0 } },
      { type: 'attack', unitId: 'hero', target: { x: 4, y: 0 } },
    );
    expect(start.units.get('hero')).toBe(hero);
    expect(hero.health).toBe(20);
    expect(start.units.get('foe')!.health).toBe(20);
  });

  it('takes a felled unit off the map, hands its loot over and wins a rout', () => {
    const foe = makeTestUnit({ team: 'enemy', health: 5 });
    foe.loot = HEALTH_POTION;
    const start = createTestBattle({
      hero: { unit: makeTestUnit({ team: 'player', items: [weaponEntry(IRON_SPEAR)] }), at: { x: 0, y: 0 } },
      foe: { unit: foe, at: { x: 1, y: 0 } },
    });
    const { state, events } = run(start, { type: 'attack', unitId: 'hero', target: { x: 1, y: 0 } });
    expect(types(events)).toEqual(['strike', 'loot', 'defeated', 'experience', 'unit-done', 'outcome']);
    expect(state.units.has('foe')).toBe(false);
    expect(state.fallen.get('foe')!.health).toBe(0);
    expect(state.units.get('hero')!.items.some((entry) => entry.item.id === HEALTH_POTION.id)).toBe(true);
    expect(state.outcome).toBe('victory');
    expect(() => applyCommand(state, { type: 'end-phase' })).toThrow(/over/);
  });

  it('counts the kill for the unit that landed it', () => {
    const start = createTestBattle({
      hero: { unit: makeTestUnit({ team: 'player', items: [weaponEntry(IRON_SPEAR)] }), at: { x: 0, y: 0 } },
      foe: { unit: makeTestUnit({ team: 'enemy', health: 5 }), at: { x: 1, y: 0 } },
    });
    expect(start.kills.size).toBe(0);
    const { state } = run(start, { type: 'attack', unitId: 'hero', target: { x: 1, y: 0 } });
    expect(state.kills.get('hero')).toBe(1);
    expect(start.kills.size).toBe(0);
  });

  it('hands a run the kills, and whether a boss fell, with the battle', () => {
    const battle = (kind: 'rout' | 'boss') =>
      createTestBattle(
        {
          hero: { unit: makeTestUnit({ team: 'player', items: [weaponEntry(IRON_SPEAR)] }), at: { x: 0, y: 0 } },
          foe: { unit: makeTestUnit({ team: 'enemy', health: 5 }), at: { x: 1, y: 0 } },
        },
        { objective: kind === 'boss' ? { kind: 'boss', unitId: 'foe', name: 'Chief' } : { kind: 'rout' } },
      );
    const attack: BattleCommand = { type: 'attack', unitId: 'hero', target: { x: 1, y: 0 } };
    const boss = getRunBattleResult(run(battle('boss'), attack).state, 1234);
    expect(boss.kills!.get('hero')).toBe(1);
    expect(boss.bossDefeated).toBe(true);
    expect(boss.elapsedMs).toBe(1234);
    expect(getRunBattleResult(run(battle('rout'), attack).state).bossDefeated).toBe(false);
    expect(getRunBattleResult(battle('boss')).bossDefeated).toBe(false);
  });

  it('refuses a target out of reach or not hostile', () => {
    expect(() => applyCommand(duel(), { type: 'attack', unitId: 'hero', target: { x: 4, y: 0 } })).toThrow(/no foe/);
  });

  it('rolls the same with the same seed, and moves the seed on', () => {
    const misses = { dexterity: 0, luck: 0 };
    const battle = (seed: number) =>
      createTestBattle(
        {
          hero: { unit: makeTestUnit({ team: 'player', ...misses }), at: { x: 0, y: 0 } },
          foe: { unit: makeTestUnit({ team: 'enemy', ...misses }), at: { x: 1, y: 0 } },
        },
        { seed },
      );
    const attack: BattleCommand = { type: 'attack', unitId: 'hero', target: { x: 1, y: 0 } };
    const a = applyCommand(battle(5), attack);
    const b = applyCommand(battle(5), attack);
    expect(b.events).toEqual(a.events);
    expect(a.state.rngState).not.toBe(battle(5).rngState);
  });
});

describe('equip', () => {
  it('equips a weapon the unit can wield', () => {
    const hero = makeTestUnit({ team: 'player', items: [weaponEntry(IRON_SPEAR), weaponEntry(FISTS)] });
    const start = createTestBattle({
      hero: { unit: hero, at: { x: 0, y: 0 } },
      foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 4, y: 0 } },
    });
    const { state } = run(start, { type: 'equip', unitId: 'hero', index: 1 });
    expect(state.units.get('hero')!.weapon).toBe(FISTS);
    expect(hero.weapon).toBe(IRON_SPEAR);
    expect(() => applyCommand(start, { type: 'equip', unitId: 'hero', index: 5 })).toThrow(/slot 5/);
  });
});

describe('skill', () => {
  it('spends mana, deals the damage and earns XP', () => {
    const hero = makeTestUnit({ team: 'player', unitClass: 'villager', level: 2, mana: 4 });
    const start = createTestBattle({
      hero: { unit: hero, at: { x: 0, y: 0 } },
      foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 4, y: 0 } },
    });
    const { state, events } = run(start, {
      type: 'skill',
      unitId: 'hero',
      skillId: 'throw-stones',
      target: { x: 4, y: 0 },
    });
    expect(events[0]).toMatchObject({ type: 'skill', damage: 3, health: 17 });
    expect(state.units.get('hero')!.mana).toBe(2);
    expect(() =>
      applyCommand(start, { type: 'skill', unitId: 'hero', skillId: 'power-strike', target: { x: 4, y: 0 } }),
    ).toThrow(/doesn't know/);
  });
});

describe('shove', () => {
  // A shover with Shove next to a foe on a 6x1 strip, `terrain` on the
  // tile behind the foe and anyone in `others` where they're put.
  function shoveAt(terrain = 'grass', others: Parameters<typeof createTestBattle>[0] = {}, foeOptions = {}) {
    const hero = makeTestUnit({ team: 'player', mana: 3 });
    hero.modifiers = [{ kind: 'skill', skill: SHOVE }];
    const start = createTestBattle(
      {
        hero: { unit: hero, at: { x: 1, y: 0 } },
        foe: { unit: makeTestUnit({ team: 'enemy', ...foeOptions }), at: { x: 2, y: 0 } },
        far: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 5, y: 0 } },
        ...others,
      },
      { width: 6 },
    );
    return { ...start, grid: setTerrain(start.grid, 3, 0, terrain) };
  }
  const shove = { type: 'skill', unitId: 'hero', skillId: 'shove', target: { x: 2, y: 0 } } as const;

  it('pushes the foe a tile away, unhurt on open ground, for its mana', () => {
    const { state, events } = run(shoveAt(), shove);
    expect(findUnit(state.grid, 'foe')).toEqual({ x: 3, y: 0 });
    expect(state.units.get('foe')!.health).toBe(20);
    expect(state.units.get('hero')!.mana).toBe(3 - SHOVE.manaCost);
    expect(types(events).slice(0, 2)).toEqual(['skill', 'pushed']);
    expect(findEvent(events, 'pushed')).toMatchObject({ unitId: 'hero', health: 20, push: { to: { x: 3, y: 0 } } });
  });

  it('impales the foe on spikes', () => {
    const { state } = run(shoveAt(SPIKES), shove);
    expect(findUnit(state.grid, 'foe')).toEqual({ x: 3, y: 0 });
    expect(state.units.get('foe')!.health).toBe(20 - HAZARDS[SPIKES].damage);
  });

  it('drowns the foe in deep water: a kill for the shover, with its loot', () => {
    const { state, events } = run(shoveAt('water'), shove);
    expect(state.units.has('foe')).toBe(false);
    expect(state.fallen.get('foe')!.health).toBe(0);
    expect(state.kills.get('hero')).toBe(1);
    expect(types(events)).toContain('defeated');
    expect(findEvent(events, 'pushed')).toMatchObject({ health: 0, push: { drowned: true } });
  });

  it('bumps the foe into a unit behind it, hurting both', () => {
    const { state } = run(
      shoveAt('grass', { other: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 3, y: 0 } } }),
      shove,
    );
    expect(findUnit(state.grid, 'foe')).toEqual({ x: 2, y: 0 });
    expect(state.units.get('foe')!.health).toBe(20 - BUMP_DAMAGE);
    expect(state.units.get('other')!.health).toBe(20 - BUMP_DAMAGE);
  });

  it('knocks out a unit a bump leaves at 0 health', () => {
    const others = { other: { unit: makeTestUnit({ team: 'enemy', health: BUMP_DAMAGE }), at: { x: 3, y: 0 } } };
    const { state } = run(shoveAt('grass', others, { health: BUMP_DAMAGE }), shove);
    expect(state.units.has('foe')).toBe(false);
    expect(state.units.has('other')).toBe(false);
    expect(state.kills.get('hero')).toBe(2);
  });

  it("can't budge a unit that holds its ground", () => {
    const start = shoveAt('water');
    start.units.get('foe')!.holdsPosition = true;
    const { state } = run(start, shove);
    expect(findUnit(state.grid, 'foe')).toEqual({ x: 2, y: 0 });
    expect(state.units.get('foe')!.health).toBe(20);
  });
});

describe('secondary skill sets', () => {
  // An archer that has learned the acolyte's skill set, next to a wounded
  // ally, with a foe in reach of its bow.
  function mender({ mana = 5, allyHealth = 8 } = {}) {
    const hero = makeTestUnit({ team: 'player', unitClass: 'archer', level: 2, intelligence: 1, mana });
    hero.secondaryClass = 'acolyte';
    const ally = makeTestUnit({ team: 'player' });
    ally.health = allyHealth;
    return createTestBattle({
      hero: { unit: hero, at: { x: 1, y: 0 } },
      ally: { unit: ally, at: { x: 0, y: 0 } },
      foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 2, y: 0 } },
    });
  }
  const mend = { type: 'skill', unitId: 'hero', skillId: 'mend', target: { x: 0, y: 0 } } as const;

  it("mends a wounded ally with its secondary class's Mend: mana spent, power + INT healed, heal XP", () => {
    const { state, events } = run(mender(), mend);
    expect(events[0]).toEqual({ type: 'healed', unitId: 'hero', targetId: 'ally', amount: 3, skill: MEND });
    expect(events).toContainEqual(expect.objectContaining({ type: 'experience', unitId: 'hero' }));
    expect(state.units.get('ally')!.health).toBe(11);
    expect(state.units.get('hero')!.mana).toBe(2);
    expect(isDone(state.turnState!, 'hero')).toBe(true);
  });

  it('heals no more than the ally is missing', () => {
    const { events } = run(mender({ allyHealth: 19 }), mend);
    expect(events[0]).toMatchObject({ type: 'healed', amount: 1 });
  });

  it("won't mend a foe, an unhurt ally, or without the mana", () => {
    expect(() => applyCommand(mender(), { ...mend, target: { x: 2, y: 0 } })).toThrow(/wounded ally/);
    expect(() => applyCommand(mender({ allyHealth: 20 }), mend)).toThrow(/wounded ally/);
    expect(() => applyCommand(mender({ mana: 2 }), mend)).toThrow(/afford/);
  });

  it('knows nothing of a set it has not learned', () => {
    const start = mender();
    start.units.get('hero')!.secondaryClass = null;
    expect(() => applyCommand(start, mend)).toThrow(/doesn't know/);
  });

  it('lists foes for a striking skill and wounded allies for a healing one', () => {
    const start = mender();
    const from = { x: 1, y: 0 };
    const targets = (skill: Skill) =>
      getSkillTargets(start.grid, start.units, 'hero', from, skill).map((tile) => tile.unitId);
    expect(targets(MEND)).toEqual(['ally']);
    expect(targets(POWER_STRIKE)).toEqual(['foe']);
    expect(getSkillTargets(start.grid, start.units, 'nobody', from, MEND)).toEqual([]);
  });
});

describe('modifiers', () => {
  // A hero next to a foe it kills in one 6-damage hit.
  function finisher(modifiers: Modifier[], heroOptions = {}) {
    const hero = makeTestUnit({ team: 'player', ...heroOptions });
    hero.modifiers = modifiers;
    return createTestBattle({
      hero: { unit: hero, at: { x: 0, y: 0 } },
      foe: { unit: makeTestUnit({ team: 'enemy', health: 6 }), at: { x: 1, y: 0 } },
      other: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 7, y: 0 } },
    });
  }
  const strike = { type: 'attack', unitId: 'hero', target: { x: 1, y: 0 } } as const;

  it('heals a unit that defeats a foe by its kill-heal', () => {
    const start = finisher([{ kind: 'kill-heal', amount: 4 }]);
    start.units.get('hero')!.health = 10;
    const { state, events } = run(start, strike);
    expect(state.units.get('hero')!.health).toBe(14);
    expect(events).toContainEqual({ type: 'recovered', unitId: 'hero', stat: 'health', amount: 4, trigger: 'kill' });
  });

  it('heals no more than the unit is missing, and nothing at full HP', () => {
    const start = finisher([{ kind: 'kill-heal', amount: 4 }]);
    start.units.get('hero')!.health = 18;
    expect(run(start, strike).state.units.get('hero')!.health).toBe(20);
    const full = run(finisher([{ kind: 'kill-heal', amount: 4 }]), strike);
    expect(types(full.events)).not.toContain('recovered');
  });

  it('heals a lifesteal striker its share of the HP it took, as a drain', () => {
    const start = finisher([{ kind: 'sure-hit' }, { kind: 'lifesteal', percent: 50 }]);
    start.units.get('hero')!.health = 10;
    const { state, events } = run(start, strike);
    expect(state.units.get('hero')!.health).toBe(13);
    expect(events).toContainEqual({ type: 'recovered', unitId: 'hero', stat: 'health', amount: 3, trigger: 'drain' });
  });

  it('splashes a cleave-through hit onto the foes beside its target, not onto allies', () => {
    const hero = makeTestUnit({ team: 'player' });
    hero.modifiers = [{ kind: 'cleave-through', percent: 50 }];
    const start = createTestBattle(
      {
        hero: { unit: hero, at: { x: 0, y: 1 } },
        foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 1, y: 1 } },
        beside: { unit: makeTestUnit({ team: 'enemy', health: 2 }), at: { x: 2, y: 1 } },
        above: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 1, y: 0 } },
        friend: { unit: makeTestUnit({ team: 'player' }), at: { x: 1, y: 2 } },
      },
      { width: 3, height: 3 },
    );
    const { state, events } = run(start, { type: 'attack', unitId: 'hero', target: { x: 1, y: 1 } });
    const firstHit = events.find((event) => event.type === 'strike')!;
    const splash = Math.floor((firstHit.type === 'strike' ? firstHit.damage : 0) / 2);
    expect(events).toContainEqual({ type: 'splash', unitId: 'above', damage: splash, health: 20 - splash });
    expect(events).toContainEqual({ type: 'splash', unitId: 'beside', damage: splash, health: 0 });
    expect(events.some((event) => event.type === 'splash' && event.unitId === 'friend')).toBe(false);
    // A unit felled by the splash leaves the map and counts as the striker's.
    expect(state.units.has('beside')).toBe(false);
    expect(state.kills.get('hero')).toBe(1);
  });

  it('lays status-on-hit statuses on a foe it hits, the crit ones only on a crit', () => {
    const start = finisher([
      { kind: 'sure-hit' },
      { kind: 'combat', term: 'crit', amount: -1000 },
      { kind: 'status-on-hit', status: 'marked' },
      { kind: 'status-on-hit', status: 'sundered', on: 'crit' },
    ]);
    start.units.get('foe')!.health = 20;
    const { state, events } = run(start, strike);
    expect(events).toContainEqual({ type: 'status', unitId: 'hero', targetId: 'foe', status: 'marked' });
    expect(state.units.get('foe')!.statuses).toEqual(['marked']);
  });

  it('stacks a kill-stack term on each kill and heals a kill-heal-percent share', () => {
    const start = finisher([
      { kind: 'kill-stack', term: 'damage', amount: 2 },
      { kind: 'kill-heal-percent', percent: 100 },
    ]);
    start.units.get('hero')!.health = 5;
    const hero = run(start, strike).state.units.get('hero')!;
    expect(hero.health).toBe(20);
    expect(hero.modifiers).toContainEqual({ kind: 'combat', term: 'damage', amount: 2 });
  });

  it('lets an encore unit act again after a kill, once a phase', () => {
    const hero = makeTestUnit({ team: 'player' });
    hero.modifiers = [{ kind: 'encore' }];
    const start = createTestBattle({
      west: { unit: makeTestUnit({ team: 'enemy', health: 6 }), at: { x: 0, y: 0 } },
      hero: { unit: hero, at: { x: 1, y: 0 } },
      east: { unit: makeTestUnit({ team: 'enemy', health: 6 }), at: { x: 2, y: 0 } },
      other: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 7, y: 0 } },
    });
    const first = run(start, { type: 'attack', unitId: 'hero', target: { x: 0, y: 0 } });
    expect(first.events).toContainEqual({ type: 'encore', unitId: 'hero' });
    expect(first.state.turnState!.done).not.toContain('hero');
    const second = run(first.state, { type: 'attack', unitId: 'hero', target: { x: 2, y: 0 } });
    expect(second.state.units.has('east')).toBe(false);
    expect(types(second.events)).not.toContain('encore');
    // Its action over, the player's phase ends.
    expect(second.state.turnState!.team).toBe('enemy');
  });

  it("passes a felled foe's debuffs to the foe nearest it with contagion", () => {
    const start = finisher([{ kind: 'contagion' }]);
    start.units.get('foe')!.statuses = ['marked', 'rooted'];
    const { state } = run(start, strike);
    expect(state.units.get('other')!.statuses).toEqual(['marked', 'rooted']);
  });

  it('lays status-on-recoil statuses on a striker its recoil hurts', () => {
    const start = finisher([{ kind: 'sure-hit' }]);
    const foe = start.units.get('foe')!;
    foe.health = 20;
    foe.modifiers = [
      { kind: 'thorns', amount: 1 },
      { kind: 'status-on-recoil', status: 'sundered' },
    ];
    const { state } = run(start, strike);
    // Laid on its own phase, it lingers through the enemy phase.
    expect(state.turnState!.team).toBe('enemy');
    expect(state.units.get('hero')!.statuses).toContain('sundered');
    expect(state.units.get('hero')!.lingering).toEqual([]);
  });

  it('makes the debuffs a linger-debuffs unit lays last one more foe phase', () => {
    const start = finisher([
      { kind: 'sure-hit' },
      { kind: 'linger-debuffs' },
      { kind: 'status-on-hit', status: 'marked' },
    ]);
    start.units.get('foe')!.health = 20;
    const marked = (state: BattleState) => state.units.get('foe')!.statuses.includes('marked');
    let { state } = run(start, strike);
    expect(marked(state)).toBe(true);
    // Through the enemy phase, then the next turn's player phase, then the
    // end of its second enemy phase.
    state = run(state, { type: 'end-phase' }).state;
    expect(state.turnState!.team).toBe('player');
    expect(marked(state)).toBe(true);
    state = run(state, { type: 'end-phase' }).state;
    expect(marked(state)).toBe(true);
    state = run(state, { type: 'end-phase' }).state;
    expect(marked(state)).toBe(false);
  });

  it('veils a unit with veil-on-wait when it waits', () => {
    const start = finisher([{ kind: 'veil-on-wait' }]);
    const { state, events } = run(start, { type: 'wait', unitId: 'hero' });
    expect(state.units.get('hero')!.statuses).toEqual(['veiled']);
    expect(events).toContainEqual({ type: 'status', unitId: 'hero', targetId: 'hero', status: 'veiled' });
  });

  it("lays a veil-on-wait modifier's own status instead of Veiled (the Ambush Cloak's Lurking)", () => {
    const start = finisher([{ kind: 'veil-on-wait', status: 'lurking' }]);
    const { state } = run(start, { type: 'wait', unitId: 'hero' });
    expect(state.units.get('hero')!.statuses).toEqual(['lurking']);
  });

  it('taunts the foes beside a taunt-aura unit as its phase starts', () => {
    const hero = makeTestUnit({ team: 'player' });
    hero.modifiers = [{ kind: 'taunt-aura' }];
    const state = createTestBattle({
      hero: { unit: hero, at: { x: 0, y: 0 } },
      near: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 1, y: 0 } },
      far: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 5, y: 0 } },
    });
    expect(state.units.get('near')!.statuses).toEqual(['taunted']);
    expect(state.units.get('far')!.statuses).toEqual([]);
    expect(state.units.get('hero')!.statuses).toEqual(['taunting']);
  });

  it('hurts a striker that lands a hit on a thorny foe, and counts its fall as a kill for the foe', () => {
    const hero = makeTestUnit({ team: 'player', health: 2 });
    hero.modifiers = [{ kind: 'sure-hit' }];
    const foe = makeTestUnit({ team: 'enemy' });
    foe.modifiers = [{ kind: 'thorns', amount: 3 }];
    const start = createTestBattle({
      hero: { unit: hero, at: { x: 0, y: 0 } },
      foe: { unit: foe, at: { x: 1, y: 0 } },
    });
    const { state, events } = run(start, { type: 'attack', unitId: 'hero', target: { x: 1, y: 0 } });
    expect(events).toContainEqual({ type: 'recoil', unitId: 'hero', damage: 2, health: 0 });
    expect(events.filter((event) => event.type === 'strike')).toHaveLength(1);
    expect(state.units.has('hero')).toBe(false);
    expect(state.kills.get('foe')).toBe(1);
    expect(state.units.get('foe')!.health).toBe(20 - 6);
  });

  it('chains a kill into one free, uncountered strike on a foe in reach', () => {
    const hero = makeTestUnit({ team: 'player' });
    hero.modifiers = [{ kind: 'chain-kill', percent: 100 }];
    const start = createTestBattle(
      {
        hero: { unit: hero, at: { x: 0, y: 0 } },
        foe: { unit: makeTestUnit({ team: 'enemy', health: 6 }), at: { x: 1, y: 0 } },
        strong: { unit: makeTestUnit({ team: 'enemy', health: 20 }), at: { x: 0, y: 1 } },
        far: { unit: makeTestUnit({ team: 'enemy', health: 15 }), at: { x: 0, y: 2 } },
      },
      { width: 2, height: 3 },
    );
    const { events } = run(start, strike);
    const chain = events.findIndex((event) => event.type === 'chain');
    expect(events[chain]).toEqual({ type: 'chain', unitId: 'hero', targetId: 'strong' });
    expect(events.slice(chain + 1).filter((event) => event.type === 'strike')).toEqual([
      expect.objectContaining({ strikerId: 'hero', targetId: 'strong' }),
    ]);
  });

  it('picks the weakest of the foes the chain reaches', () => {
    const hero = makeTestUnit({ team: 'player' });
    hero.modifiers = [{ kind: 'chain-kill', percent: 100 }];
    const start = createTestBattle(
      {
        hero: { unit: hero, at: { x: 1, y: 0 } },
        foe: { unit: makeTestUnit({ team: 'enemy', health: 6 }), at: { x: 1, y: 1 } },
        strong: { unit: makeTestUnit({ team: 'enemy', health: 20 }), at: { x: 0, y: 0 } },
        weak: { unit: makeTestUnit({ team: 'enemy', health: 15 }), at: { x: 2, y: 0 } },
      },
      { width: 3, height: 2 },
    );
    const { events } = run(start, { type: 'attack', unitId: 'hero', target: { x: 1, y: 1 } });
    expect(events).toContainEqual({ type: 'chain', unitId: 'hero', targetId: 'weak' });
  });

  it('chains nothing without a kill or without the modifier', () => {
    const hero = makeTestUnit({ team: 'player' });
    hero.modifiers = [{ kind: 'chain-kill', percent: 100 }];
    const units = (attacker: ReturnType<typeof makeTestUnit>, health: number) =>
      createTestBattle(
        {
          hero: { unit: attacker, at: { x: 0, y: 0 } },
          foe: { unit: makeTestUnit({ team: 'enemy', health }), at: { x: 1, y: 0 } },
          other: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 0, y: 1 } },
        },
        { width: 2, height: 2 },
      );
    expect(types(run(units(hero, 40), strike).events)).not.toContain('chain');
    expect(types(run(units(makeTestUnit({ team: 'player' }), 6), strike).events)).not.toContain('chain');
  });

  describe('momentum', () => {
    const killer = (amount = 2) => {
      const hero = makeTestUnit({ team: 'player' });
      hero.modifiers = [{ kind: 'momentum', amount }];
      return createTestBattle({
        hero: { unit: hero, at: { x: 0, y: 0 } },
        foe: { unit: makeTestUnit({ team: 'enemy', health: 6 }), at: { x: 1, y: 0 } },
        friend: { unit: makeTestUnit({ team: 'player' }), at: { x: 6, y: 0 } },
        other: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 7, y: 0 } },
      });
    };

    it('lets a unit that fells a foe move its momentum in tiles, then be done', () => {
      const { state, events } = run(killer(), strike);
      expect(events).toContainEqual({ type: 'momentum', unitId: 'hero', movement: 2 });
      expect(types(events)).not.toContain('unit-done');
      expect(state.turnState!.canto).toEqual({ unitId: 'hero', movement: 2 });
      expect(() => applyCommand(state, { type: 'move', unitId: 'hero', to: { x: 3, y: 0 } })).toThrow(/reach/);
      const moved = run(state, { type: 'move', unitId: 'hero', to: { x: 2, y: 0 } });
      expect(findUnit(moved.state.grid, 'hero')).toEqual({ x: 2, y: 0 });
      expect(isDone(moved.state.turnState!, 'hero')).toBe(true);
      expect(moved.state.turnState!.canto).toBeNull();
    });

    it('only lets a unit on a canto move or wait', () => {
      const { state } = run(killer(), strike);
      expect(() => applyCommand(state, { type: 'attack', unitId: 'hero', target: { x: 1, y: 0 } })).toThrow(/move on/);
      const waited = run(state, { type: 'wait', unitId: 'hero' }).state;
      expect(isDone(waited.turnState!, 'hero')).toBe(true);
    });

    it('ends a canto, the unit staying put, when another unit takes an order', () => {
      const { state } = run(killer(), strike, { type: 'move', unitId: 'friend', to: { x: 5, y: 0 } });
      expect(findUnit(state.grid, 'hero')).toEqual({ x: 0, y: 0 });
      expect(isDone(state.turnState!, 'hero')).toBe(true);
      expect(state.turnState!.canto).toBeNull();
    });

    it('gives no canto without a kill, or when the kill wins the battle', () => {
      const hero = makeTestUnit({ team: 'player' });
      hero.modifiers = [{ kind: 'momentum', amount: 2 }];
      const last = createTestBattle({
        hero: { unit: hero, at: { x: 0, y: 0 } },
        foe: { unit: makeTestUnit({ team: 'enemy', health: 6 }), at: { x: 1, y: 0 } },
      });
      expect(types(run(last, strike).events)).not.toContain('momentum');
      const sturdy = killer();
      sturdy.units.get('foe')!.health = 40;
      expect(types(run(sturdy, strike).events)).not.toContain('momentum');
    });
  });

  it("recovers a share of max HP as the unit's phase starts with phase-heal-percent", () => {
    const hero = makeTestUnit({ team: 'player' });
    hero.modifiers = [{ kind: 'phase-heal-percent', percent: 25 }];
    hero.health = 1;
    const start = createTestBattle({
      hero: { unit: hero, at: { x: 0, y: 0 } },
      foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 7, y: 0 } },
    });
    expect(start.units.get('hero')!.health).toBe(1 + Math.floor(hero.maxHealth / 4));
  });

  it("recovers HP and MP as the unit's phase starts", () => {
    const hero = makeTestUnit({ team: 'player', mana: 5 });
    hero.modifiers = [
      { kind: 'phase-heal', amount: 2 },
      { kind: 'phase-mana', amount: 1 },
    ];
    hero.health = 10;
    hero.mana = 0;
    const start = createTestBattle({
      hero: { unit: hero, at: { x: 0, y: 0 } },
      foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 7, y: 0 } },
    });
    // Starting the battle began the player phase.
    expect(start.units.get('hero')!).toMatchObject({ health: 12, mana: 1 });
    const { state, events } = run(start, { type: 'end-phase' }, { type: 'end-phase' });
    expect(state.units.get('hero')!).toMatchObject({ health: 14, mana: 2 });
    expect(events.filter((event) => event.type === 'recovered')).toEqual([
      { type: 'recovered', unitId: 'hero', stat: 'health', amount: 2, trigger: 'phase' },
      { type: 'recovered', unitId: 'hero', stat: 'mana', amount: 1, trigger: 'phase' },
    ]);
  });

  it('uses a skill a modifier taught', () => {
    const hero = makeTestUnit({ team: 'player', mana: 4 });
    hero.modifiers = [{ kind: 'skill', skill: POWER_STRIKE }];
    const start = createTestBattle({
      hero: { unit: hero, at: { x: 0, y: 0 } },
      foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 1, y: 0 } },
    });
    const { events } = run(start, { type: 'skill', unitId: 'hero', skillId: 'power-strike', target: { x: 1, y: 0 } });
    expect(events[0]).toMatchObject({ type: 'skill', damage: 9 });
  });
});

describe('area and follow-up skills', () => {
  // A hero taught `skill` with plenty of mana.
  const user = (skill: Skill, options = {}) => {
    const hero = makeTestUnit({ team: 'player', mana: 20, ...options });
    hero.modifiers = [{ kind: 'skill', skill }];
    return hero;
  };
  const foe = () => makeTestUnit({ team: 'enemy' });
  const skillEvents = (events: readonly BattleEvent[]) => events.filter((event) => event.type === 'skill');

  it('lets Cleave strike the foe it is aimed at and those on either side, but not allies', () => {
    const start = createTestBattle(
      {
        hero: { unit: user(CLEAVE), at: { x: 1, y: 1 } },
        north: { unit: foe(), at: { x: 2, y: 0 } },
        aimed: { unit: foe(), at: { x: 2, y: 1 } },
        ally: { unit: makeTestUnit({ team: 'player' }), at: { x: 2, y: 2 } },
        behind: { unit: foe(), at: { x: 3, y: 1 } },
      },
      { width: 4, height: 3 },
    );
    expect(getSkillVictims(start.grid, start.units, 'hero', { x: 1, y: 1 }, CLEAVE, { x: 2, y: 1 })).toEqual([
      { x: 2, y: 1, unitId: 'aimed' },
      { x: 2, y: 0, unitId: 'north' },
    ]);
    const { state, events } = run(start, { type: 'skill', unitId: 'hero', skillId: 'cleave', target: { x: 2, y: 1 } });
    expect(skillEvents(events)).toEqual([
      expect.objectContaining({ targetId: 'aimed', damage: 6, health: 14 }),
      expect.objectContaining({ targetId: 'north', damage: 6, health: 14, splash: true }),
    ]);
    expect(state.units.get('ally')!.health).toBe(20);
    expect(state.units.get('behind')!.health).toBe(20);
    expect(state.units.get('hero')!.mana).toBe(20 - CLEAVE.manaCost);
  });

  it('lets Shrapnel strike allies in the blast too, and defeats whoever it drops', () => {
    const weak = makeTestUnit({ team: 'enemy', health: 2 });
    const start = createTestBattle(
      {
        hero: { unit: user(SHRAPNEL), at: { x: 0, y: 1 } },
        aimed: { unit: foe(), at: { x: 2, y: 1 } },
        ally: { unit: makeTestUnit({ team: 'player' }), at: { x: 2, y: 0 } },
        weak: { unit: weak, at: { x: 3, y: 1 } },
      },
      { width: 4, height: 3 },
    );
    const { state, events } = run(start, {
      type: 'skill',
      unitId: 'hero',
      skillId: 'shrapnel',
      target: { x: 2, y: 1 },
    });
    expect(skillEvents(events).map((event) => event.targetId)).toEqual(['aimed', 'ally', 'weak']);
    expect(state.units.get('ally')!.health).toBe(17);
    expect(state.units.has('weak')).toBe(false);
    expect(events).toContainEqual(expect.objectContaining({ type: 'defeated', unitId: 'weak' }));
  });

  it("strikes a Tandem Strike's target twice, the second blow at half damage", () => {
    const start = createTestBattle({
      hero: { unit: user(TANDEM_STRIKE), at: { x: 0, y: 0 } },
      foe: { unit: foe(), at: { x: 1, y: 0 } },
    });
    const { state, events } = run(start, {
      type: 'skill',
      unitId: 'hero',
      skillId: 'tandem-strike',
      target: { x: 1, y: 0 },
    });
    expect(skillEvents(events)).toEqual([
      expect.objectContaining({ targetId: 'foe', damage: 6, health: 14 }),
      expect.objectContaining({ targetId: 'foe', damage: 3, health: 11, followUp: true }),
    ]);
    expect(state.units.get('foe')!.health).toBe(11);
  });

  it('aims Prayer at the user itself and mends every wounded ally around it', () => {
    const hurt = (health: number) => {
      const unit = makeTestUnit({ team: 'player' });
      unit.takeDamage(20 - health);
      return unit;
    };
    const start = createTestBattle(
      {
        hero: { unit: user(PRAYER, { intelligence: 4 }), at: { x: 1, y: 1 } },
        west: { unit: hurt(10), at: { x: 0, y: 1 } },
        east: { unit: hurt(19), at: { x: 2, y: 1 } },
        north: { unit: makeTestUnit({ team: 'player' }), at: { x: 1, y: 0 } },
        far: { unit: hurt(10), at: { x: 3, y: 1 } },
        foe: { unit: foe(), at: { x: 3, y: 2 } },
      },
      { width: 4, height: 3 },
    );
    expect(getSkillTargets(start.grid, start.units, 'hero', { x: 1, y: 1 }, PRAYER)).toEqual([
      { x: 1, y: 1, unitId: 'hero' },
    ]);
    const { state, events } = run(start, { type: 'skill', unitId: 'hero', skillId: 'prayer', target: { x: 1, y: 1 } });
    expect(events.filter((event) => event.type === 'healed')).toEqual([
      { type: 'healed', unitId: 'hero', targetId: 'east', amount: 1, skill: PRAYER },
      { type: 'healed', unitId: 'hero', targetId: 'west', amount: 3, skill: PRAYER },
    ]);
    expect(state.units.get('far')!.health).toBe(10);
  });

  it('aims Sanctuary at a wounded ally up to 2 tiles away and mends every wounded ally around it', () => {
    const hurt = (health: number) => {
      const unit = makeTestUnit({ team: 'player' });
      unit.takeDamage(20 - health);
      return unit;
    };
    const start = createTestBattle(
      {
        hero: { unit: user(SANCTUARY, { intelligence: 4 }), at: { x: 0, y: 1 } },
        aimed: { unit: hurt(10), at: { x: 2, y: 1 } },
        beside: { unit: hurt(15), at: { x: 3, y: 1 } },
        whole: { unit: makeTestUnit({ team: 'player' }), at: { x: 2, y: 0 } },
        far: { unit: hurt(10), at: { x: 4, y: 1 } },
        foe: { unit: foe(), at: { x: 4, y: 2 } },
      },
      { width: 5, height: 3 },
    );
    expect(getSkillTargets(start.grid, start.units, 'hero', { x: 0, y: 1 }, SANCTUARY)).toEqual([
      { x: 2, y: 1, unitId: 'aimed' },
    ]);
    const { state, events } = run(start, {
      type: 'skill',
      unitId: 'hero',
      skillId: 'sanctuary',
      target: { x: 2, y: 1 },
    });
    expect(events.filter((event) => event.type === 'healed')).toEqual([
      { type: 'healed', unitId: 'hero', targetId: 'aimed', amount: 6, skill: SANCTUARY },
      { type: 'healed', unitId: 'hero', targetId: 'beside', amount: 5, skill: SANCTUARY },
    ]);
    expect(state.units.get('far')!.health).toBe(10);
  });

  it('offers Prayer nowhere when no ally around is wounded', () => {
    const start = createTestBattle({
      hero: { unit: user(PRAYER), at: { x: 0, y: 0 } },
      ally: { unit: makeTestUnit({ team: 'player' }), at: { x: 1, y: 0 } },
      foe: { unit: foe(), at: { x: 7, y: 0 } },
    });
    expect(getSkillTargets(start.grid, start.units, 'hero', { x: 0, y: 0 }, PRAYER)).toEqual([]);
  });
});

describe('status skills', () => {
  const user = (skill: Skill) => {
    const hero = makeTestUnit({ team: 'player', mana: 20 });
    hero.modifiers = [{ kind: 'skill', skill }];
    return hero;
  };

  it("roots a foe with Pinning Shot until the end of the foe's next phase, so it can't move", () => {
    const start = createTestBattle({
      hero: { unit: user(PINNING_SHOT), at: { x: 0, y: 0 } },
      foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 2, y: 0 } },
    });
    const pinned = run(start, { type: 'skill', unitId: 'hero', skillId: 'pinning-shot', target: { x: 2, y: 0 } });
    expect(pinned.events).toContainEqual({ type: 'status', unitId: 'hero', targetId: 'foe', status: 'rooted' });
    // The player phase ended with the hero's action: the foe stays rooted
    // through its own phase.
    expect(pinned.state.turnState?.team).toBe('enemy');
    expect(pinned.state.units.get('foe')!.statuses).toEqual(['rooted']);
    expect(() =>
      applyCommand(pinned.state, {
        type: 'move',
        unitId: 'foe',
        to: { x: 3, y: 0 },
        path: [
          { x: 2, y: 0 },
          { x: 3, y: 0 },
        ],
      }),
    ).toThrow();
    const after = run(pinned.state, { type: 'wait', unitId: 'foe' });
    expect(after.state.turnState?.team).toBe('player');
    expect(after.state.units.get('foe')!.statuses).toEqual([]);
  });

  it('lets a Sundered foe take 3 more damage from the next hit', () => {
    const start = createTestBattle(
      {
        hero: { unit: user(SUNDER), at: { x: 0, y: 0 } },
        ally: { unit: user(POWER_STRIKE), at: { x: 2, y: 1 } },
        foe: { unit: makeTestUnit({ team: 'enemy', health: 40 }), at: { x: 1, y: 0 } },
      },
      { height: 2 },
    );
    const { state, events } = run(
      start,
      { type: 'skill', unitId: 'hero', skillId: 'sunder', target: { x: 1, y: 0 } },
      {
        type: 'move',
        unitId: 'ally',
        to: { x: 1, y: 1 },
        path: [
          { x: 2, y: 1 },
          { x: 1, y: 1 },
        ],
      },
      { type: 'skill', unitId: 'ally', skillId: 'power-strike', target: { x: 1, y: 0 } },
    );
    const blows = events.filter((event) => event.type === 'skill').map((event) => event.damage);
    // Sunder: 6 + 2; Power Strike: 6 + 3, and 3 more on a Sundered foe.
    expect(blows).toEqual([8, 12]);
    expect(state.units.get('foe')!.health).toBe(20);
  });

  it('marks a foe without hurting it, and roars to root every foe around', () => {
    const marked = run(
      createTestBattle({
        hero: { unit: user(MARK), at: { x: 0, y: 0 } },
        foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 3, y: 0 } },
      }),
      { type: 'skill', unitId: 'hero', skillId: 'mark', target: { x: 3, y: 0 } },
    );
    expect(marked.state.units.get('foe')!).toMatchObject({ health: 20, statuses: ['marked'] });

    const start = createTestBattle(
      {
        hero: { unit: user(ROAR), at: { x: 1, y: 1 } },
        west: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 0, y: 1 } },
        north: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 1, y: 0 } },
        ally: { unit: makeTestUnit({ team: 'player' }), at: { x: 2, y: 1 } },
        far: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 3, y: 2 } },
      },
      { width: 4, height: 3 },
    );
    const roared = run(start, { type: 'skill', unitId: 'hero', skillId: 'roar', target: { x: 1, y: 1 } });
    const statuses = (id: string) => roared.state.units.get(id)!.statuses;
    expect([statuses('west'), statuses('north'), statuses('ally'), statuses('far')]).toEqual([
      ['rooted'],
      ['rooted'],
      [],
      [],
    ]);
    expect(roared.state.units.get('west')!.health).toBe(20);
  });
});

describe('buff skills', () => {
  const user = (skill: Skill) => {
    const hero = makeTestUnit({ team: 'player', mana: 20 });
    hero.modifiers = [{ kind: 'skill', skill }];
    return hero;
  };

  it('guards every ally around with Phalanx through the enemy phase, until their own next phase', () => {
    const start = createTestBattle(
      {
        hero: { unit: user(PHALANX), at: { x: 1, y: 1 } },
        west: { unit: makeTestUnit({ team: 'player' }), at: { x: 0, y: 1 } },
        far: { unit: makeTestUnit({ team: 'player' }), at: { x: 3, y: 1 } },
        foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 0, y: 2 } },
      },
      { width: 4, height: 3 },
    );
    expect(getSkillTargets(start.grid, start.units, 'hero', { x: 1, y: 1 }, PHALANX)).toEqual([
      { x: 1, y: 1, unitId: 'hero' },
    ]);
    const guarded = run(
      start,
      { type: 'skill', unitId: 'hero', skillId: 'phalanx', target: { x: 1, y: 1 } },
      { type: 'wait', unitId: 'west' },
      { type: 'wait', unitId: 'far' },
    );
    expect(guarded.events).toContainEqual({ type: 'status', unitId: 'hero', targetId: 'west', status: 'guarded' });
    expect(guarded.state.turnState?.team).toBe('enemy');
    expect(guarded.state.units.get('west')!.statuses).toEqual(['guarded']);
    expect(guarded.state.units.get('far')!.statuses).toEqual([]);
    // The foe's spear hits for 6, 2 less on a Guarded ally.
    const struck = run(guarded.state, { type: 'attack', unitId: 'foe', target: { x: 0, y: 1 } });
    const blow = struck.events.find((event) => event.type === 'strike' && event.strikerId === 'foe');
    expect(blow).toMatchObject({ damage: 4 });
    expect(struck.state.turnState?.team).toBe('player');
    expect(struck.state.units.get('west')!.statuses).toEqual([]);
  });

  it('wards one ally up to 2 tiles away, never a foe', () => {
    const start = createTestBattle({
      hero: { unit: user(WARD), at: { x: 0, y: 0 } },
      ally: { unit: makeTestUnit({ team: 'player' }), at: { x: 2, y: 0 } },
      foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 1, y: 0 } },
    });
    expect(getSkillTargets(start.grid, start.units, 'hero', { x: 0, y: 0 }, WARD)).toEqual([
      { x: 2, y: 0, unitId: 'ally' },
    ]);
    const { state } = run(start, { type: 'skill', unitId: 'hero', skillId: 'ward', target: { x: 2, y: 0 } });
    expect(state.units.get('ally')!.statuses).toEqual(['warded']);
  });

  it('lets a Tailwind ally move 2 tiles further this turn', () => {
    const start = createTestBattle(
      {
        hero: { unit: user(TAILWIND), at: { x: 0, y: 0 } },
        ally: { unit: makeTestUnit({ team: 'player', movement: 3 }), at: { x: 1, y: 0 } },
        foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 9, y: 0 } },
      },
      { width: 10 },
    );
    const far = { x: 6, y: 0 };
    expect(() => applyCommand(start, { type: 'move', unitId: 'ally', to: far })).toThrow(/reach/);
    const { state } = run(
      start,
      { type: 'skill', unitId: 'hero', skillId: 'tailwind', target: { x: 1, y: 0 } },
      { type: 'move', unitId: 'ally', to: far },
    );
    expect(findUnit(state.grid, 'ally')).toEqual(far);
  });
});

describe('drain, recoil and monster skills', () => {
  const user = (skill: Skill, options = {}) => {
    const hero = makeTestUnit({ team: 'player', mana: 20, ...options });
    hero.modifiers = [{ kind: 'skill', skill }];
    return hero;
  };
  const duelWith = (hero: ReturnType<typeof user>, foe = makeTestUnit({ team: 'enemy' })) =>
    createTestBattle({ hero: { unit: hero, at: { x: 0, y: 0 } }, foe: { unit: foe, at: { x: 1, y: 0 } } });

  it('heals Savage Bite for half the damage, rounded up', () => {
    const hero = user(SAVAGE_BITE);
    hero.takeDamage(10);
    const { state, events } = run(duelWith(hero), {
      type: 'skill',
      unitId: 'hero',
      skillId: 'savage-bite',
      target: { x: 1, y: 0 },
    });
    expect(events).toContainEqual({ type: 'recovered', unitId: 'hero', stat: 'health', amount: 3, trigger: 'drain' });
    expect(state.units.get('hero')!.health).toBe(13);
  });

  it('costs Reckless Swing 3 HP, but never the last', () => {
    const { state, events } = run(duelWith(user(RECKLESS_SWING)), {
      type: 'skill',
      unitId: 'hero',
      skillId: 'reckless-swing',
      target: { x: 1, y: 0 },
    });
    expect(events).toContainEqual(expect.objectContaining({ type: 'skill', damage: 12 }));
    expect(events).toContainEqual({ type: 'recoil', unitId: 'hero', damage: 3, health: 17 });
    expect(state.units.get('hero')!.health).toBe(17);

    const frail = user(RECKLESS_SWING);
    frail.takeDamage(18);
    const last = run(duelWith(frail), {
      type: 'skill',
      unitId: 'hero',
      skillId: 'reckless-swing',
      target: { x: 1, y: 0 },
    });
    expect(last.state.units.get('hero')!.health).toBe(1);
  });

  it('smites a monster harder', () => {
    const monster = makeTestUnit({ team: 'enemy', health: 40 });
    monster.monster = true;
    const hit = (foe: ReturnType<typeof makeTestUnit>) =>
      run(duelWith(user(SMITE), foe), {
        type: 'skill',
        unitId: 'hero',
        skillId: 'smite',
        target: { x: 1, y: 0 },
      }).events.find((event) => event.type === 'skill');
    expect(hit(makeTestUnit({ team: 'enemy', health: 40 }))).toMatchObject({ damage: 9 });
    expect(hit(monster)).toMatchObject({ damage: 12 });
  });
});

describe('blink', () => {
  it('moves a blinking unit over water and through foes, stopping only where it can stand', () => {
    const hero = makeTestUnit({ team: 'player' });
    hero.modifiers = [{ kind: 'blink' }];
    let start = createTestBattle({
      hero: { unit: hero, at: { x: 0, y: 0 } },
      foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 2, y: 0 } },
      other: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 7, y: 0 } },
    });
    start = { ...start, grid: setTerrain(start.grid, 1, 0, 'water') };
    const options = getMovementOptions(start.units, start.units.get('hero')!);
    const range = getMovementRange(start.grid, { x: 0, y: 0 }, 3, options).map(({ x }) => x);
    expect(range.sort()).toEqual([0, 3]);
    const { state } = run(start, { type: 'move', unitId: 'hero', to: { x: 3, y: 0 } });
    expect(findUnit(state.grid, 'hero')).toEqual({ x: 3, y: 0 });
  });

  it('leaves other units walking as usual', () => {
    const start = duel();
    const options = getMovementOptions(start.units, start.units.get('hero')!);
    expect(options.canStopOn).toBeUndefined();
    expect(options.canPassThrough?.('foe')).toBe(false);
  });
});

describe('movement skills', () => {
  const user = (skill: Skill) => {
    const hero = makeTestUnit({ team: 'player', mana: 20 });
    hero.modifiers = [{ kind: 'skill', skill }];
    return hero;
  };
  const foe = () => makeTestUnit({ team: 'enemy' });
  const ally = () => makeTestUnit({ team: 'player' });
  const skillAt = (skillId: string, x: number) =>
    ({ type: 'skill', unitId: 'hero', skillId, target: { x, y: 0 } }) as const;

  it('leaps Jump Swing up to 2 tiles to land next to its foe and strike with 2 more power', () => {
    const start = createTestBattle({
      hero: { unit: user(JUMP_SWING), at: { x: 0, y: 0 } },
      foe: { unit: foe(), at: { x: 3, y: 0 } },
    });
    const { state, events } = run(start, skillAt('jump-swing', 3));
    expect(events.slice(0, 2)).toEqual([
      { type: 'relocated', unitId: 'hero', from: { x: 0, y: 0 }, to: { x: 2, y: 0 } },
      expect.objectContaining({ type: 'skill', targetId: 'foe', damage: 8 }),
    ]);
    expect(findUnit(state.grid, 'hero')).toEqual({ x: 2, y: 0 });
  });

  it('offers no leap when no tile next to the foe is free and in reach', () => {
    const start = createTestBattle({
      hero: { unit: user(JUMP_SWING), at: { x: 0, y: 0 } },
      friend: { unit: ally(), at: { x: 2, y: 0 } },
      foe: { unit: foe(), at: { x: 3, y: 0 } },
    });
    expect(getSkillTargets(start.grid, start.units, 'hero', { x: 0, y: 0 }, JUMP_SWING)).toEqual([]);
  });

  it('charges Battering Charge along a clear line, then pushes the foe', () => {
    const start = createTestBattle({
      hero: { unit: user(BATTERING_CHARGE), at: { x: 0, y: 0 } },
      foe: { unit: foe(), at: { x: 4, y: 0 } },
    });
    const { state, events } = run(start, skillAt('battering-charge', 4));
    expect(events[0]).toEqual({ type: 'relocated', unitId: 'hero', from: { x: 0, y: 0 }, to: { x: 3, y: 0 } });
    expect(events).toContainEqual(expect.objectContaining({ type: 'pushed' }));
    expect(findUnit(state.grid, 'foe')).toEqual({ x: 5, y: 0 });

    const blocked = createTestBattle({
      hero: { unit: user(BATTERING_CHARGE), at: { x: 0, y: 0 } },
      friend: { unit: ally(), at: { x: 2, y: 0 } },
      foe: { unit: foe(), at: { x: 4, y: 0 } },
    });
    expect(getSkillTargets(blocked.grid, blocked.units, 'hero', { x: 0, y: 0 }, BATTERING_CHARGE)).toEqual([]);
  });

  it('flies Strafing Run over every foe in its line for half a hit each, landing past them', () => {
    const start = createTestBattle({
      hero: { unit: user(STRAFING_RUN), at: { x: 0, y: 0 } },
      near: { unit: foe(), at: { x: 1, y: 0 } },
      far: { unit: foe(), at: { x: 2, y: 0 } },
    });
    const { state, events } = run(start, skillAt('strafing-run', 1));
    expect(events.slice(0, 3)).toEqual([
      { type: 'relocated', unitId: 'hero', from: { x: 0, y: 0 }, to: { x: 3, y: 0 } },
      expect.objectContaining({ type: 'skill', targetId: 'near', damage: 3 }),
      expect.objectContaining({ type: 'skill', targetId: 'far', damage: 3, splash: true }),
    ]);
    expect(findUnit(state.grid, 'hero')).toEqual({ x: 3, y: 0 });
  });

  it('offers no strafing run without a free tile to land on past the foe', () => {
    const start = createTestBattle({
      hero: { unit: user(STRAFING_RUN), at: { x: 0, y: 0 } },
      near: { unit: foe(), at: { x: 1, y: 0 } },
      far: { unit: foe(), at: { x: 2, y: 0 } },
      friend: { unit: ally(), at: { x: 3, y: 0 } },
    });
    expect(getSkillTargets(start.grid, start.units, 'hero', { x: 0, y: 0 }, STRAFING_RUN)).toEqual([]);
  });

  it('steps back after Hit and Run, as far as the map allows', () => {
    const start = createTestBattle({
      hero: { unit: user(HIT_AND_RUN), at: { x: 2, y: 0 } },
      foe: { unit: foe(), at: { x: 3, y: 0 } },
    });
    const { state, events } = run(start, skillAt('hit-and-run', 3));
    expect(events).toContainEqual({ type: 'relocated', unitId: 'hero', from: { x: 2, y: 0 }, to: { x: 0, y: 0 } });
    expect(findUnit(state.grid, 'hero')).toEqual({ x: 0, y: 0 });
  });

  it('adds a power to Charge for each tile walked this turn, up to 4, until the next phase', () => {
    const charge = (walk: number) => {
      const start = createTestBattle({
        hero: { unit: user(CHARGE), at: { x: 0, y: 0 } },
        foe: { unit: foe(), at: { x: walk + 1, y: 0 } },
      });
      const path = Array.from({ length: walk + 1 }, (_, x) => ({ x, y: 0 }));
      const moved = walk > 0 ? run(start, { type: 'move', unitId: 'hero', to: { x: walk, y: 0 }, path }).state : start;
      return run(moved, skillAt('charge', walk + 1));
    };
    expect(charge(0).events).toContainEqual(expect.objectContaining({ type: 'skill', damage: 6 }));
    const ran = charge(3);
    expect(ran.events).toContainEqual(expect.objectContaining({ type: 'skill', damage: 9 }));
    const next = run(ran.state, { type: 'wait', unitId: 'foe' });
    expect(next.state.units.get('hero')!.movedTiles).toBe(0);
  });

  it('trades places with an ally with Lend a Hand and Airlift', () => {
    const swap = (skill: Skill, x: number) =>
      run(
        createTestBattle({
          hero: { unit: user(skill), at: { x: 0, y: 0 } },
          friend: { unit: ally(), at: { x, y: 0 } },
          foe: { unit: foe(), at: { x: 7, y: 0 } },
        }),
        skillAt(skill.id, x),
      );
    const { state, events } = swap(LEND_A_HAND, 1);
    expect(events.slice(0, 2)).toEqual([
      { type: 'relocated', unitId: 'hero', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
      { type: 'relocated', unitId: 'friend', from: { x: 1, y: 0 }, to: { x: 0, y: 0 } },
    ]);
    expect(findUnit(state.grid, 'friend')).toEqual({ x: 0, y: 0 });
    expect(state.units.get('hero')!.mana).toBe(19);
    expect(findUnit(swap(AIRLIFT, 3).state.grid, 'hero')).toEqual({ x: 3, y: 0 });
  });

  it("doesn't swap an ally onto ground it couldn't stand on", () => {
    const start = createTestBattle({
      hero: { unit: user(LEND_A_HAND), at: { x: 0, y: 0 } },
      friend: { unit: ally(), at: { x: 1, y: 0 } },
    });
    const grid = setTerrain(start.grid, 1, 0, 'water');
    expect(getSkillTargets(grid, start.units, 'hero', { x: 0, y: 0 }, LEND_A_HAND)).toEqual([]);
  });
});

describe('taunt', () => {
  it('leaves every foe within 2 tiles Taunted and the user Taunting, through the enemy phase', () => {
    const hero = makeTestUnit({ team: 'player', mana: 20 });
    hero.modifiers = [{ kind: 'skill', skill: TAUNT }];
    const start = createTestBattle({
      hero: { unit: hero, at: { x: 0, y: 0 } },
      near: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 2, y: 0 } },
      far: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 3, y: 0 } },
    });
    const { state, events } = run(start, { type: 'skill', unitId: 'hero', skillId: 'taunt', target: { x: 0, y: 0 } });
    expect(events).toContainEqual({ type: 'status', unitId: 'hero', targetId: 'near', status: 'taunted' });
    expect(events).toContainEqual({ type: 'status', unitId: 'hero', targetId: 'hero', status: 'taunting' });
    expect(state.units.get('far')!.statuses).toEqual([]);
    expect(state.turnState?.team).toBe('enemy');
    expect(state.units.get('hero')!.statuses).toEqual(['taunting']);
    expect(state.units.get('near')!.health).toBe(20);
  });
});

describe('terrain skills', () => {
  const user = (skill: Skill) => {
    const hero = makeTestUnit({ team: 'player', mana: 20 });
    hero.modifiers = [{ kind: 'skill', skill }];
    return hero;
  };

  it('lays a mine that goes off under the first foe to walk onto it, never for its last HP', () => {
    const start = createTestBattle({
      hero: { unit: user(LAY_MINE), at: { x: 0, y: 0 } },
      foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 4, y: 0 } },
    });
    expect(getSkillTargets(start.grid, start.units, 'hero', { x: 0, y: 0 }, LAY_MINE)).toEqual([
      { x: 1, y: 0, unitId: '' },
    ]);
    const laid = run(start, { type: 'skill', unitId: 'hero', skillId: 'lay-mine', target: { x: 1, y: 0 } });
    expect(laid.events).toContainEqual({ type: 'mine-laid', unitId: 'hero', at: { x: 1, y: 0 } });
    expect(laid.state.mines).toEqual([{ x: 1, y: 0, team: 'player', damage: 6 }]);
    expect(laid.state.turnState?.team).toBe('enemy');

    const path = [4, 3, 2, 1].map((x) => ({ x, y: 0 }));
    const tripped = run(laid.state, { type: 'move', unitId: 'foe', to: { x: 1, y: 0 }, path });
    expect(tripped.events).toContainEqual({
      type: 'mine-tripped',
      unitId: 'foe',
      at: { x: 1, y: 0 },
      damage: 6,
      health: 14,
    });
    expect(tripped.state.mines).toEqual([]);
    expect(findUnit(tripped.state.grid, 'foe')).toEqual({ x: 1, y: 0 });
  });

  it("lets the mine's own side walk over it", () => {
    const start = createTestBattle(
      {
        hero: { unit: user(LAY_MINE), at: { x: 0, y: 0 } },
        friend: { unit: makeTestUnit({ team: 'player' }), at: { x: 0, y: 1 } },
        foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 4, y: 1 } },
      },
      { height: 2 },
    );
    const laid = run(start, { type: 'skill', unitId: 'hero', skillId: 'lay-mine', target: { x: 1, y: 0 } });
    const walked = run(laid.state, {
      type: 'move',
      unitId: 'friend',
      to: { x: 1, y: 0 },
      path: [
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 1, y: 0 },
      ],
    });
    expect(walked.events.some((event) => event.type === 'mine-tripped')).toBe(false);
    expect(walked.state.mines).toHaveLength(1);
  });

  it('breaches a wall next to the user, and a siege breaches one from range', () => {
    const walled = (skill: Skill) => {
      const start = createTestBattle({
        hero: { unit: user(skill), at: { x: 0, y: 0 } },
        foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 7, y: 0 } },
      });
      return { ...start, grid: setTerrain(setTerrain(start.grid, 1, 0, 'wall'), 3, 0, 'mountain') };
    };
    const near = walled(BREACH);
    expect(getSkillTargets(near.grid, near.units, 'hero', { x: 0, y: 0 }, BREACH)).toEqual([
      { x: 1, y: 0, unitId: '' },
    ]);
    const { state, events } = run(near, { type: 'skill', unitId: 'hero', skillId: 'breach', target: { x: 1, y: 0 } });
    expect(events).toContainEqual({ type: 'breached', unitId: 'hero', at: { x: 1, y: 0 }, terrain: 'dirt' });
    expect(state.grid.cells[1].terrain).toBe('dirt');

    const far = walled(BREACHING_SHOT);
    expect(getSkillTargets(far.grid, far.units, 'hero', { x: 0, y: 0 }, BREACHING_SHOT)).toEqual([
      { x: 1, y: 0, unitId: '' },
      { x: 3, y: 0, unitId: '' },
    ]);
  });
});

describe('heal and items', () => {
  it('heals a wounded ally with a staff', () => {
    const ally = makeTestUnit({ team: 'player' });
    ally.takeDamage(10);
    const start = createTestBattle({
      healer: {
        unit: makeTestUnit({ team: 'player', intelligence: 3, items: [staffEntry(HEAL_STAFF)] }),
        at: { x: 0, y: 0 },
      },
      ally: { unit: ally, at: { x: 1, y: 0 } },
      foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 7, y: 0 } },
    });
    const { state, events } = run(start, { type: 'heal', unitId: 'healer', staffIndex: 0, target: { x: 1, y: 0 } });
    expect(events[0]).toEqual({ type: 'healed', unitId: 'healer', targetId: 'ally', amount: 5 });
    expect(state.units.get('ally')!.health).toBe(15);
    expect(state.units.get('healer')!.staves).toEqual([{ staff: HEAL_STAFF, index: 0 }]);
  });

  it('uses a potion, but not one that would restore nothing', () => {
    const hero = makeTestUnit({
      team: 'player',
      items: [weaponEntry(IRON_SPEAR), { item: HEALTH_POTION, quantity: 2 }],
    });
    const start = createTestBattle({
      hero: { unit: hero, at: { x: 0, y: 0 } },
      foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 4, y: 0 } },
    });
    expect(() => applyCommand(start, { type: 'item', unitId: 'hero', itemId: HEALTH_POTION.id })).toThrow(/nothing/);
    hero.takeDamage(4);
    const { events } = run(start, { type: 'item', unitId: 'hero', itemId: HEALTH_POTION.id });
    expect(events[0]).toMatchObject({ type: 'item-used', unitId: 'hero', amount: 4 });
  });
});

describe('phases', () => {
  it('hands over to the enemy once every player unit has acted', () => {
    const { state, events } = run(duel(), { type: 'wait', unitId: 'hero' });
    expect(types(events)).toEqual(['unit-done', 'phase-started']);
    expect(state.turnState).toMatchObject({ turn: 1, team: 'enemy' });
    expect(() => applyCommand(state, { type: 'wait', unitId: 'hero' })).toThrow(/enemy phase/);
  });

  it('ends a phase early, and starts the next turn after the enemy phase', () => {
    const { state } = run(duel(), { type: 'end-phase' }, { type: 'wait', unitId: 'foe' });
    expect(state.turnState).toMatchObject({ turn: 2, team: 'player', done: [] });
  });

  it('wins a survive objective once its last turn is over', () => {
    const start = createTestBattle(
      {
        hero: { unit: makeTestUnit({ team: 'player' }), at: { x: 0, y: 0 } },
        foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 7, y: 0 } },
      },
      { objective: { kind: 'survive', turns: 1 } },
    );
    const { state, events } = run(start, { type: 'end-phase' }, { type: 'end-phase' });
    expect(state.outcome).toBe('victory');
    expect(events[events.length - 1]).toEqual({ type: 'outcome', outcome: 'victory' });
  });

  it('loses a rout still undecided once the turn limit is over', () => {
    const passTurn: BattleCommand[] = [{ type: 'end-phase' }, { type: 'end-phase' }];
    const { state: lastTurn } = run(duel(), ...Array.from({ length: TURN_LIMIT - 1 }, () => passTurn).flat());
    expect(lastTurn.turnState).toMatchObject({ turn: TURN_LIMIT, team: 'player' });
    expect(lastTurn.outcome).toBeNull();
    const { state, events } = run(lastTurn, ...passTurn);
    expect(state.outcome).toBe('defeat');
    expect(events[events.length - 1]).toEqual({ type: 'outcome', outcome: 'defeat' });
  });

  it('keeps fallen roster units among the deployed', () => {
    const start = createBattleState(createBattleLevel(FIRST_STORY_CHAPTER), 1);
    const { state } = run(
      start,
      { type: 'place', unitId: start.roster[0], to: start.deploymentZone[0] },
      { type: 'start-battle' },
    );
    expect([...getDeployedUnits(state).keys()]).toEqual([start.roster[0]]);
  });
});

describe('take-boon', () => {
  it('gives the unit the boon it picked for a level it reached, without ending its turn', () => {
    const before = duel();
    const { state, events } = run(before, { type: 'take-boon', unitId: 'hero', level: 1, boonId: 'keen-eye' });
    expect(state.units.get('hero')!.boons).toEqual(['keen-eye']);
    expect(before.units.get('hero')!.boons).toEqual([]);
    expect(events).toEqual([]);
    expect(isDone(state.turnState!, 'hero')).toBe(false);
  });

  it('raises the stat a stat boon names', () => {
    const before = duel();
    const { state } = run(before, { type: 'take-boon', unitId: 'hero', level: 1, boonId: 'stat-health' });
    expect(state.units.get('hero')!.maxHealth).toBeGreaterThan(before.units.get('hero')!.maxHealth);
  });

  it('refuses a level not reached, an unknown boon or one the unit can’t take again', () => {
    const state = duel();
    const take = (level: number, boonId: string) => () =>
      applyCommand(state, { type: 'take-boon', unitId: 'hero', level, boonId });
    expect(take(2, 'keen-eye')).toThrow(/level 2/);
    expect(take(1, 'nope')).toThrow(/no boon/);
    // Fleet's max rank is 2: a third time is refused.
    const once = applyCommand(state, { type: 'take-boon', unitId: 'hero', level: 1, boonId: 'fleet' }).state;
    const twice = applyCommand(once, { type: 'take-boon', unitId: 'hero', level: 1, boonId: 'fleet' }).state;
    expect(() => applyCommand(twice, { type: 'take-boon', unitId: 'hero', level: 1, boonId: 'fleet' })).toThrow(
      /can't take/,
    );
  });
});

describe('an attack that shoves (shove-on-attack, the slime’s Bounce)', () => {
  // A bouncer next to a 20 HP foe on a 6x1 strip, `terrain` behind the foe.
  function bounceAt(terrain = 'grass', bouncerOptions = {}) {
    const bouncer = makeTestUnit({ team: 'player', strength: 1, ...bouncerOptions });
    bouncer.modifiers = [{ kind: 'shove-on-attack' }];
    const start = createTestBattle(
      {
        hero: { unit: bouncer, at: { x: 1, y: 0 } },
        foe: { unit: makeTestUnit({ team: 'enemy', strength: 0 }), at: { x: 2, y: 0 } },
        far: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 5, y: 0 } },
      },
      { width: 6 },
    );
    return { ...start, grid: setTerrain(start.grid, 3, 0, terrain) };
  }
  const attack = { type: 'attack', unitId: 'hero', target: { x: 2, y: 0 } } as const;

  it('pushes the foe a tile back once the exchange is over', () => {
    const { state, events } = run(bounceAt(), attack);
    expect(findUnit(state.grid, 'foe')).toEqual({ x: 3, y: 0 });
    const kinds = types(events);
    expect(kinds.lastIndexOf('strike')).toBeLessThan(kinds.indexOf('pushed'));
  });

  it('impales the foe on spikes', () => {
    const { state } = run(bounceAt(SPIKES), attack);
    const struck = 20 - state.units.get('foe')!.health;
    expect(struck).toBeGreaterThanOrEqual(HAZARDS[SPIKES].damage + 1);
  });

  it('drowns the foe in deep water, a kill for the attacker', () => {
    const { state } = run(bounceAt('water'), attack);
    expect(state.units.has('foe')).toBe(false);
    expect(state.kills.get('hero')).toBe(1);
  });

  it("doesn't shove when every strike misses", () => {
    const { state, events } = run(bounceAt('grass', { dexterity: -1000 }), attack);
    expect(findUnit(state.grid, 'foe')).toEqual({ x: 2, y: 0 });
    expect(types(events)).not.toContain('pushed');
  });

  it('only shoves on its own attack, not on a counter', () => {
    const start = bounceAt();
    const { state } = run(
      { ...start, turnState: { ...start.turnState!, team: 'enemy' } },
      { type: 'attack', unitId: 'foe', target: { x: 1, y: 0 } },
    );
    expect(findUnit(state.grid, 'hero')).toEqual({ x: 1, y: 0 });
    expect(findUnit(state.grid, 'foe')).toEqual({ x: 2, y: 0 });
  });
});
