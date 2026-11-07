import type { ReactNode } from 'react';
import type { GameState } from '../bridge/gameStore.ts';
import { DeploymentMenu } from './DeploymentMenu.tsx';
import { GlyphIcon } from './GlyphIcon.tsx';
import { UnitPanel } from './UnitPanel.tsx';
import { useGameStore } from './useGameStore.ts';

// Whether the battle map is what the player is looking at: a battle (or its
// deployment) is running and no between-stage screen (camp, rewards, a run's
// recap) covers it. The dock and the command bar show only then.
export function isOnField(state: GameState): boolean {
  return (
    state.screen === 'battle' &&
    state.phase !== null &&
    state.battleOutcome === null &&
    !state.campMenu &&
    !state.rewardMenu &&
    !state.boonPick &&
    !state.rosterScreen &&
    !state.equipmentScreen &&
    !state.merchantScreen &&
    !state.promotionScreen &&
    !state.mentorScreen &&
    !state.runSummary &&
    !state.stageClear
  );
}

// The column docked on the stage's left all through a battle, so nothing
// it shows ever covers the board: the battle's objective and turn at the
// top (with the Place Units / Start menu under it during deployment), the
// unit under the cursor (UnitPanel) in the middle, and the tile under the
// cursor at the bottom. Hidden on narrow windows, where the unit
// panel floats over the map instead (see ui.css).
export function BattleDock() {
  const onField = useGameStore(isOnField);
  if (!onField) return null;

  return (
    <aside className="battle-dock" aria-label="Battle readouts">
      <ObjectiveCard />
      <DeploymentMenu docked />
      <UnitPanel docked />
      <TerrainCard />
    </aside>
  );
}

// The battle's goal, what loses it, and the turn against its limit.
function ObjectiveCard() {
  const objective = useGameStore((state) => state.battleObjective ?? state.deploymentObjective);
  const status = useGameStore((state) => state.objectiveStatus);
  const phase = useGameStore((state) => state.phase);
  if (!objective) return null;

  return (
    <DockSection title={phase === 'deployment' ? 'Deployment' : 'Objective'} className="objective-card">
      <p className="objective-card__goal">
        <GlyphIcon kind={objective.kind} />
        <span>{objective.goal}</span>
      </p>
      <p className="objective-card__defeat">{objective.defeat}</p>
      {status && (
        <p className="objective-card__turn">
          <span className="objective-card__turn-label">Turn</span>
          <span className="objective-card__turn-count">
            {status.turn}
            <span className="objective-card__turn-limit"> / {status.limit}</span>
          </span>
        </p>
      )}
    </DockSection>
  );
}

// The terrain under the cursor and what entering it costs, as the tactics
// games show in a corner.
function TerrainCard() {
  const tile = useGameStore((state) => state.hoveredTile);
  if (!tile) return null;

  return (
    <DockSection title="Terrain" className="terrain-card">
      <p className="terrain-card__name">{tile.label}</p>
      <dl className="terrain-card__facts">
        <div className="terrain-card__fact">
          <dt>Move</dt>
          <dd>{tile.moveCost === null ? '—' : tile.moveCost}</dd>
        </div>
        <div className="terrain-card__fact">
          <dt>Tile</dt>
          <dd>
            {tile.x + 1}, {tile.y + 1}
          </dd>
        </div>
      </dl>
    </DockSection>
  );
}

// One readout of the dock: a small caps heading on a hairline, then its
// contents.
export function DockSection({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={className ? `dock-section ${className}` : 'dock-section'}>
      <h2 className="dock-section__title">{title}</h2>
      {children}
    </section>
  );
}
