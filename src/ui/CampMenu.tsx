import { useGameStore } from './useGameStore.ts';
import { menuItemPointerProps } from './menuPointer.ts';

// The camp between Warband Mode stages, once the reward is taken (see
// src/game/warband/camp.ts): Manage Roster opens the roster screen
// (RosterScreen), Merchant the merchant screen (MerchantScreen), Rest
// heals everyone for gold, Next Stage marches on. The warband's gold sits
// in the window's bottom border. It stays up, under the roster or merchant
// screen, while one is open. GridScene handles the input; the mouse is
// forwarded to it.
export function CampMenu() {
  const menu = useGameStore((state) => state.campMenu);
  const gold = useGameStore((state) => state.campGold);
  const screenOpen = useGameStore((state) => state.rosterScreen !== null || state.merchantScreen !== null);
  if (!menu || screenOpen) return null;

  return (
    <div className="pause-overlay">
      <nav className="panel action-menu pause-menu camp-menu" aria-label="Camp">
        <h2 className="pause-menu__title">Camp</h2>
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
                {...menuItemPointerProps('campMenu', index)}
              >
                {action.label}
              </li>
            );
          })}
        </ul>
        {gold !== null && <p className="camp-menu__gold">{gold} gold</p>}
      </nav>
    </div>
  );
}
