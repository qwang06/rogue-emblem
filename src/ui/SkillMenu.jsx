import { useGameStore } from './useGameStore.js';
import { menuItemPointerProps } from './menuPointer.js';

// Displays the active unit's skills, opened from the action menu. Each
// entry shows its mana cost; skills the unit can't afford are greyed out.
// Selection is driven by GridScene; the mouse is forwarded to it.
export function SkillMenu() {
  const menu = useGameStore((state) => state.skillMenu);
  if (!menu) return null;

  return (
    <nav className="panel action-menu" aria-label="Skills">
      <ul className="action-menu__list">
        {menu.actions.map((skill, index) => {
          const selected = index === menu.selectedIndex;
          const classes = ['action-menu__item', 'skill-menu__item'];
          if (selected) classes.push('action-menu__item--selected');
          if (skill.disabled) classes.push('action-menu__item--disabled');
          return (
            <li
              key={skill.id}
              className={classes.join(' ')}
              aria-current={selected ? 'true' : undefined}
              {...menuItemPointerProps('skillMenu', index)}
              aria-disabled={skill.disabled ? 'true' : undefined}
            >
              <span>{skill.label}</span>
              <span className="skill-menu__cost">{skill.manaCost} MP</span>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
