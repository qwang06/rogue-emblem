import { useGameStore } from './useGameStore.js';

// Displays the unit action menu while one is open. Selection is driven by
// the keyboard in GridScene; this component only renders the snapshot.
// Disabled actions (e.g. Skill before any are learned) are greyed out.
export function ActionMenu() {
  const menu = useGameStore((state) => state.actionMenu);
  if (!menu) return null;

  return (
    <nav className="panel action-menu" aria-label="Unit actions">
      <ul className="action-menu__list">
        {menu.actions.map((action, index) => {
          const selected = index === menu.selectedIndex;
          const classes = ['action-menu__item'];
          if (selected) classes.push('action-menu__item--selected');
          if (action.disabled) classes.push('action-menu__item--disabled');
          return (
            <li
              key={action.id}
              className={classes.join(' ')}
              aria-current={selected ? 'true' : undefined}
              aria-disabled={action.disabled ? 'true' : undefined}
            >
              {action.label}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
