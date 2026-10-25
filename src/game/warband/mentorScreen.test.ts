import { describe, expect, it } from 'vitest';
import { Acolyte } from '../Acolyte.ts';
import { Archer } from '../Archer.ts';
import type { Unit } from '../Unit.ts';
import { getSecondaryClassIds, MENTOR_FEE } from './mentors.ts';
import {
  cancelMentor,
  confirmMentor,
  getPickedLessons,
  moveMentorCursor,
  openMentorScreen,
  pointMentorCursor,
  type MentorScreenState,
} from './mentorScreen.ts';
import { createRun, type RunState } from './run.ts';

// Wren the archer and Iris the acolyte, both level 2, with 50 gold.
function campRun(): RunState {
  const run = createRun(
    7,
    new Map<string, Unit>([
      ['wren', new Archer({ name: 'Wren', team: 'player', level: 2 })],
      ['iris', new Acolyte({ name: 'Iris', team: 'player', level: 2 })],
    ]),
  );
  return { ...run, gold: 50 };
}

// The screen with the cursor on Wren's lesson in `classId`'s set.
function onLesson(classId: string): MentorScreenState {
  const state = openMentorScreen(campRun());
  return pointMentorCursor(state, 'lessons', getSecondaryClassIds({ classId: 'archer' }).indexOf(classId));
}

describe('openMentorScreen', () => {
  it('opens on the first unit', () => {
    expect(openMentorScreen(campRun())).toMatchObject({ column: 'units', unitIndex: 0, lessonIndex: 0 });
  });
});

describe('moveMentorCursor', () => {
  it('moves between the columns, stopping at either end', () => {
    const state = openMentorScreen(campRun());
    expect(moveMentorCursor(state, -1, 0)).toBe(state);
    const lessons = moveMentorCursor(state, 1, 0);
    expect(lessons.column).toBe('lessons');
    expect(moveMentorCursor(lessons, 1, 0)).toBe(lessons);
  });

  it('wraps within a column, and a new unit starts its lessons from the top', () => {
    const state = moveMentorCursor(moveMentorCursor(openMentorScreen(campRun()), 1, 0), 0, -1);
    expect(state.lessonIndex).toBe(getPickedLessons(state).length - 1);
    const next = moveMentorCursor(moveMentorCursor(state, -1, 0), 0, 1);
    expect(next).toMatchObject({ unitIndex: 1, lessonIndex: 0 });
    expect(moveMentorCursor(next, 0, 1).unitIndex).toBe(0);
  });

  it('stays put on an empty roster', () => {
    const state = openMentorScreen({ ...campRun(), roster: [] });
    expect(moveMentorCursor(state, 0, 1)).toBe(state);
    expect(getPickedLessons(state)).toEqual([]);
  });
});

describe('pointMentorCursor', () => {
  it('points at an entry of either column, ignoring out-of-range ones', () => {
    const state = openMentorScreen(campRun());
    expect(pointMentorCursor(state, 'units', 1)).toMatchObject({ column: 'units', unitIndex: 1 });
    expect(pointMentorCursor(state, 'lessons', 2)).toMatchObject({ column: 'lessons', lessonIndex: 2 });
    expect(pointMentorCursor(state, 'units', 5)).toBe(state);
    expect(pointMentorCursor(state, 'lessons', -1)).toBe(state);
    expect(pointMentorCursor(state, 'units', 0)).toBe(state);
  });
});

describe('confirmMentor', () => {
  it('moves from a unit into its lessons', () => {
    expect(confirmMentor(openMentorScreen(campRun())).column).toBe('lessons');
  });

  it('takes a lesson from a mentor for the fee', () => {
    const state = confirmMentor(onLesson('acolyte'));
    expect(state.run.roster[0].secondaryClass).toBe('acolyte');
    expect(state.run.gold).toBe(50 - MENTOR_FEE);
    expect(state.column).toBe('lessons');
  });

  it('does nothing for a lesson that cannot be taken', () => {
    const state = onLesson('guard');
    expect(confirmMentor(state)).toBe(state);
    const known = confirmMentor(onLesson('acolyte'));
    expect(confirmMentor(known)).toBe(known);
  });
});

describe('cancelMentor', () => {
  it('goes back to the units from the lessons, then closes', () => {
    const lessons = confirmMentor(openMentorScreen(campRun()));
    const units = cancelMentor(lessons)!;
    expect(units.column).toBe('units');
    expect(cancelMentor(units)).toBeNull();
  });
});
