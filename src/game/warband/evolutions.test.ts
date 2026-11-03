import { describe, expect, it } from 'vitest';
import { Archer } from '../Archer.ts';
import { getStandingCombatBonus } from '../modifiers.ts';
import { getUnitSkills, VOLLEY } from '../skills.ts';
import type { Unit } from '../Unit.ts';
import { Villager } from '../Villager.ts';
import { findBoon } from './boons.ts';
import {
  completesEvolution,
  EVOLUTIONS,
  findEvolution,
  getEvolutions,
  getNewEvolutions,
  hasEvolution,
  RANK_EVOLUTION_RANK,
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
    for (const { id, boons, ranks, relics, classes } of EVOLUTIONS) {
      const parts = boons.length + Object.keys(ranks).length + relics.length + (classes.length > 0 ? 1 : 0);
      expect(parts, id).toBeGreaterThanOrEqual(2);
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

  it('needs one of its classes', () => {
    expect(hasEvolution({ classId: 'villager', boons: ['keen-eye', 'deadly'] }, [], volley)).toBe(false);
    expect(hasEvolution({ classId: 'siege', boons: ['keen-eye', 'deadly'] }, [], volley)).toBe(true);
  });

  it('needs every relic, and any class does when none is named', () => {
    expect(hasEvolution({ classId: 'soldier', boons: ['stalwart'] }, ['bulwark-crest'], juggernaut)).toBe(true);
    expect(hasEvolution({ classId: 'soldier', boons: ['stalwart'] }, [], juggernaut)).toBe(false);
  });
});

describe('rank evolutions', () => {
  const ranked = (id: string, rank: number) => Array.from({ length: rank }, () => id);

  it('needs the passive at rank III and the matching relic', () => {
    const berserk = findEvolution('berserk')!;
    expect(berserk.ranks).toEqual({ brawler: RANK_EVOLUTION_RANK });
    const unit = (rank: number) => ({ classId: 'soldier', boons: ranked('brawler', rank) });
    expect(hasEvolution(unit(RANK_EVOLUTION_RANK), ['duelists-gauntlet'], berserk)).toBe(true);
    expect(hasEvolution(unit(RANK_EVOLUTION_RANK - 1), ['duelists-gauntlet'], berserk)).toBe(false);
    expect(hasEvolution(unit(RANK_EVOLUTION_RANK), [], berserk)).toBe(false);
  });

  it('counts rarer and stage-scaled ranks of the passive', () => {
    const boons = ['regeneration', 'regeneration|rare|100', 'regeneration|epic|120', 'regeneration', 'regeneration'];
    expect(hasEvolution({ classId: 'acolyte', boons }, ['mending-charm'], findEvolution('troll-blood')!)).toBe(true);
  });

  it('flags the boon that takes the passive to rank III', () => {
    const unit = { classId: 'archer', boons: ranked('keen-eye', RANK_EVOLUTION_RANK - 1) };
    expect(completesEvolution(unit, ['hawk-lens'], { boon: 'keen-eye' })).toBe(true);
    expect(completesEvolution({ ...unit, boons: ['keen-eye'] }, ['hawk-lens'], { boon: 'keen-eye' })).toBe(false);
  });

  it('gives its procs', () => {
    expect(findEvolution('eagle-eye')!.modifiers).toEqual([
      { kind: 'sure-hit' },
      { kind: 'crit-multiplier', amount: 4 },
    ]);
    expect(findEvolution('vampire-lord')!.modifiers).toEqual([{ kind: 'lifesteal', percent: 50 }]);
    expect(findEvolution('troll-blood')!.modifiers).toEqual([{ kind: 'phase-heal-percent', percent: 25 }]);
  });

  it('blinks with Fleet at its top rank and the Winged Boots', () => {
    const blink = findEvolution('blink')!;
    expect(blink.modifiers).toEqual([{ kind: 'blink' }]);
    expect(hasEvolution({ classId: 'soldier', boons: ranked('fleet', 2) }, ['winged-boots'], blink)).toBe(true);
    expect(hasEvolution({ classId: 'soldier', boons: ['fleet'] }, ['winged-boots'], blink)).toBe(false);
  });
});

describe('getEvolutions', () => {
  it('lists every evolution a unit has, in order, with their modifiers', () => {
    const unit = { classId: 'archer', boons: ['keen-eye', 'deadly', 'stalwart'] };
    expect(getEvolutions(unit, ['bulwark-crest']).map(({ id }) => id)).toEqual(['volley', 'juggernaut']);
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
    const unit = { classId: 'villager', boons: ['brawler'] };
    expect(completesEvolution(unit, [], { classId: 'vanguard' })).toBe(true);
    expect(completesEvolution(unit, [], { classId: 'archer' })).toBe(false);
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
        ['ada', new Villager({ name: 'Ada', team: 'player' })],
      ]),
    );
    const roster = restoreRoster(run);
    const bryn = roster.get('bryn')!;
    expect(bryn.evolutions).toEqual(['volley']);
    expect(getUnitSkills(bryn)).toContainEqual(VOLLEY);
    expect(roster.get('ada')!.evolutions).toEqual([]);
  });

  it('loses an evolution with the relic it needs', () => {
    const soldier = new Villager({ name: 'Ada', team: 'player' });
    soldier.boons = ['stalwart'];
    const run = createRun(1, new Map<string, Unit>([['ada', soldier]]));
    const guard = (relics: string[]) =>
      getStandingCombatBonus(restoreRoster({ ...run, relics }).get('ada')!.modifiers).guard;
    expect(guard(['bulwark-crest'])).toBe(2);
    expect(guard([])).toBe(0);
  });
});

describe('build evolutions', () => {
  const ranked = (id: string, rank: number) => Array.from({ length: rank }, () => id);

  it('makes a Reaper of Chain Kill and Bloodlust II, no relic needed', () => {
    const reaper = findEvolution('reaper')!;
    expect(hasEvolution({ classId: 'vanguard', boons: ['chain-kill', ...ranked('bloodlust', 2)] }, [], reaper)).toBe(
      true,
    );
    expect(hasEvolution({ classId: 'vanguard', boons: ['chain-kill', 'bloodlust'] }, [], reaper)).toBe(false);
    expect(reaper.modifiers).toEqual([{ kind: 'encore' }]);
  });

  it('spreads and lengthens debuffs with Exploit and Opportunist', () => {
    const plague = findEvolution('plague')!;
    expect(hasEvolution({ classId: 'archer', boons: ['exploit', 'opportunist'] }, [], plague)).toBe(true);
    expect(plague.modifiers).toEqual([{ kind: 'contagion' }, { kind: 'linger-debuffs' }]);
  });

  it('gives Iron Maiden its taunt aura at Thorns III with Spite', () => {
    const maiden = findEvolution('iron-maiden')!;
    expect(hasEvolution({ classId: 'soldier', boons: ['spite', ...ranked('thorns', 3)] }, [], maiden)).toBe(true);
    expect(hasEvolution({ classId: 'soldier', boons: ['spite', ...ranked('thorns', 2)] }, [], maiden)).toBe(false);
    expect(maiden.modifiers).toEqual([{ kind: 'taunt-aura' }]);
  });
});
