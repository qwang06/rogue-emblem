import { gameCommands } from '../bridge/commands.ts';
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
          <ThreatCard />
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
  const intents = useGameStore((state) => state.enemyIntents);
  const left = enemies.filter((unit) => !unit.fallen).length;
  return (
    <TeamCard
      title="Enemies"
      team="enemy"
      units={enemies}
      intents={intents}
      footer={
        <>
          <span className="team-card__count">{left}</span> to defeat
        </>
      }
    />
  );
}

// What the enemies' intents add up to, pinned at the column's foot
// during the player's phase: how many units they have in their sights and
// the HP those would lose if nothing moved (with how many it would fell),
// or that no one is in reach, and the key that shades their reach.
function ThreatCard() {
  const threat = useGameStore((state) => state.threat);
  const danger = useGameStore((state) => state.dangerZoneVisible);
  if (!threat) return null;

  return (
    <DockSection title="Threat" className="threat-card">
      <p className="threat-card__line">
        {threat.units === 0 ? (
          <span className="threat-card__calm">No one is in reach</span>
        ) : (
          <>
            <span className="threat-card__units">
              {threat.units} {threat.units === 1 ? 'unit' : 'units'}
            </span>{' '}
            take <span className="threat-card__damage">{threat.damage}</span> if nothing moves
            {threat.lethal > 0 && <span className="threat-card__lethal"> · {threat.lethal} would fall</span>}
          </>
        )}
      </p>
      <button
        type="button"
        className="threat-card__toggle"
        aria-pressed={danger}
        onClick={() => gameCommands.send({ type: 'toggle-danger-zone' })}
      >
        <kbd>D</kbd> {danger ? 'Hide danger' : 'Show danger'}
      </button>
    </DockSection>
  );
}

// During deployment, who can take the field: each roster unit with its
// sprite, class, level and HP, marked once placed, dim once the map's
// limit leaves it no room; how many are placed at the column's foot.
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
              <span className="roster-card__class" title={entry.classLabel ?? undefined}>
                {entry.classLabel ?? '–'} Lv {entry.level}
              </span>
              <span className="roster-card__hp">
                HP{' '}
                <span className="roster-card__hp-value">
                  {entry.health}/{entry.maxHealth}
                </span>
              </span>
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
