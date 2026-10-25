import { describe, expect, it } from 'vitest';
import { Acolyte } from '../Acolyte.ts';
import { Archer } from '../Archer.ts';
import { Vanguard } from '../Vanguard.ts';
import { CLEAVE, MEND, THROW_STONES, getUnitSkills } from '../skills.ts';
import type { Unit } from '../Unit.ts';
import {
  addScrolls,
  canLearnSecondary,
  findMentor,
  getLessons,
  getScrolls,
  getSecondaryClassIds,
  getSkillSet,
  learnSecondary,
  MENTOR_FEE,
} from './mentors.ts';
import { createRun, parseRun, restoreUnit, serializeRun, type RunState } from './run.ts';

// Wren the archer, Iris the acolyte and Bram the vanguard, at `levels`.
function campRun({ gold = 50, levels = [2, 2, 1] } = {}): RunState {
  const run = createRun(
    7,
    new Map<string, Unit>([
      ['wren', new Archer({ name: 'Wren', team: 'player', level: levels[0] })],
      ['iris', new Acolyte({ name: 'Iris', team: 'player', level: levels[1] })],
      ['bram', new Vanguard({ name: 'Bram', team: 'player', level: levels[2] })],
    ]),
  );
  return { ...run, gold };
}

const unit = (run: RunState, id: string) => run.roster.find((snapshot) => snapshot.id === id)!;

describe('getSecondaryClassIds', () => {
  it('is every playable class with skills but its own, in class order', () => {
    expect(getSecondaryClassIds({ classId: 'archer' })).toEqual(['warrior', 'soldier', 'vanguard', 'guard', 'acolyte']);
    expect(getSecondaryClassIds({ classId: 'acolyte' })).not.toContain('acolyte');
  });

  it('leaves out classes with no skills to teach', () => {
    const rules = { classes: [{ id: 'mage', label: 'Mage', create: () => null as never }], trees: { mage: [] } };
    expect(getSecondaryClassIds({ classId: 'archer' }, rules)).toEqual([]);
  });
});

describe('findMentor', () => {
  it('is a roster unit of the class that knows its skills', () => {
    expect(findMentor(campRun(), 'wren', 'acolyte')?.id).toBe('iris');
  });

  it("is nobody below the set's first level, for the learner itself, or for a class nobody has", () => {
    expect(findMentor(campRun(), 'wren', 'vanguard')).toBeNull();
    expect(findMentor(campRun(), 'wren', 'guard')).toBeNull();
    expect(findMentor(campRun(), 'wren', 'archer')).toBeNull();
    expect(findMentor(campRun(), 'wren', 'soldier')).toBeNull();
  });
});

describe('getLessons', () => {
  it('pays a mentor with the fee and leaves the rest closed without a scroll', () => {
    const lessons = getLessons(campRun(), 'wren');
    expect(lessons.map(({ classId }) => classId)).toEqual(getSecondaryClassIds({ classId: 'archer' }));
    expect(lessons.find(({ classId }) => classId === 'acolyte')).toEqual({
      classId: 'acolyte',
      mentorId: 'iris',
      source: 'mentor',
      known: false,
    });
    expect(lessons.filter(({ source }) => source !== null)).toHaveLength(1);
  });

  it('falls back to a scroll when there is no mentor or the fee is out of reach', () => {
    const scrolled = addScrolls(campRun({ gold: MENTOR_FEE - 1 }));
    for (const lesson of getLessons(scrolled, 'wren')) expect(lesson.source).toBe('scroll');
  });

  it("closes the unit's own secondary and a set with nothing to pay for it", () => {
    const run = learnSecondary(campRun(), 'wren', 'acolyte');
    const known = getLessons(addScrolls(run), 'wren').find(({ classId }) => classId === 'acolyte')!;
    expect(known).toMatchObject({ known: true, source: null });
    expect(canLearnSecondary(campRun({ gold: 0 }), 'wren', 'acolyte')).toBe(false);
  });

  it('is empty for a unit not on the roster', () => {
    expect(getLessons(campRun(), 'nobody')).toEqual([]);
  });
});

