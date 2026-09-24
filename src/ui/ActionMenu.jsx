import { useGameStore } from './useGameStore.js';

// Displays the unit action menu while one is open. Selection is driven by
// the keyboard in GridScene; this component only renders the snapshot.
export function ActionMenu() {
  const menu = useGameStore((state) => state.actionMenu);
  if (!menu) return null;

  return (
    <nav className="panel action-menu" aria-label="Unit actions">
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
  );
}
