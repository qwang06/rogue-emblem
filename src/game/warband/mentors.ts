// Secondary skill sets, Final Fantasy Tactics style scaled down to one
// slot: a Warband unit can learn one other class's skill set on top of its
// own (`secondaryClass` on its snapshot), and knows that class's skills as
// it reaches their levels, as if they were its own (see getSecondarySkills
// in skills.ts). An Archer that learns the Acolyte's set can Mend; a Guard
// that learns the Vanguard's can Cleave.
//
// Lessons are taken at camp, in one of two ways:
// - from a mentor: a roster unit of that class that knows its skills
//   teaches it for MENTOR_FEE gold, so recruiting a class is also how the
//   warband learns it;
// - with a Mentor's Scroll (a reward, see rewards.ts), free and in any
//   class's set, mentor or not.
// Learning a set replaces the one the unit had. Everything here is pure:
// each function returns a new frozen run and leaves its input alone.

import { getBaseClassId } from '../promotions.ts';
import { getLearnedSkills, hasSkillTree, SKILL_TREES, type Skill, type SkillTrees } from '../skills.ts';
import { PLAYABLE_CLASSES, type UnitClass } from '../unitClasses.ts';
import type { RunState, UnitSnapshot } from './run.ts';

// What a mentor charges for a lesson.
export const MENTOR_FEE = 20;

// How a lesson would be paid for: a mentor's fee, or a scroll.
export type LessonSource = 'mentor' | 'scroll';

// A skill set a unit could learn: the class, the roster unit that could
// teach it (null when nobody can), how the lesson would be paid for right
// now (null when it can't be taken: no mentor and no scroll, or the fee
// can't be paid and there's no scroll, or the unit already has this set),
// and whether it's the unit's secondary already.
export interface Lesson {
  classId: string;
  mentorId: string | null;
  source: LessonSource | null;
  known: boolean;
}

// The rules lessons are checked against: the classes a unit can learn
// from and their skill trees.
export interface MentorRules {
  classes: readonly UnitClass[];
  trees: SkillTrees;
}

const DEFAULT_RULES: MentorRules = Object.freeze({ classes: PLAYABLE_CLASSES, trees: SKILL_TREES });

// How many Mentor's Scrolls the run holds.
export function getScrolls(run: Pick<RunState, 'scrolls'>): number {
  return run.scrolls ?? 0;
}

// The run holding `count` more Mentor's Scrolls.
export function addScrolls(run: RunState, count: number = 1): RunState {
  const scrolls = getScrolls(run) + Math.max(0, count);
  return scrolls === getScrolls(run) ? run : Object.freeze({ ...run, scrolls });
}

// The classes `unit` could take a secondary skill set from: every class
// with skills to teach but its own (a promoted unit's base class counts as
// its own, see promotions.ts), in class order.
export function getSecondaryClassIds(
  unit: Pick<UnitSnapshot, 'classId'>,
  rules: MentorRules = DEFAULT_RULES,
): string[] {
  return rules.classes
    .filter(({ id }) => id !== getBaseClassId(unit.classId) && hasSkillTree(id, rules.trees))
    .map(({ id }) => id);
}

// The roster unit that can teach `unitId` the `classId` skill set: the
// first one of that class or a promotion of it, other than the learner,
// that knows at least one of its skills. Null when there's none.
export function findMentor(
  run: RunState,
  unitId: string,
  classId: string,
  rules: MentorRules = DEFAULT_RULES,
): UnitSnapshot | null {
  return (
    run.roster.find(
      (other) =>
        other.id !== unitId &&
        getBaseClassId(other.classId) === classId &&
        getLearnedSkills(classId, other.level, rules.trees).length > 0,
    ) ?? null
  );
}

// The skill set lessons `unitId` could take, one per class it could learn
// (getSecondaryClassIds). A lesson with a mentor is paid with the fee
// while the warband can afford it, else with a scroll when it holds one.
// Empty for a unit not on the roster.
export function getLessons(run: RunState, unitId: string, rules: MentorRules = DEFAULT_RULES): Lesson[] {
  const unit = run.roster.find((snapshot) => snapshot.id === unitId);
  if (!unit) return [];
  return getSecondaryClassIds(unit, rules).map((classId) => {
    const mentor = findMentor(run, unitId, classId, rules);
    const known = unit.secondaryClass === classId;
    let source: LessonSource | null = null;
    if (!known && mentor && run.gold >= MENTOR_FEE) source = 'mentor';
    else if (!known && getScrolls(run) > 0) source = 'scroll';
    return Object.freeze({ classId, mentorId: mentor?.id ?? null, source, known });
  });
}

// The lesson in `classId`'s skill set for `unitId`, or null when it isn't
// one the unit could learn at all.
export function findLesson(
  run: RunState,
  unitId: string,
  classId: string,
  rules: MentorRules = DEFAULT_RULES,
): Lesson | null {
  return getLessons(run, unitId, rules).find((lesson) => lesson.classId === classId) ?? null;
}

// Whether `unitId` can learn `classId`'s skill set now (see getLessons).
export function canLearnSecondary(
  run: RunState,
  unitId: string,
  classId: string,
  rules: MentorRules = DEFAULT_RULES,
): boolean {
  return findLesson(run, unitId, classId, rules)?.source != null;
}

// The run after `unitId` learns `classId`'s skill set as its secondary,
// replacing any it had: MENTOR_FEE gold or a scroll spent, as getLessons
// says. Throws when it can't (see canLearnSecondary).
export function learnSecondary(
  run: RunState,
  unitId: string,
  classId: string,
  rules: MentorRules = DEFAULT_RULES,
): RunState {
  const source = findLesson(run, unitId, classId, rules)?.source;
  if (!source) throw new Error(`${unitId} can't learn the ${classId} skill set`);
  const roster = run.roster.map((unit) =>
    unit.id === unitId ? Object.freeze({ ...unit, secondaryClass: classId }) : unit,
  );
  const scrolls = getScrolls(run) - (source === 'scroll' ? 1 : 0);
  const { scrolls: _held, ...rest } = run;
  return Object.freeze({
    ...rest,
    gold: run.gold - (source === 'mentor' ? MENTOR_FEE : 0),
    roster: Object.freeze(roster),
    ...(scrolls > 0 && { scrolls }),
  });
}

// The skills `classId`'s set teaches, each with the level it comes at, for
// showing what a lesson gives.
export function getSkillSet(
  classId: string,
  trees: SkillTrees = SKILL_TREES,
): readonly { level: number; skill: Skill }[] {
  return trees[classId] ?? [];
}
