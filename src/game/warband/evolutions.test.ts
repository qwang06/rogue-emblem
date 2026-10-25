import { describe, expect, it } from 'vitest';
import { Archer } from '../Archer.ts';
import { getStandingCombatBonus } from '../modifiers.ts';
import { getUnitSkills, VOLLEY } from '../skills.ts';
import type { Unit } from '../Unit.ts';
import { Warrior } from '../Warrior.ts';
import { findBoon } from './boons.ts';
import {
  completesEvolution,
  EVOLUTIONS,
  findEvolution,
  getEvolutionModifiers,
  getEvolutions,
  getNewEvolutions,
  hasEvolution,
} from './evolutions.ts';
import { findRelic } from './relics.ts';
import { createRun, restoreRoster } from './run.ts';
import { UNIT_CLASSES } from '../unitClasses.ts';

const volley = findEvolution('volley')!;
const juggernaut = findEvolution('juggernaut')!;

describe('EVOLUTIONS', () => {
  it('names only boons, relics and classes that exist', () => {
    for (const evolution of EVOLUTIONS) {
      for (const id of evolution.boons) expect(findBoon(id), `${evolution.id} boon ${id}`).not.toBeNull();
      for (const id of evolution.relics) expect(findRelic(id), `${evolution.id} relic ${id}`).not.toBeNull();
      for (const id of evolution.classes) {
        expect(
          UNIT_CLASSES.some((c) => c.id === id),
          `${evolution.id} class ${id}`,
        ).toBe(true);
      }
    }
  });

  it('needs at least two parts for each, so none comes from a single pick', () => {
    for (const { id, boons, relics, classes } of EVOLUTIONS) {
      expect(boons.length + relics.length + (classes.length > 0 ? 1 : 0), id).toBeGreaterThanOrEqual(2);
    }
  });

  it('has unique ids and is frozen', () => {
    expect(new Set(EVOLUTIONS.map(({ id }) => id)).size).toBe(EVOLUTIONS.length);
    expect(Object.isFrozen(EVOLUTIONS)).toBe(true);
    expect(EVOLUTIONS.every(Object.isFrozen)).toBe(true);
  });
});

describe('hasEvolution', () => {
  it('needs every boon', () => {
    expect(hasEvolution({ classId: 'archer', boons: ['keen-eye', 'deadly'] }, [], volley)).toBe(true);
    expect(hasEvolution({ classId: 'archer', boons: ['keen-eye'] }, [], volley)).toBe(false);
    expect(hasEvolution({ classId: 'archer' }, [], volley)).toBe(false);
  });

  it('needs the class, a promoted one counting', () => {
    expect(hasEvolution({ classId: 'warrior', boons: ['keen-eye', 'deadly'] }, [], volley)).toBe(false);
    expect(hasEvolution({ classId: 'sniper', boons: ['keen-eye', 'deadly'] }, [], volley)).toBe(true);
  });

  it('needs every relic, and any class does when none is named', () => {
    expect(hasEvolution({ classId: 'soldier', boons: ['stalwart'] }, ['bulwark-crest'], juggernaut)).toBe(true);
    expect(hasEvolution({ classId: 'soldier', boons: ['stalwart'] }, [], juggernaut)).toBe(false);
  });
});

describe('getEvolutions and getEvolutionModifiers', () => {
  it('lists every evolution a unit has, in order, with their modifiers', () => {
    const unit = { classId: 'archer', boons: ['keen-eye', 'deadly', 'stalwart'] };
    expect(getEvolutions(unit, ['bulwark-crest']).map(({ id }) => id)).toEqual(['volley', 'juggernaut']);
    expect(getEvolutionModifiers(unit, ['bulwark-crest'])).toEqual([...volley.modifiers, ...juggernaut.modifiers]);
    expect(getEvolutions({ classId: 'archer' }, [])).toEqual([]);
  });
});

describe('getNewEvolutions', () => {
  it('lists what a change unlocked, and nothing already had', () => {
    const before = { classId: 'archer', boons: ['keen-eye'] };
    const after = { classId: 'archer', boons: ['keen-eye', 'deadly'] };
    expect(getNewEvolutions(before, after, []).map(({ id }) => id)).toEqual(['volley']);
    expect(getNewEvolutions(after, after, [])).toEqual([]);
  });

  it('counts a new relic', () => {
    const unit = { classId: 'soldier', boons: ['stalwart'] };
    expect(getNewEvolutions(unit, unit, [], ['bulwark-crest']).map(({ id }) => id)).toEqual(['juggernaut']);
  });
});

describe('completesEvolution', () => {
  it('flags a boon that finishes a recipe', () => {
    const unit = { classId: 'archer', boons: ['keen-eye'] };
    expect(completesEvolution(unit, [], { boon: 'deadly' })).toBe(true);
    expect(completesEvolution(unit, [], { boon: 'nimble' })).toBe(false);
  });

  it('flags a promotion that finishes a recipe', () => {
    const unit = { classId: 'warrior', boons: ['brawler'] };
    expect(completesEvolution(unit, [], { classId: 'berserker' })).toBe(true);
    expect(completesEvolution(unit, [], { classId: 'hero' })).toBe(false);
  });

  it('doesn’t flag an evolution the unit already has', () => {
    const unit = { classId: 'archer', boons: ['keen-eye', 'deadly'] };
    expect(completesEvolution(unit, [], { boon: 'deadly' })).toBe(false);
  });
});

describe('in a run', () => {
  it('gives a fielded unit its evolutions’ modifiers and ids, and others none', () => {
    const archer = new Archer({ name: 'Bryn', team: 'player' });
    archer.boons = ['keen-eye', 'deadly'];
    const run = createRun(
      1,
      new Map<string, Unit>([
        ['bryn', archer],
        ['ada', new Warrior({ name: 'Ada', team: 'player' })],
      ]),
    );
    const roster = restoreRoster(run);
    const bryn = roster.get('bryn')!;
    expect(bryn.evolutions).toEqual(['volley']);
    expect(getUnitSkills(bryn)).toContainEqual(VOLLEY);
    expect(roster.get('ada')!.evolutions).toEqual([]);
  });

  it('loses an evolution with the relic it needs', () => {
    const soldier = new Warrior({ name: 'Ada', team: 'player' });
    soldier.boons = ['stalwart'];
    const run = createRun(1, new Map<string, Unit>([['ada', soldier]]));
    const guard = (relics: string[]) =>
      getStandingCombatBonus(restoreRoster({ ...run, relics }).get('ada')!.modifiers).guard;
    expect(guard(['bulwark-crest'])).toBe(2);
    expect(guard([])).toBe(0);
  });
});
