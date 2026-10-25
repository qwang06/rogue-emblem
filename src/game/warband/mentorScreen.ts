// The mentor screen at camp (see mentors.ts): two columns side by side,
// the warband's units and the skill sets the picked unit could learn, and
// the cursor is in one of them. Left and right move between the columns,
// up and down within one (wrapping). Confirm on a unit moves into its
// lessons; confirm on a lesson takes it (a mentor's fee or a scroll
// spent), and does nothing when it can't be taken. Cancel goes from the
// lessons back to the units, and from the units closes the screen.
// Everything here is pure: each function returns a new frozen state and
// leaves its input alone.

import { canLearnSecondary, getLessons, learnSecondary, type Lesson } from './mentors.ts';
import type { RunState } from './run.ts';

export type MentorColumn = 'units' | 'lessons';

export interface MentorScreenState {
  run: RunState;
  column: MentorColumn;
  // The picked unit and the highlighted lesson; each stays in range of its
  // list (0 when the list is empty).
  unitIndex: number;
  lessonIndex: number;
}

const COLUMNS: readonly MentorColumn[] = Object.freeze(['units', 'lessons']);

// The screen opened on `run`, on its first unit.
export function openMentorScreen(run: RunState): MentorScreenState {
  return freeze({ run, column: 'units', unitIndex: 0, lessonIndex: 0 });
}

// The lessons of the unit the screen has picked (none for an empty roster).
export function getPickedLessons(state: MentorScreenState): Lesson[] {
  const unit = state.run.roster[state.unitIndex];
  return unit ? getLessons(state.run, unit.id) : [];
}

// Moves the cursor: `dx` between the columns (stopping at either end), `dy`
// within the column (wrapping). Picking another unit starts its lessons
// from the top.
export function moveMentorCursor(state: MentorScreenState, dx: number, dy: number): MentorScreenState {
  if (dx !== 0) {
    const at = COLUMNS.indexOf(state.column);
    const column = COLUMNS[Math.max(0, Math.min(COLUMNS.length - 1, at + Math.sign(dx)))];
    return column === state.column ? state : freeze({ ...state, column });
  }
  const count = columnLength(state, state.column);
  if (dy === 0 || count === 0) return state;
  if (state.column === 'units') {
    return freeze({ ...state, unitIndex: wrap(state.unitIndex + dy, count), lessonIndex: 0 });
  }
  return freeze({ ...state, lessonIndex: wrap(state.lessonIndex + dy, count) });
}

// Points the cursor at entry `index` of `column` (e.g. on mouse hover).
// Out-of-range indices change nothing.
export function pointMentorCursor(state: MentorScreenState, column: MentorColumn, index: number): MentorScreenState {
  if (!Number.isInteger(index) || index < 0 || index >= columnLength(state, column)) return state;
  if (column === 'units') {
    if (state.column === 'units' && state.unitIndex === index) return state;
    const lessonIndex = index === state.unitIndex ? state.lessonIndex : 0;
    return freeze({ ...state, column, unitIndex: index, lessonIndex });
  }
  if (state.column === 'lessons' && state.lessonIndex === index) return state;
  return freeze({ ...state, column, lessonIndex: index });
}

// Confirm: moves from a unit into its lessons, or takes the highlighted
// lesson when it can be taken.
export function confirmMentor(state: MentorScreenState): MentorScreenState {
  if (state.column === 'units') {
    return columnLength(state, 'lessons') === 0 ? state : freeze({ ...state, column: 'lessons' });
  }
  const unit = state.run.roster[state.unitIndex];
  const lesson = getPickedLessons(state)[state.lessonIndex];
  if (!unit || !lesson || !canLearnSecondary(state.run, unit.id, lesson.classId)) return state;
  return freeze({ ...state, run: learnSecondary(state.run, unit.id, lesson.classId) });
}

// Cancel: from the lessons back to the units, else closes the screen
// (null).
export function cancelMentor(state: MentorScreenState): MentorScreenState | null {
  return state.column === 'lessons' ? freeze({ ...state, column: 'units' }) : null;
}

function columnLength(state: MentorScreenState, column: MentorColumn): number {
  return column === 'units' ? state.run.roster.length : getPickedLessons(state).length;
}

function wrap(index: number, count: number): number {
  return ((index % count) + count) % count;
}

function freeze(state: MentorScreenState): MentorScreenState {
  return Object.freeze(state);
}
