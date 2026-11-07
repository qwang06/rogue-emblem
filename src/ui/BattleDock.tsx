import { DockSection, isOnField } from './dock.tsx';
import { GlyphIcon } from './GlyphIcon.tsx';
import { TeamCard } from './TeamCard.tsx';
import { TerrainTile } from './TerrainTile.tsx';
import { UnitPanel } from './UnitPanel.tsx';
import { useGameStore } from './useGameStore.ts';

// The column docked on the stage's left all through a battle, so nothing
// it shows ever covers the board: the battle's objective and turn at the
// top (with the enemies to face under it during deployment, when no unit
// is hovered yet), the unit under the cursor (UnitPanel; the defender,
// headed so, while an attack is aimed) in the middle,
// and the tile under the cursor at the bottom. Its mirror on the right is
// BattleSide. Hidden on narrow windows, where the unit panel floats over
// the map instead (see ui.css).
export function BattleDock() {
  const onField = useGameStore(isOnField);
  const deploying = useGameStore((state) => state.phase === 'deployment');
  const enemies = useGameStore((state) => state.enemies);
  const forecastOpen = useGameStore((state) => state.combatForecast !== null);
  if (!onField) return null;

  return (
    <aside className="battle-dock" aria-label="Battle readouts">
      <ObjectiveCard />
      {deploying && (
        <TeamCard
          title="Enemies"
          team="enemy"
          units={enemies}
          footer={
            <>
              <span className="team-card__count">{enemies.length}</span> to defeat
            </>
          }
        />
      )}
      <UnitPanel docked heading={forecastOpen ? 'Defender' : undefined} />
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

// The terrain under the cursor, drawn as the map draws it, and what
// entering it costs, as the tactics games show in a corner.
function TerrainCard() {
  const tile = useGameStore((state) => state.hoveredTile);
  if (!tile) return null;

  return (
    <DockSection title="Terrain" className="terrain-card">
      <div className="terrain-card__body">
        <TerrainTile terrain={tile.terrain} scale={1.5} />
        <div className="terrain-card__text">
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
        </div>
      </div>
    </DockSection>
  );
}
