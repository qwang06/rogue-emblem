import { useGameStore } from './useGameStore.ts';
import { menuItemPointerProps } from './menuPointer.ts';

// The Place Units / Start menu of the deployment phase, centered on the map,
// under the battle's objective (what wins it, and what loses it), so the
// objective needs no screen of its own. Selection is driven by GridScene;
// this renders the snapshot and forwards the mouse. Start shows as disabled
// until a unit has been placed.
export function DeploymentMenu() {
  const menu = useGameStore((state) => state.deploymentMenu);
  const objective = useGameStore((state) => state.deploymentObjective);
  if (!menu) return null;

  return (
    <nav className="panel action-menu action-menu--centered deployment-menu" aria-label="Deployment">
      {objective && (
        <>
          <h2 className="deployment-menu__title">Objective</h2>
          <div className="deployment-menu__objective" title={objective.battle}>
            <p className="deployment-menu__goal">{objective.goal}</p>
            <p className="deployment-menu__defeat">Defeat: {objective.defeat}</p>
          </div>
        </>
      )}
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
