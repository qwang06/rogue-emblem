import type { ReactNode } from 'react';
import type { PartyUnitView } from '../bridge/partyView.ts';
import type { Team } from '../game/turns.ts';
import { DockSection } from './dock.tsx';
import { UnitSprite } from './UnitSprite.tsx';

// A side's units as a column's readout (the party on the right, the
// enemies under it, or under the objective during deployment): one unit per
// row with its sprite, serif name, class and level, and its HP bar in the
// side's color; dim once it has acted this phase, struck through once it
// has fallen. `footer` is the line under the list ("2 to move").
export function TeamCard({
  title,
  team,
  units,
  footer,
}: {
  title: string;
  team: Team;
  units: readonly PartyUnitView[];
  footer?: ReactNode;
}) {
  if (units.length === 0) return null;

  return (
    <DockSection title={title} className={`team-card team-card--${team}`}>
      <ul className="team-card__list">
        {units.map((unit) => (
          <TeamRow key={unit.id} unit={unit} />
        ))}
      </ul>
      {footer && <p className="team-card__footer">{footer}</p>}
    </DockSection>
  );
}

function TeamRow({ unit }: { unit: PartyUnitView }) {
  const classes = ['team-card__unit'];
  if (unit.acted) classes.push('team-card__unit--acted');
  if (unit.fallen) classes.push('team-card__unit--fallen');
  const percent = unit.maxHealth > 0 ? (unit.health / unit.maxHealth) * 100 : 0;
  return (
    <li className={classes.join(' ')}>
      <span className="team-card__sprite">
        <UnitSprite sprite={unit.sprite} />
      </span>
      <span className="team-card__name" title={unit.name}>
        {unit.name}
      </span>
      <span className="team-card__class" title={unit.classLabel ?? undefined}>
        {unit.classLabel ?? '–'}
        <span className="team-card__level"> Lv {unit.level}</span>
      </span>
      <span className="team-card__hp">
        <span className="team-card__hp-fill" style={{ width: `${percent}%` }} />
      </span>
      <span className="team-card__hp-value">
        {unit.health}/{unit.maxHealth}
      </span>
    </li>
  );
}
