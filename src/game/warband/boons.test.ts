import { describe, expect, it } from 'vitest';
import { Acolyte } from '../Acolyte.ts';
import { createSeededRng } from '../rng.ts';
import { POWER_STRIKE } from '../skills.ts';
import { Soldier } from '../Soldier.ts';
import { applyModifiers } from '../modifiers.ts';
import {
  BOON_CHOICES,
  BOONS,
  encodeBoonEntry,
  findBoon,
  findTakenBoon,
  getBoonIds,
  getBoonModifiers,
  getBoonRank,
  getRarityOdds,
  getStageScalePercent,
  getStatBoonGain,
  getTakenBoonList,
  HEALTH_BOON_AMOUNT,
  isBoonEligible,
  MAX_BOON_RANK,
  parseBoonEntry,
  rollBoonRarity,
  rollBoons,
  STAT_BOON_AMOUNT,
  takeBoon,
} from './boons.ts';

const soldier = (level = 2) => new Soldier({ name: 'Alden', team: 'player', level });
const boon = (id: string) => findBoon(id)!;

describe('BOONS', () => {
  it('has unique ids and every kind', () => {
    expect(new Set(BOONS.map((b) => b.id)).size).toBe(BOONS.length);
    expect(new Set(BOONS.map((b) => b.kind))).toEqual(new Set(['stat', 'skill', 'passive']));
  });
});

describe('getBoonModifiers', () => {
  it("is the boons' modifiers in order, skipping stat boons and unknown ids", () => {
    expect(getBoonModifiers(['stat-strength', 'fleet', 'nope', 'keen-eye'])).toEqual([
      ...boon('fleet').modifiers,
      ...boon('keen-eye').modifiers,
    ]);
  });
});

describe('isBoonEligible', () => {
  it('offers stat boons however high the stat is (no caps)', () => {
    const unit = soldier();
    unit.speed = 99;
    expect(isBoonEligible(unit, boon('stat-speed'))).toBe(true);
  });

  it('offers STR to physical fighters and INT to casters', () => {
    expect(isBoonEligible(soldier(), boon('stat-strength'))).toBe(true);
    expect(isBoonEligible(soldier(), boon('stat-intelligence'))).toBe(false);
    const acolyte = new Acolyte({ team: 'player' });
    expect(isBoonEligible(acolyte, boon('stat-intelligence'))).toBe(true);
  });

  it("offers skills the unit doesn't know and passives below their max rank", () => {
    expect(isBoonEligible(soldier(), boon('skill-lunge'))).toBe(true);
    const lunged = soldier();
    applyModifiers(lunged, boon('skill-lunge').modifiers);
    expect(isBoonEligible(lunged, boon('skill-lunge'))).toBe(false);
    const unit = soldier();
    takeBoon(unit, boon('fleet'));
    expect(isBoonEligible(unit, boon('fleet'))).toBe(true);
    takeBoon(unit, boon('fleet'));
    expect(isBoonEligible(unit, boon('fleet'))).toBe(false);
    for (let rank = 0; rank < MAX_BOON_RANK; rank++) takeBoon(unit, boon('nimble'));
    expect(isBoonEligible(unit, boon('nimble'))).toBe(false);
    expect(isBoonEligible(unit, boon('deadly'))).toBe(true);
  });

  it("offers only the unit's own class's skill picks", () => {
    expect(isBoonEligible(soldier(), boon('skill-smite'))).toBe(false);
    expect(isBoonEligible(soldier(), boon('skill-deadeye'))).toBe(false);
    const acolyte = new Acolyte({ team: 'player' });
    expect(isBoonEligible(acolyte, boon('skill-smite'))).toBe(true);
    expect(isBoonEligible(acolyte, boon('skill-lunge'))).toBe(false);
  });

  it('never offers a retired skill, though a unit saved with one keeps it', () => {
    for (const id of ['skill-power-strike', 'skill-cleave', 'skill-throw-stones']) {
      expect(isBoonEligible(soldier(), boon(id)), id).toBe(false);
    }
    expect(getBoonModifiers(['skill-power-strike'])).toEqual([{ kind: 'skill', skill: POWER_STRIKE }]);
  });
});

