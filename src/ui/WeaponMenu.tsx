import { ItemIcon } from './ItemIcon.tsx';
import { StatIcon } from './StatIcon.tsx';
import { useGameStore } from './useGameStore.ts';
import { menuItemPointerProps } from './menuPointer.ts';
import { useMenuBesideUnit } from './useMenuBesideUnit.ts';

// Displays the active unit's weapons, opened by choosing Attack, laid out
// like the GBA's item window: each weapon it can wield with its icon,
// greyed out when nothing is in its range, the highlighted one on the
// selection bar with its uses under its name (USES 35/40, or ∞ for one
// that never breaks), and the highlighted weapon's numbers in a column on
// the right. Every row keeps room for the uses line, so moving the
// selection never changes the menu's size. Selection is driven by
// GridScene; the mouse is forwarded to it.
export function WeaponMenu() {
  const menu = useGameStore((state) => state.weaponMenu);
  const placement = useMenuBesideUnit(Boolean(menu));
  if (!menu) return null;

  const highlighted = menu.actions[menu.selectedIndex];
  return (
    <nav className="panel action-menu action-menu--beside-unit weapon-menu" aria-label="Weapons" {...placement}>
      <ul className="action-menu__list weapon-menu__list">
        {menu.actions.map((weapon, index) => {
          const selected = index === menu.selectedIndex;
          const classes = ['action-menu__item', 'weapon-menu__item'];
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
              <ItemIcon itemId={weapon.itemId} />
              <span className="weapon-menu__text">
                <span className="weapon-menu__label">{weapon.label}</span>
                <span className="weapon-menu__uses">
                  Uses {weapon.uses === null ? '∞' : `${weapon.uses}/${weapon.maxUses ?? weapon.uses}`}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {highlighted && (
        <div className="weapon-menu__side">
          <div className="weapon-menu__icons" aria-hidden="true">
            <StatIcon kind="attack" />
            <StatIcon kind="hit" />
            <StatIcon kind="crit" />
          </div>
          <dl className="weapon-menu__stats" aria-label={`${highlighted.label}'s numbers`}>
            <Stat label="Mt" value={highlighted.might} />
            <Stat label="Hit" value={highlighted.hit} />
            <Stat label="Crt" value={highlighted.crit} />
            <Stat label="Wt" value={highlighted.weight} />
            <Stat label="Rng" value={highlighted.range} />
          </dl>
          <p className="weapon-menu__type">{highlighted.type}</p>
        </div>
      )}
    </nav>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="weapon-menu__stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
