import { useGameStore } from './useGameStore.js';
import { menuItemPointerProps } from './menuPointer.js';

// Displays the active unit's items, opened from the action menu. Each
// entry shows how many are left; items that would restore nothing (e.g. a
// health potion at full health) are greyed out. Selection is driven by
// GridScene; the mouse is forwarded to it.
export function ItemMenu() {
  const menu = useGameStore((state) => state.itemMenu);
  if (!menu) return null;

  return (
    <nav className="panel action-menu" aria-label="Items">
      <ul className="action-menu__list">
        {menu.actions.map((item, index) => {
          const selected = index === menu.selectedIndex;
          const classes = ['action-menu__item', 'skill-menu__item'];
          if (selected) classes.push('action-menu__item--selected');
          if (item.disabled) classes.push('action-menu__item--disabled');
          return (
            <li
              key={item.id}
              className={classes.join(' ')}
              aria-current={selected ? 'true' : undefined}
              {...menuItemPointerProps('itemMenu', index)}
              aria-disabled={item.disabled ? 'true' : undefined}
            >
              <span>{item.label}</span>
              <span className="skill-menu__cost">×{item.quantity}</span>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
