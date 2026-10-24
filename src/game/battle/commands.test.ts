import { describe, expect, it } from 'vitest';
import { createBattleLevel, FIRST_STORY_CHAPTER } from '../battleSetup.ts';
import { findUnit } from '../grid.ts';
import { HEAL_STAFF, staffEntry } from '../healing.ts';
import { HEALTH_POTION } from '../items.ts';
import { TURN_LIMIT } from '../objectives.ts';
import { IRON_SPEAR, weaponEntry, FISTS } from '../weapons.ts';
import { applyCommand, BattleCommandError, type BattleCommand, type BattleEvent } from './commands.ts';
import { createBattleState, getDeployedUnits, type BattleState } from './state.ts';
import { createTestBattle, makeTestUnit } from './testLevel.ts';
import type { Modifier } from '../modifiers.ts';
import { POWER_STRIKE } from '../skills.ts';

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
  it('plays out the exchange, wearing weapons and dealing damage both ways', () => {
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
    expect(state.units.get('foe')!.weaponUses).toBe(IRON_SPEAR.uses! - 1);
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

  it('refuses a target out of reach or not hostile', () => {
    expect(() => applyCommand(duel(), { type: 'attack', unitId: 'hero', target: { x: 4, y: 0 } })).toThrow(/no foe/);
  });

  it('rolls the same with the same seed, and moves the seed on', () => {
    const misses = { skill: 0, luck: 0 };
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
    const hero = makeTestUnit({ team: 'player', unitClass: 'warrior', level: 2, mana: 4 });
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

  it('spares the weapon on a killing blow with spare-weapon-on-kill', () => {
    const uses = (state: BattleState) => state.units.get('hero')!.weaponUses;
    const before = uses(finisher([]));
    expect(uses(run(finisher([]), strike).state)).toBe(before! - 1);
    expect(uses(run(finisher([{ kind: 'spare-weapon-on-kill' }]), strike).state)).toBe(before);
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

describe('heal and items', () => {
  it('heals a wounded ally with a staff', () => {
    const ally = makeTestUnit({ team: 'player' });
    ally.takeDamage(10);
    const start = createTestBattle({
      healer: { unit: makeTestUnit({ team: 'player', magic: 3, items: [staffEntry(HEAL_STAFF)] }), at: { x: 0, y: 0 } },
      ally: { unit: ally, at: { x: 1, y: 0 } },
      foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 7, y: 0 } },
    });
    const { state, events } = run(start, { type: 'heal', unitId: 'healer', staffIndex: 0, target: { x: 1, y: 0 } });
    expect(events[0]).toEqual({ type: 'healed', unitId: 'healer', targetId: 'ally', amount: 5 });
    expect(state.units.get('ally')!.health).toBe(15);
    expect(state.units.get('healer')!.items[0].quantity).toBe(HEAL_STAFF.uses - 1);
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
