import type { ReactNode } from 'react';
import type { IntentView } from '../bridge/intentView.ts';
import type { PartyUnitView } from '../bridge/partyView.ts';
import type { Team } from '../game/turns.ts';
import { DockSection } from './dock.tsx';
import { Pips } from './Pips.tsx';
import { UnitSprite } from './UnitSprite.tsx';

// A side's units as a column's readout (the party on the right, the
// enemies under it, or under the objective during deployment): one unit per
// row with its sprite, serif name and its HP number at the row's edge,
// then its class and level with its HP as blocks (Pips) under them; dim and
// flagged once it has acted this phase, struck through once it has fallen.
// Given the enemies' `intents`, each enemy's row says what it means to do
// next phase. `footer` is the line under the list ("2 to move").
export function TeamCard({
  title,
  team,
  units,
  intents,
  footer,
}: {
  title: string;
  team: Team;
  units: readonly PartyUnitView[];
  intents?: readonly IntentView[];
  footer?: ReactNode;
}) {
  if (units.length === 0) return null;

  return (
    <DockSection title={title} className={`team-card team-card--${team}`}>
      <ul className="team-card__list">
        {units.map((unit) => (
          <TeamRow key={unit.id} unit={unit} intent={intents?.find((intent) => intent.unitId === unit.id)} />
        ))}
      </ul>
      {footer && <p className="team-card__footer">{footer}</p>}
    </DockSection>
  );
}

function TeamRow({ unit, intent }: { unit: PartyUnitView; intent?: IntentView }) {
  const classes = ['team-card__unit'];
  if (unit.acted) classes.push('team-card__unit--acted');
  if (unit.fallen) classes.push('team-card__unit--fallen');
  return (
    <li className={classes.join(' ')}>
      <span className="team-card__sprite">
        <UnitSprite sprite={unit.sprite} />
      </span>
      <span className="team-card__name" title={unit.name}>
        {unit.name}
      </span>
      <span className="team-card__hp-value">
        {unit.health}
        {unit.health !== unit.maxHealth && <span className="team-card__hp-max">/{unit.maxHealth}</span>}
      </span>
      <span className="team-card__class" title={unit.classLabel ?? undefined}>
        {unit.classLabel ?? '–'}
        <span className="team-card__level"> · Lv {unit.level}</span>
        {unit.acted && !unit.fallen && <span className="team-card__flag"> · Moved</span>}
      </span>
      <span className="team-card__hp">
        <Pips value={unit.health} max={unit.maxHealth} size="small" />
      </span>
      {intent && !unit.fallen && <Intent intent={intent} />}
    </li>
  );
}

// What an enemy means to do next phase, under its row: "➜ Faye · 4 dmg ×2
// · Hit 61", "Holds" when it stays put, or "Moves" when it only walks.
function Intent({ intent }: { intent: IntentView }) {
  if (!intent.targetName) {
    return <span className="team-card__intent team-card__intent--idle">{intent.holds ? 'Holds' : 'Moves'}</span>;
  }
  return (
    <span className="team-card__intent">
      <span className="team-card__intent-arrow" aria-hidden="true">
        ➜
      </span>
      <span className="team-card__intent-target">{intent.targetName}</span>
      <span className="team-card__intent-dot"> · </span>
      <span className="team-card__intent-damage">
        {intent.damage} dmg{intent.strikes > 1 && ` ×${intent.strikes}`}
      </span>
      <span className="team-card__intent-dot"> · </span>
      <span>Hit {intent.hit}</span>
    </span>
  );
}
