import { describe, expect, it } from 'vitest';
import { applyCurses, getCurseBoss, getDeployedCurses, type Curse } from './curses.ts';
import { createBattleState } from './battle/state.ts';
import { applyCommand } from './battle/commands.ts';
import { makeTestUnit } from './battle/testLevel.ts';
import { createGrid, setUnit } from './grid.ts';
import { createSeededRng } from './rng.ts';

const foe = (health = 20) => makeTestUnit({ team: 'enemy', health, strength: 10 });

describe('getDeployedCurses', () => {
  it('gathers the curses of the deployed units only', () => {
    const cursed = makeTestUnit({ team: 'player' });
    cursed.curses = [{ kind: 'enemy-surge', percent: 15 }];
    const benched = makeTestUnit({ team: 'player' });
    benched.curses = [{ kind: 'enemy-affix', affixId: 'keen' }];
    const units = new Map([
      ['cursed', cursed],
      ['benched', benched],
    ]);
    expect(getDeployedCurses(units, ['cursed'])).toEqual([{ kind: 'enemy-surge', percent: 15 }]);
    expect(getDeployedCurses(units, [])).toEqual([]);
  });
});

describe('shared curses', () => {
  it('fall once for all the deployed units carrying them', () => {
    const shared: Curse = { kind: 'enemy-surge', percent: 15, shared: 'keystone-x' };
    const own: Curse = { kind: 'enemy-affix', affixId: 'keen' };
    const a = makeTestUnit({ team: 'player' });
    a.curses = [shared, own];
    const b = makeTestUnit({ team: 'player' });
    b.curses = [shared, own];
    const units = new Map([
      ['a', a],
      ['b', b],
    ]);
    expect(getDeployedCurses(units, ['a', 'b'])).toEqual([shared, own, own]);
  });
});

describe('the Lone Wolf at the start of a battle', () => {
  function battle(deployBoth: boolean) {
    const hero = makeTestUnit({ team: 'player', strength: 10, health: 20 });
    hero.modifiers = [{ kind: 'lone-wolf', percent: 50 }];
    let grid = createGrid(4, 1, 'grass');
    grid = setUnit(grid, 0, 0, 'hero');
    if (deployBoth) grid = setUnit(grid, 1, 0, 'mate');
    grid = setUnit(grid, 3, 0, 'foe');
    const state = createBattleState(
      {
        grid,
        units: new Map([
          ['hero', hero],
          ['mate', makeTestUnit({ team: 'player' })],
          ['foe', foe()],
        ]),
        roster: deployBoth ? ['hero', 'mate'] : ['hero'],
        deploymentZone: [],
        maxDeployed: 2,
      },
      1,
    );
    return applyCommand(state, { type: 'start-battle' }).state.units.get('hero')!;
  }

  it('emboldens a unit deployed alone for the battle, leaving its stats alone, and not one with company', () => {
    const alone = battle(false);
    expect(alone).toMatchObject({ strength: 10, maxHealth: 20 });
    expect(alone.modifiers).toEqual(
      expect.arrayContaining([
        { kind: 'combat', term: 'damage-percent', amount: 50 },
        { kind: 'combat', term: 'guard-percent', amount: 25 },
        { kind: 'combat', term: 'hit', amount: 20 },
        { kind: 'combat', term: 'avoid', amount: 20 },
      ]),
    );
    expect(battle(true).modifiers).toEqual([{ kind: 'lone-wolf', percent: 50 }]);
  });
});

describe('getCurseBoss', () => {
  it('is the boss, else the enemy with the most max HP', () => {
    const [small, big, boss] = [foe(10), foe(30), foe(5)];
    expect(getCurseBoss([small, big])).toBe(big);
    boss.rank = 'boss';
    expect(getCurseBoss([small, big, boss])).toBe(boss);
    expect(getCurseBoss([])).toBeNull();
  });
});

describe('applyCurses', () => {
  const rng = createSeededRng(1);

  it('does nothing without curses', () => {
    const unit = foe();
    applyCurses([unit], [], rng);
    expect(unit.strength).toBe(10);
    expect(unit.modifiers).toEqual([]);
  });

  it('adds surges together before growing every enemy', () => {
    const units = [foe(), foe()];
    const surge: Curse = { kind: 'enemy-surge', percent: 15 };
    applyCurses(units, [surge, surge], rng);
    for (const unit of units) {
      expect(unit.strength).toBe(13);
      expect(unit.maxHealth).toBe(26);
      expect(unit.health).toBe(26);
    }
  });

  it('gives every enemy an elite affix', () => {
    const units = [foe(), foe()];
    applyCurses(units, [{ kind: 'enemy-affix', affixId: 'keen' }], rng);
    for (const unit of units) {
      expect(unit.eliteAffixes).toEqual(['keen']);
      expect(unit.modifiers).toContainEqual({ kind: 'combat', term: 'crit', amount: 15 });
    }
    expect(() => applyCurses([foe()], [{ kind: 'enemy-affix', affixId: 'nope' }], rng)).toThrow(/nope/);
  });

  it('makes the strongest enemy that is not the boss an elite', () => {
    const [small, big, boss] = [foe(10), foe(30), foe(40)];
    boss.rank = 'boss';
    applyCurses([small, big, boss], [{ kind: 'elite-enemy', affixes: 2 }], rng);
    expect(big.rank).toBe('elite');
    expect(big.eliteAffixes).toHaveLength(2);
    expect(big.name).not.toMatch(/^Enemy /);
    expect(small.eliteAffixes).toEqual([]);
    expect(boss.eliteAffixes).toEqual([]);
  });

  it('gives the boss the modifiers of a mirror curse', () => {
    const [small, big] = [foe(10), foe(30)];
    applyCurses([small, big], [{ kind: 'boss-modifiers', modifiers: [{ kind: 'always-double' }] }], rng);
    expect(big.modifiers).toEqual([{ kind: 'always-double' }]);
    expect(small.modifiers).toEqual([]);
  });
});

describe('curses at the start of a battle', () => {
  function battle(heroCurses: readonly Curse[], deploy: boolean) {
    const hero = makeTestUnit({ team: 'player' });
    hero.curses = heroCurses;
    let grid = createGrid(4, 1, 'grass');
    if (deploy) grid = setUnit(grid, 0, 0, 'hero');
    grid = setUnit(grid, 3, 0, 'foe');
    const state = createBattleState(
      {
        grid,
        units: new Map([
          ['hero', hero],
          ['foe', foe()],
        ]),
        roster: ['hero'],
        deploymentZone: [],
        maxDeployed: 1,
      },
      1,
    );
    return applyCommand(state, { type: 'start-battle' }).state;
  }

  it('falls on the enemies when a cursed unit is deployed, and not otherwise', () => {
    const curses: Curse[] = [{ kind: 'enemy-affix', affixId: 'swift' }];
    expect(battle(curses, true).units.get('foe')!.eliteAffixes).toEqual(['swift']);
    expect(battle(curses, false).units.get('foe')!.eliteAffixes).toEqual([]);
    expect(battle([], true).units.get('foe')!.eliteAffixes).toEqual([]);
  });
});
