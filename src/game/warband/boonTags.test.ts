import { describe, expect, it } from 'vitest';
import { createSeededRng } from '../rng.ts';
import { Soldier } from '../Soldier.ts';
import { CLASS_SKILL_PICKS } from '../skills.ts';
import { UNIT_CLASSES } from '../unitClasses.ts';
import { BOONS, encodeBoonEntry, rollBoons } from './boons.ts';
import {
  AFFINITY_PER_TAG,
  BOON_TAGS,
  CLASS_TAGS,
  getAffinityWeight,
  getBoonTags,
  getUnitTagCounts,
  MAX_AFFINITY_WEIGHT,
} from './boonTags.ts';

describe('boon tags', () => {
  it('tags every stat and passive boon and every class skill pick, with known tags', () => {
    const skillBoonIds = Object.values(CLASS_SKILL_PICKS)
      .flat()
      .map(({ id }) => `skill-${id}`);
    for (const boon of BOONS) {
      if (boon.id === 'quick-study') continue;
      if (boon.kind === 'skill' && !skillBoonIds.includes(boon.id)) continue; // retired skills
      expect(getBoonTags(boon.id).length, boon.id).toBeGreaterThan(0);
    }
    for (const boon of BOONS) for (const tag of boon.tags) expect(BOON_TAGS).toContain(tag);
  });

  it('gives every class a leaning', () => {
    for (const unitClass of UNIT_CLASSES) {
      if (unitClass.id in CLASS_SKILL_PICKS) expect(CLASS_TAGS[unitClass.id], unitClass.id).toBeDefined();
    }
  });

  it('reads the tags of a taken entry, and none for an unknown boon', () => {
    expect(getBoonTags(encodeBoonEntry({ id: 'bloodthirst', rarity: 'epic', stagePercent: 130 }))).toEqual([
      'kill',
      'blood',
    ]);
    expect(getBoonTags('nonsense')).toEqual([]);
  });
});

describe('getUnitTagCounts', () => {
  it("counts the class's leanings and each rank of taken passives and skills, not stat boons", () => {
    const counts = getUnitTagCounts('soldier', ['stalwart', 'stalwart|rare|120', 'stat-defense', 'bloodthirst']);
    expect(counts).toEqual({ guard: 3, kill: 1, blood: 1 });
  });

  it('counts nothing for a class without leanings and no boons', () => {
    expect(getUnitTagCounts(null)).toEqual({});
    expect(getUnitTagCounts('dragon', [])).toEqual({});
  });
});

describe('getAffinityWeight', () => {
  it('is 1 for a boon sharing no tags, and grows with each shared count', () => {
    expect(getAffinityWeight('nimble', { guard: 3 })).toBe(1);
    expect(getAffinityWeight('stalwart', { guard: 2 })).toBe(1 + 2 * AFFINITY_PER_TAG);
    expect(getAffinityWeight('bloodthirst', { kill: 1, blood: 1 })).toBe(1 + 2 * AFFINITY_PER_TAG);
  });

  it('never passes the cap', () => {
    expect(getAffinityWeight('stalwart', { guard: 50 })).toBe(MAX_AFFINITY_WEIGHT);
  });
});

describe('offers lean toward the build', () => {
  const guardShare = (boons: readonly string[]) => {
    let guard = 0;
    let total = 0;
    for (let seed = 0; seed < 400; seed++) {
      const unit = new Soldier({ name: 'Alden', team: 'player', level: 2 });
      unit.boons = Object.freeze([...boons]);
      const passive = rollBoons(unit, createSeededRng(seed)).find((boon) => boon.kind === 'passive');
      if (!passive) continue;
      total++;
      if (passive.tags.includes('guard')) guard++;
    }
    return guard / total;
  };

  it('offers Guard passives more often to a unit that has taken Guard passives', () => {
    expect(guardShare(['stalwart', 'thick-skin', 'stalwart'])).toBeGreaterThan(guardShare(['nimble']) + 0.1);
  });
});