describe('learnSecondary', () => {
  it("sets the unit's secondary class and spends the mentor's fee", () => {
    const before = campRun();
    const run = learnSecondary(before, 'wren', 'acolyte');
    expect(unit(run, 'wren').secondaryClass).toBe('acolyte');
    expect(run.gold).toBe(before.gold - MENTOR_FEE);
    expect(unit(before, 'wren')).not.toHaveProperty('secondaryClass');
    expect(Object.isFrozen(run)).toBe(true);
    expect(Object.isFrozen(run.roster)).toBe(true);
  });

  it('spends a scroll instead where there is no mentor, keeping the gold', () => {
    const before = addScrolls(campRun(), 2);
    const run = learnSecondary(before, 'iris', 'vanguard');
    expect(unit(run, 'iris').secondaryClass).toBe('vanguard');
    expect(run.gold).toBe(before.gold);
    expect(getScrolls(run)).toBe(1);
    expect(learnSecondary(run, 'bram', 'warrior')).not.toHaveProperty('scrolls');
  });

  it('replaces the set the unit had', () => {
    const run = learnSecondary(addScrolls(learnSecondary(campRun(), 'wren', 'acolyte')), 'wren', 'guard');
    expect(unit(run, 'wren').secondaryClass).toBe('guard');
  });

  it('throws when the lesson cannot be taken', () => {
    expect(() => learnSecondary(campRun(), 'wren', 'guard')).toThrow(/guard/);
    expect(() => learnSecondary(campRun(), 'wren', 'archer')).toThrow();
    expect(() => learnSecondary(campRun(), 'nobody', 'acolyte')).toThrow();
  });

  it('teaches the skills in battle once restored, and keeps them through a save', () => {
    const run = learnSecondary(campRun(), 'wren', 'acolyte');
    const saved = parseRun(serializeRun(run))!;
    expect(unit(saved, 'wren').secondaryClass).toBe('acolyte');
    const wren = restoreUnit(unit(saved, 'wren'));
    expect(wren.secondaryClass).toBe('acolyte');
    expect(getUnitSkills(wren).map(({ id }) => id)).toEqual(['long-shot', MEND.id]);
  });

  it("waits for the unit's level like its own skills do", () => {
    const run = learnSecondary(addScrolls(campRun({ levels: [2, 2, 1] })), 'bram', 'warrior');
    expect(getUnitSkills(restoreUnit(unit(run, 'bram')))).toEqual([]);
    const levelled = { ...unit(run, 'bram'), level: 2 };
    expect(getUnitSkills(restoreUnit(levelled))).toEqual([CLEAVE, THROW_STONES]);
  });
});

describe('scrolls', () => {
  it('counts and adds them, ignoring a negative count', () => {
    const run = campRun();
    expect(getScrolls(run)).toBe(0);
    expect(getScrolls(addScrolls(run))).toBe(1);
    expect(getScrolls(addScrolls(run, 3))).toBe(3);
    expect(addScrolls(run, -2)).toBe(run);
  });

  it('saves and loads them, refusing a broken count', () => {
    const run = addScrolls(campRun(), 2);
    expect(parseRun(serializeRun(run))?.scrolls).toBe(2);
    expect(parseRun(JSON.stringify({ ...run, scrolls: -1 }))).toBeNull();
    expect(parseRun(JSON.stringify({ ...run, scrolls: 0 }))).not.toHaveProperty('scrolls');
  });

  it('refuses a save whose secondary class does not exist', () => {
    const run = campRun();
    const broken = { ...run, roster: [{ ...run.roster[0], secondaryClass: 'dragon' }, ...run.roster.slice(1)] };
    expect(parseRun(JSON.stringify(broken))).toBeNull();
  });
});

describe('getSkillSet', () => {
  it("is the class's tree, empty for one without", () => {
    expect(getSkillSet('acolyte')).toEqual([{ level: 2, skill: MEND }]);
    expect(getSkillSet('slime')).toEqual([]);
  });
});
