import { UnitSprite } from './UnitSprite.tsx';
import { useGameStore } from './useGameStore.ts';
import { menuItemPointerProps } from './menuPointer.ts';

// The units available to deploy, each with its sprite, while the player
// picks one to place, centered on the map. The title counts placed units
// against the map's limit; once it's reached, units not yet on the map are
// greyed out. GridScene handles the input; the mouse is forwarded to it.
export function RosterMenu() {
  const menu = useGameStore((state) => state.rosterMenu);
  const limit = useGameStore((state) => state.deploymentLimit);
  if (!menu) return null;

  const placed = menu.actions.filter((entry) => entry.placed).length;

  return (
    <nav className="panel action-menu action-menu--centered roster-menu" aria-label="Units">
      <h2 className="roster-menu__title">
        Units
        {limit !== null && (
          <span className="roster-menu__count">
            {placed}/{limit}
          </span>
        )}
      </h2>
      <ul className="action-menu__list">
        {menu.actions.map((entry, index) => {
          const selected = index === menu.selectedIndex;
          const classes = ['action-menu__item', 'roster-menu__item'];
          if (selected) classes.push('action-menu__item--selected');
          if (entry.disabled) classes.push('action-menu__item--disabled');
          return (
            <li
              key={entry.id}
              className={classes.join(' ')}
              aria-current={selected ? 'true' : undefined}
              aria-disabled={entry.disabled ? 'true' : undefined}
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