describe('rollBoons', () => {
  it('offers a stat boon, a skill and a passive, all eligible and different', () => {
    for (let seed = 0; seed < 30; seed++) {
      const offers = rollBoons(soldier(), createSeededRng(seed));
      expect(offers).toHaveLength(BOON_CHOICES);
      expect(offers.map((b) => b.kind)).toEqual(['stat', 'skill', 'passive']);
      expect(new Set(offers).size).toBe(BOON_CHOICES);
      for (const offer of offers) expect(isBoonEligible(soldier(), offer)).toBe(true);
    }
  });

  it('offers a second passive when there is no skill left to learn', () => {
    const unit = soldier();
    for (const id of ['skill-lunge', 'skill-phalanx', 'skill-taunt']) applyModifiers(unit, boon(id).modifiers);
    const offers = rollBoons(unit, createSeededRng(3));
    expect(offers.map((b) => b.kind)).toEqual(['stat', 'passive', 'passive']);
  });

  it('is the same for the same rolls', () => {
    expect(rollBoons(soldier(), createSeededRng(9))).toEqual(rollBoons(soldier(), createSeededRng(9)));
  });

  it('falls back on stat boons, which never run out, once every passive and skill is taken', () => {
    const unit = soldier();
    for (const passive of BOONS.filter((b) => b.kind === 'passive')) {
      while (isBoonEligible(unit, passive)) takeBoon(unit, passive);
    }
    for (const stat of ['maxHealth', 'strength', 'dexterity', 'speed', 'luck', 'defense', 'resistance'] as const) {
      unit[stat] = 99;
    }
    for (const id of ['skill-lunge', 'skill-phalanx', 'skill-taunt']) applyModifiers(unit, boon(id).modifiers);
    const offers = rollBoons(unit, createSeededRng(1));
    expect(offers).toHaveLength(3);
    expect(offers.every((offer) => offer.kind === 'stat')).toBe(true);
  });
});

describe('takeBoon', () => {
  it('raises the stat by its full amount every time, and records the boon', () => {
    const unit = soldier();
    const strength = unit.strength;
    takeBoon(unit, boon('stat-strength'));
    expect(unit.strength).toBe(strength + STAT_BOON_AMOUNT);
    unit.strength = 99;
    expect(getStatBoonGain(boon('stat-strength'))).toBe(STAT_BOON_AMOUNT);
    takeBoon(unit, boon('stat-strength'));
    expect(unit.strength).toBe(99 + STAT_BOON_AMOUNT);
    expect(unit.boons).toEqual(['stat-strength', 'stat-strength']);
  });

  it('raises max HP and current HP together', () => {
    const unit = soldier();
    unit.health = 3;
    const maxHealth = unit.maxHealth;
    takeBoon(unit, boon('stat-health'));
    expect(unit.maxHealth).toBe(maxHealth + HEALTH_BOON_AMOUNT);
    expect(unit.health).toBe(3 + HEALTH_BOON_AMOUNT);
  });

  it('records a skill or passive without changing stats', () => {
    const unit = soldier();
    const before = { ...unit };
    takeBoon(unit, boon('skill-lunge'));
    expect(unit.boons).toEqual(['skill-lunge']);
    expect(unit.strength).toBe(before.strength);
    expect(boon('skill-power-strike').modifiers).toEqual([{ kind: 'skill', skill: POWER_STRIKE }]);
  });
});

describe('boon entries', () => {
  it('keeps a common boon at the base scale as its bare id, and anything else with its rarity and scale', () => {
    expect(encodeBoonEntry({ id: 'brawler', rarity: 'common', stagePercent: 100 })).toBe('brawler');
    expect(encodeBoonEntry({ id: 'brawler', rarity: 'epic', stagePercent: 142 })).toBe('brawler|epic|142');
    expect(parseBoonEntry('brawler|epic|142')).toEqual({ id: 'brawler', rarity: 'epic', stagePercent: 142 });
    expect(parseBoonEntry('brawler')).toEqual({ id: 'brawler', rarity: 'common', stagePercent: 100 });
  });

  it('reads anything unreadable after the id as common at the base scale', () => {
    expect(parseBoonEntry('brawler|shiny|abc')).toEqual({ id: 'brawler', rarity: 'common', stagePercent: 100 });
    expect(parseBoonEntry('brawler|rare|50')).toEqual({ id: 'brawler', rarity: 'rare', stagePercent: 100 });
  });

  it('counts ranks and ids across entries', () => {
    const entries = ['brawler', 'brawler|rare|100', 'nimble'];
    expect(getBoonIds(entries)).toEqual(['brawler', 'brawler', 'nimble']);
    expect(getBoonRank(entries, 'brawler')).toBe(2);
    expect(getBoonRank(entries, 'deadly')).toBe(0);
  });
});

