import { useGameStore } from './useGameStore.ts';
import { menuItemPointerProps } from './menuPointer.ts';
import { useMenuBesideUnit } from './useMenuBesideUnit.ts';

// Displays the active unit's weapons, opened by choosing Attack: each
// weapon it can wield with its uses left (∞ for one that never breaks),
// greyed out when nothing is in its range, and the highlighted weapon's
// numbers underneath. Selection is driven by GridScene; the mouse is
// forwarded to it.
export function WeaponMenu() {
  const menu = useGameStore((state) => state.weaponMenu);
  const placement = useMenuBesideUnit(Boolean(menu));
  if (!menu) return null;

  const highlighted = menu.actions[menu.selectedIndex];
  return (
    <nav className="panel action-menu action-menu--beside-unit" aria-label="Weapons" {...placement}>
      <ul className="action-menu__list">
        {menu.actions.map((weapon, index) => {
          const selected = index === menu.selectedIndex;
          const classes = ['action-menu__item', 'skill-menu__item'];
          if (selected) classes.push('action-menu__item--selected');
          if (weapon.disabled) classes.push('action-menu__item--disabled');
          return (
            <li
              key={weapon.id}
              className={classes.join(' ')}
              aria-current={selected ? 'true' : undefined}
              {...menuItemPointerProps('weaponMenu', index)}
              aria-disabled={weapon.disabled ? 'true' : undefined}
            >
              <span>{weapon.label}</span>
              <span className="skill-menu__cost">{weapon.uses ?? '∞'}</span>
            </li>
          );
        })}
      </ul>
      {highlighted && (
        <dl className="weapon-menu__stats" aria-label={`${highlighted.label}'s numbers`}>
          <Stat label="Mt" value={highlighted.might} />
          <Stat label="Hit" value={highlighted.hit} />
          <Stat label="Crit" value={highlighted.crit} />
          <Stat label="Wt" value={highlighted.weight} />
          <Stat label="Rng" value={highlighted.range} />
          <Stat label="Type" value={highlighted.type} wide />
        </dl>
      )}
    </nav>
  );
}

function Stat({ label, value, wide = false }: { label: string; value: number | string; wide?: boolean }) {
  return (
    <div className={wide ? 'weapon-menu__stat weapon-menu__stat--wide' : 'weapon-menu__stat'}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
