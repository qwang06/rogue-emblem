import { UnitSprite } from './UnitSprite.tsx';
import { useGameStore } from './useGameStore.ts';
import { menuItemPointerProps } from './menuPointer.ts';

// The units available to deploy, each with its sprite, while the player
// picks one to place, centered on the map. GridScene handles the input; the mouse is forwarded to it.
export function RosterMenu() {
  const menu = useGameStore((state) => state.rosterMenu);
  if (!menu) return null;

  return (
    <nav className="panel action-menu action-menu--centered roster-menu" aria-label="Units">
      <h2 className="roster-menu__title">Units</h2>
      <ul className="action-menu__list">
        {menu.actions.map((entry, index) => {
          const selected = index === menu.selectedIndex;
          return (
            <li
              key={entry.id}
              className={
                selected
                  ? 'action-menu__item roster-menu__item action-menu__item--selected'
                  : 'action-menu__item roster-menu__item'
              }
              aria-current={selected ? 'true' : undefined}
              {...menuItemPointerProps('rosterMenu', index)}
            >
              <UnitSprite sprite={entry.sprite} animated />
              <span className="roster-menu__name">{entry.label}</span>
              {entry.placed && <span className="roster-menu__tag">Placed</span>}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
