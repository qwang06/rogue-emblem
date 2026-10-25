import { useGameStore } from './useGameStore.ts';
import { menuItemPointerProps } from './menuPointer.ts';
import { MenuIcon } from './MenuIcon.tsx';

// The End Turn / Undo / Main Menu / Settings menu opened with Esc on the bare map.
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
            const classes = ['action-menu__item', 'action-menu__item--icon'];
            if (selected) classes.push('action-menu__item--selected');
            if (action.disabled) classes.push('action-menu__item--disabled');
            return (
              <li
                key={action.id}
                className={classes.join(' ')}
                aria-current={selected ? 'true' : undefined}
                aria-disabled={action.disabled ? 'true' : undefined}
                {...menuItemPointerProps('pauseMenu', index)}
              >
                <MenuIcon id={action.id} />
                {action.label}
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
