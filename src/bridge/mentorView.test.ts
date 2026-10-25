import { describe, expect, it } from 'vitest';
import { Acolyte } from '../game/Acolyte.ts';
import { Archer } from '../game/Archer.ts';
import { getUnitSprite } from '../game/tileset.ts';
import type { Unit } from '../game/Unit.ts';
import { addScrolls, getSecondaryClassIds, MENTOR_FEE } from '../game/warband/mentors.ts';
import { confirmMentor, openMentorScreen, pointMentorCursor } from '../game/warband/mentorScreen.ts';
import { createRun, type RunState } from '../game/warband/run.ts';
import { toMentorScreenView } from './mentorView.ts';

function campRun(gold = 50): RunState {
  const run = createRun(
    7,
    new Map<string, Unit>([
      ['wren', new Archer({ name: 'Wren', team: 'player', level: 2 })],
      ['iris', new Acolyte({ name: 'Iris', team: 'player', level: 2 })],
    ]),
  );
  return { ...run, gold };
}

const ACOLYTE_LESSON = getSecondaryClassIds({ classId: 'archer' }).indexOf('acolyte');

describe('toMentorScreenView', () => {
  it("lists the units and the picked unit's lessons with how each is paid", () => {
    const view = toMentorScreenView(openMentorScreen(campRun()));
    expect(view).toMatchObject({ gold: 50, scrolls: 0, column: 'units', unitIndex: 0, detail: null });
    expect(view.units[0]).toEqual({
      key: 'wren',
      name: 'Wren',
      classLabel: 'Archer',
      sprite: getUnitSprite('archer'),
      level: 2,
      secondary: null,
    });
    expect(view.lessons.map(({ label }) => label)).toEqual(['Warrior', 'Soldier', 'Vanguard', 'Guard', 'Acolyte']);
    expect(view.lessons[ACOLYTE_LESSON]).toEqual({
      key: 'acolyte',
      label: 'Acolyte',
      skills: 'Mend',
      note: `Iris · ${MENTOR_FEE} G`,
      disabled: false,
    });
    expect(view.lessons[0]).toMatchObject({ note: 'No mentor', disabled: true });
  });

  it("notes a scroll, a fee out of reach, and the unit's own set", () => {
    const scrolled = toMentorScreenView(openMentorScreen(addScrolls(campRun(0))));
    expect(scrolled.scrolls).toBe(1);
    expect(scrolled.lessons.every((lesson) => lesson.note === 'Scroll' && !lesson.disabled)).toBe(true);
    const broke = toMentorScreenView(openMentorScreen(campRun(0)));
    expect(broke.lessons[ACOLYTE_LESSON]).toMatchObject({ note: `${MENTOR_FEE} G`, disabled: true });
    const learned = confirmMentor(pointMentorCursor(openMentorScreen(campRun()), 'lessons', ACOLYTE_LESSON));
    const view = toMentorScreenView(learned);
    expect(view.lessons[ACOLYTE_LESSON]).toMatchObject({ note: 'Learned', disabled: true });
    expect(view.units[0].secondary).toBe('Acolyte');
  });

  it("describes the highlighted lesson's set, or on the units the picked unit's own", () => {
    const state = pointMentorCursor(openMentorScreen(campRun()), 'lessons', ACOLYTE_LESSON);
    const detail = {
      label: 'Acolyte set',
      description: 'Mend (3 MP, from Lv 2): Heals an ally next to it for 2 + MAG.',
    };
    expect(toMentorScreenView(state).detail).toEqual(detail);
    const back = pointMentorCursor(confirmMentor(state), 'units', 0);
    expect(toMentorScreenView(back).detail).toEqual(detail);
  });
});
