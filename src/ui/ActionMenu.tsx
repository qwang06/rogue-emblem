import { useGameStore } from './useGameStore.ts';
import { menuItemPointerProps } from './menuPointer.ts';
import { useMenuBesideUnit } from './useMenuBesideUnit.ts';

// Displays the unit action menu while one is open. Selection is driven by
// GridScene; this component renders the snapshot and forwards the mouse.
// Disabled actions (e.g. Skill before any are learned) are greyed out.
export function ActionMenu() {
  const menu = useGameStore((state) => state.actionMenu);
  const placement = useMenuBesideUnit(Boolean(menu));
  if (!menu) return null;

  return (
    <nav className="panel action-menu action-menu--beside-unit" aria-label="Unit actions" {...placement}>
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
              {...menuItemPointerProps('actionMenu', index)}
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
