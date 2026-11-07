import type { PartyUnitView } from '../bridge/partyView.ts';
import { DockSection, isOnField } from './BattleDock.tsx';
import { CombatForecast } from './CombatForecast.tsx';
import { UnitSprite } from './UnitSprite.tsx';
import { useGameStore } from './useGameStore.ts';

// The column docked on the stage's right all through a battle, the mirror
// of BattleDock: the roster to deploy during deployment, then the combat
// forecast while an attack is being aimed (CombatForecast docked), and
// otherwise the party, so the player always sees who is left to move.
// Hidden on narrow windows, where the forecast floats beside the fighters
// instead (see ui.css).
export function BattleSide() {
  const onField = useGameStore(isOnField);
  const deploying = useGameStore((state) => state.phase === 'deployment');
  const forecastOpen = useGameStore((state) => state.combatForecast !== null);
  if (!onField) return null;

  return (
    <aside className="battle-side" aria-label="Battle roster">
      {deploying ? <RosterCard /> : forecastOpen ? <CombatForecast docked /> : <PartyCard />}
    </aside>
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

// Every deployed player unit with its HP: dim once it has acted this
// phase, struck through once it has fallen.
function PartyCard() {
  const party = useGameStore((state) => state.party);
  if (party.length === 0) return null;

  const left = party.filter((unit) => !unit.acted && !unit.fallen).length;
  return (
    <DockSection title="Party" className="party-card">
      <ul className="party-card__list">
        {party.map((unit) => (
          <PartyRow key={unit.id} unit={unit} />
        ))}
      </ul>
      <p className="party-card__left">
        <span className="party-card__left-count">{left}</span> to move
      </p>
    </DockSection>
  );
}

function PartyRow({ unit }: { unit: PartyUnitView }) {
  const classes = ['party-card__unit'];
  if (unit.acted) classes.push('party-card__unit--acted');
  if (unit.fallen) classes.push('party-card__unit--fallen');
  const percent = unit.maxHealth > 0 ? (unit.health / unit.maxHealth) * 100 : 0;
  return (
    <li className={classes.join(' ')}>
      <span className="party-card__sprite">
        <UnitSprite sprite={unit.sprite} />
      </span>
      <span className="party-card__name" title={unit.name}>
        {unit.name}
      </span>
      <span className="party-card__class" title={unit.classLabel ?? undefined}>
        {unit.classLabel ?? '–'}
        <span className="party-card__level"> Lv {unit.level}</span>
      </span>
      <span className="party-card__hp">
        <span className="party-card__hp-fill" style={{ width: `${percent}%` }} />
      </span>
      <span className="party-card__hp-value">
        {unit.health}/{unit.maxHealth}
      </span>
    </li>
  );
}
