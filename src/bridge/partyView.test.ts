import { describe, expect, it } from 'vitest';
import { Unit } from '../game/Unit.ts';
import { toPartyView } from './partyView.ts';

function unit(name: string, team: 'player' | 'enemy', health = 10) {
  return new Unit({ name, health, strength: 4, defense: 2, movement: 5, team, unitClass: 'soldier' });
}

describe('toPartyView', () => {
  it('lists the deployed player units in order, marking who has acted', () => {
    const units = new Map([
      ['b', unit('Brin', 'player', 6)],
      ['a', unit('Ash', 'player')],
      ['e', unit('Goblin', 'enemy')],
    ]);
    const view = toPartyView({
      units,
      deployed: ['a', 'b'],
      fallen: new Map(),
      turnState: { turn: 1, team: 'player', moved: ['b'], done: ['b'] },
    });
    expect(view.map((entry) => [entry.id, entry.acted, entry.health])).toEqual([
      ['a', false, 10],
      ['b', true, 6],
    ]);
    expect(view[0]).toMatchObject({ name: 'Ash', classLabel: 'Soldier', level: 1, maxHealth: 10, fallen: false });
  });

  it('keeps the fallen at the end at 0 HP and never marks them acted', () => {
    const view = toPartyView({
      units: new Map([['a', unit('Ash', 'player')]]),
      deployed: ['b', 'a'],
      fallen: new Map([['b', unit('Brin', 'player', 7)]]),
      turnState: { turn: 2, team: 'player', moved: [], done: ['b'] },
    });
    expect(view.map((entry) => [entry.id, entry.fallen, entry.health, entry.acted])).toEqual([
      ['a', false, 10, false],
      ['b', true, 0, false],
    ]);
  });

  it('falls back to every player unit on the map before deployment is over', () => {
    const view = toPartyView({
      units: new Map([
        ['e', unit('Goblin', 'enemy')],
        ['a', unit('Ash', 'player')],
      ]),
      deployed: [],
      fallen: new Map(),
      turnState: null,
    });
    expect(view.map((entry) => entry.id)).toEqual(['a']);
  });

  it("does not mark anyone acted during the enemy's phase", () => {
    const view = toPartyView({
      units: new Map([['a', unit('Ash', 'player')]]),
      deployed: ['a'],
      fallen: new Map(),
      turnState: { turn: 1, team: 'enemy', moved: ['a'], done: ['a'] },
    });
    expect(view[0]?.acted).toBe(false);
  });
});

describe('toPartyView for the enemy', () => {
  it('lists every enemy on the map in map order, then the fallen', () => {
    const view = toPartyView(
      {
        units: new Map([
          ['e2', unit('Goblin', 'enemy', 4)],
          ['a', unit('Ash', 'player')],
          ['e1', unit('Slime', 'enemy')],
        ]),
        deployed: ['a'],
        fallen: new Map([['e3', unit('Bandit', 'enemy')]]),
        turnState: { turn: 1, team: 'player', moved: [], done: [] },
      },
      'enemy',
    );
    expect(view.map((entry) => [entry.id, entry.health, entry.fallen])).toEqual([
      ['e2', 4, false],
      ['e1', 10, false],
      ['e3', 0, true],
    ]);
  });
});