describe('getStageScalePercent', () => {
  it('is 100 up to stage 4, then grows 6% a stage', () => {
    expect([1, 4, 5, 10, 30].map(getStageScalePercent)).toEqual([100, 100, 106, 142, 455]);
  });
});

describe('findTakenBoon', () => {
  it('scales flat damage and stats by rarity and stage, rates by rarity only, and MOV not at all', () => {
    expect(findTakenBoon('brawler|epic|200')!.modifiers).toEqual([
      { kind: 'combat', term: 'damage', amount: 15, when: 'attacking' },
    ]);
    expect(findTakenBoon('keen-eye|rare|300')!.modifiers).toEqual([{ kind: 'combat', term: 'hit', amount: 23 }]);
    expect(findTakenBoon('fleet|legendary|455')!.modifiers).toEqual([{ kind: 'movement', amount: 1 }]);
    expect(findTakenBoon('twin-strike|epic|300')!.modifiers).toEqual([{ kind: 'twin-strike', percent: 25 }]);
    expect(findTakenBoon('finisher|rare|300')!.modifiers).toEqual([{ kind: 'finisher', percent: 6 }]);
    expect(findTakenBoon('stat-strength|rare|142')!.stat).toEqual({ stat: 'strength', amount: 4 });
  });

  it('describes the scaled numbers and names the rank', () => {
    const brawler = findTakenBoon('brawler|legendary|100', 3)!;
    expect(brawler.name).toBe('Brawler III');
    expect(brawler.description).toBe('+12 damage when it attacks.');
    expect(brawler.entry).toBe('brawler|legendary|100');
  });

  it('never scales a skill', () => {
    expect(findTakenBoon('skill-cleave|legendary|455')).toMatchObject({ rarity: 'common', stagePercent: 100 });
  });

  it('is null for an unknown boon', () => {
    expect(findTakenBoon('nope')).toBeNull();
  });
});

describe('ranks', () => {
  it('stacks every rank of a passive, each at its own rarity', () => {
    const entries = ['brawler', 'brawler|rare|100'];
    expect(getBoonModifiers(entries).map((modifier) => ('amount' in modifier ? modifier.amount : 0))).toEqual([3, 5]);
    expect(getTakenBoonList(entries).map((taken) => taken.name)).toEqual(['Brawler', 'Brawler II']);
  });

  it('offers the next rank of a passive with its rank in the name', () => {
    const unit = soldier();
    takeBoon(unit, boon('brawler'));
    const offers = Array.from({ length: 30 }, (_, seed) => rollBoons(unit, createSeededRng(seed))).flat();
    const brawler = offers.find((offer) => offer.id === 'brawler');
    expect(brawler).toMatchObject({ rank: 2, name: expect.stringMatching(/^Brawler II$/) });
  });

  it('caps a passive at MAX_BOON_RANK', () => {
    expect(MAX_BOON_RANK).toBe(5);
  });
});

describe('rarity', () => {
  it('starts mostly common and ends far rarer by stage 30', () => {
    expect(getRarityOdds(1)).toEqual({ common: 80, rare: 17, epic: 3, legendary: 0 });
    const late = getRarityOdds(30);
    expect(late.common).toBeCloseTo(35);
    expect(late.legendary).toBeCloseTo(8);
  });

  it('moves odds off common with luck, always summing to 100', () => {
    const odds = getRarityOdds(10, 20);
    expect(odds.common).toBeLessThan(getRarityOdds(10).common);
    expect(Object.values(odds).reduce((sum, value) => sum + value, 0)).toBeCloseTo(100);
  });

  it('rolls by the odds', () => {
    expect(rollBoonRarity(() => 0, 1)).toBe('common');
    expect(rollBoonRarity(() => 0.81, 1)).toBe('rare');
    expect(rollBoonRarity(() => 0.99, 1)).toBe('epic');
  });

  it('grows the offers with the stage they are rolled at', () => {
    const offers = rollBoons(soldier(), createSeededRng(3), 10);
    expect(offers.filter((offer) => offer.kind !== 'skill').every((offer) => offer.stagePercent === 142)).toBe(true);
  });
});
