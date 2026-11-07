import { useGameStore } from './useGameStore.ts';
import { GlyphIcon } from './GlyphIcon.tsx';
import { menuItemPointerProps } from './menuPointer.ts';
import { MenuIcon } from './MenuIcon.tsx';

// The Place Units / Start menu of the deployment phase. `docked`, it's a
// list in the battle dock under the objective card (BattleDock); otherwise
// a window docked on the map's left edge, under the battle's objective
// (what wins it, after its kind's icon, and what loses it, after a skull),
// so the objective needs no screen of its own (for windows too narrow for
// the dock; ui.css shows one or the other). Selection is driven by
// GridScene; this renders the snapshot and forwards the mouse. Start shows
// as disabled until a unit has been placed.
export function DeploymentMenu({ docked = false }: { docked?: boolean }) {
  const menu = useGameStore((state) => state.deploymentMenu);
  const objective = useGameStore((state) => state.deploymentObjective);
  if (!menu) return null;

  const classes = docked
    ? 'dock-section action-menu deployment-menu deployment-menu--docked'
    : 'panel action-menu action-menu--centered deployment-menu deployment-menu--float';
  return (
    <nav className={classes} aria-label="Deployment">
      {objective && !docked && (
        <>
          <h2 className="deployment-menu__title">Objective</h2>
          <div className="deployment-menu__objective" title={objective.battle}>
            <p className="deployment-menu__goal">
              <GlyphIcon kind={objective.kind} />
              {objective.goal}
            </p>
            <p className="deployment-menu__defeat">
              <GlyphIcon kind="skull" />
              <span className="visually-hidden">Defeat: </span>
              {objective.defeat}
            </p>
          </div>
        </>
      )}
      <ul className="action-menu__list">
        {menu.actions.map((action, index) => {
          const selected = index === menu.selectedIndex;
          const classes = ['action-menu__item', 'action-menu__item--icon'];
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
              <MenuIcon id={action.id} />
              {action.label}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
