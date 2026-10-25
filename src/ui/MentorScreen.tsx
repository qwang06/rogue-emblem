import type { MouseEvent } from 'react';
import { gameCommands } from '../bridge/commands.ts';
import type { MentorColumn } from '../game/warband/mentorScreen.ts';
import { KeyHint } from './KeyHint.tsx';
import { ScrollList } from './ScrollList.tsx';
import { useGameStore } from './useGameStore.ts';

// Mouse handlers for an entry of the mentor screen: hovering moves the
// cursor there and clicking confirms it, exactly as the keyboard would.
function pointerProps(column: MentorColumn, index: number) {
  return {
    onMouseEnter: () => gameCommands.send({ type: 'hover-mentor', column, index }),
    onClick: (event: MouseEvent) => {
      event.stopPropagation();
      gameCommands.send({ type: 'select-mentor', column, index });
    },
  };
}

function rowClass(selected: boolean, focused: boolean, disabled = false) {
  const classes = ['action-menu__item', 'roster-screen__row'];
  if (selected && focused) classes.push('action-menu__item--selected');
  else if (selected) classes.push('roster-screen__row--picked');
  if (disabled) classes.push('action-menu__item--disabled');
  return classes.join(' ');
}

function columnClass(focused: boolean) {
  return `roster-screen__column${focused ? ' roster-screen__column--focused' : ''}`;
}

// The camp's mentors (see src/game/warband/mentorScreen.ts): the units
// beside the skill sets the picked one could learn, each with the mentor
// and fee or the scroll it would take, or why it can't be taken. The gold
// and scrolls sit in the window's top border, so them changing never
// moves anything, and the detail line keeps room for its longest text.
// GridScene handles the input; the mouse is forwarded to it.
export function MentorScreen() {
  const view = useGameStore((state) => state.mentorScreen);
  if (!view) return null;
  const picked = view.units[view.unitIndex];

  return (
    <div className="pause-overlay">
      <div className="roster-screen__scroll merchant-screen__scroll">
        <section className="panel roster-screen merchant-screen mentor-screen" aria-label="Mentors">
          <h2 className="roster-screen__title">Mentors</h2>
          <p className="merchant-screen__gold">
            {view.gold} gold · {view.scrolls} {view.scrolls === 1 ? 'scroll' : 'scrolls'}
          </p>
          <div className="roster-screen__columns merchant-screen__columns">
            <section className={columnClass(view.column === 'units')}>
              <h3 className="roster-screen__heading">Units</h3>
              <ScrollList
                className="action-menu__list roster-screen__list merchant-screen__list"
                selectedIndex={view.unitIndex}
              >
                {view.units.map((unit, index) => (
                  <li
                    key={unit.key}
                    className={rowClass(index === view.unitIndex, view.column === 'units')}
                    aria-current={index === view.unitIndex ? 'true' : undefined}
                    {...pointerProps('units', index)}
                  >
                    <span className="roster-screen__unit">
                      <span className="roster-screen__name">{unit.name}</span>
                      <span className="roster-screen__meta">
                        {unit.classLabel} · Lv {unit.level}
                        {unit.secondary ? ` · + ${unit.secondary}` : ''}
                      </span>
                    </span>
                  </li>
                ))}
              </ScrollList>
            </section>

            <section className={columnClass(view.column === 'lessons')}>
              <h3 className="roster-screen__heading">{picked ? `Teach ${picked.name}` : 'Skill sets'}</h3>
              <ScrollList
                className="action-menu__list roster-screen__list merchant-screen__list"
                selectedIndex={view.lessonIndex}
              >
                {view.lessons.map((lesson, index) => (
                  <li
                    key={lesson.key}
                    className={rowClass(index === view.lessonIndex, view.column === 'lessons', lesson.disabled)}
                    aria-current={index === view.lessonIndex ? 'true' : undefined}
                    aria-disabled={lesson.disabled ? 'true' : undefined}
                    {...pointerProps('lessons', index)}
                  >
                    <span className="roster-screen__unit">
                      <span className="roster-screen__name">{lesson.label}</span>
                      <span className="roster-screen__meta">{lesson.skills}</span>
                    </span>
                    <span className="mentor-screen__note">{lesson.note}</span>
                  </li>
                ))}
              </ScrollList>
            </section>
          </div>

          <p className="roster-screen__detail mentor-screen__detail">
            {view.detail ? (
              <>
                <span className="roster-screen__detail-label">{view.detail.label}</span> {view.detail.description}
              </>
            ) : (
              <span className="roster-screen__detail-hint">
                A unit learns one other class's skills from a mentor of that class on the roster, or with a Mentor's
                Scroll. A new set replaces the old one.
              </span>
            )}
          </p>
          <KeyHint
            className="roster-screen__hint"
            entries={[
              ['←→', 'Column'],
              ['↑↓', 'Choose'],
              ['Enter', view.column === 'units' ? 'Pick' : 'Learn'],
              ['Esc', view.column === 'units' ? 'Done' : 'Back'],
            ]}
          />
        </section>
      </div>
    </div>
  );
}
