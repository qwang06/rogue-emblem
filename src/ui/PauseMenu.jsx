import { useGameStore } from './useGameStore.js';

// The End Turn / Main Menu / Settings menu opened with Esc on the bare map. Display
// only — GridScene handles the input.
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
