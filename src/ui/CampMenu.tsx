import { useGameStore } from './useGameStore.ts';
import { menuItemPointerProps } from './menuPointer.ts';

// The camp between Warband Mode stages, once the reward is taken: Manage
// Roster opens the roster screen (RosterScreen), Next Stage marches on.
// It stays up, under the roster screen, while that's open. GridScene
// handles the input; the mouse is forwarded to it.
export function CampMenu() {
  const menu = useGameStore((state) => state.campMenu);
  const rosterOpen = useGameStore((state) => state.rosterScreen !== null);
  if (!menu || rosterOpen) return null;

  return (
    <div className="pause-overlay">
      <nav className="panel action-menu pause-menu camp-menu" aria-label="Camp">
        <h2 className="pause-menu__title">Camp</h2>
        <ul className="action-menu__list">
          {menu.actions.map((action, index) => {
            const selected = index === menu.selectedIndex;
            return (
              <li
                key={action.id}
                className={selected ? 'action-menu__item action-menu__item--selected' : 'action-menu__item'}
                aria-current={selected ? 'true' : undefined}
                {...menuItemPointerProps('campMenu', index)}
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
