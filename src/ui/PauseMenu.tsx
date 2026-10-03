import { useGameStore } from './useGameStore.ts';
import { menuItemPointerProps } from './menuPointer.ts';

// The End Turn / Main Menu / Settings menu opened with Esc on the bare map.
// GridScene handles the input; the mouse is forwarded to it.
export function PauseMenu() {
  const menu = useGameStore((state) => state.pauseMenu);
  if (!menu) return null;

  return (
    <div className="pause-overlay">
      <nav className="panel action-menu pause-menu" aria-label="Pause menu">
        <h2 className="pause-menu__title">Paused</h2>
        <ul className="action-menu__list">
          {menu.actions.map((action, index) => {
            const selected = index === menu.selectedIndex;
            return (
              <li
                key={action.id}
                className={selected ? 'action-menu__item action-menu__item--selected' : 'action-menu__item'}
                aria-current={selected ? 'true' : undefined}
                {...menuItemPointerProps('pauseMenu', index)}
              >
                {action.label}
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
