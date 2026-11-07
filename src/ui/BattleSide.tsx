import { CombatForecast } from './CombatForecast.tsx';
import { DockSection, isOnField } from './dock.tsx';
import { TeamCard } from './TeamCard.tsx';
import { UnitPanel } from './UnitPanel.tsx';
import { UnitSprite } from './UnitSprite.tsx';
import { useGameStore } from './useGameStore.ts';

// The column docked on the stage's right all through a battle, the mirror
// of BattleDock: the roster to deploy during deployment; then the combat
// forecast while an attack is being aimed (CombatForecast docked) with the
// attacker's card under it (the left column shows the target, under the
// cursor); and otherwise the party, so the player always sees who is left
// to move, with the enemies under it. Hidden on narrow windows, where the
// forecast floats beside the fighters instead (see ui.css).
export function BattleSide() {
  const onField = useGameStore(isOnField);
  const deploying = useGameStore((state) => state.phase === 'deployment');
  const forecastOpen = useGameStore((state) => state.combatForecast !== null);
  const attacker = useGameStore((state) => state.activeUnit);
  if (!onField) return null;

  return (
    <aside className="battle-side" aria-label="Battle roster">
      {deploying ? (
        <RosterCard />
      ) : forecastOpen ? (
        <>
          <CombatForecast docked />
          {attacker && <UnitPanel docked unit={attacker} heading="Attacker" />}
        </>
      ) : (
        <>
          <PartyCard />
          <EnemiesCard />
        </>
      )}
    </aside>
  );
}

// Who is left to move, then who is left to beat.
function PartyCard() {
  const party = useGameStore((state) => state.party);
  const left = party.filter((unit) => !unit.acted && !unit.fallen).length;
  return (
    <TeamCard
      title="Party"
      team="player"
      units={party}
      footer={
        <>
          <span className="team-card__count">{left}</span> to move
        </>
      }
    />
  );
}

function EnemiesCard() {
  const enemies = useGameStore((state) => state.enemies);
  const left = enemies.filter((unit) => !unit.fallen).length;
  return (
    <TeamCard
      title="Enemies"
      team="enemy"
      units={enemies}
      footer={
        <>
          <span className="team-card__count">{left}</span> to defeat
        </>
      }
    />
  );
}

// During deployment, who can take the field: each roster unit with its
// sprite, marked once placed, dim once the map's limit leaves it no room.
function RosterCard() {
  const roster = useGameStore((state) => state.deploymentRoster);
  const limit = useGameStore((state) => state.deploymentLimit);
  if (roster.length === 0) return null;

  const placed = roster.filter((entry) => entry.placed).length;
  return (
    <DockSection title="Roster" className="roster-card">
      <ul className="roster-card__list">
        {roster.map((entry) => {
          const classes = ['roster-card__unit'];
          if (entry.placed) classes.push('roster-card__unit--placed');
          if (entry.disabled) classes.push('roster-card__unit--disabled');
          return (
            <li key={entry.id} className={classes.join(' ')}>
              <span className="roster-card__sprite">
                <UnitSprite sprite={entry.sprite} />
              </span>
              <span className="roster-card__name" title={entry.label}>
                {entry.label}
              </span>
              <span className="roster-card__tag">{entry.placed ? 'Placed' : ''}</span>
            </li>
          );
        })}
      </ul>
      <p className="roster-card__count">
        <span className="roster-card__count-number">{placed}</span>
        {limit !== null && <span className="roster-card__count-limit"> / {limit}</span>} placed
      </p>
    </DockSection>
  );
}
