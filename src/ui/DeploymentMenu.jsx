import { useGameStore } from './useGameStore.js';
import { menuItemPointerProps } from './menuPointer.js';

// The Place Units / Start menu of the deployment phase. Selection is driven
// by GridScene; this renders the snapshot and forwards the mouse. Start shows
// as disabled until a unit has been placed.
export function DeploymentMenu() {
  const menu = useGameStore((state) => state.deploymentMenu);
  if (!menu) return null;

  return (
    <nav className="panel action-menu" aria-label="Deployment">
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
              {...menuItemPointerProps('deploymentMenu', index)}
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
