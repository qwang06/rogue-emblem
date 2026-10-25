// Snapshot of the camp's mentor screen (src/game/warband/mentorScreen.ts)
// for React: the warband's gold and scrolls, its units with the skill set
// each has learned, the picked unit's lessons with how each would be paid
// for, the cursor and what the highlighted entry does. Plain frozen data,
// built fresh from the screen's state.

import { describeSkill } from '../game/skills.ts';
import { getUnitSprite } from '../game/tileset.ts';
import { UNIT_CLASSES } from '../game/unitClasses.ts';
import { getScrolls, getSkillSet, MENTOR_FEE, type Lesson } from '../game/warband/mentors.ts';
import { getPickedLessons, type MentorColumn, type MentorScreenState } from '../game/warband/mentorScreen.ts';

// A unit row: its name, class, level and the label of the class whose
// skill set it has learned (null for none).
export interface MentorUnitView {
  key: string;
  name: string;
  classLabel: string;
  // The unit's art name (getUnitSprite).
  sprite: string;
  level: number;
  secondary: string | null;
}

// A lesson row: the class, the skills its set teaches, and `note`, how
// it's paid for or why it can't be taken ("Iris · 20 G", "Scroll",
// "Learned", "No mentor").
export interface MentorLessonView {
  key: string;
  label: string;
  skills: string;
  note: string;
  disabled: boolean;
}

export interface MentorScreenView {
  gold: number;
  scrolls: number;
  column: MentorColumn;
  unitIndex: number;
  lessonIndex: number;
  units: readonly MentorUnitView[];
  lessons: readonly MentorLessonView[];
  // The highlighted lesson's set (or, on the units, the picked unit's own
  // secondary set): its name and what it teaches. Null when there's none.
  detail: { label: string; description: string } | null;
}

function classLabel(classId: string): string {
  return UNIT_CLASSES.find((unitClass) => unitClass.id === classId)?.label ?? classId;
}

// What the `classId` set teaches, one sentence per skill with its cost and
// the level it comes at.
function describeSet(classId: string): string {
  return getSkillSet(classId)
    .map(({ level, skill }) => `${skill.label} (${skill.manaCost} MP, from Lv ${level}): ${describeSkill(skill)}`)
    .join(' ');
}

function lessonNote(lesson: Lesson, mentorName: string | null): string {
  if (lesson.known) return 'Learned';
  if (lesson.source === 'mentor') return `${mentorName} · ${MENTOR_FEE} G`;
  if (lesson.source === 'scroll') return 'Scroll';
  return mentorName ? `${MENTOR_FEE} G` : 'No mentor';
}

export function toMentorScreenView(state: MentorScreenState): MentorScreenView {
  const { run } = state;
  const nameOf = (unitId: string | null) => run.roster.find((unit) => unit.id === unitId)?.name ?? null;
  const units = run.roster.map((unit) =>
    Object.freeze<MentorUnitView>({
      key: unit.id,
      name: unit.name,
      classLabel: classLabel(unit.classId),
      sprite: getUnitSprite(unit.classId),
      level: unit.level,
      secondary: unit.secondaryClass ? classLabel(unit.secondaryClass) : null,
    }),
  );
  const picked = getPickedLessons(state);
  const lessons = picked.map((lesson) =>
    Object.freeze<MentorLessonView>({
      key: lesson.classId,
      label: classLabel(lesson.classId),
      skills: getSkillSet(lesson.classId)
        .map(({ skill }) => skill.label)
        .join(', '),
      note: lessonNote(lesson, nameOf(lesson.mentorId)),
      disabled: lesson.source === null,
    }),
  );
  const shown =
    state.column === 'lessons' ? picked[state.lessonIndex]?.classId : run.roster[state.unitIndex]?.secondaryClass;

  return Object.freeze({
    gold: run.gold,
    scrolls: getScrolls(run),
    column: state.column,
    unitIndex: state.unitIndex,
    lessonIndex: state.lessonIndex,
    units: Object.freeze(units),
    lessons: Object.freeze(lessons),
    detail: shown ? Object.freeze({ label: `${classLabel(shown)} set`, description: describeSet(shown) }) : null,
  });
}
